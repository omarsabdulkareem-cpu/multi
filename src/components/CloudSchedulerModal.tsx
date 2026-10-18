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
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  FileJson,
  Layers,
  Calendar,
  Activity,
  Check,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService } from '../services/firebase';
import { CloudSchedulerService } from '../services/cloudScheduler';
import {
  CloudSchedulerConfig,
  CloudStorageSnapshotRecord,
  CloudSchedulerHistoryEntry,
} from '../types';

interface CloudSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSnapshotModal?: () => void;
}

export const CloudSchedulerModal: React.FC<CloudSchedulerModalProps> = ({
  isOpen,
  onClose,
  onOpenSnapshotModal,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser } = useFactory();

  const [activeTab, setActiveTab] = useState<'ARCHIVES' | 'RETENTION' | 'HISTORY'>('ARCHIVES');
  const [config, setConfig] = useState<CloudSchedulerConfig | null>(null);
  const [snapshots, setSnapshots] = useState<CloudStorageSnapshotRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecutingNow, setIsExecutingNow] = useState<boolean>(false);
  const [isEnforcingRetention, setIsEnforcingRetention] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Form states for settings
  const [dailyRunTime, setDailyRunTime] = useState<string>('02:00');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSnapshotForDetails, setSelectedSnapshotForDetails] =
    useState<CloudStorageSnapshotRecord | null>(null);

  // Live countdown
  const [countdownText, setCountdownText] = useState<string>('--:--');

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const cfg = await FirebaseService.getCloudSchedulerConfig();
      setConfig(cfg);
      setDailyRunTime(cfg.dailyRunTime || '02:00');

      const snaps = await FirebaseService.getCloudSnapshots();
      setSnapshots(snaps);
    } catch (err) {
      console.warn('Failed to load cloud scheduler data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadAllData();

    const unsubscribe = CloudSchedulerService.subscribe((cfg) => {
      setConfig(cfg);
      if (cfg.dailyRunTime) {
        setDailyRunTime(cfg.dailyRunTime);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Ticker for next run countdown
  useEffect(() => {
    if (!config?.nextScheduledRun || !config.enabled) {
      setCountdownText(isRTL ? 'الجدولة متوقفة مؤقتاً' : 'Automation Paused');
      return;
    }

    const updateTicker = () => {
      const info = CloudSchedulerService.getTimeUntilNextRun(config.nextScheduledRun);
      if (info.totalSeconds <= 0) {
        setCountdownText(isRTL ? 'قيد التنفيذ الآن...' : 'Executing now...');
      } else {
        setCountdownText(
          isRTL
            ? `${info.hours} ساعة و ${info.minutes} دقيقة و ${info.seconds} ثانية`
            : `${info.hours}h ${info.minutes}m ${info.seconds}s`
        );
      }
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [config?.nextScheduledRun, config?.enabled, isRTL]);

  if (!isOpen) return null;

  const handleToggleEnable = async () => {
    if (!config) return;
    const newEnabled = !config.enabled;
    try {
      const updated = await CloudSchedulerService.updateConfig({ enabled: newEnabled });
      setConfig(updated);
      setStatusNotification({
        type: 'info',
        message: isRTL
          ? newEnabled
            ? 'تم تفعيل الجدولة السحابية الآلية اليومية'
            : 'تم إيقاف الجدولة السحابية الآلية مؤقتاً'
          : newEnabled
            ? 'Daily automated cloud scheduler enabled.'
            : 'Daily automated cloud scheduler paused.',
      });
    } catch (err: any) {
      setStatusNotification({ type: 'error', message: err.message || 'Update failed' });
    }
  };

  const handleSaveScheduleTime = async () => {
    if (!dailyRunTime) return;
    setIsSavingSettings(true);
    try {
      const updated = await CloudSchedulerService.updateConfig({ dailyRunTime });
      setConfig(updated);
      setStatusNotification({
        type: 'success',
        message: isRTL
          ? `تم تحديث موعد الجدولة اليومية إلى ${dailyRunTime}`
          : `Daily schedule time updated to ${dailyRunTime}`,
      });
    } catch (err: any) {
      setStatusNotification({ type: 'error', message: err.message || 'Failed to save time' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleExecuteSnapshotNow = async () => {
    if (isExecutingNow) return;
    setIsExecutingNow(true);
    setStatusNotification({
      type: 'info',
      message: isRTL
        ? 'جاري التقاط نسخة كاملة من Firestore ورفعها إلى Firebase Storage...'
        : 'Exporting Firestore collections and uploading to Firebase Storage...',
    });

    try {
      const res = await FirebaseService.executeScheduledDailySnapshot('MANUAL', {
        name: currentUser?.name || 'Administrator',
        role: currentUser?.role || 'Admin',
      });
      const snaps = await FirebaseService.getCloudSnapshots();
      setSnapshots(snaps);
      const cfg = await FirebaseService.getCloudSchedulerConfig();
      setConfig(cfg);

      setStatusNotification({
        type: 'success',
        message: isRTL
          ? `تم بنجاح أخذ نسخة (${res.snapshotRecord.fileName}) بحجم ${res.snapshotRecord.payloadSizeKB} KB وتخزينها في Firebase Storage. تم فحص سياسة الـ 30 يوماً وتطهير ${res.purgedCount} سجل قديم.`
          : `Successfully captured & uploaded ${res.snapshotRecord.fileName} (${res.snapshotRecord.payloadSizeKB} KB) to Firebase Storage. 30-day retention checked (${res.purgedCount} purged).`,
      });
    } catch (err: any) {
      console.error('Snapshot execution error:', err);
      setStatusNotification({
        type: 'error',
        message: err.message || 'Snapshot execution failed.',
      });
    } finally {
      setIsExecutingNow(false);
    }
  };

  const handleEnforceRetentionPolicy = async () => {
    if (isEnforcingRetention) return;
    setIsEnforcingRetention(true);
    setStatusNotification({
      type: 'info',
      message: isRTL
        ? 'جاري مسح وفحص النسخ السحابية التي تجاوزت 30 يوماً لتطهيرها...'
        : 'Scanning and purging stored snapshots older than 30 days...',
    });

    try {
      const result = await FirebaseService.enforceRetentionPolicy(30);
      const snaps = await FirebaseService.getCloudSnapshots();
      setSnapshots(snaps);

      setStatusNotification({
        type: 'success',
        message: isRTL
          ? `اكتمل تطبيق سياسة الاحتفاظ (30-Day Retention): تم حذف ${result.purgedCount} نسخة منتهية الصلاحية وتحرير ${Math.round(result.freedKB)} KB من سحابة التخزين.`
          : `30-Day retention policy enforced: Purged ${result.purgedCount} expired snapshots, freeing ${Math.round(result.freedKB)} KB.`,
      });
    } catch (err: any) {
      setStatusNotification({
        type: 'error',
        message: err.message || 'Retention enforcement failed.',
      });
    } finally {
      setIsEnforcingRetention(false);
    }
  };

  const handleDeleteSnapshot = async (snap: CloudStorageSnapshotRecord) => {
    if (!window.confirm(isRTL ? `هل أنت متأكد من حذف النسخة ${snap.fileName} من Firebase Storage؟` : `Delete ${snap.fileName} from Firebase Storage?`)) {
      return;
    }
    setDeletingId(snap.id);
    try {
      await FirebaseService.deleteCloudSnapshot(snap.id, snap.storagePath);
      setSnapshots((prev) => prev.filter((s) => s.id !== snap.id));
      setStatusNotification({
        type: 'success',
        message: isRTL ? `تم حذف النسخة ${snap.fileName}` : `Deleted ${snap.fileName}`,
      });
    } catch (err: any) {
      setStatusNotification({ type: 'error', message: err.message || 'Failed to delete snapshot' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadSnapshot = (snap: CloudStorageSnapshotRecord) => {
    if (snap.downloadUrl) {
      const link = document.createElement('a');
      link.href = snap.downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = snap.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Fallback if cached in localStorage
    try {
      const cached = localStorage.getItem(`alkarwan_snap_cache_${snap.id}`);
      if (cached) {
        const blob = new Blob([cached], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = snap.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // ignore
    }

    setStatusNotification({
      type: 'info',
      message: isRTL
        ? `الرابط المباشر غير متاح حالياً، مسار الملف في Firebase Storage هو: ${snap.storagePath}`
        : `Direct URL not cached. Storage path: ${snap.storagePath}`,
    });
  };

  const filteredSnapshots = snapshots.filter((snap) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      snap.fileName.toLowerCase().includes(q) ||
      snap.storagePath.toLowerCase().includes(q) ||
      snap.createdAt.includes(q)
    );
  });

  const activeSnapshots = snapshots.filter((s) => s.status !== 'PURGED');
  const totalStorageKB = activeSnapshots.reduce((acc, s) => acc + (s.payloadSizeKB || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#0f1219] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 via-[#121927] to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0 shadow-lg shadow-cyan-950/50">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {isRTL
                    ? 'مجدول السحابة الآلي وسياسة الاحتفاظ بالبيانات'
                    : 'Cloud Automated Scheduler & 30-Day Retention'}
                </h2>
                {config?.enabled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isRTL ? 'الجدولة نشطة' : 'ACTIVE'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    {isRTL ? 'الجدولة متوقفة' : 'PAUSED'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {isRTL
                  ? 'أتمتة يومية لحفظ لقطات Firestore في Firebase Storage مع تطبيق سياسة دورة حياة وحذف تلقائي بعد 30 يوماً.'
                  : 'Automated daily JSON backups stored in Firebase Storage with an enforced 30-day retention lifecycle.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleExecuteSnapshotNow}
              disabled={isExecutingNow}
              className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white shadow-md shadow-cyan-950/60 border border-cyan-400/30 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isExecutingNow ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {isRTL ? 'جاري الرفع...' : 'Executing...'}
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isRTL ? 'أخذ نسخة الآن' : 'Run Snapshot'}
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title={isRTL ? 'إغلاق' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications Bar */}
        {statusNotification && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              statusNotification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : statusNotification.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                  : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : statusNotification.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              )}
              <span>{statusNotification.message}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Schedule & Retention Banner */}
        <div className="bg-[#0b0e14] p-4 sm:p-5 border-b border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          {/* Box 1: Automation Toggle & Time */}
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                {isRTL ? 'موعد التشغيل اليومي' : 'Daily Schedule Time'}
              </span>
              <button
                type="button"
                onClick={handleToggleEnable}
                className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  config?.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                }`}
              >
                {config?.enabled
                  ? isRTL
                    ? 'مفعل (إيقاف)'
                    : 'Active (Pause)'
                  : isRTL
                    ? 'متوقف (تفعيل)'
                    : 'Paused (Enable)'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="time"
                value={dailyRunTime}
                onChange={(e) => setDailyRunTime(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleSaveScheduleTime}
                disabled={isSavingSettings || dailyRunTime === config?.dailyRunTime}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-300 border border-white/10 font-bold cursor-pointer"
              >
                {isSavingSettings ? '...' : isRTL ? 'حفظ' : 'Save'}
              </button>
            </div>
            <div className="text-[10px] text-slate-400">
              {isRTL ? 'المنطقة الزمنية:' : 'Timezone:'} {config?.timezone || 'Local'}
            </div>
          </div>

          {/* Box 2: Live Next Execution Countdown */}
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3.5 space-y-1.5">
            <div className="text-slate-400 font-bold flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-400" />
              {isRTL ? 'العد التنازلي للتشغيل القادم' : 'Next Execution In'}
            </div>
            <div className="text-base font-bold text-amber-300 truncate">{countdownText}</div>
            <div className="text-[10px] text-slate-400">
              {config?.nextScheduledRun ? (
                <>
                  {isRTL ? 'الموعد المحدد:' : 'Target:'}{' '}
                  {new Date(config.nextScheduledRun).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                </>
              ) : (
                '--'
              )}
            </div>
          </div>

          {/* Box 3: 30-Day Retention Policy & Storage Target */}
          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {isRTL ? 'سياسة الـ 30 يوماً' : '30-Day Retention'}
              </span>
              <button
                type="button"
                onClick={handleEnforceRetentionPolicy}
                disabled={isEnforcingRetention}
                className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer font-bold"
                title={isRTL ? 'تطهير النسخ التي تجاوزت 30 يوماً فوراً' : 'Purge files older than 30 days now'}
              >
                {isEnforcingRetention ? '...' : isRTL ? 'تنفيذ الحذف' : 'Enforce Now'}
              </button>
            </div>
            <div className="text-xs text-emerald-300 font-bold">
              {isRTL ? 'دورة حياة 30 يوماً نشطة (Auto-Purge)' : '30-Day Auto-Purge Enforced'}
            </div>
            <div className="text-[10px] text-slate-400 truncate" title="Firebase Storage bucket">
              {isRTL ? 'حاوية التخزين:' : 'Bucket:'} firebasestorage.app
            </div>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-5 border-b border-white/10 bg-[#0d1017]">
          <button
            onClick={() => setActiveTab('ARCHIVES')}
            className={`px-4 py-3 text-xs font-bold font-mono border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'ARCHIVES'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            {isRTL ? 'سجلات التخزين السحابي (30 يوماً)' : 'Cloud Storage Archives (30 Days)'}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {activeSnapshots.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('RETENTION')}
            className={`px-4 py-3 text-xs font-bold font-mono border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'RETENTION'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {isRTL ? 'سياسة الاحتفاظ والبنية السحابية' : '30-Day Retention Policy'}
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-3 text-xs font-bold font-mono border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            {isRTL ? 'سجل التشغيل والأتمتة' : 'Execution Logs'}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {config?.history?.length || 0}
            </span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: ARCHIVES */}
          {activeTab === 'ARCHIVES' && (
            <div className="space-y-4">
              {/* Search & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder={
                    isRTL
                      ? 'بحث في النسخ السحابية بالاسم أو التاريخ...'
                      : 'Search snapshots by filename, date, path...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono w-full sm:w-80 focus:outline-none focus:border-cyan-500"
                />

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span>
                    {isRTL ? 'إجمالي الحجم السحابي:' : 'Total Storage:'}{' '}
                    <strong className="text-cyan-300">
                      {totalStorageKB > 1024
                        ? `${(totalStorageKB / 1024).toFixed(2)} MB`
                        : `${Math.round(totalStorageKB)} KB`}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={loadAllData}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title={isRTL ? 'تحديث السجلات' : 'Refresh'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Snapshots Table / List */}
              {filteredSnapshots.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-white/10 rounded-xl space-y-3">
                  <Archive className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-sm font-bold text-slate-300">
                    {isRTL ? 'لا توجد لقطات سحابية محفوظة حالياً' : 'No cloud snapshots stored yet'}
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {isRTL
                      ? 'يقوم مجدول السحابة بأخذ لقطة يومية تلقائياً، أو يمكنك الضغط على "أخذ نسخة الآن" لإنشاء أول لقطة وحفظها في Firebase Storage.'
                      : 'The automated scheduler runs daily, or you can click "Run Snapshot" above to create and upload the first snapshot to Firebase Storage now.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleExecuteSnapshotNow}
                    disabled={isExecutingNow}
                    className="px-4 py-2 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 text-white inline-flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isRTL ? 'إنشاء أول نسخة في Firebase Storage' : 'Create First Snapshot in Storage'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSnapshots.map((snap) => {
                    const retInfo = CloudSchedulerService.getRetentionInfo(snap);
                    return (
                      <div
                        key={snap.id}
                        className={`bg-slate-900/70 border rounded-xl p-4 transition-all hover:border-cyan-500/40 ${
                          snap.status === 'PURGED'
                            ? 'opacity-60 border-rose-500/20 bg-rose-950/10'
                            : 'border-white/10'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white font-mono flex items-center gap-2">
                                <FileJson className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                {snap.fileName}
                              </span>

                              {snap.autoScheduled ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  {isRTL ? 'مجدول آلياً' : 'AUTOMATED'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {isRTL ? 'يدوي' : 'MANUAL'}
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                  retInfo.color === 'emerald'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : retInfo.color === 'amber'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {isRTL ? retInfo.statusLabelAr : retInfo.statusLabelEn}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 flex-wrap">
                              <span>
                                {isRTL ? 'التاريخ:' : 'Date:'}{' '}
                                <strong className="text-slate-200">
                                  {new Date(snap.createdAt).toLocaleString(
                                    isRTL ? 'ar-EG' : 'en-US'
                                  )}
                                </strong>
                              </span>
                              <span>
                                {isRTL ? 'السجلات:' : 'Records:'}{' '}
                                <strong className="text-amber-300 font-bold">
                                  {snap.totalDocuments}
                                </strong>
                              </span>
                              <span>
                                {isRTL ? 'الحجم:' : 'Size:'}{' '}
                                <strong className="text-emerald-300 font-bold">
                                  {snap.payloadSizeKB} KB
                                </strong>
                              </span>
                              <span className="text-slate-500 truncate max-w-xs" title={snap.storagePath}>
                                {snap.storagePath}
                              </span>
                            </div>

                            {/* 30-Day Retention Progress Bar */}
                            <div className="pt-2 max-w-md">
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                                <span>
                                  {isRTL
                                    ? `العمر: ${retInfo.ageDays} من 30 يوماً`
                                    : `Age: ${retInfo.ageDays} / 30 days`}
                                </span>
                                <span>
                                  {isRTL
                                    ? `متبقي: ${retInfo.remainingDays} يوماً`
                                    : `${retInfo.remainingDays} days left`}
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    retInfo.color === 'emerald'
                                      ? 'bg-emerald-400'
                                      : retInfo.color === 'amber'
                                        ? 'bg-amber-400'
                                        : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, retInfo.percentElapsed)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-start lg:self-center flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedSnapshotForDetails(snap)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Layers className="w-3.5 h-3.5 text-cyan-400" />
                              {isRTL ? 'المحتويات' : 'Inspect'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadSnapshot(snap)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold font-mono bg-cyan-700/80 hover:bg-cyan-600 text-cyan-100 border border-cyan-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {isRTL ? 'تنزيل JSON' : 'Download'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap)}
                              disabled={deletingId === snap.id}
                              className="p-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                              title={isRTL ? 'حذف النسخة من السحابة' : 'Delete snapshot'}
                            >
                              {deletingId === snap.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RETENTION POLICY */}
          {activeTab === 'RETENTION' && (
            <div className="space-y-5 text-xs font-mono text-slate-300 leading-relaxed">
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>
                    {isRTL
                      ? 'سياسة الاحتفاظ الدوري بالبيانات لمدة 30 يوماً (30-Day Lifecycle Retention)'
                      : '30-Day Automated Snapshot Retention Policy Architecture'}
                  </span>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed">
                  {isRTL
                    ? 'لحماية مساحة التخزين السحابية وضمان الامتثال لمعايير حوكمة البيانات في مصنع الكروان، تم تطبيق سياسة احتفاظ بمدة 30 يوماً. يتم تخزين كل لقطة JSON في حاوية Firebase Storage وتعيين تاريخ انتهاء صلاحية دقيق (30 يوماً من لحظة إنشائها).'
                    : 'To maintain optimal cloud storage capacity and uphold industrial governance standards for Al-Karwan Factory, an automated 30-day retention policy is strictly enforced. Each daily JSON export is stored in Firebase Storage with an exact 30-day expiration lifecycle.'}
                </p>

                {/* 3-Step Lifecycle Diagram */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-black/40 border border-cyan-500/30 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      {isRTL ? 'اليوم 1: الالتقاط والأرشفة' : 'Day 1: Ingestion & Upload'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isRTL
                        ? 'التقاط مؤتمت لكافة مجموعات Firestore الـ 19 وضغطها ورفعها إلى مجلد التخزين اليومي.'
                        : 'Daily snapshot captured from all 19 collections and uploaded to Firebase Storage.'}
                    </div>
                  </div>

                  <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      {isRTL ? 'الأيام 1 - 30: الحماية الفورية' : 'Days 1 - 30: High Availability'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isRTL
                        ? 'النسخ متاحة للتنزيل الفوري والاستعادة وإعادة الفحص في أي لحظة مع مراقبة العد التنازلي.'
                        : 'Archives remain instantly downloadable and auditable with live countdown tracking.'}
                    </div>
                  </div>

                  <div className="bg-black/40 border border-amber-500/30 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-amber-400" />
                      {isRTL ? 'اليوم 31+: الحذف والتطهير الآلي' : 'Day 31+: Auto-Purge'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isRTL
                        ? 'محرك الحذف الدوري يتعرف على الملفات المنتهية ويحذفها تلقائياً من Firebase Storage.'
                        : 'Retention engine flags expired archives and automatically purges them from Storage.'}
                    </div>
                  </div>
                </div>

                {/* Storage Diagnostics */}
                <div className="bg-slate-950 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-200">
                    {isRTL ? 'تفاصيل حاوية التخزين السحابي (Cloud Storage Diagnostics):' : 'Cloud Storage Infrastructure Diagnostics:'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                    <div>
                      <div className="text-slate-500">{isRTL ? 'حاوية التخزين' : 'Bucket'}</div>
                      <div className="text-white font-bold truncate">firebasestorage.app</div>
                    </div>
                    <div>
                      <div className="text-slate-500">{isRTL ? 'المسار الجذري' : 'Root Path'}</div>
                      <div className="text-cyan-300 font-bold">/snapshots/daily/</div>
                    </div>
                    <div>
                      <div className="text-slate-500">{isRTL ? 'فترة الاستبقاء' : 'Retention Window'}</div>
                      <div className="text-emerald-400 font-bold">30 Days</div>
                    </div>
                    <div>
                      <div className="text-slate-500">{isRTL ? 'تنسيق الملفات' : 'Data Format'}</div>
                      <div className="text-purple-300 font-bold">JSON (Raw Encoded)</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-400">
                    {isRTL
                      ? 'يمكنك تشغيل التطهير اليدوي الآن لفحص وحذف أي نسخ قديمة متراكمة.'
                      : 'You can trigger a manual retention scan to purge any outdated snapshots immediately.'}
                  </div>
                  <button
                    type="button"
                    onClick={handleEnforceRetentionPolicy}
                    disabled={isEnforcingRetention}
                    className="px-4 py-2 rounded-lg text-xs font-bold font-mono bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    {isEnforcingRetention
                      ? isRTL
                        ? 'جاري التطهير...'
                        : 'Purging...'
                      : isRTL
                        ? 'تطبيق سياسة التطهير الآن'
                        : 'Enforce Retention Purge Now'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXECUTION LOGS */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>
                  {isRTL ? 'سجل تشغيلات المجدول السحابي المؤتمت واليدوي' : 'Automated & Manual Scheduler Execution Audit Log'}
                </span>
                <span className="text-[11px]">
                  {isRTL ? 'أحدث 50 تشغيل' : 'Last 50 executions'}
                </span>
              </div>

              {(!config?.history || config.history.length === 0) ? (
                <div className="p-10 text-center border border-dashed border-white/10 rounded-xl text-slate-500">
                  {isRTL ? 'لا توجد سجلات تشغيل بعد' : 'No execution history recorded yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {config.history.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-slate-900/60 border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              entry.status === 'SUCCESS'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {entry.status}
                          </span>
                          <span className="text-white font-bold">
                            {new Date(entry.timestamp).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs">{entry.message}</p>
                        {entry.storagePath && (
                          <div className="text-[10px] text-slate-500">{entry.storagePath}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                        <div>
                          <span className="text-slate-500">{isRTL ? 'السجلات:' : 'Docs:'} </span>
                          <strong className="text-amber-300">{entry.totalDocuments}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">{isRTL ? 'الحجم:' : 'Size:'} </span>
                          <strong className="text-emerald-300">{entry.payloadSizeKB} KB</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">{isRTL ? 'المحذوف:' : 'Purged:'} </span>
                          <strong className="text-rose-300">{entry.purgedCount}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collection Breakdown Modal if an archive is inspected */}
        {selectedSnapshotForDetails && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="bg-slate-900 border border-cyan-500/40 rounded-xl max-w-xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col font-mono">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  {isRTL ? 'توزيع المجموعات في اللقطة السحابية' : 'Snapshot Collection Breakdown'}
                </div>
                <button
                  onClick={() => setSelectedSnapshotForDetails(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-300">
                <div>
                  <strong>{selectedSnapshotForDetails.fileName}</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  {selectedSnapshotForDetails.storagePath}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs overflow-y-auto max-h-60 pr-1">
                {Object.entries(selectedSnapshotForDetails.collectionCounts || {}).map(
                  ([col, count]) => (
                    <div
                      key={col}
                      className="bg-black/40 border border-white/5 rounded-lg p-2 flex items-center justify-between"
                    >
                      <span className="text-slate-400 truncate">{col}</span>
                      <span className="font-bold text-amber-300">{count}</span>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                <span className="text-slate-400">
                  {isRTL ? 'إجمالي السجلات:' : 'Total Documents:'}{' '}
                  <strong className="text-emerald-400">
                    {selectedSnapshotForDetails.totalDocuments}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleDownloadSnapshot(selectedSnapshotForDetails)}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isRTL ? 'تنزيل JSON' : 'Download JSON'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {isRTL
                ? 'سياسة الـ 30 يوماً مؤتمتة: يتم فحص وحذف اللقطات القديمة دورياً'
                : '30-Day Retention Active: Stored snapshots older than 30 days are automatically purged.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer transition-colors"
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
