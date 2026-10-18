/**
 * AL-KARWAN FACTORY CONTROL SYSTEM - STATUS-MACHINE & WORKFLOW VALIDATION SERVICE
 * 
 * Enforces strict sequential transitions across the factory lifecycle:
 * Receiving (Draft -> Scale In -> Unload -> Scale Out -> Route)
 *   -> Route A (NOT_SHREDDED): Must go through Shredding (Start -> Complete) -> Storage Return (Doc 352/360) -> Production
 *   -> Route B (READY_SHREDDED / DIRECT): Stored in Raw Warehouse -> Production
 * 
 * Strictly PREVENTS:
 * 1. Jumping from Received / Waiting for Therm to Production without Shredding & Storage.
 * 2. Skipping weighbridge steps (Scale In / Scale Out).
 * 3. Issuing materials with missing mandatory fields or negative stock.
 * 4. Completing steps out-of-order.
 */

import {
  TransactionStatus,
  ReceivingTransaction,
  ShreddingTransaction,
  ProductionIssue,
  ProductionOrder,
  InventoryBalance,
} from '../types';
import { SystemCodesAPI } from './systemCodesService';

export type WorkflowStage =
  | 'DRAFT'
  | 'SCALE_IN'
  | 'UNLOADING'
  | 'UNLOADED'
  | 'SCALE_OUT'
  | 'ROUTED_SHREDDING'
  | 'STORED_IN_WAREHOUSE'
  | 'SHREDDING_ACTIVE'
  | 'SHREDDING_COMPLETED'
  | 'STORED_SHREDDED'
  | 'PRODUCTION_ISSUED'
  | 'IN_PRODUCTION'
  | 'PRODUCTION_COMPLETED'
  | 'FINISHED_GOODS_STORED'
  | 'CANCELLED';

export interface StatusValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessageAr?: string;
  errorMessageEn?: string;
  currentStage?: WorkflowStage;
  targetStage?: WorkflowStage;
  missingFields?: string[];
  suggestedNextActionAr?: string;
  suggestedNextActionEn?: string;
}

/**
 * Normalizes various system status strings and legacy terms into a canonical WorkflowStage.
 */
export function normalizeToWorkflowStage(status: TransactionStatus | string | undefined | null): WorkflowStage {
  if (!status) return 'DRAFT';
  const clean = status.toString().trim().toUpperCase().replace(/[\s-]+/g, '_');

  switch (clean) {
    case 'DRAFT':
      return 'DRAFT';

    case 'SCALE_IN_COMPLETED':
    case 'SCALE_IN':
    case 'SCALE_IN_DONE':
      return 'SCALE_IN';

    case 'UNLOADING':
    case 'UNLOAD_START':
    case 'UNLOADING_IN_PROGRESS':
      return 'UNLOADING';

    case 'UNLOADING_COMPLETED':
    case 'UNLOADED':
      return 'UNLOADED';

    case 'SCALE_OUT_COMPLETED':
    case 'SCALE_OUT':
    case 'SCALE_OUT_DONE':
      return 'SCALE_OUT';

    case 'WAITING_FOR_THERM':
    case 'WAITING_FOR_SHREDDING':
    case 'ROUTED_TO_SHREDDING':
    case 'NOT_SHREDDED':
      return 'ROUTED_SHREDDING';

    case 'IN_THERM':
    case 'IN_SHREDDING':
    case 'SHREDDING_IN_PROGRESS':
    case 'SHREDDING_ACTIVE':
      return 'SHREDDING_ACTIVE';

    case 'THERM_COMPLETED':
    case 'SHREDDING_COMPLETED':
      return 'SHREDDING_COMPLETED';

    case 'RETURNED_TO_STORAGE':
    case 'RETURN_TO_STORAGE':
    case 'READY_FOR_PRODUCTION':
    case 'STORED_IN_WAREHOUSE':
    case 'STORED_SHREDDED':
    case 'RECEIVED': // Default received that is already routed to storage
      return 'STORED_IN_WAREHOUSE';

    case 'ISSUED_TO_PRODUCTION':
    case 'PRODUCTION_ISSUED':
      return 'PRODUCTION_ISSUED';

    case 'IN_PRODUCTION':
      return 'IN_PRODUCTION';

    case 'COMPLETED':
    case 'PRODUCTION_COMPLETED':
      return 'PRODUCTION_COMPLETED';

    case 'CANCELLED':
      return 'CANCELLED';

    default:
      return 'DRAFT';
  }
}

/**
 * Stage display metadata for UI and logs.
 */
export const WORKFLOW_STAGE_INFO: Record<
  WorkflowStage,
  { labelAr: string; labelEn: string; color: string; order: number; iconName: string }
