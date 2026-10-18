/**
 * GENERAL-PURPOSE MULTI-TENANT WAREHOUSE MANAGEMENT PLATFORM
 * Core Universal Warehouse Engine Contracts
 * 
 * Hierarchy:
 * PLATFORM -> ORGANIZATION -> WAREHOUSES -> LOCATIONS -> ITEMS -> INVENTORY -> TRANSACTIONS
 */

export type WarehouseStatus = 'ACTIVE' | 'INACTIVE';

export interface WarehouseFacility {
  id: string;                      // e.g. 'WH-01'
  organizationId: string;          // Tenant isolation ID
  name: string;                    // Unified/Fallback name
  nameAr: string;                  // Arabic name
  nameEn: string;                  // English name
  code: string;                    // e.g. 'WH-MAIN', 'WH-RAW', 'WH-FG', 'WH-SPARE'
  description?: string;
  address?: string;
  type?: 'Raw' | 'FinishedGoods' | 'SpareParts' | 'Packaging' | 'ColdStorage' | 'General' | 'Shredding' | 'Production' | 'Regrind';
  status: WarehouseStatus;
  totalCapacityKG?: number;
  manager?: string;
  storekeeper?: string;
  createdAt: string;
  updatedAt: string;
}

export type StorageLocationType = 'ZONE' | 'AISLE' | 'RACK' | 'SHELF' | 'BIN' | 'GENERAL';
export type StorageLocationStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'FULL';

export interface StorageLocation {
  id: string;                      // e.g. 'LOC-A-01'
  organizationId: string;          // Tenant isolation ID
  warehouseId: string;             // References WarehouseFacility.id
  parentLocationId?: string;       // For nested hierarchy: Warehouse -> Zone -> Aisle -> Rack -> Shelf -> Bin
  code: string;                    // e.g. 'LOC-A-01', 'RACK-03-B2'
  name: string;
  nameAr?: string;
  nameEn?: string;
  type: StorageLocationType;
  zone?: string;
  description?: string;
  status: StorageLocationStatus;
  capacityKG?: number;
  currentKG?: number;
  maxBags?: number;
  bulkBagsCount?: number;
  materialTypesAllowed?: string[];
  referenceCode?: string;          // Configurable internal ledger code (e.g. 167)
  createdAt: string;
  updatedAt: string;
}

export type ItemCategory =
  | 'Raw Materials'
  | 'Finished Goods'
  | 'Spare Parts'
  | 'Packaging'
  | 'Consumables'
  | 'Products'
  | 'Equipment'
  | 'Other'
  | string;

export type StandardUnit =
  | 'PCS'
  | 'KG'
  | 'TON'
  | 'LITER'
  | 'METER'
  | 'BOX'
  | 'PALLET'
  | 'BAG'
  | 'ROLL'
  | string;

export interface UnitOfMeasure {
  id: string;
  code: StandardUnit;
  nameAr: string;
  nameEn: string;
  baseUnit?: StandardUnit;         // e.g. TON base is KG
  conversionFactor?: number;       // e.g. 1 TON = 1000 KG
  isSystemDefault: boolean;
}

export interface ItemMaster {
  id: string;                      // e.g. 'ITEM-1001'
  organizationId: string;          // Tenant isolation ID
  itemCode: string;                // e.g. 'PET-FLK-01', 'BOX-MUG-12', 'MTR-HP-05'
  barcode?: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category: ItemCategory;
  subcategory?: string;
  unitOfMeasure: StandardUnit;
  weightUnit: 'KG' | 'LBS' | 'MT' | string;
  defaultWeight: number;           // Standard weight per unit in KG (e.g. 1 BAG = 25 KG)
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  trackBatch: boolean;             // Configurable per item
  trackSerial: boolean;            // Configurable per item
  trackExpiry: boolean;            // Configurable per item
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  defaultWarehouseId?: string;
  defaultLocationId?: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransactionType =
  | 'OPENING_BALANCE'
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'PRODUCTION_CONSUMPTION'
  | 'PRODUCTION_OUTPUT'
  | 'PRODUCTION_WASTE'
  | 'INVENTORY_STATUS_CHANGE';

export interface InventoryTransaction {
  id: string;                      // Unique ID
  transactionId: string;           // Formatted ID, e.g. TX-2026-0001
  organizationId: string;          // Tenant isolation ID
  transactionType: InventoryTransactionType;
  documentId: string;              // Related document, e.g. 'GR-1001', 'ISS-2001', 'TRF-3001'
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  sourceWarehouseId?: string;
  sourceLocationId?: string;
  destinationWarehouseId?: string;
  destinationLocationId?: string;
  quantity: number;                // Quantity in item's unitOfMeasure
  unit: StandardUnit;
  weightKG: number;                // Weight in KG
  batchId?: string;
  serialId?: string;
  expiryDate?: string;
  referenceNumber?: string;
  reason?: string;                 // Mandatory for adjustments ('Physical Count', 'Damaged', 'Lost', 'Found', 'Correction', etc.)
  notes?: string;
  performedBy: string;
  createdAt: string;               // ISO 8601
}

export interface InventoryBalanceRecord {
  id: string;                      // `${organizationId}_${warehouseId}_${locationId}_${itemId}`
  organizationId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: StandardUnit;
  quantity: number;                // Calculated current quantity
  weightKG: number;                // Calculated current weight in KG
  availableQuantity: number;       // quantity - reservedQuantity
  reservedQuantity: number;
  batchId?: string;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  lastTransactionDate: string;
  updatedAt: string;
}

export interface UniversalReceiptLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  locationId: string;
  locationCode: string;
  quantity: number;
  unit: StandardUnit;
  weightKG: number;
  batchId?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UniversalReceiptDocument {
  id: string;                      // e.g. 'GR-2026-001'
  receiptNumber: string;
  organizationId: string;
  supplierId?: string;
  supplierName: string;
  documentNumber: string;          // Supplier delivery note / PO #
  date: string;
  warehouseId: string;
  warehouseName: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  items: UniversalReceiptLineItem[];
  totalQuantity: number;
  totalWeightKG: number;
  notes?: string;
  receivedBy: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface UniversalIssueLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: StandardUnit;
  weightKG: number;
  batchId?: string;
  serialNumber?: string;
  notes?: string;
}

export interface UniversalIssueDocument {
  id: string;                      // e.g. 'ISS-2026-001'
  issueNumber: string;
  organizationId: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  department?: string;
  destination: string;             // e.g. 'Production Line 1', 'Customer XYZ', 'Packaging Department'
  reason: string;
  referenceNumber?: string;
  notes?: string;
  items: UniversalIssueLineItem[];
  totalQuantity: number;
  totalWeightKG: number;
  issuedBy: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface UniversalTransferLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: StandardUnit;
  weightKG: number;
  batchId?: string;
  serialNumber?: string;
}

export interface UniversalTransferDocument {
  id: string;                      // e.g. 'TRF-2026-001'
  transferNumber: string;
  organizationId: string;
  sourceWarehouseId: string;
  sourceWarehouseName: string;
  sourceLocationId: string;
  sourceLocationCode: string;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationLocationId: string;
  destinationLocationCode: string;
  items: UniversalTransferLineItem[];
  totalQuantity: number;
  totalWeightKG: number;
  reason?: string;
  notes?: string;
  performedBy: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface UniversalAdjustmentDocument {
  id: string;                      // e.g. 'ADJ-2026-001'
  adjustmentNumber: string;
  organizationId: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
  quantityDelta: number;           // Positive number
  unit: StandardUnit;
  weightKGDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason: 'Physical Count' | 'Damaged' | 'Lost' | 'Found' | 'Correction' | 'Other';
  notes?: string;
  performedBy: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface UniversalReturnLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: StandardUnit;
  weightKG: number;
  batchId?: string;
  notes?: string;
}

export interface UniversalReturnDocument {
  id: string;                      // e.g. 'RTN-2026-001'
  returnNumber: string;
  organizationId: string;
  returnType: 'RETURN_IN' | 'RETURN_OUT'; // IN: back to warehouse; OUT: return back to supplier
  originalDocumentRef?: string;    // Receipt or Issue document ID
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  partyName: string;               // Customer or Supplier name
  reason: string;
  notes?: string;
  items: UniversalReturnLineItem[];
  totalQuantity: number;
  totalWeightKG: number;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  performedBy: string;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface UniversalStockCountLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: StandardUnit;
  expectedQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;        // counted - expected
  varianceWeightKG: number;
  batchId?: string;
  status: 'MATCH' | 'SURPLUS' | 'DEFICIT';
}

export interface UniversalStockCountDocument {
  id: string;                      // e.g. 'CNT-2026-001'
  countNumber: string;
  organizationId: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  items: UniversalStockCountLineItem[];
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
  notes?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  performedBy: string;
  createdAt: string;
  confirmedAt?: string;
}

/**
 * Standard Universal Units of Measure
 */
export const DEFAULT_UNITS_OF_MEASURE: UnitOfMeasure[] = [
  { id: 'uom_kg', code: 'KG', nameAr: 'كيلوغرام', nameEn: 'Kilogram', isSystemDefault: true },
  { id: 'uom_ton', code: 'TON', nameAr: 'طن متري', nameEn: 'Metric Ton', baseUnit: 'KG', conversionFactor: 1000, isSystemDefault: true },
  { id: 'uom_pcs', code: 'PCS', nameAr: 'قطعة', nameEn: 'Pieces', isSystemDefault: true },
  { id: 'uom_bag', code: 'BAG', nameAr: 'كيس / شليف', nameEn: 'Bag / Sack', isSystemDefault: true },
  { id: 'uom_box', code: 'BOX', nameAr: 'صندوق / كرتونة', nameEn: 'Box / Carton', isSystemDefault: true },
  { id: 'uom_pallet', code: 'PALLET', nameAr: 'طبلية', nameEn: 'Pallet', isSystemDefault: true },
  { id: 'uom_liter', code: 'LITER', nameAr: 'لتر', nameEn: 'Liter', isSystemDefault: true },
  { id: 'uom_meter', code: 'METER', nameAr: 'متر', nameEn: 'Meter', isSystemDefault: true },
  { id: 'uom_roll', code: 'ROLL', nameAr: 'رول / بكرة', nameEn: 'Roll', isSystemDefault: true },
];

/**
 * Common Item Categories
 */
export const DEFAULT_ITEM_CATEGORIES: { id: string; nameAr: string; nameEn: string }[] = [
  { id: 'raw', nameAr: 'مواد خام (Raw Materials)', nameEn: 'Raw Materials' },
  { id: 'finished', nameAr: 'منتجات تامة الصنع (Finished Goods)', nameEn: 'Finished Goods' },
  { id: 'packaging', nameAr: 'مواد تعبئة وتغليف (Packaging)', nameEn: 'Packaging' },
  { id: 'spare_parts', nameAr: 'قطع غيار وصيانة (Spare Parts)', nameEn: 'Spare Parts' },
  { id: 'consumables', nameAr: 'مستهلكات تشغيل (Consumables)', nameEn: 'Consumables' },
  { id: 'equipment', nameAr: 'معدات وأدوات (Equipment)', nameEn: 'Equipment' },
  { id: 'other', nameAr: 'أصناف متنوعة (Other)', nameEn: 'Other' },
];
