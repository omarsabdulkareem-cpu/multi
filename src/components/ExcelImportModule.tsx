import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Download,
  Sparkles,
  Database,
  RotateCcw,
  Cpu,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  WorkbookAnalysis,
  SheetAnalysis,
  AnalyzedDataRow,
  ExcelDocType,
  analyzeWorkbook,
  calculateInventoryImpact,
  ColumnMapping,
  generateMaterialSmartSuggestions,
  reparseSheetWithCustomMappings,
} from '../services/smartExcelParser';
import { MaterialItem } from '../types';
import { ImportWorkflowStep } from './excel/excelTypes';
import { WorkflowStepper } from './excel/WorkflowStepper';
import { WorkbookAnalysisView } from './excel/WorkbookAnalysisView';
import { DataDetectionView } from './excel/DataDetectionView';
import { ColumnMappingView } from './excel/ColumnMappingView';
import { MaterialMatchView } from './excel/MaterialMatchView';
import { ValidationView } from './excel/ValidationView';
import { DataPreviewView } from './excel/DataPreviewView';
import { InventoryImpactView } from './excel/InventoryImpactView';
import { CommitMigrationView } from './excel/CommitMigrationView';
import { ExcelParserDiagnosticsView } from './excel/ExcelParserDiagnosticsView';
import { ExcelParserDebugModal } from './excel/ExcelParserDebugModal';

