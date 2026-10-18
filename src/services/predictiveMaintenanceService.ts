import {
  FactoryMachine,
  MaintenanceLogTask,
  MachinePredictiveAnalysis,
  FleetPredictiveSummary,
  MachineWearIndicator,
  PredictiveAlertLevel,
  UserProfile,
} from '../types';
import {
  getStoredMachines,
  saveMachines,
  getStoredMaintenanceLogs,
  logCompletedMaintenanceTask,
  computeMachineStatus,
} from './maintenanceService';

// Standard operational daily runtime velocity for recycling plant machinery (hours/day)
export const DAILY_RUNTIME_RATES: Record<string, number> = {
  EXTRUSION: 18,
  SHREDDING: 14,
  THERMOFORMING: 16,
  UTILITY: 20,
  SCALE: 10,
};

// Reference current factory simulation date
export const FACTORY_CURRENT_DATE = '2026-09-02';

/**
 * Format date offset in days from factory simulation date
 */
function addDaysToDate(baseDateStr: string, days: number): string {
  const base = new Date(baseDateStr);
  const target = new Date(base.getTime() + Math.max(0, days) * 24 * 60 * 60 * 1000);
  return target.toISOString().split('T')[0];
}

/**
 * Analyze an individual factory machine's telemetry and historical maintenance to project
 * degradation, failure probability, and Estimated Time-to-Failure (TTF).
 */
