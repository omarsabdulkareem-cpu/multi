import {
  FactoryMachine,
  EquipmentUsagePattern,
  MaintenanceAlertNotification,
  MaintenanceAlertsSummary,
  MaintenanceAlertSeverity,
  MaintenanceIntervalStage,
  UserProfile,
} from '../types';
import {
  getStoredMachines,
  saveMachines,
  logCompletedMaintenanceTask,
  computeMachineStatus,
} from './maintenanceService';

const STORAGE_KEY_ALERTS = 'alkarwan_maintenance_alerts_store_v1';
const STORAGE_KEY_SOUND = 'alkarwan_maintenance_sound_enabled_v1';
const STORAGE_KEY_SHREDDER_SENSOR_ALERT = 'alkarwan_shredder_sensor_active_alert_v1';

// Custom event names
export const EVENT_MAINTENANCE_ALERT_TRIGGERED = 'alkarwan_maintenance_alert_event';
export const EVENT_MACHINERY_UPDATED = 'alkarwan_machinery_updated';

// Typical daily runtime velocity by category (hours/day)
export const CATEGORY_DAILY_RUNTIME: Record<string, number> = {
  SHREDDING: 14.5,
  EXTRUSION: 18.0,
  THERMOFORMING: 16.0,
  UTILITY: 20.0,
  SCALE: 10.0,
};

// Material throughput rates (kg/operating hour)
export const CATEGORY_THROUGHPUT_RATE_KG: Record<string, number> = {
  SHREDDING: 1250, // 1.25 Tons/hour of scrap plastic
  EXTRUSION: 850,
  THERMOFORMING: 600,
  UTILITY: 0,
  SCALE: 4000,
};

interface StoredAlertMeta {
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  snoozedUntil?: string; // ISO string
}

function getStoredAlertsMeta(): Record<string, StoredAlertMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Error reading maintenance alerts meta:', e);
    return {};
  }
}

function saveAlertsMeta(meta: Record<string, StoredAlertMeta>): void {
  try {
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(meta));
  } catch (e) {
    console.warn('Error saving alerts meta:', e);
  }
}

/**
 * Sound Alert synthesizer using Web Audio API (industrial high-tech chime)
 */
export function isSoundAlertEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_SOUND);
    return val !== 'false'; // default to true
  } catch {
    return true;
  }
}

export function setSoundAlertEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SOUND, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Error saving sound alert preference:', e);
  }
}

export function playIndustrialAlertChime(severity: 'CRITICAL' | 'WARNING' | 'NOTICE' = 'CRITICAL'): void {
  if (!isSoundAlertEnabled()) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (severity === 'CRITICAL') {
      // Urgent double-pulse industrial alert
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      const now = ctx.currentTime;
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      osc1.frequency.setValueAtTime(880, now + 0.2);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.35);

      osc2.frequency.setValueAtTime(1320, now);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } else {
      // Soft single chime for warning/notice
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25); // A5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    }
  } catch (err) {
    // Ignore audio context autoplay policy restrictions gracefully
  }
}

/**
 * Calculate detailed equipment usage pattern for a factory machine
 */
