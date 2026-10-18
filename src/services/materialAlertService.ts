/**
 * Industrial Material Alert & Quarantine Engine
 * Al-Karwan Plastics Factory - Receiving & Quality Gate Control
 *
 * Provides real-time detection of quarantined, expired, or prohibited materials
 * during QR scanning and warehouse intake, with multi-tone industrial sirens (Web Audio API)
 * and rich metadata inspection.
 */

import { MaterialItem, BulkBag } from '../types';

export type AlertType = 'QUARANTINED' | 'EXPIRED' | 'BOTH' | 'NONE';

export interface MaterialAlertInfo {
  isAlert: boolean;
  type: AlertType;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
  materialId: string;
  materialCode: string;
  materialName: string;
  materialNameAr: string;
  materialNameEn: string;
  status: string;
  reason: string;
  reasonAr: string;
  expiryDate?: string;
  quarantineDate?: string;
  flaggedBy?: string;
  quarantineBay: string;
  quarantineBayAr: string;
  directiveAr: string;
  directiveEn: string;
  timestamp: string;
  scannedCode: string;
}

// Global state for sound mute
let isAudioMuted = false;
let activeOscillators: OscillatorNode[] = [];
let audioContextInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContextInstance || audioContextInstance.state === 'closed') {
      audioContextInstance = new AudioCtx();
    }
    if (audioContextInstance.state === 'suspended') {
      audioContextInstance.resume().catch(() => {});
    }
    return audioContextInstance;
  } catch (err) {
    console.debug('[MaterialAlertEngine] AudioContext init error:', err);
    return null;
  }
}

/**
 * Check if a scanned QR code, material ID, or batch string corresponds to a
 * material or bag that is flagged as quarantined or expired in the database.
 */
