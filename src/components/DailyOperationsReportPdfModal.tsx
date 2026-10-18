import React, { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  Boxes,
  Factory,
  Flame,
  Truck,
  CheckCircle2,
  Building2,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ShieldCheck,
  Scale,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  FileSpreadsheet,
  BarChart3,
  Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { generateReportPdfFromElement } from '../services/reportPdfService';

export type ReportCategoryType =
  | 'DAILY_INVENTORY'
  | 'DAILY_PRODUCTION'
  | 'MASTER_EXECUTIVE'
  | 'CURRENT_VIEW';

interface DailyOperationsReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultReportType?: ReportCategoryType;
  activeReportTabId?: number;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export const DailyOperationsReportPdfModal: React.FC<DailyOperationsReportPdfModalProps> = ({
  isOpen,
  onClose,
  defaultReportType = 'DAILY_INVENTORY',
  activeReportTabId = 5,
  initialDateFrom = '2026-09-01',
  initialDateTo = '2026-09-02',
}) => {
  const { isRTL } = useLanguage();
  const {
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    inventoryBalances,
    inventoryMovements,
    productionDamages,
    currentUser,
    materials,
    suppliers,
  } = useFactory();

  const [reportCategory, setReportCategory] = useState<ReportCategoryType>(defaultReportType);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [includeKpis, setIncludeKpis] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includeQrCode, setIncludeQrCode] = useState<boolean>(true);
  const [supervisorNotes, setSupervisorNotes] = useState<string>(
    'كشف معتمد للعمليات اليومية ومطابقة أرصدة القبان والمستودعات وخطوط الثرم والتغذية وفق معايير الجودة والتدقيق الدفتري.'
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Filtered operational datasets based on selected dates
  const filteredReceiving = useMemo(() => {
    return receivingTransactions.filter((r) => {
      if (!r.date) return true;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [receivingTransactions, dateFrom, dateTo]);

  const filteredShredding = useMemo(() => {
    return shreddingTransactions.filter((s) => {
      const sDate = s.date || '2026-09-02';
      if (dateFrom && sDate < dateFrom) return false;
      if (dateTo && sDate > dateTo) return false;
      return true;
    });
  }, [shreddingTransactions, dateFrom, dateTo]);

  const filteredProductionIssues = useMemo(() => {
    return productionIssues.filter((p) => {
      if (!p.date) return true;
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      if (selectedShift !== 'ALL' && !p.shift?.includes(selectedShift)) return false;
      return true;
    });
  }, [productionIssues, dateFrom, dateTo, selectedShift]);

  const filteredMovements = useMemo(() => {
    return inventoryMovements.filter((m) => {
      if (!m.date) return true;
      if (dateFrom && m.date < dateFrom) return false;
      if (dateTo && m.date > dateTo) return false;
      return true;
    });
  }, [inventoryMovements, dateFrom, dateTo]);

  // Key Aggregated Metrics
  const totalReceivedKG = useMemo(() => {
    return filteredReceiving.reduce((sum, r) => sum + (r.netReceivedWeightKG || 0), 0);
  }, [filteredReceiving]);

  const totalReceivedBags = useMemo(() => {
    return filteredReceiving.reduce((sum, r) => sum + (r.bulkBagsCount || 0), 0);
  }, [filteredReceiving]);

  const totalShreddingInputKG = useMemo(() => {
    return filteredShredding.reduce((sum, s) => sum + (s.inputKG || 0), 0);
  }, [filteredShredding]);

  const totalShreddingOutputKG = useMemo(() => {
    return filteredShredding.reduce((sum, s) => sum + (s.outputKG || 0), 0);
  }, [filteredShredding]);

  const totalShreddingDamageKG = useMemo(() => {
    return filteredShredding.reduce((sum, s) => sum + (s.productionDamageKG || 0), 0);
  }, [filteredShredding]);

  const shreddingYieldPercentage = useMemo(() => {
    if (totalShreddingInputKG === 0) return 0;
    return Number(((totalShreddingOutputKG / totalShreddingInputKG) * 100).toFixed(1));
  }, [totalShreddingInputKG, totalShreddingOutputKG]);

  const totalIssuedKG = useMemo(() => {
    return filteredProductionIssues.reduce((sum, p) => sum + (p.quantityKG || 0), 0);
  }, [filteredProductionIssues]);

  const totalIssuedBags = useMemo(() => {
    return filteredProductionIssues.reduce((sum, p) => sum + (p.bulkBagsCount || 0), 0);
  }, [filteredProductionIssues]);

  const totalCurrentStockKG = useMemo(() => {
    return inventoryBalances.reduce((sum, b) => sum + (b.totalBalanceKG || 0), 0);
  }, [inventoryBalances]);

  const totalCurrentBags = useMemo(() => {
    return inventoryBalances.reduce((sum, b) => sum + (b.bulkBagsCount || 0), 0);
  }, [inventoryBalances]);

  if (!isOpen) return null;

  // Metadata document numbers and verification stamp
  const todayStr = new Date().toISOString().slice(0, 10);
  const reportCode =
    reportCategory === 'DAILY_INVENTORY'
      ? `AKP-INV-REP-${todayStr.replace(/-/g, '')}-01`
      : reportCategory === 'DAILY_PRODUCTION'
      ? `AKP-PRD-REP-${todayStr.replace(/-/g, '')}-02`
      : reportCategory === 'MASTER_EXECUTIVE'
      ? `AKP-OPS-EXEC-${todayStr.replace(/-/g, '')}-00`
      : `AKP-DOC-TAB${activeReportTabId}-${todayStr.replace(/-/g, '')}`;

  const qrVerificationPayload = JSON.stringify({
    factory: 'Al-Karwan Plastic Industry Co.',
    documentNumber: reportCode,
    type: reportCategory,
    dateFrom,
    dateTo,
    stockKG: totalCurrentStockKG,
    shredOutputKG: totalShreddingOutputKG,
    issuedKG: totalIssuedKG,
    verifiedBy: currentUser?.name || 'System Admin',
  });

  const getReportTitle = () => {
    switch (reportCategory) {
      case 'DAILY_INVENTORY':
        return {
          ar: 'تقرير حركة وأرصدة المخزون اليومي ومستودعات الشلايف',
          en: 'Daily Inventory Balances, Movements & Bulk Bags Valuation Report',
          docType: 'FORM-WH-INV-01',
        };
      case 'DAILY_PRODUCTION':
        return {
          ar: 'تقرير تشغيل خطوط الإنتاج والثرم وصرف المواد اليومي',
          en: 'Daily Production, Shredding Operations & Material Feed Report',
          docType: 'FORM-PRD-THM-02',
        };
      case 'MASTER_EXECUTIVE':
        return {
          ar: 'التقرير التشغيلي والتنفيذي الموحد (المخزون والإنتاج والقبان)',
          en: 'Executive Consolidated Daily Operations Report (Inventory & Production)',
          docType: 'FORM-EXEC-OPS-00',
        };
      case 'CURRENT_VIEW':
      default:
        return {
          ar: 'تقرير الكشف الدفتري والتحليلي المعتمد (النموذج المختار)',
          en: 'Official Certified Analytical Subledger & Operational Statement',
          docType: 'FORM-REP-SPEC-09',
        };
    }
  };

  const currentReportTitles = getReportTitle();

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    setDownloadSuccess(false);

    try {
      const fileName = `AlKarwan_${reportCategory}_${dateFrom}_to_${dateTo}.pdf`;
      await generateReportPdfFromElement(printRef.current, {
        fileName,
        landscape: isLandscape,
        reportTitle: currentReportTitles.ar,
        documentNumber: reportCode,
        author: currentUser?.name || 'Al-Karwan Quality & Audit',
      });
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF document via jsPDF:', err);
      alert(isRTL ? 'حدث خطأ أثناء إنشاء ملف PDF' : 'Error generating PDF document');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden">
        {/* MODAL CONTROL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-900/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {isRTL
                    ? 'منظومة إصدار وثائق وتقارير PDF المعتمدة (jsPDF Engine)'
                    : 'Formatted PDF Document Generator & Exporter'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  A4 HIGH-RES
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'توليد كشوفات يومية رسمية للمخزون والإنتاج بجودة عالية قابلة للحفظ والطباعة والأرشفة'
                  : 'Client-side PDF document compiler for daily inventory balances, shredding & production logs'}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
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
              className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-900/50'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-950/50 hover:scale-[1.02]'
              }`}
            >
              {isGeneratingPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : downloadSuccess ? (
                <Check className="w-4 h-4 text-white" />
              ) : (
                <Download className="w-4 h-4 text-white" />
              )}
              <span>
                {isGeneratingPdf
                  ? isRTL ? 'جارٍ تحويل ومعالجة PDF...' : 'Rendering PDF with jsPDF...'
                  : downloadSuccess
                  ? isRTL ? 'تم التنزيل بنجاح!' : 'Downloaded Successfully!'
                  : isRTL ? 'تنزيل مستند PDF المعتمد' : 'Download Formatted PDF'}
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

        {/* CUSTOMIZATION & REPORT SCOPE CONTROLS STRIP */}
        <div className="p-3 sm:px-6 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center flex-wrap gap-1.5 font-bold">
            <button
              onClick={() => setReportCategory('DAILY_INVENTORY')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                reportCategory === 'DAILY_INVENTORY'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>{isRTL ? 'تقرير المخزون والأرصدة' : 'Daily Inventory'}</span>
            </button>

            <button
              onClick={() => setReportCategory('DAILY_PRODUCTION')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                reportCategory === 'DAILY_PRODUCTION'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{isRTL ? 'تقرير الإنتاج والتشغيل' : 'Daily Production'}</span>
            </button>

            <button
              onClick={() => setReportCategory('MASTER_EXECUTIVE')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                reportCategory === 'MASTER_EXECUTIVE'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isRTL ? 'التقرير الشامل الموحد' : 'Master Executive'}</span>
            </button>

            <button
              onClick={() => setReportCategory('CURRENT_VIEW')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                reportCategory === 'CURRENT_VIEW'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isRTL ? 'الجدول الحالي المفتوح' : 'Active Tab'}</span>
            </button>
          </div>

          {/* Date Range & Shift Filter */}
          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-white outline-none"
              />
              <span className="text-slate-500">➔</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-white outline-none"
              />
            </div>

            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-300 outline-none font-sans"
            >
              <option value="ALL">{isRTL ? 'كافة الورديات (24 ساعة)' : 'All Shifts'}</option>
              <option value="Morning">{isRTL ? 'الوردية الصباحية' : 'Morning Shift'}</option>
              <option value="Evening">{isRTL ? 'الوردية المسائية' : 'Evening Shift'}</option>
              <option value="Night">{isRTL ? 'الوردية الليلية' : 'Night Shift'}</option>
            </select>
          </div>

          {/* Document Display Toggles */}
          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeKpis}
                onChange={(e) => setIncludeKpis(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-950 border-slate-700"
              />
              <span>{isRTL ? 'مؤشرات KPI' : 'KPIs'}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-950 border-slate-700"
              />
              <span>{isRTL ? 'أختام وتواقيع' : 'Signatures'}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeQrCode}
                onChange={(e) => setIncludeQrCode(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-950 border-slate-700"
              />
              <span>{isRTL ? 'رمز QR' : 'QR Code'}</span>
            </label>

            <button
              onClick={() => setIsLandscape(!isLandscape)}
              className={`px-2 py-0.5 rounded border text-[10px] font-mono cursor-pointer ${
                isLandscape
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isLandscape ? 'A4 Landscape' : 'A4 Portrait'}
            </button>
          </div>
        </div>

        {/* DOCUMENT PREVIEW CONTAINER (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/70 flex justify-center">
          {/* THE PRINTABLE A4 ELEMENT - CAPTURED BY HTML2CANVAS & JSPDF */}
          <div
            ref={printRef}
            id="alkarwan-formatted-pdf-document"
            className="bg-white text-slate-900 shadow-2xl p-6 sm:p-8 rounded-lg font-sans border border-slate-300"
            style={{
              width: isLandscape ? '1120px' : '820px',
              minHeight: isLandscape ? '790px' : '1160px',
              boxSizing: 'border-box',
            }}
            dir="rtl"
          >
            {/* OFFICIAL INDUSTRIAL LETTERHEAD */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between gap-4">
                {/* Right: Company Arabic Title & Details */}
                <div className="text-start space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-950 flex items-center justify-center text-white font-black text-sm">
                      K
                    </div>
                    <div>
                      <h1 className="text-lg font-black text-slate-950 leading-tight">
                        شركة الكروان لصناعة البلاستيك المحدودة
                      </h1>
                      <div className="text-[11px] font-bold text-slate-600">
                        AL-KARWAN FOR PLASTIC INDUSTRY CO. W.L.L.
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal pt-1">
                    مصنع إنتاج حبيبات ورولات وألواح البلاستيك ومستودعات التخزين المركزية | بغداد - العراق
                  </div>
                </div>

                {/* Center: Official Document Badge */}
                <div className="text-center px-4 py-2 bg-slate-100 border border-slate-300 rounded-xl">
                  <span className="text-[10px] font-mono font-bold text-slate-700 block uppercase">
                    {currentReportTitles.docType}
                  </span>
                  <span className="text-xs font-black text-blue-950 block mt-0.5">
                    وثيقة تشغيلية رسمية معتمدة
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 block">
                    ISO 9001:2015 / GMP Certified Log
                  </span>
                </div>

                {/* Left: Document Identifiers & QR Code */}
                <div className="flex items-center gap-3 text-end">
                  <div className="text-[10px] font-mono text-slate-600 space-y-0.5">
                    <div>
                      <span className="text-slate-400">رقم الوثيقة: </span>
                      <strong className="text-slate-900">{reportCode}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">تاريخ الإصدار: </span>
                      <strong className="text-slate-900">{todayStr}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">الفترة: </span>
                      <strong className="text-slate-900">{dateFrom} ➔ {dateTo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">الوردية: </span>
                      <strong className="text-slate-900">
                        {selectedShift === 'ALL' ? 'كافة الورديات (24h)' : selectedShift}
                      </strong>
                    </div>
                  </div>

                  {includeQrCode && (
                    <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-xs">
                      <QRCodeSVG value={qrVerificationPayload} size={54} level="M" />
                    </div>
                  )}
                </div>
              </div>

              {/* Document Banner Strip */}
              <div className="mt-3.5 p-2.5 bg-blue-950 text-white rounded-lg flex items-center justify-between text-xs">
                <div>
                  <h2 className="font-black text-sm tracking-wide text-white">
                    {currentReportTitles.ar}
                  </h2>
                  <div className="text-[10px] text-blue-200 font-mono">
                    {currentReportTitles.en}
                  </div>
                </div>

                <div className="text-end font-mono text-[11px] text-blue-200">
                  <span>المشرف المسؤول: </span>
                  <strong className="text-white">{currentUser?.nameAr || currentUser?.name || 'حيدر الكرخي'}</strong>
                </div>
              </div>
            </div>

            {/* SUPERVISOR DIRECTIVE & OPERATIONAL NOTE */}
            {supervisorNotes && (
              <div className="mb-4 p-2.5 bg-slate-50 border-s-4 border-blue-900 rounded-r text-[11px] text-slate-800 leading-relaxed">
                <strong className="text-blue-950">التوجيه الإداري والتشغيلي: </strong>
                <span>{supervisorNotes}</span>
              </div>
            )}

            {/* EXECUTIVE METRICS KPI RIBBON (OPTIONAL) */}
            {includeKpis && (
              <div className="grid grid-cols-5 gap-2.5 mb-4 text-center">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-slate-500">
                    استلام القبان (مستند 546)
                  </div>
                  <div className="text-base font-mono font-black text-slate-900 mt-0.5">
                    {(totalReceivedKG / 1000).toFixed(1)}{' '}
                    <span className="text-[10px] font-sans text-slate-500">طن</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {totalReceivedBags} شليف خام
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-slate-500">
                    إنتاج الثرم (مستند 360)
                  </div>
                  <div className="text-base font-mono font-black text-blue-900 mt-0.5">
                    {(totalShreddingOutputKG / 1000).toFixed(1)}{' '}
                    <span className="text-[10px] font-sans text-slate-500">طن</span>
                  </div>
                  <div className="text-[9px] text-emerald-700 font-bold">
                    كفاءة: {shreddingYieldPercentage}%
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-slate-500">
                    صرف الإنتاج (مستند 167)
                  </div>
                  <div className="text-base font-mono font-black text-indigo-900 mt-0.5">
                    {(totalIssuedKG / 1000).toFixed(1)}{' '}
                    <span className="text-[10px] font-sans text-slate-500">طن</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {totalIssuedBags} شليف مغذى
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-slate-500">
                    رصيد المخزون الفعلي
                  </div>
                  <div className="text-base font-mono font-black text-emerald-800 mt-0.5">
                    {(totalCurrentStockKG / 1000).toFixed(1)}{' '}
                    <span className="text-[10px] font-sans text-slate-500">طن</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {totalCurrentBags} شليف مخزن
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[9px] uppercase font-bold text-slate-500">
                    التالف وسكراب العمليات
                  </div>
                  <div className="text-base font-mono font-black text-rose-700 mt-0.5">
                    {totalShreddingDamageKG.toLocaleString()}{' '}
                    <span className="text-[10px] font-sans text-slate-500">كغم</span>
                  </div>
                  <div className="text-[9px] text-slate-500">
                    ضمن الهامش المسموح
                  </div>
                </div>
              </div>
            )}

            {/* REPORT-SPECIFIC TABLES CONTENT */}

            {/* 1. DAILY INVENTORY REPORT */}
            {reportCategory === 'DAILY_INVENTORY' && (
              <div className="space-y-4">
                {/* Table: Inventory Balances */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-blue-900" />
                      <span>جدول أرصدة المواد والشلايف بمستودعات المصنع</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">
                      إجمالي الأصناف: {inventoryBalances.length}
                    </span>
                  </div>

                  <table className="w-full text-start text-[10px] border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 text-start">الكود</th>
                        <th className="p-1.5 text-start">اسم المادة / الصنف</th>
                        <th className="p-1.5 text-start">التصنيف</th>
                        <th className="p-1.5 text-end text-emerald-800">الوارد (+)</th>
                        <th className="p-1.5 text-end text-rose-800">المنصرف (-)</th>
                        <th className="p-1.5 text-end text-blue-950 font-black">الرصيد الفعلي (كغم)</th>
                        <th className="p-1.5 text-center font-bold">الشلايف</th>
                        <th className="p-1.5 text-center">حالة المخزون</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {inventoryBalances.slice(0, 10).map((b) => (
                        <tr key={b.materialId} className="hover:bg-slate-50">
                          <td className="p-1.5 font-mono font-bold text-slate-700">{b.materialCode}</td>
                          <td className="p-1.5 font-bold text-slate-900">{b.materialName}</td>
                          <td className="p-1.5 text-slate-600">{b.category}</td>
                          <td className="p-1.5 text-end font-mono text-emerald-700">
                            +{(b.totalInKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-end font-mono text-rose-700">
                            -{(b.totalOutKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-end font-mono font-black text-slate-950">
                            {(b.totalBalanceKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-amber-700">
                            {b.bulkBagsCount}
                          </td>
                          <td className="p-1.5 text-center">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                b.totalBalanceKG === 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : b.totalBalanceKG < 5000
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {b.totalBalanceKG === 0
                                ? 'نفاد'
                                : b.totalBalanceKG < 5000
                                ? 'حرج'
                                : 'مستقر'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-slate-900">
                      <tr>
                        <td colSpan={3} className="p-1.5 text-start">
                          الإجمالي الكلي لمخزون المصنع:
                        </td>
                        <td className="p-1.5 text-end font-mono text-emerald-800">
                          +{inventoryBalances.reduce((s, b) => s + (b.totalInKG || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-end font-mono text-rose-800">
                          -{inventoryBalances.reduce((s, b) => s + (b.totalOutKG || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-end font-mono font-black text-blue-950">
                          {totalCurrentStockKG.toLocaleString()} كغم
                        </td>
                        <td className="p-1.5 text-center font-mono text-amber-800 font-black">
                          {totalCurrentBags}
                        </td>
                        <td className="p-1.5 text-center text-slate-500">مطابق للدفتر</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Table: Daily Movements */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-900" />
                      <span>حركات النقل والتحويل الداخلي للشلايف بين المستودعات والصوامع</span>
                    </h3>
                  </div>

                  <table className="w-full text-start text-[10px] border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 text-start">التاريخ</th>
                        <th className="p-1.5 text-start">نوع الحركة</th>
                        <th className="p-1.5 text-start">المادة المنقولة</th>
                        <th className="p-1.5 text-start">من موقع</th>
                        <th className="p-1.5 text-start">إلى موقع</th>
                        <th className="p-1.5 text-end font-black">الكمية (كغم)</th>
                        <th className="p-1.5 text-center">الشلايف</th>
                        <th className="p-1.5 text-start">المسؤول</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredMovements.slice(0, 6).map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="p-1.5 font-mono text-slate-600">{m.date}</td>
                          <td className="p-1.5 font-bold text-blue-900">{m.movementType}</td>
                          <td className="p-1.5 text-slate-800">{m.materialName}</td>
                          <td className="p-1.5 text-slate-600">{m.sourceWarehouse || 'الساحة'}</td>
                          <td className="p-1.5 text-slate-900 font-medium">{m.targetWarehouse || 'مستودع 02'}</td>
                          <td className="p-1.5 text-end font-mono font-bold text-slate-900">
                            {(m.quantityKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-center font-mono text-amber-700">{m.bulkBagsCount || 1}</td>
                          <td className="p-1.5 text-slate-600">{m.operator || 'أمين المستودع'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. DAILY PRODUCTION REPORT */}
            {reportCategory === 'DAILY_PRODUCTION' && (
              <div className="space-y-4">
                {/* Table: Daily Shredding Operations (Doc 360) */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-blue-900" />
                      <span>بيان تشغيل ماكينات الثرم والجرش (مستند 360/352)</span>
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">
                      إجمالي المعالجة: {filteredShredding.length} دورة
                    </span>
                  </div>

                  <table className="w-full text-start text-[10px] border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 text-start">رقم الدورة</th>
                        <th className="p-1.5 text-start">مستند 360</th>
                        <th className="p-1.5 text-start">الماكينة</th>
                        <th className="p-1.5 text-start">المادة الخام</th>
                        <th className="p-1.5 text-end">التغذية الخام (كغم)</th>
                        <th className="p-1.5 text-end text-emerald-800 font-black">الناتج المفروم (كغم)</th>
                        <th className="p-1.5 text-end text-rose-800">الهادر (كغم)</th>
                        <th className="p-1.5 text-center">نسبة الكفاءة</th>
                        <th className="p-1.5 text-center">الشلايف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredShredding.map((s) => {
                        const yieldRate = s.inputKG > 0 ? ((s.outputKG / s.inputKG) * 100).toFixed(1) : '100';
                        return (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="p-1.5 font-mono font-bold text-slate-700">{s.shreddingNumber}</td>
                            <td className="p-1.5 font-mono text-blue-900 font-bold">{s.legacyDocumentNumber}</td>
                            <td className="p-1.5 text-slate-700">{s.machineId}</td>
                            <td className="p-1.5 font-bold text-slate-900">{s.materialName}</td>
                            <td className="p-1.5 text-end font-mono">{(s.inputKG || 0).toLocaleString()}</td>
                            <td className="p-1.5 text-end font-mono font-black text-emerald-800">
                              {(s.outputKG || 0).toLocaleString()}
                            </td>
                            <td className="p-1.5 text-end font-mono text-rose-700">
                              {(s.productionDamageKG || 0).toLocaleString()}
                            </td>
                            <td className="p-1.5 text-center font-mono font-bold text-slate-800">
                              {yieldRate}%
                            </td>
                            <td className="p-1.5 text-center font-mono font-bold text-amber-700">
                              {s.bulkBagsCount || 1}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-slate-900">
                      <tr>
                        <td colSpan={4} className="p-1.5 text-start">
                          مجموع وردية الثرم اليومية:
                        </td>
                        <td className="p-1.5 text-end font-mono">{totalShreddingInputKG.toLocaleString()} كغم</td>
                        <td className="p-1.5 text-end font-mono font-black text-emerald-800">
                          {totalShreddingOutputKG.toLocaleString()} كغم
                        </td>
                        <td className="p-1.5 text-end font-mono text-rose-800">
                          {totalShreddingDamageKG.toLocaleString()} كغم
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold text-blue-950">
                          {shreddingYieldPercentage}%
                        </td>
                        <td className="p-1.5 text-center font-mono text-amber-800 font-black">
                          {filteredShredding.reduce((s, r) => s + (r.bulkBagsCount || 0), 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Table: Production Issues to Extruder Lines (Doc 167) */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Factory className="w-3.5 h-3.5 text-blue-900" />
                      <span>أوامر صرف وتغذية المواد لخطوط البثق والتشكيل (مستند 167)</span>
                    </h3>
                  </div>

                  <table className="w-full text-start text-[10px] border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 text-start">رقم الصرف</th>
                        <th className="p-1.5 text-start">مستند 167</th>
                        <th className="p-1.5 text-start">أمر الإنتاج (PO)</th>
                        <th className="p-1.5 text-start">خط الماكينة</th>
                        <th className="p-1.5 text-start">المادة المصروفة</th>
                        <th className="p-1.5 text-end font-black text-blue-950">الكمية المصروفة (كغم)</th>
                        <th className="p-1.5 text-center">الشلايف</th>
                        <th className="p-1.5 text-start">الوردية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredProductionIssues.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-1.5 font-mono text-slate-700 font-bold">{p.issueNumber}</td>
                          <td className="p-1.5 font-mono text-blue-900 font-bold">{p.legacyDocumentNumber}</td>
                          <td className="p-1.5 font-mono text-slate-700">{p.productionOrderNumber || 'PO-2026'}</td>
                          <td className="p-1.5 font-bold text-slate-900">{p.machineLine}</td>
                          <td className="p-1.5 text-slate-800">{p.materialName}</td>
                          <td className="p-1.5 text-end font-mono font-black text-slate-950">
                            {(p.quantityKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-amber-700">
                            {p.bulkBagsCount || 1}
                          </td>
                          <td className="p-1.5 text-slate-600">{p.shift || 'صباحي'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-300 text-slate-900">
                      <tr>
                        <td colSpan={5} className="p-1.5 text-start">
                          إجمالي المواد المسلمة للإنتاج:
                        </td>
                        <td className="p-1.5 text-end font-mono font-black text-blue-950">
                          {totalIssuedKG.toLocaleString()} كغم
                        </td>
                        <td className="p-1.5 text-center font-mono text-amber-800 font-black">
                          {totalIssuedBags}
                        </td>
                        <td className="p-1.5 text-slate-500">تم التسليم والتغذية</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 3. MASTER EXECUTIVE OPERATIONS REPORT */}
            {reportCategory === 'MASTER_EXECUTIVE' && (
              <div className="space-y-4">
                {/* Weighbridge Intake Summary */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-900" />
                      <span>1. حركة استلامات القبان والشاحنات (مستند 546)</span>
                    </h3>
                  </div>
                  <table className="w-full text-start text-[10px] border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 text-start">رقم المستند</th>
                        <th className="p-1.5 text-start">المورد</th>
                        <th className="p-1.5 text-start">المادة المستلمة</th>
                        <th className="p-1.5 text-end">وزن الدخول (Gross)</th>
                        <th className="p-1.5 text-end">وزن الخروج (Tare)</th>
                        <th className="p-1.5 text-end font-black text-blue-950">الصافي (كغم)</th>
                        <th className="p-1.5 text-center">الشلايف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredReceiving.map((r) => (
                        <tr key={r.id}>
                          <td className="p-1.5 font-mono font-bold text-blue-900">{r.legacyDocumentNumber}</td>
                          <td className="p-1.5 font-bold text-slate-900">{r.supplierName}</td>
                          <td className="p-1.5 text-slate-700">{r.materialName}</td>
                          <td className="p-1.5 text-end font-mono">{(r.scaleInWeightKG || 0).toLocaleString()}</td>
                          <td className="p-1.5 text-end font-mono">{(r.scaleOutWeightKG || 0).toLocaleString()}</td>
                          <td className="p-1.5 text-end font-mono font-black text-slate-950">
                            {(r.netReceivedWeightKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-amber-700">
                            {r.bulkBagsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Shredding & Extruder Production Summary */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Factory className="w-3.5 h-3.5 text-blue-900" />
                      <span>2. كشف تشغيل وحدات المعالجة وتغذية المصنع (360 / 167)</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px]">
                    <div className="p-2.5 bg-slate-50 border border-slate-300 rounded">
                      <div className="font-bold text-blue-950 mb-1">وحدة الثرم والتحبيب:</div>
                      <div className="flex justify-between py-0.5 border-b border-slate-200">
                        <span>إجمالي التغذية الخام:</span>
                        <strong className="font-mono">{totalShreddingInputKG.toLocaleString()} كغم</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-200">
                        <span>الناتج المفروم الصافي:</span>
                        <strong className="font-mono text-emerald-800">{totalShreddingOutputKG.toLocaleString()} كغم</strong>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>نسبة الكفاءة التشغيلية:</span>
                        <strong className="font-mono text-blue-950">{shreddingYieldPercentage}%</strong>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-50 border border-slate-300 rounded">
                      <div className="font-bold text-blue-950 mb-1">وحدة التغذية والبثق (Extrusion):</div>
                      <div className="flex justify-between py-0.5 border-b border-slate-200">
                        <span>إجمالي المنصرف لخطوط البثق:</span>
                        <strong className="font-mono text-indigo-900">{totalIssuedKG.toLocaleString()} كغم</strong>
                      </div>
                      <div className="flex justify-between py-0.5 border-b border-slate-200">
                        <span>عدد الشلايف المغذاة:</span>
                        <strong className="font-mono text-amber-800">{totalIssuedBags} شليف</strong>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>الخطوط العاملة:</span>
                        <strong className="text-slate-800">خط البثق 01، خط 02، تشكيل حراري</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* End-of-day Inventory Balances */}
                <div>
                  <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-300">
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-blue-900" />
                      <span>3. رصيد المخزون الختامي نهاية اليوم</span>
                    </h3>
                  </div>
                  <table className="w-full text-start text-[10px] border border-slate-300">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 text-start">الكود</th>
                        <th className="p-1.5 text-start">المادة</th>
                        <th className="p-1.5 text-start">التصنيف</th>
                        <th className="p-1.5 text-end font-black text-blue-950">الرصيد الفعلي (كغم)</th>
                        <th className="p-1.5 text-center">الشلايف</th>
                        <th className="p-1.5 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {inventoryBalances.slice(0, 6).map((b) => (
                        <tr key={b.materialId}>
                          <td className="p-1.5 font-mono font-bold text-slate-700">{b.materialCode}</td>
                          <td className="p-1.5 font-bold text-slate-900">{b.materialName}</td>
                          <td className="p-1.5 text-slate-600">{b.category}</td>
                          <td className="p-1.5 text-end font-mono font-black text-slate-950">
                            {(b.totalBalanceKG || 0).toLocaleString()}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-amber-700">{b.bulkBagsCount}</td>
                          <td className="p-1.5 text-center">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              معتمد
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. CURRENT ACTIVE VIEW (FALLBACK/GENERIC VIEW) */}
            {reportCategory === 'CURRENT_VIEW' && (
              <div className="space-y-4">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                  عرض تحليلي موثق للجدول الدفتري المختار (رقم {activeReportTabId}) للفترة من {dateFrom} إلى {dateTo}.
                </div>

                <table className="w-full text-start text-[10px] border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-1.5 text-start">#</th>
                      <th className="p-1.5 text-start">المادة / المستند</th>
                      <th className="p-1.5 text-start">التصنيف / المورد</th>
                      <th className="p-1.5 text-end font-black">الكمية / الوزن (كغم)</th>
                      <th className="p-1.5 text-center">الشلايف</th>
                      <th className="p-1.5 text-center">الحالة الدفترية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {inventoryBalances.slice(0, 12).map((item, idx) => (
                      <tr key={item.materialId} className="hover:bg-slate-50">
                        <td className="p-1.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="p-1.5 font-bold text-slate-900">{item.materialName} ({item.materialCode})</td>
                        <td className="p-1.5 text-slate-700">{item.category}</td>
                        <td className="p-1.5 text-end font-mono font-black text-slate-950">
                          {(item.totalBalanceKG || 0).toLocaleString()}
                        </td>
                        <td className="p-1.5 text-center font-mono font-bold text-amber-700">
                          {item.bulkBagsCount}
                        </td>
                        <td className="p-1.5 text-center">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-900">
                            مطابق وموثق
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* OFFICIAL AUDIT, STAMP & SIGNATURES BLOCK */}
            {includeSignatures && (
              <div className="mt-8 pt-4 border-t-2 border-slate-900 text-xs">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      مُعِد التقرير (أمين المستودع)
                    </div>
                    <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-bold text-slate-800 text-xs">
                        {currentUser?.nameAr || currentUser?.name || 'علي الكرخي'}
                      </span>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400">التوقيع والاعتماد</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      مشرف خطوط الإنتاج والثرم
                    </div>
                    <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-bold text-slate-800 text-xs">عمار عبد الزهرة</span>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400">التوقيع والاعتماد</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      مسؤول الجودة والتدقيق (QC)
                    </div>
                    <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-bold text-slate-800 text-xs">م. حيدر الساعدي</span>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400">مطابقة المواصفة</div>
                  </div>

                  <div className="space-y-1 relative">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      مدير عام المصنع (الاعتماد النهائي)
                    </div>
                    <div className="h-10 border-b border-dashed border-slate-300 flex items-end justify-center pb-1">
                      <span className="font-bold text-blue-950 text-xs">إدارة شركة الكروان</span>
                    </div>
                    <div className="text-[9px] font-mono text-slate-400">الختم والتصديق</div>

                    {/* Stamp Watermark Visual */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 border-dashed border-blue-900/30 flex flex-col items-center justify-center text-[8px] font-bold text-blue-900/40 rotate-12 pointer-events-none">
                      <span>شركة الكروان</span>
                      <span>مُعتمد رسمي</span>
                      <span>{todayStr.slice(0, 4)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Disclaimers */}
                <div className="mt-6 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  <span>تم التوليد آلياً عبر نظام إدارة مصنع الكروان | محرك jsPDF للطباعة الدقيقة</span>
                  <span>الرمز المرجعي: {reportCode}</span>
                  <span>صفحة 1 من 1</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
