import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scale,
  Activity,
  Zap,
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  ArrowDownCircle,
  Cpu,
  Radio,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  evaluateReceivingWeightTolerances,
  ToleranceEvaluationReport,
} from '../services/weightToleranceService';
import { ScaleToleranceConfigModal } from './ScaleToleranceConfigModal';

export type ScaleConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'TIMEOUT_ERROR' | 'OFFLINE';

interface WeighbridgeIndicatorProps {
  mode: 'GROSS' | 'TARE' | 'MONITOR';
  currentValue?: number;
  onCaptureWeight?: (weightKG: number) => void;
  truckPlate?: string;
  materialName?: string;
  defaultPreset?: number;
  onConnectionChange?: (status: ScaleConnectionStatus) => void;
  forceStatus?: ScaleConnectionStatus;
}

export const WeighbridgeIndicator: React.FC<WeighbridgeIndicatorProps> = ({
  mode,
  currentValue,
  onCaptureWeight,
  truckPlate,
  materialName,
  defaultPreset = 28500,
  onConnectionChange,
  forceStatus,
}) => {
  const { isRTL } = useLanguage();

  const [liveWeight, setLiveWeight] = useState<number>(currentValue || defaultPreset);
  const [isStable, setIsStable] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [capturedFlash, setCapturedFlash] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

  // Real-time Tolerance Evaluation for Live Scale Weight
  const liveTolerance = useMemo<ToleranceEvaluationReport>(() => {
    return evaluateReceivingWeightTolerances({
      scaleInWeightKG: mode === 'GROSS' ? liveWeight : undefined,
      scaleOutWeightKG: mode === 'TARE' ? liveWeight : undefined,
    });
  }, [liveWeight, mode]);

  // Scale Hardware Communication States
  const [connectionStatus, setConnectionStatus] = useState<ScaleConnectionStatus>(
    forceStatus || 'CONNECTED'
  );
  const [pingLatencyMs, setPingLatencyMs] = useState<number>(14);
  const [packetCount, setPacketCount] = useState<number>(14820);
  const [lastHeartbeat, setLastHeartbeat] = useState<string>(new Date().toLocaleTimeString());
  const [comPort] = useState<string>('COM1:9600-8-N-1 (RS-232 / TCP-IP 192.168.1.120)');
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectSuccessMsg, setReconnectSuccessMsg] = useState<string | null>(null);

  // Sync external forceStatus if provided
  useEffect(() => {
    if (forceStatus) {
      setConnectionStatus(forceStatus);
    }
  }, [forceStatus]);

  // Notify parent of connection status changes
  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(connectionStatus);
    }
  }, [connectionStatus, onConnectionChange]);

  // Realistic micro-fluctuation simulation & telemetry stream when CONNECTED
  useEffect(() => {
    if (!isSimulating || connectionStatus !== 'CONNECTED') return;

    const interval = setInterval(() => {
      // 80% chance stable, 20% jitter ±10kg
      const jitter = Math.random() > 0.8 ? (Math.random() > 0.5 ? 10 : -10) : 0;
      setLiveWeight((prev) => {
        const next = prev + jitter;
        return next > 0 ? next : 0;
      });
      setIsStable(jitter === 0);

      // Telemetry packet tick
      setPacketCount((p) => p + 1);
      setPingLatencyMs(Math.floor(10 + Math.random() * 12));
      setLastHeartbeat(new Date().toLocaleTimeString());
    }, 1200);

    return () => clearInterval(interval);
  }, [isSimulating, connectionStatus]);

  // Sync if external currentValue changes
  useEffect(() => {
    if (currentValue && currentValue > 0) {
      setLiveWeight(currentValue);
    }
  }, [currentValue]);

  // Force Reconnect logic
  const handleForceReconnect = useCallback(() => {
    setReconnecting(true);
    setConnectionStatus('CONNECTING');
    setReconnectSuccessMsg(null);

    setTimeout(() => {
      setConnectionStatus('CONNECTED');
      setReconnecting(false);
      setPingLatencyMs(12);
      setPacketCount((p) => p + 50);
      setLastHeartbeat(new Date().toLocaleTimeString());
      setIsStable(true);
      setReconnectSuccessMsg(
        isRTL
          ? 'تمت إعادة الاتصال بنجاح بمتحكم الميزان الجسري (COM1 / 9600 Baud)'
          : 'Scale hardware reconnected successfully (COM1 / 9600 Baud).'
      );
      setTimeout(() => setReconnectSuccessMsg(null), 4000);
    }, 1200);
  }, [isRTL]);

  // Toggle simulate timeout error
  const handleSimulateTimeout = () => {
    if (connectionStatus === 'TIMEOUT_ERROR') {
      handleForceReconnect();
    } else {
      setConnectionStatus('TIMEOUT_ERROR');
      setIsStable(false);
    }
  };

  const handleCapture = () => {
    if (connectionStatus !== 'CONNECTED') return;
    setCapturedFlash(true);
    setTimeout(() => setCapturedFlash(false), 800);
    if (onCaptureWeight) {
      onCaptureWeight(liveWeight);
    }
  };

  const handleZero = () => {
    if (connectionStatus !== 'CONNECTED') return;
    setLiveWeight(0);
    setIsStable(true);
  };

  const setPresetWeight = (weight: number) => {
    if (connectionStatus !== 'CONNECTED') return;
    setLiveWeight(weight);
    setIsStable(true);
  };

  const presets =
    mode === 'TARE'
      ? [
          { label: isRTL ? 'فارغ خفيف' : 'Light Tare', weight: 14200 },
          { label: isRTL ? 'فارغ متوسط' : 'Medium Tare', weight: 16800 },
          { label: isRTL ? 'فارغ ثقيل' : 'Heavy Tare', weight: 18400 },
          { label: isRTL ? 'شاحنة مرسيدس' : 'Mercedes Truck', weight: 15600 },
        ]
      : [
          { label: isRTL ? 'شاحنة 25 طن' : '25T Truck', weight: 25400 },
          { label: isRTL ? 'شاحنة 28.5 طن' : '28.5T Truck', weight: 28650 },
          { label: isRTL ? 'شاحنة 32.5 طن' : '32.5T Truck', weight: 32450 },
          { label: isRTL ? 'شاحنة 38.5 طن' : '38.5T Truck', weight: 38400 },
        ];

  return (
    <div
      className={`rounded-2xl border transition-all ${
        connectionStatus === 'TIMEOUT_ERROR'
          ? 'bg-gradient-to-b from-rose-950/90 via-[#18080c] to-slate-950 border-rose-500/60 shadow-2xl'
          : capturedFlash
          ? 'bg-cyan-950/90 border-cyan-400 shadow-2xl ring-2 ring-cyan-400'
          : 'bg-gradient-to-b from-slate-900/95 via-[#0d1117] to-slate-950 border-cyan-500/40 shadow-xl'
      } p-4 sm:p-5 space-y-4`}
    >
      {/* Top Hardware Communication & Diagnostic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/90 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl border transition-all ${
              connectionStatus === 'CONNECTED'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                : connectionStatus === 'CONNECTING'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-spin'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}
          >
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide">
                {isRTL ? 'الميزان الجسري الإلكتروني المباشر' : 'Live Electronic Weighbridge Station'}
              </h4>

              {/* Real-time Status Badge */}
              {connectionStatus === 'CONNECTED' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE / متصل ({pingLatencyMs}ms)</span>
                </span>
              )}

              {connectionStatus === 'CONNECTING' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                  <span>CONNECTING... / جاري الربط</span>
                </span>
              )}

              {connectionStatus === 'TIMEOUT_ERROR' && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/60 flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.4)]">
                  <WifiOff className="w-2.5 h-2.5 text-rose-400" />
                  <span>TIMEOUT ERROR / انقطاع الاتصال</span>
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>{comPort}</span>
              <span className="text-slate-600 hidden sm:inline">•</span>
              <span className="text-slate-500 hidden sm:inline">Packets: #{packetCount}</span>
            </p>
          </div>
        </div>

        {/* Action Controls in Header: Force Reconnect & Live Stream Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {truckPlate && (
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300 font-mono text-xs font-bold border border-slate-700">
              {truckPlate}
            </span>
          )}

          {/* Force Reconnect Button */}
          <button
            type="button"
            onClick={handleForceReconnect}
            disabled={reconnecting}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
              connectionStatus === 'TIMEOUT_ERROR'
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-950 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-cyan-500/40'
            }`}
            title={isRTL ? 'إعادة فرض الاتصال بمتحكم الميزان ومعالجة أخطاء المهلة' : 'Force hardware COM port reconnect & clear timeout'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
            <span>{isRTL ? 'إعادة الاتصال بالقوة' : 'Force Reconnect'}</span>
          </button>

          {/* Simulation Toggle */}
          <button
            type="button"
            onClick={() => setIsSimulating(!isSimulating)}
            disabled={connectionStatus !== 'CONNECTED'}
            title={isRTL ? 'تبديل محاكاة قراءات الحساس' : 'Toggle sensor stream simulation'}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-all ${
              isSimulating && connectionStatus === 'CONNECTED'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5 inline-block me-1" />
            {isSimulating ? (isRTL ? 'بث مباشر' : 'Live') : (isRTL ? 'تثبيت' : 'Hold')}
          </button>

          {/* Test Timeout Trigger Toggle */}
          <button
            type="button"
            onClick={handleSimulateTimeout}
            title={isRTL ? 'محاكاة خطأ انقطاع مهلة الاتصال (Timeout)' : 'Simulate scale hardware timeout error'}
            className={`px-2 py-1.5 rounded-xl text-[10px] font-mono border transition-all ${
              connectionStatus === 'TIMEOUT_ERROR'
                ? 'bg-rose-900/60 text-rose-300 border-rose-500/50'
                : 'bg-slate-900 text-slate-500 hover:text-slate-300 border-slate-800'
            }`}
          >
            {connectionStatus === 'TIMEOUT_ERROR' ? (isRTL ? 'حل الخطأ' : 'Clear Error') : (isRTL ? 'اختبار Timeout' : 'Test Timeout')}
          </button>
        </div>
      </div>

      {/* Success Notification after Force Reconnect */}
      {reconnectSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2 shadow-lg animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{reconnectSuccessMsg}</span>
        </div>
      )}

      {/* TIMEOUT ERROR ALERT BANNER */}
      {connectionStatus === 'TIMEOUT_ERROR' && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-rose-200 space-y-3 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-black text-white">
                  {isRTL
                    ? 'خطأ مهلة الاتصال بحساسات الميزان (ERR_SCALE_TIMEOUT_0x14)'
                    : 'Scale Hardware Communication Timeout (ERR_SCALE_TIMEOUT_0x14)'}
                </h5>
                <p className="text-xs text-rose-300 mt-1 leading-relaxed">
                  {isRTL
                    ? 'انقطع اتصال متحكم الميزان الإلكتروني على المنفذ التسلسلي COM1 لأكثر من 3000ms. يرجى الضغط على زر "إعادة الاتصال بالقوة" لإعادة مزامنة الإشارة.'
                    : 'Scale indicator hardware controller on serial port COM1 did not reply for >3000ms. Please trigger "Force Reconnect" to reset hardware baud stream.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleForceReconnect}
              disabled={reconnecting}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${reconnecting ? 'animate-spin' : ''}`} />
              <span>{isRTL ? 'إعادة الاتصال الفوري' : 'Force Reconnect Now'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-rose-800/50 text-[11px] font-mono text-rose-300/80">
            <div>Port: COM1:9600</div>
            <div>Protocol: RS-232 / TCP</div>
            <div>Status: TIMEOUT_LOST</div>
            <div>Last Heartbeat: {lastHeartbeat}</div>
          </div>
        </div>
      )}

      {/* Main Digital LED Display */}
      <div
        className={`relative rounded-2xl border-2 p-4 sm:p-6 shadow-inner overflow-hidden transition-all ${
          connectionStatus === 'TIMEOUT_ERROR'
            ? 'bg-[#120406] border-rose-500/50'
            : 'bg-[#030712] border-cyan-500/50'
        }`}
      >
        {/* Ambient Grid Background */}
        <div
          className={`absolute inset-0 pointer-events-none bg-[size:16px_16px] ${
            connectionStatus === 'TIMEOUT_ERROR'
              ? 'bg-[linear-gradient(to_right,#e11d4810_1px,transparent_1px),linear-gradient(to_bottom,#e11d4810_1px,transparent_1px)]'
              : 'bg-[linear-gradient(to_right,#08334415_1px,transparent_1px),linear-gradient(to_bottom,#08334415_1px,transparent_1px)]'
          }`}
        />

        {/* Status Indicators Top Row */}
        <div
          className={`relative z-10 flex items-center justify-between border-b pb-2 mb-3 text-[10px] font-mono tracking-wider ${
            connectionStatus === 'TIMEOUT_ERROR' ? 'border-rose-900/40' : 'border-cyan-900/40'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
              className={`px-2 py-0.5 rounded font-bold transition-all ${
                connectionStatus === 'TIMEOUT_ERROR'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                  : isStable
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/50 animate-pulse'
              }`}
            >
              {connectionStatus === 'TIMEOUT_ERROR'
                ? isRTL
                  ? '✕ فقدان الإشارة TIMEOUT'
                  : '✕ TIMEOUT LOST'
                : isStable
                ? isRTL
                  ? '● مستقر STABLE'
                  : '● STABLE'
                : isRTL
                ? '▲ حركة MOTION'
                : '▲ MOTION'}
            </span>

            <span
              className={`px-2 py-0.5 rounded font-bold ${
                liveWeight === 0 && connectionStatus === 'CONNECTED'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-slate-600'
              }`}
            >
              CENTER ZERO
            </span>

            <span
              className={`px-2 py-0.5 rounded font-bold ${
                mode === 'GROSS'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : mode === 'TARE'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
              }`}
            >
              {mode === 'GROSS' ? 'GROSS / قائم' : mode === 'TARE' ? 'TARE / فارغ' : 'NET / صافي'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            {connectionStatus === 'CONNECTED' ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SCALE-01 OK</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">DISCONNECTED</span>
              </span>
            )}
          </div>
        </div>

        {/* Big Digital Readout */}
        <div className="relative z-10 flex items-baseline justify-center sm:justify-end gap-3 py-2">
          {connectionStatus === 'TIMEOUT_ERROR' ? (
            <div className="font-mono text-3xl sm:text-5xl font-black tracking-wider text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.6)] animate-pulse">
              ----- ERR-TIMEOUT -----
            </div>
          ) : (
            <>
              <div className="font-mono text-4xl sm:text-6xl font-black tracking-wider text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]">
                {(liveWeight ?? 0).toLocaleString()}
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400/80">KG</div>
            </>
          )}
        </div>

        {/* Real-time Tolerance Threshold Status Bar */}
        {liveTolerance && (
          <div
            className={`relative z-10 p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
              liveTolerance.overallSeverity === 'CRITICAL'
                ? 'bg-rose-950/80 border-rose-500 text-rose-200 animate-pulse'
                : liveTolerance.overallSeverity === 'WARNING'
                ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {liveTolerance.overallSeverity === 'CRITICAL' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-ping" />
              ) : liveTolerance.overallSeverity === 'WARNING' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="font-bold text-[11px] leading-tight">
                {isRTL ? liveTolerance.summaryAr : liveTolerance.summaryEn}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="p-1 px-2 rounded-lg bg-black/50 hover:bg-black/80 text-cyan-300 hover:text-white border border-cyan-500/30 text-[10px] font-mono shrink-0 cursor-pointer flex items-center gap-1"
            >
              <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
              <span>{isRTL ? 'الحدود' : 'Limits'}</span>
            </button>
          </div>
        )}

        {/* Secondary Info / Net summary */}
        {materialName && (
          <div className="relative z-10 pt-2 mt-2 border-t border-cyan-900/30 flex items-center justify-between text-xs text-slate-300">
            <span>{isRTL ? 'المادة المحملة:' : 'Loaded Material:'}</span>
            <span className="font-bold text-cyan-300">{materialName}</span>
          </div>
        )}
      </div>

      {/* Threshold Config Modal */}
      {isConfigModalOpen && (
        <ScaleToleranceConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSaved={() => {}}
        />
      )}

      {/* Control Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Manual adjustment input & Zero */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 p-1">
            <span className="px-2 text-xs text-slate-400 font-mono">KG:</span>
            <input
              type="number"
              disabled={connectionStatus !== 'CONNECTED'}
              value={liveWeight}
              onChange={(e) => {
                setLiveWeight(Number(e.target.value));
                setIsStable(true);
              }}
              className="w-28 bg-transparent text-white font-mono text-sm font-bold outline-none px-1 disabled:opacity-40"
            />
          </div>

          <button
            type="button"
            onClick={handleZero}
            disabled={connectionStatus !== 'CONNECTED'}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تصفير الميزان' : 'Zero Scale'}</span>
          </button>
        </div>

        {/* Primary Capture Button */}
        {onCaptureWeight && (
          <button
            type="button"
            onClick={handleCapture}
            disabled={connectionStatus !== 'CONNECTED'}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95 ${
              connectionStatus !== 'CONNECTED'
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-950/60'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>
              {mode === 'GROSS'
                ? isRTL
                  ? '⚡ تثبيت قراءة وزن الدخول (قائم)'
                  : '⚡ Capture Gross Scale In'
                : mode === 'TARE'
                ? isRTL
                  ? '⚡ تثبيت قراءة وزن الخروج (فارغ)'
                  : '⚡ Capture Tare Scale Out'
                : isRTL
                ? '⚡ تثبيت الوزن الحالي'
                : '⚡ Capture Weight'}
            </span>
          </button>
        )}
      </div>

      {/* Quick Test Load Presets */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
        <span className="text-slate-400 flex items-center gap-1 shrink-0">
          <SlidersHorizontal className="w-3 h-3 text-cyan-400" />
          {isRTL ? 'أوزان شاحنات قياسية:' : 'Quick Presets:'}
        </span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            disabled={connectionStatus !== 'CONNECTED'}
            onClick={() => setPresetWeight(p.weight)}
            className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 hover:border-cyan-500/40 shrink-0 font-mono transition-all"
          >
            {p.label} ({(p.weight ?? 0).toLocaleString()} kg)
          </button>
        ))}
      </div>
    </div>
  );
};