export function calculateEquipmentUsagePattern(machine: FactoryMachine): EquipmentUsagePattern {
  const dailyRate = CATEGORY_DAILY_RUNTIME[machine.category] || 15;
  const current = machine.currentOperatingHours;
  const threshold = machine.maintenanceThresholdHours;
  const interval = machine.intervalHours || 500;
  const lastHours = machine.lastMaintenanceHours > 0 ? machine.lastMaintenanceHours : Math.max(0, threshold - interval);

  const hoursSinceLastMaintenance = Math.max(0, current - lastHours);
  const intervalProgressPct = Math.min(250, Math.round((hoursSinceLastMaintenance / interval) * 100));
  const hoursRemaining = threshold - current;

  const isOverdue = current >= threshold;
  const isImpending = !isOverdue && (hoursRemaining <= 25 || intervalProgressPct >= 92);
  const isApproaching = !isOverdue && !isImpending && (hoursRemaining <= 60 || intervalProgressPct >= 80);

  let stage: MaintenanceIntervalStage = 'OPTIMAL';
  let severity: MaintenanceAlertSeverity = 'NORMAL';

  if (isOverdue) {
    stage = 'OVERDUE';
    severity = 'CRITICAL';
  } else if (isImpending) {
    stage = 'IMMINENT';
    severity = 'WARNING';
  } else if (isApproaching) {
    stage = 'APPROACHING';
    severity = 'ATTENTION';
  }

  // Projected days to service
  const projectedDaysToService = isOverdue
    ? 0
    : parseFloat(Math.max(0, hoursRemaining / dailyRate).toFixed(1));

  // Projected target date
  const now = new Date();
  const projectedDate = new Date(now.getTime() + projectedDaysToService * 24 * 60 * 60 * 1000);
  const projectedServiceDate = projectedDate.toISOString().split('T')[0];

  // Specific wear indicator tailored to machine category (especially Shredder 360)
  const wearMultiplier = isOverdue ? 1.25 : Math.max(0.2, intervalProgressPct / 100);
  let specificWearMetric: EquipmentUsagePattern['specificWearMetric'];
  let dutyCyclePattern: EquipmentUsagePattern['dutyCyclePattern'] = 'CYCLIC_BATCH';
  let dutyCycleLabelAr = 'تشغيل دفعي ومتقطع';
  let dutyCycleLabelEn = 'Cyclic Batch Operation';

  switch (machine.category) {
    case 'SHREDDING':
      dutyCyclePattern = 'HEAVY_CONTINUOUS';
      dutyCycleLabelAr = 'حمل ثقيل مستمر (ثرم وجرش 14.5 س/يوم)';
      dutyCycleLabelEn = 'Continuous Heavy Shredding (14.5 h/day)';
      specificWearMetric = {
        labelAr: 'تآكل شفرات وسكاكين الدوار D2',
        labelEn: 'Rotary D2 Steel Knife Wear',
        value: Math.min(100, Math.round(35 + wearMultiplier * 55)),
        unit: '%',
        threshold: 85,
        status: isOverdue || wearMultiplier > 0.95 ? 'CRITICAL' : wearMultiplier > 0.8 ? 'ELEVATED' : 'NORMAL',
      };
      break;

    case 'EXTRUSION':
      dutyCyclePattern = 'HEAVY_CONTINUOUS';
      dutyCycleLabelAr = 'تشغيل مدار الساعة (بثق 18 س/يوم)';
      dutyCycleLabelEn = '24/7 Continuous Extrusion Line';
      specificWearMetric = {
        labelAr: 'فرق ضغط زيت الهيدروليك وفلتر البرميل',
        labelEn: 'Hydraulic Delta Pressure & Barrel Filter',
        value: Math.min(100, Math.round(20 + wearMultiplier * 68)),
        unit: 'bar',
        threshold: 75,
        status: isOverdue || wearMultiplier > 0.9 ? 'CRITICAL' : wearMultiplier > 0.75 ? 'ELEVATED' : 'NORMAL',
      };
      break;

    case 'THERMOFORMING':
      dutyCyclePattern = 'CYCLIC_BATCH';
      dutyCycleLabelAr = 'دورات تشكيل سريع للأكواب (34 دورة/د)';
      dutyCycleLabelEn = 'High-Speed Thermoforming (34 cyc/min)';
      specificWearMetric = {
        labelAr: 'إجهاد حشوات الفاكيوم وصمامات الهواء',
        labelEn: 'Vacuum Chamber Seal & Pneumatic Valve Fatigue',
        value: Math.min(100, Math.round(25 + wearMultiplier * 60)),
        unit: '%',
        threshold: 80,
        status: isOverdue || wearMultiplier > 0.9 ? 'CRITICAL' : wearMultiplier > 0.75 ? 'ELEVATED' : 'NORMAL',
      };
      break;

    case 'UTILITY':
      dutyCyclePattern = 'HEAVY_CONTINUOUS';
      dutyCycleLabelAr = 'تغذية مرافق مركزية مستمرة (20 س/يوم)';
      dutyCycleLabelEn = 'Continuous Plant Utility Supply';
      specificWearMetric = {
        labelAr: 'فرق ضغط فاصل الزيت والحرارة',
        labelEn: 'Air/Oil Separator Differential & Temp',
        value: parseFloat((0.2 + wearMultiplier * 0.9).toFixed(2)),
        unit: 'bar',
        threshold: 0.8,
        status: isOverdue || wearMultiplier > 0.9 ? 'CRITICAL' : wearMultiplier > 0.75 ? 'ELEVATED' : 'NORMAL',
      };
      break;

    case 'SCALE':
    default:
      dutyCyclePattern = 'VARIABLE_PEAK';
      dutyCycleLabelAr = 'حسب حركة قوافل الشاحنات (10 س/يوم)';
      dutyCycleLabelEn = 'Peak Traffic Weighing Cycles';
      specificWearMetric = {
        labelAr: 'انزياح خلايا الوزن الرقمية ومعايرة القبان',
        labelEn: 'Digital Load Cell Bridge Drift',
        value: parseFloat((0.005 + wearMultiplier * 0.038).toFixed(3)),
        unit: '% err',
        threshold: 0.03,
        status: isOverdue || wearMultiplier > 0.9 ? 'CRITICAL' : wearMultiplier > 0.75 ? 'ELEVATED' : 'NORMAL',
      };
      break;
  }

  // Estimated total throughput since last maintenance
  const hourlyRateKG = CATEGORY_THROUGHPUT_RATE_KG[machine.category] || 0;
  const estimatedThroughputKG = hoursSinceLastMaintenance * hourlyRateKG;

  // General sensor telemetry
  const vibrationVelocityMmS = parseFloat(
    (machine.category === 'SHREDDING' ? 2.5 + wearMultiplier * 4.2 : 1.2 + wearMultiplier * 2.8).toFixed(1)
  );
  const operatingTempC = Math.round(
    machine.category === 'SHREDDING' ? 52 + wearMultiplier * 32 : 65 + wearMultiplier * 25
  );

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
    lastMaintenanceDate: machine.lastMaintenanceDate,
    lastMaintenanceHours: machine.lastMaintenanceHours,
    assignedTechnician: machine.assignedTechnician,
    criticality: machine.criticality,
    status: machine.status,

    hoursSinceLastMaintenance,
    intervalProgressPct,
    hoursRemaining,
    isOverdue,
    isImpending,
    isApproaching,
    stage,
    severity,

    dailyRuntimeHours: dailyRate,
    projectedDaysToService,
    projectedServiceDate,
    dutyCyclePattern,
    dutyCycleLabelAr,
    dutyCycleLabelEn,
    estimatedThroughputKG,
    wearIndexPct: Math.min(100, Math.round(wearMultiplier * 85)),
    vibrationVelocityMmS,
    operatingTempC,
    specificWearMetric,
  };
}

