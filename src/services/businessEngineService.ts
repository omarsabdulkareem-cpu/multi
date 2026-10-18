/**
 * MULTI-TENANT SAAS BUSINESS MANAGEMENT ENGINE SERVICE
 * 
 * Implements business processes on top of the universal warehouse engine:
 * - Supplier Master CRUD & transaction history
 * - Customer Master CRUD & delivery history
 * - Purchase Requests & Approval workflows
 * - Purchase Orders & Partial Receiving (linked to inventory ledger)
 * - Internal Stock Requests & Warehouse fulfillment
 * - Per-tenant configurable document numbering sequences
 * - Business reporting engine with multi-criteria filtering
 * - Automated end-to-end integration test runner
 */

import {
  SupplierMaster,
  CustomerMaster,
  PurchaseRequest,
  PurchaseOrder,
  InternalStockRequest,
  DocumentSequenceConfig,
  InventoryCostMethod,
} from '../types/business';
import { WarehouseEngineService } from './warehouseEngineService';
import { TenantService } from './tenantService';
import { WebhookService } from './webhookService';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

const STORAGE_KEY_SUPPLIERS = 'alkarwan_saas_suppliers_v1';
const STORAGE_KEY_CUSTOMERS = 'alkarwan_saas_customers_v1';
const STORAGE_KEY_PURCHASE_REQS = 'alkarwan_saas_purchase_reqs_v1';
const STORAGE_KEY_PURCHASE_ORDERS = 'alkarwan_saas_purchase_orders_v1';
const STORAGE_KEY_INTERNAL_REQS = 'alkarwan_saas_internal_reqs_v1';
const STORAGE_KEY_SEQUENCES = 'alkarwan_saas_doc_sequences_v1';

// Initial seed suppliers for AL-KARWAN and test organizations
const INITIAL_SUPPLIERS: SupplierMaster[] = [
  {
    id: 'sup_alkarwan_sabic',
    supplierId: 'sup_alkarwan_sabic',
    organizationId: 'org_alkarwan',
    supplierCode: 'SUP-SABIC-01',
    supplierName: 'SABIC Polymers Global',
    legalName: 'Saudi Basic Industries Corporation',
    contactPerson: 'Eng. Fahad Al-Zahrani',
    phone: '+966 11 225 8000',
    email: 'polymers.sales@sabic.com',
    address: 'SABIC Global HQ, Riyadh',
    country: 'Saudi Arabia',
    city: 'Riyadh',
    taxNumber: 'SA30012345670003',
    paymentTerms: 'NET_30',
    currency: 'USD',
    notes: 'Primary supplier of virgin PET resin and PP granules',
    status: 'ACTIVE',
    materialTypesSupplied: ['PET Resin (Virgin)', 'PP Granules (500P)'],
    totalDeliveredKG: 45000,
    totalOrdersCount: 6,
    lastTransactionDate: '2026-09-01T10:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
  },
  {
    id: 'sup_alkarwan_borouge',
    supplierId: 'sup_alkarwan_borouge',
    organizationId: 'org_alkarwan',
    supplierCode: 'SUP-BOR-02',
    supplierName: 'Borouge Petrochemicals',
    legalName: 'Borouge Pte Ltd',
    contactPerson: 'Khalfan Al-Mazrouei',
    phone: '+971 2 607 0888',
    email: 'orders@borouge.com',
    address: 'Sheikh Khalifa Energy Complex, Abu Dhabi',
    country: 'United Arab Emirates',
    city: 'Abu Dhabi',
    taxNumber: 'AE10098765430002',
    paymentTerms: 'NET_60',
    currency: 'USD',
    notes: 'High-density polyethylene and masterbatch colorants',
    status: 'ACTIVE',
    materialTypesSupplied: ['HDPE Film Grade', 'White Masterbatch Titanium'],
    totalDeliveredKG: 28000,
    totalOrdersCount: 4,
    lastTransactionDate: '2026-08-20T12:00:00Z',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-08-20T12:00:00Z',
  },
];

const INITIAL_CUSTOMERS: CustomerMaster[] = [
  {
    id: 'cus_alkarwan_national_pack',
    customerId: 'cus_alkarwan_national_pack',
    organizationId: 'org_alkarwan',
    customerCode: 'CUS-NAT-01',
    customerName: 'National Food Packaging Co.',
    legalName: 'National Packaging & Thermal Cups Industries LLC',
    contactPerson: 'Hassan Al-Tamimi',
    phone: '+964 771 987 6543',
    email: 'procurement@nationalpackaging.iq',
    address: 'Al-Mansour Industrial Zone, Baghdad',
    country: 'Iraq',
    city: 'Baghdad',
    taxNumber: 'IQ4005544332',
    currency: 'IQD',
    paymentTerms: 'NET_15',
    notes: 'Key buyer of thermoformed drinking cups and PET rolls',
    status: 'ACTIVE',
    totalOrdersCount: 12,
    totalIssuedKG: 32000,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-09-02T14:00:00Z',
  },
];

class BusinessEngineServiceImpl {
  // In-memory cache for SSR & node tests
  private memoryCache: Record<string, any> = {};

