import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Gauge,
  Sparkles,
  Info,
  Scale,
  Flame,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  ToleranceEvaluationReport,
  ToleranceAlertItem,
  ToleranceSeverity,
  loadWeightTolerances,
} from '../services/weightToleranceService';
import { ScaleToleranceConfigModal } from './ScaleToleranceConfigModal';
import { playAlertChime } from '../services/qrScannerService';

export interface ScaleToleranceAlertBannerProps {
  evaluation: ToleranceEvaluationReport;
  stage: 'RECEIVING' | 'SHREDDING';
  onThresholdsUpdated?: () => void;
  compact?: boolean;
}

export const ScaleToleranceAlertBanner: React.FC<ScaleToleranceAlertBannerProps> = ({
  evaluation,
  stage,
  onThresholdsUpdated,
  compact = false,
}) => {
  const { isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [hasBeepedForId, setHasBeepedForId] = useState<string>('');

  const { overallSeverity, hasDeviation, alerts } = evaluation;

  // Sound chime trigger for critical deviations
  useEffect(() => {
    if (overallSeverity === 'CRITICAL' && alerts.length > 0) {
      const topAlertId = alerts[0].id + '-' + alerts[0].actualValue;
      if (topAlertId !== hasBeepedForId) {
        const tolerances = loadWeightTolerances();
        if (tolerances.soundAlertEnabled) {
          playAlertChime();
        }
        setHasBeepedForId(topAlertId);
      }
    }
  }, [overallSeverity, alerts, hasBeepedForId]);

  // Color schemes based on severity
  const getBannerStyle = () => {
    switch (overallSeverity) {
      case 'CRITICAL':
        return 'bg-gradient-to-r from-rose-950/90 via-slate-950 to-red-950/80 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.3)] animate-pulse-slow';
      case 'WARNING':
        return 'bg-gradient-to-r from-amber-950/80 via-slate-950 to-orange-950/70 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]';
      case 'NORMAL':
      default:
        return 'bg-gradient-to-r from-emerald-950/60 via-slate-950 to-teal-950/40 border-emerald-500/40 shadow-inner';
    }
  };

  const getStatusBadge = () => {
    switch (overallSeverity) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono bg-rose-500 text-white shadow-lg shadow-rose-900/60 flex items-center gap-1.5 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{isRTL ? 'إنذار تجاوز حرج' : 'CRITICAL DEVIATION'}</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono bg-amber-500 text-black shadow-lg shadow-amber-900/60 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحذير تسامح وزني' : 'TOLERANCE WARNING'}</span>
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'ضمن حدود التسامح' : 'NOMINAL TOLERANCE'}</span>
          </span>
        );
    }
  };

  return (
    <div className={`rounded-2xl border transition-all ${getBannerStyle()} p-3.5 sm:p-4`}>
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              overallSeverity === 'CRITICAL'
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-bounce'
                : overallSeverity === 'WARNING'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            }`}
          >
            {stage === 'RECEIVING' ? <Scale className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {getStatusBadge()}
              <span className="text-[11px] font-mono text-slate-400">
                {stage === 'RECEIVING'
                  ? isRTL
                    ? 'نظام مراقبة تسامح الميزان الجسري'
                    : 'Weighbridge Real-Time Tolerance'
                  : isRTL
                  ? 'مراقبة موازنة كتلة وفاقد الثرم'
                  : 'Shredder Mass Conservation Monitor'}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-white leading-tight">
              {isRTL ? evaluation.summaryAr : evaluation.summaryEn}
            </h4>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isRTL ? 'تعديل معايير وحدود التسامح' : 'Configure tolerance thresholds'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">{isRTL ? 'إعدادات الحدود' : 'Tolerances'}</span>
          </button>

          {alerts.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>{alerts.length}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Breakdown of Deviating Metrics */}
      {isExpanded && alerts.length > 0 && (
        <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-2.5 text-xs animate-in slide-in-from-top-1 duration-200">
          <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
            <span>{isRTL ? 'تفاصيل الانحرافات المرصودة وتوصيات التصحيح:' : 'Detected Deviations & Corrective Actions:'}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date(evaluation.evaluatedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {alerts.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  item.severity === 'CRITICAL'
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.severity === 'CRITICAL' ? 'bg-rose-500 animate-ping' : 'bg-amber-400'
                      }`}
                    />
                    <strong className="text-white text-xs">{isRTL ? item.titleAr : item.titleEn}</strong>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-slate-300">
                      {isRTL ? item.metricAr : item.metric}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">
                    {isRTL ? item.messageAr : item.messageEn}
                  </p>

                  <div className="text-[10px] text-cyan-300 flex items-center gap-1.5 pt-0.5 font-sans">
                    <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {isRTL ? 'الإجراء الموصى به:' : 'Action:'} {isRTL ? item.recommendationAr : item.recommendationEn}
                    </span>
                  </div>
                </div>

                {/* Tolerance vs Actual Meter Strip */}
                <div className="p-2.5 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-end shrink-0 min-w-[140px]">
                  <div className="text-slate-400 text-[10px]">{isRTL ? 'القراءة الفعلية:' : 'Live Reading:'}</div>
                  <div className="text-sm font-black text-white">
                    {item.actualValue.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {isRTL ? 'المسموح:' : 'Target:'} {item.minAllowed.toLocaleString()} - {item.maxAllowed.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Threshold Configuration Dialog Modal */}
      {isConfigModalOpen && (
        <ScaleToleranceConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSaved={() => {
            if (onThresholdsUpdated) onThresholdsUpdated();
          }}
        />
      )}
    </div>
  );
};
