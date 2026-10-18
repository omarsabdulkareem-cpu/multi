import * as XLSX from 'xlsx';
import { MaterialItem, Supplier, Warehouse, WarehouseLocation, InventoryMovement, ReceivingTransaction, ShreddingTransaction, ProductionIssue } from '../types';
import { SystemCodesAPI } from './systemCodesService';
import {
  detectWorkbookHierarchy,
  analyzeSheetStructure,
  HierarchicalWorkbookReport,
  SheetStructuralAnalysis,
  StructuralBand,
  HiddenRowInfo,
  HiddenColInfo,
  HierarchicalHeaderNode,
  ResolvedColumnHeader,
} from './hierarchicalParserService';
import {
  StandardRowCategory,
  MaterialMatchMethod,
  WeightParseTrace,
  BulkBagParseTrace,
  BulkBagParseResult,
  CellInspectionItem,
  ColumnMappingInspection,
  RowClassificationInspection,
  ParserHealthScore,
  MaterialMatchResult,
  RawWorkbookInspection,
  AnomalyTracerReport,
  normalizeArabicText,
  normalizeEasternNumerals,
  parseRobustWeight,
  parseRobustBulkBags,
  classifyStandardRow,
  matchMaterialFuzzy,
  traceSixKgAndIsolatedRows,
  inspectRawWorkbookStructure,
} from './excelParsingCore';

export * from './hierarchicalParserService';
export type {
  StandardRowCategory,
  MaterialMatchMethod,
  WeightParseTrace,
  BulkBagParseTrace,
  BulkBagParseResult,
  CellInspectionItem,
  ColumnMappingInspection,
  RowClassificationInspection,
  ParserHealthScore,
  MaterialMatchResult,
  RawWorkbookInspection,
  AnomalyTracerReport,
} from './excelParsingCore';
export {
  normalizeEasternNumerals,
  parseRobustWeight,
  parseRobustBulkBags,
  classifyStandardRow,
  matchMaterialFuzzy,
  traceSixKgAndIsolatedRows,
  inspectRawWorkbookStructure,
};

export interface ColumnMapping {
  colIndex: number;
  rawHeader: string;
  mappedField:
    | 'material'
    | 'materialCode'
    | 'weight'
    | 'grossKG'
    | 'tareKG'
    | 'netKG'
    | 'inputKG'
    | 'outputKG'
    | 'damageKG'
    | 'bulkBags'
    | 'supplier'
    | 'docRef'
    | 'date'
    | 'time'
    | 'location'
    | 'warehouse'
    | 'line'
    | 'driver'
    | 'vehicle'
    | 'notes'
    | 'unknown';
  fieldLabelAr: string;
  fieldLabelEn: string;
  confidence: number;
}

export type ExcelDocType =
  | '546' // استلام مواد خامات
  | '360' // استلام مخزن الثرم
  | '167' // صادر مواد خامات للإنتاج
  | '352' // صادر من المخزن إلى الثرم
  | 'RAW_STORE_9' // جرد وأرصدة مخزن الخامات 9
  | 'THERM_CAPACITY_9' // طاقة مخزنية لمخزن الثرم -9
  | 'INVENTORY_SNAPSHOT' // أرصدة وطاقة مخزنية
  | 'SHREDDING_PROD' // إنتاج مفروم الثرم
  | 'PROD_DAMAGE' // تالف إنتاج
  | 'TRANSFER' // مناقلة بين المستودعات
  | 'GENERAL_MOVEMENT';

export type RowValidationSeverity = 'VALID' | 'WARNING' | 'ERROR' | 'INFO';

export interface DataRegion {
  startRow: number; // 0-based
  endRow: number;   // 0-based
  startCol: number; // 0-based
  endCol: number;   // 0-based
  rowCount: number;
}

export interface AnalyzedDataRow {
  id: string;
  sourceRow: number; // 1-based original Excel row
  sourceSheet: string;
  rawCells: Record<string, any>;

  // Extracted fields
  materialRaw: string;
  materialMatchedId?: string;
  materialMatchedCode?: string;
  materialMatchedNameAr?: string;
  materialMatchedNameEn?: string;
  materialMatchConfidence: 'EXACT_CODE' | 'EXACT_NAME' | 'FUZZY_NAME' | 'POSSIBLE_MATCH' | 'UNMATCHED';
  materialMatchMethod?: MaterialMatchMethod;
  materialMatchScore?: number;
  materialMatchSuggestions?: any[];
  weightParseTrace?: WeightParseTrace;
  bulkBagParseTrace?: BulkBagParseTrace;
  rowCategory?: StandardRowCategory;

  supplierRaw?: string;
  supplierMatchedId?: string;
  supplierMatchedName?: string;

  docRef: string;
  legacyDocType: ExcelDocType;
  date: string;
  time?: string;

  // Weights (KG)
  grossKG?: number;
  tareKG?: number;
  netKG: number;
  inputKG?: number;
  outputKG?: number;
  damageKG?: number;

  // Bulk Bags (شلايف) - independent quantity, NOT converted to KG
  bulkBags: number;

  // Routing & Metadata
  warehouseId?: string;
  warehouseNameAr?: string;
  locationId?: string;
  locationCode?: string;
  line?: string;
  driver?: string;
  vehicle?: string;
  notes?: string;

  // Validation
  severity: RowValidationSeverity;
  messages: { text: string; severity: 'ERROR' | 'WARNING' | 'INFO' }[];
  isIgnoredByUser?: boolean;
  isDuplicate?: boolean;
  duplicateInfo?: string;
}

export interface SheetAnalysis {
  sheetName: string;
  totalRows: number;
  totalCols: number;
  usedRange: string;
  headerRowIndex: number; // 0-based
  dataRegion: DataRegion;
  detectedHeaders: ColumnMapping[];
  detectedType: ExcelDocType;
  typeConfidence: 'HIGH' | 'MEDIUM' | 'AUTO';
  typeTitleAr: string;
  typeTitleEn: string;
  transactionRowsCount: number;
  summaryRowsCount: number;
  ignoredRowsCount: number;
  dataRows: AnalyzedDataRow[];
  summaryRows: { rowIndex: number; text: string; values?: Record<string, any> }[];
  ignoredRows: { rowIndex: number; reason: string }[];
  titleRows: { rowIndex: number; text: string }[];
  detectedMergedCellsCount?: number;
  detectedDocNumber?: string;
  detectedDate?: string;
  rawMatrix?: any[][];
  sampleRows?: any[][];

  // Hierarchical parser additions
  hierarchicalStructure?: SheetStructuralAnalysis;
  headerDepth?: number;
  hiddenRowsCount?: number;
  hiddenColsCount?: number;
  hiddenRowsList?: HiddenRowInfo[];
  resolvedHierarchicalHeaders?: ResolvedColumnHeader[];
  headerTree?: HierarchicalHeaderNode[];
  structuralBands?: StructuralBand[];

  // 13-Phase Diagnostic & Forensic additions
  rawWorkbookInspection?: RawWorkbookInspection;
  anomalyTracer?: AnomalyTracerReport;
  classifiedRowsList?: { rowIndex: number; row: any[]; category: StandardRowCategory; reasonAr: string; reasonEn: string }[];
}

export interface MappableFieldDefinition {
  field: ColumnMapping['mappedField'];
  labelAr: string;
  labelEn: string;
  required: boolean;
  category: 'material' | 'weight' | 'metadata' | 'logistics' | 'other';
  descriptionAr: string;
  descriptionEn: string;
}

export const MAPPABLE_FIELDS_LIST: MappableFieldDefinition[] = [
  {
    field: 'material',
    labelAr: 'اسم المادة / الصنف',
    labelEn: 'Material Name',
    required: true,
    category: 'material',
    descriptionAr: 'الاسم النصي للمادة الخام أو المجروش أو الحبيبات',
    descriptionEn: 'Text name of the raw material, regrind or flakes',
  },
  {
    field: 'materialCode',
    labelAr: 'كود / رمز المادة',
    labelEn: 'Material Code',
    required: false,
    category: 'material',
    descriptionAr: 'رمز الصنف المرجعي (مثل PET-FLK-01, BTL-SHR-04)',
    descriptionEn: 'Item Master code (e.g. PET-FLK-01, BTL-SHR-04)',
  },
  {
    field: 'netKG',
    labelAr: 'الوزن الصافي (كغم)',
    labelEn: 'Net Weight (KG)',
    required: true,
    category: 'weight',
    descriptionAr: 'الوزن الصافي المستلم أو المصروف بالكيلوغرام',
    descriptionEn: 'Net transaction weight in kilograms',
  },
  {
    field: 'grossKG',
    labelAr: 'وزن الدخول (قائم)',
    labelEn: 'Gross Weight (KG)',
    required: false,
    category: 'weight',
    descriptionAr: 'الوزن القائم مع الشاحنة عند الدخول بالميزان',
    descriptionEn: 'Scale-in gross weighbridge reading',
  },
  {
    field: 'tareKG',
    labelAr: 'وزن الخروج (فارغ)',
    labelEn: 'Tare Weight (KG)',
    required: false,
    category: 'weight',
    descriptionAr: 'الوزن الفارغ للشاحنة عند الخروج بالميزان',
    descriptionEn: 'Scale-out tare weighbridge reading',
  },
  {
    field: 'bulkBags',
    labelAr: 'عدد الشلايف / الأكياس',
    labelEn: 'Bulk Bags Count',
    required: false,
    category: 'weight',
    descriptionAr: 'عدد الشلايف أو الأكياس الكبيرة (كمية مستقلة)',
    descriptionEn: 'Count of bulk bags / jumbo sacks (independent count)',
  },
  {
    field: 'docRef',
    labelAr: 'رقم المستند / الكبان',
    labelEn: 'Doc / Ticket Ref',
    required: false,
    category: 'metadata',
    descriptionAr: 'رقم إيصال الكبان أو مستند 546/360/167/352',
    descriptionEn: 'Document or weighbridge ticket number',
  },
  {
    field: 'supplier',
    labelAr: 'المورد / المصدر',
    labelEn: 'Supplier / Source',
    required: false,
    category: 'metadata',
    descriptionAr: 'اسم الجهة الموردة أو العميل أو المصدر',
    descriptionEn: 'Supplying company or scrap vendor',
  },
  {
    field: 'date',
    labelAr: 'تاريخ الحركة',
    labelEn: 'Date',
    required: false,
    category: 'metadata',
    descriptionAr: 'تاريخ وزن الشحنة أو حركة المخزون',
    descriptionEn: 'Transaction date (YYYY-MM-DD)',
  },
  {
    field: 'time',
    labelAr: 'وقت الحركة',
    labelEn: 'Time',
    required: false,
    category: 'metadata',
    descriptionAr: 'وقت تسجيل الحركة أو الوزن',
    descriptionEn: 'Time stamp of transaction',
  },
  {
    field: 'warehouse',
    labelAr: 'المستودع / المخزن',
    labelEn: 'Warehouse',
    required: false,
    category: 'logistics',
    descriptionAr: 'المستودع المستهدف (مثل مخزن الخامات 1 أو 9)',
    descriptionEn: 'Target warehouse location',
  },
  {
    field: 'location',
    labelAr: 'الموقع / الرف',
    labelEn: 'Rack / Bay Location',
    required: false,
    category: 'logistics',
    descriptionAr: 'رمز موقع التخزين الداخلي أو الرف',
    descriptionEn: 'Internal bin, rack, or bay code',
  },
  {
    field: 'line',
    labelAr: 'خط الإنتاج / الماكينة',
    labelEn: 'Production Line',
    required: false,
    category: 'logistics',
    descriptionAr: 'خط الثرم أو خط البثق المشغل للحركة',
    descriptionEn: 'Shredding or extrusion line',
  },
  {
    field: 'driver',
    labelAr: 'اسم السائق',
    labelEn: 'Driver Name',
    required: false,
    category: 'logistics',
    descriptionAr: 'اسم سائق شاحنة الشحن أو التوريد',
    descriptionEn: 'Transport truck driver name',
  },
  {
    field: 'vehicle',
    labelAr: 'رقم الشاحنة / السيارة',
    labelEn: 'Vehicle / Truck Plate',
    required: false,
    category: 'logistics',
    descriptionAr: 'رقم لوحة الشاحنة أو شاحنة المصنع',
    descriptionEn: 'Truck plate registration number',
  },
  {
    field: 'notes',
    labelAr: 'ملاحظات وبيان',
    labelEn: 'Notes / Remarks',
    required: false,
    category: 'other',
    descriptionAr: 'ملاحظات إضافية على الشحنة أو الجودة',
    descriptionEn: 'Additional remarks or inspection notes',
  },
  {
    field: 'unknown',
    labelAr: 'تجاهل هذا العمود (غير مستخدم)',
    labelEn: 'Ignore Column (Unmapped)',
    required: false,
    category: 'other',
    descriptionAr: 'استبعاد هذا العمود من عملية الترحيل',
    descriptionEn: 'Do not import or map this column',
  },
];

