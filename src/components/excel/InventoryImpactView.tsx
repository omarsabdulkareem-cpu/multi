import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Package,
  Boxes,
  Building2,
  Search,
  Check,
  FileCheck,
} from 'lucide-react';
import { InventoryImpactItem, SheetAnalysis } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';

interface InventoryImpactViewProps {
  currentSheet: SheetAnalysis;
  inventoryImpact: InventoryImpactItem[];
  onNavigate: (step: ImportWorkflowStep) => void;
  isRTL: boolean;
}

export const InventoryImpactView: React.FC<InventoryImpactViewProps> = ({
  currentSheet,
  inventoryImpact,
  onNavigate,
  isRTL,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'INFLOW' | 'OUTFLOW' | 'WARNING'>('ALL');

  // Compute aggregate metrics
  const totalDeltaKG = inventoryImpact.reduce((acc, item) => acc + item.deltaKG, 0);
  const totalDeltaBags = inventoryImpact.reduce((acc, item) => acc + item.deltaBags, 0);
  const totalCurrentKG = inventoryImpact.reduce((acc, item) => acc + item.currentKG, 0);
  const totalProjectedKG = inventoryImpact.reduce((acc, item) => acc + item.projectedKG, 0);
  const negativeStockCount = inventoryImpact.filter((item) => item.projectedKG < 0).length;

  const filteredImpact = inventoryImpact.filter((item) => {
    if (filterType === 'INFLOW' && item.deltaKG <= 0) return false;
    if (filterType === 'OUTFLOW' && item.deltaKG >= 0) return false;
    if (filterType === 'WARNING' && item.projectedKG >= 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.materialNameAr.toLowerCase().includes(q) ||
        item.materialNameEn.toLowerCase().includes(q) ||
        item.materialCode.toLowerCase().includes(q) ||
        item.warehouseNameAr.toLowerCase().includes(q) ||
        item.locationCode.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              STEP 8: INVENTORY IMPACT
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {isRTL ? currentSheet.typeTitleAr : currentSheet.typeTitleEn}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'محاكاة الأثر المخزني والتنبؤ بالأرصدة (Stock Simulation)' : 'Pre-Commit Inventory Impact Simulation'}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            {isRTL
              ? 'حساب التغير المتوقع في أرصدة المواد (الوزن كغم والشلايف) بالمستودعات قبل تثبيت الترحيل لضمان دقة الأرصدة ومنع العجز.'
              : 'Simulates projected material balances (KG and bulk bags) per warehouse prior to committing migration.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('COMMIT_MIGRATION')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition-all cursor-pointer shrink-0"
        >
          <FileCheck className="w-4 h-4" />
          <span>{isRTL ? 'المتابعة لاعتماد الترحيل (خطوة 9)' : 'Proceed to Commit (Step 9)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'صافي حركة الوزن (كغم)' : 'Net KG Delta'}</span>
          </div>
          <div className={`text-lg font-bold mt-1 ${totalDeltaKG >= 0 ? 'text-emerald-400' : 'text-purple-400'}`}>
            {totalDeltaKG > 0 ? `+${totalDeltaKG.toLocaleString()}` : totalDeltaKG.toLocaleString()} KG
          </div>
          <div className="text-[10px] text-slate-400 font-sans">
            {totalDeltaKG >= 0 ? (isRTL ? 'إدخال / زيادة رصيد' : 'Inflow / Addition') : (isRTL ? 'صرف / تخفيض رصيد' : 'Outflow / Deduction')}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400 flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'صافي الشلايف / الأكياس' : 'Net Bags Delta'}</span>
          </div>
          <div className="text-lg font-bold text-amber-300 mt-1">
            {totalDeltaBags > 0 ? `+${totalDeltaBags}` : totalDeltaBags} {isRTL ? 'شليف' : 'Bags'}
          </div>
          <div className="text-[10px] text-slate-400 font-sans">
            {isRTL ? 'كمية منفصلة عن الوزن' : 'Distinct from KG'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{isRTL ? 'المواد المتأثرة' : 'Affected Items'}</span>
          </div>
          <div className="text-lg font-bold text-white mt-1">
            {inventoryImpact.length} {isRTL ? 'صنف' : 'items'}
          </div>
          <div className="text-[10px] text-slate-400 font-sans">
            {isRTL ? 'في مستودعات المصنع' : 'Across warehouses'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
          <div className="text-[11px] font-sans text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isRTL ? 'تقييم سلامة الأرصدة' : 'Safety Evaluation'}</span>
          </div>
          <div className={`text-sm font-bold mt-1.5 ${negativeStockCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {negativeStockCount > 0
              ? `${negativeStockCount} ${isRTL ? 'رصيد سالب' : 'Negative items'}`
              : (isRTL ? '100% رصيد آمن' : '100% Safe Stock')}
          </div>
          <div className="text-[10px] text-slate-400 font-sans">
            {negativeStockCount > 0 ? (isRTL ? 'بحاجة لمراجعة' : 'Review needed') : (isRTL ? 'لا توجد أرصدة سالبة' : 'Zero deficits')}
          </div>
        </div>
      </div>

      {/* Negative Stock Alert if any */}
      {negativeStockCount > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 flex items-center gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            {isRTL
              ? `تنبيه: يوجد ${negativeStockCount} صنف ستؤدي هذه الحركة إلى هبوط رصيده لأقل من الصفر. يرجى التحقق من الكميات المصروفة قبل الاعتماد.`
              : `Warning: ${negativeStockCount} materials will result in negative stock balances. Verify issued quantities before committing.`}
          </span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث في المواد، الرموز، أو المستودعات...' : 'Search materials or warehouses...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl ps-9 pe-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'INFLOW', labelAr: 'إدخال / إضافة', labelEn: 'Inflow (+)' },
            { id: 'OUTFLOW', labelAr: 'صرف / تخفيض', labelEn: 'Outflow (-)' },
            { id: 'WARNING', labelAr: 'الأرصدة السالبة', labelEn: 'Deficits' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterType(f.id as any)}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filterType === f.id
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {isRTL ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Impact Simulation Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[480px]">
        <table className="w-full text-start text-xs font-mono">
          <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase sticky top-0 z-10">
            <tr>
              <th className="p-3 text-start font-sans">{isRTL ? 'المادة والكود' : 'Material & Code'}</th>
              <th className="p-3 text-start font-sans">{isRTL ? 'المستودع والموقع' : 'Warehouse / Location'}</th>
              <th className="p-3 text-end">{isRTL ? 'الرصيد الحالي' : 'Current Stock'}</th>
              <th className="p-3 text-center">{isRTL ? 'الشلايف الحالية' : 'Current Bags'}</th>
              <th className="p-3 text-end text-cyan-400">{isRTL ? 'تأثير الملف (كغم)' : 'File Delta (KG)'}</th>
              <th className="p-3 text-center text-amber-400">{isRTL ? 'تأثير الشلايف' : 'Bags Delta'}</th>
              <th className="p-3 text-end text-emerald-400">{isRTL ? 'الرصيد المتوقع' : 'Projected Stock'}</th>
              <th className="p-3 text-center font-sans">{isRTL ? 'تقييم السلامة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
            {filteredImpact.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                  {isRTL ? 'لا توجد أصناف تطابق البحث' : 'No items match filter criteria'}
                </td>
              </tr>
            ) : (
              filteredImpact.map((imp, idx) => {
                const isNegative = imp.projectedKG < 0;

                return (
                  <tr key={idx} className="hover:bg-slate-800/60 transition-colors">
                    <td className="p-3 font-sans">
                      <div className="font-bold text-white">{imp.materialNameAr}</div>
                      <div className="text-[11px] font-mono text-cyan-400">{imp.materialCode}</div>
                    </td>
                    <td className="p-3 font-sans">
                      <div className="text-slate-300">{imp.warehouseNameAr}</div>
                      <div className="text-[11px] font-mono text-slate-400">{imp.locationCode}</div>
                    </td>
                    <td className="p-3 text-end text-slate-300 font-bold">
                      {imp.currentKG.toLocaleString()} KG
                    </td>
                    <td className="p-3 text-center text-slate-400">{imp.currentBags}</td>
                    <td className="p-3 text-end font-bold">
                      <span className={imp.deltaKG >= 0 ? 'text-emerald-400' : 'text-purple-400'}>
                        {imp.deltaKG > 0 ? `+${imp.deltaKG.toLocaleString()}` : imp.deltaKG.toLocaleString()} KG
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold text-amber-300">
                      {imp.deltaBags > 0 ? `+${imp.deltaBags}` : imp.deltaBags}
                    </td>
                    <td className={`p-3 text-end font-bold ${isNegative ? 'text-rose-400' : 'text-emerald-400'} text-sm`}>
                      {imp.projectedKG.toLocaleString()} KG
                      <span className="text-[11px] font-normal text-slate-400 ms-1">
                        ({imp.projectedBags} {isRTL ? 'شليف' : 'bags'})
                      </span>
                    </td>
                    <td className="p-3 text-center font-sans">
                      {isNegative ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
                          {isRTL ? 'رصيد سالب' : 'Deficit'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          {isRTL ? 'آمن / طبيعي' : 'Safe Stock'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('DATA_PREVIEW')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          <span>{isRTL ? 'السابق: معاينة الحركات (خطوة 7)' : 'Back to Preview (Step 7)'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('COMMIT_MIGRATION')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition-all cursor-pointer"
        >
          <span>{isRTL ? 'المتابعة لاعتماد الترحيل (خطوة 9)' : 'Proceed to Commit (Step 9)'}</span>
          <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
