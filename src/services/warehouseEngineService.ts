/**
 * GENERAL-PURPOSE MULTI-TENANT WAREHOUSE MANAGEMENT PLATFORM
 * Core Universal Warehouse Engine Service
 * 
 * Hierarchy:
 * PLATFORM -> ORGANIZATION -> WAREHOUSES -> LOCATIONS -> ITEMS -> INVENTORY -> TRANSACTIONS
 * 
 * Principles:
 * - Ledger is the immutable Source of Truth (no manual overwrites).
 * - Multi-tenant isolation: every record belongs to an organizationId.
 * - Real-time Firestore persistence with offline fallback resilience.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  WarehouseFacility,
  StorageLocation,
  ItemMaster,
  InventoryTransaction,
  InventoryBalanceRecord,
  UniversalReceiptDocument,
  UniversalIssueDocument,
  UniversalTransferDocument,
  UniversalAdjustmentDocument,
  UniversalReturnDocument,
  UniversalStockCountDocument,
  DEFAULT_UNITS_OF_MEASURE,
  DEFAULT_ITEM_CATEGORIES,
} from '../types/warehouse';
import { DEFAULT_ORGANIZATIONS } from '../types/tenant';
import { WebhookService } from './webhookService';

// Firestore collection names
export const FS_COL_WAREHOUSES = 'universal_warehouses';
export const FS_COL_LOCATIONS = 'universal_locations';
export const FS_COL_ITEMS = 'universal_items';
export const FS_COL_LEDGER = 'universal_ledger';
export const FS_COL_RECEIPTS = 'universal_receipts';
export const FS_COL_ISSUES = 'universal_issues';
export const FS_COL_TRANSFERS = 'universal_transfers';
export const FS_COL_ADJUSTMENTS = 'universal_adjustments';
export const FS_COL_RETURNS = 'universal_returns';
export const FS_COL_STOCKTAKES = 'universal_stocktakes';

// Local storage cache keys
const CACHE_KEY_ITEMS = 'wh_engine_items_v2';
const CACHE_KEY_WAREHOUSES = 'wh_engine_warehouses_v2';
const CACHE_KEY_LOCATIONS = 'wh_engine_locations_v2';
const CACHE_KEY_LEDGER = 'wh_engine_ledger_v2';
const CACHE_KEY_RECEIPTS = 'wh_engine_receipts_v2';
const CACHE_KEY_ISSUES = 'wh_engine_issues_v2';
const CACHE_KEY_TRANSFERS = 'wh_engine_transfers_v2';
const CACHE_KEY_ADJUSTMENTS = 'wh_engine_adjustments_v2';
const CACHE_KEY_RETURNS = 'wh_engine_returns_v2';
const CACHE_KEY_STOCKTAKES = 'wh_engine_stocktakes_v2';

// =========================================================================
// INITIAL SEED DATA FOR EXEMPLAR ORGANIZATIONS
// =========================================================================

export const SEED_WAREHOUSES: WarehouseFacility[] = [
  // AL-KARWAN
  {
    id: 'WH-01',
    organizationId: 'org_alkarwan',
    name: 'المستودع الرئيسي للخامات رقم 1',
    nameAr: 'المستودع الرئيسي للخامات رقم 1',
    nameEn: 'Main Raw Material Warehouse #1',
    code: 'WH-RAW-01',
    type: 'Raw',
    status: 'ACTIVE',
    totalCapacityKG: 150000,
    manager: 'أحمد خليل',
    storekeeper: 'محمود الصالح',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'WH-02',
    organizationId: 'org_alkarwan',
    name: 'مستودع مفروم ومجروش الثرم رقم 2',
    nameAr: 'مستودع مفروم ومجروش الثرم رقم 2',
    nameEn: 'Regrind & Shredded Store #2',
    code: 'WH-SHR-02',
    type: 'Regrind',
    status: 'ACTIVE',
    totalCapacityKG: 80000,
    manager: 'م. حسام الدين',
    storekeeper: 'سعيد عبد ربه',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'WH-03',
    organizationId: 'org_alkarwan',
    name: 'مستودع البضائع الجاهزة والأكواب',
    nameAr: 'مستودع البضائع الجاهزة والأكواب',
    nameEn: 'Finished Goods & Cups Warehouse',
    code: 'WH-FG-03',
    type: 'FinishedGoods',
    status: 'ACTIVE',
    totalCapacityKG: 120000,
    manager: 'خالد العمري',
    storekeeper: 'باسم فؤاد',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  // Apex Logistics
  {
    id: 'WH-APX-01',
    organizationId: 'org_apex_logistics',
    name: 'مستودع دبي اللوجستي المركزي',
    nameAr: 'مستودع دبي اللوجستي المركزي',
    nameEn: 'Dubai Central Logistics Hub',
    code: 'APX-DXB-HUB',
    type: 'General',
    status: 'ACTIVE',
    totalCapacityKG: 500000,
    manager: 'Tariq Mansoor',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
];

export const SEED_LOCATIONS: StorageLocation[] = [
  // AL-KARWAN WH-01
  {
    id: 'LOC-A-01',
    organizationId: 'org_alkarwan',
    warehouseId: 'WH-01',
    code: 'A-01',
    name: 'Zone A - Heavy Stacks A-01',
    nameAr: 'قاطع أ - رصات ثقيلة A-01',
    nameEn: 'Zone A - Heavy Stacks A-01',
    type: 'RACK',
    zone: 'Zone A - Heavy Stacks',
    status: 'ACTIVE',
    capacityKG: 30000,
    currentKG: 14250,
    maxBags: 60,
    bulkBagsCount: 28,
    referenceCode: '167',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'LOC-A-02',
    organizationId: 'org_alkarwan',
    warehouseId: 'WH-01',
    code: 'A-02',
    name: 'Zone A - Staging Area A-02',
    nameAr: 'قاطع أ - منطقة تجميع A-02',
    nameEn: 'Zone A - Staging Area A-02',
    type: 'ZONE',
    zone: 'Zone A - Heavy Stacks',
    status: 'ACTIVE',
    capacityKG: 25000,
    currentKG: 8500,
    maxBags: 50,
    bulkBagsCount: 17,
    referenceCode: '167',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'LOC-B-01',
    organizationId: 'org_alkarwan',
    warehouseId: 'WH-01',
    code: 'B-01',
    name: 'Zone B - Active Racks B-01',
    nameAr: 'قاطع ب - رفوف نشطة B-01',
    nameEn: 'Zone B - Active Racks B-01',
    type: 'SHELF',
    zone: 'Zone B - Active Racks',
    status: 'ACTIVE',
    capacityKG: 20000,
    currentKG: 6200,
    maxBags: 40,
    bulkBagsCount: 12,
    referenceCode: '167',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  // AL-KARWAN WH-02
  {
    id: 'LOC-SHR-01',
    organizationId: 'org_alkarwan',
    warehouseId: 'WH-02',
    code: 'SHR-01',
    name: 'صالة مفروم الثرم الجاهز',
    nameAr: 'صالة مفروم الثرم الجاهز',
    nameEn: 'Regrind Staging SHR-01',
    type: 'BIN',
    zone: 'Zone Shredder',
    status: 'ACTIVE',
    capacityKG: 40000,
    currentKG: 12500,
    maxBags: 80,
    bulkBagsCount: 25,
    referenceCode: '360',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  // Apex Logistics
  {
    id: 'LOC-APX-A1',
    organizationId: 'org_apex_logistics',
    warehouseId: 'WH-APX-01',
    code: 'APX-RACK-01',
    name: 'High-Bay Pallet Rack 01',
    nameAr: 'رف الطبالي المرتفع 01',
    nameEn: 'High-Bay Pallet Rack 01',
    type: 'RACK',
    status: 'ACTIVE',
    capacityKG: 100000,
    currentKG: 45000,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
];

export const SEED_ITEMS: ItemMaster[] = [
  // AL-KARWAN Items
  {
    id: 'ITEM-MAT-01',
    organizationId: 'org_alkarwan',
    itemCode: 'PET-FLK-01',
    barcode: '628100100101',
    name: 'رقائق PET شفافة مغسولة حار',
    nameAr: 'رقائق PET شفافة مغسولة حار',
    nameEn: 'Hot Washed Clear PET Flakes',
    category: 'Raw Materials',
    unitOfMeasure: 'KG',
    weightUnit: 'KG',
    defaultWeight: 1,
    status: 'ACTIVE',
    trackBatch: true,
    trackSerial: false,
    trackExpiry: false,
    minimumStock: 10000,
    maximumStock: 80000,
    reorderPoint: 20000,
    defaultWarehouseId: 'WH-01',
    defaultLocationId: 'LOC-A-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'ITEM-MAT-02',
    organizationId: 'org_alkarwan',
    itemCode: 'PP-GRN-02',
    barcode: '628100100102',
    name: 'حبيبات بولي بروبيلين بكر Sabic',
    nameAr: 'حبيبات بولي بروبيلين بكر Sabic',
    nameEn: 'Virgin PP Granules (Sabic Prime 500P)',
    category: 'Raw Materials',
    unitOfMeasure: 'KG',
    weightUnit: 'KG',
    defaultWeight: 1,
    status: 'ACTIVE',
    trackBatch: true,
    trackSerial: false,
    trackExpiry: false,
    minimumStock: 8000,
    maximumStock: 60000,
    reorderPoint: 15000,
    defaultWarehouseId: 'WH-01',
    defaultLocationId: 'LOC-A-02',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'ITEM-MAT-03',
    organizationId: 'org_alkarwan',
    itemCode: 'BTL-SCR-03',
    barcode: '628100100103',
    name: 'بالات سكراب زجاجات بلاستيكية مضغوطة',
    nameAr: 'بالات سكراب زجاجات بلاستيكية مضغوطة',
    nameEn: 'Compressed Bottle Scrap Bales',
    category: 'Raw Materials',
    unitOfMeasure: 'KG',
    weightUnit: 'KG',
    defaultWeight: 1,
    status: 'ACTIVE',
    trackBatch: false,
    trackSerial: false,
    trackExpiry: false,
    minimumStock: 12000,
    maximumStock: 100000,
    reorderPoint: 25000,
    defaultWarehouseId: 'WH-01',
    defaultLocationId: 'LOC-B-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'ITEM-FG-01',
    organizationId: 'org_alkarwan',
    itemCode: 'CUP-7OZ-500',
    barcode: '628100100201',
    name: 'كرتون أكواب بلاستيكية 7 أونصة (500 قطعة)',
    nameAr: 'كرتون أكواب بلاستيكية 7 أونصة (500 قطعة)',
    nameEn: 'Plastic Cups 7oz Carton (500 PCS)',
    category: 'Finished Goods',
    unitOfMeasure: 'BOX',
    weightUnit: 'KG',
    defaultWeight: 4.5,
    status: 'ACTIVE',
    trackBatch: true,
    trackSerial: false,
    trackExpiry: false,
    minimumStock: 200,
    maximumStock: 5000,
    reorderPoint: 500,
    defaultWarehouseId: 'WH-03',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  // Apex Logistics Items
  {
    id: 'ITEM-APX-01',
    organizationId: 'org_apex_logistics',
    itemCode: 'ECOM-BOX-M',
    barcode: '799001001001',
    name: 'كرتون شحن تجارة إلكترونية متوسط',
    nameAr: 'كرتون شحن تجارة إلكترونية متوسط',
    nameEn: 'Medium Corrugated Shipping Box',
    category: 'Packaging',
    unitOfMeasure: 'BOX',
    weightUnit: 'KG',
    defaultWeight: 0.8,
    status: 'ACTIVE',
    trackBatch: false,
    trackSerial: false,
    trackExpiry: false,
    minimumStock: 1000,
    maximumStock: 20000,
    reorderPoint: 3000,
    defaultWarehouseId: 'WH-APX-01',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
];

export const SEED_LEDGER: InventoryTransaction[] = [
  // AL-KARWAN Opening & Receipts
  {
    id: 'TX-OPEN-01',
    transactionId: 'TX-2026-0001',
    organizationId: 'org_alkarwan',
    transactionType: 'OPENING_BALANCE',
    documentId: 'DOC-OPENING-2026',
    itemId: 'ITEM-MAT-01',
    itemCode: 'PET-FLK-01',
    itemName: 'رقائق PET شفافة مغسولة حار',
    warehouseId: 'WH-01',
    warehouseName: 'المستودع الرئيسي للخامات رقم 1',
    locationId: 'LOC-A-01',
    locationCode: 'A-01',
    quantity: 10000,
    unit: 'KG',
    weightKG: 10000,
    batchId: 'BATCH-2026-01',
    performedBy: 'م. عمر عبدالكريم',
    createdAt: '2026-09-01T08:00:00Z',
    reason: 'Initial Fiscal Year Opening Balance',
  },
  {
    id: 'TX-RCV-01',
    transactionId: 'TX-2026-0002',
    organizationId: 'org_alkarwan',
    transactionType: 'RECEIPT',
    documentId: 'GR-2026-089',
    itemId: 'ITEM-MAT-01',
    itemCode: 'PET-FLK-01',
    itemName: 'رقائق PET شفافة مغسولة حار',
    warehouseId: 'WH-01',
    warehouseName: 'المستودع الرئيسي للخامات رقم 1',
    locationId: 'LOC-A-01',
    locationCode: 'A-01',
    quantity: 4250,
    unit: 'KG',
    weightKG: 4250,
    batchId: 'BATCH-2026-89',
    performedBy: 'أحمد خليل',
    createdAt: '2026-09-10T09:30:00Z',
    reason: 'Inbound Supplier Receipt',
    notes: 'إرسالية مورد الدلتا المعتمدة',
  },
  {
    id: 'TX-ISS-01',
    transactionId: 'TX-2026-0003',
    organizationId: 'org_alkarwan',
    transactionType: 'ISSUE',
    documentId: 'ISS-2026-044',
    itemId: 'ITEM-MAT-01',
    itemCode: 'PET-FLK-01',
    itemName: 'رقائق PET شفافة مغسولة حار',
    warehouseId: 'WH-01',
    warehouseName: 'المستودع الرئيسي للخامات رقم 1',
    locationId: 'LOC-A-01',
    locationCode: 'A-01',
    quantity: 2000,
    unit: 'KG',
    weightKG: 2000,
    destinationWarehouseId: 'LINE-EXT-01',
    performedBy: 'محمود الصالح',
    createdAt: '2026-09-15T14:00:00Z',
    reason: 'Production Issue',
    notes: 'صرف لأمر تشغيل خط البثق رقم 1',
  },
  // Apex Logistics Initial Stock
  {
    id: 'TX-APX-01',
    transactionId: 'TX-2026-0101',
    organizationId: 'org_apex_logistics',
    transactionType: 'RECEIPT',
    documentId: 'GR-APX-001',
    itemId: 'ITEM-APX-01',
    itemCode: 'ECOM-BOX-M',
    itemName: 'كرتون شحن تجارة إلكترونية متوسط',
    warehouseId: 'WH-APX-01',
    warehouseName: 'مستودع دبي اللوجستي المركزي',
    locationId: 'LOC-APX-A1',
    locationCode: 'APX-RACK-01',
    quantity: 5000,
    unit: 'BOX',
    weightKG: 4000,
    performedBy: 'Tariq Mansoor',
    createdAt: '2026-09-01T10:00:00Z',
    reason: 'Supplier Intake Delivery',
  },
];

// =========================================================================
// CACHE ACCESS & SYNCHRONIZATION HELPERS
// =========================================================================

const memoryCache = new Map<string, any[]>();

function getLocalCache<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') {
    if (!memoryCache.has(key)) {
      memoryCache.set(key, [...fallback]);
    }
    return memoryCache.get(key) as T[];
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return fallback;
}

function setLocalCache<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') {
    memoryCache.set(key, data);
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function sanitizeForFirestore<T>(data: T): any {
  return JSON.parse(JSON.stringify(data));
}

export function isSyntheticTestOrg(orgId?: string): boolean {
  if (!orgId) return false;
  return (
    orgId.startsWith('org_synth') ||
    orgId.startsWith('org_qa') ||
    orgId.startsWith('org_test_') ||
    orgId.startsWith('test_') ||
    orgId.startsWith('org_tenant_') ||
    orgId.startsWith('staging_') ||
    orgId.startsWith('org_benchmark') ||
    orgId.includes('sandbox') ||
    orgId.includes('synthetic')
  );
}

export function shouldPersistToFirestore(orgId?: string): boolean {
  if (isSyntheticTestOrg(orgId)) return false;
  if (typeof window === 'undefined') return false;
  return true;
}

async function safeFirestoreSetDoc(
  colName: string,
  docId: string,
  payload: any,
  orgId?: string,
  merge = false
): Promise<void> {
  if (!shouldPersistToFirestore(orgId)) return;
  try {
    if (merge) {
      await setDoc(doc(db, colName, docId), sanitizeForFirestore(payload), { merge: true });
    } else {
      await setDoc(doc(db, colName, docId), sanitizeForFirestore(payload));
    }
  } catch (e) {
    console.warn(`[WarehouseEngine] Firestore write error in ${colName}:`, e);
  }
}

let entityIdSeq = 0;
function generateUniqueEntityId(prefix: string): string {
  entityIdSeq++;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${Date.now().toString().slice(-6)}-${entityIdSeq}-${rand}`;
}

// =========================================================================
// UNIVERSAL WAREHOUSE ENGINE API
// =========================================================================

export const WarehouseEngineAPI = {
  // -----------------------------------------------------------------------
  // 1. WAREHOUSES MANAGEMENT
  // -----------------------------------------------------------------------
  getWarehouses(orgId: string): WarehouseFacility[] {
    const all = getLocalCache<WarehouseFacility>(CACHE_KEY_WAREHOUSES, SEED_WAREHOUSES);
    return all.filter((w) => w.organizationId === orgId);
  },

  getWarehouse(orgId: string, whId: string): WarehouseFacility | undefined {
    return this.getWarehouses(orgId).find((w) => w.id === whId || w.code === whId);
  },

  async createWarehouse(
    orgId: string,
    data: Omit<WarehouseFacility, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>
  ): Promise<WarehouseFacility> {
    const all = getLocalCache<WarehouseFacility>(CACHE_KEY_WAREHOUSES, SEED_WAREHOUSES);
    const newId = generateUniqueEntityId('WH');
    const now = new Date().toISOString();

    const created: WarehouseFacility = {
      ...data,
      id: newId,
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    };

    all.push(created);
    setLocalCache(CACHE_KEY_WAREHOUSES, all);

    // Persist to Firestore
    await safeFirestoreSetDoc(FS_COL_WAREHOUSES, newId, created, orgId);

    try {
      const evt = WebhookService.createEvent(
        'warehouse.created',
        orgId,
        {
          warehouseId: created.id,
          name: created.name,
          code: created.code,
          type: created.type,
          status: created.status,
          totalCapacityKG: created.totalCapacityKG,
          createdAt: created.createdAt,
        },
        created.id
      );
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return created;
  },

  async updateWarehouse(
    orgId: string,
    whId: string,
    updates: Partial<WarehouseFacility>
  ): Promise<boolean> {
    const all = getLocalCache<WarehouseFacility>(CACHE_KEY_WAREHOUSES, SEED_WAREHOUSES);
    const idx = all.findIndex((w) => w.id === whId && w.organizationId === orgId);
    if (idx === -1) return false;

    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    setLocalCache(CACHE_KEY_WAREHOUSES, all);

    await safeFirestoreSetDoc(FS_COL_WAREHOUSES, whId, all[idx], orgId, true);

    return true;
  },

  // -----------------------------------------------------------------------
  // 2. STORAGE LOCATIONS MANAGEMENT
  // -----------------------------------------------------------------------
  getLocations(orgId: string, warehouseId?: string): StorageLocation[] {
    const all = getLocalCache<StorageLocation>(CACHE_KEY_LOCATIONS, SEED_LOCATIONS);
    return all.filter(
      (l) => l.organizationId === orgId && (!warehouseId || l.warehouseId === warehouseId)
    );
  },

  async createLocation(
    orgId: string,
    data: Partial<Omit<StorageLocation, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>> &
      Pick<StorageLocation, 'warehouseId' | 'code' | 'name'>
  ): Promise<StorageLocation> {
    const all = getLocalCache<StorageLocation>(CACHE_KEY_LOCATIONS, SEED_LOCATIONS);
    const newId = generateUniqueEntityId('LOC');
    const now = new Date().toISOString();

    const created: StorageLocation = {
      nameAr: data.nameAr || data.name,
      nameEn: data.nameEn || data.name,
      type: data.type || 'SHELF',
      status: data.status || 'ACTIVE',
      ...data,
      id: newId,
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    };

    all.push(created);
    setLocalCache(CACHE_KEY_LOCATIONS, all);

    await safeFirestoreSetDoc(FS_COL_LOCATIONS, newId, created, orgId);

    return created;
  },

  async updateLocation(
    orgId: string,
    locId: string,
    updates: Partial<StorageLocation>
  ): Promise<boolean> {
    const all = getLocalCache<StorageLocation>(CACHE_KEY_LOCATIONS, SEED_LOCATIONS);
    const idx = all.findIndex((l) => l.id === locId && l.organizationId === orgId);
    if (idx === -1) return false;

    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    setLocalCache(CACHE_KEY_LOCATIONS, all);

    await safeFirestoreSetDoc(FS_COL_LOCATIONS, locId, all[idx], orgId, true);

    return true;
  },

  // -----------------------------------------------------------------------
  // 3. ITEM MASTER MANAGEMENT
  // -----------------------------------------------------------------------
  getItems(orgId: string, categoryFilter?: string): ItemMaster[] {
    const all = getLocalCache<ItemMaster>(CACHE_KEY_ITEMS, SEED_ITEMS);
    return all.filter(
      (i) => i.organizationId === orgId && (!categoryFilter || i.category === categoryFilter)
    );
  },

  getItemById(orgId: string, itemId: string): ItemMaster | undefined {
    const items = this.getItems(orgId);
    return items.find((i) => i.id === itemId || i.itemCode === itemId);
  },

  getItem(orgId: string, itemId: string): ItemMaster | undefined {
    return this.getItemById(orgId, itemId);
  },

  async createItem(
    orgId: string,
    data: Partial<Omit<ItemMaster, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>> &
      Pick<ItemMaster, 'itemCode' | 'name'>
  ): Promise<ItemMaster> {
    const all = getLocalCache<ItemMaster>(CACHE_KEY_ITEMS, SEED_ITEMS);
    const newId = generateUniqueEntityId('ITEM');
    const now = new Date().toISOString();

    const created: ItemMaster = {
      nameAr: data.nameAr || data.name,
      nameEn: data.nameEn || data.name,
      category: data.category || 'Raw Materials',
      unitOfMeasure: data.unitOfMeasure || 'KG',
      weightUnit: data.weightUnit || 'KG',
      defaultWeight: data.defaultWeight !== undefined ? data.defaultWeight : 1,
      status: data.status || 'ACTIVE',
      trackBatch: data.trackBatch ?? false,
      trackSerial: data.trackSerial ?? false,
      trackExpiry: data.trackExpiry ?? false,
      minimumStock: data.minimumStock ?? 0,
      maximumStock: data.maximumStock ?? 100000,
      reorderPoint: data.reorderPoint ?? 0,
      ...data,
      id: newId,
      organizationId: orgId,
      createdAt: now,
      updatedAt: now,
    };

    all.push(created);
    setLocalCache(CACHE_KEY_ITEMS, all);

    await safeFirestoreSetDoc(FS_COL_ITEMS, newId, created, orgId);

    try {
      const evt = WebhookService.createEvent(
        'item.created',
        orgId,
        {
          itemId: created.id,
          itemCode: created.itemCode,
          name: created.name,
          category: created.category,
          unitOfMeasure: created.unitOfMeasure,
          defaultWeight: created.defaultWeight,
          createdAt: created.createdAt,
        },
        created.id
      );
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return created;
  },

  async updateItem(
    orgId: string,
    itemId: string,
    updates: Partial<ItemMaster>
  ): Promise<boolean> {
    const all = getLocalCache<ItemMaster>(CACHE_KEY_ITEMS, SEED_ITEMS);
    const idx = all.findIndex((i) => i.id === itemId && i.organizationId === orgId);
    if (idx === -1) return false;

    all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
    setLocalCache(CACHE_KEY_ITEMS, all);

    await safeFirestoreSetDoc(FS_COL_ITEMS, itemId, all[idx], orgId, true);

    try {
      const evt = WebhookService.createEvent('item.updated', orgId, {
        itemId: all[idx].id,
        itemCode: all[idx].itemCode,
        name: all[idx].name,
        category: all[idx].category,
        updates,
        updatedAt: all[idx].updatedAt,
      });
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return true;
  },

  // -----------------------------------------------------------------------
  // 4. IMMUTABLE INVENTORY LEDGER (SOURCE OF TRUTH)
  // -----------------------------------------------------------------------
  getLedger(orgId: string, itemId?: string, warehouseId?: string): InventoryTransaction[] {
    const all = getLocalCache<InventoryTransaction>(CACHE_KEY_LEDGER, SEED_LEDGER);
    return all
      .filter(
        (t) =>
          t.organizationId === orgId &&
          (!itemId || t.itemId === itemId || t.itemCode === itemId) &&
          (!warehouseId || t.warehouseId === warehouseId)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // Appends transaction directly to the immutable ledger
  async recordTransaction(
    orgId: string,
    txData: Omit<InventoryTransaction, 'id' | 'transactionId' | 'organizationId' | 'createdAt'>
  ): Promise<InventoryTransaction> {
    const all = getLocalCache<InventoryTransaction>(CACHE_KEY_LEDGER, SEED_LEDGER);
    const now = new Date().toISOString();
    const formattedId = `TX-${new Date().getFullYear()}-${String(all.length + 1).padStart(4, '0')}`;
    const id = `tx_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    const transaction: InventoryTransaction = {
      ...txData,
      id,
      transactionId: formattedId,
      organizationId: orgId,
      createdAt: now,
    };

    all.unshift(transaction);
    setLocalCache(CACHE_KEY_LEDGER, all);

    await safeFirestoreSetDoc(FS_COL_LEDGER, id, transaction, orgId);

    return transaction;
  },

  // -----------------------------------------------------------------------
  // 5. INVENTORY BALANCE COMPUTATION (MATHEMATICALLY DERIVED FROM LEDGER)
  // -----------------------------------------------------------------------
  computeInventoryBalances(orgId: string): InventoryBalanceRecord[] {
    const ledger = this.getLedger(orgId);
    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);

    // Map: key = `${warehouseId}_${locationId}_${itemId}`
    const map = new Map<string, InventoryBalanceRecord>();

    // Process from oldest to newest to compute running totals
    const chronological = [...ledger].reverse();

    for (const tx of chronological) {
      const key = `${tx.warehouseId}_${tx.locationId}_${tx.itemId}`;
      const item = items.find((i) => i.id === tx.itemId || i.itemCode === tx.itemCode);
      const wh = warehouses.find((w) => w.id === tx.warehouseId);
      const loc = locations.find((l) => l.id === tx.locationId);

      let record = map.get(key);
      if (!record) {
        record = {
          id: `${orgId}_${key}`,
          organizationId: orgId,
          warehouseId: tx.warehouseId,
          warehouseCode: wh?.code || tx.warehouseId,
          warehouseName: wh?.nameAr || wh?.name || tx.warehouseName,
          locationId: tx.locationId,
          locationCode: loc?.code || tx.locationCode,
          itemId: tx.itemId,
          itemCode: tx.itemCode,
          itemName: item?.nameAr || item?.name || tx.itemName,
          category: item?.category || 'General',
          unit: tx.unit,
          quantity: 0,
          weightKG: 0,
          availableQuantity: 0,
          reservedQuantity: 0,
          batchId: tx.batchId,
          status: 'OUT_OF_STOCK',
          lastTransactionDate: tx.createdAt,
          updatedAt: tx.createdAt,
        };
        map.set(key, record);
      }

      // Mathematical equation:
      // Opening + Receipts + Transfers In + Returns In + Adjustments In - Issues - Transfers Out - Returns Out - Adjustments Out
      const q = Math.abs(Number(tx.quantity) || 0);
      const w = Math.abs(Number(tx.weightKG) || 0);

      switch (tx.transactionType) {
        case 'OPENING_BALANCE':
        case 'RECEIPT':
        case 'TRANSFER_IN':
        case 'RETURN_IN':
        case 'ADJUSTMENT_IN':
        case 'PRODUCTION_OUTPUT':
          record.quantity += q;
          record.weightKG += w;
          break;
        case 'ISSUE':
        case 'TRANSFER_OUT':
        case 'RETURN_OUT':
        case 'ADJUSTMENT_OUT':
        case 'PRODUCTION_CONSUMPTION':
          record.quantity = Math.max(0, record.quantity - q);
          record.weightKG = Math.max(0, record.weightKG - w);
          break;
        case 'PRODUCTION_WASTE':
        case 'INVENTORY_STATUS_CHANGE':
          // Preserves running total balance, logged for audit & quality status tracking
          break;
      }

      record.availableQuantity = Math.max(0, record.quantity - record.reservedQuantity);
      record.lastTransactionDate = tx.createdAt;
      record.updatedAt = tx.createdAt;

      // Status derivation
      const min = item?.minimumStock ?? 0;
      if (record.quantity <= 0) {
        record.status = 'OUT_OF_STOCK';
      } else if (record.quantity <= min) {
        record.status = 'LOW_STOCK';
      } else {
        record.status = 'IN_STOCK';
      }
    }

    return Array.from(map.values()).filter((b) => b.quantity > 0);
  },

  // -----------------------------------------------------------------------
  // 6. TOTAL CURRENT STOCK FOR A SPECIFIC ITEM ACROSS ALL WAREHOUSES
  // -----------------------------------------------------------------------
  getItemTotalStock(orgId: string, itemId: string): { quantity: number; weightKG: number } {
    const balances = this.computeInventoryBalances(orgId);
    let quantity = 0;
    let weightKG = 0;

    for (const b of balances) {
      if (b.itemId === itemId || b.itemCode === itemId) {
        quantity += b.quantity;
        weightKG += b.weightKG;
      }
    }

    return { quantity, weightKG };
  },

  // -----------------------------------------------------------------------
  // 7. OPERATIONS: UNIVERSAL RECEIVING (STOCK IN)
  // -----------------------------------------------------------------------
  async executeReceipt(
    orgId: string,
    receipt: {
      supplierName: string;
      documentNumber: string;
      date: string;
      warehouseId: string;
      notes?: string;
      items: {
        itemId: string;
        locationId: string;
        quantity: number;
        unit: string;
        weightKG: number;
        batchId?: string;
        expiryDate?: string;
        notes?: string;
      }[];
    },
    user: string = 'Storekeeper'
  ): Promise<{ success: boolean; receiptId: string; transactionsCount: number }> {
    if (!receipt.items || receipt.items.length === 0) {
      throw new Error('Receipt must contain at least one line item.');
    }

    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);
    const wh = warehouses.find((w) => w.id === receipt.warehouseId);

    if (!wh) {
      throw new Error(`Target Warehouse [${receipt.warehouseId}] does not belong to this organization.`);
    }

    const receiptId = `GR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    let totalQuantity = 0;
    let totalWeightKG = 0;
    const formattedLineItems = [];

    // Create ledger transaction for each line item
    for (const itemLine of receipt.items) {
      if (itemLine.quantity <= 0) {
        throw new Error('Quantity must be strictly positive.');
      }

      const item = items.find((i) => i.id === itemLine.itemId || i.itemCode === itemLine.itemId);
      if (!item) {
        throw new Error(`Item [${itemLine.itemId}] not found in organization catalog.`);
      }

      const loc = locations.find((l) => l.id === itemLine.locationId);
      if (!loc) {
        throw new Error(`Storage location [${itemLine.locationId}] not found.`);
      }

      totalQuantity += itemLine.quantity;
      totalWeightKG += itemLine.weightKG;

      formattedLineItems.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        locationId: loc.id,
        locationCode: loc.code,
        quantity: itemLine.quantity,
        unit: itemLine.unit || item.unitOfMeasure,
        weightKG: itemLine.weightKG,
        batchId: itemLine.batchId,
        expiryDate: itemLine.expiryDate,
        notes: itemLine.notes,
      });

      // Append immutable ledger entry
      await this.recordTransaction(orgId, {
        transactionType: 'RECEIPT',
        documentId: receiptId,
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        warehouseId: wh.id,
        warehouseName: wh.nameAr || wh.name,
        locationId: loc.id,
        locationCode: loc.code,
        quantity: itemLine.quantity,
        unit: itemLine.unit || item.unitOfMeasure,
        weightKG: itemLine.weightKG,
        batchId: itemLine.batchId,
        expiryDate: itemLine.expiryDate,
        referenceNumber: receipt.documentNumber,
        reason: 'Goods Receipt',
        notes: receipt.notes || `استلام رسمي بموجب مستند توريد ${receipt.documentNumber}`,
        performedBy: user,
      });
    }

    // Persist Universal Receipt Document
    const receiptDoc: UniversalReceiptDocument = {
      id: receiptId,
      receiptNumber: receiptId,
      organizationId: orgId,
      supplierName: receipt.supplierName,
      documentNumber: receipt.documentNumber,
      date: receipt.date || now.split('T')[0],
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      status: 'CONFIRMED',
      items: formattedLineItems,
      totalQuantity,
      totalWeightKG,
      notes: receipt.notes,
      receivedBy: user,
      createdAt: now,
      confirmedAt: now,
    };

    await safeFirestoreSetDoc(FS_COL_RECEIPTS, receiptId, receiptDoc, orgId);

    return { success: true, receiptId, transactionsCount: receipt.items.length };
  },

  // -----------------------------------------------------------------------
  // 8. OPERATIONS: UNIVERSAL ISSUING (STOCK OUT)
  // -----------------------------------------------------------------------
  async executeIssue(
    orgId: string,
    issue: {
      warehouseId: string;
      locationId: string;
      itemId: string;
      quantity: number;
      unit?: string;
      weightKG?: number;
      destination: string;
      reason: string;
      referenceNumber?: string;
      batchId?: string;
      notes?: string;
    },
    user: string = 'Storekeeper'
  ): Promise<{ success: boolean; issueId: string }> {
    if (issue.quantity <= 0) {
      throw new Error('Quantity must be strictly positive.');
    }

    const items = this.getItems(orgId);
    const item = items.find((i) => i.id === issue.itemId || i.itemCode === issue.itemId);
    if (!item) throw new Error(`Item [${issue.itemId}] not found.`);

    const warehouses = this.getWarehouses(orgId);
    const wh = warehouses.find((w) => w.id === issue.warehouseId);
    if (!wh) throw new Error(`Warehouse [${issue.warehouseId}] not found.`);

    const locations = this.getLocations(orgId);
    const loc = locations.find((l) => l.id === issue.locationId);
    if (!loc) throw new Error(`Location [${issue.locationId}] not found.`);

    // Strict stock verification: Check available balance
    const balances = this.computeInventoryBalances(orgId);
    const currentLocBal = balances.find(
      (b) =>
        b.warehouseId === issue.warehouseId &&
        b.locationId === issue.locationId &&
        (b.itemId === item.id || b.itemCode === item.itemCode)
    );

    const available = currentLocBal ? currentLocBal.availableQuantity : 0;
    if (available < issue.quantity) {
      throw new Error(
        `Insufficient stock! Requested ${issue.quantity} ${item.unitOfMeasure}, but only ${available} ${item.unitOfMeasure} available in ${loc.code}.`
      );
    }

    const issueId = `ISS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    const weightKG = issue.weightKG ?? issue.quantity * (item.defaultWeight || 1);

    // Record immutable ledger transaction
    await this.recordTransaction(orgId, {
      transactionType: 'ISSUE',
      documentId: issueId,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.nameAr || item.name,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      quantity: issue.quantity,
      unit: (issue.unit as any) || item.unitOfMeasure,
      weightKG,
      batchId: issue.batchId,
      referenceNumber: issue.referenceNumber,
      reason: issue.reason || 'Material Issue',
      notes: issue.notes || `صرف إلى ${issue.destination}`,
      performedBy: user,
    });

    // Record Universal Issue Document
    const issueDoc: UniversalIssueDocument = {
      id: issueId,
      issueNumber: issueId,
      organizationId: orgId,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      destination: issue.destination,
      reason: issue.reason,
      referenceNumber: issue.referenceNumber,
      notes: issue.notes,
      items: [
        {
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          quantity: issue.quantity,
          unit: (issue.unit as any) || item.unitOfMeasure,
          weightKG,
          batchId: issue.batchId,
        },
      ],
      totalQuantity: issue.quantity,
      totalWeightKG: weightKG,
      issuedBy: user,
      status: 'CONFIRMED',
      createdAt: now,
    };

    await safeFirestoreSetDoc(FS_COL_ISSUES, issueId, issueDoc, orgId);

    return { success: true, issueId };
  },

  // -----------------------------------------------------------------------
  // 9. OPERATIONS: UNIVERSAL TRANSFERS (BETWEEN WAREHOUSES & LOCATIONS)
  // -----------------------------------------------------------------------
  async executeTransfer(
    orgId: string,
    transfer: {
      sourceWarehouseId: string;
      sourceLocationId: string;
      destinationWarehouseId: string;
      destinationLocationId: string;
      itemId: string;
      quantity: number;
      unit?: string;
      weightKG?: number;
      batchId?: string;
      reason?: string;
      notes?: string;
    },
    user: string = 'Storekeeper'
  ): Promise<{ success: boolean; transferId: string }> {
    if (transfer.quantity <= 0) {
      throw new Error('Transfer quantity must be positive.');
    }

    if (
      transfer.sourceWarehouseId === transfer.destinationWarehouseId &&
      transfer.sourceLocationId === transfer.destinationLocationId
    ) {
      throw new Error('Source and destination location cannot be identical.');
    }

    const items = this.getItems(orgId);
    const item = items.find((i) => i.id === transfer.itemId || i.itemCode === transfer.itemId);
    if (!item) throw new Error(`Item [${transfer.itemId}] not found.`);

    const warehouses = this.getWarehouses(orgId);
    const srcWh = warehouses.find((w) => w.id === transfer.sourceWarehouseId);
    const dstWh = warehouses.find((w) => w.id === transfer.destinationWarehouseId);
    if (!srcWh || !dstWh) throw new Error('Warehouse not found.');

    const locations = this.getLocations(orgId);
    const srcLoc = locations.find((l) => l.id === transfer.sourceLocationId);
    const dstLoc = locations.find((l) => l.id === transfer.destinationLocationId);
    if (!srcLoc || !dstLoc) throw new Error('Storage location not found.');

    // Check source availability
    const balances = this.computeInventoryBalances(orgId);
    const sourceBal = balances.find(
      (b) =>
        b.warehouseId === srcWh.id &&
        b.locationId === srcLoc.id &&
        (b.itemId === item.id || b.itemCode === item.itemCode)
    );

    const available = sourceBal ? sourceBal.availableQuantity : 0;
    if (available < transfer.quantity) {
      throw new Error(
        `Insufficient stock for transfer! Source has ${available} ${item.unitOfMeasure}, requested ${transfer.quantity}.`
      );
    }

    const transferId = `TRF-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    const weightKG = transfer.weightKG ?? transfer.quantity * (item.defaultWeight || 1);

    // 1. Immutable TRANSFER_OUT at source
    await this.recordTransaction(orgId, {
      transactionType: 'TRANSFER_OUT',
      documentId: transferId,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.nameAr || item.name,
      warehouseId: srcWh.id,
      warehouseName: srcWh.nameAr || srcWh.name,
      locationId: srcLoc.id,
      locationCode: srcLoc.code,
      sourceWarehouseId: srcWh.id,
      sourceLocationId: srcLoc.id,
      destinationWarehouseId: dstWh.id,
      destinationLocationId: dstLoc.id,
      quantity: transfer.quantity,
      unit: (transfer.unit as any) || item.unitOfMeasure,
      weightKG,
      batchId: transfer.batchId,
      reason: transfer.reason || 'Location Transfer',
      notes: `نقل صادر إلى [${dstWh.code} - ${dstLoc.code}]`,
      performedBy: user,
    });

    // 2. Immutable TRANSFER_IN at destination
    await this.recordTransaction(orgId, {
      transactionType: 'TRANSFER_IN',
      documentId: transferId,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.nameAr || item.name,
      warehouseId: dstWh.id,
      warehouseName: dstWh.nameAr || dstWh.name,
      locationId: dstLoc.id,
      locationCode: dstLoc.code,
      sourceWarehouseId: srcWh.id,
      sourceLocationId: srcLoc.id,
      destinationWarehouseId: dstWh.id,
      destinationLocationId: dstLoc.id,
      quantity: transfer.quantity,
      unit: (transfer.unit as any) || item.unitOfMeasure,
      weightKG,
      batchId: transfer.batchId,
      reason: transfer.reason || 'Location Transfer',
      notes: `نقل وارد من [${srcWh.code} - ${srcLoc.code}]`,
      performedBy: user,
    });

    // Record Transfer Document
    const transferDoc: UniversalTransferDocument = {
      id: transferId,
      transferNumber: transferId,
      organizationId: orgId,
      sourceWarehouseId: srcWh.id,
      sourceWarehouseName: srcWh.nameAr || srcWh.name,
      sourceLocationId: srcLoc.id,
      sourceLocationCode: srcLoc.code,
      destinationWarehouseId: dstWh.id,
      destinationWarehouseName: dstWh.nameAr || dstWh.name,
      destinationLocationId: dstLoc.id,
      destinationLocationCode: dstLoc.code,
      items: [
        {
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          quantity: transfer.quantity,
          unit: (transfer.unit as any) || item.unitOfMeasure,
          weightKG,
          batchId: transfer.batchId,
        },
      ],
      totalQuantity: transfer.quantity,
      totalWeightKG: weightKG,
      reason: transfer.reason,
      notes: transfer.notes,
      performedBy: user,
      status: 'CONFIRMED',
      createdAt: now,
    };

    await safeFirestoreSetDoc(FS_COL_TRANSFERS, transferId, transferDoc, orgId);

    return { success: true, transferId };
  },

  // -----------------------------------------------------------------------
  // 10. OPERATIONS: UNIVERSAL STOCK ADJUSTMENTS (MANDATORY AUDITED REASON)
  // -----------------------------------------------------------------------
  async executeAdjustment(
    orgId: string,
    adjustment: {
      warehouseId: string;
      locationId: string;
      itemId: string;
      adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';
      quantityDelta: number;
      unit?: string;
      weightKGDelta?: number;
      reason: 'Physical Count' | 'Damaged' | 'Lost' | 'Found' | 'Correction' | 'Other';
      notes?: string;
    },
    user: string = 'Storekeeper'
  ): Promise<{ success: boolean; adjustmentId: string }> {
    if (adjustment.quantityDelta <= 0) {
      throw new Error('Adjustment delta must be positive.');
    }

    if (!adjustment.reason) {
      throw new Error('Reason is mandatory for inventory adjustments.');
    }

    const items = this.getItems(orgId);
    const item = items.find((i) => i.id === adjustment.itemId || i.itemCode === adjustment.itemId);
    if (!item) throw new Error('Item not found.');

    const warehouses = this.getWarehouses(orgId);
    const wh = warehouses.find((w) => w.id === adjustment.warehouseId);
    if (!wh) throw new Error('Warehouse not found.');

    const locations = this.getLocations(orgId);
    const loc = locations.find((l) => l.id === adjustment.locationId);
    if (!loc) throw new Error('Location not found.');

    const balances = this.computeInventoryBalances(orgId);
    const currentBal = balances.find(
      (b) =>
        b.warehouseId === wh.id &&
        b.locationId === loc.id &&
        (b.itemId === item.id || b.itemCode === item.itemCode)
    );

    const prevQty = currentBal ? currentBal.quantity : 0;

    // Check for negative balance protection if decreasing
    if (adjustment.adjustmentType === 'ADJUSTMENT_OUT' && prevQty < adjustment.quantityDelta) {
      throw new Error(
        `Cannot adjust out ${adjustment.quantityDelta} ${item.unitOfMeasure}. Only ${prevQty} exists in ${loc.code}.`
      );
    }

    const newQty =
      adjustment.adjustmentType === 'ADJUSTMENT_IN'
        ? prevQty + adjustment.quantityDelta
        : Math.max(0, prevQty - adjustment.quantityDelta);

    const adjustmentId = `ADJ-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();
    const weightKG =
      adjustment.weightKGDelta ?? adjustment.quantityDelta * (item.defaultWeight || 1);

    // Record immutable ledger transaction
    await this.recordTransaction(orgId, {
      transactionType: adjustment.adjustmentType,
      documentId: adjustmentId,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.nameAr || item.name,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      quantity: adjustment.quantityDelta,
      unit: (adjustment.unit as any) || item.unitOfMeasure,
      weightKG,
      reason: adjustment.reason,
      notes: adjustment.notes || `تسوية جردية معتمدة: ${adjustment.reason} (${prevQty} -> ${newQty})`,
      performedBy: user,
    });

    // Record Universal Adjustment Document
    const adjDoc: UniversalAdjustmentDocument = {
      id: adjustmentId,
      adjustmentNumber: adjustmentId,
      organizationId: orgId,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.nameAr || item.name,
      adjustmentType: adjustment.adjustmentType,
      quantityDelta: adjustment.quantityDelta,
      unit: (adjustment.unit as any) || item.unitOfMeasure,
      weightKGDelta: weightKG,
      previousQuantity: prevQty,
      newQuantity: newQty,
      reason: adjustment.reason,
      notes: adjustment.notes,
      performedBy: user,
      status: 'CONFIRMED',
      createdAt: now,
    };

    await safeFirestoreSetDoc(FS_COL_ADJUSTMENTS, adjustmentId, adjDoc, orgId);

    try {
      const evt = WebhookService.createEvent(
        'inventory.adjustment.confirmed',
        orgId,
        {
          adjustmentId,
          warehouseId: adjDoc.warehouseId,
          locationId: adjDoc.locationId,
          itemId: adjDoc.itemId,
          itemCode: adjDoc.itemCode,
          adjustmentType: adjDoc.adjustmentType,
          quantityDelta: adjDoc.quantityDelta,
          unit: adjDoc.unit,
          weightKGDelta: adjDoc.weightKGDelta,
          previousQuantity: adjDoc.previousQuantity,
          newQuantity: adjDoc.newQuantity,
          reason: adjDoc.reason,
          confirmedAt: adjDoc.createdAt,
        },
        adjustmentId
      );
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return { success: true, adjustmentId };
  },

  // -----------------------------------------------------------------------
  // DOCUMENT NUMBER GENERATOR (ORGANIZATION-ISOLATED SEQUENCES)
  // -----------------------------------------------------------------------
  generateDocumentNumber(orgId: string, prefix: 'GR' | 'GI' | 'TR' | 'ADJ' | 'RTN' | 'CNT'): string {
    const year = new Date().getFullYear();
    const ledger = this.getLedger(orgId);
    const count = ledger.length + Math.floor(10 + Math.random() * 89);
    return `${prefix}-${year}-${String(count).padStart(5, '0')}`;
  },

  // -----------------------------------------------------------------------
  // DOCUMENT GETTERS (WITH CACHE & REAL-TIME FIRESTORE BACKING)
  // -----------------------------------------------------------------------
  getReceipts(orgId: string, status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'): UniversalReceiptDocument[] {
    const all = getLocalCache<UniversalReceiptDocument>(CACHE_KEY_RECEIPTS, []);
    return all.filter((r) => r.organizationId === orgId && (!status || r.status === status));
  },

  getReceipt(orgId: string, receiptId: string): UniversalReceiptDocument | undefined {
    return this.getReceipts(orgId).find((r) => r.id === receiptId || r.receiptNumber === receiptId);
  },

  getIssues(orgId: string, status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'): UniversalIssueDocument[] {
    const all = getLocalCache<UniversalIssueDocument>(CACHE_KEY_ISSUES, []);
    return all.filter((i) => i.organizationId === orgId && (!status || i.status === status));
  },

  getIssue(orgId: string, issueId: string): UniversalIssueDocument | undefined {
    return this.getIssues(orgId).find((i) => i.id === issueId || i.issueNumber === issueId);
  },

  getTransfers(orgId: string, status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'): UniversalTransferDocument[] {
    const all = getLocalCache<UniversalTransferDocument>(CACHE_KEY_TRANSFERS, []);
    return all.filter((t) => t.organizationId === orgId && (!status || t.status === status));
  },

  getTransfer(orgId: string, transferId: string): UniversalTransferDocument | undefined {
    return this.getTransfers(orgId).find((t) => t.id === transferId || t.transferNumber === transferId);
  },

  getAdjustments(orgId: string): UniversalAdjustmentDocument[] {
    const all = getLocalCache<UniversalAdjustmentDocument>(CACHE_KEY_ADJUSTMENTS, []);
    return all.filter((a) => a.organizationId === orgId);
  },

  getReturns(orgId: string, status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'): UniversalReturnDocument[] {
    const all = getLocalCache<UniversalReturnDocument>(CACHE_KEY_RETURNS, []);
    return all.filter((r) => r.organizationId === orgId && (!status || r.status === status));
  },

  getStockCounts(orgId: string, status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'): UniversalStockCountDocument[] {
    const all = getLocalCache<UniversalStockCountDocument>(CACHE_KEY_STOCKTAKES, []);
    return all.filter((c) => c.organizationId === orgId && (!status || c.status === status));
  },

  // -----------------------------------------------------------------------
  // ADVANCED MULTI-LINE GOODS RECEIPT (DRAFT VS CONFIRMED VS CANCELLED)
  // -----------------------------------------------------------------------
  async createReceiptDocument(
    orgId: string,
    data: {
      supplierName: string;
      supplierId?: string;
      documentNumber: string;
      date: string;
      warehouseId: string;
      notes?: string;
      items: {
        itemId: string;
        locationId: string;
        quantity: number;
        unit?: string;
        weightKG?: number;
        batchId?: string;
        expiryDate?: string;
        serialNumber?: string;
        notes?: string;
      }[];
    },
    asDraft: boolean = false,
    user: string = 'Storekeeper'
  ): Promise<UniversalReceiptDocument> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Receipt must contain at least one line item.');
    }

    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);
    const wh = warehouses.find((w) => w.id === data.warehouseId);
    if (!wh) throw new Error('Warehouse not found.');

    const receiptId = this.generateDocumentNumber(orgId, 'GR');
    const now = new Date().toISOString();

    let totalQuantity = 0;
    let totalWeightKG = 0;
    const formattedLines = [];

    for (const line of data.items) {
      if (line.quantity <= 0) throw new Error('Quantity must be greater than zero.');
      const item = items.find((i) => i.id === line.itemId || i.itemCode === line.itemId);
      if (!item) throw new Error(`Item [${line.itemId}] not found.`);
      const loc = locations.find((l) => l.id === line.locationId);
      if (!loc) throw new Error(`Location [${line.locationId}] not found.`);

      const weight = line.weightKG ?? line.quantity * (item.defaultWeight || 1);
      totalQuantity += line.quantity;
      totalWeightKG += weight;

      formattedLines.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        locationId: loc.id,
        locationCode: loc.code,
        quantity: line.quantity,
        unit: line.unit || item.unitOfMeasure,
        weightKG: weight,
        batchId: line.batchId,
        expiryDate: line.expiryDate,
        notes: line.notes,
      });

      // ONLY if confirmed, write to immutable ledger!
      if (!asDraft) {
        await this.recordTransaction(orgId, {
          transactionType: 'RECEIPT',
          documentId: receiptId,
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          warehouseId: wh.id,
          warehouseName: wh.nameAr || wh.name,
          locationId: loc.id,
          locationCode: loc.code,
          quantity: line.quantity,
          unit: line.unit || item.unitOfMeasure,
          weightKG: weight,
          batchId: line.batchId,
          expiryDate: line.expiryDate,
          referenceNumber: data.documentNumber,
          reason: 'Goods Receipt',
          notes: data.notes || `توريد رسمي بموجب إشعار ${data.documentNumber}`,
          performedBy: user,
        });
      }
    }

    const docRecord: UniversalReceiptDocument = {
      id: receiptId,
      receiptNumber: receiptId,
      organizationId: orgId,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      documentNumber: data.documentNumber,
      date: data.date || now.split('T')[0],
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      status: asDraft ? 'DRAFT' : 'CONFIRMED',
      items: formattedLines,
      totalQuantity,
      totalWeightKG,
      notes: data.notes,
      receivedBy: user,
      createdAt: now,
      confirmedAt: asDraft ? undefined : now,
    };

    const all = getLocalCache<UniversalReceiptDocument>(CACHE_KEY_RECEIPTS, []);
    all.unshift(docRecord);
    setLocalCache(CACHE_KEY_RECEIPTS, all);

    await safeFirestoreSetDoc(FS_COL_RECEIPTS, receiptId, docRecord, orgId);

    if (!asDraft) {
      try {
        const evt = WebhookService.createEvent(
          'inventory.receipt.confirmed',
          orgId,
          {
            receiptId: docRecord.id,
            receiptNumber: docRecord.receiptNumber,
            warehouseId: docRecord.warehouseId,
            supplierName: docRecord.supplierName,
            totalQuantity: docRecord.totalQuantity,
            totalWeightKG: docRecord.totalWeightKG,
            linesCount: docRecord.items.length,
            confirmedAt: docRecord.confirmedAt,
          },
          docRecord.id
        );
        WebhookService.dispatchEvent(evt).catch(() => {});
      } catch {}
    }

    return docRecord;
  },

  async confirmReceiptDocument(orgId: string, receiptId: string, user: string): Promise<boolean> {
    const all = getLocalCache<UniversalReceiptDocument>(CACHE_KEY_RECEIPTS, []);
    const idx = all.findIndex((r) => r.id === receiptId && r.organizationId === orgId);
    if (idx === -1) throw new Error('Receipt not found.');

    const receipt = all[idx];
    if (receipt.status !== 'DRAFT') {
      throw new Error(`Cannot confirm receipt in status: ${receipt.status}`);
    }

    // Now write every line item to the immutable ledger
    const now = new Date().toISOString();
    for (const line of receipt.items) {
      await this.recordTransaction(orgId, {
        transactionType: 'RECEIPT',
        documentId: receipt.id,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        warehouseId: receipt.warehouseId,
        warehouseName: receipt.warehouseName,
        locationId: line.locationId,
        locationCode: line.locationCode,
        quantity: line.quantity,
        unit: line.unit,
        weightKG: line.weightKG,
        batchId: line.batchId,
        referenceNumber: receipt.documentNumber,
        reason: 'Confirmed Goods Receipt',
        notes: receipt.notes || 'تأكيد استلام بضائع مسودة',
        performedBy: user,
      });
    }

    receipt.status = 'CONFIRMED';
    receipt.confirmedAt = now;
    all[idx] = receipt;
    setLocalCache(CACHE_KEY_RECEIPTS, all);

    await safeFirestoreSetDoc(FS_COL_RECEIPTS, receiptId, receipt, orgId, true);

    try {
      const evt = WebhookService.createEvent(
        'inventory.receipt.confirmed',
        orgId,
        {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          warehouseId: receipt.warehouseId,
          supplierName: receipt.supplierName,
          totalQuantity: receipt.totalQuantity,
          totalWeightKG: receipt.totalWeightKG,
          linesCount: receipt.items.length,
          confirmedAt: receipt.confirmedAt,
        },
        receipt.id
      );
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return true;
  },

  async cancelReceiptDocument(orgId: string, receiptId: string, reason: string, user: string): Promise<boolean> {
    const all = getLocalCache<UniversalReceiptDocument>(CACHE_KEY_RECEIPTS, []);
    const idx = all.findIndex((r) => r.id === receiptId && r.organizationId === orgId);
    if (idx === -1) throw new Error('Receipt not found.');

    const receipt = all[idx];
    if (receipt.status === 'CANCELLED') throw new Error('Receipt is already cancelled.');

    // If it was already CONFIRMED, create compensating reversal transactions to balance stock!
    if (receipt.status === 'CONFIRMED') {
      for (const line of receipt.items) {
        await this.recordTransaction(orgId, {
          transactionType: 'RETURN_OUT',
          documentId: `${receipt.id}-REV`,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          warehouseId: receipt.warehouseId,
          warehouseName: receipt.warehouseName,
          locationId: line.locationId,
          locationCode: line.locationCode,
          quantity: line.quantity,
          unit: line.unit,
          weightKG: line.weightKG,
          referenceNumber: receipt.documentNumber,
          reason: `Receipt Cancelled Reversal: ${reason}`,
          notes: `إلغاء قيد سند توريد مؤكد: ${reason}`,
          performedBy: user,
        });
      }
    }

    receipt.status = 'CANCELLED';
    receipt.notes = `${receipt.notes || ''} [Cancelled by ${user}: ${reason}]`;
    all[idx] = receipt;
    setLocalCache(CACHE_KEY_RECEIPTS, all);

    await safeFirestoreSetDoc(FS_COL_RECEIPTS, receiptId, receipt, orgId, true);

    return true;
  },

  // -----------------------------------------------------------------------
  // ADVANCED MULTI-LINE STOCK ISSUE (DRAFT VS CONFIRMED VS CANCELLED)
  // -----------------------------------------------------------------------
  async createIssueDocument(
    orgId: string,
    data: {
      warehouseId: string;
      locationId: string;
      destination: string;
      department?: string;
      referenceNumber?: string;
      reason: string;
      notes?: string;
      items: {
        itemId: string;
        quantity: number;
        unit?: string;
        weightKG?: number;
        batchId?: string;
        serialNumber?: string;
        notes?: string;
      }[];
    },
    asDraft: boolean = false,
    user: string = 'Storekeeper'
  ): Promise<UniversalIssueDocument> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Stock issue must contain at least one item line.');
    }

    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);
    const wh = warehouses.find((w) => w.id === data.warehouseId);
    if (!wh) throw new Error('Warehouse not found.');
    const loc = locations.find((l) => l.id === data.locationId);
    if (!loc) throw new Error('Location not found.');

    const issueId = this.generateDocumentNumber(orgId, 'GI');
    const now = new Date().toISOString();
    const balances = this.computeInventoryBalances(orgId);

    let totalQuantity = 0;
    let totalWeightKG = 0;
    const formattedLines = [];

    for (const line of data.items) {
      if (line.quantity <= 0) throw new Error('Quantity must be greater than zero.');
      const item = items.find((i) => i.id === line.itemId || i.itemCode === line.itemId);
      if (!item) throw new Error(`Item [${line.itemId}] not found.`);

      // Stock check if confirmed
      if (!asDraft) {
        const bal = balances.find(
          (b) =>
            b.warehouseId === wh.id &&
            b.locationId === loc.id &&
            (b.itemId === item.id || b.itemCode === item.itemCode)
        );
        const avail = bal ? bal.availableQuantity : 0;
        if (avail < line.quantity) {
          throw new Error(
            `Insufficient stock for ${item.nameAr || item.name}! Available: ${avail} ${item.unitOfMeasure}, Requested: ${line.quantity}.`
          );
        }
      }

      const weight = line.weightKG ?? line.quantity * (item.defaultWeight || 1);
      totalQuantity += line.quantity;
      totalWeightKG += weight;

      formattedLines.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        quantity: line.quantity,
        unit: line.unit || item.unitOfMeasure,
        weightKG: weight,
        batchId: line.batchId,
        serialNumber: line.serialNumber,
        notes: line.notes,
      });

      // ONLY if confirmed, write to immutable ledger!
      if (!asDraft) {
        await this.recordTransaction(orgId, {
          transactionType: 'ISSUE',
          documentId: issueId,
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          warehouseId: wh.id,
          warehouseName: wh.nameAr || wh.name,
          locationId: loc.id,
          locationCode: loc.code,
          quantity: line.quantity,
          unit: line.unit || item.unitOfMeasure,
          weightKG: weight,
          batchId: line.batchId,
          serialId: line.serialNumber,
          referenceNumber: data.referenceNumber,
          reason: data.reason,
          notes: data.notes || `صرف إلى ${data.destination}`,
          performedBy: user,
        });
      }
    }

    const docRecord: UniversalIssueDocument = {
      id: issueId,
      issueNumber: issueId,
      organizationId: orgId,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      department: data.department,
      destination: data.destination,
      reason: data.reason,
      referenceNumber: data.referenceNumber,
      notes: data.notes,
      items: formattedLines,
      totalQuantity,
      totalWeightKG,
      issuedBy: user,
      status: asDraft ? 'DRAFT' : 'CONFIRMED',
      createdAt: now,
      confirmedAt: asDraft ? undefined : now,
    };

    const all = getLocalCache<UniversalIssueDocument>(CACHE_KEY_ISSUES, []);
    all.unshift(docRecord);
    setLocalCache(CACHE_KEY_ISSUES, all);

    await safeFirestoreSetDoc(FS_COL_ISSUES, issueId, docRecord, orgId);

    if (!asDraft) {
      try {
        const evt = WebhookService.createEvent(
          'inventory.issue.confirmed',
          orgId,
          {
            issueId: docRecord.id,
            issueNumber: docRecord.issueNumber,
            warehouseId: docRecord.warehouseId,
            destination: docRecord.destination,
            department: docRecord.department,
            reason: docRecord.reason,
            totalQuantity: docRecord.totalQuantity,
            totalWeightKG: docRecord.totalWeightKG,
            linesCount: docRecord.items.length,
            confirmedAt: docRecord.confirmedAt,
          },
          docRecord.id
        );
        WebhookService.dispatchEvent(evt).catch(() => {});
      } catch {}
    }

    return docRecord;
  },

  async confirmIssueDocument(orgId: string, issueId: string, user: string): Promise<boolean> {
    const all = getLocalCache<UniversalIssueDocument>(CACHE_KEY_ISSUES, []);
    const idx = all.findIndex((i) => i.id === issueId && i.organizationId === orgId);
    if (idx === -1) throw new Error('Issue document not found.');

    const issue = all[idx];
    if (issue.status !== 'DRAFT') throw new Error(`Cannot confirm issue in status: ${issue.status}`);

    const balances = this.computeInventoryBalances(orgId);
    for (const line of issue.items) {
      const bal = balances.find(
        (b) =>
          b.warehouseId === issue.warehouseId &&
          b.locationId === issue.locationId &&
          (b.itemId === line.itemId || b.itemCode === line.itemCode)
      );
      const avail = bal ? bal.availableQuantity : 0;
      if (avail < line.quantity) {
        throw new Error(
          `Insufficient stock to confirm issue for ${line.itemName}! Available: ${avail}, Requested: ${line.quantity}.`
        );
      }
    }

    const now = new Date().toISOString();
    for (const line of issue.items) {
      await this.recordTransaction(orgId, {
        transactionType: 'ISSUE',
        documentId: issue.id,
        itemId: line.itemId,
        itemCode: line.itemCode,
        itemName: line.itemName,
        warehouseId: issue.warehouseId,
        warehouseName: issue.warehouseName,
        locationId: issue.locationId,
        locationCode: issue.locationCode,
        quantity: line.quantity,
        unit: line.unit,
        weightKG: line.weightKG,
        batchId: line.batchId,
        serialId: line.serialNumber,
        referenceNumber: issue.referenceNumber,
        reason: issue.reason,
        notes: issue.notes || `تأكيد صرف إلى ${issue.destination}`,
        performedBy: user,
      });
    }

    issue.status = 'CONFIRMED';
    issue.confirmedAt = now;
    all[idx] = issue;
    setLocalCache(CACHE_KEY_ISSUES, all);

    await safeFirestoreSetDoc(FS_COL_ISSUES, issueId, issue, orgId, true);

    try {
      const evt = WebhookService.createEvent(
        'inventory.issue.confirmed',
        orgId,
        {
          issueId: issue.id,
          issueNumber: issue.issueNumber,
          warehouseId: issue.warehouseId,
          destination: issue.destination,
          department: issue.department,
          reason: issue.reason,
          totalQuantity: issue.totalQuantity,
          totalWeightKG: issue.totalWeightKG,
          linesCount: issue.items.length,
          confirmedAt: issue.confirmedAt,
        },
        issue.id
      );
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return true;
  },

  async cancelIssueDocument(orgId: string, issueId: string, reason: string, user: string): Promise<boolean> {
    const all = getLocalCache<UniversalIssueDocument>(CACHE_KEY_ISSUES, []);
    const idx = all.findIndex((i) => i.id === issueId && i.organizationId === orgId);
    if (idx === -1) throw new Error('Issue document not found.');

    const issue = all[idx];
    if (issue.status === 'CANCELLED') throw new Error('Issue is already cancelled.');

    if (issue.status === 'CONFIRMED') {
      for (const line of issue.items) {
        await this.recordTransaction(orgId, {
          transactionType: 'RETURN_IN',
          documentId: `${issue.id}-REV`,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          warehouseId: issue.warehouseId,
          warehouseName: issue.warehouseName,
          locationId: issue.locationId,
          locationCode: issue.locationCode,
          quantity: line.quantity,
          unit: line.unit,
          weightKG: line.weightKG,
          referenceNumber: issue.referenceNumber,
          reason: `Issue Cancelled Reversal: ${reason}`,
          notes: `إلغاء قيد سند صرف مؤكد: ${reason}`,
          performedBy: user,
        });
      }
    }

    issue.status = 'CANCELLED';
    issue.cancelledAt = new Date().toISOString();
    issue.cancelReason = reason;
    all[idx] = issue;
    setLocalCache(CACHE_KEY_ISSUES, all);

    await safeFirestoreSetDoc(FS_COL_ISSUES, issueId, issue, orgId, true);

    return true;
  },

  // -----------------------------------------------------------------------
  // ADVANCED MULTI-LINE TRANSFERS (INTER-WAREHOUSE & INTER-LOCATION)
  // -----------------------------------------------------------------------
  async createTransferDocument(
    orgId: string,
    data: {
      sourceWarehouseId: string;
      sourceLocationId: string;
      destinationWarehouseId: string;
      destinationLocationId: string;
      reason?: string;
      notes?: string;
      items: {
        itemId: string;
        quantity: number;
        unit?: string;
        weightKG?: number;
        batchId?: string;
        serialNumber?: string;
      }[];
    },
    asDraft: boolean = false,
    user: string = 'Storekeeper'
  ): Promise<UniversalTransferDocument> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Transfer must have at least one line item.');
    }

    if (
      data.sourceWarehouseId === data.destinationWarehouseId &&
      data.sourceLocationId === data.destinationLocationId
    ) {
      throw new Error('Source and destination locations cannot be identical.');
    }

    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);
    const srcWh = warehouses.find((w) => w.id === data.sourceWarehouseId);
    const dstWh = warehouses.find((w) => w.id === data.destinationWarehouseId);
    const srcLoc = locations.find((l) => l.id === data.sourceLocationId);
    const dstLoc = locations.find((l) => l.id === data.destinationLocationId);

    if (!srcWh || !dstWh || !srcLoc || !dstLoc) {
      throw new Error('Specified warehouse or location not found.');
    }

    const transferId = this.generateDocumentNumber(orgId, 'TR');
    const now = new Date().toISOString();
    const balances = this.computeInventoryBalances(orgId);

    let totalQuantity = 0;
    let totalWeightKG = 0;
    const formattedLines = [];

    for (const line of data.items) {
      if (line.quantity <= 0) throw new Error('Quantity must be greater than zero.');
      const item = items.find((i) => i.id === line.itemId || i.itemCode === line.itemId);
      if (!item) throw new Error(`Item [${line.itemId}] not found.`);

      if (!asDraft) {
        const bal = balances.find(
          (b) =>
            b.warehouseId === srcWh.id &&
            b.locationId === srcLoc.id &&
            (b.itemId === item.id || b.itemCode === item.itemCode)
        );
        const avail = bal ? bal.availableQuantity : 0;
        if (avail < line.quantity) {
          throw new Error(
            `Insufficient stock for transfer in ${srcLoc.code}! Available: ${avail}, Requested: ${line.quantity}.`
          );
        }
      }

      const weight = line.weightKG ?? line.quantity * (item.defaultWeight || 1);
      totalQuantity += line.quantity;
      totalWeightKG += weight;

      formattedLines.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        quantity: line.quantity,
        unit: line.unit || item.unitOfMeasure,
        weightKG: weight,
        batchId: line.batchId,
        serialNumber: line.serialNumber,
      });

      // Linked OUT and IN ledger entries sharing the transfer ID!
      if (!asDraft) {
        await this.recordTransaction(orgId, {
          transactionType: 'TRANSFER_OUT',
          documentId: transferId,
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          warehouseId: srcWh.id,
          warehouseName: srcWh.nameAr || srcWh.name,
          locationId: srcLoc.id,
          locationCode: srcLoc.code,
          destinationWarehouseId: dstWh.id,
          destinationLocationId: dstLoc.id,
          quantity: line.quantity,
          unit: line.unit || item.unitOfMeasure,
          weightKG: weight,
          batchId: line.batchId,
          reason: data.reason || 'Stock Relocation',
          notes: data.notes || `مناقلة خارجة إلى ${dstWh.name} / ${dstLoc.code}`,
          performedBy: user,
        });

        await this.recordTransaction(orgId, {
          transactionType: 'TRANSFER_IN',
          documentId: transferId,
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          warehouseId: dstWh.id,
          warehouseName: dstWh.nameAr || dstWh.name,
          locationId: dstLoc.id,
          locationCode: dstLoc.code,
          sourceWarehouseId: srcWh.id,
          sourceLocationId: srcLoc.id,
          quantity: line.quantity,
          unit: line.unit || item.unitOfMeasure,
          weightKG: weight,
          batchId: line.batchId,
          reason: data.reason || 'Stock Relocation',
          notes: data.notes || `مناقلة واردة من ${srcWh.name} / ${srcLoc.code}`,
          performedBy: user,
        });
      }
    }

    const docRecord: UniversalTransferDocument = {
      id: transferId,
      transferNumber: transferId,
      organizationId: orgId,
      sourceWarehouseId: srcWh.id,
      sourceWarehouseName: srcWh.nameAr || srcWh.name,
      sourceLocationId: srcLoc.id,
      sourceLocationCode: srcLoc.code,
      destinationWarehouseId: dstWh.id,
      destinationWarehouseName: dstWh.nameAr || dstWh.name,
      destinationLocationId: dstLoc.id,
      destinationLocationCode: dstLoc.code,
      items: formattedLines,
      totalQuantity,
      totalWeightKG,
      reason: data.reason,
      notes: data.notes,
      performedBy: user,
      status: asDraft ? 'DRAFT' : 'CONFIRMED',
      createdAt: now,
      confirmedAt: asDraft ? undefined : now,
    };

    const all = getLocalCache<UniversalTransferDocument>(CACHE_KEY_TRANSFERS, []);
    all.unshift(docRecord);
    setLocalCache(CACHE_KEY_TRANSFERS, all);

    await safeFirestoreSetDoc(FS_COL_TRANSFERS, transferId, docRecord, orgId);

    if (!asDraft) {
      try {
        const evt = WebhookService.createEvent(
          'inventory.transfer.completed',
          orgId,
          {
            transferId: docRecord.id,
            transferNumber: docRecord.transferNumber,
            sourceWarehouseId: docRecord.sourceWarehouseId,
            sourceLocationId: docRecord.sourceLocationId,
            destinationWarehouseId: docRecord.destinationWarehouseId,
            destinationLocationId: docRecord.destinationLocationId,
            totalQuantity: docRecord.totalQuantity,
            totalWeightKG: docRecord.totalWeightKG,
            linesCount: docRecord.items.length,
            reason: docRecord.reason,
            confirmedAt: docRecord.confirmedAt,
          },
          docRecord.id
        );
        WebhookService.dispatchEvent(evt).catch(() => {});
      } catch {}
    }

    return docRecord;
  },

  // -----------------------------------------------------------------------
  // RETURNS (RETURN IN & RETURN OUT)
  // -----------------------------------------------------------------------
  async createReturnDocument(
    orgId: string,
    data: {
      returnType: 'RETURN_IN' | 'RETURN_OUT';
      originalDocumentRef?: string;
      warehouseId: string;
      locationId: string;
      partyName: string;
      reason: string;
      notes?: string;
      items: {
        itemId: string;
        quantity: number;
        unit?: string;
        weightKG?: number;
        batchId?: string;
        notes?: string;
      }[];
    },
    asDraft: boolean = false,
    user: string = 'Storekeeper'
  ): Promise<UniversalReturnDocument> {
    if (!data.items || data.items.length === 0) throw new Error('Return must contain items.');

    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);
    const wh = warehouses.find((w) => w.id === data.warehouseId);
    if (!wh) throw new Error('Warehouse not found.');
    const loc = locations.find((l) => l.id === data.locationId);
    if (!loc) throw new Error('Location not found.');

    const returnId = this.generateDocumentNumber(orgId, 'RTN');
    const now = new Date().toISOString();
    const balances = this.computeInventoryBalances(orgId);

    let totalQuantity = 0;
    let totalWeightKG = 0;
    const formattedLines = [];

    for (const line of data.items) {
      if (line.quantity <= 0) throw new Error('Quantity must be greater than zero.');
      const item = items.find((i) => i.id === line.itemId || i.itemCode === line.itemId);
      if (!item) throw new Error(`Item [${line.itemId}] not found.`);

      // For RETURN_OUT, verify available stock before returning to supplier
      if (!asDraft && data.returnType === 'RETURN_OUT') {
        const bal = balances.find(
          (b) =>
            b.warehouseId === wh.id &&
            b.locationId === loc.id &&
            (b.itemId === item.id || b.itemCode === item.itemCode)
        );
        const avail = bal ? bal.availableQuantity : 0;
        if (avail < line.quantity) {
          throw new Error(`Insufficient stock to return out! Available: ${avail}, Requested: ${line.quantity}.`);
        }
      }

      const weight = line.weightKG ?? line.quantity * (item.defaultWeight || 1);
      totalQuantity += line.quantity;
      totalWeightKG += weight;

      formattedLines.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        quantity: line.quantity,
        unit: line.unit || item.unitOfMeasure,
        weightKG: weight,
        batchId: line.batchId,
        notes: line.notes,
      });

      if (!asDraft) {
        await this.recordTransaction(orgId, {
          transactionType: data.returnType,
          documentId: returnId,
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          warehouseId: wh.id,
          warehouseName: wh.nameAr || wh.name,
          locationId: loc.id,
          locationCode: loc.code,
          quantity: line.quantity,
          unit: line.unit || item.unitOfMeasure,
          weightKG: weight,
          batchId: line.batchId,
          referenceNumber: data.originalDocumentRef,
          reason: data.reason,
          notes: data.notes || `مردودات (${data.returnType}): ${data.partyName}`,
          performedBy: user,
        });
      }
    }

    const docRecord: UniversalReturnDocument = {
      id: returnId,
      returnNumber: returnId,
      organizationId: orgId,
      returnType: data.returnType,
      originalDocumentRef: data.originalDocumentRef,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      partyName: data.partyName,
      reason: data.reason,
      notes: data.notes,
      items: formattedLines,
      totalQuantity,
      totalWeightKG,
      status: asDraft ? 'DRAFT' : 'CONFIRMED',
      performedBy: user,
      createdAt: now,
      confirmedAt: asDraft ? undefined : now,
    };

    const all = getLocalCache<UniversalReturnDocument>(CACHE_KEY_RETURNS, []);
    all.unshift(docRecord);
    setLocalCache(CACHE_KEY_RETURNS, all);

    await safeFirestoreSetDoc(FS_COL_RETURNS, returnId, docRecord, orgId);

    if (!asDraft) {
      try {
        const evt = WebhookService.createEvent(
          'inventory.return.confirmed',
          orgId,
          {
            returnId: docRecord.id,
            returnNumber: docRecord.returnNumber,
            warehouseId: docRecord.warehouseId,
            locationId: docRecord.locationId,
            partyName: docRecord.partyName,
            totalQuantity: docRecord.totalQuantity,
            totalWeightKG: docRecord.totalWeightKG,
            linesCount: docRecord.items.length,
            confirmedAt: docRecord.confirmedAt,
          },
          docRecord.id
        );
        WebhookService.dispatchEvent(evt).catch(() => {});
      } catch {}
    }

    return docRecord;
  },

  // -----------------------------------------------------------------------
  // PHYSICAL STOCK COUNT (EXPECTED VS COUNTED WITH VARIANCE ADJUSTMENTS)
  // -----------------------------------------------------------------------
  async createStockCountDocument(
    orgId: string,
    data: {
      warehouseId: string;
      locationId: string;
      notes?: string;
      items: {
        itemId: string;
        countedQuantity: number;
        batchId?: string;
      }[];
    },
    asDraft: boolean = false,
    user: string = 'Storekeeper'
  ): Promise<UniversalStockCountDocument> {
    const items = this.getItems(orgId);
    const warehouses = this.getWarehouses(orgId);
    const locations = this.getLocations(orgId);
    const wh = warehouses.find((w) => w.id === data.warehouseId);
    if (!wh) throw new Error('Warehouse not found.');
    const loc = locations.find((l) => l.id === data.locationId);
    if (!loc) throw new Error('Location not found.');

    const countId = this.generateDocumentNumber(orgId, 'CNT');
    const now = new Date().toISOString();
    const balances = this.computeInventoryBalances(orgId);

    let totalExpected = 0;
    let totalCounted = 0;
    let totalVariance = 0;
    const formattedLines: any[] = [];

    for (const countLine of data.items) {
      const item = items.find((i) => i.id === countLine.itemId || i.itemCode === countLine.itemId);
      if (!item) continue;

      const bal = balances.find(
        (b) =>
          b.warehouseId === wh.id &&
          b.locationId === loc.id &&
          (b.itemId === item.id || b.itemCode === item.itemCode)
      );

      const expected = bal ? bal.quantity : 0;
      const counted = Math.max(0, countLine.countedQuantity);
      const variance = counted - expected;
      const weightUnit = item.defaultWeight || 1;

      totalExpected += expected;
      totalCounted += counted;
      totalVariance += variance;

      const status = variance === 0 ? 'MATCH' : variance > 0 ? 'SURPLUS' : 'DEFICIT';

      formattedLines.push({
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.nameAr || item.name,
        unit: item.unitOfMeasure,
        expectedQuantity: expected,
        countedQuantity: counted,
        varianceQuantity: variance,
        varianceWeightKG: Math.abs(variance) * weightUnit,
        batchId: countLine.batchId,
        status,
      });

      // If confirming, automatically record the adjustment transactions!
      if (!asDraft && variance !== 0) {
        const adjType = variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        await this.recordTransaction(orgId, {
          transactionType: adjType,
          documentId: countId,
          itemId: item.id,
          itemCode: item.itemCode,
          itemName: item.nameAr || item.name,
          warehouseId: wh.id,
          warehouseName: wh.nameAr || wh.name,
          locationId: loc.id,
          locationCode: loc.code,
          quantity: Math.abs(variance),
          unit: item.unitOfMeasure,
          weightKG: Math.abs(variance) * weightUnit,
          reason: 'Physical Count',
          notes: `تسوية جرد دوري تلقائية بموجب كشف ${countId} (متوقع: ${expected}، فعلي: ${counted})`,
          performedBy: user,
        });
      }
    }

    const docRecord: UniversalStockCountDocument = {
      id: countId,
      countNumber: countId,
      organizationId: orgId,
      warehouseId: wh.id,
      warehouseName: wh.nameAr || wh.name,
      locationId: loc.id,
      locationCode: loc.code,
      items: formattedLines,
      totalExpected,
      totalCounted,
      totalVariance,
      notes: data.notes,
      status: asDraft ? 'DRAFT' : 'CONFIRMED',
      performedBy: user,
      createdAt: now,
      confirmedAt: asDraft ? undefined : now,
    };

    const all = getLocalCache<UniversalStockCountDocument>(CACHE_KEY_STOCKTAKES, []);
    all.unshift(docRecord);
    setLocalCache(CACHE_KEY_STOCKTAKES, all);

    await safeFirestoreSetDoc(FS_COL_STOCKTAKES, countId, docRecord, orgId);

    if (!asDraft) {
      try {
        const evt = WebhookService.createEvent(
          'inventory.stocktake.completed',
          orgId,
          {
            stockCountId: docRecord.id,
            countNumber: docRecord.countNumber,
            warehouseId: docRecord.warehouseId,
            locationId: docRecord.locationId,
            totalExpected: docRecord.totalExpected,
            totalCounted: docRecord.totalCounted,
            totalVariance: docRecord.totalVariance,
            linesCount: docRecord.items.length,
            confirmedAt: docRecord.confirmedAt,
          },
          docRecord.id
        );
        WebhookService.dispatchEvent(evt).catch(() => {});
      } catch {}
    }

    return docRecord;
  },

  // -----------------------------------------------------------------------
  // ITEM STOCK MOVEMENT VIEW (RUNNING BALANCE AUDIT TRAIL)
  // -----------------------------------------------------------------------
  getItemStockMovement(orgId: string, itemId: string) {
    const ledger = this.getLedger(orgId, itemId);
    const chronological = [...ledger].reverse();
    let runningQty = 0;
    let runningWeight = 0;

    const movements = chronological.map((tx) => {
      const q = Math.abs(Number(tx.quantity) || 0);
      const w = Math.abs(Number(tx.weightKG) || 0);
      let deltaQty = 0;
      let deltaWeight = 0;

      switch (tx.transactionType) {
        case 'OPENING_BALANCE':
        case 'RECEIPT':
        case 'TRANSFER_IN':
        case 'RETURN_IN':
        case 'ADJUSTMENT_IN':
          deltaQty = q;
          deltaWeight = w;
          runningQty += q;
          runningWeight += w;
          break;
        case 'ISSUE':
        case 'TRANSFER_OUT':
        case 'RETURN_OUT':
        case 'ADJUSTMENT_OUT':
          deltaQty = -q;
          deltaWeight = -w;
          runningQty = Math.max(0, runningQty - q);
          runningWeight = Math.max(0, runningWeight - w);
          break;
      }

      return {
        ...tx,
        deltaQuantity: deltaQty,
        deltaWeightKG: deltaWeight,
        runningBalanceQuantity: runningQty,
        runningBalanceWeightKG: runningWeight,
      };
    });

    return movements.reverse();
  },

  // -----------------------------------------------------------------------
  // TEST SCENARIOS RUNNER (AUTOMATED TESTS A THROUGH G)
  // -----------------------------------------------------------------------
  async runOperationalScenariosTest(orgA: string = 'org_alkarwan', orgB: string = 'org_apex_logistics') {
    const results: { test: string; status: 'PASSED' | 'FAILED'; details: string }[] = [];

    try {
      // Setup test item in Org A
      const testItemCode = `TEST-SKU-${Date.now().toString().slice(-4)}`;
      const whA = this.getWarehouses(orgA)[0];
      const locsA = this.getLocations(orgA, whA.id);
      const locA1 = locsA[0];
      const locA2 = locsA[1] || (await this.createLocation(orgA, {
        warehouseId: whA.id,
        code: `LOC-TEST-${Date.now().toString().slice(-3)}`,
        name: 'Test Rack 2',
        type: 'RACK',
        status: 'ACTIVE',
      }));

      const itemA = await this.createItem(orgA, {
        itemCode: testItemCode,
        name: `Test Material ${testItemCode}`,
        nameAr: `مادة اختبار ${testItemCode}`,
        nameEn: `Test Material ${testItemCode}`,
        category: 'Raw Materials',
        unitOfMeasure: 'KG',
        weightUnit: 'KG',
        defaultWeight: 1,
        status: 'ACTIVE',
        trackBatch: true,
        trackSerial: false,
        trackExpiry: false,
        minimumStock: 100,
        maximumStock: 10000,
        reorderPoint: 200,
      });

      // TEST A — RECEIVE: Receive 1000 KG Item A -> Inventory = 1000 KG
      await this.createReceiptDocument(orgA, {
        supplierName: 'Test Vendor A',
        documentNumber: `PO-${testItemCode}`,
        date: new Date().toISOString().split('T')[0],
        warehouseId: whA.id,
        items: [{ itemId: itemA.id, locationId: locA1.id, quantity: 1000, unit: 'KG', weightKG: 1000 }],
      }, false, 'Test Bot');

      const stockA1 = this.getItemTotalStock(orgA, itemA.id).quantity;
      if (stockA1 === 1000) {
        results.push({ test: 'TEST A — RECEIVE', status: 'PASSED', details: `Stock increased to ${stockA1} KG as expected.` });
      } else {
        results.push({ test: 'TEST A — RECEIVE', status: 'FAILED', details: `Expected 1000 KG, got ${stockA1} KG.` });
      }

      // TEST B — ISSUE: Issue 250 KG -> Inventory = 750 KG
      await this.createIssueDocument(orgA, {
        warehouseId: whA.id,
        locationId: locA1.id,
        destination: 'Test Production',
        reason: 'Test Issue',
        items: [{ itemId: itemA.id, quantity: 250, unit: 'KG' }],
      }, false, 'Test Bot');

      const stockA2 = this.getItemTotalStock(orgA, itemA.id).quantity;
      if (stockA2 === 750) {
        results.push({ test: 'TEST B — ISSUE', status: 'PASSED', details: `Stock decremented to ${stockA2} KG as expected.` });
      } else {
        results.push({ test: 'TEST B — ISSUE', status: 'FAILED', details: `Expected 750 KG, got ${stockA2} KG.` });
      }

      // TEST C — TRANSFER: Transfer 200 KG from Loc A1 to Loc A2 -> Loc A1 = 550, Loc A2 = 200, Total = 750 KG
      await this.createTransferDocument(orgA, {
        sourceWarehouseId: whA.id,
        sourceLocationId: locA1.id,
        destinationWarehouseId: whA.id,
        destinationLocationId: locA2.id,
        reason: 'Inter-rack Transfer',
        items: [{ itemId: itemA.id, quantity: 200, unit: 'KG' }],
      }, false, 'Test Bot');

      const balancesA = this.computeInventoryBalances(orgA);
      const b1 = balancesA.find((b) => b.locationId === locA1.id && b.itemId === itemA.id)?.quantity || 0;
      const b2 = balancesA.find((b) => b.locationId === locA2.id && b.itemId === itemA.id)?.quantity || 0;
      const totalC = this.getItemTotalStock(orgA, itemA.id).quantity;

      if (b1 === 550 && b2 === 200 && totalC === 750) {
        results.push({ test: 'TEST C — TRANSFER', status: 'PASSED', details: `Loc1 = ${b1} KG, Loc2 = ${b2} KG, Total = ${totalC} KG as expected.` });
      } else {
        results.push({ test: 'TEST C — TRANSFER', status: 'FAILED', details: `Expected 550, 200, 750. Got ${b1}, ${b2}, ${totalC}.` });
      }

      // TEST D — ADJUSTMENT: Adjust +50 KG -> Total = 800 KG
      await this.executeAdjustment(orgA, {
        warehouseId: whA.id,
        locationId: locA1.id,
        itemId: itemA.id,
        adjustmentType: 'ADJUSTMENT_IN',
        quantityDelta: 50,
        reason: 'Found',
      }, 'Test Bot');

      const stockA4 = this.getItemTotalStock(orgA, itemA.id).quantity;
      if (stockA4 === 800) {
        results.push({ test: 'TEST D — ADJUSTMENT', status: 'PASSED', details: `Total adjusted to ${stockA4} KG as expected.` });
      } else {
        results.push({ test: 'TEST D — ADJUSTMENT', status: 'FAILED', details: `Expected 800 KG, got ${stockA4} KG.` });
      }

      // TEST E — RETURN: Return 50 KG Return In -> Total = 850 KG
      await this.createReturnDocument(orgA, {
        returnType: 'RETURN_IN',
        warehouseId: whA.id,
        locationId: locA1.id,
        partyName: 'Customer Test',
        reason: 'Surplus Return',
        items: [{ itemId: itemA.id, quantity: 50, unit: 'KG' }],
      }, false, 'Test Bot');

      const stockA5 = this.getItemTotalStock(orgA, itemA.id).quantity;
      if (stockA5 === 850) {
        results.push({ test: 'TEST E — RETURN', status: 'PASSED', details: `Return In increased total to ${stockA5} KG as expected.` });
      } else {
        results.push({ test: 'TEST E — RETURN', status: 'FAILED', details: `Expected 850 KG, got ${stockA5} KG.` });
      }

      // TEST F — CANCEL: Cancel draft -> Inventory unchanged
      const draftReceipt = await this.createReceiptDocument(orgA, {
        supplierName: 'Draft Supplier',
        documentNumber: `DFT-${testItemCode}`,
        date: new Date().toISOString().split('T')[0],
        warehouseId: whA.id,
        items: [{ itemId: itemA.id, locationId: locA1.id, quantity: 500, unit: 'KG' }],
      }, true, 'Test Bot');

      const stockBeforeCancel = this.getItemTotalStock(orgA, itemA.id).quantity;
      await this.cancelReceiptDocument(orgA, draftReceipt.id, 'Draft discarded', 'Test Bot');
      const stockAfterCancel = this.getItemTotalStock(orgA, itemA.id).quantity;

      if (stockBeforeCancel === 850 && stockAfterCancel === 850) {
        results.push({ test: 'TEST F — CANCEL DRAFT', status: 'PASSED', details: `Draft cancellation left stock unchanged at ${stockAfterCancel} KG.` });
      } else {
        results.push({ test: 'TEST F — CANCEL DRAFT', status: 'FAILED', details: `Stock changed unexpectedly from ${stockBeforeCancel} to ${stockAfterCancel}.` });
      }

      // TEST G — SECURITY: Org B attempts to read/modify Org A's inventory
      const orgBStockForA = this.getItemTotalStock(orgB, itemA.id).quantity;
      const orgBItems = this.getItems(orgB);
      const isItemInOrgB = orgBItems.some((i) => i.id === itemA.id || i.itemCode === itemA.itemCode);

      if (orgBStockForA === 0 && !isItemInOrgB) {
        results.push({ test: 'TEST G — MULTI-TENANT ISOLATION', status: 'PASSED', details: `Org B cannot see Org A items or inventory. Strict zero-leakage verified.` });
      } else {
        results.push({ test: 'TEST G — MULTI-TENANT ISOLATION', status: 'FAILED', details: `Data leakage detected between tenants!` });
      }
    } catch (err: any) {
      results.push({ test: 'OPERATIONAL TEST RUNNER', status: 'FAILED', details: err.message || String(err) });
    }

    return results;
  },

  getWarehouseStats(orgId: string, warehouseId?: string) {
    const balances = this.computeInventoryBalances(orgId).filter(
      (b) => !warehouseId || b.warehouseId === warehouseId
    );
    const ledger = this.getLedger(orgId, undefined, warehouseId);
    const items = this.getItems(orgId);

    const totalItems = new Set(balances.map((b) => b.itemId)).size;
    let totalQuantity = 0;
    let totalWeightKG = 0;
    let lowStockCount = 0;

    for (const b of balances) {
      totalQuantity += b.quantity;
      totalWeightKG += b.weightKG;
      if (b.status === 'LOW_STOCK') lowStockCount += 1;
    }

    const outOfStockCount = items.filter((i) => {
      const b = balances.find((x) => x.itemId === i.id);
      return !b || b.quantity <= 0;
    }).length;

    const recentReceipts = ledger.filter((t) => t.transactionType === 'RECEIPT').slice(0, 10);
    const recentIssues = ledger.filter((t) => t.transactionType === 'ISSUE').slice(0, 10);
    const recentTransfers = ledger
      .filter((t) => t.transactionType === 'TRANSFER_IN' || t.transactionType === 'TRANSFER_OUT')
      .slice(0, 10);

    return {
      totalItems,
      totalQuantity,
      totalWeightKG,
      lowStockCount,
      outOfStockCount,
      recentReceipts,
      recentIssues,
      recentTransfers,
      totalMovementsCount: ledger.length,
    };
  },
};

export const WarehouseEngineService = WarehouseEngineAPI;

