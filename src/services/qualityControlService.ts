import {
  QualitySample,
  QualityDefectCategory,
  QualitySampleDisposition,
  QualityHeatmapCell,
} from '../types';
import { db } from './firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'al_karwan_quality_samples_v1';

export interface DefectCategoryMeta {
  id: QualityDefectCategory;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  defaultSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const DEFECT_CATEGORIES_META: DefectCategoryMeta[] = [
  {
    id: 'THICKNESS_VARIATION',
    labelAr: 'تفاوت السمك (Gauge)',
    labelEn: 'Gauge Variation',
    descriptionAr: 'انحراف في سمك الفيلم أو الشيت خارج حدود التفاوت',
    defaultSeverity: 'MEDIUM',
  },
  {
    id: 'CONTAMINATION_SPECKS',
    labelAr: 'شوائب ونقاط سوداء',
    labelEn: 'Black Specks / Contamination',
    descriptionAr: 'شوائب كربونية أو مواد غير ممتزجة في المصهور',
    defaultSeverity: 'HIGH',
  },
  {
    id: 'GEL_FISH_EYES',
    labelAr: 'عيون السمكة (جل غير منصهر)',
    labelEn: 'Fish Eyes / Unmelted Gels',
    descriptionAr: 'حبيبات جل غير منصهرة تؤدي لتمزق الفيلم',
    defaultSeverity: 'MEDIUM',
  },
  {
    id: 'PINHOLES_VOIDS',
    labelAr: 'ثقوب وتجاويف هوائية',
    labelEn: 'Pinholes & Air Voids',
    descriptionAr: 'فقاعات رطوبة محبوسة أو ثقوب مجهرية بالفيلم',
    defaultSeverity: 'HIGH',
  },
  {
    id: 'COLOR_STREAKS',
    labelAr: 'تموج وتدرج لوني',
    labelEn: 'Color Streaks / Haze',
    descriptionAr: 'توزيع غير متجانس للماسترباتش أو عتامة غير مطابقة',
    defaultSeverity: 'LOW',
  },
  {
    id: 'WARPING_CURL',
    labelAr: 'التواء وانحناء الحواف',
    labelEn: 'Edge Curl & Warping',
    descriptionAr: 'تبريد غير متكافئ بين حواف الشيت والمنتصف',
    defaultSeverity: 'MEDIUM',
  },
  {
    id: 'MELT_FLOW_BRITTLE',
    labelAr: 'هشاشة وضعف الشد',
    labelEn: 'Brittleness / Low Tensile',
    descriptionAr: 'تكسر سريع أثناء السحب أو التشكيل الحراري',
    defaultSeverity: 'HIGH',
  },
  {
    id: 'DIMENSIONAL_OFFSET',
    labelAr: 'أبعاد خارج التفاوت المسموح',
    labelEn: 'Dimensional Offset',
    descriptionAr: 'انحراف في عرض الرول أو الأطوال المقطوعة',
    defaultSeverity: 'MEDIUM',
  },
];

export interface QCLineDefinition {
  code: string;
  nameAr: string;
  nameEn: string;
  category: 'EXTRUSION' | 'SHREDDING' | 'THERMOFORMING';
  nominalTargetRatePct: number; // e.g. max target defect rate: 1.5%
}

export const FACTORY_QC_LINES: QCLineDefinition[] = [
  { code: 'EXT-01', nameAr: 'خط بثق 1 - فيلم زراعي عريض', nameEn: 'Extrusion Line 1 (Agri Film)', category: 'EXTRUSION', nominalTargetRatePct: 1.5 },
  { code: 'EXT-02', nameAr: 'خط بثق 2 - شرينك فيلم حراري', nameEn: 'Extrusion Line 2 (Shrink Film)', category: 'EXTRUSION', nominalTargetRatePct: 1.2 },
  { code: 'EXT-03', nameAr: 'خط بثق 3 - أكياس تسوق HDPE', nameEn: 'Extrusion Line 3 (HDPE Bags)', category: 'EXTRUSION', nominalTargetRatePct: 2.0 },
  { code: 'EXT-04', nameAr: 'خط بثق 4 - شيت PET سميك', nameEn: 'Extrusion Line 4 (Rigid PET Sheet)', category: 'EXTRUSION', nominalTargetRatePct: 1.0 },
  { code: 'EXT-05', nameAr: 'خط بثق 5 - نايلون تغليف غذائي', nameEn: 'Extrusion Line 5 (Food Wrap Film)', category: 'EXTRUSION', nominalTargetRatePct: 1.0 },
  { code: 'EXT-06', nameAr: 'خط بثق 6 - فيلم متعدد الطبقات', nameEn: 'Extrusion Line 6 (Multi-Layer Barrier)', category: 'EXTRUSION', nominalTargetRatePct: 1.5 },
  { code: 'SHR-360', nameAr: 'مفرمة ومجرشة الحبيبات 360', nameEn: 'Granulator & Shredder 360', category: 'SHREDDING', nominalTargetRatePct: 2.5 },
  { code: 'THF-01', nameAr: 'خط التشكيل الحراري للعبوات', nameEn: 'Thermoforming Line 1 (Containers)', category: 'THERMOFORMING', nominalTargetRatePct: 1.8 },
];

export const TIME_SLOTS_DEF = [
  { key: '06:00 - 09:00', labelAr: '06:00 - 09:00 (صباحي)', labelEn: '06:00 - 09:00 (M-Early)' },
  { key: '09:00 - 12:00', labelAr: '09:00 - 12:00 (صباحي)', labelEn: '09:00 - 12:00 (M-Peak)' },
  { key: '12:00 - 15:00', labelAr: '12:00 - 15:00 (تبديل)', labelEn: '12:00 - 15:00 (Midday)' },
  { key: '15:00 - 18:00', labelAr: '15:00 - 18:00 (مسائي)', labelEn: '15:00 - 18:00 (E-Early)' },
  { key: '18:00 - 21:00', labelAr: '18:00 - 21:00 (مسائي)', labelEn: '18:00 - 21:00 (E-Peak)' },
  { key: '21:00 - 00:00', labelAr: '21:00 - 00:00 (ليلي)', labelEn: '21:00 - 00:00 (Night)' },
  { key: '00:00 - 06:00', labelAr: '00:00 - 06:00 (فجر)', labelEn: '00:00 - 06:00 (Graveyard)' },
];

// Seed Initial Realistic Factory Quality Samples
export const INITIAL_QUALITY_SAMPLES: QualitySample[] = [
  {
    id: 'QC-2026-001',
    sampleNumber: 'QC-2026-001',
    timestamp: '2026-09-17T06:45:00Z',
    date: '2026-09-17',
    timeSlot: '06:00 - 09:00',
    shift: 'Morning',
    machineCode: 'EXT-01',
    machineNameAr: 'خط بثق 1 - فيلم زراعي عريض',
    batchLotNumber: 'LOT-2026-AG01',
    orderNumber: 'PO-2026-0881',
    productNameAr: 'فيلم زراعي مقاوم للأشعة فوق البنفسجية UV 120μm',
    productNameEn: 'UV-Stabilized Agri Greenhouse Film 120μm',
    materialType: 'LDPE / LLDPE',
    sampleSizeUnits: 200,
    defectsCount: 2,
    defectRatePct: 1.0,
    primaryDefect: 'THICKNESS_VARIATION',
    defectBreakdown: { THICKNESS_VARIATION: 2 },
    disposition: 'APPROVED',
    targetThicknessMicrons: 120,
    measuredThicknessMicrons: 121,
    tensileStrengthMPa: 24.5,
    visualDefectScore: 9,
    inspectorName: 'م. فراس الخفاجي (فاحص الجودة)',
    operatorNotes: 'استقرار ممتاز في حلقة الهواء وبرج السحب، التفاوت ضمن الحدود المسموحة ±3%',
    actionTakenAr: 'اعتماد الرول وإرساله لمستودع التغليف',
    createdAt: '2026-09-17T06:50:00Z',
  },
  {
    id: 'QC-2026-002',
    sampleNumber: 'QC-2026-002',
    timestamp: '2026-09-17T08:15:00Z',
    date: '2026-09-17',
    timeSlot: '06:00 - 09:00',
    shift: 'Morning',
    machineCode: 'EXT-03',
    machineNameAr: 'خط بثق 3 - أكياس تسوق HDPE',
    batchLotNumber: 'LOT-2026-BG03',
    orderNumber: 'PO-2026-0883',
    productNameAr: 'رول أكياس تسوق ناعمة HDPE عالي الكثافة 18μm',
    productNameEn: 'HDPE Carrier Bag Film Roll 18μm',
    materialType: 'HDPE Virgin + Regrind',
    sampleSizeUnits: 300,
    defectsCount: 14,
    defectRatePct: 4.67,
    primaryDefect: 'GEL_FISH_EYES',
    defectBreakdown: { GEL_FISH_EYES: 9, PINHOLES_VOIDS: 5 },
    disposition: 'MARGINAL_PASS',
    targetThicknessMicrons: 18,
    measuredThicknessMicrons: 17.2,
    tensileStrengthMPa: 31.0,
    visualDefectScore: 6,
    inspectorName: 'م. فراس الخفاجي',
    operatorNotes: 'ظهور عيون سمكة ناتجة عن عدم تجانس مادة الريجرايند، تم رفع حرارة الزون 3 بمقدار 5 درجات',
    actionTakenAr: 'موافقة مشروطة مع توجيه الفني لمراقبة فلاتر الشاشة الهيدروليكية',
    createdAt: '2026-09-17T08:20:00Z',
  },
  {
    id: 'QC-2026-003',
    sampleNumber: 'QC-2026-003',
    timestamp: '2026-09-17T09:30:00Z',
    date: '2026-09-17',
    timeSlot: '09:00 - 12:00',
    shift: 'Morning',
    machineCode: 'EXT-04',
    machineNameAr: 'خط بثق 4 - شيت PET سميك',
    batchLotNumber: 'LOT-2026-PET04',
    orderNumber: 'PO-2026-0884',
    productNameAr: 'شيت بولي إيثيلين تيريفثالات شفاف 450μm للتشكيل الحراري',
    productNameEn: 'Rigid Thermoforming PET Sheet 450μm',
    materialType: 'RPET Flakes 70% + Virgin 30%',
    sampleSizeUnits: 150,
    defectsCount: 1,
    defectRatePct: 0.67,
    primaryDefect: 'CONTAMINATION_SPECKS',
    defectBreakdown: { CONTAMINATION_SPECKS: 1 },
    disposition: 'APPROVED',
    targetThicknessMicrons: 450,
    measuredThicknessMicrons: 452,
    tensileStrengthMPa: 52.0,
    visualDefectScore: 9.5,
    inspectorName: 'م. كنعان البياتي',
    operatorNotes: 'شفافية بلورية عالية، انتظام مثالي في درافيل الكالندر والتبريد السريع',
    actionTakenAr: 'اعتماد الشيت ووسمه بباركود النخب الأول A+',
    createdAt: '2026-09-17T09:35:00Z',
  },
  {
    id: 'QC-2026-004',
    sampleNumber: 'QC-2026-004',
    timestamp: '2026-09-17T10:10:00Z',
    date: '2026-09-17',
    timeSlot: '09:00 - 12:00',
    shift: 'Morning',
    machineCode: 'SHR-360',
    machineNameAr: 'مفرمة ومجرشة الحبيبات 360',
    batchLotNumber: 'LOT-2026-SHR12',
    orderNumber: 'PO-2026-0885',
    productNameAr: 'حبيبات وفليك PET مجروش ناعم 6 مم مغسول',
    productNameEn: 'Washed Clean PET Regrind Flakes 6mm',
    materialType: 'Post-Consumer Flakes',
    sampleSizeUnits: 100, // 100 sample hand checks
    defectsCount: 3,
    defectRatePct: 3.0,
    primaryDefect: 'CONTAMINATION_SPECKS',
    defectBreakdown: { CONTAMINATION_SPECKS: 3 },
    disposition: 'APPROVED',
    visualDefectScore: 8,
    inspectorName: 'علي جاسم الموسوي',
    operatorNotes: 'فحص نقاوة رقائق الجرش وخلوها من الملصقات وأغطية PP، ضمن النسبة المسموحة <0.1%',
    actionTakenAr: 'تحويل الشكائر إلى مستودع المواد الخام الجاهزة للبثق',
    createdAt: '2026-09-17T10:15:00Z',
  },
  {
    id: 'QC-2026-005',
    sampleNumber: 'QC-2026-005',
    timestamp: '2026-09-17T11:20:00Z',
    date: '2026-09-17',
    timeSlot: '09:00 - 12:00',
    shift: 'Morning',
    machineCode: 'EXT-06',
    machineNameAr: 'خط بثق 6 - فيلم متعدد الطبقات',
    batchLotNumber: 'LOT-2026-ML06',
    orderNumber: 'PO-2026-0886',
    productNameAr: 'فيلم عازل 5 طبقات EVOH لحفظ الأغذية',
    productNameEn: '5-Layer EVOH High Barrier Film',
    materialType: 'PE / EVOH / Tie',
    sampleSizeUnits: 250,
    defectsCount: 19,
    defectRatePct: 7.6,
    primaryDefect: 'THICKNESS_VARIATION',
    defectBreakdown: { THICKNESS_VARIATION: 11, PINHOLES_VOIDS: 5, GEL_FISH_EYES: 3 },
    disposition: 'REJECTED_SCRAP',
    targetThicknessMicrons: 85,
    measuredThicknessMicrons: 98,
    tensileStrengthMPa: 28.0,
    visualDefectScore: 4,
    inspectorName: 'م. كنعان البياتي',
    operatorNotes: 'انسداد جزئي في شفة الداي بالطبقة الوسطى أدى إلى تفاوت سمك كبير وظهور نقاط ضعف',
    regrindWeightKG: 185,
    actionTakenAr: 'عزل اللوط بالكامل ورفضه، وتحويل 185 كغم سكراب إلى مفرمة الثرم SHR-360 لإعادة الجرش',
    createdAt: '2026-09-17T11:28:00Z',
  },
  {
    id: 'QC-2026-006',
    sampleNumber: 'QC-2026-006',
    timestamp: '2026-09-17T13:00:00Z',
    date: '2026-09-17',
    timeSlot: '12:00 - 15:00',
    shift: 'Evening',
    machineCode: 'EXT-02',
    machineNameAr: 'خط بثق 2 - شرينك فيلم حراري',
    batchLotNumber: 'LOT-2026-SH02',
    orderNumber: 'PO-2026-0887',
    productNameAr: 'شرينك فيلم حراري لتغليف عبوات المياه 50μm',
    productNameEn: 'Thermal Shrink Bundling Film 50μm',
    materialType: 'LDPE Shrink Grade',
    sampleSizeUnits: 200,
    defectsCount: 3,
    defectRatePct: 1.5,
    primaryDefect: 'WARPING_CURL',
    defectBreakdown: { WARPING_CURL: 2, THICKNESS_VARIATION: 1 },
    disposition: 'APPROVED',
    targetThicknessMicrons: 50,
    measuredThicknessMicrons: 49.8,
    tensileStrengthMPa: 22.4,
    visualDefectScore: 8.5,
    inspectorName: 'م. فراس الخفاجي',
    operatorNotes: 'نسبة الانكماش الحراري الطولي والعرضي 65/20% مطابقة تماماً للمواصفة القياسية',
    actionTakenAr: 'اعتماد الدفعة وإرسال الرولات لقسم التقطيع والطباعة',
    createdAt: '2026-09-17T13:05:00Z',
  },
  {
    id: 'QC-2026-007',
    sampleNumber: 'QC-2026-007',
    timestamp: '2026-09-17T14:15:00Z',
    date: '2026-09-17',
    timeSlot: '12:00 - 15:00',
    shift: 'Evening',
    machineCode: 'THF-01',
    machineNameAr: 'خط التشكيل الحراري للعبوات',
    batchLotNumber: 'LOT-2026-TF01',
    orderNumber: 'PO-2026-0888',
    productNameAr: 'علب طعام مستطيلة مع غطاء شفاف 750 مل PET',
    productNameEn: 'PET Rectangular Food Containers 750ml',
    materialType: 'Thermoformed PET',
    sampleSizeUnits: 500,
    defectsCount: 8,
    defectRatePct: 1.6,
    primaryDefect: 'DIMENSIONAL_OFFSET',
    defectBreakdown: { DIMENSIONAL_OFFSET: 5, WARPING_CURL: 3 },
    disposition: 'APPROVED',
    visualDefectScore: 8.8,
    inspectorName: 'م. كنعان البياتي',
    operatorNotes: 'قفل الغطاء محكم وتوزيع السماكة في قاع القالب متناسق بعد تعديل ضغط الهواء السالب',
    actionTakenAr: 'تغليف الكراتين ونقلها لمستودع المنتجات تامة الصنع',
    createdAt: '2026-09-17T14:20:00Z',
  },
  {
    id: 'QC-2026-008',
    sampleNumber: 'QC-2026-008',
    timestamp: '2026-09-17T16:00:00Z',
    date: '2026-09-17',
    timeSlot: '15:00 - 18:00',
    shift: 'Evening',
    machineCode: 'EXT-05',
    machineNameAr: 'خط بثق 5 - نايلون تغليف غذائي',
    batchLotNumber: 'LOT-2026-FW05',
    orderNumber: 'PO-2026-0889',
    productNameAr: 'ستريتش فيلم ناعم عالي الاستطالة 15μm',
    productNameEn: 'High-Cling Stretch Wrap Film 15μm',
    materialType: 'LLDPE Cast Film',
    sampleSizeUnits: 300,
    defectsCount: 2,
    defectRatePct: 0.67,
    primaryDefect: 'THICKNESS_VARIATION',
    defectBreakdown: { THICKNESS_VARIATION: 2 },
    disposition: 'APPROVED',
    targetThicknessMicrons: 15,
    measuredThicknessMicrons: 15.1,
    tensileStrengthMPa: 36.0,
    visualDefectScore: 9.8,
    inspectorName: 'م. فراس الخفاجي',
    operatorNotes: 'قوة التصاق عالية وخالي تماماً من الثقوب أو خطوط الداي',
    actionTakenAr: 'اعتماد وتغليف فوري',
    createdAt: '2026-09-17T16:05:00Z',
  },
  {
    id: 'QC-2026-009',
    sampleNumber: 'QC-2026-009',
    timestamp: '2026-09-17T17:30:00Z',
    date: '2026-09-17',
    timeSlot: '15:00 - 18:00',
    shift: 'Evening',
    machineCode: 'EXT-03',
    machineNameAr: 'خط بثق 3 - أكياس تسوق HDPE',
    batchLotNumber: 'LOT-2026-BG04',
    orderNumber: 'PO-2026-0890',
    productNameAr: 'رول أكياس تسوق ملونة مع ماسترباتش أزرق',
    productNameEn: 'Blue Masterbatch HDPE Bag Roll',
    materialType: 'HDPE + Blue Color',
    sampleSizeUnits: 250,
    defectsCount: 8,
    defectRatePct: 3.2,
    primaryDefect: 'COLOR_STREAKS',
    defectBreakdown: { COLOR_STREAKS: 6, THICKNESS_VARIATION: 2 },
    disposition: 'MARGINAL_PASS',
    targetThicknessMicrons: 20,
    measuredThicknessMicrons: 20.4,
    visualDefectScore: 7,
    inspectorName: 'م. فراس الخفاجي',
    operatorNotes: 'خطوط زرقاء خفيفة ناتجة عن خلاط التغذية، تم تنظيف القمع وضبط نسبة الخلط',
    actionTakenAr: 'قبول مشروط للدرجة الثانية مع إشعار إدارة الإنتاج',
    createdAt: '2026-09-17T17:35:00Z',
  },
];

// Load Quality Samples from localStorage
export function getStoredQualitySamples(): QualitySample[] {
  if (typeof window === 'undefined') return INITIAL_QUALITY_SAMPLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_QUALITY_SAMPLES));
      return INITIAL_QUALITY_SAMPLES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_QUALITY_SAMPLES;
  } catch (err) {
    console.error('Error loading quality samples from localStorage:', err);
    return INITIAL_QUALITY_SAMPLES;
  }
}

