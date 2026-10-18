import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Database,
  Download,
  Trash2,
  RefreshCw,
  X,
  FileJson,
  Layers,
  ArrowRight,
  CheckCircle2,
  Boxes,
  ScrollText,
  Building2,
  Clock,
  HardDrive,
  Info,
  Check,
  AlertOctagon,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  FirebaseService,
  PreFlightCheckSummary,
  DependencyImpactItem,
} from '../services/firebase';

interface PreFlightCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToBulkWipe?: () => void;
  onOpenSnapshotModal?: () => void;
}

export const PreFlightCheckModal: React.FC<PreFlightCheckModalProps> = ({
  isOpen,
  onClose,
  onProceedToBulkWipe,
  onOpenSnapshotModal,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser } = useFactory();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<PreFlightCheckSummary | null>(null);
  const [isDownloadingSnapshot, setIsDownloadingSnapshot] = useState<boolean>(false);
  const [hasJustDownloaded, setHasJustDownloaded] = useState<boolean>(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'ALL' | 'master' | 'operations' | 'governance'>('ALL');
  const [expandedDependencyId, setExpandedDependencyId] = useState<string | null>(null);

  // Load summary
  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const data = await FirebaseService.getPreFlightCheckSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load pre-flight check summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle instant snapshot download
  const handleQuickDownloadSnapshot = async () => {
    setIsDownloadingSnapshot(true);
    try {
      const snapshot = await FirebaseService.createDatabaseSnapshot({
        name: currentUser.nameAr || currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      });
      FirebaseService.downloadSnapshotJSON(snapshot);
      setHasJustDownloaded(true);
      // Reload summary to reflect updated checklist
      await loadSummary();
    } catch (err) {
      console.error('Failed to download safety snapshot:', err);
    } finally {
      setIsDownloadingSnapshot(false);
    }
  };

  const filteredDependencies =
    summary?.dependencies.filter((d) =>
      selectedCategoryFilter === 'ALL' ? true : d.category === selectedCategoryFilter
    ) || [];

  const getRiskBadge = (risk: DependencyImpactItem['riskLevel']) => {
    switch (risk) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            {isRTL ? 'حرج جداً' : 'CRITICAL'}
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            {isRTL ? 'عالي الخطورة' : 'HIGH RISK'}
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
            {isRTL ? 'متوسط' : 'MEDIUM'}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40">
            {isRTL ? 'منخفض' : 'LOW'}
          </span>
        );
    }
  };

  const hasSnapshotSecured =
    summary?.preFlightChecklist.hasBackupSnapshot || hasJustDownloaded;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0f1115] border border-amber-500/30 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl relative my-8 font-sans">
        {/* Top Aviation-Style Header */}
        <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-[#0f1115] border-b border-amber-500/20 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                  {isRTL ? 'فحص الجاهزية قبل التطهير (PRE-FLIGHT CHECK)' : 'PRE-FLIGHT DATA & DEPENDENCY CHECK'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentUser.email || currentUser.badgeNumber}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                {isRTL
                  ? 'تقرير فحص الحجم والتبعيات والعلاقات البينية قبل المسح'
                  : 'Pre-Flight Data Size, Dependencies & Risk Audit'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {isLoading ? (
            <div className="py-16 text-center space-y-3 font-mono text-sm text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400" />
              <div>{isRTL ? 'جاري فحص حجم البيانات وتحليل شجرة التبعيات في Firestore...' : 'Analyzing Firestore data footprint and relational dependencies...'}</div>
            </div>
          ) : !summary ? (
            <div className="p-6 text-center text-rose-400 font-mono text-xs">
              {isRTL ? 'تعذر استخراج بيانات الفحص. يرجى إعادة المحاولة.' : 'Failed to retrieve pre-flight audit data.'}
            </div>
          ) : (
            <>
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  summary.overallStatus === 'RED_ALERT'
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    : summary.overallStatus === 'AMBER_WARNING'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {summary.overallStatus === 'RED_ALERT' ? (
                    <AlertOctagon className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
                  ) : summary.overallStatus === 'AMBER_WARNING' ? (
                    <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      {summary.overallStatus === 'RED_ALERT'
                        ? isRTL
                          ? 'تحذير حرج: توجد سجلات مرتبطة بدون نسخة احتياطية مؤكدة'
                          : 'CRITICAL ALERT: Active Relational Data Detected Without Backup'
                        : summary.overallStatus === 'AMBER_WARNING'
                        ? isRTL
                          ? 'تنبيه وقائي: يوصى بأخذ لقطة لقاعدة البيانات قبل الاستمرار'
                          : 'SAFETY ADVISORY: Snapshot Backup Strongly Recommended'
                        : isRTL
                        ? 'جاهز وآمن: تم تأكيد النسخة الاحتياطية والنظام مؤهل للمسح'
                        : 'CLEAR TO PROCEED: Safety Snapshot Secured & Ready'}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {isRTL
                        ? `يحتوي النظام حالياً على ${summary.totalDocuments.toLocaleString()} وثيقة عبر ${summary.activeCollectionsCount} مجموعة بيانات، بحجم إجمالي تقديري ${summary.estimatedTotalSizeKB} كيلوبايت (${summary.estimatedTotalSizeMB} ميجابايت).`
                        : `System holds ${summary.totalDocuments.toLocaleString()} documents across ${summary.activeCollectionsCount} live collections, with estimated footprint of ${summary.estimatedTotalSizeKB} KB (~${summary.estimatedTotalSizeMB} MB).`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={loadSummary}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-white/10 flex items-center gap-1.5 transition-colors"
                    title={isRTL ? 'إعادة فحص قاعدة البيانات' : 'Re-scan database'}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleQuickDownloadSnapshot}
                    disabled={isDownloadingSnapshot}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all ${
                      hasSnapshotSecured
                        ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/30'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/50'
                    }`}
                  >
                    {isDownloadingSnapshot ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {hasSnapshotSecured
                      ? isRTL
                        ? 'تم تنزيل النسخة (إعادة)'
                        : 'Re-download Backup'
                      : isRTL
                      ? 'تنزيل نسخة احتياطية الآن'
                      : 'Download Snapshot Now'}
                  </button>
                </div>
              </div>

              {/* Data Size & Volume Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-black/40 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    {isRTL ? 'إجمالي السجلات:' : 'Total Documents:'}
                  </div>
                  <div className="text-xl font-mono font-bold text-white mt-1">
                    {summary.totalDocuments.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {isRTL ? 'في كافة مجموعات Firestore' : 'Across all collections'}
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    {isRTL ? 'الحجم التقديري:' : 'Estimated Payload:'}
                  </div>
                  <div className="text-xl font-mono font-bold text-amber-300 mt-1">
                    {summary.estimatedTotalSizeKB > 1024
                      ? `${summary.estimatedTotalSizeMB} MB`
                      : `${summary.estimatedTotalSizeKB} KB`}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {isRTL ? 'بيانات JSON الخام والمفهرسة' : 'Raw JSON + Indexes'}
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                    {isRTL ? 'العمليات والمخزون:' : 'Operations Ledger:'}
                  </div>
                  <div className="text-xl font-mono font-bold text-emerald-300 mt-1">
                    {summary.domainBreakdown.operationalLedgers.count.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {summary.domainBreakdown.operationalLedgers.sizeKB} KB ({isRTL ? 'حركات وأرصدة' : 'movements & stock'})
                  </div>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-3.5">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <ScrollText className="w-3.5 h-3.5 text-purple-400" />
                    {isRTL ? 'بيانات الأساس:' : 'Master Data:'}
                  </div>
                  <div className="text-xl font-mono font-bold text-purple-300 mt-1">
                    {summary.domainBreakdown.masterData.count.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {summary.domainBreakdown.masterData.sizeKB} KB ({isRTL ? 'مواد، موردين، مواقع' : 'items, vendors, bays'})
                  </div>
                </div>
              </div>

              {/* Pre-Flight Checklist Verification Strip */}
              <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-bold font-mono text-slate-300 uppercase flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {isRTL ? 'قائمة التحقق الإلزامية قبل التفريغ (Pre-Flight Safety Checklist):' : 'Pre-Flight Safety Verification Checklist:'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Checklist item 1: Snapshot */}
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {hasSnapshotSecured ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                      <span className={hasSnapshotSecured ? 'text-slate-200' : 'text-amber-200 font-medium'}>
                        {isRTL ? 'النسخة الاحتياطية (Snapshot JSON)' : 'Database Snapshot Archive'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px]">
                      {hasSnapshotSecured ? (
                        <span className="text-emerald-400 font-bold">{isRTL ? 'مؤمنة ✓' : 'Secured ✓'}</span>
                      ) : (
                        <span className="text-amber-400 font-bold">{isRTL ? 'معلقة (مطلوب)' : 'Pending (Recommended)'}</span>
                      )}
                    </span>
                  </div>

                  {/* Checklist item 2: Open Work Orders */}
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {summary.preFlightChecklist.hasActiveWorkOrders ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                      <span className="text-slate-200">
                        {isRTL ? 'أوامر التشغيل المفتوحة' : 'In-Flight Production Orders'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-300">
                      {summary.preFlightChecklist.hasActiveWorkOrders
                        ? `${summary.collectionsStats['productionOrders'] || 0} ${isRTL ? 'أوامر نشطة' : 'active'}`
                        : isRTL ? 'لا توجد (مستقرة)' : 'None (Idle)'}
                    </span>
                  </div>

                  {/* Checklist item 3: Pending Approvals */}
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {summary.preFlightChecklist.hasPendingApprovals ? (
                        <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                      <span className="text-slate-200">
                        {isRTL ? 'إجراءات الاعتماد المعلقة' : 'Pending Approvals'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-300">
                      {summary.preFlightChecklist.hasPendingApprovals
                        ? `${summary.collectionsStats['pendingActions'] || 0} ${isRTL ? 'إجراءات' : 'pending'}`
                        : isRTL ? 'صفر معلق' : '0 pending'}
                    </span>
                  </div>

                  {/* Checklist item 4: Clearance */}
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="text-slate-200">
                        {isRTL ? 'صلاحية المشرف العام' : 'Admin Supervisor Clearance'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-cyan-300 font-bold">
                      {currentUser.role || 'Super Admin'} ✓
                    </span>
                  </div>
                </div>
              </div>

              {/* Relational Dependency Graph & Cascading Impact Analysis */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      {isRTL
                        ? 'مصفوفة التبعيات والعلاقات البينية المتأثرة (Relational Cascade Matrix):'
                        : 'Relational Dependency Graph & Cascading Impact Matrix:'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isRTL
                        ? 'توضح هذه المصفوفة السجلات الأجنبية التي ستتأثر مباشرة أو تفقد الربط عند مسح كل كيان:'
                        : 'Shows foreign key dependencies and cascading impacts if an entity is purged:'}
                    </p>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    {[
                      { key: 'ALL', labelAr: 'الكل', labelEn: 'All' },
                      { key: 'master', labelAr: 'الأساس', labelEn: 'Master' },
                      { key: 'operations', labelAr: 'العمليات', labelEn: 'Ops' },
                      { key: 'governance', labelAr: 'الحوكمة', labelEn: 'Audit' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedCategoryFilter(tab.key as any)}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          selectedCategoryFilter === tab.key
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                            : 'bg-black/30 text-slate-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {isRTL ? tab.labelAr : tab.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dependencies List */}
                <div className="space-y-2">
                  {filteredDependencies.map((dep) => {
                    const isExpanded = expandedDependencyId === dep.id;

                    return (
                      <div
                        key={dep.id}
                        className="bg-black/40 border border-white/10 rounded-xl overflow-hidden transition-all"
                      >
                        <div
                          onClick={() => setExpandedDependencyId(isExpanded ? null : dep.id)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300 flex-shrink-0">
                              {dep.category === 'master' ? (
                                <ScrollText className="w-4 h-4 text-purple-400" />
                              ) : dep.category === 'operations' ? (
                                <Boxes className="w-4 h-4 text-cyan-400" />
                              ) : (
                                <ShieldCheck className="w-4 h-4 text-amber-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-xs font-bold text-white truncate">
                                  {isRTL ? dep.nameAr : dep.nameEn}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  ({dep.id})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {isRTL ? dep.cascadeDescriptionAr : dep.cascadeDescriptionEn}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <div className="text-right font-mono">
                              <div className="text-xs font-bold text-slate-200">
                                {dep.docCount.toLocaleString()} {isRTL ? 'سجل' : 'docs'}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ~{dep.estimatedSizeKB} KB
                              </div>
                            </div>

                            {getRiskBadge(dep.riskLevel)}
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="bg-slate-900/80 border-t border-white/5 p-3.5 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                              <span>
                                {isRTL
                                  ? `المجموعات التابعة مباشرة (${dep.dependents.length}):`
                                  : `Direct Dependent Collections (${dep.dependents.length}):`}
                              </span>
                              <span className="text-amber-300 font-bold">
                                {dep.totalDependentDocs.toLocaleString()} {isRTL ? 'سجل تابع سيتأثر' : 'dependent records impacted'}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {dep.dependents.map((colKey) => (
                                <span
                                  key={colKey}
                                  className="px-2 py-0.5 rounded bg-black/60 border border-white/10 text-[11px] font-mono text-slate-300 flex items-center gap-1.5"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                  {colKey}
                                  <span className="text-slate-500">
                                    ({summary.collectionsStats[colKey] || 0})
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/10">
                <div className="text-xs font-mono text-slate-400">
                  {hasSnapshotSecured ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {isRTL ? 'لقطة الأمان مؤمنة وجاهزة للأرشفة' : 'Safety snapshot archived and verified'}
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {isRTL ? 'تنبيه: لم يتم أخذ لقطة للأمان بعد' : 'Advisory: No recent snapshot backup detected'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-bold font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {isRTL ? 'إغلاق الفحص' : 'Close Audit'}
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      if (onProceedToBulkWipe) onProceedToBulkWipe();
                    }}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-bold font-mono bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isRTL ? 'الانتقال لأداة المسح الإداري' : 'Proceed to Bulk-Wipe Clearance'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
