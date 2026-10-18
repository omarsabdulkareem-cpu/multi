import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Volume2,
  VolumeX,
  Truck,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingDown,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  X,
  RefreshCw,
  Info,
  DollarSign,
  Package,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  calculatePredictiveInventoryForecast,
  MaterialForecastReport,
  DEFAULT_FORECAST_CONFIG,
  ForecastConfiguration,
} from '../services/predictiveInventoryForecastingService';

export interface StorageRawPlasticsAlertSystemProps {
  onOpenTransferModal?: (materialId?: string) => void;
  onNavigateToProcurement?: (materialId?: string) => void;
}

export const StorageRawPlasticsAlertSystem: React.FC<StorageRawPlasticsAlertSystemProps> = ({
  onOpenTransferModal,
  onNavigateToProcurement,
}) => {
  const { isRTL } = useLanguage();
  const {
    materials,
    inventoryBalances,
    shreddingTransactions,
    productionIssues,
    suppliers,
    warehouses,
    locations,
    setCurrentPage,
    setSelectedMaterialId,
  } = useFactory();

  // State
  const [isMuted, setIsMuted] = useState(false);
  const [acknowledgedMaterialIds, setAcknowledgedMaterialIds] = useState<string[]>([]);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAlertMaterial, setSelectedAlertMaterial] = useState<MaterialForecastReport | null>(null);
  const [filterPolymer, setFilterPolymer] = useState<string>('ALL');
  const [forecastConfig, setForecastConfig] = useState<ForecastConfiguration>(DEFAULT_FORECAST_CONFIG);
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [simulatedSurge, setSimulatedSurge] = useState<number>(1.0); // 1.0 = baseline, 1.3 = +30% surge

  // Audio ref for automated alert chime
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play warehouse alarm beep
  const playAlertChime = () => {
    if (isMuted) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Run dynamic forecasting specifically for Raw Plastics
  const { rawPlasticAlerts, rawPlasticsSummary } = useMemo(() => {
    // Filter specifically for raw plastics, flakes, scrap, and regrind polymers
    const rawPlastics = materials.filter((m) => {
      const cat = (m.category || '').toLowerCase();
      const name = (m.nameEn || '').toLowerCase() + (m.nameAr || '');
      const code = (m.code || '').toLowerCase();
      return (
        m.active &&
        (cat.includes('raw') ||
          cat.includes('flake') ||
          cat.includes('scrap') ||
          cat.includes('shred') ||
          cat.includes('خام') ||
          cat.includes('رقائق') ||
          cat.includes('سكراب') ||
          cat.includes('مفروم') ||
          code.startsWith('pet') ||
          code.startsWith('pp') ||
          code.startsWith('hdpe') ||
          code.startsWith('hips') ||
          name.includes('poly') ||
          name.includes('بولي'))
      );
    });

    const activeConfig = {
      ...forecastConfig,
      demandSurgeMultiplier: simulatedSurge,
    };

    const reports = calculatePredictiveInventoryForecast(
      rawPlastics,
      inventoryBalances,
      shreddingTransactions,
      productionIssues,
      suppliers,
      activeConfig
    );

    // Critical safety thresholds condition:
    // 1. Stockout imminent (Runway <= Lead Time, e.g. < 4 days)
    // 2. Critical Safety Threshold breached (Current stock <= suggestedReorderPointKG)
    // 3. Current stock <= statistical safetyStockKG
    const criticalAlerts = reports.filter((r) => {
      return (
        r.stockoutUrgency === 'STOCKOUT_IMMINENT' ||
        r.stockoutUrgency === 'REORDER_NOW' ||
        r.currentStockKG <= r.suggestedReorderPointKG ||
        r.runwayDays <= r.leadTimeDays + 1
      );
    });

    // Sort by most urgent runway days ascending
    criticalAlerts.sort((a, b) => a.runwayDays - b.runwayDays);

    return {
      rawPlasticAlerts: criticalAlerts,
      rawPlasticsSummary: {
        totalCritical: criticalAlerts.length,
        imminentStockouts: criticalAlerts.filter((r) => r.stockoutUrgency === 'STOCKOUT_IMMINENT').length,
        totalDeficitKG: criticalAlerts.reduce((sum, r) => sum + r.deficitToSuggestedROP, 0),
        totalRecommendedReorderKG: criticalAlerts.reduce((sum, r) => sum + r.recommendedReorderQtyKG, 0),
      },
    };
  }, [
    materials,
    inventoryBalances,
    shreddingTransactions,
    productionIssues,
    suppliers,
    forecastConfig,
    simulatedSurge,
  ]);

  // Filtered by polymer type if selected
  const displayedAlerts = useMemo(() => {
    if (filterPolymer === 'ALL') return rawPlasticAlerts;
    return rawPlasticAlerts.filter((r) => {
      const code = r.materialCode.toUpperCase();
      return code.startsWith(filterPolymer);
    });
  }, [rawPlasticAlerts, filterPolymer]);

  // Unacknowledged critical alerts count
  const activeUnacknowledgedCount = useMemo(() => {
    return rawPlasticAlerts.filter((r) => !acknowledgedMaterialIds.includes(r.materialId)).length;
  }, [rawPlasticAlerts, acknowledgedMaterialIds]);

  // Play chime once when critical imminent stockouts are present
  useEffect(() => {
    if (rawPlasticsSummary.imminentStockouts > 0 && !isMuted) {
      playAlertChime();
    }
  }, [rawPlasticsSummary.imminentStockouts, isMuted]);

  const handleAcknowledgeAlert = (materialId: string) => {
    setAcknowledgedMaterialIds((prev) => [...new Set([...prev, materialId])]);
  };

  const handleResetAcknowledged = () => {
    setAcknowledgedMaterialIds([]);
  };

  return (
    <div className="space-y-4">
      {/* Automated Alert Banner for Warehouse Managers */}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 p-4 sm:p-5 shadow-2xl ${
          rawPlasticsSummary.totalCritical > 0
            ? rawPlasticsSummary.imminentStockouts > 0
              ? 'bg-gradient-to-r from-red-950 via-slate-950 to-amber-950 border-red-500/80 shadow-red-950/50'
              : 'bg-gradient-to-r from-amber-950 via-slate-950 to-slate-900 border-amber-500/80 shadow-amber-950/40'
            : 'bg-gradient-to-r from-slate-900 via-slate-950 to-emerald-950/40 border-emerald-500/40'
        }`}
      >
        {/* Flashing ambient accent */}
        {rawPlasticsSummary.totalCritical > 0 && (
          <div
            className={`absolute top-0 start-0 w-2.5 h-full ${
              rawPlasticsSummary.imminentStockouts > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left Narrative & Counter */}
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 border ${
                rawPlasticsSummary.totalCritical > 0
                  ? rawPlasticsSummary.imminentStockouts > 0
                    ? 'bg-red-500/20 text-red-400 border-red-500/60 animate-bounce'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/60'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              }`}
            >
              {rawPlasticsSummary.imminentStockouts > 0 ? (
                <AlertOctagon className="w-6 h-6" />
              ) : rawPlasticsSummary.totalCritical > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    rawPlasticsSummary.imminentStockouts > 0
                      ? 'bg-red-600 text-white animate-pulse'
                      : rawPlasticsSummary.totalCritical > 0
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {rawPlasticsSummary.imminentStockouts > 0
                    ? isRTL
                      ? 'إنذار حرج: نفاد خامات وشيك'
                      : 'CRITICAL RAW PLASTICS DEFICIT'
                    : rawPlasticsSummary.totalCritical > 0
                    ? isRTL
                      ? 'تحذير تجاوز عتبة الأمان'
                      : 'SAFETY THRESHOLD BREACH'
                    : isRTL
                    ? 'أرصدة الخامات آمنة'
                    : 'RAW PLASTICS BUFFER SECURE'}
                </span>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-cyan-300 border border-cyan-500/40">
                  {isRTL ? 'نظام الإنذار الآلي لمدير المستودع' : 'Warehouse Manager Automated Alert System'}
                </span>

                {activeUnacknowledgedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-600 text-white animate-pulse">
                    {activeUnacknowledgedCount} {isRTL ? 'غير مؤكد' : 'Pending'}
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                {rawPlasticsSummary.totalCritical > 0
                  ? isRTL
                    ? `تنبيه: انخفاض مخزون ${rawPlasticsSummary.totalCritical} خامات بلاستيكية أساسية دون عتبة الأمان المعتمدة على معدل الاستهلاك`
                    : `Alert: ${rawPlasticsSummary.totalCritical} Raw Plastics Below Critical Safety Thresholds Based on Recent Consumption Rates`
                  : isRTL
                  ? 'جميع أرصدة الخامات البلاستيكية تفوق عتبات الأمان التشغيلية ومعدلات الاستهلاك اليومية'
                  : 'All Raw Plastic Inventory Balances Exceed Consumption-Based Safety Stock Thresholds'}
              </h3>

              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                {isRTL
                  ? 'يقوم النظام بحساب عتبة الأمان الديناميكية لكل مادة عبر دمج معدل السحب الفعلي لخطوط البثق والمفارم (KG/يوم) مع فترة توريد الموردين (Lead Time). ينبه مدراء المستودعات فوراً قبل توقف خطوط الإنتاج.'
                  : 'Automated monitoring computes dynamic safety thresholds from empirical extrusion and shredding burn rates (KG/day) combined with supplier lead-times to avert production line stockouts.'}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isMuted
                  ? 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  : 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-950'
              }`}
              title={isMuted ? 'Unmute warehouse alert chimes' : 'Mute warehouse alert chimes'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              <span className="text-[11px] font-mono">{isMuted ? (isRTL ? 'صامت' : 'Muted') : (isRTL ? 'صوت التنبيه' : 'Chime On')}</span>
            </button>

            {/* Threshold & Surge Config Button */}
            <button
              type="button"
              onClick={() => setIsConfigDrawerOpen(!isConfigDrawerOpen)}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title={isRTL ? 'تعديل معايير الاستهلاك وفترات التوريد' : 'Adjust Consumption Horizons & Lead Times'}
            >
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-[11px]">{isRTL ? 'معايير الأمان' : 'Thresholds'}</span>
              {isConfigDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* View Full Raw Plastics Alert Diagnostics */}
            {rawPlasticsSummary.totalCritical > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertMaterial(displayedAlerts[0] || null);
                  setIsDetailModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-black shadow-lg shadow-red-950/60 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>{isRTL ? 'إجراءات تفريغ وأوامر الشراء' : 'Manager Action Center'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px] font-mono">
                  {rawPlasticsSummary.totalCritical}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Configuration & Demand Surge Sandbox Drawer */}
        {isConfigDrawerOpen && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRTL ? 'نافذة تحليل الاستهلاك التاريخي' : 'Consumption Horizon'}
                </label>
                <select
                  value={forecastConfig.timeHorizonDays}
                  onChange={(e) => setForecastConfig({ ...forecastConfig, timeHorizonDays: Number(e.target.value) })}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                >
                  <option value={7}>{isRTL ? 'آخر 7 أيام (سريع الاستجابة)' : 'Last 7 Days (Responsive)'}</option>
                  <option value={14}>{isRTL ? 'آخر 14 يوماً (متوازن)' : 'Last 14 Days (Balanced)'}</option>
                  <option value={30}>{isRTL ? 'آخر 30 يوماً (معياري)' : 'Last 30 Days (Standard)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRTL ? 'محاكاة طفرة استهلاك المصنع (+% Surge)' : 'Simulate Demand Surge (+% Surge)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1.0"
                    max="1.75"
                    step="0.05"
                    value={simulatedSurge}
                    onChange={(e) => setSimulatedSurge(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-amber-400 text-xs shrink-0">
                    +{Math.round((simulatedSurge - 1.0) * 100)}%
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {isRTL ? 'فترة توريد الموردين الافتراضية (أيام)' : 'Default Supplier Lead Time (Days)'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={forecastConfig.defaultLeadTimeDays}
                  onChange={(e) => setForecastConfig({ ...forecastConfig, defaultLeadTimeDays: Number(e.target.value) })}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Polymer Quick Filter Tabs & Summary Strip */}
        {rawPlasticsSummary.totalCritical > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 me-1">
                {isRTL ? 'تصفية نوع البوليمر:' : 'Polymer:'}
              </span>
              {['ALL', 'PP', 'PET', 'BTL', 'HIPS'].map((poly) => (
                <button
                  key={poly}
                  type="button"
                  onClick={() => setFilterPolymer(poly)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    filterPolymer === poly
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {poly}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">
                {isRTL ? 'إجمالي العجز للأمان:' : 'Total Safety Deficit:'}{' '}
                <strong className="text-red-400">{(rawPlasticsSummary.totalDeficitKG / 1000).toFixed(1)}t</strong>
              </span>
              <span className="text-slate-400">
                {isRTL ? 'طلب الشراء الموصى به:' : 'Recommended PO:'}{' '}
                <strong className="text-cyan-300">{(rawPlasticsSummary.totalRecommendedReorderKG / 1000).toFixed(1)}t</strong>
              </span>
              {acknowledgedMaterialIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetAcknowledged}
                  className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {isRTL ? 'إلغاء التأكيدات' : 'Reset Acknowledged'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grid of Alert Cards for Raw Plastics Breaching Critical Safety Thresholds */}
      {displayedAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in duration-300">
          {displayedAlerts.map((alert) => {
            const isAcknowledged = acknowledgedMaterialIds.includes(alert.materialId);
            const isImminent = alert.stockoutUrgency === 'STOCKOUT_IMMINENT';

            return (
              <div
                key={alert.materialId}
                className={`rounded-2xl border p-4 transition-all duration-200 shadow-xl relative overflow-hidden flex flex-col justify-between ${
                  isAcknowledged
                    ? 'bg-slate-950/60 border-slate-800 opacity-60'
                    : isImminent
                    ? 'bg-gradient-to-b from-red-950/70 via-slate-950 to-slate-900 border-red-500/70 shadow-red-950/40'
                    : 'bg-gradient-to-b from-amber-950/50 via-slate-950 to-slate-900 border-amber-500/60 shadow-amber-950/30'
                }`}
              >
                {/* Status Tag */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-slate-900 text-cyan-300 border border-cyan-500/40">
                        {alert.materialCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isImminent
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-amber-500 text-slate-950 font-bold'
                        }`}
                      >
                        {isImminent ? (isRTL ? 'نفاد وشيك!' : 'STOCKOUT IMMINENT') : (isRTL ? 'تحت عتبة الأمان' : 'SAFETY BREACH')}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm mt-1.5 leading-snug">
                      {isRTL ? alert.materialNameAr : alert.materialNameEn}
                    </h4>
                    <span className="text-[11px] text-slate-400">{alert.category}</span>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'المهلة المتبقية' : 'Runway'}</span>
                    <span
                      className={`text-lg font-black font-mono ${
                        alert.runwayDays <= 2.5 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`}
                    >
                      {alert.runwayDays} {isRTL ? 'يوم' : 'days'}
                    </span>
                  </div>
                </div>

                {/* Core Metrics: On-Hand vs Critical Threshold vs Daily Burn Rate */}
                <div className="py-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{isRTL ? 'المخزون الحالي الفعلي' : 'Current Stock'}</span>
                      <span className="text-base font-black text-white">
                        {alert.currentStockKG.toLocaleString()} <span className="text-xs text-slate-400 font-normal">KG</span>
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        ~{alert.currentStockBags} {isRTL ? 'شليف' : 'bags'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">
                        {isRTL ? 'عتبة الأمان الديناميكية (ROP)' : 'Dynamic Safety Threshold'}
                      </span>
                      <span className="text-base font-black text-amber-300">
                        {alert.suggestedReorderPointKG.toLocaleString()} <span className="text-xs text-slate-400 font-normal">KG</span>
                      </span>
                      <span className="text-[10px] text-rose-400 block mt-0.5">
                        {isRTL ? 'عجز الأمان:' : 'Deficit:'} -{alert.deficitToSuggestedROP.toLocaleString()} KG
                      </span>
                    </div>
                  </div>

                  {/* Consumption Rate Strip */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isRTL ? 'معدل السحب اليومي للمصنع:' : 'Daily Factory Burn Rate:'}</span>
                    </div>
                    <span className="font-mono font-black text-rose-300">
                      {alert.dailyBurnRateKG.toLocaleString()} KG/{isRTL ? 'يوم' : 'day'}
                    </span>
                  </div>

                  {/* Visual Runway Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{isRTL ? 'مستوى تغطية استهلاك مهلة التوريد' : 'Lead Time Demand Coverage'}</span>
                      <span className="font-mono font-bold text-amber-300">
                        {Math.min(100, Math.round((alert.currentStockKG / Math.max(1, alert.leadTimeDemandKG)) * 100))}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isImminent ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((alert.currentStockKG / Math.max(1, alert.suggestedReorderPointKG)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions for Warehouse Managers */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAlertMaterial(alert);
                      setIsDetailModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تفاصيل الأمان' : 'Diagnostics'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onOpenTransferModal && (
                      <button
                        type="button"
                        onClick={() => onOpenTransferModal(alert.materialId)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title={isRTL ? 'تحويل مخزني فوري' : 'Internal Transfer'}
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'نقل' : 'Transfer'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAlert(alert.materialId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        isAcknowledged
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {isAcknowledged ? (isRTL ? 'تم التأكيد' : 'Muted') : (isRTL ? 'تأكيد الوردية' : 'Acknowledge')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diagnostics & Procurement Dispatch Modal */}
      {isDetailModalOpen && selectedAlertMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-900 border border-amber-500/50 shadow-2xl shadow-amber-950/80 space-y-4 max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {isRTL ? 'تفاصيل عتبة الأمان الاستهلاكية وإجراءات الشراء' : 'Safety Stock & Consumption Diagnostics'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedAlertMaterial.materialCode} • {isRTL ? selectedAlertMaterial.materialNameAr : selectedAlertMaterial.materialNameEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Consumption Formula Breakdown */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                {isRTL ? 'المعادلة الإحصائية لتحديد عتبة الأمان (Dynamic Safety Formula):' : 'Statistical Safety Calculation Formula:'}
              </span>
              <div className="p-2.5 rounded-xl bg-slate-900 font-mono text-xs text-amber-300 border border-slate-800">
                ROP = (Daily Burn Rate × Lead Time) + Safety Stock [Z × σ × √L]
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-center">
                <div className="p-2 rounded-xl bg-slate-900">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'معدل السحب اليومي' : 'Daily Burn Rate'}</span>
                  <span className="font-bold text-white">{selectedAlertMaterial.dailyBurnRateKG.toLocaleString()} KG</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'فترة التوريد' : 'Lead Time'}</span>
                  <span className="font-bold text-white">{selectedAlertMaterial.leadTimeDays} {isRTL ? 'أيام' : 'days'}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'مخزون الأمان الإحصائي' : 'Safety Buffer (SS)'}</span>
                  <span className="font-bold text-amber-400">{selectedAlertMaterial.safetyStockKG.toLocaleString()} KG</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'عتبة إعادة الطلب (ROP)' : 'Threshold ROP'}</span>
                  <span className="font-bold text-rose-400">{selectedAlertMaterial.suggestedReorderPointKG.toLocaleString()} KG</span>
                </div>
              </div>
            </div>

            {/* Supplier Procurement Information */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-cyan-400" />
                {isRTL ? 'المورد المعتمد لتأمين الشحنة فوراً:' : 'Primary Verified Supplier Contact:'}
              </span>
              {selectedAlertMaterial.matchingSuppliers.length > 0 ? (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">
                      {isRTL
                        ? selectedAlertMaterial.matchingSuppliers[0].nameAr
                        : selectedAlertMaterial.matchingSuppliers[0].nameEn}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Code: {selectedAlertMaterial.matchingSuppliers[0].code} • Phone: {selectedAlertMaterial.matchingSuppliers[0].phone || '+964 770 123 4567'}
                    </span>
                  </div>
                  <div className="text-end">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      LEAD TIME: {selectedAlertMaterial.leadTimeDays}d
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  {isRTL ? 'لم يتم ربط مورد مباشر، يرجى التنسيق مع قسم المشتريات.' : 'No direct supplier linked; coordinate with procurement.'}
                </div>
              )}
            </div>

            {/* Immediate Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  if (onOpenTransferModal) {
                    onOpenTransferModal(selectedAlertMaterial.materialId);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>{isRTL ? 'تحويل من مستودع احتياطي' : 'Transfer from Reserve'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  setSelectedMaterialId(selectedAlertMaterial.materialId);
                  setCurrentPage('reports');
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-950"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إصدار إرسالية استلام / طلب شراء' : 'Generate Procurement PO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
