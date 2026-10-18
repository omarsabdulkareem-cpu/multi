/**
 * Weight Anomaly Background Daemon & Sentinel
 * Al-Karwan Plastics Factory - Weighbridge Telemetry & Load Cell Integrity
 *
 * Monitors incoming scan records and scale entries via IndexedDB,
 * identifying suspicious weight jumps, sudden zero-weight drops during
 * high-frequency activity, and sensor dropout anomalies.
 */

import { loadScanHistoryFromIndexedDB } from './scanHistoryIndexedDB';
import { QrScanHistoryItem } from '../components/ReceivingScanHistoryTable';
import { playMaterialWarningAlarm } from './materialAlertService';

export interface WeightAnomalyReport {
  id: string;
  type: 'SUDDEN_ZERO_WEIGHT' | 'EXTREME_WEIGHT_SPIKE' | 'ZERO_WEIGHT_WITH_BAGS' | 'LOAD_CELL_DRIFT';
  severity: 'CRITICAL' | 'WARNING';
  detectedAt: string;
  displayTime: string;
  previousWeightKG: number;
  anomalousWeightKG: number;
  weightDeltaKG: number;
  timeDeltaSeconds?: number;
  itemCode?: string;
  materialName?: string;
  qrCode?: string;
  bagsCount?: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  recommendationAr: string;
  recommendationEn: string;
  acknowledged?: boolean;
}

export type AnomalyListener = (anomalies: WeightAnomalyReport[]) => void;

class WeightAnomalyDaemonService {
  private pollIntervalMs: number = 4000;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<AnomalyListener> = new Set();
  private lastAnalyzedItemCount: number = 0;
  private activeAnomalies: WeightAnomalyReport[] = [];
  private dismissedAnomalyIds: Set<string> = new Set();
  private isRunning: boolean = false;
  private lastHeartbeat: string = '--:--:--';

  /**
   * Start the background monitoring daemon
   */
  public start(options?: { pollIntervalMs?: number; onAnomaly?: AnomalyListener }): void {
    if (this.isRunning) {
      if (options?.onAnomaly) {
        this.subscribe(options.onAnomaly);
      }
      return;
    }

    if (options?.pollIntervalMs) {
      this.pollIntervalMs = options.pollIntervalMs;
    }
    if (options?.onAnomaly) {
      this.subscribe(options.onAnomaly);
    }

    this.isRunning = true;
    this.runCheckCycle();
    this.intervalTimer = setInterval(() => {
      this.runCheckCycle();
    }, this.pollIntervalMs);
  }

  /**
   * Stop the daemon
   */
  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * Register a listener for anomaly updates
   */
  public subscribe(listener: AnomalyListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.getActiveAnomalies());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Dismiss an anomaly report
   */
  public dismissAnomaly(id: string): void {
    this.dismissedAnomalyIds.add(id);
    this.activeAnomalies = this.activeAnomalies.filter((a) => a.id !== id);
    this.notifyListeners();
  }

  /**
   * Clear all active anomalies
   */
  public clearAllAnomalies(): void {
    this.activeAnomalies.forEach((a) => this.dismissedAnomalyIds.add(a.id));
    this.activeAnomalies = [];
    this.notifyListeners();
  }

  /**
   * Get active unacknowledged anomalies
   */
  public getActiveAnomalies(): WeightAnomalyReport[] {
    return this.activeAnomalies.filter((a) => !this.dismissedAnomalyIds.has(a.id));
  }

  /**
   * Get daemon telemetry health
   */
  public getDaemonStatus(): {
    isRunning: boolean;
    lastHeartbeat: string;
    anomaliesCount: number;
    pollIntervalMs: number;
  } {
    return {
      isRunning: this.isRunning,
      lastHeartbeat: this.lastHeartbeat,
      anomaliesCount: this.getActiveAnomalies().length,
      pollIntervalMs: this.pollIntervalMs,
    };
  }

