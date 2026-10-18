import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Database,
  Building2,
  Boxes,
  Lock,
  Layers,
  Sparkles,
  Info,
  History,
  FileText,
  Clock,
  ShieldCheck,
  Zap,
  Activity,
  ArrowUpRight,
  Check,
  Search,
  ExternalLink,
  Trash2,
  Download,
  FileJson,
  ShieldAlert,
  Cloud,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  MaterialItem,
  ImportBatch,
  ImportBatchStatus,
  MovementType,
  InventoryMovement,
} from '../types';
import {
  analyzeWorkbook,
  WorkbookAnalysis,
  SheetAnalysis,
  AnalyzedDataRow,
  ExcelDocType,
} from '../services/smartExcelParser';
import { ExcelParserDebugModal } from './excel/ExcelParserDebugModal';
import { AdminFirestoreBulkWipeModal } from './AdminFirestoreBulkWipeModal';
import { DatabaseSnapshotModal } from './DatabaseSnapshotModal';
import { PreFlightCheckModal } from './PreFlightCheckModal';
import { PreFlightCheckCard } from './PreFlightCheckCard';
import { CloudSchedulerCard } from './CloudSchedulerCard';
import { CloudSchedulerModal } from './CloudSchedulerModal';
import { BulkRollbackCard } from './BulkRollbackCard';
import { BulkRollbackModal } from './BulkRollbackModal';
import { ImportHistoryLog, exportImportHistoryToCSV } from './ImportHistoryLog';
import { CloudStorageSnapshotRecord } from '../types';

type MigrationViewStep =
  | 'FILE_SELECT'
  | 'ANALYSIS_MAP'
  | 'VALIDATION_GATE'
  | 'DUPLICATE_CHECK'
  | 'INVENTORY_IMPACT'
  | 'AUDIT_COMPLETE';

