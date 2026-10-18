import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck,
  Scale,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  FileText,
  Flame,
  Boxes,
  HelpCircle,
  Activity,
  Zap,
  Printer,
  ChevronRight,
  Sparkles,
  Wifi,
  WifiOff,
  RefreshCw,
  Cpu,
  Radio,
  SlidersHorizontal,
  FileSpreadsheet,
  QrCode,
  Scan,
  Camera,
  Clock,
  Gauge,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  AlertOctagon,
  Siren,
  Volume2,
  Save,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { WorkflowProgressTracker } from './WorkflowProgressTracker';
import { ReceivingTransaction, MaterialCondition } from '../types';
import { WeighbridgeIndicator, ScaleConnectionStatus } from './WeighbridgeIndicator';
import { StatusBadge } from './StatusBadge';
import { BulkBagQrGenerator } from './BulkBagQrGenerator';
import { VoiceScaleEntryAssistant } from './VoiceScaleEntryAssistant';
import { QrBatchScannerModal } from './QrBatchScannerModal';
import { BatchLifecycleModal } from './BatchLifecycleModal';
import { ReceivingBatchQrPrintModal } from './ReceivingBatchQrPrintModal';
import { MaterialAlertModal } from './MaterialAlertModal';
import { MaterialAlertBanner } from './MaterialAlertBanner';
import { MaterialQuarantineTestModal } from './MaterialQuarantineTestModal';
import {
  checkMaterialAlertStatus,
  playMaterialWarningAlarm,
  stopMaterialWarningAlarm,
  MaterialAlertInfo,
} from '../services/materialAlertService';
import {
  ReceivingScanHistoryTable,
  QrScanHistoryItem,
  INITIAL_SCAN_HISTORY,
} from './ReceivingScanHistoryTable';
import { ReceivingScanHistorySummaryCard } from './ReceivingScanHistorySummaryCard';
import {
  loadScanHistoryFromIndexedDB,
  saveScanHistoryToIndexedDB,
  undoLastScanInIndexedDB,
  bulkUndoScanHistoryInIndexedDB,
  deleteScanHistoryItemFromIndexedDB,
  clearScanHistoryInIndexedDB,
  getScanHistoryStatsFromIndexedDB,
  ScanHistoryDBStats,
} from '../services/scanHistoryIndexedDB';
import { ScaleInDraftBanner } from './ScaleInDraftBanner';
import {
  saveScaleInDraftToIndexedDB,
  loadScaleInDraftFromIndexedDB,
  deleteScaleInDraftFromIndexedDB,
  hasMeaningfulDraftContent,
  ScaleInDraft,
} from '../services/scaleInDraftsIndexedDB';
import { ScaleToleranceAlertBanner } from './ScaleToleranceAlertBanner';
import { ScaleToleranceConfigModal } from './ScaleToleranceConfigModal';
import { evaluateReceivingWeightTolerances } from '../services/weightToleranceService';
import { WeightAnomalyAlertBanner } from './WeightAnomalyAlertBanner';
import { WeightAnomalyDaemonModal } from './WeightAnomalyDaemonModal';
import {
  weightAnomalyDaemon,
  WeightAnomalyReport,
} from '../services/weightAnomalyDaemon';
import { ScalePredictiveMaintenanceAlertCard } from './ScalePredictiveMaintenanceAlertCard';
import {
  evaluateScalePredictiveMaintenance,
  ScalePredictiveMaintenanceAlert,
} from '../services/scalePredictiveMaintenanceService';

interface ReceivingModuleProps {
  initialTab?: 'LIST' | 'SCALE_IN' | 'UNLOADING' | 'SCALE_OUT' | 'LIVE_SCALE' | 'CONFIRM' | 'SCAN_HISTORY';
}

