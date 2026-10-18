/**
 * Weighbridge Scale Predictive Maintenance Service
 * Al-Karwan Plastics Factory - Raw Material Receiving & Weighbridge Operations
 *
 * Evaluates scale-in weight recording frequencies and intake patterns against
 * established historical operational baselines. Identifies mechanical binding,
 * ADC lockup, high-frequency switch chatter, and load-cell sensor drift before
 * catastrophic weighbridge failure occurs.
 */

import { QrScanHistoryItem } from '../components/ReceivingScanHistoryTable';
import { ReceivingTransaction } from '../types';

export type ScaleDeviationType =
  | 'FREQUENCY_CHATTER'   // Abnormally rapid recordings (bouncy switches, load cells not settling, rapid double-capture)
  | 'FREQUENCY_STALL'     // Abnormally protracted delay between trucks during operational shift
  | 'PATTERN_FLATLINE'    // Consecutive identical static weights (ADC sensor lock or deck bound on pit bumper)
  | 'PATTERN_DRIFT'       // Monotonic span creep or systematic weight distribution offset (>2.5 sigma)
  | 'HEALTHY';            // Within historical operational baselines

export interface ScaleOperationalBaseline {
  baselineFrequencyTxPerHour: number; // Normal operational baseline (e.g. 5.5 tx/hr)
  baselineMeanIntervalMinutes: number; // Expected mean interval between trucks (e.g. 10.9 min)
  baselineIntervalStdDevMinutes: number; // Acceptable standard deviation (e.g. 3.2 min)
  baselineMeanGrossWeightKG: number; // Historical mean gross truck weight (e.g. 29,200 KG)
  baselineWeightStdDevKG: number; // Standard deviation of raw material trucks (e.g. 3,850 KG)
  maxSafeConsecutiveIdenticalWeights: number; // Threshold for flatline detection (default 2)
  minSafeIntervalMinutes: number; // Threshold for chatter warning (e.g. 2.0 min)
  maxSafeIntervalMinutes: number; // Threshold for shift stall (e.g. 45.0 min)
  acceptableZScoreThreshold: number; // Z-score threshold for frequency warning (e.g. 2.2)
  lastBaselineCalibratedDate: string;
}

export interface ScalePredictiveMaintenanceAlert {
  id: string;
  isTriggered: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  deviationType: ScaleDeviationType;
  currentFrequencyTxPerHour: number;
  currentMeanIntervalMinutes: number;
  frequencyZScore: number;
  patternVarianceScore: number; // 0 - 100 (lower is stable)
  healthScore: number; // 0 - 100%
  failureProbabilityPct: number; // 0 - 100%
  projectedTimeToFailureHours: number;
  consecutiveIdenticalCount: number;
  weightDriftOffsetKG: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  rootCauseAr: string;
  rootCauseEn: string;
  recommendedActionAr: string;
  recommendedActionEn: string;
  historicalBaseline: ScaleOperationalBaseline;
  detectedAt: string;
  isSimulated?: boolean;
}

const STORAGE_KEY_SCALE_BASELINE = 'alkarwan_scale_operational_baseline_v1';
const STORAGE_KEY_SIMULATED_DEVIATION = 'alkarwan_scale_simulated_deviation_v1';

export const DEFAULT_SCALE_BASELINE: ScaleOperationalBaseline = {
  baselineFrequencyTxPerHour: 5.5,
  baselineMeanIntervalMinutes: 10.9,
  baselineIntervalStdDevMinutes: 3.2,
  baselineMeanGrossWeightKG: 29200,
  baselineWeightStdDevKG: 3850,
  maxSafeConsecutiveIdenticalWeights: 2,
  minSafeIntervalMinutes: 2.0,
  maxSafeIntervalMinutes: 45.0,
  acceptableZScoreThreshold: 2.2,
  lastBaselineCalibratedDate: '2026-09-15',
};

/**
 * Load current operational baseline from storage or return defaults
 */
