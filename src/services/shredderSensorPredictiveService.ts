/**
 * Industrial Shredder Sensor Monitoring & Predictive Maintenance Service
 * Al-Karwan Plastics Factory - Regrind & Shredding Module (Doc 360 / 352)
 *
 * Forecasts potential rotary blade wear, cutting bevel dullness, and motor electrical
 * failure based on real-time load current (Amperes) spikes, thermal telemetry,
 * and mechanical vibration velocity. Integrates directly into the factory
 * MaintenanceAlerts feed.
 */

import {
  MaintenanceAlertNotification,
  MaintenanceAlertSeverity,
  MaintenanceIntervalStage,
  UserProfile,
} from '../types';
import {
  EVENT_MAINTENANCE_ALERT_TRIGGERED,
  playIndustrialAlertChime,
} from './maintenanceAlertService';

export type ShredderAlertLevel =
  | 'HEALTHY'
  | 'SCHEDULED_ATTENTION'
  | 'PROACTIVE_SERVICE_REQUIRED'
  | 'CRITICAL_FAILURE_IMMINENT';

export type ShredderSpikeSeverity = 'NONE' | 'MODERATE' | 'CRITICAL';

export interface ShredderSensorReading {
  id: string;
  timestamp: number;
  timeLabel: string;
  loadCurrentA: number; // Stator load current in Amperes
  activePowerKW: number; // Electrical active power
  motorTempC: number; // Motor winding temperature
  vibrationMmS: number; // Main rotor bearing vibration
  torqueNm: number; // Rotor shaft torque
  isSpike: boolean;
  spikeSeverity: ShredderSpikeSeverity;
  feedRateKgH: number; // Material throughput feed rate
}

export interface BladeWearForecast {
  edgeWearPct: number; // 0 - 100%
  cuttingBevelDullnessPct: number; // 0 - 100%
  clearanceGapMm: number; // 0.25mm nominal up to 0.95mm
  bladeSharpnessIndex: number; // 100% down to 10%
  estimatedHoursRemaining: number; // TTF in running hours
  projectedServiceDate: string;
  wearStatus: 'OPTIMAL' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  riskAssessmentAr: string;
  riskAssessmentEn: string;
}

export interface MotorHealthForecast {
  ratedFullLoadAmps: number; // 135A for 75kW motor
  averageCurrentA: number;
  peakSpikeCurrentA: number;
  spikeCountLast10Min: number;
  spikeFrequencyPerHour: number;
  windingTempC: number;
  vibrationMmS: number;
  thermalStressIndex: number; // 0 - 100%
  motorFailureProbability: number; // 0 - 100%
  estimatedHoursRemaining: number; // TTF in running hours
  motorStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  riskAssessmentAr: string;
  riskAssessmentEn: string;
}

export interface ShredderSensorBaseline {
  machineId: string;
  machineCode: string;
  ratedPowerKW: number;
  fullLoadAmps: number; // 135A
  nominalRunningCurrentA: number; // 105A
  warningSpikeThresholdA: number; // 145A
  criticalSpikeThresholdA: number; // 170A
  emergencyTripCurrentA: number; // 210A
  maxSafeSpikesPer10Min: number; // 3
  criticalSpikesPer10Min: number; // 8
  nominalBladeGapMm: number; // 0.25mm
  maxSafeBladeGapMm: number; // 0.65mm
  nominalKnifeLifeHours: number; // 300h
  baselineWindingTempC: number; // 55°C
  warningWindingTempC: number; // 76°C
  criticalWindingTempC: number; // 88°C
  baselineVibrationMmS: number; // 2.2 mm/s
  warningVibrationMmS: number; // 4.5 mm/s
  criticalVibrationMmS: number; // 6.5 mm/s
  lastCalibratedDate: string;
}

export interface ShredderPredictiveAnalysis {
  machineId: string;
  machineCode: string;
  machineNameAr: string;
  machineNameEn: string;
  overallHealthScore: number; // 0 - 100%
  degradationPct: number;
  alertLevel: ShredderAlertLevel;
  primaryFailureModeAr: string;
  primaryFailureModeEn: string;
  recommendedActionAr: string;
  recommendedActionEn: string;
  recommendedPartsAr: string;
  recommendedPartsEn: string;
  avoidedDowntimeHours: number;
  estimatedCostSavingsUSD: number;
  confidenceScore: number;
  bladeWear: BladeWearForecast;
  motorHealth: MotorHealthForecast;
  baseline: ShredderSensorBaseline;
  recentReadings: ShredderSensorReading[];
  activeNotification: MaintenanceAlertNotification | null;
  lastEvaluatedAt: string;
  isSimulatedScenario?: string;
}

