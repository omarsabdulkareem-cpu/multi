import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Database,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  FileJson,
  Layers,
  Boxes,
  Users,
  Building2,
  Clock,
  HardDrive,
  ArrowRight,
  Lock,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { FirebaseService, DatabaseSnapshot } from '../services/firebase';
import { CloudStorageSnapshotRecord, BulkRollbackResult } from '../types';

interface BulkRollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSnapshotRecord?: CloudStorageSnapshotRecord | null;
  onRollbackComplete?: (result: BulkRollbackResult) => void;
}

export const BulkRollbackModal: React.FC<BulkRollbackModalProps> = ({
  isOpen,
  onClose,
  targetSnapshotRecord,
  onRollbackComplete,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser, restoreSnapshotIntoContext } = useFactory();

  // Lifecycle & Data Fetching
  const [isLoadingRecord, setIsLoadingRecord] = useState<boolean>(true);
  const [snapshotRecord, setSnapshotRecord] = useState<CloudStorageSnapshotRecord | null>(null);
  const [isFetchingPayload, setIsFetchingPayload] = useState<boolean>(false);
  const [loadedSnapshot, setLoadedSnapshot] = useState<DatabaseSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Confirmation state
  const [confirmText, setConfirmText] = useState<string>('');
  const [isAcknowledged, setIsAcknowledged] = useState<boolean>(false);

  // Execution state
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [progressState, setProgressState] = useState<{
    currentCol: string;
    colRestored: number;
    totalRestored: number;
  }>({ currentCol: '', colRestored: 0, totalRestored: 0 });

  // Completion state
  const [rollbackResult, setRollbackResult] = useState<BulkRollbackResult | null>(null);

  // Fetch target snapshot or latest pre-wipe snapshot on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingRecord(true);
    setLoadedSnapshot(null);
    setLoadError(null);
    setRollbackResult(null);
    setExecutionLogs([]);
    setConfirmText('');
    setIsAcknowledged(false);

    const init = async () => {
      try {
        let record = targetSnapshotRecord;
        if (!record) {
          record = await FirebaseService.getLatestPreWipeSnapshot();
        }
        if (!isMounted) return;
        setSnapshotRecord(record);
        setIsLoadingRecord(false);

        // Pre-fetch snapshot payload to inspect contents
        if (record) {
          setIsFetchingPayload(true);
          try {
            const snapshot = await FirebaseService.fetchSnapshotFromFirebaseStorage(record);
            if (isMounted) {
              setLoadedSnapshot(snapshot);
              setIsFetchingPayload(false);
            }
          } catch (err: any) {
            if (isMounted) {
              setLoadError(err?.message || 'Failed to download snapshot payload from storage');
              setIsFetchingPayload(false);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setIsLoadingRecord(false);
          setLoadError(err?.message || 'Failed to locate pre-wipe snapshot record');
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetSnapshotRecord]);

  if (!isOpen) return null;

  const requiredConfirmWord = isRTL ? 'استرجاع' : 'RESTORE';
  const isConfirmValid = confirmText.trim().toUpperCase() === requiredConfirmWord.toUpperCase() && isAcknowledged;

  // Execute Bulk Rollback
  const handleExecuteRollback = async () => {
    if (!loadedSnapshot || !isConfirmValid || isExecuting) return;

    setIsExecuting(true);
    setExecutionLogs([
      isRTL
        ? `[1/4] بدء عملية الاسترجاع الشامل (Bulk Rollback) بإشراف المشرف: ${currentUser.nameAr || currentUser.name}...`
        : `[1/4] Initializing bulk database rollback under supervisor: ${currentUser.name}...`,
    ]);

    try {
      // 1. Restore documents into Firestore collections in chunks
      const result = await FirebaseService.restoreDatabaseSnapshot(loadedSnapshot, {
        user: {
          name: currentUser.nameAr || currentUser.name,
          email: currentUser.email,
        },
        onProgress: (colName, restoredInCol, totalRestored) => {
          setProgressState({
            currentCol: colName,
            colRestored: restoredInCol,
            totalRestored,
          });
          setExecutionLogs((prev) => [
            ...prev,
            `✓ ${isRTL ? 'استعادة' : 'Restored'} ${restoredInCol} ${isRTL ? 'سجل في' : 'docs in'} [${colName}] (${totalRestored} ${isRTL ? 'إجمالي حتى الآن' : 'total so far'})`,
          ]);
        },
      });

      setExecutionLogs((prev) => [
        ...prev,
        isRTL
          ? `[2/4] تم كتابة ${result.totalRestored} سجل بنجاح في قاعدة بيانات Firestore.`
          : `[2/4] Successfully committed ${result.totalRestored} records into Firestore database.`,
        isRTL
          ? '[3/4] جاري تحديث الذاكرة التشغيلية للنظام ومزامنة التخزين المحلي (LocalStorage)...'
          : '[3/4] Synchronizing in-memory application context and local storage...',
      ]);

      // 2. Synchronize FactoryContext state so the user sees restored data immediately without manual reload
      const contextSync = restoreSnapshotIntoContext(loadedSnapshot);

      setExecutionLogs((prev) => [
        ...prev,
        isRTL
          ? `[4/4] تمت المزامنة الشاملة بنجاح (${contextSync.totalRestored} سجل متزامن في الواجهة عبر ${contextSync.collectionsRestored.length} مجموعة).`
          : `[4/4] In-memory synchronization completed (${contextSync.totalRestored} records updated across ${contextSync.collectionsRestored.length} collections).`,
      ]);

      setRollbackResult(result);
      setIsExecuting(false);

      if (onRollbackComplete) {
        onRollbackComplete(result);
      }
    } catch (err: any) {
      console.error('Bulk Rollback Execution Error:', err);
      setExecutionLogs((prev) => [
        ...prev,
        `❌ ${isRTL ? 'فشل تنفيذ الاسترجاع:' : 'Rollback execution failed:'} ${err?.message || 'Error'}`,
      ]);
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
      <div className="bg-[#0e1017] border border-violet-500/40 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl relative my-8">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-violet-950/90 via-slate-900 to-[#0e1017] border-b border-violet-500/30 p-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-500/20 border border-violet-500/50 flex items-center justify-center text-violet-300">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40 uppercase">
                  {isRTL ? 'استرجاع طوارئ سحابي (BULK ROLLBACK)' : 'EMERGENCY CLOUD ROLLBACK'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {currentUser.email || currentUser.badgeNumber}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
                <Database className="w-5 h-5 text-violet-400" />
                {isRTL
                  ? 'استعادة لقطة ما قبل المسح من Firebase Storage'
                  : 'Restore Pre-Wipe Snapshot from Firebase Storage'}
              </h2>
            </div>
          </div>

          {!isExecuting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Success Result View */}
          {rollbackResult ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {isRTL ? 'تمت استعادة قاعدة البيانات بنجاح تام!' : 'Bulk Database Rollback Completed!'}
                </h3>
                <p className="text-slate-300 text-sm mt-1 max-w-md mx-auto">
                  {isRTL
                    ? `تمت استعادة ${rollbackResult.totalRestored.toLocaleString()} سجل عبر مجموعات Firestore ومزامنة الواجهة التشغيلية بالكامل.`
                    : `Successfully restored ${rollbackResult.totalRestored.toLocaleString()} documents across Firestore collections and synchronized client memory.`}
                </p>
              </div>

              {/* Restored collections badge breakdown */}
              {rollbackResult.details && Object.keys(rollbackResult.details).length > 0 && (
                <div className="bg-black/50 border border-white/10 rounded-xl p-4 max-w-lg mx-auto text-left font-mono text-xs">
                  <div className="text-slate-400 text-[11px] mb-2 font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-violet-400" />
                    {isRTL ? 'تفاصيل السجلات المستعادة بكل مجموعة:' : 'Restored Documents by Collection:'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(rollbackResult.details).map(([col, cnt]) => (
                      <div key={col} className="bg-slate-900/80 border border-white/5 rounded p-1.5 flex justify-between">
                        <span className="text-slate-300 truncate">{col}:</span>
                        <span className="text-emerald-400 font-bold">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Post-Rollback Actions */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {isRTL ? 'إغلاق ومتابعة العمليات' : 'Close & Continue Operations'}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  {isRTL ? 'تحديث كامل للصفحة' : 'Hard Refresh Application'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Alert Warning Box */}
              <div className="bg-violet-950/40 border border-violet-500/40 rounded-xl p-4 text-xs text-violet-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-violet-100 text-sm">
                    {isRTL
                      ? 'ميزة الأمان واسترجاع الكوارث من التخزين السحابي (Disaster Recovery)'
                      : 'Disaster Recovery & Direct Firebase Storage Restoration'}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {isRTL
                      ? 'تقوم هذه الأداة بجلب نسخة الأمان المحفوظة تلقائياً في Firebase Storage قبل عملية المسح، وإعادة كتابتها في Firestore وإعادة مزامنة الذاكرة المؤقتة لتصحيح أي مسح غير مقصود بنقرة واحدة.'
                      : 'This utility fetches the safety snapshot stored automatically in Firebase Storage before a bulk-wipe, rewriting the documents back into Firestore and resyncing client memory in case of accidental deletion.'}
                  </p>
                </div>
              </div>

              {/* Loading Record / Payload State */}
              {(isLoadingRecord || isFetchingPayload) && (
                <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 text-center space-y-3 font-mono">
                  <RefreshCw className="w-6 h-6 text-violet-400 animate-spin mx-auto" />
                  <div className="text-sm text-slate-300 font-bold">
                    {isLoadingRecord
                      ? isRTL
                        ? 'جاري التحقق من سجلات النسخ الاحتياطية في Firebase Storage...'
                        : 'Checking Firebase Storage snapshot registry...'
                      : isRTL
                      ? 'جاري تنزيل وفحص محتويات لقطة الأمان من Firebase Storage...'
                      : 'Downloading & inspecting snapshot payload from Firebase Storage...'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {snapshotRecord?.storagePath || 'snapshots/pre_wipe/...'}
                  </div>
                </div>
              )}

              {/* Error Box if no snapshot exists or failed to fetch */}
              {loadError && !isLoadingRecord && (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-rose-100 text-sm">
                      {isRTL ? 'تعذر جلب نسخة ما قبل المسح' : 'Could Not Retrieve Pre-Wipe Snapshot'}
                    </div>
                    <p className="text-slate-300 leading-relaxed">{loadError}</p>
                  </div>
                </div>
              )}

              {/* Snapshot Details Card */}
              {snapshotRecord && (
                <div className="bg-black/50 border border-violet-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        {snapshotRecord.isPreWipe ? 'PRE_WIPE SNAPSHOT' : 'CLOUD SNAPSHOT'}
                      </span>
                      <span className="text-xs font-mono font-bold text-white truncate max-w-xs">
                        {snapshotRecord.fileName}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(snapshotRecord.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                    <div className="bg-slate-900/80 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'إجمالي السجلات:' : 'Total Docs:'}</div>
                      <div className="text-violet-300 font-bold text-sm mt-0.5">
                        {(loadedSnapshot?.metadata?.totalDocuments || snapshotRecord.totalDocuments || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-900/80 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'المجموعات:' : 'Collections:'}</div>
                      <div className="text-cyan-300 font-bold text-sm mt-0.5">
                        {loadedSnapshot ? Object.keys(loadedSnapshot.collections).length : '--'}
                      </div>
                    </div>
                    <div className="bg-slate-900/80 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'الحجم التقريبي:' : 'Est. Size:'}</div>
                      <div className="text-amber-300 font-bold text-sm mt-0.5">
                        {snapshotRecord.fileSizeBytes
                          ? `${Math.round(snapshotRecord.fileSizeBytes / 1024)} KB`
                          : 'Valid'}
                      </div>
                    </div>
                    <div className="bg-slate-900/80 border border-white/5 rounded-lg p-2.5">
                      <div className="text-slate-400">{isRTL ? 'المسار السحابي:' : 'Bucket Path:'}</div>
                      <div className="text-slate-300 truncate text-[10px] mt-1" title={snapshotRecord.storagePath}>
                        {snapshotRecord.storagePath}
                      </div>
                    </div>
                  </div>

                  {/* Collections Breakdown Preview */}
                  {loadedSnapshot && loadedSnapshot.collections && (
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center gap-1.5">
                        <Boxes className="w-3.5 h-3.5 text-violet-400" />
                        {isRTL ? 'المجموعات الجاهزة للاستعادة في Firestore:' : 'Collections Prepared for Restoration:'}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {Object.entries(loadedSnapshot.collections).map(([col, docs]) => {
                          const count = Array.isArray(docs) ? docs.length : 0;
                          return (
                            <span
                              key={col}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
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
                  )}
                </div>
              )}

              {/* Execution Progress Bar & Logs */}
              {isExecuting && (
                <div className="bg-black/70 border border-violet-500/30 rounded-xl p-4 font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-xs text-violet-300 font-bold">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                      {isRTL
                        ? `جاري استعادة مجموعة [${progressState.currentCol || '...'}]:`
                        : `Restoring collection [${progressState.currentCol || '...'}]...`}
                    </span>
                    <span>{progressState.totalRestored} docs</span>
                  </div>

                  <div className="bg-slate-900 border border-white/5 rounded-lg p-2.5 max-h-28 overflow-y-auto space-y-1">
                    {executionLogs.map((log, idx) => (
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
                </div>
              )}

              {/* Confirmation Gate (Only if snapshot loaded and not executing) */}
              {loadedSnapshot && !isExecuting && (
                <div className="bg-slate-900/60 border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      {isRTL
                        ? 'تنبيه: عملية الاسترجاع ستقوم بدمج وكتابة السجلات السابقة داخل Firestore، وإلغاء حالة (Clean Slate) وتحديث الأرصدة.'
                        : 'Notice: This rollback will merge & write archived documents into Firestore, clearing Clean Slate mode and restoring inventory state.'}
                    </span>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAcknowledged}
                      onChange={(e) => setIsAcknowledged(e.target.checked)}
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
                        ? `لتأكيد العملية، يرجى كتابة كلمة "${requiredConfirmWord}" في الحقل أدناه:`
                        : `To confirm, please type "${requiredConfirmWord}" in the field below:`}
                    </div>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={requiredConfirmWord}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isExecuting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-bold font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleExecuteRollback}
                  disabled={!isConfirmValid || isExecuting || !loadedSnapshot}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                    isConfirmValid && !isExecuting && loadedSnapshot
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-950/60 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      {isRTL ? 'جاري تنفيذ الاسترجاع الشامل...' : 'Executing Bulk Rollback...'}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      {isRTL ? 'تأكيد واسترجاع اللقطة الآن' : 'Confirm & Restore Snapshot'}
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
