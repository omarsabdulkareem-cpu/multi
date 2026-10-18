/**
 * SLOW-MOVING & EXCESS INVENTORY ENGINE (PHASE 13)
 * Analyzes velocity, movement turnover, and policy-based excess inventory.
 * Strictly separates factual non-movement from obsolescence judgements.
 */

import { SlowMovingAnalysisItem, SlowMovingClassification } from '../../types/smartOperations';
import { WarehouseEngineService } from '../warehouseEngineService';
import { SmartOperationsSettingsService } from './smartOperationsSettingsService';

export interface SlowMovingFilterOptions {
  warehouseId?: string;
  category?: string;
  itemId?: string;
  periodDays?: 30 | 60 | 90 | 180;
}

export class SlowMovingInventoryService {
  /**
   * Analyzes all active inventory items for slow movement and excess quantities
   */
  static analyzeInventory(
    orgId: string,
    filters?: SlowMovingFilterOptions
  ): SlowMovingAnalysisItem[] {
    const settings = SmartOperationsSettingsService.getSettings(orgId);
    const periodDays = filters?.periodDays || settings.slowMovingDaysPeriod || 60;
    const items = WarehouseEngineService.getItems(orgId);
    const balances = WarehouseEngineService.computeInventoryBalances(orgId);
    const ledger = WarehouseEngineService.getLedger(orgId);

    const cutoffDate = new Date(Date.now() - periodDays * 86400000).toISOString();

    const results: SlowMovingAnalysisItem[] = [];

    for (const item of items) {
      if (item.status !== 'ACTIVE') continue;

      // Category filter
      if (filters?.category && item.category !== filters.category) continue;
      // Item filter
      if (filters?.itemId && item.id !== filters.itemId) continue;

      // Balances for this item
      let itemBalances = balances.filter((b) => b.itemId === item.id);
      if (filters?.warehouseId) {
        itemBalances = itemBalances.filter((b) => b.warehouseId === filters.warehouseId);
      }

      const currentStock = itemBalances.reduce((sum, b) => sum + b.quantity, 0);

      // Ledger transactions for this item
      let itemLedger = ledger.filter((tx) => tx.itemId === item.id);
      if (filters?.warehouseId) {
        itemLedger = itemLedger.filter(
          (tx) => tx.warehouseId === filters.warehouseId || tx.sourceWarehouseId === filters.warehouseId
        );
      }

      // Sort chronological descending
      const sortedTxs = [...itemLedger].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const lastMovement = sortedTxs[0];
      const lastMovementDate = lastMovement?.createdAt;

      const daysSinceLastMovement = lastMovementDate
        ? Math.max(0, Math.floor((Date.now() - new Date(lastMovementDate).getTime()) / 86400000))
        : 999;

      // Transactions in the evaluation period
      const periodTxs = itemLedger.filter((tx) => tx.createdAt >= cutoffDate);
      const consumptionTxs = periodTxs.filter(
        (tx) => tx.transactionType === 'ISSUE' || tx.transactionType === 'TRANSFER_OUT'
      );
      const totalConsumed = consumptionTxs.reduce((sum, tx) => sum + tx.quantity, 0);

      // Turnover ratio: Consumed in period / Current Stock
      const turnoverRatio = currentStock > 0 ? Number((totalConsumed / currentStock).toFixed(3)) : 0;

      // Classification
      let classification: SlowMovingClassification;
      if (consumptionTxs.length === 0 && daysSinceLastMovement >= periodDays) {
        classification = 'NO_RECENT_MOVEMENT';
      } else if (turnoverRatio < 0.25) {
        classification = 'SLOW_MOVING';
      } else if (turnoverRatio >= 1.5) {
        classification = 'FAST_MOVING';
      } else {
        classification = 'NORMAL';
      }

      // Excess stock calculation:
      // Identified only when suitable policy exists:
      // 1) Explicit maximumStock exceeded OR
      // 2) Current stock exceeds configured months/days of consumption
      const policyMax = item.maximumStock || 0;
      let isExcess = false;
      let excessQty = 0;

      if (policyMax > 0 && currentStock > policyMax) {
        isExcess = true;
        excessQty = currentStock - policyMax;
      } else if (totalConsumed > 0) {
        const dailyDemand = totalConsumed / periodDays;
        const maxDemandCoverDays = settings.excessStockDaysThreshold || 90;
        const reasonableStockLimit = dailyDemand * maxDemandCoverDays;
        if (currentStock > reasonableStockLimit && currentStock > 100) {
          isExcess = true;
          excessQty = Math.round(currentStock - reasonableStockLimit);
        }
      }

      const methodExplanationEn = `Evaluated over ${periodDays} days. Total consumption: ${totalConsumed.toLocaleString()} ${item.unitOfMeasure} (${consumptionTxs.length} issue movements). Turnover ratio: ${turnoverRatio}. Days dormant: ${daysSinceLastMovement}. Method: Velocity analysis compared against policy maximum and ${periodDays}-day historical burn rate. Note: Lack of movement reflects current demand pattern, not material obsolescence.`;
      const methodExplanationAr = `تم التقييم على مدار ${periodDays} يوماً. إجمالي الاستهلاك: ${totalConsumed.toLocaleString()} ${item.unitOfMeasure} (${consumptionTxs.length} حركة صرف). معدل الدوران: ${turnoverRatio}. أيام بدون حركة: ${daysSinceLastMovement}. المنهجية: تحليل السرعة ومقارنتها بالحد الأقصى المعتمد ومتوسط السحب. ملاحظة: عدم الحركة يعكس نمط الطلب الحالي ولا يعني تلقائياً تلف المادة أو تقادمها.`;

      results.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.name,
        itemNameAr: item.nameAr,
        category: item.category,
        warehouseId: filters?.warehouseId,
        currentStock,
        unit: item.unitOfMeasure,
        analysisPeriodDays: periodDays,
        totalConsumedInPeriod: totalConsumed,
        transactionCountInPeriod: periodTxs.length,
        daysSinceLastMovement,
        lastMovementDate,
        turnoverRatio,
        classification,
        isExcessStock: isExcess,
        excessQuantity: excessQty,
        policyMaximumStock: policyMax,
        methodExplanationEn,
        methodExplanationAr,
      });
    }

    return results.sort((a, b) => {
      // Prioritize excess stock and no movement
      if (a.isExcessStock !== b.isExcessStock) return a.isExcessStock ? -1 : 1;
      return a.turnoverRatio - b.turnoverRatio;
    });
  }
}
