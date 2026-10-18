import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Wand2,
  Search,
  Check,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { MaterialItem } from '../../types';
import { MaterialSmartSuggestion, SheetAnalysis } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface MaterialMatchViewProps {
  currentSheet: SheetAnalysis;
  materials: MaterialItem[];
  smartSuggestions: MaterialSmartSuggestion[];
  onApplySmartSuggestion: (rawMaterialText: string, targetMaterial: MaterialItem, reasonAr?: string) => void;
  onApplyAllHighConfidenceSuggestions: () => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const MaterialMatchView: React.FC<MaterialMatchViewProps> = ({
  currentSheet,
  materials,
  smartSuggestions,
  onApplySmartSuggestion,
  onApplyAllHighConfidenceSuggestions,
  onNavigate,
  isRTL,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'HIGH' | 'RESOLVED'>('ALL');

  const filteredSuggestions = smartSuggestions.filter((sugg) => {
    if (statusFilter === 'PENDING' && sugg.isAlreadyCorrected) return false;
    if (statusFilter === 'RESOLVED' && !sugg.isAlreadyCorrected) return false;
    if (statusFilter === 'HIGH' && sugg.confidence !== 'HIGH') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const raw = (sugg.rawText || '').toLowerCase();
      const targetAr = (sugg.bestMatch?.nameAr || '').toLowerCase();
      const targetEn = (sugg.bestMatch?.nameEn || '').toLowerCase();
      const code = (sugg.bestMatch?.code || '').toLowerCase();
      if (!raw.includes(q) && !targetAr.includes(q) && !targetEn.includes(q) && !code.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
              STEP 5: FUZZY SMART MATCHER
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {smartSuggestions.length} {isRTL ? 'مسميات مواد فريدة في الملف' : 'unique material variants'}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>{isRTL ? 'المطابقة الذكية لمسميات المواد وتصحيح الأخطاء (Fuzzy Matching Engine)' : 'Smart Material Suggest & Fuzzy Matching Engine'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'تستخدم خوارزمية المطابقة الغامضة للتعرف على المسميات المتداولة والمرادفات المصنعية وتصحيح الأخطاء الإملائية وربطها بدليل المواد (Material Master).'
              : 'Leverages fuzzy string matching to detect factory aliases, fix spelling variants, and map Excel names to Material Master.'}
          </p>
        </div>

        {/* Bulk Apply High Confidence Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onApplyAllHighConfidenceSuggestions}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-purple-950 transition-all cursor-pointer active:scale-95"
          >
            <Wand2 className="w-4 h-4 text-purple-200" />
            <span>{isRTL ? '⚡ تطبيق كافة الاقتراحات عالية الدقة دفعة واحدة' : 'Apply All High-Confidence Suggestions'}</span>
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'مسميات مواد بالملف' : 'Unique Excel Materials'}</div>
          <div className="text-lg font-bold text-white mt-0.5">{smartSuggestions.length}</div>
          <div className="text-[10px] text-slate-400 font-sans">{isRTL ? 'أصناف مختلفة' : 'Distinct variants'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'اقتراحات عالية الدقة' : 'High Confidence'}</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">
            {smartSuggestions.filter((s) => s.confidence === 'HIGH').length}
          </div>
          <div className="text-[10px] text-emerald-400/80 font-sans">{isRTL ? 'نسبة تطابق ≥ 75%' : 'Score ≥ 75%'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'بحاجة لمراجعة' : 'Pending Review'}</div>
          <div className="text-lg font-bold text-amber-400 mt-0.5">
            {smartSuggestions.filter((s) => !s.isAlreadyCorrected).length}
          </div>
          <div className="text-[10px] text-amber-400/80 font-sans">{isRTL ? 'بانتظار الاعتماد' : 'Needs confirmation'}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400">{isRTL ? 'تم اعتماده ومطابقته' : 'Matched & Corrected'}</div>
          <div className="text-lg font-bold text-purple-400 mt-0.5">
            {smartSuggestions.filter((s) => s.isAlreadyCorrected).length}
          </div>
          <div className="text-[10px] text-purple-400/80 font-sans">{isRTL ? 'معتمد في النظام' : 'Applied in rows'}</div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث في مسميات المواد أو الرموز...' : 'Search material names or codes...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'PENDING', labelAr: 'بانتظار المراجعة', labelEn: 'Pending' },
            { id: 'HIGH', labelAr: 'عالية الدقة', labelEn: 'High Match' },
            { id: 'RESOLVED', labelAr: 'تم الاعتماد', labelEn: 'Matched' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {isRTL ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[550px] overflow-y-auto pe-1">
        {filteredSuggestions.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-white">{isRTL ? 'لا توجد اقتراحات تطابق البحث' : 'No suggestions match criteria'}</p>
            <p className="text-xs text-slate-500 mt-1">{isRTL ? 'كافة مسميات المواد مطابقة تماماً أو لا توجد نتائج للفلتر' : 'All materials are matched or no items match filter'}</p>
          </div>
        ) : (
          filteredSuggestions.map((sugg, idx) => {
            const isHigh = sugg.confidence === 'HIGH';
            const isMed = sugg.confidence === 'MEDIUM';

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  sugg.isAlreadyCorrected
                    ? 'bg-purple-950/20 border-purple-500/40'
                    : isHigh
                    ? 'bg-slate-950/80 border-slate-800 hover:border-purple-500/50'
                    : 'bg-slate-950/80 border-slate-800 hover:border-amber-500/50'
                }`}
              >
                {/* Header: Raw Text & Occurrences */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'المسمى في ملف الإكسل:' : 'Excel Raw Name:'}</div>
                    <div className="text-sm font-black text-amber-200 mt-0.5 flex items-center gap-1.5">
                      <span>{sugg.rawText}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-900 border border-slate-800 text-slate-300">
                    {sugg.affectedRowsCount} {isRTL ? 'حركة' : 'rows'}
                  </span>
                </div>

                {/* Match Details */}
                <div className="py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400 font-sans">{isRTL ? 'المادة المقترحة بالدليل:' : 'Suggested Master Item:'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans ${
                        sugg.category === 'TYPO_CORRECTION'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : sugg.category === 'FACTORY_ALIAS'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : sugg.category === 'EXACT_CODE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-purple-950 text-purple-300 border border-purple-500/40'
                      }`}>
                        {isRTL ? sugg.matchReasonAr : sugg.matchReasonEn}
                      </span>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isHigh
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : isMed
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      }`}>
                        {sugg.similarityScore}%
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white">{sugg.bestMatch.nameAr}</div>
                      <div className="text-[10px] font-mono text-cyan-400 mt-0.5">
                        {sugg.bestMatch.code} • {sugg.bestMatch.nameEn}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-slate-400 font-mono">
                      {sugg.bestMatch.category}
                    </span>
                  </div>
                </div>

                {/* Action: Accept or Override */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800">
                  <div className="flex-1 max-w-[200px]">
                    <select
                      value={sugg.bestMatch.id}
                      onChange={(e) => {
                        const sel = materials.find((m) => m.id === e.target.value);
                        if (sel) {
                          onApplySmartSuggestion(sugg.rawText, sel, 'اختيار يدوي من المستخدم');
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-purple-400 cursor-pointer"
                    >
                      <option value={sugg.bestMatch.id}>
                        {isRTL ? 'تعديل لمادة أخرى...' : 'Override match...'}
                      </option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} - {m.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApplySmartSuggestion(sugg.rawText, sugg.bestMatch, sugg.matchReasonAr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      sugg.isAlreadyCorrected
                        ? 'bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950 active:scale-95'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {sugg.isAlreadyCorrected
                        ? isRTL ? 'إعادة التطبيق' : 'Re-apply'
                        : isRTL ? 'اعتماد هذا الاقتراح' : 'Accept Suggestion'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Step Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('MAP_COLUMNS')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: مطابقة الأعمدة (خطوة 4)' : 'Back to Mapping (Step 4)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('VALIDATION')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'المتابعة للتحقق والتدقيق (خطوة 6)' : 'Proceed to Validation (Step 6)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
