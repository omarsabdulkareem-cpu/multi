import {
  MaterialItem,
  InventoryBalance,
  ShreddingTransaction,
  ProductionIssue,
  Supplier,
} from '../types';

export type StockoutUrgency =
  | 'STOCKOUT_IMMINENT' // Runway < Lead Time (< 3 days): Stockout will happen before delivery arrives!
  | 'REORDER_NOW' // Current Stock <= Suggested Reorder Point
  | 'REORDER_APPROACHING' // Stock within 20% of Reorder Point
  | 'OPTIMAL' // Healthy stock runway
  | 'OVERSTOCKED'; // Stock > 45 days of demand

export interface HistoricalDailyPoint {
  date: string;
  dayLabel: string;
  shreddingKG: number;
  productionKG: number;
  totalKG: number;
}

export interface MaterialForecastReport {
  materialId: string;
  materialCode: string;
  materialNameAr: string;
  materialNameEn: string;
  category: string;
  unit: string;
  requiresShredding: boolean;

  // Stock On-Hand
  currentStockKG: number;
  currentStockBags: number;
  currentMinStockKG: number; // Static configured threshold
  currentMaxStockKG: number;

  // Historical Consumption Analysis
  historicalShreddingKG: number;
  historicalProductionKG: number;
  totalConsumedKG: number;
  consumptionDaysActive: number;
  dailyBurnRateKG: number; // Mean Daily Demand
  dailyVolatilityKG: number; // Standard Deviation
  peakDailyDemandKG: number;

  // Dynamic Lead Time & Safety Calculations
  leadTimeDays: number;
  leadTimeDemandKG: number; // Daily Burn Rate * Lead Time
  safetyStockKG: number; // Statistical Safety Stock (Z * sigma * sqrt(L))
  suggestedReorderPointKG: number; // Dynamic ROP = LTD + SS
  recommendedReorderQtyKG: number; // EOQ / Refill Batch
  recommendedReorderBags: number;

  // Predictive Horizons
  runwayDays: number; // Days of Inventory Remaining (DOI)
  predictedStockoutDate: string; // ISO date string
  stockoutUrgency: StockoutUrgency;
  stockoutRiskPercentage: number; // 0 to 100%
  deficitToSuggestedROP: number; // How much below ROP
  isStaticThresholdUnderprotected: boolean; // Static threshold under-protects compared to actual empirical demand
  gapBetweenStaticAndDynamicKG: number;

  // Supplier Links
  matchingSuppliers: Supplier[];
  historicalDailyTrend: HistoricalDailyPoint[];
}

export interface ForecastConfiguration {
  timeHorizonDays: number; // 7, 14, 30, 60
  serviceLevelZ: number; // 1.28 (90%), 1.65 (95%), 2.05 (98%), 2.33 (99%)
  demandSurgeMultiplier: number; // 1.0 = baseline, 1.25 = +25% surge
  defaultLeadTimeDays: number; // Default supplier delivery window
  customLeadTimes: Record<string, number>; // Per-material custom lead times
}

export interface ForecastOverviewSummary {
  totalMaterials: number;
  materialsNeedingImmediateReorder: number;
  imminentStockoutsCount: number;
  approachingReorderCount: number;
  healthyCount: number;
  totalRecommendedReorderKG: number;
  totalDeficitKG: number;
  totalDailyPlantBurnRateKG: number;
  fastestDepletingMaterial: MaterialForecastReport | null;
  highestConsumptionMaterial: MaterialForecastReport | null;
}

const STORAGE_CONFIG_KEY = 'alkarwan_inventory_forecast_config_v1';

export const DEFAULT_FORECAST_CONFIG: ForecastConfiguration = {
  timeHorizonDays: 30,
  serviceLevelZ: 1.65, // 95% service level
  demandSurgeMultiplier: 1.0,
  defaultLeadTimeDays: 4,
  customLeadTimes: {},
};

export function getStoredForecastConfig(): ForecastConfiguration {
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        timeHorizonDays: parsed.timeHorizonDays || 30,
        serviceLevelZ: parsed.serviceLevelZ || 1.65,
        demandSurgeMultiplier: parsed.demandSurgeMultiplier || 1.0,
        defaultLeadTimeDays: parsed.defaultLeadTimeDays || 4,
        customLeadTimes: parsed.customLeadTimes || {},
      };
    }
  } catch (e) {
    console.warn('Error loading forecast configuration', e);
  }
  return DEFAULT_FORECAST_CONFIG;
}

export function saveStoredForecastConfig(config: ForecastConfiguration): void {
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Error saving forecast configuration', e);
  }
}

