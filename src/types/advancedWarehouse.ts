/**
/**
 * ADVANCED WAREHOUSE & INDUSTRY DOMAIN CONTRACTS (PHASE 6)
 * 
 * Reusable enterprise models for:
 * - Batch / Lot Tracking & Traceability
 * - Serial Number Management & Lifecycle
 * - Expiry Management & Near-Expiry Alerts
 * - Stock Status & Quarantine Management
 * - Stock Reservations & Available-to-Issue
 * - Barcode & QR Code References
 * - Warehouse Location Hierarchy & Capacity
 * - Weighing Foundation & Scales Master
 * - Production Orders & Bill of Materials (BOM)
 * - Quality Control & Inspection
 * - Processing / Shredding / Recycling (Generic Industry Engine)
 * - Packaging & Containers (Bulk Bag / شليف, Pallets, Drums)
 * - Cycle Counting & Stocktake (Blind / Open)
 * - Supply Chain End-to-End Traceability
 */

import { StandardUnit, StorageLocationType } from './warehouse';

// ============================================================================
// 1. BATCH / LOT TRACKING
// ============================================================================
export type BatchStatus = 'ACTIVE' | 'QUARANTINED' | 'EXPIRED' | 'BLOCKED' | 'CONSUMED' | 'CLOSED';

