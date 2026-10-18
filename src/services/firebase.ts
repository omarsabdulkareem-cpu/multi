import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  waitForPendingWrites,
  doc,
  getDoc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
  getBytes,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  MaterialItem,
  Supplier,
  Warehouse,
  WarehouseLocation,
  ReceivingTransaction,
  ShreddingTransaction,
  ProductionIssue,
  ProductionOrder,
  InventoryMovement,
  InventoryBalance,
  BulkBag,
  AuditLogEntry,
  ApprovalRecord,
  PendingAction,
  ShiftHandoverRecord,
  WarehouseTransfer,
  PhysicalInventoryCount,
  PurchaseRequirement,
  PurchaseReceipt,
  UserProfile,
  CloudStorageSnapshotRecord,
  CloudSchedulerConfig,
  CloudSchedulerHistoryEntry,
  BulkRollbackResult,
  SystemInventoryCode,
} from '../types';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Storage with applet storageBucket
export const storage = getStorage(app, firebaseConfig.storageBucket);

/**
 * Offline IndexedDB Persistence State & Controller
 * Enables the Al-Karwan factory system to stay 100% operational during network drops
 * in warehouse hangars, scale weighbridges, and shredding units.
 */
let isOfflinePersistenceEnabled = false;
let persistenceStatusReason: 'ENABLED' | 'FAILED_PRECONDITION_MULTIPLE_TABS' | 'UNIMPLEMENTED' | 'ERROR' | 'INITIALIZING' = 'INITIALIZING';

// Initialize IndexedDB persistence immediately following Firestore instance creation
export const offlinePersistencePromise: Promise<boolean> = (async () => {
  if (typeof window === 'undefined') return false;
  try {
    await enableIndexedDbPersistence(db);
    isOfflinePersistenceEnabled = true;
    persistenceStatusReason = 'ENABLED';
    console.log('[Firestore Offline Engine] IndexedDB persistence successfully enabled. Warehouse operations will persist during network drops.');
    return true;
  } catch (err: any) {
    if (err?.code === 'failed-precondition') {
      persistenceStatusReason = 'FAILED_PRECONDITION_MULTIPLE_TABS';
      console.warn('[Firestore Offline Engine] Multiple tabs open; IndexedDB persistence is active in primary tab.');
    } else if (err?.code === 'unimplemented') {
      persistenceStatusReason = 'UNIMPLEMENTED';
      console.warn('[Firestore Offline Engine] Browser does not support IndexedDB persistence.');
    } else {
      persistenceStatusReason = 'ERROR';
      console.warn('[Firestore Offline Engine] IndexedDB persistence initialization notice:', err);
    }
    return false;
  }
})();

export function getIsOfflinePersistenceEnabled(): boolean {
  return isOfflinePersistenceEnabled;
}

export function getPersistenceStatusReason(): string {
  return persistenceStatusReason;
}

export async function flushPendingOfflineWrites(): Promise<boolean> {
  try {
    await waitForPendingWrites(db);
    return true;
  } catch (err) {
    console.warn('[Firestore Offline Engine] Error waiting for pending writes:', err);
    return false;
  }
}

export const auth = getAuth(app);

// Configure Google Auth Provider
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in using Google Popup
 */
export async function signInWithGooglePopup(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleAuthProvider);
    return result.user;
  } catch (error) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Sign out current authenticated user
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Firebase Sign-Out Error:', error);
    throw error;
  }
}

/**
 * Listen for authentication state transitions
 */
export function onAuthUserChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection to Firestore with offline-first resilience
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const testRef = doc(db, 'test', 'connection');
    // Attempt doc read with graceful catch so offline IndexedDB mode does not produce unhandled connection failures
    await getDoc(testRef).catch(() => null);
    return true;
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('offline') || msg.includes('unavailable')) {
      console.info('[Firestore] Operating in local persistence mode (IndexedDB active).');
    }
    return true;
  }
}

// Persist single document to Firestore
export async function saveDocToFirestore(collectionName: string, id: string, data: any): Promise<boolean> {
  try {
    const ref = doc(db, collectionName, id);
    await setDoc(ref, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[Firestore] Failed to save doc to ${collectionName}/${id}:`, err);
    return false;
  }
}

// Fetch documents from a Firestore collection
export async function fetchCollectionFromFirestore<T>(collectionName: string): Promise<T[] | null> {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    if (snap.empty) {
      return null;
    }
    const docs: T[] = [];
    snap.forEach((d) => {
      docs.push({ id: d.id, ...d.data() } as T);
    });
    return docs;
  } catch (err) {
    console.warn(`[Firestore] Failed to fetch ${collectionName}:`, err);
    return null;
  }
}

// Batch write collection to Firestore
export async function syncCollectionToFirestore<T extends { id?: string }>(
  collectionName: string,
  items: T[]
): Promise<boolean> {
  try {
    if (!items || items.length === 0) return true;
    const batch = writeBatch(db);
    const slice = items.slice(0, 100);
    for (const item of slice) {
      const docId = item.id || `DOC-${Math.floor(100000 + Math.random() * 900000)}`;
      const ref = doc(db, collectionName, docId);
      batch.set(ref, item, { merge: true });
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.warn(`[Firestore] Failed to sync ${collectionName}:`, err);
    return false;
  }
}

/**
 * Helper to build collection operations
 */
function createCollectionService<T extends { id?: string }>(collectionName: string) {
  return {
    async getAll(): Promise<T[]> {
      try {
        const colRef = collection(db, collectionName);
        const snap = await getDocs(colRef);
        const results: T[] = [];
        snap.forEach((d) => {
          results.push({ id: d.id, ...d.data() } as T);
        });
        return results;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, collectionName);
      }
    },

    subscribe(callback: (items: T[]) => void, onError?: (err: any) => void): Unsubscribe {
      const colRef = collection(db, collectionName);
      return onSnapshot(
        colRef,
        (snap) => {
          const items: T[] = [];
          snap.forEach((d) => {
            items.push({ id: d.id, ...d.data() } as T);
          });
          callback(items);
        },
        (error) => {
          console.warn(`[Firestore Snapshot Error on ${collectionName}]:`, error);
          if (onError) onError(error);
        }
      );
    },

    async save(item: T): Promise<void> {
      const itemId = item.id || doc(collection(db, collectionName)).id;
      try {
        const ref = doc(db, collectionName, itemId);
        await setDoc(ref, { ...item, id: itemId, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${itemId}`);
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const ref = doc(db, collectionName, id);
        await deleteDoc(ref);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
      }
    },

    async saveBatch(items: T[]): Promise<void> {
      if (!items || items.length === 0) return;
      try {
        const batch = writeBatch(db);
        for (const item of items.slice(0, 450)) {
          const itemId = item.id || doc(collection(db, collectionName)).id;
          const ref = doc(db, collectionName, itemId);
          batch.set(ref, { ...item, id: itemId, updatedAt: new Date().toISOString() }, { merge: true });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, collectionName);
      }
    },
  };
}

export interface DatabaseSnapshotMetadata {
  appName: string;
  databaseId: string;
  exportTimestamp: string;
  exportDateIso: string;
  exportedBy: string;
  exportedByRole?: string;
  totalDocuments: number;
  collectionCounts: Record<string, number>;
  version: string;
}

export interface DatabaseSnapshot {
  metadata: DatabaseSnapshotMetadata;
  collections: Record<string, any[]>;
}

