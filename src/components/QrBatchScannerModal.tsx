import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Edit3,
  ExternalLink,
  ChevronRight,
  FileText,
  Sparkles,
  Radio,
  Zap,
  Truck,
  MoveRight,
  ShieldAlert,
  AlertOctagon,
  Siren,
  Volume2,
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
import {
  checkMaterialAlertStatus,
  playMaterialWarningAlarm,
  MaterialAlertInfo,
} from '../services/materialAlertService';
import { BulkBag, ReceivingTransaction, ShreddingTransaction, MaterialItem, Supplier, RfidPortal, RfidPalletLoad } from '../types';
import { RfidTrackingService, INITIAL_RFID_PORTALS } from '../services/rfidTrackingService';

export interface QrBatchScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBatchLifecycle: (lookupPayload: {
    batchId?: string;
    bagId?: string;
    transactionNumber?: string;
    materialId?: string;
    rawText?: string;
  }) => void;
  moduleContext?: 'WAREHOUSE' | 'RECEIVING';
  onStockUpdated?: () => void;
  onMaterialAlert?: (alert: MaterialAlertInfo) => void;
  onApplyToScaleIn?: (data: {
    materialId: string;
    supplierId?: string;
    weightKG: number;
    bulkBagsCount: number;
    vehiclePlate?: string;
    warehouseId?: string;
    locationId?: string;
    notes?: string;
  }) => void;
  onInstantStockEntry?: (data: {
    materialId: string;
    supplierId: string;
    weightKG: number;
    bulkBagsCount: number;
    vehiclePlate: string;
    targetWarehouseId: string;
    targetLocationId: string;
    notes: string;
  }) => void;
  onSuccessfulScan?: (data: {
    materialId: string;
    materialCode?: string;
    materialName?: string;
    qrCode: string;
    weightKG: number;
    bulkBagsCount: number;
    supplierName?: string;
    vehiclePlate?: string;
    notes?: string;
    isQuarantined?: boolean;
    isExpired?: boolean;
    alertReason?: string;
    status?: 'NORMAL' | 'QUARANTINED' | 'EXPIRED' | 'FLAGGED';
  }) => void;
}

