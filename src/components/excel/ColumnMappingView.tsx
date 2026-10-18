import React from 'react';
import {
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  SheetAnalysis,
  ColumnMapping,
  MAPPABLE_FIELDS_LIST,
} from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface ColumnMappingViewProps {
  currentSheet: SheetAnalysis;
  customMappings: ColumnMapping[];
  onUpdateMapping: (colIdx: number, newField: string) => void;
  onApplyCustomMappings: () => void;
  onResetAutoMappings: () => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const ColumnMappingView: React.FC<ColumnMappingViewProps> = ({
  currentSheet,
  customMappings,
  onUpdateMapping,
  onApplyCustomMappings,
  onResetAutoMappings,
  onNavigate,
  isRTL,
}) => {
  const mappedFieldKeys = new Set(customMappings.map((m) => m.mappedField));
  const isMaterialMapped = mappedFieldKeys.has('material') || mappedFieldKeys.has('materialCode');
  const isWeightMapped =
    mappedFieldKeys.has('netKG') ||
    mappedFieldKeys.has('grossKG') ||
    mappedFieldKeys.has('weight') ||
    mappedFieldKeys.has('outputKG');
  const isDocRefMapped = mappedFieldKeys.has('docRef');

  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              STEP 4: COLUMN MAPPING
            </span>
            <span className="text-xs text-slate-400 font-mono">{currentSheet.sheetName}</span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'مطابقة وتعيين أعمدة الإكسل مع حقول النظام المركزية' : 'Column Mapping & Target Association'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'يقوم النظام بالتعرف الآلي على العناوين باللغتين العربية والإنجليزية. يمكنك تعديل تعيين أي عمود أو تخصيص الحقول المستهدفة.'
              : 'Auto-maps Arabic/English headers to system fields. Modify or override target associations below.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onResetAutoMappings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 cursor-pointer transition-all"
            title={isRTL ? 'استعادة التعيينات التلقائية الأصلية' : 'Reset to auto-detected mappings'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'استعادة التلقائي' : 'Reset Auto'}</span>
          </button>

          <button
            type="button"
            onClick={onApplyCustomMappings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تطبيق وإعادة الفحص' : 'Apply & Re-parse'}</span>
          </button>
        </div>
      </div>

      {/* Required Fields Status Badges */}
      <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-sans">
        <span className="text-slate-400 font-bold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isRTL ? 'الحقول التشغيلية الإلزامية:' : 'Required Core Fields:'}</span>
        </span>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
          isMaterialMapped
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/60 border-rose-500/50 text-rose-300 animate-pulse'
        }`}>
          {isMaterialMapped ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          <span>{isRTL ? 'اسم أو رمز المادة' : 'Material Name / Code'}</span>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
          isWeightMapped
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/60 border-rose-500/50 text-rose-300 animate-pulse'
        }`}>
          {isWeightMapped ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          <span>{isRTL ? 'الوزن (صافي/قائم/مثروم)' : 'Weight (Net/Gross/Shredded)'}</span>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${
          isDocRefMapped
            ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
            : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
        }`}>
          {isDocRefMapped ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          <span>{isRTL ? 'رقم المستند / الإشعار' : 'Doc Reference'}</span>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[500px]">
        <table className="w-full text-start text-xs font-mono">
          <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase sticky top-0 z-10">
            <tr>
              <th className="p-3 text-start w-16">#</th>
              <th className="p-3 text-start">{isRTL ? 'عمود Excel المصدر' : 'Excel Source Header'}</th>
              <th className="p-3 text-start font-sans">{isRTL ? 'عينات من البيانات' : 'Sample Data Preview'}</th>
              <th className="p-3 text-start font-sans">{isRTL ? 'الحقل المستهدف في النظام' : 'Target System Field'}</th>
              <th className="p-3 text-center">{isRTL ? 'الأهمية' : 'Requirement'}</th>
              <th className="p-3 text-center">{isRTL ? 'دقة التطابق' : 'Confidence'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {customMappings.map((m) => {
              const targetDef = MAPPABLE_FIELDS_LIST.find((f) => f.field === m.mappedField);
              const isRequired = targetDef?.required || false;
              const sampleVals = (currentSheet.sampleRows || [])
                .map((row) => row[m.colIndex])
                .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
                .slice(0, 3);

              return (
                <tr key={m.colIndex} className="hover:bg-slate-800/60 transition-colors">
                  <td className="p-3 text-slate-500 font-bold">
                    {String.fromCharCode(65 + (m.colIndex % 26))}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-white font-sans">{m.rawHeader || `عمود ${m.colIndex + 1}`}</span>
                      {currentSheet.resolvedHierarchicalHeaders?.find((h) => h.colIndex === m.colIndex)?.isMerged && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
                          {isRTL ? 'مدمج هرمياً' : 'Merged'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">Col #{m.colIndex + 1}</div>
                  </td>
                  <td className="p-3 font-sans">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {sampleVals.length === 0 ? (
                        <span className="text-[10px] text-slate-600 italic">-</span>
                      ) : (
                        sampleVals.map((val, vIdx) => (
                          <span
                            key={vIdx}
                            className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 truncate max-w-[140px]"
                          >
                            {String(val)}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-sans">
                    <select
                      value={m.mappedField}
                      onChange={(e) => onUpdateMapping(m.colIndex, e.target.value)}
                      className={`w-full max-w-xs bg-slate-950 border rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none transition-all cursor-pointer ${
                        m.mappedField !== 'unknown'
                          ? 'border-emerald-500/50 text-emerald-300 focus:border-emerald-400'
                          : 'border-slate-700 text-slate-400 focus:border-cyan-400'
                      }`}
                    >
                      {MAPPABLE_FIELDS_LIST.map((f) => (
                        <option key={f.field} value={f.field} className="bg-slate-900 text-white">
                          {isRTL ? f.labelAr : f.labelEn} {f.required ? '*' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-center">
                    {isRequired ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                        {isRTL ? 'إلزامي' : 'Required'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-400 border border-slate-800">
                        {isRTL ? 'اختياري' : 'Optional'}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        m.confidence >= 80
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : m.confidence >= 50
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-950 text-slate-500 border border-slate-800'
                      }`}
                    >
                      {m.confidence}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('DATA_DETECTION')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: اكتشاف النطاقات (خطوة 3)' : 'Back to Regions (Step 3)'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onApplyCustomMappings();
            onNavigate('MATERIAL_MATCH');
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'المتابعة لمطابقة المواد (خطوة 5)' : 'Proceed to Material Match (Step 5)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