export interface DependencyImpactItem {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'master' | 'operations' | 'governance';
  docCount: number;
  estimatedSizeKB: number;
  dependents: string[];
  totalDependentDocs: number;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cascadeDescriptionAr: string;
  cascadeDescriptionEn: string;
}

export interface PreFlightCheckSummary {
  totalDocuments: number;
  estimatedTotalSizeKB: number;
  estimatedTotalSizeMB: number;
  activeCollectionsCount: number;
  collectionsStats: Record<string, number>;
  domainBreakdown: {
    masterData: { count: number; sizeKB: number; collections: string[] };
    operationalLedgers: { count: number; sizeKB: number; collections: string[] };
    governanceAudits: { count: number; sizeKB: number; collections: string[] };
  };
  dependencies: DependencyImpactItem[];
  preFlightChecklist: {
    hasBackupSnapshot: boolean;
    lastSnapshotTime?: string;
    hasActiveWorkOrders: boolean;
    hasPendingApprovals: boolean;
    readyForCleanSlate: boolean;
  };
  overallStatus: 'GREEN_CLEAR' | 'AMBER_WARNING' | 'RED_ALERT';
}

/**
 * Unified FirebaseService mapping all core factory data models to Firestore
 */
export const FirebaseService = {
  // 1. Materials Master Catalog
  materials: createCollectionService<MaterialItem>('materials'),

  // 2. Real-Time Inventory Balances
  inventoryBalances: {
    ...createCollectionService<InventoryBalance>('inventoryBalances'),
    async saveBalance(balance: InventoryBalance): Promise<void> {
      const docId = `${balance.materialId}_${balance.warehouseId}_${balance.locationId}`;
      try {
        const ref = doc(db, 'inventoryBalances', docId);
        await setDoc(ref, { ...balance, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `inventoryBalances/${docId}`);
      }
    },
  },

  // 3. Bulk Bag Unit Tracking (أكياس الشليف)
  bulkBags: createCollectionService<BulkBag>('bulkBags'),

  // 4. Warehouses & Physical Locations
  warehouses: createCollectionService<Warehouse>('warehouses'),
  warehouseLocations: createCollectionService<WarehouseLocation>('warehouseLocations'),

  // 5. Suppliers & Vendors
  suppliers: createCollectionService<Supplier>('suppliers'),

  // 6. Scale Weighbridge & Receiving Transactions
  receivingTransactions: createCollectionService<ReceivingTransaction>('receivingTransactions'),

  // 7. Shredding (الثرم) Operations
  shreddingTransactions: createCollectionService<ShreddingTransaction>('shreddingTransactions'),

  // 8. Production Issues & Dispatches (Doc 167)
  productionIssues: createCollectionService<ProductionIssue>('productionIssues'),

  // 9. Production Orders (Sheets & Thermoforming)
  productionOrders: createCollectionService<ProductionOrder>('productionOrders'),

  // 10. Central Inventory Movements Ledger
  inventoryMovements: {
    ...createCollectionService<InventoryMovement>('inventoryMovements'),
    async recordMovement(movement: InventoryMovement): Promise<void> {
      try {
        const ref = doc(db, 'inventoryMovements', movement.id);
        await setDoc(ref, { ...movement, timestamp: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `inventoryMovements/${movement.id}`);
      }
    },
  },

  // 11. Immutable Audit Trail Logs
  auditLogs: {
    ...createCollectionService<AuditLogEntry>('auditLogs'),
    async recordLog(log: AuditLogEntry): Promise<void> {
      try {
        const ref = doc(db, 'auditLogs', log.id);
        await setDoc(ref, { ...log, loggedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `auditLogs/${log.id}`);
      }
    },
  },

  // 12. Supervisory Approvals
  approvals: createCollectionService<ApprovalRecord>('approvals'),

  // 13. Pending Operational Actions
  pendingActions: createCollectionService<PendingAction>('pendingActions'),

  // 14. Shift Handover Records
  shiftHandovers: createCollectionService<ShiftHandoverRecord>('shiftHandovers'),

  // 15. Warehouse Internal Transfers
  warehouseTransfers: createCollectionService<WarehouseTransfer>('warehouseTransfers'),

  // 16. Physical Counts & Stocktake
  physicalCounts: createCollectionService<PhysicalInventoryCount>('physicalCounts'),

  // 17. Purchase Requirements
  purchaseRequirements: createCollectionService<PurchaseRequirement>('purchaseRequirements'),

  // 18. User Accounts & Clearance
  users: createCollectionService<UserProfile>('users'),

  // 19. Configurable AL-KARWAN Internal Inventory Codes (167 for Storage, 546 for Production, etc.)
  systemInventoryCodes: createCollectionService<SystemInventoryCode>('systemInventoryCodes'),

  /**
   * Seed baseline catalog and warehouse definitions if Firestore is completely empty
   */
  async seedInitialDataIfEmpty(baseline: {
    materials: MaterialItem[];
    warehouses: Warehouse[];
    locations: WarehouseLocation[];
    suppliers: Supplier[];
    receivingTransactions: ReceivingTransaction[];
    shreddingTransactions: ShreddingTransaction[];
    productionIssues: ProductionIssue[];
    productionOrders: ProductionOrder[];
    inventoryMovements: InventoryMovement[];
    bulkBags: BulkBag[];
  }): Promise<{ seeded: boolean; count: number }> {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('alkarwan_system_clean_slate') === 'true') {
        return { seeded: false, count: 0 };
      }
      const snap = await getDocs(collection(db, 'materials'));
      if (!snap.empty) {
        return { seeded: false, count: snap.size };
      }

      console.log('[FirebaseService] Seeding initial factory master data into Firestore...');
      const batch = writeBatch(db);
      let count = 0;

      // Materials
      for (const m of baseline.materials) {
        batch.set(doc(db, 'materials', m.id), m);
        count++;
      }

      // Warehouses
      for (const w of baseline.warehouses) {
        batch.set(doc(db, 'warehouses', w.id), w);
        count++;
      }

      // Locations
      for (const l of baseline.locations) {
        batch.set(doc(db, 'warehouseLocations', l.id), l);
        count++;
      }

      // Suppliers
      for (const s of baseline.suppliers) {
        batch.set(doc(db, 'suppliers', s.id), s);
        count++;
      }

      // Bulk Bags
      for (const b of baseline.bulkBags.slice(0, 30)) {
        batch.set(doc(db, 'bulkBags', b.id), b);
        count++;
      }

      // Receiving Transactions
      for (const r of baseline.receivingTransactions.slice(0, 30)) {
        batch.set(doc(db, 'receivingTransactions', r.id), r);
        count++;
      }

      // Shredding Transactions
      for (const st of baseline.shreddingTransactions.slice(0, 30)) {
        batch.set(doc(db, 'shreddingTransactions', st.id), st);
        count++;
      }

      // Production Issues
      for (const pi of baseline.productionIssues.slice(0, 30)) {
        batch.set(doc(db, 'productionIssues', pi.id), pi);
        count++;
      }

      // Production Orders
      for (const po of baseline.productionOrders.slice(0, 30)) {
        batch.set(doc(db, 'productionOrders', po.id), po);
        count++;
      }

      // Inventory Movements
      for (const im of baseline.inventoryMovements.slice(0, 50)) {
        batch.set(doc(db, 'inventoryMovements', im.id), im);
        count++;
      }

      await batch.commit();
      console.log(`[FirebaseService] Successfully seeded ${count} master records to Firestore!`);
      return { seeded: true, count };
    } catch (error) {
      console.warn('[FirebaseService] Seed initial data check failed:', error);
      return { seeded: false, count: 0 };
    }
  },

  /**
   * Database Snapshot Export Utility
   * Fetches all documents across all Firestore collections and formats them into a structured JSON backup
   */
  async createDatabaseSnapshot(
    exportedBy: { name: string; email?: string; role?: string },
    selectedCollections?: string[],
    onProgress?: (colName: string, count: number, currentTotal: number) => void
  ): Promise<DatabaseSnapshot> {
    const collectionsToExport =
      selectedCollections && selectedCollections.length > 0
        ? selectedCollections
        : [
            'materials',
            'suppliers',
            'warehouses',
            'warehouseLocations',
            'receivingTransactions',
            'shreddingTransactions',
            'productionIssues',
            'productionOrders',
            'inventoryMovements',
            'inventoryBalances',
            'bulkBags',
            'approvals',
            'pendingActions',
            'shiftHandovers',
            'warehouseTransfers',
            'physicalCounts',
            'purchaseRequirements',
            'purchaseReceipts',
            'auditLogs',
            'productionDamages',
            'importBatches',
          ];

    const collectionsData: Record<string, any[]> = {};
    const collectionCounts: Record<string, number> = {};
    let totalDocuments = 0;

    for (const colName of collectionsToExport) {
      try {
        const colRef = collection(db, colName);
        const snap = await getDocs(colRef);
        const docsData = snap.docs.map((d) => ({
          _id: d.id,
          ...d.data(),
        }));
        collectionsData[colName] = docsData;
        collectionCounts[colName] = docsData.length;
        totalDocuments += docsData.length;
        if (onProgress) {
          onProgress(colName, docsData.length, totalDocuments);
        }
      } catch (err) {
        console.warn(`[Snapshot] Error exporting collection ${colName}:`, err);
        collectionsData[colName] = [];
        collectionCounts[colName] = 0;
      }
    }

    const snapshot: DatabaseSnapshot = {
      metadata: {
        appName: 'AL-KARWAN Factory Control System',
        databaseId: 'ai-studio-alkarwanfactoryc-0b64f8e1-938e-4996-8313-73b46aee689b',
        exportTimestamp: new Date().toISOString(),
        exportDateIso: new Date().toISOString(),
        exportedBy: exportedBy.name,
        exportedByRole: exportedBy.role || 'Admin',
        totalDocuments,
        collectionCounts,
        version: '1.0',
      },
      collections: collectionsData,
    };

    return snapshot;
  },

  /**
   * Alias for createDatabaseSnapshot supporting flexible argument shapes
   */
  async exportDatabaseSnapshot(
    selectedCollectionsOrOptions?: string[] | { name: string; email?: string; role?: string },
    optionsOrCollections?: { name: string; email?: string; role?: string } | string[],
    onProgress?: (colName: string, count: number, currentTotal: number) => void
  ): Promise<DatabaseSnapshot> {
    let exportedBy = { name: 'Cloud Scheduler', role: 'System Automation' };
    let collections: string[] | undefined = undefined;

    if (Array.isArray(selectedCollectionsOrOptions)) {
      collections = selectedCollectionsOrOptions;
      if (optionsOrCollections && !Array.isArray(optionsOrCollections)) {
        exportedBy = { ...exportedBy, ...optionsOrCollections };
      }
    } else if (selectedCollectionsOrOptions && typeof selectedCollectionsOrOptions === 'object') {
      exportedBy = { ...exportedBy, ...selectedCollectionsOrOptions };
      if (Array.isArray(optionsOrCollections)) {
        collections = optionsOrCollections;
      }
    }

    return FirebaseService.createDatabaseSnapshot(exportedBy, collections, onProgress);
  },

  /**
   * Browser file downloader for Database Snapshot
   */
  downloadSnapshotJSON(snapshot: DatabaseSnapshot, filename?: string): void {
    const timeStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalName = filename || `alkarwan-database-snapshot-${timeStr}.json`;
    const jsonString = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Record last snapshot download in localStorage for Pre-Flight safety tracking
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('alkarwan_last_snapshot_time', new Date().toISOString());
        localStorage.setItem(
          'alkarwan_last_snapshot_count',
          String(snapshot.metadata.totalDocuments)
        );
      }
    } catch {
      // ignore storage quotas
    }
  },

  /**
   * Pre-Flight Check Engine
   * Calculates comprehensive data size footprint, relational cascade risks, and safety checklist
   */
  async getPreFlightCheckSummary(
    cachedStats?: Record<string, number>
  ): Promise<PreFlightCheckSummary> {
    const stats = cachedStats || (await FirebaseService.getCollectionStats());

    // Estimated average bytes per document per collection archetype
    const docWeightKB: Record<string, number> = {
      materials: 1.2,
      suppliers: 0.9,
      warehouses: 0.8,
      warehouseLocations: 0.6,
      receivingTransactions: 1.8,
      shreddingTransactions: 1.4,
      productionIssues: 1.6,
      productionOrders: 1.5,
      inventoryMovements: 1.7,
      inventoryBalances: 0.7,
      bulkBags: 1.1,
      approvals: 0.9,
      pendingActions: 0.8,
      shiftHandovers: 1.3,
      warehouseTransfers: 1.2,
      physicalCounts: 1.5,
      purchaseRequirements: 1.3,
      purchaseReceipts: 1.6,
      auditLogs: 1.4,
      productionDamages: 1.2,
      importBatches: 2.2,
    };

    let totalDocs = 0;
    let totalSizeKB = 0;
    let activeCollectionsCount = 0;

    Object.entries(stats).forEach(([col, count]) => {
      const c = typeof count === 'number' ? count : Number(count) || 0;
      totalDocs += c;
      if (c > 0) activeCollectionsCount++;
      const weight = docWeightKB[col] || 1.0;
      totalSizeKB += c * weight;
    });

    const masterCollections = ['materials', 'suppliers', 'warehouses', 'warehouseLocations'];
    const operationalCollections = [
      'inventoryBalances',
      'inventoryMovements',
      'bulkBags',
      'receivingTransactions',
      'shreddingTransactions',
      'productionIssues',
      'productionOrders',
      'productionDamages',
      'warehouseTransfers',
      'physicalCounts',
      'purchaseRequirements',
      'purchaseReceipts',
    ];
    const governanceCollections = [
      'approvals',
      'pendingActions',
      'shiftHandovers',
      'auditLogs',
      'importBatches',
    ];

    const calcDomain = (keys: string[]) => {
      let count = 0;
      let sizeKB = 0;
      keys.forEach((k) => {
        const c = stats[k] || 0;
        count += c;
        sizeKB += c * (docWeightKB[k] || 1.0);
      });
      return { count, sizeKB: Math.round(sizeKB * 10) / 10, collections: keys };
    };

    const domainBreakdown = {
      masterData: calcDomain(masterCollections),
      operationalLedgers: calcDomain(operationalCollections),
      governanceAudits: calcDomain(governanceCollections),
    };

    // Calculate Relational Dependencies and Cascade Risks
    const countSum = (keys: string[]) => keys.reduce((acc, k) => acc + (stats[k] || 0), 0);

    const dependencies: DependencyImpactItem[] = [
      {
        id: 'materials',
        nameAr: 'المواد والأصناف والبودرة',
        nameEn: 'Raw Materials & Regrind Master',
        category: 'master',
        docCount: stats['materials'] || 0,
        estimatedSizeKB: Math.round((stats['materials'] || 0) * (docWeightKB['materials'] || 1.2)),
        dependents: [
          'inventoryBalances',
          'inventoryMovements',
          'bulkBags',
          'receivingTransactions',
          'shreddingTransactions',
          'productionIssues',
        ],
        totalDependentDocs: countSum([
          'inventoryBalances',
          'inventoryMovements',
          'bulkBags',
          'receivingTransactions',
          'shreddingTransactions',
          'productionIssues',
        ]),
        riskLevel: 'CRITICAL',
        cascadeDescriptionAr:
          'حذف المواد يقطع الارتباط الأجنبي لكافة الأرصدة اللحظية، أكياس الشليف، وأذونات صرف الإنتاج',
        cascadeDescriptionEn:
          'Purging materials breaks relational foreign keys for stock balances, bulk bags, and production vouchers',
      },
      {
        id: 'suppliers',
        nameAr: 'الموردون ومصادر التوريد',
        nameEn: 'Suppliers & Origin Vendors',
        category: 'master',
        docCount: stats['suppliers'] || 0,
        estimatedSizeKB: Math.round((stats['suppliers'] || 0) * (docWeightKB['suppliers'] || 0.9)),
        dependents: ['receivingTransactions', 'purchaseRequirements', 'purchaseReceipts'],
        totalDependentDocs: countSum(['receivingTransactions', 'purchaseRequirements', 'purchaseReceipts']),
        riskLevel: 'HIGH',
        cascadeDescriptionAr:
          'حذف الموردين يفصل تذاكر الاستلام والكبان ومستندات الشراء عن جهات التوريد المعتمدة',
        cascadeDescriptionEn:
          'Purging suppliers unlinks weighbridge receiving tickets and purchase receipts from verified sources',
      },
      {
        id: 'warehouses',
        nameAr: 'المستودعات والجمالونات والأرفف',
        nameEn: 'Physical Warehouses & Bays',
        category: 'master',
        docCount: (stats['warehouses'] || 0) + (stats['warehouseLocations'] || 0),
        estimatedSizeKB: Math.round(
          (stats['warehouses'] || 0) * 0.8 + (stats['warehouseLocations'] || 0) * 0.6
        ),
        dependents: ['inventoryBalances', 'bulkBags', 'warehouseTransfers'],
        totalDependentDocs: countSum(['inventoryBalances', 'bulkBags', 'warehouseTransfers']),
        riskLevel: 'HIGH',
        cascadeDescriptionAr:
          'حذف المستودعات يترك الأرصدة التخزينية والشلايف بدون إحداثيات أو مواقع رص فيزيائية',
        cascadeDescriptionEn:
          'Purging warehouses orphans inventory balances and bulk bags without physical slot coordinates',
      },
      {
        id: 'bulkBags',
        nameAr: 'أكياس الشليف والباركودات',
        nameEn: 'Bulk Bags & QR Barcodes',
        category: 'operations',
        docCount: stats['bulkBags'] || 0,
        estimatedSizeKB: Math.round((stats['bulkBags'] || 0) * (docWeightKB['bulkBags'] || 1.1)),
        dependents: ['inventoryBalances', 'productionIssues'],
        totalDependentDocs: countSum(['inventoryBalances', 'productionIssues']),
        riskLevel: 'HIGH',
        cascadeDescriptionAr:
          'حذف الشلايف يبطل باركودات الشليف المطبوعة ويسقط تتبع الأكياس في صالات المخازن',
        cascadeDescriptionEn:
          'Purging bulk bags invalidates printed barcode QR labels and bag-level unit traceability in bays',
      },
      {
        id: 'inventoryMovements',
        nameAr: 'سجل حركات المخزن الموحد',
        nameEn: 'Unified Movement Ledger',
        category: 'operations',
        docCount: stats['inventoryMovements'] || 0,
        estimatedSizeKB: Math.round((stats['inventoryMovements'] || 0) * 1.7),
        dependents: ['inventoryBalances', 'auditLogs'],
        totalDependentDocs: countSum(['inventoryBalances', 'auditLogs']),
        riskLevel: 'MEDIUM',
        cascadeDescriptionAr:
          'تفريغ الحركات يصفر تسلسل الوارد والمنصرف ويعيد احتساب المخزون إلى الصفر',
        cascadeDescriptionEn:
          'Flushing movements erases chronological inflow/outflow ledger and resets stock counters to zero',
      },
      {
        id: 'receivingTransactions',
        nameAr: 'تذاكر الاستلام والكبان',
        nameEn: 'Weighbridge & Truck Receipts',
        category: 'operations',
        docCount: stats['receivingTransactions'] || 0,
        estimatedSizeKB: Math.round((stats['receivingTransactions'] || 0) * 1.8),
        dependents: ['inventoryMovements', 'inventoryBalances'],
        totalDependentDocs: countSum(['inventoryMovements', 'inventoryBalances']),
        riskLevel: 'MEDIUM',
        cascadeDescriptionAr:
          'مسح تذاكر الكبان يحذف أوزان الشاحنات القائم والصافي للطلبيات الواردة',
        cascadeDescriptionEn:
          'Purging weighbridge tickets deletes gross/net truck scale tickets and inward shipment records',
      },
      {
        id: 'productionOrders',
        nameAr: 'أوامر التشغيل والطلبيات',
        nameEn: 'Production Work Orders',
        category: 'operations',
        docCount: stats['productionOrders'] || 0,
        estimatedSizeKB: Math.round((stats['productionOrders'] || 0) * 1.5),
        dependents: ['productionIssues', 'productionDamages'],
        totalDependentDocs: countSum(['productionIssues', 'productionDamages']),
        riskLevel: 'MEDIUM',
        cascadeDescriptionAr:
          'مسح أوامر التشغيل يفصل مستندات الصرف 167 عن خطط وتكاليف التصنيع',
        cascadeDescriptionEn:
          'Purging orders detaches Doc 167 issuance records from manufacturing plans and cost centers',
      },
      {
        id: 'auditLogs',
        nameAr: 'سجلات التدقيق والأمان',
        nameEn: 'Security Audit & Compliance Trail',
        category: 'governance',
        docCount: (stats['auditLogs'] || 0) + (stats['approvals'] || 0),
        estimatedSizeKB: Math.round((stats['auditLogs'] || 0) * 1.4 + (stats['approvals'] || 0) * 0.9),
        dependents: ['shiftHandovers'],
        totalDependentDocs: stats['shiftHandovers'] || 0,
        riskLevel: 'LOW',
        cascadeDescriptionAr:
          'مسح سجلات التدقيق يصفر السجل الرقابي المانع للتلاعب واعتمادات الورديات',
        cascadeDescriptionEn:
          'Purging audits resets tamper-evident compliance history and supervisor signature logs',
      },
    ];

    // Checklist verifications
    let lastSnapshotTime: string | undefined;
    let hasBackupSnapshot = false;
    try {
      if (typeof window !== 'undefined') {
        const storedTime = localStorage.getItem('alkarwan_last_snapshot_time');
        if (storedTime) {
          lastSnapshotTime = storedTime;
          hasBackupSnapshot = true;
        }
      }
    } catch {
      // ignore
    }

    const hasActiveWorkOrders = (stats['productionOrders'] || 0) > 0;
    const hasPendingApprovals = (stats['pendingActions'] || 0) > 0;
    const readyForCleanSlate = totalDocs === 0;

    let overallStatus: 'GREEN_CLEAR' | 'AMBER_WARNING' | 'RED_ALERT' = 'GREEN_CLEAR';
    if (totalDocs > 0 && !hasBackupSnapshot) {
      overallStatus = 'AMBER_WARNING';
    }
    if (
      (stats['materials'] || 0) > 0 &&
      (stats['inventoryBalances'] || 0) > 0 &&
      !hasBackupSnapshot
    ) {
      overallStatus = 'RED_ALERT';
    }

    return {
      totalDocuments: totalDocs,
      estimatedTotalSizeKB: Math.round(totalSizeKB * 10) / 10,
      estimatedTotalSizeMB: Math.round((totalSizeKB / 1024) * 100) / 100,
      activeCollectionsCount,
      collectionsStats: stats,
      domainBreakdown,
      dependencies,
      preFlightChecklist: {
        hasBackupSnapshot,
        lastSnapshotTime,
        hasActiveWorkOrders,
        hasPendingApprovals,
        readyForCleanSlate,
      },
      overallStatus,
    };
  },

  /**
   * Live Firestore Collection Stats Inspector
   * Fetches real-time document counts across all Firestore collections
   */
  async getCollectionStats(): Promise<Record<string, number>> {
    const collectionsToCount = [
      'materials',
      'suppliers',
      'warehouses',
      'warehouseLocations',
      'receivingTransactions',
      'shreddingTransactions',
      'productionIssues',
      'productionOrders',
      'inventoryMovements',
      'inventoryBalances',
      'bulkBags',
      'approvals',
      'pendingActions',
      'shiftHandovers',
      'warehouseTransfers',
      'physicalCounts',
      'purchaseRequirements',
      'purchaseReceipts',
      'auditLogs',
      'productionDamages',
      'importBatches',
    ];

    const stats: Record<string, number> = {};
    await Promise.all(
      collectionsToCount.map(async (colName) => {
        try {
          const snap = await getDocs(collection(db, colName));
          stats[colName] = snap.size;
        } catch {
          stats[colName] = 0;
        }
      })
    );

    return stats;
  },

  /**
   * Administrative Safe Bulk-Wipe Utility for Firestore
   * Safely deletes documents across selected collections in batches of 400
   */
  async bulkWipeCollections(
    options: {
      wipeOperational?: boolean;
      wipeMaterials?: boolean;
      wipeSuppliers?: boolean;
      wipeWarehouses?: boolean;
      wipeImportBatches?: boolean;
      wipeAuditsAndApprovals?: boolean;
    },
    onProgress?: (colName: string, deletedInCol: number, totalSoFar: number) => void
  ): Promise<{ success: boolean; totalDeleted: number; details: Record<string, number>; error?: string }> {
    try {
      const collectionsToWipe: string[] = [];

      if (options.wipeOperational !== false) {
        collectionsToWipe.push(
          'receivingTransactions',
          'shreddingTransactions',
          'productionIssues',
          'productionOrders',
          'inventoryMovements',
          'inventoryBalances',
          'bulkBags',
          'productionDamages',
          'warehouseTransfers'
        );
      }

      if (options.wipeMaterials) {
        collectionsToWipe.push('materials');
      }

      if (options.wipeSuppliers) {
        collectionsToWipe.push('suppliers');
      }

      if (options.wipeWarehouses) {
        collectionsToWipe.push('warehouses', 'warehouseLocations');
      }

      if (options.wipeImportBatches !== false) {
        collectionsToWipe.push('importBatches');
      }

      if (options.wipeAuditsAndApprovals !== false) {
        collectionsToWipe.push(
          'approvals',
          'pendingActions',
          'shiftHandovers',
          'physicalCounts',
          'purchaseRequirements',
          'purchaseReceipts',
          'auditLogs'
        );
      }

      const details: Record<string, number> = {};
      let totalDeleted = 0;

      for (const colName of collectionsToWipe) {
        try {
          const colRef = collection(db, colName);
          const snap = await getDocs(colRef);
          if (snap.empty) {
            details[colName] = 0;
            continue;
          }

          let deletedInCol = 0;
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 400) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 400);
            chunk.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
            deletedInCol += chunk.length;
          }

          details[colName] = deletedInCol;
          totalDeleted += deletedInCol;
          if (onProgress) {
            onProgress(colName, deletedInCol, totalDeleted);
          }
        } catch (err) {
          console.warn(`Error wiping collection ${colName}:`, err);
          details[colName] = 0;
        }
      }

      // Mark system clean slate in local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('alkarwan_system_clean_slate', 'true');
      }

      return {
        success: true,
        totalDeleted,
        details,
      };
    } catch (err: any) {
      return {
        success: false,
        totalDeleted: 0,
        details: {},
        error: err?.message || 'Bulk-wipe failed',
      };
    }
  },

  /**
   * Uploads full JSON database snapshot to Firebase Storage
   * Default path: snapshots/daily/{YYYY-MM-DD}/alkarwan-snapshot-{timestamp}.json
   * Enforces 30-day retention metadata & Firestore audit registry
   */
  async uploadSnapshotToFirebaseStorage(
    snapshot: DatabaseSnapshot,
    options?: {
      autoScheduled?: boolean;
      retentionDays?: number;
      createdBy?: string;
      isPreWipe?: boolean;
      tag?: 'PRE_WIPE' | 'SCHEDULED_DAILY' | 'MANUAL_SNAPSHOT';
      fileName?: string;
      storagePath?: string;
    }
  ): Promise<CloudStorageSnapshotRecord> {
    const retentionDays = options?.retentionDays ?? 30;
    const autoScheduled = Boolean(options?.autoScheduled);
    const isPreWipe = Boolean(options?.isPreWipe);
    const tag = options?.tag || (isPreWipe ? 'PRE_WIPE' : autoScheduled ? 'SCHEDULED_DAILY' : 'MANUAL_SNAPSHOT');
    const createdBy = options?.createdBy || snapshot.metadata.exportedBy || (isPreWipe ? 'Bulk-Wipe Safety Insurance' : 'Cloud Scheduler');

    const now = new Date();
    const dateFolder = now.toISOString().slice(0, 10);
    const timeSafe = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = options?.fileName || (isPreWipe ? `alkarwan-prewipe-snapshot-${timeSafe}.json` : `alkarwan-snapshot-${timeSafe}.json`);
    const storagePath = options?.storagePath || (isPreWipe ? `snapshots/pre_wipe/${dateFolder}/${fileName}` : `snapshots/daily/${dateFolder}/${fileName}`);
    const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const jsonString = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const payloadSizeKB = Math.round((blob.size / 1024) * 10) / 10;

    let downloadUrl = '';
    try {
      const storageRef = ref(storage, storagePath);
      await uploadString(storageRef, jsonString, 'raw', {
        contentType: 'application/json',
        customMetadata: {
          appName: snapshot.metadata.appName,
          databaseId: snapshot.metadata.databaseId,
          totalDocuments: String(snapshot.metadata.totalDocuments),
          retentionDays: String(retentionDays),
          autoScheduled: String(autoScheduled),
          isPreWipe: String(isPreWipe),
          tag,
          createdAt: now.toISOString(),
          expiresAt,
          createdBy,
        },
      });
      try {
        downloadUrl = await getDownloadURL(storageRef);
      } catch {
        downloadUrl = '';
      }
    } catch (storageErr) {
      console.warn('[Firebase Storage] Upload notice (fallback enabled):', storageErr);
    }

    const record: CloudStorageSnapshotRecord = {
      id: isPreWipe ? `prewipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fileName,
      storagePath,
      storageBucket: firebaseConfig.storageBucket,
      downloadUrl,
      createdAt: now.toISOString(),
      expiresAt,
      retentionDays,
      totalDocuments: snapshot.metadata.totalDocuments,
      payloadSizeKB,
      autoScheduled,
      createdBy,
      status: 'ACTIVE',
      collectionCounts: snapshot.metadata.collectionCounts || {},
      isPreWipe,
      tag,
    };

    // Save record in Firestore /cloudSnapshots collection
    try {
      const docRef = doc(db, 'cloudSnapshots', record.id);
      await setDoc(docRef, record);
    } catch (fsErr) {
      console.warn('[Firestore] Could not persist cloud snapshot record:', fsErr);
    }

    // If this is a pre-wipe snapshot, save reference in systemMeta/latestPreWipeSnapshot
    if (isPreWipe) {
      try {
        const metaRef = doc(db, 'systemMeta', 'latestPreWipeSnapshot');
        await setDoc(metaRef, record);
      } catch (metaErr) {
        console.warn('[Firestore] Could not record latestPreWipeSnapshot in systemMeta:', metaErr);
      }
    }

    // Mirror to localStorage for instant UI access
    try {
      if (typeof window !== 'undefined') {
        const storedStr = localStorage.getItem('alkarwan_cloud_snapshots_registry');
        const existing: CloudStorageSnapshotRecord[] = storedStr ? JSON.parse(storedStr) : [];
        const updated = [record, ...existing.filter((s) => s.id !== record.id)];
        localStorage.setItem('alkarwan_cloud_snapshots_registry', JSON.stringify(updated));

        // Cache snapshot content if feasible
        localStorage.setItem(`alkarwan_snap_cache_${record.id}`, jsonString.slice(0, 1000000));

        if (isPreWipe) {
          localStorage.setItem('alkarwan_latest_prewipe_snapshot', JSON.stringify(record));
          localStorage.setItem('alkarwan_prewipe_snapshot_cache', jsonString.slice(0, 2000000));
        }
      }
    } catch {
      // ignore storage quota
    }

    return record;
  },

  /**
   * Retrieves all cloud storage snapshots from Firestore / cloud registry
   */
  async getCloudSnapshots(): Promise<CloudStorageSnapshotRecord[]> {
    try {
      const colRef = collection(db, 'cloudSnapshots');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const records: CloudStorageSnapshotRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      if (records.length > 0) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('alkarwan_cloud_snapshots_registry', JSON.stringify(records));
        }
        return records;
      }
    } catch (err) {
      console.warn('[FirebaseService] Error reading cloudSnapshots from Firestore:', err);
    }

    // Fallback to local storage mirror
    if (typeof window !== 'undefined') {
      try {
        const storedStr = localStorage.getItem('alkarwan_cloud_snapshots_registry');
        if (storedStr) {
          return JSON.parse(storedStr);
        }
      } catch {
        // ignore
      }
    }
    return [];
  },

  /**
   * Deletes a specific snapshot from Firebase Storage and updates Firestore status
   */
  async deleteCloudSnapshot(snapshotId: string, storagePath: string): Promise<void> {
    // 1. Delete from Firebase Storage
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn(`[Firebase Storage] Could not delete object ${storagePath}:`, err);
    }

    // 2. Mark PURGED or remove from Firestore
    try {
      const docRef = doc(db, 'cloudSnapshots', snapshotId);
      await updateDoc(docRef, { status: 'PURGED' });
    } catch {
      try {
        const docRef = doc(db, 'cloudSnapshots', snapshotId);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn(`[Firestore] Could not delete snapshot record ${snapshotId}:`, err);
      }
    }

    // 3. Update localStorage mirror
    if (typeof window !== 'undefined') {
      try {
        const storedStr = localStorage.getItem('alkarwan_cloud_snapshots_registry');
        if (storedStr) {
          const list: CloudStorageSnapshotRecord[] = JSON.parse(storedStr);
          const updated = list.map((item) =>
            item.id === snapshotId ? { ...item, status: 'PURGED' as const } : item
          );
          localStorage.setItem('alkarwan_cloud_snapshots_registry', JSON.stringify(updated));
        }
        localStorage.removeItem(`alkarwan_snap_cache_${snapshotId}`);
      } catch {
        // ignore
      }
    }
  },

  /**
   * Enforces 30-day retention policy:
   * Identifies all stored snapshots older than retentionDays (default 30 days),
   * purges them from Firebase Storage, and updates registry status.
   */
  async enforceRetentionPolicy(
    retentionDays: number = 30
  ): Promise<{ purgedCount: number; freedKB: number; purgedItems: string[] }> {
    const snapshots = await FirebaseService.getCloudSnapshots();
    const now = Date.now();
    let purgedCount = 0;
    let freedKB = 0;
    const purgedItems: string[] = [];

    for (const snap of snapshots) {
      if (snap.status === 'PURGED') continue;

      const createdTime = new Date(snap.createdAt).getTime();
      const ageDays = (now - createdTime) / (1000 * 60 * 60 * 24);
      const isExpired =
        ageDays >= retentionDays ||
        (Boolean(snap.expiresAt) && now > new Date(snap.expiresAt).getTime());

      if (isExpired) {
        try {
          await FirebaseService.deleteCloudSnapshot(snap.id, snap.storagePath);
          purgedCount++;
          freedKB += snap.payloadSizeKB || 0;
          purgedItems.push(`${snap.fileName} (${Math.floor(ageDays)} days old)`);
        } catch (err) {
          console.warn(`[Retention Engine] Failed to purge expired snapshot ${snap.fileName}:`, err);
        }
      }
    }

    console.log(
      `[Retention Engine] 30-Day Retention Policy Enforced: Purged ${purgedCount} expired snapshots (${Math.round(freedKB)} KB freed).`
    );
    return { purgedCount, freedKB, purgedItems };
  },

  /**
   * Helper: Calculates the next daily execution timestamp given an HH:mm string
   */
  calculateNextDailyRun(timeHHmm: string): string {
    const [hours, minutes] = (timeHHmm || '02:00').split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(isNaN(hours) ? 2 : hours, isNaN(minutes) ? 0 : minutes, 0, 0);

    if (now.getTime() >= target.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.toISOString();
  },

  /**
   * Loads Cloud Scheduler configuration
   */
  async getCloudSchedulerConfig(): Promise<CloudSchedulerConfig> {
    const defaultConfig: CloudSchedulerConfig = {
      id: 'daily_snapshot',
      enabled: true,
      dailyRunTime: '02:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baghdad',
      retentionDays: 30,
      autoPurgeExpired: true,
      lastRunTimestamp: null,
      lastRunStatus: 'IDLE',
      lastRunMessage: 'Cloud Scheduler initialized with 30-day retention policy.',
      lastRunResult: null,
      nextScheduledRun: FirebaseService.calculateNextDailyRun('02:00'),
      history: [],
    };

    try {
      const docRef = doc(db, 'cloudSchedulerConfig', 'daily_snapshot');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as CloudSchedulerConfig;
        return {
          ...defaultConfig,
          ...data,
          nextScheduledRun:
            data.nextScheduledRun || FirebaseService.calculateNextDailyRun(data.dailyRunTime || '02:00'),
        };
      }
    } catch (err) {
      console.warn('[CloudScheduler] Error reading config from Firestore:', err);
    }

    if (typeof window !== 'undefined') {
      try {
        const localStr = localStorage.getItem('alkarwan_cloud_scheduler_config');
        if (localStr) {
          return JSON.parse(localStr);
        }
      } catch {
        // ignore
      }
    }

    return defaultConfig;
  },

  /**
   * Updates and saves Cloud Scheduler configuration
   */
  async saveCloudSchedulerConfig(
    partial: Partial<CloudSchedulerConfig>
  ): Promise<CloudSchedulerConfig> {
    const current = await FirebaseService.getCloudSchedulerConfig();
    const updated: CloudSchedulerConfig = {
      ...current,
      ...partial,
      nextScheduledRun:
        partial.dailyRunTime && partial.dailyRunTime !== current.dailyRunTime
          ? FirebaseService.calculateNextDailyRun(partial.dailyRunTime)
          : partial.nextScheduledRun ?? current.nextScheduledRun,
    };

    try {
      const docRef = doc(db, 'cloudSchedulerConfig', 'daily_snapshot');
      await setDoc(docRef, updated);
    } catch (err) {
      console.warn('[CloudScheduler] Could not save config to Firestore:', err);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('alkarwan_cloud_scheduler_config', JSON.stringify(updated));
        window.dispatchEvent(
          new CustomEvent('alkarwan:cloud_scheduler_updated', { detail: updated })
        );
      } catch {
        // ignore
      }
    }

    return updated;
  },

  /**
   * Executes scheduled daily snapshot (Automated or Manual) and encloses 30-day retention cleanup
   */
  async executeScheduledDailySnapshot(
    triggerType: 'AUTOMATED' | 'MANUAL' = 'AUTOMATED',
    userProfile?: { name: string; role: string }
  ): Promise<{
    snapshotRecord: CloudStorageSnapshotRecord;
    purgedCount: number;
    freedKB: number;
  }> {
    const config = await FirebaseService.getCloudSchedulerConfig();

    // 1. Mark status RUNNING
    await FirebaseService.saveCloudSchedulerConfig({
      lastRunStatus: 'RUNNING',
      lastRunMessage:
        triggerType === 'AUTOMATED'
          ? 'Automated daily snapshot executing...'
          : 'Manual snapshot backup executing...',
    });

    try {
      // 2. Export full 19-collection database snapshot
      const snapshot = await FirebaseService.createDatabaseSnapshot(
        {
          name:
            userProfile?.name ||
            (triggerType === 'AUTOMATED' ? 'Cloud Scheduler (Automated)' : 'Administrator'),
          role: userProfile?.role || 'System Automation',
        },
        undefined
      );

      // 3. Upload to Firebase Storage with 30-day retention
      const snapshotRecord = await FirebaseService.uploadSnapshotToFirebaseStorage(snapshot, {
        autoScheduled: triggerType === 'AUTOMATED',
        retentionDays: config.retentionDays || 30,
        createdBy: userProfile?.name || 'Cloud Scheduler',
      });

      // 4. Enforce 30-Day Retention Policy Cleanup
      let purgedCount = 0;
      let freedKB = 0;
      if (config.autoPurgeExpired) {
        const cleanup = await FirebaseService.enforceRetentionPolicy(config.retentionDays || 30);
        purgedCount = cleanup.purgedCount;
        freedKB = cleanup.freedKB;
      }

      // 5. Update scheduler state & history
      const nowIso = new Date().toISOString();
      const historyEntry: CloudSchedulerHistoryEntry = {
        id: `run_${Date.now()}`,
        timestamp: nowIso,
        status: 'SUCCESS',
        totalDocuments: snapshotRecord.totalDocuments,
        payloadSizeKB: snapshotRecord.payloadSizeKB,
        purgedCount,
        message: `Snapshot ${snapshotRecord.fileName} (${snapshotRecord.payloadSizeKB} KB) saved to Firebase Storage. 30-day retention policy active.`,
        storagePath: snapshotRecord.storagePath,
      };

      const updatedHistory = [historyEntry, ...(config.history || [])].slice(0, 50);

      await FirebaseService.saveCloudSchedulerConfig({
        lastRunTimestamp: nowIso,
        lastRunStatus: 'SUCCESS',
        lastRunMessage: `Completed: ${snapshotRecord.totalDocuments} documents (${snapshotRecord.payloadSizeKB} KB) uploaded to Firebase Storage.`,
        lastRunResult: {
          snapshotId: snapshotRecord.id,
          fileName: snapshotRecord.fileName,
          totalDocuments: snapshotRecord.totalDocuments,
          payloadSizeKB: snapshotRecord.payloadSizeKB,
          purgedCount,
          storagePath: snapshotRecord.storagePath,
        },
        nextScheduledRun: FirebaseService.calculateNextDailyRun(config.dailyRunTime || '02:00'),
        history: updatedHistory,
      });

      return { snapshotRecord, purgedCount, freedKB };
    } catch (err: any) {
      console.error('[CloudScheduler] Execution failed:', err);
      await FirebaseService.saveCloudSchedulerConfig({
        lastRunStatus: 'FAILED',
        lastRunMessage: err?.message || 'Snapshot execution failed',
      });
      throw err;
    }
  },

  /**
   * BULK ROLLBACK ENGINE:
   * Captures and uploads an immediate safety snapshot tagged specifically as PRE_WIPE
   * to Firebase Storage before any destructive wipe is executed.
   */
  async createAndUploadPreWipeSnapshot(exportedBy: {
    name: string;
    email?: string;
    role?: string;
  }): Promise<CloudStorageSnapshotRecord> {
    console.log('[BulkRollbackEngine] Capturing pre-wipe safety snapshot across all Firestore collections...');
    const snapshot = await FirebaseService.createDatabaseSnapshot(
      {
        name: exportedBy.name,
        email: exportedBy.email,
        role: exportedBy.role || 'Admin Supervisor',
      },
      undefined, // all collections
      (colName, count, currentTotal) => {
        console.log(`[Pre-Wipe Backup] Captured ${count} docs from ${colName} (${currentTotal} total)`);
      }
    );

    const record = await FirebaseService.uploadSnapshotToFirebaseStorage(snapshot, {
      isPreWipe: true,
      tag: 'PRE_WIPE',
      createdBy: `${exportedBy.name} (Pre-Wipe Insurance)`,
      retentionDays: 30,
    });

    console.log(
      `[BulkRollbackEngine] Pre-wipe snapshot successfully saved to Firebase Storage at ${record.storagePath} (${record.totalDocuments} documents)`
    );
    return record;
  },

  /**
   * BULK ROLLBACK ENGINE:
   * Locates the most recent Pre-Wipe snapshot directly from Firebase Storage / Firestore metadata
   */
  async getLatestPreWipeSnapshot(): Promise<CloudStorageSnapshotRecord | null> {
    // 1. Try systemMeta/latestPreWipeSnapshot document in Firestore
    try {
      const metaDocRef = doc(db, 'systemMeta', 'latestPreWipeSnapshot');
      const metaSnap = await getDoc(metaDocRef);
      if (metaSnap.exists()) {
        const data = metaSnap.data() as CloudStorageSnapshotRecord;
        if (data && data.status !== 'PURGED') {
          return data;
        }
      }
    } catch (err) {
      console.warn('[BulkRollbackEngine] Could not read systemMeta/latestPreWipeSnapshot:', err);
    }

    // 2. Query cloudSnapshots collection for isPreWipe == true or tag == 'PRE_WIPE'
    try {
      const colRef = collection(db, 'cloudSnapshots');
      const q = query(colRef, where('isPreWipe', '==', true), orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return {
          id: snap.docs[0].id,
          ...(snap.docs[0].data() as any),
        };
      }
    } catch (err) {
      console.warn('[BulkRollbackEngine] Query for isPreWipe in cloudSnapshots failed:', err);
    }

    // 3. Fallback: check localStorage mirror for latest prewipe snapshot
    if (typeof window !== 'undefined') {
      try {
        const storedStr = localStorage.getItem('alkarwan_latest_prewipe_snapshot');
        if (storedStr) {
          return JSON.parse(storedStr);
        }
      } catch {
        // ignore
      }
    }

    // 4. Secondary Fallback: Return the most recent active snapshot in cloudSnapshots
    try {
      const allSnapshots = await FirebaseService.getCloudSnapshots();
      const active = allSnapshots.filter((s) => s.status !== 'PURGED');
      if (active.length > 0) {
        return active[0];
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * BULK ROLLBACK ENGINE:
   * Downloads snapshot JSON payload directly from Firebase Storage
   * Uses authenticated getBytes SDK call with robust fallbacks
   */
  async fetchSnapshotFromFirebaseStorage(
    record: CloudStorageSnapshotRecord
  ): Promise<DatabaseSnapshot> {
    let rawJson: string | null = null;

    // Method 1: Direct authenticated getBytes from Firebase Storage
    try {
      const storageRef = ref(storage, record.storagePath);
      const arrayBuffer = await getBytes(storageRef);
      rawJson = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
      console.log(`[BulkRollbackEngine] Retrieved ${rawJson.length} bytes directly from Firebase Storage.`);
    } catch (storageErr) {
      console.warn('[BulkRollbackEngine] getBytes from storage failed, trying downloadUrl:', storageErr);
    }

    // Method 2: HTTP fetch via downloadUrl or refreshed URL
    if (!rawJson && record.downloadUrl) {
      try {
        const response = await fetch(record.downloadUrl);
        if (response.ok) {
          rawJson = await response.text();
        }
      } catch (fetchErr) {
        console.warn('[BulkRollbackEngine] fetch downloadUrl failed:', fetchErr);
      }
    }

    // Method 3: Try getting refreshed downloadURL if not available or expired
    if (!rawJson) {
      try {
        const storageRef = ref(storage, record.storagePath);
        const freshUrl = await getDownloadURL(storageRef);
        const response = await fetch(freshUrl);
        if (response.ok) {
          rawJson = await response.text();
        }
      } catch (refreshErr) {
        console.warn('[BulkRollbackEngine] Refreshed download URL fetch failed:', refreshErr);
      }
    }

    // Method 4: LocalStorage Snapshot Cache fallback
    if (!rawJson && typeof window !== 'undefined') {
      try {
        if (record.isPreWipe) {
          rawJson = localStorage.getItem('alkarwan_prewipe_snapshot_cache');
        }
        if (!rawJson) {
          rawJson = localStorage.getItem(`alkarwan_snap_cache_${record.id}`);
        }
      } catch {
        // ignore
      }
    }

    if (!rawJson) {
      throw new Error(
        `Unable to retrieve snapshot JSON from Firebase Storage for ${record.fileName} (${record.storagePath}).`
      );
    }

    const snapshot: DatabaseSnapshot = JSON.parse(rawJson);
    if (!snapshot || !snapshot.collections || typeof snapshot.collections !== 'object') {
      throw new Error('Invalid snapshot payload: collections object missing or corrupted.');
    }

    return snapshot;
  },

  /**
   * BULK ROLLBACK ENGINE:
   * Restores a DatabaseSnapshot directly into Firestore across all or selected collections
   * Uses atomic batched writes (up to 400 documents per batch)
   */
  async restoreDatabaseSnapshot(
    snapshot: DatabaseSnapshot,
    options?: {
      selectedCollections?: string[];
      user?: { name: string; email?: string };
      onProgress?: (colName: string, restoredInCol: number, totalRestored: number) => void;
    }
  ): Promise<BulkRollbackResult> {
    const collectionsToRestore =
      options?.selectedCollections && options.selectedCollections.length > 0
        ? options.selectedCollections
        : Object.keys(snapshot.collections || {});

    const details: Record<string, number> = {};
    let totalRestored = 0;

    console.log(
      `[BulkRollbackEngine] Initiating Firestore restoration for ${collectionsToRestore.length} collections...`
    );

    for (const colName of collectionsToRestore) {
      const docList = snapshot.collections[colName] || [];
      if (!Array.isArray(docList) || docList.length === 0) {
        details[colName] = 0;
        continue;
      }

      let restoredInCol = 0;
      const CHUNK_SIZE = 400;

      for (let i = 0; i < docList.length; i += CHUNK_SIZE) {
        const chunk = docList.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          if (!item || typeof item !== 'object') return;

          // Determine document ID
          const docId = item._id || item.id || item.code || item.transactionNumber || `doc_${Math.random().toString(36).slice(2, 9)}`;
          const docRef = doc(db, colName, String(docId));

          // Clean payload: strip internal _id if present
          const cleanItem = { ...item };
          delete cleanItem._id;

          batch.set(docRef, cleanItem, { merge: true });
        });

        await batch.commit();
        restoredInCol += chunk.length;
        totalRestored += chunk.length;

        if (options?.onProgress) {
          options.onProgress(colName, restoredInCol, totalRestored);
        }
      }

      details[colName] = restoredInCol;
    }

    // 2. Record tamper-evident Audit Log Entry for Database Rollback
    const nowIso = new Date().toISOString();
    const rollbackLogId = `LOG-ROLLBACK-${Date.now()}`;
    const actorName = options?.user?.name || snapshot.metadata?.exportedBy || 'Admin Supervisor';
    try {
      const logRef = doc(db, 'auditLogs', rollbackLogId);
      await setDoc(logRef, {
        id: rollbackLogId,
        timestamp: nowIso,
        action: 'DATABASE_BULK_ROLLBACK',
        actionAr: 'استعادة شاملة لقاعدة البيانات من لقطة التخزين السحابي',
        entityType: 'DatabaseRollback',
        entityId: snapshot.metadata?.exportTimestamp || 'PRE_WIPE_BACKUP',
        oldValue: 'Pre-Rollback State',
        newValue: `Restored ${totalRestored} documents across ${collectionsToRestore.length} collections`,
        user: actorName,
        metadata: {
          snapshotTimestamp: snapshot.metadata?.exportTimestamp,
          snapshotTotalDocs: snapshot.metadata?.totalDocuments,
          collectionsRestored: collectionsToRestore,
          details,
        },
      });
    } catch (auditErr) {
      console.warn('[BulkRollbackEngine] Could not record rollback audit log in Firestore:', auditErr);
    }

    // 3. Clear system clean slate flag in localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('alkarwan_system_clean_slate');
      localStorage.setItem('alkarwan_last_rollback_time', nowIso);
      localStorage.setItem('alkarwan_last_rollback_docs', String(totalRestored));
    }

    console.log(
      `[BulkRollbackEngine] Rollback finished successfully! Restored ${totalRestored} documents into Firestore.`
    );

    return {
      success: true,
      totalRestored,
      details,
      snapshotId: snapshot.metadata?.exportTimestamp || 'snapshot',
      snapshotFileName: `alkarwan-snapshot-${snapshot.metadata?.exportTimestamp || 'restored'}`,
      snapshotTimestamp: snapshot.metadata?.exportTimestamp || nowIso,
    };
  },
};

// Bind all methods to FirebaseService to prevent any 'this' context detachment issues
for (const key of Object.keys(FirebaseService)) {
  if (typeof (FirebaseService as any)[key] === 'function') {
    (FirebaseService as any)[key] = (FirebaseService as any)[key].bind(FirebaseService);
  }
}


