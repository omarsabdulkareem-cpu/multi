/**
 * MULTI-TENANT SAAS BUSINESS MANAGEMENT LAYER CONTRACTS
 * 
 * Reusable enterprise domain models for:
 * - Suppliers Master
 * - Customers Master
 * - Purchase Requests & Approvals
 * - Purchase Orders & Partial Receiving
 * - Internal Stock Requests
 * - Document Numbering Sequences
 * - Unit Conversions & Costing
 */

import { StandardUnit } from './warehouse';

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface SupplierMaster {
  id: string;                      // e.g. 'sup_01'
  supplierId?: string;             // Alias
  organizationId: string;          // Tenant isolation ID
  supplierCode: string;            // e.g. 'SUP-001'
  supplierName: string;
  legalName?: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  city: string;
  taxNumber?: string;
  paymentTerms: 'IMMEDIATE' | 'NET_15' | 'NET_30' | 'NET_60' | 'CASH' | string;
  currency: string;                // e.g. 'USD', 'IQD', 'SAR'
  notes?: string;
  status: SupplierStatus;
  materialTypesSupplied?: string[];
  totalDeliveredKG?: number;
  totalOrdersCount?: number;
  lastTransactionDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMaster {
  id: string;                      // e.g. 'cus_01'
  customerId?: string;             // Alias
  organizationId: string;          // Tenant isolation ID
  customerCode: string;            // e.g. 'CUS-001'
  customerName: string;
  legalName?: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  city: string;
  taxNumber?: string;
  currency: string;
  paymentTerms: 'IMMEDIATE' | 'NET_15' | 'NET_30' | 'NET_60' | 'CASH' | string;
  notes?: string;
  status: CustomerStatus;
  totalOrdersCount?: number;
  totalIssuedKG?: number;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED_TO_PO'
  | 'CANCELLED';

export interface PurchaseRequestLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  requestedQuantity: number;
  unit: StandardUnit;
  estimatedUnitPrice?: number;
  notes?: string;
}

export interface PurchaseRequest {
  id: string;                      // e.g. 'pr_01'
  requestNumber: string;           // e.g. 'PR-2026-000001'
  organizationId: string;          // Tenant isolation ID
  requestedBy: string;
  department: string;
  requiredDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  reason: string;
  items: PurchaseRequestLineItem[];
  totalEstimatedCost?: number;
  notes?: string;
  status: PurchaseRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  convertedToPoId?: string;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

export interface PurchaseOrderLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  description?: string;
  orderedQuantity: number;
  unit: StandardUnit;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  totalPrice: number;
  receivedQuantity: number;
  remainingQuantity: number;
}

export interface PurchaseOrder {
  id: string;                      // e.g. 'po_01'
  documentNumber: string;          // e.g. 'PO-2026-000001'
  organizationId: string;          // Tenant isolation ID
  supplierId: string;
  supplierName: string;
  orderDate: string;
  expectedDate: string;
  currency: string;
  warehouseId: string;
  warehouseName: string;
  notes?: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLineItem[];
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  sourceRequestId?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type InternalStockRequestStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PARTIALLY_ISSUED'
  | 'FULFILLED'
  | 'REJECTED'
  | 'CANCELLED';

export interface InternalStockRequestLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  requestedQuantity: number;
  issuedQuantity: number;
  remainingQuantity: number;
  unit: StandardUnit;
  notes?: string;
}

export interface InternalStockRequest {
  id: string;                      // e.g. 'req_01'
  requestNumber: string;           // e.g. 'ISR-2026-000001'
  organizationId: string;          // Tenant isolation ID
  requestedBy: string;
  department: string;              // e.g. 'Maintenance', 'Extrusion Line 2', 'Thermoforming'
  warehouseId: string;
  warehouseName: string;
  purpose: string;
  requiredDate: string;
  items: InternalStockRequestLineItem[];
  status: InternalStockRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryCostMethod =
  | 'NONE'
  | 'LAST_PURCHASE_PRICE'
  | 'AVERAGE_COST'
  | 'FIFO_FOUNDATION';

export interface UnitConversionRule {
  id: string;
  organizationId: string;
  fromUnit: StandardUnit;
  toUnit: StandardUnit;
  factor: number;                  // e.g. 1 TON = 1000 KG (factor = 1000)
  itemId?: string;                 // If rule is specific to an item (e.g. 1 BOX = 24 PCS)
}

export interface DocumentSequenceConfig {
  organizationId: string;
  documentType:
    | 'PURCHASE_REQUEST'
    | 'PURCHASE_ORDER'
    | 'RECEIVING'
    | 'ISSUE'
    | 'TRANSFER'
    | 'ADJUSTMENT'
    | 'RETURN'
    | 'INTERNAL_REQUEST';
  prefix: string;
  padLength: number;
  nextNumber: number;
  yearReset: boolean;
  currentYear: number;
}
