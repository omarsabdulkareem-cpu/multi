/**
 * BROWSER-SAFE WEBHOOK SERVICE CLIENT (PHASE 14.4)
 *
 * Runs safely in frontend browser environments without importing Node.js 'crypto'.
 * Responsibilities:
 * 1. Generates versioned WebhookEvent contracts for confirmed warehouse operations
 * 2. Communicates with trusted server-side API (/api/internal/webhooks/*)
 * 3. ZERO raw secrets stored in browser localStorage or memory
 * 4. Asynchronous non-blocking dispatch: failures never revert warehouse transactions
 * 5. Uses Firebase Authentication token when available for server authorization
 */

import {
  SafeWebhookEndpoint,
  WebhookEvent,
  WebhookEventType,
  WebhookDelivery,
  CreateWebhookRequest,
  CreateWebhookResponse,
  RotateWebhookSecretResponse,
} from '../types/webhook';
import { auth } from './firebase';

const CACHE_KEY_SAFE_ENDPOINTS = 'alkarwan_safe_webhook_endpoints_cache_v1';
const CACHE_KEY_SAFE_DELIVERIES = 'alkarwan_safe_webhook_deliveries_cache_v1';

export class WebhookService {
  private static memorySafeEndpoints: Record<string, SafeWebhookEndpoint[]> = {};
  private static memorySafeDeliveries: Record<string, WebhookDelivery[]> = {};

