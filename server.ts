/**
 * ENTERPRISE WAREHOUSE SAAS FULL-STACK SERVER (PHASE 14.3)
 *
 * Implements:
 * 1. Secure versioned REST API runtime under /api/v1/*
 * 2. Standardized response envelopes (success, pagination, request correlation IDs, errors)
 * 3. High-entropy API key authentication & least-privilege scope authorization
 * 4. Strict server-enforced tenant isolation (zero cross-tenant data bleed)
 * 5. Idempotency protection for write operations (prevents duplicate submissions)
 * 6. Business-rule & transaction-ledger integrity (draft vs confirmed balance updates)
 * 7. Rate limiting & safe audit logging (raw secrets strictly scrubbed)
 * 8. OpenAPI 3.0 specification & interactive developer documentation at /api/v1/docs
 * 9. Vite development middleware integration on port 3000
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { ApiScope, ALL_API_SCOPES } from './src/types/apiIntegration';
import { ApiIntegrationService } from './src/services/apiIntegrationService';
import { WarehouseEngineService } from './src/services/warehouseEngineService';
import { BusinessEngineService } from './src/services/businessEngineService';
import { TenantService } from './src/services/tenantService';
import { DEFAULT_ITEM_CATEGORIES } from './src/types/warehouse';
import { WebhookServerEngine } from './src/server/webhookServerEngine';
import { requireServerAuth } from './src/server/serverAuthMiddleware';
import { ALL_WEBHOOK_EVENT_TYPES, CreateWebhookRequest } from './src/types/webhook';
import { validateWebhookDestination } from './src/services/webhookSsrfValidator';
import { EntitlementServerService } from './src/server/entitlementServerService';
import { requireEntitlementGuard, requireFeatureEntitlement, requirePlatformAdmin } from './src/server/serverEntitlementMiddleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const API_VERSION = 'v1.3.0';

// ---------------------------------------------------------------------------
// 1. GLOBAL MIDDLEWARES: PARSING, SECURITY HEADERS, CORRELATION ID
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Security Headers & Request Correlation ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Validate Content-Type for write requests
app.use((req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-length'] && Number(req.headers['content-length']) > 0) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      sendError(res, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json', 415);
      return;
    }
  }
  next();
});

// ---------------------------------------------------------------------------
// 2. STANDARDIZED RESPONSE HELPERS
// ---------------------------------------------------------------------------
export function sendSuccess<T>(
  res: Response,
  data: T,
  pagination?: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean },
  statusCode = 200,
  organizationId?: string
) {
  const requestId = res.getHeader('X-Request-Id') as string;
  res.status(statusCode).json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...(organizationId ? { organizationId } : {}),
      version: API_VERSION,
    },
  });
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: any
) {
  const requestId = res.getHeader('X-Request-Id') as string;
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      version: API_VERSION,
    },
  });
}

// ---------------------------------------------------------------------------
// 3. PAGINATION & FILTERING HELPER
// ---------------------------------------------------------------------------
export function paginateList<T>(
  items: T[],
  pageParam?: any,
  limitParam?: any
): {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
} {
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitParam) || 20));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const paginated = items.slice(offset, offset + limit);

  return {
    items: paginated,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. SERVER-SIDE AUTHENTICATION & LEAST-PRIVILEGE SCOPE MIDDLEWARE
// ---------------------------------------------------------------------------
export function requireApiAuth(requiredScope?: ApiScope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    let rawToken = '';
    if (authHeader && typeof authHeader === 'string') {
      if (authHeader.startsWith('Bearer ')) {
        rawToken = authHeader.slice(7);
      } else {
        rawToken = authHeader;
      }
    } else if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      rawToken = apiKeyHeader;
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'API-Client';

    const authResult = ApiIntegrationService.validateCredential(rawToken, requiredScope, {
      endpoint: req.originalUrl,
      method: req.method,
      ip,
      userAgent,
    });

    if (!authResult.valid) {
      if (authResult.statusCode === 429) {
        res.setHeader('Retry-After', '60');
      }
      sendError(res, authResult.errorCode || 'UNAUTHORIZED', authResult.errorMessage || 'Unauthorized', authResult.statusCode);
      return;
    }

    // Strict Tenant Isolation: Validate that client did not try to supply a conflicting organizationId
    const serverOrgId = authResult.context!.organizationId;
    const clientProvidedOrg = req.query.organizationId || req.query.tenantId || req.body?.organizationId || req.body?.tenantId;

    if (clientProvidedOrg && typeof clientProvidedOrg === 'string' && clientProvidedOrg !== serverOrgId) {
      ApiIntegrationService.recordAuditLog({
        organizationId: serverOrgId,
        integrationId: authResult.context!.integration.id,
        integrationName: authResult.context!.integration.name,
        action: 'CROSS_TENANT_ACCESS_BLOCKED',
        endpoint: req.originalUrl,
        method: req.method,
        ipAddress: ip,
        details: `Blocked cross-tenant access attempt: API key belongs to "${serverOrgId}" but request attempted to target "${clientProvidedOrg}"`,
        success: false,
      });

      sendError(res, 'FORBIDDEN_TENANT_MISMATCH', 'Access denied: You cannot query or manipulate data belonging to another organization.', 403);
      return;
    }

    // Attach server-resolved context to request
    (req as any).apiContext = authResult.context;
    (req as any).organizationId = serverOrgId;
    next();
  };
}

// ---------------------------------------------------------------------------
// 5. IDEMPOTENCY MIDDLEWARE FOR WRITE OPERATIONS
// ---------------------------------------------------------------------------
export function requireIdempotency() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;
    const orgId = (req as any).organizationId;

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      // Idempotency key is optional, proceed normally
      next();
      return;
    }

    // Check if we already processed this exact request
    const existing = ApiIntegrationService.getIdempotencyRecord(orgId, idempotencyKey, req.path);
    if (existing) {
      res.setHeader('X-Idempotency-Replay', 'true');
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }

    // Intercept response to save for future idempotent replays
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        ApiIntegrationService.saveIdempotencyRecord({
          key: idempotencyKey,
          organizationId: orgId,
          endpoint: req.path,
          statusCode: res.statusCode,
          responseBody: body,
          createdAt: new Date().toISOString(),
        });
      }
      return originalJson(body);
    };

    next();
  };
}

// ---------------------------------------------------------------------------
// 6. SYSTEM HEALTH & API DOCUMENTATION (OPENAPI 3.0 & HTML DOCS)
// ---------------------------------------------------------------------------
app.get('/api/v1/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ONLINE',
    runtime: 'Universal Warehouse Management SaaS API',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    supportedProtocols: ['REST', 'JSON'],
    supportedAuth: ['Bearer <token>', 'X-API-Key: <token>'],
    availableScopesCount: ALL_API_SCOPES.length,
  });
});

app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Universal Warehouse Management SaaS REST API',
      version: API_VERSION,
      description: 'Production-ready, multi-tenant warehouse and inventory operations API with granular least-privilege scopes, constant-time authentication, and strict tenant isolation.',
      contact: {
        name: 'Warehouse API Support',
        email: 'api-support@warehouse-saas.com',
      },
    },
    servers: [
      { url: '/api/v1', description: 'Production API Gateway' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (wh_live_...)',
          description: 'High-entropy API key prefixed with wh_live_',
        },
        ApiKeyHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Alternative header for passing the API key',
        },
      },
      schemas: {
        StandardSuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                organizationId: { type: 'string' },
                version: { type: 'string' },
              },
            },
          },
        },
        StandardErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid item quantity' },
                details: { type: 'object' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                requestId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }, { ApiKeyHeader: [] }],
    paths: {
      '/health': { get: { summary: 'System Health Check', responses: { '200': { description: 'API Online' } } } },
      '/me': { get: { summary: 'Inspect Current Credential Context', responses: { '200': { description: 'Authenticated tenant & scopes' } } } },
      '/items': { get: { summary: 'List Item Catalog', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }] } },
      '/items/categories': { get: { summary: 'List Item Categories' } },
      '/items/{id}': { get: { summary: 'Get Item Details by ID' } },
      '/warehouses': { get: { summary: 'List Warehouses' } },
      '/warehouses/{id}': { get: { summary: 'Get Warehouse by ID' } },
      '/locations': { get: { summary: 'List Storage Locations', parameters: [{ name: 'warehouseId', in: 'query', schema: { type: 'string' } }] } },
      '/locations/{id}': { get: { summary: 'Get Location by ID' } },
      '/inventory/balances': { get: { summary: 'Query Inventory Balances', parameters: [{ name: 'itemId', in: 'query', schema: { type: 'string' } }, { name: 'warehouseId', in: 'query', schema: { type: 'string' } }, { name: 'locationId', in: 'query', schema: { type: 'string' } }] } },
      '/inventory/movements': { get: { summary: 'Query Inventory Ledger & Movements' } },
      '/receipts': {
        get: { summary: 'List Goods Receipts' },
        post: { summary: 'Create Goods Receipt (Atomic Ledger)', parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }] },
      },
      '/receipts/{id}': { get: { summary: 'Get Goods Receipt by ID' } },
      '/issues': {
        get: { summary: 'List Stock Issues' },
        post: { summary: 'Create Stock Issue (Atomic Ledger)', parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }] },
      },
      '/issues/{id}': { get: { summary: 'Get Stock Issue by ID' } },
      '/transfers': {
        get: { summary: 'List Stock Transfers' },
        post: { summary: 'Create Stock Transfer (Atomic Ledger)' },
      },
      '/transfers/{id}': { get: { summary: 'Get Stock Transfer by ID' } },
      '/adjustments': {
        get: { summary: 'List Stock Adjustments' },
        post: { summary: 'Post Audited Stock Adjustment (Mandatory Reason)' },
      },
      '/adjustments/{id}': { get: { summary: 'Get Stock Adjustment by ID' } },
      '/stock-counts': { get: { summary: 'List Physical Stocktake Counts' } },
      '/stock-counts/{id}': { get: { summary: 'Get Stocktake Count Details by ID' } },
      '/suppliers': { get: { summary: 'List Suppliers' } },
      '/suppliers/{id}': { get: { summary: 'Get Supplier by ID' } },
      '/customers': { get: { summary: 'List Customers' } },
      '/customers/{id}': { get: { summary: 'Get Customer by ID' } },
      '/purchase-orders': {
        get: { summary: 'List Purchase Orders' },
        post: { summary: 'Create Purchase Order' },
      },
      '/purchase-orders/{id}': { get: { summary: 'Get Purchase Order by ID' } },
      '/reports/summary': { get: { summary: 'Warehouse KPI Summary Report' } },
      '/reports/inventory-valuation': { get: { summary: 'Detailed Inventory Valuation Report' } },
      '/audit-logs': { get: { summary: 'Query Tenant API & Operations Audit Logs' } },
      '/webhooks': {
        get: { summary: 'List Registered Webhook Endpoints' },
        post: { summary: 'Register New Webhook Endpoint (Reveals HMAC Secret Once)' },
      },
      '/webhooks/events': { get: { summary: 'List Available Webhook Event Types' } },
      '/webhooks/deliveries': { get: { summary: 'Query Outbound Webhook Delivery Logs' } },
      '/webhooks/deliveries/{id}/retry': { post: { summary: 'Trigger Manual Retry for Delivery Attempt' } },
      '/webhooks/{id}': {
        get: { summary: 'Get Webhook Endpoint Details' },
        patch: { summary: 'Update Webhook Endpoint Configurations' },
        delete: { summary: 'Delete Webhook Endpoint' },
      },
      '/webhooks/{id}/rotate-secret': { post: { summary: 'Rotate Endpoint HMAC-SHA256 Signing Secret' } },
      '/webhooks/{id}/revoke': { post: { summary: 'Revoke Webhook Endpoint' } },
      '/webhooks/{id}/test': { post: { summary: 'Dispatch Integration Ping Test Event' } },
      '/webhooks/{id}/deliveries': { get: { summary: 'Query Deliveries for Specific Webhook Endpoint' } },
    },
  });
});

app.get('/api/v1/docs', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Universal Warehouse SaaS — REST API Documentation (v1)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 30px; line-height: 1.6; }
    h1 { color: #38bdf8; border-bottom: 2px solid #1e293b; padding-bottom: 12px; }
    h2 { color: #f1f5f9; margin-top: 30px; }
    pre { background: #020617; border: 1px solid #1e293b; padding: 14px; border-radius: 8px; color: #38bdf8; overflow-x: auto; font-size: 13px; }
    code { font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
    th, td { border: 1px solid #1e293b; padding: 10px; text-align: left; }
    th { background: #1e293b; color: #94a3b8; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
    .badge-get { background: #0284c7; color: white; }
    .badge-post { background: #16a34a; color: white; }
    .scope-chip { background: #334155; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>🚀 Universal Warehouse SaaS — REST API Reference (v1)</h1>
  <p>Secure, multi-tenant warehouse management API with cryptographic authentication, least-privilege authorization, and transactional ledger integrity.</p>
  
  <h2>Authentication</h2>
  <p>Include your high-entropy API key in the <code>Authorization</code> header:</p>
  <pre>Authorization: Bearer wh_live_a1b2c3d4...</pre>
  <p>Or alternatively use <code>X-API-Key: wh_live_a1b2c3d4...</code>.</p>

  <h2>Available Endpoints</h2>
  <table>
    <tr><th>Method</th><th>Endpoint</th><th>Scope Required</th><th>Description</th></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/health</code></td><td><em>Public</em></td><td>Service status & health heartbeat</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/me</code></td><td><em>Any Valid</em></td><td>Inspect token context & granted scopes</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/items</code></td><td><span class="scope-chip">items:read</span></td><td>List items (paginated, search, category filter)</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/items/categories</code></td><td><span class="scope-chip">items:read</span></td><td>List item master categories</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/warehouses</code></td><td><span class="scope-chip">warehouses:read</span></td><td>List warehouse facilities</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/locations</code></td><td><span class="scope-chip">locations:read</span></td><td>List storage locations & bins</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/inventory/balances</code></td><td><span class="scope-chip">inventory:read</span></td><td>Query live physical & available balances</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/inventory/movements</code></td><td><span class="scope-chip">inventory:read</span></td><td>Query immutable ledger movement history</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/receipts</code></td><td><span class="scope-chip">receipts:read</span></td><td>Query inbound goods receipts</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/receipts</code></td><td><span class="scope-chip">receipts:create</span></td><td>Create inbound receipt (draft or confirmed)</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/issues</code></td><td><span class="scope-chip">issues:read</span></td><td>Query outbound stock issues</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/issues</code></td><td><span class="scope-chip">issues:create</span></td><td>Create stock issue with stock verification</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/transfers</code></td><td><span class="scope-chip">transfers:read</span></td><td>Query stock transfers</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/transfers</code></td><td><span class="scope-chip">transfers:create</span></td><td>Execute atomic inter-warehouse transfer</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/adjustments</code></td><td><span class="scope-chip">adjustments:read</span></td><td>Query audited inventory adjustments</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/adjustments</code></td><td><span class="scope-chip">adjustments:create</span></td><td>Post stock adjustment with mandatory reason</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/suppliers</code></td><td><span class="scope-chip">suppliers:read</span></td><td>Query supplier registry</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/customers</code></td><td><span class="scope-chip">customers:read</span></td><td>Query customer registry</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/purchase-orders</code></td><td><span class="scope-chip">purchase_orders:read</span></td><td>Query purchase orders</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/purchase-orders</code></td><td><span class="scope-chip">purchase_orders:create</span></td><td>Create draft purchase order</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/stock-counts</code></td><td><span class="scope-chip">inventory:read</span></td><td>Query physical stocktake counts & variances</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/reports/summary</code></td><td><span class="scope-chip">reports:read</span></td><td>Warehouse operational summary KPIs</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/audit-logs</code></td><td><span class="scope-chip">reports:read</span></td><td>Query security & operations audit trail</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/webhooks</code></td><td><span class="scope-chip">webhooks:read</span></td><td>List registered webhook endpoints</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/webhooks</code></td><td><span class="scope-chip">webhooks:write</span></td><td>Register webhook endpoint (reveals HMAC secret once)</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/webhooks/events</code></td><td><span class="scope-chip">webhooks:read</span></td><td>List all 12 supported webhook event types</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/webhooks/:id</code></td><td><span class="scope-chip">webhooks:read</span></td><td>Get webhook endpoint details</td></tr>
    <tr><td><span class="badge badge-patch">PATCH</span></td><td><code>/api/v1/webhooks/:id</code></td><td><span class="scope-chip">webhooks:write</span></td><td>Update webhook URL, events, or active status</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/webhooks/:id/rotate-secret</code></td><td><span class="scope-chip">webhooks:write</span></td><td>Rotate HMAC-SHA256 signing secret</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/webhooks/:id/test</code></td><td><span class="scope-chip">webhooks:write</span></td><td>Dispatch ping test event (integration.test)</td></tr>
    <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/v1/webhooks/deliveries</code></td><td><span class="scope-chip">webhooks:read</span></td><td>Query outbound webhook delivery logs</td></tr>
    <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/v1/webhooks/deliveries/:id/retry</code></td><td><span class="scope-chip">webhooks:write</span></td><td>Trigger manual delivery retry with backoff</td></tr>
  </table>

  <h2>OpenAPI Specification</h2>
  <p>Download or view the raw OpenAPI 3.0 JSON specification at: <a href="/api/v1/openapi.json" style="color: #38bdf8;">/api/v1/openapi.json</a></p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// 7. INTEGRATION CONTEXT INSPECTION (NO SECRETS RETURNED)
// ---------------------------------------------------------------------------
app.get('/api/v1/me', requireApiAuth(), (req: Request, res: Response) => {
  const context = (req as any).apiContext;
  const { secretHash: _, ...safeIntegration } = context.integration;
  const org = TenantService.getOrganization(context.organizationId);

  sendSuccess(
    res,
    {
      integration: safeIntegration,
      organization: {
        id: org?.id,
        name: org?.nameEn || org?.name,
        plan: org?.plan,
        currency: org?.currency,
        weightUnit: org?.weightUnit,
      },
      authorizedScopes: context.scopes,
    },
    undefined,
    200,
    context.organizationId
  );
});

// ---------------------------------------------------------------------------
// 8. ITEMS & ITEM CATEGORIES API (items:read)
// ---------------------------------------------------------------------------
app.get('/api/v1/items/categories', requireApiAuth('items:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const items = WarehouseEngineService.getItems(orgId);

  const categories = DEFAULT_ITEM_CATEGORIES.map((cat) => {
    const count = items.filter((i) => i.category === cat.id).length;
    return {
      ...cat,
      itemCount: count,
    };
  });

  sendSuccess(res, categories, undefined, 200, orgId);
});

app.get('/api/v1/items', requireApiAuth('items:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let items = WarehouseEngineService.getItems(orgId);

  // Filters
  if (req.query.category && typeof req.query.category === 'string') {
    items = items.filter((i) => i.category.toLowerCase() === (req.query.category as string).toLowerCase());
  }
  if (req.query.status && typeof req.query.status === 'string') {
    items = items.filter((i) => i.status === req.query.status);
  }
  if (req.query.search && typeof req.query.search === 'string') {
    const q = (req.query.search as string).toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.nameAr && i.nameAr.toLowerCase().includes(q)) ||
        i.itemCode.toLowerCase().includes(q)
    );
  }

  const { items: paginated, pagination } = paginateList(items, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/items/:id', requireApiAuth('items:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const item = WarehouseEngineService.getItem(orgId, req.params.id);
  if (!item) {
    sendError(res, 'NOT_FOUND', `Item ${req.params.id} not found in this organization.`, 404);
    return;
  }
  sendSuccess(res, item, undefined, 200, orgId);
});

// ---------------------------------------------------------------------------
// 9. WAREHOUSES & STORAGE LOCATIONS API (warehouses:read, locations:read)
// ---------------------------------------------------------------------------
app.get('/api/v1/warehouses', requireApiAuth('warehouses:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let warehouses = WarehouseEngineService.getWarehouses(orgId);

  if (req.query.status && typeof req.query.status === 'string') {
    warehouses = warehouses.filter((w) => w.status === req.query.status);
  }
  if (req.query.search && typeof req.query.search === 'string') {
    const q = (req.query.search as string).toLowerCase();
    warehouses = warehouses.filter((w) => w.name.toLowerCase().includes(q) || (w.code && w.code.toLowerCase().includes(q)));
  }

  const { items: paginated, pagination } = paginateList(warehouses, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/warehouses/:id', requireApiAuth('warehouses:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const wh = WarehouseEngineService.getWarehouse(orgId, req.params.id);
  if (!wh) {
    sendError(res, 'NOT_FOUND', `Warehouse ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, wh, undefined, 200, orgId);
});

app.get('/api/v1/locations', requireApiAuth('locations:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const warehouseId = typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;
  let locations = WarehouseEngineService.getLocations(orgId, warehouseId);

  if (req.query.search && typeof req.query.search === 'string') {
    const q = (req.query.search as string).toLowerCase();
    locations = locations.filter((l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q));
  }

  const { items: paginated, pagination } = paginateList(locations, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/locations/:id', requireApiAuth('locations:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const locations = WarehouseEngineService.getLocations(orgId);
  const loc = locations.find((l) => l.id === req.params.id);
  if (!loc) {
    sendError(res, 'NOT_FOUND', `Location ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, loc, undefined, 200, orgId);
});

// ---------------------------------------------------------------------------
// 10. INVENTORY BALANCES & STOCK MOVEMENTS API (inventory:read)
// ---------------------------------------------------------------------------
app.get('/api/v1/inventory/balances', requireApiAuth('inventory:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let balances = WarehouseEngineService.computeInventoryBalances(orgId);

  if (req.query.itemId && typeof req.query.itemId === 'string') {
    balances = balances.filter((b) => b.itemId === req.query.itemId || b.itemCode === req.query.itemId);
  }
  if (req.query.warehouseId && typeof req.query.warehouseId === 'string') {
    balances = balances.filter((b) => b.warehouseId === req.query.warehouseId);
  }
  if (req.query.locationId && typeof req.query.locationId === 'string') {
    balances = balances.filter((b) => b.locationId === req.query.locationId);
  }
  if (req.query.status && typeof req.query.status === 'string') {
    balances = balances.filter((b) => b.status === req.query.status);
  }

  const { items: paginated, pagination } = paginateList(balances, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/inventory/movements', requireApiAuth('inventory:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : undefined;
  const warehouseId = typeof req.query.warehouseId === 'string' ? req.query.warehouseId : undefined;

  let movements = WarehouseEngineService.getLedger(orgId, itemId, warehouseId);

  if (req.query.transactionType && typeof req.query.transactionType === 'string') {
    movements = movements.filter((m) => m.transactionType === req.query.transactionType);
  }
  if (req.query.startDate && typeof req.query.startDate === 'string') {
    movements = movements.filter((m) => m.createdAt >= (req.query.startDate as string));
  }
  if (req.query.endDate && typeof req.query.endDate === 'string') {
    movements = movements.filter((m) => m.createdAt <= (req.query.endDate as string));
  }

  const { items: paginated, pagination } = paginateList(movements, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

// ---------------------------------------------------------------------------
// 11. GOODS RECEIPTS API (receipts:read, receipts:create)
// ---------------------------------------------------------------------------
app.get('/api/v1/receipts', requireApiAuth('receipts:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let receipts = WarehouseEngineService.getReceipts(orgId);

  if (req.query.status && typeof req.query.status === 'string') {
    receipts = receipts.filter((r) => r.status === req.query.status);
  }
  if (req.query.warehouseId && typeof req.query.warehouseId === 'string') {
    receipts = receipts.filter((r) => r.warehouseId === req.query.warehouseId);
  }
  if (req.query.supplierId && typeof req.query.supplierId === 'string') {
    receipts = receipts.filter((r) => r.supplierId === req.query.supplierId);
  }

  const { items: paginated, pagination } = paginateList(receipts, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/receipts/:id', requireApiAuth('receipts:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const receipt = WarehouseEngineService.getReceipt(orgId, req.params.id);
  if (!receipt) {
    sendError(res, 'NOT_FOUND', `Receipt ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, receipt, undefined, 200, orgId);
});

app.post('/api/v1/receipts', requireApiAuth('receipts:create'), requireIdempotency(), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  const body = req.body;

  // Validate Warehouse
  if (!body.warehouseId) {
    sendError(res, 'VALIDATION_ERROR', 'warehouseId is required');
    return;
  }
  const wh = WarehouseEngineService.getWarehouse(orgId, body.warehouseId);
  if (!wh) {
    sendError(res, 'INVALID_WAREHOUSE', `Warehouse ${body.warehouseId} does not belong to your organization.`, 400);
    return;
  }

  // Validate Lines
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    sendError(res, 'VALIDATION_ERROR', 'items array is required and must contain at least one line item.', 400);
    return;
  }

  for (const it of body.items) {
    if (!it.itemId || typeof it.quantity !== 'number' || it.quantity <= 0) {
      sendError(res, 'VALIDATION_ERROR', 'Each line item must have a valid itemId and positive quantity.', 400);
      return;
    }
    const item = WarehouseEngineService.getItem(orgId, it.itemId);
    if (!item) {
      sendError(res, 'INVALID_ITEM', `Item ${it.itemId} does not exist in your organization's catalog.`, 400);
      return;
    }
    if (it.locationId) {
      const locs = WarehouseEngineService.getLocations(orgId, body.warehouseId);
      const loc = locs.find((l) => l.id === it.locationId);
      if (!loc) {
        sendError(res, 'INVALID_LOCATION', `Storage location ${it.locationId} is not in warehouse ${body.warehouseId}.`, 400);
        return;
      }
    }
  }

  const asDraft = Boolean(body.asDraft || body.status === 'DRAFT');

  try {
    const receiptDoc = await WarehouseEngineService.createReceiptDocument(
      orgId,
      {
        supplierName: body.supplierName || 'External API Intake',
        supplierId: body.supplierId,
        documentNumber: body.documentNumber || `API-RCV-${Date.now().toString().slice(-6)}`,
        date: body.date || new Date().toISOString().split('T')[0],
        warehouseId: body.warehouseId,
        notes: body.notes || `Created via API integration "${context.integration.name}"`,
        items: body.items,
      },
      asDraft,
      `API:${context.integration.name}`
    );

    ApiIntegrationService.recordAuditLog({
      organizationId: orgId,
      integrationId: context.integration.id,
      integrationName: context.integration.name,
      action: 'SENSITIVE_API_EXECUTION',
      endpoint: '/api/v1/receipts',
      method: 'POST',
      details: `Created goods receipt ${receiptDoc.receiptNumber} (Status: ${receiptDoc.status}, Qty: ${receiptDoc.totalQuantity}) via API`,
      success: true,
    });

    sendSuccess(res, receiptDoc, undefined, 201, orgId);
  } catch (err: any) {
    sendError(res, 'OPERATION_FAILED', err.message || 'Failed to create receipt', 400);
  }
});

// ---------------------------------------------------------------------------
// 12. STOCK ISSUES API (issues:read, issues:create)
// ---------------------------------------------------------------------------
app.get('/api/v1/issues', requireApiAuth('issues:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let issues = WarehouseEngineService.getIssues(orgId);

  if (req.query.status && typeof req.query.status === 'string') {
    issues = issues.filter((i) => i.status === req.query.status);
  }
  if (req.query.warehouseId && typeof req.query.warehouseId === 'string') {
    issues = issues.filter((i) => i.warehouseId === req.query.warehouseId);
  }

  const { items: paginated, pagination } = paginateList(issues, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/issues/:id', requireApiAuth('issues:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const issue = WarehouseEngineService.getIssue(orgId, req.params.id);
  if (!issue) {
    sendError(res, 'NOT_FOUND', `Issue ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, issue, undefined, 200, orgId);
});

app.post('/api/v1/issues', requireApiAuth('issues:create'), requireIdempotency(), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  const body = req.body;

  if (!body.warehouseId || !body.locationId) {
    sendError(res, 'VALIDATION_ERROR', 'warehouseId and locationId are required', 400);
    return;
  }

  const wh = WarehouseEngineService.getWarehouse(orgId, body.warehouseId);
  if (!wh) {
    sendError(res, 'INVALID_WAREHOUSE', `Warehouse ${body.warehouseId} not found.`, 400);
    return;
  }

  const locations = WarehouseEngineService.getLocations(orgId, body.warehouseId);
  const loc = locations.find((l) => l.id === body.locationId);
  if (!loc) {
    sendError(res, 'INVALID_LOCATION', `Location ${body.locationId} is not in warehouse ${body.warehouseId}.`, 400);
    return;
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    sendError(res, 'VALIDATION_ERROR', 'items array is required and must not be empty.', 400);
    return;
  }

  const asDraft = Boolean(body.asDraft || body.status === 'DRAFT');

  // Verify stock availability if confirmed issue
  const balances = WarehouseEngineService.computeInventoryBalances(orgId);

  for (const it of body.items) {
    if (!it.itemId || typeof it.quantity !== 'number' || it.quantity <= 0) {
      sendError(res, 'VALIDATION_ERROR', 'Valid itemId and positive quantity required for each item.', 400);
      return;
    }
    const item = WarehouseEngineService.getItem(orgId, it.itemId);
    if (!item) {
      sendError(res, 'INVALID_ITEM', `Item ${it.itemId} does not belong to your organization.`, 400);
      return;
    }

    if (!asDraft) {
      const bal = balances.find((b) => b.itemId === it.itemId && b.locationId === body.locationId);
      const available = bal ? bal.availableQuantity ?? bal.quantity : 0;
      if (available < it.quantity) {
        sendError(res, 'INSUFFICIENT_STOCK', `Insufficient stock for ${item.name} (${item.itemCode}) at location ${loc.code}. Available: ${available}, Requested: ${it.quantity}`, 422);
        return;
      }
    }
  }

  try {
    const issueDoc = await WarehouseEngineService.createIssueDocument(
      orgId,
      {
        warehouseId: body.warehouseId,
        locationId: body.locationId,
        destination: body.destination || 'External Logistics Dispatch',
        department: body.department,
        referenceNumber: body.referenceNumber,
        reason: body.reason || 'External System Dispatch',
        notes: body.notes || `Created via API integration "${context.integration.name}"`,
        items: body.items,
      },
      asDraft,
      `API:${context.integration.name}`
    );

    ApiIntegrationService.recordAuditLog({
      organizationId: orgId,
      integrationId: context.integration.id,
      integrationName: context.integration.name,
      action: 'SENSITIVE_API_EXECUTION',
      endpoint: '/api/v1/issues',
      method: 'POST',
      details: `Created stock issue ${issueDoc.issueNumber} (Status: ${issueDoc.status}, Qty: ${issueDoc.totalQuantity}) via API`,
      success: true,
    });

    sendSuccess(res, issueDoc, undefined, 201, orgId);
  } catch (err: any) {
    const isStock = err.message?.toLowerCase().includes('insufficient stock');
    sendError(res, isStock ? 'INSUFFICIENT_STOCK' : 'OPERATION_FAILED', err.message || 'Failed to create stock issue', isStock ? 422 : 400);
  }
});

// ---------------------------------------------------------------------------
// 13. WAREHOUSE TRANSFERS API (transfers:read, transfers:create)
// ---------------------------------------------------------------------------
app.get('/api/v1/transfers', requireApiAuth('transfers:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let transfers = WarehouseEngineService.getTransfers(orgId);

  if (req.query.status && typeof req.query.status === 'string') {
    transfers = transfers.filter((t) => t.status === req.query.status);
  }

  const { items: paginated, pagination } = paginateList(transfers, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/transfers/:id', requireApiAuth('transfers:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const transfer = WarehouseEngineService.getTransfer(orgId, req.params.id);
  if (!transfer) {
    sendError(res, 'NOT_FOUND', `Transfer ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, transfer, undefined, 200, orgId);
});

app.post('/api/v1/transfers', requireApiAuth('transfers:create'), requireIdempotency(), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  const body = req.body;

  if (!body.sourceWarehouseId || !body.sourceLocationId || !body.destinationWarehouseId || !body.destinationLocationId) {
    sendError(res, 'VALIDATION_ERROR', 'sourceWarehouseId, sourceLocationId, destinationWarehouseId, and destinationLocationId are required.', 400);
    return;
  }

  if (body.sourceWarehouseId === body.destinationWarehouseId && body.sourceLocationId === body.destinationLocationId) {
    sendError(res, 'VALIDATION_ERROR', 'Source and destination locations cannot be identical.', 400);
    return;
  }

  const asDraft = Boolean(body.asDraft || body.status === 'DRAFT');

  try {
    const transferDoc = await WarehouseEngineService.createTransferDocument(
      orgId,
      {
        sourceWarehouseId: body.sourceWarehouseId,
        sourceLocationId: body.sourceLocationId,
        destinationWarehouseId: body.destinationWarehouseId,
        destinationLocationId: body.destinationLocationId,
        reason: body.reason || 'Inter-facility transfer',
        notes: body.notes || `Created via API integration "${context.integration.name}"`,
        items: body.items,
      },
      asDraft,
      `API:${context.integration.name}`
    );

    sendSuccess(res, transferDoc, undefined, 201, orgId);
  } catch (err: any) {
    const isStock = err.message?.toLowerCase().includes('insufficient stock');
    sendError(res, isStock ? 'INSUFFICIENT_STOCK' : 'OPERATION_FAILED', err.message || 'Failed to create stock transfer', isStock ? 422 : 400);
  }
});

// ---------------------------------------------------------------------------
// 14. INVENTORY ADJUSTMENTS API (adjustments:read, adjustments:create)
// ---------------------------------------------------------------------------
app.get('/api/v1/adjustments', requireApiAuth('adjustments:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let adjustments = WarehouseEngineService.getAdjustments(orgId);

  if (req.query.warehouseId && typeof req.query.warehouseId === 'string') {
    adjustments = adjustments.filter((a) => a.warehouseId === req.query.warehouseId);
  }
  if (req.query.itemId && typeof req.query.itemId === 'string') {
    adjustments = adjustments.filter((a) => a.itemId === req.query.itemId || a.itemCode === req.query.itemId);
  }
  if (req.query.adjustmentType && typeof req.query.adjustmentType === 'string') {
    adjustments = adjustments.filter((a) => a.adjustmentType === req.query.adjustmentType);
  }

  const { items: paginated, pagination } = paginateList(adjustments, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/adjustments/:id', requireApiAuth('adjustments:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const adjustments = WarehouseEngineService.getAdjustments(orgId);
  const adj = adjustments.find((a) => a.id === req.params.id || a.adjustmentNumber === req.params.id);
  if (!adj) {
    sendError(res, 'NOT_FOUND', `Adjustment ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, adj, undefined, 200, orgId);
});

app.post('/api/v1/adjustments', requireApiAuth('adjustments:create'), requireIdempotency(), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  const body = req.body;

  if (!body.warehouseId || !body.locationId || !body.itemId || !body.adjustmentType || typeof body.quantityDelta !== 'number') {
    sendError(res, 'VALIDATION_ERROR', 'warehouseId, locationId, itemId, adjustmentType, and quantityDelta are required.', 400);
    return;
  }

  if (body.quantityDelta <= 0) {
    sendError(res, 'VALIDATION_ERROR', 'quantityDelta must be a positive number.', 400);
    return;
  }

  if (!body.reason) {
    sendError(res, 'VALIDATION_ERROR', 'Reason is mandatory for inventory adjustments (e.g. Physical Count, Correction, Damaged).', 400);
    return;
  }

  try {
    const result = await WarehouseEngineService.executeAdjustment(
      orgId,
      {
        warehouseId: body.warehouseId,
        locationId: body.locationId,
        itemId: body.itemId,
        adjustmentType: body.adjustmentType,
        quantityDelta: body.quantityDelta,
        unit: body.unit,
        weightKGDelta: body.weightKGDelta,
        reason: body.reason,
        notes: body.notes || `API Adjustment by "${context.integration.name}"`,
      },
      `API:${context.integration.name}`
    );

    const adjustments = WarehouseEngineService.getAdjustments(orgId);
    const createdAdj = adjustments.find((a) => a.id === result.adjustmentId);

    ApiIntegrationService.recordAuditLog({
      organizationId: orgId,
      integrationId: context.integration.id,
      integrationName: context.integration.name,
      action: 'SENSITIVE_API_EXECUTION',
      endpoint: '/api/v1/adjustments',
      method: 'POST',
      details: `Executed stock adjustment ${result.adjustmentId} (${body.adjustmentType} ${body.quantityDelta}) with reason: ${body.reason}`,
      success: true,
    });

    sendSuccess(res, createdAdj || result, undefined, 201, orgId);
  } catch (err: any) {
    sendError(res, 'OPERATION_FAILED', err.message || 'Failed to execute stock adjustment', 400);
  }
});

// ---------------------------------------------------------------------------
// 15. SUPPLIERS & CUSTOMERS API (suppliers:read, customers:read)
// ---------------------------------------------------------------------------
app.get('/api/v1/suppliers', requireApiAuth('suppliers:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let suppliers = BusinessEngineService.getSuppliers(orgId);

  if (req.query.search && typeof req.query.search === 'string') {
    const q = (req.query.search as string).toLowerCase();
    suppliers = suppliers.filter((s) => s.supplierName.toLowerCase().includes(q) || s.supplierCode.toLowerCase().includes(q));
  }

  const { items: paginated, pagination } = paginateList(suppliers, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/suppliers/:id', requireApiAuth('suppliers:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const supplier = BusinessEngineService.getSupplier(orgId, req.params.id);
  if (!supplier) {
    sendError(res, 'NOT_FOUND', `Supplier ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, supplier, undefined, 200, orgId);
});

app.get('/api/v1/customers', requireApiAuth('customers:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let customers = BusinessEngineService.getCustomers(orgId);

  if (req.query.search && typeof req.query.search === 'string') {
    const q = (req.query.search as string).toLowerCase();
    customers = customers.filter((c) => c.customerName.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q));
  }

  const { items: paginated, pagination } = paginateList(customers, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/customers/:id', requireApiAuth('customers:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const customer = BusinessEngineService.getCustomer(orgId, req.params.id);
  if (!customer) {
    sendError(res, 'NOT_FOUND', `Customer ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, customer, undefined, 200, orgId);
});

// ---------------------------------------------------------------------------
// 16. PURCHASE ORDERS API (purchase_orders:read, purchase_orders:create)
// ---------------------------------------------------------------------------
app.get('/api/v1/purchase-orders', requireApiAuth('purchase_orders:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let purchaseOrders = BusinessEngineService.getPurchaseOrders(orgId);

  if (req.query.status && typeof req.query.status === 'string') {
    purchaseOrders = purchaseOrders.filter((po) => po.status === req.query.status);
  }
  if (req.query.supplierId && typeof req.query.supplierId === 'string') {
    purchaseOrders = purchaseOrders.filter((po) => po.supplierId === req.query.supplierId);
  }

  const { items: paginated, pagination } = paginateList(purchaseOrders, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/purchase-orders/:id', requireApiAuth('purchase_orders:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const po = BusinessEngineService.getPurchaseOrder(orgId, req.params.id);
  if (!po) {
    sendError(res, 'NOT_FOUND', `Purchase order ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, po, undefined, 200, orgId);
});

app.post('/api/v1/purchase-orders', requireApiAuth('purchase_orders:create'), requireIdempotency(), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  const body = req.body;

  if (!body.supplierId || !body.warehouseId || !body.lines || !Array.isArray(body.lines) || body.lines.length === 0) {
    sendError(res, 'VALIDATION_ERROR', 'supplierId, warehouseId, and lines array are required.', 400);
    return;
  }

  const supplier = BusinessEngineService.getSupplier(orgId, body.supplierId);
  if (!supplier) {
    sendError(res, 'INVALID_SUPPLIER', `Supplier ${body.supplierId} not found in this organization.`, 400);
    return;
  }

  const wh = WarehouseEngineService.getWarehouse(orgId, body.warehouseId);
  if (!wh) {
    sendError(res, 'INVALID_WAREHOUSE', `Warehouse ${body.warehouseId} not found in this organization.`, 400);
    return;
  }

  try {
    const po = await BusinessEngineService.createPurchaseOrder(
      orgId,
      {
        supplierId: supplier.id,
        supplierName: supplier.supplierName,
        orderDate: body.orderDate || new Date().toISOString().split('T')[0],
        expectedDate: body.expectedDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        currency: body.currency || supplier.currency || 'USD',
        warehouseId: wh.id,
        warehouseName: wh.nameAr || wh.name,
        notes: body.notes || `Created via API integration "${context.integration.name}"`,
        lines: body.lines,
      },
      `API:${context.integration.name}`
    );

    sendSuccess(res, po, undefined, 201, orgId);
  } catch (err: any) {
    sendError(res, 'OPERATION_FAILED', err.message || 'Failed to create purchase order', 400);
  }
});

// ---------------------------------------------------------------------------
// 17. REPORTS & VALUATION API (reports:read)
// ---------------------------------------------------------------------------
app.get('/api/v1/reports/summary', requireApiAuth('reports:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const items = WarehouseEngineService.getItems(orgId);
  const warehouses = WarehouseEngineService.getWarehouses(orgId);
  const balances = WarehouseEngineService.computeInventoryBalances(orgId);

  const totalStockQty = balances.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalStockWeightKG = balances.reduce((sum, b) => sum + (b.weightKG || 0), 0);
  const lowStockCount = balances.filter((b) => b.status === 'LOW_STOCK' || b.status === 'OUT_OF_STOCK').length;

  sendSuccess(
    res,
    {
      metrics: {
        totalItems: items.length,
        totalWarehouses: warehouses.length,
        totalStockQuantity: totalStockQty,
        totalStockWeightKG: Math.round(totalStockWeightKG * 100) / 100,
        lowStockItemsCount: lowStockCount,
      },
      generatedAt: new Date().toISOString(),
    },
    undefined,
    200,
    orgId
  );
});

app.get('/api/v1/reports/inventory-valuation', requireApiAuth('reports:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const balances = WarehouseEngineService.computeInventoryBalances(orgId);
  const items = WarehouseEngineService.getItems(orgId);
  const totalPhysicalQuantity = balances.reduce((sum, b) => sum + (b.quantity || 0), 0);

  const valuationRows = balances.map((b) => {
    const item = items.find((i) => i.id === b.itemId);
    const unitPrice = (item as any)?.defaultPrice || (item as any)?.cost || 10;
    const lineVal = b.quantity * unitPrice;
    return {
      itemId: b.itemId,
      itemCode: b.itemCode,
      itemName: b.itemName,
      warehouseId: b.warehouseId,
      warehouseName: b.warehouseName,
      locationCode: b.locationCode,
      quantity: b.quantity,
      unit: b.unit,
      unitPrice,
      totalValuation: lineVal,
    };
  });

  const totalCalculatedValuation = valuationRows.reduce((sum, r) => sum + r.totalValuation, 0);

  sendSuccess(
    res,
    {
      summary: {
        totalItemsCount: items.length,
        totalPhysicalQuantity,
        totalValuationAmount: totalCalculatedValuation,
        currency: 'USD',
      },
      valuationDetails: valuationRows,
    },
    undefined,
    200,
    orgId
  );
});

// ---------------------------------------------------------------------------
// 17.1 PHYSICAL STOCK COUNTS & AUDIT TRAIL API (inventory:read, reports:read)
// ---------------------------------------------------------------------------
app.get('/api/v1/stock-counts', requireApiAuth('inventory:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let counts = WarehouseEngineService.getStockCounts(orgId);

  if (req.query.status && typeof req.query.status === 'string') {
    counts = counts.filter((c) => c.status === req.query.status);
  }
  if (req.query.warehouseId && typeof req.query.warehouseId === 'string') {
    counts = counts.filter((c) => c.warehouseId === req.query.warehouseId);
  }

  const { items: paginated, pagination } = paginateList(counts, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.get('/api/v1/stock-counts/:id', requireApiAuth('inventory:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const counts = WarehouseEngineService.getStockCounts(orgId);
  const count = counts.find((c) => c.id === req.params.id || c.countNumber === req.params.id);
  if (!count) {
    sendError(res, 'NOT_FOUND', `Stock count ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, count, undefined, 200, orgId);
});

app.get('/api/v1/audit-logs', requireApiAuth('reports:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  let logs = ApiIntegrationService.getAuditLogs(orgId);

  if (req.query.action && typeof req.query.action === 'string') {
    logs = logs.filter((l) => l.action === req.query.action);
  }
  if (req.query.success !== undefined) {
    const isSuccess = req.query.success === 'true';
    logs = logs.filter((l) => l.success === isSuccess);
  }

  const { items: paginated, pagination } = paginateList(logs, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

// ---------------------------------------------------------------------------
// 17.2 WEBHOOKS & RELIABLE EVENT DELIVERY API (webhooks:read, webhooks:write)
// ---------------------------------------------------------------------------
app.get('/api/v1/webhooks/events', requireApiAuth('webhooks:read'), (_req: Request, res: Response) => {
  const orgId = (_req as any).organizationId;
  sendSuccess(res, ALL_WEBHOOK_EVENT_TYPES, undefined, 200, orgId);
});

app.get('/api/v1/webhooks', requireApiAuth('webhooks:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const endpoints = WebhookServerEngine.getEndpoints(orgId);
  const { items: paginated, pagination } = paginateList(endpoints, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.post('/api/v1/webhooks', requireApiAuth('webhooks:write'), requireIdempotency(), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  const body = req.body as CreateWebhookRequest;

  if (!body.name || !body.name.trim()) {
    sendError(res, 'VALIDATION_ERROR', 'Webhook endpoint name is required.', 400);
    return;
  }
  if (!body.url || !body.url.trim()) {
    sendError(res, 'VALIDATION_ERROR', 'Destination URL is required.', 400);
    return;
  }
  if (!body.subscribedEvents || !Array.isArray(body.subscribedEvents) || body.subscribedEvents.length === 0) {
    sendError(res, 'VALIDATION_ERROR', 'At least one subscribedEvent is required.', 400);
    return;
  }

  // Enforce zero-trust SSRF validation on destination
  const ssrf = validateWebhookDestination(body.url, {
    enforceHttps: true,
    allowedPorts: [443],
  });
  if (!ssrf.valid) {
    sendError(res, 'SSRF_VALIDATION_FAILED', `Destination URL rejected: ${ssrf.reason}`, 400);
    return;
  }

  try {
    const result = await WebhookServerEngine.createEndpoint(
      orgId,
      body,
      {
        id: context?.integration?.id || 'api_key',
        name: context?.integration?.name || 'API Client',
      }
    );

    ApiIntegrationService.recordAuditLog({
      organizationId: orgId,
      integrationId: context?.integration?.id || 'api_key',
      integrationName: context?.integration?.name || 'API Client',
      action: 'WEBHOOK_ENDPOINT_CREATED',
      endpoint: req.originalUrl,
      method: req.method,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      details: `Registered webhook endpoint "${result.webhook.name}" (${result.webhook.url}) with prefix ${result.webhook.keyPrefix}`,
      success: true,
    });

    sendSuccess(res, result, undefined, 201, orgId);
  } catch (err: any) {
    sendError(res, 'WEBHOOK_CREATION_FAILED', err.message || 'Failed to create webhook endpoint', 400);
  }
});

app.get('/api/v1/webhooks/deliveries', requireApiAuth('webhooks:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const webhookId = req.query.webhookId as string | undefined;
  const eventType = req.query.eventType as string | undefined;

  const deliveries = WebhookServerEngine.getDeliveries(orgId, { webhookId, eventType });
  const { items: paginated, pagination } = paginateList(deliveries, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

app.post('/api/v1/webhooks/deliveries/:deliveryId/retry', requireApiAuth('webhooks:write'), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const deliveryId = req.params.deliveryId;

  try {
    const retried = await WebhookServerEngine.retryDelivery(orgId, deliveryId);

    ApiIntegrationService.recordAuditLog({
      organizationId: orgId,
      integrationId: (req as any).apiContext?.integration?.id || 'api_key',
      integrationName: (req as any).apiContext?.integration?.name || 'API Client',
      action: 'WEBHOOK_DELIVERY_RETRIED',
      endpoint: req.originalUrl,
      method: req.method,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      details: `Triggered manual retry for delivery ${deliveryId} (attempt ${retried.attemptNumber}, status ${retried.status})`,
      success: true,
    });

    sendSuccess(res, { delivery: retried }, undefined, 200, orgId);
  } catch (err: any) {
    sendError(res, 'WEBHOOK_RETRY_FAILED', err.message || 'Failed to retry delivery', 400);
  }
});

app.get('/api/v1/webhooks/:id', requireApiAuth('webhooks:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const endpoint = WebhookServerEngine.getEndpoint(orgId, req.params.id);
  if (!endpoint) {
    sendError(res, 'NOT_FOUND', `Webhook endpoint ${req.params.id} not found.`, 404);
    return;
  }
  sendSuccess(res, endpoint, undefined, 200, orgId);
});

app.patch('/api/v1/webhooks/:id', requireApiAuth('webhooks:write'), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const updated = await WebhookServerEngine.updateEndpoint(orgId, req.params.id, req.body);
    sendSuccess(res, updated, undefined, 200, orgId);
  } catch (err: any) {
    sendError(res, 'WEBHOOK_UPDATE_FAILED', err.message || 'Failed to update webhook', 400);
  }
});

app.post('/api/v1/webhooks/:id/rotate-secret', requireApiAuth('webhooks:write'), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  try {
    const result = await WebhookServerEngine.rotateSecret(
      orgId,
      req.params.id,
      {
        id: context?.integration?.id || 'api_key',
        name: context?.integration?.name || 'API Client',
      }
    );
    sendSuccess(res, result, undefined, 200, orgId);
  } catch (err: any) {
    sendError(res, 'SECRET_ROTATION_FAILED', err.message || 'Failed to rotate secret', 400);
  }
});

app.post('/api/v1/webhooks/:id/revoke', requireApiAuth('webhooks:write'), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const context = (req as any).apiContext;
  try {
    const revoked = await WebhookServerEngine.revokeEndpoint(
      orgId,
      req.params.id,
      {
        id: context?.integration?.id || 'api_key',
        name: context?.integration?.name || 'API Client',
      }
    );
    sendSuccess(res, revoked, undefined, 200, orgId);
  } catch (err: any) {
    sendError(res, 'WEBHOOK_REVOCATION_FAILED', err.message || 'Failed to revoke webhook', 400);
  }
});

app.delete('/api/v1/webhooks/:id', requireApiAuth('webhooks:write'), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const ok = await WebhookServerEngine.deleteEndpoint(orgId, req.params.id);
    if (!ok) {
      sendError(res, 'NOT_FOUND', `Webhook endpoint ${req.params.id} not found.`, 404);
      return;
    }
    sendSuccess(res, { success: true, id: req.params.id }, undefined, 200, orgId);
  } catch (err: any) {
    sendError(res, 'WEBHOOK_DELETION_FAILED', err.message || 'Failed to delete webhook', 400);
  }
});

app.post('/api/v1/webhooks/:id/test', requireApiAuth('webhooks:write'), async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const delivery = await WebhookServerEngine.sendTestEvent(orgId, req.params.id);
    sendSuccess(res, { delivery }, undefined, 200, orgId);
  } catch (err: any) {
    sendError(res, 'WEBHOOK_TEST_FAILED', err.message || 'Failed to dispatch test event', 400);
  }
});

app.get('/api/v1/webhooks/:id/deliveries', requireApiAuth('webhooks:read'), (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const endpoint = WebhookServerEngine.getEndpoint(orgId, req.params.id);
  if (!endpoint) {
    sendError(res, 'NOT_FOUND', `Webhook endpoint ${req.params.id} not found.`, 404);
    return;
  }
  const deliveries = WebhookServerEngine.getDeliveries(orgId, { webhookId: req.params.id });
  const { items: paginated, pagination } = paginateList(deliveries, req.query.page, req.query.limit);
  sendSuccess(res, paginated, pagination, 200, orgId);
});

// ---------------------------------------------------------------------------
// 18. INTERNAL CREDENTIAL MANAGEMENT ENDPOINTS (For authenticated UI sessions)
// ---------------------------------------------------------------------------
app.get('/api/internal/integrations', (req: Request, res: Response) => {
  const orgId = req.query.organizationId as string;
  if (!orgId) {
    sendError(res, 'VALIDATION_ERROR', 'organizationId is required', 400);
    return;
  }
  const integrations = ApiIntegrationService.getIntegrations(orgId);
  sendSuccess(res, { integrations });
});

app.post('/api/internal/integrations', async (req: Request, res: Response) => {
  const { organizationId, payload, creator } = req.body;
  if (!organizationId || !payload) {
    sendError(res, 'VALIDATION_ERROR', 'organizationId and payload are required', 400);
    return;
  }

  try {
    const result = await ApiIntegrationService.createIntegration(
      organizationId,
      payload,
      creator || { id: 'usr_admin', name: 'Administrator' }
    );
    sendSuccess(res, result, undefined, 201);
  } catch (err: any) {
    sendError(res, 'CREATION_FAILED', err.message || 'Failed to create integration', 400);
  }
});

app.post('/api/internal/integrations/:id/rotate', async (req: Request, res: Response) => {
  const { organizationId, performer } = req.body;
  if (!organizationId) {
    sendError(res, 'VALIDATION_ERROR', 'organizationId is required', 400);
    return;
  }

  try {
    const result = await ApiIntegrationService.rotateIntegration(
      organizationId,
      req.params.id,
      performer || { id: 'usr_admin', name: 'Administrator' }
    );
    sendSuccess(res, result);
  } catch (err: any) {
    sendError(res, 'ROTATION_FAILED', err.message || 'Failed to rotate integration', 400);
  }
});

app.post('/api/internal/integrations/:id/revoke', async (req: Request, res: Response) => {
  const { organizationId, reason, performer } = req.body;
  if (!organizationId) {
    sendError(res, 'VALIDATION_ERROR', 'organizationId is required', 400);
    return;
  }

  try {
    const revoked = await ApiIntegrationService.revokeIntegration(
      organizationId,
      req.params.id,
      reason,
      performer || { id: 'usr_admin', name: 'Administrator' }
    );
    sendSuccess(res, { integration: revoked });
  } catch (err: any) {
    sendError(res, 'REVOCATION_FAILED', err.message || 'Failed to revoke integration', 400);
  }
});

app.get('/api/internal/integrations/audit', (req: Request, res: Response) => {
  const orgId = req.query.organizationId as string;
  if (!orgId) {
    sendError(res, 'VALIDATION_ERROR', 'organizationId is required', 400);
    return;
  }
  const logs = ApiIntegrationService.getAuditLogs(orgId);
  sendSuccess(res, { logs });
});

// ---------------------------------------------------------------------------
// 18.2 INTERNAL WEBHOOK MANAGEMENT ENDPOINTS (For authenticated UI sessions)
// ---------------------------------------------------------------------------
app.get('/api/internal/webhooks', requireServerAuth, (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const endpoints = WebhookServerEngine.getEndpoints(orgId);
  sendSuccess(res, { endpoints });
});

app.post('/api/internal/webhooks', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const { payload } = req.body;
  const creator = (req as any).authUser || { id: 'usr_admin', name: 'Administrator' };

  if (!payload) {
    sendError(res, 'VALIDATION_ERROR', 'payload is required', 400);
    return;
  }
  try {
    const result = await WebhookServerEngine.createEndpoint(orgId, payload, creator);
    sendSuccess(res, result, undefined, 201);
  } catch (e: any) {
    sendError(res, 'WEBHOOK_ERROR', e.message, 400);
  }
});

app.post('/api/internal/webhooks/dispatch', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const { event } = req.body;

  if (!event || !event.type) {
    sendError(res, 'VALIDATION_ERROR', 'Valid webhook event is required for dispatch', 400);
    return;
  }

  // Cross-tenant protection: verify event organization matches verified auth organization
  if (event.organizationId && event.organizationId !== orgId) {
    sendError(res, 'FORBIDDEN_TENANT_MISMATCH', 'Cannot dispatch webhook event for another organization', 403);
    return;
  }

  event.organizationId = orgId;
  try {
    const deliveries = await WebhookServerEngine.dispatchEvent(event);
    sendSuccess(res, { deliveries });
  } catch (e: any) {
    // Non-blocking fail-safe: return empty deliveries rather than crashing
    console.warn('[ServerInternalWebhooks] Dispatch warning:', e?.message);
    sendSuccess(res, { deliveries: [] });
  }
});

app.patch('/api/internal/webhooks/:id', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const { updates } = req.body;
  try {
    const updated = await WebhookServerEngine.updateEndpoint(orgId, req.params.id, updates || {});
    sendSuccess(res, { webhook: updated });
  } catch (e: any) {
    sendError(res, 'WEBHOOK_ERROR', e.message, 400);
  }
});

app.post('/api/internal/webhooks/:id/rotate', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const performer = (req as any).authUser || { id: 'usr_admin', name: 'Administrator' };
  try {
    const result = await WebhookServerEngine.rotateSecret(orgId, req.params.id, performer);
    sendSuccess(res, result);
  } catch (e: any) {
    sendError(res, 'WEBHOOK_ERROR', e.message, 400);
  }
});

app.post('/api/internal/webhooks/:id/revoke', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const performer = (req as any).authUser || { id: 'usr_admin', name: 'Administrator' };
  try {
    const revoked = await WebhookServerEngine.revokeEndpoint(orgId, req.params.id, performer);
    sendSuccess(res, { webhook: revoked });
  } catch (e: any) {
    sendError(res, 'WEBHOOK_ERROR', e.message, 400);
  }
});

app.delete('/api/internal/webhooks/:id', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const ok = await WebhookServerEngine.deleteEndpoint(orgId, req.params.id);
    sendSuccess(res, { success: ok, id: req.params.id });
  } catch (e: any) {
    sendError(res, 'WEBHOOK_ERROR', e.message, 400);
  }
});

app.post('/api/internal/webhooks/:id/test', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const delivery = await WebhookServerEngine.sendTestEvent(orgId, req.params.id);
    sendSuccess(res, { delivery });
  } catch (e: any) {
    sendError(res, 'WEBHOOK_TEST_ERROR', e.message, 400);
  }
});

app.get('/api/internal/webhooks/deliveries', requireServerAuth, (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const webhookId = req.query.webhookId as string | undefined;
  const eventType = req.query.eventType as string | undefined;
  const deliveries = WebhookServerEngine.getDeliveries(orgId, { webhookId, eventType });
  sendSuccess(res, { deliveries });
});

app.post('/api/internal/webhooks/deliveries/:id/retry', requireServerAuth, async (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const delivery = await WebhookServerEngine.retryDelivery(orgId, req.params.id);
    sendSuccess(res, { delivery });
  } catch (e: any) {
    sendError(res, 'WEBHOOK_RETRY_ERROR', e.message, 400);
  }
});

// ---------------------------------------------------------------------------
// 18. MULTI-TENANT SUBSCRIPTION & ENTITLEMENT ROUTES (PHASE 14.5)
// ---------------------------------------------------------------------------

// 1. Current organization subscription, usage metrics, and effective limits
app.get('/api/v1/subscriptions/current', requireServerAuth, (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  try {
    const entitlements = EntitlementServerService.getEffectiveEntitlements(orgId);
    sendSuccess(res, entitlements, undefined, 200, orgId);
  } catch (e: any) {
    sendError(res, 'SUBSCRIPTION_FETCH_ERROR', e.message, 500);
  }
});

// 2. Public / member listing of available subscription plans
app.get('/api/v1/subscriptions/plans', (_req: Request, res: Response) => {
  try {
    const plans = EntitlementServerService.getPlans();
    sendSuccess(res, { plans });
  } catch (e: any) {
    sendError(res, 'PLANS_FETCH_ERROR', e.message, 500);
  }
});

// 3. Organization Admin: Submit plan upgrade/change request (non-mock, zero fake payment)
app.post('/api/v1/subscriptions/request-change', requireServerAuth, (req: Request, res: Response) => {
  const orgId = (req as any).organizationId;
  const user = (req as any).authUser;
  const { requestedTier, requestedCycle, notes } = req.body;

  if (!requestedTier) {
    sendError(res, 'VALIDATION_ERROR', 'requestedTier is required (e.g., STARTER, BUSINESS, ENTERPRISE)', 400);
    return;
  }

  try {
    const request = EntitlementServerService.requestPlanChange(
      orgId,
      requestedTier,
      requestedCycle || 'MONTHLY',
      user?.name || user?.email || 'Org Administrator',
      notes
    );
    sendSuccess(res, { request }, undefined, 201, orgId);
  } catch (e: any) {
    sendError(res, 'PLAN_REQUEST_ERROR', e.message, 400);
  }
});

// 4. Platform Admin: Update an organization's plan tier
app.post('/api/v1/platform/subscriptions/:orgId/plan', requireServerAuth, requirePlatformAdmin, async (req: Request, res: Response) => {
  const targetOrgId = req.params.orgId;
  const user = (req as any).authUser;
  const { targetTier, billingCycle } = req.body;

  if (!targetTier) {
    sendError(res, 'VALIDATION_ERROR', 'targetTier is required', 400);
    return;
  }

  try {
    const result = await EntitlementServerService.changePlan(
      targetOrgId,
      targetTier,
      billingCycle || 'MONTHLY',
      user?.name || 'Platform Administrator'
    );
    sendSuccess(res, result, undefined, 200, targetOrgId);
  } catch (e: any) {
    sendError(res, 'PLAN_UPDATE_ERROR', e.message, 400);
  }
});

// 5. Platform Admin: Update subscription status (ACTIVE, SUSPENDED, GRACE_PERIOD, CANCELLED)
app.post('/api/v1/platform/subscriptions/:orgId/status', requireServerAuth, requirePlatformAdmin, async (req: Request, res: Response) => {
  const targetOrgId = req.params.orgId;
  const user = (req as any).authUser;
  const { status, adminNotes } = req.body;

  if (!status) {
    sendError(res, 'VALIDATION_ERROR', 'status is required', 400);
    return;
  }

  try {
    const sub = await EntitlementServerService.updateSubscriptionStatus(
      targetOrgId,
      status,
      user?.name || 'Platform Administrator',
      adminNotes
    );
    sendSuccess(res, { subscription: sub }, undefined, 200, targetOrgId);
  } catch (e: any) {
    sendError(res, 'STATUS_UPDATE_ERROR', e.message, 400);
  }
});

// 6. Platform Admin: Update or save subscription plan definition
app.put('/api/v1/platform/subscriptions/plans/:planId', requireServerAuth, requirePlatformAdmin, (req: Request, res: Response) => {
  const user = (req as any).authUser;
  const planData = req.body;

  if (!planData || !planData.planId) {
    sendError(res, 'VALIDATION_ERROR', 'Valid plan definition with planId is required', 400);
    return;
  }

  try {
    const saved = EntitlementServerService.savePlan(planData, user?.name || 'Platform Administrator');
    sendSuccess(res, { plan: saved });
  } catch (e: any) {
    sendError(res, 'PLAN_SAVE_ERROR', e.message, 400);
  }
});

// 7. Platform Admin: View subscription audit trail
app.get('/api/v1/platform/subscriptions/audit', requireServerAuth, requirePlatformAdmin, (req: Request, res: Response) => {
  const orgFilter = req.query.organizationId as string;
  try {
    const auditLogs = EntitlementServerService.getAuditEvents(orgFilter);
    sendSuccess(res, { auditLogs });
  } catch (e: any) {
    sendError(res, 'AUDIT_FETCH_ERROR', e.message, 500);
  }
});

// 404 handler for API routes
app.all('/api/v1/*', (_req: Request, res: Response) => {
  sendError(res, 'ENDPOINT_NOT_FOUND', 'The requested API endpoint does not exist. Refer to /api/v1/docs for available routes.', 404);
});


// ---------------------------------------------------------------------------
// 19. VITE DEV MIDDLEWARE & PRODUCTION STATIC SERVING
// ---------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite middleware mode in development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Universal Warehouse Full-Stack Server listening on http://0.0.0.0:${PORT}`);
    console.log(`🔒 Secure API Runtime mounted at http://0.0.0.0:${PORT}/api/v1/*`);
    console.log(`📖 Interactive API Documentation available at http://0.0.0.0:${PORT}/api/v1/docs`);
  });
}

// Start server when executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
