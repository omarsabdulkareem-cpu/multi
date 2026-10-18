import React, { useState, useMemo } from 'react';
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sliders,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  Zap,
  Info,
  RotateCcw,
  Check,
  Package,
  Clock,
  Flame,
  AlertOctagon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import {
  ShiftLaborAnalysis,
  StationCapacityAllocation,
  WorkstationLaborProfile,
} from '../services/shiftLaborAllocationService';

interface ShiftLaborCapacityVisualizerProps {
  analysis: ShiftLaborAnalysis;
  onUpdateLabor: (stationId: string, count: number) => void;
  onAutoOptimize: () => void;
  onResetLabor: () => void;
  totalLaborPool: number;
  setTotalLaborPool: (pool: number) => void;
  onApplyPlan: () => void;
  isApplied?: boolean;
}

export const ShiftLaborCapacityVisualizer: React.FC<ShiftLaborCapacityVisualizerProps> = ({
  analysis,
  onUpdateLabor,
  onAutoOptimize,
  onResetLabor,
  totalLaborPool,
  setTotalLaborPool,
  onApplyPlan,
  isApplied = false,
}) => {
  const { isRTL } = useLanguage();
  const [filterMode, setFilterMode] = useState<'ALL' | 'ATTENTION_NEEDED'>('ALL');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  // Filter stations based on toggle
  const displayedStations = useMemo(() => {
    if (filterMode === 'ATTENTION_NEEDED') {
      return analysis.stations.filter(
        (s) => s.status === 'CRITICAL_SHORTAGE' || s.status === 'UNDERSTAFFED_BOTTLENECK' || s.status === 'TIGHT_SUPPLY'
      );
    }
    return analysis.stations;
  }, [analysis.stations, filterMode]);

  // Prepare data for Recharts
  const chartData = useMemo(() => {
    return analysis.stations.map((s) => ({
      id: s.station.id,
      code: s.station.code,
      stationName: isRTL ? s.station.nameAr : s.station.nameEn,
      shortName: s.station.code,
      materialCode: s.station.targetMaterialCode,
      materialName: isRTL ? s.station.targetMaterialNameAr : s.station.targetMaterialNameEn,
      availableMaterialKG: s.availableMaterialKG,
      projectedCapacityKG: s.projectedCapacityKG,
      allocatedLabor: s.allocatedLabor,
      coverageRatioPct: s.coverageRatioPct,
      hoursToStarvation: s.hoursToStarvation,
      materialVarianceKG: s.materialVarianceKG,
      status: s.status,
      idleLaborHours: s.idleLaborHours,
    }));
  }, [analysis.stations, isRTL]);

  // Selected station details
  const activeStation = useMemo(() => {
    if (!selectedStationId) return analysis.stations[0];
    return analysis.stations.find((s) => s.station.id === selectedStationId) || analysis.stations[0];
  }, [analysis.stations, selectedStationId]);

  return (
    <div className="space-y-6">
      {/* Top Header & Strategy Controls */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#141226] via-[#101320] to-[#0c1626] border border-cyan-500/30 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  PRE-SHIFT LABOR ALLOCATION
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {analysis.netProductiveHours}h {isRTL ? 'صافي ساعات تشغيل' : 'Net Run Hours'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                {isRTL
                  ? 'مطابقة سعة الإنتاج المخططة مع توفر المواد الخام في المستودع'
                  : 'Production Capacity vs Real-Time Material Availability'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'تحليل ذكي لتوزيع مشغلي الوردية لمنع اختناقات المواد الخام وهدر ساعات العمل عند نفاد المخزون'
                  : 'Balances operator crew per machine before shift start to eliminate material starvation and idle labor.'}
              </p>
            </div>
          </div>

          {/* Workforce Pool Counter & Quick Optimization Actions */}
          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            {/* Total Crew Pool Adjuster */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs">
              <span className="text-slate-400">{isRTL ? 'إجمالي طاقم الوردية:' : 'Shift Crew Pool:'}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTotalLaborPool(Math.max(4, totalLaborPool - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Decrease Total Crew Pool"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono font-black text-white text-sm px-1">{totalLaborPool}</span>
                <button
                  onClick={() => setTotalLaborPool(Math.min(20, totalLaborPool + 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Increase Total Crew Pool"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Auto-Balance Button */}
            <button
              onClick={onAutoOptimize}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{isRTL ? 'موازنة العمالة التلقائية' : 'Auto-Balance Labor'}</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={onResetLabor}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isRTL ? 'إعادة التعيين للطاقم القياسي' : 'Reset to Standard Crew'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Executive Guidance Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-3 transition-colors ${
            analysis.criticalShortageCount > 0
              ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
              : analysis.bottleneckCount > 0
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {analysis.criticalShortageCount > 0 ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : analysis.bottleneckCount > 0 ? (
            <AlertOctagon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1">
            <span className="font-bold block mb-0.5">
              {isRTL ? 'توجيهات المشرف قبل انطلاق الوردية:' : 'Pre-Shift Supervisor Directives:'}
            </span>
            <p className="opacity-95">{isRTL ? analysis.executiveSummaryAr : analysis.executiveSummaryEn}</p>
          </div>
        </div>

        {/* Key Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {/* 1. Labor Allocation Ratio */}
          <div className="p-3 rounded-xl bg-[#0c0e15] border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'توزيع العمالة الميدانية' : 'Allocated Crew'}
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-mono font-black text-cyan-400">
                {analysis.allocatedLaborTotal}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ {analysis.totalLaborPool}</span>
              {analysis.unallocatedLabor > 0 && (
                <span className="text-[10px] text-amber-400 font-bold ms-1">
                  ({analysis.unallocatedLabor} {isRTL ? 'احتياط' : 'float'})
                </span>
              )}
            </div>
          </div>

          {/* 2. Total Material Ready */}
          <div className="p-3 rounded-xl bg-[#0c0e15] border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'المواد الخام المتاحة بالمستودع' : 'Available Material Stock'}
            </span>
            <div className="text-xl font-mono font-black text-emerald-400 mt-1">
              {analysis.totalMaterialAvailableKG.toLocaleString()}{' '}
              <span className="text-xs text-slate-400 font-normal">kg</span>
            </div>
          </div>

          {/* 3. Projected Shift Capacity */}
          <div className="p-3 rounded-xl bg-[#0c0e15] border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'طاقة الإنتاج المقدرة للوردية' : 'Projected Shift Capacity'}
            </span>
            <div className="text-xl font-mono font-black text-indigo-400 mt-1">
              {analysis.totalProjectedCapacityKG.toLocaleString()}{' '}
              <span className="text-xs text-slate-400 font-normal">kg</span>
            </div>
          </div>

          {/* 4. Idle Labor Risk */}
          <div className="p-3 rounded-xl bg-[#0c0e15] border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'ساعات هدر العمالة المتوقعة' : 'Idle Labor Risk Hours'}
            </span>
            <div className="text-xl font-mono font-black mt-1">
              <span
                className={analysis.totalIdleLaborHours > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}
              >
                {analysis.totalIdleLaborHours} {isRTL ? 'ساعة' : 'hrs'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization Card */}
      <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>
                {isRTL
                  ? 'مقارنة سعة الإنتاج المخططة مقابل رصيد المواد الخام المتاح (كغم)'
                  : 'Projected Output Capacity vs Real-Time Material Availability (KG)'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'قارن العمود الأخضر (المواد المتاحة) مع العمود الملون (الطاقة الإنتاجية حسب عدد العمال)'
                : 'Compare green bar (stock on hand) against colored bar (projected production output with crew).'}
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-white/5 self-start sm:self-center">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'كافة المحطات (6)' : 'All Stations (6)'}
            </button>
            <button
              onClick={() => setFilterMode('ATTENTION_NEEDED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'ATTENTION_NEEDED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-300" />
              <span>{isRTL ? 'تتطلب تدخلاً' : 'Needs Attention'}</span>
            </button>
          </div>
        </div>

        {/* Legend Indicators */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded-[3px] bg-emerald-500 inline-block" />
              <span>{isRTL ? 'المواد الخام المتاحة بالمستودع' : 'Available Material (Stock)'}</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3 h-3 rounded-[3px] bg-cyan-500 inline-block" />
              <span>{isRTL ? 'طاقة الإنتاج المخططة (عمالة كافية)' : 'Projected Capacity (Optimal)'}</span>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-3 h-3 rounded-[3px] bg-rose-500 inline-block" />
              <span>{isRTL ? 'نقص مواد (خطر توقف مبكر)' : 'Capacity (Material Deficit)'}</span>
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {isRTL ? 'انقر على أي عمود لمعاينة التفاصيل أدناه' : 'Click any bar to inspect station details below'}
          </span>
        </div>

        {/* Recharts BarChart Container */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 15, right: 20, left: 10, bottom: 25 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  setSelectedStationId(e.activePayload[0].payload.id);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="shortName"
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#cbd5e1' }}
                interval={0}
                tickFormatter={(val, idx) => {
                  const entry = chartData[idx];
                  return `${entry?.shortName || val} (${entry?.allocatedLabor || 0}p)`;
                }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                unit=" kg"
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isShortage = data.coverageRatioPct < 70;
                    const isTight = data.coverageRatioPct < 100;

                    return (
                      <div className="bg-[#090b12] border border-slate-700 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 max-w-xs text-white">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="font-bold text-sm text-cyan-300">{data.stationName}</span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                            {data.shortName}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300">
                          <span className="text-slate-400 block">{isRTL ? 'المادة الخام المطلوبة:' : 'Input Material:'}</span>
                          <span className="font-medium text-white">{data.materialName}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                          <div>
                            <span className="text-[10px] text-slate-400 block">{isRTL ? 'المخزون المتاح:' : 'Available Stock:'}</span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {data.availableMaterialKG.toLocaleString()} kg
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">{isRTL ? 'طاقة الإنتاج:' : 'Projected Output:'}</span>
                            <span className="font-mono font-bold text-indigo-300 text-sm">
                              {data.projectedCapacityKG.toLocaleString()} kg
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-white/10 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">{isRTL ? 'نسبة تغطية المخزون:' : 'Coverage Ratio:'}</span>
                            <span
                              className={`font-mono font-bold ${
                                isShortage ? 'text-rose-400' : isTight ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {data.coverageRatioPct}%
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-slate-400">{isRTL ? 'العمالة المخصصة:' : 'Crew Assigned:'}</span>
                            <span className="font-mono font-bold text-cyan-400">
                              {data.allocatedLabor} {isRTL ? 'مشغلين' : 'operators'}
                            </span>
                          </div>

                          {data.allocatedLabor > 0 && data.hoursToStarvation < analysis.netProductiveHours && (
                            <div className="p-1.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-200 text-[10px] font-semibold">
                              {isRTL
                                ? `⚠️ ينفد المخزون بعد ${data.hoursToStarvation} ساعة! (${data.idleLaborHours}h هدر)`
                                : `⚠️ Runs dry in ${data.hoursToStarvation}h! (~${data.idleLaborHours}h idle labor)`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="availableMaterialKG" name={isRTL ? 'المخزون المتاح' : 'Available Material'} fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="projectedCapacityKG"
                name={isRTL ? 'طاقة الإنتاج المقدرة' : 'Projected Output'}
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => {
                  let fillColor = '#6366f1'; // Indigo
                  if (entry.status === 'CRITICAL_SHORTAGE') fillColor = '#f43f5e'; // Rose
                  else if (entry.status === 'TIGHT_SUPPLY') fillColor = '#f59e0b'; // Amber
                  else if (entry.status === 'UNDERSTAFFED_BOTTLENECK') fillColor = '#06b6d4'; // Cyan
                  else if (entry.status === 'OFFLINE') fillColor = '#475569'; // Slate

                  return <Cell key={`cell-${index}`} fill={fillColor} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Workstation Labor Allocator Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>{isRTL ? 'توزيع وتخصيص المشغلين على خطوط الإنتاج' : 'Workstation Labor Allocation Controls'}</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            {isRTL ? 'عدّل عدد العمال لمشاهدة التحديث الفوري لطاقة الإنتاج' : 'Adjust crew size to preview live capacity'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedStations.map((alloc) => {
            const isSelected = selectedStationId === alloc.station.id;
            const isCritical = alloc.status === 'CRITICAL_SHORTAGE';
            const isTight = alloc.status === 'TIGHT_SUPPLY';
            const isBottleneck = alloc.status === 'UNDERSTAFFED_BOTTLENECK';

            return (
              <div
                key={alloc.station.id}
                onClick={() => setSelectedStationId(alloc.station.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'ring-2 ring-cyan-400 bg-[#161a25] border-cyan-500/60 shadow-xl'
                    : isCritical
                    ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500'
                    : 'bg-[#111218] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Station Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-cyan-400">
                          {alloc.station.code}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : isTight
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isBottleneck
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : alloc.status === 'OFFLINE'
                              ? 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {isRTL ? alloc.statusLabelAr : alloc.statusLabelEn}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-white mt-1">
                        {isRTL ? alloc.station.nameAr : alloc.station.nameEn}
                      </h4>
                    </div>

                    {/* Labor Increment / Decrement Counter Controls */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-700" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onUpdateLabor(alloc.station.id, alloc.allocatedLabor - 1)}
                        disabled={alloc.allocatedLabor <= alloc.station.minLabor}
                        className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Remove operator"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <div className="w-6 text-center">
                        <span className="font-mono font-black text-sm text-white">
                          {alloc.allocatedLabor}
                        </span>
                      </div>

                      <button
                        onClick={() => onUpdateLabor(alloc.station.id, alloc.allocatedLabor + 1)}
                        disabled={alloc.allocatedLabor >= alloc.station.maxLabor}
                        className="w-6 h-6 rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Add operator"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                    {isRTL ? alloc.station.primaryProcessAr : alloc.station.primaryProcessEn}
                  </p>
                </div>

                {/* Stock vs Capacity Progress Bar */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Package className="w-3 h-3 text-emerald-400" />
                      <span>{isRTL ? 'المخزون المتاح:' : 'Stock Available:'}</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-400">
                      {alloc.availableMaterialKG.toLocaleString()} kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-indigo-400" />
                      <span>{isRTL ? 'طاقة الإنتاج المقدرة:' : 'Projected Capacity:'}</span>
                    </span>
                    <span className="font-mono font-bold text-indigo-300">
                      {alloc.projectedCapacityKG.toLocaleString()} kg
                    </span>
                  </div>

                  {/* Coverage Bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isCritical
                          ? 'bg-rose-500'
                          : isTight
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, alloc.coverageRatioPct)}%` }}
                    />
                  </div>
                </div>

                {/* Actionable Note */}
                <div className="text-[10px] text-slate-300 bg-black/30 p-2 rounded-lg leading-tight">
                  <span className="font-semibold text-cyan-300 block mb-0.5">
                    {isRTL ? 'التوصية الفنية:' : 'Recommendation:'}
                  </span>
                  <span>{isRTL ? alloc.actionRecommendationAr : alloc.actionRecommendationEn}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Commitment Button */}
      <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'تثبيت خطة توزيع العمالة للوردية القادمة' : 'Commit Labor Allocation to Shift Schedule'}</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {isRTL
              ? `سيتم تسجيل تعيين ${analysis.allocatedLaborTotal} مشغل وتوثيق الناتج المقدر (${analysis.totalProjectedCapacityKG.toLocaleString()} كغم) في سجل الوردية`
              : `Applies allocation of ${analysis.allocatedLaborTotal} operators with projected ${analysis.totalProjectedCapacityKG.toLocaleString()} kg to shift roster.`}
          </p>
        </div>

        <button
          onClick={onApplyPlan}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isApplied ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>{isRTL ? 'تم اعتماد الخطة بنجاح' : 'Allocation Applied!'}</span>
            </>
          ) : (
            <>
              <Users className="w-4 h-4" />
              <span>{isRTL ? 'اعتماد توزيع العمالة وسعة الإنتاج' : 'Apply Labor Allocation'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
