import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Barcode,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  SlidersHorizontal,
  Printer,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  FileText,
  DollarSign,
  TrendingUp,
  Tag,
  Scale,
  Activity,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { WarehouseEngineService } from '../services/warehouseEngineService';
import { ItemMaster } from '../types/warehouse';
import { UniversalPrintableDocumentModal, PrintableDocData } from './UniversalPrintableDocumentModal';

interface ItemDetailsViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  onQuickAction?: (action: 'RECEIVE' | 'ISSUE' | 'TRANSFER' | 'ADJUST', item: ItemMaster) => void;
}

type DetailsTab =
  | 'OVERVIEW'
  | 'STOCK'
  | 'LOCATIONS'
  | 'BATCHES'
  | 'SERIALS'
  | 'TRANSACTIONS'
  | 'PURCHASING'
  | 'DOCUMENTS'
  | 'AUDIT';

export const ItemDetailsViewModal: React.FC<ItemDetailsViewModalProps> = ({
  isOpen,
  onClose,
  itemId,
  onQuickAction,
}) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const orgId = currentOrganization.id;

  const [activeTab, setActiveTab] = useState<DetailsTab>('OVERVIEW');
  const [printDocData, setPrintDocData] = useState<PrintableDocData | null>(null);

  // Master Item Data
  const items = useMemo(() => WarehouseEngineService.getItems(orgId), [orgId]);
  const item = items.find((i) => i.id === itemId || i.itemCode === itemId) || items[0];

  // Balances
  const balances = useMemo(() => WarehouseEngineService.computeInventoryBalances(orgId), [orgId]);
  const itemBalances = balances.filter((b) => b.itemId === item?.id || b.itemCode === item?.itemCode);
  const totalStock = useMemo(() => WarehouseEngineService.getItemTotalStock(orgId, item?.id || ''), [orgId, item]);

  // Ledger Movements
  const movements = useMemo(
    () => (item ? WarehouseEngineService.getItemStockMovement(orgId, item.id) : []),
    [orgId, item]
  );

  if (!isOpen || !item) return null;

  const unitCost = 2.45; // Simulated unit acquisition cost
  const stockValue = totalStock.quantity * unitCost;

  // Determine low-stock status
  const isOutOfStock = totalStock.quantity <= 0;
  const isLowStock = !isOutOfStock && totalStock.quantity <= (item.reorderPoint || 200);
  const isCriticalStock = !isOutOfStock && totalStock.quantity <= (item.minimumStock || 100);

  // Print Item Card Handler
  const handlePrintItemCard = () => {
    const docData: PrintableDocData = {
      documentType: 'MATERIAL_CARD',
      documentNumber: `CARD-${item.itemCode}`,
      date: new Date().toISOString().split('T')[0],
      warehouseName: 'All Active Facilities',
      performedBy: 'Head Storekeeper',
      reason: 'Material Subledger Statement Card',
      lines: movements.slice(0, 25).map((m) => ({
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        locationCode: m.locationCode,
        quantity: Math.abs(m.deltaQuantity),
        unit: m.unit,
        weightKG: Math.abs(m.deltaWeightKG),
        notes: `${m.transactionType} - ${m.reason || ''}`,
      })),
      notes: `Current Available Stock: ${totalStock.availableQuantity} ${item.unitOfMeasure}. Minimum Threshold: ${item.minimumStock || 100} ${item.unitOfMeasure}.`,
    };
    setPrintDocData(docData);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-[#0f1118] border border-white/15 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Card */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-[#121622] to-cyan-950/40 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
              <Boxes className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {item.itemCode}
                </span>
                <span className="text-xs text-slate-400">{item.category}</span>
                {isOutOfStock ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {isRTL ? 'نفد المخزون' : 'Out of Stock'}
                  </span>
                ) : isCriticalStock ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {isRTL ? 'مخزون حرج' : 'Critical Stock'}
                  </span>
                ) : isLowStock ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {isRTL ? 'تحت حد الطلب' : 'Low Stock'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {isRTL ? 'متوفر' : 'In Stock'}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                {isRTL ? item.nameAr || item.name : item.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintItemCard}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'طباعة بطاقة الصنف' : 'Print Card'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#0a0c12] border-b border-white/10 text-xs">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block">{isRTL ? 'الرصيد الفعلي الإجمالي' : 'Physical Total'}</span>
            <span className="text-lg font-mono font-black text-white mt-0.5 block">
              {totalStock.quantity.toLocaleString()} {item.unitOfMeasure}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block">{isRTL ? 'الرصيد المتاح للصرف' : 'Available Stock'}</span>
            <span className="text-lg font-mono font-black text-emerald-400 mt-0.5 block">
              {totalStock.availableQuantity.toLocaleString()} {item.unitOfMeasure}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block">{isRTL ? 'الرصيد المحجوز' : 'Reserved Stock'}</span>
            <span className="text-lg font-mono font-black text-amber-400 mt-0.5 block">
              {totalStock.reservedQuantity.toLocaleString()} {item.unitOfMeasure}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-slate-400 block">{isRTL ? 'القيمة التقديرية' : 'Estimated Value'}</span>
            <span className="text-lg font-mono font-black text-cyan-400 mt-0.5 block">
              ${stockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-[#0d0f17] px-4 overflow-x-auto">
          {[
            { id: 'OVERVIEW', labelAr: 'نظرة عامة', labelEn: 'Overview' },
            { id: 'LOCATIONS', labelAr: 'المستودعات والرفوف', labelEn: 'Locations' },
            { id: 'TRANSACTIONS', labelAr: 'حركات الدفتر الفرعي', labelEn: 'Ledger Movements' },
            { id: 'BATCHES', labelAr: 'التشغيلات والصلاحية', labelEn: 'Batches & Expiry' },
            { id: 'PURCHASING', labelAr: 'الموردين والشراء', labelEn: 'Procurement' },
            { id: 'AUDIT', labelAr: 'سجل التدقيق', labelEn: 'Audit Trail' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DetailsTab)}
              className={`px-4 py-3 text-xs font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    {isRTL ? 'مواصفات الصنف والوحدات' : 'Item Specifications'}
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'كود الصنف الدفتري:' : 'Item Code:'}</span>
                      <span className="font-mono font-bold text-white">{item.itemCode}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'وحدة القياس الأساسية:' : 'Unit of Measure:'}</span>
                      <span className="font-bold text-white">{item.unitOfMeasure}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'الوزن الافتراضي:' : 'Default Unit Weight:'}</span>
                      <span className="font-mono text-white">{item.defaultWeight || 1} KG</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'تتبع التشغيلات (Batch):' : 'Batch Tracking:'}</span>
                      <span className={item.trackBatch ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {item.trackBatch ? (isRTL ? 'مفعّل' : 'Active') : isRTL ? 'معطل' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">{isRTL ? 'تتبع الأرقام التسلسلية:' : 'Serial Tracking:'}</span>
                      <span className={item.trackSerial ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {item.trackSerial ? (isRTL ? 'مفعّل' : 'Active') : isRTL ? 'معطل' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    {isRTL ? 'حدود الأمان وإعادة الطلب' : 'Safety Stock & Thresholds'}
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'الحد الأدنى للأمان:' : 'Minimum Safety Stock:'}</span>
                      <span className="font-mono font-bold text-rose-400">
                        {item.minimumStock || 100} {item.unitOfMeasure}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'نقطة إعادة الطلب:' : 'Reorder Point:'}</span>
                      <span className="font-mono font-bold text-amber-400">
                        {item.reorderPoint || 200} {item.unitOfMeasure}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-slate-400">{isRTL ? 'الحد الأقصى لسعة التخزين:' : 'Maximum Stock Cap:'}</span>
                      <span className="font-mono font-bold text-white">
                        {item.maximumStock || 10000} {item.unitOfMeasure}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">{isRTL ? 'مستوى المخزون الحالي:' : 'Current Stock Health:'}</span>
                      <span className="font-bold text-cyan-300">
                        {Math.round(((totalStock.quantity || 1) / (item.maximumStock || 10000)) * 100)}% of Max
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer Buttons */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-400 me-2">{isRTL ? 'إجراءات سريعة:' : 'Quick Actions:'}</span>
                {onQuickAction && (
                  <>
                    <button
                      onClick={() => onQuickAction('RECEIVE', item)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowDownLeft className="w-4 h-4" />
                      <span>{isRTL ? 'استلام وارد' : 'Receive'}</span>
                    </button>
                    <button
                      onClick={() => onQuickAction('ISSUE', item)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>{isRTL ? 'صرف منصرف' : 'Issue'}</span>
                    </button>
                    <button
                      onClick={() => onQuickAction('TRANSFER', item)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>{isRTL ? 'مناقلة' : 'Transfer'}</span>
                    </button>
                    <button
                      onClick={() => onQuickAction('ADJUST', item)}
                      className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>{isRTL ? 'تسوية' : 'Adjust'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LOCATIONS */}
          {activeTab === 'LOCATIONS' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isRTL ? 'توزيع الأرصدة عبر المستودعات والأرفف' : 'Stock Balances Across Facilities & Bays'}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 font-bold border-b border-white/10">
                      <th className="p-3 text-start">{isRTL ? 'المستودع' : 'Warehouse'}</th>
                      <th className="p-3 text-start">{isRTL ? 'الموقع / الرف' : 'Location Code'}</th>
                      <th className="p-3 text-end">{isRTL ? 'الرصيد الإجمالي' : 'Total Balance'}</th>
                      <th className="p-3 text-end">{isRTL ? 'المتاح للصرف' : 'Available'}</th>
                      <th className="p-3 text-end">{isRTL ? 'المحجوز' : 'Reserved'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {itemBalances.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          {isRTL ? 'لا توجد أرصدة مسجلة في أي موقع حالياً' : 'No recorded balances in any location.'}
                        </td>
                      </tr>
                    ) : (
                      itemBalances.map((bal, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-semibold text-white">{bal.warehouseName}</td>
                          <td className="p-3 font-mono text-cyan-400">{bal.locationCode}</td>
                          <td className="p-3 text-end font-mono font-bold text-white">
                            {bal.quantity.toLocaleString()} {bal.unit}
                          </td>
                          <td className="p-3 text-end font-mono font-bold text-emerald-400">
                            {bal.availableQuantity.toLocaleString()} {bal.unit}
                          </td>
                          <td className="p-3 text-end font-mono text-amber-400">
                            {bal.reservedQuantity.toLocaleString()} {bal.unit}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LEDGER MOVEMENTS */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isRTL ? 'سجل الحركات الدفترية والرصيد التراكمي' : 'Immutable Subledger Running Balances'}
                </h4>
                <span className="text-xs font-mono text-slate-500">{movements.length} transactions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="bg-white/5 text-slate-400 font-bold border-b border-white/10">
                      <th className="p-3 text-start">{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th className="p-3 text-start">{isRTL ? 'المستند' : 'Document #'}</th>
                      <th className="p-3 text-start">{isRTL ? 'نوع الحركة' : 'Type'}</th>
                      <th className="p-3 text-start">{isRTL ? 'الموقع' : 'Location'}</th>
                      <th className="p-3 text-end">{isRTL ? 'الكمية' : 'Delta'}</th>
                      <th className="p-3 text-end">{isRTL ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {movements.slice(0, 30).map((m, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 text-slate-400">{m.timestamp?.split('T')[0] || '-'}</td>
                        <td className="p-3 font-bold text-white">{m.documentId}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.deltaQuantity > 0
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {m.transactionType}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{m.locationCode || '-'}</td>
                        <td
                          className={`p-3 text-end font-bold ${
                            m.deltaQuantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {m.deltaQuantity > 0 ? `+${m.deltaQuantity}` : m.deltaQuantity} {m.unit}
                        </td>
                        <td className="p-3 text-end font-bold text-cyan-300">
                          {m.runningBalanceQuantity} {m.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: BATCHES */}
          {activeTab === 'BATCHES' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isRTL ? 'تشغيلات الإنتاج وتواريخ الصلاحية' : 'Lot Numbers & Shelf Life'}
              </h4>
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                {item.trackBatch
                  ? isRTL
                    ? 'يتم تتبع كافة التشغيلات واللوتات المسجلة مع إمكانية طباعة بطاقات الشليف والباركود لكل دفعة.'
                    : 'Active batch lot tracking enabled. All lots linked to goods receipts and quality inspections.'
                  : isRTL
                  ? 'هذا الصنف مضبوط كصنف قياسي لا يتطلب تتبع تشغيلات منفصل.'
                  : 'This item is configured as standard stock and does not require individual batch numbers.'}
              </div>
            </div>
          )}

          {/* TAB 5: PURCHASING */}
          {activeTab === 'PURCHASING' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isRTL ? 'الموردين المعتمدين وسجل أوامر الشراء' : 'Approved Vendors & Procurement History'}
              </h4>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">Gulf Petrochemicals Industrial Corp</span>
                  <span className="text-slate-400">Lead time: 3 days • Rating: 98% Delivery SLA</span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                  {isRTL ? 'مورد معتمد' : 'Primary Vendor'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {isRTL ? 'سجل تدقيق التعديلات' : 'Audit Trail'}
              </h4>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 flex items-center justify-between">
                <span>Item Master SKU #{item.itemCode} verified and active</span>
                <span className="font-mono text-[10px] text-slate-500">SYSTEM BOT • Immutable</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Universal Document Print Modal */}
      {printDocData && (
        <UniversalPrintableDocumentModal
          isOpen={true}
          onClose={() => setPrintDocData(null)}
          data={printDocData}
        />
      )}
    </div>
  );
};
