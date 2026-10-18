/**
 * AL-KARWAN FACTORY CONTROL SYSTEM
 * شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
 * Global Type Definitions & Data Contracts
 * 
 * General-Purpose Multi-Tenant Warehouse Platform Contracts
 */

export * from './types/tenant';
export * from './types/warehouse';

export type Language = 'ar' | 'en';

export type UserRole =
  | 'Admin'
  | 'Storage Manager'
  | 'Storage Worker'
  | 'Production'
  | 'Shredding'
  | 'Management'
  // Existing system aliases
  | 'SUPER_ADMIN'
  | 'Administrator'
  | 'Warehouse Manager'
  | 'Storekeeper'
  | 'Warehouse Operator'
  | 'Scale Operator'
  | 'Shredding Operator'
  | 'Production Operator'
  | 'Supervisor'
  | 'General Supervisor'
  | 'Viewer';

export interface UserProfile {
  id: string;
  organizationId?: string; // Tenant isolation (defaults to 'org_alkarwan')
  name: string;
  nameAr: string;
  role: UserRole;
  badgeNumber: string;
  department: string;
  departmentAr: string;
  avatarColor: string;
  email?: string;
  uid?: string;
  photoURL?: string;
  lastLogin?: string;
  assignedWarehouse?: string;
  assignedWarehouseAr?: string;
}

export type TransactionStatus =
  | 'DRAFT'
  | 'SCALE_IN_COMPLETED'
  | 'UNLOADING'
  | 'UNLOADING_COMPLETED'
  | 'SCALE_OUT_COMPLETED'
  | 'RECEIVED'
  | 'WAITING_FOR_THERM'
  | 'IN_THERM'
  | 'THERM_COMPLETED'
  | 'RETURNED_TO_STORAGE'
  | 'READY_FOR_PRODUCTION'
  | 'ISSUED_TO_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELLED'
  // Title-case aliases for existing records
  | 'Draft'
  | 'Scale In Completed'
  | 'Unloading'
  | 'Unloading Completed'
  | 'Scale Out Completed'
  | 'Received'
  | 'Waiting for Shredding'
  | 'In Shredding'
  | 'Shredding Completed'
  | 'Returned to Storage'
  | 'Ready for Production'
  | 'Issued to Production'
  | 'Completed'
  | 'Cancelled';

export interface ReceivingEvent {
  id: string;
  receivingId: string;
  timestamp: string; // ISO string e.g. "2026-09-08T08:14:00Z"
  time: string; // e.g. "08:14"
  action: string;
  actionAr: string;
  performedBy: string;
  role?: string;
  statusBefore?: TransactionStatus;
  statusAfter: TransactionStatus;
  details?: string;
  weightKG?: number;
  bulkBags?: number;
}

export type MovementType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN'
  | 'RETURN_TO_STORAGE'
  | 'DAMAGE'
  | 'PRODUCTION_DAMAGE'
  | 'SHREDDING_INPUT'
  | 'SHREDDING_OUTPUT'
  | 'PRODUCTION_ISSUE'
  | 'PRODUCTION_INPUT'
  | 'PRODUCTION_OUTPUT'
  | 'PRODUCTION_RETURN'
  | 'ADJUSTMENT'
  | 'LOCATION_TRANSFER'
  | 'PHYSICAL_COUNT_ADJUSTMENT'
  | 'OPENING_BALANCE'
  // Legacy aliases
  | 'RECEIVING'
  | 'TRANSFER'
  | 'Transfer / تحويل'
  | 'SHREDDING ISSUE'
  | 'SHREDDING RETURN'
  | 'SHREDDING_ISSUE'
  | 'SHREDDING_RETURN'
  | 'PRODUCTION ISSUE';

export type MaterialCategory =
  | 'Raw Plastic / مواد خام'
  | 'Flakes / رقائق'
  | 'Scrap & Trims / سكراب وهوالك'
  | 'Shredded Granules / مجروش ومفروم'
  | 'Masterbatch & Additives / ملونات وإضافات'
  | 'Finished Sheets / ألواح نهائية'
  | 'Finished Cups / أكواب نهائية';

export interface MaterialItem {
  id: string;
  organizationId?: string; // Tenant isolation
  code: string;
  nameAr: string;
  nameEn: string;
  aliases?: string[];
  category: MaterialCategory | string;
  unit: 'KG' | 'TON' | 'PCS' | string;
  defaultWarehouseId: string;
  defaultLocationId: string;
  requiresShredding: boolean;
  minStockKG: number;
  maxStockKG: number;
  minStockLevelKG?: number;
  maxStockLevelKG?: number;
  descriptionAr?: string;
  descriptionEn?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
  status?: 'ACTIVE' | 'QUARANTINED' | 'EXPIRED' | 'HOLD' | 'INACTIVE' | string;
  isQuarantined?: boolean;
  isExpired?: boolean;
  expiryDate?: string;
  quarantineReason?: string;
  quarantineDate?: string;
  flaggedBy?: string;
  disposition?: 'SHREDDING_QUEUE' | 'DISPOSED' | 'QUARANTINE' | 'QUARANTINED';
}

export interface Supplier {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  contactPerson: string;
  phone: string;
  address: string;
  materialTypes: string[];
  status: 'Active' | 'Inactive' | 'Suspended';
  notes?: string;
  totalDeliveriesCount: number;
  totalKGDelivered: number;
}

export interface WarehouseLocation {
  id: string;
  organizationId?: string; // Tenant isolation
  warehouseId: string;
  warehouseNameAr: string;
  warehouseNameEn: string;
  zone: string;
  code: string;
  referenceCode?: string; // Configurable internal reference code (e.g. 167 for Storage, 546 for Production)
  nameAr: string;
  nameEn: string;
  capacityKG: number;
  currentKG: number;
  bulkBagsCount: number;
  maxBags: number;
  materialTypesAllowed: string[];
}

