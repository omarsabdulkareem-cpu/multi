/**
 * EXPIRY & BATCH INTELLIGENCE ENGINE (PHASE 13)
 * Provides FEFO (First Expiry, First Out) optimization, quarantine visibility,
 * and safety barriers preventing issuance of expired or blocked stock.
 */

import { BatchIntelligenceRecord } from '../../types/smartOperations';
import { AdvancedWarehouseService } from '../advancedWarehouseService';
import { WarehouseEngineService } from '../warehouseEngineService';
import { SmartOperationsSettingsService } from './smartOperationsSettingsService';

export class BatchIntelligenceService {
  /**
   * Retrieves enriched batch records with FEFO priority and safety classifications
   */
  static getBatchIntelligence(orgId: string): {
    records: BatchIntelligenceRecord[];
    summary: {
      totalBatches: number;
      expiredCount: number;
      expiringSoonCount: number;
      quarantinedCount: number;
      availableCount: number;
      totalExpiredKG: number;
      totalExpiringSoonKG: number;
    };
  } {
    const batches = AdvancedWarehouseService.getBatches(orgId);
    const warehouses = WarehouseEngineService.getWarehouses(orgId);
    const items = WarehouseEngineService.getItems(orgId);
    const settings = SmartOperationsSettingsService.getSettings(orgId);

    const warningDays = settings.expiryWarningDays || 30;
    const criticalDays = settings.criticalExpiryDays || 7;
    const now = Date.now();

    const records: BatchIntelligenceRecord[] = [];

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let quarantinedCount = 0;
    let availableCount = 0;
    let totalExpiredKG = 0;
    let totalExpiringSoonKG = 0;

    for (const batch of batches) {
      const item = items.find((i) => i.id === batch.itemId || i.itemCode === batch.itemCode);
      const wh = warehouses.find((w) => w.id === batch.warehouseId);

      const expiryTime = batch.expiryDate ? new Date(batch.expiryDate).getTime() : 0;
      const daysUntilExpiry = expiryTime
        ? Math.round((expiryTime - now) / 86400000)
        : 999;

      let status: BatchIntelligenceRecord['status'] = 'AVAILABLE';
      let recommendationEn = 'Available for standard FIFO/FEFO allocation.';
      let recommendationAr = 'متاح للصرف والتحريك وفق معايير الجودة.';

      if (batch.status === 'BLOCKED') {
        status = 'BLOCKED';
        recommendationEn = 'Blocked by warehouse supervisor. Strictly locked from issuance.';
        recommendationAr = 'محظور بقرار إشرافي. مقفل تماماً ويمنع صرفه للإنتاج.';
      } else if (batch.status === 'QUARANTINED' || batch.qualityStatus === 'QUARANTINE') {
        status = 'QUARANTINED';
        quarantinedCount++;
        recommendationEn = 'Under Quality Control quarantine. Awaiting lab clearance before release.';
        recommendationAr = 'تحت حجر مراقبة الجودة. بانتظار الفحص المخبري والاعتماد.';
      } else if (daysUntilExpiry < 0) {
        status = 'EXPIRED';
        expiredCount++;
        totalExpiredKG += batch.quantity;
        recommendationEn = `Expired on ${batch.expiryDate}. Segregation & disposal/return required. Automated issuance blocked.`;
        recommendationAr = `منتهي الصلاحية بتاريخ ${batch.expiryDate}. يجب العزل لإتلافه أو إرجاعه. يمنع النظام صرفه آلياً.`;
      } else if (daysUntilExpiry <= criticalDays) {
        status = 'EXPIRING_SOON';
        expiringSoonCount++;
        totalExpiringSoonKG += batch.quantity;
        recommendationEn = `Critical: Expiring in ${daysUntilExpiry} days! Priority #1 FEFO dispatch urgently advised.`;
        recommendationAr = `حرج: تنتهي الصلاحية خلال ${daysUntilExpiry} أيام! يوصى بالصرف الفوري بأولوية FEFO القصوى.`;
      } else if (daysUntilExpiry <= warningDays) {
        status = 'EXPIRING_SOON';
        expiringSoonCount++;
        totalExpiringSoonKG += batch.quantity;
        recommendationEn = `Approaching expiry in ${daysUntilExpiry} days. Prioritize for upcoming production orders (FEFO).`;
        recommendationAr = `تقترب نهاية الصلاحية خلال ${daysUntilExpiry} يوماً. يجب تفضيله في أوامر التشغيل القادمة.`;
      } else {
        availableCount++;
      }

      records.push({
        batchId: batch.id,
        organizationId: orgId,
        batchNumber: batch.batchNumber,
        itemId: batch.itemId,
        itemCode: batch.itemCode,
        itemName: batch.itemName,
        warehouseId: batch.warehouseId,
        warehouseName: wh?.name || batch.warehouseId,
        locationId: batch.locationId,
        locationCode: batch.locationCode,
        currentQuantity: batch.quantity,
        unit: item?.unitOfMeasure || 'KG',
        manufactureDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate || 'N/A',
        daysUntilExpiry,
        status,
        fefoPriorityRank: 0, // Assigned below
        qualityStatus: batch.qualityStatus,
        inspectionRequired: batch.qualityStatus === 'PENDING' || status === 'QUARANTINED',
        recommendationEn,
        recommendationAr,
      });
    }

    // Rank available and expiring soon batches by earliest expiry date (FEFO rule)
    const validBatchesForPicking = records
      .filter((r) => r.status === 'AVAILABLE' || r.status === 'EXPIRING_SOON')
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

    validBatchesForPicking.forEach((b, idx) => {
      b.fefoPriorityRank = idx + 1;
    });

    // Batches that are expired, quarantined, or blocked receive rank 999 (locked)
    records.forEach((r) => {
      if (r.status === 'EXPIRED' || r.status === 'QUARANTINED' || r.status === 'BLOCKED') {
        r.fefoPriorityRank = 999;
      }
    });

    return {
      records: records.sort((a, b) => a.fefoPriorityRank - b.fefoPriorityRank),
      summary: {
        totalBatches: records.length,
        expiredCount,
        expiringSoonCount,
        quarantinedCount,
        availableCount,
        totalExpiredKG,
        totalExpiringSoonKG,
      },
    };
  }

  /**
   * Recommends candidate batches for an issue or production order following strict FEFO rules.
   * Never includes expired or blocked batches.
   */
  static getFefoPickingCandidates(
    orgId: string,
    itemId: string,
    requiredQuantity: number
  ): {
    candidateBatches: { batchId: string; batchNumber: string; allocateQuantity: number; expiryDate: string }[];
    shortfall: number;
    fullySatisfied: boolean;
  } {
    const { records } = this.getBatchIntelligence(orgId);
    const eligible = records.filter(
      (r) =>
        r.itemId === itemId &&
        (r.status === 'AVAILABLE' || r.status === 'EXPIRING_SOON') &&
        r.currentQuantity > 0
    );

    let remaining = requiredQuantity;
    const candidates: { batchId: string; batchNumber: string; allocateQuantity: number; expiryDate: string }[] = [];

    for (const batch of eligible) {
      if (remaining <= 0) break;
      const take = Math.min(batch.currentQuantity, remaining);
      candidates.push({
        batchId: batch.batchId,
        batchNumber: batch.batchNumber,
        allocateQuantity: take,
        expiryDate: batch.expiryDate,
      });
      remaining -= take;
    }

    return {
      candidateBatches: candidates,
      shortfall: Math.max(0, remaining),
      fullySatisfied: remaining <= 0,
    };
  }
}
