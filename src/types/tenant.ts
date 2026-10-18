/**
 * GENERAL-PURPOSE MULTI-TENANT WAREHOUSE MANAGEMENT PLATFORM
 * SaaS Tenant & Organization Contracts
 * 
 * Hierarchy:
 * PLATFORM -> ORGANIZATION (Tenant) -> USERS -> WAREHOUSES -> LOCATIONS -> ITEMS -> INVENTORY -> TRANSACTIONS
 */

export interface OrganizationModulesConfig {
  inventory?: boolean;
  purchasing?: boolean;
  suppliers?: boolean;
  customers?: boolean;
  barcode?: boolean;
  qr?: boolean;
  batch?: boolean;
  serial?: boolean;
  expiry?: boolean;
  quality?: boolean;
  weighing?: boolean;
  production?: boolean;
  manufacturing?: boolean;
  shredding?: boolean;
  recycling?: boolean;
  maintenance?: boolean;
  advancedReporting?: boolean;
  reservations?: boolean;
  cycleCount?: boolean;
  containers?: boolean;
  // Legacy & AL-KARWAN specific keys
  weighbridge?: boolean;
  receiving?: boolean;
  storage?: boolean;
  reconciler?: boolean;
  rfid?: boolean;
  predictive?: boolean;
  excelMigration?: boolean;
  shiftOptimizer?: boolean;
  qualityControl?: boolean;
}

export interface OrganizationCodeConfig {
  storageCode: string;            // Default document code for general warehouse intake & storage (e.g. 167)
  productionCode: string;         // Default document code for production line issuance (e.g. 546)
  recyclingReceiptCode: string;   // Default document code for reclaimed / regrind intake (e.g. 360)
  recyclingMoveCode: string;      // Default document code for recycling internal movement / scrap (e.g. 352)
  receivingPrefix?: string;       // Prefix for inbound shipments (e.g. 'RCV')
  issuePrefix?: string;           // Prefix for dispatch issues (e.g. 'ISS')
  transferPrefix?: string;        // Prefix for location transfers (e.g. 'TRF')
}

export type OrganizationStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'PENDING' | 'ARCHIVED';

export type TenantPermission =
  | 'VIEW_INVENTORY'
  | 'RECEIVE'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUST'
  | 'STOCK_COUNT'
  | 'MANAGE_ITEMS'
  | 'MANAGE_WAREHOUSES'
  | 'MANAGE_LOCATIONS'
  | 'MANAGE_SUPPLIERS'
  | 'VIEW_REPORTS'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'PLATFORM_ADMIN'
  | 'BILLING_VIEW'
  | 'BILLING_MANAGE'
  | 'SUBSCRIPTION_VIEW'
  | 'SUBSCRIPTION_MANAGE'
  | 'INVOICES_VIEW'
  | 'MANAGE_INTEGRATIONS';

