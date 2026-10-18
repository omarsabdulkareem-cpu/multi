/**
 * VERSIONED WEBHOOK EVENT CONTRACTS & WAREHOUSE EVENT INTERFACES (PHASE 14.4 - STEP 4)
 * Universal Warehouse Management SaaS Platform
 *
 * Defines:
 * 1. Standardized Event Envelope (schemaVersion: '2026-10-01')
 * 2. Strongly-typed payload interfaces for all supported warehouse operations:
 *    - inventory.receipt.confirmed / receipt.confirmed
 *    - inventory.issue.confirmed / issue.confirmed
 *    - inventory.transfer.completed / transfer.completed
 *    - inventory.adjustment.confirmed / adjustment.confirmed
 *    - inventory.return.confirmed
 *    - inventory.stocktake.completed
 *    - purchase_order.approved
 *    - purchase_order.received
 *    - item.created
 *    - item.updated
 *    - warehouse.created
 *    - integration.test
 */

export type WebhookOperationType =
  | 'inventory.receipt.confirmed'
  | 'inventory.issue.confirmed'
  | 'inventory.transfer.completed'
  | 'inventory.adjustment.confirmed'
  | 'inventory.return.confirmed'
  | 'inventory.stocktake.completed'
  | 'purchase_order.approved'
  | 'purchase_order.received'
  | 'item.created'
  | 'item.updated'
  | 'warehouse.created'
  | 'integration.test'
  // Direct operation aliases supported for external consumers
  | 'receipt.confirmed'
  | 'issue.confirmed'
  | 'transfer.completed'
  | 'adjustment.confirmed';

/**
 * Standard Versioned Webhook Event Envelope
 * Compliant with Phase 14.4 Step 4 specification:
 * {
 *   "id": "unique-event-id",
 *   "type": "inventory.receipt.confirmed",
 *   "schemaVersion": "2026-10-01",
 *   "occurredAt": "ISO-8601 timestamp",
 *   "organizationId": "organization-id",
 *   "data": { ... }
 * }
 */
export interface WebhookEventEnvelope<T = any> {
  id: string;                      // Stable, deterministic event identifier (e.g. "evt_receipt_confirmed_GRN-101")
  type: WebhookOperationType;      // Qualified event type
  schemaVersion: '2026-10-01';     // Version contract identifier
  occurredAt: string;              // ISO-8601 timestamp of business confirmation
  timestamp?: string;              // ISO-8601 timestamp (backward-compatible alias)
  organizationId: string;          // Authoritative tenant scope
  data: T;                         // Strongly-typed operation payload
}

// -----------------------------------------------------------------------------
// SPECIFIC WAREHOUSE OPERATION PAYLOAD INTERFACES
// -----------------------------------------------------------------------------

/**
 * Payload for receipt.confirmed / inventory.receipt.confirmed
 * Emitted ONLY when a goods receipt document transitions to CONFIRMED and inventory ledger is credited.
 */
export interface ReceiptConfirmedEventData {
  transactionId?: string;          // Authoritative inventory transaction / ledger entry ID
  receiptId: string;
  receiptNumber: string;
  warehouseId: string;
  warehouseName?: string;
  supplierName?: string;
  totalQuantity: number;
  totalWeightKG: number;
  linesCount: number;
  confirmedAt: string;
  notes?: string;
  lines?: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    weightKG: number;
    batchId?: string;
    locationId?: string;
  }>;
}

/**
 * Payload for issue.confirmed / inventory.issue.confirmed
 * Emitted ONLY when an issue order is authorized, stock availability verified, and quantities deducted.
 */
export interface IssueConfirmedEventData {
  transactionId?: string;          // Authoritative inventory transaction / ledger entry ID
  issueId: string;
  issueNumber: string;
  warehouseId: string;
  warehouseName?: string;
  destination: string;
  department?: string;
  reason: string;
  totalQuantity: number;
  totalWeightKG: number;
  linesCount: number;
  confirmedAt: string;
  notes?: string;
  lines?: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    weightKG: number;
    batchId?: string;
    serialNumber?: string;
  }>;
}

/**
 * Payload for transfer.completed / inventory.transfer.completed
 * Emitted ONLY when inter-warehouse or inter-bin transfer movements are committed to the ledger.
 */
export interface TransferCompletedEventData {
  transactionId?: string;          // Authoritative inventory transaction / ledger entry ID
  transferId: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouseName?: string;
  sourceLocationId?: string;
  destinationWarehouseId: string;
  destinationWarehouseName?: string;
  destinationLocationId?: string;
  totalQuantity: number;
  totalWeightKG: number;
  linesCount: number;
  reason?: string;
  confirmedAt: string;
  notes?: string;
}

/**
 * Payload for adjustment.confirmed / inventory.adjustment.confirmed
 * Emitted ONLY when an audited inventory variance adjustment is committed to the ledger.
 */
export interface AdjustmentConfirmedEventData {
  transactionId?: string;          // Authoritative inventory transaction / ledger entry ID
  adjustmentId: string;
  warehouseId: string;
  locationId?: string;
  itemId: string;
  itemCode: string;
  adjustmentType: 'INCREASE' | 'DECREASE' | 'VARIANCE' | string;
  quantityDelta: number;
  unit: string;
  weightKGDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  notes?: string;
  confirmedAt: string;
}