/**
 * Generate alert notification from an equipment usage pattern
 */
export function generateNotificationForPattern(
  pattern: EquipmentUsagePattern,
  storedMeta: Record<string, StoredAlertMeta>
): MaintenanceAlertNotification | null {
  // Only create alert if approaching, impending, or overdue
  if (pattern.stage === 'OPTIMAL') return null;

  const notifId = `NOTIF-${pattern.machineCode}-${pattern.maintenanceThresholdHours}`;
  const meta = storedMeta[notifId] || { acknowledged: false };

  // Check if currently snoozed
  if (meta.snoozedUntil) {
    const snoozeTime = new Date(meta.snoozedUntil).getTime();
    if (snoozeTime > Date.now()) {
      // Currently snoozed
      // If overdue becomes extreme (>20h overdue), override snooze
      if (!pattern.isOverdue || pattern.currentOperatingHours - pattern.maintenanceThresholdHours < 20) {
        return null;
      }
    }
  }

  let titleAr = '';
  let titleEn = '';
  let messageAr = '';
  let messageEn = '';
  let recommendedActionAr = '';
  let recommendedActionEn = '';
  let recommendedPartsAr = '';
  let recommendedPartsEn = '';

  const hoursDiff = pattern.isOverdue
    ? pattern.currentOperatingHours - pattern.maintenanceThresholdHours
    : pattern.maintenanceThresholdHours - pattern.currentOperatingHours;

  if (pattern.category === 'SHREDDING') {
    if (pattern.isOverdue) {
      titleAr = `تجاوز حد الصيانة لمفرمة الثرم 360 (${hoursDiff} س تجاوز)`;
      titleEn = `Shredder 360 Service Interval Exceeded (${hoursDiff}h Overdue)`;
      messageAr = `وصلت المفرمة والمجرشة 360 إلى ${pattern.currentOperatingHours} ساعة متجاوزة حد الصيانة المقدر بـ ${pattern.maintenanceThresholdHours} ساعة (دورة كل 300 ساعة). خطر تكسر الشفرات وانسداد حجرة الثرم.`;
      messageEn = `Granulator & Shredder 360 reached ${pattern.currentOperatingHours}h exceeding the ${pattern.maintenanceThresholdHours}h interval (every 300h). Risk of knife chipping, rotor seizure, and regrind inconsistency.`;
      recommendedActionAr = 'شحذ وعكس سكاكين الدوار D2 فوراً، حقن شحم ليثيوم SKF للمحامل، وضبط الخلوص عند 0.25 ملم.';
      recommendedActionEn = 'Sharpen/reverse D2 rotor knives immediately, apply SKF lithium grease to main bearings, and calibrate blade gap to 0.25mm.';
      recommendedPartsAr = 'شفرات سكاكين دوارة فولاذ D2 عدد 4، شحم SKF LGHP 2، طقم سيور سحب';
      recommendedPartsEn = 'D2 Tool Steel Knives (4x), SKF Heavy Grease LGHP 2, V-Belt Set';
    } else if (pattern.isImpending) {
      titleAr = `اقتراب موعد صيانة مفرمة الثرم 360 (متبقي ${hoursDiff} س)`;
      titleEn = `Shredder 360 Approaching Service Interval (${hoursDiff}h Remaining)`;
      messageAr = `استهلكت مفرمة الثرم ${pattern.intervalProgressPct}% من دورة الصيانة المحددة بـ 300 ساعة. متبقي ${hoursDiff} ساعة تشغيل قبل بلوغ الحد الأقصى.`;
      messageEn = `Shredder 360 has reached ${pattern.intervalProgressPct}% of its 300h service interval. ${hoursDiff} operating hours remaining before threshold breach.`;
      recommendedActionAr = 'تجهيز طقم الشفرات البديلة وجدولة إيقاف الماكينة خلال وردية الصيانة القادمة.';
      recommendedActionEn = 'Prepare spare sharpened knife set and schedule preventive downtime during next planned maintenance window.';
      recommendedPartsAr = 'شفرات سكاكين D2، عبوة شحم المحامل';
      recommendedPartsEn = 'Spare D2 Knives, Bearing Grease';
    } else {
      titleAr = `إشعار استهلاك دورة مفرمة الثرم (${pattern.intervalProgressPct}%)`;
      titleEn = `Shredder Usage Cycle Progress (${pattern.intervalProgressPct}%)`;
      messageAr = `مفرمة الثرم 360 تعمل بنمط حمل ثقيل (إنتاج ${Math.round(pattern.estimatedThroughputKG / 1000)} طن مجروش). الاستهلاك بلغ ${pattern.intervalProgressPct}%.`;
      messageEn = `Shredder 360 running in continuous heavy cycle (${Math.round(pattern.estimatedThroughputKG / 1000)} tons processed). Usage is at ${pattern.intervalProgressPct}%.`;
      recommendedActionAr = 'فحص بصري لحافة الشفرات ودرجة حرارة المحامل.';
      recommendedActionEn = 'Visual knife inspection and routine bearing temperature check.';
    }
  } else {
    // General equipment messages
    if (pattern.isOverdue) {
      titleAr = `تنبيه حرج: الماكينة ${pattern.machineCode} تجاوزت حد الصيانة (${hoursDiff} س)`;
      titleEn = `Critical: Machine ${pattern.machineCode} Exceeded Maintenance Interval (${hoursDiff}h)`;
      messageAr = `بلغت الماكينة [${pattern.nameAr}] ساعات تشغيل ${pattern.currentOperatingHours} ساعة متجاوزة الحد الدوري ${pattern.maintenanceThresholdHours} ساعة. يرجى المباشرة بأعمال الخدمة الوقائية.`;
      messageEn = `Equipment [${pattern.nameEn}] has reached ${pattern.currentOperatingHours}h exceeding its scheduled ${pattern.maintenanceThresholdHours}h maintenance limit. Preventive service required.`;
      recommendedActionAr = 'تنفيذ الصيانة الدورية وتغيير الزيوت/الفلاتر وإعادة ضبط حد الساعات.';
      recommendedActionEn = 'Perform scheduled maintenance, replace wear components/filters, and advance service threshold.';
    } else if (pattern.isImpending) {
      titleAr = `اقتراب صيانة ${pattern.machineCode} (متبقي ${hoursDiff} س)`;
      titleEn = `Service Due Soon for ${pattern.machineCode} (${hoursDiff}h Remaining)`;
      messageAr = `استهلاك الدورة بلغ ${pattern.intervalProgressPct}%. يوصى بجدولة الصيانة لتفادي إيقاف خطوط الإنتاج بصورة مفاجئة.`;
      messageEn = `Cycle usage reached ${pattern.intervalProgressPct}%. Schedule preventive intervention to avoid unscheduled line shutdown.`;
      recommendedActionAr = 'التنسيق مع الفني المسؤول واعتماد خطة التوقف الوقائي.';
      recommendedActionEn = 'Coordinate with assigned technician and prepare work order.';
    } else {
      titleAr = `متابعة دورية: ${pattern.machineCode} عند ${pattern.intervalProgressPct}% من الحد`;
      titleEn = `Routine Monitoring: ${pattern.machineCode} at ${pattern.intervalProgressPct}% of Interval`;
      messageAr = `الماكينة تعمل ضمن النطاق الطبيعي ومتبقي ${hoursDiff} ساعة حتى دورة الصيانة القادمة.`;
      messageEn = `Equipment operating within expected parameters. ${hoursDiff}h remaining until next planned interval.`;
      recommendedActionAr = 'متابعة مؤشرات التآكل والحرارة.';
      recommendedActionEn = 'Monitor operating temperature and vibration telemetry.';
    }
  }

  return {
    id: notifId,
    machineId: pattern.machineId,
    machineCode: pattern.machineCode,
    machineNameAr: pattern.nameAr,
    machineNameEn: pattern.nameEn,
    category: pattern.category,
    sectionAr: pattern.sectionAr,
    sectionEn: pattern.sectionEn,
    severity: pattern.severity,
    stage: pattern.stage,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    triggeredAt: new Date().toISOString(),
    currentOperatingHours: pattern.currentOperatingHours,
    maintenanceThresholdHours: pattern.maintenanceThresholdHours,
    intervalHours: pattern.intervalHours,
    hoursOverdueOrRemaining: pattern.isOverdue ? hoursDiff : -hoursDiff,
    intervalProgressPct: pattern.intervalProgressPct,
    recommendedActionAr,
    recommendedActionEn,
    recommendedPartsAr,
    recommendedPartsEn,
    acknowledged: !!meta.acknowledged,
    acknowledgedBy: meta.acknowledgedBy,
    acknowledgedAt: meta.acknowledgedAt,
    snoozedUntil: meta.snoozedUntil,
  };
}

