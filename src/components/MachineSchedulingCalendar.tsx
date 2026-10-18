import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Flame,
  Factory,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  User,
  Scale,
  Play,
  Check,
  X,
  Zap,
  ShieldAlert,
  Search,
  Wrench,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  MachineJobSchedule,
  MachineScheduleCategory,
  ScheduleShiftName,
  MachineScheduleStatus,
} from '../types';
import {
  getStoredMachineSchedules,
  saveMachineSchedules,
} from '../services/machineScheduleService';
import { getStoredMachines, FactoryMachine } from '../services/maintenanceService';

interface MachineSchedulingCalendarProps {
  onOpenShiftOptimizer?: () => void;
}

export const MachineSchedulingCalendar: React.FC<MachineSchedulingCalendarProps> = ({
  onOpenShiftOptimizer,
}) => {
  const { isRTL } = useLanguage();
  const { materials, productionOrders, currentUser, logAudit } = useFactory();

  // Load schedules and machines
  const [schedules, setSchedules] = useState<MachineJobSchedule[]>(() => getStoredMachineSchedules());
  const [machinesList] = useState<FactoryMachine[]>(() => getStoredMachines());

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-02');
  const [selectedCategory, setSelectedCategory] = useState<MachineScheduleCategory | 'ALL'>('ALL');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<ScheduleShiftName | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'SHIFT_TIMELINE' | 'MACHINE_GRID'>('SHIFT_TIMELINE');

  // Modal State for New / Edit Schedule
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MachineJobSchedule | null>(null);

  // Form State
  const [formMachineId, setFormMachineId] = useState('');
  const [formDate, setFormDate] = useState('2026-09-02');
  const [formShift, setFormShift] = useState<ScheduleShiftName>('Morning / صباحي');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formOrderNumber, setFormOrderNumber] = useState('');
  const [formMaterialId, setFormMaterialId] = useState(materials[0]?.id || '');
  const [formTargetKG, setFormTargetKG] = useState(6000);
  const [formOperator, setFormOperator] = useState('');
  const [formSupervisor, setFormSupervisor] = useState(currentUser?.nameAr || 'م. وسام الجبوري');
  const [formPriority, setFormPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [formSetupNotes, setFormSetupNotes] = useState('');

  // Complete modal state
  const [completingSchedule, setCompletingSchedule] = useState<MachineJobSchedule | null>(null);
  const [actualOutputInput, setActualOutputInput] = useState<number>(0);

  // Helper to persist changes
  const persistSchedules = (newSchedules: MachineJobSchedule[]) => {
    setSchedules(newSchedules);
    saveMachineSchedules(newSchedules);
  };

  // Filter relevant machines (Shredding & Production/Extrusion/Forming)
  const factoryMachines = useMemo(() => {
    return machinesList.filter(
      (m) =>
        m.category === 'SHREDDING' ||
        m.category === 'EXTRUSION' ||
        m.category === 'THERMOFORMING'
    );
  }, [machinesList]);

  // Date Navigation (Previous / Next Day)
  const handleDateChange = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setSelectedDate('2026-09-02');
      return;
    }
    const current = new Date(selectedDate);
    if (direction === 'prev') {
      current.setDate(current.getDate() - 1);
    } else {
      current.setDate(current.getDate() + 1);
    }
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Filtered Schedules for active date & controls
  const filteredSchedules = useMemo(() => {
    return schedules.filter((sch) => {
      const matchDate = sch.date === selectedDate;
      const matchCategory =
        selectedCategory === 'ALL' || sch.machineCategory === selectedCategory;
      const matchShift =
        selectedShiftFilter === 'ALL' || sch.shift === selectedShiftFilter;
      const matchSearch =
        !searchTerm.trim() ||
        sch.machineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sch.machineNameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sch.jobTitleAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sch.orderNumber && sch.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchDate && matchCategory && matchShift && matchSearch;
    });
  }, [schedules, selectedDate, selectedCategory, selectedShiftFilter, searchTerm]);

  // Capacity Planning Calculations for Selected Date
  const capacityOverview = useMemo(() => {
    const daySchedules = schedules.filter((s) => s.date === selectedDate);
    const totalScheduledKG = daySchedules.reduce((sum, s) => sum + s.targetOutputKG, 0);
    const totalActualKG = daySchedules.reduce((sum, s) => sum + (s.actualOutputKG || 0), 0);

    // Rated nominal plant capacity for active machines (approx 10,000 KG per machine per 24h)
    const ratedPlantCapacityKG = factoryMachines.length * 9000; // e.g. ~36,000 to ~45,000 KG
    const overallUtilizationPct = Math.min(
      100,
      Math.round((totalScheduledKG / (ratedPlantCapacityKG || 1)) * 100)
    );

    const shredderSchedules = daySchedules.filter((s) => s.machineCategory === 'SHREDDING');
    const extruderSchedules = daySchedules.filter((s) => s.machineCategory === 'EXTRUSION');
    const formingSchedules = daySchedules.filter((s) => s.machineCategory === 'THERMOFORMING');

    const totalShredderKG = shredderSchedules.reduce((sum, s) => sum + s.targetOutputKG, 0);
    const totalProductionKG = [...extruderSchedules, ...formingSchedules].reduce(
      (sum, s) => sum + s.targetOutputKG,
      0
    );

    const activeScheduledMachines = new Set(daySchedules.map((s) => s.machineId)).size;

    return {
      totalScheduledKG,
      totalActualKG,
      ratedPlantCapacityKG,
      overallUtilizationPct,
      totalShredderKG,
      totalProductionKG,
      activeScheduledMachines,
      totalMachines: factoryMachines.length,
      schedulesCount: daySchedules.length,
    };
  }, [schedules, selectedDate, factoryMachines]);

  // Open modal for new schedule
  const handleOpenNewSchedule = (preselectedMachineId?: string, preselectedShift?: ScheduleShiftName) => {
    setEditingSchedule(null);
    const defaultMch = preselectedMachineId
      ? factoryMachines.find((m) => m.id === preselectedMachineId)
      : factoryMachines[0];

    setFormMachineId(defaultMch ? defaultMch.id : factoryMachines[0]?.id || '');
    setFormDate(selectedDate);
    setFormShift(preselectedShift || 'Morning / صباحي');
    setFormJobTitle(
      defaultMch?.category === 'SHREDDING'
        ? isRTL
          ? 'ثرم وجرش سكراب قناني PET شيت ناعم 6 مم'
          : 'Shredding Clean PET Flakes 6mm'
        : isRTL
        ? 'بثق ألواح رول بلاستيكية سمك 1.2 مم'
        : 'Plastic Sheet Extrusion 1.2mm'
    );
    setFormOrderNumber(productionOrders[0]?.orderNumber || 'PO-2026-0881');
    setFormMaterialId(materials[0]?.id || '');
    setFormTargetKG(defaultMch?.category === 'SHREDDING' ? 5500 : 6500);
    setFormOperator(isRTL ? 'أحمد كريم الموسوي' : 'Ahmed Kareem');
    setFormSupervisor(currentUser?.nameAr || 'م. وسام الجبوري');
    setFormPriority('NORMAL');
    setFormSetupNotes('');
    setIsModalOpen(true);
  };

  // Open modal for editing existing schedule
  const handleOpenEditSchedule = (sch: MachineJobSchedule) => {
    setEditingSchedule(sch);
    setFormMachineId(sch.machineId);
    setFormDate(sch.date);
    setFormShift(sch.shift);
    setFormJobTitle(sch.jobTitleAr);
    setFormOrderNumber(sch.orderNumber || '');
    setFormMaterialId(sch.materialId || materials[0]?.id || '');
    setFormTargetKG(sch.targetOutputKG);
    setFormOperator(sch.assignedOperator);
    setFormSupervisor(sch.supervisor);
    setFormPriority(sch.priority);
    setFormSetupNotes(sch.setupNotes || '');
    setIsModalOpen(true);
  };

  // Submit Schedule Form (Create / Update)
  const handleSubmitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMch = factoryMachines.find((m) => m.id === formMachineId);
    if (!targetMch) return;

    const targetMat = materials.find((m) => m.id === formMaterialId);

    // Calculate utilization percentage based on typical 8h capacity (~6000-8000 KG)
    const nominal8hCap = targetMch.category === 'SHREDDING' ? 7000 : 7500;
    const utilization = Math.min(100, Math.round((Number(formTargetKG) / nominal8hCap) * 100));

    let shiftTimes = { start: '06:00', end: '14:00' };
    if (formShift === 'Evening / مسائي') shiftTimes = { start: '14:00', end: '22:00' };
    if (formShift === 'Night / ليلي') shiftTimes = { start: '22:00', end: '06:00' };

    if (editingSchedule) {
      const updated: MachineJobSchedule = {
        ...editingSchedule,
        machineId: targetMch.id,
        machineCode: targetMch.code,
        machineNameAr: targetMch.nameAr,
        machineNameEn: targetMch.nameEn,
        machineCategory: targetMch.category as MachineScheduleCategory,
        date: formDate,
        shift: formShift,
        startTime: shiftTimes.start,
        endTime: shiftTimes.end,
        jobTitleAr: formJobTitle,
        jobTitleEn: formJobTitle,
        orderNumber: formOrderNumber,
        materialId: targetMat?.id,
        materialName: targetMat ? (isRTL ? targetMat.nameAr : targetMat.nameEn) : undefined,
        targetOutputKG: Number(formTargetKG),
        assignedOperator: formOperator,
        supervisor: formSupervisor,
        priority: formPriority,
        capacityUtilizationPct: utilization,
        setupNotes: formSetupNotes,
        updatedAt: new Date().toISOString(),
      };

      const newSchedules = schedules.map((s) => (s.id === editingSchedule.id ? updated : s));
      persistSchedules(newSchedules);
      logAudit(
        'Machine Schedule Updated',
        `تحديث جدول تشغيل الماكينة ${targetMch.code} - الوجبة ${formShift}`,
        'Production',
        editingSchedule.id,
        targetMch.code,
        `${formJobTitle} | المستهدف: ${Number(formTargetKG).toLocaleString()} KG`,
        currentUser.nameAr
      );
    } else {
      const newId = `SCH-${Date.now().toString().slice(-6)}`;
      const newSchedule: MachineJobSchedule = {
        id: newId,
        scheduleNumber: `SCH-2026-${Math.floor(100 + Math.random() * 900)}`,
        machineId: targetMch.id,
        machineCode: targetMch.code,
        machineNameAr: targetMch.nameAr,
        machineNameEn: targetMch.nameEn,
        machineCategory: targetMch.category as MachineScheduleCategory,
        date: formDate,
        shift: formShift,
        startTime: shiftTimes.start,
        endTime: shiftTimes.end,
        plannedHours: 8,
        orderNumber: formOrderNumber,
        jobTitleAr: formJobTitle,
        jobTitleEn: formJobTitle,
        materialId: targetMat?.id,
        materialName: targetMat ? (isRTL ? targetMat.nameAr : targetMat.nameEn) : undefined,
        targetOutputKG: Number(formTargetKG),
        assignedOperator: formOperator,
        supervisor: formSupervisor,
        priority: formPriority,
        status: 'SCHEDULED',
        capacityUtilizationPct: utilization,
        setupNotes: formSetupNotes,
        createdAt: new Date().toISOString(),
      };

      persistSchedules([newSchedule, ...schedules]);
      logAudit(
        'Machine Schedule Created',
        `جدولة تشغيل جديدة لماكينة ${targetMch.code} (${targetMch.nameAr})`,
        'Production',
        newId,
        targetMch.code,
        `الوجبة: ${formShift} | المستهدف: ${Number(formTargetKG).toLocaleString()} KG`,
        currentUser.nameAr
      );
    }

    setIsModalOpen(false);
  };

  // Status Change Helpers
  const handleUpdateStatus = (schId: string, newStatus: MachineScheduleStatus) => {
    const updated = schedules.map((s) => (s.id === schId ? { ...s, status: newStatus } : s));
    persistSchedules(updated);
  };

  // Complete Schedule
  const handleConfirmCompletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingSchedule) return;

    const actual = Number(actualOutputInput) > 0 ? Number(actualOutputInput) : completingSchedule.targetOutputKG;
    const updated = schedules.map((s) =>
      s.id === completingSchedule.id
        ? {
            ...s,
            status: 'COMPLETED' as MachineScheduleStatus,
            actualOutputKG: actual,
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    persistSchedules(updated);
    logAudit(
      'Schedule Completed',
      `إنجاز وردية عمل مجدولة لماكينة ${completingSchedule.machineCode}`,
      'Production',
      completingSchedule.id,
      completingSchedule.machineCode,
      `المنجز الفعلي: ${actual.toLocaleString()} KG (المستهدف: ${completingSchedule.targetOutputKG.toLocaleString()} KG)`,
      currentUser.nameAr
    );
    setCompletingSchedule(null);
  };

  // Shifts array for timeline
  const shiftsList: ScheduleShiftName[] = [
    'Morning / صباحي',
    'Evening / مسائي',
    'Night / ليلي',
  ];

  return (
    <div className="space-y-6 text-slate-200">
      {/* Top Banner & Date Controls */}
      <div className="bg-[#111218] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Header Title */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  {isRTL
                    ? 'جدول ومناوبات تشغيل الماكينات (Machine Capacity Calendar)'
                    : 'Machine Scheduling & Capacity Planning Calendar'}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Manager Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'توزيع أوامر التشغيل والورديات لماكينات الثرم والبثق والتشكيل الحراري لتفادي الاختناقات وموازنة الطاقة الإنتاجية'
                  : 'Assign jobs & shifts across shredders and extrusion lines for synchronized throughput and capacity planning'}
              </p>
            </div>
          </div>

          {/* Action Button & Date Navigator */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            {/* Date Navigator */}
            <div className="flex items-center bg-[#171922] border border-white/10 rounded-xl p-1 text-xs">
              <button
                onClick={() => handleDateChange('prev')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isRTL ? 'اليوم السابق' : 'Previous Day'}
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>

              <div className="flex items-center gap-1.5 px-3 font-mono font-bold text-cyan-300">
                <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{selectedDate}</span>
              </div>

              <button
                onClick={() => handleDateChange('next')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isRTL ? 'اليوم التالي' : 'Next Day'}
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <button
                onClick={() => handleDateChange('today')}
                className="ms-1 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                {isRTL ? 'اليوم' : 'Today'}
              </button>
            </div>

            {/* Shift Optimizer Quick Launch Button */}
            {onOpenShiftOptimizer && (
              <button
                onClick={onOpenShiftOptimizer}
                className="px-3 py-2 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 hover:text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
                title={isRTL ? 'فتح مُحسِّن فترات الورديات والراحة' : 'Open Shift & Break Optimizer'}
              >
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>{isRTL ? 'مُحسِّن الورديات (AI)' : 'Shift Optimizer'}</span>
              </button>
            )}

            {/* Add Schedule Button */}
            <button
              onClick={() => handleOpenNewSchedule()}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg hover:shadow-purple-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'جدولة تشغيل جديدة' : 'Schedule Machine Job'}</span>
            </button>
          </div>
        </div>

        {/* Capacity Planning Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
          {/* Total Scheduled Target */}
          <div className="bg-[#151722] border border-white/5 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{isRTL ? 'إجمالي الإنتاج المجدول' : 'Total Planned Target'}</span>
              <Scale className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-mono font-bold text-white">
                {capacityOverview.totalScheduledKG.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400">KG</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              ≈ {(capacityOverview.totalScheduledKG / 1000).toFixed(1)} {isRTL ? 'طن' : 'Tons'}
            </div>
          </div>

          {/* Plant Capacity Load Rate */}
          <div className="bg-[#151722] border border-white/5 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{isRTL ? 'نسبة إشغال المصنع' : 'Capacity Load'}</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span
                className={`text-xl font-mono font-bold ${
                  capacityOverview.overallUtilizationPct > 90
                    ? 'text-rose-400'
                    : capacityOverview.overallUtilizationPct >= 70
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {capacityOverview.overallUtilizationPct}%
              </span>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  capacityOverview.overallUtilizationPct > 90
                    ? 'bg-rose-500'
                    : capacityOverview.overallUtilizationPct >= 70
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${capacityOverview.overallUtilizationPct}%` }}
              />
            </div>
          </div>

          {/* Shredding Capacity */}
          <div className="bg-[#151722] border border-emerald-500/20 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1 text-emerald-300">
                <Flame className="w-3 h-3 text-emerald-400" />
                {isRTL ? 'مجدول الثرم والجرش' : 'Shredding Target'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-mono font-bold text-emerald-400">
                {capacityOverview.totalShredderKG.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400">KG</span>
            </div>
            <div className="text-[10px] text-emerald-500/70 font-mono mt-0.5">
              {isRTL ? 'تجهيز خامات مفرومة' : 'Regrind preparation'}
            </div>
          </div>

          {/* Production Lines Capacity */}
          <div className="bg-[#151722] border border-cyan-500/20 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1 text-cyan-300">
                <Factory className="w-3 h-3 text-cyan-400" />
                {isRTL ? 'مجدول البثق والتشكيل' : 'Extrusion / Forming'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-mono font-bold text-cyan-400">
                {capacityOverview.totalProductionKG.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-slate-400">KG</span>
            </div>
            <div className="text-[10px] text-cyan-500/70 font-mono mt-0.5">
              {isRTL ? 'ألواح وأكواب نهائية' : 'Sheets & cups production'}
            </div>
          </div>

          {/* Active Machines Ratio */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-[#151722] border border-white/5 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>{isRTL ? 'الماكينات المجدولة' : 'Assigned Machines'}</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-mono font-bold text-white">
                {capacityOverview.activeScheduledMachines} / {capacityOverview.totalMachines}
              </span>
              <span className="text-xs text-slate-400">{isRTL ? 'ماكينة' : 'Units'}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {capacityOverview.schedulesCount} {isRTL ? 'ورديات مجدولة اليوم' : 'scheduled shifts today'}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRTL ? 'كافة الماكينات' : 'All Machines'}
              </button>
              <button
                onClick={() => setSelectedCategory('SHREDDING')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === 'SHREDDING'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Flame className="w-3 h-3 text-emerald-400" />
                <span>{isRTL ? 'ماكينات الثرم والجرش' : 'Shredding Lines'}</span>
              </button>
              <button
                onClick={() => setSelectedCategory('EXTRUSION')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === 'EXTRUSION'
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Factory className="w-3 h-3 text-cyan-400" />
                <span>{isRTL ? 'خطوط بثق الألواح' : 'Extrusion Lines'}</span>
              </button>
              <button
                onClick={() => setSelectedCategory('THERMOFORMING')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === 'THERMOFORMING'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3 text-indigo-400" />
                <span>{isRTL ? 'تشكيل الأكواب' : 'Thermoforming'}</span>
              </button>
            </div>

            {/* Shift Filter */}
            <select
              value={selectedShiftFilter}
              onChange={(e) => setSelectedShiftFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-[#171922] border border-white/10 rounded-xl text-slate-300 font-semibold outline-none focus:border-purple-400"
            >
              <option value="ALL">{isRTL ? 'كافة الورديات' : 'All Shifts'}</option>
              <option value="Morning / صباحي">{isRTL ? 'الوردية الصباحية (06-14)' : 'Morning Shift (06-14)'}</option>
              <option value="Evening / مسائي">{isRTL ? 'الوردية المسائية (14-22)' : 'Evening Shift (14-22)'}</option>
              <option value="Night / ليلي">{isRTL ? 'الوردية الليلية (22-06)' : 'Night Shift (22-06)'}</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRTL ? 'بحث بالماكينة أو رقم الأمر...' : 'Search machine or job order...'}
              className="w-full px-3 py-1.5 pl-8 bg-[#171922] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Main Shift Timeline Matrix */}
      <div className="space-y-4">
        {factoryMachines
          .filter(
            (m) => selectedCategory === 'ALL' || m.category === selectedCategory
          )
          .map((machine) => {
            const machineSchedules = filteredSchedules.filter(
              (s) => s.machineId === machine.id
            );
            const totalMachineTargetKG = machineSchedules.reduce(
              (sum, s) => sum + s.targetOutputKG,
              0
            );
            const machineCategoryColor =
              machine.category === 'SHREDDING'
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                : machine.category === 'EXTRUSION'
                ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'
                : 'border-purple-500/30 text-purple-400 bg-purple-500/10';

            return (
              <div
                key={machine.id}
                className="bg-[#111218] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition-all hover:border-white/20"
              >
                {/* Machine Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${machineCategoryColor}`}>
                      {machine.category === 'SHREDDING' ? (
                        <Flame className="w-5 h-5" />
                      ) : machine.category === 'EXTRUSION' ? (
                        <Factory className="w-5 h-5" />
                      ) : (
                        <Layers className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">
                          {machine.code}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          {isRTL ? machine.nameAr : machine.nameEn}
                        </span>
                        <span className="px-2 py-0.2 text-[10px] font-mono rounded bg-white/5 text-slate-400 border border-white/10">
                          {machine.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{isRTL ? machine.sectionAr : machine.sectionEn}</span>
                        <span>•</span>
                        <span>
                          {isRTL ? 'ساعات التشغيل:' : 'Runtime:'}{' '}
                          <strong className="text-slate-300 font-mono">
                            {machine.currentOperatingHours}h
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Machine Daily Scheduled Load & Add Slot */}
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-end font-mono text-xs">
                      <span className="text-[10px] text-slate-400 block font-sans">
                        {isRTL ? 'إجمالي المجدول اليوم:' : 'Daily Target:'}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {totalMachineTargetKG.toLocaleString()} KG
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenNewSchedule(machine.id)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/40 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isRTL ? 'إضافة وردية' : 'Assign Shift'}</span>
                    </button>
                  </div>
                </div>

                {/* 3-Shift Timeline Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {shiftsList.map((shiftName) => {
                    const shiftSchedules = machineSchedules.filter((s) => s.shift === shiftName);

                    return (
                      <div
                        key={shiftName}
                        className="bg-[#151722] border border-white/5 rounded-xl p-3 flex flex-col justify-between min-h-[140px]"
                      >
                        {/* Shift Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {shiftName === 'Morning / صباحي'
                                ? isRTL
                                  ? 'الوردية الصباحية (06:00 - 14:00)'
                                  : 'Morning Shift (06:00 - 14:00)'
                                : shiftName === 'Evening / مسائي'
                                ? isRTL
                                  ? 'الوردية المسائية (14:00 - 22:00)'
                                  : 'Evening Shift (14:00 - 22:00)'
                                : isRTL
                                ? 'الوردية الليلية (22:00 - 06:00)'
                                : 'Night Shift (22:00 - 06:00)'}
                            </span>
                          </div>

                          {shiftSchedules.length === 0 && (
                            <button
                              onClick={() => handleOpenNewSchedule(machine.id, shiftName)}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                            >
                              + {isRTL ? 'تعيين' : 'Assign'}
                            </button>
                          )}
                        </div>

                        {/* Scheduled Jobs in this shift */}
                        {shiftSchedules.length > 0 ? (
                          <div className="space-y-2 mt-2">
                            {shiftSchedules.map((sch) => (
                              <div
                                key={sch.id}
                                className="bg-[#1a1d2b] border border-white/10 hover:border-purple-500/40 rounded-lg p-2.5 text-xs space-y-2 transition-all"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      {sch.orderNumber && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                          {sch.orderNumber}
                                        </span>
                                      )}
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                          sch.priority === 'CRITICAL'
                                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                            : sch.priority === 'HIGH'
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : 'bg-white/5 text-slate-400'
                                        }`}
                                      >
                                        {sch.priority}
                                      </span>
                                    </div>
                                    <h4 className="font-bold text-white mt-1 text-xs line-clamp-1">
                                      {isRTL ? sch.jobTitleAr : sch.jobTitleEn}
                                    </h4>
                                  </div>

                                  {/* Status Badge */}
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                                      sch.status === 'COMPLETED'
                                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                        : sch.status === 'IN_PROGRESS'
                                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse'
                                        : sch.status === 'MAINTENANCE_HOLD'
                                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                        : 'bg-slate-800 text-slate-300 border border-white/10'
                                    }`}
                                  >
                                    {sch.status}
                                  </span>
                                </div>

                                {/* Target Output & Operator */}
                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                  <span>
                                    {isRTL ? 'الهدف:' : 'Target:'}{' '}
                                    <strong className="text-emerald-400">
                                      {sch.targetOutputKG.toLocaleString()} KG
                                    </strong>
                                  </span>
                                  {sch.actualOutputKG !== undefined && (
                                    <span>
                                      {isRTL ? 'المنجز:' : 'Actual:'}{' '}
                                      <strong className="text-cyan-400">
                                        {sch.actualOutputKG.toLocaleString()} KG
                                      </strong>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                                  <span className="flex items-center gap-1 truncate max-w-[150px]">
                                    <User className="w-3 h-3 text-slate-500" />
                                    <span>{sch.assignedOperator}</span>
                                  </span>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {sch.status === 'SCHEDULED' && (
                                      <button
                                        onClick={() => handleUpdateStatus(sch.id, 'IN_PROGRESS')}
                                        className="px-2 py-0.5 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded font-semibold transition-colors cursor-pointer"
                                        title={isRTL ? 'بدء التشغيل' : 'Start Job'}
                                      >
                                        <Play className="w-2.5 h-2.5 inline me-1" />
                                        {isRTL ? 'تشغيل' : 'Start'}
                                      </button>
                                    )}

                                    {sch.status === 'IN_PROGRESS' && (
                                      <button
                                        onClick={() => {
                                          setCompletingSchedule(sch);
                                          setActualOutputInput(sch.targetOutputKG);
                                        }}
                                        className="px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded font-semibold transition-colors cursor-pointer"
                                        title={isRTL ? 'توثيق الإنجاز' : 'Complete Job'}
                                      >
                                        <Check className="w-2.5 h-2.5 inline me-1" />
                                        {isRTL ? 'إنجاز' : 'Complete'}
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleOpenEditSchedule(sch)}
                                      className="text-slate-400 hover:text-white px-1 underline cursor-pointer"
                                    >
                                      {isRTL ? 'تعديل' : 'Edit'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
                            <span className="text-slate-600 text-xs">
                              {isRTL ? 'لا توجد وردية مجدولة' : 'No scheduled shift'}
                            </span>
                            <button
                              onClick={() => handleOpenNewSchedule(machine.id, shiftName)}
                              className="mt-1 text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                            >
                              + {isRTL ? 'تعيين أمر تشغيل' : 'Assign Job Order'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>

      {/* NEW / EDIT SCHEDULE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#13151f] border border-purple-500/40 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 relative">
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {editingSchedule
                      ? isRTL
                        ? 'تعديل جدولة الماكينة والوردية'
                        : 'Edit Machine Job Schedule'
                      : isRTL
                      ? 'تعيين أمر تشغيل ووردية لماكينة'
                      : 'Assign Job & Shift to Machine'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? 'تخطيط الطاقة الإنتاجية وتحديد مستهدفات الثرم والبثق'
                      : 'Capacity planning, target output & operator assignment'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSchedule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Select Machine */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    <span className="text-amber-400">* </span>
                    {isRTL ? 'الماكينة المستهدفة:' : 'Target Machine:'}
                  </label>
                  <select
                    required
                    value={formMachineId}
                    onChange={(e) => setFormMachineId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400 font-semibold"
                  >
                    {factoryMachines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {isRTL ? m.nameAr : m.nameEn} ({m.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shift */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    <span className="text-amber-400">* </span>
                    {isRTL ? 'الوردية:' : 'Shift Window:'}
                  </label>
                  <select
                    required
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as ScheduleShiftName)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400 font-semibold"
                  >
                    <option value="Morning / صباحي">{isRTL ? 'صباحي (06:00 - 14:00)' : 'Morning (06:00 - 14:00)'}</option>
                    <option value="Evening / مسائي">{isRTL ? 'مسائي (14:00 - 22:00)' : 'Evening (14:00 - 22:00)'}</option>
                    <option value="Night / ليلي">{isRTL ? 'ليلي (22:00 - 06:00)' : 'Night (22:00 - 06:00)'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    <span className="text-amber-400">* </span>
                    {isRTL ? 'تاريخ التشغيل:' : 'Date:'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400 font-mono"
                  />
                </div>

                {/* Linked Order Number */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {isRTL ? 'رقم أمر الإنتاج (إن وجد):' : 'Production Order #:'}
                  </label>
                  <select
                    value={formOrderNumber}
                    onChange={(e) => setFormOrderNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400 font-mono"
                  >
                    <option value="">{isRTL ? '-- تشغيل عام / رصيد مخزن --' : '-- General Run / Stock --'}</option>
                    {productionOrders.map((po) => (
                      <option key={po.id} value={po.orderNumber}>
                        {po.orderNumber} - {po.productName} ({po.plannedKG.toLocaleString()} KG)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Job Title / Task Description */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  <span className="text-amber-400">* </span>
                  {isRTL ? 'عنوان ومواصفات مهمة التشغيل:' : 'Job Title & Specifications:'}
                </label>
                <input
                  type="text"
                  required
                  value={formJobTitle}
                  onChange={(e) => setFormJobTitle(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'مثال: بثق ألواح رول بيضاء سمك 1.2 مم عالي الكثافة'
                      : 'e.g. Extrusion White HIPS/PP Sheet Roll 1.2mm'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Target Output KG */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    <span className="text-amber-400">* </span>
                    {isRTL ? 'الكمية المستهدفة (KG):' : 'Target Output (KG):'}
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="500"
                    max="30000"
                    required
                    value={formTargetKG}
                    onChange={(e) => setFormTargetKG(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white font-mono font-bold text-sm outline-none focus:border-purple-400"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {isRTL ? 'درجة الأولوية:' : 'Priority Level:'}
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400 font-semibold"
                  >
                    <option value="LOW">{isRTL ? 'منخفضة (Low)' : 'Low'}</option>
                    <option value="NORMAL">{isRTL ? 'عادية (Normal)' : 'Normal'}</option>
                    <option value="HIGH">{isRTL ? 'مرتفعة (High)' : 'High'}</option>
                    <option value="CRITICAL">{isRTL ? 'حرجة / عاجلة (Critical)' : 'Critical'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Assigned Operator */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    <span className="text-amber-400">* </span>
                    {isRTL ? 'الفني أو المشغل المسؤول:' : 'Assigned Operator:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formOperator}
                    onChange={(e) => setFormOperator(e.target.value)}
                    placeholder={isRTL ? 'أحمد كريم الموسوي' : 'Operator Name'}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400"
                  />
                </div>

                {/* Supervisor */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {isRTL ? 'المشرف المسؤول:' : 'Shift Supervisor:'}
                  </label>
                  <input
                    type="text"
                    value={formSupervisor}
                    onChange={(e) => setFormSupervisor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Setup Notes */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  {isRTL ? 'تعليمات القالب والداي وضبط المعايرة (اختياري):' : 'Die, Mold Setup & Technical Notes:'}
                </label>
                <textarea
                  rows={2}
                  value={formSetupNotes}
                  onChange={(e) => setFormSetupNotes(e.target.value)}
                  placeholder={
                    isRTL
                      ? 'ملاحظات تجهيز الماكينة، مقاس الداي، ضبط درجات الحرارة أو خلوص سكاكين الجرش...'
                      : 'Setup notes, die gap calibration, temperature setpoints...'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white outline-none focus:border-purple-400"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg cursor-pointer"
                >
                  {editingSchedule
                    ? isRTL
                      ? 'حفظ التعديلات'
                      : 'Save Changes'
                    : isRTL
                    ? 'تأكيد وإدراج الجدولة'
                    : 'Confirm & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETION MODAL */}
      {completingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#13151f] border border-emerald-500/40 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isRTL ? 'توثيق إنجاز الوردية المجدولة' : 'Complete Scheduled Shift'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {completingSchedule.machineCode} - {completingSchedule.shift}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmCompletion} className="space-y-4 text-xs">
              <div className="p-3 bg-white/5 rounded-xl space-y-1">
                <div className="text-slate-400">{isRTL ? 'المهمة المنجزة:' : 'Task:'}</div>
                <div className="text-white font-bold text-sm">
                  {isRTL ? completingSchedule.jobTitleAr : completingSchedule.jobTitleEn}
                </div>
                <div className="text-slate-400 font-mono text-[11px] pt-1">
                  {isRTL ? 'المستهدف المخطط:' : 'Planned Target:'}{' '}
                  <strong className="text-emerald-400">
                    {completingSchedule.targetOutputKG.toLocaleString()} KG
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  <span className="text-amber-400">* </span>
                  {isRTL ? 'الإنتاج الفعلي المنجز (Actual Output KG):' : 'Actual Output (KG):'}
                </label>
                <input
                  type="number"
                  required
                  value={actualOutputInput}
                  onChange={(e) => setActualOutputInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white font-mono font-bold text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCompletingSchedule(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg cursor-pointer"
                >
                  {isRTL ? 'تأكيد الإنجاز' : 'Confirm Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
