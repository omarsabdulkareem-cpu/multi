import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Scale,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Layers,
  HelpCircle,
  Wrench,
  Zap,
  Gauge,
  SlidersHorizontal,
  Scan,
  Clock,
  QrCode,
  Activity,
  Cpu,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { ShreddingTransaction } from '../types';
import { StatusBadge } from './StatusBadge';
import { EnergyEfficiencyMonitor } from './EnergyEfficiencyMonitor';
import { ScaleToleranceAlertBanner } from './ScaleToleranceAlertBanner';
import { ScaleToleranceConfigModal } from './ScaleToleranceConfigModal';
import { QrBatchScannerModal } from './QrBatchScannerModal';
import { BatchLifecycleModal } from './BatchLifecycleModal';
import { evaluateShreddingWeightTolerances } from '../services/weightToleranceService';
import { ShredderSensorPredictiveMonitor } from './ShredderSensorPredictiveMonitor';
import { evaluateShredderSensorPredictive } from '../services/shredderSensorPredictiveService';
import { EVENT_MAINTENANCE_ALERT_TRIGGERED } from '../services/maintenanceAlertService';

export const ShreddingModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const {
    shreddingTransactions,
    receivingTransactions,
    materials,
    warehouses,
    locations,
    currentUser,
    startShreddingJob,
    completeShreddingJob,
    returnShreddedToStorage,
    selectedTransactionId,
    setSelectedTransactionId,
    setCurrentPage,
  } = useFactory();

  const [activeTab, setActiveTab] = useState<'LIST' | 'START_JOB' | 'COMPLETE_JOB' | 'RETURN_STORAGE' | 'ENERGY_MONITOR' | 'SENSOR_MONITOR'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShred, setSelectedShred] = useState<ShreddingTransaction | null>(null);

  // Real-time Shredder Blade Wear & Current Spikes Predictive Analysis
  const [sensorAnalysis, setSensorAnalysis] = useState(() => evaluateShredderSensorPredictive());

  useEffect(() => {
    const handleUpdate = () => {
      setSensorAnalysis(evaluateShredderSensorPredictive());
    };
    window.addEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleUpdate);
    return () => {
      window.removeEventListener(EVENT_MAINTENANCE_ALERT_TRIGGERED, handleUpdate);
    };
  }, []);

  // Real-time Shredding Weight & Variance Tolerance Monitoring States
  const [isToleranceConfigOpen, setIsToleranceConfigOpen] = useState(false);
  const [toleranceVersion, setToleranceVersion] = useState(0);

  // QR Scanning & Batch Lifecycle Modal States
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);
  const [lifecycleBatchPayload, setLifecycleBatchPayload] = useState<any>(null);

  // Form states for Starting a Shredding Run
  const [startForm, setStartForm] = useState({
    sourceReceivingId: '',
    materialId: materials[0]?.id || '',
    inputKG: 5000,
    inputBulkBags: 5,
    machineId: 'THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)',
    operator: currentUser.nameAr,
    shift: 'صباحية (06:00 - 14:00)',
    notes: '',
  });

  // Form states for Completing a Shredding Run
  const [completeForm, setCompleteForm] = useState({
    outputKG: 4850,
    outputBulkBags: 5,
    productionDamageKG: 80,
    varianceReason: '',
  });

  // Form state for Return to Storage
  const [returnWarehouseId, setReturnWarehouseId] = useState('WH-02');
  const [returnLocationId, setReturnLocationId] = useState('LOC-B01');

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync selected transaction from context
  useEffect(() => {
    if (selectedTransactionId) {
      const found = shreddingTransactions.find((s) => s.id === selectedTransactionId);
      if (found) {
        setSelectedShred(found);
        const st = found.status;
        if (st === 'In Shredding' || st === 'IN_THERM' || st === 'IN_PROGRESS') {
          setActiveTab('COMPLETE_JOB');
          setCompleteForm({
            outputKG: Math.round(found.inputKG * 0.96),
            outputBulkBags: found.inputBulkBags,
            productionDamageKG: Math.round(found.inputKG * 0.02),
            varianceReason: '',
          });
        } else if (st === 'Shredding Completed' || st === 'THERM_COMPLETED' || st === 'COMPLETED') {
          setActiveTab('RETURN_STORAGE');
        } else {
          setActiveTab('LIST');
        }
      }
    }
  }, [selectedTransactionId, shreddingTransactions]);

  // Handle Start Job Submit
  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = startShreddingJob({
      ...startForm,
      inputKG: Number(startForm.inputKG),
      inputBulkBags: Number(startForm.inputBulkBags),
      operator: currentUser.nameAr,
    });

    if (res.success && res.id) {
      setSuccessMessage(
        isRTL
          ? 'تم بدء تشغيل ماكينة الثرم (الثرم) وتسجيل أمر التشغيل بموجب مستند 360/352'
          : 'Shredding job started on therm rotor.'
      );
      const created = shreddingTransactions.find((s) => s.id === res.id);
      if (created) {
        setSelectedShred(created);
        setActiveTab('COMPLETE_JOB');
        setCompleteForm({
          outputKG: Math.round(created.inputKG * 0.96),
          outputBulkBags: created.inputBulkBags,
          productionDamageKG: Math.round(created.inputKG * 0.02),
          varianceReason: '',
        });
      }
    } else {
      setErrorMessage(res.error || 'فشل بدء التشغيل');
    }
  };

  // Live variance calculations in Complete Form
  const inputKgVal = selectedShred?.inputKG || 1;
  const outKgVal = Number(completeForm.outputKG) || 0;
  const dmgKgVal = Number(completeForm.productionDamageKG) || 0;
  const liveVarianceKG = inputKgVal - outKgVal - dmgKgVal;
  const liveVariancePct = ((liveVarianceKG / inputKgVal) * 100).toFixed(2);
  const isHighVariance = Number(liveVariancePct) > 2.5 || Number(liveVariancePct) < -1.0;

  // Real-time Shredding Tolerance Evaluations
  const shreddingCompleteTolerance = useMemo(() => {
    if (!selectedShred) return null;
    return evaluateShreddingWeightTolerances(
      {
        inputKG: selectedShred.inputKG,
        outputKG: Number(completeForm.outputKG),
        productionDamageKG: Number(completeForm.productionDamageKG),
        inputBags: selectedShred.inputBulkBags,
        outputBags: Number(completeForm.outputBulkBags),
      },
      undefined
    );
  }, [selectedShred, completeForm.outputKG, completeForm.productionDamageKG, completeForm.outputBulkBags, toleranceVersion]);

  const shreddingStartTolerance = useMemo(() => {
    return evaluateShreddingWeightTolerances(
      {
        inputKG: Number(startForm.inputKG),
        outputKG: 0,
      },
      undefined
    );
  }, [startForm.inputKG, toleranceVersion]);

  // Handle Complete Job Submit
  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShred) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = completeShreddingJob(
      selectedShred.id,
      Number(completeForm.outputKG),
      Number(completeForm.outputBulkBags),
      Number(completeForm.productionDamageKG),
      completeForm.varianceReason
    );

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? 'تم توثيق مخرجات الثرم وحساب الفروقات وتالف الإنتاج بنجاح'
          : 'Shredding output recorded with damage and variance logged.'
      );
      setActiveTab('RETURN_STORAGE');
    } else {
      setErrorMessage(res.error || 'فشل توثيق المخرجات');
    }
  };

  // Handle Return to Storage Submit
  const handleReturnToStorageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShred) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = returnShreddedToStorage(
      selectedShred.id,
      returnWarehouseId,
      returnLocationId
    );

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? 'تم إيداع حبيبات الثرم النظيفة في المستودع بنجاح وتحديث الرصيد الحي بموجب مستند 360'
          : 'Shredded clean regrind deposited into storage warehouse successfully (Doc 360).'
      );
      setActiveTab('LIST');
    } else {
      setErrorMessage(res.error || 'فشل الإيداع في المستودع');
    }
  };

  // Pending queue: items received with requiresShredding=true awaiting therm
  const pendingIntakeForShredding = receivingTransactions.filter(
    (r) =>
      r.status === 'Waiting for Shredding' ||
      r.status === 'WAITING_FOR_THERM' ||
      (r.requiresShredding && (r.status === 'Received' || r.status === 'RECEIVED'))
  );

  const filteredShreddings = shreddingTransactions.filter((s) => {
    return (
      s.shreddingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.legacyDocumentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.machineId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              DOC-360 / 352 - وحدة الثرم والجرش
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'خطوط تدوير وجرش السكراب وتالف الإنتاج' : 'Scrap & Regrind Therm Unit'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'إدارة عمليات الثرم والجرش (الثرم)' : 'Industrial Shredding & Regrind (Therm) Module'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'تشغيل مكائن الثرم، حساب مدخلات ومخرجات الوزن، توثيق تالف الإنتاج، وتحويل المواد المعالجة للخزن.'
              : 'Machine job dispatch, weight mass balance, production damage logging, and regrind warehousing.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* QR Scanner Trigger */}
          <button
            onClick={() => setIsQrScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors cursor-pointer"
            title={isRTL ? 'مسح باركود الشلايف والوجبات بالهاتف / الكاميرا' : 'Scan Bag or Batch QR Code'}
          >
            <Scan className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'ماسح QR' : 'Scan QR'}</span>
          </button>

          {/* Weight Tolerances Calibration Trigger */}
          <button
            onClick={() => setIsToleranceConfigOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 font-semibold text-xs transition-colors cursor-pointer"
            title={isRTL ? 'معايرة وضبط حدود التفاوت الوزني للثرم والاستلام' : 'Calibrate Weight Tolerances'}
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>{isRTL ? 'حدود التفاوت الوزني' : 'Tolerances'}</span>
          </button>

          <button
            onClick={() => setActiveTab('ENERGY_MONITOR')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ENERGY_MONITOR'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-lg'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
            }`}
            title={isRTL ? 'مراقب كفاءة الطاقة والكهرباء لمكائن الثرم' : 'Energy Efficiency & Power Monitor for Shredders'}
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'كفاءة الطاقة' : 'Energy'}</span>
          </button>

          {/* Predictive Blade Wear & Motor Current Spikes Telemetry */}
          <button
            onClick={() => setActiveTab('SENSOR_MONITOR')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SENSOR_MONITOR'
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-lg'
                : sensorAnalysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
                ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/60 text-rose-200 animate-pulse'
                : sensorAnalysis.alertLevel === 'PROACTIVE_SERVICE_REQUIRED'
                ? 'bg-amber-950/80 hover:bg-amber-900 border-amber-500/60 text-amber-200'
                : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
            }`}
            title={isRTL ? 'مراقبة مستشعرات قفزات تيار المحرك وتآكل شفرات الدوار' : 'Monitor blade wear & motor load current spikes'}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'مستشعرات الشفرات والمحرك' : 'Blade & Motor Sensors'}</span>
            {sensorAnalysis.alertLevel !== 'HEALTHY' && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setCurrentPage('maintenance_alerts')}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
            title={isRTL ? 'مراقبة ساعات عمل وشفرات مفرمة الثرم 360 وجداول الصيانة' : 'Monitor Shredder 360 hours, knives wear & maintenance alerts'}
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>{isRTL ? 'إنذارات صيانة المفرمة' : 'Shredder Alerts'}</span>
          </button>

          <button
            onClick={() => {
              setSelectedShred(null);
              setSelectedTransactionId(null);
              setActiveTab('START_JOB');
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? '+ تشغيل دورة ثرم جديدة' : '+ Start New Shredding Run'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Real-time Predictive Sensor Alert Banner for Shredder Blade Wear & Current Spikes */}
      {sensorAnalysis.alertLevel !== 'HEALTHY' && activeTab !== 'SENSOR_MONITOR' && (
        <div
          className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3.5 text-xs sm:text-sm shadow-xl transition-all ${
            sensorAnalysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
              ? 'bg-rose-950/90 border-rose-500/80 text-rose-200'
              : 'bg-amber-950/85 border-amber-500/60 text-amber-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                sensorAnalysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
                  ? 'bg-rose-900/70 text-rose-300 animate-pulse border border-rose-500/50'
                  : 'bg-amber-900/70 text-amber-300 border border-amber-500/40'
              }`}
            >
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white">
                  {sensorAnalysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
                    ? isRTL
                      ? `🚨 إنذار تنبؤي حرج: قفزات تيار خطرة (${sensorAnalysis.motorHealth.peakSpikeCurrentA}A) وتآكل شفرات الدوار (${sensorAnalysis.bladeWear.edgeWearPct}%)`
                      : `🚨 Critical Sensor Warning: Severe Current Spikes (${sensorAnalysis.motorHealth.peakSpikeCurrentA}A) & Blade Wear (${sensorAnalysis.bladeWear.edgeWearPct}%)`
                    : isRTL
                    ? `⚠️ تنبيه استباقي: تآكل متقدم لشفرات مفرمة الثرم (${sensorAnalysis.bladeWear.edgeWearPct}%) وقفزات عزم متكررة`
                    : `⚠️ Proactive Alert: Advanced Blade Wear (${sensorAnalysis.bladeWear.edgeWearPct}%) & Current Surges`}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/40 border border-white/10 text-white">
                  {sensorAnalysis.bladeWear.clearanceGapMm}mm Gap
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/40 border border-white/10 text-slate-300">
                  {sensorAnalysis.motorHealth.windingTempC}°C
                </span>
              </div>
              <p className="text-[11px] opacity-90 mt-1 leading-relaxed">
                {isRTL ? sensorAnalysis.recommendedActionAr : sensorAnalysis.recommendedActionEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={() => setActiveTab('SENSOR_MONITOR')}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'مخطط المستشعرات اللحظي' : 'View Sensor Telemetry'}</span>
            </button>
            <button
              onClick={() => setCurrentPage('maintenance_alerts')}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{isRTL ? 'إصدار أمر صيانة' : 'Maintenance Feed'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Workflow Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('LIST')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'LIST'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>{isRTL ? 'سجل عمليات الثرم (مستند 360/352)' : 'Shredding Runs Ledger'}</span>
          <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-[10px]">
            {shreddingTransactions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('START_JOB')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'START_JOB'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>1. {isRTL ? 'تلقيم وبدء الثرم (Input KG)' : '1. Feed & Start Job'}</span>
        </button>

        {selectedShred && (
          <>
            <button
              onClick={() => setActiveTab('COMPLETE_JOB')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'COMPLETE_JOB'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>2. {isRTL ? 'وزن المخرجات وتالف الإنتاج' : '2. Output & Damage'}</span>
            </button>

            <button
              onClick={() => setActiveTab('RETURN_STORAGE')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'RETURN_STORAGE'
                  ? 'bg-teal-950 text-teal-300 border border-teal-500/40 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>3. {isRTL ? 'إيداع بالمستودع (Return to Storage)' : '3. Return to Storage'}</span>
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('ENERGY_MONITOR')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ENERGY_MONITOR'
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>{isRTL ? 'كفاءة الطاقة والكهرباء' : 'Energy Monitor'}</span>
        </button>

        {/* TAB: SENSOR TELEMETRY & PREDICTIVE MAINTENANCE */}
        <button
          onClick={() => setActiveTab('SENSOR_MONITOR')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'SENSOR_MONITOR'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>{isRTL ? 'مستشعرات تآكل الشفرات وقفزات التيار' : 'Blade & Motor Sensors (Spikes)'}</span>
          {sensorAnalysis.alertLevel !== 'HEALTHY' && (
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                sensorAnalysis.alertLevel === 'CRITICAL_FAILURE_IMMINENT'
                  ? 'bg-rose-900/80 text-rose-300 border border-rose-500/40 animate-pulse'
                  : 'bg-amber-900/80 text-amber-300 border border-amber-500/40'
              }`}
            >
              {sensorAnalysis.bladeWear.edgeWearPct}%
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ALL SHREDDING TRANSACTIONS LIST */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {/* Pending Intake from Receiving alert */}
          {pendingIntakeForShredding.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
                <div>
                  <span className="font-bold text-white">
                    {isRTL
                      ? `يوجد ${pendingIntakeForShredding.length} إرسالية استلام بانتظار الثرم والجرش`
                      : `${pendingIntakeForShredding.length} incoming receipts waiting for shredding`}
                  </span>
                  <p className="text-slate-400 text-[11px]">
                    {isRTL ? 'تم توجيهها من شاشة الاستلام والميزان' : 'Routed from intake weighbridge'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pendingIntakeForShredding.slice(0, 2).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setStartForm((prev) => ({
                        ...prev,
                        sourceReceivingId: p.id,
                        materialId: p.materialId,
                        inputKG: p.netReceivedWeightKG || p.scaleInWeightKG,
                        inputBulkBags: p.bulkBagsCount,
                      }));
                      setActiveTab('START_JOB');
                    }}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow"
                  >
                    {isRTL ? 'بدء ثرم:' : 'Shred:'} {p.transactionNumber}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  isRTL
                    ? 'بحث برقم دورة الثرم، مستند 360، اسم المادة، الماكينة...'
                    : 'Search by Shredding #, Doc 360, Material, Machine...'
                }
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Shredding Table */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5 text-start">{isRTL ? 'رقم دورة الثرم / 360' : 'Job # / Doc 360'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المادة والصنف' : 'Material'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'ماكينة الثرم' : 'Machine'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'المدخلات (كغم)' : 'Input KG'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'المخرجات (كغم)' : 'Output KG'}</th>
                    <th className="p-3.5 text-end text-orange-400">{isRTL ? 'تالف إنتاج (كغم)' : 'Prod Damage'}</th>
                    <th className="p-3.5 text-end">{isRTL ? 'الفارق %' : 'Variance %'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الشلايف (د/خ)' : 'Bags (In/Out)'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredShreddings.map((sh) => (
                    <tr
                      key={sh.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        selectedShred?.id === sh.id ? 'bg-emerald-950/30' : ''
                      }`}
                    >
                      <td className="p-3.5 font-mono font-bold text-white">
                        <div>{sh.shreddingNumber}</div>
                        <div className="text-[10px] text-emerald-400">{sh.legacyDocumentNumber}</div>
                      </td>
                      <td className="p-3.5 text-slate-200">
                        <div className="font-semibold">{sh.materialName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{sh.materialCode}</div>
                      </td>
                      <td className="p-3.5 text-slate-300 font-mono text-[11px]">{sh.machineId}</td>
                      <td className="p-3.5 text-end font-mono font-bold text-slate-200">
                        {(sh.inputKG ?? 0).toLocaleString()} KG
                      </td>
                      <td className="p-3.5 text-end font-mono font-black text-emerald-300">
                        {sh.outputKG > 0 ? `${(sh.outputKG ?? 0).toLocaleString()} KG` : '---'}
                      </td>
                      <td className="p-3.5 text-end font-mono font-bold text-orange-400">
                        {sh.productionDamageKG > 0 ? `${(sh.productionDamageKG ?? 0).toLocaleString()} KG` : '---'}
                      </td>
                      <td className="p-3.5 text-end font-mono">
                        {sh.variancePercentage !== undefined && sh.outputKG > 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              sh.isAbnormalVariance
                                ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                : 'text-emerald-400'
                            }`}
                          >
                            {sh.variancePercentage.toFixed(2)}%
                          </span>
                        ) : (
                          '---'
                        )}
                      </td>
                      <td className="p-3.5 text-center font-mono text-amber-400 font-bold">
                        {sh.inputBulkBags} ➔ {sh.outputBulkBags > 0 ? sh.outputBulkBags : '?'}
                      </td>
                      <td className="p-3.5 text-center">
                        <StatusBadge status={sh.status} size="sm" showDot />
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Batch Lifecycle Timeline Trigger */}
                          <button
                            onClick={() => {
                              setLifecycleBatchPayload({
                                batchId: sh.shreddingNumber,
                                transactionNumber: sh.sourceReceivingNumber,
                                materialId: sh.materialId,
                              });
                              setIsLifecycleModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
                            title={isRTL ? 'عرض دورة حياة المادة الكاملة (Batch Lifecycle)' : 'View Batch Lifecycle Timeline'}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          {(sh.status === 'In Shredding' || sh.status === 'IN_THERM' || sh.status === 'IN_PROGRESS') && (
                            <button
                              onClick={() => {
                                setSelectedShred(sh);
                                setSelectedTransactionId(sh.id);
                                setActiveTab('COMPLETE_JOB');
                                setCompleteForm({
                                  outputKG: Math.round(sh.inputKG * 0.96),
                                  outputBulkBags: sh.inputBulkBags,
                                  productionDamageKG: Math.round(sh.inputKG * 0.02),
                                  varianceReason: '',
                                });
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
                            >
                              {isRTL ? 'تسجيل المخرجات' : 'Record Out'}
                            </button>
                          )}
                          {(sh.status === 'Shredding Completed' || sh.status === 'THERM_COMPLETED' || sh.status === 'COMPLETED') && (
                            <button
                              onClick={() => {
                                setSelectedShred(sh);
                                setSelectedTransactionId(sh.id);
                                setActiveTab('RETURN_STORAGE');
                              }}
                              className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold shadow-md shadow-teal-950"
                            >
                              {isRTL ? 'إيداع بالمستودع' : 'Store Regrind'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: START SHREDDING RUN FORM */}
      {activeTab === 'START_JOB' && (
        <div className="max-w-3xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isRTL ? 'بدء تشغيل وتلقيم ماكينة الثرم' : 'Feed & Start Shredding Batch Run'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isRTL ? 'مستند 360 / 352 - سجل مخزن الثرم' : 'Legacy Document #360 & #352 - Shredding Register'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleStartSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Material to Shred */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {t('material')} *
                </label>
                <select
                  value={startForm.materialId}
                  onChange={(e) => setStartForm({ ...startForm, materialId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                  required
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {isRTL ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shredder Machine Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {isRTL ? 'ماكينة الثرم / الجراشة' : 'Shredder Machine Line'} *
                </label>
                <select
                  value={startForm.machineId}
                  onChange={(e) => setStartForm({ ...startForm, machineId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-emerald-400"
                  required
                >
                  <option value="THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)">
                    {isRTL ? 'ماكينة الثرم 1 (دوار ثقيل 75 ك.واط)' : 'THERM-SHREDDER-01 (Heavy Duty 75kW)'}
                  </option>
                  <option value="THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)">
                    {isRTL ? 'ماكينة الثرم 2 (جرش ناعم 55 ك.واط)' : 'THERM-SHREDDER-02 (Fine Regrind 55kW)'}
                  </option>
                  <option value="THERM-SHREDDER-03 (Cup & Edge Trimmings 45kW)">
                    {isRTL ? 'ماكينة الثرم 3 (توالف حواف وأكواب 45 ك.واط)' : 'THERM-SHREDDER-03 (Cup Trimmings 45kW)'}
                  </option>
                </select>
              </div>

              {/* Input KG */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <label className="block text-xs font-bold text-cyan-300 mb-1">
                  {t('inputWeight')} (KG) *
                </label>
                <input
                  type="number"
                  value={startForm.inputKG}
                  onChange={(e) => setStartForm({ ...startForm, inputKG: Number(e.target.value) })}
                  min="1"
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-lg font-bold outline-none focus:border-cyan-400"
                  required
                />
              </div>

              {/* Input Bulk Bags */}
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40">
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  {isRTL ? 'عدد الشلايف المغذية (شليف)' : 'Input Bulk Bags'} *
                </label>
                <input
                  type="number"
                  value={startForm.inputBulkBags}
                  onChange={(e) => setStartForm({ ...startForm, inputBulkBags: Number(e.target.value) })}
                  min="1"
                  className="w-full p-2 rounded-lg bg-slate-900 border border-amber-500/50 text-amber-300 font-mono text-lg font-bold outline-none"
                  required
                />
              </div>
            </div>

            {/* Real-time Shredding Input Tolerance Threshold Alert Banner */}
            {startForm.inputKG > 0 && shreddingStartTolerance && (
              <div className="pt-2">
                <ScaleToleranceAlertBanner
                  evaluation={shreddingStartTolerance}
                  stage="SHREDDING"
                  onThresholdsUpdated={() => setToleranceVersion((v) => v + 1)}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 cursor-pointer"
              >
                {isRTL ? 'بدء تشغيل دورة الثرم (مستند 360)' : 'Start Therm Run (Doc 360)'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: COMPLETE SHREDDING JOB FORM */}
      {activeTab === 'COMPLETE_JOB' && selectedShred && (
        <div className="max-w-3xl mx-auto rounded-2xl bg-slate-900/90 border border-emerald-500/40 p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isRTL ? 'توثيق مخرجات الثرم وحساب الهوالك وتالف الإنتاج' : 'Record Shredding Output & Production Damage'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedShred.shreddingNumber} | {selectedShred.materialName}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCompleteSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-950 flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('inputWeight')}:</span>
              <span className="font-mono font-bold text-cyan-400 text-base">
                {(selectedShred.inputKG ?? 0).toLocaleString()} KG ({selectedShred.inputBulkBags} شليف)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Output Shredded KG */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50">
                <label className="block text-xs font-bold text-emerald-300 mb-1">
                  {t('outputWeight')} (حبيبات مثرومة صافية كغم) *
                </label>
                <input
                  type="number"
                  value={completeForm.outputKG}
                  onChange={(e) => setCompleteForm({ ...completeForm, outputKG: Number(e.target.value) })}
                  min="0"
                  className="w-full p-2 rounded-lg bg-slate-950 border border-emerald-500 text-emerald-300 font-mono text-xl font-black outline-none"
                  required
                />
              </div>

              {/* Output Bulk Bags */}
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50">
                <label className="block text-xs font-bold text-amber-300 mb-1">
                  {isRTL ? 'عدد الشلايف المنتجة (شليف)' : 'Output Bulk Bags'} *
                </label>
                <input
                  type="number"
                  value={completeForm.outputBulkBags}
                  onChange={(e) => setCompleteForm({ ...completeForm, outputBulkBags: Number(e.target.value) })}
                  min="1"
                  className="w-full p-2 rounded-lg bg-slate-950 border border-amber-500 text-amber-300 font-mono text-xl font-black outline-none"
                  required
                />
              </div>

              {/* Production Damage KG (تالف إنتاج) */}
              <div className="p-3.5 rounded-xl bg-orange-950/40 border border-orange-500/50 sm:col-span-2">
                <label className="block text-xs font-bold text-orange-300 mb-1 flex items-center justify-between">
                  <span>{t('productionDamageKG')} (تالف إنتاج كغم) *</span>
                  <span className="text-[10px] text-orange-400 font-mono">
                    {isRTL ? 'شوائب + بودرة غير قابلة للبثق' : 'Impurities & Fine Dust'}
                  </span>
                </label>
                <input
                  type="number"
                  value={completeForm.productionDamageKG}
                  onChange={(e) => setCompleteForm({ ...completeForm, productionDamageKG: Number(e.target.value) })}
                  min="0"
                  className="w-full p-2 rounded-lg bg-slate-950 border border-orange-500 text-orange-300 font-mono text-lg font-bold outline-none"
                  required
                />
              </div>
            </div>

            {/* Real-time Shredding Output & Process Loss Tolerance Threshold Alert Banner */}
            {completeForm.outputKG > 0 && shreddingCompleteTolerance && (
              <div className="pt-1">
                <ScaleToleranceAlertBanner
                  evaluation={shreddingCompleteTolerance}
                  stage="SHREDDING"
                  onThresholdsUpdated={() => setToleranceVersion((v) => v + 1)}
                />
              </div>
            )}

            {/* Live Variance HUD Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                isHighVariance
                  ? 'bg-rose-950/80 border-rose-500 text-rose-200 hud-glow-rose'
                  : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              }`}
            >
              <div>
                <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  {isHighVariance && <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />}
                  <span>{isRTL ? 'فارق الوزن المفقود (الهالك):' : 'Calculated Material Loss & Variance:'}</span>
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  {isRTL
                    ? 'الفارق = المدخلات - المخرجات - تالف الإنتاج'
                    : 'Variance = Input - Output - Production Damage'}
                </div>
              </div>

              <div className="text-end">
                <div className="text-xl font-black font-mono">
                  {(liveVarianceKG ?? 0).toLocaleString()} KG ({liveVariancePct}%)
                </div>
                <div className="text-[10px] font-bold">
                  {isHighVariance
                    ? isRTL
                      ? '⚠️ تحذير: الفارق يتجاوز المعدل الطبيعي (2.5%)'
                      : '⚠️ Warning: Variance exceeds 2.5% threshold'
                    : isRTL
                    ? 'ضمن الحدود المعيارية المعتمدة'
                    : 'Within nominal tolerance'}
                </div>
              </div>
            </div>

            {/* Mandatory explanation if high variance */}
            {isHighVariance && (
              <div>
                <label className="block text-xs font-bold text-rose-300 mb-1">
                  {isRTL ? 'سبب الفارق المرتفع (إلزامي للتدقيق والاعتماد)' : 'Reason for Abnormal Variance (Required)'} *
                </label>
                <input
                  type="text"
                  value={completeForm.varianceReason}
                  onChange={(e) => setCompleteForm({ ...completeForm, varianceReason: e.target.value })}
                  placeholder={
                    isRTL
                      ? 'مثال: وجود رطوبة عالية في السكراب الخام أدت لفقدان وزن أثناء الجرش...'
                      : 'E.g. High moisture content in raw scrap...'
                  }
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-rose-500 text-white text-xs outline-none"
                  required
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 cursor-pointer"
              >
                {isRTL ? 'اعتماد المخرجات ➔ إيداع بالمستودع' : 'Confirm Outputs ➔ Deposit in Storage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: RETURN TO STORAGE FORM */}
      {activeTab === 'RETURN_STORAGE' && selectedShred && (
        <div className="max-w-2xl mx-auto rounded-2xl bg-slate-900/90 border border-teal-500/40 p-6 shadow-2xl hud-glow-teal space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isRTL ? 'إيداع حبيبات الثرم في المستودع (مستند 360)' : 'Return Shredded Regrind to Storage Rack'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedShred.shreddingNumber} | {selectedShred.materialName}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleReturnToStorageSubmit} className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">{t('material')}:</span>
                <span className="font-bold text-white">{selectedShred.materialName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isRTL ? 'الكمية الجاهزة للخزن:' : 'Clean Regrind KG:'}</span>
                <span className="font-bold font-mono text-emerald-400 text-sm">
                  {(selectedShred.outputKG ?? 0).toLocaleString()} KG
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isRTL ? 'الشلايف المنتجة:' : 'Bulk Bags:'}</span>
                <span className="font-bold font-mono text-amber-400 text-sm">
                  {selectedShred.outputBulkBags} شليف
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'موقع ورف التخزين المستهدف' : 'Target Warehouse Storage Location'} *
              </label>
              <select
                value={returnLocationId}
                onChange={(e) => setReturnLocationId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-teal-400"
                required
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} - {isRTL ? loc.nameAr : loc.nameEn} ({loc.warehouseNameAr})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setActiveTab('LIST')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-teal-950 cursor-pointer"
              >
                {isRTL ? 'تأكيد الإيداع بالمستودع وإغلاق أمر الثرم' : 'Confirm Deposit to Storage & Close Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB: ENERGY EFFICIENCY MONITOR */}
      {activeTab === 'ENERGY_MONITOR' && (
        <EnergyEfficiencyMonitor embeddedInShredding={true} />
      )}

      {/* TAB: SENSOR TELEMETRY & PREDICTIVE MAINTENANCE MONITOR */}
      {activeTab === 'SENSOR_MONITOR' && (
        <ShredderSensorPredictiveMonitor
          onNavigateToMaintenanceAlerts={() => setCurrentPage('maintenance_alerts')}
        />
      )}

      {/* Real-time Tolerance Threshold Config Modal */}
      {isToleranceConfigOpen && (
        <ScaleToleranceConfigModal
          isOpen={isToleranceConfigOpen}
          onClose={() => setIsToleranceConfigOpen(false)}
          defaultCategory="SHREDDING"
          onSaved={() => setToleranceVersion((v) => v + 1)}
        />
      )}

      {/* QR Batch Scanner Modal */}
      {isQrScannerOpen && (
        <QrBatchScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          moduleContext="WAREHOUSE"
          onOpenBatchLifecycle={(payload) => {
            setLifecycleBatchPayload(payload);
            setIsLifecycleModalOpen(true);
          }}
        />
      )}

      {/* Batch Lifecycle Modal */}
      {isLifecycleModalOpen && (
        <BatchLifecycleModal
          isOpen={isLifecycleModalOpen}
          onClose={() => {
            setIsLifecycleModalOpen(false);
            setLifecycleBatchPayload(null);
          }}
          batchId={lifecycleBatchPayload?.batchId}
          bagId={lifecycleBatchPayload?.bagId}
          transactionNumber={lifecycleBatchPayload?.transactionNumber}
          materialId={lifecycleBatchPayload?.materialId}
          initialData={lifecycleBatchPayload}
        />
      )}
    </div>
  );
};
