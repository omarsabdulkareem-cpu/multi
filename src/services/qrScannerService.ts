import jsQR from 'jsqr';

export interface ParsedScannedBag {
  type: 'BAG' | 'LOCATION' | 'UNKNOWN';
  rawText: string;
  bagId?: string;
  materialName?: string;
  materialCode?: string;
  weightKG?: number;
  locationCode?: string;
  transactionNumber?: string;
  batchNumber?: string;
  date?: string;
}

/**
 * Parses raw QR code string data from bulk bag tags, location labels, or legacy barcodes.
 */
export function parseScannedQrData(raw: string): ParsedScannedBag {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return { type: 'UNKNOWN', rawText: raw };
  }

  // Check if it's a location code (e.g. LOC-A01, LOC-A-01, LOC-REC-01, LOC-THM01)
  if (/^LOC-[A-Z0-9_-]+$/i.test(trimmed)) {
    return {
      type: 'LOCATION',
      rawText: trimmed,
      locationCode: trimmed.toUpperCase(),
    };
  }

  // Try parsing JSON format used in Al-Karwan Bulk Bag Labels
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const data = JSON.parse(trimmed);

      // Check if location JSON: { type: 'LOCATION', loc: 'LOC-A01' }
      if (data.type === 'LOCATION' || (data.loc && !data.bag_id && !data.bagId && !data.mat)) {
        return {
          type: 'LOCATION',
          rawText: trimmed,
          locationCode: (data.loc || data.locationCode || data.code || '').toUpperCase(),
        };
      }

      // Bulk bag payload
      const bagId = data.bag_id || data.bagId || data.id || data.bagNumber || data.code;
      const weightKG = Number(data.net_kg ?? data.weight_kg ?? data.weightKG ?? data.weight ?? data.netKG);

      return {
        type: 'BAG',
        rawText: trimmed,
        bagId: bagId ? String(bagId).trim().toUpperCase() : undefined,
        materialName: data.mat || data.material_name || data.materialName || data.name,
        materialCode: data.mat_code || data.material_code || data.materialCode || data.code,
        weightKG: isNaN(weightKG) ? undefined : weightKG,
        locationCode: data.loc || data.location_code || data.locationCode,
        transactionNumber: data.tx || data.transaction_number || data.transactionNumber,
        batchNumber: data.batch || data.batchNumber || data.lot,
        date: data.dt || data.date,
      };
    } catch {
      // Not valid JSON, proceed to regex / string matching
    }
  }

  // Check URL format (e.g., https://factory.karwan.com/bag/SHL-000001 or ?bag=SHL-000001)
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const bagParam = url.searchParams.get('bag') || url.searchParams.get('id') || url.pathname.split('/').pop();
      if (bagParam && (bagParam.startsWith('SHL-') || bagParam.startsWith('BAG-'))) {
        return {
          type: 'BAG',
          rawText: trimmed,
          bagId: bagParam.toUpperCase(),
        };
      }
    }
  } catch {
    // Ignore URL parse errors
  }

  // Plain bag identifier format (e.g., SHL-000001, BAG-2026-001, BAG-09142, RCV-2026-0840)
  if (/^(SHL|BAG|RCV|THM|LOT)-[A-Z0-9_-]+/i.test(trimmed)) {
    return {
      type: 'BAG',
      rawText: trimmed,
      bagId: trimmed.toUpperCase(),
    };
  }

  return {
    type: 'BAG',
    rawText: trimmed,
    bagId: trimmed.toUpperCase(),
  };
}

/**
 * Browser Web Audio API sound synthesizer for immediate tactile auditory feedback.
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(784, now); // G5
    osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.08); // C6

    osc2.frequency.setValueAtTime(1046.5, now);
    osc2.frequency.exponentialRampToValueAtTime(1567.98, now + 0.12); // G6

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.22);
    osc2.stop(now + 0.22);

    if (navigator.vibrate) {
      navigator.vibrate(60);
    }
  } catch (err) {
    console.debug('Audio chime error:', err);
  }
}

export function playAlertChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(260, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.3);

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  } catch (err) {
    console.debug('Audio alert error:', err);
  }
}

export function playLocationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.12); // G5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);

    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
  } catch (err) {
    console.debug('Audio chime error:', err);
  }
}

/**
 * Scans a video element for QR code using native BarcodeDetector if available,
 * or jsQR via an offscreen canvas fallback.
 */
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

export async function detectQrCodeFromVideo(video: HTMLVideoElement): Promise<string | null> {
  if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  // 1. Try native BarcodeDetector API if supported (fastest, hardware accelerated)
  const windowWithBarcode = window as unknown as {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    };
  };

  if (windowWithBarcode.BarcodeDetector) {
    try {
      const detector = new windowWithBarcode.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] });
      const barcodes = await detector.detect(video);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch {
      // Fallback to jsQR below
    }
  }

  // 2. Universal jsQR canvas fallback
  try {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!offscreenCanvas) {
      offscreenCanvas = document.createElement('canvas');
    }
    // Downscale slightly for high frame rate performance if resolution is huge (e.g. 4K)
    const scale = width > 1280 ? 1280 / width : 1;
    const targetW = Math.floor(width * scale);
    const targetH = Math.floor(height * scale);

    if (offscreenCanvas.width !== targetW || offscreenCanvas.height !== targetH) {
      offscreenCanvas.width = targetW;
      offscreenCanvas.height = targetH;
      offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (!offscreenCtx) {
      offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    if (offscreenCtx) {
      offscreenCtx.drawImage(video, 0, 0, targetW, targetH);
      const imgData = offscreenCtx.getImageData(0, 0, targetW, targetH);
      const code = jsQR(imgData.data, targetW, targetH, {
        inversionAttempts: 'dontInvert',
      });
      if (code && code.data) {
        return code.data;
      }
    }
  } catch (err) {
    console.debug('jsQR scan frame error:', err);
  }

  return null;
}

/**
 * Scans an uploaded image file for QR code using jsQR.
 */
export async function detectQrFromImageFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imgData.data, img.width, img.height, {
          inversionAttempts: 'attemptBoth',
        });
        resolve(code ? code.data : null);
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
