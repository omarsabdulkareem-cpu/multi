import React, { useState, useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ClipboardList,
  Search,
  Scan,
  X,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Barcode,
  Layers,
  Building2,
  Sparkles,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { WarehouseEngineService } from '../services/warehouseEngineService';
import { CommercialReadinessService } from '../services/commercialReadinessService';

interface WarehouseWorkerModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WorkerAction = 'RECEIVE' | 'ISSUE' | 'TRANSFER' | 'COUNT' | 'SCAN' | 'LOOKUP';

export const WarehouseWorkerModeModal: React.FC<WarehouseWorkerModeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isRTL, language } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser } = useFactory();

  const orgId = currentOrganization.id;
  const userName = currentUser?.name || 'Floor Worker';

  const [activeAction, setActiveAction] = useState<WorkerAction>('LOOKUP');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Master Data
  const warehouses = useMemo(() => WarehouseEngineService.getWarehouses(orgId), [orgId]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || '');
  const locations = useMemo(
    () => WarehouseEngineService.getLocations(orgId, selectedWarehouseId),
    [orgId, selectedWarehouseId]
  );
  const items = useMemo(() => WarehouseEngineService.getItems(orgId), [orgId]);
  const balances = useMemo(() => WarehouseEngineService.computeInventoryBalances(orgId), [orgId, isSubmitting]);

  // Search & Scan State
  const [searchQuery, setSearchQuery] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');

  // Quick Action Forms
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id || '');
  const [destLocationId, setDestLocationId] = useState<string>(locations[1]?.id || locations[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(100);
  const [workerNotes, setWorkerNotes] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('Standard Direct Supplier');
  const [destinationParty, setDestinationParty] = useState<string>('Line 1 Factory Floor');

  if (!isOpen) return null;

  const showToast = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Find selected item balance
  const activeItem = items.find((i) => i.id === selectedItemId) || items[0];
  const activeBal = balances.find(
    (b) => b.itemId === activeItem?.id && b.locationId === selectedLocationId
  );
  const availableQty = activeBal ? activeBal.availableQuantity : 0;

  // Filtered items for quick search
  const filteredItems = items.filter(
    (i) =>
      i.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.nameAr && i.nameAr.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.nameEn && i.nameEn.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Submit Quick Receipt
  const handleQuickReceive = async () => {
    if (quantity <= 0) {
      showToast('error', isRTL ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be > 0');
      return;
    }
    const idempotencyKey = `worker_rec_${Date.now()}`;
    if (!CommercialReadinessService.checkAndLockIdempotency(idempotencyKey)) return;

    setIsSubmitting(true);
    try {
      const doc = await WarehouseEngineService.createReceiptDocument(
        orgId,
        {
          supplierName,
          documentNumber: `WKR-REC-${Date.now().toString().slice(-4)}`,
          date: new Date().toISOString().split('T')[0],
          warehouseId: selectedWarehouseId,
          notes: workerNotes || 'Quick Floor Receipt',
          items: [
            {
              itemId: activeItem.id,
              locationId: selectedLocationId,
              quantity,
              unit: activeItem.unitOfMeasure,
              weightKG: quantity * (activeItem.defaultWeight || 1),
            },
          ],
        },
        false,
        userName
      );
      showToast('success', isRTL ? `تم الاستلام بنجاح! مستند #${doc.receiptNumber}` : `Received! Doc #${doc.receiptNumber}`);
      setQuantity(100);
      setWorkerNotes('');
    } catch (err: any) {
      CommercialReadinessService.releaseIdempotencyLock(idempotencyKey);
      showToast('error', err.message || 'Error executing quick receive');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Issue
  const handleQuickIssue = async () => {
    if (quantity <= 0) {
      showToast('error', isRTL ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be > 0');
      return;
    }
    if (quantity > availableQty) {
      showToast(
        'error',
        isRTL
          ? `الكمية المتاحة غير كافية! متاح: ${availableQty} ${activeItem.unitOfMeasure}`
          : `Insufficient stock! Only ${availableQty} ${activeItem.unitOfMeasure} available`
      );
      return;
    }
    const idempotencyKey = `worker_iss_${Date.now()}`;
    if (!CommercialReadinessService.checkAndLockIdempotency(idempotencyKey)) return;

    setIsSubmitting(true);
    try {
      const res = await WarehouseEngineService.executeIssue(
        orgId,
        {
          warehouseId: selectedWarehouseId,
          locationId: selectedLocationId,
          itemId: activeItem.id,
          quantity,
          destination: destinationParty,
          reason: workerNotes || 'Floor Dispatch',
        },
        userName
      );
      showToast('success', isRTL ? `تم الصرف بنجاح! مستند #${res.issueId}` : `Issued! Doc #${res.issueId}`);
      setQuantity(100);
      setWorkerNotes('');
    } catch (err: any) {
      CommercialReadinessService.releaseIdempotencyLock(idempotencyKey);
      showToast('error', err.message || 'Error executing quick issue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Transfer
  const handleQuickTransfer = async () => {
    if (quantity <= 0) {
      showToast('error', isRTL ? 'الكمية يجب أن تكون أكبر من صفر' : 'Quantity must be > 0');
      return;
    }
    if (selectedLocationId === destLocationId) {
      showToast('error', isRTL ? 'الموقع المصدر والموقع الهدف متطابقان!' : 'Source and destination locations cannot be identical!');
      return;
    }
    if (quantity > availableQty) {
      showToast('error', isRTL ? `الرصيد المتاح لا يكفي للمناقلة (${availableQty})` : `Insufficient stock for transfer (${availableQty})`);
      return;
    }
    const idempotencyKey = `worker_trf_${Date.now()}`;
    if (!CommercialReadinessService.checkAndLockIdempotency(idempotencyKey)) return;

    setIsSubmitting(true);
    try {
      const doc = await WarehouseEngineService.createTransferDocument(
        orgId,
        {
          sourceWarehouseId: selectedWarehouseId,
          sourceLocationId: selectedLocationId,
          destinationWarehouseId: selectedWarehouseId,
          destinationLocationId: destLocationId,
          reason: workerNotes || 'Floor Bay Relocation',
          items: [{ itemId: activeItem.id, quantity, unit: activeItem.unitOfMeasure }],
        },
        false,
        userName
      );
      showToast('success', isRTL ? `تمت المناقلة بنجاح! #${doc.transferNumber}` : `Transferred! #${doc.transferNumber}`);
      setQuantity(100);
      setWorkerNotes('');
    } catch (err: any) {
      CommercialReadinessService.releaseIdempotencyLock(idempotencyKey);
      showToast('error', err.message || 'Error executing quick transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Stock Count
  const handleQuickCount = async () => {
    if (quantity < 0) {
      showToast('error', isRTL ? 'الكمية لا يمكن أن تكون سالبة' : 'Quantity cannot be negative');
      return;
    }
    const idempotencyKey = `worker_cnt_${Date.now()}`;
    if (!CommercialReadinessService.checkAndLockIdempotency(idempotencyKey)) return;

    setIsSubmitting(true);
    try {
      const doc = await WarehouseEngineService.createStockCountDocument(
        orgId,
        {
          warehouseId: selectedWarehouseId,
          locationId: selectedLocationId,
          notes: workerNotes || 'Quick Spot Cycle Count',
          items: [{ itemId: activeItem.id, countedQuantity: quantity }],
        },
        false,
        userName
      );
      showToast('success', isRTL ? `تم تسجيل الجرد والتسوية! #${doc.countNumber}` : `Count posted! #${doc.countNumber}`);
      setWorkerNotes('');
    } catch (err: any) {
      CommercialReadinessService.releaseIdempotencyLock(idempotencyKey);
      showToast('error', err.message || 'Error recording cycle count');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col font-sans text-white overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top Floor Bar */}
      <div className="bg-[#11131a] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wide">
                {isRTL ? 'وضع عامل المستودع السريع' : 'WAREHOUSE WORKER OPERATING MODE'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold">
                {isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isRTL
                ? `المستخدم: ${userName} • أزرار كبيرة وعمليات سريعة خالية من التعقيد`
                : `Operator: ${userName} • Large-touch, zero-clutter high-speed warehouse floor mode`}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title={isRTL ? 'الخروج من وضع العامل' : 'Exit Worker Mode'}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Toast Alert */}
      {feedback && (
        <div
          className={`px-4 py-3 text-center text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-600/90 text-white shadow-lg'
              : 'bg-rose-600/90 text-white shadow-lg'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Actions Big Buttons (Left / Top) */}
        <div className="w-full md:w-64 bg-[#0d0f15] border-b md:border-b-0 md:border-r border-white/10 p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto shrink-0">
          <button
            onClick={() => setActiveAction('LOOKUP')}
            className={`flex-1 md:flex-none flex items-center gap-3 p-3.5 rounded-xl text-start font-bold transition-all cursor-pointer min-h-[52px] ${
              activeAction === 'LOOKUP'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Search className="w-5 h-5 shrink-0" />
            <div className="leading-tight">
              <div className="text-sm">{isRTL ? 'فحص ورصيد' : 'Stock Lookup'}</div>
              <div className="text-[10px] opacity-75">{isRTL ? 'استعلام سريع' : 'Live balance'}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAction('RECEIVE')}
            className={`flex-1 md:flex-none flex items-center gap-3 p-3.5 rounded-xl text-start font-bold transition-all cursor-pointer min-h-[52px] ${
              activeAction === 'RECEIVE'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <ArrowDownLeft className="w-5 h-5 shrink-0 text-emerald-300" />
            <div className="leading-tight">
              <div className="text-sm">{isRTL ? 'استلام بضاعة' : 'Quick Receive'}</div>
              <div className="text-[10px] opacity-75">{isRTL ? 'وارد فوري' : 'Goods Receipt'}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAction('ISSUE')}
            className={`flex-1 md:flex-none flex items-center gap-3 p-3.5 rounded-xl text-start font-bold transition-all cursor-pointer min-h-[52px] ${
              activeAction === 'ISSUE'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <ArrowUpRight className="w-5 h-5 shrink-0 text-amber-300" />
            <div className="leading-tight">
              <div className="text-sm">{isRTL ? 'صرف مواد' : 'Quick Issue'}</div>
              <div className="text-[10px] opacity-75">{isRTL ? 'صادر للإنتاج' : 'Dispatch Stock'}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAction('TRANSFER')}
            className={`flex-1 md:flex-none flex items-center gap-3 p-3.5 rounded-xl text-start font-bold transition-all cursor-pointer min-h-[52px] ${
              activeAction === 'TRANSFER'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <ArrowRightLeft className="w-5 h-5 shrink-0 text-blue-300" />
            <div className="leading-tight">
              <div className="text-sm">{isRTL ? 'مناقلة رصيد' : 'Quick Transfer'}</div>
              <div className="text-[10px] opacity-75">{isRTL ? 'بين المواقع' : 'Relocate Bay'}</div>
            </div>
          </button>

          <button
            onClick={() => setActiveAction('COUNT')}
            className={`flex-1 md:flex-none flex items-center gap-3 p-3.5 rounded-xl text-start font-bold transition-all cursor-pointer min-h-[52px] ${
              activeAction === 'COUNT'
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <ClipboardList className="w-5 h-5 shrink-0 text-purple-300" />
            <div className="leading-tight">
              <div className="text-sm">{isRTL ? 'جرد فوري' : 'Cycle Count'}</div>
              <div className="text-[10px] opacity-75">{isRTL ? 'تسوية فروقات' : 'Variance fix'}</div>
            </div>
          </button>
        </div>

        {/* Content & Action Forms */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full">
          {/* Top Context Selectors (Facility & Location) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                {isRTL ? 'المستودع النشط' : 'Active Facility'}
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm focus:border-cyan-400 focus:outline-none"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {isRTL ? wh.nameAr || wh.name : wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                {isRTL ? 'الموقع / الرف' : 'Storage Bay / Location'}
              </label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm focus:border-cyan-400 focus:outline-none"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} - {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* VIEW: STOCK LOOKUP & BARCODE SCAN */}
          {activeAction === 'LOOKUP' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute top-3.5 left-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    isRTL
                      ? 'امسح الباركود أو اكتب كود الصنف / الاسم...'
                      : 'Scan barcode or type SKU code / item name...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/5 border border-white/20 text-white placeholder-slate-500 font-semibold text-sm focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredItems.slice(0, 8).map((item) => {
                  const b = balances.find((x) => x.itemId === item.id && x.locationId === selectedLocationId);
                  const total = WarehouseEngineService.getItemTotalStock(orgId, item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setActiveAction('RECEIVE');
                      }}
                      className="p-4 rounded-xl bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/40 text-start transition-all cursor-pointer flex flex-col justify-between min-h-[90px]"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-mono font-bold text-cyan-400">{item.itemCode}</div>
                          <div className="text-sm font-bold text-white">{isRTL ? item.nameAr || item.name : item.name}</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                          {item.unitOfMeasure}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-white/10">
                        <span className="text-slate-400">
                          {isRTL ? 'الرصيد في الموقع:' : 'At this bay:'}{' '}
                          <span className="font-bold text-emerald-400 font-mono">{b ? b.availableQuantity : 0}</span>
                        </span>
                        <span className="text-slate-400">
                          {isRTL ? 'الإجمالي:' : 'Total:'}{' '}
                          <span className="font-bold text-white font-mono">{total.quantity}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: QUICK RECEIVE */}
          {activeAction === 'RECEIVE' && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-emerald-500/30 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base pb-2 border-b border-white/10">
                <ArrowDownLeft className="w-5 h-5" />
                <span>{isRTL ? 'تسجيل استلام بضاعة فوري' : 'Quick Goods Receipt Form'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'الصنف' : 'Item'}</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {isRTL ? i.nameAr || i.name : i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الكمية الواردة' : 'Quantity'}{' '}
                    <span className="font-mono text-cyan-400">({activeItem?.unitOfMeasure})</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'المورد' : 'Supplier Name'}</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-semibold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'ملاحظات' : 'Notes / Reference'}</label>
                <input
                  type="text"
                  placeholder={isRTL ? 'رقم الشاحنة / إذن التوريد...' : 'Truck plate / consignment ref...'}
                  value={workerNotes}
                  onChange={(e) => setWorkerNotes(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-semibold text-sm"
                />
              </div>

              <button
                disabled={isSubmitting}
                onClick={handleQuickReceive}
                className="w-full h-14 mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                <span>{isRTL ? 'تأكيد وحفظ الاستلام (GRN)' : 'Confirm Goods Receipt'}</span>
              </button>
            </div>
          )}

          {/* VIEW: QUICK ISSUE */}
          {activeAction === 'ISSUE' && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-amber-500/30 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-base pb-2 border-b border-white/10">
                <ArrowUpRight className="w-5 h-5" />
                <span>{isRTL ? 'تسجيل صرف مواد فوري' : 'Quick Stock Issue Voucher'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'الصنف' : 'Item'}</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {isRTL ? i.nameAr || i.name : i.name}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-slate-400 flex justify-between">
                  <span>{isRTL ? 'المتاح في الموقع المحدد:' : 'Available in this location:'}</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {availableQty} {activeItem?.unitOfMeasure}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الكمية المطلوبة' : 'Quantity'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={availableQty}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'جهة الصرف' : 'Destination / Line'}</label>
                  <input
                    type="text"
                    value={destinationParty}
                    onChange={(e) => setDestinationParty(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-semibold text-sm"
                  />
                </div>
              </div>

              <button
                disabled={isSubmitting || quantity > availableQty}
                onClick={handleQuickIssue}
                className="w-full h-14 mt-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-base shadow-lg shadow-amber-950 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                <span>{isRTL ? 'تأكيد صرف المواد' : 'Confirm Stock Issue'}</span>
              </button>
            </div>
          )}

          {/* VIEW: QUICK TRANSFER */}
          {activeAction === 'TRANSFER' && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-blue-500/30 space-y-4">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-base pb-2 border-b border-white/10">
                <ArrowRightLeft className="w-5 h-5" />
                <span>{isRTL ? 'مناقلة داخلية بين المواقع' : 'Quick Inter-Bay Transfer'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'الصنف' : 'Item'}</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {isRTL ? i.nameAr || i.name : i.name}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-slate-400">
                  {isRTL ? 'الرصيد المتاح بالموقع المصدر:' : 'Available at source location:'}{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {availableQty} {activeItem?.unitOfMeasure}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'الموقع الهدف (إلى)' : 'Destination Bay'}</label>
                  <select
                    value={destLocationId}
                    onChange={(e) => setDestLocationId(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id} disabled={loc.id === selectedLocationId}>
                        {loc.code} - {loc.name} {loc.id === selectedLocationId ? '(المصدر)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'كمية المناقلة' : 'Transfer Quantity'}</label>
                  <input
                    type="number"
                    min="1"
                    max={availableQty}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-lg font-mono"
                  />
                </div>
              </div>

              <button
                disabled={isSubmitting || quantity > availableQty}
                onClick={handleQuickTransfer}
                className="w-full h-14 mt-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-lg shadow-blue-950 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                <span>{isRTL ? 'تأكيد المناقلة وترحيل الرصيد' : 'Execute Transfer'}</span>
              </button>
            </div>
          )}

          {/* VIEW: QUICK CYCLE COUNT */}
          {activeAction === 'COUNT' && (
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-purple-500/30 space-y-4">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-base pb-2 border-b border-white/10">
                <ClipboardList className="w-5 h-5" />
                <span>{isRTL ? 'تسجيل جرد فعلي ومطابقة فورية' : 'Quick Spot Cycle Count'}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{isRTL ? 'الصنف المفحوص' : 'Counted Item'}</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} - {isRTL ? i.nameAr || i.name : i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-white/10">
                  <div className="text-xs text-slate-400">{isRTL ? 'الرصيد الدفتري المتوقع' : 'Expected Balance'}</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                    {availableQty} {activeItem?.unitOfMeasure}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الكمية الفعلية المعدودة' : 'Counted Actual Quantity'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full h-12 px-3 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-lg font-mono"
                  />
                </div>
              </div>

              {/* Variance Indicator */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">{isRTL ? 'الفارق الناتج:' : 'Resulting Variance:'}</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    quantity - availableQty === 0
                      ? 'text-emerald-400'
                      : quantity - availableQty > 0
                      ? 'text-cyan-400'
                      : 'text-rose-400'
                  }`}
                >
                  {quantity - availableQty > 0 ? `+${quantity - availableQty}` : quantity - availableQty}{' '}
                  {activeItem?.unitOfMeasure}
                </span>
              </div>

              <button
                disabled={isSubmitting}
                onClick={handleQuickCount}
                className="w-full h-14 mt-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-base shadow-lg shadow-purple-950 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />}
                <span>{isRTL ? 'تأكيد واعتماد نتيجة الجرد' : 'Post Cycle Count Adjustment'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
