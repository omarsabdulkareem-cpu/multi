/**
 * AL-KARWAN FACTORY CONTROL SYSTEM
 * Energy Efficiency & Power Cost Monitoring Service for Shredding Operations (مراقبة كفاءة الطاقة والكهرباء لعمليات الثرم والجرش)
 * Tracks electrical consumption (kW, kWh, Amps, Power Factor, SEC = kWh/kg)
 * and computes operational electricity costs according to Iraqi industrial power tariffs.
 */

import {
  ShredderMachineEnergyProfile,
  ShreddingEnergyReading,
  HourlyEnergyTelemetry,
  EnergySavingOpportunity,
  EnergyTariffWindow,
  TariffZone,
  ShreddingTransaction,
} from '../types';

const STORAGE_KEY_ENERGY_LOGS = 'alkarwan_energy_meter_logs_v1';
const STORAGE_KEY_ENERGY_PROFILES = 'alkarwan_energy_profiles_v1';

// Iraqi Industrial Power Tariff Windows
export const INDUSTRIAL_TARIFF_WINDOWS: EnergyTariffWindow[] = [
  {
    zone: 'OFF_PEAK',
    nameAr: 'التعريفة المخفضة (ساعات الليل الهادئة)',
    nameEn: 'Off-Peak Night Tariff',
    rateIQDPerKWh: 85,
    rateUSDPerKWh: 0.065,
    startHour: 22,
    endHour: 7,
    color: '#10b981', // emerald
  },
  {
    zone: 'STANDARD',
    nameAr: 'التعريفة القياسية (ساعات النهار الاعتيادية)',
    nameEn: 'Standard Day Tariff',
    rateIQDPerKWh: 140,
    rateUSDPerKWh: 0.108,
    startHour: 7,
    endHour: 18,
    color: '#06b6d4', // cyan
  },
  {
    zone: 'PEAK',
    nameAr: 'تعريفة الذروة القصوى (الحمل العالي الصناعي)',
    nameEn: 'Peak Load Tariff (Highest Surcharge)',
    rateIQDPerKWh: 240,
    rateUSDPerKWh: 0.185,
    startHour: 18,
    endHour: 22,
    color: '#f43f5e', // rose
  },
];

/**
 * Determine current tariff window based on hour of day
 */
export function getCurrentTariffWindow(hour?: number): EnergyTariffWindow {
  const currentHour = hour !== undefined ? hour : new Date().getHours();

  if (currentHour >= 18 && currentHour < 22) {
    return INDUSTRIAL_TARIFF_WINDOWS[2]; // PEAK
  } else if (currentHour >= 7 && currentHour < 18) {
    return INDUSTRIAL_TARIFF_WINDOWS[1]; // STANDARD
  } else {
    return INDUSTRIAL_TARIFF_WINDOWS[0]; // OFF_PEAK
  }
}

/**
 * Default Shredder Machinery Power Profiles
 */