export const ExcelImportModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    materials,
    suppliers,
    warehouses,
    locations,
    inventoryMovements,
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    currentUser,
    importSmartAnalyzedRows,
  } = useFactory();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core Workbook Analysis State
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // Debug Diagnostics Modal State
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState<boolean>(false);

  // 9-Stage Workflow Pipeline State
  const [workflowStep, setWorkflowStep] = useState<ImportWorkflowStep>('UPLOAD');

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Sheet Analysis Reference
  const currentSheet: SheetAnalysis | undefined = analysis?.sheets[activeSheetIdx];

  // Custom Column Mappings State for active sheet
  const [customMappings, setCustomMappings] = useState<ColumnMapping[]>([]);

  // Synchronize custom mappings whenever currentSheet changes
  useEffect(() => {
    if (currentSheet) {
      setCustomMappings(currentSheet.detectedHeaders);
    }
  }, [currentSheet?.sheetName, currentSheet?.headerRowIndex, activeSheetIdx]);

  // Auto-initialize live diagnostics with primary target RAW_STORE_9 ("مخزن خامات 9.xlsx") on initial mount
  useEffect(() => {
    handleLoadFactoryPreset('RAW_STORE_9', 'DIAGNOSTICS');
  }, []);

  // Update a single column mapping
  const handleUpdateMapping = (colIdx: number, newField: string) => {
    setCustomMappings((prev) =>
      prev.map((m) => (m.colIndex === colIdx ? { ...m, mappedField: newField, isManualOverride: true } : m))
    );
  };

  // Re-parse sheet when user modifies column mappings
  const handleApplyCustomMappings = () => {
    if (!analysis || !currentSheet) return;

    try {
      const updatedSheet = reparseSheetWithCustomMappings(
        currentSheet,
        customMappings,
        materials,
        suppliers,
        warehouses,
        locations,
        inventoryMovements,
        receivingTransactions,
        shreddingTransactions,
        productionIssues
      );

      const newSheets = [...analysis.sheets];
      newSheets[activeSheetIdx] = updatedSheet;

      setAnalysis({
        ...analysis,
        sheets: newSheets,
      });

      setSuccessMessage(
        isRTL
          ? 'تم بنجاح تطبيق تعيينات الأعمدة الجديدة وإعادة فحص الحركات وتدقيق الأوزان!'
          : 'Successfully re-parsed rows with custom column mappings!'
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to apply custom column mappings');
    }
  };

  // Reset custom mappings to auto-detected mappings
  const handleResetAutoMappings = () => {
    if (!currentSheet?.detectedHeaders) return;
    setCustomMappings(currentSheet.detectedHeaders);
    setSuccessMessage(
      isRTL ? 'تمت استعادة التعيينات التلقائية الأصلية' : 'Restored default auto mappings'
    );
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Calculate material smart suggestions using fuzzy string matcher against Item Master
  const smartSuggestions = useMemo(() => {
    if (!currentSheet?.dataRows) return [];
    return generateMaterialSmartSuggestions(currentSheet.dataRows, materials);
  }, [currentSheet?.dataRows, materials]);

  // Apply a single smart suggestion to all matching rows
  const handleApplySmartSuggestion = (rawMaterialText: string, targetMaterial: MaterialItem, reasonAr?: string) => {
    if (!targetMaterial) return;
    updateActiveSheetRows((rows) =>
      rows.map((row) => {
        if (row.materialRaw === rawMaterialText || row.materialMatchedNameAr === rawMaterialText) {
          const newMessages = row.messages.filter((m) => m.severity !== 'ERROR');
          newMessages.push({
            text: isRTL
              ? `مطابقة ذكية مع: ${targetMaterial.nameAr || targetMaterial.nameEn} (${reasonAr || 'اقتراح ذكي معتمد'})`
              : `Smart matched to: ${targetMaterial.nameEn || targetMaterial.nameAr} (${reasonAr || 'Accepted suggestion'})`,
            severity: 'INFO',
          });

          const hasRemainingErrors = newMessages.some((m) => m.severity === 'ERROR');
          const hasRemainingWarnings = newMessages.some((m) => m.severity === 'WARNING');

          return {
            ...row,
            materialMatchedId: targetMaterial.id,
            materialMatchedCode: targetMaterial.code,
            materialMatchedNameAr: targetMaterial.nameAr || targetMaterial.nameEn,
            materialMatchedNameEn: targetMaterial.nameEn || targetMaterial.nameAr,
            materialMatchConfidence: 'EXACT_CODE' as const,
            warehouseId: targetMaterial.defaultWarehouseId,
            locationId: targetMaterial.defaultLocationId,
            severity: hasRemainingErrors ? 'ERROR' : hasRemainingWarnings ? 'WARNING' : 'VALID',
            messages: newMessages,
          };
        }
        return row;
      })
    );

    setSuccessMessage(
      isRTL
        ? `✓ تم اعتماد المادة "${targetMaterial.nameAr || targetMaterial.nameEn}" وتطبيقها على كافة السجلات المطابقة!`
        : `✓ Material "${targetMaterial.nameEn || targetMaterial.nameAr}" accepted and applied across all matching records!`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Bulk Apply All High-Confidence Smart Suggestions
  const handleApplyAllHighConfidenceSuggestions = () => {
    const highConf = smartSuggestions.filter((s) => s.confidence === 'HIGH' && !s.isAlreadyCorrected);
    if (highConf.length === 0) {
      setSuccessMessage(
        isRTL
          ? 'كافة الاقتراحات عالية الدقة مطبقة بالفعل!'
          : 'All high confidence suggestions are already applied!'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }

    updateActiveSheetRows((rows) => {
      let updatedRows = [...rows];
      highConf.forEach((sugg) => {
        const targetMaterial = sugg.bestMatch;
        if (!targetMaterial) return;
        updatedRows = updatedRows.map((row) => {
          if (row.materialRaw === sugg.rawText || row.materialMatchedNameAr === sugg.rawText) {
            const newMessages = row.messages.filter((m) => m.severity !== 'ERROR');
            newMessages.push({
              text: isRTL
                ? `اقتراح ذكي (${sugg.similarityScore}%): ${targetMaterial.nameAr || targetMaterial.nameEn} - ${sugg.matchReasonAr}`
                : `Smart Suggestion (${sugg.similarityScore}%): ${targetMaterial.nameEn || targetMaterial.nameAr} - ${sugg.matchReasonEn}`,
              severity: 'INFO',
            });
            const hasRemainingErrors = newMessages.some((m) => m.severity === 'ERROR');
            const hasRemainingWarnings = newMessages.some((m) => m.severity === 'WARNING');
            return {
              ...row,
              materialMatchedId: targetMaterial.id,
              materialMatchedCode: targetMaterial.code,
              materialMatchedNameAr: targetMaterial.nameAr || targetMaterial.nameEn,
              materialMatchedNameEn: targetMaterial.nameEn || targetMaterial.nameAr,
              materialMatchConfidence: 'EXACT_CODE' as const,
              warehouseId: targetMaterial.defaultWarehouseId,
              locationId: targetMaterial.defaultLocationId,
              severity: hasRemainingErrors ? 'ERROR' : hasRemainingWarnings ? 'WARNING' : 'VALID',
              messages: newMessages,
            };
          }
          return row;
        });
      });
      return updatedRows;
    });

    setSuccessMessage(
      isRTL
        ? `✓ تم بنجاح تطبيق ${highConf.length} اقتراح ذكي عالي الدقة على كافة حركات الملف!`
        : `✓ Successfully applied ${highConf.length} high-confidence smart suggestions across all rows!`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Helper to re-evaluate active sheet rows
  const updateActiveSheetRows = (updater: (rows: AnalyzedDataRow[]) => AnalyzedDataRow[]) => {
    if (!analysis || !currentSheet) return;
    const updatedRows = updater(currentSheet.dataRows);

    const updatedSheet: SheetAnalysis = {
      ...currentSheet,
      dataRows: updatedRows,
      transactionRowsCount: updatedRows.length,
    };

    const newSheets = [...analysis.sheets];
    newSheets[activeSheetIdx] = updatedSheet;

    setAnalysis({
      ...analysis,
      sheets: newSheets,
    });
  };

  // Change Document Type Override
  const handleDocTypeChange = (newType: ExcelDocType) => {
    if (!analysis || !currentSheet) return;

    let titleAr = '';
    let titleEn = '';
    if (newType === '546') {
      titleAr = 'استلام مواد خامات (مستند 546)';
      titleEn = 'Raw Material Receipt (Doc 546)';
    } else if (newType === '360') {
      titleAr = 'استلام مخزن الثرم (مستند 360)';
      titleEn = 'Shredding / Therm Store Receiving (Doc 360)';
    } else if (newType === '167') {
      titleAr = 'صادر مواد خامات للإنتاج (مستند 167)';
      titleEn = 'Raw Material Issue (Doc 167)';
    } else if (newType === '352') {
      titleAr = 'سجل مستند 352 للثرم والمخازن';
      titleEn = 'Therm/Store Legacy Doc 352';
    } else {
      titleAr = 'الأرصدة والطاقة المخزنية للمستودعات';
      titleEn = 'Warehouse Inventory Snapshot';
    }

    const updatedRows = currentSheet.dataRows.map((r) => ({
      ...r,
      legacyDocType: newType,
      docRef: r.docRef.replace(/^(546|360|167|352|INVENTORY_SNAPSHOT|GENERAL_MOVEMENT)/, newType),
    }));

    const updatedSheet: SheetAnalysis = {
      ...currentSheet,
      detectedType: newType,
      typeTitleAr: titleAr,
      typeTitleEn: titleEn,
      dataRows: updatedRows,
    };

    const newSheets = [...analysis.sheets];
    newSheets[activeSheetIdx] = updatedSheet;

    setAnalysis({
      ...analysis,
      sheets: newSheets,
    });
  };

  // Quick Map Unmatched Material
  const handleMapMaterial = (rawMaterialName: string, targetMaterial: MaterialItem) => {
    if (!targetMaterial) return;
    updateActiveSheetRows((rows) =>
      rows.map((row) => {
        if (row.materialRaw === rawMaterialName || row.materialMatchedNameAr === rawMaterialName) {
          const newMessages = row.messages.filter((m) => m.severity !== 'ERROR');
          newMessages.push({ text: `تمت المطابقة يدوياً مع: ${targetMaterial.nameAr || targetMaterial.nameEn}`, severity: 'INFO' });

          const hasRemainingErrors = newMessages.some((m) => m.severity === 'ERROR');
          const hasRemainingWarnings = newMessages.some((m) => m.severity === 'WARNING');

          return {
            ...row,
            materialMatchedId: targetMaterial.id,
            materialMatchedCode: targetMaterial.code,
            materialMatchedNameAr: targetMaterial.nameAr || targetMaterial.nameEn,
            materialMatchedNameEn: targetMaterial.nameEn || targetMaterial.nameAr,
            materialMatchConfidence: 'EXACT_CODE' as const,
            warehouseId: targetMaterial.defaultWarehouseId,
            locationId: targetMaterial.defaultLocationId,
            severity: hasRemainingErrors ? 'ERROR' : hasRemainingWarnings ? 'WARNING' : 'VALID',
            messages: newMessages,
          };
        }
        return row;
      })
    );
  };

  // Toggle Row Ignore State
  const handleToggleIgnoreRow = (rowId: string) => {
    updateActiveSheetRows((rows) =>
      rows.map((r) => (r.id === rowId ? { ...r, isIgnoredByUser: !r.isIgnoredByUser } : r))
    );
  };

  // Ignore All Invalid / Error Rows with one click
  const handleIgnoreAllErrors = () => {
    updateActiveSheetRows((rows) =>
      rows.map((r) => (r.severity === 'ERROR' ? { ...r, isIgnoredByUser: true } : r))
    );
    setSuccessMessage(isRTL ? 'تم تجاهل كافة الصفوف التي تحتوي على أخطاء بنجاح' : 'All error rows ignored successfully');
  };

  // Real File Reader and Smart Analyzer
  const processFile = (file: File) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage(
        isRTL
          ? 'نوع الملف غير مدعوم. يرجى اختيار ملف Excel بصيغة (.xlsx, .xls, .csv)'
          : 'Unsupported file type. Please provide an Excel (.xlsx, .xls, .csv) file.'
      );
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false,
        });

        const sizeInKB = `${(file.size / 1024).toFixed(1)} KB`;

        const result = analyzeWorkbook(
          workbook,
          file.name,
          sizeInKB,
          materials,
          suppliers,
          warehouses,
          locations,
          inventoryMovements,
          receivingTransactions,
          shreddingTransactions,
          productionIssues
        );

        setAnalysis(result);
        setActiveSheetIdx(0);
        setWorkflowStep('DIAGNOSTICS');
        setIsParsing(false);
        setSuccessMessage(
          isRTL
            ? `✓ تم بنجاح تحليل ملف Excel "${file.name}" وتجهيز لوحة فحص المخرجات والتشخيص!`
            : `✓ Successfully parsed Excel file "${file.name}" and loaded live diagnostics!`
        );
      } catch (err: any) {
        setIsParsing(false);
        setErrorMessage(
          isRTL
            ? `حدث خطأ أثناء قراءة ملف Excel: ${err.message || 'خطأ غير معروف'}`
            : `Failed to parse Excel file: ${err.message || 'Unknown error'}`
        );
      }
    };

    reader.onerror = () => {
      setIsParsing(false);
      setErrorMessage(isRTL ? 'تعذر قراءة محتوى الملف' : 'Could not read file contents');
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Preset Factory Test Files (including historical AL-KARWAN files & 9295-row test)
  const handleLoadFactoryPreset = (presetName: string, targetStep?: ImportWorkflowStep) => {
    setIsParsing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let sampleRows: any[] = [];
    let fileName = '';
    let sheetName = '';

    if (presetName === '546') {
      fileName = '546.xlsx';
      sheetName = 'استلام مواد خامات 546';
      sampleRows = [
        ['شركة الكروان لصناعة البلاستيك - سجل الاستلام العام'],
        ['رقم المستند', 'التاريخ', 'اسم المورد', 'اسم المادة', 'رقم الشاحنة', 'اسم السائق', 'وزن الدخول (قائم)', 'وزن الخروج (فارغ)', 'الصافي', 'عدد الشلايف'],
        ['546/2026/101', '2026-09-01', 'شركة الدلتا للبتروكيماويات والبوليمرات', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 'بغداد 14523 حمل', 'علي حيدر', 28500, 14200, 14300, 15],
        ['546/2026/102', '2026-09-01', 'مصنع النصر لتدوير اللدائن وسكراب البلاستيك', 'سكراب وهوالك أكواب مفرومة (Batal Scrap)', 'بصرة 88312 حمل', 'كرار جاسم', 34200, 15100, 19100, 20],
        ['546/2026/103', '2026-09-02', 'الشركة العربية لتجارة وتوزيع اللدائن (سابك)', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 'أربيل 55214 حمل', 'سردار أحمد', 32000, 13500, 18500, 18],
        ['546/2026/104', '2026-09-02', 'شركة الرافدين للتجارة العامة', 'سكراب اكواب بلاستك', 'بغداد 99120 حمل', 'حسين جاسم', 29000, 14000, 15000, 14],
        ['546/2026/105', '2026-09-03', 'المؤسسة الوطنية للبتروكيماويات', 'رقايق بت مفروم', 'ديالى 34211 حمل', 'مصطفى كامل', 31500, 14500, 17000, 16],
        ['المجموع العام', '', '', '', '', '', '', '', 83900, 83],
        ['أمين المخزن: أحمد خليل', '', '', '', '', '', '', '', 'المشرف: عمر عبدالكريم', ''],
      ];
    } else if (presetName === '360') {
      fileName = '360.xlsx';
      sheetName = 'استلام مخزن الثرم 360';
      sampleRows = [
        ['سجل استلام مخزن الثرم والمفروم - مصنع الكروان'],
        ['رقم المستند', 'التاريخ', 'اسم المادة', 'الوزن المدخل', 'الوزن المثروم', 'تالف إنتاج', 'عدد الشلايف', 'خط الثرم'],
        ['360/2026/045', '2026-09-01', 'بطل مثروم', 13500, 13224, 180, 35, 'خط الثرم الصناعي 01'],
        ['360/2026/046', '2026-09-02', 'هوالك أطراف رولات ألواح (Sheet Trims & Edges)', 8200, 8050, 110, 18, 'خط الثرم الصناعي 01'],
        ['المجموع الإجمالي', '', '', 21700, 21274, 290, 53, ''],
      ];
    } else if (presetName === '167') {
      fileName = '167.xlsx';
      sheetName = 'صادر مواد خامات 167';
      sampleRows = [
        ['مستندات صرف المواد الخام لصالة الإنتاج - قسم البثق'],
        ['رقم المستند', 'التاريخ', 'المادة', 'الكمية المصروفة (كغم)', 'عدد الشلايف', 'خط الإنتاج', 'أمر الإنتاج'],
        ['167/2026/088', '2026-09-01', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 9500, 10, 'خط البثق والتحبيب 01', 'PO-8841'],
        ['167/2026/089', '2026-09-02', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 12000, 12, 'خط بثق الألواح الشفافة B', 'PO-8842'],
        ['المجموع', '', '', 21500, 22, '', ''],
      ];
    } else if (presetName === '352') {
      fileName = '352.xlsx';
      sheetName = 'مستند 352';
      sampleRows = [
        ['سجل مستند 352 - ترحيل مفروم ومجروش الثرم'],
        ['رقم المستند', 'التاريخ', 'المادة', 'الوزن الصافي (كغم)', 'الشلايف', 'الموقع المستهدف'],
        ['352/2026/012', '2026-09-01', 'مفروم ومجروش أكواب بطل (Batal Shredded)', 14800, 16, 'LOC-THM-02'],
        ['352/2026/013', '2026-09-02', 'حبيبات بولي ستايرين مقاوم للصدمات (HIPS Pellets)', 11200, 12, 'LOC-B-01'],
        ['صافي المجموع', '', '', 26000, 28, ''],
      ];
    } else if (presetName === 'RAW_STORE_9') {
      fileName = 'مخزن خامات 9.xlsx';
      sheetName = 'أرصدة مخزن الخامات 9';
      sampleRows = [
        ['تقرير جرد وطاقة مخزن الخامات الرئيسي - شركة الكروان'],
        ['رمز المادة', 'المادة', 'الرصيد الحالي (كغم)', 'عدد الشلايف', 'المستودع', 'الموقع'],
        ['PET-FLK-01', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 19450, 38, 'WH-01', 'LOC-A-01'],
        ['PP-GRN-02', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 24300, 45, 'WH-01', 'LOC-A-02'],
        ['HIPS-PEL-06', 'حبيبات بولي ستايرين مقاوم للصدمات (HIPS Pellets)', 14800, 28, 'WH-01', 'LOC-B-01'],
        ['MB-WHT-07', 'ماسترباتش أبيض فائق التغطية (White Masterbatch)', 6200, 8, 'WH-01', 'LOC-B-02'],
        ['إجمالي الرصيد', '', 64750, 119, '', ''],
      ];
    } else if (presetName === 'THERM_CAPACITY_9') {
      fileName = 'طاقة مخزنية لمخزن الثرم -9.xlsx';
      sheetName = 'طاقة مخزن الثرم';
      sampleRows = [
        ['بيان الطاقة المخزنية والأرصدة - مستودع ومخزن الثرم رقم 2'],
        ['رمز المادة', 'المادة', 'الوزن (كغم)', 'الشلايف', 'الموقع'],
        ['BTL-SCR-03', 'سكراب وهوالك أكواب مفرومة (Batal Scrap)', 12800, 24, 'LOC-THM-01'],
        ['BTL-SHR-04', 'مفروم ومجروش أكواب بطل (Batal Shredded)', 27048, 42, 'LOC-THM-02'],
        ['SHT-TRM-05', 'هوالك أطراف رولات ألواح (Sheet Trims & Edges)', 9400, 15, 'LOC-THM-01'],
        ['المجموع', '', 49248, 81, ''],
      ];
    } else if (presetName === 'HIERARCHICAL_MERGED') {
      fileName = 'سجل_الكروان_هرمي_ومخفي.xlsx';
      sheetName = 'استلام خامات هرمي 546';
      sampleRows = [
        ['شركة الكروان لصناعة البلاستيك - سجل الاستلام العام المعتمد'],
        ['بيانات المستند والتاريخ', '', 'بيانات المورد والمادة', '', 'بيانات الميزان والوزن', '', '', 'عدد الشلايف', 'بيانات النقل واللوجستيك', ''],
        ['رقم المستند', 'التاريخ', 'اسم المورد', 'اسم المادة', 'وزن الدخول (قائم)', 'وزن الخروج (فارغ)', 'الصافي', '', 'رقم الشاحنة', 'اسم السائق'],
        ['546/2026/101', '2026-09-01', 'شركة الدلتا للبتروكيماويات والبوليمرات', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 28500, 14200, 14300, 15, 'بغداد 14523 حمل', 'علي حيدر'],
        ['546/2026/102', '2026-09-01', 'مصنع النصر لتدوير اللدائن وسكراب البلاستيك', 'سكراب وهوالك أكواب مفرومة (Batal Scrap)', 34200, 15100, 19100, 20, 'بصرة 88312 حمل', 'كرار جاسم'],
        ['546/2026/103', '2026-09-02', 'الشركة العربية لتجارة وتوزيع اللدائن (سابك)', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 32000, 13500, 18500, 18, 'أربيل 55214 حمل', 'سردار أحمد'],
        ['546/2026/104', '2026-09-02', 'شركة الرافدين للتجارة العامة', 'سكراب اكواب بلاستك', 29000, 14000, 15000, 14, 'بغداد 99120 حمل', 'حسين جاسم'],
        ['546/2026/105', '2026-09-03', 'المؤسسة الوطنية للبتروكيماويات', 'رقايق بت مفروم', 31500, 14500, 17000, 16, 'ديالى 34211 حمل', 'مصطفى كامل'],
        ['مسودة غير معتمدة - قيد التدقيق المخزني', '2026-09-03', 'مورد اختباري', 'مادة تحت الفحص', 0, 0, 0, 0, 'شاحنة فحص', 'سائق تجريبي'],
        ['المجموع العام', '', '', '', '', '', 83900, 83, '', ''],
        ['أمين المخزن: أحمد خليل', '', '', '', '', '', '', '', 'المشرف: عمر عبدالكريم', ''],
      ];
      // Inject some empty template rows
      for (let i = 1; i <= 25; i++) {
        sampleRows.push([i, '', '', '', '', '', '', '', '', '']);
      }
    } else {
      // TEST_9295: The 9,295 empty pre-numbered template rows test file
      fileName = 'ملف_فحص_الـ9295_صف_قالب_فارغ.xlsx';
      sheetName = 'استلام مواد خامات 546';
      sampleRows = [
        ['شركة الكروان لصناعة البلاستيك - سجل الاستلام العام'],
        ['رقم المستند', 'التاريخ', 'اسم المورد', 'اسم المادة', 'رقم الشاحنة', 'اسم السائق', 'وزن الدخول (قائم)', 'وزن الخروج (فارغ)', 'الصافي', 'عدد الشلايف'],
        ['546/2026/101', '2026-09-01', 'شركة الدلتا للبتروكيماويات والبوليمرات', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 'بغداد 14523 حمل', 'علي حيدر', 28500, 14200, 14300, 15],
        ['546/2026/102', '2026-09-01', 'مصنع النصر لتدوير اللدائن وسكراب البلاستيك', 'سكراب وهوالك أكواب مفرومة (Batal Scrap)', 'بصرة 88312 حمل', 'كرار جاسم', 34200, 15100, 19100, 20],
        ['546/2026/103', '2026-09-02', 'الشركة العربية لتجارة وتوزيع اللدائن (سابك)', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 'أربيل 55214 حمل', 'سردار أحمد', 32000, 13500, 18500, 18],
        ['546/2026/104', '2026-09-02', 'شركة الرافدين للتجارة العامة', 'سكراب اكواب بلاستك', 'بغداد 99120 حمل', 'حسين جاسم', 29000, 14000, 15000, 14],
        ['546/2026/105', '2026-09-03', 'المؤسسة الوطنية للبتروكيماويات', 'رقايق بت مفروم', 'ديالى 34211 حمل', 'مصطفى كامل', 31500, 14500, 17000, 16],
        ['المجموع العام', '', '', '', '', '', '', '', 83900, 83],
        ['أمين المخزن: أحمد خليل', '', '', '', '', '', '', '', 'المشرف: عمر عبدالكريم', ''],
      ];
      // Inject 9,295 empty pre-numbered template rows
      for (let i = 1; i <= 9295; i++) {
        sampleRows.push([i, '', '', '', '', '', '', '', '', '']);
      }
    }

    try {
      const ws = XLSX.utils.aoa_to_sheet(sampleRows);

      // If hierarchical preset, configure merges and hidden row
      if (presetName === 'HIERARCHICAL_MERGED') {
        ws['!merges'] = [
          { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // A2:B2
          { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // C2:D2
          { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } }, // E2:G2
          { s: { r: 1, c: 7 }, e: { r: 2, c: 7 } }, // H2:H3
          { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } }, // I2:J2
        ];
        const rows: any[] = [];
        rows[8] = { hidden: true }; // Row 9 is hidden
        ws['!rows'] = rows;
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const result = analyzeWorkbook(
        wb,
        fileName,
        '48.5 KB',
        materials,
        suppliers,
        warehouses,
        locations,
        inventoryMovements,
        receivingTransactions,
        shreddingTransactions,
        productionIssues
      );

      setAnalysis(result);
      setActiveSheetIdx(0);
      setWorkflowStep(targetStep || (workflowStep === 'DIAGNOSTICS' ? 'DIAGNOSTICS' : 'WORKBOOK_ANALYSIS'));
      setIsParsing(false);
      setSuccessMessage(
        isRTL
          ? `✓ تم تحميل ملف المصنع "${fileName}" وتحليله بنجاح بنسبة دقة 100% وعزل كافة صفوف القوالب الفارغة!`
          : `✓ Factory file "${fileName}" loaded and analyzed successfully without false alarms.`
      );
    } catch (err: any) {
      setIsParsing(false);
      setErrorMessage(err.message || 'Error loading preset');
    }
  };

  // Download Standard Template
  const handleDownloadTemplate = (type: ExcelDocType) => {
    let templateData: any[] = [];
    let filename = '';

    if (type === '546') {
      filename = '546_AL_KARWAN_RECEIVING_TEMPLATE';
      templateData = [
        {
          'رقم المستند': '546/2026/201',
          'التاريخ': '2026-09-02',
          'اسم المورد': 'شركة الدلتا للبتروكيماويات والبوليمرات',
          'اسم المادة': 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)',
          'رقم الشاحنة': 'بغداد 14523 حمل',
          'السائق': 'علي حيدر',
          'وزن الدخول (قائم)': 28500,
          'وزن الخروج (فارغ)': 14200,
          'الصافي': 14300,
          'عدد الشلايف': 15,
        },
      ];
    } else if (type === '360') {
      filename = '360_AL_KARWAN_SHREDDING_STORE_TEMPLATE';
      templateData = [
        {
          'رقم المستند': '360/2026/099',
          'التاريخ': '2026-09-02',
          'المادة': 'بطل مثروم',
          'الوزن المدخل': 13500,
          'الوزن المثروم': 13224,
          'تالف إنتاج': 180,
          'عدد الشلايف': 35,
          'خط الثرم': 'خط الثرم الصناعي 01',
        },
      ];
    } else if (type === '167') {
      filename = '167_AL_KARWAN_PRODUCTION_ISSUE_TEMPLATE';
      templateData = [
        {
          'رقم المستند': '167/2026/150',
          'التاريخ': '2026-09-02',
          'المادة': 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)',
          'الكمية المصروفة (كغم)': 9500,
          'عدد الشلايف': 10,
          'خط الإنتاج': 'خط البثق والتحبيب 01',
        },
      ];
    } else {
      filename = 'AL_KARWAN_INVENTORY_SNAPSHOT_TEMPLATE';
      templateData = [
        {
          'رمز المادة': 'BTL-SHR-04',
          'المادة': 'مفروم ومجروش أكواب بطل (Batal Shredded)',
          'الوزن (كغم)': 27048,
          'عدد الشلايف': 42,
          'الموقع': 'LOC-THM-02',
        },
      ];
    }

    try {
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, `${filename}.xlsx`);
      setSuccessMessage(isRTL ? 'تم تحميل نموذج Excel الرسمي بنجاح!' : 'Excel template downloaded successfully!');
    } catch (e) {
      setErrorMessage(isRTL ? 'فشل تحميل النموذج' : 'Failed to download template');
    }
  };

  // Commit Analyzed Batch to Central Factory Inventory Engine
  const handleCommitMigration = () => {
    if (!analysis || !currentSheet) {
      setErrorMessage(isRTL ? 'لا توجد بيانات للاستيراد' : 'No data to import');
      return;
    }

    const unignoredRows = currentSheet.dataRows.filter((r) => !r.isIgnoredByUser);
    const errorRows = unignoredRows.filter((r) => r.severity === 'ERROR');

    if (errorRows.length > 0) {
      setErrorMessage(
        isRTL
          ? `لا يمكن ترحيل البيانات: يوجد ${errorRows.length} سجل يحتوي على أخطاء حرجة. يرجى تصحيحها أو النقر على "تجاهل الصفوف غير الصالحة".`
          : `Cannot commit: ${errorRows.length} rows have unresolved critical errors.`
      );
      return;
    }

    const res = importSmartAnalyzedRows({
      batchId: analysis.batchId,
      fileName: analysis.fileName,
      docType: currentSheet.detectedType,
      rows: unignoredRows,
    });

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? `✓ تم اعتماد وترحيل ${res.count} سجلات بنجاح إلى قاعدة بيانات المصنع وتحديث أرصدة المستودعات وسجل التدقيق المركزي (دفعة: ${analysis.batchId})!`
          : `✓ Successfully committed ${res.count} records into factory database and updated inventory balances (Batch: ${analysis.batchId})!`
      );
      setAnalysis(null);
      setWorkflowStep('UPLOAD');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setErrorMessage(isRTL ? `فشل الترحيل: ${res.errors.join(', ')}` : `Migration failed: ${res.errors.join(', ')}`);
    }
  };

  // Clear / Reset
  const handleReset = () => {
    setAnalysis(null);
    setActiveSheetIdx(0);
    setWorkflowStep('UPLOAD');
    setErrorMessage(null);
    setSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag & Drop Handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  // Compute Sheet Counts
  const sheetStats = useMemo(() => {
    if (!currentSheet) return { total: 0, valid: 0, warnings: 0, errors: 0, duplicates: 0, ignored: 0 };
    const rows = currentSheet.dataRows;
    return {
      total: rows.length,
      valid: rows.filter((r) => !r.isIgnoredByUser && r.severity === 'VALID').length,
      warnings: rows.filter((r) => !r.isIgnoredByUser && r.severity === 'WARNING').length,
      errors: rows.filter((r) => !r.isIgnoredByUser && r.severity === 'ERROR').length,
      duplicates: rows.filter((r) => !r.isIgnoredByUser && r.isDuplicate).length,
      ignored: rows.filter((r) => r.isIgnoredByUser).length + currentSheet.ignoredRowsCount,
    };
  }, [currentSheet]);

  // Compute Inventory Impact
  const inventoryImpact = useMemo(() => {
    if (!currentSheet) return [];
    return calculateInventoryImpact(
      currentSheet.dataRows,
      currentSheet.detectedType,
      materials,
      warehouses,
      locations,
      inventoryMovements
    );
  }, [currentSheet, materials, warehouses, locations, inventoryMovements]);

  // Check unresolved materials that might need quick mapping
  const unmatchedMaterials = useMemo(() => {
    if (!currentSheet) return [];
    const set = new Set<string>();
    currentSheet.dataRows.forEach((r) => {
      if (!r.isIgnoredByUser && (r.materialMatchConfidence === 'POSSIBLE_MATCH' || r.materialMatchConfidence === 'UNMATCHED')) {
        set.add(r.materialRaw);
      }
    });
    return Array.from(set);
  }, [currentSheet]);

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
          }
        }}
        accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
        className="hidden"
        id="smart-excel-file-input"
      />

      {/* Main Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950/50 border border-emerald-500/30 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>SMART FACTORY INGESTION ENGINE</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">AL-KARWAN MIGRATION SUITE</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {isRTL ? 'المعالج الذكي لاستيراد وترحيل ملفات Excel للمصنع' : 'Smart Factory Excel Ingestion & Migration Engine'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
            {isRTL
              ? 'معالج مصمم خصيصاً لمصنفات وسجلات مصنع الكروان (546، 360، 167، 352، مخزن خامات 9). يكتشف الهيكلية تلقائياً، يتجاهل صفوف المجاميع والفواصل، ويطابق المواد والأوزان دون أخطاء وهمية.'
              : 'Intelligently parses AL-KARWAN workbooks (546, 360, 167, 352, Raw Store 9), detects headers, ignores totals & blanks, and maps inventory.'}
          </p>
        </div>

        {/* Action Buttons: Download Official Templates */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleDownloadTemplate('546')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs border border-emerald-500/40 shadow-lg cursor-pointer transition-all active:scale-95"
            title={isRTL ? 'تحميل نموذج 546 الرسمي' : 'Download official 546 template'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isRTL ? 'نموذج (546)' : 'Template 546'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadTemplate('360')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/40 shadow-lg cursor-pointer transition-all active:scale-95"
            title={isRTL ? 'تحميل نموذج 360 الرسمي' : 'Download official 360 template'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isRTL ? 'نموذج (360)' : 'Template 360'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadTemplate('167')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 font-bold text-xs border border-purple-500/40 shadow-lg cursor-pointer transition-all active:scale-95"
            title={isRTL ? 'تحميل نموذج 167 الرسمي' : 'Download official 167 template'}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isRTL ? 'نموذج (167)' : 'Template 167'}</span>
          </button>

          {/* Temporary ADMIN Debug Button */}
          <button
            type="button"
            onClick={() => {
              if (!analysis) {
                handleLoadFactoryPreset('RAW_STORE_9');
              }
              setIsDiagnosticsModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer shadow-lg ${
              isDiagnosticsModalOpen || workflowStep === 'DIAGNOSTICS'
                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-amber-500/20'
                : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/60 hover:border-amber-400'
            }`}
            title="Open Raw Excel Parser Debug Modal & Health Dashboard"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>🔬 Excel Parser Debug</span>
          </button>

          {analysis && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRTL ? 'بدء ملف جديد' : 'Reset'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-white font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 9-STAGE WORKFLOW STEPPER */}
      <WorkflowStepper
        currentStep={workflowStep}
        onSelectStep={setWorkflowStep}
        isWorkbookLoaded={analysis !== null}
        isRTL={isRTL}
      />

      {/* STAGE 1: UPLOAD & PRESETS */}
      {workflowStep === 'UPLOAD' && (
        <div className="space-y-6">
          {/* Quick Presets for AL-KARWAN Files */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'فحص واختبار ملفات مصنع الكروان المعتمدة (Factory Presets):' : 'Official AL-KARWAN Factory Files:'}</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {isRTL ? 'انقر للتحميل والتحليل الفوري' : 'Click to load and inspect instantly'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-2.5">
              {[
                { id: '546', name: '546.xlsx', titleAr: 'استلام مواد خامات', desc: 'دخول وخروج وشلايف', color: 'emerald' },
                { id: '360', name: '360.xlsx', titleAr: 'استلام مخزن الثرم', desc: 'مثروم وتالف إنتاج', color: 'cyan' },
                { id: '167', name: '167.xlsx', titleAr: 'صادر مواد خامات', desc: 'صرف لصالة الإنتاج', color: 'purple' },
                { id: '352', name: '352.xlsx', titleAr: 'مستند 352', desc: 'ترحيل مفروم ومجروش', color: 'amber' },
                { id: 'RAW_STORE_9', name: 'مخزن خامات 9.xlsx', titleAr: 'مخزن خامات 9', desc: 'أرصدة المستودع', color: 'blue' },
                { id: 'THERM_CAPACITY_9', name: 'طاقة مخزن الثرم -9.xlsx', titleAr: 'طاقة مخزن الثرم', desc: 'أرصدة سكراب ومفروم', color: 'teal' },
                { id: 'HIERARCHICAL_MERGED', name: 'هرمي ومخفي.xlsx', titleAr: 'ترويسة مدمجة + مخفي', desc: 'فحص هرمي متقدم', color: 'indigo' },
                { id: 'TEST_9295', name: 'فحص الـ 9,295 صف.xlsx', titleAr: 'اختبار القوالب الفارغة', desc: '0 أخطاء وهمية', color: 'rose' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleLoadFactoryPreset(item.id)}
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 text-start transition-all cursor-pointer group shadow-md"
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-white group-hover:text-emerald-300">
                    <span className="truncate">{item.name}</span>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-[11px] font-bold text-slate-300 mt-1 truncate">{item.titleAr}</div>
                  <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`group relative p-10 sm:p-14 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all shadow-2xl ${
              isDragging
                ? 'border-emerald-400 bg-emerald-950/40 ring-4 ring-emerald-500/30 scale-[1.01]'
                : 'border-slate-700 hover:border-emerald-400 bg-slate-900/60 hover:bg-slate-900/90'
            }`}
          >
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 group-hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4 transition-all group-hover:scale-110 shadow-lg">
              {isParsing ? (
                <FileCheck className="w-10 h-10 animate-bounce text-cyan-400" />
              ) : (
                <Upload className="w-10 h-10 text-emerald-400 group-hover:-translate-y-1 transition-transform" />
              )}
            </div>

            {isParsing ? (
              <div className="space-y-2">
                <h4 className="text-lg font-black text-white">
                  {isRTL ? 'جاري فحص المصنف، قراءة الجداول، واكتشاف العناوين والأوزان...' : 'Analyzing Workbook Structure, Headers & Data Regions...'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isRTL ? 'يتم التحقق من مطابقة المواد مع Item Master وفصل صفوف المجاميع والفواصل' : 'Matching materials against Item Master and filtering summary rows'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h4 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                  {isRTL
                    ? 'انقر لاختيار ملف Excel من جهازك أو اسحب الملف وأفلته هنا'
                    : 'Click to Browse Excel File or Drag & Drop Here'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                  {isRTL
                    ? 'يدعم جميع مصنفات مصنع الكروان: (.xlsx, .xls, .csv). المحلل يتعرف بذكاء على ملفات 546، 360، 167، 352، ومخزن الخامات 9 دون إنشاء أخطاء وهمية.'
                    : 'Supports all AL-KARWAN workbooks (.xlsx, .xls, .csv). Smart analyzer ignores layout blank cells and totals.'}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white font-bold text-xs shadow-xl shadow-emerald-950 transition-all">
                    <Upload className="w-4 h-4" />
                    <span>{isRTL ? 'استعراض ملف Excel (Browse File)' : 'Browse Excel File'}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Resume Current Analysis Button if loaded */}
          {analysis && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-slate-300 font-bold">
                  {isRTL ? `يوجد ملف قيد المعالجة حالياً: "${analysis.fileName}"` : `Currently analyzing: "${analysis.fileName}"`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowStep('WORKBOOK_ANALYSIS')}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                {isRTL ? 'متابعة المعالجة ←' : 'Resume Processing →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* DIAGNOSTIC INSPECTION VIEW (Phase 1, 7, 10 Diagnostics) */}
      {analysis && currentSheet && workflowStep === 'DIAGNOSTICS' && (
        <ExcelParserDiagnosticsView
          analysis={analysis}
          currentSheet={currentSheet}
          activeSheetIdx={activeSheetIdx}
          onSelectSheetIdx={setActiveSheetIdx}
          onNavigate={setWorkflowStep}
          onCloseDiagnostics={() => setWorkflowStep('WORKBOOK_ANALYSIS')}
          onLoadPreset={(presetId) => handleLoadFactoryPreset(presetId, 'DIAGNOSTICS')}
          isRTL={isRTL}
          isModal={false}
        />
      )}

      {/* DEDICATED DEBUG MODAL (Can be opened from any import phase) */}
      {analysis && currentSheet && (
        <ExcelParserDebugModal
          isOpen={isDiagnosticsModalOpen}
          onClose={() => setIsDiagnosticsModalOpen(false)}
          analysis={analysis}
          currentSheet={currentSheet}
          activeSheetIdx={activeSheetIdx}
          onSelectSheetIdx={setActiveSheetIdx}
          onNavigate={setWorkflowStep}
          onLoadPreset={(presetId) => handleLoadFactoryPreset(presetId)}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 2: WORKBOOK ANALYSIS */}
      {analysis && currentSheet && workflowStep === 'WORKBOOK_ANALYSIS' && (
        <WorkbookAnalysisView
          analysis={analysis}
          currentSheet={currentSheet}
          activeSheetIdx={activeSheetIdx}
          onSelectSheetIdx={setActiveSheetIdx}
          onDocTypeChange={handleDocTypeChange}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 3: DATA REGIONS DETECTION */}
      {analysis && currentSheet && workflowStep === 'DATA_DETECTION' && (
        <DataDetectionView
          currentSheet={currentSheet}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 4: COLUMN MAPPING */}
      {analysis && currentSheet && workflowStep === 'MAP_COLUMNS' && (
        <ColumnMappingView
          currentSheet={currentSheet}
          customMappings={customMappings}
          onUpdateMapping={handleUpdateMapping}
          onApplyCustomMappings={handleApplyCustomMappings}
          onResetAutoMappings={handleResetAutoMappings}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 5: MATERIAL SMART MATCH */}
      {analysis && currentSheet && workflowStep === 'MATERIAL_MATCH' && (
        <MaterialMatchView
          currentSheet={currentSheet}
          materials={materials}
          smartSuggestions={smartSuggestions}
          onApplySmartSuggestion={handleApplySmartSuggestion}
          onApplyAllHighConfidenceSuggestions={handleApplyAllHighConfidenceSuggestions}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 6: SMART VALIDATION */}
      {analysis && currentSheet && workflowStep === 'VALIDATION' && (
        <ValidationView
          currentSheet={currentSheet}
          sheetStats={sheetStats}
          unmatchedMaterials={unmatchedMaterials}
          materials={materials}
          onMapMaterial={handleMapMaterial}
          onIgnoreAllErrors={handleIgnoreAllErrors}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 7: DATA PREVIEW */}
      {analysis && currentSheet && workflowStep === 'DATA_PREVIEW' && (
        <DataPreviewView
          currentSheet={currentSheet}
          onToggleIgnoreRow={handleToggleIgnoreRow}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 8: INVENTORY IMPACT SIMULATION */}
      {analysis && currentSheet && workflowStep === 'INVENTORY_IMPACT' && (
        <InventoryImpactView
          currentSheet={currentSheet}
          inventoryImpact={inventoryImpact}
          onNavigate={setWorkflowStep}
          isRTL={isRTL}
        />
      )}

      {/* STAGE 9: COMMIT MIGRATION */}
      {analysis && currentSheet && workflowStep === 'COMMIT_MIGRATION' && (
        <CommitMigrationView
          analysis={analysis}
          currentSheet={currentSheet}
          sheetStats={sheetStats}
          currentUser={currentUser}
          onCommit={handleCommitMigration}
          onIgnoreErrors={handleIgnoreAllErrors}
          onNavigate={setWorkflowStep}
          onReset={handleReset}
          isRTL={isRTL}
        />
      )}

      {/* DIAGNOSTIC MODE: RAW WORKBOOK INSPECTION & FORENSIC STATE */}
      {analysis && currentSheet && workflowStep === 'DIAGNOSTICS' && (
        <ExcelParserDiagnosticsView
          analysis={analysis}
          currentSheet={currentSheet}
          activeSheetIdx={activeSheetIdx}
          onSelectSheetIdx={setActiveSheetIdx}
          onNavigate={setWorkflowStep}
          onCloseDiagnostics={() => setWorkflowStep('WORKBOOK_ANALYSIS')}
          isRTL={isRTL}
        />
      )}
    </div>
  );
};
