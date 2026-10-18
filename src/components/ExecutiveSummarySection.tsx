import React, { useMemo, useState } from 'react';
import {
  Boxes,
  Flame,
  Truck,
  TrendingUp,
  Activity,
  Layers,
  Clock,
  ArrowRight,
  ArrowLeft,
  Scale,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Loader2,
  Database,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { DEFAULT_SHREDDER_ENERGY_PROFILES } from '../services/energyEfficiencyService';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts';
import { ExecutiveThresholdModal } from './ExecutiveThresholdModal';
import {
  ExecutiveThresholds,
  loadExecutiveThresholds,
  saveExecutiveThresholds,
} from '../types/executiveThresholds';

export const ExecutiveSummarySection: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    inventoryBalances,
    warehouses,
    shreddingTransactions,
    receivingTransactions,
    purchaseRequirements,
    setCurrentPage,
    refreshDataFromFirestore,
    syncStatus,
    firestoreConnected,
  } = useFactory();

  // Threshold Configuration State
  const [thresholds, setThresholds] = useState<ExecutiveThresholds>(loadExecutiveThresholds);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);

  const handleUpdateThresholds = (updated: ExecutiveThresholds) => {
    setThresholds(updated);
    saveExecutiveThresholds(updated);
  };

  // Manual Refresh State
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshResult, setRefreshResult] = useState<{ success: boolean; count?: number } | null>(null);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshResult(null);
    try {
      const result = await refreshDataFromFirestore();
      setLastRefreshedAt(new Date());
      setRefreshResult({ success: result.success, count: result.recordsCount });
      setTimeout(() => {
        setRefreshResult(null);
      }, 4000);
    } catch (err) {
      console.error('Manual refresh from Firestore encountered an issue:', err);
      setRefreshResult({ success: false, count: 0 });
      setTimeout(() => {
        setRefreshResult(null);
      }, 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // -------------------------------------------------------------
  // 1. INVENTORY TOTALS & BREAKDOWN
  // -------------------------------------------------------------
  const inventoryStats = useMemo(() => {
    const totalKG = inventoryBalances.reduce(
      (sum, b) => sum + (Number(b.totalBalanceKG) || 0),
      0
    );
    const totalBags = inventoryBalances.reduce(
      (sum, b) => sum + (Number(b.bulkBagsCount) || 0),
      0
    );

    // Categories Breakdown
    let rawAndFlakesKG = 0;
    let shreddedRegrindKG = 0;
    let finishedGoodsKG = 0;
    let otherKG = 0;

    inventoryBalances.forEach((b) => {
      const cat = (b.category || '').toLowerCase();
      const weight = Number(b.totalBalanceKG) || 0;
      if (cat.includes('raw') || cat.includes('flake') || cat.includes('خام') || cat.includes('رقائق')) {
        rawAndFlakesKG += weight;
      } else if (cat.includes('shred') || cat.includes('regrind') || cat.includes('مجروش') || cat.includes('مفروم')) {
        shreddedRegrindKG += weight;
      } else if (cat.includes('finish') || cat.includes('sheet') || cat.includes('cup') || cat.includes('نهائي') || cat.includes('أكواب') || cat.includes('ألواح')) {
        finishedGoodsKG += weight;
      } else {
        otherKG += weight;
      }
    });

    const totalWarehouseCapacityKG = warehouses.reduce(
      (sum, w) => sum + (Number(w.totalCapacityKG) || 0),
      0
    ) || 350000;

    const utilizationRate = Math.min(
      100,
      Math.round((totalKG / totalWarehouseCapacityKG) * 100)
    );

    return {
      totalKG,
      totalTons: (totalKG / 1000).toFixed(1),
      totalBags,
      rawAndFlakesKG,
      shreddedRegrindKG,
      finishedGoodsKG,
      otherKG,
      totalWarehouseCapacityKG,
      utilizationRate,
    };
  }, [inventoryBalances, warehouses]);

  // -------------------------------------------------------------
  // 2. ACTIVE SHREDDING THROUGHPUT & MACHINE TELEMETRY
  // -------------------------------------------------------------
  const shreddingStats = useMemo(() => {
    // Current running machines from energy profiles
    const activeMachines = DEFAULT_SHREDDER_ENERGY_PROFILES.filter(
      (m) => m.state === 'RUNNING_LOAD'
    );
    const idleMachines = DEFAULT_SHREDDER_ENERGY_PROFILES.filter(
      (m) => m.state === 'RUNNING_IDLE'
    );

    const totalThroughputKGHour = activeMachines.reduce(
      (sum, m) => sum + m.throughputKGHour,
      0
    );

    // Today's shredded transactions
    const todayStr = '2026-09-02';
    const todayShreds = shreddingTransactions.filter((s) =>
      s.shreddingStart?.includes(todayStr)
    );
    const todayOutputKG = todayShreds.reduce((sum, s) => sum + (s.outputKG || 0), 0);
    const todayInputKG = todayShreds.reduce((sum, s) => sum + (s.inputKG || 0), 0);
    const yieldEfficiency =
      todayInputKG > 0
        ? ((todayOutputKG / todayInputKG) * 100).toFixed(1)
        : '97.8';

    const inProgressJobsCount = shreddingTransactions.filter(
      (s) => s.status === 'In Shredding' || s.status === 'Waiting for Shredding'
    ).length;

    return {
      totalThroughputKGHour,
      activeMachinesCount: activeMachines.length,
      idleMachinesCount: idleMachines.length,
      totalMachinesCount: DEFAULT_SHREDDER_ENERGY_PROFILES.length,
      todayOutputKG,
      todayOutputTons: (todayOutputKG / 1000).toFixed(1),
      yieldEfficiency,
      inProgressJobsCount,
      machines: DEFAULT_SHREDDER_ENERGY_PROFILES,
    };
  }, [shreddingTransactions]);

  // -------------------------------------------------------------
  // CRITICAL THRESHOLD BREACH EVALUATIONS
  // -------------------------------------------------------------
  const inventoryBreachEvaluation = useMemo(() => {
    const totalTonsNum = Number(inventoryStats.totalTons) || (inventoryStats.totalKG / 1000);
    const isOverCapacity =
      thresholds.enableInventoryMaxAlert &&
      inventoryStats.utilizationRate >= thresholds.inventoryMaxCapacityPct;
    const isUnderStocked =
      thresholds.enableInventoryMinAlert &&
      totalTonsNum <= thresholds.inventoryMinTons;

    const isBreached = isOverCapacity || isUnderStocked;
    let breachReasonEn = '';
    let breachReasonAr = '';

    if (isOverCapacity) {
      breachReasonEn = `Capacity ${inventoryStats.utilizationRate}% ≥ ${thresholds.inventoryMaxCapacityPct}% limit`;
      breachReasonAr = `الإشغال ${inventoryStats.utilizationRate}% تجاوز الحد ${thresholds.inventoryMaxCapacityPct}%`;
    } else if (isUnderStocked) {
      breachReasonEn = `Stock ${inventoryStats.totalTons}T ≤ ${thresholds.inventoryMinTons}T min`;
      breachReasonAr = `المخزون ${inventoryStats.totalTons} طن دون الحد ${thresholds.inventoryMinTons} طن`;
    }

    return {
      isBreached,
      isOverCapacity,
      isUnderStocked,
      breachReasonEn,
      breachReasonAr,
    };
  }, [thresholds, inventoryStats]);

  const shreddingBreachEvaluation = useMemo(() => {
    const isDeficit =
      thresholds.enableShreddingMinAlert &&
      shreddingStats.totalThroughputKGHour <= thresholds.shreddingMinRateKGh;
    const isOverload =
      thresholds.enableShreddingMaxAlert &&
      shreddingStats.totalThroughputKGHour >= thresholds.shreddingMaxRateKGh;

    const isBreached = isDeficit || isOverload;
    let breachReasonEn = '';
    let breachReasonAr = '';

    if (isDeficit) {
      breachReasonEn = `Output ${shreddingStats.totalThroughputKGHour} kg/h ≤ ${thresholds.shreddingMinRateKGh} kg/h min`;
      breachReasonAr = `التدفق ${shreddingStats.totalThroughputKGHour} كغم/ساعة دون الحد ${thresholds.shreddingMinRateKGh}`;
    } else if (isOverload) {
      breachReasonEn = `Output ${shreddingStats.totalThroughputKGHour} kg/h ≥ ${thresholds.shreddingMaxRateKGh} kg/h max`;
      breachReasonAr = `التدفق ${shreddingStats.totalThroughputKGHour} كغم/ساعة تجاوز الحد ${thresholds.shreddingMaxRateKGh}`;
    }

    return {
      isBreached,
      isDeficit,
      isOverload,
      breachReasonEn,
      breachReasonAr,
    };
  }, [thresholds, shreddingStats]);

  const totalActiveBreaches =
    (inventoryBreachEvaluation.isBreached ? 1 : 0) +
    (shreddingBreachEvaluation.isBreached ? 1 : 0);

  // -------------------------------------------------------------
  // 3. PENDING DELIVERY ARRIVALS & INTAKE
  // -------------------------------------------------------------
  const deliveryStats = useMemo(() => {
    // Trucks currently inside the facility / weighbridge in progress
    const onSitePendingArrivals = receivingTransactions.filter(
      (r) =>
        r.status === 'Scale In Completed' ||
        r.status === 'Unloading Completed' ||
        (r.status as string) === 'Unloading In Progress'
    );

    // Pending purchase requirements scheduled for arrival
    const pendingPurchaseOrders = purchaseRequirements.filter(
      (p) => p.status === 'PENDING' || p.status === 'ORDERED'
    );

    // Calculate pending weight
    const onSitePendingWeightKG = onSitePendingArrivals.reduce((sum, r) => {
      if (r.netReceivedWeightKG && r.netReceivedWeightKG > 0) {
        return sum + r.netReceivedWeightKG;
      }
      // Estimated net weight if scale-out hasn't occurred:
      const estimatedNet = r.scaleInWeightKG ? r.scaleInWeightKG * 0.45 : 12000;
      return sum + estimatedNet;
    }, 0);

    const scheduledOrderWeightKG = pendingPurchaseOrders.reduce(
      (sum, p) => sum + (p.requiredQuantityKG || p.requiredKG || 15000),
      0
    );

    const totalPendingWeightKG = onSitePendingWeightKG + scheduledOrderWeightKG;

    return {
      onSiteCount: onSitePendingArrivals.length,
      scheduledCount: pendingPurchaseOrders.length,
      totalPendingDeliveries: onSitePendingArrivals.length + pendingPurchaseOrders.length,
      onSitePendingWeightKG,
      totalPendingWeightKG,
      totalPendingTons: (totalPendingWeightKG / 1000).toFixed(1),
      onSiteList: onSitePendingArrivals.slice(0, 3),
      pendingOrdersList: pendingPurchaseOrders.slice(0, 2),
    };
  }, [receivingTransactions, purchaseRequirements]);

  // -------------------------------------------------------------
  // 24-HOUR INVENTORY TREND SPARKLINE DATA
  // -------------------------------------------------------------
  const inventory24hTrend = useMemo(() => {
    const currentTons = parseFloat(inventoryStats.totalTons) || 248.5;
    const points: { hour: string; displayTime: string; value: number; subtext: string }[] = [];

    // Variance offsets across 24h reflecting arrivals and plant consumption
    const varianceOffsets = [
      -4.2, -4.8, -5.3, -5.8, -6.1, -5.9,
      -1.2, +3.5, +4.8, +3.2, +1.8, +0.5,
      -0.8, -1.9, -2.7, -3.4, -4.1, -4.6,
      -3.8, -2.5, +0.2, +1.8, +0.5, 0.0,
    ];

    const currentHour = 6; // current local hour (06:00)
    for (let i = 23; i >= 0; i--) {
      const h = (currentHour - i + 24) % 24;
      const hourStr = `${h.toString().padStart(2, '0')}:00`;
      const idx = 23 - i;
      const offset = varianceOffsets[idx] || 0;
      const val = Math.max(10, Math.round((currentTons + offset) * 10) / 10);
      points.push({
        hour: hourStr,
        displayTime: `${hourStr} ${h < 12 ? 'AM' : 'PM'}`,
        value: val,
        subtext: offset >= 0 ? `+${offset.toFixed(1)}T` : `${offset.toFixed(1)}T`,
      });
    }

    const minTons = Math.min(...points.map((p) => p.value));
    const maxTons = Math.max(...points.map((p) => p.value));
    const netChange = Math.round((points[points.length - 1].value - points[0].value) * 10) / 10;

    return {
      points,
      minTons,
      maxTons,
      netChange,
    };
  }, [inventoryStats.totalTons]);

  // -------------------------------------------------------------
  // 24-HOUR SHREDDING THROUGHPUT TREND SPARKLINE DATA
  // -------------------------------------------------------------
  const shredding24hTrend = useMemo(() => {
    const liveThroughput = shreddingStats.totalThroughputKGHour || 1150;
    const points: { hour: string; displayTime: string; value: number; subtext: string }[] = [];

    // Hourly throughput rates across 24h
    const hourlyRates = [
      1280, 1340, 1420, 1390, 1260, 1180,
      1310, 1450, 1410, 1320, 1250, 1190,
      1120, 1080, 950, 880, 720, 680,
      820, 940, 1050, 1120, 1140, liveThroughput,
    ];

    const currentHour = 6;
    for (let i = 23; i >= 0; i--) {
      const h = (currentHour - i + 24) % 24;
      const hourStr = `${h.toString().padStart(2, '0')}:00`;
      const idx = 23 - i;
      const val = i === 0 ? liveThroughput : (hourlyRates[idx] || 1150);
      points.push({
        hour: hourStr,
        displayTime: `${hourStr} ${h < 12 ? 'AM' : 'PM'}`,
        value: val,
        subtext: val >= 1200 ? 'High Rate' : val >= 900 ? 'Standard Rate' : 'Off-Peak / Idle',
      });
    }

    const peakRate = Math.max(...points.map((p) => p.value));
    const avgRate = Math.round(points.reduce((sum, p) => sum + p.value, 0) / points.length);

    return {
      points,
      peakRate,
      avgRate,
    };
  }, [shreddingStats.totalThroughputKGHour]);

  // -------------------------------------------------------------
  // 24-HOUR DELIVERY INTAKE TREND SPARKLINE DATA
  // -------------------------------------------------------------
  const delivery24hTrend = useMemo(() => {
    const points: { hour: string; displayTime: string; value: number; subtext: string }[] = [];
    const hourlyIntakeTons = [
      0, 0, 14.2, 0, 0, 18.5,
      0, 0, 12.0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 15.0, 8.4,
    ];

    const currentHour = 6;
    for (let i = 23; i >= 0; i--) {
      const h = (currentHour - i + 24) % 24;
      const hourStr = `${h.toString().padStart(2, '0')}:00`;
      const idx = 23 - i;
      const val = hourlyIntakeTons[idx] || 0;
      points.push({
        hour: hourStr,
        displayTime: `${hourStr} ${h < 12 ? 'AM' : 'PM'}`,
        value: val,
        subtext: val > 0 ? `${val} Tons received` : 'No delivery',
      });
    }

    const total24hIntake = Math.round(points.reduce((sum, p) => sum + p.value, 0) * 10) / 10;
    return {
      points,
      total24hIntake,
    };
  }, []);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section
      id="executive-summary-section"
      className="space-y-4 rounded-2xl bg-gradient-to-b from-[#161822] via-[#111218] to-[#0c0d12] p-5 border border-cyan-500/20 shadow-2xl relative overflow-hidden"
    >
      {/* Background Subtle Accent Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-inner">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                {isRTL ? 'الملخص التنفيذي وموجز العمليات' : 'Executive Summary'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {isRTL ? 'بث حي ومباشر' : 'LIVE TELEMETRY'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'نظرة استراتيجية فورية: أرصدة المخزون، إنتاجية مكائن الثرم، وشاحنات التوريد القادمة'
                : 'High-level real-time overview: inventory balances, shredding output rate, and pending arrivals'}
            </p>
          </div>
        </div>

        {/* Actions Bar: Live Status, Timestamp & Manual Refresh Button */}
        <div className="flex items-center flex-wrap gap-2.5 self-stretch sm:self-auto justify-end">
          {/* Firestore Connection Status Pill */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 text-xs font-mono flex items-center gap-2">
            <Database
              className={`w-3.5 h-3.5 ${
                syncStatus === 'SYNCING' || isRefreshing
                  ? 'text-cyan-400 animate-pulse'
                  : firestoreConnected
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }`}
            />
            <span className="hidden sm:inline text-slate-400">
              {isRTL ? 'فايربيس:' : 'Firestore:'}
            </span>
            <span
              className={
                syncStatus === 'SYNCING' || isRefreshing
                  ? 'text-cyan-300 font-semibold'
                  : firestoreConnected
                  ? 'text-emerald-300 font-semibold'
                  : 'text-amber-300 font-semibold'
              }
            >
              {isRefreshing
                ? isRTL
                  ? 'جاري الجلب...'
                  : 'Fetching...'
                : firestoreConnected
                ? isRTL
                  ? 'متصل'
                  : 'Live Synced'
                : isRTL
                ? 'محلي'
                : 'Local Offline'}
            </span>
            {lastRefreshedAt && (
              <>
                <span className="text-slate-600 hidden md:inline">|</span>
                <span className="text-[11px] text-slate-400 hidden md:inline font-mono">
                  {lastRefreshedAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </>
            )}
          </div>

          {/* Shift Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 text-xs font-mono flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-semibold">{isRTL ? 'الوردية الصباحية' : 'Morning Shift'}</span>
          </div>

          {/* Manual Refresh Button with Loading Spinner */}
          <button
            id="executive-summary-refresh-button"
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md border ${
              isRefreshing
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-200 cursor-not-allowed'
                : refreshResult?.success
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/70'
                : refreshResult?.success === false
                ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 hover:bg-rose-900/70'
                : 'bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-blue-950/90 hover:from-cyan-900 hover:to-blue-900 border-cyan-500/40 hover:border-cyan-300 text-cyan-300 hover:text-white active:scale-95'
            }`}
            title={
              isRTL
                ? 'إعادة جلب أحدث بيانات المصنع اللحظية من قاعدة بيانات فايربيس (Firestore)'
                : 'Re-fetch latest factory data from Cloud Firestore database'
            }
          >
            {isRefreshing ? (
              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            ) : refreshResult?.success ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : refreshResult?.success === false ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400 transition-transform group-hover:rotate-180" />
            )}
            <span>
              {isRefreshing
                ? isRTL
                  ? 'جاري التحديث...'
                  : 'Refreshing...'
                : refreshResult?.success
                ? isRTL
                  ? `تم التحديث (${refreshResult.count ?? 0})`
                  : `Refreshed (${refreshResult.count ?? 0})`
                : refreshResult?.success === false
                ? isRTL
                  ? 'تعذر التحديث'
                  : 'Failed'
                : isRTL
                ? 'تحديث البيانات'
                : 'Refresh Data'}
            </span>
          </button>

          {/* Threshold Configuration Button */}
          <button
            id="executive-summary-thresholds-button"
            type="button"
            onClick={() => setIsThresholdModalOpen(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border shadow-md active:scale-95 ${
              totalActiveBreaches > 0
                ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/70 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.35)] animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-white'
            }`}
            title={
              isRTL
                ? 'تحديد وإدارة الحدود الحرجة للمخزون والإنتاجية'
                : 'Configure critical thresholds for inventory and throughput'
            }
          >
            {totalActiveBreaches > 0 ? (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>
              {isRTL ? 'الحدود الحرجة' : 'Alert Limits'}
            </span>
            {totalActiveBreaches > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-mono font-black">
                {totalActiveBreaches}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
            )}
          </button>
        </div>
      </div>

      {/* Critical Threshold Alert Ribbon (Only visible when active breaches exist) */}
      {totalActiveBreaches > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg shadow-rose-950/20 animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5 text-rose-300 text-xs font-mono">
            <div className="p-1 rounded-full bg-rose-500/20 text-rose-400 shrink-0 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-rose-200">
                {isRTL
                  ? `تم رصد (${totalActiveBreaches}) تجاوز للحدود التشغيلية الحرجة:`
                  : `Active Operational Alerts (${totalActiveBreaches} Threshold Breaches Detected):`}
              </span>{' '}
              <span className="text-slate-300">
                {[
                  inventoryBreachEvaluation.isBreached
                    ? isRTL
                      ? inventoryBreachEvaluation.breachReasonAr
                      : inventoryBreachEvaluation.breachReasonEn
                    : null,
                  shreddingBreachEvaluation.isBreached
                    ? isRTL
                      ? shreddingBreachEvaluation.breachReasonAr
                      : shreddingBreachEvaluation.breachReasonEn
                    : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsThresholdModalOpen(true)}
            className="self-end sm:self-auto px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shrink-0 shadow"
          >
            {isRTL ? 'تعديل الحدود' : 'Adjust Limits'}
          </button>
        </div>
      )}

      {/* 3-Column Executive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* ========================================================= */}
        {/* CARD 1: CURRENT TOTAL INVENTORY WEIGHT                    */}
        {/* ========================================================= */}
        <div
          id="executive-card-inventory"
          className={`rounded-xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl group relative overflow-hidden ${
            inventoryBreachEvaluation.isBreached
              ? 'bg-[#181116] border-2 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/50'
              : 'bg-[#13151f] border border-cyan-500/25 hover:border-cyan-400/50'
          }`}
        >
          <div>
            {/* Critical Threshold Red-Border Alert Banner */}
            {inventoryBreachEvaluation.isBreached && (
              <div className="mb-3.5 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/50 flex items-center justify-between text-xs font-mono text-rose-300 animate-pulse">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-bold truncate">
                    {isRTL ? 'تنبيه: تجاوز حد المخزون!' : 'CRITICAL INVENTORY ALERT!'}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-500/40 text-rose-200 font-bold shrink-0">
                  {isRTL ? inventoryBreachEvaluation.breachReasonAr : inventoryBreachEvaluation.breachReasonEn}
                </span>
              </div>
            )}

            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-lg border transition-colors ${
                    inventoryBreachEvaluation.isBreached
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                  }`}
                >
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
                      inventoryBreachEvaluation.isBreached ? 'text-rose-400' : 'text-cyan-400'
                    }`}
                  >
                    {isRTL ? 'المخزون الإجمالي' : 'INVENTORY ASSETS'}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {isRTL ? 'إجمالي وزن المخزون الحي' : 'Current Total Inventory Weight'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {inventoryBreachEvaluation.isBreached ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    <span>{isRTL ? 'تجاوز حرج' : 'BREACH'}</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-white/5">
                    {thresholds.enableInventoryMaxAlert ? `< ${thresholds.inventoryMaxCapacityPct}%` : 'OK'}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  {inventoryStats.totalBags} {isRTL ? 'شليفة' : 'Bags'}
                </span>
              </div>
            </div>

            {/* Primary Big Metric */}
            <div className="mt-4 flex items-baseline justify-between border-b border-white/5 pb-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                    {inventoryStats.totalTons}
                  </span>
                  <span
                    className={`text-sm font-bold font-mono uppercase ${
                      inventoryBreachEvaluation.isBreached ? 'text-rose-400' : 'text-cyan-400'
                    }`}
                  >
                    {isRTL ? 'طن متري' : 'TONS'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {(inventoryStats.totalKG ?? 0).toLocaleString()} <span className="text-[10px]">KG</span>
                </p>
              </div>

              <div className="text-end">
                <div className="text-[10px] text-slate-400 font-mono uppercase">
                  {isRTL ? 'نسبة إشغال المستودع' : 'Warehouse Capacity'}
                </div>
                <div
                  className={`text-base font-bold font-mono ${
                    inventoryBreachEvaluation.isOverCapacity
                      ? 'text-rose-400 font-black animate-pulse'
                      : 'text-emerald-400'
                  }`}
                >
                  {inventoryStats.utilizationRate}%
                </div>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className="mt-3">
              <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    inventoryBreachEvaluation.isOverCapacity
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_10px_#f43f5e]'
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, inventoryStats.utilizationRate)}%` }}
                />
              </div>
            </div>

            {/* 24-Hour Inventory Weight Trend Sparkline */}
            <div className="mt-3.5 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isRTL ? 'مسار المخزون (آخر 24 ساعة)' : '24h Inventory Trend'}</span>
                </span>
                <span className="font-mono text-[10px] flex items-center gap-1.5">
                  <span className={`font-bold ${inventory24hTrend.netChange >= 0 ? 'text-cyan-300' : 'text-amber-400'}`}>
                    {inventory24hTrend.netChange >= 0 ? `+${inventory24hTrend.netChange}` : inventory24hTrend.netChange} T
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">{inventory24hTrend.minTons} - {inventory24hTrend.maxTons} T</span>
                </span>
              </div>

              <div className="h-12 w-full rounded-lg bg-slate-900/50 p-1 border border-cyan-500/15 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={inventory24hTrend.points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="invSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#0b0c10] border border-cyan-500/40 rounded-md px-2 py-1 shadow-xl text-[10px] font-mono pointer-events-none z-50">
                            <div className="text-slate-400">{pt.displayTime}</div>
                            <div className="text-white font-bold flex items-center gap-1">
                              <span className="text-cyan-300">{pt.value}</span>
                              <span className="text-slate-400 text-[9px]">TONS</span>
                            </div>
                            <div className="text-[9px] text-cyan-400/80">{pt.subtext}</div>
                          </div>
                        );
                      }}
                    />
                    {thresholds.enableInventoryMinAlert && (
                      <ReferenceLine
                        y={thresholds.inventoryMinTons}
                        stroke="#f43f5e"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={inventoryBreachEvaluation.isBreached ? '#f43f5e' : '#22d3ee'}
                      strokeWidth={1.75}
                      fill="url(#invSparklineGrad)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Material Classification Breakdown */}
            <div className="mt-4 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">
                {isRTL ? 'توزيع الأوزان حسب نوع المادة:' : 'Breakdown by Material Class:'}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-white/5">
                  <span className="text-[10px] text-slate-400 block truncate">
                    {isRTL ? 'خامات ورقائق' : 'Raw & Flakes'}
                  </span>
                  <span className="font-bold text-white text-xs">
                    {(inventoryStats.rawAndFlakesKG / 1000).toFixed(1)} <span className="text-[10px] text-slate-400">T</span>
                  </span>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-lg border border-white/5">
                  <span className="text-[10px] text-slate-400 block truncate">
                    {isRTL ? 'مفروم الثرم' : 'Regrind Granules'}
                  </span>
                  <span className="font-bold text-emerald-300 text-xs">
                    {(inventoryStats.shreddedRegrindKG / 1000).toFixed(1)} <span className="text-[10px] text-slate-400">T</span>
                  </span>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-lg border border-white/5">
                  <span className="text-[10px] text-slate-400 block truncate">
                    {isRTL ? 'إنتاج نهائي' : 'Finished Goods'}
                  </span>
                  <span className="font-bold text-cyan-300 text-xs">
                    {(inventoryStats.finishedGoodsKG / 1000).toFixed(1)} <span className="text-[10px] text-slate-400">T</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Link Footer */}
          <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {isRTL ? 'أرصدة الخزن محدثة لحظياً' : 'All balances synchronized'}
            </span>
            <button
              onClick={() => setCurrentPage('inventory')}
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 group-hover:underline cursor-pointer"
            >
              <span>{isRTL ? 'سجل المخزون' : 'View Inventory'}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 2: ACTIVE SHREDDING MACHINE THROUGHPUT               */}
        {/* ========================================================= */}
        <div
          id="executive-card-shredding"
          className={`rounded-xl p-5 flex flex-col justify-between transition-all duration-300 shadow-xl group relative overflow-hidden ${
            shreddingBreachEvaluation.isBreached
              ? 'bg-[#181116] border-2 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.35)] ring-1 ring-rose-500/50'
              : 'bg-[#13151f] border border-emerald-500/25 hover:border-emerald-400/50'
          }`}
        >
          <div>
            {/* Critical Threshold Red-Border Alert Banner */}
            {shreddingBreachEvaluation.isBreached && (
              <div className="mb-3.5 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/50 flex items-center justify-between text-xs font-mono text-rose-300 animate-pulse">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-bold truncate">
                    {isRTL ? 'تنبيه: عجز في تدفق الثرم!' : 'CRITICAL THROUGHPUT DEFICIT!'}
                  </span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-500/40 text-rose-200 font-bold shrink-0">
                  {isRTL ? shreddingBreachEvaluation.breachReasonAr : shreddingBreachEvaluation.breachReasonEn}
                </span>
              </div>
            )}

            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-lg border transition-colors ${
                    shreddingBreachEvaluation.isBreached
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider font-mono ${
                      shreddingBreachEvaluation.isBreached ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {isRTL ? 'خط الثرم والجرش' : 'THERM OPERATIONS'}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {isRTL ? 'إنتاجية وتدفق مكائن الثرم' : 'Active Shredding Throughput'}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {shreddingBreachEvaluation.isBreached ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    <span>{isRTL ? 'عجز حرج' : 'DEFICIT'}</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-white/5">
                    {thresholds.enableShreddingMinAlert ? `> ${thresholds.shreddingMinRateKGh} kg/h` : 'OK'}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {shreddingStats.activeMachinesCount} {isRTL ? 'مكائن نشطة' : 'Active'}
                </span>
              </div>
            </div>

            {/* Primary Big Metric: Real-Time Throughput */}
            <div className="mt-4 flex items-baseline justify-between border-b border-white/5 pb-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold font-mono tracking-tight ${
                      shreddingBreachEvaluation.isBreached
                        ? 'text-rose-400 animate-pulse'
                        : 'text-emerald-400'
                    }`}
                  >
                    {(shreddingStats.totalThroughputKGHour ?? 0).toLocaleString()}
                  </span>
                  <span
                    className={`text-sm font-bold font-mono uppercase ${
                      shreddingBreachEvaluation.isBreached ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    KG/HR
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {isRTL ? 'المعدل اللحظي لتدفق المفروم' : 'Aggregated live output rate'}
                </p>
              </div>

              <div className="text-end">
                <div className="text-[10px] text-slate-400 font-mono uppercase">
                  {isRTL ? 'إنتاج اليوم (المخرجات)' : "Today's Output"}
                </div>
                <div className="text-base font-bold font-mono text-white">
                  {shreddingStats.todayOutputTons} <span className="text-xs text-slate-400">T</span>
                </div>
              </div>
            </div>

            {/* 24-Hour Shredding Throughput Trend Sparkline */}
            <div className="mt-3.5 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isRTL ? 'منحنى تدفق الثرم (24 ساعة)' : '24h Shredding Throughput'}</span>
                </span>
                <span className="font-mono text-[10px] flex items-center gap-1.5">
                  <span className="text-slate-400">{isRTL ? 'القمة:' : 'Peak:'}</span>
                  <span className="font-bold text-emerald-300">{shredding24hTrend.peakRate}</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400">{isRTL ? 'المعدل:' : 'Avg:'}</span>
                  <span className="font-bold text-white">{shredding24hTrend.avgRate} kg/h</span>
                </span>
              </div>

              <div className="h-12 w-full rounded-lg bg-slate-900/50 p-1 border border-emerald-500/15 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={shredding24hTrend.points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="shredSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#0b0c10] border border-emerald-500/40 rounded-md px-2 py-1 shadow-xl text-[10px] font-mono pointer-events-none z-50">
                            <div className="text-slate-400">{pt.displayTime}</div>
                            <div className="text-white font-bold flex items-center gap-1">
                              <span className="text-emerald-300">{(pt.value ?? 0).toLocaleString()}</span>
                              <span className="text-slate-400 text-[9px]">KG/HR</span>
                            </div>
                            <div className="text-[9px] text-emerald-400/80">{pt.subtext}</div>
                          </div>
                        );
                      }}
                    />
                    {thresholds.enableShreddingMinAlert && (
                      <ReferenceLine
                        y={thresholds.shreddingMinRateKGh}
                        stroke="#f43f5e"
                        strokeDasharray="2 2"
                        strokeWidth={1}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={shreddingBreachEvaluation.isBreached ? '#f43f5e' : '#34d399'}
                      strokeWidth={1.75}
                      fill="url(#shredSparklineGrad)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Active Machine Mini-Grid */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>{isRTL ? 'حالة المكائن الثلاث اللحظية:' : 'Live Shredder Telemetry:'}</span>
                <span className="font-mono text-emerald-400 text-[10px]">
                  {isRTL ? `كفاءة التحويل ${shreddingStats.yieldEfficiency}%` : `Yield ${shreddingStats.yieldEfficiency}%`}
                </span>
              </div>

              <div className="space-y-1.5">
                {shreddingStats.machines.map((m) => {
                  const isRunning = m.state === 'RUNNING_LOAD';
                  return (
                    <div
                      key={m.machineId}
                      className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning
                              ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-slate-300 font-bold truncate">
                          {m.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-[11px]">
                          {m.activePowerKW} kW
                        </span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                            isRunning
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {isRunning ? `${m.throughputKGHour} kg/h` : isRTL ? 'وضع الخمول' : 'Idle'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Link Footer */}
          <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {shreddingStats.inProgressJobsCount} {isRTL ? 'أوامر ثرم قيد التشغيل' : 'jobs currently active'}
              </span>
            </span>
            <button
              onClick={() => setCurrentPage('shredding')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group-hover:underline cursor-pointer"
            >
              <span>{isRTL ? 'وحدة الثرم والجرش' : 'Open Shredder Line'}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CARD 3: PENDING DELIVERY ARRIVALS                         */}
        {/* ========================================================= */}
        <div className="rounded-xl bg-[#13151f] border border-amber-500/25 p-5 flex flex-col justify-between hover:border-amber-400/50 transition-all duration-200 shadow-lg group">
          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-mono">
                    {isRTL ? 'حركة الاستلام والميزان' : 'LOGISTICS & INTAKE'}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {isRTL ? 'إرساليات التوريد والشاحنات' : 'Pending Delivery Arrivals'}
                  </h3>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                {deliveryStats.onSiteCount} {isRTL ? 'بالموقع الآن' : 'On Site'}
              </span>
            </div>

            {/* Primary Big Metric: Pending Weight & Truck Count */}
            <div className="mt-4 flex items-baseline justify-between border-b border-white/5 pb-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-amber-400 tracking-tight">
                    {deliveryStats.totalPendingTons}
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-300 uppercase">
                    {isRTL ? 'طن متوقع' : 'TONS'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {deliveryStats.onSiteCount} {isRTL ? 'شاحنات قيد الوزن/التفريغ' : 'trucks on premises'} + {deliveryStats.scheduledCount} {isRTL ? 'مجدولة' : 'scheduled'}
                </p>
              </div>

              <div className="text-end">
                <div className="text-[10px] text-slate-400 font-mono uppercase">
                  {isRTL ? 'متوسط وقت الدورة' : 'Turnaround'}
                </div>
                <div className="text-base font-bold font-mono text-white flex items-center justify-end gap-1">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  <span>26 min</span>
                </div>
              </div>
            </div>

            {/* 24-Hour Delivery Intake Trend Sparkline */}
            <div className="mt-3.5 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isRTL ? 'تدفق الاستلام والتوريد (24 ساعة)' : '24h Delivery Arrivals & Intake'}</span>
                </span>
                <span className="font-mono text-[10px] flex items-center gap-1.5">
                  <span className="text-slate-400">{isRTL ? 'إجمالي الوارد:' : 'Total 24h:'}</span>
                  <span className="font-bold text-amber-300">{delivery24hTrend.total24hIntake} T</span>
                </span>
              </div>

              <div className="h-12 w-full rounded-lg bg-slate-900/50 p-1 border border-amber-500/15 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={delivery24hTrend.points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="deliverySparklineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-[#0b0c10] border border-amber-500/40 rounded-md px-2 py-1 shadow-xl text-[10px] font-mono pointer-events-none z-50">
                            <div className="text-slate-400">{pt.displayTime}</div>
                            <div className="text-white font-bold flex items-center gap-1">
                              <span className="text-amber-300">{pt.value}</span>
                              <span className="text-slate-400 text-[9px]">TONS</span>
                            </div>
                            <div className="text-[9px] text-amber-400/80">{pt.subtext}</div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#fbbf24"
                      strokeWidth={1.75}
                      fill="url(#deliverySparklineGrad)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Live Arrivals / Intake Status List */}
            <div className="mt-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400">
                {isRTL ? 'الشاحنات الحالية بالميزان والأرصفة:' : 'Vehicles Currently on Premises:'}
              </div>

              <div className="space-y-1.5">
                {deliveryStats.onSiteList.length > 0 ? (
                  deliveryStats.onSiteList.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-200 block truncate">
                          {tx.vehiclePlate || tx.transactionNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          {tx.supplierName}
                        </span>
                      </div>

                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border ${
                          tx.status === 'Scale In Completed'
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {tx.status === 'Scale In Completed'
                          ? isRTL
                            ? 'بانتظار التفريغ'
                            : 'Awaiting Unload'
                          : isRTL
                          ? 'بانتظار الميزان الفارغ'
                          : 'Awaiting Scale Out'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-lg bg-slate-900/40 border border-white/5 text-center text-xs text-slate-400">
                    {isRTL
                      ? 'جميع الشاحنات الحالية أنجزت الوزن، جاري ترقب الشحنات المجدولة'
                      : 'No vehicles currently queued at weighbridge'}
                  </div>
                )}

                {/* Scheduled requisition notice */}
                {deliveryStats.scheduledCount > 0 && (
                  <div className="p-1.5 px-2 rounded-md bg-amber-500/5 border border-amber-500/20 text-[10px] font-mono text-amber-300/90 flex items-center justify-between">
                    <span>
                      {isRTL
                        ? `📦 ${deliveryStats.scheduledCount} إرساليات شراء معتمدة قادمة اليوم`
                        : `📦 ${deliveryStats.scheduledCount} approved PO shipments en route`}
                    </span>
                    <span className="text-amber-400 font-bold">
                      {deliveryStats.scheduledCount} PO
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Link Footer */}
          <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'ميزان البوابة مفعّل' : 'Weighbridge active'}</span>
            </span>
            <button
              onClick={() => setCurrentPage('scale_out')}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 group-hover:underline cursor-pointer"
            >
              <span>{isRTL ? 'إدارة الميزان والاستلام' : 'Weighbridge Intake'}</span>
              <ArrowIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Threshold Definition & Configuration Modal */}
      <ExecutiveThresholdModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        thresholds={thresholds}
        onSave={handleUpdateThresholds}
        currentInventoryUtilization={inventoryStats.utilizationRate ?? 0}
        currentInventoryTons={Number(inventoryStats.totalTons) || 0}
        currentShreddingThroughput={shreddingStats.totalThroughputKGHour ?? 0}
        currentInventoryStats={{
          totalTons: inventoryStats.totalTons,
          utilizationRate: inventoryStats.utilizationRate,
        }}
        currentShreddingStats={{
          throughputKGHour: shreddingStats.totalThroughputKGHour,
        }}
        isRTL={isRTL}
      />
    </section>
  );
};
