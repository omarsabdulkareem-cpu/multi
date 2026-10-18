import React from 'react';
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Layers,
  EyeOff,
  TrendingUp,
  FileText,
  Info,
} from 'lucide-react';
import { SheetAnalysis } from '../../services/smartExcelParser';
import { MaterialItem } from '../../types';
import { ImportWorkflowStep } from './excelTypes';

interface ValidationViewProps {
  currentSheet: SheetAnalysis;
  sheetStats: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
    ignored: number;
  };
  unmatchedMaterials: string[];
  materials: MaterialItem[];
  onMapMaterial: (rawName: string, targetMaterial: MaterialItem) => void;
  onIgnoreAllErrors: () => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const ValidationView: React.FC<ValidationViewProps> = ({
  currentSheet,
  sheetStats,
  unmatchedMaterials,
  materials,
  onMapMaterial,
  onIgnoreAllErrors,
  onNavigate,
  isRTL,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              STEP 6: SMART VALIDATION
            </span>
            <span className="text-xs text-slate-400 font-mono">{currentSheet.sheetName}</span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'التحقق والتدقيق الذكي ثلاثي المستويات (3-Tier Validation)' : '3-Tier Validation & Health Check'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'نظام تدقيق مصنعي يفرّق بين السجلات السليمة (VALID)، والتنبيهات المسموح بترحيلها (WARNING)، والأخطاء الحرجة المحظورة (ERROR).'
              : 'Enterprise validation differentiating between valid records, non-blocking warnings, and critical errors.'}
          </p>
        </div>

        {/* Ignore All Errors Button */}
        {sheetStats.errors > 0 && (
          <button
            type="button"
            onClick={onIgnoreAllErrors}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/50 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <EyeOff className="w-4 h-4 text-rose-400" />
            <span>{isRTL ? 'تجاهل الصفوف غير الصالحة بنقرة واحدة' : 'Ignore All Error Rows'}</span>
          </button>
        )}
      </div>

      {/* 5 Validation Breakdown Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'إجمالي الحركات' : 'Total Rows'}</div>
          <div className="text-xl font-bold text-white mt-0.5">{sheetStats.total}</div>
          <div className="text-[10px] text-slate-500 font-sans">{isRTL ? 'في النطاق الفعلي' : 'In active range'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30">
          <div className="text-[11px] font-sans text-emerald-400 flex items-center justify-between">
            <span>{isRTL ? 'سليم ومطابق' : 'Valid (Tier 1)'}</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-0.5">{sheetStats.valid}</div>
          <div className="text-[10px] text-emerald-400/80 font-sans">{isRTL ? 'جاهز للترحيل' : 'Ready to import'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-amber-500/30">
          <div className="text-[11px] font-sans text-amber-400 flex items-center justify-between">
            <span>{isRTL ? 'تنبيهات مسموحة' : 'Warnings (Tier 2)'}</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-amber-300 mt-0.5">{sheetStats.warnings}</div>
          <div className="text-[10px] text-amber-400/80 font-sans">{isRTL ? 'مسموح ترحيلها' : 'Allowed with notice'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-rose-500/30">
          <div className="text-[11px] font-sans text-rose-400 flex items-center justify-between">
            <span>{isRTL ? 'أخطاء حرجة' : 'Errors (Tier 3)'}</span>
            <AlertOctagon className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-rose-300 mt-0.5">{sheetStats.errors}</div>
          <div className="text-[10px] text-rose-400/80 font-sans">{isRTL ? 'تحجب الترحيل' : 'Blocks import'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-500/30">
          <div className="text-[11px] font-sans text-purple-400 flex items-center justify-between">
            <span>{isRTL ? 'مكرر بالنظام' : 'Duplicates'}</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold text-purple-300 mt-0.5">{sheetStats.duplicates}</div>
          <div className="text-[10px] text-purple-400/80 font-sans">{isRTL ? 'إشعارات سابقة' : 'Existing refs'}</div>
        </div>
      </div>

      {/* Explanation of 3-Tier Validation Rules */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
        <h4 className="font-bold text-white flex items-center gap-1.5 font-sans">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isRTL ? 'قواعد التدقيق المصنعي الثلاثية (Validation Hierarchy):' : 'Factory Validation Hierarchy:'}</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300 font-sans">
          <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1">
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>1. المستوى السليم (VALID)</span>
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isRTL
                ? 'مادة مطابقة بدقة، أوزان وكميات رقمية موجبة صالحة، ورقم مستند فريد.'
                : 'Matched material, positive numeric weights/quantities, unique document ref.'}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 space-y-1">
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>2. مستوى التنبيه (WARNING)</span>
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isRTL
                ? 'ملاحظات غير مانعة للترحيل (مثل: مطابقة اسم بالذكاء الاصطناعي، أو رقم مستند مكرر كإشعار).'
                : 'Non-blocking notice (e.g. fuzzy alias applied, duplicate doc reference alert).'}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 space-y-1">
            <span className="font-bold text-rose-400 flex items-center gap-1">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>3. المستوى الحرج (ERROR)</span>
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isRTL
                ? 'حركة تفتقد لاسم المادة تماماً ووزنها صفر. تمنع الترحيل حتى يتم تصحيحها أو النقر على "تجاهل".'
                : 'Completely blank material and zero weights. Blocks commit until fixed or ignored.'}
            </p>
          </div>
        </div>
      </div>

      {/* Unmatched Materials Quick Resolver if any */}
      {unmatchedMaterials.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{isRTL ? 'مواد بحاجة لمطابقة سريعة بالدليل المركزي:' : 'Materials Requiring Quick Mapping:'}</span>
            </div>
            <span className="text-[10px] text-amber-300 font-mono">
              {unmatchedMaterials.length} {isRTL ? 'مادة' : 'items'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unmatchedMaterials.map((rawName, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="text-xs font-bold text-white truncate" title={rawName}>
                  {rawName}
                </div>
                <select
                  onChange={(e) => {
                    const sel = materials.find((m) => m.id === e.target.value);
                    if (sel) onMapMaterial(rawName, sel);
                  }}
                  defaultValue=""
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="" disabled>
                    {isRTL ? 'اختر مادة مطابقة من الدليل...' : 'Select master material...'}
                  </option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('MATERIAL_MATCH')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: مطابقة المواد (خطوة 5)' : 'Back to Material Match (Step 5)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('DATA_PREVIEW')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'المتابعة لمعاينة الحركات (خطوة 7)' : 'Proceed to Data Preview (Step 7)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