> = {
  DRAFT: {
    labelAr: 'مسودة / عند البوابة',
    labelEn: 'Gate Draft',
    color: 'slate',
    order: 1,
    iconName: 'Truck',
  },
  SCALE_IN: {
    labelAr: 'وزن الدخول (قائم)',
    labelEn: 'Scale In (Gross)',
    color: 'blue',
    order: 2,
    iconName: 'Scale',
  },
  UNLOADING: {
    labelAr: 'جاري التفريغ بالرصيف',
    labelEn: 'Unloading at Bay',
    color: 'amber',
    order: 3,
    iconName: 'Boxes',
  },
  UNLOADED: {
    labelAr: 'تم التفريغ والفحص',
    labelEn: 'Unloaded & Inspected',
    color: 'indigo',
    order: 4,
    iconName: 'PackageCheck',
  },
  SCALE_OUT: {
    labelAr: 'وزن الخروج (فارغ)',
    labelEn: 'Scale Out (Tare)',
    color: 'purple',
    order: 5,
    iconName: 'Scale',
  },
  ROUTED_SHREDDING: {
    labelAr: 'بانتظار الثرم (سكراب غير مفروم)',
    labelEn: 'Pending Shredding',
    color: 'orange',
    order: 6,
    iconName: 'Flame',
  },
  STORED_IN_WAREHOUSE: {
    labelAr: 'مخزنة بالمستودع (متاحة للإنتاج)',
    labelEn: 'In Warehouse / Ready for Production',
    color: 'emerald',
    order: 7,
    iconName: 'Warehouse',
  },
  SHREDDING_ACTIVE: {
    labelAr: 'قيد الثرم والتدوير (ماكينة الثرم)',
    labelEn: 'Shredding in Progress',
    color: 'rose',
    order: 8,
    iconName: 'Flame',
  },
  SHREDDING_COMPLETED: {
    labelAr: 'اكتمل الثرم (بحاجة إيداع مخزني)',
    labelEn: 'Shredding Completed',
    color: 'teal',
    order: 9,
    iconName: 'CheckCircle2',
  },
  STORED_SHREDDED: {
    labelAr: 'مفروم مودع بالمستودع',
    labelEn: 'Shredded Granules Stored',
    color: 'emerald',
    order: 10,
    iconName: 'Boxes',
  },
  PRODUCTION_ISSUED: {
    labelAr: `تم الصرف للإنتاج (مستند ${SystemCodesAPI.getProductionCode()})`,
    labelEn: `Issued to Production (Doc ${SystemCodesAPI.getProductionCode()})`,
    color: 'cyan',
    order: 11,
    iconName: 'Factory',
  },
  IN_PRODUCTION: {
    labelAr: 'قيد التشغيل على خط البثق',
    labelEn: 'In Production Line',
    color: 'violet',
    order: 12,
    iconName: 'Activity',
  },
  PRODUCTION_COMPLETED: {
    labelAr: 'اكتمل الإنتاج التام',
    labelEn: 'Production Completed',
    color: 'emerald',
    order: 13,
    iconName: 'CheckCircle',
  },
  FINISHED_GOODS_STORED: {
    labelAr: 'مودع بمستودع المنتج التام',
    labelEn: 'Finished Goods Stored',
    color: 'green',
    order: 14,
    iconName: 'Package',
  },
  CANCELLED: {
    labelAr: 'ملغاة',
    labelEn: 'Cancelled',
    color: 'red',
    order: 99,
    iconName: 'XCircle',
  },
};

/**
 * Direct Allowed Forward Transitions Graph:
 * Key: current stage -> Value: array of directly allowed next stages.
 */
const ALLOWED_STAGE_TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
  DRAFT: ['SCALE_IN', 'CANCELLED'],
  SCALE_IN: ['UNLOADING', 'UNLOADED', 'SCALE_OUT', 'CANCELLED'],
  UNLOADING: ['UNLOADED', 'SCALE_OUT', 'CANCELLED'],
  UNLOADED: ['SCALE_OUT', 'CANCELLED'],
  SCALE_OUT: ['ROUTED_SHREDDING', 'STORED_IN_WAREHOUSE', 'CANCELLED'],
  // Materials needing shredding MUST go to shredding active; they CANNOT jump to production!
  ROUTED_SHREDDING: ['SHREDDING_ACTIVE', 'CANCELLED'],
  SHREDDING_ACTIVE: ['SHREDDING_COMPLETED', 'CANCELLED'],
  // Completed shredding MUST be returned to storage before being issued to production!
  SHREDDING_COMPLETED: ['STORED_IN_WAREHOUSE', 'STORED_SHREDDED', 'CANCELLED'],
  STORED_SHREDDED: ['PRODUCTION_ISSUED', 'CANCELLED'],
  // Only once stored in warehouse and ready for production can it be issued to production!
  STORED_IN_WAREHOUSE: ['PRODUCTION_ISSUED', 'ROUTED_SHREDDING', 'CANCELLED'],
  PRODUCTION_ISSUED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['PRODUCTION_COMPLETED', 'CANCELLED'],
  PRODUCTION_COMPLETED: ['FINISHED_GOODS_STORED', 'CANCELLED'],
  FINISHED_GOODS_STORED: ['CANCELLED'],
  CANCELLED: [],
};

