import React, { useState } from 'react';
import {
  Truck,
  Scale,
  PackageCheck,
  Flame,
  Boxes,
  Factory,
  Layers,
  AlertOctagon,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Sparkles,
  Weight,
  Gauge,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  PackageX,
  Wrench,
  Zap,
  User,
  X,
  Sliders,
  Scan,
  Bell,
  BarChart3,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { MaterialFlowSankeyDiagram } from './MaterialFlowSankeyDiagram';
import { WarehouseFloorPlanMap } from './WarehouseFloorPlanMap';
import { ShiftHourlyEfficiencyChart } from './ShiftHourlyEfficiencyChart';
import { ShiftHistoryTrendChart } from './ShiftHistoryTrendChart';
import { WorkflowProgressTracker } from './WorkflowProgressTracker';
import { LowStockNotificationPanel } from './LowStockNotificationPanel';
import { PredictiveInventoryForecastingWidget } from './PredictiveInventoryForecastingWidget';
import { DataIntegrityWidget } from './DataIntegrityWidget';
import { PredictiveMaintenanceWidget } from './PredictiveMaintenanceWidget';
import { EfficiencyAlertBanner } from './EfficiencyAlertBanner';
import { QualityControlHeatmapWidget } from './QualityControlHeatmapWidget';
import { CurrentShiftKpiSummaryCard } from './CurrentShiftKpiSummaryCard';
import { ExecutiveSummarySection } from './ExecutiveSummarySection';
import {
  getStoredMachines,
  logCompletedMaintenanceTask,
  FactoryMachine,
} from '../services/maintenanceService';
import { NavigationPage } from '../types';
import { useTenant } from '../context/TenantContext';
import { Building2, Server, Archive, ArrowDownLeft, ArrowRightLeft, ShoppingCart, Warehouse as WarehouseIcon, HardHat, Plus } from 'lucide-react';
import { WarehouseWorkerModeModal } from './WarehouseWorkerModeModal';
import { SmartInsightsDashboardSection } from './SmartInsightsDashboardSection';
import { WarehouseAssistantModal } from './WarehouseAssistantModal';

export const CommandCenterDashboard: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { currentOrganization, switchOrganization, organizations, setIsOnboardingOpen } = useTenant();
  const {
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    inventoryBalances,
    pendingActions,
    locations,
    warehouses,
    lowStockOverview,
    currentUser,
    logAudit,
    setCurrentPage,
    jumpToPendingAction,
  } = useFactory();

  // Machinery Maintenance State
  const [machinesList, setMachinesList] = useState<FactoryMachine[]>(() => getStoredMachines());
  const [quickCompleteMachine, setQuickCompleteMachine] = useState<FactoryMachine | null>(null);
  const [quickTech, setQuickTech] = useState('');
  const [quickHours, setQuickHours] = useState(2);
  const [quickNotes, setQuickNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showWorkerMode, setShowWorkerMode] = useState(false);
  const [showAssistantModal, setShowAssistantModal] = useState(false);

  // Calculate live telemetry metrics
  const todayStr = '2026-09-02';

  const todayReceiptsCount = receivingTransactions.filter((r) => r.date === todayStr).length;
  const todayKGReceived = receivingTransactions
    .filter((r) => r.date === todayStr && r.netReceivedWeightKG > 0)
    .reduce((sum, r) => sum + r.netReceivedWeightKG, 0);

  const todayShreddingCount = shreddingTransactions.filter((s) => s.shreddingStart.includes(todayStr)).length;
  const todayShreddedKG = shreddingTransactions
    .filter((s) => s.shreddingStart.includes(todayStr) && s.outputKG > 0)
    .reduce((sum, s) => sum + s.outputKG, 0);

  const todayProdIssueKG = productionIssues
    .filter((p) => p.date === todayStr)
    .reduce((sum, p) => sum + p.quantityKG, 0);

  const totalInventoryKG = inventoryBalances.reduce((sum, b) => sum + b.totalBalanceKG, 0);
  const totalBulkBags = inventoryBalances.reduce((sum, b) => sum + b.bulkBagsCount, 0);

  const totalProductionDamageKG = shreddingTransactions.reduce(
    (sum, s) => sum + (s.productionDamageKG || 0),
    0
  );

  const varianceAlertsCount = shreddingTransactions.filter((s) => s.isAbnormalVariance).length;

  const overdueMachines = machinesList.filter(
    (m) => m.currentOperatingHours >= m.maintenanceThresholdHours
  );

  const openDashboardQuickComplete = (machine: FactoryMachine) => {
    setQuickCompleteMachine(machine);
    setQuickTech(machine.assignedTechnician || currentUser?.nameAr || currentUser?.name || 'فني الصيانة');
    setQuickHours(2);
    setQuickNotes(
      isRTL
        ? `صيانة وقائية دورية ومعايرة سريعة [${machine.code}]`
        : `Routine preventive inspection & lubrication [${machine.code}]`
    );
  };

  const handleSaveDashboardQuickComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCompleteMachine) return;
    try {
      const techName = quickTech.trim() || quickCompleteMachine.assignedTechnician;
      const hoursWorked = Number(quickHours) > 0 ? Number(quickHours) : 1;
      const result = logCompletedMaintenanceTask({
        machineId: quickCompleteMachine.id,
        taskTitleEn: `Quick Preventive Maintenance (${quickCompleteMachine.code})`,
        taskTitleAr: `صيانة وقائية دورية سريعة (${quickCompleteMachine.code})`,
        taskType: 'PREVENTIVE',
        downtimeHours: hoursWorked,
        performedBy: techName,
        supervisorSignOff: `${currentUser?.nameAr || currentUser?.name || 'المشرف'} (${currentUser?.role || 'Supervisor'})`,
        partsReplacedEn: 'Standard lubrication & routine inspection',
        partsReplacedAr: 'تشحيم قياسي وفحص دوري',
        totalCostUSD: 0,
        notesEn: `Quick marked complete from Dashboard. Tech: ${techName} (${hoursWorked}h worked). ${quickNotes}`,
        notesAr: `تم الإنجاز السريع مباشرة من لوحة التحكم. الفني: ${techName} (${hoursWorked} ساعة عمل). ${quickNotes}`,
      });

      setMachinesList(result.allMachines);
      logAudit(
        'Quick Maintenance Completed',
        'إنجاز سريع لصيانة ماكينة معلقة وإعادة ضبط حد الساعات',
        'Machinery',
        result.newTask.id,
        `${quickCompleteMachine?.nameAr || quickCompleteMachine?.code} (${quickCompleteMachine?.code})`,
        `Tech: ${techName} | Hours: ${hoursWorked}h | New Threshold: ${result.updatedMachine.maintenanceThresholdHours}h`,
        `Quick mark complete by ${currentUser?.nameAr || currentUser?.name || 'المشرف'}`
      );

      setQuickCompleteMachine(null);
      setFeedbackMessage(
        isRTL
          ? `✓ تم إنجاز الصيانة السريعة بنجاح لماكينة [${quickCompleteMachine.code}]. الفني: ${techName} (${hoursWorked} ساعة عمل). تم تمديد حد الصيانة إلى ${result.updatedMachine.maintenanceThresholdHours} ساعة.`
          : `✓ Maintenance marked complete for [${quickCompleteMachine.code}]. Tech: ${techName} (${hoursWorked}h worked). Next threshold: ${result.updatedMachine.maintenanceThresholdHours} hrs.`
      );
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch (err) {
      console.error(err);
    }
  };

  // Main 8 Command Actions
  interface CommandActionCard {
    id: NavigationPage;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeCount?: number;
    badgeText?: string;
    legacyDoc?: string;
  }

  const commandActions: CommandActionCard[] = [
    {
      id: 'receiving',
      titleAr: 'استلام',
      titleEn: 'RECEIVE',
      descAr: 'وزن الدخول وتسجيل الشاحنات والموردين',
      descEn: 'Weighbridge Scale In & Vehicle Intake',
      icon: Truck,
      accentColor: 'from-cyan-500/20 via-cyan-600/10 to-transparent border-cyan-500/40 text-cyan-300 hover:border-cyan-400 hud-glow-cyan',
      legacyDoc: 'مستند 546',
    },
    {
      id: 'scale_out',
      titleAr: 'الميزان بعد التفريغ',
      titleEn: 'SCALE OUT',
      descAr: 'وزن الخروج (فارغ) واحتساب الوزن الصافي',
      descEn: 'Tare Weighing & Net Received Calculation',
      icon: Scale,
      accentColor: 'from-amber-500/20 via-amber-600/10 to-transparent border-amber-500/40 text-amber-300 hover:border-amber-400 hud-glow-amber',
      badgeCount: receivingTransactions.filter((r) => r.status === 'Scale In Completed' || r.status === 'Unloading Completed').length,
    },
    {
      id: 'unloading',
      titleAr: 'التفريغ',
      titleEn: 'UNLOADING',
      descAr: 'تفريغ الشاحنات وتعيين الأرصفة وفحص الجودة',
      descEn: 'Bay Allocation, Unloading & Quality Inspection',
      icon: PackageCheck,
      accentColor: 'from-blue-500/20 via-blue-600/10 to-transparent border-blue-500/40 text-blue-300 hover:border-blue-400',
    },
    {
      id: 'shredding',
      titleAr: 'الثرم',
      titleEn: 'SHRED IT (THERM)',
      descAr: 'وحدة الثرم والجرش، حساب الهوالك وتالف الإنتاج',
      descEn: 'Therm Regrind Line, Loss & Damage Variance',
      icon: Flame,
      accentColor: 'from-emerald-500/20 via-emerald-600/10 to-transparent border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hud-glow-emerald',
      legacyDoc: 'مستند 360 / 352',
      badgeCount: shreddingTransactions.filter((s) => s.status === 'In Shredding' || s.status === 'Shredding Completed').length,
    },
    {
      id: 'storage',
      titleAr: 'الخزن',
      titleEn: 'STORAGE',
      descAr: 'إيداع بالمستودع وتعيين الرفوف والشلايف',
      descEn: 'Warehouse Storage, Racks & Bulk Bags',
      icon: Boxes,
      accentColor: 'from-indigo-500/20 via-indigo-600/10 to-transparent border-indigo-500/40 text-indigo-300 hover:border-indigo-400',
    },
    {
      id: 'production',
      titleAr: 'صرف للإنتاج',
      titleEn: 'SEND TO PRODUCTION',
      descAr: 'صرف الخامات لخطوط البثق والأكواب ومستند 167',
      descEn: 'Issue Material to Extrusion & Forming Lines',
      icon: Factory,
      accentColor: 'from-purple-500/20 via-purple-600/10 to-transparent border-purple-500/40 text-purple-300 hover:border-purple-400',
      legacyDoc: 'مستند 167',
    },
    {
      id: 'inventory',
      titleAr: 'المخزون',
      titleEn: 'INVENTORY',
      descAr: 'الأرصدة الحية، الشلايف، الكيلوغرام، وتقييم المخازن',
      descEn: 'Live Balances, Bulk Bags, KG & Stock Value',
      icon: Layers,
      accentColor: 'from-teal-500/20 via-teal-600/10 to-transparent border-teal-500/40 text-teal-300 hover:border-teal-400',
    },
    {
      id: 'pending_actions',
      titleAr: 'المعاملات غير المكتملة',
      titleEn: 'PENDING ACTIONS',
      descAr: 'الكشف الآلي عن الخطوات الناقصة والمعاملات العالقة',
      descEn: 'Auto-detection of Incomplete Operations',
      icon: AlertOctagon,
      accentColor: 'from-rose-500/30 via-rose-600/15 to-transparent border-rose-500/50 text-rose-300 hover:border-rose-400 hud-glow-rose',
      badgeCount: pendingActions.length,
      badgeText: isRTL ? 'معاملة معلقة' : 'Pending',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto text-slate-200">
      {/* Active SaaS Tenant Identification Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/30 border border-cyan-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              TENANT: {currentOrganization.slug?.toUpperCase() || currentOrganization.id}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/30">
              PLAN: {currentOrganization.plan}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                currentOrganization.status === 'ACTIVE'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                  : currentOrganization.status === 'ARCHIVED'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/30'
              }`}
            >
              {currentOrganization.status}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <span>{isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {isRTL
              ? `بيانات المستودع معزولة تماماً لهذه المنشأة (${currentOrganization.country || 'العراق'}) • العملة: ${currentOrganization.currency}`
              : `Completely isolated tenant workspace (${currentOrganization.country}) • Base Currency: ${currentOrganization.currency}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCurrentPage('organization_settings')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{isRTL ? 'إعدادات المنشأة' : 'Tenant Settings'}</span>
          </button>
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-colors cursor-pointer"
          >
            <span>{isRTL ? '+ شركة جديدة' : '+ New Org'}</span>
          </button>
        </div>
      </div>

      {/* Warning Banner if Archived or Suspended */}
      {currentOrganization.status === 'ARCHIVED' && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-3">
          <Archive className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-bold">{isRTL ? 'منشأة مؤرشفة (أرشيف للقراءة فقط):' : 'Archived Tenant (Read-Only Mode):'}</span>{' '}
            {isRTL
              ? 'البيانات التاريخية محفوظة بالكامل لأغراض الامتثال والتدقيق. جميع عمليات الصرف والاستلام والتعديل مقفلة.'
              : 'All historical balances and transactions are permanently preserved for audit compliance. Write and modification operations are locked.'}
          </div>
        </div>
      )}

      {/* Enterprise Quick Actions Bar (Section 3: Dashboard Redesign) */}
      <div className="p-4 rounded-2xl bg-[#11131a] border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
            {isRTL ? 'الإجراءات السريعة:' : 'QUICK ACTIONS:'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCurrentPage('receiving')}
            className="px-3 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>{isRTL ? 'استلام (Receive)' : 'Receive'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('operations')}
            className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{isRTL ? 'صرف (Issue)' : 'Issue'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('operations')}
            className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{isRTL ? 'مناقلة (Transfer)' : 'Transfer'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('materials_master')}
            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isRTL ? 'إضافة صنف' : 'Add Item'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('warehouses')}
            className="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <WarehouseIcon className="w-3.5 h-3.5" />
            <span>{isRTL ? 'إضافة مستودع' : 'Add Warehouse'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('purchasing')}
            className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{isRTL ? 'أمر شراء' : 'Purchase Order'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('reports')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'التقارير' : 'Reports'}</span>
          </button>

          <button
            onClick={() => setShowWorkerMode(true)}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-950/40"
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>{isRTL ? 'وضع العامل' : 'Worker Mode'}</span>
          </button>
        </div>
      </div>

      {/* Phase 13: Optional Smart Warehouse Intelligence & Insights Section */}
      <SmartInsightsDashboardSection
        onOpenAssistant={() => setShowAssistantModal(true)}
        onOpenFullHub={() => setCurrentPage('smart_intelligence')}
      />

      {/* Executive Summary Section: Current Total Inventory Weight, Active Shredding Throughput, Pending Arrivals */}
      <ExecutiveSummarySection />

      {/* Current Shift Key Performance Indicators Summary Card */}
      <CurrentShiftKpiSummaryCard />

      {/* Metric Stats - 6 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Receipts Today */}
        <div className="bg-[#111218] border border-white/5 rounded-lg p-4 shadow-sm">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            {isRTL ? 'إيصالات اليوم (546)' : 'Receipts (Today)'}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-white">{todayReceiptsCount}</span>
            <span className="text-[10px] text-cyan-400 font-mono">
              {isRTL ? 'إرسالية نشطة' : '+2 from yesterday'}
            </span>
          </div>
        </div>

        {/* 2. Net Weight Received */}
        <div className="bg-[#111218] border border-white/5 rounded-lg p-4 shadow-sm">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            {isRTL ? 'الوزن الصافي المستلم' : 'Net Weight Received'}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-white">
              {(todayKGReceived ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">KG</span>
          </div>
        </div>

        {/* 3. Shredding Output */}
        <div className="bg-[#111218] border border-white/5 rounded-lg p-4 shadow-sm">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            {isRTL ? 'إنتاج مفروم الثرم' : 'Shredding Output'}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-emerald-400">
              {(todayShreddedKG ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">KG</span>
          </div>
        </div>

        {/* 4. Total Inventory */}
        <div className="bg-[#111218] border border-white/5 rounded-lg p-4 shadow-sm">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            {isRTL ? 'إجمالي المخزون الحالي' : 'Total Inventory'}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-white">
              {(totalInventoryKG / 1000).toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">TONS</span>
          </div>
        </div>

        {/* 5. Damage Rate & Quality Control */}
        <button
          onClick={() => {
            const el = document.getElementById('quality-control-heatmap-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-[#111218] border border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400 rounded-lg p-4 shadow-sm text-start cursor-pointer transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          title={isRTL ? 'الانتقال إلى خريطة الجودة ونسب العيوب اللحظية' : 'Jump to Real-Time Quality & Defect Heatmap'}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">
              {isRTL ? 'نسبة التالف وجودة الإنتاج' : 'Damage Rate & QC'}
            </p>
            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              FPY 96.8%
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-bold text-cyan-300">
              {totalProductionDamageKG > 0 ? ((totalProductionDamageKG / (totalInventoryKG || 1)) * 100).toFixed(2) : '0.84'}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">%</span>
          </div>
          <div className="text-[10px] text-cyan-400/80 font-mono mt-0.5 flex items-center justify-between">
            <span>{isRTL ? 'الخريطة الحرارية للعيوب (Heatmap)' : 'Live QC Defect Heatmap'}</span>
            <ArrowUpRight className="w-3 h-3 text-cyan-400" />
          </div>
        </button>

        {/* 6. Low Stock Notification & Procurement Alert */}
        <button
          onClick={() => {
            const el = document.getElementById('low-stock-procurement-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`border rounded-lg p-4 shadow-sm text-start cursor-pointer transition-all ${
            lowStockOverview.materialsNeedingProcurement > 0
              ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)]'
              : 'bg-[#111218] border-white/5 hover:border-white/20'
          }`}
          title={isRTL ? 'الانتقال إلى كشف نواقص المخزون والشراء' : 'Jump to Low Stock & Procurement Monitor'}
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-rose-400 uppercase tracking-widest font-bold">
              {isRTL ? 'نواقص المخزون والشراء' : 'Low Stock Alerts'}
            </p>
            {lowStockOverview.materialsNeedingProcurement > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className={`text-2xl font-mono font-bold ${
                lowStockOverview.materialsNeedingProcurement > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {lowStockOverview.materialsNeedingProcurement}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">
              {isRTL ? 'أصناف' : 'ITEMS'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
            {lowStockOverview.outOfStockCount > 0 ? (
              <span className="text-rose-400 font-bold">
                {lowStockOverview.outOfStockCount} {isRTL ? 'نفاد تام (0 كغم)' : 'Out of stock'}
              </span>
            ) : lowStockOverview.materialsNeedingProcurement > 0 ? (
              <span className="text-amber-300">
                {(lowStockOverview.totalDeficitKG / 1000).toFixed(1)} {isRTL ? 'طن عجز' : 'T deficit'}
              </span>
            ) : (
              <span className="text-emerald-400">{isRTL ? 'المخزون آمن' : 'Stock healthy'}</span>
            )}
          </div>
        </button>
      </div>

      {/* Maintenance Feedback Alert */}
      {feedbackMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer">✕</button>
        </div>
      )}

      {/* Real-Time Shredding vs Production Efficiency Notification System (>30 min Alert) */}
      <div id="efficiency-alert-section" className="scroll-mt-6">
        <EfficiencyAlertBanner
          onNavigateToShredding={() => setCurrentPage('shredding')}
          onNavigateToProduction={() => setCurrentPage('production')}
          onInspectChart={() => {
            const el = document.getElementById('hourly-efficiency-chart-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </div>

      {/* Predictive Maintenance & Proactive Machine Health Radar */}
      <div id="predictive-maintenance-section" className="scroll-mt-6">
        <PredictiveMaintenanceWidget
          onNavigateToMaintenance={() => setCurrentPage('maintenance')}
          onMachineryUpdated={() => setMachinesList(getStoredMachines())}
        />
      </div>

      {/* Quick Jump Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-1">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-300">
            {isRTL ? 'لوحة التحكم والوحدات التشغيلية' : 'Operational Modules & Command Grid'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              const el = document.getElementById('executive-summary-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى الملخص التنفيذي وموجز العمليات اللحظي' : 'Jump to Executive Summary'}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'الملخص التنفيذي' : 'Executive Summary'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
              Live
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('current-shift-kpi-summary-card');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-emerald-950 hover:from-cyan-900 hover:to-emerald-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى بطاقة مؤشرات أداء الوردية الحالية' : 'Jump to Current Shift KPI Summary'}
          >
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'مؤشرات الوردية (KPIs)' : 'Shift KPIs'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
              Live
            </span>
          </button>

          <button
            onClick={() => setCurrentPage('virtual_stock_verifier')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-teal-950 hover:from-cyan-900 hover:to-teal-900 border border-cyan-400/50 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'فاحص ومحقق المخزون الافتراضي - مسح باركود الشلايف بالكاميرا ومطابقة الموقع لحظياً' : 'Open VirtualStockVerifier - Camera QR & Location Audit'}
          >
            <Scan className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>{isRTL ? 'فاحص المخزون (كاميرا QR)' : 'Virtual Stock Verifier'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
              Camera
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('quality-control-heatmap-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى خريطة الجودة والعيوب اللحظية (Heatmap)' : 'Jump to Real-Time Quality & Defect Heatmap'}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'خريطة الجودة اللحظية (Heatmap)' : 'QC Defect Heatmap'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
              Live
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('efficiency-alert-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 hover:from-rose-900 hover:to-amber-900 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى نظام تنبيهات كفاءة الثرم والإنتاج' : 'Jump to Shredding vs Production Efficiency Alert System'}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>{isRTL ? 'تنبيه كفاءة الثرم (>30 د)' : 'Efficiency Alert (>30m)'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono font-bold border border-rose-500/30">
              Live
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('predictive-maintenance-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 hover:from-indigo-900 hover:to-purple-900 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى رادار الصيانة التنبؤية وعمر التشغيل' : 'Jump to Predictive Maintenance & TTF Radar'}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>{isRTL ? 'رادار الصيانة التنبؤية (TTF Radar)' : 'Predictive TTF Radar'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
              AI
            </span>
          </button>

          <button
            onClick={() => setCurrentPage('maintenance_alerts')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 hover:from-amber-900 hover:to-rose-900 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى نظام تنبيهات الصيانة ومراقبة نمط استهلاك المعدات' : 'Jump to Equipment Maintenance & Usage Alerts'}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'تنبيهات الصيانة والاستهلاك' : 'Maintenance Alerts'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
              HUD
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('shift-history-trend-chart-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-950 via-slate-900 to-cyan-950 hover:from-purple-900 hover:to-cyan-900 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى مخطط اتجاه الإنتاج للـ 7 ورديات الأخيرة' : 'Jump to Last 7 Shifts Trend Chart'}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span>{isRTL ? 'اتجاه الـ 7 ورديات (Recharts)' : '7-Shift Trend'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
              7 Shifts
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('hourly-efficiency-chart-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-cyan-950 hover:from-emerald-900 hover:to-cyan-900 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى مخطط كفاءة الإنتاج والثرم الساعي' : 'Jump to Hourly Shredding vs Production Efficiency Chart'}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'مخطط الكفاءة الساعية (Recharts)' : 'Hourly Efficiency Chart'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
              Live
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('material-flow-sankey-container');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى مخطط تدفق البلاستيك D3 الحركي' : 'Jump to D3 Material Flow Sankey Diagram'}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'مخطط تدفق البلاستيك (Sankey Flow)' : 'Material Flow Sankey Diagram'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
              D3.js
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('factory-floor-plan-map-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-amber-950 hover:from-cyan-900 hover:to-amber-900 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى مخطط أرضية المصنع وربط المستودعات بالثرم' : 'Jump to Factory Floor Plan Map'}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'مخطط أرضية المصنع (Floor Plan)' : 'Factory Floor Plan'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
              Map
            </span>
          </button>

          <button
            onClick={() => {
              const el = document.getElementById('predictive-inventory-forecast-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-950 via-slate-900 to-fuchsia-950 hover:from-purple-900 hover:to-fuchsia-900 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'الانتقال إلى وحدة التنبؤ بالمخزون ونقاط إعادة الطلب' : 'Jump to Predictive Inventory Forecasting & Reorder Engine'}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>{isRTL ? 'التنبؤ بالمخزون ونقاط الطلب (ROP)' : 'Inventory Forecasting (ROP)'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
              AI
            </span>
          </button>

          <button
            onClick={() => setCurrentPage('shift_optimizer')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 hover:from-indigo-900 hover:to-purple-900 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title={isRTL ? 'فتح أداة تحسين فترات الورديات والراحة للماكينات والمشغلين' : 'Launch Shift & Break Optimizer Tool'}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRTL ? 'مُحسِّن الورديات والراحة' : 'Shift Optimizer'}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 font-mono font-bold border border-indigo-500/30">
              AI Tool
            </span>
          </button>
        </div>
      </div>

      {/* Main 8 Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Module 01: Receive */}
        <button
          onClick={() => setCurrentPage('receiving')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-400 group-hover:scale-110 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 01
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isRTL ? 'استلام' : 'RECEIVE'}
            </h3>
            <p className="text-xs text-cyan-500 uppercase font-bold">
              {isRTL ? 'RECEIVE (546)' : 'استلام'}
            </p>
          </div>
        </button>

        {/* Module 02: Scale Out */}
        <button
          onClick={() => setCurrentPage('scale_out')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-slate-500/10 rounded-lg text-slate-400 group-hover:scale-110 group-hover:text-cyan-400 transition-all">
              <Scale className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 02
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isRTL ? 'الميزان' : 'SCALE OUT'}
            </h3>
            <p className="text-xs text-cyan-500 uppercase font-bold">
              {isRTL ? 'SCALE OUT' : 'الميزان'}
            </p>
          </div>
        </button>

        {/* Module 03: Unloading */}
        <button
          onClick={() => setCurrentPage('unloading')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-slate-500/10 rounded-lg text-slate-400 group-hover:scale-110 group-hover:text-cyan-400 transition-all">
              <PackageCheck className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 03
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isRTL ? 'التفريغ' : 'UNLOADING'}
            </h3>
            <p className="text-xs text-cyan-500 uppercase font-bold">
              {isRTL ? 'UNLOADING' : 'التفريغ'}
            </p>
          </div>
        </button>

        {/* Module 04: Shred It / Therm */}
        <button
          onClick={() => setCurrentPage('shredding')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500 group-hover:scale-110 transition-transform">
              <Flame className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 04
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
              {isRTL ? 'الثرم' : 'SHRED IT / THERM'}
            </h3>
            <p className="text-xs text-amber-500 uppercase font-bold font-mono">
              {isRTL ? 'SHRED IT / THERM (360)' : 'الثرم'}
            </p>
          </div>
        </button>

        {/* Module 05: Storage */}
        <button
          onClick={() => setCurrentPage('storage')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-slate-500/10 rounded-lg text-slate-400 group-hover:scale-110 group-hover:text-cyan-400 transition-all">
              <Boxes className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 05
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isRTL ? 'الخزن' : 'STORAGE'}
            </h3>
            <p className="text-xs text-cyan-500 uppercase font-bold">
              {isRTL ? 'STORAGE & RACKS' : 'الخزن'}
            </p>
          </div>
        </button>

        {/* Module 06: Production */}
        <button
          onClick={() => setCurrentPage('production')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-slate-500/10 rounded-lg text-slate-400 group-hover:scale-110 group-hover:text-cyan-400 transition-all">
              <Factory className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 06
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isRTL ? 'صرف للإنتاج' : 'PRODUCTION'}
            </h3>
            <p className="text-xs text-cyan-500 uppercase font-bold">
              {isRTL ? 'PRODUCTION (167)' : 'صرف للإنتاج'}
            </p>
          </div>
        </button>

        {/* Module 07: Inventory */}
        <button
          onClick={() => setCurrentPage('inventory')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-white/10 rounded-xl hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-slate-500/10 rounded-lg text-slate-400 group-hover:scale-110 group-hover:text-cyan-400 transition-all">
              <Layers className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase font-bold text-white/30 tracking-widest font-mono">
              MODULE 07
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
              {isRTL ? 'المخزون' : 'INVENTORY'}
            </h3>
            <p className="text-xs text-cyan-500 uppercase font-bold">
              {isRTL ? 'LIVE BALANCES' : 'المخزون'}
            </p>
          </div>
        </button>

        {/* Module 08: Pending Actions */}
        <button
          onClick={() => setCurrentPage('pending_actions')}
          className="group flex flex-col justify-between p-6 bg-gradient-to-br from-[#1c1f26] to-[#111218] border border-rose-500/30 bg-rose-500/5 rounded-xl hover:border-rose-500 transition-all text-start cursor-pointer"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-rose-500/10 rounded-lg text-rose-500 group-hover:scale-110 transition-transform">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-widest font-mono">
                {pendingActions.length}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition-colors">
              {isRTL ? 'المعاملات غير المكتملة' : 'PENDING ACTIONS'}
            </h3>
            <p className="text-xs text-rose-500 uppercase font-bold">
              {isRTL ? 'PENDING ACTIONS' : 'المعاملات غير المكتملة'}
            </p>
          </div>
        </button>
      </div>

      {/* Real-Time Quality Control & Defect Rate Heatmap */}
      <div id="quality-control-heatmap-section" className="scroll-mt-6">
        <QualityControlHeatmapWidget
          onOpenFullMonitor={() => setCurrentPage('quality_control')}
        />
      </div>

      {/* Historical Trend Chart (Recharts) - Last 7 Shifts Total Processed Weight */}
      <ShiftHistoryTrendChart />

      {/* Recharts Hourly Shredding vs Production Output Efficiency Line Chart */}
      <ShiftHourlyEfficiencyChart />

      {/* Real-time Material Flow Sankey Diagram */}
      <MaterialFlowSankeyDiagram />

      {/* Visual Floor Plan Component Mapping Warehouse Storage Locations to Shredding Machines */}
      <WarehouseFloorPlanMap />

      {/* Live Visual Material Flow Stepper */}
      <WorkflowProgressTracker currentStatus="Received" requiresShredding={true} />

      {/* Predictive Inventory Runway & Dynamic Reorder Points Forecasting Center */}
      <PredictiveInventoryForecastingWidget />

      {/* Low Stock Notification & Procurement Highlights Center */}
      <div id="low-stock-procurement-section" className="scroll-mt-6">
        <LowStockNotificationPanel />
      </div>

      {/* Data Integrity, Backup Frequency & Audit Export Center */}
      <DataIntegrityWidget />

      {/* Live Pending Queue Footer Table & Warehouse Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pending List Table (7 cols) */}
        <div className="lg:col-span-7 bg-[#111218] border border-white/5 rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-4 py-2.5 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                  {isRTL ? 'قائمة المعاملات المعلقة الحية' : 'Live Pending Queue'}
                </span>
              </div>
              <button
                onClick={() => setCurrentPage('pending_actions')}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-semibold"
              >
                {isRTL ? 'عرض كافة المعاملات' : 'View All Transactions'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="text-slate-500 uppercase text-[9px] border-b border-white/5 tracking-wider">
                    <th className="px-4 py-2 font-bold">{isRTL ? 'الأولوية' : 'Priority'}</th>
                    <th className="px-4 py-2 font-bold">{isRTL ? 'رقم الإرسالية' : 'Ref. ID'}</th>
                    <th className="px-4 py-2 font-bold">{isRTL ? 'المادة' : 'Material'}</th>
                    <th className="px-4 py-2 font-bold">{isRTL ? 'المطلوب' : 'Missing Step'}</th>
                    <th className="px-4 py-2 font-bold text-end">{isRTL ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pendingActions.slice(0, 4).map((action) => (
                    <tr
                      key={action.id}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        action.priority === 'CRITICAL' ? 'bg-rose-500/[0.03]' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            action.priority === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {action.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300 font-bold">
                        {action.transactionNumber}
                      </td>
                      <td className="px-4 py-2.5 text-slate-200 font-medium">
                        {action.materialName}
                      </td>
                      <td className="px-4 py-2.5 text-amber-400 font-semibold text-[11px]">
                        {isRTL ? action.missingStepAr : action.missingStep}
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <button
                          onClick={() => jumpToPendingAction(action)}
                          className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-white rounded text-[9px] font-bold uppercase transition-colors"
                        >
                          {isRTL ? 'تنفيذ' : 'Resume'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pendingActions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500 text-xs">
                        {isRTL ? 'لا توجد معاملات معلقة حالياً ✓' : 'No pending queue items ✓'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Warehouse Occupancy (5 cols) */}
        <div className="lg:col-span-5 bg-[#111218] border border-white/5 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {isRTL ? 'طاقة استيعاب مستودعات المصنع' : 'Warehouse Storage Occupancy'}
                  </h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {isRTL ? 'نسبة الإشغال وسعة الشلايف' : 'Capacity utilization & bulk bags'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentPage('storage')}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-wider underline"
              >
                {isRTL ? 'المستودع' : 'View Storage'}
              </button>
            </div>

            <div className="space-y-3">
              {warehouses.map((wh) => {
                const whLocations = locations.filter((l) => l.warehouseId === wh.id);
                const currentKG = whLocations.reduce((sum, l) => sum + l.currentKG, 0);
                const totalBags = whLocations.reduce((sum, l) => sum + l.bulkBagsCount, 0);
                const pct = Math.min(100, Math.round((currentKG / wh.totalCapacityKG) * 100));

                return (
                  <div key={wh.id} className="p-3 rounded-lg bg-[#0f1115] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">
                        {wh ? (isRTL ? (wh.nameAr || wh.nameEn) : (wh.nameEn || wh.nameAr)) : ''}
                      </span>
                      <span className="font-mono text-cyan-400 font-bold">{pct}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{(currentKG ?? 0).toLocaleString()} / {(wh.totalCapacityKG ?? 0).toLocaleString()} KG</span>
                      <span className="text-amber-400 font-bold">{totalBags} {isRTL ? 'شليف' : 'Bags'}</span>
                    </div>

                    <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">
                        {isRTL ? 'أمين المخزن:' : 'Storekeeper:'} <strong className="text-amber-300 font-semibold">{isRTL ? (wh.storekeeperAr || wh.storekeeper) : wh.storekeeper}</strong>
                      </span>
                      <span className="text-slate-500 font-mono">
                        {isRTL ? 'مدير: أحمد خليل' : 'Mgr: Ahmed Khalil'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {isRTL ? 'حركات المخزن مؤمنة دفترياً' : 'Auditable movements'}
            </span>
            <button
              onClick={() => setCurrentPage('movements')}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-[10px] uppercase tracking-wider"
            >
              {isRTL ? 'دفتر الحركات' : 'Movement Ledger'}
            </button>
          </div>
        </div>
      </div>

      {/* QUICK COMPLETE MODAL FROM DASHBOARD */}
      {quickCompleteMachine && (
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
                      {quickCompleteMachine.code}
                    </span>
                    <span className="text-xs text-emerald-400 font-semibold font-mono">
                      {isRTL ? 'إنجاز سريع من لوحة التحكم' : 'Dashboard Quick Completion'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                    {isRTL ? 'توثيق وإنجاز صيانة الماكينة فوراً' : 'Quick Mark Maintenance Complete'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {quickCompleteMachine ? (isRTL ? (quickCompleteMachine.nameAr || quickCompleteMachine.nameEn) : (quickCompleteMachine.nameEn || quickCompleteMachine.nameAr)) : ''} (
                    {quickCompleteMachine ? (isRTL ? quickCompleteMachine.sectionAr : quickCompleteMachine.sectionEn) : ''})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickCompleteMachine(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Telemetry Snapshot Banner */}
            <div className="p-3 bg-black/40 border border-white/5 rounded-xl font-mono text-xs grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-white/5">
                <div className="text-[10px] text-slate-400 font-sans">{isRTL ? 'العداد الحالي:' : 'Current Meter:'}</div>
                <div className="text-white font-bold mt-0.5">{quickCompleteMachine.currentOperatingHours} hrs</div>
              </div>
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <div className="text-[10px] text-rose-300 font-sans">{isRTL ? 'التجاوز المتأخر:' : 'Overdue By:'}</div>
                <div className="text-rose-400 font-bold mt-0.5">
                  +{quickCompleteMachine.currentOperatingHours - quickCompleteMachine.maintenanceThresholdHours} hrs
                </div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-300 font-sans">{isRTL ? 'الحد الجديد:' : 'New Threshold:'}</div>
                <div className="text-emerald-400 font-bold mt-0.5">
                  {quickCompleteMachine.currentOperatingHours + quickCompleteMachine.intervalHours} hrs
                </div>
              </div>
            </div>

            {/* Quick Form */}
            <form onSubmit={handleSaveDashboardQuickComplete} className="space-y-4 text-xs">
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
                    value={quickTech}
                    onChange={(e) => setQuickTech(e.target.value)}
                    placeholder={isRTL ? 'مثال: م. حسن الزبيدي' : 'e.g. Hassan Al-Tamimi'}
                    className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-xl text-white text-sm font-semibold outline-none focus:border-emerald-400 transition-colors"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute ltr:right-3 rtl:left-3 top-2.5 pointer-events-none" />
                </div>

                {/* Quick Technician Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    quickCompleteMachine.assignedTechnician,
                    'م. حسن الزبيدي',
                    'م. كرار منصور',
                    'م. مصطفى جبار',
                    'Eng. Tariq Al-Bayati',
                  ]
                    .filter((name, idx, arr) => name && arr.indexOf(name) === idx)
                    .map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setQuickTech(name)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                          quickTech === name
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
                    value={quickHours}
                    onChange={(e) => setQuickHours(Number(e.target.value))}
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
                      onClick={() => setQuickHours(hrs)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer border ${
                        quickHours === hrs
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
                    <div className="text-[10px] text-slate-400">{isRTL ? 'المشرف المعتمد:' : 'Supervisor Sign-off:'}</div>
                    <div className="text-white font-semibold text-xs">{currentUser?.nameAr || currentUser?.name || 'المشرف العام'} ({currentUser?.role || 'Admin'})</div>
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
                  onClick={() => setQuickCompleteMachine(null)}
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

      {/* Warehouse Worker Mode Modal */}
      <WarehouseWorkerModeModal
        isOpen={showWorkerMode}
        onClose={() => setShowWorkerMode(false)}
      />

      {/* Phase 13: Warehouse Intelligence Assistant Modal */}
      <WarehouseAssistantModal
        isOpen={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
      />
    </div>
  );
};
