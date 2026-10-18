import React, { useState, useMemo } from 'react';
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Layers,
  Eye,
  EyeOff,
  TrendingUp,
} from 'lucide-react';
import { SheetAnalysis, AnalyzedDataRow } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface DataPreviewViewProps {
  currentSheet: SheetAnalysis;
  onToggleIgnoreRow: (rowId: string) => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const DataPreviewView: React.FC<DataPreviewViewProps> = ({
  currentSheet,
  onToggleIgnoreRow,
  onNavigate,
  isRTL,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE' | 'IGNORED'>('ALL');

  const displayedRows = useMemo(() => {
    return currentSheet.dataRows.filter((row) => {
      // Status filter
      if (statusFilter === 'VALID' && (row.isIgnoredByUser || row.severity !== 'VALID')) return false;
      if (statusFilter === 'WARNING' && (row.isIgnoredByUser || row.severity !== 'WARNING')) return false;
      if (statusFilter === 'ERROR' && (row.isIgnoredByUser || row.severity !== 'ERROR')) return false;
      if (statusFilter === 'DUPLICATE' && (row.isIgnoredByUser || !row.isDuplicate)) return false;
      if (statusFilter === 'IGNORED' && !row.isIgnoredByUser) return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const mat = (row.materialRaw || '').toLowerCase();
        const matAr = (row.materialMatchedNameAr || '').toLowerCase();
        const doc = (row.docRef || '').toLowerCase();
        const sup = (row.supplierRaw || '').toLowerCase();
        const code = (row.materialMatchedCode || '').toLowerCase();
        const truck = (row.truckNumber || '').toLowerCase();
        const driver = (row.driverName || '').toLowerCase();

        if (
          !mat.includes(q) &&
          !matAr.includes(q) &&
          !doc.includes(q) &&
          !sup.includes(q) &&
          !code.includes(q) &&
          !truck.includes(q) &&
          !driver.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [currentSheet.dataRows, statusFilter, searchQuery]);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              STEP 7: DATA PREVIEW
            </span>
            <span className="text-xs text-slate-400 font-mono">{currentSheet.sheetName}</span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'معاينة وفحص حركات الجدول وتفاصيل السجلات' : 'Transaction Records Preview & Ledger Table'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'فحص السجلات المستخرجة والتأكد من مسميات المواد، الأوزان الصافية، أعداد الشلايف، والمستودعات المستهدفة.'
              : 'Detailed inspection of parsed ERP rows, weights, bulk bags, warehouses, and status codes.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('INVENTORY_IMPACT')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer shrink-0"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{isRTL ? 'المتابعة لتأثير المخزون (خطوة 8)' : 'Proceed to Stock Impact (Step 8)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث برقم المستند، المادة، المورد، الشاحنة...' : 'Search by doc ref, material, supplier, truck...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'VALID', labelAr: 'سليم', labelEn: 'Valid' },
            { id: 'WARNING', labelAr: 'تنبيهات', labelEn: 'Warnings' },
            { id: 'ERROR', labelAr: 'أخطاء', labelEn: 'Errors' },
            { id: 'DUPLICATE', labelAr: 'مكرر', labelEn: 'Duplicates' },
            { id: 'IGNORED', labelAr: 'مستبعد', labelEn: 'Ignored' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {isRTL ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Preview ERP Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[500px]">
        <table className="w-full text-start text-xs font-mono">
          <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase sticky top-0 z-10">
            <tr>
              <th className="p-3 text-start">#</th>
              <th className="p-3 text-start">{isRTL ? 'صف Excel' : 'Source'}</th>
              <th className="p-3 text-start font-sans">{isRTL ? 'المادة والكود' : 'Material & Code'}</th>
              <th className="p-3 text-start font-sans">{isRTL ? 'المورد / المصدر' : 'Supplier'}</th>
              <th className="p-3 text-start">{isRTL ? 'نوع الحركة' : 'Doc Type'}</th>
              <th className="p-3 text-end text-emerald-400">{isRTL ? 'الصافي (كغم)' : 'Net KG'}</th>
              <th className="p-3 text-center text-amber-400">{isRTL ? 'الشلايف' : 'Bags'}</th>
              <th className="p-3 text-start font-sans">{isRTL ? 'المستودع والموقع' : 'Warehouse'}</th>
              <th className="p-3 text-start">{isRTL ? 'رقم المستند' : 'Doc Ref'}</th>
              <th className="p-3 text-start">{isRTL ? 'التاريخ' : 'Date'}</th>
              <th className="p-3 text-center">{isRTL ? 'حالة السجل' : 'Status'}</th>
              <th className="p-3 text-center">{isRTL ? 'إجراء' : 'Action'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-400 font-sans">
                  {isRTL ? 'لا توجد سجلات تطابق الفلتر المحدد' : 'No records match the current filter.'}
                </td>
              </tr>
            ) : (
              displayedRows.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`transition-colors ${
                    r.isIgnoredByUser
                      ? 'opacity-40 bg-slate-950 line-through'
                      : r.severity === 'ERROR'
                      ? 'bg-rose-950/20 hover:bg-rose-950/40'
                      : r.severity === 'WARNING'
                      ? 'bg-amber-950/10 hover:bg-amber-950/30'
                      : 'hover:bg-slate-800/60'
                  }`}
                >
                  <td className="p-3 text-slate-500 font-bold">{idx + 1}</td>
                  <td className="p-3 text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px]">
                      #{r.sourceRow}
                    </span>
                  </td>
                  <td className="p-3 font-sans">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <span>{r.materialMatchedNameAr || r.materialRaw}</span>
                      {r.materialMatchConfidence === 'EXACT_CODE' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                          CODE
                        </span>
                      )}
                      {r.materialMatchConfidence === 'FUZZY_NAME' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                          ALIAS
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {r.materialMatchedCode || r.materialRaw}
                    </div>
                  </td>
                  <td className="p-3 font-sans text-slate-300">{r.supplierMatchedName || r.supplierRaw || '-'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950 text-cyan-300 border border-slate-800">
                      {r.legacyDocType}
                    </span>
                  </td>
                  <td className="p-3 text-end font-bold text-emerald-400">
                    {r.netKG > 0 ? `${r.netKG.toLocaleString()} KG` : '-'}
                  </td>
                  <td className="p-3 text-center font-bold text-amber-400">{r.bulkBags}</td>
                  <td className="p-3 font-sans">
                    <div className="text-slate-300">{r.warehouseNameAr}</div>
                    <div className="text-[10px] font-mono text-slate-400">{r.locationCode}</div>
                  </td>
                  <td className="p-3 font-bold text-white">{r.docRef}</td>
                  <td className="p-3 text-slate-300">{r.date}</td>
                  <td className="p-3 text-center">
                    {r.isIgnoredByUser ? (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                        IGNORED
                      </span>
                    ) : r.severity === 'VALID' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                        VALID
                      </span>
                    ) : r.severity === 'WARNING' ? (
                      <span
                        className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-bold cursor-help"
                        title={r.messages.map((m) => m.text).join(' | ')}
                      >
                        WARNING
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-bold cursor-help"
                        title={r.messages.map((m) => m.text).join(' | ')}
                      >
                        ERROR
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleIgnoreRow(r.id)}
                      className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        r.isIgnoredByUser
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-rose-300 hover:border-rose-500/40'
                      }`}
                      title={r.isIgnoredByUser ? (isRTL ? 'إلغاء التجاهل وتضمين السجل' : 'Include row') : (isRTL ? 'تجاهل هذا السجل' : 'Ignore row')}
                    >
                      {r.isIgnoredByUser ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('VALIDATION')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: التحقق والتدقيق (خطوة 6)' : 'Back to Validation (Step 6)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('INVENTORY_IMPACT')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'المتابعة لتأثير المخزون (خطوة 8)' : 'Proceed to Stock Impact (Step 8)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
