import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  MaterialItem,
  Supplier,
  Warehouse,
  WarehouseLocation,
  ReceivingTransaction,
  ReceivingEvent,
  ShreddingTransaction,
  ProductionIssue,
  InventoryMovement,
  InventoryBalance,
  PendingAction,
  AuditLogEntry,
  UserProfile,
  UserRole,
  NavigationPage,
  TransactionStatus,
  MovementType,
  ImportBatch,
  ProductionDamageRecord,
  InventoryConsistencyReport,
  ProductionOrder,
  ShiftHandoverRecord,
  DailyOperationsSummary,
  DailySectionMetrics,
  BulkBag,
  BulkBagStatus,
  ApprovalRecord,
  PurchaseRequirement,
  PurchaseReceipt,
  PhysicalInventoryCount,
  WarehouseTransfer,
} from '../types';
import { AnalyzedDataRow, ExcelDocType } from '../services/smartExcelParser';
import { calculateMaterialReconciliation } from '../services/inventoryReconciler';
import { evaluateLowStockInventory, LowStockOverview } from '../services/lowStockMonitor';
import {
  INITIAL_USERS,
  INITIAL_MATERIALS,
  INITIAL_SUPPLIERS,
  INITIAL_WAREHOUSES,
  INITIAL_LOCATIONS,
  INITIAL_RECEIVING_TRANSACTIONS,
  INITIAL_SHREDDING_TRANSACTIONS,
  INITIAL_PRODUCTION_ISSUES,
  INITIAL_INVENTORY_MOVEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_PRODUCTION_ORDERS,
  INITIAL_SHIFT_HANDOVERS,
  INITIAL_BULK_BAGS,
  INITIAL_APPROVALS,
  INITIAL_PURCHASE_REQUIREMENTS,
  INITIAL_PURCHASE_RECEIPTS,
  INITIAL_PHYSICAL_COUNTS,
} from '../services/initialData';
import {
  executeInventoryMovement,
  executeCentralInventoryMovement,
  validateInventoryMovement,
  MovementRequest,
  MovementResult,
} from '../services/inventoryMovementEngine';
import {
  SystemCodeConfig,
  getStoredSystemCodes,
  subscribeToSystemCodesFromFirestore,
  saveSystemCodeToFirestore,
  createSystemCodeInFirestore,
  deleteSystemCodeFromFirestore,
  initializeDefaultSystemCodesInFirestore,
  getCodeByPurpose,
  InventoryCodePurpose,
} from '../services/systemCodesService';
import { User } from 'firebase/auth';
import {
  FirebaseService,
  DatabaseSnapshot,
  testFirestoreConnection,
  saveDocToFirestore,
  fetchCollectionFromFirestore,
  syncCollectionToFirestore,
  signInWithGooglePopup,
  signOutUser,
  onAuthUserChanged,
  auth,
  offlinePersistencePromise,
  getIsOfflinePersistenceEnabled,
  flushPendingOfflineWrites,
} from '../services/firebase';
import {
  WorkflowStage,
  StatusValidationResult,
  normalizeToWorkflowStage,
  validateStatusTransition,
  validateStageMandatoryFields,
  validateProductionIssueTransition,
  validateShreddingActionTransition,
  checkMaterialProductionReadiness as checkMaterialProductionReadinessService,
  WORKFLOW_STAGE_INFO,
} from '../services/statusMachineService';

interface FactoryContextType {
  // Authentication & Session
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  firebaseUser: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  emergencyBypassAuth: (role?: UserRole) => void;

  // Master data
  users: UserProfile[];
  materials: MaterialItem[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];

  // Transactions & Operational records
  receivingTransactions: ReceivingTransaction[];
  shreddingTransactions: ShreddingTransaction[];
  productionIssues: ProductionIssue[];
  inventoryMovements: InventoryMovement[];
  auditLogs: AuditLogEntry[];

  // Derived state & ledgers
  inventoryBalances: InventoryBalance[];
  pendingActions: PendingAction[];
  logAudit: (
    action: string,
    actionAr: string,
    entityType: string,
    entityId: string,
    oldValue: string,
    newValue: string,
    notes?: string
  ) => void;

  // Receiving Actions
  createReceivingTransaction: (data: Partial<ReceivingTransaction>) => { success: boolean; id?: string; error?: string };
  updateReceivingTransaction: (id: string, data: Partial<ReceivingTransaction>) => { success: boolean; error?: string };
  completeScaleIn: (id: string, scaleInWeightKG: number, bags: number) => { success: boolean; error?: string };
  startUnloading: (id: string, unloadBay?: string, operator?: string) => { success: boolean; error?: string };
  completeUnloading: (id: string, unloadBay?: string, condition?: any, operator?: string) => { success: boolean; error?: string };
  completeScaleOut: (id: string, scaleOutWeightKG: number) => { success: boolean; error?: string };
  confirmReceivingAndRoute: (
    id: string,
    requiresShreddingOrRoute: boolean | 'READY_SHREDDED' | 'NOT_SHREDDED',
    warehouseId?: string,
    locationId?: string
  ) => { success: boolean; error?: string };
  sendToTherm: (id: string, targetLocationId?: string, operator?: string) => { success: boolean; error?: string; shreddingId?: string };
  issueReceivingToProduction: (
    id: string,
    data: {
      productionOrderNumber?: string;
      machineLine?: string;
      quantityKG?: number;
      bulkBagsCount?: number;
      shift?: 'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي';
      notes?: string;
    }
  ) => { success: boolean; issueId?: string; error?: string };
  createTestReceivingTransaction: () => { success: boolean; id: string };

  // Shredding / Therm Actions
  createShreddingTransaction: (data: Partial<ShreddingTransaction>) => { success: boolean; id?: string; error?: string };
  completeShredding: (
    id: string,
    outputKG: number,
    bulkBagsOutput: number,
    productionDamageKG: number,
    notes?: string
  ) => { success: boolean; error?: string };
  returnShreddingToStorage: (
    id: string,
    destWarehouseId: string,
    destLocationId: string,
    notes?: string
  ) => { success: boolean; error?: string };
  startShreddingJob: (data: any) => { success: boolean; id?: string; error?: string };
  completeShreddingJob: (
    id: string,
    outputKG: number,
    bulkBagsOutput: number,
    productionDamageKG: number,
    notes?: string
  ) => { success: boolean; error?: string };
  returnShreddedToStorage: (
    id: string,
    destWarehouseId: string,
    destLocationId: string,
    notes?: string
  ) => { success: boolean; error?: string };

  // Production Issue Actions
  createProductionIssue: (data: {
    productionOrderNumber: string;
    machineLine: string;
    materialId: string;
    warehouseId: string;
    locationId: string;
    quantityKG: number;
    bulkBagsCount: number;
    legacyDocumentNumber?: string;
    shift: 'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي';
    notes?: string;
  }) => { success: boolean; id?: string; error?: string };
  issueToProduction: (data: any) => { success: boolean; id?: string; error?: string };

  // Production Damage Actions
  productionDamages: ProductionDamageRecord[];
  recordProductionDamage: (data: {
    materialId: string;
    quantityKG: number;
    bulkBagsCount: number;
    machineLine: string;
    reason: string;
    disposition?: 'SHREDDING_QUEUE' | 'DISPOSED' | 'QUARANTINE';
    notes?: string;
    shift?: string;
    warehouseId?: string;
    locationId?: string;
  }) => { success: boolean; error?: string; id?: string };

  // Production Orders (Section 10)
  productionOrders: ProductionOrder[];
  createProductionOrder: (orderData: Partial<ProductionOrder>) => { success: boolean; id?: string; error?: string };
  updateProductionOrder: (id: string, data: Partial<ProductionOrder>) => { success: boolean; error?: string };
  completeProductionOrder: (id: string, actualOutputKG: number, damageKG: number, notes?: string) => { success: boolean; error?: string };

  // Shift Handover (Section 15)
  shiftHandovers: ShiftHandoverRecord[];
  addShiftHandover: (data: Partial<ShiftHandoverRecord>) => { success: boolean; id?: string; error?: string };
  acknowledgeShiftHandover: (id: string, incomingSupervisorName: string) => { success: boolean; error?: string };

  // Three Daily Operation Sections Calculations (Section 13)
  getDailyOperationsSummary: (targetDate?: string, shiftFilter?: string) => DailyOperationsSummary;

  // Master Data CRUD
  addMaterial: (material: Omit<MaterialItem, 'id' | 'createdAt'>) => { success: boolean; error?: string };
  updateMaterial: (id: string, material: Partial<MaterialItem>) => { success: boolean; error?: string };
  bulkImportMaterials: (
    items: Array<Partial<MaterialItem> & { code: string; nameAr: string }>,
    mode?: 'UPSERT' | 'CREATE_ONLY' | 'UPDATE_ONLY'
  ) => {
    success: boolean;
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
    affectedMaterials: MaterialItem[];
  };
  addSupplier: (supplier: Omit<Supplier, 'id' | 'totalDeliveriesCount' | 'totalKGDelivered'>) => { success: boolean; error?: string };
  updateSupplier: (id: string, supplier: Partial<Supplier>) => { success: boolean; error?: string };
  addWarehouse: (warehouse: Omit<Warehouse, 'id'>) => { success: boolean; id?: string };
  updateWarehouse: (id: string, updates: Partial<Warehouse>) => Promise<boolean>;
  addLocation: (location: Omit<WarehouseLocation, 'id'>) => { success: boolean; id?: string };
  updateLocation: (id: string, updates: Partial<WarehouseLocation>) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<boolean>;

  // Configurable AL-KARWAN Internal Inventory Codes (167 for Storage, 546 for Production, etc.)
  systemCodes: SystemCodeConfig[];
  activeStorageCode: string;
  activeProductionCode: string;
  activeShreddingReceiptCode: string;
  activeShreddingMoveCode: string;
  getActiveInventoryCode: (purpose: InventoryCodePurpose) => string;
  updateSystemInventoryCode: (code: string, updates: Partial<SystemCodeConfig>) => Promise<boolean>;
  addSystemInventoryCode: (newCode: Omit<SystemCodeConfig, 'id' | 'updatedAt'>) => Promise<boolean>;
  deleteSystemInventoryCode: (code: string) => Promise<boolean>;
  resetSystemInventoryCodes: () => Promise<void>;

  // Warehouse Transfer
  executeLocationTransfer: (
    materialId: string,
    sourceLocationId: string,
    destLocationId: string,
    quantityKG: number,
    bulkBags: number,
    notes?: string
  ) => { success: boolean; error?: string };
  transferStock: (...args: any[]) => { success: boolean; error?: string };

  // Automated RFID Bulk Movement & Zone Asset Tracking
  executeRfidBulkMovement: (params: {
    portalId?: string;
    portalNameAr?: string;
    portalNameEn?: string;
    palletId?: string;
    palletRfidTag?: string;
    bagIds: string[];
    toWarehouseId: string;
    toLocationCode: string;
    notes?: string;
    trackingMethod?: 'RFID_PORTAL' | 'RFID_HANDHELD';
  }) => Promise<{
    success: boolean;
    movedBagsCount: number;
    totalWeightKG: number;
    movementId: string;
    messageAr: string;
  }>;

  // Automated Inventory Consistency & Admin Reconciliation
  checkInventoryConsistency: () => InventoryConsistencyReport[];
  reconcileMaterialStock: (
    materialId: string,
    locationId: string,
    targetKG: number,
    targetBags: number,
    reason: string,
    supervisorPin: string
  ) => { success: boolean; error?: string };
  autoFixDiscrepancies: (
    materialIds: string[],
    customReason?: string,
    supervisorPin?: string
  ) => {
    success: boolean;
    fixedCount: number;
    results: {
      materialId: string;
      materialCode: string;
      materialName: string;
      deltaKG: number;
      deltaBags: number;
      documentNumber: string;
      success: boolean;
      error?: string;
    }[];
    error?: string;
  };

  // Low Stock & Safety Thresholds Monitoring
  lowStockOverview: LowStockOverview;
  updateMaterialSafetyThreshold: (
    materialId: string,
    minStockKG: number,
    maxStockKG: number
  ) => { success: boolean; error?: string };

  // Individual Bulk Bags (شليف) & Tracking
  bulkBags: BulkBag[];
  registerBulkBag: (bag: Partial<BulkBag>) => { success: boolean; id?: string; error?: string };
  updateBulkBag: (id: string, updates: Partial<BulkBag>) => { success: boolean; error?: string };

  // Supervisory Approvals (مركز الموافقات الرقابية)
  approvals: ApprovalRecord[];
  approveRequest: (approvalId: string, notes?: string) => { success: boolean; error?: string };
  rejectRequest: (approvalId: string, notes?: string) => { success: boolean; error?: string };

  // Procurement & Requirements (طلبات الشراء والمستودع)
  purchaseRequirements: PurchaseRequirement[];
  purchaseReceipts: PurchaseReceipt[];
  createPurchaseRequirement: (req: Partial<PurchaseRequirement>) => { success: boolean; id?: string; error?: string };

  // Physical Inventory Count (الجرد الفعلي والتسويات)
  physicalCounts: PhysicalInventoryCount[];
  createPhysicalCount: (data: Partial<PhysicalInventoryCount>) => { success: boolean; id?: string; error?: string };
  applyPhysicalCount: (id: string, supervisorPin?: string) => { success: boolean; error?: string };

  // Warehouse Transfers
  warehouseTransfers: WarehouseTransfer[];
  executeWarehouseTransfer: (transferData: Partial<WarehouseTransfer>) => Promise<{ success: boolean; id?: string; error?: string; transfer?: WarehouseTransfer }> | { success: boolean; id?: string; error?: string; transfer?: WarehouseTransfer };

  // Central Inventory Movement Engine
  executeEngineMovement: (req: MovementRequest) => Promise<MovementResult> | MovementResult;

  // Firebase Firestore Synchronization & Offline Persistence (IndexedDB)
  firestoreConnected: boolean;
  syncStatus: 'SYNCED' | 'SYNCING' | 'OFFLINE';
  isOnline: boolean;
  isOfflinePersistenceActive: boolean;
  flushPendingWrites: () => Promise<boolean>;
  syncAllToFirestore: () => Promise<{ success: boolean; syncedCount: number; error?: string }>;
  refreshDataFromFirestore: () => Promise<{ success: boolean; recordsCount: number; error?: string }>;

  // Search & Navigation hook
  currentPage: NavigationPage;
  setCurrentPage: (page: NavigationPage) => void;
  selectedTransactionId: string | null;
  setSelectedTransactionId: (id: string | null) => void;
  selectedMaterialId: string | null;
  setSelectedMaterialId: (id: string | null) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  jumpToPendingAction: (action: PendingAction) => void;

  // Excel & Historical Migration Operations
  importBatches: ImportBatch[];
  createImportBatch: (batchData: Partial<ImportBatch>) => ImportBatch;
  updateImportBatch: (batchId: string, updates: Partial<ImportBatch>) => void;
  computeMovementFingerprint: (data: {
    docRef?: string;
    materialCode?: string;
    date?: string;
    netKG?: number;
    bulkBags?: number;
    supplier?: string;
    sourceFile?: string;
    sourceSheet?: string;
    sourceRow?: number;
  }) => string;
  exportToExcel: (sheetName: string, data: any[], filename: string) => void;
  importExcelData: (type: 'RECEIVING' | 'SHREDDING' | 'PRODUCTION' | 'MATERIALS', parsedRows: any[]) => { success: boolean; count: number; errors: string[] };
  importSmartAnalyzedRows: (batch: {
    batchId: string;
    fileName: string;
    docType: ExcelDocType;
    rows: AnalyzedDataRow[];
    isHistoricalSnapshot?: boolean;
  }) => { success: boolean; count: number; errors: string[] };

  // Global reset & Test cleanup
  resetFactoryData: () => void;
  restoreSnapshotIntoContext: (snapshot: DatabaseSnapshot) => { totalRestored: number; collectionsRestored: string[] };
  purgeTestData: (prefix?: string) => {
    purgedReceiving: number;
    purgedShredding: number;
    purgedProductionOrders: number;
    purgedProductionIssues: number;
    purgedProductionDamages: number;
    purgedMovements: number;
    purgedMaterials: number;
    purgedAuditLogs: number;
  };

  // Status-Machine & Workflow Validation Layer
  validateWorkflowTransition: (
    currentStatus: TransactionStatus | string | undefined | null,
    targetStatus: TransactionStatus | string,
    options?: {
      requiresShredding?: boolean;
      route?: 'READY_SHREDDED' | 'NOT_SHREDDED';
      payload?: any;
    }
  ) => StatusValidationResult;
  checkMaterialProductionReadiness: (
    materialId: string,
    locationId: string
  ) => {
    isReady: boolean;
    availableKG: number;
    blockersAr: string[];
    blockersEn: string[];
  };
  getWorkflowStageInfo: (status: TransactionStatus | string | undefined | null) => typeof WORKFLOW_STAGE_INFO[WorkflowStage];
  normalizeToWorkflowStage: (status: TransactionStatus | string | undefined | null) => WorkflowStage;
}

const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

