import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Camera,
  CameraOff,
  Flashlight,
  SwitchCamera,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  Scan,
  RefreshCw,
  Clock,
  Layers,
  Tag,
  Warehouse as WarehouseIcon,
  ArrowRightLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  History,
  Check,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  detectQrCodeFromVideo,
  detectQrFromImageFile,
  parseScannedQrData,
  playSuccessChime,
  playAlertChime,
  ParsedScannedBag,
} from '../services/qrScannerService';
import { BulkBag, BulkBagStatus, MaterialItem, WarehouseLocation, Warehouse } from '../types';

export interface ScannedBatchUpdateLog {
  id: string;
  batchId: string;
  materialName: string;
  materialCode: string;
  weightKG: number;
  fromLocation: string;
  toLocation: string;
  oldStatus: string;
  newStatus: string;
  updatedAt: string;
  isAutoUpdated: boolean;
}

export interface StorageQrBatchScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchUpdated?: (log: ScannedBatchUpdateLog) => void;
}

export const StorageQrBatchScannerModal: React.FC<StorageQrBatchScannerModalProps> = ({
  isOpen,
  onClose,
  onBatchUpdated,
}) => {
  const { isRTL, t } = useLanguage();
  const {
    bulkBags,
    materials,
    warehouses,
    locations,
    inventoryBalances,
    updateBulkBag,
    transferStock,
    logAudit,
    currentUser,
  } = useFactory();

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Automated Update Workflow Settings
  const [isAutoUpdateMode, setIsAutoUpdateMode] = useState(true);
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>(warehouses[0]?.id || 'WH-01');
  const [targetLocationId, setTargetLocationId] = useState<string>(locations[0]?.id || 'LOC-A01');
  const [targetStatus, setTargetStatus] = useState<BulkBagStatus>('IN_STORAGE');

  // Currently detected batch state
  const [scannedRawText, setScannedRawText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedScannedBag | null>(null);
  const [identifiedBag, setIdentifiedBag] = useState<BulkBag | null>(null);
  const [identifiedMaterial, setIdentifiedMaterial] = useState<MaterialItem | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');

  // Status and feedback
  const [notificationMsg, setNotificationMsg] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    text: string;
  } | null>(null);

  // Session update logs
  const [sessionLogs, setSessionLogs] = useState<ScannedBatchUpdateLog[]>([]);

  // Filter locations for selected target warehouse
  const availableTargetLocations = useMemo(() => {
    return locations.filter((loc) => loc.warehouseId === targetWarehouseId);
  }, [locations, targetWarehouseId]);

  // Keep targetLocationId in sync with warehouse change
  useEffect(() => {
    if (availableTargetLocations.length > 0) {
      if (!availableTargetLocations.some((loc) => loc.id === targetLocationId)) {
        setTargetLocationId(availableTargetLocations[0].id);
      }
    }
  }, [availableTargetLocations, targetLocationId]);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
  }, []);

  // Start camera hardware
  const startCamera = useCallback(
    async (mode = facingMode) => {
      stopCamera();
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          isRTL
            ? 'متصفحك لا يدعم الوصول المباشر لكاميرا الويب. يرجى رفع صورة باركود أو استخدام الإدخال اليدوي.'
            : 'Browser does not support camera access. Please upload QR image or enter code manually.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setIsCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera initiation error, attempting fallback:', err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          mediaStreamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.setAttribute('playsinline', 'true');
            await videoRef.current.play();
            setIsCameraActive(true);
          }
        } catch (fallbackErr: any) {
          setCameraError(
            isRTL
              ? 'تعذر تشغيل كاميرا الجهاز (يرجى التحقق من أذونات الكاميرا في المتصفح). يمكنك البحث اليدوي أو رفع صورة QR.'
              : 'Unable to start camera. Please verify browser permissions, enter batch code, or upload image.'
          );
          setIsCameraActive(false);
        }
      }
    },
    [facingMode, isRTL, stopCamera]
  );

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedRawText(null);
      setParsedData(null);
      setIdentifiedBag(null);
      setIdentifiedMaterial(null);
      setNotificationMsg(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch control error:', err);
    }
  };

  // Switch between front & back camera
  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  // Core Batch Location & Status Auto-Update Engine
  const executeBatchUpdate = useCallback(
    (
      bag: BulkBag,
      mat: MaterialItem,
      destinationLocId: string,
      destinationWhId: string,
      statusToApply: BulkBagStatus,
      isAuto = false
    ) => {
      const destLoc = locations.find((l) => l.id === destinationLocId);
      const destWh = warehouses.find((w) => w.id === destinationWhId);
      const sourceLocCode = bag.locationCode || 'UNASSIGNED';
      const destLocCode = destLoc?.code || destinationLocId;

      // 1. Update the BulkBag record in state & Firestore
      const res = updateBulkBag(bag.id, {
        warehouseId: destinationWhId,
        warehouseName: destWh ? (isRTL ? destWh.nameAr : destWh.nameEn) : undefined,
        locationId: destinationLocId,
        locationCode: destLocCode,
        status: statusToApply,
      });

      if (!res.success) {
        setNotificationMsg({
          type: 'ERROR',
          text: isRTL ? 'فشلت عملية تحديث الوجبة' : 'Batch update failed',
        });
        return false;
      }

      // 2. If location actually changed, execute inventory balance transfer
      if (bag.locationId && bag.locationId !== destinationLocId && bag.weightKG > 0) {
        try {
          transferStock(
            bag.materialId,
            bag.locationId,
            bag.warehouseId || 'WH-01',
            destinationLocId,
            destinationWhId,
            bag.weightKG,
            1,
            `QR Auto-Scan Batch Relocation [${bag.bagNumber || bag.id}] -> ${destLocCode}`
          );
        } catch (e) {
          console.warn('Auto stock transfer note:', e);
        }
      }

      // 3. Log Audit Record
      logAudit(
        'QR Batch Relocated & Status Updated',
        `تحديث فوري لموقع وحالة الوجبة ${bag.bagNumber || bag.id} عبر ماسح QR`,
        'BulkBag',
        bag.id,
        `${sourceLocCode} (${bag.status})`,
        `${destLocCode} (${statusToApply}) | المادة: ${mat.code} | الوزن: ${bag.weightKG} كغم | المشغل: ${currentUser.nameAr}`
      );

      // 4. Create Session Log Entry
      const logEntry: ScannedBatchUpdateLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        batchId: bag.bagNumber || bag.id,
        materialName: isRTL ? mat.nameAr : mat.nameEn,
        materialCode: mat.code,
        weightKG: bag.weightKG,
        fromLocation: sourceLocCode,
        toLocation: destLocCode,
        oldStatus: bag.status,
        newStatus: statusToApply,
        updatedAt: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        isAutoUpdated: isAuto,
      };

      setSessionLogs((prev) => [logEntry, ...prev.slice(0, 19)]);
      if (onBatchUpdated) {
        onBatchUpdated(logEntry);
      }

      // Audio & UI Feedback
      if (!isAudioMuted) {
        playSuccessChime();
      }

      setNotificationMsg({
        type: 'SUCCESS',
        text: isRTL
          ? `✓ تم تحديث الوجبة (${bag.bagNumber || bag.id}) ونقلها إلى [${destLocCode}] بحالة [${statusToApply}] بنجاح!`
          : `✓ Batch (${bag.bagNumber || bag.id}) updated & moved to [${destLocCode}] with status [${statusToApply}]!`,
      });

      // Update identifiedBag local state so UI reflects new location immediately
      setIdentifiedBag((prev) =>
        prev
          ? {
              ...prev,
              locationId: destinationLocId,
              locationCode: destLocCode,
              warehouseId: destinationWhId,
              status: statusToApply,
            }
          : null
      );

      return true;
    },
    [locations, warehouses, updateBulkBag, transferStock, logAudit, isRTL, currentUser, onBatchUpdated, isAudioMuted]
  );

  // Match scanned text with database entities and optionally trigger auto-update
  const handleScannedCode = useCallback(
    (codeText: string) => {
      if (!codeText || isProcessingScan) return;
      setIsProcessingScan(true);
      setScannedRawText(codeText);

      const parsed = parseScannedQrData(codeText);
      setParsedData(parsed);

      const cleanCode = codeText.trim().toUpperCase();

      // Check if user scanned a Location QR (e.g. LOC-A01, LOC-B02, LOC-THM01)
      if (parsed.type === 'LOCATION' || cleanCode.startsWith('LOC-')) {
        const foundLoc = locations.find(
          (l) => l.code.toUpperCase() === cleanCode || l.id.toUpperCase() === cleanCode
        );
        if (foundLoc) {
          setTargetWarehouseId(foundLoc.warehouseId);
          setTargetLocationId(foundLoc.id);

          // If a batch is already selected/waiting, auto-move it to this scanned location!
          if (identifiedBag && identifiedMaterial) {
            executeBatchUpdate(
              identifiedBag,
              identifiedMaterial,
              foundLoc.id,
              foundLoc.warehouseId,
              targetStatus,
              true
            );
          } else {
            if (!isAudioMuted) playSuccessChime();
            setNotificationMsg({
              type: 'INFO',
              text: isRTL
                ? `📍 تم مسح موقع التخزين: ${foundLoc.code} (${foundLoc.nameAr}). وجه الكاميرا نحو كيس/وجبة المادة لربطها فوراً بهذا الموقع.`
                : `📍 Scanned location: ${foundLoc.code} (${foundLoc.nameEn}). Point camera at batch QR to link it directly.`,
            });
          }

          setTimeout(() => setIsProcessingScan(false), 900);
          return;
        }
      }

      // Otherwise, match Material Batch / Bulk Bag
      const targetId = (parsed.bagId || parsed.batchNumber || cleanCode).toUpperCase();

      // Find in bulkBags
      let bag = bulkBags.find(
        (b) =>
          b.id.toUpperCase() === targetId ||
          b.bagNumber?.toUpperCase() === targetId ||
          b.bagId?.toUpperCase() === targetId ||
          b.batchNumber?.toUpperCase() === targetId ||
          (b.qrPayload && b.qrPayload.toUpperCase().includes(targetId))
      );

      // Find Material
      const matId = bag?.materialId || parsed.materialCode || materials[0]?.id;
      const mat =
        materials.find(
          (m) =>
            m.id === matId ||
            m.code.toUpperCase() === targetId ||
            m.code.toUpperCase() === (parsed.materialCode || '').toUpperCase()
        ) || materials[0];

      // If bag not found in pre-registered list, create dynamic on-the-fly bulk bag for legacy lot
      if (!bag) {
        const weightKG = parsed.weightKG || 1000;
        const fallbackLoc = locations[0];
        bag = {
          id: targetId.startsWith('SHL-') || targetId.startsWith('BAG-') ? targetId : `SHL-${Date.now().toString().slice(-6)}`,
          bagNumber: targetId,
          bagId: targetId,
          materialId: mat.id,
          materialCode: mat.code,
          materialName: isRTL ? mat.nameAr : mat.nameEn,
          weightKG,
          warehouseId: fallbackLoc.warehouseId,
          warehouseName: fallbackLoc.warehouseNameAr,
          locationId: fallbackLoc.id,
          locationCode: fallbackLoc.code,
          status: 'IN_STORAGE',
          batchNumber: parsed.batchNumber || targetId,
        };
      }

      setIdentifiedBag(bag);
      setIdentifiedMaterial(mat);

      // If Auto-Update Mode is ACTIVE: Update location and status immediately upon scanning!
      if (isAutoUpdateMode) {
        executeBatchUpdate(bag, mat, targetLocationId, targetWarehouseId, targetStatus, true);
      } else {
        if (!isAudioMuted) playSuccessChime();
        setNotificationMsg({
          type: 'INFO',
          text: isRTL
            ? `🔍 تم التعرف على الوجبة (${bag.bagNumber || bag.id}). يرجى مراجعة الموقع والحالة ثم الضغط على اعتماد التحديث.`
            : `🔍 Batch identified (${bag.bagNumber || bag.id}). Review location & status below, then tap Apply Update.`,
        });
      }

      setTimeout(() => {
        setIsProcessingScan(false);
      }, 1000);
    },
    [
      isProcessingScan,
      locations,
      identifiedBag,
      identifiedMaterial,
      executeBatchUpdate,
      targetStatus,
      isAudioMuted,
      isRTL,
      bulkBags,
      materials,
      isAutoUpdateMode,
      targetLocationId,
      targetWarehouseId,
    ]
  );

  // RAF loop for scanning video stream
  useEffect(() => {
    if (!isCameraActive) return;

    let isScanning = true;
    let lastScanTimestamp = 0;

    const tick = async () => {
      if (!isScanning) return;

      const now = Date.now();
      // Scan every ~95ms
      if (now - lastScanTimestamp > 95 && videoRef.current && !isProcessingScan) {
        lastScanTimestamp = now;
        const scannedCode = await detectQrCodeFromVideo(videoRef.current);
        if (scannedCode) {
          handleScannedCode(scannedCode);
        }
      }

      scanLoopRef.current = requestAnimationFrame(tick);
    };

    scanLoopRef.current = requestAnimationFrame(tick);

    return () => {
      isScanning = false;
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
      }
    };
  }, [isCameraActive, isProcessingScan, handleScannedCode]);

  // Image Upload fallback
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const code = await detectQrFromImageFile(file);
      if (code) {
        handleScannedCode(code);
      } else {
        if (!isAudioMuted) playAlertChime();
        setNotificationMsg({
          type: 'ERROR',
          text: isRTL
            ? 'لم يتم العثور على باركود QR صالح في الصورة المرفوعة. يرجى تجربة صورة أوضح أو إدخال الكود يدوياً.'
            : 'No valid QR code was detected in the uploaded image. Try another photo or enter code manually.',
        });
      }
    } catch (err) {
      console.error('Failed to parse uploaded QR:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Manual code input search
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleScannedCode(manualCodeInput.trim());
    setManualCodeInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl shadow-cyan-950/80 p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Scan className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {isRTL
                    ? 'ماسح QR لكاميرا الجهاز وتحديث مواقع وحالات الوجبات'
                    : 'Device Camera QR Batch Scanner & Location Updater'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  STORAGE MODULE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'وجه الكاميرا نحو باركود شليف المادة أو رمز الرف لتحديث الموقع والحالة آلياً في النظام'
                  : 'Point camera at material bulk bag or rack QR to automatically update status and location'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Configuration Strip: Target Location & Status to Auto-Update */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-black text-white">
                {isRTL ? 'إعدادات الوجهة والحالة للتحديث الآلي الفوري:' : 'Automated Update Target & Status Workflow:'}
              </span>
            </div>

            {/* Auto-Update Mode Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoUpdateMode}
                onChange={(e) => setIsAutoUpdateMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
              <span className="text-xs font-bold text-slate-300">
                {isAutoUpdateMode
                  ? isRTL
                    ? '⚡ التحديث التلقائي الفوري مُفعل'
                    : '⚡ Instant Auto-Update ON'
                  : isRTL
                  ? 'المراجعة اليدوية قبل التحديث'
                  : 'Manual Review Mode'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Target Warehouse */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isRTL ? 'المستودع المستهدف' : 'Target Warehouse'}
              </label>
              <select
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-cyan-400"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {isRTL ? w.nameAr : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Location / Rack */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isRTL ? 'موقع الرف / الرصيف المستهدف' : 'Target Location / Rack'}
              </label>
              <select
                value={targetLocationId}
                onChange={(e) => setTargetLocationId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs font-bold outline-none focus:border-cyan-400"
              >
                {availableTargetLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} - {isRTL ? loc.nameAr : loc.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Status */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isRTL ? 'الحالة المراد تعيينها' : 'Status to Assign'}
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as BulkBagStatus)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs font-bold outline-none focus:border-cyan-400"
              >
                <option value="IN_STORAGE">{isRTL ? 'IN_STORAGE (في المستودع ومتاح)' : 'IN_STORAGE (Available)'}</option>
                <option value="QUARANTINED">{isRTL ? 'QUARANTINED (حجر صحي وفحص جودة)' : 'QUARANTINED (Quality Hold)'}</option>
                <option value="RESERVED">{isRTL ? 'RESERVED (محجوز لخط الإنتاج)' : 'RESERVED (Production Stage)'}</option>
                <option value="IN_TRANSIT">{isRTL ? 'IN_TRANSIT (قيد النقل الداخلي)' : 'IN_TRANSIT (Transfer)'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Camera Viewport & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-3">
            <div className="relative aspect-video sm:aspect-[4/3] rounded-2xl bg-black overflow-hidden border-2 border-slate-700 shadow-2xl flex items-center justify-center">
              {/* HTML5 Video element */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Viewport Reticle & Laser Sweep Animation */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  {/* Framing Crosshairs */}
                  <div className="relative w-48 h-48 sm:w-60 sm:h-60 border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.4)]">
                    {/* Laser line sweep */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-bounce" />
                    {/* Corner accents */}
                    <div className="absolute -top-1.5 -start-1.5 w-4 h-4 border-t-4 border-s-4 border-cyan-400" />
                    <div className="absolute -top-1.5 -end-1.5 w-4 h-4 border-t-4 border-e-4 border-cyan-400" />
                    <div className="absolute -bottom-1.5 -start-1.5 w-4 h-4 border-b-4 border-s-4 border-cyan-400" />
                    <div className="absolute -bottom-1.5 -end-1.5 w-4 h-4 border-b-4 border-e-4 border-cyan-400" />
                  </div>
                  <span className="mt-3 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-950/80 text-cyan-300 border border-cyan-500/40">
                    {isProcessingScan
                      ? isRTL
                        ? 'جاري معالجة الوجبة...'
                        : 'Processing Scan...'
                      : isRTL
                      ? 'ضع باركود الوجبة أو الرف داخل الإطار'
                      : 'Align Batch or Location QR within Frame'}
                  </span>
                </div>
              )}

              {/* Camera Offline Placeholder */}
              {!isCameraActive && (
                <div className="text-center p-6 space-y-3">
                  <div className="p-4 rounded-full bg-slate-900 border border-slate-700 inline-block">
                    <CameraOff className="w-8 h-8 text-slate-500" />
                  </div>
                  <div className="text-xs text-slate-400 max-w-xs mx-auto">
                    {cameraError || (isRTL ? 'الكاميرا غير نشطة حالياً' : 'Camera is currently inactive')}
                  </div>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-cyan-950"
                  >
                    {isRTL ? 'إعادة تشغيل الكاميرا' : 'Restart Camera'}
                  </button>
                </div>
              )}

              {/* Camera Overlaid Controls */}
              {isCameraActive && (
                <div className="absolute bottom-3 start-3 end-3 flex items-center justify-between text-xs pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl border backdrop-blur-md cursor-pointer transition-all ${
                        isTorchOn
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-slate-950/70 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                      title={isRTL ? 'تشغيل كشاف الإضاءة' : 'Toggle Torch/Flashlight'}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="p-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md cursor-pointer"
                      title={isRTL ? 'تبديل الكاميرا (أمامية/خلفية)' : 'Switch Front/Back Camera'}
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAudioMuted(!isAudioMuted)}
                      className="p-2 rounded-xl bg-slate-950/70 border border-slate-700 text-slate-300 hover:text-white backdrop-blur-md cursor-pointer"
                      title={isAudioMuted ? 'Unmute chime' : 'Mute chime'}
                    >
                      {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                    </button>
                  </div>

                  <span className="px-2 py-1 rounded-lg bg-slate-950/80 text-[10px] font-mono text-cyan-300 border border-cyan-500/30">
                    FPS: ~10 • JSQR
                  </span>
                </div>
              )}
            </div>

            {/* Fallback Inputs: File Upload & Manual Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Image Upload */}
              <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2 cursor-pointer transition-all">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-slate-300">
                    {isUploadingImage
                      ? isRTL
                        ? 'جاري فحص الصورة...'
                        : 'Scanning...'
                      : isRTL
                      ? 'رفع صورة باركود QR'
                      : 'Upload QR Image'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploadingImage}
                  className="sr-only"
                />
              </label>

              {/* Manual Search */}
              <form onSubmit={handleManualSearch} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder={isRTL ? 'أدخل كود الوجبة/الشليف...' : 'Enter Batch/Bag ID...'}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Right Pane: Identified Batch Details & Live Notification */}
          <div className="lg:col-span-5 space-y-4">
            {/* Real-time Feedback Toast */}
            {notificationMsg && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                  notificationMsg.type === 'SUCCESS'
                    ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200'
                    : notificationMsg.type === 'ERROR'
                    ? 'bg-rose-950/90 border-rose-500/80 text-rose-200'
                    : 'bg-cyan-950/90 border-cyan-500/80 text-cyan-200'
                }`}
              >
                {notificationMsg.type === 'SUCCESS' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : notificationMsg.type === 'ERROR' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
                )}
                <span className="leading-snug">{notificationMsg.text}</span>
              </div>
            )}

            {/* Identified Batch Card */}
            {identifiedBag && identifiedMaterial ? (
              <div className="p-4 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3.5 shadow-xl">
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      {identifiedBag.bagNumber || identifiedBag.id}
                    </span>
                    <h4 className="text-sm font-black text-white mt-1">
                      {isRTL ? identifiedMaterial.nameAr : identifiedMaterial.nameEn}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Code: {identifiedMaterial.code}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black uppercase ${
                      identifiedBag.status === 'QUARANTINED'
                        ? 'bg-red-600 text-white animate-pulse'
                        : identifiedBag.status === 'RESERVED'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {identifiedBag.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'الوزن الصافي' : 'Net Weight'}</span>
                    <span className="text-base font-black text-white">
                      {identifiedBag.weightKG.toLocaleString()} <span className="text-xs text-slate-400 font-normal">KG</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'الموقع الحالي' : 'Current Location'}</span>
                    <span className="text-base font-black text-cyan-300">
                      {identifiedBag.locationCode || 'LOC-A01'}
                    </span>
                  </div>
                </div>

                {/* If Auto-Update is OFF, provide manual confirmation button */}
                {!isAutoUpdateMode && (
                  <button
                    type="button"
                    onClick={() =>
                      executeBatchUpdate(
                        identifiedBag,
                        identifiedMaterial,
                        targetLocationId,
                        targetWarehouseId,
                        targetStatus,
                        false
                      )
                    }
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-950 transition-all active:scale-95"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>
                      {isRTL
                        ? `اعتماد النقل إلى [${targetLocationId}] وتعيين [${targetStatus}]`
                        : `Apply Update to [${targetLocationId}] & [${targetStatus}]`}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2 text-xs text-slate-400">
                <Tag className="w-8 h-8 text-slate-600 mx-auto" />
                <p>
                  {isRTL
                    ? 'لم يتم مسح أي وجبة حتى الآن. وجه الكاميرا نحو كود QR لبدء التعرف والتحديث التلقائي.'
                    : 'No batch scanned yet. Point camera at a QR code to identify and auto-update.'}
                </p>
              </div>
            )}

            {/* Live Session Update History */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'سجل الوجبات المحدثة بهذه الجلسة:' : 'Session Update Activity Log:'}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-900 text-cyan-300">
                  {sessionLogs.length} {isRTL ? 'عملية' : 'items'}
                </span>
              </div>

              {sessionLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pe-1">
                  {sessionLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-[11px] font-mono flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <span>{log.batchId}</span>
                          <span className="text-slate-400">• {log.materialCode}</span>
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          {log.fromLocation} &rarr; <strong className="text-cyan-300">{log.toLocation}</strong> ({log.newStatus})
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <span className="text-white font-bold block">{log.weightKG} KG</span>
                        <span className="text-[10px] text-slate-500">{log.updatedAt}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic py-2 text-center">
                  {isRTL ? 'سجل العمليات فارغ حالياً' : 'No batch updates recorded in current session yet.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">
            {isRTL ? 'المشغل المعتمد:' : 'Operator:'} {currentUser.nameAr} ({currentUser.role})
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition-all"
          >
            {isRTL ? 'إغلاق الماسح' : 'Close Scanner'}
          </button>
        </div>
      </div>
    </div>
  );
};
