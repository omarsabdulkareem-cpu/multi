import React, { useState, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Zap,
  Activity,
  ShieldCheck,
  CheckCircle2,
  TrendingDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Sliders,
  DollarSign,
  Layers,
  Sparkles,
  Info,
  Calendar,
  X,
  RotateCcw,
  Check,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  FactoryMachine,
  MachinePredictiveAnalysis,
  FleetPredictiveSummary,
  PredictiveAlertLevel,
} from '../types';
import {
  getPredictiveMaintenanceFleetAnalysis,
  executeProactiveMaintenance,
  simulateRuntimeAdvance,
} from '../services/predictiveMaintenanceService';

interface PredictiveMaintenanceWidgetProps {
  onNavigateToMaintenance?: () => void;
  onMachineryUpdated?: () => void;
  className?: string;
}

export const PredictiveMaintenanceWidget: React.FC<PredictiveMaintenanceWidgetProps> = ({
  onNavigateToMaintenance,
  onMachineryUpdated,
  className = '',
}) => {
  const { isRTL } = useLanguage();
  const { currentUser, logAudit, setCurrentPage } = useFactory();

  const [filterTab, setFilterTab] = useState<'ALL' | 'IMMINENT' | 'PROACTIVE' | 'HEALTHY'>('ALL');
  const [selectedAnalysis, setSelectedAnalysis] = useState<MachinePredictiveAnalysis | null>(null);

  // Proactive Service Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [targetMachineForService, setTargetMachineForService] = useState<MachinePredictiveAnalysis | null>(null);
  const [serviceTechnician, setServiceTechnician] = useState('');
  const [serviceDowntimeHours, setServiceDowntimeHours] = useState(2);
  const [serviceNotes, setServiceNotes] = useState('');

  // Notification feedback
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'SUCCESS' | 'INFO';
    message: string;
  } | null>(null);

  // Refresh trigger for local state updates
  const [refreshKey, setRefreshKey] = useState(0);

  const fleetSummary: FleetPredictiveSummary = useMemo(() => {
    return getPredictiveMaintenanceFleetAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const allAnalyses = useMemo(() => {
    const list = [...fleetSummary.highRiskMachines, ...fleetSummary.proactiveQueue];
    // Remove duplicates by machineId
    const seen = new Set<string>();
    const unique: MachinePredictiveAnalysis[] = [];
    for (const item of list) {
      if (!seen.has(item.machineId)) {
        seen.add(item.machineId);
        unique.push(item);
      }
    }
    // Also include remaining healthy machines from fleet
    const fullSummary = getPredictiveMaintenanceFleetAnalysis();
    // We already have analyses sorted by TTF inside fullSummary
    return unique;
  }, [fleetSummary]);

  const filteredAnalyses = useMemo(() => {
    switch (filterTab) {
      case 'IMMINENT':
        return allAnalyses.filter((a) => a.alertLevel === 'CRITICAL_FAILURE_IMMINENT');
      case 'PROACTIVE':
        return allAnalyses.filter((a) => a.alertLevel === 'PROACTIVE_SERVICE_REQUIRED');
      case 'HEALTHY':
        return allAnalyses.filter((a) => a.alertLevel === 'HEALTHY' || a.alertLevel === 'SCHEDULED_ATTENTION');
      case 'ALL':
      default:
        return allAnalyses;
    }
  }, [allAnalyses, filterTab]);

  // Handle open Proactive Service modal
  const openProactiveServiceModal = (analysis: MachinePredictiveAnalysis) => {
    setTargetMachineForService(analysis);
    setServiceTechnician(analysis.assignedTechnician || currentUser?.nameAr || currentUser?.name || 'فني الصيانة');
    setServiceDowntimeHours(2);
    setServiceNotes(
      isRTL
        ? `إجراء صيانة استباقية لمعالجة: ${analysis.primaryFailureModeAr}`
        : `Proactive service to mitigate: ${analysis.primaryFailureModeEn}`
    );
    setIsServiceModalOpen(true);
  };

  // Submit Proactive Service
  const handleConfirmProactiveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMachineForService) return;

    try {
      const res = executeProactiveMaintenance(targetMachineForService.machineId, currentUser, {
        technician: serviceTechnician,
        downtimeHours: serviceDowntimeHours,
        notes: serviceNotes,
      });

      logAudit(
        'Proactive Maintenance Executed',
        'تنفيذ صيانة استباقية وتفادي توقف طارئ للماكينة',
        'Machinery',
        res.newTask.id,
        `${targetMachineForService?.nameAr || targetMachineForService?.nameEn || targetMachineForService?.machineCode} (${targetMachineForService?.machineCode})`,
        `Tech: ${serviceTechnician} | TTF Reset | Saved: ${targetMachineForService?.estimatedDowntimeAvoidedHours || 0}h downtime`,
        `Executed by ${currentUser?.nameAr || currentUser?.name || 'المشرف'}`
      );

      setIsServiceModalOpen(false);
      setRefreshKey((prev) => prev + 1);
      if (onMachineryUpdated) onMachineryUpdated();

      setActionFeedback({
        type: 'SUCCESS',
        message: isRTL
          ? `✓ تمت جدولة وتنفيذ الصيانة الاستباقية بنجاح للماكينة [${targetMachineForService.machineCode}]. تم تفادي توقف غير مخطط له مدته ${targetMachineForService.estimatedDowntimeAvoidedHours} ساعة وتوفير حوالي $${targetMachineForService.estimatedCostSavingsUSD}!`
          : `✓ Proactive service executed for [${targetMachineForService.machineCode}]. Successfully avoided ${targetMachineForService.estimatedDowntimeAvoidedHours}h of unscheduled downtime (estimated savings $${targetMachineForService.estimatedCostSavingsUSD})!`,
      });
      setTimeout(() => setActionFeedback(null), 7000);
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate Shift Runtime Advance (+8h or +16h)
  const handleSimulateHours = (machineId: string, hours: number) => {
    try {
      const res = simulateRuntimeAdvance(machineId, hours);
      setRefreshKey((prev) => prev + 1);
      if (onMachineryUpdated) onMachineryUpdated();

      setActionFeedback({
        type: 'INFO',
        message: isRTL
          ? `⚡ تم تسريع محاكاة التشغيل بمقدار (+${hours} ساعة). تم تحديث زمن الوصول للأعطال (TTF) ومؤشرات التآكل فورياً.`
          : `⚡ Simulated runtime advance (+${hours}h). Recalculated live Time-to-Failure (TTF) and degradation metrics.`,
      });
      setTimeout(() => setActionFeedback(null), 5000);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper for alert colors & badges
  const getAlertBadge = (level: PredictiveAlertLevel) => {
    switch (level) {
      case 'CRITICAL_FAILURE_IMMINENT':
        return {
          bg: 'bg-rose-950/80 border-rose-500/60 text-rose-300',
          dot: 'bg-rose-500 animate-ping',
          labelAr: 'خطر عطل حرج وشيك (TTF < 24h)',
          labelEn: 'CRITICAL FAILURE IMMINENT (<24h TTF)',
          color: 'text-rose-400',
          gradient: 'from-rose-950/60 via-slate-900 to-amber-950/40 border-rose-500/50',
        };
      case 'PROACTIVE_SERVICE_REQUIRED':
        return {
          bg: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
          dot: 'bg-amber-500',
          labelAr: 'صيانة استباقية مطلوبة (TTF < 72h)',
          labelEn: 'PROACTIVE SERVICE REQUIRED (<72h TTF)',
          color: 'text-amber-400',
          gradient: 'from-amber-950/50 via-slate-900 to-slate-950 border-amber-500/40',
        };
      case 'SCHEDULED_ATTENTION':
        return {
          bg: 'bg-blue-950/80 border-blue-500/50 text-blue-300',
          dot: 'bg-blue-400',
          labelAr: 'متابعة دورية مجدولة',
          labelEn: 'SCHEDULED ATTENTION',
          color: 'text-blue-400',
          gradient: 'from-blue-950/40 via-slate-900 to-slate-950 border-blue-500/30',
        };
      case 'HEALTHY':
      default:
        return {
          bg: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
          dot: 'bg-emerald-400',
          labelAr: 'كفاءة تشغيلية ممتازة',
          labelEn: 'OPTIMAL RUNTIME HEALTH',
          color: 'text-emerald-400',
          gradient: 'from-emerald-950/30 via-slate-900 to-slate-950 border-emerald-500/30',
        };
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold transition-all animate-fadeIn ${
            actionFeedback.type === 'SUCCESS'
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
              : 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Predictive Header Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-indigo-950/50 shrink-0 border border-indigo-400/30">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  AI PREDICTIVE RELIABILITY
                </span>
                <span className="text-xs text-slate-400">
                  {isRTL ? 'نظام التنبؤ بالأعطال والصيانة الاستباقية' : 'Proactive Service & Time-to-Failure Engine'}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
                <span>{isRTL ? 'رادار الصيانة التنبؤية وإشعارات عمر التشغيل' : 'Machinery Predictive Health & TTF Radar'}</span>
                {fleetSummary.criticalFailureImminentCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                    {fleetSummary.criticalFailureImminentCount} {isRTL ? 'حرجة' : 'CRITICAL'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                {isRTL
                  ? 'تحليل مستمر لمعدلات تشغيل ماكينات المصنع (خطوط البثق، مفرمة 360، التشكيل، والضواغط) لتوقع الأعطال قبل حدوثها وحساب زمن التوقف المتبقي (TTF).'
                  : 'Real-time telemetry analysis calculating machine wear velocity, Time-to-Failure (TTF), and prescriptive overhaul instructions before line stoppage.'}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 self-start md:self-center">
            {onNavigateToMaintenance ? (
              <button
                onClick={onNavigateToMaintenance}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-950 cursor-pointer transition-all"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isRTL ? 'سجل الصيانة الشامل' : 'Maintenance Ledger'}</span>
                {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage('maintenance')}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-950 cursor-pointer transition-all"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isRTL ? 'سجل الصيانة الشامل' : 'Maintenance Ledger'}</span>
                {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* 4 Telemetry KPI Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/5">
          {/* Card 1: Fleet Health Score */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-indigo-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm shrink-0 border border-indigo-500/30 font-mono">
              {fleetSummary.averageHealthScore}%
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-mono uppercase">
                {isRTL ? 'مؤشر سلامة الأسطول' : 'Fleet Health Index'}
              </div>
              <div className="text-sm font-black text-white">
                {fleetSummary.averageHealthScore >= 75
                  ? isRTL ? 'حالة تشغيلية جيدة' : 'Optimal Health'
                  : isRTL ? 'يتطلب تدخل استباقي' : 'Intervention Needed'}
              </div>
            </div>
          </div>

          {/* Card 2: Imminent & Proactive Alerts */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-rose-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-mono uppercase">
                {isRTL ? 'تنبيهات استباقية حرجة' : 'Imminent Breakdowns'}
              </div>
              <div className="text-sm font-black text-rose-300 font-mono">
                {fleetSummary.criticalFailureImminentCount + fleetSummary.proactiveServiceRequiredCount}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({fleetSummary.criticalFailureImminentCount} {isRTL ? 'حرج' : 'imminent'})
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Avoided Unscheduled Downtime */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-emerald-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-mono uppercase">
                {isRTL ? 'ساعات توقف تم تفاديها' : 'Downtime Prevented'}
              </div>
              <div className="text-sm font-black text-emerald-300 font-mono">
                +{fleetSummary.totalUnscheduledDowntimeAvoidedHours} {isRTL ? 'ساعة' : 'hrs'}
              </div>
            </div>
          </div>

          {/* Card 4: Estimated Cost Savings */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-amber-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-mono uppercase">
                {isRTL ? 'عائد الحماية التقديري' : 'Preventative ROI'}
              </div>
              <div className="text-sm font-black text-amber-300 font-mono">
                ${fleetSummary.totalEstimatedSavingsUSD.toLocaleString()} USD
              </div>
            </div>
          </div>
        </div>

        {/* Filter Navigation Strip */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/5 text-xs font-mono">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'جميع الماكينات' : 'All Fleet'} ({allAnalyses.length})
            </button>
            <button
              onClick={() => setFilterTab('IMMINENT')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'IMMINENT'
                  ? 'bg-rose-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>{isRTL ? 'خطر وشيك (<24h)' : 'Imminent (<24h TTF)'}</span>
              <span>({fleetSummary.criticalFailureImminentCount})</span>
            </button>
            <button
              onClick={() => setFilterTab('PROACTIVE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'PROACTIVE'
                  ? 'bg-amber-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isRTL ? 'صيانة استباقية (<72h)' : 'Proactive Queue (<72h)'}</span>
              <span>({fleetSummary.proactiveServiceRequiredCount})</span>
            </button>
            <button
              onClick={() => setFilterTab('HEALTHY')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterTab === 'HEALTHY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              <span>{isRTL ? 'سليمة / مجدولة' : 'Healthy / Scheduled'}</span>
              <span>({fleetSummary.healthyCount + fleetSummary.scheduledAttentionCount})</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRTL ? 'TTF = زمن التشغيل المقدر حتى التوقف الحرج' : 'TTF = Estimated Time-to-Failure'}</span>
          </div>
        </div>
      </div>

      {/* Grid of Proactive Service Alert & TTF Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {filteredAnalyses.map((analysis) => {
          const badge = getAlertBadge(analysis.alertLevel);
          const isCritical = analysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT';
          const isProactive = analysis.alertLevel === 'PROACTIVE_SERVICE_REQUIRED';

          return (
            <div
              key={analysis.machineId}
              className={`p-4 rounded-2xl bg-gradient-to-br ${badge.gradient} border shadow-lg space-y-3.5 transition-all hover:border-indigo-400/40`}
            >
              {/* Card Header: Code, Badges, TTF Highlight */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-black bg-black/60 text-white border border-white/20">
                      {analysis.machineCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${badge.bg}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      <span>{isRTL ? badge.labelAr : badge.labelEn}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isRTL ? analysis.sectionAr : analysis.sectionEn}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white mt-1">
                    {analysis ? (isRTL ? (analysis.nameAr || analysis.nameEn) : (analysis.nameEn || analysis.nameAr)) : ''}
                  </h4>
                </div>

                {/* Prominent Estimated Time-To-Failure (TTF) Badge */}
                <div
                  className={`p-2.5 rounded-xl text-center shrink-0 border min-w-[125px] ${
                    isCritical
                      ? 'bg-rose-950/90 border-rose-500/80 text-rose-200 animate-pulse shadow-lg shadow-rose-950/60'
                      : isProactive
                      ? 'bg-amber-950/90 border-amber-500/80 text-amber-200 shadow-md'
                      : 'bg-black/50 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="text-[9px] font-mono uppercase tracking-wider font-bold text-slate-300">
                    {isRTL ? 'زمن التوقف المتوقع' : 'EST. TIME-TO-FAILURE'}
                  </div>
                  <div className="text-lg font-black font-mono tracking-tight leading-tight mt-0.5">
                    {analysis.estimatedTimeToFailureHours}h
                  </div>
                  <div className="text-[10px] font-mono opacity-80">
                    (~{analysis.estimatedTimeToFailureDays} {isRTL ? 'أيام عمل' : 'days'})
                  </div>
                </div>
              </div>

              {/* Degradation & Health Bar */}
              <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isRTL ? 'مؤشر كفاءة الماكينة (Health):' : 'Machine Health Score:'}</span>
                  </span>
                  <span
                    className={`font-black ${
                      analysis.healthScore <= 30
                        ? 'text-rose-400'
                        : analysis.healthScore <= 60
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {analysis.healthScore}% ({analysis.degradationPercentage}% {isRTL ? 'استهلاك' : 'wear'})
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      analysis.healthScore <= 30
                        ? 'bg-gradient-to-r from-rose-600 to-red-500'
                        : analysis.healthScore <= 60
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${analysis.healthScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                  <span>
                    {isRTL ? 'ساعات التشغيل:' : 'Runtime:'} <b className="text-white">{analysis.currentOperatingHours}h</b> /{' '}
                    {analysis.maintenanceThresholdHours}h
                  </span>
                  <span>
                    {analysis.hoursUntilThreshold < 0 ? (
                      <span className="text-rose-400 font-bold">
                        {isRTL ? 'متجاوز بـ' : 'Overdue by'}: +{Math.abs(analysis.hoursUntilThreshold)}h
                      </span>
                    ) : (
                      <span className="text-cyan-300 font-bold">
                        {isRTL ? 'متبقي للحد:' : 'To Threshold:'} {analysis.hoursUntilThreshold}h
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Predictive Root Cause & Prescriptive Action */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-black/50 border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono text-indigo-300 font-bold uppercase flex items-center gap-1">
                    <AlertOctagon className="w-3 h-3 text-indigo-400" />
                    <span>{isRTL ? 'الخلل المتوقع حدوثه (Predicted Failure Mode):' : 'Predicted Root Cause:'}</span>
                  </div>
                  <div className="text-slate-200 font-bold">
                    {isRTL ? analysis.primaryFailureModeAr : analysis.primaryFailureModeEn}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    <b className="text-amber-300 font-mono">{isRTL ? 'التوصية:' : 'Prescription:'} </b>
                    {isRTL ? analysis.recommendedActionAr : analysis.recommendedActionEn}
                  </div>
                </div>

                {/* Sensor Wear Indicators */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {analysis.wearIndicators.slice(0, 2).map((ind, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-black/30 border border-white/5 flex items-center justify-between"
                    >
                      <span className="text-slate-400 truncate max-w-[120px]" title={isRTL ? ind.nameAr : ind.nameEn}>
                        {isRTL ? ind.nameAr : ind.nameEn}
                      </span>
                      <span
                        className={`font-bold shrink-0 ${
                          ind.status === 'CRITICAL'
                            ? 'text-rose-400'
                            : ind.status === 'ELEVATED'
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }`}
                      >
                        {ind.value} {ind.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deadlines, ROI and Action Buttons */}
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                  <div>
                    <span className="text-slate-500">{isRTL ? 'الموعد الأقصى للخدمة:' : 'Target Service Date:'} </span>
                    <b className="text-cyan-300">{analysis.proactiveServiceDeadlineDate}</b>
                  </div>
                  <div>
                    <span className="text-slate-500">{isRTL ? 'الفني المعين:' : 'Assigned Tech:'} </span>
                    <span className="text-slate-200">{analysis.assignedTechnician}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Simulate Runtime Forward button (+8h) */}
                  <button
                    onClick={() => handleSimulateHours(analysis.machineId, 8)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[11px] transition-colors cursor-pointer border border-slate-700"
                    title={isRTL ? 'محاكاة مرور 8 ساعات تشغيل (اختبار زمن TTF)' : 'Simulate +8 hours runtime'}
                  >
                    +8h
                  </button>

                  {/* Primary Proactive Service Execution Button */}
                  <button
                    onClick={() => openProactiveServiceModal(analysis)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                      isCritical
                        ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-950'
                        : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-950'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{isRTL ? 'تنفيذ صيانة استباقية' : 'Proactive Service'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Proactive Service Execution Modal */}
      {isServiceModalOpen && targetMachineForService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {isRTL ? 'إنجاز الصيانة الوقائية الاستباقية' : 'Execute Proactive Maintenance Overhaul'}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    [{targetMachineForService?.machineCode}] {targetMachineForService ? (isRTL ? (targetMachineForService.nameAr || targetMachineForService.nameEn) : (targetMachineForService.nameEn || targetMachineForService.nameAr)) : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Prescriptive Insights Summary Box */}
            <div className="p-3 rounded-xl bg-black/40 border border-indigo-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>{isRTL ? 'العطل المتوقع تفاديه:' : 'Mitigated Failure:'}</span>
                <span className="text-rose-400 font-bold">
                  {isRTL ? targetMachineForService.primaryFailureModeAr : targetMachineForService.primaryFailureModeEn}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>{isRTL ? 'زمن التوقف غير المخطط الموفر:' : 'Downtime Avoided:'}</span>
                <span className="text-emerald-400 font-bold">
                  +{targetMachineForService.estimatedDowntimeAvoidedHours} {isRTL ? 'ساعة عمل' : 'hours'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>{isRTL ? 'القطع الموصى بها:' : 'Recommended Parts:'}</span>
                <span className="text-amber-300 font-sans">
                  {isRTL ? targetMachineForService.recommendedPartsAr : targetMachineForService.recommendedPartsEn}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmProactiveService} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    {isRTL ? 'الفني المنفذ:' : 'Technician Performing Service:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceTechnician}
                    onChange={(e) => setServiceTechnician(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    {isRTL ? 'مدة التوقف المخطط (ساعات):' : 'Planned Service Downtime (Hours):'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    required
                    value={serviceDowntimeHours}
                    onChange={(e) => setServiceDowntimeHours(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">
                  {isRTL ? 'ملاحظات الصيانة والقطع المستبدلة:' : 'Service Notes & Actions Taken:'}
                </label>
                <textarea
                  rows={2}
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2 font-mono">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {isRTL
                    ? `سيتم تمديد حد الصيانة الدفتري بمقدار +${targetMachineForService.intervalHours} ساعة وإعادة تعيين مؤشر TTF إلى الحالة السليمة (100%).`
                    : `Threshold will be advanced by +${targetMachineForService.intervalHours}h and TTF health score restored to 100%.`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRTL ? 'تأكيد وإنجاز الصيانة' : 'Confirm & Log Overhaul'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
