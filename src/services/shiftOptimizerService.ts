export type ShiftTimeWindow = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'EXTENDED_12H';

export type AmbientTemperatureCondition = 'COOL_NORMAL' | 'MODERATE' | 'EXTREME_HEAT';

export type OperatorPhysicalWorkload = 'HIGH_MANUAL' | 'MEDIUM_BALANCED' | 'LOW_SUPERVISORY';

export type OptimizationGoal = 'MAX_UPTIME' | 'EQUIPMENT_PRESERVATION' | 'FATIGUE_PREVENTION';

export interface BreakScheduleItem {
  id: string;
  breakType: 'MICRO_REST' | 'PRIMARY_MEAL' | 'COOL_DOWN_INSPECTION' | 'SHIFT_CHANGE';
  labelAr: string;
  labelEn: string;
  startHour: number; // e.g. 2.5 = 2h 30m into shift
  startTime: string; // clock time e.g. "08:30"
  durationMinutes: number;
  operatorActionAr: string;
  operatorActionEn: string;
  machineActionAr: string;
  machineActionEn: string;
  urgency: 'MANDATORY' | 'RECOMMENDED';
}

export interface HourlyStressPoint {
  hour: number;
  timeLabel: string;
  machineStressPct: number; // 0 to 100
  operatorFatiguePct: number; // 0 to 100
  compositeRiskPct: number; // 0 to 100
  isBreakWindow: boolean;
  breakLabel?: string;
}

export interface ShiftOptimizationConfig {
  machineId: string;
  shiftType: ShiftTimeWindow;
  ambientCondition: AmbientTemperatureCondition;
  workload: OperatorPhysicalWorkload;
  goal: OptimizationGoal;
  customStartTime?: string;
}

export interface ShiftOptimizationResult {
  machineId: string;
  machineNameAr: string;
  machineNameEn: string;
  shiftType: ShiftTimeWindow;
  shiftStartClock: string;
  shiftEndClock: string;
  currentStandardShiftHours: number;
  suggestedOptimalShiftHours: number;
  shiftDurationRecommendationAr: string;
  shiftDurationRecommendationEn: string;
  projectedUptimeGainPct: number;
  thermalStressReductionPct: number;
  operatorFatigueReductionPct: number;
  defectPreventionPct: number;
  breakSchedule: BreakScheduleItem[];
  hourlyTimeline: HourlyStressPoint[];
  totalBreakMinutes: number;
  netProductiveRunHours: number;
  keyOperationalDirectivesAr: string[];
  keyOperationalDirectivesEn: string[];
}

export const MACHINE_PROFILES: Record<
  string,
  { nameAr: string; nameEn: string; baselineStressMultiplier: number; isThermalSensitive: boolean }
> = {
  'SHR-360': {
    nameAr: 'مكينة الثرم والجرش الرئيسية (SHR-360)',
    nameEn: 'Primary Heavy Shredder (SHR-360)',
    baselineStressMultiplier: 1.35,
    isThermalSensitive: true,
  },
  'EXT-ALL': {
    nameAr: 'كافة خطوط البثق والفيلم (Extruders 1-6)',
    nameEn: 'All Extrusion & Sheet Lines (EXT 1-6)',
    baselineStressMultiplier: 1.15,
    isThermalSensitive: true,
  },
  'EXT-01': {
    nameAr: 'خط بثق الألواح والفيلم 1 (EXT-01)',
    nameEn: 'Extrusion Line 1 (EXT-01)',
    baselineStressMultiplier: 1.1,
    isThermalSensitive: true,
  },
  'EXT-02': {
    nameAr: 'خط بثق الألواح والفيلم 2 (EXT-02)',
    nameEn: 'Extrusion Line 2 (EXT-02)',
    baselineStressMultiplier: 1.2,
    isThermalSensitive: true,
  },
  'PLANT_WIDE': {
    nameAr: 'تشغيل المصنع بالكامل (المعامل ومستودع التحميل)',
    nameEn: 'Plant-Wide Operational Fleet',
    baselineStressMultiplier: 1.0,
    isThermalSensitive: false,
  },
};

