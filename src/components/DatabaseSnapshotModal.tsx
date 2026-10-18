import React, { useState, useEffect } from 'react';
import {
  Download,
  Database,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  X,
  FileJson,
  Boxes,
  ScrollText,
  Users,
  Building2,
  AlertCircle,
  Clock,
  HardDrive,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  Layers,
  Lock,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService, DatabaseSnapshot } from '../services/firebase';
import { CloudStorageSnapshotRecord, BulkRollbackResult } from '../types';

interface DatabaseSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSnapshotGenerated?: (snapshot: DatabaseSnapshot) => void;
  onRollbackComplete?: (result: BulkRollbackResult) => void;
  initialTab?: 'export' | 'rollback';
}

interface CollectionItemConfig {
  key: string;
  labelAr: string;
  labelEn: string;
  category: 'master' | 'operations' | 'system';
}

const ALL_COLLECTIONS: CollectionItemConfig[] = [
  // Master Data
  { key: 'materials', labelAr: 'المواد والأصناف', labelEn: 'Raw Materials Master', category: 'master' },
  { key: 'suppliers', labelAr: 'الموردون والمصادر', labelEn: 'Suppliers & Vendors', category: 'master' },
  { key: 'warehouses', labelAr: 'المستودعات والجمالونات', labelEn: 'Physical Warehouses', category: 'master' },
  { key: 'warehouseLocations', labelAr: 'المواقع والأرفف', labelEn: 'Warehouse Bays & Locations', category: 'master' },

  // Operational Ledgers
  { key: 'receivingTransactions', labelAr: 'تذاكر الاستلام والكبان', labelEn: 'Receiving & Weighbridge', category: 'operations' },
  { key: 'shreddingTransactions', labelAr: 'عمليات الثرم والبودرة', labelEn: 'Shredding & Regrind Logs', category: 'operations' },
  { key: 'productionIssues', labelAr: 'أذونات صرف الإنتاج (167)', labelEn: 'Production Issues (Doc 167)', category: 'operations' },
  { key: 'productionOrders', labelAr: 'أوامر التشغيل والطلبيات', labelEn: 'Production Orders', category: 'operations' },
  { key: 'productionDamages', labelAr: 'سجلات التوالف والهدر', labelEn: 'Scrap & Damage Logs', category: 'operations' },
  { key: 'inventoryMovements', labelAr: 'سجل حركات المخزن الموحد', labelEn: 'Unified Inventory Movements', category: 'operations' },
  { key: 'inventoryBalances', labelAr: 'أرصدة المخزون اللحظية', labelEn: 'Real-Time Inventory Balances', category: 'operations' },
  { key: 'bulkBags', labelAr: 'أكياس الشليف والباركودات', labelEn: 'Bulk Bags (Big Bags)', category: 'operations' },
  { key: 'warehouseTransfers', labelAr: 'المناقلات والتحويلات الداخلية', labelEn: 'Warehouse Transfers', category: 'operations' },
  { key: 'physicalCounts', labelAr: 'عمليات الجرد الفعلي', labelEn: 'Physical Inventory Audits', category: 'operations' },
  { key: 'purchaseRequirements', labelAr: 'احتياجات المشتريات', labelEn: 'Purchase Requirements', category: 'operations' },
  { key: 'purchaseReceipts', labelAr: 'وصولات شراء المواد', labelEn: 'Purchase Receipts', category: 'operations' },

  // System & Governance
  { key: 'approvals', labelAr: 'سجل الاعتمادات والتوقيعات', labelEn: 'Approvals & Signatures', category: 'system' },
  { key: 'pendingActions', labelAr: 'الإجراءات المعلقة', labelEn: 'Pending Actions', category: 'system' },
  { key: 'shiftHandovers', labelAr: 'تسليم وتسلم الورديات', labelEn: 'Shift Handovers', category: 'system' },
  { key: 'auditLogs', labelAr: 'سجل تدقيق النظام والأمان', labelEn: 'System Audit Logs', category: 'system' },
  { key: 'importBatches', labelAr: 'دفعات الاستيراد التاريخية', labelEn: 'Import Batches Tracking', category: 'system' },
];

