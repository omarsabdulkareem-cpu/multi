import React, { useState } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Truck,
  Flame,
  Factory,
  Boxes,
  Users,
  AlertOctagon,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  FileText,
  Phone,
  MessageCircle,
  Building2,
  PackageX,
  ExternalLink,
  Copy,
  Check,
  Search,
  Printer,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { SafetyStockPdfModal } from './SafetyStockPdfModal';
import { DailyOperationsReportPdfModal, ReportCategoryType } from './DailyOperationsReportPdfModal';
import { LowStockAlert } from '../services/lowStockMonitor';

export const ReportsModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const {
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    inventoryBalances,
    pendingActions,
    suppliers,
    inventoryMovements,
    productionDamages,
    lowStockOverview,
    materials,
    setCurrentPage,
    setSelectedMaterialId,
  } = useFactory();

  const [selectedReportId, setSelectedReportId] = useState<number>(13); // Default to the new urgent safety stock & supplier outreach report
  const [dateFrom, setDateFrom] = useState('2026-09-01');
  const [dateTo, setDateTo] = useState('2026-09-02');
  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
  const [isDailyReportPdfModalOpen, setIsDailyReportPdfModalOpen] = useState<boolean>(false);
  const [dailyReportCategory, setDailyReportCategory] = useState<ReportCategoryType>('DAILY_INVENTORY');
  const [safetyFilter, setSafetyFilter] = useState<'ALL_LOW' | 'OUT_OF_STOCK' | 'CRITICAL' | 'ALL'>('ALL_LOW');
  const [safetySearch, setSafetySearch] = useState<string>('');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const reportTypes = [
    {
      id: 13,
      nameAr: 'تقرير نواقص المخزون والتوريد العاجل (حدود الأمان وموردي الخامات)',
      nameEn: 'Safety Stock Deficits & Urgent Supplier Outreach Report',
      icon: AlertTriangle,
      badge: lowStockOverview.materialsNeedingProcurement > 0 ? `${lowStockOverview.materialsNeedingProcurement}` : undefined,
    },
    { id: 1, nameAr: 'تقرير الاستلام اليومي (مستند 546)', nameEn: 'Daily Receiving Report (Doc 546)', icon: Truck },
    { id: 2, nameAr: 'تقرير الثرم اليومي (مستند 360/352)', nameEn: 'Daily Shredding Report (Doc 360/352)', icon: Flame },
    { id: 3, nameAr: 'تقرير حركات الخزن والمستودعات', nameEn: 'Storage & Warehouse Movements', icon: Boxes },
    { id: 4, nameAr: 'تقرير صرف المواد للإنتاج (مستند 167)', nameEn: 'Production Issue Report (Doc 167)', icon: Factory },
    { id: 5, nameAr: 'تقرير أرصدة المخزون والشلايف', nameEn: 'Stock Balances & Bulk Bags Valuation', icon: BarChart3 },
    { id: 6, nameAr: 'تقرير أداء وحمولات الموردين', nameEn: 'Supplier Delivery Performance', icon: Users },
    { id: 7, nameAr: 'تقرير حركة وتتبع الشلايف (شليف)', nameEn: 'Bulk Bag Tracking & Balance Report', icon: Boxes },
    { id: 8, nameAr: 'تقرير تالف الإنتاج والسكراب', nameEn: 'Production Damage & Scrap Analysis', icon: TrendingUp },
    { id: 9, nameAr: 'تقرير المعاملات غير المكتملة', nameEn: 'Pending & Stalled Transactions Report', icon: AlertOctagon },
    { id: 10, nameAr: 'تقرير الفروقات ونسب الهدر', nameEn: 'Variance & Loss Tolerance Analysis', icon: Flame },
    { id: 11, nameAr: 'كشف حركة بطاقات الأصناف', nameEn: 'Consolidated Material Card Subledger', icon: FileSpreadsheet },
    { id: 12, nameAr: 'تقرير سجل التدقيق والامتثال', nameEn: 'Audit & Compliance Integrity Log', icon: ShieldCheck },
  ];

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleExportCSV = () => {
    let rows: any[] = [];
    let headers: string[] = [];
    let title = 'REPORT';

    if (selectedReportId === 13) {
      title = 'SAFETY_STOCK_DEFICIT_OUTREACH';
      headers = [
        'Material Code',
        'Material Name (Ar)',
        'Material Name (En)',
        'Category',
        'Current Stock KG',
        'Current Bags',
        'Safety Min Threshold KG',
        'Deficit Below Safety KG',
        'Recommended Reorder KG',
        'Recommended Bags',
        'Stock Status',
        'Primary Supplier',
        'Contact Person',
        'Supplier Phone',
      ];
      rows = lowStockOverview.alerts.map((a) => {
        const sup = a.matchingSuppliers?.[0] || suppliers.find((s) => s.status === 'Active');
        return [
          a.materialCode,
          `"${a.materialNameAr}"`,
          `"${a.materialNameEn}"`,
          a.category,
          a.currentStockKG,
          a.currentBagsCount,
          a.minStockKG,
          a.deficitKG,
          a.recommendedReorderKG,
          a.recommendedReorderBags,
          a.severity,
          sup ? `"${sup.nameAr}"` : 'N/A',
          sup ? `"${sup.contactPerson}"` : 'N/A',
          sup ? `"${sup.phone}"` : 'N/A',
        ];
      });
    } else if (selectedReportId === 1) {
      title = 'RECEIVING_REPORT_DOC_546';
      headers = ['Tx #', 'Doc 546', 'Date', 'Supplier', 'Material', 'Gross Scale In', 'Tare Scale Out', 'Net Received KG', 'Bulk Bags'];
      rows = receivingTransactions.map((r) => [
        r.transactionNumber,
        r.legacyDocumentNumber,
        r.date,
        r.supplierName,
        r.materialName,
        r.scaleInWeightKG,
        r.scaleOutWeightKG,
        r.netReceivedWeightKG,
        r.bulkBagsCount,
      ]);
    } else if (selectedReportId === 2) {
      title = 'SHREDDING_REPORT_DOC_360';
      headers = ['Job #', 'Doc 360', 'Material', 'Machine', 'Input KG', 'Output KG', 'Damage KG', 'Variance %'];
      rows = shreddingTransactions.map((s) => [
        s.shreddingNumber,
        s.legacyDocumentNumber,
        s.materialName,
        s.machineId,
        s.inputKG,
        s.outputKG,
        s.productionDamageKG,
        s.variancePercentage,
      ]);
    } else if (selectedReportId === 4) {
      title = 'PRODUCTION_ISSUES_DOC_167';
      headers = ['Issue #', 'Doc 167', 'Date', 'PO #', 'Material', 'Machine Line', 'Qty KG', 'Bulk Bags'];
      rows = productionIssues.map((p) => [
        p.issueNumber,
        p.legacyDocumentNumber,
        p.date,
        p.productionOrderNumber,
        p.materialName,
        p.machineLine,
        p.quantityKG,
        p.bulkBagsCount,
      ]);
    } else {
      title = 'INVENTORY_BALANCES_REPORT';
      headers = ['Material', 'Code', 'Category', 'Total In KG', 'Total Out KG', 'Available KG', 'Total Balance KG', 'Bulk Bags'];
      rows = inventoryBalances.map((b) => [
        b.materialName,
        b.materialCode,
        b.category,
        b.totalInKG,
        b.totalOutKG,
        b.availableKG,
        b.totalBalanceKG,
        b.bulkBagsCount,
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AL_KARWAN_${title}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items for report 13
  const displayedSafetyAlerts = lowStockOverview.alerts.filter((item) => {
    // Search filter
    if (safetySearch.trim()) {
      const q = safetySearch.toLowerCase();
      const matchText = `${item.materialCode} ${item.materialNameAr} ${item.materialNameEn} ${item.category}`.toLowerCase();
      const supText = item.matchingSuppliers?.map((s) => `${s.nameAr} ${s.nameEn} ${s.contactPerson} ${s.phone}`).join(' ').toLowerCase() || '';
      if (!matchText.includes(q) && !supText.includes(q)) return false;
    }

    // Severity filter
    if (safetyFilter === 'OUT_OF_STOCK') {
      return item.severity === 'OUT_OF_STOCK';
    }
    if (safetyFilter === 'CRITICAL') {
      return item.severity === 'OUT_OF_STOCK' || item.severity === 'CRITICAL';
    }
    if (safetyFilter === 'ALL_LOW') {
      return (
        item.severity === 'OUT_OF_STOCK' ||
        item.severity === 'CRITICAL' ||
        item.severity === 'WARNING'
      );
    }
    return true; // 'ALL'
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
              ANALYTICAL INTELLIGENCE
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'التقارير التحليلية والمستندات الدفترية' : 'Analytical Reports & Auditable Statements'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'مركز التقارير الفنية والتشغيلية للمصنع' : 'Factory Operational & Compliance Reporting'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'توليد التقارير اليومية للاستلام (546)، الثرم (360)، صرف الإنتاج (167)، وتقارير نواقص الأمان والتوريد مع تصدير PDF و Excel.'
              : 'Export official accounting & operations statements with PDF summary generation for safety stock outreach.'}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Formatted PDF Generation Button for Daily Inventory & Production */}
          <button
            onClick={() => {
              if ([2, 4, 8].includes(selectedReportId)) {
                setDailyReportCategory('DAILY_PRODUCTION');
              } else if ([1, 3, 5, 7, 11].includes(selectedReportId)) {
                setDailyReportCategory('DAILY_INVENTORY');
              } else {
                setDailyReportCategory('MASTER_EXECUTIVE');
              }
              setIsDailyReportPdfModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-950/50 cursor-pointer transition-all hover:scale-[1.02]"
            title={isRTL ? 'توليد وتنزيل وثيقة PDF رسمية للمخزون والإنتاج عبر jsPDF' : 'Generate and download formatted PDF documents for daily inventory and production reports'}
          >
            <FileText className="w-4 h-4 text-cyan-200" />
            <span>{isRTL ? 'إصدار تقرير PDF (المخزون والإنتاج)' : 'Export Formatted PDF (jsPDF)'}</span>
          </button>

          {/* Quick PDF Summary Button */}
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 cursor-pointer transition-all"
            title={isRTL ? 'توليد وطباعة تقرير PDF لنواقص المخزون والتواصل مع الموردين' : 'Generate Printable PDF Summary of Safety Stock Shortages'}
          >
            <FileText className="w-4 h-4" />
            <span>{isRTL ? 'كشف PDF لنواقص الأمان والموردين' : 'Safety Stock PDF Summary'}</span>
            {lowStockOverview.materialsNeedingProcurement > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/30 border border-white/20">
                {lowStockOverview.materialsNeedingProcurement}
              </span>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isRTL ? 'تصدير التقرير الحالي إلى Excel' : 'Export Current Report (Excel)'}</span>
          </button>
        </div>
      </div>

      {/* Persistent Alert Banner for Materials Under Safety Threshold */}
      {lowStockOverview.materialsNeedingProcurement > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-400 uppercase tracking-wide">
                  {isRTL ? 'تنبيه عجز المخزون الحرج' : 'Urgent Safety Stock Alert'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {lowStockOverview.materialsNeedingProcurement} {isRTL ? 'أصناف دون حد الأمان' : 'Items'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isRTL
                  ? `يوجد ${lowStockOverview.materialsNeedingProcurement} صنفاً دون حد الأمان الأدنى (إجمالي العجز ${(lowStockOverview.totalDeficitKG / 1000).toFixed(1)} طن، منها ${lowStockOverview.outOfStockCount} نفاد تام). جاهز للتواصل المباشر وتوليد ملف PDF معتمد.`
                  : `${lowStockOverview.materialsNeedingProcurement} materials have breached the safety threshold (${(lowStockOverview.totalDeficitKG / 1000).toFixed(1)}T deficit). Ready for immediate outreach and PDF dispatch.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedReportId !== 13 && (
              <button
                onClick={() => setSelectedReportId(13)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer transition-colors"
              >
                {isRTL ? 'عرض تقرير النواقص (REP-13)' : 'View Shortage Report'}
              </button>
            )}
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{isRTL ? 'توليد تقرير PDF معتمد' : 'Generate PDF Summary'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid of Report Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {reportTypes.map((rep) => {
          const Icon = rep.icon;
          const isSelected = selectedReportId === rep.id;
          const isUrgent = rep.id === 13 && lowStockOverview.materialsNeedingProcurement > 0;
          return (
            <button
              key={rep.id}
              onClick={() => setSelectedReportId(rep.id)}
              className={`p-3.5 rounded-xl border text-start transition-all cursor-pointer relative ${
                isSelected
                  ? isUrgent
                    ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                    : 'bg-blue-950/80 border-cyan-400 text-cyan-200 hud-glow-cyan shadow-lg'
                  : isUrgent
                  ? 'bg-rose-950/20 border-rose-500/30 text-slate-200 hover:border-rose-400'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between gap-2.5 mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isSelected ? (isUrgent ? 'text-rose-400' : 'text-cyan-400') : isUrgent ? 'text-rose-400' : 'text-slate-400'}`} />
                  <span className={`text-[10px] font-mono font-bold ${isUrgent ? 'text-rose-400' : 'text-cyan-400'}`}>
                    REP-{rep.id.toString().padStart(2, '0')}
                  </span>
                </div>
                {rep.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-rose-600 text-white animate-pulse">
                    {rep.badge}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold truncate">{isRTL ? rep.nameAr : rep.nameEn}</div>
            </button>
          );
        })}
      </div>

      {/* Report Workspace Container */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
        {/* Dynamic Header & Period Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              {selectedReportId === 13 && <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>
                {isRTL
                  ? reportTypes.find((r) => r.id === selectedReportId)?.nameAr
                  : reportTypes.find((r) => r.id === selectedReportId)?.nameEn}
              </span>
            </h3>
            {selectedReportId === 13 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'رصد مستمر للمواد التي هبط رصيدها دون حد الأمان الدفتري مع إمكانية التواصل الفوري مع الموردين وتوليد كشف PDF معتمد'
                  : 'Real-time monitoring of materials below safety thresholds with direct supplier outreach and PDF generator'}
              </p>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            {selectedReportId === 13 ? (
              <button
                onClick={() => setIsPdfModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold flex items-center gap-1.5 shadow-md shadow-rose-950 cursor-pointer transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>{isRTL ? 'توليد تقرير PDF معتمد' : 'Generate Official PDF'}</span>
              </button>
            ) : (
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-slate-400">{isRTL ? 'الفترة:' : 'Period:'}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                />
                <span className="text-slate-400">➔</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                />

                <button
                  onClick={() => {
                    if ([2, 4, 8].includes(selectedReportId)) {
                      setDailyReportCategory('DAILY_PRODUCTION');
                    } else if ([1, 3, 5, 7, 11].includes(selectedReportId)) {
                      setDailyReportCategory('DAILY_INVENTORY');
                    } else {
                      setDailyReportCategory('CURRENT_VIEW');
                    }
                    setIsDailyReportPdfModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950 cursor-pointer transition-all font-sans"
                  title={isRTL ? 'توليد وطباعة وثيقة PDF رسمية لهذا التقرير عبر jsPDF' : 'Generate formatted PDF document via jsPDF'}
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-200" />
                  <span>{isRTL ? 'إصدار وثيقة PDF' : 'Generate PDF'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SPECIALIZED REPORT VIEW: REPORT 13 (Safety Stock Deficit & Supplier Outreach) */}
        {selectedReportId === 13 && (
          <div className="space-y-5">
            {/* 5 KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {isRTL ? 'الأصناف دون حد الأمان' : 'Items Needing Order'}
                </div>
                <div className="text-2xl font-mono font-black text-rose-400 mt-1">
                  {lowStockOverview.materialsNeedingProcurement}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isRTL ? 'من إجمالي' : 'of'} {lowStockOverview.totalMaterials} {isRTL ? 'مادة مراقبة' : 'monitored'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {isRTL ? 'نفاد تام من المخازن' : 'Out of Stock (0 KG)'}
                </div>
                <div className="text-2xl font-mono font-black text-rose-500 mt-1">
                  {lowStockOverview.outOfStockCount}
                </div>
                <div className="text-[10px] text-rose-400/80 font-bold mt-0.5">
                  {lowStockOverview.outOfStockCount > 0 ? (isRTL ? 'خطوط الإنتاج مهددة' : 'Lines at risk') : (isRTL ? 'لا يوجد نفاد تام' : 'None')}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {isRTL ? 'إجمالي عجز الأمان' : 'Total Deficit (KG)'}
                </div>
                <div className="text-2xl font-mono font-black text-amber-400 mt-1">
                  {(lowStockOverview.totalDeficitKG / 1000).toFixed(1)}{' '}
                  <span className="text-xs font-sans text-slate-400">{isRTL ? 'طن' : 'T'}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {(lowStockOverview.totalDeficitKG ?? 0).toLocaleString()} KG
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {isRTL ? 'حجم التوريد الموصى به' : 'Recommended Reorder'}
                </div>
                <div className="text-2xl font-mono font-black text-cyan-400 mt-1">
                  {((lowStockOverview.totalRecommendedReorderKG ?? 0) / 1000).toFixed(1)}{' '}
                  <span className="text-xs font-sans text-slate-400">{isRTL ? 'طن' : 'T'}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  {(lowStockOverview.totalRecommendedReorderKG ?? 0).toLocaleString()} KG
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  {isRTL ? 'تقدير عدد الشلايف' : 'Est. Bulk Bags'}
                </div>
                <div className="text-2xl font-mono font-black text-indigo-400 mt-1">
                  ~{Math.ceil(lowStockOverview.totalRecommendedReorderKG / 500)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isRTL ? 'شليف سعة 500 كغم' : 'bags (500kg ea)'}
                </div>
              </div>
            </div>

            {/* Sub-Filters and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
              {/* Filter Pills */}
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  onClick={() => setSafetyFilter('ALL_LOW')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    safetyFilter === 'ALL_LOW'
                      ? 'bg-rose-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {isRTL ? 'كافة النواقص دون الأمان' : 'All Below Safety'} ({lowStockOverview.materialsNeedingProcurement})
                </button>
                <button
                  onClick={() => setSafetyFilter('OUT_OF_STOCK')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    safetyFilter === 'OUT_OF_STOCK'
                      ? 'bg-rose-700 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {isRTL ? 'النفاد التام (0 كغم)' : 'Out of Stock (0 KG)'} ({lowStockOverview.outOfStockCount})
                </button>
                <button
                  onClick={() => setSafetyFilter('CRITICAL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    safetyFilter === 'CRITICAL'
                      ? 'bg-amber-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {isRTL ? 'الحرج جداً (<50%)' : 'Critical (<50%)'} ({lowStockOverview.criticalCount})
                </button>
                <button
                  onClick={() => setSafetyFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    safetyFilter === 'ALL'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {isRTL ? 'كافة المواد المراقبة' : 'All Monitored Materials'} ({lowStockOverview.totalMaterials})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[240px]">
                <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={safetySearch}
                  onChange={(e) => setSafetySearch(e.target.value)}
                  placeholder={isRTL ? 'بحث بكود المادة أو اسم المورد...' : 'Search material or supplier...'}
                  className="w-full ps-9 pe-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-rose-500 font-mono"
                />
              </div>
            </div>

            {/* Interactive Safety Stock & Supplier Outreach Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-start text-xs font-mono">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'كود المادة' : 'Code'}</th>
                    <th className="p-3 text-start">{isRTL ? 'اسم المادة' : 'Material'}</th>
                    <th className="p-3 text-end">{isRTL ? 'المخزون الفعلي' : 'Current Stock'}</th>
                    <th className="p-3 text-end">{isRTL ? 'حد الأمان' : 'Safety Min'}</th>
                    <th className="p-3 text-end text-rose-400">{isRTL ? 'العجز' : 'Deficit'}</th>
                    <th className="p-3 text-end text-cyan-300">{isRTL ? 'طلب الشراء' : 'Reorder Qty'}</th>
                    <th className="p-3 text-center">{isRTL ? 'نسبة الأمان' : 'Coverage'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المورد المعتمد وبيانات الاتصال' : 'Approved Supplier Outreach'}</th>
                    <th className="p-3 text-center">{isRTL ? 'إجراء سريع' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedSafetyAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                        {isRTL ? 'لا توجد مواد تطابق شرط التصفية الحالي.' : 'No materials match the current filter.'}
                      </td>
                    </tr>
                  ) : (
                    displayedSafetyAlerts.map((item) => {
                      const isZero = item.currentStockKG === 0;
                      const primarySupplier = item.matchingSuppliers?.[0] || suppliers.find((s) => s.status === 'Active');
                      const cleanPhone = primarySupplier ? primarySupplier.phone.replace(/[^0-9+]/g, '') : '';
                      const isCopied = copiedPhone === primarySupplier?.phone;

                      return (
                        <tr
                          key={item.materialId}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isZero ? 'bg-rose-950/15' : ''
                          }`}
                        >
                          {/* Material Code */}
                          <td className="p-3">
                            <span className="font-mono font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                              {item.materialCode}
                            </span>
                            <div className="text-[10px] text-slate-500 font-sans mt-1">
                              {item.category}
                            </div>
                          </td>

                          {/* Material Name */}
                          <td className="p-3 font-sans">
                            <div className="font-bold text-slate-100">{item.materialNameAr}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.materialNameEn}</div>
                          </td>

                          {/* Current Stock */}
                          <td className="p-3 text-end">
                            <div
                              className={`font-black text-sm ${
                                isZero ? 'text-rose-500' : 'text-slate-100'
                              }`}
                            >
                              {(item.currentStockKG ?? 0).toLocaleString()} KG
                            </div>
                            <div className="text-[10px] text-amber-400 font-sans font-bold">
                              {item.currentBagsCount ?? 0} {isRTL ? 'شليف' : 'bags'}
                            </div>
                          </td>

                          {/* Safety Min */}
                          <td className="p-3 text-end text-slate-300 font-bold">
                            {(item.minStockKG ?? 0).toLocaleString()} KG
                          </td>

                          {/* Deficit */}
                          <td className="p-3 text-end font-bold text-rose-400">
                            {(item.deficitKG ?? 0) > 0 ? `-${(item.deficitKG ?? 0).toLocaleString()} KG` : '0 KG'}
                          </td>

                          {/* Reorder Qty */}
                          <td className="p-3 text-end">
                            <div className="font-black text-cyan-300 text-sm">
                              {(item.recommendedReorderKG ?? 0).toLocaleString()} KG
                            </div>
                            <div className="text-[10px] text-slate-400 font-sans">
                              ~{item.recommendedReorderBags ?? 0} {isRTL ? 'شليف' : 'bags'}
                            </div>
                          </td>

                          {/* Coverage Bar */}
                          <td className="p-3 text-center">
                            <div className="inline-flex flex-col items-center gap-1 w-24">
                              <span
                                className={`text-[10px] font-bold ${
                                  item.severity === 'OUT_OF_STOCK'
                                    ? 'text-rose-400'
                                    : item.severity === 'CRITICAL'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {item.coveragePercentage}%
                              </span>
                              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    item.severity === 'OUT_OF_STOCK'
                                      ? 'bg-rose-500'
                                      : item.severity === 'CRITICAL'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(100, item.coveragePercentage)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Approved Supplier Contact & Outreach */}
                          <td className="p-3 font-sans">
                            {primarySupplier ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-bold text-slate-200 text-xs truncate max-w-[160px]">
                                    {primarySupplier.nameAr}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  <span>{primarySupplier.contactPerson}</span>
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                  <a
                                    href={`tel:${cleanPhone}`}
                                    className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold hover:bg-emerald-900 transition-colors flex items-center gap-1"
                                    title={isRTL ? 'اتصال مباشر' : 'Call Supplier'}
                                  >
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{primarySupplier.phone}</span>
                                  </a>
                                  <button
                                    onClick={() => handleCopyPhone(primarySupplier.phone)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                    title={isRTL ? 'نسخ الرقم' : 'Copy Phone'}
                                  >
                                    {isCopied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">
                                {isRTL ? 'لم يُحدد مورد مباشر' : 'No direct supplier'}
                              </span>
                            )}
                          </td>

                          {/* Quick Action */}
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedMaterialId(item.materialId);
                                setCurrentPage('receiving');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-cyan-300 text-[11px] font-bold font-sans transition-all cursor-pointer whitespace-nowrap"
                              title={isRTL ? 'فتح نموذج استلام قبان (546) لهذه المادة' : 'Open Receiving Document (546)'}
                            >
                              {isRTL ? 'استلام (546)' : 'Receive 546'}
                            </button>
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

        {/* Dynamic Report Table Preview for Other Reports */}
        <div className="overflow-x-auto">
          {selectedReportId === 1 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Tx #</th>
                  <th className="p-3 text-start">Doc 546</th>
                  <th className="p-3 text-start">Date</th>
                  <th className="p-3 text-start">Supplier</th>
                  <th className="p-3 text-start">Material</th>
                  <th className="p-3 text-end">Gross KG</th>
                  <th className="p-3 text-end">Tare KG</th>
                  <th className="p-3 text-end text-cyan-300">Net KG</th>
                  <th className="p-3 text-center text-amber-400">Bags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {receivingTransactions.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-white font-bold">{r.transactionNumber}</td>
                    <td className="p-3 text-cyan-400">{r.legacyDocumentNumber}</td>
                    <td className="p-3 text-slate-300">{r.date}</td>
                    <td className="p-3 font-sans text-slate-200">{r.supplierName}</td>
                    <td className="p-3 font-sans text-slate-200">{r.materialName}</td>
                    <td className="p-3 text-end">{(r.scaleInWeightKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end">{(r.scaleOutWeightKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end font-bold text-cyan-300">{(r.netReceivedWeightKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-center text-amber-400 font-bold">{r.bulkBagsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReportId === 2 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Job #</th>
                  <th className="p-3 text-start">Doc 360</th>
                  <th className="p-3 text-start">Material</th>
                  <th className="p-3 text-start">Machine</th>
                  <th className="p-3 text-end">Input KG</th>
                  <th className="p-3 text-end text-emerald-300">Output KG</th>
                  <th className="p-3 text-end text-orange-400">Damage KG</th>
                  <th className="p-3 text-end">Variance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {shreddingTransactions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-white font-bold">{s.shreddingNumber}</td>
                    <td className="p-3 text-emerald-400">{s.legacyDocumentNumber}</td>
                    <td className="p-3 font-sans text-slate-200">{s.materialName}</td>
                    <td className="p-3 text-slate-300">{s.machineId}</td>
                    <td className="p-3 text-end">{(s.inputKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end font-bold text-emerald-300">{(s.outputKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end font-bold text-orange-400">{(s.productionDamageKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end">{(s.variancePercentage ?? 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReportId === 3 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Date</th>
                  <th className="p-3 text-start">Movement Type</th>
                  <th className="p-3 text-start">Material</th>
                  <th className="p-3 text-start">Source Warehouse</th>
                  <th className="p-3 text-start">Target Location</th>
                  <th className="p-3 text-end text-cyan-300">Quantity KG</th>
                  <th className="p-3 text-center text-amber-400">Bags</th>
                  <th className="p-3 text-start">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {inventoryMovements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-300">{m.date}</td>
                    <td className="p-3 text-cyan-400 font-bold">{m.movementType}</td>
                    <td className="p-3 font-sans text-slate-200 font-bold">{m.materialName}</td>
                    <td className="p-3 text-slate-300">{m.sourceWarehouse || 'N/A'}</td>
                    <td className="p-3 text-emerald-400">{m.targetWarehouse || m.targetLocation || 'Storage'}</td>
                    <td className="p-3 text-end font-bold text-cyan-300">{(m.quantityKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-center text-amber-400 font-bold">{m.bulkBagsCount || 1}</td>
                    <td className="p-3 text-slate-400 font-sans">{m.operator || 'Warehouse Team'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReportId === 4 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Issue #</th>
                  <th className="p-3 text-start">Doc 167</th>
                  <th className="p-3 text-start">Production Order</th>
                  <th className="p-3 text-start">Machine Line</th>
                  <th className="p-3 text-start">Material</th>
                  <th className="p-3 text-end text-cyan-300">Quantity KG</th>
                  <th className="p-3 text-center text-amber-400">Bags</th>
                  <th className="p-3 text-start">Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {productionIssues.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-white font-bold">{p.issueNumber}</td>
                    <td className="p-3 text-cyan-400">{p.legacyDocumentNumber}</td>
                    <td className="p-3 text-slate-300">{p.productionOrderNumber}</td>
                    <td className="p-3 font-bold text-slate-200">{p.machineLine}</td>
                    <td className="p-3 font-sans text-slate-200">{p.materialName}</td>
                    <td className="p-3 text-end font-bold text-cyan-300">{(p.quantityKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-center text-amber-400 font-bold">{p.bulkBagsCount}</td>
                    <td className="p-3 text-slate-300 font-sans">{p.shift || 'Morning'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReportId === 6 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Code</th>
                  <th className="p-3 text-start">Supplier Name</th>
                  <th className="p-3 text-start">Contact Person</th>
                  <th className="p-3 text-start">Phone</th>
                  <th className="p-3 text-start">Category</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center text-amber-400">Quality Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-cyan-400">{s.code}</td>
                    <td className="p-3 font-bold text-slate-100 font-sans">{s.nameAr}</td>
                    <td className="p-3 text-slate-300 font-sans">{s.contactPerson}</td>
                    <td className="p-3 text-slate-300">{s.phone}</td>
                    <td className="p-3 text-slate-400 font-sans">{s.category}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-amber-400 font-bold">{s.rating || 5.0} ★</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReportId === 8 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Record #</th>
                  <th className="p-3 text-start">Date</th>
                  <th className="p-3 text-start">Machine Line</th>
                  <th className="p-3 text-start">Material</th>
                  <th className="p-3 text-end text-rose-400">Damage KG</th>
                  <th className="p-3 text-center text-amber-400">Bags</th>
                  <th className="p-3 text-start">Reason</th>
                  <th className="p-3 text-center">Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(productionDamages || []).map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-rose-400">{d.damageNumber}</td>
                    <td className="p-3 text-slate-300">{d.date}</td>
                    <td className="p-3 font-bold text-slate-200">{d.machineLine}</td>
                    <td className="p-3 text-slate-200 font-sans">{d.materialName}</td>
                    <td className="p-3 text-end font-bold text-rose-400">{(d.quantityKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-center text-amber-400 font-bold">{d.bulkBagsCount || 1}</td>
                    <td className="p-3 text-slate-300 font-sans">{d.reason}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                        {d.disposition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedReportId !== 1 &&
            selectedReportId !== 2 &&
            selectedReportId !== 3 &&
            selectedReportId !== 4 &&
            selectedReportId !== 6 &&
            selectedReportId !== 8 &&
            selectedReportId !== 13 && (
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-3 text-start">Material</th>
                  <th className="p-3 text-start">Code</th>
                  <th className="p-3 text-start">Category</th>
                  <th className="p-3 text-end text-emerald-400">Inflow (+)</th>
                  <th className="p-3 text-end text-rose-400">Outflow (-)</th>
                  <th className="p-3 text-end text-cyan-300 font-bold">Total Balance KG</th>
                  <th className="p-3 text-center text-amber-400 font-bold">Bulk Bags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {inventoryBalances.map((b) => (
                  <tr key={b.materialId} className="hover:bg-slate-800/40">
                    <td className="p-3 text-white font-bold font-sans">{b.materialName}</td>
                    <td className="p-3 text-cyan-400">{b.materialCode}</td>
                    <td className="p-3 font-sans text-slate-300">{b.category}</td>
                    <td className="p-3 text-end text-emerald-400">+{(b.totalInKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end text-rose-400">-{(b.totalOutKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-end font-black text-cyan-300 text-sm">{(b.totalBalanceKG ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-center font-bold text-amber-400">{b.bulkBagsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Safety Stock Printable PDF Generator & Outreach Modal */}
      <SafetyStockPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        initialFilter={safetyFilter === 'ALL' ? 'ALL_LOW' : safetyFilter}
      />

      {/* Daily Operations (Inventory & Production) Formatted PDF Generator Modal */}
      <DailyOperationsReportPdfModal
        isOpen={isDailyReportPdfModalOpen}
        onClose={() => setIsDailyReportPdfModalOpen(false)}
        defaultReportType={dailyReportCategory}
        activeReportTabId={selectedReportId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
      />
    </div>
  );
};