export function calculateMachinePredictive(
  machine: FactoryMachine,
  logs: MaintenanceLogTask[] = []
): MachinePredictiveAnalysis {
  const dailyRate = DAILY_RUNTIME_RATES[machine.category] || 16;
  const interval = machine.intervalHours || 500;
  const threshold = machine.maintenanceThresholdHours;
  const current = machine.currentOperatingHours;

  // Hours run since last maintenance or cycle origin
  const cycleOrigin = machine.lastMaintenanceHours > 0 ? machine.lastMaintenanceHours : Math.max(0, threshold - interval);
  const hoursIntoCurrentCycle = Math.max(0, current - cycleOrigin);
  const cycleConsumptionRatio = Math.min(2.0, hoursIntoCurrentCycle / interval);

  const hoursUntilThreshold = threshold - current;
  const isOverdue = current >= threshold;
  const overdueHours = isOverdue ? current - threshold : 0;

  // In industrial reliability engineering, maximum failure tolerance buffer before mechanical seizure
  // is typically between 6% and 10% of standard service interval
  const failureToleranceBufferHours = Math.round(interval * 0.08); // e.g. 24h on 300h interval, 40h on 500h interval
  const absoluteFailureThresholdHours = threshold + failureToleranceBufferHours;

  // Estimated Time-to-Failure (TTF) in hours
  let estimatedTimeToFailureHours = 0;
  if (current >= absoluteFailureThresholdHours) {
    // Machine is dangerously beyond buffer, imminent breakdown within 2-4 running hours
    estimatedTimeToFailureHours = Math.max(1, Math.round(4 - Math.min(3, overdueHours / 10)));
  } else if (isOverdue) {
    // Overdue, operating on borrowed mechanical tolerance
    estimatedTimeToFailureHours = Math.max(2, absoluteFailureThresholdHours - current);
  } else {
    // Normal or approaching threshold
    estimatedTimeToFailureHours = hoursUntilThreshold + failureToleranceBufferHours;
  }

  // Convert TTF to decimal days
  const estimatedTimeToFailureDays = parseFloat((estimatedTimeToFailureHours / dailyRate).toFixed(1));

  // Projected failure date
  const estimatedFailureDate = addDaysToDate(FACTORY_CURRENT_DATE, estimatedTimeToFailureDays);

  // Proactive service deadline (target: before reaching 95% of threshold or within safe margin)
  const safeBufferHours = Math.max(8, Math.round(interval * 0.05));
  const proactiveWindowHours = Math.max(4, hoursUntilThreshold - safeBufferHours);
  const proactiveDays = isOverdue ? 0 : parseFloat((proactiveWindowHours / dailyRate).toFixed(1));
  const proactiveServiceDeadlineDate = addDaysToDate(FACTORY_CURRENT_DATE, proactiveDays);

  // Calculate Health Score (0 - 100%)
  // Non-linear degradation curve:
  // - Below 75% of interval: Health is 80-100%
  // - Between 75% and 95%: Health degrades to 50-70%
  // - At 100% (Threshold): Health is ~30%
  // - Overdue: Drops to 5% - 20%
  let healthScore = 100;
  if (current >= absoluteFailureThresholdHours) {
    healthScore = 8;
  } else if (isOverdue) {
    const overdueRatio = overdueHours / failureToleranceBufferHours;
    healthScore = Math.max(10, Math.round(30 - overdueRatio * 20));
  } else {
    const cycleUsage = hoursIntoCurrentCycle / interval;
    if (cycleUsage <= 0.5) {
      healthScore = Math.round(100 - cycleUsage * 20); // 100% down to 90%
    } else if (cycleUsage <= 0.85) {
      healthScore = Math.round(90 - (cycleUsage - 0.5) * 57); // 90% down to 70%
    } else {
      healthScore = Math.round(70 - (cycleUsage - 0.85) * 266); // 70% down to 30%
    }
  }

  // Degradation Percentage & Failure Probability
  const degradationPercentage = 100 - healthScore;
  const failureProbability = Math.min(
    98,
    Math.round(
      isOverdue
        ? 75 + (overdueHours / failureToleranceBufferHours) * 23
        : Math.pow(degradationPercentage / 100, 1.8) * 75
    )
  );

  // Determine Alert Level
  let alertLevel: PredictiveAlertLevel = 'HEALTHY';
  if (isOverdue || estimatedTimeToFailureHours <= 24 || healthScore < 25) {
    alertLevel = 'CRITICAL_FAILURE_IMMINENT';
  } else if (estimatedTimeToFailureHours <= 72 || hoursUntilThreshold <= 30 || healthScore < 50) {
    alertLevel = 'PROACTIVE_SERVICE_REQUIRED';
  } else if (estimatedTimeToFailureHours <= 160 || hoursUntilThreshold <= 80 || healthScore < 75) {
    alertLevel = 'SCHEDULED_ATTENTION';
  } else {
    alertLevel = 'HEALTHY';
  }

  // Machine category telemetry wear indicators & root cause predictions
  const wearIndicators = generateCategoryWearIndicators(machine, cycleConsumptionRatio, isOverdue);
  const failureMeta = getCategoryFailureMetadata(machine);

  // Calculate Avoided Unscheduled Downtime & Cost Savings
  // Proactive service takes ~2-3 hours scheduled downtime. Unscheduled breakdown halts line for 12-24 hours.
  const baseDowntimeRiskHours = machine.category === 'EXTRUSION' ? 18 : machine.category === 'SHREDDING' ? 12 : 14;
  const estimatedDowntimeAvoidedHours = isOverdue ? baseDowntimeRiskHours : Math.round(baseDowntimeRiskHours * (degradationPercentage / 100));
  const hourlyLineRateUSD = machine.criticality === 'CRITICAL' ? 350 : 200;
  const estimatedCostSavingsUSD = estimatedDowntimeAvoidedHours * hourlyLineRateUSD;

  return {
    machineId: machine.id,
    machineCode: machine.code,
    nameEn: machine.nameEn,
    nameAr: machine.nameAr,
    category: machine.category,
    sectionEn: machine.sectionEn,
    sectionAr: machine.sectionAr,
    currentOperatingHours: current,
    maintenanceThresholdHours: threshold,
    intervalHours: interval,
    assignedTechnician: machine.assignedTechnician,
    criticality: machine.criticality,
    status: machine.status,

    dailyRuntimeRateHours: dailyRate,
    healthScore,
    degradationPercentage,
    failureProbability,

    estimatedTimeToFailureHours,
    estimatedTimeToFailureDays,
    estimatedFailureDate,
    proactiveServiceDeadlineDate,
    hoursUntilThreshold,

    alertLevel,
    primaryFailureModeEn: failureMeta.primaryFailureModeEn,
    primaryFailureModeAr: failureMeta.primaryFailureModeAr,
    recommendedActionEn: failureMeta.recommendedActionEn,
    recommendedActionAr: failureMeta.recommendedActionAr,
    recommendedPartsEn: failureMeta.recommendedPartsEn,
    recommendedPartsAr: failureMeta.recommendedPartsAr,
    estimatedDowntimeAvoidedHours,
    estimatedCostSavingsUSD,

    wearIndicators,
    confidenceScore: 92 + Math.round((current % 7)),
  };
}

