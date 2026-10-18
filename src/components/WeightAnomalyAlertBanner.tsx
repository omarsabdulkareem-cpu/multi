import React, { useState } from 'react';
import {
  AlertTriangle,
  Siren,
  Scale,
  RefreshCw,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  Activity,
  Zap,
  Cpu,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { WeightAnomalyReport } from '../services/weightAnomalyDaemon';
import { stopMaterialWarningAlarm } from '../services/materialAlertService';

export interface WeightAnomalyAlertBannerProps {
  anomalies: WeightAnomalyReport[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onSimulateTest: () => void;
  onInspectScale?: () => void;
}

export const WeightAnomalyAlertBanner: React.FC<WeightAnomalyAlertBannerProps> = ({
  anomalies,
  onDismiss,
  onClearAll,
  onSimulateTest,
  onInspectScale,
}) => {
  const { isRTL } = useLanguage();
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!anomalies || anomalies.length === 0) {
    return null;
  }

  const currentAnomaly = anomalies[selectedIndex] || anomalies[0];

  const handleMuteAudio = () => {
    setIsAudioMuted(true);
    stopMaterialWarningAlarm();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-950 via-slate-950 to-amber-950 border-2 border-red-500/80 p-4 sm:p-4.5 shadow-2xl shadow-red-950/70 animate-in fade-in duration-300">
      {/* Flashing Ambient Glow */}
      <div className="absolute top-0 start-0 w-2 h-full bg-red-500 animate-pulse" />
      <div className="absolute -top-12 -end-12 w-40 h-40 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left Side: Siren & Narrative */}
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/50 shrink-0 shadow-lg shadow-red-950 animate-bounce">
            <Siren className="w-6 h-6 text-red-400" />
          </div>

          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-red-950 text-red-300 border border-red-500/60 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                <Cpu className="w-3 h-3 text-red-400" />
                <span>DAEMON SENTINEL: WEIGHBRIDGE ANOMALY</span>
              </span>

              {anomalies.length > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/50">
                  {anomalies.length} {isRTL ? 'حالات مشبوهة مرصودة' : 'Anomalies Flagged'}
                </span>
              )}

              <span className="text-[10px] font-mono text-slate-400">
                {isRTL ? `رصد: ${currentAnomaly.displayTime}` : `Detected: ${currentAnomaly.displayTime}`}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <span>{isRTL ? currentAnomaly.titleAr : currentAnomaly.titleEn}</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isRTL ? currentAnomaly.descriptionAr : currentAnomaly.descriptionEn}
            </p>

            {/* Metric Comparison Badges */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs font-mono">
              <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1.5">
                <span className="text-slate-500">{isRTL ? 'الوزن السابق:' : 'Prev Weight:'}</span>
                <span className="font-bold text-white">
                  {currentAnomaly.previousWeightKG.toLocaleString()} KG
                </span>
              </div>

              <div className="text-red-400 font-bold">➔</div>

              <div className="px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 flex items-center gap-1.5 font-bold shadow-inner">
                <span className="text-red-400">{isRTL ? 'الوزن المشبوه:' : 'Flagged Drop:'}</span>
                <span className="text-amber-300 font-black">
                  {currentAnomaly.anomalousWeightKG.toLocaleString()} KG
                </span>
              </div>

              <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-300">
                <span>Δ {currentAnomaly.weightDeltaKG > 0 ? '+' : ''}{currentAnomaly.weightDeltaKG.toLocaleString()} KG</span>
              </div>

              {currentAnomaly.itemCode && (
                <div className="px-2 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300">
                  <span>{currentAnomaly.itemCode}</span>
                </div>
              )}
            </div>

            {/* Industrial Directive */}
            <div className="mt-2 p-2 rounded-xl bg-black/40 border border-red-900/50 text-[11px] text-amber-200/90 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>{isRTL ? 'إجراء الرقابة الموصى به: ' : 'Recommended Action: '}</strong>
                {isRTL ? currentAnomaly.recommendationAr : currentAnomaly.recommendationEn}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Action Controls */}
        <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0 self-end md:self-start">
          <div className="flex items-center gap-2">
            {!isAudioMuted && (
              <button
                type="button"
                onClick={handleMuteAudio}
                className="p-2 rounded-xl bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-semibold flex items-center gap-1 border border-red-500/40 cursor-pointer transition active:scale-95"
                title={isRTL ? 'إسكات صفارة الإنذار' : 'Silence Siren Alarm'}
              >
                <VolumeX className="w-4 h-4" />
                <span className="hidden sm:inline">{isRTL ? 'إسكات' : 'Mute'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onDismiss(currentAnomaly.id)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 cursor-pointer transition active:scale-95"
              title={isRTL ? 'تجاهل هذا التنبيه' : 'Dismiss anomaly'}
            >
              <X className="w-4 h-4" />
              <span>{isRTL ? 'تجاهل' : 'Dismiss'}</span>
            </button>
          </div>

          {onInspectScale && (
            <button
              type="button"
              onClick={onInspectScale}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/80 cursor-pointer transition-all active:scale-95"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{isRTL ? 'فحص منصة الميزان' : 'Inspect Scale'}</span>
            </button>
          )}

          {anomalies.length > 1 && (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
              <button
                type="button"
                onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : anomalies.length - 1))}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white"
              >
                ◀
              </button>
              <span>{selectedIndex + 1} / {anomalies.length}</span>
              <button
                type="button"
                onClick={() => setSelectedIndex((prev) => (prev < anomalies.length - 1 ? prev + 1 : 0))}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white"
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeightAnomalyAlertBanner;
