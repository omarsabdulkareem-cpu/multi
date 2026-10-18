import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Database,
  Download,
  Trash2,
  RefreshCw,
  Layers,
  FileJson,
  Boxes,
  ScrollText,
  HardDrive,
  ArrowRight,
  ExternalLink,
  Check,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService, PreFlightCheckSummary } from '../services/firebase';

interface PreFlightCheckCardProps {
  onOpenPreFlightModal: () => void;
  onOpenSnapshotModal: () => void;
  onOpenBulkWipeModal: () => void;
}

export const PreFlightCheckCard: React.FC<PreFlightCheckCardProps> = ({
  onOpenPreFlightModal,
  onOpenSnapshotModal,
  onOpenBulkWipeModal,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser } = useFactory();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<PreFlightCheckSummary | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await FirebaseService.getPreFlightCheckSummary();
      setSummary(data);
    } catch (err) {
      console.warn('Failed to load pre-flight check stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (!summary && !isLoading) return null;

  const hasSnapshot = summary?.preFlightChecklist.hasBackupSnapshot;
  const totalDocs = summary?.totalDocuments || 0;
  const sizeText =
    summary && summary.estimatedTotalSizeKB > 1024
      ? `${summary.estimatedTotalSizeMB} MB`
      : `${summary?.estimatedTotalSizeKB || 0} KB`;

  return (
    <div className="bg-gradient-to-r from-slate-900/90 via-[#0f1115] to-slate-900/80 border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden font-sans">
      {/* Background subtle glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      <div className="relative z-10 space-y-4">
        {/* Card Header & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {isRTL ? 'فحص السلامة قبل التطهير' : 'PRE-FLIGHT CHECK ENGINE'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {isRTL ? 'تحليل الحجم والتبعيات' : 'Data Size & Dependency Gate'}
                </span>
              </div>
              <h3 className="text-base font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
                {isRTL
                  ? 'مؤشرات سلامة البيانات والتبعيات البينية (Pre-Flight Data Audit)'
                  : 'Pre-Flight Data Footprint & Dependency Safeguards'}
              </h3>
            </div>
          </div>

          {/* Health Status Pill */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {isLoading ? (
              <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 font-mono text-xs flex items-center gap-1.5 border border-white/10">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                {isRTL ? 'جاري التدقيق...' : 'Auditing...'}
              </span>
            ) : hasSnapshot ? (
              <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isRTL ? 'تم تأمين النسخة الاحتياطية ✓' : 'PASS: SNAPSHOT SECURED'}
              </span>
            ) : totalDocs === 0 ? (
              <span className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                {isRTL ? 'القاعدة نظيفة 100%' : 'CLEAN SLATE VERIFIED'}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                {isRTL ? 'مطلوب أخذ لقطة قبل المسح' : 'ACTION: BACKUP RECOMMENDED'}
              </span>
            )}

            <button
              type="button"
              onClick={fetchStats}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-white/10"
              title={isRTL ? 'تحديث الفحص اللحظي' : 'Refresh live audit'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Footprint & Dependency Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Total Documents */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-400" />
              {isRTL ? 'إجمالي السجلات:' : 'Total Documents:'}
            </div>
            <div className="text-lg font-mono font-bold text-white mt-1">
              {isLoading ? '...' : totalDocs.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {summary ? `${summary.activeCollectionsCount} ${isRTL ? 'مجموعات نشطة' : 'active collections'}` : '...'}
            </div>
          </div>

          {/* Storage Payload Size */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-amber-400" />
              {isRTL ? 'الحجم التقديري:' : 'Estimated Size:'}
            </div>
            <div className="text-lg font-mono font-bold text-amber-300 mt-1">
              {isLoading ? '...' : sizeText}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {isRTL ? 'JSON خام + فهارس' : 'Raw JSON + indexes'}
            </div>
          </div>

          {/* Operational vs Master Footprint */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <Boxes className="w-3 h-3 text-emerald-400" />
              {isRTL ? 'العمليات والمخزون:' : 'Ops & Ledger:'}
            </div>
            <div className="text-lg font-mono font-bold text-emerald-300 mt-1">
              {isLoading ? '...' : summary?.domainBreakdown.operationalLedgers.count.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {summary?.domainBreakdown.operationalLedgers.sizeKB || 0} KB ({isRTL ? 'أرصدة وحركات' : 'balances & ledger'})
            </div>
          </div>

          {/* Relational Cascade Warning */}
          <div className="bg-black/40 border border-white/5 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <ScrollText className="w-3 h-3 text-purple-400" />
              {isRTL ? 'بيانات الأساس:' : 'Master Records:'}
            </div>
            <div className="text-lg font-mono font-bold text-purple-300 mt-1">
              {isLoading ? '...' : summary?.domainBreakdown.masterData.count.toLocaleString() || 0}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {summary?.domainBreakdown.masterData.sizeKB || 0} KB ({isRTL ? 'مواد وموردين' : 'items & suppliers'})
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-300 leading-relaxed max-w-xl">
            {isRTL
              ? 'يوفر هذا الفحص تقييماً دقيقاً لحجم البيانات وشجرة التبعيات بين المواد والموردين والأرصدة لتفادي فقدان البيانات العرضي وضمان أخذ نسخة احتياطية قبل أي تفريغ.'
              : 'Assesses exact document sizes and dependency cascades (materials → balances → movements) to prevent accidental loss and guarantee pre-wipe backups.'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
            <button
              type="button"
              onClick={onOpenPreFlightModal}
              className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              {isRTL ? 'فحص التبعيات بالتفصيل' : 'View Full Dependency Audit'}
            </button>

            <button
              type="button"
              onClick={onOpenSnapshotModal}
              className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-cyan-700 hover:bg-cyan-600 text-white shadow-md border border-cyan-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-200" />
              {isRTL ? 'تنزيل لقطة (JSON)' : 'Download Snapshot'}
            </button>

            <button
              type="button"
              onClick={onOpenBulkWipeModal}
              className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isRTL ? 'أداة المسح الإداري' : 'Bulk-Wipe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
