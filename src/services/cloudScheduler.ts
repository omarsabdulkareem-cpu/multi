import { FirebaseService } from './firebase';
import { CloudSchedulerConfig, CloudStorageSnapshotRecord } from '../types';

type SchedulerListener = (config: CloudSchedulerConfig) => void;

class CloudSchedulerManager {
  private timer: any = null;
  private isRunningCheck = false;
  private listeners: Set<SchedulerListener> = new Set();
  private cachedConfig: CloudSchedulerConfig | null = null;

  /**
   * Initializes the scheduler background runner
   */
  async start(): Promise<void> {
    if (this.timer) return;

    // Load initial config
    this.cachedConfig = await FirebaseService.getCloudSchedulerConfig();
    this.notifyListeners();

    // Check immediately on startup if a scheduled run was missed
    this.checkAndExecuteDue();

    // Heartbeat check every 60 seconds
    this.timer = setInterval(() => {
      this.checkAndExecuteDue();
    }, 60 * 1000);

    // Listen to custom update events
    if (typeof window !== 'undefined') {
      window.addEventListener('alkarwan:cloud_scheduler_updated', (e: any) => {
        if (e.detail) {
          this.cachedConfig = e.detail;
          this.notifyListeners();
        }
      });
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async getConfig(): Promise<CloudSchedulerConfig> {
    if (!this.cachedConfig) {
      this.cachedConfig = await FirebaseService.getCloudSchedulerConfig();
    }
    return this.cachedConfig;
  }

  async updateConfig(partial: Partial<CloudSchedulerConfig>): Promise<CloudSchedulerConfig> {
    const updated = await FirebaseService.saveCloudSchedulerConfig(partial);
    this.cachedConfig = updated;
    this.notifyListeners();
    return updated;
  }

  subscribe(listener: SchedulerListener): () => void {
    this.listeners.add(listener);
    if (this.cachedConfig) {
      listener(this.cachedConfig);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (this.cachedConfig) {
      this.listeners.forEach((l) => l(this.cachedConfig!));
    }
  }

  /**
   * Evaluates whether the automated daily snapshot is due and triggers it
   */
  async checkAndExecuteDue(): Promise<void> {
    if (this.isRunningCheck) return;
    this.isRunningCheck = true;

    try {
      const config = await this.getConfig();
      if (!config.enabled) return;

      const now = Date.now();
      const nextRunTime = config.nextScheduledRun
        ? new Date(config.nextScheduledRun).getTime()
        : null;

      // Determine if a run is due
      const isDue = nextRunTime ? now >= nextRunTime : false;

      if (isDue && config.lastRunStatus !== 'RUNNING') {
        console.log(
          '[CloudScheduler] Automated daily snapshot is due. Initiating snapshot to Firebase Storage...'
        );
        const res = await FirebaseService.executeScheduledDailySnapshot('AUTOMATED');
        console.log(
          `[CloudScheduler] Daily snapshot automated execution completed: ${res.snapshotRecord.fileName}. Purged ${res.purgedCount} expired files (30-day retention).`
        );
        this.cachedConfig = await FirebaseService.getCloudSchedulerConfig();
        this.notifyListeners();
      }
    } catch (err) {
      console.warn('[CloudScheduler] Automated check/execution encountered an issue:', err);
    } finally {
      this.isRunningCheck = false;
    }
  }

  /**
   * Helper: Formats time remaining until next scheduled run
   */
  getTimeUntilNextRun(nextIsoString: string | null): {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
    formatted: string;
  } {
    if (!nextIsoString) {
      return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, formatted: '--:--' };
    }

    const diff = new Date(nextIsoString).getTime() - Date.now();
    if (diff <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, formatted: 'Due now' };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours,
      minutes,
      seconds,
      totalSeconds,
      formatted: `${hours}h ${minutes}m ${seconds}s`,
    };
  }

  /**
   * Helper: Formats snapshot retention status (Days remaining out of 30)
   */
  getRetentionInfo(snapshot: CloudStorageSnapshotRecord): {
    ageDays: number;
    remainingDays: number;
    isExpired: boolean;
    percentElapsed: number;
    statusLabelAr: string;
    statusLabelEn: string;
    color: 'emerald' | 'amber' | 'rose';
  } {
    const totalDays = snapshot.retentionDays || 30;
    const now = Date.now();
    const createdTime = new Date(snapshot.createdAt).getTime();
    const ageDays = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, totalDays - ageDays);
    const isExpired = ageDays >= totalDays || snapshot.status === 'PURGED';
    const percentElapsed = Math.min(100, Math.round((ageDays / totalDays) * 100));

    let color: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (isExpired) {
      color = 'rose';
    } else if (remainingDays <= 5) {
      color = 'amber';
    }

    return {
      ageDays: Math.floor(ageDays),
      remainingDays: Math.ceil(remainingDays),
      isExpired,
      percentElapsed,
      statusLabelAr: isExpired
        ? 'منتهي الصلاحية (مؤهل للحذف)'
        : `متبقي ${Math.ceil(remainingDays)} يوم للسياسة`,
      statusLabelEn: isExpired
        ? 'Expired (Eligible for Auto-Purge)'
        : `${Math.ceil(remainingDays)} days remaining`,
      color,
    };
  }
}

export const CloudSchedulerService = new CloudSchedulerManager();
