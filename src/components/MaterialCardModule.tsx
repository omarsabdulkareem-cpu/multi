import React, { useState } from 'react';
import {
  CreditCard,
  Barcode,
  Boxes,
  Truck,
  Flame,
  Factory,
  ArrowRightLeft,
  Search,
  Download,
  ShieldCheck,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';

export const MaterialCardModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const {
    materials,
    inventoryBalances,
    inventoryMovements,
    productionOrders,
    selectedMaterialId,
    setSelectedMaterialId,
  } = useFactory();

  const [activeMaterialId, setActiveMaterialId] = useState(
    selectedMaterialId || materials[0]?.id || ''
  );

  const selectedMat = materials.find((m) => m.id === activeMaterialId) || materials[0];

  // Locations breakdown for this material
  const materialLocationBalances = inventoryBalances.filter(
    (b) => b.materialId === selectedMat?.id && (b.totalBalanceKG > 0 || (b.bulkBagsCount || 0) > 0)
  );

  // Aggregate across all locations
  const totalPhysicalBalanceKG = inventoryBalances
    .filter((b) => b.materialId === selectedMat?.id)
    .reduce((sum, b) => sum + (b.totalBalanceKG || 0), 0);

  const totalPhysicalBags = inventoryBalances
    .filter((b) => b.materialId === selectedMat?.id)
    .reduce((sum, b) => sum + (b.bulkBagsCount || 0), 0);

  // Pending production orders reserving this material
  const pendingOrders = productionOrders.filter(
    (po) =>
      po.requiredMaterialId === selectedMat?.id &&
      (po.status === 'PLANNED' || po.status === 'RELEASED' || po.status === 'IN_PROGRESS' || po.status === 'Planned' || po.status === 'In Progress')
  );
  const reservedStockKG = pendingOrders.reduce(
    (sum, po) => sum + Math.max(0, (po.plannedQuantityKG || 0) - (po.actualProducedKG || 0)),
    0
  );
  const availableBalanceKG = Math.max(0, totalPhysicalBalanceKG - reservedStockKG);

  // Filter movements for this specific material
  const materialMovements = inventoryMovements.filter((m) => m.materialId === selectedMat?.id);

  // Compute breakdown metrics
  const totalReceiptsKG = materialMovements
    .filter((m) => m.movementType === 'RECEIVING' || m.movementType === 'RECEIPT' || m.movementType === 'OPENING_BALANCE')
    .reduce((sum, m) => sum + (m.quantityKG || 0), 0);

  const totalShreddingReturnKG = materialMovements
    .filter((m) => m.movementType === 'SHREDDING RETURN' || m.movementType === 'SHREDDING_OUTPUT' || (m.movementType as string) === 'SHREDDING_RETURN')
    .reduce((sum, m) => sum + (m.quantityKG || 0), 0);

  const totalProductionIssuesKG = materialMovements
    .filter((m) => m.movementType === 'PRODUCTION ISSUE' || m.movementType === 'PRODUCTION_ISSUE' || m.movementType === 'ISSUE')
    .reduce((sum, m) => sum + (m.quantityKG || 0), 0);

  const totalTransfersInKG = materialMovements
    .filter((m) => m.movementType === 'TRANSFER' || m.movementType === 'TRANSFER_IN')
    .reduce((sum, m) => sum + (m.quantityKG || 0), 0);

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              MATERIAL LEDGER CARD / بطاقة الصنف
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'كشف الحساب وحركات الصنف التفصيلية' : 'Item Statement & Sub-ledger'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'بطاقة الصنف وكشف الحركة التراكمي' : 'Material Master Statement Card'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'متابعة رصيد أول المدة + الوارد (546) + الثرم (360) - المنصرف (167) = الرصيد الحالي والشلايف.'
              : 'Opening Balance + Receipts + Shred Returns - Production Issues = Current Stock Balance.'}
          </p>
        </div>

        {/* Material Selector */}
        <div className="min-w-64">
          <label className="block text-[11px] font-bold text-slate-300 mb-1">
            {isRTL ? 'اختر الصنف لمعاينة بطاقته:' : 'Select Material Card:'}
          </label>
          <select
            value={activeMaterialId}
            onChange={(e) => {
              setActiveMaterialId(e.target.value);
              setSelectedMaterialId(e.target.value);
            }}
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-cyan-500/50 text-white font-bold text-xs outline-none focus:border-cyan-400 shadow"
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} - {isRTL ? m.nameAr : m.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Material Identity & Balance HUD Card */}
      {selectedMat && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Barcode className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                    {selectedMat.code}
                  </span>
                  <span className="text-xs text-slate-400">{selectedMat.category}</span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {isRTL ? selectedMat.nameAr : selectedMat.nameEn}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL ? selectedMat.descriptionAr : selectedMat.descriptionEn}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-end min-w-28">
                <div className="text-[11px] text-slate-400 uppercase font-mono">
                  {isRTL ? 'الرصيد الفعلي الإجمالي' : 'Total Physical'}
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300">
                  {(totalPhysicalBalanceKG ?? 0).toLocaleString()}{' '}
                  <span className="text-xs font-sans text-cyan-400">KG</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {totalPhysicalBags} {isRTL ? 'شليف' : 'bags'}
                </div>
              </div>

              <div className="h-10 w-px bg-slate-800 hidden sm:block" />

              <div className="text-end min-w-28">
                <div className="text-[11px] text-amber-400 uppercase font-mono">
                  {isRTL ? 'محجوز للإنتاج (RESERVED)' : 'Reserved for Prod'}
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-300">
                  {(reservedStockKG ?? 0).toLocaleString()}{' '}
                  <span className="text-xs font-sans text-amber-400">KG</span>
                </div>
                <div className="text-[10px] text-amber-500/80 font-mono">
                  {pendingOrders.length} {isRTL ? 'أوامر جارية' : 'active orders'}
                </div>
              </div>

              <div className="h-10 w-px bg-slate-800 hidden sm:block" />

              <div className="text-end min-w-28">
                <div className="text-[11px] text-emerald-400 uppercase font-mono">
                  {isRTL ? 'الرصيد الحر المتاح' : 'Net Available'}
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-emerald-300">
                  {(availableBalanceKG ?? 0).toLocaleString()}{' '}
                  <span className="text-xs font-sans text-emerald-400">KG</span>
                </div>
                <div className="text-[10px] text-emerald-500/80 font-mono">
                  {isRTL ? 'متاح للصرف الفوري' : 'Ready to issue'}
                </div>
              </div>
            </div>
          </div>

          {/* Mathematical Balance Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Receipts */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-cyan-400" />
                {isRTL ? 'الوارد من الموردين (546)' : 'Total Received (546)'}
              </span>
              <div className="text-xl font-black font-mono text-cyan-400">
                +{(totalReceiptsKG ?? 0).toLocaleString()} KG
              </div>
            </div>

            {/* Shredding Returns */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                {isRTL ? 'عائد الثرم والجرش (360)' : 'Shredding Returns (360)'}
              </span>
              <div className="text-xl font-black font-mono text-emerald-400">
                +{(totalShreddingReturnKG ?? 0).toLocaleString()} KG
              </div>
            </div>

            {/* Production Issues */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5 text-purple-400" />
                {isRTL ? 'المنصرف للإنتاج (167)' : 'Issued to Production (167)'}
              </span>
              <div className="text-xl font-black font-mono text-purple-400">
                -{(totalProductionIssuesKG ?? 0).toLocaleString()} KG
              </div>
            </div>

            {/* Safe Stock Level */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                {isRTL ? 'الحد الأدنى للأمان' : 'Min Safety Stock'}
              </span>
              <div className="text-xl font-black font-mono text-slate-200">
                {(selectedMat.minStockLevelKG ?? 0).toLocaleString()} KG
              </div>
            </div>
          </div>

          {/* Location Breakdown */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'توزيع الرصيد الحالي حسب المستودعات ومواقع التخزين' : 'Stock Distribution by Warehouse & Location'}</span>
            </h4>
            {materialLocationBalances.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">
                {isRTL ? 'لا يوجد رصيد حالي مخزن في أي موقع' : 'No current stock recorded in any location'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
                {materialLocationBalances.map((loc) => (
                  <div
                    key={`${loc.warehouseId}_${loc.locationCode}`}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{loc.warehouseName}</div>
                      <div className="font-mono text-[11px] text-cyan-400">{loc.locationCode}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono font-bold text-slate-200">
                        {loc.totalBalanceKG.toLocaleString()} KG
                      </div>
                      <div className="font-mono text-[10px] text-amber-400">
                        {loc.bulkBagsCount || 0} {isRTL ? 'شليف' : 'bags'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Material Specific Movement History Ledger */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden space-y-3 p-5">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>
            {isRTL
              ? `سجل حركات بطاقة الصنف: ${selectedMat?.nameAr}`
              : `Movement Journal for: ${selectedMat?.nameEn}`}
          </span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs font-mono">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
              <tr>
                <th className="p-3 text-start">{isRTL ? 'رقم الحركة' : 'Movement #'}</th>
                <th className="p-3 text-start">{isRTL ? 'المستند الدفتري' : 'Doc #'}</th>
                <th className="p-3 text-start">{isRTL ? 'التاريخ والوقت' : 'Date / Time'}</th>
                <th className="p-3 text-start font-sans">{isRTL ? 'نوع الحركة' : 'Type'}</th>
                <th className="p-3 text-end">{isRTL ? 'وارد (+)' : 'Inflow (+)'}</th>
                <th className="p-3 text-end">{isRTL ? 'صادر (-)' : 'Outflow (-)'}</th>
                <th className="p-3 text-center text-amber-400">{isRTL ? 'شلايف' : 'Bags'}</th>
                <th className="p-3 text-start font-sans">{isRTL ? 'الموقع' : 'Location'}</th>
                <th className="p-3 text-start font-sans">{isRTL ? 'المشغل' : 'Operator'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {materialMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                    {isRTL ? 'لا توجد حركات مسجلة لهذا الصنف حتى الآن' : 'No recorded movements for this item yet.'}
                  </td>
                </tr>
              ) : (
                materialMovements.map((m) => {
                  const isInflow =
                    m.movementType === 'RECEIVING' ||
                    m.movementType === 'RECEIPT' ||
                    m.movementType === 'OPENING_BALANCE' ||
                    m.movementType === 'SHREDDING RETURN' ||
                    m.movementType === 'SHREDDING_OUTPUT' ||
                    (m.movementType as string) === 'SHREDDING_RETURN' ||
                    m.movementType === 'RETURN';
                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-white">{m.movementNumber}</td>
                      <td className="p-3 text-cyan-400 font-bold">{m.legacyDocumentNumber || '---'}</td>
                      <td className="p-3 text-slate-300">
                        {m.date} {m.time}
                      </td>
                      <td className="p-3 font-sans text-slate-200">{m.movementType}</td>
                      <td className="p-3 text-end font-bold text-emerald-400">
                        {isInflow ? `+${(m.quantityKG ?? 0).toLocaleString()} KG` : '---'}
                      </td>
                      <td className="p-3 text-end font-bold text-rose-400">
                        {!isInflow ? `-${(m.quantityKG ?? 0).toLocaleString()} KG` : '---'}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-400">{m.bulkBagsCount}</td>
                      <td className="p-3 font-sans text-slate-300">{m.destinationLocation}</td>
                      <td className="p-3 font-sans text-slate-400">{m.operator}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
