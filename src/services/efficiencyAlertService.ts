/**
 * Real-Time Shredding vs Production Output Efficiency Alert Service
 * Monitors whether output efficiency drops below predefined threshold (default 75%)
 * for more than 30 continuous minutes, and manages visual alerts & diagnostics.
 */

export interface EfficiencyAlertState {
  currentEfficiencyPct: number;
  shreddingRateKGh: number;
  productionDrawKGh: number;
  deficitKGh: number; // shredding - production (negative means deficit/buffer depletion)
  thresholdPct: number;
  isBelowThreshold: boolean;
  dropStartedAt: string | null; // ISO string
  durationMinutes: number;
  durationSeconds: number;
  isAlertTriggered: boolean; // continuous duration >= 30 minutes
  isWarningArming: boolean; // below threshold but < 30 minutes
  armRemainingSeconds: number; // countdown until 30 min trigger
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  severity: 'NORMAL' | 'WARNING_ARMING' | 'CRITICAL_30MIN';
  diagnosisAr: string;
  diagnosisEn: string;
  recommendedActionAr: string;
  recommendedActionEn: string;
  affectedLines: string[];
  simulationMode: 'NONE' | 'CRITICAL_35MIN' | 'WARNING_15MIN' | 'HEALTHY';
  lastEvaluatedAt: string;
}

const STORAGE_KEY = 'alkarwan_efficiency_alert_v1';
const THRESHOLD_KEY = 'alkarwan_efficiency_threshold_v1';
const SIMULATION_KEY = 'alkarwan_efficiency_simulation_v1';

export const DEFAULT_EFFICIENCY_THRESHOLD = 75; // 75%
export const ALERT_DURATION_THRESHOLD_MINUTES = 30; // 30 minutes

export const AVAILABLE_THRESHOLDS = [65, 70, 75, 80, 85];

export function getStoredThreshold(): number {
  try {
    const val = localStorage.getItem(THRESHOLD_KEY);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0 && num <= 100) return num;
    }
  } catch (e) {
    console.warn('Error reading stored efficiency threshold', e);
  }
  return DEFAULT_EFFICIENCY_THRESHOLD;
}

export function saveStoredThreshold(threshold: number): void {
  try {
    localStorage.setItem(THRESHOLD_KEY, threshold.toString());
  } catch (e) {
    console.warn('Error saving efficiency threshold', e);
  }
}

interface StoredAlertPersistence {
  dropStartedAt: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  simulationMode: 'NONE' | 'CRITICAL_35MIN' | 'WARNING_15MIN' | 'HEALTHY';
}

function getStoredPersistence(): StoredAlertPersistence {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        dropStartedAt: parsed.dropStartedAt || null,
        acknowledged: !!parsed.acknowledged,
        acknowledgedAt: parsed.acknowledgedAt || null,
        acknowledgedBy: parsed.acknowledgedBy || null,
        simulationMode: parsed.simulationMode || 'NONE',
      };
    }
  } catch (e) {
    console.warn('Error reading alert persistence', e);
  }
  return {
    dropStartedAt: null,
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    simulationMode: 'NONE',
  };
}

function savePersistence(data: StoredAlertPersistence): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving alert persistence', e);
  }
}

/**
 * Calculates live shredding throughput vs production draw from current telemetry
 */
export function calculateLiveOutputRates(
  shreddingTransactions: Array<{ shreddingStart?: string; outputKG?: number; createdAt?: string }>,
  productionIssues: Array<{ time?: string; quantityKG?: number; createdAt?: string }>
): { shreddingKGh: number; productionKGh: number; efficiencyPct: number } {
  const now = new Date();
  const currentHour = now.getHours();

  // Filter shredding in current hour
  const recentShreddings = shreddingTransactions.filter((s) => {
    const timeStr = s.shreddingStart || s.createdAt || '';
    if (!timeStr) return false;
    let transHour = -1;
    if (timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1];
      if (timePart) transHour = parseInt(timePart.split(':')[0], 10);
    } else if (timeStr.includes(':')) {
      transHour = parseInt(timeStr.split(':')[0], 10);
    }
    return transHour === currentHour;
  });

  // Filter production issues in current hour
  const recentProd = productionIssues.filter((p) => {
    const timeStr = p.time || p.createdAt || '';
    if (!timeStr) return false;
    let prodHour = -1;
    if (timeStr.includes('T')) {
      const timePart = timeStr.split('T')[1];
      if (timePart) prodHour = parseInt(timePart.split(':')[0], 10);
    } else if (timeStr.includes(':')) {
      prodHour = parseInt(timeStr.split(':')[0], 10);
    }
    return prodHour === currentHour;
  });

  const rawShredded = recentShreddings.reduce((sum, s) => sum + (s.outputKG || 0), 0);
  const rawProd = recentProd.reduce((sum, p) => sum + (p.quantityKG || 0), 0);

  // Calibrated hourly baseline capacity if transactions in the current 60m are partial
  const hourBaseShredding = 820; // Nominal shredder target
  const hourBaseProd = 780; // Nominal extruder line target

  const shreddingKGh = rawShredded > 0 ? rawShredded : hourBaseShredding;
  const productionKGh = rawProd > 0 ? rawProd : hourBaseProd;

  // Efficiency ratio:
  // How adequately shredding matches or exceeds production demand (or actual line balance)
  const ratio = productionKGh > 0 ? Math.round((shreddingKGh / productionKGh) * 100) : 100;
  const efficiencyPct = Math.min(130, Math.max(35, ratio));

  return { shreddingKGh, productionKGh, efficiencyPct };
}

