/**
 * SMART WAREHOUSE INSIGHTS AGGREGATOR SERVICE (PHASE 13)
 * Synthesizes cross-module operational intelligence into actionable insight cards.
 * Explains facts vs estimates, links directly to records, and enforces strict tenant isolation.
 */

import { SmartInsightItem } from '../../types/smartOperations';
import { WarehouseEngineService } from '../warehouseEngineService';
import { BusinessEngineService } from '../businessEngineService';
import { ReplenishmentRecommendationEngine } from './replenishmentRecommendationEngine';
import { SlowMovingInventoryService } from './slowMovingInventoryService';
import { AnomalyDetectionService } from './anomalyDetectionService';
import { BatchIntelligenceService } from './batchIntelligenceService';
import { SupplierPerformanceService } from './supplierPerformanceService';

export class SmartInsightsService {
  /**
   * Aggregates all live insights for an organization
   */
  static generateInsights(orgId: string): SmartInsightItem[] {
    const insights: SmartInsightItem[] = [];
    const nowIso = new Date().toISOString();

    // 1. Items below minimum stock & approaching reorder points
    const recommendations = ReplenishmentRecommendationEngine.generateRecommendations(orgId);
    for (const rec of recommendations) {
      if (rec.currentAvailableStock <= rec.minimumStock && rec.minimumStock > 0) {
        insights.push({
          id: `INS-MIN-${rec.itemId}`,
          organizationId: orgId,
          type: 'LOW_STOCK',
          severity: 'CRITICAL',
          titleEn: `Critical Low Stock: ${rec.itemName} (${rec.itemCode})`,
          titleAr: `رصيد حرج منخفض: ${rec.itemNameAr || rec.itemName} (${rec.itemCode})`,
          explanationEn: `Current available stock (${rec.currentAvailableStock.toLocaleString()} ${rec.unit}) is below the mandatory safety minimum of ${rec.minimumStock.toLocaleString()} ${rec.unit}. Immediate replenishment required.`,
          explanationAr: `الرصيد الفعلي المتاح حالياً (${rec.currentAvailableStock.toLocaleString()} ${rec.unit}) أقل من الحد الأدنى للأمان (${rec.minimumStock.toLocaleString()} ${rec.unit}). يتطلب إعادة طلب فورية.`,
          affectedEntityType: 'ITEM',
          affectedEntityId: rec.itemId,
          affectedEntityCode: rec.itemCode,
          affectedEntityName: rec.itemName,
          metrics: {
            currentValue: rec.currentAvailableStock,
            thresholdValue: rec.minimumStock,
            difference: rec.minimumStock - rec.currentAvailableStock,
            unit: rec.unit,
          },
          factsVsEstimates: {
            factualBasis: `Physical ledger balance: ${rec.currentAvailableStock} ${rec.unit}. Minimum stock setting: ${rec.minimumStock} ${rec.unit}.`,
            isEstimated: false,
          },
          linkPage: 'materials_master',
          linkParams: { itemId: rec.itemId },
          createdAt: nowIso,
        });
      } else if (rec.effectiveStockPosition <= rec.reorderPoint && rec.reorderPoint > 0) {
        insights.push({
          id: `INS-ROP-${rec.itemId}`,
          organizationId: orgId,
          type: 'REORDER_APPROACHING',
          severity: 'WARNING',
          titleEn: `Reorder Threshold Reached: ${rec.itemName} (${rec.itemCode})`,
          titleAr: `تم بلوغ نقطة إعادة الطلب: ${rec.itemNameAr || rec.itemName} (${rec.itemCode})`,
          explanationEn: `Effective position (${rec.effectiveStockPosition.toLocaleString()} ${rec.unit}) has reached reorder point (${rec.reorderPoint.toLocaleString()} ${rec.unit}). Suggested order quantity: ${rec.suggestedReplenishmentQty.toLocaleString()} ${rec.unit}.`,
          explanationAr: `الرصيد الفعلي مع المفتوح (${rec.effectiveStockPosition.toLocaleString()} ${rec.unit}) بلغ نقطة إعادة الطلب (${rec.reorderPoint.toLocaleString()} ${rec.unit}). الكمية المقترحة للطلب: ${rec.suggestedReplenishmentQty.toLocaleString()} ${rec.unit}.`,
          affectedEntityType: 'ITEM',
          affectedEntityId: rec.itemId,
          affectedEntityCode: rec.itemCode,
          affectedEntityName: rec.itemName,
          metrics: {
            currentValue: rec.effectiveStockPosition,
            thresholdValue: rec.reorderPoint,
            difference: rec.suggestedReplenishmentQty,
            unit: rec.unit,
          },
          factsVsEstimates: {
            factualBasis: `Physical stock + incoming open POs: ${rec.effectiveStockPosition} ${rec.unit}. Reorder Point: ${rec.reorderPoint} ${rec.unit}.`,
            assumptions: `Suggested order based on bringing stock to maximum policy level.`,
            isEstimated: true,
          },
          linkPage: 'purchasing',
          linkParams: { itemId: rec.itemId },
          createdAt: nowIso,
        });
      }
    }

    // 2. Slow-Moving and Excess Stock
    const slowMoving = SlowMovingInventoryService.analyzeInventory(orgId);
    for (const sm of slowMoving) {
      if (sm.isExcessStock) {
        insights.push({
          id: `INS-EXCESS-${sm.itemId}`,
          organizationId: orgId,
          type: 'EXCESS_STOCK',
          severity: 'INFO',
          titleEn: `Potential Excess Stock: ${sm.itemName} (+${sm.excessQuantity.toLocaleString()} ${sm.unit})`,
          titleAr: `مخزون فائض محتمل: ${sm.itemNameAr || sm.itemName} (+${sm.excessQuantity.toLocaleString()} ${sm.unit})`,
          explanationEn: `Current on-hand inventory (${sm.currentStock.toLocaleString()} ${sm.unit}) exceeds standard policy threshold by ${sm.excessQuantity.toLocaleString()} ${sm.unit}. Capital tied up in inactive holding.`,
          explanationAr: `المخزون الحالي (${sm.currentStock.toLocaleString()} ${sm.unit}) يتجاوز الحد المعتمد بمقدار ${sm.excessQuantity.toLocaleString()} ${sm.unit}. يُوصى بجدولة استهلاك أو تخفيض التوريد القادم.`,
          affectedEntityType: 'ITEM',
          affectedEntityId: sm.itemId,
          affectedEntityCode: sm.itemCode,
          affectedEntityName: sm.itemName,
          metrics: {
            currentValue: sm.currentStock,
            thresholdValue: sm.policyMaximumStock,
            difference: sm.excessQuantity,
            unit: sm.unit,
          },
          factsVsEstimates: {
            factualBasis: `Physical stock: ${sm.currentStock} ${sm.unit}. Policy limit: ${sm.policyMaximumStock || 'Demand cover days'}.`,
            isEstimated: false,
          },
          linkPage: 'storage',
          linkParams: { itemId: sm.itemId },
          createdAt: nowIso,
        });
      }

      if (sm.classification === 'NO_RECENT_MOVEMENT' && sm.currentStock > 0) {
        insights.push({
          id: `INS-NOMOVE-${sm.itemId}`,
          organizationId: orgId,
          type: 'NO_RECENT_MOVEMENT',
          severity: 'INFO',
          titleEn: `Dormant Stock (No Movement in ${sm.analysisPeriodDays}d): ${sm.itemName}`,
          titleAr: `مخزون راكد (بدون حركة خلال ${sm.analysisPeriodDays} يوماً): ${sm.itemNameAr || sm.itemName}`,
          explanationEn: `Item ${sm.itemCode} has had zero issues or movements for ${sm.daysSinceLastMovement} days (${sm.currentStock.toLocaleString()} ${sm.unit} on hand). Review storage location condition.`,
          explanationAr: `الصنف ${sm.itemCode} لم تسجل له أي حركة صرف منذ ${sm.daysSinceLastMovement} يوماً (${sm.currentStock.toLocaleString()} ${sm.unit} في المستودع). يُوصى بتفقد موقع التخزين.`,
          affectedEntityType: 'ITEM',
          affectedEntityId: sm.itemId,
          affectedEntityCode: sm.itemCode,
          affectedEntityName: sm.itemName,
          metrics: {
            currentValue: sm.currentStock,
            thresholdValue: sm.daysSinceLastMovement,
            unit: sm.unit,
          },
          factsVsEstimates: {
            factualBasis: `Zero ledger transactions recorded between ${new Date(Date.now() - sm.analysisPeriodDays * 86400000).toISOString().split('T')[0]} and today.`,
            isEstimated: false,
          },
          linkPage: 'storage',
          linkParams: { itemId: sm.itemId },
          createdAt: nowIso,
        });
      }
    }

    // 3. Expiring and Expired Batches
    const { records: batchRecords } = BatchIntelligenceService.getBatchIntelligence(orgId);
    for (const b of batchRecords) {
      if (b.status === 'EXPIRED') {
        insights.push({
          id: `INS-BATCH-EXP-${b.batchId}`,
          organizationId: orgId,
          type: 'EXPIRED_BATCH',
          severity: 'CRITICAL',
          titleEn: `Expired Lot Detected: Batch ${b.batchNumber} (${b.itemCode})`,
          titleAr: `شحنة منتهية الصلاحية: الدفعة ${b.batchNumber} (${b.itemCode})`,
          explanationEn: `Lot ${b.batchNumber} of ${b.itemName} expired on ${b.expiryDate} (${b.currentQuantity.toLocaleString()} ${b.unit} located in ${b.warehouseName}). Automated issuance is blocked.`,
          explanationAr: `انتهت صلاحية الدفعة ${b.batchNumber} من الصنف ${b.itemName} بتاريخ ${b.expiryDate} (${b.currentQuantity.toLocaleString()} ${b.unit} في ${b.warehouseName}). النظام يمنع صرفها آلياً.`,
          affectedEntityType: 'BATCH',
          affectedEntityId: b.batchId,
          affectedEntityCode: b.batchNumber,
          affectedEntityName: b.itemName,
          warehouseId: b.warehouseId,
          warehouseName: b.warehouseName,
          metrics: {
            currentValue: b.currentQuantity,
            unit: b.unit,
          },
          factsVsEstimates: {
            factualBasis: `Expiry date timestamp: ${b.expiryDate}. Active balance: ${b.currentQuantity} ${b.unit}.`,
            isEstimated: false,
          },
          linkPage: 'advanced_warehouse',
          linkParams: { batchId: b.batchId },
          createdAt: nowIso,
        });
      } else if (b.status === 'EXPIRING_SOON') {
        insights.push({
          id: `INS-BATCH-EXP-SOON-${b.batchId}`,
          organizationId: orgId,
          type: 'EXPIRING_BATCH',
          severity: 'WARNING',
          titleEn: `Expiring Soon (${b.daysUntilExpiry}d left): Batch ${b.batchNumber}`,
          titleAr: `قريب الانتهاء (متبقي ${b.daysUntilExpiry} يوماً): الدفعة ${b.batchNumber}`,
          explanationEn: `Lot ${b.batchNumber} will expire in ${b.daysUntilExpiry} days (${b.currentQuantity.toLocaleString()} ${b.unit}). Ranked #1 FEFO priority for immediate production consumption.`,
          explanationAr: `تنتهي صلاحية الدفعة ${b.batchNumber} خلال ${b.daysUntilExpiry} يوماً (${b.currentQuantity.toLocaleString()} ${b.unit}). مصنفة كأولوية قصوى وفق معيار FEFO للصرف الفوري للإنتاج.`,
          affectedEntityType: 'BATCH',
          affectedEntityId: b.batchId,
          affectedEntityCode: b.batchNumber,
          affectedEntityName: b.itemName,
          warehouseId: b.warehouseId,
          warehouseName: b.warehouseName,
          metrics: {
            currentValue: b.currentQuantity,
            thresholdValue: b.daysUntilExpiry,
            unit: b.unit,
          },
          factsVsEstimates: {
            factualBasis: `Recorded expiry date: ${b.expiryDate}. Quantity: ${b.currentQuantity} ${b.unit}.`,
            assumptions: `Recommendation prioritizes consumption before expiry date.`,
            isEstimated: true,
          },
          linkPage: 'advanced_warehouse',
          linkParams: { batchId: b.batchId },
          createdAt: nowIso,
        });
      }
    }

    // 4. Unusual stock adjustments & Anomalies
    const anomalies = AnomalyDetectionService.scanForAnomalies(orgId);
    for (const anom of anomalies.slice(0, 5)) {
      insights.push({
        id: `INS-ANOM-${anom.id}`,
        organizationId: orgId,
        type: 'UNUSUAL_ADJUSTMENT',
        severity: anom.severity === 'HIGH' ? 'CRITICAL' : 'WARNING',
        titleEn: anom.titleEn,
        titleAr: anom.titleAr,
        explanationEn: anom.descriptionEn,
        explanationAr: anom.descriptionAr,
        affectedEntityType: anom.affectedEntityType as any,
        affectedEntityId: anom.affectedEntityId,
        affectedEntityCode: anom.affectedEntityCode,
        warehouseId: anom.warehouseId,
        metrics: {
          currentValue: typeof anom.observedValue === 'number' ? anom.observedValue : undefined,
        },
        factsVsEstimates: {
          factualBasis: `Observed value: ${anom.observedValue}. Configured threshold: ${anom.thresholdValue}.`,
          assumptions: `Statistical rule flagged pattern for human supervisor review.`,
          isEstimated: false,
        },
        linkPage: 'movement_ledger',
        linkParams: { entityId: anom.affectedEntityId },
        createdAt: anom.timestamp,
      });
    }

    // 5. Outstanding transfers in draft/transit
    const transfers = WarehouseEngineService.getTransfers(orgId);
    const pendingTransfers = transfers.filter((t) => t.status === 'DRAFT');
    for (const trf of pendingTransfers) {
      insights.push({
        id: `INS-TRF-${trf.id}`,
        organizationId: orgId,
        type: 'OUTSTANDING_TRANSFER',
        severity: 'INFO',
        titleEn: `Unconfirmed Stock Transfer: ${trf.transferNumber}`,
        titleAr: `تحويل مخزني غير مؤكد: ${trf.transferNumber}`,
        explanationEn: `Transfer ${trf.transferNumber} (${trf.items.length} line items) is currently in draft. Confirm receipt at destination facility to finalize inventory ledger.`,
        explanationAr: `المناقلة ${trf.transferNumber} (${trf.items.length} بنود) لا تزال مسودة. يجب تأكيد استلامها في المستودع الوجهة لإتمام القيد المخزني.`,
        affectedEntityType: 'TRANSFER',
        affectedEntityId: trf.id,
        affectedEntityCode: trf.transferNumber,
        warehouseId: trf.sourceWarehouseId,
        metrics: {
          currentValue: trf.items.reduce((s, it) => s + it.quantity, 0),
        },
        factsVsEstimates: {
          factualBasis: `Transfer document status is DRAFT. Items not yet credited to destination warehouse.`,
          isEstimated: false,
        },
        linkPage: 'warehouse_operations',
        linkParams: { transferId: trf.id },
        createdAt: trf.createdAt,
      });
    }

    // 6. Pending approvals (Purchase requests / Purchase orders)
    const purchaseRequests = BusinessEngineService.getPurchaseRequests(orgId);
    const pendingPrs = purchaseRequests.filter((pr) => pr.status === 'SUBMITTED');
    for (const pr of pendingPrs) {
      insights.push({
        id: `INS-APR-PR-${pr.id}`,
        organizationId: orgId,
        type: 'PENDING_APPROVAL',
        severity: pr.priority === 'URGENT' ? 'CRITICAL' : 'WARNING',
        titleEn: `Purchase Request Awaiting Approval: ${pr.requestNumber}`,
        titleAr: `طلب شراء بانتظار الاعتماد: ${pr.requestNumber}`,
        explanationEn: `PR ${pr.requestNumber} submitted by ${pr.requestedBy} (${pr.items.length} items, priority: ${pr.priority}) is awaiting supervisor sign-off.`,
        explanationAr: `طلب الشراء ${pr.requestNumber} المقدم من ${pr.requestedBy} (${pr.items.length} صنفاً، أولوية: ${pr.priority}) بانتظار اعتماد الإدارة.`,
        affectedEntityType: 'DOCUMENT',
        affectedEntityId: pr.id,
        affectedEntityCode: pr.requestNumber,
        metrics: {
          currentValue: pr.items.reduce((s, it) => s + it.requestedQuantity, 0),
        },
        factsVsEstimates: {
          factualBasis: `Document status is SUBMITTED.`,
          isEstimated: false,
        },
        linkPage: 'purchasing',
        linkParams: { prId: pr.id },
        createdAt: pr.createdAt,
      });
    }

    // 7. Supplier Delivery Patterns
    const supplierMetrics = SupplierPerformanceService.getSupplierMetrics(orgId);
    for (const sm of supplierMetrics) {
      if (sm.hasSufficientData && sm.onTimeDeliveryRate !== undefined && sm.onTimeDeliveryRate < 70) {
        insights.push({
          id: `INS-SUPP-DELAY-${sm.supplierId}`,
          organizationId: orgId,
          type: 'SUPPLIER_PATTERN',
          severity: 'WARNING',
          titleEn: `Suboptimal Delivery Reliability: ${sm.supplierName}`,
          titleAr: `انخفاض نسبة الالتزام بالتوريد: ${sm.supplierName}`,
          explanationEn: `Supplier ${sm.supplierName} achieved an on-time delivery rate of only ${sm.onTimeDeliveryRate}% across ${sm.observationsCount} completed orders. Lead time buffer increase recommended.`,
          explanationAr: `المورد ${sm.supplierName} حقق نسبة تسليم في الموعد بلغت ${sm.onTimeDeliveryRate}% فقط عبر ${sm.observationsCount} طلبات مكتملة. يوصى بزيادة هامش زمن التوريد.`,
          affectedEntityType: 'SUPPLIER',
          affectedEntityId: sm.supplierId,
          affectedEntityCode: sm.supplierCode,
          affectedEntityName: sm.supplierName,
          metrics: {
            currentValue: sm.onTimeDeliveryRate,
            thresholdValue: 80,
            unit: '%',
          },
          factsVsEstimates: {
            factualBasis: `Computed from ${sm.observationsCount} recorded purchase orders.`,
            assumptions: `Recommends lead time adjustment based on historical variance.`,
            isEstimated: true,
          },
          linkPage: 'suppliers',
          linkParams: { supplierId: sm.supplierId },
          createdAt: nowIso,
        });
      }
    }

    return insights.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}
