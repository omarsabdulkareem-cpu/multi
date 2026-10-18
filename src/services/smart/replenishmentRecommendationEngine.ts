/**
 * REPLENISHMENT RECOMMENDATION ENGINE (PHASE 13)
 * Deterministic, policy-compliant replenishment calculator.
 * Clearly separates facts (stock, POs, reservations) from assumptions (lead time, burn rate).
 */

import { ReplenishmentRecommendation } from '../../types/smartOperations';
import { WarehouseEngineService } from '../warehouseEngineService';
import { BusinessEngineService } from '../businessEngineService';
import { AdvancedWarehouseService } from '../advancedWarehouseService';
import { SmartOperationsSettingsService } from './smartOperationsSettingsService';

export class ReplenishmentRecommendationEngine {
  /**
   * Generates replenishment recommendations for an organization
   */
  static generateRecommendations(orgId: string): ReplenishmentRecommendation[] {
    const items = WarehouseEngineService.getItems(orgId);
    const balances = WarehouseEngineService.computeInventoryBalances(orgId);
    const reservations = AdvancedWarehouseService.getReservations(orgId);
    const purchaseOrders = BusinessEngineService.getPurchaseOrders(orgId);
    const receipts = WarehouseEngineService.getReceipts(orgId);
    const suppliers = BusinessEngineService.getSuppliers(orgId);
    const ledger = WarehouseEngineService.getLedger(orgId);
    const settings = SmartOperationsSettingsService.getSettings(orgId);

    // Filter open purchase orders (Approved or Partially Received)
    const openOrders = purchaseOrders.filter(
      (po) => po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED'
    );

    // Pending draft receipts
    const draftReceipts = receipts.filter((r) => r.status === 'DRAFT');

    const recommendations: ReplenishmentRecommendation[] = [];

    // 30-day window for consumption calculation
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const recentIssues = ledger.filter(
      (tx) =>
        (tx.transactionType === 'ISSUE' || tx.transactionType === 'TRANSFER_OUT') &&
        tx.createdAt >= thirtyDaysAgo
    );

    for (const item of items) {
      if (item.status !== 'ACTIVE') continue;

      // 1. Current physical stock
      const itemBalances = balances.filter((b) => b.itemId === item.id);
      const totalPhysicalStock = itemBalances.reduce((sum, b) => sum + b.quantity, 0);

      // 2. Active reserved stock
      const itemReservations = reservations.filter(
        (r) => r.itemId === item.id && r.status === 'ACTIVE'
      );
      const totalReservedStock = itemReservations.reduce((sum, r) => sum + (r.quantity || 0), 0);

      const availableStock = Math.max(0, totalPhysicalStock - totalReservedStock);

      // 3. Incoming stock from open purchase orders
      let incomingFromPo = 0;
      for (const po of openOrders) {
        for (const line of (po.lines || [])) {
          if (line.itemId === item.id) {
            incomingFromPo += line.remainingQuantity || line.orderedQuantity - (line.receivedQuantity || 0);
          }
        }
      }

      // 4. Incoming stock from unconfirmed draft receipts
      let incomingFromDrafts = 0;
      for (const dr of draftReceipts) {
        for (const line of dr.items) {
          if (line.itemId === item.id) {
            incomingFromDrafts += line.quantity;
          }
        }
      }

      const totalIncoming = incomingFromPo + incomingFromDrafts;
      const effectivePosition = availableStock + totalIncoming;

      // 5. Thresholds from ItemMaster
      const minStock = item.minimumStock || 0;
      const reorderPoint = item.reorderPoint || minStock || 0;
      const maxStock = item.maximumStock || Math.max(reorderPoint * 2, 500);

      // 6. Recent burn rate
      const itemIssues = recentIssues.filter((tx) => tx.itemId === item.id);
      const totalConsumed30d = itemIssues.reduce((sum, tx) => sum + tx.quantity, 0);
      const dailyBurnRate = Number((totalConsumed30d / 30).toFixed(2));
      const runwayDays = dailyBurnRate > 0 ? Math.round(availableStock / dailyBurnRate) : 999;

      // Check if replenishment is needed
      const needsReplenishment =
        effectivePosition <= reorderPoint || (reorderPoint === 0 && effectivePosition <= minStock);

      if (needsReplenishment && (reorderPoint > 0 || minStock > 0 || maxStock > 0)) {
        // Suggested qty brings effective position up to Maximum Stock
        const targetCapacity = maxStock > reorderPoint ? maxStock : reorderPoint * 1.5;
        const suggestedQty = Math.max(0, Math.ceil(targetCapacity - effectivePosition));

        if (suggestedQty > 0) {
          // Identify matching supplier if known
          const matchingSupplier = suppliers.find(
            (s) =>
              s.materialTypesSupplied?.some(
                (m) =>
                  m.toLowerCase().includes(item.name.toLowerCase()) ||
                  item.name.toLowerCase().includes(m.toLowerCase())
              )
          );

          const priority: 'URGENT' | 'HIGH' | 'NORMAL' =
            availableStock <= minStock * 0.5
              ? 'URGENT'
              : availableStock <= minStock
              ? 'HIGH'
              : 'NORMAL';

          const leadTimeEst = matchingSupplier ? 7 : 14;

          const explanationEn = `Effective position (${effectivePosition.toLocaleString()} ${item.unitOfMeasure}) is at or below the reorder point of ${reorderPoint.toLocaleString()} ${item.unitOfMeasure}. Calculation: Suggested Qty = Max Stock (${targetCapacity.toLocaleString()}) - Effective Position (${effectivePosition.toLocaleString()}).`;
          const explanationAr = `الرصيد الفعلي المتاح والمجدول (${effectivePosition.toLocaleString()} ${item.unitOfMeasure}) وصل أو أقل من نقطة إعادة الطلب (${reorderPoint.toLocaleString()} ${item.unitOfMeasure}). الحساب: الكمية المقترحة = الحد الأقصى (${targetCapacity.toLocaleString()}) - الرصيد الفعلي (${effectivePosition.toLocaleString()}).`;

          const assumptionsEn = `Assumptions: Based on 30-day average daily consumption of ${dailyBurnRate} ${item.unitOfMeasure}/day and standard supplier lead time of ${leadTimeEst} days. Incoming stock includes ${incomingFromPo} from open POs and ${incomingFromDrafts} from draft receipts.`;
          const assumptionsAr = `الافتراضات: بناءً على متوسط الاستهلاك اليومي لآخر 30 يوماً البالغ ${dailyBurnRate} ${item.unitOfMeasure}/يوم وزمن توريد تقديري ${leadTimeEst} يوماً. تشمل الواردات ${incomingFromPo} من أوامر الشراء المفتوحة و${incomingFromDrafts} من مسودات الاستلام.`;

          recommendations.push({
            id: `REPL-${item.id}-${Date.now().toString().slice(-4)}`,
            organizationId: orgId,
            itemId: item.id,
            itemCode: item.itemCode,
            itemName: item.name,
            itemNameAr: item.nameAr,
            unit: item.unitOfMeasure,
            currentAvailableStock: availableStock,
            reservedStock: totalReservedStock,
            openPurchaseOrdersQty: incomingFromPo,
            pendingReceiptsQty: incomingFromDrafts,
            effectiveStockPosition: effectivePosition,
            minimumStock: minStock,
            reorderPoint: reorderPoint,
            maximumStock: maxStock,
            suggestedReplenishmentQty: suggestedQty,
            suggestedPriority: priority,
            supplierId: matchingSupplier?.id,
            supplierName: matchingSupplier?.supplierName,
            estimatedLeadTimeDays: leadTimeEst,
            dailyBurnRate,
            runwayDays,
            calculationExplanationEn: explanationEn,
            calculationExplanationAr: explanationAr,
            assumptionsEn: assumptionsEn,
            assumptionsAr: assumptionsAr,
            status: 'PENDING_REVIEW',
          });
        }
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2 };
      return priorityOrder[a.suggestedPriority] - priorityOrder[b.suggestedPriority];
    });
  }

  /**
   * Converts an authorized replenishment recommendation into a draft Purchase Request
   */
  static async convertToDraftPurchaseRequest(
    orgId: string,
    recommendation: ReplenishmentRecommendation,
    creatorUser: { id: string; name: string }
  ): Promise<{ prId: string; requestNumber: string }> {
    const pr = await BusinessEngineService.createPurchaseRequest(
      orgId,
      {
        requestedBy: creatorUser.name || 'Smart Operations Engine',
        department: 'Warehouse Management',
        requiredDate: new Date(Date.now() + (recommendation.estimatedLeadTimeDays || 7) * 86400000)
          .toISOString()
          .split('T')[0],
        priority: recommendation.suggestedPriority === 'URGENT' ? 'URGENT' : 'HIGH',
        reason: `Auto-replenishment recommendation for ${recommendation.itemCode} (Stock: ${recommendation.currentAvailableStock} ${recommendation.unit}, Below ROP: ${recommendation.reorderPoint})`,
        items: [
          {
            itemId: recommendation.itemId,
            itemCode: recommendation.itemCode,
            itemName: recommendation.itemName,
            requestedQuantity: recommendation.suggestedReplenishmentQty,
            unit: recommendation.unit as any,
            notes: recommendation.assumptionsEn,
          },
        ],
        notes: `Generated from Smart Replenishment Engine. Human approval required before PO issuance.`,
      },
      creatorUser.name || 'System'
    );

    return { prId: pr.id, requestNumber: pr.requestNumber };
  }
}
