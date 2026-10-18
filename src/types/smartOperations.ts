/**
 * SMART WAREHOUSE INTELLIGENCE, AUTOMATION AND OPERATIONAL INSIGHTS (PHASE 13)
 * Core Type Definitions & Contracts
 */

import { NavigationPage } from '../types';

export type SmartInsightType =
  | 'LOW_STOCK'
  | 'REORDER_APPROACHING'
  | 'EXCESS_STOCK'
  | 'SLOW_MOVING'
  | 'NO_RECENT_MOVEMENT'
  | 'EXPIRING_BATCH'
  | 'EXPIRED_BATCH'
  | 'UNUSUAL_ADJUSTMENT'
  | 'RECEIVING_ERROR'
  | 'OUTSTANDING_TRANSFER'
  | 'PENDING_APPROVAL'
  | 'SUPPLIER_PATTERN'
  | 'INVENTORY_DISCREPANCY';

export type SmartInsightSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface SmartInsightItem {
  id: string;
  organizationId: string;
  type: SmartInsightType;
  severity: SmartInsightSeverity;
  titleEn: string;
  titleAr: string;
  explanationEn: string;
  explanationAr: string;
  affectedEntityType: 'ITEM' | 'BATCH' | 'TRANSACTION' | 'DOCUMENT' | 'SUPPLIER' | 'TRANSFER';
  affectedEntityId: string;
  affectedEntityCode?: string;
  affectedEntityName?: string;
  warehouseId?: string;
  warehouseName?: string;
  metrics: {
    currentValue?: number;
    thresholdValue?: number;
    difference?: number;
    unit?: string;
  };
  factsVsEstimates: {
    factualBasis: string;
    assumptions?: string;
    isEstimated: boolean;
  };
  linkPage: NavigationPage;
  linkParams?: Record<string, string>;
  createdAt: string;
}

export interface ReplenishmentRecommendation {
  id: string;
  organizationId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemNameAr?: string;
  unit: string;
  warehouseId?: string;
  warehouseName?: string;
  currentAvailableStock: number;
  reservedStock: number;
  openPurchaseOrdersQty: number;
  pendingReceiptsQty: number;
  effectiveStockPosition: number; // Available + Incoming
  minimumStock: number;
  reorderPoint: number;
  maximumStock: number;
  suggestedReplenishmentQty: number;
  suggestedPriority: 'URGENT' | 'HIGH' | 'NORMAL';
  supplierId?: string;
  supplierName?: string;
  estimatedLeadTimeDays?: number;
  dailyBurnRate: number;
  runwayDays: number;
  calculationExplanationEn: string;
  calculationExplanationAr: string;
  assumptionsEn: string;
  assumptionsAr: string;
  status: 'PENDING_REVIEW' | 'DRAFT_CREATED' | 'DISMISSED';
  draftPoId?: string;
}

export type SlowMovingClassification =
  | 'FAST_MOVING'
  | 'NORMAL'
  | 'SLOW_MOVING'
  | 'NO_RECENT_MOVEMENT';

export interface SlowMovingAnalysisItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemNameAr?: string;
  category: string;
  warehouseId?: string;
  warehouseName?: string;
  currentStock: number;
  unit: string;
  analysisPeriodDays: 30 | 60 | 90 | 180;
  totalConsumedInPeriod: number;
  transactionCountInPeriod: number;
  daysSinceLastMovement: number;
  lastMovementDate?: string;
  turnoverRatio: number; // Consumed / CurrentStock
  classification: SlowMovingClassification;
  isExcessStock: boolean;
  excessQuantity: number;
  policyMaximumStock?: number;
  methodExplanationEn: string;
  methodExplanationAr: string;
}

export type AnomalyCategory =
  | 'REPEATED_ADJUSTMENTS'
  | 'UNUSUALLY_LARGE_ISSUE'
  | 'NEGATIVE_STOCK_ATTEMPT'
  | 'REPEATED_CANCELLATIONS'
  | 'DUPLICATE_DOCUMENT'
  | 'UNEXPECTED_STOCK_VARIANCE'
  | 'UNUSUALLY_FREQUENT_MOVEMENTS';

export interface AnomalyDetectionAlert {
  id: string;
  organizationId: string;
  category: AnomalyCategory;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  observedValue: number | string;
  thresholdValue: number | string;
  affectedEntityType: string;
  affectedEntityId: string;
  affectedEntityCode?: string;
  warehouseId?: string;
  timestamp: string;
  requiresReview: true;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED' | 'ACTION_TAKEN';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface BatchIntelligenceRecord {
  batchId: string;
  organizationId: string;
  batchNumber: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  locationId?: string;
  locationCode?: string;
  currentQuantity: number;
  unit: string;
  manufactureDate?: string;
  expiryDate: string;
  daysUntilExpiry: number;
  status: 'AVAILABLE' | 'EXPIRING_SOON' | 'EXPIRED' | 'QUARANTINED' | 'BLOCKED';
  fefoPriorityRank: number; // 1 = pick first
  qualityStatus?: string;
  inspectionRequired: boolean;
  recommendationEn: string;
  recommendationAr: string;
}