export function checkMaterialAlertStatus(
  scannedText: string,
  materials: MaterialItem[],
  bulkBags: BulkBag[] = []
): MaterialAlertInfo | null {
  if (!scannedText || !materials || materials.length === 0) return null;

  const rawClean = scannedText.trim();
  const rawUpper = rawClean.toUpperCase();
  const rawLower = rawClean.toLowerCase();

  // 1. Try to find matching material by ID, code, or alias
  let matchedMaterial: MaterialItem | undefined = materials.find((m) => {
    if (m.id.toUpperCase() === rawUpper) return true;
    if (m.code.toUpperCase() === rawUpper) return true;
    if (rawUpper.includes(m.id.toUpperCase())) return true;
    if (rawUpper.includes(m.code.toUpperCase())) return true;
    if (m.aliases && m.aliases.some((a) => rawLower.includes(a.toLowerCase()))) return true;
    if (m.nameAr && rawClean.includes(m.nameAr)) return true;
    return false;
  });

  // 2. Also check if a bulk bag was scanned with specific quarantine status
  const matchedBag = bulkBags.find(
    (b) =>
      b.bagNumber?.toUpperCase() === rawUpper ||
      b.id?.toUpperCase() === rawUpper ||
      (b.qrPayload && b.qrPayload.toUpperCase().includes(rawUpper))
  );

  if (!matchedMaterial && matchedBag?.materialId) {
    matchedMaterial = materials.find((m) => m.id === matchedBag.materialId);
  }

  // Fallback checks for explicit QR keywords (e.g. QR tags formatted as MAT-008, PP-REC-Q8, EXP-...)
  if (!matchedMaterial) {
    if (rawUpper.includes('MAT-008') || rawUpper.includes('PP-REC-Q8') || rawUpper.includes('QUARANTINE')) {
      matchedMaterial = materials.find((m) => m.id === 'MAT-008' || m.code === 'PP-REC-Q8');
    } else if (rawUpper.includes('MAT-009') || rawUpper.includes('PET-EXP-09') || rawUpper.includes('EXPIRED')) {
      matchedMaterial = materials.find((m) => m.id === 'MAT-009' || m.code === 'PET-EXP-09');
    }
  }

  if (!matchedMaterial) return null;

  // Determine Quarantine Status
  const isQuarantined =
    matchedMaterial.isQuarantined === true ||
    matchedMaterial.status === 'QUARANTINED' ||
    matchedMaterial.disposition === 'QUARANTINE' ||
    matchedMaterial.disposition === 'QUARANTINED' ||
    matchedBag?.status === 'QUARANTINED' ||
    rawUpper.includes('QUARANTINED') ||
    rawClean.includes('محجور');

  // Determine Expired Status
  let isExpired =
    matchedMaterial.isExpired === true ||
    matchedMaterial.status === 'EXPIRED' ||
    (matchedBag?.status as string) === 'EXPIRED' ||
    rawUpper.includes('EXPIRED') ||
    rawClean.includes('منتهي الصلاحية');

  // Also check if expiryDate is set and past current date
  if (!isExpired && matchedMaterial.expiryDate) {
    try {
      const exp = new Date(matchedMaterial.expiryDate).getTime();
      const now = Date.now();
      if (!isNaN(exp) && exp < now) {
        isExpired = true;
      }
    } catch {
      // ignore date parse issues
    }
  }

  if (!isQuarantined && !isExpired) {
    return null;
  }

  let type: AlertType = 'QUARANTINED';
  if (isQuarantined && isExpired) {
    type = 'BOTH';
  } else if (isExpired) {
    type = 'EXPIRED';
  }

  const reasonAr =
    matchedMaterial.quarantineReason ||
    (type === 'EXPIRED'
      ? `انتهاء فترة الصلاحية الفنية للتشغيل بتاريخ ${matchedMaterial.expiryDate || 'سابق'}`
      : 'حجز فحص الجودة المخبري: وجود تلوث لوني أو شوائب غير مطابقة للمواصفات القياسية');

  const reasonEn =
    type === 'EXPIRED'
      ? `Material exceeded manufacturer expiry period on ${matchedMaterial.expiryDate || 'past date'}`
      : 'Quarantined by Quality Control: Non-conforming impurities or pending lab assay';

  return {
    isAlert: true,
    type,
    severity: 'CRITICAL',
    materialId: matchedMaterial.id,
    materialCode: matchedMaterial.code,
    materialName: matchedMaterial.nameAr || matchedMaterial.nameEn,
    materialNameAr: matchedMaterial.nameAr,
    materialNameEn: matchedMaterial.nameEn,
    status: matchedMaterial.status || (type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED'),
    reason: reasonEn,
    reasonAr,
    expiryDate: matchedMaterial.expiryDate,
    quarantineDate: matchedMaterial.quarantineDate || new Date().toISOString().split('T')[0],
    flaggedBy: matchedMaterial.flaggedBy || 'مختبر مراقبة وضبط الجودة (QC Lab)',
    quarantineBay: 'Isolation Yard Bay Z-09 (Pre-sort Quarantine)',
    quarantineBayAr: 'ساحة العزل والحجر المؤقت - رصيف Z-09',
    directiveAr:
      type === 'EXPIRED'
        ? '⛔ يُمنع تفريغ الشحنة في صوامع الإنتاج لتجنب تلف المنتجات النهائية! حجز الشاحنة وتوجيهها للمعاينة.'
        : '⛔ يُحظر تفريغ المادة في المستودع العام أو خطوط التغذية! توجيه الشحنة فوراً لساحة الحجر Z-09 لحين صدور تقرير مخبري.',
    directiveEn:
      type === 'EXPIRED'
        ? '⛔ Prohibited from silos intake! Material is expired; quarantine truck for salvage or disposal inspection.'
        : '⛔ Prohibited from production feed! Divert shipment immediately to Quarantine Bay Z-09 awaiting lab clearance.',
    timestamp: new Date().toISOString(),
    scannedCode: rawClean,
  };
}

/**
 * Play high-urgency multi-tone industrial alarm / siren
 * Alternates frequencies in rapid succession to ensure auditory detection
 * on noisy factory floors, coupled with haptic vibrations on mobile.
 */
export function playMaterialWarningAlarm(type: 'QUARANTINED' | 'EXPIRED' | 'CRITICAL' = 'QUARANTINED'): void {
  if (isAudioMuted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    stopMaterialWarningAlarm();

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, now);
    masterGain.connect(ctx.destination);

    // Vibration alert on mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([350, 100, 350, 100, 500]);
      } catch {
        // vibration unsupported or blocked
      }
    }

    if (type === 'EXPIRED') {
      // Urgent Descending Tri-Tone Alarm (850Hz -> 620Hz -> 420Hz) in 3 rapid cycles
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';

      const cycleLen = 0.28;
      for (let i = 0; i < 3; i++) {
        const start = now + i * cycleLen;
        osc.frequency.setValueAtTime(850, start);
        osc.frequency.linearRampToValueAtTime(620, start + 0.09);
        osc.frequency.linearRampToValueAtTime(420, start + 0.18);
        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + cycleLen - 0.02);
      }

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 3 * cycleLen);
      activeOscillators.push(osc);
    } else {
      // European Industrial Dual-Tone Alternating Siren (880Hz & 587Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const toneGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      // 4 cycles of alternating warble
      const step = 0.16;
      const totalSteps = 6;
      for (let i = 0; i < totalSteps; i++) {
        const t = now + i * step;
        const freq = i % 2 === 0 ? 880 : 587; // A5 / D5
        osc1.frequency.setValueAtTime(freq, t);
        osc2.frequency.setValueAtTime(freq / 2, t); // Sub-octave for heavy presence
      }

      toneGain.gain.setValueAtTime(0.32, now);
      toneGain.gain.exponentialRampToValueAtTime(0.005, now + totalSteps * step);

      osc1.connect(toneGain);
      osc2.connect(toneGain);
      toneGain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + totalSteps * step);
      osc2.stop(now + totalSteps * step);

      activeOscillators.push(osc1, osc2);
    }
  } catch (err) {
    console.debug('[MaterialAlertEngine] Siren playback error:', err);
  }
}

/**
 * Stop any ongoing alarm oscillators immediately.
 */
export function stopMaterialWarningAlarm(): void {
  try {
    activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // already stopped
      }
    });
    activeOscillators = [];
  } catch (e) {
    console.debug('Error stopping alarm:', e);
  }
}

export function setAlertAudioMuted(muted: boolean): void {
  isAudioMuted = muted;
  if (muted) {
    stopMaterialWarningAlarm();
  }
}

export function getIsAlertAudioMuted(): boolean {
  return isAudioMuted;
}