  /**
   * Manually trigger simulation of a sudden zero-weight jump for testing
   */
  public simulateZeroWeightAnomaly(): WeightAnomalyReport {
    const now = new Date();
    const mockAnomaly: WeightAnomalyReport = {
      id: `ANOMALY-SIM-${Date.now()}`,
      type: 'SUDDEN_ZERO_WEIGHT',
      severity: 'CRITICAL',
      detectedAt: now.toISOString(),
      displayTime: now.toLocaleTimeString('en-GB', { hour12: false }),
      previousWeightKG: 28450,
      anomalousWeightKG: 0,
      weightDeltaKG: -28450,
      timeDeltaSeconds: 8,
      itemCode: 'PP-GRN-02',
      materialName: 'بولي بروبيلين حبيبات أبيض نقي',
      qrCode: 'BAG-RCV-TEST-ZERO',
      bagsCount: 20,
      titleAr: '⚠️ رصد انخفاض حاد للوزن إلى صفر كغم (Zero-Weight Drop)',
      titleEn: 'Critical Zero-Weight Drop During High-Frequency Scale Activity',
      descriptionAr:
        'رصد مسبار الميزان هبوطاً مفاجئاً من 28,450 كغم إلى 0 كغم خلال 8 ثوانٍ فقط مع وجود 20 شليف، مما يشير إلى انقطاع إشارة خلية الوزن (Load Cell) أو تصفير قسري غير مقصود.',
      descriptionEn:
        'Weighbridge sensor recorded a sudden plunge from 28,450 KG to 0 KG within 8 seconds while 20 bulk bags are present, indicating potential load-cell signal dropout or unintended tare.',
      recommendationAr:
        'افحص كابلات صندوق التجميع (Junction Box) وخلايا التحميل فوراً وأوقف إدخال الشحنة حتى إعادة المعايرة.',
      recommendationEn:
        'Inspect load-cell junction box wiring and scale bridge zero-point calibration before proceeding.',
    };

    this.activeAnomalies = [mockAnomaly, ...this.activeAnomalies.filter((a) => a.id !== mockAnomaly.id)];
    this.notifyListeners();

    try {
      playMaterialWarningAlarm('QUARANTINED');
    } catch {}

    return mockAnomaly;
  }

  /**
   * Alias for simulating anomaly test
   */
  public simulateAnomalyTest(): WeightAnomalyReport {
    return this.simulateZeroWeightAnomaly();
  }

  /**
   * Main checking loop: reads IndexedDB and inspects chronological weight transitions
   */
  private async runCheckCycle(): Promise<void> {
    try {
      const records = await loadScanHistoryFromIndexedDB();
      this.lastHeartbeat = new Date().toLocaleTimeString('en-GB', { hour12: false });

      if (!records || records.length === 0) {
        return;
      }

      const detected = this.inspectRecordsForAnomalies(records);
      let hasNewAnomaly = false;

      detected.forEach((anomaly) => {
        if (!this.dismissedAnomalyIds.has(anomaly.id)) {
          const exists = this.activeAnomalies.some((a) => a.id === anomaly.id);
          if (!exists) {
            this.activeAnomalies.push(anomaly);
            hasNewAnomaly = true;
          }
        }
      });

      if (hasNewAnomaly) {
        this.notifyListeners();
        try {
          playMaterialWarningAlarm('QUARANTINED');
        } catch {}
      }
    } catch (err) {
      console.warn('[WeightAnomalyDaemon] Check cycle error:', err);
    }
  }