  // ---------------------------------------------------------------------------
  // AUTHENTICATION HEADERS HELPER
  // ---------------------------------------------------------------------------
  private static async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    try {
      if (typeof window !== 'undefined' && auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
          return headers;
        }
      }
    } catch {}

    // Fallback user session identity for development
    if (typeof window !== 'undefined') {
      try {
        const savedUser = localStorage.getItem('alkarwan_factory_state_v2_user');
        if (savedUser) {
          const user = JSON.parse(savedUser);
          if (user?.id) headers['x-user-id'] = user.id;
          if (user?.email) headers['x-user-email'] = user.email;
        }
      } catch {}
    }

    return headers;
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // CACHE HELPERS (SAFE METADATA ONLY, ZERO SECRETS)
  // ---------------------------------------------------------------------------
  private static getDefaultSafeSeeds(orgId: string): SafeWebhookEndpoint[] {
    if (orgId === 'org_demo' || orgId === 'org_alkarwan') {
      return [
        {
          id: `wh_seed_erp_${orgId}`,
          organizationId: orgId,
          name: 'Enterprise SAP / ERP Inbound Sync',
          description: 'Streaming confirmed goods receipts, issues, and variance adjustments to core ERP.',
          url: 'https://webhook.site/demo-erp-receiver',
          subscribedEvents: [
            'inventory.receipt.confirmed',
            'inventory.issue.confirmed',
            'inventory.transfer.completed',
            'inventory.adjustment.confirmed',
            'purchase_order.received',
          ],
          status: 'ACTIVE',
          keyPrefix: 'whsec_d47a8f9c...',
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          lastDeliveryAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
          lastDeliveryStatus: 'SUCCESS',
          failureCount: 0,
          rateLimitPerMinute: 300,
          createdBy: 'usr_admin',
          createdByName: 'System Administrator',
        },
        {
          id: `wh_seed_wms_${orgId}`,
          organizationId: orgId,
          name: 'Logistics Fleet Dispatch Listener',
          description: 'Notified on completed warehouse transfers and stock issues for carrier dispatch.',
          url: 'https://webhook.site/demo-logistics-dispatcher',
          subscribedEvents: [
            'inventory.transfer.completed',
            'inventory.issue.confirmed',
          ],
          status: 'ACTIVE',
          keyPrefix: 'whsec_e58b9a0d...',
          createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          lastDeliveryAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          lastDeliveryStatus: 'SUCCESS',
          failureCount: 0,
          rateLimitPerMinute: 120,
          createdBy: 'usr_admin',
          createdByName: 'System Administrator',
        },
      ];
    }
    return [];
  }

  private static getDefaultDeliveries(orgId: string): WebhookDelivery[] {
    if (orgId === 'org_demo' || orgId === 'org_alkarwan') {
      return [
        {
          id: `del_seed_${orgId}_1`,
          webhookId: `wh_seed_erp_${orgId}`,
          organizationId: orgId,
          eventId: 'evt_seed_gr_1001',
          eventType: 'inventory.receipt.confirmed',
          destinationUrl: 'https://webhook.site/demo-erp-receiver',
          attemptNumber: 1,
          maxAttempts: 3,
          status: 'SUCCESS',
          statusCode: 200,
          durationMs: 142,
          requestHeaders: {
            'Content-Type': 'application/json',
            'User-Agent': 'Universal-Warehouse-Webhooks/1.0',
            'X-Warehouse-Event-Id': 'evt_seed_gr_1001',
            'X-Warehouse-Event-Type': 'inventory.receipt.confirmed',
            'X-Warehouse-Delivery-Id': `del_seed_${orgId}_1`,
            'X-Warehouse-Timestamp': String(Math.floor(Date.now() / 1000) - 720),
            'X-Warehouse-Signature': 't=1729000000,v1=9e8f1b...',
          },
          requestPayload: {
            id: 'evt_seed_gr_1001',
            type: 'inventory.receipt.confirmed',
            schemaVersion: '2026-10-01',
            organizationId: orgId,
            timestamp: new Date(Date.now() - 720000).toISOString(),
            data: {
              receiptId: 'GR-2026-00012',
              receiptNumber: 'GRN-84910',
              warehouseId: 'wh_raw_materials',
              supplierName: 'SABIC Polymers KSA',
              totalQuantity: 240,
              totalWeightKG: 6000,
              linesCount: 3,
              confirmedAt: new Date(Date.now() - 720000).toISOString(),
            },
          },
          responseBody: JSON.stringify({ received: true, ack: 'ERP_DOC_99214' }),
          errorMessage: null,
          createdAt: new Date(Date.now() - 720000).toISOString(),
        },
      ];
    }
    return [];
  }

  private static getCachedEndpoints(orgId: string): SafeWebhookEndpoint[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CACHE_KEY_SAFE_ENDPOINTS);
        if (raw) {
          const all = JSON.parse(raw);
          if (all[orgId] && all[orgId].length > 0) return all[orgId];
        }
      } catch {}
    }
    const inMem = this.memorySafeEndpoints[orgId];
    if (inMem && inMem.length > 0) return inMem;
    const defaults = this.getDefaultSafeSeeds(orgId);
    if (defaults.length > 0) {
      this.memorySafeEndpoints[orgId] = defaults;
      return defaults;
    }
    return [];
  }

  private static setCachedEndpoints(orgId: string, endpoints: SafeWebhookEndpoint[]): void {
    this.memorySafeEndpoints[orgId] = endpoints;
    if (typeof window !== 'undefined') {
      try {
        const all = JSON.parse(localStorage.getItem(CACHE_KEY_SAFE_ENDPOINTS) || '{}');
        all[orgId] = endpoints;
        localStorage.setItem(CACHE_KEY_SAFE_ENDPOINTS, JSON.stringify(all));
      } catch {}
    }
  }

  private static getCachedDeliveries(orgId: string): WebhookDelivery[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CACHE_KEY_SAFE_DELIVERIES);
        if (raw) {
          const all = JSON.parse(raw);
          if (all[orgId] && all[orgId].length > 0) return all[orgId];
        }
      } catch {}
    }
    const inMem = this.memorySafeDeliveries[orgId];
    if (inMem && inMem.length > 0) return inMem;
    const defaults = this.getDefaultDeliveries(orgId);
    if (defaults.length > 0) {
      this.memorySafeDeliveries[orgId] = defaults;
      return defaults;
    }
    return [];
  }

  private static setCachedDeliveries(orgId: string, deliveries: WebhookDelivery[]): void {
    this.memorySafeDeliveries[orgId] = deliveries;
    if (typeof window !== 'undefined') {
      try {
        const all = JSON.parse(localStorage.getItem(CACHE_KEY_SAFE_DELIVERIES) || '{}');
        all[orgId] = deliveries;
        localStorage.setItem(CACHE_KEY_SAFE_DELIVERIES, JSON.stringify(all));
      } catch {}
    }
  }

  // ---------------------------------------------------------------------------
  // EVENT CREATION (BROWSER-SAFE HELPER)
  // ---------------------------------------------------------------------------
  public static createEvent<T = any>(
    type: WebhookEventType,
    organizationId: string,
    data: T,
    businessEntityId?: string
  ): WebhookEvent<T> {
    const randomHex = Math.random().toString(36).slice(2, 10);
    const nowIso = new Date().toISOString();
    const id = businessEntityId
      ? `evt_${type.replace(/\./g, '_')}_${businessEntityId}`
      : `evt_${Date.now()}_${randomHex}`;
    return {
      id,
      type,
      schemaVersion: '2026-10-01',
      organizationId,
      occurredAt: nowIso,
      timestamp: nowIso,
      data,
    };
  }

  /**
   * Asynchronously posts a confirmed event to the server-side webhook engine.
   * Completely non-blocking: never fails, blocks, or reverts warehouse transactions.
   */
  public static async dispatchEvent<T = any>(event: WebhookEvent<T>): Promise<WebhookDelivery[]> {
    if (typeof window === 'undefined') {
      // In server or test environment without browser window:
      return [];
    }

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('/api/internal/webhooks/dispatch', {
        method: 'POST',
        headers,
        body: JSON.stringify({ event }),
      });
      if (res.ok) {
        const body = await res.json();
        return body.data?.deliveries || [];
      }
    } catch (err: any) {
      console.warn('[WebhookClient] Non-blocking dispatch notice:', err?.message);
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // ENDPOINT CRUD OPERATIONS (CALLS TRUSTED SERVER)
  // ---------------------------------------------------------------------------
  public static async getEndpointsAsync(orgId: string): Promise<SafeWebhookEndpoint[]> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`/api/internal/webhooks?organizationId=${encodeURIComponent(orgId)}`, {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        const body = await res.json();
        const endpoints: SafeWebhookEndpoint[] = body.data?.endpoints || [];
        this.setCachedEndpoints(orgId, endpoints);
        return endpoints;
      }
    } catch {}
    return this.getCachedEndpoints(orgId);
  }

  public static getEndpoints(orgId: string): SafeWebhookEndpoint[] {
    // Synchronous getter returning cached safe endpoints immediately, while revalidating
    this.getEndpointsAsync(orgId).catch(() => {});
    return this.getCachedEndpoints(orgId);
  }

  public static getEndpoint(orgId: string, endpointId: string): SafeWebhookEndpoint | null {
    const cached = this.getCachedEndpoints(orgId);
    return cached.find((e) => e.id === endpointId) || null;
  }

  public static async createEndpoint(
    orgId: string,
    payload: CreateWebhookRequest,
    creator: { id: string; name: string }
  ): Promise<CreateWebhookResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch('/api/internal/webhooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ organizationId: orgId, payload, creator }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to create webhook endpoint on server.');
    }

    // Refresh cached endpoints (without raw secret!)
    await this.getEndpointsAsync(orgId);

    return {
      webhook: body.data.webhook,
      rawSecret: body.data.rawSecret, // Revealed only in return object for immediate UI copy!
    };
  }

  public static async updateEndpoint(
    orgId: string,
    endpointId: string,
    updates: Partial<Pick<CreateWebhookRequest, 'name' | 'description' | 'url' | 'subscribedEvents' | 'rateLimitPerMinute'>> & { status?: 'ACTIVE' | 'DISABLED' }
  ): Promise<SafeWebhookEndpoint> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/internal/webhooks/${endpointId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ organizationId: orgId, updates }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to update webhook on server.');
    }

    await this.getEndpointsAsync(orgId);
    return body.data.webhook;
  }

  public static async rotateSecret(
    orgId: string,
    endpointId: string,
    performer: { id: string; name: string }
  ): Promise<RotateWebhookSecretResponse> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/internal/webhooks/${endpointId}/rotate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ organizationId: orgId, performer }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to rotate webhook secret on server.');
    }

    await this.getEndpointsAsync(orgId);
    return {
      webhook: body.data.webhook,
      rawSecret: body.data.rawSecret,
    };
  }

  public static async revokeEndpoint(
    orgId: string,
    endpointId: string,
    performer: { id: string; name: string }
  ): Promise<SafeWebhookEndpoint> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/internal/webhooks/${endpointId}/revoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ organizationId: orgId, performer }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to revoke webhook on server.');
    }

    await this.getEndpointsAsync(orgId);
    return body.data.webhook;
  }

  public static async deleteEndpoint(orgId: string, endpointId: string): Promise<boolean> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/internal/webhooks/${endpointId}?organizationId=${encodeURIComponent(orgId)}`, {
      method: 'DELETE',
      headers,
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to delete webhook on server.');
    }

    await this.getEndpointsAsync(orgId);
    return true;
  }

  public static async sendTestEvent(orgId: string, endpointId: string): Promise<WebhookDelivery> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/internal/webhooks/${endpointId}/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ organizationId: orgId }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to dispatch test event from server.');
    }

    // Refresh deliveries
    await this.getDeliveriesAsync(orgId);
    return body.data.delivery;
  }

  public static async getDeliveriesAsync(orgId: string, filter?: { webhookId?: string; eventType?: string }): Promise<WebhookDelivery[]> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `/api/internal/webhooks/deliveries?organizationId=${encodeURIComponent(orgId)}`;
      if (filter?.webhookId) url += `&webhookId=${encodeURIComponent(filter.webhookId)}`;
      if (filter?.eventType) url += `&eventType=${encodeURIComponent(filter.eventType)}`;

      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        const body = await res.json();
        const deliveries: WebhookDelivery[] = body.data?.deliveries || [];
        this.setCachedDeliveries(orgId, deliveries);
        return deliveries;
      }
    } catch {}
    return this.getCachedDeliveries(orgId);
  }

  public static getDeliveries(orgId: string, filter?: { webhookId?: string; eventType?: string }): WebhookDelivery[] {
    this.getDeliveriesAsync(orgId, filter).catch(() => {});
    let list = this.getCachedDeliveries(orgId);
    if (filter?.webhookId) list = list.filter((d) => d.webhookId === filter.webhookId);
    if (filter?.eventType) list = list.filter((d) => d.eventType === filter.eventType);
    return list;
  }

  public static async retryDelivery(orgId: string, deliveryId: string): Promise<WebhookDelivery> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`/api/internal/webhooks/deliveries/${deliveryId}/retry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ organizationId: orgId }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error?.message || 'Failed to retry delivery on server.');
    }

    await this.getDeliveriesAsync(orgId);
    return body.data.delivery;
  }
}