export const QrBatchScannerModal: React.FC<QrBatchScannerModalProps> = ({
  isOpen,
  onClose,
  onOpenBatchLifecycle,
  moduleContext = 'WAREHOUSE',
  onStockUpdated,
  onMaterialAlert,
  onApplyToScaleIn,
  onInstantStockEntry,
  onSuccessfulScan,
}) => {
  const { isRTL, t } = useLanguage();
  const {
    bulkBags,
    receivingTransactions,
    shreddingTransactions,
    materials,
    suppliers,
    locations,
    warehouses,
    inventoryBalances,
    currentUser,
    createReceivingTransaction,
    completeScaleOut,
    confirmReceivingAndRoute,
    reconcileMaterialStock,
    executeRfidBulkMovement,
  } = useFactory();

  // Scanning Modality: Optical Camera QR vs UHF RFID Non-Line-of-Sight
  const [scanModality, setScanModality] = useState<'CAMERA_QR' | 'UHF_RFID'>('CAMERA_QR');
  const [rfidPortals] = useState<RfidPortal[]>(INITIAL_RFID_PORTALS);
  const [selectedRfidPortalId, setSelectedRfidPortalId] = useState<string>(rfidPortals[0].id);
  const [rfidPallets] = useState<RfidPalletLoad[]>(() => RfidTrackingService.getPalletLoads(bulkBags, materials));
  const [selectedRfidPalletId, setSelectedRfidPalletId] = useState<string>(rfidPallets[0]?.palletId || '');
  const [isRfidExecuting, setIsRfidExecuting] = useState(false);
  const [rfidPassageResult, setRfidPassageResult] = useState<any | null>(null);
  const [rfidSuccessMessage, setRfidSuccessMessage] = useState<string | null>(null);

  // Camera Hardware State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  // Scan Results State
  const [scannedRawText, setScannedRawText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedScannedBag | null>(null);
  const [matchedBag, setMatchedBag] = useState<BulkBag | null>(null);
  const [matchedReceiving, setMatchedReceiving] = useState<ReceivingTransaction | null>(null);
  const [matchedMaterial, setMatchedMaterial] = useState<MaterialItem | null>(null);
  const [matchedSupplier, setMatchedSupplier] = useState<Supplier | null>(null);
  const [matchedBalance, setMatchedBalance] = useState<{ availableKG: number; bulkBagsCount: number } | null>(null);
  const [activeMaterialAlert, setActiveMaterialAlert] = useState<MaterialAlertInfo | null>(null);

  // Instant Stock Entry Form States (Receiving Module)
  const [showInstantStockEntry, setShowInstantStockEntry] = useState(false);
  const [entryMaterialId, setEntryMaterialId] = useState<string>('');
  const [entrySupplierId, setEntrySupplierId] = useState<string>('');
  const [entryWeightKG, setEntryWeightKG] = useState<string>('1000');
  const [entryBagsCount, setEntryBagsCount] = useState<string>('1');
  const [entryWarehouseId, setEntryWarehouseId] = useState<string>('WH-01');
  const [entryLocationId, setEntryLocationId] = useState<string>('LOC-A01');
  const [entryVehiclePlate, setEntryVehiclePlate] = useState<string>('IQ-BAG-1082');
  const [entryNotes, setEntryNotes] = useState<string>('');
  const [isSubmittingStockEntry, setIsSubmittingStockEntry] = useState(false);
  const [stockEntrySuccessMsg, setStockEntrySuccessMsg] = useState<string | null>(null);
  const [stockEntryErrorMsg, setStockEntryErrorMsg] = useState<string | null>(null);

  // Manual search fallback input
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Quick inline stock adjust states
  const [showQuickAdjust, setShowQuickAdjust] = useState(false);
  const [quickAdjustKG, setQuickAdjustKG] = useState('');
  const [quickAdjustBags, setQuickAdjustBags] = useState('');
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState<string | null>(null);
  const [adjustErrorMsg, setAdjustErrorMsg] = useState<string | null>(null);

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

  // Start device camera with rear-camera default
  const startCamera = useCallback(async (targetFacingMode?: 'environment' | 'user') => {
    const activeMode = targetFacingMode || facingMode;
    setCameraError(null);
    stopCamera();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        isRTL
          ? 'المتصفح لا يدعم الوصول المباشر لكاميرا الجهاز. يمكنك استخدام الإدخال اليدوي أو رفع صورة الباركود أدناه.'
          : 'Camera access is not supported by your browser. Please enter the batch code manually or upload an image.'
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: activeMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Failed to start camera with mode:', activeMode, err);
      // Fallback: try default video stream if facingMode constraint fails on specific mobile webviews
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
        const errMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
          setCameraError(
            isRTL
              ? 'تم رفض إذن الوصول للكاميرا في المتصفح. يرجى السماح بالوصول للكاميرا أو استخدام الإدخال اليدوي أدناه.'
              : 'Camera permission denied. Please enable camera permissions in your browser or enter batch code manually.'
          );
        } else {
          setCameraError(
            isRTL
              ? 'تعذر تشغيل كاميرا الجهاز (قد تكون الكاميرا قيد الاستخدام بتطبيق آخر). يمكنك رفع صورة QR أو البحث برقم الوجبة.'
              : 'Unable to start camera. You can upload a QR image or search by batch ID below.'
          );
        }
        setIsCameraActive(false);
      }
    }
  }, [facingMode, isRTL, stopCamera]);

  // Start / stop camera on modal open / close
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      // Reset scan card state
      setScannedRawText(null);
      setParsedData(null);
      setMatchedBag(null);
      setMatchedReceiving(null);
      setMatchedMaterial(null);
      setShowQuickAdjust(false);
      setAdjustSuccessMsg(null);
      setAdjustErrorMsg(null);
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

  // Toggle Front / Back Camera for mobile & tablet scanning
  const toggleFacingMode = async () => {
    setIsSwitchingCamera(true);
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    try {
      await startCamera(nextMode);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  // Match scanned text with database entities
  const resolveScannedEntities = useCallback(
    (codeText: string, alertInfo?: MaterialAlertInfo | null) => {
      const parsed = parseScannedQrData(codeText);
      setParsedData(parsed);

      const targetId = (parsed.bagId || parsed.batchNumber || parsed.transactionNumber || codeText).toUpperCase().trim();

      // 1. Search bulk bags
      const bag = bulkBags.find(
        (b) =>
          b.id.toUpperCase() === targetId ||
          b.bagNumber?.toUpperCase() === targetId ||
          b.bagId?.toUpperCase() === targetId ||
          b.batchNumber?.toUpperCase() === targetId ||
          b.transactionNumber?.toUpperCase() === targetId ||
          (b.qrPayload && b.qrPayload.includes(targetId))
      );
      setMatchedBag(bag || null);

      // 2. Search receiving transactions
      const txNum = parsed.transactionNumber || bag?.transactionNumber || bag?.sourceTransactionNumber || targetId;
      const rcv = receivingTransactions.find(
        (r) =>
          r.transactionNumber.toUpperCase() === txNum.toUpperCase() ||
          r.id.toUpperCase() === txNum.toUpperCase() ||
          r.legacyDocumentNumber === txNum ||
          (targetId.startsWith('LOT-') && (r.purchaseReference?.includes(targetId) || r.notes?.includes(targetId)))
      );
      setMatchedReceiving(rcv || null);

      // 3. Search materials (Instant Material Identification)
      const matId = bag?.materialId || rcv?.materialId || parsed.materialCode || materials[0]?.id;
      const rawLower = codeText.toLowerCase();
      const parsedMatName = (parsed.materialName || '').toLowerCase();
      const parsedMatCode = (parsed.materialCode || '').toLowerCase();

      const mat = materials.find(
        (m) =>
          m.id === matId ||
          m.code.toUpperCase() === targetId ||
          m.code.toUpperCase() === (parsed.materialCode || '').toUpperCase() ||
          (parsedMatCode && m.code.toLowerCase().includes(parsedMatCode)) ||
          (parsedMatName && (m.nameAr?.toLowerCase().includes(parsedMatName) || m.nameEn?.toLowerCase().includes(parsedMatName))) ||
          (rawLower.includes('pet') && m.code.includes('PET')) ||
          (rawLower.includes('pp') && m.code.includes('PP')) ||
          (rawLower.includes('hdpe') && m.code.includes('HDPE')) ||
          (targetId.length > 2 && m.nameAr && m.nameAr.includes(targetId))
      ) || materials[0];
      setMatchedMaterial(mat || null);

      // 4. Search suppliers
      let sup: Supplier | null = null;
      if (rcv?.supplierId) {
        sup = suppliers.find((s) => s.id === rcv.supplierId) || null;
      }
      if (!sup) {
        sup = suppliers.find((s) =>
          rawLower.includes(s.code.toLowerCase()) ||
          (s.nameAr && rawLower.includes(s.nameAr.toLowerCase())) ||
          (s.nameEn && rawLower.includes(s.nameEn.toLowerCase()))
        ) || suppliers[0] || null;
      }
      setMatchedSupplier(sup);

      // 5. Detected Weight & Bags Count
      const detectedKG = parsed.weightKG || bag?.weightKG || (rcv?.netReceivedWeightKG ? rcv.netReceivedWeightKG : 1000);
      const detectedBags = parsed.weightKG
        ? Math.max(1, Math.round(parsed.weightKG / 1000))
        : (bag ? 1 : (rcv?.bulkBagsCount || 1));

      // 6. Pre-fill Instant Stock Entry Form
      if (mat) {
        setEntryMaterialId(mat.id);
        setEntryWarehouseId(mat.defaultWarehouseId || warehouses[0]?.id || 'WH-01');
        setEntryLocationId(mat.defaultLocationId || locations[0]?.id || 'LOC-A01');
      }
      if (sup) {
        setEntrySupplierId(sup.id);
      }
      setEntryWeightKG(String(detectedKG));
      setEntryBagsCount(String(detectedBags));
      setEntryVehiclePlate(rcv?.vehiclePlate || 'IQ-BAG-1082');
      setEntryNotes(
        parsed.batchNumber
          ? `إدخال مخزني مؤتمت عبر مسح QR الوجبة (${parsed.batchNumber})`
          : `إدخال مخزني فوري عبر مسح باركود QR الشحنة`
      );

      // 7. Search inventory balance
      if (mat) {
        const locId = bag?.locationId || rcv?.targetLocationId || locations[0]?.id;
        const bal = inventoryBalances.find((b) => b.materialId === mat.id && b.locationId === locId);
        if (bal) {
          setMatchedBalance({
            availableKG: bal.availableKG,
            bulkBagsCount: bal.bulkBagsCount,
          });
        } else if (bag) {
          setMatchedBalance({
            availableKG: bag.weightKG,
            bulkBagsCount: 1,
          });
        } else {
          setMatchedBalance({
            availableKG: rcv?.netReceivedWeightKG || 1000,
            bulkBagsCount: rcv?.bulkBagsCount || 1,
          });
        }

        // Notify scan history listeners
        if (onSuccessfulScan) {
          const isQuarantined = alertInfo?.isAlert && (alertInfo.type === 'QUARANTINED' || alertInfo.type === 'BOTH');
          const isExpired = alertInfo?.isAlert && (alertInfo.type === 'EXPIRED' || alertInfo.type === 'BOTH');
          onSuccessfulScan({
            materialId: mat.id,
            materialCode: mat.code,
            materialName: isRTL ? mat.nameAr : mat.nameEn,
            qrCode: codeText,
            weightKG: detectedKG,
            bulkBagsCount: detectedBags,
            supplierName: sup ? (isRTL ? sup.nameAr : sup.nameEn) : undefined,
            vehiclePlate: rcv?.vehiclePlate,
            notes: alertInfo?.isAlert
              ? `⚠️ ${alertInfo.reasonAr}`
              : parsed.batchNumber
              ? `مسح وجبة باركود QR (${parsed.batchNumber})`
              : `مسح ضوئي ناجح عبر الكاميرا للتعرف الفوري`,
            isQuarantined,
            isExpired,
            status: isQuarantined ? 'QUARANTINED' : isExpired ? 'EXPIRED' : 'NORMAL',
            alertReason: alertInfo?.reasonAr,
          });
        }
      }
    },
    [bulkBags, receivingTransactions, materials, suppliers, locations, warehouses, inventoryBalances, onSuccessfulScan, isRTL]
  );

  // Scan loop processor
  const handleScannedCode = useCallback(
    (codeText: string) => {
      if (!codeText || isProcessingScan) return;
      setIsProcessingScan(true);
      setScannedRawText(codeText);

      // Check if material is flagged as quarantined or expired in the database
      const alertInfo = checkMaterialAlertStatus(codeText, materials, bulkBags);
      setActiveMaterialAlert(alertInfo);

      if (alertInfo && alertInfo.isAlert) {
        // Trigger high-urgency multi-tone audio siren alarm and haptic vibration
        playMaterialWarningAlarm(alertInfo.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
        if (onMaterialAlert) {
          onMaterialAlert(alertInfo);
        }
      } else {
        playSuccessChime();
      }

      resolveScannedEntities(codeText, alertInfo);

      setTimeout(() => {
        setIsProcessingScan(false);
      }, 1000);
    },
    [isProcessingScan, resolveScannedEntities, materials, bulkBags, onMaterialAlert]
  );

  // Video Scan RAF Loop
  useEffect(() => {
    if (!isCameraActive) return;

    let isScanning = true;
    let lastScanTimestamp = 0;

    const tick = async () => {
      if (!isScanning) return;

      const now = Date.now();
      // Scan every ~90ms for responsive detection
      if (now - lastScanTimestamp > 90 && videoRef.current && !isProcessingScan) {
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

  // Handle Image File Upload for QR Scan
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const code = await detectQrFromImageFile(file);
      if (code) {
        handleScannedCode(code);
      } else {
        playAlertChime();
        setCameraError(
          isRTL
            ? 'لم يتم العثور على رمز QR صالح في الصورة المرفوعة. يرجى تجربة صورة أوضح أو إدخال الكود يدوياً.'
            : 'No valid QR code was detected in the uploaded image. Please try a clearer picture or enter code manually.'
        );
      }
    } catch (err) {
      console.error('Failed to parse uploaded QR:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Handle Manual Code Search Submit
  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleScannedCode(manualCodeInput.trim());
  };

  // Submit quick stock adjustment
  const handleQuickAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustErrorMsg(null);
    setAdjustSuccessMsg(null);

    const kg = parseFloat(quickAdjustKG);
    const bags = parseInt(quickAdjustBags, 10);

    if (isNaN(kg) || kg < 0) {
      setAdjustErrorMsg(isRTL ? 'يرجى إدخال وزن صحيح' : 'Please provide a valid weight');
      return;
    }

    const matId = matchedMaterial?.id || materials[0]?.id;
    const locId = matchedBag?.locationId || matchedReceiving?.targetLocationId || locations[0]?.id;

    const res = reconcileMaterialStock(
      matId,
      locId,
      kg,
      isNaN(bags) ? 1 : bags,
      'تحديث رصيد فوري وسريع عبر ماسح الـ QR الميداني',
      '1234'
    );

    if (res.success) {
      setAdjustSuccessMsg(
        isRTL
          ? `تم تحديث الرصيد إلى ${kg.toLocaleString()} كغم بنجاح!`
          : `Stock updated to ${kg.toLocaleString()} KG successfully!`
      );
      setMatchedBalance({
        availableKG: kg,
        bulkBagsCount: isNaN(bags) ? 1 : bags,
      });
      if (onStockUpdated) onStockUpdated();
      setTimeout(() => setShowQuickAdjust(false), 2000);
    } else {
      setAdjustErrorMsg(res.error || (isRTL ? 'فشلت عملية تحديث الرصيد' : 'Stock adjustment failed'));
    }
  };

  // Submit Instant Stock Entry (Receiving Module)
  const handleInstantStockEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStockEntryErrorMsg(null);
    setStockEntrySuccessMsg(null);
    setIsSubmittingStockEntry(true);

    const kg = parseFloat(entryWeightKG);
    const bags = parseInt(entryBagsCount, 10);

    if (isNaN(kg) || kg <= 0) {
      setStockEntryErrorMsg(isRTL ? 'يرجى إدخال وزن صحيح بالكيلوغرام' : 'Please provide a valid weight in KG');
      setIsSubmittingStockEntry(false);
      return;
    }

    const matId = entryMaterialId || matchedMaterial?.id || materials[0]?.id;
    const supId = entrySupplierId || matchedSupplier?.id || suppliers[0]?.id;

    try {
      if (onInstantStockEntry) {
        onInstantStockEntry({
          materialId: matId,
          supplierId: supId,
          weightKG: kg,
          bulkBagsCount: isNaN(bags) ? 1 : bags,
          vehiclePlate: entryVehiclePlate || 'IQ-BAG-1082',
          targetWarehouseId: entryWarehouseId,
          targetLocationId: entryLocationId,
          notes: entryNotes || 'إدخال مخزني مباشر عبر مسح QR الكاميرا',
        });
        playSuccessChime();
        setStockEntrySuccessMsg(
          isRTL
            ? `✓ تم تثبيت الإدخال المخزني للمادة (${kg.toLocaleString()} كغم) بنجاح!`
            : `✓ Stock entry (${kg.toLocaleString()} KG) recorded successfully!`
        );
        if (onStockUpdated) onStockUpdated();
        setTimeout(() => {
          setIsSubmittingStockEntry(false);
          setShowInstantStockEntry(false);
        }, 1500);
      } else {
        // Direct execution via factory context
        const res = createReceivingTransaction({
          supplierId: supId,
          materialId: matId,
          scaleInWeightKG: kg + 12000, // Gross
          bulkBagsCount: isNaN(bags) ? 1 : bags,
          vehiclePlate: entryVehiclePlate || 'IQ-BAG-1082',
          targetWarehouseId: entryWarehouseId,
          targetLocationId: entryLocationId,
          notes: entryNotes || 'إدخال مخزني مباشر عبر مسح QR الكاميرا',
          operator: currentUser.nameAr || currentUser.name,
        });

        if (res.success && res.id) {
          completeScaleOut(res.id, 12000); // Net = kg
          confirmReceivingAndRoute(res.id, 'STORAGE', entryWarehouseId, entryLocationId);
          playSuccessChime();
          setStockEntrySuccessMsg(
            isRTL
              ? `✓ تم تسجيل إدخال مخزني فوري للمادة (${kg.toLocaleString()} كغم) وتوثيق مستند الاستلام 546 بنجاح!`
              : `✓ Instant stock entry registered (${kg.toLocaleString()} KG) and document #546 issued!`
          );
          if (onStockUpdated) onStockUpdated();
          setTimeout(() => {
            setIsSubmittingStockEntry(false);
            setShowInstantStockEntry(false);
          }, 1500);
        } else {
          setStockEntryErrorMsg(res.error || (isRTL ? 'فشلت عملية الإدخال المخزني' : 'Stock entry failed'));
          setIsSubmittingStockEntry(false);
        }
      }
    } catch (err: any) {
      setStockEntryErrorMsg(err?.message || (isRTL ? 'حدث خطأ أثناء الإدخال' : 'Error during stock entry'));
      setIsSubmittingStockEntry(false);
    }
  };

  const handleApplyToScaleInClick = () => {
    if (onApplyToScaleIn && (matchedMaterial || materials[0])) {
      const targetMat = matchedMaterial || materials[0];
      const kg = parseFloat(entryWeightKG) || 1000;
      const bags = parseInt(entryBagsCount, 10) || 1;
      onApplyToScaleIn({
        materialId: targetMat.id,
        supplierId: entrySupplierId || matchedSupplier?.id,
        weightKG: kg,
        bulkBagsCount: bags,
        vehiclePlate: entryVehiclePlate,
        warehouseId: entryWarehouseId,
        locationId: entryLocationId,
        notes: entryNotes,
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  // Recent factory batches for one-click manual testing/demo
  const sampleBatches = [
    {
      label: isRTL ? '⚠️ خامة محجورة (PP-REC-Q8)' : '⚠️ Quarantined (PP-REC-Q8)',
      code: 'MAT-008',
    },
    {
      label: isRTL ? '⏰ خامة منتهية (PET-EXP-09)' : '⏰ Expired (PET-EXP-09)',
      code: 'MAT-009',
    },
    {
      label: isRTL ? '📦 شحنة خام PET (42 طن)' : '📦 Bulk PET Shipment (42T)',
      code: JSON.stringify({
        type: 'INTAKE',
        mat_code: 'RAW-PET-01',
        mat: 'حبيبات PET النقية',
        net_kg: 42000,
        bags: 42,
        sup: 'شركة بابل للبتروكيماويات',
        plate: 'بغداد 84219 أ',
        doc: 'DOC-546-0928'
      })
    },
    {
      label: isRTL ? '🏷️ شليف وارد 1,150 كغم' : '🏷️ Bulk Bag Tag (1,150 KG)',
      code: 'SHL-000001'
    },
    {
      label: isRTL ? '📄 مستند استلام 546' : '📄 Doc #546 Receipt',
      code: 'RCV-2026-0842'
    },
    {
      label: isRTL ? '⚡ مجروش بلاستيك 360' : '⚡ Shredded 360 Regrind',
      code: 'THM-2026-0318'
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative hud-glow-cyan">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 border-b border-cyan-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              {scanModality === 'UHF_RFID' ? <Radio className="w-5 h-5 animate-pulse text-amber-400" /> : <Camera className="w-5 h-5 animate-pulse" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {scanModality === 'UHF_RFID' ? 'EPC GEN2 UHF RFID TRACKER' : (moduleContext === 'RECEIVING' ? 'RECEIVING CAMERA SCANNER' : 'WAREHOUSE CAMERA SCANNER')}
                </span>
                {scanModality === 'UHF_RFID' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    NON-LINE-OF-SIGHT
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <span>
                  {scanModality === 'UHF_RFID'
                    ? (isRTL ? 'ماسح RFID الآلي للبوابات والحركات الجماعية' : 'Automated Bulk RFID Portal Scanner')
                    : (moduleContext === 'RECEIVING'
                      ? (isRTL ? 'ماسح QR الإرساليات والوجبات (قسم الاستلام)' : 'Receiving QR Batch Scanner')
                      : (isRTL ? 'ماسح QR المستودعات والوجبات والشلايف' : 'Warehouse QR Batch Scanner'))}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Modality Switcher Pill Buttons */}
            <div className="bg-slate-950/80 p-1 rounded-xl border border-white/10 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setScanModality('CAMERA_QR');
                  startCamera();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scanModality === 'CAMERA_QR'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">QR / كاميرا</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setScanModality('UHF_RFID');
                  stopCamera();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  scanModality === 'UHF_RFID'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>RFID بوابات</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Based on Modality */}
        {scanModality === 'UHF_RFID' ? (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
            {/* RFID Portal Zone Selection */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-amber-300">
                  {isRTL ? 'نظام التقاط RFID الكهرومغناطيسي دون خط رؤية' : 'Non-Line-Of-Sight UHF RFID Portal'}
                </div>
                <div className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                  {isRTL
                    ? 'يتم رصد وقراءة كافة بطاقات الأكياس والطبالي لاسلكياً فور مرور الرافعة الشوكية عبر البوابة دون الحاجة لتوجيه الكاميرا إلى كل شليف على حدة.'
                    : 'Automated ultra-high frequency electromagnetic scanning detects all tags on pallets traversing warehouse choke points without requiring optical line of sight.'}
                </div>
              </div>
            </div>

            {/* Portal Gate Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isRTL ? 'بوابة العبور المستشعرة (Portal Gate):' : 'Active Portal Gate:'}
                </label>
                <select
                  value={selectedRfidPortalId}
                  onChange={(e) => {
                    setSelectedRfidPortalId(e.target.value);
                    setRfidPassageResult(null);
                    setRfidSuccessMessage(null);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/15 rounded-xl text-white text-xs outline-none focus:border-amber-400"
                >
                  {rfidPortals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {isRTL ? p.nameAr.split('(')[0] : p.nameEn.split('(')[0]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isRTL ? 'الطبلية المارة عبر البوابة (Pallet Load):' : 'Traversing Pallet Load:'}
                </label>
                <select
                  value={selectedRfidPalletId}
                  onChange={(e) => {
                    setSelectedRfidPalletId(e.target.value);
                    setRfidPassageResult(null);
                    setRfidSuccessMessage(null);
                  }}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-white/15 rounded-xl text-white text-xs outline-none focus:border-amber-400"
                >
                  {rfidPallets.map((plt) => (
                    <option key={plt.palletId} value={plt.palletId}>
                      [{plt.palletId}] {plt.materialNameAr} ({plt.bulkBagsCount} أكياس / {plt.totalWeightKG.toLocaleString()} كغم)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Portal Route Visualizer */}
            {(() => {
              const curPortal = rfidPortals.find((p) => p.id === selectedRfidPortalId) || rfidPortals[0];
              const curPallet = rfidPallets.find((p) => p.palletId === selectedRfidPalletId) || rfidPallets[0];
              return (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                    <span className="font-mono text-cyan-400 font-bold">{curPortal.code}</span>
                    <span className="text-slate-400">{curPortal.installedGateLocationAr}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-white/5 flex-1">
                      <div className="text-[10px] text-slate-400">{isRTL ? 'نقطة الانطلاق (المصدر):' : 'Origin Zone:'}</div>
                      <div className="font-bold text-white font-mono mt-0.5">{curPortal.locationFromCode}</div>
                      <div className="text-[10px] text-slate-500">{curPortal.zoneFrom}</div>
                    </div>

                    <MoveRight className="w-5 h-5 text-amber-400 shrink-0" />

                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex-1">
                      <div className="text-[10px] text-amber-300">{isRTL ? 'نقطة الوصول (المستقبل):' : 'Target Zone:'}</div>
                      <div className="font-bold text-amber-200 font-mono mt-0.5">{curPortal.locationToCode}</div>
                      <div className="text-[10px] text-amber-300/70">{curPortal.zoneTo}</div>
                    </div>
                  </div>

                  {curPallet && (
                    <div className="pt-2 border-t border-white/5 text-[11px] text-slate-300 flex items-center justify-between">
                      <span>🏷️ {curPallet.descriptionAr}</span>
                      <span className="font-mono text-emerald-400 font-bold">{curPallet.totalWeightKG.toLocaleString()} KG ({curPallet.bulkBagsCount} أكياس)</span>
                    </div>
                  )}

                  {/* Trigger Automated Portal Passage Button */}
                  <button
                    type="button"
                    disabled={isRfidExecuting || !curPallet}
                    onClick={async () => {
                      if (!curPallet) return;
                      setIsRfidExecuting(true);
                      setRfidPassageResult(null);
                      setRfidSuccessMessage(null);

                      setTimeout(async () => {
                        const scanRes = RfidTrackingService.simulatePortalPassage(curPortal, curPallet, bulkBags);
                        setRfidPassageResult(scanRes);

                        const moveRes = await executeRfidBulkMovement({
                          portalId: curPortal.id,
                          portalNameAr: curPortal.nameAr,
                          portalNameEn: curPortal.nameEn,
                          palletId: curPallet.palletId,
                          palletRfidTag: curPallet.palletRfidTag,
                          bagIds: curPallet.bagIds,
                          toWarehouseId: curPortal.warehouseToId,
                          toLocationCode: curPortal.locationToCode,
                          notes: `عبور فوري عبر بوابة ${curPortal.code}`,
                          trackingMethod: 'RFID_PORTAL',
                        });

                        setIsRfidExecuting(false);
                        setRfidSuccessMessage(moveRes.messageAr);
                        if (onStockUpdated) onStockUpdated();
                      }, 400);
                    }}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    {isRfidExecuting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>{isRTL ? 'جاري التقاط الإشارات الكهرومغناطيسية وتوثيق الحركة...' : 'Scanning RFID Array & Moving Assets...'}</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>{isRTL ? 'إطلاق العبور الآلي للطبلية عبر بوابة RFID' : 'Simulate Pallet Passage Through Portal'}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })()}

            {/* RFID Feedback Message */}
            {rfidSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{rfidSuccessMessage}</span>
              </div>
            )}

            {/* RFID Telemetry Result */}
            {rfidPassageResult && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2 text-xs font-mono animate-fade-in">
                <div className="flex items-center justify-between text-amber-400 font-bold pb-1 border-b border-white/10">
                  <span>RF Pulse: {rfidPassageResult.detectedTags.length} Tags Detected</span>
                  <span>Duration: {rfidPassageResult.readDurationMs}ms</span>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {rfidPassageResult.detectedTags.map((t: any, idx: number) => (
                    <div key={t.epc + idx} className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>{t.epc} ({t.assetId})</span>
                      <span className="text-cyan-400">{t.rssi} dBm</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Scrollable Scanner Body (Standard Camera QR) */
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          {/* Camera Viewfinder Box */}
          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-cyan-500/40 shadow-inner aspect-video sm:aspect-[4/3] flex items-center justify-center">
            {isCameraActive ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                <CameraOff className="w-10 h-10 text-slate-600" />
                <p className="text-xs text-slate-400 max-w-sm">
                  {cameraError || (isRTL ? 'جاري تفعيل كاميرا الجهاز...' : 'Activating device camera...')}
                </p>
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إعادة تشغيل الكاميرا' : 'Restart Camera'}</span>
                </button>
              </div>
            )}

            {/* Viewfinder Reticle & HUD Overlay */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Darkened mask around reticle */}
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-cyan-400/80 rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                  {/* Corner Targets */}
                  <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-cyan-300" />
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-cyan-300" />
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-cyan-300" />
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-cyan-300" />

                  {/* Laser Scanning Sweep Line */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-laser-sweep" />

                  {/* Centered Guide Text */}
                  <div className="absolute inset-x-0 bottom-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/70 text-cyan-300 border border-cyan-500/30">
                      {isRTL ? 'وجه الكاميرا نحو رمز QR' : 'Align QR inside frame'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* On-screen Camera Controls Overlay */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                disabled={isSwitchingCamera}
                className="px-2.5 py-1.5 rounded-xl bg-black/75 hover:bg-black/95 text-cyan-300 border border-cyan-500/40 backdrop-blur-md flex items-center gap-1.5 text-xs font-bold cursor-pointer transition shadow-lg active:scale-95 disabled:opacity-50"
                title={
                  isRTL
                    ? `تبديل الكاميرا (الحالية: ${facingMode === 'environment' ? 'الخلفية' : 'الأمامية'})`
                    : `Switch Camera (Current: ${facingMode === 'environment' ? 'Back' : 'Front'})`
                }
              >
                <SwitchCamera className={`w-4 h-4 text-cyan-400 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
                <span className="text-[11px] font-semibold">
                  {facingMode === 'environment'
                    ? (isRTL ? 'الخلفية' : 'Back')
                    : (isRTL ? 'الأمامية' : 'Front')}
                </span>
              </button>

              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl border backdrop-blur-sm cursor-pointer ${
                  isTorchOn
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                    : 'bg-black/60 hover:bg-black/90 text-slate-300 border-slate-700'
                }`}
                title={isRTL ? 'تشغيل فلاش الكاميرا' : 'Toggle flashlight'}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Camera Switcher & Status Bar */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Camera className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-400">
                  {isRTL ? 'الكاميرا النشطة:' : 'Active Camera:'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {facingMode === 'environment'
                    ? (isRTL ? '📷 الكاميرا الخلفية (المواد والشاحنات)' : '📷 Back Camera (Materials & Trucks)')
                    : (isRTL ? '🤳 الكاميرا الأمامية' : '🤳 Front Camera')}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleFacingMode}
              disabled={isSwitchingCamera}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950 cursor-pointer transition active:scale-95 shrink-0 disabled:opacity-50"
              title={isRTL ? 'التبديل بين الكاميرا الأمامية والخلفية' : 'Switch front/back camera'}
            >
              <SwitchCamera className={`w-3.5 h-3.5 ${isSwitchingCamera ? 'animate-spin' : ''}`} />
              <span>
                {facingMode === 'environment'
                  ? (isRTL ? 'تبديل للأمامية' : 'Switch to Front')
                  : (isRTL ? 'تبديل للخلفية' : 'Switch to Back')}
              </span>
            </button>
          </div>

          {/* Quick Upload or Manual Search Options Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Upload QR Image File */}
            <label className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Upload className="w-4 h-4" />
                </span>
                <div>
                  <div className="font-bold text-white text-xs">
                    {isRTL ? 'رفع صورة باركود QR' : 'Upload QR Image File'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isRTL ? 'مسح ملف صورة من الاستوديو' : 'Scan image or screenshot'}
                  </div>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploadingImage}
                className="hidden"
              />
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-300">
                {isUploadingImage ? '...' : (isRTL ? 'تصفح' : 'Browse')}
              </span>
            </label>

            {/* Manual Code Input Form */}
            <form onSubmit={handleManualSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 rtl:left-auto rtl:right-3" />
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder={isRTL ? 'أدخل كود الوجبة أو الشليف...' : 'Enter Batch/Bag ID...'}
                  className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-white font-mono text-xs focus:border-cyan-400 focus:outline-none rtl:pl-3 rtl:pr-9"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer"
              >
                {isRTL ? 'بحث' : 'Lookup'}
              </button>
            </form>
          </div>

          {/* Quick Demo Batch Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-500">{isRTL ? 'وجبات سريعة للتجربة:' : 'Quick samples:'}</span>
            {sampleBatches.map((item) => (
              <button
                key={item.code}
                onClick={() => handleScannedCode(item.code)}
                className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-[10px] font-mono cursor-pointer transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Scanned Result Banner Card */}
          {scannedRawText && (
            <div
              className={`p-4 sm:p-5 rounded-2xl border shadow-xl space-y-4 animate-in slide-in-from-bottom duration-300 ${
                activeMaterialAlert && activeMaterialAlert.isAlert
                  ? activeMaterialAlert.type === 'EXPIRED'
                    ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-orange-950/70 border-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.35)]'
                    : 'bg-gradient-to-r from-red-950/90 via-slate-900 to-rose-950/70 border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.35)]'
                  : 'bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border-cyan-400'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`p-2 rounded-xl border ${
                      activeMaterialAlert && activeMaterialAlert.isAlert
                        ? activeMaterialAlert.type === 'EXPIRED'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 animate-bounce'
                          : 'bg-red-500/20 text-red-400 border-red-500/50 animate-bounce'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}
                  >
                    {activeMaterialAlert && activeMaterialAlert.isAlert ? (
                      activeMaterialAlert.type === 'EXPIRED' ? (
                        <AlertOctagon className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </span>
                  <div>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        activeMaterialAlert && activeMaterialAlert.isAlert
                          ? activeMaterialAlert.type === 'EXPIRED'
                            ? 'text-amber-400 animate-pulse'
                            : 'text-red-400 animate-pulse'
                          : 'text-emerald-400'
                      }`}
                    >
                      {activeMaterialAlert && activeMaterialAlert.isAlert
                        ? isRTL
                          ? activeMaterialAlert.type === 'EXPIRED'
                            ? '⚠️ تنبيه أمني: خامة منتهية الصلاحية!'
                            : '⚠️ إنذار رقابي: خامة محجورة في قاعدة البيانات!'
                          : activeMaterialAlert.type === 'EXPIRED'
                          ? '⚠️ CRITICAL ALERT: EXPIRED MATERIAL!'
                          : '⚠️ CRITICAL ALERT: QUARANTINED MATERIAL!'
                        : isRTL
                        ? 'تم التقاط الباركود بنجاح'
                        : 'QR Detected Successfully'}
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-white font-mono">
                      {scannedRawText}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeMaterialAlert && activeMaterialAlert.isAlert ? (
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black font-mono border uppercase tracking-wider ${
                        activeMaterialAlert.type === 'EXPIRED'
                          ? 'bg-amber-950 text-amber-300 border-amber-500/60 shadow-sm'
                          : 'bg-red-950 text-red-300 border-red-500/60 shadow-sm'
                      }`}
                    >
                      {activeMaterialAlert.status}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-xl text-[10px] font-bold bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                      {parsedData?.type || 'BATCH'}
                    </span>
                  )}
                </div>
              </div>

              {/* High-Priority Warning Alert Callout */}
              {activeMaterialAlert && activeMaterialAlert.isAlert && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    activeMaterialAlert.type === 'EXPIRED'
                      ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                      : 'bg-red-950/60 border-red-500/60 text-red-200'
                  }`}
                >
                  <Siren className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
                  <div className="text-xs space-y-1">
                    <div className="font-black">
                      {isRTL ? 'السبب المسجل في النظام الرقابي:' : 'Regulatory Flag Reason:'}{' '}
                      <span className="font-normal text-white">{isRTL ? activeMaterialAlert.reasonAr : activeMaterialAlert.reason}</span>
                    </div>
                    <div className="text-[11px] text-red-300 font-medium">
                      {isRTL ? activeMaterialAlert.directiveAr : activeMaterialAlert.directiveEn}
                    </div>
                  </div>
                </div>
              )}

              {/* Matched Batch Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isRTL ? 'المادة الخام المستلمة:' : 'Identified Material:'}</span>
                  <span className="font-bold text-white truncate block">
                    {matchedMaterial ? (isRTL ? (matchedMaterial.nameAr || matchedMaterial.nameEn) : (matchedMaterial.nameEn || matchedMaterial.nameAr)) : '---'}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">{matchedMaterial?.code || 'RAW-MAT'}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {moduleContext === 'RECEIVING'
                      ? (isRTL ? 'الوزن الصافي للشحنة:' : 'Scanned Net Weight:')
                      : (isRTL ? 'الرصيد الفعلي المتوفر:' : 'Available Stock:')}
                  </span>
                  <span className="font-bold font-mono text-emerald-400 text-sm">
                    {moduleContext === 'RECEIVING'
                      ? `${(parseFloat(entryWeightKG) || 1000).toLocaleString()} KG`
                      : `${((matchedBalance?.availableKG ?? matchedBag?.weightKG ?? 0)).toLocaleString()} KG`}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {moduleContext === 'RECEIVING'
                      ? `${entryBagsCount || 1} ${isRTL ? 'شليف وارد' : 'Bags'}`
                      : `${matchedBalance?.bulkBagsCount ?? 1} ${isRTL ? 'شلايف' : 'Bags'}`}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">
                    {moduleContext === 'RECEIVING'
                      ? (isRTL ? 'المورد المعتمد:' : 'Supplier:')
                      : (isRTL ? 'الموقع المخزني:' : 'Stored Location:')}
                  </span>
                  {moduleContext === 'RECEIVING' ? (
                    <div>
                      <span className="font-bold text-slate-200 truncate block">
                        {matchedSupplier ? (isRTL ? matchedSupplier.nameAr : matchedSupplier.nameEn) : (isRTL ? 'مورد معتمد' : 'Verified Supplier')}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400">{matchedSupplier?.code || 'SUP-01'}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="font-mono font-bold text-amber-300">
                        {matchedBag?.locationCode || matchedReceiving?.targetLocationCode || 'LOC-A01'}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {matchedBag?.warehouseName || (isRTL ? 'مستودع الخامات' : 'Raw Materials Store')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[10px]">{isRTL ? 'رقم المستند / الإرسالية:' : 'Document Reference:'}</span>
                  <span className="font-mono text-slate-300 text-xs truncate block">
                    {parsedData?.transactionNumber || matchedReceiving?.transactionNumber || matchedBag?.transactionNumber || 'RCV-DOC-546'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {parsedData?.batchNumber ? `Lot: ${parsedData.batchNumber}` : (isRTL ? 'مستند 546 استلام خامات' : 'Doc #546 Raw Intake')}
                  </span>
                </div>
              </div>

              {/* Direct Operational Action Buttons */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {activeMaterialAlert && activeMaterialAlert.isAlert ? (
                    <>
                      {/* Quarantined/Expired: Show Alert Report Trigger & Blocked notice */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onMaterialAlert) onMaterialAlert(activeMaterialAlert);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-red-950 cursor-pointer transition active:scale-95 animate-pulse"
                      >
                        <ShieldAlert className="w-4 h-4 text-white" />
                        <span>{isRTL ? '⚠️ عرض تقرير الحجر وإجراءات العزل' : 'View Quarantine Report'}</span>
                      </button>

                      <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-red-500/50 text-red-300 text-xs font-bold shadow-inner">
                        <Lock className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span>{isRTL ? '⛔ الإدخال المخزني المباشر محظور' : 'Direct Intake Blocked'}</span>
                      </div>
                    </>
                  ) : moduleContext === 'RECEIVING' ? (
                    <>
                      {/* Primary Action 1: Instant Stock Entry (Direct Intake) */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowInstantStockEntry(!showInstantStockEntry);
                          setShowQuickAdjust(false);
                          setStockEntryErrorMsg(null);
                          setStockEntrySuccessMsg(null);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
                      >
                        <Zap className="w-4 h-4 text-emerald-200" />
                        <span>{isRTL ? '⚡ إدخال مخزني فوري للمادة' : '⚡ Instant Stock Entry'}</span>
                      </button>

                      {/* Primary Action 2: Apply to Scale-In Form */}
                      {onApplyToScaleIn && (
                        <button
                          type="button"
                          onClick={handleApplyToScaleInClick}
                          className="px-3.5 py-2.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          title={isRTL ? 'نقل البيانات لاستمارة ميزان الدخول' : 'Apply data to scale-in ticket'}
                        >
                          <Truck className="w-4 h-4 text-cyan-400" />
                          <span>{isRTL ? 'تعبئة استمارة ميزان الدخول' : 'Fill Scale-In Ticket'}</span>
                        </button>
                      )}

                      {/* Tertiary: View Batch Lifecycle */}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenBatchLifecycle({
                            batchId: scannedRawText,
                            bagId: matchedBag?.id || parsedData?.bagId,
                            transactionNumber: matchedReceiving?.transactionNumber || parsedData?.transactionNumber,
                            materialId: matchedMaterial?.id,
                            rawText: scannedRawText,
                          });
                          onClose();
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isRTL ? 'دورة الحياة' : 'Lifecycle'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Warehouse Modality: Open Batch Lifecycle */}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenBatchLifecycle({
                            batchId: scannedRawText,
                            bagId: matchedBag?.id || parsedData?.bagId,
                            transactionNumber: matchedReceiving?.transactionNumber || parsedData?.transactionNumber,
                            materialId: matchedMaterial?.id,
                            rawText: scannedRawText,
                          });
                          onClose();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
                      >
                        <Clock className="w-4 h-4 text-cyan-200" />
                        <span>{isRTL ? 'عرض دورة حياة الوجبة (Batch Lifecycle)' : 'View Batch Lifecycle'}</span>
                        <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                      </button>

                      {/* Warehouse: Quick Stock Level Update */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowQuickAdjust(!showQuickAdjust);
                          setShowInstantStockEntry(false);
                          setQuickAdjustKG(String(matchedBalance?.availableKG ?? matchedBag?.weightKG ?? '1000'));
                          setQuickAdjustBags(String(matchedBalance?.bulkBagsCount ?? 1));
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'تحديث رصيد المادة' : 'Update Stock Level'}</span>
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setScannedRawText(null);
                    setParsedData(null);
                    setShowInstantStockEntry(false);
                    setShowQuickAdjust(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                >
                  {isRTL ? 'مسح رمز آخر' : 'Scan Next'}
                </button>
              </div>

              {/* Instant Stock Entry Drawer (Receiving Module) */}
              {showInstantStockEntry && (
                <form
                  onSubmit={handleInstantStockEntrySubmit}
                  className="p-4 rounded-2xl bg-slate-950/95 border border-emerald-500/40 space-y-3.5 animate-in slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <Zap className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className="font-bold text-white text-xs sm:text-sm">
                          {isRTL ? 'تسجيل إدخال مخزني فوري للمواد المستلمة (مستند 546)' : 'Instant Stock Intake & Receiving Registration (Doc #546)'}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {isRTL ? 'إثبات استلام الشحنة وتحديث الرصيد الفعلي للمستودع مباشرة' : 'Direct receipt document generation & inventory balance increment'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInstantStockEntry(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {stockEntryErrorMsg && (
                    <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{stockEntryErrorMsg}</span>
                    </div>
                  )}

                  {stockEntrySuccessMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{stockEntrySuccessMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Material */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'المادة المحددة:' : 'Material:'} *
                      </label>
                      <select
                        value={entryMaterialId}
                        onChange={(e) => setEntryMaterialId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs outline-none focus:border-emerald-400"
                        required
                      >
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} - {isRTL ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Supplier */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'المورد:' : 'Supplier:'} *
                      </label>
                      <select
                        value={entrySupplierId}
                        onChange={(e) => setEntrySupplierId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                        required
                      >
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {isRTL ? s.nameAr : s.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Net Weight */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'الوزن الصافي (كغم):' : 'Net Weight (KG):'} *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="1"
                        value={entryWeightKG}
                        onChange={(e) => setEntryWeightKG(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-xs outline-none focus:border-emerald-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Bulk Bags Count */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'عدد أكياس الشليف:' : 'Bulk Bags Count:'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={entryBagsCount}
                        onChange={(e) => setEntryBagsCount(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-xs outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* Target Warehouse */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'المستودع الوجهة:' : 'Target Warehouse:'}
                      </label>
                      <select
                        value={entryWarehouseId}
                        onChange={(e) => setEntryWarehouseId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                      >
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} - {isRTL ? w.nameAr : w.nameEn}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target Location / Bay */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'العنبر / موقع التخزين:' : 'Staging Location Bay:'}
                      </label>
                      <select
                        value={entryLocationId}
                        onChange={(e) => setEntryLocationId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                      >
                        {locations
                          .filter((l) => l.warehouseId === entryWarehouseId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code} - {isRTL ? l.nameAr : l.nameEn}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Vehicle Plate */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'رقم لوحة الشاحنة / الحاوية:' : 'Vehicle Plate / Container:'}
                      </label>
                      <input
                        type="text"
                        value={entryVehiclePlate}
                        onChange={(e) => setEntryVehiclePlate(e.target.value)}
                        placeholder="e.g. IQ-BAG-84219"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-emerald-400"
                      />
                    </div>

                    {/* Operational Notes */}
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1 font-bold">
                        {isRTL ? 'ملاحظات الشحنة والباركود:' : 'Intake Notes & QR Ref:'}
                      </label>
                      <input
                        type="text"
                        value={entryNotes}
                        onChange={(e) => setEntryNotes(e.target.value)}
                        placeholder={isRTL ? 'إدخال فوري عبر مسح QR الكاميرا' : 'Instant intake via camera scan'}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isRTL ? 'المشرف المسؤول:' : 'Operator:'} {currentUser?.nameAr || currentUser?.name || 'مشرف الاستلام'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInstantStockEntry(false)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                      >
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingStockEntry}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>{isSubmittingStockEntry ? (isRTL ? 'جاري التثبيت...' : 'Recording...') : (isRTL ? '✓ تأكيد وتثبيت الإدخال المخزني' : 'Confirm Stock Intake')}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Inline Quick Stock Adjust Drawer (Warehouse Modality) */}
              {showQuickAdjust && (
                <form
                  onSubmit={handleQuickAdjustSubmit}
                  className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3 animate-in slide-in-from-top-2 duration-200"
                >
                  <div className="font-bold text-white text-xs flex items-center justify-between">
                    <span>{isRTL ? 'تحديث فوري لرصيد هذا الرف / الوجبة:' : 'Instant Stock Level Reconcile:'}</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAdjust(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  {adjustErrorMsg && (
                    <div className="text-rose-400 text-[11px]">{adjustErrorMsg}</div>
                  )}
                  {adjustSuccessMsg && (
                    <div className="text-emerald-400 text-[11px]">{adjustSuccessMsg}</div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">
                        {isRTL ? 'الوزن الفعلي الجديد (كغم):' : 'New Weight (KG):'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickAdjustKG}
                        onChange={(e) => setQuickAdjustKG(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">
                        {isRTL ? 'عدد الشلايف الفعلي:' : 'New Bags Count:'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={quickAdjustBags}
                        onChange={(e) => setQuickAdjustBags(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                    >
                      {isRTL ? 'تثبيت الرصيد الآن' : 'Save Stock'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

        {/* Footer */}
        <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-400 text-[11px]">
            {isRTL
              ? 'الكاميرا تدعم فك تشفير الباركود المعياري ورموز QR للشلايف والمواقع'
              : 'Direct camera decoding with hardware BarcodeDetector & fallback engine'}
          </span>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium cursor-pointer"
          >
            {isRTL ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