const STORAGE_KEY_BASELINE = 'alkarwan_shredder_sensor_baseline_v1';
const STORAGE_KEY_ACTIVE_ALERT = 'alkarwan_shredder_sensor_active_alert_v1';
const STORAGE_KEY_SIMULATION = 'alkarwan_shredder_sensor_sim_mode_v1';

export const DEFAULT_SHREDDER_BASELINE: ShredderSensorBaseline = {
  machineId: 'MCH-SHR-01',
  machineCode: 'MCH-SHR-01',
  ratedPowerKW: 75,
  fullLoadAmps: 135.0,
  nominalRunningCurrentA: 105.0,
  warningSpikeThresholdA: 145.0,
  criticalSpikeThresholdA: 170.0,
  emergencyTripCurrentA: 210.0,
  maxSafeSpikesPer10Min: 3,
  criticalSpikesPer10Min: 8,
  nominalBladeGapMm: 0.25,
  maxSafeBladeGapMm: 0.65,
  nominalKnifeLifeHours: 300,
  baselineWindingTempC: 55.0,
  warningWindingTempC: 76.0,
  criticalWindingTempC: 88.0,
  baselineVibrationMmS: 2.2,
  warningVibrationMmS: 4.5,
  criticalVibrationMmS: 6.5,
  lastCalibratedDate: '2026-09-20',
};

/**
 * Format date offset in days from current factory date
 */
function addDays(days: number): string {
  const base = new Date();
  const target = new Date(base.getTime() + Math.max(0, days) * 24 * 60 * 60 * 1000);
  return target.toISOString().split('T')[0];
}

/**
 * Get stored baseline configuration
 */
export function getStoredShredderBaseline(): ShredderSensorBaseline {
  if (typeof window === 'undefined') return DEFAULT_SHREDDER_BASELINE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BASELINE);
    if (raw) {
      return { ...DEFAULT_SHREDDER_BASELINE, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load shredder sensor baseline:', e);
  }
  return DEFAULT_SHREDDER_BASELINE;
}

/**
 * Save baseline configuration
 */
export function saveShredderBaseline(baseline: ShredderSensorBaseline): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_BASELINE, JSON.stringify(baseline));
  } catch (e) {
    console.warn('Failed to save shredder baseline:', e);
  }
}

/**
 * Get current simulation scenario if active
 */
export function getStoredSimulationScenario(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY_SIMULATION);
  } catch {
    return null;
  }
}

export function setStoredSimulationScenario(scenario: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (scenario) {
      localStorage.setItem(STORAGE_KEY_SIMULATION, scenario);
    } else {
      localStorage.removeItem(STORAGE_KEY_SIMULATION);
    }
  } catch {}
}

/**
 * Generate synthetic historical sensor series for waveform plotting
 */
export function generateSensorTelemetrySeries(
  scenario: 'NORMAL' | 'MILD_SPIKES' | 'BLADE_DULLNESS' | 'CRITICAL_SURGE' | 'ROTOR_JAM' = 'NORMAL',
  pointCount = 24
): ShredderSensorReading[] {
  const readings: ShredderSensorReading[] = [];
  const now = Date.now();
  const stepMs = 5000; // 5 seconds per tick

  for (let i = pointCount - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const dateObj = new Date(t);
    const timeLabel = dateObj.toTimeString().split(' ')[0];

    let baseA = 105;
    let spikeProb = 0.05;
    let spikeAmp = 120;
    let temp = 56;
    let vib = 2.4;
    let feedRate = 1200; // kg/h

    if (scenario === 'NORMAL') {
      baseA = 102 + Math.sin(i * 0.4) * 5;
      spikeProb = 0.04;
      spikeAmp = 125 + Math.random() * 8;
      temp = 54 + (i / pointCount) * 2;
      vib = 2.2 + (Math.random() * 0.4);
    } else if (scenario === 'MILD_SPIKES') {
      baseA = 118 + Math.sin(i * 0.4) * 8;
      spikeProb = 0.25;
      spikeAmp = 148 + Math.random() * 8;
      temp = 66 + (i / pointCount) * 4;
      vib = 3.6 + (Math.random() * 0.8);
      feedRate = 1350;
    } else if (scenario === 'BLADE_DULLNESS') {
      baseA = 138 + Math.sin(i * 0.5) * 10;
      spikeProb = 0.45;
      spikeAmp = 166 + Math.random() * 12;
      temp = 78 + (i / pointCount) * 5;
      vib = 4.8 + (Math.random() * 1.1);
      feedRate = 1100;
    } else if (scenario === 'CRITICAL_SURGE') {
      baseA = 152 + Math.sin(i * 0.5) * 12;
      spikeProb = 0.65;
      spikeAmp = 184 + Math.random() * 15;
      temp = 86 + (i / pointCount) * 6;
      vib = 6.2 + (Math.random() * 1.4);
      feedRate = 950;
    } else if (scenario === 'ROTOR_JAM') {
      if (i < 4) {
        baseA = 212 + Math.random() * 8;
        spikeProb = 1.0;
        spikeAmp = 218;
        temp = 92;
        vib = 7.8;
      } else {
        baseA = 160;
        spikeProb = 0.7;
        spikeAmp = 190;
        temp = 88;
        vib = 6.4;
      }
    }

    const isSpike = Math.random() < spikeProb || (i === 1 && scenario !== 'NORMAL');
    const currentA = parseFloat((isSpike ? Math.max(baseA, spikeAmp) : baseA + (Math.random() * 4 - 2)).toFixed(1));

    let spikeSeverity: ShredderSpikeSeverity = 'NONE';
    if (currentA >= 170.0) {
      spikeSeverity = 'CRITICAL';
    } else if (currentA >= 145.0) {
      spikeSeverity = 'MODERATE';
    }

    const activeKW = parseFloat(((currentA * 380 * 1.732 * 0.88) / 1000).toFixed(1));
    const torqueNm = parseFloat((activeKW * 22.5).toFixed(0));

    readings.push({
      id: `SENS-SHR-${t}`,
      timestamp: t,
      timeLabel,
      loadCurrentA: currentA,
      activePowerKW: activeKW,
      motorTempC: parseFloat(temp.toFixed(1)),
      vibrationMmS: parseFloat(vib.toFixed(2)),
      torqueNm,
      isSpike,
      spikeSeverity,
      feedRateKgH: feedRate,
    });
  }

  return readings;
}