export const DatabaseSnapshotModal: React.FC<DatabaseSnapshotModalProps> = ({
  isOpen,
  onClose,
  onSnapshotGenerated,
  onRollbackComplete,
  initialTab = 'export',
}) => {
  const { isRTL } = useLanguage();
  const { currentUser, restoreSnapshotIntoContext } = useFactory();

  // Active Tab: 'export' or 'rollback'
  const [activeTab, setActiveTab] = useState<'export' | 'rollback'>(initialTab);

  // Stats state for export
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [collectionStats, setCollectionStats] = useState<Record<string, number>>({});
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    ALL_COLLECTIONS.map((c) => c.key)
  );

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [generatedSnapshot, setGeneratedSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [payloadSizeKB, setPayloadSizeKB] = useState<number>(0);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Rollback state
  const [isLoadingPreWipe, setIsLoadingPreWipe] = useState<boolean>(false);
  const [preWipeRecord, setPreWipeRecord] = useState<CloudStorageSnapshotRecord | null>(null);
  const [recentSnapshots, setRecentSnapshots] = useState<CloudStorageSnapshotRecord[]>([]);
  const [selectedSnapshotForRollback, setSelectedSnapshotForRollback] = useState<CloudStorageSnapshotRecord | null>(null);
  const [isFetchingRollbackPayload, setIsFetchingRollbackPayload] = useState<boolean>(false);
  const [rollbackSnapshotData, setRollbackSnapshotData] = useState<DatabaseSnapshot | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [confirmRollbackText, setConfirmRollbackText] = useState<string>('');
  const [isRollbackConfirmed, setIsRollbackConfirmed] = useState<boolean>(false);
  const [isExecutingRollback, setIsExecutingRollback] = useState<boolean>(false);
  const [rollbackLogs, setRollbackLogs] = useState<string[]>([]);
  const [rollbackCompletedResult, setRollbackCompletedResult] = useState<BulkRollbackResult | null>(null);

  // Initialize active tab from props when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Fetch Firestore Collection Stats on Mount
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingStats(true);
    setGeneratedSnapshot(null);
    setProgressLog([]);
    setCopiedJson(false);

    FirebaseService.getCollectionStats()
      .then((stats) => {
        if (!isMounted) return;
        setCollectionStats(stats);
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

  // Fetch Pre-Wipe & Cloud Snapshots for Rollback
  const fetchRollbackSnapshots = async () => {
    setIsLoadingPreWipe(true);
    try {
      const [latest, allSnaps] = await Promise.all([
        FirebaseService.getLatestPreWipeSnapshot(),
        FirebaseService.getCloudSnapshots(),
      ]);
      setPreWipeRecord(latest);
      setRecentSnapshots(allSnaps.filter((s) => s.status !== 'PURGED'));
      if (latest && !selectedSnapshotForRollback) {
        setSelectedSnapshotForRollback(latest);
      }
    } catch (err) {
      console.warn('Failed to load rollback snapshots:', err);
    } finally {
      setIsLoadingPreWipe(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'rollback') {
      fetchRollbackSnapshots();
    }
  }, [isOpen, activeTab]);

  // When selected snapshot for rollback changes, load its payload
  useEffect(() => {
    if (!selectedSnapshotForRollback) {
      setRollbackSnapshotData(null);
      return;
    }

    let isMounted = true;
    setIsFetchingRollbackPayload(true);
    setRollbackError(null);
    setConfirmRollbackText('');
    setIsRollbackConfirmed(false);
    setRollbackCompletedResult(null);

    FirebaseService.fetchSnapshotFromFirebaseStorage(selectedSnapshotForRollback)
      .then((snap) => {
        if (!isMounted) return;
        setRollbackSnapshotData(snap);
        setIsFetchingRollbackPayload(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setRollbackError(err?.message || 'Failed to download snapshot from storage');
        setIsFetchingRollbackPayload(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSnapshotForRollback]);

  if (!isOpen) return null;

  const totalSelectedDocs = selectedCollections.reduce(
    (sum, key) => sum + (collectionStats[key] || 0),
    0
  );

  const toggleCollection = (colKey: string) => {
    setSelectedCollections((prev) =>
      prev.includes(colKey) ? prev.filter((k) => k !== colKey) : [...prev, colKey]
    );
  };

  const selectAll = () => setSelectedCollections(ALL_COLLECTIONS.map((c) => c.key));
  const deselectAll = () => setSelectedCollections([]);

  // Generate and Download Snapshot
  const handleGenerateAndDownload = async () => {
    if (selectedCollections.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setGeneratedSnapshot(null);
    setProgressLog([
      isRTL
        ? `[1/3] بدء توليد لقطة قاعدة البيانات الحية للمشرف: ${currentUser?.nameAr || currentUser?.name || 'المشرف'}...`
        : `[1/3] Initializing live database snapshot by supervisor: ${currentUser?.name || currentUser?.nameAr || 'Supervisor'}...`,
    ]);

    try {
      const snapshot = await FirebaseService.createDatabaseSnapshot(
        {
          name: currentUser?.nameAr || currentUser?.name || 'المشرف',
          email: currentUser?.email,
          role: currentUser?.role || 'Supervisor',
        },
        selectedCollections,
        (colName, count, currentTotal) => {
          setProgressLog((prev) => [
            ...prev,
            `✓ [${colName}]: ${count} ${isRTL ? 'وثيقة استُخرجت' : 'docs captured'} (${currentTotal} ${isRTL ? 'إجمالي' : 'total'})`,
          ]);
        }
      );

      const jsonStr = JSON.stringify(snapshot, null, 2);
      const sizeKB = Math.round(new Blob([jsonStr]).size / 1024);
      setPayloadSizeKB(sizeKB);

      // Trigger instant browser download
      FirebaseService.downloadSnapshotJSON(snapshot);

      setProgressLog((prev) => [
        ...prev,
        isRTL
          ? `[2/3] تم استخراج وتنسيق ${snapshot.metadata.totalDocuments} وثيقة بنجاح (${sizeKB} كيلوبايت).`
          : `[2/3] Successfully extracted and formatted ${snapshot.metadata.totalDocuments} documents (${sizeKB} KB).`,
        isRTL
          ? `[3/3] تم تنزيل ملف النسخة الاحتياطية تلقائياً على جهازك بنجاح.`
          : `[3/3] Snapshot JSON file was automatically downloaded to your local device.`,
      ]);

      setGeneratedSnapshot(snapshot);
      setIsGenerating(false);

      if (onSnapshotGenerated) {
        onSnapshotGenerated(snapshot);
      }
    } catch (err: any) {
      console.error('Snapshot export error:', err);
      setProgressLog((prev) => [
        ...prev,
        `❌ ${isRTL ? 'فشل تصدير اللقطة:' : 'Snapshot export failed:'} ${err?.message || 'Error'}`,
      ]);
      setIsGenerating(false);
    }
  };

  const handleCopyJson = () => {
    if (!generatedSnapshot) return;
    navigator.clipboard.writeText(JSON.stringify(generatedSnapshot, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  // Rollback validation
  const requiredRollbackConfirmWord = isRTL ? 'استرجاع' : 'RESTORE';
  const isRollbackReady =
    confirmRollbackText.trim().toUpperCase() === requiredRollbackConfirmWord.toUpperCase() &&
    isRollbackConfirmed &&
    Boolean(rollbackSnapshotData);

  // Execute Rollback from Snapshot
  const handleExecuteRollback = async () => {
    if (!rollbackSnapshotData || !isRollbackReady || isExecutingRollback) return;

    setIsExecutingRollback(true);
    setRollbackLogs([
      isRTL
        ? `[1/4] بدء عملية الاسترجاع الشامل (Bulk Rollback) بإشراف المشرف: ${currentUser?.nameAr || currentUser?.name || 'المشرف'}...`
        : `[1/4] Initializing bulk database rollback under supervisor: ${currentUser?.name || currentUser?.nameAr || 'Supervisor'}...`,
    ]);

    try {
      const result = await FirebaseService.restoreDatabaseSnapshot(rollbackSnapshotData, {
        user: {
          name: currentUser?.nameAr || currentUser?.name || 'المشرف',
          email: currentUser?.email,
        },
        onProgress: (colName, restoredInCol, totalRestored) => {
          setRollbackLogs((prev) => [
            ...prev,
            `✓ ${isRTL ? 'استعادة' : 'Restored'} ${restoredInCol} ${isRTL ? 'سجل في' : 'docs in'} [${colName}] (${totalRestored} ${isRTL ? 'إجمالي' : 'total'})`,
          ]);
        },
      });

      setRollbackLogs((prev) => [
        ...prev,
        isRTL
          ? `[2/4] تم كتابة ${result.totalRestored} سجل بنجاح في قاعدة بيانات Firestore.`
          : `[2/4] Successfully committed ${result.totalRestored} records into Firestore database.`,
        isRTL
          ? '[3/4] جاري تحديث الذاكرة التشغيلية للنظام ومزامنة التخزين المحلي (LocalStorage)...'
          : '[3/4] Synchronizing in-memory application context and local storage...',
      ]);

      // Synchronize in-memory factory context
      const syncResult = restoreSnapshotIntoContext(rollbackSnapshotData);

      setRollbackLogs((prev) => [
        ...prev,
        isRTL
          ? `[4/4] تمت المزامنة الشاملة بنجاح (${syncResult.totalRestored} سجل متزامن في الواجهة).`
          : `[4/4] In-memory synchronization completed (${syncResult.totalRestored} records updated).`,
      ]);

      setRollbackCompletedResult(result);
      setIsExecutingRollback(false);

      if (onRollbackComplete) {
        onRollbackComplete(result);
      }
    } catch (err: any) {
      console.error('Bulk rollback error:', err);
      setRollbackLogs((prev) => [
        ...prev,
        `❌ ${isRTL ? 'فشل تنفيذ الاسترجاع:' : 'Rollback execution failed:'} ${err?.message || 'Error'}`,
      ]);
      setIsExecutingRollback(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#0f1115] border border-cyan-500/30 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl relative my-8">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-[#0f1115] border-b border-cyan-500/20 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                  {isRTL ? 'إدارة اللقطات والأمان السحابي' : 'SNAPSHOTS & BULK ROLLBACK'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentUser.email || currentUser.badgeNumber}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-cyan-400" />
                {isRTL
                  ? 'مركز لقطات قاعدة البيانات والاسترجاع (Snapshot Center)'
                  : 'Database Snapshot & Bulk Rollback Center'}
              </h2>
            </div>
          </div>

          {!isGenerating && !isExecutingRollback && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Selection Bar */}
        <div className="flex items-center border-b border-white/10 bg-black/40 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            {isRTL ? 'إنشاء وتصدير لقطة (JSON Backup)' : 'Create & Export Snapshot'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rollback')}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'rollback'
                ? 'border-violet-400 text-violet-300 bg-violet-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {isRTL ? 'استرجاع من Firebase Storage (Bulk Rollback)' : 'Bulk Rollback from Storage'}
            {preWipeRecord && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {activeTab === 'export' ? (
            <>
              {/* Security Guarantee Banner */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 text-xs text-cyan-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-cyan-100 text-sm">
                    {isRTL
                      ? 'إجراء وقائي موصى به قبل أي مسح أو تصفير'
                      : 'Recommended Safety Step Before Any Bulk-Wipe Operation'}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {isRTL
                      ? 'تتيح هذه الأداة التقاط وتنزيل نسخة احتياطية كاملة بصيغة JSON لجميع مجموعات بيانات Firestore (المواد، الموردين، أرصدة المخازن، حركات الشليف، الكبان، وأوامر الإنتاج).'
                      : 'This tool extracts a structured JSON snapshot of all live Firestore collections (materials, suppliers, inventory ledgers, bulk bags, weighbridge tickets, and orders).'}
                  </p>
                </div>
              </div>

              {/* Success Summary View (if generated) */}
              {generatedSnapshot && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      {isRTL ? 'تم إنشاء وتنزيل النسخة الاحتياطية بنجاح!' : 'Snapshot Created & Downloaded Successfully!'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => FirebaseService.downloadSnapshotJSON(generatedSnapshot)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isRTL ? 'إعادة التنزيل' : 'Re-download'}
                      </button>
                      <button
                        onClick={handleCopyJson}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                      >
                        {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedJson ? (isRTL ? 'تم النسخ!' : 'Copied!') : isRTL ? 'نسخ JSON' : 'Copy JSON'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'إجمالي السجلات:' : 'Total Documents:'}</div>
                      <div className="text-emerald-300 font-bold text-sm mt-0.5">
                        {generatedSnapshot.metadata.totalDocuments.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'المجموعات:' : 'Collections:'}</div>
                      <div className="text-cyan-300 font-bold text-sm mt-0.5">
                        {Object.keys(generatedSnapshot.collections).length}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'حجم الملف:' : 'Payload Size:'}</div>
                      <div className="text-amber-300 font-bold text-sm mt-0.5">
                        {payloadSizeKB} KB
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'التوقيت:' : 'Timestamp:'}</div>
                      <div className="text-slate-300 truncate text-[10px] mt-1" title={generatedSnapshot.metadata.exportTimestamp}>
                        {new Date(generatedSnapshot.metadata.exportTimestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selection Controls */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-200 uppercase">
                      {isRTL ? 'تحديد المجموعات المشمولة في اللقطة:' : 'Select Collections to Include in Snapshot:'}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold">
                      ({selectedCollections.length} / {ALL_COLLECTIONS.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={selectAll}
                      disabled={isGenerating}
                      className="text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
                    >
                      {isRTL ? 'تحديد الكل' : 'Select All'}
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      disabled={isGenerating}
                      className="text-slate-400 hover:text-slate-300 hover:underline cursor-pointer"
                    >
                      {isRTL ? 'إلغاء التحديد' : 'Deselect All'}
                    </button>
                  </div>
                </div>

                {/* Collection Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ALL_COLLECTIONS.map((col) => {
                    const isSelected = selectedCollections.includes(col.key);
                    const count = collectionStats[col.key] || 0;

                    return (
                      <label
                        key={col.key}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-900 border-cyan-500/40 text-white shadow-sm'
                            : 'bg-black/30 border-white/5 text-slate-500 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCollection(col.key)}
                            disabled={isGenerating}
                            className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20"
                          />
                          <span className="truncate font-medium">
                            {isRTL ? col.labelAr : col.labelEn}
                          </span>
                        </div>

                        <span
                          className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold ${
                            count > 0
                              ? isSelected
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                : 'bg-white/5 text-slate-400'
                              : 'text-slate-600'
                          }`}
                        >
                          {isLoadingStats ? '...' : count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Live Generation Telemetry Logs */}
              {progressLog.length > 0 && (
                <div className="bg-black/70 border border-white/10 rounded-xl p-3 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                  <div className="text-slate-400 text-[10px] pb-1 border-b border-white/5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {isRTL ? 'سجل عمليات الاستخراج الحي:' : 'Live Snapshot Telemetry Log:'}
                  </div>
                  {progressLog.map((log, index) => (
                    <div
                      key={index}
                      className={
                        log.startsWith('✓')
                          ? 'text-emerald-400'
                          : log.startsWith('❌')
                          ? 'text-rose-400'
                          : 'text-cyan-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
                <div className="text-xs font-mono text-slate-400">
                  {isRTL ? 'إجمالي السجلات المحددة للتصدير:' : 'Total documents selected for snapshot:'}{' '}
                  <span className="text-cyan-300 font-bold">
                    {isLoadingStats ? '...' : totalSelectedDocs.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={onClose}
                    disabled={isGenerating}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs font-bold font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {isRTL ? 'إغلاق' : 'Close'}
                  </button>

                  <button
                    onClick={handleGenerateAndDownload}
                    disabled={selectedCollections.length === 0 || isGenerating}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                      selectedCollections.length > 0 && !isGenerating
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-950/60 cursor-pointer'
                        : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        {isRTL ? 'جاري إنشاء اللقطة والتنزيل...' : 'Capturing & Downloading...'}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {isRTL ? 'توليد وتنزيل اللقطة (JSON)' : 'Generate & Download Snapshot'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ROLLBACK TAB */
            <>
              {rollbackCompletedResult ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      {isRTL ? 'تمت استعادة قاعدة البيانات بنجاح تام!' : 'Bulk Rollback Succeeded!'}
                    </h3>
                    <p className="text-slate-300 text-sm mt-1 max-w-md mx-auto">
                      {isRTL
                        ? `تمت استعادة ${rollbackCompletedResult.totalRestored.toLocaleString()} سجل عبر مجموعات Firestore ومزامنة الواجهة المحلية.`
                        : `Successfully restored ${rollbackCompletedResult.totalRestored.toLocaleString()} documents into Firestore.`}
                    </p>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      {isRTL ? 'إغلاق ومتابعة العمليات' : 'Close & Continue'}
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {isRTL ? 'إعادة تحميل الصفحة' : 'Refresh Application'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Rollback Info Banner */}
                  <div className="bg-violet-950/40 border border-violet-500/40 rounded-xl p-4 text-xs text-violet-200 flex items-start gap-3">
                    <RotateCcw className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-bold text-violet-100 text-sm">
                        {isRTL
                          ? 'استرجاع لقطات الأمان مباشرة من Firebase Storage'
                          : 'Direct Snapshot Restoration from Firebase Storage'}
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        {isRTL
                          ? 'في حال حدوث مسح غير مقصود عبر أداة تفريغ السحابة (Bulk-Wipe)، يمكنك استعادة أحدث لقطة أمان محفوظة تلقائياً وإعادة كتابة كافة السجلات في Firestore بنقرة واحدة.'
                          : 'In case of an accidental bulk-wipe, you can restore the most recent pre-wipe safety snapshot directly from Firebase Storage.'}
                      </p>
                    </div>
                  </div>

                  {/* Pre-Wipe / Recent Snapshots Selector */}
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-bold text-slate-300 flex items-center justify-between">
                      <span>{isRTL ? 'اختر لقطة التخزين السحابي للاسترجاع:' : 'Select Cloud Snapshot to Restore:'}</span>
                      <button
                        type="button"
                        onClick={fetchRollbackSnapshots}
                        className="text-violet-400 hover:text-violet-300 flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingPreWipe ? 'animate-spin' : ''}`} />
                        {isRTL ? 'تحديث السجلات' : 'Refresh'}
                      </button>
                    </div>

                    {isLoadingPreWipe ? (
                      <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                        {isRTL ? 'جاري جلب سجلات النسخ من Firebase Storage...' : 'Fetching snapshots from Firebase Storage...'}
                      </div>
                    ) : recentSnapshots.length === 0 ? (
                      <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center text-xs font-mono text-slate-400">
                        {isRTL ? 'لا توجد لقطات أمان مسجلة في التخزين السحابي حالياً.' : 'No cloud snapshots recorded yet.'}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-44 overflow-y-auto">
                        {recentSnapshots.map((snap) => {
                          const isSelected = selectedSnapshotForRollback?.id === snap.id;
                          return (
                            <div
                              key={snap.id}
                              onClick={() => setSelectedSnapshotForRollback(snap)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                isSelected
                                  ? 'bg-violet-950/40 border-violet-500/60 text-white shadow-md'
                                  : 'bg-black/40 border-white/5 text-slate-400 hover:border-white/15'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div className={`w-2 h-2 rounded-full ${snap.isPreWipe ? 'bg-amber-400' : 'bg-violet-400'}`} />
                                <div className="truncate">
                                  <div className="font-mono font-bold text-slate-200 flex items-center gap-2">
                                    <span className="truncate">{snap.fileName}</span>
                                    {snap.isPreWipe && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        PRE_WIPE
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {new Date(snap.createdAt).toLocaleString()} • {snap.storagePath}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right font-mono flex-shrink-0">
                                <div className="text-violet-300 font-bold text-xs">
                                  {(snap.totalDocuments || 0).toLocaleString()} docs
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  {snap.fileSizeBytes ? `${Math.round(snap.fileSizeBytes / 1024)} KB` : 'Ready'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Selected Snapshot Payload Preview */}
                  {isFetchingRollbackPayload ? (
                    <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-violet-400" />
                      {isRTL ? 'جاري فحص وتنزيل اللقطة من Firebase Storage...' : 'Downloading and analyzing snapshot payload...'}
                    </div>
                  ) : rollbackError ? (
                    <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-200 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-bold text-rose-100">{isRTL ? 'تعذر جلب اللقطة' : 'Failed to Load Snapshot'}</div>
                        <p className="text-slate-300">{rollbackError}</p>
                      </div>
                    </div>
                  ) : rollbackSnapshotData ? (
                    <div className="bg-black/40 border border-violet-500/30 rounded-xl p-3.5 space-y-2.5 font-mono text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-white/5">
                        <span>{isRTL ? 'تفاصيل اللقطة الجاهزة للاستعادة:' : 'Snapshot Details for Rollback:'}</span>
                        <span className="text-violet-300 font-bold">
                          {rollbackSnapshotData.metadata?.totalDocuments?.toLocaleString() || 0} docs
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {Object.entries(rollbackSnapshotData.collections || {}).map(([col, docs]) => {
                          const count = Array.isArray(docs) ? docs.length : 0;
                          return (
                            <span
                              key={col}
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                count > 0
                                  ? 'bg-violet-950/60 border border-violet-500/30 text-violet-200'
                                  : 'bg-white/5 text-slate-500'
                              }`}
                            >
                              {col}: <strong className="text-white">{count}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Execution Logs */}
                  {isExecutingRollback && (
                    <div className="bg-black/70 border border-violet-500/30 rounded-xl p-3 font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto">
                      <div className="text-slate-400 text-[10px] pb-1 border-b border-white/5 flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
                        {isRTL ? 'سجل عمليات الاسترجاع:' : 'Rollback Telemetry:'}
                      </div>
                      {rollbackLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={
                            log.startsWith('✓')
                              ? 'text-emerald-400'
                              : log.startsWith('❌')
                              ? 'text-rose-400'
                              : 'text-violet-300'
                          }
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmation Input Gate */}
                  {rollbackSnapshotData && !isExecutingRollback && (
                    <div className="bg-slate-900/60 border border-amber-500/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-2.5 text-xs text-amber-200">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span>
                          {isRTL
                            ? 'تحذير: سيتم استبدال ودمج السجلات الحالية في Firestore بالنسخة المحفوظة وإعادة تنشيط أرصدة المخزون.'
                            : 'Warning: This will merge the archived snapshot records into Firestore and re-sync local state.'}
                        </span>
                      </div>

                      <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isRollbackConfirmed}
                          onChange={(e) => setIsRollbackConfirmed(e.target.checked)}
                          className="rounded border-slate-700 text-violet-500 focus:ring-violet-500/20"
                        />
                        <span>
                          {isRTL
                            ? 'أؤكد رغبتي في استرجاع هذه اللقطة لقاعدة بيانات المصنع الحية'
                            : 'I confirm restoring this snapshot into live factory database'}
                        </span>
                      </label>

                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-mono text-slate-400">
                          {isRTL
                            ? `لتأكيد العملية، يرجى كتابة كلمة "${requiredRollbackConfirmWord}":`
                            : `To confirm, please type "${requiredRollbackConfirmWord}":`}
                        </div>
                        <input
                          type="text"
                          value={confirmRollbackText}
                          onChange={(e) => setConfirmRollbackText(e.target.value)}
                          placeholder={requiredRollbackConfirmWord}
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Rollback Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isExecutingRollback}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-bold font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </button>

                    <button
                      type="button"
                      onClick={handleExecuteRollback}
                      disabled={!isRollbackReady || isExecutingRollback}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                        isRollbackReady && !isExecutingRollback
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-950/60 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      {isExecutingRollback ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          {isRTL ? 'جاري تنفيذ الاسترجاع الشامل...' : 'Executing Bulk Rollback...'}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          {isRTL ? 'استرجاع اللقطة لقاعدة البيانات' : 'Restore Snapshot to Firestore'}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
