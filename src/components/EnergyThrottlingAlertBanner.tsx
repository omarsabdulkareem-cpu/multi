import React, { useState } from 'react';
import {
  AlertTriangle,
  Zap,
  Gauge,
  Sliders,
  CheckCircle2,
  TrendingDown,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  Sparkles,
  Info,
  Clock,
  ShieldAlert,
  Flame,
  ChevronRight,
  Activity,
  SlidersHorizontal,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  EquipmentEfficiencyAlert,
  ThrottlingProposal,
} from '../services/energyThrottlingAlertService';

export interface EnergyThrottlingAlertBannerProps {
  alerts: EquipmentEfficiencyAlert[];
  onApplyThrottling: (machineId: string, proposal: ThrottlingProposal) => void;
  onRestoreNominal: (machineId: string) => void;
  onSimulateSpike: (machineId: string) => void;
  onApplyAllThrottling: () => void;
}

export const EnergyThrottlingAlertBanner: React.FC<EnergyThrottlingAlertBannerProps> = ({
  alerts,
  onApplyThrottling,
  onRestoreNominal,
  onSimulateSpike,
  onApplyAllThrottling,
}) => {
  const { isRTL } = useLanguage();
  const [isMuted, setIsMuted] = useState(false);
  const [selectedAlertForModal, setSelectedAlertForModal] = useState<EquipmentEfficiencyAlert | null>(null);

  // Filter for active un-throttled alerts
  const activeBreaches = alerts.filter((a) => !a.isThrottled);
  const throttledCount = alerts.filter((a) => a.isThrottled).length;

  const totalExcessKW = Math.round(activeBreaches.reduce((sum, a) => sum + a.excessPowerDrawKW, 0) * 10) / 10;
  const totalHourlySavingsIQD = activeBreaches.reduce(
    (sum, a) => sum + a.throttlingProposal.estimatedHourlyCostSavingsIQD,
    0
  );
  const totalDailySavingsUSD = parseFloat(
    activeBreaches.reduce((sum, a) => sum + a.throttlingProposal.estimatedDailyCostSavingsUSD, 0).toFixed(1)
  );

  return (
    <div className="space-y-4">
      {/* Primary Alert HUD Container */}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5 transition-all duration-300 shadow-2xl ${
          activeBreaches.length > 0
            ? 'bg-gradient-to-r from-red-950 via-slate-950 to-amber-950 border-red-500/80 shadow-red-950/60'
            : throttledCount > 0
            ? 'bg-gradient-to-r from-emerald-950/80 via-slate-950 to-slate-900 border-emerald-500/70 shadow-emerald-950/40'
            : 'bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-slate-800'
        }`}
      >
        {/* Warning Accent Border Strip */}
        {activeBreaches.length > 0 && (
          <div className="absolute top-0 start-0 w-2.5 h-full bg-red-500 animate-pulse" />
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Header Narrative */}
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 border ${
                activeBreaches.length > 0
                  ? 'bg-red-500/20 text-red-400 border-red-500/60 animate-bounce'
                  : throttledCount > 0
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {activeBreaches.length > 0 ? (
                <Zap className="w-6 h-6 text-amber-400" />
              ) : throttledCount > 0 ? (
                <ShieldAlert className="w-6 h-6 text-emerald-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-slate-400" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    activeBreaches.length > 0
                      ? 'bg-red-600 text-white animate-pulse'
                      : throttledCount > 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {activeBreaches.length > 0
                    ? isRTL
                      ? 'إنذار آلي: تجاوز معايير كفاءة الطاقة'
                      : 'EFFICIENCY BENCHMARK BREACH'
                    : throttledCount > 0
                    ? isRTL
                      ? 'تم تطبيق خنق توفير الطاقة'
                      : 'THROTTLED & POWER OPTIMIZED'
                    : isRTL
                    ? 'كفاءة الطاقة الاسمية مستقرة'
                    : 'NOMINAL POWER EFFICIENCY'}
                </span>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-cyan-300 border border-cyan-500/40">
                  {isRTL ? 'نظام خنق وتوجيه الماكينات الآلي' : 'Automated Machine Throttling Sentinel'}
                </span>

                {activeBreaches.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500 text-slate-950">
                    +{totalExcessKW} kW {isRTL ? 'فائض' : 'Excess'}
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                {activeBreaches.length > 0
                  ? isRTL
                    ? `تنبيه: رصد ${activeBreaches.length} معدات تستهلك طاقة كهربائية تفوق معايير الإنتاج الفعلي (SEC)`
                    : `Alert: ${activeBreaches.length} Equipment Units Consuming Excess Power Relative to Output Benchmarks`
                  : throttledCount > 0
                  ? isRTL
                    ? `تم خنق أحمال ${throttledCount} ماكينات بنجاح وخفض استهلاك القدرة إلى معايير الطاقة المثالية`
                    : `Successfully throttled ${throttledCount} equipment units to optimal production SEC benchmarks`
                  : isRTL
                  ? 'جميع معدات المصنع تعمل ضمن معايير كفاءة استهلاك الطاقة والإنتاج الفعلي (kWh/kg)'
                  : 'All Factory Equipment Operating Within Real-time Production Output SEC Benchmarks'}
              </h3>

              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                {isRTL
                  ? 'يقوم النظام بمقارنة استهلاك القدرة الكهربائية اللحظي (kW) مع مخرجات الإنتاج الفعلية (كغم/ساعة)، ويقترح إجراء خنق ديناميكي فوري لتردد مغيرات السرعة (VFD) أو جدولة التلقيم لخفض تكلفة فاتورة الكهرباء.'
                  : 'Automated telemetry benchmarks real-time kW draw against production throughput (kg/h), suggesting specific machine throttling actions (VFD frequency reduction, infeed pacing) to avert power surcharges.'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
            {/* Audio Mute */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title={isMuted ? 'Unmute chime' : 'Mute chime'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Apply All Throttling Button */}
            {activeBreaches.length > 0 && (
              <button
                type="button"
                onClick={onApplyAllThrottling}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 hover:from-amber-400 hover:to-red-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/60 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-950" />
                <span>{isRTL ? 'تنفيذ خنق كافة الماكينات المخالفة' : 'Apply All Machine Throttling'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px] font-mono font-bold">
                  -{totalExcessKW} kW
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Simulation Sandbox Toolbar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold">{isRTL ? 'محاكاة اختبار التجاوز والخنق:' : 'Test & Simulation Sandbox:'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSimulateSpike('THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-mono cursor-pointer transition"
            >
              ⚡ {isRTL ? 'محاكاة طفرة SHR-01 (75kW)' : 'Spike SHR-01 (75kW)'}
            </button>
            <button
              type="button"
              onClick={() => onSimulateSpike('THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)')}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-mono cursor-pointer transition"
            >
              ⚡ {isRTL ? 'محاكاة طفرة SHR-02 (55kW)' : 'Spike SHR-02 (55kW)'}
            </button>
            {throttledCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  alerts.forEach((a) => onRestoreNominal(a.machineId));
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono cursor-pointer transition"
              >
                <RotateCcw className="w-3 h-3 inline me-1" />
                {isRTL ? 'استعادة القدرة لكافة الماكينات' : 'Reset All Nominal'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Machine Throttling Cards Grid */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in duration-300">
          {alerts.map((alert) => {
            const isThrottled = alert.isThrottled;
            const p = alert.throttlingProposal;

            return (
              <div
                key={alert.id}
                className={`rounded-2xl border p-4 transition-all duration-300 shadow-xl relative overflow-hidden flex flex-col justify-between ${
                  isThrottled
                    ? 'bg-gradient-to-b from-emerald-950/40 via-slate-950 to-slate-900 border-emerald-500/50 shadow-emerald-950/20'
                    : alert.severity === 'CRITICAL'
                    ? 'bg-gradient-to-b from-red-950/70 via-slate-950 to-slate-900 border-red-500/70 shadow-red-950/40'
                    : 'bg-gradient-to-b from-amber-950/50 via-slate-950 to-slate-900 border-amber-500/60 shadow-amber-950/30'
                }`}
              >
                {/* Top Status */}
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-slate-900 text-cyan-300 border border-cyan-500/40">
                        {alert.machineCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isThrottled
                            ? 'bg-emerald-600 text-white'
                            : alert.severity === 'CRITICAL'
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-amber-500 text-slate-950 font-bold'
                        }`}
                      >
                        {isThrottled
                          ? isRTL
                            ? 'مخنوق وموفر للطاقة'
                            : 'THROTTLED'
                          : alert.severity === 'CRITICAL'
                          ? isRTL
                            ? 'هدر طاقة حرج'
                            : 'CRITICAL LOSS'
                          : isRTL
                          ? 'تجاوز معيار الطاقة'
                          : 'SEC EXCEEDED'}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm mt-1.5 leading-snug">
                      {isRTL ? alert.machineNameAr : alert.machineNameEn}
                    </h4>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'القدرة اللحظية' : 'Active Power'}</span>
                    <span
                      className={`text-lg font-black font-mono ${
                        isThrottled
                          ? 'text-emerald-400'
                          : alert.severity === 'CRITICAL'
                          ? 'text-red-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {alert.currentPowerKW} <span className="text-xs font-normal text-slate-400">kW</span>
                    </span>
                  </div>
                </div>

                {/* Energy Benchmark Metrics Strip */}
                <div className="py-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{isRTL ? 'الإنتاجية اللحظية' : 'Throughput Rate'}</span>
                      <span className="text-sm font-black text-white">
                        {alert.currentThroughputKGHour} <span className="text-[10px] text-slate-400 font-normal">kg/h</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{isRTL ? 'معدل SEC الفعلي' : 'Current SEC'}</span>
                      <span
                        className={`text-sm font-black ${
                          isThrottled ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {alert.currentSECKWhKG} <span className="text-[10px] text-slate-400 font-normal">kWh/kg</span>
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        Base: {alert.targetSECKWhKG}
                      </span>
                    </div>
                  </div>

                  {/* Excess Waste Indicator */}
                  {!isThrottled ? (
                    <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-between text-xs font-mono">
                      <span className="text-red-300 text-[11px]">{isRTL ? 'فائض القدرة المهدورة:' : 'Excess Waste:'}</span>
                      <span className="font-black text-red-400">
                        +{alert.excessPowerDrawKW} kW ({alert.hourlyCostPenaltyIQD.toLocaleString()} IQD/h)
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-300 text-[11px]">{isRTL ? 'وفر القدرة المحقق:' : 'Saved Draw:'}</span>
                      <span className="font-black text-emerald-400">
                        -{p.powerReductionKW} kW (~{p.estimatedHourlyCostSavingsIQD.toLocaleString()} IQD/h)
                      </span>
                    </div>
                  )}

                  {/* Specific Throttling Suggestion Box */}
                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isRTL ? p.titleAr : p.titleEn}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {isRTL ? p.actionDirectiveAr : p.actionDirectiveEn}
                    </p>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedAlertForModal(alert)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'التفاصيل' : 'Details'}</span>
                  </button>

                  {!isThrottled ? (
                    <button
                      type="button"
                      onClick={() => onApplyThrottling(alert.machineId, p)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-950 cursor-pointer transition-all active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isRTL ? 'تنفيذ الخنق الآن' : 'Apply Throttling'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRestoreNominal(alert.machineId)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isRTL ? 'استعادة القدرة' : 'Restore'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diagnostics & Technical Throttling Steps Modal */}
      {selectedAlertForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-slate-900 border border-cyan-500/50 shadow-2xl shadow-cyan-950/80 space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {isRTL ? 'إجراءات خنق القدرة ومعايير كفاءة الطاقة' : 'Machine Power Throttling & SEC Diagnostics'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedAlertForModal.machineCode} •{' '}
                    {isRTL ? selectedAlertForModal.machineNameAr : selectedAlertForModal.machineNameEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAlertForModal(null)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanation & SEC Benchmark Analysis */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-amber-300 block">
                {isRTL ? 'تحليل سبب تجاوز المعيار اللحظي:' : 'Root Cause of Efficiency Benchmark Breach:'}
              </span>
              <p className="text-slate-300 leading-relaxed">
                {isRTL ? selectedAlertForModal.reasonAr : selectedAlertForModal.reasonEn}
              </p>
            </div>

            {/* Technical Execution Directives */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5 text-xs">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-400" />
                {isRTL ? 'الخطوات الفنية الموصى بها لخنق الحمل:' : 'Technical Inverter & Machine Throttling Steps:'}
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-slate-300 leading-relaxed ps-1">
                {(isRTL
                  ? selectedAlertForModal.throttlingProposal.technicalStepsAr
                  : selectedAlertForModal.throttlingProposal.technicalStepsEn
                ).map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>

            {/* Projected Financial & Energy Savings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-center">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'خفض القدرة' : 'Power Cut'}</span>
                <span className="font-bold text-amber-400">
                  -{selectedAlertForModal.throttlingProposal.powerReductionKW} kW
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'التردد الموصى به' : 'Target VFD'}</span>
                <span className="font-bold text-cyan-300">
                  {selectedAlertForModal.throttlingProposal.recommendedFrequencyHz} Hz
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'الوفر في الساعة' : 'Hourly Savings'}</span>
                <span className="font-bold text-emerald-400">
                  {selectedAlertForModal.throttlingProposal.estimatedHourlyCostSavingsIQD.toLocaleString()} د.ع
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">{isRTL ? 'الوفر اليومي' : 'Daily Savings'}</span>
                <span className="font-bold text-emerald-300">
                  ${selectedAlertForModal.throttlingProposal.estimatedDailyCostSavingsUSD}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedAlertForModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>

              {!selectedAlertForModal.isThrottled ? (
                <button
                  type="button"
                  onClick={() => {
                    onApplyThrottling(
                      selectedAlertForModal.machineId,
                      selectedAlertForModal.throttlingProposal
                    );
                    setSelectedAlertForModal(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-950 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isRTL ? 'اعتماد وتنفيذ الخنق' : 'Authorize & Execute Throttling'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onRestoreNominal(selectedAlertForModal.machineId);
                    setSelectedAlertForModal(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  {isRTL ? 'استعادة التشغيل الاسمي' : 'Restore Nominal Operation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
