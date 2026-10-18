import React, { useState, useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  Phone,
  MessageCircle,
  Building2,
  AlertTriangle,
  PackageX,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  MapPin,
  Truck,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { LowStockAlert } from '../services/lowStockMonitor';
import { generateAndDownloadPdfFromElement } from '../services/safetyStockPdfGenerator';

interface SafetyStockPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: 'ALL_LOW' | 'OUT_OF_STOCK' | 'CRITICAL';
}

export const SafetyStockPdfModal: React.FC<SafetyStockPdfModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'ALL_LOW',
}) => {
  const { isRTL } = useLanguage();
  const { lowStockOverview, suppliers, userProfile } = useFactory();

  const [activeFilter, setActiveFilter] = useState<'ALL_LOW' | 'OUT_OF_STOCK' | 'CRITICAL'>(initialFilter);
  const [includeSupplierDirectory, setIncludeSupplierDirectory] = useState(true);
  const [requisitionNote, setRequisitionNote] = useState(
    'عاجل: يُرجى التواصل الفوري مع الموردين المعتمدين لتأمين كميات التوريد المطلوبة لتفادي توقف خطوط الإنتاج وسحب المخزون الاحتياطي.'
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filter materials under safety threshold
  const filteredAlerts = lowStockOverview.alerts.filter((item) => {
    if (activeFilter === 'OUT_OF_STOCK') {
      return item.severity === 'OUT_OF_STOCK';
    }
    if (activeFilter === 'CRITICAL') {
      return item.severity === 'OUT_OF_STOCK' || item.severity === 'CRITICAL';
    }
    // ALL_LOW includes OUT_OF_STOCK, CRITICAL, WARNING
    return (
      item.severity === 'OUT_OF_STOCK' ||
      item.severity === 'CRITICAL' ||
      item.severity === 'WARNING'
    );
  });

  // Calculate metrics for current filtered subset
  const subsetDeficitKG = filteredAlerts.reduce((sum, item) => sum + item.deficitKG, 0);
  const subsetReorderKG = filteredAlerts.reduce((sum, item) => sum + item.recommendedReorderKG, 0);
  const subsetBags = filteredAlerts.reduce((sum, item) => sum + item.recommendedReorderBags, 0);

  // Group unique suppliers associated with the filtered low-stock materials
  const relevantSuppliersMap = new Map<string, { supplier: any; materials: LowStockAlert[] }>();

  filteredAlerts.forEach((item) => {
    if (item.matchingSuppliers && item.matchingSuppliers.length > 0) {
      item.matchingSuppliers.forEach((sup) => {
        if (!relevantSuppliersMap.has(sup.id)) {
          relevantSuppliersMap.set(sup.id, { supplier: sup, materials: [item] });
        } else {
          relevantSuppliersMap.get(sup.id)!.materials.push(item);
        }
      });
    } else {
      // If no specific match, attach general active raw material suppliers
      const generalSup = suppliers.filter((s) => s.status === 'Active').slice(0, 2);
      generalSup.forEach((sup) => {
        if (!relevantSuppliersMap.has(sup.id)) {
          relevantSuppliersMap.set(sup.id, { supplier: sup, materials: [item] });
        } else {
          relevantSuppliersMap.get(sup.id)!.materials.push(item);
        }
      });
    }
  });

  const relevantSuppliers = Array.from(relevantSuppliersMap.values());

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      await generateAndDownloadPdfFromElement(printRef.current, {
        fileName: `AlKarwan_Safety_Stock_Procurement_Summary_${todayStr}.pdf`,
        landscape: false,
      });
    } catch (err) {
      console.error('Failed to generate PDF', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Modal Top Control Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center text-white shadow-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>
                  {isRTL
                    ? 'توليد تقرير PDF معتمد لنواقص المخزون والتواصل مع الموردين'
                    : 'Official Safety Stock Deficit & Supplier Outreach PDF Summary'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'تقرير مطبوع رسمي مخصص لأمر الشراء والتواصل السريع مع موردي الخامات المعتمدين'
                  : 'Official printable PDF summary for instant procurement outreach & order requisition'}
              </p>
            </div>
          </div>

          {/* Action Buttons in Header */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title={isRTL ? 'طباعة مباشرة' : 'Direct Print'}
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">{isRTL ? 'طباعة' : 'Print'}</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isGeneratingPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isGeneratingPdf
                  ? isRTL
                    ? 'جارٍ تجهيز ملف PDF...'
                    : 'Generating PDF...'
                  : isRTL
                  ? 'تحميل كشف PDF معتمد'
                  : 'Download PDF'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Configuration Sub-bar */}
        <div className="p-3 sm:px-6 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold text-[11px]">
              {isRTL ? 'نطاق الكشف:' : 'Scope:'}
            </span>
            <button
              onClick={() => setActiveFilter('ALL_LOW')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeFilter === 'ALL_LOW'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'كافة النواقص تحت حد الأمان' : 'All Below Safety'} (
              {lowStockOverview.materialsNeedingProcurement})
            </button>
            <button
              onClick={() => setActiveFilter('OUT_OF_STOCK')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeFilter === 'OUT_OF_STOCK'
                  ? 'bg-rose-700 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'النفاد التام فقط (0 كغم)' : 'Out of Stock Only'} ({lowStockOverview.outOfStockCount})
            </button>
            <button
              onClick={() => setActiveFilter('CRITICAL')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeFilter === 'CRITICAL'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'الحرج جداً (<50%)' : 'Critical Only'} ({lowStockOverview.criticalCount})
            </button>
          </div>

          {/* Supplier Directory Toggle & Note */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={includeSupplierDirectory}
                onChange={(e) => setIncludeSupplierDirectory(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-emerald-500"
              />
              <span>{isRTL ? 'تضمين دليل هواتف الموردين المعتمدين' : 'Include Supplier Contact Directory'}</span>
            </label>
          </div>
        </div>

        {/* Scrollable Printable Document Preview */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-950/60 flex justify-center">
          {/* Printable Page Container (Optimized for standard A4 light layout and high contrast) */}
          <div
            ref={printRef}
            id="safety-stock-printable-report"
            className="w-full max-w-[850px] bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-2xl space-y-6 font-sans border border-slate-200"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Header Section: Factory Details & Document Stamp */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex items-start justify-between gap-4">
                {/* Right / Left Branding */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
                    <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight">
                      شركة الكروان لصناعة وتدوير البلاستيك (ذ.م.م)
                    </h1>
                  </div>
                  <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    AL-KARWAN FACTORY FOR PLASTIC RECYCLING & PACKAGING
                  </h2>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    <span>أربيل - المنطقة الصناعية الشمالية - إقليم كوردستان العراق</span>
                  </p>
                </div>

                {/* Document Badge & Code */}
                <div className="text-end shrink-0 space-y-1">
                  <div className="inline-block px-3 py-1 rounded bg-rose-600 text-white font-black text-xs uppercase tracking-wider">
                    {isRTL ? 'وثيقة طلب شراء عاجل' : 'URGENT PROCUREMENT REQUISITION'}
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    REF: <span className="text-rose-700">REQ-STK-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono">
                    {currentDate} • {currentTime}
                  </div>
                </div>
              </div>

              {/* Document Title Banner */}
              <div className="mt-4 p-3 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    كشف حصر نواقص المخزون الفعلي دون حد الأمان وموجهات التوريد العاجل
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Official Safety Stock Deficit Analysis & Instant Supplier Outreach Dispatch
                  </p>
                </div>
                <div className="text-end font-mono text-xs font-bold">
                  <span className="text-slate-500">{isRTL ? 'مسؤول الرقابة:' : 'Auditor:'} </span>
                  <span className="text-slate-900 font-bold">{userProfile.nameAr || userProfile.name}</span>
                </div>
              </div>
            </div>

            {/* Custom Requisition Note */}
            {requisitionNote && (
              <div className="p-3 bg-rose-50 border-s-4 border-rose-600 rounded-r-lg text-xs text-rose-950 font-medium">
                <strong>{isRTL ? 'توجيه إدارة العمليات:' : 'Operational Directive:'}</strong> {requisitionNote}
              </div>
            )}

            {/* Executive Highlights Cards (4 columns) */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {isRTL ? 'الأصناف تحت حد الأمان' : 'Materials Below Min'}
                </div>
                <div className="text-xl font-mono font-black text-rose-600 mt-1">
                  {filteredAlerts.length}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {filteredAlerts.filter((a) => a.severity === 'OUT_OF_STOCK').length}{' '}
                  {isRTL ? 'نفاد تام (0 كغم)' : 'out of stock'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {isRTL ? 'إجمالي العجز الفعلي' : 'Total Deficit (KG)'}
                </div>
                <div className="text-xl font-mono font-black text-rose-700 mt-1">
                  {subsetDeficitKG.toLocaleString()} <span className="text-xs font-sans">KG</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {(subsetDeficitKG / 1000).toFixed(2)} {isRTL ? 'طن عجز' : 'Tons'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {isRTL ? 'كمية التوريد الموصى بها' : 'Recommended Reorder'}
                </div>
                <div className="text-xl font-mono font-black text-slate-900 mt-1">
                  {(subsetReorderKG / 1000).toFixed(1)} <span className="text-xs font-sans">{isRTL ? 'طن' : 'TONS'}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {subsetReorderKG.toLocaleString()} KG
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {isRTL ? 'تقدير عدد الشلايف' : 'Estimated Bulk Bags'}
                </div>
                <div className="text-xl font-mono font-black text-amber-600 mt-1">
                  ~{subsetBags}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isRTL ? 'شليف سعة 500 كغم' : 'approx. bulk bags'}
                </div>
              </div>
            </div>

            {/* Section 1: Materials Under Safety Threshold Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>
                    {isRTL
                      ? 'جدول تفاصيل المواد تحت حد الأمان المطلوب شراؤها'
                      : 'Shortage Materials Requiring Immediate Procurement'}
                  </span>
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">
                  {filteredAlerts.length} {isRTL ? 'مواد محصورة' : 'items listed'}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-xs text-start border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px] uppercase">
                    <tr>
                      <th className="p-2 text-center border-e border-slate-300 w-8">#</th>
                      <th className="p-2 text-start border-e border-slate-300">{isRTL ? 'كود المادة' : 'Code'}</th>
                      <th className="p-2 text-start border-e border-slate-300">{isRTL ? 'اسم المادة والمواصفة' : 'Material Description'}</th>
                      <th className="p-2 text-end border-e border-slate-300 text-slate-900">{isRTL ? 'الرصيد الفعلي' : 'Current Stock'}</th>
                      <th className="p-2 text-end border-e border-slate-300 text-slate-600">{isRTL ? 'حد الأمان الأدنى' : 'Min Threshold'}</th>
                      <th className="p-2 text-end border-e border-slate-300 text-rose-600">{isRTL ? 'العجز (KG)' : 'Deficit (KG)'}</th>
                      <th className="p-2 text-end border-e border-slate-300 text-slate-900 font-black">{isRTL ? 'المطلوب للتوريد' : 'Order Qty'}</th>
                      <th className="p-2 text-center">{isRTL ? 'حالة المخزون' : 'Stock Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {filteredAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500 font-sans">
                          {isRTL ? 'لا توجد مواد تطابق شرط التصفية الحالي.' : 'No items match current filter.'}
                        </td>
                      </tr>
                    ) : (
                      filteredAlerts.map((item, idx) => {
                        const isZero = item.currentStockKG === 0;
                        return (
                          <tr key={item.materialId} className={isZero ? 'bg-rose-50/70' : 'hover:bg-slate-50'}>
                            <td className="p-2 text-center text-slate-500 border-e border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-bold text-slate-900 border-e border-slate-200 font-mono">
                              {item.materialCode}
                            </td>
                            <td className="p-2 border-e border-slate-200 font-sans">
                              <div className="font-bold text-slate-900">{item.materialNameAr}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{item.materialNameEn}</div>
                            </td>
                            <td className="p-2 text-end border-e border-slate-200">
                              <span className={isZero ? 'text-rose-600 font-black' : 'text-slate-900 font-bold'}>
                                {item.currentStockKG.toLocaleString()} KG
                              </span>
                              <div className="text-[9px] text-slate-500 font-sans">
                                {item.currentBagsCount} {isRTL ? 'شليف' : 'bags'}
                              </div>
                            </td>
                            <td className="p-2 text-end border-e border-slate-200 text-slate-700">
                              {item.minStockKG.toLocaleString()} KG
                            </td>
                            <td className="p-2 text-end border-e border-slate-200 font-bold text-rose-600">
                              -{item.deficitKG.toLocaleString()} KG
                            </td>
                            <td className="p-2 text-end border-e border-slate-200 font-black text-slate-900 bg-amber-50/50">
                              {item.recommendedReorderKG.toLocaleString()} KG
                              <div className="text-[9px] text-slate-600 font-sans font-bold">
                                ~{item.recommendedReorderBags} {isRTL ? 'شليف' : 'bags'}
                              </div>
                            </td>
                            <td className="p-2 text-center font-sans">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                                  item.severity === 'OUT_OF_STOCK'
                                    ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                    : item.severity === 'CRITICAL'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-yellow-50 text-yellow-800 border border-yellow-300'
                                }`}
                              >
                                {isRTL ? item.statusLabelAr : item.statusLabelEn}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: Approved Supplier Directory for Instant Procurement Outreach */}
            {includeSupplierDirectory && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wide flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {isRTL
                        ? 'دليل جهات الاتصال وموردي الخامات المعتمدين للتواصل الفوري'
                        : 'Approved Supplier Directory for Instant Procurement Outreach'}
                    </span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {relevantSuppliers.length} {isRTL ? 'مورد معتمد' : 'suppliers listed'}
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded-xl">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[10px] uppercase">
                      <tr>
                        <th className="p-2 text-start border-e border-slate-300">{isRTL ? 'المورد المعتمد' : 'Supplier Company'}</th>
                        <th className="p-2 text-start border-e border-slate-300">{isRTL ? 'الشخص المسؤول' : 'Contact Person'}</th>
                        <th className="p-2 text-start border-e border-slate-300 font-mono">{isRTL ? 'رقم الهاتف المباشر' : 'Direct Phone'}</th>
                        <th className="p-2 text-start border-e border-slate-300">{isRTL ? 'الموقع والعنوان' : 'Location'}</th>
                        <th className="p-2 text-start">{isRTL ? 'المواد المطلوبة المرتبطة' : 'Linked Shortage Materials'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-[11px]">
                      {relevantSuppliers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-500">
                            {isRTL ? 'لا توجد بيانات موردين' : 'No supplier contacts found'}
                          </td>
                        </tr>
                      ) : (
                        relevantSuppliers.map(({ supplier, materials }) => {
                          const cleanPhone = supplier.phone.replace(/[^0-9+]/g, '');
                          return (
                            <tr key={supplier.id} className="hover:bg-slate-50">
                              <td className="p-2 border-e border-slate-200">
                                <div className="font-bold text-slate-900">{supplier.nameAr}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{supplier.nameEn}</div>
                              </td>
                              <td className="p-2 border-e border-slate-200 font-bold text-slate-800">
                                {supplier.contactPerson}
                              </td>
                              <td className="p-2 border-e border-slate-200 font-mono font-bold text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{supplier.phone}</span>
                                </div>
                              </td>
                              <td className="p-2 border-e border-slate-200 text-slate-600 text-[10px]">
                                {supplier.address}
                              </td>
                              <td className="p-2 text-slate-800">
                                <div className="flex flex-wrap gap-1">
                                  {materials.map((m) => (
                                    <span
                                      key={m.materialId}
                                      className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-900"
                                    >
                                      {m.materialCode}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Section 3: Official Sign-off and Authorization Signatures */}
            <div className="pt-6 border-t-2 border-slate-800 space-y-6">
              <div className="text-[11px] text-slate-600">
                <strong>{isRTL ? 'إقرار صحة البيانات الدفترية:' : 'Data Verification & Approval:'} </strong>
                {isRTL
                  ? 'تم استخراج هذا الكشف آلياً بناءً على مطابقة الأرصدة الفعلية في المستودعات مع السجلات الدفترية المعتمدة وحدود الأمان الدنيا.'
                  : 'This statement was generated based on verified physical and book stock balances vs authorized minimum safety thresholds.'}
              </div>

              {/* 3 Signature Columns */}
              <div className="grid grid-cols-3 gap-6 pt-4 text-center">
                <div className="space-y-8">
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {isRTL ? 'مسؤول مستودعات المواد الأولية' : 'Raw Materials Storekeeper'}
                    </div>
                    <div className="text-[10px] text-slate-500">{isRTL ? 'إعداد ومطابقة الأرصدة' : 'Prepared & Verified'}</div>
                  </div>
                  <div className="border-b border-dashed border-slate-400 pb-1 text-slate-800 font-mono text-xs">
                    {userProfile.nameAr || userProfile.name}
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {isRTL ? 'مدير المشتريات والتوريدات' : 'Procurement & Supply Manager'}
                    </div>
                    <div className="text-[10px] text-slate-500">{isRTL ? 'متابعة عروض الموردين والتنفيذ' : 'Sourcing & PO Execution'}</div>
                  </div>
                  <div className="border-b border-dashed border-slate-400 pb-1 text-slate-400 text-xs">
                    ...................................
                  </div>
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="font-bold text-xs text-slate-900">
                      {isRTL ? 'المدير العام والمصادقة' : 'General Factory Manager'}
                    </div>
                    <div className="text-[10px] text-slate-500">{isRTL ? 'الاعتماد النهائي للصرف' : 'Final Executive Authorization'}</div>
                  </div>
                  <div className="border-b border-dashed border-slate-400 pb-1 text-slate-400 text-xs">
                    ...................................
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Sticky Bar with Direct Outreach Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              {isRTL
                ? 'ملف PDF متوافق للطباعة A4 ومرفق به قائمة الموردين المعتمدين لسرعة التعميد والتوريد.'
                : 'A4 compliant PDF summary with verified supplier contacts for fast outreach.'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
            >
              {isRTL ? 'إغلاق المعاينة' : 'Close'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50 transition-all"
            >
              {isGeneratingPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isGeneratingPdf
                  ? isRTL
                    ? 'جارٍ التوليد...'
                    : 'Generating...'
                  : isRTL
                  ? 'تحميل كشف PDF الآن'
                  : 'Download PDF Now'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
