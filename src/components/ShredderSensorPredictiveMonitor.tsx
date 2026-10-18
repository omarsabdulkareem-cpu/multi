import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  AlertOctagon,
  Zap,
  Activity,
  CheckCircle2,
  TrendingUp,
  Sliders,
  Gauge,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Flame,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Bell,
  Clock,
  Settings,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  ShredderPredictiveAnalysis,
  ShredderSensorReading,
  evaluateShredderSensorPredictive,
  triggerSensorSimulationScenario,
  clearShredderSensorAlert,
  getStoredShredderBaseline,
  saveShredderBaseline,
  ShredderSensorBaseline,
} from '../services/shredderSensorPredictiveService';
import { EVENT_MAINTENANCE_ALERT_TRIGGERED } from '../services/maintenanceAlertService';

interface ShredderSensorPredictiveMonitorProps {
  onNavigateToMaintenanceAlerts?: () => void;
  compact?: boolean;
}

export const ShredderSensorPredictiveMonitor: React.FC<ShredderSensorPredictiveMonitorProps> = ({
  onNavigateToMaintenanceAlerts,
  compact = false,
}) => {
  const { isRTL, t } = useLanguage();
  const { setCurrentPage, currentUser } = useFactory();

  // Core analysis state
  const [analysis, setAnalysis] = useState<ShredderPredictiveAnalysis>(() =>
    evaluateShredderSensorPredictive()
  );

  // Live telemetry streaming state
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [streamTicks, setStreamTicks] = useState(0);

  // Calibration Drawer/Modal
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [baselineForm, setBaselineForm] = useState<ShredderSensorBaseline>(() =>
    getStoredShredderBaseline()
  );

  // Expanded card details
  const [isBladeDetailsOpen, setIsBladeDetailsOpen] = useState(true);
  const [isMotorDetailsOpen, setIsMotorDetailsOpen] = useState(true);
  const [isSandboxOpen, setIsSandboxOpen] = useState(true);

  // Status feedback toast
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Re-evaluate telemetry on window events or streaming ticks
  useEffect(() => {
    const handleAlertChange = () => {
      setAnalysis(evaluateShredderSensorPredictive());
    };

    window.addEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleAlertChange);
    return () => {
      window.removeEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleAlertChange);
    };
  }, []);

  // Live telemetry ticker
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setStreamTicks((prev) => prev + 1);
      setAnalysis(evaluateShredderSensorPredictive());
    }, 4500);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Handle Scenario trigger
  const handleScenario = (
    scenario: 'NORMAL' | 'MILD_SPIKES' | 'BLADE_DULLNESS' | 'CRITICAL_SURGE' | 'ROTOR_JAM'
  ) => {
    const updated = triggerSensorSimulationScenario(scenario);
    setAnalysis(updated);

    const scenarioLabels: Record<string, { ar: string; en: string }> = {
      NORMAL: { ar: 'تم تفعيل سيناريو الشفرات الحادة والحمل الطبيعي', en: 'Sharp knives & normal load scenario activated' },
      MILD_SPIKES: { ar: 'تم تفعيل سيناريو قفزات كتل السكراب الخفيفة', en: 'Mild purge lump current spikes scenario activated' },
      BLADE_DULLNESS: { ar: '⚠️ تم تفعيل سيناريو تآكل الشفرات المتقدم (تحذير صيانة)', en: '⚠️ Advanced blade wear scenario activated (Service required)' },
      CRITICAL_SURGE: { ar: '🚨 تم تفعيل سيناريو قفزات التيار الحرجة وتآكل السكاكين الحاد', en: '🚨 Critical current surges & blade wear scenario activated' },
      ROTOR_JAM: { ar: '🔥 تم تفعيل سيناريو انحشار الدوار وارتفاع تيار المحرك الخطر', en: '🔥 Rotor jam & extreme motor overload scenario activated' },
    };

    setActionFeedback(isRTL ? scenarioLabels[scenario].ar : scenarioLabels[scenario].en);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Reset to Healthy
  const handleResetToHealthy = () => {
    clearShredderSensorAlert();
    const clean = evaluateShredderSensorPredictive();
    setAnalysis(clean);
    setActionFeedback(
      isRTL
        ? 'تمت إعادة ضبط المستشعرات إلى الحالة المعيارية السليمة ومزامنة تغذية الصيانة'
        : 'Sensors reset to healthy baseline and maintenance feed updated.'
    );
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Save Baseline Calibration
  const handleSaveBaseline = (e: React.FormEvent) => {
    e.preventDefault();
    saveShredderBaseline(baselineForm);
    setIsCalibrationOpen(false);
    setAnalysis(evaluateShredderSensorPredictive(undefined, baselineForm));
    setActionFeedback(
      isRTL ? 'تم حفظ وضبط المعايير التشغيلية للمستشعرات بنجاح' : 'Sensor operational baseline calibrated successfully.'
    );
    setTimeout(() => setActionFeedback(null), 3500);
  };

  // Navigate to full maintenance alerts
  const handleGoToMaintenanceAlerts = () => {
    if (onNavigateToMaintenanceAlerts) {
      onNavigateToMaintenanceAlerts();
    } else {
      setCurrentPage('maintenance_alerts');
    }
  };

  const { alertLevel, overallHealthScore, degradationPct, bladeWear, motorHealth, recentReadings, activeNotification } =
    analysis;

  // Chart telemetry formatting
  const chartData = useMemo(() => {
    return recentReadings.map((r) => ({
      time: r.timeLabel,
      currentA: r.loadCurrentA,
      motorTemp: r.motorTempC,
      vibration: r.vibrationMmS,
      powerKW: r.activePowerKW,
      isSpike: r.isSpike,
      spikeSeverity: r.spikeSeverity,
    }));
  }, [recentReadings]);

  // Alert badge colors
  const alertColorConfig = {
    HEALTHY: {
      bg: 'bg-emerald-950/80',
      border: 'border-emerald-500/50',
      text: 'text-emerald-300',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      icon: CheckCircle2,
      labelAr: 'المستشعرات بحالة مثالية (شفرات حادة وتيار طبيعي)',
      labelEn: 'Sensors Healthy: Sharp Knives & Stable Current',
    },
    SCHEDULED_ATTENTION: {
      bg: 'bg-amber-950/60',
      border: 'border-amber-500/40',
      text: 'text-amber-300',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: AlertTriangle,
      labelAr: 'متابعة دورية: بداية تآكل خفيف في حد السكاكين',
      labelEn: 'Scheduled Attention: Early Blade Dullness',
    },
    PROACTIVE_SERVICE_REQUIRED: {
      bg: 'bg-orange-950/70',
      border: 'border-orange-500/60',
      text: 'text-orange-300',
      badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      icon: AlertTriangle,
      labelAr: 'صيانة استباقية مطلوبة: قفزات تيار وتآكل شفرات متقدم',
      labelEn: 'Proactive Service Required: Frequent Current Spikes',
    },
    CRITICAL_FAILURE_IMMINENT: {
      bg: 'bg-rose-950/90',
      border: 'border-rose-500/80',
      text: 'text-rose-200',
      badge: 'bg-rose-500/30 text-rose-200 border-rose-500/60 animate-pulse',
      icon: AlertOctagon,
      labelAr: '🚨 خطر عطل وشيك: قفزات تيار حرجة وتآكل سكاكين حاد (>170A)',
      labelEn: '🚨 Critical Failure Imminent: High Current Surges (>170A)',
    },
  }[alertLevel];

  const AlertIcon = alertColorConfig.icon;

  return (
    <div className="space-y-6">
      {/* Top Banner & Status Feedback */}
      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-cyan-950/90 border border-cyan-500/60 text-cyan-200 flex items-center justify-between text-xs shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-semibold">{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-cyan-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main Sensor Intelligence Header */}
      <div
        className={`p-5 rounded-2xl border shadow-2xl transition-all ${alertColorConfig.bg} ${alertColorConfig.border}`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-900 text-slate-300 border border-slate-700">
                SENSOR-PREDICT-SHR-360
              </span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${alertColorConfig.badge}`}
              >
                <AlertIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{isRTL ? alertColorConfig.labelAr : alertColorConfig.labelEn}</span>
              </span>
              {activeNotification && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-900/60 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <Bell className="w-3 h-3 text-rose-400 animate-bounce" />
                  <span>{isRTL ? 'مرتبط بتغذية إنذارات الصيانة' : 'Synced with Maintenance Feed'}</span>
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span>
                {isRTL
                  ? 'مراقب مستشعرات تآكل الشفرات وقفزات تيار المحرك (75kW)'
                  : 'Rotary Blade Wear & Motor Current Spikes Telemetry Monitor'}
              </span>
            </h3>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              {isRTL
                ? 'خوارزمية تنبؤية ذكية تحلل قفزات الأمبير (Load Current Spikes) واهتزازات المحامل لتوقع معدل تآكل شفرات الدوار D2 واحتراق ملفات المحرك وتفادي توقف خط الثرم المفاجئ.'
                : 'Predictive intelligence engine correlating stator load current spikes (A) and vibration telemetry to forecast D2 cutting knife dullness and motor thermal breakdown before unscheduled downtime.'}
            </p>
          </div>

          {/* Quick Actions & Telemetry Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                isLiveStreaming
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title={isRTL ? 'إيقاف/تشغيل قراءة المستشعرات اللحظية' : 'Toggle live telemetry streaming'}
            >
              {isLiveStreaming ? <Pause className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isLiveStreaming ? (isRTL ? 'بث حي نشط' : 'Live Streaming') : (isRTL ? 'متوقف' : 'Paused')}</span>
            </button>

            <button
              onClick={() => setIsCalibrationOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title={isRTL ? 'معايرة الحدود التشغيلية للمستشعرات' : 'Calibrate sensor thresholds'}
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'المعايرة' : 'Calibrate'}</span>
            </button>

            <button
              onClick={handleGoToMaintenanceAlerts}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{isRTL ? 'تغذية إنذارات الصيانة' : 'Maintenance Alerts'}</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </button>
          </div>
        </div>

        {/* Predictive KPI Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-white/10">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'مؤشر الصحة التنبؤية' : 'Health Score'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-black ${
                  overallHealthScore >= 75
                    ? 'text-emerald-400'
                    : overallHealthScore >= 45
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {overallHealthScore}%
              </span>
              <span className="text-[10px] text-slate-500">
                {overallHealthScore >= 75 ? (isRTL ? 'سليم' : 'Healthy') : (isRTL ? 'إجهاد' : 'Stressed')}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'أعلى قفزة تيار مسجلة' : 'Peak Current Spike'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-black ${
                  motorHealth.peakSpikeCurrentA >= 170
                    ? 'text-rose-400 animate-pulse'
                    : motorHealth.peakSpikeCurrentA >= 145
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {motorHealth.peakSpikeCurrentA}
              </span>
              <span className="text-[10px] text-slate-400">A</span>
              <span className="text-[9px] text-slate-500">
                ({isRTL ? `الحد ${analysis.baseline.criticalSpikeThresholdA}A` : `Limit ${analysis.baseline.criticalSpikeThresholdA}A`})
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'تآكل سكاكين الدوار D2' : 'Rotor Knife Wear'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-black ${
                  bladeWear.edgeWearPct >= 80
                    ? 'text-rose-400'
                    : bladeWear.edgeWearPct >= 60
                    ? 'text-amber-400'
                    : 'text-cyan-400'
                }`}
              >
                {bladeWear.edgeWearPct}%
              </span>
              <span className="text-[10px] text-slate-400">
                ({bladeWear.clearanceGapMm}mm)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'ساعات متبقية للشفرات' : 'Knives TTF (Hours)'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-black ${
                  bladeWear.estimatedHoursRemaining <= 24 ? 'text-rose-400' : 'text-slate-200'
                }`}
              >
                {bladeWear.estimatedHoursRemaining}
              </span>
              <span className="text-[10px] text-slate-400">{isRTL ? 'ساعة تشغيل' : 'hrs'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'حرارة ملفات المحرك' : 'Motor Winding Temp'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-black ${
                  motorHealth.windingTempC >= 85
                    ? 'text-rose-400'
                    : motorHealth.windingTempC >= 75
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {motorHealth.windingTempC}°C
              </span>
              <span className="text-[10px] text-slate-500">
                ({motorHealth.vibrationMmS} mm/s)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block font-medium">
              {isRTL ? 'احتمالية تعطل المحرك' : 'Motor Failure Risk'}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-xl font-black ${
                  motorHealth.motorFailureProbability >= 60
                    ? 'text-rose-400'
                    : motorHealth.motorFailureProbability >= 30
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {motorHealth.motorFailureProbability}%
              </span>
              <span className="text-[10px] text-slate-500">
                ({isRTL ? 'وفورات' : 'Saved'} ${analysis.estimatedCostSavingsUSD})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Waveform Recharts Graph */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>
                {isRTL
                  ? 'رسم بياني لحظي لتيار المحرك (Amperes) وقفزات الحمل مع عتبات الخطر'
                  : 'Real-Time Load Current (Amperes) Waveform & Surge Thresholds'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isRTL
                ? 'مراقبة التغير المستمر في سحب التيار مع تحديد قفزات الصدمات الحرجة عند احتكاك الشفرات المتآكلة أو الكتل الكبيرة'
                : 'Continuous monitoring of RMS stator amperage; flags spikes when worn blades pinch dense polymer lumps.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-cyan-400 rounded" />
              <span>{isRTL ? 'تيار الحمل (A)' : 'Load Current (A)'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-400 border-dashed" />
              <span>{isRTL ? 'تحذير (145A)' : 'Warning (145A)'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-rose-500" />
              <span>{isRTL ? 'حرج (>170A)' : 'Critical (>170A)'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-slate-500" />
              <span>{isRTL ? 'الاسمي (135A)' : 'Nominal FLA (135A)'}</span>
            </div>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => v.slice(3, 8)}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10 }}
                domain={[80, 220]}
                unit="A"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as any;
                    return (
                      <div className="p-3 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl text-xs space-y-1">
                        <div className="font-mono text-slate-400 text-[10px]">{data.time}</div>
                        <div className="font-bold text-white flex items-center justify-between gap-4">
                          <span>{isRTL ? 'تيار المحرك:' : 'Current:'}</span>
                          <span
                            className={
                              data.currentA >= 170
                                ? 'text-rose-400 font-black'
                                : data.currentA >= 145
                                ? 'text-amber-400 font-bold'
                                : 'text-cyan-400'
                            }
                          >
                            {data.currentA} A
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
                          <span>{isRTL ? 'القدرة الكهربائية:' : 'Active Power:'}</span>
                          <span>{data.powerKW} kW</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
                          <span>{isRTL ? 'حرارة المحرك:' : 'Motor Temp:'}</span>
                          <span className={data.motorTemp >= 80 ? 'text-rose-400' : 'text-slate-300'}>
                            {data.motorTemp} °C
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
                          <span>{isRTL ? 'اهتزاز المحامل:' : 'Vibration:'}</span>
                          <span>{data.vibration} mm/s</span>
                        </div>
                        {data.isSpike && (
                          <div className="mt-1 pt-1 border-t border-white/10 text-rose-400 font-bold text-[10px] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>
                              {data.spikeSeverity === 'CRITICAL'
                                ? isRTL
                                  ? 'قفزة تيار حرجة (>170A)!'
                                  : 'Critical current surge!'
                                : isRTL
                                ? 'قفزة تيار متوسطة (>145A)'
                                : 'Moderate current spike'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Reference Lines */}
              <ReferenceLine
                y={analysis.baseline.nominalRunningCurrentA}
                stroke="#475569"
                strokeDasharray="2 2"
                label={{
                  value: isRTL ? 'المثالي 105A' : 'Nominal 105A',
                  fill: '#64748b',
                  fontSize: 9,
                  position: 'insideBottomLeft',
                }}
              />
              <ReferenceLine
                y={analysis.baseline.fullLoadAmps}
                stroke="#64748b"
                strokeDasharray="3 3"
                label={{
                  value: 'FLA 135A',
                  fill: '#94a3b8',
                  fontSize: 9,
                  position: 'insideTopLeft',
                }}
              />
              <ReferenceLine
                y={analysis.baseline.warningSpikeThresholdA}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: isRTL ? 'تحذير 145A' : 'Warn 145A',
                  fill: '#f59e0b',
                  fontSize: 9,
                  position: 'insideTopRight',
                }}
              />
              <ReferenceLine
                y={analysis.baseline.criticalSpikeThresholdA}
                stroke="#f43f5e"
                strokeWidth={1.5}
                label={{
                  value: isRTL ? 'خطر حرج 170A' : 'Critical 170A',
                  fill: '#f43f5e',
                  fontSize: 9,
                  position: 'insideTopRight',
                }}
              />

              {/* Telemetry wave */}
              <Line
                type="monotone"
                dataKey="currentA"
                stroke="#22d3ee"
                strokeWidth={2.2}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (payload.currentA >= 170) {
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={4.5}
                        fill="#f43f5e"
                        stroke="#fff"
                        strokeWidth={1.5}
                        className="animate-pulse"
                      />
                    );
                  }
                  if (payload.currentA >= 145) {
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill="#f59e0b"
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    );
                  }
                  return null;
                }}
                activeDot={{ r: 5, fill: '#38bdf8' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dual Predictive Deep-Dive Cards: Blade Wear & Motor Failure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CARD 1: Blade Wear Forecast */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isRTL ? 'تنبؤات تآكل سكاكين الدوار D2' : 'D2 Rotary Knife Wear Forecast'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isRTL ? 'حساب حدة السكاكين وخلوص القطع مع السكاكين الثابتة' : 'Edge sharpness index & bedknife shear gap dilation'}
                </p>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                bladeWear.wearStatus === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : bladeWear.wearStatus === 'ELEVATED'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {bladeWear.wearStatus === 'CRITICAL'
                ? isRTL
                  ? 'تآكل حرج'
                  : 'Critical Wear'
                : bladeWear.wearStatus === 'ELEVATED'
                ? isRTL
                  ? 'تآكل متقدم'
                  : 'Elevated Wear'
                : isRTL
                ? 'شفرات حادة'
                : 'Sharp'}
            </span>
          </div>

          {/* Knife Wear Gauge Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">
                {isRTL ? 'نسبة استهلاك حد السكاكين D2:' : 'Rotor Knife Wear:'}
              </span>
              <span
                className={`font-black font-mono ${
                  bladeWear.edgeWearPct >= 80 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {bladeWear.edgeWearPct}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  bladeWear.edgeWearPct >= 85
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                    : bladeWear.edgeWearPct >= 65
                    ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                }`}
                style={{ width: `${Math.min(100, bladeWear.edgeWearPct)}%` }}
              />
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'خلوص الشفرات المحسوب' : 'Clearance Gap'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    bladeWear.clearanceGapMm >= 0.65 ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {bladeWear.clearanceGapMm}
                </span>
                <span className="text-[10px] text-slate-400">mm</span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'الخلوص القياسي 0.25 مم' : 'Standard gap: 0.25mm'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'مؤشر حدة القطع' : 'Cutting Sharpness'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    bladeWear.bladeSharpnessIndex <= 30 ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  {bladeWear.bladeSharpnessIndex}%
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'كفاءة القص النظيف' : 'Shear edge efficiency'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'العمر التشغيلي المتبقي' : 'Blade TTF'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    bladeWear.estimatedHoursRemaining <= 20 ? 'text-rose-400' : 'text-amber-300'
                  }`}
                >
                  {bladeWear.estimatedHoursRemaining}
                </span>
                <span className="text-[10px] text-slate-400">{isRTL ? 'ساعة' : 'hrs'}</span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? `الموعد المتوقع: ${bladeWear.projectedServiceDate}` : `Due: ${bladeWear.projectedServiceDate}`}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'خطر الحبيبات غير المنتظمة' : 'Regrind Inconsistency'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    bladeWear.edgeWearPct >= 75 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {bladeWear.edgeWearPct >= 75 ? (isRTL ? 'مرتفع' : 'High') : (isRTL ? 'منخفض' : 'Low')}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'احتكاك وضغط بدل القص' : 'Pinching instead of shearing'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
            <span className="font-bold text-slate-300 block mb-0.5">
              {isRTL ? 'تقييم مخاطر السكاكين:' : 'Blade Risk Assessment:'}
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isRTL ? bladeWear.riskAssessmentAr : bladeWear.riskAssessmentEn}
            </p>
          </div>
        </div>

        {/* CARD 2: Motor Health & Failure Forecast */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isRTL ? 'تنبؤات سلامة المحرك الكهربائي (75kW)' : 'Electric Motor & Drive Health Forecast'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isRTL ? 'تحليل الإجهاد الحراري للملفات واهتزازات المحامل' : 'Winding thermal stress & rotor bearing vibration telemetry'}
                </p>
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                motorHealth.motorStatus === 'CRITICAL'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : motorHealth.motorStatus === 'WARNING'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {motorHealth.motorStatus === 'CRITICAL'
                ? isRTL
                  ? 'إجهاد حرج'
                  : 'Critical Overload'
                : motorHealth.motorStatus === 'WARNING'
                ? isRTL
                  ? 'تحذير حراري'
                  : 'Thermal Warning'
                : isRTL
                ? 'سليم وطبيعي'
                : 'Healthy'}
            </span>
          </div>

          {/* Motor Failure Probability Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">
                {isRTL ? 'احتمالية تعطل المحرك / الانهيار العزلي:' : 'Motor Failure Risk:'}
              </span>
              <span
                className={`font-black font-mono ${
                  motorHealth.motorFailureProbability >= 60 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {motorHealth.motorFailureProbability}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  motorHealth.motorFailureProbability >= 70
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                    : motorHealth.motorFailureProbability >= 35
                    ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                }`}
                style={{ width: `${Math.min(100, motorHealth.motorFailureProbability)}%` }}
              />
            </div>
          </div>

          {/* Motor Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'قفزات التيار في 10 دقائق' : 'Spikes (10 Min)'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    motorHealth.spikeCountLast10Min >= 5 ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {motorHealth.spikeCountLast10Min}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({motorHealth.spikeFrequencyPerHour}/h)
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'تردد ضربات العزم' : 'Torque shock frequency'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'حرارة الملفات المقاسة' : 'Winding Temperature'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    motorHealth.windingTempC >= 85 ? 'text-rose-400' : 'text-amber-300'
                  }`}
                >
                  {motorHealth.windingTempC}°C
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'الحد الأقصى المسموح 88°C' : 'Max limit: 88°C'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'اهتزاز كراسي المحامل' : 'Bearing Vibration'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    motorHealth.vibrationMmS >= 5.5 ? 'text-rose-400' : 'text-cyan-300'
                  }`}
                >
                  {motorHealth.vibrationMmS}
                </span>
                <span className="text-[10px] text-slate-400">mm/s</span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'المعيار الطبيعي < 4.5' : 'Safe baseline < 4.5'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
              <span className="text-slate-400 text-[10px] block">
                {isRTL ? 'مؤشر الإجهاد الحراري I²t' : 'Thermal Stress Index'}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span
                  className={`text-lg font-black font-mono ${
                    motorHealth.thermalStressIndex >= 75 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {motorHealth.thermalStressIndex}%
                </span>
              </div>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {isRTL ? 'تراكم الحرارة في الأسلاك' : 'Stator winding heating'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
            <span className="font-bold text-slate-300 block mb-0.5">
              {isRTL ? 'تقييم سلامة المحرك الكهربائي:' : 'Motor Health Assessment:'}
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              {isRTL ? motorHealth.riskAssessmentAr : motorHealth.riskAssessmentEn}
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Engineering Recommendation & Spare Parts Box */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <h4 className="text-sm font-bold text-white">
              {isRTL ? 'التوصيات الفنية وقطع الغيار المطلوبة (Maintenance Actions)' : 'Prescriptive Action & Recommended Spare Parts'}
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            {isRTL ? `الموثوقية التنبؤية: ${analysis.confidenceScore}%` : `Confidence: ${analysis.confidenceScore}%`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-semibold mb-1">
              {isRTL ? 'الإجراء الوقائي الموصى به للمشغل والفني:' : 'Recommended Action:'}
            </span>
            <p className="text-slate-200 font-medium leading-relaxed">
              {isRTL ? analysis.recommendedActionAr : analysis.recommendedActionEn}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block text-[11px] font-semibold mb-1">
              {isRTL ? 'قطع الغيار ومستلزمات الصيانة:' : 'Prescribed Spare Parts & Tools:'}
            </span>
            <p className="text-slate-200 font-medium leading-relaxed">
              {isRTL ? analysis.recommendedPartsAr : analysis.recommendedPartsEn}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Simulation Sandbox (for testing spikes, blade wear & alerts) */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {isRTL ? 'محاكي سيناريوهات المستشعرات والقفزات (Interactive Sandbox)' : 'Sensor & Current Spike Simulation Sandbox'}
            </h4>
          </div>
          <button
            onClick={() => setIsSandboxOpen(!isSandboxOpen)}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
          >
            <span>{isSandboxOpen ? (isRTL ? 'إخفاء' : 'Hide') : (isRTL ? 'إظهار' : 'Show')}</span>
            {isSandboxOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isSandboxOpen && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'اختبر خوارزمية التنبؤ وتوليد الإنذارات في تغذية الصيانة عبر محاكاة أنماط الأحمال المختلفة:'
                : 'Simulate load variations to test predictive algorithms, current waveform spikes, and automatic alerts dispatching to MaintenanceAlerts:'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              <button
                onClick={() => handleScenario('NORMAL')}
                className="p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-xs font-semibold text-left rtl:text-right transition-colors cursor-pointer"
              >
                <div className="font-bold text-emerald-300">1. {isRTL ? 'شفرات حادة سليمة' : 'Sharp Knives'}</div>
                <div className="text-[10px] text-slate-400 mt-1">95A - 110A ({isRTL ? 'طبيعي' : 'Healthy'})</div>
              </button>

              <button
                onClick={() => handleScenario('MILD_SPIKES')}
                className="p-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-200 text-xs font-semibold text-left rtl:text-right transition-colors cursor-pointer"
              >
                <div className="font-bold text-cyan-300">2. {isRTL ? 'قفزات كتل خفيفة' : 'Mild Purge Spikes'}</div>
                <div className="text-[10px] text-slate-400 mt-1">~142A ({isRTL ? 'تآكل 58%' : '58% wear'})</div>
              </button>

              <button
                onClick={() => handleScenario('BLADE_DULLNESS')}
                className="p-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-200 text-xs font-semibold text-left rtl:text-right transition-colors cursor-pointer"
              >
                <div className="font-bold text-amber-300">3. {isRTL ? 'تآكل شفرات متقدم' : 'Blade Dullness'}</div>
                <div className="text-[10px] text-slate-400 mt-1">~165A ({isRTL ? 'تحذير صيانة' : 'Warning'})</div>
              </button>

              <button
                onClick={() => handleScenario('CRITICAL_SURGE')}
                className="p-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-semibold text-left rtl:text-right transition-colors cursor-pointer"
              >
                <div className="font-bold text-rose-300">4. {isRTL ? 'قفزات حرجة خطرة' : 'Critical Surges'}</div>
                <div className="text-[10px] text-slate-400 mt-1">&gt;180A ({isRTL ? 'إنذار حرج' : 'Critical'})</div>
              </button>

              <button
                onClick={() => handleScenario('ROTOR_JAM')}
                className="p-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/60 text-red-200 text-xs font-semibold text-left rtl:text-right transition-colors cursor-pointer"
              >
                <div className="font-bold text-red-300">5. {isRTL ? 'انحشار الدوار' : 'Rotor Jam Overload'}</div>
                <div className="text-[10px] text-slate-400 mt-1">&gt;210A ({isRTL ? 'خطر احتراق' : 'Trip risk'})</div>
              </button>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={handleResetToHealthy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isRTL ? 'إعادة ضبط المستشعرات إلى الحالة الطبيعية' : 'Reset to Healthy Baseline'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sensor Baseline Calibration Drawer/Modal */}
      {isCalibrationOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {isRTL ? 'معايرة عتبات مستشعرات مفرمة الثرم 360' : 'Calibrate Shredder Sensor Thresholds'}
                </h3>
              </div>
              <button onClick={() => setIsCalibrationOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBaseline} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">
                    {isRTL ? 'تيار الحمل الكامل FLA (أمبير):' : 'Full Load Amps FLA (A):'}
                  </label>
                  <input
                    type="number"
                    value={baselineForm.fullLoadAmps}
                    onChange={(e) =>
                      setBaselineForm({ ...baselineForm, fullLoadAmps: Number(e.target.value) })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    {isRTL ? 'عتبة تحذير القفزات (أمبير):' : 'Warning Spike Threshold (A):'}
                  </label>
                  <input
                    type="number"
                    value={baselineForm.warningSpikeThresholdA}
                    onChange={(e) =>
                      setBaselineForm({
                        ...baselineForm,
                        warningSpikeThresholdA: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    {isRTL ? 'عتبة الخطر الحرج للقفزات (أمبير):' : 'Critical Spike Threshold (A):'}
                  </label>
                  <input
                    type="number"
                    value={baselineForm.criticalSpikeThresholdA}
                    onChange={(e) =>
                      setBaselineForm({
                        ...baselineForm,
                        criticalSpikeThresholdA: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    {isRTL ? 'خلوص الشفرات الاسمي (ملم):' : 'Nominal Blade Gap (mm):'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={baselineForm.nominalBladeGapMm}
                    onChange={(e) =>
                      setBaselineForm({
                        ...baselineForm,
                        nominalBladeGapMm: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    {isRTL ? 'حرارة التحذير للملفات (°C):' : 'Warning Winding Temp (°C):'}
                  </label>
                  <input
                    type="number"
                    value={baselineForm.warningWindingTempC}
                    onChange={(e) =>
                      setBaselineForm({
                        ...baselineForm,
                        warningWindingTempC: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">
                    {isRTL ? 'عمر السكاكين الدوري (ساعة):' : 'Nominal Knife Interval (h):'}
                  </label>
                  <input
                    type="number"
                    value={baselineForm.nominalKnifeLifeHours}
                    onChange={(e) =>
                      setBaselineForm({
                        ...baselineForm,
                        nominalKnifeLifeHours: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCalibrationOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {isRTL ? 'حفظ المعايرة' : 'Save Calibration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
