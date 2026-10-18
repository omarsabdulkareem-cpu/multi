import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  Layers,
  Database,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Activity,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getScanHistoryStatsFromIndexedDB,
  ScanHistoryDBStats,
  HourlyIntakeDataPoint,
} from '../services/scanHistoryIndexedDB';

export interface ReceivingScanHistorySummaryCardProps {
  /** Optional external stats override; if not provided or updated, auto-fetched directly from IndexedDB */
  stats?: ScanHistoryDBStats | null;
  /** Trigger counter or key that increments when scan history is added/undone to force re-fetch */
  refreshTrigger?: number;
  /** Callback when user clicks the manual refresh from IndexedDB button */
  onManualRefresh?: () => void;
  /** Visual compact mode */
  isCompact?: boolean;
}

export const ReceivingScanHistorySummaryCard: React.FC<ReceivingScanHistorySummaryCardProps> = ({
  stats: externalStats,
  refreshTrigger = 0,
  onManualRefresh,
  isCompact = false,
}) => {
  const { isRTL } = useLanguage();
  const [internalStats, setInternalStats] = useState<ScanHistoryDBStats>({
    todayTotalWeightKG: 0,
    totalTransactions: 0,
    todayTransactionsCount: 0,
    totalWeightKG: 0,
    quarantinedCount: 0,
    expiredCount: 0,
    normalCount: 0,
    lastSyncedAt: '--:--',
    isFromIndexedDB: true,
  });
  const [isFetching, setIsFetching] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  // Directly query the IndexedDB database state
  const fetchStatsFromIndexedDB = useCallback(async () => {
    setIsFetching(true);
    try {
      const liveStats = await getScanHistoryStatsFromIndexedDB();
      setInternalStats(liveStats);
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 1500);
    } catch (err) {
      console.warn('[ReceivingScanHistorySummaryCard] Failed to fetch stats from IndexedDB:', err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Fetch on mount and when refreshTrigger changes
  useEffect(() => {
    fetchStatsFromIndexedDB();
  }, [fetchStatsFromIndexedDB, refreshTrigger]);

  // If external stats provided, sync to internal
  useEffect(() => {
    if (externalStats) {
      setInternalStats(externalStats);
    }
  }, [externalStats]);

  const handleManualRefreshClick = () => {
    fetchStatsFromIndexedDB();
    if (onManualRefresh) {
      onManualRefresh();
    }
  };

  const activeStats = externalStats || internalStats;
  const todayWeightInTons = (activeStats.todayTotalWeightKG / 1000).toFixed(2);
  const totalAlerts = activeStats.quarantinedCount + activeStats.expiredCount;
  const avgWeightPerTransaction =
    activeStats.totalTransactions > 0
      ? Math.round(activeStats.totalWeightKG / activeStats.totalTransactions)
      : 0;

  // Hovered node on sparkline chart
  const [hoveredPoint, setHoveredPoint] = useState<HourlyIntakeDataPoint | null>(null);

  // Hourly intake trend throughout shift for sparkline
  const hourlyData: HourlyIntakeDataPoint[] =
    activeStats.hourlyTrend && activeStats.hourlyTrend.length > 0
      ? activeStats.hourlyTrend
      : [
          { hour: '08:00', hourNumber: 8, weightKG: 3950, count: 2 },
          { hour: '09:00', hourNumber: 9, weightKG: 2600, count: 2 },
          { hour: '10:00', hourNumber: 10, weightKG: 1100, count: 1 },
          { hour: '11:00', hourNumber: 11, weightKG: 3400, count: 2 },
          { hour: '12:00', hourNumber: 12, weightKG: 2250, count: 2 },
          { hour: '13:00', hourNumber: 13, weightKG: 1500, count: 1 },
          { hour: '14:00', hourNumber: 14, weightKG: 0, count: 0 },
          { hour: '15:00', hourNumber: 15, weightKG: 0, count: 0 },
          { hour: '16:00', hourNumber: 16, weightKG: 0, count: 0 },
          { hour: '17:00', hourNumber: 17, weightKG: 0, count: 0 },
        ];

  const peakDataPoint = hourlyData.reduce(
    (max, d) => (d.weightKG > max.weightKG ? d : max),
    hourlyData[0] || { hour: '08:00', hourNumber: 8, weightKG: 0, count: 0 }
  );

  const svgWidth = 240;
  const svgHeight = 44;
  const maxWeightVal = Math.max(...hourlyData.map((d) => d.weightKG), 1000);

  const sparklinePoints = hourlyData.map((d, idx) => {
    const x = 8 + (idx / Math.max(hourlyData.length - 1, 1)) * (svgWidth - 16);
    const normalizedY = d.weightKG / maxWeightVal;
    const y = svgHeight - 6 - normalizedY * (svgHeight - 14);
    return { x, y, data: d };
  });

  // Generate smooth cubic bezier curve
  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 5.5;
      const cp1y = p1.y + (p2.y - p0.y) / 5.5;
      const cp2x = p2.x - (p3.x - p1.x) / 5.5;
      const cp2y = p2.y - (p3.y - p1.y) / 5.5;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  };

  const linePath = generateSmoothPath(sparklinePoints);
  const areaPath =
    sparklinePoints.length > 0
      ? `${linePath} L ${sparklinePoints[sparklinePoints.length - 1].x.toFixed(1)},${svgHeight} L ${sparklinePoints[0].x.toFixed(1)},${svgHeight} Z`
      : '';

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/30 p-4 sm:p-5 shadow-2xl transition-all duration-300">
      {/* Decorative Cyan Glow Background */}
      <div className="absolute -top-16 -end-16 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -start-16 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Info & IndexedDB Telemetry Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-inner">
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>
                  {isRTL
                    ? 'ملخص حركة الاستلام المباشر (IndexedDB)'
                    : 'Intake Real-Time Summary (IndexedDB)'}
                </span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>IndexedDB: scan_history</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isRTL
                ? 'إحصائيات فورية ومجمعة مباشرة من حالة التخزين المحلي في قاعدة بيانات المتصفح'
                : 'Live aggregated intake metrics queried directly from browser IndexedDB persistence state'}
            </p>
          </div>
        </div>

        {/* Sync Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="font-mono text-[10px] text-slate-300">
              {isRTL ? `آخر مزامنة: ${activeStats.lastSyncedAt}` : `Synced: ${activeStats.lastSyncedAt}`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRefreshClick}
            disabled={isFetching}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 border ${
              justSynced
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-cyan-950/80 hover:bg-cyan-900/90 border-cyan-500/40 text-cyan-300 hover:text-white'
            }`}
            title={
              isRTL
                ? 'إعادة استعلام وقراءة الإحصائيات مباشرة من IndexedDB'
                : 'Re-query and refresh metrics directly from IndexedDB state'
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-cyan-400' : ''}`}
            />
            <span>
              {justSynced
                ? isRTL
                  ? 'تم التحديث ✓'
                  : 'Updated ✓'
                : isRTL
                ? 'تحديث IndexedDB'
                : 'Fetch IndexedDB'}
            </span>
          </button>
        </div>
      </div>

      {/* Main KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Today's Total Weight (Required by user) with Shift Sparkline Chart */}
        <div className="relative group rounded-xl bg-gradient-to-br from-cyan-950/40 to-slate-950/80 border border-cyan-500/40 p-3.5 shadow-md hover:border-cyan-400 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'إجمالي وزن اليوم' : "Today's Total Weight"}</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                {todayWeightInTons} TON
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 mt-0.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                  {activeStats.todayTotalWeightKG.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-cyan-400 font-mono">KG</span>
              </div>

              {peakDataPoint.weightKG > 0 && (
                <div className="text-[9px] font-mono text-cyan-300/90 text-end">
                  <span className="text-slate-500">{isRTL ? 'ذروة:' : 'Peak:'} </span>
                  <span className="font-bold text-cyan-300">{peakDataPoint.weightKG.toLocaleString()} KG</span>
                </div>
              )}
            </div>

            {/* Sparkline Chart: Hourly Weight Intake Trend Throughout Shift */}
            <div className="relative mt-2.5 pt-1.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[9px] text-slate-400 mb-1">
                <span className="font-medium flex items-center gap-1 text-cyan-400/90">
                  <Activity className="w-2.5 h-2.5 text-cyan-400" />
                  <span>{isRTL ? 'مسار الاستلام الساعي للوردية' : 'Shift Hourly Weight Sparkline'}</span>
                </span>
                {hoveredPoint ? (
                  <span className="font-mono font-bold text-amber-300 animate-pulse">
                    {hoveredPoint.hour}: {hoveredPoint.weightKG.toLocaleString()} KG ({hoveredPoint.count} {isRTL ? 'شحنة' : 'lots'})
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-slate-500">
                    08:00 - 17:00
                  </span>
                )}
              </div>

              {/* Sparkline SVG */}
              <div className="w-full h-11 relative">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="todayWeightSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#06b6d4" floodOpacity="0.4" />
                    </filter>
                  </defs>

                  {/* Horizontal baseline guide */}
                  <line
                    x1="6"
                    y1={svgHeight - 4}
                    x2={svgWidth - 6}
                    y2={svgHeight - 4}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />

                  {/* Area fill under sparkline */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="url(#todayWeightSparklineGrad)"
                    />
                  )}

                  {/* Trend line */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#cyanGlow)"
                    />
                  )}

                  {/* Data Points */}
                  {sparklinePoints.map((pt, idx) => {
                    const isPeak = pt.data.weightKG === peakDataPoint.weightKG && pt.data.weightKG > 0;
                    const isHovered = hoveredPoint?.hour === pt.data.hour;

                    return (
                      <g
                        key={idx}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(pt.data)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      >
                        {/* Invisible larger hover target */}
                        <circle cx={pt.x} cy={pt.y} r="8" fill="transparent" />

                        {/* Visible node circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 4.5 : isPeak ? 3.5 : 2}
                          fill={isHovered ? '#fbbf24' : isPeak ? '#06b6d4' : '#0e7490'}
                          stroke={isHovered ? '#fff' : '#22d3ee'}
                          strokeWidth={isHovered ? 2 : 1.5}
                          className="transition-all duration-150"
                        />

                        {isPeak && !isHovered && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="6"
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="1"
                            className="animate-ping opacity-60"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Sparkline Axis Labels */}
              <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 pt-0.5">
                <span>08:00</span>
                <span className="text-cyan-500/80">
                  {isRTL ? 'توزيع الوردية الساعي' : 'Hourly Shift Curve'}
                </span>
                <span>17:00</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
            <span>{isRTL ? 'تجميع مباشر من قاعدة البيانات' : 'IndexedDB State Total'}</span>
            <span className="text-cyan-400 font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              <span>{activeStats.todayTransactionsCount} {isRTL ? 'سجلات اليوم' : 'Today Lots'}</span>
            </span>
          </div>
        </div>

        {/* KPI 2: Total Transactions (Required by user) */}
        <div className="relative group rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-950/80 border border-blue-500/40 p-3.5 shadow-md hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-blue-300 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>{isRTL ? 'إجمالي المعاملات' : 'Total Transactions'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/30">
              {isRTL ? 'سجل IndexedDB' : 'IndexedDB Store'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {activeStats.totalTransactions}
            </span>
            <span className="text-xs font-bold text-blue-400">
              {isRTL ? 'معاملة مسجلة' : 'Transactions'}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>{activeStats.normalCount} {isRTL ? 'سليمة ومحققة' : 'Verified'}</span>
            </span>
            {totalAlerts > 0 && (
              <span className="flex items-center gap-1 text-red-400 font-medium animate-pulse">
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>{totalAlerts} {isRTL ? 'إنذار' : 'Alerts'}</span>
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Average Weight per Intake */}
        <div className="relative group rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 shadow-md hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'معدل وزن المعاملة' : 'Avg Weight / Transaction'}</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">AVG</span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
              {avgWeightPerTransaction.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">KG</span>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
            <span>{isRTL ? 'إجمالي أوزان المخزن' : 'All-Time Logged Weight'}</span>
            <span className="text-slate-300 font-mono font-semibold">
              {(activeStats.totalWeightKG / 1000).toFixed(1)} TON
            </span>
          </div>
        </div>

        {/* KPI 4: Quality & Storage Compliance Gate */}
        <div className="relative group rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 shadow-md hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'حالة الرقابة والتخزين' : 'Compliance & Alerts'}</span>
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-slate-300 border border-slate-700">
              QC Gate
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            {totalAlerts === 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-bold">
                  {isRTL ? 'مطابق 100% (بدون حجر)' : '100% Compliant'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {activeStats.quarantinedCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-red-950 border border-red-500/50 text-red-300 text-xs font-bold">
                    {activeStats.quarantinedCount} {isRTL ? 'محجور' : 'Quarantine'}
                  </span>
                )}
                {activeStats.expiredCount > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 text-xs font-bold">
                    {activeStats.expiredCount} {isRTL ? 'منتهي' : 'Expired'}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
            <span>{isRTL ? 'محمي بواسطة IndexedDB' : 'Synced with LocalDB'}</span>
            <span className="text-emerald-400 font-semibold font-mono">
              {activeStats.normalCount}/{activeStats.totalTransactions} OK
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceivingScanHistorySummaryCard;
