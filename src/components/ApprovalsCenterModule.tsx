import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  Search,
  Filter,
  FileCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Building2,
  Calendar,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { ApprovalRecord } from '../types';

export const ApprovalsCenterModule: React.FC = () => {
  const { isRTL, t } = useLanguage();
  const { approvals, approveRequest, rejectRequest, currentUser } = useFactory();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRecord | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredApprovals = approvals.filter((appr) => {
    const matchesStatus = statusFilter === 'ALL' || appr.status === statusFilter;
    const matchesSearch =
      appr.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appr.titleAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appr.entityReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appr.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appr.reason.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;
  const approvedCount = approvals.filter((a) => a.status === 'APPROVED').length;
  const rejectedCount = approvals.filter((a) => a.status === 'REJECTED').length;

  const handleApprove = (id: string) => {
    setActionMessage(null);
    const res = approveRequest(id, actionNotes);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: isRTL ? 'تم اعتماد المعاملة وتوثيق التوقيع الرقابي بنجاح' : 'Approved and signed successfully',
      });
      setSelectedApproval(null);
      setActionNotes('');
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || (isRTL ? 'فشل اعتماد المعاملة' : 'Failed to approve'),
      });
    }
  };

  const handleReject = (id: string) => {
    setActionMessage(null);
    if (!actionNotes.trim()) {
      setActionMessage({
        type: 'error',
        text: isRTL ? 'يجب إدخال سبب الرفض في الملاحظات' : 'Rejection reason is required',
      });
      return;
    }

    const res = rejectRequest(id, actionNotes);
    if (res.success) {
      setActionMessage({
        type: 'success',
        text: isRTL ? 'تم رفض المعاملة وتوثيق سبب الرفض في سجل التدقيق' : 'Rejected and logged in audit',
      });
      setSelectedApproval(null);
      setActionNotes('');
    } else {
      setActionMessage({
        type: 'error',
        text: res.error || (isRTL ? 'فشل رفض المعاملة' : 'Failed to reject'),
      });
    }
  };

  const getRiskBadge = (risk: ApprovalRecord['riskLevel']) => {
    switch (risk) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40 animate-pulse">
            {isRTL ? 'مخاطرة حرجة (CRITICAL)' : 'Critical Risk'}
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
            {isRTL ? 'مخاطرة عالية' : 'High Risk'}
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
            {isRTL ? 'مخاطرة متوسطة' : 'Medium Risk'}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {isRTL ? 'عادية' : 'Low Risk'}
          </span>
        );
    }
  };

  const getStatusBadge = (st: ApprovalRecord['status']) => {
    switch (st) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>{isRTL ? 'قيد المراجعة' : 'Pending Review'}</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isRTL ? 'معتمد رسمياً' : 'Approved'}</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>{isRTL ? 'مرفوض' : 'Rejected'}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-indigo-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
              SUPERVISORY AUDIT & WORKFLOW GOVERNANCE
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'مركز صلاحيات واعتامدات المشرفين' : 'Enterprise Approval Hub'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            <span>{isRTL ? 'مركز الموافقات الرقابية وفروقات المخزون' : 'Supervisory Approvals Center'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'اعتماد تسويات الجرد الدوري، شطب هوالك وتالف الإنتاج، وتجاوز حدود الطلب الحرج لضمان عدم التلاعب بالقيود.'
              : 'Approve or reject stock variance write-offs, scrap disposals, and material quota overrides with immutable audit logs.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">{isRTL ? 'طلبات قيد الانتظار: ' : 'Pending: '}</span>
            <span className="text-amber-400 font-bold text-sm">{pendingCount}</span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-bold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* KPI Status Filter Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { id: 'PENDING', label: isRTL ? 'بانتظار الاعتماد' : 'Pending', count: pendingCount, color: 'text-amber-400 border-amber-500/40' },
          { id: 'APPROVED', label: isRTL ? 'المعتمدة' : 'Approved', count: approvedCount, color: 'text-emerald-400 border-emerald-500/40' },
          { id: 'REJECTED', label: isRTL ? 'المرفوضة' : 'Rejected', count: rejectedCount, color: 'text-rose-400 border-rose-500/40' },
          { id: 'ALL', label: isRTL ? 'جميع الطلبات' : 'All Requests', count: approvals.length, color: 'text-slate-400 border-slate-700' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id as any)}
            className={`p-3.5 rounded-xl border text-right transition-all flex items-center justify-between ${
              statusFilter === tab.id
                ? 'bg-slate-800 border-indigo-400 shadow-lg'
                : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <div>
              <div className="text-xs text-slate-400">{tab.label}</div>
              <div className={`text-xl font-black font-mono mt-1 ${tab.color ? tab.color.split(' ')[0] : ''}`}>
                {tab.count}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isRTL ? 'بحث بعنوان الطلب، الكود، مقدم الطلب، أو السبب...' : 'Search approval title, code, applicant, or reason...'}
          className="w-full bg-transparent text-white text-xs placeholder-slate-500 outline-none"
        />
      </div>

      {/* Approvals Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredApprovals.length === 0 ? (
          <div className="lg:col-span-2 p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
            {isRTL ? 'لا توجد طلبات موافقة مطابقة للمعايير المحددة' : 'No approval requests found'}
          </div>
        ) : (
          filteredApprovals.map((appr) => (
            <div
              key={appr.id}
              className={`p-5 rounded-2xl bg-slate-900 border transition-all space-y-4 ${
                appr.status === 'PENDING'
                  ? 'border-indigo-500/40 hover:border-indigo-400 shadow-md'
                  : 'border-slate-800 opacity-80'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getRiskBadge(appr.riskLevel)}
                    <span className="font-mono text-xs text-slate-400">{appr.entityReference}</span>
                  </div>
                  <h4 className="text-base font-bold text-white leading-tight">
                    {isRTL ? appr.titleAr : appr.title}
                  </h4>
                </div>
                <div>{getStatusBadge(appr.status)}</div>
              </div>

              {/* Justification & Details */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                <div className="text-slate-400 font-semibold">{isRTL ? 'المبرر الفني / السبب:' : 'Technical Justification:'}</div>
                <p className="leading-relaxed">{appr.reason}</p>
              </div>

              {/* Request Metadata */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
                <div>
                  <span className="text-slate-500 block">{isRTL ? 'مقدم الطلب:' : 'Applicant:'}</span>
                  <span className="text-white font-bold">{appr.requestedBy}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{isRTL ? 'تاريخ الطلب:' : 'Date:'}</span>
                  <span>{appr.createdAt ? (appr.createdAt.includes('T') ? appr.createdAt.split('T')[0] : appr.createdAt.split(' ')[0]) : '-'}</span>
                </div>
                {appr.reviewedBy && (
                  <div>
                    <span className="text-slate-500 block">{isRTL ? 'المعتمد الرقابي:' : 'Auditor:'}</span>
                    <span className="text-emerald-400 font-bold">{appr.reviewedBy}</span>
                  </div>
                )}
                {appr.notes && (
                  <div className="col-span-2 text-slate-300 border-t border-slate-800/60 pt-1 mt-1">
                    <span className="text-slate-500">{isRTL ? 'ملاحظات الاعتماد: ' : 'Review Notes: '}</span>
                    <span>{appr.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              {appr.status === 'PENDING' && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedApproval(appr)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{isRTL ? 'مراجعة واتخاذ القرار' : 'Review & Decide'}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Decision Review Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-indigo-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <span>{isRTL ? 'اتخاذ القرار الرقابي واعتماد القيد' : 'Auditor Decision Modal'}</span>
              </h3>
              <button
                onClick={() => setSelectedApproval(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'المرجع:' : 'Reference:'}</span>
                <span className="font-mono text-cyan-400 font-bold">{selectedApproval.entityReference}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">{isRTL ? 'عنوان المعاملة:' : 'Title:'}</span>
                <span className="text-white font-bold">{selectedApproval.titleAr}</span>
              </div>
              <div className="border-t border-slate-800 pt-1.5">
                <span className="text-slate-400 block mb-0.5">{isRTL ? 'السبب والمبررات:' : 'Reason:'}</span>
                <p className="text-slate-300 leading-relaxed">{selectedApproval.reason}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'ملاحظات المشرف / سبب الاعتماد أو الرفض:' : 'Auditor Notes / Rejection Reason:'}
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
                placeholder={isRTL ? 'أدخل توجيهات المشرف، رقم المحضر، أو مبررات الرفض...' : 'Enter directive or rejection rationale...'}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleReject(selectedApproval.id)}
                className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>{isRTL ? 'رفض المعاملة' : 'Reject'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleApprove(selectedApproval.id)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRTL ? 'اعتماد المعاملة رسمياً' : 'Approve & Sign'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