export interface SupplierPerformanceMetric {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  organizationId: string;
  observationsCount: number;
  measurementPeriodDays: number;
  hasSufficientData: boolean;
  averageRecordedDeliveryDays?: number;
  onTimeDeliveryRate?: number; // 0 - 100%
  partialDeliveryFrequency?: number; // 0 - 100%
  poCompletionRate?: number; // 0 - 100%
  quantityDiscrepancyRate?: number; // 0 - 100%
  reliabilityStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'INSUFFICIENT_DATA';
  explanationEn: string;
  explanationAr: string;
}

export type AutomationTrigger =
  | 'STOCK_BELOW_ROP'
  | 'RECEIPT_AWAITING_APPROVAL'
  | 'EXPIRED_BATCH_DETECTED'
  | 'UNUSUAL_ADJUSTMENT_POSTED'
  | 'STOCKOUT_IMMINENT';

export type AutomationAction =
  | 'CREATE_NOTIFICATION'
  | 'CREATE_ALERT'
  | 'CREATE_DRAFT_PR'
  | 'ASSIGN_REVIEW_TASK';

export interface WorkflowAutomationRule {
  id: string;
  organizationId: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  trigger: AutomationTrigger;
  conditions: {
    category?: string;
    warehouseId?: string;
    thresholdPercentage?: number;
    severityMinimum?: SmartInsightSeverity;
  };
  action: AutomationAction;
  actionPayload?: Record<string, any>;
  enabled: boolean;
  cooldownMinutes: number;
  createdBy: string;
  createdAt: string;
  lastExecutionAt?: string;
  lastExecutionStatus?: 'IDLE' | 'SUCCESS' | 'FAILED' | 'SKIPPED_COOLDOWN';
  executionCount: number;
  auditInformation: string;
}

export interface WorkflowExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  organizationId: string;
  triggeredAt: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED_COOLDOWN';
  reason: string;
  affectedEntityId?: string;
  resultPayload?: any;
}

export interface SmartNotification {
  id: string;
  organizationId: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  category: 'STOCK' | 'APPROVAL' | 'BATCH' | 'ANOMALY' | 'SYSTEM';
  severity: SmartInsightSeverity;
  linkPage?: NavigationPage;
  linkParams?: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

export interface SmartOperationsSettings {
  organizationId: string;
  // Reorder & Low Stock Rules
  lowStockThresholdPercent: number; // default: 20%
  criticalStockThresholdPercent: number; // default: 10%
  safetyStockMultiplier: number; // default: 1.5
  enableAutoDraftReorder: boolean; // default: false (requires user review)
  // Slow-moving & Excess
  slowMovingDaysPeriod: 30 | 60 | 90 | 180; // default: 60
  excessStockDaysThreshold: number; // default: 90 days of burn rate
  // Expiry & Batch
  expiryWarningDays: number; // default: 30
  criticalExpiryDays: number; // default: 7
  enforceFefoPicking: boolean; // default: true
  // Anomaly Detection Thresholds
  anomalyMaxAdjustmentsPerWeek: number; // default: 3
  anomalyLargeIssueMultiplier: number; // default: 3.0x average issue
  anomalyVarianceThresholdKG: number; // default: 50 KG
  // Automation & Alerts
  enabledAutomationTriggers: AutomationTrigger[];
  notificationRecipientEmails: string[];
  enableInAppNotifications: boolean;
  enableEmailNotifications: boolean; // Note: dependent on provider
  // Forecasting options
  forecastHorizonDays: 30 | 60 | 90;
  minimumObservationsForForecast: number;
  updatedAt: string;
  updatedBy: string;
}

export interface WarehouseAssistantQuery {
  rawQuery: string;
  intent:
    | 'LOW_STOCK'
    | 'WAREHOUSE_STOCK'
    | 'EXPIRING_BATCHES'
    | 'RECENT_RECEIPTS'
    | 'OUTSTANDING_POS'
    | 'ITEM_MOVEMENTS'
    | 'STOCK_VARIANCE'
    | 'UNKNOWN';
  targetWarehouseId?: string;
  targetItemId?: string;
  dateRangeLabel?: string;
}

export interface ProposedAssistantAction {
  actionType: 'DRAFT_PURCHASE_REQUEST' | 'SCHEDULE_STOCKTAKE' | 'FLAG_FOR_REVIEW';
  titleEn: string;
  titleAr: string;
  affectedRecordsSummary: string;
  quantities: string;
  consequencesEn: string;
  consequencesAr: string;
  payload: any;
}
