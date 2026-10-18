import React, { useState, useMemo } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  ArrowRight,
  Printer,
  Calendar,
  Layers,
  Flame,
  Factory,
  Package,
  ShieldCheck,
  Check,
  Search,
  Eye,
  Send,
  X,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { ShiftHandoverRecord } from '../types';

export const ShiftHandoverModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    shiftHandovers,
    addShiftHandover,
    acknowledgeShiftHandover,
    currentUser,
    pendingActions,
    getDailyOperationsSummary,
  } = useFactory();

  // Search & filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'ACKNOWLEDGED'>('ALL');

  // New Handover Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedHandoverForView, setSelectedHandoverForView] = useState<ShiftHandoverRecord | null>(null);
  const [selectedHandoverForAck, setSelectedHandoverForAck] = useState<ShiftHandoverRecord | null>(null);
  const [ackSupervisorName, setAckSupervisorName] = useState(currentUser.nameAr);

  // Form state
  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    date: todayStr,
    shiftFrom: 'صباحية (06:00 - 14:00)',
    shiftTo: 'مسائية (14:00 - 22:00)',
    departingSupervisor: currentUser.nameAr,
    incomingSupervisor: '',
    completedTasks: ['إتمام استلام شحنات الخامات المقررة', 'تشغيل خط البثق رقم 1 وفق جدول الإنتاج'],
    inProgressTasks: ['سحق وتشغيل دفعة سكراب رقم 2 بماكينة الثرم'],
    remainingWork: ['صرف 2 شليف خام لخط التشكيل الحراري'],
    reportedProblems: ['لا توجد بلاغات أعطال حرجة'],
    nextShiftInstructions: 'التأكد من وزن الشليف النهائي قبل ترحيله إلى مستودع المنتجات التامة',
    includeLiveMetrics: true,
  });

  const [taskInputs, setTaskInputs] = useState({
    completed: '',
    inProgress: '',
    remaining: '',
    problem: '',
  });

  // Calculate live daily numbers for auto-fill
  const liveSummary = useMemo(() => {
    return getDailyOperationsSummary(formData.date);
  }, [getDailyOperationsSummary, formData.date]);

  // Filtered list
  const filteredHandovers = useMemo(() => {
    return shiftHandovers.filter((h) => {
      const sTerm = (searchTerm || '').toLowerCase();
      const matchSearch =
        (h.handoverNumber || '').toLowerCase().includes(sTerm) ||
        (h.departingSupervisor || '').toLowerCase().includes(sTerm) ||
        (h.incomingSupervisor || '').toLowerCase().includes(sTerm) ||
        (h.nextShiftInstructions || '').toLowerCase().includes(sTerm);
      const matchStatus = statusFilter === 'ALL' || h.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [shiftHandovers, searchTerm, statusFilter]);

  // Add bullet items
  const addBulletItem = (category: 'completed' | 'inProgress' | 'remaining' | 'problem') => {
    const text = taskInputs[category].trim();
    if (!text) return;

    if (category === 'completed') {
      setFormData((prev) => ({ ...prev, completedTasks: [...prev.completedTasks, text] }));
      setTaskInputs((prev) => ({ ...prev, completed: '' }));
    } else if (category === 'inProgress') {
      setFormData((prev) => ({ ...prev, inProgressTasks: [...prev.inProgressTasks, text] }));
      setTaskInputs((prev) => ({ ...prev, inProgress: '' }));
    } else if (category === 'remaining') {
      setFormData((prev) => ({ ...prev, remainingWork: [...prev.remainingWork, text] }));
      setTaskInputs((prev) => ({ ...prev, remaining: '' }));
    } else if (category === 'problem') {
      setFormData((prev) => ({ ...prev, reportedProblems: [...prev.reportedProblems, text] }));
      setTaskInputs((prev) => ({ ...prev, problem: '' }));
    }
  };

  const removeBulletItem = (category: 'completedTasks' | 'inProgressTasks' | 'remainingWork' | 'reportedProblems', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }));
  };

  // Submit new handover
  const handleSubmitNewHandover = (e: React.FormEvent) => {
    e.preventDefault();

    const newRecord: Partial<ShiftHandoverRecord> = {
      date: formData.date,
      shiftFrom: formData.shiftFrom,
      shiftTo: formData.shiftTo,
      departingSupervisor: formData.departingSupervisor,
      incomingSupervisor: formData.incomingSupervisor.trim() || 'مشرف الوردية القادمة',
      completedTasks: formData.completedTasks,
      inProgressTasks: formData.inProgressTasks,
      remainingWork: formData.remainingWork,
      pendingActionsSummary: `${pendingActions.length} إجراءات أو معاملات تتطلب تدقيق في النظام`,
      reportedProblems: formData.reportedProblems,
      nextShiftInstructions: formData.nextShiftInstructions,
      thermSummary: {
        inputKG: liveSummary.therm.todayInKG,
        outputKG: liveSummary.therm.todayOutKG,
        remainingKG: liveSummary.therm.currentRemainingKG,
      },
      productionSummary: {
        inputKG: liveSummary.production.todayInKG,
        outputKG: liveSummary.production.todayOutKG,
        damageKG: liveSummary.production.currentRemainingKG,
      },
      storageSummary: {
        inKG: liveSummary.storage.todayInKG,
        outKG: liveSummary.storage.todayOutKG,
        balanceKG: liveSummary.storage.currentRemainingKG,
      },
    };

    const res = addShiftHandover(newRecord);
    if (res.success) {
      setIsCreateModalOpen(false);
    }
  };

  // Acknowledge handover
  const handleAcknowledge = () => {
    if (!selectedHandoverForAck) return;
    const res = acknowledgeShiftHandover(selectedHandoverForAck.id, ackSupervisorName);
    if (res.success) {
      setSelectedHandoverForAck(null);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {isRTL ? 'نظام تسليم واستلام الوردية' : 'Shift Handover System'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isRTL
                    ? 'سجل تشغيلي ملزم وموثق: ما تم إنجازه، الجاري تنفيذه، المتبقي، المعلقات، وبلاغات الأعطال'
                    : 'Auditable handover log: completed work, work in progress, remaining, pending, and issues'}
                </p>
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل محضر تسليم وردية جديد' : 'New Shift Handover'}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {isRTL ? 'إجمالي المحاضر الموثقة' : 'Total Handover Records'}
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {shiftHandovers.length}{' '}
            <span className="text-xs font-normal text-slate-500">محضر رسمي</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-xs font-semibold text-emerald-800 mb-1">
            {isRTL ? 'محاضر معتمدة ومستلمة' : 'Acknowledged Handovers'}
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">
            {shiftHandovers.filter((h) => h.status === 'ACKNOWLEDGED').length}{' '}
            <span className="text-xs font-normal text-emerald-600">معتمد</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-xs font-semibold text-amber-800 mb-1">
            {isRTL ? 'بانتظار توقيع المشرف المستلم' : 'Pending Incoming Sign-off'}
          </div>
          <div className="text-2xl font-extrabold text-amber-900">
            {shiftHandovers.filter((h) => h.status === 'SUBMITTED').length}{' '}
            <span className="text-xs font-normal text-amber-700">قيد التسليم</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute top-3 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto" />
          <input
            type="text"
            placeholder={isRTL ? 'بحث برقم المحضر أو اسم المشرف...' : 'Search by record # or supervisor...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs py-2 px-9 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'SUBMITTED', labelAr: 'قيد الاستلام', labelEn: 'Submitted' },
            { id: 'ACKNOWLEDGED', labelAr: 'معتمد', labelEn: 'Acknowledged' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                statusFilter === st.id
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRTL ? st.labelAr : st.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Handover Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right rtl:text-right ltr:text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">{isRTL ? 'رقم المحضر' : 'Handover #'}</th>
                <th className="p-3.5">{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</th>
                <th className="p-3.5">{isRTL ? 'من الوردية' : 'From Shift'}</th>
                <th className="p-3.5">{isRTL ? 'المشرف المسلّم' : 'Departing Supervisor'}</th>
                <th className="p-3.5">{isRTL ? 'المشرف المستلم' : 'Incoming Supervisor'}</th>
                <th className="p-3.5">{isRTL ? 'ملخص العمليات' : 'Operations Yield'}</th>
                <th className="p-3.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                <th className="p-3.5 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredHandovers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    {isRTL ? 'لا توجد محاضر تسليم مطابقة للبحث' : 'No handover records found'}
                  </td>
                </tr>
              ) : (
                filteredHandovers.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-indigo-900">{h.handoverNumber}</td>
                    <td className="p-3.5 text-slate-700">
                      <div>{h.date}</div>
                      <div className="text-[10px] text-slate-400">{h.timestamp}</div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800">
                      <div>{h.shiftFrom}</div>
                      <div className="text-[10px] text-slate-500">إلى: {h.shiftTo}</div>
                    </td>
                    <td className="p-3.5 text-slate-800 font-semibold">{h.departingSupervisor}</td>
                    <td className="p-3.5 text-slate-800 font-semibold">
                      {h.incomingSupervisor || (
                        <span className="text-amber-600 font-normal">بانتظار الاستلام...</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <div className="text-[11px]">
                        ثرم: <span className="font-bold text-slate-800">{h.thermSummary?.outputKG || 0} كغم</span> • 
                        إنتاج: <span className="font-bold text-slate-800">{h.productionSummary?.outputKG || 0} كغم</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {h.completedTasks.length} مهام منجزة • {h.reportedProblems.length} بلاغات
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          h.status === 'ACKNOWLEDGED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {h.status === 'ACKNOWLEDGED' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{isRTL ? 'معتمد ومستلم' : 'Acknowledged'}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>{isRTL ? 'قيد التسليم' : 'Submitted'}</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* View Button */}
                        <button
                          onClick={() => setSelectedHandoverForView(h)}
                          className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          title={isRTL ? 'عرض المحضر التفصيلي' : 'View Details'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Sign-off button if submitted */}
                        {h.status === 'SUBMITTED' && (
                          <button
                            onClick={() => {
                              setSelectedHandoverForAck(h);
                              setAckSupervisorName(currentUser.nameAr);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors"
                            title={isRTL ? 'اعتماد وتوقيع استلام الوردية' : 'Acknowledge Handover'}
                          >
                            <Check className="w-3 h-3" />
                            <span>{isRTL ? 'استلام' : 'Sign-off'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE HANDOVER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="p-5 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-300" />
                <div>
                  <h3 className="font-bold text-base">
                    {isRTL ? 'تحرير محضر تسليم الوردية الرسمي' : 'Draft Official Shift Handover Record'}
                  </h3>
                  <p className="text-xs text-indigo-200">
                    {isRTL
                      ? 'توثيق ملزم للعمليات التشغيلية، الخامات، والمعلقات بين المشرفين'
                      : 'Auditable operational documentation between departing and incoming supervisors'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-indigo-200 hover:text-white hover:bg-indigo-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitNewHandover} className="p-6 overflow-y-auto space-y-6 text-xs">
              {/* Row 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRTL ? 'تاريخ الوردية' : 'Shift Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRTL ? 'الوردية الحالية (المسلّمة)' : 'Departing Shift'}
                  </label>
                  <select
                    value={formData.shiftFrom}
                    onChange={(e) => setFormData({ ...formData, shiftFrom: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  >
                    <option value="صباحية (06:00 - 14:00)">صباحية (06:00 - 14:00)</option>
                    <option value="مسائية (14:00 - 22:00)">مسائية (14:00 - 22:00)</option>
                    <option value="ليلية (22:00 - 06:00)">ليلية (22:00 - 06:00)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRTL ? 'الوردية القادمة (المستلمة)' : 'Incoming Shift'}
                  </label>
                  <select
                    value={formData.shiftTo}
                    onChange={(e) => setFormData({ ...formData, shiftTo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                  >
                    <option value="مسائية (14:00 - 22:00)">مسائية (14:00 - 22:00)</option>
                    <option value="ليلية (22:00 - 06:00)">ليلية (22:00 - 06:00)</option>
                    <option value="صباحية (06:00 - 14:00)">صباحية (06:00 - 14:00)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Supervisors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRTL ? 'المشرف المسلّم' : 'Departing Supervisor'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.departingSupervisor}
                    onChange={(e) => setFormData({ ...formData, departingSupervisor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isRTL ? 'المشرف المستلم المسمى' : 'Incoming Supervisor'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isRTL ? 'اسم مشرف الوردية التالية...' : 'Next shift supervisor name...'}
                    value={formData.incomingSupervisor}
                    onChange={(e) => setFormData({ ...formData, incomingSupervisor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>
              </div>

              {/* Auto-computed Operational Numbers Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isRTL ? 'الحصيلة التشغيلية الرقمية المرفقة بالمحضر' : 'Operational Metrics Attached'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                    <span className="font-bold text-amber-900 block">الثرم (Therm)</span>
                    <span className="text-amber-800">
                      مخرجات: {(liveSummary?.therm?.todayOutKG ?? 0).toLocaleString()} كغم
                    </span>
                  </div>
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <span className="font-bold text-blue-900 block">الإنتاج (Production)</span>
                    <span className="text-blue-800">
                      تام: {(liveSummary?.production?.todayOutKG ?? 0).toLocaleString()} كغم
                    </span>
                  </div>
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-md">
                    <span className="font-bold text-emerald-900 block">المخزن (Storage)</span>
                    <span className="text-emerald-800">
                      رصيد حي: {(liveSummary?.storage?.currentRemainingKG ?? 0).toLocaleString()} كغم
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 1: WHAT WAS COMPLETED */}
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  1. {isRTL ? 'ما تم إنجازه بنجاح بالوردية (Completed Tasks)' : 'What was completed'}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={isRTL ? 'أدخل مهمة مكتملة واضغط إضافة...' : 'Add completed task...'}
                    value={taskInputs.completed}
                    onChange={(e) => setTaskInputs({ ...taskInputs, completed: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulletItem('completed'))}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                  <button
                    type="button"
                    onClick={() => addBulletItem('completed')}
                    className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold"
                  >
                    {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>
                <ul className="space-y-1">
                  {formData.completedTasks.map((t, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-1.5 bg-emerald-50/70 border border-emerald-200 rounded-md text-emerald-900"
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {t}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBulletItem('completedTasks', idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* SECTION 2: WHAT IS IN PROGRESS */}
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  2. {isRTL ? 'ما هو جاري تنفيذه حالياً (In Progress)' : 'What is in progress'}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={isRTL ? 'أدخل عمل جاري تنفيذه...' : 'Add in-progress work...'}
                    value={taskInputs.inProgress}
                    onChange={(e) => setTaskInputs({ ...taskInputs, inProgress: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulletItem('inProgress'))}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                  <button
                    type="button"
                    onClick={() => addBulletItem('inProgress')}
                    className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold"
                  >
                    {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>
                <ul className="space-y-1">
                  {formData.inProgressTasks.map((t, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-1.5 bg-blue-50/70 border border-blue-200 rounded-md text-blue-900"
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        {t}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBulletItem('inProgressTasks', idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* SECTION 3: WHAT IS REMAINING */}
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  3. {isRTL ? 'الأعمال المتبقية المقررة (Remaining Work)' : 'What is remaining'}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={isRTL ? 'أدخل عمل متبقي...' : 'Add remaining work...'}
                    value={taskInputs.remaining}
                    onChange={(e) => setTaskInputs({ ...taskInputs, remaining: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulletItem('remaining'))}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                  <button
                    type="button"
                    onClick={() => addBulletItem('remaining')}
                    className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold"
                  >
                    {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>
                <ul className="space-y-1">
                  {formData.remainingWork.map((t, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-1.5 bg-amber-50/70 border border-amber-200 rounded-md text-amber-900"
                    >
                      <span>• {t}</span>
                      <button
                        type="button"
                        onClick={() => removeBulletItem('remainingWork', idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* SECTION 4: PROBLEMS & ACCIDENTS */}
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  4. {isRTL ? 'المشكلات والأعطال المسجلة (Problems Encountered)' : 'Problems encountered'}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder={isRTL ? 'أدخل بلاغ عطل أو مشكلة (إن وجدت)...' : 'Add issue/accident...'}
                    value={taskInputs.problem}
                    onChange={(e) => setTaskInputs({ ...taskInputs, problem: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBulletItem('problem'))}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2"
                  />
                  <button
                    type="button"
                    onClick={() => addBulletItem('problem')}
                    className="px-3 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold"
                  >
                    {isRTL ? 'إضافة' : 'Add'}
                  </button>
                </div>
                <ul className="space-y-1">
                  {formData.reportedProblems.map((t, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between p-1.5 bg-rose-50/70 border border-rose-200 rounded-md text-rose-900"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        {t}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBulletItem('reportedProblems', idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* SECTION 5: NEXT SHIFT INSTRUCTIONS */}
              <div>
                <label className="font-bold text-slate-900 block mb-1">
                  5. {isRTL ? 'توجيهات وتعليمات المشرف للوردية القادمة (Next Shift Instructions)' : 'Next Shift Instructions'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.nextShiftInstructions}
                  onChange={(e) => setFormData({ ...formData, nextShiftInstructions: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-medium"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>{isRTL ? 'اعتماد وإرسال محضر التسليم' : 'Submit Handover'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACKNOWLEDGE SIGN-OFF MODAL */}
      {selectedHandoverForAck && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isRTL ? 'توقيع واعتماد استلام الوردية' : 'Sign-off Handover Receipt'}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedHandoverForAck.handoverNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isRTL
                ? 'أقر أنا المشرف المستلم بأني اطلعت على كافة المهام المنجزة، الجاري تنفيذها، وحالة الماكينات والمخازن، وأتحمل مسؤولية تشغيل الوردية التالية.'
                : 'I acknowledge receipt of current factory operational state and take full responsibility for next shift execution.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isRTL ? 'اسم المشرف المستلم المعتمد' : 'Acknowledging Supervisor Name'}
              </label>
              <input
                type="text"
                value={ackSupervisorName}
                onChange={(e) => setAckSupervisorName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedHandoverForAck(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleAcknowledge}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>{isRTL ? 'تأكيد الاستلام والاعتماد' : 'Confirm & Sign-off'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {selectedHandoverForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between print:bg-white print:text-black">
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded-md">
                  {selectedHandoverForView.handoverNumber}
                </span>
                <h3 className="font-bold text-lg mt-1">
                  {isRTL ? 'محضر تسليم واستلام الوردية الرسمي' : 'Official Shift Handover Document'}
                </h3>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'طباعة' : 'Print'}</span>
                </button>
                <button
                  onClick={() => setSelectedHandoverForView(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'التاريخ' : 'Date'}</span>
                  <span className="font-bold text-slate-800">{selectedHandoverForView.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'الوردية' : 'Shift'}</span>
                  <span className="font-bold text-slate-800">{selectedHandoverForView.shiftFrom}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'المشرف المسلّم' : 'Departing'}</span>
                  <span className="font-bold text-indigo-900">{selectedHandoverForView.departingSupervisor}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'المشرف المستلم' : 'Incoming'}</span>
                  <span className="font-bold text-emerald-900">{selectedHandoverForView.incomingSupervisor}</span>
                </div>
              </div>

              {/* Tasks Checklist Breakdown */}
              <div className="space-y-4">
                {/* 1. Completed */}
                <div className="p-3 bg-emerald-50/40 border border-emerald-200 rounded-xl">
                  <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>1. {isRTL ? 'ما تم إنجازه بنجاح بالوردية' : 'Completed Tasks'}</span>
                  </h4>
                  <ul className="space-y-1 list-disc list-inside text-emerald-950 font-medium">
                    {selectedHandoverForView.completedTasks.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>

                {/* 2. In Progress */}
                <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl">
                  <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>2. {isRTL ? 'ما هو جاري تنفيذه حالياً' : 'In Progress'}</span>
                  </h4>
                  <ul className="space-y-1 list-disc list-inside text-blue-950 font-medium">
                    {selectedHandoverForView.inProgressTasks.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Remaining */}
                <div className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl">
                  <h4 className="font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>3. {isRTL ? 'الأعمال المتبقية المقررة' : 'Remaining Work'}</span>
                  </h4>
                  <ul className="space-y-1 list-disc list-inside text-amber-950 font-medium">
                    {selectedHandoverForView.remainingWork.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>

                {/* 4. Problems */}
                <div className="p-3 bg-rose-50/40 border border-rose-200 rounded-xl">
                  <h4 className="font-bold text-rose-900 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>4. {isRTL ? 'المشكلات والأعطال المسجلة' : 'Reported Problems'}</span>
                  </h4>
                  <ul className="space-y-1 list-disc list-inside text-rose-950 font-medium">
                    {selectedHandoverForView.reportedProblems.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>

                {/* 5. Next shift instructions */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <h4 className="font-bold text-slate-900 mb-1">
                    5. {isRTL ? 'توجيهات المشرف للوردية القادمة' : 'Next Shift Instructions'}
                  </h4>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {selectedHandoverForView.nextShiftInstructions}
                  </p>
                </div>
              </div>

              {/* Signatures Footer */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 text-center">
                <div className="p-3 border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'المشرف المسلّم' : 'Departing Supervisor'}</span>
                  <span className="font-bold text-slate-900 text-sm mt-1 block">
                    {selectedHandoverForView.departingSupervisor}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                    ✓ {isRTL ? 'موقع ومحرر رسمياً' : 'Signed'}
                  </span>
                </div>

                <div className="p-3 border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'المشرف المستلم' : 'Incoming Supervisor'}</span>
                  <span className="font-bold text-slate-900 text-sm mt-1 block">
                    {selectedHandoverForView.incomingSupervisor}
                  </span>
                  <span className={`text-[10px] font-semibold mt-1 block ${
                    selectedHandoverForView.status === 'ACKNOWLEDGED' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {selectedHandoverForView.status === 'ACKNOWLEDGED'
                      ? `✓ تم الاستلام والاعتماد (${selectedHandoverForView.acknowledgedAt?.slice(0, 10)})`
                      : 'بانتظار توقيع الاستلام'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