/**
 * Execute the Predictive Maintenance Algorithm for Shredder Sensor Telemetry
 */
export function evaluateShredderSensorPredictive(
  readingsOverride?: ShredderSensorReading[],
  baselineOverride?: ShredderSensorBaseline
): ShredderPredictiveAnalysis {
  const baseline = baselineOverride || getStoredShredderBaseline();
  const simScenario = getStoredSimulationScenario();

  let readings: ShredderSensorReading[];
  if (readingsOverride && readingsOverride.length > 0) {
    readings = readingsOverride;
  } else {
    const scenarioKey = (simScenario as any) || 'NORMAL';
    readings = generateSensorTelemetrySeries(scenarioKey, 24);
  }

  // Statistical extraction from sensor readings
  const currents = readings.map((r) => r.loadCurrentA);
  const avgCurrentA = parseFloat(
    (currents.reduce((sum, v) => sum + v, 0) / currents.length).toFixed(1)
  );
  const peakSpikeCurrentA = Math.max(...currents);
  const temps = readings.map((r) => r.motorTempC);
  const avgTempC = parseFloat(
    (temps.reduce((sum, v) => sum + v, 0) / temps.length).toFixed(1)
  );
  const maxVib = Math.max(...readings.map((r) => r.vibrationMmS));

  // Count current spikes
  const warningSpikes = readings.filter((r) => r.loadCurrentA >= baseline.warningSpikeThresholdA).length;
  const criticalSpikes = readings.filter((r) => r.loadCurrentA >= baseline.criticalSpikeThresholdA).length;
  const totalSpikes10m = warningSpikes + criticalSpikes * 2;
  const spikeFrequencyPerHour = Math.round((totalSpikes10m / 2) * 6); // Extrapolate to /hour

  // 1. Blade Wear Forecast Engine
  // As cutting edges dull, crushing resistance causes sustained current rise and large current spikes.
  let edgeWearPct = 25;
  if (criticalSpikes >= 3 || avgCurrentA >= 155 || peakSpikeCurrentA >= 180) {
    edgeWearPct = Math.min(96, Math.round(82 + criticalSpikes * 2.5 + (avgCurrentA - 150) * 0.6));
  } else if (warningSpikes >= 4 || avgCurrentA >= 135 || peakSpikeCurrentA >= 150) {
    edgeWearPct = Math.min(84, Math.round(62 + warningSpikes * 3.2 + (avgCurrentA - 130) * 0.7));
  } else if (avgCurrentA >= 115 || warningSpikes >= 1) {
    edgeWearPct = Math.min(60, Math.round(38 + warningSpikes * 4));
  } else {
    edgeWearPct = Math.min(35, Math.round(20 + (avgCurrentA - 95) * 1.2));
  }

  const cuttingBevelDullnessPct = Math.min(100, Math.round(edgeWearPct * 1.05));
  const clearanceGapMm = parseFloat((0.25 + (edgeWearPct / 100) * 0.65).toFixed(2));
  const bladeSharpnessIndex = Math.max(8, Math.round(100 - edgeWearPct * 0.92));

  let bladeWearStatus: 'OPTIMAL' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'OPTIMAL';
  if (edgeWearPct >= 85) bladeWearStatus = 'CRITICAL';
  else if (edgeWearPct >= 70) bladeWearStatus = 'ELEVATED';
  else if (edgeWearPct >= 45) bladeWearStatus = 'MODERATE';
  else bladeWearStatus = 'OPTIMAL';

  // Projected remaining blade life in running hours (based on standard 300h interval)
  const bladeHoursRemaining = Math.max(
    2,
    Math.round(((100 - edgeWearPct) / 100) * baseline.nominalKnifeLifeHours)
  );
  const bladeServiceDays = parseFloat((bladeHoursRemaining / 14.5).toFixed(1));
  const projectedBladeDate = addDays(bladeServiceDays);

  // 2. Motor Health & Failure Risk Engine
  // Motor thermal stress and breakdown probability driven by I²t thermal accumulation and spikes
  let thermalStressIndex = 20;
  if (avgTempC >= baseline.criticalWindingTempC || avgCurrentA > baseline.fullLoadAmps) {
    thermalStressIndex = Math.min(98, Math.round(65 + (avgTempC - 75) * 2.5 + criticalSpikes * 3));
  } else if (avgTempC >= baseline.warningWindingTempC || warningSpikes > 3) {
    thermalStressIndex = Math.min(75, Math.round(40 + (avgTempC - 60) * 1.8 + warningSpikes * 2));
  } else {
    thermalStressIndex = Math.max(15, Math.round(15 + (avgTempC - 50) * 1.2));
  }

  let motorFailureProb = 8;
  if (thermalStressIndex >= 80 || criticalSpikes >= 4 || peakSpikeCurrentA >= 185) {
    motorFailureProb = Math.min(95, Math.round(65 + criticalSpikes * 5 + (avgTempC - 80) * 2));
  } else if (thermalStressIndex >= 55 || warningSpikes >= 3) {
    motorFailureProb = Math.min(60, Math.round(30 + warningSpikes * 4));
  } else {
    motorFailureProb = Math.min(22, Math.round(8 + (avgCurrentA - 100) * 0.5));
  }

  const motorHoursRemaining = Math.max(
    4,
    Math.round(450 * (1 - motorFailureProb / 100))
  );

  let motorStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  if (motorFailureProb >= 70 || avgTempC >= 85 || criticalSpikes >= 4) {
    motorStatus = 'CRITICAL';
  } else if (motorFailureProb >= 35 || avgTempC >= 75 || warningSpikes >= 3) {
    motorStatus = 'WARNING';
  } else {
    motorStatus = 'HEALTHY';
  }

  // 3. Overall Degradation & Health Score (0 - 100%)
  const combinedRisk = (edgeWearPct * 0.55 + motorFailureProb * 0.45);
  const healthScore = Math.max(5, Math.min(98, Math.round(100 - combinedRisk)));
  const degradationPct = 100 - healthScore;

  // 4. Alert Level Classification
  let alertLevel: ShredderAlertLevel = 'HEALTHY';
  if (bladeWearStatus === 'CRITICAL' || motorStatus === 'CRITICAL' || criticalSpikes >= 3 || peakSpikeCurrentA >= 175) {
    alertLevel = 'CRITICAL_FAILURE_IMMINENT';
  } else if (bladeWearStatus === 'ELEVATED' || motorStatus === 'WARNING' || warningSpikes >= 3 || avgCurrentA >= 135) {
    alertLevel = 'PROACTIVE_SERVICE_REQUIRED';
  } else if (edgeWearPct >= 50 || warningSpikes >= 1) {
    alertLevel = 'SCHEDULED_ATTENTION';
  } else {
    alertLevel = 'HEALTHY';
  }

  // 5. Root Cause & Recommendations
  let primaryFailureModeAr = 'عمليات التشغيل متوازنة ولا توجد قفزات تيار خطرة';
  let primaryFailureModeEn = 'Normal running operations; cutting current within baseline';
  let recommendedActionAr = 'استمرار عمليات الثرم والجرش ومتابعة النمط التشغيلي الروتيني.';
  let recommendedActionEn = 'Continue standard shredding operations and routine parameter logging.';
  let recommendedPartsAr = 'لا يلزم قطع غيار حالياً';
  let recommendedPartsEn = 'No replacement parts required';

  if (alertLevel === 'CRITICAL_FAILURE_IMMINENT') {
    primaryFailureModeAr = `قفزات تيار حرجة متكررة (${peakSpikeCurrentA}A) ناتجة عن انحشار السكراب وتآكل حاد في سكاكين الدوار D2 (${edgeWearPct}%) وارتفاع حرارة الملفات (${avgTempC}°C)`;
    primaryFailureModeEn = `Critical load current surges (${peakSpikeCurrentA}A) due to severe D2 blade dullness (${edgeWearPct}%), gap expansion (${clearanceGapMm}mm), and motor winding overheat (${avgTempC}°C)`;
    recommendedActionAr = 'إيقاف فوري لتغذية المواد، فك وعكس شفرات الدوار D2 الأربعة، إعادة ضبط خلوص السكاكين عند 0.25 ملم، وتبريد المحرك وفحص قاطع الحمل الزائد.';
    recommendedActionEn = 'Emergency pause feed, reverse/sharpen 4x D2 rotor knives, recalibrate knife gap to 0.25mm, and inspect motor thermal overload relay.';
    recommendedPartsAr = 'طقم شفرات دوارة فولاذ D2 عدد 4، شفرات ثابتة D2 عدد 2، شحم محامل SKF عالي الحرارة';
    recommendedPartsEn = 'D2 Tool Steel Knives (4x), Stator Bed Knives (2x), SKF High-Temp Grease LGHP 2';
  } else if (alertLevel === 'PROACTIVE_SERVICE_REQUIRED') {
    primaryFailureModeAr = `ارتفاع تردد قفزات التيار (${spikeFrequencyPerHour} قفزة/س) وتآكل شفرات الدوار (${edgeWearPct}%) مع زيادة خلوص القطع (${clearanceGapMm} ملم)`;
    primaryFailureModeEn = `Elevated current spike frequency (${spikeFrequencyPerHour}/h) and blade wear (${edgeWearPct}%) with gap dilation (${clearanceGapMm}mm)`;
    recommendedActionAr = 'جدولة فك وشحذ سكاكين التقطيع خلال الوردية القادمة، فحص سير نقل الحركة، وتشحيم كراسي المحاور.';
    recommendedActionEn = 'Schedule knife sharpening and gap adjustment during next maintenance shift; check drive belt tension and lubricate bearings.';
    recommendedPartsAr = 'طقم مسامير تثبيت السكاكين 12.9، شحم ليثيوم للمحامل';
    recommendedPartsEn = 'Grade 12.9 Blade Fastener Bolts, SKF Bearing Lithium Grease';
  } else if (alertLevel === 'SCHEDULED_ATTENTION') {
    primaryFailureModeAr = `بداية تآكل خفيف في حواف القطع (${edgeWearPct}%) وزيادة طفيفة في سحب الأمبير (${avgCurrentA}A)`;
    primaryFailureModeEn = `Early cutting edge wear (${edgeWearPct}%) with slight baseline amperage elevation (${avgCurrentA}A)`;
    recommendedActionAr = 'فحص بصري لحواف السكاكين بعد نهاية الوردية، ومراقبة خلوص الشفرات.';
    recommendedActionEn = 'Perform end-of-shift visual knife inspection and monitor bed-knife gap.';
    recommendedPartsAr = 'طقم فحص الخلوص (فيلر جيز 0.25 مم)';
    recommendedPartsEn = 'Feeler Gauge Set (0.25mm)';
  }

  const avoidedDowntimeHours = alertLevel === 'CRITICAL_FAILURE_IMMINENT' ? 14 : alertLevel === 'PROACTIVE_SERVICE_REQUIRED' ? 8 : 4;
  const estimatedCostSavingsUSD = avoidedDowntimeHours * 275;

  // Build compliant MaintenanceAlertNotification if alert is active
  let activeNotification: MaintenanceAlertNotification | null = null;
  if (alertLevel !== 'HEALTHY') {
    const notifId = 'NOTIF-MCH-SHR-01-SENSOR-SPIKES';
    const severity: MaintenanceAlertSeverity =
      alertLevel === 'CRITICAL_FAILURE_IMMINENT'
        ? 'CRITICAL'
        : alertLevel === 'PROACTIVE_SERVICE_REQUIRED'
        ? 'WARNING'
        : 'ATTENTION';

    const stage: MaintenanceIntervalStage =
      alertLevel === 'CRITICAL_FAILURE_IMMINENT' ? 'OVERDUE' : 'IMMINENT';

    activeNotification = {
      id: notifId,
      machineId: baseline.machineId,
      machineCode: baseline.machineCode,
      machineNameAr: 'مفرمة ومجرشة البلاستيك الثقيلة 360 (75kW)',
      machineNameEn: 'Plastics Shredder & Granulator 360 (75kW)',
      category: 'SHREDDING',
      sectionAr: 'قسم الثرم ومعالجة السكراب',
      sectionEn: 'Scrap Shredding & Regrind Unit',
      severity,
      stage,
      titleAr:
        severity === 'CRITICAL'
          ? `إنذار حرج: قفزات تيار وتآكل شفرات مفرمة الثرم 360 (${peakSpikeCurrentA}A)`
          : `تنبيه مستشعرات: تآكل شفرات مفرمة الثرم 360 بنسبة ${edgeWearPct}%`,
      titleEn:
        severity === 'CRITICAL'
          ? `Critical: Shredder 360 Current Spikes & Blade Wear (${peakSpikeCurrentA}A)`
          : `Sensor Alert: Shredder 360 Blade Wear (${edgeWearPct}%) & Current Surges`,
      messageAr:
        severity === 'CRITICAL'
          ? `رصدت المستشعرات قفزات تيار متكررة تجاوزت ${peakSpikeCurrentA}A (الحد الآمن ${baseline.criticalSpikeThresholdA}A) مع تآكل سكاكين الدوار بنسبة ${edgeWearPct}% وحرارة محرك ${avgTempC}°C. خطر كسر الشفرات أو احتراق ملفات المحرك.`
          : `رصدت مستشعرات تيار المحرك ارتفاعاً في متوسط الحمل (${avgCurrentA}A) وتكرار قفزات العزم (${totalSpikes10m} قفزات). استهلاك حد السكاكين بلغ ${edgeWearPct}% ومتبقي ${bladeHoursRemaining} ساعة تشغيل.`,
      messageEn:
        severity === 'CRITICAL'
          ? `Sensors detected critical load current surges reaching ${peakSpikeCurrentA}A (safe limit ${baseline.criticalSpikeThresholdA}A) with D2 knife wear at ${edgeWearPct}% and motor temp at ${avgTempC}°C. Risk of blade fracture or stator failure.`
          : `Motor current sensors flagged rising baseline load (${avgCurrentA}A) with repetitive torque spikes (${totalSpikes10m} spikes). Blade wear is at ${edgeWearPct}% with ${bladeHoursRemaining}h remaining life.`,
      triggeredAt: new Date().toISOString(),
      currentOperatingHours: 294,
      maintenanceThresholdHours: 300,
      intervalHours: 300,
      hoursOverdueOrRemaining: severity === 'CRITICAL' ? 6 : -bladeHoursRemaining,
      intervalProgressPct: edgeWearPct,
      recommendedActionAr,
      recommendedActionEn,
      recommendedPartsAr,
      recommendedPartsEn,
      acknowledged: false,
    };
  }

  // Sync active notification to localStorage for MaintenanceAlerts feed
  syncActiveSensorAlertToStorage(activeNotification);

  return {
    machineId: baseline.machineId,
    machineCode: baseline.machineCode,
    machineNameAr: 'مفرمة ومجرشة البلاستيك الثقيلة 360 (75kW)',
    machineNameEn: 'Plastics Shredder & Granulator 360 (75kW)',
    overallHealthScore: healthScore,
    degradationPct,
    alertLevel,
    primaryFailureModeAr,
    primaryFailureModeEn,
    recommendedActionAr,
    recommendedActionEn,
    recommendedPartsAr,
    recommendedPartsEn,
    avoidedDowntimeHours,
    estimatedCostSavingsUSD,
    confidenceScore: 94,
    bladeWear: {
      edgeWearPct,
      cuttingBevelDullnessPct,
      clearanceGapMm,
      bladeSharpnessIndex,
      estimatedHoursRemaining: bladeHoursRemaining,
      projectedServiceDate: projectedBladeDate,
      wearStatus: bladeWearStatus,
      riskAssessmentAr:
        bladeWearStatus === 'CRITICAL'
          ? 'تآكل سكاكين شديد؛ تكسر حواف القطع وتراجع نقاوة الحبيبات المجروشة'
          : bladeWearStatus === 'ELEVATED'
          ? 'استهلاك متقدم لحد السكاكين مع زيادة طفيفة في استهلاك الطاقة'
          : 'حواف السكاكين حادة وتقطع بكفاءة عالية وبدون مقاومة تذكر',
      riskAssessmentEn:
        bladeWearStatus === 'CRITICAL'
          ? 'Severe blade wear; risk of chipped knife edge and irregular regrind flake size'
          : bladeWearStatus === 'ELEVATED'
          ? 'Advanced cutting edge dullness causing increased motor current draw'
          : 'Sharp knife edges delivering clean shear and optimal energy consumption',
    },
    motorHealth: {
      ratedFullLoadAmps: baseline.fullLoadAmps,
      averageCurrentA: avgCurrentA,
      peakSpikeCurrentA,
      spikeCountLast10Min: totalSpikes10m,
      spikeFrequencyPerHour,
      windingTempC: avgTempC,
      vibrationMmS: maxVib,
      thermalStressIndex,
      motorFailureProbability: motorFailureProb,
      estimatedHoursRemaining: motorHoursRemaining,
      motorStatus,
      riskAssessmentAr:
        motorStatus === 'CRITICAL'
          ? 'إجهاد حراري عالي لملفات المحرك نتيجة قفزات الحمل العالية والمستمرة'
          : motorStatus === 'WARNING'
          ? 'ارتفاع معتدل في حرارة المحرك والاهتزاز بسبب مقاومة الثرم'
          : 'المحرك يعمل ضمن الحمل الطبيعي ودرجات الحرارة الآمنة',
      riskAssessmentEn:
        motorStatus === 'CRITICAL'
          ? 'High motor thermal accumulation and mechanical stress from heavy current spikes'
          : motorStatus === 'WARNING'
          ? 'Moderate thermal drift and vibration due to elevated shredding torque'
          : 'Motor running within rated full load amps and healthy operating temperature',
    },
    baseline,
    recentReadings: readings,
    activeNotification,
    lastEvaluatedAt: new Date().toISOString(),
    isSimulatedScenario: simScenario || undefined,
  };
}