/**
 * Retrieve active sensor alert notification for Shredder 360 if triggered
 */
export function getStoredShredderSensorNotification(
  storedMeta: Record<string, StoredAlertMeta>
): MaintenanceAlertNotification | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHREDDER_SENSOR_ALERT);
    if (!raw) return null;
    const notif: MaintenanceAlertNotification = JSON.parse(raw);
    if (!notif || !notif.id) return null;

    const meta = storedMeta[notif.id];
    if (meta) {
      notif.acknowledged = !!meta.acknowledged;
      notif.acknowledgedBy = meta.acknowledgedBy;
      notif.acknowledgedAt = meta.acknowledgedAt;
      notif.snoozedUntil = meta.snoozedUntil;

      // Check if snoozed
      if (meta.snoozedUntil) {
        const snoozeTime = new Date(meta.snoozedUntil).getTime();
        if (snoozeTime > Date.now()) {
          // If not critical, respect snooze
          if (notif.severity !== 'CRITICAL') {
            return null;
          }
        }
      }
    }
    return notif;
  } catch (e) {
    console.warn('Error reading stored shredder sensor alert:', e);
    return null;
  }
}

/**
 * Get comprehensive maintenance alerts and equipment usage patterns summary
 */
export function getMaintenanceAlertsSummary(
  machinesOverride?: FactoryMachine[]
): MaintenanceAlertsSummary {
  const machines = machinesOverride && machinesOverride.length > 0 ? machinesOverride : getStoredMachines();
  const storedMeta = getStoredAlertsMeta();

  const usagePatterns = machines.map(calculateEquipmentUsagePattern);

  // Sort: Overdue first (highest overdue ratio), then impending, then approaching
  usagePatterns.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.intervalProgressPct - a.intervalProgressPct;
  });

  const notifications: MaintenanceAlertNotification[] = [];
  for (const pattern of usagePatterns) {
    const notif = generateNotificationForPattern(pattern, storedMeta);
    if (notif) {
      notifications.push(notif);
    }
  }

  // Seamlessly incorporate active predictive sensor alerts from Shredder Blade Wear & Motor Spikes
  const sensorNotif = getStoredShredderSensorNotification(storedMeta);
  if (sensorNotif) {
    // Prevent duplicate if already present
    const exists = notifications.some((n) => n.id === sensorNotif.id);
    if (!exists) {
      notifications.unshift(sensorNotif);
    }
  }

  const overdueCount = usagePatterns.filter((p) => p.isOverdue).length + (sensorNotif?.stage === 'OVERDUE' ? 1 : 0);
  const imminentCount = usagePatterns.filter((p) => p.isImpending).length + (sensorNotif?.stage === 'IMMINENT' ? 1 : 0);
  const approachingCount = usagePatterns.filter((p) => p.isApproaching).length;
  const optimalCount = usagePatterns.filter((p) => p.stage === 'OPTIMAL').length;
  const unacknowledgedCount = notifications.filter((n) => !n.acknowledged).length;

  return {
    totalMonitored: machines.length,
    overdueCount,
    imminentCount,
    approachingCount,
    optimalCount,
    activeNotificationsCount: notifications.length,
    unacknowledgedCount,
    notifications,
    usagePatterns,
    lastEvaluatedAt: new Date().toISOString(),
  };
}

