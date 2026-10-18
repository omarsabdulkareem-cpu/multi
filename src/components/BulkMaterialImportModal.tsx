import React, { useState, useRef, useId } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Download,
  RefreshCw,
  Info,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Flame,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { MaterialItem, MaterialCategory } from '../types';

export interface BulkMaterialImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedMaterialRow {
  rowIndex: number;
  code: string;
  nameAr: string;
  nameEn: string;
  category: MaterialCategory | string;
  unit: string;
  minStockKG: number;
  maxStockKG: number;
  requiresShredding: boolean;
  defaultWarehouseId: string;
  defaultLocationId: string;
  notes: string;
  aliases: string[];
  status: 'NEW' | 'UPDATE' | 'INVALID';
  validationErrors: string[];
  originalRow: Record<string, any>;
}

export const BulkMaterialImportModal: React.FC<BulkMaterialImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t, isRTL } = useLanguage();
  const { materials, bulkImportMaterials, warehouses, locations } = useFactory();

  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import State
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [importMode, setImportMode] = useState<'UPSERT' | 'CREATE_ONLY' | 'UPDATE_ONLY'>('UPSERT');
  const [pastedText, setPastedText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Analysis / Review State
  const [parsedRows, setParsedRows] = useState<ParsedMaterialRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NEW' | 'UPDATE' | 'INVALID'>('ALL');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  // Helper: Normalize property keys from diverse JSON/CSV headers
  const getField = (row: Record<string, any>, possibleKeys: string[]): any => {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return row[key];
      }
      // Check lowercase matching
      const lowerKeys = Object.keys(row).map((k) => k.toLowerCase());
      const matchedKey = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
      if (matchedKey && row[matchedKey] !== undefined && String(row[matchedKey]).trim() !== '') {
        return row[matchedKey];
      }
    }
    return undefined;
  };

  // Helper: Parse boolean from flexible strings/values
  const parseBool = (val: any): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
      const s = val.trim().toLowerCase();
      return ['true', 'yes', '1', 'نعم', 'ثرم', 'مطلوب'].includes(s);
    }
    return false;
  };

  // Helper: CSV string parser handling quotes and commas
  const parseCSV = (text: string): Record<string, any>[] => {
    // Remove BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    // Split headers - detect separator (comma, semicolon, tab)
    const headerLine = lines[0];
    const separator = headerLine.includes('\t') ? '\t' : headerLine.includes(';') ? ';' : ',';

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let insideQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (c === separator && !insideQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(headerLine).map((h) => h.replace(/^["']|["']$/g, '').trim());

    const records: Record<string, any>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rowVals = parseLine(lines[i]);
      if (rowVals.length === 0 || (rowVals.length === 1 && rowVals[0] === '')) continue;
      const rec: Record<string, any> = {};
      headers.forEach((h, colIdx) => {
        let val = rowVals[colIdx] || '';
        val = val.replace(/^["']|["']$/g, '').trim();
        rec[h] = val;
      });
      records.push(rec);
    }
    return records;
  };

  // Process raw records into validated ParsedMaterialRow array
  const processRawRecords = (rawItems: any[]) => {
    setParseError(null);
    setImportResult(null);

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      setParseError(
        isRTL
          ? 'لم يتم العثور على سجلات صالحة في الملف/النص المدخل'
          : 'No valid records found in the provided file/text.'
      );
      setParsedRows([]);
      return;
    }

    const existingCodeMap = new Map<string, MaterialItem>();
    materials.forEach((m) => {
      existingCodeMap.set(m.code.trim().toLowerCase(), m);
    });

    const validated: ParsedMaterialRow[] = [];

    rawItems.forEach((raw, idx) => {
      const rowNum = idx + 1;
      const errors: string[] = [];

      // Extract Code
      const codeVal = getField(raw, [
        'code',
        'materialCode',
        'itemCode',
        'كود',
        'كود المادة',
        'رمز المادة',
        'رقم الصنف',
        'Code',
      ]);
      const code = codeVal ? String(codeVal).trim() : '';

      if (!code) {
        errors.push(isRTL ? 'كود الصنف (Material Code) مطلوب' : 'Material code is required');
      }

      // Extract Arabic Name
      const nameArVal = getField(raw, [
        'nameAr',
        'arabicName',
        'name_ar',
        'الاسم بالعربية',
        'اسم المادة',
        'المادة',
        'الصنف',
        'NameAr',
        'Material',
      ]);
      const nameAr = nameArVal ? String(nameArVal).trim() : '';

      if (!nameAr) {
        errors.push(isRTL ? 'الاسم بالعربية مطلوب' : 'Arabic material name is required');
      }

      // Extract English Name
      const nameEnVal = getField(raw, [
        'nameEn',
        'englishName',
        'name_en',
        'الاسم بالإنجليزية',
        'NameEn',
        'English Name',
        'name',
      ]);
      const nameEn = nameEnVal ? String(nameEnVal).trim() : nameAr;

      // Extract Category
      const catVal = getField(raw, [
        'category',
        'Category',
        'type',
        'التصنيف',
        'نوع المادة',
        'الفئة',
        'التصنيف البوليمري',
      ]);
      let category = catVal ? String(catVal).trim() : 'Raw Plastic / مواد خام';
      // Normalize common polymer strings
      if (category.toLowerCase().includes('pet') || category.includes('تيريفثالات')) {
        category = 'PET / بولي إيثيلين تيريفثالات';
      } else if (category.toLowerCase().includes('pp') || category.includes('بروبيلين')) {
        category = 'PP / بولي بروبيلين';
      } else if (category.toLowerCase().includes('ps') || category.toLowerCase().includes('hips') || category.includes('ستايرين')) {
        category = 'PS / بولي ستايرين';
      } else if (category.includes('سكراب') || category.toLowerCase().includes('scrap')) {
        category = 'Scrap & Trims / سكراب وهوالك';
      } else if (category.includes('مجروش') || category.includes('مفروم') || category.toLowerCase().includes('shredded')) {
        category = 'Shredded Granules / مجروش ومفروم';
      }

      // Extract Unit
      const unitVal = getField(raw, ['unit', 'Unit', 'الوحدة', 'وحدة القياس', 'uom']);
      const unit = unitVal ? String(unitVal).trim() : 'KG';

      // Extract Min & Max Stock KG
      const minStockRaw = getField(raw, [
        'minStockKG',
        'minStockLevelKG',
        'minStock',
        'الحد الأدنى',
        'حد الأمان',
        'MinStock',
        'MinStockKG',
      ]);
      const minStockKG = minStockRaw !== undefined && !isNaN(Number(minStockRaw)) ? Number(minStockRaw) : 5000;

      const maxStockRaw = getField(raw, [
        'maxStockKG',
        'maxStockLevelKG',
        'maxStock',
        'الحد الأقصى',
        'MaxStock',
        'MaxStockKG',
      ]);
      const maxStockKG = maxStockRaw !== undefined && !isNaN(Number(maxStockRaw)) ? Number(maxStockRaw) : 50000;

      if (minStockKG < 0 || maxStockKG < 0) {
        errors.push(isRTL ? 'حدود المخزون يجب أن تكون أرقاماً موجبة' : 'Stock levels must be positive numbers');
      }

      // Extract Requires Shredding
      const shreddingRaw = getField(raw, [
        'requiresShredding',
        'shredding',
        'ثرم',
        'يتطلب ثرم',
        'جرش',
        'RequiresShredding',
        'therm',
      ]);
      const requiresShredding = parseBool(shreddingRaw);

      // Warehouse and Location defaults
      const whVal = getField(raw, ['defaultWarehouseId', 'warehouseId', 'المستودع', 'Warehouse']);
      const locVal = getField(raw, ['defaultLocationId', 'locationId', 'الموقع', 'الرف', 'Location']);
      const defaultWarehouseId = whVal ? String(whVal).trim() : 'WH-01';
      const defaultLocationId = locVal ? String(locVal).trim() : 'LOC-A01';

      // Notes and Aliases
      const notesVal = getField(raw, ['notes', 'description', 'descriptionAr', 'ملاحظات', 'الوصف', 'Notes']);
      const notes = notesVal ? String(notesVal).trim() : '';

      const aliasesVal = getField(raw, ['aliases', 'أسماء بديلة', 'المرادفات', 'Aliases']);
      let aliases: string[] = [];
      if (Array.isArray(aliasesVal)) {
        aliases = aliasesVal.map(String);
      } else if (typeof aliasesVal === 'string' && aliasesVal.trim()) {
        aliases = aliasesVal.split(/[,|،]/).map((a) => a.trim()).filter(Boolean);
      }

      // Status
      let status: 'NEW' | 'UPDATE' | 'INVALID' = 'NEW';
      if (errors.length > 0) {
        status = 'INVALID';
      } else if (code && existingCodeMap.has(code.toLowerCase())) {
        status = 'UPDATE';
      } else {
        status = 'NEW';
      }

      validated.push({
        rowIndex: rowNum,
        code,
        nameAr,
        nameEn,
        category,
        unit,
        minStockKG,
        maxStockKG,
        requiresShredding,
        defaultWarehouseId,
        defaultLocationId,
        notes,
        aliases,
        status,
        validationErrors: errors,
        originalRow: raw,
      });
    });

    setParsedRows(validated);
  };

  // Parse text (JSON or CSV)
  const parseContent = (content: string, filename?: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      setParseError(isRTL ? 'المحتوى فارغ' : 'Input content is empty.');
      return;
    }

    if (filename) setSelectedFileName(filename);

    // Try parsing as JSON first if starts with [ or {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          processRawRecords(parsed);
          return;
        } else if (parsed && typeof parsed === 'object') {
          // Check for common wrappers like { materials: [...] } or { items: [...] } or { data: [...] }
          const candidateArray =
            parsed.materials || parsed.items || parsed.data || parsed.records || parsed.rows;
          if (Array.isArray(candidateArray)) {
            processRawRecords(candidateArray);
            return;
          }
        }
      } catch (err: any) {
        // If filename ends with .json, show JSON error
        if (filename && filename.toLowerCase().endsWith('.json')) {
          setParseError(
            isRTL
              ? `خطأ في صياغة ملف JSON: ${err.message}`
              : `Invalid JSON syntax: ${err.message}`
          );
          return;
        }
      }
    }

    // Otherwise attempt CSV / TSV parsing
    try {
      const csvRecords = parseCSV(trimmed);
      if (csvRecords.length > 0) {
        processRawRecords(csvRecords);
      } else {
        setParseError(
          isRTL
            ? 'تعذر قراءة بيانات CSV. تأكد من وجود صف رؤوس الأعمدة وبيانات مفصولة بفواصل.'
            : 'Could not parse CSV data. Ensure header line and comma-separated records exist.'
        );
      }
    } catch (err: any) {
      setParseError(
        isRTL
          ? `فشل تحليل بيانات الملف: ${err.message}`
          : `Failed to parse file: ${err.message}`
      );
    }
  };

  // Handle file selection from input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseContent(text, file.name);
    };
    reader.onerror = () => {
      setParseError(isRTL ? 'فشل قراءة الملف' : 'Failed to read file from disk.');
    };
    reader.readAsText(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        parseContent(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  // Load sample dataset
  const samplePolymerCatalog = [
    {
      code: 'PP-INJ-08',
      nameAr: 'حبيبات بولي بروبلين للحقن الصناعي',
      nameEn: 'PP Injection Molding Prime Resin',
      category: 'PP / بولي بروبيلين',
      unit: 'KG',
      minStockKG: 7500,
      maxStockKG: 60000,
      requiresShredding: false,
      defaultWarehouseId: 'WH-01',
      defaultLocationId: 'LOC-A01',
      notes: 'لإنتاج مقابض وأغطية العبوات الصلبة ذات المتانة العالية',
    },
    {
      code: 'PET-CLR-09',
      nameAr: 'حبيبات بولي إيثيلين تيريفثالات فائقة النقاء',
      nameEn: 'PET Ultra Clear Bottle Grade',
      category: 'PET / بولي إيثيلين تيريفثالات',
      unit: 'KG',
      minStockKG: 10000,
      maxStockKG: 80000,
      requiresShredding: false,
      defaultWarehouseId: 'WH-01',
      defaultLocationId: 'LOC-A02',
      notes: 'مادة عذراء عالية اللزوجة لخطوط تشكيل الأكواب الشفافة الفاخرة',
    },
    {
      code: 'HDPE-BLW-10',
      nameAr: 'حبيبات بولي إيثيلين عالي الكثافة للنفخ',
      nameEn: 'HDPE High Density Blow Molding Resin',
      category: 'HDPE / بولي إيثيلين عالي الكثافة',
      unit: 'KG',
      minStockKG: 4000,
      maxStockKG: 35000,
      requiresShredding: false,
      defaultWarehouseId: 'WH-01',
      defaultLocationId: 'LOC-B01',
      notes: 'مقاوم للمواد الكيميائية ودرجات الحرارة المتغيرة',
    },
    {
      code: 'SCR-CUP-11',
      nameAr: 'سكراب هوالك أكواب حرارية مطبوعة',
      nameEn: 'Printed Thermoforming Cup Trim Scrap',
      category: 'Scrap & Trims / سكراب وهوالك',
      unit: 'KG',
      minStockKG: 3000,
      maxStockKG: 25000,
      requiresShredding: true,
      defaultWarehouseId: 'WH-02',
      defaultLocationId: 'LOC-THM01',
      notes: 'هوالك تشكيل وطباعة يلزم جرثها وثرمها بماكينة الثرم المركزية',
    },
    {
      code: 'PET-FLK-01',
      nameAr: 'رقائق بولي إيثيلين تيريفثالات (تحديث المواصفات)',
      nameEn: 'PET Flakes Prime Quality (Updated)',
      category: 'Flakes / رقائق',
      unit: 'KG',
      minStockKG: 6000,
      maxStockKG: 50000,
      requiresShredding: false,
      defaultWarehouseId: 'WH-01',
      defaultLocationId: 'LOC-A01',
      notes: 'تحديث المواصفة القياسية لحد الأمان الأدنى للمخزون الحرج',
    },
  ];

  const handleLoadSample = () => {
    setSelectedFileName('alkarwan_sample_polymers.json');
    processRawRecords(samplePolymerCatalog);
    setPastedText(JSON.stringify(samplePolymerCatalog, null, 2));
  };

  // Download Sample Template files
  const handleDownloadSampleCSV = () => {
    const headers = [
      'code',
      'nameAr',
      'nameEn',
      'category',
      'unit',
      'minStockKG',
      'maxStockKG',
      'requiresShredding',
      'defaultWarehouseId',
      'defaultLocationId',
      'notes',
    ];
    const rows = samplePolymerCatalog.map((item) => [
      item.code,
      `"${item.nameAr}"`,
      `"${item.nameEn}"`,
      `"${item.category}"`,
      item.unit,
      item.minStockKG,
      item.maxStockKG,
      item.requiresShredding ? 'YES' : 'NO',
      item.defaultWarehouseId,
      item.defaultLocationId,
      `"${item.notes}"`,
    ]);

    const csvString = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'alkarwan_materials_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSampleJSON = () => {
    const jsonString = JSON.stringify(samplePolymerCatalog, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'alkarwan_materials_template.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Execute Import
  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.status !== 'INVALID');
    if (validRows.length === 0) {
      setParseError(
        isRTL ? 'لا توجد سجلات صالحة للاستيراد' : 'No valid records ready for import.'
      );
      return;
    }

    setIsProcessing(true);

    try {
      const itemsToImport = validRows.map((r) => ({
        code: r.code,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        category: r.category,
        unit: r.unit,
        minStockKG: r.minStockKG,
        maxStockKG: r.maxStockKG,
        minStockLevelKG: r.minStockKG,
        maxStockLevelKG: r.maxStockKG,
        requiresShredding: r.requiresShredding,
        defaultWarehouseId: r.defaultWarehouseId,
        defaultLocationId: r.defaultLocationId,
        notes: r.notes,
        descriptionAr: r.notes,
        aliases: r.aliases,
      }));

      const res = bulkImportMaterials(itemsToImport, importMode);

      setImportResult({
        added: res.addedCount,
        updated: res.updatedCount,
        skipped: res.skippedCount,
        errors: res.errors,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setParseError(
        isRTL
          ? `حدث خطأ غير متوقع أثناء الحفظ: ${err.message}`
          : `Unexpected error during import: ${err.message}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Metrics computation
  const totalCount = parsedRows.length;
  const newCount = parsedRows.filter((r) => r.status === 'NEW').length;
  const updateCount = parsedRows.filter((r) => r.status === 'UPDATE').length;
  const invalidCount = parsedRows.filter((r) => r.status === 'INVALID').length;

  const displayedRows = parsedRows.filter((r) => {
    if (filterStatus === 'ALL') return true;
    return r.status === filterStatus;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-w-4xl w-full rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-start">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {isRTL ? 'استيراد مواد بالجملة وتحديث الدليل' : 'Bulk Material Import & Master Sync'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  JSON / CSV
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'معالجة ملفات المخزون المهيكلة لتسجيل خامات جديدة أو تحديث بطاقات المواد والمستودعات'
                  : 'Parse structured files to mass-populate inventory master records or update existing specifications'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Success Banner if import completed */}
          {importResult ? (
            <div className="p-6 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 space-y-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">
                  {isRTL ? 'اكتملت عملية الاستيراد بنجاح!' : 'Bulk Import Completed Successfully!'}
                </h4>
                <p className="text-xs text-emerald-300">
                  {isRTL
                    ? 'تم تحديث سجلات الدليل المركزي وتوثيق العملية في سجل التدقيق الأمني'
                    : 'Inventory master records updated and audit trail entry logged.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30">
                  <span className="text-[11px] text-slate-400 block">{isRTL ? 'أصناف جديدة مضافة' : 'New Added'}</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">+{importResult.added}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30">
                  <span className="text-[11px] text-slate-400 block">{isRTL ? 'أصناف تم تحديثها' : 'Updated'}</span>
                  <span className="text-xl font-black text-cyan-400 font-mono">{importResult.updated}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700">
                  <span className="text-[11px] text-slate-400 block">{isRTL ? 'تم تخطيها' : 'Skipped'}</span>
                  <span className="text-xl font-black text-slate-300 font-mono">{importResult.skipped}</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-900 text-amber-300 text-xs text-start space-y-1 max-h-32 overflow-y-auto border border-amber-500/30">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'ملاحظات وتنبيهات الاستيراد:' : 'Import Notices:'}</span>
                  </div>
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-[11px] text-slate-300">• {err}</div>
                  ))}
                </div>
              )}

              <div className="pt-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setImportResult(null);
                    setParsedRows([]);
                    setSelectedFileName(null);
                    setPastedText('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  {isRTL ? 'استيراد دفعة أخرى' : 'Import Another Batch'}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
                >
                  {isRTL ? 'إغلاق وعرض الدليل' : 'Close & View Master Catalog'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Parse Error Alert */}
              {parseError && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{parseError}</span>
                  </div>
                  <button
                    onClick={() => setParseError(null)}
                    className="text-rose-400 hover:text-white font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Step 1: Input controls & Strategy */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Mode switcher tabs */}
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setActiveTab('FILE')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'FILE'
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'رفع ملف (CSV/JSON)' : 'Upload File (CSV/JSON)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('PASTE')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'PASTE'
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'لصق بيانات نصية' : 'Paste Raw Data'}</span>
                    </button>
                  </div>

                  {/* Sample Data & Templates */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold transition-all cursor-pointer"
                      title={isRTL ? 'تحميل نموذج بوليمرات تجريبي لاختبار الاستيراد' : 'Load sample polymer dataset for testing'}
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>{isRTL ? 'تحميل نموذج تجريبي' : 'Load Demo Sample'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSampleCSV}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
                      title="Download Template CSV"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSampleJSON}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
                      title="Download Template JSON"
                    >
                      <Download className="w-3 h-3 text-cyan-400" />
                      <span>JSON</span>
                    </button>
                  </div>
                </div>

                {/* Strategy options */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="font-bold text-slate-400">{isRTL ? 'استراتيجية المطابقة:' : 'Sync Strategy:'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={importMode}
                      onChange={(e: any) => setImportMode(e.target.value)}
                      className="p-1.5 px-3 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold outline-none focus:border-cyan-400"
                    >
                      <option value="UPSERT">
                        {isRTL ? 'إضافة الجديد + تحديث القائم (Upsert)' : 'Add New & Update Existing (Upsert)'}
                      </option>
                      <option value="CREATE_ONLY">
                        {isRTL ? 'إضافة الأصناف الجديدة فقط (تخطي القائم)' : 'Create New Only (Skip Existing)'}
                      </option>
                      <option value="UPDATE_ONLY">
                        {isRTL ? 'تحديث الأصناف القائمة فقط (تجاهل الجديد)' : 'Update Existing Only (Ignore New)'}
                      </option>
                    </select>
                  </div>
                </div>

                {/* File Upload Zone */}
                {activeTab === 'FILE' ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-6 sm:p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-2.5 ${
                      dragActive
                        ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950'
                        : 'border-slate-700 hover:border-cyan-500/50 bg-slate-900/60'
                    }`}
                  >
                    <input
                      id={fileInputId}
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.csv,.tsv,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm font-bold text-white">
                        {selectedFileName ? (
                          <span className="text-cyan-300 font-mono font-bold flex items-center gap-1.5 justify-center">
                            <FileText className="w-4 h-4" />
                            {selectedFileName}
                          </span>
                        ) : isRTL ? (
                          'اسحب وأفلت ملف JSON أو CSV هنا، أو انقر للاختيار'
                        ) : (
                          'Drag & drop a JSON or CSV file here, or click to browse'
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {isRTL
                          ? 'يدعم ملفات إكسل المصدرة كـ CSV أو ملفات JSON المهيكلة'
                          : 'Supports UTF-8 CSV, Tab-Delimited text, and standard JSON schemas'}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Text Paste Zone */
                  <div className="space-y-2">
                    <textarea
                      value={pastedText}
                      onChange={(e) => {
                        setPastedText(e.target.value);
                        if (e.target.value.trim().length > 0) {
                          parseContent(e.target.value, 'pasted_text_input');
                        } else {
                          setParsedRows([]);
                        }
                      }}
                      placeholder={
                        isRTL
                          ? `الصق كود JSON أو أسطر CSV هنا مباشرة...\nمثال JSON:\n[\n  {"code": "PP-HOMO-01", "nameAr": "بولي بروبلين هومو", "nameEn": "PP Homopolymer", "category": "PP / بولي بروبيلين", "minStockKG": 5000}\n]`
                          : `Paste JSON or CSV lines here directly...\nExample CSV:\ncode,nameAr,nameEn,category,minStockKG,maxStockKG\nPP-01,بولي بروبلين,PP Homopolymer,PP / بولي بروبيلين,5000,50000`
                      }
                      rows={6}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none focus:border-cyan-400"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => parseContent(pastedText, 'pasted_data')}
                        disabled={!pastedText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        {isRTL ? 'تحليل ومطابقة النص' : 'Parse & Validate'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Parsed Data Preview & Analysis Grid */}
              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">{isRTL ? 'إجمالي السجلات' : 'Total Records'}</span>
                      <span className="text-lg font-black text-white font-mono">{totalCount}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30">
                      <span className="text-[11px] text-emerald-400 block">{isRTL ? 'أصناف جديدة (إضافة)' : 'New Materials'}</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">+{newCount}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30">
                      <span className="text-[11px] text-cyan-400 block">{isRTL ? 'أصناف قائمة (تحديث)' : 'To Update'}</span>
                      <span className="text-lg font-black text-cyan-400 font-mono">{updateCount}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30">
                      <span className="text-[11px] text-rose-400 block">{isRTL ? 'سجلات غير صالحة' : 'Invalid / Errors'}</span>
                      <span className="text-lg font-black text-rose-400 font-mono">{invalidCount}</span>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          filterStatus === 'ALL'
                            ? 'bg-slate-700 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {isRTL ? `الكل (${totalCount})` : `All (${totalCount})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterStatus('NEW')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          filterStatus === 'NEW'
                            ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500/40'
                            : 'text-emerald-400/70 hover:text-emerald-300'
                        }`}
                      >
                        {isRTL ? `جديد (${newCount})` : `New (${newCount})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterStatus('UPDATE')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                          filterStatus === 'UPDATE'
                            ? 'bg-cyan-900/80 text-cyan-300 border border-cyan-500/40'
                            : 'text-cyan-400/70 hover:text-cyan-300'
                        }`}
                      >
                        {isRTL ? `تحديث (${updateCount})` : `Update (${updateCount})`}
                      </button>
                      {invalidCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setFilterStatus('INVALID')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            filterStatus === 'INVALID'
                              ? 'bg-rose-900/80 text-rose-300 border border-rose-500/40'
                              : 'text-rose-400/70 hover:text-rose-300'
                          }`}
                        >
                          {isRTL ? `أخطاء (${invalidCount})` : `Errors (${invalidCount})`}
                        </button>
                      )}
                    </div>

                    <span className="text-slate-400 text-[11px]">
                      {isRTL ? `معاينة ${displayedRows.length} سجل` : `Showing ${displayedRows.length} rows`}
                    </span>
                  </div>

                  {/* Data Preview Table */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                    <div className="max-h-64 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-xs text-start border-collapse">
                        <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                          <tr>
                            <th className="p-2.5 text-center w-12">#</th>
                            <th className="p-2.5">{isRTL ? 'الحالة' : 'Status'}</th>
                            <th className="p-2.5">{isRTL ? 'كود الصنف' : 'Code'}</th>
                            <th className="p-2.5">{isRTL ? 'الاسم بالعربية' : 'Arabic Name'}</th>
                            <th className="p-2.5">{isRTL ? 'التصنيف' : 'Category'}</th>
                            <th className="p-2.5 text-center">{isRTL ? 'حد الأمان (كغم)' : 'Min/Max KG'}</th>
                            <th className="p-2.5 text-center">{isRTL ? 'يتطلب ثرم' : 'Therm'}</th>
                            <th className="p-2.5">{isRTL ? 'ملاحظات / أخطاء' : 'Notes / Validation'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {displayedRows.map((row) => (
                            <tr
                              key={row.rowIndex}
                              className={`hover:bg-slate-900/60 transition-colors ${
                                row.status === 'INVALID'
                                  ? 'bg-rose-950/20'
                                  : row.status === 'UPDATE'
                                  ? 'bg-cyan-950/10'
                                  : ''
                              }`}
                            >
                              <td className="p-2.5 text-center font-mono text-slate-500 text-[11px]">
                                {row.rowIndex}
                              </td>

                              <td className="p-2.5">
                                {row.status === 'NEW' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                    {isRTL ? 'جديد' : 'NEW'}
                                  </span>
                                ) : row.status === 'UPDATE' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                    {isRTL ? 'تحديث' : 'UPDATE'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                                    {isRTL ? 'خطأ' : 'ERROR'}
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 font-mono font-bold text-cyan-400">
                                {row.code || '---'}
                              </td>

                              <td className="p-2.5 text-slate-200">
                                <div className="font-bold">{row.nameAr || '---'}</div>
                                {row.nameEn && row.nameEn !== row.nameAr && (
                                  <div className="text-[10px] text-slate-400 font-sans">{row.nameEn}</div>
                                )}
                              </td>

                              <td className="p-2.5 text-slate-300 text-[11px]">
                                {row.category ? (row.category.split('/')[0]?.trim() || row.category) : '-'}
                              </td>

                              <td className="p-2.5 text-center font-mono text-[11px] text-slate-300">
                                {row.minStockKG.toLocaleString()} / {row.maxStockKG.toLocaleString()}
                              </td>

                              <td className="p-2.5 text-center">
                                {row.requiresShredding ? (
                                  <span className="p-1 rounded bg-emerald-950 text-emerald-400 inline-block" title="يتطلب ثرم">
                                    <Flame className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <span className="p-1 rounded bg-slate-900 text-slate-500 inline-block" title="خزن مباشر">
                                    <Boxes className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </td>

                              <td className="p-2.5 text-[11px]">
                                {row.validationErrors.length > 0 ? (
                                  <span className="text-rose-400 font-bold">
                                    {row.validationErrors.join('، ')}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 truncate max-w-xs block">
                                    {row.notes || (row.status === 'UPDATE' ? (isRTL ? 'مطابقة مع الصنف القائم' : 'Matches existing') : '---')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isRTL
                  ? 'يتم توثيق كل عملية استيراد في سجل التدقيق الأمني مع اسم المشغل والوقت'
                  : 'All import transactions are automatically logged in the immutable audit ledger'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                {t('cancel')}
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isProcessing || parsedRows.filter((r) => r.status !== 'INVALID').length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>{isRTL ? 'جاري الاستيراد والتحديث...' : 'Importing Records...'}</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4 text-cyan-300" />
                    <span>
                      {isRTL
                        ? `تنفيذ استيراد (${parsedRows.filter((r) => r.status !== 'INVALID').length} مادة)`
                        : `Execute Import (${parsedRows.filter((r) => r.status !== 'INVALID').length} Items)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