/**
 * Sync active sensor notification to storage for maintenance alerts feed
 */
function syncActiveSensorAlertToStorage(notification: MaintenanceAlertNotification | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (notification) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ALERT, JSON.stringify(notification));
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_ALERT);
    }
  } catch (e) {
    console.warn('Error syncing sensor alert to storage:', e);
  }
}

/**
 * Retrieve active sensor alert notification for MaintenanceAlerts feed
 */
export function getActiveShredderSensorNotification(): MaintenanceAlertNotification | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_ALERT);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Clear or resolve sensor alert
 */
export function clearShredderSensorAlert(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ALERT);
    setStoredSimulationScenario('NORMAL');
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  } catch (e) {
    console.warn('Error clearing shredder sensor alert:', e);
  }
}

/**
 * Hourly Failure Risk Slot for 24-Hour Predictive Heatmap
 */
export interface HourlyFailureRiskSlot {
  hourIndex: number; // 0 to 23
  hourOffset: number; // +0h to +23h
  hourLabel: string; // e.g. "14:00"
  formattedTime: string; // e.g. "14:00 - 15:00"
  shiftNameAr: string;
  shiftNameEn: string;
  projectedLoadCurrentA: number;
  projectedBladeWearPct: number;
  projectedWindingTempC: number;
  failureRiskPct: number; // 0 to 100%
  riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL';
  primaryRiskFactorAr: string;
  primaryRiskFactorEn: string;
}