export interface MaterialSmartSuggestion {
  rawText: string;
  rowCount: number;
  bestMatch: MaterialItem;
  similarityScore: number; // 0 - 100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchReasonAr: string;
  matchReasonEn: string;
  matchCategory: 'TYPO_CORRECTION' | 'FACTORY_ALIAS' | 'CODE_MATCH' | 'NAME_MATCH' | 'KEYWORD_TOKEN';
  alternatives: {
    material: MaterialItem;
    similarityScore: number;
    reasonAr: string;
  }[];
  isAlreadyCorrected: boolean;
}

export interface WorkbookAnalysis {
  fileName: string;
  fileSize: string;
  totalSheets: number;
  sheets: SheetAnalysis[];
  activeSheetIndex: number;
  batchId: string;
  uploadedAt: string;
  totalDataRegions: number;
  totalTransactionRows: number;
  totalSummaryRows: number;
  totalDetectedHeaders: number;
  totalIgnoredRows: number;

  // Hierarchical parser additions
  hierarchicalReport?: HierarchicalWorkbookReport;
  totalHiddenRows?: number;
  totalHiddenCols?: number;
  maxHeaderDepth?: number;
}

export interface InventoryImpactItem {
  materialId: string;
  materialCode: string;
  materialNameAr: string;
  materialNameEn: string;
  warehouseId: string;
  warehouseNameAr: string;
  locationCode: string;
  currentKG: number;
  currentBags: number;
  deltaKG: number;
  deltaBags: number;
  projectedKG: number;
  projectedBags: number;
}

