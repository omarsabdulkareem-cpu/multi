import React, { useState, useMemo } from 'react';
import {
  Activity,
  Calendar,
  Layers,
  Factory,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  RefreshCw,
  Plus,
  Boxes,
  Flame,
  ArrowRight,
  HelpCircle,
  FileCheck,
  Mic,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { DailyVoiceOperationsNotesPanel } from './DailyVoiceOperationsNotesPanel';
import { VoiceOperationsDictationModal } from './VoiceOperationsDictationModal';

export const DailyOperationsTracker: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    getDailyOperationsSummary,
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    productionOrders,
    productionDamages,
    inventoryBalances,
    materials,
    setCurrentPage,
    setSelectedTransactionId,
  } = useFactory();

  // Selected date & shift filter
  const todayStr = useMemo(() => {
    const dates = [
      ...receivingTransactions.map((r) => r.date),
      ...shreddingTransactions.map((s) => s.shreddingStart ? (s.shreddingStart.includes('T') ? s.shreddingStart.split('T')[0] : s.shreddingStart.split(' ')[0]) : ''),
      ...productionIssues.map((p) => p.date),
    ].filter(Boolean);
    return dates.length > 0 ? dates.sort().reverse()[0] : '2026-09-02';
  }, [receivingTransactions, shreddingTransactions, productionIssues]);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('ALL');
  const [selectedSection, setSelectedSection] = useState<'ALL' | 'THERM' | 'PRODUCTION' | 'STORAGE'>('ALL');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceRefreshKey, setVoiceRefreshKey] = useState(0);

  // Compute live 3-section summary from database
  const summary = useMemo(() => {
    return getDailyOperationsSummary(selectedDate, selectedShift);
  }, [getDailyOperationsSummary, selectedDate, selectedShift]);

  // Shredding transactions for selected day
  const dayShreddings = useMemo(() => {
    return shreddingTransactions.filter((s) => {
      const sDate = s.shreddingStart
        ? (s.shreddingStart.includes('T') ? s.shreddingStart.split('T')[0] : s.shreddingStart.split(' ')[0])
        : (s.shreddingEnd ? (s.shreddingEnd.includes('T') ? s.shreddingEnd.split('T')[0] : s.shreddingEnd.split(' ')[0]) : '');
      const matchDate = sDate === selectedDate;
      const matchMat = selectedMaterial === 'ALL' || s.materialId === selectedMaterial || s.materialName.includes(selectedMaterial);
      return matchDate && matchMat;
    });
  }, [shreddingTransactions, selectedDate, selectedMaterial]);

  // Production issues for selected day
  const dayProductionIssues = useMemo(() => {
    return productionIssues.filter((p) => {
      const matchDate = p.date === selectedDate;
      const matchShift = selectedShift === 'ALL' || p.shift.includes(selectedShift);
      const matchMat = selectedMaterial === 'ALL' || p.materialId === selectedMaterial || p.materialName.includes(selectedMaterial);
      return matchDate && matchShift && matchMat;
    });
  }, [productionIssues, selectedDate, selectedShift, selectedMaterial]);

  // Production orders active/completed for day
  const dayProductionOrders = useMemo(() => {
    return productionOrders.filter((po) => {
      const matchDate = po.date === selectedDate;
      const matchShift = selectedShift === 'ALL' || po.shift.includes(selectedShift);
      const matchMat = selectedMaterial === 'ALL' || po.requiredMaterialId === selectedMaterial || po.requiredMaterialName?.includes(selectedMaterial);
      return matchDate && matchShift && matchMat;
    });
  }, [productionOrders, selectedDate, selectedShift, selectedMaterial]);

  // Print report
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:m-0" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                <Activity className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {isRTL ? 'حركة العمليات اليومية الثلاث' : 'Three Daily Operations Tracker'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isRTL
                    ? 'الحصيلة التشغيلية الفعلية اليومية: الثرم • الإنتاج • المخزن (كم أنجزنا اليوم؟)'
                    : 'Actual daily operational yield: Therm • Production • Storage (How much did we do today?)'}
                </p>
              </div>
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                title={isRTL ? 'تحديد تاريخ العمليات' : 'Select Operations Date'}
              />
            </div>

            {/* Material Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500">{isRTL ? 'المادة:' : 'Mat:'}</span>
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                title={isRTL ? 'تصفية حسب المادة' : 'Filter by material'}
              >
                <option value="ALL">{isRTL ? 'جميع المواد' : 'All Materials'}</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
              {[
                { id: 'ALL', labelAr: 'كافة الأقسام', labelEn: 'All' },
                { id: 'THERM', labelAr: 'الثرم', labelEn: 'Therm' },
                { id: 'PRODUCTION', labelAr: 'الإنتاج', labelEn: 'Prod' },
                { id: 'STORAGE', labelAr: 'المخزن', labelEn: 'Store' },
              ].map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSection(sec.id as any)}
                  className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedSection === sec.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {isRTL ? sec.labelAr : sec.labelEn}
                </button>
              ))}
            </div>

            {/* Shift Filter */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
              {[
                { id: 'ALL', labelAr: 'كامل اليوم', labelEn: 'All Day' },
                { id: 'صباحي', labelAr: 'الصباحية', labelEn: 'Morning' },
                { id: 'مسائي', labelAr: 'المسائية', labelEn: 'Evening' },
                { id: 'ليلي', labelAr: 'الليلية', labelEn: 'Night' },
              ].map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedShift(shift.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    selectedShift === shift.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {isRTL ? shift.labelAr : shift.labelEn}
                </button>
              ))}
            </div>

            {/* Voice Dictation Button */}
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-sm transition-all cursor-pointer hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] print:hidden"
              title={isRTL ? 'إملاء صوتي سريع للملاحظات وحركات المخزن وتسليم الوردية' : 'Voice dictation for warehouse notes & handovers'}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isRTL ? 'إملاء صوتي سريع' : 'Voice Dictate'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 print:hidden"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isRTL ? 'طباعة التقرير اليومي' : 'Print Daily Report'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CORE 3-SECTIONS GRID (Section 13) */}
      <div className={`grid grid-cols-1 ${selectedSection === 'ALL' ? 'lg:grid-cols-3' : 'lg:grid-cols-1 max-w-3xl mx-auto'} gap-5`}>
        {/* ========================================================= */}
        {/* 1. SECTION: THERM (الثرم) */}
        {/* ========================================================= */}
        {(selectedSection === 'ALL' || selectedSection === 'THERM') && (
        <div className="bg-white rounded-xl border-2 border-amber-200/80 shadow-xs flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500 text-white rounded-lg shadow-xs">
                  <Flame className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    {isRTL ? 'القسم الأول' : 'Section 1'}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {isRTL ? 'قسم الثرم (Therm)' : 'Therm / Shredding'}
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-amber-100/80 text-amber-900 rounded-md">
                {summary.therm.operationsCount} {isRTL ? 'عمليات اليوم' : 'Jobs today'}
              </span>
            </div>
            <p className="text-xs text-amber-900/80 mt-2 font-medium">
              {isRTL
                ? 'تدوير وسحق السكراب والمواد الخام لتجهيز حبيبات الثرم'
                : 'Crushing and recycling scrap & raw materials into therm flakes'}
            </p>
          </div>

          {/* 4 Crucial Metric Cards */}
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-2.5">
              {/* TODAY IN */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isRTL ? 'مدخلات اليوم (IN)' : 'Today In'}</span>
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {summary.therm.todayInKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">كغم</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {summary.therm.bulkBagsIn} {isRTL ? 'شليف مدخل' : 'Bulk bags in'}
                </div>
              </div>

              {/* TODAY OUT */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isRTL ? 'مخرجات اليوم (OUT)' : 'Today Out'}</span>
                </div>
                <div className="text-lg font-extrabold text-emerald-700">
                  {summary.therm.todayOutKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">كغم</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {summary.therm.bulkBagsOut} {isRTL ? 'شليف مفروم جاهز' : 'Bulk bags ready'}
                </div>
              </div>

              {/* TODAY RESULT */}
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                <div className="text-xs font-semibold text-amber-800 mb-1">
                  {isRTL ? 'الحصيلة المنجزة (RESULT)' : 'Today Result'}
                </div>
                <div className="text-lg font-extrabold text-amber-900">
                  {summary.therm.todayResultKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-amber-700">كغم</span>
                </div>
                <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                  {summary.therm.todayInKG > 0
                    ? `${((summary.therm.todayOutKG / summary.therm.todayInKG) * 100).toFixed(1)}% كفاءة الثرم`
                    : 'لا توجد مدخلات اليوم'}
                </div>
              </div>

              {/* CURRENT REMAINING */}
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg">
                <div className="text-xs font-semibold text-rose-800 mb-1">
                  {isRTL ? 'المتبقي الحالي (REMAINING)' : 'Current Remaining'}
                </div>
                <div className="text-lg font-extrabold text-rose-900">
                  {summary.therm.currentRemainingKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-rose-700">كغم</span>
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-0.5">
                  {isRTL ? 'قيد الثرم والتجهيز' : 'In queue / processing'}
                </div>
              </div>
            </div>

            {/* Quick Action */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage('shredding')}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-amber-900 bg-amber-100/70 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <span>{isRTL ? 'عرض وتوثيق عمليات الثرم' : 'Manage Therm Operations'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* ========================================================= */}
        {/* 2. SECTION: PRODUCTION (الإنتاج) */}
        {/* ========================================================= */}
        {(selectedSection === 'ALL' || selectedSection === 'PRODUCTION') && (
        <div className="bg-white rounded-xl border-2 border-blue-200/80 shadow-xs flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-600 text-white rounded-lg shadow-xs">
                  <Factory className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                    {isRTL ? 'القسم الثاني' : 'Section 2'}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {isRTL ? 'قسم الإنتاج (Production)' : 'Production Lines'}
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-blue-100/80 text-blue-900 rounded-md">
                {summary.production.operationsCount} {isRTL ? 'عمليات اليوم' : 'Jobs today'}
              </span>
            </div>
            <p className="text-xs text-blue-900/80 mt-2 font-medium">
              {isRTL
                ? 'صرف خامات مستند 167 وتشغيل خطوط بثق الألواح وتشكيل الأكواب'
                : 'Raw material issues via Doc 167 & sheet extrusion/thermoforming lines'}
            </p>
          </div>

          {/* 4 Crucial Metric Cards */}
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-2.5">
              {/* TODAY IN */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isRTL ? 'مدخلات اليوم (IN)' : 'Today In'}</span>
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {summary.production.todayInKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">كغم</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {summary.production.bulkBagsIn} {isRTL ? 'شليف منصرف' : 'Bags issued'}
                </div>
              </div>

              {/* TODAY OUT */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isRTL ? 'إنتاج تام (OUT)' : 'Today Out'}</span>
                </div>
                <div className="text-lg font-extrabold text-emerald-700">
                  {summary.production.todayOutKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">كغم</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {summary.production.bulkBagsOut} {isRTL ? 'شليف/طبلية تامة' : 'Pallets finished'}
                </div>
              </div>

              {/* TODAY RESULT */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg">
                <div className="text-xs font-semibold text-indigo-800 mb-1">
                  {isRTL ? 'الحصيلة الفعلية (RESULT)' : 'Today Result'}
                </div>
                <div className="text-lg font-extrabold text-indigo-950">
                  {summary.production.todayResultKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-indigo-700">كغم</span>
                </div>
                <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  {summary.production.todayInKG > 0
                    ? `${((summary.production.todayOutKG / summary.production.todayInKG) * 100).toFixed(1)}% نسبة الاستخلاص`
                    : 'لا توجد مدخلات اليوم'}
                </div>
              </div>

              {/* CURRENT REMAINING */}
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg">
                <div className="text-xs font-semibold text-rose-800 mb-1">
                  {isRTL ? 'المتبقي / هوالك (REMAINING)' : 'Remaining / Damage'}
                </div>
                <div className="text-lg font-extrabold text-rose-900">
                  {summary.production.currentRemainingKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-rose-700">كغم</span>
                </div>
                <div className="text-[11px] text-rose-700 font-medium mt-0.5">
                  {isRTL ? 'تحت التشغيل أو تالف' : 'Work-in-progress / scrap'}
                </div>
              </div>
            </div>

            {/* Quick Action */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage('production')}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-blue-900 bg-blue-100/70 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <span>{isRTL ? 'فتح إدارة خطوط وأوامر الإنتاج' : 'Manage Production Orders'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* ========================================================= */}
        {/* 3. SECTION: STORAGE (المخزن) */}
        {/* ========================================================= */}
        {(selectedSection === 'ALL' || selectedSection === 'STORAGE') && (
        <div className="bg-white rounded-xl border-2 border-emerald-200/80 shadow-xs flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-600 text-white rounded-lg shadow-xs">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {isRTL ? 'القسم الثالث' : 'Section 3'}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                    {isRTL ? 'قسم المخزن (Storage)' : 'Storage & Warehouses'}
                  </h2>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-emerald-100/80 text-emerald-900 rounded-md">
                {summary.storage.operationsCount} {isRTL ? 'حركات اليوم' : 'Movements today'}
              </span>
            </div>
            <p className="text-xs text-emerald-900/80 mt-2 font-medium">
              {isRTL
                ? 'استلامات الموردين، مرتجعات الثرم، وأرصدة المستودعات الحية'
                : 'Supplier receipts, therm returns, and live warehouse balances'}
            </p>
          </div>

          {/* 4 Crucial Metric Cards */}
          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-2.5">
              {/* TODAY IN */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isRTL ? 'وارد المخزن (IN)' : 'Storage In'}</span>
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {summary.storage.todayInKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">كغم</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {summary.storage.bulkBagsIn} {isRTL ? 'شليف وارد' : 'Bulk bags received'}
                </div>
              </div>

              {/* TODAY OUT */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                  <span>{isRTL ? 'منصرف المخزن (OUT)' : 'Storage Out'}</span>
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {summary.storage.todayOutKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">كغم</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {summary.storage.bulkBagsOut} {isRTL ? 'شليف منصرف' : 'Bulk bags issued'}
                </div>
              </div>

              {/* TODAY RESULT */}
              <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg">
                <div className="text-xs font-semibold text-teal-800 mb-1">
                  {isRTL ? 'صافي الحركة (RESULT)' : 'Net Change'}
                </div>
                <div className="text-lg font-extrabold text-teal-950">
                  {summary.storage.todayResultKG > 0 ? '+' : ''}
                  {summary.storage.todayResultKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-teal-700">كغم</span>
                </div>
                <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                  {summary.storage.todayResultKG >= 0
                    ? isRTL ? 'زيادة في المخزون' : 'Stock increased'
                    : isRTL ? 'انخفاض في المخزون' : 'Stock decreased'}
                </div>
              </div>

              {/* CURRENT REMAINING */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                <div className="text-xs font-semibold text-emerald-800 mb-1">
                  {isRTL ? 'الرصيد الكلي الحي (BALANCE)' : 'Total Remaining'}
                </div>
                <div className="text-lg font-extrabold text-emerald-900">
                  {summary.storage.currentRemainingKG.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-emerald-700">كغم</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  {inventoryBalances.reduce((sum, b) => sum + (b.bulkBagsCount || 0), 0)} {isRTL ? 'شليف في المستودعات' : 'Bags in storage'}
                </div>
              </div>
            </div>

            {/* Quick Action */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage('storage')}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-emerald-900 bg-emerald-100/70 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <span>{isRTL ? 'عرض مستودعات وأرصدة المخزن' : 'View Storage & Locations'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* VOICE-TO-TEXT DICTATION & SHIFT HANDOVER OPERATIONS PANEL */}
      <DailyVoiceOperationsNotesPanel
        key={`voice-notes-${selectedDate}-${selectedShift}-${voiceRefreshKey}`}
        selectedDate={selectedDate}
        selectedShift={selectedShift}
      />

      {/* DETAILED DAILY LOGS TABS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {isRTL
                ? `السجل التفصيلي لعمليات تاريخ: ${selectedDate}`
                : `Detailed Operational Logs for Date: ${selectedDate}`}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {dayShreddings.length + dayProductionIssues.length} {isRTL ? 'سجل تشغيلي مسجل' : 'Operational entries'}
          </span>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Day Shredding Transactions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  <span>{isRTL ? 'عمليات الثرم المنفذة اليوم' : 'Today Therm Jobs'}</span>
                </h4>
                <span className="text-[11px] font-semibold text-slate-500">
                  {dayShreddings.length} {isRTL ? 'عملية' : 'jobs'}
                </span>
              </div>
              {dayShreddings.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                  {isRTL ? 'لا توجد عمليات ثرم مسجلة لهذا التاريخ' : 'No shredding jobs recorded for this date'}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dayShreddings.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{s.shreddingNumber}</span>
                        <div className="text-[11px] text-slate-600 mt-0.5">{s.materialName}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-amber-900">
                          {s.outputKG.toLocaleString()} كغم
                        </span>
                        <div className="text-[10px] text-slate-500">
                          من أصل {(s.inputKG || (s as any).inputWeightKG || 0).toLocaleString()} كغم
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Day Production Issues */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Factory className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isRTL ? 'صرف الخامات للإنتاج (مستند 167)' : 'Production Issues (Doc 167)'}</span>
                </h4>
                <span className="text-[11px] font-semibold text-slate-500">
                  {dayProductionIssues.length} {isRTL ? 'صرف' : 'issues'}
                </span>
              </div>
              {dayProductionIssues.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                  {isRTL ? 'لا توجد حركات صرف خامات مسجلة لهذا التاريخ' : 'No production issues recorded for this date'}
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {dayProductionIssues.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{p.legacyDocumentNumber || p.issueNumber}</span>
                        <div className="text-[11px] text-slate-600 mt-0.5">{p.materialName}</div>
                        <div className="text-[10px] text-slate-400">{p.machineLine}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-blue-900">
                          {p.quantityKG.toLocaleString()} كغم
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {p.bulkBagsCount} شليف ({p.shift})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Voice Operations Dictation Modal */}
      <VoiceOperationsDictationModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onNoteCreated={() => setVoiceRefreshKey((k) => k + 1)}
        defaultDate={selectedDate}
        defaultShift={selectedShift === 'ALL' ? 'Morning Shift' : selectedShift}
      />
    </div>
  );
};
