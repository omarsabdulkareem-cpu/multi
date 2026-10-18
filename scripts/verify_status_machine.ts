import {
  validateStatusTransition,
  validateStageMandatoryFields,
  validateProductionIssueTransition,
  validateShreddingActionTransition,
  checkMaterialProductionReadiness,
  normalizeToWorkflowStage,
} from '../src/services/statusMachineService';
import {
  INITIAL_MATERIALS,
  INITIAL_LOCATIONS,
  INITIAL_WAREHOUSES,
} from '../src/services/initialData';
import { ReceivingTransaction, ShreddingTransaction, InventoryBalance } from '../src/types';

console.log('===============================================================');
console.log('🛡️ STATUS-MACHINE & WORKFLOW VALIDATION LAYER TESTS');
console.log('===============================================================');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

// 1. Test Illegal Direct Jump: DRAFT -> ISSUED_TO_PRODUCTION
const jumpToProd = validateStatusTransition('DRAFT', 'ISSUED_TO_PRODUCTION');
assert(
  !jumpToProd.valid && jumpToProd.errorCode === 'ERR_ILLEGAL_PRODUCTION_JUMP',
  'Rule 1: Blocks illegal jump from DRAFT to ISSUED_TO_PRODUCTION',
  jumpToProd.errorMessageAr
);

// 2. Test Illegal Jump: SCALE_IN_COMPLETED -> READY_FOR_PRODUCTION
const jumpToReady = validateStatusTransition('SCALE_IN_COMPLETED', 'READY_FOR_PRODUCTION');
assert(
  !jumpToReady.valid && jumpToReady.errorCode === 'ERR_INVALID_TRANSITION_SEQUENCE',
  'Rule 2: Blocks jump from SCALE_IN_COMPLETED to READY_FOR_PRODUCTION without scale-out',
  jumpToReady.errorMessageAr
);

// 3. Test Legal Transitions in Sequence
const t1 = validateStatusTransition('DRAFT', 'SCALE_IN_COMPLETED');
assert(t1.valid, 'Rule 3a: Allows legal transition DRAFT -> SCALE_IN_COMPLETED');

const t2 = validateStatusTransition('SCALE_IN_COMPLETED', 'UNLOADING');
assert(t2.valid, 'Rule 3b: Allows legal transition SCALE_IN_COMPLETED -> UNLOADING');

const t3 = validateStatusTransition('UNLOADING', 'SCALE_OUT_COMPLETED');
assert(t3.valid, 'Rule 3c: Allows legal transition UNLOADING -> SCALE_OUT_COMPLETED');

// 4. Route Selection Rules
const routeShred = validateStatusTransition('SCALE_OUT_COMPLETED', 'WAITING_FOR_THERM', {
  requiresShredding: true,
  route: 'NOT_SHREDDED',
});
assert(
  routeShred.valid,
  'Rule 4a: Allows SCALE_OUT_COMPLETED -> WAITING_FOR_THERM when requiresShredding=true'
);

const routeDirect = validateStatusTransition('SCALE_OUT_COMPLETED', 'READY_FOR_PRODUCTION', {
  requiresShredding: false,
  route: 'READY_SHREDDED',
});
assert(
  routeDirect.valid,
  'Rule 4b: Allows SCALE_OUT_COMPLETED -> READY_FOR_PRODUCTION when direct route (READY_SHREDDED)'
);

const routeConflict = validateStatusTransition('SCALE_OUT_COMPLETED', 'READY_FOR_PRODUCTION', {
  requiresShredding: true,
  route: 'NOT_SHREDDED',
});
assert(
  !routeConflict.valid && routeConflict.errorCode === 'ERR_SHREDDING_REQUIRED_BEFORE_PRODUCTION',
  'Rule 4c: Blocks jumping directly to READY_FOR_PRODUCTION when material requires shredding',
  routeConflict.errorMessageAr
);

// 5. Test Mandatory Fields Validation
const missingScaleIn = validateStageMandatoryFields('SCALE_IN', {
  scaleInWeightKG: 0,
});
assert(
  !missingScaleIn.valid && missingScaleIn.missingFields?.includes('scaleInWeightKG'),
  'Rule 5a: Enforces mandatory scaleInWeightKG > 0 for SCALE_IN'
);

const validScaleIn = validateStageMandatoryFields('SCALE_IN', {
  scaleInWeightKG: 45000,
  materialId: 'MAT-01',
  supplierId: 'SUP-01',
  vehiclePlate: '1234 بغداد',
  driverName: 'سائق الفحص',
});
assert(validScaleIn.valid, 'Rule 5b: Accepts complete SCALE_IN payload');

const missingRoute = validateStageMandatoryFields('ROUTED', {
  route: 'READY_SHREDDED',
  targetWarehouseId: '',
  targetLocationId: 'LOC-A01',
  netReceivedWeightKG: 20000,
});
assert(
  !missingRoute.valid && missingRoute.missingFields?.includes('targetWarehouseId'),
  'Rule 5c: Enforces target warehouse for ROUTED'
);

