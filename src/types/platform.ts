/**
 * PLATFORM OWNER & MASTER SAAS CONTROL CENTER CONTRACTS (PHASE 8)
 * 
 * Strict architectural isolation:
 * PLATFORM (Owner/Admin) -> SUBSCRIPTION PLANS -> ORGANIZATIONS (Tenants) -> USERS -> WAREHOUSES
 * 
 * Ordinary organization users NEVER have platform access.
 */

import { PlanTier } from './saas';

export type PlatformRole =
  | 'PLATFORM_OWNER'
  | 'PLATFORM_ADMIN'
  | 'PLATFORM_SUPPORT'
  | 'PLATFORM_VIEWER';

export type PlatformPermission =
  | 'platform.dashboard.view'
  | 'platform.organizations.view'
  | 'platform.organizations.manage'
  | 'platform.subscriptions.view'
  | 'platform.subscriptions.manage'
  | 'platform.plans.view'
  | 'platform.plans.manage'
  | 'platform.users.view'
  | 'platform.users.manage'
  | 'platform.modules.manage'
  | 'platform.settings.manage'
  | 'platform.audit.view'
  | 'platform.support.view'
  | 'platform.system.view';

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  nameAr?: string;
  role: PlatformRole;
  permissions: PlatformPermission[];
  active: boolean;
  isOwner?: boolean;
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
}

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  PLATFORM_OWNER: [
    'platform.dashboard.view',
    'platform.organizations.view',
    'platform.organizations.manage',
    'platform.subscriptions.view',
    'platform.subscriptions.manage',
    'platform.plans.view',
    'platform.plans.manage',
    'platform.users.view',
    'platform.users.manage',
    'platform.modules.manage',
    'platform.settings.manage',
    'platform.audit.view',
    'platform.support.view',
    'platform.system.view',
  ],
  PLATFORM_ADMIN: [
    'platform.dashboard.view',
    'platform.organizations.view',
    'platform.organizations.manage',
    'platform.subscriptions.view',
    'platform.subscriptions.manage',
    'platform.plans.view',
    'platform.plans.manage',
    'platform.users.view',
    'platform.modules.manage',
    'platform.settings.manage',
    'platform.audit.view',
    'platform.system.view',
  ],
  PLATFORM_SUPPORT: [
    'platform.dashboard.view',
    'platform.organizations.view',
    'platform.subscriptions.view',
    'platform.plans.view',
    'platform.audit.view',
    'platform.support.view',
    'platform.system.view',
  ],
  PLATFORM_VIEWER: [
    'platform.dashboard.view',
    'platform.organizations.view',
    'platform.subscriptions.view',
    'platform.plans.view',
    'platform.audit.view',
    'platform.system.view',
  ],
};

export type GlobalModuleStatus = 'GA' | 'BETA' | 'EARLY_ACCESS' | 'DISABLED';

export interface GlobalModuleDefinition {
  key: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: 'CORE' | 'OPERATIONS' | 'INDUSTRIAL' | 'INTELLIGENCE' | 'ENTERPRISE';
  status: GlobalModuleStatus;
  minPlanTier: PlanTier;
  isAddon: boolean;
  addonMonthlyPrice?: number;
}

export type PlatformAuditAction =
  | 'PLAN_CREATED'
  | 'PLAN_UPDATED'
  | 'PLAN_VERSIONED'
  | 'ORG_CREATED'
  | 'ORG_STATUS_CHANGED'
  | 'ORG_PLAN_CHANGED'
  | 'TRIAL_EXTENDED'
  | 'SUBSCRIPTION_OVERRIDDEN'
  | 'SUPPORT_IMPERSONATION_STARTED'
  | 'SUPPORT_IMPERSONATION_ENDED'
  | 'MODULE_STATUS_CHANGED'
  | 'PLATFORM_SETTING_UPDATED'
  | 'SECURITY_OVERRIDE';

export interface PlatformAuditRecord {
  id: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  adminRole: PlatformRole;
  action: PlatformAuditAction;
  targetOrgId?: string;
  targetOrgName?: string;
  targetEntityId?: string;
  details: string;
  diff?: {
    before: any;
    after: any;
  };
  ipAddress?: string;
  userAgent?: string;
}

export interface PlatformSettings {
  platformName: string;
  platformNameAr: string;
  supportEmail: string;
  defaultTrialDays: number;
  gracePeriodDays: number;
  allowPublicSignup: boolean;
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  defaultCurrency: string;
  allowedCurrencies: string[];
  stripeLiveMode: boolean;
  webhookSecretConfigured: boolean;
  systemVersion: string;
  lastUpdated: string;
}

export interface SystemHealthMetrics {
  databaseStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  firestoreLatencyMs: number;
  activeTenantsCount: number;
  activeUsersEstimate: number;
  totalWarehousesCount: number;
  totalItemsCount: number;
  totalTransactionsToday: number;
  totalTransactionsMonth: number;
  memoryStatus: 'OPTIMAL' | 'NORMAL' | 'WARNING';
  indexedDbStatus: 'AVAILABLE' | 'UNAVAILABLE';
  lastHealthCheck: string;
  environment: string;
}

export interface SupportImpersonationSession {
  active: boolean;
  originalAdminId: string;
  originalAdminName: string;
  originalAdminRole: PlatformRole;
  targetOrgId: string;
  targetOrgName: string;
  startedAt: string;
  mode: 'SUPPORT_AUDITED' | 'READ_ONLY';
}