export const DEFAULT_SHREDDER_ENERGY_PROFILES: ShredderMachineEnergyProfile[] = [
  {
    machineId: 'THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)',
    code: 'SHR-01 (75kW)',
    nameAr: 'ماكينة الثرم 1 (دوار ثقيل 75 ك.واط - سكراب ومصبوبات)',
    nameEn: 'Shredder 01 - Heavy Duty Rotor 75kW (Purges & Rolls)',
    nominalMotorKW: 75,
    ratedAmps: 135,
    voltageV: 386,
    currentAmps: 108.4,
    activePowerKW: 58.2,
    powerFactor: 0.88,
    state: 'RUNNING_LOAD',
    loadPercentage: 77.6,
    throughputKGHour: 680,
    specificEnergyConsumptionKWhKG: 0.086, // kWh / kg
    targetSECKWhKG: 0.085,
    bladeWearPct: 24, // 24% wear (sharp)
    dailyConsumptionKWh: 436.5,
    dailyCostIQD: 61110,
    dailyCostUSD: 47.0,
    idleLossKWhToday: 18.5,
    temperatureC: 62.4,
    lastReadingTime: 'منذ دقيقة',
  },
  {
    machineId: 'THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)',
    code: 'SHR-02 (55kW)',
    nameAr: 'ماكينة الثرم 2 (جرش ناعم 55 ك.واط - رقائق وألواح)',
    nameEn: 'Shredder 02 - Fine Granulator 55kW (Sheet & Flakes)',
    nominalMotorKW: 55,
    ratedAmps: 100,
    voltageV: 384,
    currentAmps: 84.6,
    activePowerKW: 46.5,
    powerFactor: 0.89,
    state: 'RUNNING_LOAD',
    loadPercentage: 84.5,
    throughputKGHour: 470,
    specificEnergyConsumptionKWhKG: 0.099, // slightly higher due to blade dullness
    targetSECKWhKG: 0.090,
    bladeWearPct: 68, // 68% wear (needs sharpening!)
    dailyConsumptionKWh: 348.0,
    dailyCostIQD: 48720,
    dailyCostUSD: 37.5,
    idleLossKWhToday: 24.0,
    temperatureC: 71.8,
    lastReadingTime: 'منذ دقيقتين',
  },
  {
    machineId: 'THERM-SHREDDER-03 (Cup & Edge Trimmings 45kW)',
    code: 'SHR-03 (45kW)',
    nameAr: 'ماكينة الثرم 3 (توالف حواف وأكواب 45 ك.واط)',
    nameEn: 'Shredder 03 - Cup & Edge Granulator 45kW',
    nominalMotorKW: 45,
    ratedAmps: 82,
    voltageV: 387,
    currentAmps: 22.0, // running idle / low load
    activePowerKW: 12.8,
    powerFactor: 0.74,
    state: 'RUNNING_IDLE', // Warning: idle loss!
    loadPercentage: 28.4,
    throughputKGHour: 0,
    specificEnergyConsumptionKWhKG: 0.0,
    targetSECKWhKG: 0.092,
    bladeWearPct: 35,
    dailyConsumptionKWh: 182.0,
    dailyCostIQD: 25480,
    dailyCostUSD: 19.6,
    idleLossKWhToday: 38.4,
    temperatureC: 48.0,
    lastReadingTime: 'مباشر',
  },
];

/**
 * 24-Hour Industrial Hourly Power Profile
 */
export function generate24HourTelemetry(): HourlyEnergyTelemetry[] {
  const result: HourlyEnergyTelemetry[] = [];

  // Typical shift hours:
  // 00:00 - 07:00: Night shift (Off-peak, steady load)
  // 07:00 - 15:00: Morning shift (Standard, high load)
  // 15:00 - 18:00: Evening start (Standard, high load)
  // 18:00 - 22:00: Peak tariff window (Needs minimization)
  // 22:00 - 24:00: Night ramp-up (Off-peak)

  for (let h = 0; h < 24; h++) {
    const tariff = getCurrentTariffWindow(h);
    const hourLabel = `${h.toString().padStart(2, '0')}:00`;

    let s1 = 0;
    let s2 = 0;
    let s3 = 0;
    let kg = 0;

    if (h >= 0 && h < 6) {
      // Off-peak night operations
      s1 = 54 + Math.sin(h) * 4;
      s2 = 42 + Math.cos(h) * 3;
      s3 = 0; // stopped
      kg = 980;
    } else if (h >= 6 && h < 14) {
      // Morning main shift
      s1 = 64 + Math.sin(h * 1.5) * 6;
      s2 = 48 + Math.cos(h * 1.2) * 4;
      s3 = 34 + Math.sin(h) * 5;
      kg = 1420;
    } else if (h >= 14 && h < 18) {
      // Afternoon shift
      s1 = 60 + Math.sin(h) * 5;
      s2 = 45 + Math.cos(h) * 4;
      s3 = 30 + Math.sin(h * 2) * 4;
      kg = 1250;
    } else if (h >= 18 && h < 22) {
      // PEAK TARIFF WINDOW (Factory attempts partial load shedding)
      s1 = 48 + Math.sin(h) * 6; // slightly throttled
      s2 = 36 + Math.cos(h) * 4;
      s3 = 14; // running idle / minimal
      kg = 820;
    } else {
      // Late evening / night
      s1 = 58 + Math.sin(h) * 4;
      s2 = 44 + Math.cos(h) * 3;
      s3 = 28 + Math.sin(h) * 3;
      kg = 1180;
    }

    const totalActiveKW = Math.round((s1 + s2 + s3) * 10) / 10;
    const costIQD = Math.round(totalActiveKW * tariff.rateIQDPerKWh);

    result.push({
      hourLabel,
      hour: h,
      tariffZone: tariff.zone,
      shredder01KW: Math.round(s1 * 10) / 10,
      shredder02KW: Math.round(s2 * 10) / 10,
      shredder03KW: Math.round(s3 * 10) / 10,
      totalActiveKW,
      totalCostIQD: costIQD,
      isPeakTariff: tariff.zone === 'PEAK',
      totalThroughputKG: kg,
    });
  }

  return result;
}