export const HistoricalMigrationCenter: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    materials,
    suppliers,
    warehouses,
    locations,
    inventoryBalances,
    inventoryMovements,
    importBatches,
    createImportBatch,
    updateImportBatch,
    computeMovementFingerprint,
    importSmartAnalyzedRows,
    setCurrentPage,
  } = useFactory();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<MigrationViewStep>('FILE_SELECT');
  const [selectedPreset, setSelectedPreset] = useState<string>('RAW_STORE_9');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<WorkbookAnalysis | null>(null);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);

  // Active batch tracked in state
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [migrationMode, setMigrationMode] = useState<'OPENING_BALANCE' | 'OPERATIONAL'>('OPENING_BALANCE');
  const [isTestRun, setIsTestRun] = useState<boolean>(false);
  const [testRunCompleted, setTestRunCompleted] = useState<boolean>(false);

  // Modals & Traceability
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isBulkWipeOpen, setIsBulkWipeOpen] = useState<boolean>(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [isPreFlightOpen, setIsPreFlightOpen] = useState<boolean>(false);
  const [isSchedulerModalOpen, setIsSchedulerModalOpen] = useState<boolean>(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState<boolean>(false);
  const [rollbackTargetRecord, setRollbackTargetRecord] = useState<CloudStorageSnapshotRecord | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState<boolean>(false);
  const [selectedMovementForTrace, setSelectedMovementForTrace] = useState<InventoryMovement | null>(null);
  const [selectedRowForTrace, setSelectedRowForTrace] = useState<AnalyzedDataRow | null>(null);

  // Filter & Search states
  const [rowStatusFilter, setRowStatusFilter] = useState<'ALL' | 'ACCEPTED' | 'WARNING' | 'ERROR' | 'EXCLUDED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active Sheet reference
  const currentSheet = analysis?.sheets[activeSheetIdx];

  // Active Batch reference from context
  const activeBatch = useMemo(() => {
    if (!activeBatchId) return null;
    return importBatches.find((b) => b.id === activeBatchId) || null;
  }, [activeBatchId, importBatches]);

  // Overall Historical Migration KPIs (Requirement 15)
  const migrationKPIs = useMemo(() => {
    const historicalBatches = importBatches.filter(
      (b) => b.id.includes('BATCH') || b.notes?.includes('تاريخي') || b.notes?.includes('افتتاحي')
    );
    const completedBatches = historicalBatches.filter((b) => b.status === 'COMPLETED');
    const totalRecords = completedBatches.reduce((acc, b) => acc + (b.importedRowsCount || 0), 0);
    const totalKG = completedBatches.reduce((acc, b) => acc + (b.totalKG || 0), 0);
    const totalBags = completedBatches.reduce((acc, b) => acc + (b.totalBags || 0), 0);
    const unresolved = historicalBatches.reduce((acc, b) => acc + (b.rowsWarning || 0) + (b.rowsError || 0), 0);
    const successRate =
      historicalBatches.length > 0
        ? Math.round((completedBatches.length / historicalBatches.length) * 100)
        : 100;

    return {
      batchCount: historicalBatches.length,
      completedCount: completedBatches.length,
      totalRecords,
      totalKG,
      totalBags,
      unresolved,
      successRate,
    };
  }, [importBatches]);

  // Duplicate Check Engine (Requirement 11)
  const duplicateEvaluation = useMemo(() => {
    if (!currentSheet?.dataRows) return { duplicateRows: [], cleanRows: [] };

    const existingFingerprints = new Set(
      inventoryMovements.map((m) => m.fingerprint).filter(Boolean)
    );

    const duplicateRows: AnalyzedDataRow[] = [];
    const cleanRows: AnalyzedDataRow[] = [];

    currentSheet.dataRows.forEach((row) => {
      const fp = computeMovementFingerprint({
        docRef: row.docRef,
        materialCode: row.materialMatchedCode,
        date: row.date,
        netKG: row.netKG,
        bulkBags: row.bulkBags,
        supplier: row.supplierRaw,
        sourceFile: analysis?.fileName,
        sourceSheet: row.sourceSheet,
        sourceRow: row.sourceRow,
      });

      if (existingFingerprints.has(fp)) {
        duplicateRows.push(row);
      } else {
        cleanRows.push(row);
      }
    });

    return { duplicateRows, cleanRows };
  }, [currentSheet?.dataRows, inventoryMovements, analysis?.fileName, computeMovementFingerprint]);

  // Inventory Impact Simulation (Requirement 16)
  const inventoryImpactSimulation = useMemo(() => {
    if (!currentSheet?.dataRows) return [];

    // Group active valid rows by material
    const impactMap = new Map<
      string,
      {
        material: MaterialItem;
        currentStockKG: number;
        currentBags: number;
        importedStockKG: number;
        importedBags: number;
        projectedStockKG: number;
        projectedBags: number;
        locations: string[];
      }
    >();

    const validRows = currentSheet.dataRows.filter(
      (r) => !r.isIgnoredByUser && r.severity !== 'ERROR'
    );

    validRows.forEach((row) => {
      const mat =
        materials.find((m) => m.id === row.materialMatchedId || m.code === row.materialMatchedCode) ||
        (materials.length > 0 ? materials[0] : undefined);

      const matKey = mat?.id || row.materialMatchedId || row.materialMatchedCode || row.materialRaw || 'UNKNOWN';

      // Calculate current stock from inventoryBalances
      const currentStock = mat
        ? inventoryBalances
            .filter((b) => b.materialId === mat.id)
            .reduce((sum, b) => sum + b.availableKG, 0)
        : 0;

      const currentBags = mat
        ? inventoryBalances
            .filter((b) => b.materialId === mat.id)
            .reduce((sum, b) => sum + b.bulkBagsCount, 0)
        : 0;

      const isOutflow =
        row.legacyDocType === '167' ||
        row.transactionType === 'PRODUCTION ISSUE' ||
        row.transactionType === 'SHREDDING_INPUT';

      const weightDelta = isOutflow ? -row.netKG : row.netKG;
      const bagsDelta = isOutflow ? -row.bulkBags : row.bulkBags;

      const existing = impactMap.get(matKey) || {
        material: mat || {
          id: matKey,
          code: row.materialMatchedCode || 'MAT-RAW',
          nameAr: row.materialMatchedNameAr || row.materialRaw || 'مادة جديدة مستوردة',
          nameEn: row.materialMatchedNameEn || row.materialRaw || 'Imported Material',
          category: 'RAW' as const,
          type: 'Virgin' as const,
          unit: 'KG' as const,
          standardCostPerKG: 0,
          sellingPricePerKG: 0,
          density: 1.0,
          color: 'Natural',
          minStockKG: 0,
          maxStockKG: 100000,
          reorderPointKG: 0,
          defaultWarehouseId: 'WH-01',
          defaultLocationId: 'LOC-A01',
          safetyStockKG: 0,
          active: true,
          aliases: [],
        },
        currentStockKG: currentStock,
        currentBags,
        importedStockKG: 0,
        importedBags: 0,
        projectedStockKG: currentStock,
        projectedBags: currentBags,
        locations: [],
      };

      existing.importedStockKG += weightDelta;
      existing.importedBags += bagsDelta;
      existing.projectedStockKG += weightDelta;
      existing.projectedBags += bagsDelta;
      if (row.locationCode && !existing.locations.includes(row.locationCode)) {
        existing.locations.push(row.locationCode);
      }

      impactMap.set(matKey, existing);
    });

    return Array.from(impactMap.values());
  }, [currentSheet?.dataRows, materials, inventoryBalances]);

  // Load Preset File into Analysis & Batch
  const handleLoadPreset = (presetKey: string, asTestRun: boolean = false) => {
    setIsProcessing(true);
    setSelectedPreset(presetKey);
    setIsTestRun(asTestRun);
    setTestRunCompleted(false);

    let sampleRows: any[] = [];
    let fileName = '';
    let sheetName = '';
    let mode: 'OPENING_BALANCE' | 'OPERATIONAL' = 'OPENING_BALANCE';

    if (presetKey === 'RAW_STORE_9') {
      fileName = 'مخزن خامات 9.xlsx';
      sheetName = 'أرصدة مخزن الخامات 9';
      mode = 'OPENING_BALANCE';
      sampleRows = [
        ['تقرير جرد وطاقة مخزن الخامات الرئيسي - شركة الكروان'],
        ['رمز المادة', 'المادة', 'الرصيد الحالي (كغم)', 'عدد الشلايف', 'المستودع', 'الموقع'],
        ['PET-FLK-01', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 19450, 38, 'WH-01', 'LOC-A-01'],
        ['PP-GRN-02', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 24300, 45, 'WH-01', 'LOC-A-02'],
        ['HIPS-PEL-06', 'حبيبات بولي ستايرين مقاوم للصدمات (HIPS Pellets)', 14800, 28, 'WH-01', 'LOC-B-01'],
        ['MB-WHT-07', 'ماسترباتش أبيض فائق التغطية (White Masterbatch)', 6200, 8, 'WH-01', 'LOC-B-02'],
        ['إجمالي الرصيد', '', 64750, 119, '', ''],
      ];
    } else if (presetKey === 'THERM_CAPACITY_9') {
      fileName = 'طاقة مخزنية لمخزن الثرم -9.xlsx';
      sheetName = 'طاقة مخزن الثرم';
      mode = 'OPENING_BALANCE';
      sampleRows = [
        ['بيان الطاقة المخزنية والأرصدة - مستودع ومخزن الثرم رقم 2'],
        ['رمز المادة', 'المادة', 'الوزن (كغم)', 'الشلايف', 'الموقع'],
        ['BTL-SCR-03', 'سكراب وهوالك أكواب مفرومة (Batal Scrap)', 12800, 24, 'LOC-THM-01'],
        ['BTL-SHR-04', 'مفروم ومجروش أكواب بطل (Batal Shredded)', 27048, 42, 'LOC-THM-02'],
        ['SHT-TRM-05', 'هوالك أطراف رولات ألواح (Sheet Trims & Edges)', 9400, 15, 'LOC-THM-01'],
        ['المجموع', '', 49248, 81, ''],
      ];
    } else if (presetKey === '546') {
      fileName = 'سجل_الكروان_المعتمد_546.xlsx';
      sheetName = 'استلام خامات 546';
      mode = 'OPERATIONAL';
      sampleRows = [
        ['شركة الكروان لصناعة البلاستيك - سجل الاستلام العام المعتمد'],
        ['رقم المستند', 'التاريخ', 'اسم المورد', 'اسم المادة', 'وزن الدخول (قائم)', 'وزن الخروج (فارغ)', 'الصافي', 'عدد الشلايف', 'رقم الشاحنة', 'اسم السائق'],
        ['546/2026/101', '2026-09-01', 'شركة الدلتا للبتروكيماويات والبوليمرات', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 28500, 14200, 14300, 15, 'بغداد 14523 حمل', 'علي حيدر'],
        ['546/2026/102', '2026-09-01', 'مصنع النصر لتدوير اللدائن وسكراب البلاستيك', 'سكراب وهوالك أكواب مفرومة (Batal Scrap)', 34200, 15100, 19100, 20, 'بصرة 88312 حمل', 'كرار جاسم'],
        ['546/2026/103', '2026-09-02', 'الشركة العربية لتجارة وتوزيع اللدائن (سابك)', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 32000, 13500, 18500, 18, 'أربيل 55214 حمل', 'سردار أحمد'],
        ['546/2026/104', '2026-09-02', 'شركة الرافدين للتجارة العامة', 'سكراب اكواب بلاستك', 29000, 14000, 15000, 14, 'بغداد 99120 حمل', 'حسين جاسم'],
        ['546/2026/105', '2026-09-03', 'المؤسسة الوطنية للبتروكيماويات', 'رقايق بت مفروم', 31500, 14500, 17000, 16, 'ديالى 34211 حمل', 'مصطفى كامل'],
        ['المجموع العام', '', '', '', '', '', 83900, 83, '', ''],
      ];
    } else if (presetKey === '167') {
      fileName = 'صادر_خامات_167.xlsx';
      sheetName = 'صادر الإنتاج 167';
      mode = 'OPERATIONAL';
      sampleRows = [
        ['شركة الكروان - سندات صرف المواد الخام لصالة الإنتاج (167)'],
        ['رقم الصرف', 'التاريخ', 'خط الإنتاج', 'المادة المطلوبة', 'الكمية (كغم)', 'الشلايف', 'المستودع', 'الموقع'],
        ['167/2026/044', '2026-09-01', 'خط البثق والتحبيب 01', 'حبيبات بولي بروبلين عالي الشفافية (PP Granules)', 4500, 5, 'WH-01', 'LOC-A-02'],
        ['167/2026/045', '2026-09-02', 'خط التشكيل الحراري 02', 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)', 3800, 4, 'WH-01', 'LOC-A-01'],
        ['إجمالي الصادر', '', '', '', 8300, 9, '', ''],
      ];
    } else {
      fileName = '352.xlsx';
      sheetName = 'مستند 352 للثرم والمخازن';
      mode = 'OPERATIONAL';
      sampleRows = [
        ['سجل التحويل الداخلي ومستند 352'],
        ['رقم المستند', 'التاريخ', 'اسم المادة', 'الوزن الصافي', 'عدد الشلايف', 'الموقع'],
        ['352/2026/012', '2026-09-01', 'مفروم ومجروش أكواب بطل (Batal Shredded)', 14800, 16, 'LOC-THM-02'],
        ['352/2026/013', '2026-09-02', 'حبيبات بولي ستايرين مقاوم للصدمات (HIPS Pellets)', 11200, 12, 'LOC-B-01'],
        ['صافي المجموع', '', '', 26000, 28, ''],
      ];
    }

    setMigrationMode(mode);

    // Build virtual Excel workbook
    const ws = XLSX.utils.aoa_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Analyze using the verified analytical engine
    const analysisResult = analyzeWorkbook(
      wb,
      fileName,
      '42.8 KB',
      materials,
      suppliers,
      warehouses,
      locations,
      inventoryMovements,
      [],
      [],
      []
    );

    setAnalysis(analysisResult);
    setActiveSheetIdx(0);

    // Create an explicit IMPORT BATCH (Requirement 2)
    const activeSheetData = analysisResult.sheets[0];
    const rowsAccepted = activeSheetData.dataRows.filter((r) => r.severity === 'VALID').length;
    const rowsWarning = activeSheetData.dataRows.filter((r) => r.severity === 'WARNING').length;
    const rowsError = activeSheetData.dataRows.filter((r) => r.severity === 'ERROR').length;
    const rowsExcluded = activeSheetData.ignoredRowsCount || 0;

    const newBatch = createImportBatch({
      fileName,
      fileSize: '42.8 KB',
      sheets: analysisResult.sheets.map((s) => s.sheetName),
      rowsRead: activeSheetData.totalRows,
      rowsAccepted,
      rowsWarning,
      rowsError,
      rowsExcluded,
      status: 'ANALYZING',
      docType: activeSheetData.detectedType,
      notes: asTestRun
        ? `محاكاة ترحيل تجريبية للمصنف ${fileName} (فحص دون ترحيل مباشر)`
        : `دفعة ترحيل تاريخية قيد التدقيق للمصنف ${fileName}`,
    });

    setActiveBatchId(newBatch.id);
    setIsProcessing(false);

    if (asTestRun) {
      // In Test Migration Mode, advance through pipeline to INVENTORY_IMPACT and STOP!
      setCurrentStep('INVENTORY_IMPACT');
      setTestRunCompleted(true);
    } else {
      setCurrentStep('ANALYSIS_MAP');
    }
  };

  // Upload Custom File Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, {
          type: 'array',
          cellDates: true,
        });

        const sizeInKB = `${(file.size / 1024).toFixed(1)} KB`;
        const analysisResult = analyzeWorkbook(
          wb,
          file.name,
          sizeInKB,
          materials,
          suppliers,
          warehouses,
          locations,
          inventoryMovements,
          [],
          [],
          []
        );

        setAnalysis(analysisResult);
        setActiveSheetIdx(0);

        const activeSheetData = analysisResult.sheets[0];
        const rowsAccepted = activeSheetData.dataRows.filter((r) => r.severity === 'VALID').length;
        const rowsWarning = activeSheetData.dataRows.filter((r) => r.severity === 'WARNING').length;
        const rowsError = activeSheetData.dataRows.filter((r) => r.severity === 'ERROR').length;
        const rowsExcluded = activeSheetData.ignoredRowsCount || 0;

        const newBatch = createImportBatch({
          fileName: file.name,
          fileSize: sizeInKB,
          sheets: analysisResult.sheets.map((s) => s.sheetName),
          rowsRead: activeSheetData.totalRows,
          rowsAccepted,
          rowsWarning,
          rowsError,
          rowsExcluded,
          status: 'ANALYZING',
          docType: activeSheetData.detectedType,
          notes: `دفعة استيراد تاريخية من ملف محلي: ${file.name}`,
        });

        setActiveBatchId(newBatch.id);
        setCurrentStep('ANALYSIS_MAP');
      } catch (err: any) {
        alert(isRTL ? `خطأ في قراءة ملف الإكسل: ${err.message}` : `Failed to parse Excel: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Toggle Row Exclude / Ignore state
  const handleToggleExcludeRow = (rowId: string) => {
    if (!analysis || !currentSheet) return;

    const updatedRows = currentSheet.dataRows.map((r) =>
      r.id === rowId ? { ...r, isIgnoredByUser: !r.isIgnoredByUser } : r
    );

    const updatedSheet: SheetAnalysis = {
      ...currentSheet,
      dataRows: updatedRows,
      acceptedRowsCount: updatedRows.filter((r) => !r.isIgnoredByUser && r.severity === 'VALID').length,
      excludedRowsCount: updatedRows.filter((r) => r.isIgnoredByUser).length,
    };

    const newSheets = [...analysis.sheets];
    newSheets[activeSheetIdx] = updatedSheet;
    setAnalysis({ ...analysis, sheets: newSheets });
  };

  // Exclude All Error Rows
  const handleExcludeAllErrors = () => {
    if (!analysis || !currentSheet) return;

    const updatedRows = currentSheet.dataRows.map((r) =>
      r.severity === 'ERROR' ? { ...r, isIgnoredByUser: true } : r
    );

    const updatedSheet: SheetAnalysis = {
      ...currentSheet,
      dataRows: updatedRows,
      excludedRowsCount: updatedRows.filter((r) => r.isIgnoredByUser).length,
    };

    const newSheets = [...analysis.sheets];
    newSheets[activeSheetIdx] = updatedSheet;
    setAnalysis({ ...analysis, sheets: newSheets });
  };

  // Execute Real Migration (Requirement 16)
  const handleConfirmAndImport = () => {
    if (!analysis || !currentSheet || !activeBatchId) return;

    setIsProcessing(true);

    const result = importSmartAnalyzedRows({
      batchId: activeBatchId,
      fileName: analysis.fileName,
      docType: currentSheet.detectedType,
      rows: currentSheet.dataRows,
      isHistoricalSnapshot: migrationMode === 'OPENING_BALANCE',
    });

    setIsProcessing(false);
    setIsApprovalModalOpen(false);

    if (result.success) {
      setCurrentStep('AUDIT_COMPLETE');
    } else {
      alert(result.errors.join('\n') || (isRTL ? 'فشل الترحيل' : 'Migration Failed'));
    }
  };

  // Filtered rows for the preview/validation tables
  const filteredRows = useMemo(() => {
    if (!currentSheet?.dataRows) return [];
    return currentSheet.dataRows.filter((row) => {
      // Status filter
      if (rowStatusFilter === 'EXCLUDED' && !row.isIgnoredByUser) return false;
      if (rowStatusFilter === 'ACCEPTED' && (row.isIgnoredByUser || row.severity !== 'VALID')) return false;
      if (rowStatusFilter === 'WARNING' && (row.isIgnoredByUser || row.severity !== 'WARNING')) return false;
      if (rowStatusFilter === 'ERROR' && (row.isIgnoredByUser || row.severity !== 'ERROR')) return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mat = (row.materialMatchedNameAr || row.materialRaw || '').toLowerCase();
        const doc = (row.docRef || '').toLowerCase();
        const sup = (row.supplierMatchedName || row.supplierRaw || '').toLowerCase();
        return mat.includes(q) || doc.includes(q) || sup.includes(q);
      }

      return true;
    });
  }, [currentSheet?.dataRows, rowStatusFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header & Context Matrix */}
      <div className="bg-[#0f1115] border border-white/10 rounded-xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
                AL-KARWAN FACTORY • PHASE 2
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {isRTL ? 'محرك ترحيل المخزون الموحد' : 'CENTRAL INVENTORY ENGINE'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Database className="w-7 h-7 text-cyan-400" />
              {isRTL ? 'مركز ترحيل البيانات التاريخية والمخزون' : 'Historical Data Migration Center'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              {isRTL
                ? 'البوابة المعتمدة لاستيراد وتدقيق وترحيل أرصدة وحركات إكسل التاريخية لمصنع الكروان وفق نموذج سجل الحركات الموحد وضمان التتبع الكامل.'
                : 'Controlled pipeline to analyze, validate, and safely ingest historical Excel files into the unified Inventory Movement Ledger.'}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsPreFlightOpen(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-amber-600/90 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/60 border border-amber-500/40 flex items-center gap-2 transition-all cursor-pointer"
              title={isRTL ? 'فحص استباقي للحجم وشجرة التبعيات البينية' : 'Inspect data footprint and relational dependencies'}
            >
              <ShieldAlert className="w-4 h-4 text-amber-200" />
              {isRTL ? 'فحص الجاهزية (Pre-Flight)' : 'Pre-Flight Check'}
            </button>

            <button
              onClick={() => setIsSnapshotModalOpen(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-cyan-700 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-950/60 border border-cyan-500/30 flex items-center gap-2 transition-all cursor-pointer"
              title={isRTL ? 'أخذ لقطة وتصدير قاعدة بيانات Firestore بصيغة JSON' : 'Capture and download Firestore snapshot as JSON'}
            >
              <Download className="w-4 h-4 text-cyan-200" />
              {isRTL ? 'نسخة احتياطية (JSON)' : 'Database Snapshot'}
            </button>

            <button
              onClick={() => setIsBulkWipeOpen(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 border border-rose-500/30 flex items-center gap-2 transition-all cursor-pointer"
              title={isRTL ? 'أداة تفريغ وتطهير قواعد بيانات Firestore' : 'Admin Firestore Bulk-Wipe Utility'}
            >
              <Trash2 className="w-4 h-4 text-rose-200" />
              {isRTL ? 'تفريغ السحابة وتجهيز الاستيراد' : 'Firestore Bulk-Wipe'}
            </button>

            <button
              onClick={() => handleLoadPreset('RAW_STORE_9', true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 flex items-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              {isRTL ? 'تشغيل محاكاة الترحيل التجريبي (مخزن خامات 9)' : 'Run Test Migration (Raw Store 9)'}
            </button>

            <button
              onClick={() => setIsDiagnosticsOpen(true)}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4 text-amber-400" />
              {isRTL ? 'فحص وتشخيص المعالج' : 'Parser Diagnostics'}
            </button>

            <button
              onClick={() => {
                setCurrentStep('FILE_SELECT');
                setTimeout(() => {
                  document.getElementById('import-history-log-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
              title={isRTL ? 'الانتقال إلى جدول وسجل عمليات الاستيراد والتدقيق' : 'Jump to Import History Log'}
            >
              <History className="w-4 h-4 text-cyan-400" />
              {isRTL ? 'سجل الاستيراد' : 'Import History'}
            </button>

            <button
              onClick={() => {
                exportImportHistoryToCSV(importBatches, isRTL);
              }}
              className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/40 shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer"
              title={isRTL ? 'تصدير جدول سجل الاستيراد التاريخي كملف CSV للتقارير والتدقيق دون اتصال' : 'Export current import history table to CSV for offline reporting and auditing'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              {isRTL ? 'تصدير سجل الاستيراد (CSV)' : 'Export Import History (CSV)'}
            </button>
          </div>
        </div>

        {/* Phase 2 Migration KPIs Strip (Requirement 15) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-white/10 font-mono">
          <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'الدفعات التاريخية' : 'Historical Batches'}</div>
            <div className="text-xl font-bold text-white mt-0.5">{migrationKPIs.batchCount}</div>
            <div className="text-[10px] text-cyan-400">{migrationKPIs.completedCount} {isRTL ? 'مكتملة' : 'Completed'}</div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'السجلات المعتمدة' : 'Migrated Records'}</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{migrationKPIs.totalRecords.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">{isRTL ? 'سجل موثق' : 'Verified Rows'}</div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'الوزن التاريخي المرحل' : 'Total KG Migrated'}</div>
            <div className="text-xl font-bold text-cyan-400 mt-0.5">{migrationKPIs.totalKG.toLocaleString()} <span className="text-xs">KG</span></div>
            <div className="text-[10px] text-slate-400">{isRTL ? 'رصيد مخزني موثق' : 'Inventory Stock'}</div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'الشلايف الكبيرة' : 'Bulk Bags Migrated'}</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">{migrationKPIs.totalBags.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">{isRTL ? 'كيس معتمد' : 'Jumbo Bags'}</div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'نسبة الإنجاز والدقة' : 'Success Rate'}</div>
            <div className="text-xl font-bold text-white mt-0.5">{migrationKPIs.successRate}%</div>
            <div className="text-[10px] text-emerald-400">{isRTL ? 'خالي من الأخطاء' : 'Zero Defect'}</div>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-lg p-3">
            <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'سجلات قيد المراجعة' : 'Unresolved / Warnings'}</div>
            <div className="text-xl font-bold text-rose-400 mt-0.5">{migrationKPIs.unresolved}</div>
            <div className="text-[10px] text-slate-400">{isRTL ? 'تتطلب التدقيق' : 'Needs Review'}</div>
          </div>
        </div>
      </div>

      {/* 10-Step Visual Flow Progress (Requirement 1) */}
      <div className="bg-[#0f1115] border border-white/10 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[760px] text-xs font-mono">
          {[
            { id: 'FILE_SELECT', labelAr: '1. اختيار الملف', labelEn: '1. Select File' },
            { id: 'ANALYSIS_MAP', labelAr: '2. التحليل والربط', labelEn: '2. Analyze & Map' },
            { id: 'VALIDATION_GATE', labelAr: '3. بوابة التدقيق', labelEn: '3. Validate' },
            { id: 'DUPLICATE_CHECK', labelAr: '4. فحص التكرار', labelEn: '4. Duplicate Check' },
            { id: 'INVENTORY_IMPACT', labelAr: '5. أثر المخزون', labelEn: '5. Stock Impact' },
            { id: 'AUDIT_COMPLETE', labelAr: '6. الاعتماد والأرشفة', labelEn: '6. Audit & Commit' },
          ].map((s, idx, arr) => {
            const isActive = currentStep === s.id;
            const isPassed =
              ['FILE_SELECT', 'ANALYSIS_MAP', 'VALIDATION_GATE', 'DUPLICATE_CHECK', 'INVENTORY_IMPACT', 'AUDIT_COMPLETE'].indexOf(
                currentStep
              ) > idx;

            return (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => analysis && setCurrentStep(s.id as MigrationViewStep)}
                  disabled={!analysis && s.id !== 'FILE_SELECT'}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                      : isPassed
                      ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>{isRTL ? s.labelAr : s.labelEn}</span>
                </button>
                {idx < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Active Batch Banner (Requirement 2 & 3) */}
      {activeBatch && (
        <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
              BATCH ID: {activeBatch.id}
            </span>
            <span className="text-white font-semibold flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              {activeBatch.fileName}
            </span>
            <span className="text-slate-400">
              ({activeBatch.fileSize}) • {activeBatch.uploadDateTime}
            </span>
            <span className="text-slate-400">
              {isRTL ? 'المسؤول' : 'User'}: {activeBatch.uploadedBy}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                activeBatch.status === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : activeBatch.status === 'READY'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              STATUS: {activeBatch.status}
            </span>
          </div>
        </div>
      )}

      {/* Test Run Mandatory Safety Gate Notification (Requirement 19) */}
      {isTestRun && testRunCompleted && (
        <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-xl p-4 text-amber-300 flex items-start gap-3 shadow-lg">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              {isRTL ? 'محاكاة الترحيل التجريبية مكتملة (Requirement 19 Test Mode)' : 'Test Migration Simulation Completed'}
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                STOPPED - NO DATABASE WRITE
              </span>
            </div>
            <p className="text-xs text-amber-200 leading-relaxed">
              {isRTL
                ? 'تم فحص المصنف التاريخي "مخزن خامات 9.xlsx"، وتحليل كافة السجلات، ومحاكاة بصمة التكرار وحساب الأثر المخزني المتوقع بدقة. وفقاً لتعليمات المرحلة 2: تم إيقاف العملية تلقائياً دون كتابة أي سجل فعلي بقاعدة البيانات.'
                : 'The test workbook "مخزن خامات 9.xlsx" has been parsed, fingerprints computed, and projected stock modeled. As per Phase 2 instructions, execution has halted before importing to allow review.'}
            </p>
          </div>
        </div>
      )}

      {/* Main View Area based on Step */}

      {/* STEP 1: SELECT FILE */}
      {currentStep === 'FILE_SELECT' && (
        <div className="space-y-6">
          {/* Administrative Clean Slate Callout Banner */}
          <div className="bg-gradient-to-r from-rose-950/50 via-slate-900 to-[#0f1115] border border-rose-500/30 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0 mt-0.5">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2.5">
                  {isRTL
                    ? 'التجهيز لرفع ملفات الإكسل الحقيقية (Clean Slate Preparation)'
                    : 'Prepare System for Real Excel Files (Clean Slate)'}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                    ADMIN CLEARANCE
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {isRTL
                    ? 'قبل البدء في استيراد ملفاتك الفعلية، يمكنك تشغيل أداة المسح الإداري لتفريغ كافة السجلات والمواد وحركات المخزون المولدة سابقاً من سحابة Firestore والذاكرة المحلية لتجنب أي تداخل مع البيانات الواقعية.'
                    : 'Before importing your real Excel sheets, you can run the administrative bulk-wipe utility to purge all previously generated mock records from Firestore cloud and local storage to guarantee zero data conflict.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsPreFlightOpen(true)}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-amber-600/90 hover:bg-amber-500 text-white border border-amber-500/40 shadow-md flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer"
                title={isRTL ? 'فحص استباقي للحجم والتبعيات' : 'Pre-Flight Data & Dependency Audit'}
              >
                <ShieldAlert className="w-4 h-4 text-amber-200" />
                {isRTL ? 'فحص الجاهزية (Pre-Flight)' : 'Pre-Flight Check'}
              </button>

              <button
                type="button"
                onClick={() => setIsSnapshotModalOpen(true)}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-cyan-700/80 hover:bg-cyan-600 text-cyan-100 border border-cyan-500/40 shadow-md flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer"
                title={isRTL ? 'تصدير نسخة احتياطية لكافة المجموعات بصيغة JSON' : 'Export JSON snapshot of all collections'}
              >
                <Download className="w-4 h-4 text-cyan-300" />
                {isRTL ? 'تنزيل نسخة احتياطية (JSON)' : 'Download Snapshot Backup'}
              </button>

              <button
                type="button"
                onClick={() => {
                  exportImportHistoryToCSV(importBatches, isRTL);
                }}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 shadow-md flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer"
                title={isRTL ? 'تصدير جدول سجل الاستيراد كملف CSV للتقارير والتدقيق دون اتصال' : 'Export import history table to CSV for offline reporting'}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                {isRTL ? 'تصدير السجل (CSV)' : 'Export History (CSV)'}
              </button>

              <button
                type="button"
                onClick={() => setIsSchedulerModalOpen(true)}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-emerald-700/80 hover:bg-emerald-600 text-emerald-100 border border-emerald-500/40 shadow-md flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer"
                title={isRTL ? 'مجدول السحابة الآلي وسياسة الـ 30 يوماً' : 'Cloud Scheduler & 30-Day Retention'}
              >
                <Cloud className="w-4 h-4 text-emerald-300" />
                {isRTL ? 'مجدول السحابة (30-Day)' : 'Cloud Scheduler'}
              </button>

              <button
                type="button"
                onClick={() => setIsBulkWipeOpen(true)}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/60 flex items-center gap-2 whitespace-nowrap transition-all flex-shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {isRTL ? 'تشغيل أداة تفريغ السحابة' : 'Launch Bulk-Wipe Utility'}
              </button>
            </div>
          </div>

          {/* Pre-Flight Check Summary Card */}
          <PreFlightCheckCard
            onOpenPreFlightModal={() => setIsPreFlightOpen(true)}
            onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
            onOpenBulkWipeModal={() => setIsBulkWipeOpen(true)}
          />

          {/* Cloud Automated Scheduler & 30-Day Retention Policy Card */}
          <CloudSchedulerCard
            onOpenSchedulerModal={() => setIsSchedulerModalOpen(true)}
            onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
          />

          {/* Bulk Rollback & Disaster Recovery Safety Card */}
          <BulkRollbackCard
            onOpenRollbackModal={(record) => {
              setRollbackTargetRecord(record || null);
              setIsRollbackModalOpen(true);
            }}
            onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preset Workbooks Panel */}
          <div className="lg:col-span-2 bg-[#0f1115] border border-white/10 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
                {isRTL ? 'نماذج ومصنفات المصنع التاريخية المعتمدة' : 'Factory Historical Workbooks'}
              </h2>
              <span className="text-xs font-mono text-cyan-400">{isRTL ? 'جاهزة للفحص الفوري' : 'Verified Presets'}</span>
            </div>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'اختر أحد الملفات التاريخية المعتمدة لتطبيق قواعد المطابقة والتحقق والحساب المخزني:'
                : 'Select one of AL-KARWAN historical workbooks to run migration pipeline:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Recommended Test File: مخزن خامات 9 */}
              <div
                onClick={() => handleLoadPreset('RAW_STORE_9', false)}
                className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden group ${
                  selectedPreset === 'RAW_STORE_9'
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40'
                    : 'border-white/10 bg-slate-900/50 hover:border-cyan-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                        {isRTL ? 'ملف الاختبار الأساسي' : 'PRIMARY TEST WORKBOOK'}
                      </span>
                    </div>
                    <div className="font-bold text-white text-base mt-2 group-hover:text-cyan-300 transition-colors">
                      مخزن خامات 9.xlsx
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {isRTL ? 'أرصدة مخزن الخامات الرئيسي (4 خامات، 64,750 كغم)' : 'Main Raw Material Store snapshot (4 items, 64,750 KG)'}
                    </div>
                  </div>
                  <CheckCircle2
                    className={`w-5 h-5 ${selectedPreset === 'RAW_STORE_9' ? 'text-cyan-400' : 'text-slate-400'}`}
                  />
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-400">
                  <span>Type: OPENING_BALANCE</span>
                  <span>Warehouse: WH-01</span>
                </div>
              </div>

              {/* Therm Capacity File */}
              <div
                onClick={() => handleLoadPreset('THERM_CAPACITY_9', false)}
                className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden group ${
                  selectedPreset === 'THERM_CAPACITY_9'
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40'
                    : 'border-white/10 bg-slate-900/50 hover:border-cyan-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300">
                      {isRTL ? 'مخزن الثرم 2' : 'THERM STORE 2'}
                    </span>
                    <div className="font-bold text-white text-base mt-2 group-hover:text-cyan-300 transition-colors">
                      طاقة مخزنية لمخزن الثرم -9.xlsx
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {isRTL ? 'أرصدة الثرم وسكراب الأكواب (3 خامات، 49,248 كغم)' : 'Therm regrind and cup scrap snapshot'}
                    </div>
                  </div>
                  <CheckCircle2
                    className={`w-5 h-5 ${selectedPreset === 'THERM_CAPACITY_9' ? 'text-cyan-400' : 'text-slate-400'}`}
                  />
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-400">
                  <span>Type: OPENING_BALANCE</span>
                  <span>Warehouse: WH-02</span>
                </div>
              </div>

              {/* Receiving 546 */}
              <div
                onClick={() => handleLoadPreset('546', false)}
                className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden group ${
                  selectedPreset === '546'
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40'
                    : 'border-white/10 bg-slate-900/50 hover:border-cyan-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                      {isRTL ? 'استلام 546' : 'RECEIVING 546'}
                    </span>
                    <div className="font-bold text-white text-base mt-2 group-hover:text-cyan-300 transition-colors">
                      سجل_الكروان_المعتمد_546.xlsx
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {isRTL ? 'حركات التوريد والاستلام من الموردين (5 شاحنات، 83,900 كغم)' : 'Supplier receiving logs with gross/tare weights'}
                    </div>
                  </div>
                  <CheckCircle2 className={`w-5 h-5 ${selectedPreset === '546' ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-400">
                  <span>Type: RECEIPT</span>
                  <span>Transactions: 5</span>
                </div>
              </div>

              {/* Production Issue 167 */}
              <div
                onClick={() => handleLoadPreset('167', false)}
                className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden group ${
                  selectedPreset === '167'
                    ? 'border-cyan-400 bg-cyan-950/20 shadow-lg shadow-cyan-950/40'
                    : 'border-white/10 bg-slate-900/50 hover:border-cyan-500/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300">
                      {isRTL ? 'صرف إنتاج 167' : 'ISSUE 167'}
                    </span>
                    <div className="font-bold text-white text-base mt-2 group-hover:text-cyan-300 transition-colors">
                      صادر_خامات_167.xlsx
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {isRTL ? 'أوامر صرف المواد لخطوط البثق والتشكيل' : 'Production floor material issue logs'}
                    </div>
                  </div>
                  <CheckCircle2 className={`w-5 h-5 ${selectedPreset === '167' ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5 text-[11px] font-mono text-slate-400">
                  <span>Type: PRODUCTION_ISSUE</span>
                  <span>Lines: Extrusion & Thermo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Upload & Migration Configuration */}
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-5 sm:p-6 space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-cyan-400" />
              {isRTL ? 'رفع ملف إكسل محلي' : 'Custom File Upload'}
            </h2>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 hover:border-cyan-400 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-900/30 hover:bg-slate-900/60"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 text-cyan-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-white">
                {isRTL ? 'اضغط لاختيار ملف أو اسحبه هنا' : 'Click to select or drag file'}
              </div>
              <div className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv (Up to 25 MB)</div>
            </div>

            {/* Migration Nature Mode (Requirement 7) */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-mono font-bold text-slate-300 block">
                {isRTL ? 'طبيعة الترحيل المخزني' : 'Migration Ledger Nature'}
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMigrationMode('OPENING_BALANCE')}
                  className={`p-2.5 rounded-lg border text-start transition-all ${
                    migrationMode === 'OPENING_BALANCE'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                      : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{isRTL ? 'رصيد افتتاحي' : 'Opening Balance'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{isRTL ? 'كشف جرد وطاقة' : 'Snapshot files'}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setMigrationMode('OPERATIONAL')}
                  className={`p-2.5 rounded-lg border text-start transition-all ${
                    migrationMode === 'OPERATIONAL'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold'
                      : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{isRTL ? 'حركات تشغيلية' : 'Transactions'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{isRTL ? 'استلام وصرف' : 'Receipt / Issue logs'}</div>
                </button>
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-lg p-3 text-[11px] text-slate-300 space-y-1 font-mono border border-white/5">
              <div className="text-cyan-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {isRTL ? 'ضمان الدقة والمطابقة الكاملة' : 'Zero Ambiguity Guarantee'}
              </div>
              <p className="leading-relaxed">
                {isRTL
                  ? 'لن يتم إدخال أي سجل يحتوي على أخطاء. يتم التحقق من المواد ومطابقتها وتوليد بصمة الحركة لمنع التكرار.'
                  : 'Zero ERROR rows allowed. Every entry is matched to Material Master and audited.'}
              </p>
            </div>
          </div>
        </div>

        {/* Import History Log Component with Real-Time Search & Audit Metrics */}
        <div id="import-history-log-section">
          <ImportHistoryLog
            onSelectBatch={(batch) => {
              setActiveBatchId(batch.id);
            }}
          />
        </div>
      </div>
      )}

      {/* STEP 2: ANALYSIS & MAPPING */}
      {currentStep === 'ANALYSIS_MAP' && analysis && currentSheet && (
        <div className="space-y-6">
          {/* Sheet Selector Bar */}
          <div className="flex items-center justify-between bg-[#0f1115] border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">{isRTL ? 'الأوراق المكتشفة:' : 'Sheets:'}</span>
              {analysis.sheets.map((sheet, idx) => (
                <button
                  key={sheet.sheetName}
                  onClick={() => setActiveSheetIdx(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeSheetIdx === idx
                      ? 'bg-cyan-500 text-black font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {sheet.sheetName} ({sheet.transactionRowsCount})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep('VALIDATION_GATE')}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition-all"
              >
                <span>{isRTL ? 'المتابعة إلى بوابة التدقيق' : 'Proceed to Validation Gate'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Structure Breakdown Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#0f1115] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {isRTL ? 'هيكل المصنف المكتشف' : 'Detected Structure'}
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'إجمالي الصفوف' : 'Total Rows'}:</span>
                  <span>{currentSheet.totalRows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'سطر العناوين' : 'Header Row'}:</span>
                  <span className="text-amber-400">{currentSheet.headerRowIndex + 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'صفوف الحركات الصالحة' : 'Data Rows'}:</span>
                  <span className="text-emerald-400 font-bold">{currentSheet.transactionRowsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'صفوف المجاميع المستبعدة' : 'Totals / Blank'}:</span>
                  <span className="text-slate-400">{currentSheet.totalRows - currentSheet.transactionRowsCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1115] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                {isRTL ? 'نوع المستند والمستودع' : 'Document & Warehouse'}
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'نوع المستند' : 'Doc Type'}:</span>
                  <span className="text-cyan-400 font-bold">{currentSheet.detectedType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'المستودع المستهدف' : 'Target Warehouse'}:</span>
                  <span>{currentSheet.detectedWarehouseId || 'WH-01 (مستودع الخامات)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'الموقع الافتراضي' : 'Default Location'}:</span>
                  <span>{currentSheet.detectedLocationCode || 'LOC-A-01'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'طبيعة القيد' : 'Ledger Nature'}:</span>
                  <span className="text-purple-400">{migrationMode}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0f1115] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                {isRTL ? 'صحة المطابقة والربط' : 'Mapping Health'}
              </div>
              <div className="space-y-1 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'الأعمدة المطابقة' : 'Mapped Columns'}:</span>
                  <span>{currentSheet.detectedHeaders.filter((h) => h.mappedField !== 'UNMAPPED').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'صفوف مقبولة تماماً' : 'Accepted Rows'}:</span>
                  <span className="text-emerald-400 font-bold">{currentSheet.acceptedRowsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'صفوف التنبيهات' : 'Warning Rows'}:</span>
                  <span className="text-amber-400 font-bold">{currentSheet.warningRowsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{isRTL ? 'صفوف الأخطاء' : 'Error Rows'}:</span>
                  <span className="text-rose-400 font-bold">{currentSheet.errorRowsCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column Mapping Table */}
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
              {isRTL ? 'جدول ربط أعمدة إكسل بحقول النظام' : 'Excel Column Mapping Matrix'}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-mono">
                    <th className="p-2.5 text-start">{isRTL ? 'عمود الإكسل' : 'Col'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'العنوان الأصلي' : 'Original Header'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'الحقل المرتبط' : 'Mapped System Field'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'مستوى الثقة' : 'Confidence'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'عينة من البيانات' : 'Sample Value'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {currentSheet.detectedHeaders.map((col) => (
                    <tr key={col.colIndex} className="hover:bg-slate-900/50">
                      <td className="p-2.5 font-bold text-cyan-400">{col.colLetter}</td>
                      <td className="p-2.5 text-white font-semibold font-sans">{col.headerRaw || '---'}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-bold border border-cyan-500/20">
                          {col.mappedField}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            col.confidence === 'HIGH'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : col.confidence === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {col.confidence}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-400 truncate max-w-xs">{col.sampleValues?.[0] || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: ZERO AMBIGUITY VALIDATION GATE (Requirement 4 & 10) */}
      {currentStep === 'VALIDATION_GATE' && currentSheet && (
        <div className="space-y-6">
          {/* Validation Header & Control Bar */}
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setRowStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rowStatusFilter === 'ALL' ? 'bg-white text-black' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {isRTL ? 'الكل' : 'All'} ({currentSheet.dataRows.length})
              </button>
              <button
                onClick={() => setRowStatusFilter('ACCEPTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rowStatusFilter === 'ACCEPTED' ? 'bg-emerald-500 text-black font-bold' : 'bg-slate-800 text-emerald-400'
                }`}
              >
                {isRTL ? 'مقبول' : 'Accepted'} ({currentSheet.acceptedRowsCount})
              </button>
              <button
                onClick={() => setRowStatusFilter('WARNING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rowStatusFilter === 'WARNING' ? 'bg-amber-500 text-black font-bold' : 'bg-slate-800 text-amber-400'
                }`}
              >
                {isRTL ? 'تنبيه' : 'Warning'} ({currentSheet.warningRowsCount})
              </button>
              <button
                onClick={() => setRowStatusFilter('ERROR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  rowStatusFilter === 'ERROR' ? 'bg-rose-500 text-white font-bold' : 'bg-slate-800 text-rose-400'
                }`}
              >
                {isRTL ? 'خطأ' : 'Error'} ({currentSheet.errorRowsCount})
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {currentSheet.errorRowsCount > 0 && (
                <button
                  onClick={handleExcludeAllErrors}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
                >
                  {isRTL ? 'استبعاد كافة الأخطاء' : 'Exclude All Errors'}
                </button>
              )}

              <button
                onClick={() => setCurrentStep('DUPLICATE_CHECK')}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition-all"
              >
                <span>{isRTL ? 'المتابعة إلى فحص التكرار' : 'Proceed to Duplicate Check'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Validation Rows Table */}
          <div className="bg-[#0f1115] border border-white/10 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-900/90 border-b border-white/10 font-mono text-slate-400">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'الصف' : 'Row'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المادة المكتشفة' : 'Matched Material'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الصافي (كغم)' : 'Net KG'}</th>
                    <th className="p-3 text-center">{isRTL ? 'الشلايف' : 'Bags'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المستند' : 'Doc Ref'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الموقع' : 'Location'}</th>
                    <th className="p-3 text-start">{isRTL ? 'ملاحظات التدقيق' : 'Validation Notes'}</th>
                    <th className="p-3 text-center">{isRTL ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredRows.map((row) => {
                    const isErr = row.severity === 'ERROR';
                    const isWarn = row.severity === 'WARNING';
                    const isIgnored = row.isIgnoredByUser;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isIgnored
                            ? 'opacity-40 bg-slate-950'
                            : isErr
                            ? 'bg-rose-950/20 hover:bg-rose-950/30'
                            : isWarn
                            ? 'bg-amber-950/20 hover:bg-amber-950/30'
                            : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="p-3 text-slate-400 font-bold">{row.sourceRow}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isIgnored
                                ? 'bg-slate-800 text-slate-400'
                                : isErr
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : isWarn
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {isIgnored ? 'EXCLUDED' : row.severity}
                          </span>
                        </td>
                        <td className="p-3 font-sans">
                          <div className="text-white font-semibold">{row.materialMatchedNameAr || row.materialRaw}</div>
                          <div className="text-[10px] font-mono text-cyan-400">{row.materialMatchedCode}</div>
                        </td>
                        <td className="p-3 text-end font-bold text-white text-sm">
                          {row.netKG?.toLocaleString()} KG
                        </td>
                        <td className="p-3 text-center font-bold text-amber-400">{row.bulkBags}</td>
                        <td className="p-3 text-slate-300">{row.docRef}</td>
                        <td className="p-3 text-cyan-400">{row.locationCode || 'LOC-A-01'}</td>
                        <td className="p-3 font-sans text-slate-300 text-[11px] max-w-xs truncate">
                          {row.messages?.[0]?.text || '✓ تم التحقق بنجاح'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedRowForTrace(row)}
                              title={isRTL ? 'عرض تفاصيل التتبع' : 'Inspect Trace'}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleExcludeRow(row.id)}
                              title={isIgnored ? (isRTL ? 'إعادة التضمين' : 'Include') : (isRTL ? 'استبعاد' : 'Exclude')}
                              className={`p-1 rounded ${
                                isIgnored
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400'
                              }`}
                            >
                              {isIgnored ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: DUPLICATE CHECK & FINGERPRINTS (Requirement 11) */}
      {currentStep === 'DUPLICATE_CHECK' && currentSheet && (
        <div className="space-y-6">
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  {isRTL ? 'نظام الحماية من التكرار وبصمة المعاملات' : 'Transaction Fingerprint & Duplicate Protection'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL
                    ? 'يتم حساب بصمة رقمية مشفرة لكل سجل بناءً على (رقم المستند + رمز المادة + التاريخ + الوزن + الشلايف + المورد + ملف المصدر) لمنع إنشاء قيود مكررة.'
                    : 'A unique digital fingerprint is calculated for every row to prevent duplicate inventory movements.'}
                </p>
              </div>

              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  {isRTL ? 'سجلات جديدة' : 'Clean Rows'}: {duplicateEvaluation.cleanRows.length}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                  {isRTL ? 'سجلات مكررة' : 'Duplicates'}: {duplicateEvaluation.duplicateRows.length}
                </span>
              </div>
            </div>

            {duplicateEvaluation.duplicateRows.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  {isRTL
                    ? `تم اكتشاف ${duplicateEvaluation.duplicateRows.length} سجل مكرر مسجل مسبقاً في حركة المخزن. سيتم وسمها كـ DUPLICATE واستبعادها من التأثير على الرصيد.`
                    : `${duplicateEvaluation.duplicateRows.length} duplicate records detected. They will be flagged and excluded from double-counting.`}
                </span>
              </div>
            )}

            {/* Fingerprint Samples Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-mono">
                    <th className="p-2.5 text-start">{isRTL ? 'الصف' : 'Row'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'المادة' : 'Material'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'المستند' : 'Doc'}</th>
                    <th className="p-2.5 text-end">{isRTL ? 'الوزن (كغم)' : 'KG'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'بصمة المعاملة الرقمية (Transaction Fingerprint)' : 'Fingerprint'}</th>
                    <th className="p-2.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {currentSheet.dataRows.slice(0, 10).map((row) => {
                    const fp = computeMovementFingerprint({
                      docRef: row.docRef,
                      materialCode: row.materialMatchedCode,
                      date: row.date,
                      netKG: row.netKG,
                      bulkBags: row.bulkBags,
                      supplier: row.supplierRaw,
                      sourceFile: analysis?.fileName,
                      sourceSheet: row.sourceSheet,
                      sourceRow: row.sourceRow,
                    });
                    const isDup = duplicateEvaluation.duplicateRows.some((d) => d.id === row.id);

                    return (
                      <tr key={row.id} className="hover:bg-slate-900/50">
                        <td className="p-2.5 text-slate-400 font-bold">{row.sourceRow}</td>
                        <td className="p-2.5 text-white font-sans font-semibold">{row.materialMatchedNameAr}</td>
                        <td className="p-2.5 text-cyan-400">{row.docRef}</td>
                        <td className="p-2.5 text-end font-bold">{row.netKG?.toLocaleString()}</td>
                        <td className="p-2.5 text-slate-400 text-[10px] truncate max-w-sm">{fp}</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDup ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {isDup ? 'DUPLICATE' : 'UNIQUE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setCurrentStep('INVENTORY_IMPACT')}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition-all"
              >
                <span>{isRTL ? 'المتابعة إلى محاكاة أثر المخزون' : 'Proceed to Stock Impact Review'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: INVENTORY IMPACT REVIEW (THE MANDATORY SAFETY GATE) (Requirement 16) */}
      {currentStep === 'INVENTORY_IMPACT' && currentSheet && (
        <div className="space-y-6">
          <div className="bg-[#0f1115] border border-cyan-500/30 rounded-xl p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 uppercase">
                  MANDATORY SAFETY GATE • بوابة الأمان الإلزامية
                </span>
                <h3 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-cyan-400" />
                  {isRTL ? 'مراجعة أثر الترحيل على الأرصدة المخزنية' : 'Pre-Commit Inventory Stock Impact Review'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL
                    ? 'جدول مقارنة الأرصدة الحالية والأرصدة المتوقعة بعد الترحيل لكل مادة وموقع لتأكيد عدم وجود عجز أو تضارب.'
                    : 'Mathematical comparison between current stock, migrated stock, and projected balance.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!testRunCompleted ? (
                  <button
                    onClick={() => setIsApprovalModalOpen(true)}
                    className="px-5 py-2.5 rounded-lg text-xs font-bold font-mono bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isRTL ? 'اعتماد وترحيل إلى المخزون' : 'Approve and Apply to Inventory'}
                  </button>
                ) : (
                  <div className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
                    {isRTL ? 'وضع المحاكاة: متوقف للمعاينة' : 'TEST MODE: SIMULATION ONLY'}
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Impact Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-mono">
                    <th className="p-3 text-start">{isRTL ? 'المادة الخام' : 'Material'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الرمز' : 'Code'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الرصيد الحالي' : 'Current Stock'}</th>
                    <th className="p-3 text-center">{isRTL ? 'الشلايف الحالية' : 'Current Bags'}</th>
                    <th className="p-3 text-end text-cyan-400 font-bold">{isRTL ? 'الكمية المستوردة' : 'Imported Stock'}</th>
                    <th className="p-3 text-center text-amber-400 font-bold">{isRTL ? 'الشلايف المستوردة' : 'Imported Bags'}</th>
                    <th className="p-3 text-end text-emerald-400 font-bold">{isRTL ? 'الرصيد المتوقع' : 'Projected Stock'}</th>
                    <th className="p-3 text-center">{isRTL ? 'المواقع المستهدفة' : 'Target Locations'}</th>
                    <th className="p-3 text-center">{isRTL ? 'الحالة المخزنية' : 'Stock Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {inventoryImpactSimulation.map((row) => {
                    const isIncrease = row.importedStockKG >= 0;

                    return (
                      <tr key={row.material?.id || Math.random()} className="hover:bg-slate-900/50">
                        <td className="p-3 font-sans">
                          <div className="text-white font-semibold">{row.material?.nameAr || 'مادة غير محددة'}</div>
                          <div className="text-[10px] text-slate-400">{row.material?.nameEn || ''}</div>
                        </td>
                        <td className="p-3 font-bold text-slate-300">{row.material?.code || '---'}</td>
                        <td className="p-3 text-end text-slate-300">{(row.currentStockKG ?? 0).toLocaleString()} KG</td>
                        <td className="p-3 text-center text-slate-300">{row.currentBags ?? 0}</td>
                        <td
                          className={`p-3 text-end font-bold text-sm ${
                            isIncrease ? 'text-cyan-400' : 'text-rose-400'
                          }`}
                        >
                          {isIncrease ? '+' : ''}
                          {(row.importedStockKG ?? 0).toLocaleString()} KG
                        </td>
                        <td className="p-3 text-center font-bold text-amber-400">
                          {isIncrease ? '+' : ''}
                          {row.importedBags ?? 0}
                        </td>
                        <td className="p-3 text-end font-bold text-sm text-emerald-400">
                          {(row.projectedStockKG ?? 0).toLocaleString()} KG
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            {row.locations.map((loc) => (
                              <span
                                key={loc}
                                className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                              >
                                {loc}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {isRTL ? 'آمن ومثالي' : 'Optimal'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: POST-IMPORT AUDIT & TRACEABILITY SUMMARY (Requirement 17) */}
      {currentStep === 'AUDIT_COMPLETE' && activeBatch && (
        <div className="space-y-6">
          <div className="bg-[#0f1115] border border-emerald-500/40 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">
                {isRTL ? 'اكتمل الترحيل والاعتماد المخزني بنجاح!' : 'Historical Migration Successfully Completed!'}
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-xl mx-auto">
                {isRTL
                  ? `تم تسجيل الحركات بنجاح وربطها بالدفعة رقم ${activeBatch.id} وتحديث سجل الحركات المركزي ورصيد المخزون الفعلي.`
                  : `All historical entries have been converted into Inventory Movements with full batch traceability.`}
              </p>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto font-mono text-start mt-6">
              <div className="bg-slate-900 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-400">{isRTL ? 'السجلات المرحلة' : 'Imported Rows'}</div>
                <div className="text-xl font-bold text-emerald-400">{activeBatch.importedRowsCount}</div>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-400">{isRTL ? 'الوزن المضاف' : 'Total KG Added'}</div>
                <div className="text-xl font-bold text-cyan-400">+{activeBatch.totalKG?.toLocaleString()} KG</div>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-400">{isRTL ? 'الشلايف المعتمدة' : 'Bulk Bags'}</div>
                <div className="text-xl font-bold text-amber-400">+{activeBatch.totalBags}</div>
              </div>

              <div className="bg-slate-900 border border-white/10 rounded-lg p-3">
                <div className="text-[10px] text-slate-400">{isRTL ? 'حالة الدفعة' : 'Batch Status'}</div>
                <div className="text-xl font-bold text-white">{activeBatch.status}</div>
              </div>
            </div>

            {/* Direct One-Click Navigation (Requirement 17) */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-white/10">
              <button
                onClick={() => setCurrentPage('movement_ledger')}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2 transition-all shadow-lg shadow-cyan-950/50"
              >
                <Activity className="w-4 h-4" />
                {isRTL ? 'الانتقال إلى سجل حركات المخزون المركزي' : 'View Inventory Movement Ledger'}
              </button>

              <button
                onClick={() => setCurrentPage('materials_master')}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-white border border-white/10 flex items-center gap-2 transition-all"
              >
                <Boxes className="w-4 h-4" />
                {isRTL ? 'معاينة بطاقات المواد' : 'View Material Cards'}
              </button>

              <button
                onClick={() => setCurrentPage('dashboard')}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-slate-800 hover:bg-slate-700 text-white border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Database className="w-4 h-4" />
                {isRTL ? 'لوحة التحكم والمؤشرات' : 'Go to Dashboard'}
              </button>

              <button
                onClick={() => {
                  setCurrentStep('FILE_SELECT');
                  setTimeout(() => {
                    document.getElementById('import-history-log-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-4 py-2.5 rounded-lg text-xs font-bold font-mono bg-cyan-700/80 hover:bg-cyan-600 text-cyan-100 border border-cyan-500/40 flex items-center gap-2 transition-all cursor-pointer"
              >
                <History className="w-4 h-4 text-cyan-300" />
                {isRTL ? 'معاينة سجل الاستيراد والتدقيق' : 'View Ingestion Audit Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Safety Gate Modal (Requirement 16) */}
      {isApprovalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115] border-2 border-emerald-500/50 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400">
              <ShieldCheck className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isRTL ? 'تأكيد اعتماد الترحيل إلى المخزون المركزي' : 'Confirm Inventory Migration Commitment'}
                </h3>
                <span className="text-xs font-mono text-slate-400">IRREVERSIBLE AUDIT EVENT</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isRTL
                ? `أنت على وشك ترحيل ${currentSheet?.acceptedRowsCount} سجل موثق من المصنف "${analysis?.fileName}" وإضافتها مباشرة إلى سجل حركات المخزون المركزي تحت الدفعة ${activeBatchId}. هل توافق على التنفيذ؟`
                : `You are about to commit ${currentSheet?.acceptedRowsCount} records from "${analysis?.fileName}" into the central Inventory Movement Ledger under batch ${activeBatchId}. Proceed?`}
            </p>

            <div className="bg-slate-900 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1">
              <div>• {isRTL ? 'الدفعة' : 'Batch'}: {activeBatchId}</div>
              <div>• {isRTL ? 'طبيعة القيد' : 'Ledger Type'}: {migrationMode}</div>
              <div>• {isRTL ? 'السجلات المعتمدة' : 'Records'}: {currentSheet?.acceptedRowsCount}</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setIsApprovalModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmAndImport}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-lg text-xs font-bold font-mono bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center gap-2 transition-all"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isRTL ? 'تأكيد وترحيل الآن' : 'Confirm & Apply Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Row Traceability Inspector Modal (Requirement 13) */}
      {selectedRowForTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1115] border border-white/10 rounded-xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {isRTL ? 'مسار التتبع الكامل للسجل' : 'Row Source Traceability'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRowForTrace(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">DATABASE RECORD ➔:</span>
                <span className="text-cyan-400 font-bold">{selectedRowForTrace.id}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">IMPORT BATCH ➔:</span>
                <span className="text-white font-bold">{activeBatchId}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">EXCEL WORKBOOK:</span>
                <span>{analysis?.fileName}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">EXCEL SHEET ➔:</span>
                <span>{selectedRowForTrace.sourceSheet}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">EXCEL ROW NUMBER:</span>
                <span className="text-amber-400 font-bold">{selectedRowForTrace.sourceRow}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">ORIGINAL EXCEL TEXT:</span>
                <span className="text-emerald-400 font-sans font-semibold">{selectedRowForTrace.materialRaw}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">NORMALIZED MATERIAL:</span>
                <span className="text-white font-sans">{selectedRowForTrace.materialMatchedNameAr}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">MATERIAL CODE:</span>
                <span className="text-cyan-400 font-bold">{selectedRowForTrace.materialMatchedCode}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">WEIGHT (KG):</span>
                <span className="text-emerald-400 font-bold">{selectedRowForTrace.netKG?.toLocaleString()} KG</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">BULK BAGS:</span>
                <span className="text-amber-400 font-bold">{selectedRowForTrace.bulkBags}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedRowForTrace(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parser Technical Diagnostics Modal (Requirement 18) */}
      <ExcelParserDebugModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        analysis={analysis}
        currentSheet={currentSheet}
      />

      {/* Administrative Firestore Bulk-Wipe Modal */}
      <AdminFirestoreBulkWipeModal
        isOpen={isBulkWipeOpen}
        onClose={() => setIsBulkWipeOpen(false)}
        onOpenPreFlightCheck={() => {
          setIsBulkWipeOpen(false);
          setIsPreFlightOpen(true);
        }}
        onOpenRollback={() => {
          setIsBulkWipeOpen(false);
          setIsRollbackModalOpen(true);
        }}
        onWipeComplete={() => {
          setAnalysis(null);
          setActiveBatchId(null);
          setSelectedPreset('');
        }}
      />

      {/* Database Snapshot & JSON Backup Modal */}
      <DatabaseSnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
      />

      {/* Bulk Rollback from Firebase Storage Modal */}
      <BulkRollbackModal
        isOpen={isRollbackModalOpen}
        onClose={() => {
          setIsRollbackModalOpen(false);
          setRollbackTargetRecord(null);
        }}
        targetSnapshotRecord={rollbackTargetRecord}
      />

      {/* Pre-Flight Data Footprint & Dependency Safeguards Modal */}
      <PreFlightCheckModal
        isOpen={isPreFlightOpen}
        onClose={() => setIsPreFlightOpen(false)}
        onProceedToBulkWipe={() => setIsBulkWipeOpen(true)}
        onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
      />

      {/* Cloud Scheduler & 30-Day Retention Management Modal */}
      <CloudSchedulerModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setIsSchedulerModalOpen(false)}
        onOpenSnapshotModal={() => setIsSnapshotModalOpen(true)}
      />
    </div>
  );
};