/**
 * Parses date string safely into standard YYYY-MM-DD
 */
function toDateKey(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  if (dateStr.includes(' ')) return dateStr.split(' ')[0];
  return dateStr.slice(0, 10);
}

/**
 * Calculates Predictive Inventory Forecasts across all raw materials
 * based on historical shredding and production demand.
 */
export function calculatePredictiveInventoryForecast(
  materials: MaterialItem[],
  inventoryBalances: InventoryBalance[],
  shreddingTransactions: ShreddingTransaction[],
  productionIssues: ProductionIssue[],
  suppliers: Supplier[] = [],
  configOverrides?: Partial<ForecastConfiguration>
): MaterialForecastReport[] {
  const config: ForecastConfiguration = {
    ...getStoredForecastConfig(),
    ...configOverrides,
  };

  const now = new Date();
  const horizonMs = config.timeHorizonDays * 24 * 60 * 60 * 1000;
  const cutoffTime = now.getTime() - horizonMs;

  // Active raw materials, flakes, and scrap items
  const activeMaterials = materials.filter((m) => m.active);

  const reports: MaterialForecastReport[] = activeMaterials.map((mat) => {
    // 1. Calculate Current On-Hand Stock
    const matBalances = inventoryBalances.filter((b) => b.materialId === mat.id);
    const currentStockKG = Math.max(
      0,
      Math.round(matBalances.reduce((sum, b) => sum + (Number(b.availableKG) || 0), 0) * 100) / 100
    );
    const currentStockBags = matBalances.reduce(
      (sum, b) => sum + (Number(b.bulkBagsCount) || 0),
      0
    );

    const currentMinStockKG = Number(mat.minStockKG) || 1000;
    const currentMaxStockKG = Number(mat.maxStockKG) || currentMinStockKG * 5;

    // 2. Filter Historical Shredding (Input to shredder = Raw plastic consumed)
    const recentShreddings = shreddingTransactions.filter((s) => {
      const match = s.materialId === mat.id || s.materialCode === mat.code;
      if (!match) return false;
      const t = s.shreddingStart || s.createdAt;
      if (!t) return true; // Include if date missing
      const timeMs = new Date(t).getTime();
      return isNaN(timeMs) || timeMs >= cutoffTime;
    });

    // 3. Filter Historical Production Issues (Feed to Extruders = Flakes/Pellets consumed)
    const recentProdIssues = productionIssues.filter((p) => {
      const match = p.materialId === mat.id || p.materialCode === mat.code;
      if (!match) return false;
      const t = p.time || p.createdAt;
      if (!t) return true;
      const timeMs = new Date(t).getTime();
      return isNaN(timeMs) || timeMs >= cutoffTime;
    });

    // 4. Daily Time Series Aggregation
    const dailyMap: Record<string, { shredding: number; production: number }> = {};

    // Initialize all days in the horizon
    for (let i = config.timeHorizonDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { shredding: 0, production: 0 };
    }

    recentShreddings.forEach((s) => {
      const key = toDateKey(s.shreddingStart || s.createdAt);
      const qty = Number(s.inputKG) || Number(s.outputKG) || 0;
      if (!dailyMap[key]) dailyMap[key] = { shredding: 0, production: 0 };
      dailyMap[key].shredding += qty;
    });

    recentProdIssues.forEach((p) => {
      const key = toDateKey(p.time || p.createdAt);
      const qty = Number(p.quantityKG) || 0;
      if (!dailyMap[key]) dailyMap[key] = { shredding: 0, production: 0 };
      dailyMap[key].production += qty;
    });

    const historicalDailyTrend: HistoricalDailyPoint[] = Object.keys(dailyMap)
      .sort()
      .map((dateKey) => {
        const item = dailyMap[dateKey];
        return {
          date: dateKey,
          dayLabel: dateKey.slice(5), // MM-DD
          shreddingKG: Math.round(item.shredding),
          productionKG: Math.round(item.production),
          totalKG: Math.round(item.shredding + item.production),
        };
      });

    const historicalShreddingKG = recentShreddings.reduce(
      (sum, s) => sum + (Number(s.inputKG) || Number(s.outputKG) || 0),
      0
    );
    const historicalProductionKG = recentProdIssues.reduce(
      (sum, p) => sum + (Number(p.quantityKG) || 0),
      0
    );

    const totalRawConsumed = historicalShreddingKG + historicalProductionKG;

    // Days with recorded activity
    const activeDays = historicalDailyTrend.filter((d) => d.totalKG > 0).length;
    const effectiveDays = Math.max(1, config.timeHorizonDays);

    // If transactions in the window are sparse, use calibrated realistic industrial baseline for raw materials
    let baselineDailyKG = 0;
    if (totalRawConsumed === 0) {
      if (mat.requiresShredding || mat.category.includes('Raw')) {
        baselineDailyKG = 650; // Nominal ~650 KG/day raw plastic consumption
      } else if (mat.category.includes('Flake') || mat.category.includes('مجروش')) {
        baselineDailyKG = 800; // Nominal extruder draw
      } else if (mat.category.includes('Masterbatch')) {
        baselineDailyKG = 35; // Masterbatch daily feed
      } else {
        baselineDailyKG = 200;
      }
    }

    const calculatedDailyBurn =
      totalRawConsumed > 0
        ? totalRawConsumed / effectiveDays
        : baselineDailyKG;

    // Apply demand surge multiplier (e.g. 1.25x high season)
    const dailyBurnRateKG = Math.round(calculatedDailyBurn * config.demandSurgeMultiplier);

    // Standard deviation of daily demand
    const dailyValues = historicalDailyTrend.map((d) =>
      totalRawConsumed > 0 ? d.totalKG * config.demandSurgeMultiplier : dailyBurnRateKG
    );
    const mean = dailyBurnRateKG;
    const variance =
      dailyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      Math.max(1, dailyValues.length);
    const dailyVolatilityKG = Math.round(Math.sqrt(variance)) || Math.round(dailyBurnRateKG * 0.25);

    const peakDailyDemandKG = Math.round(
      Math.max(...dailyValues, dailyBurnRateKG * 1.4)
    );

    // 5. Lead Time & Statistical Safety Stock
    const leadTimeDays =
      config.customLeadTimes[mat.id] || config.defaultLeadTimeDays || 4;

    // Lead Time Demand (LTD = dailyBurnRate * leadTimeDays)
    const leadTimeDemandKG = Math.round(dailyBurnRateKG * leadTimeDays);

    // Statistical Safety Stock (SS = Z * sigma * sqrt(L))
    const rawSafetyStock =
      config.serviceLevelZ * dailyVolatilityKG * Math.sqrt(leadTimeDays);
    // Floor safety stock to at least 1.5 days of average burn rate
    const safetyStockKG = Math.round(
      Math.max(dailyBurnRateKG * 1.5, rawSafetyStock)
    );

    // Dynamic Suggested Reorder Point (ROP = LTD + SS)
    const suggestedReorderPointKG = Math.round(leadTimeDemandKG + safetyStockKG);

    // Recommended Reorder Batch Size (Brings inventory to target maximum = ROP + 1.5 * LTD)
    const targetMaxKG = Math.max(
      currentMaxStockKG,
      suggestedReorderPointKG + leadTimeDemandKG * 1.5
    );
    const recommendedReorderQtyKG = Math.max(
      0,
      Math.round(targetMaxKG - currentStockKG)
    );
    const avgBagWeight = 450; // kg per bulk bag
    const recommendedReorderBags = Math.ceil(recommendedReorderQtyKG / avgBagWeight);

    // 6. Days of Inventory Remaining (Runway)
    const runwayDays =
      dailyBurnRateKG > 0
        ? Math.round((currentStockKG / dailyBurnRateKG) * 10) / 10
        : 99.9;

    // Predicted Stockout Date
    const stockoutDateObj = new Date(now.getTime() + runwayDays * 24 * 60 * 60 * 1000);
    const predictedStockoutDate = stockoutDateObj.toISOString();

    // 7. Stockout Urgency & Risk Scoring
    let stockoutUrgency: StockoutUrgency = 'OPTIMAL';
    let stockoutRiskPercentage = 0;

    if (currentStockKG === 0) {
      stockoutUrgency = 'STOCKOUT_IMMINENT';
      stockoutRiskPercentage = 100;
    } else if (runwayDays <= leadTimeDays) {
      // Stockout is guaranteed before a new shipment can arrive!
      stockoutUrgency = 'STOCKOUT_IMMINENT';
      stockoutRiskPercentage = Math.min(
        100,
        Math.round(85 + (1 - runwayDays / Math.max(1, leadTimeDays)) * 15)
      );
    } else if (currentStockKG <= suggestedReorderPointKG) {
      stockoutUrgency = 'REORDER_NOW';
      stockoutRiskPercentage = Math.min(
        84,
        Math.round(60 + (1 - currentStockKG / Math.max(1, suggestedReorderPointKG)) * 24)
      );
    } else if (currentStockKG <= suggestedReorderPointKG * 1.25) {
      stockoutUrgency = 'REORDER_APPROACHING';
      stockoutRiskPercentage = Math.round(
        35 + (1 - (currentStockKG - suggestedReorderPointKG) / (suggestedReorderPointKG * 0.25)) * 24
      );
    } else if (runwayDays > 45) {
      stockoutUrgency = 'OVERSTOCKED';
      stockoutRiskPercentage = 5;
    } else {
      stockoutUrgency = 'OPTIMAL';
      stockoutRiskPercentage = Math.max(5, Math.round(20 - (runwayDays / 45) * 15));
    }

    const deficitToSuggestedROP = Math.max(0, suggestedReorderPointKG - currentStockKG);
    const isStaticThresholdUnderprotected = suggestedReorderPointKG > currentMinStockKG;
    const gapBetweenStaticAndDynamicKG = suggestedReorderPointKG - currentMinStockKG;

    // Matching suppliers
    const matchingSuppliers = suppliers.filter(
      (s) =>
        s.status === 'Active' &&
        s.materialTypes &&
        s.materialTypes.some(
          (m) =>
            m.toLowerCase().includes(mat.nameEn.toLowerCase()) ||
            m.toLowerCase().includes(mat.code.toLowerCase()) ||
            mat.nameEn.toLowerCase().includes(m.toLowerCase())
        )
    );

    return {
      materialId: mat.id,
      materialCode: mat.code,
      materialNameAr: mat.nameAr,
      materialNameEn: mat.nameEn,
      category: mat.category,
      unit: mat.unit || 'KG',
      requiresShredding: !!mat.requiresShredding,
      currentStockKG,
      currentStockBags,
      currentMinStockKG,
      currentMaxStockKG,
      historicalShreddingKG,
      historicalProductionKG,
      totalConsumedKG: totalRawConsumed,
      consumptionDaysActive: activeDays,
      dailyBurnRateKG,
      dailyVolatilityKG,
      peakDailyDemandKG,
      leadTimeDays,
      leadTimeDemandKG,
      safetyStockKG,
      suggestedReorderPointKG,
      recommendedReorderQtyKG,
      recommendedReorderBags,
      runwayDays,
      predictedStockoutDate,
      stockoutUrgency,
      stockoutRiskPercentage,
      deficitToSuggestedROP,
      isStaticThresholdUnderprotected,
      gapBetweenStaticAndDynamicKG,
      matchingSuppliers,
      historicalDailyTrend,
    };
  });

  // Sort by highest stockout risk first
  return reports.sort((a, b) => b.stockoutRiskPercentage - a.stockoutRiskPercentage);
}