// Helper: Normalize Arabic string for robust fuzzy comparison
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // Remove Tashkeel/harakat
    .replace(/[^\w\s\u0600-\u06FF]/gi, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

// Header keyword dictionary for multi-dialect Arabic & English
const HEADER_PATTERNS: { field: ColumnMapping['mappedField']; labelAr: string; labelEn: string; patterns: string[] }[] = [
  {
    field: 'materialCode',
    labelAr: 'رمز المادة',
    labelEn: 'Material Code',
    patterns: ['رمز المادة', 'كود المادة', 'رقم المادة', 'كود الصنف', 'رمز الصنف', 'material code', 'item code', 'mat code', 'code', 'item id', 'mat id'],
  },
  {
    field: 'material',
    labelAr: 'المادة / الصنف',
    labelEn: 'Material Name',
    patterns: ['اسم المادة', 'المادة', 'المواد', 'وصف المادة', 'الصنف', 'اسم الصنف', 'نوع المادة', 'material', 'material name', 'item name', 'description', 'material description', 'product'],
  },
  {
    field: 'grossKG',
    labelAr: 'وزن الدخول (قائم)',
    labelEn: 'Gross Weight (KG)',
    patterns: ['وزن الدخول', 'قائم', 'الوزن القائم', 'وزن القائم', 'gross', 'gross kg', 'scale in', 'scalein', 'gross weight', 'الدخول'],
  },
  {
    field: 'tareKG',
    labelAr: 'وزن الخروج (فارغ)',
    labelEn: 'Tare Weight (KG)',
    patterns: ['وزن الخروج', 'فارغ', 'الوزن الفارغ', 'وزن الفارغ', 'tare', 'tare kg', 'scale out', 'scaleout', 'tare weight', 'الخروج'],
  },
  {
    field: 'inputKG',
    labelAr: 'الوزن المدخل للثرم',
    labelEn: 'Input Weight (KG)',
    patterns: ['الوزن المدخل', 'وزن المدخل', 'كمية مدخلة', 'input kg', 'input weight', 'المدخل'],
  },
  {
    field: 'outputKG',
    labelAr: 'الوزن المثروم (الناتج)',
    labelEn: 'Output / Shredded KG',
    patterns: ['الوزن المثروم', 'وزن المثروم', 'الناتج', 'المثروم', 'output kg', 'shredded kg', 'regrind kg', 'المفروم'],
  },
  {
    field: 'damageKG',
    labelAr: 'تالف إنتاج',
    labelEn: 'Production Damage (KG)',
    patterns: ['تالف انتاج', 'تالف إنتاج', 'تالف', 'هالك انتاج', 'damage', 'damage kg', 'scrap loss', 'production damage'],
  },
  {
    field: 'netKG',
    labelAr: 'الوزن الصافي / الرصيد (كغم)',
    labelEn: 'Net Weight / Balance (KG)',
    patterns: [
      'الرصيد الحالي (كغم)',
      'الرصيد الحالي',
      'الرصيد كغم',
      'رصيد كغم',
      'الرصيد',
      'رصيد',
      'رصيد المخزن',
      'طاقة مخزنية',
      'طاقة',
      'مخزون',
      'الوزن الصافي',
      'الصافي',
      'صافي',
      'net',
      'net kg',
      'net weight',
      'الوزن كغم',
      'وزن كغم',
      'الوزن المستلم',
      'الوزن المصروف',
      'الكمية المستلمة',
      'الكمية المصروفة',
      'current balance',
      'stock balance',
      'stock',
      'balance',
      'balance kg',
    ],
  },
  {
    field: 'weight',
    labelAr: 'الوزن / الكمية (كغم)',
    labelEn: 'Weight / Qty (KG)',
    patterns: [
      'الوزن',
      'وزن',
      'كغم',
      'كيلوغرام',
      'كمية',
      'الكمية',
      'weight',
      'kg',
      'qty',
      'quantity',
      'الرصيد الحالي (كغم)',
      'الرصيد',
      'رصيد',
      'balance',
      'balance kg',
      'stock',
    ],
  },
  {
    field: 'bulkBags',
    labelAr: 'عدد الشلايف',
    labelEn: 'Bulk Bags (Count)',
    patterns: ['عدد الشلايف', 'شلايف', 'شليف', 'عدد شلايف', 'شوال', 'اكياس', 'أكياس', 'عدد الاكياس', 'bulk bags', 'bulk bag', 'bags', 'bag count', 'jumbo bags', 'big bags'],
  },
  {
    field: 'supplier',
    labelAr: 'المورد / المصدر',
    labelEn: 'Supplier / Source',
    patterns: ['اسم المورد', 'المورد', 'المصدر', 'الجهة الموردة', 'شركة', 'العميل', 'supplier', 'source', 'vendor', 'from'],
  },
  {
    field: 'docRef',
    labelAr: 'رقم المستند',
    labelEn: 'Document Ref No',
    patterns: ['رقم المستند', 'رقم مستند', 'كبان', 'رقم الكبان', 'رقم الوصل', 'وصل', 'مستند', 'وثيقة', 'document no', 'doc no', 'ref no', 'ticket no', '546', '360', '167', '352'],
  },
  {
    field: 'date',
    labelAr: 'التاريخ',
    labelEn: 'Date',
    patterns: ['التاريخ', 'تاريخ', 'date', 'entry date', 'doc date', 'transaction date'],
  },
  {
    field: 'time',
    labelAr: 'الوقت',
    labelEn: 'Time',
    patterns: ['الوقت', 'وقت', 'time', 'entry time', 'scale time'],
  },
  {
    field: 'location',
    labelAr: 'الموقع / الرف',
    labelEn: 'Location / Bay',
    patterns: ['الموقع', 'الرف', 'رقم الرف', 'location', 'bay', 'rack', 'bin', 'loc'],
  },
  {
    field: 'warehouse',
    labelAr: 'المستودع / المخزن',
    labelEn: 'Warehouse',
    patterns: ['المستودع', 'المخزن', 'رقم المخزن', 'warehouse', 'wh', 'store'],
  },
  {
    field: 'line',
    labelAr: 'خط الإنتاج / الثرم',
    labelEn: 'Line / Machine',
    patterns: ['الخط', 'خط الثرم', 'خط الإنتاج', 'خط الانتاج', 'الماكينة', 'line', 'machine', 'shredder line', 'extruder line'],
  },
  {
    field: 'driver',
    labelAr: 'السائق',
    labelEn: 'Driver',
    patterns: ['السائق', 'اسم السائق', 'driver', 'driver name'],
  },
  {
    field: 'vehicle',
    labelAr: 'رقم الشاحنة / السيارة',
    labelEn: 'Vehicle / Truck Plate',
    patterns: ['رقم السيارة', 'رقم الشاحنة', 'الشاحنة', 'السيارة', 'لوحة السيارة', 'vehicle', 'truck', 'plate'],
  },
  {
    field: 'notes',
    labelAr: 'ملاحظات',
    labelEn: 'Notes / Remarks',
    patterns: ['ملاحظات', 'الملاحظات', 'بيان', 'notes', 'remarks', 'comment'],
  },
];

// Summary & Total keywords to ignore from data rows
const SUMMARY_KEYWORDS = [
  'المجموع',
  'المجموع العام',
  'الإجمالي',
  'اجمالي',
  'صافي المجموع',
  'total',
  'grand total',
  'subtotal',
  'sum',
  'totals',
  'توقيع',
  'أمين المخزن',
  'امين المخزن',
  'المسؤول',
  'مدير المخزن',
  'signature',
  'prepared by',
  'approved by',
  'page',
  'صفحة',
];

// Known AL-KARWAN Material Keyword Aliases
const KNOWN_MATERIAL_ALIASES: { code: string; aliases: string[] }[] = [
  {
    code: 'BTL-SHR-04',
    aliases: ['بطل مثروم', 'بطل مجروش', 'مفروم اكواب بطل', 'مجروش بطل', 'batal shredded', 'batal regrind', 'اكواب مثرومة', 'بطل مفروم'],
  },
  {
    code: 'BTL-SCR-03',
    aliases: ['بطل سكراب', 'سكراب اكواب بطل', 'سكراب بطل', 'سكراب وهوالك اكواب', 'batal scrap', 'اكواب سكراب', 'خام بطل غير مثروم'],
  },
  {
    code: 'PET-FLK-01',
    aliases: ['رقائق pet', 'رقائق بولي ايثيلين', 'رقائق شفافة', 'pet flakes', 'pet flakes prime', 'رقائق بت', 'بت فليكس'],
  },
  {
    code: 'PP-GRN-02',
    aliases: ['حبيبات pp', 'بولي بروبلين', 'حبيبات بولي بروبلين', 'pp granules', 'بولي بروبيلين', 'سابك pp', 'خام pp'],
  },
  {
    code: 'SHT-TRM-05',
    aliases: ['هوالك الواح', 'اطراف رولات', 'هوالك تشذيب', 'sheet trims', 'sheet roll trim', 'سكراب الواح', 'قصاصات الواح'],
  },
  {
    code: 'HIPS-PEL-06',
    aliases: ['حبيبات hips', 'بولي ستايرين', 'hips pellets', 'hips', 'هاي امباكت', 'بولي ستايرين مقاوم'],
  },
  {
    code: 'MB-WHT-07',
    aliases: ['ماسترباتش ابيض', 'ماستر باتش ابيض', 'صبغة بيضاء', 'white masterbatch', 'masterbatch white', 'اللون الابيض'],
  },
];

// Check if a row is completely empty
function isRowEmpty(row: any[]): boolean {
  if (!row || row.length === 0) return true;
  return row.every((cell) => cell === undefined || cell === null || String(cell).trim() === '');
}

// Check if a row represents a summary/total or footer
function isSummaryOrFooterRow(row: any[]): { isSummary: boolean; text: string } {
  for (const cell of row) {
    if (!cell) continue;
    const str = String(cell).trim();
    const norm = normalizeArabic(str);
    for (const kw of SUMMARY_KEYWORDS) {
      if (norm.includes(normalizeArabic(kw)) || str.toLowerCase().includes(kw.toLowerCase())) {
        return { isSummary: true, text: str };
      }
    }
  }
  return { isSummary: false, text: '' };
}

// Score how likely a row is to be the main table header
function scoreHeaderRow(row: any[]): { score: number; mappings: ColumnMapping[] } {
  if (!row || row.length === 0) return { score: 0, mappings: [] };
  let matches = 0;
  const mappings: ColumnMapping[] = [];

  row.forEach((cell, colIndex) => {
    if (cell === undefined || cell === null) return;
    const rawHeader = String(cell).trim();
    if (!rawHeader || rawHeader.length > 50) return; // Unlikely to be a column header if too long

    const norm = normalizeArabic(rawHeader);
    let matchedField: ColumnMapping['mappedField'] = 'unknown';
    let fieldLabelAr = rawHeader;
    let fieldLabelEn = rawHeader;
    let confidence = 0;

    for (const pat of HEADER_PATTERNS) {
      for (const p of pat.patterns) {
        const normP = normalizeArabic(p);
        if (norm === normP) {
          matchedField = pat.field;
          fieldLabelAr = pat.labelAr;
          fieldLabelEn = pat.labelEn;
          confidence = 100;
          break;
        } else if (norm.includes(normP) || normP.includes(norm)) {
          if (confidence < 75) {
            matchedField = pat.field;
            fieldLabelAr = pat.labelAr;
            fieldLabelEn = pat.labelEn;
            confidence = 75;
          }
        }
      }
      if (confidence === 100) break;
    }

    if (matchedField !== 'unknown') {
      matches++;
    }

    mappings.push({
      colIndex,
      rawHeader,
      mappedField: matchedField,
      fieldLabelAr,
      fieldLabelEn,
      confidence,
    });
  });

  return { score: matches, mappings };
}

// Detect document type from file name, sheet name, and headers
function detectDocType(
  fileName: string,
  sheetName: string,
  headers: ColumnMapping[]
): { type: ExcelDocType; titleAr: string; titleEn: string; confidence: 'HIGH' | 'MEDIUM' | 'AUTO' } {
  const combined = `${fileName} ${sheetName}`.toLowerCase();
  const combinedNorm = normalizeArabic(combined);

  // Exact file name matching for AL-KARWAN existing files
  if (combined.includes('546') || combinedNorm.includes('استلام خامات') || combinedNorm.includes('مستند 546')) {
    return { type: '546', titleAr: 'استلام مواد خامات (مستند 546)', titleEn: 'Raw Material Receipt (Doc 546)', confidence: 'HIGH' };
  }
  if (combined.includes('360') || combinedNorm.includes('استلام مخزن الثرم') || combinedNorm.includes('مستند 360')) {
    return { type: '360', titleAr: 'استلام مخزن الثرم (مستند 360)', titleEn: 'Shredding / Therm Store Receiving (Doc 360)', confidence: 'HIGH' };
  }
  if (combined.includes('167') || combinedNorm.includes('صادر مواد خامات') || combinedNorm.includes('صرف انتاج') || combinedNorm.includes('مستند 167')) {
    return { type: '167', titleAr: 'صادر مواد خامات للإنتاج (مستند 167)', titleEn: 'Raw Material Issue to Production (Doc 167)', confidence: 'HIGH' };
  }
  if (combined.includes('352') || combinedNorm.includes('صادر من المخزن الى الثرم') || combinedNorm.includes('مستند 352')) {
    return { type: '352', titleAr: 'صادر من المخزن إلى الثرم (مستند 352)', titleEn: 'Issue from Store to Therm / Shredding (Doc 352)', confidence: 'HIGH' };
  }
  if (combinedNorm.includes('مخزن خامات 9') || combinedNorm.includes('خامات 9')) {
    return { type: 'INVENTORY_SNAPSHOT', titleAr: 'جرد وأرصدة مخزن الخامات الرئيسي (مخزن 9) - لقطة مخزنية (INVENTORY_SNAPSHOT)', titleEn: 'Raw Materials Store 9 Inventory Snapshot (INVENTORY_SNAPSHOT)', confidence: 'HIGH' };
  }
  if (combinedNorm.includes('طاقه مخزنيه لمخزن الثرم') || combinedNorm.includes('مخزن الثرم -9') || combinedNorm.includes('طاقة مخزن الثرم')) {
    return { type: 'THERM_CAPACITY_9', titleAr: 'الطاقة المخزنية لمخزن الثرم (مخزن الثرم -9)', titleEn: 'Therm / Shredding Store Capacity & Snapshot', confidence: 'HIGH' };
  }
  if (combinedNorm.includes('طاقه مخزنيه') || combinedNorm.includes('رصيد') || combinedNorm.includes('ارصده') || combinedNorm.includes('inventory')) {
    return { type: 'INVENTORY_SNAPSHOT', titleAr: 'الأرصدة والطاقة المخزنية للمستودعات', titleEn: 'Warehouse Inventory Snapshot', confidence: 'HIGH' };
  }

  // Check headers for clues
  const hasGross = headers.some((h) => h.mappedField === 'grossKG');
  const hasTare = headers.some((h) => h.mappedField === 'tareKG');
  const hasSupplier = headers.some((h) => h.mappedField === 'supplier');
  const hasDamage = headers.some((h) => h.mappedField === 'damageKG');
  const hasInputKG = headers.some((h) => h.mappedField === 'inputKG');
  const hasOutputKG = headers.some((h) => h.mappedField === 'outputKG');

  if (hasGross && hasTare) {
    return { type: '546', titleAr: 'استلام مواد خامات (مستند 546)', titleEn: 'Raw Material Receipt (Doc 546)', confidence: 'MEDIUM' };
  }
  if (hasDamage || (hasInputKG && hasOutputKG)) {
    return { type: '360', titleAr: 'استلام مخزن الثرم (مستند 360)', titleEn: 'Shredding / Therm Store Receiving (Doc 360)', confidence: 'MEDIUM' };
  }
  if (hasSupplier) {
    return { type: '546', titleAr: 'استلام مواد خامات (مستند 546)', titleEn: 'Raw Material Receipt (Doc 546)', confidence: 'AUTO' };
  }

  return { type: 'INVENTORY_SNAPSHOT', titleAr: 'الأرصدة المخزنية والحركات العامة', titleEn: 'Inventory Movement & Balances', confidence: 'AUTO' };
}

// Match material against AL-KARWAN Item Master
export function matchMaterial(
  rawMatText: string,
  rawCodeText: string,
  allMaterials: MaterialItem[]
): {
  matchedMaterial?: MaterialItem;
  confidence: 'EXACT_CODE' | 'EXACT_NAME' | 'FUZZY_NAME' | 'POSSIBLE_MATCH' | 'UNMATCHED';
} {
  const normMat = normalizeArabic(rawMatText);
  const normCode = normalizeArabic(rawCodeText);

  // 1. Exact Material Code Match
  if (normCode) {
    const codeMatch = allMaterials.find((m) => normalizeArabic(m.code) === normCode || m.code.toLowerCase() === rawCodeText.toLowerCase().trim());
    if (codeMatch) {
      return { matchedMaterial: codeMatch, confidence: 'EXACT_CODE' };
    }
  }

  // Also check if code is inside rawMatText
  if (normMat) {
    for (const m of allMaterials) {
      if (rawMatText.toLowerCase().includes(m.code.toLowerCase())) {
        return { matchedMaterial: m, confidence: 'EXACT_CODE' };
      }
    }
  }

  // 2. Known Factory Aliases Match (e.g. "بطل مثروم" -> BTL-SHR-04)
  if (normMat) {
    for (const aliasItem of KNOWN_MATERIAL_ALIASES) {
      for (const al of aliasItem.aliases) {
        if (normMat.includes(normalizeArabic(al)) || normalizeArabic(al).includes(normMat)) {
          const found = allMaterials.find((m) => m.code === aliasItem.code);
          if (found) {
            return { matchedMaterial: found, confidence: 'FUZZY_NAME' };
          }
        }
      }
    }
  }

  // 3. Exact or Substring Match in Item Master names
  if (normMat) {
    for (const m of allMaterials) {
      const normAr = normalizeArabic(m.nameAr);
      const normEn = normalizeArabic(m.nameEn);
      if (normAr === normMat || normEn === normMat) {
        return { matchedMaterial: m, confidence: 'EXACT_NAME' };
      }
      if (normMat.length >= 4 && (normAr.includes(normMat) || normMat.includes(normAr))) {
        return { matchedMaterial: m, confidence: 'FUZZY_NAME' };
      }
    }
  }

  // 4. Keyword tokens match
  if (normMat) {
    const tokens = normMat.split(' ').filter((t) => t.length > 2);
    for (const m of allMaterials) {
      const normAr = normalizeArabic(m.nameAr);
      const matchedTokens = tokens.filter((t) => normAr.includes(t));
      if (matchedTokens.length >= 2 || (tokens.length === 1 && matchedTokens.length === 1)) {
        return { matchedMaterial: m, confidence: 'POSSIBLE_MATCH' };
      }
    }
  }

  // Fallback to first material if fuzzy fails but material is requested
  if (allMaterials.length > 0) {
    return { matchedMaterial: allMaterials[0], confidence: 'UNMATCHED' };
  }

  return { confidence: 'UNMATCHED' };
}

// Parse Excel serial dates / ISO strings
function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    if (!isNaN(dateInfo.getTime())) {
      return dateInfo.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  // Check YYYY-MM-DD or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str;
}

// ----------------------------------------------------
// String Distance & Similarity Algorithms
// ----------------------------------------------------

export function levenshteinDistance(a: string, b: string): number {
  if (!a) return b ? b.length : 0;
  if (!b) return a ? a.length : 0;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function levenshteinSimilarity(a: string, b: string): number {
  const normA = normalizeArabic(a);
  const normB = normalizeArabic(b);
  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, (maxLen - dist) / maxLen);
}

export function bigramDiceSimilarity(a: string, b: string): number {
  const normA = normalizeArabic(a);
  const normB = normalizeArabic(b);
  if (normA === normB) return 1.0;
  if (normA.length < 2 || normB.length < 2) return 0.0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < normA.length - 1; i++) {
    const bg = normA.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < normB.length - 1; i++) {
    const bg = normB.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      bigramsA.set(bg, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (normA.length - 1 + (normB.length - 1));
}

export function tokenJaccardSimilarity(a: string, b: string): number {
  const normA = normalizeArabic(a);
  const normB = normalizeArabic(b);
  if (normA === normB) return 1.0;

  const tokensA = new Set(normA.split(/\s+/).filter((t) => t.length > 1));
  const tokensB = new Set(normB.split(/\s+/).filter((t) => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) intersection++;
  });
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0.0;
}

// Calculate comprehensive fuzzy match between raw Excel material text and an Item Master item
export function calculateMaterialFuzzyMatch(
  rawText: string,
  material: MaterialItem
): {
  score: number;
  reasonAr: string;
  reasonEn: string;
  category: MaterialSmartSuggestion['matchCategory'];
} {
  const normRaw = normalizeArabic(rawText);
  const normAr = normalizeArabic(material.nameAr);
  const normEn = normalizeArabic(material.nameEn);
  const codeLower = material.code.toLowerCase().trim();
  const rawLower = rawText.toLowerCase().trim();

  // 1. Direct Code Match
  if (rawLower.includes(codeLower) || normRaw.includes(normalizeArabic(material.code))) {
    return {
      score: 100,
      reasonAr: `تطابق مباشر مع كود الصنف الرسمي (${material.code})`,
      reasonEn: `Direct match with official Item Master code (${material.code})`,
      category: 'CODE_MATCH',
    };
  }

  // 2. Exact Name Match
  if (normRaw === normAr || normRaw === normEn) {
    return {
      score: 100,
      reasonAr: 'تطابق حرفي كامل مع الاسم الرسمي للصنف في دليل المواد',
      reasonEn: 'Exact string match with official Item Master name',
      category: 'NAME_MATCH',
    };
  }

  // 3. Known Factory Aliases Match
  const aliasItem = KNOWN_MATERIAL_ALIASES.find((a) => a.code === material.code);
  if (aliasItem) {
    for (const alias of aliasItem.aliases) {
      const normAlias = normalizeArabic(alias);
      if (normRaw === normAlias) {
        return {
          score: 98,
          reasonAr: `مرادف مصنعي موثق للكروان ("${alias}" -> ${material.nameAr})`,
          reasonEn: `Official AL-KARWAN factory alias ("${alias}")`,
          category: 'FACTORY_ALIAS',
        };
      }
      if (normRaw.includes(normAlias) || normAlias.includes(normRaw)) {
        return {
          score: 95,
          reasonAr: `يتضمن المرادف المصنعي المتداول "${alias}"`,
          reasonEn: `Contains known factory alias "${alias}"`,
          category: 'FACTORY_ALIAS',
        };
      }
      const aliasDice = bigramDiceSimilarity(normRaw, normAlias);
      if (aliasDice > 0.70) {
        const score = Math.round(aliasDice * 96);
        return {
          score,
          reasonAr: `تشابه لغوي مع المرادف المصنعي "${alias}" (${score}%)`,
          reasonEn: `Phonetic/text similarity with alias "${alias}"`,
          category: 'FACTORY_ALIAS',
        };
      }
    }
  }

  // 4. Substring Containment
  if (normRaw.length >= 4 && (normAr.includes(normRaw) || normRaw.includes(normAr))) {
    const longer = Math.max(normRaw.length, normAr.length);
    const shorter = Math.min(normRaw.length, normAr.length);
    const ratio = shorter / longer;
    const score = Math.round(85 + ratio * 12);
    return {
      score: Math.min(97, score),
      reasonAr: `تطابق جزئي مباشر مع مسمى المادة (${score}%)`,
      reasonEn: `Direct substring containment in material name`,
      category: 'NAME_MATCH',
    };
  }

  // 5. Typo correction via Levenshtein & Bigram Dice
  const diceAr = bigramDiceSimilarity(normRaw, normAr);
  const levAr = levenshteinSimilarity(normRaw, normAr);
  const typoSimilarity = Math.max(diceAr, levAr);

  if (typoSimilarity >= 0.65) {
    const score = Math.round(typoSimilarity * 94);
    return {
      score,
      reasonAr: `تصحيح خطأ إملائي أو طباعي في الاسم بنسبة توافق (${score}%)`,
      reasonEn: `Typo/misspelling correction based on string distance (${score}%)`,
      category: 'TYPO_CORRECTION',
    };
  }

  // 6. Token Overlap
  const tokenSim = tokenJaccardSimilarity(normRaw, normAr);
  if (tokenSim > 0.3) {
    const score = Math.round(60 + tokenSim * 30);
    return {
      score,
      reasonAr: `تطابق كلمات مفتاحية رئيسية للصنف (${score}%)`,
      reasonEn: `Common token keyword overlap with Item Master (${score}%)`,
      category: 'KEYWORD_TOKEN',
    };
  }

  // Fallback score
  const baseScore = Math.round(Math.max(diceAr, levAr, tokenSim) * 50);
  return {
    score: Math.max(5, baseScore),
    reasonAr: 'تشابه منخفض - يتطلب تدقيق المستخدم واختيار يدوي',
    reasonEn: 'Low similarity score - manual user review recommended',
    category: 'KEYWORD_TOKEN',
  };
}

// Generate Smart Suggestions for all unique material names in the sheet
export function generateMaterialSmartSuggestions(
  dataRows: AnalyzedDataRow[],
  allMaterials: MaterialItem[]
): MaterialSmartSuggestion[] {
  const rawMap = new Map<string, { count: number; rows: AnalyzedDataRow[] }>();
  dataRows.forEach((r) => {
    if (r.isIgnoredByUser) return;
    const key = (r.materialRaw || r.materialMatchedNameAr || '').trim();
    if (!key) return;
    const existing = rawMap.get(key) || { count: 0, rows: [] };
    existing.count++;
    existing.rows.push(r);
    rawMap.set(key, existing);
  });

  const suggestions: MaterialSmartSuggestion[] = [];

  rawMap.forEach((entry, rawText) => {
    const scoredList = allMaterials.map((mat) => {
      const match = calculateMaterialFuzzyMatch(rawText, mat);
      return {
        material: mat,
        score: match.score,
        reasonAr: match.reasonAr,
        reasonEn: match.reasonEn,
        category: match.category,
      };
    });

    scoredList.sort((a, b) => b.score - a.score);

    const best = scoredList[0];
    if (!best) return;

    const alternatives = scoredList.slice(1, 4).map((item) => ({
      material: item.material,
      similarityScore: item.score,
      reasonAr: item.reasonAr,
    }));

    const isAlreadyExact = entry.rows.every(
      (r) => r.materialMatchedId === best.material.id && r.materialMatchConfidence === 'EXACT_CODE'
    );

    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (best.score >= 80) confidence = 'HIGH';
    else if (best.score >= 55) confidence = 'MEDIUM';

    suggestions.push({
      rawText,
      rowCount: entry.count,
      bestMatch: best.material,
      similarityScore: best.score,
      confidence,
      matchReasonAr: best.reasonAr,
      matchReasonEn: best.reasonEn,
      matchCategory: best.category,
      alternatives,
      isAlreadyCorrected: isAlreadyExact,
    });
  });

  return suggestions.sort((a, b) => {
    if (a.isAlreadyCorrected !== b.isAlreadyCorrected) {
      return a.isAlreadyCorrected ? 1 : -1;
    }
    return b.similarityScore - a.similarityScore;
  });
}

// Classify a row into its factory data migration category
export function classifyRow(
  row: any[],
  rowIndex: number,
  headerRowIndex: number,
  fieldColMap: Map<ColumnMapping['mappedField'], number>,
  allMaterials: MaterialItem[]
): {
  category: 'EMPTY' | 'SEPARATOR' | 'SUMMARY' | 'TITLE' | 'UNFILLED_TEMPLATE' | 'TRANSACTION';
  reason?: string;
  summaryText?: string;
} {
  // 1. Completely empty or all cells are empty string/whitespace
  if (!row || row.length === 0 || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
    return { category: 'EMPTY', reason: 'صف فارغ تماماً (Empty Row)' };
  }

  // 2. Summary or Total row
  const sumCheck = isSummaryOrFooterRow(row);
  if (sumCheck.isSummary) {
    return { category: 'SUMMARY', summaryText: sumCheck.text };
  }

  // 3. Line separator / formatting row (dashes, equal signs, borders)
  const nonBlankCells = row.filter((c) => c !== undefined && c !== null && String(c).trim() !== '');
  const allSeparators = nonBlankCells.length > 0 && nonBlankCells.every((c) => {
    const s = String(c).trim();
    return /^[-=_*#/.~]+$/.test(s) || s === '#N/A' || s === '#VALUE!' || s === '#REF!' || s === '#DIV/0!';
  });
  if (allSeparators) {
    return { category: 'SEPARATOR', reason: 'صف فواصل وتنسيق (Separator / Formatting Row)' };
  }

  // 4. Title row before the header
  if (rowIndex < headerRowIndex) {
    const firstText = nonBlankCells.map((c) => String(c).trim()).join(' - ');
    return { category: 'TITLE', reason: `ترويسة التقرير: ${firstText}` };
  }

  // 5. Unfilled Template Row Detection (Prevents thousands of false errors!)
  // In many factory Excel templates, empty rows are pre-numbered (col 0 = 2, 3, 4 ... 9295)
  // but contain no material name, no weights, no dates, no suppliers.
  let hasValidMaterialText = false;
  let hasPositiveWeight = false;

  const matCol = fieldColMap.get('material');
  const codeCol = fieldColMap.get('materialCode');
  const netCol = fieldColMap.get('netKG');
  const grossCol = fieldColMap.get('grossKG');
  const tareCol = fieldColMap.get('tareKG');
  const weightCol = fieldColMap.get('weight');
  const inputCol = fieldColMap.get('inputKG');
  const outputCol = fieldColMap.get('outputKG');
  const docCol = fieldColMap.get('docRef');
  const supCol = fieldColMap.get('supplier');
  const dateCol = fieldColMap.get('date');

  // Check material column
  if (matCol !== undefined && row[matCol] !== undefined) {
    const s = String(row[matCol]).trim();
    if (s && !/^\d+$/.test(s) && s.length >= 2) {
      hasValidMaterialText = true;
    }
  }
  if (!hasValidMaterialText && codeCol !== undefined && row[codeCol] !== undefined) {
    const s = String(row[codeCol]).trim();
    if (s && s.length >= 2) {
      hasValidMaterialText = true;
    }
  }

  // Check if any other cell contains text resembling a material
  if (!hasValidMaterialText) {
    for (let c = 0; c < row.length; c++) {
      if (c === docCol || c === supCol || c === dateCol) continue;
      const s = String(row[c] || '').trim();
      if (!s || /^\d+$/.test(s) || s.length < 2) continue;
      const norm = normalizeArabic(s);
      const isKnownMat = ['بطل', 'مثروم', 'مجروش', 'سكراب', 'رقائق', 'حبيبات', 'ماسترباتش', 'هوالك', 'pet', 'pp', 'hips'].some((k) => norm.includes(k));
      if (isKnownMat) {
        hasValidMaterialText = true;
        break;
      }
    }
  }

  // Check weights
  const weightVals = [
    netCol !== undefined ? Number(row[netCol]) : NaN,
    grossCol !== undefined ? Number(row[grossCol]) : NaN,
    tareCol !== undefined ? Number(row[tareCol]) : NaN,
    weightCol !== undefined ? Number(row[weightCol]) : NaN,
    inputCol !== undefined ? Number(row[inputCol]) : NaN,
    outputCol !== undefined ? Number(row[outputCol]) : NaN,
  ];
  if (weightVals.some((w) => !isNaN(w) && w > 0)) {
    hasPositiveWeight = true;
  }

  // If a row has NO material text AND NO positive weight, it CANNOT be a transaction.
  // It is classified as an unfilled template row and safely ignored.
  if (!hasValidMaterialText && !hasPositiveWeight) {
    return {
      category: 'UNFILLED_TEMPLATE',
      reason: 'صف قالب فارغ أو غير معبأ ببيانات حركات (Unfilled template row)',
    };
  }

  return { category: 'TRANSACTION' };
}

// Extract Analyzed Data Rows from a 2D raw matrix using given column mappings
export function extractDataRowsFromMatrix(
  rawMatrix: any[][],
  headerRowIndex: number,
  mappings: ColumnMapping[],
  sheetName: string,
  detectedType: ExcelDocType,
  allMaterials: MaterialItem[],
  allSuppliers: Supplier[],
  allWarehouses: Warehouse[],
  allLocations: WarehouseLocation[],
  existingMovements: InventoryMovement[],
  existingReceiving: ReceivingTransaction[],
  existingShredding: ShreddingTransaction[],
  existingIssues: ProductionIssue[],
  headerEndRowIndex: number = headerRowIndex,
  hiddenRowIndices?: Set<number>
): {
  dataRows: AnalyzedDataRow[];
  summaryRows: { rowIndex: number; text: string; values?: Record<string, any> }[];
  ignoredRows: { rowIndex: number; reason: string }[];
  titleRows: { rowIndex: number; text: string }[];
  dataRegion: DataRegion;
  classifiedRowsList: { rowIndex: number; row: any[]; category: StandardRowCategory; reasonAr: string; reasonEn: string }[];
} {
  const fieldColMap = new Map<ColumnMapping['mappedField'], number>();
  mappings.forEach((m) => {
    if (m.mappedField !== 'unknown' && !fieldColMap.has(m.mappedField)) {
      fieldColMap.set(m.mappedField, m.colIndex);
    }
  });

  const dataRows: AnalyzedDataRow[] = [];
  const summaryRows: { rowIndex: number; text: string; values?: Record<string, any> }[] = [];
  const ignoredRows: { rowIndex: number; reason: string }[] = [];
  const titleRows: { rowIndex: number; text: string }[] = [];
  const classifiedRowsList: { rowIndex: number; row: any[]; category: StandardRowCategory; reasonAr: string; reasonEn: string }[] = [];

  // 1. Process title rows prior to header
  for (let r = 0; r < headerRowIndex; r++) {
    const row = rawMatrix[r];
    const rowNumber1Based = r + 1;
    if (isRowEmpty(row)) {
      classifiedRowsList.push({ rowIndex: rowNumber1Based, row, category: 'EMPTY', reasonAr: 'سطر فارغ في ترويسة الورقة', reasonEn: 'Pre-header blank row' });
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: 'سطر فارغ في ترويسة الورقة (Pre-header blank row)' });
      continue;
    }
    const text = (row || []).map((c) => String(c || '').trim()).filter(Boolean).join(' - ');
    if (text) {
      classifiedRowsList.push({ rowIndex: rowNumber1Based, row, category: 'TITLE', reasonAr: `ترويسة المستند: ${text}`, reasonEn: 'Document Title Banner' });
      titleRows.push({ rowIndex: rowNumber1Based, text });
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: `عنوان أو ترويسة المستند: ${text}` });
    }
  }

  // Header row itself
  if (rawMatrix[headerRowIndex]) {
    classifiedRowsList.push({
      rowIndex: headerRowIndex + 1,
      row: rawMatrix[headerRowIndex],
      category: 'HEADER',
      reasonAr: 'صف ترويسة الأعمدة الرئيسي',
      reasonEn: 'Primary Table Header Row',
    });
  }

  // 2. Process sub-headers in multi-level headers
  for (let r = headerRowIndex + 1; r <= headerEndRowIndex; r++) {
    const rowNumber1Based = r + 1;
    classifiedRowsList.push({
      rowIndex: rowNumber1Based,
      row: rawMatrix[r],
      category: 'SUBHEADER',
      reasonAr: 'سطر رأس فرعي مدمج ضمن الترويسة الهرمية',
      reasonEn: 'Hierarchical sub-header row',
    });
    ignoredRows.push({ rowIndex: rowNumber1Based, reason: 'سطر رأس فرعي مدمج ضمن الترويسة الهرمية (Hierarchical sub-header)' });
  }

  // 3. Process data and structural rows after header
  for (let r = headerEndRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r];
    const rowNumber1Based = r + 1;

    // Check if row is explicitly hidden in Excel
    if (hiddenRowIndices && hiddenRowIndices.has(r)) {
      classifiedRowsList.push({
        rowIndex: rowNumber1Based,
        row,
        category: 'SEPARATOR',
        reasonAr: 'صف مخفي في ورقة إكسل الأصلية',
        reasonEn: 'Hidden row in source sheet',
      });
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: 'صف مخفي في ورقة إكسل الأصلية (Hidden row in source sheet)' });
      continue;
    }

    // Phase 7: Standard 10-tier classification
    const standardClass = classifyStandardRow(row, r, headerRowIndex, fieldColMap, allMaterials);
    classifiedRowsList.push({
      rowIndex: rowNumber1Based,
      row,
      category: standardClass.category,
      reasonAr: standardClass.reasonAr,
      reasonEn: standardClass.reasonEn,
    });

    if (standardClass.category === 'EMPTY') {
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: standardClass.reasonAr });
      continue;
    }

    if (standardClass.category === 'TOTAL' || standardClass.category === 'SUBTOTAL') {
      summaryRows.push({ rowIndex: rowNumber1Based, text: standardClass.reasonAr });
      continue;
    }

    if (standardClass.category === 'SEPARATOR') {
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: standardClass.reasonAr });
      continue;
    }

    if (standardClass.category === 'TITLE' || standardClass.category === 'HEADER' || standardClass.category === 'SUBHEADER' || standardClass.category === 'NOTE') {
      if (standardClass.category === 'TITLE') {
        titleRows.push({ rowIndex: rowNumber1Based, text: standardClass.reasonAr });
      }
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: standardClass.reasonAr });
      continue;
    }

    // Phase 8: Only DATA rows enter transaction validation!
    if (standardClass.category !== 'DATA') {
      ignoredRows.push({ rowIndex: rowNumber1Based, reason: standardClass.reasonAr });
      continue;
    }

    // Extraction helper
    const getVal = (field: ColumnMapping['mappedField']): any => {
      const colIdx = fieldColMap.get(field);
      if (colIdx !== undefined && row[colIdx] !== undefined) {
        return row[colIdx];
      }
      return '';
    };

    // Extract Material Text safely
    let materialRaw = '';
    const matVal = getVal('material');
    if (matVal !== undefined && matVal !== null && String(matVal).trim() !== '' && !/^\d+$/.test(String(matVal).trim())) {
      materialRaw = String(matVal).trim();
    }

    const codeRaw = String(getVal('materialCode') || '').trim();
    if (!materialRaw && codeRaw) {
      materialRaw = codeRaw;
    }

    // Comprehensive material search across all row cells if not yet mapped
    if (!materialRaw) {
      for (let c = 0; c < row.length; c++) {
        if (
          c === fieldColMap.get('docRef') ||
          c === fieldColMap.get('supplier') ||
          c === fieldColMap.get('driver') ||
          c === fieldColMap.get('vehicle') ||
          c === fieldColMap.get('date') ||
          c === fieldColMap.get('time')
        ) {
          continue;
        }
        const cell = String(row[c] || '').trim();
        if (cell && !/^\d+$/.test(cell) && cell.length >= 2) {
          // Skip cell if it's purely a weight or bag unit word
          const lower = cell.toLowerCase();
          if (['كغم', 'طن', 'kg', 'ton', 'tons', 'كيلو', 'شليف', 'شلايف', 'كيس', 'bags'].includes(lower)) {
            continue;
          }
          materialRaw = cell;
          break;
        }
      }
    }

    // Phase 6: Bulk bag parsing & compound supplier strings ("مفيد / عدد35")
    const bulkBagResult = parseRobustBulkBags(getVal('bulkBags'));
    let bulkBags = bulkBagResult.count;

    let supplierRaw = String(getVal('supplier') || '').trim();
    if (!supplierRaw && bulkBagResult.extractedSupplier) {
      supplierRaw = bulkBagResult.extractedSupplier;
    }

    const docRefRaw = String(getVal('docRef') || '').trim();
    const dateRaw = parseExcelDate(getVal('date'));
    const timeRaw = String(getVal('time') || '08:00').trim();

    // Phase 5 & Phase 10: Robust Numeric & Weight Parsing
    const grossKGTrace = parseRobustWeight(getVal('grossKG'), 'grossKG', r, fieldColMap.get('grossKG') ?? 0);
    const tareKGTrace = parseRobustWeight(getVal('tareKG'), 'tareKG', r, fieldColMap.get('tareKG') ?? 0);
    const inputKGTrace = parseRobustWeight(getVal('inputKG'), 'inputKG', r, fieldColMap.get('inputKG') ?? 0);
    const outputKGTrace = parseRobustWeight(getVal('outputKG'), 'outputKG', r, fieldColMap.get('outputKG') ?? 0);
    const damageKGTrace = parseRobustWeight(getVal('damageKG'), 'damageKG', r, fieldColMap.get('damageKG') ?? 0);
    const netKGTrace = parseRobustWeight(getVal('netKG'), 'netKG', r, fieldColMap.get('netKG') ?? 0);
    const weightTrace = parseRobustWeight(getVal('weight'), 'weight', r, fieldColMap.get('weight') ?? 0);

    const grossKG = grossKGTrace.parsedNumericValue;
    const tareKG = tareKGTrace.parsedNumericValue;
    const inputKG = inputKGTrace.parsedNumericValue;
    const outputKG = outputKGTrace.parsedNumericValue;
    const damageKG = damageKGTrace.parsedNumericValue;
    const netKGRaw = netKGTrace.parsedNumericValue;
    const weightRaw = weightTrace.parsedNumericValue;

    // Direct, logical netKG derivation
    let netKG = 0;
    let primaryWeightTrace: WeightParseTrace = netKGTrace.parsedNumericValue > 0
      ? netKGTrace
      : (weightTrace.parsedNumericValue > 0 ? weightTrace : grossKGTrace);

    if (grossKG > 0 && tareKG > 0 && grossKG > tareKG) {
      netKG = grossKG - tareKG;
      primaryWeightTrace = {
        ...grossKGTrace,
        parsedNumericValue: netKG,
        acceptedAsKG: true,
        reason: `Calculated from Gross (${grossKG} KG) - Tare (${tareKG} KG) = ${netKG} KG`,
      };
    } else if (netKGRaw > 0) {
      netKG = netKGRaw;
      primaryWeightTrace = netKGTrace;
    } else if (weightRaw > 0) {
      netKG = weightRaw;
      primaryWeightTrace = weightTrace;
    } else if (outputKG > 0) {
      netKG = outputKG;
      primaryWeightTrace = outputKGTrace;
    } else if (inputKG > 0) {
      netKG = inputKG;
      primaryWeightTrace = inputKGTrace;
    } else if (grossKG > 0) {
      netKG = grossKG;
      primaryWeightTrace = grossKGTrace;
    }

    // MULTI-COLUMN SEARCH FOR WEIGHT IF STILL 0
    if (netKG <= 0) {
      for (let c = 0; c < row.length; c++) {
        // Skip metadata columns
        if (
          c === fieldColMap.get('date') ||
          c === fieldColMap.get('time') ||
          c === fieldColMap.get('docRef') ||
          c === fieldColMap.get('supplier') ||
          c === fieldColMap.get('driver') ||
          c === fieldColMap.get('vehicle')
        ) {
          continue;
        }
        const cell = row[c];
        if (cell === null || cell === undefined || String(cell).trim() === '') continue;

        const colHeader = mappings[c]?.rawHeader || `Col_${c + 1}`;
        const trace = parseRobustWeight(cell, colHeader, r, c);
        if (trace.parsedNumericValue > 0) {
          // If first column and equals sequential row index (1, 2, 3...) when row has multiple columns, skip
          if (c === 0 && trace.parsedNumericValue === rowNumber1Based && row.length > 2) {
            continue;
          }
          netKG = trace.parsedNumericValue;
          primaryWeightTrace = {
            ...trace,
            acceptedAsKG: true,
            reason: `Detected in Column ${XLSX.utils.encode_col(c)} [${colHeader}] (${trace.parsedNumericValue} KG)`,
          };
          break;
        }
      }
    } else {
      primaryWeightTrace.acceptedAsKG = true;
    }

    // MULTI-COLUMN SEARCH FOR BULK BAGS
    let primaryBagTrace: BulkBagParseTrace = {
      originalCellAddress: `${XLSX.utils.encode_col(fieldColMap.get('bulkBags') ?? 0)}${rowNumber1Based}`,
      originalCellValue: getVal('bulkBags'),
      parsedBags: bulkBags,
      rowNumber: rowNumber1Based,
      source: fieldColMap.get('bulkBags') !== undefined ? `Dedicated Column (${mappings[fieldColMap.get('bulkBags') || 0]?.rawHeader || 'شلايف'})` : 'Default',
      acceptedAsBags: bulkBags > 0,
      reason: bulkBags > 0 ? `Valid bulk bag count: ${bulkBags}` : 'No bulk bags recorded',
    };

    if (bulkBags <= 0) {
      for (let c = 0; c < row.length; c++) {
        if (c === fieldColMap.get('date') || c === fieldColMap.get('docRef')) continue;
        const cell = row[c];
        if (cell === null || cell === undefined || String(cell).trim() === '') continue;
        const bagRes = parseRobustBulkBags(cell);
        if (bagRes.count > 0) {
          if (c === 0 && bagRes.count === rowNumber1Based && row.length > 2) continue;
          if (netKG > 0 && bagRes.count === netKG) continue;
          bulkBags = bagRes.count;
          if (!supplierRaw && bagRes.extractedSupplier) {
            supplierRaw = bagRes.extractedSupplier;
          }
          primaryBagTrace = {
            originalCellAddress: `${XLSX.utils.encode_col(c)}${rowNumber1Based}`,
            originalCellValue: cell,
            parsedBags: bagRes.count,
            rowNumber: rowNumber1Based,
            source: `Extracted from Column ${XLSX.utils.encode_col(c)} (${mappings[c]?.rawHeader || 'Cell Text'})`,
            acceptedAsBags: true,
            reason: `Extracted ${bagRes.count} bulk bags from pattern "${cell}"`,
          };
          break;
        }
      }
    }

    // Phase 4: Material Matching with Fuzzy Suggestions
    const matchRes = matchMaterialFuzzy(materialRaw, codeRaw, allMaterials);
    const matchedMaterial = matchRes.matchedMaterial;
    let matConfidence: AnalyzedDataRow['materialMatchConfidence'] = 'UNMATCHED';

    if (matchRes.method === 'EXACT_CODE') matConfidence = 'EXACT_CODE';
    else if (matchRes.method === 'EXACT_NAME' || matchRes.method === 'NORMALIZED_NAME') matConfidence = 'EXACT_NAME';
    else if (matchRes.method === 'ALIAS' || matchRes.method === 'FUZZY_MATCH') matConfidence = 'FUZZY_NAME';
    else if (matchRes.suggestedCorrections.length > 0) matConfidence = 'POSSIBLE_MATCH';

    // Supplier matching
    let matchedSupplier: Supplier | undefined;
    if (supplierRaw) {
      const normSup = normalizeArabicText(supplierRaw);
      matchedSupplier = allSuppliers.find((s) => normalizeArabicText(s.nameAr).includes(normSup) || normSup.includes(normalizeArabicText(s.nameAr)));
    }
    if (!matchedSupplier && allSuppliers.length > 0 && (detectedType === '546' || (detectedType as string) === SystemCodesAPI.getStorageCode())) {
      matchedSupplier = allSuppliers[0];
    }

    const finalDocRef = docRefRaw || `${detectedType}/IMP/${rowNumber1Based}`;

    // Phase 8: Precise 3-Tier Validation (ERROR, WARNING, INFO)
    const messages: { text: string; severity: 'ERROR' | 'WARNING' | 'INFO' }[] = [];
    let severity: RowValidationSeverity = 'VALID';

    // An ERROR should only be generated when:
    // 1. The row is classified as DATA (guaranteed above)
    // AND 2. The transaction type requires the missing field
    // AND 3. The value cannot be recovered or mapped.
    const isSnapshotType = detectedType === 'RAW_STORE_9' || detectedType === 'INVENTORY_SNAPSHOT' || detectedType === 'THERM_CAPACITY_9';

    if (!materialRaw && !codeRaw) {
      messages.push({ text: 'اسم أو رمز المادة غير محدد في هذا الصف', severity: 'ERROR' });
      severity = 'ERROR';
    }

    if (netKG <= 0 && bulkBags <= 0) {
      if (isSnapshotType) {
        messages.push({ text: 'الرصيد المخزني أو كمية الشلايف غير مسجلة في هذا الصف', severity: 'ERROR' });
      } else {
        messages.push({ text: 'الوزن والكميات غير مسجلة أو تساوي صفراً', severity: 'ERROR' });
      }
      severity = 'ERROR';
    }

    // Material Match Warnings (Non-blocking)
    if (matConfidence === 'POSSIBLE_MATCH') {
      messages.push({ text: `مطابقة ذكية تقريبية للمادة (${matchRes.confidenceScore}%): "${matchedMaterial?.nameAr}"`, severity: 'WARNING' });
      if (severity !== 'ERROR') severity = 'WARNING';
    } else if (matConfidence === 'UNMATCHED') {
      messages.push({ text: `لم يتم العثور على مادة مطابقة لـ "${materialRaw || codeRaw}" - يرجى المراجعة بالخطوة 5`, severity: 'WARNING' });
      if (severity !== 'ERROR') severity = 'WARNING';
    }

    // Bulk bags info (Non-blocking)
    if (bulkBags === 0 && netKG > 0) {
      const estBags = Math.max(1, Math.round(netKG / 1000));
      messages.push({ text: `عدد الشلايف غير مسجل (التقدير الاسترشادي: ${estBags} شليف)`, severity: 'INFO' });
    }

    // Snapshot informational message
    if (isSnapshotType) {
      messages.push({ text: 'جرد رصيد مخزني معتمد - الرصيد يمثل المخزون الفعلي ولا ينشئ حركات استلام أو صرف وهمية', severity: 'INFO' });
    }

    // Duplicate check
    let isDuplicate = false;
    let duplicateInfo = '';

    const dupInMovements = existingMovements.some(
      (m) =>
        (m.referenceDocument === finalDocRef || (m.legacyDocRef && m.legacyDocRef === finalDocRef)) &&
        m.materialCode === matchedMaterial?.code &&
        Math.abs(m.quantityKG - netKG) < 1
    );

    if (dupInMovements) {
      isDuplicate = true;
      duplicateInfo = `مستند مكرر في النظام سابقاً (${finalDocRef})`;
      messages.push({ text: `تنبيه: تم استيراد حركة بنفس الرقم سابقاً (${finalDocRef})`, severity: 'WARNING' });
      if (severity !== 'ERROR') severity = 'WARNING';
    }

    if (messages.length === 0) {
      messages.push({ text: 'سجل سليم ومطابق لكافة معايير المصنع', severity: 'INFO' });
    }

    const rawCells: Record<string, any> = {};
    row.forEach((cell, idx) => {
      const colHeader = mappings[idx]?.rawHeader || `Col_${idx + 1}`;
      rawCells[colHeader] = cell;
    });

    const analyzedRow: AnalyzedDataRow = {
      id: `ROW-${sheetName}-${rowNumber1Based}-${Date.now().toString().slice(-4)}`,
      sourceRow: rowNumber1Based,
      sourceSheet: sheetName,
      rawCells,
      materialRaw,
      materialMatchedId: matchedMaterial?.id,
      materialMatchedCode: matchedMaterial?.code,
      materialMatchedNameAr: matchedMaterial?.nameAr,
      materialMatchedNameEn: matchedMaterial?.nameEn,
      materialMatchConfidence: matConfidence,
      materialMatchMethod: matchRes.method,
      materialMatchScore: matchRes.confidenceScore,
      materialMatchSuggestions: matchRes.suggestedCorrections,
      weightParseTrace: primaryWeightTrace,
      bulkBagParseTrace: primaryBagTrace,
      rowCategory: 'DATA',
      supplierRaw,
      supplierMatchedId: matchedSupplier?.id,
      supplierMatchedName: matchedSupplier?.nameAr,
      docRef: finalDocRef,
      legacyDocType: isSnapshotType ? 'INVENTORY_SNAPSHOT' : detectedType,
      date: dateRaw,
      time: timeRaw,
      grossKG,
      tareKG,
      netKG,
      inputKG,
      outputKG,
      damageKG,
      bulkBags,
      warehouseId: matchedMaterial?.defaultWarehouseId || 'WH-01',
      warehouseNameAr: allWarehouses.find((w) => w.id === matchedMaterial?.defaultWarehouseId)?.nameAr || 'مستودع الخامات الرئيسي رقم 1',
      locationId: matchedMaterial?.defaultLocationId || 'LOC-A01',
      locationCode: allLocations.find((l) => l.id === matchedMaterial?.defaultLocationId)?.code || 'LOC-A-01',
      line: String(getVal('line') || (detectedType === '360' ? 'خط الثرم الصناعي 01' : 'خط البثق 01')),
      driver: String(getVal('driver') || (isSnapshotType ? 'مسؤول المستودع' : 'سائق خارجي')),
      vehicle: String(getVal('vehicle') || (isSnapshotType ? 'مخزن داخلي' : 'حمل 100')),
      notes: String(getVal('notes') || ''),
      severity,
      messages,
      isDuplicate,
      duplicateInfo,
    };

    dataRows.push(analyzedRow);
  }

  // Calculate bounding box data region
  let startRow = headerRowIndex + 1;
  let endRow = headerRowIndex + 1;
  let startCol = 0;
  let endCol = Math.max(0, mappings.length - 1);

  if (dataRows.length > 0) {
    startRow = Math.min(...dataRows.map((r) => r.sourceRow - 1));
    endRow = Math.max(...dataRows.map((r) => r.sourceRow - 1));
  }

  const dataRegion: DataRegion = {
    startRow,
    endRow,
    startCol,
    endCol,
    rowCount: dataRows.length,
  };

  return { dataRows, summaryRows, ignoredRows, titleRows, dataRegion, classifiedRowsList };
}

