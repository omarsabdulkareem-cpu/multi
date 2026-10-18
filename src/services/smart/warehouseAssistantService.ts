/**
 * NATURAL-LANGUAGE WAREHOUSE ASSISTANT SERVICE (PHASE 13)
 * Deterministic query dispatcher for operational warehouse questions.
 * Functions 100% offline without external AI keys, never fabricates quantities,
 * and enforces safe 2-step confirmations for proposed actions.
 */

import { WarehouseEngineService } from '../warehouseEngineService';
import { BusinessEngineService } from '../businessEngineService';
import { AdvancedWarehouseService } from '../advancedWarehouseService';
import { ReplenishmentRecommendationEngine } from './replenishmentRecommendationEngine';
import { BatchIntelligenceService } from './batchIntelligenceService';
import { ProposedAssistantAction } from '../../types/smartOperations';

export interface AssistantAnswer {
  textEn: string;
  textAr: string;
  dataSummaryTable?: { headers: string[]; rows: string[][] };
  context: {
    warehouseContext?: string;
    dateRangeContext?: string;
    organizationId: string;
  };
  proposedAction?: ProposedAssistantAction;
}

export class WarehouseAssistantService {
  /**
   * Deterministic query responder for warehouse inquiries
   */
  static answerQuery(orgId: string, rawQuery: string): AssistantAnswer {
    const q = rawQuery.toLowerCase().trim();
    const today = new Date().toISOString().split('T')[0];
    const defaultContext = {
      organizationId: orgId,
      dateRangeContext: `Snapshot as of ${today}`,
      warehouseContext: 'All Facilities in Tenant Scope',
    };

    // 1. Items below reorder point / low stock
    if (
      q.includes('reorder') ||
      q.includes('low stock') ||
      q.includes('below') ||
      q.includes('نقص') ||
      q.includes('إعادة طلب') ||
      q.includes('منخفض')
    ) {
      const recs = ReplenishmentRecommendationEngine.generateRecommendations(orgId);
      if (recs.length === 0) {
        return {
          textEn: `All active items are currently at or above their configured reorder points and safety stock levels. Zero items require urgent replenishment.`,
          textAr: `جميع الأصناف النشطة تقع حالياً عند أو أعلى من نقاط إعادة الطلب وحدود الأمان المعتمدة. لا توجد أصناف تتطلب إعادة طلب فورية.`,
          context: defaultContext,
        };
      }

      const rows = recs.slice(0, 10).map((r) => [
        r.itemCode,
        r.itemName,
        `${r.currentAvailableStock.toLocaleString()} ${r.unit}`,
        `${r.reorderPoint.toLocaleString()} ${r.unit}`,
        `${r.suggestedReplenishmentQty.toLocaleString()} ${r.unit}`,
        r.suggestedPriority,
      ]);

      return {
        textEn: `Identified ${recs.length} item(s) currently at or below their configured reorder thresholds. The top urgent items are listed below.`,
        textAr: `تم رصد ${recs.length} صنفاً حالياً عند أو دون نقاط إعادة الطلب المعتمدة. الأصناف الأكثر إلحاحاً معروضة أدناه.`,
        dataSummaryTable: {
          headers: ['Item Code', 'Item Name', 'Current Stock', 'Reorder Point', 'Suggested Qty', 'Priority'],
          rows,
        },
        context: defaultContext,
        proposedAction: {
          actionType: 'DRAFT_PURCHASE_REQUEST',
          titleEn: `Draft Purchase Request for ${recs[0]?.itemCode || 'Low Stock Materials'}`,
          titleAr: `إنشاء مسودة طلب شراء للصنف ${recs[0]?.itemCode || 'المواد المنخفضة'}`,
          affectedRecordsSummary: `${recs.length} item(s) below reorder point`,
          quantities: `${recs[0]?.suggestedReplenishmentQty.toLocaleString()} ${recs[0]?.unit}`,
          consequencesEn: 'Will create an unapproved draft Purchase Request in Business Management. Does NOT place or commit external purchase orders.',
          consequencesAr: 'سيتم إنشاء مسودة طلب شراء غير معتمدة في إدارة المشتريات. لا يتم تأكيد أي أمر شراء خارجي دون موافقة المشرف.',
          payload: { recommendation: recs[0] },
        },
      };
    }

    // 2. Stock available in warehouse(s)
    if (
      q.includes('available') ||
      q.includes('stock') ||
      q.includes('on hand') ||
      q.includes('رصيد') ||
      q.includes('مخزون') ||
      q.includes('متاح')
    ) {
      const balances = WarehouseEngineService.computeInventoryBalances(orgId);
      const items = WarehouseEngineService.getItems(orgId);
      const warehouses = WarehouseEngineService.getWarehouses(orgId);

      const rows = balances.slice(0, 12).map((b) => {
        const item = items.find((i) => i.id === b.itemId);
        const wh = warehouses.find((w) => w.id === b.warehouseId);
        return [
          wh?.name || b.warehouseCode || 'Main WH',
          b.itemCode,
          b.itemName,
          `${b.quantity.toLocaleString()} ${b.unit}`,
        ];
      });

      return {
        textEn: `Current inventory on hand across all active facilities comprises ${balances.length} stocked SKU locations. Sample stock positions:`,
        textAr: `المخزون الحالي المتاح عبر كافة المستودعات النشطة يضم ${balances.length} موقع تخزين برصيد فعلي. عينة من الأرصدة الحالية:`,
        dataSummaryTable: {
          headers: ['Warehouse', 'Item Code', 'Item Name', 'Available Balance'],
          rows,
        },
        context: defaultContext,
      };
    }

    // 3. Batches expiring this month / expired
    if (
      q.includes('expir') ||
      q.includes('batch') ||
      q.includes('lot') ||
      q.includes('صلاحية') ||
      q.includes('دفعة') ||
      q.includes('تشغيلة')
    ) {
      const { records } = BatchIntelligenceService.getBatchIntelligence(orgId);
      const expiringOrExpired = records.filter(
        (b) => b.status === 'EXPIRED' || b.status === 'EXPIRING_SOON'
      );

      if (expiringOrExpired.length === 0) {
        return {
          textEn: `No batches are currently expired or expiring within the 30-day monitoring window. All tracked inventory lots are within safe shelf life.`,
          textAr: `لا توجد شحنات منتهية الصلاحية أو تقترب من الانتهاء خلال نافذة المراقبة (30 يوماً). كافة الدفعات صالحة للاستخدام.`,
          context: defaultContext,
        };
      }

      const rows = expiringOrExpired.slice(0, 10).map((b) => [
        b.batchNumber,
        b.itemCode,
        b.warehouseName,
        `${b.currentQuantity.toLocaleString()} ${b.unit}`,
        b.expiryDate,
        b.status,
      ]);

      return {
        textEn: `Found ${expiringOrExpired.length} tracked batch(es) flagged for shelf life review (FEFO picking priority):`,
        textAr: `تم العثور على ${expiringOrExpired.length} شحنة تتطلب المراجعة الفورية للصلاحية وترتيب الأولويات وفق FEFO:`,
        dataSummaryTable: {
          headers: ['Batch Number', 'SKU', 'Warehouse', 'Quantity', 'Expiry Date', 'Status'],
          rows,
        },
        context: defaultContext,
      };
    }

    // 4. Receipts received recently / yesterday
    if (
      q.includes('received') ||
      q.includes('receipt') ||
      q.includes('yesterday') ||
      q.includes('inbound') ||
      q.includes('استلام') ||
      q.includes('وارد')
    ) {
      const receipts = WarehouseEngineService.getReceipts(orgId);
      const confirmed = receipts.filter((r) => r.status !== 'CANCELLED');

      const rows = confirmed.slice(0, 8).map((r) => [
        r.documentNumber,
        r.supplierName || 'Internal',
        r.date,
        `${r.items.reduce((s, it) => s + it.quantity, 0).toLocaleString()} KG`,
        r.status === 'DRAFT' ? 'DRAFT' : 'CONFIRMED',
      ]);

      return {
        textEn: `Recorded ${confirmed.length} goods receipt notes in the organization's logistics ledger. Latest receipts:`,
        textAr: `تم تسجيل ${confirmed.length} سند استلام بضاعة في سجل المنشأة. أحدث الاستلامات المسجلة:`,
        dataSummaryTable: {
          headers: ['Document Number', 'Supplier', 'Date', 'Total Quantity', 'Status'],
          rows,
        },
        context: {
          organizationId: orgId,
          dateRangeContext: 'Latest Goods Receipts History',
          warehouseContext: 'Inbound Receiving Docks',
        },
      };
    }

    // 5. Outstanding purchase orders
    if (
      q.includes('purchase order') ||
      q.includes('po') ||
      q.includes('outstanding') ||
      q.includes('أوامر شراء') ||
      q.includes('مشتريات') ||
      q.includes('طلب شراء')
    ) {
      const pos = BusinessEngineService.getPurchaseOrders(orgId);
      const open = pos.filter((p) => p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED');

      if (open.length === 0) {
        return {
          textEn: `Zero outstanding purchase orders pending delivery. All past orders are either fulfilled, closed, or in draft status.`,
          textAr: `لا توجد أوامر شراء مفتوحة بانتظار التوريد حالياً. كافة الأوامر السابقة تم استلامها بالكامل أو مغلقة.`,
          context: defaultContext,
        };
      }

      const rows = open.slice(0, 8).map((p) => [
        p.documentNumber,
        p.supplierName,
        p.orderDate,
        p.expectedDate || 'Open',
        `${(p.lines || []).reduce((s, it) => s + it.orderedQuantity, 0).toLocaleString()} Units`,
        p.status,
      ]);

      return {
        textEn: `Found ${open.length} open purchase order(s) awaiting delivery or partial receipt:`,
        textAr: `تم العثور على ${open.length} أمر شراء مفتوح بانتظار التوريد أو الاستلام الجزئي:`,
        dataSummaryTable: {
          headers: ['PO Number', 'Supplier', 'Order Date', 'Expected Date', 'Ordered Qty', 'Status'],
          rows,
        },
        context: defaultContext,
      };
    }

    // 6. Stock variance / discrepancies
    if (
      q.includes('variance') ||
      q.includes('discrepan') ||
      q.includes('count') ||
      q.includes('فارق') ||
      q.includes('جرد') ||
      q.includes('عجز') ||
      q.includes('زيادة')
    ) {
      const stocktakes = WarehouseEngineService.getStockCounts(orgId);
      const lines: { docNo: string; code: string; variance: number; unit: string }[] = [];

      for (const st of stocktakes) {
        for (const it of st.items) {
          if (it.varianceQuantity !== 0) {
            lines.push({
              docNo: st.countNumber,
              code: it.itemCode,
              variance: it.varianceQuantity,
              unit: it.unit,
            });
          }
        }
      }

      if (lines.length === 0) {
        return {
          textEn: `All posted cycle counts and stocktakes in this organization have zero variances. Physical counts match ledger records 100%.`,
          textAr: `كافة عمليات الجرد المسجلة في هذه المنشأة متطابقة 100% مع السجلات المخزنية بدون أي فروقات.`,
          context: defaultContext,
        };
      }

      const rows = lines.slice(0, 8).map((l) => [
        l.docNo,
        l.code,
        `${l.variance > 0 ? '+' : ''}${l.variance.toLocaleString()} ${l.unit}`,
      ]);

      return {
        textEn: `Physical stocktake discrepancies recorded in the audit subledger:`,
        textAr: `فروقات الجرد الفعلي المسجلة في سجلات التدقيق المخزني:`,
        dataSummaryTable: {
          headers: ['Count Document', 'Item Code', 'Recorded Variance'],
          rows,
        },
        context: defaultContext,
      };
    }

    // Default fallback guidance
    return {
      textEn: `I can answer queries grounded in real tenant data. Try asking:\n• "Which items are below reorder point?"\n• "What stock is available in this warehouse?"\n• "Which batches expire this month?"\n• "What was received yesterday?"\n• "Which purchase orders are still outstanding?"\n• "Which items had the largest stock variance?"`,
      textAr: `يمكنني الإجابة بدقة بالاستناد إلى بيانات المنشأة الفعلية. يمكنك طرح الأسئلة التالية:\n• "ما هي الأصناف التي هبطت دون نقطة إعادة الطلب؟"\n• "ما هو الرصيد المتاح في المستودعات؟"\n• "ما هي الشحنات التي تنتهي صلاحيتها قريباً؟"\n• "ما هي البضائع المستلمة مؤخراً؟"\n• "ما هي أوامر الشراء المفتوحة والمعلقة؟"\n• "ما هي فروقات الجرد المسجلة؟"`,
      context: defaultContext,
    };
  }
}