/**
 * Generate 24-Hour Failure Risk Heatmap from real-time Shredder sensor telemetry
 */
export function generate24HourFailureRiskHeatmap(
  analysisOverride?: ShredderPredictiveAnalysis
): HourlyFailureRiskSlot[] {
  const analysis = analysisOverride || evaluateShredderSensorPredictive();
  const baseCurrentA = analysis.motorHealth.averageCurrentA || 105;
  const baseBladeWear = analysis.bladeWear.edgeWearPct;
  const baseTempC = analysis.motorHealth.windingTempC;
  const peakSpikes = analysis.motorHealth.peakSpikeCurrentA;
  const currentHour = new Date().getHours();

  const slots: HourlyFailureRiskSlot[] = [];

  for (let i = 0; i < 24; i++) {
    const targetHour = (currentHour + i) % 24;
    const hourLabel = `${String(targetHour).padStart(2, '0')}:00`;
    const nextHour = (targetHour + 1) % 24;
    const formattedTime = `${hourLabel} - ${String(nextHour).padStart(2, '0')}:00`;

    // Determine Shift
    let shiftNameAr = 'وردية ليلية (22:00 - 06:00)';
    let shiftNameEn = 'Night Shift (22:00 - 06:00)';
    let feedMultiplier = 0.85;
    let tempOffset = -2;

    if (targetHour >= 6 && targetHour < 14) {
      shiftNameAr = 'وردية صباحية (06:00 - 14:00)';
      shiftNameEn = 'Morning Shift (06:00 - 14:00)';
      feedMultiplier = 1.25; // Peak truck delivery & intake
      tempOffset = 1.5;
    } else if (targetHour >= 14 && targetHour < 22) {
      shiftNameAr = 'وردية مسائية (14:00 - 22:00)';
      shiftNameEn = 'Afternoon Shift (14:00 - 22:00)';
      feedMultiplier = 1.1;
      tempOffset = 4.0; // Peak afternoon factory ambient temp
    }

    // Cumulative degradation over the 24h timeline
    // As blades cut continuously, wear creeps upwards if not sharpened
    const wearAccumulation = (i * 0.45);
    const projectedBladeWear = Math.min(99, Math.round(baseBladeWear + wearAccumulation));

    // Current draw increases with blade dullness and shift feed multiplier
    const currentDraw = parseFloat(
      (baseCurrentA * feedMultiplier + (projectedBladeWear > 70 ? (projectedBladeWear - 70) * 0.6 : 0) + (Math.sin(i * 0.7) * 4)).toFixed(1)
    );

    // Motor winding thermal accumulation
    const windingTemp = parseFloat(
      (baseTempC + tempOffset + (i > 8 ? 3.5 : 0) + (currentDraw > 135 ? (currentDraw - 135) * 0.35 : 0)).toFixed(1)
    );

    // Failure risk formula driven by load current spikes, blade dullness, and thermal surge
    let riskScore = 0;
    if (analysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT' || peakSpikes >= 175) {
      // In critical state, failure risk rapidly peaks within first 3-8 hours
      riskScore = Math.min(98, Math.round(68 + (i * 1.5) + (feedMultiplier > 1.1 ? 14 : 6)));
    } else if (analysis.alertLevel === 'PROACTIVE_SERVICE_REQUIRED' || baseBladeWear >= 75) {
      // Moderate wear degrades into critical during peak morning/afternoon shifts
      riskScore = Math.min(88, Math.round(38 + (i * 1.8) + (feedMultiplier > 1.1 ? 18 : 8)));
    } else if (analysis.alertLevel === 'SCHEDULED_ATTENTION' || baseBladeWear >= 50) {
      riskScore = Math.min(65, Math.round(22 + (i * 1.2) + (feedMultiplier > 1.1 ? 12 : 4)));
    } else {
      // Healthy condition: stays low, slight rise during peak feed
      riskScore = Math.min(32, Math.round(10 + (feedMultiplier > 1.1 ? 12 : 2) + Math.sin(i * 0.5) * 4));
    }

    let riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL' = 'LOW';
    if (riskScore >= 75) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'ELEVATED';
    else if (riskScore >= 25) riskLevel = 'MODERATE';
    else riskLevel = 'LOW';

    let primaryRiskFactorAr = 'تشغيل طبيعي ضمن الحدود الآمنة';
    let primaryRiskFactorEn = 'Nominal operation within safe limits';

    if (riskLevel === 'CRITICAL') {
      primaryRiskFactorAr = `خطر انحشار الدوار وكسر السكاكين المتآكلة (${projectedBladeWear}%) مع ارتفاع حرارة الملفات إلى ${windingTemp}°C`;
      primaryRiskFactorEn = `Rotor seizure & knife fracture risk (${projectedBladeWear}% wear) with motor heating up to ${windingTemp}°C`;
    } else if (riskLevel === 'ELEVATED') {
      primaryRiskFactorAr = `إجهاد حراري مرتفع للمحرك (${currentDraw}A) ناتج عن ذروة التغذية ومقاومة الشفرات`;
      primaryRiskFactorEn = `High motor thermal stress (${currentDraw}A) during peak feed and knife resistance`;
    } else if (riskLevel === 'MODERATE') {
      primaryRiskFactorAr = `احتكاك طفيف وزيادة سحب التيار في وردية العمل (${currentDraw}A)`;
      primaryRiskFactorEn = `Mild cutting friction and current elevation (${currentDraw}A)`;
    }

    slots.push({
      hourIndex: targetHour,
      hourOffset: i,
      hourLabel,
      formattedTime,
      shiftNameAr,
      shiftNameEn,
      projectedLoadCurrentA: currentDraw,
      projectedBladeWearPct: projectedBladeWear,
      projectedWindingTempC: windingTemp,
      failureRiskPct: riskScore,
      riskLevel,
      primaryRiskFactorAr,
      primaryRiskFactorEn,
    });
  }

  return slots;
}

/**
 * Trigger a simulated sensor scenario to verify predictive alerts and UI telemetry
 */
export function triggerSensorSimulationScenario(
  scenario: 'NORMAL' | 'MILD_SPIKES' | 'BLADE_DULLNESS' | 'CRITICAL_SURGE' | 'ROTOR_JAM'
): ShredderPredictiveAnalysis {
  setStoredSimulationScenario(scenario);
  const analysis = evaluateShredderSensorPredictive();

  if (analysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT') {
    playIndustrialAlertChime('CRITICAL');
  } else if (analysis.alertLevel === 'PROACTIVE_SERVICE_REQUIRED') {
    playIndustrialAlertChime('WARNING');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  }

  return analysis;
}