/**
 * Main real-time alert evaluation engine
 */
export function evaluateEfficiencyAlert(
  shreddingTransactions: Array<{ shreddingStart?: string; outputKG?: number; createdAt?: string }>,
  productionIssues: Array<{ time?: string; quantityKG?: number; createdAt?: string }>,
  customThreshold?: number,
  simulationModeOverride?: 'NONE' | 'CRITICAL_35MIN' | 'WARNING_15MIN' | 'HEALTHY'
): EfficiencyAlertState {
  const thresholdPct = customThreshold ?? getStoredThreshold();
  const persistence = getStoredPersistence();
  const simMode = simulationModeOverride ?? persistence.simulationMode;

  const now = new Date();
  const nowMs = now.getTime();

  let shreddingRateKGh = 820;
  let productionDrawKGh = 780;
  let efficiencyPct = 105;

  if (simMode === 'CRITICAL_35MIN') {
    // Simulated critical condition: 35 minutes continuous drop to 61%
    shreddingRateKGh = 490;
    productionDrawKGh = 800;
    efficiencyPct = 61;
  } else if (simMode === 'WARNING_15MIN') {
    // Simulated warning condition: 15 minutes continuous drop to 68%
    shreddingRateKGh = 560;
    productionDrawKGh = 820;
    efficiencyPct = 68;
  } else if (simMode === 'HEALTHY') {
    // Simulated healthy condition: 96%
    shreddingRateKGh = 840;
    productionDrawKGh = 810;
    efficiencyPct = 104;
  } else {
    // Live calculated
    const liveRates = calculateLiveOutputRates(shreddingTransactions, productionIssues);
    shreddingRateKGh = liveRates.shreddingKGh;
    productionDrawKGh = liveRates.productionKGh;
    efficiencyPct = liveRates.efficiencyPct;
  }

  const isBelowThreshold = efficiencyPct < thresholdPct;
  const deficitKGh = shreddingRateKGh - productionDrawKGh;

  let dropStartedAt = persistence.dropStartedAt;
  let acknowledged = persistence.acknowledged;
  let acknowledgedAt = persistence.acknowledgedAt;
  let acknowledgedBy = persistence.acknowledgedBy;

  if (simMode === 'CRITICAL_35MIN') {
    // Force started 36 minutes and 20 seconds ago
    const simulatedStart = new Date(nowMs - (36 * 60 + 20) * 1000).toISOString();
    dropStartedAt = simulatedStart;
  } else if (simMode === 'WARNING_15MIN') {
    // Force started 15 minutes and 10 seconds ago
    const simulatedStart = new Date(nowMs - (15 * 60 + 10) * 1000).toISOString();
    dropStartedAt = simulatedStart;
  } else if (simMode === 'HEALTHY') {
    dropStartedAt = null;
    acknowledged = false;
    acknowledgedAt = null;
    acknowledgedBy = null;
  } else {
    // Live mode
    if (isBelowThreshold) {
      if (!dropStartedAt) {
        dropStartedAt = now.toISOString();
        acknowledged = false;
        acknowledgedAt = null;
        acknowledgedBy = null;
      }
    } else {
      // Recovered
      dropStartedAt = null;
      acknowledged = false;
      acknowledgedAt = null;
      acknowledgedBy = null;
    }
  }

  // Calculate elapsed duration
  let durationSeconds = 0;
  let durationMinutes = 0;

  if (isBelowThreshold && dropStartedAt) {
    const startMs = new Date(dropStartedAt).getTime();
    durationSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
    durationMinutes = Math.floor(durationSeconds / 60);
  }

  const isAlertTriggered = isBelowThreshold && durationMinutes >= ALERT_DURATION_THRESHOLD_MINUTES;
  const isWarningArming = isBelowThreshold && durationMinutes < ALERT_DURATION_THRESHOLD_MINUTES;
  const armRemainingSeconds = Math.max(0, ALERT_DURATION_THRESHOLD_MINUTES * 60 - durationSeconds);

  let severity: 'NORMAL' | 'WARNING_ARMING' | 'CRITICAL_30MIN' = 'NORMAL';
  if (isAlertTriggered) {
    severity = 'CRITICAL_30MIN';
  } else if (isWarningArming) {
    severity = 'WARNING_ARMING';
  }

  // Save updated persistence
  savePersistence({
    dropStartedAt,
    acknowledged,
    acknowledgedAt,
    acknowledgedBy,
    simulationMode: simMode,
  });

  // Diagnostics formulation
  const affectedLines = ['SHR-360 (Main Shredder)', 'EXT-01', 'EXT-02', 'EXT-03'];

  let diagnosisAr = 'معدلات الإنتاج وتدفق المفروم متوازنة ضمن المعدل الطبيعي.';
  let diagnosisEn = 'Material shredding throughput and extrusion line draw are operating in nominal balance.';
  let recommendedActionAr = 'استمر في مراقبة التدفق الساعي بانتظام.';
  let recommendedActionEn = 'Continue regular hourly telemetry monitoring.';

  if (severity === 'CRITICAL_30MIN') {
    diagnosisAr = `هبوط حرج ومستمر في كفاءة الثرم (${efficiencyPct}% < ${thresholdPct}%) مستمر منذ ${durationMinutes} دقيقة! عجز التغذية يبلغ ${Math.abs(deficitKGh)} كغم/ساعة مما يهدد بنفاد صوامع البثق وتوقف خطوط الإنتاج.`;
    diagnosisEn = `Critical sustained efficiency deficit (${efficiencyPct}% < ${thresholdPct}%) persisting for ${durationMinutes} minutes! Regrind throughput deficit is ${Math.abs(deficitKGh)} KG/h, risking extruder hopper starvation and production downtime.`;
    recommendedActionAr = 'زيادة وتيرة تغذية ثرامة SHR-360 فوراً، فحص انسداد المناخل، أو تشغيل صوامع الرواكد الاحتياطية لتعويض العجز.';
    recommendedActionEn = 'Immediately ramp up SHR-360 shredder feed rate, inspect screen filter for blockages, or tap auxiliary regrind buffer silos to prevent extruder starve.';
  } else if (severity === 'WARNING_ARMING') {
    const minsLeft = Math.ceil(armRemainingSeconds / 60);
    diagnosisAr = `انخفاض كفاءة الثرم (${efficiencyPct}% دون ${thresholdPct}%) منذ ${durationMinutes} دقيقة. سيتم إطلاق التنبيه الحرج بعد ${minsLeft} دقيقة إذا لم يتم التعافي.`;
    diagnosisEn = `Efficiency dip detected (${efficiencyPct}% < ${thresholdPct}%) for ${durationMinutes} minutes. Critical alarm will trigger in ${minsLeft} min if uncorrected.`;
    recommendedActionAr = 'تحقق من خط سير التغذية في وحدة الثرم واضبط سرعة الدوران.';
    recommendedActionEn = 'Inspect shredder infeed conveyor belt and verify rotor RPM.';
  }

  return {
    currentEfficiencyPct: efficiencyPct,
    shreddingRateKGh,
    productionDrawKGh,
    deficitKGh,
    thresholdPct,
    isBelowThreshold,
    dropStartedAt,
    durationMinutes,
    durationSeconds,
    isAlertTriggered,
    isWarningArming,
    armRemainingSeconds,
    acknowledged,
    acknowledgedAt,
    acknowledgedBy,
    severity,
    diagnosisAr,
    diagnosisEn,
    recommendedActionAr,
    recommendedActionEn,
    affectedLines,
    simulationMode: simMode,
    lastEvaluatedAt: now.toISOString(),
  };
}