// Re-parse a sheet when the user updates column associations in 'Map Columns' step
export function reparseSheetWithCustomMappings(
  currentSheet: SheetAnalysis,
  updatedMappings: ColumnMapping[],
  allMaterials: MaterialItem[],
  allSuppliers: Supplier[],
  allWarehouses: Warehouse[],
  allLocations: WarehouseLocation[],
  existingMovements: InventoryMovement[],
  existingReceiving: ReceivingTransaction[],
  existingShredding: ShreddingTransaction[],
  existingIssues: ProductionIssue[]
): SheetAnalysis {
  if (!currentSheet.rawMatrix || currentSheet.rawMatrix.length === 0) {
    return {
      ...currentSheet,
      detectedHeaders: updatedMappings,
    };
  }

  const hiddenRowSet = currentSheet.hiddenRowsList
    ? new Set(currentSheet.hiddenRowsList.map((hr) => hr.rowIndex))
    : undefined;

  const headerEndRowIndex = currentSheet.headerDepth && currentSheet.headerDepth > 1
    ? currentSheet.headerRowIndex + currentSheet.headerDepth - 1
    : currentSheet.headerRowIndex;

  const { dataRows, summaryRows, ignoredRows, titleRows, dataRegion, classifiedRowsList } = extractDataRowsFromMatrix(
    currentSheet.rawMatrix,
    currentSheet.headerRowIndex,
    updatedMappings,
    currentSheet.sheetName,
    currentSheet.detectedType,
    allMaterials,
    allSuppliers,
    allWarehouses,
    allLocations,
    existingMovements,
    existingReceiving,
    existingShredding,
    existingIssues,
    headerEndRowIndex,
    hiddenRowSet
  );

  const anomalyTracer = traceSixKgAndIsolatedRows(
    currentSheet.sheetName,
    currentSheet.rawMatrix,
    dataRows,
    ignoredRows.length
  );

  const rawWorkbookInspection = inspectRawWorkbookStructure(
    null,
    currentSheet.sheetName,
    currentSheet.rawMatrix,
    currentSheet.headerRowIndex,
    new Map(updatedMappings.map((m) => [m.mappedField, m.colIndex])),
    allMaterials,
    hiddenRowSet,
    undefined,
    dataRows,
    updatedMappings,
    classifiedRowsList
  );

  return {
    ...currentSheet,
    detectedHeaders: updatedMappings,
    dataRegion,
    transactionRowsCount: dataRows.length,
    summaryRowsCount: summaryRows.length,
    ignoredRowsCount: ignoredRows.length,
    dataRows,
    summaryRows,
    ignoredRows,
    titleRows,
    anomalyTracer,
    classifiedRowsList,
    rawWorkbookInspection,
  };
}

