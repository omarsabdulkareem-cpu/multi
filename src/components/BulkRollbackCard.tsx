import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Database,
  RefreshCw,
  HardDrive,
  FileJson,
  Clock,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService } from '../services/firebase';
import { CloudStorageSnapshotRecord } from '../types';

interface BulkRollbackCardProps {
  onOpenRollbackModal: (record?: CloudStorageSnapshotRecord) => void;
  onOpenSnapshotModal: () => void;
}

export const BulkRollbackCard: React.FC<BulkRollbackCardProps> = ({
  onOpenRollbackModal,
  onOpenSnapshotModal,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser } = useFactory();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [latestSnapshot, setLatestSnapshot] = useState<CloudStorageSnapshotRecord | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date>(new Date());

  const fetchLatestPreWipe = async () => {
    setIsLoading(true);
    try {
      const snap = await FirebaseService.getLatestPreWipeSnapshot();
      setLatestSnapshot(snap);
      setLastCheckedTime(new Date());
    } catch (err) {
      console.warn('Could not fetch latest pre-wipe snapshot:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestPreWipe();
  }, []);

  const hasPreWipe = Boolean(latestSnapshot);

  return (
    <div className="bg-gradient-to-r from-violet-950/40 via-[#0f1117] to-slate-900/80 border border-violet-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-violet-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 space-y-4">
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/40">
                  {isRTL ? 'استرجاع الكوارث (DISASTER RECOVERY)' : 'BULK ROLLBACK ENGINE'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Firebase Storage
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
                {isRTL
                  ? 'استعادة لقطة ما قبل المسح (Pre-Wipe Rollback)'
                  : 'Pre-Wipe Bulk Rollback & Snapshot Restoration'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLatestPreWipe}
              disabled={isLoading}
              title={isRTL ? 'تحديث الفحص' : 'Refresh Snapshot'}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
            </button>

            {hasPreWipe ? (
              <button
                type="button"
                onClick={() => onOpenRollbackModal(latestSnapshot || undefined)}
                className="px-4 py-2 rounded-xl text-xs font-bold font-mono bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-950/60 flex items-center gap-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isRTL ? 'استرجاع فوري للقطة (Rollback)' : 'Restore Snapshot'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSnapshotModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-violet-400" />
                {isRTL ? 'أخذ لقطة أمان الآن' : 'Create Snapshot Now'}
              </button>
            )}
          </div>
        </div>

        {/* Snapshot Details or Empty State */}
        {isLoading ? (
          <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
            {isRTL ? 'جاري التحقق من وجود لقطات ما قبل المسح في Firebase Storage...' : 'Scanning Firebase Storage for pre-wipe safety snapshots...'}
          </div>
        ) : hasPreWipe && latestSnapshot ? (
          <div className="bg-black/40 border border-violet-500/25 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-white truncate">
                  {latestSnapshot.fileName}
                </span>
                {latestSnapshot.isPreWipe && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    PRE_WIPE
                  </span>
                )}
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-500" />
                {new Date(latestSnapshot.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2">
                <div className="text-slate-400">{isRTL ? 'السجلات المؤرشفة:' : 'Archived Docs:'}</div>
                <div className="text-violet-300 font-bold text-sm mt-0.5">
                  {(latestSnapshot.totalDocuments || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2">
                <div className="text-slate-400">{isRTL ? 'حالة التخزين:' : 'Storage State:'}</div>
                <div className="text-emerald-300 font-bold text-sm mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {latestSnapshot.status || 'ACTIVE'}
                </div>
              </div>
              <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2">
                <div className="text-slate-400">{isRTL ? 'حجم الملف:' : 'Size:'}</div>
                <div className="text-amber-300 font-bold text-sm mt-0.5">
                  {latestSnapshot.fileSizeBytes
                    ? `${Math.round(latestSnapshot.fileSizeBytes / 1024)} KB`
                    : 'Ready'}
                </div>
              </div>
              <div className="bg-slate-900/60 border border-white/5 rounded-lg p-2">
                <div className="text-slate-400">{isRTL ? 'مسار السحابة:' : 'Cloud Path:'}</div>
                <div className="text-slate-300 truncate text-[10px] mt-1" title={latestSnapshot.storagePath}>
                  {latestSnapshot.storagePath}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 flex items-center justify-between pt-1">
              <span>
                {isRTL
                  ? 'النسخة محفوظة وجاهزة للاسترجاع الفوري التام في حال حدث أي مسح غير مقصود.'
                  : 'Safety snapshot is verified and ready for instant full rollback if an accidental wipe occurs.'}
              </span>
              <button
                type="button"
                onClick={() => onOpenRollbackModal(latestSnapshot)}
                className="text-violet-400 hover:text-violet-300 font-mono font-bold flex items-center gap-1 text-xs hover:underline cursor-pointer"
              >
                {isRTL ? 'معاينة واسترجاع' : 'Inspect & Restore'}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-black/30 border border-white/5 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-300">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-slate-200 font-bold">
                {isRTL
                  ? 'لم يتم تسجيل لقطة أمان ما قبل المسح حتى الآن'
                  : 'No Pre-Wipe Snapshot Recorded Yet'}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {isRTL
                  ? 'عند تشغيل أداة تفريغ السحابة (Bulk-Wipe)، يقوم النظام تلقائياً بإنشاء لقطة أمان ورفعها إلى Firebase Storage. يمكنك أيضاً توليد لقطة يدوية في أي وقت لضمان إمكانية الاسترجاع الفوري.'
                  : 'When launching the Bulk-Wipe utility, the system automatically captures a pre-wipe safety snapshot and uploads it to Firebase Storage. You can also generate one manually anytime.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
