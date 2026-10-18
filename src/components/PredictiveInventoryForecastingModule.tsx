import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  Sparkles,
  Sliders,
  Calendar,
  Flame,
  Factory,
  Package,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  Download,
  Phone,
  Building2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Info,
  Scale,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  calculatePredictiveInventoryForecast,
  getForecastOverviewSummary,
  MaterialForecastReport,
  ForecastConfiguration,
  getStoredForecastConfig,
  saveStoredForecastConfig,
  StockoutUrgency,
} from '../services/predictiveInventoryForecastingService';

interface PredictiveInventoryForecastingModuleProps {
  onBackToDashboard?: () => void;
}

export const PredictiveInventoryForecastingModule: React.FC<PredictiveInventoryForecastingModuleProps> = ({
  onBackToDashboard,
}) => {
  const { isRTL } = useLanguage();
  const {
    materials,
    inventoryBalances,
    shreddingTransactions,
    productionIssues,
    suppliers,
    updateMaterialSafetyThreshold,
    setCurrentPage,
    setSelectedMaterialId,
    currentUser,
  } = useFactory();

  // Forecast Configuration State
  const [config, setConfig] = useState<ForecastConfiguration>(() => getStoredForecastConfig());
  const [activeFilter, setActiveFilter] = useState<
    'ALL' | 'IMMINENT' | 'REORDER_NOW' | 'UNDERPROTECTED' | 'HEALTHY'
  >('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterialDetail, setSelectedMaterialDetail] = useState<MaterialForecastReport | null>(null);
  const [appliedRopNotice, setAppliedRopNotice] = useState<string | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Recalculate forecast reports dynamically based on live transactions and forecast config
  const forecastReports = useMemo(() => {
    return calculatePredictiveInventoryForecast(
      materials,
      inventoryBalances,
      shreddingTransactions,
      productionIssues,
      suppliers,
      config
    );
  }, [materials, inventoryBalances, shreddingTransactions, productionIssues, suppliers, config]);

  // Overview Summary KPIs
  const summary = useMemo(() => {
    return getForecastOverviewSummary(forecastReports);
  }, [forecastReports]);

  // Filtered reports
  const displayedReports = useMemo(() => {
    return forecastReports.filter((r) => {
      // Search filter
      const matchSearch =
        !searchTerm ||
        r.materialNameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.materialNameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.materialCode.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      // Tab filter
      switch (activeFilter) {
        case 'IMMINENT':
          return r.stockoutUrgency === 'STOCKOUT_IMMINENT';
        case 'REORDER_NOW':
          return r.stockoutUrgency === 'STOCKOUT_IMMINENT' || r.stockoutUrgency === 'REORDER_NOW';
        case 'UNDERPROTECTED':
          return r.isStaticThresholdUnderprotected;
        case 'HEALTHY':
          return r.stockoutUrgency === 'OPTIMAL' || r.stockoutUrgency === 'OVERSTOCKED';
        default:
          return true;
      }
    });
  }, [forecastReports, searchTerm, activeFilter]);

  // Handle configuration updates
  const handleUpdateConfig = (updates: Partial<ForecastConfiguration>) => {
    const updated = { ...config, ...updates };
    setConfig(updated);
    saveStoredForecastConfig(updated);
  };

  // One-click apply suggested ROP as static safety stock threshold
  const handleApplyRopAsThreshold = async (report: MaterialForecastReport) => {
    try {
      await updateMaterialSafetyThreshold(
        report.materialId,
        report.suggestedReorderPointKG,
        Math.round(report.suggestedReorderPointKG * 3)
      );
      setAppliedRopNotice(
        isRTL
          ? `تم تحديث الحد الأدنى للمادة (${report.materialNameAr}) إلى ${(report.suggestedReorderPointKG ?? 0).toLocaleString()} كغم بنجاح!`
          : `Updated safety threshold for ${report.materialNameEn} to ${(report.suggestedReorderPointKG ?? 0).toLocaleString()} KG successfully!`
      );
      setTimeout(() => setAppliedRopNotice(null), 5000);
    } catch (e) {
      console.error('Failed to update material safety threshold', e);
    }
  };

  // Chart data: Top 8 active materials comparing Current Stock vs Suggested ROP vs Static Threshold
  const chartData = useMemo(() => {
    return forecastReports.slice(0, 8).map((r) => ({
      name: isRTL ? r.materialNameAr : r.materialNameEn,
      code: r.materialCode,
      currentStockKG: r.currentStockKG,
      suggestedRopKG: r.suggestedReorderPointKG,
      staticMinKG: r.currentMinStockKG,
      dailyBurnKG: r.dailyBurnRateKG,
      runwayDays: r.runwayDays,
    }));
  }, [forecastReports, isRTL]);

  // Export CSV summary of inventory forecast
  const handleExportCsv = () => {
    const headers = [
      'Code',
      'Material Name',
      'Category',
      'Current Stock (KG)',
      'Daily Burn Rate (KG/day)',
      'Lead Time (Days)',
      'Lead Time Demand (KG)',
      'Safety Stock (KG)',
      'Suggested ROP (KG)',
      'Current Static Min (KG)',
      'Runway (Days)',
      'Predicted Stockout',
      'Urgency',
      'Recommended Reorder (KG)',
    ];

    const rows = forecastReports.map((r) => [
      r.materialCode,
      `"${r.materialNameEn} - ${r.materialNameAr}"`,
      r.category,
      r.currentStockKG,
      r.dailyBurnRateKG,
      r.leadTimeDays,
      r.leadTimeDemandKG,
      r.safetyStockKG,
      r.suggestedReorderPointKG,
      r.currentMinStockKG,
      r.runwayDays,
      r.predictedStockoutDate.slice(0, 10),
      r.stockoutUrgency,
      r.recommendedReorderQtyKG,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AlKarwan_Predictive_Inventory_Forecast_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto text-slate-200">
      {/* Module Title & Configuration Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-gradient-to-r from-[#141721] via-[#10121a] to-[#141721] p-5 rounded-2xl border border-white/10 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-purple-950 border border-purple-500/40 text-purple-300 font-mono text-[10px] font-bold tracking-wider uppercase">
                {isRTL ? 'خوارزمية التنبؤ بالمخزون' : 'AI INVENTORY FORECASTING'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold">
                {isRTL ? 'تحليل استهلاك الثرم والإنتاج' : 'Shredding & Extrusion Telemetry'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {isRTL
                ? 'التنبؤ باحتياجات المخزون ونقاط إعادة الطلب الديناميكية'
                : 'Predictive Inventory Forecasting & Dynamic Reorder Points'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'تحليل أنماط سحب المواد الخام في الثرامة (SHR-360) وخطوط البثق (EXT) لتحديد نقاط الطلب المثلى ومنع نفاذ المخزون'
                : 'Estimates empirical daily burn rates from shredding & extrusion issues to forecast exact stockout dates and reorder thresholds'}
            </p>
          </div>
        </div>

        {/* Global Controls: Horizon, Surge, Config, Export */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto">
          {/* Time Horizon Selector */}
          <div className="bg-[#181a24] p-1 rounded-xl border border-white/10 flex items-center gap-1 text-xs">
            <span className="px-2 text-[10px] text-slate-400 font-bold uppercase font-mono">
              {isRTL ? 'الأفق:' : 'Horizon:'}
            </span>
            {[7, 14, 30, 60].map((days) => (
              <button
                key={days}
                onClick={() => handleUpdateConfig({ timeHorizonDays: days })}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all cursor-pointer ${
                  config.timeHorizonDays === days
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Surge Multiplier */}
          <div className="bg-[#181a24] p-1 rounded-xl border border-white/10 flex items-center gap-1 text-xs">
            <span className="px-2 text-[10px] text-slate-400 font-bold uppercase font-mono">
              {isRTL ? 'مضاعف الطلب:' : 'Surge:'}
            </span>
            {[
              { label: '1.0x', val: 1.0 },
              { label: '1.25x', val: 1.25 },
              { label: '1.5x', val: 1.5 },
            ].map((s) => (
              <button
                key={s.val}
                onClick={() => handleUpdateConfig({ demandSurgeMultiplier: s.val })}
                className={`px-2 py-1 rounded-lg font-mono font-bold transition-all cursor-pointer ${
                  config.demandSurgeMultiplier === s.val
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={
                  s.val === 1.0
                    ? isRTL ? 'الطلب المعياري المعتاد' : 'Nominal baseline demand'
                    : isRTL ? `محاكاة زيادة الإنتاج بنسبة +${(s.val - 1) * 100}%` : `Simulate +${(s.val - 1) * 100}% surge`
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Config Drawer Toggle */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'معايير الأمان' : 'Lead Time & Safety'}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'تصدير التقرير CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Fine-Tuning Drawer */}
      {showConfigPanel && (
        <div className="p-4 rounded-2xl bg-[#11131a] border border-cyan-500/30 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'معايير معادلة نقطة إعادة الطلب الإحصائية (ROP & Safety Stock)' : 'Statistical Safety Stock & ROP Parameters'}
              </h3>
            </div>
            <button
              onClick={() => setShowConfigPanel(false)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Service Level Factor (Z) */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>{isRTL ? 'مستوى الخدمة المستهدف (Service Level)' : 'Target Service Level (Z)'}</span>
                <span className="text-cyan-400 font-mono">
                  {config.serviceLevelZ === 1.65 ? '95% (Z=1.65)' : config.serviceLevelZ === 2.05 ? '98% (Z=2.05)' : config.serviceLevelZ === 2.33 ? '99% (Z=2.33)' : '90% (Z=1.28)'}
                </span>
              </label>
              <p className="text-[10px] text-slate-400">
                {isRTL
                  ? 'نسبة الحماية الإحصائية من نفاد المواد أثناء تقلبات سحب الثرامة وخطوط البثق.'
                  : 'Statistical confidence against stockouts during operational demand spikes.'}
              </p>
              <div className="flex items-center gap-1 pt-1">
                {[
                  { label: '90%', z: 1.28 },
                  { label: '95%', z: 1.65 },
                  { label: '98%', z: 2.05 },
                  { label: '99%', z: 2.33 },
                ].map((item) => (
                  <button
                    key={item.z}
                    onClick={() => handleUpdateConfig({ serviceLevelZ: item.z })}
                    className={`flex-1 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                      config.serviceLevelZ === item.z
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Supplier Lead Time */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>{isRTL ? 'مهلة توريد الموردين الافتراضية (Lead Time)' : 'Default Supplier Lead Time (L)'}</span>
                <span className="text-purple-400 font-mono font-bold">{config.defaultLeadTimeDays} {isRTL ? 'أيام' : 'days'}</span>
              </label>
              <p className="text-[10px] text-slate-400">
                {isRTL
                  ? 'المدة المتوقعة لوصول إرسالية المواد الخام بعد إصدار أمر الشراء.'
                  : 'Expected turnaround between PO issuance and truck arrival at scale.'}
              </p>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="range"
                  min="1"
                  max="14"
                  value={config.defaultLeadTimeDays}
                  onChange={(e) => handleUpdateConfig({ defaultLeadTimeDays: parseInt(e.target.value, 10) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Formula Breakdown Card */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 text-[11px] font-mono space-y-1 text-slate-300">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1 font-sans">
                <Info className="w-3.5 h-3.5" />
                {isRTL ? 'معادلة نقطة إعادة الطلب الديناميكية:' : 'Dynamic ROP Formula:'}
              </span>
              <div className="p-2 rounded bg-black/40 border border-white/10 text-cyan-300">
                ROP = (Daily_Burn × Lead_Time) + (Z × σ × √Lead_Time)
              </div>
              <p className="text-[10px] text-slate-400 font-sans">
                {isRTL
                  ? 'يتكيف الـ ROP تلقائياً مع ارتفاع استهلاك الثرم أو حدوث تقلبات في توريد المواد.'
                  : 'ROP automatically scales up when granulator throughput increases or volatility spikes.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Applied Notice Banner */}
      {appliedRopNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appliedRopNotice}</span>
          </div>
          <button onClick={() => setAppliedRopNotice(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 4 High-Impact KPI Horizon Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Daily Plant Burn Rate */}
        <div className="bg-[#111218] border border-white/5 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              {isRTL ? 'إجمالي معدل استهلاك المصنع' : 'Daily Plant Consumption'}
            </span>
            <span className="text-[10px] font-mono text-amber-400">{config.timeHorizonDays}d avg</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">
              {summary.totalDailyPlantBurnRateKG.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-mono uppercase">KG / {isRTL ? 'يوم' : 'day'}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {isRTL
              ? `يعادل ${(summary.totalDailyPlantBurnRateKG / 1000).toFixed(1)} طن/يومياً لمغذي الثرامة وخطوط البثق`
              : `~${(summary.totalDailyPlantBurnRateKG / 1000).toFixed(1)} T/day active granulator & extrusion demand`}
          </p>
        </div>

        {/* 2. Immediate Stockout Threats */}
        <div
          className={`border rounded-xl p-4 shadow-sm relative overflow-hidden transition-all ${
            summary.imminentStockoutsCount > 0
              ? 'bg-rose-950/20 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
              : 'bg-[#111218] border-white/5'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-rose-400 uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              {isRTL ? 'مواد بخطر نفاد وشيك' : 'Imminent Stockouts'}
            </span>
            {summary.imminentStockoutsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl sm:text-3xl font-mono font-black ${
                summary.imminentStockoutsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {summary.imminentStockoutsCount}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">
              {isRTL ? 'أصناف حرجة' : 'MATERIALS'}
            </span>
          </div>
          <p className="text-[10px] text-rose-300 mt-1">
            {summary.imminentStockoutsCount > 0
              ? isRTL
                ? 'رصيد المخزون ينفد قبل وصول إرسالية المورد (< مهلة التوريد)'
                : 'Stock will deplete before supplier truck can arrive (< Lead Time)'
              : isRTL
              ? 'كافة المواد تغطي مهلة التوريد بأمان'
              : 'All materials exceed supplier lead times'}
          </p>
        </div>

        {/* 3. Materials Below Suggested Reorder Point */}
        <div className="bg-[#111218] border border-white/5 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              {isRTL ? 'تجاوزت نقطة إعادة الطلب' : 'Breached Reorder Point'}
            </span>
            <span className="text-[10px] font-mono text-cyan-300">ROP</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl sm:text-3xl font-mono font-black text-cyan-300">
              {summary.materialsNeedingImmediateReorder}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">
              / {summary.totalMaterials} {isRTL ? 'مادة' : 'total'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {isRTL
              ? `كميات إعادة الطلب الموصى بها: ${(summary.totalRecommendedReorderKG / 1000).toFixed(1)} طن`
              : `Recommended replenishment: ${(summary.totalRecommendedReorderKG / 1000).toFixed(1)} Tons`}
          </p>
        </div>

        {/* 4. Fastest Depleting Material */}
        <div className="bg-[#111218] border border-white/5 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-purple-400" />
              {isRTL ? 'أسرع مادة نفاداً' : 'Fastest Depleting Item'}
            </span>
            <span className="text-[10px] font-mono text-purple-300">Runway</span>
          </div>
          {summary.fastestDepletingMaterial ? (
            <div className="mt-2 space-y-1">
              <div className="text-sm font-bold text-white truncate" title={summary.fastestDepletingMaterial.materialNameEn}>
                {isRTL ? summary.fastestDepletingMaterial.materialNameAr : summary.fastestDepletingMaterial.materialNameEn}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-mono font-black text-purple-300">
                  {summary.fastestDepletingMaterial.runwayDays}
                </span>
                <span className="text-xs text-slate-400 font-mono">{isRTL ? 'أيام متبقية' : 'days left'}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({(summary.fastestDepletingMaterial.currentStockKG / 1000).toFixed(1)}T stock)
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-slate-400">-</div>
          )}
        </div>
      </div>

      {/* Visual Analytics Chart: Current Stock vs Suggested ROP vs Static Threshold */}
      <div className="bg-[#111218] border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-4 border-b border-white/5 gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              <span>
                {isRTL
                  ? 'مقارنة المخزون الفعلي بنقطة إعادة الطلب الديناميكية والحد الأدنى الثابت'
                  : 'On-Hand Stock vs. Suggested Reorder Point vs. Static Minimum'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'تكشف الأعمدة الفجوة بين سياسة الأمان الثابتة القديمة ونقطة إعادة الطلب الفعلية المحسوبة من وتيرة الثرم والإنتاج.'
                : 'Highlights discrepancies between static minimum levels and empirical demand-driven reorder thresholds.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-purple-300 font-bold bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-lg">
              Top 8 High-Velocity Materials
            </span>
          </div>
        </div>

        <div className="h-[300px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: isRTL ? 10 : 20, left: isRTL ? 20 : 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#252936" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={{ stroke: '#334155' }}
                interval={0}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                tickLine={{ stroke: '#334155' }}
                unit=" KG"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1118',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                }}
              />
              <Legend
                verticalAlign="top"
                height={32}
                formatter={(value) => {
                  if (value === 'currentStockKG') {
                    return <span className="text-emerald-400 font-semibold px-1">{isRTL ? 'المخزون الحالي (On-Hand)' : 'Current Stock (KG)'}</span>;
                  }
                  if (value === 'suggestedRopKG') {
                    return <span className="text-purple-400 font-semibold px-1">{isRTL ? 'نقطة إعادة الطلب الديناميكية (Suggested ROP)' : 'Dynamic Suggested ROP'}</span>;
                  }
                  if (value === 'staticMinKG') {
                    return <span className="text-slate-400 font-semibold px-1">{isRTL ? 'الحد الأدنى الثابت القديم (Static Min)' : 'Static Min Threshold'}</span>;
                  }
                  return value;
                }}
              />
              <Bar dataKey="currentStockKG" name="currentStockKG" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="suggestedRopKG" name="suggestedRopKG" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="staticMinKG" name="staticMinKG" fill="#475569" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Tabs & Search Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111218] p-3.5 rounded-xl border border-white/5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isRTL ? 'كافة المواد' : 'All Materials'} ({forecastReports.length})
          </button>

          <button
            onClick={() => setActiveFilter('IMMINENT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'IMMINENT'
                ? 'bg-rose-600 text-white shadow'
                : 'text-rose-400 hover:text-white hover:bg-rose-950/40'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{isRTL ? 'نفاد وشيك (< المهلة)' : 'Imminent Stockout'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 border border-rose-500/40">
              {summary.imminentStockoutsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('REORDER_NOW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'REORDER_NOW'
                ? 'bg-amber-600 text-white shadow'
                : 'text-amber-400 hover:text-white hover:bg-amber-950/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isRTL ? 'مستحق إعادة الطلب' : 'Reorder Point Breached'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 border border-amber-500/40">
              {summary.materialsNeedingImmediateReorder}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('UNDERPROTECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'UNDERPROTECTED'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-cyan-400 hover:text-white hover:bg-cyan-950/40'
            }`}
            title={isRTL ? 'المواد التي يكون فيها الحد الأدنى الثابت القديم أقل من نقطة إعادة الطلب المحسوبة' : 'Materials where current static min stock is too low'}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isRTL ? 'الحد الثابت غير كافٍ' : 'Under-Protected Static Min'}</span>
          </button>

          <button
            onClick={() => setActiveFilter('HEALTHY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'HEALTHY'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {isRTL ? 'مخزون آمن' : 'Healthy Stock'} ({summary.healthyCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isRTL ? 'بحث بالاسم أو الكود...' : 'Filter by name or code...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Materials Detailed Forecast Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayedReports.map((report) => {
          const isImminent = report.stockoutUrgency === 'STOCKOUT_IMMINENT';
          const isReorder = report.stockoutUrgency === 'REORDER_NOW';

          return (
            <div
              key={report.materialId}
              className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between ${
                isImminent
                  ? 'bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900 border-rose-500/50 shadow-lg shadow-rose-950/20'
                  : isReorder
                  ? 'bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-slate-900 border-amber-500/40'
                  : 'bg-[#111218] border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                {/* Card Header: Code, Badges, Category */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-white/10 text-slate-300">
                        {report.materialCode}
                      </span>
                      {report.requiresShredding && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {isRTL ? 'يحتاج ثرم' : 'Shredding'}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">{report.category}</span>
                    </div>

                    <h3 className="text-base font-bold text-white mt-1">
                      {isRTL ? report.materialNameAr : report.materialNameEn}
                    </h3>
                  </div>

                  {/* Stockout Urgency Pill */}
                  <div>
                    {isImminent ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-600 text-white shadow flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 animate-ping" />
                        {isRTL ? 'نفاد وشيك' : 'IMMINENT'}
                      </span>
                    ) : isReorder ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-slate-950 font-black">
                        {isRTL ? 'طلب الآن' : 'REORDER NOW'}
                      </span>
                    ) : report.stockoutUrgency === 'REORDER_APPROACHING' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        {isRTL ? 'اقتراب ROP' : 'APPROACHING'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        {isRTL ? 'مستقر' : 'OPTIMAL'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Runway Countdown Bar */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 my-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      {isRTL ? 'الرصيد الزمني المتبقي (Runway):' : 'Inventory Runway:'}
                    </span>
                    <span
                      className={`font-mono font-black text-sm ${
                        report.runwayDays <= report.leadTimeDays
                          ? 'text-rose-400'
                          : report.runwayDays <= report.leadTimeDays * 2
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {report.runwayDays} {isRTL ? 'أيام' : 'days'}
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        report.runwayDays <= report.leadTimeDays
                          ? 'bg-rose-500'
                          : report.runwayDays <= report.leadTimeDays * 2
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, (report.runwayDays / 30) * 100))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1.5">
                    <span>
                      {isRTL ? 'تاريخ النفاد المتوقع:' : 'Expected Stockout:'}{' '}
                      <span className="text-slate-200 font-bold">
                        {new Date(report.predictedStockoutDate).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </span>
                    <span>
                      {isRTL ? 'مهلة المورد:' : 'Supplier Lead Time:'} {report.leadTimeDays}d
                    </span>
                  </div>
                </div>

                {/* Metrics 3-Column Strip */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs my-2">
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'المخزون الحالي' : 'On Hand'}</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {(report.currentStockKG ?? 0).toLocaleString()} <span className="text-[9px] font-normal text-slate-400">KG</span>
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/30">
                    <span className="text-[10px] text-purple-300 block">{isRTL ? 'نقطة الطلب (ROP)' : 'Suggested ROP'}</span>
                    <span className="font-mono font-black text-purple-300 text-sm">
                      {(report.suggestedReorderPointKG ?? 0).toLocaleString()} <span className="text-[9px] font-normal text-purple-400">KG</span>
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'معدل السحب اليومي' : 'Daily Burn'}</span>
                    <span className="font-mono font-bold text-amber-300 text-sm">
                      {(report.dailyBurnRateKG ?? 0).toLocaleString()} <span className="text-[9px] font-normal text-slate-400">KG/d</span>
                    </span>
                  </div>
                </div>

                {/* Discrepancy Insight: Static vs Dynamic ROP */}
                {report.isStaticThresholdUnderprotected && (
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200/90 my-2 flex items-start gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {isRTL
                        ? `الحد الثابت الحالي (${(report.currentMinStockKG ?? 0).toLocaleString()} كغم) أقل من نقطة الطلب الإحصائية بـ ${(report.gapBetweenStaticAndDynamicKG ?? 0).toLocaleString()} كغم.`
                        : `Current static min (${(report.currentMinStockKG ?? 0).toLocaleString()} KG) under-protects against spikes by ${(report.gapBetweenStaticAndDynamicKG ?? 0).toLocaleString()} KG.`}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/10 flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{isRTL ? 'الدفعة المقترحة للشراء:' : 'Suggested Refill Batch:'}</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(report.recommendedReorderQtyKG ?? 0).toLocaleString()} KG ({report.recommendedReorderBags ?? 0} {isRTL ? 'شلايف' : 'bags'})
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {/* Apply ROP as safety minimum */}
                  <button
                    onClick={() => handleApplyRopAsThreshold(report)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white font-bold text-xs shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    title={isRTL ? 'تحديث الحد الأدنى للمخزون في بطاقة المادة ليتطابق مع نقطة إعادة الطلب' : 'Update permanent safety threshold in material card'}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'اعتماد الـ ROP كحد أمان' : 'Apply ROP Threshold'}</span>
                  </button>

                  {/* Open Supplier / Purchase */}
                  <button
                    onClick={() => {
                      setSelectedMaterialId(report.materialId);
                      setCurrentPage('suppliers');
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                    title={isRTL ? 'طلب الشراء وتنسيق المورد' : 'Procure & view suppliers'}
                  >
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{isRTL ? 'الموردين' : 'Suppliers'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayedReports.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-[#111218] border border-white/5 space-y-3">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">
            {isRTL ? 'لا توجد مواد مطابقة للفلتر المحدد' : 'No materials matched the active filter'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isRTL ? 'جرب اختيار فلتر آخر أو كتابة اسم مادة مختلف' : 'Try switching the filter tab or clearing the search query.'}
          </p>
        </div>
      )}
    </div>
  );
};
