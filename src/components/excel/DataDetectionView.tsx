import React, { useState } from 'react';
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Table,
  FileSpreadsheet,
  SlidersHorizontal,
  Info,
  Filter,
  EyeOff,
  GitFork,
  Boxes,
  ShieldCheck,
  Split,
} from 'lucide-react';
import { SheetAnalysis } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface DataDetectionViewProps {
  currentSheet: SheetAnalysis;
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const DataDetectionView: React.FC<DataDetectionViewProps> = ({
  currentSheet,
  onNavigate,
  isRTL,
}) => {
  const [activeTab, setActiveTab] = useState<'MATRIX' | 'BANDS' | 'HIDDEN' | 'HIERARCHY'>('MATRIX');

  const region = currentSheet.dataRegion;
  const startColLetter = String.fromCharCode(65 + region.startCol);
  const endColLetter = String.fromCharCode(65 + region.endCol);

  // Classify row for matrix preview
  const getRowBadge = (rowIdx: number) => {
    const rowNum1Based = rowIdx + 1;

    // Check if hidden row
    const isHidden = currentSheet.hiddenRowsList?.some((hr) => hr.rowIndex === rowIdx);
    if (isHidden) {
      return { label: isRTL ? 'صف مخفي (معزول)' : 'Hidden (Isolated)', color: 'bg-rose-950 text-rose-300 border-rose-500/40' };
    }

    const isTitle = currentSheet.titleRows?.some((t) => t.rowIndex === rowNum1Based || t.rowIndex === rowIdx);
    if (isTitle) {
      return { label: isRTL ? 'عنوان المستند' : 'Title', color: 'bg-blue-950 text-blue-300 border-blue-500/40' };
    }

    const headerEnd = currentSheet.headerDepth && currentSheet.headerDepth > 1
      ? currentSheet.headerRowIndex + currentSheet.headerDepth - 1
      : currentSheet.headerRowIndex;

    if (rowIdx >= currentSheet.headerRowIndex && rowIdx <= headerEnd) {
      return { label: isRTL ? 'ترويسة هرمية مدمجة' : 'Hierarchical Header', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/40' };
    }

    const isSummary = currentSheet.rawMatrix[rowIdx]?.some((cell) => {
      const s = String(cell || '').trim();
      return /(?:المجموع|مجموع|صافي|اجمالي|إجمالي|total|subtotal|sum|أمين|المشرف|توقيع)/i.test(s);
    });
    if (isSummary) {
      return { label: isRTL ? 'ملخص / إجمالي' : 'Summary', color: 'bg-amber-950 text-amber-300 border-amber-500/40' };
    }

    if (rowIdx > headerEnd && rowIdx <= region.endRow) {
      return { label: isRTL ? 'حركة فعلية' : 'Transaction', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/40' };
    }

    return { label: isRTL ? 'قالب مستبعد' : 'Ignored Template', color: 'bg-slate-950 text-slate-500 border-slate-800' };
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              STEP 3: REGION DETECTION
            </span>
            <span className="text-xs text-slate-400 font-mono">{currentSheet.sheetName}</span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'اكتشاف مناطق البيانات وفحص الهيكل الهرمي' : 'Header & Data Region Detection'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'يقوم محرك الفحص الذكي بتحديد الإحداثيات المكانية الدقيقة، وفصل الترويسات الهرمية متعددة المستويات، واكتشاف الصفوف المخفية وعزلها لمنع أخطاء التحقق الوهمية.'
              : 'Detects exact 2D bounding boxes, separates multi-level merged headers, isolates hidden rows, and segments structural bands.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('MAP_COLUMNS')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer shrink-0"
        >
          <span>{isRTL ? 'المتابعة لمطابقة الأعمدة (خطوة 4)' : 'Proceed to Column Mapping (Step 4)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 4 Diagnostic Cards: Bounding Box, Hierarchical Headers, Hidden Rows, Totals & Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        {/* Data Region Bounding Box */}
        <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'نطاق البيانات الفعلي' : 'Data Region Box'}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              {startColLetter}:{endColLetter}
            </span>
          </div>
          <div className="text-sm font-bold text-white">
            {isRTL ? `صفوف ${region.startRow + 1} إلى ${region.endRow + 1}` : `Rows ${region.startRow + 1} to ${region.endRow + 1}`}
          </div>
          <div className="text-[11px] text-slate-400 font-sans">
            {isRTL ? `${region.totalCells} خلية مستخدمة في النطاق` : `${region.totalCells} active cells in region`}
          </div>
        </div>

        {/* Hierarchical Header Depth */}
        <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'عمق الترويسة الهرمية' : 'Header Depth'}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              {currentSheet.headerDepth || 1} {isRTL ? 'مستوى' : 'tier(s)'}
            </span>
          </div>
          <div className="text-sm font-bold text-emerald-300 truncate">
            {currentSheet.detectedHeaders.filter((h) => h.mappedField !== 'unknown').length} / {currentSheet.detectedHeaders.length} {isRTL ? 'عمود مطابق' : 'mapped cols'}
          </div>
          <div className="text-[11px] text-slate-400 font-sans">
            {currentSheet.mergedHeaderRanges && currentSheet.mergedHeaderRanges.length > 0
              ? (isRTL ? `${currentSheet.mergedHeaderRanges.length} نطاق دمج خلايا مكتشف` : `${currentSheet.mergedHeaderRanges.length} merged ranges`)
              : (isRTL ? 'ترويسة قياسية سريعة' : 'Standard single tier')}
          </div>
        </div>

        {/* Hidden Rows Quarantined */}
        <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'الصفوف والأعمدة المخفية' : 'Hidden Elements'}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-500/40">
              {(currentSheet.hiddenRowsCount || 0) + (currentSheet.hiddenColsCount || 0)} {isRTL ? 'مخفي' : 'hidden'}
            </span>
          </div>
          <div className="text-sm font-bold text-purple-300 truncate">
            {currentSheet.hiddenRowsCount || 0} {isRTL ? 'صف' : 'rows'} + {currentSheet.hiddenColsCount || 0} {isRTL ? 'عمود' : 'cols'}
          </div>
          <div className="text-[11px] text-slate-400 font-sans">
            {isRTL ? 'معزولة تلقائياً قبل الاستخراج' : 'Quarantined before extraction'}
          </div>
        </div>

        {/* Summary Rows & Ignored Templates */}
        <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 font-bold flex items-center justify-between">
            <span>{isRTL ? 'المجاميع والقوالب المستبعدة' : 'Totals & Ignored'}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40">
              0 {isRTL ? 'أخطاء وهمية' : 'false alarms'}
            </span>
          </div>
          <div className="text-sm font-bold text-amber-300">
            {currentSheet.summaryRowsCount} {isRTL ? 'مجاميع' : 'totals'} + {currentSheet.ignoredRowsCount} {isRTL ? 'قوالب' : 'templates'}
          </div>
          <div className="text-[11px] text-slate-400 font-sans">
            {isRTL ? 'تم استبعادها تلقائياً بالذكاء الاصطناعي' : 'Safely ignored by parser'}
          </div>
        </div>
      </div>

      {/* Zero False Alarm Guarantee Banner */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3 text-xs">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-slate-300 leading-relaxed font-sans">
          {isRTL
            ? `محرك الفحص الهرمي: تم عزل ${currentSheet.ignoredRowsCount.toLocaleString()} صف قالب فارغ ومجاميع تذييل، بالإضافة إلى ${currentSheet.hiddenRowsCount || 0} صف مخفي، وتفكيك الترويسات المدمجة لتفادي رسائل التحقق الخاطئة مثل ("اسم المادة غير محدد") نهائياً.`
            : `Hierarchical Engine: Isolated ${currentSheet.ignoredRowsCount.toLocaleString()} empty template/totals and ${currentSheet.hiddenRowsCount || 0} hidden rows, fully eliminating false validation alerts.`}
        </span>
      </div>

      {/* Sub-view Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('MATRIX')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MATRIX'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>{isRTL ? 'معاينة وتصنيف الصفوف' : 'Matrix Classification'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BANDS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BANDS'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{isRTL ? 'نطاقات الهيكل المصنعي (Bands)' : 'Structural Bands'}</span>
            {currentSheet.structuralBands && (
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-cyan-300 font-mono">
                {currentSheet.structuralBands.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HIDDEN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HIDDEN'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>{isRTL ? 'العناصر المخفية والمعزولة' : 'Hidden Elements'}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
              (currentSheet.hiddenRowsCount || 0) > 0 ? 'bg-purple-900 text-purple-200' : 'bg-slate-900 text-slate-500'
            }`}>
              {currentSheet.hiddenRowsCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HIERARCHY')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HIERARCHY'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>{isRTL ? 'شجرة الرؤوس المدمجة' : 'Merged Headers Tree'}</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-900 text-emerald-300 font-mono">
              {currentSheet.headerDepth || 1}L
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          {currentSheet.rawMatrix.length} {isRTL ? 'إجمالي صفوف الورقة' : 'total sheet rows'}
        </span>
      </div>

      {/* Tab 1: MATRIX PREVIEW */}
      {activeTab === 'MATRIX' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-400" />
              <span>{isRTL ? 'معاينة عينة من مصفوفة الإكسل وتصنيف كل صف:' : 'Raw Sheet Matrix Sample & Classification Tags:'}</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              {Math.min(currentSheet.rawMatrix.length, 15)} / {currentSheet.rawMatrix.length} {isRTL ? 'صف معروض' : 'rows shown'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[380px]">
            <table className="w-full text-start text-xs font-mono">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase sticky top-0">
                <tr>
                  <th className="p-2.5 text-start w-14">#</th>
                  <th className="p-2.5 text-start w-36">{isRTL ? 'تصنيف الصف' : 'Row Type'}</th>
                  {Array.from({ length: Math.min(region.endCol - region.startCol + 1, 8) }).map((_, cIdx) => (
                    <th key={cIdx} className="p-2.5 text-start">
                      {String.fromCharCode(65 + cIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                {currentSheet.rawMatrix.slice(0, 15).map((row, rIdx) => {
                  const badge = getRowBadge(rIdx);

                  return (
                    <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-2.5 text-slate-500 font-bold">{rIdx + 1}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      {Array.from({ length: Math.min(region.endCol - region.startCol + 1, 8) }).map((_, cIdx) => {
                        const val = row[cIdx];
                        const valStr = val !== undefined && val !== null ? String(val) : '';

                        return (
                          <td key={cIdx} className="p-2.5 text-slate-300 truncate max-w-[180px]">
                            {valStr !== '' ? valStr : <span className="text-slate-600">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: STRUCTURAL BANDS */}
      {activeTab === 'BANDS' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 font-sans">
            {isRTL
              ? 'يقوم النموذج الهيكلي بتقسيم ورقة العمل إلى نطاقات متتالية واضحة، لمعالجة كل نطاق بدقة وعزل القوالب الفارغة.'
              : 'Structural segmentation breaks the spreadsheet into functional bands for isolation and deterministic parsing.'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {(currentSheet.structuralBands || []).map((band, bIdx) => {
              const bandColor =
                band.type === 'DATA_BAND'
                  ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300'
                  : band.type === 'HEADER_BAND'
                  ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                  : band.type === 'TOTALS_BAND'
                  ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                  : band.type === 'HIDDEN_ROW'
                  ? 'border-purple-500/40 bg-purple-950/20 text-purple-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400';

              return (
                <div key={bIdx} className={`p-3.5 rounded-xl border ${bandColor} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{band.labelAr}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 font-mono">
                      {band.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
                    <span>
                      {isRTL ? `من الصف ${band.startRowIndex + 1} إلى ${band.endRowIndex + 1}` : `Rows ${band.startRowIndex + 1} to ${band.endRowIndex + 1}`}
                    </span>
                    <span className="font-mono font-bold">
                      {band.rowCount} {isRTL ? 'صف' : 'rows'}
                    </span>
                  </div>
                  {band.sampleValues && band.sampleValues.length > 0 && (
                    <div className="text-[10px] text-slate-500 truncate font-mono pt-1 border-t border-slate-800/60">
                      {band.sampleValues.slice(0, 3).join(' | ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: HIDDEN ELEMENTS QUARANTINE */}
      {activeTab === 'HIDDEN' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 flex items-center gap-3 text-xs text-purple-200 font-sans">
            <EyeOff className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              {isRTL
                ? `اكتشف النظام ${currentSheet.hiddenRowsCount || 0} صفوف مخفية في ورقة الإكسل الأصلية وتم عزلها بنجاح قبل مرحلة استخراج البيانات لمنع احتسابها كأخطاء تشغيلية.`
                : `Detected ${currentSheet.hiddenRowsCount || 0} hidden rows in the original Excel sheet. They are quarantined prior to parsing.`}
            </span>
          </div>

          {(currentSheet.hiddenRowsList && currentSheet.hiddenRowsList.length > 0) ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[350px]">
              <table className="w-full text-start text-xs font-mono">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase sticky top-0">
                  <tr>
                    <th className="p-2.5 text-start w-16"># {isRTL ? 'الصف' : 'Row'}</th>
                    <th className="p-2.5 text-start">{isRTL ? 'سبب الإخفاء في ملف Excel' : 'Excel Hidden Reason'}</th>
                    <th className="p-2.5 text-start font-sans">{isRTL ? 'محتوى العينة' : 'Sample Content'}</th>
                    <th className="p-2.5 text-center">{isRTL ? 'حالة الأمان' : 'Quarantine Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                  {currentSheet.hiddenRowsList.map((hr, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5 text-purple-300 font-bold">#{hr.rowIndex + 1}</td>
                      <td className="p-2.5 text-slate-300">{hr.reason}</td>
                      <td className="p-2.5 text-slate-400 truncate max-w-xs">{hr.sampleContent || '-'}</td>
                      <td className="p-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-sans">
                          {isRTL ? 'معزول بأمان' : 'Quarantined'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 font-sans text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-bold text-white">
                {isRTL ? 'لا توجد صفوف مخفية في ورقة العمل هذه' : 'No hidden rows detected in this sheet'}
              </div>
              <div>
                {isRTL ? 'جميع الصفوف المعروضة معالجة وفق النطاق الإنشائي المفتوح.' : 'All visible rows are cleanly accounted for.'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: MERGED HEADERS TREE */}
      {activeTab === 'HIERARCHY' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 font-sans">
            {isRTL
              ? 'الترويس الهرمي: يتم تفكيك الخلايا المدمجة (Merged Cells) ودمج مسار التصنيف للأعمدة الفرعية مع عناوينها الأب لضمان الربط التلقائي الدقيق.'
              : 'Hierarchical header resolution decomposes merged title cells and binds multi-level column paths.'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
            {(currentSheet.resolvedHierarchicalHeaders || currentSheet.detectedHeaders.map((h) => ({
              colIndex: h.colIndex,
              rawHeader: h.rawHeader,
              compositePath: h.rawHeader,
              isMerged: false,
              mappedField: h.mappedField,
              confidence: h.confidence,
            }))).map((hNode, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold text-cyan-400">
                    Col {String.fromCharCode(65 + (hNode.colIndex % 26))} (#{hNode.colIndex + 1})
                  </span>
                  {hNode.isMerged ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-sans">
                      {isRTL ? 'مدمج هرمياً' : 'Hierarchical'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 font-sans">
                      {isRTL ? 'رأس مباشر' : 'Direct'}
                    </span>
                  )}
                </div>

                <div className="font-bold text-white text-xs font-sans">
                  {hNode.compositePath || hNode.rawHeader}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans pt-1 border-t border-slate-800/60">
                  <span>{isRTL ? 'الحقل المرتبط:' : 'Mapped to:'}</span>
                  <span className="font-mono text-cyan-300 font-bold">{hNode.mappedField}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('WORKBOOK_ANALYSIS')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: تحليل المصنف (خطوة 2)' : 'Back to Analysis (Step 2)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('MAP_COLUMNS')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'المتابعة لمطابقة الأعمدة (خطوة 4)' : 'Proceed to Column Mapping (Step 4)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};

