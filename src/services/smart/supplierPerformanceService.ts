/**
 * SUPPLIER PERFORMANCE INSIGHTS SERVICE (PHASE 13)
 * Rigorous empirical analytics for supplier deliveries.
 * Explicitly flags insufficient data when observations are below minimum threshold.
 * Never fabricates ratings or delivery timestamps.
 */

import { SupplierPerformanceMetric } from '../../types/smartOperations';
import { BusinessEngineService } from '../businessEngineService';

export class SupplierPerformanceService {
  /**
   * Computes empirical performance metrics for suppliers of an organization
   */
  static getSupplierMetrics(orgId: string): SupplierPerformanceMetric[] {
    const suppliers = BusinessEngineService.getSuppliers(orgId);
    const purchaseOrders = BusinessEngineService.getPurchaseOrders(orgId);

    const metrics: SupplierPerformanceMetric[] = [];

    for (const supplier of suppliers) {
      const supplierOrders = purchaseOrders.filter((po) => po.supplierId === supplier.id);
      const observationsCount = supplierOrders.length;

      // Check if sufficient historical observations exist
      if (observationsCount < 2) {
        metrics.push({
          supplierId: supplier.id,
          supplierCode: supplier.supplierCode,
          supplierName: supplier.supplierName,
          organizationId: orgId,
          observationsCount,
          measurementPeriodDays: 90,
          hasSufficientData: false,
          reliabilityStatus: 'INSUFFICIENT_DATA',
          explanationEn: `Insufficient historical delivery data recorded to calculate reliable metrics (${observationsCount} order found; minimum 2 required). Metrics will populate automatically as additional purchase orders are completed.`,
          explanationAr: `بيانات التوريد التاريخية المسجلة غير كافية لحساب مؤشرات دقيقة (${observationsCount} طلب مسجل؛ الحد الأدنى 2). ستظهر الإحصائيات تلقائياً بمجرد إتمام أوامر شراء إضافية.`,
        });
        continue;
      }

      // Calculate empirical metrics from recorded orders
      let totalDeliveryDays = 0;
      let validDeliveryDayCount = 0;
      let onTimeOrdersCount = 0;
      let partialDeliveriesCount = 0;
      let completedOrdersCount = 0;
      let totalDiscrepancyQty = 0;
      let totalOrderedQty = 0;

      for (const po of supplierOrders) {
        // Completion rate
        if (po.status === 'RECEIVED' || po.status === 'CLOSED') {
          completedOrdersCount++;
        }

        // Partial delivery frequency
        if (po.status === 'PARTIALLY_RECEIVED') {
          partialDeliveriesCount++;
        }

        // Quantities comparison
        let poOrdered = 0;
        let poReceived = 0;
        for (const line of (po.lines || [])) {
          poOrdered += line.orderedQuantity || 0;
          poReceived += line.receivedQuantity || 0;
        }
        totalOrderedQty += poOrdered;
        totalDiscrepancyQty += Math.abs(poOrdered - poReceived);

        // Delivery time and on-time evaluation
        if (po.orderDate && po.updatedAt && (po.status === 'RECEIVED' || po.status === 'CLOSED')) {
          const orderTime = new Date(po.orderDate).getTime();
          const deliveryTime = new Date(po.updatedAt).getTime();
          const daysTaken = Math.max(0, Math.round((deliveryTime - orderTime) / 86400000));
          totalDeliveryDays += daysTaken;
          validDeliveryDayCount++;

          if (po.expectedDate) {
            const expectedTime = new Date(po.expectedDate).getTime();
            if (deliveryTime <= expectedTime + 86400000) {
              onTimeOrdersCount++;
            }
          }
        }
      }

      const avgDeliveryDays =
        validDeliveryDayCount > 0 ? Number((totalDeliveryDays / validDeliveryDayCount).toFixed(1)) : undefined;

      const onTimeRate =
        validDeliveryDayCount > 0 ? Number(((onTimeOrdersCount / validDeliveryDayCount) * 100).toFixed(1)) : undefined;

      const partialFreq = Number(((partialDeliveriesCount / observationsCount) * 100).toFixed(1));
      const completionRate = Number(((completedOrdersCount / observationsCount) * 100).toFixed(1));

      const discrepancyRate =
        totalOrderedQty > 0 ? Number(((totalDiscrepancyQty / totalOrderedQty) * 100).toFixed(1)) : 0;

      let reliabilityStatus: SupplierPerformanceMetric['reliabilityStatus'] = 'GOOD';
      if ((onTimeRate !== undefined && onTimeRate >= 90) || (avgDeliveryDays !== undefined && avgDeliveryDays <= 7)) {
        reliabilityStatus = 'EXCELLENT';
      } else if (onTimeRate !== undefined && onTimeRate < 70) {
        reliabilityStatus = 'NEEDS_ATTENTION';
      }

      const explanationEn = `Empirical metrics computed across ${observationsCount} recorded purchase orders. Average delivery: ${
        avgDeliveryDays !== undefined ? `${avgDeliveryDays} days` : 'Pending final receipt'
      }. On-time arrival rate: ${
        onTimeRate !== undefined ? `${onTimeRate}%` : 'N/A'
      }. PO fulfillment completion: ${completionRate}%. Recorded quantity variance: ${discrepancyRate}%.`;

      const explanationAr = `مؤشرات واقعية مستخلصة من ${observationsCount} أمر شراء مسجل. متوسط مدة التوريد: ${
        avgDeliveryDays !== undefined ? `${avgDeliveryDays} يوماً` : 'بانتظار اكتمال الاستلام'
      }. نسبة الالتزام بموعد التسليم: ${
        onTimeRate !== undefined ? `${onTimeRate}%` : 'غير محدد'
      }. نسبة إغلاق الأوامر: ${completionRate}%. نسبة تباين الكميات: ${discrepancyRate}%.`;

      metrics.push({
        supplierId: supplier.id,
        supplierCode: supplier.supplierCode,
        supplierName: supplier.supplierName,
        organizationId: orgId,
        observationsCount,
        measurementPeriodDays: 90,
        hasSufficientData: true,
        averageRecordedDeliveryDays: avgDeliveryDays,
        onTimeDeliveryRate: onTimeRate,
        partialDeliveryFrequency: partialFreq,
        poCompletionRate: completionRate,
        quantityDiscrepancyRate: discrepancyRate,
        reliabilityStatus,
        explanationEn,
        explanationAr,
      });
    }

    return metrics.sort((a, b) => (b.hasSufficientData ? 1 : 0) - (a.hasSufficientData ? 1 : 0));
  }
}