/**
 * Historical Batch Energy Readings correlated with Shredding Operations
 */
export const INITIAL_HISTORICAL_READINGS: ShreddingEnergyReading[] = [
  {
    id: 'NRG-2026-081',
    shreddingTransactionId: 'shred-1',
    shreddingNumber: 'THM-2026-0318',
    machineId: 'THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)',
    machineCode: 'SHR-01',
    materialName: 'سكراب بولي بروبيلين هجين (PP Sheet Trims)',
    materialCategory: 'PP Sheet',
    timestamp: '2026-09-22 08:30',
    shift: 'صباحية (06:00 - 14:00)',
    operator: 'عمر التميمي',
    initialMeterKWh: 42100.5,
    finalMeterKWh: 42525.0,
    totalKWh: 424.5,
    durationMinutes: 440,
    inputKG: 5000,
    outputKG: 4850,
    specificEnergyKWhKG: 0.0849,
    tariffZone: 'STANDARD',
    rateIQDPerKWh: 140,
    totalCostIQD: 59430,
    totalCostUSD: 45.72,
    efficiencyRating: 'A+',
    notes: 'شفرات جديدة حادة، استهلاك كهرباء مثالي أقل من المعدل القياسي.',
  },
  {
    id: 'NRG-2026-080',
    shreddingTransactionId: 'shred-2',
    shreddingNumber: 'THM-2026-0319',
    machineId: 'THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)',
    machineCode: 'SHR-02',
    materialName: 'رقائق بولي ستايرين صلب (HIPS Regrind Flakes)',
    materialCategory: 'HIPS Flakes',
    timestamp: '2026-09-21 19:15',
    shift: 'مسائية (14:00 - 22:00)',
    operator: 'حيدر الكرخي',
    initialMeterKWh: 28950.0,
    finalMeterKWh: 29285.5,
    totalKWh: 335.5,
    durationMinutes: 420,
    inputKG: 3200,
    outputKG: 3080,
    specificEnergyKWhKG: 0.1048,
    tariffZone: 'PEAK',
    rateIQDPerKWh: 240,
    totalCostIQD: 80520,
    totalCostUSD: 61.94,
    efficiencyRating: 'B',
    notes: 'تم التشغيل في ذروة الحمل المسائية، بالإضافة إلى تأكل بنسبة 68% في السكاكين مما رفع الـ SEC.',
  },
  {
    id: 'NRG-2026-079',
    shreddingTransactionId: 'shred-3',
    shreddingNumber: 'THM-2026-0320',
    machineId: 'THERM-SHREDDER-03 (Cup & Edge Trimmings 45kW)',
    machineCode: 'SHR-03',
    materialName: 'هوالك أكواب مفرغة وشفافة (PP Cups Scrap)',
    materialCategory: 'PP Cups',
    timestamp: '2026-09-21 11:00',
    shift: 'صباحية (06:00 - 14:00)',
    operator: 'سجاد العبيدي',
    initialMeterKWh: 15420.0,
    finalMeterKWh: 15645.0,
    totalKWh: 225.0,
    durationMinutes: 360,
    inputKG: 2450,
    outputKG: 2380,
    specificEnergyKWhKG: 0.0918,
    tariffZone: 'STANDARD',
    rateIQDPerKWh: 140,
    totalCostIQD: 31500,
    totalCostUSD: 24.23,
    efficiencyRating: 'A',
    notes: 'تشغيل منتظم، معامل قدرة مستقر 0.89.',
  },
  {
    id: 'NRG-2026-078',
    shreddingTransactionId: 'shred-4',
    shreddingNumber: 'THM-2026-0317',
    machineId: 'THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)',
    machineCode: 'SHR-01',
    materialName: 'كتل ومصبوبات سميكة (Purge Lumps 70mm)',
    materialCategory: 'Purge Lumps',
    timestamp: '2026-09-20 23:30',
    shift: 'ليلية (22:00 - 06:00)',
    operator: 'كرار عباس',
    initialMeterKWh: 41200.0,
    finalMeterKWh: 41780.0,
    totalKWh: 580.0,
    durationMinutes: 480,
    inputKG: 4500,
    outputKG: 4320,
    specificEnergyKWhKG: 0.1288,
    tariffZone: 'OFF_PEAK',
    rateIQDPerKWh: 85,
    totalCostIQD: 49300,
    totalCostUSD: 37.92,
    efficiencyRating: 'A',
    notes: 'المادة كثيفة وقاسية ولكن التشغيل الليلي في وقت التعريفة المخفضة خفض الكلفة الإجمالية بنسبة 64%!',
  },
];

