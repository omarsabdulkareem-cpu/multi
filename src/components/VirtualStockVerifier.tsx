import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  QrCode,
  Scan,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Layers,
  ArrowRight,
  ArrowLeft,
  Volume2,
  VolumeX,
  Flashlight,
  Upload,
  Search,
  Check,
  FileSpreadsheet,
  Printer,
  History,
  ShieldCheck,
  Sparkles,
  Info,
  Sliders,
  Scale,
  Calendar,
  UserCheck,
  X,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { BulkBag, WarehouseLocation, Warehouse } from '../types';
import {
  detectQrCodeFromVideo,
  detectQrFromImageFile,
  parseScannedQrData,
  playSuccessChime,
  playAlertChime,
  playLocationChime,
  ParsedScannedBag,
} from '../services/qrScannerService';
import { BulkBagQrGenerator } from './BulkBagQrGenerator';

export interface AuditRecordItem {
  id: string;
  timestamp: string;
  bagId: string;
  materialName: string;
  weightKG: number;
  digitalLocationCode: string;
  physicalLocationCode: string;
  status: 'MATCH' | 'MISPLACED' | 'STATUS_CONFLICT' | 'UNREGISTERED';
  actionTaken?: string;
  auditorName: string;
}

export const VirtualStockVerifier: React.FC = () => {
  const { isRTL, t } = useLanguage();
  const {
    bulkBags,
    updateBulkBag,
    registerBulkBag,
    warehouses,
    locations,
    materials,
    currentUser,
    logAudit,
    setCurrentPage,
  } = useFactory();

  // Selected Physical Auditing Location (Where staff member is currently standing)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(
    warehouses[0]?.id || 'WH-01'
  );
  const filteredLocations = useMemo(
    () => locations.filter((loc) => loc.warehouseId === selectedWarehouseId),
    [locations, selectedWarehouseId]
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    filteredLocations[0]?.id || locations[0]?.id || 'LOC-A01'
  );

  const activePhysicalLocation = useMemo(() => {
    return (
      locations.find((l) => l.id === selectedLocationId) ||
      locations[0] || {
        id: 'LOC-A01',
        code: 'LOC-A-01',
        nameAr: 'رف A-01',
        nameEn: 'Rack A-01',
        warehouseId: 'WH-01',
        warehouseNameAr: 'مستودع الخامات الرئيسي',
        warehouseNameEn: 'Main Raw Warehouse',
      }
    );
  }, [locations, selectedLocationId]);

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [continuousScan, setContinuousScan] = useState<boolean>(false);
  const [isProcessingScan, setIsProcessingScan] = useState<boolean>(false);

  // Current Scanned Result
  const [lastScannedRaw, setLastScannedRaw] = useState<string | null>(null);
  const [parsedScan, setParsedScan] = useState<ParsedScannedBag | null>(null);
  const [matchedBag, setMatchedBag] = useState<BulkBag | null>(null);
  const [verificationVerdict, setVerificationVerdict] = useState<
    'MATCH' | 'MISPLACED' | 'STATUS_CONFLICT' | 'UNREGISTERED' | null
  >(null);
  const [selectedBagForQrLabel, setSelectedBagForQrLabel] = useState<BulkBag | null>(null);

  // Manual search fallback input
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [recentAudits, setRecentAudits] = useState<AuditRecordItem[]>([]);
  const [notificationBanner, setNotificationBanner] = useState<{
    text: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  const showNotification = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setNotificationBanner({ text, type });
    setTimeout(() => setNotificationBanner(null), 4000);
  };

  // -------------------------------------------------------------
  // Camera LifeCycle Management
  // -------------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        isRTL
          ? 'واجهة الكاميرا غير مدعومة في هذا المتصفح أو بيئة العرض، يمكنك استخدام المسح اليدوي أو رفع صورة QR.'
          : 'Camera API not supported in this browser or container environment. Use manual input or image upload.'
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
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

        // Check torch support
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities?.() || {}) as unknown as { torch?: boolean };
          setIsTorchSupported(Boolean(capabilities.torch));
        }
      }
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
        setCameraError(
          isRTL
            ? 'تم رفض إذن الوصول للكاميرا. يرجى تفعيل إذن الكاميرا بالمتصفح أو استخدام خيار المسح التجريبي أدناه.'
            : 'Camera permission was denied. Please allow camera access or use the manual test scanner.'
        );
      } else {
        setCameraError(
          isRTL
            ? 'تعذر تشغيل كاميرا الجهاز (قد تكون مشغولة بتطبيق آخر أو غير متصلة). يمكنك تجربة رفع صورة QR أو الإدخال اليدوي.'
            : 'Unable to activate device camera. You can upload a QR image or enter bag ID manually.'
        );
      }
      setIsCameraActive(false);
    }
  }, [facingMode, isRTL, stopCamera]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as unknown as { applyConstraints: (c: any) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch control error:', err);
    }
  };

  // Flip Camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Auto-start camera when component mounts or facing mode changes
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode, startCamera, stopCamera]);

  // -------------------------------------------------------------
  // QR Detection Loop (RequestAnimationFrame)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isCameraActive) return;

    let isScanning = true;
    let lastScanTimestamp = 0;

    const tick = async () => {
      if (!isScanning) return;

      const now = Date.now();
      // Throttle scanning to ~10-12 fps for optimal battery and smooth UI
      if (now - lastScanTimestamp > 90 && videoRef.current && !isProcessingScan) {
        lastScanTimestamp = now;
        const scannedCode = await detectQrCodeFromVideo(videoRef.current);
        if (scannedCode && scannedCode !== lastScannedRaw) {
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
  }, [isCameraActive, isProcessingScan, lastScannedRaw]);

  // -------------------------------------------------------------
  // Real-Time Cross-Referencing Logic
  // -------------------------------------------------------------
  const handleScannedCode = useCallback(
    (codeText: string) => {
      setIsProcessingScan(true);
      setLastScannedRaw(codeText);

      const parsed = parseScannedQrData(codeText);
      setParsedScan(parsed);

      // 1. If it's a Location Label (LOC-XXXX)
      if (parsed.type === 'LOCATION' && parsed.locationCode) {
        const foundLoc = locations.find(
          (l) => l.code.toUpperCase() === parsed.locationCode?.toUpperCase() || l.id === parsed.locationCode
        );
        if (foundLoc) {
          setSelectedWarehouseId(foundLoc.warehouseId);
          setSelectedLocationId(foundLoc.id);
          if (soundEnabled) playLocationChime();
          showNotification(
            isRTL
              ? `تم مسح وتثبيت موقع التدقيق الميداني الحالي: ${foundLoc.warehouseNameAr} - ${foundLoc.code} (${(foundLoc?.nameAr || foundLoc?.code || "")})`
              : `Auditing location set to: ${foundLoc.warehouseNameEn} - ${foundLoc.code}`,
            'info'
          );
        } else {
          showNotification(
            isRTL
              ? `تم مسح كود موقع (${parsed.locationCode}) لكنه غير معرف بدليل المستودعات الحالي.`
              : `Scanned location code (${parsed.locationCode}) not found in master records.`,
            'warning'
          );
        }
        setTimeout(() => setIsProcessingScan(false), 800);
        return;
      }

      // 2. Search digital inventory records for bulk bag
      const targetBagId = (parsed.bagId || parsed.rawText).toUpperCase().trim();

      const bagInDb = bulkBags.find((b) => {
        const idMatch = b.id?.toUpperCase() === targetBagId;
        const numMatch = b.bagNumber?.toUpperCase() === targetBagId;
        const aliasMatch = b.bagId?.toUpperCase() === targetBagId;
        const qrMatch = b.qrPayload && b.qrPayload.includes(targetBagId);
        return idMatch || numMatch || aliasMatch || qrMatch;
      });

      const nowIso = new Date().toISOString();
      const timeString = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

      if (bagInDb) {
        setMatchedBag(bagInDb);

        // Check Location Match
        const bagLocCode = (bagInDb.locationCode || '').toUpperCase();
        const activeLocCode = (activePhysicalLocation.code || '').toUpperCase();
        const isLocMatch =
          bagLocCode === activeLocCode ||
          bagInDb.locationId === activePhysicalLocation.id ||
          bagLocCode.replace(/-/g, '') === activeLocCode.replace(/-/g, '');

        if (!isLocMatch) {
          // MISPLACED BAG
          setVerificationVerdict('MISPLACED');
          if (soundEnabled) playAlertChime();

          const auditItem: AuditRecordItem = {
            id: `VERIF-${Date.now()}`,
            timestamp: timeString,
            bagId: bagInDb.bagNumber || bagInDb.id,
            materialName: bagInDb.materialName,
            weightKG: bagInDb.weightKG,
            digitalLocationCode: bagInDb.locationCode,
            physicalLocationCode: activePhysicalLocation.code,
            status: 'MISPLACED',
            actionTaken: isRTL ? 'رصد انحراف مكاني (موقع غير مطابق)' : 'Location mismatch detected',
            auditorName: (currentUser?.nameAr || currentUser?.name || "المشرف"),
          };
          setRecentAudits((prev) => [auditItem, ...prev.slice(0, 49)]);
        } else if (
          bagInDb.status === 'CONSUMED' ||
          bagInDb.status === 'IN_THERM' ||
          bagInDb.status === 'IN_SHREDDING'
        ) {
          // STATUS CONFLICT
          setVerificationVerdict('STATUS_CONFLICT');
          if (soundEnabled) playAlertChime();

          const auditItem: AuditRecordItem = {
            id: `VERIF-${Date.now()}`,
            timestamp: timeString,
            bagId: bagInDb.bagNumber || bagInDb.id,
            materialName: bagInDb.materialName,
            weightKG: bagInDb.weightKG,
            digitalLocationCode: bagInDb.locationCode,
            physicalLocationCode: activePhysicalLocation.code,
            status: 'STATUS_CONFLICT',
            actionTaken: isRTL ? `تعارض حالة: مقيد بالسجل كـ (${bagInDb.status})` : `Status conflict: ${bagInDb.status}`,
            auditorName: (currentUser?.nameAr || currentUser?.name || "المشرف"),
          };
          setRecentAudits((prev) => [auditItem, ...prev.slice(0, 49)]);
        } else {
          // PERFECT MATCH
          setVerificationVerdict('MATCH');
          if (soundEnabled) playSuccessChime();

          // Automatically record verified timestamp in bulk bag
          updateBulkBag(bagInDb.id, {
            lastVerifiedAt: nowIso,
            lastVerifiedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
            lastVerifiedLocationCode: activePhysicalLocation.code,
            verificationStatus: 'VERIFIED_IN_PLACE',
          });

          const auditItem: AuditRecordItem = {
            id: `VERIF-${Date.now()}`,
            timestamp: timeString,
            bagId: bagInDb.bagNumber || bagInDb.id,
            materialName: bagInDb.materialName,
            weightKG: bagInDb.weightKG,
            digitalLocationCode: bagInDb.locationCode,
            physicalLocationCode: activePhysicalLocation.code,
            status: 'MATCH',
            actionTaken: isRTL ? 'مطابقة مؤكدة في الموقع' : 'Verified in-place',
            auditorName: (currentUser?.nameAr || currentUser?.name || "المشرف"),
          };
          setRecentAudits((prev) => [auditItem, ...prev.slice(0, 49)]);
        }
      } else {
        // UNREGISTERED / GHOST BAG
        setMatchedBag(null);
        setVerificationVerdict('UNREGISTERED');
        if (soundEnabled) playAlertChime();

        const auditItem: AuditRecordItem = {
          id: `VERIF-${Date.now()}`,
          timestamp: timeString,
          bagId: targetBagId,
          materialName: parsed.materialName || (isRTL ? 'صنف غير معرف' : 'Unregistered material'),
          weightKG: parsed.weightKG || 0,
          digitalLocationCode: '---',
          physicalLocationCode: activePhysicalLocation.code,
          status: 'UNREGISTERED',
          actionTaken: isRTL ? 'شليف غير مسجل بالسجل الرقمي' : 'Unregistered bag QR',
          auditorName: (currentUser?.nameAr || currentUser?.name || "المشرف"),
        };
        setRecentAudits((prev) => [auditItem, ...prev.slice(0, 49)]);
      }

      // If continuous mode, allow re-scanning after delay
      const delay = continuousScan ? 1400 : 800;
      setTimeout(() => {
        setIsProcessingScan(false);
      }, delay);
    },
    [
      activePhysicalLocation,
      bulkBags,
      continuousScan,
      (currentUser?.nameAr || currentUser?.name || "المشرف"),
      isRTL,
      locations,
      soundEnabled,
      updateBulkBag,
    ]
  );

  // -------------------------------------------------------------
  // Real-Time Reconciliation Action: Correct Digital Location
  // -------------------------------------------------------------
  const handleRelocateBagToCurrentLocation = () => {
    if (!matchedBag) return;

    const oldLocCode = matchedBag.locationCode;
    const newLoc = activePhysicalLocation;

    updateBulkBag(matchedBag.id, {
      warehouseId: newLoc.warehouseId,
      warehouseName: newLoc.warehouseNameAr,
      locationId: newLoc.id,
      locationCode: newLoc.code,
      lastVerifiedAt: new Date().toISOString(),
      lastVerifiedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      lastVerifiedLocationCode: newLoc.code,
      verificationStatus: 'RELOCATED',
      status: 'AVAILABLE',
    });

    logAudit(
      'Bulk Bag Relocated via VirtualStockVerifier',
      `تصحيح الموقع الميداني للشليف ${matchedBag.bagNumber || matchedBag.id} ونقله من (${oldLocCode}) إلى الموقع الفعلي المرصود (${newLoc.code})`,
      'BulkBag',
      matchedBag.bagNumber || matchedBag.id,
      oldLocCode,
      newLoc.code,
      `المشرف الفاحص: ${(currentUser?.nameAr || currentUser?.name || "المشرف")} | تم التحديث الميداني اللحظي بنجاح`
    );

    // Update current display state to MATCH
    setVerificationVerdict('MATCH');
    setMatchedBag((prev) =>
      prev
        ? {
            ...prev,
            locationId: newLoc.id,
            locationCode: newLoc.code,
            warehouseId: newLoc.warehouseId,
            warehouseName: newLoc.warehouseNameAr,
            status: 'AVAILABLE',
          }
        : null
    );

    if (soundEnabled) playSuccessChime();
    showNotification(
      isRTL
        ? `تم تحديث الموقع الرقمي للشليف (${matchedBag.bagNumber || matchedBag.id}) وتثبيته في ${newLoc.code} بنجاح!`
        : `Bag location updated to ${newLoc.code} successfully!`,
      'success'
    );
  };

  // -------------------------------------------------------------
  // Register Unregistered Bag in 1-Click
  // -------------------------------------------------------------
  const handleRegisterScannedGhostBag = () => {
    if (!parsedScan) return;

    const newBagNum = parsedScan.bagId || `BAG-FLOOR-${Date.now().toString().slice(-4)}`;
    const matchedMat =
      materials.find(
        (m) =>
          (parsedScan.materialCode && m.code === parsedScan.materialCode) ||
          (parsedScan.materialName && m?.nameAr && m.nameAr.includes(parsedScan.materialName))
      ) || materials[0];

    const result = registerBulkBag({
      bagNumber: newBagNum,
      bagId: newBagNum,
      materialId: matchedMat.id,
      materialCode: matchedMat.code,
      materialName: parsedScan.materialName || (matchedMat?.nameAr || matchedMat?.nameEn || "خام"),
      weightKG: parsedScan.weightKG || 1000,
      warehouseId: activePhysicalLocation.warehouseId,
      warehouseName: activePhysicalLocation.warehouseNameAr,
      locationId: activePhysicalLocation.id,
      locationCode: activePhysicalLocation.code,
      status: 'AVAILABLE',
      notes: `تم قيده عبر مُحقق المخزون الافتراضي VirtualStockVerifier برصيف ${activePhysicalLocation.code}`,
      verificationStatus: 'VERIFIED_IN_PLACE',
      lastVerifiedAt: new Date().toISOString(),
      lastVerifiedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      lastVerifiedLocationCode: activePhysicalLocation.code,
    });

    if (result.success) {
      if (soundEnabled) playSuccessChime();
      setVerificationVerdict('MATCH');
      showNotification(
        isRTL
          ? `تم تسجيل الشليف (${newBagNum}) وربطه بالموقع الفعلي ${activePhysicalLocation.code} بنجاح!`
          : `Bag ${newBagNum} registered into digital inventory!`,
        'success'
      );
    }
  };

  // -------------------------------------------------------------
  // Manual & Image File Handlers
  // -------------------------------------------------------------
  const handleManualSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleScannedCode(manualCodeInput.trim());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const detected = await detectQrFromImageFile(file);
    if (detected) {
      handleScannedCode(detected);
    } else {
      showNotification(
        isRTL
          ? 'لم يتم التعرف على رمز QR واضح في الصورة المرفوعة. يرجى اختيار صورة واضحة ومتباينة.'
          : 'No clear QR code detected in image file.',
        'warning'
      );
    }
    e.target.value = '';
  };

  // Quick Preset Simulator: Pick any real bag from database for 1-click test scan
  const handleSelectSimulatedBag = (bag: BulkBag) => {
    const payload =
      bag.qrPayload ||
      JSON.stringify({
        factory: 'AL-KARWAN',
        bag_id: bag.bagNumber || bag.id,
        mat: bag.materialName,
        net_kg: bag.weightKG,
        loc: bag.locationCode,
      });
    handleScannedCode(payload);
  };

  // Export Session Report
  const exportSessionReportToCSV = () => {
    if (recentAudits.length === 0) {
      showNotification(isRTL ? 'لا توجد سجلات تدقيق لتصديرها حالياً.' : 'No audit records to export.', 'warning');
      return;
    }

    const headers = [
      'Timestamp',
      'Bag ID',
      'Material',
      'Weight KG',
      'Digital Location',
      'Physical Scanned Location',
      'Audit Result',
      'Action Taken',
      'Auditor',
    ];

    const rows = recentAudits.map((a) => [
      a.timestamp,
      a.bagId,
      `"${a.materialName.replace(/"/g, '""')}"`,
      a.weightKG,
      a.digitalLocationCode,
      a.physicalLocationCode,
      a.status,
      `"${a.actionTaken || ''}"`,
      `"${a.auditorName}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VirtualStockAudit_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification(isRTL ? 'تم تصدير تقرير التدقيق الميداني بنجاح!' : 'Audit report exported to CSV.', 'success');
  };

  // Aggregate Metrics for this round
  const sessionTotalScanned = recentAudits.length;
  const sessionMatches = recentAudits.filter((a) => a.status === 'MATCH').length;
  const sessionMisplaced = recentAudits.filter((a) => a.status === 'MISPLACED').length;
  const sessionWeightVerified = recentAudits
    .filter((a) => a.status === 'MATCH')
    .reduce((sum, a) => sum + (a.weightKG || 0), 0);

  return (
    <div className="space-y-6 pb-12 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ------------------------------------------------------------- */}
      {/* Header & Controls Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 rounded-2xl bg-[#0f1117] border border-cyan-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-inner">
            <Scan className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-wide">
                {isRTL ? 'مُحقق المخزون الافتراضي' : 'VirtualStockVerifier'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Camera QR Floor Auditor
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'فحص ومسح الباركود ورمز QR للشلايف بكاميرا الهاتف/الجهاز ومطابقة موقعها الفعلي مع السجل الرقمي لحظياً'
                : 'Real-time bulk bag QR camera verification and digital location cross-referencing'}
            </p>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center flex-wrap gap-2 relative z-10">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
            title={isRTL ? 'تفعيل/كتم أصوات التنبيه' : 'Toggle Audio Feedback'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{isRTL ? (soundEnabled ? 'صوت مفعل' : 'صامت') : soundEnabled ? 'Audio On' : 'Muted'}</span>
          </button>

          {/* Continuous Mode Toggle */}
          <button
            onClick={() => setContinuousScan((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              continuousScan
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
            title={isRTL ? 'المسح المتواصل السريع للشلايف المتتالية' : 'Toggle Continuous Scanning Mode'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${continuousScan ? 'animate-spin' : ''}`} />
            <span>{isRTL ? (continuousScan ? 'المسح المتواصل: نشط' : 'مسح متواصل') : continuousScan ? 'Continuous: ON' : 'Continuous Mode'}</span>
          </button>

          {/* Jump to Bulk Bags Manager */}
          <button
            onClick={() => setCurrentPage('bulk_bags')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'إدارة الشلايف' : 'Bulk Bags List'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notificationBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 animate-slide-down ${
            notificationBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : notificationBanner.type === 'warning'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notificationBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{notificationBanner.text}</span>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Physical Audit Location Selector (The Ground Truth) */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/30 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-cyan-400/90 font-mono font-bold uppercase tracking-wider">
                {isRTL ? 'الموقع الفعلي الميداني للتدقيق (Ground Truth Location)' : 'Physical Inspection Location'}
              </p>
              <h2 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                <span>{activePhysicalLocation.warehouseNameAr}</span>
                <span className="text-slate-500">/</span>
                <span className="font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                  {activePhysicalLocation.code}
                </span>
                <span className="text-xs text-slate-300 font-normal">({(activePhysicalLocation?.nameAr || activePhysicalLocation?.nameEn || "")})</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Warehouse Select */}
            <select
              value={selectedWarehouseId}
              onChange={(e) => {
                const whId = e.target.value;
                setSelectedWarehouseId(whId);
                const firstLocInWh = locations.find((l) => l.warehouseId === whId);
                if (firstLocInWh) setSelectedLocationId(firstLocInWh.id);
              }}
              className="bg-slate-800 border border-slate-700 text-white rounded-xl text-xs px-3 py-2 outline-none focus:border-cyan-500"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh?.nameAr || wh?.nameEn || wh?.code} ({wh.code})
                </option>
              ))}
            </select>

            {/* Location Select */}
            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono font-bold rounded-xl text-xs px-3 py-2 outline-none focus:border-cyan-400"
            >
              {filteredLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} - {loc?.nameAr || loc?.nameEn || ""}
                </option>
              ))}
            </select>

            {/* Quick Helper */}
            <div className="text-[11px] text-slate-400 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{(currentUser?.nameAr || currentUser?.name || "المشرف")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Main Grid: Camera Viewport + Verification Verdict HUD */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / TOP: Camera Video Viewport (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] aspect-video sm:aspect-[4/3] flex items-center justify-center">
            {/* HTML5 Video Element */}
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />

            {/* Tactical Camera HUD Overlay */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
                {/* Top Overlay Badges */}
                <div className="flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-emerald-500/40 text-[10px] text-emerald-400 font-mono font-bold shadow-lg">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      LIVE FEED
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 text-[10px] text-cyan-300 font-mono">
                      {facingMode === 'environment' ? (isRTL ? 'الكاميرا الخلفية' : 'Back Camera') : (isRTL ? 'الكاميرا الأمامية' : 'Front Camera')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pointer-events-auto">
                    {/* Torch Toggle if supported */}
                    {isTorchSupported && (
                      <button
                        onClick={toggleTorch}
                        className={`p-2 rounded-xl backdrop-blur-md border text-xs transition-all cursor-pointer ${
                          isTorchOn
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                            : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
                        }`}
                        title={isRTL ? 'إضاءة الفلاش الميداني' : 'Toggle Flashlight'}
                      >
                        <Flashlight className="w-4 h-4" />
                      </button>
                    )}

                    {/* Flip Camera */}
                    <button
                      onClick={toggleFacingMode}
                      className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white text-xs transition-colors cursor-pointer"
                      title={isRTL ? 'تبديل الكاميرا' : 'Switch Camera'}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Center Targeting Box (Viewfinder) */}
                <div className="relative mx-auto my-auto w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                  {/* Viewfinder Corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-lg" />

                  {/* Laser Scanning Animation Line */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee] animate-pulse transform translate-y-[-50%]" />

                  {/* Inner Target Crosshair */}
                  <div className="w-12 h-12 border border-cyan-500/30 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-400/80" />
                  </div>

                  <p className="absolute -bottom-8 text-[11px] text-cyan-200 font-mono tracking-wider bg-slate-900/80 px-2.5 py-0.5 rounded-full backdrop-blur-md border border-cyan-500/30">
                    {isRTL ? 'وجّه الكاميرا نحو باركود الشليف' : 'Align QR inside reticle'}
                  </p>
                </div>

                {/* Bottom Overlay Status Bar */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    {isRTL ? 'موقع الفحص:' : 'Location:'} {activePhysicalLocation.code}
                  </span>
                  <span className="text-cyan-400">
                    {isProcessingScan ? (isRTL ? 'جاري التحليل والربط...' : 'Analyzing QR...') : (isRTL ? 'جاهز للمسح' : 'Ready')}
                  </span>
                </div>
              </div>
            )}

            {/* Error or Inactive State */}
            {!isCameraActive && (
              <div className="p-6 text-center max-w-md space-y-4 z-10">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <CameraOff className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'الكاميرا غير مفعلة حالياً' : 'Camera Feed Not Active'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {cameraError ||
                      (isRTL
                        ? 'يرجى تشغيل الكاميرا لبدء مسح باركود الشلايف الميداني، أو استخدام البدائل أدناه.'
                        : 'Please start camera to scan bulk bag floor labels.')}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isRTL ? 'إعادة تشغيل الكاميرا' : 'Start Camera'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Input Bar: Manual Code Input + File Upload + Preset Simulator */}
          <div className="p-4 rounded-2xl bg-[#11131a] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                {isRTL ? 'طرق إدخال بديلة ومحاكاة ميدانية' : 'Alternative Inputs & Floor Simulation'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Camera / Laser / Photo / Search</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Manual Code Input Form (8 cols) */}
              <form onSubmit={handleManualSearchSubmit} className="sm:col-span-8 flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder={isRTL ? 'أدخل كود الشليف (مثال: SHL-000001 أو BAG-2026-001)...' : 'Enter Bag ID (e.g. SHL-000001)...'}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl text-xs px-3 py-2 pr-9 font-mono text-white placeholder-slate-500 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer"
                >
                  {isRTL ? 'تحقق' : 'Verify'}
                </button>
              </form>

              {/* Photo QR File Upload (4 cols) */}
              <label className="sm:col-span-4 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors text-center">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'رفع صورة QR' : 'Upload QR Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Preset Test Bag Selector: Simulates real bags in warehouse */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">
                {isRTL ? 'شلايف تجريبية بالمخزن للمحاكاة الفورية:' : 'Sample Floor Bags:'}
              </span>
              {bulkBags.slice(0, 5).map((bag) => (
                <button
                  key={bag.id}
                  onClick={() => handleSelectSimulatedBag(bag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1"
                >
                  <QrCode className="w-3 h-3 text-cyan-400" />
                  <span>{bag.bagNumber || bag.id}</span>
                  <span className="text-[9px] text-slate-500">({bag.locationCode})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Real-Time Cross-Reference Verdict HUD (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Verdict Card */}
          <div
            className={`p-5 rounded-2xl border transition-all shadow-xl ${
              verificationVerdict === 'MATCH'
                ? 'bg-[#0b1b15] border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                : verificationVerdict === 'MISPLACED'
                ? 'bg-[#231709] border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.2)]'
                : verificationVerdict === 'STATUS_CONFLICT'
                ? 'bg-[#220d18] border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.2)]'
                : verificationVerdict === 'UNREGISTERED'
                ? 'bg-[#181525] border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.2)]'
                : 'bg-[#11131a] border-slate-800'
            }`}
          >
            {/* Header Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {isRTL ? 'تقرير المطابقة اللحظي (Real-Time Verdict)' : 'Cross-Reference Result'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {new Date().toLocaleTimeString('ar-IQ')}
              </span>
            </div>

            {/* Verdict Body */}
            {verificationVerdict ? (
              <div className="mt-4 space-y-4">
                {/* Status Hero Banner */}
                {verificationVerdict === 'MATCH' && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-300">
                        {isRTL ? 'مطابقة تامة ومؤكدة للموقع (Verified In-Place)' : 'Verified In-Place - Location Match'}
                      </h3>
                      <p className="text-xs text-emerald-400/80 mt-0.5">
                        {isRTL
                          ? 'الشليف متواجد في موقعه النظامي الصحيح تماماً ومطابق لقيد المخزن الرقمي.'
                          : 'Bulk bag physical location matches digital inventory record.'}
                      </p>
                    </div>
                  </div>
                )}

                {verificationVerdict === 'MISPLACED' && (
                  <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/25 text-amber-400 shrink-0 mt-0.5">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-300">
                        {isRTL ? 'انحراف مكاني: الشليف في غير موقعه!' : 'Location Discrepancy (Misplaced Bag)'}
                      </h3>
                      <p className="text-xs text-amber-300/80 mt-0.5">
                        {isRTL
                          ? 'الشليف مسجل رقمياً في موقع مختلف عن الموقع الذي تم فحصه فيه الآن ميدانياً.'
                          : 'Bag is digitally assigned to another location in the warehouse.'}
                      </p>
                    </div>
                  </div>
                )}

                {verificationVerdict === 'STATUS_CONFLICT' && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/25 text-rose-400 shrink-0 mt-0.5">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-rose-300">
                        {isRTL ? 'تعارض بحالة الشليف (Status Conflict)' : 'Status Conflict Detected'}
                      </h3>
                      <p className="text-xs text-rose-300/80 mt-0.5">
                        {isRTL
                          ? `الشليف مقيد في النظام كـ (${matchedBag?.status}) ولكنه متواجد فعلياً بأرفف التخزين.`
                          : `Bag marked as ${matchedBag?.status} digitally but found in storage.`}
                      </p>
                    </div>
                  </div>
                )}

                {verificationVerdict === 'UNREGISTERED' && (
                  <div className="p-3.5 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/25 text-purple-400 shrink-0 mt-0.5">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-purple-300">
                        {isRTL ? 'شليف غير مسجل بالسجل الرقمي (Ghost Bag)' : 'Unregistered Bulk Bag'}
                      </h3>
                      <p className="text-xs text-purple-300/80 mt-0.5">
                        {isRTL
                          ? 'رمز الباركود مقروء لكن كود الشليف غير موجود في قاعدة بيانات الشلايف الحالية.'
                          : 'QR scanned successfully but bag ID is not yet in digital ledger.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Location Cross-Reference Comparison Matrix */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-black/40 border border-white/10">
                  {/* Digital Recorded Location */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {isRTL ? 'الموقع بالسجل الرقمي' : 'Digital Record'}
                    </span>
                    <div className="font-mono text-sm font-bold text-cyan-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{matchedBag?.locationCode || (isRTL ? 'غير مقيد' : 'Unregistered')}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {matchedBag?.warehouseName || (isRTL ? 'لا يوجد سجل' : 'No record')}
                    </p>
                  </div>

                  {/* Physical Audited Location */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {isRTL ? 'الموقع الفعلي المرصود' : 'Physical Scanned'}
                    </span>
                    <div className="font-mono text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{activePhysicalLocation.code}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {activePhysicalLocation.warehouseNameAr}
                    </p>
                  </div>
                </div>

                {/* Bag Specification Details */}
                {matchedBag ? (
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="font-mono font-bold text-white text-sm">
                        {matchedBag.bagNumber || matchedBag.id}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {matchedBag.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'الصنف:' : 'Material:'}</span>
                        <span className="text-slate-200 font-bold">{matchedBag.materialName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'الوزن المسجل:' : 'Net Weight:'}</span>
                        <span className="font-mono font-bold text-cyan-300">
                          {(matchedBag.weightKG ?? 0).toLocaleString()} KG
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'كود الصنف:' : 'Code:'}</span>
                        <span className="font-mono text-slate-300">{matchedBag.materialCode}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'رقم المستند / الإرسالية:' : 'Doc Ref:'}</span>
                        <span className="font-mono text-slate-300">
                          {matchedBag.legacyDocumentNumber || matchedBag.transactionNumber || '---'}
                        </span>
                      </div>
                    </div>

                    {matchedBag.lastVerifiedAt && (
                      <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>{isRTL ? 'آخر تدقيق معتمد:' : 'Last verified:'}</span>
                        <span className="font-mono text-emerald-400">
                          {new Date(matchedBag.lastVerifiedAt).toLocaleDateString('ar-IQ')} ({matchedBag.lastVerifiedBy})
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  parsedScan && (
                    <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5 text-xs font-mono">
                      <span className="text-[10px] text-purple-300 uppercase block font-bold">
                        {isRTL ? 'بيانات الباركود الخام المستخرجة:' : 'Extracted QR Data:'}
                      </span>
                      <div className="text-slate-300 text-[11px] truncate">
                        ID: <span className="text-purple-300 font-bold">{parsedScan.bagId || parsedScan.rawText}</span>
                      </div>
                      {parsedScan.materialName && (
                        <div className="text-slate-300 text-[11px]">
                          Mat: <span className="text-slate-200">{parsedScan.materialName}</span>
                        </div>
                      )}
                      {parsedScan.weightKG && (
                        <div className="text-slate-300 text-[11px]">
                          Weight: <span className="text-cyan-300">{parsedScan.weightKG} KG</span>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Contextual Action Buttons */}
                <div className="space-y-2 pt-1">
                  {verificationVerdict === 'MISPLACED' && (
                    <button
                      onClick={handleRelocateBagToCurrentLocation}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950 transition-all cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>
                        {isRTL
                          ? `تصحيح ونقل الشليف إلى هذا الموقع (${activePhysicalLocation.code})`
                          : `Update Bag Location to ${activePhysicalLocation.code}`}
                      </span>
                    </button>
                  )}

                  {verificationVerdict === 'UNREGISTERED' && (
                    <button
                      onClick={handleRegisterScannedGhostBag}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-950 transition-all cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      <span>{isRTL ? 'تسجيل الشليف في المخزن الرقمي فوراً' : 'Register Bag into Digital Inventory'}</span>
                    </button>
                  )}

                  {matchedBag && (
                    <button
                      onClick={() => setSelectedBagForQrLabel(matchedBag)}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isRTL ? 'عرض وطباعة بطاقة الشليف المعيارية (Label)' : 'Print Floor Thermal Label'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Awaiting Scan Placeholder */
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Scan className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isRTL ? 'بانتظار مسح رمز الشليف...' : 'Awaiting Bulk Bag QR Scan...'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {isRTL
                      ? 'وجّه كاميرا الجهاز نحو بطاقة الشليف أو استخدم شريط الإدخال والباركود للبدء في المطابقة الفورية.'
                      : 'Scan any bag QR code with camera to cross-reference location in real-time.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Session Round Stats */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-xl bg-[#11131a] border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                {isRTL ? 'إجمالي المفحوص بالجولة' : 'Total Scanned'}
              </span>
              <p className="text-xl font-mono font-bold text-white mt-1">{sessionTotalScanned}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#11131a] border border-emerald-500/20">
              <span className="text-[10px] text-emerald-400 uppercase font-mono">
                {isRTL ? 'مطابق بالموقع' : 'Matches In-Place'}
              </span>
              <p className="text-xl font-mono font-bold text-emerald-400 mt-1">{sessionMatches}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#11131a] border border-amber-500/20">
              <span className="text-[10px] text-amber-400 uppercase font-mono">
                {isRTL ? 'انحراف مكاني تم رصده' : 'Misplaced Discovered'}
              </span>
              <p className="text-xl font-mono font-bold text-amber-400 mt-1">{sessionMisplaced}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#11131a] border border-cyan-500/20">
              <span className="text-[10px] text-cyan-400 uppercase font-mono">
                {isRTL ? 'إجمالي الوزن المدقق' : 'Verified Weight'}
              </span>
              <p className="text-xl font-mono font-bold text-cyan-300 mt-1">
                {(sessionWeightVerified ?? 0).toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-400">KG</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Real-Time Session Audit Ledger Table */}
      {/* ------------------------------------------------------------- */}
      <div className="p-5 rounded-2xl bg-[#0f1117] border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <History className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'سجل الجولة التفتيشية اللحظية (Active Audit Round Ledger)' : 'Live Inspection Round Ledger'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'توثيق تاريخي زمني فوري لكل شليف تم فحصه أثناء هذه الجولة'
                  : 'Chronological feed of all verified bulk bags during current floor walk'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportSessionReportToCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isRTL ? 'تصدير التقرير (CSV)' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {recentAudits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-3 text-start">{isRTL ? 'الوقت' : 'Time'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'كود الشليف' : 'Bag ID'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'الصنف' : 'Material'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'الوزن' : 'Weight'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'الموقع بالسجل' : 'Digital Loc'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'الموقع الفعلي' : 'Physical Loc'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'نتيجة الفحص' : 'Verdict'}</th>
                  <th className="pb-3 text-start">{isRTL ? 'الإجراء المتخذ' : 'Action Taken'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentAudits.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 text-slate-400">{item.timestamp}</td>
                    <td className="py-2.5 font-bold text-white">{item.bagId}</td>
                    <td className="py-2.5 text-slate-300 font-sans">{item.materialName}</td>
                    <td className="py-2.5 text-cyan-300 font-bold">{(item.weightKG ?? 0).toLocaleString()} KG</td>
                    <td className="py-2.5 text-slate-400">{item.digitalLocationCode}</td>
                    <td className="py-2.5 text-emerald-400 font-bold">{item.physicalLocationCode}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          item.status === 'MATCH'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : item.status === 'MISPLACED'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : item.status === 'STATUS_CONFLICT'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-300 font-sans text-[11px]">{item.actionTaken}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs font-mono">
            {isRTL
              ? 'لم يتم تسجيل أي عمليات فحص في هذه الجولة بعد. ابدأ بمسح الشلايف أعلاه.'
              : 'No bags scanned in this audit session yet. Start scanning above.'}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Modal: Standard Floor Label Printer */}
      {/* ------------------------------------------------------------- */}
      {selectedBagForQrLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedBagForQrLabel(null)}
              className="absolute top-4 left-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <BulkBagQrGenerator
              bag_id={selectedBagForQrLabel.bagNumber || selectedBagForQrLabel.id}
              material_name={selectedBagForQrLabel.materialName}
              material_code={selectedBagForQrLabel.materialCode}
              weight_kg={selectedBagForQrLabel.weightKG}
              transaction_number={selectedBagForQrLabel.transactionNumber || 'TX-VERIF'}
              location_code={selectedBagForQrLabel.locationCode}
              onClose={() => setSelectedBagForQrLabel(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