export interface BatchMaster {
  id: string;                      // e.g. 'bat_1001'
  batchNumber: string;             // e.g. 'BATCH-2026-001'
  organizationId: string;          // Multi-tenant isolation ID
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  quantity: number;
  remainingQuantity: number;
  unit: StandardUnit | string;
  receivedDate: string;
  manufacturingDate?: string;
  expiryDate?: string;
  supplierId?: string;
  supplierName?: string;
  supplierBatchNumber?: string;
  status: BatchStatus;
  qualityStatus?: 'PENDING' | 'PASSED' | 'FAILED' | 'QUARANTINE' | string;
  notes?: string;
  qrPayload?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 2. SERIAL NUMBER TRACKING
// ============================================================================
export type SerialStatus =
  | 'IN_STOCK'
  | 'ISSUED'
  | 'TRANSFERRED'
  | 'RETURNED'
  | 'DAMAGED'
  | 'LOST'
  | 'SCRAPPED';

export interface SerialMovementLog {
  timestamp: string;
  action: 'RECEIVE' | 'TRANSFER' | 'ISSUE' | 'RETURN' | 'ADJUST' | 'STATUS_CHANGE';
  fromLocationId?: string;
  toLocationId?: string;
  referenceDocNumber?: string;
  performedBy: string;
  notes?: string;
}

export interface SerialNumberMaster {
  id: string;                      // e.g. 'ser_001'
  serialNumber: string;            // e.g. 'SN-100045' (unique per tenant)
  organizationId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  batchId?: string;
  status: SerialStatus;
  receivingDocNumber?: string;
  issueDocNumber?: string;
  history: SerialMovementLog[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 3. EXPIRY MANAGEMENT
// ============================================================================
export type ExpiryPolicy = 'ALLOW' | 'WARN' | 'BLOCK';

export interface ExpiryAlertConfig {
  organizationId: string;
  alertDaysThresholds: number[];   // e.g. [7, 15, 30, 60, 90]
  policy: ExpiryPolicy;            // ALLOW, WARN, or BLOCK
}

// ============================================================================
// 4. STOCK STATUS & QUARANTINE
// ============================================================================
export type StockQualityStatus =
  | 'AVAILABLE'
  | 'QUARANTINED'
  | 'BLOCKED'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'RESERVED';

export interface StockStatusTransferPayload {
  organizationId: string;
  itemId: string;
  warehouseId: string;
  locationId: string;
  batchId?: string;
  quantity: number;
  unit: string;
  fromStatus: StockQualityStatus;
  toStatus: StockQualityStatus;
  reason: string;
  performedBy: string;
}

// ============================================================================
// 5. STOCK RESERVATIONS
// ============================================================================
export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONSUMED' | 'CANCELLED';

export interface StockReservation {
  id: string;
  organizationId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  batchId?: string;
  batchNumber?: string;
  quantity: number;
  unit: string;
  referenceDocument: string;       // e.g. Sales Order, Work Order, Project
  reservedBy: string;
  reservedAt: string;
  expiresAt?: string;
  status: ReservationStatus;
  notes?: string;
}

// ============================================================================
// 6. LOCATION HIERARCHY & CAPACITY MANAGEMENT
// ============================================================================
export type LocationCapacityPolicy = 'WARN' | 'BLOCK' | 'IGNORE';

export interface LocationHierarchyNode {
  id: string;
  organizationId: string;
  warehouseId: string;
  code: string;
  name: string;
  levelType: 'ZONE' | 'AISLE' | 'RACK' | 'SHELF' | 'BIN' | 'GENERAL';
  parentId?: string;
  maxWeightKG?: number;
  maxVolumeM3?: number;
  maxUnits?: number;
  capacityPolicy: LocationCapacityPolicy;
  status: 'ACTIVE' | 'BLOCKED' | 'FULL' | 'MAINTENANCE';
  barcode?: string;
  qrPayload?: string;
}

// ============================================================================
// 7. WEIGHING MODULE & SCALES MASTER
// ============================================================================
export type ScaleStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface ScaleMaster {
  id: string;                      // e.g. 'scl_01'
  organizationId: string;
  scaleCode: string;               // e.g. 'SCL-WB-01'
  name: string;                    // e.g. 'Main Weighbridge 80T'
  location: string;
  manufacturer?: string;
  model?: string;
  connectionType: 'MANUAL' | 'SERIAL_RS232' | 'TCP_IP' | 'MODBUS' | 'BLUETOOTH';
  maxCapacityKG: number;
  tareToleranceKG: number;
  status: ScaleStatus;
  calibrationDate?: string;
  nextCalibrationDate?: string;
  decimalPrecision: number;
}

export interface WeightRecord {
  id: string;
  organizationId: string;
  weightId: string;
  scaleId?: string;
  scaleCode?: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;               // Formula: grossWeight - tareWeight
  unit: 'KG' | 'LBS' | 'MT';
  operator: string;
  dateTime: string;
  referenceDocument?: string;      // Truck plate, PO #, Weighing ticket
  notes?: string;
}

// ============================================================================
// 8. PRODUCTION & BILL OF MATERIALS (BOM)
// ============================================================================
export type ProductionOrderStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface BOMComponent {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantityPerUnit: number;         // Quantity required per 1 unit of product
  unit: StandardUnit | string;
  scrapPercentage: number;         // e.g. 5% expected scrap
  optional?: boolean;
}

export interface BillOfMaterials {
  id: string;
  organizationId: string;
  bomCode: string;                 // e.g. 'BOM-CUP-200ML'
  productId: string;
  productCode: string;
  productName: string;
  version: string;
  standardBatchSize: number;
  unit: StandardUnit | string;
  components: BOMComponent[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionOrderLineConsumed {
  itemId: string;
  itemCode: string;
  itemName: string;
  plannedQuantity: number;
  consumedQuantity: number;
  unit: string;
  batchId?: string;
  locationId?: string;
}

export interface ProductionOrder {
  id: string;
  organizationId: string;
  orderNumber: string;             // e.g. 'PROD-2026-0001'
  bomId?: string;
  productId: string;
  productCode: string;
  productName: string;
  plannedQuantity: number;
  producedQuantity: number;
  wasteQuantity: number;
  unit: StandardUnit | string;
  warehouseId: string;
  warehouseName: string;
  targetLocationId: string;
  startDate: string;
  expectedDate: string;
  completedDate?: string;
  status: ProductionOrderStatus;
  consumedItems: ProductionOrderLineConsumed[];
  outputBatchNumber?: string;
  operator?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 9. QUALITY CONTROL
// ============================================================================
export type QualityInspectionResult =
  | 'PENDING'
  | 'PASSED'
  | 'FAILED'
  | 'QUARANTINED'
  | 'RELEASED';

export interface QualityParameterCheck {
  parameterName: string;           // e.g. 'Density', 'Moisture', 'Tensile Strength', 'Purity'
  expectedValue: string;
  measuredValue: string;
  passed: boolean;
}

export interface QualityInspection {
  id: string;
  organizationId: string;
  inspectionNumber: string;        // e.g. 'QC-2026-0001'
  referenceType: 'RECEIVING' | 'BATCH' | 'PRODUCTION' | 'FINISHED_GOOD' | 'RETURN';
  referenceNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNumber?: string;
  inspector: string;
  inspectionDate: string;
  parameters: QualityParameterCheck[];
  result: QualityInspectionResult;
  notes?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 10. GENERIC PROCESSING / SHREDDING / RECYCLING MODULE
// ============================================================================
export type ProcessingOrderStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ProcessingOrder {
  id: string;
  organizationId: string;
  processingNumber: string;        // e.g. 'PRC-2026-0001'
  operationType: string;           // 'Shredding', 'Recycling', 'Grinding', 'Rework', 'Processing'
  inputItemId: string;
  inputItemCode: string;
  inputItemName: string;
  inputQuantity: number;
  inputBatchId?: string;
  inputLocationId: string;
  outputItemId: string;
  outputItemCode: string;
  outputItemName: string;
  outputQuantity: number;
  outputLocationId: string;
  wasteQuantity: number;
  unit: StandardUnit | string;
  warehouseId: string;
  processingDate: string;
  operator: string;
  status: ProcessingOrderStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 11. PACKAGING & CONTAINERS
// ============================================================================
export type ContainerType =
  | 'BULK_BAG'   // شليف
  | 'BAG'
  | 'BOX'
  | 'PALLET'
  | 'DRUM'
  | 'CONTAINER';

export interface ContainerMaster {
  id: string;
  organizationId: string;
  containerCode: string;           // e.g. 'BAG-2026-089' or 'PAL-004'
  type: ContainerType;
  tareWeightKG: number;
  grossWeightKG: number;
  netWeightKG: number;
  unitCount?: number;
  itemId?: string;
  itemCode?: string;
  itemName?: string;
  batchId?: string;
  warehouseId: string;
  locationId: string;
  locationCode?: string;
  status: 'FULL' | 'PARTIAL' | 'EMPTY' | 'DAMAGED';
  qrPayload?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 12. CYCLE COUNTING & STOCKTAKE
// ============================================================================
export type StockCountType =
  | 'FULL_WAREHOUSE'
  | 'LOCATION'
  | 'CATEGORY'
  | 'ITEM'
  | 'CYCLE_COUNT';

export type StockCountStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'CANCELLED';

export interface StockCountLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  batchId?: string;
  expectedQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;        // countedQuantity - expectedQuantity
  unit: string;
  isCounted: boolean;
  notes?: string;
}

export interface StockCountDocument {
  id: string;
  organizationId: string;
  countNumber: string;             // e.g. 'CC-2026-0001'
  countType: StockCountType;
  warehouseId: string;
  warehouseName: string;
  locationId?: string;
  locationName?: string;
  assignedUser: string;
  countDate: string;
  isBlindCount: boolean;           // Blind counting hides expected quantities from workers
  status: StockCountStatus;
  items: StockCountLineItem[];
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
  approvedBy?: string;
  approvedAt?: string;
  adjustmentDocId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 13. END-TO-END SUPPLY CHAIN TRACEABILITY NODE
// ============================================================================
export interface TraceabilityJourneyStep {
  stepIndex: number;
  stage: 'SUPPLIER_PO' | 'RECEIVING' | 'STORAGE_BATCH' | 'PRODUCTION_CONSUMPTION' | 'PRODUCTION_OUTPUT' | 'QUALITY_INSPECTION' | 'CUSTOMER_DISPATCH';
  title: string;
  timestamp: string;
  documentNumber: string;
  entityName: string;
  quantity: number;
  unit: string;
  locationDetails?: string;
  operator: string;
  status: string;
}

export interface BatchTraceabilityGraph {
  batchNumber: string;
  itemCode: string;
  itemName: string;
  supplierName?: string;
  originReceivingDoc?: string;
  currentWarehouse: string;
  currentLocation: string;
  currentBalance: number;
  steps: TraceabilityJourneyStep[];
}
