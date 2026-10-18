import React, { useState } from 'react';
import {
  AlertTriangle,
  Activity,
  Wrench,
  Gauge,
  Sliders,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Cpu,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  ScalePredictiveMaintenanceAlert,
  ScaleOperationalBaseline,
  ScaleDeviationType,
  setSimulatedDeviation,
  saveScaleBaseline,
} from '../services/scalePredictiveMaintenanceService';

export interface ScalePredictiveMaintenanceAlertCardProps {
  alert: ScalePredictiveMaintenanceAlert;
  onRefreshEvaluation: () => void;
  onAcknowledgeAlert?: () => void;
}

export const ScalePredictiveMaintenanceAlertCard: React.FC<ScalePredictiveMaintenanceAlertCardProps> = ({
  alert,
  onRefreshEvaluation,
  onAcknowledgeAlert,
}) => {
  const { isRTL } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);

  // Baseline editor state
  const [editableBaseline, setEditableBaseline] = useState<ScaleOperationalBaseline>(alert.historicalBaseline);

  const handleSimulate = (scenario: ScaleDeviationType | null) => {
    setSimulatedDeviation(scenario);
    setIsAcknowledged(false);
    onRefreshEvaluation();
  };

  const handleSaveBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    saveScaleBaseline(editableBaseline);
    setIsConfigOpen(false);
    onRefreshEvaluation();
  };

  // If user acknowledged this alert during this session
  if (isAcknowledged && alert.isTriggered) {
    return (
      <div className="p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 flex items-center justify-between text-xs text-amber-300">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-400" />
          <span>
            {isRTL
              ? 'تم تأكيد تحذير الصيانة التنبؤية لميزان الدخول مؤقتاً لمواصلة استلام الشحنة الحالية'
              : 'Scale predictive maintenance warning acknowledged for current truck intake.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsAcknowledged(false)}
          className="text-[11px] underline text-amber-400 hover:text-white cursor-pointer"
        >
          {isRTL ? 'إعادة إظهار التحذير' : 'Show Alert'}
        </button>
      </div>
    );
  }

  // HEALTHY STATE (Compact & Sleek)
  if (!alert.isTriggered || alert.severity === 'HEALTHY') {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-500/30 p-3 sm:p-3.5 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">
                  {isRTL
                    ? 'الصيانة التنبؤية لميزان الدخول: متطابق مع خط الأساس التشغيلي'
                    : 'Scale-In Predictive Maintenance: Normal Operational Baseline'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  HEALTH SCORE: {alert.healthScore}%
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                <span>
                  {isRTL ? 'وتيرة التسجيل:' : 'Intake Rate:'} {alert.currentFrequencyTxPerHour} {isRTL ? 'شاحنة/ساعة' : 'tx/hr'}
                </span>
                <span>•</span>
                <span>
                  {isRTL ? 'متوسط الفاصل:' : 'Mean Interval:'} {alert.currentMeanIntervalMinutes} {isRTL ? 'دقيقة' : 'min'}
                </span>
                <span>•</span>
                <span>Z-Score: {alert.frequencyZScore}σ</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all"
            >
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>{isRTL ? 'التفاصيل والمحاكاة' : 'Diagnostics & Test'}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Expanded Diagnostics & Simulation Drawer for Healthy State */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'احتمالية العطل' : 'Failure Risk'}</span>
                <span className="font-mono font-bold text-emerald-400">{alert.failureProbabilityPct}%</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'الوقت المتوقع للعطل' : 'Projected TTF'}</span>
                <span className="font-mono font-bold text-cyan-300">{alert.projectedTimeToFailureHours}h</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'خط الأساس للتكرار' : 'Baseline Freq'}</span>
                <span className="font-mono font-bold text-slate-300">{alert.historicalBaseline.baselineFrequencyTxPerHour} tx/h</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'خط الأساس للوزن' : 'Baseline Gross'}</span>
                <span className="font-mono font-bold text-slate-300">
                  {(alert.historicalBaseline.baselineMeanGrossWeightKG / 1000).toFixed(1)}t
                </span>
              </div>
            </div>

            {/* Test Simulation Buttons */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                {isRTL ? 'محاكاة انحرافات الصيانة التنبؤية:' : 'Simulate Baseline Deviations:'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSimulate('FREQUENCY_CHATTER')}
                  className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/40 text-[10px] font-mono cursor-pointer"
                  title="Simulate high-frequency recording chatter"
                >
                  ⚡ Chatter (18.5 tx/h)
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulate('PATTERN_FLATLINE')}
                  className="px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 text-[10px] font-mono cursor-pointer"
                  title="Simulate flatline sensor lock"
                >
                  🧊 Flatline (Static Lock)
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulate('PATTERN_DRIFT')}
                  className="px-2 py-1 rounded bg-orange-950/80 hover:bg-orange-900 text-orange-300 border border-orange-500/40 text-[10px] font-mono cursor-pointer"
                  title="Simulate calibration span drift"
                >
                  📉 Span Drift (-8.9t)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // TRIGGERED WARNING / CRITICAL STATE
  const isCritical = alert.severity === 'CRITICAL';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5 shadow-2xl transition-all duration-300 animate-in fade-in ${
        isCritical
          ? 'bg-gradient-to-br from-red-950 via-slate-950 to-amber-950 border-red-500/80 shadow-red-950/60'
          : 'bg-gradient-to-br from-amber-950 via-slate-950 to-slate-900 border-amber-500/80 shadow-amber-950/50'
      }`}
    >
      {/* Decorative Warning Stripe */}
      <div
        className={`absolute top-0 start-0 w-2 h-full ${
          isCritical ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
        }`}
      />

      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-2xl shrink-0 border ${
                isCritical
                  ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-bounce'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/50'
              }`}
            >
              <Wrench className="w-5 h-5" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isCritical
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-amber-500 text-slate-950 font-bold'
                  }`}
                >
                  {isCritical ? 'CRITICAL PREDICTIVE ALERT' : 'PREDICTIVE WARNING'}
                </span>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-cyan-300 border border-cyan-500/40">
                  {alert.deviationType}
                </span>

                {alert.isSimulated && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                    TEST SIMULATION
                  </span>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-black text-white mt-1.5">
                {isRTL ? alert.titleAr : alert.titleEn}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-start">
            <button
              type="button"
              onClick={() => {
                setIsAcknowledged(true);
                if (onAcknowledgeAlert) onAcknowledgeAlert();
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer transition-all"
            >
              {isRTL ? 'تأكيد واستمرار' : 'Acknowledge'}
            </button>
            <button
              type="button"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 text-xs cursor-pointer"
              title={isRTL ? 'تعديل خط الأساس التشغيلي' : 'Edit Operational Baseline'}
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Narrative Description */}
        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
          {isRTL ? alert.descriptionAr : alert.descriptionEn}
        </p>

        {/* Key Operational Metric Comparison Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Frequency Comparison */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isRTL ? 'وتيرة التسجيل' : 'Recording Rate'}</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className={`text-base font-black ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
                {alert.currentFrequencyTxPerHour}
              </span>
              <span className="text-[10px] text-slate-500">/h</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between font-mono">
              <span>Base: {alert.historicalBaseline.baselineFrequencyTxPerHour}/h</span>
              <span className={`font-bold ${alert.frequencyZScore >= 2.0 ? 'text-red-400' : 'text-slate-400'}`}>
                Z={alert.frequencyZScore}σ
              </span>
            </div>
          </div>

          {/* Card 2: Inter-Truck Interval */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isRTL ? 'فاصل الشاحنات' : 'Mean Interval'}</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-base font-black text-white">{alert.currentMeanIntervalMinutes}</span>
              <span className="text-[10px] text-slate-500">{isRTL ? 'دقيقة' : 'min'}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Base: {alert.historicalBaseline.baselineMeanIntervalMinutes} min
            </div>
          </div>

          {/* Card 3: Health Score & Failure Risk */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isRTL ? 'صحة الميزان' : 'Scale Health'}</span>
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span
                className={`text-base font-black ${
                  alert.healthScore < 40 ? 'text-red-400' : alert.healthScore < 70 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {alert.healthScore}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  alert.healthScore < 40 ? 'bg-red-500' : alert.healthScore < 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${alert.healthScore}%` }}
              />
            </div>
          </div>

          {/* Card 4: TTF & Risk Probability */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{isRTL ? 'احتمالية التوقف' : 'Failure Risk'}</span>
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-base font-black text-rose-400">{alert.failureProbabilityPct}%</span>
              <span className="text-[10px] text-slate-500">TTF ~{alert.projectedTimeToFailureHours}h</span>
            </div>
            <div className="text-[10px] text-rose-300 font-mono mt-1">
              {isRTL ? 'إجراء صيانة عاجل' : 'Urgent action'}
            </div>
          </div>
        </div>

        {/* Root Cause & Engineering Recommendation */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <span className="font-bold text-amber-400 shrink-0">
              {isRTL ? 'السبب الجذري المرجح:' : 'Root Cause Hypothesis:'}
            </span>
            <span className="text-slate-300">{isRTL ? alert.rootCauseAr : alert.rootCauseEn}</span>
          </div>

          <div className="flex items-start gap-2 pt-1 border-t border-slate-800">
            <span className="font-bold text-cyan-300 shrink-0">
              {isRTL ? 'التوصية الهندسية:' : 'Recommended Action:'}
            </span>
            <span className="text-slate-200">{isRTL ? alert.recommendedActionAr : alert.recommendedActionEn}</span>
          </div>
        </div>

        {/* Simulation Toolbar for Testing */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'اختبار السيناريوهات:' : 'Test Sandbox:'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSimulate('FREQUENCY_CHATTER')}
              className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                alert.deviationType === 'FREQUENCY_CHATTER'
                  ? 'bg-amber-600 text-white border-amber-400 font-bold'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              Chatter (18.5/h)
            </button>
            <button
              type="button"
              onClick={() => handleSimulate('PATTERN_FLATLINE')}
              className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                alert.deviationType === 'PATTERN_FLATLINE'
                  ? 'bg-red-600 text-white border-red-400 font-bold'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              Flatline (Sensor Lock)
            </button>
            <button
              type="button"
              onClick={() => handleSimulate('PATTERN_DRIFT')}
              className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer border ${
                alert.deviationType === 'PATTERN_DRIFT'
                  ? 'bg-orange-600 text-white border-orange-400 font-bold'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              Span Drift (-8.9t)
            </button>
            <button
              type="button"
              onClick={() => handleSimulate(null)}
              className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono cursor-pointer"
            >
              ✓ Reset Healthy
            </button>
          </div>
        </div>

        {/* Operational Baseline Calibration Editor Drawer */}
        {isConfigOpen && (
          <form
            onSubmit={handleSaveBaseline}
            className="p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                {isRTL ? 'معايرة خط الأساس التشغيلي لميزان الدخول' : 'Calibrate Scale Operational Baseline'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Last: {editableBaseline.lastBaselineCalibratedDate}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[10px] mb-1">
                  {isRTL ? 'معدل التكرار الأساسي (شاحنة/ساعة)' : 'Baseline Freq (tx/hr)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editableBaseline.baselineFrequencyTxPerHour}
                  onChange={(e) =>
                    setEditableBaseline({ ...editableBaseline, baselineFrequencyTxPerHour: Number(e.target.value) })
                  }
                  className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] mb-1">
                  {isRTL ? 'متوسط الفاصل الطبيعي (دقيقة)' : 'Mean Interval (min)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editableBaseline.baselineMeanIntervalMinutes}
                  onChange={(e) =>
                    setEditableBaseline({ ...editableBaseline, baselineMeanIntervalMinutes: Number(e.target.value) })
                  }
                  className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] mb-1">
                  {isRTL ? 'متوسط الوزن الإجمالي الأساسي (كغم)' : 'Mean Gross Weight (KG)'}
                </label>
                <input
                  type="number"
                  step="100"
                  value={editableBaseline.baselineMeanGrossWeightKG}
                  onChange={(e) =>
                    setEditableBaseline({ ...editableBaseline, baselineMeanGrossWeightKG: Number(e.target.value) })
                  }
                  className="w-full p-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'حفظ خط الأساس' : 'Save Baseline'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