/**
 * Generate simulated sensor wear metrics based on machine category & runtime
 */
function generateCategoryWearIndicators(
  machine: FactoryMachine,
  cycleRatio: number,
  isOverdue: boolean
): MachineWearIndicator[] {
  const mult = isOverdue ? 1.25 : Math.max(0.3, cycleRatio);

  switch (machine.category) {
    case 'SHREDDING':
      return [
        {
          nameEn: 'Rotary Knife Edge Wear',
          nameAr: 'تآكل حد سكاكين الدوار',
          value: Math.min(100, Math.round(35 + mult * 58)),
          unit: '%',
          threshold: 85,
          status: mult > 0.9 ? 'CRITICAL' : mult > 0.7 ? 'ELEVATED' : 'NORMAL',
        },
        {
          nameEn: 'Main Bearing Vibration Velocity',
          nameAr: 'سرعة اهتزاز المحامل الرئيسية',
          value: parseFloat((2.1 + mult * 4.8).toFixed(1)),
          unit: 'mm/s',
          threshold: 5.5,
          status: mult > 0.85 ? 'CRITICAL' : mult > 0.65 ? 'ELEVATED' : 'NORMAL',
        },
        {
          nameEn: 'Motor Drive Torque Deviation',
          nameAr: 'انحراف عزم محرك الجرش',
          value: Math.min(100, Math.round(15 + mult * 70)),
          unit: '%',
          threshold: 80,
          status: mult > 0.9 ? 'CRITICAL' : 'NORMAL',
        },
      ];

    case 'EXTRUSION':
      return [
        {
          nameEn: 'Hydraulic Circuit Delta Pressure',
          nameAr: 'فرق ضغط دائرة الهيدروليك',
          value: Math.min(100, Math.round(25 + mult * 65)),
          unit: 'bar',
          threshold: 75,
          status: mult > 0.85 ? 'CRITICAL' : mult > 0.6 ? 'ELEVATED' : 'NORMAL',
        },
        {
          nameEn: 'Extrusion Barrel Zone 3 Thermal Drift',
          nameAr: 'الانحراف الحراري لبرميل البثق',
          value: parseFloat((1.2 + mult * 9.5).toFixed(1)),
          unit: '°C',
          threshold: 7.0,
          status: mult > 0.8 ? 'CRITICAL' : mult > 0.5 ? 'ELEVATED' : 'NORMAL',
        },
        {
          nameEn: 'Melt Viscosity Shear Stress',
          nameAr: 'إجهاد القص ولزوجة المصهور',
          value: Math.min(100, Math.round(30 + mult * 55)),
          unit: '%',
          threshold: 75,
          status: mult > 0.75 ? 'ELEVATED' : 'NORMAL',
        },
      ];

    case 'THERMOFORMING':
      return [
        {
          nameEn: 'Vacuum Chamber Pull-down Rate',
          nameAr: 'معدل سحب الفاكيوم للغرفة',
          value: Math.min(100, Math.round(40 + mult * 52)),
          unit: '%',
          threshold: 80,
          status: mult > 0.8 ? 'CRITICAL' : 'NORMAL',
        },
        {
          nameEn: 'Pneumatic Actuator Seal Fatigue',
          nameAr: 'إجهاد حشوات المشغلات الهوائية',
          value: Math.min(100, Math.round(20 + mult * 68)),
          unit: '%',
          threshold: 75,
          status: mult > 0.85 ? 'CRITICAL' : mult > 0.65 ? 'ELEVATED' : 'NORMAL',
        },
      ];

    case 'UTILITY':
      return [
        {
          nameEn: 'Air/Oil Separator Delta P',
          nameAr: 'فرق ضغط فاصل الزيت عن الهواء',
          value: parseFloat((0.2 + mult * 0.95).toFixed(2)),
          unit: 'bar',
          threshold: 0.8,
          status: mult > 0.85 ? 'CRITICAL' : mult > 0.6 ? 'ELEVATED' : 'NORMAL',
        },
        {
          nameEn: 'Compressor Stator Winding Temp',
          nameAr: 'حرارة ملفات الضاغط الحلزوني',
          value: Math.min(130, Math.round(65 + mult * 38)),
          unit: '°C',
          threshold: 95,
          status: mult > 0.8 ? 'CRITICAL' : 'NORMAL',
        },
      ];

    case 'SCALE':
    default:
      return [
        {
          nameEn: 'Digital Load Cell Balance Shift',
          nameAr: 'انزياح توازن خلايا الوزن الرقمية',
          value: parseFloat((0.005 + mult * 0.04).toFixed(3)),
          unit: '% err',
          threshold: 0.03,
          status: mult > 0.75 ? 'ELEVATED' : 'NORMAL',
        },
        {
          nameEn: 'Junction Box Hermetic Humidity',
          nameAr: 'رطوبة صندوق التوصيل المحكم',
          value: Math.min(100, Math.round(30 + mult * 45)),
          unit: '% RH',
          threshold: 65,
          status: mult > 0.8 ? 'CRITICAL' : 'NORMAL',
        },
      ];
  }
}

