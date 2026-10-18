import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  TrendingDown,
  Activity,
  Gauge,
  Clock,
  AlertTriangle,
  SlidersHorizontal,
  Download,
  Plus,
  CheckCircle2,
  Wrench,
  Flame,
  RotateCcw,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Sparkles,
  ShieldAlert,
  Coins,
  Cpu,
  BarChart3,
  Calendar,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  ShredderMachineEnergyProfile,
  ShreddingEnergyReading,
  HourlyEnergyTelemetry,
  EnergySavingOpportunity,
  TariffZone,
} from '../types';
import {
  DEFAULT_SHREDDER_ENERGY_PROFILES,
  INDUSTRIAL_TARIFF_WINDOWS,
  getCurrentTariffWindow,
  generate24HourTelemetry,
  getStoredEnergyReadings,
  addEnergyReading,
  ENERGY_SAVING_OPPORTUNITIES,
  calculateEnergySavingsSimulation,
  EnergySimulationParams,
  exportEnergyAuditCSV,
} from '../services/energyEfficiencyService';
import { EnergyThrottlingAlertBanner } from './EnergyThrottlingAlertBanner';
import {
  evaluateEquipmentEfficiencyAlerts,
  applyThrottlingToMachine,
  simulateEfficiencySpike,
  restoreMachineNominal,
  ThrottlingProposal,
  EquipmentEfficiencyAlert,
} from '../services/energyThrottlingAlertService';

interface EnergyEfficiencyMonitorProps {
  embeddedInShredding?: boolean;
}

