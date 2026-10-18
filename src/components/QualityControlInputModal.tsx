import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Layers,
  Ruler,
  User,
  FileText,
  Flame,
  Hash,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Plus,
  Minus,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  QualitySample,
  QualityDefectCategory,
  QualitySampleDisposition,
} from '../types';
import {
  FACTORY_QC_LINES,
  DEFECT_CATEGORIES_META,
  TIME_SLOTS_DEF,
  saveQualitySample,
  generateNextQCSampleNumber,
} from '../services/qualityControlService';

interface QualityControlInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSampleSaved: (sample: QualitySample) => void;
  preselectedMachineCode?: string;
  preselectedTimeSlot?: string;
}

const PRODUCT_PRESETS = [
  {
    nameAr: 'فيلم زراعي مقاوم للأشعة فوق البنفسجية UV 120μm',
    nameEn: 'UV-Stabilized Agri Greenhouse Film 120μm',
    material: 'LDPE / LLDPE',
    targetThickness: 120,
    machineCode: 'EXT-01',
  },
  {
    nameAr: 'شرينك فيلم حراري لتغليف العبوات 50μm',
    nameEn: 'Thermal Shrink Bundling Film 50μm',
    material: 'LDPE Shrink Grade',
    targetThickness: 50,
    machineCode: 'EXT-02',
  },
  {
    nameAr: 'رول أكياس تسوق ناعمة HDPE عالي الكثافة 18μm',
    nameEn: 'HDPE Carrier Bag Film Roll 18μm',
    material: 'HDPE Virgin + Regrind',
    targetThickness: 18,
    machineCode: 'EXT-03',
  },
  {
    nameAr: 'شيت بولي إيثيلين تيريفثالات شفاف 450μm للتشكيل الحراري',
    nameEn: 'Rigid Thermoforming PET Sheet 450μm',
    material: 'RPET Flakes + Virgin',
    targetThickness: 450,
    machineCode: 'EXT-04',
  },
  {
    nameAr: 'ستريتش فيلم ناعم عالي الاستطالة 15μm',
    nameEn: 'High-Cling Stretch Wrap Film 15μm',
    material: 'LLDPE Cast Film',
    targetThickness: 15,
    machineCode: 'EXT-05',
  },
  {
    nameAr: 'فيلم عازل 5 طبقات EVOH لحفظ الأغذية',
    nameEn: '5-Layer EVOH High Barrier Film',
    material: 'PE / EVOH / Tie',
    targetThickness: 85,
    machineCode: 'EXT-06',
  },
  {
    nameAr: 'حبيبات وفليك PET مجروش ناعم 6 مم مغسول',
    nameEn: 'Washed Clean PET Regrind Flakes 6mm',
    material: 'Post-Consumer Flakes',
    targetThickness: 0,
    machineCode: 'SHR-360',
  },
  {
    nameAr: 'علب طعام مستطيلة مع غطاء شفاف 750 مل PET',
    nameEn: 'PET Rectangular Food Containers 750ml',
    material: 'Thermoformed PET',
    targetThickness: 320,
    machineCode: 'THF-01',
  },
];