// Save or Append a Quality Sample
export function saveQualitySample(sample: QualitySample): QualitySample[] {
  const all = getStoredQualitySamples();
  const existingIdx = all.findIndex((s) => s.id === sample.id);
  let updated: QualitySample[];

  if (existingIdx >= 0) {
    updated = [...all];
    updated[existingIdx] = sample;
  } else {
    updated = [sample, ...all];
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('al_karwan_qc_updated', { detail: sample }));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  // Attempt async firestore sync
  try {
    const colRef = collection(db, 'quality_samples');
    setDoc(doc(colRef, sample.id), sample, { merge: true }).catch((err) => {
      console.log('[Firestore] QC Sample offline or saved locally:', err.message);
    });
  } catch (err) {
    // Non-blocking
  }

  return updated;
}

// Delete Quality Sample
export function deleteQualitySample(sampleId: string): QualitySample[] {
  const all = getStoredQualitySamples();
  const updated = all.filter((s) => s.id !== sampleId);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('al_karwan_qc_updated'));
  }
  return updated;
}

// Generate New Sample ID
export function generateNextQCSampleNumber(): { id: string; sampleNumber: string } {
  const all = getStoredQualitySamples();
  const count = all.length + 1;
  const sampleNumber = `QC-2026-${String(count).padStart(3, '0')}`;
  return { id: sampleNumber, sampleNumber };
}

