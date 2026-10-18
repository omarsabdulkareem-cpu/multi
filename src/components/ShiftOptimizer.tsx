import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Sparkles,
  Clock,
  Flame,
  Activity,
  User,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Layers,
  Thermometer,
  Coffee,
  Check,
  RefreshCw,
  ArrowRight,
  Users,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  calculateOptimalShiftSchedule,
  ShiftOptimizationConfig,
  ShiftTimeWindow,
  AmbientTemperatureCondition,
  OperatorPhysicalWorkload,
  OptimizationGoal,
  MACHINE_PROFILES,
} from '../services/shiftOptimizerService';
import {
  evaluateShiftLaborAllocation,
  autoOptimizeLaborAllocation,
  WORKSTATION_PROFILES,
  ShiftLaborAnalysis,
} from '../services/shiftLaborAllocationService';
import { ShiftLaborCapacityVisualizer } from './ShiftLaborCapacityVisualizer';

interface ShiftOptimizerProps {
  initialMachineId?: string;
  onApplyToSchedule?: (shiftHours: number, notes: string) => void;
}

export const ShiftOptimizer: React.FC<ShiftOptimizerProps> = ({
  initialMachineId = 'SHR-360',
  onApplyToSchedule,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser, logAudit, setCurrentPage, inventoryBalances, materials } = useFactory();

  // Active module view: Labor Capacity vs Thermal Stress
  const [activeView, setActiveView] = useState<'LABOR_CAPACITY' | 'STRESS_BREAKS'>('LABOR_CAPACITY');

  // Configuration state
  const [config, setConfig] = useState<ShiftOptimizationConfig>({
    machineId: initialMachineId,
    shiftType: 'AFTERNOON',
    ambientCondition: 'EXTREME_HEAT',
    workload: 'HIGH_MANUAL',
    goal: 'MAX_UPTIME',
  });

  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  // Compute thermal stress optimization results
  const result = useMemo(() => {
    return calculateOptimalShiftSchedule(config);
  }, [config]);

  // Pre-shift labor allocation pool state
  const [totalLaborPool, setTotalLaborPool] = useState<number>(10);
  const [laborByStation, setLaborByStation] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    WORKSTATION_PROFILES.forEach((s) => {
      initial[s.id] = s.standardLabor;
    });
    return initial;
  });
  const [laborPlanApplied, setLaborPlanApplied] = useState(false);

  // Compute labor analysis against live inventory balances & projected capacity
  const laborAnalysis: ShiftLaborAnalysis = useMemo(() => {
    return evaluateShiftLaborAllocation({
      laborByStation,
      totalLaborPool,
      shiftDurationHours: result.suggestedOptimalShiftHours,
      netProductiveHours: result.netProductiveRunHours,
      inventoryBalances: inventoryBalances || [],
      materialsCatalog: materials || [],
    });
  }, [laborByStation, totalLaborPool, result, inventoryBalances, materials]);

  const handleUpdateLabor = (stationId: string, count: number) => {
    setLaborByStation((prev) => ({
      ...prev,
      [stationId]: Math.max(0, count),
    }));
    setLaborPlanApplied(false);
  };

  const handleAutoOptimizeLabor = () => {
    const optimized = autoOptimizeLaborAllocation({
      totalLaborPool,
      netProductiveHours: result.netProductiveRunHours,
      inventoryBalances: inventoryBalances || [],
      materialsCatalog: materials || [],
    });
    setLaborByStation(optimized);
    setLaborPlanApplied(false);
  };

  const handleResetLabor = () => {
    const initial: Record<string, number> = {};
    WORKSTATION_PROFILES.forEach((s) => {
      initial[s.id] = s.standardLabor;
    });
    setLaborByStation(initial);
    setLaborPlanApplied(false);
  };

  const handleApplyLaborPlan = () => {
    const summary = isRTL
      ? `تم اعتماد توزيع عمالة الوردية (${laborAnalysis.allocatedLaborTotal}/${totalLaborPool} مشغل) لطاقة إنتاجية مخططة قدرها ${laborAnalysis.totalProjectedCapacityKG.toLocaleString()} كغم.`
      : `Committed pre-shift labor allocation (${laborAnalysis.allocatedLaborTotal}/${totalLaborPool} crew) for projected output of ${laborAnalysis.totalProjectedCapacityKG.toLocaleString()} kg.`;

    try {
      logAudit(
        'PRE_SHIFT_LABOR_ALLOCATION_COMMITTED',
        'توزيع عمالة الوردية ومطابقة الخامات',
        'LABOR_ALLOCATION',
        'FACTORY_SHIFT',
        '-',
        summary,
        summary
      );
    } catch {
      // fallback
    }

    setLaborPlanApplied(true);
    setAppliedFeedback(summary);
    setTimeout(() => setAppliedFeedback(null), 5000);
  };

  // Handle Preset Selection
  const applyPreset = (preset: 'SUMMER_SHRED' | 'NIGHT_EXTRUDER' | 'BALANCED') => {
    if (preset === 'SUMMER_SHRED') {
      setConfig({
        machineId: 'SHR-360',
        shiftType: 'AFTERNOON',
        ambientCondition: 'EXTREME_HEAT',
        workload: 'HIGH_MANUAL',
        goal: 'EQUIPMENT_PRESERVATION',
      });
    } else if (preset === 'NIGHT_EXTRUDER') {
      setConfig({
        machineId: 'EXT-ALL',
        shiftType: 'NIGHT',
        ambientCondition: 'COOL_NORMAL',
        workload: 'LOW_SUPERVISORY',
        goal: 'MAX_UPTIME',
      });
    } else {
      setConfig({
        machineId: 'EXT-01',
        shiftType: 'MORNING',
        ambientCondition: 'MODERATE',
        workload: 'MEDIUM_BALANCED',
        goal: 'MAX_UPTIME',
      });
    }
  };

  const handleApply = () => {
    const summary = isRTL
      ? `تم اعتماد جدول وردية مُحسّن (${result.suggestedOptimalShiftHours} ساعات) لماكينة ${result.machineNameAr} مع ${result.breakSchedule.length} فترات راحة وتبريد.`
      : `Applied optimized shift (${result.suggestedOptimalShiftHours}h) for ${result.machineNameEn} with ${result.breakSchedule.length} cooling breaks.`;

    try {
      logAudit(
        'SHIFT_OPTIMIZATION_APPLIED',
        'اعتماد جدول وردية مُحسّن',
        'SHIFT_SCHEDULE',
        config.machineId,
        '-',
        summary,
        summary
      );
    } catch {
      // fallback
    }

    if (onApplyToSchedule) {
      onApplyToSchedule(result.suggestedOptimalShiftHours, summary);
    }

    setAppliedFeedback(summary);
    setTimeout(() => setAppliedFeedback(null), 5000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Module Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#171328] via-[#10121d] to-[#0f172a] border border-purple-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                AI SHIFT OPTIMIZER
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {isRTL ? 'خوارزمية مواءمة إجهاد الآلة مع يقظة المشغل' : 'Machine Stress & Fatigue Optimization'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {isRTL
                ? 'مُحسِّن فترات الورديات والراحة (ShiftOptimizer)'
                : 'Intelligent Shift & Break Optimizer'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'تحديد المدة المثلى للوردية وفترات التبريد والاستراحة لمنع توقفات الماكينات وتعزيز الإنتاجية'
                : 'Suggests ideal shift durations and synchronized break patterns based on machine thermal stress and human fatigue.'}
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 font-semibold">{isRTL ? 'سيناريوهات سريعة:' : 'Presets:'}</span>
          <button
            onClick={() => applyPreset('SUMMER_SHRED')}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>{isRTL ? 'حرارة ظهيرة الثرامة' : 'Summer Shredder'}</span>
          </button>
          <button
            onClick={() => applyPreset('NIGHT_EXTRUDER')}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRTL ? 'وردية ليلية بثق' : 'Night Extruder'}</span>
          </button>
          <button
            onClick={() => applyPreset('BALANCED')}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'وردية قياسية متوازنة' : 'Standard Balanced'}</span>
          </button>
        </div>
      </div>

      {/* Applied Feedback Notice */}
      {appliedFeedback && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{appliedFeedback}</span>
          </div>
          <button
            onClick={() => setAppliedFeedback(null)}
            className="text-slate-400 hover:text-white px-2 py-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Mode Selector Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#0e1017] border border-white/10 flex-wrap">
        <button
          onClick={() => setActiveView('LABOR_CAPACITY')}
          className={`flex-1 min-w-[280px] py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-between gap-3 ${
            activeView === 'LABOR_CAPACITY'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4" />
            <div className="text-start">
              <span className="block font-black text-xs">
                {isRTL ? 'توزيع العمالة وسعة الإنتاج مقابل الخامات (Recharts)' : 'Labor Allocation vs Material Capacity (Recharts)'}
              </span>
              <span className="text-[10px] opacity-80 font-normal">
                {isRTL ? 'مطابقة المخزون الفعلي مع طاقة الماكينات قبل بدء الوردية' : 'Map real-time stock to machine throughput'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 font-bold shrink-0">
            {laborAnalysis.allocatedLaborTotal}/{totalLaborPool} {isRTL ? 'مشغل' : 'ops'}
          </span>
        </button>

        <button
          onClick={() => setActiveView('STRESS_BREAKS')}
          className={`flex-1 min-w-[280px] py-3 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-between gap-3 ${
            activeView === 'STRESS_BREAKS'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400/40'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-amber-300" />
            <div className="text-start">
              <span className="block font-black text-xs">
                {isRTL ? 'إجهاد الماكينة الحراري وفترات التبريد والراحة' : 'Thermal Stress & Break Patterns'}
              </span>
              <span className="text-[10px] opacity-80 font-normal">
                {isRTL ? 'مكافحة سخونة الموتور وتعب المشغلين بجدول تبريد متزامن' : 'Synchronized cooling & cognitive rests'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 font-bold shrink-0">
            {result.suggestedOptimalShiftHours}h · {result.breakSchedule.length} {isRTL ? 'استراحات' : 'breaks'}
          </span>
        </button>
      </div>

      {/* VIEW 1: PRE-SHIFT LABOR ALLOCATION & MATERIAL-CAPACITY RECHARTS VISUALIZER */}
      {activeView === 'LABOR_CAPACITY' && (
        <ShiftLaborCapacityVisualizer
          analysis={laborAnalysis}
          onUpdateLabor={handleUpdateLabor}
          onAutoOptimize={handleAutoOptimizeLabor}
          onResetLabor={handleResetLabor}
          totalLaborPool={totalLaborPool}
          setTotalLaborPool={setTotalLaborPool}
          onApplyPlan={handleApplyLaborPlan}
          isApplied={laborPlanApplied}
        />
      )}

      {/* VIEW 2: THERMAL STRESS & BREAK PATTERN OPTIMIZER */}
      {activeView === 'STRESS_BREAKS' && (
        <div className="space-y-6">
          {/* Optimization Parameter Controls Grid */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-400" />
            <span>{isRTL ? 'محددات التشغيل وبيئة العمل الحالية' : 'Operational & Environmental Parameters'}</span>
          </h3>
          <span className="text-[11px] text-purple-400 font-mono">
            {isRTL ? 'تحديث فوري لنتائج المحاكاة' : 'Real-Time Calculation'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Machine Target */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'خط الإنتاج / الماكينة' : 'Machine / Line'}</span>
            </label>
            <select
              value={config.machineId}
              onChange={(e) => setConfig({ ...config, machineId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:border-purple-400 outline-none"
            >
              {Object.entries(MACHINE_PROFILES).map(([key, prof]) => (
                <option key={key} value={key}>
                  {isRTL ? prof.nameAr : prof.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Shift Window */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'نافذة الوردية' : 'Shift Window'}</span>
            </label>
            <select
              value={config.shiftType}
              onChange={(e) => setConfig({ ...config, shiftType: e.target.value as ShiftTimeWindow })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:border-purple-400 outline-none"
            >
              <option value="MORNING">{isRTL ? 'صباحية (06:00 - 14:00)' : 'Morning (06:00 - 14:00)'}</option>
              <option value="AFTERNOON">{isRTL ? 'مسائية / ظهيرة (14:00 - 22:00)' : 'Afternoon (14:00 - 22:00)'}</option>
              <option value="NIGHT">{isRTL ? 'ليلية (22:00 - 06:00)' : 'Night (22:00 - 06:00)'}</option>
              <option value="EXTENDED_12H">{isRTL ? 'ممتدة 12 ساعة (06:00 - 18:00)' : 'Extended 12H (06:00 - 18:00)'}</option>
            </select>
          </div>

          {/* 3. Ambient Temperature */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>{isRTL ? 'حرارة صالة المعمل' : 'Ambient Temperature'}</span>
            </label>
            <select
              value={config.ambientCondition}
              onChange={(e) =>
                setConfig({ ...config, ambientCondition: e.target.value as AmbientTemperatureCondition })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:border-purple-400 outline-none"
            >
              <option value="COOL_NORMAL">{isRTL ? 'معتدلة / مكيفة (18 - 26°م)' : 'Cool / HVAC (18-26°C)'}</option>
              <option value="MODERATE">{isRTL ? 'متوسطة (27 - 34°م)' : 'Moderate (27-34°C)'}</option>
              <option value="EXTREME_HEAT">{isRTL ? 'حرارة صيفية شديدة (>35°م)' : 'Extreme Heat (>35°C)'}</option>
            </select>
          </div>

          {/* 4. Operator Workload */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isRTL ? 'الإجهاد البدني للمشغلين' : 'Operator Workload'}</span>
            </label>
            <select
              value={config.workload}
              onChange={(e) =>
                setConfig({ ...config, workload: e.target.value as OperatorPhysicalWorkload })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:border-purple-400 outline-none"
            >
              <option value="HIGH_MANUAL">{isRTL ? 'يدوي شاق (فك بالات / رفع رولات)' : 'High Manual (Bales / Rolls)'}</option>
              <option value="MEDIUM_BALANCED">{isRTL ? 'متوسط متوازن (تغذية قواديس وفحص)' : 'Medium (Hopper / QA)'}</option>
              <option value="LOW_SUPERVISORY">{isRTL ? 'إشرافي مؤتمت (مراقبة شاشات)' : 'Low Supervisory (Console)'}</option>
            </select>
          </div>

          {/* 5. Primary Goal */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isRTL ? 'الهدف الرئيسي' : 'Optimization Goal'}</span>
            </label>
            <select
              value={config.goal}
              onChange={(e) => setConfig({ ...config, goal: e.target.value as OptimizationGoal })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-medium focus:border-purple-400 outline-none"
            >
              <option value="MAX_UPTIME">{isRTL ? 'أعلى إنتاجية وتشغيل (Max Uptime)' : 'Maximum Production Uptime'}</option>
              <option value="EQUIPMENT_PRESERVATION">{isRTL ? 'حماية عمر الماكينات والسكاكين' : 'Equipment Preservation'}</option>
              <option value="FATIGUE_PREVENTION">{isRTL ? 'منع الإجهاد البشري وحوادث العمل' : 'Operator Fatigue Prevention'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary KPI & Duration Comparison Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Recommended Shift Duration Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1b152d] via-[#121422] to-[#121422] border border-purple-500/40 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300">
                {isRTL ? 'مدة الوردية الموصى بها' : 'Recommended Shift Duration'}
              </span>
              <Clock className="w-4 h-4 text-purple-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-white font-mono">
                {result.suggestedOptimalShiftHours}
              </span>
              <span className="text-sm text-slate-400 font-semibold">{isRTL ? 'ساعات' : 'Hours'}</span>
              {result.suggestedOptimalShiftHours !== result.currentStandardShiftHours && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {result.suggestedOptimalShiftHours < result.currentStandardShiftHours
                    ? `-${result.currentStandardShiftHours - result.suggestedOptimalShiftHours}h vs STD`
                    : `+${result.suggestedOptimalShiftHours - result.currentStandardShiftHours}h`}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {isRTL ? result.shiftDurationRecommendationAr : result.shiftDurationRecommendationEn}
            </p>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isRTL ? 'البداية والنهاية المقترحة:' : 'Window:'}</span>
            <span className="font-mono font-bold text-cyan-300">
              {result.shiftStartClock} ➔ {result.shiftEndClock}
            </span>
          </div>
        </div>

        {/* Projected Uptime Gain */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0c1f1c] via-[#11181c] to-[#11181c] border border-emerald-500/30 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                {isRTL ? 'مكاسب التشغيل الصافي (Uptime)' : 'Net Uptime Boost'}
              </span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                +{result.projectedUptimeGainPct}%
              </span>
              <span className="text-xs text-slate-400 font-semibold">{isRTL ? 'تشغيل إضافي' : 'Gain'}</span>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {isRTL
                ? 'فترات الراحة المتزامنة تقضي على 70% من التوقفات غير المخططة الناتجة عن سخونة الموتور أو أخطاء التغذية.'
                : 'Synchronized rests eliminate unplanned line stops from motor tripping and operator feeding jams.'}
            </p>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isRTL ? 'صافي ساعات الإنتاج:' : 'Net Productive Hours:'}</span>
            <span className="font-mono font-bold text-emerald-300">
              {result.netProductiveRunHours}h ({result.totalBreakMinutes}m {isRTL ? 'راحة وتبريد' : 'breaks'})
            </span>
          </div>
        </div>

        {/* Thermal Stress Reduction */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1f1712] via-[#181313] to-[#181313] border border-amber-500/30 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                {isRTL ? 'تخفيض الإجهاد الحراري للماكينة' : 'Thermal Stress Relief'}
              </span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-amber-400 font-mono">
                -{result.thermalStressReductionPct}%
              </span>
              <span className="text-xs text-slate-400 font-semibold">{isRTL ? 'إجهاد ميكانيكي' : 'Stress'}</span>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {isRTL
                ? 'تبريد المحامل وحجرة السكاكين في منتصف الوردية يطيل عمر أسلحة الثرم ويمنع تمدد البراغي.'
                : 'Chamber soak and bearing cool-down extends blade lifespan and prevents extruder screw seizure.'}
            </p>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isRTL ? 'تأثير التآكل:' : 'Wear Impact:'}</span>
            <span className="font-mono font-bold text-amber-300">
              {isRTL ? 'حماية فائقة للسكاكين' : 'Substantial Wear Delay'}
            </span>
          </div>
        </div>

        {/* Operator Fatigue & Defect Reduction */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#171328] via-[#121422] to-[#121422] border border-indigo-500/30 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300">
                {isRTL ? 'تقليل التالف وأخطاء المشغلين' : 'Defect & Fatigue Reduction'}
              </span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black text-indigo-300 font-mono">
                -{result.defectPreventionPct}%
              </span>
              <span className="text-xs text-slate-400 font-semibold">{isRTL ? 'هوالك وتالف' : 'Scrap'}</span>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {isRTL
                ? 'استراحات اليقظة تمنع اضطراب سماكة الفيلم وتضمن إحكام ربط الرولات ومراقبة حساسات الشد.'
                : 'Cognitive vigilance resets avoid film thickness variations and loose roll winding defects.'}
            </p>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isRTL ? 'استعادة اليقظة:' : 'Fatigue Drop:'}</span>
            <span className="font-mono font-bold text-indigo-300">
              -{result.operatorFatigueReductionPct}% {isRTL ? 'إجهاد ذهني' : 'Cognitive Strain'}
            </span>
          </div>
        </div>
      </div>

      {/* Hourly Stress vs Fatigue Dynamic Chart (Recharts) */}
      <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'منحنى إجهاد الماكينة مقابل يقظة المشغل وفترات التبريد' : 'Machine Stress vs Operator Fatigue Timeline'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'توضيح هبوط الإجهاد عند فترات الراحة والتبريد المجدولة (المناطق الخضراء)'
                : 'Visualizes stress accumulation and the immediate restorative impact of synchronized cooling micro-breaks.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-3 h-1.5 rounded-full bg-amber-400 inline-block" />
              {isRTL ? 'إجهاد الماكينة الحراري' : 'Machine Stress'}
            </span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-3 h-1.5 rounded-full bg-indigo-400 inline-block" />
              {isRTL ? 'إجهاد المشغل الذهني' : 'Operator Fatigue'}
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-3 h-1.5 rounded-full bg-cyan-400 inline-block" />
              {isRTL ? 'المخاطر المركبة' : 'Composite Risk'}
            </span>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={result.hourlyTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timeLabel" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis
                stroke="#64748b"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090a10',
                  borderColor: '#ffffff20',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  fontSize: '12px',
                  color: '#fff',
                }}
                formatter={(val: any, name: string) => {
                  if (name === 'machineStressPct') return [`${val}%`, isRTL ? 'إجهاد الماكينة' : 'Machine Stress'];
                  if (name === 'operatorFatiguePct') return [`${val}%`, isRTL ? 'إجهاد المشغل' : 'Operator Fatigue'];
                  if (name === 'compositeRiskPct') return [`${val}%`, isRTL ? 'المخاطر المركبة' : 'Composite Risk'];
                  return [val, name];
                }}
              />
              {/* Critical Danger Threshold at 75% */}
              <ReferenceLine
                y={75}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{
                  value: isRTL ? 'حد الخطر والانهيار (75%)' : 'Trip / Fatigue Critical (75%)',
                  position: 'top',
                  fill: '#f43f5e',
                  fontSize: 10,
                }}
              />
              <Area
                type="monotone"
                dataKey="compositeRiskPct"
                fill="url(#riskGradient)"
                stroke="#06b6d4"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="machineStressPct"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#f59e0b' }}
              />
              <Line
                type="monotone"
                dataKey="operatorFatiguePct"
                stroke="#818cf8"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#818cf8' }}
              />
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Synchronized Break Pattern & Directives Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Synchronized Break Pattern Schedule (7 cols) */}
        <div className="lg:col-span-7 bg-[#111218] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'جدول فترات الراحة والتبريد المتزامنة' : 'Synchronized Break & Machine Cooling Schedule'}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-purple-300 font-bold px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40">
              {result.breakSchedule.length} {isRTL ? 'فترات مجدولة' : 'Breaks'} ({result.totalBreakMinutes}m)
            </span>
          </div>

          <div className="space-y-3">
            {result.breakSchedule.map((brk, idx) => (
              <div
                key={brk.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-white/5 hover:border-purple-500/40 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold text-xs flex items-center justify-center border border-purple-500/40">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {isRTL ? brk.labelAr : brk.labelEn}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {isRTL ? `بعد ${brk.startHour} ساعات من بدء الوردية` : `At Hour ${brk.startHour} of shift`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      {brk.startTime} ({brk.durationMinutes} min)
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        brk.urgency === 'MANDATORY'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {brk.urgency}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                  <div className="bg-black/30 p-2 rounded-lg">
                    <span className="text-[10px] text-indigo-300 block font-semibold flex items-center gap-1 mb-0.5">
                      <User className="w-3 h-3 text-indigo-400" />
                      {isRTL ? 'إجراء المشغل (راحة وترطيب):' : 'Operator Action:'}
                    </span>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      {isRTL ? brk.operatorActionAr : brk.operatorActionEn}
                    </p>
                  </div>

                  <div className="bg-black/30 p-2 rounded-lg">
                    <span className="text-[10px] text-amber-300 block font-semibold flex items-center gap-1 mb-0.5">
                      <Flame className="w-3 h-3 text-amber-400" />
                      {isRTL ? 'إجراء الماكينة (تبريد وتفتيش):' : 'Machine Cooldown Action:'}
                    </span>
                    <p className="text-[11px] text-slate-300 leading-tight">
                      {isRTL ? brk.machineActionAr : brk.machineActionEn}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Operational Directives & Application Trigger (5 cols) */}
        <div className="lg:col-span-5 bg-[#111218] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'توجيهات المشرف الفني لضمان الجاهزية' : 'Supervisor Directives & SOPs'}
              </h3>
            </div>

            <div className="space-y-2.5">
              {(isRTL ? result.keyOperationalDirectivesAr : result.keyOperationalDirectivesEn).map(
                (dir, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-slate-200 flex items-start gap-2.5 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>{dir}</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-white/5 space-y-2.5">
            <button
              onClick={handleApply}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>
                {isRTL
                  ? 'اعتماد هذه الوردية في جدول الماكينات والورديات'
                  : 'Apply to Machine Scheduling Calendar'}
              </span>
            </button>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{isRTL ? 'طباعة بطاقة إرشادات الوردية للمشغلين' : 'Print Shift Briefing Card'}</span>
            </button>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};