export const QualityControlInputModal: React.FC<QualityControlInputModalProps> = ({
  isOpen,
  onClose,
  onSampleSaved,
  preselectedMachineCode,
  preselectedTimeSlot,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser, logAudit } = useFactory();

  const [machineCode, setMachineCode] = useState<string>(
    preselectedMachineCode || 'EXT-01'
  );
  const [timeSlot, setTimeSlot] = useState<string>(
    preselectedTimeSlot || TIME_SLOTS_DEF[1].key
  );
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [batchLotNumber, setBatchLotNumber] = useState<string>(() => {
    const d = new Date();
    const code = (preselectedMachineCode || 'EXT01').replace('-', '');
    return `LOT-${d.getFullYear()}-${code}-${Math.floor(100 + Math.random() * 900)}`;
  });
  const [orderNumber, setOrderNumber] = useState<string>('PO-2026-0885');

  // Product selection
  const [selectedProductPreset, setSelectedProductPreset] = useState<string>(
    PRODUCT_PRESETS[0].nameAr
  );
  const [productNameAr, setProductNameAr] = useState<string>(
    PRODUCT_PRESETS[0].nameAr
  );
  const [productNameEn, setProductNameEn] = useState<string>(
    PRODUCT_PRESETS[0].nameEn
  );
  const [materialType, setMaterialType] = useState<string>(
    PRODUCT_PRESETS[0].material
  );

  // Inspection measurements
  const [sampleSizeUnits, setSampleSizeUnits] = useState<number>(200);
  const [defectsCount, setDefectsCount] = useState<number>(2);
  const [primaryDefect, setPrimaryDefect] = useState<QualityDefectCategory>(
    'THICKNESS_VARIATION'
  );
  const [defectBreakdown, setDefectBreakdown] = useState<
    Partial<Record<QualityDefectCategory, number>>
  >({
    THICKNESS_VARIATION: 2,
  });

  // Physical specifications
  const [targetThicknessMicrons, setTargetThicknessMicrons] = useState<number>(
    PRODUCT_PRESETS[0].targetThickness
  );
  const [measuredThicknessMicrons, setMeasuredThicknessMicrons] =
    useState<number>(PRODUCT_PRESETS[0].targetThickness);
  const [tensileStrengthMPa, setTensileStrengthMPa] = useState<number>(26.5);
  const [visualDefectScore, setVisualDefectScore] = useState<number>(9);

  // Disposition
  const [disposition, setDisposition] =
    useState<QualitySampleDisposition>('APPROVED');
  const [regrindWeightKG, setRegrindWeightKG] = useState<number>(0);
  const [inspectorName, setInspectorName] = useState<string>(
    currentUser?.nameAr || 'م. فراس الخفاجي'
  );
  const [operatorNotes, setOperatorNotes] = useState<string>('');

  if (!isOpen) return null;

  // Real-time calculation of Defect Rate %
  const defectRatePct =
    sampleSizeUnits > 0
      ? Number(((defectsCount / sampleSizeUnits) * 100).toFixed(2))
      : 0;

  // Selected Machine Meta
  const selectedMachineMeta =
    FACTORY_QC_LINES.find((m) => m.code === machineCode) || FACTORY_QC_LINES[0];

  // Auto-handle product preset change
  const handleProductPresetSelect = (name: string) => {
    const preset = PRODUCT_PRESETS.find((p) => p.nameAr === name);
    if (preset) {
      setSelectedProductPreset(preset.nameAr);
      setProductNameAr(preset.nameAr);
      setProductNameEn(preset.nameEn);
      setMaterialType(preset.material);
      setTargetThicknessMicrons(preset.targetThickness);
      setMeasuredThicknessMicrons(preset.targetThickness);
      setMachineCode(preset.machineCode);
    }
  };

  // Helper to change defect count on breakdown
  const handleUpdateBreakdown = (
    cat: QualityDefectCategory,
    delta: number
  ) => {
    const current = defectBreakdown[cat] || 0;
    const nextVal = Math.max(0, current + delta);
    const updated = { ...defectBreakdown, [cat]: nextVal };
    setDefectBreakdown(updated);

    // Sum all defects
    const total = (Object.values(updated) as (number | undefined)[]).reduce<number>(
      (sum, n) => sum + (n ?? 0),
      0
    );
    setDefectsCount(total);

    // If this category is highest, make it primary
    if (nextVal > 0 && nextVal >= (updated[primaryDefect] || 0)) {
      setPrimaryDefect(cat);
    }

    // Auto-suggest disposition based on defect rate
    const simulatedRate =
      sampleSizeUnits > 0 ? (total / sampleSizeUnits) * 100 : 0;
    if (simulatedRate > 5.0) {
      setDisposition('REJECTED_SCRAP');
      if (regrindWeightKG === 0) setRegrindWeightKG(120);
    } else if (simulatedRate > 2.5) {
      setDisposition('MARGINAL_PASS');
    } else {
      setDisposition('APPROVED');
    }
  };

  // Handle Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { id, sampleNumber } = generateNextQCSampleNumber();
    const actionTakenAr =
      disposition === 'APPROVED'
        ? 'تمت الموافقة وتمرير الدفعة للتعبئة'
        : disposition === 'MARGINAL_PASS'
        ? 'موافقة مشروطة كنخب ثانٍ'
        : disposition === 'QUARANTINED'
        ? 'تم حجز الدفعة لإعادة الفحص المخبري'
        : `تم الرفض كخردة وتحويل ${regrindWeightKG || 0} كغم إلى مفرمة ومجرشة الثرم SHR-360`;

    const newSample: QualitySample = {
      id,
      sampleNumber,
      timestamp: new Date().toISOString(),
      date,
      timeSlot,
      shift,
      machineCode,
      machineNameAr: selectedMachineMeta.nameAr,
      batchLotNumber,
      orderNumber,
      productNameAr,
      productNameEn,
      materialType,
      sampleSizeUnits: Number(sampleSizeUnits),
      defectsCount: Number(defectsCount),
      defectRatePct,
      primaryDefect,
      defectBreakdown,
      disposition,
      targetThicknessMicrons:
        targetThicknessMicrons > 0 ? Number(targetThicknessMicrons) : undefined,
      measuredThicknessMicrons:
        measuredThicknessMicrons > 0
          ? Number(measuredThicknessMicrons)
          : undefined,
      tensileStrengthMPa:
        tensileStrengthMPa > 0 ? Number(tensileStrengthMPa) : undefined,
      visualDefectScore: Number(visualDefectScore),
      inspectorName: inspectorName.trim() || 'فاحص الجودة المناوب',
      operatorNotes: operatorNotes.trim() || undefined,
      regrindWeightKG:
        disposition === 'REJECTED_SCRAP' ? Number(regrindWeightKG) : undefined,
      actionTakenAr,
      createdAt: new Date().toISOString(),
    };

    saveQualitySample(newSample);
    onSampleSaved(newSample);

    logAudit(
      'Quality Sample Recorded',
      `تسجيل عينة فحص جودة فورية [${sampleNumber}] بنسبة عيوب ${defectRatePct}%`,
      'QualityControl',
      newSample.id,
      `${selectedMachineMeta.nameAr} (${machineCode}) - Lot: ${batchLotNumber}`,
      `Disposition: ${disposition} | Defect Rate: ${defectRatePct}% (${defectsCount}/${sampleSizeUnits})`,
      `Inspector: ${inspectorName}`
    );

    onClose();
  };

  // Calculate thickness deviation
  const thicknessDeviationPct =
    targetThicknessMicrons > 0
      ? Number(
          (
            ((measuredThicknessMicrons - targetThicknessMicrons) /
              targetThicknessMicrons) *
            100
          ).toFixed(1)
        )
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-4xl bg-gradient-to-b from-[#181a20] to-[#0e1015] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header Ribbon */}
        <div className="px-6 py-4 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-indigo-950/60 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>
                  {isRTL
                    ? 'تسجيل عينة فحص الجودة ونسب العيوب اللحظية'
                    : 'Input Real-Time Quality & Defect Rate Sample'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
                  LIVE QC
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'إدخال فوري للعينات وتحديث مصفوفة الخريطة الحرارية (Heatmap) في لوحة التحكم'
                  : 'Record real-time batch quality tests to instantly update the Command Center heatmap'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Section 1: Line, Shift, Time & Preset */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                {isRTL
                  ? '1. تحديد الماكينة والفترة الزمنية'
                  : '1. Machine Line & Time Window'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isRTL
                  ? `الحد المستهدف للعيوب: ${selectedMachineMeta.nominalTargetRatePct}%`
                  : `Target Defect Ceiling: ${selectedMachineMeta.nominalTargetRatePct}%`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Machine Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'خط الإنتاج / الماكينة' : 'Machine / Line'}
                </label>
                <select
                  value={machineCode}
                  onChange={(e) => setMachineCode(e.target.value)}
                  className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                >
                  {FACTORY_QC_LINES.map((line) => (
                    <option key={line.code} value={line.code}>
                      {line.code} - {line.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'الوردية' : 'Shift'}
                </label>
                <select
                  value={shift}
                  onChange={(e) =>
                    setShift(e.target.value as 'Morning' | 'Evening' | 'Night')
                  }
                  className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="Morning">{isRTL ? 'الوردية الصباحية (06:00 - 14:00)' : 'Morning Shift'}</option>
                  <option value="Evening">{isRTL ? 'الوردية المسائية (14:00 - 22:00)' : 'Evening Shift'}</option>
                  <option value="Night">{isRTL ? 'الوردية الليلية (22:00 - 06:00)' : 'Night Shift'}</option>
                </select>
              </div>

              {/* Time Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'نافذة التوقيت (للهيتماب)' : 'Time Slot Window'}
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                >
                  {TIME_SLOTS_DEF.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {isRTL ? slot.labelAr : slot.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'تاريخ الفحص' : 'Inspection Date'}
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Quick Product Preset Selector */}
            <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold">
                {isRTL ? 'قوالب المنتجات السريعة:' : 'Quick Presets:'}
              </span>
              {PRODUCT_PRESETS.slice(0, 4).map((p) => (
                <button
                  type="button"
                  key={p.nameAr}
                  onClick={() => handleProductPresetSelect(p.nameAr)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    selectedProductPreset === p.nameAr
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                >
                  {p.machineCode} - {p.nameAr.slice(0, 24)}...
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Batch & Product Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isRTL ? 'رقم اللوط / التشغيلة' : 'Batch / Lot #'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={batchLotNumber}
                  onChange={(e) => setBatchLotNumber(e.target.value)}
                  required
                  className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const code = machineCode.replace('-', '');
                    setBatchLotNumber(
                      `LOT-${d.getFullYear()}-${code}-${Math.floor(100 + Math.random() * 900)}`
                    );
                  }}
                  title={isRTL ? 'توليد رقم لوط جديد' : 'Regenerate Lot #'}
                  className="absolute end-2 top-2 text-slate-400 hover:text-cyan-400"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isRTL ? 'أمر الإنتاج المرتبط' : 'Production Order #'}
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="PO-2026-XXXX"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isRTL ? 'اسم المنتج أو الرول' : 'Product Description'}
              </label>
              <input
                type="text"
                value={productNameAr}
                onChange={(e) => setProductNameAr(e.target.value)}
                required
                className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Defect Rate Calculator Banner (Interactive Real-Time) */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-[#14161f] to-slate-900 border border-cyan-500/30 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 font-mono">
                  {isRTL ? 'حاسبة نسبة العيوب المباشرة' : 'REAL-TIME DEFECT METRIC'}
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span
                    className={`text-3xl font-black font-mono ${
                      defectRatePct < 1.5
                        ? 'text-emerald-400'
                        : defectRatePct <= 3.0
                        ? 'text-cyan-300'
                        : defectRatePct <= 5.0
                        ? 'text-amber-400'
                        : 'text-rose-400 animate-pulse'
                    }`}
                  >
                    {defectRatePct}%
                  </span>
                  <span className="text-xs text-slate-400">
                    ({defectsCount} {isRTL ? 'معيب من أصل' : 'defects out of'}{' '}
                    {sampleSizeUnits} {isRTL ? 'عينة' : 'units'})
                  </span>
                </div>
              </div>

              {/* Dynamic Status Badge */}
              <div
                className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                  defectRatePct < 1.5
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : defectRatePct <= 3.0
                    ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                    : defectRatePct <= 5.0
                    ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                    : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                }`}
              >
                {defectRatePct < 1.5 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isRTL ? 'جودة ممتازة (نخب أول)' : 'Grade A - Optimal Quality'}</span>
                  </>
                ) : defectRatePct <= 3.0 ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>{isRTL ? 'مطابق للمواصفة القياسية' : 'Standard Compliance'}</span>
                  </>
                ) : defectRatePct <= 5.0 ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>{isRTL ? 'تنبيه: ارتفاع ملحوظ بالعيوب' : 'Elevated Defect Warning'}</span>
                  </>
                ) : (
                  <>
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>{isRTL ? 'حرج: تجاوز الحد الأقصى' : 'CRITICAL DEFECT SPIKE'}</span>
                  </>
                )}
              </div>
            </div>

            {/* Sliders for Sample Size & Total Defects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-white/10">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">
                    {isRTL ? 'حجم العينة المفحوصة (قطعة/متر/كيلو)' : 'Sample Size Tested'}
                  </span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {sampleSizeUnits}
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={sampleSizeUnits}
                  onChange={(e) => setSampleSizeUnits(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex gap-2 mt-1">
                  {[50, 100, 200, 500].map((val) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setSampleSizeUnits(val)}
                      className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-mono"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">
                    {isRTL ? 'إجمالي القطع المعيبة المكتشفة' : 'Defective Units Count'}
                  </span>
                  <span className="text-rose-400 font-mono font-bold">
                    {defectsCount}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (defectsCount > 0) {
                        setDefectsCount(defectsCount - 1);
                        handleUpdateBreakdown(primaryDefect, -1);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={sampleSizeUnits}
                    value={defectsCount}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setDefectsCount(val);
                      setDefectBreakdown({ [primaryDefect]: val });
                    }}
                    className="w-24 text-center bg-[#111218] border border-white/20 rounded-lg py-1 text-sm font-mono text-white font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDefectsCount(defectsCount + 1);
                      handleUpdateBreakdown(primaryDefect, 1);
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Defect Category Breakdown (8 Plastic Factory Defect Types) */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {isRTL
                  ? '2. تصنيف أنواع العيوب المكتشفة بالعينات'
                  : '2. Defect Type Breakdown (Extrusion & Thermoforming)'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isRTL ? 'انقر على + أو - لتحديد كمية كل عيب' : 'Click + or - to tally defects'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {DEFECT_CATEGORIES_META.map((cat) => {
                const count = defectBreakdown[cat.id] || 0;
                const isPrimary = primaryDefect === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      count > 0
                        ? 'bg-slate-900/90 border-cyan-500/40 shadow-sm'
                        : 'bg-[#111218]/60 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">
                            {isRTL ? cat.labelAr : cat.labelEn}
                          </span>
                          {isPrimary && count > 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                              {isRTL ? 'رئيسي' : 'Major'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {cat.descriptionAr}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {count} {isRTL ? 'عيب' : 'defects'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateBreakdown(cat.id, -1)}
                          disabled={count <= 0}
                          className="w-6 h-6 rounded flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBreakdown(cat.id, 1)}
                          className="w-6 h-6 rounded flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Technical Gauges (Thickness, Tensile, Visual) */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Ruler className="w-4 h-4" />
              {isRTL ? '3. القياسات المخبرية والفنية' : '3. Laboratory Physical Measurements'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Gauge Thickness */}
              <div className="p-3 rounded-lg bg-[#111218] border border-white/10">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">
                    {isRTL ? 'سمك الفيلم (ميكرون μm)' : 'Film Gauge (Microns)'}
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      Math.abs(thicknessDeviationPct) <= 5
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    Δ {thicknessDeviationPct > 0 ? `+${thicknessDeviationPct}` : thicknessDeviationPct}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'المستهدف' : 'Target'}</span>
                    <input
                      type="number"
                      value={targetThicknessMicrons}
                      onChange={(e) => setTargetThicknessMicrons(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'المقاس الفعلي' : 'Measured'}</span>
                    <input
                      type="number"
                      value={measuredThicknessMicrons}
                      onChange={(e) => setMeasuredThicknessMicrons(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Tensile Strength */}
              <div className="p-3 rounded-lg bg-[#111218] border border-white/10">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">
                    {isRTL ? 'قوة الشد الميكانيكي (MPa)' : 'Tensile Strength (MPa)'}
                  </span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {tensileStrengthMPa} MPa
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="0.5"
                  value={tensileStrengthMPa}
                  onChange={(e) => setTensileStrengthMPa(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer mt-3"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  {isRTL ? 'الحد الأدنى المقبول: 20.0 MPa' : 'Min Acceptable: 20.0 MPa'}
                </span>
              </div>

              {/* Visual Score */}
              <div className="p-3 rounded-lg bg-[#111218] border border-white/10">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">
                    {isRTL ? 'درجة الفحص البصري والصفاء' : 'Visual Clarity & Finish (1-10)'}
                  </span>
                  <span className="text-amber-400 font-mono font-bold">
                    {visualDefectScore} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={visualDefectScore}
                  onChange={(e) => setVisualDefectScore(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer mt-3"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  {isRTL ? 'الشفافية وخلو السطح من الشوائب' : 'Surface gloss & transparency'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 6: Disposition & Decision */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {isRTL ? '4. قرار الفحص والتصنيف النهائي (Disposition)' : '4. Quality Disposition & Action'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                {
                  id: 'APPROVED',
                  labelAr: 'مقبول (نخب أول A+)',
                  labelEn: 'Approved - Grade A',
                  descAr: 'مطابق للمواصفات للتغليف الفوري',
                  color: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40',
                },
                {
                  id: 'MARGINAL_PASS',
                  labelAr: 'مشروط (نخب ثانٍ B)',
                  labelEn: 'Marginal Pass - Grade B',
                  descAr: 'قبول مشروط لأسواق التخفيض',
                  color: 'border-cyan-500/50 text-cyan-300 bg-cyan-950/40',
                },
                {
                  id: 'QUARANTINED',
                  labelAr: 'حجز فحص مخبري',
                  labelEn: 'Quarantined / Hold',
                  descAr: 'عزل مؤقت لإعادة الاختبار والتدقيق',
                  color: 'border-amber-500/50 text-amber-300 bg-amber-950/40',
                },
                {
                  id: 'REJECTED_SCRAP',
                  labelAr: 'مرفوض كخردة (للثرم)',
                  labelEn: 'Rejected - Regrind',
                  descAr: 'تحويل للمفرمة SHR-360 لإعادة التدوير',
                  color: 'border-rose-500/50 text-rose-300 bg-rose-950/40',
                },
              ].map((disp) => (
                <button
                  type="button"
                  key={disp.id}
                  onClick={() => setDisposition(disp.id as QualitySampleDisposition)}
                  className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                    disposition === disp.id
                      ? `${disp.color} ring-2 ring-cyan-500/30`
                      : 'bg-[#111218] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">
                      {isRTL ? disp.labelAr : disp.labelEn}
                    </span>
                    {disposition === disp.id && (
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">{disp.descAr}</p>
                </button>
              ))}
            </div>

            {/* If Rejected to Shredder, allow inputting weight */}
            {disposition === 'REJECTED_SCRAP' && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span>
                    {isRTL
                      ? 'وزن السكراب المحول مباشرة إلى مفرمة ومجرشة الثرم (SHR-360):'
                      : 'Weight routed to Granulator & Shredder SHR-360:'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={regrindWeightKG}
                    onChange={(e) => setRegrindWeightKG(Number(e.target.value))}
                    className="w-28 bg-[#111218] border border-rose-500/40 rounded-lg px-3 py-1 text-sm font-mono text-rose-200 font-bold text-center"
                  />
                  <span className="text-xs text-rose-300 font-bold">{isRTL ? 'كغم' : 'KG'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 7: Inspector Details & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                {isRTL ? 'اسم فاحص الجودة / المشرف' : 'Inspector / QC Engineer'}
              </label>
              <input
                type="text"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                required
                className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                {isRTL ? 'ملاحظات المشغل والإجراء المتخذ' : 'Operator Remarks & Corrective Action'}
              </label>
              <input
                type="text"
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder={
                  isRTL
                    ? 'مثال: تم تعديل تيار الهواء في حلقة التبريد وضبط سرعة السحب...'
                    : 'e.g., Adjusted dual lip air ring, cleared die lip...'
                }
                className="w-full bg-[#111218] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isRTL
                  ? 'حفظ العينة وتحديث الخريطة الحرارية فوراً'
                  : 'Save Sample & Update Heatmap'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