// Helper: Determine status color band from defect rate
export function getDefectRateStatus(ratePct: number, hasData: boolean): 'OPTIMAL' | 'ACCEPTABLE' | 'WARNING' | 'CRITICAL' | 'NO_DATA' {
  if (!hasData) return 'NO_DATA';
  if (ratePct < 1.5) return 'OPTIMAL';
  if (ratePct <= 3.0) return 'ACCEPTABLE';
  if (ratePct <= 5.0) return 'WARNING';
  return 'CRITICAL';
}

// Generate Time-Slot Heatmap Matrix (Machine × Time Slot)
export function generateTimeSlotHeatmapMatrix(
  samples: QualitySample[],
  targetDate?: string
): {
  timeSlots: typeof TIME_SLOTS_DEF;
  lines: typeof FACTORY_QC_LINES;
  matrix: Record<string, Record<string, QualityHeatmapCell>>;
} {
  const filteredSamples = targetDate
    ? samples.filter((s) => s.date === targetDate)
    : samples;

  const matrix: Record<string, Record<string, QualityHeatmapCell>> = {};

  FACTORY_QC_LINES.forEach((line) => {
    matrix[line.code] = {};
    TIME_SLOTS_DEF.forEach((slot) => {
      const matching = filteredSamples.filter(
        (s) => s.machineCode === line.code && s.timeSlot === slot.key
      );

      const totalInspected = matching.reduce((sum, s) => sum + s.sampleSizeUnits, 0);
      const totalDefects = matching.reduce((sum, s) => sum + s.defectsCount, 0);
      const defectRatePct = totalInspected > 0 ? Number(((totalDefects / totalInspected) * 100).toFixed(2)) : 0;

      // Find primary defect
      const defectCounts: Partial<Record<QualityDefectCategory, number>> = {};
      matching.forEach((s) => {
        if (s.primaryDefect) {
          defectCounts[s.primaryDefect] = (defectCounts[s.primaryDefect] || 0) + (s.defectsCount || 1);
        }
      });
      let primaryDefect: QualityDefectCategory | undefined;
      let maxDefectCount = 0;
      Object.entries(defectCounts).forEach(([k, count]) => {
        if (count > maxDefectCount) {
          maxDefectCount = count;
          primaryDefect = k as QualityDefectCategory;
        }
      });

      const status = getDefectRateStatus(defectRatePct, matching.length > 0);

      matrix[line.code][slot.key] = {
        machineCode: line.code,
        machineNameAr: line.nameAr,
        columnKey: slot.key,
        columnLabelAr: slot.labelAr,
        columnLabelEn: slot.labelEn,
        defectRatePct,
        samplesCount: matching.length,
        totalDefects,
        totalInspected,
        primaryDefect,
        status,
        sampleIds: matching.map((s) => s.id),
      };
    });
  });

  return { timeSlots: TIME_SLOTS_DEF, lines: FACTORY_QC_LINES, matrix };
}

