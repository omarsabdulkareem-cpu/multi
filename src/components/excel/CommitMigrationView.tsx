import React from 'react';
import {
  FileCheck,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  RotateCcw,
  EyeOff,
  Database,
  Building2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SheetAnalysis, WorkbookAnalysis } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface CommitMigrationViewProps {
  analysis: WorkbookAnalysis;
  currentSheet: SheetAnalysis;
  sheetStats: {
    total: number;
    valid: number;
    warnings: number;
    errors: number;
    duplicates: number;
    ignored: number;
  };
  currentUser: any;
  onCommit: () => void;
  onIgnoreErrors: () => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  onReset: () => void;
  isRTL: boolean;
}

export const CommitMigrationView: React.FC<CommitMigrationViewProps> = ({
  analysis,
  currentSheet,
  sheetStats,
  currentUser,
  onCommit,
  onIgnoreErrors,
  onNavigate,
  onReset,
  isRTL,
}) => {
  const unignoredRows = currentSheet.dataRows.filter((r) => !r.isIgnoredByUser);
  const totalNetKG = unignoredRows.reduce((acc, r) => acc + (r.netKG || 0), 0);
  const totalBags = unignoredRows.reduce((acc, r) => acc + (r.bulkBags || 0), 0);

  const isReady = sheetStats.errors === 0 && unignoredRows.length > 0;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              STEP 9: FINAL COMMIT GATE
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Batch: {analysis.batchId}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'اعتماد وترحيل البيانات لقاعدة البيانات المركزية' : 'Commit Migration to Factory Database'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'المرحلة الختامية لترحيل البيانات: مراجعة بوابات الأمان، وتثبيت الحركات في سجلات المستودعات وحسابات المصنع.'
              : 'Final migration checkpoint: verify safety checks and commit analyzed records to warehouse balances.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isRTL ? 'إلغاء والبدء من جديد' : 'Cancel & Reset'}</span>
        </button>
      </div>

      {/* Safety Gate Checklist */}
      <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{isRTL ? 'بوابات الأمان والتحقق قبل الاعتماد (Pre-Commit Safety Gates):' : 'Pre-Commit Safety Gates Verification:'}</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {sheetStats.errors === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-slate-300">{isRTL ? 'خلو الدفعة من الأخطاء الحرجة' : 'Zero Critical Errors'}</span>
            </div>
            <span className={`font-mono font-bold ${sheetStats.errors === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {sheetStats.errors === 0 ? (isRTL ? '0 أخطاء' : '0 Errors') : `${sheetStats.errors} ${isRTL ? 'خطأ حرج' : 'Errors'}`}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">{isRTL ? 'سجلات حقيقية جاهزة للترحيل' : 'Ready Transaction Rows'}</span>
            </div>
            <span className="font-mono font-bold text-cyan-400">
              {unignoredRows.length} {isRTL ? 'سجل معتمد' : 'Ready'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">{isRTL ? 'استبعاد القوالب والمجاميع' : 'Isolated Empty Templates & Totals'}</span>
            </div>
            <span className="font-mono font-bold text-emerald-400">
              {currentSheet.ignoredRowsCount} {isRTL ? 'صف معزول' : 'Rows'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">{isRTL ? 'المشرف المسؤول وسجل التدقيق' : 'Audit Trail & Operator'}</span>
            </div>
            <span className="font-mono font-bold text-slate-300">
              {currentUser?.name || 'مدير النظام'}
            </span>
          </div>
        </div>
      </div>

      {/* Migration Batch Manifest */}
      <div className="p-5 rounded-xl bg-slate-950 border border-emerald-500/30 font-mono space-y-4 shadow-inner">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <span className="text-emerald-400 font-bold tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>MIGRATION BATCH MANIFEST</span>
          </span>
          <span className="text-slate-500">
            {new Date().toLocaleDateString('ar-IQ')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'الملف المصدر' : 'Source File'}</div>
            <div className="text-white font-bold mt-0.5 truncate">{analysis.fileName}</div>
          </div>

          <div>
            <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'نوع المستند المصنعي' : 'Document Type'}</div>
            <div className="text-cyan-300 font-bold mt-0.5 truncate">
              {isRTL ? currentSheet.typeTitleAr : currentSheet.typeTitleEn}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'إجمالي الوزن الصافي' : 'Total Net Weight'}</div>
            <div className="text-emerald-400 font-bold text-sm mt-0.5">
              {totalNetKG.toLocaleString()} KG
            </div>
          </div>

          <div>
            <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'إجمالي عدد الشلايف' : 'Total Bulk Bags'}</div>
            <div className="text-amber-300 font-bold text-sm mt-0.5">
              {totalBags} {isRTL ? 'شليف' : 'Bags'}
            </div>
          </div>
        </div>
      </div>

      {/* Error Warning & Action if Errors Exist */}
      {sheetStats.errors > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <span>
              {isRTL
                ? `لا يمكن إتمام الترحيل لوجود ${sheetStats.errors} سجل يحتوي على أخطاء حرجة. يمكنك تجاهل الصفوف غير الصالحة بنقرة واحدة.`
                : `Cannot commit: ${sheetStats.errors} rows contain critical errors. You can ignore them with one click.`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onIgnoreErrors}
              className="px-3 py-1.5 rounded-lg bg-rose-900 hover:bg-rose-800 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{isRTL ? 'تجاهل الصفوف غير الصالحة' : 'Ignore Error Rows'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('VALIDATION')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
            >
              <span>{isRTL ? 'مراجعة الأخطاء' : 'Review Errors'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Big Commit Button */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onCommit}
          disabled={!isReady}
          className="w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-2xl shadow-emerald-950 flex items-center justify-center gap-3 cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed mx-auto"
        >
          <FileCheck className="w-5 h-5" />
          <span>
            {isRTL
              ? `اعتماد وترحيل ${unignoredRows.length} حركة رسمياً إلى قاعدة بيانات المصنع`
              : `Confirm & Commit ${unignoredRows.length} Records to Factory Database`}
          </span>
        </button>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('INVENTORY_IMPACT')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: تأثير المخزون (خطوة 8)' : 'Back to Impact (Step 8)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('DATA_PREVIEW')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-cyan-500/30 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'معاينة جدول الحركات (خطوة 7)' : 'Review Data Table (Step 7)'}</span>
        </button>
      </div>
    </div>
  );
};