/**
 * Domain-specific failure root-causes and proactive maintenance playbooks
 */
function getCategoryFailureMetadata(machine: FactoryMachine) {
  switch (machine.category) {
    case 'SHREDDING':
      return {
        primaryFailureModeEn: 'Rotary Knife Fracture & Rotor Imbalance Seizure',
        primaryFailureModeAr: 'تصدع سكاكين الدوار وفقدان اتزان المحامل وانسداد الغربال',
        recommendedActionEn: 'Schedule immediate blade reversal/re-sharpening, purge regrind chamber, and apply SKF high-pressure lithium grease.',
        recommendedActionAr: 'عكس وشحذ شفرات الدوار فوراً، تنظيف حجرة الثرم، وحقن شحم ليثيوم عالي التحمل للمحامل.',
        recommendedPartsEn: 'D2 Tool Steel Knives (4x), Heavy Rotor Bearings (SKF 22218), V-Belt Set',
        recommendedPartsAr: 'شفرات فولاذية D2 عدد 4، محامل دوار ثقيلة SKF، طقم سيور سحب',
      };

    case 'EXTRUSION':
      return {
        primaryFailureModeEn: 'Hydraulic Proportional Valve Sticking & Heater Band Burnout',
        primaryFailureModeAr: 'انسداد صمام الهيدروليك التناسبي واحتراق أحزمة التسخين الحراري',
        recommendedActionEn: 'Perform proactive hydraulic oil flush, replace 10-micron cartridge filter, and recalibrate zone 3/4 PID heating thermocouples.',
        recommendedActionAr: 'تبديل زيت الهيدروليك وفلتر 10 ميكرون، وإعادة معايرة حساسات الحرارة لمناطق البثق 3 و 4.',
        recommendedPartsEn: 'Mobil DTE 25 Hydraulic Oil (60L), Ceramic Heater Bands (3x), Type-J Thermocouples',
        recommendedPartsAr: 'زيت هيدروليك موبيل 60 لتر، أحزمة تسخين سيراميك عدد 3، حساسات حرارة J',
      };

    case 'THERMOFORMING':
      return {
        primaryFailureModeEn: 'Forming Vacuum Seal Blow-By & Pneumatic Cylinder Degradation',
        primaryFailureModeAr: 'تسريب حشوات تفريغ الهواء (الفاكيوم) وتآكل كباسات ضغط القولبة',
        recommendedActionEn: 'Replace perimeter silicone vacuum seals and lubricate pneumatic actuator guide rods.',
        recommendedActionAr: 'استبدال حشوات الفاكيوم السيليكونية وتشحيم أعمدة التوجيه للكباسات الهوائية.',
        recommendedPartsEn: 'Silicone Vacuum Seal Kit, Festo Solenoid 5/2-Way Valve, Rod Seals',
        recommendedPartsAr: 'طقم حشوات فاكيوم سيليكون، صمام فيستو كهربائي، موانع تسريب',
      };

    case 'UTILITY':
      return {
        primaryFailureModeEn: 'Air/Oil Separator Differential Blow-Out & Condenser Scale',
        primaryFailureModeAr: 'انسداد فاصل الزيت بالهواء وارتفاع حرارة الملفات وتكلس المكثف',
        recommendedActionEn: 'Replace spin-on oil separator cartridge, drain air receiver condensate, and power-wash chiller condenser fins.',
        recommendedActionAr: 'استبدال فلتر فاصل الزيت، تصريف متكثف خزان الهواء، وتنظيف زعانف تبريد المكثف.',
        recommendedPartsEn: 'Atlas Copco Spin-On Separator, Synthetic Rotary Screw Fluid, Coil Cleaner',
        recommendedPartsAr: 'فلتر فاصل زيت أطلس كوبكو، زيت تخليقي للضاغط الحلزوني، محلول تنظيف',
      };

    case 'SCALE':
    default:
      return {
        primaryFailureModeEn: 'Digital Load Cell Bridge Drift & Moisture Bridge Signal Short',
        primaryFailureModeAr: 'انحراف قراءة خلايا الوزن الرقمية وتأثير الرطوبة على صندوق التجميع',
        recommendedActionEn: 'Inspect IP67 conduit seals, replace desiccants in summing box, and perform certified corner balance check.',
        recommendedActionAr: 'فحص عوازل الرطوبة، استبدال حبيبات التجفيف، وإجراء معايرة توازن الأطراف.',
        recommendedPartsEn: 'IP67 Cable Gland Seals, Moisture Desiccant Canister, Surge Suppressor',
        recommendedPartsAr: 'عوازل كابلات IP67، عبوات سحب رطوبة، واقي صواعق رقمي',
      };
  }
}

