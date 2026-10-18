import React, { useState } from 'react';
import {
  X,
  Bot,
  Send,
  Sparkles,
  HelpCircle,
  Table,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileText,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import {
  WarehouseAssistantService,
  AssistantAnswer,
} from '../services/smart/warehouseAssistantService';
import { ReplenishmentRecommendationEngine } from '../services/smart/replenishmentRecommendationEngine';
import { ProposedAssistantAction } from '../types/smartOperations';

interface WarehouseAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  textEn: string;
  textAr: string;
  table?: { headers: string[]; rows: string[][] };
  context?: { warehouseContext?: string; dateRangeContext?: string };
  proposedAction?: ProposedAssistantAction;
  timestamp: string;
}

const SAMPLE_QUERIES = [
  {
    en: 'Which items are below reorder point?',
    ar: 'ما هي الأصناف التي هبطت دون نقطة إعادة الطلب؟',
  },
  {
    en: 'What stock is available in this warehouse?',
    ar: 'ما هو الرصيد الفعلي المتاح في المستودعات؟',
  },
  {
    en: 'Which batches expire this month?',
    ar: 'ما هي الشحنات التي تنتهي صلاحيتها هذا الشهر؟',
  },
  {
    en: 'What was received yesterday?',
    ar: 'ما هي سندات الاستلام المسجلة مؤخراً؟',
  },
  {
    en: 'Which purchase orders are still outstanding?',
    ar: 'ما هي أوامر الشراء المفتوحة والمعلقة؟',
  },
  {
    en: 'Which items had the largest stock variance?',
    ar: 'ما هي الأصناف التي سجلت أكبر فارق في الجرد؟',
  },
];