/**
 * Concrete Energy Saving Opportunities identified in Factory
 */
export const ENERGY_SAVING_OPPORTUNITIES: EnergySavingOpportunity[] = [
  {
    id: 'OPP-01',
    type: 'LOAD_SHIFT',
    titleAr: 'ترحيل 70% من دورات ثرم الكتل السميكة إلى الوردية الليلية',
    titleEn: 'Shift Heavy Scrap Shredding to Off-Peak Night Hours',
    descriptionAr:
      'تشغيل الماكنة 75kW في ساعات الذروة (18:00 - 22:00) يكلف 240 د.ع/ك.واط، بينما تشغيلها بعد 22:00 يكلف 85 د.ع فقط بفارق 155 د.ع لكل ك.واط/ساعة.',
    descriptionEn:
      'Running the 75kW shredder during peak hours (18:00 - 22:00) incurs 240 IQD/kWh vs 85 IQD/kWh off-peak, creating an immediate 64% cost reduction per run.',
    severity: 'HIGH',
    estimatedMonthlySavingsIQD: 820000,
    estimatedMonthlySavingsUSD: 630,
    estimatedMonthlyKWhSaved: 4800,
    actionRecommendationAr: 'جدولة أوامر التشغيل ذات الحجم الأكبر من 3 أطنان لتبدأ بعد الساعة 22:00 مساءً.',
    actionRecommendationEn: 'Reschedule batches > 3,000 KG to start after 22:00 night window.',
  },
  {
    id: 'OPP-02',
    type: 'BLADE_SHARPENING',
    titleAr: 'شحذ سكاكين الماكنة 02 (تآكل السكاكين يرفع المقاومة الميكانيكية بـ 18%)',
    titleEn: 'Sharpen Shredder 02 Rotor Knives (Dull Blades add 18% Friction Load)',
    descriptionAr:
      'بيانات الـ SEC للمفرمة 02 تسجل 0.099 ك.واط/كغم مقابل الهدف 0.088 ك.واط/كغم نتيجة كروية حواف السكاكين واحتكاك المادة بدلاً من قصها النظيف.',
    descriptionEn:
      'Specific Energy for Granulator 02 shows 0.099 kWh/kg vs 0.088 target due to blade edge rounding causing plastic smearing and excessive motor draw.',
    severity: 'HIGH',
    estimatedMonthlySavingsIQD: 490000,
    estimatedMonthlySavingsUSD: 377,
    estimatedMonthlyKWhSaved: 3500,
    actionRecommendationAr: 'إرسال السكاكين لطحن الزوايا (45°) وضبط الخلوص مع السكاكين الثابتة على 0.8 ملم.',
    actionRecommendationEn: 'Regrind rotor knife edges to 45° and reset bed clearance to 0.8 mm.',
  },
  {
    id: 'OPP-03',
    type: 'IDLE_CUTOFF',
    titleAr: 'تفعيل إيقاف التشغيل التلقائي عند انقطاع التلقيم لأكثر من 4 دقائق',
    titleEn: 'Automatic No-Load Idle Cutoff (>4 Minutes without Feeding)',
    descriptionAr:
      'رصدت الحساسات دوران المفرمة 03 بدون تلقيم لمدة 38 دقيقة اليوم، مستهلكةً 12.8 ك.واط دون أي ناتج، مما يمثل هدراً صافياً للطاقة.',
    descriptionEn:
      'Shredder 03 ran empty for 38 minutes today, burning 12.8 kW continuously with zero output throughput.',
    severity: 'MEDIUM',
    estimatedMonthlySavingsIQD: 310000,
    estimatedMonthlySavingsUSD: 238,
    estimatedMonthlyKWhSaved: 2200,
    actionRecommendationAr: 'تفعيل حساس الوزن على قمع التلقيم لإطفاء المحرك آلياً عند خلو القمع.',
    actionRecommendationEn: 'Arm hopper weight sensor to auto-pause motor if hopper remains dry for 4 mins.',
  },
  {
    id: 'OPP-04',
    type: 'POWER_FACTOR',
    titleAr: 'تحسين معامل القدرة لمكثفات المواتير فوق 0.92',
    titleEn: 'Capacitor Bank Correction for Power Factor > 0.92',
    descriptionAr:
      'انخفاض معامل القدرة إلى 0.74 في المفرمة 03 يسبب غرامات قدرة غير فعالة (kVARh) من وزارة الكهرباء ويزيد حرارة الكيبلات.',
    descriptionEn:
      'Power factor dipping to 0.74 triggers reactive power utility penalties and creates unnecessary cable heating.',
    severity: 'LOW',
    estimatedMonthlySavingsIQD: 180000,
    estimatedMonthlySavingsUSD: 138,
    estimatedMonthlyKWhSaved: 1200,
    actionRecommendationAr: 'فحص بنك المكثفات الأوتوماتيكي (APFC) في لوحة التوزيع الفرعية للثرم.',
    actionRecommendationEn: 'Service the Automatic Power Factor Correction (APFC) panel in Shredding Bay.',
  },
];