/**
 * Get aggregated fleet predictive maintenance analysis for the entire plant
 */
export function getPredictiveMaintenanceFleetAnalysis(
  machinesInput?: FactoryMachine[],
  logsInput?: MaintenanceLogTask[]
): FleetPredictiveSummary {
  const machines = machinesInput || getStoredMachines();
  const logs = logsInput || getStoredMaintenanceLogs();

  const analyses = machines.map((m) => calculateMachinePredictive(m, logs));

  // Sort by urgency: lowest TTF first
  analyses.sort((a, b) => a.estimatedTimeToFailureHours - b.estimatedTimeToFailureHours);

  const criticalFailureImminentCount = analyses.filter((a) => a.alertLevel === 'CRITICAL_FAILURE_IMMINENT').length;
  const proactiveServiceRequiredCount = analyses.filter((a) => a.alertLevel === 'PROACTIVE_SERVICE_REQUIRED').length;
  const scheduledAttentionCount = analyses.filter((a) => a.alertLevel === 'SCHEDULED_ATTENTION').length;
  const healthyCount = analyses.filter((a) => a.alertLevel === 'HEALTHY').length;

  const totalAnalyzed = analyses.length;
  const averageHealthScore =
    totalAnalyzed > 0
      ? Math.round(analyses.reduce((sum, a) => sum + a.healthScore, 0) / totalAnalyzed)
      : 100;

  const totalUnscheduledDowntimeAvoidedHours = analyses.reduce(
    (sum, a) => sum + a.estimatedDowntimeAvoidedHours,
    0
  );

  const totalEstimatedSavingsUSD = analyses.reduce(
    (sum, a) => sum + a.estimatedCostSavingsUSD,
    0
  );

  const highRiskMachines = analyses.filter(
    (a) => a.alertLevel === 'CRITICAL_FAILURE_IMMINENT' || a.alertLevel === 'PROACTIVE_SERVICE_REQUIRED'
  );

  const proactiveQueue = analyses.filter((a) => a.alertLevel !== 'HEALTHY');

  return {
    totalAnalyzed,
    averageHealthScore,
    criticalFailureImminentCount,
    proactiveServiceRequiredCount,
    scheduledAttentionCount,
    healthyCount,
    totalUnscheduledDowntimeAvoidedHours,
    totalEstimatedSavingsUSD,
    highRiskMachines,
    proactiveQueue,
  };
}