/**
 * Payload for item.created
 * Emitted ONLY when a new item/SKU master is persisted in the organization catalog.
 */
export interface ItemCreatedEventData {
  transactionId?: string;          // Master record transaction / entity ID
  itemId: string;
  itemCode: string;
  name: string;
  category: string;
  unitOfMeasure: string;
  defaultWeight?: number;
  createdAt: string;
}

/**
 * Payload for item.updated
 * Emitted ONLY when an existing item's master specifications are persisted.
 */
export interface ItemUpdatedEventData {
  transactionId?: string;
  itemId: string;
  itemCode: string;
  name: string;
  category: string;
  updates: Record<string, any>;
  updatedAt: string;
}

/**
 * Payload for warehouse.created
 * Emitted ONLY when a new physical storage warehouse is provisioned.
 */
export interface WarehouseCreatedEventData {
  transactionId?: string;
  warehouseId: string;
  name: string;
  code: string;
  type?: string;
  status?: string;
  totalCapacityKG?: number;
  createdAt: string;
}

/**
 * Payload for purchase_order.approved
 * Emitted ONLY when a draft purchase order reaches official management approval.
 */
export interface PurchaseOrderApprovedEventData {
  transactionId?: string;
  purchaseOrderId: string;
  documentNumber: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName?: string;
  totalOrderedQuantity: number;
  grandTotal: number;
  currency: string;
  status: string;
  linesCount: number;
  approvedAt: string;
}

/**
 * Payload for purchase_order.received
 * Emitted ONLY when order line fulfillment is confirmed and materials are received into stock.
 */
export interface PurchaseOrderReceivedEventData {
  transactionId?: string;
  purchaseOrderId: string;
  documentNumber: string;
  receiptId: string;
  receiptNumber: string;
  supplierId: string;
  supplierName: string;
  receivedQuantity: number;
  totalWeightKG: number;
  isClosed: boolean;
  status: string;
  receivedAt: string;
}

/**
 * Payload for inventory.return.confirmed
 * Emitted ONLY when customer or vendor returns are credited back into inventory.
 */
export interface ReturnConfirmedEventData {
  transactionId?: string;
  returnId: string;
  returnNumber: string;
  warehouseId: string;
  locationId?: string;
  partyName: string;
  totalQuantity: number;
  totalWeightKG: number;
  linesCount: number;
  confirmedAt: string;
}

/**
 * Payload for inventory.stocktake.completed
 * Emitted ONLY when a physical stock count session is approved and variance ledger sealed.
 */
export interface StocktakeCompletedEventData {
  transactionId?: string;
  stockCountId: string;
  countNumber: string;
  warehouseId: string;
  locationId?: string;
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
  linesCount: number;
  confirmedAt: string;
}

/**
 * Payload for integration.test
 * Ping event to verify listener connectivity and cryptographic HMAC signature validation.
 */
export interface IntegrationTestEventData {
  transactionId?: string;
  pingId: string;
  message: string;
  requestedBy: string;
  occurredAt: string;
}

// -----------------------------------------------------------------------------
// TYPED EVENT ENVELOPE ALIASES
// -----------------------------------------------------------------------------

export type ReceiptConfirmedWebhookEvent = WebhookEventEnvelope<ReceiptConfirmedEventData>;
export type IssueConfirmedWebhookEvent = WebhookEventEnvelope<IssueConfirmedEventData>;
export type TransferCompletedWebhookEvent = WebhookEventEnvelope<TransferCompletedEventData>;
export type AdjustmentConfirmedWebhookEvent = WebhookEventEnvelope<AdjustmentConfirmedEventData>;
export type ItemCreatedWebhookEvent = WebhookEventEnvelope<ItemCreatedEventData>;
export type ItemUpdatedWebhookEvent = WebhookEventEnvelope<ItemUpdatedEventData>;
export type WarehouseCreatedWebhookEvent = WebhookEventEnvelope<WarehouseCreatedEventData>;
export type PurchaseOrderApprovedWebhookEvent = WebhookEventEnvelope<PurchaseOrderApprovedEventData>;
export type PurchaseOrderReceivedWebhookEvent = WebhookEventEnvelope<PurchaseOrderReceivedEventData>;
export type ReturnConfirmedWebhookEvent = WebhookEventEnvelope<ReturnConfirmedEventData>;
export type StocktakeCompletedWebhookEvent = WebhookEventEnvelope<StocktakeCompletedEventData>;
export type IntegrationTestWebhookEvent = WebhookEventEnvelope<IntegrationTestEventData>;

/**
 * Union of all supported versioned warehouse webhook events
 */
export type AnyWarehouseWebhookEvent =
  | ReceiptConfirmedWebhookEvent
  | IssueConfirmedWebhookEvent
  | TransferCompletedWebhookEvent
  | AdjustmentConfirmedWebhookEvent
  | ItemCreatedWebhookEvent
  | ItemUpdatedWebhookEvent
  | WarehouseCreatedWebhookEvent
  | PurchaseOrderApprovedWebhookEvent
  | PurchaseOrderReceivedWebhookEvent
  | ReturnConfirmedWebhookEvent
  | StocktakeCompletedWebhookEvent
  | IntegrationTestWebhookEvent;

// Re-export common webhook infrastructure types for seamless cross-compatibility
export * from './webhook';
