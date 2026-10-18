import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  QrCode,
  Printer,
  Download,
  X,
  RefreshCw,
  Boxes,
  Flame,
  CheckCircle2,
  Copy,
  Check,
  Building2,
  Calendar,
  Clock,
  User,
  MapPin,
  Scale,
  Layers,
  FileSpreadsheet,
  FileText,
  Sliders,
  Sparkles,
  Barcode,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { MaterialItem } from '../types';
import {
  FloorQrLabelData,
  buildQrPayload,
  generateQrCodeDataUrl,
  generateFactoryBatchId,
  QrFormatMode,
} from '../services/qrLabelService';

interface MaterialQrLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMaterial?: MaterialItem | null;
}

type BatchSourceMode = 'AUTO_LOT' | 'LINKED_RECEIVING' | 'LINKED_SHREDDING' | 'CUSTOM';
type LabelSize = 'THERMAL_100x75' | 'COMPACT_70x50' | 'A4_HANGING_TAG';

export const MaterialQrLabelModal: React.FC<MaterialQrLabelModalProps> = ({
  isOpen,
  onClose,
  initialMaterial,
}) => {
  const { isRTL, t } = useLanguage();
  const {
    materials,
    receivingTransactions,
    shreddingTransactions,
    warehouses,
    locations,
    currentUser,
  } = useFactory();

  // Selected Material
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    initialMaterial?.id || materials[0]?.id || ''
  );

  const selectedMaterial = useMemo(() => {
    return materials.find((m) => m.id === selectedMaterialId) || materials[0];
  }, [materials, selectedMaterialId]);

  // Batch ID & Source Mode
  const [batchMode, setBatchMode] = useState<BatchSourceMode>('AUTO_LOT');
  const [autoBatchId, setAutoBatchId] = useState<string>('');
  const [selectedReceivingId, setSelectedReceivingId] = useState<string>('');
  const [selectedShreddingId, setSelectedShreddingId] = useState<string>('');
  const [customBatchId, setCustomBatchId] = useState<string>('');

  // Bag Quantities & Specs
  const [totalBags, setTotalBags] = useState<number>(1);
  const [weightPerBagKG, setWeightPerBagKG] = useState<number>(500);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('WH-01');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('LOC-A01');
  const [shift, setShift] = useState<'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي'>('Morning / صباحي');
  const [productionDate, setProductionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [operatorName, setOperatorName] = useState<string>(
    currentUser?.nameAr || currentUser?.name || 'م. أحمد الشمري'
  );
  const [notes, setNotes] = useState<string>('');

  // Label configuration
  const [labelSize, setLabelSize] = useState<LabelSize>('THERMAL_100x75');
  const [qrFormat, setQrFormat] = useState<QrFormatMode>('JSON');
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'ALL_LABELS' | 'RAW_PAYLOAD'>('PREVIEW');
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // Generated QR code data URLs cache [bagIndex -> dataURL]
  const [qrDataUrls, setQrDataUrls] = useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Auto-generate initial batch ID whenever material changes
  useEffect(() => {
    if (selectedMaterial) {
      const newLot = generateFactoryBatchId(selectedMaterial.code);
      setAutoBatchId(newLot);
      if (selectedMaterial.defaultWarehouseId) {
        setSelectedWarehouseId(selectedMaterial.defaultWarehouseId);
      }
      if (selectedMaterial.defaultLocationId) {
        setSelectedLocationId(selectedMaterial.defaultLocationId);
      }
    }
  }, [selectedMaterial]);

  // Set initial material if changed via props
  useEffect(() => {
    if (initialMaterial) {
      setSelectedMaterialId(initialMaterial.id);
    }
  }, [initialMaterial]);

  // Find relevant receiving transactions for this material
  const relevantReceivings = useMemo(() => {
    if (!selectedMaterial) return [];
    return receivingTransactions.filter(
      (r) =>
        r.materialId === selectedMaterial.id ||
        r.materialCode === selectedMaterial.code ||
        r.materialName.includes(selectedMaterial.nameAr) ||
        r.materialName.includes(selectedMaterial.nameEn)
    );
  }, [selectedMaterial, receivingTransactions]);

  // Find relevant shredding transactions for this material
  const relevantShreddings = useMemo(() => {
    if (!selectedMaterial) return [];
    return shreddingTransactions.filter(
      (s) =>
        s.materialId === selectedMaterial.id ||
        s.materialCode === selectedMaterial.code ||
        s.materialName.includes(selectedMaterial.nameAr) ||
        s.materialName.includes(selectedMaterial.nameEn)
    );
  }, [selectedMaterial, shreddingTransactions]);

  // Determine active Batch ID string
  const activeBatchId = useMemo(() => {
    if (batchMode === 'AUTO_LOT') {
      return autoBatchId;
    }
    if (batchMode === 'LINKED_RECEIVING') {
      const rec = relevantReceivings.find((r) => r.id === selectedReceivingId);
      return rec ? `${rec.transactionNumber} (${rec.legacyDocumentNumber || '546'})` : 'RCV-BATCH';
    }
    if (batchMode === 'LINKED_SHREDDING') {
      const sh = relevantShreddings.find((s) => s.id === selectedShreddingId);
      return sh ? `${sh.shreddingNumber} (${sh.legacyDocumentNumber || '360'})` : 'THM-BATCH';
    }
    return customBatchId || 'CUSTOM-LOT-01';
  }, [
    batchMode,
    autoBatchId,
    selectedReceivingId,
    selectedShreddingId,
    customBatchId,
    relevantReceivings,
    relevantShreddings,
  ]);

  // Auto-sync bag count and weight when selecting linked receiving or shredding
  const handleSelectReceiving = (id: string) => {
    setSelectedReceivingId(id);
    const rec = relevantReceivings.find((r) => r.id === id);
    if (rec) {
      if (rec.bulkBagsCount && rec.bulkBagsCount > 0) {
        setTotalBags(rec.bulkBagsCount);
        if (rec.netReceivedWeightKG > 0) {
          setWeightPerBagKG(Math.round(rec.netReceivedWeightKG / rec.bulkBagsCount));
        }
      }
      if (rec.targetWarehouseId) setSelectedWarehouseId(rec.targetWarehouseId);
      if (rec.targetLocationId) setSelectedLocationId(rec.targetLocationId);
    }
  };

  const handleSelectShredding = (id: string) => {
    setSelectedShreddingId(id);
    const sh = relevantShreddings.find((s) => s.id === id);
    if (sh) {
      if (sh.bulkBagsOutput && sh.bulkBagsOutput > 0) {
        setTotalBags(sh.bulkBagsOutput);
        if (sh.outputKG > 0) {
          setWeightPerBagKG(Math.round(sh.outputKG / sh.bulkBagsOutput));
        }
      }
      if (sh.destinationWarehouseId) setSelectedWarehouseId(sh.destinationWarehouseId);
      if (sh.destinationLocationId) setSelectedLocationId(sh.destinationLocationId);
    }
  };

  // Build label dataset for each bag (1 to totalBags)
  const labelsData: FloorQrLabelData[] = useMemo(() => {
    if (!selectedMaterial) return [];
    const loc = locations.find((l) => l.id === selectedLocationId);
    const wh = warehouses.find((w) => w.id === selectedWarehouseId);

    const result: FloorQrLabelData[] = [];
    const count = Math.max(1, Math.min(100, totalBags));

    for (let i = 1; i <= count; i++) {
      result.push({
        materialId: selectedMaterial.id,
        materialCode: selectedMaterial.code,
        materialNameAr: selectedMaterial.nameAr,
        materialNameEn: selectedMaterial.nameEn,
        category: selectedMaterial.category,
        unit: selectedMaterial.unit || 'KG',
        batchId: activeBatchId,
        bagIndex: i,
        totalBags: count,
        weightPerBagKG: weightPerBagKG,
        warehouseId: selectedWarehouseId,
        warehouseNameAr: wh?.nameAr,
        locationId: selectedLocationId,
        locationCode: loc?.code || selectedLocationId,
        requiresShredding: selectedMaterial.requiresShredding,
        productionDate,
        shift,
        operatorName,
        notes,
      });
    }

    return result;
  }, [
    selectedMaterial,
    activeBatchId,
    totalBags,
    weightPerBagKG,
    selectedWarehouseId,
    selectedLocationId,
    productionDate,
    shift,
    operatorName,
    notes,
    locations,
    warehouses,
  ]);

  // Generate QR codes for all labels
  useEffect(() => {
    let isSubscribed = true;
    setIsGenerating(true);

    async function generateAllQrs() {
      const urls: Record<number, string> = {};
      for (const item of labelsData) {
        const payload = buildQrPayload(item, qrFormat);
        const url = await generateQrCodeDataUrl(payload, 300);
        urls[item.bagIndex] = url;
      }
      if (isSubscribed) {
        setQrDataUrls(urls);
        setIsGenerating(false);
      }
    }

    generateAllQrs();

    return () => {
      isSubscribed = false;
    };
  }, [labelsData, qrFormat]);

  if (!isOpen || !selectedMaterial) return null;

  // Active label preview
  const currentPreviewLabel =
    labelsData.find((l) => l.bagIndex === activePreviewIndex) || labelsData[0];
  const currentQrUrl = qrDataUrls[currentPreviewLabel.bagIndex] || '';

  // Scanned raw payload
  const currentRawPayload = buildQrPayload(currentPreviewLabel, qrFormat);

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(currentRawPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadActiveLabel = () => {
    if (!currentQrUrl) return;
    const link = document.createElement('a');
    link.download = `QR_${selectedMaterial.code}_${activeBatchId}_BAG_${currentPreviewLabel.bagIndex}.png`;
    link.href = currentQrUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-slate-900 border border-cyan-500/40 rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden text-start">
        {/* Modal Top Control Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/50">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  FLOOR TRACKING TAGS
                </span>
                <span className="text-xs text-slate-400">
                  {isRTL ? 'إدارة تتبع المواد والشلايف' : 'Batch & Material Tracking'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {isRTL
                  ? 'طباعة ملصقات QR الذكية لأرضية المصنع والمستودعات'
                  : 'Factory Floor Printable QR Code Labels'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
              title={isRTL ? 'طباعة الملصقات مباشرة' : 'Print Labels'}
            >
              <Printer className="w-4 h-4" />
              <span>{isRTL ? `طباعة الملصقات (${labelsData.length})` : `Print Labels (${labelsData.length})`}</span>
            </button>

            <button
              onClick={handleDownloadActiveLabel}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isRTL ? 'تحميل رمز QR الحالي كصورة' : 'Download QR Image'}
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Row & Material Switcher */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs shrink-0">
          {/* Material Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              {isRTL ? 'الصنف المختار من دليل المواد:' : 'Material from Master:'}
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-cyan-400"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.code}] {m.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Source Mode */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">
              {isRTL ? 'مصدر ونوع رقم الوجبة (Batch ID):' : 'Batch ID Source:'}
            </label>
            <select
              value={batchMode}
              onChange={(e) => setBatchMode(e.target.value as BatchSourceMode)}
              className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-xs outline-none focus:border-cyan-400"
            >
              <option value="AUTO_LOT">{isRTL ? '✨ توليد تلقائي لرقم تشغيلة أرضية' : '✨ Auto Floor Lot (LOT-*)'}</option>
              <option value="LINKED_RECEIVING">
                {isRTL
                  ? `📦 ربط بوجبة استلام قبان 546 (${relevantReceivings.length})`
                  : `📦 Linked Scale Receiving 546 (${relevantReceivings.length})`}
              </option>
              <option value="LINKED_SHREDDING">
                {isRTL
                  ? `🔥 ربط بوجبة ثرم وجرش 360 (${relevantShreddings.length})`
                  : `🔥 Linked Shredding 360 (${relevantShreddings.length})`}
              </option>
              <option value="CUSTOM">{isRTL ? '✍️ إدخال يدوي لرقم الوجبة' : '✍️ Custom Batch ID'}</option>
            </select>
          </div>

          {/* Dynamic Batch Input / Selector */}
          <div>
            {batchMode === 'AUTO_LOT' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-400">
                    {isRTL ? 'رقم التشغيلة المولد:' : 'Generated Lot ID:'}
                  </label>
                  <button
                    onClick={() => setAutoBatchId(generateFactoryBatchId(selectedMaterial.code))}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    title={isRTL ? 'توليد كود جديد' : 'Regenerate'}
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>{isRTL ? 'تجديد' : 'New'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={autoBatchId}
                  onChange={(e) => setAutoBatchId(e.target.value)}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold text-xs outline-none"
                />
              </div>
            )}

            {batchMode === 'LINKED_RECEIVING' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRTL ? 'اختر وجبة الاستلام (546):' : 'Select Receiving Batch:'}
                </label>
                {relevantReceivings.length > 0 ? (
                  <select
                    value={selectedReceivingId}
                    onChange={(e) => handleSelectReceiving(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs outline-none"
                  >
                    <option value="">{isRTL ? '-- اختر الوجبة المستلمة --' : '-- Select Batch --'}</option>
                    {relevantReceivings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.transactionNumber} (قبان {r.legacyDocumentNumber || '546'}) - {r.netReceivedWeightKG.toLocaleString()} KG ({r.bulkBagsCount} شليف) - {r.supplierName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-500 text-[11px]">
                    {isRTL ? 'لا توجد وجبات استلام مسجلة لهذا الصنف' : 'No receiving batches found'}
                  </div>
                )}
              </div>
            )}

            {batchMode === 'LINKED_SHREDDING' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRTL ? 'اختر وجبة الثرم (360):' : 'Select Shredding Batch:'}
                </label>
                {relevantShreddings.length > 0 ? (
                  <select
                    value={selectedShreddingId}
                    onChange={(e) => handleSelectShredding(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-xs outline-none"
                  >
                    <option value="">{isRTL ? '-- اختر وجبة الثرم --' : '-- Select Batch --'}</option>
                    {relevantShreddings.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shreddingNumber} (ثرم {s.legacyDocumentNumber || '360'}) - {s.outputKG.toLocaleString()} KG ({s.bulkBagsOutput} شليف)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-500 text-[11px]">
                    {isRTL ? 'لا توجد وجبات ثرم مسجلة لهذا الصنف' : 'No shredding batches found'}
                  </div>
                )}
              </div>
            )}

            {batchMode === 'CUSTOM' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRTL ? 'أدخل رقم الوجبة المخصص:' : 'Enter Custom Batch ID:'}
                </label>
                <input
                  type="text"
                  value={customBatchId}
                  onChange={(e) => setCustomBatchId(e.target.value)}
                  placeholder="LOT-2026-99"
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-cyan-400"
                />
              </div>
            )}
          </div>

          {/* Bag Count & Net Weight */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isRTL ? 'عدد الشلايف (الملصقات):' : 'Total Bags:'}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={totalBags}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setTotalBags(val);
                  if (activePreviewIndex > val) setActivePreviewIndex(1);
                }}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-black text-xs outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isRTL ? 'وزن الشليف (كغم):' : 'Weight/Bag KG:'}
              </label>
              <input
                type="number"
                min={1}
                value={weightPerBagKG}
                onChange={(e) => setWeightPerBagKG(Math.max(1, parseInt(e.target.value) || 500))}
                className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs outline-none"
              />
            </div>
          </div>
        </div>

        {/* Floor Specifics & Options Sub-bar */}
        <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center flex-wrap gap-3">
            {/* Warehouse & Location */}
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 font-bold">{isRTL ? 'الموقع:' : 'Location:'}</span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.nameAr}
                  </option>
                ))}
              </select>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} ({loc.nameAr})
                  </option>
                ))}
              </select>
            </div>

            {/* Shift */}
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 font-bold">{isRTL ? 'الوردية:' : 'Shift:'}</span>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs font-sans"
              >
                <option value="Morning / صباحي">صباحي (Morning)</option>
                <option value="Evening / مسائي">مسائي (Evening)</option>
                <option value="Night / ليلي">ليلي (Night)</option>
              </select>
            </div>

            {/* Label Size */}
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 font-bold">{isRTL ? 'حجم الملصق:' : 'Format:'}</span>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSize)}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs font-sans"
              >
                <option value="THERMAL_100x75">حراري قياسي (100×75 مم / 4"×3")</option>
                <option value="COMPACT_70x50">حراري مدمج (70×50 مم)</option>
                <option value="A4_HANGING_TAG">كرت تعليق كبير (A4 Hanging Tag)</option>
              </select>
            </div>
          </div>

          {/* Navigation View Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('PREVIEW')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'PREVIEW'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {isRTL ? 'معاينة فردية' : 'Single Preview'}
            </button>
            <button
              onClick={() => setActiveTab('ALL_LABELS')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'ALL_LABELS'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {isRTL ? `كافة الملصقات (${labelsData.length})` : `All Labels (${labelsData.length})`}
            </button>
            <button
              onClick={() => setActiveTab('RAW_PAYLOAD')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'RAW_PAYLOAD'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {isRTL ? 'بيانات القارئ (Payload)' : 'Raw Scanner Data'}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/70 flex flex-col items-center">
          {/* TAB 1: SINGLE PREVIEW */}
          {activeTab === 'PREVIEW' && (
            <div className="w-full flex flex-col items-center space-y-4">
              {/* Stepper if totalBags > 1 */}
              {totalBags > 1 && (
                <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800 shadow">
                  <span className="text-xs font-bold text-slate-400">
                    {isRTL ? 'معاينة الشليف:' : 'Preview Bag:'}
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1">
                    {labelsData.slice(0, 15).map((l) => (
                      <button
                        key={l.bagIndex}
                        onClick={() => setActivePreviewIndex(l.bagIndex)}
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          activePreviewIndex === l.bagIndex
                            ? 'bg-cyan-500 text-black font-black scale-110 shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {l.bagIndex}
                      </button>
                    ))}
                    {totalBags > 15 && (
                      <span className="text-xs font-mono text-slate-500">
                        ... +{totalBags - 15}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-bold">
                    {activePreviewIndex} / {totalBags}
                  </span>
                </div>
              )}

              {/* RENDER ACTIVE LABEL CARD */}
              <div
                className={`bg-white text-black rounded-2xl shadow-2xl p-5 border-2 border-slate-900 relative transition-all select-none ${
                  labelSize === 'THERMAL_100x75'
                    ? 'w-full max-w-[520px]'
                    : labelSize === 'COMPACT_70x50'
                    ? 'w-full max-w-[420px]'
                    : 'w-full max-w-[650px]'
                }`}
                style={{ fontFamily: "'Cairo', sans-serif" }}
              >
                {/* Header */}
                <div className="border-b-2 border-black pb-2.5 mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-black text-sm">
                      K
                    </div>
                    <div>
                      <div className="text-[13px] font-black tracking-tight text-black leading-none">
                        شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
                      </div>
                      <div className="text-[10px] font-bold text-gray-700 font-mono mt-0.5 tracking-wider uppercase">
                        AL-KARWAN FACTORY • FLOOR TRACKING TAG
                      </div>
                    </div>
                  </div>

                  <div className="text-end">
                    <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-mono font-black">
                      {labelSize === 'A4_HANGING_TAG' ? 'A4 TAG' : 'THERMAL 4x3"'}
                    </span>
                  </div>
                </div>

                {/* Primary Material Block */}
                <div className="grid grid-cols-12 gap-3 mb-3">
                  {/* Left Data Column */}
                  <div className="col-span-8 space-y-2">
                    {/* Material Code Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black font-mono bg-black text-white px-2.5 py-0.5 rounded tracking-wider">
                        {currentPreviewLabel.materialCode}
                      </span>
                      {currentPreviewLabel.requiresShredding ? (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-400 flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          <span>يتطلب ثرم وجرش</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-400 flex items-center gap-1">
                          <Boxes className="w-3 h-3" />
                          <span>خزن واستخدام مباشر</span>
                        </span>
                      )}
                    </div>

                    {/* Material Name */}
                    <div>
                      <h3 className="text-base font-black text-black leading-tight">
                        {currentPreviewLabel.materialNameAr}
                      </h3>
                      <div className="text-xs font-mono font-bold text-gray-600">
                        {currentPreviewLabel.materialNameEn}
                      </div>
                    </div>

                    {/* Polymer Category */}
                    <div className="text-[11px] text-gray-700">
                      <span className="font-bold">التصنيف: </span>
                      <span>{currentPreviewLabel.category}</span>
                    </div>
                  </div>

                  {/* Right QR Code Column */}
                  <div className="col-span-4 flex flex-col items-center justify-center border-s-2 border-dashed border-gray-300 ps-2">
                    {currentQrUrl ? (
                      <div className="p-1 bg-white border-2 border-black rounded-lg shadow-sm">
                        <img
                          src={currentQrUrl}
                          alt="QR Code"
                          className="w-28 h-28 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-28 h-28 bg-gray-100 rounded-lg flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                      </div>
                    )}
                    <span className="text-[9px] font-mono font-bold text-gray-700 mt-1 uppercase">
                      SCAN FOR DETAILS
                    </span>
                  </div>
                </div>

                {/* Batch ID Highlight Banner */}
                <div className="p-2.5 rounded-xl bg-gray-100 border-2 border-black mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-gray-600 block uppercase font-mono">
                      BATCH ID / رقم الوجبة:
                    </span>
                    <span className="text-sm font-black font-mono text-black">
                      {currentPreviewLabel.batchId}
                    </span>
                  </div>
                  <div className="text-end">
                    <span className="text-[10px] font-bold text-gray-600 block uppercase font-mono">
                      BAG SERIAL / رقم الشليف:
                    </span>
                    <span className="text-sm font-black font-mono text-black bg-white px-2 py-0.5 rounded border border-gray-400">
                      {currentPreviewLabel.bagIndex.toString().padStart(2, '0')} /{' '}
                      {currentPreviewLabel.totalBags.toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Secondary Specifications Grid */}
                <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-300 text-[11px] mb-3">
                  <div>
                    <span className="text-gray-500 block text-[10px] font-bold">الوزن الصافي:</span>
                    <span className="font-mono font-black text-sm text-black">
                      {currentPreviewLabel.weightPerBagKG.toLocaleString()} KG
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] font-bold">الموقع المخزني:</span>
                    <span className="font-mono font-black text-xs text-black">
                      {currentPreviewLabel.warehouseId} [{currentPreviewLabel.locationCode}]
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] font-bold">تاريخ الإنتاج / القبان:</span>
                    <span className="font-mono font-bold text-xs text-black">
                      {currentPreviewLabel.productionDate}
                    </span>
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="border-t border-gray-300 pt-2 flex items-center justify-between text-[10px] text-gray-600 font-mono">
                  <div>
                    <span>وردية: </span>
                    <span className="font-bold text-black font-sans">{currentPreviewLabel.shift}</span>
                    <span className="mx-2">•</span>
                    <span>المشغل: </span>
                    <span className="font-bold text-black font-sans">{currentPreviewLabel.operatorName}</span>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-black">
                    <Barcode className="w-3.5 h-3.5" />
                    <span>AL-KARWAN INDUSTRIAL SYSTEM</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL LABELS GRID */}
          {activeTab === 'ALL_LABELS' && (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span className="font-bold">
                  {isRTL
                    ? `عرض كافة ملصقات الوجبة (${labelsData.length} ملصق / شليف جاهز للطباعة)`
                    : `Displaying all ${labelsData.length} labels ready for mass printing`}
                </span>
                <button
                  onClick={handlePrint}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'طباعة الكل' : 'Print All'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labelsData.map((item) => {
                  const url = qrDataUrls[item.bagIndex];
                  return (
                    <div
                      key={item.bagIndex}
                      className="bg-white text-black p-4 rounded-xl shadow border-2 border-black relative"
                      style={{ fontFamily: "'Cairo', sans-serif" }}
                    >
                      <div className="border-b border-black pb-1.5 mb-2 flex items-center justify-between">
                        <div className="text-xs font-black">شركة الكروان لإنتاج الألواح والأكواب</div>
                        <span className="bg-black text-white text-[10px] font-mono font-black px-2 py-0.5 rounded">
                          شليف {item.bagIndex} / {item.totalBags}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-black text-sm bg-black text-white px-2 py-0.5 rounded">
                            {item.materialCode}
                          </span>
                          <h4 className="text-xs font-black mt-1 leading-tight">{item.materialNameAr}</h4>
                          <div className="text-[10px] font-mono text-gray-600 mt-0.5">
                            BATCH: <span className="font-bold text-black">{item.batchId}</span>
                          </div>
                          <div className="text-[10px] font-mono text-gray-700 mt-0.5">
                            وزن الشليف: <span className="font-bold text-black">{item.weightPerBagKG} KG</span> | موقع: {item.warehouseId}-{item.locationCode}
                          </div>
                        </div>

                        {url && (
                          <div className="p-1 bg-white border border-black rounded shrink-0">
                            <img src={url} alt="QR" className="w-20 h-20 object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RAW SCANNER PAYLOAD */}
          {activeTab === 'RAW_PAYLOAD' && (
            <div className="w-full max-w-2xl space-y-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-400 font-sans text-sm">
                      {isRTL ? 'محاكي القراءة الضوئية لأجهزة المصنع:' : 'Industrial Scanner Reader Simulator:'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setQrFormat(qrFormat === 'JSON' ? 'COMPACT_TEXT' : 'JSON')}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px] hover:text-white cursor-pointer font-sans"
                    >
                      {qrFormat === 'JSON' ? 'التحويل لنص مضغوط' : 'التحويل لصيغة JSON'}
                    </button>
                    <button
                      onClick={handleCopyPayload}
                      className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1 cursor-pointer font-sans"
                    >
                      {copiedPayload ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPayload ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ' : 'Copy')}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 font-sans">
                  {isRTL
                    ? 'هذه هي البيانات الدقيقة المشفرة داخل رمز QR والتي يتم قراءتها تلقائياً بواسطة ماسحات الباركود والكاميرات المحمولة عند تسليم الشلايف إلى خطوط الإنتاج أو مناطق التخزين.'
                    : 'This is the exact structured payload encoded in the QR code, captured by handheld scanners on the floor.'}
                </p>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {currentRawPayload}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {isRTL
                ? `جاهز للطباعة: ${labelsData.length} ملصق متوافق مع طابعات الباركود الحرارية (Zebra / Xprinter) وورق A4.`
                : `Ready to print: ${labelsData.length} labels compatible with standard thermal label printers and A4.`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-950 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isRTL ? 'إرسال إلى الطابعة الآن' : 'Print Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        HIDDEN PRINTABLE CONTAINER (#qr-label-printable-area)
        Activated strictly via CSS @media print
        ========================================================================
      */}
      <div id="qr-label-printable-area" className="hidden">
        {labelsData.map((item, idx) => {
          const url = qrDataUrls[item.bagIndex];
          const isLast = idx === labelsData.length - 1;
          return (
            <div
              key={item.bagIndex}
              className={`page-break-inside-avoid bg-white text-black p-6 border-2 border-black mb-6 ${
                !isLast ? 'page-break-after-label' : ''
              }`}
              style={{
                width: labelSize === 'A4_HANGING_TAG' ? '190mm' : '100mm',
                minHeight: labelSize === 'A4_HANGING_TAG' ? '260mm' : '75mm',
                fontFamily: "'Cairo', sans-serif",
                margin: '0 auto',
                boxSizing: 'border-box',
              }}
            >
              {/* Header */}
              <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-black">
                    شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
                  </div>
                  <div className="text-[10px] font-bold font-mono text-gray-700 uppercase">
                    AL-KARWAN FACTORY • FLOOR TRACKING TAG
                  </div>
                </div>
                <div className="text-end font-mono font-black text-sm bg-black text-white px-2 py-0.5 rounded">
                  {item.bagIndex.toString().padStart(2, '0')} / {item.totalBags.toString().padStart(2, '0')}
                </div>
              </div>

              {/* Material and QR */}
              <div className="grid grid-cols-12 gap-3 mb-3">
                <div className="col-span-8 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xl font-black bg-black text-white px-2.5 py-0.5 rounded">
                      {item.materialCode}
                    </span>
                    <span className="text-[11px] font-bold border border-black px-1.5 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-black leading-tight pt-1">
                    {item.materialNameAr}
                  </h3>
                  <div className="text-xs font-mono font-bold text-gray-700">
                    {item.materialNameEn}
                  </div>

                  <div className="text-xs font-bold text-black pt-1">
                    <span>التوجيه: </span>
                    <span>
                      {item.requiresShredding ? 'يتطلب ثرم وجرش (Scrap / Regrind)' : 'خزن واستخدام مباشر (Direct)'}
                    </span>
                  </div>
                </div>

                <div className="col-span-4 flex flex-col items-center justify-center border-s-2 border-black ps-2">
                  {url ? (
                    <img src={url} alt="QR Code" className="w-28 h-28 object-contain" />
                  ) : null}
                  <span className="text-[8px] font-mono font-bold mt-0.5">AL-KARWAN QR</span>
                </div>
              </div>

              {/* Batch Banner */}
              <div className="p-2 border-2 border-black bg-gray-100 mb-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold block">رقم الوجبة / BATCH ID:</span>
                  <span className="font-mono font-black text-sm text-black">{item.batchId}</span>
                </div>
                <div className="text-end">
                  <span className="text-[10px] font-bold block">الوزن الصافي:</span>
                  <span className="font-mono font-black text-sm text-black">
                    {item.weightPerBagKG.toLocaleString()} KG
                  </span>
                </div>
              </div>

              {/* Location & Metadata */}
              <div className="grid grid-cols-3 gap-2 border border-black p-2 text-[11px] mb-3">
                <div>
                  <span className="block text-[10px] text-gray-600">الموقع المخزني:</span>
                  <span className="font-mono font-bold text-black">{item.warehouseId}-{item.locationCode}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-600">التاريخ:</span>
                  <span className="font-mono font-bold text-black">{item.productionDate}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-600">الوردية / المشغل:</span>
                  <span className="font-bold text-black">{item.shift ? (item.shift.split('/')[1]?.trim() || item.shift) : 'الوردية الأولى'}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-black pt-1.5 flex items-center justify-between text-[9px] font-mono">
                <span>شركة الكروان لإنتاج الألواح والأكواب البلاستيكية - نظام تتبع الخامات</span>
                <span>VERIFIED BATCH TAG</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