/**
 * Execute Proactive Maintenance directly from the Predictive Alert:
 * Immediately logs task, increments threshold, clears due state, and restores machine health score to ~100%
 */
export function executeProactiveMaintenance(
  machineId: string,
  currentUser: UserProfile,
  options?: {
    technician?: string;
    downtimeHours?: number;
    notes?: string;
  }
): {
  updatedMachine: FactoryMachine;
  allMachines: FactoryMachine[];
  newTask: MaintenanceLogTask;
  predictiveSummary: FleetPredictiveSummary;
} {
  const currentMachines = getStoredMachines();
  const machine = currentMachines.find((m) => m.id === machineId);
  if (!machine) {
    throw new Error(`Machine ${machineId} not found`);
  }

  const analysis = calculateMachinePredictive(machine);
  const tech = options?.technician || machine.assignedTechnician || currentUser.nameAr;
  const downtime = options?.downtimeHours || 2.5;

  const result = logCompletedMaintenanceTask({
    machineId: machine.id,
    taskTitleEn: `Proactive Overhaul: ${analysis.primaryFailureModeEn}`,
    taskTitleAr: `صيانة استباقية وقائية: ${analysis.primaryFailureModeAr}`,
    taskType: 'PREVENTIVE',
    downtimeHours: downtime,
    performedBy: tech,
    supervisorSignOff: `${currentUser.nameAr} (${currentUser.role})`,
    partsReplacedEn: analysis.recommendedPartsEn,
    partsReplacedAr: analysis.recommendedPartsAr,
    totalCostUSD: analysis.estimatedCostSavingsUSD > 0 ? Math.round(analysis.estimatedCostSavingsUSD * 0.15) : 150,
    notesEn: `Executed via Predictive Maintenance Engine. Prevented estimated ${analysis.estimatedDowntimeAvoidedHours}h unscheduled breakdown. ${options?.notes || ''}`,
    notesAr: `تم التنفيذ عبر محرك الصيانة التنبؤية. تم تفادي توقف طارئ مقدر بـ ${analysis.estimatedDowntimeAvoidedHours} ساعة. ${options?.notes || ''}`,
  });

  const predictiveSummary = getPredictiveMaintenanceFleetAnalysis(result.allMachines, result.allLogs);

  return {
    updatedMachine: result.updatedMachine,
    allMachines: result.allMachines,
    newTask: result.newTask,
    predictiveSummary,
  };
}

/**
 * Interactive Simulation Helper:
 * Allows user to simulate machine runtime forward by e.g. +8h, +16h, or +24h to observe
 * how TTF counts down in real time and triggers proactive alerts.
 */
export function simulateRuntimeAdvance(
  machineId: string,
  additionalHours: number
): {
  updatedMachine: FactoryMachine;
  allMachines: FactoryMachine[];
  predictiveSummary: FleetPredictiveSummary;
} {
  const currentMachines = getStoredMachines();
  const updatedMachines = currentMachines.map((m) => {
    if (m.id === machineId) {
      const newHours = Math.max(0, m.currentOperatingHours + additionalHours);
      const newStatus = computeMachineStatus(newHours, m.maintenanceThresholdHours, m.status);
      return {
        ...m,
        currentOperatingHours: newHours,
        status: newStatus,
      };
    }
    return m;
  });

  saveMachines(updatedMachines);
  const updatedMachine = updatedMachines.find((m) => m.id === machineId)!;
  const predictiveSummary = getPredictiveMaintenanceFleetAnalysis(updatedMachines);

  return {
    updatedMachine,
    allMachines: updatedMachines,
    predictiveSummary,
  };
}