// Main Analyzer function
export function analyzeWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string,
  fileSize: string,
  allMaterials: MaterialItem[],
  allSuppliers: Supplier[],
  allWarehouses: Warehouse[],
  allLocations: WarehouseLocation[],
  existingMovements: InventoryMovement[],
  existingReceiving: ReceivingTransaction[],
  existingShredding: ShreddingTransaction[],
  existingIssues: ProductionIssue[]
): WorkbookAnalysis {
  const batchId = `BAT-${Date.now().toString().slice(-6)}`;
  const uploadedAt = new Date().toISOString();
  const sheets: SheetAnalysis[] = [];

  // Pre-extraction Hierarchical Structure Discovery (Structure, Merged Headers, Hidden Rows)
  const hierarchicalReport = detectWorkbookHierarchy(workbook, fileName, fileSize);

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const usedRange = worksheet['!ref'] || 'A1:A1';
    const decodedRange = XLSX.utils.decode_range(usedRange);
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: '' });

    if (rawMatrix.length === 0) {
      return;
    }

    const totalRows = rawMatrix.length;
    let maxCols = 0;
    rawMatrix.forEach((r) => {
      if (r && r.length > maxCols) maxCols = r.length;
    });

    // Obtain hierarchical structure analysis for this sheet
    const sheetHierarchical =
      hierarchicalReport.sheets.find((s) => s.sheetName === sheetName) ||
      analyzeSheetStructure(worksheet, sheetName, false);

    // Count merged cells if present
    const merges = worksheet['!merges'] || [];
    const detectedMergedCellsCount = merges.length;

    // Step 1: Scan for the best header row and use hierarchical resolved headers
    let bestHeaderRowIndex = sheetHierarchical.headerHierarchy.headerStartRow;
    const headerDepth = sheetHierarchical.headerHierarchy.depth;
    const headerEndRowIndex = sheetHierarchical.headerHierarchy.headerEndRow;

    // Prepare mappings from hierarchical resolved columns
    let bestMappings: ColumnMapping[] = [];
    if (sheetHierarchical.headerHierarchy.resolvedColumns.length > 0) {
      bestMappings = sheetHierarchical.headerHierarchy.resolvedColumns.map((rc) => ({
        colIndex: rc.colIndex,
        rawHeader: rc.fullPath || rc.leafTitle,
        mappedField: rc.mappedField,
        fieldLabelAr: rc.fieldLabelAr,
        fieldLabelEn: rc.fieldLabelEn,
        confidence: rc.confidence,
      }));
    } else {
      // Fallback to row scoring if needed
      let bestScore = -1;
      const scanLimit = Math.min(15, rawMatrix.length);
      for (let r = 0; r < scanLimit; r++) {
        const row = rawMatrix[r];
        if (isRowEmpty(row)) continue;
        const { score, mappings } = scoreHeaderRow(row);
        if (score > bestScore) {
          bestScore = score;
          bestHeaderRowIndex = r;
          bestMappings = mappings;
        }
      }

      if (bestScore <= 0 && rawMatrix.length > 0) {
        bestHeaderRowIndex = 0;
        bestMappings = (rawMatrix[0] || []).map((cell, idx) => ({
          colIndex: idx,
          rawHeader: String(cell || `Column ${idx + 1}`),
          mappedField: 'unknown',
          fieldLabelAr: String(cell || `عمود ${idx + 1}`),
          fieldLabelEn: String(cell || `Col ${idx + 1}`),
          confidence: 0,
        }));
      }
    }

    // Step 2: Detect Doc / Sheet Type
    const { type: detectedType, titleAr: typeTitleAr, titleEn: typeTitleEn, confidence: typeConfidence } = detectDocType(
      fileName,
      sheetName,
      bestMappings
    );

    // Step 3: Extract rows using the modular extractor with hierarchical boundaries & hidden rows isolation
    const hiddenRowSet = new Set<number>(sheetHierarchical.hiddenElements.hiddenRows.map((hr) => hr.rowIndex));

    const { dataRows, summaryRows, ignoredRows, titleRows, dataRegion, classifiedRowsList } = extractDataRowsFromMatrix(
      rawMatrix,
      bestHeaderRowIndex,
      bestMappings,
      sheetName,
      detectedType,
      allMaterials,
      allSuppliers,
      allWarehouses,
      allLocations,
      existingMovements,
      existingReceiving,
      existingShredding,
      existingIssues,
      headerEndRowIndex,
      hiddenRowSet
    );

    // Phase 1: Build Raw Workbook Inspection Structure
    const rawSampleRows = rawMatrix.slice(0, 20).map((row, rIdx) => ({
      rowNumber: rIdx + 1,
      cells: (row || []).map((c: any, cIdx: number) => ({
        colIndex: cIdx,
        colLetter: XLSX.utils.encode_col(cIdx),
        value: c,
        formattedText: c !== null && c !== undefined ? String(c) : '',
        type: typeof c === 'number' ? 'number' : typeof c === 'boolean' ? 'boolean' : 'string',
      })),
    }));

    // Build comprehensive forensic inspection
    const rawWorkbookInspection: RawWorkbookInspection = inspectRawWorkbookStructure(
      worksheet,
      sheetName,
      rawMatrix,
      bestHeaderRowIndex,
      new Map(bestMappings.map((m) => [m.mappedField, m.colIndex])),
      allMaterials,
      hiddenRowSet,
      new Set(sheetHierarchical.hiddenElements.hiddenCols.map((hc) => hc.colIndex)),
      dataRows,
      bestMappings,
      classifiedRowsList
    );

    // Phase 12 & Phase 13: Anomaly Tracer for 6 KG & Isolated Rows
    const anomalyTracer = traceSixKgAndIsolatedRows(
      fileName,
      rawMatrix,
      dataRows,
      ignoredRows.length
    );

    sheets.push({
      sheetName,
      totalRows,
      totalCols: maxCols,
      usedRange,
      headerRowIndex: bestHeaderRowIndex,
      dataRegion,
      detectedHeaders: bestMappings,
      detectedType,
      typeConfidence,
      typeTitleAr,
      typeTitleEn,
      transactionRowsCount: dataRows.length,
      summaryRowsCount: summaryRows.length,
      ignoredRowsCount: ignoredRows.length,
      dataRows,
      summaryRows,
      ignoredRows,
      titleRows,
      detectedMergedCellsCount,
      rawMatrix,
      sampleRows: rawMatrix.slice(headerEndRowIndex + 1, headerEndRowIndex + 6),

      // Hierarchical additions
      hierarchicalStructure: sheetHierarchical,
      headerDepth,
      hiddenRowsCount: sheetHierarchical.hiddenElements.totalHiddenRows,
      hiddenColsCount: sheetHierarchical.hiddenElements.totalHiddenCols,
      hiddenRowsList: sheetHierarchical.hiddenElements.hiddenRows,
      resolvedHierarchicalHeaders: sheetHierarchical.headerHierarchy.resolvedColumns,
      headerTree: sheetHierarchical.headerHierarchy.tree,
      structuralBands: sheetHierarchical.structuralBands,

      // 13-Phase Forensic Diagnostic Additions
      rawWorkbookInspection,
      anomalyTracer,
      classifiedRowsList,
    });
  });

  const totalDataRegions = sheets.filter((s) => s.dataRegion.rowCount > 0).length;
  const totalTransactionRows = sheets.reduce((acc, s) => acc + s.transactionRowsCount, 0);
  const totalSummaryRows = sheets.reduce((acc, s) => acc + s.summaryRowsCount, 0);
  const totalDetectedHeaders = sheets.reduce((acc, s) => acc + s.detectedHeaders.filter((h) => h.mappedField !== 'unknown').length, 0);
  const totalIgnoredRows = sheets.reduce((acc, s) => acc + s.ignoredRowsCount, 0);
  const totalHiddenRows = hierarchicalReport.overallStats.totalHiddenRows;
  const totalHiddenCols = hierarchicalReport.overallStats.totalHiddenCols;
  const maxHeaderDepth = hierarchicalReport.overallStats.maxHeaderDepth;

  return {
    fileName,
    fileSize,
    totalSheets: sheets.length,
    sheets,
    activeSheetIndex: 0,
    batchId,
    uploadedAt,
    totalDataRegions,
    totalTransactionRows,
    totalSummaryRows,
    totalDetectedHeaders,
    totalIgnoredRows,

    // Hierarchical additions
    hierarchicalReport,
    totalHiddenRows,
    totalHiddenCols,
    maxHeaderDepth,
  };
}

