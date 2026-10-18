import { MaterialItem, InventoryBalance, Supplier, ReceivingTransaction, Warehouse, WarehouseLocation } from '../types';

export type LowStockSeverity = 'OUT_OF_STOCK' | 'CRITICAL' | 'WARNING' | 'REORDER_POINT' | 'HEALTHY';

export interface LowStockAlert {
  materialId: string;
  materialCode: string;
  materialNameAr: string;
  materialNameEn: string;
  category: string;
  unit: string;
  currentStockKG: number;
  currentBagsCount: number;
  minStockKG: number; // Defined Safety Minimum Threshold
  maxStockKG: number;
  safetyThresholdKG: number; // 100% of defined safety threshold
  deficitKG: number; // Deficit to reach min threshold
  recommendedReorderKG: number; // Recommended procurement batch size
  recommendedReorderBags: number; // Estimated bags
  coveragePercentage: number; // Stock vs Min safety threshold (e.g. 0% - 100%)
  severity: LowStockSeverity;
  statusLabelAr: string;
  statusLabelEn: string;
  urgencyColor: string;
  defaultWarehouseId: string;
  defaultWarehouseName: string;
  defaultLocationCode: string;
  requiresShredding: boolean;
  matchingSuppliers: Supplier[];
  incomingShipmentsKG: number; // Weight in transit or awaiting scale-out / unloading
  pendingShipmentsCount: number;
  lastProcurementDate?: string;
}

export interface LowStockOverview {
  totalMaterials: number;
  materialsNeedingProcurement: number;
  outOfStockCount: number;
  criticalCount: number;
  warningCount: number;
  totalDeficitKG: number;
  totalRecommendedReorderKG: number;
  alerts: LowStockAlert[];
}

/**
 * Evaluates current warehouse inventory balances against material safety thresholds
 * and generates procurement recommendations.
 */