export const EnergyEfficiencyMonitor: React.FC<EnergyEfficiencyMonitorProps> = ({
  embeddedInShredding = false,
}) => {
  const { isRTL } = useLanguage();
  const { shreddingTransactions, currentUser, setCurrentPage } = useFactory();

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'ANALYTICS' | 'BATCH_LEDGER' | 'SIMULATOR' | 'OPPORTUNITIES'>('TELEMETRY');

  // Machine Profiles State & Live Simulation
  const [machines, setMachines] = useState<ShredderMachineEnergyProfile[]>(DEFAULT_SHREDDER_ENERGY_PROFILES);
  const [isLiveTelemetryRunning, setIsLiveTelemetryRunning] = useState<boolean>(true);
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>('ALL');

  // Telemetry 24-hr data
  const [hourlyData] = useState<HourlyEnergyTelemetry[]>(() => generate24HourTelemetry());

  // Energy Readings / Batches
  const [energyReadings, setEnergyReadings] = useState<ShreddingEnergyReading[]>(() => getStoredEnergyReadings());
  const [selectedReading, setSelectedReading] = useState<ShreddingEnergyReading | null>(null);

  // Current active tariff window
  const currentTariff = useMemo(() => getCurrentTariffWindow(), []);

  // Automated Machine Throttling & Efficiency Benchmarking State
  const [throttledMachineIds, setThrottledMachineIds] = useState<Set<string>>(new Set());

  const efficiencyAlerts: EquipmentEfficiencyAlert[] = useMemo(() => {
    return evaluateEquipmentEfficiencyAlerts(machines, currentTariff, throttledMachineIds);
  }, [machines, currentTariff, throttledMachineIds]);

  const handleApplyThrottling = (machineId: string, proposal: ThrottlingProposal) => {
    setMachines((prev) => applyThrottlingToMachine(prev, machineId, proposal));
    setThrottledMachineIds((prev) => new Set([...prev, machineId]));
    setToastMessage(
      isRTL
        ? `✓ تم تفعيل خنق الحمل لماكينة (${machineId}) وتخفيض ${proposal.powerReductionKW} ك.واط بنجاح.`
        : `✓ Applied machine throttling to (${machineId}): -${proposal.powerReductionKW} kW saved.`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRestoreNominal = (machineId: string) => {
    setMachines((prev) => restoreMachineNominal(prev, machineId, DEFAULT_SHREDDER_ENERGY_PROFILES));
    setThrottledMachineIds((prev) => {
      const next = new Set(prev);
      next.delete(machineId);
      return next;
    });
    setToastMessage(
      isRTL
        ? `تمت استعادة إعدادات القدرة الاسمية للماكينة (${machineId}).`
        : `Restored nominal power for (${machineId}).`
    );
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSimulateSpike = (machineId: string) => {
    setMachines((prev) => simulateEfficiencySpike(prev, machineId));
    setThrottledMachineIds((prev) => {
      const next = new Set(prev);
      next.delete(machineId);
      return next;
    });
    setToastMessage(
      isRTL
        ? `⚠️ تمت محاكاة طفرة استهلاك كهرباء وتجاوز معيار SEC لماكينة (${machineId}).`
        : `⚠️ Simulated efficiency benchmark spike on (${machineId}).`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApplyAllThrottling = () => {
    efficiencyAlerts
      .filter((a) => !a.isThrottled)
      .forEach((a) => {
        handleApplyThrottling(a.machineId, a.throttlingProposal);
      });
  };

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Manual Meter Log Modal State
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [meterFormData, setMeterFormData] = useState({
    machineId: DEFAULT_SHREDDER_ENERGY_PROFILES[0].machineId,
    materialName: 'سكراب بولي بروبيلين هجين (PP Sheet Trims)',
    materialCategory: 'PP Sheet',
    initialMeterKWh: 42525.0,
    finalMeterKWh: 42780.0,
    durationMinutes: 240,
    inputKG: 2800,
    outputKG: 2720,
    shift: 'صباحية (06:00 - 14:00)',
    notes: '',
  });

  // What-If Simulator State
  const [simParams, setSimParams] = useState<EnergySimulationParams>({
    shiftToOffPeakPercentage: 55,
    bladeSharpeningReductionPct: 15,
    idleMinutesEliminatedPerDay: 35,
    monthlyShreddingTons: 160,
  });

  const simResult = useMemo(() => calculateEnergySavingsSimulation(simParams), [simParams]);

  // Live Micro-fluctuation for Telemetry
  useEffect(() => {
    if (!isLiveTelemetryRunning) return;

    const interval = setInterval(() => {
      setMachines((prev) =>
        prev.map((m) => {
          if (m.state === 'STOPPED') return m;

          // Add realistic industrial micro-variations
          const kwDelta = (Math.random() - 0.5) * 1.8;
          const newKW = Math.max(8, Math.min(m.nominalMotorKW * 0.98, m.activePowerKW + kwDelta));
          const loadPct = (newKW / m.nominalMotorKW) * 100;
          const ampsDelta = (Math.random() - 0.5) * 2.2;
          const newAmps = Math.max(15, Math.min(m.ratedAmps * 1.05, m.currentAmps + ampsDelta));
          const pf = m.state === 'RUNNING_IDLE' ? 0.73 + (Math.random() - 0.5) * 0.02 : 0.88 + (Math.random() - 0.5) * 0.02;

          return {
            ...m,
            activePowerKW: Math.round(newKW * 10) / 10,
            loadPercentage: Math.round(loadPct * 10) / 10,
            currentAmps: Math.round(newAmps * 10) / 10,
            powerFactor: Math.round(pf * 100) / 100,
            lastReadingTime: isRTL ? 'الآن (مباشر)' : 'Live just now',
          };
        })
      );
    }, 3200);

    return () => clearInterval(interval);
  }, [isLiveTelemetryRunning, isRTL]);

  // Combined Totals
  const totalActiveKW = useMemo(
    () => Math.round(machines.reduce((acc, m) => acc + m.activePowerKW, 0) * 10) / 10,
    [machines]
  );

  const totalDailyKWh = useMemo(
    () => Math.round(machines.reduce((acc, m) => acc + m.dailyConsumptionKWh, 0) * 10) / 10,
    [machines]
  );

  const totalDailyCostIQD = useMemo(
    () => machines.reduce((acc, m) => acc + m.dailyCostIQD, 0),
    [machines]
  );

  const totalDailyCostUSD = useMemo(
    () => Math.round((totalDailyCostIQD / 1300) * 10) / 10,
    [totalDailyCostIQD]
  );

  const totalDailyIdleLossKWh = useMemo(
    () => Math.round(machines.reduce((acc, m) => acc + m.idleLossKWhToday, 0) * 10) / 10,
    [machines]
  );

  // Handle Export CSV
  const handleExportCSV = () => {
    const csvContent = exportEnergyAuditCSV(energyReadings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `alkarwan_shredding_energy_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage(
      isRTL ? 'تم تصدير تقرير كفاءة الطاقة بنجاح (CSV).' : 'Energy audit exported successfully (CSV).'
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Submit Manual Meter Reading
  const handleSaveMeterLog = (e: React.FormEvent) => {
    e.preventDefault();
    const netKWh = Math.max(1, meterFormData.finalMeterKWh - meterFormData.initialMeterKWh);
    const sec = meterFormData.inputKG > 0 ? netKWh / meterFormData.inputKG : 0;
    const costIQD = Math.round(netKWh * currentTariff.rateIQDPerKWh);
    const costUSD = Math.round((costIQD / 1300) * 100) / 100;

    let rating: 'A+' | 'A' | 'B' | 'C' = 'A';
    if (sec <= 0.088) rating = 'A+';
    else if (sec <= 0.096) rating = 'A';
    else if (sec <= 0.115) rating = 'B';
    else rating = 'C';

    const selectedMachine = machines.find((m) => m.machineId === meterFormData.machineId);

    const newReading = addEnergyReading({
      machineId: meterFormData.machineId,
      machineCode: selectedMachine?.code || 'SHR-01',
      materialName: meterFormData.materialName,
      materialCategory: meterFormData.materialCategory,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      shift: meterFormData.shift,
      operator: currentUser?.nameAr || currentUser?.name || 'المشغل المسؤول',
      initialMeterKWh: meterFormData.initialMeterKWh,
      finalMeterKWh: meterFormData.finalMeterKWh,
      totalKWh: netKWh,
      durationMinutes: meterFormData.durationMinutes,
      inputKG: meterFormData.inputKG,
      outputKG: meterFormData.outputKG,
      specificEnergyKWhKG: Math.round(sec * 10000) / 10000,
      tariffZone: currentTariff.zone,
      rateIQDPerKWh: currentTariff.rateIQDPerKWh,
      totalCostIQD: costIQD,
      totalCostUSD: costUSD,
      efficiencyRating: rating,
      notes: meterFormData.notes,
    });

    setEnergyReadings([newReading, ...energyReadings]);
    setShowLogModal(false);
    setToastMessage(
      isRTL
        ? `تم تسجيل قراءة استهلاك الطاقة (${netKWh.toLocaleString()} kWh) لدورة الثرم بنجاح.`
        : `Energy reading (${netKWh.toLocaleString()} kWh) recorded.`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filtered readings
  const filteredReadings = useMemo(() => {
    if (selectedMachineFilter === 'ALL') return energyReadings;
    return energyReadings.filter((r) => r.machineId === selectedMachineFilter || r.machineCode === selectedMachineFilter);
  }, [energyReadings, selectedMachineFilter]);

  return (
    <div
      id="energy-efficiency-monitor-root"
      className={`space-y-6 ${embeddedInShredding ? 'pt-2' : 'max-w-7xl mx-auto px-4 sm:px-6 py-6'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top Banner / Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-950/40">
            <Zap className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {isRTL ? 'مراقب كفاءة الطاقة واستهلاك الكهرباء للثرم' : 'Shredding Energy Efficiency Monitor'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                LIVE kWh / SEC
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {isRTL
                ? 'رصد استهلاك القدرة (kW) واستهلاك الكيلوواط/كغم لكل مفرمة لتقليل فاتورة الكهرباء الصناعية'
                : 'Real-time telemetry, SEC benchmark (kWh/kg), and power cost optimization for factory shredders'}
            </p>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Active Tariff Badge */}
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm ${
              currentTariff.zone === 'PEAK'
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse'
                : currentTariff.zone === 'STANDARD'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {currentTariff ? (isRTL ? (currentTariff.nameAr || currentTariff.nameEn) : (currentTariff.nameEn || currentTariff.nameAr)) : ''}:
            </span>
            <span className="font-mono font-black">
              {currentTariff.rateIQDPerKWh} IQD/kWh
            </span>
          </div>

          {/* Telemetry Toggle */}
          <button
            type="button"
            id="toggle-live-telemetry-btn"
            onClick={() => setIsLiveTelemetryRunning(!isLiveTelemetryRunning)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              isLiveTelemetryRunning
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${isLiveTelemetryRunning ? 'animate-pulse text-emerald-400' : ''}`} />
            <span>{isLiveTelemetryRunning ? (isRTL ? 'تحديث حي' : 'Live Sync') : (isRTL ? 'إيقاف مؤقت' : 'Paused')}</span>
          </button>

          {/* Action: Log Reading */}
          <button
            type="button"
            id="open-log-meter-modal-btn"
            onClick={() => setShowLogModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل قراءة مقياس' : 'Log Meter'}</span>
          </button>

          {/* Action: Export CSV */}
          <button
            type="button"
            id="export-energy-csv-btn"
            onClick={handleExportCSV}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isRTL ? 'تصدير تقرير التدقيق الكهربائي (CSV)' : 'Export Energy Audit (CSV)'}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications Toast */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Peak Tariff Critical Alert Banner if currently running during peak hours */}
      {currentTariff.zone === 'PEAK' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/80 border border-rose-500/60 shadow-lg flex items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-200">
                {isRTL
                  ? 'تنبيه تكلفة الكهرباء: ساعات ذروة الحمل الصناعي نشطة حالياً (240 د.ع/ك.واط)'
                  : 'Power Cost Alert: Industrial Peak Tariff Active (240 IQD/kWh)'}
              </h4>
              <p className="text-xs text-rose-300/80 mt-0.5">
                {isRTL
                  ? 'يُنصح بإيقاف ثرم الكتل الثقيلة بالمفرمة 75kW وترحيلها لبعد الساعة 22:00 لتوفير 64% من تكلفة الكهرباء لكل دفعة.'
                  : 'Recommended to throttle 75kW heavy purge shredding until after 22:00 to save 64% power cost per batch.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('OPPORTUNITIES')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shrink-0 cursor-pointer shadow-md shadow-rose-950 transition-all"
          >
            {isRTL ? 'خطة تخفيض الحمل' : 'Load Shed Plan'}
          </button>
        </div>
      )}

      {/* Automated Real-Time Energy Efficiency & Machine Throttling Alert System */}
      <EnergyThrottlingAlertBanner
        alerts={efficiencyAlerts}
        onApplyThrottling={handleApplyThrottling}
        onRestoreNominal={handleRestoreNominal}
        onSimulateSpike={handleSimulateSpike}
        onApplyAllThrottling={handleApplyAllThrottling}
      />

      {/* Key Metric KPI Cards Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Active Load */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isRTL ? 'إجمالي الحمل اللحظي' : 'Total Active Load'}</span>
            <Gauge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-300">
              {totalActiveKW}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">kW</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isRTL ? 'السعة الكلية:' : 'Total Rated:'} 175 kW</span>
            <span className="font-mono text-emerald-400 font-bold">
              {Math.round((totalActiveKW / 175) * 100)}% {isRTL ? 'حمولة' : 'Load'}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalActiveKW / 175) * 100)}%` }}
            />
          </div>
        </div>

        {/* Daily Energy Consumption */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isRTL ? 'الاستهلاك اليومي التراكمي' : 'Daily Consumption'}</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-300">
              {totalDailyKWh.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">kWh</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isRTL ? 'معدل الإنتاج المنجز:' : 'Regrind Output:'} 10.8 {isRTL ? 'طن' : 'Tons'}</span>
            <span className="font-mono text-cyan-400 font-bold">
              0.089 {isRTL ? 'ك.واط/كغم' : 'kWh/kg'}
            </span>
          </div>
        </div>

        {/* Daily Power Cost (IQD & USD) */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isRTL ? 'تكلفة الكهرباء لليوم' : "Today's Power Cost"}</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-amber-300">
              {totalDailyCostIQD.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-amber-400/80 font-mono">IQD</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>≈ ${totalDailyCostUSD.toLocaleString()} USD</span>
            <span className="text-slate-500 font-mono">Rate: 140 IQD/kWh</span>
          </div>
        </div>

        {/* Wasted Idle Energy */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isRTL ? 'هدر التشغيل بدون تلقيم (Idle)' : 'Wasted Idle Energy'}</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-rose-400">
              {totalDailyIdleLossKWh}
            </span>
            <span className="text-xs font-bold text-slate-400 font-mono">kWh</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-rose-300">
            <span>{isRTL ? 'كلفة الهدر اليومية:' : 'Idle Cost:'}</span>
            <span className="font-mono font-bold">
              {(totalDailyIdleLossKWh * 140).toLocaleString()} IQD
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('TELEMETRY')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'TELEMETRY'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>{isRTL ? 'الحالة اللحظية للماكينات' : 'Machine Telemetry'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ANALYTICS')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'ANALYTICS'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isRTL ? 'منحنى الحمل وساعات الذروة' : 'Power Curve & Peak Hours'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('BATCH_LEDGER')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'BATCH_LEDGER'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isRTL ? 'سجل دورات الثرم واستهلاك الطاقة' : 'Batch Energy Ledger'}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
            {energyReadings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SIMULATOR')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'SIMULATOR'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
          <span>{isRTL ? 'محاكي تقليل تكلفة الكهرباء (What-If)' : 'Cost Reduction Simulator'}</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            {simResult.savingsPercentage}% {isRTL ? 'وفر' : 'Save'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('OPPORTUNITIES')}
          className={`px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'OPPORTUNITIES'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{isRTL ? 'فرص وإجراءات التوفير' : 'Saving Opportunities'}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
            4
          </span>
        </button>
      </div>

      {/* SUB-VIEW 1: MACHINE TELEMETRY CARDS */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {machines.map((m) => {
              const isOverloading = m.loadPercentage > 90;
              const isIdle = m.state === 'RUNNING_IDLE';

              return (
                <div
                  key={m.machineId}
                  className={`rounded-2xl border transition-all shadow-xl p-5 relative flex flex-col justify-between ${
                    isIdle
                      ? 'bg-gradient-to-b from-amber-950/30 to-slate-900/90 border-amber-500/50 shadow-amber-950/20'
                      : isOverloading
                      ? 'bg-gradient-to-b from-rose-950/30 to-slate-900/90 border-rose-500/50'
                      : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  {/* Top Header of Machine */}
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-cyan-400">
                            {m.code}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              m.state === 'RUNNING_LOAD'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : m.state === 'RUNNING_IDLE'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.state === 'RUNNING_LOAD'
                              ? isRTL ? 'قيد الثرم والتلقيم' : 'Under Load'
                              : m.state === 'RUNNING_IDLE'
                              ? isRTL ? 'دوران فارغ (هدر)' : 'Idle Run (Waste)'
                              : isRTL ? 'متوقفة' : 'Stopped'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">
                          {m ? (isRTL ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)) : ''}
                        </h4>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-mono font-bold">
                        {m.nominalMotorKW} kW
                      </div>
                    </div>

                    {/* Big Power & Current Readout */}
                    <div className="grid grid-cols-2 gap-3 my-4">
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {isRTL ? 'القدرة الفعالة (kW)' : 'Active Power'}
                        </span>
                        <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                          {m.activePowerKW}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {m.loadPercentage}% of {m.nominalMotorKW} kW
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {isRTL ? 'التيار الفعلي (Amps)' : 'Current'}
                        </span>
                        <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
                          {m.currentAmps}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Rated: {m.ratedAmps} A
                        </span>
                      </div>
                    </div>

                    {/* Telemetry Gauge Bar */}
                    <div className="space-y-1 mb-4">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{isRTL ? 'نسبة تحميل المحرك:' : 'Motor Load Factor:'}</span>
                        <span className="font-mono font-bold text-white">{m.loadPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            m.loadPercentage > 85
                              ? 'bg-rose-500'
                              : m.loadPercentage > 60
                              ? 'bg-emerald-500'
                              : 'bg-amber-400'
                          }`}
                          style={{ width: `${Math.min(100, m.loadPercentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* SEC & Electrical Health Details */}
                    <div className="space-y-2 text-xs border-t border-slate-800/80 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isRTL ? 'الاستهلاك النوعي (SEC):' : 'Specific Energy (SEC):'}</span>
                        <span
                          className={`font-mono font-bold ${
                            m.specificEnergyConsumptionKWhKG > m.targetSECKWhKG * 1.1
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {m.specificEnergyConsumptionKWhKG > 0
                            ? `${m.specificEnergyConsumptionKWhKG} kWh/kg`
                            : isRTL ? '0.0 (بدون إنتاج)' : '0.0 (No Output)'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isRTL ? 'الهدف الموصى به:' : 'SEC Target:'}</span>
                        <span className="font-mono text-slate-300">{m.targetSECKWhKG} kWh/kg</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isRTL ? 'معامل القدرة (cos φ):' : 'Power Factor (cos φ):'}</span>
                        <span
                          className={`font-mono font-bold ${
                            m.powerFactor < 0.82 ? 'text-amber-400' : 'text-slate-200'
                          }`}
                        >
                          {m.powerFactor} {m.powerFactor < 0.82 ? '⚠️' : '✓'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isRTL ? 'تآكل سكاكين الثرم:' : 'Blade Wear Status:'}</span>
                        <span
                          className={`font-mono font-bold ${
                            m.bladeWearPct > 60
                              ? 'text-rose-400'
                              : m.bladeWearPct > 40
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {m.bladeWearPct}% {m.bladeWearPct > 60 ? (isRTL ? '(تحتاج شحذ)' : '(Needs Grind)') : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isRTL ? 'معدل الإنتاجية بالساعة:' : 'Throughput / hr:'}</span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {m.throughputKGHour} kg/h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Machine Footer / Action */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{m.lastReadingTime}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMeterFormData((prev) => ({
                          ...prev,
                          machineId: m.machineId,
                        }));
                        setShowLogModal(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isRTL ? 'تسجيل استهلاك' : 'Log Reading'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Specific Energy Consumption (SEC) Benchmark Guidance Card */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Gauge className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRTL
                    ? 'المعايير المرجعية للاستهلاك النوعي للطاقة (SEC Benchmark by Plastic Type)'
                    : 'Specific Energy Consumption (SEC Benchmark by Plastic Type)'}
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {isRTL ? 'المعيار العالمي: 0.080 - 0.120 kWh/kg' : 'Target: 0.080 - 0.120 kWh/kg'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-200">PP Sheet & Trims</span>
                <div className="text-lg font-black font-mono text-emerald-400 mt-1">0.082 - 0.090</div>
                <p className="text-[10px] text-slate-500">kWh/kg (أعلى كفاءة وسهولة في القص)</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-200">PS / HIPS Regrind</span>
                <div className="text-lg font-black font-mono text-cyan-400 mt-1">0.090 - 0.105</div>
                <p className="text-[10px] text-slate-500">kWh/kg (صلابة متوسطة، ينتج بودرة)</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-200">HDPE Rigid Scrap</span>
                <div className="text-lg font-black font-mono text-amber-400 mt-1">0.100 - 0.125</div>
                <p className="text-[10px] text-slate-500">kWh/kg (مقاومة ميكانيكية أعلى)</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-200">Purge Lumps / كتل</span>
                <div className="text-lg font-black font-mono text-rose-400 mt-1">0.130 - 0.165</div>
                <p className="text-[10px] text-slate-500">kWh/kg (أعلى استهلاك، يفضل ليلاً)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: HOURLY POWER DEMAND & PEAK ANALYSIS (RECHARTS) */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6">
          {/* Main 24-Hour Active Power Demand Curve */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span>
                    {isRTL
                      ? 'منحنى القدرة الكهربائية عبر 24 ساعة (مع تمييز ساعات الذروة)'
                      : '24-Hour Active Power Demand Curve (with Peak Tariff Shading)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL
                    ? 'المنطقة المظللة باللون الوردي (18:00 - 22:00) تمثل ساعات الذروة الأعلى تكلفة (240 د.ع/ك.واط)'
                    : 'Rose shaded zone (18:00 - 22:00) highlights industrial peak tariff hours (240 IQD/kWh)'}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-slate-300">SHR-01 (75kW)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-cyan-500" />
                  <span className="text-slate-300">SHR-02 (55kW)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-slate-300">SHR-03 (45kW)</span>
                </div>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorS1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorS2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorS3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hourLabel" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} unit=" kW" />

                  {/* Peak tariff zone lines 18:00 - 22:00 */}
                  <ReferenceLine
                    x="18:00"
                    stroke="#f43f5e"
                    strokeDasharray="3 3"
                    label={{
                      value: isRTL ? 'بدء ذروة الحمل (240 د.ع)' : 'Peak Start (240 IQD)',
                      fill: '#f43f5e',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    x="22:00"
                    stroke="#10b981"
                    strokeDasharray="3 3"
                    label={{
                      value: isRTL ? 'انتهاء الذروة / بدء الليلي' : 'Off-Peak Start',
                      fill: '#10b981',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [`${value} kW`, name]}
                  />

                  <Area
                    type="monotone"
                    dataKey="shredder01KW"
                    name="SHR-01 (75kW)"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorS1)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="shredder02KW"
                    name="SHR-02 (55kW)"
                    stroke="#06b6d4"
                    fillOpacity={1}
                    fill="url(#colorS2)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="shredder03KW"
                    name="SHR-03 (45kW)"
                    stroke="#f59e0b"
                    fillOpacity={1}
                    fill="url(#colorS3)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Secondary Chart: Hourly Power Cost (IQD) */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>{isRTL ? 'تكلفة الكهرباء بالساعة (IQD / Hour)' : 'Hourly Electricity Cost (IQD / Hour)'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL
                    ? 'لاحظ القفزة الحادة في التكلفة خلال ساعات الذروة بسبب مضاعفة التعريفة'
                    : 'Notice sharp financial spikes during peak hours due to industrial tariff surge'}
                </p>
              </div>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hourLabel" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${Number(val).toLocaleString()} IQD`, isRTL ? 'كلفة الساعة' : 'Hourly Cost']}
                  />
                  <Bar dataKey="totalCostIQD" radius={[4, 4, 0, 0]}>
                    {hourlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPeakTariff ? '#f43f5e' : entry.hour < 7 || entry.hour >= 22 ? '#10b981' : '#06b6d4'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: BATCH ENERGY LEDGER & READINGS */}
      {activeTab === 'BATCH_LEDGER' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">{isRTL ? 'تصفية حسب المفرمة:' : 'Filter Machine:'}</span>
              <select
                value={selectedMachineFilter}
                onChange={(e) => setSelectedMachineFilter(e.target.value)}
                className="p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
              >
                <option value="ALL">{isRTL ? 'جميع المفارم' : 'All Shredders'}</option>
                <option value="THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)">SHR-01 (75kW)</option>
                <option value="THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)">SHR-02 (55kW)</option>
                <option value="THERM-SHREDDER-03 (Cup & Edge Trimmings 45kW)">SHR-03 (45kW)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {isRTL ? `المجموع: ${filteredReadings.length} قراءات مسجلة` : `Total: ${filteredReadings.length} logged batches`}
              </span>
              <button
                type="button"
                onClick={() => setShowLogModal(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إضافة قراءة مقياس' : 'Add Reading'}</span>
              </button>
            </div>
          </div>

          {/* Table of Readings */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5 text-start">{isRTL ? 'رقم القراءة / الدورة' : 'ID / Batch #'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المفرمة' : 'Machine'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المادة ونوع البلاستيك' : 'Material'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'الكمية (كغم)' : 'Input KG'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'استهلاك الكهرباء' : 'Energy (kWh)'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'الاستهلاك النوعي SEC' : 'SEC (kWh/kg)'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'شريحة التعريفة' : 'Tariff Zone'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'التكلفة الإجمالية' : 'Total Cost'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'التقييم' : 'Rating'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredReadings.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedReading(r)}
                      className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        selectedReading?.id === r.id ? 'bg-emerald-950/30' : ''
                      }`}
                    >
                      <td className="p-3.5 font-mono font-bold text-white">
                        <div>{r.id}</div>
                        <div className="text-[10px] text-emerald-400">{r.shreddingNumber}</div>
                        <div className="text-[10px] text-slate-500">{r.timestamp}</div>
                      </td>
                      <td className="p-3.5 text-slate-200">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                          {r.machineCode}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <div className="font-semibold">{r.materialName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{r.shift}</div>
                      </td>
                      <td className="p-3.5 text-end font-mono font-bold text-slate-200">
                        {(r.inputKG ?? 0).toLocaleString()} KG
                      </td>
                      <td className="p-3.5 text-end font-mono font-black text-cyan-300">
                        {r.totalKWh.toLocaleString()} kWh
                      </td>
                      <td className="p-3.5 text-end font-mono font-bold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            r.specificEnergyKWhKG <= 0.09
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : r.specificEnergyKWhKG <= 0.11
                              ? 'text-cyan-400'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {r.specificEnergyKWhKG.toFixed(4)}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            r.tariffZone === 'PEAK'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                              : r.tariffZone === 'STANDARD'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {r.tariffZone} ({r.rateIQDPerKWh} د.ع)
                        </span>
                      </td>
                      <td className="p-3.5 text-end font-mono font-bold text-amber-300">
                        <div>{r.totalCostIQD.toLocaleString()} IQD</div>
                        <div className="text-[10px] text-slate-500">${r.totalCostUSD.toFixed(2)}</div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-black text-xs font-mono ${
                            r.efficiencyRating === 'A+'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : r.efficiencyRating === 'A'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : r.efficiencyRating === 'B'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {r.efficiencyRating}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: WHAT-IF COST REDUCTION SIMULATOR */}
      {activeTab === 'SIMULATOR' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isRTL
                      ? 'محاكي توفير تكلفة الطاقة الصناعية (What-If Savings Engine)'
                      : 'Industrial Power Cost Reduction Simulator (What-If Engine)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? 'اختبر تأثير ترحيل الأحمال لليل، شحذ السكاكين، وتقليل الهدر على فاتورة الكهرباء السنوية'
                      : 'Simulate load-shifting to off-peak tariff, knife sharpening, and idle elimination on factory power bills'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSimParams({
                    shiftToOffPeakPercentage: 55,
                    bladeSharpeningReductionPct: 15,
                    idleMinutesEliminatedPerDay: 35,
                    monthlyShreddingTons: 160,
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إعادة ضبط الافتراضات' : 'Reset Defaults'}</span>
              </button>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Slider 1: Shift to Off-Peak */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    1. {isRTL ? 'نسبة ترحيل الثرم لساعات التعريفة المخفضة (22:00 - 07:00)' : 'Shift to Off-Peak Tariff Window (22:00 - 07:00)'}
                  </span>
                  <span className="font-mono text-emerald-400 font-black text-sm">
                    {simParams.shiftToOffPeakPercentage}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={simParams.shiftToOffPeakPercentage}
                  onChange={(e) =>
                    setSimParams({ ...simParams, shiftToOffPeakPercentage: Number(e.target.value) })
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  {isRTL
                    ? 'يقلل تكلفة الكيلوواط من 240/140 إلى 85 د.ع فقط لكل دورة تشغيل ليلية.'
                    : 'Drops energy cost from 240/140 down to 85 IQD/kWh during night shifts.'}
                </p>
              </div>

              {/* Slider 2: Blade Sharpening */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    2. {isRTL ? 'نسبة تحسين استهلاك السكاكين بالشحذ المنتظم (SEC Reduction)' : 'Blade Sharpening Drag Reduction (SEC Reduction)'}
                  </span>
                  <span className="font-mono text-cyan-400 font-black text-sm">
                    {simParams.bladeSharpeningReductionPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={simParams.bladeSharpeningReductionPct}
                  onChange={(e) =>
                    setSimParams({ ...simParams, bladeSharpeningReductionPct: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  {isRTL
                    ? 'السكاكين الحادة تقلل مقاومة القص وتخفض سحب الأمبير بنسبة تصل لـ 20%.'
                    : 'Sharp knives minimize motor friction and shear resistance.'}
                </p>
              </div>

              {/* Slider 3: Idle Minutes Reduction */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    3. {isRTL ? 'دقائق الدوران الفارغ المستبعدة يومياً (Idle Cutoff)' : 'Idle Minutes Eliminated per Day (Idle Cutoff)'}
                  </span>
                  <span className="font-mono text-amber-400 font-black text-sm">
                    {simParams.idleMinutesEliminatedPerDay} {isRTL ? 'دقيقة/يوم' : 'min/day'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={simParams.idleMinutesEliminatedPerDay}
                  onChange={(e) =>
                    setSimParams({ ...simParams, idleMinutesEliminatedPerDay: Number(e.target.value) })
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  {isRTL
                    ? 'إيقاف المواتير تلقائياً عند فراغ قمع التلقيم لأكثر من 4 دقائق.'
                    : 'Auto-pause shredder motors when feed hopper remains empty.'}
                </p>
              </div>

              {/* Slider 4: Monthly Shredding Volume */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200">
                    4. {isRTL ? 'حجم الثرم الشهري المخطط للمصنع (طن)' : 'Monthly Shredding Target Volume (Tons)'}
                  </span>
                  <span className="font-mono text-purple-400 font-black text-sm">
                    {simParams.monthlyShreddingTons} {isRTL ? 'طن' : 'Tons'}
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="350"
                  step="10"
                  value={simParams.monthlyShreddingTons}
                  onChange={(e) =>
                    setSimParams({ ...simParams, monthlyShreddingTons: Number(e.target.value) })
                  }
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  {isRTL
                    ? 'الإنتاج الإجمالي الشهري المخطط لمخزن الثرم رقم 2.'
                    : 'Total monthly projected regrind throughput.'}
                </p>
              </div>
            </div>

            {/* Simulation Results Showcase Cards */}
            <div className="pt-6 border-t border-slate-800">
              <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'عائدات التوفير المحسوبة للمصنع:' : 'Calculated Factory Financial Savings:'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Monthly Savings IQD */}
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 shadow-lg">
                  <span className="text-xs text-emerald-400 font-bold">
                    {isRTL ? 'التوفير الشهري المقدر' : 'Estimated Monthly Savings'}
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
                    {simResult.monthlySavingsIQD.toLocaleString()} IQD
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    ≈ ${simResult.monthlySavingsUSD.toLocaleString()} USD / {isRTL ? 'شهر' : 'month'}
                  </span>
                </div>

                {/* Annual Savings IQD */}
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-400 shadow-xl">
                  <span className="text-xs text-emerald-300 font-bold">
                    {isRTL ? 'التوفير السنوي الإجمالي' : 'Projected Annual Savings'}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-200 mt-1">
                    {simResult.annualSavingsIQD.toLocaleString()} IQD
                  </div>
                  <span className="text-xs text-emerald-400 font-mono font-bold">
                    ≈ ${simResult.annualSavingsUSD.toLocaleString()} USD / {isRTL ? 'سنة' : 'year'}
                  </span>
                </div>

                {/* Percentage Reduction */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-lg">
                  <span className="text-xs text-cyan-400 font-bold">
                    {isRTL ? 'نسبة خفض فاتورة الطاقة' : 'Power Bill Reduction'}
                  </span>
                  <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
                    {simResult.savingsPercentage}%
                  </div>
                  <span className="text-xs text-slate-400">
                    {isRTL ? 'مقارنة بنمط التشغيل الحالي' : 'vs current baseline pattern'}
                  </span>
                </div>

                {/* CO2 Emissions Cut */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-lg">
                  <span className="text-xs text-teal-400 font-bold">
                    {isRTL ? 'خفض الانبعاثات الكربونية' : 'CO2 Emissions Cut'}
                  </span>
                  <div className="text-2xl font-black font-mono text-teal-300 mt-1">
                    {simResult.co2ReductionTons} {isRTL ? 'طن سنوياً' : 'Tons/yr'}
                  </div>
                  <span className="text-xs text-slate-400">
                    {isRTL ? 'مبادرة الاستدامة الصناعية' : 'Industrial green footprint'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: ENERGY SAVING OPPORTUNITIES */}
      {activeTab === 'OPPORTUNITIES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ENERGY_SAVING_OPPORTUNITIES.map((opp) => (
              <div
                key={opp.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 shadow-xl flex flex-col justify-between space-y-4 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-emerald-400">
                        {opp.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          opp.severity === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : opp.severity === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        }`}
                      >
                        {opp.severity} PRIORITY
                      </span>
                    </div>

                    <div className="text-end">
                      <span className="text-sm font-black font-mono text-emerald-400">
                        +{opp.estimatedMonthlySavingsIQD.toLocaleString()} IQD/mo
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ≈ ${opp.estimatedMonthlySavingsUSD} USD
                      </div>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-2">
                    {isRTL ? opp.titleAr : opp.titleEn}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {isRTL ? opp.descriptionAr : opp.descriptionEn}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <span className="font-bold text-cyan-300 block mb-0.5">
                    {isRTL ? 'الإجراء التشغيلي الموصى به:' : 'Recommended Action:'}
                  </span>
                  <span className="text-slate-300">
                    {isRTL ? opp.actionRecommendationAr : opp.actionRecommendationEn}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANUAL METER LOGGING MODAL */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'تسجيل قراءة مقياس الطاقة لمفرمة الثرم' : 'Log Shredder Energy Meter Reading'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL ? 'إدخال قراءات العداد (kWh) لحساب الاستهلاك والتكلفة الفورية' : 'Record physical meter kWh before and after shredding run'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMeterLog} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Machine Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'ماكينة الثرم' : 'Shredder Machine'} *
                  </label>
                  <select
                    value={meterFormData.machineId}
                    onChange={(e) => setMeterFormData({ ...meterFormData, machineId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                    required
                  >
                    {machines.map((m) => (
                      <option key={m.machineId} value={m.machineId}>
                        {m.code} - {m ? (isRTL ? (m.nameAr || m.nameEn) : (m.nameEn || m.nameAr)) : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الوردية' : 'Shift'} *
                  </label>
                  <select
                    value={meterFormData.shift}
                    onChange={(e) => setMeterFormData({ ...meterFormData, shift: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                  >
                    <option value="صباحية (06:00 - 14:00)">صباحية (06:00 - 14:00)</option>
                    <option value="مسائية (14:00 - 22:00)">مسائية (14:00 - 22:00)</option>
                    <option value="ليلية (22:00 - 06:00)">ليلية (22:00 - 06:00)</option>
                  </select>
                </div>

                {/* Material Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'المادة المشغلة' : 'Material Name'} *
                  </label>
                  <input
                    type="text"
                    value={meterFormData.materialName}
                    onChange={(e) => setMeterFormData({ ...meterFormData, materialName: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                    required
                  />
                </div>

                {/* Initial Meter Reading */}
                <div>
                  <label className="block text-xs font-bold text-cyan-300 mb-1">
                    {isRTL ? 'قراءة العداد الابتدائية (kWh)' : 'Initial Meter (kWh)'} *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={meterFormData.initialMeterKWh}
                    onChange={(e) => setMeterFormData({ ...meterFormData, initialMeterKWh: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-cyan-300 font-mono text-sm font-bold outline-none"
                    required
                  />
                </div>

                {/* Final Meter Reading */}
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">
                    {isRTL ? 'قراءة العداد النهائية (kWh)' : 'Final Meter (kWh)'} *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={meterFormData.finalMeterKWh}
                    onChange={(e) => setMeterFormData({ ...meterFormData, finalMeterKWh: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-emerald-300 font-mono text-sm font-bold outline-none"
                    required
                  />
                </div>

                {/* Input KG */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'وزن المدخلات (كغم)' : 'Input (KG)'} *
                  </label>
                  <input
                    type="number"
                    value={meterFormData.inputKG}
                    onChange={(e) => setMeterFormData({ ...meterFormData, inputKG: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold outline-none"
                    required
                  />
                </div>

                {/* Duration Minutes */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'مدة التشغيل (دقيقة)' : 'Duration (Minutes)'} *
                  </label>
                  <input
                    type="number"
                    value={meterFormData.durationMinutes}
                    onChange={(e) => setMeterFormData({ ...meterFormData, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono font-bold outline-none"
                    required
                  />
                </div>
              </div>

              {/* Calculated Net Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-slate-400">{isRTL ? 'صافي الطاقة المستهلكة:' : 'Net Energy:'}</span>
                  <span className="text-emerald-400 font-bold ms-2">
                    {Math.max(0, meterFormData.finalMeterKWh - meterFormData.initialMeterKWh).toLocaleString()} kWh
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">{isRTL ? 'الاستهلاك النوعي:' : 'SEC:'}</span>
                  <span className="text-cyan-400 font-bold ms-2">
                    {meterFormData.inputKG > 0
                      ? (Math.max(0, meterFormData.finalMeterKWh - meterFormData.initialMeterKWh) / meterFormData.inputKG).toFixed(4)
                      : '0.0000'} kWh/kg
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  {isRTL ? 'حفظ قراءة المقياس' : 'Save Meter Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
