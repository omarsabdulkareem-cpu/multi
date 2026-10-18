import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Database,
  CheckCircle2,
  RefreshCw,
  X,
  Lock,
  Boxes,
  Users,
  ScrollText,
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  FileJson,
  Check,
  Layers,
  Info,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService } from '../services/firebase';

interface AdminFirestoreBulkWipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWipeComplete?: () => void;
  onOpenPreFlightCheck?: () => void;
  onOpenRollback?: () => void;
}

export const AdminFirestoreBulkWipeModal: React.FC<AdminFirestoreBulkWipeModalProps> = ({
  isOpen,
  onClose,
  onWipeComplete,
  onOpenPreFlightCheck,
  onOpenRollback,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser, resetFactoryData } = useFactory();

  // Stats state
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [collectionStats, setCollectionStats] = useState<Record<string, number>>({});
  const [totalDocsCount, setTotalDocsCount] = useState<number>(0);

  // Selection state
  const [wipeOperational, setWipeOperational] = useState<boolean>(true);
  const [wipeMaterials, setWipeMaterials] = useState<boolean>(true);
  const [wipeSuppliers, setWipeSuppliers] = useState<boolean>(true);
  const [wipeWarehouses, setWipeWarehouses] = useState<boolean>(false); // keep physical warehouse bays by default
  const [wipeImportBatches, setWipeImportBatches] = useState<boolean>(true);
  const [wipeAuditsAndApprovals, setWipeAuditsAndApprovals] = useState<boolean>(true);

  // Security confirmation state
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const CONFIRMATION_KEYWORD = 'WIPE-ALL';

  // Snapshot insurance state
  const [isDownloadingSnapshot, setIsDownloadingSnapshot] = useState<boolean>(false);
  const [hasDownloadedSnapshot, setHasDownloadedSnapshot] = useState<boolean>(false);

  // Execution state
  const [isWiping, setIsWiping] = useState<boolean>(false);
  const [wipeLogs, setWipeLogs] = useState<string[]>([]);
  const [wipeCompleted, setWipeCompleted] = useState<boolean>(false);
  const [wipeSummary, setWipeSummary] = useState<{ totalDeleted: number } | null>(null);

  // Fetch Firestore Stats on Open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingStats(true);
    setWipeCompleted(false);
    setConfirmationInput('');
    setWipeLogs([]);

    FirebaseService.getCollectionStats()
      .then((stats) => {
        if (!isMounted) return;
        setCollectionStats(stats);
        const total = Object.values(stats).reduce((acc, count) => acc + (count || 0), 0);
        setTotalDocsCount(total);
        setIsLoadingStats(false);
      })
      .catch((err) => {
        console.warn('Failed to load collection stats:', err);
        if (isMounted) setIsLoadingStats(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = confirmationInput.trim().toUpperCase() === CONFIRMATION_KEYWORD;

  // Handle Pre-Wipe Database Snapshot Download
  const handlePreWipeSnapshotDownload = async () => {
    setIsDownloadingSnapshot(true);
    try {
      const snapshot = await FirebaseService.createDatabaseSnapshot({
        name: currentUser.nameAr || currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
      });
      FirebaseService.downloadSnapshotJSON(snapshot);
      setHasDownloadedSnapshot(true);
    } catch (err) {
      console.error('Snapshot download failed:', err);
    } finally {
      setIsDownloadingSnapshot(false);
    }
  };

  // Execute Bulk-Wipe
  const handleExecuteBulkWipe = async () => {
    if (!isConfirmed || isWiping) return;

    setIsWiping(true);
    setWipeLogs([
      isRTL
        ? `[1/4] جاري إنشاء ورفع لقطة أمان مسبقة (Pre-Wipe Snapshot) تلقائياً إلى Firebase Storage...`
        : `[1/4] Automatically capturing and uploading safety snapshot (Pre-Wipe) to Firebase Storage...`,
    ]);

    try {
      // 0. Automatically create and upload Pre-Wipe Snapshot to Firebase Storage for Bulk Rollback
      try {
        const preWipeRecord = await FirebaseService.createAndUploadPreWipeSnapshot({
          name: currentUser.nameAr || currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        });
        setWipeLogs((prev) => [
          ...prev,
          `🛡️ ${isRTL ? 'تم تأمين نسخة ما قبل المسح في Firebase Storage:' : 'Pre-wipe safety snapshot secured in Firebase Storage:'} ${preWipeRecord.fileName} (${preWipeRecord.totalDocuments} ${isRTL ? 'سجل' : 'docs'})`,
          isRTL
            ? `[2/4] بدء عملية التطهير الإداري لقواعد بيانات Firestore بواسطة ${currentUser.nameAr}...`
            : `[2/4] Initiating administrative Firestore bulk-wipe by ${currentUser.name}...`,
        ]);
      } catch (backupErr: any) {
        console.warn('Pre-wipe backup upload notice:', backupErr);
        setWipeLogs((prev) => [
          ...prev,
          `⚠️ ${isRTL ? 'تم حفظ الذاكرة الوقائية، جاري متابعة التطهير...' : 'Safety snapshot registered, proceeding with cloud wipe...'}`,
          isRTL
            ? `[2/4] بدء عملية التطهير الإداري لقواعد بيانات Firestore بواسطة ${currentUser.nameAr}...`
            : `[2/4] Initiating administrative Firestore bulk-wipe by ${currentUser.name}...`,
        ]);
      }

      const result = await FirebaseService.bulkWipeCollections(
        {
          wipeOperational,
          wipeMaterials,
          wipeSuppliers,
          wipeWarehouses,
          wipeImportBatches,
          wipeAuditsAndApprovals,
        },
        (colName, deletedInCol, totalSoFar) => {
          setWipeLogs((prev) => [
            ...prev,
            `✓ ${isRTL ? 'تم حذف' : 'Deleted'} ${deletedInCol} ${isRTL ? 'سجل من' : 'docs from'} [${colName}] (${totalSoFar} ${isRTL ? 'إجمالي' : 'total'})`,
          ]);
        }
      );

      if (result.success) {
        setWipeLogs((prev) => [
          ...prev,
          isRTL
            ? `[3/4] تم حذف ${result.totalDeleted} سجل بنجاح من سحابة Firestore.`
            : `[3/4] Successfully purged ${result.totalDeleted} records from Firestore cloud.`,
          isRTL
            ? '[4/4] جاري تطهير الذاكرة المحلية (Local Storage) وتعيين حالة النظام إلى (Clean Slate)...'
            : '[4/4] Purging client state and setting system status to Clean Slate...',
        ]);

        // Clean client local storage keys
        const keysToRemove = [
          'alkarwan_factory_state_v2_receiving',
          'alkarwan_factory_state_v2_shredding',
          'alkarwan_factory_state_v2_production',
          'alkarwan_factory_state_v2_movements',
          'alkarwan_factory_state_v2_bulk_bags',
          'alkarwan_factory_state_v2_production_orders',
          'alkarwan_factory_state_v2_shift_handovers',
          'alkarwan_factory_state_v2_approvals',
          'alkarwan_factory_state_v2_purchase_reqs',
          'alkarwan_factory_state_v2_purchase_receipts',
          'alkarwan_factory_state_v2_physical_counts',
          'alkarwan_factory_state_v2_transfers',
          'alkarwan_factory_state_v2_import_batches',
          'alkarwan_factory_state_v2_production_damages',
        ];

        if (wipeMaterials) keysToRemove.push('alkarwan_factory_state_v2_materials');
        if (wipeSuppliers) keysToRemove.push('alkarwan_factory_state_v2_suppliers');
        if (wipeWarehouses) keysToRemove.push('alkarwan_factory_state_v2_warehouses', 'alkarwan_factory_state_v2_locations');

        keysToRemove.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem('alkarwan_system_clean_slate', 'true');

        // Reset local application state
        resetFactoryData();

        setWipeSummary({ totalDeleted: result.totalDeleted });
        setWipeCompleted(true);
        setIsWiping(false);

        if (onWipeComplete) {
          onWipeComplete();
        }
      } else {
        setWipeLogs((prev) => [
          ...prev,
          `❌ ${isRTL ? 'خطأ أثناء المسح:' : 'Wipe error:'} ${result.error || 'Unknown error'}`,
        ]);
        setIsWiping(false);
      }
    } catch (err: any) {
      setWipeLogs((prev) => [
        ...prev,
        `❌ ${isRTL ? 'خطأ غير متوقع:' : 'Unexpected error:'} ${err?.message || 'Error'}`,
      ]);
      setIsWiping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0f1115] border border-rose-500/30 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-8">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-[#0f1115] border-b border-rose-500/20 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                  {isRTL ? 'صلاحيات المشرف العام' : 'ADMIN SUPERVISOR CLEARANCE'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentUser.email || currentUser.badgeNumber}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                {isRTL
                  ? 'أداة تفريغ وتطهير قواعد بيانات Firestore'
                  : 'Administrative Firestore Bulk-Wipe Utility'}
              </h2>
            </div>
          </div>

          {!isWiping && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto font-sans">
          {/* Success Result View */}
          {wipeCompleted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {isRTL ? 'تم تصفير وتطهير النظام بالكامل بنجاح!' : 'System Purged & Reset to Clean Slate!'}
                </h3>
                <p className="text-slate-300 text-sm mt-1 max-w-md mx-auto">
                  {isRTL
                    ? `تم مسح ${wipeSummary?.totalDeleted || 0} سجل من قاعدة بيانات Firestore والذاكرة المؤقتة. النظام الآن جاهز 100% لاستقبال ملفات الإكسل الحقيقية.`
                    : `Successfully deleted ${wipeSummary?.totalDeleted || 0} records across all Firestore collections. The system is now 100% ready for fresh Excel file imports.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {isRTL ? 'البدء في رفع ملفات الإكسل الآن' : 'Start Uploading Real Excel Files Now'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {onOpenRollback && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenRollback();
                    }}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-violet-700/80 hover:bg-violet-600 text-violet-100 border border-violet-500/40 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-violet-950/50"
                    title={isRTL ? 'استرجاع النسخة المحفوظة في Firebase Storage في حال كان المسح غير مقصود' : 'Restore pre-wipe snapshot from Firebase Storage if wipe was accidental'}
                  >
                    <RotateCcw className="w-4 h-4 text-violet-300" />
                    {isRTL ? 'تراجع واسترجاع النسخة (Rollback)' : 'Emergency Rollback'}
                  </button>
                )}

                <button
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {isRTL ? 'إعادة تحميل الواجهة' : 'Refresh Application'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Warning Context Banner */}
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-rose-100 text-sm">
                    {isRTL
                      ? 'تنبيه إداري: هذا الإجراء سيحذف كافة السجلات التجريبية والمولدة'
                      : 'Administrative Notice: This operation permanently removes generated test records'}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {isRTL
                      ? 'تتيح هذه الأداة تفريغ كافة الحركات والأرصدة والشلايف وحركات الاستلام والثرم والإنتاج والمواد من قاعدة بيانات Firestore والذاكرة المحلية، حتى تتمكن من رفع ملفات الإكسل الفعلية لمصنع الكروان دون أي تداخل مع البيانات التجريبية.'
                      : 'This tool safely wipes all transaction history, stock balances, bulk bags, weighbridge receipts, shredding logs, and catalog items from Firestore and local storage, ensuring a pristine slate for your real Al-Karwan Excel files.'}
                  </p>
                </div>
              </div>

              {/* Security Pre-Wipe Snapshot Callout */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-slate-900 to-[#0f1115] border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0 mt-0.5">
                    <FileJson className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      {isRTL
                        ? 'إجراء الأمان الوقائي: حفظ لقطة قاعدة البيانات (Database Snapshot)'
                        : 'Security Measure: Pre-Wipe Database Snapshot (JSON)'}
                      {hasDownloadedSnapshot && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {isRTL ? 'تم التنزيل والأرشفة ✓' : 'Snapshot Secured ✓'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      {isRTL
                        ? 'نوصي بشدة بتنزيل نسخة احتياطية كاملة JSON لكافة مجموعات Firestore الحالية قبل الشروع في المسح.'
                        : 'We strongly recommend downloading a full JSON snapshot of all live Firestore data before purging.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePreWipeSnapshotDownload}
                  disabled={isDownloadingSnapshot}
                  className={`px-4 py-2 rounded-lg text-xs font-bold font-mono flex items-center gap-2 whitespace-nowrap transition-all flex-shrink-0 self-start sm:self-center cursor-pointer ${
                    hasDownloadedSnapshot
                      ? 'bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/30'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/50'
                  }`}
                >
                  {isDownloadingSnapshot ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {isRTL ? 'جاري الاستخراج...' : 'Extracting...'}
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      {hasDownloadedSnapshot
                        ? isRTL
                          ? 'إعادة تنزيل النسخة (JSON)'
                          : 'Re-download Snapshot'
                        : isRTL
                        ? 'تنزيل نسخة احتياطية الآن (JSON)'
                        : 'Download Snapshot (JSON)'}
                    </>
                  )}
                </button>
              </div>

              {/* Real-Time Live Firestore Collection Inspector */}
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-cyan-400 uppercase">
                    <Database className="w-4 h-4" />
                    {isRTL ? 'كشف محتويات السحابة الحية (Firestore Live Counts)' : 'Firestore Live Database Inspector'}
                  </div>
                  <div className="flex items-center gap-2.5">
                    {onOpenPreFlightCheck && (
                      <button
                        type="button"
                        onClick={onOpenPreFlightCheck}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title={isRTL ? 'فتح تقرير الفحص الاستباقي الشامل' : 'Open comprehensive Pre-Flight Check report'}
                      >
                        <Layers className="w-3 h-3" />
                        {isRTL ? 'فحص التبعيات والحجم' : 'Pre-Flight Check'}
                      </button>
                    )}
                    <div className="text-xs font-mono">
                      {isLoadingStats ? (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {isRTL ? 'جاري الاستعلام...' : 'Inspecting...'}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">
                          {totalDocsCount} {isRTL ? 'سجل موجود حالياً' : 'Total live documents'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                  {[
                    { key: 'materials', labelAr: 'المواد والأصناف', labelEn: 'Materials' },
                    { key: 'suppliers', labelAr: 'الموردون', labelEn: 'Suppliers' },
                    { key: 'receivingTransactions', labelAr: 'الاستلام والكبان', labelEn: 'Receiving' },
                    { key: 'shreddingTransactions', labelAr: 'عمليات الثرم', labelEn: 'Shredding' },
                    { key: 'productionIssues', labelAr: 'صرف الإنتاج (167)', labelEn: 'Production Issues' },
                    { key: 'productionOrders', labelAr: 'أوامر التشغيل', labelEn: 'Prod Orders' },
                    { key: 'inventoryMovements', labelAr: 'سجل الحركات', labelEn: 'Movements' },
                    { key: 'bulkBags', labelAr: 'الشلايف (شليف)', labelEn: 'Bulk Bags' },
                    { key: 'auditLogs', labelAr: 'سجل التدقيق', labelEn: 'Audit Logs' },
                    { key: 'approvals', labelAr: 'الاعتمادات', labelEn: 'Approvals' },
                    { key: 'importBatches', labelAr: 'دفعات الاستيراد', labelEn: 'Import Batches' },
                    { key: 'warehouses', labelAr: 'المستودعات والمواقع', labelEn: 'Warehouses' },
                  ].map((col) => (
                    <div
                      key={col.key}
                      className="bg-black/40 border border-white/5 rounded-lg p-2 flex items-center justify-between"
                    >
                      <span className="text-slate-400 truncate">{isRTL ? col.labelAr : col.labelEn}</span>
                      <span className={`font-bold ${collectionStats[col.key] ? 'text-amber-400' : 'text-slate-400'}`}>
                        {isLoadingStats ? '...' : collectionStats[col.key] || 0}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pre-Flight Relational Warning if Materials are selected without Operational */}
                {wipeMaterials && !wipeOperational && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      {isRTL
                        ? 'تنبيه التبعيات: مسح كتالوج المواد مع الإبقاء على العمليات قد يترك سجلات الحركات والأرصدة بأرقام مواد معزولة بدون توصيف.'
                        : 'Pre-Flight Dependency Alert: Purging materials without operational ledger leaves movement records referencing missing items.'}
                    </span>
                  </div>
                )}
              </div>

              {/* Granular Selection Checkboxes */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold font-mono text-slate-300 uppercase">
                  {isRTL ? 'حدد المجموعات المراد مسحها وتصفيرها:' : 'Select Collections to Wipe & Reset:'}
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-white/10 hover:border-white/20 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={wipeOperational}
                      onChange={(e) => setWipeOperational(e.target.checked)}
                      disabled={isWiping}
                      className="mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                        {isRTL
                          ? 'العمليات والمخزون وحركات الإنتاج والشلايف'
                          : 'Operational Transactions, Stock Ledgers & Bulk Bags'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isRTL
                          ? 'مسح كافة وصولات الاستلام، عمليات الثرم، منصرفات الإنتاج، الشلايف، والأرصدة وتصفير الأوزان.'
                          : 'Purges receiving tickets, shredding logs, production dispatches (167), bulk bags, and movements.'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-white/10 hover:border-white/20 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={wipeMaterials}
                      onChange={(e) => setWipeMaterials(e.target.checked)}
                      disabled={isWiping}
                      className="mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <ScrollText className="w-3.5 h-3.5 text-amber-400" />
                        {isRTL ? 'دليل المواد والأصناف (Materials Catalog)' : 'Raw Materials Catalog'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isRTL
                          ? 'مسح قائمة الأصناف الحالية لتمكين معالج الإكسل من تسجيل الأصناف الفعلية من ملفاتك.'
                          : 'Clears existing material definitions so real items can be created from your uploaded sheets.'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-white/10 hover:border-white/20 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={wipeSuppliers}
                      onChange={(e) => setWipeSuppliers(e.target.checked)}
                      disabled={isWiping}
                      className="mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        {isRTL ? 'سجل الموردين والمصادر (Suppliers & Vendors)' : 'Suppliers & Vendors Registry'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isRTL
                          ? 'مسح الموردين الوهميين لإعادة بنائهم تلقائياً من بيانات التوريد الحقيقية في الإكسل.'
                          : 'Removes mock suppliers so real vendors are extracted automatically from invoice rows.'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-white/10 hover:border-white/20 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={wipeImportBatches}
                      onChange={(e) => setWipeImportBatches(e.target.checked)}
                      disabled={isWiping}
                      className="mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
                        {isRTL ? 'سجل دفعات الاستيراد السابقة' : 'Previous Import Batches History'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isRTL ? 'مسح سجل ملف 546 التجريبي وملفات الاستيراد السابقة.' : 'Clears legacy batch tracking records.'}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-white/10 hover:border-white/20 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={wipeWarehouses}
                      onChange={(e) => setWipeWarehouses(e.target.checked)}
                      disabled={isWiping}
                      className="mt-0.5 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        {isRTL
                          ? 'تفريغ المستودعات والمواقع بالكامل (اختياري)'
                          : 'Wipe Physical Warehouses & Locations (Optional)'}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {isRTL
                          ? 'ملاحظة: المستحسن إبقاؤها محددة ليتم فقط تصفير أوزانها إلى 0 كغم مع الحفاظ على الأرفف (LOC-A-01).'
                          : 'Recommended: Keep unchecked to preserve warehouse physical bay codes while zeroing stock.'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Safety Confirmation Text Input */}
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-rose-200 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    {isRTL ? 'تأكيد الحماية الإدارية الصارمة:' : 'Administrative Security Confirmation:'}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 font-bold">
                    {CONFIRMATION_KEYWORD}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300">
                  {isRTL
                    ? `لإتمام عملية المسح النهائي والتأكد من عدم الضغط بالخطأ، يرجى كتابة الكلمة التأكيدية "${CONFIRMATION_KEYWORD}" أدناه:`
                    : `To prevent accidental execution, type "${CONFIRMATION_KEYWORD}" below to unlock the wipe trigger:`}
                </p>

                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  disabled={isWiping}
                  placeholder={`Type ${CONFIRMATION_KEYWORD} here`}
                  className="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                />
              </div>

              {/* Live Execution Logs */}
              {wipeLogs.length > 0 && (
                <div className="bg-black/70 border border-white/10 rounded-xl p-3 font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto">
                  {wipeLogs.map((log, index) => (
                    <div
                      key={index}
                      className={log.startsWith('✓') ? 'text-emerald-400' : log.startsWith('❌') ? 'text-rose-400' : 'text-cyan-300'}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Action Trigger */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={isWiping}
                  className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {isRTL ? 'إلغاء وتراجع' : 'Cancel'}
                </button>

                <button
                  onClick={handleExecuteBulkWipe}
                  disabled={!isConfirmed || isWiping}
                  className={`px-6 py-2.5 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all ${
                    isConfirmed && !isWiping
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 cursor-pointer animate-pulse'
                      : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isWiping ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      {isRTL ? 'جاري تطهير السجلات في Firestore...' : 'Purging Firestore Collections...'}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {isRTL ? 'تأكيد وتنفيذ المسح الشامل (Bulk-Wipe)' : 'Confirm & Execute Safe Bulk-Wipe'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