// 6. Test Production Issue Transition Guards
const dummyReceivingWaiting: ReceivingTransaction = {
  id: 'RCV-WAIT-01',
  transactionNumber: 'REC-2026-999',
  legacyDocumentNumber: '546/2026/01',
  date: '2026-09-12',
  time: '08:00:00',
  supplierId: 'SUP-01',
  supplierName: 'مورد فحص',
  materialId: 'MAT-01',
  materialCode: 'PET-FLK-01',
  materialName: 'رقائق PET',
  vehiclePlate: '1234 بغداد',
  driverName: 'سائق',
  targetWarehouseId: 'WH-01',
  targetLocationId: 'LOC-A01',
  targetLocationCode: 'LOC-A-01',
  materialCondition: 'Clean & Sorted',
  operator: 'مشغل',
  supervisor: 'مشرف',
  status: 'WAITING_FOR_THERM',
  requiresShredding: true,
  route: 'NOT_SHREDDED',
  scaleInWeightKG: 30000,
  unloadWeightKG: 0,
  scaleOutWeightKG: 15000,
  netReceivedWeightKG: 15000,
  bulkBagsCount: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  timeline: [],
};

const balances: InventoryBalance[] = [
  {
    materialId: 'MAT-01',
    materialCode: 'PET-FLK-01',
    materialName: 'رقائق PET',
    category: 'Flakes / رقائق',
    warehouseId: 'WH-01',
    warehouseName: 'مستودع 1',
    locationId: 'LOC-A01',
    locationCode: 'LOC-A-01',
    availableKG: 5000,
    reservedKG: 0,
    issuedKG: 0,
    totalBalanceKG: 5000,
    status: 'Optimal',
    bulkBagsCount: 10,
    lastMovementDate: new Date().toISOString(),
  },
];

const issueUnshredded = validateProductionIssueTransition(
  {
    productionOrderNumber: 'PO-TEST',
    machineLine: 'Line 1',
    materialId: 'MAT-01',
    warehouseId: 'WH-01',
    locationId: 'LOC-A01',
    quantityKG: 1000,
    bulkBagsCount: 2,
    shift: 'Morning / صباحي',
    sourceReceivingId: 'RCV-WAIT-01',
  },
  {
    receivingTransactions: [dummyReceivingWaiting],
    shreddingTransactions: [],
    inventoryBalances: balances,
  }
);
assert(
  !issueUnshredded.valid && issueUnshredded.errorCode === 'ERR_SHREDDING_NOT_INITIATED',
  'Rule 6a: Blocks issuing unshredded material (WAITING_FOR_THERM) directly to production',
  issueUnshredded.errorMessageAr
);

const issueExceedsStock = validateProductionIssueTransition(
  {
    productionOrderNumber: 'PO-TEST',
    machineLine: 'Line 1',
    materialId: 'MAT-01',
    warehouseId: 'WH-01',
    locationId: 'LOC-A01',
    quantityKG: 10000, // Available is only 5000
    bulkBagsCount: 15,
    shift: 'Morning / صباحي',
  },
  {
    receivingTransactions: [],
    shreddingTransactions: [],
    inventoryBalances: balances,
  }
);
assert(
  !issueExceedsStock.valid && issueExceedsStock.errorCode === 'ERR_INSUFFICIENT_STOCK',
  'Rule 6b: Blocks issuing quantity greater than available stock',
  issueExceedsStock.errorMessageAr
);

// 7. Shredding Action Guards
const invalidShredStart = validateShreddingActionTransition(
  'START',
  { inputKG: 0, materialId: 'MAT-01' }
);
assert(
  !invalidShredStart.valid,
  'Rule 7a: Blocks shredding start with zero input weight',
  invalidShredStart.errorMessageAr
);

const dummyShred: ShreddingTransaction = {
  id: 'THM-01',
  shreddingNumber: 'THM-01',
  legacyDocumentNumber: '360/2026/01',
  materialId: 'MAT-01',
  materialCode: 'PET-FLK-01',
  materialName: 'رقائق PET',
  inputKG: 10000,
  bulkBagsInput: 15,
  shreddingStart: '2026-09-12T08:30:00.000Z',
  shreddingEnd: '2026-09-12T10:00:00.000Z',
  outputKG: 0,
  bulkBagsOutput: 0,
  productionDamageKG: 0,
  varianceKG: 0,
  variancePercentage: 0,
  isAbnormalVariance: false,
  operator: 'مشغل',
  supervisor: 'مشرف',
  machineId: 'THERM-01',
  sourceLocationId: 'LOC-THM01',
  sourceLocationCode: 'LOC-THM-IN',
  destinationWarehouseId: 'WH-02',
  destinationLocationId: 'LOC-THM02',
  destinationLocationCode: 'LOC-THM-OUT',
  status: 'In Shredding',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const invalidShredOutput = validateShreddingActionTransition(
  'COMPLETE',
  { outputKG: 15000, bulkBagsOutput: 20, productionDamageKG: 500 }, // Way over 10000 kg input
  { shreddingRecord: dummyShred }
);
assert(
  !invalidShredOutput.valid,
  'Rule 7b: Blocks shredding complete when output exceeds input beyond physics limits',
  invalidShredOutput.errorMessageAr
);

console.log('===============================================================');
console.log(`📊 SUMMARY: ${passCount} Passed, ${failCount} Failed`);
console.log('===============================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✨ ALL STATUS-MACHINE VALIDATION RULES VERIFIED SUCCESSFULLY!');
}
