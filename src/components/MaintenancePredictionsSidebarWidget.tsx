import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Wrench,
  Clock,
  Zap,
  TrendingUp,
  Maximize2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Cpu,
  X,
  Sparkles,
  Info,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  evaluateShredderSensorPredictive,
  generate24HourFailureRiskHeatmap,
  HourlyFailureRiskSlot,
  ShredderPredictiveAnalysis,
} from '../services/shredderSensorPredictiveService';
import { EVENT_MAINTENANCE_ALERT_TRIGGERED } from '../services/maintenanceAlertService';

interface MaintenancePredictionsSidebarWidgetProps {
  isSidebarOpen: boolean;
  className?: string;
}

export const MaintenancePredictionsSidebarWidget: React.FC<MaintenancePredictionsSidebarWidgetProps> = ({
  isSidebarOpen,
  className = '',
}) => {
  const { isRTL, t } = useLanguage();
  const { setCurrentPage } = useFactory();

  // Telemetry & analysis state
  const [analysis, setAnalysis] = useState<ShredderPredictiveAnalysis>(() =>
    evaluateShredderSensorPredictive()
  );

  // Widget collapsed / expanded state in sidebar
  const [isWidgetExpanded, setIsWidgetExpanded] = useState(true);

  // Selected hour slot for inspecting details
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

  // Expanded detailed modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Sync with real-time sensor events and simulation changes
  useEffect(() => {
    const handleUpdate = () => {
      setAnalysis(evaluateShredderSensorPredictive());
    };

    window.addEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleUpdate);
    const interval = setInterval(handleUpdate, 5000);

    return () => {
      window.removeEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleUpdate);
      clearInterval(interval);
    };
  }, []);

  // Compute 24-hour failure risk heatmap slots
  const heatmapSlots: HourlyFailureRiskSlot[] = useMemo(() => {
    return generate24HourFailureRiskHeatmap(analysis);
  }, [analysis]);

  const activeSlot = heatmapSlots[selectedSlotIndex] || heatmapSlots[0];

  // High risk hours count
  const criticalHoursCount = heatmapSlots.filter((s) => s.riskLevel === 'CRITICAL').length;
  const elevatedHoursCount = heatmapSlots.filter((s) => s.riskLevel === 'ELEVATED').length;
  const maxRiskSlot = useMemo(() => {
    return heatmapSlots.reduce((max, s) => (s.failureRiskPct > max.failureRiskPct ? s : max), heatmapSlots[0]);
  }, [heatmapSlots]);

  // Color mapping for risk levels
  const getRiskColor = (level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'CRITICAL') => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-600/90 text-white border-rose-400 shadow-sm shadow-rose-900/50 animate-pulse';
      case 'ELEVATED':
        return 'bg-orange-500/80 text-white border-orange-400';
      case 'MODERATE':
        return 'bg-amber-500/70 text-amber-100 border-amber-400';
      case 'LOW':
      default:
        return 'bg-emerald-900/50 text-emerald-300 border-emerald-700/60 hover:bg-emerald-800/60';
    }
  };

  // If sidebar is collapsed (icon mode), render compact pulse badge with trigger
  if (!isSidebarOpen) {
    return (
      <div className="px-2 py-3 border-t border-white/10 flex justify-center">
        <button
          onClick={() => setIsDetailModalOpen(true)}
          className={`p-2 rounded-xl relative transition-all group ${
            analysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
              ? 'bg-rose-950/80 text-rose-300 border border-rose-500/60 animate-pulse'
              : analysis.alertLevel === 'PROACTIVE_SERVICE_REQUIRED'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50'
              : 'bg-slate-900 text-cyan-400 border border-slate-700 hover:bg-slate-800'
          }`}
          title={
            isRTL
              ? `تنبؤات الصيانة: مخاطر 24 ساعة (${analysis.overallHealthScore}% صحة)`
              : `Maintenance Predictions: 24h Risk Map (${analysis.overallHealthScore}% Health)`
          }
        >
          <Activity className="w-5 h-5" />
          {criticalHoursCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>

        {/* Modal for collapsed mode */}
        {isDetailModalOpen && (
          <DetailedHeatmapModal
            analysis={analysis}
            heatmapSlots={heatmapSlots}
            onClose={() => setIsDetailModalOpen(false)}
            onNavigateShredder={() => {
              setIsDetailModalOpen(false);
              setCurrentPage('shredding');
            }}
            onNavigateMaintenance={() => {
              setIsDetailModalOpen(false);
              setCurrentPage('maintenance_alerts');
            }}
          />
        )}
      </div>
    );
  }

  // Expanded Sidebar Widget
  return (
    <div className={`border-t border-white/10 bg-[#0c0e12] p-3 text-xs ${className}`}>
      {/* Widget Header */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`p-1.5 rounded-lg shrink-0 ${
              analysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
                ? 'bg-rose-900/60 text-rose-300 border border-rose-500/50 animate-pulse'
                : analysis.alertLevel === 'PROACTIVE_SERVICE_REQUIRED'
                ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                : 'bg-cyan-950 text-cyan-400 border border-cyan-800/60'
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-[12px] truncate">
                {isRTL ? 'تنبؤات الصيانة (24 ساعة)' : 'Maintenance Predictions'}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
              <span>{isRTL ? 'مستشعرات الثرم الحية' : 'Shredder Sensor Data'}</span>
              <span>·</span>
              <span
                className={`font-mono font-bold ${
                  analysis.overallHealthScore >= 75
                    ? 'text-emerald-400'
                    : analysis.overallHealthScore >= 45
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {analysis.overallHealthScore}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsDetailModalOpen(true)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isRTL ? 'تكبير خريطة المخاطر' : 'Expand 24h Heatmap'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsWidgetExpanded(!isWidgetExpanded)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isWidgetExpanded ? (isRTL ? 'طي' : 'Collapse') : (isRTL ? 'توسيع' : 'Expand')}
          >
            {isWidgetExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isWidgetExpanded && (
        <div className="space-y-2.5 pt-1">
          {/* Real-time Sensor Micro-Strip */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-[#12151c] border border-white/5 text-[10px]">
            <div>
              <span className="text-slate-400 block">{isRTL ? 'التيار' : 'Current'}</span>
              <span
                className={`font-mono font-black ${
                  analysis.motorHealth.peakSpikeCurrentA >= 170
                    ? 'text-rose-400 animate-pulse'
                    : analysis.motorHealth.peakSpikeCurrentA >= 145
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {analysis.motorHealth.averageCurrentA}A
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">{isRTL ? 'الشفرات' : 'Knives'}</span>
              <span
                className={`font-mono font-black ${
                  analysis.bladeWear.edgeWearPct >= 80
                    ? 'text-rose-400'
                    : analysis.bladeWear.edgeWearPct >= 60
                    ? 'text-amber-400'
                    : 'text-slate-200'
                }`}
              >
                {analysis.bladeWear.edgeWearPct}%
              </span>
            </div>

            <div>
              <span className="text-slate-400 block">{isRTL ? 'حرارة المحرك' : 'Temp'}</span>
              <span
                className={`font-mono font-black ${
                  analysis.motorHealth.windingTempC >= 85
                    ? 'text-rose-400'
                    : analysis.motorHealth.windingTempC >= 75
                    ? 'text-amber-400'
                    : 'text-slate-200'
                }`}
              >
                {analysis.motorHealth.windingTempC}°C
              </span>
            </div>
          </div>

          {/* 24-Hour Failure Risk Heat Map Grid */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>{isRTL ? 'خريطة مخاطر الأعطال (24 ساعة)' : '24h Machine Failure Risk'}</span>
              </span>
              <span className="text-[9px] font-mono text-slate-500">
                {criticalHoursCount > 0 ? (
                  <span className="text-rose-400 font-bold">
                    {criticalHoursCount}h {isRTL ? 'خطر حرج' : 'Critical'}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">{isRTL ? 'آمن ومستقر' : 'Safe'}</span>
                )}
              </span>
            </div>

            {/* Heatmap Blocks: 2 rows of 12 blocks */}
            <div className="grid grid-cols-12 gap-1 p-1.5 rounded-lg bg-[#141720] border border-white/5">
              {heatmapSlots.map((slot, idx) => {
                const isSelected = selectedSlotIndex === idx;
                return (
                  <button
                    key={`slot-${slot.hourIndex}-${idx}`}
                    onClick={() => setSelectedSlotIndex(idx)}
                    onMouseEnter={() => setSelectedSlotIndex(idx)}
                    className={`h-5 w-full rounded-[3px] border transition-transform relative group flex items-center justify-center cursor-pointer ${getRiskColor(
                      slot.riskLevel
                    )} ${isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:scale-105'}`}
                    title={`${slot.formattedTime}: ${slot.failureRiskPct}% risk (${slot.riskLevel})`}
                  >
                    <span className="text-[7px] font-mono font-bold leading-none opacity-80">
                      {idx % 4 === 0 ? slot.hourLabel.slice(0, 2) : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Heatmap Time Markers */}
            <div className="flex justify-between text-[8px] font-mono text-slate-500 px-1">
              <span>{heatmapSlots[0]?.hourLabel}</span>
              <span>{heatmapSlots[6]?.hourLabel}</span>
              <span>{heatmapSlots[12]?.hourLabel}</span>
              <span>{heatmapSlots[18]?.hourLabel}</span>
              <span>{heatmapSlots[23]?.hourLabel}</span>
            </div>
          </div>

          {/* Active Slot Telemetry Inspector Card */}
          {activeSlot && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] transition-all ${
                activeSlot.riskLevel === 'CRITICAL'
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                  : activeSlot.riskLevel === 'ELEVATED'
                  ? 'bg-orange-950/60 border-orange-500/40 text-orange-200'
                  : activeSlot.riskLevel === 'MODERATE'
                  ? 'bg-amber-950/50 border-amber-500/30 text-amber-200'
                  : 'bg-slate-900/80 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-white/10">
                <span className="font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{activeSlot.formattedTime}</span>
                </span>
                <span className="font-mono font-black text-xs">
                  {isRTL ? 'احتمال العطل:' : 'Risk:'} {activeSlot.failureRiskPct}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-300 pb-1">
                <div>
                  <span className="text-slate-400">{isRTL ? 'الحمل المتوقع:' : 'Current:'}</span>{' '}
                  <strong className="text-white font-mono">{activeSlot.projectedLoadCurrentA}A</strong>
                </div>
                <div>
                  <span className="text-slate-400">{isRTL ? 'تآكل السكاكين:' : 'Knives:'}</span>{' '}
                  <strong className="text-white font-mono">{activeSlot.projectedBladeWearPct}%</strong>
                </div>
                <div>
                  <span className="text-slate-400">{isRTL ? 'حرارة الملفات:' : 'Motor Temp:'}</span>{' '}
                  <strong className="text-white font-mono">{activeSlot.projectedWindingTempC}°C</strong>
                </div>
                <div>
                  <span className="text-slate-400">{isRTL ? 'الوردية:' : 'Shift:'}</span>{' '}
                  <span className="text-cyan-300 font-medium">
                    {isRTL ? activeSlot.shiftNameAr.split(' ')[0] : activeSlot.shiftNameEn.split(' ')[0]}
                  </span>
                </div>
              </div>

              <p className="text-[10px] opacity-90 line-clamp-2 pt-0.5 text-slate-300 leading-tight">
                {isRTL ? activeSlot.primaryRiskFactorAr : activeSlot.primaryRiskFactorEn}
              </p>
            </div>
          )}

          {/* Quick Navigation Footer */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => setCurrentPage('shredding')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Activity className="w-3 h-3" />
              <span>{isRTL ? 'شاشة المستشعرات' : 'Sensor Telemetry'}</span>
            </button>

            <button
              onClick={() => setCurrentPage('maintenance_alerts')}
              className="flex-1 py-1.5 px-2 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Wrench className="w-3 h-3" />
              <span>{isRTL ? 'إنذارات الصيانة' : 'Maintenance Feed'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Expanded 24-Hour Failure Risk Modal */}
      {isDetailModalOpen && (
        <DetailedHeatmapModal
          analysis={analysis}
          heatmapSlots={heatmapSlots}
          onClose={() => setIsDetailModalOpen(false)}
          onNavigateShredder={() => {
            setIsDetailModalOpen(false);
            setCurrentPage('shredding');
          }}
          onNavigateMaintenance={() => {
            setIsDetailModalOpen(false);
            setCurrentPage('maintenance_alerts');
          }}
        />
      )}
    </div>
  );
};

interface DetailedHeatmapModalProps {
  analysis: ShredderPredictiveAnalysis;
  heatmapSlots: HourlyFailureRiskSlot[];
  onClose: () => void;
  onNavigateShredder: () => void;
  onNavigateMaintenance: () => void;
}

const DetailedHeatmapModal: React.FC<DetailedHeatmapModalProps> = ({
  analysis,
  heatmapSlots,
  onClose,
  onNavigateShredder,
  onNavigateMaintenance,
}) => {
  const { isRTL } = useLanguage();
  const [activeSlotIdx, setActiveSlotIdx] = useState<number>(0);
  const currentSlot = heatmapSlots[activeSlotIdx] || heatmapSlots[0];

  const criticalCount = heatmapSlots.filter((s) => s.riskLevel === 'CRITICAL').length;
  const elevatedCount = heatmapSlots.filter((s) => s.riskLevel === 'ELEVATED').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1117] border border-slate-700 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isRTL ? 'الخريطة الحرارية لتوقعات مخاطر الأعطال (24 ساعة)' : '24-Hour Machine Failure Risk Heatmap'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRTL
                  ? 'مستشعرات تيار المحرك وتآكل شفرات مفرمة الثرم 360 (MCH-SHR-01)'
                  : 'Real-time telemetry & predictive risk modeling for Heavy Duty Shredder 360'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Predictive Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'مؤشر صحة المفرمة الحالي' : 'Overall Health Score'}
            </span>
            <div className="text-xl font-black mt-0.5">
              <span
                className={
                  analysis.overallHealthScore >= 75
                    ? 'text-emerald-400'
                    : analysis.overallHealthScore >= 45
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }
              >
                {analysis.overallHealthScore}%
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'ساعات الخطر الحرج (>75%)' : 'Critical Hours Risk'}
            </span>
            <div className="text-xl font-black mt-0.5">
              <span className={criticalCount > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}>
                {criticalCount} {isRTL ? 'ساعة' : 'hrs'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'تآكل سكاكين الدوار D2' : 'D2 Blade Wear'}
            </span>
            <div className="text-xl font-black mt-0.5 text-cyan-400">
              {analysis.bladeWear.edgeWearPct}%
              <span className="text-xs text-slate-500 font-normal"> ({analysis.bladeWear.clearanceGapMm}mm)</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'ذروة قفزة التيار المسجلة' : 'Peak Current Surge'}
            </span>
            <div className="text-xl font-black mt-0.5 text-amber-400">
              {analysis.motorHealth.peakSpikeCurrentA} A
            </div>
          </div>
        </div>

        {/* 24-Hour Timeline Grid View */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white text-xs">
              {isRTL ? 'شبكة الـ 24 ساعة حسب الورديات' : '24-Hour Continuous Timeline by Production Shift'}
            </span>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>{isRTL ? 'آمن (<25%)' : 'Low (<25%)'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>{isRTL ? 'متوسط (25-50%)' : 'Moderate'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span>{isRTL ? 'مرتفع (50-75%)' : 'Elevated'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                <span>{isRTL ? 'خطر حرج (>75%)' : 'Critical'}</span>
              </span>
            </div>
          </div>

          {/* 24-Cell Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
            {heatmapSlots.map((slot, idx) => {
              const isSelected = activeSlotIdx === idx;
              let bg = 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
              if (slot.riskLevel === 'CRITICAL') {
                bg = 'bg-rose-950/90 border-rose-500 text-rose-200 animate-pulse';
              } else if (slot.riskLevel === 'ELEVATED') {
                bg = 'bg-orange-950/80 border-orange-500/60 text-orange-200';
              } else if (slot.riskLevel === 'MODERATE') {
                bg = 'bg-amber-950/70 border-amber-500/50 text-amber-200';
              }

              return (
                <button
                  key={`modal-slot-${slot.hourIndex}-${idx}`}
                  onClick={() => setActiveSlotIdx(idx)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${bg} ${
                    isSelected ? 'ring-2 ring-white scale-105 z-10' : 'hover:scale-102'
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold text-slate-300">{slot.hourLabel}</div>
                  <div className="text-sm font-black font-mono mt-0.5">{slot.failureRiskPct}%</div>
                  <div className="text-[8px] opacity-80 truncate">{slot.projectedLoadCurrentA}A</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Hour Detail Card */}
        {currentSlot && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              currentSlot.riskLevel === 'CRITICAL'
                ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                : currentSlot.riskLevel === 'ELEVATED'
                ? 'bg-orange-950/70 border-orange-500/60 text-orange-200'
                : currentSlot.riskLevel === 'MODERATE'
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-black text-white">{currentSlot.formattedTime}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-slate-300">
                  {isRTL ? currentSlot.shiftNameAr : currentSlot.shiftNameEn}
                </span>
              </div>
              <div className="font-mono text-sm font-black">
                {isRTL ? 'احتمالية العطل المحسوبة:' : 'Calculated Failure Risk:'}{' '}
                <span className="text-base text-white">{currentSlot.failureRiskPct}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">{isRTL ? 'التيار التقديري:' : 'Projected Current:'}</span>
                <strong className="text-white font-mono text-sm">{currentSlot.projectedLoadCurrentA} A</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isRTL ? 'تآكل السكاكين المتوقع:' : 'Blade Wear:'}</span>
                <strong className="text-white font-mono text-sm">{currentSlot.projectedBladeWearPct}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isRTL ? 'حرارة المحرك المقدرة:' : 'Motor Winding Temp:'}</span>
                <strong className="text-white font-mono text-sm">{currentSlot.projectedWindingTempC} °C</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isRTL ? 'مستوى الخطورة:' : 'Risk Level:'}</span>
                <strong className="text-white font-bold">{currentSlot.riskLevel}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <span className="text-slate-400 font-semibold text-[10px] block mb-0.5">
                {isRTL ? 'السبب التنبؤي وتحليل المخاطر:' : 'Predictive Root Cause & Failure Factor:'}
              </span>
              <p className="text-white font-medium text-xs leading-relaxed">
                {isRTL ? currentSlot.primaryRiskFactorAr : currentSlot.primaryRiskFactorEn}
              </p>
            </div>
          </div>
        )}

        {/* Modal Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            {isRTL ? 'إغلاق' : 'Close'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateShredder}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Activity className="w-4 h-4" />
              <span>{isRTL ? 'الانتقال إلى مستشعرات الثرم' : 'Open Shredder Sensors'}</span>
            </button>
            <button
              onClick={onNavigateMaintenance}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Wrench className="w-4 h-4" />
              <span>{isRTL ? 'جدول أوامر الصيانة' : 'Maintenance Feed'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
