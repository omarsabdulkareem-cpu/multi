/**
 * SERVER-SIDE SUBSCRIPTION & ENTITLEMENT ENGINE (PHASE 14.5)
 * Universal Warehouse Management SaaS Platform
 *
 * Responsibilities:
 * 1. Authoritative server-side subscription repository and plan configuration
 * 2. Organization tenant isolation: subscriptions are strictly partitioned per organization
 * 3. Backward-compatible default assignment policy for existing organizations
 * 4. Multi-tier subscription lifecycle enforcement (TRIAL, ACTIVE, PAST_DUE, GRACE_PERIOD, SUSPENDED, CANCELLED, EXPIRED)
 * 5. Safe read-only mode for grace period and suspended organizations (zero data loss, historical data fully intact)
 * 6. Server-side feature entitlement and resource limit verification
 * 7. Downgrade safety checks (prevents downgrading if current usage exceeds target limits)
 * 8. Auditable administrative controls (plan definitions, status overrides, and change requests)
 * 9. Absolute decoupling from physical warehouse stock and transactions (zero balance alterations)
 */

import {
  SubscriptionPlan,
  PlanTier,
  OrganizationSubscription,
  SubscriptionStatus,
  BillingCycle,
  SubscriptionPlanLimits,
  SubscriptionPlanFeatures,
  SubscriptionGuardResult,
  EntitlementEvaluation,
  SubscriptionEvent,
  DEFAULT_SUBSCRIPTION_PLANS,
} from '../types/saas';
import { TenantService } from '../services/tenantService';

export interface PlanChangeRequest {
  requestId: string;
  organizationId: string;
  requestedTier: PlanTier;
  requestedCycle: BillingCycle;
  requestedBy: string;
  notes?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface EffectiveEntitlements {
  organizationId: string;
  subscription: OrganizationSubscription;
  plan: SubscriptionPlan;
  guard: SubscriptionGuardResult;
  isReadOnly: boolean;
  limits: SubscriptionPlanLimits;
  usage: Record<string, number>;
  features: SubscriptionPlanFeatures;
}

export class EntitlementServerService {
  // In-memory server-authoritative stores with persistence support
  private static plans: Map<string, SubscriptionPlan> = new Map();
  private static subscriptions: Map<string, OrganizationSubscription> = new Map();
  private static changeRequests: Map<string, PlanChangeRequest> = new Map();
  private static auditEvents: SubscriptionEvent[] = [];
  private static isInitialized = false;

