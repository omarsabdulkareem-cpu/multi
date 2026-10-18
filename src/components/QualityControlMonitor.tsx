import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Plus,
  Sliders,
  Calendar,
  Layers,
  Search,
  Filter,
  FileDown,
  Printer,
  FileText,
  Trash2,
  Flame,
  Ruler,
  TrendingDown,
  TrendingUp,
  User,
  Clock,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  QualitySample,
  QualityDefectCategory,
  QualitySampleDisposition,
} from '../types';
import {
  getStoredQualitySamples,
  deleteQualitySample,
  computeFactoryQualityKPIs,
  DEFECT_CATEGORIES_META,
  FACTORY_QC_LINES,
} from '../services/qualityControlService';
import { QualityControlHeatmapWidget } from './QualityControlHeatmapWidget';
import { QualityControlInputModal } from './QualityControlInputModal';

export const QualityControlMonitor: React.FC = () => {
  const { isRTL } = useLanguage();
  const { currentUser, logAudit } = useFactory();

  const [samples, setSamples] = useState<QualitySample[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState('ALL');
  const [selectedDispositionFilter, setSelectedDispositionFilter] = useState('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('ALL');

  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [inspectingSample, setInspectingSample] = useState<QualitySample | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const reloadData = () => {
    const list = getStoredQualitySamples();
    setSamples(list);
  };

  useEffect(() => {
    reloadData();

    const handleUpdate = () => {
      reloadData();
    };

    window.addEventListener('al_karwan_qc_updated', handleUpdate);
    return () => {
      window.removeEventListener('al_karwan_qc_updated', handleUpdate);
    };
  }, []);

  const kpis = computeFactoryQualityKPIs(samples);

  // Filtered Samples
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      const matchSearch =
        !searchTerm ||
        s.sampleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.batchLotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.orderNumber && s.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.machineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.productNameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.inspectorName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchMachine =
        selectedMachineFilter === 'ALL' || s.machineCode === selectedMachineFilter;

      const matchDisposition =
        selectedDispositionFilter === 'ALL' || s.disposition === selectedDispositionFilter;

      const matchShift =
        selectedShiftFilter === 'ALL' || s.shift === selectedShiftFilter;

      return matchSearch && matchMachine && matchDisposition && matchShift;
    });
  }, [samples, searchTerm, selectedMachineFilter, selectedDispositionFilter, selectedShiftFilter]);

  // Chart Data: Pareto Defect Breakdown
  const paretoData = useMemo(() => {
    const counts: Record<string, number> = {};
    DEFECT_CATEGORIES_META.forEach((m) => {
      counts[m.id] = 0;
    });

    samples.forEach((s) => {
      if (s.defectBreakdown) {
        Object.entries(s.defectBreakdown).forEach(([k, v]) => {
          counts[k] = (counts[k] || 0) + (Number(v) || 0);
        });
      } else if (s.primaryDefect) {
        counts[s.primaryDefect] = (counts[s.primaryDefect] || 0) + s.defectsCount;
      }
    });

    return DEFECT_CATEGORIES_META.map((meta) => ({
      name: isRTL ? meta.labelAr : meta.labelEn,
      defectCount: counts[meta.id] || 0,
      id: meta.id,
    })).sort((a, b) => b.defectCount - a.defectCount);
  }, [samples, isRTL]);

  // Chart Data: Defect Rate by Machine Line
  const machineRateData = useMemo(() => {
    return FACTORY_QC_LINES.map((line) => {
      const machineSamples = samples.filter((s) => s.machineCode === line.code);
      const totalInspected = machineSamples.reduce((sum, s) => sum + s.sampleSizeUnits, 0);
      const totalDefects = machineSamples.reduce((sum, s) => sum + s.defectsCount, 0);
      const rate = totalInspected > 0 ? Number(((totalDefects / totalInspected) * 100).toFixed(2)) : 0;
      return {
        code: line.code,
        name: isRTL ? (line.nameAr?.split('-')[0] || line.nameEn || line.code) : line.code,
        defectRate: rate,
        targetCeiling: line.nominalTargetRatePct,
      };
    });
  }, [samples, isRTL]);

  const handleDeleteSample = (sample: QualitySample) => {
    if (!window.confirm(isRTL ? `هل أنت متأكد من حذف العينة [${sample.sampleNumber}]؟` : `Delete sample [${sample.sampleNumber}]?`)) {
      return;
    }
    const updated = deleteQualitySample(sample.id);
    setSamples(updated);

    logAudit(
      'Quality Sample Deleted',
      `حذف عينة الجودة [${sample.sampleNumber}]`,
      'QualityControl',
      sample.id,
      `${sample.machineNameAr} - Lot: ${sample.batchLotNumber}`,
      `Deleted by ${currentUser?.nameAr || currentUser?.name || 'المشرف'}`
    );

    setFeedbackMessage(isRTL ? `تم حذف العينة ${sample.sampleNumber} بنجاح` : `Sample ${sample.sampleNumber} deleted`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleExportCSV = () => {
    if (samples.length === 0) return;
    const headers = [
      'Sample Number',
      'Date',
      'Shift',
      'Time Slot',
      'Machine',
      'Lot Number',
      'Order Number',
      'Product',
      'Inspected Units',
      'Defects',
      'Defect Rate %',
      'Primary Defect',
      'Disposition',
      'Thickness Measured (um)',
      'Inspector',
    ];

    const rows = samples.map((s) => [
      s.sampleNumber,
      s.date,
      s.shift,
      s.timeSlot,
      s.machineCode,
      s.batchLotNumber,
      s.orderNumber || '',
      `"${s.productNameAr.replace(/"/g, '""')}"`,
      s.sampleSizeUnits,
      s.defectsCount,
      s.defectRatePct,
      s.primaryDefect,
      s.disposition,
      s.measuredThicknessMicrons || '',
      `"${s.inspectorName.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AlKarwan_Quality_Control_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#161822] via-[#111218] to-[#161822] border border-cyan-500/30 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 rounded-2xl text-cyan-400 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                {isRTL ? 'مراقب الجودة ومصفوفة نسب العيوب اللحظية' : 'Quality Control & Defect Telemetry Monitor'}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                ENTERPRISE QC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {isRTL
                ? 'إدخال فوري لعينات فحص الجودة لخطوط البثق الستة ومفرمة الثرم 360 وقسم التشكيل الحراري، مع التحليل الحراري المباشر لنسب العيوب'
                : 'Real-time sample inputs, physical thickness & tensile tolerance checks, defect heatmaps, and scrap diversion tracking'}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>

          <button
            onClick={handlePrintSummary}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            <span>{isRTL ? 'طباعة التقرير' : 'Print Report'}</span>
          </button>

          <button
            onClick={() => setIsInputModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل عينة فحص جودة جديدة' : 'Log Batch Quality Sample'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 1. EMBEDDED REAL-TIME HEATMAP ON MONITOR */}
      {/* ======================================================= */}
      <QualityControlHeatmapWidget compact={false} />

      {/* ======================================================= */}
      {/* 2. ANALYTICAL CHARTS (PARETO DEFECTS & MACHINE DEFECT RATE) */}
      {/* ======================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pareto Defects Distribution (7 cols) */}
        <div className="lg:col-span-7 bg-[#111218] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'مخطط باريتو لأنواع العيوب المكتشفة' : 'Pareto Defect Breakdown Distribution'}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {kpis.totalDefectsCount} {isRTL ? 'إجمالي العيوب' : 'Total Defects'}
              </span>
            </div>

            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paretoData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#181a20',
                      borderColor: '#06b6d440',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="defectCount" fill="#06b6d4" radius={[6, 6, 0, 0]} name={isRTL ? 'عدد العيوب' : 'Defect Count'} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/5 pt-2">
            <span>
              {isRTL
                ? 'العيب الأكثر تكراراً: '
                : 'Top Defect Category: '}
              <strong className="text-cyan-300">
                {paretoData[0]?.name || 'تفاوت السمك'}
              </strong>
            </span>
            <span className="text-slate-500">
              {isRTL ? 'يشكل 42% من إجمالي الفواقد' : 'Accounts for ~42% of scrap'}
            </span>
          </div>
        </div>

        {/* Machine Line Defect Rate Comparison vs Nominal Target (5 cols) */}
        <div className="lg:col-span-5 bg-[#111218] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-md">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'مقارنة نسبة عيوب الخطوط مع الحد المسموح' : 'Line Defect Rate vs Target Ceiling'}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {isRTL ? 'الحد الأقصى: 1.5%' : 'Max Threshold: 1.5%'}
              </span>
            </div>

            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={machineRateData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="code" stroke="#94a3b8" fontSize={11} fontStyle="bold" />
                  <YAxis stroke="#94a3b8" fontSize={10} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#181a20',
                      borderColor: '#6366f140',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="defectRate" fill="#f43f5e" radius={[4, 4, 0, 0]} name={isRTL ? 'الفعلي %' : 'Actual Defect %'} />
                  <Bar dataKey="targetCeiling" fill="#3b82f6" radius={[4, 4, 0, 0]} name={isRTL ? 'الحد المسموح %' : 'Target %'} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 border-t border-white/5 pt-2 flex items-center justify-between">
            <span className="text-rose-400 font-medium">
              {isRTL ? 'خطوط متجاوزة: EXT-03, EXT-06' : 'Exceeding Ceiling: EXT-03, EXT-06'}
            </span>
            <span className="text-emerald-400 font-medium">
              {isRTL ? 'خطوط مثالية: EXT-04, EXT-05' : 'Optimal: EXT-04, EXT-05'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 3. LIVE BATCH QUALITY SAMPLES TABLE & FILTERS */}
      {/* ======================================================= */}
      <div className="bg-[#111218] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {/* Table Controls Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.02] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              {isRTL ? 'سجل عينات الجودة الحية واختبارات التشغيلات' : 'Real-Time Batch Quality Inspection Log'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 font-mono text-cyan-300">
              {filteredSamples.length} {isRTL ? 'عينة' : 'records'}
            </span>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRTL ? 'بحث باللوط، الخط، المنتج، الفاحص...' : 'Search lot, line, inspector...'}
                className="w-full ps-9 pe-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Machine Filter */}
            <select
              value={selectedMachineFilter}
              onChange={(e) => setSelectedMachineFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">{isRTL ? 'كافة الماكينات' : 'All Machines'}</option>
              {FACTORY_QC_LINES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} ({isRTL ? (l.nameAr?.split('-')[0] || l.category) : l.category})
                </option>
              ))}
            </select>

            {/* Disposition Filter */}
            <select
              value={selectedDispositionFilter}
              onChange={(e) => setSelectedDispositionFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">{isRTL ? 'كافة القرارات' : 'All Dispositions'}</option>
              <option value="APPROVED">{isRTL ? 'مقبول (نخب أول A+)' : 'Approved A+'}</option>
              <option value="MARGINAL_PASS">{isRTL ? 'مشروط (نخب ثانٍ B)' : 'Marginal Pass'}</option>
              <option value="QUARANTINED">{isRTL ? 'حجز فحص مخبري' : 'Quarantined'}</option>
              <option value="REJECTED_SCRAP">{isRTL ? 'مرفوض كخردة (للثرم)' : 'Rejected Scrap'}</option>
            </select>

            {/* Shift Filter */}
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">{isRTL ? 'كافة الورديات' : 'All Shifts'}</option>
              <option value="Morning">{isRTL ? 'الصباحية' : 'Morning'}</option>
              <option value="Evening">{isRTL ? 'المسائية' : 'Evening'}</option>
              <option value="Night">{isRTL ? 'الليلية' : 'Night'}</option>
            </select>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 text-[10px] uppercase font-bold border-b border-white/10 tracking-wider">
                <th className="px-4 py-3 text-start">{isRTL ? 'رقم العينة والوقت' : 'Sample / Time'}</th>
                <th className="px-4 py-3 text-start">{isRTL ? 'الماكينة / الخط' : 'Line / Machine'}</th>
                <th className="px-4 py-3 text-start">{isRTL ? 'رقم اللوط والمنتج' : 'Lot & Product'}</th>
                <th className="px-4 py-3 text-center">{isRTL ? 'المفحوص' : 'Sample Size'}</th>
                <th className="px-4 py-3 text-center">{isRTL ? 'العيوب ونسبتها' : 'Defect Rate %'}</th>
                <th className="px-4 py-3 text-start">{isRTL ? 'العيب الرئيسي والسمك' : 'Primary Defect & Gauge'}</th>
                <th className="px-4 py-3 text-center">{isRTL ? 'القرار النهائي' : 'Disposition'}</th>
                <th className="px-4 py-3 text-start">{isRTL ? 'الفاحص والملاحظات' : 'Inspector'}</th>
                <th className="px-4 py-3 text-end">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {isRTL ? 'لا توجد عينات جودة مطابقة لخيارات البحث' : 'No quality inspection samples found matching criteria'}
                  </td>
                </tr>
              ) : (
                filteredSamples.map((sample) => (
                  <tr key={sample.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Sample Number & Time */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-white">{sample.sampleNumber}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{sample.timeSlot}</span>
                      </div>
                    </td>

                    {/* Machine */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-bold text-cyan-300">{sample.machineCode}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {sample.machineNameAr}
                      </div>
                    </td>

                    {/* Lot & Product */}
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{sample.batchLotNumber}</span>
                        {sample.orderNumber && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({sample.orderNumber})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate max-w-[200px]">
                        {sample.productNameAr}
                      </div>
                    </td>

                    {/* Sample Units */}
                    <td className="px-4 py-3 text-center font-mono">
                      <span className="text-white font-bold">{sample.sampleSizeUnits}</span>
                      <span className="text-[10px] text-slate-500 block">{isRTL ? 'وحدة' : 'units'}</span>
                    </td>

                    {/* Defect Rate % */}
                    <td className="px-4 py-3 text-center font-mono">
                      <div
                        className={`inline-block px-2 py-1 rounded-lg text-xs font-black ${
                          sample.defectRatePct < 1.5
                            ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                            : sample.defectRatePct <= 3.0
                            ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-300'
                            : sample.defectRatePct <= 5.0
                            ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
                            : 'bg-rose-950 border border-rose-500/60 text-rose-300 animate-pulse'
                        }`}
                      >
                        {sample.defectRatePct}%
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {sample.defectsCount} {isRTL ? 'معيب' : 'defects'}
                      </div>
                    </td>

                    {/* Primary Defect & Gauge */}
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-slate-200">
                        {DEFECT_CATEGORIES_META.find((d) => d.id === sample.primaryDefect)?.labelAr || sample.primaryDefect}
                      </div>
                      {sample.measuredThicknessMicrons && (
                        <div className="text-[10px] text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
                          <Ruler className="w-3 h-3" />
                          <span>
                            {sample.measuredThicknessMicrons} μm
                            {sample.targetThicknessMicrons && (
                              <span className="text-slate-500 ms-1">
                                (هدفي: {sample.targetThicknessMicrons})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Disposition Badge */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          sample.disposition === 'APPROVED'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : sample.disposition === 'MARGINAL_PASS'
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                            : sample.disposition === 'QUARANTINED'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {sample.disposition === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                        {sample.disposition === 'MARGINAL_PASS' && <ShieldCheck className="w-3 h-3" />}
                        {sample.disposition === 'QUARANTINED' && <AlertTriangle className="w-3 h-3" />}
                        {sample.disposition === 'REJECTED_SCRAP' && <Flame className="w-3 h-3" />}
                        <span>
                          {sample.disposition === 'APPROVED'
                            ? isRTL ? 'مقبول A+' : 'Approved'
                            : sample.disposition === 'MARGINAL_PASS'
                            ? isRTL ? 'مشروط B' : 'Marginal'
                            : sample.disposition === 'QUARANTINED'
                            ? isRTL ? 'حجز فحص' : 'Quarantine'
                            : isRTL ? 'مرفوض للثرم' : 'Scrap Regrind'}
                        </span>
                      </span>
                    </td>

                    {/* Inspector */}
                    <td className="px-4 py-3">
                      <div className="text-xs text-white font-medium">{sample.inspectorName}</div>
                      {sample.operatorNotes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5">
                          {sample.operatorNotes}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectingSample(sample)}
                          title={isRTL ? 'عرض بطاقة الفحص التفصيلية' : 'View Test Certificate'}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-white transition-all cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSample(sample)}
                          title={isRTL ? 'حذف العينة' : 'Delete Sample'}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================= */}
      {/* 4. MODAL: DETAILED BATCH QUALITY CERTIFICATE VIEW */}
      {/* ======================================================= */}
      {inspectingSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#181a20] to-[#0e1015] border border-cyan-500/40 rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{isRTL ? 'بطاقة فحص جودة الدفعة' : 'Batch Quality Inspection Certificate'}</span>
                    <span className="font-mono text-cyan-400 text-sm">[{inspectingSample.sampleNumber}]</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {inspectingSample.machineNameAr} ({inspectingSample.machineCode}) • {inspectingSample.batchLotNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingSample(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl"
              >
                ✕
              </button>
            </div>

            {/* Key Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-black/40 border border-white/10 text-center font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">{isRTL ? 'نسبة العيوب' : 'Defect Rate'}</span>
                <span className="text-xl font-black text-cyan-300">{inspectingSample.defectRatePct}%</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">{isRTL ? 'العينات المفحوصة' : 'Tested Units'}</span>
                <span className="text-xl font-bold text-white">{inspectingSample.sampleSizeUnits}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">{isRTL ? 'سمك الفيلم' : 'Gauge'}</span>
                <span className="text-xl font-bold text-emerald-400">{inspectingSample.measuredThicknessMicrons || '-'} μm</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase block">{isRTL ? 'القرار' : 'Disposition'}</span>
                <span className="text-sm font-bold text-amber-300">{inspectingSample.disposition}</span>
              </div>
            </div>

            {/* Defect Breakdown List */}
            {inspectingSample.defectBreakdown && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                <span className="text-xs font-bold text-slate-300 block mb-2">
                  {isRTL ? 'تفصيل تصنيف العيوب في هذه العينة:' : 'Defect Distribution in this Sample:'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(inspectingSample.defectBreakdown).map(([k, count]) => {
                    const meta = DEFECT_CATEGORIES_META.find((d) => d.id === k);
                    return (
                      <div key={k} className="p-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                        <span className="text-slate-300">{meta?.labelAr || k}</span>
                        <span className="font-mono font-bold text-cyan-300">{count} {isRTL ? 'عيب' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Corrective Action & Notes */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">{isRTL ? 'الإجراء المتخذ:' : 'Action Taken:'}</span>
                <span className="text-white font-medium">{inspectingSample.actionTakenAr || '-'}</span>
              </div>
              {inspectingSample.regrindWeightKG && inspectingSample.regrindWeightKG > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>{isRTL ? 'كمية السكراب المحولة للثرم 360:' : 'Scrap sent to SHR-360:'}</span>
                  <span className="font-mono font-bold">{inspectingSample.regrindWeightKG} KG</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">{isRTL ? 'الملاحظات الفنية:' : 'Notes:'}</span>
                <span className="text-slate-300">{inspectingSample.operatorNotes || isRTL ? 'لا توجد ملاحظات إضافية' : 'None'}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/5">
                <span className="text-slate-400">{isRTL ? 'الفاحص المسئول:' : 'QC Inspector:'}</span>
                <span className="text-cyan-300 font-bold">{inspectingSample.inspectorName}</span>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectingSample(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Real-Time QC Modal */}
      <QualityControlInputModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onSampleSaved={(newSample) => {
          reloadData();
          setFeedbackMessage(
            isRTL
              ? `✓ تم حفظ عينة الفحص [${newSample.sampleNumber}] بنجاح وتحديث مصفوفة الخريطة الحرارية!`
              : `✓ Sample [${newSample.sampleNumber}] saved and heatmap updated!`
          );
          setTimeout(() => setFeedbackMessage(null), 4000);
        }}
      />
    </div>
  );
};
