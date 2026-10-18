import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Info,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Boxes,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Bot,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { useTenant } from '../context/TenantContext';
import { SmartInsightsService } from '../services/smart/smartInsightsService';
import { SmartInsightItem } from '../types/smartOperations';

interface SmartInsightsDashboardSectionProps {
  onOpenAssistant?: () => void;
  onOpenFullHub?: () => void;
}

export const SmartInsightsDashboardSection: React.FC<SmartInsightsDashboardSectionProps> = ({
  onOpenAssistant,
  onOpenFullHub,
}) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { setCurrentPage } = useFactory();

  const [isExpanded, setIsExpanded] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [insights, setInsights] = useState<SmartInsightItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadInsights = () => {
    if (!currentOrganization?.id) return;
    setIsLoading(true);
    try {
      const data = SmartInsightsService.generateInsights(currentOrganization.id);
      setInsights(data);
    } catch (e) {
      console.warn('[SmartInsightsSection] Error loading insights:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, [currentOrganization?.id]);

  const criticalCount = insights.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = insights.filter((i) => i.severity === 'WARNING').length;
  const infoCount = insights.filter((i) => i.severity === 'INFO').length;

  const filteredInsights = insights.filter((i) => {
    if (filterSeverity === 'ALL') return true;
    return i.severity === filterSeverity;
  });

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">
                {isRTL ? 'رؤى الذكاء التشغيلي للمستودع (Smart Insights)' : 'Smart Warehouse Intelligence & Insights'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                Phase 13
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'تحليلات ذكية لحظية مبنية على بيانات واقعية مع تمييز دقيق بين الحقائق والتقديرات.'
                : 'Real-time empirical intelligence distinguishing factual stock movements from statistical estimates.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-950 cursor-pointer transition"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isRTL ? 'المساعد الذكي' : 'Warehouse Assistant'}</span>
            </button>
          )}

          {onOpenFullHub && (
            <button
              onClick={onOpenFullHub}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{isRTL ? 'مركز الأتمتة الكامل' : 'Smart Hub'}</span>
            </button>
          )}

          <button
            onClick={loadInsights}
            title={isRTL ? 'تحديث الرؤى' : 'Refresh insights'}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="flex items-center gap-2 pt-3 flex-wrap text-xs">
        <button
          onClick={() => setFilterSeverity('ALL')}
          className={`px-3 py-1 rounded-xl transition cursor-pointer font-bold ${
            filterSeverity === 'ALL'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          {isRTL ? 'الكل' : 'All Insights'} ({insights.length})
        </button>

        <button
          onClick={() => setFilterSeverity('CRITICAL')}
          className={`px-3 py-1 rounded-xl transition cursor-pointer font-bold flex items-center gap-1.5 ${
            filterSeverity === 'CRITICAL'
              ? 'bg-rose-950/80 text-rose-200 border border-rose-500/50'
              : 'bg-slate-950 text-rose-400 hover:bg-rose-950/30 border border-slate-800'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>{isRTL ? 'حرج' : 'Critical'}</span>
          <span className="font-mono bg-rose-900/60 px-1.5 py-0.2 rounded text-[10px]">{criticalCount}</span>
        </button>

        <button
          onClick={() => setFilterSeverity('WARNING')}
          className={`px-3 py-1 rounded-xl transition cursor-pointer font-bold flex items-center gap-1.5 ${
            filterSeverity === 'WARNING'
              ? 'bg-amber-950/80 text-amber-200 border border-amber-500/50'
              : 'bg-slate-950 text-amber-400 hover:bg-amber-950/30 border border-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{isRTL ? 'تنبيه' : 'Warning'}</span>
          <span className="font-mono bg-amber-900/60 px-1.5 py-0.2 rounded text-[10px]">{warningCount}</span>
        </button>

        <button
          onClick={() => setFilterSeverity('INFO')}
          className={`px-3 py-1 rounded-xl transition cursor-pointer font-bold flex items-center gap-1.5 ${
            filterSeverity === 'INFO'
              ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-500/50'
              : 'bg-slate-950 text-cyan-400 hover:bg-cyan-950/30 border border-slate-800'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          <span>{isRTL ? 'إشعار' : 'Info'}</span>
          <span className="font-mono bg-cyan-900/60 px-1.5 py-0.2 rounded text-[10px]">{infoCount}</span>
        </button>
      </div>

      {/* Expanded Content: Cards Grid */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {filteredInsights.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-950 border border-slate-800/80 text-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-white">
                {isRTL ? 'لا توجد تنبيهات تستدعي التدخل الفوري' : 'Zero Active Anomalies in this Category'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isRTL
                  ? 'جميع الأرصدة والشحنات المسجلة ضمن الحدود التشغيلية المعتمدة.'
                  : 'All tracked inventory balances and shipments are currently within normal policy boundaries.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredInsights.slice(0, 6).map((item) => {
                const isCritical = item.severity === 'CRITICAL';
                const isWarning = item.severity === 'WARNING';

                const borderClass = isCritical
                  ? 'border-rose-500/40 bg-gradient-to-br from-slate-950 to-rose-950/20'
                  : isWarning
                  ? 'border-amber-500/40 bg-gradient-to-br from-slate-950 to-amber-950/20'
                  : 'border-cyan-500/30 bg-gradient-to-br from-slate-950 to-cyan-950/20';

                const badgeBg = isCritical
                  ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                  : isWarning
                  ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                  : 'bg-cyan-950 text-cyan-300 border-cyan-500/40';

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border ${borderClass} flex flex-col justify-between gap-3 shadow-md hover:border-slate-700 transition`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${badgeBg}`}>
                          {item.severity}
                        </span>

                        <span className="text-[10px] font-mono text-slate-500">
                          {item.affectedEntityCode || item.affectedEntityType}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-black text-white leading-snug">
                        {isRTL ? item.titleAr : item.titleEn}
                      </h4>

                      {/* Explanation */}
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {isRTL ? item.explanationAr : item.explanationEn}
                      </p>

                      {/* Facts vs Estimates Pill */}
                      <div className="mt-2.5 p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] text-slate-400">
                        <span className="font-bold text-slate-300">
                          {isRTL ? 'الأساس الواقعي:' : 'Factual Basis:'}{' '}
                        </span>
                        <span>{item.factsVsEstimates.factualBasis}</span>
                        {item.factsVsEstimates.assumptions && (
                          <div className="mt-1 text-slate-400 italic">
                            <span className="font-bold text-amber-400/90">
                              {isRTL ? 'الافتراضات المتبعة:' : 'Assumptions:'}{' '}
                            </span>
                            <span>{item.factsVsEstimates.assumptions}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Record Link */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.warehouseName || 'Universal Scope'}
                      </span>

                      <button
                        onClick={() => setCurrentPage(item.linkPage)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition"
                      >
                        <span>{isRTL ? 'عرض السجل' : 'View Record'}</span>
                        {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* More insights prompt */}
          {filteredInsights.length > 6 && (
            <div className="pt-2 text-center">
              <button
                onClick={onOpenFullHub}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                {isRTL
                  ? `عرض جميع الرؤى والتنبيهات المتبقية (${filteredInsights.length - 6} إضافية)...`
                  : `View all remaining insights in Smart Hub (${filteredInsights.length - 6} more)...`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
