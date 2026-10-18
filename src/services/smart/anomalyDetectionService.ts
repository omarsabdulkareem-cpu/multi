/**
 * ANOMALY & UNUSUAL TRANSACTION DETECTION ENGINE (PHASE 13)
 * Rules-based anomaly detector with configurable thresholds.
 * Uses strictly neutral, objective wording for operational review.
 */

import { AnomalyDetectionAlert, AnomalyCategory } from '../../types/smartOperations';
import { WarehouseEngineService } from '../warehouseEngineService';
import { SmartOperationsSettingsService } from './smartOperationsSettingsService';

const STORAGE_KEY_ANOMALY_STATUSES = 'alkarwan_saas_anomaly_statuses_v1';

export class AnomalyDetectionService {
  private static getStoredStatuses(): Record<string, { status: string; notes?: string; reviewedBy?: string; reviewedAt?: string }> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ANOMALY_STATUSES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  private static saveStatuses(data: Record<string, any>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_ANOMALY_STATUSES, JSON.stringify(data));
    } catch {}
  }

  /**
   * Detects unusual transaction patterns across the organization's ledgers and documents
   */
  static scanForAnomalies(orgId: string): AnomalyDetectionAlert[] {
    const settings = SmartOperationsSettingsService.getSettings(orgId);
    const ledger = WarehouseEngineService.getLedger(orgId);
    const adjustments = WarehouseEngineService.getAdjustments(orgId);
    const receipts = WarehouseEngineService.getReceipts(orgId);
    const issues = WarehouseEngineService.getIssues(orgId);
    const stocktakes = WarehouseEngineService.getStockCounts(orgId);
    const items = WarehouseEngineService.getItems(orgId);
    const storedStatuses = this.getStoredStatuses();

    const alerts: AnomalyDetectionAlert[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    // 1. Repeated adjustments for the same item (within 7 days)
    const itemAdjustmentsMap: Record<string, typeof adjustments> = {};
    for (const adj of adjustments) {
      if (adj.createdAt >= sevenDaysAgo && adj.status !== 'CANCELLED') {
        itemAdjustmentsMap[adj.itemId] = itemAdjustmentsMap[adj.itemId] || [];
        itemAdjustmentsMap[adj.itemId].push(adj);
      }
    }

    const maxAdjAllowed = settings.anomalyMaxAdjustmentsPerWeek || 3;
    for (const [itemId, adjs] of Object.entries(itemAdjustmentsMap)) {
      if (adjs.length > maxAdjAllowed) {
        const item = items.find((i) => i.id === itemId);
        const alertId = `ANOM-ADJ-${itemId}-${adjs.length}`;
        const stored = storedStatuses[alertId];

        alerts.push({
          id: alertId,
          organizationId: orgId,
          category: 'REPEATED_ADJUSTMENTS',
          severity: 'MEDIUM',
          titleEn: `Frequent Stock Adjustments for ${item?.itemCode || itemId}`,
          titleAr: `تسويات مخزنية متكررة للصنف ${item?.nameAr || item?.itemCode || itemId}`,
          descriptionEn: `Item ${item?.itemCode || itemId} underwent ${adjs.length} manual adjustments in the past 7 days (Threshold: ${maxAdjAllowed}). Human supervisor review recommended to verify root cause (e.g. calibration or tally variances).`,
          descriptionAr: `خضع الصنف ${item?.nameAr || item?.itemCode || itemId} لـ ${adjs.length} تسوية يدوية خلال آخر 7 أيام (الحد المعتمد: ${maxAdjAllowed}). يوصى بمراجعة المشرف للتحقق من السبب الفني (مثل معايرة الميزان أو فروقات العد).`,
          observedValue: `${adjs.length} adjustments`,
          thresholdValue: `${maxAdjAllowed} adjustments`,
          affectedEntityType: 'ITEM',
          affectedEntityId: itemId,
          affectedEntityCode: item?.itemCode,
          timestamp: adjs[adjs.length - 1].createdAt,
          requiresReview: true,
          status: (stored?.status as any) || 'OPEN',
          reviewedBy: stored?.reviewedBy,
          reviewedAt: stored?.reviewedAt,
          reviewNotes: stored?.notes,
        });
      }
    }

    // 2. Unusually large issues (exceeding multiplier * mean issue or single large volume)
    const issueTxs = ledger.filter((tx) => tx.transactionType === 'ISSUE');
    if (issueTxs.length > 3) {
      const avgIssue = issueTxs.reduce((sum, tx) => sum + tx.quantity, 0) / issueTxs.length;
      const multiplier = settings.anomalyLargeIssueMultiplier || 3.0;
      const largeThreshold = avgIssue * multiplier;

      for (const tx of issueTxs.slice(-20)) {
        if (tx.quantity > largeThreshold && tx.quantity > 500) {
          const alertId = `ANOM-LARGE-ISSUE-${tx.id}`;
          const stored = storedStatuses[alertId];

          alerts.push({
            id: alertId,
            organizationId: orgId,
            category: 'UNUSUALLY_LARGE_ISSUE',
            severity: 'HIGH',
            titleEn: `Unusually Large Stock Issue: ${tx.quantity.toLocaleString()} ${tx.unit}`,
            titleAr: `حركة صرف استثنائية الحجم: ${tx.quantity.toLocaleString()} ${tx.unit}`,
            descriptionEn: `Transaction ${tx.transactionId || tx.id} issued ${tx.quantity.toLocaleString()} ${tx.unit} of ${tx.itemCode}, which exceeds ${multiplier}x the historical average issue size (${Math.round(avgIssue).toLocaleString()} ${tx.unit}). Flagged for standard dispatch review.`,
            descriptionAr: `سجلت الحركة ${tx.transactionId || tx.id} صرف كمية ${tx.quantity.toLocaleString()} ${tx.unit} من ${tx.itemCode}، وهو ما يتجاوز ${multiplier} أضعاف متوسط حركات الصرف التاريخية (${Math.round(avgIssue).toLocaleString()} ${tx.unit}). مطلوب التحقق الروتيني من أمر التشغيل.`,
            observedValue: `${tx.quantity} ${tx.unit}`,
            thresholdValue: `${Math.round(largeThreshold)} ${tx.unit}`,
            affectedEntityType: 'TRANSACTION',
            affectedEntityId: tx.id,
            affectedEntityCode: tx.itemCode,
            warehouseId: tx.warehouseId,
            timestamp: tx.createdAt,
            requiresReview: true,
            status: (stored?.status as any) || 'OPEN',
            reviewedBy: stored?.reviewedBy,
            reviewedAt: stored?.reviewedAt,
            reviewNotes: stored?.notes,
          });
        }
      }
    }

    // 3. Repeated transaction cancellations within 48 hours
    const cancelledReceipts = receipts.filter(
      (r) => r.status === 'CANCELLED' && r.cancelledAt && r.cancelledAt >= fortyEightHoursAgo
    );
    const cancelledIssues = issues.filter(
      (i) => i.status === 'CANCELLED' && i.cancelledAt && i.cancelledAt >= fortyEightHoursAgo
    );
    const totalCancelledRecent = cancelledReceipts.length + cancelledIssues.length;

    if (totalCancelledRecent >= 2) {
      const alertId = `ANOM-CANCEL-BURST-${totalCancelledRecent}`;
      const stored = storedStatuses[alertId];

      alerts.push({
        id: alertId,
        organizationId: orgId,
        category: 'REPEATED_CANCELLATIONS',
        severity: 'MEDIUM',
        titleEn: `Consecutive Document Cancellations (${totalCancelledRecent} in 48h)`,
        titleAr: `إلغاءات مستندية متتالية (${totalCancelledRecent} خلال 48 ساعة)`,
        descriptionEn: `${totalCancelledRecent} warehouse documents (receipts/issues) were cancelled recently. Reviewing data entry workflows or scale connectivity is advised.`,
        descriptionAr: `تم إلغاء ${totalCancelledRecent} مستندات مخزنية مؤخراً. يوصى بمراجعة مسار إدخال البيانات أو اتصال القبان للتحقق من دقة التوثيق.`,
        observedValue: `${totalCancelledRecent} cancelled`,
        thresholdValue: '2 in 48 hours',
        affectedEntityType: 'DOCUMENT',
        affectedEntityId: cancelledReceipts[0]?.id || cancelledIssues[0]?.id || 'MULTI',
        timestamp: new Date().toISOString(),
        requiresReview: true,
        status: (stored?.status as any) || 'OPEN',
        reviewedBy: stored?.reviewedBy,
        reviewedAt: stored?.reviewedAt,
        reviewNotes: stored?.notes,
      });
    }

    // 4. Duplicate-looking documents (same supplier, matching items and weights within 24 hours)
    for (let i = 0; i < receipts.length; i++) {
      for (let j = i + 1; j < receipts.length; j++) {
        const r1 = receipts[i];
        const r2 = receipts[j];
        if (
          r1.status !== 'CANCELLED' &&
          r2.status !== 'CANCELLED' &&
          r1.supplierName &&
          r1.supplierName === r2.supplierName &&
          r1.date === r2.date &&
          r1.items.length === r2.items.length &&
          r1.id !== r2.id
        ) {
          const matchItems = r1.items.every((it1, idx) => {
            const it2 = r2.items[idx];
            return it2 && it1.itemId === it2.itemId && it1.quantity === it2.quantity;
          });

          if (matchItems) {
            const alertId = `ANOM-DUP-DOC-${r1.id}-${r2.id}`;
            const stored = storedStatuses[alertId];

            alerts.push({
              id: alertId,
              organizationId: orgId,
              category: 'DUPLICATE_DOCUMENT',
              severity: 'HIGH',
              titleEn: `Potential Duplicate Inbound Receipts (${r1.documentNumber} & ${r2.documentNumber})`,
              titleAr: `احتمال تكرار مستند استلام (${r1.documentNumber} و ${r2.documentNumber})`,
              descriptionEn: `Receipts ${r1.documentNumber} and ${r2.documentNumber} share the same supplier (${r1.supplierName}), date, and line quantities. Operational check required to verify if these represent dual deliveries or duplicate entry.`,
              descriptionAr: `المستندان ${r1.documentNumber} و ${r2.documentNumber} يتطابقان في المورد (${r1.supplierName}) والتاريخ وكميات الأصناف. يرجى التحقق مما إذا كانت شحنتين منفصلتين أو تكراراً في التسجيل.`,
              observedValue: 'Identical vendor, items, and date',
              thresholdValue: 'Unique delivery proof',
              affectedEntityType: 'DOCUMENT',
              affectedEntityId: r2.id,
              affectedEntityCode: r2.documentNumber,
              warehouseId: r2.warehouseId,
              timestamp: r2.createdAt,
              requiresReview: true,
              status: (stored?.status as any) || 'OPEN',
              reviewedBy: stored?.reviewedBy,
              reviewedAt: stored?.reviewedAt,
              reviewNotes: stored?.notes,
            });
          }
        }
      }
    }

    // 5. Unexpected stock variance from physical stocktakes
    const varianceThreshold = settings.anomalyVarianceThresholdKG || 50;
    for (const st of stocktakes) {
      if (st.status === 'CONFIRMED' || st.status === 'DRAFT') {
        for (const line of st.items) {
          if (Math.abs(line.varianceQuantity) >= varianceThreshold) {
            const alertId = `ANOM-VAR-${st.id}-${line.itemId}`;
            const stored = storedStatuses[alertId];

            alerts.push({
              id: alertId,
              organizationId: orgId,
              category: 'UNEXPECTED_STOCK_VARIANCE',
              severity: 'HIGH',
              titleEn: `Significant Stocktake Variance: ${line.varianceQuantity > 0 ? '+' : ''}${line.varianceQuantity.toLocaleString()} ${line.unit}`,
              titleAr: `فارق جرد مخزني ملحوظ: ${line.varianceQuantity > 0 ? '+' : ''}${line.varianceQuantity.toLocaleString()} ${line.unit}`,
              descriptionEn: `Physical stock count for ${line.itemCode} in document ${st.countNumber} showed a variance of ${line.varianceQuantity.toLocaleString()} ${line.unit} (System expected: ${line.expectedQuantity}, Counted: ${line.countedQuantity}). Standard discrepancy investigation recommended.`,
              descriptionAr: `أظهر الجرد الفعلي للصنف ${line.itemCode} في المستند ${st.countNumber} فارقاً قدره ${line.varianceQuantity.toLocaleString()} ${line.unit} (المسجل: ${line.expectedQuantity}، الفعلي: ${line.countedQuantity}). يوصى بالتحقق المعتاد.`,
              observedValue: `${line.varianceQuantity} ${line.unit}`,
              thresholdValue: `±${varianceThreshold} ${line.unit}`,
              affectedEntityType: 'ITEM',
              affectedEntityId: line.itemId,
              affectedEntityCode: line.itemCode,
              warehouseId: st.warehouseId,
              timestamp: st.confirmedAt || st.createdAt,
              requiresReview: true,
              status: (stored?.status as any) || 'OPEN',
              reviewedBy: stored?.reviewedBy,
              reviewedAt: stored?.reviewedAt,
              reviewNotes: stored?.notes,
            });
          }
        }
      }
    }

    return alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Updates review status of an anomaly alert
   */
  static updateAlertStatus(
    alertId: string,
    status: 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN',
    reviewer: { id: string; name: string },
    notes?: string
  ): void {
    const all = this.getStoredStatuses();
    all[alertId] = {
      status,
      notes,
      reviewedBy: reviewer.name,
      reviewedAt: new Date().toISOString(),
    };
    this.saveStatuses(all);
  }
}
