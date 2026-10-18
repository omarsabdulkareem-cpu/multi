/**
 * SECURE API AUTHENTICATION & GRANULAR PERMISSIONS CONTRACTS (PHASE 14.2)
 * Universal Warehouse Management Platform
 */

export type ApiScope =
  | 'items:read'
  | 'warehouses:read'
  | 'locations:read'
  | 'inventory:read'
  | 'receipts:read'
  | 'receipts:create'
  | 'issues:read'
  | 'issues:create'
  | 'transfers:read'
  | 'transfers:create'
  | 'adjustments:read'
  | 'adjustments:create'
  | 'suppliers:read'
  | 'customers:read'
  | 'purchase_orders:read'
  | 'purchase_orders:create'
  | 'reports:read'
  | 'webhooks:read'
  | 'webhooks:write';

export interface ApiScopeDefinition {
  scope: ApiScope;
  category: 'CATALOG' | 'INVENTORY' | 'LOGISTICS_IN' | 'LOGISTICS_OUT' | 'TRANSFERS' | 'ADJUSTMENTS' | 'PURCHASING' | 'REPORTS' | 'INTEGRATIONS';
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  isWriteAction: boolean;
}

export const ALL_API_SCOPES: ApiScopeDefinition[] = [
  {
    scope: 'items:read',
    category: 'CATALOG',
    labelEn: 'Read Items & Materials',
    labelAr: 'قراءة الأصناف والخامات',
    descriptionEn: 'View item catalog, categories, specifications, and SKU master data.',
    descriptionAr: 'استعراض دليل الأصناف، التصنيفات، المواصفات والباركود.',
    isWriteAction: false,
  },
  {
    scope: 'warehouses:read',
    category: 'CATALOG',
    labelEn: 'Read Warehouses',
    labelAr: 'قراءة المستودعات',
    descriptionEn: 'View warehouse facilities, operating status, and capacity metadata.',
    descriptionAr: 'استعراض بيانات المستودعات والمرافق التشغيلية.',
    isWriteAction: false,
  },
  {
    scope: 'locations:read',
    category: 'CATALOG',
    labelEn: 'Read Storage Locations',
    labelAr: 'قراءة مواقع التخزين',
    descriptionEn: 'View storage bins, racks, zones, and location identifiers.',
    descriptionAr: 'استعراض مواقع التخزين والرفوف والقطاعات الداخلية.',
    isWriteAction: false,
  },
  {
    scope: 'inventory:read',
    category: 'INVENTORY',
    labelEn: 'Read Inventory Balances',
    labelAr: 'قراءة أرصدة المخزون',
    descriptionEn: 'Query current stock on hand, available quantities, and location balances.',
    descriptionAr: 'استعلام الأرصدة الحالية الفعلية والمتاحة لكل موقع.',
    isWriteAction: false,
  },
  {
    scope: 'receipts:read',
    category: 'LOGISTICS_IN',
    labelEn: 'Read Goods Receipts',
    labelAr: 'قراءة سندات الاستلام',
    descriptionEn: 'Query inbound shipments, supplier delivery documents, and receipts history.',
    descriptionAr: 'استعراض سجل وسندات استلام البضائع والتوريد.',
    isWriteAction: false,
  },
  {
    scope: 'receipts:create',
    category: 'LOGISTICS_IN',
    labelEn: 'Create Goods Receipts',
    labelAr: 'إنشاء سندات استلام',
    descriptionEn: 'Post inbound receipts to intake inventory into authorized warehouses.',
    descriptionAr: 'تسجيل وقيد سندات استلام بضاعة جديدة وإدخالها للمستودع.',
    isWriteAction: true,
  },
  {
    scope: 'issues:read',
    category: 'LOGISTICS_OUT',
    labelEn: 'Read Stock Issues',
    labelAr: 'قراءة سندات الصرف',
    descriptionEn: 'Query outbound dispatches, production issuances, and delivery waybills.',
    descriptionAr: 'استعراض سندات صرف المواد وأذون الخروج.',
    isWriteAction: false,
  },
  {
    scope: 'issues:create',
    category: 'LOGISTICS_OUT',
    labelEn: 'Create Stock Issues',
    labelAr: 'إنشاء سندات صرف',
    descriptionEn: 'Issue stock out of warehouse locations to production lines or customers.',
    descriptionAr: 'قيد سندات صرف بضاعة من المستودع للإنتاج أو العملاء.',
    isWriteAction: true,
  },
  {
    scope: 'transfers:read',
    category: 'TRANSFERS',
    labelEn: 'Read Stock Transfers',
    labelAr: 'قراءة مناقلات المخزون',
    descriptionEn: 'View inter-warehouse and inter-bin stock movements.',
    descriptionAr: 'استعراض حركة المناقلات بين المستودعات والمواقع.',
    isWriteAction: false,
  },
  {
    scope: 'transfers:create',
    category: 'TRANSFERS',
    labelEn: 'Create Stock Transfers',
    labelAr: 'إنشاء مناقلات مخزون',
    descriptionEn: 'Execute atomic inventory transfers between authorized locations.',
    descriptionAr: 'تنفيذ مناقلات مخزنية متزامنة بين المواقع المصرح بها.',
    isWriteAction: true,
  },
  {
    scope: 'adjustments:read',
    category: 'ADJUSTMENTS',
    labelEn: 'Read Stock Adjustments',
    labelAr: 'قراءة التسويات الجردية',
    descriptionEn: 'View audited inventory adjustments, variances, and discrepancy reasons.',
    descriptionAr: 'استعراض سجل التسويات الجردية والفروقات وأسباب التعديل.',
    isWriteAction: false,
  },
  {
    scope: 'adjustments:create',
    category: 'ADJUSTMENTS',
    labelEn: 'Create Stock Adjustments',
    labelAr: 'إنشاء تسويات جردية',
    descriptionEn: 'Post supervised inventory adjustments with mandatory reason codes.',
    descriptionAr: 'قيد تسويات جردية معتمدة مع تحديد سبب التعديل الإلزامي.',
    isWriteAction: true,
  },
  {
    scope: 'suppliers:read',
    category: 'PURCHASING',
    labelEn: 'Read Suppliers',
    labelAr: 'قراءة الموردين',
    descriptionEn: 'View supplier directory, contact info, and business terms.',
    descriptionAr: 'استعراض قائمة الموردين وبيانات الاتصال والتعاقد.',
    isWriteAction: false,
  },
  {
    scope: 'customers:read',
    category: 'PURCHASING',
    labelEn: 'Read Customers',
    labelAr: 'قراءة العملاء',
    descriptionEn: 'View customer directory and delivery destinations.',
    descriptionAr: 'استعراض دليل العملاء وجهات التسليم.',
    isWriteAction: false,
  },
  {
    scope: 'purchase_orders:read',
    category: 'PURCHASING',
    labelEn: 'Read Purchase Orders',
    labelAr: 'قراءة أوامر الشراء',
    descriptionEn: 'Query purchase orders, order lines, and fulfillment statuses.',
    descriptionAr: 'استعراض أوامر الشراء وحالات التوريد والاستلام.',
    isWriteAction: false,
  },
  {
    scope: 'purchase_orders:create',
    category: 'PURCHASING',
    labelEn: 'Create Purchase Orders',
    labelAr: 'إنشاء أوامر شراء',
    descriptionEn: 'Issue new draft purchase orders to registered suppliers.',
    descriptionAr: 'إنشاء أوامر شراء جديدة للموردين المعتمدين.',
    isWriteAction: true,
  },
  {
    scope: 'reports:read',
    category: 'REPORTS',
    labelEn: 'Read Reports & Summaries',
    labelAr: 'قراءة تقارير ومؤشرات المخزون',
    descriptionEn: 'Access aggregated warehouse operational and inventory KPI summaries.',
    descriptionAr: 'الاطلاع على ملخصات الأرصدة وتقارير حركة المخزون التشغيلية.',
    isWriteAction: false,
  },
  {
    scope: 'webhooks:read',
    category: 'INTEGRATIONS',
    labelEn: 'Read Webhooks & Delivery Logs',
    labelAr: 'قراءة الويب هوك وسجلات الإرسال',
    descriptionEn: 'View registered webhook endpoints and delivery attempt logs.',
    descriptionAr: 'استعراض نقاط اتصال الويب هوك وسجلات محاولات الإرسال.',
    isWriteAction: false,
  },
  {
    scope: 'webhooks:write',
    category: 'INTEGRATIONS',
    labelEn: 'Manage Webhook Subscriptions',
    labelAr: 'إدارة الويب هوك والاشتراك في الأحداث',
    descriptionEn: 'Register, update, rotate signing secrets, test, and revoke webhook endpoints.',
    descriptionAr: 'تسجيل وتحديث وتدوير مفاتيح واختبار وإلغاء نقاط اتصال الويب هوك.',
    isWriteAction: true,
  },
];

