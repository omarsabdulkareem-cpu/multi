import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Clock,
  Calendar,
  BarChart3,
  Layers,
  CheckCircle2,
  Info,
  Flame,
  Factory,
  Scale,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';

export interface ShiftTrendDataPoint {
  id: string;
  shiftIndex: number; // 1 to 7 (7 is current/latest)
  date: string;
  shiftType: 'MORNING' | 'EVENING' | 'NIGHT';
  shiftNameAr: string;
  shiftNameEn: string;
  labelAr: string;
  labelEn: string;
  timeRange: string;
  // Weight metrics (in KG)
  shreddingKG: number;
  productionKG: number;
  totalWeightKG: number;
  totalWeightTons: number;
  targetKG: number;
  varianceKG: number;
  variancePct: number;
  // Efficiency & health
  efficiencyRatePct: number;
  damageKG: number;
  operatingHours: number;
  downtimeHours: number;
  // Pattern classification
  patternType: 'NORMAL' | 'SPIKE' | 'DOWNTIME';
  patternTitleAr: string;
  patternTitleEn: string;
  patternReasonAr: string;
  patternReasonEn: string;
  supervisor: string;
  notesAr: string;
  notesEn: string;
}

export const ShiftHistoryTrendChart: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    shreddingTransactions,
    productionOrders,
    productionIssues,
    receivingTransactions,
    productionDamages,
    shiftHandovers,
  } = useFactory();

  const [viewMetric, setViewMetric] = useState<'TOTAL' | 'STACKED' | 'EFFICIENCY'>('TOTAL');
  const [highlightPatterns, setHighlightPatterns] = useState<boolean>(true);
  const [showTargetLine, setShowTargetLine] = useState<boolean>(true);
  const [showAverageLine, setShowAverageLine] = useState<boolean>(true);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // BUILD 7 SEQUENTIAL SHIFTS WITH FACTORY DATA & REALISTIC TRENDS
  // --------------------------------------------------------------------------
  const trendData: ShiftTrendDataPoint[] = useMemo(() => {
    // 7 Shifts leading up to Current:
    // Shift 1: Day -2 Morning
    // Shift 2: Day -2 Evening
    // Shift 3: Day -2 Night (DOWNTIME PATTERN: Blade change & PM overhaul)
    // Shift 4: Day -1 Morning
    // Shift 5: Day -1 Evening (SPIKE PATTERN: High-throughput dual line run)
    // Shift 6: Day -1 Night
    // Shift 7: Today Morning / Current (OPTIMAL: Steady state operations)

    // Calculate real 2026-09-02 Morning values from context
    const sept2MorningShred = shreddingTransactions
      .filter((s) => (s.shreddingStart?.includes('2026-09-02') || s.shreddingEnd?.includes('2026-09-02')))
      .reduce((sum, s) => sum + (s.outputKG || 0), 0) || 6220;

    const sept2MorningProd = productionOrders
      .filter((p) => p.date === '2026-09-02' && (!p.shift || p.shift.includes('صباح') || p.shift.includes('06:00')))
      .reduce((sum, p) => sum + (p.actualProductionKG || 0), 0) || 6190.5;

    // Calculate real 2026-09-01 Evening values from context
    const sept1EveningProd = productionOrders
      .filter((p) => p.date === '2026-09-01' && p.shift?.includes('مساء'))
      .reduce((sum, p) => sum + (p.actualProductionKG || 0), 0) || 9650;

    const sept1Shredding = shreddingTransactions
      .filter((s) => s.shreddingStart?.includes('2026-09-01'))
      .reduce((sum, s) => sum + (s.outputKG || 0), 0) || 11480;

    const baseShifts: ShiftTrendDataPoint[] = [
      {
        id: 'shift-1',
        shiftIndex: 1,
        date: '2026-08-31',
        shiftType: 'MORNING',
        shiftNameAr: 'صباحي',
        shiftNameEn: 'Morning',
        labelAr: '31 آب (ص)',
        labelEn: '31 Aug (M)',
        timeRange: '06:00 - 14:00',
        shreddingKG: 5800,
        productionKG: 7200,
        totalWeightKG: 13000,
        totalWeightTons: 13.0,
        targetKG: 15000,
        varianceKG: -2000,
        variancePct: -13.3,
        efficiencyRatePct: 91.2,
        damageKG: 210,
        operatingHours: 7.5,
        downtimeHours: 0.5,
        patternType: 'NORMAL',
        patternTitleAr: 'تشغيل اعتيادي منتظم',
        patternTitleEn: 'Standard Production Flow',
        patternReasonAr: 'تشغيل اعتيادي لخطوط الألواح مع توريد خامات رولات بكر',
        patternReasonEn: 'Routine sheet extrusion with standard virgin roll feeding',
        supervisor: 'عمر عبدالكريم',
        notesAr: 'التشغيل مستقر والمستودع استلم 13 طن نواتج',
        notesEn: 'Stable run; warehouse received 13 tons net output',
      },
      {
        id: 'shift-2',
        shiftIndex: 2,
        date: '2026-08-31',
        shiftType: 'EVENING',
        shiftNameAr: 'مسائي',
        shiftNameEn: 'Evening',
        labelAr: '31 آب (م)',
        labelEn: '31 Aug (E)',
        timeRange: '14:00 - 22:00',
        shreddingKG: 6400,
        productionKG: 8100,
        totalWeightKG: 14500,
        totalWeightTons: 14.5,
        targetKG: 15000,
        varianceKG: -500,
        variancePct: -3.3,
        efficiencyRatePct: 93.8,
        damageKG: 190,
        operatingHours: 7.8,
        downtimeHours: 0.2,
        patternType: 'NORMAL',
        patternTitleAr: 'ضمن المدى المستهدف',
        patternTitleEn: 'Near-Target Performance',
        patternReasonAr: 'استقرار معدل السحب في خط الأكواب ومكينة الثرم 01',
        patternReasonEn: 'Stable draw on cup forming line and shredder 01',
        supervisor: 'م. أحمد الناصر',
        notesAr: 'تم إنجاز 97% من خطة الوردية بدون معوقات',
        notesEn: '97% of shift plan achieved with zero disruptions',
      },
      {
        id: 'shift-3',
        shiftIndex: 3,
        date: '2026-08-31',
        shiftType: 'NIGHT',
        shiftNameAr: 'ليلي',
        shiftNameEn: 'Night',
        labelAr: '31 آب (ل)',
        labelEn: '31 Aug (N)',
        timeRange: '22:00 - 06:00',
        shreddingKG: 2100,
        productionKG: 3400,
        totalWeightKG: 5500,
        totalWeightTons: 5.5,
        targetKG: 12000,
        varianceKG: -6500,
        variancePct: -54.2,
        efficiencyRatePct: 74.5,
        damageKG: 480,
        operatingHours: 4.2,
        downtimeHours: 3.8,
        patternType: 'DOWNTIME',
        patternTitleAr: 'نمط توقف وصيانة وقائية (Downtime Event)',
        patternTitleEn: 'Downtime Pattern (Blade Change & PM)',
        patternReasonAr: 'توقف مجدول 3.8 ساعات لتبديل شفرات ماكينة الثرم الثقيل وإجراء محاذاة مسارات البثق',
        patternReasonEn: '3.8h scheduled downtime for shredder blade swap & extruder alignment',
        supervisor: 'م. كرار منصور',
        notesAr: 'انخفاض الإنتاج ناتج عن صيانة مجدولة معتمدة من مدير الصيانة',
        notesEn: 'Output drop strictly caused by approved preventative overhaul',
      },
      {
        id: 'shift-4',
        shiftIndex: 4,
        date: '2026-09-01',
        shiftType: 'MORNING',
        shiftNameAr: 'صباحي',
        shiftNameEn: 'Morning',
        labelAr: '01 أيلول (ص)',
        labelEn: '01 Sep (M)',
        timeRange: '06:00 - 14:00',
        shreddingKG: 6200,
        productionKG: 7800,
        totalWeightKG: 14000,
        totalWeightTons: 14.0,
        targetKG: 15000,
        varianceKG: -1000,
        variancePct: -6.7,
        efficiencyRatePct: 92.5,
        damageKG: 230,
        operatingHours: 7.6,
        downtimeHours: 0.4,
        patternType: 'NORMAL',
        patternTitleAr: 'تعافي سريع واستقرار التشغيل',
        patternTitleEn: 'Rapid Recovery & Rebound',
        patternReasonAr: 'استئناف الطاقة الكاملة لماكينة الثرم بعد تركيب الشفرات الجديدة بكفاءة 92.5%',
        patternReasonEn: 'Full shredder capacity restored post-blade replacement',
        supervisor: 'عمر عبدالكريم',
        notesAr: 'سرعة الثرم ارتفعت بنسبة 18% مقارنة بما قبل الصيانة',
        notesEn: 'Shredding rate gained +18% speed post-maintenance',
      },
      {
        id: 'shift-5',
        shiftIndex: 5,
        date: '2026-09-01',
        shiftType: 'EVENING',
        shiftNameAr: 'مسائي',
        shiftNameEn: 'Evening',
        labelAr: '01 أيلول (م)',
        labelEn: '01 Sep (E)',
        timeRange: '14:00 - 22:00',
        shreddingKG: Math.round(sept1Shredding * 0.75), // ~8,610 KG
        productionKG: sept1EveningProd, // 9,650 KG
        totalWeightKG: Math.round(sept1Shredding * 0.75 + sept1EveningProd), // ~18,260 KG
        totalWeightTons: Math.round((sept1Shredding * 0.75 + sept1EveningProd) / 100) / 10, // ~18.3 T
        targetKG: 15000,
        varianceKG: Math.round(sept1Shredding * 0.75 + sept1EveningProd - 15000),
        variancePct: Math.round(((sept1Shredding * 0.75 + sept1EveningProd - 15000) / 15000) * 1000) / 10,
        efficiencyRatePct: 97.4,
        damageKG: 350,
        operatingHours: 8.0,
        downtimeHours: 0.0,
        patternType: 'SPIKE',
        patternTitleAr: 'طفرة إنتاجية قياسية (Production Spike +21.7%)',
        patternTitleEn: 'Production Spike (+21.7% Peak Output)',
        patternReasonAr: 'تشغيل متزامن لطلبية PO-2026-0881 على خط البثق 1 مع ناتج ثرم قياسي 11.4 طن',
        patternReasonEn: 'Dual max throughput: Order PO-0881 on Extruder 1 + record shredding output',
        supervisor: 'م. أحمد الناصر',
        notesAr: 'أعلى رقم إنتاجي في الأسبوع بدون أي توقفات غير مخططة',
        notesEn: 'Record weekly shift output with zero unscheduled stops',
      },
      {
        id: 'shift-6',
        shiftIndex: 6,
        date: '2026-09-01',
        shiftType: 'NIGHT',
        shiftNameAr: 'ليلي',
        shiftNameEn: 'Night',
        labelAr: '01 أيلول (ل)',
        labelEn: '01 Sep (N)',
        timeRange: '22:00 - 06:00',
        shreddingKG: 4500,
        productionKG: 6600,
        totalWeightKG: 11100,
        totalWeightTons: 11.1,
        targetKG: 12000,
        varianceKG: -900,
        variancePct: -7.5,
        efficiencyRatePct: 93.0,
        damageKG: 160,
        operatingHours: 7.7,
        downtimeHours: 0.3,
        patternType: 'NORMAL',
        patternTitleAr: 'وردية ليلية متوازنة',
        patternTitleEn: 'Balanced Night Operation',
        patternReasonAr: 'استكمال تجهيز حبيبات PP واستمرار خط التشكيل الحراري للأكواب 1',
        patternReasonEn: 'Continued thermoforming run with ready granulate buffer',
        supervisor: 'م. مصطفى جبار',
        notesAr: 'تم تأمين الشلايف والمواد المجهزة للوردية الصباحية القادمة',
        notesEn: 'Buffer stock staged for incoming morning shift crew',
      },
      {
        id: 'shift-7',
        shiftIndex: 7,
        date: '2026-09-02',
        shiftType: 'MORNING',
        shiftNameAr: 'صباحي (الحالية)',
        shiftNameEn: 'Morning (Current)',
        labelAr: '02 أيلول (ص)',
        labelEn: '02 Sep (M)',
        timeRange: '06:00 - 14:00',
        shreddingKG: sept2MorningShred, // 6,220 KG
        productionKG: sept2MorningProd, // 6,190.5 KG
        totalWeightKG: Math.round(sept2MorningShred + sept2MorningProd), // 12,410.5 KG
        totalWeightTons: Math.round((sept2MorningShred + sept2MorningProd) / 100) / 10, // 12.4 T
        targetKG: 16000,
        varianceKG: Math.round(sept2MorningShred + sept2MorningProd - 16000),
        variancePct: Math.round(((sept2MorningShred + sept2MorningProd - 16000) / 16000) * 1000) / 10,
        efficiencyRatePct: 95.8,
        damageKG: 240,
        operatingHours: 7.8,
        downtimeHours: 0.2,
        patternType: 'NORMAL',
        patternTitleAr: 'الوردية الحالية - كفاءة عالية 95.8%',
        patternTitleEn: 'Active Shift - High Efficiency 95.8%',
        patternReasonAr: 'استلام إرسالية سابك 16.2 طن ودورة ثرم هوالك الألواح بنجاح مستند 352',
        patternReasonEn: 'SABIC bulk receipt + Document 352 sheet trim regrind completed',
        supervisor: 'عمر عبدالكريم',
        notesAr: 'الوردية جارية ومعدل الجودة ضمن أعلى المعايير (تالف 1.8%)',
        notesEn: 'Shift in active execution; scrap rate minimal at 1.8%',
      },
    ];

    return baseShifts;
  }, [shreddingTransactions, productionOrders, shiftHandovers]);

  // Selected shift for detailed inspection drawer
  const activeSelectedShift = useMemo(() => {
    if (selectedShiftId) {
      return trendData.find((s) => s.id === selectedShiftId) || trendData[trendData.length - 1];
    }
    return trendData[trendData.length - 1]; // Default to current/latest
  }, [trendData, selectedShiftId]);

  // --------------------------------------------------------------------------
  // AGGREGATE SUMMARY STATISTICS
  // --------------------------------------------------------------------------
  const stats = useMemo(() => {
    const totalProcessed = trendData.reduce((acc, curr) => acc + curr.totalWeightKG, 0);
    const averageProcessed = Math.round(totalProcessed / trendData.length);
    const spikesCount = trendData.filter((s) => s.patternType === 'SPIKE').length;
    const downtimeCount = trendData.filter((s) => s.patternType === 'DOWNTIME').length;
    const highestShift = [...trendData].sort((a, b) => b.totalWeightKG - a.totalWeightKG)[0];
    const lowestShift = [...trendData].sort((a, b) => a.totalWeightKG - b.totalWeightKG)[0];
    const meanEfficiency = Math.round(
      trendData.reduce((acc, curr) => acc + curr.efficiencyRatePct, 0) / trendData.length
    );

    return {
      totalProcessedKG: totalProcessed,
      totalProcessedTons: (totalProcessed / 1000).toFixed(1),
      averageProcessedKG: averageProcessed,
      spikesCount,
      downtimeCount,
      highestShift,
      lowestShift,
      meanEfficiency,
    };
  }, [trendData]);

  // Color helper for custom cell bars
  const getBarColor = (entry: ShiftTrendDataPoint) => {
    if (!highlightPatterns) return '#06b6d4'; // Uniform cyan
    if (entry.patternType === 'SPIKE') return '#a855f7'; // Purple / Violet for Spikes
    if (entry.patternType === 'DOWNTIME') return '#f43f5e'; // Rose / Red for Downtime
    if (entry.shiftIndex === 7) return '#10b981'; // Emerald for Current shift
    return '#06b6d4'; // Standard Cyan for normal shifts
  };

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: ShiftTrendDataPoint = payload[0].payload;
      const isSpike = data.patternType === 'SPIKE';
      const isDowntime = data.patternType === 'DOWNTIME';

      return (
        <div
          className="bg-[#11131a]/95 backdrop-blur-md border border-cyan-500/40 p-4 rounded-xl shadow-2xl text-xs space-y-2.5 max-w-xs z-50 text-start"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/10">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm">
                  {isRTL ? data.labelAr : data.labelEn}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">({data.timeRange})</span>
              </div>
              <p className="text-[10px] text-cyan-400 font-mono">{data.date}</p>
            </div>

            {/* Pattern Badge */}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                isSpike
                  ? 'bg-purple-950 text-purple-300 border-purple-500/50'
                  : isDowntime
                  ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {isSpike
                ? isRTL
                  ? 'طفرة إنتاج 🚀'
                  : 'SPIKE 🚀'
                : isDowntime
                ? isRTL
                  ? 'توقف / صيانة ⚠️'
                  : 'DOWNTIME ⚠️'
                : isRTL
                ? 'منتظم ✓'
                : 'NORMAL ✓'}
            </span>
          </div>

          {/* Primary Metrics */}
          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{isRTL ? 'إجمالي الوزن المعالج:' : 'Total Processed:'}</span>
              <strong className="text-white text-sm">
                {data.totalWeightKG.toLocaleString()} KG
                <span className="text-[10px] text-cyan-400 font-normal ml-1">
                  ({data.totalWeightTons} T)
                </span>
              </strong>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{isRTL ? 'ناتج الثرم (360):' : 'Shredding (360):'}</span>
              <span className="text-cyan-300">{data.shreddingKG.toLocaleString()} KG</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{isRTL ? 'ناتج الإنتاج (167):' : 'Production (167):'}</span>
              <span className="text-emerald-300">{data.productionKG.toLocaleString()} KG</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{isRTL ? 'المستهدف / التباين:' : 'Target / Variance:'}</span>
              <span className={data.varianceKG >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                {data.varianceKG >= 0 ? `+${data.varianceKG.toLocaleString()}` : data.varianceKG.toLocaleString()} KG ({data.variancePct}%)
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{isRTL ? 'معدل الكفاءة (OEE):' : 'Machine Efficiency:'}</span>
              <span className="text-white font-bold">{data.efficiencyRatePct}%</span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">{isRTL ? 'ساعات التوقف (Downtime):' : 'Downtime Hours:'}</span>
              <span className={data.downtimeHours > 1 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                {data.downtimeHours} hrs
              </span>
            </div>
          </div>

          {/* Diagnostic Reason */}
          <div className="p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] text-slate-300">
            <span className="text-[10px] text-slate-400 block font-semibold">
              {isRTL ? 'التشخيص التشغيلي:' : 'Operational Diagnosis:'}
            </span>
            <p className="mt-0.5 text-slate-200">
              {isRTL ? data.patternReasonAr : data.patternReasonEn}
            </p>
          </div>

          {/* Supervisor Footer */}
          <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>{isRTL ? 'المشرف المسؤول:' : 'Supervisor:'}</span>
            <span className="text-cyan-300 font-semibold">{data.supervisor}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="shift-history-trend-chart-section"
      className="relative rounded-2xl bg-gradient-to-b from-[#14161f] via-[#111218] to-[#0c0d12] border border-cyan-500/25 p-5 sm:p-6 shadow-2xl overflow-hidden transition-all duration-300 scroll-mt-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* HUD Atmosphere Glows */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* --------------------------------------------------------------------- */}
      {/* 1. HEADER & CONTROLS */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
              HISTORICAL SHIFT ANALYTICS
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1">
              <Zap className="w-3 h-3 text-purple-400" />
              {isRTL ? 'كاشف الطفرات والتوقفات' : 'Spikes & Downtime Detector'}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {isRTL ? 'آخر 7 ورديات متتالية' : 'Last 7 Consecutive Shifts'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span>
              {isRTL
                ? 'مخطط اتجاه الإنتاج للورديات الـ 7 الأخيرة (Recharts)'
                : 'Last 7 Shifts Total Processed Weight Historical Trend'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isRTL
              ? 'مقارنة إجمالي الأوزان المعالجة (ثرم + إنتاج) واكتشاف طفرات الإنتاج وأنماط التوقف الميكانيكي'
              : 'Compare total processed weight (regrind + extrusion), highlighting production surges and downtime patterns'}
          </p>
        </div>

        {/* View Mode & Toggles */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Metric View Switcher */}
          <div className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => setViewMetric('TOTAL')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMetric === 'TOTAL'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'إجمالي الوزن' : 'Total Weight'}
            </button>
            <button
              onClick={() => setViewMetric('STACKED')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMetric === 'STACKED'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'ثرم / إنتاج' : 'Shred vs Prod'}
            </button>
            <button
              onClick={() => setViewMetric('EFFICIENCY')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMetric === 'EFFICIENCY'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'الكفاءة %' : 'Efficiency %'}
            </button>
          </div>

          {/* Toggle: Pattern Highlights */}
          <button
            onClick={() => setHighlightPatterns((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              highlightPatterns
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
            }`}
            title={isRTL ? 'تفعيل أو تعطيل تلوين الطفرات وحالات التوقف' : 'Toggle Spike/Downtime Pattern Coloring'}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{isRTL ? 'إبراز الأنماط' : 'Highlight Patterns'}</span>
          </button>

          {/* Toggle: Target Line */}
          <button
            onClick={() => setShowTargetLine((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
              showTargetLine
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-900 text-slate-500 border-white/10 hover:text-slate-300'
            }`}
            title={isRTL ? 'إظهار خط مستهدف الوردية' : 'Toggle Target Benchmark Line'}
          >
            {isRTL ? 'خط الهدف' : 'Target Line'}
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. STATS OVERVIEW CHIPS */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 my-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Total 7 Shifts */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'إجمالي الـ 7 ورديات:' : '7-Shift Total:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-white">
              {stats.totalProcessedTons}
            </span>
            <span className="text-xs text-cyan-400 font-mono uppercase">{isRTL ? 'طن' : 'Tons'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            ({stats.totalProcessedKG.toLocaleString()} KG)
          </span>
        </div>

        {/* Average per Shift */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'المتوسط لكل وردية:' : 'Mean per Shift:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-cyan-300">
              {(stats.averageProcessedKG / 1000).toFixed(1)}
            </span>
            <span className="text-xs text-cyan-400 font-mono uppercase">{isRTL ? 'طن' : 'Tons'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            ({stats.averageProcessedKG.toLocaleString()} KG)
          </span>
        </div>

        {/* Highest Spike */}
        <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-purple-300 uppercase font-mono block font-bold">
              {isRTL ? 'أعلى طفرة إنتاج:' : 'Peak Spike:'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-purple-300">
              {stats.highestShift.totalWeightTons}
            </span>
            <span className="text-xs text-purple-400 font-mono uppercase">{isRTL ? 'طن' : 'Tons'}</span>
          </div>
          <span className="text-[10px] text-purple-400/80 font-mono block truncate">
            {isRTL ? stats.highestShift.labelAr : stats.highestShift.labelEn} (+{stats.highestShift.variancePct}%)
          </span>
        </div>

        {/* Lowest Downtime Shift */}
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-300 uppercase font-mono block font-bold">
              {isRTL ? 'أدنى توقف (Downtime):' : 'Lowest Shift:'}
            </span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-rose-300">
              {stats.lowestShift.totalWeightTons}
            </span>
            <span className="text-xs text-rose-400 font-mono uppercase">{isRTL ? 'طن' : 'Tons'}</span>
          </div>
          <span className="text-[10px] text-rose-400/80 font-mono block truncate">
            {isRTL ? stats.lowestShift.labelAr : stats.lowestShift.labelEn} ({stats.lowestShift.downtimeHours}h PM)
          </span>
        </div>

        {/* Spikes / Downtime Counts */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'كشف الأنماط الاستثنائية:' : 'Anomalies Detected:'}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
              {stats.spikesCount} {isRTL ? 'طفرة' : 'Spike'}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
              {stats.downtimeCount} {isRTL ? 'توقف' : 'Downtime'}
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono block mt-1">
            5 {isRTL ? 'ورديات مستقرة' : 'Normal Shifts'}
          </span>
        </div>

        {/* Mean OEE Efficiency */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'متوسط كفاءة OEE:' : 'Mean Efficiency:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-emerald-300">
              {stats.meanEfficiency}%
            </span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono block">
            {isRTL ? 'أداء مصنعي مثالي' : 'Optimal Factory Health'}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. RECHARTS HISTORICAL TREND CHART */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 w-full h-[360px] sm:h-[400px] mt-2 bg-slate-950/40 rounded-xl p-3 border border-white/5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={trendData}
            margin={{ top: 20, right: 30, left: 15, bottom: 20 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length) {
                setSelectedShiftId(state.activePayload[0].payload.id);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

            <XAxis
              dataKey={isRTL ? 'labelAr' : 'labelEn'}
              stroke="#94a3b8"
              tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            />

            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              domain={[0, 22000]}
              label={{
                value: isRTL ? 'الوزن المعالج (KG)' : 'Processed Weight (KG)',
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 10,
                offset: 5,
              }}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              wrapperStyle={{ paddingTop: 10, fontSize: '11px', fontFamily: 'monospace' }}
              formatter={(value) => {
                if (value === 'totalWeightKG') return isRTL ? 'إجمالي الوزن المعالج (KG)' : 'Total Processed (KG)';
                if (value === 'shreddingKG') return isRTL ? 'ناتج الثرم 360 (KG)' : 'Shredding 360 (KG)';
                if (value === 'productionKG') return isRTL ? 'ناتج خطوط الإنتاج 167 (KG)' : 'Production Lines 167 (KG)';
                if (value === 'targetKG') return isRTL ? 'مستهدف الوردية' : 'Shift Target';
                return value;
              }}
            />

            {/* Target Reference Line */}
            {showTargetLine && (
              <ReferenceLine
                y={15000}
                stroke="#06b6d4"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: isRTL ? 'المستهدف: 15,000 KG' : 'Target: 15,000 KG',
                  fill: '#06b6d4',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            )}

            {/* 7-Shift Average Reference Line */}
            {showAverageLine && (
              <ReferenceLine
                y={stats.averageProcessedKG}
                stroke="#64748b"
                strokeDasharray="2 2"
                strokeWidth={1}
                label={{
                  value: isRTL ? `المتوسط: ${(stats.averageProcessedKG / 1000).toFixed(1)}k` : `Avg: ${(stats.averageProcessedKG / 1000).toFixed(1)}k`,
                  fill: '#94a3b8',
                  fontSize: 10,
                  position: 'insideBottomRight',
                }}
              />
            )}

            {/* Render based on view mode */}
            {viewMetric === 'TOTAL' && (
              <Bar
                dataKey="totalWeightKG"
                name="totalWeightKG"
                radius={[6, 6, 0, 0]}
                maxBarSize={55}
                animationDuration={800}
              >
                {trendData.map((entry) => (
                  <Cell
                    key={entry.id}
                    fill={getBarColor(entry)}
                    opacity={selectedShiftId && selectedShiftId !== entry.id ? 0.45 : 0.95}
                    stroke={selectedShiftId === entry.id ? '#ffffff' : 'transparent'}
                    strokeWidth={selectedShiftId === entry.id ? 2 : 0}
                    className="cursor-pointer transition-all hover:opacity-100"
                  />
                ))}
              </Bar>
            )}

            {viewMetric === 'STACKED' && (
              <>
                <Bar
                  dataKey="shreddingKG"
                  name="shreddingKG"
                  stackId="weight"
                  fill="#06b6d4"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={55}
                />
                <Bar
                  dataKey="productionKG"
                  name="productionKG"
                  stackId="weight"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </>
            )}

            {viewMetric === 'EFFICIENCY' && (
              <>
                <Bar
                  dataKey="totalWeightKG"
                  name="totalWeightKG"
                  fill="#1e293b"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
                <Line
                  type="monotone"
                  dataKey={(d) => d.efficiencyRatePct * 200} // Scaled for dual visibility
                  name="efficiencyPct"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: '#059669' }}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Pattern Legend Strip */}
      <div className="relative z-10 mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400 font-bold uppercase">
            {isRTL ? 'دلالات الأنماط البصرية:' : 'Visual Pattern Legend:'}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-300 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_#a855f7]" />
            <span>{isRTL ? 'طفرة إنتاج (Spike > +15%)' : 'Production Surge (Spike)'}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            <span>{isRTL ? 'نمط توقف / صيانة (Downtime)' : 'Stoppage / Downtime Pattern'}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>{isRTL ? 'الوردية الحالية النشطة' : 'Active Current Shift'}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
            <span>{isRTL ? 'إنتاج اعتيادي منتظم' : 'Standard Shift Flow'}</span>
          </span>
        </div>

        <p className="text-[11px] text-slate-400">
          {isRTL ? '💡 انقر فوق أي عمود لمعاينة تفاصيل الوردية' : '💡 Click any bar to inspect shift details below'}
        </p>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 4. SELECTED SHIFT DRILLDOWN & PATTERN DIAGNOSIS PANEL */}
      {/* --------------------------------------------------------------------- */}
      {activeSelectedShift && (
        <div className="relative z-10 mt-4 p-4 rounded-xl bg-gradient-to-r from-slate-900/90 via-[#13151f] to-slate-900/90 border border-cyan-500/30 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  activeSelectedShift.patternType === 'SPIKE'
                    ? 'bg-purple-950/80 text-purple-300 border-purple-500/50'
                    : activeSelectedShift.patternType === 'DOWNTIME'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                }`}
              >
                {activeSelectedShift.patternType === 'SPIKE' ? (
                  <Zap className="w-5 h-5 text-purple-400" />
                ) : activeSelectedShift.patternType === 'DOWNTIME' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white">
                    SHIFT #{activeSelectedShift.shiftIndex} OF 7
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {activeSelectedShift.date} ({activeSelectedShift.timeRange})
                  </span>
                  <span className="text-xs text-cyan-300 font-bold">
                    {isRTL ? activeSelectedShift.shiftNameAr : activeSelectedShift.shiftNameEn}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {isRTL ? activeSelectedShift.patternTitleAr : activeSelectedShift.patternTitleEn}
                </h3>
              </div>
            </div>

            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-2xl font-black text-white">
                {activeSelectedShift.totalWeightKG.toLocaleString()}
              </span>
              <span className="text-xs text-cyan-400 font-bold uppercase">KG</span>
              <span className="text-xs text-slate-400">({activeSelectedShift.totalWeightTons} Tons)</span>
            </div>
          </div>

          {/* Detailed Diagnosis & Root Cause */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Root Cause Note */}
            <div className="md:col-span-2 p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                {isRTL ? 'السبب التشغيلي ونمط الأداء:' : 'Operational Pattern Root Cause:'}
              </span>
              <p className="text-slate-200 leading-relaxed">
                {isRTL ? activeSelectedShift.patternReasonAr : activeSelectedShift.patternReasonEn}
              </p>
              <div className="pt-2 text-[11px] text-slate-400 flex items-center gap-2">
                <span>{isRTL ? 'المشرف المسؤول:' : 'Supervisor in charge:'}</span>
                <strong className="text-white">{activeSelectedShift.supervisor}</strong>
              </div>
            </div>

            {/* Quick Metrics Column */}
            <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isRTL ? 'ناتج الثرم (360):' : 'Shredding 360:'}</span>
                <span className="text-cyan-300 font-bold">{activeSelectedShift.shreddingKG.toLocaleString()} KG</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isRTL ? 'ناتج الإنتاج (167):' : 'Production 167:'}</span>
                <span className="text-emerald-300 font-bold">{activeSelectedShift.productionKG.toLocaleString()} KG</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isRTL ? 'كفاءة OEE:' : 'OEE Efficiency:'}</span>
                <span className="text-white font-bold">{activeSelectedShift.efficiencyRatePct}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">{isRTL ? 'ساعات التوقف:' : 'Downtime Hours:'}</span>
                <span className={activeSelectedShift.downtimeHours > 1 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {activeSelectedShift.downtimeHours} hrs
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
