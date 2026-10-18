export type ImportWorkflowStep =
  | 'UPLOAD'             // 1. رفع الملف
  | 'WORKBOOK_ANALYSIS'  // 2. تحليل المصنف
  | 'DATA_DETECTION'     // 3. اكتشاف البيانات وتحديد النطاقات
  | 'MAP_COLUMNS'        // 4. مطابقة الأعمدة
  | 'MATERIAL_MATCH'     // 5. مطابقة المواد واقتراحات الذكاء الاصطناعي
  | 'VALIDATION'         // 6. التحقق والتدقيق
  | 'DATA_PREVIEW'       // 7. جدول المعاينة الشامل
  | 'INVENTORY_IMPACT'   // 8. تأثير المخزون (Projected Stock)
  | 'COMMIT_MIGRATION'   // 9. اعتماد وترحيل البيانات
  | 'DIAGNOSTICS';       // وضع الفحص والتشخيص العميق (Diagnostic Inspection Mode)

export interface StepDefinition {
  id: ImportWorkflowStep;
  stepNum: number;
  titleAr: string;
  titleEn: string;
  shortDescAr: string;
  shortDescEn: string;
}

export const WORKFLOW_STEPS: StepDefinition[] = [
  {
    id: 'UPLOAD',
    stepNum: 1,
    titleAr: 'رفع الملف',
    titleEn: 'Upload File',
    shortDescAr: 'اختيار أو إسقاط ملف Excel / نماذج المصنع',
    shortDescEn: 'Select or drop Excel file / Factory presets',
  },
  {
    id: 'WORKBOOK_ANALYSIS',
    stepNum: 2,
    titleAr: 'تحليل المصنف',
    titleEn: 'Workbook Analysis',
    shortDescAr: 'قراءة الهيكلية وعزل صفوف المجاميع',
    shortDescEn: 'Structure parsing & totals isolation',
  },
  {
    id: 'DATA_DETECTION',
    stepNum: 3,
    titleAr: 'اكتشاف النطاقات',
    titleEn: 'Data Regions',
    shortDescAr: 'تحديد نطاق البيانات والعناوين والفواصل',
    shortDescEn: 'Bounding boxes, titles & ignored template rows',
  },
  {
    id: 'MAP_COLUMNS',
    stepNum: 4,
    titleAr: 'مطابقة الأعمدة',
    titleEn: 'Column Mapping',
    shortDescAr: 'ربط أعمدة الإكسل بحقول النظام',
    shortDescEn: 'Associate detected headers with system fields',
  },
  {
    id: 'MATERIAL_MATCH',
    stepNum: 5,
    titleAr: 'مطابقة المواد',
    titleEn: 'Material Match',
    shortDescAr: 'المطابقة الذكية وتصحيح المسميات',
    shortDescEn: 'Fuzzy string matching against Item Master',
  },
  {
    id: 'VALIDATION',
    stepNum: 6,
    titleAr: 'التحقق والتدقيق',
    titleEn: 'Smart Validation',
    shortDescAr: 'فحص الحقول ومنع الأخطاء الوهمية',
    shortDescEn: '3-Tier validation (ERROR, WARNING, INFO)',
  },
  {
    id: 'DATA_PREVIEW',
    stepNum: 7,
    titleAr: 'معاينة الحركات',
    titleEn: 'Data Preview',
    shortDescAr: 'جدول الحركات التفصيلي مع الفلاتر',
    shortDescEn: 'ERP transaction grid with row-level actions',
  },
  {
    id: 'INVENTORY_IMPACT',
    stepNum: 8,
    titleAr: 'تأثير المخزون',
    titleEn: 'Stock Impact',
    shortDescAr: 'توقع ومحاكاة الأرصدة بعد الترحيل',
    shortDescEn: 'Pre-commit inventory simulation & safety check',
  },
  {
    id: 'COMMIT_MIGRATION',
    stepNum: 9,
    titleAr: 'اعتماد الترحيل',
    titleEn: 'Commit Migration',
    shortDescAr: 'الترحيل النهائي وسجل التدقيق',
    shortDescEn: 'Commit to central database & audit log',
  },
];
