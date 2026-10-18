/**
 * COMMERCIAL MULTI-TENANT SAAS & SUBSCRIPTION DOMAIN CONTRACTS (PHASE 7)
 * 
 * Hierarchy:
 * PLATFORM -> SUBSCRIPTION PLANS -> ORGANIZATIONS -> SUBSCRIPTIONS -> USERS -> WAREHOUSES -> INVENTORY
 */

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED';

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type PlanTier = 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';

export interface SubscriptionPlanLimits {
  maxUsers: number | null;                // null means unlimited
  maxWarehouses: number | null;
  maxLocations: number | null;
  maxItems: number | null;
  maxMonthlyTransactions: number | null;
  maxStorageGB: number | null;
  maxSuppliers: number | null;
  maxCustomers: number | null;
  maxProductionOrders: number | null;
  maxApiCalls: number | null;
  maxBarcodeOperations: number | null;
}

export interface SubscriptionPlanFeatures {
  inventory: boolean;
  purchasing: boolean;
  suppliers: boolean;
  customers: boolean;
  barcode: boolean;
  qr: boolean;
  batch: boolean;
  serial: boolean;
  expiry: boolean;
  quality: boolean;
  weighing: boolean;
  production: boolean;
  manufacturing: boolean;
  processing: boolean;
  recycling: boolean;
  advancedReports: boolean;
  api: boolean;
  mobile: boolean;
  multiWarehouse: boolean;
  advancedPermissions: boolean;
}