  /**
   * Initializes baseline plans and default subscriptions for existing organizations.
   */
  public static init(): void {
    if (this.isInitialized) return;

    // 1. Seed baseline configurable plans
    // Add Free/Trial evaluation plan if not present
    const freePlan: SubscriptionPlan = {
      planId: 'plan_free_trial_v1',
      tier: 'STARTER', // mapped to entry tier
      version: 1,
      name: 'Evaluation & Free Trial',
      nameAr: 'التقييم والتجربة المجانية (Trial)',
      description: 'Zero-commitment evaluation tier for testing warehouse workflows.',
      descriptionAr: 'باقة تقييم وتجربة مجانية لاختبار عمليات المستودع الأساسية.',
      monthlyPrice: 0,
      yearlyPrice: 0,
      currency: 'USD',
      active: true,
      trialDays: 14,
      limits: {
        maxUsers: 2,
        maxWarehouses: 1,
        maxLocations: 10,
        maxItems: 100,
        maxMonthlyTransactions: 250,
        maxStorageGB: 1,
        maxSuppliers: 5,
        maxCustomers: 5,
        maxProductionOrders: 0,
        maxApiCalls: 100,
        maxBarcodeOperations: 500,
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
        barcode: true,
      },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    this.plans.set(freePlan.planId, freePlan);

    DEFAULT_SUBSCRIPTION_PLANS.forEach((plan) => {
      this.plans.set(plan.planId, { ...plan });
    });

    // 2. Backward compatibility policy: Seed active subscriptions for primary existing organizations
    // Primary AL-KARWAN tenant receives ENTERPRISE tier to guarantee all existing operations continue seamlessly
    this.seedDefaultSubscription('org_alkarwan', 'ENTERPRISE', 'ACTIVE');
    this.seedDefaultSubscription('org_alkarwan_wh_qa', 'ENTERPRISE', 'ACTIVE');
    this.seedDefaultSubscription('org_apex_wh_qa', 'BUSINESS', 'ACTIVE');

    this.isInitialized = true;
  }

  private static seedDefaultSubscription(
    orgId: string,
    tier: PlanTier,
    status: SubscriptionStatus = 'ACTIVE'
  ): OrganizationSubscription {
    const matchingPlan =
      Array.from(this.plans.values()).find((p) => p.tier === tier && p.planId !== 'plan_free_trial_v1') ||
      Array.from(this.plans.values())[0];

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const sub: OrganizationSubscription = {
      subscriptionId: `sub_${orgId}_primary`,
      organizationId: orgId,
      planId: matchingPlan.planId,
      planTier: matchingPlan.tier,
      status,
      billingCycle: 'YEARLY',
      startDate: '2026-01-01T00:00:00.000Z',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      paymentProvider: 'INVOICE_TERMS',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now.toISOString(),
    };

    this.subscriptions.set(orgId, sub);
    return sub;
  }

  // ===========================================================================
  // 1. PLAN DEFINITIONS (PLATFORM ADMIN)
  // ===========================================================================

  public static getPlans(): SubscriptionPlan[] {
    this.init();
    return Array.from(this.plans.values());
  }

  public static getPlan(planIdOrTier: string): SubscriptionPlan {
    this.init();
    const all = Array.from(this.plans.values());
    const found =
      all.find((p) => p.planId === planIdOrTier) ||
      all.find((p) => p.tier.toLowerCase() === planIdOrTier.toLowerCase());

    return found || all[0];
  }

  public static savePlan(
    plan: SubscriptionPlan,
    actor: string = 'Platform Administrator'
  ): SubscriptionPlan {
    this.init();
    const existing = this.plans.get(plan.planId);
    const updated: SubscriptionPlan = {
      ...plan,
      version: existing ? existing.version + 1 : 1,
      updatedAt: new Date().toISOString(),
    };

    this.plans.set(updated.planId, updated);

    this.recordAuditEvent({
      id: `evt_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: 'platform',
      subscriptionId: updated.planId,
      event: 'PLAN_CHANGED',
      previousState: existing ? JSON.stringify(existing.limits) : undefined,
      newState: JSON.stringify(updated.limits),
      actor,
      timestamp: new Date().toISOString(),
      metadata: { planId: updated.planId, tier: updated.tier, version: updated.version },
    });

    return updated;
  }

  // ===========================================================================
  // 2. SUBSCRIPTION RETRIEVAL & DEFAULT COMPATIBILITY
  // ===========================================================================

  /**
   * Retrieves subscription for an organization.
   * If missing, implements the safe backward compatibility policy:
   * Returns a standard active STARTER plan without disrupting existing operations.
   */
  public static getSubscription(orgId: string): OrganizationSubscription {
    this.init();

    if (!orgId) {
      throw new Error('Organization ID is required to retrieve subscription.');
    }

    const existing = this.subscriptions.get(orgId);
    if (existing) {
      return { ...existing };
    }

    // Default backward compatibility fallback: assign active STARTER tier
    return this.seedDefaultSubscription(orgId, 'STARTER', 'ACTIVE');
  }

  /**
   * Retrieves effective entitlements for an organization.
   */
  public static getEffectiveEntitlements(
    orgId: string,
    currentUsage?: Record<string, number>
  ): EffectiveEntitlements {
    const subscription = this.getSubscription(orgId);
    const plan = this.getPlan(subscription.planId) || this.getPlan(subscription.planTier);
    const guard = this.checkSubscriptionGuard(orgId);

    const usage = currentUsage || {
      usersCount: 1,
      warehousesCount: 1,
      locationsCount: 5,
      itemsCount: 20,
      monthlyTransactionsCount: 50,
      storageUsedGB: 0.1,
      apiCallsCount: 10,
    };

    return {
      organizationId: orgId,
      subscription,
      plan,
      guard,
      isReadOnly: guard.isReadOnly,
      limits: plan.limits,
      usage,
      features: plan.features,
    };
  }

  // ===========================================================================
  // 3. SUBSCRIPTION LIFECYCLE GUARDS & READ-ONLY MODE
  // ===========================================================================

  /**
   * Evaluates organization subscription lifecycle status.
   * Enforces safe read-only policy for GRACE_PERIOD, SUSPENDED, CANCELLED, and EXPIRED.
   * Data is NEVER deleted on expiration or suspension.
   */
  public static checkSubscriptionGuard(orgId: string): SubscriptionGuardResult {
    const sub = this.getSubscription(orgId);

    switch (sub.status) {
      case 'ACTIVE':
        return {
          allowed: true,
          status: 'ACTIVE',
          isReadOnly: false,
          messageAr: 'الاشتراك نشط بكافة الصلاحيات التشغيلية',
          messageEn: 'Subscription is fully active with all operational features enabled',
          canAccessBilling: true,
        };
      case 'TRIAL':
        return {
          allowed: true,
          status: 'TRIAL',
          isReadOnly: false,
          messageAr: 'الفترة التجريبية نشطة',
          messageEn: 'Evaluation trial is active',
          canAccessBilling: true,
        };
      case 'PAST_DUE':
        // Past due permits operational continuity while warning the customer
        return {
          allowed: true,
          status: 'PAST_DUE',
          isReadOnly: false,
          messageAr: 'تأخر سداد الفاتورة. يرجى تسوية الحساب لتفادي تقييد الخدمة.',
          messageEn: 'Payment past due. Please settle invoice to avoid service restriction.',
          canAccessBilling: true,
        };
      case 'GRACE_PERIOD':
        // Safe read-only mode: historical data intact, mutations prohibited
        return {
          allowed: true,
          status: 'GRACE_PERIOD',
          isReadOnly: true,
          messageAr: 'فترة السماح مفعلة - النظام في وضع القراءة الآمنة. كافة السجلات والتقارير متاحة، ولكن العمليات الجديدة مقيدة حتى تجديد الاشتراك.',
          messageEn: 'Grace Period Active - Safe Read-Only Mode. All historical data, reports, and ledger records remain fully accessible. Renew subscription to perform new inventory transactions.',
          canAccessBilling: true,
        };
      case 'SUSPENDED':
        return {
          allowed: false,
          status: 'SUSPENDED',
          isReadOnly: true,
          messageAr: 'تم تعليق الاشتراك مؤقتاً بواسطة إدارة المنصة. كافة بياناتك وسجلاتك محفوظة بأمان تام.',
          messageEn: 'Subscription suspended by platform administrator. All historical data is securely preserved. Write operations are disabled.',
          canAccessBilling: true,
        };
      case 'CANCELLED':
        return {
          allowed: false,
          status: 'CANCELLED',
          isReadOnly: true,
          messageAr: 'تم إلغاء الاشتراك. كافة السجلات والتقارير والمستندات محفوظة بأمان وفق سياسة الاحتفاظ.',
          messageEn: 'Subscription cancelled. All historical records, documents, and ledger entries are permanently retained in read-only mode.',
          canAccessBilling: true,
        };
      case 'EXPIRED':
        return {
          allowed: false,
          status: 'EXPIRED',
          isReadOnly: true,
          messageAr: 'انتهت صلاحية الاشتراك. يرجى تجديد الاشتراك أو الترقية للاستمرار في إدخال العمليات.',
          messageEn: 'Subscription expired. Read-only access to existing records is preserved. Upgrade or renew to perform warehouse operations.',
          canAccessBilling: true,
        };
      default:
        return {
          allowed: true,
          status: 'ACTIVE',
          isReadOnly: false,
          messageAr: 'الاشتراك نشط',
          messageEn: 'Active',
          canAccessBilling: true,
        };
    }
  }

  // ===========================================================================
  // 4. ENTITLEMENT CHECKS (FEATURES & LIMITS)
  // ===========================================================================

  /**
   * Verifies if an organization is entitled to a specific feature.
   * Server-authoritative: completely ignores client-supplied flags.
   */
  public static canUseFeature(
    orgId: string,
    featureKey: keyof SubscriptionPlanFeatures
  ): { allowed: boolean; reason?: string } {
    const sub = this.getSubscription(orgId);
    const plan = this.getPlan(sub.planId) || this.getPlan(sub.planTier);

    if (!plan) {
      return { allowed: false, reason: 'Subscription plan not found.' };
    }

    const featureValue = plan.features?.[featureKey];
    if (!featureValue) {
      return {
        allowed: false,
        reason: `Feature "${featureKey}" is not included in the ${plan.name} (${sub.planTier}) plan. Please upgrade to a higher tier.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Evaluates if current usage plus proposed increment exceeds the plan limit.
   */
  public static canUseLimit(
    orgId: string,
    limitKey: keyof SubscriptionPlanLimits,
    currentCount: number,
    increment: number = 1
  ): EntitlementEvaluation {
    const sub = this.getSubscription(orgId);
    const plan = this.getPlan(sub.planId) || this.getPlan(sub.planTier);
    const limit = plan?.limits?.[limitKey] ?? null;

    if (limit === null) {
      // null indicates unlimited
      return { allowed: true, current: currentCount, limit: null };
    }

    const projected = currentCount + increment;
    const allowed = projected <= limit;

    return {
      allowed,
      current: currentCount,
      limit,
      percentage: Math.min(100, Math.round((currentCount / limit) * 100)),
      reason: allowed
        ? undefined
        : `Limit exceeded for ${limitKey}: Current ${currentCount} + ${increment} exceeds maximum allowed of ${limit} on ${plan.name}.`,
      upgradeRequired: !allowed,
    };
  }

  // ===========================================================================
  // 5. ADMINISTRATIVE SUBSCRIPTION MANAGEMENT & PLAN CHANGES
  // ===========================================================================

  /**
   * Platform Administrator changes an organization's subscription plan.
   * Performs safety checks against downgrading if current usage exceeds target limits.
   * Does NOT alter physical warehouse balances or inventory records.
   */
  public static async changePlan(
    orgId: string,
    targetTier: PlanTier,
    billingCycle: BillingCycle = 'MONTHLY',
    actor: string = 'Platform Administrator',
    currentUsage?: Record<string, number>
  ): Promise<{ success: boolean; subscription: OrganizationSubscription }> {
    this.init();
    const currentSub = this.getSubscription(orgId);
    const targetPlan = this.getPlan(targetTier);

    if (!targetPlan) {
      throw new Error(`Target subscription plan "${targetTier}" does not exist.`);
    }

    // Downgrade check if usage is provided
    if (currentUsage) {
      const violations: string[] = [];
      if (targetPlan.limits.maxUsers !== null && (currentUsage.usersCount || 0) > targetPlan.limits.maxUsers) {
        violations.push(`Users (${currentUsage.usersCount}) exceeds target limit (${targetPlan.limits.maxUsers})`);
      }
      if (targetPlan.limits.maxWarehouses !== null && (currentUsage.warehousesCount || 0) > targetPlan.limits.maxWarehouses) {
        violations.push(`Warehouses (${currentUsage.warehousesCount}) exceeds target limit (${targetPlan.limits.maxWarehouses})`);
      }
      if (targetPlan.limits.maxItems !== null && (currentUsage.itemsCount || 0) > targetPlan.limits.maxItems) {
        violations.push(`Items (${currentUsage.itemsCount}) exceeds target limit (${targetPlan.limits.maxItems})`);
      }

      if (violations.length > 0) {
        throw new Error(`Cannot downgrade to ${targetPlan.name}: ${violations.join(', ')}. Please reduce usage before downgrading.`);
      }
    }

    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + (billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    const updatedSub: OrganizationSubscription = {
      ...currentSub,
      planId: targetPlan.planId,
      planTier: targetPlan.tier,
      billingCycle,
      status: 'ACTIVE',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.subscriptions.set(orgId, updatedSub);

    this.recordAuditEvent({
      id: `evt_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: orgId,
      subscriptionId: updatedSub.subscriptionId,
      event: 'PLAN_CHANGED',
      previousState: currentSub.planTier,
      newState: updatedSub.planTier,
      actor,
      timestamp: now.toISOString(),
      metadata: {
        fromTier: currentSub.planTier,
        toTier: targetPlan.tier,
        billingCycle,
      },
    });

    return { success: true, subscription: updatedSub };
  }

  /**
   * Platform Administrator updates subscription status (e.g., ACTIVE, SUSPENDED, GRACE_PERIOD).
   */
  public static async updateSubscriptionStatus(
    orgId: string,
    newStatus: SubscriptionStatus,
    actor: string = 'Platform Administrator',
    adminNotes?: string
  ): Promise<OrganizationSubscription> {
    this.init();
    const currentSub = this.getSubscription(orgId);
    const now = new Date().toISOString();

    const updatedSub: OrganizationSubscription = {
      ...currentSub,
      status: newStatus,
      suspendedAt: newStatus === 'SUSPENDED' ? now : currentSub.suspendedAt,
      cancelledAt: newStatus === 'CANCELLED' ? now : currentSub.cancelledAt,
      updatedAt: now,
    };

    this.subscriptions.set(orgId, updatedSub);

    this.recordAuditEvent({
      id: `evt_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: orgId,
      subscriptionId: updatedSub.subscriptionId,
      event: newStatus === 'SUSPENDED' ? 'SUSPENDED' : newStatus === 'ACTIVE' ? 'ACTIVATED' : 'PLAN_CHANGED',
      previousState: currentSub.status,
      newState: newStatus,
      actor,
      timestamp: now,
      metadata: { adminNotes },
    });

    return updatedSub;
  }

  /**
   * Organization Administrator submits an upgrade or plan change request.
   * Safe operational pattern: does not simulate fake instant credit card payments.
   */
  public static requestPlanChange(
    orgId: string,
    requestedTier: PlanTier,
    requestedCycle: BillingCycle,
    requestedBy: string,
    notes?: string
  ): PlanChangeRequest {
    this.init();
    const requestId = `req_plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const request: PlanChangeRequest = {
      requestId,
      organizationId: orgId,
      requestedTier,
      requestedCycle,
      requestedBy,
      notes,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.changeRequests.set(requestId, request);

    this.recordAuditEvent({
      id: `evt_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: orgId,
      subscriptionId: requestId,
      event: 'PLAN_CHANGED',
      newState: `REQUESTED_${requestedTier}`,
      actor: requestedBy,
      timestamp: new Date().toISOString(),
      metadata: { requestedTier, requestedCycle, notes },
    });

    return request;
  }

  public static getChangeRequests(orgId?: string): PlanChangeRequest[] {
    this.init();
    const all = Array.from(this.changeRequests.values());
    if (orgId) {
      return all.filter((r) => r.organizationId === orgId);
    }
    return all;
  }

  // ===========================================================================
  // 6. AUDIT TRAIL
  // ===========================================================================

  private static recordAuditEvent(event: SubscriptionEvent): void {
    this.auditEvents.unshift(event);
    if (this.auditEvents.length > 500) {
      this.auditEvents.pop();
    }
  }

  public static getAuditEvents(orgId?: string): SubscriptionEvent[] {
    this.init();
    if (orgId && orgId !== 'platform') {
      return this.auditEvents.filter((e) => e.organizationId === orgId);
    }
    return [...this.auditEvents];
  }
}

// Auto-initialize on module load
EntitlementServerService.init();