/**
 * Storage helpers
 */
export function getStoredEnergyReadings(): ShreddingEnergyReading[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENERGY_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse stored energy readings', e);
  }
  return INITIAL_HISTORICAL_READINGS;
}

export function saveStoredEnergyReadings(readings: ShreddingEnergyReading[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_ENERGY_LOGS, JSON.stringify(readings));
  } catch (e) {
    console.error('Failed to save energy readings to localStorage', e);
  }
}

export function addEnergyReading(entry: Omit<ShreddingEnergyReading, 'id'>): ShreddingEnergyReading {
  const all = getStoredEnergyReadings();
  const newEntry: ShreddingEnergyReading = {
    ...entry,
    id: `NRG-${Date.now().toString().slice(-6)}`,
  };
  const updated = [newEntry, ...all];
  saveStoredEnergyReadings(updated);
  return newEntry;
}

/**
 * What-If Energy Cost Reduction Calculator
 */
export interface EnergySimulationParams {
  shiftToOffPeakPercentage: number; // 0 to 100%
  bladeSharpeningReductionPct: number; // 0 to 25% (reduction in kWh/kg)
  idleMinutesEliminatedPerDay: number; // 0 to 60 minutes
  monthlyShreddingTons: number; // e.g. 150 Tons
}

export interface EnergySimulationResult {
  baselineMonthlyKWh: number;
  baselineMonthlyCostIQD: number;
  baselineMonthlyCostUSD: number;
  optimizedMonthlyKWh: number;
  optimizedMonthlyCostIQD: number;
  optimizedMonthlyCostUSD: number;
  monthlySavingsIQD: number;
  monthlySavingsUSD: number;
  annualSavingsIQD: number;
  annualSavingsUSD: number;
  savingsPercentage: number;
  co2ReductionTons: number; // ~0.55 kg CO2 per kWh
}