  /**
   * Algorithmic anomaly analysis on chronological scan records
   */
  public inspectRecordsForAnomalies(records: QrScanHistoryItem[]): WeightAnomalyReport[] {
    const anomalies: WeightAnomalyReport[] = [];

    // Chronological order (earliest first, latest last)
    const sorted = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const prevWeight = Number(prev.weightKG) || 0;
      const currWeight = Number(curr.weightKG) || 0;
      const weightDelta = currWeight - prevWeight;

      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      const timeDeltaSec = Math.abs(Math.round((currTime - prevTime) / 1000));

      // Rule 1: Sudden zero-weight entry during active scale frequency
      // If previous entry had substantial load (>= 800 KG) and current drops to 0 or near 0 (<= 10 KG)
      // within high-frequency scale activity (< 20 minutes)
      if (prevWeight >= 800 && currWeight <= 10 && timeDeltaSec <= 1200) {
        const id = `ANOMALY-ZERO-${curr.id}`;
        anomalies.push({
          id,
          type: 'SUDDEN_ZERO_WEIGHT',
          severity: 'CRITICAL',
          detectedAt: curr.timestamp,
          displayTime: curr.displayTime || new Date(curr.timestamp).toLocaleTimeString(),
          previousWeightKG: prevWeight,
          anomalousWeightKG: currWeight,
          weightDeltaKG: weightDelta,
          timeDeltaSeconds: timeDeltaSec,
          itemCode: curr.materialCode,
          materialName: curr.materialName,
          qrCode: curr.qrCode,
          bagsCount: curr.bulkBagsCount,
          titleAr: '⚠️ انخفاض مفاجئ للوزن إلى الصفر أثناء تدفق الميزان النشط',
          titleEn: 'Sudden Zero-Weight Entry During Active Weighbridge Flow',
          descriptionAr: `تم تسجيل وزن (${currWeight} كغم) بعد شحنة سابقة بوزن (${prevWeight.toLocaleString()} كغم) خلال ${Math.round(timeDeltaSec / 60)} دقيقة، مما يشير إلى انقطاع إشارة خلية الوزن أو تصفير خاطئ.`,
          descriptionEn: `Scale registered (${currWeight} KG) following a (${prevWeight.toLocaleString()} KG) delivery within ${Math.round(timeDeltaSec / 60)} mins. Possible load-cell drop or inadvertent zero tare.`,
          recommendationAr: 'تحقق من أسلاك حساسات خلايا التحميل وتأكد من استقرار أرضية الميزان قبل اعتماد الإدخال.',
          recommendationEn: 'Inspect weighbridge load-cell transducer cables and confirm zero balance.',
        });
      }

      // Rule 2: Zero weight with bulk bags count declared
      if (currWeight <= 10 && (curr.bulkBagsCount || 0) >= 1) {
        const id = `ANOMALY-BAGS-ZERO-${curr.id}`;
        anomalies.push({
          id,
          type: 'ZERO_WEIGHT_WITH_BAGS',
          severity: 'CRITICAL',
          detectedAt: curr.timestamp,
          displayTime: curr.displayTime || new Date(curr.timestamp).toLocaleTimeString(),
          previousWeightKG: prevWeight,
          anomalousWeightKG: currWeight,
          weightDeltaKG: weightDelta,
          timeDeltaSeconds: timeDeltaSec,
          itemCode: curr.materialCode,
          materialName: curr.materialName,
          qrCode: curr.qrCode,
          bagsCount: curr.bulkBagsCount,
          titleAr: '⚠️ تسجيل شلايف بوزن صفر كغم (Zero Weight with Bags)',
          titleEn: 'Zero Weight Recorded with Declared Bulk Bags',
          descriptionAr: `تم توثيق ${curr.bulkBagsCount} شليف للمادة (${curr.materialCode}) مع تسجيل وزن 0 كغم، وهو تناقض فيزيائي يتطلب التدقيق الفوري.`,
          descriptionEn: `Declared ${curr.bulkBagsCount} bulk bags for material (${curr.materialCode}) with 0 KG recorded weight. Physical discrepancy detected.`,
          recommendationAr: 'أعد وزن الشحنة على الميزان وتأكد من قراءة المؤشر الرقمي قبل إدخال بطاقة الوزن.',
          recommendationEn: 'Re-weigh the consignment and verify gross weighbridge indicator.',
        });
      }

      // Rule 3: Extreme unrealistic weight spike (> 20,000 KG delta in < 2 mins)
      if (Math.abs(weightDelta) > 20000 && timeDeltaSec <= 120) {
        const id = `ANOMALY-SPIKE-${curr.id}`;
        anomalies.push({
          id,
          type: 'EXTREME_WEIGHT_SPIKE',
          severity: 'WARNING',
          detectedAt: curr.timestamp,
          displayTime: curr.displayTime || new Date(curr.timestamp).toLocaleTimeString(),
          previousWeightKG: prevWeight,
          anomalousWeightKG: currWeight,
          weightDeltaKG: weightDelta,
          timeDeltaSeconds: timeDeltaSec,
          itemCode: curr.materialCode,
          materialName: curr.materialName,
          qrCode: curr.qrCode,
          bagsCount: curr.bulkBagsCount,
          titleAr: '⚡ قفزة وزن غير طبيعية بين معاملتين متتاليتين (Weight Spike)',
          titleEn: 'Suspicious Extreme Weight Jump Detected',
          descriptionAr: `تغير مفاجئ في الوزن بقيمة (${Math.abs(weightDelta).toLocaleString()} كغم) خلال ${timeDeltaSec} ثانية فقط بين شحنتين متتاليتين.`,
          descriptionEn: `Extreme weight fluctuation of (${Math.abs(weightDelta).toLocaleString()} KG) in ${timeDeltaSec} seconds between consecutive events.`,
          recommendationAr: 'تأكد من خروج الشاحنة السابقة بالكامل من فوق منصة الميزان قبل صعود الشاحنة الجديدة.',
          recommendationEn: 'Ensure preceding vehicle has fully vacated weighbridge deck.',
        });
      }
    }

    return anomalies;
  }

  private notifyListeners(): void {
    const active = this.getActiveAnomalies();
    this.listeners.forEach((fn) => {
      try {
        fn(active);
      } catch (e) {
        console.warn('[WeightAnomalyDaemon] Listener notify error:', e);
      }
    });
  }
}

export const weightAnomalyDaemon = new WeightAnomalyDaemonService();