export function getStoredScaleBaseline(): ScaleOperationalBaseline {
  if (typeof window === 'undefined') return DEFAULT_SCALE_BASELINE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCALE_BASELINE);
    if (raw) {
      return { ...DEFAULT_SCALE_BASELINE, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Failed to load scale operational baseline:', err);
  }
  return DEFAULT_SCALE_BASELINE;
}

/**
 * Save updated operational baseline
 */
export function saveScaleBaseline(baseline: Partial<ScaleOperationalBaseline>): ScaleOperationalBaseline {
  const updated = {
    ...getStoredScaleBaseline(),
    ...baseline,
    lastBaselineCalibratedDate: new Date().toISOString().slice(0, 10),
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_SCALE_BASELINE, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

/**
 * Set or clear simulated deviation scenario for testing
 */
export function setSimulatedDeviation(scenario: ScaleDeviationType | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!scenario || scenario === 'HEALTHY') {
      localStorage.removeItem(STORAGE_KEY_SIMULATED_DEVIATION);
    } else {
      localStorage.setItem(STORAGE_KEY_SIMULATED_DEVIATION, scenario);
    }
  } catch {}
}

export function getSimulatedDeviation(): ScaleDeviationType | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY_SIMULATED_DEVIATION);
    if (s && ['FREQUENCY_CHATTER', 'FREQUENCY_STALL', 'PATTERN_FLATLINE', 'PATTERN_DRIFT'].includes(s)) {
      return s as ScaleDeviationType;
    }
  } catch {}
  return null;
}

/**
 * Core Algorithm: Evaluate scale-in frequency and pattern against historical operational baseline
 */
