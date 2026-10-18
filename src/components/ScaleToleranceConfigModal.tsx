import React, { useState } from 'react';
import {
  X,
  SlidersHorizontal,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Volume2,
  VolumeX,
  Scale,
  Cog,
  Truck,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  WeightTolerances,
  DEFAULT_WEIGHT_TOLERANCES,
  loadWeightTolerances,
  saveWeightTolerances,
} from '../services/weightToleranceService';

export interface ScaleToleranceConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultCategory?: 'RECEIVING' | 'SHREDDING';
}

export const ScaleToleranceConfigModal: React.FC<ScaleToleranceConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  defaultCategory = 'RECEIVING',
}) => {
  const { isRTL } = useLanguage();
  const [tolerances, setTolerances] = useState<WeightTolerances>(loadWeightTolerances());
  const [activeTab, setActiveTab] = useState<'RECEIVING' | 'SHREDDING' | 'AUDIO'>(defaultCategory);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveWeightTolerances(tolerances);
    setSaveNotice(
      isRTL ? 'تم حفظ معايير وحدود التسامح بنجاح وتطبيقها فورياً على جميع شاشات الوزن!' : 'Tolerances saved and applied live!'
    );
    onSaved();
    setTimeout(() => {
      setSaveNotice(null);
      onClose();
    }, 1200);
  };

  const handleResetDefaults = () => {
    setTolerances(DEFAULT_WEIGHT_TOLERANCES);
    saveWeightTolerances(DEFAULT_WEIGHT_TOLERANCES);
    setSaveNotice(isRTL ? 'تمت استعادة معايير التسامح الافتراضية للمصنع.' : 'Restored factory default tolerances.');
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 border-b border-cyan-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isRTL ? 'ضبط حدود وتسامح الأوزان الإنتاجية' : 'Production Weight Tolerance Thresholds'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'تحديد المعايير المسموحة للميزان الجسري ودورات الثرم لإطلاق التنبيهات المرئية والصوتية'
                  : 'Configure real-time deviation alert triggers for scale readings'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-3 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('RECEIVING')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'RECEIVING'
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تسامح الاستلام والميزان الجسري' : 'Receiving Tolerances'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SHREDDING')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'SHREDDING'
                ? 'border-amber-400 text-amber-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cog className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تسامح الثرم وموازنة الفاقد' : 'Shredding Tolerances'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUDIO')}
            className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer border-b-2 ${
              activeTab === 'AUDIO'
                ? 'border-emerald-400 text-emerald-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isRTL ? 'التنبيهات الصوتية' : 'Audio Triggers'}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {saveNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveNotice}</span>
            </div>
          )}

          {/* TAB 1: RECEIVING TOLERANCES */}
          {activeTab === 'RECEIVING' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-white block text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-cyan-400" />
                  {isRTL ? 'حدود الشاحنات والميزان الجسري (Truck Gross & Tare Limits)' : 'Vehicle Weight Limits'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأدنى لوزن الدخول (قائم) - كغم:' : 'Min Gross Weight (Scale In) KG:'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.minGrossWeightKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, minGrossWeightKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                    <span className="text-[10px] text-slate-500">
                      {isRTL ? 'أي شاحنة أقل من هذا الوزن تعتبر فارغة أو غير مطابقة' : 'Triggers alert if truck is empty'}
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأقصى لوزن الدخول (قائم) - كغم:' : 'Max Gross Weight (Scale In) KG:'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.maxGrossWeightKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, maxGrossWeightKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                    <span className="text-[10px] text-slate-500">
                      {isRTL ? 'حد الحمولة المحورية لسلامة جسر الميزان' : 'Weighbridge safe axle limit'}
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأقصى للوزن الفارغ (الخروج) - كغم:' : 'Max Tare Weight (Scale Out) KG:'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.maxTareWeightKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, maxTareWeightKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأدنى لصافي الحمولة - كغم:' : 'Min Net Cargo Weight KG:'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.minNetWeightKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, minNetWeightKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Bulk Bag Densities & Invoice Variance */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-white block text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  {isRTL ? 'تسامح أوزان الشلايف والفواتير (Bag & Manifest Tolerances)' : 'Bag & Manifest Tolerances'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأدنى لوزن الشليف (كغم):' : 'Min Bag Average Weight (KG):'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.minBagAverageWeightKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, minBagAverageWeightKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأقصى لوزن الشليف (كغم):' : 'Max Bag Average Weight (KG):'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.maxBagAverageWeightKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, maxBagAverageWeightKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                    <span className="text-[10px] text-slate-500">
                      {isRTL ? 'إنذار عند تجاوز السعة لمنع تمزق الشلايف' : 'Prevents bag tearing & forklift hazard'}
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'فارق وزن فاتورة المورد المسموح (±%):' : 'Allowed Invoice Discrepancy (±%):'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tolerances.maxSupplierDiscrepancyPct}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, maxSupplierDiscrepancyPct: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHREDDING TOLERANCES */}
          {activeTab === 'SHREDDING' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-white block text-sm flex items-center gap-2">
                  <Cog className="w-4 h-4 text-amber-400" />
                  {isRTL ? 'موازنة الكتلة وفواقد الثرم (Mass Balance & Granulator Loss)' : 'Granulator Tolerances'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'حد تحذير فاقد الثرم (Warning Loss %):' : 'Warning Loss Threshold (%):'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tolerances.warningShreddingLossPct}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, warningShreddingLossPct: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                    <span className="text-[10px] text-amber-400">
                      {isRTL ? 'يطلق تنبيهاً أصفر ويلزم المشغل بذكر سبب الفارق' : 'Yellow alert + reason required'}
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الحرج لفاقد الثرم (Critical Alarm %):' : 'Critical Alarm Threshold (%):'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tolerances.criticalShreddingLossPct}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, criticalShreddingLossPct: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-rose-500 text-white font-mono font-bold"
                      required
                    />
                    <span className="text-[10px] text-rose-400">
                      {isRTL ? 'يطلق إنذاراً أحمر صريحاً بوجود تسرب أو فاقد غير مبرر' : 'Red alarm for severe loss/leak'}
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'أقصى نسبة تالف إنتاج مسموحة (%):' : 'Max Allowed Production Damage (%):'}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={tolerances.maxProductionDamagePct}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, maxProductionDamagePct: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">
                      {isRTL ? 'الحد الأقصى لدفعة التغذية الواحدة (كغم):' : 'Max Single Batch Intake (KG):'}
                    </label>
                    <input
                      type="number"
                      value={tolerances.maxInputBatchKG}
                      onChange={(e) =>
                        setTolerances({ ...tolerances, maxInputBatchKG: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIO CONTROLS */}
          {activeTab === 'AUDIO' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                    {tolerances.soundAlertEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </span>
                  <div>
                    <div className="font-bold text-white text-sm">
                      {isRTL ? 'تفعيل الإشارات الصوتية عند تجاوز حدود التسامح' : 'Synthesized Audio Alarms'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {isRTL
                        ? 'إطلاق صوت إنذار ترددي عند رصد انحراف وزني حرج في ميزان الاستلام أو دورة الثرم'
                        : 'Plays immediate audible pulse on critical weight deviations'}
                    </div>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tolerances.soundAlertEnabled}
                    onChange={(e) =>
                      setTolerances({ ...tolerances, soundAlertEnabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>
            </div>
          )}

          {/* Buttons Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRTL ? 'استعادة الافتراضيات' : 'Reset Defaults'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isRTL ? 'حفظ وتطبيق المعايير' : 'Save & Apply'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