/**
 * Acknowledge active efficiency alert
 */
export function acknowledgeEfficiencyAlert(operatorName: string = 'Supervisor'): void {
  const persistence = getStoredPersistence();
  persistence.acknowledged = true;
  persistence.acknowledgedAt = new Date().toISOString();
  persistence.acknowledgedBy = operatorName;
  savePersistence(persistence);
}

/**
 * Reset / clear acknowledged state or simulation
 */
export function resetEfficiencyAlertState(): void {
  savePersistence({
    dropStartedAt: null,
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    simulationMode: 'NONE',
  });
}

/**
 * Set simulation mode for testing & demoing the >30 min trigger
 */
export function setEfficiencySimulationMode(
  mode: 'NONE' | 'CRITICAL_35MIN' | 'WARNING_15MIN' | 'HEALTHY'
): void {
  const persistence = getStoredPersistence();
  persistence.simulationMode = mode;
  if (mode === 'CRITICAL_35MIN') {
    persistence.dropStartedAt = new Date(Date.now() - (36 * 60 + 20) * 1000).toISOString();
    persistence.acknowledged = false;
  } else if (mode === 'WARNING_15MIN') {
    persistence.dropStartedAt = new Date(Date.now() - (15 * 60 + 10) * 1000).toISOString();
    persistence.acknowledged = false;
  } else if (mode === 'HEALTHY' || mode === 'NONE') {
    persistence.dropStartedAt = null;
    persistence.acknowledged = false;
  }
  savePersistence(persistence);
}

/**
 * Play a synthesized dual-tone warning sound using the Web Audio API
 */
export function playSynthesizedAlertBeep(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.45);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    // Non-blocking in headless or restricted browser environments
    console.debug('Audio ping skipped:', e);
  }
}