/**
 * Acknowledge an alert notification
 */
export function acknowledgeMaintenanceAlert(
  notificationId: string,
  user: UserProfile
): { success: boolean; summary: MaintenanceAlertsSummary } {
  const meta = getStoredAlertsMeta();
  meta[notificationId] = {
    ...meta[notificationId],
    acknowledged: true,
    acknowledgedBy: `${user.nameAr} (${user.role})`,
    acknowledgedAt: new Date().toISOString(),
  };
  saveAlertsMeta(meta);

  // Dispatch custom window event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  }

  return {
    success: true,
    summary: getMaintenanceAlertsSummary(),
  };
}

/**
 * Snooze an alert notification for a specific number of hours
 */
export function snoozeMaintenanceAlert(
  notificationId: string,
  snoozeHours: number
): { success: boolean; summary: MaintenanceAlertsSummary } {
  const meta = getStoredAlertsMeta();
  const snoozedUntilDate = new Date(Date.now() + snoozeHours * 60 * 60 * 1000);

  meta[notificationId] = {
    ...meta[notificationId],
    snoozedUntil: snoozedUntilDate.toISOString(),
  };
  saveAlertsMeta(meta);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  }

  return {
    success: true,
    summary: getMaintenanceAlertsSummary(),
  };
}

/**
 * Resolve an alert by completing maintenance task, advancing interval, and resetting machine status
 */