export interface TenantRole {
  id: string;
  organizationId: string;
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  isCustom?: boolean;
  permissions: TenantPermission[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  joinedAt?: string;
  invitedBy?: string;
  invitedAt?: string;
}

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  invitedBy: string;
  inviterName: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

export interface OrganizationOptionalModules {
  inventory: boolean;
  purchasing: boolean;
  suppliers: boolean;
  customers: boolean;
  production: boolean;
  manufacturing: boolean;
  barcode: boolean;
  batchTracking: boolean;
  serialTracking: boolean;
  expiryTracking: boolean;
  qualityControl: boolean;
}

export interface OrganizationInventoryPreferences {
  defaultCurrency: string;
  defaultWeightUnit: 'KG' | 'LBS' | 'MT';
  defaultQuantityUnit: string;
  allowNegativeStock: boolean;
  defaultBatchTracking: boolean;
  defaultSerialTracking: boolean;
  defaultExpiryTracking: boolean;
}

export interface OrganizationDocumentPrefixes {
  receiptPrefix: string;
  issuePrefix: string;
  transferPrefix: string;
  adjustmentPrefix: string;
  returnPrefix: string;
  countPrefix: string;
}

export interface OrganizationAuditRecord {
  id: string;
  organizationId: string;
  action:
    | 'ORGANIZATION_CREATED'
    | 'ORGANIZATION_UPDATED'
    | 'USER_INVITED'
    | 'INVITATION_ACCEPTED'
    | 'USER_SUSPENDED'
    | 'USER_ACTIVATED'
    | 'USER_REMOVED'
    | 'ROLE_CREATED'
    | 'ROLE_MODIFIED'
    | 'PERMISSIONS_CHANGED'
    | 'SETTINGS_CHANGED'
    | 'ORGANIZATION_ARCHIVED';
  performerId: string;
  performerName: string;
  targetId?: string;
  details: string;
  timestamp: string;
}

export interface Organization {
  id: string;                      // Stable unique tenant ID, e.g. 'org_alkarwan'
  organizationId?: string;         // Alias for id
  slug: string;                    // Subdomain/URL-friendly identifier, e.g. 'alkarwan'
  name?: string;                   // Unified display name
  nameAr: string;                  // Organization name in Arabic
  nameEn: string;                  // Organization name in English
  legalName?: string;              // Registered legal business entity name
  logo?: string;                   // Logo icon / image URL
  logoUrl?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  industry: 'Manufacturing' | 'Logistics' | 'Retail' | 'Plastics & Polymers' | 'Food & Beverage' | 'General';
  status: OrganizationStatus;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  country: string;
  city?: string;
  address?: string;
  phone?: string;
  contactPhone?: string;
  email?: string;
  contactEmail?: string;
  website?: string;
  currency: string;                // e.g. 'USD', 'IQD', 'SAR', 'AED'
  timezone: string;                // e.g. 'Asia/Baghdad', 'UTC'
  defaultLanguage: 'ar' | 'en';
  dateFormat?: string;             // e.g. 'YYYY-MM-DD', 'DD/MM/YYYY'
  weightUnit: 'KG' | 'LBS' | 'MT';
  ownerUserId?: string;
  warehouses?: any[];
  enabledModules: OrganizationModulesConfig;
  optionalModules?: OrganizationOptionalModules;
  inventoryPreferences?: OrganizationInventoryPreferences;
  documentPrefixes?: OrganizationDocumentPrefixes;
  codeConfig: OrganizationCodeConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * Baseline Test / Exemplary Organizations
 * AL-KARWAN is converted into an example tenant within the platform.
 */
export const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_alkarwan',
    organizationId: 'org_alkarwan',
    slug: 'alkarwan',
    name: 'شركة الكروان لإنتاج الألواح والأكواب البلاستيكية',
    nameAr: 'شركة الكروان لإنتاج الألواح والأكواب البلاستيكية',
    nameEn: 'AL-KARWAN Plastics & Packaging Industries',
    legalName: 'Al-Karwan Co. for Plastic & Thermal Cups Manufacturing LLC',
    city: 'Baghdad',
    address: 'Industrial Zone - Sector 4, Baghdad, Iraq',
    phone: '+964 770 123 4567',
    contactPhone: '+964 770 123 4567',
    email: 'info@alkarwan-factory.com',
    contactEmail: 'info@alkarwan-factory.com',
    dateFormat: 'YYYY-MM-DD',
    descriptionAr: 'مصنع رائد في إنتاج الألواح البلاستيكية وتشكيل الأكواب الحرارية وإعادة تدوير البوليمرات.',
    descriptionEn: 'Flagship manufacturing plant for plastic sheet extrusion, thermoforming cups, and polymer recycling.',
    industry: 'Plastics & Polymers',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    country: 'Iraq',
    currency: 'IQD',
    timezone: 'Asia/Baghdad',
    defaultLanguage: 'ar',
    weightUnit: 'KG',
    enabledModules: {
      weighbridge: true,
      receiving: true,
      storage: true,
      production: true,
      recycling: true,
      reconciler: true,
      rfid: true,
      predictive: true,
      excelMigration: true,
      shiftOptimizer: true,
      qualityControl: true,
      maintenance: true,
    },
    codeConfig: {
      storageCode: '167',
      productionCode: '546',
      recyclingReceiptCode: '360',
      recyclingMoveCode: '352',
      receivingPrefix: 'RCV',
      issuePrefix: 'ISS',
      transferPrefix: 'MOV',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'org_apex_logistics',
    organizationId: 'org_apex_logistics',
    slug: 'apex-logistics',
    name: 'Apex Global Logistics & Distribution Hub',
    nameAr: 'أبيكس للخدمات اللوجستية والمستودعات العامة',
    nameEn: 'Apex Global Logistics & Distribution Hub',
    legalName: 'Apex Global Logistics FZ-LLC',
    city: 'Dubai',
    address: 'Dubai South Logistics District, UAE',
    phone: '+971 4 800 9000',
    contactPhone: '+971 4 800 9000',
    email: 'support@apexlogistics.ae',
    contactEmail: 'support@apexlogistics.ae',
    dateFormat: 'DD/MM/YYYY',
    descriptionAr: 'مركز توزيع ومستودعات مركزية للبضائع العامة وسلاسل التوريد السريعة.',
    descriptionEn: 'Modern fulfillment hub for multi-client distribution, cross-docking, and high-velocity staging.',
    industry: 'Logistics',
    status: 'ACTIVE',
    plan: 'PROFESSIONAL',
    country: 'United Arab Emirates',
    currency: 'AED',
    timezone: 'Asia/Dubai',
    defaultLanguage: 'en',
    weightUnit: 'KG',
    enabledModules: {
      weighbridge: true,
      receiving: true,
      storage: true,
      production: false,
      recycling: false,
      reconciler: true,
      rfid: true,
      predictive: true,
      excelMigration: true,
      shiftOptimizer: true,
      qualityControl: true,
      maintenance: false,
    },
    codeConfig: {
      storageCode: '101',
      productionCode: '202',
      recyclingReceiptCode: '303',
      recyclingMoveCode: '304',
      receivingPrefix: 'APX-RCV',
      issuePrefix: 'APX-OUT',
      transferPrefix: 'APX-TRF',
    },
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'org_demo_fmcg',
    organizationId: 'org_demo_fmcg',
    slug: 'demo-fmcg',
    name: 'Modern FMCG Distribution & Cold Storage',
    nameAr: 'المجموعة الحديثة للأغذية والتوزيع التجاري',
    nameEn: 'Modern FMCG Distribution & Cold Storage',
    legalName: 'Modern Food & Consumer Goods Logistics JSC',
    city: 'Riyadh',
    address: 'Al Sulay Warehouse Zone, Riyadh, Saudi Arabia',
    phone: '+966 11 456 7890',
    contactPhone: '+966 11 456 7890',
    email: 'operations@modernfmcg.sa',
    contactEmail: 'operations@modernfmcg.sa',
    dateFormat: 'YYYY-MM-DD',
    descriptionAr: 'مستودعات مبردة ومستودعات جافة لتوزيع المواد الاستهلاكية سريعة الدوران.',
    descriptionEn: 'Cold-chain and ambient warehouse network for consumer packaged goods.',
    industry: 'Food & Beverage',
    status: 'ACTIVE',
    plan: 'STARTER',
    country: 'Saudi Arabia',
    currency: 'SAR',
    timezone: 'Asia/Riyadh',
    defaultLanguage: 'ar',
    weightUnit: 'MT',
    enabledModules: {
      weighbridge: true,
      receiving: true,
      storage: true,
      production: false,
      recycling: false,
      reconciler: true,
      rfid: false,
      predictive: true,
      excelMigration: true,
      shiftOptimizer: false,
      qualityControl: true,
      maintenance: false,
    },
    codeConfig: {
      storageCode: '110',
      productionCode: '220',
      recyclingReceiptCode: '330',
      recyclingMoveCode: '331',
      receivingPrefix: 'FMCG-IN',
      issuePrefix: 'FMCG-OUT',
      transferPrefix: 'FMCG-MOV',
    },
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-10-06T00:00:00Z',
  },
];

export const DEFAULT_TENANT_ROLES: TenantRole[] = [
  {
    id: 'role_owner',
    organizationId: '*',
    key: 'OWNER',
    nameAr: 'مالك المنشأة (Owner)',
    nameEn: 'Organization Owner',
    descriptionAr: 'صلاحيات كاملة للمنشأة بما فيها الإعدادات، المستخدمين، والمستودعات',
    descriptionEn: 'Full ownership clearance over the organization, users, and warehouses',
    permissions: [
      'VIEW_INVENTORY',
      'RECEIVE',
      'ISSUE',
      'TRANSFER',
      'ADJUST',
      'STOCK_COUNT',
      'MANAGE_ITEMS',
      'MANAGE_WAREHOUSES',
      'MANAGE_LOCATIONS',
      'MANAGE_SUPPLIERS',
      'VIEW_REPORTS',
      'MANAGE_USERS',
      'MANAGE_SETTINGS',
      'BILLING_VIEW',
      'BILLING_MANAGE',
      'SUBSCRIPTION_VIEW',
      'SUBSCRIPTION_MANAGE',
      'INVOICES_VIEW',
      'MANAGE_INTEGRATIONS',
    ],
  },
  {
    id: 'role_admin',
    organizationId: '*',
    key: 'ADMIN',
    nameAr: 'مدير المنشأة (Admin)',
    nameEn: 'Administrator',
    descriptionAr: 'إدارة العمليات والمستخدمين والمستودعات والإعدادات',
    descriptionEn: 'Manage operations, users, settings, and warehouses',
    permissions: [
      'VIEW_INVENTORY',
      'RECEIVE',
      'ISSUE',
      'TRANSFER',
      'ADJUST',
      'STOCK_COUNT',
      'MANAGE_ITEMS',
      'MANAGE_WAREHOUSES',
      'MANAGE_LOCATIONS',
      'MANAGE_SUPPLIERS',
      'VIEW_REPORTS',
      'MANAGE_USERS',
      'MANAGE_SETTINGS',
      'BILLING_VIEW',
      'BILLING_MANAGE',
      'SUBSCRIPTION_VIEW',
      'SUBSCRIPTION_MANAGE',
      'INVOICES_VIEW',
      'MANAGE_INTEGRATIONS',
    ],
  },
  {
    id: 'role_manager',
    organizationId: '*',
    key: 'WAREHOUSE_MANAGER',
    nameAr: 'مدير المستودع (Warehouse Manager)',
    nameEn: 'Warehouse Manager',
    descriptionAr: 'إدارة حركة البضائع والاستلام والصرف والجرد والأصناف',
    descriptionEn: 'Manage all inventory, receipts, issues, counts, and catalog',
    permissions: [
      'VIEW_INVENTORY',
      'RECEIVE',
      'ISSUE',
      'TRANSFER',
      'ADJUST',
      'STOCK_COUNT',
      'MANAGE_ITEMS',
      'MANAGE_WAREHOUSES',
      'MANAGE_LOCATIONS',
      'MANAGE_SUPPLIERS',
      'VIEW_REPORTS',
    ],
  },
  {
    id: 'role_worker',
    organizationId: '*',
    key: 'WAREHOUSE_WORKER',
    nameAr: 'عامل مستودع (Warehouse Worker)',
    nameEn: 'Warehouse Worker',
    descriptionAr: 'تنفيذ عمليات الاستلام والصرف والمناقلة والاطلاع على الأرصدة',
    descriptionEn: 'Execute receipts, issues, transfers, and view stock',
    permissions: ['VIEW_INVENTORY', 'RECEIVE', 'ISSUE', 'TRANSFER'],
  },
  {
    id: 'role_purchasing',
    organizationId: '*',
    key: 'PURCHASING',
    nameAr: 'المشتريات والتوريد (Purchasing)',
    nameEn: 'Purchasing',
    descriptionAr: 'إدارة الموردين واستلام البضائع ومتابعة التقارير',
    descriptionEn: 'Manage suppliers, receipts, and purchasing reports',
    permissions: ['VIEW_INVENTORY', 'RECEIVE', 'MANAGE_SUPPLIERS', 'VIEW_REPORTS'],
  },
  {
    id: 'role_production',
    organizationId: '*',
    key: 'PRODUCTION',
    nameAr: 'الإنتاج والتشغيل (Production)',
    nameEn: 'Production',
    descriptionAr: 'طلب وصرف المواد ومتابعة الأرصدة',
    descriptionEn: 'Material requests, consumption issues, and stock visibility',
    permissions: ['VIEW_INVENTORY', 'ISSUE', 'TRANSFER'],
  },
  {
    id: 'role_viewer',
    organizationId: '*',
    key: 'VIEWER',
    nameAr: 'مستعرض / مراقب (Viewer)',
    nameEn: 'Viewer',
    descriptionAr: 'الاطلاع فقط على تقارير وأرصدة المخزون',
    descriptionEn: 'Read-only access to inventory and reports',
    permissions: ['VIEW_INVENTORY', 'VIEW_REPORTS'],
  },
];