// Calculate Before/After Inventory Delta
export function calculateInventoryImpact(
  rows: AnalyzedDataRow[],
  docType: ExcelDocType,
  allMaterials: MaterialItem[],
  allWarehouses: Warehouse[],
  allLocations: WarehouseLocation[],
  currentMovements: InventoryMovement[]
): InventoryImpactItem[] {
  const impactMap = new Map<string, InventoryImpactItem>();

  // Filter only valid & unignored rows (include WARNING as they can still be imported, exclude hard ERROR)
  const activeRows = rows.filter((r) => !r.isIgnoredByUser && r.severity !== 'ERROR');

  activeRows.forEach((row) => {
    const mat = allMaterials.find((m) => m.id === row.materialMatchedId || m.code === row.materialMatchedCode) || allMaterials[0];
    if (!mat) return;

    const loc = allLocations.find((l) => l.id === row.locationId || l.code === row.locationCode) || allLocations[0];
    const wh = allWarehouses.find((w) => w.id === row.warehouseId || w.id === loc.warehouseId) || allWarehouses[0];

    const key = `${mat.id}_${wh.id}`;

    let existing = impactMap.get(key);
    if (!existing) {
      // Calculate current stock from movements
      let currentKG = 0;
      let currentBags = 0;

      currentMovements.forEach((mov) => {
        if (mov.materialId === mat.id || mov.materialCode === mat.code) {
          if (mov.destination.includes(loc.code) || mov.destination.includes(loc.nameAr)) {
            currentKG += mov.quantityKG;
            currentBags += mov.bulkBagsCount;
          }
          if (mov.source.includes(loc.code) || mov.source.includes(loc.nameAr)) {
            currentKG = Math.max(0, currentKG - mov.quantityKG);
            currentBags = Math.max(0, currentBags - mov.bulkBagsCount);
          }
        }
      });

      // Default baseline if no movements
      if (currentKG === 0 && loc.currentKG > 0) {
        currentKG = loc.currentKG;
        currentBags = loc.bulkBagsCount;
      }

      existing = {
        materialId: mat.id,
        materialCode: mat.code,
        materialNameAr: mat.nameAr,
        materialNameEn: mat.nameEn,
        warehouseId: wh.id,
        warehouseNameAr: wh.nameAr,
        locationCode: loc.code,
        currentKG,
        currentBags,
        deltaKG: 0,
        deltaBags: 0,
        projectedKG: currentKG,
        projectedBags: currentBags,
      };
      impactMap.set(key, existing);
    }

    // Apply delta depending on doc type
    if (docType === 'INVENTORY_SNAPSHOT' || docType === 'RAW_STORE_9' || docType === 'THERM_CAPACITY_9') {
      // INVENTORY_SNAPSHOT represents actual current stock directly; do NOT create receipt/issue deltas
      existing.projectedKG = row.netKG;
      existing.projectedBags = row.bulkBags;
      existing.deltaKG = row.netKG - existing.currentKG;
      existing.deltaBags = row.bulkBags - existing.currentBags;
    } else if (
      docType === '167' ||
      docType === '352' ||
      docType === SystemCodesAPI.getProductionCode() ||
      docType === SystemCodesAPI.getShreddingMoveCode()
    ) {
      // Production Issues and Shredding Moves are warehouse issues (outflows)
      existing.deltaKG -= row.netKG;
      existing.deltaBags -= row.bulkBags;
      existing.projectedKG = existing.currentKG + existing.deltaKG;
      existing.projectedBags = existing.currentBags + existing.deltaBags;
    } else {
      // 546 (Receiving), 360 (Shredding Store Receiving), or Inflows
      existing.deltaKG += row.netKG;
      existing.deltaBags += row.bulkBags;
      existing.projectedKG = existing.currentKG + existing.deltaKG;
      existing.projectedBags = existing.currentBags + existing.deltaBags;
    }
  });

  return Array.from(impactMap.values());
}
