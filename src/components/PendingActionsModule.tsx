import React, { useState } from 'react';
import {
  AlertOctagon,
  Truck,
  Scale,
  PackageCheck,
  Flame,
  Boxes,
  ArrowRight,
  ArrowLeft,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { PendingAction } from '../types';

export const PendingActionsModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { pendingActions, jumpToPendingAction } = useFactory();

  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredActions = pendingActions.filter((a) => {
    const matchesPriority = priorityFilter === 'ALL' || a.priority === priorityFilter;
    const matchesSearch =
      a.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.legacyRef && a.legacyRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
      a.missingStep.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.missingStepAr.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesPriority && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-rose-950/40 border border-rose-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse">
              WORKFLOW INTEGRITY ENGINE
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'نظام كشف المعاملات العالقة وغير المكتملة' : 'Stalled & Incomplete Transactions Watchdog'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'المعاملات غير المكتملة والإجراءات المعلقة' : 'Pending Actions & Incomplete Workflow Hub'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'الكشف الآلي عن الشاحنات بدون وزن خروج، أو تفريغ غير مؤكد، أو حبيبات مثرومة لم تودع بالمستودع.'
              : 'Auto-detection of missing scale outs, unconfirmed unloads, unrouted receipts, and unstocked regrind.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">{isRTL ? 'إجمالي المعلق:' : 'Total Pending:'} </span>
            <span className="text-rose-400 font-bold text-sm">{pendingActions.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isRTL
                ? 'بحث بالرقم، المادة، المستند (546, 360, 167)، الإجراء المطلوب...'
                : 'Search by Ref, Material, Doc #, Missing Action...'
            }
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-rose-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 shrink-0">{isRTL ? 'الأولوية:' : 'Priority:'}</span>
          {[
            { id: 'ALL', label: isRTL ? 'الكل' : 'All' },
            { id: 'CRITICAL', label: isRTL ? 'حرجة (CRITICAL)' : 'Critical' },
            { id: 'HIGH', label: isRTL ? 'عالية (HIGH)' : 'High' },
            { id: 'MEDIUM', label: isRTL ? 'متوسطة' : 'Medium' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPriorityFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                priorityFilter === p.id
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Items Grid / List */}
      {filteredActions.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">
            {isRTL ? 'جميع المعاملات وسير المواد مكتملة بنسبة 100%' : 'All factory workflows 100% complete!'}
          </h3>
          <p className="text-xs text-slate-400">
            {isRTL ? 'لا توجد شاحنات معلقة أو عمليات ثرم غير مودعة حالياً' : 'No stalled trucks, missing scale-outs, or unstocked regrind.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredActions.map((action) => (
            <div
              key={action.id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      action.priority === 'CRITICAL'
                        ? 'bg-rose-950 text-rose-300 border border-rose-500/50 animate-pulse'
                        : action.priority === 'HIGH'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                        : 'bg-blue-950 text-blue-300 border border-blue-500/50'
                    }`}
                  >
                    {action.priority}
                  </span>

                  <span className="font-mono text-sm font-bold text-white">
                    {action.transactionNumber}
                  </span>

                  {action.legacyRef && (
                    <span className="text-[11px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                      {action.legacyRef}
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {action.createdAt}
                  </span>
                </div>

                <div className="text-sm font-bold text-slate-100">{action.materialName}</div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <div className="text-slate-300">
                    <span className="text-slate-400">{isRTL ? 'الخطوة الناقصة:' : 'Missing Step:'} </span>
                    <span className="text-rose-400 font-bold">
                      {isRTL ? action.missingStepAr : action.missingStep}
                    </span>
                  </div>

                  <div className="text-slate-400">
                    <span>{isRTL ? 'المسؤول:' : 'Assigned:'} </span>
                    <span className="text-cyan-300 font-semibold">{action.responsibleRole}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => jumpToPendingAction(action)}
                  className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>{isRTL ? 'استكمال المعاملة الآن' : 'Resolve Action Now'}</span>
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