// Generate Defect-Type Heatmap Matrix (Machine × Defect Category)
export function generateDefectTypeHeatmapMatrix(
  samples: QualitySample[]
): {
  categories: typeof DEFECT_CATEGORIES_META;
  lines: typeof FACTORY_QC_LINES;
  matrix: Record<string, Record<string, QualityHeatmapCell>>;
} {
  const matrix: Record<string, Record<string, QualityHeatmapCell>> = {};

  FACTORY_QC_LINES.forEach((line) => {
    matrix[line.code] = {};
    DEFECT_CATEGORIES_META.forEach((cat) => {
      const matching = samples.filter((s) => s.machineCode === line.code);
      const totalInspected = matching.reduce((sum, s) => sum + s.sampleSizeUnits, 0);

      let catDefectCount = 0;
      matching.forEach((s) => {
        if (s.defectBreakdown && s.defectBreakdown[cat.id]) {
          catDefectCount += s.defectBreakdown[cat.id] || 0;
        } else if (s.primaryDefect === cat.id) {
          catDefectCount += s.defectsCount;
        }
      });

      const defectRatePct = totalInspected > 0 ? Number(((catDefectCount / totalInspected) * 100).toFixed(2)) : 0;
      const status = getDefectRateStatus(defectRatePct, totalInspected > 0);

      matrix[line.code][cat.id] = {
        machineCode: line.code,
        machineNameAr: line.nameAr,
        columnKey: cat.id,
        columnLabelAr: cat.labelAr,
        columnLabelEn: cat.labelEn,
        defectRatePct,
        samplesCount: matching.length,
        totalDefects: catDefectCount,
        totalInspected,
        primaryDefect: cat.id,
        status,
        sampleIds: matching.filter((s) => s.primaryDefect === cat.id).map((s) => s.id),
      };
    });
  });

  return { categories: DEFECT_CATEGORIES_META, lines: FACTORY_QC_LINES, matrix };
}

