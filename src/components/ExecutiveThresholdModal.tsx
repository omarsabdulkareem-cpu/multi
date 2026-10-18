import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  RotateCcw,
  Check,
  Boxes,
  Flame,
  AlertTriangle,
  Zap,
  Sliders,
  Info,
} from 'lucide-react';
import {
  ExecutiveThresholds,
  DEFAULT_EXECUTIVE_THRESHOLDS,
} from '../types/executiveThresholds';

interface ExecutiveThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  thresholds: ExecutiveThresholds;
  onSave: (updated: ExecutiveThresholds) => void;
  currentInventoryUtilization?: number;
  currentInventoryTons?: number;
  currentShreddingThroughput?: number;
  isRTL?: boolean;
  currentInventoryStats?: {
    totalTons?: number | string;
    utilizationRate?: number;
  };
  currentShreddingStats?: {
    throughputKGHour?: number;
  };
}

export const ExecutiveThresholdModal: React.FC<ExecutiveThresholdModalProps> = ({
  isOpen,
  onClose,
  thresholds: initialThresholds,
  onSave,
  currentInventoryUtilization: propInvUtil,
  currentInventoryTons: propInvTons,
  currentShreddingThroughput: propShredRate,
  currentInventoryStats,
  currentShreddingStats,
  isRTL = false,
}) => {
  const currentInventoryUtilization =
    propInvUtil ?? (currentInventoryStats?.utilizationRate ?? 0);
  const currentInventoryTons =
    propInvTons ?? (Number(currentInventoryStats?.totalTons) || 0);
  const currentShreddingThroughput =
    propShredRate ?? (currentShreddingStats?.throughputKGHour ?? 0);

  const [form, setForm] = useState<ExecutiveThresholds>(initialThresholds || DEFAULT_EXECUTIVE_THRESHOLDS);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state when opened
  React.useEffect(() => {
    if (isOpen) {
      setForm(initialThresholds || DEFAULT_EXECUTIVE_THRESHOLDS);
      setSaveSuccess(false);
    }
  }, [isOpen, initialThresholds]);

  if (!isOpen) return null;

  // Real-time projected breaches with current settings
  const projectedInventoryBreach =
    (form.enableInventoryMaxAlert && currentInventoryUtilization >= form.inventoryMaxCapacityPct) ||
    (form.enableInventoryMinAlert && currentInventoryTons <= form.inventoryMinTons);

  const projectedShreddingBreach =
    (form.enableShreddingMinAlert && currentShreddingThroughput <= form.shreddingMinRateKGh) ||
    (form.enableShreddingMaxAlert && currentShreddingThroughput >= form.shreddingMaxRateKGh);

  const handlePreset = (presetName: 'strict' | 'standard' | 'relaxed') => {
    if (presetName === 'strict') {
      setForm({
        inventoryMaxCapacityPct: Math.max(50, Math.floor(currentInventoryUtilization - 2)), // Will trigger red alert!
        inventoryMinTons: 60,
        enableInventoryMaxAlert: true,
        enableInventoryMinAlert: true,
        shreddingMinRateKGh: Math.ceil(currentShreddingThroughput + 50), // Will trigger red alert!
        shreddingMaxRateKGh: 1600,
        enableShreddingMinAlert: true,
        enableShreddingMaxAlert: true,
      });
    } else if (presetName === 'standard') {
      setForm(DEFAULT_EXECUTIVE_THRESHOLDS);
    } else if (presetName === 'relaxed') {
      setForm({
        inventoryMaxCapacityPct: 92,
        inventoryMinTons: 30,
        enableInventoryMaxAlert: true,
        enableInventoryMinAlert: true,
        shreddingMinRateKGh: 800,
        shreddingMaxRateKGh: 1750,
        enableShreddingMinAlert: true,
        enableShreddingMaxAlert: true,
      });
    }
  };

  const handleSave = () => {
    onSave(form);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setForm(DEFAULT_EXECUTIVE_THRESHOLDS);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#12141c] border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isRTL ? 'إعداد الحدود الحرجة للتنبيهات' : 'Define Critical Alert Thresholds'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'تفعيل وتخصيص حدود الخطر باللون الأحمر لبطاقات الملخص التنفيذي'
                  : 'Customize limits triggering visual red-border alerts on executive cards'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Quick Presets Bar */}
          <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'نماذج الضبط السريع:' : 'Quick Presets:'}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {isRTL ? 'انقر لتطبيق فوري' : 'Click to load'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePreset('standard')}
                className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-cyan-950/60 border border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer text-center"
              >
                {isRTL ? 'المعايير الافتراضية' : 'Default Standard'}
              </button>
              <button
                type="button"
                onClick={() => handlePreset('strict')}
                className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 transition-all cursor-pointer text-center"
                title={isRTL ? 'يُفعل التنبيه الأحمر لاختبار البطاقات فوراً' : 'Triggers red alert for instant testing'}
              >
                {isRTL ? 'وضع اختبار التنبيه (حرج)' : 'Strict (Trigger Alert)'}
              </button>
              <button
                type="button"
                onClick={() => handlePreset('relaxed')}
                className="py-1.5 px-2.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-slate-500 text-slate-300 transition-all cursor-pointer text-center"
              >
                {isRTL ? 'حدود مرنة' : 'Relaxed Limits'}
              </button>
            </div>
          </div>

          {/* 1. INVENTORY THRESHOLD SECTION */}
          <div
            className={`p-4 rounded-xl border transition-all duration-300 ${
              projectedInventoryBreach
                ? 'bg-rose-950/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'bg-slate-900/40 border-cyan-500/20'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isRTL ? 'حدود إنذار المخزون الإجمالي' : 'Inventory Critical Thresholds'}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isRTL
                      ? `الحالة الحالية: ${currentInventoryUtilization}% إشغال (${currentInventoryTons} طن)`
                      : `Live: ${currentInventoryUtilization}% full (${currentInventoryTons} T)`}
                  </span>
                </div>
              </div>

              {projectedInventoryBreach ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  {isRTL ? 'سيتفعل التنبيه الأحمر' : 'Red Alert Active'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {isRTL ? 'ضمن النطاق الآمن' : 'Within Safe Range'}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {/* Max Capacity Threshold Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enableInventoryMaxAlert}
                      onChange={(e) =>
                        setForm({ ...form, enableInventoryMaxAlert: e.target.checked })
                      }
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <span>{isRTL ? 'إنذار تجاوز سعة المستودع القصوى:' : 'Max Warehouse Capacity Limit:'}</span>
                  </label>
                  <span className="font-mono font-bold text-cyan-300 text-sm">
                    {form.inventoryMaxCapacityPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="1"
                  value={form.inventoryMaxCapacityPct}
                  disabled={!form.enableInventoryMaxAlert}
                  onChange={(e) =>
                    setForm({ ...form, inventoryMaxCapacityPct: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>50%</span>
                  <span className="text-slate-400">
                    {isRTL ? `المستوى الحالي: ${currentInventoryUtilization}%` : `Current: ${currentInventoryUtilization}%`}
                  </span>
                  <span>95%</span>
                </div>
              </div>

              {/* Min Stock Safety Limit */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enableInventoryMinAlert}
                      onChange={(e) =>
                        setForm({ ...form, enableInventoryMinAlert: e.target.checked })
                      }
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <span>{isRTL ? 'إنذار نضوب المخزون (الحد الأدنى للأمان):' : 'Min Safety Stock Level:'}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="10"
                      max="150"
                      step="5"
                      value={form.inventoryMinTons}
                      disabled={!form.enableInventoryMinAlert}
                      onChange={(e) =>
                        setForm({ ...form, inventoryMinTons: Number(e.target.value) })
                      }
                      className="w-16 px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-white font-mono text-xs text-center focus:border-cyan-400 focus:outline-none disabled:opacity-40"
                    />
                    <span className="text-slate-400 text-xs font-mono">{isRTL ? 'طن' : 'Tons'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. SHREDDING THROUGHPUT THRESHOLD SECTION */}
          <div
            className={`p-4 rounded-xl border transition-all duration-300 ${
              projectedShreddingBreach
                ? 'bg-rose-950/20 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'bg-slate-900/40 border-emerald-500/20'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isRTL ? 'حدود إنذار تدفق مكائن الثرم' : 'Shredding Throughput Limits'}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {isRTL
                      ? `التدفق اللحظي الحالي: ${(currentShreddingThroughput ?? 0).toLocaleString()} كغم/ساعة`
                      : `Live throughput: ${(currentShreddingThroughput ?? 0).toLocaleString()} KG/h`}
                  </span>
                </div>
              </div>

              {projectedShreddingBreach ? (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  {isRTL ? 'سيتفعل التنبيه الأحمر' : 'Red Alert Active'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {isRTL ? 'ضمن النطاق الآمن' : 'Within Safe Range'}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {/* Min Throughput Limit Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enableShreddingMinAlert}
                      onChange={(e) =>
                        setForm({ ...form, enableShreddingMinAlert: e.target.checked })
                      }
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <span>{isRTL ? 'إنذار عجز التدفق (الحد الأدنى للإنتاجية):' : 'Min Throughput Deficit Alert:'}</span>
                  </label>
                  <span className="font-mono font-bold text-emerald-300 text-sm">
                    {(form.shreddingMinRateKGh ?? 0).toLocaleString()} KG/h
                  </span>
                </div>
                <input
                  type="range"
                  min="600"
                  max="1400"
                  step="25"
                  value={form.shreddingMinRateKGh ?? 850}
                  disabled={!form.enableShreddingMinAlert}
                  onChange={(e) =>
                    setForm({ ...form, shreddingMinRateKGh: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-400 cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>600 kg/h</span>
                  <span className="text-slate-400">
                    {isRTL
                      ? `الحالي: ${(currentShreddingThroughput ?? 0).toLocaleString()} kg/h`
                      : `Current: ${(currentShreddingThroughput ?? 0).toLocaleString()} kg/h`}
                  </span>
                  <span>1,400 kg/h</span>
                </div>
              </div>

              {/* Max Strain Throughput Limit */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-300 font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.enableShreddingMaxAlert}
                      onChange={(e) =>
                        setForm({ ...form, enableShreddingMaxAlert: e.target.checked })
                      }
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                    <span>{isRTL ? 'إنذار الحمل الزائد للمكائن (الحد الأقصى):' : 'Max Machine Strain Alert:'}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1300"
                      max="2000"
                      step="50"
                      value={form.shreddingMaxRateKGh}
                      disabled={!form.enableShreddingMaxAlert}
                      onChange={(e) =>
                        setForm({ ...form, shreddingMaxRateKGh: Number(e.target.value) })
                      }
                      className="w-20 px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-white font-mono text-xs text-center focus:border-emerald-400 focus:outline-none disabled:opacity-40"
                    />
                    <span className="text-slate-400 text-xs font-mono">KG/h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-200/90">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p>
              {isRTL
                ? 'عند تخطي أي من هذه الحدود، ستتحول حدود بطاقة الملخص المعنية إلى إطار أحمر متوهج (Red-Border Alert) مع شريط تحذيري فوري ينبه مسؤولي العمليات.'
                : 'When any threshold is breached, the respective Executive Summary card will immediately switch to an intense visual red-border alert with a pulsing warning banner.'}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-900/60">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'استعادة الافتراضي' : 'Reset Defaults'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 shadow-lg shadow-rose-900/30 transition-all cursor-pointer active:scale-95"
            >
              {saveSuccess ? (
                <Check className="w-4 h-4 text-white animate-bounce" />
              ) : (
                <Check className="w-4 h-4 text-white" />
              )}
              <span>{isRTL ? 'حفظ وتفعيل الحدود' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
