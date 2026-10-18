import React, { useState, useMemo } from 'react';
import {
  X,
  Clock,
  Truck,
  Scale,
  Cog,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
  Tag,
  ShieldCheck,
  User,
  MapPin,
  RefreshCw,
  Printer,
  ChevronRight,
  TrendingUp,
  FileText,
  Scan,
  Sparkles,
  ArrowRightLeft,
  Edit3,
  Sliders,
  Check,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  ReceivingTransaction,
  ShreddingTransaction,
  BulkBag,
  MaterialItem,
  WarehouseLocation,
  Warehouse,
} from '../types';
import { QRCodeSVG } from 'qrcode.react';

export interface BatchLifecycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchId?: string;
  bagId?: string;
  transactionNumber?: string;
  materialId?: string;
  initialData?: any;
  onStockUpdated?: () => void;
}

export const BatchLifecycleModal: React.FC<BatchLifecycleModalProps> = ({
  isOpen,
  onClose,
  batchId,
  bagId,
  transactionNumber,
  materialId,
  initialData,
  onStockUpdated,
}) => {
  const { isRTL, t } = useLanguage();
  const {
    receivingTransactions,
    shreddingTransactions,
    bulkBags,
    materials,
    warehouses,
    locations,
    inventoryBalances,
    currentUser,
    reconcileMaterialStock,
    executeLocationTransfer,
    updateBulkBag,
  } = useFactory();

  // Local active tab within modal: LIFECYCLE, ADJUST_STOCK, RELOCATE, QR_LABEL
  const [activeTab, setActiveTab] = useState<'LIFECYCLE' | 'ADJUST_STOCK' | 'RELOCATE' | 'QR_LABEL'>('LIFECYCLE');

  // Stock Adjustment State
  const [adjustTargetKG, setAdjustTargetKG] = useState<string>('');
  const [adjustTargetBags, setAdjustTargetBags] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('جرد فعلي ميداني عبر مسح الباركود والتحقق اللحظي');
  const [adjustPin, setAdjustPin] = useState<string>('1234');
  const [adjustSuccess, setAdjustSuccess] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Relocation State
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [relocateKG, setRelocateKG] = useState<string>('');
  const [relocateBags, setRelocateBags] = useState<string>('');
  const [relocateNotes, setRelocateNotes] = useState<string>('مناقلة وتحديث موقع الشلايف ميدانياً عبر الماسح الضوئي');
  const [relocateSuccess, setRelocateSuccess] = useState<string | null>(null);
  const [relocateError, setRelocateError] = useState<string | null>(null);
  const [isSubmittingRelocate, setIsSubmittingRelocate] = useState(false);

  // -------------------------------------------------------------
  // Resolving Batch Records Across Receiving, Shredding & Bags
  // -------------------------------------------------------------
  const matchedEntities = useMemo(() => {
    const rawQuery = (batchId || bagId || transactionNumber || initialData?.batchNumber || initialData?.bagId || initialData?.transactionNumber || '').trim().toUpperCase();

    // 1. Matched Bulk Bag
    let foundBag: BulkBag | undefined = undefined;
    if (bagId || rawQuery) {
      foundBag = bulkBags.find(
        (b) =>
          b.id.toUpperCase() === rawQuery ||
          b.bagNumber?.toUpperCase() === rawQuery ||
          b.bagId?.toUpperCase() === rawQuery ||
          b.batchNumber?.toUpperCase() === rawQuery ||
          b.transactionNumber?.toUpperCase() === rawQuery
      );
    }

    // 2. Matched Receiving Transaction
    let foundReceiving: ReceivingTransaction | undefined = undefined;
    if (transactionNumber || foundBag?.transactionNumber || foundBag?.sourceTransactionNumber) {
      const txNum = transactionNumber || foundBag?.transactionNumber || foundBag?.sourceTransactionNumber;
      foundReceiving = receivingTransactions.find(
        (r) =>
          r.transactionNumber.toUpperCase() === txNum?.toUpperCase() ||
          r.id.toUpperCase() === txNum?.toUpperCase() ||
          r.legacyDocumentNumber === txNum
      );
    }

    if (!foundReceiving && rawQuery) {
      foundReceiving = receivingTransactions.find(
        (r) =>
          r.transactionNumber.toUpperCase() === rawQuery ||
          r.id.toUpperCase() === rawQuery ||
          r.legacyDocumentNumber === rawQuery ||
          (rawQuery.startsWith('LOT-') && (r.purchaseReference?.includes(rawQuery) || r.notes?.includes(rawQuery)))
      );
    }

    // 3. Matched Shredding Transaction
    let foundShredding: ShreddingTransaction | undefined = undefined;
    if (foundReceiving) {
      foundShredding = shreddingTransactions.find(
        (s) =>
          s.sourceReceivingId === foundReceiving?.id ||
          s.sourceReceivingNumber === foundReceiving?.transactionNumber ||
          s.shreddingNumber.toUpperCase() === rawQuery
      );
    } else if (rawQuery) {
      foundShredding = shreddingTransactions.find(
        (s) =>
          s.shreddingNumber.toUpperCase() === rawQuery ||
          s.id.toUpperCase() === rawQuery ||
          s.legacyDocumentNumber === rawQuery
      );
    }

    // 4. Matched Material
    const targetMatId =
      foundBag?.materialId ||
      foundReceiving?.materialId ||
      foundShredding?.materialId ||
      materialId ||
      materials[0]?.id;

    const matchedMaterial: MaterialItem | undefined = materials.find(
      (m) =>
        m.id === targetMatId ||
        m.code.toUpperCase() === rawQuery ||
        (rawQuery.length > 2 && m?.nameAr && m.nameAr.includes(rawQuery))
    ) || materials[0];

    // 5. Current Location & Warehouse
    const curLocId =
      foundBag?.locationId ||
      foundShredding?.destinationLocationId ||
      foundReceiving?.targetLocationId ||
      locations[0]?.id;

    const matchedLocation = locations.find((l) => l.id === curLocId) || locations[0];
    const matchedWarehouse = warehouses.find((w) => w.id === matchedLocation?.warehouseId) || warehouses[0];

    // 6. Current Balance for this Material in this Location
    const balance = inventoryBalances.find(
      (b) => b.materialId === matchedMaterial?.id && b.locationId === matchedLocation?.id
    );

    // 7. Associated Bulk Bags for this batch / receiving
    const relatedBags = bulkBags.filter(
      (b) =>
        (foundReceiving && (b.transactionNumber === foundReceiving.transactionNumber || b.sourceTransactionId === foundReceiving.id)) ||
        (foundBag && b.batchNumber === foundBag.batchNumber) ||
        (matchedMaterial && b.materialId === matchedMaterial.id && b.locationId === matchedLocation.id)
    );

    const effectiveBatchCode =
      batchId ||
      foundBag?.batchNumber ||
      foundReceiving?.transactionNumber ||
      foundShredding?.shreddingNumber ||
      `BATCH-${matchedMaterial?.code || 'LOT'}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`;

    return {
      batchCode: effectiveBatchCode,
      bag: foundBag,
      receiving: foundReceiving,
      shredding: foundShredding,
      material: matchedMaterial,
      location: matchedLocation,
      warehouse: matchedWarehouse,
      balance,
      relatedBags,
    };
  }, [
    batchId,
    bagId,
    transactionNumber,
    materialId,
    initialData,
    bulkBags,
    receivingTransactions,
    shreddingTransactions,
    materials,
    locations,
    warehouses,
    inventoryBalances,
  ]);

  if (!isOpen) return null;

  const { batchCode, bag, receiving, shredding, material, location, warehouse, balance, relatedBags } = matchedEntities;

  // Derive Lifecycle Stages Status
  const hasReceiving = !!receiving;
  const isRequiresShredding = receiving?.requiresShredding ?? material?.requiresShredding ?? true;
  const hasShredding = !!shredding;
  const isShreddingCompleted = shredding?.status === 'COMPLETED' || shredding?.status === 'Completed' || shredding?.status === 'THERM_COMPLETED';
  const isInStorage = (balance?.availableKG ?? 0) > 0 || (bag?.status === 'IN_STORAGE');

  // Handle Quick Stock Reconcile
  const handleStockAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);
    setAdjustSuccess(null);
    setIsSubmittingAdjust(true);

    const targetKG = parseFloat(adjustTargetKG);
    const targetBags = parseInt(adjustTargetBags, 10);

    if (isNaN(targetKG) || targetKG < 0) {
      setAdjustError(isRTL ? 'يرجى إدخال وزن صحيح بالكيلوغرام' : 'Please provide a valid weight in KG');
      setIsSubmittingAdjust(false);
      return;
    }

    if (isNaN(targetBags) || targetBags < 0) {
      setAdjustError(isRTL ? 'يرجى إدخال عدد شلايف صحيح' : 'Please provide a valid bags count');
      setIsSubmittingAdjust(false);
      return;
    }

    try {
      const res = reconcileMaterialStock(
        material.id,
        location.id,
        targetKG,
        targetBags,
        adjustReason,
        adjustPin
      );

      if (res.success) {
        setAdjustSuccess(
          isRTL
            ? `تم تحديث وضبط رصيد المادة (${material?.nameAr || material?.nameEn || "المادة"}) في الموقع (${location.code}) إلى ${targetKG.toLocaleString()} كغم و ${targetBags} شليف بنجاح!`
            : `Stock level updated to ${targetKG.toLocaleString()} KG (${targetBags} bags) successfully!`
        );
        if (bag) {
          updateBulkBag(bag.id, {
            weightKG: Math.round(targetKG / Math.max(1, targetBags)),
            lastVerifiedAt: new Date().toISOString(),
            lastVerifiedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
            verificationStatus: 'VERIFIED_IN_PLACE',
          });
        }
        if (onStockUpdated) onStockUpdated();
      } else {
        setAdjustError(res.error || (isRTL ? 'فشلت عملية تحديث الرصيد' : 'Failed to update stock'));
      }
    } catch (err: any) {
      setAdjustError(err.message || String(err));
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Handle Batch Relocation
  const handleRelocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRelocateError(null);
    setRelocateSuccess(null);
    setIsSubmittingRelocate(true);

    const kg = parseFloat(relocateKG);
    const bags = parseInt(relocateBags, 10);

    if (!targetLocationId || targetLocationId === location.id) {
      setRelocateError(isRTL ? 'يرجى اختيار موقع هدف مختلف عن الموقع الحالي' : 'Please select a different target location');
      setIsSubmittingRelocate(false);
      return;
    }

    if (isNaN(kg) || kg <= 0) {
      setRelocateError(isRTL ? 'يرجى إدخال كمية صحيحة للنقل' : 'Please provide a valid quantity to transfer');
      setIsSubmittingRelocate(false);
      return;
    }

    try {
      const res = executeLocationTransfer(
        material.id,
        location.id,
        targetLocationId,
        kg,
        isNaN(bags) ? 1 : bags,
        relocateNotes
      );

      if (res.success) {
        const destLoc = locations.find((l) => l.id === targetLocationId);
        setRelocateSuccess(
          isRTL
            ? `تمت مناقلة ${kg.toLocaleString()} كغم بنجاح إلى الرف (${destLoc?.code || targetLocationId}) وتحديث أرصدة الوجبة.`
            : `Transferred ${kg.toLocaleString()} KG to rack ${destLoc?.code} successfully.`
        );
        if (bag) {
          updateBulkBag(bag.id, {
            locationId: targetLocationId,
            locationCode: destLoc?.code || '',
            warehouseId: destLoc?.warehouseId || bag.warehouseId,
            verificationStatus: 'RELOCATED',
            lastVerifiedAt: new Date().toISOString(),
          });
        }
        if (onStockUpdated) onStockUpdated();
      } else {
        setRelocateError(res.error || (isRTL ? 'فشلت عملية المناقلة' : 'Relocation failed'));
      }
    } catch (err: any) {
      setRelocateError(err.message || String(err));
    } finally {
      setIsSubmittingRelocate(false);
    }
  };

  // Print Thermal Label
  const handlePrintLabel = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative hud-glow-cyan">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 border-b border-cyan-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <Scan className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {batchCode}
                </span>
                {bag && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                    BAG: {bag.bagNumber || bag.id}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  {isInStorage ? (isRTL ? 'مخزن نشط' : 'Active Stock') : (isRTL ? 'قيد المعالجة' : 'In Processing')}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <span>{isRTL ? 'دورة حياة المادة والوجبة (Batch Lifecycle Timeline)' : 'Material Batch Lifecycle'}</span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 bg-slate-950/70 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab('LIFECYCLE')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'LIFECYCLE'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isRTL ? 'المخطط الزمني الكامل (Timeline)' : 'Lifecycle Timeline'}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ADJUST_STOCK');
              setAdjustTargetKG(String(balance?.availableKG ?? bag?.weightKG ?? '1000'));
              setAdjustTargetBags(String(balance?.bulkBagsCount ?? 1));
            }}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'ADJUST_STOCK'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'تحديث الرصيد اللحظي' : 'Update Stock Level'}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('RELOCATE');
              setRelocateKG(String(balance?.availableKG ?? bag?.weightKG ?? '500'));
              setRelocateBags('1');
            }}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'RELOCATE'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'مناقلة وتغيير الرف' : 'Relocate Batch'}</span>
          </button>

          <button
            onClick={() => setActiveTab('QR_LABEL')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'QR_LABEL'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'بطاقة الباركود QR' : 'Print QR Label'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Quick Info Top Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{isRTL ? 'المادة الخام' : 'Material Name'}</span>
              <span className="font-bold text-white text-xs truncate block mt-0.5">
                {material ? (isRTL ? (material.nameAr || material.nameEn) : (material.nameEn || material.nameAr)) : "---"}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">{material.code}</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{isRTL ? 'إجمالي الوزن الوارد' : 'Received Weight'}</span>
              <span className="font-bold font-mono text-cyan-300 text-sm mt-0.5 block">
                {((receiving?.netReceivedWeightKG ?? balance?.availableKG ?? bag?.weightKG ?? 0)).toLocaleString()} KG
              </span>
              <span className="text-[10px] text-slate-400">
                {receiving?.bulkBagsCount ?? relatedBags.length ?? 1} {isRTL ? 'شلايف' : 'Bags'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{isRTL ? 'الرصيد المتاح حالياً' : 'Available Stock'}</span>
              <span className="font-bold font-mono text-emerald-400 text-sm mt-0.5 block">
                {((balance?.availableKG ?? bag?.weightKG ?? 0)).toLocaleString()} KG
              </span>
              <span className="text-[10px] text-emerald-300 font-mono">
                {balance?.bulkBagsCount ?? 1} {isRTL ? 'شليف نشط' : 'active bags'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{isRTL ? 'الموقع والمستودع' : 'Rack & Warehouse'}</span>
              <span className="font-bold text-amber-300 text-xs mt-0.5 block truncate">
                {isRTL ? warehouse?.nameAr : warehouse?.nameEn}
              </span>
              <span className="font-mono text-slate-300 text-[10px]">
                {isRTL ? 'رف:' : 'Rack:'} {location?.code}
              </span>
            </div>
          </div>

          {/* TAB 1: LIFECYCLE TIMELINE */}
          {activeTab === 'LIFECYCLE' && (
            <div className="space-y-6">
              <div className="relative pl-6 sm:pl-8 border-l-2 border-cyan-500/30 space-y-8 my-2 rtl:border-l-0 rtl:border-r-2 rtl:pl-0 rtl:pr-6 sm:rtl:pr-8">
                {/* ---------------- STAGE 1: RECEIVING & WEIGHBRIDGE ---------------- */}
                <div className="relative">
                  {/* Timeline Node Icon */}
                  <div className="absolute -left-[35px] sm:-left-[43px] rtl:-left-auto rtl:-right-[35px] sm:rtl:-right-[43px] top-0 w-8 h-8 rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
                    <Truck className="w-4 h-4" />
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-900/60 text-cyan-300 border border-cyan-500/40">
                            {isRTL ? 'المرحلة 1: الاستلام والوزن الجسري' : 'Stage 1: Receiving & Weighbridge'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {isRTL ? 'مستند استلام 546' : 'Legacy Doc 546'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1">
                          {isRTL ? 'استلام الشحنة وتثبيت أوزان الدخول والخروج' : 'Truck Intake & Scale Tare Certification'}
                        </h4>
                      </div>

                      <div className="text-end">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 inline-flex">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{receiving ? receiving.status : (isRTL ? 'موثق بالنظام' : 'Certified Intake')}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'رقم الإرسالية / المعاملة:' : 'Transaction #:'}</span>
                        <span className="font-mono font-bold text-cyan-300">
                          {receiving?.transactionNumber || bag?.transactionNumber || 'RCV-2026-CERTIFIED'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'المورد المعتمد:' : 'Supplier:'}</span>
                        <span className="font-semibold text-slate-200">
                          {receiving?.supplierName || 'شركة الكروان للبلاستيك / سابك'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'رقم لوحة الشاحنة والسائق:' : 'Vehicle Plate & Driver:'}</span>
                        <span className="font-mono text-slate-300">
                          {receiving?.vehiclePlate || 'بغداد 78241 / فحص أصولي'} ({receiving?.driverName || 'معتمد'})
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'وزن الدخول (قائم):' : 'Gross Scale In:'}</span>
                        <span className="font-mono font-bold text-white">
                          {((receiving?.scaleInWeightKG ?? 18450)).toLocaleString()} KG
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'وزن الخروج (فارغ):' : 'Tare Scale Out:'}</span>
                        <span className="font-mono font-bold text-slate-400">
                          {((receiving?.scaleOutWeightKG ?? 3450)).toLocaleString()} KG
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'الصافي المستلم:' : 'Certified Net Received:'}</span>
                        <span className="font-mono font-black text-cyan-300 text-sm">
                          {((receiving?.netReceivedWeightKG ?? balance?.availableKG ?? bag?.weightKG ?? 15000)).toLocaleString()} KG
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        {isRTL ? 'مشغل الميزان:' : 'Scale Operator:'} {receiving?.operator || 'علي كاظم'}
                      </span>
                      <span className="font-mono">
                        {receiving?.date || new Date().toISOString().split('T')[0]} • {receiving?.time || '08:30'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ---------------- STAGE 2: QC & BULK BAG CODING ---------------- */}
                <div className="relative">
                  <div className="absolute -left-[35px] sm:-left-[43px] rtl:-left-auto rtl:-right-[35px] sm:rtl:-right-[43px] top-0 w-8 h-8 rounded-full bg-purple-950 border-2 border-purple-400 flex items-center justify-center text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-purple-500/30 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-900/60 text-purple-300 border border-purple-500/40">
                            {isRTL ? 'المرحلة 2: الفحص النوعي وتكويد الشلايف' : 'Stage 2: QC Inspection & Bag Tagging'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1">
                          {isRTL ? 'مطابقة الجودة، توليد باركودات الشلايف وتحديد المسار' : 'Purity Grade Verification & Bulk Bag Barcodes'}
                        </h4>
                      </div>

                      <div className="text-end">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-purple-950 border border-purple-500/40 text-purple-300 inline-flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" />
                          <span>{isRTL ? 'مفحوص ومكود' : 'Tagged & QC Passed'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'حالة المادة ونقاوتها:' : 'Condition & Grade:'}</span>
                        <span className="font-semibold text-emerald-400">
                          {receiving?.materialCondition || 'Standard Prime (نقي ومفروز)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'مسار التشغيل:' : 'Routing Flow:'}</span>
                        <span className="font-semibold text-cyan-300">
                          {isRequiresShredding
                            ? (isRTL ? 'يتطلب الثرم (عنبر الثرم)' : 'Requires Shredding')
                            : (isRTL ? 'جاهز مثروم (مباشر للتخزين)' : 'Ready Shredded')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'عدد الشلايف الفردية:' : 'Bulk Bags Allocated:'}</span>
                        <span className="font-mono font-bold text-white">
                          {receiving?.bulkBagsCount || relatedBags.length || 1} {isRTL ? 'شليف حراري' : 'Industrial Bags'}
                        </span>
                      </div>
                    </div>

                    {/* Related Bags Badges */}
                    {relatedBags.length > 0 && (
                      <div className="pt-2">
                        <span className="text-[10px] text-slate-400 block mb-1.5">
                          {isRTL ? 'عينة من أكواد الشلايف المرتبطة بالدفعة:' : 'Linked Bulk Bag Identifiers:'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {relatedBags.slice(0, 8).map((b) => (
                            <span
                              key={b.id}
                              className={`px-2 py-0.5 rounded font-mono text-[10px] border ${
                                bag?.id === b.id
                                  ? 'bg-purple-600 text-white border-purple-300 font-bold'
                                  : 'bg-slate-900 text-slate-300 border-slate-700'
                              }`}
                            >
                              {b.bagNumber || b.id} ({b.weightKG} KG)
                            </span>
                          ))}
                          {relatedBags.length > 8 && (
                            <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-400">
                              +{relatedBags.length - 8} {isRTL ? 'المزيد' : 'more'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ---------------- STAGE 3: SHREDDING & GRANULATION ---------------- */}
                <div className="relative">
                  <div
                    className={`absolute -left-[35px] sm:-left-[43px] rtl:-left-auto rtl:-right-[35px] sm:rtl:-right-[43px] top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                      hasShredding || isRequiresShredding
                        ? 'bg-amber-950 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}
                  >
                    <Cog className="w-4 h-4 animate-spin-slow" />
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-amber-500/30 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-900/60 text-amber-300 border border-amber-500/40">
                            {isRTL ? 'المرحلة 3: الثرم والتحبيب' : 'Stage 3: Shredding & Granulation'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {isRTL ? 'مستند مخزن الثرم 360' : 'Legacy Doc 360'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1">
                          {isRequiresShredding
                            ? (isRTL ? 'دورة الثرم، المخرجات، واحتساب الفاقد والتالف' : 'Therm Processing, Output Granules & Variance')
                            : (isRTL ? 'المادة مثرومة جاهزة (تم تخطي دورة الثرم)' : 'Virgin / Pre-Shredded Material (Stage Skipped)')}
                        </h4>
                      </div>

                      <div className="text-end">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1.5 ${
                            isShreddingCompleted
                              ? 'bg-emerald-950 border-emerald-500/40 text-emerald-300'
                              : hasShredding
                              ? 'bg-amber-950 border-amber-500/40 text-amber-300'
                              : !isRequiresShredding
                              ? 'bg-slate-900 border-slate-700 text-slate-400'
                              : 'bg-blue-950 border-blue-500/40 text-blue-300'
                          }`}
                        >
                          {isShreddingCompleted ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'اكتمل الثرم' : 'Completed'}</span>
                            </>
                          ) : hasShredding ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>{isRTL ? 'قيد الثرم' : 'In Progress'}</span>
                            </>
                          ) : !isRequiresShredding ? (
                            <span>{isRTL ? 'غير مطلوب (جاهز)' : 'N/A Pre-shredded'}</span>
                          ) : (
                            <span>{isRTL ? 'في انتظار دورة الثرم' : 'Queued for Shredding'}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {hasShredding ? (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'رقم دورة الثرم:' : 'Shredding #:'}</span>
                          <span className="font-mono font-bold text-amber-300">{shredding.shreddingNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'خط الثرم:' : 'Machine Line:'}</span>
                          <span className="font-semibold text-slate-200">{shredding.machineId || 'Shredder Line 2'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'الوزن المدخل:' : 'Input KG:'}</span>
                          <span className="font-mono font-bold text-white">{(shredding.inputKG ?? 0).toLocaleString()} KG</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'الوزن المفروم المنجز:' : 'Output Shredded:'}</span>
                          <span className="font-mono font-black text-emerald-400 text-sm">
                            {(shredding.outputKG ?? 0).toLocaleString()} KG
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'تالف الإنتاج والهوالك:' : 'Production Damage:'}</span>
                          <span className="font-mono text-rose-400 font-bold">
                            {(shredding.productionDamageKG ?? 0).toLocaleString()} KG
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'الفارق الفيزيائي:' : 'Variance:'}</span>
                          <span className="font-mono text-amber-300">
                            {(shredding.varianceKG ?? 0).toLocaleString()} KG ({shredding.variancePercentage || 0}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'مشغل الثرم:' : 'Operator:'}</span>
                          <span className="text-slate-300">{shredding.operator || 'محمود جاسم'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isRTL ? 'موقع الإيداع:' : 'Dest Rack:'}</span>
                          <span className="font-mono text-cyan-300">{shredding.destinationLocationCode || 'LOC-THM-01'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        {isRequiresShredding
                          ? (isRTL
                              ? 'تم توجيه الإرسالية لقسم الثرم بانتظار بدء تشغيل ماكينة التقطيع والفرم.'
                              : 'Material has been received and routed to shredding staging area awaiting granulator machine schedule.')
                          : (isRTL
                              ? 'هذه المادة تصنف كمواد جاهزة ومثرومة مسبقاً ولا تحتاج لمعالجة في ماكينات الثرم، تم توجيهها فوراً للمستودع النهائي.'
                              : 'This material arrived pre-shredded / pure prime and bypassed granulator processing straight to final warehouse stock.')}
                      </p>
                    )}
                  </div>
                </div>

                {/* ---------------- STAGE 4: FINAL STORAGE & RACK PLACEMENT ---------------- */}
                <div className="relative">
                  <div className="absolute -left-[35px] sm:-left-[43px] rtl:-left-auto rtl:-right-[35px] sm:rtl:-right-[43px] top-0 w-8 h-8 rounded-full bg-emerald-950 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                    <WarehouseIcon className="w-4 h-4" />
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 shadow-lg space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                            {isRTL ? 'المرحلة 4: التخزين النهائي بالأرفف والمستودع' : 'Stage 4: Final Warehouse & Rack Placement'}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1">
                          {isRTL ? 'الإيداع بالأرفف، مطابقة الجرد، وإتاحة المادة لخطوط الإنتاج' : 'Rack Bin Storage & Production Availability'}
                        </h4>
                      </div>

                      <div className="text-end">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isRTL ? 'مخزن جاهز للصرف' : 'In Storage & Ready'}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'المستودع الحالي:' : 'Warehouse:'}</span>
                        <span className="font-bold text-white">{isRTL ? warehouse?.nameAr : warehouse?.nameEn}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'الرف / الموقع:' : 'Rack / Location:'}</span>
                        <span className="font-mono font-bold text-cyan-300 text-sm">{location?.code}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'الرصيد الفعلي المتوفر:' : 'Active Available:'}</span>
                        <span className="font-mono font-black text-emerald-400 text-sm">
                          {((balance?.availableKG ?? bag?.weightKG ?? 0)).toLocaleString()} KG
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isRTL ? 'عدد الشلايف النشطة:' : 'Active Bags:'}</span>
                        <span className="font-mono font-bold text-amber-300 text-sm">
                          {balance?.bulkBagsCount ?? 1} {isRTL ? 'شليف' : 'Bags'}
                        </span>
                      </div>
                    </div>

                    {bag?.lastVerifiedAt && (
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="text-emerald-400 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {isRTL ? 'تم التدقيق الميداني:' : 'Audited on Floor:'} {new Date(bag.lastVerifiedAt).toLocaleString()}
                        </span>
                        <span>{isRTL ? 'المدقق:' : 'Auditor:'} {bag.lastVerifiedBy || (currentUser?.nameAr || currentUser?.name || "المشرف")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer inside Lifecycle Tab */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-cyan-950/40 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  <span className="font-bold text-white block">{isRTL ? 'الإجراءات التشغيلية المباشرة للوجبة:' : 'Direct Batch Operations:'}</span>
                  <span className="text-slate-400 text-[11px]">
                    {isRTL
                      ? 'يمكنك تحديث رصيد هذه الوجبة ميدانياً، نقلها إلى رف آخر، أو طباعة بطاقة حرارية جديدة.'
                      : 'Instantly adjust rack stock, relocate bags, or reprint industrial thermal tags.'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setActiveTab('ADJUST_STOCK');
                      setAdjustTargetKG(String(balance?.availableKG ?? bag?.weightKG ?? '1000'));
                      setAdjustTargetBags(String(balance?.bulkBagsCount ?? 1));
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تعديل الرصيد' : 'Adjust Stock'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('RELOCATE');
                      setRelocateKG(String(balance?.availableKG ?? bag?.weightKG ?? '500'));
                      setRelocateBags('1');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-950 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'مناقلة الموقع' : 'Relocate'}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('QR_LABEL')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isRTL ? 'طباعة ملصق QR' : 'Print QR'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADJUST STOCK */}
          {activeTab === 'ADJUST_STOCK' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Edit3 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {isRTL ? 'تحديث وتعديل رصيد الوجبة بالموقع (Instant Stock Reconcile)' : 'Adjust Batch Stock Level'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? 'تعديل الرصيد الفعلي للمادة بهذا الرف مع تسجيل قيد تسوية جردية تلقائي في حركة المخازن.'
                      : 'Update physical stock on this rack and automatically commit a ledger adjustment movement.'}
                  </p>
                </div>
              </div>

              {adjustError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              {adjustSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{adjustSuccess}</span>
                </div>
              )}

              <form onSubmit={handleStockAdjustSubmit} className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">{isRTL ? 'الرصيد الدفتري الحالي:' : 'Current Stored KG:'}</span>
                    <span className="text-cyan-300 font-bold text-base">
                      {((balance?.availableKG ?? bag?.weightKG ?? 0)).toLocaleString()} KG
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{isRTL ? 'عدد الشلايف الحالية:' : 'Current Bags:'}</span>
                    <span className="text-amber-400 font-bold text-base">
                      {balance?.bulkBagsCount ?? 1} {isRTL ? 'شليف' : 'Bags'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isRTL ? 'الوزن المستهدف الجديد (كغم)' : 'New Verified Weight (KG)'} *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={adjustTargetKG}
                      onChange={(e) => setAdjustTargetKG(e.target.value)}
                      placeholder="e.g. 1500"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-emerald-400 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isRTL ? 'عدد الشلايف الفعلي الجديد' : 'New Bags Count'} *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={adjustTargetBags}
                      onChange={(e) => setAdjustTargetBags(e.target.value)}
                      placeholder="e.g. 2"
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-emerald-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isRTL ? 'سبب وتفاصيل التسوية' : 'Reconciliation Reason / Justification'} *
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-emerald-400 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isRTL ? 'رمز المشرف الإشرافي (PIN)' : 'Supervisor PIN'}
                  </label>
                  <input
                    type="password"
                    value={adjustPin}
                    onChange={(e) => setAdjustPin(e.target.value)}
                    className="w-48 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    placeholder="1234"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {isRTL ? 'رمز المشرف الافتراضي: 1234' : 'Default Supervisor PIN: 1234'}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('LIFECYCLE')}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 cursor-pointer"
                  >
                    {isRTL ? 'رجوع للمخطط' : 'Back to Timeline'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingAdjust}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950 transition-all disabled:opacity-50"
                  >
                    {isSubmittingAdjust ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isRTL ? 'اعتماد وحفظ الرصيد الجديد' : 'Save & Commit Stock'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: RELOCATE BATCH */}
          {activeTab === 'RELOCATE' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {isRTL ? 'مناقلة الوجبة إلى موقع / رف آخر (Internal Rack Transfer)' : 'Relocate Batch to Another Rack'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? 'نقل الشليف أو جزء من وزن الوجبة إلى رف أو مستودع آخر مع تحديث الباركود وسجل المناقلات.'
                      : 'Move bags or weight to a different storage location with immediate ledger transfer.'}
                  </p>
                </div>
              </div>

              {relocateError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{relocateError}</span>
                </div>
              )}

              {relocateSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{relocateSuccess}</span>
                </div>
              )}

              <form onSubmit={handleRelocateSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-400 mb-1">
                      {isRTL ? 'الموقع الحالي (المصدر)' : 'Current Location (Source)'}
                    </label>
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-cyan-300 font-bold">
                      {warehouse?.nameAr} - {location?.code}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isRTL ? 'الموقع المستهدف الجديد (الهدف)' : 'Target Location (Destination)'} *
                    </label>
                    <select
                      value={targetLocationId}
                      onChange={(e) => setTargetLocationId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:border-amber-400 focus:outline-none"
                      required
                    >
                      <option value="">{isRTL ? '-- اختر الموقع الجديد --' : '-- Select Target Location --'}</option>
                      {locations
                        .filter((l) => l.id !== location.id)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.warehouseNameAr} - {l.code} ({l?.nameAr || ""})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isRTL ? 'الوزن المنقول (كغم)' : 'Quantity to Transfer (KG)'} *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={relocateKG}
                      onChange={(e) => setRelocateKG(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      {isRTL ? 'عدد الشلايف المنقولة' : 'Bags Count'} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={relocateBags}
                      onChange={(e) => setRelocateBags(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:border-amber-400 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isRTL ? 'ملاحظات المناقلة' : 'Transfer Notes'}
                  </label>
                  <input
                    type="text"
                    value={relocateNotes}
                    onChange={(e) => setRelocateNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('LIFECYCLE')}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 cursor-pointer"
                  >
                    {isRTL ? 'رجوع للمخطط' : 'Back to Timeline'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingRelocate}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950 transition-all disabled:opacity-50"
                  >
                    {isSubmittingRelocate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                    <span>{isRTL ? 'تنفيذ المناقلة وتحديث الموقع' : 'Execute Relocation'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: PRINT QR LABEL */}
          {activeTab === 'QR_LABEL' && (
            <div className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                    <Printer className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {isRTL ? 'معاينة ملصق الباركود والـ QR الحراري المعياري' : 'Industrial Thermal 100x150 QR Label'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isRTL
                        ? 'متوافق تماماً مع طابعات الزيبرا Zebra والطابعات الصناعية على أرضية المصنع.'
                        : 'Standard Zebra thermal label preview with encrypted QR payload.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePrintLabel}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'طباعة الملصق الآن' : 'Print Label'}</span>
                </button>
              </div>

              {/* Physical Thermal Label Preview Card */}
              <div className="max-w-sm mx-auto p-4 bg-white text-black rounded-xl shadow-2xl border-4 border-black space-y-3 font-mono select-none">
                <div className="border-b-2 border-black pb-2 text-center">
                  <div className="text-xs font-black tracking-widest">AL-KARWAN FACTORY</div>
                  <div className="text-[10px] font-sans font-bold">شركة الكروان للبلاستيك - بغداد</div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 text-[11px] leading-tight flex-1">
                    <div>
                      <span className="text-neutral-500 text-[9px] block">BATCH / LOT NO:</span>
                      <strong className="text-xs">{batchCode}</strong>
                    </div>
                    {bag && (
                      <div>
                        <span className="text-neutral-500 text-[9px] block">BAG ID:</span>
                        <strong className="text-xs">{bag.bagNumber || bag.id}</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-500 text-[9px] block">MATERIAL:</span>
                      <strong className="font-sans text-[11px] block">{material ? (material.nameAr || material.nameEn) : "---"}</strong>
                      <span className="text-[10px] text-neutral-600">{material.code}</span>
                    </div>
                  </div>

                  <div className="p-1 border-2 border-black rounded-lg bg-white shrink-0">
                    <QRCodeSVG
                      value={JSON.stringify({
                        factory: 'AL-KARWAN',
                        batch: batchCode,
                        bag_id: bag?.bagNumber || bag?.id,
                        mat: (material?.nameAr || material?.nameEn || "خام"),
                        mat_code: material.code,
                        weight_kg: balance?.availableKG ?? bag?.weightKG ?? 1000,
                        loc: location?.code,
                        tx: receiving?.transactionNumber,
                      })}
                      size={96}
                      level="M"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] border-t-2 border-black pt-2">
                  <div>
                    <span className="text-neutral-500 text-[8px] block">NET WEIGHT:</span>
                    <strong className="text-sm font-black">
                      {((balance?.availableKG ?? bag?.weightKG ?? 1000)).toLocaleString()} KG
                    </strong>
                  </div>
                  <div className="text-end">
                    <span className="text-neutral-500 text-[8px] block">STORAGE LOCATION:</span>
                    <strong className="text-xs font-black">{location?.code}</strong>
                  </div>
                </div>

                <div className="text-[9px] text-neutral-600 border-t border-neutral-300 pt-1 flex justify-between">
                  <span>DATE: {new Date().toISOString().split('T')[0]}</span>
                  <span>OP: {(currentUser?.nameAr || currentUser?.name || "المشرف")}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'نظام التتبع الرقمي للشلايف والوجبات المعياري - شركة الكروان' : 'Al-Karwan Standard Batch Tracking System'}</span>
          </div>

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