export function resolveAlertWithMaintenanceTask(
  params: {
    machineId: string;
    notificationId?: string;
    taskTitleAr: string;
    taskTitleEn: string;
    taskType: 'PREVENTIVE' | 'LUBRICATION' | 'CORRECTIVE' | 'CALIBRATION' | 'OVERHAUL';
    downtimeHours: number;
    performedBy: string;
    supervisorSignOff: string;
    partsReplacedAr?: string;
    partsReplacedEn?: string;
    totalCostUSD?: number;
    notesAr?: string;
    notesEn?: string;
    customNextThreshold?: number;
  }
): { success: boolean; summary: MaintenanceAlertsSummary } {
  // 1. Log the task and advance threshold in maintenance service
  logCompletedMaintenanceTask({
    machineId: params.machineId,
    taskTitleEn: params.taskTitleEn,
    taskTitleAr: params.taskTitleAr,
    taskType: params.taskType,
    downtimeHours: params.downtimeHours,
    performedBy: params.performedBy,
    supervisorSignOff: params.supervisorSignOff,
    partsReplacedEn: params.partsReplacedEn,
    partsReplacedAr: params.partsReplacedAr,
    totalCostUSD: params.totalCostUSD,
    notesEn: params.notesEn,
    notesAr: params.notesAr,
    customNextThresholdHours: params.customNextThreshold,
  });

  // 2. Clear / acknowledge notification meta
  if (params.notificationId) {
    const meta = getStoredAlertsMeta();
    delete meta[params.notificationId];
    saveAlertsMeta(meta);

    if (params.notificationId.includes('SENSOR') || params.notificationId.includes('NOTIF-MCH-SHR-01-SENSOR-SPIKES')) {
      try {
        localStorage.removeItem(STORAGE_KEY_SHREDDER_SENSOR_ALERT);
        localStorage.removeItem('alkarwan_shredder_sensor_sim_mode_v1');
      } catch {}
    }
  }

  // 3. Dispatch events
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_MACHINERY_UPDATED));
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  }

  return {
    success: true,
    summary: getMaintenanceAlertsSummary(),
  };
}