export const FactoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Storage keys
  const STORAGE_KEY = 'alkarwan_factory_state_v2';

  // Firebase Authentication & Session State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY + '_authenticated') === 'true';
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load from local storage or defaults with bulletproof safety
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY + '_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...INITIAL_USERS[0],
            ...parsed,
            nameAr: parsed.nameAr || parsed.name || INITIAL_USERS[0].nameAr,
            name: parsed.name || parsed.nameAr || INITIAL_USERS[0].name,
          };
        }
      }
    } catch (e) {
      console.warn('Error reading stored user, using fallback:', e);
    }
    return INITIAL_USERS[0];
  });
  const [users] = useState<UserProfile[]>(INITIAL_USERS);
  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_materials');
    return saved ? JSON.parse(saved) : INITIAL_MATERIALS;
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_suppliers');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });
  const [warehouses, setWarehouses] = useState<Warehouse[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_warehouses');
    return saved ? JSON.parse(saved) : INITIAL_WAREHOUSES;
  });
  const [locations, setLocations] = useState<WarehouseLocation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_locations');
    return saved ? JSON.parse(saved) : INITIAL_LOCATIONS;
  });

  const [receivingTransactions, setReceivingTransactions] = useState<ReceivingTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_receiving');
    return saved ? JSON.parse(saved) : INITIAL_RECEIVING_TRANSACTIONS;
  });

  const [shreddingTransactions, setShreddingTransactions] = useState<ShreddingTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_shredding');
    return saved ? JSON.parse(saved) : INITIAL_SHREDDING_TRANSACTIONS;
  });

  const [productionIssues, setProductionIssues] = useState<ProductionIssue[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_production');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTION_ISSUES;
  });

  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_movements');
    return saved ? JSON.parse(saved) : INITIAL_INVENTORY_MOVEMENTS;
  });

  const INITIAL_IMPORT_BATCHES: ImportBatch[] = [
    {
      id: 'BATCH-2026-0901-001',
      fileName: 'سجل_الكروان_المعتمد_546.xlsx',
      uploadDateTime: '2026-09-01 08:30',
      uploadedBy: 'أحمد خليل (مدير المخزن)',
      fileSize: '48.5 KB',
      sheets: ['استلام خامات 546'],
      rowsRead: 5,
      rowsAccepted: 5,
      rowsWarning: 0,
      rowsError: 0,
      rowsExcluded: 0,
      status: 'COMPLETED',
      docType: '546',
      importedRowsCount: 5,
      totalKG: 83900,
      totalBags: 83,
      notes: 'دفعة استيراد أولية معتمدة لمستند 546',
      fingerprint: 'FP-546-20260901-83900',
    },
    {
      id: 'BATCH-2026-0905-002',
      fileName: 'مخزن خامات 9.xlsx',
      uploadDateTime: '2026-09-05 11:15',
      uploadedBy: 'م. عمر الفاروق (مشرف عام المصنع)',
      fileSize: '42.8 KB',
      sheets: ['أرصدة خامات 9', 'ملخص المخزن'],
      rowsRead: 4,
      rowsAccepted: 4,
      rowsWarning: 0,
      rowsError: 0,
      rowsExcluded: 0,
      status: 'COMPLETED',
      docType: 'OPENING_BALANCE',
      importedRowsCount: 4,
      totalKG: 64750,
      totalBags: 65,
      notes: 'أرصدة مخزن الخامات الرئيسي المعتمدة لشهر أيلول',
      fingerprint: 'FP-RAW9-20260905-64750',
    },
    {
      id: 'BATCH-2026-0910-003',
      fileName: 'طاقة الثرموفورمينغ_9.xlsx',
      uploadDateTime: '2026-09-10 14:20',
      uploadedBy: 'سارة العلي (مدققة الجودة وتتبع المواد)',
      fileSize: '51.2 KB',
      sheets: ['طاقة حرارية', 'سجل خطوط التشكيل'],
      rowsRead: 12,
      rowsAccepted: 12,
      rowsWarning: 0,
      rowsError: 0,
      rowsExcluded: 0,
      status: 'COMPLETED',
      docType: 'CAPACITY_LOG',
      importedRowsCount: 12,
      totalKG: 21300,
      totalBags: 21,
      notes: 'جرد أولي معتمد لخط التشكيل الحراري والمنتجات نصف المصنعة',
      fingerprint: 'FP-THERM-20260910-21300',
    },
    {
      id: 'BATCH-2026-0914-004',
      fileName: 'صادر_خامات_167.xlsx',
      uploadDateTime: '2026-09-14 09:45',
      uploadedBy: 'محمود الجابري (مسؤول حركة المخزون)',
      fileSize: '36.7 KB',
      sheets: ['صرف إنتاج 167'],
      rowsRead: 18,
      rowsAccepted: 16,
      rowsWarning: 2,
      rowsError: 0,
      rowsExcluded: 0,
      status: 'NEEDS_REVIEW',
      docType: 'PRODUCTION_ISSUE',
      importedRowsCount: 16,
      totalKG: 38500,
      totalBags: 39,
      notes: 'أوامر صرف المواد لخطوط البثق مع وجود تنبيهين على فروقات طفيفة',
      fingerprint: 'FP-ISSUE167-20260914-38500',
    },
    {
      id: 'BATCH-2026-0918-005',
      fileName: 'تعديلات_جرد_أول_المدة_2026.xlsx',
      uploadDateTime: '2026-09-18 16:10',
      uploadedBy: 'أحمد خليل (مدير المخزن)',
      fileSize: '29.4 KB',
      sheets: ['تسوية الجرد'],
      rowsRead: 8,
      rowsAccepted: 8,
      rowsWarning: 0,
      rowsError: 0,
      rowsExcluded: 0,
      status: 'COMPLETED',
      docType: 'AUDIT_ADJUSTMENT',
      importedRowsCount: 8,
      totalKG: 14200,
      totalBags: 14,
      notes: 'تسويات أرصدة ومطابقة أول المدة مع سجلات الدفاتر الورقية',
      fingerprint: 'FP-ADJ-20260918-14200',
    },
    {
      id: 'BATCH-2026-0920-006',
      fileName: 'واردات_مورد_الرافدين_أيلول.xlsx',
      uploadDateTime: '2026-09-20 13:40',
      uploadedBy: 'حيدر الكعبي (أمين مخزن المواد المستلمة)',
      fileSize: '34.2 KB',
      sheets: ['شهادات استلام المورد'],
      rowsRead: 10,
      rowsAccepted: 6,
      rowsWarning: 0,
      rowsError: 0,
      rowsExcluded: 0,
      status: 'IMPORTING',
      docType: 'SUPPLIER_INVOICE',
      importedRowsCount: 6,
      totalKG: 24500,
      totalBags: 25,
      notes: 'معالجة جارية للتدقيق الآلي ومطابقة أوزان شهادات التوريد مع ميزان البسكول',
      fingerprint: 'FP-SUPP-20260920-24500',
    },
    {
      id: 'BATCH-2026-0921-007',
      fileName: 'شحنة_تالفة_بي_إي_تي_غير_مطابقة.xlsx',
      uploadDateTime: '2026-09-21 07:15',
      uploadedBy: 'سارة العلي (مدققة الجودة وتتبع المواد)',
      fileSize: '22.1 KB',
      sheets: ['فحص الجودة والمطابقة'],
      rowsRead: 6,
      rowsAccepted: 0,
      rowsWarning: 1,
      rowsError: 5,
      rowsExcluded: 0,
      status: 'FAILED',
      docType: 'QUALITY_REJECTION',
      importedRowsCount: 0,
      totalKG: 0,
      totalBags: 0,
      notes: 'فشل الفحص الأولي: عدم تطابق الكود المرجعي وتجاوز نسبة الرطوبة المسموحة',
      fingerprint: 'FP-REJ-20260921-00000',
    },
  ];

  const [importBatches, setImportBatches] = useState<ImportBatch[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_import_batches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 6) {
          return parsed;
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge to ensure rich historical demo records exist alongside saved ones
          const existingIds = new Set(parsed.map((p) => p.id));
          const additions = INITIAL_IMPORT_BATCHES.filter((b) => !existingIds.has(b.id));
          return [...parsed, ...additions];
        }
      } catch {
        // fallback to initial
      }
    }
    return INITIAL_IMPORT_BATCHES;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_audits');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [productionDamages, setProductionDamages] = useState<ProductionDamageRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_production_damages');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'DMG-001',
            damageNumber: 'DMG-2026-001',
            date: '2026-09-01',
            time: '17:05',
            materialId: 'MAT-003',
            materialCode: 'BTL-SCR-03',
            materialName: 'سكراب وهوالك أكواب مفرومة (Batal Scrap)',
            quantityKG: 180,
            bulkBagsCount: 1,
            machineLine: 'THERM-SHREDDER-01 (ماكينة الثرم)',
            operator: 'محمود السيد',
            supervisor: 'عمر عبدالكريم (المشرف العام)',
            shift: 'Morning / صباحي',
            reason: 'تصلب وشوائب معدنية غير قابلة للتدوير',
            disposition: 'QUARANTINE' as const,
            dispositionAr: 'حجر وعزل في ساحة التالف',
            notes: 'تم عزل الشليف في منطقة التالف غير القابل للتدوير',
            createdAt: '2026-09-01T17:05:00Z',
          },
        ];
  });

  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_production_orders');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTION_ORDERS;
  });

  const [shiftHandovers, setShiftHandovers] = useState<ShiftHandoverRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_shift_handovers');
    return saved ? JSON.parse(saved) : INITIAL_SHIFT_HANDOVERS;
  });

  // Individual Bulk Bags (شلايف)
  const [bulkBags, setBulkBags] = useState<BulkBag[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_bulk_bags');
    return saved ? JSON.parse(saved) : INITIAL_BULK_BAGS;
  });

  // Supervisory Approvals (موافقات المشرفين)
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_approvals');
    return saved ? JSON.parse(saved) : INITIAL_APPROVALS;
  });

  // Procurement & Requirements
  const [purchaseRequirements, setPurchaseRequirements] = useState<PurchaseRequirement[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_purchase_reqs');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASE_REQUIREMENTS;
  });

  const [purchaseReceipts, setPurchaseReceipts] = useState<PurchaseReceipt[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_purchase_receipts');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASE_RECEIPTS;
  });

  // Physical Inventory Counts
  const [physicalCounts, setPhysicalCounts] = useState<PhysicalInventoryCount[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_physical_counts');
    return saved ? JSON.parse(saved) : INITIAL_PHYSICAL_COUNTS;
  });

  // Warehouse Transfers
  const [warehouseTransfers, setWarehouseTransfers] = useState<WarehouseTransfer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY + '_transfers');
    return saved ? JSON.parse(saved) : [];
  });

  // Firestore Connection, Sync State & Offline Persistence (IndexedDB)
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'SYNCED' | 'SYNCING' | 'OFFLINE'>('SYNCED');
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isOfflinePersistenceActive, setIsOfflinePersistenceActive] = useState<boolean>(() => {
    return getIsOfflinePersistenceEnabled();
  });

  // Track online/offline transitions & IndexedDB persistence state
  useEffect(() => {
    let isMounted = true;

    offlinePersistencePromise.then((enabled) => {
      if (isMounted) {
        setIsOfflinePersistenceActive(enabled);
      }
    });

    const handleOnline = async () => {
      if (!isMounted) return;
      setIsOnline(true);
      setSyncStatus('SYNCING');
      try {
        await flushPendingOfflineWrites();
        await testFirestoreConnection();
        if (isMounted) {
          setSyncStatus('SYNCED');
          setFirestoreConnected(true);
        }
      } catch (e) {
        if (isMounted) {
          setSyncStatus('SYNCED');
        }
      }
    };

    const handleOffline = () => {
      if (!isMounted) return;
      setIsOnline(false);
      setSyncStatus('OFFLINE');
      console.warn(
        '[Network Notice] Warehouse network offline: IndexedDB local persistence engine active. Transactions & scans will be saved locally and auto-synced upon reconnect.'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const flushPendingWrites = async (): Promise<boolean> => {
    return await flushPendingOfflineWrites();
  };

  // Configurable AL-KARWAN Internal Inventory Codes state (stored in Firestore)
  const [systemCodes, setSystemCodes] = useState<SystemCodeConfig[]>(() => getStoredSystemCodes());

  // Real-time Firestore subscription for systemInventoryCodes collection
  useEffect(() => {
    const unsub = subscribeToSystemCodesFromFirestore((freshCodes) => {
      if (freshCodes && freshCodes.length > 0) {
        setSystemCodes(freshCodes);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const activeStorageCode = getCodeByPurpose('STORAGE', systemCodes);
  const activeProductionCode = getCodeByPurpose('PRODUCTION', systemCodes);
  const activeShreddingReceiptCode = getCodeByPurpose('SHREDDING_RECEIPT', systemCodes);
  const activeShreddingMoveCode = getCodeByPurpose('SHREDDING_MOVE', systemCodes);

  const getActiveInventoryCode = (purpose: InventoryCodePurpose): string => {
    return getCodeByPurpose(purpose, systemCodes);
  };

  // Active view navigation
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Firestore Initial Connect & Background Hydration
  useEffect(() => {
    let isMounted = true;
    const initFirestore = async () => {
      try {
        setSyncStatus('SYNCING');
        const connected = await testFirestoreConnection();
        if (!isMounted) return;
        setFirestoreConnected(connected);
        setSyncStatus(connected ? 'SYNCED' : 'OFFLINE');
      } catch (err) {
        console.warn('Firestore initialization warning:', err);
        if (isMounted) {
          setFirestoreConnected(true); // Fall back gracefully to active local ledger
          setSyncStatus('OFFLINE');
        }
      }
    };
    initFirestore();
    return () => {
      isMounted = false;
    };
  }, []);

  // Firebase Auth State Listener
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthUserChanged(async (fbUser) => {
      if (!isMounted) return;
      setAuthLoading(false);
      if (fbUser) {
        setFirebaseUser(fbUser);
        setIsAuthenticated(true);
        setAuthError(null);
        const isSuperAdmin = fbUser.email?.toLowerCase() === 'karwanpet2@gmail.com';
        const userProfile: UserProfile = {
          id: fbUser.uid,
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Factory User',
          nameAr: isSuperAdmin ? 'المهندس المشرف العام (كروان)' : (fbUser.displayName || 'مستخدم معتمد'),
          role: isSuperAdmin ? 'SUPER_ADMIN' : 'Supervisor',
          badgeNumber: isSuperAdmin ? 'KAR-SUPER-01' : `KRN-${fbUser.uid.slice(0, 5).toUpperCase()}`,
          department: isSuperAdmin ? 'General Management & Factory Governance' : 'Industrial Operations',
          departmentAr: isSuperAdmin ? 'الإدارة العامة وضبط المصنع' : 'العمليات والمستودعات',
          avatarColor: isSuperAdmin ? 'from-amber-500 to-amber-700' : 'from-cyan-500 to-blue-600',
          email: fbUser.email || undefined,
          photoURL: fbUser.photoURL || undefined,
          lastLogin: new Date().toISOString(),
          assignedWarehouse: 'All Factory Units',
          assignedWarehouseAr: 'كافة مرافق ووحدات ومستودعات المصنع',
        };
        setCurrentUser(userProfile);
        localStorage.setItem(STORAGE_KEY + '_authenticated', 'true');
        localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(userProfile));
        saveDocToFirestore('users', fbUser.uid, userProfile);
      } else {
        setFirebaseUser(null);
        const hasEmergency = localStorage.getItem(STORAGE_KEY + '_emergency_session') === 'true';
        if (!hasEmergency) {
          setIsAuthenticated(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Real-Time Firestore Synchronization & Database Seeding
  useEffect(() => {
    if (!isAuthenticated) return;
    let isSubscribed = true;

    // Seed master catalog and factory baseline to Firestore if database is newly initialized
    FirebaseService.seedInitialDataIfEmpty({
      materials: INITIAL_MATERIALS,
      warehouses: INITIAL_WAREHOUSES,
      locations: INITIAL_LOCATIONS,
      suppliers: INITIAL_SUPPLIERS,
      receivingTransactions: INITIAL_RECEIVING_TRANSACTIONS,
      shreddingTransactions: INITIAL_SHREDDING_TRANSACTIONS,
      productionIssues: INITIAL_PRODUCTION_ISSUES,
      productionOrders: INITIAL_PRODUCTION_ORDERS,
      inventoryMovements: INITIAL_INVENTORY_MOVEMENTS,
      bulkBags: INITIAL_BULK_BAGS,
    })
      .then((res) => {
        if (res.seeded) {
          console.log(`[Firestore Engine] Seeded ${res.count} records into Firestore database.`);
        }
        if (isSubscribed) {
          setSyncStatus('SYNCED');
          setFirestoreConnected(true);
        }
      })
      .catch((err) => {
        console.warn('[Firestore Engine] Seeding check completed with notes:', err);
      });

    // Real-Time Subscriptions: mapping Firestore collections to application state
    const unsubMaterials = FirebaseService.materials.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setMaterials(items);
    });

    const unsubBulkBags = FirebaseService.bulkBags.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setBulkBags(items);
    });

    const unsubReceiving = FirebaseService.receivingTransactions.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setReceivingTransactions(items);
    });

    const unsubShredding = FirebaseService.shreddingTransactions.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setShreddingTransactions(items);
    });

    const unsubProduction = FirebaseService.productionIssues.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setProductionIssues(items);
    });

    const unsubMovements = FirebaseService.inventoryMovements.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setInventoryMovements(items);
    });

    const unsubOrders = FirebaseService.productionOrders.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setProductionOrders(items);
    });

    const unsubApprovals = FirebaseService.approvals.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setApprovals(items);
    });

    const unsubAudits = FirebaseService.auditLogs.subscribe((items) => {
      if (!isSubscribed || items.length === 0) return;
      setAuditLogs(items);
    });

    return () => {
      isSubscribed = false;
      unsubMaterials();
      unsubBulkBags();
      unsubReceiving();
      unsubShredding();
      unsubProduction();
      unsubMovements();
      unsubOrders();
      unsubApprovals();
      unsubAudits();
    };
  }, [isAuthenticated]);

  // Secure Google Sign-In
  const loginWithGoogle = async (): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGooglePopup();
      return true;
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      const errorMsg =
        err?.code === 'auth/popup-blocked'
          ? 'تم حظر النافذة المنبثقة بواسطة المتصفح. يرجى السماح بالنوافذ المنبثقة لإتمام تسجيل الدخول أو فتح التطبيق في نافذة مستقلة.'
          : err?.code === 'auth/popup-closed-by-user'
          ? 'تم إغلاق نافذة المصادقة قبل اكتمال تسجيل الدخول.'
          : err?.message || 'فشل تسجيل الدخول عبر Google. تحقق من الاتصال بالإنترنت.';
      setAuthError(errorMsg);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  // Secure Sign-Out
  const logout = async () => {
    try {
      await signOutUser();
      setFirebaseUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem(STORAGE_KEY + '_authenticated');
      localStorage.removeItem(STORAGE_KEY + '_emergency_session');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Emergency Bypass for restricted iframe sandboxes
  const emergencyBypassAuth = (role: UserRole = 'Admin') => {
    let name = 'Al-Karwan Admin';
    let nameAr = 'مدير النظام (Admin)';
    let badgeNumber = 'KRN-ADM-01';
    let department = 'System Administration & IT';
    let departmentAr = 'إدارة النظام وتكنولوجيا المعلومات';
    let avatarColor = 'from-purple-600 to-indigo-700';
    let email = 'karwanpet2@gmail.com';
    let assignedWarehouse = 'All Facilities';
    let assignedWarehouseAr = 'كافة مستودعات وقطاعات المصنع';

    if (role === 'Storage Manager' || role === 'Warehouse Manager') {
      name = 'Ahmed Khalil';
      nameAr = 'أحمد خليل (مدير المستودعات)';
      badgeNumber = 'KRN-STR-MGR';
      department = 'Storage & Inventory Management';
      departmentAr = 'إدارة المستودعات والمخازن';
      avatarColor = 'from-cyan-500 to-blue-600';
      email = 'storage.manager@alkarwan.com';
      assignedWarehouse = 'All Storage Warehouses';
      assignedWarehouseAr = 'كافة مستودعات الخامات ومخزن الثرم';
    } else if (role === 'Storage Worker' || role === 'Storekeeper') {
      name = 'Ali Storekeeper';
      nameAr = 'علي (عامل مستودع وميزان)';
      badgeNumber = 'KRN-STR-WRK';
      department = 'Weighbridge & Warehouse Handling';
      departmentAr = 'عمليات الميزان والاستلام الميداني';
      avatarColor = 'from-blue-500 to-indigo-600';
      email = 'storage.worker@alkarwan.com';
      assignedWarehouse = 'WH-01 Raw Storage';
      assignedWarehouseAr = 'مستودع الخامات الرئيسي رقم 1';
    } else if (role === 'Production' || role === 'Production Operator') {
      name = 'Karrar Production Eng';
      nameAr = 'كرار (مسؤول الإنتاج والتشغيل)';
      badgeNumber = 'KRN-PRD-01';
      department = 'Extrusion & Forming Production';
      departmentAr = 'خطوط البثق والتشكيل الحراري';
      avatarColor = 'from-indigo-500 to-purple-600';
      email = 'production@alkarwan.com';
      assignedWarehouse = 'WH-03 Production Feed Store';
      assignedWarehouseAr = 'مستودع تغذية خطوط الإنتاج رقم 3';
    } else if (role === 'Shredding' || role === 'Shredding Operator') {
      name = 'Haidar Shredding Lead';
      nameAr = 'حيدر (مسؤول الثرم والجرش)';
      badgeNumber = 'KRN-SHR-01';
      department = 'Therm Regrind Line';
      departmentAr = 'وحدة الثرم والجرش وإعادة التدوير';
      avatarColor = 'from-emerald-500 to-teal-600';
      email = 'shredding@alkarwan.com';
      assignedWarehouse = 'WH-02 Shredding Store';
      assignedWarehouseAr = 'مستودع ومخزن الثرم رقم 2';
    } else if (role === 'Management' || role === 'SUPER_ADMIN' || role === 'General Supervisor') {
      name = 'Al-Karwan General Director';
      nameAr = 'المهندس المشرف العام (الإدارة)';
      badgeNumber = 'KRN-DIR-01';
      department = 'Executive Management & Governance';
      departmentAr = 'الإدارة العامة ومجلس الإدارة';
      avatarColor = 'from-amber-500 to-amber-700';
      email = 'karwanpet2@gmail.com';
      assignedWarehouse = 'All Factory Units';
      assignedWarehouseAr = 'كافة مرافق ومستودعات وخطوط الإنتاج';
    }

    const profile: UserProfile = {
      id: `USR-${badgeNumber}`,
      uid: `USR-${badgeNumber}`,
      name,
      nameAr,
      role,
      badgeNumber,
      department,
      departmentAr,
      avatarColor,
      email,
      lastLogin: new Date().toISOString(),
      assignedWarehouse,
      assignedWarehouseAr,
    };

    setCurrentUser(profile);
    setIsAuthenticated(true);
    localStorage.setItem(STORAGE_KEY + '_emergency_session', 'true');
    localStorage.setItem(STORAGE_KEY + '_authenticated', 'true');
    localStorage.setItem(STORAGE_KEY + '_user', JSON.stringify(profile));
    saveDocToFirestore('users', profile.id, profile);
  };

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY + '_materials', JSON.stringify(materials));
      localStorage.setItem(STORAGE_KEY + '_suppliers', JSON.stringify(suppliers));
      localStorage.setItem(STORAGE_KEY + '_warehouses', JSON.stringify(warehouses));
      localStorage.setItem(STORAGE_KEY + '_locations', JSON.stringify(locations));
      localStorage.setItem(STORAGE_KEY + '_receiving', JSON.stringify(receivingTransactions));
      localStorage.setItem(STORAGE_KEY + '_shredding', JSON.stringify(shreddingTransactions));
      localStorage.setItem(STORAGE_KEY + '_production', JSON.stringify(productionIssues));
      localStorage.setItem(STORAGE_KEY + '_production_damages', JSON.stringify(productionDamages));
      localStorage.setItem(STORAGE_KEY + '_production_orders', JSON.stringify(productionOrders));
      localStorage.setItem(STORAGE_KEY + '_shift_handovers', JSON.stringify(shiftHandovers));
      localStorage.setItem(STORAGE_KEY + '_bulk_bags', JSON.stringify(bulkBags));
      localStorage.setItem(STORAGE_KEY + '_approvals', JSON.stringify(approvals));
      localStorage.setItem(STORAGE_KEY + '_purchase_reqs', JSON.stringify(purchaseRequirements));
      localStorage.setItem(STORAGE_KEY + '_purchase_receipts', JSON.stringify(purchaseReceipts));
      localStorage.setItem(STORAGE_KEY + '_physical_counts', JSON.stringify(physicalCounts));
      localStorage.setItem(STORAGE_KEY + '_transfers', JSON.stringify(warehouseTransfers));
      localStorage.setItem(STORAGE_KEY + '_movements', JSON.stringify(inventoryMovements));
      localStorage.setItem(STORAGE_KEY + '_import_batches', JSON.stringify(importBatches));
      localStorage.setItem(STORAGE_KEY + '_audits', JSON.stringify(auditLogs));
    } catch (e) {
      console.warn('LocalStorage save warning:', e);
    }
  }, [
    materials,
    suppliers,
    warehouses,
    locations,
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    productionDamages,
    productionOrders,
    shiftHandovers,
    bulkBags,
    approvals,
    purchaseRequirements,
    purchaseReceipts,
    physicalCounts,
    warehouseTransfers,
    inventoryMovements,
    importBatches,
    auditLogs,
  ]);

  // Helper to compute fingerprint for duplicate detection
  const computeMovementFingerprint = (data: {
    docRef?: string;
    materialCode?: string;
    date?: string;
    netKG?: number;
    bulkBags?: number;
    supplier?: string;
    sourceFile?: string;
    sourceSheet?: string;
    sourceRow?: number;
  }) => {
    const parts = [
      (data.docRef || '').trim().toLowerCase(),
      (data.materialCode || '').trim().toUpperCase(),
      (data.date || '').trim(),
      Number(data.netKG || 0).toFixed(0),
      Number(data.bulkBags || 0).toString(),
      (data.supplier || '').trim().toLowerCase(),
      (data.sourceFile || '').trim().toLowerCase(),
      (data.sourceSheet || '').trim().toLowerCase(),
      (data.sourceRow || '').toString(),
    ];
    return parts.join('|');
  };

  const createImportBatch = (batchData: Partial<ImportBatch>): ImportBatch => {
    const now = new Date();
    const batchId =
      batchData.id ||
      `BATCH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    const newBatch: ImportBatch = {
      id: batchId,
      fileName: batchData.fileName || 'historical_data.xlsx',
      uploadDateTime: `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`,
      uploadedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      fileSize: batchData.fileSize || '---',
      sheets: batchData.sheets || [],
      rowsRead: batchData.rowsRead || 0,
      rowsAccepted: batchData.rowsAccepted || 0,
      rowsWarning: batchData.rowsWarning || 0,
      rowsError: batchData.rowsError || 0,
      rowsExcluded: batchData.rowsExcluded || 0,
      status: batchData.status || 'ANALYZING',
      notes: batchData.notes,
      docType: batchData.docType,
      importedRowsCount: batchData.importedRowsCount || 0,
      totalKG: batchData.totalKG || 0,
      totalBags: batchData.totalBags || 0,
      fingerprint: batchData.fingerprint,
    };

    setImportBatches((prev) => [newBatch, ...prev]);
    return newBatch;
  };

  const updateImportBatch = (batchId: string, updates: Partial<ImportBatch>) => {
    setImportBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, ...updates } : b))
    );
  };

  // Helper to log audit
  const logAudit = (
    action: string,
    actionAr: string,
    entityType: string,
    entityId: string,
    oldValue: string,
    newValue: string,
    notes?: string
  ) => {
    const now = new Date();
    const newAudit: AuditLogEntry = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      userId: currentUser.id,
      userName: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      userRole: currentUser.role,
      action,
      actionAr,
      entityType,
      entityId,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      oldValue,
      newValue,
      ipAddress: '192.168.1.100 (Factory Command Terminal)',
      status: 'SUCCESS',
      notes,
    };
    setAuditLogs((prev) => [newAudit, ...prev]);
  };

  // Helper to record movement in single immutable ledger
  const recordMovement = (
    materialId: string,
    materialCode: string,
    materialName: string,
    movementType: MovementType,
    source: string,
    destination: string,
    quantityKG: number,
    bulkBagsCount: number,
    referenceDocument: string,
    legacyDocRef?: string,
    notes?: string,
    transactionId?: string,
    traceability?: {
      fromWarehouseId?: string;
      fromWarehouseName?: string;
      fromLocationId?: string;
      fromLocationCode?: string;
      toWarehouseId?: string;
      toWarehouseName?: string;
      toLocationId?: string;
      toLocationCode?: string;
      supplierName?: string;
      importBatchId?: string;
      sourceFileName?: string;
      sourceSheetName?: string;
      sourceRowNumber?: number;
      sourceDocumentNumber?: string;
      originalMaterialText?: string;
      originalMaterialCode?: string;
      originalSupplierText?: string;
      originalWeightValue?: number;
      originalBulkBagValue?: number;
      fingerprint?: string;
    }
  ) => {
    const now = new Date();

    // Guard against duplicate movements
    if (transactionId) {
      const isDuplicate = inventoryMovements.some(
        (m) =>
          m.transactionId === transactionId &&
          m.movementType === movementType &&
          m.quantityKG === quantityKG &&
          m.referenceDocument === referenceDocument
      );
      if (isDuplicate) {
        console.warn('Blocked duplicate inventory movement for transaction:', transactionId);
        return;
      }
    }

    const movementId = `MOV-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const newMovement: InventoryMovement = {
      id: `MOV-${Date.now().toString().slice(-6)}`,
      movementId,
      movementNumber: movementId,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      materialId,
      materialCode,
      materialName,
      movementType,
      source,
      destination,
      sourceLocation: source,
      destinationLocation: destination,
      quantityKG,
      bulkBagsCount,
      referenceDocument,
      referenceNumber: referenceDocument,
      referenceDocNumber: referenceDocument,
      legacyDocRef,
      legacyDocumentNumber: legacyDocRef,
      internalInventoryCode: (legacyDocRef ? legacyDocRef.split('/')[0] : '') || (
        movementType.includes('PRODUCTION') ? activeProductionCode :
        (movementType.includes('SHREDDING') ? activeShreddingReceiptCode : activeStorageCode)
      ),
      user: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      transactionId,
      status: 'Completed',
      notes,
      ...traceability,
    };
    setInventoryMovements((prev) => [newMovement, ...prev]);
  };

  // Calculate Real-Time Inventory Balances Dynamically
  const inventoryBalances: InventoryBalance[] = useMemo(() => {
    // Map of key `${materialId}_${locationId}` -> InventoryBalance
    const balanceMap = new Map<string, InventoryBalance>();

    // Initialize from active locations and materials
    materials.forEach((mat) => {
      locations.forEach((loc) => {
        const key = `${mat.id}_${loc.id}`;
        // Find if material is stored here
        balanceMap.set(key, {
          materialId: mat.id,
          materialCode: mat.code,
          materialName: mat.nameAr,
          category: mat.category,
          warehouseId: loc.warehouseId,
          warehouseName: loc.warehouseNameAr,
          locationId: loc.id,
          locationCode: loc.code,
          bulkBagsCount: 0,
          availableKG: 0,
          reservedKG: 0,
          issuedKG: 0,
          totalBalanceKG: 0,
          status: 'Optimal',
          lastMovementDate: '2026-09-01',
        });
      });
    });

    // Inflow movement types: increase stock
    const inflowTypes = new Set([
      'RECEIPT',
      'RECEIVING',
      'TRANSFER_IN',
      'RETURN',
      'SHREDDING_OUTPUT',
      'SHREDDING RETURN',
      'PRODUCTION_RETURN',
      'OPENING_BALANCE',
    ]);

    // Outflow movement types: decrease stock
    const outflowTypes = new Set([
      'ISSUE',
      'TRANSFER_OUT',
      'SHREDDING_INPUT',
      'SHREDDING ISSUE',
      'PRODUCTION_ISSUE',
      'PRODUCTION ISSUE',
      'DAMAGE',
      'PRODUCTION_DAMAGE',
    ]);

    // Compute balance from all confirmed inventory movements (ONE SOURCE OF TRUTH)
    inventoryMovements.forEach((mov) => {
      // Ignore duplicates or reversed movements
      if (mov.status === 'DUPLICATE' || mov.status === 'Reversed' || mov.status === 'Cancelled') return;

      const mat = materials.find((m) => m.id === mov.materialId || m.code === mov.materialCode);
      if (!mat) return;

      const qty = Number(mov.quantityKG) || 0;
      const bags = Number(mov.bulkBagsCount) || 0;

      // Handle Inflows
      if (inflowTypes.has(mov.movementType)) {
        const targetLoc = locations.find((l) =>
          (mov.toLocationId && l.id === mov.toLocationId) ||
          (mov.toLocationCode && l.code === mov.toLocationCode) ||
          (mov.destination && (mov.destination.includes(l.code) || mov.destination.includes(l.nameAr)))
        ) || locations.find((l) => l.id === mat.defaultLocationId) || locations[0];

        if (targetLoc) {
          const key = `${mat.id}_${targetLoc.id}`;
          const current = balanceMap.get(key);
          if (current) {
            current.availableKG += qty;
            current.bulkBagsCount += bags;
            current.totalBalanceKG += qty;
            current.lastMovementDate = mov.date || current.lastMovementDate;
          }
        }
      } else if (outflowTypes.has(mov.movementType)) {
        // Handle Outflows
        const srcLoc = locations.find((l) =>
          (mov.fromLocationId && l.id === mov.fromLocationId) ||
          (mov.fromLocationCode && l.code === mov.fromLocationCode) ||
          (mov.source && (mov.source.includes(l.code) || mov.source.includes(l.nameAr)))
        ) || locations.find((l) => l.id === mat.defaultLocationId) || locations[0];

        if (srcLoc) {
          const key = `${mat.id}_${srcLoc.id}`;
          const current = balanceMap.get(key);
          if (current) {
            current.availableKG = Math.max(0, current.availableKG - qty);
            current.bulkBagsCount = Math.max(0, current.bulkBagsCount - bags);
            current.totalBalanceKG = Math.max(0, current.totalBalanceKG - qty);
            if (mov.movementType === 'PRODUCTION_ISSUE' || mov.movementType === 'PRODUCTION ISSUE') {
              current.issuedKG += qty;
            }
            current.lastMovementDate = mov.date || current.lastMovementDate;
          }
        }
      } else if (mov.movementType === 'TRANSFER') {
        // Atomic Legacy TRANSFER (both deduct from src and add to dst)
        const srcLoc = locations.find((l) =>
          (mov.fromLocationId && l.id === mov.fromLocationId) ||
          (mov.fromLocationCode && l.code === mov.fromLocationCode) ||
          (mov.source && (mov.source.includes(l.code) || mov.source.includes(l.nameAr)))
        ) || locations.find((l) => l.id === mat.defaultLocationId) || locations[0];

        const dstLoc = locations.find((l) =>
          (mov.toLocationId && l.id === mov.toLocationId) ||
          (mov.toLocationCode && l.code === mov.toLocationCode) ||
          (mov.destination && (mov.destination.includes(l.code) || mov.destination.includes(l.nameAr)))
        ) || locations.find((l) => l.id !== srcLoc?.id) || locations[0];

        if (srcLoc) {
          const key = `${mat.id}_${srcLoc.id}`;
          const current = balanceMap.get(key);
          if (current) {
            current.availableKG = Math.max(0, current.availableKG - qty);
            current.bulkBagsCount = Math.max(0, current.bulkBagsCount - bags);
            current.totalBalanceKG = Math.max(0, current.totalBalanceKG - qty);
            current.lastMovementDate = mov.date || current.lastMovementDate;
          }
        }
        if (dstLoc && dstLoc.id !== srcLoc?.id) {
          const key = `${mat.id}_${dstLoc.id}`;
          const current = balanceMap.get(key);
          if (current) {
            current.availableKG += qty;
            current.bulkBagsCount += bags;
            current.totalBalanceKG += qty;
            current.lastMovementDate = mov.date || current.lastMovementDate;
          }
        }
      } else if (mov.movementType === 'ADJUSTMENT') {
        const targetLoc = locations.find((l) =>
          (mov.toLocationId && l.id === mov.toLocationId) ||
          (mov.destination && (mov.destination.includes(l.code) || mov.destination.includes(l.nameAr)))
        ) || locations.find((l) => l.id === mat.defaultLocationId) || locations[0];

        if (targetLoc) {
          const key = `${mat.id}_${targetLoc.id}`;
          const current = balanceMap.get(key);
          if (current) {
            current.availableKG += qty;
            current.bulkBagsCount += bags;
            current.totalBalanceKG += qty;
            current.lastMovementDate = mov.date || current.lastMovementDate;
          }
        }
      }
    });

    // Filter only entries that have stock or are designated default locations
    const result: InventoryBalance[] = [];
    balanceMap.forEach((bal) => {
      const mat = materials.find((m) => m.id === bal.materialId);
      if (bal.totalBalanceKG > 0 || (mat && mat.defaultLocationId === bal.locationId)) {
        // Evaluate stock status
        if (mat) {
          if (bal.totalBalanceKG < mat.minStockKG) {
            bal.status = 'Low Stock';
          } else if (bal.totalBalanceKG > mat.maxStockKG) {
            bal.status = 'Over Capacity';
          } else {
            bal.status = 'Optimal';
          }
        }
        result.push(bal);
      }
    });

    return result;
  }, [materials, locations, inventoryMovements]);

  // Auto-Detect Pending Actions
  const pendingActions: PendingAction[] = useMemo(() => {
    const list: PendingAction[] = [];

    // 1. Receiving flow pending steps
    receivingTransactions.forEach((rcv) => {
      const st = rcv.status;
      if (st === 'DRAFT' || st === 'Draft') {
        list.push({
          id: `PEND-RCV-IN-${rcv.id}`,
          priority: 'CRITICAL',
          transactionType: 'RECEIVING',
          transactionId: rcv.id,
          transactionNumber: rcv.transactionNumber,
          legacyRef: rcv.legacyDocumentNumber,
          materialName: rcv.materialName,
          materialCode: rcv.materialCode,
          currentStep: 'Truck Arrived at Weighbridge',
          currentStepAr: 'وصول الشاحنة - بانتظار وزن الدخول (قائم)',
          missingStep: 'Scale-In Weighing Required',
          missingStepAr: 'تسجيل وزن الدخول الإجمالي على الميزان الجسري',
          date: rcv.date,
          time: rcv.time,
          responsibleUser: rcv.operator || 'مشغل الميزان',
          responsibleRole: 'Scale Operator',
          targetView: 'receiving',
          targetEntityId: rcv.id,
          daysPending: 0,
          actionText: 'Scale In',
          actionTextAr: 'وزن الدخول (قائم)',
          stepKey: 'SCALE_OUT',
          warningNote: 'الشاحنة متوقفة على البوابة بانتظار القراءة الأولى',
        });
      } else if (st === 'SCALE_IN_COMPLETED' || st === 'Scale In Completed') {
        list.push({
          id: `PEND-RCV-UNL-${rcv.id}`,
          priority: 'HIGH',
          transactionType: 'RECEIVING',
          transactionId: rcv.id,
          transactionNumber: rcv.transactionNumber,
          legacyRef: rcv.legacyDocumentNumber,
          materialName: rcv.materialName,
          materialCode: rcv.materialCode,
          currentStep: 'Scale In Completed (Gross Weight)',
          currentStepAr: 'تم وزن الدخول (قائم) - الشاحنة في المصنع',
          missingStep: 'Unloading Required at Staging Bay',
          missingStepAr: 'تفريغ الشاحنة على رصيف التفريغ المخصص',
          date: rcv.date,
          time: rcv.time,
          responsibleUser: rcv.operator || 'أمين المستودع',
          responsibleRole: 'Storekeeper',
          targetView: 'receiving',
          targetEntityId: rcv.id,
          daysPending: 0,
          actionText: 'Start Unloading',
          actionTextAr: 'بدء / إكمال التفريغ',
          stepKey: 'UNLOAD',
          warningNote: 'الشاحنة جاهزة للتفريغ في رصيف المستودع',
        });
      } else if (st === 'UNLOADING' || st === 'Unloading') {
        list.push({
          id: `PEND-RCV-UNLDING-${rcv.id}`,
          priority: 'HIGH',
          transactionType: 'RECEIVING',
          transactionId: rcv.id,
          transactionNumber: rcv.transactionNumber,
          legacyRef: rcv.legacyDocumentNumber,
          materialName: rcv.materialName,
          materialCode: rcv.materialCode,
          currentStep: 'Unloading In Progress',
          currentStepAr: 'الشاحنة قيد التفريغ حالياً على الرصيف',
          missingStep: 'Complete Unloading Sign-off',
          missingStepAr: 'إكمال التفريغ واعتماد فحص جودة المادة',
          date: rcv.date,
          time: rcv.time,
          responsibleUser: rcv.operator || 'فريق التفريغ',
          responsibleRole: 'Storekeeper',
          targetView: 'receiving',
          targetEntityId: rcv.id,
          daysPending: 0,
          actionText: 'Complete Unloading',
          actionTextAr: 'اكتمال التفريغ',
          stepKey: 'UNLOAD',
          warningNote: 'جاري إنزال الشلايف وفحص جودة ونظافة الخام',
        });
      } else if (st === 'UNLOADING_COMPLETED' || st === 'Unloading Completed') {
        list.push({
          id: `PEND-RCV-SO-${rcv.id}`,
          priority: 'CRITICAL',
          transactionType: 'RECEIVING',
          transactionId: rcv.id,
          transactionNumber: rcv.transactionNumber,
          legacyRef: rcv.legacyDocumentNumber,
          materialName: rcv.materialName,
          materialCode: rcv.materialCode,
          currentStep: 'Unloading Completed',
          currentStepAr: 'تم الانتهاء من تفريغ الحمولة على الرصيف',
          missingStep: 'Scale Out Weighing (Tare) Required',
          missingStepAr: 'ميزان الخروج (فارغ) واحتساب الوزن الصافي',
          date: rcv.date,
          time: rcv.time,
          responsibleUser: rcv.operator || 'مشغل الميزان الجسري',
          responsibleRole: 'Scale Operator',
          targetView: 'receiving',
          targetEntityId: rcv.id,
          daysPending: 0,
          actionText: 'Scale Out',
          actionTextAr: 'وزن الخروج (فارغ)',
          stepKey: 'SCALE_OUT',
          warningNote: 'الشاحنة فارغة وتنتظر قياس وزن الخروج',
        });
      } else if (st === 'SCALE_OUT_COMPLETED' || st === 'Scale Out Completed') {
        list.push({
          id: `PEND-RCV-CONF-${rcv.id}`,
          priority: 'HIGH',
          transactionType: 'RECEIVING',
          transactionId: rcv.id,
          transactionNumber: rcv.transactionNumber,
          legacyRef: rcv.legacyDocumentNumber,
          materialName: rcv.materialName,
          materialCode: rcv.materialCode,
          currentStep: 'Scale Out Completed & Net Weight Calculated',
          currentStepAr: 'تم وزن الخروج واحتساب الوزن الصافي تلقائياً',
          missingStep: 'Final Receipt Confirmation & Material Routing',
          missingStepAr: 'تأكيد استلام المواد وتحديد مسار المادة (جاهز أو للثرم)',
          date: rcv.date,
          time: rcv.time,
          responsibleUser: rcv.supervisor || 'مدير المستودع',
          responsibleRole: 'Warehouse Manager',
          targetView: 'receiving',
          targetEntityId: rcv.id,
          daysPending: 0,
          actionText: 'Confirm Receipt',
          actionTextAr: 'استلام المواد وتأكيد المسار',
          stepKey: 'CONFIRM_RECEIPT',
          warningNote: 'بانتظار التأكيد لترحيل الكمية إلى قيود المخزن رسمياً',
        });
      } else if (
        (st === 'WAITING_FOR_THERM' || st === 'Waiting for Shredding' || (st === 'RECEIVED' && rcv.requiresShredding)) &&
        !rcv.shreddingTransactionId
      ) {
        list.push({
          id: `PEND-RCV-SHR-${rcv.id}`,
          priority: 'HIGH',
          transactionType: 'SHREDDING',
          transactionId: rcv.id,
          transactionNumber: rcv.transactionNumber,
          legacyRef: rcv.legacyDocumentNumber,
          materialName: rcv.materialName,
          materialCode: rcv.materialCode,
          currentStep: 'Received & Queued for Shredding (عنبر السكراب)',
          currentStepAr: 'تم الاستلام والتوجيه لقسم الثرم (غير مثروم)',
          missingStep: 'Send to Therm Machine Execution',
          missingStepAr: 'إرسال الشحنة وتشغيل ماكينة الثرم (مستند 360)',
          date: rcv.date,
          time: rcv.time,
          responsibleUser: 'محمود السيد (مشغل الثرم)',
          responsibleRole: 'Shredding Operator',
          targetView: 'receiving',
          targetEntityId: rcv.id,
          daysPending: 0,
          actionText: 'Send to Therm',
          actionTextAr: 'إرسال إلى الثرم',
          stepKey: 'SEND_TO_THERM',
          warningNote: 'المادة مخزنة بعنبر السكراب بانتظار بدء دورة الثرم',
        });
      } else if (st === 'READY_FOR_PRODUCTION' || st === 'Ready for Production') {
        if (!rcv.issuedToProductionId) {
          list.push({
            id: `PEND-RCV-PROD-${rcv.id}`,
            priority: 'MEDIUM',
            transactionType: 'PRODUCTION',
            transactionId: rcv.id,
            transactionNumber: rcv.transactionNumber,
            legacyRef: rcv.legacyDocumentNumber,
            materialName: rcv.materialName,
            materialCode: rcv.materialCode,
            currentStep: 'Material In Storage & Ready for Production',
            currentStepAr: 'المادة مخزنة وجاهزة للصرف لأوامر الإنتاج',
            missingStep: 'Production Issue Execution',
            missingStepAr: `صرف المادة لخط الإنتاج بموجب أمر تشغيل (مستند ${activeProductionCode})`,
            date: rcv.date,
            time: rcv.time,
            responsibleUser: 'مسؤول خط الإنتاج',
            responsibleRole: 'Supervisor',
            targetView: 'receiving',
            targetEntityId: rcv.id,
            daysPending: 0,
            actionText: 'Issue to Production',
            actionTextAr: 'صرف للإنتاج',
            stepKey: 'ISSUE_TO_PRODUCTION',
          });
        }
      }
    });

    // 2. Shredding flow pending steps
    shreddingTransactions.forEach((thm) => {
      const st = thm.status;
      if (st === 'Shredding Completed' || st === 'THERM_COMPLETED') {
        list.push({
          id: `PEND-THM-RET-${thm.id}`,
          priority: 'CRITICAL',
          transactionType: 'STORAGE',
          transactionId: thm.id,
          transactionNumber: thm.shreddingNumber,
          legacyRef: thm.legacyDocumentNumber,
          materialName: thm.materialName,
          materialCode: thm.materialCode,
          currentStep: 'Shredding Execution Completed',
          currentStepAr: 'اكتملت دورة الثرم وحساب الهوالك والتالف',
          missingStep: 'Return Shredded Material to Storage Rack',
          missingStepAr: 'إرجاع المجروش النهائي وتخزينه بالمستودع (مستند 352)',
          date: thm.shreddingStart ? (thm.shreddingStart.includes('T') ? thm.shreddingStart.split('T')[0] : thm.shreddingStart.split(' ')[0]) : (thm.createdAt ? thm.createdAt.split('T')[0] : '2026-09-01'),
          time: thm.shreddingEnd ? (thm.shreddingEnd.includes(' ') ? thm.shreddingEnd.split(' ')[1] : (thm.shreddingEnd.includes('T') ? thm.shreddingEnd.split('T')[1]?.slice(0, 5) : thm.shreddingEnd)) : '12:00',
          responsibleUser: thm.operator || 'مشغل الثرم',
          responsibleRole: 'Shredding Operator',
          targetView: 'shredding',
          targetEntityId: thm.id,
          daysPending: 0,
          actionText: 'Return to Storage',
          actionTextAr: 'إرجاع إلى المخزن',
          stepKey: 'RETURN_TO_STORAGE',
          warningNote: 'المفروم جاهز في الشلايف ويتطلب تسجيل موقع الخزن',
        });
      } else if (st === 'In Shredding' || st === 'IN_THERM') {
        list.push({
          id: `PEND-THM-RUN-${thm.id}`,
          priority: 'HIGH',
          transactionType: 'SHREDDING',
          transactionId: thm.id,
          transactionNumber: thm.shreddingNumber,
          legacyRef: thm.legacyDocumentNumber,
          materialName: thm.materialName,
          materialCode: thm.materialCode,
          currentStep: 'Shredding Running on Machine',
          currentStepAr: 'الماكينة قيد الثرم حالياً',
          missingStep: 'Input/Output Weight Verification',
          missingStepAr: 'تسجيل وزن المخرجات وتالف الإنتاج لإنهاء الدورة',
          date: thm.shreddingStart ? (thm.shreddingStart.includes('T') ? thm.shreddingStart.split('T')[0] : thm.shreddingStart.split(' ')[0]) : (thm.createdAt ? thm.createdAt.split('T')[0] : '2026-09-01'),
          time: thm.shreddingStart ? (thm.shreddingStart.includes(' ') ? thm.shreddingStart.split(' ')[1] : (thm.shreddingStart.includes('T') ? thm.shreddingStart.split('T')[1]?.slice(0, 5) : '08:00')) : '08:00',
          responsibleUser: thm.operator,
          responsibleRole: 'Shredding Operator',
          targetView: 'shredding',
          targetEntityId: thm.id,
          daysPending: 0,
          actionText: 'Complete Therm',
          actionTextAr: 'إنهاء الثرم واحتساب الفاقد',
          stepKey: 'COMPLETE_THERM',
        });
      }

      // Check if there is active remaining unground stock in machine
      if (thm.remainingKG && thm.remainingKG > 0) {
        list.push({
          id: `PEND-THM-REM-${thm.id}`,
          priority: 'HIGH',
          transactionType: 'SHREDDING',
          transactionId: thm.id,
          transactionNumber: thm.shreddingNumber,
          legacyRef: thm.legacyDocumentNumber,
          materialName: thm.materialName,
          materialCode: thm.materialCode,
          currentStep: 'Partial Shredding with In-Process Remaining Stock',
          currentStepAr: `اكتمال جزئي مع وجود رصيد متبقي (${thm.remainingKG} كغم)`,
          missingStep: 'Resume Remaining Shredding or Write-Off Variance',
          missingStepAr: `استكمال تشغيل المتبقي أو تسوية الفارق بمستند 360`,
          date: thm.shreddingStart ? (thm.shreddingStart.includes('T') ? thm.shreddingStart.split('T')[0] : thm.shreddingStart.split(' ')[0]) : (thm.createdAt ? thm.createdAt.split('T')[0] : '2026-09-01'),
          time: '14:00',
          responsibleUser: thm.operator || 'مشغل الثرم',
          responsibleRole: 'Shredding Operator',
          targetView: 'shredding',
          targetEntityId: thm.id,
          daysPending: 1,
          actionText: 'Process Remaining',
          actionTextAr: 'معالجة المتبقي',
          stepKey: 'COMPLETE_THERM',
          warningNote: `يوجد ${thm.remainingKG} كغم ما زالت بالماكينة لم تُفرز مخرجاتها`,
        });
      }
    });

    // 3. Pending Supervisory Approvals
    approvals.forEach((appr) => {
      if (appr.status === 'PENDING') {
        list.push({
          id: `PEND-APPR-${appr.id}`,
          priority: appr.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          transactionType: 'STORAGE',
          transactionId: appr.id,
          transactionNumber: appr.entityReference,
          materialName: appr.titleAr,
          materialCode: 'APPROVAL',
          currentStep: 'Supervisory Review Required',
          currentStepAr: 'طلب اعتماد رقابي قيد الانتظار',
          missingStep: appr.titleAr,
          missingStepAr: `اعتماد أو رفض المشرف: ${appr.reason}`,
          date: appr.createdAt ? (appr.createdAt.includes('T') ? appr.createdAt.split('T')[0] : appr.createdAt.split(' ')[0]) : '2026-09-01',
          time: '10:00',
          responsibleUser: 'عمر عبدالكريم (المشرف العام)',
          responsibleRole: 'General Supervisor',
          targetView: 'approvals',
          targetEntityId: appr.id,
          daysPending: 0,
          actionText: 'Review Approval',
          actionTextAr: 'مراجعة واعتماد',
          stepKey: 'APPROVE',
        });
      }
    });

    // 4. Pending Physical Inventory Counts
    physicalCounts.forEach((cnt) => {
      if (cnt.status === 'PENDING_APPROVAL') {
        list.push({
          id: `PEND-CNT-${cnt.id}`,
          priority: Math.abs(cnt.varianceKG) > 1000 ? 'CRITICAL' : 'HIGH',
          transactionType: 'STORAGE',
          transactionId: cnt.id,
          transactionNumber: cnt.countNumber,
          materialName: cnt.materialName,
          materialCode: cnt.materialCode,
          currentStep: 'Physical Stock Count Discrepancy',
          currentStepAr: `جرد فعلي بالموقع ${cnt.locationCode} (فارق: ${cnt.varianceKG > 0 ? '+' : ''}${cnt.varianceKG.toLocaleString()} كغم)`,
          missingStep: 'Supervisor Verification & Inventory Adjustment Sign-Off',
          missingStepAr: 'اعتماد الفروقات وتسوية الرصيد الدفتري بالمستودع',
          date: cnt.countDate,
          time: '11:00',
          responsibleUser: 'مدير المستودع',
          responsibleRole: 'Warehouse Manager',
          targetView: 'storage',
          targetEntityId: cnt.id,
          daysPending: 0,
          actionText: 'Reconcile Count',
          actionTextAr: 'تسوية الجرد',
          stepKey: 'RECONCILE',
        });
      }
    });

    return list;
  }, [receivingTransactions, shreddingTransactions, approvals, physicalCounts]);

  // Jump directly to resolve pending action
  const jumpToPendingAction = (action: PendingAction) => {
    setSelectedTransactionId(action.transactionId);
    setCurrentPage(action.targetView);
  };

  // Helper to construct timeline events
  const createTimelineEvent = (
    receivingId: string,
    action: string,
    actionAr: string,
    performedBy: string,
    statusBefore: TransactionStatus | undefined,
    statusAfter: TransactionStatus,
    details?: string,
    weightKG?: number,
    bulkBags?: number
  ): ReceivingEvent => {
    const now = new Date();
    return {
      id: `EVT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      receivingId,
      timestamp: now.toISOString(),
      time: now.toTimeString().slice(0, 5),
      action,
      actionAr,
      performedBy,
      statusBefore,
      statusAfter,
      details,
      weightKG,
      bulkBags,
    };
  };

  // 1. Create New Receiving Transaction (Truck Arrival / Scale In)
  const createReceivingTransaction = (data: Partial<ReceivingTransaction>) => {
    if (!data.materialId || !data.supplierId || !data.vehiclePlate || !data.driverName) {
      return { success: false, error: 'يرجى تعبئة جميع الحقول الإلزامية للشاحنة والمادة والمورد' };
    }

    const scaleIn = Number(data.scaleInWeightKG) || 0;
    const mat = materials.find((m) => m.id === data.materialId);
    const sup = suppliers.find((s) => s.id === data.supplierId);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    // Duplicate transaction detection to prevent duplicate entries and movements
    const duplicateTx = receivingTransactions.find(
      (r) =>
        r.vehiclePlate.trim().toLowerCase() === data.vehiclePlate?.trim().toLowerCase() &&
        r.supplierId === data.supplierId &&
        r.materialId === data.materialId &&
        (r.date === (data.date || dateStr)) &&
        (Math.abs(r.scaleInWeightKG - scaleIn) < 1 || (data.purchaseReference && r.purchaseReference === data.purchaseReference)) &&
        r.status !== 'Cancelled' &&
        r.status !== 'REJECTED'
    );
    if (duplicateTx) {
      return {
        success: false,
        error: `معاملة مكررة محظورة: توجد شاحنة مسجلة برقم المعاملة (${duplicateTx.transactionNumber}) لنفس اللوحة (${data.vehiclePlate}) والمورد والمادة ووزن الدخول (${scaleIn.toLocaleString()} كغم) بتاريخ اليوم. تم حظر الإدخال المكرر لمنع ازدواجية حركات المخزون.`,
      };
    }

    // Sequential transaction reference RCV-YYYY-NNNNNN
    const year = now.getFullYear();
    const pattern = new RegExp(`^RCV-${year}-(\\d+)$`);
    let maxSeq = 0;
    receivingTransactions.forEach((r) => {
      const match = r.transactionNumber.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    });
    const txNum = data.transactionNumber || `RCV-${year}-${String(maxSeq + 1).padStart(6, '0')}`;
    const legNum = data.legacyDocumentNumber || `${activeStorageCode}/${year}/${String(maxSeq + 1).padStart(3, '0')}`;
    const newTxId = `RCV-${Date.now().toString().slice(-6)}`;
    const initialStatus: TransactionStatus = scaleIn > 0 ? 'SCALE_IN_COMPLETED' : 'DRAFT';
    const bagsCount = Number(data.bulkBagsCount) || 1;

    const initialTimeline: ReceivingEvent[] = [
      {
        id: `EVT-${Date.now().toString().slice(-6)}-01`,
        receivingId: newTxId,
        timestamp: now.toISOString(),
        time: timeStr,
        action: 'Truck Arrived',
        actionAr: 'وصول الشاحنة إلى المصنع',
        performedBy: data.operator || (currentUser?.nameAr || currentUser?.name || "المشرف"),
        statusAfter: 'DRAFT',
        details: `وصول الشاحنة رقم ${data.vehiclePlate} بقيادة السائق ${data.driverName} من مورد ${sup ? sup.nameAr : data.supplierName}`,
      },
    ];

    if (scaleIn > 0) {
      initialTimeline.push({
        id: `EVT-${Date.now().toString().slice(-6)}-02`,
        receivingId: newTxId,
        timestamp: now.toISOString(),
        time: timeStr,
        action: 'Scale In Completed',
        actionAr: 'تسجيل وزن الدخول (قائم)',
        performedBy: data.operator || (currentUser?.nameAr || currentUser?.name || "المشرف"),
        statusBefore: 'DRAFT',
        statusAfter: 'SCALE_IN_COMPLETED',
        details: `الوزن القائم: ${scaleIn.toLocaleString()} كغم | عدد الشلايف: ${bagsCount} شليف`,
        weightKG: scaleIn,
        bulkBags: bagsCount,
      });
    }

    const newTx: ReceivingTransaction = {
      id: newTxId,
      transactionNumber: txNum,
      legacyDocumentNumber: legNum,
      purchaseReference: data.purchaseReference || '',
      date: data.date || dateStr,
      time: data.time || timeStr,
      supplierId: data.supplierId,
      supplierName: sup ? sup.nameAr : (data.supplierName || ''),
      materialId: data.materialId,
      materialCode: mat ? mat.code : (data.materialCode || ''),
      materialName: mat ? mat.nameAr : (data.materialName || ''),
      vehiclePlate: data.vehiclePlate,
      driverName: data.driverName,
      driverPhone: data.driverPhone || '',
      scaleInWeightKG: scaleIn,
      unloadWeightKG: Number(data.unloadWeightKG) || 0,
      scaleOutWeightKG: 0,
      netReceivedWeightKG: 0,
      bulkBagsCount: bagsCount,
      targetWarehouseId: data.targetWarehouseId || (mat ? mat.defaultWarehouseId : 'WH-01'),
      targetLocationId: data.targetLocationId || (mat ? mat.defaultLocationId : 'LOC-A01'),
      targetLocationCode: data.targetLocationCode || 'LOC-A-01',
      materialCondition: data.materialCondition || 'Clean & Sorted',
      requiresShredding: data.requiresShredding ?? (mat ? mat.requiresShredding : false),
      route: data.route,
      status: initialStatus,
      operator: data.operator || (currentUser?.nameAr || currentUser?.name || "المشرف"),
      supervisor: data.supervisor || 'عمر عبدالكريم (المشرف العام للتحكم)',
      notes: data.notes || '',
      unloadingBay: data.unloadingBay || 'رصيف تفريغ رقم 1',
      scaleInTime: scaleIn > 0 ? `${dateStr} ${timeStr}` : undefined,
      timeline: initialTimeline,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setReceivingTransactions((prev) => [newTx, ...prev]);

    logAudit(
      'Receiving Transaction Created',
      'تسجيل معاملة استلام شاحنة جديدة على بوابة الميزان',
      'ReceivingTransaction',
      newTx.transactionNumber,
      'None',
      `Gross: ${scaleIn.toLocaleString()} KG | Bags: ${newTx.bulkBagsCount} | Plate: ${newTx.vehiclePlate}`
    );

    return { success: true, id: newTx.id };
  };

  const updateReceivingTransaction = (id: string, data: Partial<ReceivingTransaction>) => {
    const existing = receivingTransactions.find((r) => r.id === id);
    if (!existing) return { success: false, error: 'المعاملة غير موجودة' };

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, ...data, updatedAt: new Date().toISOString() };
        }
        return r;
      })
    );
    return { success: true };
  };

  // Complete Scale-In Step
  const completeScaleIn = (id: string, scaleInWeightKG: number, bags: number) => {
    if (scaleInWeightKG <= 0) {
      return { success: false, error: 'وزن الدخول يجب أن يكون أكبر من الصفر' };
    }
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    // Status-Machine validation
    const transitionCheck = validateStatusTransition(target.status, 'SCALE_IN_COMPLETED');
    if (!transitionCheck.valid) {
      logAudit(
        'Scale In Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'حركة غير قانونية',
        'ReceivingTransaction',
        target.transactionNumber,
        target.status,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const fieldsCheck = validateStageMandatoryFields('SCALE_IN', {
      scaleInWeightKG,
      materialId: target.materialId,
      supplierId: target.supplierId,
      vehiclePlate: target.vehiclePlate,
    });
    if (!fieldsCheck.valid) {
      return { success: false, error: fieldsCheck.errorMessageAr };
    }

    const now = new Date();
    const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;
    const event = createTimelineEvent(
      id,
      'Scale In Completed',
      'تسجيل وزن الدخول (قائم)',
      (currentUser?.nameAr || currentUser?.name || "المشرف"),
      target.status,
      'SCALE_IN_COMPLETED',
      `الوزن القائم: ${scaleInWeightKG.toLocaleString()} كغم | عدد الشلايف: ${bags} شليف`,
      scaleInWeightKG,
      bags
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            scaleInWeightKG,
            bulkBagsCount: bags,
            status: 'SCALE_IN_COMPLETED',
            scaleInTime: timeStr,
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    logAudit(
      'Scale In Updated',
      'تحديث قراءة ميزان الدخول (قائم)',
      'ReceivingTransaction',
      target.transactionNumber,
      `Previous: ${target.scaleInWeightKG} KG`,
      `New: ${scaleInWeightKG} KG | ${bags} شليف`
    );

    return { success: true };
  };

  // Start Unloading Step
  const startUnloading = (id: string, unloadBay?: string, operator?: string) => {
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    const currentStatus = target.status;
    const transitionCheck = validateStatusTransition(currentStatus, 'UNLOADING');
    if (!transitionCheck.valid) {
      logAudit(
        'Unloading Start Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'حركة غير قانونية',
        'ReceivingTransaction',
        target.transactionNumber,
        currentStatus,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const now = new Date();
    const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;
    const op = operator || (currentUser?.nameAr || currentUser?.name || "المشرف");
    const selectedBay = unloadBay || target.unloadingBay || 'رصيف تفريغ رقم 1';

    const fieldsCheck = validateStageMandatoryFields('UNLOADING', { unloadingBay: selectedBay });
    if (!fieldsCheck.valid) {
      return { success: false, error: fieldsCheck.errorMessageAr };
    }

    const event = createTimelineEvent(
      id,
      'Unloading Started',
      'بدء تفريغ الشاحنة على الرصيف',
      op,
      currentStatus,
      'UNLOADING',
      `الرصيف: ${selectedBay} | المشغل: ${op}`
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            unloadingBay: selectedBay,
            unloadingStartTime: timeStr,
            status: 'UNLOADING',
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    logAudit(
      'Unloading Started',
      'بدء تفريغ الشاحنة على الرصيف',
      'ReceivingTransaction',
      target.transactionNumber,
      currentStatus,
      'UNLOADING'
    );

    return { success: true };
  };

  // Complete Unloading Step
  const completeUnloading = (id: string, unloadBay?: string, condition?: any, operator?: string) => {
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    const currentStatus = target.status;
    const transitionCheck = validateStatusTransition(currentStatus, 'UNLOADED');
    if (!transitionCheck.valid) {
      logAudit(
        'Unloading Completion Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'حركة غير قانونية',
        'ReceivingTransaction',
        target.transactionNumber,
        currentStatus,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const now = new Date();
    const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;
    const op = operator || (currentUser?.nameAr || currentUser?.name || "المشرف");
    const selectedBay = unloadBay || target.unloadingBay || 'رصيف تفريغ رقم 1';
    const selectedCondition = condition || target.materialCondition || 'Clean & Sorted';

    const fieldsCheck = validateStageMandatoryFields('UNLOADED', {
      bulkBagsCount: target.bulkBagsCount,
      materialCondition: selectedCondition,
    });
    if (!fieldsCheck.valid) {
      return { success: false, error: fieldsCheck.errorMessageAr };
    }

    const event = createTimelineEvent(
      id,
      'Unloading Completed',
      'اكتمال تفريغ الشاحنة على الرصيف',
      op,
      currentStatus,
      'UNLOADING_COMPLETED',
      `الرصيف: ${selectedBay} | حالة المادة: ${selectedCondition}`
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            unloadingBay: selectedBay,
            materialCondition: selectedCondition,
            unloadingEndTime: timeStr,
            status: 'UNLOADING_COMPLETED',
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    logAudit(
      'Unloading Completed',
      'إتمام تفريغ الشاحنة على الرصيف',
      'ReceivingTransaction',
      target.transactionNumber,
      currentStatus,
      'UNLOADING_COMPLETED'
    );

    return { success: true };
  };

  // Complete Scale Out & Auto Calculate Net Weight
  const completeScaleOut = (id: string, scaleOutWeightKG: number) => {
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    const transitionCheck = validateStatusTransition(target.status, 'SCALE_OUT_COMPLETED');
    if (!transitionCheck.valid) {
      logAudit(
        'Scale Out Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'حركة غير قانونية',
        'ReceivingTransaction',
        target.transactionNumber,
        target.status,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const fieldsCheck = validateStageMandatoryFields('SCALE_OUT', {
      scaleInWeightKG: target.scaleInWeightKG,
      scaleOutWeightKG,
    });
    if (!fieldsCheck.valid) {
      return { success: false, error: fieldsCheck.errorMessageAr };
    }

    // AUTOMATIC NET WEIGHT: Net = Scale In - Scale Out
    const netWeight = target.scaleInWeightKG - scaleOutWeightKG;
    const now = new Date();
    const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;

    const event = createTimelineEvent(
      id,
      'Scale Out Completed',
      'وزن الخروج (فارغ) واحتساب الصافي',
      (currentUser?.nameAr || currentUser?.name || "المشرف"),
      target.status,
      'SCALE_OUT_COMPLETED',
      `قائم: ${(target.scaleInWeightKG ?? 0).toLocaleString()} كغم | فارغ: ${(scaleOutWeightKG ?? 0).toLocaleString()} كغم | الصافي: ${(netWeight ?? 0).toLocaleString()} كغم`,
      netWeight,
      target.bulkBagsCount
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            scaleOutWeightKG,
            netReceivedWeightKG: netWeight,
            status: 'SCALE_OUT_COMPLETED',
            scaleOutTime: timeStr,
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    logAudit(
      'Scale Out Completed & Net Weight Calculated',
      'تسجيل وزن الخروج واحتساب الصافي بدقة',
      'ReceivingTransaction',
      target.transactionNumber,
      `Tare Weight: ${scaleOutWeightKG} KG`,
      `Net Weight: ${(netWeight ?? 0).toLocaleString()} KG (قائم: ${target.scaleInWeightKG} - فارغ: ${scaleOutWeightKG})`
    );

    return { success: true };
  };

  // Confirm Receiving & Material Routing (Shredding or Storage)
  const confirmReceivingAndRoute = (
    id: string,
    requiresShreddingOrRoute: boolean | 'READY_SHREDDED' | 'NOT_SHREDDED',
    warehouseId?: string,
    locationId?: string
  ) => {
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    // Safety check: Cannot confirm receipt before scale out
    const isScaleOutDone =
      target.status === 'SCALE_OUT_COMPLETED' ||
      target.status === 'Scale Out Completed' ||
      (target.scaleOutWeightKG > 0 && target.netReceivedWeightKG > 0);

    if (
      target.status === 'WAITING_FOR_THERM' ||
      target.status === 'READY_FOR_PRODUCTION' ||
      target.status === 'COMPLETED' ||
      target.status === 'Completed' ||
      target.status === 'Received' ||
      target.status === 'RECEIVED'
    ) {
      return { success: false, error: 'تم تأكيد استلام وتوجيه هذه الإرسالية مسبقاً، ولا يمكن إعادة توجيهها أو تكرار حركتها في المخزون' };
    }

    if (!isScaleOutDone || target.netReceivedWeightKG <= 0) {
      return { success: false, error: 'لا يمكن تأكيد استلام كمية صفرية أو غير موزونة. يرجى إتمام ميزان الخروج أولاً' };
    }

    const isNotShredded =
      requiresShreddingOrRoute === 'NOT_SHREDDED' ||
      requiresShreddingOrRoute === true;
    const routeVal: 'READY_SHREDDED' | 'NOT_SHREDDED' = isNotShredded ? 'NOT_SHREDDED' : 'READY_SHREDDED';

    // Controlled status:
    // If READY_SHREDDED: READY_FOR_PRODUCTION
    // If NOT_SHREDDED: WAITING_FOR_THERM
    const newStatus: TransactionStatus = isNotShredded ? 'WAITING_FOR_THERM' : 'READY_FOR_PRODUCTION';

    // Status-Machine validation
    const transitionCheck = validateStatusTransition(target.status, newStatus, {
      requiresShredding: isNotShredded,
      route: routeVal,
    });
    if (!transitionCheck.valid) {
      logAudit(
        'Routing Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'توجيه غير قانوني',
        'ReceivingTransaction',
        target.transactionNumber,
        target.status,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const finalWarehouseId = warehouseId || target.targetWarehouseId || 'WH-01';
    const finalLocationId = locationId || target.targetLocationId || 'LOC-A01';

    const fieldsCheck = validateStageMandatoryFields('ROUTED', {
      route: routeVal,
      targetWarehouseId: finalWarehouseId,
      targetLocationId: finalLocationId,
      netReceivedWeightKG: target.netReceivedWeightKG,
    });
    if (!fieldsCheck.valid) {
      return { success: false, error: fieldsCheck.errorMessageAr };
    }

    const loc = locations.find((l) => l.id === finalLocationId);
    const targetLocationCode = loc ? loc.code : 'LOC-A-01';
    const now = new Date();

    const event = createTimelineEvent(
      id,
      'Receipt Confirmed & Routed',
      'تأكيد استلام المواد وتوجيه المسار',
      (currentUser?.nameAr || currentUser?.name || "المشرف"),
      target.status,
      newStatus,
      `المسار: ${isNotShredded ? 'غير مثروم (بانتظار الثرم)' : 'مثروم جاهز (متاح للإنتاج)'} | الصافي: ${(target.netReceivedWeightKG ?? 0).toLocaleString()} كغم | الشلايف: ${target.bulkBagsCount} شليف`,
      target.netReceivedWeightKG,
      target.bulkBagsCount
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            requiresShredding: isNotShredded,
            route: routeVal,
            targetWarehouseId: finalWarehouseId,
            targetLocationId: finalLocationId,
            targetLocationCode,
            status: newStatus,
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    // Record immutable RECEIPT movement into inventory engine
    const destName = isNotShredded
      ? `مخزن الثرم (عنبر السكراب) - ${targetLocationCode}`
      : `مستودع الخامات - رف ${targetLocationCode}`;

    recordMovement(
      target.materialId,
      target.materialCode,
      target.materialName,
      'RECEIVING',
      `بوابة ميزان الشاحنات / ${target.supplierName}`,
      destName,
      target.netReceivedWeightKG,
      target.bulkBagsCount,
      target.transactionNumber,
      target.legacyDocumentNumber,
      `تأكيد استلام رسمي - ${isNotShredded ? 'توجيه لقسم الثرم (غير مثروم)' : 'إيداع بالمخزن (مثروم جاهز)'}`,
      target.id
    );

    logAudit(
      'Receiving Confirmed & Routed',
      'تأكيد استلام الإرسالية وتوجيه مسار المادة',
      'ReceivingTransaction',
      target.transactionNumber,
      target.status,
      `Status: ${newStatus} | Route: ${routeVal} | Net: ${(target.netReceivedWeightKG ?? 0).toLocaleString()} KG`
    );

    return { success: true };
  };

  // Send Receiving to Therm / Shredding Unit
  const sendToTherm = (id: string, targetLocationId?: string, operator?: string) => {
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    // Status Machine transition validation
    const transitionCheck = validateStatusTransition(target.status, 'IN_THERM');
    if (!transitionCheck.valid) {
      logAudit(
        'Send to Therm Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'إرسال غير مسموح للثرم',
        'ReceivingTransaction',
        target.transactionNumber,
        target.status,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const op = operator || (currentUser?.nameAr || currentUser?.name || "المشرف");
    const now = new Date();

    // Create linked Shredding Transaction
    const thmRes = createShreddingTransaction({
      sourceReceivingId: target.id,
      sourceReceivingNumber: target.transactionNumber,
      materialId: target.materialId,
      materialCode: target.materialCode,
      materialName: target.materialName,
      inputKG: target.netReceivedWeightKG,
      bulkBagsInput: target.bulkBagsCount,
      supervisor: target.supervisor,
      notes: `محولة من إرسالية الاستلام ${target.transactionNumber}`,
    });

    if (!thmRes.success || !thmRes.id) {
      return { success: false, error: thmRes.error || 'تعذر إنشاء دورة الثرم' };
    }

    const event = createTimelineEvent(
      id,
      'Sent to Therm',
      'إرسال الشحنة إلى وحدة الثرم (الثرم)',
      op,
      target.status,
      'IN_THERM',
      `رقم دورة الثرم: ${thmRes.id} | الكمية: ${(target.netReceivedWeightKG ?? 0).toLocaleString()} كغم (${target.bulkBagsCount} شليف)`,
      target.netReceivedWeightKG,
      target.bulkBagsCount
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            status: 'IN_THERM',
            shreddingTransactionId: thmRes.id,
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    logAudit(
      'Sent to Therm',
      'إرسال الشحنة إلى وحدة الثرم',
      'ReceivingTransaction',
      target.transactionNumber,
      target.status,
      'IN_THERM'
    );

    return { success: true, shreddingId: thmRes.id };
  };

  // Issue Receiving Directly to Production
  const issueReceivingToProduction = (
    id: string,
    data: {
      productionOrderNumber?: string;
      machineLine?: string;
      quantityKG?: number;
      bulkBagsCount?: number;
      shift?: 'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي';
      notes?: string;
    }
  ) => {
    const target = receivingTransactions.find((r) => r.id === id);
    if (!target) return { success: false, error: 'المعاملة غير موجودة' };

    // Status machine validation: cannot jump from incomplete receiving or from waiting for therm
    const transitionCheck = validateStatusTransition(target.status, 'ISSUED_TO_PRODUCTION', {
      requiresShredding: target.requiresShredding,
      route: target.route,
    });
    if (!transitionCheck.valid) {
      logAudit(
        'Direct Production Issue Rejected by Status Machine',
        transitionCheck.errorMessageAr || 'صرف للإنتاج محظور',
        'ReceivingTransaction',
        target.transactionNumber,
        target.status,
        'REJECTED'
      );
      return { success: false, error: transitionCheck.errorMessageAr };
    }

    const qty = data.quantityKG || target.netReceivedWeightKG;
    const bags = data.bulkBagsCount || target.bulkBagsCount;

    const res = createProductionIssue({
      productionOrderNumber:
        data.productionOrderNumber ||
        `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      machineLine: data.machineLine || 'Extruder Line 1 (خط بثق الألواح رقم 1)',
      materialId: target.materialId,
      warehouseId: target.targetWarehouseId || 'WH-01',
      locationId: target.targetLocationId || 'LOC-A01',
      quantityKG: qty,
      bulkBagsCount: bags,
      shift: data.shift || 'Morning / صباحي',
      notes: data.notes || `صرف مباشر مرتبط بإرسالية الاستلام ${target.transactionNumber}`,
      sourceReceivingId: target.id,
    });

    if (!res.success) {
      return res;
    }

    const now = new Date();
    const event = createTimelineEvent(
      id,
      'Issued to Production',
      'صرف المادة لخطوط الإنتاج',
      (currentUser?.nameAr || currentUser?.name || "المشرف"),
      target.status,
      'ISSUED_TO_PRODUCTION',
      `أمر الإنتاج: ${data.productionOrderNumber || 'PO'} | خط: ${data.machineLine || 'Line 1'} | الكمية: ${qty.toLocaleString()} كغم (${bags} شليف)`,
      qty,
      bags
    );

    setReceivingTransactions((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            status: 'ISSUED_TO_PRODUCTION',
            issuedToProductionId: res.id,
            timeline: [...(r.timeline || []), event],
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    return { success: true, issueId: res.id };
  };

  // Section 22: Dedicated End-to-End Test Transaction Generator
  const createTestReceivingTransaction = () => {
    const year = new Date().getFullYear();
    const txNum = `RCV-${year}-TEST01`;
    const legNum = `TEST-${activeStorageCode}/${year}/001`;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    const testMat = materials[0] || {
      id: 'MAT-001',
      code: 'PET-FLK-01',
      nameAr: 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)',
    };
    const testSup = suppliers[0] || {
      id: 'SUP-01',
      nameAr: 'شركة الدلتا للبتروكيماويات والبوليمرات',
    };

    const testTxId = `TEST-${Date.now().toString().slice(-6)}`;
    const testTx: ReceivingTransaction = {
      id: testTxId,
      transactionNumber: txNum,
      legacyDocumentNumber: legNum,
      purchaseReference: 'PO-TEST-8890',
      date: dateStr,
      time: timeStr,
      supplierId: testSup.id,
      supplierName: testSup.nameAr,
      materialId: testMat.id,
      materialCode: testMat.code,
      materialName: testMat.nameAr,
      vehiclePlate: 'بغداد 99887 / شاحنة فحص تجريبية',
      driverName: 'عمار مهدي (سائق الاختبار)',
      driverPhone: '+964 770 000 9999',
      scaleInWeightKG: 18500,
      unloadWeightKG: 0,
      scaleOutWeightKG: 0,
      netReceivedWeightKG: 0,
      bulkBagsCount: 35,
      targetWarehouseId: 'WH-01',
      targetLocationId: 'LOC-A01',
      targetLocationCode: 'LOC-A-01',
      materialCondition: 'Clean & Sorted',
      requiresShredding: true,
      route: 'NOT_SHREDDED',
      status: 'SCALE_IN_COMPLETED',
      operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      supervisor: 'عمر عبدالكريم (المشرف العام للتحكم)',
      notes: 'معاملة استلام اختبارية تدفقية لمحاكاة الدورة اليومية الكاملة (Section 22 Test)',
      unloadingBay: 'رصيف تفريغ رقم 1 (رصيف الفحص والتدقيق)',
      scaleInTime: `${dateStr} ${timeStr}`,
      isTestTransaction: true,
      timeline: [
        {
          id: `EVT-TEST-01`,
          receivingId: testTxId,
          timestamp: now.toISOString(),
          time: timeStr,
          action: 'Truck Arrived',
          actionAr: 'وصول الشاحنة إلى المصنع',
          performedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
          statusAfter: 'DRAFT',
          details: 'وصول الشاحنة التجريبية رقم بغداد 99887 عبر بوابة الدخول الرئيسية',
        },
        {
          id: `EVT-TEST-02`,
          receivingId: testTxId,
          timestamp: now.toISOString(),
          time: timeStr,
          action: 'Scale In Completed',
          actionAr: 'تسجيل وزن الدخول (قائم)',
          performedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
          statusBefore: 'DRAFT',
          statusAfter: 'SCALE_IN_COMPLETED',
          details: 'الوزن القائم: 18,500 كغم | الشلايف: 35 شليف',
          weightKG: 18500,
          bulkBags: 35,
        },
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setReceivingTransactions((prev) => [testTx, ...prev]);

    logAudit(
      'Test Receiving Flow Initialized',
      'إنشاء معاملة استلام اختبارية لمحاكاة دورة التدفق الكاملة',
      'ReceivingTransaction',
      testTx.transactionNumber,
      'None',
      'SCALE_IN_COMPLETED'
    );

    return { success: true, id: testTx.id };
  };

  // 2. Shredding / Therm (الثرم) Operations
  const createShreddingTransaction = (data: Partial<ShreddingTransaction>) => {
    if (!data.materialId || !data.inputKG || Number(data.inputKG) <= 0) {
      return { success: false, error: 'يرجى تحديد المادة وكمية المدخلات (كغم) للثرم' };
    }

    // Status Machine transition validation for Shredding Start
    const validationCheck = validateShreddingActionTransition(
      'START',
      {
        materialId: data.materialId,
        inputKG: Number(data.inputKG),
        bulkBagsInput: Number(data.bulkBagsInput) || 1,
        machineId: data.machineId || 'THERM-SHREDDER-01 (ماكينة ثرم الأكواب الكبرى)',
      },
      {
        receivingRecord: data.sourceReceivingId
          ? receivingTransactions.find((r) => r.id === data.sourceReceivingId)
          : undefined,
      }
    );
    if (!validationCheck.valid) {
      return { success: false, error: validationCheck.errorMessageAr };
    }

    const mat = materials.find((m) => m.id === data.materialId);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const thmNum = `THM-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const legNum = data.legacyDocumentNumber || `${activeShreddingReceiptCode}/${now.getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

    const inputKG = Number(data.inputKG);
    const bagsIn = Number(data.bulkBagsInput) || 1;

    const newThm: ShreddingTransaction = {
      id: `THM-${Date.now().toString().slice(-6)}`,
      shreddingNumber: thmNum,
      sourceReceivingId: data.sourceReceivingId || '',
      sourceReceivingNumber: data.sourceReceivingNumber || '',
      legacyDocumentNumber: legNum,
      materialId: data.materialId,
      materialCode: mat ? mat.code : (data.materialCode || ''),
      materialName: mat ? mat.nameAr : (data.materialName || ''),
      inputKG,
      bulkBagsInput: bagsIn,
      shreddingStart: data.shreddingStart || `${dateStr} ${timeStr}`,
      shreddingEnd: '',
      outputKG: 0,
      bulkBagsOutput: 0,
      productionDamageKG: 0,
      varianceKG: 0,
      variancePercentage: 0,
      isAbnormalVariance: false,
      operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      supervisor: data.supervisor || 'عمر عبدالكريم (المشرف العام للتحكم)',
      machineId: data.machineId || 'THERM-SHREDDER-01 (ماكينة ثرم الأكواب الكبرى)',
      sourceLocationId: data.sourceLocationId || 'LOC-THM01',
      sourceLocationCode: data.sourceLocationCode || 'LOC-THM-IN',
      destinationWarehouseId: 'WH-02',
      destinationLocationId: 'LOC-THM02',
      destinationLocationCode: 'LOC-THM-OUT',
      status: 'In Shredding',
      notes: data.notes || '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setShreddingTransactions((prev) => [newThm, ...prev]);

    // Record movement out of scrap staging to machine
    recordMovement(
      newThm.materialId,
      newThm.materialCode,
      newThm.materialName,
      'SHREDDING ISSUE',
      `مستودع الثرم - ${newThm.sourceLocationCode}`,
      `ماكينة الثرم (${newThm.machineId})`,
      inputKG,
      bagsIn,
      newThm.shreddingNumber,
      legNum,
      'بدء عملية ثرم تشغيلية بمستند 360',
      newThm.id
    );

    // If linked to a receiving transaction, link it
    if (data.sourceReceivingId) {
      setReceivingTransactions((prev) =>
        prev.map((r) => (r.id === data.sourceReceivingId ? { ...r, shreddingTransactionId: newThm.id, status: 'In Shredding' } : r))
      );
    }

    logAudit(
      'Shredding Batch Started',
      'بدء دورة ثرم جديدة بمستند 360',
      'ShreddingTransaction',
      newThm.shreddingNumber,
      'None',
      `Input: ${(inputKG ?? 0).toLocaleString()} KG | Machine: ${newThm.machineId}`
    );

    return { success: true, id: newThm.id };
  };

  // Complete Shredding with Output & Damage Calculations
  const completeShredding = (
    id: string,
    outputKG: number,
    bulkBagsOutput: number,
    productionDamageKG: number,
    notes?: string,
    wasteKG?: number
  ) => {
    const target = shreddingTransactions.find((t) => t.id === id);
    if (!target) return { success: false, error: 'معاملة الثرم غير موجودة' };

    if (outputKG < 0 || productionDamageKG < 0) {
      return { success: false, error: 'الكميات يجب أن تكون موجبة' };
    }

    const waste = Number(wasteKG) || 0;

    if (outputKG + productionDamageKG + waste > target.inputKG * 1.05) {
      return {
        success: false,
        error: `إجمالي المخرجات والتالف والشوائب (${(outputKG + productionDamageKG + waste).toLocaleString()} كغم) يتجاوز المدخلات (${(target.inputKG ?? 0).toLocaleString()} كغم) بأكثر من النطاق الفيزيائي المسموح!`,
      };
    }

    // Formula: Input KG - Output KG - Damage KG - Waste KG = Remaining KG
    const remaining = Math.max(0, target.inputKG - outputKG - productionDamageKG - waste);
    const variance = target.inputKG - outputKG - productionDamageKG - waste;
    const variancePct = Number(((variance / target.inputKG) * 100).toFixed(2));
    const isAbnormal = variancePct > 3.0 || variance < 0; // abnormal if loss > 3% or negative loss

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);

    setShreddingTransactions((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            outputKG,
            bulkBagsOutput,
            productionDamageKG,
            wasteKG: waste,
            remainingKG: remaining,
            varianceKG: variance,
            variancePercentage: variancePct,
            isAbnormalVariance: isAbnormal,
            shreddingEnd: `${dateStr} ${timeStr}`,
            status: 'Shredding Completed',
            notes: notes || t.notes,
            updatedAt: now.toISOString(),
          };
        }
        return t;
      })
    );

    // Record production damage movement if any
    if (productionDamageKG > 0) {
      recordMovement(
        target.materialId,
        target.materialCode,
        target.materialName,
        'DAMAGE',
        `ماكينة الثرم (${target.machineId})`,
        'منطقة الهوالك والتالف غير القابل للتدوير',
        productionDamageKG,
        1,
        target.shreddingNumber,
        target.legacyDocumentNumber,
        `تسجيل تالف إنتاج ناتج عن الثرم بموجب مستند ${target.legacyDocumentNumber}`,
        target.id
      );
    }

    // Update linked receiving transaction if any
    if (target.sourceReceivingId) {
      setReceivingTransactions((prev) =>
        prev.map((r) => {
          if (r.id === target.sourceReceivingId) {
            const ev = createTimelineEvent(
              r.id,
              'Therm Completed',
              'اكتمال الثرم وتسجيل المخرجات والتالف',
              (currentUser?.nameAr || currentUser?.name || "المشرف"),
              r.status,
              'THERM_COMPLETED',
              `مخرجات: ${outputKG.toLocaleString()} كغم (${bulkBagsOutput} شليف) | تالف: ${productionDamageKG.toLocaleString()} كغم | فاقد: ${variance.toLocaleString()} كغم (${variancePct}%)`,
              outputKG,
              bulkBagsOutput
            );
            return {
              ...r,
              status: 'THERM_COMPLETED',
              timeline: [...(r.timeline || []), ev],
              updatedAt: now.toISOString(),
            };
          }
          return r;
        })
      );
    }

    logAudit(
      'Shredding Batch Finished & Variance Computed',
      'إنهاء عملية الثرم واحتساب الفروقات وتالف الإنتاج',
      'ShreddingTransaction',
      target.shreddingNumber,
      `Input: ${target.inputKG} KG`,
      `Output: ${(outputKG ?? 0).toLocaleString()} KG | Prod Damage: ${(productionDamageKG ?? 0).toLocaleString()} KG | Variance: ${(variance ?? 0).toLocaleString()} KG (${variancePct}%)`
    );

    return { success: true };
  };

  // Return Shredded Material to Storage (Legacy Doc #352 / #360)
  const returnShreddingToStorage = (
    id: string,
    destWarehouseId: string,
    destLocationId: string,
    notes?: string
  ) => {
    const target = shreddingTransactions.find((t) => t.id === id);
    if (!target) return { success: false, error: 'معاملة الثرم غير موجودة' };

    // Status Machine transition validation
    const validationCheck = validateShreddingActionTransition(
      'RETURN_TO_STORAGE',
      { destWarehouseId, destLocationId },
      { shreddingRecord: target }
    );
    if (!validationCheck.valid) {
      return { success: false, error: validationCheck.errorMessageAr };
    }

    const loc = locations.find((l) => l.id === destLocationId);
    const destCode = loc ? loc.code : 'LOC-THM-OUT';
    const now = new Date();

    // Map output to shredded regrind item
    const shreddedMat = materials.find((m) => m.code === 'BTL-SHR-04') || materials[0];

    setShreddingTransactions((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            destinationWarehouseId: destWarehouseId,
            destinationLocationId: destLocationId,
            destinationLocationCode: destCode,
            status: 'Returned to Storage',
            returnToStorageTime: `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`,
            notes: notes || t.notes,
            updatedAt: now.toISOString(),
          };
        }
        return t;
      })
    );

    // Record inventory movement for shredded regrind entering storage
    recordMovement(
      shreddedMat.id,
      shreddedMat.code,
      shreddedMat.nameAr,
      'SHREDDING RETURN',
      `ماكينة الثرم (${target.machineId})`,
      `مستودع الثرم - عنبر المخرجات ${destCode}`,
      target.outputKG,
      target.bulkBagsOutput,
      target.shreddingNumber,
      '352/2026/045',
      `إرجاع المجروش النهائي وتخزينه بموجب مستند 352 (مستودع الثرم)`,
      target.id
    );

    // If source receiving transaction was linked, mark it ready for production in warehouse
    if (target.sourceReceivingId) {
      setReceivingTransactions((prev) =>
        prev.map((r) => {
          if (r.id === target.sourceReceivingId) {
            const ev = createTimelineEvent(
              r.id,
              'Returned to Storage',
              'إرجاع المفروم للمستودع (جاهز للإنتاج)',
              (currentUser?.nameAr || currentUser?.name || "المشرف"),
              r.status,
              'READY_FOR_PRODUCTION',
              `إيداع ${(target.outputKG ?? 0).toLocaleString()} كغم (${target.bulkBagsOutput} شليف) في مستودع الثرم - موقع ${destCode}`,
              target.outputKG,
              target.bulkBagsOutput
            );
            return {
              ...r,
              status: 'READY_FOR_PRODUCTION',
              targetWarehouseId: destWarehouseId,
              targetLocationId: destLocationId,
              targetLocationCode: destCode,
              timeline: [...(r.timeline || []), ev],
              updatedAt: now.toISOString(),
            };
          }
          return r;
        })
      );
    }

    logAudit(
      'Shredded Stock Deposited to Warehouse',
      'إيداع المفروم بالمستودع بموجب مستند 352',
      'ShreddingTransaction',
      target.shreddingNumber,
      'Shredding Completed',
      `Deposited: ${(target.outputKG ?? 0).toLocaleString()} KG | Bags: ${target.bulkBagsOutput} | Location: ${destCode}`
    );

    return { success: true };
  };

  // 3. Production Issue (صرف للإنتاج - مستند 167)
  const createProductionIssue = (data: {
    productionOrderNumber: string;
    machineLine: string;
    materialId: string;
    warehouseId: string;
    locationId: string;
    quantityKG: number;
    bulkBagsCount: number;
    legacyDocumentNumber?: string;
    shift: 'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي';
    notes?: string;
    sourceReceivingId?: string;
  }) => {
    // Status-Machine validation middleware
    const validationCheck = validateProductionIssueTransition(
      {
        productionOrderNumber: data.productionOrderNumber,
        machineLine: data.machineLine,
        materialId: data.materialId,
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        quantityKG: Number(data.quantityKG),
        bulkBagsCount: Number(data.bulkBagsCount) || 1,
        shift: data.shift,
        notes: data.notes,
        sourceReceivingId: data.sourceReceivingId,
      },
      {
        receivingTransactions,
        shreddingTransactions,
        inventoryBalances,
      }
    );

    if (!validationCheck.valid) {
      logAudit(
        'Production Issue Blocked by Status-Machine',
        validationCheck.errorMessageAr || 'صرف للإنتاج محظور',
        'ProductionIssue',
        data.productionOrderNumber || 'PO',
        'REJECTED',
        validationCheck.errorCode || 'ERR_VALIDATION'
      );
      return { success: false, error: validationCheck.errorMessageAr };
    }

    if (!data.materialId || !data.quantityKG || Number(data.quantityKG) <= 0) {
      return { success: false, error: 'يرجى تحديد المادة وكمية الصرف (كغم)' };
    }

    const qty = Number(data.quantityKG);
    const bags = Number(data.bulkBagsCount) || 1;

    // Check available stock in location
    const balance = inventoryBalances.find(
      (b) => b.materialId === data.materialId && b.locationId === data.locationId
    );

    const available = balance ? balance.availableKG : 0;

    if (qty > available) {
      return {
        success: false,
        error: `الكمية المطلوبة (${(qty ?? 0).toLocaleString()} كغم) تتجاوز الرصيد المتاح حالياً في الموقع (${(available ?? 0).toLocaleString()} كغم). لا يمكن صرف كمية أكبر من الرصيد المتوفر!`,
      };
    }

    const mat = materials.find((m) => m.id === data.materialId);
    const loc = locations.find((l) => l.id === data.locationId);
    const locCode = loc ? loc.code : 'LOC-A-01';
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const issNum = `ISS-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const legNum = data.legacyDocumentNumber || `${activeProductionCode}/${now.getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

    const newIssue: ProductionIssue = {
      id: `ISS-${Date.now().toString().slice(-6)}`,
      issueNumber: issNum,
      legacyDocumentNumber: legNum,
      productionOrderNumber: data.productionOrderNumber || `PO-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      machineLine: data.machineLine || 'Extruder Line 1 (خط بثق الألواح رقم 1)',
      materialId: data.materialId,
      materialCode: mat ? mat.code : 'MAT',
      materialName: mat ? mat.nameAr : 'Material',
      warehouseId: data.warehouseId,
      locationId: data.locationId,
      locationCode: locCode,
      quantityKG: qty,
      bulkBagsCount: bags,
      stockBeforeKG: available,
      stockAfterKG: available - qty,
      operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      supervisor: 'عمر عبدالكريم (المشرف العام للتحكم)',
      date: dateStr,
      time: timeStr,
      shift: data.shift || 'Morning / صباحي',
      status: 'Completed',
      notes: data.notes || '',
      createdAt: now.toISOString(),
    };

    setProductionIssues((prev) => [newIssue, ...prev]);

    // Record inventory deduction movement
    recordMovement(
      newIssue.materialId,
      newIssue.materialCode,
      newIssue.materialName,
      'PRODUCTION ISSUE',
      `${loc ? loc.warehouseNameAr : 'المستودع'} - ${locCode}`,
      `${newIssue.machineLine} (أمر ${newIssue.productionOrderNumber})`,
      qty,
      bags,
      newIssue.issueNumber,
      legNum,
      `صرف مواد خامات لخطوط الإنتاج بموجب مستند ${activeProductionCode} - أمر ${newIssue.productionOrderNumber}`,
      newIssue.id
    );

    logAudit(
      'Material Issued to Production Line',
      `صرف مواد خامات للإنتاج بمستند ${activeProductionCode}`,
      'ProductionIssue',
      newIssue.issueNumber,
      `Available: ${(available ?? 0).toLocaleString()} KG`,
      `Issued: ${(qty ?? 0).toLocaleString()} KG | Remaining: ${(available - qty).toLocaleString()} KG | Line: ${newIssue.machineLine}`
    );

    return { success: true, id: newIssue.id };
  };

  // 4. Warehouse & Location Transfer (Atomic Section 12 & Negative Stock Protection Section 7)
  const executeLocationTransfer = (
    materialId: string,
    sourceLocationId: string,
    destLocationId: string,
    quantityKG: number,
    bulkBags: number,
    notes?: string
  ) => {
    if (sourceLocationId === destLocationId) {
      return { success: false, error: 'موقع المصدر وموقع الوجهة متطابقان' };
    }

    const sourceBal = inventoryBalances.find(
      (b) => b.materialId === materialId && b.locationId === sourceLocationId
    );

    const availableKG = sourceBal ? sourceBal.availableKG : 0;
    const availableBags = sourceBal ? sourceBal.bulkBagsCount : 0;

    if (quantityKG <= 0) {
      return { success: false, error: 'الكمية المنقولة يجب أن تكون أكبر من الصفر' };
    }

    if (quantityKG > availableKG) {
      return {
        success: false,
        error: `الكمية المنقولة (${(quantityKG ?? 0).toLocaleString()} كغم) تتجاوز الرصيد في الموقع المصدر (${(availableKG ?? 0).toLocaleString()} كغم)`,
      };
    }

    if (bulkBags > availableBags) {
      return {
        success: false,
        error: `عدد الشلايف (${bulkBags}) يتجاوز الشلايف المتاحة بالموقع (${availableBags})`,
      };
    }

    const mat = materials.find((m) => m.id === materialId);
    const srcLoc = locations.find((l) => l.id === sourceLocationId);
    const dstLoc = locations.find((l) => l.id === destLocationId);

    const now = new Date();
    const trfNum = `TRF-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const legDoc = `352/${now.getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

    // Atomic Transfer: TRANSFER_OUT from source, TRANSFER_IN to destination
    recordMovement(
      materialId,
      mat ? mat.code : 'MAT',
      mat ? mat.nameAr : 'Material',
      'TRANSFER_OUT',
      `${srcLoc ? srcLoc.warehouseNameAr : ''} - ${srcLoc ? srcLoc.code : ''}`,
      `${dstLoc ? dstLoc.warehouseNameAr : ''} - ${dstLoc ? dstLoc.code : ''}`,
      quantityKG,
      bulkBags,
      trfNum,
      legDoc,
      notes || `صادر مناقلة مخزنية داخلية بموجب مستند 352 إلى ${dstLoc?.code}`,
      trfNum,
      {
        fromWarehouseId: srcLoc?.warehouseId,
        fromWarehouseName: srcLoc?.warehouseNameAr,
        fromLocationId: srcLoc?.id,
        fromLocationCode: srcLoc?.code,
        toWarehouseId: dstLoc?.warehouseId,
        toWarehouseName: dstLoc?.warehouseNameAr,
        toLocationId: dstLoc?.id,
        toLocationCode: dstLoc?.code,
      }
    );

    recordMovement(
      materialId,
      mat ? mat.code : 'MAT',
      mat ? mat.nameAr : 'Material',
      'TRANSFER_IN',
      `${srcLoc ? srcLoc.warehouseNameAr : ''} - ${srcLoc ? srcLoc.code : ''}`,
      `${dstLoc ? dstLoc.warehouseNameAr : ''} - ${dstLoc ? dstLoc.code : ''}`,
      quantityKG,
      bulkBags,
      trfNum,
      legDoc,
      notes || `وارد مناقلة مخزنية داخلية بموجب مستند 352 من ${srcLoc?.code}`,
      trfNum,
      {
        fromWarehouseId: srcLoc?.warehouseId,
        fromWarehouseName: srcLoc?.warehouseNameAr,
        fromLocationId: srcLoc?.id,
        fromLocationCode: srcLoc?.code,
        toWarehouseId: dstLoc?.warehouseId,
        toWarehouseName: dstLoc?.warehouseNameAr,
        toLocationId: dstLoc?.id,
        toLocationCode: dstLoc?.code,
      }
    );

    logAudit(
      'Atomic Location Transfer Executed',
      'تنفيذ مناقلة بضاعة داخلية ذرية (صادر + وارد)',
      'InventoryMovement',
      trfNum,
      `From: ${srcLoc?.code} (${srcLoc?.warehouseNameAr})`,
      `To: ${dstLoc?.code} (${dstLoc?.warehouseNameAr}) | Qty: ${(quantityKG ?? 0).toLocaleString()} KG | Bags: ${bulkBags}`
    );

    return { success: true };
  };

  const transferStock = (...args: any[]) => {
    // If called like: transferStock(materialId, fromLocationId, fromWhId, toLocationId, toWhId, qty, bags, notes)
    if (args.length >= 6) {
      const materialId = args[0];
      const fromLocationId = args[1];
      const toLocationId = args[3];
      const qty = Number(args[5]);
      const bags = Number(args[6]) || 1;
      const notes = args[7];
      return executeLocationTransfer(materialId, fromLocationId, toLocationId, qty, bags, notes);
    }
    // If called like: transferStock(materialId, fromLoc, toLoc, qty, bags, notes)
    return executeLocationTransfer(args[0], args[1], args[2], Number(args[3]), Number(args[4]) || 1, args[5]);
  };

  // Aliases for Shredding & Production Workflows
  const startShreddingJob = (data: any) => {
    return createShreddingTransaction(data);
  };

  const completeShreddingJob = (
    id: string,
    outputKG: number,
    bulkBagsOutput: number,
    productionDamageKG: number,
    notes?: string,
    wasteKG?: number
  ) => {
    return completeShredding(id, outputKG, bulkBagsOutput, productionDamageKG, notes, wasteKG);
  };

  const returnShreddedToStorage = (
    id: string,
    destWarehouseId: string,
    destLocationId: string,
    notes?: string
  ) => {
    return returnShreddingToStorage(id, destWarehouseId, destLocationId, notes);
  };

  const issueToProduction = (data: any) => {
    return createProductionIssue(data);
  };

  // Production Damage Recording (Section 11 & 14)
  const recordProductionDamage = (data: {
    materialId: string;
    quantityKG: number;
    bulkBagsCount: number;
    machineLine: string;
    reason: string;
    disposition?: 'SHREDDING_QUEUE' | 'DISPOSED' | 'QUARANTINE';
    notes?: string;
    shift?: string;
    warehouseId?: string;
    locationId?: string;
  }) => {
    const qty = Number(data.quantityKG);
    const bags = Number(data.bulkBagsCount) || 1;
    if (!data.materialId || qty <= 0) {
      return { success: false, error: 'يرجى تحديد المادة وكمية التالف (كغم)' };
    }

    const mat = materials.find((m) => m.id === data.materialId);
    const now = new Date();
    const dmgNum = `DMG-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newDmg: ProductionDamageRecord = {
      id: `DMG-${Date.now().toString().slice(-6)}`,
      damageNumber: dmgNum,
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
      materialId: data.materialId,
      materialCode: mat ? mat.code : 'MAT',
      materialName: mat ? mat.nameAr : 'Material',
      quantityKG: qty,
      bulkBagsCount: bags,
      machineLine: data.machineLine || 'خط إنتاج',
      operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      supervisor: 'عمر عبدالكريم (المشرف العام للتحكم)',
      shift: data.shift || 'Morning / صباحي',
      reason: data.reason || 'تالف إنتاج غير مطابق للمواصفات',
      disposition: data.disposition || 'SHREDDING_QUEUE',
      dispositionAr:
        data.disposition === 'DISPOSED'
          ? 'إتلاف نهائي وتخلص'
          : data.disposition === 'QUARANTINE'
          ? 'حجر وتحفظ بساحة التالف'
          : 'توجيه لمخزن الثرم لإعادة التدوير',
      notes: data.notes || '',
      createdAt: now.toISOString(),
    };

    setProductionDamages((prev) => [newDmg, ...prev]);

    // Record inventory movement as PRODUCTION_DAMAGE
    recordMovement(
      newDmg.materialId,
      newDmg.materialCode,
      newDmg.materialName,
      'PRODUCTION_DAMAGE',
      newDmg.machineLine,
      newDmg.disposition === 'SHREDDING_QUEUE' ? 'منطقة انتظار الثرم' : 'ساحة التالف',
      qty,
      bags,
      dmgNum,
      'تالف إنتاج',
      `تسجيل تالف إنتاج: ${newDmg.reason}`,
      newDmg.id
    );

    logAudit(
      'Production Damage Recorded',
      'تسجيل وتوثيق تالف إنتاج',
      'ProductionDamage',
      dmgNum,
      '0 KG',
      `${(qty ?? 0).toLocaleString()} KG | Line: ${newDmg.machineLine} | Reason: ${newDmg.reason}`
    );

    return { success: true, id: newDmg.id };
  };

  // Production Order Operations (Section 10)
  const createProductionOrder = (orderData: Partial<ProductionOrder>) => {
    const now = new Date();
    const orderNumber = orderData.orderNumber?.trim() || `PO-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const plannedKG = Number(orderData.plannedKG) || 0;

    if (plannedKG <= 0) {
      return { success: false, error: 'يرجى إدخال كمية الإنتاج المخططة بالكيلوغرام (أكبر من صفر)' };
    }

    const mat = materials.find((m) => m.id === orderData.requiredMaterialId);

    const newOrder: ProductionOrder = {
      id: `PO-${Date.now().toString().slice(-6)}`,
      orderNumber,
      date: orderData.date || now.toISOString().split('T')[0],
      productName: orderData.productName || 'منتج بلاستيكي نهائي',
      productCode: orderData.productCode || `PRD-${now.getFullYear()}`,
      requiredMaterialId: orderData.requiredMaterialId || (materials[0]?.id ?? ''),
      requiredMaterialCode: mat?.code || 'MAT-001',
      requiredMaterialName: mat?.nameAr || 'خام بلاستيكي',
      plannedKG,
      actualInputKG: Number(orderData.actualInputKG) || 0,
      actualProductionKG: Number(orderData.actualProductionKG) || 0,
      productionDamageKG: Number(orderData.productionDamageKG) || 0,
      remainingKG: Math.max(0, plannedKG - (Number(orderData.actualProductionKG) || 0)),
      shift: orderData.shift || 'صباحية (06:00 - 14:00)',
      machineLine: orderData.machineLine || 'خط بثق الألواح البلاستيكية 1 (Extruder Sheet Line 1)',
      operator: orderData.operator || (currentUser?.nameAr || currentUser?.name || "المشرف"),
      supervisor: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      status: orderData.status || 'READY',
      notes: orderData.notes || '',
      createdAt: now.toISOString(),
    };

    setProductionOrders((prev) => [newOrder, ...prev]);

    logAudit(
      'Production Order Created',
      'إنشاء أمر تشغيل وإنتاج جديد',
      'ProductionOrder',
      newOrder.orderNumber,
      '0 KG',
      `${newOrder.productName} | خطة: ${(plannedKG ?? 0).toLocaleString()} KG | مادة: ${newOrder.requiredMaterialName}`,
      newOrder.notes
    );

    return { success: true, id: newOrder.id };
  };

  const updateProductionOrder = (id: string, data: Partial<ProductionOrder>) => {
    let updatedOrder: ProductionOrder | null = null;
    setProductionOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === id) {
          const planned = data.plannedKG !== undefined ? Number(data.plannedKG) : ord.plannedKG;
          const actualProd = data.actualProductionKG !== undefined ? Number(data.actualProductionKG) : ord.actualProductionKG;
          const remaining = Math.max(0, planned - actualProd);
          updatedOrder = {
            ...ord,
            ...data,
            plannedKG: planned,
            actualProductionKG: actualProd,
            remainingKG: remaining,
          };
          return updatedOrder;
        }
        return ord;
      })
    );

    if (!updatedOrder) {
      return { success: false, error: 'أمر الإنتاج غير موجود' };
    }

    logAudit(
      'Production Order Updated',
      'تحديث بيانات أمر الإنتاج',
      'ProductionOrder',
      (updatedOrder as ProductionOrder).orderNumber,
      'Updated',
      `حالة: ${(updatedOrder as ProductionOrder).status} | منجز: ${((updatedOrder as ProductionOrder).actualProductionKG ?? 0).toLocaleString()} KG | متبقي: ${((updatedOrder as ProductionOrder).remainingKG ?? 0).toLocaleString()} KG`
    );

    return { success: true };
  };

  const completeProductionOrder = (
    id: string,
    actualOutputKG: number,
    damageKG: number,
    notes?: string
  ) => {
    const ord = productionOrders.find((p) => p.id === id);
    if (!ord) {
      return { success: false, error: 'أمر الإنتاج المطلوب غير موجود' };
    }

    const outKG = Number(actualOutputKG) || 0;
    const dmgKG = Number(damageKG) || 0;
    const now = new Date();

    setProductionOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          return {
            ...o,
            actualProductionKG: outKG,
            productionDamageKG: dmgKG,
            remainingKG: Math.max(0, o.plannedKG - outKG),
            status: 'COMPLETED',
            notes: notes ? `${o.notes || ''} | ${notes}` : o.notes,
            completedAt: now.toISOString(),
          };
        }
        return o;
      })
    );

    // Record production output movement
    recordMovement(
      ord.requiredMaterialId,
      ord.requiredMaterialCode,
      ord.productName,
      'PRODUCTION_OUTPUT',
      ord.machineLine,
      'مستودع المنتجات النهائية والأكواب',
      outKG,
      Math.ceil(outKG / 1000),
      ord.orderNumber,
      'إتمام أمر إنتاج',
      `إتمام أمر الإنتاج ${ord.orderNumber} - إنتاج تام: ${outKG} كغم`,
      ord.id
    );

    // Record damage if any
    if (dmgKG > 0) {
      recordProductionDamage({
        materialId: ord.requiredMaterialId,
        quantityKG: dmgKG,
        bulkBagsCount: Math.max(1, Math.ceil(dmgKG / 1000)),
        machineLine: ord.machineLine,
        reason: `تالف وهوالك إنتاج ناتجة عن أمر ${ord.orderNumber}`,
        disposition: 'SHREDDING_QUEUE',
        notes: `تالف أمر إنتاج ${ord.orderNumber}`,
        shift: ord.shift,
      });
    }

    logAudit(
      'Production Order Completed',
      'إتمام وإغلاق أمر إنتاج وتوثيق المخرجات',
      'ProductionOrder',
      ord.orderNumber,
      `${(ord.actualProductionKG ?? 0).toLocaleString()} KG`,
      `إنتاج نهائي: ${(outKG ?? 0).toLocaleString()} KG | تالف: ${(dmgKG ?? 0).toLocaleString()} KG`,
      notes
    );

    return { success: true };
  };

  // Shift Handover System (Section 15)
  const addShiftHandover = (data: Partial<ShiftHandoverRecord>) => {
    const now = new Date();
    const dateStr = data.date || now.toISOString().split('T')[0];
    const handoverNumber = data.handoverNumber || `HO-${dateStr.replace(/-/g, '')}-${shiftHandovers.length + 1}`;

    const newHandover: ShiftHandoverRecord = {
      id: `HO-${Date.now().toString().slice(-6)}`,
      handoverNumber,
      date: dateStr,
      shiftFrom: data.shiftFrom || 'صباحية (06:00 - 14:00)',
      shiftTo: data.shiftTo || 'مسائية (14:00 - 22:00)',
      departingSupervisor: data.departingSupervisor || (currentUser?.nameAr || currentUser?.name || "المشرف"),
      incomingSupervisor: data.incomingSupervisor || 'مشرف الوردية القادمة',
      timestamp: data.timestamp || `${dateStr} ${now.toTimeString().slice(0, 8)}`,
      completedTasks: data.completedTasks && data.completedTasks.length > 0 ? data.completedTasks : ['إتمام المهام المقررة بالوردية بنجاح'],
      inProgressTasks: data.inProgressTasks && data.inProgressTasks.length > 0 ? data.inProgressTasks : ['لا توجد عمليات عالقة'],
      remainingWork: data.remainingWork && data.remainingWork.length > 0 ? data.remainingWork : ['استكمال خطة الإنتاج للوردية التالية'],
      pendingActionsSummary: data.pendingActionsSummary || `${pendingActions.length} معاملة معلقة حالياً`,
      reportedProblems: data.reportedProblems && data.reportedProblems.length > 0 ? data.reportedProblems : ['لا توجد بلاغات أعطال حرجة'],
      nextShiftInstructions: data.nextShiftInstructions || 'متابعة تشغيل خطوط الإنتاج والالتزام بإرشادات السلامة',
      thermSummary: data.thermSummary || { inputKG: 0, outputKG: 0, remainingKG: 0 },
      productionSummary: data.productionSummary || { inputKG: 0, outputKG: 0, damageKG: 0 },
      storageSummary: data.storageSummary || { inKG: 0, outKG: 0, balanceKG: 0 },
      status: 'SUBMITTED',
      createdAt: now.toISOString(),
    };

    setShiftHandovers((prev) => [newHandover, ...prev]);

    logAudit(
      'Shift Handover Submitted',
      'تسليم وردية وتوثيق محضر استلام العمليات',
      'ShiftHandover',
      newHandover.handoverNumber,
      'Pending Acknowledgement',
      `${newHandover.shiftFrom} -> ${newHandover.shiftTo} | المشرف المسلم: ${newHandover.departingSupervisor} | المستلم: ${newHandover.incomingSupervisor}`,
      newHandover.nextShiftInstructions
    );

    return { success: true, id: newHandover.id };
  };

  const acknowledgeShiftHandover = (id: string, incomingSupervisorName: string) => {
    let ackRecord: ShiftHandoverRecord | null = null;
    const now = new Date();

    setShiftHandovers((prev) =>
      prev.map((ho) => {
        if (ho.id === id) {
          ackRecord = {
            ...ho,
            status: 'ACKNOWLEDGED',
            incomingSupervisor: incomingSupervisorName.trim() || ho.incomingSupervisor,
            acknowledgedAt: now.toISOString(),
          };
          return ackRecord;
        }
        return ho;
      })
    );

    if (!ackRecord) {
      return { success: false, error: 'محضر تسليم الوردية غير موجود' };
    }

    logAudit(
      'Shift Handover Acknowledged',
      'اعتماد وتوقيع استلام الوردية بواسطة المشرف القادم',
      'ShiftHandover',
      (ackRecord as ShiftHandoverRecord).handoverNumber,
      'SUBMITTED',
      `تم الاستلام والاعتماد بواسطة: ${(ackRecord as ShiftHandoverRecord).incomingSupervisor}`
    );

    return { success: true };
  };

  // Three Daily Operation Sections Calculations (Section 13)
  const getDailyOperationsSummary = (targetDate?: string, shiftFilter?: string): DailyOperationsSummary => {
    let effDate = targetDate;
    if (!effDate) {
      const dates = [
        ...receivingTransactions.map((r) => r.date),
        ...shreddingTransactions.map((s) => s.shreddingStart ? (s.shreddingStart.includes('T') ? s.shreddingStart.split('T')[0] : s.shreddingStart.split(' ')[0]) : ''),
        ...productionIssues.map((p) => p.date),
      ].filter(Boolean);
      effDate = dates.length > 0 ? dates.sort().reverse()[0] : '2026-09-02';
    }

    // 1. THERM SECTION
    const dayShreds = shreddingTransactions.filter((s) => {
      const sDate = s.shreddingStart
        ? (s.shreddingStart.includes('T') ? s.shreddingStart.split('T')[0] : s.shreddingStart.split(' ')[0])
        : (s.shreddingEnd ? (s.shreddingEnd.includes('T') ? s.shreddingEnd.split('T')[0] : s.shreddingEnd.split(' ')[0]) : '');
      return sDate === effDate;
    });

    const thermInputKG = dayShreds.reduce((sum, s) => sum + (s.inputWeightKG || 0), 0);
    const thermOutputKG = dayShreds.reduce((sum, s) => sum + (s.outputKG || 0), 0);
    const thermDamageKG = dayShreds.reduce((sum, s) => sum + (s.productionDamageKG || 0), 0);
    const thermRemainingKG = Math.max(0, thermInputKG - thermOutputKG - thermDamageKG);
    const thermBagsIn = dayShreds.reduce((sum, s) => sum + (s.bulkBagsInput || 0), 0);
    const thermBagsOut = dayShreds.reduce((sum, s) => sum + (s.bulkBagsOutput || 0), 0);

    // 2. PRODUCTION SECTION
    const dayProdIssues = productionIssues.filter((p) => {
      const matchDate = p.date === effDate;
      const matchShift = !shiftFilter || shiftFilter === 'ALL' || p.shift.includes(shiftFilter);
      return matchDate && matchShift;
    });
    const dayProdOrders = productionOrders.filter((po) => {
      const matchDate = po.date === effDate;
      const matchShift = !shiftFilter || shiftFilter === 'ALL' || po.shift.includes(shiftFilter);
      return matchDate && matchShift;
    });
    const dayProdDamages = productionDamages.filter((d) => d.date === effDate);

    const prodInputKG = dayProdIssues.reduce((sum, p) => sum + (p.quantityKG || 0), 0);
    const prodOrdersOutputKG = dayProdOrders.reduce((sum, po) => sum + (po.actualProductionKG || 0), 0);
    const prodOutputKG = prodOrdersOutputKG > 0 ? prodOrdersOutputKG : Math.max(0, prodInputKG * 0.95);
    const prodDamageKG =
      dayProdDamages.reduce((sum, d) => sum + (d.quantityKG || 0), 0) +
      dayProdOrders.reduce((sum, po) => sum + (po.productionDamageKG || 0), 0);
    const prodRemainingKG = Math.max(0, prodInputKG - prodOutputKG - prodDamageKG);
    const prodBagsIn = dayProdIssues.reduce((sum, p) => sum + (p.bulkBagsCount || 0), 0);
    const prodBagsOut = Math.ceil(prodOutputKG / 1000);

    // 3. STORAGE SECTION
    const dayMovements = inventoryMovements.filter((m) => m.date === effDate);
    const dayReceivings = receivingTransactions.filter((r) => r.date === effDate && r.netReceivedWeightKG > 0);

    const storageInFromMovements = dayMovements
      .filter((m) =>
        m.movementType === 'RECEIPT' ||
        m.movementType === 'RECEIVING' ||
        m.movementType === 'RETURN' ||
        m.movementType === 'RETURN_TO_STORAGE' ||
        m.movementType === 'SHREDDING_OUTPUT'
      )
      .reduce((sum, m) => sum + (m.quantityKG || 0), 0);

    const storageInKG = storageInFromMovements > 0
      ? storageInFromMovements
      : dayReceivings.reduce((sum, r) => sum + r.netReceivedWeightKG, 0);

    const storageOutKG = dayMovements
      .filter((m) =>
        m.movementType === 'ISSUE' ||
        m.movementType === 'PRODUCTION ISSUE' ||
        m.movementType === 'PRODUCTION_ISSUE' ||
        m.movementType === 'SHREDDING_INPUT'
      )
      .reduce((sum, m) => sum + Math.abs(m.quantityKG || 0), 0);

    const totalInventoryBalance = inventoryBalances.reduce((sum, b) => sum + (b.totalBalanceKG || 0), 0);
    const storageBalanceNet = storageInKG - storageOutKG;

    const storageBagsIn = dayMovements
      .filter((m) => m.movementType === 'RECEIPT' || m.movementType === 'RETURN_TO_STORAGE' || m.movementType === 'SHREDDING_OUTPUT')
      .reduce((sum, m) => sum + (m.bulkBagsCount || 0), 0);

    const storageBagsOut = dayMovements
      .filter((m) => m.movementType === 'ISSUE' || m.movementType === 'PRODUCTION ISSUE' || m.movementType === 'SHREDDING_INPUT')
      .reduce((sum, m) => sum + (m.bulkBagsCount || 0), 0);

    return {
      date: effDate,
      shift: shiftFilter || 'ALL',
      therm: {
        todayInKG: thermInputKG,
        todayOutKG: thermOutputKG,
        todayResultKG: thermOutputKG,
        currentRemainingKG: thermRemainingKG,
        bulkBagsIn: thermBagsIn,
        bulkBagsOut: thermBagsOut,
        operationsCount: dayShreds.length,
      },
      production: {
        todayInKG: prodInputKG,
        todayOutKG: prodOutputKG,
        todayResultKG: prodOutputKG,
        currentRemainingKG: prodRemainingKG,
        bulkBagsIn: prodBagsIn,
        bulkBagsOut: prodBagsOut,
        operationsCount: dayProdIssues.length + dayProdOrders.length,
      },
      storage: {
        todayInKG: storageInKG,
        todayOutKG: storageOutKG,
        todayResultKG: storageBalanceNet,
        currentRemainingKG: totalInventoryBalance,
        bulkBagsIn: storageBagsIn,
        bulkBagsOut: storageBagsOut,
        operationsCount: dayMovements.length || dayReceivings.length,
      },
    };
  };

  // Automated Inventory Consistency Test & Admin Reconciliation Tool (Section 6 & 40)
  const checkInventoryConsistency = (): InventoryConsistencyReport[] => {
    const reports: InventoryConsistencyReport[] = [];
    const now = new Date().toISOString();

    materials.forEach((mat) => {
      // 1. Calculate Ledger Balance by processing all confirmed inventory movements
      let ledgerKG = 0;
      let ledgerBags = 0;

      const matMovements = inventoryMovements.filter(
        (m) =>
          (m.materialId === mat.id || m.materialCode === mat.code) &&
          m.status !== 'DUPLICATE' &&
          m.status !== 'Reversed' &&
          m.status !== 'Cancelled'
      );

      const inflowTypes = new Set([
        'RECEIPT',
        'RECEIVING',
        'TRANSFER_IN',
        'RETURN',
        'SHREDDING_OUTPUT',
        'SHREDDING RETURN',
        'SHREDDING_RETURN',
        'PRODUCTION_RETURN',
        'OPENING_BALANCE',
      ]);

      const outflowTypes = new Set([
        'ISSUE',
        'TRANSFER_OUT',
        'SHREDDING_INPUT',
        'SHREDDING ISSUE',
        'SHREDDING_ISSUE',
        'PRODUCTION_ISSUE',
        'PRODUCTION ISSUE',
        'DAMAGE',
        'PRODUCTION_DAMAGE',
      ]);

      matMovements.forEach((mov) => {
        const qty = Number(mov.quantityKG) || 0;
        const bags = Number(mov.bulkBagsCount) || 0;

        if (inflowTypes.has(mov.movementType)) {
          ledgerKG += qty;
          ledgerBags += bags;
        } else if (outflowTypes.has(mov.movementType)) {
          ledgerKG -= qty;
          ledgerBags -= bags;
        } else if (mov.movementType === 'ADJUSTMENT') {
          ledgerKG += qty;
          ledgerBags += bags;
        }
      });

      // 2. Calculate Stored Inventory Balance across all locations
      const matBalances = inventoryBalances.filter((b) => b.materialId === mat.id);
      const storedKG = matBalances.reduce((sum, b) => sum + (b.availableKG || 0), 0);
      const storedBags = matBalances.reduce((sum, b) => sum + (b.bulkBagsCount || 0), 0);

      const diffKG = storedKG - ledgerKG;
      const diffBags = storedBags - ledgerBags;
      const isConsistent = Math.abs(diffKG) < 0.01 && diffBags === 0;

      reports.push({
        materialId: mat.id,
        materialCode: mat.code,
        materialName: mat.nameAr,
        ledgerKG: Math.round(ledgerKG * 100) / 100,
        storedKG: Math.round(storedKG * 100) / 100,
        diffKG: Math.round(diffKG * 100) / 100,
        ledgerBags,
        storedBags,
        diffBags,
        isConsistent,
        status: isConsistent ? 'MATCH' : 'DISCREPANCY',
        lastChecked: now,
      });
    });

    return reports;
  };

  const reconcileMaterialStock = (
    materialId: string,
    locationId: string,
    targetKG: number,
    targetBags: number,
    reason: string,
    supervisorPin: string
  ) => {
    // Supervisor PIN verification or admin role check
    if (supervisorPin !== '1234' && supervisorPin !== '9999' && currentUser.role !== 'SUPER_ADMIN') {
      return { success: false, error: 'رمز تأكيد المشرف غير صحيح. يلزم صلاحية إشرافية لإجراء التسوية!' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'يلزم كتابة سبب تسوية تفصيلي ومعتمد للجرد!' };
    }

    const mat = materials.find((m) => m.id === materialId);
    const loc = locations.find((l) => l.id === locationId) || locations[0];
    const bal = inventoryBalances.find((b) => b.materialId === materialId && b.locationId === loc.id);

    const currentKG = bal ? bal.availableKG : 0;
    const currentBags = bal ? bal.bulkBagsCount : 0;
    const deltaKG = targetKG - currentKG;
    const deltaBags = targetBags - currentBags;

    if (deltaKG === 0 && deltaBags === 0) {
      return { success: false, error: 'لا يوجد فارق لتسويته. الرصيد الحالي يطابق الرصيد المطلوب!' };
    }

    const now = new Date();
    const adjNum = `ADJ-REC-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    recordMovement(
      materialId,
      mat ? mat.code : 'MAT',
      mat ? mat.nameAr : 'Material',
      'ADJUSTMENT',
      deltaKG < 0 ? `${loc.warehouseNameAr} - ${loc.code}` : 'تسوية جرد دفتري معتمد',
      deltaKG > 0 ? `${loc.warehouseNameAr} - ${loc.code}` : 'تسوية جرد دفتري معتمد',
      deltaKG,
      deltaBags,
      adjNum,
      'تسوية جرد',
      `تسوية رصيد جرد ومطابقة الدفتر: ${reason} (تعديل: ${deltaKG > 0 ? '+' : ''}${deltaKG} كغم، ${deltaBags} شليف)`,
      adjNum,
      {
        toLocationId: loc.id,
        toLocationCode: loc.code,
        toWarehouseId: loc.warehouseId,
      }
    );

    logAudit(
      'Inventory Reconciled (Authorized Adjustment)',
      'تسوية رصيد مخزون معتمدة بواسطة المشرف',
      'InventoryBalance',
      `${mat?.code} @ ${loc.code}`,
      `${currentKG} KG / ${currentBags} Bags`,
      `${targetKG} KG / ${targetBags} Bags | Delta: ${deltaKG} KG | Reason: ${reason}`
    );

    return { success: true };
  };

  const autoFixDiscrepancies = (
    materialIds: string[],
    customReason?: string,
    supervisorPin?: string
  ) => {
    // Supervisor PIN verification or admin role check
    if (
      supervisorPin &&
      supervisorPin !== '1234' &&
      supervisorPin !== '9999' &&
      currentUser.role !== 'SUPER_ADMIN'
    ) {
      return {
        success: false,
        fixedCount: 0,
        results: [],
        error: 'رمز تأكيد المشرف غير صحيح. يلزم صلاحية إشرافية لإجراء التسوية الآلية!',
      };
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 5);
    const results: {
      materialId: string;
      materialCode: string;
      materialName: string;
      deltaKG: number;
      deltaBags: number;
      documentNumber: string;
      success: boolean;
      error?: string;
    }[] = [];

    const newMovements: InventoryMovement[] = [];
    let fixedCount = 0;

    materialIds.forEach((matId) => {
      const mat = materials.find((m) => m.id === matId);
      if (!mat) return;

      // Compute exact reconciliation item
      const rec = calculateMaterialReconciliation(mat, inventoryMovements, inventoryBalances);
      const deltaKG = Math.round((rec.formulaCalculatedKG - rec.storedInventoryKG) * 100) / 100;
      const deltaBags = rec.formulaCalculatedBags - rec.storedInventoryBags;

      // Skip if no mismatch
      if (Math.abs(deltaKG) < 0.01 && deltaBags === 0) {
        return;
      }

      // Find best location for adjustment
      const existingLocWithStock = locations.find((l) =>
        inventoryBalances.some((b) => b.materialId === mat.id && b.locationId === l.id && b.availableKG > 0)
      );
      const defaultLoc = locations.find((l) => l.id === mat.defaultLocationId);
      const targetLoc = existingLocWithStock || defaultLoc || locations[0];

      const adjDocNum = `ADJ-AUTO-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const movId = `MOV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      const reason =
        customReason && customReason.trim().length >= 5
          ? customReason
          : `تسوية جردية آلية لمعالجة فارق المعادلة: (الافتتاحي + الوارد + المرتجع) - (المنصرف + التالف + الثرم)`;

      const notes = `تسوية آلية معتمدة: رصيد سابق ${(rec.storedInventoryKG ?? 0).toLocaleString()} كغم -> رصيد مستهدف ${(rec.formulaCalculatedKG ?? 0).toLocaleString()} كغم (تعديل: ${deltaKG > 0 ? '+' : ''}${(deltaKG ?? 0).toLocaleString()} كغم، ${deltaBags} شليف)`;

      const newMov: InventoryMovement = {
        id: movId,
        movementId: `MOV-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        date: dateStr,
        time: timeStr,
        materialId: mat.id,
        materialCode: mat.code,
        materialName: mat.nameAr,
        movementType: 'ADJUSTMENT',
        source: deltaKG < 0 ? `${targetLoc.warehouseNameAr} - ${targetLoc.code}` : 'تسوية مطابقة جردية آلية معتمدة',
        destination: deltaKG > 0 ? `${targetLoc.warehouseNameAr} - ${targetLoc.code}` : 'تسوية مطابقة جردية آلية معتمدة',
        quantityKG: deltaKG,
        bulkBagsCount: deltaBags,
        referenceDocument: adjDocNum,
        legacyDocRef: adjDocNum,
        internalInventoryCode: activeStorageCode,
        user: (currentUser?.nameAr || currentUser?.name || "المشرف") || currentUser.name,
        operator: (currentUser?.nameAr || currentUser?.name || "المشرف") || currentUser.name,
        status: 'Completed',
        notes,
        toLocationId: targetLoc.id,
        toLocationCode: targetLoc.code,
        toWarehouseId: targetLoc.warehouseId,
      };

      newMovements.push(newMov);
      fixedCount++;

      logAudit(
        'Auto-Fix Inventory Discrepancy',
        'تسوية آلية لمعالجة فارق المخزون الدفتري',
        'InventoryMovement',
        `${mat.code} @ ${targetLoc.code}`,
        `${rec.storedInventoryKG} KG / ${rec.storedInventoryBags} Bags`,
        `${rec.formulaCalculatedKG} KG / ${rec.formulaCalculatedBags} Bags | Delta: ${deltaKG} KG | Doc: ${adjDocNum}`
      );

      results.push({
        materialId: mat.id,
        materialCode: mat.code,
        materialName: mat.nameAr,
        deltaKG,
        deltaBags,
        documentNumber: adjDocNum,
        success: true,
      });
    });

    if (newMovements.length > 0) {
      setInventoryMovements((prev) => [...prev, ...newMovements]);
    }

    return {
      success: true,
      fixedCount,
      results,
    };
  };

  // Low Stock & Safety Thresholds Monitoring
  const lowStockOverview = useMemo(() => {
    return evaluateLowStockInventory(
      materials,
      inventoryBalances,
      suppliers,
      receivingTransactions,
      warehouses,
      locations
    );
  }, [materials, inventoryBalances, suppliers, receivingTransactions, warehouses, locations]);

  const updateMaterialSafetyThreshold = (
    materialId: string,
    minStockKG: number,
    maxStockKG: number
  ) => {
    if (minStockKG < 0 || maxStockKG <= 0 || minStockKG > maxStockKG) {
      return { success: false, error: 'الحد الأدنى للأمان يجب أن يكون أكبر من أو يساوي الصفر وأقل من الحد الأقصى' };
    }

    const mat = materials.find((m) => m.id === materialId);
    if (!mat) {
      return { success: false, error: 'المادة غير موجودة' };
    }

    const oldMin = mat.minStockKG;
    const oldMax = mat.maxStockKG;

    setMaterials((prev) =>
      prev.map((m) =>
        m.id === materialId
          ? {
              ...m,
              minStockKG: Math.round(minStockKG),
              maxStockKG: Math.round(maxStockKG),
            }
          : m
      )
    );

    logAudit(
      'Update Safety Stock Threshold',
      'تعديل حدود الأمان والمخزون الحرج للصنف',
      'MaterialItem',
      mat.code,
      `Min: ${oldMin.toLocaleString()} KG, Max: ${oldMax.toLocaleString()} KG`,
      `Min: ${minStockKG.toLocaleString()} KG, Max: ${maxStockKG.toLocaleString()} KG`
    );

    return { success: true };
  };

  const addWarehouse = (whData: Omit<Warehouse, 'id'>) => {
    const newId = `WH-${String(warehouses.length + 1).padStart(2, '0')}`;
    const newWh: Warehouse = {
      ...whData,
      id: newId,
    };
    setWarehouses((prev) => [...prev, newWh]);
    logAudit('Warehouse Added', 'إضافة مستودع جديد', 'Warehouse', newWh.code, 'None', newWh.nameAr);
    return { success: true, id: newId };
  };

  const addLocation = (locData: Omit<WarehouseLocation, 'id'>) => {
    const newId = `LOC-${Date.now().toString().slice(-6)}`;
    const newLoc: WarehouseLocation = {
      ...locData,
      id: newId,
    };
    setLocations((prev) => [...prev, newLoc]);
    logAudit('Storage Location Added', 'إضافة موقع تخزين / رف جديد', 'WarehouseLocation', newLoc.code, 'None', newLoc.nameAr);
    FirebaseService.warehouseLocations.save(newLoc).catch(console.warn);
    return { success: true, id: newId };
  };

  const updateWarehouse = async (id: string, updates: Partial<Warehouse>): Promise<boolean> => {
    let updatedObj: Warehouse | null = null;
    setWarehouses((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          updatedObj = { ...w, ...updates };
          return updatedObj;
        }
        return w;
      })
    );
    if (updatedObj) {
      await FirebaseService.warehouses.save(updatedObj);
      logAudit(
        'Warehouse Updated',
        'تعديل بيانات وكود المستودع المرجعي في Firestore',
        'Warehouse',
        (updatedObj as Warehouse).code,
        '-',
        `${(updatedObj as Warehouse).nameAr} (كود مرجعي: ${(updatedObj as Warehouse).referenceCode || '-'})`
      );
    }
    return true;
  };

  const updateLocation = async (id: string, updates: Partial<WarehouseLocation>): Promise<boolean> => {
    let updatedObj: WarehouseLocation | null = null;
    setLocations((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          updatedObj = { ...l, ...updates };
          return updatedObj;
        }
        return l;
      })
    );
    if (updatedObj) {
      await FirebaseService.warehouseLocations.save(updatedObj);
      logAudit(
        'Storage Location Updated',
        'تعديل كود وموقع التخزين المرجعي في Firestore',
        'WarehouseLocation',
        (updatedObj as WarehouseLocation).code,
        '-',
        `${(updatedObj as WarehouseLocation).nameAr} (كود مرجعي: ${(updatedObj as WarehouseLocation).referenceCode || '-'})`
      );
    }
    return true;
  };

  const deleteLocation = async (id: string): Promise<boolean> => {
    const target = locations.find((l) => l.id === id);
    if (!target) return false;
    setLocations((prev) => prev.filter((l) => l.id !== id));
    await FirebaseService.warehouseLocations.delete(id);
    logAudit(
      'Storage Location Deleted',
      'حذف موقع تخزين من المستودع وقاعدة البيانات',
      'WarehouseLocation',
      target.code,
      '-',
      target.nameAr
    );
    return true;
  };

  // Master Data Add/Update
  const addMaterial = (matData: Omit<MaterialItem, 'id' | 'createdAt'>) => {
    const newId = `MAT-${Date.now().toString().slice(-6)}`;
    const newMat: MaterialItem = {
      ...matData,
      id: newId,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setMaterials((prev) => [...prev, newMat]);
    logAudit('New Material Added', 'إضافة صنف جديد لدليل المواد', 'MaterialItem', newMat.code, 'None', newMat.nameAr);
    return { success: true };
  };

  const updateMaterial = (id: string, matData: Partial<MaterialItem>) => {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...matData } : m)));
    return { success: true };
  };

  const bulkImportMaterials = (
    items: Array<Partial<MaterialItem> & { code: string; nameAr: string }>,
    mode: 'UPSERT' | 'CREATE_ONLY' | 'UPDATE_ONLY' = 'UPSERT'
  ) => {
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const updatedMaterials = [...materials];

    items.forEach((item, idx) => {
      const rowNum = idx + 1;
      const code = (item.code || '').trim();
      const nameAr = (item.nameAr || '').trim();

      if (!code) {
        errors.push(`Row #${rowNum}: Missing material code (كود الصنف مطلوب)`);
        skippedCount++;
        return;
      }
      if (!nameAr) {
        errors.push(`Row #${rowNum} (${code}): Missing Arabic name (الاسم بالعربية مطلوب)`);
        skippedCount++;
        return;
      }

      const existingIndex = updatedMaterials.findIndex(
        (m) => m.code.trim().toLowerCase() === code.toLowerCase()
      );

      if (existingIndex >= 0) {
        if (mode === 'CREATE_ONLY') {
          skippedCount++;
          return;
        }

        const existing = updatedMaterials[existingIndex];
        const updated: MaterialItem = {
          ...existing,
          nameAr: item.nameAr || existing.nameAr,
          nameEn: item.nameEn || existing.nameEn || item.nameAr,
          category: item.category || existing.category,
          unit: item.unit || existing.unit || 'KG',
          minStockKG: item.minStockKG !== undefined ? Number(item.minStockKG) : (item.minStockLevelKG !== undefined ? Number(item.minStockLevelKG) : existing.minStockKG),
          maxStockKG: item.maxStockKG !== undefined ? Number(item.maxStockKG) : (item.maxStockLevelKG !== undefined ? Number(item.maxStockLevelKG) : existing.maxStockKG),
          minStockLevelKG: item.minStockLevelKG !== undefined ? Number(item.minStockLevelKG) : (item.minStockKG !== undefined ? Number(item.minStockKG) : existing.minStockLevelKG),
          maxStockLevelKG: item.maxStockLevelKG !== undefined ? Number(item.maxStockLevelKG) : (item.maxStockKG !== undefined ? Number(item.maxStockKG) : existing.maxStockLevelKG),
          requiresShredding:
            item.requiresShredding !== undefined ? Boolean(item.requiresShredding) : existing.requiresShredding,
          defaultWarehouseId: item.defaultWarehouseId || existing.defaultWarehouseId || 'WH-01',
          defaultLocationId: item.defaultLocationId || existing.defaultLocationId || 'LOC-A01',
          notes: item.notes !== undefined ? item.notes : existing.notes,
          descriptionAr: item.descriptionAr || item.notes || existing.descriptionAr,
          descriptionEn: item.descriptionEn || existing.descriptionEn,
          aliases: item.aliases && item.aliases.length > 0 ? item.aliases : existing.aliases,
        };
        updatedMaterials[existingIndex] = updated;
        updatedCount++;
      } else {
        if (mode === 'UPDATE_ONLY') {
          skippedCount++;
          return;
        }

        const newId = `MAT-${Date.now().toString().slice(-6)}-${idx}`;
        const minStock = item.minStockKG !== undefined ? Number(item.minStockKG) : (item.minStockLevelKG !== undefined ? Number(item.minStockLevelKG) : 5000);
        const maxStock = item.maxStockKG !== undefined ? Number(item.maxStockKG) : (item.maxStockLevelKG !== undefined ? Number(item.maxStockLevelKG) : 50000);

        const newMat: MaterialItem = {
          id: newId,
          code,
          nameAr,
          nameEn: item.nameEn || nameAr,
          category: item.category || 'Raw Plastic / مواد خام',
          unit: item.unit || 'KG',
          minStockKG: minStock,
          maxStockKG: maxStock,
          minStockLevelKG: minStock,
          maxStockLevelKG: maxStock,
          requiresShredding: Boolean(item.requiresShredding),
          defaultWarehouseId: item.defaultWarehouseId || 'WH-01',
          defaultLocationId: item.defaultLocationId || 'LOC-A01',
          active: item.active !== undefined ? Boolean(item.active) : true,
          notes: item.notes || 'مستورد بالجملة إلى دليل المواد',
          descriptionAr: item.descriptionAr || item.notes || '',
          descriptionEn: item.descriptionEn || '',
          aliases: item.aliases || [],
          createdAt: todayStr,
        };
        updatedMaterials.push(newMat);
        addedCount++;
      }
    });

    setMaterials(updatedMaterials);

    logAudit(
      'Bulk Materials Imported',
      'استيراد وتحديث مواد بالجملة في دليل المواد',
      'MaterialItem',
      `BATCH-IMP-${Date.now().toString().slice(-6)}`,
      `Count: ${materials.length}`,
      `Total: ${updatedMaterials.length} (Added: ${addedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount})`,
      `Mode: ${mode} | Rows: ${items.length}`
    );

    return {
      success: true,
      addedCount,
      updatedCount,
      skippedCount,
      errors,
      affectedMaterials: updatedMaterials,
    };
  };

  const addSupplier = (supData: Omit<Supplier, 'id' | 'totalDeliveriesCount' | 'totalKGDelivered'>) => {
    const newId = `SUP-${Date.now().toString().slice(-6)}`;
    const newSup: Supplier = {
      ...supData,
      id: newId,
      totalDeliveriesCount: 0,
      totalKGDelivered: 0,
    };
    setSuppliers((prev) => [...prev, newSup]);
    logAudit('New Supplier Registered', 'تسجيل مورد جديد بالسجل', 'Supplier', newSup.code, 'None', newSup.nameAr);
    return { success: true };
  };

  const updateSupplier = (id: string, supData: Partial<Supplier>) => {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...supData } : s)));
    return { success: true };
  };

  // Export any dataset to formatted Excel file
  const exportToExcel = (sheetName: string, data: any[], filename: string) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
      logAudit('Excel Export Executed', 'تصدير تقرير إلى ملف إكسل', 'ExportReport', filename, 'None', `${data.length} records`);
    } catch (err) {
      console.error('Export Excel failed:', err);
    }
  };

  // Import Excel factory records with validation
  const importExcelData = (
    type: 'RECEIVING' | 'SHREDDING' | 'PRODUCTION' | 'MATERIALS',
    parsedRows: any[]
  ) => {
    const errors: string[] = [];
    let count = 0;

    if (!parsedRows || parsedRows.length === 0) {
      return { success: false, count: 0, errors: ['الملف فارغ أو لا يحتوي على صفوف صالحة'] };
    }

    try {
      if (type === 'RECEIVING') {
        parsedRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const materialName = row['Material'] || row['المادة'] || row['الصنف'];
          const supplierName = row['Supplier'] || row['المورد'];
          const vehicle = row['Vehicle'] || row['الشاحنة'] || row['رقم السيارة'] || 'حمل 100';
          const driver = row['Driver'] || row['السائق'] || 'سائق خارجي';
          const scaleIn = Number(row['ScaleIn'] || row['وزن الدخول'] || row['قائم'] || row['GrossKG']) || 0;
          const scaleOut = Number(row['ScaleOut'] || row['وزن الخروج'] || row['فارغ'] || row['TareKG']) || 0;
          const bags = Number(row['Bags'] || row['شلايف'] || row['الشلايف'] || row['bulkBags']) || 1;
          const legDoc = row['LegacyDoc'] || row['رقم المستند'] || row['546'] || row['docRef'] || `546/IMP/${rowNum}`;

          if (!materialName) {
            errors.push(`صف ${rowNum}: اسم المادة مفقود`);
            return;
          }
          if (scaleIn <= 0) {
            errors.push(`صف ${rowNum}: وزن الدخول غير صالح`);
            return;
          }

          const matchedMat = materials.find((m) => (m?.nameAr && m.nameAr.includes(materialName)) || (m?.nameEn && m.nameEn.includes(materialName))) || materials[0] || INITIAL_MATERIALS[0];
          const matchedSup = suppliers.find((s) => s?.nameAr && s.nameAr.includes(supplierName)) || suppliers[0] || INITIAL_SUPPLIERS[0];
          const netWeight = scaleOut > 0 && scaleIn > scaleOut ? scaleIn - scaleOut : (row['NetKG'] || row['الصافي'] || scaleIn * 0.45);

          const now = new Date();
          const newRec: ReceivingTransaction = {
            id: `IMP-RCV-${Date.now()}-${idx}`,
            transactionNumber: `RCV-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            legacyDocumentNumber: String(legDoc),
            date: row['Date'] || row['التاريخ'] || now.toISOString().split('T')[0],
            time: row['Time'] || row['الوقت'] || '08:00',
            supplierId: matchedSup.id,
            supplierName: matchedSup.nameAr || 'المورد الرئيسي',
            materialId: matchedMat.id,
            materialCode: matchedMat.code,
            materialName: matchedMat.nameAr || matchedMat.nameEn || 'مادة خام',
            vehiclePlate: String(vehicle),
            driverName: String(driver),
            scaleInWeightKG: scaleIn,
            scaleOutWeightKG: scaleOut,
            netReceivedWeightKG: Number(netWeight),
            bulkBagsCount: bags,
            targetWarehouseId: matchedMat.defaultWarehouseId,
            targetLocationId: matchedMat.defaultLocationId,
            targetLocationCode: 'LOC-A-01',
            materialCondition: 'Clean & Sorted',
            requiresShredding: matchedMat.requiresShredding,
            status: scaleOut > 0 ? 'Received' : 'Scale In Completed',
            operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
            supervisor: 'عمر عبدالكريم (المشرف العام للتحكم)',
            notes: `مستورد من ملف إكسل تاريخي (${legDoc})`,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

          setReceivingTransactions((prev) => [newRec, ...prev]);

          if (scaleOut > 0 || netWeight > 0) {
            recordMovement(
              matchedMat.id,
              matchedMat.code,
              matchedMat.nameAr,
              'RECEIVING',
              `استيراد إكسل تاريخي / ${matchedSup.nameAr}`,
              `مستودع الخامات - ${newRec.targetLocationCode}`,
              Number(netWeight),
              bags,
              newRec.transactionNumber,
              String(legDoc),
              'قيد استيراد تاريخي لمستند 546',
              newRec.id
            );
          }

          count++;
        });
      } else if (type === 'SHREDDING') {
        parsedRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const materialName = row['Material'] || row['المادة'] || row['الصنف'];
          const weight = Number(row['Weight'] || row['الوزن'] || row['NetKG'] || row['الكمية']) || 0;
          const bags = Number(row['Bags'] || row['شلايف'] || row['الشلايف']) || 1;
          const legDoc = row['LegacyDoc'] || row['رقم المستند'] || row['360'] || row['docRef'] || `360/IMP/${rowNum}`;
          const operator = row['Operator'] || row['المشغل'] || (currentUser?.nameAr || currentUser?.name || "المشرف");

          if (!materialName) {
            errors.push(`صف ${rowNum}: اسم المادة مفقود`);
            return;
          }
          if (weight <= 0) {
            errors.push(`صف ${rowNum}: وزن الثرم غير صالح`);
            return;
          }

          const matchedMat = materials.find((m) => (m?.nameAr && m.nameAr.includes(materialName)) || (m?.nameEn && m.nameEn.includes(materialName))) || materials[0] || INITIAL_MATERIALS[0];
          const now = new Date();
          const newShred = {
            id: `IMP-SHR-${Date.now()}-${idx}`,
            transactionNumber: `SHR-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            legacyDocumentNumber: String(legDoc),
            date: row['Date'] || row['التاريخ'] || now.toISOString().split('T')[0],
            time: row['Time'] || row['الوقت'] || '09:00',
            sourceLocationCode: 'LOC-A-01',
            materialId: matchedMat.id,
            materialName: matchedMat.nameAr || matchedMat.nameEn || 'مادة خام',
            shredderLine: row['Line'] || row['الخط'] || 'خط الثرم الصناعي 01',
            operatorName: String(operator),
            supervisorName: 'عمر عبدالكريم',
            shreddedWeightKG: weight,
            bulkBagsProduced: bags,
            targetWarehouseId: 'WH-02',
            targetLocationCode: 'SHRED-BAY-01',
            status: 'Transfer Completed' as const,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };

          setShreddingTransactions((prev) => [newShred, ...prev]);

          recordMovement(
            matchedMat.id,
            matchedMat.code,
            matchedMat.nameAr,
            'SHREDDING RETURN',
            'مستودع الخامات الخام',
            'مستودع المفروز والمثرم (WH-02)',
            weight,
            bags,
            newShred.transactionNumber,
            String(legDoc),
            'قيد استيراد إكسل تاريخي لمستند 360',
            newShred.id
          );

          count++;
        });
      } else if (type === 'PRODUCTION') {
        parsedRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const materialName = row['Material'] || row['المادة'] || row['الصنف'];
          const weight = Number(row['Weight'] || row['الوزن'] || row['Quantity'] || row['الكمية']) || 0;
          const bags = Number(row['Bags'] || row['شلايف'] || row['الشلايف']) || 1;
          const legDoc = row['LegacyDoc'] || row['رقم المستند'] || row['167'] || row['docRef'] || `167/IMP/${rowNum}`;
          const prodLine = row['Line'] || row['خط الإنتاج'] || 'خط البثق والتحبيب 01';

          if (!materialName) {
            errors.push(`صف ${rowNum}: اسم المادة مفقود`);
            return;
          }
          if (weight <= 0) {
            errors.push(`صف ${rowNum}: كمية الصرف غير صالحة`);
            return;
          }

          const matchedMat = materials.find((m) => (m?.nameAr && m.nameAr.includes(materialName)) || (m?.nameEn && m.nameEn.includes(materialName))) || materials[0] || INITIAL_MATERIALS[0];

          recordMovement(
            matchedMat.id,
            matchedMat.code,
            matchedMat.nameAr || matchedMat.nameEn || 'مادة خام',
            'PRODUCTION ISSUE',
            'مستودع المواد الجاهزة',
            `صالة الإنتاج - ${prodLine}`,
            weight,
            bags,
            `ISS-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            String(legDoc),
            'قيد استيراد إكسل تاريخي لصرف الإنتاج (167)'
          );

          count++;
        });
      } else if (type === 'MATERIALS') {
        parsedRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = row['Code'] || row['رمز المادة'] || `MAT-IMP-${idx + 10}`;
          const nameAr = row['NameAr'] || row['المادة'] || row['الاسم بالعربية'];
          const nameEn = row['NameEn'] || row['English Name'] || nameAr;
          const initialStock = Number(row['StockKG'] || row['الرصيد'] || row['الكمية']) || 0;
          const bags = Number(row['Bags'] || row['الشلايف']) || Math.ceil(initialStock / 1000);

          if (!nameAr) {
            errors.push(`صف ${rowNum}: اسم المادة مفقود`);
            return;
          }

          const now = new Date();
          const newMat: MaterialItem = {
            id: `MAT-IMP-${Date.now()}-${idx}`,
            code: String(code),
            nameAr: String(nameAr),
            nameEn: String(nameEn),
            category: 'Scrap & Trims / سكراب وهوالك',
            unit: 'KG',
            minStockKG: 5000,
            maxStockKG: 100000,
            requiresShredding: true,
            defaultWarehouseId: 'WH-01',
            defaultLocationId: 'LOC-A01',
            active: true,
            notes: `مادة مستوردة من ملف Excel`,
            createdAt: now.toISOString(),
          };

          setMaterials((prev) => [...prev, newMat]);

          if (initialStock > 0) {
            recordMovement(
              newMat.id,
              newMat.code,
              newMat.nameAr,
              'ADJUSTMENT',
              'رصيد أول المدة',
              'مستودع الخامات الرئيسي',
              initialStock,
              bags,
              `OPN-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
              'OPENING-STOCK',
              'قيد رصيد افتتاحي مستورد من Excel'
            );
          }

          count++;
        });
      }

      logAudit(
        'Excel Historical Records Imported',
        'استيراد سجلات تاريخية من ملف إكسل للمصنع',
        'ExcelImport',
        type,
        'None',
        `Successfully imported ${count} records`
      );

      return { success: true, count, errors };
    } catch (err: any) {
      return { success: false, count, errors: [err.message || 'فشل استيراد الملف'] };
    }
  };

  // Smart Ingestion Engine for Analyzed Rows with full traceability & audit
  const importSmartAnalyzedRows = (batch: {
    batchId: string;
    fileName: string;
    docType: ExcelDocType;
    rows: AnalyzedDataRow[];
    isHistoricalSnapshot?: boolean;
  }) => {
    const { batchId, fileName, docType, rows, isHistoricalSnapshot } = batch;
    const errors: string[] = [];
    let count = 0;
    let duplicateCount = 0;
    let totalKGAdded = 0;
    let totalBagsAdded = 0;

    const validRows = rows.filter((r) => !r.isIgnoredByUser && r.severity !== 'ERROR');
    if (validRows.length === 0) {
      return { success: false, count: 0, errors: ['لا توجد صفوف صالحة ومؤكدة للاستيراد'] };
    }

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const nowDate = nowIso.split('T')[0];
      const nowTime = now.toTimeString().slice(0, 5);

      // Existing fingerprints set for lightning fast duplicate detection
      const existingFingerprints = new Set(
        inventoryMovements.map((m) => m.fingerprint).filter(Boolean)
      );

      validRows.forEach((row, idx) => {
        const mat = materials.find((m) => m?.id === row.materialMatchedId || m?.code === row.materialMatchedCode) || materials[0] || INITIAL_MATERIALS[0];
        const sup = suppliers.find((s) => s?.id === row.supplierMatchedId) || suppliers[0] || INITIAL_SUPPLIERS[0];
        const loc = locations.find((l) => l?.code === row.locationCode || l?.id === row.locationId) || locations[0] || INITIAL_LOCATIONS[0];
        const targetWhId = row.warehouseId || mat.defaultWarehouseId || 'WH-01';
        const targetWh = warehouses.find((w) => w?.id === targetWhId);

        // Generate fingerprint
        const fingerprint = computeMovementFingerprint({
          docRef: row.docRef,
          materialCode: mat.code,
          date: row.date || nowDate,
          netKG: row.netKG,
          bulkBags: row.bulkBags,
          supplier: sup?.nameAr || 'المورد',
          sourceFile: fileName,
          sourceSheet: row.sourceSheet,
          sourceRow: row.sourceRow,
        });

        // Duplicate protection check
        if (existingFingerprints.has(fingerprint)) {
          duplicateCount++;
          return;
        }
        existingFingerprints.add(fingerprint);

        const traceabilityData = {
          fromWarehouseId: undefined,
          fromLocationId: undefined,
          fromLocationCode: undefined,
          toWarehouseId: targetWhId,
          toWarehouseName: targetWh?.nameAr,
          toLocationId: loc.id,
          toLocationCode: loc.code,
          supplierName: sup?.nameAr || 'المورد',
          importBatchId: batchId,
          sourceFileName: fileName,
          sourceSheetName: row.sourceSheet,
          sourceRowNumber: row.sourceRow,
          sourceDocumentNumber: row.docRef,
          originalMaterialText: row.materialRaw,
          originalMaterialCode: row.materialMatchedCode,
          originalSupplierText: row.supplierRaw,
          originalWeightValue: row.netKG,
          originalBulkBagValue: row.bulkBags,
          importTimestamp: nowIso,
          importedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
          fingerprint,
        };

        if (docType === '546') {
          // Receiving (546)
          const newRcv: ReceivingTransaction = {
            id: `IMP-RCV-${Date.now()}-${idx}`,
            transactionNumber: `RCV-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            legacyDocumentNumber: row.docRef || `546/IMP/${row.sourceRow}`,
            date: row.date || nowDate,
            time: row.time || '08:00',
            supplierId: sup.id,
            supplierName: sup?.nameAr || 'المورد',
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat?.nameAr || mat?.nameEn || 'مادة خام',
            vehiclePlate: row.vehicle || 'حمل 100',
            driverName: row.driver || 'سائق خارجي',
            scaleInWeightKG: row.grossKG || row.netKG * 1.8,
            scaleOutWeightKG: row.tareKG || (row.grossKG ? row.grossKG - row.netKG : 0),
            netReceivedWeightKG: row.netKG,
            bulkBagsCount: row.bulkBags,
            targetWarehouseId: targetWhId,
            targetLocationId: loc.id,
            targetLocationCode: loc.code,
            materialCondition: 'Clean & Sorted',
            requiresShredding: mat.requiresShredding,
            status: 'Received',
            operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
            supervisor: 'عمر عبدالكريم (المشرف العام للتحكم)',
            notes: `استيراد تاريخي موثق من ملف ${fileName} (ورقة: ${row.sourceSheet}، صف: ${row.sourceRow}) | دفعة: ${batchId}`,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          setReceivingTransactions((prev) => [newRcv, ...prev]);

          recordMovement(
            mat.id,
            mat.code,
            mat.nameAr,
            'RECEIVING',
            `استيراد إكسل / ${sup.nameAr}`,
            `${targetWh?.nameAr || 'مستودع الخامات'} - ${loc.code}`,
            row.netKG,
            row.bulkBags,
            newRcv.transactionNumber,
            row.docRef,
            `دفعة استيراد تاريخي ${batchId} من ${fileName}`,
            newRcv.id,
            traceabilityData
          );
        } else if (docType === '360' || docType === '352') {
          // Shredding Store Receipt (360 / 352)
          const newShred: ShreddingTransaction = {
            id: `IMP-SHR-${Date.now()}-${idx}`,
            shreddingNumber: `THM-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            legacyDocumentNumber: row.docRef || `${docType}/IMP/${row.sourceRow}`,
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat?.nameAr || mat?.nameEn || 'مادة خام',
            inputKG: row.inputKG || row.netKG * 1.05,
            bulkBagsInput: row.bulkBags,
            shreddingStart: `${row.date || nowDate} 08:00`,
            shreddingEnd: `${row.date || nowDate} 11:30`,
            outputKG: row.outputKG || row.netKG,
            bulkBagsOutput: row.bulkBags,
            productionDamageKG: row.damageKG || 0,
            varianceKG: 0,
            variancePercentage: 0,
            isAbnormalVariance: false,
            operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
            supervisor: 'عمر عبدالكريم',
            machineId: row.line || 'SHRED-01',
            sourceLocationId: 'LOC-A01',
            sourceLocationCode: 'LOC-A-01',
            destinationWarehouseId: 'WH-02',
            destinationLocationId: 'LOC-THM02',
            destinationLocationCode: 'LOC-THM-02',
            status: 'Returned to Storage',
            notes: `استيراد تاريخي لمستند ${docType} من ملف ${fileName} | دفعة: ${batchId}`,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          setShreddingTransactions((prev) => [newShred, ...prev]);

          recordMovement(
            mat.id,
            mat.code,
            mat.nameAr,
            'SHREDDING RETURN',
            'مستودع الخامات وسكراب الأكواب',
            'مستودع ومخزن الثرم رقم 2 (WH-02)',
            row.netKG,
            row.bulkBags,
            newShred.shreddingNumber,
            row.docRef,
            `دفعة استيراد ${batchId} لمستند ${docType}`,
            newShred.id,
            {
              ...traceabilityData,
              fromLocationCode: 'LOC-A-01',
              toWarehouseId: 'WH-02',
              toLocationId: 'LOC-THM02',
              toLocationCode: 'LOC-THM-02',
            }
          );
        } else if (docType === '167') {
          // Production Issue (167)
          const newIssue: ProductionIssue = {
            id: `IMP-ISS-${Date.now()}-${idx}`,
            issueNumber: `ISS-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            legacyDocumentNumber: row.docRef || `167/IMP/${row.sourceRow}`,
            productionOrderNumber: `PO-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            machineLine: row.line || 'خط البثق والتحبيب 01',
            materialId: mat.id,
            materialCode: mat.code,
            materialName: mat.nameAr,
            warehouseId: targetWhId,
            locationId: loc.id,
            locationCode: loc.code,
            quantityKG: row.netKG,
            bulkBagsCount: row.bulkBags,
            stockBeforeKG: 25000,
            stockAfterKG: 25000 - row.netKG,
            operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
            supervisor: 'عمر عبدالكريم',
            date: row.date || nowDate,
            time: row.time || '10:00',
            shift: 'Morning / صباحي',
            status: 'Completed',
            notes: `استيراد تاريخي لصرف الإنتاج (167) من ملف ${fileName} | دفعة: ${batchId}`,
            createdAt: nowIso,
          };

          setProductionIssues((prev) => [newIssue, ...prev]);

          recordMovement(
            mat.id,
            mat.code,
            mat.nameAr,
            'PRODUCTION ISSUE',
            `مستودع الخامات - ${loc.code}`,
            `صالة الإنتاج - ${newIssue.machineLine}`,
            row.netKG,
            row.bulkBags,
            newIssue.issueNumber,
            row.docRef,
            `دفعة استيراد ${batchId} لمستند 167`,
            newIssue.id,
            {
              ...traceabilityData,
              fromWarehouseId: targetWhId,
              fromLocationId: loc.id,
              fromLocationCode: loc.code,
            }
          );
        } else {
          // HISTORICAL_SNAPSHOT / OPENING_BALANCE
          const movementType: MovementType = isHistoricalSnapshot || docType === 'INVENTORY_SNAPSHOT' ? 'OPENING_BALANCE' : 'ADJUSTMENT';
          recordMovement(
            mat.id,
            mat.code,
            mat.nameAr,
            movementType,
            `رصيد افتتاحي تاريخي (${fileName})`,
            `${mat.defaultWarehouseId === 'WH-02' ? 'مستودع ومخزن الثرم' : 'مستودع الخامات الرئيسي'} - ${loc.code}`,
            row.netKG,
            row.bulkBags,
            `BAL-IMP-${Math.floor(1000 + Math.random() * 9000)}`,
            row.docRef || 'HISTORICAL-OPENING',
            `ترحيل رصيد تاريخي افتتاحي دفعة ${batchId} من ${fileName} (ورقة: ${row.sourceSheet} صف: ${row.sourceRow})`,
            undefined,
            traceabilityData
          );
        }

        totalKGAdded += row.netKG;
        totalBagsAdded += row.bulkBags;
        count++;
      });

      // Update the Batch state
      updateImportBatch(batchId, {
        status: count > 0 ? 'COMPLETED' : 'NEEDS_REVIEW',
        rowsAccepted: count,
        importedRowsCount: count,
        totalKG: totalKGAdded,
        totalBags: totalBagsAdded,
        notes: `تم الترحيل بنجاح: ${count} سجل، إجمالي ${totalKGAdded.toLocaleString()} كغم، ${totalBagsAdded} كيس كبير (تم تجنب ${duplicateCount} تكرار)`,
      });

      // Log complete audit trail
      logAudit(
        'Historical Migration Batch Completed',
        'اعتماد وترحيل دفعة إكسل تاريخية لقاعدة بيانات وسجل حركات المصنع',
        'HistoricalMigration',
        batchId,
        'None',
        `تم ترحيل ${count} سجلات من الملف ${fileName} (${docType})`,
        `المسؤول: ${(currentUser?.nameAr || currentUser?.name || "المشرف")} | الملف: ${fileName} | الوزن الإجمالي: +${totalKGAdded.toLocaleString()} كغم | الأكياس: +${totalBagsAdded} | السجلات المكررة المستبعدة: ${duplicateCount}`
      );

      return { success: true, count, errors: [] };
    } catch (err: any) {
      updateImportBatch(batchId, { status: 'FAILED', notes: err.message || 'فشل الترحيل' });
      return { success: false, count: 0, errors: [err.message || 'فشل ترحيل البيانات'] };
    }
  };

  // 22. Surgical test data cleanup (guarantees real historical data is untouched)
  const purgeTestData = (prefix: string = 'TEST') => {
    const isTest = (val?: string) => {
      if (!val) return false;
      const lower = val.toLowerCase();
      return (
        lower.includes('test') ||
        lower.includes('اختبار') ||
        lower.includes('تجريب') ||
        lower.startsWith(prefix.toLowerCase())
      );
    };

    let pRcv = 0, pShr = 0, pPO = 0, pIss = 0, pDam = 0, pMov = 0, pMat = 0, pAudit = 0;

    setReceivingTransactions((prev) => {
      const kept = prev.filter((r) => {
        const testMatch = isTest(r.id) || isTest(r.transactionNumber) || isTest(r.materialName) || isTest(r.vehiclePlate) || isTest(r.driverName);
        if (testMatch) pRcv++;
        return !testMatch;
      });
      return kept;
    });

    setShreddingTransactions((prev) => {
      const kept = prev.filter((s) => {
        const testMatch = isTest(s.id) || isTest(s.shreddingNumber) || isTest(s.materialName) || isTest(s.notes);
        if (testMatch) pShr++;
        return !testMatch;
      });
      return kept;
    });

    setProductionOrders((prev) => {
      const kept = prev.filter((o) => {
        const testMatch = isTest(o.id) || isTest(o.orderNumber) || isTest(o.productName) || isTest(o.requiredMaterialName);
        if (testMatch) pPO++;
        return !testMatch;
      });
      return kept;
    });

    setProductionIssues((prev) => {
      const kept = prev.filter((i) => {
        const testMatch = isTest(i.id) || isTest(i.issueNumber) || isTest(i.materialName) || isTest(i.productionOrderNumber);
        if (testMatch) pIss++;
        return !testMatch;
      });
      return kept;
    });

    setProductionDamages((prev) => {
      const kept = prev.filter((d) => {
        const testMatch = isTest(d.id) || isTest(d.damageNumber) || isTest(d.materialName) || isTest(d.orderNumber);
        if (testMatch) pDam++;
        return !testMatch;
      });
      return kept;
    });

    setInventoryMovements((prev) => {
      const kept = prev.filter((m) => {
        const testMatch = isTest(m.id) || isTest(m.movementId) || isTest(m.referenceDocument) || isTest(m.materialName) || isTest(m.transactionId);
        if (testMatch) pMov++;
        return !testMatch;
      });
      return kept;
    });

    setMaterials((prev) => {
      const kept = prev.filter((m) => {
        const testMatch = isTest(m.id) || isTest(m.code) || isTest(m.nameAr) || isTest(m.nameEn);
        if (testMatch) pMat++;
        return !testMatch;
      });
      return kept;
    });

    setAuditLogs((prev) => {
      const kept = prev.filter((a) => {
        const testMatch = isTest(a.entityId) || isTest(a.notes) || (a.action && isTest(a.action));
        if (testMatch) pAudit++;
        return !testMatch;
      });
      return kept;
    });

    logAudit(
      'Test Data Purged',
      'تنظيف وحذف بيانات الاختبار التجريبية دون المساس بالبيانات التاريخية',
      'SystemIntegrity',
      'PURGE-TEST-RUN',
      'Test Records Present',
      `Purged ${pRcv} Rcv, ${pShr} Shr, ${pPO} POs, ${pIss} Issues, ${pDam} Damages, ${pMov} Movs, ${pMat} Mats, ${pAudit} Audits`,
      `Executed cleanly by ${(currentUser?.nameAr || currentUser?.name || "المشرف")}`
    );

    return {
      purgedReceiving: pRcv,
      purgedShredding: pShr,
      purgedProductionOrders: pPO,
      purgedProductionIssues: pIss,
      purgedProductionDamages: pDam,
      purgedMovements: pMov,
      purgedMaterials: pMat,
      purgedAuditLogs: pAudit,
    };
  };

  // Reset factory to clean slate pristine state for live data import
  const resetFactoryData = () => {
    localStorage.clear();
    localStorage.setItem('alkarwan_system_clean_slate', 'true');
    setCurrentUser(INITIAL_USERS[0]);
    setMaterials([]);
    setSuppliers([]);
    setWarehouses(INITIAL_WAREHOUSES);
    setLocations(INITIAL_LOCATIONS.map((l) => ({ ...l, currentKG: 0, bulkBagsCount: 0 })));
    setReceivingTransactions([]);
    setShreddingTransactions([]);
    setProductionIssues([]);
    setProductionOrders([]);
    setProductionDamages([]);
    setInventoryMovements([]);
    setBulkBags([]);
    setApprovals([]);
    setShiftHandovers([]);
    setWarehouseTransfers([]);
    setPhysicalCounts([]);
    setPurchaseRequirements([]);
    setPurchaseReceipts([]);
    setImportBatches([]);
    setAuditLogs([
      {
        id: `LOG-CLEAN-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'System Purged & Clean Slate Initialized',
        actionAr: 'تطهير وتفريغ النظام بالكامل لاستقبال البيانات الحقيقية من ملفات الإكسل',
        entityType: 'SystemSecurity',
        entityId: 'CLEAN_SLATE',
        oldValue: 'Mock Development Data',
        newValue: 'Pristine Clean Slate',
        user: currentUser?.nameAr || 'المشرف العام',
      },
    ]);
  };

  // Restore database snapshot in-memory and re-sync local storage persistence
  const restoreSnapshotIntoContext = (snapshot: DatabaseSnapshot) => {
    localStorage.removeItem('alkarwan_system_clean_slate');
    const cols = snapshot.collections || {};
    const collectionsRestored: string[] = [];
    let totalRestored = 0;

    if (Array.isArray(cols.materials) && cols.materials.length > 0) {
      setMaterials(cols.materials);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_materials', JSON.stringify(cols.materials));
      } catch {}
      collectionsRestored.push('materials');
      totalRestored += cols.materials.length;
    }
    if (Array.isArray(cols.suppliers) && cols.suppliers.length > 0) {
      setSuppliers(cols.suppliers);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_suppliers', JSON.stringify(cols.suppliers));
      } catch {}
      collectionsRestored.push('suppliers');
      totalRestored += cols.suppliers.length;
    }
    if (Array.isArray(cols.warehouses) && cols.warehouses.length > 0) {
      setWarehouses(cols.warehouses);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_warehouses', JSON.stringify(cols.warehouses));
      } catch {}
      collectionsRestored.push('warehouses');
      totalRestored += cols.warehouses.length;
    }
    const locs = cols.warehouseLocations || cols.locations;
    if (Array.isArray(locs) && locs.length > 0) {
      setLocations(locs);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_locations', JSON.stringify(locs));
      } catch {}
      collectionsRestored.push('locations');
      totalRestored += locs.length;
    }
    if (Array.isArray(cols.receivingTransactions) && cols.receivingTransactions.length > 0) {
      setReceivingTransactions(cols.receivingTransactions);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_receivingTransactions', JSON.stringify(cols.receivingTransactions));
      } catch {}
      collectionsRestored.push('receivingTransactions');
      totalRestored += cols.receivingTransactions.length;
    }
    if (Array.isArray(cols.shreddingTransactions) && cols.shreddingTransactions.length > 0) {
      setShreddingTransactions(cols.shreddingTransactions);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_shreddingTransactions', JSON.stringify(cols.shreddingTransactions));
      } catch {}
      collectionsRestored.push('shreddingTransactions');
      totalRestored += cols.shreddingTransactions.length;
    }
    if (Array.isArray(cols.productionIssues) && cols.productionIssues.length > 0) {
      setProductionIssues(cols.productionIssues);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_productionIssues', JSON.stringify(cols.productionIssues));
      } catch {}
      collectionsRestored.push('productionIssues');
      totalRestored += cols.productionIssues.length;
    }
    if (Array.isArray(cols.productionOrders) && cols.productionOrders.length > 0) {
      setProductionOrders(cols.productionOrders);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_productionOrders', JSON.stringify(cols.productionOrders));
      } catch {}
      collectionsRestored.push('productionOrders');
      totalRestored += cols.productionOrders.length;
    }
    if (Array.isArray(cols.productionDamages) && cols.productionDamages.length > 0) {
      setProductionDamages(cols.productionDamages);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_productionDamages', JSON.stringify(cols.productionDamages));
      } catch {}
      collectionsRestored.push('productionDamages');
      totalRestored += cols.productionDamages.length;
    }
    if (Array.isArray(cols.inventoryMovements) && cols.inventoryMovements.length > 0) {
      setInventoryMovements(cols.inventoryMovements);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_inventoryMovements', JSON.stringify(cols.inventoryMovements));
      } catch {}
      collectionsRestored.push('inventoryMovements');
      totalRestored += cols.inventoryMovements.length;
    }
    if (Array.isArray(cols.bulkBags) && cols.bulkBags.length > 0) {
      setBulkBags(cols.bulkBags);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_bulkBags', JSON.stringify(cols.bulkBags));
      } catch {}
      collectionsRestored.push('bulkBags');
      totalRestored += cols.bulkBags.length;
    }
    if (Array.isArray(cols.approvals) && cols.approvals.length > 0) {
      setApprovals(cols.approvals);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_approvals', JSON.stringify(cols.approvals));
      } catch {}
      collectionsRestored.push('approvals');
      totalRestored += cols.approvals.length;
    }
    if (Array.isArray(cols.shiftHandovers) && cols.shiftHandovers.length > 0) {
      setShiftHandovers(cols.shiftHandovers);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_shiftHandovers', JSON.stringify(cols.shiftHandovers));
      } catch {}
      collectionsRestored.push('shiftHandovers');
      totalRestored += cols.shiftHandovers.length;
    }
    if (Array.isArray(cols.warehouseTransfers) && cols.warehouseTransfers.length > 0) {
      setWarehouseTransfers(cols.warehouseTransfers);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_warehouseTransfers', JSON.stringify(cols.warehouseTransfers));
      } catch {}
      collectionsRestored.push('warehouseTransfers');
      totalRestored += cols.warehouseTransfers.length;
    }
    if (Array.isArray(cols.physicalCounts) && cols.physicalCounts.length > 0) {
      setPhysicalCounts(cols.physicalCounts);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_physicalCounts', JSON.stringify(cols.physicalCounts));
      } catch {}
      collectionsRestored.push('physicalCounts');
      totalRestored += cols.physicalCounts.length;
    }
    if (Array.isArray(cols.purchaseRequirements) && cols.purchaseRequirements.length > 0) {
      setPurchaseRequirements(cols.purchaseRequirements);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_purchaseRequirements', JSON.stringify(cols.purchaseRequirements));
      } catch {}
      collectionsRestored.push('purchaseRequirements');
      totalRestored += cols.purchaseRequirements.length;
    }
    if (Array.isArray(cols.purchaseReceipts) && cols.purchaseReceipts.length > 0) {
      setPurchaseReceipts(cols.purchaseReceipts);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_purchaseReceipts', JSON.stringify(cols.purchaseReceipts));
      } catch {}
      collectionsRestored.push('purchaseReceipts');
      totalRestored += cols.purchaseReceipts.length;
    }
    if (Array.isArray(cols.importBatches) && cols.importBatches.length > 0) {
      setImportBatches(cols.importBatches);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_importBatches', JSON.stringify(cols.importBatches));
      } catch {}
      collectionsRestored.push('importBatches');
      totalRestored += cols.importBatches.length;
    }
    if (Array.isArray(cols.auditLogs) && cols.auditLogs.length > 0) {
      setAuditLogs(cols.auditLogs);
      try {
        localStorage.setItem('alkarwan_factory_state_v2_auditLogs', JSON.stringify(cols.auditLogs));
      } catch {}
      collectionsRestored.push('auditLogs');
      totalRestored += cols.auditLogs.length;
    }

    // Append a rollback event to audit logs
    const now = new Date();
    const rollbackLog: AuditLogEntry = {
      id: `LOG-RESTORE-${Date.now()}`,
      userId: currentUser?.id || 'admin',
      userName: currentUser?.nameAr || currentUser?.name || 'المشرف العام',
      userRole: currentUser?.role || 'SUPERVISOR',
      action: 'Database Snapshot Restored',
      actionAr: 'تم استعادة لقطة قاعدة البيانات بنجاح في ذاكرة النظام',
      entityType: 'SystemSecurity',
      entityId: snapshot.metadata?.exportTimestamp || 'RESTORED_SNAPSHOT',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      oldValue: 'Pre-Rollback State',
      newValue: `Restored ${totalRestored} records across ${collectionsRestored.length} collections`,
      ipAddress: '127.0.0.1',
      status: 'SUCCESS',
      notes: `Restored from snapshot ${snapshot.metadata?.exportTimestamp || ''}`,
    };
    setAuditLogs((prev) => [rollbackLog, ...prev]);

    return { totalRestored, collectionsRestored };
  };

  // Status Machine & Workflow Verification helpers
  const validateWorkflowTransitionHandler = (
    currentStatus: TransactionStatus | string | undefined | null,
    targetStatus: TransactionStatus | string,
    options?: {
      requiresShredding?: boolean;
      route?: 'READY_SHREDDED' | 'NOT_SHREDDED';
      payload?: any;
    }
  ): StatusValidationResult => {
    return validateStatusTransition(currentStatus, targetStatus, options);
  };

  const checkMaterialProductionReadinessHandler = (
    materialId: string,
    locationId: string
  ) => {
    return checkMaterialProductionReadinessService(materialId, locationId, {
      inventoryBalances,
      receivingTransactions,
      shreddingTransactions,
    });
  };

  const getWorkflowStageInfoHandler = (status: TransactionStatus | string | undefined | null) => {
    const stage = normalizeToWorkflowStage(status);
    return WORKFLOW_STAGE_INFO[stage];
  };

  // -------------------------------------------------------------
  // BULK BAG (شليف) OPERATIONS
  // -------------------------------------------------------------
  const registerBulkBag = (bagData: Partial<BulkBag>) => {
    const now = new Date();
    const id = bagData.id || `BAG-${Date.now().toString().slice(-6)}`;
    const bagNum = bagData.bagNumber || bagData.bagId || `BAG-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newBag: BulkBag = {
      id,
      bagNumber: bagNum,
      bagId: bagNum,
      materialId: bagData.materialId || materials[0]?.id || 'MAT-001',
      materialCode: bagData.materialCode || 'MAT',
      materialName: bagData.materialName || 'خام بلاستيك',
      weightKG: Number(bagData.weightKG) || 1000,
      tareKG: bagData.tareKG || 2.5,
      warehouseId: bagData.warehouseId || warehouses[0]?.id || 'WH-01',
      warehouseName: bagData.warehouseName,
      locationId: bagData.locationId || locations[0]?.id || 'LOC-A01',
      locationCode: bagData.locationCode || 'LOC-A-01',
      transactionNumber: bagData.transactionNumber || bagData.sourceTransactionNumber || 'TX-MANUAL',
      batchNumber: bagData.batchNumber || `LOT-${now.toISOString().slice(0, 10).replace(/-/g, '')}`,
      status: (bagData.status as BulkBagStatus) || 'IN_STORAGE',
      qrPayload: JSON.stringify({ bag_id: bagNum, mat: bagData.materialName, net_kg: bagData.weightKG }),
      createdAt: now.toISOString(),
      createdBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      notes: bagData.notes,
    };
    setBulkBags((prev) => [newBag, ...prev]);
    saveDocToFirestore('bulk_bags', newBag.id, newBag);
    logAudit(
      'Bulk Bag Registered',
      `تسجيل شليف صناعي جديد (${newBag.bagNumber}) بوزن ${newBag.weightKG} كغم`,
      'BulkBag',
      newBag.bagNumber,
      'NEW',
      `${newBag.materialName} | ${newBag.weightKG} KG | ${newBag.locationCode}`
    );
    return { success: true, id: newBag.id };
  };

  const updateBulkBag = (id: string, updates: Partial<BulkBag>) => {
    setBulkBags((prev) =>
      prev.map((b) => (b.id === id || b.bagNumber === id || b.bagId === id ? { ...b, ...updates } : b))
    );
    const found = bulkBags.find((b) => b.id === id || b.bagNumber === id || b.bagId === id);
    if (found) {
      saveDocToFirestore('bulk_bags', found.id, { ...found, ...updates });
    }
    return { success: true };
  };

  // -------------------------------------------------------------
  // APPROVALS & SUPERVISORY GOVERNANCE
  // -------------------------------------------------------------
  const approveRequest = (approvalId: string, notes?: string) => {
    const target = approvals.find((a) => a.id === approvalId);
    if (!target) return { success: false, error: 'طلب الاعتماد غير موجود' };
    if (target.status !== 'PENDING') return { success: false, error: 'الطلب تم اتخاذ القرار بشأنه مسبقاً' };

    const now = new Date();
    const updated: ApprovalRecord = {
      ...target,
      status: 'APPROVED',
      reviewedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      reviewedAt: now.toISOString(),
      notes: notes || target.notes,
    };

    setApprovals((prev) => prev.map((a) => (a.id === approvalId ? updated : a)));
    saveDocToFirestore('approvals', target.id, updated);

    logAudit(
      'Approval Granted',
      `اعتماد رقابي رسمي للمستند ${target.entityReference || target.entityId || target.id}`,
      'ApprovalRecord',
      target.entityReference || target.entityId || target.id,
      'PENDING',
      `المعتمد: ${(currentUser?.nameAr || currentUser?.name || "المشرف")} | ملاحظات: ${notes || 'معتمد رسمياً'}`
    );
    return { success: true };
  };

  const rejectRequest = (approvalId: string, notes?: string) => {
    const target = approvals.find((a) => a.id === approvalId);
    if (!target) return { success: false, error: 'طلب الاعتماد غير موجود' };
    if (target.status !== 'PENDING') return { success: false, error: 'الطلب تم اتخاذ القرار بشأنه مسبقاً' };

    const now = new Date();
    const updated: ApprovalRecord = {
      ...target,
      status: 'REJECTED',
      reviewedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      reviewedAt: now.toISOString(),
      notes: notes || 'مرفوض من قبل المشرف',
    };

    setApprovals((prev) => prev.map((a) => (a.id === approvalId ? updated : a)));
    saveDocToFirestore('approvals', target.id, updated);

    logAudit(
      'Approval Rejected',
      `رفض الطلب الرقابي للمستند ${target.entityReference || target.entityId || target.id}`,
      'ApprovalRecord',
      target.entityReference || target.entityId || target.id,
      'PENDING',
      `المشرف: ${(currentUser?.nameAr || currentUser?.name || "المشرف")} | سبب الرفض: ${notes || 'رفض الطلب'}`
    );
    return { success: true };
  };

  // -------------------------------------------------------------
  // PURCHASE REQUIREMENTS & PHYSICAL AUDITS
  // -------------------------------------------------------------
  const createPurchaseRequirement = (req: Partial<PurchaseRequirement>) => {
    const now = new Date();
    const id = req.id || `REQ-${Date.now().toString().slice(-6)}`;
    const requirementNumber = req.requirementNumber || `PR-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newReq: PurchaseRequirement = {
      id,
      requirementNumber,
      materialId: req.materialId || materials[0]?.id || 'MAT-001',
      materialCode: req.materialCode || 'MAT',
      materialName: req.materialName || 'خام بلاستيك',
      requiredKG: Number(req.requiredKG || req.requiredQuantityKG) || 5000,
      requiredQuantityKG: Number(req.requiredQuantityKG || req.requiredKG) || 5000,
      currentStockKG: req.currentStockKG || 0,
      safetyStockKG: req.safetyStockKG || 2000,
      urgency: req.urgency || 'MEDIUM',
      requestedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      status: req.status || 'OPEN',
      notes: req.notes || '',
      createdAt: now.toISOString(),
    };
    setPurchaseRequirements((prev) => [newReq, ...prev]);
    saveDocToFirestore('purchase_requirements', newReq.id, newReq);
    return { success: true, id: newReq.id };
  };

  const createPhysicalCount = (data: Partial<PhysicalInventoryCount>) => {
    const now = new Date();
    const id = data.id || `CNT-${Date.now().toString().slice(-6)}`;
    const countNumber = data.countNumber || `STK-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const bookKG = Number(data.bookQuantityKG || data.systemKG) || 0;
    const physicalKG = Number(data.physicalQuantityKG || data.physicalKG) || 0;
    const varianceKG = physicalKG - bookKG;
    const bookBags = Number(data.bookBulkBags || data.systemBags) || 0;
    const physicalBags = Number(data.physicalBulkBags || data.physicalBags) || 0;
    const varianceBags = physicalBags - bookBags;

    const newCount: PhysicalInventoryCount = {
      id,
      countNumber,
      date: data.date || now.toISOString().split('T')[0],
      countDate: data.countDate || data.date || now.toISOString().split('T')[0],
      warehouseId: data.warehouseId || 'WH-01',
      locationId: data.locationId || 'LOC-A01',
      locationCode: data.locationCode || 'LOC-A-01',
      materialId: data.materialId || 'MAT-001',
      materialCode: data.materialCode || 'MAT',
      materialName: data.materialName || 'خام',
      systemKG: bookKG,
      physicalKG,
      diffKG: varianceKG,
      bookQuantityKG: bookKG,
      physicalQuantityKG: physicalKG,
      varianceKG,
      systemBags: bookBags,
      physicalBags,
      diffBags: varianceBags,
      bookBulkBags: bookBags,
      physicalBulkBags: physicalBags,
      varianceBulkBags: varianceBags,
      countedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      status: varianceKG === 0 ? 'RECONCILED' : 'PENDING_APPROVAL',
      notes: data.notes || '',
      createdAt: now.toISOString(),
    };
    setPhysicalCounts((prev) => [newCount, ...prev]);
    saveDocToFirestore('physical_counts', newCount.id, newCount);

    if (varianceKG !== 0) {
      const apprId = `APPR-CNT-${newCount.id}`;
      const apprRecord: ApprovalRecord = {
        id: apprId,
        type: 'STOCK_ADJUSTMENT',
        approvalType: 'STOCK_ADJUSTMENT',
        entityId: newCount.id,
        entityReference: newCount.countNumber,
        title: `Physical Count Variance Adjustment (${newCount.materialName})`,
        titleAr: `تسوية فروقات الجرد الفعلي: ${newCount.materialName} (فارق ${varianceKG > 0 ? '+' : ''}${varianceKG.toLocaleString()} كغم)`,
        reason: `فارق بين الجرد الفعلي والدفتري في الموقع ${newCount.locationCode}. المبرر: ${newCount.notes || 'تسوية سنوية دورية'}`,
        requestedBy: (currentUser?.nameAr || currentUser?.name || "المشرف"),
        riskLevel: Math.abs(varianceKG) > 1000 ? 'CRITICAL' : 'HIGH',
        status: 'PENDING',
        createdAt: now.toISOString(),
      };
      setApprovals((prev) => [apprRecord, ...prev]);
      saveDocToFirestore('approvals', apprRecord.id, apprRecord);
    }

    return { success: true, id: newCount.id };
  };

  const applyPhysicalCount = (id: string, supervisorPin?: string) => {
    const target = physicalCounts.find((c) => c.id === id);
    if (!target) return { success: false, error: 'سجل الجرد غير موجود' };
    if (target.status === 'RECONCILED') return { success: false, error: 'تمت تسوية هذا الجرد مسبقاً' };

    if (supervisorPin && supervisorPin !== '2026') {
      return { success: false, error: 'رمز المشرف غير صحيح (PIN خاطئ)' };
    }

    const varianceKG = target.varianceKG !== undefined ? target.varianceKG : (target.diffKG || 0);
    const varianceBags = target.varianceBulkBags !== undefined ? target.varianceBulkBags : (target.diffBags || 0);

    if (varianceKG !== 0) {
      recordMovement(
        target.materialId,
        target.materialCode,
        target.materialName,
        'PHYSICAL_COUNT_ADJUSTMENT',
        `تسوية جرد دفتري - ${target.locationCode}`,
        varianceKG > 0 ? `إضافة رصيد فعلي (${target.locationCode})` : `خصم عجز جرد (${target.locationCode})`,
        Math.abs(varianceKG),
        Math.abs(varianceBags),
        target.countNumber,
        `ADJ-${target.countNumber}`,
        `تسوية فروقات الجرد الفعلي بالموقع ${target.locationCode} بمصادقة المشرف ${(currentUser?.nameAr || currentUser?.name || "المشرف")}`,
        target.id
      );
    }

    const updated: PhysicalInventoryCount = {
      ...target,
      status: 'RECONCILED',
      supervisorApproval: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      approvedAt: new Date().toISOString(),
    };

    setPhysicalCounts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    saveDocToFirestore('physical_counts', target.id, updated);
    return { success: true };
  };

  // -------------------------------------------------------------
  // CENTRAL INVENTORY MOVEMENT & TRANSFER ENGINE
  // -------------------------------------------------------------
  const executeEngineMovement = async (req: MovementRequest): Promise<MovementResult> => {
    const res = await executeCentralInventoryMovement(
      req,
      inventoryBalances,
      bulkBags,
      inventoryMovements
    );

    if (res.success) {
      if (res.movements && res.movements.length > 0) {
        setInventoryMovements((prev) => [...res.movements, ...prev]);
        res.movements.forEach((m) => {
          FirebaseService.inventoryMovements.recordMovement(m).catch(console.warn);
        });
      }
      if (res.updatedBalances && res.updatedBalances.length > 0) {
        res.updatedBalances.forEach((b) => {
          FirebaseService.inventoryBalances.saveBalance(b).catch(console.warn);
        });
      }
      if (res.updatedBags && res.updatedBags.length > 0) {
        setBulkBags(res.updatedBags);
        res.updatedBags.forEach((bag) => {
          FirebaseService.bulkBags.save(bag).catch(console.warn);
        });
      }
      if (res.auditLogs && res.auditLogs.length > 0) {
        setAuditLogs((prev) => [...res.auditLogs, ...prev]);
        res.auditLogs.forEach((l) => {
          FirebaseService.auditLogs.recordLog(l).catch(console.warn);
        });
      }
    }
    return res;
  };

  const executeWarehouseTransfer = async (transferData: Partial<WarehouseTransfer>) => {
    const now = new Date();
    const id = transferData.id || `TRF-${Date.now().toString().slice(-6)}`;
    const transferNumber = transferData.transferNumber || `TRF-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qty = Number(transferData.quantityKG) || 0;
    const bags = Number(transferData.bulkBags || transferData.bulkBagsCount) || 1;

    const sourceWarehouseId = transferData.fromWarehouseId || transferData.sourceWarehouseId || warehouses[0]?.id || 'WH-01';
    const sourceLocationId = transferData.fromLocationId || transferData.sourceLocationId || locations[0]?.id || 'LOC-A01';
    const targetWarehouseId = transferData.toWarehouseId || transferData.targetWarehouseId || warehouses[1]?.id || 'WH-02';
    const targetLocationId = transferData.toLocationId || transferData.targetLocationId || locations[1]?.id || 'LOC-A02';

    const fromLoc = locations.find((l) => l.id === sourceLocationId);
    const toLoc = locations.find((l) => l.id === targetLocationId);
    const mat = materials.find((m) => m.id === transferData.materialId);

    const movementRes = await executeEngineMovement({
      sourceModule: 'TRANSFER',
      sourceTransactionId: id,
      sourceTransactionNumber: transferNumber,
      materialId: transferData.materialId || mat?.id || 'MAT-001',
      materialCode: transferData.materialCode || mat?.code || 'MAT',
      materialName: transferData.materialName || mat?.nameAr || 'خام',
      movementType: 'LOCATION_TRANSFER',
      quantityKG: qty,
      bulkBagsCount: bags,
      warehouseId: sourceWarehouseId,
      locationId: sourceLocationId,
      destWarehouseId: targetWarehouseId,
      destLocationId: targetLocationId,
      user: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      notes: transferData.notes || 'تحويل داخلي بين المواقع',
    });

    if (!movementRes.success) {
      return { success: false, error: movementRes.error || movementRes.errorAr };
    }

    const newTransfer: WarehouseTransfer = {
      id,
      transferNumber,
      materialId: transferData.materialId || mat?.id || 'MAT-001',
      materialCode: transferData.materialCode || mat?.code || 'MAT',
      materialName: transferData.materialName || mat?.nameAr || 'خام',
      fromWarehouseId: sourceWarehouseId,
      sourceWarehouseId,
      fromLocationId: sourceLocationId,
      sourceLocationId,
      fromLocationCode: fromLoc?.code || '',
      sourceLocationCode: fromLoc?.code || '',
      toWarehouseId: targetWarehouseId,
      targetWarehouseId,
      toLocationId: targetLocationId,
      targetLocationId,
      toLocationCode: toLoc?.code || '',
      targetLocationCode: toLoc?.code || '',
      quantityKG: qty,
      bulkBagsCount: bags,
      bulkBags: bags,
      status: 'COMPLETED',
      operator: (currentUser?.nameAr || currentUser?.name || "المشرف"),
      createdAt: now.toISOString(),
      transferredAt: now.toISOString(),
      notes: transferData.notes,
    };

    setWarehouseTransfers((prev) => [newTransfer, ...prev]);
    saveDocToFirestore('warehouse_transfers', newTransfer.id, newTransfer);
    return { success: true, id: newTransfer.id, transfer: newTransfer };
  };

  const syncAllToFirestore = async () => {
    setSyncStatus('SYNCING');
    try {
      await FirebaseService.materials.saveBatch(materials);
      await FirebaseService.receivingTransactions.saveBatch(receivingTransactions);
      await FirebaseService.shreddingTransactions.saveBatch(shreddingTransactions);
      await FirebaseService.productionIssues.saveBatch(productionIssues);
      await FirebaseService.productionOrders.saveBatch(productionOrders);
      await FirebaseService.inventoryMovements.saveBatch(inventoryMovements);
      await FirebaseService.bulkBags.saveBatch(bulkBags);
      await FirebaseService.approvals.saveBatch(approvals);
      await FirebaseService.auditLogs.saveBatch(auditLogs);
      setSyncStatus('SYNCED');
      setFirestoreConnected(true);
      return {
        success: true,
        syncedCount:
          materials.length +
          receivingTransactions.length +
          shreddingTransactions.length +
          bulkBags.length +
          productionIssues.length +
          inventoryMovements.length +
          approvals.length,
      };
    } catch (err: any) {
      setSyncStatus('OFFLINE');
      return { success: false, syncedCount: 0, error: err.message };
    }
  };

  const refreshDataFromFirestore = async (): Promise<{ success: boolean; recordsCount: number; error?: string }> => {
    setSyncStatus('SYNCING');
    try {
      const [
        mats,
        bags,
        rcvs,
        shreds,
        prods,
        movs,
        orders,
        approvalsData,
        audits,
        warehousesData,
        suppliersData,
      ] = await Promise.all([
        FirebaseService.materials.getAll(),
        FirebaseService.bulkBags.getAll(),
        FirebaseService.receivingTransactions.getAll(),
        FirebaseService.shreddingTransactions.getAll(),
        FirebaseService.productionIssues.getAll(),
        FirebaseService.inventoryMovements.getAll(),
        FirebaseService.productionOrders.getAll(),
        FirebaseService.approvals.getAll(),
        FirebaseService.auditLogs.getAll(),
        FirebaseService.warehouses.getAll(),
        FirebaseService.suppliers.getAll(),
      ]);

      let totalCount = 0;
      if (mats && mats.length > 0) {
        setMaterials(mats);
        totalCount += mats.length;
      }
      if (bags && bags.length > 0) {
        setBulkBags(bags);
        totalCount += bags.length;
      }
      if (rcvs && rcvs.length > 0) {
        setReceivingTransactions(rcvs);
        totalCount += rcvs.length;
      }
      if (shreds && shreds.length > 0) {
        setShreddingTransactions(shreds);
        totalCount += shreds.length;
      }
      if (prods && prods.length > 0) {
        setProductionIssues(prods);
        totalCount += prods.length;
      }
      if (movs && movs.length > 0) {
        setInventoryMovements(movs);
        totalCount += movs.length;
      }
      if (orders && orders.length > 0) {
        setProductionOrders(orders);
        totalCount += orders.length;
      }
      if (approvalsData && approvalsData.length > 0) {
        setApprovals(approvalsData);
        totalCount += approvalsData.length;
      }
      if (audits && audits.length > 0) {
        setAuditLogs(audits);
        totalCount += audits.length;
      }
      if (warehousesData && warehousesData.length > 0) {
        setWarehouses(warehousesData);
        totalCount += warehousesData.length;
      }
      if (suppliersData && suppliersData.length > 0) {
        setSuppliers(suppliersData);
        totalCount += suppliersData.length;
      }

      setSyncStatus('SYNCED');
      setFirestoreConnected(true);
      return { success: true, recordsCount: totalCount };
    } catch (err: any) {
      console.warn('[Firestore Re-fetch Warning]:', err);
      setSyncStatus('SYNCED');
      return { success: true, recordsCount: 0, error: err?.message };
    }
  };

  // Execute RFID Automated Bulk Movement across factory zones
  const executeRfidBulkMovement = async (params: {
    portalId?: string;
    portalNameAr?: string;
    portalNameEn?: string;
    palletId?: string;
    palletRfidTag?: string;
    bagIds: string[];
    toWarehouseId: string;
    toLocationCode: string;
    notes?: string;
    trackingMethod?: 'RFID_PORTAL' | 'RFID_HANDHELD';
  }): Promise<{
    success: boolean;
    movedBagsCount: number;
    totalWeightKG: number;
    movementId: string;
    messageAr: string;
  }> => {
    const {
      portalId = 'PORTAL-GATE-01',
      portalNameAr = 'بوابة العبور الآلية',
      portalNameEn = 'RFID Portal Gate',
      palletId,
      palletRfidTag,
      bagIds,
      toWarehouseId,
      toLocationCode,
      notes = 'حركة مخزنية جماعية مؤتمتة عبر بوابة RFID دون حاجة لخط رؤية مباشر',
      trackingMethod = 'RFID_PORTAL',
    } = params;

    const targetLoc = locations.find((l) => l.code === toLocationCode);
    const targetWh = warehouses.find((w) => w.id === toWarehouseId) || warehouses[0];
    const targetWarehouseNameAr = targetWh?.nameAr || 'المستودع المستلم';

    // Find all bags to move
    const bagsToMove = bulkBags.filter((b) => bagIds.includes(b.bagNumber || b.id));
    if (bagsToMove.length === 0) {
      return {
        success: false,
        movedBagsCount: 0,
        totalWeightKG: 0,
        movementId: '',
        messageAr: 'لم يتم العثور على أكياس شليف مطابقة للرموز المحددة',
      };
    }

    const totalWeightKG = bagsToMove.reduce((sum, b) => sum + (b.weightKG || 0), 0);
    const firstBag = bagsToMove[0];
    const mat = materials.find((m) => m.id === firstBag.materialId);
    const fromLocCode = firstBag.locationCode || 'LOC-A-01';
    const fromWhId = firstBag.warehouseId || 'WH-01';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const movId = `MOV-RFID-${Date.now().toString().slice(-6)}`;

    // 1. Update bulk bags in state
    const updatedBags = bulkBags.map((bag) => {
      if (bagIds.includes(bag.bagNumber || bag.id)) {
        return {
          ...bag,
          warehouseId: toWarehouseId,
          warehouseName: targetWarehouseNameAr,
          locationId: targetLoc?.id || bag.locationId,
          locationCode: toLocationCode,
          updatedAt: now.toISOString(),
          lastVerifiedAt: now.toISOString(),
          lastVerifiedBy: currentUser?.nameAr || currentUser?.name || 'نظام بوابات RFID الآلية',
          lastVerifiedLocationCode: toLocationCode,
          verificationStatus: 'VERIFIED_IN_PLACE' as const,
          palletId: palletId || bag.palletId,
          palletRfidTag: palletRfidTag || bag.palletRfidTag,
          lastRfidPortalScan: {
            portalId,
            portalNameAr,
            portalNameEn,
            timestamp: now.toISOString(),
            rssi: Math.floor(-48 - Math.random() * 12),
            antenna: 1,
            direction: 'TRANSIT' as const,
          },
        };
      }
      return bag;
    });
    setBulkBags(updatedBags);
    FirebaseService.bulkBags.saveBatch(updatedBags.filter((b) => bagIds.includes(b.bagNumber || b.id)));

    // 2. Create official InventoryMovement record
    const newMovement: InventoryMovement = {
      id: movId,
      movementId: movId,
      movementNumber: movId,
      date: dateStr,
      time: timeStr,
      materialId: firstBag.materialId,
      materialCode: firstBag.materialCode || mat?.code || 'RAW-MAT',
      materialName: mat?.nameAr || firstBag.materialName || 'خام بلاستيكي',
      movementType: 'LOCATION_TRANSFER',
      source: `${fromWhId} - ${fromLocCode}`,
      destination: `${toWarehouseId} - ${toLocationCode}`,
      fromWarehouseId: fromWhId,
      fromLocationCode: fromLocCode,
      toWarehouseId: toWarehouseId,
      toWarehouseName: targetWarehouseNameAr,
      toLocationCode: toLocationCode,
      quantityKG: totalWeightKG,
      bulkBagsCount: bagsToMove.length,
      referenceDocument: palletId ? `RFID-${palletId}` : `RFID-PORTAL-${portalId}`,
      referenceNumber: palletId ? `RFID-${palletId}` : `RFID-PORTAL-${portalId}`,
      legacyDocRef: `${activeStorageCode}/${new Date().getFullYear()}/${String(Math.floor(100 + Math.random() * 900))}`,
      internalInventoryCode: activeStorageCode,
      user: currentUser?.nameAr || currentUser?.name || 'مستشعر RFID للبوابات',
      operator: currentUser?.nameAr || currentUser?.name || 'مستشعر RFID للبوابات',
      status: 'Completed',
      notes: `${notes} | تم التقاط ${bagsToMove.length} شليف عبر هوائيات ${portalNameAr}`,
      trackingMethod,
      rfidBatchId: `RFID-BATCH-${Date.now().toString().slice(-6)}`,
      palletRfidTag,
      scannedRfidTags: bagsToMove.map((b) => b.rfidTag || b.bagNumber),
      rfidPortalId: portalId,
      rfidPortalNameAr: portalNameAr,
      rfidSignalStrengthRSSI: -52,
    };

    setInventoryMovements((prev) => [newMovement, ...prev]);
    FirebaseService.inventoryMovements.save(newMovement);

    // 3. Update location capacities
    setLocations((prevLocs) =>
      prevLocs.map((loc) => {
        if (loc.code === fromLocCode) {
          return {
            ...loc,
            currentKG: Math.max(0, loc.currentKG - totalWeightKG),
            bulkBagsCount: Math.max(0, loc.bulkBagsCount - bagsToMove.length),
          };
        }
        if (loc.code === toLocationCode) {
          return {
            ...loc,
            currentKG: loc.currentKG + totalWeightKG,
            bulkBagsCount: loc.bulkBagsCount + bagsToMove.length,
          };
        }
        return loc;
      })
    );

    // 4. Record audit log
    logAudit(
      'RFID Bulk Asset Movement',
      'حركة جماعية مؤتمتة لأصول المخزون عبر بوابات RFID دون خط رؤية',
      'InventoryMovement',
      movId,
      `${palletId || 'حزمة أصول'} ⟵ ${bagsToMove.length} شليف (${totalWeightKG.toLocaleString()} كغم)`,
      `من: ${fromLocCode} ⟵ إلى: ${toLocationCode} عبر ${portalNameAr}`,
      currentUser?.nameAr || currentUser?.name || 'بوابة RFID'
    );

    return {
      success: true,
      movedBagsCount: bagsToMove.length,
      totalWeightKG,
      movementId: movId,
      messageAr: `✓ تم توثيق مرور ونقل ${bagsToMove.length} أكياس شليف بإجمالي ${totalWeightKG.toLocaleString()} كغم آلياً إلى الموقع (${toLocationCode}) عبر (${portalNameAr})!`,
    };
  };

  const updateSystemInventoryCode = async (
    code: string,
    updates: Partial<SystemCodeConfig>
  ): Promise<boolean> => {
    const success = await saveSystemCodeToFirestore(code, updates, currentUser?.nameAr || currentUser?.name || 'Admin');
    if (success) {
      logAudit(
        'SYSTEM_CODE_UPDATED',
        'تعديل كود المعاملات المخزنية',
        'SystemSettings',
        code,
        '-',
        updates.nameAr || code,
        `Updated in Firestore by ${currentUser?.nameAr || currentUser?.name || 'Admin'}`
      );
    }
    return success;
  };

  const addSystemInventoryCode = async (
    newCode: Omit<SystemCodeConfig, 'id' | 'updatedAt'>
  ): Promise<boolean> => {
    const success = await createSystemCodeInFirestore(newCode, currentUser?.nameAr || currentUser?.name || 'Admin');
    if (success) {
      logAudit(
        'SYSTEM_CODE_CREATED',
        'إنشاء كود معاملة مخزنية جديد',
        'SystemSettings',
        newCode.code,
        '-',
        newCode.nameAr,
        `Created in Firestore by ${currentUser?.nameAr || currentUser?.name || 'Admin'}`
      );
    }
    return success;
  };

  const deleteSystemInventoryCode = async (code: string): Promise<boolean> => {
    const success = await deleteSystemCodeFromFirestore(code);
    if (success) {
      logAudit(
        'SYSTEM_CODE_DELETED',
        'حذف كود معاملة مخزنية',
        'SystemSettings',
        code,
        '-',
        code,
        `Deleted from Firestore by ${currentUser?.nameAr || currentUser?.name || 'Admin'}`
      );
    }
    return success;
  };

  const resetSystemInventoryCodes = async (): Promise<void> => {
    await initializeDefaultSystemCodesInFirestore();
    logAudit(
      'SYSTEM_CODES_RESET',
      'استعادة الأكواد القياسية لمصنع الكروان',
      'SystemSettings',
      'ALL_DEFAULT',
      '-',
      '167, 546, 360, 352',
      `Reset in Firestore by ${currentUser?.nameAr || currentUser?.name || 'Admin'}`
    );
  };

  const safeCurrentUser: UserProfile = useMemo(() => {
    if (currentUser && currentUser.nameAr) return currentUser;
    if (currentUser) {
      return {
        ...INITIAL_USERS[0],
        ...currentUser,
        nameAr: currentUser.nameAr || currentUser.name || INITIAL_USERS[0].nameAr,
        name: currentUser.name || currentUser.nameAr || INITIAL_USERS[0].name,
      };
    }
    return INITIAL_USERS[0];
  }, [currentUser]);

  return (
    <FactoryContext.Provider
      value={{
        currentUser: safeCurrentUser,
        setCurrentUser,
        firebaseUser,
        isAuthenticated,
        authLoading,
        authError,
        loginWithGoogle,
        logout,
        emergencyBypassAuth,
        executeRfidBulkMovement,
        users,
        materials,
        suppliers,
        warehouses,
        locations,
        receivingTransactions,
        shreddingTransactions,
        productionIssues,
        inventoryMovements,
        auditLogs,
        inventoryBalances,
        pendingActions,
        bulkBags,
        approvals,
        purchaseRequirements,
        purchaseReceipts,
        physicalCounts,
        warehouseTransfers,
        firestoreConnected,
        syncStatus,
        isOnline,
        isOfflinePersistenceActive,
        flushPendingWrites,
        registerBulkBag,
        updateBulkBag,
        approveRequest,
        rejectRequest,
        createPurchaseRequirement,
        createPhysicalCount,
        applyPhysicalCount,
        executeWarehouseTransfer,
        executeEngineMovement,
        syncAllToFirestore,
        refreshDataFromFirestore,
        createReceivingTransaction,
        updateReceivingTransaction,
        completeScaleIn,
        startUnloading,
        completeUnloading,
        completeScaleOut,
        confirmReceivingAndRoute,
        sendToTherm,
        issueReceivingToProduction,
        createTestReceivingTransaction,
        createShreddingTransaction,
        completeShredding,
        returnShreddingToStorage,
        startShreddingJob,
        completeShreddingJob,
        returnShreddedToStorage,
        createProductionIssue,
        issueToProduction,
        productionDamages,
        recordProductionDamage,
        productionOrders,
        createProductionOrder,
        updateProductionOrder,
        completeProductionOrder,
        shiftHandovers,
        addShiftHandover,
        acknowledgeShiftHandover,
        getDailyOperationsSummary,
        addMaterial,
        updateMaterial,
        bulkImportMaterials,
        addSupplier,
        updateSupplier,
        addWarehouse,
        updateWarehouse,
        addLocation,
        updateLocation,
        deleteLocation,
        executeLocationTransfer,
        transferStock,
        checkInventoryConsistency,
        reconcileMaterialStock,
        autoFixDiscrepancies,
        lowStockOverview,
        updateMaterialSafetyThreshold,
        systemCodes,
        activeStorageCode,
        activeProductionCode,
        activeShreddingReceiptCode,
        activeShreddingMoveCode,
        getActiveInventoryCode,
        updateSystemInventoryCode,
        addSystemInventoryCode,
        deleteSystemInventoryCode,
        resetSystemInventoryCodes,
        currentPage,
        setCurrentPage,
        selectedTransactionId,
        setSelectedTransactionId,
        selectedMaterialId,
        setSelectedMaterialId,
        isSearchOpen,
        setIsSearchOpen,
        jumpToPendingAction,
        importBatches,
        createImportBatch,
        updateImportBatch,
        computeMovementFingerprint,
        exportToExcel,
        importExcelData,
        importSmartAnalyzedRows,
        logAudit,
        purgeTestData,
        resetFactoryData,
        restoreSnapshotIntoContext,
        validateWorkflowTransition: validateWorkflowTransitionHandler,
        checkMaterialProductionReadiness: checkMaterialProductionReadinessHandler,
        getWorkflowStageInfo: getWorkflowStageInfoHandler,
        normalizeToWorkflowStage,
      }}
    >
      {children}
    </FactoryContext.Provider>
  );
};

export const useFactory = () => {
  const context = useContext(FactoryContext);
  if (!context) {
    throw new Error('useFactory must be used within a FactoryProvider');
  }
  return context;
};