/**
 * Validates whether a state transition from currentStatus to targetStatus is legally permitted.
 */
export function validateStatusTransition(
  currentStatus: TransactionStatus | string | undefined | null,
  targetStatus: TransactionStatus | string,
  options?: {
    requiresShredding?: boolean;
    route?: 'READY_SHREDDED' | 'NOT_SHREDDED';
    payload?: any;
    entityType?: 'Receiving' | 'Shredding' | 'Production';
  }
): StatusValidationResult {
  const currentStage = normalizeToWorkflowStage(currentStatus);
  const targetStage = normalizeToWorkflowStage(targetStatus);

  // If already at the stage
  if (currentStage === targetStage) {
    return { valid: true, currentStage, targetStage };
  }

  // Check if cancelled
  if (currentStage === 'CANCELLED') {
    return {
      valid: false,
      errorCode: 'ERR_ALREADY_CANCELLED',
      errorMessageAr: 'لا يمكن تعديل أو تفعيل معاملة ملغاة.',
      errorMessageEn: 'Cannot modify or activate a cancelled transaction.',
      currentStage,
      targetStage,
    };
  }

  // CRITICAL BUSINESS RULE: Prevent any material from reaching 'Production'
  // without first passing through 'Receiving' and either 'Shredding' or 'Direct-to-Storage'.
  if (targetStage === 'PRODUCTION_ISSUED' || targetStage === 'IN_PRODUCTION') {
    // 1. Cannot jump to production from DRAFT, SCALE_IN, UNLOADING, UNLOADED, or SCALE_OUT
    if (['DRAFT', 'SCALE_IN', 'UNLOADING', 'UNLOADED', 'SCALE_OUT'].includes(currentStage)) {
      return {
        valid: false,
        errorCode: 'ERR_ILLEGAL_PRODUCTION_JUMP',
        errorMessageAr: `حركة غير قانونية ومحظورة: لا يمكن تحويل المادة إلى الإنتاج من مرحلة (${WORKFLOW_STAGE_INFO[currentStage]?.labelAr}). يجب إتمام ميزان الخروج وتأكيد التوجيه المخزني أولاً.`,
        errorMessageEn: `Illegal transition: Cannot issue to production from stage (${WORKFLOW_STAGE_INFO[currentStage]?.labelEn}). Material must complete weighbridge scale out and warehouse routing first.`,
        currentStage,
        targetStage,
        suggestedNextActionAr: 'إكمال وزن الخروج ثم تأكيد توجيه الشحنة إلى المستودع أو الثرم.',
        suggestedNextActionEn: 'Complete Scale Out then confirm consignment routing to Warehouse or Shredder.',
      };
    }

    // 2. If material requires shredding (or is currently in ROUTED_SHREDDING or SHREDDING_ACTIVE or SHREDDING_COMPLETED),
    // it MUST complete shredding AND be returned to storage first!
    if (
      currentStage === 'ROUTED_SHREDDING' ||
      currentStage === 'SHREDDING_ACTIVE' ||
      options?.requiresShredding === true ||
      options?.route === 'NOT_SHREDDED'
    ) {
      if (currentStage !== 'STORED_IN_WAREHOUSE' && currentStage !== 'STORED_SHREDDED') {
        return {
          valid: false,
          errorCode: 'ERR_SHREDDING_REQUIRED_BEFORE_PRODUCTION',
          errorMessageAr: 'حركة غير قانونية ومرفوضة: هذه المادة مصنفة (غير مفرومة / سكراب بحاجة ثرم). يمنع منعاً باتاً صرفها لخطوط الإنتاج قبل ثرمها وإيداع المجروش بالمستودع بموجب مستند 352!',
          errorMessageEn: 'Illegal transition: Material requires shredding. It is strictly forbidden to issue un-shredded scrap directly to production lines before shredding and depositing regrind to warehouse via Doc 352!',
          currentStage,
          targetStage,
          suggestedNextActionAr: 'إرسال الشحنة لماكينة الثرم (مستند 360) ثم إتمام الثرم وإيداع المفروم بالمستودع (مستند 352).',
          suggestedNextActionEn: 'Send material to shredder (Doc 360), complete milling, and store regrind in warehouse (Doc 352).',
        };
      }
    }

    // 3. If currently at SHREDDING_COMPLETED, it must be returned to storage first!
    if (currentStage === 'SHREDDING_COMPLETED') {
      return {
        valid: false,
        errorCode: 'ERR_SHREDDED_NOT_STORED',
        errorMessageAr: `المادة المفرومة بحاجة لإرجاع وإيداع بمستودع الثرم أولاً (مستند ${SystemCodesAPI.getShreddingMoveCode()}) لتوليد رصيد مخزني رسمي قبل الصرف للإنتاج بمستند ${SystemCodesAPI.getProductionCode()}.`,
        errorMessageEn: `Milled material must be returned to warehouse storage first (Doc ${SystemCodesAPI.getShreddingMoveCode()}) to establish formal ledger balance before issuing to production (Doc ${SystemCodesAPI.getProductionCode()}).`,
        currentStage,
        targetStage,
        suggestedNextActionAr: 'تنفيذ خطوة إرجاع المادة للمستودع.',
        suggestedNextActionEn: 'Execute Return to Storage step.',
      };
    }
  }

  // CRITICAL RULE: Material Routing & Shredding checks
  // If moving from SCALE_OUT to STORED_IN_WAREHOUSE (Ready for production),
  // but options.requiresShredding is true or options.route === 'NOT_SHREDDED',
  // this is an illegal jump! It must go to ROUTED_SHREDDING ('WAITING_FOR_THERM')
  if (
    currentStage === 'SCALE_OUT' &&
    targetStage === 'STORED_IN_WAREHOUSE' &&
    (options?.requiresShredding === true || options?.route === 'NOT_SHREDDED')
  ) {
    return {
      valid: false,
      errorCode: 'ERR_SHREDDING_REQUIRED_BEFORE_PRODUCTION',
      errorMessageAr: 'حركة غير مسموحة: المادة مصنفة كسكراب غير مثروم بحاجة لعملية ثرم، ولا يمكن توجيهها مباشرة كمادة جاهزة للإنتاج دون المرور بوحدة الثرم.',
      errorMessageEn: 'Material requires shredding and cannot be stored directly as ready for production without shredding.',
      currentStage,
      targetStage,
      suggestedNextActionAr: 'توجيه الشحنة إلى مسار الثرم (WAITING_FOR_THERM).',
      suggestedNextActionEn: 'Route consignment to Shredding line (WAITING_FOR_THERM).',
    };
  }

  // Check against the direct transition graph
  const allowedNextStages = ALLOWED_STAGE_TRANSITIONS[currentStage] || [];
  if (!allowedNextStages.includes(targetStage)) {
    return {
      valid: false,
      errorCode: 'ERR_INVALID_TRANSITION_SEQUENCE',
      errorMessageAr: `انتقال تسلسلي غير مسموح: لا يمكن الانتقال مباشرة من [${WORKFLOW_STAGE_INFO[currentStage]?.labelAr}] إلى [${WORKFLOW_STAGE_INFO[targetStage]?.labelAr}].`,
      errorMessageEn: `Illegal sequential transition: Cannot transition directly from [${WORKFLOW_STAGE_INFO[currentStage]?.labelEn}] to [${WORKFLOW_STAGE_INFO[targetStage]?.labelEn}].`,
      currentStage,
      targetStage,
      suggestedNextActionAr: `المراحل المسموحة تالياً: ${allowedNextStages.map((s) => WORKFLOW_STAGE_INFO[s]?.labelAr).join(' أو ')}`,
      suggestedNextActionEn: `Allowed next stages: ${allowedNextStages.map((s) => WORKFLOW_STAGE_INFO[s]?.labelEn).join(' or ')}`,
    };
  }

  return { valid: true, currentStage, targetStage };
}

/**
 * Validates mandatory fields for each stage in the receiving-to-production workflow.
 */
export function validateStageMandatoryFields(
  targetStageInput: WorkflowStage | string,
  data: Record<string, any>
): StatusValidationResult {
  const missing: string[] = [];
  const targetStage: WorkflowStage =
    targetStageInput === 'ROUTED'
      ? data.route === 'NOT_SHREDDED' || data.requiresShredding === true
        ? 'ROUTED_SHREDDING'
        : 'STORED_IN_WAREHOUSE'
      : normalizeToWorkflowStage(targetStageInput);

  switch (targetStage) {
    case 'SCALE_IN':
      if (!data.scaleInWeightKG || Number(data.scaleInWeightKG) <= 0) {
        missing.push('scaleInWeightKG');
      }
      if (!data.materialId && !data.materialCode) {
        missing.push('materialId');
      }
      if (!data.supplierId && !data.supplierName) {
        missing.push('supplier');
      }
      if (!data.vehiclePlate || String(data.vehiclePlate).trim() === '') {
        missing.push('vehiclePlate');
      }
      break;

    case 'UNLOADING':
      if (!data.unloadingBay || String(data.unloadingBay).trim() === '') {
        missing.push('unloadingBay');
      }
      break;

    case 'UNLOADED':
      if (data.bulkBagsCount === undefined || data.bulkBagsCount === null || Number(data.bulkBagsCount) <= 0) {
        missing.push('bulkBagsCount');
      }
      if (!data.materialCondition) {
        missing.push('materialCondition');
      }
      break;

    case 'SCALE_OUT':
      if (!data.scaleOutWeightKG || Number(data.scaleOutWeightKG) <= 0) {
        missing.push('scaleOutWeightKG');
      }
      if (!data.scaleInWeightKG || Number(data.scaleInWeightKG) <= 0) {
        missing.push('scaleInWeightKG');
      } else if (Number(data.scaleOutWeightKG) >= Number(data.scaleInWeightKG)) {
        return {
          valid: false,
          errorCode: 'ERR_INVALID_SCALE_WEIGHTS',
          errorMessageAr: `خطأ فادح في الأوزان: وزن الخروج فارغ (${Number(data.scaleOutWeightKG).toLocaleString()} كغم) لا يمكن أن يكون مساوياً أو أكبر من وزن الدخول قائم (${Number(data.scaleInWeightKG).toLocaleString()} كغم). الصافي سيكون سالباً!`,
          errorMessageEn: 'Tare weight (scale out) cannot be equal to or greater than gross weight (scale in).',
          missingFields: ['scaleOutWeightKG'],
        };
      }
      break;

    case 'ROUTED_SHREDDING':
    case 'STORED_IN_WAREHOUSE':
      if (!data.netReceivedWeightKG && !data.quantityKG && !data.scaleOutWeightKG) {
        missing.push('netReceivedWeightKG');
      }
      if (targetStage === 'STORED_IN_WAREHOUSE') {
        if (!data.targetWarehouseId && !data.warehouseId && !data.destWarehouseId) {
          missing.push('targetWarehouseId');
        }
        if (!data.targetLocationId && !data.locationId && !data.destLocationId) {
          missing.push('targetLocationId');
        }
      }
      break;

    case 'SHREDDING_ACTIVE':
      if (!data.materialId) {
        missing.push('materialId (المادة المدخلة للثرم)');
      }
      if (!data.inputKG || Number(data.inputKG) <= 0) {
        missing.push('inputKG (كمية المدخلات كغم)');
      }
      if (!data.machineId || data.machineId.trim() === '') {
        missing.push('machineId (تحديد ماكينة الثرم)');
      }
      break;

    case 'SHREDDING_COMPLETED':
      if (data.outputKG === undefined || data.outputKG === null || Number(data.outputKG) < 0) {
        missing.push('outputKG (كمية المخرجات المفرومة)');
      }
      if (data.productionDamageKG === undefined || data.productionDamageKG === null || Number(data.productionDamageKG) < 0) {
        missing.push('productionDamageKG (تالف الإنتاج)');
      }
      if (Number(data.inputKG) > 0) {
        const totalOut = Number(data.outputKG) + Number(data.productionDamageKG);
        // Conservation of mass: output cannot exceed input by > 5%
        if (totalOut > Number(data.inputKG) * 1.05) {
          return {
            valid: false,
            errorCode: 'ERR_PHYSICAL_MASS_VIOLATION',
            errorMessageAr: `خطأ فيزيائي: إجمالي المخرجات والتالف (${totalOut.toLocaleString()} كغم) يتجاوز المدخلات (${Number(data.inputKG).toLocaleString()} كغم) بنسبة غير منطقية!`,
            errorMessageEn: 'Total output + scrap cannot physically exceed input material by more than 5%.',
          };
        }
      }
      break;

    case 'STORED_SHREDDED':
      if (!data.destWarehouseId && !data.warehouseId) {
        missing.push('destWarehouseId (مستودع إيداع المفروم)');
      }
      if (!data.destLocationId && !data.locationId) {
        missing.push('destLocationId (موقع إيداع المفروم)');
      }
      break;

    case 'PRODUCTION_ISSUED':
      if (!data.productionOrderNumber || data.productionOrderNumber.trim() === '') {
        missing.push('productionOrderNumber (رقم أمر الإنتاج)');
      }
      if (!data.machineLine || data.machineLine.trim() === '') {
        missing.push('machineLine (خط البثق / التشكيل المستلم)');
      }
      if (!data.materialId) {
        missing.push('materialId (المادة الخام المصروفة)');
      }
      if (!data.locationId) {
        missing.push('locationId (الموقع المخزني المصروف منه)');
      }
      if (!data.quantityKG || Number(data.quantityKG) <= 0) {
        missing.push('quantityKG (الكمية المصروفة بالكيلوغرام)');
      }
      if (!data.shift) {
        missing.push('shift (الوردية التشغيلية)');
      }
      break;

    case 'IN_PRODUCTION':
      if (!data.productionOrderNumber && !data.orderNumber) {
        missing.push('orderNumber (رقم أمر الإنتاج)');
      }
      break;

    case 'PRODUCTION_COMPLETED':
      if (data.actualProductionKG === undefined || Number(data.actualProductionKG) <= 0) {
        missing.push('actualProductionKG (الكمية الفعلية المنتجة)');
      }
      break;
  }

  if (missing.length > 0) {
    return {
      valid: false,
      errorCode: 'ERR_MISSING_MANDATORY_FIELDS',
      errorMessageAr: `حقول إلزامية ناقصة لمرحلة [${WORKFLOW_STAGE_INFO[targetStage]?.labelAr}]: ${missing.join(', ')}`,
      errorMessageEn: `Missing mandatory fields for stage [${WORKFLOW_STAGE_INFO[targetStage]?.labelEn}]: ${missing.join(', ')}`,
      missingFields: missing,
      targetStage,
    };
  }

  return { valid: true, targetStage };
}

/**
 * Validates whether an issue to production is allowed according to the status machine:
 * Checks state transition, mandatory fields, linked receiving/shredding state, and stock balance.
 */
export function validateProductionIssueTransition(
  issueData: {
    productionOrderNumber: string;
    machineLine: string;
    materialId: string;
    warehouseId?: string;
    locationId: string;
    quantityKG: number;
    bulkBagsCount?: number;
    shift?: string;
    sourceReceivingId?: string;
    notes?: string;
  },
  context: {
    receivingTransactions: ReceivingTransaction[];
    shreddingTransactions: ShreddingTransaction[];
    inventoryBalances: InventoryBalance[];
  }
): StatusValidationResult {
  // 1. Validate mandatory fields
  const fieldValidation = validateStageMandatoryFields('PRODUCTION_ISSUED', issueData);
  if (!fieldValidation.valid) {
    return fieldValidation;
  }

  // 2. If this issue is linked directly to a receiving transaction, check its status
  if (issueData.sourceReceivingId) {
    const linkedRcv = context.receivingTransactions.find((r) => r.id === issueData.sourceReceivingId);
    if (!linkedRcv) {
      return {
        valid: false,
        errorCode: 'ERR_RECEIVING_NOT_FOUND',
        errorMessageAr: 'إرسالية الاستلام المرتبطة غير موجودة في النظام.',
        errorMessageEn: 'Linked receiving transaction does not exist.',
      };
    }

    const rcvStage = normalizeToWorkflowStage(linkedRcv.status);

    // If still in weighbridge stages:
    if (['DRAFT', 'SCALE_IN', 'UNLOADING', 'UNLOADED', 'SCALE_OUT'].includes(rcvStage)) {
      return {
        valid: false,
        errorCode: 'ERR_RECEIVING_INCOMPLETE',
        errorMessageAr: `لا يمكن صرف هذه الشحنة للإنتاج لأنها لم تستكمل دورة الاستلام بعد (حالتها الحالية: ${WORKFLOW_STAGE_INFO[rcvStage]?.labelAr}). يجب إتمام ميزان الخروج والتوجيه أولاً.`,
        errorMessageEn: `Cannot issue this shipment to production because receiving is incomplete (current: ${WORKFLOW_STAGE_INFO[rcvStage]?.labelEn}). Must complete weighbridge scale out and routing first.`,
        currentStage: rcvStage,
        targetStage: 'PRODUCTION_ISSUED',
      };
    }

    // If requires shredding or routed to shredding:
    const requiresShredding = linkedRcv.requiresShredding || linkedRcv.route === 'NOT_SHREDDED' || rcvStage === 'ROUTED_SHREDDING';
    if (requiresShredding) {
      // Must have completed shredding AND returned to storage
      if (!linkedRcv.shreddingTransactionId) {
        return {
          valid: false,
          errorCode: 'ERR_SHREDDING_NOT_INITIATED',
          errorMessageAr: 'المادة مصنفة (سكراب بحاجة ثرم) ولم يتم إرسالها إلى ماكينة الثرم بعد. يمنع صرفها مباشرة لخط البثق قبل الثرم!',
          errorMessageEn: 'Material requires shredding and has not been sent to shredder yet. Direct issuance to extrusion is blocked!',
          currentStage: rcvStage,
          targetStage: 'PRODUCTION_ISSUED',
        };
      }

      const linkedShredding = context.shreddingTransactions.find((s) => s.id === linkedRcv.shreddingTransactionId);
      if (!linkedShredding) {
        return {
          valid: false,
          errorCode: 'ERR_SHREDDING_RECORD_MISSING',
          errorMessageAr: 'سجل دورة الثرم المرتبط غير موجود في قاعدة البيانات.',
          errorMessageEn: 'Linked shredding cycle record not found in database.',
        };
      }

      const shredStage = normalizeToWorkflowStage(linkedShredding.status);
      if (shredStage !== 'STORED_IN_WAREHOUSE' && shredStage !== 'STORED_SHREDDED') {
        return {
          valid: false,
          errorCode: 'ERR_SHREDDING_NOT_STORED',
          errorMessageAr: `لا يمكن صرف المادة للإنتاج: دورة الثرم في حالة (${WORKFLOW_STAGE_INFO[shredStage]?.labelAr}). يجب إتمام الثرم وتخزين المفروم بالمستودع أولاً (مستند 352).`,
          errorMessageEn: `Cannot issue to production: Shredding is in stage (${WORKFLOW_STAGE_INFO[shredStage]?.labelEn}). Regrind must be stored in warehouse first (Doc 352).`,
          currentStage: shredStage,
          targetStage: 'PRODUCTION_ISSUED',
        };
      }
    }
  }

  // 3. Negative Stock Validation: Check available balance in the specified location
  const balance = context.inventoryBalances.find(
    (b) => b.materialId === issueData.materialId && b.locationId === issueData.locationId
  );
  const availableKG = balance ? balance.availableKG : 0;
  const requestedKG = Number(issueData.quantityKG);

  if (requestedKG > availableKG) {
    return {
      valid: false,
      errorCode: 'ERR_INSUFFICIENT_STOCK',
      errorMessageAr: `كمية الصرف المطلوبة (${requestedKG.toLocaleString()} كغم) تتجاوز الرصيد الفعلي المتاح في الموقع المحدد (${availableKG.toLocaleString()} كغم). تم حظر العملية لمنع الأرصدة السالبة!`,
      errorMessageEn: `Requested issue quantity (${requestedKG.toLocaleString()} KG) exceeds available location stock (${availableKG.toLocaleString()} KG). Operation blocked to prevent negative inventory!`,
      missingFields: ['quantityKG'],
      targetStage: 'PRODUCTION_ISSUED',
    };
  }

  return { valid: true, targetStage: 'PRODUCTION_ISSUED' };
}

