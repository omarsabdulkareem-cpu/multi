import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  TrendingDown,
  ShieldAlert,
  Clock,
  ArrowRight,
  Flame,
  CheckCircle2,
  Sliders,
  ExternalLink,
  Layers,
  Scale,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  calculatePredictiveInventoryForecast,
  getForecastOverviewSummary,
  MaterialForecastReport,
} from '../services/predictiveInventoryForecastingService';

export const PredictiveInventoryForecastingWidget: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    materials,
    inventoryBalances,
    shreddingTransactions,
    productionIssues,
    suppliers,
    updateMaterialSafetyThreshold,
    setCurrentPage,
  } = useFactory();

  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const forecastReports = useMemo(() => {
    return calculatePredictiveInventoryForecast(
      materials,
      inventoryBalances,
      shreddingTransactions,
      productionIssues,
      suppliers
    );
  }, [materials, inventoryBalances, shreddingTransactions, productionIssues, suppliers]);

  const summary = useMemo(() => {
    return getForecastOverviewSummary(forecastReports);
  }, [forecastReports]);

  // Top 4 materials needing attention (highest stockout risk)
  const topCriticalMaterials = useMemo(() => {
    return forecastReports.slice(0, 4);
  }, [forecastReports]);

  const handleApplyRop = async (report: MaterialForecastReport) => {
    try {
      await updateMaterialSafetyThreshold(
        report.materialId,
        report.suggestedReorderPointKG,
        Math.round(report.suggestedReorderPointKG * 3)
      );
      setAppliedNotice(
        isRTL
          ? `تم تحديث حد الأمان للمادة (${report.materialNameAr}) إلى ${report.suggestedReorderPointKG.toLocaleString()} كغم!`
          : `Applied ROP (${report.suggestedReorderPointKG.toLocaleString()} KG) to ${report.materialNameEn}!`
      );
      setTimeout(() => setAppliedNotice(null), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      id="predictive-inventory-forecast-section"
      className="bg-gradient-to-br from-[#12141c] via-[#0f1017] to-[#12141c] rounded-2xl border border-purple-500/20 shadow-xl overflow-hidden scroll-mt-6"
    >
      {/* Widget Header */}
      <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-inner">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                PREDICTIVE AI
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {isRTL ? 'تحليل سحب الثرامة والبثق' : 'Empirical Demand Analytics'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              {isRTL
                ? 'التنبؤ بنفاد المواد ونقاط إعادة الطلب المقترحة (ROP)'
                : 'Predictive Inventory Runway & Suggested Reorder Points'}
            </h2>
          </div>
        </div>

        {/* Action Button: Open Full Interactive Module */}
        <button
          onClick={() => setCurrentPage('forecasting')}
          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer flex items-center gap-2 self-stretch sm:self-auto justify-center"
        >
          <span>{isRTL ? 'فتح لوحة التنبؤ والمحاكاة الكاملة' : 'Open Full Forecasting Engine'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Applied Notice */}
      {appliedNotice && (
        <div className="px-5 py-2.5 bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border-b border-white/5">
        <div className="p-4 bg-[#0d0e14]">
          <span className="text-[11px] text-slate-400 block font-semibold flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            {isRTL ? 'معدل السحب اليومي للمصنع' : 'Daily Plant Burn Rate'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-mono font-black text-amber-400">
              {summary.totalDailyPlantBurnRateKG.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">KG/day</span>
          </div>
        </div>

        <div className="p-4 bg-[#0d0e14]">
          <span className="text-[11px] text-slate-400 block font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            {isRTL ? 'نفاد وشيك قبل وصول الشحنة' : 'Imminent Stockouts'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className={`text-xl font-mono font-black ${
                summary.imminentStockoutsCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {summary.imminentStockoutsCount}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {isRTL ? 'أصناف حرجة' : 'items'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#0d0e14]">
          <span className="text-[11px] text-slate-400 block font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            {isRTL ? 'أصناف تجاوزت نقطة الطلب' : 'Breached ROP'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-mono font-black text-cyan-400">
              {summary.materialsNeedingImmediateReorder}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">/ {summary.totalMaterials}</span>
          </div>
        </div>

        <div className="p-4 bg-[#0d0e14]">
          <span className="text-[11px] text-slate-400 block font-semibold flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-purple-400" />
            {isRTL ? 'الكمية الموصى بإعادة طلبها' : 'Total Reorder Target'}
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-mono font-black text-purple-300">
              {(summary.totalRecommendedReorderKG / 1000).toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{isRTL ? 'طن' : 'Tons'}</span>
          </div>
        </div>
      </div>

      {/* Top Critical Materials Preview Table */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="font-bold text-slate-300 uppercase tracking-wider">
            {isRTL ? 'الأصناف الأكثر استهلاكاً وعرضة للنفاذ' : 'High-Velocity Materials Requiring Attention'}
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            {isRTL ? 'بناءً على وتيرة الثرم والإنتاج' : 'Driven by live extrusion & shredding history'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topCriticalMaterials.map((mat) => {
            const isImminent = mat.stockoutUrgency === 'STOCKOUT_IMMINENT';
            const isReorder = mat.stockoutUrgency === 'REORDER_NOW';

            return (
              <div
                key={mat.materialId}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isImminent
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : isReorder
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-slate-900/60 border-white/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                        {mat.materialCode}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate max-w-[180px]">
                        {isRTL ? mat.materialNameAr : mat.materialNameEn}
                      </h4>
                    </div>

                    <div>
                      {isImminent ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-600 text-white">
                          {isRTL ? 'نفاد وشيك' : 'IMMINENT'}
                        </span>
                      ) : isReorder ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500 text-slate-950">
                          {isRTL ? 'طلب الآن' : 'REORDER'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          {isRTL ? 'مستقر' : 'OPTIMAL'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock vs ROP Comparison */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] my-2.5 pt-2 border-t border-white/5">
                    <div className="bg-black/30 p-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">{isRTL ? 'الرصيد الحالي' : 'Stock'}</span>
                      <span className="font-mono font-bold text-white">
                        {mat.currentStockKG.toLocaleString()} KG
                      </span>
                    </div>
                    <div className="bg-purple-950/30 p-1.5 rounded-lg border border-purple-500/20">
                      <span className="text-[10px] text-purple-300 block">{isRTL ? 'نقطة الطلب (ROP)' : 'Suggested ROP'}</span>
                      <span className="font-mono font-black text-purple-300">
                        {mat.suggestedReorderPointKG.toLocaleString()} KG
                      </span>
                    </div>
                    <div className="bg-black/30 p-1.5 rounded-lg">
                      <span className="text-[10px] text-slate-400 block">{isRTL ? 'الرصيد الزمني' : 'Runway'}</span>
                      <span
                        className={`font-mono font-bold ${
                          mat.runwayDays <= mat.leadTimeDays ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {mat.runwayDays} {isRTL ? 'يوم' : 'days'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                  <span className="text-[10px] text-slate-400">
                    {isRTL ? 'طلب موصى به:' : 'Reorder:'}{' '}
                    <strong className="text-emerald-400 font-mono">
                      {mat.recommendedReorderQtyKG.toLocaleString()} KG
                    </strong>
                  </span>

                  <button
                    onClick={() => handleApplyRop(mat)}
                    className="px-2 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                    title={isRTL ? 'تحديث الحد الأدنى للمادة بنقطة الطلب المقترحة' : 'Apply suggested ROP'}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isRTL ? 'اعتماد ROP' : 'Apply ROP'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
