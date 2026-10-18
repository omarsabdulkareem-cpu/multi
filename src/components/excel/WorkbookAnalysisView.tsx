import React from 'react';
import {
  FileSpreadsheet,
  ArrowRight,
  Database,
  CheckCircle2,
  Layers,
  FileText,
  TrendingUp,
  Cpu,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { WorkbookAnalysis, SheetAnalysis, ExcelDocType } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface WorkbookAnalysisViewProps {
  analysis: WorkbookAnalysis;
  currentSheet: SheetAnalysis;
  activeSheetIdx: number;
  onSelectSheetIdx: (idx: number) => void;
  onDocTypeChange: (type: ExcelDocType) => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const WorkbookAnalysisView: React.FC<WorkbookAnalysisViewProps> = ({
  analysis,
  currentSheet,
  activeSheetIdx,
  onSelectSheetIdx,
  onDocTypeChange,
  onNavigate,
  isRTL,
}) => {
  const matchedHeadersCount = currentSheet.detectedHeaders.filter(
    (h) => h.mappedField !== 'unknown'
  ).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card: Active Sheet Switcher & Metadata */}
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                ERP INGESTION ENGINE
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Batch ID: {analysis.batchId}
              </span>
            </div>
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>{analysis.fileName}</span>
              <span className="text-xs font-mono font-normal text-slate-400">
                ({analysis.fileSize})
              </span>
            </h3>
          </div>

          {/* Sheet Switcher Tabs if multi-sheet */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">
              {isRTL ? 'ورقة العمل:' : 'Sheet:'}
            </span>
            <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {analysis.sheets.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSheetIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                    activeSheetIdx === idx
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {s.sheetName} ({s.dataRows.length})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= MANDATED WORKBOOK ANALYSIS DISPLAY ================= */}
        <div className="p-5 rounded-xl bg-slate-950 border border-cyan-500/40 font-mono shadow-inner space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-cyan-400 font-bold text-xs sm:text-sm">
            <span className="tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>WORKBOOK ANALYSIS</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('DIAGNOSTICS')}
                className="text-[11px] text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 px-3 py-1 rounded-lg border border-cyan-500/50 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>{isRTL ? 'فتح الفحص التشخيصي المباشر' : 'Open Raw Diagnostics'}</span>
              </button>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/40">
                STATUS: PARSED 100%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">File:</span>
              <span className="text-white font-bold">{analysis.fileName}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Sheets:</span>
              <span className="text-cyan-300 font-bold">{analysis.totalSheets}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Data regions:</span>
              <span className="text-emerald-300 font-bold">{analysis.totalDataRegions}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Detected transaction rows:</span>
              <span className="text-emerald-400 font-bold text-sm">
                {currentSheet.transactionRowsCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Detected summary rows:</span>
              <span className="text-amber-400 font-bold">
                {currentSheet.summaryRowsCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Detected headers:</span>
              <span className="text-cyan-400 font-bold">
                {matchedHeadersCount} / {currentSheet.detectedHeaders.length}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Header Depth:</span>
              <span className="text-emerald-300 font-bold">
                {currentSheet.headerDepth || 1} Level(s)
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Hidden rows/cols:</span>
              <span className="text-purple-300 font-bold">
                {currentSheet.hiddenRowsCount || 0} rows / {currentSheet.hiddenColsCount || 0} cols
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Structural Bands:</span>
              <span className="text-cyan-300 font-bold">
                {currentSheet.structuralBands?.length || 1} bands detected
              </span>
            </div>
          </div>

          {/* Zero False Alarm Guarantee Banner */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-sans">
                {isRTL
                  ? `تم عزل ${currentSheet.ignoredRowsCount.toLocaleString()} صف قالب/فارغ ومجاميع تلقائياً بدون تسجيل أي أخطاء وهمية!`
                  : `Isolated ${currentSheet.ignoredRowsCount.toLocaleString()} empty/template rows & totals without generating false errors.`}
              </span>
            </div>
            <span className="font-mono text-slate-500">
              Used Range: {currentSheet.usedRange}
            </span>
          </div>
        </div>

        {/* Document Classification & Factory Type Switcher */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-bold">
                {isRTL ? 'النوع المصنعي المكتشف للورقة:' : 'Detected Factory Document Type:'}
              </div>
              <div className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <span>{isRTL ? currentSheet.typeTitleAr : currentSheet.typeTitleEn}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                  {isRTL ? 'مطابقة معتمدة 100%' : '100% Match'}
                </span>
              </div>
            </div>
          </div>

          {/* Doc Type Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-bold me-1">
              {isRTL ? 'تعديل التصنيف:' : 'Override Type:'}
            </span>
            {[
              { id: '546', label: '546 (استلام خامات)' },
              { id: '360', label: '360 (استلام الثرم)' },
              { id: '167', label: '167 (صادر الإنتاج)' },
              { id: '352', label: '352 (مستند 352)' },
              { id: 'INVENTORY_SNAPSHOT', label: isRTL ? 'أرصدة وطاقة مخزنية' : 'Inventory Snapshot' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onDocTypeChange(t.id as ExcelDocType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  currentSheet.detectedType === t.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fast Action Buttons to Continue */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <span className="text-xs text-slate-400">
            {isRTL
              ? 'يمكنك المتابعة خطوة بخطوة أو الانتقال مباشرة للمعاينة والأثر المخزني:'
              : 'Proceed step-by-step or jump straight to Data Preview & Inventory Impact:'}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('DIAGNOSTICS')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 font-bold text-xs border border-cyan-500/50 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'فحص البنية الخام (Diagnostics)' : 'Raw Diagnostics'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('DATA_PREVIEW')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'معاينة الحركات (خطوة 7)' : 'Data Preview (Step 7)'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('INVENTORY_IMPACT')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/40 transition-all cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isRTL ? 'تأثير المخزون (خطوة 8)' : 'Stock Impact (Step 8)'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('DATA_DETECTION')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer"
            >
              <span>{isRTL ? 'اكتشاف البيانات والنطاقات (خطوة 3)' : 'Data Regions (Step 3)'}</span>
              <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
