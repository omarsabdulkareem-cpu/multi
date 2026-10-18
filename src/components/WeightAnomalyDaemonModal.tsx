import React from 'react';
import {
  X,
  Cpu,
  Activity,
  AlertTriangle,
  Siren,
  Scale,
  RefreshCw,
  CheckCircle2,
  Zap,
  Radio,
  SlidersHorizontal,
  Database,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  weightAnomalyDaemon,
  WeightAnomalyReport,
} from '../services/weightAnomalyDaemon';

export interface WeightAnomalyDaemonModalProps {
  isOpen: boolean;
  onClose: () => void;
  anomalies: WeightAnomalyReport[];
  onDismissAnomaly: (id: string) => void;
  onClearAll: () => void;
  onSimulateTest: () => void;
}

export const WeightAnomalyDaemonModal: React.FC<WeightAnomalyDaemonModalProps> = ({
  isOpen,
  onClose,
  anomalies,
  onDismissAnomaly,
  onClearAll,
  onSimulateTest,
}) => {
  const { isRTL } = useLanguage();

  if (!isOpen) return null;

  const daemonStatus = weightAnomalyDaemon.getDaemonStatus();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-900 border border-cyan-500/40 shadow-2xl shadow-cyan-950/80 space-y-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Cpu className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {isRTL
                    ? 'نظام مراقبة قفزات وتصفير الوزن (Weight Anomaly Daemon)'
                    : 'Weighbridge Weight Anomaly Background Daemon'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>ONLINE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'برمجية خلفية تراقب قراءات الميزان المخزنة في IndexedDB وترصد أي انخفاض مفاجئ للصفر أو قفزات غير فيزيائية'
                  : 'Background process continuously auditing IndexedDB intake weights for abrupt zero-drops and signal loss'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Health Status & Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold">{isRTL ? 'حالة المراقب' : 'Daemon Engine'}</div>
              <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>ACTIVE (4s)</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold">{isRTL ? 'قاعدة البيانات' : 'Audited DB'}</div>
              <div className="text-xs font-bold text-cyan-300 mt-1 truncate">
                AlKarwanReceivingDB
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold">{isRTL ? 'الحالات المشبوهة' : 'Flagged Jumps'}</div>
              <div className={`text-sm font-bold mt-1 ${anomalies.length > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                {anomalies.length} {isRTL ? 'حالة' : 'Events'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="text-slate-500 text-[10px] uppercase font-bold">{isRTL ? 'آخر نبضة فحص' : 'Heartbeat'}</div>
              <div className="text-xs font-bold text-white mt-1">
                {daemonStatus.lastHeartbeat}
              </div>
            </div>
          </div>

          {/* Load-Cell Bridge Transducers Channel Matrix */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Scale className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'حالة قنوات خلايا الوزن الأربعة (4-Channel Load Cells)' : '4-Channel Load Cell Bridge Status'}</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">BALANCED ±0.02%</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                <span>LC-01 FL</span>
                <span className="text-[10px] text-slate-400">3.2 mV/V</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                <span>LC-02 FR</span>
                <span className="text-[10px] text-slate-400">3.2 mV/V</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                <span>LC-03 RL</span>
                <span className="text-[10px] text-slate-400">3.1 mV/V</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                <span>LC-04 RR</span>
                <span className="text-[10px] text-slate-400">3.2 mV/V</span>
              </div>
            </div>
          </div>

          {/* Active Anomalies List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRTL ? 'سجل الحالات المشبوهة المرصودة حالياً' : 'Active Anomaly Incidents'}</span>
              </h4>
              {anomalies.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  {isRTL ? 'مسح كافة التنبيهات' : 'Clear All'}
                </button>
              )}
            </div>

            {anomalies.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-medium text-slate-300">
                  {isRTL
                    ? 'كافة قراءات الميزان في IndexedDB طبيعية ومستقرة تماماً، ولا يوجد أي انخفاض مفاجئ للصفر.'
                    : 'All IndexedDB scale records are stable. No abnormal zero-drops or spikes detected.'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isRTL
                    ? 'يمكنك تجربة واختبار النظام عبر الضغط على زر "محاكاة انخفاض للصفر" أدناه.'
                    : 'You can test detection anytime using the "Simulate Zero Drop" button below.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {anomalies.map((anom) => (
                  <div
                    key={anom.id}
                    className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/50 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-300">
                          {isRTL ? anom.titleAr : anom.titleEn}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-slate-400">
                          {anom.displayTime}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px]">
                        {isRTL ? anom.descriptionAr : anom.descriptionEn}
                      </p>
                      <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                        <span className="text-slate-400">
                          {anom.previousWeightKG.toLocaleString()} KG ➔{' '}
                          <span className="text-amber-300 font-bold">
                            {anom.anomalousWeightKG.toLocaleString()} KG
                          </span>
                        </span>
                        {anom.itemCode && (
                          <span className="text-cyan-300">[{anom.itemCode}]</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDismissAnomaly(anom.id)}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs shrink-0 cursor-pointer"
                    >
                      {isRTL ? 'تجاهل' : 'Dismiss'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test & Simulation Controls */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-950 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'اختبار ومحاكاة رصد هبوط الوزن' : 'Daemon Simulation Sandbox'}</span>
              </h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isRTL
                  ? 'يقوم بمحاكاة هبوط مفاجئ للوزن من 28,450 كغم إلى 0 كغم لاختبار إطلاق الإنذار وتنبيه المشغل في واجهة المستخدم'
                  : 'Injects a simulated 28,450 KG to 0 KG drop to verify instant UI alerts and alarm sirens'}
              </p>
            </div>

            <button
              type="button"
              onClick={onSimulateTest}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-amber-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-950/60 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition active:scale-95"
            >
              <Siren className="w-4 h-4 text-white" />
              <span>{isRTL ? 'محاكاة انخفاض للصفر ⚠️' : 'Simulate Zero Drop ⚠️'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
          >
            {isRTL ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeightAnomalyDaemonModal;
