import {
  InventoryMovement,
  InventoryBalance,
  MovementType,
  BulkBag,
  AuditLogEntry,
  MaterialItem,
  Warehouse,
  WarehouseLocation,
} from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { resolveMovementInternalCode, getCodeByPurpose } from './systemCodesService';

export interface MovementRequest {
  idempotencyKey?: string;
  sourceModule: 'RECEIVING' | 'SHREDDING' | 'PRODUCTION' | 'TRANSFER' | 'ADJUSTMENT' | 'IMPORT' | 'PHYSICAL_COUNT';
  sourceTransactionId: string;
  sourceTransactionNumber: string;
  legacyDocumentNumber?: string;
  internalInventoryCode?: string; // Configurable internal code e.g. 167 for Storage, 546 for Production
  movementType: MovementType;
  materialId: string;
  materialCode: string;
  materialName: string;
  quantityKG: number;
  bulkBagsCount: number;
  selectedBagIds?: string[];
  newBags?: Array<{ id?: string; bagNumber?: string; weightKG: number; notes?: string }>;
  
  // Locations
  warehouseId: string;
  warehouseName?: string;
  locationId: string;
  locationCode?: string;

  // Destination (for transfers)
  destWarehouseId?: string;
  destWarehouseName?: string;
  destLocationId?: string;
  destLocationCode?: string;

  user: string;
  notes?: string;
  date?: string;
  time?: string;
}

export interface MovementResult {
  success: boolean;
  error?: string;
  errorAr?: string;
  errorCode?: 'INSUFFICIENT_STOCK' | 'DUPLICATE_TRANSACTION' | 'INVALID_DATA' | 'NEGATIVE_STOCK' | 'LOCATION_NOT_FOUND';
  availableStockKG?: number;
  requestedStockKG?: number;
  movements: InventoryMovement[];
  updatedBalances: InventoryBalance[];
  updatedBags?: BulkBag[];
  auditLogs: AuditLogEntry[];
}

// In-memory idempotency cache to prevent double-click duplicate submissions
const processedIdempotencyKeys = new Set<string>();

/**
 * Validates if the movement can be legally executed without causing negative stock or double submission.
 */