/**
 * Validates whether a shredding action is permitted by the status machine.
 */
export function validateShreddingActionTransition(
  action: 'START' | 'COMPLETE' | 'RETURN_TO_STORAGE',
  data: any,
  context?: {
    shreddingRecord?: ShreddingTransaction;
    receivingRecord?: ReceivingTransaction;
  }
): StatusValidationResult {
  if (action === 'START') {
    const fields = validateStageMandatoryFields('SHREDDING_ACTIVE', data);
    if (!fields.valid) return fields;

    if (context?.receivingRecord) {
      const rcvStage = normalizeToWorkflowStage(context.receivingRecord.status);
      if (['DRAFT', 'SCALE_IN', 'UNLOADING', 'UNLOADED'].includes(rcvStage)) {
        return {
          valid: false,
          errorCode: 'ERR_RECEIVING_SCALE_OUT_NOT_DONE',
          errorMessageAr: 'لا يمكن بدء الثرم لإرسالية لم تستكمل وزن الخروج بعد.',
          errorMessageEn: 'Cannot start shredding for a shipment that has not completed tare scale-out.',
          currentStage: rcvStage,
          targetStage: 'SHREDDING_ACTIVE',
        };
      }
    }
    return { valid: true, targetStage: 'SHREDDING_ACTIVE' };
  }

  if (action === 'COMPLETE') {
    if (!context?.shreddingRecord) {
      return {
        valid: false,
        errorCode: 'ERR_SHREDDING_NOT_FOUND',
        errorMessageAr: 'معاملة الثرم غير موجودة.',
        errorMessageEn: 'Shredding transaction not found.',
      };
    }

    const currentStage = normalizeToWorkflowStage(context.shreddingRecord.status);
    if (currentStage !== 'SHREDDING_ACTIVE') {
      return {
        valid: false,
        errorCode: 'ERR_NOT_IN_SHREDDING',
        errorMessageAr: `لا يمكن إنهاء دورة ثرم وهي في حالة (${WORKFLOW_STAGE_INFO[currentStage]?.labelAr}). يجب أن تكون قيد التشغيل أولاً.`,
        errorMessageEn: `Cannot complete shredding while in stage (${WORKFLOW_STAGE_INFO[currentStage]?.labelEn}).`,
        currentStage,
        targetStage: 'SHREDDING_COMPLETED',
      };
    }

    const mergedData = { ...context.shreddingRecord, ...data };
    return validateStageMandatoryFields('SHREDDING_COMPLETED', mergedData);
  }

  if (action === 'RETURN_TO_STORAGE') {
    if (!context?.shreddingRecord) {
      return {
        valid: false,
        errorCode: 'ERR_SHREDDING_NOT_FOUND',
        errorMessageAr: 'معاملة الثرم غير موجودة.',
        errorMessageEn: 'Shredding transaction not found.',
      };
    }

    const currentStage = normalizeToWorkflowStage(context.shreddingRecord.status);
    if (currentStage !== 'SHREDDING_COMPLETED') {
      return {
        valid: false,
        errorCode: 'ERR_SHREDDING_NOT_COMPLETED',
        errorMessageAr: `لا يمكن إيداع المفروم بالمستودع قبل إنهاء الثرم وتسجيل كمية المخرجات والتالف أولاً (الحالة الحالية: ${WORKFLOW_STAGE_INFO[currentStage]?.labelAr}).`,
        errorMessageEn: `Cannot return regrind to warehouse before completing milling and logging output/scrap (current: ${WORKFLOW_STAGE_INFO[currentStage]?.labelEn}).`,
        currentStage,
        targetStage: 'STORED_IN_WAREHOUSE',
      };
    }

    return validateStageMandatoryFields('STORED_SHREDDED', data);
  }

  return { valid: true };
}

