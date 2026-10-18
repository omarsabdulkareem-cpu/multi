import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  AlertTriangle,
  AlertOctagon,
  Bell,
  BellOff,
  Clock,
  Zap,
  Activity,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  ChevronRight,
  Sliders,
  Calendar,
  X,
  RotateCcw,
  Check,
  Sparkles,
  Layers,
  Flame,
  Volume2,
  VolumeX,
  Gauge,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  User,
  DollarSign,
  Package,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  EquipmentUsagePattern,
  MaintenanceAlertNotification,
  MaintenanceAlertsSummary,
  FactoryMachine,
} from '../types';
import {
  getMaintenanceAlertsSummary,
  acknowledgeMaintenanceAlert,
  snoozeMaintenanceAlert,
  resolveAlertWithMaintenanceTask,
  simulateEquipmentUsageRun,
  resetMachineHoursForTesting,
  isSoundAlertEnabled,
  setSoundAlertEnabled,
  playIndustrialAlertChime,
  EVENT_MAINTENANCE_ALERT_TRIGGERED,
  EVENT_MACHINERY_UPDATED,
} from '../services/maintenanceAlertService';

interface MaintenanceAlertsProps {
  onNavigateToFullMaintenance?: () => void;
  className?: string;
}

export const MaintenanceAlerts: React.FC<MaintenanceAlertsProps> = ({
  onNavigateToFullMaintenance,
  className = '',
}) => {
  const { isRTL, t } = useLanguage();
  const { currentUser, logAudit, setCurrentPage } = useFactory();

  // Summary state
  const [summary, setSummary] = useState<MaintenanceAlertsSummary>(() =>
    getMaintenanceAlertsSummary()
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isSoundAlertEnabled());
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'OVERDUE' | 'IMMINENT' | 'APPROACHING' | 'OPTIMAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('MCH-SHR-01');

  // Work Order / Quick Service Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [serviceMachine, setServiceMachine] = useState<EquipmentUsagePattern | null>(null);
  const [serviceNotificationId, setServiceNotificationId] = useState<string | undefined>(undefined);
  const [serviceTech, setServiceTech] = useState('');
  const [serviceDowntime, setServiceDowntime] = useState(2.5);
  const [serviceTaskType, setServiceTaskType] = useState<'PREVENTIVE' | 'LUBRICATION' | 'CORRECTIVE' | 'OVERHAUL'>('PREVENTIVE');
  const [servicePartsAr, setServicePartsAr] = useState('');
  const [servicePartsEn, setServicePartsEn] = useState('');
  const [serviceCost, setServiceCost] = useState(200);
  const [serviceNotes, setServiceNotes] = useState('');

  // Simulation controls state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simHours, setSimHours] = useState<number>(8);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'SUCCESS' | 'WARNING' | 'INFO';
    message: string;
  } | null>(null);

  // Sync state on custom window events
  useEffect(() => {
    const handleUpdate = () => {
      setSummary(getMaintenanceAlertsSummary());
    };
    window.addEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleUpdate);
    window.addEventListener(EVENT_MACHINERY_UPDATED, handleUpdate);

    return () => {
      window.removeEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleUpdate);
      window.removeEventListener(EVENT_MACHINERY_UPDATED, handleUpdate);
    };
  }, []);

  // Filtered patterns
  const filteredPatterns = useMemo(() => {
    return summary.usagePatterns.filter((p) => {
      const matchesSearch =
        p.machineCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sectionAr.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'OVERDUE') return p.isOverdue;
      if (activeFilter === 'IMMINENT') return p.isImpending;
      if (activeFilter === 'APPROACHING') return p.isApproaching;
      if (activeFilter === 'OPTIMAL') return p.stage === 'OPTIMAL';
      return true;
    });
  }, [summary.usagePatterns, activeFilter, searchQuery]);

  // Selected pattern (default Shredder 360)
  const selectedPattern = useMemo(() => {
    return (
      summary.usagePatterns.find((p) => p.machineId === selectedMachineId) ||
      summary.usagePatterns.find((p) => p.category === 'SHREDDING') ||
      summary.usagePatterns[0]
    );
  }, [summary.usagePatterns, selectedMachineId]);

  // Handle Toggle Sound
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundAlertEnabled(next);
    if (next) {
      playIndustrialAlertChime('NOTICE');
    }
  };

  // Open Service Modal
  const openServiceModal = (pattern: EquipmentUsagePattern, notificationId?: string) => {
    setServiceMachine(pattern);
    setServiceNotificationId(notificationId);
    setServiceTech(pattern.assignedTechnician || currentUser.nameAr);
    setServiceDowntime(pattern.category === 'SHREDDING' ? 3.0 : 2.0);
    setServiceTaskType(pattern.category === 'SHREDDING' ? 'LUBRICATION' : 'PREVENTIVE');

    if (pattern.category === 'SHREDDING') {
      setServicePartsAr('شفرات وسكاكين دوارة فولاذ D2 عدد 4، شحم ليثيوم SKF عالي التحمل 5 كغم');
      setServicePartsEn('D2 Rotary Knives (4x), SKF Lithium Grease LGHP 2 (5kg)');
      setServiceCost(380);
      setServiceNotes(
        isRTL
          ? 'استجابة لتنبيه تجاوز دورة 300 ساعة: شحذ السكاكين وتعديل الخلوص عند 0.25 ملم وتشحيم المحامل'
          : '300h interval response: Sharpened rotor knives, reset clearance to 0.25mm, flushed SKF grease.'
      );
    } else {
      setServicePartsAr('زيوت هيدروليكية، فلاتر ضغط عالي، حشوات إحكام');
      setServicePartsEn('Hydraulic oil, filter cartridges, gaskets');
      setServiceCost(250);
      setServiceNotes(
        isRTL
          ? `صيانة دورية وقائية وإعادة ضبط حد الساعات للماكينة [${pattern.machineCode}]`
          : `Scheduled preventive service and threshold reset for [${pattern.machineCode}]`
      );
    }
    setIsServiceModalOpen(true);
  };

  // Submit Completed Service
  const handleConfirmService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceMachine) return;

    try {
      const taskTitleAr =
        serviceMachine.category === 'SHREDDING'
          ? 'صيانة دورية واستبدال/شحذ سكاكين مفرمة الثرم 360'
          : `صيانة وقائية دورية للماكينة ${serviceMachine.machineCode}`;

      const taskTitleEn =
        serviceMachine.category === 'SHREDDING'
          ? 'Rotary Knives Sharpening & Lubrication (Shredder 360)'
          : `Scheduled Preventive Maintenance (${serviceMachine.machineCode})`;

      const res = resolveAlertWithMaintenanceTask({
        machineId: serviceMachine.machineId,
        notificationId: serviceNotificationId,
        taskTitleAr,
        taskTitleEn,
        taskType: serviceTaskType,
        downtimeHours: Number(serviceDowntime) || 2,
        performedBy: serviceTech,
        supervisorSignOff: `${currentUser.nameAr} (${currentUser.role})`,
        partsReplacedAr: servicePartsAr,
        partsReplacedEn: servicePartsEn,
        totalCostUSD: Number(serviceCost) || 0,
        notesAr: serviceNotes,
        notesEn: serviceNotes,
      });

      setSummary(res.summary);
      setIsServiceModalOpen(false);

      logAudit(
        'Maintenance Service Interval Completed',
        'إنجاز صيانة دورية للماكينة وتحديث حد الساعات وتصفية التنبيه',
        'Machinery',
        serviceMachine.machineId,
        `${serviceMachine.nameAr} (${serviceMachine.machineCode})`,
        `Tech: ${serviceTech} | Interval: +${serviceMachine.intervalHours}h | Status: RUNNING`,
        `Supervisor: ${currentUser.nameAr}`
      );

      setActionFeedback({
        type: 'SUCCESS',
        message: isRTL
          ? `تم توثيق الصيانة بنجاح للماكينة [${serviceMachine.machineCode}] وتمت تصفية التنبيه وتمديد حد الساعات القادم بمقدار +${serviceMachine.intervalHours} ساعة.`
          : `Service task logged successfully for [${serviceMachine.machineCode}]. Alert cleared and next threshold advanced by +${serviceMachine.intervalHours}h.`,
      });

      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setActionFeedback({
        type: 'WARNING',
        message: isRTL ? `تعذر تسجيل الصيانة: ${errorMsg}` : `Failed to log service: ${errorMsg}`,
      });
    }
  };

  // Handle Acknowledge Alert
  const handleAcknowledge = (notif: MaintenanceAlertNotification) => {
    const res = acknowledgeMaintenanceAlert(notif.id, currentUser);
    setSummary(res.summary);
    logAudit(
      'Maintenance Alert Acknowledged',
      'تأكيد استلام واعتماد إشعار صيانة دورية',
      'MaintenanceAlert',
      notif.id,
      notif.machineCode,
      `Severity: ${notif.severity} | Hours: ${notif.currentOperatingHours}/${notif.maintenanceThresholdHours}`,
      `Acknowledged by ${currentUser.nameAr}`
    );
    setActionFeedback({
      type: 'INFO',
      message: isRTL
        ? `تم اعتماد وتأكيد إشعار الماكينة [${notif.machineCode}] بواسطة ${currentUser.nameAr}.`
        : `Alert for [${notif.machineCode}] acknowledged by ${currentUser.nameAr}.`,
    });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  // Handle Snooze Alert
  const handleSnooze = (notif: MaintenanceAlertNotification, hours: number) => {
    const res = snoozeMaintenanceAlert(notif.id, hours);
    setSummary(res.summary);
    setActionFeedback({
      type: 'INFO',
      message: isRTL
        ? `تم تأجيل إشعار [${notif.machineCode}] لمدة ${hours} ساعات.`
        : `Alert for [${notif.machineCode}] snoozed for ${hours} hours.`,
    });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  // Handle Run Equipment Usage Simulation
  const handleSimulateUsage = (machineId: string, hours: number) => {
    setIsSimulating(true);
    setTimeout(() => {
      const res = simulateEquipmentUsageRun(machineId, hours);
      setSummary(res.summary);
      setIsSimulating(false);

      if (res.newlyTriggered) {
        setActionFeedback({
          type: 'WARNING',
          message: isRTL
            ? `تنبيه حرج! تجاوزت الماكينة [${res.updatedMachine.code}] حد الصيانة بعد إضافة ${hours} ساعة تشغيل. تم إطلاق صفارة الإنذار وتوليد إشعار فوري.`
            : `Critical Alert! Machine [${res.updatedMachine.code}] has reached and breached its service threshold after adding ${hours} operating hours. Live notification triggered!`,
        });
      } else {
        setActionFeedback({
          type: 'INFO',
          message: isRTL
            ? `تمت محاكاة تشغيل الماكينة بمقدار +${hours} ساعة. القراءة الحالية: ${res.updatedMachine.currentOperatingHours} ساعة.`
            : `Simulated +${hours}h runtime. Current reading: ${res.updatedMachine.currentOperatingHours}h.`,
        });
      }
      setTimeout(() => setActionFeedback(null), 7000);
    }, 300);
  };

  // Reset to Nominal for testing
  const handleResetToNominal = (machineId: string, targetHours: number) => {
    const res = resetMachineHoursForTesting(machineId, targetHours);
    setSummary(res.summary);
    setActionFeedback({
      type: 'INFO',
      message: isRTL
        ? `تمت إعادة ضبط ساعات تشغيل الماكينة إلى ${targetHours} ساعة لأغراض الاختبار التجريبي.`
        : `Machine hours reset to ${targetHours}h for testing purposes.`,
    });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  return (
    <div className={`space-y-6 ${className}`} id="maintenance-alerts-component">
      {/* Top Industrial Command Header */}
      <div className="bg-[#111218] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                summary.overdueCount > 0
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-lg shadow-rose-500/20 animate-pulse'
                  : summary.imminentCount > 0
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
              }`}
            >
              {summary.overdueCount > 0 ? (
                <AlertOctagon className="w-6 h-6" />
              ) : (
                <Bell className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {isRTL
                    ? 'نظام تنبيهات الصيانة ومراقبة استهلاك الماكينات'
                    : 'Maintenance Alerts & Equipment Usage Monitor'}
                </h2>
                {summary.overdueCount > 0 && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
                    {isRTL
                      ? `${summary.overdueCount} ماكينات تجاوزت حد الصيانة`
                      : `${summary.overdueCount} Service Overdue`}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                {isRTL
                  ? 'رصد مستمر لأنماط تشغيل معدات المصنع (مفرمة الثرم 360، خطوط البثق، والضواغط)، مع إطلاق تنبيهات ذكية فورية عند بلوغ دورات الصيانة الميكانيكية المقررة لتفادي الأعطال المفاجئة.'
                  : 'Continuous telemetry monitoring of machinery usage patterns (Shredder 360, extrusion lines, utility compressors), automatically triggering alerts when service intervals are reached to prevent catastrophic breakdowns.'}
              </p>
            </div>
          </div>

          {/* Quick HUD Controls */}
          <div className="flex items-center gap-2.5 shrink-0 self-start lg:self-center">
            {/* Audio Alert Toggle */}
            <button
              onClick={handleToggleSound}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                soundEnabled
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
              title={isRTL ? 'تفعيل/كتم صفارة الإنذار الصوتي' : 'Toggle Audio Alarm Chime'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>{isRTL ? 'الإنذار الصوتي: مفعّل' : 'Audio Alert: ON'}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-500" />
                  <span>{isRTL ? 'الإنذار الصوتي: صامت' : 'Audio Alert: MUTED'}</span>
                </>
              )}
            </button>

            {/* Test Sound Trigger */}
            <button
              onClick={() => playIndustrialAlertChime('CRITICAL')}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 text-xs transition-colors"
              title={isRTL ? 'اختبار نغمة الإنذار الصناعي' : 'Test Industrial Chime'}
            >
              <Zap className="w-4 h-4 text-amber-400" />
            </button>

            {onNavigateToFullMaintenance && (
              <button
                onClick={onNavigateToFullMaintenance}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 text-xs font-medium transition-colors"
              >
                <span>{isRTL ? 'سجل الصيانة الكامل' : 'Full Maintenance Fleet'}</span>
                {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
          <div className="bg-[#181920] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span>{isRTL ? 'تجاوزت الحد (حرج)' : 'Overdue Threshold'}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-1">
              {summary.overdueCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isRTL ? 'تتطلب تدخلاً عاجلاً' : 'Immediate service required'}
            </div>
          </div>

          <div className="bg-[#181920] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{isRTL ? 'اقتراب الصيانة (<25س)' : 'Due Soon (<25h)'}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300 mt-1">
              {summary.imminentCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isRTL ? 'تجهيز قطع الغيار والوردية' : 'Prepare maintenance slot'}
            </div>
          </div>

          <div className="bg-[#181920] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>{isRTL ? 'إجمالي الإشعارات النشطة' : 'Active Alerts'}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-300 mt-1">
              {summary.activeNotificationsCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isRTL
                ? `${summary.unacknowledgedCount} غير معتمد من المشرف`
                : `${summary.unacknowledgedCount} unacknowledged`}
            </div>
          </div>

          <div className="bg-[#181920] rounded-xl p-3 border border-white/5">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{isRTL ? 'معدات تعمل بنمط طبيعي' : 'Optimal Machines'}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1">
              {summary.optimalCount} / {summary.totalMonitored}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isRTL ? 'ضمن الهامش الآمن' : 'Within safe operating envelope'}
            </div>
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
            actionFeedback.type === 'SUCCESS'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : actionFeedback.type === 'WARNING'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse'
              : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : actionFeedback.type === 'WARNING' ? (
              <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SPECIAL HIGHLIGHT PANEL: Heavy Granulator & Shredder 360 */}
      {selectedPattern && (
        <div className="bg-[#111218] border border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl relative">
          {/* Subtle glowing accent background */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Machine Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-cyan-950/30 via-slate-900/40 to-transparent border-b border-white/10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                    selectedPattern.isOverdue
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-lg shadow-rose-500/20 animate-pulse'
                      : selectedPattern.isImpending
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  }`}
                >
                  {selectedPattern.category === 'SHREDDING' ? (
                    <Flame className="w-6 h-6" />
                  ) : (
                    <Wrench className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {selectedPattern.machineCode}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                      {selectedPattern.category}
                    </span>
                    {selectedPattern.isOverdue ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {isRTL
                          ? `تجاوز حد الصيانة بـ ${selectedPattern.currentOperatingHours - selectedPattern.maintenanceThresholdHours} ساعة`
                          : `OVERDUE by ${selectedPattern.currentOperatingHours - selectedPattern.maintenanceThresholdHours} hours`}
                      </span>
                    ) : selectedPattern.isImpending ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {isRTL
                          ? `اقتراب الصيانة (متبقي ${selectedPattern.hoursRemaining} ساعة)`
                          : `Due in ${selectedPattern.hoursRemaining} hours`}
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {isRTL ? 'جاهزية طبيعية' : 'Optimal'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                    {isRTL ? selectedPattern.nameAr : selectedPattern.nameEn}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL ? selectedPattern.sectionAr : selectedPattern.sectionEn} •{' '}
                    {isRTL ? 'الفني المسؤول:' : 'Assigned Tech:'}{' '}
                    <span className="text-slate-200 font-semibold">{selectedPattern.assignedTechnician}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons for this machine */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => openServiceModal(selectedPattern)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Wrench className="w-4 h-4" />
                  <span>
                    {selectedPattern.category === 'SHREDDING'
                      ? isRTL
                        ? 'تنفيذ شحذ السكاكين وتصفية التنبيه'
                        : 'Perform Blade Sharpening & Clear'
                      : isRTL
                      ? 'تسجيل الصيانة وتحديث الدورة'
                      : 'Log Service & Advance Interval'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Machine Telemetry & Usage Patterns Body */}
          <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Interval Progress & Operating Hours Gauge */}
            <div className="bg-[#181920] rounded-xl p-4 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  {isRTL ? 'دورة خدمة الصيانة الدورية' : 'Maintenance Service Interval'}
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {selectedPattern.intervalHours} {isRTL ? 'ساعة / دورة' : 'hrs / cycle'}
                </span>
              </div>

              {/* Large Progress Bar with Markers */}
              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5 font-mono">
                  <span className="text-slate-400">
                    {isRTL ? 'الساعات الحالية:' : 'Current Hours:'}{' '}
                    <strong className="text-white text-base">{selectedPattern.currentOperatingHours.toLocaleString()}h</strong>
                  </span>
                  <span className="text-slate-400">
                    {isRTL ? 'الحد الأقصى:' : 'Threshold:'}{' '}
                    <strong className="text-cyan-300 text-base">{selectedPattern.maintenanceThresholdHours.toLocaleString()}h</strong>
                  </span>
                </div>

                <div className="h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedPattern.isOverdue
                        ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 animate-pulse'
                        : selectedPattern.isImpending
                        ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, selectedPattern.intervalProgressPct)}%` }}
                  />
                  {/* Threshold marker at 100% */}
                  <div className="absolute top-0 right-0 bottom-0 w-0.5 bg-rose-500 shadow-sm" />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-mono">
                  <span>
                    {isRTL ? 'استهلاك الدورة:' : 'Cycle Consumed:'}{' '}
                    <strong
                      className={
                        selectedPattern.intervalProgressPct >= 100
                          ? 'text-rose-400 font-bold'
                          : 'text-cyan-300'
                      }
                    >
                      {selectedPattern.intervalProgressPct}%
                    </strong>
                  </span>
                  <span>
                    {selectedPattern.isOverdue ? (
                      <strong className="text-rose-400 font-bold">
                        +{selectedPattern.currentOperatingHours - selectedPattern.maintenanceThresholdHours}h {isRTL ? 'تجاوز' : 'Overdue'}
                      </strong>
                    ) : (
                      <strong className="text-amber-300">
                        {selectedPattern.hoursRemaining}h {isRTL ? 'متبقية' : 'Remaining'}
                      </strong>
                    )}
                  </span>
                </div>
              </div>

              {/* Shredder Specific Operational Insight */}
              {selectedPattern.category === 'SHREDDING' && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      {isRTL
                        ? 'تنبيه تشغيل مفرمة الثرم 360 (الثرم والمجرشة)'
                        : 'Shredder 360 Heavy Rotor Alert'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    {isRTL
                      ? 'تم تجاوز حد الـ 1500 ساعة التشغيلية. يجب شحذ طقم السكاكين الدوارة الأربعة D2 وضبط الخلوص عند 0.25 ملم مع ملء شحم الليثيوم SKF للمحامل لمنع زيادة استهلاك الكهرباء وانسداد الحبيبات.'
                      : 'Operating limit of 1500h exceeded. The 4 rotary D2 tool steel blades must be sharpened and regapped to 0.25mm with fresh SKF heavy grease to prevent motor strain and uneven regrind flakes.'}
                  </p>
                </div>
              )}
            </div>

            {/* Column 2: Equipment Usage Patterns & Telemetry */}
            <div className="bg-[#181920] rounded-xl p-4 border border-white/5 space-y-4">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-400" />
                {isRTL ? 'نمط التشغيل والأحمال اللحظية' : 'Usage Pattern & Live Telemetry'}
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {isRTL ? 'معدل التشغيل اليومي' : 'Daily Velocity'}
                  </div>
                  <div className="text-sm font-bold font-mono text-cyan-300 mt-0.5">
                    {selectedPattern.dailyRuntimeHours} {isRTL ? 'ساعة / يوم' : 'h / day'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {isRTL ? selectedPattern.dutyCycleLabelAr : selectedPattern.dutyCycleLabelEn}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {isRTL ? 'الإنتاج المقدر بالدورة' : 'Cycle Output'}
                  </div>
                  <div className="text-sm font-bold font-mono text-amber-300 mt-0.5">
                    {Math.round(selectedPattern.estimatedThroughputKG / 1000)} {isRTL ? 'طن مجروش' : 'Tons'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {isRTL ? 'بموجب مستند 360' : 'Regrind throughput'}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {isRTL ? 'سرعة اهتزاز المحامل' : 'Vibration Velocity'}
                  </div>
                  <div
                    className={`text-sm font-bold font-mono mt-0.5 ${
                      selectedPattern.vibrationVelocityMmS > 5.0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {selectedPattern.vibrationVelocityMmS} mm/s
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {selectedPattern.vibrationVelocityMmS > 5.0
                      ? isRTL ? 'مرتفع - خطر عدم اتزان' : 'Elevated vibration'
                      : isRTL ? 'ضمن النطاق القياسي' : 'Normal range'}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {isRTL ? 'حرارة التشغيل' : 'Operating Temp'}
                  </div>
                  <div className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                    {selectedPattern.operatingTempC}°C
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {isRTL ? 'حجرة الثرم والمحرك' : 'Chamber & motor'}
                  </div>
                </div>
              </div>

              {/* Specific Wear Metric Card */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-white/10">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">
                    {isRTL ? selectedPattern.specificWearMetric.labelAr : selectedPattern.specificWearMetric.labelEn}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      selectedPattern.specificWearMetric.status === 'CRITICAL'
                        ? 'text-rose-400'
                        : selectedPattern.specificWearMetric.status === 'ELEVATED'
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                    }`}
                  >
                    {selectedPattern.specificWearMetric.value}
                    {selectedPattern.specificWearMetric.unit}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      selectedPattern.specificWearMetric.status === 'CRITICAL'
                        ? 'bg-rose-500'
                        : selectedPattern.specificWearMetric.status === 'ELEVATED'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, (selectedPattern.specificWearMetric.value / (selectedPattern.specificWearMetric.threshold || 100)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>{isRTL ? 'الحد الحرج المسموح:' : 'Critical Limit:'} {selectedPattern.specificWearMetric.threshold}{selectedPattern.specificWearMetric.unit}</span>
                  <span>{selectedPattern.specificWearMetric.status}</span>
                </div>
              </div>
            </div>

            {/* Column 3: Interactive Usage Simulator & Trigger Tester */}
            <div className="bg-[#181920] rounded-xl p-4 border border-white/5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    {isRTL ? 'محاكي نمط الاستهلاك وإطلاق التنبيه' : 'Usage Pattern Simulator & Alert Trigger'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                    Interactive
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  {isRTL
                    ? 'اختبر إطلاق التنبيه في الوقت الحقيقي بمحاكاة تشغيل الماكينة وإضافة ساعات عمل لاختبار تجاوز حد الصيانة الدوري.'
                    : 'Simulate advancing machine runtime forward to demonstrate how crossing the maintenance interval triggers immediate notifications and alarms.'}
                </p>

                {/* Preset Hours Advance Buttons */}
                <div className="mt-3.5 space-y-2">
                  <div className="text-[11px] text-slate-400 font-medium">
                    {isRTL ? 'اختر عدد ساعات التشغيل الإضافية:' : 'Advance Operating Runtime:'}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[4, 8, 16, 24].map((hrs) => (
                      <button
                        key={hrs}
                        onClick={() => setSimHours(hrs)}
                        className={`py-1.5 rounded-lg font-mono text-xs font-semibold border transition-all ${
                          simHours === hrs
                            ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        +{hrs}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <button
                  disabled={isSimulating}
                  onClick={() => handleSimulateUsage(selectedPattern.machineId, simHours)}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>
                    {isSimulating
                      ? isRTL ? 'جاري المحاكاة والحساب...' : 'Simulating telemetry...'
                      : isRTL
                      ? `محاكاة تشغيل +${simHours} ساعة وإطلاق التنبيه`
                      : `Simulate +${simHours}h & Trigger Alert`}
                  </span>
                </button>

                <button
                  onClick={() =>
                    handleResetToNominal(
                      selectedPattern.machineId,
                      Math.max(0, selectedPattern.maintenanceThresholdHours - selectedPattern.intervalHours + 100)
                    )
                  }
                  className="w-full py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title={isRTL ? 'إعادة ضبط ساعات الماكينة للتجربة' : 'Reset machine hours for testing'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إعادة ضبط الساعات إلى الوضع الطبيعي (تجريبي)' : 'Reset to Pre-Alert Nominal Hours'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE NOTIFICATIONS LIST & ALERTS DRAWER */}
      <div className="bg-[#111218] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isRTL ? 'قائمة التنبيهات الفورية وإشعارات تجاوز فترات الصيانة' : 'Active Interval Breach Notifications'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'إشعارات حية ومحدثة لحظياً للماكينات التي بلغت أو تجاوزت فترات الصيانة الميكانيكية'
                  : 'Real-time alert queue for machinery reaching or exceeding service thresholds'}
              </p>
            </div>
          </div>

          <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 self-start sm:self-center">
            {summary.notifications.length} {isRTL ? 'إشعار نشط' : 'Active Notifications'}
          </span>
        </div>

        {summary.notifications.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-white/10 text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white">
              {isRTL ? 'كافة الماكينات تعمل ضمن النطاق الآمن' : 'All Machinery Within Safe Intervals'}
            </div>
            <p className="text-xs max-w-md mx-auto text-slate-400">
              {isRTL
                ? 'لا توجد ماكينات تجاوزت فترات الصيانة المقررة حالياً. يمكنك استخدام محاكي التشغيل أعلاه لاختبار إطلاق التنبيهات.'
                : 'No machines currently exceed their service thresholds. Use the simulator above to test triggering alerts.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.notifications.map((notif) => {
              const matchedPattern = summary.usagePatterns.find((p) => p.machineId === notif.machineId);
              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all ${
                    notif.severity === 'CRITICAL'
                      ? 'bg-rose-500/10 border-rose-500/40 shadow-sm shadow-rose-500/10'
                      : notif.severity === 'WARNING'
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-cyan-500/10 border-cyan-500/30'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            notif.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                              : notif.severity === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          }`}
                        >
                          {notif.severity === 'CRITICAL'
                            ? isRTL ? 'حرج: تجاوز حد الصيانة' : 'CRITICAL OVERDUE'
                            : notif.severity === 'WARNING'
                            ? isRTL ? 'تحذير: موعد وشيك' : 'WARNING DUE SOON'
                            : isRTL ? 'متابعة دورية' : 'ATTENTION'}
                        </span>

                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white">
                          {notif.machineCode}
                        </span>

                        <span className="text-xs text-slate-400">
                          {isRTL ? notif.sectionAr : notif.sectionEn}
                        </span>

                        <span className="text-xs font-mono text-slate-500">
                          {new Date(notif.triggeredAt).toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {notif.id.includes('SENSOR') && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            <span>{isRTL ? 'مستشعرات تيار وشفرات الثرم' : 'Shredder Sensor Telemetry'}</span>
                          </span>
                        )}

                        {notif.acknowledged && (
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {isRTL ? 'معتمد' : 'Acknowledged'}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white">
                        {isRTL ? notif.titleAr : notif.titleEn}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {isRTL ? notif.messageAr : notif.messageEn}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                        <div>
                          {isRTL ? 'ساعات التشغيل:' : 'Runtime:'}{' '}
                          <strong className="text-white font-mono">{notif.currentOperatingHours}h</strong> /{' '}
                          <span className="font-mono">{notif.maintenanceThresholdHours}h</span>
                        </div>
                        <div>
                          {isRTL ? 'الإجراء الموصى به:' : 'Action:'}{' '}
                          <span className="text-cyan-300 font-medium">
                            {isRTL ? notif.recommendedActionAr : notif.recommendedActionEn}
                          </span>
                        </div>
                        {notif.recommendedPartsAr && (
                          <div>
                            {isRTL ? 'القطع المطلوبة:' : 'Parts:'}{' '}
                            <span className="text-amber-300 font-mono text-[11px]">
                              {isRTL ? notif.recommendedPartsAr : notif.recommendedPartsEn}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notification Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-start lg:self-center flex-wrap">
                      {notif.id.includes('SENSOR') && (
                        <button
                          onClick={() => setCurrentPage('shredding')}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title={isRTL ? 'الانتقال إلى شاشة مراقبة مستشعرات الثرم' : 'Open Shredder Sensor Telemetry'}
                        >
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{isRTL ? 'المستشعرات' : 'Sensors'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const targetPattern = matchedPattern || summary.usagePatterns.find((p) => p.category === 'SHREDDING');
                          if (targetPattern) {
                            openServiceModal(targetPattern, notif.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'تنفيذ الصيانة والحل' : 'Resolve & Log'}</span>
                      </button>

                      {!notif.acknowledged ? (
                        <button
                          onClick={() => handleAcknowledge(notif)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title={isRTL ? 'تأكيد واعتماد الإشعار' : 'Acknowledge alert'}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isRTL ? 'اعتماد' : 'Ack'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          {notif.acknowledgedBy}
                        </span>
                      )}

                      <button
                        onClick={() => handleSnooze(notif, 4)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-xs transition-colors cursor-pointer"
                        title={isRTL ? 'تأجيل الإشعار 4 ساعات' : 'Snooze 4h'}
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FLEET EQUIPMENT USAGE MONITORING TABLE / GRID */}
      <div className="bg-[#111218] border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>{isRTL ? 'جدول أنماط استهلاك ماكينات المصنع ودورات الصيانة' : 'Factory Equipment Fleet Usage & Intervals'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'استعراض شامل لكافة خطوط الإنتاج والكسارات والموازين ومعدات المرافق مع مؤشرات الاستهلاك'
                : 'Complete registry of all production lines, shredders, scales, and utility assets'}
            </p>
          </div>

          {/* Search & Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute top-2.5 left-2.5 text-slate-400 rtl:right-2.5 rtl:left-auto" />
              <input
                type="text"
                placeholder={isRTL ? 'بحث بالاسم أو الكود...' : 'Search equipment...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 rtl:pr-8 rtl:pl-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/10 text-xs">
              {(['ALL', 'OVERDUE', 'IMMINENT', 'OPTIMAL'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3 py-1 rounded-md font-medium transition-all ${
                    activeFilter === tab
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'ALL'
                    ? isRTL ? 'الكل' : 'All'
                    : tab === 'OVERDUE'
                    ? isRTL ? 'تجاوزت الحد' : 'Overdue'
                    : tab === 'IMMINENT'
                    ? isRTL ? 'وشيكة' : 'Due Soon'
                    : isRTL ? 'طبيعية' : 'Optimal'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Machinery Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/5">
                <th className="py-2.5 px-3 text-start">{isRTL ? 'الماكينة / الكود' : 'Machine / Code'}</th>
                <th className="py-2.5 px-3 text-start">{isRTL ? 'الفئة والموقع' : 'Category & Section'}</th>
                <th className="py-2.5 px-3 text-start">{isRTL ? 'نمط التشغيل' : 'Usage Pattern'}</th>
                <th className="py-2.5 px-3 text-start">{isRTL ? 'ساعات التشغيل / الحد' : 'Current / Threshold'}</th>
                <th className="py-2.5 px-3 text-start">{isRTL ? 'دورة الصيانة والاستهلاك' : 'Interval Progress'}</th>
                <th className="py-2.5 px-3 text-start">{isRTL ? 'الحالة' : 'Status'}</th>
                <th className="py-2.5 px-3 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filteredPatterns.map((p) => {
                const isSelected = selectedPattern.machineId === p.machineId;
                return (
                  <tr
                    key={p.machineId}
                    onClick={() => setSelectedMachineId(p.machineId)}
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="font-mono text-cyan-400">{p.machineCode}</span>
                        <span>{isRTL ? p.nameAr : p.nameEn}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isRTL ? 'الفني:' : 'Tech:'} {p.assignedTechnician}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-300 font-medium">{p.category}</div>
                      <div className="text-[11px] text-slate-500">{isRTL ? p.sectionAr : p.sectionEn}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-300">
                        {isRTL ? p.dutyCycleLabelAr : p.dutyCycleLabelEn}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        ~{p.dailyRuntimeHours} h/day • {p.specificWearMetric.labelEn}: {p.specificWearMetric.value}{p.specificWearMetric.unit}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="text-white font-bold">
                        {p.currentOperatingHours.toLocaleString()}h
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isRTL ? 'الحد:' : 'Limit:'} {p.maintenanceThresholdHours.toLocaleString()}h (دورة {p.intervalHours}h)
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span
                            className={
                              p.isOverdue
                                ? 'text-rose-400 font-bold'
                                : p.isImpending
                                ? 'text-amber-300 font-bold'
                                : 'text-slate-300'
                            }
                          >
                            {p.intervalProgressPct}%
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            {p.isOverdue
                              ? `+${p.currentOperatingHours - p.maintenanceThresholdHours}h`
                              : `${p.hoursRemaining}h`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              p.isOverdue
                                ? 'bg-rose-500 animate-pulse'
                                : p.isImpending
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, p.intervalProgressPct)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {p.isOverdue ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          {isRTL ? 'واجبة الصيانة' : 'OVERDUE'}
                        </span>
                      ) : p.isImpending ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {isRTL ? 'موعد وشيك' : 'DUE SOON'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {isRTL ? 'جاهزة' : 'OPTIMAL'}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openServiceModal(p);
                          }}
                          className="px-2.5 py-1 rounded bg-cyan-600/80 hover:bg-cyan-600 text-white font-medium text-[11px] transition-colors"
                        >
                          {isRTL ? 'صيانة' : 'Service'}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSimulateUsage(p.machineId, 8);
                          }}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] border border-white/10 font-mono"
                          title={isRTL ? 'محاكاة تشغيل +8 ساعات' : 'Simulate +8h run'}
                        >
                          +8h
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK WORK ORDER & SERVICE LOG MODAL */}
      {isServiceModalOpen && serviceMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111218] border border-white/20 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-950/40 to-slate-900 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'أمر عمل صيانة الماكينة وتصفية التنبيه' : 'Maintenance Work Order & Alert Resolution'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {serviceMachine.code} • {isRTL ? serviceMachine.nameAr : serviceMachine.nameEn}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsServiceModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmService} className="p-4 sm:p-6 space-y-4 text-xs">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-cyan-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">
                    {isRTL ? 'قراءة ساعات الماكينة الحالية:' : 'Current Operating Hours:'}
                  </div>
                  <div className="text-base font-bold font-mono text-white">
                    {serviceMachine.currentOperatingHours}h
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">
                    {isRTL ? 'الحد القادم بعد الصيانة (+دورة):' : 'Next Interval Threshold:'}
                  </div>
                  <div className="text-base font-bold font-mono text-cyan-300">
                    {serviceMachine.currentOperatingHours + serviceMachine.intervalHours}h (+{serviceMachine.intervalHours}h)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {isRTL ? 'الفني المنفذ:' : 'Performed By:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={serviceTech}
                    onChange={(e) => setServiceTech(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {isRTL ? 'نوع الصيانة:' : 'Maintenance Task Type:'}
                  </label>
                  <select
                    value={serviceTaskType}
                    onChange={(e) => setServiceTaskType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="PREVENTIVE">{isRTL ? 'صيانة وقائية دورية' : 'Preventive Routine'}</option>
                    <option value="LUBRICATION">{isRTL ? 'تشحيم وتزييت وضبط سكاكين' : 'Lubrication & Blade Gap'}</option>
                    <option value="CORRECTIVE">{isRTL ? 'صيانة تصحيحية' : 'Corrective'}</option>
                    <option value="OVERHAUL">{isRTL ? 'عمرة شاملة' : 'Complete Overhaul'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {isRTL ? 'ساعات التوقف (Downtime):' : 'Downtime (Hours):'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="48"
                    value={serviceDowntime}
                    onChange={(e) => setServiceDowntime(parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {isRTL ? 'التكلفة الإجمالية التقديرية ($ USD):' : 'Total Cost (USD):'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={serviceCost}
                    onChange={(e) => setServiceCost(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {isRTL ? 'قطع الغيار المستبدلة / المواد المستخدمة:' : 'Parts Replaced / Consumables:'}
                </label>
                <input
                  type="text"
                  value={servicePartsAr}
                  onChange={(e) => setServicePartsAr(e.target.value)}
                  placeholder={isRTL ? 'مثال: شفرات سكاكين D2، شحم ليثيوم SKF...' : 'e.g. D2 Knives, SKF Lithium grease...'}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {isRTL ? 'ملاحظات المشرف وتفاصيل الخدمة:' : 'Supervisor Notes & Technical Details:'}
                </label>
                <textarea
                  rows={2}
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isRTL ? 'اعتماد الصيانة وتصفية التنبيه' : 'Confirm Service & Clear Alert'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