export interface IdempotencyRecord {
  key: string;
  organizationId: string;
  endpoint: string;
  statusCode: number;
  responseBody: any;
  createdAt: string;
}

export type IntegrationStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface ApiIntegrationCredential {
  id: string;                      // Unique ID, e.g. 'int_98a72b1c'
  organizationId: string;          // Strictly assigned server-side
  name: string;
  description: string;
  scopes: ApiScope[];
  keyPrefix: string;               // e.g. 'wh_live_a1b2c3d4...' (safe to display)
  secretHash: string;              // Cryptographic hash of high-entropy secret (never plaintext)
  status: IntegrationStatus;
  rateLimitPerMinute: number;      // Configurable rate limit (default: 60 req/min)
  createdBy: string;               // User ID of administrator who provisioned
  createdByName: string;
  createdAt: string;
  expiresAt: string | null;        // Null for no expiration, or ISO timestamp
  lastUsedAt: string | null;
  lastUsedIp?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokedReason?: string;
}

export interface CreateIntegrationRequest {
  name: string;
  description?: string;
  scopes: ApiScope[];
  expiresInDays?: number | null;   // e.g. 30, 60, 90, 365, null
  rateLimitPerMinute?: number;
}

export interface CreateIntegrationResponse {
  integration: Omit<ApiIntegrationCredential, 'secretHash'>;
  rawSecret: string;               // Returned ONLY ONCE upon creation
}