/**
 * Simulate equipment usage run (e.g. running the shredder for +8h, +16h, or +24h)
 * This allows real-time demonstration of how machines approach and breach their service intervals!
 */
export function simulateEquipmentUsageRun(
  machineId: string,
  additionalHours: number,
  additionalThroughputKG?: number
): {
  updatedMachine: FactoryMachine;
  summary: MaintenanceAlertsSummary;
  newlyTriggered: boolean;
} {
  const currentMachines = getStoredMachines();
  let newlyTriggered = false;

  const updatedMachines = currentMachines.map((m) => {
    if (m.id === machineId) {
      const prevHours = m.currentOperatingHours;
      const newHours = Math.max(0, prevHours + additionalHours);
      const prevStatus = m.status;
      const newStatus = computeMachineStatus(newHours, m.maintenanceThresholdHours, m.status);

      if (prevHours < m.maintenanceThresholdHours && newHours >= m.maintenanceThresholdHours) {
        newlyTriggered = true;
      }

      return {
        ...m,
        currentOperatingHours: newHours,
        status: newStatus,
      };
    }
    return m;
  });

  saveMachines(updatedMachines);

  // Play audio chime if newly triggered
  if (newlyTriggered) {
    playIndustrialAlertChime('CRITICAL');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_MACHINERY_UPDATED));
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  }

  const updatedMachine = updatedMachines.find((m) => m.id === machineId)!;
  const summary = getMaintenanceAlertsSummary();

  return {
    updatedMachine,
    summary,
    newlyTriggered,
  };
}

/**
 * Reset machine operating hours (helper for resetting simulation)
 */
export function resetMachineHoursForTesting(
  machineId: string,
  targetHours: number
): { updatedMachine: FactoryMachine; summary: MaintenanceAlertsSummary } {
  const currentMachines = getStoredMachines();
  const updatedMachines = currentMachines.map((m) => {
    if (m.id === machineId) {
      const newStatus = computeMachineStatus(targetHours, m.maintenanceThresholdHours, 'RUNNING');
      return {
        ...m,
        currentOperatingHours: targetHours,
        status: newStatus,
      };
    }
    return m;
  });

  saveMachines(updatedMachines);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_MACHINERY_UPDATED));
    window.dispatchEvent(new CustomEvent(EVENT_MAINTENANCE_ALERT_TRIGGERED));
  }

  const updatedMachine = updatedMachines.find((m) => m.id === machineId)!;
  return {
    updatedMachine,
    summary: getMaintenanceAlertsSummary(),
  };
}