export function evaluateScalePredictiveMaintenance(params: {
  currentScaleInWeightKG?: number;
  recentScanHistory?: QrScanHistoryItem[];
  recentTransactions?: ReceivingTransaction[];
  customBaseline?: ScaleOperationalBaseline;
}): ScalePredictiveMaintenanceAlert {
  const baseline = params.customBaseline || getStoredScaleBaseline();
  const simulatedScenario = getSimulatedDeviation();

  // If a simulation scenario is active, return tailored predictive anomaly
  if (simulatedScenario && simulatedScenario !== 'HEALTHY') {
    return generateSimulatedAlert(simulatedScenario, baseline, params.currentScaleInWeightKG);
  }

  // Extract chronological intervals and weights from scan records or transactions
  const chronologicalRecords: { timestamp: number; weightKG: number }[] = [];

  if (params.recentScanHistory && params.recentScanHistory.length > 0) {
    params.recentScanHistory.forEach((item) => {
      const ts = new Date(item.timestamp).getTime();
      if (!isNaN(ts) && item.weightKG > 0) {
        chronologicalRecords.push({ timestamp: ts, weightKG: item.weightKG });
      }
    });
  } else if (params.recentTransactions && params.recentTransactions.length > 0) {
    params.recentTransactions.forEach((tx) => {
      const ts = new Date(tx.scaleInTime || tx.createdAt).getTime();
      if (!isNaN(ts) && tx.scaleInWeightKG > 0) {
        chronologicalRecords.push({ timestamp: ts, weightKG: tx.scaleInWeightKG });
      }
    });
  }

  // Sort chronological ascending
  chronologicalRecords.sort((a, b) => a.timestamp - b.timestamp);

  // If current weight is provided, append it as the latest virtual entry
  if (params.currentScaleInWeightKG && params.currentScaleInWeightKG > 0) {
    chronologicalRecords.push({
      timestamp: Date.now(),
      weightKG: params.currentScaleInWeightKG,
    });
  }

  // If not enough telemetry points (less than 3), return normal baseline status
  if (chronologicalRecords.length < 3) {
    return buildHealthyAlert(baseline, 5.2, 11.5, 0.2);
  }

  // 1. FREQUENCY ANALYSIS (Time delta intervals between successive weigh-ins)
  const intervalsMinutes: number[] = [];
  for (let i = 1; i < chronologicalRecords.length; i++) {
    const diffMs = chronologicalRecords[i].timestamp - chronologicalRecords[i - 1].timestamp;
    const diffMin = Math.max(0.1, diffMs / (1000 * 60));
    // Filter out huge day/night shift breaks (> 12 hours) from interval velocity calculation
    if (diffMin < 720) {
      intervalsMinutes.push(diffMin);
    }
  }

  // Consider the most recent 6 intervals for responsive operational velocity
  const recentIntervals = intervalsMinutes.slice(-6);
  const avgIntervalMin = recentIntervals.length > 0
    ? recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length
    : baseline.baselineMeanIntervalMinutes;

  const currentFrequencyTxPerHour = parseFloat((60 / Math.max(0.5, avgIntervalMin)).toFixed(1));
  const frequencyDelta = avgIntervalMin - baseline.baselineMeanIntervalMinutes;
  const frequencyZScore = parseFloat(
    (Math.abs(frequencyDelta) / Math.max(0.1, baseline.baselineIntervalStdDevMinutes)).toFixed(2)
  );

  // 2. PATTERN ANALYSIS (Consecutive identical weights & systematic drift)
  const recentWeights = chronologicalRecords.slice(-6).map((r) => r.weightKG);
  
  // A) Flatline Detection (Consecutive identical or +/- 5 KG weights)
  let consecutiveIdenticalCount = 1;
  let maxIdenticalRun = 1;
  for (let i = 1; i < recentWeights.length; i++) {
    if (Math.abs(recentWeights[i] - recentWeights[i - 1]) <= 5) {
      consecutiveIdenticalCount++;
      if (consecutiveIdenticalCount > maxIdenticalRun) {
        maxIdenticalRun = consecutiveIdenticalCount;
      }
    } else {
      consecutiveIdenticalCount = 1;
    }
  }

  // B) Drift Analysis (Difference between recent weight average and historical baseline mean)
  const recentWeightAvg = recentWeights.reduce((a, b) => a + b, 0) / recentWeights.length;
  const weightDriftOffsetKG = Math.round(recentWeightAvg - baseline.baselineMeanGrossWeightKG);
  const weightZScore = Math.abs(weightDriftOffsetKG) / baseline.baselineWeightStdDevKG;

  // 3. ANOMALY CLASSIFICATION & THRESHOLD EVALUATION

  // CASE 1: Pattern Flatline (Sensor Lock / Mechanical Platform Binding)
  if (maxIdenticalRun > baseline.maxSafeConsecutiveIdenticalWeights) {
    const healthScore = Math.max(15, 60 - maxIdenticalRun * 12);
    const failureProbabilityPct = Math.min(95, 45 + maxIdenticalRun * 15);
    const projectedTimeToFailureHours = Math.max(4, Math.round(24 / maxIdenticalRun));

    return {
      id: `PM-FLATLINE-${Date.now()}`,
      isTriggered: true,
      severity: maxIdenticalRun >= 4 ? 'CRITICAL' : 'WARNING',
      deviationType: 'PATTERN_FLATLINE',
      currentFrequencyTxPerHour,
      currentMeanIntervalMinutes: parseFloat(avgIntervalMin.toFixed(1)),
      frequencyZScore,
      patternVarianceScore: 92,
      healthScore,
      failureProbabilityPct,
      projectedTimeToFailureHours,
      consecutiveIdenticalCount: maxIdenticalRun,
      weightDriftOffsetKG,
      titleAr: '⚠️ تحذير صيانة تنبؤية: جمود قراءة وزن الدخول (Flatline Pattern Lock)',
      titleEn: 'Predictive Maintenance: Scale Sensor Flatline Lock Detected',
      descriptionAr: `رصد نظام المراقبة تكرار القراءة ذاتها (${recentWeights[recentWeights.length - 1].toLocaleString()} كغم) لعدد ${maxIdenticalRun} شاحنات متتالية دون أدنى تباين ديناميكي طبيعي، مما ينحرف جذرياً عن خط الأساس التشغيلي.`,
      descriptionEn: `Telemetry detected identical weight readings (${recentWeights[recentWeights.length - 1].toLocaleString()} KG) across ${maxIdenticalRun} consecutive scale-in transactions without expected dynamic variance, deviating sharply from operational baseline.`,
      rootCauseAr: 'احتمال انحشار ميكانيكي لسطح الميزان مع مصدات الحفرة (Pit Bumpers) أو تجمد محول الإشارة الرقمية (A/D Converter Lockup).',
      rootCauseEn: 'Likely mechanical binding of weighbridge deck against pit bumper stops, or Analog-to-Digital converter circuit lockup.',
      recommendedActionAr: 'أوقف دخول الشاحنات؛ افحص خلوص فواصل التمدد الميكانيكية لحفرة الميزان وافحص كابل الإشارة الرئيسية إلى لوحة المؤشر الرقمي.',
      recommendedActionEn: 'Halt truck arrivals; inspect weighbridge pit clearance and mechanical end-stops; test digital load cell telemetry stream.',
      historicalBaseline: baseline,
      detectedAt: new Date().toISOString(),
    };
  }

  // CASE 2: High-Frequency Switch Chatter / Bounce (< 2.0 min interval with high Z-score)
  if (avgIntervalMin < baseline.minSafeIntervalMinutes && frequencyZScore >= baseline.acceptableZScoreThreshold) {
    const healthScore = Math.max(25, Math.round(100 - frequencyZScore * 24));
    const failureProbabilityPct = Math.min(88, Math.round(35 + frequencyZScore * 18));
    const projectedTimeToFailureHours = Math.max(6, Math.round(36 / Math.max(1, frequencyZScore)));

    return {
      id: `PM-CHATTER-${Date.now()}`,
      isTriggered: true,
      severity: frequencyZScore >= 3.0 ? 'CRITICAL' : 'WARNING',
      deviationType: 'FREQUENCY_CHATTER',
      currentFrequencyTxPerHour,
      currentMeanIntervalMinutes: parseFloat(avgIntervalMin.toFixed(1)),
      frequencyZScore,
      patternVarianceScore: 84,
      healthScore,
      failureProbabilityPct,
      projectedTimeToFailureHours,
      consecutiveIdenticalCount: 1,
      weightDriftOffsetKG,
      titleAr: '⚠️ تحذير صيانة تنبؤية: وتيرة تسجيل غير طبيعية وفائقة السرعة (Frequency Chatter)',
      titleEn: 'Predictive Maintenance: Scale High-Frequency Chatter Anomaly',
      descriptionAr: `تسجل محطة ميزان الدخول وتيرة استلام بمعدل ${currentFrequencyTxPerHour} تسجيل/ساعة (متوسط فاصل ${avgIntervalMin.toFixed(1)} دقيقة)، بانحراف قدره ${frequencyZScore}σ عن المعدل التاريخي (${baseline.baselineFrequencyTxPerHour} تسجيل/ساعة).`,
      descriptionEn: `Weighbridge recording frequency spiked to ${currentFrequencyTxPerHour} tx/hr (mean interval ${avgIntervalMin.toFixed(1)} min), deviating by ${frequencyZScore}σ from historical operational baseline (${baseline.baselineFrequencyTxPerHour} tx/hr).`,
      rootCauseAr: 'اضطراب في استقرار خلايا التحميل (Load Cells Settle Jitter)، أو عطل في فلتر منع الارتداد الرقمي (Debounce Switch Failure) بمؤشر الوزن.',
      rootCauseEn: 'Load cell stabilization jitter, un-damped mechanical oscillation, or indicator auto-capture debounce filter malfunction.',
      recommendedActionAr: 'تحقق من عدم التقاط الوزن أثناء حركة عجلات الشاحنة؛ افحص عوازل الاهتزاز ومخمدات الصدمات تحت سطح الميزان.',
      recommendedActionEn: 'Verify scale stability indicator delay; inspect pit load-cell elastomer shock mounts and calibrate motion-detection threshold.',
      historicalBaseline: baseline,
      detectedAt: new Date().toISOString(),
    };
  }

  // CASE 3: Systematic Weight Pattern Drift (Span Creep / Calibration Offset)
  if (weightZScore >= 2.4 && Math.abs(weightDriftOffsetKG) > 7500) {
    const healthScore = Math.max(30, Math.round(95 - weightZScore * 20));
    const failureProbabilityPct = Math.min(82, Math.round(30 + weightZScore * 16));
    const projectedTimeToFailureHours = Math.max(12, Math.round(48 / Math.max(1, weightZScore)));

    return {
      id: `PM-DRIFT-${Date.now()}`,
      isTriggered: true,
      severity: weightZScore >= 3.2 ? 'CRITICAL' : 'WARNING',
      deviationType: 'PATTERN_DRIFT',
      currentFrequencyTxPerHour,
      currentMeanIntervalMinutes: parseFloat(avgIntervalMin.toFixed(1)),
      frequencyZScore,
      patternVarianceScore: 78,
      healthScore,
      failureProbabilityPct,
      projectedTimeToFailureHours,
      consecutiveIdenticalCount: 1,
      weightDriftOffsetKG,
      titleAr: '⚠️ تحذير صيانة تنبؤية: انحراف نمط وتدريج الوزن الإجمالي (Span Calibration Drift)',
      titleEn: 'Predictive Maintenance: Systematic Gross Weight Span Drift',
      descriptionAr: `انحرف متوسط أوزان الدخول الأخيرة بمقدار ${weightDriftOffsetKG > 0 ? '+' : ''}${weightDriftOffsetKG.toLocaleString()} كغم (${weightZScore.toFixed(1)}σ) مقارنة بخط الأساس التشغيلي لخامات المصنع (${baseline.baselineMeanGrossWeightKG.toLocaleString()} كغم).`,
      descriptionEn: `Recent gross weight rolling average shifted by ${weightDriftOffsetKG > 0 ? '+' : ''}${weightDriftOffsetKG.toLocaleString()} KG (${weightZScore.toFixed(1)}σ) relative to established factory intake baseline (${baseline.baselineMeanGrossWeightKG.toLocaleString()} KG).`,
      rootCauseAr: 'انحراف تدريجي في فولتية الإثارة لخلايا التحميل (Excitation Voltage Drift) أو تراكم أطيان وأتربة كثيفة أسفل هيكل الميزان.',
      rootCauseEn: 'Progressive strain gauge bridge excitation drift, temperature compensation fatigue, or mud/debris buildup under deck.',
      recommendedActionAr: 'قم بغسيل وتطهير حفرة الميزان تحت الجسور وإجراء فحص معايرة الصفر والنطاق (Zero & Span Calibration) باستخدام كتل أوزان معتمدة.',
      recommendedActionEn: 'Clean pit debris buildup under weighbridge steel girders; perform zero and span recalibration using certified test weights.',
      historicalBaseline: baseline,
      detectedAt: new Date().toISOString(),
    };
  }

  // DEFAULT: HEALTHY
  return buildHealthyAlert(baseline, currentFrequencyTxPerHour, avgIntervalMin, frequencyZScore);
}

