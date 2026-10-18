import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Flame,
  Factory,
  Clock,
  CheckCircle2,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  TrendingDown,
  Activity,
  ArrowUpRight,
  Info,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  evaluateEfficiencyAlert,
  EfficiencyAlertState,
  getStoredThreshold,
  saveStoredThreshold,
  acknowledgeEfficiencyAlert,
  setEfficiencySimulationMode,
  resetEfficiencyAlertState,
  playSynthesizedAlertBeep,
  AVAILABLE_THRESHOLDS,
  ALERT_DURATION_THRESHOLD_MINUTES,
} from '../services/efficiencyAlertService';

interface EfficiencyAlertBannerProps {
  onNavigateToShredding?: () => void;
  onNavigateToProduction?: () => void;
  onInspectChart?: () => void;
}

export const EfficiencyAlertBanner: React.FC<EfficiencyAlertBannerProps> = ({
  onNavigateToShredding,
  onNavigateToProduction,
  onInspectChart,
}) => {
  const { isRTL } = useLanguage();
  const { shreddingTransactions, productionIssues, setCurrentPage } = useFactory();

  const [threshold, setThreshold] = useState<number>(getStoredThreshold());
  const [alertState, setAlertState] = useState<EfficiencyAlertState>(() =>
    evaluateEfficiencyAlert(shreddingTransactions, productionIssues, threshold)
  );

  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showSimControls, setShowSimControls] = useState<boolean>(false);
  const [isDismissedTemporary, setIsDismissedTemporary] = useState<boolean>(false);
  const [lastBeepMinute, setLastBeepMinute] = useState<number>(-1);

  // Live interval ticker: updates every second for real-time second-by-second countdown & duration
  useEffect(() => {
    const updateTick = () => {
      const updated = evaluateEfficiencyAlert(shreddingTransactions, productionIssues, threshold);
      setAlertState(updated);

      // Play soft audio ping if triggered, unmuted, and not yet acknowledged
      if (
        updated.isAlertTriggered &&
        !updated.acknowledged &&
        !isSoundMuted &&
        updated.durationMinutes !== lastBeepMinute
      ) {
        playSynthesizedAlertBeep();
        setLastBeepMinute(updated.durationMinutes);
      }
    };

    updateTick();
    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [shreddingTransactions, productionIssues, threshold, isSoundMuted, lastBeepMinute]);

  const handleAcknowledge = () => {
    acknowledgeEfficiencyAlert(isRTL ? 'مشرف الوردية' : 'Shift Supervisor');
    setAlertState((prev) => ({
      ...prev,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: isRTL ? 'مشرف الوردية' : 'Shift Supervisor',
    }));
  };

  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    saveStoredThreshold(newThreshold);
    const updated = evaluateEfficiencyAlert(shreddingTransactions, productionIssues, newThreshold);
    setAlertState(updated);
  };

  const handleSimulationMode = (mode: 'NONE' | 'CRITICAL_35MIN' | 'WARNING_15MIN' | 'HEALTHY') => {
    setEfficiencySimulationMode(mode);
    setIsDismissedTemporary(false);
    const updated = evaluateEfficiencyAlert(shreddingTransactions, productionIssues, threshold, mode);
    setAlertState(updated);
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Scroll to hourly efficiency chart
  const handleScrollToChart = () => {
    if (onInspectChart) {
      onInspectChart();
      return;
    }
    const el = document.getElementById('hourly-efficiency-chart-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Jump to shredding module
  const handleGoToShredding = () => {
    if (onNavigateToShredding) {
      onNavigateToShredding();
    } else {
      setCurrentPage('shredding');
    }
  };

  // =========================================================================
  // RENDER: CRITICAL ALERT (Output Efficiency < Threshold for > 30 Minutes)
  // =========================================================================
  if (alertState.isAlertTriggered && !isDismissedTemporary) {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500 bg-gradient-to-br from-rose-950/90 via-slate-950/95 to-slate-900/95 p-5 shadow-[0_0_40px_rgba(244,63,94,0.3)] animate-pulse-slow">
        {/* Animated Background Warning Beacons */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-44 h-44 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rose-500/30">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-inner">
              <ShieldAlert className="w-6 h-6 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[10px] tracking-wider uppercase shadow">
                  {isRTL ? 'تنبيه حرج فوري' : 'CRITICAL REAL-TIME ALERT'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-950 border border-rose-500/50 text-rose-300 font-mono text-[11px] font-bold">
                  {isRTL ? 'كفاءة الثرم مقابل الإنتاج' : 'Shredding vs Production Efficiency'}
                </span>
                {alertState.simulationMode !== 'NONE' && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-950 border border-purple-500/50 text-purple-300 font-mono text-[10px] font-bold">
                    {isRTL ? 'وضع المحاكاة' : 'SIMULATION MODE'}
                  </span>
                )}
              </div>

              <h2 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                <span>
                  {isRTL
                    ? `هبوط كفاءة الثرم (${alertState.currentEfficiencyPct}%) دون الحد الأدنى (${alertState.thresholdPct}%) لأكثر من 30 دقيقة!`
                    : `Output Efficiency (${alertState.currentEfficiencyPct}%) Below Threshold (${alertState.thresholdPct}%) for > 30 Minutes!`}
                </span>
              </h2>
            </div>
          </div>

          {/* Quick Utility Toggles: Sound, Dismiss, Settings */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSoundMuted(!isSoundMuted)}
              className={`p-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                isSoundMuted
                  ? 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-white'
                  : 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
              }`}
              title={isSoundMuted ? (isRTL ? 'تفعيل الصوت' : 'Unmute Alert') : (isRTL ? 'كتم الصوت' : 'Mute Alert')}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-rose-400 animate-pulse" />}
              <span className="text-[11px] hidden sm:inline">{isSoundMuted ? (isRTL ? 'صامت' : 'Muted') : (isRTL ? 'صوت نشط' : 'Audio On')}</span>
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title={isRTL ? 'إعدادات حد الكفاءة' : 'Alert Threshold Settings'}
            >
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] hidden sm:inline">{isRTL ? 'الحد' : 'Threshold'} ({alertState.thresholdPct}%)</span>
            </button>

            <button
              onClick={() => setShowSimControls(!showSimControls)}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-purple-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              title={isRTL ? 'أدوات المحاكاة والاختبار' : 'Simulation & QA Controls'}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-[11px] hidden sm:inline">{isRTL ? 'محاكاة' : 'Simulate'}</span>
            </button>

            <button
              onClick={() => setIsDismissedTemporary(true)}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
              title={isRTL ? 'إخفاء مؤقت' : 'Dismiss temporarily'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-Time Duration Badge & Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          {/* Continuous Duration */}
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40">
            <div className="flex items-center justify-between text-[11px] text-rose-300 font-bold mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                {isRTL ? 'مدة الهبوط المستمر' : 'Continuous Duration'}
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            </div>
            <div className="text-xl font-black font-mono text-white flex items-baseline gap-1">
              <span>{formatDuration(alertState.durationSeconds)}</span>
            </div>
            <p className="text-[10px] text-rose-400 mt-0.5">
              {isRTL
                ? `تجاوز مهلة الـ 30 دقيقة المحددة بـ (${alertState.durationMinutes - ALERT_DURATION_THRESHOLD_MINUTES} دقيقة)`
                : `Exceeded 30-min threshold by +${alertState.durationMinutes - ALERT_DURATION_THRESHOLD_MINUTES}m`}
            </p>
          </div>

          {/* Current Efficiency vs Threshold */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center justify-between">
              <span>{isRTL ? 'كفاءة التدفق الحالية' : 'Current Efficiency'}</span>
              <span className="font-mono text-rose-400 font-bold">-{alertState.thresholdPct - alertState.currentEfficiencyPct}%</span>
            </div>
            <div className="text-xl font-black font-mono text-rose-400 flex items-baseline gap-1.5">
              <span>{alertState.currentEfficiencyPct}%</span>
              <span className="text-xs text-slate-400 font-normal">/ {alertState.thresholdPct}% {isRTL ? 'الحد الأدنى' : 'min'}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-rose-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, alertState.currentEfficiencyPct)}%` }}
              />
            </div>
          </div>

          {/* Shredding Output Rate */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'إنتاج مفروم الثرم (SHR)' : 'Shredder Output'}</span>
            </div>
            <div className="text-xl font-black font-mono text-amber-300">
              {alertState.shreddingRateKGh.toLocaleString()} <span className="text-xs font-normal text-slate-400">KG/h</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {isRTL ? 'معدل سحق البلاستيك الحالي' : 'Active regrind milling'}
            </p>
          </div>

          {/* Production Line Draw & Deficit */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
            <div className="text-[11px] text-slate-400 font-bold mb-1 flex items-center gap-1">
              <Factory className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'سحب خطوط البثق (EXT)' : 'Extruder Draw'}</span>
            </div>
            <div className="text-xl font-black font-mono text-cyan-300">
              {alertState.productionDrawKGh.toLocaleString()} <span className="text-xs font-normal text-slate-400">KG/h</span>
            </div>
            <p className="text-[10px] text-rose-400 font-mono font-bold mt-0.5">
              {isRTL ? 'عجز التغذية:' : 'Deficit:'} {alertState.deficitKGh} KG/h
            </p>
          </div>
        </div>

        {/* Diagnosis & Operational Guidance */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/30 text-xs mb-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200 leading-relaxed">
                {isRTL ? alertState.diagnosisAr : alertState.diagnosisEn}
              </p>
              <p className="text-rose-300/90 font-medium">
                <span className="font-bold text-rose-400">{isRTL ? 'الإجراء التشغيلي الفوري الموصى به: ' : 'Recommended Immediate Action: '}</span>
                {isRTL ? alertState.recommendedActionAr : alertState.recommendedActionEn}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {alertState.acknowledged ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {isRTL
                    ? `تم الإقرار بواسطة ${alertState.acknowledgedBy} (${new Date(alertState.acknowledgedAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                    : `Acknowledged by ${alertState.acknowledgedBy} at ${new Date(alertState.acknowledgedAt || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              </div>
            ) : (
              <button
                onClick={handleAcknowledge}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRTL ? 'إقرار واستلام التنبيه' : 'Acknowledge Alert'}</span>
              </button>
            )}

            <button
              onClick={handleScrollToChart}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'معاينة المخطط الساعي (Recharts)' : 'Inspect Hourly Chart'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleGoToShredding}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 font-bold text-xs border border-amber-500/40 transition-all cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>{isRTL ? 'فتح وحدة الثرم (SHR-360)' : 'Open Shredding Line'}</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {isRTL ? 'آخر فحص حي:' : 'Telemetry check:'} {new Date(alertState.lastEvaluatedAt).toLocaleTimeString()}
          </div>
        </div>

        {/* Collapsible Threshold Settings */}
        {showSettings && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900/95 border border-cyan-500/40 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" />
                {isRTL ? 'تعديل حد كفاءة الثرم مقابل الإنتاج' : 'Configure Output Efficiency Threshold'}
              </span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRTL
                ? 'يتم إطلاق التنبيه المرئي فور استمرار انخفاض النسبة المئوية لكفاءة تدفق المفروم عن هذا الحد لأكثر من 30 دقيقة متواصلة.'
                : 'Triggers continuous visual alarm if output efficiency remains below this percentage for more than 30 consecutive minutes.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {AVAILABLE_THRESHOLDS.map((val) => (
                <button
                  key={val}
                  onClick={() => handleThresholdChange(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    threshold === val
                      ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-white/5'
                  }`}
                >
                  {val}% {val === 75 ? (isRTL ? '(الافتراضي)' : '(Default)') : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible QA & Simulation Controls */}
        {showSimControls && (
          <div className="mt-4 p-4 rounded-xl bg-purple-950/70 border border-purple-500/40 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {isRTL ? 'محاكاة واختبار التنبيه الحرج (QA Testing)' : 'Simulation & Real-Time Alert QA'}
              </span>
              <button
                onClick={() => setShowSimControls(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-purple-200/80">
              {isRTL
                ? 'يتيح لك تجربة سيناريوهات الهبوط لأكثر من 30 دقيقة، العد التنازلي للتنبيه، أو إعادة الوضع الطبيعي فورياً للتأكد من سلوك التنبيه.'
                : 'Allows testing scenarios: >30 min critical drop, arming countdown, or nominal healthy recovery instantly.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleSimulationMode('CRITICAL_35MIN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  alertState.simulationMode === 'CRITICAL_35MIN'
                    ? 'bg-rose-600 text-white shadow'
                    : 'bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-500/30'
                }`}
              >
                🔴 {isRTL ? 'محاكاة هبوط 36 دقيقة (61%)' : 'Simulate 36m Critical Drop (61%)'}
              </button>

              <button
                onClick={() => handleSimulationMode('WARNING_15MIN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  alertState.simulationMode === 'WARNING_15MIN'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-500/30'
                }`}
              >
                🟡 {isRTL ? 'محاكاة انخفاض 15 دقيقة (68%)' : 'Simulate 15m Arming Dip (68%)'}
              </button>

              <button
                onClick={() => handleSimulationMode('HEALTHY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  alertState.simulationMode === 'HEALTHY'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/30'
                }`}
              >
                🟢 {isRTL ? 'محاكاة تعافي وكفاءة ممتازة (104%)' : 'Simulate Recovery (104%)'}
              </button>

              <button
                onClick={() => handleSimulationMode('NONE')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer border border-white/10"
              >
                {isRTL ? 'الرجوع للبيانات الحية' : 'Reset to Live Telemetry'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // RENDER: WARNING / ARMING STATE (Output Efficiency < Threshold for < 30 Mins)
  // =========================================================================
  if (alertState.isWarningArming && !isDismissedTemporary) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-950/70 via-slate-950/90 to-slate-900/90 p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Clock className="w-5 h-5 animate-spin-slow" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono text-[10px] font-bold">
                  {isRTL ? 'انخفاض تحت المراقبة' : 'EFFICIENCY MONITORING'}
                </span>
                <span className="text-xs text-amber-200 font-bold">
                  {isRTL
                    ? `الكفاءة (${alertState.currentEfficiencyPct}%) دون الحد (${alertState.thresholdPct}%) منذ ${alertState.durationMinutes} دقيقة`
                    : `Efficiency (${alertState.currentEfficiencyPct}%) below threshold (${alertState.thresholdPct}%) for ${alertState.durationMinutes}m`}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {isRTL
                  ? `يتبقى ${formatCountdown(alertState.armRemainingSeconds)} دقيقة قبل إطلاق التنبيه الحرج إذا استمر الهبوط.`
                  : `Critical alert will fire in ${formatCountdown(alertState.armRemainingSeconds)} if rate is not rebalanced.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleScrollToChart}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-white/10 cursor-pointer flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isRTL ? 'فحص التدفق' : 'Inspect Flow'}</span>
            </button>

            <button
              onClick={() => handleSimulationMode('CRITICAL_35MIN')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
              title={isRTL ? 'اختبار تفعيل التنبيه الحرج (>30 دقيقة)' : 'Trigger 30+ min alert test'}
            >
              {isRTL ? 'اختبار التنبيه الحرج (>30 د)' : 'Test >30m Alert'}
            </button>

            <button
              onClick={() => setIsDismissedTemporary(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: NOMINAL / HEALTHY STATE (Subtle status ribbon with quick test controls)
  // =========================================================================
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-400">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <span className="text-slate-300 font-bold">
            {isRTL ? 'نظام مراقبة كفاءة الثرم والإنتاج (Real-Time Monitor):' : 'Shredding vs Production Efficiency Monitor:'}
          </span>
          <span className="text-emerald-400 font-mono font-bold mx-1.5">
            {alertState.currentEfficiencyPct}%
          </span>
          <span className="text-slate-500">
            ({isRTL ? `الحد المعتمد: ${alertState.thresholdPct}% | تنبيه >30 دقيقة` : `Target: ≥${alertState.thresholdPct}% | 30-min rule`})
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleSimulationMode('CRITICAL_35MIN')}
          className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-500/30 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
          title={isRTL ? 'تجربة إطلاق التنبيه الحرج لهبوط الكفاءة لأكثر من 30 دقيقة' : 'Simulate >30 min critical efficiency drop to test visual alert'}
        >
          <Sparkles className="w-3 h-3 text-rose-400" />
          <span>{isRTL ? 'تجربة تنبيه الـ 30 دقيقة' : 'Test >30m Alert'}</span>
        </button>

        <button
          onClick={handleScrollToChart}
          className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold border border-white/10 cursor-pointer flex items-center gap-1"
        >
          <span>{isRTL ? 'المخطط الساعي' : 'Hourly Chart'}</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
