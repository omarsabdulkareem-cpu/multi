/**
 * SECURE WEBHOOKS & EVENT DELIVERY CONTRACTS (PHASE 14.4)
 * Universal Warehouse Management Platform
 */

export type WebhookEventType =
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
  | 'integration.test';

export interface WebhookEventDefinition {
  type: WebhookEventType;
  category: 'INVENTORY' | 'LOGISTICS' | 'PURCHASING' | 'CATALOG' | 'SYSTEM';
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
}

export const ALL_WEBHOOK_EVENT_TYPES: WebhookEventDefinition[] = [
  {
    type: 'inventory.receipt.confirmed',
    category: 'INVENTORY',
    labelEn: 'Goods Receipt Confirmed',
    labelAr: 'تأكيد استلام بضاعة',
    descriptionEn: 'Emitted when an inbound goods receipt is confirmed and inventory balances are credited.',
    descriptionAr: 'يتم إرساله عند تأكيد استلام بضاعة وإيداع الكميات في رصيد المستودع.',
  },
  {
    type: 'inventory.issue.confirmed',
    category: 'INVENTORY',
    labelEn: 'Stock Issue Confirmed',
    labelAr: 'تأكيد صرف مواد',
    descriptionEn: 'Emitted when outbound stock is issued and deducted from physical inventory.',
    descriptionAr: 'يتم إرساله عند اعتماد صرف خامات وخصمها من الرصيد الفعلي.',
  },
  {
    type: 'inventory.transfer.completed',
    category: 'INVENTORY',
    labelEn: 'Stock Transfer Completed',
    labelAr: 'اكتمال مناقلة مخزنية',
    descriptionEn: 'Emitted when an inter-warehouse or inter-bin transfer is fully recorded.',
    descriptionAr: 'يتم إرساله عند تنفيذ مناقلة بين المستودعات أو الرفوف بنجاح.',
  },
  {
    type: 'inventory.adjustment.confirmed',
    category: 'INVENTORY',
    labelEn: 'Inventory Adjustment Posted',
    labelAr: 'قيد تسوية جردية',
    descriptionEn: 'Emitted when an audited variance adjustment is committed to the ledger with reason.',
    descriptionAr: 'يتم إرساله عند اعتماد تسوية مخزنية وتعديل الرصيد مع توثيق السبب.',
  },
  {
    type: 'inventory.return.confirmed',
    category: 'INVENTORY',
    labelEn: 'Material Return Confirmed',
    labelAr: 'تأكيد إرجاع بضاعة',
    descriptionEn: 'Emitted when customer or production returns are received back into stock.',
    descriptionAr: 'يتم إرساله عند قيد مرتجع بضاعة وإعادته للمخزن.',
  },
  {
    type: 'inventory.stocktake.completed',
    category: 'INVENTORY',
    labelEn: 'Physical Stocktake Count Completed',
    labelAr: 'اكتمال جلسة جرد فعلي',
    descriptionEn: 'Emitted when a physical stocktake session is approved and variance ledger is sealed.',
    descriptionAr: 'يتم إرساله عند إغلاق جلسة جرد مخزني دوري واعتماد الفروقات.',
  },
  {
    type: 'purchase_order.approved',
    category: 'PURCHASING',
    labelEn: 'Purchase Order Approved',
    labelAr: 'اعتماد أمر شراء',
    descriptionEn: 'Emitted when a draft purchase order receives management approval.',
    descriptionAr: 'يتم إرساله عند الموافقة الرسمية على أمر الشراء وتأكيده للمورد.',
  },
  {
    type: 'purchase_order.received',
    category: 'PURCHASING',
    labelEn: 'Purchase Order Goods Received',
    labelAr: 'استلام بضاعة أمر الشراء',
    descriptionEn: 'Emitted when order lines are fulfilled by supplier deliveries.',
    descriptionAr: 'يتم إرساله عند استلام بنود أمر الشراء ودخولها للمستودع.',
  },
  {
    type: 'item.created',
    category: 'CATALOG',
    labelEn: 'Item Master Created',
    labelAr: 'إنشاء صنف جديد',
    descriptionEn: 'Emitted when a new raw material, packaging, or product SKU is added.',
    descriptionAr: 'يتم إرساله عند تسجيل مادة أو صنف جديد في دليل الأصناف.',
  },
  {
    type: 'item.updated',
    category: 'CATALOG',
    labelEn: 'Item Master Updated',
    labelAr: 'تحديث بيانات صنف',
    descriptionEn: 'Emitted when item specifications, weights, or categories are updated.',
    descriptionAr: 'يتم إرساله عند تعديل مواصفات الصنف أو وزنه أو تصنيفه.',
  },
  {
    type: 'warehouse.created',
    category: 'CATALOG',
    labelEn: 'Warehouse Facility Created',
    labelAr: 'إنشاء مستودع جديد',
    descriptionEn: 'Emitted when a new warehouse site or storage facility is provisioned.',
    descriptionAr: 'يتم إرساله عند إضافة منشأة أو مستودع تخزين جديد للمنظومة.',
  },
  {
    type: 'integration.test',
    category: 'SYSTEM',
    labelEn: 'Webhook Integration Test Event',
    labelAr: 'حدث اختبار الربط البرمجي',
    descriptionEn: 'Manual ping event used to verify listener connectivity and signature verification.',
    descriptionAr: 'حدث تجريبي للتحقق من اتصال الخادم والتحقق من صحة التوقيع الرقمي.',
  },
];