const SHIFT_BASE_WINDOWS: Record<
  ShiftTimeWindow,
  { startHour: number; standardHours: number; defaultStart: string; circadianStress: number }
> = {
  MORNING: { startHour: 6, standardHours: 8, defaultStart: '06:00', circadianStress: 1.0 },
  AFTERNOON: { startHour: 14, standardHours: 8, defaultStart: '14:00', circadianStress: 1.25 }, // Heat + dehydration
  NIGHT: { startHour: 22, standardHours: 8, defaultStart: '22:00', circadianStress: 1.45 }, // Circadian vigilance dip
  EXTENDED_12H: { startHour: 6, standardHours: 12, defaultStart: '06:00', circadianStress: 1.6 },
};

function formatClockTime(startHour: number, offsetHours: number): string {
  const totalMinutes = Math.round((startHour + offsetHours) * 60);
  const normalizedMins = (totalMinutes % (24 * 60) + (24 * 60)) % (24 * 60);
  const hh = Math.floor(normalizedMins / 60);
  const mm = normalizedMins % 60;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

export function calculateOptimalShiftSchedule(
  config: ShiftOptimizationConfig
): ShiftOptimizationResult {
  const machine = MACHINE_PROFILES[config.machineId] || MACHINE_PROFILES['SHR-360'];
  const shiftInfo = SHIFT_BASE_WINDOWS[config.shiftType] || SHIFT_BASE_WINDOWS.MORNING;

  // Environmental stress multiplier
  let ambientFactor = 1.0;
  if (config.ambientCondition === 'MODERATE') ambientFactor = 1.2;
  if (config.ambientCondition === 'EXTREME_HEAT') ambientFactor = 1.45;

  // Workload physical strain multiplier
  let workloadFactor = 1.0;
  if (config.workload === 'HIGH_MANUAL') workloadFactor = 1.4;
  if (config.workload === 'MEDIUM_BALANCED') workloadFactor = 1.15;
  if (config.workload === 'LOW_SUPERVISORY') workloadFactor = 0.9;

  // Compute recommended optimal shift duration
  let standardHours = shiftInfo.standardHours;
  let suggestedHours = standardHours;

  // If extreme heat or high manual shredder workload, cap shift at 7.0 - 7.5 hours or introduce rotation
  if (config.shiftType === 'EXTENDED_12H') {
    suggestedHours = 10.5; // 12-hour shifts suffer severe exponential defect spikes after hour 10
  } else if (config.ambientCondition === 'EXTREME_HEAT' && config.workload === 'HIGH_MANUAL') {
    suggestedHours = 7.0;
  } else if (config.shiftType === 'NIGHT' && config.workload === 'HIGH_MANUAL') {
    suggestedHours = 7.5;
  } else if (config.goal === 'EQUIPMENT_PRESERVATION' && machine.isThermalSensitive) {
    suggestedHours = 7.5;
  } else {
    suggestedHours = 8.0;
  }

  // Generate Break Patterns
  const breaks: BreakScheduleItem[] = [];

  if (suggestedHours >= 10) {
    // 10-12 hour pattern: 4 structured breaks
    breaks.push({
      id: 'brk-1',
      breakType: 'MICRO_REST',
      labelAr: 'استراحة وتفتيش مبكر (Micro-Break 1)',
      labelEn: 'Early Hydration & Hopper Check',
      startHour: 2.5,
      startTime: formatClockTime(shiftInfo.startHour, 2.5),
      durationMinutes: 15,
      operatorActionAr: 'شرب السوائل، تمارين الإطالة، ومراجعة التنبيهات',
      operatorActionEn: 'Hydration, stretching, and review of active telemetry',
      machineActionAr: 'تفتيش مستوى الزيت وحرارة كراسي التحميل',
      machineActionEn: 'Bearing temperature check and lubrication verification',
      urgency: 'RECOMMENDED',
    });
    breaks.push({
      id: 'brk-2',
      breakType: 'PRIMARY_MEAL',
      labelAr: 'استراحة الوجبة الرئيسية وتبريد الماكينات',
      labelEn: 'Primary Meal & Thermal Rest',
      startHour: 5.0,
      startTime: formatClockTime(shiftInfo.startHour, 5.0),
      durationMinutes: 35,
      operatorActionAr: 'وجبة طعام واستراحة عضلية كاملة',
      operatorActionEn: 'Meal break and cognitive recovery in cooling room',
      machineActionAr: 'إيقاف التغذية الميكانيكية، تبريد حجرة الجرش وفحص السكاكين',
      machineActionEn: 'Feed stop, chamber thermal cooldown, blade wear visual inspection',
      urgency: 'MANDATORY',
    });
    breaks.push({
      id: 'brk-3',
      breakType: 'COOL_DOWN_INSPECTION',
      labelAr: 'تفتيش الفلاتر وتجديد اليقظة',
      labelEn: 'Filter Mesh & Vigilance Reset',
      startHour: 7.5,
      startTime: formatClockTime(shiftInfo.startHour, 7.5),
      durationMinutes: 20,
      operatorActionAr: 'تنشيط اليقظة وفحص جودة الرولات البلاستيكية',
      operatorActionEn: 'Vigilance walk and quality check of extruded film rolls',
      machineActionAr: 'تنظيف مصفاة الفلتر الهيدروليكي وإزالة التكلسات',
      machineActionEn: 'Hydraulic screen changer purge and hopper clear',
      urgency: 'MANDATORY',
    });
    breaks.push({
      id: 'brk-4',
      breakType: 'MICRO_REST',
      labelAr: 'استراحة قصيرة قبل التسليم',
      labelEn: 'Pre-Handover Micro Reset',
      startHour: 9.5,
      startTime: formatClockTime(shiftInfo.startHour, 9.5),
      durationMinutes: 10,
      operatorActionAr: 'شرب الماء ومطابقة أوزان الإنتاج',
      operatorActionEn: 'Hydration and preliminary production weight tally',
      machineActionAr: 'مراقبة هبوط أمبير الموتور ومستوى الفاكيوم',
      machineActionEn: 'Motor amperage check and vacuum degas vent clear',
      urgency: 'RECOMMENDED',
    });
  } else {
    // 7.0 - 8.0 hour standard pattern: 3 synchronized breaks
    breaks.push({
      id: 'brk-1',
      breakType: 'MICRO_REST',
      labelAr: 'استراحة ترطيب وتفتيش حراري مبكر',
      labelEn: 'Hydration & Thermal Quick Check',
      startHour: 2.5,
      startTime: formatClockTime(shiftInfo.startHour, 2.5),
      durationMinutes: 15,
      operatorActionAr: 'استراحة ترطيب سريعة لمكافحة الإجهاد الحراري',
      operatorActionEn: 'Hydration and ergonomic stretch to reset visual acuity',
      machineActionAr: 'فحص حرارة محامل البثق ومستوى تبريد الماء',
      machineActionEn: 'Chilled water loop check and barrel temperature verification',
      urgency: 'RECOMMENDED',
    });
    breaks.push({
      id: 'brk-2',
      breakType: 'PRIMARY_MEAL',
      labelAr: 'استراحة الوجبة وتبريد حجرة المفرمة/البثق',
      labelEn: 'Main Meal & Chamber Thermal Soak',
      startHour: 4.5,
      startTime: formatClockTime(shiftInfo.startHour, 4.5),
      durationMinutes: 30,
      operatorActionAr: 'تناول وجبة الغذاء/العشاء في غرفة الاستراحة المكيفة',
      operatorActionEn: 'Meal break and mental reset outside noisy production bay',
      machineActionAr: 'إيقاف دوراني خامل لتفريغ الضغط الحراري وتنظيف شبكة الثرم',
      machineActionEn: 'Controlled idle to relieve melt pressure and clear granulator screen',
      urgency: 'MANDATORY',
    });
    breaks.push({
      id: 'brk-3',
      breakType: 'COOL_DOWN_INSPECTION',
      labelAr: 'تفتيش الفلاتر والتحضير للتسليم',
      labelEn: 'Late-Shift Filter Inspection & Handover Prep',
      startHour: 6.5,
      startTime: formatClockTime(shiftInfo.startHour, 6.5),
      durationMinutes: 15,
      operatorActionAr: 'إعداد سجل تسليم الوردية ومراجعة دفاتر الإنتاج',
      operatorActionEn: 'Fill shift log and verify extruded roll specifications',
      machineActionAr: 'تزييت سلاسل النقل وسحب عينة من الحبيبات المجروشة',
      machineActionEn: 'Conveyor chain lubrication and regrind sample sieve test',
      urgency: 'RECOMMENDED',
    });
  }

  // Generate hourly curves
  const hourlyTimeline: HourlyStressPoint[] = [];
  const hoursToSimulate = Math.ceil(suggestedHours);

  for (let h = 1; h <= hoursToSimulate; h++) {
    const clockLabel = formatClockTime(shiftInfo.startHour, h);

    // Is there a break during this hour?
    const matchingBreak = breaks.find((b) => Math.abs(b.startHour - (h - 0.5)) <= 0.6);

    // Baseline curve: Machine stress accumulates with continuous run time
    // If a break occurred previously, stress dips
    let machineStress = Math.min(
      95,
      Math.round(20 + h * 9 * machine.baselineStressMultiplier * ambientFactor)
    );

    // Operator fatigue curve: Circadian + cumulative time
    let operatorFatigue = Math.min(
      95,
      Math.round(15 + h * 8.5 * shiftInfo.circadianStress * workloadFactor)
    );

    // If active break in this hour, reduce stress significantly
    if (matchingBreak) {
      machineStress = Math.max(25, machineStress - 22);
      operatorFatigue = Math.max(20, operatorFatigue - 26);
    }

    const compositeRisk = Math.round(machineStress * 0.55 + operatorFatigue * 0.45);

    hourlyTimeline.push({
      hour: h,
      timeLabel: clockLabel,
      machineStressPct: machineStress,
      operatorFatiguePct: operatorFatigue,
      compositeRiskPct: compositeRisk,
      isBreakWindow: !!matchingBreak,
      breakLabel: matchingBreak ? matchingBreak.labelEn : undefined,
    });
  }

  const totalBreakMinutes = breaks.reduce((sum, b) => sum + b.durationMinutes, 0);
  const netProductiveRunHours =
    Math.round((suggestedHours - totalBreakMinutes / 60) * 10) / 10;

  // Quantitative ROI Gains
  const projectedUptimeGainPct =
    config.ambientCondition === 'EXTREME_HEAT'
      ? 8.6
      : config.shiftType === 'NIGHT'
      ? 7.2
      : 5.8;

  const thermalStressReductionPct = Math.round(24 * ambientFactor);
  const operatorFatigueReductionPct = Math.round(28 * workloadFactor);
  const defectPreventionPct = Math.round(22 * shiftInfo.circadianStress);

  // Recommendations text
  const shiftDurationRecommendationAr =
    suggestedHours < standardHours
      ? `يوصى بتعديل الوردية إلى ${suggestedHours} ساعات (تقليص 30-60 دقيقة) لتجنب الإجهاد الحراري للسكاكين وتراكم التالف.`
      : `مدة الوردية الموصى بها هي ${suggestedHours} ساعات مع الالتزام التام بجدول فترات الراحة المتزامنة.`;

  const shiftDurationRecommendationEn =
    suggestedHours < standardHours
      ? `Optimal shift duration is capped at ${suggestedHours} hours (-30m reduction) to mitigate extreme thermal fatigue and defect spikes.`
      : `Recommended shift duration is ${suggestedHours} hours with strict adherence to synchronized cooling micro-breaks.`;

  const keyOperationalDirectivesAr = [
    `تنسيق فترات راحة المشغلين مع خمول الماكينة لتبريد حجرة الجرش وفحص حرارة المحامل.`,
    `في أوقات ذروة الحرارة (وردية الظهيرة)، يُلزم المشغلون بشرب السوائل في غرفة مكيفة كل 2.5 ساعة.`,
    `إيقاف مؤقت لمدة 30 دقيقة عند منتصف الوردية يقلل احتمال انسداد الفلاتر وكسر السكاكين بنسبة ${thermalStressReductionPct}%.`,
    `تطبيق التوصيات يحقق زيادة إنتاجية فعلية مقدرة بـ +${projectedUptimeGainPct}% عبر منع التوقفات الطارئة.`,
  ];

  const keyOperationalDirectivesEn = [
    `Synchronize operator resting with machine idle periods to allow granulator chamber cooling and bearing lubrication.`,
    `During high ambient temperatures, mandatory 15-minute hydration rests every 2.5 hours prevent vigilance lapses.`,
    `A 30-minute mid-shift thermal soak reduces risk of filter clogging and blade dulling by ${thermalStressReductionPct}%.`,
    `Adhering to this schedule delivers an estimated +${projectedUptimeGainPct}% net uptime gain by eliminating emergency shutdowns.`,
  ];

  return {
    machineId: config.machineId,
    machineNameAr: machine.nameAr,
    machineNameEn: machine.nameEn,
    shiftType: config.shiftType,
    shiftStartClock: shiftInfo.defaultStart,
    shiftEndClock: formatClockTime(shiftInfo.startHour, suggestedHours),
    currentStandardShiftHours: standardHours,
    suggestedOptimalShiftHours: suggestedHours,
    shiftDurationRecommendationAr,
    shiftDurationRecommendationEn,
    projectedUptimeGainPct,
    thermalStressReductionPct,
    operatorFatigueReductionPct,
    defectPreventionPct,
    breakSchedule: breaks,
    hourlyTimeline,
    totalBreakMinutes,
    netProductiveRunHours,
    keyOperationalDirectivesAr,
    keyOperationalDirectivesEn,
  };
}

// ============================================================================
// PRODUCTION CAPACITY VS REAL-TIME MATERIAL AVAILABILITY MODEL
// ============================================================================

export interface ProductionLineCapacityMatch {
  lineId: string;
  lineCode: string;
  nameAr: string;
  nameEn: string;
  category: 'SHREDDING' | 'EXTRUSION' | 'THERMOFORMING' | 'SORTING';
  materialNameAr: string;
  materialNameEn: string;
  availableMaterialKG: number;
  baseHourlyRateKG: number;
  nominalLaborCrew: number; // Standard crew needed for 100% capacity
  assignedLaborCrew: number; // Currently assigned crew by supervisor
  projectedCapacityKG: number; // Production capacity with current assigned crew
  maxPotentialCapacityKG: number; // Full line capacity if staffed at 100%
  effectiveThroughputKG: number; // min(availableMaterialKG, projectedCapacityKG)
  capacityMaterialRatioPct: number; // (projectedCapacityKG / availableMaterialKG) * 100
  bottleneckType: 'MATERIAL_SHORTAGE' | 'LABOR_CONSTRAINED' | 'BALANCED_OPTIMAL';
  bottleneckSeverity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  laborEfficiencyPct: number;
  recommendedLaborCrew: number;
  recommendationAr: string;
  recommendationEn: string;
}

export interface ShiftLaborAllocationSummary {
  totalAvailableLabor: number; // Total available workforce pool
  totalAssignedLabor: number;
  unassignedLabor: number;
  totalAvailableMaterialKG: number;
  totalProjectedCapacityKG: number;
  totalMaxCapacityKG: number;
  totalEffectiveThroughputKG: number;
  overallCapacityUtilizationPct: number;
  overallLaborEfficiencyPct: number;
  lines: ProductionLineCapacityMatch[];
  bottlenecksCount: number;
  activeShiftHours: number;
}

export interface FactoryProductionLineTemplate {
  lineId: string;
  lineCode: string;
  nameAr: string;
  nameEn: string;
  category: 'SHREDDING' | 'EXTRUSION' | 'THERMOFORMING' | 'SORTING';
  materialNameAr: string;
  materialNameEn: string;
  defaultAvailableMaterialKG: number;
  baseHourlyRateKG: number;
  nominalLaborCrew: number;
}

export const FACTORY_PRODUCTION_LINES: FactoryProductionLineTemplate[] = [
  {
    lineId: 'LINE-SHR-360',
    lineCode: 'SHR-360',
    nameAr: 'مكينة الثرم والجرش 360 (75kW)',
    nameEn: 'Heavy Duty Shredder 360 (75kW)',
    category: 'SHREDDING',
    materialNameAr: 'سكراب أكواب وبالات خام (PET/PP)',
    materialNameEn: 'Baled Scrap & Cup Offcuts (PET/PP)',
    defaultAvailableMaterialKG: 11200,
    baseHourlyRateKG: 1250,
    nominalLaborCrew: 3,
  },
  {
    lineId: 'LINE-EXT-01',
    lineCode: 'EXT-01',
    nameAr: 'خط بثق الألواح والفيلم 1 (HIPS)',
    nameEn: 'Extrusion Sheet Line 1 (HIPS)',
    category: 'EXTRUSION',
    materialNameAr: 'مفروم هوالك رولات شيت HIPS (DOC-360)',
    materialNameEn: 'Clean HIPS Regrind Flakes (DOC-360)',
    defaultAvailableMaterialKG: 7400,
    baseHourlyRateKG: 850,
    nominalLaborCrew: 3,
  },
  {
    lineId: 'LINE-EXT-02',
    lineCode: 'EXT-02',
    nameAr: 'خط تحبيب وبثق الحبيبات 2 (PP/HDPE)',
    nameEn: 'Pelletizing Extruder Line 2 (PP/HDPE)',
    category: 'EXTRUSION',
    materialNameAr: 'حبيبات معاد تدويرها مجففة (PP Prime)',
    materialNameEn: 'Recycled PP Pellets & Regrind',
    defaultAvailableMaterialKG: 5100,
    baseHourlyRateKG: 920,
    nominalLaborCrew: 3,
  },
  {
    lineId: 'LINE-THM-01',
    lineCode: 'THM-01',
    nameAr: 'وحدة التشكيل الحراري للأكواب 01',
    nameEn: 'Thermoforming Cup Line 01',
    category: 'THERMOFORMING',
    materialNameAr: 'رولات شيت مجهزة للتشكيل (Sheet Rolls)',
    materialNameEn: 'Extruded Sheet Coils in Buffer',
    defaultAvailableMaterialKG: 4800,
    baseHourlyRateKG: 600,
    nominalLaborCrew: 2,
  },
  {
    lineId: 'LINE-SRT-01',
    lineCode: 'SRT-01',
    nameAr: 'ساحة الفرز اليدوي والتجهيز والمكبس',
    nameEn: 'Manual Sorting & Staging Baling Yard',
    category: 'SORTING',
    materialNameAr: 'شاحنات خامات سكراب غير مفروزة (DOC-546)',
    materialNameEn: 'Unsorted Raw Intake Scrap Bales',
    defaultAvailableMaterialKG: 14500,
    baseHourlyRateKG: 1600,
    nominalLaborCrew: 3,
  },
];

/**
 * Calculate Capacity vs Material Availability and Labor Optimization
 */
export function calculateProductionCapacityVsMaterial(
  netProductiveHours = 7.25,
  assignedLaborByLine: Record<string, number> = {},
  availableMaterialOverride?: Record<string, number>,
  totalWorkforcePool = 14
): ShiftLaborAllocationSummary {
  const lines: ProductionLineCapacityMatch[] = [];

  let totalAssigned = 0;
  let totalMaterial = 0;
  let totalProjectedCap = 0;
  let totalMaxCap = 0;
  let totalEffective = 0;
  let bottlenecks = 0;

  for (const tmpl of FACTORY_PRODUCTION_LINES) {
    const assignedCrew =
      assignedLaborByLine[tmpl.lineId] !== undefined
        ? assignedLaborByLine[tmpl.lineId]
        : tmpl.nominalLaborCrew;

    totalAssigned += assignedCrew;

    const availableKG =
      availableMaterialOverride && availableMaterialOverride[tmpl.lineId] !== undefined
        ? availableMaterialOverride[tmpl.lineId]
        : tmpl.defaultAvailableMaterialKG;

    totalMaterial += availableKG;

    // Full 100% capacity with standard crew
    const maxCapacityKG = Math.round(tmpl.baseHourlyRateKG * netProductiveHours);
    totalMaxCap += maxCapacityKG;

    // Calculate capacity scaling based on assigned labor
    let laborFactor = 0;
    if (assignedCrew === 0) {
      laborFactor = 0;
    } else if (assignedCrew < tmpl.nominalLaborCrew) {
      // Sub-linear reduction when understaffed
      laborFactor = Math.pow(assignedCrew / tmpl.nominalLaborCrew, 0.8);
    } else if (assignedCrew === tmpl.nominalLaborCrew) {
      laborFactor = 1.0;
    } else {
      // Marginal gain for extra hands up to +25%
      laborFactor = Math.min(1.25, 1.0 + (assignedCrew - tmpl.nominalLaborCrew) * 0.15);
    }

    const projectedCapacityKG = Math.round(maxCapacityKG * laborFactor);
    totalProjectedCap += projectedCapacityKG;

    const effectiveThroughputKG = Math.min(availableKG, projectedCapacityKG);
    totalEffective += effectiveThroughputKG;

    // Bottleneck analysis
    let bottleneckType: 'MATERIAL_SHORTAGE' | 'LABOR_CONSTRAINED' | 'BALANCED_OPTIMAL' = 'BALANCED_OPTIMAL';
    let bottleneckSeverity: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
    let recommendationAr = 'تخصيص متوازن للعمالة يتطابق مع المخزون المتاح.';
    let recommendationEn = 'Balanced labor allocation matched to available inventory.';
    let recommendedLaborCrew = tmpl.nominalLaborCrew;

    // Material to Capacity comparison
    if (availableKG < projectedCapacityKG * 0.75) {
      bottleneckType = 'MATERIAL_SHORTAGE';
      bottleneckSeverity = availableKG < projectedCapacityKG * 0.5 ? 'CRITICAL' : 'WARNING';
      bottlenecks++;

      // Suggest reducing labor to match material
      const optimalCrewForMaterial = Math.max(
        1,
        Math.round((availableKG / maxCapacityKG) * tmpl.nominalLaborCrew)
      );
      recommendedLaborCrew = optimalCrewForMaterial;

      const idleLabor = assignedCrew - optimalCrewForMaterial;
      recommendationAr =
        idleLabor > 0
          ? `عجز في المواد الخام المتاحة (${availableKG.toLocaleString()} كغم). يوصى بإعادة توزيع ${idleLabor} مشغل إلى خطوط أخرى لتفادي ساعات الخمول.`
          : `المواد المتاحة محدودة؛ استمرار التشغيل بحجم طاقم مصغر.`;
      recommendationEn =
        idleLabor > 0
          ? `Material shortage (${availableKG.toLocaleString()} KG). Reallocate ${idleLabor} operator(s) to lines with surplus inventory to eliminate idle downtime.`
          : `Material buffer is limited; keep minimum crew.`;
    } else if (availableKG > projectedCapacityKG * 1.35) {
      bottleneckType = 'LABOR_CONSTRAINED';
      bottleneckSeverity = availableKG > projectedCapacityKG * 1.6 ? 'CRITICAL' : 'WARNING';
      bottlenecks++;

      // Material surplus exists; adding labor unlocks more output
      recommendedLaborCrew = Math.min(tmpl.nominalLaborCrew + 1, assignedCrew + 1);

      recommendationAr = `وفرة كبيرة في المواد المتاحة (${availableKG.toLocaleString()} كغم). الطاقة الإنتاجية مقيدة بعدد العمال؛ إضافة مشغل ترفع الإنتاج بمقدار +${Math.round(maxCapacityKG * 0.15).toLocaleString()} كغم.`;
      recommendationEn = `Abundant material ready (${availableKG.toLocaleString()} KG). Line capacity is constrained by labor; adding an operator unlocks +${Math.round(maxCapacityKG * 0.15).toLocaleString()} KG throughput.`;
    } else {
      bottleneckType = 'BALANCED_OPTIMAL';
      bottleneckSeverity = 'NORMAL';
      recommendedLaborCrew = assignedCrew;
      recommendationAr = `توافق ممتاز بين كمية المواد المتاحة (${availableKG.toLocaleString()} كغم) والطاقة التشغيلية المقدرة.`;
      recommendationEn = `Optimal alignment between available feedstock (${availableKG.toLocaleString()} KG) and projected run capacity.`;
    }

    const laborEfficiencyPct =
      projectedCapacityKG > 0
        ? Math.min(100, Math.round((effectiveThroughputKG / projectedCapacityKG) * 100))
        : 0;

    const ratioPct =
      availableKG > 0 ? Math.round((projectedCapacityKG / availableKG) * 100) : 100;

    lines.push({
      lineId: tmpl.lineId,
      lineCode: tmpl.lineCode,
      nameAr: tmpl.nameAr,
      nameEn: tmpl.nameEn,
      category: tmpl.category,
      materialNameAr: tmpl.materialNameAr,
      materialNameEn: tmpl.materialNameEn,
      availableMaterialKG: availableKG,
      baseHourlyRateKG: tmpl.baseHourlyRateKG,
      nominalLaborCrew: tmpl.nominalLaborCrew,
      assignedLaborCrew: assignedCrew,
      projectedCapacityKG,
      maxPotentialCapacityKG: maxCapacityKG,
      effectiveThroughputKG,
      capacityMaterialRatioPct: ratioPct,
      bottleneckType,
      bottleneckSeverity,
      laborEfficiencyPct,
      recommendedLaborCrew,
      recommendationAr,
      recommendationEn,
    });
  }

  const overallCapacityUtil =
    totalMaxCap > 0 ? Math.round((totalEffective / totalMaxCap) * 100) : 0;

  const overallLaborEfficiency =
    totalProjectedCap > 0 ? Math.round((totalEffective / totalProjectedCap) * 100) : 0;

  return {
    totalAvailableLabor: totalWorkforcePool,
    totalAssignedLabor: totalAssigned,
    unassignedLabor: totalWorkforcePool - totalAssigned,
    totalAvailableMaterialKG: totalMaterial,
    totalProjectedCapacityKG: totalProjectedCap,
    totalMaxCapacityKG: totalMaxCap,
    totalEffectiveThroughputKG: totalEffective,
    overallCapacityUtilizationPct: overallCapacityUtil,
    overallLaborEfficiencyPct: overallLaborEfficiency,
    lines,
    bottlenecksCount: bottlenecks,
    activeShiftHours: netProductiveHours,
  };
}

/**
 * Auto-Balance algorithm to find optimal crew allocation across lines
 * maximizing total shift throughput based on real-time material availability
 */
export function autoOptimizeLaborAllocation(
  netProductiveHours = 7.25,
  totalWorkforcePool = 14,
  availableMaterialOverride?: Record<string, number>
): Record<string, number> {
  const currentSummary = calculateProductionCapacityVsMaterial(
    netProductiveHours,
    {},
    availableMaterialOverride,
    totalWorkforcePool
  );

  const allocation: Record<string, number> = {};

  // Step 1: Assign minimum needed crew to avoid idle equipment where material exists
  let remainingLabor = totalWorkforcePool;

  for (const line of currentSummary.lines) {
    if (line.availableMaterialKG > 1000) {
      allocation[line.lineId] = Math.max(1, line.recommendedLaborCrew);
      remainingLabor -= allocation[line.lineId];
    } else {
      allocation[line.lineId] = 0;
    }
  }

  // Step 2: If we have excess labor or deficits, adjust greedily on lines with surplus material
  if (remainingLabor > 0) {
    // Sort lines by highest remaining material surplus
    const sorted = [...currentSummary.lines].sort(
      (a, b) => b.availableMaterialKG - a.availableMaterialKG
    );

    for (const line of sorted) {
      if (remainingLabor <= 0) break;
      const current = allocation[line.lineId] || 0;
      if (current < line.nominalLaborCrew + 1) {
        allocation[line.lineId] = current + 1;
        remainingLabor--;
      }
    }
  } else if (remainingLabor < 0) {
    // Overallocated, reduce from lowest priority / lowest material lines
    const sorted = [...currentSummary.lines].sort(
      (a, b) => a.availableMaterialKG - b.availableMaterialKG
    );

    for (const line of sorted) {
      if (remainingLabor >= 0) break;
      const current = allocation[line.lineId] || 0;
      if (current > 1) {
        allocation[line.lineId] = current - 1;
        remainingLabor++;
      }
    }
  }

  return allocation;
}