/**
 * Computes high-level executive summary KPIs across the predictive inventory fleet
 */
export function getForecastOverviewSummary(
  reports: MaterialForecastReport[]
): ForecastOverviewSummary {
  const imminent = reports.filter((r) => r.stockoutUrgency === 'STOCKOUT_IMMINENT');
  const reorderNow = reports.filter((r) => r.stockoutUrgency === 'REORDER_NOW');
  const approaching = reports.filter((r) => r.stockoutUrgency === 'REORDER_APPROACHING');
  const healthy = reports.filter(
    (r) => r.stockoutUrgency === 'OPTIMAL' || r.stockoutUrgency === 'OVERSTOCKED'
  );

  const totalRecommendedReorderKG = reports.reduce(
    (sum, r) => sum + (r.stockoutUrgency !== 'OPTIMAL' && r.stockoutUrgency !== 'OVERSTOCKED' ? r.recommendedReorderQtyKG : 0),
    0
  );

  const totalDeficitKG = reports.reduce((sum, r) => sum + r.deficitToSuggestedROP, 0);

  const totalDailyPlantBurnRateKG = reports.reduce(
    (sum, r) => sum + r.dailyBurnRateKG,
    0
  );

  const fastestDepletingMaterial = [...reports].sort(
    (a, b) => a.runwayDays - b.runwayDays
  )[0] || null;

  const highestConsumptionMaterial = [...reports].sort(
    (a, b) => b.dailyBurnRateKG - a.dailyBurnRateKG
  )[0] || null;

  return {
    totalMaterials: reports.length,
    materialsNeedingImmediateReorder: imminent.length + reorderNow.length,
    imminentStockoutsCount: imminent.length,
    approachingReorderCount: approaching.length,
    healthyCount: healthy.length,
    totalRecommendedReorderKG,
    totalDeficitKG,
    totalDailyPlantBurnRateKG,
    fastestDepletingMaterial,
    highestConsumptionMaterial,
  };
}