export interface RotateIntegrationResponse {
  integration: Omit<ApiIntegrationCredential, 'secretHash'>;
  rawSecret: string;               // Returned ONLY ONCE upon rotation
}

export type ApiAuditAction =
  | 'INTEGRATION_CREATED'
  | 'INTEGRATION_ROTATED'
  | 'INTEGRATION_REVOKED'
  | 'AUTH_FAILURE_MISSING'
  | 'AUTH_FAILURE_INVALID'
  | 'AUTH_FAILURE_EXPIRED'
  | 'AUTH_FAILURE_REVOKED'
  | 'AUTH_FAILURE_INACTIVE_ORG'
  | 'AUTHORIZATION_FAILURE_SCOPE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CROSS_TENANT_ACCESS_BLOCKED'
  | 'SENSITIVE_API_EXECUTION'
  | 'WEBHOOK_ENDPOINT_CREATED'
  | 'WEBHOOK_ENDPOINT_ROTATED'
  | 'WEBHOOK_ENDPOINT_REVOKED'
  | 'WEBHOOK_DELIVERY_RETRIED';

export interface ApiAuditLog {
  id: string;
  organizationId: string;
  integrationId?: string;
  integrationName?: string;
  action: ApiAuditAction;
  endpoint: string;
  method: string;
  ipAddress?: string;
  userAgent?: string;
  details: string;
  timestamp: string;
  success: boolean;
}

export interface AuthenticatedApiContext {
  integration: ApiIntegrationCredential;
  organizationId: string;
  scopes: ApiScope[];
}