/**
 * Returns diagnostic details on whether material can enter production,
 * and if not, the exact blockers.
 */
export function checkMaterialProductionReadiness(
  materialId: string,
  locationId: string,
  context: {
    inventoryBalances: InventoryBalance[];
    receivingTransactions: ReceivingTransaction[];
    shreddingTransactions: ShreddingTransaction[];
  }
): {
  isReady: boolean;
  availableKG: number;
  blockersAr: string[];
  blockersEn: string[];
} {
  const blockersAr: string[] = [];
  const blockersEn: string[] = [];

  const balance = context.inventoryBalances.find(
    (b) => b.materialId === materialId && b.locationId === locationId
  );
  const availableKG = balance ? balance.availableKG : 0;

  if (availableKG <= 0) {
    blockersAr.push('الرصيد المتاح في الموقع هو صفر كغم.');
    blockersEn.push('Available stock in location is zero KG.');
  }

  // Check if there are active shipments for this material stuck in incomplete receiving
  const pendingInReceiving = context.receivingTransactions.filter(
    (r) =>
      r.materialId === materialId &&
      ['Draft', 'DRAFT', 'Scale In Completed', 'SCALE_IN_COMPLETED', 'Unloading', 'UNLOADING', 'Unloading Completed', 'UNLOADING_COMPLETED'].includes(r.status)
  );

  if (pendingInReceiving.length > 0) {
    blockersAr.push(`توجد ${pendingInReceiving.length} إرسالية استلام قيد التوزين والتفريغ ولم تستكمل ميزان الخروج بعد.`);
    blockersEn.push(`${pendingInReceiving.length} inbound shipments are still in scale-in/unloading.`);
  }

  // Check if there are un-shredded batches awaiting shredding
  const pendingInShredding = context.shreddingTransactions.filter(
    (s) => s.materialId === materialId && ['In Shredding', 'IN_SHREDDING', 'Ready for Shredding'].includes(s.status)
  );

  if (pendingInShredding.length > 0) {
    blockersAr.push(`توجد ${pendingInShredding.length} دفعة قيد الثرم لم يتم إيداعها بالمستودع بعد.`);
    blockersEn.push(`${pendingInShredding.length} shredding batches in progress.`);
  }

  return {
    isReady: availableKG > 0,
    availableKG,
    blockersAr,
    blockersEn,
  };
}
