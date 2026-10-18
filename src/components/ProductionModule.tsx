import React, { useState } from 'react';
import {
  Factory,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles,
  ClipboardList,
  Check,
  X,
  Flame,
  Calendar,
  Clock,
  Printer,
  FileText,
  Gauge,
  Sliders,
  Play,
  Pause,
  Wrench,
  Activity,
  Disc,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { StatusBadge } from './StatusBadge';
import { ProductionOrder } from '../types';
import { MachineSchedulingCalendar } from './MachineSchedulingCalendar';
import { ShiftOptimizer } from './ShiftOptimizer';

export interface ExtruderLineData {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  status: 'RUNNING' | 'IDLE' | 'MAINTENANCE' | 'STOPPED';
  operator: string;
  activeProduct: string;
  speedMPerMin: number;
  tempZoneC: number;
  thicknessMM: number;
  widthMM: number;
  todayOutputKG: number;
  todayRollsCount: number;
  todayDamageKG: number;
  downtimeMinutes: number;
  downtimeReason?: string;
}

const DEFAULT_EXTRUDERS: ExtruderLineData[] = [
  {
    id: 'EXT-01',
    code: 'EXT-1',
    nameAr: 'خط بثق الألواح والفيلم 1 (Extruder 1)',
    nameEn: 'Sheet & Film Extruder Line 1',
    status: 'RUNNING',
    operator: 'عمر القيسي (Omar Al-Qaisi)',
    activeProduct: 'فيلم رول PET شفاف 0.45 مم',
    speedMPerMin: 28.5,
    tempZoneC: 265,
    thicknessMM: 0.45,
    widthMM: 820,
    todayOutputKG: 4250,
    todayRollsCount: 14,
    todayDamageKG: 65,
    downtimeMinutes: 15,
    downtimeReason: 'تغيير شبكة الفلتر (Filter mesh change)',
  },
  {
    id: 'EXT-02',
    code: 'EXT-2',
    nameAr: 'خط بثق الألواح والفيلم 2 (Extruder 2)',
    nameEn: 'Sheet & Film Extruder Line 2',
    status: 'RUNNING',
    operator: 'حيدر الزيدي (Haidar Al-Zaidi)',
    activeProduct: 'رولات فيلم أبيض HIPS عالي المتانة 1.2 مم',
    speedMPerMin: 22.0,
    tempZoneC: 240,
    thicknessMM: 1.2,
    widthMM: 950,
    todayOutputKG: 3800,
    todayRollsCount: 10,
    todayDamageKG: 90,
    downtimeMinutes: 0,
    downtimeReason: '',
  },
  {
    id: 'EXT-03',
    code: 'EXT-3',
    nameAr: 'خط بثق الألواح والفيلم 3 (Extruder 3)',
    nameEn: 'Sheet & Film Extruder Line 3',
    status: 'IDLE',
    operator: 'كرار فاضل (Karrar Fadhil)',
    activeProduct: 'فيلم شفاف 0.35 مم PET',
    speedMPerMin: 0,
    tempZoneC: 180,
    thicknessMM: 0.35,
    widthMM: 780,
    todayOutputKG: 1950,
    todayRollsCount: 6,
    todayDamageKG: 35,
    downtimeMinutes: 45,
    downtimeReason: 'بانتظار تصريف المواد وتغذية القادوس (Waiting feed)',
  },
  {
    id: 'EXT-04',
    code: 'EXT-4',
    nameAr: 'خط بثق الألواح والفيلم 4 (Extruder 4)',
    nameEn: 'Sheet & Film Extruder Line 4',
    status: 'RUNNING',
    operator: 'أحمد جاسم (Ahmed Jassim)',
    activeProduct: 'رولات بولي بروبيلين PP بيضاء 0.8 مم',
    speedMPerMin: 25.0,
    tempZoneC: 230,
    thicknessMM: 0.8,
    widthMM: 850,
    todayOutputKG: 2900,
    todayRollsCount: 9,
    todayDamageKG: 50,
    downtimeMinutes: 20,
    downtimeReason: 'تنظيف حافة القالب (Die lip cleaning)',
  },
  {
    id: 'EXT-05',
    code: 'EXT-5',
    nameAr: 'خط بثق الألواح والفيلم 5 (Extruder 5)',
    nameEn: 'Sheet & Film Extruder Line 5',
    status: 'MAINTENANCE',
    operator: 'فريق الصيانة الميكانيكية (Maintenance Team)',
    activeProduct: 'متوقف للصيانة الدورية',
    speedMPerMin: 0,
    tempZoneC: 85,
    thicknessMM: 0.0,
    widthMM: 0,
    todayOutputKG: 0,
    todayRollsCount: 0,
    todayDamageKG: 0,
    downtimeMinutes: 180,
    downtimeReason: 'استبدال رول السحب ومعايرة الضغط الهيدروليكي (Roller & Hydraulic calibration)',
  },
  {
    id: 'EXT-06',
    code: 'EXT-6',
    nameAr: 'خط بثق الألواح والفيلم 6 (Extruder 6)',
    nameEn: 'Sheet & Film Extruder Line 6',
    status: 'RUNNING',
    operator: 'سيف الدين ماجد (Saif Al-Din Majid)',
    activeProduct: 'فيلم تغليف متعدد الطبقات 0.50 مم',
    speedMPerMin: 30.0,
    tempZoneC: 255,
    thicknessMM: 0.5,
    widthMM: 900,
    todayOutputKG: 4600,
    todayRollsCount: 15,
    todayDamageKG: 80,
    downtimeMinutes: 10,
    downtimeReason: 'تبديل رول اللف (Rewinder roll swap)',
  },
];

export const ProductionModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const {
    productionIssues,
    productionOrders,
    createProductionOrder,
    completeProductionOrder,
    productionDamages,
    recordProductionDamage,
    materials,
    warehouses,
    locations,
    inventoryBalances,
    currentUser,
    issueToProduction,
  } = useFactory();

  const [activeTab, setActiveTab] = useState<'ORDERS' | 'SCHEDULE' | 'OPTIMIZER' | 'EXTRUDERS' | 'LIST' | 'ISSUE_FORM' | 'DAMAGES'>('ORDERS');
  const [extruders, setExtruders] = useState<ExtruderLineData[]>(DEFAULT_EXTRUDERS);
  const [selectedExtruderForConfig, setSelectedExtruderForConfig] = useState<ExtruderLineData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // New Production Order Modal state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    productName: 'ألواح بلاستيكية بيضاء 1.2 مم (White Plastic Sheets)',
    productCode: 'PRD-SHT-01',
    requiredMaterialId: materials[0]?.id || '',
    plannedKG: 5000,
    shift: 'صباحية (06:00 - 14:00)',
    machineLine: 'خط بثق الألواح البلاستيكية 1 (Extruder Sheet Line 1)',
    notes: '',
  });

  // Complete Order Modal state
  const [orderToComplete, setOrderToComplete] = useState<ProductionOrder | null>(null);
  const [completeForm, setCompleteForm] = useState({
    actualOutputKG: 0,
    damageKG: 0,
    notes: '',
  });

  // New Damage Modal state
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [damageForm, setDamageForm] = useState({
    materialId: materials[0]?.id || '',
    quantityKG: 150,
    bulkBagsCount: 1,
    machineLine: 'خط بثق الألواح البلاستيكية 1',
    reason: 'تالف بداية التشغيل وتعديل السماكة',
    disposition: 'SHREDDING_QUEUE' as const,
    notes: '',
  });

  // Material Issue Form state (Doc 167)
  const [form, setForm] = useState({
    productionOrderNumber: 'PO-2026-0881',
    legacyDocumentNumber: '167/2026/044',
    materialId: materials[0]?.id || '',
    sourceWarehouseId: 'WH-01',
    sourceLocationId: 'LOC-A01',
    quantityKG: 2000,
    bulkBagsCount: 2,
    machineLine: 'خط بثق الألواح البلاستيكية 1 (Extruder Sheet Line 1)',
    shift: 'صباحية (06:00 - 14:00)',
    notes: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available stock check for chosen material
  const currentBalanceObj = inventoryBalances.find((b) => b.materialId === form.materialId);
  const availableStockKG = currentBalanceObj ? currentBalanceObj.availableKG : 0;
  const remainingStockAfterIssue = availableStockKG - Number(form.quantityKG);
  const isOverIssuing = remainingStockAfterIssue < 0;

  // Handle Material Issue Submit
  const handleSubmitIssue = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isOverIssuing) {
      setErrorMessage(
        isRTL
          ? `لا يمكن صرف كمية تتجاوز الرصيد المتاح بالمخزن! الرصيد المتاح هو ${(availableStockKG ?? 0).toLocaleString()} كغم فقط.`
          : `Cannot issue quantity greater than available stock (${(availableStockKG ?? 0).toLocaleString()} KG)!`
      );
      return;
    }

    const res = issueToProduction({
      ...form,
      quantityKG: Number(form.quantityKG),
      bulkBagsCount: Number(form.bulkBagsCount),
      operator: currentUser.nameAr,
    });

    if (res.success) {
      setSuccessMessage(
        isRTL
          ? 'تم صرف المواد للإنتاج بنجاح وإصدار مستند 167 وخصم الكمية من رصيد المستودع'
          : 'Material issued to production line successfully (Doc 167).'
      );
      setActiveTab('LIST');
    } else {
      setErrorMessage(res.error || 'فشلت عملية الصرف');
    }
  };

  // Handle Create Production Order
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createProductionOrder({
      ...newOrderForm,
      plannedKG: Number(newOrderForm.plannedKG),
    });

    if (res.success) {
      setIsNewOrderModalOpen(false);
      setSuccessMessage(isRTL ? 'تم إنشاء أمر الإنتاج وتوجيهه لخط التشغيل بنجاح' : 'Production order created successfully.');
    } else {
      setErrorMessage(res.error || 'فشل إنشاء أمر الإنتاج');
    }
  };

  // Handle Complete Production Order
  const handleCompleteOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderToComplete) return;

    const res = completeProductionOrder(
      orderToComplete.id,
      Number(completeForm.actualOutputKG),
      Number(completeForm.damageKG),
      completeForm.notes
    );

    if (res.success) {
      setOrderToComplete(null);
      setSuccessMessage(isRTL ? 'تم إغلاق وتوثيق أمر الإنتاج وترحيل الإنتاج النهائي للمخزن' : 'Production order completed.');
    } else {
      setErrorMessage(res.error || 'فشل إتمام أمر الإنتاج');
    }
  };

  // Handle Record Production Damage
  const handleRecordDamage = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordProductionDamage({
      ...damageForm,
      quantityKG: Number(damageForm.quantityKG),
      bulkBagsCount: Number(damageForm.bulkBagsCount),
    });

    if (res.success) {
      setIsDamageModalOpen(false);
      setSuccessMessage(isRTL ? 'تم توثيق تالف الإنتاج بنجاح وتوجيهه لمنطقة انتظار الثرم' : 'Production damage logged.');
    } else {
      setErrorMessage(res.error || 'فشل تسجيل تالف الإنتاج');
    }
  };

  const filteredIssues = productionIssues.filter((p) => {
    return (
      p.issueNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.legacyDocumentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productionOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.machineLine.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const filteredOrders = productionOrders.filter((o) => {
    return (
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.machineLine.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.requiredMaterialName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-purple-950/50 border border-purple-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
              DOC-167 / إدارة أوامر الإنتاج وصرف الخامات
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'تغذية خطوط البثق وتشكيل الأكواب' : 'Extrusion & Forming Supply Line'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'نظام التحكم والتشغيل بالإنتاج (Production Control)' : 'Production Management & Issue Module (Doc 167)'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'إدارة أوامر التشغيل، صرف الخامات بمستند 167، حظر السحب السالب، وتوثيق تالف الإنتاج للمطابقة.'
              : 'Dispatch materials to factory extrusion lines with automated real-time stock safety checks and damage logs.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab('SCHEDULE')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-cyan-300" />
            <span>{isRTL ? 'جدول الماكينات والورديات' : 'Machine Calendar'}</span>
          </button>
          <button
            onClick={() => setIsNewOrderModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'أمر إنتاج جديد' : 'New PO'}</span>
          </button>
          <button
            onClick={() => setActiveTab('ISSUE_FORM')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'صرف خامات (مستند 167)' : 'Issue Materials (167)'}</span>
          </button>
          <button
            onClick={() => setIsDamageModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل تالف إنتاج' : 'Log Scrap / Damage'}</span>
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

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ORDERS'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>{isRTL ? 'أوامر التشغيل والإنتاج' : 'Production Orders'}</span>
          <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-[10px]">
            {productionOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SCHEDULE')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'SCHEDULE'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>{isRTL ? 'جدول ومناوبات الماكينات' : 'Machine Scheduling'}</span>
          <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded font-mono text-[10px]">
            {isRTL ? 'تخطيط' : 'Plan'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('OPTIMIZER')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'OPTIMIZER'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>{isRTL ? 'مُحسِّن الورديات وفترات الراحة' : 'Shift Optimizer'}</span>
          <span className="px-1.5 py-0.2 bg-purple-900/60 text-purple-300 border border-purple-500/30 rounded font-mono text-[10px]">
            AI
          </span>
        </button>

        <button
          onClick={() => setActiveTab('EXTRUDERS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'EXTRUDERS'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span>{isRTL ? 'خطوط البثق والفيلم (Extruders 1-6)' : 'Extrusion Lines 1-6'}</span>
          <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-500/40 rounded font-mono text-[10px]">
            {extruders.filter((e) => e.status === 'RUNNING').length}/6 {isRTL ? 'يعمل' : 'active'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('LIST')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'LIST'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>{isRTL ? 'سجل المنصرف للإنتاج (مستند 167)' : 'Production Issues Ledger (167)'}</span>
          <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-[10px]">
            {productionIssues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ISSUE_FORM')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'ISSUE_FORM'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isRTL ? 'نموذج صرف جديد لمكائن المصنع' : 'New Dispatch Order Form'}</span>
        </button>

        <button
          onClick={() => setActiveTab('DAMAGES')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeTab === 'DAMAGES'
              ? 'bg-purple-950 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{isRTL ? 'سجل تالف وهوالك الإنتاج' : 'Production Damage Records'}</span>
          <span className="px-1.5 py-0.2 bg-slate-800 rounded font-mono text-[10px] text-rose-300">
            {productionDamages.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PRODUCTION ORDERS */}
      {/* ========================================================= */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRTL ? 'بحث برقم أمر الإنتاج، اسم المنتج، خط البثق...' : 'Search by PO #, Product, Machine...'}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5 text-start">{isRTL ? 'رقم أمر الإنتاج' : 'PO #'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المنتج النهائي المطلوب' : 'Target Product'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المادة الخام المطلوبة' : 'Required Material'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'خط الإنتاج / الوردية' : 'Line / Shift'}</th>
                    <th className="p-3.5 text-end text-cyan-300 font-bold">{isRTL ? 'المخطط (كغم)' : 'Planned (KG)'}</th>
                    <th className="p-3.5 text-end text-emerald-300 font-bold">{isRTL ? 'المنجز الفعلي' : 'Actual Output'}</th>
                    <th className="p-3.5 text-end text-rose-300 font-bold">{isRTL ? 'المتبقي' : 'Remaining'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        {isRTL ? 'لا توجد أوامر إنتاج مطابقة للبحث' : 'No production orders found'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const completionPercent = o.plannedKG > 0 ? Math.min(100, ((o.actualProductionKG / o.plannedKG) * 100)) : 0;
                      return (
                        <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-white">
                            <div>{o.orderNumber}</div>
                            <div className="text-[10px] text-slate-400">{o.date}</div>
                          </td>
                          <td className="p-3.5 text-slate-200">
                            <div className="font-semibold text-purple-200">{o.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{o.productCode}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            <div>{o.requiredMaterialName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{o.requiredMaterialCode}</div>
                          </td>
                          <td className="p-3.5 text-slate-300">
                            <div className="font-medium text-[11px]">{o.machineLine}</div>
                            <div className="text-[10px] text-slate-400">{o.shift}</div>
                          </td>
                          <td className="p-3.5 text-end font-mono font-bold text-cyan-300">
                            {(o.plannedKG ?? 0).toLocaleString()} KG
                          </td>
                          <td className="p-3.5 text-end font-mono font-black text-emerald-400">
                            <div>{(o.actualProductionKG ?? 0).toLocaleString()} KG</div>
                            <div className="w-20 bg-slate-800 rounded-full h-1.5 mt-1 ml-auto">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full"
                                style={{ width: `${completionPercent}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-3.5 text-end font-mono font-bold text-rose-300">
                            {(o.remainingKG ?? 0).toLocaleString()} KG
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                o.status === 'COMPLETED'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                  : o.status === 'IN_PROGRESS'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              }`}
                            >
                              {o.status === 'COMPLETED'
                                ? 'مكتمل'
                                : o.status === 'IN_PROGRESS'
                                ? 'قيد التشغيل'
                                : 'جاهز للتشغيل'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {o.status !== 'COMPLETED' ? (
                              <button
                                onClick={() => {
                                  setOrderToComplete(o);
                                  setCompleteForm({
                                    actualOutputKG: o.plannedKG,
                                    damageKG: 0,
                                    notes: '',
                                  });
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors shadow-xs"
                              >
                                {isRTL ? 'إتمام الأمر' : 'Complete'}
                              </button>
                            ) : (
                              <span className="text-slate-500 text-[11px]">✓ مغلق</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB: MACHINE SCHEDULING CALENDAR & CAPACITY PLANNING */}
      {/* ========================================================= */}
      {activeTab === 'SCHEDULE' && (
        <MachineSchedulingCalendar onOpenShiftOptimizer={() => setActiveTab('OPTIMIZER')} />
      )}

      {/* ========================================================= */}
      {/* TAB: SHIFT OPTIMIZER (مُحسِّن فترات الورديات والراحة) */}
      {/* ========================================================= */}
      {activeTab === 'OPTIMIZER' && (
        <ShiftOptimizer
          onApplyToSchedule={() => {
            setActiveTab('SCHEDULE');
          }}
        />
      )}

      {/* ========================================================= */}
      {/* TAB: EXTRUSION LINES 1-6 (خطوط البثق والفيلم) */}
      {/* ========================================================= */}
      {activeTab === 'EXTRUDERS' && (
        <div className="space-y-6">
          {/* Extruders KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono uppercase flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRTL ? 'الخطوط العاملة حالياً' : 'Running Extruders'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                {extruders.filter((e) => e.status === 'RUNNING').length}{' '}
                <span className="text-xs text-slate-400 font-normal">/ 6 {isRTL ? 'خطوط' : 'lines'}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono uppercase flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'إجمالي رولات الفيلم اليوم' : 'Total Rolls Today'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
                {extruders.reduce((sum, e) => sum + e.todayRollsCount, 0)}{' '}
                <span className="text-xs text-slate-400 font-normal">{isRTL ? 'رول' : 'rolls'}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono uppercase flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isRTL ? 'إنتاج الفيلم الكلي اليوم' : 'Total Film Output KG'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-indigo-300 mt-1">
                {extruders.reduce((sum, e) => sum + e.todayOutputKG, 0).toLocaleString()}{' '}
                <span className="text-xs text-slate-400 font-normal">KG</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-mono uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRTL ? 'إجمالي التوقفات اليوم' : 'Total Downtime'}</span>
              </div>
              <div className="text-2xl font-black font-mono text-amber-400 mt-1">
                {extruders.reduce((sum, e) => sum + e.downtimeMinutes, 0)}{' '}
                <span className="text-xs text-slate-400 font-normal">{isRTL ? 'دقيقة' : 'mins'}</span>
              </div>
            </div>
          </div>

          {/* Extruders 1-6 Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {extruders.map((ext) => {
              const statusColor =
                ext.status === 'RUNNING'
                  ? 'border-emerald-500/50 bg-slate-900/90'
                  : ext.status === 'IDLE'
                  ? 'border-amber-500/50 bg-slate-900/90'
                  : ext.status === 'MAINTENANCE'
                  ? 'border-rose-500/50 bg-slate-900/90'
                  : 'border-slate-800 bg-slate-900/50';

              const badgeColor =
                ext.status === 'RUNNING'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  : ext.status === 'IDLE'
                  ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                  : ext.status === 'MAINTENANCE'
                  ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700';

              return (
                <div
                  key={ext.id}
                  className={`rounded-2xl border p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all ${statusColor}`}
                >
                  {/* Top Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-950 text-cyan-400 border border-slate-800">
                          {ext.code}
                        </span>
                        <h4 className="font-bold text-white text-sm">{ext.nameAr}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                        {ext.status === 'RUNNING'
                          ? 'يعمل (Active)'
                          : ext.status === 'IDLE'
                          ? 'خامل (Idle)'
                          : ext.status === 'MAINTENANCE'
                          ? 'صيانة (Service)'
                          : 'متوقف (Stopped)'}
                      </span>
                    </div>

                    {/* Operator & Product */}
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">{isRTL ? 'المشغل المكلف:' : 'Operator:'}</span>
                        <span className="font-semibold text-white">{ext.operator}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">{isRTL ? 'المنتج الجاري:' : 'Current Film:'}</span>
                        <span className="font-semibold text-purple-300 truncate max-w-[180px]">{ext.activeProduct}</span>
                      </div>
                    </div>

                    {/* Live Line Config: Speed, Temp, Thickness, Width */}
                    <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-800/80 bg-slate-950/60 p-2.5 rounded-xl text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'السرعة' : 'Speed'}</div>
                        <div className="font-mono font-bold text-cyan-300 text-xs mt-0.5">
                          {ext.speedMPerMin} <span className="text-[9px] font-sans text-slate-400">m/m</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'الحرارة' : 'Temp'}</div>
                        <div className="font-mono font-bold text-amber-300 text-xs mt-0.5">
                          {ext.tempZoneC}°C
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'السماكة' : 'Thick'}</div>
                        <div className="font-mono font-bold text-emerald-300 text-xs mt-0.5">
                          {ext.thicknessMM} <span className="text-[9px] font-sans text-slate-400">mm</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'العرض' : 'Width'}</div>
                        <div className="font-mono font-bold text-purple-300 text-xs mt-0.5">
                          {ext.widthMM} <span className="text-[9px] font-sans text-slate-400">mm</span>
                        </div>
                      </div>
                    </div>

                    {/* Output & Scrap Today */}
                    <div className="grid grid-cols-3 gap-2 mt-3 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'رولات اليوم' : 'Rolls'}</div>
                        <div className="font-mono font-black text-cyan-400 text-sm mt-0.5">
                          {ext.todayRollsCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'إنتاج تام' : 'Output'}</div>
                        <div className="font-mono font-black text-emerald-400 text-sm mt-0.5">
                          {ext.todayOutputKG.toLocaleString()} <span className="text-[9px] font-sans">KG</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{isRTL ? 'هالك وتالف' : 'Scrap'}</div>
                        <div className="font-mono font-black text-rose-400 text-sm mt-0.5">
                          {ext.todayDamageKG} <span className="text-[9px] font-sans">KG</span>
                        </div>
                      </div>
                    </div>

                    {/* Downtime info */}
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{isRTL ? 'التوقف:' : 'Downtime:'}</span>
                      </span>
                      <span className="font-mono text-amber-300 font-bold">
                        {ext.downtimeMinutes} {isRTL ? 'دقيقة' : 'mins'}
                        {ext.downtimeReason && (
                          <span className="text-slate-400 font-sans font-normal text-[10px] ml-1">
                            ({ext.downtimeReason})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions Toolbar per Line */}
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-3 gap-1.5 text-xs">
                    {/* Record Output Roll */}
                    <button
                      onClick={() => {
                        const addedKG = 300;
                        setExtruders((prev) =>
                          prev.map((e) =>
                            e.id === ext.id
                              ? {
                                  ...e,
                                  todayRollsCount: e.todayRollsCount + 1,
                                  todayOutputKG: e.todayOutputKG + addedKG,
                                }
                              : e
                          )
                        );
                        setSuccessMessage(
                          isRTL
                            ? `تم تسجيل رول فيلم جديد لـ (${ext.nameAr}) بوزن ${addedKG} كغم بنجاح.`
                            : `Recorded new roll on ${ext.code} (${addedKG} KG).`
                        );
                      }}
                      className="py-1.5 px-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                      title={isRTL ? 'تسجيل رول فيلم جديد' : 'Record Film Roll'}
                    >
                      <Disc className="w-3 h-3" />
                      <span>{isRTL ? '+ رول فيلم' : '+ Roll'}</span>
                    </button>

                    {/* Log Scrap for this line */}
                    <button
                      onClick={() => {
                        setDamageForm((prev) => ({
                          ...prev,
                          machineLine: ext.nameAr,
                          quantityKG: 25,
                        }));
                        setIsDamageModalOpen(true);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                      title={isRTL ? 'تسجيل هالك وتالف' : 'Log Scrap'}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>{isRTL ? 'تالف خط' : 'Scrap'}</span>
                    </button>

                    {/* Edit Line Config */}
                    <button
                      onClick={() => setSelectedExtruderForConfig(ext)}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                      title={isRTL ? 'معايرة سرعة وحرارة الخط' : 'Configure Line'}
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{isRTL ? 'معايرة' : 'Config'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LINE CONFIGURATION & DOWNTIME MODAL */}
      {selectedExtruderForConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                <span>{selectedExtruderForConfig.nameAr} - ضبط ومعايرة الخط</span>
              </h3>
              <button onClick={() => setSelectedExtruderForConfig(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setExtruders((prev) =>
                  prev.map((item) =>
                    item.id === selectedExtruderForConfig.id ? selectedExtruderForConfig : item
                  )
                );
                setSelectedExtruderForConfig(null);
                setSuccessMessage(isRTL ? 'تم حفظ معايير خط البثق وتحديث حالة التشغيل' : 'Extruder parameters updated.');
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'حالة الخط' : 'Status'}
                  </label>
                  <select
                    value={selectedExtruderForConfig.status}
                    onChange={(e) =>
                      setSelectedExtruderForConfig({
                        ...selectedExtruderForConfig,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="RUNNING">يعمل (RUNNING)</option>
                    <option value="IDLE">خامل (IDLE)</option>
                    <option value="MAINTENANCE">صيانة (MAINTENANCE)</option>
                    <option value="STOPPED">متوقف (STOPPED)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'المشغل المكلف' : 'Assigned Operator'}
                  </label>
                  <input
                    type="text"
                    value={selectedExtruderForConfig.operator}
                    onChange={(e) =>
                      setSelectedExtruderForConfig({
                        ...selectedExtruderForConfig,
                        operator: e.target.value,
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'سرعة السحب (متر/دقيقة)' : 'Line Speed (m/min)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedExtruderForConfig.speedMPerMin}
                    onChange={(e) =>
                      setSelectedExtruderForConfig({
                        ...selectedExtruderForConfig,
                        speedMPerMin: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 font-mono font-bold outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'حرارة منطقة الصهر (°C)' : 'Melt Temp (°C)'}
                  </label>
                  <input
                    type="number"
                    value={selectedExtruderForConfig.tempZoneC}
                    onChange={(e) =>
                      setSelectedExtruderForConfig({
                        ...selectedExtruderForConfig,
                        tempZoneC: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-mono font-bold outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'سماكة الفيلم (مم)' : 'Thickness (mm)'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedExtruderForConfig.thicknessMM}
                    onChange={(e) =>
                      setSelectedExtruderForConfig({
                        ...selectedExtruderForConfig,
                        thicknessMM: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono font-bold outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'عرض الرول (مم)' : 'Roll Width (mm)'}
                  </label>
                  <input
                    type="number"
                    value={selectedExtruderForConfig.widthMM}
                    onChange={(e) =>
                      setSelectedExtruderForConfig({
                        ...selectedExtruderForConfig,
                        widthMM: Number(e.target.value),
                      })
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-purple-300 font-mono font-bold outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>{isRTL ? 'تتبع فترات التوقف (Downtime Tracking)' : 'Downtime Tracking'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">
                      {isRTL ? 'مدة التوقف (دقيقة)' : 'Minutes'}
                    </label>
                    <input
                      type="number"
                      value={selectedExtruderForConfig.downtimeMinutes}
                      onChange={(e) =>
                        setSelectedExtruderForConfig({
                          ...selectedExtruderForConfig,
                          downtimeMinutes: Number(e.target.value),
                        })
                      }
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">
                      {isRTL ? 'سبب التوقف' : 'Reason'}
                    </label>
                    <input
                      type="text"
                      value={selectedExtruderForConfig.downtimeReason || ''}
                      onChange={(e) =>
                        setSelectedExtruderForConfig({
                          ...selectedExtruderForConfig,
                          downtimeReason: e.target.value,
                        })
                      }
                      placeholder={isRTL ? 'تنظيف قالب، تغيير خامة...' : 'Reason...'}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedExtruderForConfig(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-950"
                >
                  {isRTL ? 'حفظ المعايير' : 'Save Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ISSUES LEDGER (DOC 167) */}
      {/* ========================================================= */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  isRTL
                    ? 'بحث برقم الصرف، مستند 167، أمر التشغيل، المادة، خط الإنتاج...'
                    : 'Search Issue #, Doc 167, PO #, Material, Machine Line...'
                }
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5 text-start">{isRTL ? 'رقم الصرف / 167' : 'Issue # / Doc 167'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'التاريخ والوردية' : 'Date / Shift'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'أمر الإنتاج' : 'PO #'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المادة والصنف' : 'Material'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'خط الإنتاج / الماكينة' : 'Machine Line'}</th>
                    <th className="p-3.5 text-end text-purple-300 font-bold">{isRTL ? 'الكمية المنصرفة (كغم)' : 'Qty (KG)'}</th>
                    <th className="p-3.5 text-center text-amber-400 font-bold">{isRTL ? 'الشلايف' : 'Bags'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredIssues.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-white">
                        <div>{p.issueNumber}</div>
                        <div className="text-[10px] text-purple-400">{p.legacyDocumentNumber}</div>
                      </td>
                      <td className="p-3.5 text-slate-300">
                        <div className="font-mono">{p.date}</div>
                        <div className="text-[10px] text-slate-400">{p.shift}</div>
                      </td>
                      <td className="p-3.5 font-mono text-cyan-400 font-bold">{p.productionOrderNumber}</td>
                      <td className="p-3.5 text-slate-200">
                        <div className="font-semibold">{p.materialName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{p.materialCode}</div>
                      </td>
                      <td className="p-3.5 text-slate-300 font-medium">{p.machineLine}</td>
                      <td className="p-3.5 text-end font-mono font-black text-purple-300 text-sm">
                        {(p.quantityKG ?? 0).toLocaleString()} KG
                      </td>
                      <td className="p-3.5 text-center font-mono text-amber-400 font-bold">
                        {p.bulkBagsCount}
                      </td>
                      <td className="p-3.5 text-center">
                        <StatusBadge status={p.status} size="sm" showDot />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: ISSUE FORM (DOC 167) */}
      {/* ========================================================= */}
      {activeTab === 'ISSUE_FORM' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {isRTL ? 'إصدار أمر صرف مواد خامات للإنتاج' : 'Issue Raw Material to Production Line'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL ? 'مستند 167 - صادر مواد خامات' : 'Legacy Document #167 - Raw Material Issue Order'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Material Selection */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t('material')} *
                  </label>
                  <select
                    value={form.materialId}
                    onChange={(e) => setForm({ ...form, materialId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400"
                    required
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {isRTL ? m.nameAr : m.nameEn} ({m.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Production Order # */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'رقم أمر التشغيل (PO)' : 'Production Order #'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.productionOrderNumber}
                    onChange={(e) => setForm({ ...form, productionOrderNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400 font-mono"
                  />
                </div>

                {/* Legacy Doc #167 */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'رقم مستند 167 الصادر' : 'Doc 167 Number'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.legacyDocumentNumber}
                    onChange={(e) => setForm({ ...form, legacyDocumentNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400 font-mono"
                  />
                </div>

                {/* Quantity in KG */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الكمية المنصرفة (كغم)' : 'Quantity (KG)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantityKG}
                    onChange={(e) => setForm({ ...form, quantityKG: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400 font-mono font-bold"
                  />
                </div>

                {/* Bulk Bags count */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'عدد الشلايف' : 'Bulk Bags Count'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.bulkBagsCount}
                    onChange={(e) => setForm({ ...form, bulkBagsCount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400 font-mono"
                  />
                </div>

                {/* Machine Line */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'خط الإنتاج والماكينة' : 'Machine Line'} *
                  </label>
                  <select
                    value={form.machineLine}
                    onChange={(e) => setForm({ ...form, machineLine: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400"
                  >
                    <option value="خط بثق الألواح والفيلم 1 (Extruder Sheet Line 1)">
                      خط بثق الألواح والفيلم 1 (Extruder Line 1)
                    </option>
                    <option value="خط بثق الألواح والفيلم 2 (Extruder Sheet Line 2)">
                      خط بثق الألواح والفيلم 2 (Extruder Line 2)
                    </option>
                    <option value="خط بثق الألواح والفيلم 3 (Extruder Sheet Line 3)">
                      خط بثق الألواح والفيلم 3 (Extruder Line 3)
                    </option>
                    <option value="خط بثق الألواح والفيلم 4 (Extruder Sheet Line 4)">
                      خط بثق الألواح والفيلم 4 (Extruder Line 4)
                    </option>
                    <option value="خط بثق الألواح والفيلم 5 (Extruder Sheet Line 5)">
                      خط بثق الألواح والفيلم 5 (Extruder Line 5)
                    </option>
                    <option value="خط بثق الألواح والفيلم 6 (Extruder Sheet Line 6)">
                      خط بثق الألواح والفيلم 6 (Extruder Line 6)
                    </option>
                    <option value="خط تشكيل الأكواب الحراري (Thermoforming Cup Line)">
                      خط تشكيل الأكواب الحراري (Thermoforming Cup Line)
                    </option>
                    <option value="ماكينة الثرم والتدوير (Therm Recycling Shredder)">
                      ماكينة الثرم والتدوير (Therm Recycling Shredder)
                    </option>
                  </select>
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الوردية' : 'Shift'} *
                  </label>
                  <select
                    value={form.shift}
                    onChange={(e) => setForm({ ...form, shift: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-purple-400"
                  >
                    <option value="صباحية (06:00 - 14:00)">صباحية (06:00 - 14:00)</option>
                    <option value="مسائية (14:00 - 22:00)">مسائية (14:00 - 22:00)</option>
                    <option value="ليلية (22:00 - 06:00)">ليلية (22:00 - 06:00)</option>
                  </select>
                </div>
              </div>

              {/* Real-time Inventory Stock Validation Box */}
              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  isOverIssuing
                    ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                    : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>{isRTL ? 'فحص ومطابقة الرصيد المتاح بالمستودع:' : 'Warehouse Stock Verification:'}</span>
                  <span className="font-mono text-sm font-black">
                    {(availableStockKG ?? 0).toLocaleString()} KG
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>{isRTL ? 'الرصيد المتبقي بعد الصرف المقترح:' : 'Stock after proposed issue:'}</span>
                  <span
                    className={`font-mono font-bold ${
                      isOverIssuing ? 'text-rose-400 text-sm' : 'text-emerald-300'
                    }`}
                  >
                    {(remainingStockAfterIssue ?? 0).toLocaleString()} KG
                  </span>
                </div>
                <div className="pt-1 text-[11px] font-semibold">
                  {isOverIssuing
                    ? isRTL
                      ? '⛔ تنبيه: لا يمكن الصرف بالسالب! الكمية المطلوبة تتجاوز الرصيد المتاح.'
                      : '⛔ REJECTED: Over-issuing'
                    : isRTL
                    ? '✓ مطابق ومسموح بالصرف'
                    : '✓ Validated Stock OK'}
                </div>
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
                  disabled={isOverIssuing}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
                    isOverIssuing
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-950 cursor-pointer'
                  }`}
                >
                  {isRTL ? 'اعتماد الصرف وإصدار مستند 167' : 'Confirm Issue & Generate Doc 167'}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>{isRTL ? 'شروط صرف المواد لمكائن المصنع' : 'Extrusion Dispatch Rules'}</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>{isRTL ? 'إلزامية تسجيل رقم أمر التشغيل (PO) لربط استهلاك الخامات بالإنتاج النهائي.' : 'Production Order # mandatory for cost accounting.'}</li>
                <li>{isRTL ? 'يمنع منعاً باتاً صرف أي كمية دون وجود رصيد فعلي مثبت بسجل الحركات.' : 'Over-issuing strictly blocked by transaction ledger.'}</li>
                <li>{isRTL ? 'يتم خصم الشلايف والكيلوغرام فوراً من رصيد المستودع المعين.' : 'Inventory balances deducted in real-time on confirmation.'}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: PRODUCTION DAMAGES */}
      {/* ========================================================= */}
      {activeTab === 'DAMAGES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-950 border border-rose-500/40 text-rose-400 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-sm">
                  {isRTL ? 'سجل تالف وهوالك الإنتاج (Scrap & Damage Logs)' : 'Production Scrap & Damage Logs'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isRTL ? 'حصر وتوثيق تالف خطوط البثق وتوجيهه لمنطقة انتظار الثرم للتدوير' : 'Extrusion scrap tracking routed for therm recycling'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsDamageModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'تسجيل تالف جديد' : 'New Scrap Entry'}</span>
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
                  <tr>
                    <th className="p-3.5 text-start">{isRTL ? 'رقم التالف' : 'Damage #'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'المادة' : 'Material'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'خط الإنتاج' : 'Machine Line'}</th>
                    <th className="p-3.5 text-end text-rose-300 font-bold">{isRTL ? 'الكمية (كغم)' : 'Qty (KG)'}</th>
                    <th className="p-3.5 text-center text-amber-300 font-bold">{isRTL ? 'الشلايف' : 'Bags'}</th>
                    <th className="p-3.5 text-start">{isRTL ? 'سبب التالف' : 'Reason'}</th>
                    <th className="p-3.5 text-center">{isRTL ? 'التوجيه' : 'Disposition'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {productionDamages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        {isRTL ? 'لا توجد سجلات تالف مسجلة' : 'No damage records found'}
                      </td>
                    </tr>
                  ) : (
                    productionDamages.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-rose-300">{d.damageNumber}</td>
                        <td className="p-3.5 text-slate-300">
                          <div>{d.date}</div>
                          <div className="text-[10px] text-slate-400">{d.time}</div>
                        </td>
                        <td className="p-3.5 text-slate-200">
                          <div>{d.materialName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{d.materialCode}</div>
                        </td>
                        <td className="p-3.5 text-slate-300">{d.machineLine}</td>
                        <td className="p-3.5 text-end font-mono font-black text-rose-400 text-sm">
                          {(d.quantityKG ?? 0).toLocaleString()} KG
                        </td>
                        <td className="p-3.5 text-center font-mono text-amber-300 font-bold">
                          {d.bulkBagsCount}
                        </td>
                        <td className="p-3.5 text-slate-300">{d.reason}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                            {d.dispositionAr}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL */}
      {isNewOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-purple-400" />
                <span>{isRTL ? 'إنشاء أمر تشغيل وإنتاج جديد' : 'New Production Order'}</span>
              </h3>
              <button onClick={() => setIsNewOrderModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'اسم المنتج النهائي المطلوب' : 'Target Finished Product'} *
                </label>
                <input
                  type="text"
                  required
                  value={newOrderForm.productName}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, productName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'المادة الخام المطلوبة للاستهلاك' : 'Required Raw Material'} *
                </label>
                <select
                  value={newOrderForm.requiredMaterialId}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, requiredMaterialId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-purple-400"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {isRTL ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'الكمية المخططة (كغم)' : 'Planned Output (KG)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newOrderForm.plannedKG}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, plannedKG: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-purple-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'الوردية' : 'Shift'} *
                  </label>
                  <select
                    value={newOrderForm.shift}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, shift: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-purple-400"
                  >
                    <option value="صباحية (06:00 - 14:00)">صباحية (06:00 - 14:00)</option>
                    <option value="مسائية (14:00 - 22:00)">مسائية (14:00 - 22:00)</option>
                    <option value="ليلية (22:00 - 06:00)">ليلية (22:00 - 06:00)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'خط الإنتاج والماكينة' : 'Machine Line'} *
                </label>
                <select
                  value={newOrderForm.machineLine}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, machineLine: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-purple-400"
                >
                  <option value="خط بثق الألواح والفيلم 1 (Extruder Sheet Line 1)">
                    خط بثق الألواح والفيلم 1 (Extruder Line 1)
                  </option>
                  <option value="خط بثق الألواح والفيلم 2 (Extruder Sheet Line 2)">
                    خط بثق الألواح والفيلم 2 (Extruder Line 2)
                  </option>
                  <option value="خط بثق الألواح والفيلم 3 (Extruder Sheet Line 3)">
                    خط بثق الألواح والفيلم 3 (Extruder Line 3)
                  </option>
                  <option value="خط بثق الألواح والفيلم 4 (Extruder Sheet Line 4)">
                    خط بثق الألواح والفيلم 4 (Extruder Line 4)
                  </option>
                  <option value="خط بثق الألواح والفيلم 5 (Extruder Sheet Line 5)">
                    خط بثق الألواح والفيلم 5 (Extruder Line 5)
                  </option>
                  <option value="خط بثق الألواح والفيلم 6 (Extruder Sheet Line 6)">
                    خط بثق الألواح والفيلم 6 (Extruder Line 6)
                  </option>
                  <option value="خط تشكيل الأكواب الحراري (Thermoforming Cup Line)">
                    خط تشكيل الأكواب الحراري (Thermoforming Cup Line)
                  </option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewOrderModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg"
                >
                  {isRTL ? 'إنشاء أمر الإنتاج' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETE ORDER MODAL */}
      {orderToComplete && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'إغلاق وإتمام أمر الإنتاج' : 'Complete Production Order'}</span>
              </h3>
              <button onClick={() => setOrderToComplete(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
              <div className="font-bold text-white text-sm">{orderToComplete.orderNumber}</div>
              <div className="text-slate-400">{orderToComplete.productName}</div>
              <div className="text-slate-400">
                المخطط: <span className="font-bold text-cyan-300 font-mono">{(orderToComplete.plannedKG ?? 0).toLocaleString()} كغم</span>
              </div>
            </div>

            <form onSubmit={handleCompleteOrder} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'الإنتاج التام الفعلي (كغم)' : 'Actual Finished Output (KG)'} *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={completeForm.actualOutputKG}
                  onChange={(e) => setCompleteForm({ ...completeForm, actualOutputKG: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-400 font-mono font-bold text-emerald-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'كمية التالف والهوالك الناتجة (كغم إن وجد)' : 'Damage / Scrap (KG)'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={completeForm.damageKG}
                  onChange={(e) => setCompleteForm({ ...completeForm, damageKG: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-rose-400 font-mono font-bold text-rose-300"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'ملاحظات إغلاق الأمر' : 'Closing Notes'}
                </label>
                <input
                  type="text"
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  placeholder={isRTL ? 'تم مطابقته مع المواصفات القياسية...' : 'Notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setOrderToComplete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg"
                >
                  {isRTL ? 'تأكيد وإتمام الأمر' : 'Confirm Completion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD DAMAGE MODAL */}
      {isDamageModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>{isRTL ? 'تسجيل وتوثيق تالف إنتاج' : 'Log Production Damage'}</span>
              </h3>
              <button onClick={() => setIsDamageModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDamage} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'المادة' : 'Material'} *
                </label>
                <select
                  value={damageForm.materialId}
                  onChange={(e) => setDamageForm({ ...damageForm, materialId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-rose-400"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {isRTL ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'وزن التالف (كغم)' : 'Damage Qty (KG)'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={damageForm.quantityKG}
                    onChange={(e) => setDamageForm({ ...damageForm, quantityKG: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-rose-400 font-mono font-bold text-rose-300"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'عدد الشلايف' : 'Bags Count'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={damageForm.bulkBagsCount}
                    onChange={(e) => setDamageForm({ ...damageForm, bulkBagsCount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-rose-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'سبب التالف' : 'Reason for Scrap'} *
                </label>
                <input
                  type="text"
                  required
                  value={damageForm.reason}
                  onChange={(e) => setDamageForm({ ...damageForm, reason: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-rose-400"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDamageModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg"
                >
                  {isRTL ? 'توثيق التالف' : 'Log Damage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
