import React from 'react';
import {
  FileText,
  Database,
  ArrowRight,
  Trash2,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { ScaleInDraft } from '../services/scaleInDraftsIndexedDB';

export interface ScaleInDraftBannerProps {
  /** The detected saved draft loaded from IndexedDB (if any) */
  savedDraft: ScaleInDraft | null;
  /** Whether the active form currently has draft saved in IndexedDB */
  hasActiveDraft: boolean;
  /** Timestamp of the most recent auto-save to IndexedDB */
  lastAutoSavedTime: string | null;
  /** Is auto-save in progress */
  isSaving: boolean;
  /** Callback to restore and resume the saved draft into the form */
  onResumeDraft: () => void;
  /** Callback to discard and delete the saved draft from IndexedDB */
  onDiscardDraft: () => void;
  /** Callback for manual save button */
  onManualSaveDraft: () => void;
}

export const ScaleInDraftBanner: React.FC<ScaleInDraftBannerProps> = ({
  savedDraft,
  hasActiveDraft,
  lastAutoSavedTime,
  isSaving,
  onResumeDraft,
  onDiscardDraft,
  onManualSaveDraft,
}) => {
  const { isRTL } = useLanguage();

  return (
    <div className="space-y-3">
      {/* 1. RESTORE BANNER (Appears if an existing saved draft is detected from prior session/refresh) */}
      {savedDraft && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-cyan-950/90 border border-amber-500/50 p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                <Database className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <span>
                      {isRTL
                        ? 'مسودة استمارة ميزان الدخول محفوظة في IndexedDB'
                        : 'Scale-In Form Draft Found in IndexedDB'}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                    {isRTL
                      ? `محفوظة ${savedDraft.displaySavedAt}`
                      : `Saved at ${savedDraft.displaySavedAt}`}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 mt-1">
                  {isRTL
                    ? 'تم استرجاع مدخلات استمارة سابقة من قاعدة بيانات المتصفح بعد تحديث الصفحة. يمكنك استئناف التعبئة فوراً.'
                    : 'A previously partially-filled scale-in ticket was recovered from browser storage. Resume your work anytime.'}
                </p>

                {/* Draft content preview chips */}
                <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-mono">
                  {savedDraft.formData.vehiclePlate && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                      🚚 {savedDraft.formData.vehiclePlate}
                    </span>
                  )}
                  {savedDraft.formData.driverName && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      👤 {savedDraft.formData.driverName}
                    </span>
                  )}
                  {savedDraft.formData.scaleInWeightKG > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300">
                      ⚖️ {savedDraft.formData.scaleInWeightKG.toLocaleString()} KG
                    </span>
                  )}
                  {savedDraft.formData.bulkBagsCount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      📦 {savedDraft.formData.bulkBagsCount} {isRTL ? 'شليف' : 'Bags'}
                    </span>
                  )}
                  {savedDraft.formData.legacyDocumentNumber && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300">
                      📄 {savedDraft.formData.legacyDocumentNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={onResumeDraft}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 via-emerald-600 to-cyan-600 hover:from-amber-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                title={isRTL ? 'استرجاع واستئناف تعبئة المسودة' : 'Resume editing saved draft'}
              >
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{isRTL ? 'استئناف المسودة' : 'Resume Draft'}</span>
              </button>

              <button
                type="button"
                onClick={onDiscardDraft}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/80 border border-slate-700 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title={isRTL ? 'تجاهل وحذف المسودة المحفوظة' : 'Discard draft from IndexedDB'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isRTL ? 'تجاهل' : 'Discard'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. AUTO-SAVE STATUS & MANUAL DRAFT CONTROLS */}
      <div className="px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isSaving
                  ? 'bg-amber-400 animate-ping'
                  : hasActiveDraft
                  ? 'bg-emerald-400'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-[11px] font-medium text-slate-400">
              {isSaving
                ? isRTL
                  ? 'جارٍ الحفظ التلقائي في IndexedDB...'
                  : 'Auto-saving to IndexedDB...'
                : hasActiveDraft && lastAutoSavedTime
                ? isRTL
                  ? `محفوظ تلقائياً في IndexedDB (${lastAutoSavedTime})`
                  : `Auto-saved in IndexedDB (${lastAutoSavedTime})`
                : isRTL
                ? 'الحفظ التلقائي في IndexedDB مفعّل للحماية من تحديث الصفحة'
                : 'IndexedDB Drafts active (protected against refresh)'}
            </span>
          </div>

          <span className="hidden sm:inline text-slate-600">|</span>

          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400/80">
            <Database className="w-3 h-3" />
            <span>AlKarwanReceivingDB / scale_in_drafts</span>
          </span>
        </div>

        {/* Manual Save & Discard Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onManualSaveDraft}
            disabled={isSaving}
            className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition active:scale-95"
            title={isRTL ? 'حفظ فوري للمسودة في IndexedDB' : 'Save draft now to IndexedDB'}
          >
            <Save className="w-3 h-3 text-cyan-400" />
            <span>{isRTL ? 'حفظ كمسودة' : 'Save Draft'}</span>
          </button>

          {hasActiveDraft && (
            <button
              type="button"
              onClick={onDiscardDraft}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
              title={isRTL ? 'مسح المسودة المحفوظة' : 'Clear active draft'}
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>{isRTL ? 'مسح المسودة' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScaleInDraftBanner;