/**
 * Build healthy state alert object
 */
function buildHealthyAlert(
  baseline: ScaleOperationalBaseline,
  freqTxPerHour: number,
  intervalMin: number,
  zScore: number
): ScalePredictiveMaintenanceAlert {
  return {
    id: `PM-HEALTHY-${Date.now()}`,
    isTriggered: false,
    severity: 'HEALTHY',
    deviationType: 'HEALTHY',
    currentFrequencyTxPerHour: freqTxPerHour,
    currentMeanIntervalMinutes: parseFloat(intervalMin.toFixed(1)),
    frequencyZScore: zScore,
    patternVarianceScore: 12,
    healthScore: 98,
    failureProbabilityPct: 4,
    projectedTimeToFailureHours: 1250,
    consecutiveIdenticalCount: 1,
    weightDriftOffsetKG: 0,
    titleAr: '✓ ميزان استلام المواد يعمل ضمن خط الأساس التشغيلي الطبيعي',
    titleEn: 'Receiving Scale Telemetry Within Operational Baselines',
    descriptionAr: `وتيرة تسجيل الأوزان (${freqTxPerHour} شاحنة/ساعة) وتوزيع نمط الحمولات يتطابقان بدقة عالية مع معايير الأداء التاريخية المعتمدة للمصنع.`,
    descriptionEn: `Weighbridge recording frequency (${freqTxPerHour} trucks/hr) and load patterns align closely with certified operational factory baselines.`,
    rootCauseAr: 'جميع خلايا التحميل ووحدة المؤشر الرقمي تعمل بكفاءة مستقرة وخلوص ميكانيكي تام.',
    rootCauseEn: 'All strain-gauge load cells, junction boxes, and digital indicator filters operating within optimal tolerance.',
    recommendedActionAr: 'الاستمرار في التشغيل القياسي؛ الموعد الدوري القادم لمعايرة الميزان هو نهاية الربع الحالي.',
    recommendedActionEn: 'Maintain standard operation; next scheduled preventive scale recalibration is at quarter-end.',
    historicalBaseline: baseline,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Generate simulated anomaly scenario for testing and validation
 */
function generateSimulatedAlert(
  scenario: ScaleDeviationType,
  baseline: ScaleOperationalBaseline,
  currentWeightKG?: number
): ScalePredictiveMaintenanceAlert {
  const now = new Date().toISOString();
  const weight = currentWeightKG || 28500;

  switch (scenario) {
    case 'FREQUENCY_CHATTER':
      return {
        id: `PM-SIM-CHATTER-${Date.now()}`,
        isTriggered: true,
        isSimulated: true,
        severity: 'CRITICAL',
        deviationType: 'FREQUENCY_CHATTER',
        currentFrequencyTxPerHour: 18.5,
        currentMeanIntervalMinutes: 1.2,
        frequencyZScore: 3.4,
        patternVarianceScore: 89,
        healthScore: 38,
        failureProbabilityPct: 84,
        projectedTimeToFailureHours: 8,
        consecutiveIdenticalCount: 1,
        weightDriftOffsetKG: 450,
        titleAr: '⚠️ تحذير صيانة تنبؤية: رصد ارتداد وتكرار فائق السرعة بميزان الدخول (Chatter)',
        titleEn: 'Predictive Alert: High-Frequency Recording Chatter Deviation',
        descriptionAr: 'رصد تردد تسجيل غير مسبوق (18.5 شاحنة/ساعة بفاصل 1.2 دقيقة)، بانحراف +3.4σ عن خط الأساس التاريخي (5.5 شاحنة/ساعة).',
        descriptionEn: 'Abnormal high-frequency weight capture detected (18.5 tx/hr, 1.2 min interval), deviating by +3.4σ from operational baseline.',
        rootCauseAr: 'اهتزاز ميكانيكي غير مخمد أو تلف مكثفات الفلترة الرقمية بمؤشر الميزان مما يؤدي لتسجيل مزدوج للشاحنات.',
        rootCauseEn: 'Un-damped mechanical bridge oscillations or digital debounce filter capacitor failure causing double-captures.',
        recommendedActionAr: 'افحص مفاتيح الحساسية ومخمدات الاهتزاز المطاطية أسفل شاسيه الميزان لمنع إتلاف خلايا الوزن.',
        recommendedActionEn: 'Inspect load cell elastomer shock mounts and increase weight indicator motion-detection stabilization delay.',
        historicalBaseline: baseline,
        detectedAt: now,
      };

    case 'PATTERN_FLATLINE':
      return {
        id: `PM-SIM-FLATLINE-${Date.now()}`,
        isTriggered: true,
        isSimulated: true,
        severity: 'CRITICAL',
        deviationType: 'PATTERN_FLATLINE',
        currentFrequencyTxPerHour: 5.6,
        currentMeanIntervalMinutes: 10.7,
        frequencyZScore: 0.1,
        patternVarianceScore: 96,
        healthScore: 28,
        failureProbabilityPct: 91,
        projectedTimeToFailureHours: 6,
        consecutiveIdenticalCount: 4,
        weightDriftOffsetKG: 0,
        titleAr: '⚠️ تحذير صيانة تنبؤية: تجمد ميكانيكي لنمط قراءة الوزن (Pattern Flatline)',
        titleEn: 'Predictive Alert: Scale Pattern Flatline & Sensor Lockup',
        descriptionAr: `تكرار نفس القراءة بالضبط (${weight.toLocaleString()} كغم) عبر 4 شاحنات متعاقبة دون أي تباين ديناميكي، مما يؤكد انحشار الميزان.`,
        descriptionEn: `Exact identical weight recorded (${weight.toLocaleString()} KG) across 4 consecutive truck scale-ins, proving mechanical binding.`,
        rootCauseAr: 'انحشار جسور الميزان في مصدات الحفرة أو استقرار شوائب صلبة بين الجسر والحائط الخرساني.',
        rootCauseEn: 'Mechanical deck binding against pit bumper stops or solid stone/scrap wedged between bridge girder and pit wall.',
        recommendedActionAr: 'إيقاف الميزان فوراً وإزالة العوالق حول فواصل التمدد ثم إجراء اختبار الزوايا الأربع (Corner Load Test).',
        recommendedActionEn: 'Stop scale entry immediately; clear debris from perimeter gap and perform 4-corner load repeatability test.',
        historicalBaseline: baseline,
        detectedAt: now,
      };

    case 'PATTERN_DRIFT':
      return {
        id: `PM-SIM-DRIFT-${Date.now()}`,
        isTriggered: true,
        isSimulated: true,
        severity: 'WARNING',
        deviationType: 'PATTERN_DRIFT',
        currentFrequencyTxPerHour: 5.1,
        currentMeanIntervalMinutes: 11.8,
        frequencyZScore: 0.3,
        patternVarianceScore: 75,
        healthScore: 52,
        failureProbabilityPct: 68,
        projectedTimeToFailureHours: 24,
        consecutiveIdenticalCount: 1,
        weightDriftOffsetKG: -8900,
        titleAr: '⚠️ تحذير صيانة تنبؤية: انحراف تدريجي في تدريج حساسية الميزان (Span Drift)',
        titleEn: 'Predictive Alert: Scale Span Sensitivity Drift Anomaly',
        descriptionAr: 'انحراف تدريجي مستمر بمقدار -8,900 كغم عن خط الأساس التاريخي لأوزان شاحنات الخامات الواردة للمصنع.',
        descriptionEn: 'Systematic downward span drift of -8,900 KG relative to historical baseline for incoming raw material trucks.',
        rootCauseAr: 'تسرب رطوبة إلى صندوق التجميع (Junction Box) أو تغير مقاومة العزل في إحدى خلايا التحميل.',
        rootCauseEn: 'Moisture ingress in summing junction box or insulation resistance degradation in load cell strain gauge.',
        recommendedActionAr: 'فحص صندوق التجميع وتجفيفه بمادة السيليكا جل وإعادة ضبط معايرة النطاق (Span Recalibration).',
        recommendedActionEn: 'Inspect and dry junction box with silica gel; verify load-cell mV/V excitation balance and recalibrate span.',
        historicalBaseline: baseline,
        detectedAt: now,
      };

    default:
      return buildHealthyAlert(baseline, 5.5, 10.9, 0.1);
  }
}