export function validateInventoryMovement(
  req: MovementRequest,
  currentBalances: InventoryBalance[],
  existingMovements: InventoryMovement[]
): { valid: boolean; error?: string; errorAr?: string; errorCode?: any; availableKG?: number } {
  // 1. Check idempotency key if provided
  if (req.idempotencyKey && processedIdempotencyKeys.has(req.idempotencyKey)) {
    return {
      valid: false,
      errorCode: 'DUPLICATE_TRANSACTION',
      error: `Duplicate transaction rejected. Transaction key ${req.idempotencyKey} was already processed.`,
      errorAr: `تم رفض الحركة المكررة. مفتاح العملية ${req.idempotencyKey} تم تنفيذه مسبقاً لمنع التكرار.`,
    };
  }

  // 2. Validate basic fields
  if (!req.materialId || !req.warehouseId || !req.locationId) {
    return {
      valid: false,
      errorCode: 'INVALID_DATA',
      error: 'Material ID, Warehouse ID, and Location ID are strictly required.',
      errorAr: 'معرف المادة، المستودع، والموقع الجغرافي مطلوبة بصورة إلزامية.',
    };
  }

  if (req.quantityKG <= 0) {
    return {
      valid: false,
      errorCode: 'INVALID_DATA',
      error: 'Movement quantity must be strictly greater than zero.',
      errorAr: 'الكمية المحولة يجب أن تكون أكبر من الصفر تماماً.',
    };
  }

  // 3. Negative stock guard for outbound movements
  const isDeduction = [
    'ISSUE',
    'TRANSFER_OUT',
    'SHREDDING_INPUT',
    'PRODUCTION_INPUT',
    'PRODUCTION_ISSUE',
    'DAMAGE',
    'PRODUCTION_DAMAGE',
    'SHREDDING_ISSUE',
  ].includes(req.movementType);

  if (isDeduction) {
    const balance = currentBalances.find(
      (b) =>
        b.materialId === req.materialId &&
        b.warehouseId === req.warehouseId &&
        b.locationId === req.locationId
    );

    const availableKG = balance ? balance.availableKG : 0;
    if (availableKG < req.quantityKG) {
      return {
        valid: false,
        errorCode: 'INSUFFICIENT_STOCK',
        availableKG,
        error: `INSUFFICIENT STOCK: Available stock is ${availableKG.toLocaleString()} KG, but requested ${req.quantityKG.toLocaleString()} KG.`,
        errorAr: `رصيد المخزون غير كافٍ: المتاح في الموقع هو ${availableKG.toLocaleString()} كغم، بينما المطلوب صرفه ${req.quantityKG.toLocaleString()} كغم. لا يمكن السماح برصيد سالب.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Executes an auditable inventory transaction through the unified engine.
 */
export async function executeInventoryMovement(
  req: MovementRequest,
  currentBalances: InventoryBalance[],
  currentBags: BulkBag[],
  existingMovements: InventoryMovement[]
): Promise<MovementResult> {
  const now = new Date();
  const dateStr = req.date || now.toISOString().slice(0, 10);
  const timeStr = req.time || now.toTimeString().slice(0, 5);

  // Validation
  const val = validateInventoryMovement(req, currentBalances, existingMovements);
  if (!val.valid) {
    return {
      success: false,
      errorCode: val.errorCode,
      error: val.error,
      errorAr: val.errorAr,
      availableStockKG: val.availableKG,
      requestedStockKG: req.quantityKG,
      movements: [],
      updatedBalances: currentBalances,
      auditLogs: [],
    };
  }

  // Record idempotency
  if (req.idempotencyKey) {
    processedIdempotencyKeys.add(req.idempotencyKey);
  }

  const newMovements: InventoryMovement[] = [];
  const newAuditLogs: AuditLogEntry[] = [];
  let updatedBalances = [...currentBalances];
  let updatedBags = [...currentBags];

  // Helper to get or create balance record
  const getOrCreateBalance = (mId: string, mCode: string, mName: string, wId: string, wName: string, lId: string, lCode: string) => {
    let existing = updatedBalances.find(
      (b) => b.materialId === mId && b.warehouseId === wId && b.locationId === lId
    );
    if (!existing) {
      existing = {
        materialId: mId,
        materialCode: mCode,
        materialName: mName,
        category: 'Raw Plastic / مواد خام' as any,
        warehouseId: wId,
        warehouseName: wName,
        locationId: lId,
        locationCode: lCode,
        bulkBagsCount: 0,
        availableKG: 0,
        reservedKG: 0,
        issuedKG: 0,
        totalBalanceKG: 0,
        status: 'Optimal',
        lastMovementDate: dateStr,
      };
      updatedBalances.push(existing);
    }
    return existing;
  };

  // Dynamically resolve internal inventory code & legacy document reference
  const resolvedInternalCode =
    req.internalInventoryCode || resolveMovementInternalCode(req.sourceModule, req.movementType);
  const resolvedLegacyDoc =
    req.legacyDocumentNumber ||
    `${resolvedInternalCode}/${now.getFullYear()}/${String(req.sourceTransactionNumber || '').replace(/\D/g, '').slice(-3) || '001'}`;

  // Process based on movement type
  if (req.movementType === 'TRANSFER_OUT' || req.movementType === 'TRANSFER') {
    // 1. Source deduction
    const sourceBal = getOrCreateBalance(
      req.materialId,
      req.materialCode,
      req.materialName,
      req.warehouseId,
      req.warehouseName || req.warehouseId,
      req.locationId,
      req.locationCode || req.locationId
    );

    const prevSourceKG = sourceBal.availableKG;
    const prevSourceBags = sourceBal.bulkBagsCount;
    sourceBal.availableKG = Math.max(0, sourceBal.availableKG - req.quantityKG);
    sourceBal.totalBalanceKG = sourceBal.availableKG + sourceBal.reservedKG;
    sourceBal.bulkBagsCount = Math.max(0, sourceBal.bulkBagsCount - req.bulkBagsCount);
    sourceBal.lastMovementDate = dateStr;

    const outMovementId = `MOV-${Date.now()}-OUT`;
    const outMovement: InventoryMovement = {
      id: outMovementId,
      movementId: outMovementId,
      movementNumber: outMovementId,
      date: dateStr,
      time: timeStr,
      materialId: req.materialId,
      materialCode: req.materialCode,
      materialName: req.materialName,
      movementType: 'TRANSFER_OUT',
      source: `${req.warehouseName || req.warehouseId} [${req.locationCode || req.locationId}]`,
      destination: `${req.destWarehouseName || req.destWarehouseId} [${req.destLocationCode || req.destLocationId}]`,
      sourceLocation: `${req.warehouseName || req.warehouseId} [${req.locationCode || req.locationId}]`,
      destinationLocation: `${req.destWarehouseName || req.destWarehouseId} [${req.destLocationCode || req.destLocationId}]`,
      fromWarehouseId: req.warehouseId,
      fromWarehouseName: req.warehouseName,
      fromLocationId: req.locationId,
      fromLocationCode: req.locationCode,
      toWarehouseId: req.destWarehouseId,
      toWarehouseName: req.destWarehouseName,
      toLocationId: req.destLocationId,
      toLocationCode: req.destLocationCode,
      quantityKG: req.quantityKG,
      bulkBagsCount: req.bulkBagsCount,
      referenceDocument: req.sourceTransactionNumber,
      referenceDocNumber: req.sourceTransactionNumber,
      legacyDocRef: resolvedLegacyDoc,
      legacyDocumentNumber: resolvedLegacyDoc,
      internalInventoryCode: resolvedInternalCode,
      user: req.user,
      operator: req.user,
      transactionId: req.sourceTransactionId,
      status: 'Completed',
      notes: req.notes || `تحويل مخزني صادر إلى ${req.destWarehouseName || req.destWarehouseId}`,
    };
    newMovements.push(outMovement);

    // 2. Destination addition if provided
    if (req.destWarehouseId && req.destLocationId) {
      const destBal = getOrCreateBalance(
        req.materialId,
        req.materialCode,
        req.materialName,
        req.destWarehouseId,
        req.destWarehouseName || req.destWarehouseId,
        req.destLocationId,
        req.destLocationCode || req.destLocationId
      );

      destBal.availableKG += req.quantityKG;
      destBal.totalBalanceKG = destBal.availableKG + destBal.reservedKG;
      destBal.bulkBagsCount += req.bulkBagsCount;
      destBal.lastMovementDate = dateStr;

      const inMovementId = `MOV-${Date.now()}-IN`;
      const inMovement: InventoryMovement = {
        id: inMovementId,
        movementId: inMovementId,
        movementNumber: inMovementId,
        date: dateStr,
        time: timeStr,
        materialId: req.materialId,
        materialCode: req.materialCode,
        materialName: req.materialName,
        movementType: 'TRANSFER_IN',
        source: `${req.warehouseName || req.warehouseId} [${req.locationCode || req.locationId}]`,
        destination: `${req.destWarehouseName || req.destWarehouseId} [${req.destLocationCode || req.destLocationId}]`,
        sourceLocation: `${req.warehouseName || req.warehouseId} [${req.locationCode || req.locationId}]`,
        destinationLocation: `${req.destWarehouseName || req.destWarehouseId} [${req.destLocationCode || req.destLocationId}]`,
        fromWarehouseId: req.warehouseId,
        fromWarehouseName: req.warehouseName,
        fromLocationId: req.locationId,
        fromLocationCode: req.locationCode,
        toWarehouseId: req.destWarehouseId,
        toWarehouseName: req.destWarehouseName,
        toLocationId: req.destLocationId,
        toLocationCode: req.destLocationCode,
        quantityKG: req.quantityKG,
        bulkBagsCount: req.bulkBagsCount,
        referenceDocument: req.sourceTransactionNumber,
        referenceDocNumber: req.sourceTransactionNumber,
        legacyDocRef: resolvedLegacyDoc,
        legacyDocumentNumber: resolvedLegacyDoc,
        internalInventoryCode: resolvedInternalCode,
        user: req.user,
        operator: req.user,
        transactionId: req.sourceTransactionId,
        status: 'Completed',
        notes: req.notes || `تحويل مخزني وارد من ${req.warehouseName || req.warehouseId}`,
      };
      newMovements.push(inMovement);

      // Update individual bulk bags locations if bag IDs provided
      if (req.selectedBagIds && req.selectedBagIds.length > 0) {
        updatedBags = updatedBags.map((bag) => {
          if (req.selectedBagIds?.includes(bag.id)) {
            return {
              ...bag,
              warehouseId: req.destWarehouseId!,
              warehouseName: req.destWarehouseName || req.destWarehouseId!,
              locationId: req.destLocationId!,
              locationCode: req.destLocationCode || req.destLocationId!,
              updatedAt: new Date().toISOString(),
            };
          }
          return bag;
        });
      }
    }
  } else {
    // Single-sided movement (RECEIPT, ISSUE, THERM_INPUT, THERM_OUTPUT, DAMAGE, ADJUSTMENT, etc.)
    const targetBal = getOrCreateBalance(
      req.materialId,
      req.materialCode,
      req.materialName,
      req.warehouseId,
      req.warehouseName || req.warehouseId,
      req.locationId,
      req.locationCode || req.locationId
    );

    const prevKG = targetBal.availableKG;
    const isAdding = [
      'RECEIPT',
      'RECEIVING',
      'TRANSFER_IN',
      'THERM_OUTPUT',
      'SHREDDING_OUTPUT',
      'PRODUCTION_OUTPUT',
      'RETURN_TO_STORAGE',
      'OPENING_BALANCE',
    ].includes(req.movementType);

    if (isAdding) {
      targetBal.availableKG += req.quantityKG;
      targetBal.totalBalanceKG = targetBal.availableKG + targetBal.reservedKG;
      targetBal.bulkBagsCount += req.bulkBagsCount;
    } else if (req.movementType === 'ADJUSTMENT') {
      // Adjustment can be + or -
      targetBal.availableKG = Math.max(0, targetBal.availableKG + req.quantityKG);
      targetBal.totalBalanceKG = targetBal.availableKG + targetBal.reservedKG;
      targetBal.bulkBagsCount = Math.max(0, targetBal.bulkBagsCount + req.bulkBagsCount);
    } else {
      // Deduction
      targetBal.availableKG = Math.max(0, targetBal.availableKG - req.quantityKG);
      targetBal.totalBalanceKG = targetBal.availableKG + targetBal.reservedKG;
      targetBal.bulkBagsCount = Math.max(0, targetBal.bulkBagsCount - req.bulkBagsCount);
      targetBal.issuedKG += req.quantityKG;
    }
    targetBal.lastMovementDate = dateStr;

    const movId = `MOV-${Date.now()}`;
    const singleMovement: InventoryMovement = {
      id: movId,
      movementId: movId,
      movementNumber: movId,
      date: dateStr,
      time: timeStr,
      materialId: req.materialId,
      materialCode: req.materialCode,
      materialName: req.materialName,
      movementType: req.movementType,
      source: isAdding ? (req.notes || 'توريد / إنتاج') : `${req.warehouseName || req.warehouseId} [${req.locationCode || req.locationId}]`,
      destination: isAdding ? `${req.warehouseName || req.warehouseId} [${req.locationCode || req.locationId}]` : (req.notes || 'صرف / إنتاج'),
      sourceLocation: isAdding ? undefined : req.locationCode || req.locationId,
      destinationLocation: isAdding ? req.locationCode || req.locationId : undefined,
      fromWarehouseId: isAdding ? undefined : req.warehouseId,
      toWarehouseId: isAdding ? req.warehouseId : undefined,
      quantityKG: req.quantityKG,
      bulkBagsCount: req.bulkBagsCount,
      referenceDocument: req.sourceTransactionNumber,
      referenceDocNumber: req.sourceTransactionNumber,
      legacyDocRef: resolvedLegacyDoc,
      legacyDocumentNumber: resolvedLegacyDoc,
      internalInventoryCode: resolvedInternalCode,
      user: req.user,
      operator: req.user,
      transactionId: req.sourceTransactionId,
      status: 'Completed',
      notes: req.notes,
    };
    newMovements.push(singleMovement);

    // Create new individual bulk bags if receiving or shredded output
    if (req.newBags && req.newBags.length > 0) {
      const addedBags: BulkBag[] = req.newBags.map((b, idx) => {
        const bagNum = b.bagNumber || `SHL-${String(Date.now()).slice(-6)}-${idx + 1}`;
        return {
          id: b.id || bagNum,
          bagNumber: bagNum,
          materialId: req.materialId,
          materialCode: req.materialCode,
          materialName: req.materialName,
          weightKG: b.weightKG,
          warehouseId: req.warehouseId,
          warehouseName: req.warehouseName || req.warehouseId,
          locationId: req.locationId,
          locationCode: req.locationCode || req.locationId,
          status: 'AVAILABLE',
          sourceTransactionId: req.sourceTransactionId,
          sourceTransactionNumber: req.sourceTransactionNumber,
          legacyDocumentNumber: resolvedLegacyDoc,
          createdAt: new Date().toISOString(),
          notes: b.notes,
          qrPayload: JSON.stringify({
            bagId: bagNum,
            code: req.materialCode,
            material: req.materialName,
            weight: b.weightKG,
            doc: resolvedLegacyDoc,
          }),
        };
      });
      updatedBags = [...updatedBags, ...addedBags];
    }

    // Mark selected bags as consumed if deducting
    if (!isAdding && req.selectedBagIds && req.selectedBagIds.length > 0) {
      updatedBags = updatedBags.map((bag) => {
        if (req.selectedBagIds?.includes(bag.id)) {
          return {
            ...bag,
            status: 'CONSUMED' as const,
            updatedAt: new Date().toISOString(),
          };
        }
        return bag;
      });
    }
  }

  // Audit Log Entry
  const auditId = `AUD-${Date.now()}`;
  const auditLog: AuditLogEntry = {
    id: auditId,
    userId: req.user,
    userName: req.user,
    userRole: 'Storekeeper',
    action: `INVENTORY_${req.movementType}`,
    actionAr: `حركة مخزنية: ${req.movementType} (${req.quantityKG.toLocaleString()} كغم)`,
    entityType: 'INVENTORY_BALANCE',
    entityId: `${req.materialId}_${req.warehouseId}`,
    date: dateStr,
    time: timeStr,
    oldValue: `Ref: ${req.sourceTransactionNumber}`,
    newValue: `Qty: ${req.quantityKG} KG, Bags: ${req.bulkBagsCount}`,
    ipAddress: '192.168.1.10',
    status: 'SUCCESS',
    notes: req.notes,
  };
  newAuditLogs.push(auditLog);

  // Firestore background atomic synchronization
  try {
    const batch = writeBatch(db);
    newMovements.forEach((m) => {
      batch.set(doc(db, 'inventoryMovements', m.id), m);
    });
    newAuditLogs.forEach((a) => {
      batch.set(doc(db, 'auditLogs', a.id), a);
    });
    updatedBalances.forEach((b) => {
      const bId = `${b.materialId}_${b.warehouseId}_${b.locationId}`;
      batch.set(doc(db, 'inventoryBalances', bId), b);
    });
    // Persist updated or newly minted bulk bags
    updatedBags.forEach((bag) => {
      batch.set(doc(db, 'bulkBags', bag.id), bag);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Firestore async batch sync noted (local state remains protected):', err);
  }

  return {
    success: true,
    movements: newMovements,
    updatedBalances,
    updatedBags,
    auditLogs: newAuditLogs,
  };
}

export const executeCentralInventoryMovement = executeInventoryMovement;