export interface Warehouse {
  id: string;
  organizationId?: string; // Tenant isolation
  code: string;
  referenceCode?: string; // Configurable internal reference code (e.g. 167 for Storage, 546 for Production)
  nameAr: string;
  nameEn: string;
  type: 'Raw' | 'Shredding' | 'Production' | 'FinishedGoods' | 'Regrind';
  totalCapacityKG: number;
  locationsCount: number;
  manager: string;
  managerAr?: string;
  storekeeper?: string;
  storekeeperAr?: string;
  active: boolean;
}

export type MaterialCondition = 'Clean & Sorted' | 'Mixed Quality' | 'Contaminated' | 'Damp / Wet' | 'Standard Prime';

export interface ReceivingTransaction {
  id: string;
  organizationId?: string; // Tenant isolation
  transactionNumber: string; // e.g. RCV-2026-0842
  legacyDocumentNumber: string; // Legacy Doc #546 (استلام مواد خامات)
  date: string;
  time: string;
  supplierId: string;
  supplierName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone?: string;
  scaleInWeightKG: number;
  unloadWeightKG?: number;
  scaleOutWeightKG: number;
  netReceivedWeightKG: number;
  bulkBagsCount: number; // شلايف
  targetWarehouseId: string;
  targetLocationId: string;
  targetLocationCode: string;
  materialCondition: MaterialCondition;
  requiresShredding: boolean;
  route?: 'READY_SHREDDED' | 'NOT_SHREDDED';
  purchaseReference?: string;
  status: TransactionStatus;
  operator: string;
  supervisor: string;
  notes?: string;
  unloadingBay?: string;
  scaleInTime?: string;
  unloadingStartTime?: string;
  unloadingEndTime?: string;
  scaleOutTime?: string;
  shreddingTransactionId?: string;
  issuedToProductionId?: string;
  isTestTransaction?: boolean;
  timeline?: ReceivingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ShreddingTransaction {
  id: string;
  shreddingNumber: string; // e.g. THM-2026-0318
  sourceReceivingId?: string;
  sourceReceivingNumber?: string;
  legacyDocumentNumber: string; // Legacy Doc #360 (استلام مخزن الثرم) or #352
  materialId: string;
  materialCode: string;
  materialName: string;
  inputKG: number;
  bulkBagsInput: number; // شلايف مدخلة
  shreddingStart: string;
  shreddingEnd: string;
  outputKG: number;
  bulkBagsOutput: number; // شلايف مخرجة
  productionDamageKG: number; // تالف إنتاج
  wasteKG?: number; // هوالك وفواقد
  remainingKG?: number; // المتبقي قيد الثرم: Input - Output - Damage - Waste
  varianceKG: number; // Input - Output - Damage
  variancePercentage: number;
  isAbnormalVariance: boolean;
  operator: string;
  supervisor: string;
  machineId: string;
  sourceLocationId: string;
  sourceLocationCode: string;
  destinationWarehouseId: string;
  destinationLocationId: string;
  destinationLocationCode: string;
  status: TransactionStatus;
  notes?: string;
  returnToStorageTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionIssue {
  id: string;
  issueNumber: string; // e.g. ISS-2026-0512
  legacyDocumentNumber: string; // Legacy Doc #167 (صادر مواد خامات)
  productionOrderNumber: string; // e.g. PO-8841
  machineLine: string; // e.g. "Extruder Line 1", "Sheet Extrusion B", "Cup Thermoforming Line 3"
  materialId: string;
  materialCode: string;
  materialName: string;
  warehouseId: string;
  locationId: string;
  locationCode: string;
  quantityKG: number;
  bulkBagsCount: number; // شلايف
  stockBeforeKG: number;
  stockAfterKG: number;
  operator: string;
  supervisor: string;
  date: string;
  time: string;
  shift: 'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي';
  status: 'Completed' | 'Draft' | 'Cancelled';
  notes?: string;
  createdAt: string;
}

export interface ProductionDamageRecord {
  id: string;
  damageNumber: string; // e.g. DMG-2026-004
  date: string;
  time: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  quantityKG: number;
  bulkBagsCount: number;
  machineLine: string;
  operator: string;
  supervisor: string;
  shift: string;
  reason: string;
  disposition: 'SHREDDING_QUEUE' | 'DISPOSED' | 'QUARANTINE';
  dispositionAr: string;
  warehouseId?: string;
  locationId?: string;
  locationCode?: string;
  notes?: string;
  createdAt: string;
}

export type ProductionOrderStatus =
  | 'DRAFT'
  | 'READY'
  | 'IN_PRODUCTION'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ProductionOrder {
  id: string;
  orderNumber: string; // e.g. PO-2026-0881
  date: string;
  productName: string; // e.g. "أكواب بلاستيكية 250 مل شفافة (PET Cups 250ml)"
  productCode?: string;
  requiredMaterialId: string;
  requiredMaterialCode: string;
  requiredMaterialName: string;
  plannedKG: number;
  actualInputKG: number;
  actualProductionKG: number;
  productionDamageKG: number;
  remainingKG: number;
  shift: string;
  machineLine: string;
  operator: string;
  supervisor: string;
  status: ProductionOrderStatus;
  notes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ShiftHandoverRecord {
  id: string;
  handoverNumber: string; // e.g. HO-2026-0902-1
  date: string;
  shiftFrom: string;
  shiftTo: string;
  departingSupervisor: string;
  incomingSupervisor: string;
  timestamp: string;
  completedTasks: string[];
  inProgressTasks: string[];
  remainingWork: string[];
  pendingActionsSummary: string;
  reportedProblems: string[];
  nextShiftInstructions: string;
  thermSummary: {
    inputKG: number;
    outputKG: number;
    remainingKG: number;
  };
  productionSummary: {
    inputKG: number;
    outputKG: number;
    damageKG: number;
  };
  storageSummary: {
    inKG: number;
    outKG: number;
    balanceKG: number;
  };
  status: 'DRAFT' | 'SUBMITTED' | 'ACKNOWLEDGED';
  acknowledgedAt?: string;
  createdAt: string;
}

export interface DailySectionMetrics {
  todayInKG: number;
  todayOutKG: number;
  todayResultKG: number;
  currentRemainingKG: number;
  bulkBagsIn: number;
  bulkBagsOut: number;
  operationsCount: number;
}

export interface DailyOperationsSummary {
  date: string;
  shift?: string;
  therm: DailySectionMetrics;
  production: DailySectionMetrics;
  storage: DailySectionMetrics;
}

export interface InventoryConsistencyReport {
  materialId: string;
  materialCode: string;
  materialName: string;
  ledgerKG: number;
  storedKG: number;
  diffKG: number;
  ledgerBags: number;
  storedBags: number;
  diffBags: number;
  isConsistent: boolean;
  status: 'MATCH' | 'DISCREPANCY';
  lastChecked: string;
}

export interface MaterialReconciliationItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  category: string;
  unit: string;

  // Inflows: (Opening + Receipts + Returns)
  openingKG: number;
  openingBags: number;
  receiptsKG: number;
  receiptsBags: number;
  returnsKG: number;
  returnsBags: number;
  totalInflowKG: number; // (Opening + Receipts + Returns)
  totalInflowBags: number;

  // Outflows: (Issues + Damage + Shredding)
  issuesKG: number;
  issuesBags: number;
  damageKG: number;
  damageBags: number;
  shreddingKG: number;
  shreddingBags: number;
  totalOutflowKG: number; // (Issues + Damage + Shredding)
  totalOutflowBags: number;

  // Adjustments and location transfers
  adjustmentsKG: number;
  adjustmentsBags: number;
  transfersNetKG: number;
  transfersNetBags: number;

  // Theoretical Balance: (Opening + Receipts + Returns) - (Issues + Damage + Shredding)
  formulaCalculatedKG: number;
  formulaCalculatedBags: number;
  theoreticalLedgerKG: number;
  theoreticalLedgerBags: number;

  // Stored Inventory Balance
  storedInventoryKG: number;
  storedInventoryBags: number;

  // Discrepancy details
  discrepancyKG: number; // storedInventoryKG - formulaCalculatedKG (or theoretical)
  discrepancyBags: number;
  hasDiscrepancy: boolean;
  status: 'MATCH' | 'DISCREPANCY';

  movementsCount: number;
  lastMovementDate: string;
}

export interface InventoryReconciliationSummary {
  totalMaterials: number;
  balancedCount: number;
  discrepanciesCount: number;
  totalOpeningKG: number;
  totalReceiptsKG: number;
  totalReturnsKG: number;
  totalInflowsKG: number;
  totalIssuesKG: number;
  totalDamageKG: number;
  totalShreddingKG: number;
  totalOutflowsKG: number;
  totalTheoreticalKG: number;
  totalStoredKG: number;
  netDiscrepancyKG: number;
  auditTimestamp: string;
  discrepancyItems: MaterialReconciliationItem[];
  allReportItems: MaterialReconciliationItem[];
}

export type ImportBatchStatus =
  | 'ANALYZING'
  | 'NEEDS_REVIEW'
  | 'READY'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'PARTIALLY_IMPORTED'
  | 'FAILED'
  | 'CANCELLED';

export interface ImportBatch {
  id: string; // e.g. BATCH-2026-0901-001
  fileName: string;
  uploadDateTime: string;
  uploadedBy: string;
  fileSize: string;
  sheets: string[];
  rowsRead: number;
  rowsAccepted: number;
  rowsWarning: number;
  rowsError: number;
  rowsExcluded: number;
  status: ImportBatchStatus;
  notes?: string;
  docType?: string;
  importedRowsCount?: number;
  totalKG?: number;
  totalBags?: number;
  fingerprint?: string;
}

export interface InventoryMovement {
  id: string;
  organizationId?: string; // Tenant isolation
  movementId: string; // MOV-09142
  movementNumber?: string; // alias for movementId
  date: string;
  time: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  movementType: MovementType;
  source: string;
  destination: string;
  sourceLocation?: string; // alias for source
  destinationLocation?: string; // alias for destination
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  fromLocationId?: string;
  fromLocationCode?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  toLocationId?: string;
  toLocationCode?: string;
  supplierName?: string;
  batchNumber?: string;
  truckNumber?: string;
  driverName?: string;
  quantityKG: number;
  bulkBagsCount: number; // شلايف
  referenceDocument: string; // e.g. RCV-2026-0842, THM-0318, PO-8841, 167, 546, 360, 352
  referenceNumber?: string; // alias for referenceDocument
  referenceDocNumber?: string; // alias
  legacyDocRef?: string;
  legacyDocumentNumber?: string; // alias
  internalInventoryCode?: string; // Configurable internal inventory code (e.g. 167, 546, 360, 352)
  user: string;
  operator?: string; // alias for user
  transactionId?: string;
  status: 'Completed' | 'Pending' | 'Reversed' | 'DUPLICATE' | 'Cancelled';
  notes?: string;

  // Source Traceability (Preserving original Excel origin)
  importBatchId?: string;
  sourceFileName?: string;
  sourceSheetName?: string;
  sourceRowNumber?: number;
  sourceDocumentNumber?: string;
  originalMaterialText?: string;
  originalMaterialCode?: string;
  originalSupplierText?: string;

  // Automated RFID Asset Tracking & Zone Portal Movement
  trackingMethod?: 'MANUAL' | 'BARCODE' | 'QR' | 'RFID_PORTAL' | 'RFID_HANDHELD';
  rfidBatchId?: string;
  palletRfidTag?: string;
  scannedRfidTags?: string[];
  rfidPortalId?: string;
  rfidPortalNameAr?: string;
  rfidSignalStrengthRSSI?: number;
  originalWeightValue?: number;
  originalBulkBagValue?: number;
  importTimestamp?: string;
  importedBy?: string;
  fingerprint?: string;
}

export interface InventoryBalance {
  id?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  category: MaterialCategory;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationCode: string;
  bulkBagsCount: number; // شلايف
  availableKG: number;
  reservedKG: number;
  issuedKG: number;
  totalBalanceKG: number;
  status: 'Optimal' | 'Low Stock' | 'Over Capacity' | 'Critical';
  lastMovementDate: string;
}

export type PendingActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PendingAction {
  id: string;
  priority: PendingActionPriority;
  transactionType: 'RECEIVING' | 'SHREDDING' | 'STORAGE' | 'PRODUCTION';
  transactionId: string;
  transactionNumber: string;
  legacyRef?: string;
  materialName: string;
  materialCode: string;
  currentStep: string;
  currentStepAr: string;
  missingStep: string;
  missingStepAr: string;
  date: string;
  time: string;
  responsibleUser: string;
  responsibleRole: UserRole;
  targetView: NavigationPage;
  targetEntityId?: string;
  daysPending: number;
  warningNote?: string;
  actionText?: string;
  actionTextAr?: string;
  stepKey?: 'UNLOAD' | 'SCALE_OUT' | 'CONFIRM_RECEIPT' | 'SEND_TO_THERM' | 'COMPLETE_THERM' | 'RETURN_TO_STORAGE' | 'ISSUE_TO_PRODUCTION' | 'APPROVE' | 'RECONCILE';
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  actionAr: string;
  entityType: string;
  entityId: string;
  date: string;
  time: string;
  oldValue?: string;
  newValue?: string;
  ipAddress: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  notes?: string;
}

export type NavigationPage =
  | 'dashboard'
  | 'daily_operations'
  | 'shift_handover'
  | 'operations'
  | 'warehouse_operations'
  | 'receiving'
  | 'scale_out'
  | 'unloading'
  | 'shredding'
  | 'storage'
  | 'production'
  | 'inventory'
  | 'bulk_bags'
  | 'rfid_tracking'
  | 'movement_ledger'
  | 'pending_actions'
  | 'approvals'
  | 'material_card'
  | 'materials_master'
  | 'suppliers'
  | 'warehouses'
  | 'reports'
  | 'excel_import'
  | 'historical_migration'
  | 'inventory_reconciler'
  | 'audit_log'
  | 'maintenance'
  | 'forecasting'
  | 'shift_optimizer'
  | 'quality_control'
  | 'virtual_stock_verifier'
  | 'maintenance_alerts'
  | 'energy_monitor'
  | 'system_admin'
  | 'organization_settings'
  | 'platform_admin'
  | 'company_onboarding'
  | 'business_management'
  | 'purchasing'
  | 'customers'
  | 'internal_requests'
  | 'billing'
  | 'advanced_warehouse'
  | 'smart_intelligence'
  | 'integrations'
  | 'webhooks';

export type MachineStatus = 'RUNNING' | 'MAINTENANCE_DUE' | 'UNDER_MAINTENANCE' | 'STANDBY' | 'DECOMMISSIONED';

export type MaintenanceTaskType = 'PREVENTIVE' | 'CORRECTIVE' | 'LUBRICATION' | 'CALIBRATION' | 'OVERHAUL';

export interface FactoryMachine {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  category: 'EXTRUSION' | 'SHREDDING' | 'THERMOFORMING' | 'UTILITY' | 'SCALE';
  sectionEn: string;
  sectionAr: string;
  currentOperatingHours: number;
  maintenanceThresholdHours: number;
  intervalHours: number;
  status: MachineStatus;
  lastMaintenanceDate: string;
  lastMaintenanceHours: number;
  assignedTechnician: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  installationDate: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface MaintenanceLogTask {
  id: string;
  machineId: string;
  machineNameEn: string;
  machineNameAr: string;
  taskTitleEn: string;
  taskTitleAr: string;
  taskType: MaintenanceTaskType;
  operatingHoursAtService: number;
  previousThresholdHours: number;
  newThresholdHours: number;
  completedDate: string;
  completedTime: string;
  performedBy: string;
  supervisorSignOff: string;
  downtimeHours: number;
  partsReplacedEn?: string;
  partsReplacedAr?: string;
  totalCostUSD?: number;
  notesEn?: string;
  notesAr?: string;
  status: 'COMPLETED' | 'VERIFIED';
}

// Predictive Maintenance & Proactive Analytics Types
export type PredictiveAlertLevel =
  | 'CRITICAL_FAILURE_IMMINENT'
  | 'PROACTIVE_SERVICE_REQUIRED'
  | 'SCHEDULED_ATTENTION'
  | 'HEALTHY';

export interface MachineWearIndicator {
  nameEn: string;
  nameAr: string;
  value: number; // 0 to 100%
  unit: string;
  threshold: number;
  status: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
}

export interface MachinePredictiveAnalysis {
  machineId: string;
  machineCode: string;
  nameEn: string;
  nameAr: string;
  category: 'EXTRUSION' | 'SHREDDING' | 'THERMOFORMING' | 'UTILITY' | 'SCALE';
  sectionEn: string;
  sectionAr: string;
  currentOperatingHours: number;
  maintenanceThresholdHours: number;
  intervalHours: number;
  assignedTechnician: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: MachineStatus;

  // Predictive calculations
  dailyRuntimeRateHours: number; // estimated hours run per day
  healthScore: number; // 0% to 100%
  degradationPercentage: number; // 0% to 100%
  failureProbability: number; // 0% to 100%

  // Estimated Time-to-Failure (TTF)
  estimatedTimeToFailureHours: number; // runtime hours remaining until critical breakdown
  estimatedTimeToFailureDays: number; // calendar days until breakdown at current daily rate
  estimatedFailureDate: string; // projected failure date (YYYY-MM-DD)
  proactiveServiceDeadlineDate: string; // target date for proactive intervention
  hoursUntilThreshold: number; // threshold - currentOperatingHours

  alertLevel: PredictiveAlertLevel;
  primaryFailureModeEn: string;
  primaryFailureModeAr: string;
  recommendedActionEn: string;
  recommendedActionAr: string;
  recommendedPartsEn: string;
  recommendedPartsAr: string;
  estimatedDowntimeAvoidedHours: number;
  estimatedCostSavingsUSD: number;

  wearIndicators: MachineWearIndicator[];
  confidenceScore: number; // e.g. 94%
}

export interface FleetPredictiveSummary {
  totalAnalyzed: number;
  averageHealthScore: number;
  criticalFailureImminentCount: number;
  proactiveServiceRequiredCount: number;
  scheduledAttentionCount: number;
  healthyCount: number;
  totalUnscheduledDowntimeAvoidedHours: number;
  totalEstimatedSavingsUSD: number;
  highRiskMachines: MachinePredictiveAnalysis[];
  proactiveQueue: MachinePredictiveAnalysis[];
}

// Equipment Usage Pattern & Maintenance Alerts Types
export type MaintenanceAlertSeverity = 'CRITICAL' | 'WARNING' | 'ATTENTION' | 'NORMAL';
export type MaintenanceIntervalStage = 'OVERDUE' | 'IMMINENT' | 'APPROACHING' | 'OPTIMAL';

export interface MaintenanceAlertNotification {
  id: string;
  machineId: string;
  machineCode: string;
  machineNameAr: string;
  machineNameEn: string;
  category: 'EXTRUSION' | 'SHREDDING' | 'THERMOFORMING' | 'UTILITY' | 'SCALE';
  sectionAr: string;
  sectionEn: string;
  severity: MaintenanceAlertSeverity;
  stage: MaintenanceIntervalStage;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  triggeredAt: string;
  currentOperatingHours: number;
  maintenanceThresholdHours: number;
  intervalHours: number;
  hoursOverdueOrRemaining: number; // positive if overdue, negative if remaining
  intervalProgressPct: number;
  recommendedActionAr: string;
  recommendedActionEn: string;
  recommendedPartsAr?: string;
  recommendedPartsEn?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  snoozedUntil?: string;
  workOrderCreated?: boolean;
  workOrderId?: string;
}

export interface EquipmentUsagePattern {
  machineId: string;
  machineCode: string;
  nameEn: string;
  nameAr: string;
  category: 'EXTRUSION' | 'SHREDDING' | 'THERMOFORMING' | 'UTILITY' | 'SCALE';
  sectionEn: string;
  sectionAr: string;
  currentOperatingHours: number;
  maintenanceThresholdHours: number;
  intervalHours: number;
  lastMaintenanceDate: string;
  lastMaintenanceHours: number;
  assignedTechnician: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: MachineStatus;

  // Interval metrics
  hoursSinceLastMaintenance: number;
  intervalProgressPct: number;
  hoursRemaining: number;
  isOverdue: boolean;
  isImpending: boolean;
  isApproaching: boolean;
  stage: MaintenanceIntervalStage;
  severity: MaintenanceAlertSeverity;

  // Usage telemetry & patterns
  dailyRuntimeHours: number;
  projectedDaysToService: number;
  projectedServiceDate: string;
  dutyCyclePattern: 'HEAVY_CONTINUOUS' | 'CYCLIC_BATCH' | 'VARIABLE_PEAK' | 'STANDBY';
  dutyCycleLabelAr: string;
  dutyCycleLabelEn: string;
  estimatedThroughputKG: number; // e.g. regrind output for shredder
  wearIndexPct: number;
  vibrationVelocityMmS: number;
  operatingTempC: number;
  specificWearMetric: {
    labelAr: string;
    labelEn: string;
    value: number;
    unit: string;
    threshold: number;
    status: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
  };
}

export interface MaintenanceAlertsSummary {
  totalMonitored: number;
  overdueCount: number;
  imminentCount: number;
  approachingCount: number;
  optimalCount: number;
  activeNotificationsCount: number;
  unacknowledgedCount: number;
  notifications: MaintenanceAlertNotification[];
  usagePatterns: EquipmentUsagePattern[];
  lastEvaluatedAt: string;
}

export interface LegacyDocumentRef {
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  standardWorkflow: string;
}

// Individual شليف / Bulk Bag Unit Record
export type BulkBagStatus =
  | 'AVAILABLE'
  | 'IN_TRANSIT'
  | 'RESERVED'
  | 'IN_THERM'
  | 'CONSUMED'
  | 'QUARANTINE'
  | 'IN_STORAGE'
  | 'IN_SHREDDING'
  | 'QUARANTINED';

export interface BulkBag {
  id: string; // e.g. SHL-000001 or BAG-2026-001
  bagNumber: string; // e.g. SHL-000001
  bagId?: string; // alias for bagNumber
  materialId: string;
  materialCode: string;
  materialName: string;
  weightKG: number;
  tareKG?: number;
  warehouseId: string;
  warehouseName?: string;
  locationId: string;
  locationCode: string;
  status: BulkBagStatus;
  sourceTransactionId?: string;
  sourceTransactionNumber?: string;
  transactionNumber?: string;
  batchNumber?: string;
  legacyDocumentNumber?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  notes?: string;
  qrPayload?: string;
  lastVerifiedAt?: string;
  lastVerifiedBy?: string;
  lastVerifiedLocationCode?: string;
  verificationStatus?: 'VERIFIED_IN_PLACE' | 'MISPLACED' | 'UNVERIFIED' | 'RELOCATED';

  // RFID Tag & Pallet Asset Tracking
  rfidTag?: string; // e.g. EPC96-BAG-001048
  palletId?: string; // Associated Pallet ID e.g. PLT-8402
  palletRfidTag?: string; // Pallet RFID EPC Tag
  lastRfidPortalScan?: {
    portalId: string;
    portalNameAr: string;
    portalNameEn: string;
    timestamp: string;
    rssi: number;
    antenna: number;
    direction: 'INBOUND' | 'OUTBOUND' | 'TRANSIT';
  };
}

// Approvals for sensitive actions
export type ApprovalType =
  | 'ADJUSTMENT'
  | 'LARGE_ISSUE'
  | 'CANCELLATION'
  | 'HISTORICAL_OVERRIDE'
  | 'STOCK_RECONCILIATION'
  | 'STOCK_ADJUSTMENT';

export interface ApprovalRecord {
  id: string; // APP-2026-001
  type?: string;
  approvalType?: ApprovalType;
  title: string;
  titleAr: string;
  entityType?: string;
  entityId?: string;
  entityReference?: string;
  materialId?: string;
  materialName?: string;
  amountKG?: number;
  requestedBy: string;
  requestedRole?: UserRole;
  requestedAt?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  notes?: string;
  reason: string;
  riskLevel?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt?: string;
}

// Physical Inventory Count Record
export interface PhysicalInventoryCount {
  id: string;
  countNumber: string; // PIC-2026-001
  date?: string;
  countDate?: string;
  time?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  warehouseId: string;
  warehouseName?: string;
  locationId: string;
  locationCode: string;
  systemKG?: number;
  physicalKG?: number;
  diffKG?: number;
  bookQuantityKG?: number;
  physicalQuantityKG?: number;
  varianceKG?: number;
  systemBags?: number;
  physicalBags?: number;
  diffBags?: number;
  bookBulkBags?: number;
  physicalBulkBags?: number;
  varianceBulkBags?: number;
  reason?: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPLIED' | 'REJECTED' | 'RECONCILED';
  countedBy: string;
  approvedBy?: string;
  supervisorApproval?: string;
  approvedAt?: string;
  approvalId?: string;
  createdAt: string;
  notes?: string;
}

// Purchasing Requirement & Receipt
export interface PurchaseRequirement {
  id: string;
  requirementNumber: string; // PR-2026-001
  materialId: string;
  materialCode?: string;
  materialName: string;
  requiredKG?: number;
  requiredQuantityKG?: number;
  currentStockKG?: number;
  safetyStockKG?: number;
  urgency: 'HIGH' | 'MEDIUM' | 'NORMAL';
  supplierId?: string;
  supplierName?: string;
  status: 'PENDING' | 'ORDERED' | 'FULFILLED' | 'CANCELLED' | 'OPEN';
  targetWarehouseId?: string;
  requestedBy: string;
  createdAt: string;
  notes?: string;
}

export interface PurchaseReceipt {
  id: string;
  receiptNumber: string; // PRE-2026-001
  requirementId?: string;
  supplierId: string;
  supplierName: string;
  truckPlate: string;
  driverName: string;
  materialId: string;
  materialName: string;
  grossWeightKG: number;
  tareWeightKG: number;
  netWeightKG: number;
  bulkBagsCount: number;
  receivingTransactionId?: string;
  status: 'ARRIVED' | 'WEIGHED' | 'UNLOADED' | 'COMPLETED';
  date: string;
  notes?: string;
}

export interface WarehouseTransfer {
  id: string;
  transferNumber: string; // TRF-2026-001
  date?: string;
  time?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  fromLocationId?: string;
  fromLocationCode?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  toLocationId?: string;
  toLocationCode?: string;
  sourceWarehouseId?: string;
  sourceLocationId?: string;
  sourceLocationCode?: string;
  targetWarehouseId?: string;
  targetLocationId?: string;
  targetLocationCode?: string;
  quantityKG: number;
  bulkBagsCount?: number;
  bulkBags?: number;
  selectedBagIds?: string[];
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  operator: string;
  notes?: string;
  createdAt?: string;
  transferredAt?: string;
}

export interface WarehouseVoiceNote {
  id: string;
  timestamp: string;
  date: string;
  shift: string;
  operator: string;
  category: 'INVENTORY_MOVEMENT' | 'SHIFT_HANDOVER' | 'OPERATIONAL_ALERT';
  title: string;
  content: string;
  locationFrom?: string;
  locationTo?: string;
  materialName?: string;
  quantityKG?: number;
  bulkBagsCount?: number;
  audioLengthSeconds?: number;
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'RESOLVED';
  createdAt: string;
}

export type MachineScheduleCategory = 'SHREDDING' | 'EXTRUSION' | 'THERMOFORMING' | 'UTILITY' | 'SCALE';
export type ScheduleShiftName = 'Morning / صباحي' | 'Evening / مسائي' | 'Night / ليلي';
export type MachineScheduleStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'MAINTENANCE_HOLD';

export interface MachineJobSchedule {
  id: string;
  scheduleNumber: string; // e.g. SCH-2026-081
  machineId: string;
  machineCode: string;
  machineNameAr: string;
  machineNameEn: string;
  machineCategory: MachineScheduleCategory;
  date: string; // YYYY-MM-DD
  shift: ScheduleShiftName;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  plannedHours: number;
  orderId?: string;
  orderNumber?: string;
  jobTitleAr: string;
  jobTitleEn: string;
  materialId?: string;
  materialName?: string;
  targetOutputKG: number;
  assignedOperator: string;
  supervisor: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: MachineScheduleStatus;
  capacityUtilizationPct: number;
  setupNotes?: string;
  actualOutputKG?: number;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// QUALITY CONTROL & REAL-TIME DEFECT TYPES
// ==========================================

export type QualityDefectCategory =
  | 'THICKNESS_VARIATION' // تفاوت السمك
  | 'CONTAMINATION_SPECKS' // شوائب ونقاط سوداء
  | 'GEL_FISH_EYES' // عيون السمكة
  | 'PINHOLES_VOIDS' // ثقوب وتجاويف هوائية
  | 'COLOR_STREAKS' // تموج لوني وخطوط
  | 'WARPING_CURL' // التواء وانحناء
  | 'MELT_FLOW_BRITTLE' // هشاشة وضعف شد
  | 'DIMENSIONAL_OFFSET'; // أبعاد خارج التفاوت

export type QualitySampleDisposition =
  | 'APPROVED' // مقبول - نخب أول
  | 'MARGINAL_PASS' // مشروط - نخب ثاني
  | 'QUARANTINED' // حجز فحص مخبري
  | 'REJECTED_SCRAP'; // مرفوض - تحويل لمجرشة الثرم 360

export interface QualitySample {
  id: string; // e.g. QC-2026-081
  sampleNumber: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "08:00 - 10:00"
  shift: 'Morning' | 'Evening' | 'Night';
  machineCode: string; // e.g. "EXT-01", "SHR-360", "THF-01"
  machineNameAr: string;
  batchLotNumber: string; // e.g. "LOT-2026-B104"
  orderNumber?: string;
  productNameAr: string;
  productNameEn: string;
  materialType?: string; // e.g. "HDPE", "PET", "PP", "LDPE"
  sampleSizeUnits: number; // e.g. 100 or 500 units inspected
  defectsCount: number; // e.g. 3
  defectRatePct: number; // e.g. 3.0%
  primaryDefect: QualityDefectCategory;
  defectBreakdown: Partial<Record<QualityDefectCategory, number>>;
  disposition: QualitySampleDisposition;
  targetThicknessMicrons?: number;
  measuredThicknessMicrons?: number;
  tensileStrengthMPa?: number;
  visualDefectScore?: number; // 1-10 scale (10 is pristine)
  inspectorName: string;
  operatorNotes?: string;
  regrindWeightKG?: number; // Weight sent to SHR-360 if rejected
  actionTakenAr?: string;
  createdAt: string;
}

export interface QualityHeatmapCell {
  machineCode: string;
  machineNameAr: string;
  columnKey: string; // e.g. time window "08:00" or defect category
  columnLabelAr: string;
  columnLabelEn: string;
  defectRatePct: number;
  samplesCount: number;
  totalDefects: number;
  totalInspected: number;
  primaryDefect?: QualityDefectCategory;
  status: 'OPTIMAL' | 'ACCEPTABLE' | 'WARNING' | 'CRITICAL' | 'NO_DATA';
  sampleIds: string[];
}

export interface CloudStorageSnapshotRecord {
  id: string;
  fileName: string;
  storagePath: string;
  storageBucket: string;
  downloadUrl?: string;
  createdAt: string;
  expiresAt: string;
  retentionDays: number;
  totalDocuments: number;
  payloadSizeKB: number;
  autoScheduled: boolean;
  createdBy: string;
  status: 'ACTIVE' | 'PURGED' | 'EXPIRED';
  collectionCounts: Record<string, number>;
  isPreWipe?: boolean;
  tag?: 'PRE_WIPE' | 'SCHEDULED_DAILY' | 'MANUAL_SNAPSHOT';
}

export interface BulkRollbackResult {
  success: boolean;
  totalRestored: number;
  details: Record<string, number>;
  snapshotId: string;
  snapshotFileName: string;
  snapshotTimestamp: string;
  error?: string;
}

export interface CloudSchedulerHistoryEntry {
  id: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  totalDocuments: number;
  payloadSizeKB: number;
  purgedCount: number;
  message: string;
  storagePath?: string;
}

export interface CloudSchedulerConfig {
  id: string;
  enabled: boolean;
  dailyRunTime: string; // "HH:mm", e.g. "02:00"
  timezone: string;
  retentionDays: number; // default: 30
  autoPurgeExpired: boolean;
  lastRunTimestamp: string | null;
  lastRunStatus: 'IDLE' | 'SUCCESS' | 'FAILED' | 'RUNNING';
  lastRunMessage?: string;
  lastRunResult?: {
    snapshotId: string;
    fileName: string;
    totalDocuments: number;
    payloadSizeKB: number;
    purgedCount?: number;
    storagePath?: string;
  } | null;
  nextScheduledRun: string | null;
  history: CloudSchedulerHistoryEntry[];
}

// ==========================================
// Energy Efficiency & Power Monitoring Types
// ==========================================

export type TariffZone = 'OFF_PEAK' | 'STANDARD' | 'PEAK';

export interface EnergyTariffWindow {
  zone: TariffZone;
  nameAr: string;
  nameEn: string;
  rateIQDPerKWh: number; // e.g. 85, 140, 240 IQD
  rateUSDPerKWh: number; // e.g. 0.065, 0.108, 0.185 USD
  startHour: number; // 0-23
  endHour: number; // 0-23
  color: string;
}

export type ShredderOperatingState = 'RUNNING_LOAD' | 'RUNNING_IDLE' | 'STOPPED' | 'MAINTENANCE';

export interface ShredderMachineEnergyProfile {
  machineId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nominalMotorKW: number; // e.g. 75 kW, 55 kW, 45 kW
  ratedAmps: number; // @ 380V
  voltageV: number; // 3-phase, e.g. 386V
  currentAmps: number;
  activePowerKW: number;
  powerFactor: number; // cos phi, e.g. 0.88
  state: ShredderOperatingState;
  loadPercentage: number; // activePowerKW / nominalMotorKW * 100
  throughputKGHour: number;
  specificEnergyConsumptionKWhKG: number; // SEC = kWh / kg
  targetSECKWhKG: number; // standard target, e.g. 0.090
  bladeWearPct: number; // 0-100%
  dailyConsumptionKWh: number;
  dailyCostIQD: number;
  dailyCostUSD: number;
  idleLossKWhToday: number;
  temperatureC: number;
  lastReadingTime: string;
}

export interface ShreddingEnergyReading {
  id: string;
  shreddingTransactionId?: string;
  shreddingNumber?: string;
  machineId: string;
  machineCode: string;
  materialName: string;
  materialCategory: string;
  timestamp: string;
  shift: string;
  operator: string;
  initialMeterKWh: number;
  finalMeterKWh: number;
  totalKWh: number;
  durationMinutes: number;
  inputKG: number;
  outputKG: number;
  specificEnergyKWhKG: number; // kWh / inputKG
  tariffZone: TariffZone;
  rateIQDPerKWh: number;
  totalCostIQD: number;
  totalCostUSD: number;
  efficiencyRating: 'A+' | 'A' | 'B' | 'C' | 'CRITICAL_WASTE';
  notes?: string;
}

export interface HourlyEnergyTelemetry {
  hourLabel: string;
  hour: number;
  tariffZone: TariffZone;
  shredder01KW: number;
  shredder02KW: number;
  shredder03KW: number;
  totalActiveKW: number;
  totalCostIQD: number;
  isPeakTariff: boolean;
  totalThroughputKG: number;
}

export interface EnergySavingOpportunity {
  id: string;
  type: 'LOAD_SHIFT' | 'IDLE_CUTOFF' | 'BLADE_SHARPENING' | 'POWER_FACTOR';
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedMonthlySavingsIQD: number;
  estimatedMonthlySavingsUSD: number;
  estimatedMonthlyKWhSaved: number;
  actionRecommendationAr: string;
  actionRecommendationEn: string;
}

// -------------------------------------------------------------
// RFID Bulk Asset Tracking & Automated Zone Portal Interfaces
// -------------------------------------------------------------

export interface RfidTagRecord {
  epc: string; // e.g. EPC96: E280-1160-2000-8402-A101
  tagType: 'PALLET' | 'BULK_BAG' | 'CONTAINER' | 'MACHINE_FEEDER';
  assetId: string; // bagNumber or palletId or materialCode
  assetNameAr: string;
  assetNameEn: string;
  materialId?: string;
  materialCode?: string;
  materialNameAr?: string;
  weightKG?: number;
  currentWarehouseId: string;
  currentWarehouseNameAr: string;
  currentLocationId: string;
  currentLocationCode: string;
  lastPortalId?: string;
  lastPortalNameAr?: string;
  lastDetectedAt: string;
  rssi: number; // Signal strength in dBm, e.g. -48 dBm
  readCount: number;
  status: 'ACTIVE' | 'IN_TRANSIT' | 'CONSUMED' | 'ARCHIVED';
}

export interface RfidPortal {
  id: string; // e.g. 'PORTAL-GATE-01'
  code: string;
  nameAr: string;
  nameEn: string;
  zoneFrom: string;
  zoneTo: string;
  warehouseFromId: string;
  warehouseToId: string;
  locationFromCode: string;
  locationToCode: string;
  antennaCount: number;
  frequencyBand: 'UHF 865-868 MHz (EU/Middle East)' | 'UHF 902-928 MHz (US)';
  readRangeMeters: number; // e.g. 8m
  status: 'ONLINE' | 'ACTIVE_READING' | 'IDLE' | 'MAINTENANCE';
  installedGateLocation: string;
  installedGateLocationAr: string;
  lastPassageTimestamp?: string;
  totalAssetsPassed: number;
}

export interface RfidPalletLoad {
  palletId: string; // e.g. PLT-8402
  palletRfidTag: string; // e.g. EPC96-PLT-008402
  descriptionAr: string;
  descriptionEn: string;
  materialId: string;
  materialCode: string;
  materialNameAr: string;
  bagIds: string[];
  totalWeightKG: number;
  bulkBagsCount: number;
  currentWarehouseId: string;
  currentLocationCode: string;
  targetLocationCode?: string;
  status: 'READY_IN_RACK' | 'LOADED_ON_FORKLIFT' | 'IN_TRANSIT_GATE' | 'DELIVERED_TO_ZONE';
  createdAt: string;
  lastMovementAt?: string;
}

export interface RfidBulkMovementEvent {
  id: string;
  movementNumber: string;
  timestamp: string;
  portalId: string;
  portalNameAr: string;
  portalNameEn: string;
  palletId?: string;
  palletRfidTag?: string;
  detectedTagsCount: number;
  tagsList: {
    epc: string;
    assetId: string;
    assetNameAr: string;
    weightKG: number;
    rssi: number;
  }[];
  materialId: string;
  materialCode: string;
  materialNameAr: string;
  totalKG: number;
  totalBags: number;
  fromWarehouseId: string;
  fromLocationCode: string;
  toWarehouseId: string;
  toLocationCode: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL_TRANSFER';
  operator: string;
  status: 'CONFIRMED' | 'PENDING_APPROVAL' | 'REJECTED';
  notes?: string;
}

export interface SystemInventoryCode {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: 'STORAGE' | 'PRODUCTION' | 'SHREDDING' | 'RECEIVING' | 'CUSTOM';
  descriptionAr: string;
  descriptionEn: string;
  prefix: string;
  isActive: boolean;
  isSystemDefault: boolean;
  updatedAt: string;
  updatedBy: string;
}

// Re-export Universal Multi-Tenant Warehouse Engine Types
export * from './types/warehouse';