export function evaluateLowStockInventory(
  materials: MaterialItem[],
  inventoryBalances: InventoryBalance[],
  suppliers: Supplier[] = [],
  receivingTransactions: ReceivingTransaction[] = [],
  warehouses: Warehouse[] = [],
  locations: WarehouseLocation[] = []
): LowStockOverview {
  const alerts: LowStockAlert[] = [];

  let outOfStockCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let totalDeficitKG = 0;
  let totalRecommendedReorderKG = 0;

  // Active materials only
  const activeMaterials = materials.filter((m) => m.active);

  activeMaterials.forEach((mat) => {
    // Calculate total on-hand stock across all locations
    const matBalances = inventoryBalances.filter((b) => b.materialId === mat.id);
    const currentStockKG = Math.max(
      0,
      Math.round(matBalances.reduce((sum, b) => sum + (Number(b.availableKG) || 0), 0) * 100) / 100
    );
    const currentBagsCount = matBalances.reduce((sum, b) => sum + (Number(b.bulkBagsCount) || 0), 0);

    const minStockKG = Number(mat.minStockKG) || 1000;
    const maxStockKG = Number(mat.maxStockKG) || minStockKG * 5;
    const safetyThresholdKG = minStockKG;

    // Calculate pending incoming shipments that have entered the scale but not finalized into storage
    const incomingTx = receivingTransactions.filter(
      (r) =>
        (r.materialId === mat.id || r.materialCode === mat.code) &&
        r.status !== 'Received' &&
        r.status !== 'Returned to Storage' &&
        r.status !== 'Cancelled'
    );
    const incomingShipmentsKG = incomingTx.reduce(
      (sum, r) => sum + (r.netReceivedWeightKG || r.unloadWeightKG || (r.scaleInWeightKG ? r.scaleInWeightKG * 0.4 : 0)),
      0
    );

    // Calculate coverage percentage relative to minimum safety stock
    const coveragePercentage =
      safetyThresholdKG > 0 ? Math.round((currentStockKG / safetyThresholdKG) * 100) : 100;

    // Determine severity
    let severity: LowStockSeverity = 'HEALTHY';
    let statusLabelAr = 'ضمن المستويات الآمنة';
    let statusLabelEn = 'Healthy Level';
    let urgencyColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

    if (currentStockKG <= 0) {
      severity = 'OUT_OF_STOCK';
      statusLabelAr = 'نفاد تام من المخزن (0 كغم)';
      statusLabelEn = 'Out of Stock (0 KG)';
      urgencyColor = 'text-rose-400 bg-rose-500/20 border-rose-500/50';
      outOfStockCount++;
    } else if (currentStockKG < safetyThresholdKG * 0.5) {
      severity = 'CRITICAL';
      statusLabelAr = 'حرج جداً (< 50% من حد الأمان)';
      statusLabelEn = 'Critically Low (< 50%)';
      urgencyColor = 'text-rose-400 bg-rose-500/15 border-rose-500/40';
      criticalCount++;
    } else if (currentStockKG <= safetyThresholdKG) {
      severity = 'WARNING';
      statusLabelAr = 'أقل من حد الأمان المحدد';
      statusLabelEn = 'Below Safety Minimum';
      urgencyColor = 'text-amber-400 bg-amber-500/15 border-amber-500/40';
      warningCount++;
    } else if (currentStockKG <= safetyThresholdKG * 1.25) {
      severity = 'REORDER_POINT';
      statusLabelAr = 'يقترب من حد إعادة الطلب';
      statusLabelEn = 'Approaching Reorder Point';
      urgencyColor = 'text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
    }

    const needsProcurement = severity === 'OUT_OF_STOCK' || severity === 'CRITICAL' || severity === 'WARNING';

    // Deficit below minimum
    const deficitKG = Math.max(0, safetyThresholdKG - currentStockKG);

    // Recommended procurement quantity brings inventory up to 75% of max capacity, or 2x minStock
    let recommendedReorderKG = 0;
    if (needsProcurement || severity === 'REORDER_POINT') {
      const targetComfortableStock = Math.max(safetyThresholdKG * 2, maxStockKG * 0.7);
      recommendedReorderKG = Math.round((targetComfortableStock - currentStockKG) / 500) * 500;
      if (recommendedReorderKG < 2000) recommendedReorderKG = 2000; // Minimum truck intake is ~2 Tons
    }

    const recommendedReorderBags = Math.ceil(recommendedReorderKG / 500);

    if (needsProcurement) {
      totalDeficitKG += deficitKG;
      totalRecommendedReorderKG += recommendedReorderKG;
    }

    // Default warehouse & location metadata
    const defWarehouse = warehouses.find((w) => w.id === mat.defaultWarehouseId);
    const defLoc = locations.find((l) => l.id === mat.defaultLocationId);

    // Matching suppliers based on material types/category
    const matchingSuppliers = suppliers.filter((s) => {
      const matTokens = [
        mat.code.toLowerCase(),
        mat.nameEn.toLowerCase(),
        mat.nameAr,
        ...(mat.aliases || []),
      ];
      return (
        s.materialTypes.some((type) =>
          matTokens.some((token) => token.includes(type.toLowerCase()) || type.toLowerCase().includes(token))
        ) ||
        (mat.category.includes('Raw') && s.materialTypes.some((t) => t.includes('PP') || t.includes('PET') || t.includes('Pellets'))) ||
        (mat.category.includes('Scrap') && s.materialTypes.some((t) => t.includes('Scrap') || t.includes('Trims'))) ||
        (mat.category.includes('Masterbatch') && s.materialTypes.some((t) => t.includes('Masterbatch') || t.includes('White')))
      );
    });

    // Last completed receipt date
    const completedTx = receivingTransactions
      .filter((r) => (r.materialId === mat.id || r.materialCode === mat.code) && r.status === 'Received')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastProcurementDate = completedTx.length > 0 ? completedTx[0].date : undefined;

    alerts.push({
      materialId: mat.id,
      materialCode: mat.code,
      materialNameAr: mat.nameAr,
      materialNameEn: mat.nameEn,
      category: mat.category,
      unit: mat.unit,
      currentStockKG,
      currentBagsCount,
      minStockKG,
      maxStockKG,
      safetyThresholdKG,
      deficitKG,
      recommendedReorderKG,
      recommendedReorderBags,
      coveragePercentage,
      severity,
      statusLabelAr,
      statusLabelEn,
      urgencyColor,
      defaultWarehouseId: mat.defaultWarehouseId,
      defaultWarehouseName: defWarehouse?.nameAr || 'المستودع الرئيسي',
      defaultLocationCode: defLoc?.code || 'LOC-MAIN',
      requiresShredding: mat.requiresShredding,
      matchingSuppliers,
      incomingShipmentsKG,
      pendingShipmentsCount: incomingTx.length,
      lastProcurementDate,
    });
  });

  // Sort by urgency: OUT_OF_STOCK first, then CRITICAL, then WARNING, then highest deficit
  const severityRank: Record<LowStockSeverity, number> = {
    OUT_OF_STOCK: 1,
    CRITICAL: 2,
    WARNING: 3,
    REORDER_POINT: 4,
    HEALTHY: 5,
  };

  alerts.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return b.deficitKG - a.deficitKG;
  });

  const materialsNeedingProcurement = outOfStockCount + criticalCount + warningCount;

  return {
    totalMaterials: activeMaterials.length,
    materialsNeedingProcurement,
    outOfStockCount,
    criticalCount,
    warningCount,
    totalDeficitKG: Math.round(totalDeficitKG * 100) / 100,
    totalRecommendedReorderKG: Math.round(totalRecommendedReorderKG * 100) / 100,
    alerts,
  };
}