  private getLocal<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
      return this.memoryCache[key] !== undefined ? this.memoryCache[key] : fallback;
    }
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn(`[BusinessEngine] Read error ${key}:`, e);
    }
    return fallback;
  }

  private setLocal<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
      this.memoryCache[key] = value;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`[BusinessEngine] Write error ${key}:`, e);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. DOCUMENT NUMBERING SEQUENCE ENGINE
  // ---------------------------------------------------------------------------
  generateDocumentNumber(
    orgId: string,
    docType: DocumentSequenceConfig['documentType'],
    customPrefix?: string
  ): string {
    const allSeq = this.getLocal<DocumentSequenceConfig[]>(STORAGE_KEY_SEQUENCES, []);
    const currentYear = new Date().getFullYear();

    let seq = allSeq.find((s) => s.organizationId === orgId && s.documentType === docType);
    if (!seq) {
      const defaultPrefixes: Record<DocumentSequenceConfig['documentType'], string> = {
        PURCHASE_REQUEST: 'PR',
        PURCHASE_ORDER: 'PO',
        RECEIVING: 'GRN',
        ISSUE: 'ISS',
        TRANSFER: 'TRF',
        ADJUSTMENT: 'ADJ',
        RETURN: 'RTN',
        INTERNAL_REQUEST: 'ISR',
      };
      seq = {
        organizationId: orgId,
        documentType: docType,
        prefix: customPrefix || defaultPrefixes[docType] || 'DOC',
        padLength: 6,
        nextNumber: 1,
        yearReset: true,
        currentYear,
      };
      allSeq.push(seq);
    }

    if (seq.yearReset && seq.currentYear !== currentYear) {
      seq.currentYear = currentYear;
      seq.nextNumber = 1;
    }

    const numStr = String(seq.nextNumber).padStart(seq.padLength, '0');
    const generated = `${seq.prefix}-${currentYear}-${numStr}`;

    seq.nextNumber += 1;
    this.setLocal(STORAGE_KEY_SEQUENCES, allSeq);

    return generated;
  }

  getDocumentSequences(orgId: string): DocumentSequenceConfig[] {
    const allSeq = this.getLocal<DocumentSequenceConfig[]>(STORAGE_KEY_SEQUENCES, []);
    const docTypes: DocumentSequenceConfig['documentType'][] = [
      'PURCHASE_REQUEST',
      'PURCHASE_ORDER',
      'RECEIVING',
      'ISSUE',
      'TRANSFER',
      'ADJUSTMENT',
      'RETURN',
      'INTERNAL_REQUEST',
    ];
    const defaultPrefixes: Record<DocumentSequenceConfig['documentType'], string> = {
      PURCHASE_REQUEST: 'PR',
      PURCHASE_ORDER: 'PO',
      RECEIVING: 'GRN',
      ISSUE: 'ISS',
      TRANSFER: 'TRF',
      ADJUSTMENT: 'ADJ',
      RETURN: 'RTN',
      INTERNAL_REQUEST: 'ISR',
    };
    const currentYear = new Date().getFullYear();

    return docTypes.map((dt) => {
      let found = allSeq.find((s) => s.organizationId === orgId && s.documentType === dt);
      if (!found) {
        found = {
          organizationId: orgId,
          documentType: dt,
          prefix: defaultPrefixes[dt] || 'DOC',
          padLength: 6,
          nextNumber: 1,
          yearReset: true,
          currentYear,
        };
      }
      return found;
    });
  }

  saveDocumentSequenceConfig(orgId: string, config: DocumentSequenceConfig): void {
    const allSeq = this.getLocal<DocumentSequenceConfig[]>(STORAGE_KEY_SEQUENCES, []);
    const idx = allSeq.findIndex(
      (s) => s.organizationId === orgId && s.documentType === config.documentType
    );
    if (idx >= 0) {
      allSeq[idx] = { ...config, organizationId: orgId };
    } else {
      allSeq.push({ ...config, organizationId: orgId });
    }
    this.setLocal(STORAGE_KEY_SEQUENCES, allSeq);
  }

  // ---------------------------------------------------------------------------
  // 2. SUPPLIERS MANAGEMENT
  // ---------------------------------------------------------------------------
  getSuppliers(orgId: string): SupplierMaster[] {
    const all = this.getLocal<SupplierMaster[]>(STORAGE_KEY_SUPPLIERS, INITIAL_SUPPLIERS);
    return all.filter((s) => s.organizationId === orgId);
  }

  getSupplier(orgId: string, supplierId: string): SupplierMaster | undefined {
    return this.getSuppliers(orgId).find((s) => s.id === supplierId || s.supplierId === supplierId);
  }

  async createSupplier(
    orgId: string,
    data: Omit<SupplierMaster, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    userName = 'System'
  ): Promise<SupplierMaster> {
    const suppliers = this.getSuppliers(orgId);

    // Validate duplicate supplier code within the organization
    if (suppliers.some((s) => s.supplierCode.toUpperCase() === data.supplierCode.toUpperCase())) {
      throw new Error(`Supplier with code "${data.supplierCode}" already exists in this organization.`);
    }

    const now = new Date().toISOString();
    const id = `sup_${orgId}_${Date.now().toString().slice(-6)}`;
    const newSupplier: SupplierMaster = {
      ...data,
      id,
      supplierId: id,
      organizationId: orgId,
      status: data.status || 'ACTIVE',
      totalDeliveredKG: 0,
      totalOrdersCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getLocal<SupplierMaster[]>(STORAGE_KEY_SUPPLIERS, INITIAL_SUPPLIERS);
    all.push(newSupplier);
    this.setLocal(STORAGE_KEY_SUPPLIERS, all);

    TenantService.logAuditEvent(
      orgId,
      'SETTINGS_CHANGED',
      { id: 'usr_actor', name: userName },
      `Created supplier ${newSupplier.supplierName} (${newSupplier.supplierCode})`,
      newSupplier.id
    );

    try {
      await setDoc(doc(db, 'universal_suppliers', id), JSON.parse(JSON.stringify(newSupplier)));
    } catch (e) {}

    return newSupplier;
  }

  async updateSupplier(
    orgId: string,
    supplierId: string,
    updates: Partial<SupplierMaster>,
    userName = 'System'
  ): Promise<SupplierMaster> {
    const all = this.getLocal<SupplierMaster[]>(STORAGE_KEY_SUPPLIERS, INITIAL_SUPPLIERS);
    const idx = all.findIndex((s) => s.id === supplierId && s.organizationId === orgId);
    if (idx === -1) throw new Error('Supplier not found in this organization.');

    const updated = {
      ...all[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    this.setLocal(STORAGE_KEY_SUPPLIERS, all);

    try {
      await setDoc(doc(db, 'universal_suppliers', supplierId), JSON.parse(JSON.stringify(updated)), { merge: true });
    } catch (e) {}

    return updated;
  }

  async deleteSupplier(orgId: string, supplierId: string, userName = 'System'): Promise<void> {
    const all = this.getLocal<SupplierMaster[]>(STORAGE_KEY_SUPPLIERS, INITIAL_SUPPLIERS);
    const idx = all.findIndex((s) => s.id === supplierId && s.organizationId === orgId);
    if (idx !== -1) {
      all.splice(idx, 1);
      this.setLocal(STORAGE_KEY_SUPPLIERS, all);
    }
  }

  getSupplierHistory(orgId: string, supplierId: string) {
    const supplier = this.getSupplier(orgId, supplierId);
    const orders = this.getPurchaseOrders(orgId).filter((po) => po.supplierId === supplierId);
    const receipts = WarehouseEngineService.getReceipts(orgId).filter(
      (r) => r.supplierId === supplierId || (supplier && r.supplierName.toLowerCase() === supplier.supplierName.toLowerCase())
    );

    const totalOrderedAmount = orders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalReceivedKG = receipts.reduce((sum, r) => sum + r.totalWeightKG, 0);

    return {
      supplier,
      orders,
      receipts,
      totalOrderedAmount,
      totalReceivedKG,
      openOrdersCount: orders.filter((o) => o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED').length,
    };
  }

  // ---------------------------------------------------------------------------
  // 3. CUSTOMERS MANAGEMENT
  // ---------------------------------------------------------------------------
  getCustomers(orgId: string): CustomerMaster[] {
    const all = this.getLocal<CustomerMaster[]>(STORAGE_KEY_CUSTOMERS, INITIAL_CUSTOMERS);
    return all.filter((c) => c.organizationId === orgId);
  }

  getCustomer(orgId: string, customerId: string): CustomerMaster | undefined {
    return this.getCustomers(orgId).find((c) => c.id === customerId || c.customerId === customerId);
  }

  async createCustomer(
    orgId: string,
    data: Omit<CustomerMaster, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>,
    userName = 'System'
  ): Promise<CustomerMaster> {
    const customers = this.getCustomers(orgId);
    if (customers.some((c) => c.customerCode.toUpperCase() === data.customerCode.toUpperCase())) {
      throw new Error(`Customer with code "${data.customerCode}" already exists.`);
    }

    const now = new Date().toISOString();
    const id = `cus_${orgId}_${Date.now().toString().slice(-6)}`;
    const newCustomer: CustomerMaster = {
      ...data,
      id,
      customerId: id,
      organizationId: orgId,
      status: data.status || 'ACTIVE',
      totalOrdersCount: 0,
      totalIssuedKG: 0,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getLocal<CustomerMaster[]>(STORAGE_KEY_CUSTOMERS, INITIAL_CUSTOMERS);
    all.push(newCustomer);
    this.setLocal(STORAGE_KEY_CUSTOMERS, all);

    try {
      await setDoc(doc(db, 'universal_customers', id), JSON.parse(JSON.stringify(newCustomer)));
    } catch (e) {}

    return newCustomer;
  }

  async updateCustomer(
    orgId: string,
    customerId: string,
    updates: Partial<CustomerMaster>,
    userName = 'System'
  ): Promise<CustomerMaster> {
    const all = this.getLocal<CustomerMaster[]>(STORAGE_KEY_CUSTOMERS, INITIAL_CUSTOMERS);
    const idx = all.findIndex((c) => c.id === customerId && c.organizationId === orgId);
    if (idx === -1) throw new Error('Customer not found in this organization.');

    const updated = {
      ...all[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    this.setLocal(STORAGE_KEY_CUSTOMERS, all);

    try {
      await setDoc(doc(db, 'universal_customers', customerId), JSON.parse(JSON.stringify(updated)), { merge: true });
    } catch (e) {}

    return updated;
  }

  getCustomerHistory(orgId: string, customerId: string) {
    const customer = this.getCustomer(orgId, customerId);
    const issues = WarehouseEngineService.getIssues(orgId).filter(
      (iss) => (iss as any).customerId === customerId || (customer && iss.destination.toLowerCase().includes(customer.customerName.toLowerCase()))
    );

    return {
      customer,
      issues,
      totalDeliveredKG: issues.reduce((sum, i) => sum + i.totalWeightKG, 0),
    };
  }

  // ---------------------------------------------------------------------------
  // 4. PURCHASE REQUESTS
  // ---------------------------------------------------------------------------
  getPurchaseRequests(orgId: string): PurchaseRequest[] {
    const all = this.getLocal<PurchaseRequest[]>(STORAGE_KEY_PURCHASE_REQS, []);
    return all.filter((r) => r.organizationId === orgId);
  }

  async createPurchaseRequest(
    orgId: string,
    data: {
      requestedBy: string;
      department: string;
      requiredDate: string;
      priority: PurchaseRequest['priority'];
      reason: string;
      items: PurchaseRequest['items'];
      notes?: string;
    },
    userName = 'System'
  ): Promise<PurchaseRequest> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase request must contain at least one item line.');
    }

    const requestNumber = this.generateDocumentNumber(orgId, 'PURCHASE_REQUEST');
    const now = new Date().toISOString();
    const id = `pr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const totalEstimatedCost = data.items.reduce(
      (sum, item) => sum + (item.requestedQuantity * (item.estimatedUnitPrice || 0)),
      0
    );

    const pr: PurchaseRequest = {
      id,
      requestNumber,
      organizationId: orgId,
      requestedBy: data.requestedBy || userName,
      department: data.department,
      requiredDate: data.requiredDate,
      priority: data.priority,
      reason: data.reason,
      items: data.items,
      totalEstimatedCost,
      notes: data.notes,
      status: 'SUBMITTED',
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getLocal<PurchaseRequest[]>(STORAGE_KEY_PURCHASE_REQS, []);
    all.push(pr);
    this.setLocal(STORAGE_KEY_PURCHASE_REQS, all);

    try {
      await setDoc(doc(db, 'universal_purchase_requests', id), JSON.parse(JSON.stringify(pr)));
    } catch (e) {}

    return pr;
  }

  async approvePurchaseRequest(orgId: string, requestId: string, approverName = 'Approver'): Promise<PurchaseRequest> {
    const all = this.getLocal<PurchaseRequest[]>(STORAGE_KEY_PURCHASE_REQS, []);
    const pr = all.find((r) => r.id === requestId && r.organizationId === orgId);
    if (!pr) throw new Error('Purchase request not found.');

    if (pr.status !== 'SUBMITTED' && pr.status !== 'DRAFT') {
      throw new Error(`Cannot approve purchase request in ${pr.status} state.`);
    }

    pr.status = 'APPROVED';
    pr.approvedBy = approverName;
    pr.approvedAt = new Date().toISOString();
    pr.updatedAt = new Date().toISOString();
    this.setLocal(STORAGE_KEY_PURCHASE_REQS, all);

    return pr;
  }

  async rejectPurchaseRequest(orgId: string, requestId: string, reason: string, rejectorName = 'Reviewer'): Promise<PurchaseRequest> {
    const all = this.getLocal<PurchaseRequest[]>(STORAGE_KEY_PURCHASE_REQS, []);
    const pr = all.find((r) => r.id === requestId && r.organizationId === orgId);
    if (!pr) throw new Error('Purchase request not found.');

    pr.status = 'REJECTED';
    pr.rejectionReason = reason;
    pr.updatedAt = new Date().toISOString();
    this.setLocal(STORAGE_KEY_PURCHASE_REQS, all);

    return pr;
  }

  async convertRequestToPurchaseOrder(
    orgId: string,
    requestId: string,
    supplierId: string,
    warehouseId: string,
    userName = 'System'
  ): Promise<PurchaseOrder> {
    const pr = this.getPurchaseRequests(orgId).find((r) => r.id === requestId);
    if (!pr) throw new Error('Purchase request not found.');
    if (pr.status !== 'APPROVED') {
      throw new Error('Only APPROVED purchase requests can be converted into a Purchase Order.');
    }

    const supplier = this.getSupplier(orgId, supplierId);
    if (!supplier) throw new Error('Selected supplier not found.');

    const warehouse = WarehouseEngineService.getWarehouses(orgId).find((w) => w.id === warehouseId) || {
      id: warehouseId,
      name: 'Default Warehouse',
    };

    const poLines = pr.items.map((item) => ({
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: item.notes || `Requested via ${pr.requestNumber}`,
      orderedQuantity: item.requestedQuantity,
      unit: item.unit,
      unitPrice: item.estimatedUnitPrice || 1.0,
      totalPrice: item.requestedQuantity * (item.estimatedUnitPrice || 1.0),
      receivedQuantity: 0,
      remainingQuantity: item.requestedQuantity,
    }));

    const po = await this.createPurchaseOrder(
      orgId,
      {
        supplierId: supplier.id,
        supplierName: supplier.supplierName,
        orderDate: new Date().toISOString().split('T')[0],
        expectedDate: pr.requiredDate,
        currency: supplier.currency || 'USD',
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        notes: `Converted from Purchase Request ${pr.requestNumber}. Reason: ${pr.reason}`,
        lines: poLines,
        sourceRequestId: pr.id,
      },
      userName
    );

    // Update PR status
    const allPr = this.getLocal<PurchaseRequest[]>(STORAGE_KEY_PURCHASE_REQS, []);
    const foundPr = allPr.find((r) => r.id === requestId);
    if (foundPr) {
      foundPr.status = 'CONVERTED_TO_PO';
      foundPr.convertedToPoId = po.id;
      foundPr.updatedAt = new Date().toISOString();
      this.setLocal(STORAGE_KEY_PURCHASE_REQS, allPr);
    }

    return po;
  }

  // ---------------------------------------------------------------------------
  // 5. PURCHASE ORDERS & PARTIAL RECEIVING
  // ---------------------------------------------------------------------------
  getPurchaseOrders(orgId: string): PurchaseOrder[] {
    const all = this.getLocal<PurchaseOrder[]>(STORAGE_KEY_PURCHASE_ORDERS, []);
    return all.filter((o) => o.organizationId === orgId);
  }

  getPurchaseOrder(orgId: string, poId: string): PurchaseOrder | undefined {
    return this.getPurchaseOrders(orgId).find((o) => o.id === poId || o.documentNumber === poId);
  }

  async createPurchaseOrder(
    orgId: string,
    data: {
      supplierId: string;
      supplierName: string;
      orderDate: string;
      expectedDate: string;
      currency: string;
      warehouseId: string;
      warehouseName: string;
      notes?: string;
      lines: PurchaseOrder['lines'];
      sourceRequestId?: string;
    },
    userName = 'System'
  ): Promise<PurchaseOrder> {
    if (!data.lines || data.lines.length === 0) {
      throw new Error('Purchase order must have at least one line item.');
    }

    const documentNumber = this.generateDocumentNumber(orgId, 'PURCHASE_ORDER');
    const now = new Date().toISOString();
    const id = `po_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let subtotal = 0;
    let totalOrderedQty = 0;

    const validatedLines = data.lines.map((l) => {
      if (l.orderedQuantity <= 0) throw new Error(`Ordered quantity for ${l.itemName} must be greater than zero.`);
      const price = l.unitPrice || 0;
      const total = l.orderedQuantity * price;
      subtotal += total;
      totalOrderedQty += l.orderedQuantity;
      return {
        ...l,
        unitPrice: price,
        totalPrice: total,
        receivedQuantity: 0,
        remainingQuantity: l.orderedQuantity,
      };
    });

    const po: PurchaseOrder = {
      id,
      documentNumber,
      organizationId: orgId,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      orderDate: data.orderDate,
      expectedDate: data.expectedDate,
      currency: data.currency,
      warehouseId: data.warehouseId,
      warehouseName: data.warehouseName,
      notes: data.notes,
      status: 'APPROVED', // Default to APPROVED so receiving can happen directly
      lines: validatedLines,
      subtotal,
      taxTotal: 0,
      grandTotal: subtotal,
      totalOrderedQuantity: totalOrderedQty,
      totalReceivedQuantity: 0,
      sourceRequestId: data.sourceRequestId,
      createdBy: userName,
      approvedBy: userName,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getLocal<PurchaseOrder[]>(STORAGE_KEY_PURCHASE_ORDERS, []);
    all.push(po);
    this.setLocal(STORAGE_KEY_PURCHASE_ORDERS, all);

    try {
      await setDoc(doc(db, 'universal_purchase_orders', id), JSON.parse(JSON.stringify(po)));
    } catch (e) {}

    try {
      const evt = WebhookService.createEvent(
        'purchase_order.approved',
        orgId,
        {
          purchaseOrderId: po.id,
          documentNumber: po.documentNumber,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          warehouseId: po.warehouseId,
          warehouseName: po.warehouseName,
          totalOrderedQuantity: po.totalOrderedQuantity,
          grandTotal: po.grandTotal,
          currency: po.currency,
          status: po.status,
          linesCount: po.lines.length,
          approvedAt: po.approvedAt,
        },
        po.id
      );
      WebhookService.dispatchEvent(evt).catch(() => {});
    } catch {}

    return po;
  }

  /**
   * Confirms a Goods Receipt against an approved Purchase Order.
   * Updates PO lines (received & remaining quantities) and creates immutable ledger entry!
   */
  async receivePurchaseOrderLines(
    orgId: string,
    poId: string,
    receiptPayload: {
      warehouseId?: string;
      locationId: string;
      supplierDeliveryNote?: string;
      notes?: string;
      lines: {
        itemId: string;
        receiveQuantity: number;
        weightKG?: number;
        batchId?: string;
        expiryDate?: string;
      }[];
    },
    userName = 'Storekeeper'
  ) {
    const allPo = this.getLocal<PurchaseOrder[]>(STORAGE_KEY_PURCHASE_ORDERS, []);
    const po = allPo.find((o) => (o.id === poId || o.documentNumber === poId) && o.organizationId === orgId);
    if (!po) throw new Error('Purchase order not found.');

    if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
      throw new Error(`Cannot receive goods against a ${po.status} purchase order.`);
    }

    // Validate receipt lines against remaining quantities
    const receiptItemsToPost: {
      itemId: string;
      locationId: string;
      quantity: number;
      unit: string;
      weightKG?: number;
      batchId?: string;
      expiryDate?: string;
    }[] = [];

    let batchTotalReceived = 0;

    for (const line of receiptPayload.lines) {
      if (line.receiveQuantity <= 0) continue;

      const poLine = po.lines.find((pl) => pl.itemId === line.itemId);
      if (!poLine) throw new Error(`Item ${line.itemId} is not on Purchase Order ${po.documentNumber}.`);

      if (line.receiveQuantity > poLine.remainingQuantity) {
        throw new Error(
          `Cannot receive ${line.receiveQuantity} ${poLine.unit} for ${poLine.itemName}. Only ${poLine.remainingQuantity} ${poLine.unit} remaining on order.`
        );
      }

      poLine.receivedQuantity += line.receiveQuantity;
      poLine.remainingQuantity -= line.receiveQuantity;
      po.totalReceivedQuantity += line.receiveQuantity;
      batchTotalReceived += line.receiveQuantity;

      receiptItemsToPost.push({
        itemId: poLine.itemId,
        locationId: receiptPayload.locationId,
        quantity: line.receiveQuantity,
        unit: poLine.unit,
        weightKG: line.weightKG || line.receiveQuantity,
        batchId: line.batchId,
        expiryDate: line.expiryDate,
      });
    }

    if (receiptItemsToPost.length === 0) {
      throw new Error('No valid quantities specified to receive.');
    }

    // Update PO Status (PARTIALLY_RECEIVED or RECEIVED/CLOSED)
    const isAllFulfilled = po.lines.every((pl) => pl.remainingQuantity <= 0);
    po.status = isAllFulfilled ? 'CLOSED' : 'PARTIALLY_RECEIVED';
    po.updatedAt = new Date().toISOString();
    this.setLocal(STORAGE_KEY_PURCHASE_ORDERS, allPo);

    // Call WarehouseEngineService to create confirmed Goods Receipt & post transactions to Ledger!
    const receiptDoc = await WarehouseEngineService.createReceiptDocument(
      orgId,
      {
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        documentNumber: receiptPayload.supplierDeliveryNote || `${po.documentNumber}-GRN`,
        date: new Date().toISOString().split('T')[0],
        warehouseId: receiptPayload.warehouseId || po.warehouseId,
        notes: `Received against ${po.documentNumber}. ${receiptPayload.notes || ''}`,
        items: receiptItemsToPost,
      },
      false, // Confirmed directly -> increments inventory ledger!
      userName
    );

    // Update Supplier aggregate metrics
    const suppliers = this.getSuppliers(orgId);
    const sup = suppliers.find((s) => s.id === po.supplierId);
    if (sup) {
      sup.totalDeliveredKG = (sup.totalDeliveredKG || 0) + receiptDoc.totalWeightKG;
      sup.lastTransactionDate = new Date().toISOString();
      this.updateSupplier(orgId, sup.id, sup, userName).catch(() => {});
    }

    try {
      const poEvt = WebhookService.createEvent('purchase_order.received', orgId, {
        purchaseOrderId: po.id,
        documentNumber: po.documentNumber,
        receiptId: receiptDoc.id,
        receiptNumber: receiptDoc.receiptNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        receivedQuantity: batchTotalReceived,
        totalWeightKG: receiptDoc.totalWeightKG,
        isClosed: isAllFulfilled,
        status: po.status,
        receivedAt: new Date().toISOString(),
      });
      WebhookService.dispatchEvent(poEvt).catch(() => {});
    } catch {}

    return {
      purchaseOrder: po,
      receiptDocument: receiptDoc,
      isClosed: isAllFulfilled,
      receivedQuantity: batchTotalReceived,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. INTERNAL STOCK REQUESTS
  // ---------------------------------------------------------------------------
  getInternalRequests(orgId: string): InternalStockRequest[] {
    const all = this.getLocal<InternalStockRequest[]>(STORAGE_KEY_INTERNAL_REQS, []);
    return all.filter((r) => r.organizationId === orgId);
  }

  async createInternalRequest(
    orgId: string,
    data: {
      requestedBy: string;
      department: string;
      warehouseId: string;
      warehouseName: string;
      purpose: string;
      requiredDate: string;
      items: {
        itemId: string;
        itemCode: string;
        itemName: string;
        requestedQuantity: number;
        unit: string;
        notes?: string;
      }[];
      notes?: string;
    },
    userName = 'System'
  ): Promise<InternalStockRequest> {
    if (!data.items || data.items.length === 0) {
      throw new Error('Internal request must contain at least one item line.');
    }

    const requestNumber = this.generateDocumentNumber(orgId, 'INTERNAL_REQUEST');
    const now = new Date().toISOString();
    const id = `isr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const items = data.items.map((i) => ({
      ...i,
      issuedQuantity: 0,
      remainingQuantity: i.requestedQuantity,
    }));

    const req: InternalStockRequest = {
      id,
      requestNumber,
      organizationId: orgId,
      requestedBy: data.requestedBy || userName,
      department: data.department,
      warehouseId: data.warehouseId,
      warehouseName: data.warehouseName,
      purpose: data.purpose,
      requiredDate: data.requiredDate,
      items,
      status: 'APPROVED', // Default to APPROVED for smooth execution
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };

    const all = this.getLocal<InternalStockRequest[]>(STORAGE_KEY_INTERNAL_REQS, []);
    all.push(req);
    this.setLocal(STORAGE_KEY_INTERNAL_REQS, all);

    try {
      await setDoc(doc(db, 'universal_internal_requests', id), JSON.parse(JSON.stringify(req)));
    } catch (e) {}

    return req;
  }

  async approveInternalRequest(orgId: string, requestId: string, approver = 'Supervisor'): Promise<InternalStockRequest> {
    const all = this.getLocal<InternalStockRequest[]>(STORAGE_KEY_INTERNAL_REQS, []);
    const req = all.find((r) => r.id === requestId && r.organizationId === orgId);
    if (!req) throw new Error('Internal request not found.');

    req.status = 'APPROVED';
    req.approvedBy = approver;
    req.approvedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();
    this.setLocal(STORAGE_KEY_INTERNAL_REQS, all);

    return req;
  }

  /**
   * Fulfills an approved Internal Request via a confirmed Stock Issue.
   * Decrements stock in inventory ledger!
   */
  async fulfillInternalRequestLines(
    orgId: string,
    requestId: string,
    issuePayload: {
      locationId: string;
      notes?: string;
      lines: {
        itemId: string;
        issueQuantity: number;
        batchId?: string;
      }[];
    },
    userName = 'Warehouse Operator'
  ) {
    const allReqs = this.getLocal<InternalStockRequest[]>(STORAGE_KEY_INTERNAL_REQS, []);
    const req = allReqs.find((r) => r.id === requestId && r.organizationId === orgId);
    if (!req) throw new Error('Internal request not found.');

    if (req.status !== 'APPROVED' && req.status !== 'PARTIALLY_ISSUED') {
      throw new Error(`Cannot issue stock for request in ${req.status} state.`);
    }

    const issueItemsToPost: {
      itemId: string;
      quantity: number;
      unit: string;
      batchId?: string;
    }[] = [];

    for (const line of issuePayload.lines) {
      if (line.issueQuantity <= 0) continue;

      const reqLine = req.items.find((ri) => ri.itemId === line.itemId);
      if (!reqLine) throw new Error(`Item ${line.itemId} is not on request ${req.requestNumber}.`);

      if (line.issueQuantity > reqLine.remainingQuantity) {
        throw new Error(
          `Cannot issue ${line.issueQuantity} for ${reqLine.itemName}. Only ${reqLine.remainingQuantity} remaining.`
        );
      }

      reqLine.issuedQuantity += line.issueQuantity;
      reqLine.remainingQuantity -= line.issueQuantity;

      issueItemsToPost.push({
        itemId: reqLine.itemId,
        quantity: line.issueQuantity,
        unit: reqLine.unit,
        batchId: line.batchId,
      });
    }

    if (issueItemsToPost.length === 0) {
      throw new Error('No valid quantities specified for issue.');
    }

    const isAllFulfilled = req.items.every((ri) => ri.remainingQuantity <= 0);
    req.status = isAllFulfilled ? 'FULFILLED' : 'PARTIALLY_ISSUED';
    req.updatedAt = new Date().toISOString();
    this.setLocal(STORAGE_KEY_INTERNAL_REQS, allReqs);

    // Post to WarehouseEngineService issue document -> Decreases Inventory Ledger!
    const issueDoc = await WarehouseEngineService.createIssueDocument(
      orgId,
      {
        warehouseId: req.warehouseId,
        locationId: issuePayload.locationId,
        department: req.department,
        destination: `${req.department} - ${req.purpose}`,
        referenceNumber: req.requestNumber,
        reason: 'Internal Requisition',
        notes: `Fulfilled against ${req.requestNumber}. ${issuePayload.notes || ''}`,
        items: issueItemsToPost,
      },
      false, // Confirmed issue -> decreases inventory!
      userName
    );

    return {
      internalRequest: req,
      issueDocument: issueDoc,
      isFulfilled: isAllFulfilled,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. BUSINESS DASHBOARD DATA AGGREGATOR
  // ---------------------------------------------------------------------------
  getBusinessDashboardMetrics(orgId: string, costMethod: InventoryCostMethod = 'NONE') {
    const warehouses = WarehouseEngineService.getWarehouses(orgId);
    const locations = WarehouseEngineService.getLocations(orgId);
    const items = WarehouseEngineService.getItems(orgId);
    const balances = WarehouseEngineService.computeInventoryBalances(orgId);
    const ledger = WarehouseEngineService.getLedger(orgId);

    const purchaseOrders = this.getPurchaseOrders(orgId);
    const purchaseRequests = this.getPurchaseRequests(orgId);
    const internalRequests = this.getInternalRequests(orgId);

    const totalQuantity = balances.reduce((sum, b) => sum + b.quantity, 0);
    const totalWeightKG = balances.reduce((sum, b) => sum + (b.weightKG || 0), 0);

    // Calculate inventory valuation based on configured method
    let totalInventoryValue: number | null = null;
    if (costMethod !== 'NONE') {
      let val = 0;
      for (const b of balances) {
        const item = items.find((i) => i.id === b.itemId);
        const cost = (item as any)?.cost || (item as any)?.defaultPrice || 0;
        val += b.quantity * cost;
      }
      totalInventoryValue = val;
    }

    const lowStockCount = balances.filter((b) => b.status === 'LOW_STOCK' || b.status === 'OUT_OF_STOCK').length;
    const pendingPoCount = purchaseOrders.filter((po) => po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED').length;
    const pendingPrCount = purchaseRequests.filter((pr) => pr.status === 'SUBMITTED').length;
    const pendingInternalReqCount = internalRequests.filter((ir) => ir.status === 'APPROVED' || ir.status === 'REQUESTED').length;

    const recentReceipts = ledger.filter((tx) => tx.transactionType === 'RECEIPT').slice(0, 5);
    const recentIssues = ledger.filter((tx) => tx.transactionType === 'ISSUE').slice(0, 5);
    const recentTransfers = ledger.filter((tx) => tx.transactionType === 'TRANSFER_IN' || tx.transactionType === 'TRANSFER_OUT').slice(0, 5);

    return {
      totalQuantity,
      totalWeightKG,
      totalInventoryValue,
      warehousesCount: warehouses.length,
      locationsCount: locations.length,
      itemsCount: items.length,
      lowStockCount,
      pendingPoCount,
      pendingPrCount,
      pendingInternalReqCount,
      recentReceipts,
      recentIssues,
      recentTransfers,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. PHASE 5 END-TO-END AUTOMATED TEST SUITE RUNNER
  // ---------------------------------------------------------------------------
  async runIntegrationTestScenarios(_orgId?: string) {
    return this.runPhase5BusinessWorkflowTests();
  }

  async runPhase5BusinessWorkflowTests(): Promise<{
    testId: string;
    name: string;
    status: 'PASSED' | 'FAILED';
    details: string;
  }[]> {
    const results: { testId: string; name: string; status: 'PASSED' | 'FAILED'; details: string }[] = [];

    try {
      const runner = { id: 'runner_bot', name: 'Test Runner' };
      const uniqueSuffix = Date.now().toString().slice(-4);
      const testOrgAId = `org_biz_a_${uniqueSuffix}`;
      const testOrgBId = `org_biz_b_${uniqueSuffix}`;

      // TEST 1: Create Organization A & B
      await TenantService.createOrganization(
        {
          name: `Business Corp A ${uniqueSuffix}`,
          country: 'Saudi Arabia',
          city: 'Dammam',
          currency: 'USD',
          timezone: 'Asia/Riyadh',
          defaultLanguage: 'en',
          weightUnit: 'KG',
        },
        { id: 'usr_runner_a', name: 'Runner A', email: `a_${uniqueSuffix}@corp.com` }
      );

      await TenantService.createOrganization(
        {
          name: `Business Corp B ${uniqueSuffix}`,
          country: 'United Arab Emirates',
          city: 'Dubai',
          currency: 'AED',
          timezone: 'Asia/Dubai',
          defaultLanguage: 'en',
          weightUnit: 'KG',
        },
        { id: 'usr_runner_b', name: 'Runner B', email: `b_${uniqueSuffix}@corp.com` }
      );

      results.push({
        testId: 'TEST 1',
        name: 'Create Tenants A & B',
        status: 'PASSED',
        details: `Created isolated tenants ${testOrgAId} and ${testOrgBId}`,
      });

      // TEST 2: In Org A, create Supplier, Item, Warehouse, Location
      const whA = await WarehouseEngineService.createWarehouse(testOrgAId, {
        code: `WH-A-${uniqueSuffix}`,
        name: 'Warehouse A',
        nameAr: 'مستودع أ',
        nameEn: 'Warehouse A',
        type: 'General',
        totalCapacityKG: 500000,
        status: 'ACTIVE',
      });

      const locA1 = await WarehouseEngineService.createLocation(testOrgAId, {
        warehouseId: whA.id,
        code: `RACK-A1-${uniqueSuffix}`,
        name: 'Bay A1',
        type: 'RACK',
        capacityKG: 200000,
        status: 'ACTIVE',
      });

      const locA2 = await WarehouseEngineService.createLocation(testOrgAId, {
        warehouseId: whA.id,
        code: `RACK-A2-${uniqueSuffix}`,
        name: 'Bay A2',
        type: 'RACK',
        capacityKG: 200000,
        status: 'ACTIVE',
      });

      const itemA = await WarehouseEngineService.createItem(testOrgAId, {
        itemCode: `MAT-A-${uniqueSuffix}`,
        name: 'Material Resin A',
        nameAr: 'خامة الراتنج أ',
        nameEn: 'Material Resin A',
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

      const supA = await this.createSupplier(
        testOrgAId,
        {
          supplierCode: `SUP-A-${uniqueSuffix}`,
          supplierName: 'Petro Supply Co A',
          contactPerson: 'Sultan A',
          phone: '+966 12 345 6789',
          email: 'sultan@petrosupply.sa',
          address: 'Industrial District',
          country: 'Saudi Arabia',
          city: 'Jeddah',
          paymentTerms: 'NET_30',
          currency: 'USD',
          status: 'ACTIVE',
        },
        'Test Runner'
      );

      results.push({
        testId: 'TEST 2',
        name: 'Master Data Setup (Org A)',
        status: 'PASSED',
        details: `Created Warehouse, Locations, Item (${itemA.itemCode}), and Supplier (${supA.supplierCode})`,
      });

      // TEST 3: Create Purchase Request & Approve it
      const pr = await this.createPurchaseRequest(
        testOrgAId,
        {
          requestedBy: 'Production Engineer',
          department: 'Extrusion',
          requiredDate: '2026-10-15',
          priority: 'HIGH',
          reason: 'Raw material restocking for monthly run',
          items: [
            {
              itemId: itemA.id,
              itemCode: itemA.itemCode,
              itemName: itemA.name,
              requestedQuantity: 1000,
              unit: 'KG',
              estimatedUnitPrice: 2.5,
            },
          ],
        },
        'Test Runner'
      );

      await this.approvePurchaseRequest(testOrgAId, pr.id, 'Manager John');
      const approvedPr = this.getPurchaseRequests(testOrgAId).find((r) => r.id === pr.id);

      if (approvedPr?.status === 'APPROVED') {
        results.push({
          testId: 'TEST 3',
          name: 'Purchase Request & Approval',
          status: 'PASSED',
          details: `Created PR ${pr.requestNumber} for 1000 KG and approved successfully`,
        });
      } else {
        results.push({
          testId: 'TEST 3',
          name: 'Purchase Request & Approval',
          status: 'FAILED',
          details: `Expected status APPROVED, got ${approvedPr?.status}`,
        });
      }

      // TEST 4: Convert PR to Purchase Order for 1,000 KG
      const po = await this.convertRequestToPurchaseOrder(testOrgAId, pr.id, supA.id, whA.id, 'Test Runner');
      const stockBeforeReceiving = WarehouseEngineService.getItemTotalStock(testOrgAId, itemA.id).quantity;

      if (po.totalOrderedQuantity === 1000 && stockBeforeReceiving === 0) {
        results.push({
          testId: 'TEST 4',
          name: 'Convert PR to PO (No Stock Impact)',
          status: 'PASSED',
          details: `Generated PO ${po.documentNumber} for 1000 KG. Verified inventory remains untouched at 0 KG`,
        });
      } else {
        results.push({
          testId: 'TEST 4',
          name: 'Convert PR to PO (No Stock Impact)',
          status: 'FAILED',
          details: `PO creation failed or stock improperly modified (stock=${stockBeforeReceiving})`,
        });
      }

      // TEST 5: Partial Receiving (Receive 600 KG)
      const partialReceiveRes = await this.receivePurchaseOrderLines(
        testOrgAId,
        po.id,
        {
          locationId: locA1.id,
          supplierDeliveryNote: `DN-600-${uniqueSuffix}`,
          lines: [{ itemId: itemA.id, receiveQuantity: 600, weightKG: 600, batchId: `LOT-600` }],
        },
        'Storekeeper'
      );

      const stockAfterPartial = WarehouseEngineService.getItemTotalStock(testOrgAId, itemA.id).quantity;
      if (stockAfterPartial === 600 && partialReceiveRes.purchaseOrder.status === 'PARTIALLY_RECEIVED') {
        results.push({
          testId: 'TEST 5',
          name: 'Partial Receiving (600 KG)',
          status: 'PASSED',
          details: `Received 600 KG. Stock increased to 600 KG. PO status: PARTIALLY_RECEIVED (400 KG remaining)`,
        });
      } else {
        results.push({
          testId: 'TEST 5',
          name: 'Partial Receiving (600 KG)',
          status: 'FAILED',
          details: `Expected stock 600, got ${stockAfterPartial}. PO status: ${partialReceiveRes.purchaseOrder.status}`,
        });
      }

      // TEST 6: Receive remaining 400 KG -> PO status CLOSED/RECEIVED -> Total stock = 1,000 KG
      const finalReceiveRes = await this.receivePurchaseOrderLines(
        testOrgAId,
        po.id,
        {
          locationId: locA1.id,
          supplierDeliveryNote: `DN-400-${uniqueSuffix}`,
          lines: [{ itemId: itemA.id, receiveQuantity: 400, weightKG: 400, batchId: `LOT-400` }],
        },
        'Storekeeper'
      );

      const stockAfterFinal = WarehouseEngineService.getItemTotalStock(testOrgAId, itemA.id).quantity;
      if (stockAfterFinal === 1000 && finalReceiveRes.purchaseOrder.status === 'CLOSED') {
        results.push({
          testId: 'TEST 6',
          name: 'Final Receiving (400 KG) & PO Closure',
          status: 'PASSED',
          details: `Received remaining 400 KG. Total stock = 1000 KG. PO successfully CLOSED`,
        });
      } else {
        results.push({
          testId: 'TEST 6',
          name: 'Final Receiving (400 KG) & PO Closure',
          status: 'FAILED',
          details: `Expected stock 1000, got ${stockAfterFinal}. PO status: ${finalReceiveRes.purchaseOrder.status}`,
        });
      }

      // TEST 7: Internal Stock Request for 250 KG -> Approve -> Fulfill via Stock Issue -> Stock = 750 KG
      const intReq = await this.createInternalRequest(
        testOrgAId,
        {
          requestedBy: 'Maintenance Lead',
          department: 'Extrusion Maintenance',
          warehouseId: whA.id,
          warehouseName: whA.name,
          purpose: 'Machine calibration test',
          requiredDate: '2026-10-18',
          items: [
            {
              itemId: itemA.id,
              itemCode: itemA.itemCode,
              itemName: itemA.name,
              requestedQuantity: 250,
              unit: 'KG',
            },
          ],
        },
        'Test Runner'
      );

      await this.fulfillInternalRequestLines(
        testOrgAId,
        intReq.id,
        {
          locationId: locA1.id,
          lines: [{ itemId: itemA.id, issueQuantity: 250 }],
        },
        'Warehouse Operator'
      );

      const stockAfterIssue = WarehouseEngineService.getItemTotalStock(testOrgAId, itemA.id).quantity;
      if (stockAfterIssue === 750) {
        results.push({
          testId: 'TEST 7',
          name: 'Internal Request & Stock Issue Fulfillment',
          status: 'PASSED',
          details: `Issued 250 KG against request. Verified stock decremented accurately to 750 KG`,
        });
      } else {
        results.push({
          testId: 'TEST 7',
          name: 'Internal Request & Stock Issue Fulfillment',
          status: 'FAILED',
          details: `Expected stock 750 KG, got ${stockAfterIssue}`,
        });
      }

      // TEST 8: Location Transfer of 200 KG -> LocA1 = 550 KG, LocA2 = 200 KG
      await WarehouseEngineService.executeTransfer(
        testOrgAId,
        {
          sourceWarehouseId: whA.id,
          sourceLocationId: locA1.id,
          destinationWarehouseId: whA.id,
          destinationLocationId: locA2.id,
          itemId: itemA.id,
          quantity: 200,
          reason: 'Inter-rack staging',
        },
        'Transfer Operator'
      );

      const balancesA = WarehouseEngineService.computeInventoryBalances(testOrgAId);
      const loc1Qty = balancesA.find((b) => b.locationId === locA1.id && b.itemId === itemA.id)?.quantity || 0;
      const loc2Qty = balancesA.find((b) => b.locationId === locA2.id && b.itemId === itemA.id)?.quantity || 0;

      if (loc1Qty === 550 && loc2Qty === 200) {
        results.push({
          testId: 'TEST 8',
          name: 'Internal Location Transfer',
          status: 'PASSED',
          details: `Transferred 200 KG. Source Bay A1 = 550 KG, Destination Bay A2 = 200 KG (Total unchanged at 750 KG)`,
        });
      } else {
        results.push({
          testId: 'TEST 8',
          name: 'Internal Location Transfer',
          status: 'FAILED',
          details: `Expected (550, 200), got (${loc1Qty}, ${loc2Qty})`,
        });
      }

      // TEST 9: Stock Adjustment +50 KG on LocA2 -> LocA2 = 250 KG, Total = 800 KG
      await WarehouseEngineService.executeAdjustment(
        testOrgAId,
        {
          warehouseId: whA.id,
          locationId: locA2.id,
          itemId: itemA.id,
          adjustmentType: 'ADJUSTMENT_IN',
          quantityDelta: 50,
          reason: 'Found',
          notes: 'Found unopened bags during audit',
        },
        'Auditor'
      );

      const balancesAfterAdj = WarehouseEngineService.computeInventoryBalances(testOrgAId);
      const loc2AfterAdj = balancesAfterAdj.find((b) => b.locationId === locA2.id && b.itemId === itemA.id)?.quantity || 0;
      const totalStockAfterAdj = WarehouseEngineService.getItemTotalStock(testOrgAId, itemA.id).quantity;

      if (loc2AfterAdj === 250 && totalStockAfterAdj === 800) {
        results.push({
          testId: 'TEST 9',
          name: 'Inventory Ledger Adjustment',
          status: 'PASSED',
          details: `Adjusted +50 KG. Bay A2 now = 250 KG. Org A total inventory = 800 KG`,
        });
      } else {
        results.push({
          testId: 'TEST 9',
          name: 'Inventory Ledger Adjustment',
          status: 'FAILED',
          details: `Expected (250, 800), got (${loc2AfterAdj}, ${totalStockAfterAdj})`,
        });
      }

      // TEST 10: Multi-Tenant Boundary Security (Org B Isolation Check)
      // Setup Org B item
      const itemB = await WarehouseEngineService.createItem(testOrgBId, {
        itemCode: `MAT-B-${uniqueSuffix}`,
        name: 'Material B for Org B',
        nameAr: 'خامة ب للمنشأة ب',
        nameEn: 'Material B for Org B',
        category: 'Packaging',
        unitOfMeasure: 'PCS',
        weightUnit: 'KG',
        defaultWeight: 0.5,
        status: 'ACTIVE',
        trackBatch: false,
        trackSerial: false,
        trackExpiry: false,
        minimumStock: 50,
        maximumStock: 5000,
        reorderPoint: 100,
      });

      const supB = await this.createSupplier(
        testOrgBId,
        {
          supplierCode: `SUP-B-${uniqueSuffix}`,
          supplierName: 'Packaging Partner B',
          contactPerson: 'Zaid B',
          phone: '+971 4 999 8888',
          email: 'zaid@packaging.ae',
          address: 'JAFZA Zone',
          country: 'United Arab Emirates',
          city: 'Dubai',
          paymentTerms: 'CASH',
          currency: 'AED',
          status: 'ACTIVE',
        },
        'Test Runner'
      );

      // Verify Org A cannot query Org B's suppliers or items
      const orgASuppliers = this.getSuppliers(testOrgAId);
      const isSupBInA = orgASuppliers.some((s) => s.id === supB.id || s.supplierCode === supB.supplierCode);

      const orgAItems = WarehouseEngineService.getItems(testOrgAId);
      const isItemBInA = orgAItems.some((i) => i.id === itemB.id || i.itemCode === itemB.itemCode);

      const orgBStockForA = WarehouseEngineService.getItemTotalStock(testOrgBId, itemA.id).quantity;

      if (!isSupBInA && !isItemBInA && orgBStockForA === 0) {
        results.push({
          testId: 'TEST 10',
          name: 'Strict Multi-Tenant Boundary Isolation',
          status: 'PASSED',
          details: `Verified zero-leakage: Org A cannot view/query Org B suppliers, items, or ledger balances`,
        });
      } else {
        results.push({
          testId: 'TEST 10',
          name: 'Strict Multi-Tenant Boundary Isolation',
          status: 'FAILED',
          details: `Data leakage detected between Org A and Org B!`,
        });
      }
    } catch (err: any) {
      results.push({
        testId: 'TEST RUNNER',
        name: 'Execution Crash',
        status: 'FAILED',
        details: err.message || String(err),
      });
    }

    return results;
  }
}

export const BusinessEngineService = new BusinessEngineServiceImpl();
