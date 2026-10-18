import React, { useState } from 'react';
import {
  Boxes,
  Layers,
  ArrowRightLeft,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Warehouse as WarehouseIcon,
  Plus,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Lock,
  Scale,
  Camera,
  Scan,
  Settings,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { InventoryConsistencyReport } from '../types';
import { StatusBadge } from './StatusBadge';
import { StorageD3HeatmapAndTimeline } from './StorageD3HeatmapAndTimeline';
import { StorageRawPlasticsAlertSystem } from './StorageRawPlasticsAlertSystem';
import { StorageQrBatchScannerModal } from './StorageQrBatchScannerModal';

export const StorageModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const {
    inventoryBalances,
    warehouses,
    locations,
    materials,
    transferStock,
    checkInventoryConsistency,
    reconcileMaterialStock,
    currentUser,
    setCurrentPage,
    setSelectedMaterialId,
    activeStorageCode,
  } = useFactory();

  const [searchTerm, setSearchTerm] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQrBatchScanner, setShowQrBatchScanner] = useState(false);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);
  const [consistencyReports, setConsistencyReports] = useState<InventoryConsistencyReport[]>([]);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedReconcileItem, setSelectedReconcileItem] = useState<InventoryConsistencyReport | null>(null);
  const [reconcileForm, setReconcileForm] = useState({
    locationId: '',
    targetKG: 0,
    targetBags: 0,
    reason: '',
    supervisorPin: '',
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    materialId: materials[0]?.id || '',
    fromLocationId: locations[0]?.id || '',
    toLocationId: locations[1]?.id || '',
    quantityKG: 1000,
    bulkBagsCount: 1,
    notes: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Transfer Submit
  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const fromLoc = locations.find((l) => l.id === transferForm.fromLocationId);
    const toLoc = locations.find((l) => l.id === transferForm.toLocationId);

    if (!fromLoc || !toLoc) {
      setErrorMessage(isRTL ? 'المواقع المحددة غير صحيحة' : 'Invalid locations');
      return;
    }

    const res = transferStock(
      transferForm.materialId,
      transferForm.fromLocationId,
      fromLoc.warehouseId,
      transferForm.toLocationId,
      toLoc.warehouseId,
      Number(transferForm.quantityKG),
      Number(transferForm.bulkBagsCount),
      transferForm.notes
    );

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? 'تم تحويل المخزون بين المواقع بنجاح وتسجيل حركة النقل برقم فريد'
          : 'Stock transferred between warehouse locations successfully.'
      );
      setShowTransferModal(false);
    } else {
      setErrorMessage(res.error || 'فشلت عملية التحويل');
    }
  };

  const handleRunConsistencyCheck = () => {
    const reports = checkInventoryConsistency();
    setConsistencyReports(reports);
    setShowConsistencyModal(true);
  };

  const handleOpenReconcile = (item: InventoryConsistencyReport) => {
    setSelectedReconcileItem(item);
    const firstLoc = locations.find((l) =>
      inventoryBalances.some((b) => b.materialId === item.materialId && b.locationId === l.id)
    ) || locations[0];

    setReconcileForm({
      locationId: firstLoc ? firstLoc.id : locations[0]?.id || '',
      targetKG: item.ledgerKG,
      targetBags: item.ledgerBags,
      reason: isRTL ? 'تسوية مطابقة دفتري مع رصيد حركات الدفاتر' : 'Reconciliation with ledger movements',
      supervisorPin: '',
    });
    setShowReconcileModal(true);
  };

  const handleReconcileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReconcileItem) return;

    const res = reconcileMaterialStock(
      selectedReconcileItem.materialId,
      reconcileForm.locationId,
      Number(reconcileForm.targetKG),
      Number(reconcileForm.targetBags),
      reconcileForm.reason,
      reconcileForm.supervisorPin
    );

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? `تم إجراء التسوية المعتمدة للصنف (${selectedReconcileItem.materialName}) وتوليد حركة تعديل دفتري معتمدة`
          : `Material (${selectedReconcileItem.materialName}) reconciled successfully with audit entry.`
      );
      setShowReconcileModal(false);
      // Refresh consistency reports
      const updated = checkInventoryConsistency();
      setConsistencyReports(updated);
    } else {
      setErrorMessage(res.error || 'فشلت عملية التسوية المعتمدة');
    }
  };

  // Filtered Inventory Matrix
  const filteredBalances = inventoryBalances.filter((b) => {
    const sTerm = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (b.materialName || '').toLowerCase().includes(sTerm) ||
      (b.materialCode || '').toLowerCase().includes(sTerm) ||
      (b.category || '').toLowerCase().includes(sTerm);
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-indigo-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
              WAREHOUSE INVENTORY & RACKS
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/40">
              {isRTL ? `كود المستند المعتمد: ${activeStorageCode}` : `Active Code: ${activeStorageCode}`}
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'إدارة المستودعات والأرصدة الحية' : 'Storage Locations & Live Balances'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'شاشة الخزن والمستودعات والأرصدة الحية' : 'Warehouse Storage & Live Inventory Matrix'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'الأرصدة المحسوبة ديناميكياً من سجل الحركات بدون إمكانية التعديل اليدوي العشوائي، وتتبع الشلايف.'
              : 'Derived dynamic stock balances, rack allocations, bulk bags tracking, and intra-warehouse transfers.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* QR Camera Batch Scanner Button */}
          <button
            onClick={() => setShowQrBatchScanner(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/60 cursor-pointer transition-all active:scale-95"
            title={isRTL ? 'مسح رمز QR للوجبة عبر كاميرا الجهاز وتحديث الموقع والحالة آلياً' : 'Scan material batch QR with device camera to auto-update status & location'}
          >
            <Camera className="w-4 h-4 text-cyan-200" />
            <span>{isRTL ? 'مسح QR وتحديث الوجبات' : 'Scan Batch QR & Update'}</span>
          </button>

          {/* Inventory Reconciler Engine Full Page */}
          <button
            onClick={() => setCurrentPage('inventory_reconciler')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 font-bold text-xs border border-indigo-500/40 shadow-lg cursor-pointer transition-all"
            title={isRTL ? 'فتح أداة المطابقة والتسوية الجردية الشاملة' : 'Open Inventory Reconciler Engine'}
          >
            <Scale className="w-4 h-4 text-indigo-400" />
            <span>{isRTL ? 'أداة المطابقة والتسوية' : 'Inventory Reconciler'}</span>
          </button>

          {/* Consistency Check Quick Modal Button */}
          <button
            onClick={handleRunConsistencyCheck}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/40 shadow-lg cursor-pointer transition-all"
            title={isRTL ? 'فحص المطابقة الدفترية السريع' : 'Quick Consistency Audit'}
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'فحص سريع' : 'Quick Audit'}</span>
          </button>

          {/* Configurable Codes Button */}
          <button
            onClick={() => setCurrentPage('system_admin')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-purple-300 font-bold text-xs border border-purple-500/40 shadow-lg cursor-pointer transition-all"
            title={isRTL ? 'إدارة الأكواد المخزنية (167 / 546) في Firestore' : 'Manage Configurable Inventory Codes in Firestore'}
          >
            <Settings className="w-4 h-4 text-purple-400" />
            <span>{isRTL ? 'تهيئة الأكواد (167/546)' : 'Inventory Codes'}</span>
          </button>

          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{isRTL ? 'نقل وتحويل بين المواقع' : 'Transfer Stock'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold">
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
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Automated Alert System for Raw Plastics Critical Safety Thresholds */}
      <StorageRawPlasticsAlertSystem
        onOpenTransferModal={(materialId) => {
          if (materialId) {
            setTransferForm((prev) => ({ ...prev, materialId }));
          }
          setShowTransferModal(true);
        }}
        onNavigateToProcurement={(materialId) => {
          if (materialId) {
            setSelectedMaterialId(materialId);
          }
          setCurrentPage('reports');
        }}
      />

      {/* Warehouse Occupancy Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {warehouses.map((wh) => {
          const whLocations = locations.filter((l) => l.warehouseId === wh.id);
          const currentKG = whLocations.reduce((sum, l) => sum + l.currentKG, 0);
          const totalBags = whLocations.reduce((sum, l) => sum + l.bulkBagsCount, 0);
          const pct = Math.min(100, Math.round((currentKG / wh.totalCapacityKG) * 100));

          return (
            <div
              key={wh.id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <WarehouseIcon className="w-5 h-5" />
                </div>
                <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-500/30">
                  {wh.code}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-white text-sm">{isRTL ? wh.nameAr : wh.nameEn}</h4>
                <p className="text-xs text-slate-400">{wh.zone} • {whLocations.length} {isRTL ? 'موقع تخزين' : 'Racks'}</p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{isRTL ? 'نسبة الإشغال:' : 'Occupancy:'}</span>
                  <span className="font-mono font-bold text-white">{pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>{(currentKG ?? 0).toLocaleString()} KG</span>
                  <span className="text-amber-400 font-bold">{totalBags} {isRTL ? 'شليف' : 'Bags'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-Time D3 Heatmap & 30-Day Historical Time-Series Visualization */}
      <StorageD3HeatmapAndTimeline
        onSelectLocationForTransfer={(locId) => {
          setTransferForm((prev) => ({ ...prev, fromLocationId: locId }));
          setShowTransferModal(true);
        }}
        onFilterByLocation={(locCode) => {
          setSearchTerm(locCode);
        }}
      />

      {/* Search & Filter */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isRTL
                ? 'بحث بالصنف، الكود، الفئة، الشلايف، المستودع...'
                : 'Search material, code, category, bulk bags...'
            }
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Dynamic Inventory Balances Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
              <tr>
                <th className="p-3.5 text-start">{isRTL ? 'المادة والصنف' : 'Material & Code'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'التصنيف' : 'Category'}</th>
                <th className="p-3.5 text-end text-emerald-400">{isRTL ? 'إجمالي الوارد (كغم)' : 'Total In'}</th>
                <th className="p-3.5 text-end text-rose-400">{isRTL ? 'إجمالي الصادر (كغم)' : 'Total Out'}</th>
                <th className="p-3.5 text-end">{isRTL ? 'المتاح للصرف (كغم)' : 'Available KG'}</th>
                <th className="p-3.5 text-end">{isRTL ? 'المحجوز (كغم)' : 'Reserved KG'}</th>
                <th className="p-3.5 text-end text-cyan-300 font-bold">{isRTL ? 'الرصيد الكلي (كغم)' : 'Total Balance'}</th>
                <th className="p-3.5 text-center text-amber-400 font-bold">{isRTL ? 'الشلايف (شليف)' : 'Bulk Bags'}</th>
                <th className="p-3.5 text-center">{isRTL ? 'حالة المخزون' : 'Stock Alert'}</th>
                <th className="p-3.5 text-center">{isRTL ? 'بطاقة الصنف' : 'Card'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBalances.map((b) => (
                <tr key={b.materialId} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 text-white">
                    <div className="font-bold text-sm">{b.materialName}</div>
                    <div className="text-[10px] font-mono text-slate-400">{b.materialCode}</div>
                  </td>
                  <td className="p-3.5 text-slate-300">{b.category}</td>
                  <td className="p-3.5 text-end font-mono text-emerald-400 font-bold">
                    +{(b.totalInKG ?? 0).toLocaleString()} KG
                  </td>
                  <td className="p-3.5 text-end font-mono text-rose-400 font-bold">
                    -{(b.totalOutKG ?? 0).toLocaleString()} KG
                  </td>
                  <td className="p-3.5 text-end font-mono font-bold text-slate-200">
                    {(b.availableKG ?? 0).toLocaleString()} KG
                  </td>
                  <td className="p-3.5 text-end font-mono text-slate-400">
                    {(b.reservedKG ?? 0).toLocaleString()} KG
                  </td>
                  <td className="p-3.5 text-end font-mono font-black text-cyan-300 text-sm">
                    {(b.totalBalanceKG ?? 0).toLocaleString()} KG
                  </td>
                  <td className="p-3.5 text-center font-mono font-black text-amber-400 text-sm">
                    {b.bulkBagsCount}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        b.status === 'LOW'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse'
                          : b.status === 'EXCESS'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => {
                        setSelectedMaterialId(b.materialId);
                        setCurrentPage('material_card');
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-[11px] border border-slate-700 hover:border-cyan-400"
                    >
                      {isRTL ? 'كشف الصنف' : 'Card'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Stock Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-2xl bg-slate-900 border border-indigo-500/50 shadow-2xl p-6 space-y-5 text-start">
            <div className="flex items-center gap-3 text-indigo-400">
              <ArrowRightLeft className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-black text-white">
                  {isRTL ? 'نقل وتحويل المواد بين مواقع المستودع' : 'Transfer Stock Between Locations'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isRTL ? 'حركة خزن داخلية مع الحفاظ على توازن الأرصدة' : 'Intra-warehouse location movement'}
                </p>
              </div>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {t('material')} *
                </label>
                <select
                  value={transferForm.materialId}
                  onChange={(e) => setTransferForm({ ...transferForm, materialId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                  required
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {isRTL ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'من موقع (المصدر)' : 'From Location'} *
                  </label>
                  <select
                    value={transferForm.fromLocationId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromLocationId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.code} ({loc.warehouseNameAr})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'إلى موقع (الوجهة)' : 'To Location'} *
                  </label>
                  <select
                    value={transferForm.toLocationId}
                    onChange={(e) => setTransferForm({ ...transferForm, toLocationId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                    required
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.code} ({loc.warehouseNameAr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="block text-xs font-bold text-cyan-300 mb-1">
                    {isRTL ? 'الكمية المنقولة (كغم)' : 'Quantity (KG)'} *
                  </label>
                  <input
                    type="number"
                    value={transferForm.quantityKG}
                    onChange={(e) => setTransferForm({ ...transferForm, quantityKG: Number(e.target.value) })}
                    min="1"
                    className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-lg font-bold outline-none"
                    required
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40">
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    {isRTL ? 'عدد الشلايف' : 'Bulk Bags'} *
                  </label>
                  <input
                    type="number"
                    value={transferForm.bulkBagsCount}
                    onChange={(e) => setTransferForm({ ...transferForm, bulkBagsCount: Number(e.target.value) })}
                    min="1"
                    className="w-full p-2 rounded-lg bg-slate-900 border border-amber-500/50 text-amber-300 font-mono text-lg font-bold outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{t('notes')}</label>
                <input
                  type="text"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  placeholder={isRTL ? 'سبب النقل وإعادة التنظيم...' : 'Reason for transfer...'}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
                >
                  {isRTL ? 'تنفيذ التحويل وتحديث الأرصدة' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Automated Consistency Check Modal (Section 6 & 40) */}
      {showConsistencyModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-4xl w-full rounded-2xl bg-slate-900 border border-cyan-500/50 shadow-2xl p-6 space-y-5 text-start max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3 text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-black text-white">
                    {isRTL ? 'تقرير الفحص والمطابقة الدفترية الآلية للأرصدة' : 'Automated Ledger vs Stored Consistency Audit'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? 'مقارنة دقيقة بين رصيد حركة الدفاتر التراكمي ورصيد المخزن الفعلي لمنع أي تباين'
                      : 'Real-time mathematical audit comparing calculated ledger balance with stored inventory.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConsistencyModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Consistency Overview Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">{isRTL ? 'إجمالي المواد المفحوصة:' : 'Materials Checked:'}</span>
                <span className="font-mono font-bold text-white text-sm">{consistencyReports.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                <span className="text-xs text-emerald-300">{isRTL ? 'مطابقة 100% (متوازنة):' : 'Matches (Balanced):'}</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {consistencyReports.filter((r) => r.isConsistent).length}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between">
                <span className="text-xs text-rose-300">{isRTL ? 'فوارق بحاجة لتسوية:' : 'Discrepancies:'}</span>
                <span className="font-mono font-black text-rose-400 text-sm">
                  {consistencyReports.filter((r) => !r.isConsistent).length}
                </span>
              </div>
            </div>

            {/* Reports Table Scrollable */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-xs text-start">
                <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'المادة / الكود' : 'Material'}</th>
                    <th className="p-3 text-end">{isRTL ? 'رصيد الدفاتر (كغم)' : 'Ledger Balance'}</th>
                    <th className="p-3 text-end">{isRTL ? 'رصيد المخزن (كغم)' : 'Stored Balance'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الفارق (كغم)' : 'Delta (KG)'}</th>
                    <th className="p-3 text-center">{isRTL ? 'شلايف (دفتر/مخزن)' : 'Bags (Ledger/Store)'}</th>
                    <th className="p-3 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-center">{isRTL ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {consistencyReports.map((report) => (
                    <tr
                      key={report.materialId}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        !report.isConsistent ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="p-3 font-sans">
                        <div className="font-bold text-white text-xs">{report.materialName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{report.materialCode}</div>
                      </td>
                      <td className="p-3 text-end text-cyan-300 font-bold">
                        {(report.ledgerKG ?? 0).toLocaleString()} KG
                      </td>
                      <td className="p-3 text-end text-slate-200 font-bold">
                        {(report.storedKG ?? 0).toLocaleString()} KG
                      </td>
                      <td
                        className={`p-3 text-end font-bold ${
                          (report.diffKG ?? 0) === 0 ? 'text-slate-400' : 'text-rose-400 font-black'
                        }`}
                      >
                        {(report.diffKG ?? 0) > 0 ? `+${(report.diffKG ?? 0).toLocaleString()}` : (report.diffKG ?? 0).toLocaleString()} KG
                      </td>
                      <td className="p-3 text-center text-amber-300">
                        {report.ledgerBags} / {report.storedBags}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <StatusBadge status={report.status} size="xs" />
                      </td>
                      <td className="p-3 text-center font-sans">
                        {!report.isConsistent ? (
                          <button
                            onClick={() => handleOpenReconcile(report)}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shadow transition-colors"
                          >
                            {isRTL ? 'تسوية معتمدة' : 'Reconcile'}
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-[11px] font-bold">✓ {isRTL ? 'سليم' : 'OK'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                {isRTL ? 'محرك الحسابات الموحد: FactoryContext Dynamic Balances' : 'Engine: Dynamic Factory Balance Map'}
              </span>
              <button
                onClick={() => setShowConsistencyModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Supervisor Reconciliation Modal (Section 6 & 40) */}
      {showReconcileModal && selectedReconcileItem && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-rose-500/60 shadow-2xl p-6 space-y-4 text-start">
            <div className="flex items-center gap-3 text-rose-400">
              <Scale className="w-6 h-6" />
              <div>
                <h3 className="text-base font-black text-white">
                  {isRTL ? 'تسوية جردية معتمدة برقم مستند وقيد تعديل' : 'Authorized Stock Reconciliation'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedReconcileItem.materialName} ({selectedReconcileItem.materialCode})
                </p>
              </div>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'الرصيد المحسوب بالدفاتر:' : 'Calculated Ledger:'}</span>
                  <span className="text-cyan-300 font-bold">{(selectedReconcileItem.ledgerKG ?? 0).toLocaleString()} KG ({selectedReconcileItem.ledgerBags ?? 0} شليف)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'رصيد المخزن الحالي:' : 'Current Stored:'}</span>
                  <span className="text-slate-200 font-bold">{(selectedReconcileItem.storedKG ?? 0).toLocaleString()} KG ({selectedReconcileItem.storedBags ?? 0} شليف)</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">{isRTL ? 'الفارق للتسوية:' : 'Discrepancy to Reconcile:'}</span>
                  <span className="text-rose-400 font-black">{(selectedReconcileItem.diffKG ?? 0).toLocaleString()} KG</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'الموقع / الرف المستهدف للتسوية' : 'Target Location / Rack'} *
                </label>
                <select
                  value={reconcileForm.locationId}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, locationId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.warehouseNameAr} - {loc.code} ({loc.nameAr})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isRTL ? 'الرصيد المستهدف (كغم)' : 'Target KG'} *
                  </label>
                  <input
                    type="number"
                    value={reconcileForm.targetKG}
                    onChange={(e) => setReconcileForm({ ...reconcileForm, targetKG: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isRTL ? 'الشلايف المستهدفة' : 'Target Bags'} *
                  </label>
                  <input
                    type="number"
                    value={reconcileForm.targetBags}
                    onChange={(e) => setReconcileForm({ ...reconcileForm, targetBags: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'سبب التسوية المعتمد (إلزامي)' : 'Authorized Reason'} *
                </label>
                <textarea
                  value={reconcileForm.reason}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, reason: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none resize-none"
                  placeholder={isRTL ? 'بيان أسباب التعديل الجردي ومحضر الجرد المعتمد...' : 'Reason for adjustment...'}
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40">
                <label className="block font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>{isRTL ? 'رمز المشرف المعتمد (PIN: 1234 أو 9999)' : 'Supervisor PIN (1234 or 9999)'} *</span>
                </label>
                <input
                  type="password"
                  value={reconcileForm.supervisorPin}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, supervisorPin: e.target.value })}
                  placeholder="••••"
                  className="w-full p-2 rounded-lg bg-slate-900 border border-rose-500/60 text-white font-mono text-center tracking-widest text-lg font-bold outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg"
                >
                  {isRTL ? 'اعتماد التسوية وتوليد حركة ADJUSTMENT' : 'Authorize & Execute ADJUSTMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Storage Module Device Camera QR Batch Scanner Modal */}
      <StorageQrBatchScannerModal
        isOpen={showQrBatchScanner}
        onClose={() => setShowQrBatchScanner(false)}
        onBatchUpdated={(log) => {
          setSuccessMessage(
            isRTL
              ? `✓ تم تحديث الوجبة (${log.batchId}) ونقلها إلى [${log.toLocation}] بحالة [${log.newStatus}] بنجاح!`
              : `✓ Batch (${log.batchId}) relocated to [${log.toLocation}] with status [${log.newStatus}] successfully!`
          );
          setTimeout(() => setSuccessMessage(null), 5000);
        }}
      />
    </div>
  );
};