export type WebhookStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED';

export interface WebhookEndpoint {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  url: string;
  subscribedEvents: WebhookEventType[];
  status: WebhookStatus;
  secretHash: string; // HMAC secret hashed for safe storage
  keyPrefix: string;  // e.g. "whsec_a8b9..." for recognition
  createdAt: string;
  updatedAt: string;
  lastDeliveryAt?: string | null;
  lastDeliveryStatus?: 'SUCCESS' | 'FAILED' | null;
  failureCount: number;
  rateLimitPerMinute: number;
  createdBy: string;
  createdByName: string;
}

export type SafeWebhookEndpoint = Omit<WebhookEndpoint, 'secretHash'>;

export interface WebhookEvent<T = any> {
  id: string;
  type: WebhookEventType;
  schemaVersion: string; // e.g. '2026-10-01'
  organizationId: string;
  occurredAt: string; // ISO-8601
  timestamp: string; // ISO-8601 (backward compatibility alias)
  data: T;
}

export type WebhookDeliveryStatus =
  | 'pending'
  | 'delivering'
  | 'succeeded'
  | 'retrying'
  | 'failed'
  | 'SUCCESS'
  | 'FAILED'
  | 'PENDING_RETRY'
  | 'MAX_RETRIES_EXCEEDED';

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  organizationId: string;
  eventId: string;
  eventType: WebhookEventType;
  destinationUrl: string;
  attemptNumber: number;
  maxAttempts: number;
  status: WebhookDeliveryStatus;
  statusCode?: number | null;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestPayload: any;
  responseBody?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  attemptedAt?: string | null;
  completedAt?: string | null;
  nextRetryAt?: string | null;
}

export interface WebhookQueueConfig {
  maxAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitterRatio: number;
  requestTimeoutMs: number;
  abandonedThresholdMs: number;
  batchSize: number;
}

export interface CreateWebhookRequest {
  name: string;
  description?: string;
  url: string;
  subscribedEvents: WebhookEventType[];
  rateLimitPerMinute?: number;
}

export interface CreateWebhookResponse {
  webhook: SafeWebhookEndpoint;
  rawSecret: string; // Shown only once at creation!
}

export interface RotateWebhookSecretResponse {
  webhook: SafeWebhookEndpoint;
  rawSecret: string; // Shown only once at rotation!
}
