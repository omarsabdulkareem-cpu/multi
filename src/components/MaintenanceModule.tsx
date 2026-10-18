import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  Sliders,
  Calendar,
  User,
  ShieldCheck,
  RotateCcw,
  Zap,
  Activity,
  History,
  TrendingUp,
  AlertOctagon,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  Building,
  DollarSign,
  Tag,
  Check,
  X,
  Edit3,
  Bell,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  FactoryMachine,
  MaintenanceLogTask,
  MaintenanceTaskType,
  MachineStatus,
} from '../types';
import {
  getStoredMachines,
  getStoredMaintenanceLogs,
  addMachineOperatingHours,
  setMachineOperatingThreshold,
  logCompletedMaintenanceTask,
  getMaintenanceAlertsSummary,
  exportMaintenanceReportToExcel,
} from '../services/maintenanceService';
import { PredictiveMaintenanceWidget } from './PredictiveMaintenanceWidget';
import { MaintenanceAlerts } from './MaintenanceAlerts';
import { PredictiveMaintenanceAlertsTrendChart } from './PredictiveMaintenanceAlertsTrendChart';

export const MaintenanceModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const { currentUser, logAudit } = useFactory();

  // State
  const [machines, setMachines] = useState<FactoryMachine[]>(() => getStoredMachines());
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLogTask[]>(() =>
    getStoredMaintenanceLogs()
  );
  const [activeTab, setActiveTab] = useState<'FLEET' | 'ALERTS' | 'PREDICTIVE' | 'LOGS'>('FLEET');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modals state
  const [selectedMachineForTask, setSelectedMachineForTask] = useState<FactoryMachine | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [selectedMachineForThreshold, setSelectedMachineForThreshold] = useState<FactoryMachine | null>(null);
  const [isAddHoursModalOpen, setIsAddHoursModalOpen] = useState(false);
  const [selectedMachineForHours, setSelectedMachineForHours] = useState<FactoryMachine | null>(null);

  // Quick Mark Complete Modal state
  const [isQuickCompleteModalOpen, setIsQuickCompleteModalOpen] = useState(false);
  const [selectedMachineForQuickComplete, setSelectedMachineForQuickComplete] = useState<FactoryMachine | null>(null);
  const [quickTechnician, setQuickTechnician] = useState('');
  const [quickHoursWorked, setQuickHoursWorked] = useState<number>(2);
  const [quickNotes, setQuickNotes] = useState('');

  // Form states for Logging Maintenance Task
  const [taskTitleEn, setTaskTitleEn] = useState('');
  const [taskTitleAr, setTaskTitleAr] = useState('');
  const [taskType, setTaskType] = useState<MaintenanceTaskType>('PREVENTIVE');
  const [performedBy, setPerformedBy] = useState('');
  const [supervisorSignOff, setSupervisorSignOff] = useState(
    `${currentUser.nameAr} (${currentUser.role})`
  );
  const [downtimeHours, setDowntimeHours] = useState(2);
  const [partsReplacedEn, setPartsReplacedEn] = useState('');
  const [partsReplacedAr, setPartsReplacedAr] = useState('');
  const [totalCostUSD, setTotalCostUSD] = useState(0);
  const [taskNotes, setTaskNotes] = useState('');
  const [customNextThreshold, setCustomNextThreshold] = useState<number | ''>('');

  // Form state for Setting Threshold
  const [newThresholdInput, setNewThresholdInput] = useState<number>(2000);
  const [newIntervalInput, setNewIntervalInput] = useState<number>(500);

  // Form state for Adding Hours
  const [hoursToAddInput, setHoursToAddInput] = useState<number>(8);

  // Alert Feedback Banner
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'SUCCESS' | 'WARNING';
    message: string;
  } | null>(null);

  const alertsSummary = getMaintenanceAlertsSummary(machines);

  // Keep supervisor name updated if current user changes
  useEffect(() => {
    setSupervisorSignOff(`${currentUser.nameAr} (${currentUser.role})`);
  }, [currentUser]);

  // Handle Open Log Task Modal
  const openLogTaskModal = (machine?: FactoryMachine) => {
    const target = machine || machines[0];
    setSelectedMachineForTask(target);
    setPerformedBy(target.assignedTechnician);
    setTaskTitleEn(
      target.category === 'SHREDDING'
        ? 'Rotary Blades Sharpening & Bearing Lubrication'
        : target.category === 'EXTRUSION'
        ? 'Hydraulic Oil Flush & Temperature Sensors Recalibration'
        : 'Scheduled Preventive Maintenance & Component Inspection'
    );
    setTaskTitleAr(
      target.category === 'SHREDDING'
        ? 'شحذ سكاكين الدوار وفحص محامل الثرم'
        : target.category === 'EXTRUSION'
        ? 'تبديل زيت الهيدروليك وفحص حساسات حرارة البثق'
        : 'صيانة دورية وقائية وفحص شامل للأجزاء الميكانيكية'
    );
    setTaskType('PREVENTIVE');
    setDowntimeHours(2.5);
    setPartsReplacedEn('');
    setPartsReplacedAr('');
    setTotalCostUSD(150);
    setTaskNotes('');
    setCustomNextThreshold(target.currentOperatingHours + target.intervalHours);
    setIsTaskModalOpen(true);
  };

  // Handle Submit Log Maintenance Task
  const handleSaveCompletedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForTask) return;

    try {
      const result = logCompletedMaintenanceTask({
        machineId: selectedMachineForTask.id,
        taskTitleEn: taskTitleEn.trim() || 'Completed Maintenance Service',
        taskTitleAr: taskTitleAr.trim() || 'صيانة ميكانيكية ووقائية مكتملة',
        taskType,
        downtimeHours: Number(downtimeHours) || 1,
        performedBy: performedBy.trim() || selectedMachineForTask.assignedTechnician,
        supervisorSignOff: supervisorSignOff.trim() || currentUser.nameAr,
        partsReplacedEn: partsReplacedEn.trim(),
        partsReplacedAr: partsReplacedAr.trim(),
        totalCostUSD: Number(totalCostUSD) || 0,
        notesEn: taskNotes.trim(),
        notesAr: taskNotes.trim(),
        customNextThresholdHours:
          typeof customNextThreshold === 'number' && customNextThreshold > 0
            ? customNextThreshold
            : undefined,
      });

      setMachines(result.allMachines);
      setMaintenanceLogs(result.allLogs);

      // Log to system audit trail
      logAudit(
        'Machinery Maintenance Completed',
        'توثيق إنجاز صيانة ماكينة وإعادة ضبط حد الساعات',
        'Machinery',
        result.newTask.id,
        `${selectedMachineForTask.nameAr} (Hours: ${result.newTask.operatingHoursAtService})`,
        `Next Threshold: ${result.updatedMachine.maintenanceThresholdHours} hrs`,
        `Maintenance logged by Supervisor ${currentUser.nameAr}`
      );

      setIsTaskModalOpen(false);
      setFeedbackBanner({
        type: 'SUCCESS',
        message: isRTL
          ? `تم توثيق الصيانة بنجاح للماكينة (${result.updatedMachine.nameAr}). تم تمديد حد الصيانة القادم إلى ${result.updatedMachine.maintenanceThresholdHours} ساعة.`
          : `Maintenance task logged successfully for ${result.updatedMachine.nameEn}. Next maintenance threshold advanced to ${result.updatedMachine.maintenanceThresholdHours} hrs.`,
      });
      setTimeout(() => setFeedbackBanner(null), 5000);
    } catch (err) {
      console.error('Failed to log maintenance task:', err);
    }
  };

  // Handle Set Threshold Modal
  const openThresholdModal = (machine: FactoryMachine) => {
    setSelectedMachineForThreshold(machine);
    setNewThresholdInput(machine.maintenanceThresholdHours);
    setNewIntervalInput(machine.intervalHours);
    setIsThresholdModalOpen(true);
  };

  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForThreshold) return;

    const result = setMachineOperatingThreshold(
      selectedMachineForThreshold.id,
      Number(newThresholdInput),
      Number(newIntervalInput)
    );

    setMachines(result.allMachines);
    logAudit(
      'Machine Threshold Adjusted',
      'تعديل حد ساعات تشغيل الماكينة',
      'Machinery',
      selectedMachineForThreshold.id,
      `${selectedMachineForThreshold.maintenanceThresholdHours} hrs`,
      `${newThresholdInput} hrs (Interval: ${newIntervalInput} hrs)`,
      `Threshold updated by ${currentUser.nameAr}`
    );

    setIsThresholdModalOpen(false);
    setFeedbackBanner({
      type: 'SUCCESS',
      message: isRTL
        ? `تم تحديث حد الصيانة لماكينة (${selectedMachineForThreshold.nameAr}) إلى ${newThresholdInput} ساعة تشغيل.`
        : `Maintenance threshold updated for ${selectedMachineForThreshold.nameEn} to ${newThresholdInput} operating hours.`,
    });
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  // Handle Add Hours / Meter Simulation Modal
  const openAddHoursModal = (machine: FactoryMachine) => {
    setSelectedMachineForHours(machine);
    setHoursToAddInput(8);
    setIsAddHoursModalOpen(true);
  };

  const handleSaveAddedHours = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForHours) return;

    const result = addMachineOperatingHours(
      selectedMachineForHours.id,
      Number(hoursToAddInput),
      currentUser
    );

    setMachines(result.allMachines);

    if (result.statusChangedToDue) {
      setFeedbackBanner({
        type: 'WARNING',
        message: isRTL
          ? `⚠️ تنبيه للمشرف: الماكينة (${result.updatedMachine.nameAr}) تجاوزت حد التشغيل المحدد (${result.updatedMachine.maintenanceThresholdHours} ساعة)! الحالة الآن: واجبة الصيانة.`
          : `⚠️ Supervisor Alert: ${result.updatedMachine.nameEn} has reached its operating hour threshold (${result.updatedMachine.maintenanceThresholdHours} hrs)! Status is now MAINTENANCE DUE.`,
      });
    } else {
      setFeedbackBanner({
        type: 'SUCCESS',
        message: isRTL
          ? `تم تسجيل ${hoursToAddInput} ساعة تشغيل جديدة للماكينة (${result.updatedMachine.nameAr}). الإجمالي الحالي: ${result.updatedMachine.currentOperatingHours} ساعة.`
          : `Logged ${hoursToAddInput} operating hours for ${result.updatedMachine.nameEn}. New total: ${result.updatedMachine.currentOperatingHours} hrs.`,
      });
    }

    logAudit(
      'Machine Hours Logged',
      'تسجيل ساعات تشغيل ماكينة جديدة',
      'Machinery',
      selectedMachineForHours.id,
      `${selectedMachineForHours.currentOperatingHours} hrs`,
      `${result.updatedMachine.currentOperatingHours} hrs (+${hoursToAddInput}h)`,
      `Operating shift hours logged by ${currentUser.nameAr}`
    );

    setIsAddHoursModalOpen(false);
    setTimeout(() => setFeedbackBanner(null), 6000);
  };

  // Handle Quick Mark Complete Modal
  const openQuickCompleteModal = (machine: FactoryMachine) => {
    setSelectedMachineForQuickComplete(machine);
    setQuickTechnician(machine.assignedTechnician || currentUser.nameAr);
    setQuickHoursWorked(2);
    setQuickNotes(
      isRTL
        ? `صيانة وقائية دورية وتشحيم ومعايرة سريعة [${machine.code}]`
        : `Routine preventive inspection & lubrication [${machine.code}]`
    );
    setIsQuickCompleteModalOpen(true);
  };

  const handleSaveQuickComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForQuickComplete) return;

    try {
      const techName = quickTechnician.trim() || selectedMachineForQuickComplete.assignedTechnician;
      const hoursWorked = Number(quickHoursWorked) > 0 ? Number(quickHoursWorked) : 1;
      const noteText = quickNotes.trim() || (isRTL ? 'إنجاز سريع من قائمة الإنذارات المعلقة' : 'Quick completed from pending alert list');

      const result = logCompletedMaintenanceTask({
        machineId: selectedMachineForQuickComplete.id,
        taskTitleEn: `Quick Preventive Maintenance & Check (${selectedMachineForQuickComplete.code})`,
        taskTitleAr: `صيانة وقائية ومعايرة دورية سريعة (${selectedMachineForQuickComplete.code})`,
        taskType: 'PREVENTIVE',
        downtimeHours: hoursWorked,
        performedBy: techName,
        supervisorSignOff: `${currentUser.nameAr} (${currentUser.role})`,
        partsReplacedEn: 'Standard lubrication grease & routine consumable adjustments',
        partsReplacedAr: 'تشحيم قياسي، تنظيف فلاتر وضبط دوري للأجزاء',
        totalCostUSD: 0,
        notesEn: `Quick marked complete directly from pending alert list. Tech: ${techName}, Hours: ${hoursWorked}h. ${noteText}`,
        notesAr: `تم الإنجاز السريع مباشرة من قائمة الإنذارات المعلقة. الفني: ${techName} (${hoursWorked} ساعة عمل). ${noteText}`,
      });

      setMachines(result.allMachines);
      setMaintenanceLogs(result.allLogs);

      logAudit(
        'Quick Maintenance Completed',
        'إنجاز سريع لصيانة ماكينة معلقة وإعادة ضبط حد الساعات',
        'Machinery',
        result.newTask.id,
        `${selectedMachineForQuickComplete.nameAr} (${selectedMachineForQuickComplete.code})`,
        `Tech: ${techName} | Hours Worked: ${hoursWorked}h | New Threshold: ${result.updatedMachine.maintenanceThresholdHours}h`,
        `Supervisor quick sign-off by ${currentUser.nameAr}`
      );

      setIsQuickCompleteModalOpen(false);
      setFeedbackBanner({
        type: 'SUCCESS',
        message: isRTL
          ? `✓ تم إنجاز الصيانة بنجاح للماكينة [${selectedMachineForQuickComplete.code}] ${selectedMachineForQuickComplete.nameAr}. الفني: ${techName} (${hoursWorked} ساعة عمل). تم تمديد حد الصيانة إلى ${result.updatedMachine.maintenanceThresholdHours} ساعة.`
          : `✓ Maintenance marked complete for [${selectedMachineForQuickComplete.code}] ${selectedMachineForQuickComplete.nameEn}. Tech: ${techName} (${hoursWorked}h worked). Next threshold set to ${result.updatedMachine.maintenanceThresholdHours} hrs.`,
      });
      setTimeout(() => setFeedbackBanner(null), 6000);
    } catch (err) {
      console.error('Failed to quick complete maintenance task:', err);
    }
  };

  // Export to Excel
  const handleExportReport = () => {
    const res = exportMaintenanceReportToExcel(machines, maintenanceLogs, currentUser);
    logAudit(
      'Maintenance Ledger Exported',
      'تصدير سجل صيانة الماكينات الشامل إلى ملف إكسل',
      'Machinery',
      res.fileName,
      'Fleet & Logs',
      `Exported ${machines.length} machines and ${res.recordCount} completed task logs`,
      `Export initiated by ${currentUser.nameAr}`
    );
    setFeedbackBanner({
      type: 'SUCCESS',
      message: isRTL
        ? `تم تصدير ملف سجل الصيانة المعتمد (${res.fileName}) بنجاح.`
        : `Successfully exported maintenance report (${res.fileName}).`,
    });
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  // Filtered Machines
  const filteredMachines = machines.filter((m) => {
    const sQuery = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (m.nameEn || '').toLowerCase().includes(sQuery) ||
      (m.nameAr || '').toLowerCase().includes(sQuery) ||
      (m.code || '').toLowerCase().includes(sQuery) ||
      (m.assignedTechnician || '').toLowerCase().includes(sQuery) ||
      (m.sectionAr || '').toLowerCase().includes(sQuery);

    const matchesCategory = categoryFilter === 'ALL' || m.category === categoryFilter;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ALERT'
        ? m.currentOperatingHours >= m.maintenanceThresholdHours ||
          m.currentOperatingHours >= m.maintenanceThresholdHours * 0.9
        : m.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Filtered Logs
  const filteredLogs = maintenanceLogs.filter((log) => {
    const sQuery = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (log.machineNameEn || '').toLowerCase().includes(sQuery) ||
      (log.machineNameAr || '').toLowerCase().includes(sQuery) ||
      (log.taskTitleEn || '').toLowerCase().includes(sQuery) ||
      (log.taskTitleAr || '').toLowerCase().includes(sQuery) ||
      (log.performedBy || '').toLowerCase().includes(sQuery) ||
      (log.id || '').toLowerCase().includes(sQuery);

    const matchesType = typeFilter === 'ALL' || log.taskType === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto text-slate-100 font-sans pb-12">
      {/* Top Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-amber-950/40 border border-amber-500/30 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              {isRTL ? 'إدارة ومتابعة الصيانة الوقائية' : 'PREVENTIVE MAINTENANCE TELEMETRY'}
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'مصنع الكروان للألواح والأكواب' : 'Al-Karwan Factory Plant Floor'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>{isRTL ? 'نظام تتبع صيانة الماكينات والإنذارات' : 'Machinery Maintenance & Hour Threshold Alerts'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
            {isRTL
              ? 'مراقبة تراكم ساعات التشغيل لخطوط البثق، المفارم، ماكينات الأكواب، والضواغط، مع إنذار فوري للمشرفين عند بلوغ حد الصيانة الوقائية وسجل إلكتروني دائم للمهام المنجزة.'
              : 'Real-time telemetry tracking operating hours against maintenance thresholds, automated supervisor alerts when thresholds are reached, and an immutable audit log of completed maintenance tasks.'}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => openLogTaskModal()}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل صيانة منجزة' : 'Log Completed Task'}</span>
          </button>

          <button
            onClick={handleExportReport}
            className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
            title={isRTL ? 'تصدير تقرير الصيانة الشامل بصيغة إكسل' : 'Export Full Maintenance Report to Excel'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'تصدير التقرير (.xlsx)' : 'Export Report (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Floating Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-fadeIn ${
            feedbackBanner.type === 'WARNING'
              ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
              : 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackBanner.type === 'WARNING' ? (
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Supervisor High-Priority Alerts Callout Banner & Pending Alerts List */}
      {alertsSummary.overdueCount > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/70 via-slate-900 to-amber-950/40 border border-rose-500/60 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-rose-500/20">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 bg-rose-600/20 border border-rose-500/50 rounded-xl text-rose-400 shrink-0 animate-pulse">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                    {isRTL ? 'إنذار فوري للمشرف' : 'SUPERVISOR IMMEDIATE ALERT'}
                  </span>
                  <span className="text-xs text-rose-300 font-bold">
                    {alertsSummary.overdueCount}{' '}
                    {isRTL ? 'ماكينات تجاوزت حد ساعات التشغيل' : 'machine(s) exceeded operating threshold'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white mt-1">
                  {isRTL
                    ? 'قائمة إنذارات الصيانة المعلقة (يلزم اتخاذ إجراء أو إنجاز سريع)'
                    : 'Pending Maintenance Alerts List (Action Required / Quick Mark Complete)'}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openLogTaskModal(alertsSummary.overdueMachines[0])}
                className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-slate-400" />
                <span>{isRTL ? 'توثيق صيانة شامل' : 'Full Maintenance Log'}</span>
              </button>
            </div>
          </div>

          {/* Dedicated Pending Maintenance Alert Items List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {alertsSummary.overdueMachines.map((m) => {
              const overdueDelta = m.currentOperatingHours - m.maintenanceThresholdHours;
              return (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-black/50 border border-rose-500/40 hover:border-rose-500/70 transition-all flex flex-col justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-500/50">
                          {m.code}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {isRTL ? m.sectionAr : m.sectionEn}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white mt-1">
                        {isRTL ? m.nameAr : m.nameEn}
                      </h4>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isRTL ? 'الفني المعين:' : 'Assigned Tech:'}</span>
                        <span className="text-slate-200 font-semibold">{m.assignedTechnician}</span>
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse inline-block">
                        +{overdueDelta}h {isRTL ? 'تجاوز الحد' : 'OVERDUE'}
                      </span>
                      <div className="text-xs font-mono font-bold text-white mt-1">
                        {m.currentOperatingHours.toLocaleString()}{' '}
                        <span className="text-slate-400 font-normal">/ {m.maintenanceThresholdHours.toLocaleString()}h</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this pending alert item */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] text-slate-400 font-mono">
                      <span>{isRTL ? 'الحد القادم بعد الإنجاز:' : 'Next Threshold:'}</span>{' '}
                      <span className="text-emerald-400 font-bold">{m.currentOperatingHours + m.intervalHours} hrs</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openLogTaskModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title={isRTL ? 'فتح نموذج التوثيق المفصل (قطع غيار وتكاليف)' : 'Open detailed log form'}
                      >
                        <Wrench className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isRTL ? 'توثيق تفصيلي' : 'Detailed'}</span>
                      </button>

                      {/* QUICK MARK COMPLETE BUTTON */}
                      <button
                        type="button"
                        onClick={() => openQuickCompleteModal(m)}
                        className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/30 flex items-center gap-1.5 cursor-pointer"
                        title={isRTL ? 'إنجاز فوري للصيانة وإعادة ضبط الحد' : 'Quick mark complete and advance threshold'}
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        <span>{isRTL ? 'إنجاز سريع للصيانة' : 'Quick Mark Complete'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Overview Summary (4 Grid Pillars) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Machines */}
        <div className="p-4 rounded-xl bg-[#111218] border border-white/5 relative group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              {isRTL ? 'إجمالي أسطول الماكينات' : 'Machinery Fleet'}
            </span>
            <Building className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-white">
              {machines.length}
            </span>
            <span className="text-xs text-slate-400">{isRTL ? 'وحدة ومعدة' : 'Units'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>{isRTL ? 'تعمل بكفاءة:' : 'Running:'}</span>
            <span className="text-emerald-400 font-bold">{alertsSummary.runningCount}</span>
          </div>
        </div>

        {/* Maintenance Overdue */}
        <div className="p-4 rounded-xl bg-[#111218] border border-white/5 relative group hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              {isRTL ? 'تجاوزت الحد (إنذار)' : 'Maintenance Due'}
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono ${
                alertsSummary.overdueCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-200'
              }`}
            >
              {alertsSummary.overdueCount}
            </span>
            <span className="text-xs text-slate-400">{isRTL ? 'ماكينة' : 'Units'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>{isRTL ? 'بحاجة تدخل عاجل:' : 'Urgent action:'}</span>
            <span className={alertsSummary.overdueCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
              {alertsSummary.overdueCount > 0 ? (isRTL ? 'مطلوب الآن' : 'Required') : (isRTL ? 'لا يوجد' : 'None')}
            </span>
          </div>
        </div>

        {/* Near Threshold Warning */}
        <div className="p-4 rounded-xl bg-[#111218] border border-white/5 relative group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              {isRTL ? 'قاربت حد الصيانة (≥90%)' : 'Near Threshold'}
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
              {alertsSummary.nearThresholdCount}
            </span>
            <span className="text-xs text-slate-400">{isRTL ? 'ماكينة' : 'Units'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>{isRTL ? 'أقل من 50 ساعة متبقية:' : 'Watch window:'}</span>
            <span className="text-amber-400 font-bold">{alertsSummary.nearThresholdCount}</span>
          </div>
        </div>

        {/* Completed Maintenance Tasks Logged */}
        <div className="p-4 rounded-xl bg-[#111218] border border-white/5 relative group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              {isRTL ? 'سجلات الصيانة المكتملة' : 'Completed Tasks'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400">
              {maintenanceLogs.length}
            </span>
            <span className="text-xs text-slate-400">{isRTL ? 'مهمة منجزة' : 'Tasks'}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>{isRTL ? 'سجل موثق ومدقق:' : 'Audit compliant:'}</span>
            <span className="text-emerald-400 font-bold">100% ✓</span>
          </div>
        </div>
      </div>

      {/* Tabs & Filters Navigation Bar */}
      <div className="p-4 rounded-xl bg-[#111218] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Buttons */}
        <div className="flex items-center gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('FLEET')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'FLEET'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>{isRTL ? 'أسطول الماكينات وحدود الساعات' : 'Machinery Fleet & Thresholds'}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                activeTab === 'FLEET' ? 'bg-slate-900 text-amber-300' : 'bg-white/10 text-slate-300'
              }`}
            >
              {machines.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ALERTS')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'ALERTS'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>{isRTL ? 'تنبيهات الصيانة والاستهلاك' : 'Maintenance Alerts'}</span>
            {alertsSummary.overdueCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                {alertsSummary.overdueCount}
              </span>
            ) : (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  activeTab === 'ALERTS' ? 'bg-slate-900 text-cyan-300' : 'bg-white/10 text-slate-300'
                }`}
              >
                LIVE
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'LOGS'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isRTL ? 'سجل مهام الصيانة المنجزة' : 'Completed Maintenance Tasks Log'}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                activeTab === 'LOGS' ? 'bg-slate-900 text-emerald-300' : 'bg-white/10 text-slate-300'
              }`}
            >
              {maintenanceLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('PREDICTIVE')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'PREDICTIVE'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span>{isRTL ? 'الرادار التنبؤي وعمر التشغيل (TTF)' : 'Predictive TTF Radar'}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                activeTab === 'PREDICTIVE' ? 'bg-indigo-950 text-indigo-300' : 'bg-white/10 text-slate-300'
              }`}
            >
              AI
            </span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-2.5 right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'بحث بالاسم، الكود، الفني...' : 'Search machine, code, technician...'}
              className="pr-9 pl-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400 w-48 sm:w-60"
            />
          </div>

          {activeTab === 'FLEET' ? (
            <>
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-400"
              >
                <option value="ALL">{isRTL ? 'كافة الأقسام' : 'All Sections'}</option>
                <option value="EXTRUSION">{isRTL ? 'خطوط البثق' : 'Extrusion'}</option>
                <option value="SHREDDING">{isRTL ? 'الثرم والجرش 360' : 'Shredding 360'}</option>
                <option value="THERMOFORMING">{isRTL ? 'تشكيل الأكواب' : 'Thermoforming'}</option>
                <option value="UTILITY">{isRTL ? 'المرافق والضواغط' : 'Utilities & Compressors'}</option>
                <option value="SCALE">{isRTL ? 'ميزان الشاحنات 546' : 'Weighbridge 546'}</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-amber-400"
              >
                <option value="ALL">{isRTL ? 'كافة الحالات' : 'All Statuses'}</option>
                <option value="ALERT">{isRTL ? 'تنبيهات الصيانة (إنذار)' : 'Maintenance Alerts'}</option>
                <option value="RUNNING">{isRTL ? 'تعمل بشكل طبيعي' : 'Running Normal'}</option>
                <option value="UNDER_MAINTENANCE">{isRTL ? 'قيد الصيانة حالياً' : 'Under Maintenance'}</option>
              </select>
            </>
          ) : (
            /* Task Type Filter for Logs */
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-slate-200 outline-none focus:border-emerald-400"
            >
              <option value="ALL">{isRTL ? 'كافة أنواع الصيانة' : 'All Task Types'}</option>
              <option value="PREVENTIVE">{isRTL ? 'صيانة وقائية دورية' : 'Preventive'}</option>
              <option value="CORRECTIVE">{isRTL ? 'صيانة تصحيحية/إصلاح' : 'Corrective'}</option>
              <option value="LUBRICATION">{isRTL ? 'تشحيم وتزييت' : 'Lubrication'}</option>
              <option value="CALIBRATION">{isRTL ? 'معايرة وموازنة' : 'Calibration'}</option>
              <option value="OVERHAUL">{isRTL ? 'عمرة شاملة' : 'Overhaul'}</option>
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: FLEET & THRESHOLDS VIEW */}
      {activeTab === 'FLEET' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.map((machine) => {
            const isOverdue = machine.currentOperatingHours >= machine.maintenanceThresholdHours;
            const isNearThreshold =
              !isOverdue && machine.currentOperatingHours >= machine.maintenanceThresholdHours * 0.9;
            const hoursRemaining = machine.maintenanceThresholdHours - machine.currentOperatingHours;
            const progressPct = Math.min(
              100,
              Math.round((machine.currentOperatingHours / machine.maintenanceThresholdHours) * 100)
            );

            return (
              <div
                key={machine.id}
                className={`rounded-2xl bg-[#111218] border p-5 transition-all shadow-lg flex flex-col justify-between relative overflow-hidden ${
                  isOverdue
                    ? 'border-rose-500/60 bg-gradient-to-b from-rose-950/20 to-[#111218] shadow-rose-950/30'
                    : isNearThreshold
                    ? 'border-amber-500/50 bg-gradient-to-b from-amber-950/15 to-[#111218]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Status Beacon in Corner */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/5 border border-white/10 text-cyan-300">
                        {machine.code}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {machine.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1 leading-tight">
                      {isRTL ? machine.nameAr : machine.nameEn}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {isRTL ? machine.sectionAr : machine.sectionEn}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isOverdue ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        {isRTL ? 'واجبة الصيانة فورا' : 'MAINTENANCE DUE'}
                      </span>
                    ) : isNearThreshold ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {isRTL ? 'قريبة من الحد' : 'NEAR THRESHOLD'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" />
                        {isRTL ? 'تعمل بكفاءة' : 'RUNNING OK'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Operating Hour Gauge & Threshold Progress */}
                <div className="my-3 p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {isRTL ? 'ساعات التشغيل الحالية' : 'Current Operating Hours'}
                    </span>
                    <span className="font-mono text-sm font-black text-white">
                      {machine.currentOperatingHours.toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        / {machine.maintenanceThresholdHours.toLocaleString()} hrs
                      </span>
                    </span>
                  </div>

                  {/* Visual Bar Indicator */}
                  <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isOverdue
                          ? 'bg-rose-500'
                          : isNearThreshold
                          ? 'bg-gradient-to-r from-amber-500 to-rose-400'
                          : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Remaining or Overdue Delta */}
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">
                      {isRTL ? 'دورة التكرار:' : 'Cycle Interval:'} كل {machine.intervalHours} س
                    </span>
                    <span
                      className={`font-bold ${
                        isOverdue
                          ? 'text-rose-400'
                          : isNearThreshold
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {isOverdue
                        ? isRTL
                          ? `+${Math.abs(hoursRemaining)} ساعة متأخرة!`
                          : `+${Math.abs(hoursRemaining)}h overdue!`
                        : isRTL
                        ? `متبقي ${hoursRemaining} ساعة`
                        : `${hoursRemaining}h remaining`}
                    </span>
                  </div>

                  {/* Quick Predictive TTF preview */}
                  <div className="flex items-center justify-between text-[11px] font-mono pt-1.5 border-t border-white/5">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span>{isRTL ? 'زمن التوقف المقدر (TTF):' : 'Est. Time-to-Failure:'}</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('PREDICTIVE')}
                      className="text-indigo-300 hover:text-indigo-200 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      title={isRTL ? 'فتح الرادار التنبؤي' : 'Open Predictive Radar'}
                    >
                      {hoursRemaining <= 0 ? (
                        <span className="text-rose-400 font-bold animate-pulse">
                          {isRTL ? '< 4 ساعات (حرج)' : '< 4h (Critical)'}
                        </span>
                      ) : (
                        <span>~{Math.round(hoursRemaining + machine.intervalHours * 0.08)}h</span>
                      )}
                      <ArrowUpRight className="w-3 h-3 text-indigo-400" />
                    </button>
                  </div>
                </div>

                {/* Machine Details Specs */}
                <div className="space-y-1.5 text-xs text-slate-300 mb-4 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans">{isRTL ? 'الفني المسؤول:' : 'Technician:'}</span>
                    <span className="text-slate-200 font-sans font-semibold">
                      {machine.assignedTechnician}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans">{isRTL ? 'آخر صيانة منجزة:' : 'Last Service:'}</span>
                    <span className="text-slate-300">
                      {machine.lastMaintenanceDate} ({machine.lastMaintenanceHours}h)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans">{isRTL ? 'المصنّع والموديل:' : 'Manufacturer:'}</span>
                    <span className="text-slate-400 truncate max-w-[180px]">
                      {machine.manufacturer} ({machine.modelNumber})
                    </span>
                  </div>
                </div>

                {/* Machine Card Action Buttons */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    {isOverdue && (
                      <button
                        onClick={() => openQuickCompleteModal(machine)}
                        className="px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md hover:shadow-emerald-500/30 transition-all flex items-center gap-1 cursor-pointer"
                        title={isRTL ? 'إنجاز سريع للصيانة وإعادة ضبط الحد' : 'Quick Mark Complete'}
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                        <span>{isRTL ? 'إنجاز سريع' : 'Quick Mark'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => openLogTaskModal(machine)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isOverdue
                          ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                          : 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'توثيق صيانة' : 'Log Service'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Add Hours (Meter Simulation / Shift update) */}
                    <button
                      onClick={() => openAddHoursModal(machine)}
                      className="px-2.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition-colors"
                      title={isRTL ? 'تسجيل ساعات تشغيل للماكينة' : 'Add Operating Hours'}
                    >
                      + {isRTL ? 'ساعات' : 'Hours'}
                    </button>

                    {/* Set Threshold button */}
                    <button
                      onClick={() => openThresholdModal(machine)}
                      className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
                      title={isRTL ? 'تعديل حد ساعات الصيانة' : 'Adjust Hour Threshold'}
                    >
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: COMPLETED MAINTENANCE TASKS LOG VIEW */}
      {activeTab === 'LOGS' && (
        <div className="rounded-2xl bg-[#111218] border border-white/10 shadow-2xl overflow-hidden">
          <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {isRTL
                  ? 'السجل الإلكتروني الشامل لمهام الصيانة المنجزة'
                  : 'Forensic Register of Completed Machinery Maintenance'}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {filteredLogs.length} {isRTL ? 'مهمة مسجلة' : 'tasks recorded'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs font-mono">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-white/5">
                  <th className="p-3.5 text-start">{isRTL ? 'رقم السجل' : 'Log ID'}</th>
                  <th className="p-3.5 text-start">{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</th>
                  <th className="p-3.5 text-start font-sans">{isRTL ? 'الماكينة' : 'Machine'}</th>
                  <th className="p-3.5 text-start font-sans">{isRTL ? 'بيان مهمة الصيانة' : 'Maintenance Task'}</th>
                  <th className="p-3.5 text-start">{isRTL ? 'نوع الصيانة' : 'Task Type'}</th>
                  <th className="p-3.5 text-start">{isRTL ? 'ساعات الخدمة' : 'Service Hours'}</th>
                  <th className="p-3.5 text-start">{isRTL ? 'الحد الجديد' : 'New Threshold'}</th>
                  <th className="p-3.5 text-start font-sans">{isRTL ? 'المنفذ والمشرف' : 'Technician & Sign-off'}</th>
                  <th className="p-3.5 text-start">{isRTL ? 'التوقف' : 'Downtime'}</th>
                  <th className="p-3.5 text-start font-sans">{isRTL ? 'القطع المستبدلة والملاحظات' : 'Parts & Notes'}</th>
                  <th className="p-3.5 text-end">{isRTL ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 text-cyan-400 font-bold">{log.id}</td>
                    <td className="p-3.5 text-slate-300">
                      <div>{log.completedDate}</div>
                      <div className="text-[10px] text-slate-500">{log.completedTime}</div>
                    </td>
                    <td className="p-3.5 font-sans">
                      <div className="font-bold text-white">{isRTL ? log.machineNameAr : log.machineNameEn}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">{log.machineId}</div>
                    </td>
                    <td className="p-3.5 font-sans text-slate-200 font-semibold max-w-xs">
                      {isRTL ? log.taskTitleAr : log.taskTitleEn}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.taskType === 'PREVENTIVE'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : log.taskType === 'CORRECTIVE'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            : log.taskType === 'LUBRICATION'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        }`}
                      >
                        {log.taskType}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-200 font-bold">
                      {log.operatingHoursAtService.toLocaleString()} hrs
                    </td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">
                      {log.newThresholdHours.toLocaleString()} hrs
                    </td>
                    <td className="p-3.5 font-sans">
                      <div className="text-white font-medium">{log.performedBy}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>{log.supervisorSignOff}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {log.downtimeHours} {isRTL ? 'ساعة' : 'hrs'}
                    </td>
                    <td className="p-3.5 font-sans text-slate-300 text-[11px] max-w-sm">
                      <div className="text-slate-200">{isRTL ? log.partsReplacedAr : log.partsReplacedEn}</div>
                      {log.notesAr && <div className="text-slate-400 text-[10px] mt-0.5">{log.notesAr}</div>}
                    </td>
                    <td className="p-3.5 text-end">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        VERIFIED ✓
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MAINTENANCE ALERTS & EQUIPMENT USAGE MONITOR */}
      {activeTab === 'ALERTS' && (
        <MaintenanceAlerts
          onNavigateToFullMaintenance={() => setActiveTab('FLEET')}
        />
      )}

      {/* TAB 3: AI PREDICTIVE MAINTENANCE & TIME-TO-FAILURE RADAR */}
      {activeTab === 'PREDICTIVE' && (
        <div className="space-y-6">
          {/* Visual Recharts Graph: 30-Day Predictive Maintenance Alerts & Wear Patterns */}
          <PredictiveMaintenanceAlertsTrendChart />

          <PredictiveMaintenanceWidget
            onMachineryUpdated={() => {
              setMachines(getStoredMachines());
              setMaintenanceLogs(getStoredMaintenanceLogs());
            }}
          />
        </div>
      )}

      {/* MODAL 1: LOG COMPLETED MAINTENANCE TASK */}
      {isTaskModalOpen && selectedMachineForTask && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#13151f] border border-amber-500/40 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'تسجيل وتوثيق مهمة صيانة مكتملة' : 'Log Completed Maintenance Task'}
                  </h3>
                  <div className="text-xs text-slate-400">
                    {isRTL ? selectedMachineForTask.nameAr : selectedMachineForTask.nameEn} (
                    {selectedMachineForTask.code})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompletedTask} className="space-y-4 text-xs">
              {/* Machine Selection & Operating Hours Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'الماكينة المستهدفة:' : 'Target Machine:'}
                  </label>
                  <select
                    value={selectedMachineForTask.id}
                    onChange={(e) => {
                      const found = machines.find((m) => m.id === e.target.value);
                      if (found) {
                        setSelectedMachineForTask(found);
                        setCustomNextThreshold(found.currentOperatingHours + found.intervalHours);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  >
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.code}] {isRTL ? m.nameAr : m.nameEn} ({m.currentOperatingHours} hrs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'ساعات التشغيل عند إنجاز الصيانة:' : 'Operating Hours at Service:'}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${selectedMachineForTask.currentOperatingHours} hrs`}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Task Title (Arabic & English) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'بيان الصيانة المنجزة (عربي):' : 'Task Title (Arabic):'}
                  </label>
                  <input
                    type="text"
                    required
                    value={taskTitleAr}
                    onChange={(e) => setTaskTitleAr(e.target.value)}
                    placeholder="مثال: تبديل زيت الهيدروليك وفحص حساسات الحرارة"
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'بيان الصيانة (إنجليزي):' : 'Task Title (English):'}
                  </label>
                  <input
                    type="text"
                    required
                    value={taskTitleEn}
                    onChange={(e) => setTaskTitleEn(e.target.value)}
                    placeholder="e.g., Hydraulic Oil & Filter Replacement"
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Type, Downtime, Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'نوع الصيانة:' : 'Task Type:'}
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as MaintenanceTaskType)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  >
                    <option value="PREVENTIVE">{isRTL ? 'وقائية دورية (Preventive)' : 'Preventive'}</option>
                    <option value="CORRECTIVE">{isRTL ? 'تصحيحية وإصلاح (Corrective)' : 'Corrective'}</option>
                    <option value="LUBRICATION">{isRTL ? 'تشحيم وتزييت (Lubrication)' : 'Lubrication'}</option>
                    <option value="CALIBRATION">{isRTL ? 'معايرة وضبط (Calibration)' : 'Calibration'}</option>
                    <option value="OVERHAUL">{isRTL ? 'عمرة شاملة (Overhaul)' : 'Overhaul'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'زمن التوقف (بالساعات):' : 'Downtime (Hours):'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={downtimeHours}
                    onChange={(e) => setDowntimeHours(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'التكلفة الإجمالية (USD):' : 'Total Cost (USD):'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={totalCostUSD}
                    onChange={(e) => setTotalCostUSD(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* Technician and Supervisor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'الفني المنفذ:' : 'Performed By (Technician):'}
                  </label>
                  <input
                    type="text"
                    required
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'اعتماد المشرف المسؤول:' : 'Supervisor Sign-off:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={supervisorSignOff}
                    onChange={(e) => setSupervisorSignOff(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400 font-semibold text-emerald-300"
                  />
                </div>
              </div>

              {/* Parts replaced */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'القطع والمواد المستبدلة (عربي):' : 'Parts & Consumables Replaced (AR):'}
                  </label>
                  <input
                    type="text"
                    value={partsReplacedAr}
                    onChange={(e) => setPartsReplacedAr(e.target.value)}
                    placeholder="مثال: فلتر زيت هيدروليك 10 ميكرون، زيت موبيل 68"
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {isRTL ? 'القطع والمواد المستبدلة (إنجليزي):' : 'Parts & Consumables Replaced (EN):'}
                  </label>
                  <input
                    type="text"
                    value={partsReplacedEn}
                    onChange={(e) => setPartsReplacedEn(e.target.value)}
                    placeholder="e.g., Hydraulic Filter 10-micron, Mobil Oil 68"
                    className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* New Threshold Setting (Crucial: advances the threshold so machine is no longer overdue) */}
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {isRTL
                      ? 'إعادة تعيين حد الصيانة القادمة تلقائياً:'
                      : 'Automatic Next Threshold Advancement:'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {isRTL ? 'إضافة دورة' : 'Interval'}: +{selectedMachineForTask.intervalHours} hrs
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={customNextThreshold}
                    onChange={(e) =>
                      setCustomNextThreshold(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-48 px-3 py-1.5 bg-slate-900 border border-emerald-500/40 rounded-lg text-emerald-300 font-mono font-bold text-sm outline-none"
                  />
                  <span className="text-[11px] text-slate-300">
                    {isRTL
                      ? 'ساعة تشغيل (سيتم تحديث حالة الماكينة إلى "تعمل بكفاءة" وإلغاء الإنذار)'
                      : 'operating hours (resets machine status to Running & clears alert)'}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isRTL ? 'الملاحظات الفنية ونتائج الفحص:' : 'Technical Observations & Notes:'}
                </label>
                <textarea
                  rows={2}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'تم فحص الماكينة والتأكد من استقرار الضغوط والحرارة بدون أي تسريب...'
                      : 'All pressures and temperatures verified stable...'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none focus:border-amber-400"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isRTL ? 'حفظ الصيانة واعتماد السجل' : 'Save & Sign-off Task'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: SET MACHINE OPERATING THRESHOLD */}
      {isThresholdModalOpen && selectedMachineForThreshold && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13151f] border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {isRTL ? 'ضبط حد ساعات الصيانة' : 'Set Hour Threshold'}
                </h3>
              </div>
              <button
                onClick={() => setIsThresholdModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {isRTL ? selectedMachineForThreshold.nameAr : selectedMachineForThreshold.nameEn} (
              {selectedMachineForThreshold.code})
            </p>

            <form onSubmit={handleSaveThreshold} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isRTL ? 'ساعات التشغيل الحالية للماكينة:' : 'Current Operating Hours:'}
                </label>
                <div className="p-2.5 bg-black/40 rounded-xl font-mono text-cyan-300 font-bold">
                  {selectedMachineForThreshold.currentOperatingHours} hrs
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isRTL ? 'حد الصيانة الجديد (بالساعات):' : 'New Maintenance Threshold (Hours):'}
                </label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  required
                  value={newThresholdInput}
                  onChange={(e) => setNewThresholdInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white font-mono text-base font-bold outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {isRTL
                    ? 'سيتم إطلاق إنذار للمشرف فور وصول الماكينة إلى هذا الرقم.'
                    : 'A supervisor alert will fire immediately when hours reach this threshold.'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isRTL ? 'دورة التكرار المعتمدة (بالساعات):' : 'Recurring Cycle Interval (Hours):'}
                </label>
                <select
                  value={newIntervalInput}
                  onChange={(e) => setNewIntervalInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-amber-400 font-mono"
                >
                  <option value={250}>Every 250 hrs (Quarterly Light)</option>
                  <option value={300}>Every 300 hrs (Granulator/Shredder standard)</option>
                  <option value={500}>Every 500 hrs (Extrusion & Thermoforming standard)</option>
                  <option value={1000}>Every 1000 hrs (Air Compressors standard)</option>
                  <option value={2000}>Every 2000 hrs (Annual Major)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsThresholdModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold"
                >
                  {isRTL ? 'حفظ وتحديث الحد' : 'Save Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD OPERATING HOURS (METER SIMULATION) */}
      {isAddHoursModalOpen && selectedMachineForHours && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#13151f] border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {isRTL ? 'تسجيل ساعات تشغيل إضافية' : 'Log Shift Operating Hours'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddHoursModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {isRTL ? selectedMachineForHours.nameAr : selectedMachineForHours.nameEn} (
              {selectedMachineForHours.code})
            </p>

            <form onSubmit={handleSaveAddedHours} className="space-y-4 text-xs">
              <div className="p-3 bg-black/40 rounded-xl font-mono flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'العداد الحالي:' : 'Current Meter:'}</span>
                <span className="text-white font-bold text-sm">
                  {selectedMachineForHours.currentOperatingHours} hrs
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isRTL ? 'الساعات الإضافية المراد تسجيلها:' : 'Hours to Add (Shift Log):'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={hoursToAddInput}
                  onChange={(e) => setHoursToAddInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white font-mono text-base font-bold outline-none focus:border-cyan-400"
                />

                {/* Quick Presets */}
                <div className="flex gap-2 mt-2">
                  {[8, 16, 24, 50].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoursToAddInput(h)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/10 rounded text-[11px] font-mono font-bold"
                    >
                      +{h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview calculation */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 font-mono text-[11px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{isRTL ? 'العداد الجديد المتوقع:' : 'New Expected Meter:'}</span>
                  <span className="text-cyan-300 font-bold">
                    {selectedMachineForHours.currentOperatingHours + Number(hoursToAddInput)} hrs
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{isRTL ? 'حد الصيانة المحدد:' : 'Set Threshold:'}</span>
                  <span>{selectedMachineForHours.maintenanceThresholdHours} hrs</span>
                </div>
                {selectedMachineForHours.currentOperatingHours + Number(hoursToAddInput) >=
                  selectedMachineForHours.maintenanceThresholdHours && (
                  <div className="text-rose-400 font-bold pt-1 border-t border-white/10 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {isRTL
                        ? 'سيتم تفعيل إنذار المشرف تلقائياً!'
                        : 'Threshold will be reached: Supervisor alert will fire!'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddHoursModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg"
                >
                  {isRTL ? 'تأكيد وحفظ الساعات' : 'Confirm & Log Hours'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: QUICK MARK COMPLETE (Small, Fast Form) */}
      {isQuickCompleteModalOpen && selectedMachineForQuickComplete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#13151f] border border-emerald-500/50 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 relative">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      {selectedMachineForQuickComplete.code}
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold font-mono">
                      {isRTL ? 'إنجاز سريع معتمد' : 'Verified Quick Completion'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {isRTL ? 'توثيق وإنجاز صيانة الماكينة فوراً' : 'Quick Mark Maintenance Complete'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL ? selectedMachineForQuickComplete.nameAr : selectedMachineForQuickComplete.nameEn} (
                    {isRTL ? selectedMachineForQuickComplete.sectionAr : selectedMachineForQuickComplete.sectionEn})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickCompleteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Telemetry Snapshot Banner */}
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl font-mono text-xs grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-white/5">
                <div className="text-[10px] text-slate-400 font-sans">{isRTL ? 'العداد الحالي:' : 'Current Meter:'}</div>
                <div className="text-white font-bold mt-0.5">{selectedMachineForQuickComplete.currentOperatingHours} hrs</div>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <div className="text-[10px] text-rose-300 font-sans">{isRTL ? 'التجاوز المتأخر:' : 'Overdue By:'}</div>
                <div className="text-rose-400 font-bold mt-0.5">
                  +{selectedMachineForQuickComplete.currentOperatingHours - selectedMachineForQuickComplete.maintenanceThresholdHours} hrs
                </div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-300 font-sans">{isRTL ? 'الحد الجديد:' : 'New Threshold:'}</div>
                <div className="text-emerald-400 font-bold mt-0.5">
                  {selectedMachineForQuickComplete.currentOperatingHours + selectedMachineForQuickComplete.intervalHours} hrs
                </div>
              </div>
            </div>

            {/* Quick Form */}
            <form onSubmit={handleSaveQuickComplete} className="space-y-4 text-xs">
              {/* Technician Name (Required) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  <span className="text-amber-400">* </span>
                  {isRTL ? 'اسم الفني المنفذ للصيانة:' : 'Technician Name (Performed By):'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={quickTechnician}
                    onChange={(e) => setQuickTechnician(e.target.value)}
                    placeholder={isRTL ? 'مثال: م. حسن الزبيدي' : 'e.g. Hassan Al-Tamimi'}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white text-sm font-semibold outline-none focus:border-emerald-400 transition-colors"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute ltr:right-3 rtl:left-3 top-2.5 pointer-events-none" />
                </div>

                {/* Quick Technician Selection Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    selectedMachineForQuickComplete.assignedTechnician,
                    'م. حسن الزبيدي',
                    'م. كرار منصور',
                    'م. مصطفى جبار',
                    'Eng. Tariq Al-Bayati',
                    'م. أحمد الشمري',
                  ]
                    .filter((name, idx, arr) => name && arr.indexOf(name) === idx)
                    .map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setQuickTechnician(name)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                          quickTechnician === name
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                </div>
              </div>

              {/* Hours Worked (Required) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  <span className="text-amber-400">* </span>
                  {isRTL ? 'ساعات العمل المستغرقة (Downtime / Work Hours):' : 'Hours Worked (Technician Effort / Downtime):'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.25"
                    max="120"
                    required
                    value={quickHoursWorked}
                    onChange={(e) => setQuickHoursWorked(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white font-mono text-sm font-bold outline-none focus:border-emerald-400 transition-colors"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute ltr:right-3 rtl:left-3 top-2.5 pointer-events-none" />
                </div>

                {/* Quick Presets for Hours Worked */}
                <div className="flex gap-2 mt-2">
                  {[0.5, 1, 1.5, 2, 3, 4].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setQuickHoursWorked(hrs)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer border ${
                        quickHoursWorked === hrs
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {hrs}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Notes (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {isRTL ? 'ملاحظات وتفاصيل العمل المنجز (اختياري):' : 'Work Summary & Notes (Optional):'}
                </label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'فحص دوري، تشحيم المحامل، تنظيف الفلاتر والتأكد من سلامة التشغيل'
                      : 'Routine inspection, bearing lubrication & test run completed'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white text-xs outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              {/* Supervisor Sign-Off Badge */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-[10px] text-slate-400">{isRTL ? 'اعتماد المشرف الميداني:' : 'Supervisor Sign-off:'}</div>
                    <div className="text-white font-semibold text-xs">{currentUser.nameAr} ({currentUser.role})</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {isRTL ? 'معتمد' : 'VERIFIED'}
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsQuickCompleteModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>{isRTL ? 'تأكيد الإنجاز وتحديث حد الصيانة' : 'Confirm Complete & Advance Threshold'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