// Compute Factory Quality KPIs
export function computeFactoryQualityKPIs(samples: QualitySample[]) {
  const totalSamples = samples.length;
  const totalUnitsInspected = samples.reduce((sum, s) => sum + s.sampleSizeUnits, 0);
  const totalDefectsCount = samples.reduce((sum, s) => sum + s.defectsCount, 0);

  const averageDefectRate = totalUnitsInspected > 0
    ? Number(((totalDefectsCount / totalUnitsInspected) * 100).toFixed(2))
    : 0;

  const firstPassYield = totalUnitsInspected > 0
    ? Number((100 - averageDefectRate).toFixed(2))
    : 100;

  const approvedCount = samples.filter((s) => s.disposition === 'APPROVED').length;
  const marginalCount = samples.filter((s) => s.disposition === 'MARGINAL_PASS').length;
  const quarantinedCount = samples.filter((s) => s.disposition === 'QUARANTINED').length;
  const rejectedCount = samples.filter((s) => s.disposition === 'REJECTED_SCRAP').length;

  const totalRegrindShredderKG = samples.reduce((sum, s) => sum + (s.regrindWeightKG || 0), 0);

  // Identify machine with highest defect rate
  const machineTotals: Record<string, { inspected: number; defects: number; nameAr: string }> = {};
  samples.forEach((s) => {
    if (!machineTotals[s.machineCode]) {
      machineTotals[s.machineCode] = { inspected: 0, defects: 0, nameAr: s.machineNameAr };
    }
    machineTotals[s.machineCode].inspected += s.sampleSizeUnits;
    machineTotals[s.machineCode].defects += s.defectsCount;
  });

  let worstMachine = { code: 'NONE', nameAr: 'لا يوجد', ratePct: 0 };
  Object.entries(machineTotals).forEach(([code, data]) => {
    if (data.inspected > 0) {
      const rate = (data.defects / data.inspected) * 100;
      if (rate > worstMachine.ratePct) {
        worstMachine = { code, nameAr: data.nameAr, ratePct: Number(rate.toFixed(2)) };
      }
    }
  });

  // Identify most frequent defect
  const defectCounts: Partial<Record<QualityDefectCategory, number>> = {};
  samples.forEach((s) => {
    Object.entries(s.defectBreakdown || {}).forEach(([cat, count]) => {
      defectCounts[cat as QualityDefectCategory] = (defectCounts[cat as QualityDefectCategory] || 0) + (count || 0);
    });
    if (s.primaryDefect && (!s.defectBreakdown || Object.keys(s.defectBreakdown).length === 0)) {
      defectCounts[s.primaryDefect] = (defectCounts[s.primaryDefect] || 0) + s.defectsCount;
    }
  });

  let topDefectCategory: { category: QualityDefectCategory | 'NONE'; count: number; meta?: DefectCategoryMeta } = {
    category: 'NONE',
    count: 0,
  };
  Object.entries(defectCounts).forEach(([cat, count]) => {
    if (count > topDefectCategory.count) {
      const meta = DEFECT_CATEGORIES_META.find((m) => m.id === cat);
      topDefectCategory = {
        category: cat as QualityDefectCategory,
        count,
        meta,
      };
    }
  });

  return {
    totalSamples,
    totalUnitsInspected,
    totalDefectsCount,
    averageDefectRate,
    firstPassYield,
    approvedCount,
    marginalCount,
    quarantinedCount,
    rejectedCount,
    totalRegrindShredderKG,
    worstMachine,
    topDefectCategory,
  };
}
