import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Truck,
  PackageX,
  TrendingDown,
  Phone,
  Building2,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Download,
  CreditCard,
  RefreshCw,
  Clock,
  Warehouse,
  Boxes,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { LowStockAlert, LowStockSeverity } from '../services/lowStockMonitor';
import { SafetyStockPdfModal } from './SafetyStockPdfModal';

interface LowStockNotificationPanelProps {
  compact?: boolean;
}

export const LowStockNotificationPanel: React.FC<LowStockNotificationPanelProps> = ({
  compact = false,
}) => {
  const { isRTL } = useLanguage();
  const {
    lowStockOverview,
    updateMaterialSafetyThreshold,
    setCurrentPage,
    setSelectedMaterialId,
    receivingTransactions,
  } = useFactory();

  const [activeFilter, setActiveFilter] = useState<'LOW_ONLY' | 'OUT_OF_STOCK' | 'CRITICAL' | 'ALL'>('LOW_ONLY');
  const [editingThresholdMaterial, setEditingThresholdMaterial] = useState<LowStockAlert | null>(null);
  const [minStockInput, setMinStockInput] = useState<number>(0);
  const [maxStockInput, setMaxStockInput] = useState<number>(0);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  // Filter alerts
  const displayedAlerts = useMemo(() => {
    switch (activeFilter) {
      case 'OUT_OF_STOCK':
        return lowStockOverview.alerts.filter((a) => a.severity === 'OUT_OF_STOCK');
      case 'CRITICAL':
        return lowStockOverview.alerts.filter((a) => a.severity === 'CRITICAL');
      case 'LOW_ONLY':
        return lowStockOverview.alerts.filter(
          (a) => a.severity === 'OUT_OF_STOCK' || a.severity === 'CRITICAL' || a.severity === 'WARNING'
        );
      case 'ALL':
      default:
        return lowStockOverview.alerts;
    }
  }, [lowStockOverview.alerts, activeFilter]);

  // Open threshold editor modal
  const handleOpenThresholdModal = (item: LowStockAlert) => {
    setEditingThresholdMaterial(item);
    setMinStockInput(item.minStockKG);
    setMaxStockInput(item.maxStockKG);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
  };

  // Save new threshold
  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingThresholdMaterial) return;

    const res = updateMaterialSafetyThreshold(
      editingThresholdMaterial.materialId,
      Number(minStockInput),
      Number(maxStockInput)
    );

    if (res.success) {
      setSaveSuccessMsg(
        isRTL
          ? `تم تحديث حدود الأمان بنجاح للصنف (${editingThresholdMaterial.materialNameAr})`
          : `Safety thresholds updated successfully for (${editingThresholdMaterial.materialNameEn})`
      );
      setTimeout(() => {
        setEditingThresholdMaterial(null);
        setSaveSuccessMsg(null);
      }, 1200);
    } else {
      setSaveErrorMsg(res.error || 'خطأ في حفظ حدود الأمان');
    }
  };

  // Navigate to receiving with material
  const handleInitiateProcurement = (materialId: string) => {
    setSelectedMaterialId(materialId);
    setCurrentPage('receiving');
  };

  // Navigate to material card
  const handleViewMaterialCard = (materialId: string) => {
    setSelectedMaterialId(materialId);
    setCurrentPage('material_card');
  };

  // Export Procurement Requisition to CSV
  const handleExportProcurementRequisition = () => {
    const lowItems = lowStockOverview.alerts.filter(
      (a) => a.severity === 'OUT_OF_STOCK' || a.severity === 'CRITICAL' || a.severity === 'WARNING'
    );

    const headers = [
      'Material Code',
      'Material Name (Arabic)',
      'Category',
      'Current Stock (KG)',
      'Current Bags',
      'Min Safety Stock (KG)',
      'Deficit Below Safety (KG)',
      'Recommended Order (KG)',
      'Recommended Order (Bags)',
      'Coverage %',
      'Severity',
      'Primary Warehouse',
      'Suggested Suppliers',
    ];

    const rows = lowItems.map((item) => [
      `"${item.materialCode}"`,
      `"${item.materialNameAr.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      item.currentStockKG,
      item.currentBagsCount,
      item.minStockKG,
      item.deficitKG,
      item.recommendedReorderKG,
      item.recommendedReorderBags,
      `${item.coveragePercentage}%`,
      `"${item.statusLabelEn}"`,
      `"${item.defaultWarehouseName}"`,
      `"${item.matchingSuppliers.map((s) => s?.nameAr || s?.nameEn || '').filter(Boolean).join(' | ')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alkarwan_procurement_requisition_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Alert Bar */}
      <div
        className={`p-5 rounded-2xl border transition-all shadow-xl ${
          lowStockOverview.materialsNeedingProcurement > 0
            ? 'bg-gradient-to-r from-[#1c131d] via-[#16121b] to-[#121420] border-rose-500/40 shadow-rose-950/20'
            : 'bg-[#111218] border-white/10'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                lowStockOverview.outOfStockCount > 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                  : lowStockOverview.materialsNeedingProcurement > 0
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {lowStockOverview.outOfStockCount > 0 ? (
                <PackageX className="w-6 h-6" />
              ) : lowStockOverview.materialsNeedingProcurement > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>
                    {isRTL
                      ? 'نظام مراقبة نواقص المخزون وحدود الأمان الدفترية'
                      : 'Low Stock Notification & Procurement Monitor'}
                  </span>
                </h2>
                {lowStockOverview.materialsNeedingProcurement > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                    <span>
                      {lowStockOverview.materialsNeedingProcurement}{' '}
                      {isRTL ? 'أصناف بحاجة لشراء وتوريد' : 'items need procurement'}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {isRTL
                  ? 'متابعة حية للأرصدة المتوفرة ومطابقتها مع الحدود الدنيا للأمان (Min Stock KG)، واحتساب كميات التوريد المطلوبة.'
                  : 'Live monitoring of available stock vs defined safety thresholds (Min Stock KG) and automatic reorder recommendations.'}
              </p>
            </div>
          </div>

          {/* Quick Metrics & Requisition Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Deficit Counter */}
            {lowStockOverview.totalDeficitKG > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/5 font-mono text-xs">
                <div className="text-[10px] text-slate-400">
                  {isRTL ? 'إجمالي العجز عن حد الأمان:' : 'Total Deficit:'}
                </div>
                <div className="text-rose-400 font-bold">
                  {lowStockOverview.totalDeficitKG.toLocaleString()} KG
                </div>
              </div>
            )}

            {/* Recommended Reorder Total */}
            {lowStockOverview.totalRecommendedReorderKG > 0 && (
              <div className="px-3.5 py-2 rounded-xl bg-black/40 border border-white/5 font-mono text-xs">
                <div className="text-[10px] text-slate-400">
                  {isRTL ? 'الكمية المقترحة للشراء:' : 'Recommended Order:'}
                </div>
                <div className="text-cyan-300 font-bold">
                  {(lowStockOverview.totalRecommendedReorderKG / 1000).toFixed(1)} TONS
                </div>
              </div>
            )}

            {/* Generate Official PDF Requisition Button */}
            {lowStockOverview.materialsNeedingProcurement > 0 && (
              <button
                onClick={() => setIsPdfModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition-all cursor-pointer"
                title={isRTL ? 'توليد وطباعة تقرير PDF لنواقص المخزون والتواصل مع الموردين' : 'Generate Printable PDF Report with Supplier Outreach'}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isRTL ? 'كشف PDF للموردين' : 'PDF Outreach'}</span>
              </button>
            )}

            {/* Export Purchase Requisition Button */}
            {lowStockOverview.materialsNeedingProcurement > 0 && (
              <button
                onClick={handleExportProcurementRequisition}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={isRTL ? 'تصدير كشف طلب الشراء كملف CSV' : 'Export Procurement Requisition CSV'}
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'تصدير كشف الشراء' : 'Export Requisition'}</span>
              </button>
            )}

            {/* Primary Order Action */}
            <button
              onClick={() => setCurrentPage('receiving')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>{isRTL ? 'استلام توريد جديد (546)' : 'New Intake (546)'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-white/5 text-xs">
          <span className="text-slate-500 text-[11px] font-bold">
            {isRTL ? 'تصفية العرض:' : 'Filter View:'}
          </span>
          <button
            onClick={() => setActiveFilter('LOW_ONLY')}
            className={`px-3 py-1 rounded-lg transition-colors font-bold ${
              activeFilter === 'LOW_ONLY'
                ? 'bg-rose-600 text-white shadow'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {isRTL ? 'النواقص ومواد الشراء' : 'Needs Procurement'} ({lowStockOverview.materialsNeedingProcurement})
          </button>
          <button
            onClick={() => setActiveFilter('OUT_OF_STOCK')}
            className={`px-3 py-1 rounded-lg transition-colors font-bold ${
              activeFilter === 'OUT_OF_STOCK'
                ? 'bg-rose-700 text-white shadow'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {isRTL ? 'نفاد تام (0 كغم)' : 'Out of Stock'} ({lowStockOverview.outOfStockCount})
          </button>
          <button
            onClick={() => setActiveFilter('CRITICAL')}
            className={`px-3 py-1 rounded-lg transition-colors font-bold ${
              activeFilter === 'CRITICAL'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {isRTL ? 'حرج جداً (< 50%)' : 'Critically Low'} ({lowStockOverview.criticalCount})
          </button>
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition-colors font-bold ${
              activeFilter === 'ALL'
                ? 'bg-slate-700 text-white shadow'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {isRTL ? 'كافة المواد' : 'All Materials'} ({lowStockOverview.totalMaterials})
          </button>
        </div>
      </div>

      {/* Materials Procurement Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayedAlerts.length === 0 ? (
          <div className="col-span-full p-8 rounded-2xl bg-[#111218] border border-white/5 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            <h4 className="text-white font-bold text-sm">
              {isRTL ? 'المخزون ضمن المستويات الآمنة' : 'Inventory is within safe operating thresholds'}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {isRTL
                ? 'لا توجد مواد تطابق شرط التصفية الحالي.'
                : 'No materials match the selected low-stock condition.'}
            </p>
          </div>
        ) : (
          displayedAlerts.map((item) => {
            const isOutOfStock = item.severity === 'OUT_OF_STOCK';
            const isCritical = item.severity === 'CRITICAL';
            const isWarning = item.severity === 'WARNING';
            const isLow = isOutOfStock || isCritical || isWarning;

            return (
              <div
                key={item.materialId}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isOutOfStock
                    ? 'bg-gradient-to-b from-[#1c1214] to-[#121217] border-rose-500/50 shadow-lg shadow-rose-950/20'
                    : isCritical
                    ? 'bg-gradient-to-b from-[#1c1512] to-[#121217] border-rose-500/30'
                    : isWarning
                    ? 'bg-gradient-to-b from-[#1c1a12] to-[#121217] border-amber-500/30'
                    : 'bg-[#111218] border-white/5'
                }`}
              >
                {/* Header info */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          {item.materialCode}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.category}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1 leading-snug">
                        {item.materialNameAr}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">{item.materialNameEn}</p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${item.urgencyColor}`}
                    >
                      {isRTL ? item.statusLabelAr : item.statusLabelEn}
                    </span>
                  </div>

                  {/* Stock Progress & Threshold Health Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-baseline text-xs font-mono">
                      <span className="text-slate-400">
                        {isRTL ? 'الرصيد الفعلي:' : 'Current Stock:'}{' '}
                        <strong
                          className={
                            item.currentStockKG === 0
                              ? 'text-rose-400 font-black'
                              : item.currentStockKG < item.minStockKG
                              ? 'text-amber-400 font-bold'
                              : 'text-emerald-400 font-bold'
                          }
                        >
                          {item.currentStockKG.toLocaleString()} KG
                        </strong>
                        <span className="text-[10px] text-slate-500 ms-1">
                          ({item.currentBagsCount} {isRTL ? 'شليف' : 'bags'})
                        </span>
                      </span>

                      <span className="text-[11px] text-slate-400">
                        {isRTL ? 'حد الأمان:' : 'Safety Min:'}{' '}
                        <span className="text-rose-300 font-bold">
                          {item.minStockKG.toLocaleString()} KG
                        </span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                      <div
                        className={`h-full transition-all rounded-full ${
                          item.coveragePercentage === 0
                            ? 'w-0'
                            : item.coveragePercentage < 50
                            ? 'bg-rose-500'
                            : item.coveragePercentage < 100
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(item.coveragePercentage, 3))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>
                        {isRTL ? 'نسبة تغطية حد الأمان:' : 'Coverage:'}{' '}
                        <strong
                          className={
                            item.coveragePercentage < 100 ? 'text-amber-400' : 'text-emerald-400'
                          }
                        >
                          {item.coveragePercentage}%
                        </strong>
                      </span>
                      <span>
                        {isRTL ? 'السعة القصوى:' : 'Max:'} {item.maxStockKG.toLocaleString()} KG
                      </span>
                    </div>
                  </div>

                  {/* Deficit & Recommended Procurement Box */}
                  {isLow && (
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1 text-xs font-mono">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">
                          {isRTL ? 'العجز المباشر عن حد الأمان:' : 'Shortage Deficit:'}
                        </span>
                        <span className="text-rose-400 font-bold">
                          -{item.deficitKG.toLocaleString()} KG
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">
                          {isRTL ? 'طلب الشراء والتوريد الموصى به:' : 'Recommended Procurement:'}
                        </span>
                        <span className="text-cyan-300 font-black">
                          {item.recommendedReorderKG.toLocaleString()} KG ({item.recommendedReorderBags}{' '}
                          {isRTL ? 'شليف تقريباً' : 'bags'})
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Incoming Shipment Status (if any transactions exist in pipeline) */}
                  {item.incomingShipmentsKG > 0 && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-[11px] text-blue-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                        <span>{isRTL ? 'شحنة واردة قيد الاستلام بالميزان:' : 'Incoming on weighbridge:'}</span>
                      </span>
                      <span className="font-mono font-bold text-white">
                        +{item.incomingShipmentsKG.toLocaleString()} KG
                      </span>
                    </div>
                  )}

                  {/* Suggested Suppliers Contact */}
                  {item.matchingSuppliers.length > 0 && (
                    <div className="text-[11px] space-y-1 pt-1 border-t border-white/5">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-cyan-400" />
                        <span>{isRTL ? 'الموردون المعتمدون للتوريد:' : 'Approved Suppliers:'}</span>
                      </span>
                      <div className="space-y-1">
                        {item.matchingSuppliers.slice(0, 2).map((sup) => (
                          <div
                            key={sup.id}
                            className="flex items-center justify-between text-[11px] text-slate-300 bg-white/5 px-2 py-1 rounded"
                          >
                            <span className="truncate max-w-[180px]">{sup?.nameAr || sup?.nameEn || 'مورد معتمد'}</span>
                            <span className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              <span>{sup.phone}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                  <button
                    onClick={() => handleInitiateProcurement(item.materialId)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors cursor-pointer"
                    title={isRTL ? 'بدء استلام شحنة جديدة بمستند 546' : 'Initiate Receiving Form (Doc 546)'}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'بدء استلام (546)' : 'Order / Receive'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenThresholdModal(item)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                    title={isRTL ? 'تعديل حدود الأمان والحد الأدنى' : 'Edit Safety Thresholds'}
                  >
                    <Sliders className="w-4 h-4 text-amber-400" />
                  </button>

                  <button
                    onClick={() => handleViewMaterialCard(item.materialId)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer"
                    title={isRTL ? 'عرض بطاقة حركة الصنف' : 'View Material Card'}
                  >
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Safety Threshold Editing Modal */}
      {editingThresholdMaterial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-start">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isRTL ? 'تعديل حدود الأمان والمخزون الحرج' : 'Adjust Safety Stock Thresholds'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingThresholdMaterial.materialNameAr} ({editingThresholdMaterial.materialCode})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingThresholdMaterial(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {saveErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{saveErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveThreshold} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>{isRTL ? 'الرصيد الفعلي الحالي:' : 'Current Stock:'}</span>
                  <span className="text-white font-bold">
                    {editingThresholdMaterial.currentStockKG.toLocaleString()} KG
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'الحد الأدنى للأمان (Min Stock KG)' : 'Safety Minimum (Min Stock KG)'} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={minStockInput}
                  onChange={(e) => setMinStockInput(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold text-sm outline-none focus:border-amber-500"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {isRTL
                    ? 'سيتم إرسال تنبيه في لوحة التحكم عند هبوط الرصيد الفعلي عن هذا الرقم.'
                    : 'System will alert when available stock drops below this threshold.'}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isRTL ? 'الحد الأقصى لسعة التخزين (Max Stock KG)' : 'Maximum Capacity (Max Stock KG)'} *
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={maxStockInput}
                  onChange={(e) => setMaxStockInput(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingThresholdMaterial(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow cursor-pointer transition-colors"
                >
                  {isRTL ? 'حفظ حد الأمان الجديد' : 'Save New Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Safety Stock Printable PDF Generator & Outreach Modal */}
      <SafetyStockPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        initialFilter={activeFilter === 'ALL' ? 'ALL_LOW' : (activeFilter as any)}
      />
    </div>
  );
};