export function calculateEnergySavingsSimulation(
  params: EnergySimulationParams
): EnergySimulationResult {
  const {
    shiftToOffPeakPercentage,
    bladeSharpeningReductionPct,
    idleMinutesEliminatedPerDay,
    monthlyShreddingTons,
  } = params;

  const totalKG = monthlyShreddingTons * 1000;
  const baselineSEC = 0.092; // 0.092 kWh/kg average

  // Baseline energy calculation
  const baselineProductionKWh = totalKG * baselineSEC;
  const baselineIdleKWh = (45 / 60) * 18 * 30; // 45 min idle/day @ ~18kW average across shredders * 30 days
  const baselineTotalKWh = baselineProductionKWh + baselineIdleKWh;

  // Baseline tariff distribution (historical): 50% Standard (140 IQD), 30% Peak (240 IQD), 20% Off-Peak (85 IQD)
  const baselineBlendedTariff = 0.5 * 140 + 0.3 * 240 + 0.2 * 85; // 159 IQD/kWh
  const baselineCostIQD = baselineTotalKWh * baselineBlendedTariff;
  const baselineCostUSD = baselineCostIQD / 1300;

  // Optimized energy calculation
  const optimizedSEC = baselineSEC * (1 - bladeSharpeningReductionPct / 100);
  const optimizedProductionKWh = totalKG * optimizedSEC;

  const idleMinutesReducedKWh = (idleMinutesEliminatedPerDay / 60) * 18 * 30;
  const optimizedIdleKWh = Math.max(0, baselineIdleKWh - idleMinutesReducedKWh);
  const optimizedTotalKWh = optimizedProductionKWh + optimizedIdleKWh;

  // Optimized tariff distribution with shift to off-peak:
  // Transfer shiftToOffPeakPercentage from peak (first) and standard (second) into off-peak
  const peakFraction = Math.max(0, 0.3 - (shiftToOffPeakPercentage / 100) * 0.3);
  const standardFraction = Math.max(
    0,
    0.5 - Math.max(0, (shiftToOffPeakPercentage / 100) * 0.5 - (0.3 - peakFraction))
  );
  const offPeakFraction = 1 - peakFraction - standardFraction;

  const optimizedBlendedTariff =
    peakFraction * 240 + standardFraction * 140 + offPeakFraction * 85;

  const optimizedCostIQD = optimizedTotalKWh * optimizedBlendedTariff;
  const optimizedCostUSD = optimizedCostIQD / 1300;

  const monthlySavingsIQD = Math.max(0, baselineCostIQD - optimizedCostIQD);
  const monthlySavingsUSD = Math.max(0, baselineCostUSD - optimizedCostUSD);
  const annualSavingsIQD = monthlySavingsIQD * 12;
  const annualSavingsUSD = monthlySavingsUSD * 12;

  const savingsPercentage =
    baselineCostIQD > 0 ? (monthlySavingsIQD / baselineCostIQD) * 100 : 0;
  const co2ReductionTons = ((baselineTotalKWh - optimizedTotalKWh) * 0.55 * 12) / 1000;

  return {
    baselineMonthlyKWh: Math.round(baselineTotalKWh),
    baselineMonthlyCostIQD: Math.round(baselineCostIQD),
    baselineMonthlyCostUSD: Math.round(baselineCostUSD),
    optimizedMonthlyKWh: Math.round(optimizedTotalKWh),
    optimizedMonthlyCostIQD: Math.round(optimizedCostIQD),
    optimizedMonthlyCostUSD: Math.round(optimizedCostUSD),
    monthlySavingsIQD: Math.round(monthlySavingsIQD),
    monthlySavingsUSD: Math.round(monthlySavingsUSD),
    annualSavingsIQD: Math.round(annualSavingsIQD),
    annualSavingsUSD: Math.round(annualSavingsUSD),
    savingsPercentage: Math.round(savingsPercentage * 10) / 10,
    co2ReductionTons: Math.round(co2ReductionTons * 10) / 10,
  };
}

/**
 * Generate CSV text for energy consumption export
 */
export function exportEnergyAuditCSV(readings: ShreddingEnergyReading[]): string {
  const headers = [
    'Reading ID',
    'Date & Time',
    'Shredding Batch #',
    'Machine Code',
    'Material Name',
    'Shift',
    'Operator',
    'Duration (Min)',
    'Input KG',
    'Output KG',
    'Total Energy (kWh)',
    'Specific Energy (kWh/kg)',
    'Tariff Zone',
    'Tariff Rate (IQD/kWh)',
    'Total Cost (IQD)',
    'Total Cost (USD)',
    'Efficiency Rating',
  ];

  const rows = readings.map((r) => [
    r.id,
    `"${r.timestamp}"`,
    `"${r.shreddingNumber || 'N/A'}"`,
    `"${r.machineCode}"`,
    `"${r.materialName}"`,
    `"${r.shift}"`,
    `"${r.operator}"`,
    r.durationMinutes,
    r.inputKG,
    r.outputKG,
    r.totalKWh,
    r.specificEnergyKWhKG.toFixed(4),
    r.tariffZone,
    r.rateIQDPerKWh,
    r.totalCostIQD,
    r.totalCostUSD.toFixed(2),
    r.efficiencyRating,
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
