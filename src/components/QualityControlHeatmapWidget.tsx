import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Plus,
  Sliders,
  Calendar,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Eye,
  Flame,
  Info,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  QualitySample,
  QualityHeatmapCell,
  QualityDefectCategory,
} from '../types';
import {
  getStoredQualitySamples,
  generateTimeSlotHeatmapMatrix,
  generateDefectTypeHeatmapMatrix,
  computeFactoryQualityKPIs,
  DEFECT_CATEGORIES_META,
  TIME_SLOTS_DEF,
  FACTORY_QC_LINES,
} from '../services/qualityControlService';
import { QualityControlInputModal } from './QualityControlInputModal';

interface QualityControlHeatmapWidgetProps {
  onOpenFullMonitor?: () => void;
  compact?: boolean;
}

export const QualityControlHeatmapWidget: React.FC<QualityControlHeatmapWidgetProps> = ({
  onOpenFullMonitor,
  compact = false,
}) => {
  const { isRTL } = useLanguage();
  const { setCurrentPage } = useFactory();

  const [samples, setSamples] = useState<QualitySample[]>([]);
  const [heatmapMode, setHeatmapMode] = useState<'TIME_SLOTS' | 'DEFECT_TYPES'>('TIME_SLOTS');
  const [selectedCell, setSelectedCell] = useState<QualityHeatmapCell | null>(null);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [preselectedMachine, setPreselectedMachine] = useState<string>('EXT-01');
  const [preselectedTimeSlot, setPreselectedTimeSlot] = useState<string>(TIME_SLOTS_DEF[1].key);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('');

  const reloadSamples = () => {
    const loaded = getStoredQualitySamples();
    setSamples(loaded);
    setLastRefreshedTime(new Date().toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  };

  useEffect(() => {
    reloadSamples();

    // Listen to real-time custom event across tabs or components
    const handleUpdate = () => {
      reloadSamples();
    };

    window.addEventListener('al_karwan_qc_updated', handleUpdate);
    return () => {
      window.removeEventListener('al_karwan_qc_updated', handleUpdate);
    };
  }, []);

  const timeMatrix = generateTimeSlotHeatmapMatrix(samples);
  const defectMatrix = generateDefectTypeHeatmapMatrix(samples);
  const kpis = computeFactoryQualityKPIs(samples);

  const handleOpenInputForCell = (machineCode: string, columnKey?: string) => {
    setPreselectedMachine(machineCode);
    if (columnKey && heatmapMode === 'TIME_SLOTS') {
      setPreselectedTimeSlot(columnKey);
    }
    setIsInputModalOpen(true);
  };

  // Helper for cell background style
  const getCellClasses = (cell: QualityHeatmapCell | undefined) => {
    if (!cell || cell.status === 'NO_DATA') {
      return 'bg-slate-900/30 border-white/5 text-slate-600 hover:bg-slate-800/40 hover:border-white/20';
    }
    switch (cell.status) {
      case 'OPTIMAL':
        return 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-900/80 shadow-[0_0_8px_rgba(16,185,129,0.1)]';
      case 'ACCEPTABLE':
        return 'bg-cyan-950/70 border-cyan-500/30 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/80 shadow-[0_0_8px_rgba(6,182,212,0.1)]';
      case 'WARNING':
        return 'bg-amber-950/80 border-amber-500/40 text-amber-200 hover:border-amber-400 hover:bg-amber-900/90 shadow-[0_0_10px_rgba(245,158,11,0.15)]';
      case 'CRITICAL':
        return 'bg-rose-950/90 border-rose-500/70 text-rose-200 hover:border-rose-400 hover:bg-rose-900 shadow-[0_0_14px_rgba(244,63,94,0.3)] animate-pulse';
    }
  };

  return (
    <div
      id="qc-heatmap-widget"
      className="bg-gradient-to-br from-[#12141a] via-[#161822] to-[#0e1015] border border-cyan-500/30 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 end-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10 relative z-10">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                <span>
                  {isRTL
                    ? 'الخريطة الحرارية لمراقبة الجودة ونسب العيوب اللحظية'
                    : 'Real-Time Quality & Defect Rate Heatmap'}
                </span>
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'مراقبة فورية لعينات البثق والتشكيل والثرم لاكتشاف انحرافات السماكة والشوائب وتفادي الهدر'
                : 'Live machine defect telemetry across extrusion lines, granulator & thermoforming to eliminate scrap'}
            </p>
          </div>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Toggle */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setHeatmapMode('TIME_SLOTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                heatmapMode === 'TIME_SLOTS'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'الجدول الزمني والورديات' : 'Timeline Slots'}
            </button>
            <button
              onClick={() => setHeatmapMode('DEFECT_TYPES')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                heatmapMode === 'DEFECT_TYPES'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'أصناف العيوب (8 أنواع)' : 'Defect Categories'}
            </button>
          </div>

          {/* Quick Input Button */}
          <button
            onClick={() => {
              setPreselectedMachine('EXT-01');
              setIsInputModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل عينة فحص' : 'Input QC Sample'}</span>
          </button>

          {/* Open Full Quality Monitor Page */}
          <button
            onClick={() => {
              if (onOpenFullMonitor) {
                onOpenFullMonitor();
              } else {
                setCurrentPage('quality_control');
              }
            }}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title={isRTL ? 'فتح وحدة مراقبة الجودة الموسعة' : 'Open Full Quality Monitor Module'}
          >
            <span>{isRTL ? 'الشاشة الكاملة' : 'Full Monitor'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top 5 KPI Mini-Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 my-5">
        {/* Metric 1: First Pass Yield */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {isRTL ? 'معدل جودة النخب الأول (FPY)' : 'First-Pass Yield (FPY)'}
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-black font-mono ${
                kpis.firstPassYield >= 96 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {kpis.firstPassYield}%
            </span>
            <span className="text-[11px] text-slate-400">
              {isRTL ? 'هدف >95%' : 'Target >95%'}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>{isRTL ? '+0.8% مقارنة بالأمس' : '+0.8% vs Yesterday'}</span>
          </div>
        </div>

        {/* Metric 2: Average Defect Rate */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {isRTL ? 'متوسط نسبة العيوب الكلية' : 'Average Defect Rate'}
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              className={`text-2xl font-black font-mono ${
                kpis.averageDefectRate < 2.0
                  ? 'text-cyan-300'
                  : kpis.averageDefectRate < 3.5
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {kpis.averageDefectRate}%
            </span>
            <span className="text-[11px] text-slate-400">
              ({kpis.totalDefectsCount} {isRTL ? 'معيب' : 'defects'})
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isRTL
              ? `من إجمالي ${kpis.totalUnitsInspected} عينة`
              : `From ${kpis.totalUnitsInspected} inspected`}
          </div>
        </div>

        {/* Metric 3: Lots Tested Today */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {isRTL ? 'التشغيلات المفحوصة اليوم' : 'Lots Tested Today'}
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white font-mono">
              {kpis.totalSamples}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold">
              {kpis.approvedCount} {isRTL ? 'مقبول A+' : 'Approved'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-amber-400 font-semibold">
              {kpis.marginalCount} {isRTL ? 'مشروط' : 'Marginal'}
            </span>
            <span>•</span>
            <span className="text-rose-400 font-semibold">
              {kpis.rejectedCount} {isRTL ? 'مرفوض' : 'Rejected'}
            </span>
          </div>
        </div>

        {/* Metric 4: Scrap Diverted to Shredder */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            {isRTL ? 'سكراب محول للثرم 360' : 'Scrap to Shredder'}
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {kpis.totalRegrindShredderKG}
            </span>
            <span className="text-xs text-amber-300 font-bold">{isRTL ? 'كغم' : 'KG'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {isRTL ? 'إعادة تدوير فوري بالمفرمة' : 'Re-channeled to SHR-360'}
          </div>
        </div>

        {/* Metric 5: Highest Defect Alert */}
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            {isRTL ? 'أعلى خط تسجيلاً للعيوب' : 'Highest Defect Line'}
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-black text-rose-400 font-mono">
              {kpis.worstMachine.code}
            </span>
            <span className="text-xs text-rose-300 font-mono font-bold">
              ({kpis.worstMachine.ratePct}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            {kpis.topDefectCategory.meta
              ? isRTL
                ? kpis.topDefectCategory.meta.labelAr
                : kpis.topDefectCategory.meta.labelEn
              : isRTL
              ? 'تفاوت السمك'
              : 'Gauge Variation'}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* THE HEATMAP GRID */}
      {/* ============================================================ */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0d0f14]/80 p-2 sm:p-4">
        <table className="w-full border-collapse text-start">
          {/* Columns Header */}
          <thead>
            <tr>
              <th className="p-2 sm:p-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 text-start min-w-[150px] sm:min-w-[190px]">
                {isRTL ? 'الماكينة / الخط' : 'Machine / Line'}
              </th>
              {heatmapMode === 'TIME_SLOTS'
                ? timeMatrix.timeSlots.map((slot) => (
                    <th
                      key={slot.key}
                      className="p-2 text-center text-[10px] font-bold uppercase text-slate-400 min-w-[90px] sm:min-w-[110px]"
                    >
                      <div className="font-mono">{slot.key.split(' ')[0]}</div>
                      <div className="text-[9px] text-slate-500 font-normal">
                        {isRTL
                          ? slot.labelAr.split('(')[1]?.replace(')', '')
                          : slot.labelEn.split('(')[1]?.replace(')', '')}
                      </div>
                    </th>
                  ))
                : defectMatrix.categories.map((cat) => (
                    <th
                      key={cat.id}
                      className="p-2 text-center text-[10px] font-bold text-slate-400 min-w-[100px] sm:min-w-[125px]"
                    >
                      <div className="truncate">
                        {isRTL ? cat.labelAr : cat.labelEn}
                      </div>
                    </th>
                  ))}
            </tr>
          </thead>

          {/* Matrix Rows */}
          <tbody className="divide-y divide-white/5">
            {FACTORY_QC_LINES.map((line) => {
              return (
                <tr key={line.code} className="hover:bg-white/[0.01] transition-colors">
                  {/* Line Title & Meta */}
                  <td className="p-2 sm:p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-white">
                            {line.code}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-slate-400 font-mono">
                            {line.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px]">
                          {isRTL ? line.nameAr : line.nameEn}
                        </div>
                      </div>

                      {/* Quick Add Button per row */}
                      <button
                        onClick={() => handleOpenInputForCell(line.code)}
                        title={isRTL ? `إضافة عينة لخط ${line.code}` : `Add sample for ${line.code}`}
                        className="p-1 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all opacity-40 hover:opacity-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Heatmap Cells */}
                  {heatmapMode === 'TIME_SLOTS'
                    ? timeMatrix.timeSlots.map((slot) => {
                        const cell = timeMatrix.matrix[line.code]?.[slot.key];
                        const cellClass = getCellClasses(cell);
                        const isSelected =
                          selectedCell?.machineCode === line.code &&
                          selectedCell?.columnKey === slot.key;

                        return (
                          <td key={slot.key} className="p-1 text-center">
                            <button
                              onClick={() => setSelectedCell(cell)}
                              className={`w-full py-3 px-1 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center ${cellClass} ${
                                isSelected ? 'ring-2 ring-cyan-400 scale-105 z-10' : ''
                              }`}
                            >
                              {cell && cell.status !== 'NO_DATA' ? (
                                <>
                                  <span className="font-mono text-xs sm:text-sm font-black tracking-tight">
                                    {cell.defectRatePct}%
                                  </span>
                                  <span className="text-[9px] opacity-75 font-mono">
                                    {cell.totalDefects}/{cell.totalInspected}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-slate-600 font-mono">-</span>
                              )}
                            </button>
                          </td>
                        );
                      })
                    : defectMatrix.categories.map((cat) => {
                        const cell = defectMatrix.matrix[line.code]?.[cat.id];
                        const cellClass = getCellClasses(cell);
                        const isSelected =
                          selectedCell?.machineCode === line.code &&
                          selectedCell?.columnKey === cat.id;

                        return (
                          <td key={cat.id} className="p-1 text-center">
                            <button
                              onClick={() => setSelectedCell(cell)}
                              className={`w-full py-3 px-1 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center ${cellClass} ${
                                isSelected ? 'ring-2 ring-cyan-400 scale-105 z-10' : ''
                              }`}
                            >
                              {cell && cell.status !== 'NO_DATA' ? (
                                <>
                                  <span className="font-mono text-xs sm:text-sm font-black tracking-tight">
                                    {cell.defectRatePct}%
                                  </span>
                                  <span className="text-[9px] opacity-75 font-mono">
                                    {cell.totalDefects} {isRTL ? 'عيب' : 'pts'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-slate-600 font-mono">-</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Color Scale Legend & Footer */}
      <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Heat Legend */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-semibold">
            {isRTL ? 'دلالات التدرج الحراري لنسبة العيوب:' : 'Defect Heat Intensity:'}
          </span>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500/80 border border-emerald-400" />
            <span className="text-emerald-300 text-[11px] font-mono">&lt;1.5%</span>
            <span className="text-slate-400 text-[10px]">({isRTL ? 'نخب أول' : 'Optimal'})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-cyan-500/80 border border-cyan-400" />
            <span className="text-cyan-200 text-[11px] font-mono">1.5 - 3.0%</span>
            <span className="text-slate-400 text-[10px]">({isRTL ? 'مطابق' : 'Standard'})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/80 border border-amber-400" />
            <span className="text-amber-200 text-[11px] font-mono">3.0 - 5.0%</span>
            <span className="text-slate-400 text-[10px]">({isRTL ? 'تنبيه' : 'Warning'})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500/80 border border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            <span className="text-rose-200 text-[11px] font-mono">&gt;5.0%</span>
            <span className="text-slate-400 text-[10px]">({isRTL ? 'حرج' : 'Critical Spike'})</span>
          </div>
        </div>

        {/* Refresh & Last Sync Notice */}
        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <button
            onClick={reloadSamples}
            className="hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{isRTL ? 'تحديث الآن' : 'Sync'}</span>
          </button>
          {lastRefreshedTime && (
            <span>• {isRTL ? `آخر مزامنة: ${lastRefreshedTime}` : `Updated: ${lastRefreshedTime}`}</span>
          )}
        </div>
      </div>

      {/* Selected Cell Detail Drawer / Card (Displays when operator clicks any cell) */}
      {selectedCell && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900/90 border border-cyan-500/40 shadow-2xl relative animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl text-xs font-bold border ${getCellClasses(
                  selectedCell
                )}`}
              >
                <span className="text-base font-black font-mono">
                  {selectedCell.defectRatePct}%
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>
                    {selectedCell.machineNameAr} ({selectedCell.machineCode})
                  </span>
                  <span className="text-slate-400 font-normal">|</span>
                  <span className="text-cyan-300 font-mono text-xs">
                    {isRTL ? selectedCell.columnLabelAr : selectedCell.columnLabelEn}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedCell.status === 'NO_DATA'
                    ? isRTL
                      ? 'لا توجد عينات مسجلة في هذه النافذة حتى الآن'
                      : 'No quality samples logged in this window yet.'
                    : isRTL
                    ? `تم فحص ${selectedCell.totalInspected} عينة، واكتشاف ${selectedCell.totalDefects} عيوب ضمن ${selectedCell.samplesCount} فحص.`
                    : `Inspected ${selectedCell.totalInspected} units with ${selectedCell.totalDefects} defects across ${selectedCell.samplesCount} tests.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleOpenInputForCell(
                    selectedCell.machineCode,
                    selectedCell.columnKey
                  )
                }
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إدخال عينة لهذا المربع' : 'Add Test for this Cell'}</span>
              </button>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* If cell has samples, show quick sample chips */}
          {selectedCell.sampleIds && selectedCell.sampleIds.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 font-semibold">
                {isRTL ? 'التشغيلات المسجلة:' : 'Recorded Lots:'}
              </span>
              {samples
                .filter((s) => selectedCell.sampleIds.includes(s.id))
                .map((sample) => (
                  <div
                    key={sample.id}
                    className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] flex items-center gap-2"
                  >
                    <span className="font-mono font-bold text-white">
                      {sample.batchLotNumber}
                    </span>
                    <span className="text-cyan-400 font-mono">
                      {sample.defectRatePct}%
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        sample.disposition === 'APPROVED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : sample.disposition === 'MARGINAL_PASS'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : sample.disposition === 'QUARANTINED'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {sample.disposition}
                    </span>
                    <span className="text-slate-400">{sample.inspectorName}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Input Real-Time QC Modal */}
      <QualityControlInputModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onSampleSaved={(newSample) => {
          reloadSamples();
          setSelectedCell(null);
        }}
        preselectedMachineCode={preselectedMachine}
        preselectedTimeSlot={preselectedTimeSlot}
      />
    </div>
  );
};
