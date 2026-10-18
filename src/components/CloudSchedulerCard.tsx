import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Clock,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Play,
  Settings,
  Archive,
  ChevronRight,
  Database,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService } from '../services/firebase';
import { CloudSchedulerService } from '../services/cloudScheduler';
import { CloudSchedulerConfig, CloudStorageSnapshotRecord } from '../types';

interface CloudSchedulerCardProps {
  onOpenSchedulerModal: () => void;
  onOpenSnapshotModal?: () => void;
}

export const CloudSchedulerCard: React.FC<CloudSchedulerCardProps> = ({
  onOpenSchedulerModal,
  onOpenSnapshotModal,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser } = useFactory();

  const [config, setConfig] = useState<CloudSchedulerConfig | null>(null);
  const [snapshots, setSnapshots] = useState<CloudStorageSnapshotRecord[]>([]);
  const [isRunningManual, setIsRunningManual] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Subscribe to scheduler updates
  useEffect(() => {
    CloudSchedulerService.start();
    const unsubscribe = CloudSchedulerService.subscribe((cfg) => {
      setConfig(cfg);
    });

    const loadSnapshots = async () => {
      const snaps = await FirebaseService.getCloudSnapshots();
      setSnapshots(snaps);
    };
    loadSnapshots();

    return () => {
      unsubscribe();
    };
  }, []);

  // Live countdown ticker
  useEffect(() => {
    if (!config?.nextScheduledRun || !config.enabled) {
      setTimeRemaining(isRTL ? 'متوقف مؤقتاً' : 'Paused');
      return;
    }

    const updateCountdown = () => {
      const info = CloudSchedulerService.getTimeUntilNextRun(config.nextScheduledRun);
      if (info.totalSeconds <= 0) {
        setTimeRemaining(isRTL ? 'قيد التنفيذ الآن' : 'Executing now...');
      } else {
        setTimeRemaining(
          isRTL
            ? `${info.hours}س ${info.minutes}د ${info.seconds}ث`
            : `${info.hours}h ${info.minutes}m ${info.seconds}s`
        );
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [config?.nextScheduledRun, config?.enabled, isRTL]);

  const handleRunNow = async () => {
    if (isRunningManual) return;
    setIsRunningManual(true);
    setActionSuccessMsg(null);
    try {
      const res = await FirebaseService.executeScheduledDailySnapshot('MANUAL', {
        name: currentUser?.name || 'Administrator',
        role: currentUser?.role || 'Admin',
      });
      const updated = await FirebaseService.getCloudSnapshots();
      setSnapshots(updated);
      setActionSuccessMsg(
        isRTL
          ? `تم أخذ نسخة وحفظها في Firebase Storage بنجاح (${res.snapshotRecord.payloadSizeKB} KB)`
          : `Snapshot uploaded to Firebase Storage successfully (${res.snapshotRecord.payloadSizeKB} KB)`
      );
      setTimeout(() => setActionSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Failed manual snapshot:', err);
    } finally {
      setIsRunningManual(false);
    }
  };

  const activeSnapshotsCount = snapshots.filter((s) => s.status !== 'PURGED').length;
  const totalStorageKB = snapshots
    .filter((s) => s.status !== 'PURGED')
    .reduce((sum, s) => sum + (s.payloadSizeKB || 0), 0);

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0d131f] to-slate-950 border border-cyan-500/25 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0 shadow-lg shadow-cyan-950/50">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-wide">
                {isRTL
                  ? 'مجدول السحابة الآلي وسياسة الاحتفاظ (Cloud Scheduler & 30-Day Retention)'
                  : 'Automated Cloud Scheduler & 30-Day Retention Policy'}
              </h3>
              {config?.enabled ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isRTL ? 'الجدولة الآلية نشطة' : 'AUTOMATION ACTIVE'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {isRTL ? 'الجدولة متوقفة' : 'AUTOMATION PAUSED'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {isRTL
                ? 'يتم التقاط نسخة احتياطية كاملة (JSON) من قاعدة بيانات Firestore يومياً بشكل مؤتمت وتخزينها في Firebase Storage مع تطبيق سياسة حذف دورية تلقائية بعد 30 يوماً.'
                : 'Automated daily JSON snapshots of all Firestore collections uploaded to Firebase Storage with an enforced 30-day auto-purge retention lifecycle.'}
            </p>
          </div>
        </div>

        {/* Master action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={handleRunNow}
            disabled={isRunningManual}
            className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white shadow-md shadow-cyan-950/60 border border-cyan-400/30 flex items-center gap-2 transition-all cursor-pointer"
            title={isRTL ? 'تشغيل فوري وأخذ لقطة سحابية' : 'Trigger snapshot upload now'}
          >
            {isRunningManual ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-200" />
                {isRTL ? 'جاري الرفع للتخزين...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-cyan-200 fill-cyan-200" />
                {isRTL ? 'أخذ لقطة سحابية الآن' : 'Run Snapshot Now'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSchedulerModal}
            className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            {isRTL ? 'إدارة المجدول والأرشيف' : 'Manage Scheduler'}
          </button>
        </div>
      </div>

      {/* Success banner if trigger executed */}
      {actionSuccessMsg && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Metrics & Automation Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-mono">
        {/* Metric 1: Next Run Countdown */}
        <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {isRTL ? 'النسخة القادمة خلال' : 'Next Backup In'}
          </div>
          <div className="text-sm font-bold text-amber-300 truncate">{timeRemaining}</div>
          <div className="text-[10px] text-slate-400">
            {isRTL ? `الموعد: يومياً ${config?.dailyRunTime || '02:00'}` : `Daily @ ${config?.dailyRunTime || '02:00'}`}
          </div>
        </div>

        {/* Metric 2: Retention Policy */}
        <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {isRTL ? 'سياسة الاحتفاظ' : 'Retention Policy'}
          </div>
          <div className="text-sm font-bold text-emerald-400">
            {config?.retentionDays || 30} {isRTL ? 'يوماً (30-Day Auto)' : 'Days Enforced'}
          </div>
          <div className="text-[10px] text-slate-400">
            {isRTL ? 'حذف دوري للنسخ القديمة' : 'Auto-purge older archives'}
          </div>
        </div>

        {/* Metric 3: Stored Archives in Firebase Storage */}
        <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-cyan-400" />
            {isRTL ? 'النسخ السحابية المحفوظة' : 'Active Snapshots'}
          </div>
          <div className="text-sm font-bold text-cyan-300">
            {activeSnapshotsCount} {isRTL ? 'نسخة نشطة' : 'Snapshots'}
          </div>
          <div className="text-[10px] text-slate-400">
            {totalStorageKB > 1024
              ? `${(totalStorageKB / 1024).toFixed(1)} MB ${isRTL ? 'حجم السحابة' : 'Storage'}`
              : `${Math.round(totalStorageKB)} KB ${isRTL ? 'حجم السحابة' : 'Storage'}`}
          </div>
        </div>

        {/* Metric 4: Firebase Storage Target */}
        <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3 space-y-1">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
            {isRTL ? 'حاوية التخزين السحابي' : 'Storage Bucket'}
          </div>
          <div className="text-xs font-bold text-purple-300 truncate" title="Firebase Storage bucket">
            firebasestorage.app
          </div>
          <div className="text-[10px] text-slate-400 truncate" title="snapshots/daily/YYYY-MM-DD/">
            snapshots/daily/...
          </div>
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>
            {config?.lastRunTimestamp ? (
              <>
                {isRTL ? 'آخر تشغيل للمجدول:' : 'Last automated run:'}{' '}
                <span className="text-slate-200 font-mono">
                  {new Date(config.lastRunTimestamp).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                </span>{' '}
                ({config.lastRunStatus})
              </>
            ) : (
              <span>{isRTL ? 'بانتظار أول تشغيل آلي للمجدول' : 'Awaiting first scheduled execution'}</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenSchedulerModal}
          className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <span>{isRTL ? 'استعراض سجلات الـ 30 يوماً وتعديل الإعدادات' : 'Browse 30-Day Archives & Settings'}</span>
          <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