export const WarehouseAssistantModal: React.FC<WarehouseAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser, showToast } = useFactory();

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-msg',
      sender: 'assistant',
      textEn: `Hello ${currentUser.name || 'Warehouse Lead'}! I am your deterministic Warehouse Operations Assistant. I analyze empirical data from your inventory ledger, purchase orders, cycle counts, and batches. Ask me any warehouse question or select a prompt below.`,
      textAr: `مرحباً ${currentUser.name || 'مسؤول المستودع'}! أنا المساعد التشغيلي للمستودع. أقوم بتحليل البيانات الواقعية الموثقة في سجل حركات المخزون، أوامر الشراء، الجرد، والشحنات. يمكنك طرح أي سؤال أو اختيار أحد النماذج أدناه.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Confirmation state for proposed action
  const [actionConfirming, setActionConfirming] = useState<ProposedAssistantAction | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  if (!isOpen) return null;

  const handleSend = (queryText: string) => {
    const q = queryText.trim();
    if (!q || !currentOrganization?.id) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      textEn: q,
      textAr: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const answer: AssistantAnswer = WarehouseAssistantService.answerQuery(
      currentOrganization.id,
      q
    );

    const assistantMsg: Message = {
      id: `ast-${Date.now()}`,
      sender: 'assistant',
      textEn: answer.textEn,
      textAr: answer.textAr,
      table: answer.dataSummaryTable,
      context: answer.context,
      proposedAction: answer.proposedAction,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputQuery('');
  };

  const handleExecuteConfirmedAction = async () => {
    if (!actionConfirming || !currentOrganization?.id) return;
    setIsExecutingAction(true);

    try {
      if (
        actionConfirming.actionType === 'DRAFT_PURCHASE_REQUEST' &&
        actionConfirming.payload?.recommendation
      ) {
        const result = await ReplenishmentRecommendationEngine.convertToDraftPurchaseRequest(
          currentOrganization.id,
          actionConfirming.payload.recommendation,
          { id: currentUser.id || 'usr_lead', name: currentUser.name || 'Warehouse Lead' }
        );

        showToast(
          isRTL
            ? `تم إنشاء مسودة طلب الشراء بنجاح (#${result.requestNumber})`
            : `Draft Purchase Request created (#${result.requestNumber})`,
          'success'
        );

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-action-${Date.now()}`,
            sender: 'assistant',
            textEn: `Action confirmed: Created draft Purchase Request #${result.requestNumber} for ${actionConfirming.payload.recommendation.itemCode}. Awaiting standard supervisor authorization.`,
            textAr: `تم تأكيد الإجراء: تم إنشاء مسودة طلب شراء #${result.requestNumber} للصنف ${actionConfirming.payload.recommendation.itemCode}. بانتظار الاعتماد الروتيني من المشرف.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (e: any) {
      showToast(e.message || 'Error executing action', 'error');
    } finally {
      setIsExecutingAction(false);
      setActionConfirming(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {isRTL ? 'مساعد العمليات المخزنية الذكي' : 'Warehouse Intelligence Assistant'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>DETERMINISTIC & ZERO-AI-LEAK</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'إجابات موثوقة مبنية على القيود المخزنية الحقيقية دون أي اختلاق للأرقام أو الأسعار.'
                  : 'Empirical query dispatcher strictly grounded in tenant subledgers with zero hallucination.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? (isRTL ? 'flex-row' : 'flex-row-reverse') : ''}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-1">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-br-none shadow-lg'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                  }`}
                >
                  <p className="whitespace-pre-line">{isRTL ? msg.textAr : msg.textEn}</p>

                  {/* Context Note */}
                  {msg.context && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
                        {msg.context.dateRangeContext}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
                        {msg.context.warehouseContext}
                      </span>
                    </div>
                  )}

                  {/* Structured Data Table */}
                  {msg.table && (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                            {msg.table.headers.map((h, idx) => (
                              <th key={idx} className="p-2 font-bold">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-950/60 font-mono">
                          {msg.table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-900/40">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="p-2 whitespace-nowrap text-slate-300">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Proposed Action Card with Safe Confirmation */}
                  {msg.proposedAction && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{isRTL ? msg.proposedAction.titleAr : msg.proposedAction.titleEn}</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {isRTL ? msg.proposedAction.consequencesAr : msg.proposedAction.consequencesEn}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <span className="text-slate-400 font-mono">
                          Qty: {msg.proposedAction.quantities}
                        </span>
                        <button
                          onClick={() => setActionConfirming(msg.proposedAction!)}
                          className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow transition"
                        >
                          {isRTL ? 'مراجعة وتأكيد الإجراء...' : 'Review & Confirm Action...'}
                        </button>
                      </div>
                    </div>
                  )}

                  <span className="block mt-1.5 text-[9px] text-slate-500 text-right font-mono">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Prompt Suggestions Chips */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2 scrollbar-none text-[11px]">
          <span className="text-slate-500 font-bold shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{isRTL ? 'أسئلة مقترحة:' : 'Quick Prompts:'}</span>
          </span>
          {SAMPLE_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(isRTL ? sq.ar : sq.en)}
              className="px-3 py-1 rounded-full bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white whitespace-nowrap cursor-pointer transition"
            >
              {isRTL ? sq.ar : sq.en}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputQuery);
          }}
          className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              isRTL
                ? 'اطرح سؤالاً عن الأرصدة، الشحنات، أوامر الشراء، أو التحويلات...'
                : 'Ask about stock balances, expiring batches, purchase orders, or movements...'
            }
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400 transition"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim()}
            className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white cursor-pointer transition shadow-lg shadow-indigo-950"
          >
            {isRTL ? <ArrowLeft className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {/* Explicit Action Confirmation Modal (Section 11 Safe Action Confirmation) */}
      {actionConfirming && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  {isRTL ? 'تأكيد الإجراء التشغيلي المقترح' : 'Confirm Operational Action'}
                </h3>
                <span className="text-[10px] font-mono text-amber-300">
                  {actionConfirming.actionType}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-bold">
                  {isRTL ? 'السجلات المتأثرة:' : 'Affected Records:'}{' '}
                </span>
                <span className="text-white font-mono">{actionConfirming.affectedRecordsSummary}</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold">
                  {isRTL ? 'الكمية المقترحة:' : 'Proposed Quantities:'}{' '}
                </span>
                <span className="text-amber-400 font-bold font-mono">{actionConfirming.quantities}</span>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 font-bold block mb-1">
                  {isRTL ? 'التبعات والنتائج:' : 'Consequences:'}
                </span>
                <p className="text-slate-300">
                  {isRTL ? actionConfirming.consequencesAr : actionConfirming.consequencesEn}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              {isRTL
                ? 'هذا الإجراء سيقوم بإنشاء مسودة غير معتمدة تتطلب موافقة المشرفين اللاحقة قبل التنفيذ الفعلي.'
                : 'This action creates an unapproved draft that will require subsequent supervisor sign-off.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isExecutingAction}
                onClick={() => setActionConfirming(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                disabled={isExecutingAction}
                onClick={handleExecuteConfirmedAction}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black cursor-pointer shadow-lg transition flex items-center gap-2"
              >
                {isExecutingAction ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isRTL ? 'تأكيد وإنشاء المسودة' : 'Confirm & Create Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