export interface SubscriptionPlan {
  planId: string;
  tier: PlanTier;
  version: number;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  active: boolean;
  trialDays: number;
  limits: SubscriptionPlanLimits;
  features: SubscriptionPlanFeatures;
  modules: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationSubscription {
  subscriptionId: string;
  organizationId: string;
  planId: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  startDate: string;
  trialStartDate?: string;
  trialEndDate?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  cancelAtPeriodEnd?: boolean;
  suspendedAt?: string;
  gracePeriodEnd?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  paymentProvider: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationBillingSettings {
  billingContact: string;
  billingEmail: string;
  billingAddress: string;
  billingCity?: string;
  billingCountry: string;
  taxNumber: string;
  preferredCurrency: string;
  invoiceNotes?: string;
}

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'FAILED' | 'VOID' | 'REFUNDED';

export interface OrganizationInvoice {
  invoiceId: string;
  organizationId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  providerInvoiceId?: string;
  description?: string;
  downloadUrl?: string;
}

export type SubscriptionEventType =
  | 'TRIAL_STARTED'
  | 'TRIAL_EXTENDED'
  | 'TRIAL_EXPIRED'
  | 'PLAN_CHANGED'
  | 'UPGRADED'
  | 'DOWNGRADED'
  | 'ACTIVATED'
  | 'SUSPENDED'
  | 'RESUMED'
  | 'CANCELLED'
  | 'RENEWED'
  | 'GRACE_PERIOD_STARTED';

export interface SubscriptionEvent {
  id: string;
  organizationId: string;
  subscriptionId: string;
  event: SubscriptionEventType;
  previousState?: string;
  newState: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WebhookEventRecord {
  eventId: string;
  provider: string;
  eventType: string;
  receivedAt: string;
  processedAt?: string;
  status: 'PROCESSED' | 'FAILED' | 'IGNORED';
  payload: Record<string, any>;
}

export interface OrganizationUsageMetrics {
  organizationId: string;
  usersCount: number;
  warehousesCount: number;
  locationsCount: number;
  itemsCount: number;
  monthlyTransactionsCount: number;
  storageUsedGB: number;
  suppliersCount: number;
  customersCount: number;
  productionOrdersCount: number;
  apiCallsCount: number;
  barcodeOperationsCount: number;
  lastCalculatedAt: string;
}

export interface EntitlementEvaluation {
  allowed: boolean;
  current: number;
  limit: number | null;
  percentage?: number;
  reason?: string;
  upgradeRequired?: boolean;
}

export interface SubscriptionGuardResult {
  allowed: boolean;
  status: SubscriptionStatus;
  isReadOnly: boolean;
  messageAr: string;
  messageEn: string;
  canAccessBilling: boolean;
}

export interface PlatformMetrics {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  gracePeriodOrganizations: number;
  suspendedOrganizations: number;
  cancelledOrganizations: number;
  activeSubscriptions: number;
  monthlyRecurringRevenue: number | null;
  annualRecurringRevenue: number | null;
  trialConversionRate: number | null;
  organizationsNearingLimits: number;
  recentRegistrations: {
    id: string;
    name: string;
    plan: string;
    status: string;
    date: string;
  }[];
}

/**
 * Default SaaS Subscription Plans Seed
 */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    planId: 'plan_starter_v1',
    tier: 'STARTER',
    version: 1,
    name: 'Starter Warehouse',
    nameAr: 'المستودع المبتدئ (Starter)',
    description: 'Essential multi-location inventory for small businesses and trading facilities.',
    descriptionAr: 'حل أساسي لإدارة المخزون والتوريد للمنشآت التجارية الصغيرة والمتاجر.',
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: 'USD',
    active: true,
    trialDays: 14,
    limits: {
      maxUsers: 3,
      maxWarehouses: 2,
      maxLocations: 20,
      maxItems: 500,
      maxMonthlyTransactions: 2500,
      maxStorageGB: 5,
      maxSuppliers: 15,
      maxCustomers: 15,
      maxProductionOrders: 0,
      maxApiCalls: 500,
      maxBarcodeOperations: 2000,
    },
    features: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: false,
      serial: false,
      expiry: false,
      quality: false,
      weighing: false,
      production: false,
      manufacturing: false,
      processing: false,
      recycling: false,
      advancedReports: false,
      api: false,
      mobile: true,
      multiWarehouse: false,
      advancedPermissions: false,
    },
    modules: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    planId: 'plan_pro_v1',
    tier: 'PROFESSIONAL',
    version: 1,
    name: 'Professional Logistics',
    nameAr: 'اللوجستيات الاحترافية (Professional)',
    description: 'Advanced batch tracking, scales, quality control, and expanded multi-warehouse capacity.',
    descriptionAr: 'تتبع الشحنات واللوت، أوزان القبان، إدارة الجودة، ومستودعات متعددة لشركات التوزيع والتجارة.',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    currency: 'USD',
    active: true,
    trialDays: 14,
    limits: {
      maxUsers: 10,
      maxWarehouses: 5,
      maxLocations: 100,
      maxItems: 5000,
      maxMonthlyTransactions: 25000,
      maxStorageGB: 25,
      maxSuppliers: 100,
      maxCustomers: 100,
      maxProductionOrders: 50,
      maxApiCalls: 5000,
      maxBarcodeOperations: 25000,
    },
    features: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: true,
      serial: true,
      expiry: true,
      quality: true,
      weighing: true,
      production: false,
      manufacturing: false,
      processing: false,
      recycling: false,
      advancedReports: true,
      api: true,
      mobile: true,
      multiWarehouse: true,
      advancedPermissions: true,
    },
    modules: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: true,
      serial: true,
      expiry: true,
      quality: true,
      weighing: true,
      advancedReports: true,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    planId: 'plan_business_v1',
    tier: 'BUSINESS',
    version: 1,
    name: 'Business Manufacturing',
    nameAr: 'الأعمال والإنتاج الصناعي (Business)',
    description: 'Full bill-of-materials, production orders, shredding/processing, containers, and extended capacity.',
    descriptionAr: 'معادلات المواد (BOM)، أوامر التشغيل والإنتاج، إعادة التدوير، الحاويات والشلايف، وسعة متقدمة.',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    currency: 'USD',
    active: true,
    trialDays: 14,
    limits: {
      maxUsers: 25,
      maxWarehouses: 15,
      maxLocations: 500,
      maxItems: 25000,
      maxMonthlyTransactions: 100000,
      maxStorageGB: 100,
      maxSuppliers: 500,
      maxCustomers: 500,
      maxProductionOrders: 500,
      maxApiCalls: 25000,
      maxBarcodeOperations: 100000,
    },
    features: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: true,
      serial: true,
      expiry: true,
      quality: true,
      weighing: true,
      production: true,
      manufacturing: true,
      processing: true,
      recycling: true,
      advancedReports: true,
      api: true,
      mobile: true,
      multiWarehouse: true,
      advancedPermissions: true,
    },
    modules: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: true,
      serial: true,
      expiry: true,
      quality: true,
      weighing: true,
      production: true,
      processing: true,
      recycling: true,
      maintenance: true,
      advancedReports: true,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
  {
    planId: 'plan_enterprise_v1',
    tier: 'ENTERPRISE',
    version: 1,
    name: 'Enterprise Industrial Suite',
    nameAr: 'المؤسسات والمجمعات الصناعية (Enterprise)',
    description: 'Unlimited scale, dedicated multi-plant support, custom integrations, SLAs, and unlimited operations.',
    descriptionAr: 'سعة غير محدودة، دعم مجمعات المصانع الضخمة، تكامل واجهات API مخصصة، واتفاقيات مستوى خدمة متقدمة.',
    monthlyPrice: 699,
    yearlyPrice: 6990,
    currency: 'USD',
    active: true,
    trialDays: 30,
    limits: {
      maxUsers: null,                // unlimited
      maxWarehouses: null,           // unlimited
      maxLocations: null,            // unlimited
      maxItems: null,                // unlimited
      maxMonthlyTransactions: null,  // unlimited
      maxStorageGB: null,            // unlimited
      maxSuppliers: null,            // unlimited
      maxCustomers: null,            // unlimited
      maxProductionOrders: null,     // unlimited
      maxApiCalls: null,             // unlimited
      maxBarcodeOperations: null,    // unlimited
    },
    features: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: true,
      serial: true,
      expiry: true,
      quality: true,
      weighing: true,
      production: true,
      manufacturing: true,
      processing: true,
      recycling: true,
      advancedReports: true,
      api: true,
      mobile: true,
      multiWarehouse: true,
      advancedPermissions: true,
    },
    modules: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      barcode: true,
      qr: true,
      batch: true,
      serial: true,
      expiry: true,
      quality: true,
      weighing: true,
      production: true,
      processing: true,
      recycling: true,
      maintenance: true,
      reservations: true,
      cycleCount: true,
      containers: true,
      advancedReporting: true,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  },
];
