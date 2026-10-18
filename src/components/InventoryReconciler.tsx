import React, { useState, useMemo } from 'react';
import {
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Download,
  ArrowRightLeft,
  Boxes,
  Layers,
  FileSpreadsheet,
  Lock,
  ChevronDown,
  ChevronUp,
  Eye,
  Flame,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingDown,
  Info,
  Wand2,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { StatusBadge } from './StatusBadge';
import {
  calculateMaterialReconciliation,
  performAutomatedInventoryReconciliation,
  exportReconciliationCSV,
} from '../services/inventoryReconciler';
import { MaterialReconciliationItem } from '../types';

export const InventoryReconciler: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const {
    materials,
    inventoryMovements,
    inventoryBalances,
    locations,
    reconcileMaterialStock,
    autoFixDiscrepancies,
    setCurrentPage,
    setSelectedMaterialId,
  } = useFactory();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'DISCREPANCIES_ONLY' | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Multi-selection for Auto-Fix
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [showAutoFixModal, setShowAutoFixModal] = useState(false);
  const [autoFixTargetIds, setAutoFixTargetIds] = useState<string[]>([]);
  const [autoFixSupervisorPin, setAutoFixSupervisorPin] = useState('1234');
  const [autoFixReason, setAutoFixReason] = useState('');
  const [isAutoFixing, setIsAutoFixing] = useState(false);

  // Reconciliation Modal state
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MaterialReconciliationItem | null>(null);
  const [reconcileForm, setReconcileForm] = useState({
    locationId: '',
    targetKG: 0,
    targetBags: 0,
    reason: '',
    supervisorPin: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute live reconciliation summary
  const summary = useMemo(() => {
    // refreshTrigger used as a dependency to force re-computation when triggered
    return performAutomatedInventoryReconciliation(materials, inventoryMovements, inventoryBalances);
  }, [materials, inventoryMovements, inventoryBalances, refreshTrigger]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(materials.map((m) => m.category));
    return Array.from(set);
  }, [materials]);

  // Filter items based on selected criteria
  const filteredItems = useMemo(() => {
    return summary.allReportItems.filter((item) => {
      const matchesSearch =
        item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMode =
        filterMode === 'ALL' || (filterMode === 'DISCREPANCIES_ONLY' && item.hasDiscrepancy);

      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;

      return matchesSearch && matchesMode && matchesCategory;
    });
  }, [summary, searchTerm, filterMode, categoryFilter]);

  // Open Reconcile Modal
  const handleOpenReconcile = (item: MaterialReconciliationItem) => {
    setSelectedItem(item);
    // Find first location containing this material or default to first location
    const existingLoc = locations.find((l) =>
      inventoryBalances.some((b) => b.materialId === item.materialId && b.locationId === l.id)
    ) || locations[0];

    // Target balance should align with formula calculated ledger balance
    setReconcileForm({
      locationId: existingLoc ? existingLoc.id : locations[0]?.id || '',
      targetKG: item.formulaCalculatedKG,
      targetBags: item.formulaCalculatedBags,
      reason: isRTL
        ? `تسوية جردية آلية لمعادلة (الافتتاحي + الوارد + المرتجع) - (المنصرف + التالف + الثرم)`
        : `Automated reconciler adjustment for (Opening + Receipts + Returns) - (Issues + Damage + Shredding)`,
      supervisorPin: '',
    });
    setShowReconcileModal(true);
  };

  // Handle Reconcile Submit
  const handleReconcileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const res = reconcileMaterialStock(
      selectedItem.materialId,
      reconcileForm.locationId,
      Number(reconcileForm.targetKG),
      Number(reconcileForm.targetBags),
      reconcileForm.reason,
      reconcileForm.supervisorPin
    );

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? `تم اعتماد التسوية بنجاح للصنف (${selectedItem.materialName}) وتوليد حركة دفتري ADJUSTMENT`
          : `Reconciliation successful for (${selectedItem.materialName}) with authorized ADJUSTMENT entry.`
      );
      setShowReconcileModal(false);
      setRefreshTrigger((prev) => prev + 1);
    } else {
      setErrorMessage(res.error || 'فشلت عملية التسوية المعتمدة');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvContent = exportReconciliationCSV(summary);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `alkarwan_inventory_reconciliation_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Discrepant item IDs among filtered list
  const discrepantItemIds = useMemo(() => {
    return filteredItems.filter((i) => i.hasDiscrepancy).map((i) => i.materialId);
  }, [filteredItems]);

  // Toggle selection for a single material
  const handleToggleSelect = (materialId: string) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(materialId) ? prev.filter((id) => id !== materialId) : [...prev, materialId]
    );
  };

  // Select all / Deselect all discrepant items
  const handleSelectAllDiscrepant = () => {
    if (selectedMaterialIds.length === discrepantItemIds.length && discrepantItemIds.length > 0) {
      setSelectedMaterialIds([]);
    } else {
      setSelectedMaterialIds(discrepantItemIds);
    }
  };

  // Open auto-fix modal for specific target materials or selected/all
  const handleOpenAutoFix = (specificIds?: string[]) => {
    const ids = specificIds && specificIds.length > 0
      ? specificIds
      : selectedMaterialIds.length > 0
      ? selectedMaterialIds
      : discrepantItemIds;

    if (ids.length === 0) {
      setErrorMessage(isRTL ? 'لا توجد أصناف بها فوارق محددة لتسويتها' : 'No items with discrepancies to fix');
      return;
    }

    setAutoFixTargetIds(ids);
    setAutoFixReason(
      isRTL
        ? `تسوية آلية معتمدة لمطابقة الفوارق حسب سجل الحركات ومعادلة المخزون الدفترية`
        : `Automated ledger adjustment aligning stored balances with theoretical formula equation`
    );
    setAutoFixSupervisorPin('1234');
    setShowAutoFixModal(true);
  };

  // Submit auto-fix
  const handleAutoFixSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoFixTargetIds.length === 0) return;

    setIsAutoFixing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = autoFixDiscrepancies(autoFixTargetIds, autoFixReason, autoFixSupervisorPin);
      if (res.success) {
        setSuccessMessage(
          isRTL
            ? `تمت التسوية الدفترية الآلية بنجاح لعدد (${res.fixedCount}) مادة متأثرة، وتوليد قيود تسوية رسمية ADJ-AUTO بنجاح.`
            : `Successfully auto-fixed discrepancies for ${res.fixedCount} materials with generated adjustment records.`
        );
        setSelectedMaterialIds([]);
        setShowAutoFixModal(false);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setErrorMessage(res.error || (isRTL ? 'فشلت عملية التسوية الآلية' : 'Auto-fix failed'));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error during auto-fix');
    } finally {
      setIsAutoFixing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto text-start">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/50 border border-indigo-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-400" />
              <span>INVENTORY RECONCILER ENGINE</span>
            </span>
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/30">
              AUDIT v2.4
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'محرك فحص المطابقة الدفترية الآلية' : 'Automated Consistency Check'}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-indigo-400 shrink-0" />
            <span>
              {isRTL ? 'أداة المطابقة والتسوية الجردية الآلية' : 'Automated Inventory Reconciler'}
            </span>
          </h2>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-indigo-500/20 max-w-3xl">
            <div className="text-xs font-mono text-indigo-300 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {isRTL ? 'معادلة الفحص الدفتري المستهدفة:' : 'Target Ledger Consistency Equation:'}
              </span>
            </div>
            <p className="text-xs font-mono font-bold text-white mt-1">
              (Opening + Receipts + Returns) - (Issues + Damage + Shredding) == Stored Inventory Balance
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isRTL
                ? '(الافتتاحي + الوارد + المرتجع) - (المنصرف + تالف إنتاج + مدخلات الثرم) = رصيد المخزن الفعلي'
                : 'Identifies discrepancies between mathematical ledger flow and active location balances.'}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
            title={isRTL ? 'إعادة تشغيل الفحص الآلي' : 'Refresh Audit'}
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'تحديث الفحص' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 hover:border-slate-500 transition-all cursor-pointer"
            title={isRTL ? 'تصدير تقرير المطابقة إلى Excel / CSV' : 'Export CSV'}
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('movement_ledger')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{isRTL ? 'دفتر الحركات العام' : 'Movement Ledger'}</span>
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

      {/* Discrepancy Alert Banner */}
      {summary.discrepanciesCount > 0 ? (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                {isRTL
                  ? `تنبيه: تم رصد فوارق مطابقة دفتري لعدد (${summary.discrepanciesCount}) صنف`
                  : `Alert: Discrepancies detected for (${summary.discrepanciesCount}) materials`}
              </h4>
              <p className="text-xs text-rose-300 mt-0.5">
                {isRTL
                  ? 'المعادلة: (الافتتاحي + الوارد + المرتجع) - (المنصرف + التالف + الثرم) لا تطابق رصيد المخزن المخزن الحالي.'
                  : 'Equation (Opening + Receipts + Returns) - (Issues + Damage + Shredding) does not equal Stored Inventory.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterMode('DISCREPANCIES_ONLY')}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-lg"
          >
            {isRTL ? 'عرض الفوارق فقط' : 'Filter Discrepancies Only'}
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">
              {isRTL ? 'جميع الأصناف متطابقة دفترياً بنسبة 100%' : 'All Materials 100% Mathematically Balanced'}
            </h4>
            <p className="text-xs text-emerald-300">
              {isRTL
                ? 'رصيد المخزن يطابق ناتج حركة الدفاتر (افتتاحي + وارد + مرتجع) - (منصرف + تالف + ثرم) بدقة.'
                : 'Stored balances match the theoretical formula exactly across all active materials.'}
            </p>
          </div>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Materials */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>{isRTL ? 'إجمالي الأصناف' : 'Total Materials'}</span>
            <Boxes className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">{summary.totalMaterials}</div>
          <div className="text-[10px] text-slate-500 font-mono">{summary.auditTimestamp}</div>
        </div>

        {/* Discrepancies */}
        <div
          className={`p-4 rounded-2xl border space-y-1 ${
            summary.discrepanciesCount > 0
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="text-xs font-bold flex items-center justify-between">
            <span>{isRTL ? 'الفوارق المرصودة' : 'Discrepancies'}</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black font-mono">
            {summary.discrepanciesCount} {isRTL ? 'صنف' : 'Items'}
          </div>
          <div className="text-[10px] font-mono">
            {summary.balancedCount} {isRTL ? 'مطابق' : 'Balanced'}
          </div>
        </div>

        {/* Total Inflows (Opening + Receipts + Returns) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-emerald-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'إجمالي الوارد (Inflow)' : 'Total Inflow'}</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-300">
            {summary.totalInflowsKG.toLocaleString()} KG
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            افتتاحي + وارد + مرتجع
          </div>
        </div>

        {/* Total Outflows (Issues + Damage + Shredding) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-rose-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'إجمالي المنصرف (Outflow)' : 'Total Outflow'}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-black font-mono text-rose-300">
            {summary.totalOutflowsKG.toLocaleString()} KG
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            صادر + تالف + ثرم
          </div>
        </div>

        {/* Theoretical Balance */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-cyan-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'الرصيد النظري للمعادلة' : 'Formula Balance'}</span>
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-black font-mono text-cyan-300">
            {summary.totalTheoreticalKG.toLocaleString()} KG
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Inflow - Outflow
          </div>
        </div>

        {/* Stored Balance */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-xs text-indigo-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'رصيد المخزن الفعلي' : 'Stored Balance'}</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-black font-mono text-white">
            {summary.totalStoredKG.toLocaleString()} KG
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            {isRTL ? 'الفارق الإجمالي:' : 'Net Delta:'} {summary.netDiscrepancyKG > 0 ? `+${summary.netDiscrepancyKG}` : summary.netDiscrepancyKG} KG
          </div>
        </div>
      </div>

      {/* Filters and Control Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterMode === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'جميع المواد' : 'All Materials'} ({summary.allReportItems.length})
            </button>
            <button
              onClick={() => setFilterMode('DISCREPANCIES_ONLY')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                filterMode === 'DISCREPANCIES_ONLY'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{isRTL ? 'فوارق المعادلة فقط' : 'Discrepancies Only'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono font-bold">
                {summary.discrepanciesCount}
              </span>
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none"
            >
              <option value="ALL">{isRTL ? 'كافة التصنيفات' : 'All Categories'}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right side tools */}
        <div className="flex flex-wrap items-center gap-2">
          {summary.discrepanciesCount > 0 && (
            <button
              onClick={() => handleOpenAutoFix()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/50 flex items-center gap-2 transition-all cursor-pointer border border-indigo-400/30"
              title={isRTL ? 'تسوية الفوارق المحددة أو كافة الفوارق آلياً' : 'Auto-fix selected or all discrepancies'}
            >
              <Wand2 className="w-4 h-4 text-purple-200 animate-pulse" />
              <span>
                {selectedMaterialIds.length > 0
                  ? isRTL
                    ? `تسوية الفوارق المحددة آلياً (${selectedMaterialIds.length})`
                    : `Auto-Fix Selected (${selectedMaterialIds.length})`
                  : isRTL
                  ? `تسوية كافة الفوارق آلياً (${summary.discrepanciesCount})`
                  : `Auto-Fix Discrepancies (${summary.discrepanciesCount})`}
              </span>
            </button>
          )}

          {/* Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute top-3 start-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRTL ? 'بحث بالاسم، الكود، التصنيف...' : 'Search by name, code...'}
              className="w-full ps-9 pe-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Selected Items Batch Floating Banner */}
      {selectedMaterialIds.length > 0 && (
        <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-500/50 shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-mono font-bold text-xs">
              {selectedMaterialIds.length}
            </span>
            <span className="text-xs font-bold text-indigo-200">
              {isRTL
                ? `تم تحديد (${selectedMaterialIds.length}) أصناف لإجراء التسوية الدفترية الآلية.`
                : `Selected (${selectedMaterialIds.length}) items for batch auto-fix adjustment.`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMaterialIds([])}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              {isRTL ? 'إلغاء التحديد' : 'Clear Selection'}
            </button>
            <button
              onClick={() => handleOpenAutoFix()}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{isRTL ? 'بدء التسوية المحددة' : 'Execute Auto-Fix'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      discrepantItemIds.length > 0 &&
                      selectedMaterialIds.length === discrepantItemIds.length
                    }
                    onChange={handleSelectAllDiscrepant}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title={isRTL ? 'تحديد كافة الأصناف ذات الفوارق' : 'Select all discrepant items'}
                  />
                </th>
                <th className="p-3.5 text-start">{isRTL ? 'المادة / الكود' : 'Material'}</th>
                <th className="p-3.5 text-end text-emerald-400 font-mono">
                  {isRTL ? 'الوارد (Inflows)' : 'Inflow'}
                  <div className="text-[9px] text-slate-500 font-normal">Opening + Receipts + Returns</div>
                </th>
                <th className="p-3.5 text-end text-rose-400 font-mono">
                  {isRTL ? 'المنصرف (Outflows)' : 'Outflow'}
                  <div className="text-[9px] text-slate-500 font-normal">Issues + Damage + Shredding</div>
                </th>
                <th className="p-3.5 text-end text-cyan-300 font-mono font-black">
                  {isRTL ? 'ناتج المعادلة' : 'Formula Calc'}
                  <div className="text-[9px] text-slate-500 font-normal">Inflow - Outflow</div>
                </th>
                <th className="p-3.5 text-end text-white font-mono font-black">
                  {isRTL ? 'رصيد المخزن' : 'Stored Balance'}
                  <div className="text-[9px] text-slate-500 font-normal">Active Stock</div>
                </th>
                <th className="p-3.5 text-end font-mono font-black">
                  {isRTL ? 'الفارق (Δ)' : 'Discrepancy'}
                  <div className="text-[9px] text-slate-500 font-normal">Stored - Formula</div>
                </th>
                <th className="p-3.5 text-center font-mono">
                  {isRTL ? 'الشلايف (مخزن / دفتر)' : 'Bags (Store / Ledger)'}
                </th>
                <th className="p-3.5 text-center">{isRTL ? 'حالة المطابقة' : 'Status'}</th>
                <th className="p-3.5 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400 font-sans">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                    <p className="text-sm font-bold text-white">
                      {isRTL ? 'لا توجد فوارق مطابقة تطابق البحث' : 'No discrepancies found matching criteria'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {isRTL ? 'جميع المواد متطابقة مع سجل الحركات والمخزن' : 'All materials match equation balances.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedMaterialId === item.materialId;
                  const isSelected = selectedMaterialIds.includes(item.materialId);
                  return (
                    <React.Fragment key={item.materialId}>
                      <tr
                        className={`hover:bg-slate-800/40 transition-colors ${
                          item.hasDiscrepancy ? (isSelected ? 'bg-indigo-950/40' : 'bg-rose-950/20') : ''
                        }`}
                      >
                        {/* Checkbox Column */}
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!item.hasDiscrepancy}
                            onChange={() => handleToggleSelect(item.materialId)}
                            className={`w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 ${
                              item.hasDiscrepancy ? 'cursor-pointer' : 'opacity-25 cursor-not-allowed'
                            }`}
                          />
                        </td>

                        {/* Material Info */}
                        <td className="p-3.5 font-sans">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setExpandedMaterialId(isExpanded ? null : item.materialId)
                              }
                              className="text-slate-400 hover:text-cyan-300 p-0.5 rounded cursor-pointer"
                              title={isRTL ? 'عرض تفصيل المعادلة' : 'Toggle Formula Breakdown'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-cyan-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            <div>
                              <div className="font-bold text-white text-xs">{item.materialName}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                <span className="text-cyan-400 font-bold">{item.materialCode}</span>
                                <span>•</span>
                                <span>{item.category}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Inflow Total */}
                        <td className="p-3.5 text-end text-emerald-400 font-bold">
                          +{item.totalInflowKG.toLocaleString()} KG
                          <div className="text-[9px] text-slate-500 font-normal">
                            {item.openingKG > 0 && `فت:${item.openingKG.toLocaleString()} `}
                            {item.receiptsKG > 0 && `ورد:${item.receiptsKG.toLocaleString()} `}
                            {item.returnsKG > 0 && `رجع:${item.returnsKG.toLocaleString()}`}
                          </div>
                        </td>

                        {/* Outflow Total */}
                        <td className="p-3.5 text-end text-rose-400 font-bold">
                          -{item.totalOutflowKG.toLocaleString()} KG
                          <div className="text-[9px] text-slate-500 font-normal">
                            {item.issuesKG > 0 && `صرف:${item.issuesKG.toLocaleString()} `}
                            {item.damageKG > 0 && `تالف:${item.damageKG.toLocaleString()} `}
                            {item.shreddingKG > 0 && `ثرم:${item.shreddingKG.toLocaleString()}`}
                          </div>
                        </td>

                        {/* Formula Calculated Balance */}
                        <td className="p-3.5 text-end text-cyan-300 font-black">
                          {item.formulaCalculatedKG.toLocaleString()} KG
                        </td>

                        {/* Stored Inventory Balance */}
                        <td className="p-3.5 text-end text-white font-black">
                          {item.storedInventoryKG.toLocaleString()} KG
                        </td>

                        {/* Discrepancy */}
                        <td
                          className={`p-3.5 text-end font-black ${
                            item.hasDiscrepancy ? 'text-rose-400' : 'text-emerald-400 font-medium'
                          }`}
                        >
                          {item.discrepancyKG === 0
                            ? '0.00 KG'
                            : item.discrepancyKG > 0
                            ? `+${item.discrepancyKG.toLocaleString()} KG`
                            : `${item.discrepancyKG.toLocaleString()} KG`}
                        </td>

                        {/* Bulk Bags */}
                        <td className="p-3.5 text-center text-amber-300 font-bold">
                          {item.storedInventoryBags} / {item.formulaCalculatedBags}
                        </td>

                        {/* Status */}
                        <td className="p-3.5 text-center font-sans">
                          <StatusBadge status={item.status} size="xs" />
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 text-center font-sans">
                          <div className="flex items-center justify-center gap-1.5">
                            {item.hasDiscrepancy ? (
                              <>
                                <button
                                  onClick={() => handleOpenAutoFix([item.materialId])}
                                  className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow flex items-center gap-1 cursor-pointer transition-colors"
                                  title={isRTL ? 'تسوية آلية فورية لمعادلة المخزون' : 'Instant Auto-Fix'}
                                >
                                  <Wand2 className="w-3 h-3 text-indigo-200" />
                                  <span>{isRTL ? 'تسوية آلية' : 'Auto-Fix'}</span>
                                </button>
                                <button
                                  onClick={() => handleOpenReconcile(item)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] shadow cursor-pointer transition-colors"
                                  title={isRTL ? 'تخصيص يدوي للموقع والرصيد' : 'Manual Reconcile'}
                                >
                                  {isRTL ? 'يدوي' : 'Manual'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedMaterialId(item.materialId);
                                  setCurrentPage('material_card');
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-[10px] border border-slate-700 cursor-pointer"
                              >
                                {isRTL ? 'كشف الصنف' : 'Card'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Equation Visualizer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-slate-800 font-sans">
                          <td colSpan={10} className="p-4">
                            <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-3">
                              <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                                <span className="flex items-center gap-1.5">
                                  <Scale className="w-4 h-4 text-cyan-400" />
                                  <span>
                                    {isRTL
                                      ? `التفكيك التفصيلي لمعادلة الصنف: ${item.materialName} (${item.materialCode})`
                                      : `Detailed Equation Breakdown: ${item.materialName}`}
                                  </span>
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {isRTL ? 'عدد الحركات:' : 'Movements:'} {item.movementsCount} | {isRTL ? 'آخر حركة:' : 'Last:'} {item.lastMovementDate}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
                                {/* Inflow Box */}
                                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1.5">
                                  <div className="font-bold text-emerald-400 flex items-center justify-between">
                                    <span>{isRTL ? '1. مجموع الوارد (Opening + Receipts + Returns)' : '1. Total Inflow'}</span>
                                    <span>+{item.totalInflowKG.toLocaleString()} KG ({item.totalInflowBags} شليف)</span>
                                  </div>
                                  <div className="space-y-1 text-slate-300 ps-2 pt-1 border-t border-slate-800 text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{isRTL ? '• رصيد افتتاحي (Opening):' : '• Opening Balance:'}</span>
                                      <span>{item.openingKG.toLocaleString()} KG ({item.openingBags} bags)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{isRTL ? '• استلامات الميزان 546 (Receipts):' : '• Receipts Doc 546:'}</span>
                                      <span>{item.receiptsKG.toLocaleString()} KG ({item.receiptsBags} bags)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{isRTL ? '• مرتجعات إنتاج/ثرم (Returns):' : '• Returns:'}</span>
                                      <span>{item.returnsKG.toLocaleString()} KG ({item.returnsBags} bags)</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Outflow Box */}
                                <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 space-y-1.5">
                                  <div className="font-bold text-rose-400 flex items-center justify-between">
                                    <span>{isRTL ? '2. مجموع المنصرف (Issues + Damage + Shredding)' : '2. Total Outflow'}</span>
                                    <span>-{item.totalOutflowKG.toLocaleString()} KG ({item.totalOutflowBags} شليف)</span>
                                  </div>
                                  <div className="space-y-1 text-slate-300 ps-2 pt-1 border-t border-slate-800 text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{isRTL ? '• منصرف إنتاج 167 (Issues):' : '• Production Issues 167:'}</span>
                                      <span>{item.issuesKG.toLocaleString()} KG ({item.issuesBags} bags)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{isRTL ? '• تالف إنتاج (Production Damage):' : '• Production Damage:'}</span>
                                      <span>{item.damageKG.toLocaleString()} KG ({item.damageBags} bags)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">{isRTL ? '• تغذية الثرم (Shredding Feed):' : '• Shredding Input:'}</span>
                                      <span>{item.shreddingKG.toLocaleString()} KG ({item.shreddingBags} bags)</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Reconciliation Equation Bar */}
                              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                                <div>
                                  <span className="text-slate-400">{isRTL ? 'الرصيد النظري = ' : 'Formula = '}</span>
                                  <span className="text-emerald-400 font-bold">{item.totalInflowKG.toLocaleString()}</span>
                                  <span className="text-slate-400"> - </span>
                                  <span className="text-rose-400 font-bold">{item.totalOutflowKG.toLocaleString()}</span>
                                  <span className="text-slate-400"> = </span>
                                  <span className="text-cyan-300 font-black">{item.formulaCalculatedKG.toLocaleString()} KG</span>
                                </div>

                                <div>
                                  <span className="text-slate-400">{isRTL ? 'رصيد المخزن الفعلي = ' : 'Stored = '}</span>
                                  <span className="text-white font-black">{item.storedInventoryKG.toLocaleString()} KG</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">{isRTL ? 'الفارق = ' : 'Delta = '}</span>
                                  <span
                                    className={`font-black ${
                                      item.hasDiscrepancy ? 'text-rose-400' : 'text-emerald-400'
                                    }`}
                                  >
                                    {item.discrepancyKG > 0 ? `+${item.discrepancyKG}` : item.discrepancyKG} KG
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Supervisor Reconciliation Modal */}
      {showReconcileModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 text-start">
          <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-rose-500/60 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <Scale className="w-6 h-6" />
              <div>
                <h3 className="text-base font-black text-white">
                  {isRTL ? 'تسوية جردية معتمدة وفق المعادلة الدفترية' : 'Authorized Formula Reconciliation'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedItem.materialName} ({selectedItem.materialCode})
                </p>
              </div>
            </div>

            <form onSubmit={handleReconcileSubmit} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {isRTL ? 'رصيد المعادلة الدفترية:' : 'Formula Balance:'}
                  </span>
                  <span className="text-cyan-300 font-bold">
                    {selectedItem.formulaCalculatedKG.toLocaleString()} KG ({selectedItem.formulaCalculatedBags} شليف)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    {isRTL ? 'رصيد المخزن الفعلي الحالي:' : 'Current Stored:'}
                  </span>
                  <span className="text-slate-200 font-bold">
                    {selectedItem.storedInventoryKG.toLocaleString()} KG ({selectedItem.storedInventoryBags} شليف)
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800">
                  <span className="text-slate-400">{isRTL ? 'الفارق للتسوية:' : 'Discrepancy Delta:'}</span>
                  <span className="text-rose-400 font-black">
                    {selectedItem.discrepancyKG > 0 ? `+${selectedItem.discrepancyKG}` : selectedItem.discrepancyKG} KG
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'الموقع / الرف المستهدف لإجراء التسوية' : 'Target Warehouse Location / Rack'} *
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
                    onChange={(e) =>
                      setReconcileForm({ ...reconcileForm, targetKG: Number(e.target.value) })
                    }
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
                    onChange={(e) =>
                      setReconcileForm({ ...reconcileForm, targetBags: Number(e.target.value) })
                    }
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
                  placeholder={
                    isRTL
                      ? 'بيان أسباب التسوية الجردية وفق الفحص الآلي للمعادلة...'
                      : 'Authorized explanation for adjustment...'
                  }
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40">
                <label className="block font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {isRTL ? 'رمز المشرف المعتمد (PIN: 1234 أو 9999)' : 'Supervisor PIN (1234 or 9999)'} *
                  </span>
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
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold shadow-lg cursor-pointer"
                >
                  {isRTL ? 'اعتماد التسوية وتوليد قيد ADJUSTMENT' : 'Authorize & Execute ADJUSTMENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auto-Fix Discrepancies Modal */}
      {showAutoFixModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Wand2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{isRTL ? 'تسوية الفوارق الدفترية آلياً' : 'Auto-Fix Inventory Discrepancies'}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {autoFixTargetIds.length} {isRTL ? 'مواد محددة' : 'materials'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? 'توليد قيود تسوية ADJUSTMENT رسمية لمطابقة رصيد المخزن مع معادلة سجل الحركات'
                      : 'Create authorized ADJUSTMENT records aligning stored stock with movement formula'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAutoFixModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* List of items to be fixed */}
            <div className="overflow-y-auto space-y-2 pe-1 font-mono text-xs flex-1">
              {summary.allReportItems
                .filter((item) => autoFixTargetIds.includes(item.materialId))
                .map((item) => {
                  const delta = item.discrepancyKG;
                  return (
                    <div
                      key={item.materialId}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-white text-xs font-sans">{item.materialName}</div>
                        <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                          <span className="text-cyan-400 font-mono font-bold">{item.materialCode}</span> •{' '}
                          {isRTL ? 'المخزن الحالي:' : 'Current Stored:'}{' '}
                          <span className="text-slate-200 font-mono">{item.storedInventoryKG.toLocaleString()} KG</span>{' '}
                          ➔ {isRTL ? 'المستهدف حسب المعادلة:' : 'Formula Target:'}{' '}
                          <span className="text-cyan-300 font-mono font-bold">
                            {item.formulaCalculatedKG.toLocaleString()} KG
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0 ps-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-black inline-block ${
                            delta > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {delta > 0 ? `+${delta.toLocaleString()} KG` : `${delta.toLocaleString()} KG`}
                        </span>
                        <div className="text-[9px] text-slate-500 font-sans mt-0.5">
                          {isRTL ? 'تعديل آلي' : 'Adjustment'}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <form onSubmit={handleAutoFixSubmit} className="space-y-3.5 text-xs shrink-0 border-t border-slate-800 pt-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'بيان وسبب التسوية الدفترية المعتمدة' : 'Adjustment Note & Justification'} *
                </label>
                <input
                  type="text"
                  value={autoFixReason}
                  onChange={(e) => setAutoFixReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40">
                <label className="block font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {isRTL ? 'رمز المشرف المعتمد (PIN: 1234 أو 9999)' : 'Supervisor PIN (1234 or 9999)'} *
                  </span>
                </label>
                <input
                  type="password"
                  value={autoFixSupervisorPin}
                  onChange={(e) => setAutoFixSupervisorPin(e.target.value)}
                  placeholder="••••"
                  className="w-full p-2 rounded-lg bg-slate-900 border border-indigo-500/60 text-white font-mono text-center tracking-widest text-lg font-bold outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAutoFixModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                  disabled={isAutoFixing}
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isAutoFixing}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isAutoFixing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-purple-200" />
                  )}
                  <span>
                    {isAutoFixing
                      ? isRTL
                        ? 'جارٍ تنفيذ قيود التسوية...'
                        : 'Auto-fixing...'
                      : isRTL
                      ? `تسوية وتعديل (${autoFixTargetIds.length}) مواد آلياً`
                      : `Execute Auto-Fix (${autoFixTargetIds.length})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