export const ReceivingModule: React.FC<ReceivingModuleProps> = ({ initialTab = 'LIST' }) => {
  const { t, isRTL } = useLanguage();
  const {
    receivingTransactions,
    materials,
    suppliers,
    warehouses,
    locations,
    currentUser,
    createReceivingTransaction,
    completeScaleIn,
    completeUnloading,
    completeScaleOut,
    confirmReceivingAndRoute,
    selectedTransactionId,
    setSelectedTransactionId,
    setCurrentPage,
    currentPage,
    bulkBags,
    logAudit,
    updateMaterial,
  } = useFactory();

  const [activeTab, setActiveTab] = useState<'LIST' | 'SCALE_IN' | 'UNLOADING' | 'SCALE_OUT' | 'LIVE_SCALE' | 'CONFIRM' | 'SCAN_HISTORY'>(
    initialTab
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // QR Scanning & Batch Lifecycle States
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [lifecycleBatchPayload, setLifecycleBatchPayload] = useState<any>(null);
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);

  // Material Alert States (Quarantined / Expired Materials in Database)
  const [activeMaterialAlert, setActiveMaterialAlert] = useState<MaterialAlertInfo | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isQuarantineTestModalOpen, setIsQuarantineTestModalOpen] = useState(false);

  // Count of quarantined and expired materials
  const quarantinedMaterialsCount = useMemo(() => {
    return materials.filter((m) => m.isQuarantined || m.status === 'QUARANTINED').length;
  }, [materials]);

  const expiredMaterialsCount = useMemo(() => {
    return materials.filter((m) => m.isExpired || m.status === 'EXPIRED').length;
  }, [materials]);

  // QR Scan History State (Persisted in IndexedDB & localStorage, capped at last 10)
  const [scanHistory, setScanHistory] = useState<QrScanHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('alkarwan_receiving_qr_scan_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 10);
        }
      }
    } catch (e) {
      console.warn('Failed to load scan history from localStorage', e);
    }
    return INITIAL_SCAN_HISTORY;
  });

  // Load Scan History from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    loadScanHistoryFromIndexedDB()
      .then((records) => {
        if (isMounted && records && records.length > 0) {
          setScanHistory(records);
        }
      })
      .catch((err) => {
        console.warn('Failed to load scan history from IndexedDB:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // IndexedDB Scan History Aggregated Metrics State
  const [scanDbStats, setScanDbStats] = useState<ScanHistoryDBStats | null>(null);
  const [scanDbStatsRefreshTrigger, setScanDbStatsRefreshTrigger] = useState(0);

  const refreshScanDbStats = useCallback(async () => {
    try {
      const stats = await getScanHistoryStatsFromIndexedDB();
      setScanDbStats(stats);
    } catch (e) {
      console.warn('Failed to load scan history stats from IndexedDB:', e);
    }
  }, []);

  // Keep summary card in sync whenever scan history changes or mounts
  useEffect(() => {
    refreshScanDbStats();
  }, [scanHistory, refreshScanDbStats]);

  // Toggle for showing Scan History inside LIST tab
  const [isScanHistoryVisibleInList, setIsScanHistoryVisibleInList] = useState(true);

  const handleInspectAlert = (item: QrScanHistoryItem) => {
    const alertInfo = checkMaterialAlertStatus(item.qrCode || item.materialId, materials, bulkBags);
    if (alertInfo) {
      setActiveMaterialAlert(alertInfo);
    } else {
      setActiveMaterialAlert({
        isAlert: true,
        type: item.isQuarantined ? 'QUARANTINED' : 'EXPIRED',
        status: item.isQuarantined ? 'QUARANTINED' : 'EXPIRED',
        materialId: item.materialId,
        materialCode: item.materialCode,
        materialNameAr: item.materialName,
        materialNameEn: item.materialName,
        reason: item.alertReason || 'Material flagged in database',
        reasonAr: item.alertReason || (item.isQuarantined ? 'خامة محجورة رقابياً' : 'خامة منتهية الصلاحية'),
        directiveEn: item.isQuarantined ? 'Quarantine immediately. Do not process.' : 'Expired material. Prohibit usage.',
        directiveAr: item.isQuarantined ? 'عزل فوري في ساحة الحجر. يمنع الإدخال لخطوط الإنتاج.' : 'خامة منتهية. يمنع الاستخدام والتغذية المباشرة.',
        scannedCode: item.qrCode,
      });
    }
    setIsAlertModalOpen(true);
  };

  const handleToggleMaterialQuarantine = (materialId: string, isQuarantined: boolean, reason?: string) => {
    updateMaterial(materialId, {
      isQuarantined,
      status: isQuarantined ? 'QUARANTINED' : 'ACTIVE',
      quarantineReason: isQuarantined ? (reason || 'حجز مخزني وقائي لفحص الجودة ومطابقة المواصفات') : undefined,
      quarantinedAt: isQuarantined ? new Date().toISOString() : undefined,
      quarantinedBy: isQuarantined ? (currentUser.nameAr || currentUser.name) : undefined,
    });
    setSuccessMessage(
      isRTL
        ? `تم تحديث حالة الحجر للخامة (${materialId}): ${isQuarantined ? 'تم تفعيل الحجر الرقابي 🔒' : 'تم رفع الحجر الرقابي بنجاح ✓'}`
        : `Updated quarantine status for (${materialId}): ${isQuarantined ? 'Quarantined' : 'Active'}`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleToggleMaterialExpired = (materialId: string, isExpired: boolean, expiryDate?: string) => {
    updateMaterial(materialId, {
      isExpired,
      status: isExpired ? 'EXPIRED' : 'ACTIVE',
      expiryDate: isExpired ? (expiryDate || '2025-12-31') : '2027-12-31',
    });
    setSuccessMessage(
      isRTL
        ? `تم تحديث صلاحية الخامة (${materialId}): ${isExpired ? 'تم تسجيلها منتهية الصلاحية ⚠️' : 'تم تمديد الصلاحية كخامة صالحة ✓'}`
        : `Updated expiry status for (${materialId}): ${isExpired ? 'Expired' : 'Valid'}`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleSimulateScan = (scannedText: string) => {
    const alertInfo = checkMaterialAlertStatus(scannedText, materials, bulkBags);
    setActiveMaterialAlert(alertInfo);
    if (alertInfo && alertInfo.isAlert) {
      playMaterialWarningAlarm(alertInfo.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
      setIsAlertModalOpen(true);
    }
    handleRecordQrScan({
      materialId: alertInfo?.materialId || scannedText,
      materialCode: alertInfo?.materialCode || scannedText,
      qrCode: scannedText,
      weightKG: 1000,
      bulkBagsCount: 1,
      notes: alertInfo?.isAlert ? `⚠️ محاكاة مسح: ${alertInfo.reasonAr}` : 'محاكاة مسح ضوئي تجريبي',
      isQuarantined: alertInfo?.type === 'QUARANTINED' || alertInfo?.type === 'BOTH',
      isExpired: alertInfo?.type === 'EXPIRED' || alertInfo?.type === 'BOTH',
      status: alertInfo?.isAlert ? (alertInfo.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED') : 'NORMAL',
      alertReason: alertInfo?.reasonAr,
    });
  };

  const handleRecordQrScan = (data: {
    materialId: string;
    materialCode?: string;
    materialName?: string;
    qrCode: string;
    weightKG?: number;
    bulkBagsCount?: number;
    supplierName?: string;
    vehiclePlate?: string;
    notes?: string;
    isQuarantined?: boolean;
    isExpired?: boolean;
    status?: 'NORMAL' | 'QUARANTINED' | 'EXPIRED' | 'BLOCKED';
    alertReason?: string;
  }) => {
    const now = new Date();
    const alertInfo = checkMaterialAlertStatus(data.qrCode || data.materialId, materials, bulkBags);
    const isQuarantined = Boolean(
      data.isQuarantined ||
      (alertInfo?.isAlert && (alertInfo.type === 'QUARANTINED' || alertInfo.type === 'BOTH'))
    );
    const isExpired = Boolean(
      data.isExpired ||
      (alertInfo?.isAlert && (alertInfo.type === 'EXPIRED' || alertInfo.type === 'BOTH'))
    );
    const status: 'NORMAL' | 'QUARANTINED' | 'EXPIRED' | 'BLOCKED' = isQuarantined
      ? 'QUARANTINED'
      : isExpired
      ? 'EXPIRED'
      : 'NORMAL';

    if (alertInfo && alertInfo.isAlert) {
      setActiveMaterialAlert(alertInfo);
      playMaterialWarningAlarm(alertInfo.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
    }

    const mat = materials.find((m) => m.id === data.materialId) || (alertInfo ? materials.find((m) => m.id === alertInfo.materialId) : undefined);
    const newEntry: QrScanHistoryItem = {
      id: `SCAN-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now.toISOString(),
      displayTime: now.toTimeString().slice(0, 8),
      date: now.toISOString().slice(0, 10),
      materialId: data.materialId,
      materialCode: data.materialCode || mat?.code || data.materialId,
      materialName: data.materialName || (isRTL ? mat?.nameAr : mat?.nameEn) || mat?.nameAr || mat?.nameEn || 'خامة بلاستيكية',
      qrCode: data.qrCode || `QR-${data.materialId}-${Date.now().toString().slice(-4)}`,
      weightKG: data.weightKG || 1000,
      bulkBagsCount: data.bulkBagsCount || 1,
      supplierName: data.supplierName || 'شركة الكروان للبلاستيك',
      vehiclePlate: data.vehiclePlate || 'IQ-BAG-1082',
      verified: true,
      notes: data.notes || (alertInfo?.isAlert ? `⚠️ ${alertInfo.reasonAr}` : 'تم التحقق من كود QR بنجاح عبر الكاميرا'),
      isQuarantined,
      isExpired,
      status,
      alertReason: data.alertReason || (alertInfo?.isAlert ? (isRTL ? alertInfo.reasonAr : alertInfo.reason) : undefined),
    };

    setScanHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.qrCode !== newEntry.qrCode || Math.abs(new Date(item.timestamp).getTime() - now.getTime()) > 5000
      );
      const updated = [newEntry, ...filtered].slice(0, 10);
      saveScanHistoryToIndexedDB(updated).catch((err) => {
        console.warn('Failed to save scan history to IndexedDB', err);
      });
      return updated;
    });
  };

  const handleUndoLastScan = async () => {
    if (scanHistory.length === 0) return;
    try {
      const { updatedHistory, revertedItem } = await undoLastScanInIndexedDB(scanHistory);
      setScanHistory(updatedHistory);
      setSuccessMessage(
        isRTL
          ? `✓ تم التراجع بنجاح عن آخر مسح خاطئ (${revertedItem?.materialCode || revertedItem?.materialId}) وتحديث قاعدة بيانات IndexedDB المحلية.`
          : `✓ Reverted last mistake scan (${revertedItem?.materialCode || revertedItem?.materialId}) and updated local IndexedDB.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e) {
      console.warn('Undo last scan failed', e);
    }
  };

  const handleBulkUndo = async (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    try {
      const { updatedHistory, revertedItems } = await bulkUndoScanHistoryInIndexedDB(scanHistory, targetIds);
      setScanHistory(updatedHistory);
      setSuccessMessage(
        isRTL
          ? `✓ تم التراجع المجمّع وحذف ${revertedItems.length} مدخلات مسح خاطئة من قاعدة بيانات IndexedDB بنجاح.`
          : `✓ Bulk Undo: Reverted ${revertedItems.length} mistake scan entries from IndexedDB successfully.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (e) {
      console.warn('Bulk undo failed', e);
    }
  };

  const handleUndoSingleScan = async (item: QrScanHistoryItem) => {
    try {
      await deleteScanHistoryItemFromIndexedDB(item.id);
      setScanHistory((prev) => {
        const updated = prev.filter((i) => i.id !== item.id);
        saveScanHistoryToIndexedDB(updated).catch(() => {});
        return updated;
      });
      setSuccessMessage(
        isRTL
          ? `✓ تم التراجع عن المسح (${item.materialCode || item.materialId}) وتحديث IndexedDB.`
          : `✓ Reverted scan entry (${item.materialCode || item.materialId}) and updated IndexedDB.`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      console.warn('Single undo failed', e);
    }
  };

  const handleClearScanHistory = async () => {
    setScanHistory([]);
    await clearScanHistoryInIndexedDB();
    setSuccessMessage(
      isRTL ? '✓ تم مسح سجل المسح بالكامل وتفريغ IndexedDB.' : '✓ Cleared scan history from IndexedDB.'
    );
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRestoreScanHistory = async () => {
    setScanHistory(INITIAL_SCAN_HISTORY);
    await saveScanHistoryToIndexedDB(INITIAL_SCAN_HISTORY);
    setSuccessMessage(
      isRTL ? '✓ تمت استعادة السجل النموذجي وحفظه في IndexedDB.' : '✓ Restored demo scan history in IndexedDB.'
    );
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Batch QR Labels Printing State
  const [selectedTxIdsForBatchPrint, setSelectedTxIdsForBatchPrint] = useState<string[]>([]);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);

  // Real-time Weight Tolerance Monitoring States
  const [isToleranceConfigOpen, setIsToleranceConfigOpen] = useState(false);
  const [toleranceVersion, setToleranceVersion] = useState(0);

  // Scale hardware interface communication states
  const [scaleConnectionStatus, setScaleConnectionStatus] = useState<ScaleConnectionStatus>('CONNECTED');
  const [isForcingReconnect, setIsForcingReconnect] = useState<boolean>(false);
  const [hardwarePort] = useState<string>('COM1:9600-8-N-1 (RS-232 / TCP-IP 192.168.1.120:4001)');
  const [scaleTelemetryPing, setScaleTelemetryPing] = useState<number>(14);

  const handleForceReconnectScale = () => {
    setIsForcingReconnect(true);
    setScaleConnectionStatus('CONNECTING');
    setTimeout(() => {
      setScaleConnectionStatus('CONNECTED');
      setIsForcingReconnect(false);
      setScaleTelemetryPing(11);
      setSuccessMessage(
        isRTL
          ? 'تمت إعادة الاتصال والمزامنة بمتحكم الميزان الجسري بنجاح (COM1:9600-8-N-1 / 11ms)'
          : 'Scale hardware interface reconnected successfully (COM1:9600-8-N-1 / 11ms).'
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1100);
  };

  const handleSimulateTimeoutError = () => {
    if (scaleConnectionStatus === 'TIMEOUT_ERROR') {
      handleForceReconnectScale();
    } else {
      setScaleConnectionStatus('TIMEOUT_ERROR');
      setErrorMessage(
        isRTL
          ? 'تنبيه: انقطاع مهلة الاتصال بحساسات الميزان (ERR_SCALE_TIMEOUT). يرجى الضغط على "إعادة الاتصال بالقوة".'
          : 'Warning: Scale hardware timeout error (ERR_SCALE_TIMEOUT). Please trigger "Force Reconnect".'
      );
    }
  };

  // Active Transaction for editing/viewing
  const [selectedTx, setSelectedTx] = useState<ReceivingTransaction | null>(null);

  // Form states for Scale In
  const [formData, setFormData] = useState({
    supplierId: suppliers[0]?.id || '',
    materialId: materials[0]?.id || '',
    vehiclePlate: '',
    driverName: '',
    driverPhone: '',
    scaleInWeightKG: 28500,
    bulkBagsCount: 20,
    legacyDocumentNumber: '',
    unloadingBay: 'رصيف تفريغ رقم 1 (مستودع الخامات الرئيسي)',
    materialCondition: 'Clean & Sorted' as MaterialCondition,
    requiresShredding: false,
    notes: '',
  });

  // IndexedDB Drafts Mechanism for Scale-In Form (Resilient against page refresh)
  const [savedScaleInDraft, setSavedScaleInDraft] = useState<ScaleInDraft | null>(null);
  const [hasActiveScaleInDraft, setHasActiveScaleInDraft] = useState(false);
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string | null>(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);

  // Load existing Scale-In Draft on mount from IndexedDB (allows resuming after refresh)
  useEffect(() => {
    let isMounted = true;
    loadScaleInDraftFromIndexedDB()
      .then((draft) => {
        if (isMounted && draft && draft.formData) {
          setSavedScaleInDraft(draft);
          setHasActiveScaleInDraft(true);
          setLastDraftSavedTime(draft.displaySavedAt);
        }
      })
      .catch((err) => {
        console.warn('Failed to load scale-in draft from IndexedDB:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-save scale-in form data to IndexedDB with debounce
  useEffect(() => {
    if (!hasMeaningfulDraftContent(formData)) {
      return;
    }

    setIsDraftSaving(true);
    const timer = setTimeout(() => {
      const selectedSupplier = suppliers.find((s) => s.id === formData.supplierId);
      const selectedMat = materials.find((m) => m.id === formData.materialId);

      saveScaleInDraftToIndexedDB(formData, {
        supplierName: selectedSupplier ? (isRTL ? selectedSupplier.nameAr : selectedSupplier.nameEn) : undefined,
        materialName: selectedMat ? (isRTL ? selectedMat.nameAr : selectedMat.nameEn) : undefined,
      })
        .then((draft) => {
          setHasActiveScaleInDraft(true);
          setLastDraftSavedTime(draft.displaySavedAt);
        })
        .catch((err) => {
          console.warn('Failed to auto-save draft to IndexedDB:', err);
        })
        .finally(() => {
          setIsDraftSaving(false);
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [formData, suppliers, materials, isRTL]);

  // Resume Draft into active form
  const handleResumeDraft = () => {
    if (!savedScaleInDraft) return;
    setFormData((prev) => ({
      ...prev,
      ...savedScaleInDraft.formData,
    }));
    setSavedScaleInDraft(null);
    setSuccessMessage(
      isRTL
        ? '✓ تم استئناف وتعبئة مسودة استمارة ميزان الدخول بنجاح من قاعدة بيانات IndexedDB'
        : '✓ Scale-in draft resumed from IndexedDB successfully.'
    );
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Discard Draft from IndexedDB
  const handleDiscardDraft = async () => {
    try {
      await deleteScaleInDraftFromIndexedDB();
      setSavedScaleInDraft(null);
      setHasActiveScaleInDraft(false);
      setLastDraftSavedTime(null);
      setFormData({
        supplierId: suppliers[0]?.id || '',
        materialId: materials[0]?.id || '',
        vehiclePlate: '',
        driverName: '',
        driverPhone: '',
        scaleInWeightKG: 28500,
        bulkBagsCount: 20,
        legacyDocumentNumber: '',
        unloadingBay: 'رصيف تفريغ رقم 1 (مستودع الخامات الرئيسي)',
        materialCondition: 'Clean & Sorted' as MaterialCondition,
        requiresShredding: false,
        notes: '',
      });
      setSuccessMessage(
        isRTL
          ? 'تم حذف المسودة من IndexedDB وبدء استمارة جديدة فارغة'
          : 'Draft discarded from IndexedDB.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.warn('Discard draft failed', e);
    }
  };

  // Manual Save Draft to IndexedDB
  const handleManualSaveDraft = async () => {
    try {
      setIsDraftSaving(true);
      const selectedSupplier = suppliers.find((s) => s.id === formData.supplierId);
      const selectedMat = materials.find((m) => m.id === formData.materialId);

      const draft = await saveScaleInDraftToIndexedDB(formData, {
        supplierName: selectedSupplier ? (isRTL ? selectedSupplier.nameAr : selectedSupplier.nameEn) : undefined,
        materialName: selectedMat ? (isRTL ? selectedMat.nameAr : selectedMat.nameEn) : undefined,
      });
      setHasActiveScaleInDraft(true);
      setLastDraftSavedTime(draft.displaySavedAt);
      setSuccessMessage(
        isRTL
          ? '✓ تم حفظ المسودة الحالية في IndexedDB بنجاح لحمايتها من التحديث أو الإغلاق العرضي'
          : '✓ Scale-in draft saved to IndexedDB successfully.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.warn('Manual save draft failed', e);
    } finally {
      setIsDraftSaving(false);
    }
  };

  // Scale Out input
  const [scaleOutWeightInput, setScaleOutWeightInput] = useState<number>(0);

  // Routing modal states
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routeRequiresShredding, setRouteRequiresShredding] = useState(false);
  const [targetWarehouseId, setTargetWarehouseId] = useState('WH-01');
  const [targetLocationId, setTargetLocationId] = useState('LOC-A01');
  const [bulkBagModalTx, setBulkBagModalTx] = useState<ReceivingTransaction | null>(null);

  // Real-time Tolerance Evaluations for Live Scale & Input Forms
  const scaleInTolerance = useMemo(() => {
    return evaluateReceivingWeightTolerances({
      scaleInWeightKG: formData.scaleInWeightKG,
      bulkBagsCount: formData.bulkBagsCount,
    });
  }, [formData.scaleInWeightKG, formData.bulkBagsCount, toleranceVersion]);

  const scaleOutTolerance = useMemo(() => {
    if (!selectedTx) return null;
    return evaluateReceivingWeightTolerances({
      scaleInWeightKG: selectedTx.scaleInWeightKG,
      scaleOutWeightKG: scaleOutWeightInput,
      bulkBagsCount: selectedTx.bulkBagsCount,
    });
  }, [selectedTx, scaleOutWeightInput, toleranceVersion]);

  const liveScaleTolerance = useMemo(() => {
    return evaluateReceivingWeightTolerances({
      scaleInWeightKG: formData.scaleInWeightKG || 32450,
      bulkBagsCount: formData.bulkBagsCount || 25,
    });
  }, [formData.scaleInWeightKG, formData.bulkBagsCount, toleranceVersion]);

  // Scale-In Predictive Maintenance Alert (Frequency & Pattern vs Historical Baselines)
  const [scalePredictiveAlertVersion, setScalePredictiveAlertVersion] = useState(0);
  const scalePredictiveAlert: ScalePredictiveMaintenanceAlert = useMemo(() => {
    return evaluateScalePredictiveMaintenance({
      currentScaleInWeightKG: formData.scaleInWeightKG,
      recentScanHistory: scanHistory,
      recentTransactions: receivingTransactions,
    });
  }, [
    formData.scaleInWeightKG,
    scanHistory,
    receivingTransactions,
    scalePredictiveAlertVersion,
  ]);

  // Error & success messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Background Daemon for Weighbridge Weight Anomalies (Suspicious weight jumps / zero drops)
  const [weightAnomalies, setWeightAnomalies] = useState<WeightAnomalyReport[]>([]);
  const [isAnomalyModalOpen, setIsAnomalyModalOpen] = useState(false);

  // Start background monitoring daemon on mount and subscribe to anomaly alerts
  useEffect(() => {
    weightAnomalyDaemon.start({ pollIntervalMs: 3500 });
    const unsubscribe = weightAnomalyDaemon.subscribe((anomalies) => {
      setWeightAnomalies(anomalies);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismissAnomaly = useCallback((id: string) => {
    weightAnomalyDaemon.dismissAnomaly(id);
  }, []);

  const handleClearAllAnomalies = useCallback(() => {
    weightAnomalyDaemon.clearAllAnomalies();
  }, []);

  const handleSimulateAnomalyTest = useCallback(async () => {
    const report = weightAnomalyDaemon.simulateZeroWeightAnomaly();
    if (report) {
      setSuccessMessage(
        isRTL
          ? `⚠️ تم تسجيل فحص محاكاة قفزة وزن غير طبيعية بنجاح (المعرف: ${report.id})`
          : `⚠️ Simulated weight anomaly test event injected (ID: ${report.id})`
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, [isRTL]);

  // Sync tab from props or page navigation
  useEffect(() => {
    if (currentPage === 'scale_out') {
      setActiveTab('SCALE_OUT');
    } else if (currentPage === 'unloading') {
      setActiveTab('UNLOADING');
    } else if (currentPage === 'receiving' && initialTab === 'SCALE_IN') {
      setActiveTab('SCALE_IN');
    }
  }, [currentPage, initialTab]);

  // Sync selected transaction from context
  useEffect(() => {
    if (selectedTransactionId) {
      const found = receivingTransactions.find((r) => r.id === selectedTransactionId);
      if (found) {
        setSelectedTx(found);
        const st = found.status;
        if (st === 'Draft' || st === 'DRAFT' || st === 'Scale In Completed' || st === 'SCALE_IN_COMPLETED') {
          setActiveTab('UNLOADING');
        } else if (st === 'Unloading Completed' || st === 'UNLOADING_COMPLETED') {
          setActiveTab('SCALE_OUT');
          setScaleOutWeightInput(found.scaleOutWeightKG || Math.round(found.scaleInWeightKG * 0.45));
        } else if (st === 'Scale Out Completed' || st === 'SCALE_OUT_COMPLETED') {
          setActiveTab('CONFIRM');
          setRouteRequiresShredding(found.requiresShredding);
        }
      }
    }
  }, [selectedTransactionId, receivingTransactions]);

  // If on SCALE_OUT and no selectedTx, auto-focus first ready truck if available
  useEffect(() => {
    if (activeTab === 'SCALE_OUT' && !selectedTx) {
      const pendingOut = receivingTransactions.find(
        (t) => t.status === 'Unloading Completed' || t.status === 'UNLOADING_COMPLETED'
      );
      if (pendingOut) {
        setSelectedTx(pendingOut);
        setScaleOutWeightInput(pendingOut.scaleOutWeightKG || Math.round(pendingOut.scaleInWeightKG * 0.45));
      }
    }
  }, [activeTab, selectedTx, receivingTransactions]);

  // Update material default flag
  const handleMaterialChange = (matId: string) => {
    const mat = materials.find((m) => m.id === matId);
    const alertInfo = checkMaterialAlertStatus(matId, materials, bulkBags);
    if (alertInfo && alertInfo.isAlert) {
      setActiveMaterialAlert(alertInfo);
      playMaterialWarningAlarm(alertInfo.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
    }
    setFormData((prev) => ({
      ...prev,
      materialId: matId,
      requiresShredding: mat ? mat.requiresShredding : false,
      targetWarehouseId: mat ? mat.defaultWarehouseId : 'WH-01',
      targetLocationId: mat ? mat.defaultLocationId : 'LOC-A01',
    }));
  };

  // Submit Scale In
  const handleScaleInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = createReceivingTransaction({
      ...formData,
      scaleInWeightKG: Number(formData.scaleInWeightKG),
      bulkBagsCount: Number(formData.bulkBagsCount),
      operator: currentUser.nameAr,
    });

    if (res.success && res.id) {
      deleteScaleInDraftFromIndexedDB().catch((err) => {
        console.warn('Failed to clear draft after scale-in submission:', err);
      });
      setSavedScaleInDraft(null);
      setHasActiveScaleInDraft(false);
      setLastDraftSavedTime(null);

      setSuccessMessage(
        isRTL
          ? 'تم تسجيل وزن الدخول بنجاح وتوليد إرسالية استلام مواد خامات (مستند 546)'
          : 'Scale In completed successfully. Raw material receipt registered.'
      );
      const created = receivingTransactions.find((r) => r.id === res.id);
      if (created) setSelectedTx(created);
      setActiveTab('LIST');
    } else {
      setErrorMessage(res.error || 'فشلت العملية');
    }
  };

  // Submit Scale Out & calculate Net Weight
  const handleScaleOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTx) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = completeScaleOut(selectedTx.id, Number(scaleOutWeightInput));
    if (res.success) {
      setSuccessMessage(
        isRTL
          ? 'تم تسجيل وزن الخروج (فارغ) واحتساب الوزن الصافي بنجاح'
          : 'Scale Out recorded and Net Weight calculated.'
      );
      // Next ask routing decision
      setRouteRequiresShredding(selectedTx.requiresShredding);
      setShowRoutingModal(true);
    } else {
      setErrorMessage(res.error || 'خطأ في وزن الخروج');
    }
  };

  // Confirm Final Routing
  const handleRoutingConfirm = () => {
    if (!selectedTx) return;
    const res = confirmReceivingAndRoute(
      selectedTx.id,
      routeRequiresShredding,
      targetWarehouseId,
      targetLocationId
    );

    if (res.success) {
      setShowRoutingModal(false);
      setSuccessMessage(
        routeRequiresShredding
          ? isRTL
            ? 'تم تأكيد الاستلام وتوجيه الشحنة إلى مسار الثرم (الثرم) بموجب مستند 546'
            : 'Receiving confirmed and routed to Shredding (Therm) Queue.'
          : isRTL
          ? 'تم تأكيد الاستلام وإيداع الشحنة مباشرة في مستودع الخامات بموجب مستند 546'
          : 'Receiving confirmed and deposited into warehouse storage.'
      );
      if (routeRequiresShredding) {
        setTimeout(() => setCurrentPage('shredding'), 1200);
      } else {
        setActiveTab('LIST');
      }
    } else {
      setErrorMessage(res.error || 'فشل تأكيد المسار');
    }
  };

  // Filtered transactions
  const filteredList = receivingTransactions.filter((r) => {
    const matchesSearch =
      r.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.legacyDocumentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Batch QR Labels Selection Helpers
  const toggleSelectTx = (id: string) => {
    setSelectedTxIdsForBatchPrint((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllFilteredSelected =
    filteredList.length > 0 &&
    filteredList.every((tx) => selectedTxIdsForBatchPrint.includes(tx.id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredList.map((tx) => tx.id));
      setSelectedTxIdsForBatchPrint((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([
        ...selectedTxIdsForBatchPrint,
        ...filteredList.map((tx) => tx.id),
      ]);
      setSelectedTxIdsForBatchPrint(Array.from(combined));
    }
  };

  const clearBatchSelection = () => {
    setSelectedTxIdsForBatchPrint([]);
  };

  const batchSelectedTransactions = useMemo(() => {
    if (selectedTxIdsForBatchPrint.length === 0) {
      return filteredList;
    }
    return receivingTransactions.filter((tx) => selectedTxIdsForBatchPrint.includes(tx.id));
  }, [receivingTransactions, filteredList, selectedTxIdsForBatchPrint]);

  const batchSelectedTotalWeight = useMemo(() => {
    return batchSelectedTransactions.reduce((sum, tx) => {
      const w =
        tx.netReceivedWeightKG && tx.netReceivedWeightKG > 0
          ? tx.netReceivedWeightKG
          : tx.scaleInWeightKG && tx.scaleOutWeightKG
          ? Math.max(0, tx.scaleInWeightKG - tx.scaleOutWeightKG)
          : tx.scaleInWeightKG || 0;
      return sum + w;
    }, 0);
  }, [batchSelectedTransactions]);

  const batchSelectedBagsCount = useMemo(() => {
    return batchSelectedTransactions.reduce((sum, tx) => sum + (tx.bulkBagsCount || 1), 0);
  }, [batchSelectedTransactions]);

  // Pending Queues Counts
  const pendingScaleInCount = receivingTransactions.filter(
    (t) => t.status === 'Draft' || t.status === 'DRAFT'
  ).length;
  const pendingUnloadCount = receivingTransactions.filter(
    (t) => t.status === 'Scale In Completed' || t.status === 'SCALE_IN_COMPLETED'
  ).length;
  const pendingScaleOutCount = receivingTransactions.filter(
    (t) => t.status === 'Unloading Completed' || t.status === 'UNLOADING_COMPLETED'
  ).length;

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              DOC-546 / استلام مواد خامات
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'إدارة بوابة الميزان الجسري والاستلام' : 'Weighbridge & Receiving Intake Control'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-cyan-400" />
            <span>{isRTL ? 'محطة الميزان الجسري واستلام الخامات' : 'Weighbridge & Material Receiving'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'تسجيل وزن الدخول (قائم)، تفريغ الحمولة، وزن الخروج (فارغ)، احتساب الصافي الآلي وتوجيه المادة.'
              : 'Scale in gross weight, unloading, scale out tare, automatic net calculation, and routing.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time Scale Hardware Telemetry Badge */}
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-2 transition-all ${
              scaleConnectionStatus === 'CONNECTED'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : scaleConnectionStatus === 'CONNECTING'
                ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                : 'bg-rose-950/90 border-rose-500/60 text-rose-300'
            }`}
          >
            {scaleConnectionStatus === 'CONNECTED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">SCALE-01: ONLINE</span>
                <span className="text-emerald-400/70 text-[10px]">({scaleTelemetryPing}ms)</span>
              </>
            ) : scaleConnectionStatus === 'CONNECTING' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span className="font-bold">RECONNECTING...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-400" />
                <span className="font-bold">TIMEOUT ERROR</span>
              </>
            )}

            <button
              type="button"
              onClick={handleForceReconnectScale}
              disabled={isForcingReconnect}
              title={isRTL ? 'إعادة فرض الاتصال بمتحكم الميزان' : 'Force Reconnect Hardware Link'}
              className="ms-1 p-1 hover:bg-slate-800 rounded text-cyan-300 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isForcingReconnect ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            onClick={() => setIsQrScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white border border-cyan-400/40 text-xs font-bold shadow-lg shadow-cyan-950/60 cursor-pointer transition-all"
            title={isRTL ? 'مسح باركود وQR إرساليات المواد والوجبات بالكاميرا' : 'Scan batch & receiving QR with camera'}
          >
            <Scan className="w-4 h-4 text-cyan-200 animate-pulse" />
            <span>{isRTL ? 'مسح QR الإرسالية والوجبة (كاميرا)' : 'Scan Batch QR (Camera)'}</span>
          </button>

          {/* Quality & Quarantine Safety Gate Management / Test Modal */}
          <button
            type="button"
            onClick={() => setIsQuarantineTestModalOpen(true)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
              quarantinedMaterialsCount > 0 || expiredMaterialsCount > 0
                ? 'bg-red-950/80 hover:bg-red-900/90 text-red-200 border-red-500/50 shadow-lg shadow-red-950/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title={isRTL ? 'إدارة واختبار حظر الخامات المحجورة ومنتهية الصلاحية' : 'Material Quality & Quarantine Gate Management'}
          >
            <ShieldAlert className={`w-4 h-4 ${quarantinedMaterialsCount > 0 || expiredMaterialsCount > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400'}`} />
            <span>{isRTL ? 'بوابة الحجر والجودة' : 'Quarantine Gate'}</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/50 border border-current">
              {quarantinedMaterialsCount + expiredMaterialsCount}
            </span>
          </button>

          <button
            onClick={() => {
              if (selectedTxIdsForBatchPrint.length === 0) {
                setSelectedTxIdsForBatchPrint(filteredList.map((t) => t.id));
              }
              setIsBatchPrintModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 hover:from-emerald-600 hover:to-cyan-600 text-white border border-emerald-400/40 text-xs font-bold shadow-lg shadow-emerald-950/60 cursor-pointer transition-all"
            title={isRTL ? 'طباعة ملصقات QR لإرساليات المواد دفعة واحدة' : 'Batch print material QR labels'}
          >
            <Printer className="w-4 h-4 text-emerald-200" />
            <span>{isRTL ? 'طباعة QR مجمعة' : 'Batch Print QR'}</span>
            {selectedTxIdsForBatchPrint.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-400/40">
                {selectedTxIdsForBatchPrint.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setSelectedTx(null);
              setSelectedTransactionId(null);
              setActiveTab('LIVE_SCALE');
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer"
          >
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{isRTL ? 'محطة الميزان المباشرة' : 'Live Scale Station'}</span>
          </button>

          {/* Weight Anomaly Daemon Sentinel Status & Control */}
          <button
            onClick={() => setIsAnomalyModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
              weightAnomalies.length > 0
                ? 'bg-red-950/80 hover:bg-red-900 border-red-500/80 text-red-300 animate-pulse shadow-lg shadow-red-950/50'
                : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700 text-slate-300'
            }`}
            title={isRTL ? 'حالة مراقب قفزات وتصفير الوزن بالخلفية' : 'Weighbridge Anomaly Sentinel Status'}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  weightAnomalies.length > 0 ? 'bg-red-400 opacity-75' : 'bg-emerald-400 opacity-75'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  weightAnomalies.length > 0 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
              />
            </span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'مراقب قفزات الوزن' : 'Anomaly Daemon'}</span>
            {weightAnomalies.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-black text-[10px]">
                {weightAnomalies.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentPage('excel_import')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 text-xs font-bold cursor-pointer transition-all"
            title={isRTL ? 'استيراد مستندات استلام 546 من ملف Excel' : 'Import receiving records (546) from Excel'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'استيراد Excel (546)' : 'Import Excel (546)'}</span>
          </button>

          <button
            onClick={() => {
              setSelectedTx(null);
              setSelectedTransactionId(null);
              setActiveTab('SCALE_IN');
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل شاحنة جديدة (وزن دخول)' : 'New Truck Scale In'}</span>
          </button>
        </div>
      </div>

      {/* Active Material Quarantine / Expiry Warning Banner */}
      {activeMaterialAlert && activeMaterialAlert.isAlert && (
        <MaterialAlertBanner
          alert={activeMaterialAlert}
          onOpenDetails={() => setIsAlertModalOpen(true)}
          onDismiss={() => {
            setActiveMaterialAlert(null);
            stopMaterialWarningAlarm();
          }}
        />
      )}

      {/* Weight Anomaly Daemon Alert Banner (Suspicious weight jumps / sudden zero drops in IndexedDB) */}
      <WeightAnomalyAlertBanner
        anomalies={weightAnomalies}
        onDismiss={handleDismissAnomaly}
        onClearAll={handleClearAllAnomalies}
        onSimulateTest={handleSimulateAnomalyTest}
        onInspectScale={() => {
          setActiveTab('LIVE_SCALE');
          setIsAnomalyModalOpen(true);
        }}
      />

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Workflow Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('LIST')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'LIST'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isRTL ? 'سجل الإرساليات (مستند 546)' : 'Receiving Ledger'}</span>
          <span className="px-1.5 py-0.5 bg-slate-800 rounded font-mono text-[10px]">
            {receivingTransactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('LIVE_SCALE')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'LIVE_SCALE'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>{isRTL ? 'الميزان الجسري المباشر' : 'Live Scale Indicator'}</span>
        </button>

        <button
          onClick={() => setActiveTab('SCALE_IN')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'SCALE_IN'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>1. {isRTL ? 'وزن الدخول (قائم)' : '1. Scale In Gross'}</span>
        </button>

        <button
          onClick={() => setActiveTab('UNLOADING')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'UNLOADING'
              ? 'bg-blue-950 text-blue-300 border border-blue-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <PackageCheck className="w-4 h-4 text-blue-400" />
          <span>2. {isRTL ? 'تفريغ الحمولة' : '2. Unloading'}</span>
          {pendingUnloadCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded-full font-mono text-[10px] font-black">
              {pendingUnloadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('SCALE_OUT')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'SCALE_OUT'
              ? 'bg-amber-950 text-amber-300 border border-amber-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-400" />
          <span>3. {isRTL ? 'وزن الخروج (فارغ)' : '3. Scale Out Tare'}</span>
          {pendingScaleOutCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-full font-mono text-[10px] font-black animate-pulse">
              {pendingScaleOutCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('SCAN_HISTORY')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'SCAN_HISTORY'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4 text-cyan-400" />
          <span>{isRTL ? 'سجل المسح الضوئي (QR)' : 'QR Scan History'}</span>
          <span className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded font-mono text-[10px] font-bold">
            {scanHistory.length}
          </span>
        </button>

        {/* Real-time Industrial Scale Hardware Status & Force Reconnect Header Utility */}
        <div className="flex items-center gap-2 ms-auto pe-1">
          {/* Tolerance Monitor Trigger Button */}
          <button
            type="button"
            onClick={() => setIsToleranceConfigOpen(true)}
            className="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border-cyan-500/40 shadow-sm cursor-pointer transition-all"
            title={isRTL ? 'إعدادات وحدود التسامح الوزني الإنتاجي' : 'Configure Production Weight Tolerances'}
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{isRTL ? 'مراقبة التسامح' : 'TOLERANCE MONITOR'}</span>
          </button>

          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-[11px] font-mono font-bold transition-all ${
              scaleConnectionStatus === 'CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-sm'
                : scaleConnectionStatus === 'CONNECTING'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-rose-950/90 text-rose-300 border-rose-500/80 shadow-md shadow-rose-950/50'
            }`}
          >
            {scaleConnectionStatus === 'CONNECTED' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="hidden sm:inline">{isRTL ? 'الميزان متصل' : 'SCALE CONNECTED'}</span>
                <span className="text-[10px] text-emerald-300/80 font-normal">({scaleTelemetryPing}ms)</span>
              </>
            ) : scaleConnectionStatus === 'CONNECTING' ? (
              <>
                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                <span>{isRTL ? 'جاري الاتصال...' : 'CONNECTING...'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="font-black text-rose-300">{isRTL ? 'الميزان غير متصل' : 'SCALE DISCONNECTED'}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleForceReconnectScale}
            disabled={isForcingReconnect}
            title={isRTL ? 'إعادة الاتصال الفوري بمتحكم الميزان الجسري' : 'Force reconnect to weighbridge hardware'}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 ${
              scaleConnectionStatus === 'TIMEOUT_ERROR'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-bounce'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${isForcingReconnect ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isRTL ? 'إعادة الاتصال' : 'Force Reconnect'}</span>
          </button>
        </div>
      </div>

      {/* TAB: LIVE SCALE STATION */}
      {activeTab === 'LIVE_SCALE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <WeighbridgeIndicator
                mode="GROSS"
                defaultPreset={32450}
                onCaptureWeight={(w) => {
                  setFormData((prev) => ({ ...prev, scaleInWeightKG: w }));
                  setSuccessMessage(
                    isRTL
                      ? `تم التقاط الوزن (${w.toLocaleString()} كغم) وتعبئته في استمارة الدخول.`
                      : `Weight (${w.toLocaleString()} KG) captured.`
                  );
                }}
              />

              {/* Real-time Scale Weight Tolerance Monitor Banner */}
              <ScaleToleranceAlertBanner
                evaluation={liveScaleTolerance}
                stage="RECEIVING"
                onThresholdsUpdated={() => setToleranceVersion((v) => v + 1)}
              />

              {/* Voice Scale Entry for Live Weighbridge */}
              <VoiceScaleEntryAssistant
                mode="GROSS"
                compact
                targetLabel={isRTL ? 'إملاء الوزن صوتياً للميزان المباشر لتسريع العمليات اللوجستية' : 'Voice-to-text callout for live weighbridge scale entry'}
                currentValue={formData.scaleInWeightKG}
                onApplyWeight={(w, bags) => {
                  setFormData((prev) => ({
                    ...prev,
                    scaleInWeightKG: w,
                    ...(bags ? { bulkBagsCount: bags } : {}),
                  }));
                  setSuccessMessage(
                    isRTL
                      ? `🎤 تم تحديث الوزن (${w.toLocaleString()} كغم) صوتياً.`
                      : `🎤 Weight (${w.toLocaleString()} KG) updated via voice.`
                  );
                  setTimeout(() => setSuccessMessage(null), 4000);
                }}
                onApplyPlate={(p) => setFormData((prev) => ({ ...prev, vehiclePlate: p }))}
              />

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isRTL ? 'بدء تسجيل الشاحنة على الميزان' : 'Start Vehicle Scale Entry'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {isRTL ? 'الانتقال المباشر لاستمارة تسجيل وزن الدخول أو الخروج' : 'Direct jump to scale ticket registration'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-950 cursor-pointer transition-all"
                    title={isRTL ? 'مسح QR المادة والشاحنة بالكاميرا للتعرف الفوري' : 'Scan material & vehicle QR with camera for instant recognition'}
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-200" />
                    <span>{isRTL ? 'مسح QR (كاميرا)' : 'Camera QR'}</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('SCALE_IN')}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
                  >
                    {isRTL ? 'تسجيل دخول (قائم)' : 'Record Scale In'}
                  </button>
                  <button
                    onClick={() => setActiveTab('SCALE_OUT')}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                  >
                    {isRTL ? 'تسجيل خروج (فارغ)' : 'Record Scale Out'}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              {/* Traffic light & Bay status */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>{isRTL ? 'حالة إشارة وبوابة الميزان' : 'Weighbridge Barrier & Traffic Light'}</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                    {isRTL ? 'البوابة: مفتوحة' : 'Gate: Open'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_12px_#10b981]" />
                    <div>
                      <div className="text-xs font-bold text-white">{isRTL ? 'الإشارة خضراء' : 'Green Signal'}</div>
                      <div className="text-[10px] text-slate-400">{isRTL ? 'الميزان جاهز للمرور' : 'Scale Ready'}</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-slate-700" />
                    <div>
                      <div className="text-xs font-bold text-slate-400">{isRTL ? 'الإشارة حمراء' : 'Red Signal'}</div>
                      <div className="text-[10px] text-slate-500">{isRTL ? 'إيقاف المركبة' : 'Stop Vehicle'}</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'المشرف المسؤول:' : 'Supervisor:'}</span>
                    <span className="font-bold text-cyan-300">عمر عبدالكريم (المشرف العام للتحكم)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'أقصى حمولة مسموحة:' : 'Max Scale Capacity:'}</span>
                    <span className="font-bold font-mono text-white">80,000 KG (80 Ton)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'دقة الحساسات:' : 'Sensor Accuracy:'}</span>
                    <span className="font-bold font-mono text-emerald-400">Class III (±10 KG)</span>
                  </div>
                </div>
              </div>

              {/* Waiting Trucks Summary */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>{isRTL ? 'طابور الشاحنات النشطة' : 'Active Trucks Queue'}</span>
                  <span className="text-xs font-mono text-cyan-400">
                    {pendingUnloadCount + pendingScaleOutCount} {isRTL ? 'شاحنة' : 'Trucks'}
                  </span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {receivingTransactions
                    .filter((t) => t.status !== 'Received' && t.status !== 'Waiting for Shredding')
                    .map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTx(t);
                          setSelectedTransactionId(t.id);
                          if (t.status === 'Unloading Completed' || t.status === 'UNLOADING_COMPLETED') {
                            setActiveTab('SCALE_OUT');
                            setScaleOutWeightInput(t.scaleOutWeightKG || Math.round(t.scaleInWeightKG * 0.45));
                          } else {
                            setActiveTab('UNLOADING');
                          }
                        }}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 cursor-pointer flex items-center justify-between text-xs transition-all"
                      >
                        <div>
                          <div className="font-bold text-white font-mono">{t.vehiclePlate}</div>
                          <div className="text-[11px] text-slate-400">{t.materialName}</div>
                        </div>
                        <StatusBadge status={t.status} size="xs" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: ALL TRANSACTIONS LIST */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {/* Search and Filters & Batch Action Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={isRTL ? 'بحث برقم الإرسالية، الشاحنة، المادة...' : 'Search ticket, vehicle, material...'}
                  className="w-full ps-9 pe-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTxIdsForBatchPrint.length === 0) {
                      setSelectedTxIdsForBatchPrint(filteredList.map((t) => t.id));
                    }
                    setIsBatchPrintModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer transition-all shadow-md active:scale-95"
                  title={isRTL ? 'طباعة ملصقات QR لإرساليات المواد دفعة واحدة' : 'Batch print material QR labels'}
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isRTL ? 'طباعة QR مجمعة' : 'Batch Print QR'}</span>
                  {selectedTxIdsForBatchPrint.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-800 text-[10px] text-white font-mono">
                      {selectedTxIdsForBatchPrint.length}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:border-cyan-400"
                  >
                    <option value="ALL">{isRTL ? 'كافة الحالات' : 'All Statuses'}</option>
                    <option value="Scale In Completed">{isRTL ? 'تم وزن الدخول' : 'Scale In Completed'}</option>
                    <option value="Unloading Completed">{isRTL ? 'تم التفريغ (بانتظار الخروج)' : 'Unloading Completed'}</option>
                    <option value="Scale Out Completed">{isRTL ? 'تم وزن الخروج' : 'Scale Out Completed'}</option>
                    <option value="Received">{isRTL ? 'تم الاستلام النهائي' : 'Received'}</option>
                    <option value="Waiting for Shredding">{isRTL ? 'بانتظار الثرم' : 'Waiting for Shredding'}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Batch QR Printing Action Bar */}
            {selectedTxIdsForBatchPrint.length > 0 && (
              <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-900 border border-emerald-500/40 shadow-xl shadow-emerald-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Printer className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {isRTL
                          ? `تم تحديد ${selectedTxIdsForBatchPrint.length} إرسالية مواد للطباعة`
                          : `${selectedTxIdsForBatchPrint.length} material shipments selected for batch print`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900 text-emerald-200 border border-emerald-500/40">
                        {batchSelectedBagsCount} {isRTL ? 'شليف' : 'Bags'} • {batchSelectedTotalWeight.toLocaleString()} KG
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isRTL
                        ? 'يمكنك طباعة ملصقات وباركودات QR الصناعية لجميع الإرساليات والشلايف المحددة في عملية واحدة عبر المتصفح'
                        : 'Print industrial QR barcode labels for all selected shipments and bulk bags in a single operation'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={clearBatchSelection}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    {isRTL ? 'إلغاء التحديد' : 'Clear'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsBatchPrintModalOpen(true)}
                    className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer transition-all active:scale-95"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isRTL
                        ? `طباعة ملصقات QR دفعة واحدة (${selectedTxIdsForBatchPrint.length})`
                        : `Batch Print QR Labels (${selectedTxIdsForBatchPrint.length})`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transactions Table */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 text-center w-10">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer w-4 h-4"
                        title={isRTL ? 'تحديد كافة إرساليات الجدول' : 'Select all shipments in table'}
                      />
                    </th>
                    <th className="p-3.5 text-start">{t('transactionNumber')}</th>
                    <th className="p-3.5 text-start">{t('vehiclePlate')}</th>
                    <th className="p-3.5 text-start">{t('supplier')}</th>
                    <th className="p-3.5 text-start">{t('material')}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الشلايف' : 'Bags'}</th>
                    <th className="p-3.5 text-end">{t('scaleInWeight')} (قائم)</th>
                    <th className="p-3.5 text-end">{t('scaleOutWeight')} (فارغ)</th>
                    <th className="p-3.5 text-end">{t('netWeight')} (صافي)</th>
                    <th className="p-3.5 text-center">{t('status')}</th>
                    <th className="p-3.5 text-center">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredList.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`transition-colors cursor-pointer ${
                        selectedTxIdsForBatchPrint.includes(tx.id)
                          ? 'bg-cyan-950/40 hover:bg-cyan-950/60 border-l-2 rtl:border-l-0 rtl:border-r-2 border-cyan-400'
                          : 'hover:bg-cyan-950/20'
                      }`}
                      onClick={() => {
                        setSelectedTx(tx);
                        setSelectedTransactionId(tx.id);
                      }}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTxIdsForBatchPrint.includes(tx.id)}
                          onChange={() => toggleSelectTx(tx.id)}
                          className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer w-4 h-4"
                          title={isRTL ? 'تحديد لطباعة ملصق QR' : 'Select for batch QR print'}
                        />
                      </td>
                      <td className="p-3.5 font-mono font-bold text-cyan-300">
                        {tx.transactionNumber}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {tx.legacyDocumentNumber || 'Doc 546'}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white">{tx.vehiclePlate}</td>
                      <td className="p-3.5">{tx.supplierName}</td>
                      <td className="p-3.5 font-bold text-white">{tx.materialName}</td>
                      <td className="p-3.5 text-center font-mono text-amber-300">{tx.bulkBagsCount}</td>
                      <td className="p-3.5 text-end font-mono text-cyan-400 font-bold">
                        {(tx.scaleInWeightKG ?? 0).toLocaleString()} KG
                      </td>
                      <td className="p-3.5 text-end font-mono text-amber-400">
                        {tx.scaleOutWeightKG > 0 ? `${(tx.scaleOutWeightKG ?? 0).toLocaleString()} KG` : '---'}
                      </td>
                      <td className="p-3.5 text-end font-mono text-emerald-400 font-bold">
                        {tx.netReceivedWeightKG > 0
                          ? `${(tx.netReceivedWeightKG ?? 0).toLocaleString()} KG`
                          : '---'}
                      </td>
                      <td className="p-3.5 text-center">
                        <StatusBadge status={tx.status} size="sm" showDot />
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {(tx.status === 'Scale In Completed' || tx.status === 'SCALE_IN_COMPLETED') && (
                            <button
                              onClick={() => {
                                setSelectedTx(tx);
                                setSelectedTransactionId(tx.id);
                                setActiveTab('UNLOADING');
                              }}
                              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {isRTL ? 'تفريغ' : 'Unload'}
                            </button>
                          )}
                          {(tx.status === 'Unloading Completed' || tx.status === 'UNLOADING_COMPLETED') && (
                            <button
                              onClick={() => {
                                setSelectedTx(tx);
                                setSelectedTransactionId(tx.id);
                                setActiveTab('SCALE_OUT');
                                setScaleOutWeightInput(tx.scaleOutWeightKG || Math.round(tx.scaleInWeightKG * 0.45));
                              }}
                              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {isRTL ? 'ميزان الخروج' : 'Scale Out'}
                            </button>
                          )}
                          {(tx.status === 'Scale Out Completed' || tx.status === 'SCALE_OUT_COMPLETED') && (
                            <button
                              onClick={() => {
                                setSelectedTx(tx);
                                setSelectedTransactionId(tx.id);
                                setRouteRequiresShredding(tx.requiresShredding);
                                setShowRoutingModal(true);
                              }}
                              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {isRTL ? 'تأكيد التوجيه' : 'Route'}
                            </button>
                          )}
                          {(tx.status === 'Received' || tx.status === 'RECEIVED' || tx.status === 'Waiting for Shredding' || tx.status === 'WAITING_FOR_THERM' || tx.status === 'READY_FOR_PRODUCTION') && (
                            <button
                              onClick={() => {
                                setSelectedTx(tx);
                                setSelectedTransactionId(tx.id);
                                setActiveTab('SCALE_IN');
                              }}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                            >
                              {isRTL ? 'عرض' : 'View'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setLifecycleBatchPayload({
                                transactionNumber: tx.transactionNumber,
                                batchId: tx.transactionNumber,
                                materialId: tx.materialId,
                              });
                              setIsLifecycleModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            title={isRTL ? 'عرض دورة حياة الوجبة (الاستلام - الثرم - التخزين)' : 'View Batch Lifecycle'}
                          >
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{isRTL ? 'دورة الوجبة' : 'Lifecycle'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTxIdsForBatchPrint([tx.id]);
                              setIsBatchPrintModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            title={isRTL ? 'طباعة ملصق وباركود الشليف' : 'Print Bulk Bag QR Label'}
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{isRTL ? 'ملصق شليف' : 'Bag Label'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Scan History Table for Quick Verification */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-300">
                  {isRTL ? 'سجل المسح الضوئي (QR Scan History)' : 'Recent QR Scan History'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {scanHistory.length} {isRTL ? 'عناصر' : 'Items'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsScanHistoryVisibleInList(!isScanHistoryVisibleInList)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <span>{isScanHistoryVisibleInList ? (isRTL ? 'إخفاء السجل' : 'Hide Table') : (isRTL ? 'عرض السجل (10)' : 'Show Table (10)')}</span>
                {isScanHistoryVisibleInList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {isScanHistoryVisibleInList && (
              <div className="space-y-3.5">
                {/* Real-Time IndexedDB Aggregated Summary Card */}
                <ReceivingScanHistorySummaryCard
                  stats={scanDbStats}
                  refreshTrigger={scanDbStatsRefreshTrigger}
                  onManualRefresh={refreshScanDbStats}
                />

                <ReceivingScanHistoryTable
                  history={scanHistory}
                  onClearHistory={handleClearScanHistory}
                  onRestoreDefaults={handleRestoreScanHistory}
                  onInspectAlert={handleInspectAlert}
                  onUndoLastScan={handleUndoLastScan}
                  onBulkUndo={handleBulkUndo}
                  onUndoSingleScan={handleUndoSingleScan}
                  onApplyToScaleIn={(item) => {
                    setFormData((prev) => ({
                      ...prev,
                      materialId: item.materialId,
                      scaleInWeightKG: item.weightKG,
                      bulkBagsCount: item.bulkBagsCount,
                      ...(item.vehiclePlate ? { vehiclePlate: item.vehiclePlate } : {}),
                      notes: `${prev.notes ? prev.notes + ' | ' : ''}تم التحميل من سجل مسح QR (${item.qrCode})`,
                    }));
                    setActiveTab('SCALE_IN');
                    setSuccessMessage(
                      isRTL
                        ? `✓ تم تحميل بيانات المادة (${item.materialCode || item.materialId}) والوزن (${item.weightKG.toLocaleString()} كغم) من سجل المسح إلى استمارة الدخول.`
                        : `✓ Loaded scanned material (${item.materialCode || item.materialId}) into Scale-In form.`
                    );
                    setTimeout(() => setSuccessMessage(null), 5000);
                  }}
                  onOpenBatchLifecycle={(payload) => {
                    setLifecycleBatchPayload(payload);
                    setIsLifecycleModalOpen(true);
                  }}
                  onPrintLabel={(item) => {
                    setBulkBagModalTx({
                      id: item.id,
                      transactionNumber: item.qrCode,
                      legacyDocumentNumber: item.materialCode,
                      materialId: item.materialId,
                      materialName: item.materialName,
                      scaleInWeightKG: item.weightKG,
                      bulkBagsCount: item.bulkBagsCount,
                      unloadingBay: 'رصيف الاستلام الرئيسي',
                      vehiclePlate: item.vehiclePlate || 'IQ-BAG-1082',
                      status: 'Received',
                      createdAt: item.timestamp,
                    } as any);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: DEDICATED QR SCAN HISTORY */}
      {activeTab === 'SCAN_HISTORY' && (
        <div className="space-y-4">
          {/* Real-Time IndexedDB Aggregated Summary Card */}
          <ReceivingScanHistorySummaryCard
            stats={scanDbStats}
            refreshTrigger={scanDbStatsRefreshTrigger}
            onManualRefresh={refreshScanDbStats}
          />

          <ReceivingScanHistoryTable
            history={scanHistory}
            onClearHistory={handleClearScanHistory}
            onRestoreDefaults={handleRestoreScanHistory}
            onInspectAlert={handleInspectAlert}
            onUndoLastScan={handleUndoLastScan}
            onBulkUndo={handleBulkUndo}
            onUndoSingleScan={handleUndoSingleScan}
            onApplyToScaleIn={(item) => {
              setFormData((prev) => ({
                ...prev,
                materialId: item.materialId,
                scaleInWeightKG: item.weightKG,
                bulkBagsCount: item.bulkBagsCount,
                ...(item.vehiclePlate ? { vehiclePlate: item.vehiclePlate } : {}),
                notes: `${prev.notes ? prev.notes + ' | ' : ''}تم التحميل من سجل مسح QR (${item.qrCode})`,
              }));
              setActiveTab('SCALE_IN');
              setSuccessMessage(
                isRTL
                  ? `✓ تم تحميل بيانات المادة (${item.materialCode || item.materialId}) والوزن (${item.weightKG.toLocaleString()} كغم) من سجل المسح إلى استمارة الدخول.`
                  : `✓ Loaded scanned material (${item.materialCode || item.materialId}) into Scale-In form.`
              );
              setTimeout(() => setSuccessMessage(null), 5000);
            }}
            onOpenBatchLifecycle={(payload) => {
              setLifecycleBatchPayload(payload);
              setIsLifecycleModalOpen(true);
            }}
            onPrintLabel={(item) => {
              setBulkBagModalTx({
                id: item.id,
                transactionNumber: item.qrCode,
                legacyDocumentNumber: item.materialCode,
                materialId: item.materialId,
                materialName: item.materialName,
                scaleInWeightKG: item.weightKG,
                bulkBagsCount: item.bulkBagsCount,
                unloadingBay: 'رصيف الاستلام الرئيسي',
                vehiclePlate: item.vehiclePlate || 'IQ-BAG-1082',
                status: 'Received',
                createdAt: item.timestamp,
              } as any);
            }}
          />
        </div>
      )}

      {/* TAB 2: SCALE IN FORM (WITH LIVE WEIGHBRIDGE INTEGRATION) */}
      {activeTab === 'SCALE_IN' && (
        <div className="space-y-4">
          {/* Real-time Scale Hardware Communication Strip for Scale In */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
              scaleConnectionStatus === 'TIMEOUT_ERROR'
                ? 'bg-rose-950/90 border-rose-500/80 shadow-lg shadow-rose-950/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  scaleConnectionStatus === 'CONNECTED'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : scaleConnectionStatus === 'CONNECTING'
                    ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-900/60 text-rose-300 border border-rose-500'
                }`}
              >
                {scaleConnectionStatus === 'CONNECTED' ? (
                  <Wifi className="w-4 h-4" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">
                    {isRTL ? 'اتصال متحكم الميزان (Scale In)' : 'Weighbridge Scale In Controller Interface'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      scaleConnectionStatus === 'CONNECTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : scaleConnectionStatus === 'CONNECTING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse'
                        : 'bg-rose-950 text-rose-300 border border-rose-500'
                    }`}
                  >
                    {scaleConnectionStatus === 'CONNECTED'
                      ? '● CONNECTED (ONLINE)'
                      : scaleConnectionStatus === 'CONNECTING'
                      ? '⏳ RECONNECTING...'
                      : '✕ TIMEOUT ERROR'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {hardwarePort} • Ping: {scaleTelemetryPing}ms
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateTimeoutError}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                  scaleConnectionStatus === 'TIMEOUT_ERROR'
                    ? 'bg-rose-900/70 text-rose-200 border-rose-500'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-700'
                }`}
                title={isRTL ? 'محاكاة خطأ انقطاع الاتصال (Timeout)' : 'Test hardware timeout trigger'}
              >
                {scaleConnectionStatus === 'TIMEOUT_ERROR'
                  ? isRTL
                    ? 'إلغاء المحاكاة'
                    : 'Clear Timeout'
                  : isRTL
                  ? 'اختبار Timeout'
                  : 'Test Timeout'}
              </button>

              {/* Force Reconnect Button */}
              <button
                type="button"
                onClick={handleForceReconnectScale}
                disabled={isForcingReconnect}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                  scaleConnectionStatus === 'TIMEOUT_ERROR'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-pulse'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-cyan-950'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isForcingReconnect ? 'animate-spin' : ''}`} />
                <span>{isRTL ? 'إعادة الاتصال بالقوة' : 'Force Reconnect'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isRTL ? 'تسجيل شاحنة جديدة على ميزان الدخول (قائم)' : 'Weighbridge Scale In Entry'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL ? 'مستند 546 - استلام مواد خامات' : 'Legacy Document #546 - Raw Material Intake'}
                  </p>
                </div>
              </div>

              <div className="text-end">
                <div className="text-xs font-mono text-cyan-400 font-bold">
                  {isRTL ? 'المشغل الحالي:' : 'Operator:'} {currentUser.nameAr}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">Terminal: GATE-WB-01</div>
              </div>
            </div>

            {/* Voice-to-Text Scale Input Assistant */}
            <VoiceScaleEntryAssistant
              mode="GROSS"
              targetLabel={isRTL ? 'إملاء وزن الدخول (قائم) وعدد الشلايف صوتياً لتجاوز الإدخال اليدوي' : 'Voice-to-text input to call out gross weight and bulk bags hands-free'}
              currentValue={formData.scaleInWeightKG}
              onApplyWeight={(w, bags) => {
                setFormData((prev) => ({
                  ...prev,
                  scaleInWeightKG: w,
                  ...(bags !== undefined && bags !== null ? { bulkBagsCount: bags } : {}),
                }));
                setSuccessMessage(
                  isRTL
                    ? `🎤 تم تثبيت وزن الدخول (${w.toLocaleString()} كغم)${bags ? ` وعدد ${bags} شليف` : ''} صوتياً بنجاح.`
                    : `🎤 Gross weight (${w.toLocaleString()} KG)${bags ? ` & ${bags} bags` : ''} updated via voice.`
                );
                setTimeout(() => setSuccessMessage(null), 4000);
              }}
              onApplyPlate={(plate) => {
                setFormData((prev) => ({ ...prev, vehiclePlate: plate }));
              }}
            />

            {/* Camera QR Instant Material Scanner Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-blue-950/80 to-slate-900 border border-cyan-500/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                  <Scan className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {isRTL ? 'التعرف الفوري على المادة والشحنة عبر كاميرا QR' : 'Instant Material Recognition via Camera QR'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      LIVE CAMERA
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isRTL
                      ? 'وجه كاميرا الجهاز نحو باركود الشحنة لتحديد نوع المادة والمورد والوزن تلقائياً والإدخال المخزني المباشر'
                      : 'Scan shipment tag or bulk bag QR using device camera to auto-fill material, supplier, and weight'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQrScannerOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer shrink-0 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4 text-cyan-200" />
                <span>{isRTL ? 'مسح QR بالكاميرا' : 'Scan QR with Camera'}</span>
              </button>
            </div>

            {/* IndexedDB Scale-In Form Drafts Protection & Restore Banner */}
            <ScaleInDraftBanner
              savedDraft={savedScaleInDraft}
              hasActiveDraft={hasActiveScaleInDraft}
              lastAutoSavedTime={lastDraftSavedTime}
              isSaving={isDraftSaving}
              onResumeDraft={handleResumeDraft}
              onDiscardDraft={handleDiscardDraft}
              onManualSaveDraft={handleManualSaveDraft}
            />

            {/* Weighbridge Scale Predictive Maintenance Baseline & Pattern Deviation Alert */}
            <ScalePredictiveMaintenanceAlertCard
              alert={scalePredictiveAlert}
              onRefreshEvaluation={() => setScalePredictiveAlertVersion((v) => v + 1)}
            />

            <form onSubmit={handleScaleInSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Supplier */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('supplier')} *
                  </label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                    required
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {isRTL ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Material */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('material')} *
                  </label>
                  <select
                    value={formData.materialId}
                    onChange={(e) => handleMaterialChange(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                    required
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {isRTL ? m.nameAr : m.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Plate */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('vehiclePlate')} *
                  </label>
                  <input
                    type="text"
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                    placeholder="بغداد 12345 / حمل"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                {/* Driver Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('driverName')} *
                  </label>
                  <input
                    type="text"
                    value={formData.driverName}
                    onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                    placeholder={isRTL ? 'اسم السائق الثلاثي' : 'Driver Full Name'}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                {/* Scale In Gross Weight KG */}
                <div
                  className={`p-3.5 rounded-xl border transition-all ${
                    scalePredictiveAlert.isTriggered
                      ? scalePredictiveAlert.severity === 'CRITICAL'
                        ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/40'
                        : 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/40'
                      : 'bg-cyan-950/40 border-cyan-500/40 hud-glow-cyan'
                  }`}
                >
                  <label className="block text-xs font-black text-cyan-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>{t('scaleInWeight')} (KG) *</span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/40">
                        🎤 {isRTL ? 'مدعوم صوتياً' : 'Voice-Enabled'}
                      </span>
                      {scalePredictiveAlert.isTriggered && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border font-black animate-pulse ${
                            scalePredictiveAlert.severity === 'CRITICAL'
                              ? 'bg-red-950 text-red-300 border-red-500/60'
                              : 'bg-amber-950 text-amber-300 border-amber-500/60'
                          }`}
                        >
                          ⚠️ {isRTL ? 'انحراف خط الأساس' : 'Baseline Drift'}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400">قائم / Gross</span>
                  </label>
                  <input
                    type="number"
                    value={formData.scaleInWeightKG}
                    onChange={(e) => setFormData({ ...formData, scaleInWeightKG: Number(e.target.value) })}
                    min="1"
                    className={`w-full p-2 rounded-lg bg-slate-950 font-mono text-lg font-black outline-none border ${
                      scalePredictiveAlert.isTriggered
                        ? scalePredictiveAlert.severity === 'CRITICAL'
                          ? 'border-red-500 text-red-300'
                          : 'border-amber-500 text-amber-300'
                        : 'border-cyan-500/50 text-cyan-300'
                    }`}
                    required
                  />
                </div>

                {/* Bulk Bags Count (شلايف) */}
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 hud-glow-amber">
                  <label className="block text-xs font-black text-amber-300 mb-1 flex items-center justify-between">
                    <span>{isRTL ? 'عدد الشلايف (شليف)' : 'Bulk Bags Count'} *</span>
                    <span className="text-[10px] font-mono text-amber-400">شليف / Bulk Bag</span>
                  </label>
                  <input
                    type="number"
                    value={formData.bulkBagsCount}
                    onChange={(e) => setFormData({ ...formData, bulkBagsCount: Number(e.target.value) })}
                    min="1"
                    className="w-full p-2 rounded-lg bg-slate-950 border border-amber-500/50 text-amber-300 font-mono text-lg font-black outline-none"
                    required
                  />
                </div>

                {/* Legacy Document Ref */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('legacyDocNumber')} (546)
                  </label>
                  <input
                    type="text"
                    value={formData.legacyDocumentNumber}
                    onChange={(e) => setFormData({ ...formData, legacyDocumentNumber: e.target.value })}
                    placeholder="546/2026/095"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Unloading Bay */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'رصيف / مسار التفريغ' : 'Unloading Bay'}
                  </label>
                  <select
                    value={formData.unloadingBay}
                    onChange={(e) => setFormData({ ...formData, unloadingBay: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                  >
                    <option value="رصيف تفريغ رقم 1 (مستودع الخامات الرئيسي)">
                      {isRTL ? 'رصيف 1 - مستودع الخامات الرئيسي' : 'Bay 1 - Main Raw Warehouse'}
                    </option>
                    <option value="رصيف تفريغ رقم 2 (مخزن الثرم والسكراب)">
                      {isRTL ? 'رصيف 2 - مخزن الثرم والسكراب' : 'Bay 2 - Shredding & Scrap Store'}
                    </option>
                    <option value="ساحة التفريغ المفتوحة رقم 3">
                      {isRTL ? 'ساحة التفريغ المفتوحة 3' : 'Open Yard Bay 3'}
                    </option>
                  </select>
                </div>
              </div>

              {/* Shredding Requirement Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-emerald-400" />
                    <span>{t('requiresShredding')}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isRTL
                      ? 'إذا كانت المادة سكراب غير مثروم سيتم توجيهها آلياً لماكينة الثرم'
                      : 'If scrap requires shredding, it will be automatically queued for therm'}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresShredding}
                    onChange={(e) => setFormData({ ...formData, requiresShredding: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{t('notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder={isRTL ? 'ملاحظات المعاينة الأولية للشاحنة والخامات...' : 'Initial truck & material inspection notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                />
              </div>

              {/* Real-time Tolerance Threshold Alert Banner */}
              {formData.scaleInWeightKG > 0 && (
                <div className="pt-2">
                  <ScaleToleranceAlertBanner
                    evaluation={scaleInTolerance}
                    stage="RECEIVING"
                    onThresholdsUpdated={() => setToleranceVersion((v) => v + 1)}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleManualSaveDraft}
                  disabled={isDraftSaving}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition active:scale-95"
                  title={isRTL ? 'حفظ المسودة الحالية في IndexedDB لاستئنافها بعد التحديث' : 'Save draft to IndexedDB'}
                >
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isRTL ? 'حفظ كمسودة' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('LIST')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer"
                >
                  {isRTL ? 'تثبيت وزن الدخول وإصدار مستند 546' : 'Confirm Scale In & Issue Doc 546'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Scale Terminal & Guide */}
          <div className="lg:col-span-5 space-y-4">
            <WeighbridgeIndicator
              mode="GROSS"
              truckPlate={formData.vehiclePlate}
              currentValue={formData.scaleInWeightKG}
              forceStatus={scaleConnectionStatus}
              onConnectionChange={(st) => setScaleConnectionStatus(st)}
              onCaptureWeight={(w) => setFormData((prev) => ({ ...prev, scaleInWeightKG: w }))}
            />

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <HelpCircle className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">
                  {isRTL ? 'تعليمات ميزان الدخول (المشرف العام)' : 'Scale In Operating Guidelines'}
                </h4>
              </div>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>{isRTL ? 'التأكد من وقوف الشاحنة بالكامل فوق منصة الميزان الإلكتروني.' : 'Ensure full vehicle positioning on weigh platform.'}</li>
                <li>{isRTL ? 'عدم السماح للسائق أو الركاب بالنزول أثناء قراءة الوزن الإجمالي.' : 'Driver must remain in designated station during gross scale.'}</li>
                <li>{isRTL ? 'مطابقة رصيف التفريغ المحدد مع نوع المواد المستلمة.' : 'Match unloading bay with raw material profile.'}</li>
              </ul>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* TAB 3: UNLOADING STEP */}
      {activeTab === 'UNLOADING' && (
        <div className="space-y-6">
          {!selectedTx ? (
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-xl space-y-4 text-center">
              <PackageCheck className="w-12 h-12 text-blue-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">
                {isRTL ? 'الشاحنات الموجودة في ساحة التفريغ' : 'Trucks in Unloading Bay'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isRTL
                  ? 'اختر الشاحنة التي أتمت تفريغ حمولتها للانتقال إلى مرحلة وزن الخروج (مستند 546).'
                  : 'Select the truck that completed unloading to proceed to Scale Out (Tare).'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-start pt-4">
                {receivingTransactions
                  .filter((t) => t.status === 'Scale In Completed' || t.status === 'SCALE_IN_COMPLETED')
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 space-y-3 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-blue-400 text-sm">{tx.vehiclePlate}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-500/40">
                            {tx.transactionNumber}
                          </span>
                          <StatusBadge status={tx.status} size="xs" />
                        </div>
                      </div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div><strong className="text-slate-400">{t('material')}:</strong> {tx.materialName}</div>
                        <div><strong className="text-slate-400">{t('supplier')}:</strong> {tx.supplierName}</div>
                        <div><strong className="text-slate-400">{t('scaleInWeight')}:</strong> {(tx.scaleInWeightKG ?? 0).toLocaleString()} KG</div>
                        <div><strong className="text-slate-400">{isRTL ? 'الرصيف:' : 'Bay:'}</strong> {tx.unloadingBay}</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTx(tx);
                          setSelectedTransactionId(tx.id);
                        }}
                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isRTL ? 'إتمام وتأكيد التفريغ' : 'Confirm Unload'}</span>
                      </button>
                    </div>
                  ))}
              </div>

              {receivingTransactions.filter((t) => t.status === 'Scale In Completed').length === 0 && (
                <div className="text-xs text-slate-500 py-6 font-mono">
                  {isRTL ? 'لا توجد شاحنات بانتظار التفريغ حالياً' : 'No trucks currently awaiting unloading confirmation'}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto rounded-2xl bg-slate-900/90 border border-blue-500/40 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {isRTL ? 'تأكيد تفريغ الشاحنة وفحص الحمولة' : 'Confirm Vehicle Unloading & Inspection'}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400 font-mono">
                        {selectedTx.transactionNumber} | {selectedTx.vehiclePlate}
                      </p>
                      <StatusBadge status={selectedTx.status} size="xs" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('supplier')}:</span>
                  <span className="font-bold text-white">{selectedTx.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('material')}:</span>
                  <span className="font-bold text-white">{selectedTx.materialName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t('scaleInWeight')}:</span>
                  <div className="font-bold font-mono text-cyan-400">{(selectedTx.scaleInWeightKG ?? 0).toLocaleString()} KG</div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'عدد الشلايف:' : 'Bags:'}</span>
                  <span className="font-bold font-mono text-amber-400">{selectedTx.bulkBagsCount} شليف</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'حالة المادة بعد المعاينة والتفريغ' : 'Material Condition on Unloading'}
                  </label>
                  <select
                    id="unloading_condition"
                    defaultValue={selectedTx.materialCondition}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                  >
                    <option value="Clean & Sorted">{isRTL ? 'نظيفة ومفروزة (Clean & Sorted)' : 'Clean & Sorted'}</option>
                    <option value="Standard Prime">{isRTL ? 'بكر قياسية (Standard Prime)' : 'Standard Prime'}</option>
                    <option value="Scrap Mixed">{isRTL ? 'سكراب مشكل (Scrap Mixed)' : 'Scrap Mixed'}</option>
                    <option value="Dust / Impurities">{isRTL ? 'تحتوي شوائب وأتربة' : 'Dust / Impurities'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'رصيف التفريغ الفعلي' : 'Actual Unloading Bay'}
                  </label>
                  <input
                    type="text"
                    id="unloading_bay"
                    defaultValue={selectedTx.unloadingBay || 'رصيف تفريغ رقم 1'}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    onClick={() => {
                      setSelectedTx(null);
                      setActiveTab('LIST');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={() => {
                      const cond = (document.getElementById('unloading_condition') as HTMLSelectElement)?.value;
                      const bay = (document.getElementById('unloading_bay') as HTMLInputElement)?.value;
                      completeUnloading(selectedTx.id, bay, cond);
                      setActiveTab('SCALE_OUT');
                      setScaleOutWeightInput(Math.round(selectedTx.scaleInWeightKG * 0.45));
                    }}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-950 cursor-pointer"
                  >
                    {isRTL ? 'تأكيد اكتمال التفريغ ➔ الانتقال لميزان الخروج' : 'Confirm Unloading ➔ Proceed to Scale Out'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCALE OUT STEP (WITH LIVE WEIGHBRIDGE INTEGRATION) */}
      {activeTab === 'SCALE_OUT' && (
        <div className="space-y-6">
          {/* Real-time Scale Hardware Communication Strip for Scale Out */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
              scaleConnectionStatus === 'TIMEOUT_ERROR'
                ? 'bg-rose-950/90 border-rose-500/80 shadow-lg shadow-rose-950/40 text-rose-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  scaleConnectionStatus === 'CONNECTED'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : scaleConnectionStatus === 'CONNECTING'
                    ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-900/60 text-rose-300 border border-rose-500'
                }`}
              >
                {scaleConnectionStatus === 'CONNECTED' ? (
                  <Wifi className="w-4 h-4" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">
                    {isRTL ? 'اتصال ميزان الخروج الفارغ (Tare)' : 'Weighbridge Scale Out (Tare) Interface'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      scaleConnectionStatus === 'CONNECTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : scaleConnectionStatus === 'CONNECTING'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse'
                        : 'bg-rose-950 text-rose-300 border border-rose-500'
                    }`}
                  >
                    {scaleConnectionStatus === 'CONNECTED'
                      ? '● CONNECTED (ONLINE)'
                      : scaleConnectionStatus === 'CONNECTING'
                      ? '⏳ RECONNECTING...'
                      : '✕ TIMEOUT ERROR'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {hardwarePort} • Ping: {scaleTelemetryPing}ms
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateTimeoutError}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono border transition-all ${
                  scaleConnectionStatus === 'TIMEOUT_ERROR'
                    ? 'bg-rose-900/70 text-rose-200 border-rose-500'
                    : 'bg-slate-950 text-slate-400 hover:text-white border-slate-700'
                }`}
                title={isRTL ? 'محاكاة خطأ انقطاع الاتصال (Timeout)' : 'Test hardware timeout trigger'}
              >
                {scaleConnectionStatus === 'TIMEOUT_ERROR'
                  ? isRTL
                    ? 'إلغاء المحاكاة'
                    : 'Clear Timeout'
                  : isRTL
                  ? 'اختبار Timeout'
                  : 'Test Timeout'}
              </button>

              {/* Force Reconnect Button */}
              <button
                type="button"
                onClick={handleForceReconnectScale}
                disabled={isForcingReconnect}
                className={`px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                  scaleConnectionStatus === 'TIMEOUT_ERROR'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-pulse'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isForcingReconnect ? 'animate-spin' : ''}`} />
                <span>{isRTL ? 'إعادة الاتصال بالقوة' : 'Force Reconnect'}</span>
              </button>
            </div>
          </div>
          {!selectedTx ? (
            <div className="p-8 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-xl space-y-4 text-center">
              <Scale className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">
                {isRTL ? 'الشاحنات الجاهزة لوزن الخروج (فارغ)' : 'Trucks Ready for Scale Out Tare'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isRTL
                  ? 'اختر الشاحنة الفارغة المتوقفة على الميزان الجسري لتسجيل وزن الفارغ واحتساب الوزن الصافي فوراً.'
                  : 'Select the empty truck on the weighbridge to record tare weight and finalize net intake.'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-start pt-4">
                {receivingTransactions
                  .filter((t) => t.status === 'Unloading Completed' || t.status === 'UNLOADING_COMPLETED' || t.status === 'Scale In Completed' || t.status === 'SCALE_IN_COMPLETED')
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 space-y-3 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-amber-400 text-sm">{tx.vehiclePlate}</span>
                        <StatusBadge status={tx.status} size="xs" />
                      </div>
                      <div className="text-xs text-slate-300 space-y-1">
                        <div><strong className="text-slate-400">{t('material')}:</strong> {tx.materialName}</div>
                        <div><strong className="text-slate-400">{t('supplier')}:</strong> {tx.supplierName}</div>
                        <div><strong className="text-slate-400">{t('scaleInWeight')}:</strong> {(tx.scaleInWeightKG ?? 0).toLocaleString()} KG</div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedTx(tx);
                          setSelectedTransactionId(tx.id);
                          setScaleOutWeightInput(tx.scaleOutWeightKG || Math.round(tx.scaleInWeightKG * 0.45));
                        }}
                        className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Scale className="w-4 h-4" />
                        <span>{isRTL ? 'وزن الخروج الآن' : 'Scale Out Now'}</span>
                      </button>
                    </div>
                  ))}
              </div>

              {receivingTransactions.filter((t) => t.status === 'Unloading Completed' || t.status === 'UNLOADING_COMPLETED' || t.status === 'Scale In Completed' || t.status === 'SCALE_IN_COMPLETED').length === 0 && (
                <div className="text-xs text-slate-500 py-6 font-mono">
                  {isRTL ? 'لا توجد شاحنات مفرغة بانتظار وزن الخروج حالياً' : 'No empty trucks waiting for scale out'}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 rounded-2xl bg-slate-900/90 border border-amber-500/40 p-6 shadow-2xl hud-glow-amber space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                      <Scale className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isRTL ? 'وزن الخروج (فارغ) واحتساب الصافي' : 'Scale Out Weighing (Tare Weight)'}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400 font-mono">
                          {selectedTx.transactionNumber} | {selectedTx.vehiclePlate}
                        </p>
                        <StatusBadge status={selectedTx.status} size="xs" />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedTx(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
                  >
                    {isRTL ? 'اختيار شاحنة أخرى' : 'Change Truck'}
                  </button>
                </div>

                {/* Voice-to-Text Scale Input Assistant for Tare Scale Out */}
                <VoiceScaleEntryAssistant
                  mode="TARE"
                  targetLabel={isRTL ? 'إملاء وزن الخروج (فارغ) صوتياً لاحتساب الصافي وتجاوز الإدخال اليدوي' : 'Voice-to-text input to call out tare weight and compute net intake hands-free'}
                  currentValue={scaleOutWeightInput}
                  onApplyWeight={(w) => {
                    setScaleOutWeightInput(w);
                    setSuccessMessage(
                      isRTL
                        ? `🎤 تم تثبيت وزن الخروج الفارغ (${w.toLocaleString()} كغم) صوتياً بنجاح.`
                        : `🎤 Tare weight (${w.toLocaleString()} KG) updated via voice.`
                    );
                    setTimeout(() => setSuccessMessage(null), 4000);
                  }}
                />

                <form onSubmit={handleScaleOutSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-xs text-slate-400">{t('scaleInWeight')} (قائم):</span>
                      <div className="text-xl font-black font-mono text-cyan-400 mt-1">
                        {(selectedTx.scaleInWeightKG ?? 0).toLocaleString()} KG
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50">
                      <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>{t('scaleOutWeight')} (فارغ) *</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/40">
                            🎤 {isRTL ? 'مدعوم صوتياً' : 'Voice-Enabled'}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-amber-400">فارغ / Tare</span>
                      </label>
                      <input
                        type="number"
                        value={scaleOutWeightInput}
                        onChange={(e) => setScaleOutWeightInput(Number(e.target.value))}
                        min="1"
                        max={(selectedTx.scaleInWeightKG ?? 0) - 1}
                        className="w-full p-2 rounded-lg bg-slate-950 border border-amber-400 text-amber-300 font-mono text-xl font-black outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Live Net Weight Calculation Preview */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/80 to-blue-950/60 border border-cyan-400 shadow-inner flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                        {isRTL ? 'الوزن الصافي المستلم (محسوب آلياً):' : 'Calculated Net Received Weight:'}
                      </span>
                      <p className="text-[11px] text-slate-400">
                        {isRTL ? 'الصافي = وزن الدخول قائم - وزن الخروج فارغ' : 'Net = Scale In Gross - Scale Out Tare'}
                      </p>
                    </div>

                    <div className="text-end">
                      <div className="text-2xl font-black font-mono text-white">
                        {(selectedTx.scaleInWeightKG ?? 0) > scaleOutWeightInput && scaleOutWeightInput > 0
                          ? ((selectedTx.scaleInWeightKG ?? 0) - scaleOutWeightInput).toLocaleString()
                          : '0'}{' '}
                        <span className="text-cyan-400 text-sm font-sans">KG</span>
                      </div>
                      <div className="text-xs font-mono text-amber-400 font-bold">
                        {selectedTx.bulkBagsCount} {isRTL ? 'شليف' : 'Bags'}
                      </div>
                    </div>
                  </div>

                  {/* Real-time Tolerance Threshold Alert Banner */}
                  {scaleOutTolerance && scaleOutWeightInput > 0 && (
                    <div className="pt-2">
                      <ScaleToleranceAlertBanner
                        evaluation={scaleOutTolerance}
                        stage="RECEIVING"
                        onThresholdsUpdated={() => setToleranceVersion((v) => v + 1)}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('LIST')}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-950 cursor-pointer"
                    >
                      {isRTL ? 'تأكيد وزن الخروج واحتساب الصافي' : 'Confirm Scale Out & Net Weight'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Live Tare Scale Indicator */}
              <div className="lg:col-span-5 space-y-4">
                <WeighbridgeIndicator
                  mode="TARE"
                  truckPlate={selectedTx.vehiclePlate}
                  materialName={selectedTx.materialName}
                  currentValue={scaleOutWeightInput || Math.round(selectedTx.scaleInWeightKG * 0.45)}
                  forceStatus={scaleConnectionStatus}
                  onConnectionChange={(st) => setScaleConnectionStatus(st)}
                  onCaptureWeight={(w) => setScaleOutWeightInput(w)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ROUTING DECISION MODAL */}
      {showRoutingModal && selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-cyan-500/50 shadow-2xl p-6 space-y-5 text-start">
            <div className="flex items-center gap-3 text-cyan-400">
              <HelpCircle className="w-7 h-7" />
              <div>
                <h3 className="text-lg font-black text-white">
                  {isRTL ? 'توجيه مسار المادة بعد الاستلام' : 'Material Routing Decision'}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-400 font-mono">
                    {isRTL ? 'هل هذه المادة تتطلب ثرم؟' : 'Does this material require shredding?'}
                  </p>
                  <StatusBadge status={selectedTx.status} size="xs" />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('material')}:</span>
                <span className="font-bold text-white">{selectedTx.materialName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('netWeight')}:</span>
                <span className="font-bold font-mono text-cyan-400">
                  {selectedTx.netReceivedWeightKG || selectedTx.scaleInWeightKG - scaleOutWeightInput} KG
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{t('bulkBags')}:</span>
                <span className="font-bold font-mono text-amber-400">{selectedTx.bulkBagsCount} شليف</span>
              </div>
            </div>

            {/* Decision Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRouteRequiresShredding(true)}
                className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                  routeRequiresShredding
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 hud-glow-emerald'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-6 h-6 mx-auto mb-1.5 text-emerald-400" />
                <div className="font-bold text-sm">{isRTL ? 'نعم، تتطلب ثرم' : 'YES, Shred It'}</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {isRTL ? 'تحويل لمخزن ووحدة الثرم (الثرم)' : 'Route to Therm / Regrind unit'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRouteRequiresShredding(false)}
                className={`p-4 rounded-xl border text-center transition-all cursor-pointer ${
                  !routeRequiresShredding
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 hud-glow-cyan'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Boxes className="w-6 h-6 mx-auto mb-1.5 text-cyan-400" />
                <div className="font-bold text-sm">{isRTL ? 'لا، خزن مباشر' : 'NO, Direct Storage'}</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {isRTL ? 'إيداع بمستودع الخامات' : 'Deposit directly to storage rack'}
                </div>
              </button>
            </div>

            {/* Target Location Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'تحديد موقع التخزين / الرف بالمستودع' : 'Target Storage Location / Rack'}
              </label>
              <select
                value={targetLocationId}
                onChange={(e) => setTargetLocationId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} - {isRTL ? loc.nameAr : loc.nameEn} ({loc.warehouseNameAr})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRoutingModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleRoutingConfirm}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950 cursor-pointer"
              >
                {isRTL ? 'حفظ وتأكيد التوجيه النهائي' : 'Save & Confirm Routing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Bag QR Generator Modal */}
      {bulkBagModalTx && (
        <BulkBagQrGenerator
          isModal={true}
          onClose={() => setBulkBagModalTx(null)}
          bag_id={`BAG-${bulkBagModalTx.transactionNumber}-01`}
          material_name={bulkBagModalTx.materialName}
          weight_kg={
            bulkBagModalTx.bulkBagsCount > 0
              ? Math.round(
                  (bulkBagModalTx.netReceivedWeightKG ||
                    bulkBagModalTx.scaleInWeightKG ||
                    500) / bulkBagModalTx.bulkBagsCount
                )
              : bulkBagModalTx.netReceivedWeightKG || 500
          }
          transaction_number={bulkBagModalTx.transactionNumber}
          production_date={bulkBagModalTx.scaleInTime ? bulkBagModalTx.scaleInTime.slice(0, 10) : undefined}
          batch_id={bulkBagModalTx.legacyDocumentNumber || undefined}
          operator_name={bulkBagModalTx.driverName || undefined}
          warehouse_location={bulkBagModalTx.unloadingBay || undefined}
          notes={bulkBagModalTx.notes || undefined}
        />
      )}

      {/* QR Code Camera Scanner Modal for Instant Material Identification & Stock Entry */}
      <QrBatchScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        moduleContext="RECEIVING"
        onOpenBatchLifecycle={(payload) => {
          setLifecycleBatchPayload(payload);
          setIsLifecycleModalOpen(true);
        }}
        onMaterialAlert={(alertInfo) => {
          setActiveMaterialAlert(alertInfo);
          setIsAlertModalOpen(true);
        }}
        onSuccessfulScan={(scanned) => {
          handleRecordQrScan(scanned);
        }}
        onApplyToScaleIn={(scanned) => {
          handleRecordQrScan({
            materialId: scanned.materialId,
            weightKG: scanned.weightKG,
            bulkBagsCount: scanned.bulkBagsCount,
            vehiclePlate: scanned.vehiclePlate,
            qrCode: `APPLY-${scanned.materialId}-${Date.now().toString().slice(-4)}`,
            notes: 'تم التحميل إلى استمارة ميزان الدخول',
          });
          setFormData((prev) => ({
            ...prev,
            materialId: scanned.materialId,
            ...(scanned.supplierId ? { supplierId: scanned.supplierId } : {}),
            scaleInWeightKG: scanned.weightKG,
            bulkBagsCount: scanned.bulkBagsCount,
            ...(scanned.vehiclePlate ? { vehiclePlate: scanned.vehiclePlate } : {}),
            ...(scanned.warehouseId ? { targetWarehouseId: scanned.warehouseId } : {}),
            ...(scanned.locationId ? { targetLocationId: scanned.locationId } : {}),
            notes: scanned.notes ? `${prev.notes ? prev.notes + ' | ' : ''}${scanned.notes}` : prev.notes,
          }));
          setActiveTab('SCALE_IN');
          setIsQrScannerOpen(false);
          setSuccessMessage(
            isRTL
              ? `✓ تم التعرف على المادة (${scanned.weightKG.toLocaleString()} كغم) عبر مسح QR وتعبئة استمارة ميزان الدخول بنجاح.`
              : `✓ Material identified from QR code and loaded into Scale-In ticket form (${scanned.weightKG.toLocaleString()} KG).`
          );
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
        onInstantStockEntry={(scanned) => {
          handleRecordQrScan({
            materialId: scanned.materialId,
            weightKG: scanned.weightKG,
            bulkBagsCount: scanned.bulkBagsCount,
            vehiclePlate: scanned.vehiclePlate,
            qrCode: `INSTANT-${scanned.materialId}-${Date.now().toString().slice(-4)}`,
            notes: 'إدخال مخزني فوري مؤتمت عبر كاميرا مسح QR',
          });
          const res = createReceivingTransaction({
            supplierId: scanned.supplierId,
            materialId: scanned.materialId,
            scaleInWeightKG: scanned.weightKG + 12000, // Gross
            bulkBagsCount: scanned.bulkBagsCount,
            vehiclePlate: scanned.vehiclePlate || 'IQ-BAG-1082',
            targetWarehouseId: scanned.targetWarehouseId,
            targetLocationId: scanned.targetLocationId,
            notes: scanned.notes || 'إدخال مخزني مؤتمت فوري عبر كاميرا مسح QR',
            operator: currentUser.nameAr || currentUser.name,
          });

          if (res.success && res.id) {
            completeScaleOut(res.id, 12000); // Net weight equals scanned.weightKG
            confirmReceivingAndRoute(res.id, 'STORAGE', scanned.targetWarehouseId, scanned.targetLocationId);
            setIsQrScannerOpen(false);
            setSuccessMessage(
              isRTL
                ? `✓ تم تسجيل إدخال مخزني فوري للمادة (${scanned.weightKG.toLocaleString()} كغم) وتوثيق مستند الاستلام 546 بنجاح!`
                : `✓ Instant stock entry registered (${scanned.weightKG.toLocaleString()} KG) and document #546 issued!`
            );
            setTimeout(() => setSuccessMessage(null), 6000);
          } else {
            setErrorMessage(res.error || (isRTL ? 'فشلت عملية الإدخال المخزني' : 'Stock entry failed'));
          }
        }}
      />

      {/* Batch Lifecycle Modal */}
      {isLifecycleModalOpen && (
        <BatchLifecycleModal
          isOpen={isLifecycleModalOpen}
          onClose={() => {
            setIsLifecycleModalOpen(false);
            setLifecycleBatchPayload(null);
          }}
          batchId={lifecycleBatchPayload?.batchId}
          bagId={lifecycleBatchPayload?.bagId}
          transactionNumber={lifecycleBatchPayload?.transactionNumber}
          materialId={lifecycleBatchPayload?.materialId}
          initialData={lifecycleBatchPayload}
        />
      )}

      {/* Real-time Tolerance Threshold Config Modal */}
      {isToleranceConfigOpen && (
        <ScaleToleranceConfigModal
          isOpen={isToleranceConfigOpen}
          onClose={() => setIsToleranceConfigOpen(false)}
          onSaved={() => setToleranceVersion((v) => v + 1)}
        />
      )}

      {/* Batch QR Label Thermal Printing Modal */}
      {isBatchPrintModalOpen && (
        <ReceivingBatchQrPrintModal
          isOpen={isBatchPrintModalOpen}
          onClose={() => setIsBatchPrintModalOpen(false)}
          transactions={batchSelectedTransactions}
          materials={materials}
        />
      )}

      {/* Material Alert Detail & Quarantine Protocol Modal */}
      <MaterialAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => {
          setIsAlertModalOpen(false);
          stopMaterialWarningAlarm();
        }}
        alert={activeMaterialAlert}
        onRouteToQuarantine={(alert) => {
          setIsAlertModalOpen(false);
          stopMaterialWarningAlarm();
          setSuccessMessage(
            isRTL
              ? `تم تسجيل توجيه المادة (${alert.materialCode}) إلى منطقة الحجر الصحي (WH-QUARANTINE / LOC-Q01) بنجاح.`
              : `Material (${alert.materialCode}) routed to Quarantine zone.`
          );
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
      />

      {/* Material Quarantine & Expiry Testing & Configuration Modal */}
      <MaterialQuarantineTestModal
        isOpen={isQuarantineTestModalOpen}
        onClose={() => setIsQuarantineTestModalOpen(false)}
        materials={materials}
        onToggleMaterialQuarantine={handleToggleMaterialQuarantine}
        onToggleMaterialExpired={handleToggleMaterialExpired}
        onSimulateScan={handleSimulateScan}
      />

      {/* Weight Anomaly Daemon Status & Load Cell Sentinel Control Modal */}
      <WeightAnomalyDaemonModal
        isOpen={isAnomalyModalOpen}
        onClose={() => setIsAnomalyModalOpen(false)}
        anomalies={weightAnomalies}
        onDismissAnomaly={handleDismissAnomaly}
        onClearAll={handleClearAllAnomalies}
        onSimulateTest={handleSimulateAnomalyTest}
      />
    </div>
  );
};
