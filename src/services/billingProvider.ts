/**
 * ABSTRACT BILLING PROVIDER & MOCK PAYMENT ARCHITECTURE (PHASE 7)
 * 
 * Provides an enterprise billing provider abstraction layer so real providers
 * (e.g., Stripe, Adyen, BACS) can be plugged in without changing domain logic.
 * 
 * Includes MockBillingProvider for safe development and integration tests.
 * NEVER stores raw credit card credentials or sensitive payment secrets.
 */

import { OrganizationInvoice, SubscriptionPlan, OrganizationSubscription } from '../types/saas';

export interface CheckoutSessionOptions {
  organizationId: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  successUrl?: string;
  cancelUrl?: string;
  currency?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
  amount: number;
  currency: string;
  provider: string;
}

export interface WebhookProcessingResult {
  eventId: string;
  received: boolean;
  duplicate: boolean;
  actionTaken?: string;
  error?: string;
}

export interface BillingProvider {
  name: string;
  createCustomer(orgId: string, email: string, name: string): Promise<string>;
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>;
  createSubscription(orgId: string, plan: SubscriptionPlan, billingCycle: 'MONTHLY' | 'YEARLY'): Promise<OrganizationSubscription>;
  cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<{ success: boolean; effectiveDate: string }>;
  handleWebhook(rawPayload: any, signature?: string): Promise<WebhookProcessingResult>;
}

const STORAGE_KEY_WEBHOOK_EVENTS = 'alkarwan_saas_webhook_events_v1';
const STORAGE_KEY_MOCK_CUSTOMERS = 'alkarwan_saas_mock_customers_v1';

class MockBillingProviderImpl implements BillingProvider {
  name = 'MockBillingProvider (Development / Testing)';

  private getProcessedWebhooks(): Record<string, any> {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY_WEBHOOK_EVENTS);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private recordWebhook(event: { id: string; type: string; processedAt: string; payload: any }): void {
    if (typeof window === 'undefined') return;
    try {
      const processed = this.getProcessedWebhooks();
      processed[event.id] = event;
      localStorage.setItem(STORAGE_KEY_WEBHOOK_EVENTS, JSON.stringify(processed));
    } catch (e) {
      console.warn('[MockBillingProvider] Failed to persist webhook log:', e);
    }
  }

  async createCustomer(orgId: string, email: string, name: string): Promise<string> {
    const customerId = `cus_mock_${orgId}_${Date.now().toString(36)}`;
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_MOCK_CUSTOMERS);
        const map = stored ? JSON.parse(stored) : {};
        map[orgId] = { customerId, email, name, createdAt: new Date().toISOString() };
        localStorage.setItem(STORAGE_KEY_MOCK_CUSTOMERS, JSON.stringify(map));
      }
    } catch {}
    return customerId;
  }

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const sessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      sessionId,
      url: options.successUrl || `/billing?session_id=${sessionId}`,
      amount: options.billingCycle === 'YEARLY' ? 1490 : 149,
      currency: options.currency || 'USD',
      provider: this.name,
    };
  }

  async createSubscription(
    orgId: string,
    plan: SubscriptionPlan,
    billingCycle: 'MONTHLY' | 'YEARLY'
  ): Promise<OrganizationSubscription> {
    const now = new Date();
    const currentPeriodEnd = new Date(now);
    if (billingCycle === 'YEARLY') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    const sub: OrganizationSubscription = {
      subscriptionId: `sub_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: orgId,
      planId: plan.planId,
      planTier: plan.tier,
      status: 'ACTIVE',
      billingCycle,
      startDate: now.toISOString(),
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      paymentProvider: 'MockBillingProvider',
      externalCustomerId: `cus_mock_${orgId}`,
      externalSubscriptionId: `sub_ext_${Date.now()}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return sub;
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd: boolean): Promise<{ success: boolean; effectiveDate: string }> {
    const now = new Date();
    const effective = atPeriodEnd
      ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString()
      : now.toISOString();

    return {
      success: true,
      effectiveDate: effective,
    };
  }

  /**
   * Safe, Idempotent Webhook Handler
   */
  async handleWebhook(rawPayload: any, _signature?: string): Promise<WebhookProcessingResult> {
    const eventId = rawPayload?.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const eventType = rawPayload?.type || 'payment.succeeded';

    // Idempotency check: if already processed, return duplicate without reprocessing
    const processedEvents = this.getProcessedWebhooks();
    if (processedEvents[eventId]) {
      return {
        eventId,
        received: true,
        duplicate: true,
        actionTaken: 'Ignored duplicate webhook event safely',
      };
    }

    // Record processed event
    this.recordWebhook({
      id: eventId,
      type: eventType,
      processedAt: new Date().toISOString(),
      payload: rawPayload,
    });

    return {
      eventId,
      received: true,
      duplicate: false,
      actionTaken: `Processed ${eventType} successfully`,
    };
  }

  getProcessedWebhookEvents(): any[] {
    const map = this.getProcessedWebhooks();
    return Object.values(map);
  }
}

export const MockBillingProvider = new MockBillingProviderImpl();
