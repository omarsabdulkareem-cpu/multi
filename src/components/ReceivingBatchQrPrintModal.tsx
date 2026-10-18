import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  X,
  Tag,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Scale,
  Building2,
  Calendar,
  Grid2X2,
  SlidersHorizontal,
  CheckCircle2,
  Truck,
  Hash,
  Boxes,
  MapPin,
  FileText,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { ReceivingTransaction, MaterialItem } from '../types';

export interface ReceivingBatchQrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: ReceivingTransaction[];
  materials?: MaterialItem[];
}

export type BatchLabelMode = 'PER_BAG' | 'PER_TRANSACTION';
export type LabelFormat = 'thermal_100x150' | 'thermal_100x75' | 'compact_70x50' | 'a4_sheet_4up';

interface PrintableLabelItem {
  id: string;
  txId: string;
  transactionNumber: string;
  legacyDocumentNumber?: string;
  bagIndex?: number;
  totalBags?: number;
  bagIdentifier: string;
  materialName: string;
  materialCode?: string;
  supplierName: string;
  weightKG: number;
  vehiclePlate: string;
  unloadingBay: string;
  date: string;
  qrPayload: string;
}

export const ReceivingBatchQrPrintModal: React.FC<ReceivingBatchQrPrintModalProps> = ({
  isOpen,
  onClose,
  transactions,
  materials = [],
}) => {
  const { isRTL } = useLanguage();

  // Selected transactions subset
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>(() =>
    transactions.map((t) => t.id)
  );

  // Label configuration
  const [labelMode, setLabelMode] = useState<BatchLabelMode>('PER_BAG');
  const [labelFormat, setLabelFormat] = useState<LabelFormat>('thermal_100x150');
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);

  // Customization options
  const [showComplianceWarning, setShowComplianceWarning] = useState<boolean>(true);
  const [showVehicleInfo, setShowVehicleInfo] = useState<boolean>(true);
  const [showLocationBay, setShowLocationBay] = useState<boolean>(true);
  const [showSupplierName, setShowSupplierName] = useState<boolean>(true);

  // Sync selected transactions if incoming list changes
  React.useEffect(() => {
    setSelectedTxIds(transactions.map((t) => t.id));
  }, [transactions]);

  // Toggle single transaction selection
  const handleToggleTx = (id: string) => {
    setSelectedTxIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedTxIds(transactions.map((t) => t.id));
  };

  const handleClearAll = () => {
    setSelectedTxIds([]);
  };

  // Compile all individual printable labels based on selection and mode
  const printableLabels: PrintableLabelItem[] = useMemo(() => {
    const list: PrintableLabelItem[] = [];
    const activeTxs = transactions.filter((t) => selectedTxIds.includes(t.id));

    activeTxs.forEach((tx) => {
      const mat = materials.find((m) => m.id === tx.materialId);
      const matCode = mat?.code || '';
      const totalBags = Math.max(1, tx.bulkBagsCount || 1);
      const totalWeight =
        tx.netReceivedWeightKG && tx.netReceivedWeightKG > 0
          ? tx.netReceivedWeightKG
          : tx.scaleInWeightKG && tx.scaleOutWeightKG
          ? Math.max(100, tx.scaleInWeightKG - tx.scaleOutWeightKG)
          : tx.scaleInWeightKG || 1000;

      const dateStr = tx.scaleInTime
        ? tx.scaleInTime.slice(0, 10)
        : tx.createdAt
        ? tx.createdAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      if (labelMode === 'PER_TRANSACTION') {
        // 1 master ticket/pallet label per transaction
        const bagIdentifier = `LOT-${tx.transactionNumber}`;
        const qrPayload = JSON.stringify({
          factory: 'AL-KARWAN',
          type: 'SHIPMENT_LOT',
          tx: tx.transactionNumber,
          mat: tx.materialName,
          mat_code: matCode,
          net_kg: totalWeight,
          bags: totalBags,
          plate: tx.vehiclePlate,
          sup: tx.supplierName,
          bay: tx.unloadingBay || 'BAY-01',
          dt: dateStr,
        });

        list.push({
          id: `tx-${tx.id}-lot`,
          txId: tx.id,
          transactionNumber: tx.transactionNumber,
          legacyDocumentNumber: tx.legacyDocumentNumber,
          bagIdentifier,
          materialName: tx.materialName,
          materialCode: matCode,
          supplierName: tx.supplierName,
          weightKG: totalWeight,
          vehiclePlate: tx.vehiclePlate,
          unloadingBay: tx.unloadingBay || 'رصيف الاستلام الرئيسي',
          date: dateStr,
          qrPayload,
        });
      } else {
        // Individual Bulk Bag Labels for each bag in transaction
        const weightPerBag = Math.round(totalWeight / totalBags);

        for (let i = 1; i <= totalBags; i++) {
          const bagPad = String(i).padStart(2, '0');
          const bagIdentifier = `BAG-${tx.transactionNumber}-${bagPad}`;
          const qrPayload = JSON.stringify({
            factory: 'AL-KARWAN',
            type: 'BULK_BAG',
            bag_id: bagIdentifier,
            tx: tx.transactionNumber,
            mat: tx.materialName,
            mat_code: matCode,
            net_kg: weightPerBag,
            bag_idx: i,
            total_bags: totalBags,
            plate: tx.vehiclePlate,
            sup: tx.supplierName,
            loc: tx.targetLocationId || tx.unloadingBay || 'LOC-REC-01',
            dt: dateStr,
          });

          list.push({
            id: `tx-${tx.id}-bag-${i}`,
            txId: tx.id,
            transactionNumber: tx.transactionNumber,
            legacyDocumentNumber: tx.legacyDocumentNumber,
            bagIndex: i,
            totalBags,
            bagIdentifier,
            materialName: tx.materialName,
            materialCode: matCode,
            supplierName: tx.supplierName,
            weightKG: weightPerBag,
            vehiclePlate: tx.vehiclePlate,
            unloadingBay: tx.unloadingBay || 'رصيف الاستلام الرئيسي',
            date: dateStr,
            qrPayload,
          });
        }
      }
    });

    return list;
  }, [transactions, selectedTxIds, materials, labelMode]);

  // Aggregate stats
  const totalWeightSelected = useMemo(() => {
    return transactions
      .filter((t) => selectedTxIds.includes(t.id))
      .reduce((sum, t) => {
        const w =
          t.netReceivedWeightKG && t.netReceivedWeightKG > 0
            ? t.netReceivedWeightKG
            : t.scaleInWeightKG && t.scaleOutWeightKG
            ? Math.max(100, t.scaleInWeightKG - t.scaleOutWeightKG)
            : t.scaleInWeightKG || 0;
        return sum + w;
      }, 0);
  }, [transactions, selectedTxIds]);

  const totalBagsSelected = useMemo(() => {
    return transactions
      .filter((t) => selectedTxIds.includes(t.id))
      .reduce((sum, t) => sum + (t.bulkBagsCount || 1), 0);
  }, [transactions, selectedTxIds]);

  // Trigger browser's native print API
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const currentPreviewLabel = printableLabels[activePreviewIndex] || printableLabels[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-950">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {isRTL
                    ? 'طباعة ملصقات QR المجمعة لإرساليات المواد'
                    : 'Batch Print Material QR Labels'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {printableLabels.length} {isRTL ? 'ملصق جاهز' : 'Labels Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'توليد وطباعة باركودات QR الصناعية للمواد المستلمة دفعة واحدة عبر طابعات الباركود الحرارية (Zebra / TSC)'
                  : 'Batch generate & print industrial QR labels via browser print API for thermal barcode printers'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Top Control Grid: Transactions Selection & Print Configurations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Column 1: Included Transactions Selector */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-slate-200">
                    {isRTL ? 'الإرساليات المحددة' : 'Selected Shipments'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                    {selectedTxIds.length} / {transactions.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    onClick={handleSelectAll}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    {isRTL ? 'الكل' : 'All'}
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    onClick={handleClearAll}
                    className="text-slate-400 hover:text-slate-300 cursor-pointer"
                  >
                    {isRTL ? 'مسح' : 'Clear'}
                  </button>
                </div>
              </div>

              {/* Transactions List with checkboxes */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
                {transactions.map((tx) => {
                  const isChecked = selectedTxIds.includes(tx.id);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleToggleTx(tx.id)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                        <div className="truncate">
                          <div className="font-mono font-bold text-cyan-300 truncate">
                            {tx.transactionNumber}
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {tx.materialName} • {tx.vehiclePlate}
                          </div>
                        </div>
                      </div>

                      <div className="text-end shrink-0 font-mono text-[11px]">
                        <div className="text-amber-400 font-bold">{tx.bulkBagsCount || 1} شليف</div>
                        <div className="text-slate-400">
                          {((tx.netReceivedWeightKG || tx.scaleInWeightKG) ?? 0).toLocaleString()} KG
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary KPIs */}
              <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-2 rounded-xl bg-slate-900/80 text-center">
                  <div className="text-slate-400 text-[10px]">
                    {isRTL ? 'إجمالي الشلايف' : 'Total Bags'}
                  </div>
                  <div className="text-amber-300 font-bold text-xs">{totalBagsSelected} شليف</div>
                </div>
                <div className="p-2 rounded-xl bg-slate-900/80 text-center">
                  <div className="text-slate-400 text-[10px]">
                    {isRTL ? 'إجمالي الوزن' : 'Total Weight'}
                  </div>
                  <div className="text-cyan-300 font-bold text-xs">
                    {totalWeightSelected.toLocaleString()} KG
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Label Generation Settings */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  {isRTL ? 'خيارات وتنسيق الملصقات' : 'Label Settings & Layout'}
                </span>
              </div>

              {/* Generation Mode: Per Bag vs Per Transaction */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  {isRTL ? 'نمط توليد الباركود' : 'Label Generation Mode'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLabelMode('PER_BAG')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      labelMode === 'PER_BAG'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Boxes className="w-4 h-4" />
                    <span>{isRTL ? 'لكل شليف ملصق' : 'Per Bulk Bag'}</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      {isRTL ? 'توليد باركود لكل شليف فردي' : '1 Label per each bag'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelMode('PER_TRANSACTION')}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      labelMode === 'PER_TRANSACTION'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>{isRTL ? 'إرسالية كاملة' : 'Per Shipment'}</span>
                    <span className="text-[10px] font-normal text-slate-400">
                      {isRTL ? 'ملصق طبلية / شحنة مجمعة' : '1 Master ticket label'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Physical Label Size */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">
                  {isRTL ? 'مقاس ورق الطباعة الحرارية' : 'Thermal Paper Size'}
                </label>
                <select
                  value={labelFormat}
                  onChange={(e) => setLabelFormat(e.target.value as LabelFormat)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-cyan-400 outline-none"
                >
                  <option value="thermal_100x150">
                    {isRTL ? '100x150 مم (حراري صناعي قياسي Zebra/TSC)' : '100x150 mm (Industrial Thermal)'}
                  </option>
                  <option value="thermal_100x75">
                    {isRTL ? '100x75 مم (حراري متوسط)' : '100x75 mm (Medium Thermal)'}
                  </option>
                  <option value="compact_70x50">
                    {isRTL ? '70x50 مم (ملصق صغير مدمج)' : '70x50 mm (Compact Bag Tag)'}
                  </option>
                  <option value="a4_sheet_4up">
                    {isRTL ? 'ورق A4 عادي (4 ملصقات في الصفحة)' : 'A4 Sheet (4 Labels per Page)'}
                  </option>
                </select>
              </div>

              {/* Toggleable Print Details */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showSupplierName}
                    onChange={(e) => setShowSupplierName(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>{isRTL ? 'إظهار اسم المورد والشركة' : 'Include Supplier Name'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showVehicleInfo}
                    onChange={(e) => setShowVehicleInfo(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>{isRTL ? 'إظهار رقم الشاحنة والإرسالية' : 'Include Vehicle & Plate'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showLocationBay}
                    onChange={(e) => setShowLocationBay(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>{isRTL ? 'إظهار رصيف وموقع التفريغ' : 'Include Unloading Bay'}</span>
                </label>
              </div>
            </div>

            {/* Column 3: Live Preview of Single Label */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-200">
                  {isRTL ? 'معاينة الملصق المطبوع' : 'Live Print Preview'}
                </span>
                {printableLabels.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                    <button
                      type="button"
                      disabled={activePreviewIndex <= 0}
                      onClick={() => setActivePreviewIndex((prev) => Math.max(0, prev - 1))}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      &lt;
                    </button>
                    <span>
                      {activePreviewIndex + 1} / {printableLabels.length}
                    </span>
                    <button
                      type="button"
                      disabled={activePreviewIndex >= printableLabels.length - 1}
                      onClick={() =>
                        setActivePreviewIndex((prev) => Math.min(printableLabels.length - 1, prev + 1))
                      }
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      &gt;
                    </button>
                  </div>
                )}
              </div>

              {/* Label Visual Mockup */}
              {currentPreviewLabel ? (
                <div className="bg-white text-black p-3.5 rounded-xl border-2 border-black font-sans shadow-lg select-none space-y-2 text-right">
                  {/* Factory Header */}
                  <div className="border-b-2 border-black pb-1 text-center">
                    <div className="text-[10px] font-black uppercase tracking-wider text-black">
                      شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
                    </div>
                    <div className="text-[8px] font-mono tracking-widest text-gray-700">
                      AL-KARWAN FACTORY • MATERIAL LOT IDENTIFIER
                    </div>
                  </div>

                  {/* QR & Details Row */}
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="col-span-1 flex flex-col items-center justify-center p-1 bg-white border border-black rounded">
                      <QRCodeSVG
                        value={currentPreviewLabel.qrPayload}
                        size={72}
                        level="M"
                        includeMargin={false}
                      />
                      <span className="mt-0.5 text-[7px] font-mono font-bold text-black truncate max-w-full">
                        {currentPreviewLabel.bagIdentifier}
                      </span>
                    </div>

                    <div className="col-span-2 space-y-1 text-right text-[10px]">
                      <div>
                        <span className="text-[8px] text-gray-600 block">المادة:</span>
                        <span className="font-black text-xs text-black block leading-tight truncate">
                          {currentPreviewLabel.materialName}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between border-t border-gray-300 pt-0.5">
                        <span className="font-black text-sm font-mono text-black">
                          {currentPreviewLabel.weightKG.toLocaleString()} KG
                        </span>
                        {currentPreviewLabel.bagIndex && (
                          <span className="text-[8px] font-bold text-gray-700">
                            شليف {currentPreviewLabel.bagIndex} / {currentPreviewLabel.totalBags}
                          </span>
                        )}
                      </div>

                      <div className="text-[8px] text-gray-600 font-mono flex justify-between">
                        <span>{currentPreviewLabel.transactionNumber}</span>
                        <span>{currentPreviewLabel.vehiclePlate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Strip */}
                  <div className="border-t border-black pt-1 flex items-center justify-between text-[7px] font-bold text-gray-700">
                    <span>يحظر تحريك الشليف دون مسح الباركود</span>
                    <span className="font-mono">{currentPreviewLabel.date}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                  <span>{isRTL ? 'لم يتم تحديد أي إرساليات للطباعة' : 'No shipments selected'}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center">
                {isRTL
                  ? 'ستتم طباعة جميع الملصقات في أمر واحد عبر واجهة طباعة المتصفح.'
                  : 'All labels will be output in a single batch operation using browser print.'}
              </p>
            </div>
          </div>

          {/* Quick Label Grid Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid2X2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-200">
                  {isRTL ? 'قائمة الملصقات المعدة للطباعة في هذه الدفعة' : 'Batch Print Queue Queue Items'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono">
                  {printableLabels.length} {isRTL ? 'ملصق' : 'Labels'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-48 overflow-y-auto pe-1">
              {printableLabels.map((lbl, idx) => (
                <div
                  key={lbl.id}
                  onClick={() => setActivePreviewIndex(idx)}
                  className={`p-2.5 rounded-xl border text-center cursor-pointer transition-all ${
                    activePreviewIndex === idx
                      ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-950'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="w-12 h-12 mx-auto bg-white p-1 rounded border border-slate-300 flex items-center justify-center">
                    <QRCodeSVG value={lbl.qrPayload} size={40} level="M" />
                  </div>
                  <div className="mt-1 font-mono font-bold text-[10px] text-cyan-300 truncate">
                    {lbl.bagIdentifier}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">{lbl.materialName}</div>
                  <div className="font-mono text-[10px] text-amber-300 font-bold">
                    {lbl.weightKG.toLocaleString()} KG
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {isRTL ? 'جاهز للإرسال للطابعة:' : 'Ready for print:'}{' '}
                <strong className="text-white font-mono">{printableLabels.length}</strong>{' '}
                {isRTL ? 'ملصق' : 'labels'}
              </span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="font-mono text-cyan-300">
              {totalWeightSelected.toLocaleString()} KG
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="button"
              disabled={printableLabels.length === 0}
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/70 cursor-pointer disabled:opacity-40 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isRTL
                  ? `طباعة الدفعة الآن (${printableLabels.length} ملصق)`
                  : `Print Batch Now (${printableLabels.length} Labels)`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        HIDDEN PRINTABLE CONTAINER (#batch-qr-labels-printable-area)
        Activated strictly via CSS @media print
        ========================================================================
      */}
      <div id="batch-qr-labels-printable-area" className="hidden">
        {printableLabels.map((lbl, idx) => {
          const isLast = idx === printableLabels.length - 1;
          const isThermal150 = labelFormat === 'thermal_100x150';
          const isThermal75 = labelFormat === 'thermal_100x75';
          const isCompact = labelFormat === 'compact_70x50';

          return (
            <div
              key={lbl.id}
              className={`page-break-inside-avoid bg-white text-black p-5 border-2 border-black mb-6 ${
                !isLast ? 'page-break-after-label' : ''
              }`}
              style={{
                width: isCompact ? '70mm' : isThermal75 ? '100mm' : isThermal150 ? '100mm' : '190mm',
                minHeight: isCompact ? '50mm' : isThermal75 ? '75mm' : isThermal150 ? '145mm' : 'auto',
                margin: '0 auto',
                boxSizing: 'border-box',
                fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif",
                direction: 'rtl',
              }}
            >
              {/* Header Banner */}
              <div className="border-b-2 border-black pb-1.5 mb-2.5 text-center">
                <div className="text-[12px] font-black tracking-wider uppercase text-black">
                  شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
                </div>
                <div className="text-[9px] font-mono tracking-widest text-gray-700">
                  AL-KARWAN FACTORY • MATERIAL QR IDENTIFIER
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-3 gap-3 items-center">
                {/* QR Code Container */}
                <div className="col-span-1 flex flex-col items-center justify-center p-1 bg-white border border-black rounded">
                  <QRCodeSVG
                    value={lbl.qrPayload}
                    size={isCompact ? 80 : 120}
                    level="M"
                    includeMargin={false}
                  />
                  <div className="mt-1 text-[8px] font-mono font-bold text-black text-center break-all">
                    {lbl.bagIdentifier}
                  </div>
                </div>

                {/* Details Container */}
                <div className="col-span-2 space-y-1.5 text-xs text-right">
                  {/* Material Name */}
                  <div className="border-b border-gray-400 pb-1">
                    <span className="text-[10px] text-gray-600 block">اسم المادة / الخامة:</span>
                    <span className="text-sm font-black text-black leading-tight block">
                      {lbl.materialName}
                    </span>
                    {lbl.materialCode && (
                      <span className="text-[10px] font-mono font-bold text-gray-700 block">
                        كود المادة: {lbl.materialCode}
                      </span>
                    )}
                  </div>

                  {/* Net Weight */}
                  <div className="border-b border-gray-400 pb-1 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-gray-600 block">الوزن الصافي:</span>
                      <span className="text-xl font-black font-mono text-black">
                        {lbl.weightKG.toLocaleString()}
                      </span>
                      <span className="text-xs font-bold mr-1">كغم (KG)</span>
                    </div>
                    {lbl.bagIndex && (
                      <div className="text-left text-[10px] font-bold text-gray-800 font-mono">
                        شليف {lbl.bagIndex} / {lbl.totalBags}
                      </div>
                    )}
                  </div>

                  {/* Transaction & Vehicle */}
                  <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                    <div>
                      <span className="text-gray-600 block">رقم الإرسالية:</span>
                      <span className="font-mono font-bold text-black">{lbl.transactionNumber}</span>
                    </div>
                    {showVehicleInfo && (
                      <div>
                        <span className="text-gray-600 block">رقم الشاحنة:</span>
                        <span className="font-mono font-bold text-black">{lbl.vehiclePlate}</span>
                      </div>
                    )}
                  </div>

                  {/* Supplier & Bay */}
                  <div className="grid grid-cols-2 gap-1 text-[9px] pt-0.5">
                    {showSupplierName && (
                      <div>
                        <span className="text-gray-600 block">المورد:</span>
                        <span className="font-bold text-black truncate block">{lbl.supplierName}</span>
                      </div>
                    )}
                    {showLocationBay && (
                      <div>
                        <span className="text-gray-600 block">الموقع:</span>
                        <span className="font-mono font-bold text-black truncate block">
                          {lbl.unloadingBay}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Date Stamp */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-gray-600 pt-1 border-t border-dashed border-gray-300">
                    <span>تاريخ الاستلام: {lbl.date}</span>
                    <span>وردية: صباحي</span>
                  </div>
                </div>
              </div>

              {/* Footer Warning */}
              {showComplianceWarning && (
                <div className="mt-3 pt-1 border-t-2 border-black flex items-center justify-between text-[8px] text-gray-800 font-bold">
                  <span>يحظر تحريك أو صرف الشليف دون مسح الباركود</span>
                  <span className="font-mono">VERIFIED BY FACTORY ENGINE</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
