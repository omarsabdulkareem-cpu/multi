/**
 * GENERAL-PURPOSE MULTI-TENANT WAREHOUSE MANAGEMENT PLATFORM
 * Authoritative Tenant Context & Multi-Tenant State Provider
 * 
 * Provides organization-level isolation, company branding, enabled modules,
 * employee invitations, RBAC roles, audit logs, and organization lifecycle.
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  TenantRole,
  TenantPermission,
  OrganizationAuditRecord,
  OrganizationModulesConfig,
} from '../types/tenant';
import { TenantService } from '../services/tenantService';
import { SaasService } from '../services/saasService';
import { EntitlementEvaluation, SubscriptionGuardResult } from '../types/saas';

interface TenantContextType {
  currentOrganization: Organization;
  organizations: Organization[];
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
  roles: TenantRole[];
  auditLogs: OrganizationAuditRecord[];
  isMultiTenant: boolean;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  subscriptionGuard: SubscriptionGuardResult;
  isReadOnlyMode: boolean;
  canCreateUser: () => EntitlementEvaluation;
  canCreateWarehouse: () => EntitlementEvaluation;
  switchOrganization: (orgId: string) => void;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<Organization>;
  createOrganization: (
    newOrgData: {
      name: string;
      nameAr?: string;
      nameEn?: string;
      legalName?: string;
      country: string;
      city?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      currency: string;
      timezone: string;
      defaultLanguage: 'ar' | 'en';
      weightUnit: 'KG' | 'LBS' | 'MT';
      logo?: string;
      optionalModules?: any;
      inventoryPreferences?: any;
    },
    creatorUser?: { id: string; name: string; email: string }
  ) => Promise<Organization>;
  archiveOrganization: (orgId: string) => Promise<Organization>;
  inviteEmployee: (data: { name: string; email: string; roleId: string }) => Promise<OrganizationInvitation>;
  acceptInvitation: (token: string, user: { id: string; name: string; email: string }) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  setMemberStatus: (memberId: string, status: 'ACTIVE' | 'SUSPENDED') => Promise<OrganizationMember>;
  updateMemberRole: (memberId: string, roleId: string) => Promise<OrganizationMember>;
  removeMember: (memberId: string) => Promise<void>;
  createCustomRole: (data: {
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    permissions: TenantPermission[];
  }) => Promise<TenantRole>;
  checkPermission: (permission: TenantPermission) => boolean;
  isModuleEnabled: (moduleKey: keyof OrganizationModulesConfig) => boolean;
  getTenantStorageCode: () => string;
  getTenantProductionCode: () => string;
  refreshTenantData: () => void;
}

const STORAGE_KEY_TENANT = 'alkarwan_saas_active_tenant_id';

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load organizations
  const [organizations, setOrganizations] = useState<Organization[]>(() =>
    TenantService.getOrganizations()
  );

  // Active Organization ID
  const [currentOrgId, setCurrentOrgId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'org_alkarwan';
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TENANT);
      if (stored) return stored;
    } catch {}
    return 'org_alkarwan';
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Members, Invitations, Roles, Audit Logs for active organization
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<OrganizationAuditRecord[]>([]);

  // Refresh helper
  const refreshTenantData = useCallback(() => {
    const allOrgs = TenantService.getOrganizations();
    setOrganizations(allOrgs);

    const activeId = currentOrgId || allOrgs[0]?.id || 'org_alkarwan';
    setMembers(TenantService.getMembers(activeId));
    setInvitations(TenantService.getInvitations(activeId));
    setRoles(TenantService.getRoles(activeId));
    setAuditLogs(TenantService.getAuditLogs(activeId));
  }, [currentOrgId]);

  useEffect(() => {
    refreshTenantData();
  }, [currentOrgId, refreshTenantData]);

  // Persist active tenant ID
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TENANT, currentOrgId);
    } catch (e) {
      console.warn('[TenantContext] Error saving active tenant to storage:', e);
    }
  }, [currentOrgId]);

  const currentOrganization = useMemo(() => {
    return (
      organizations.find((o) => o.id === currentOrgId || o.organizationId === currentOrgId) ||
      organizations[0] || {
        id: 'org_alkarwan',
        organizationId: 'org_alkarwan',
        slug: 'alkarwan',
        name: 'شركة الكروان لإنتاج الألواح والأكواب البلاستيكية',
        nameAr: 'شركة الكروان لإنتاج الألواح والأكواب البلاستيكية',
        nameEn: 'AL-KARWAN Plastics & Packaging Industries',
        status: 'ACTIVE' as const,
        plan: 'ENTERPRISE' as const,
        industry: 'Plastics & Polymers' as const,
        country: 'Iraq',
        currency: 'IQD',
        timezone: 'Asia/Baghdad',
        defaultLanguage: 'ar' as const,
        weightUnit: 'KG' as const,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }, [organizations, currentOrgId]);

  const switchOrganization = (orgId: string) => {
    const found = organizations.find((o) => o.id === orgId || o.organizationId === orgId);
    if (found) {
      setCurrentOrgId(found.id);
    }
  };

  const updateOrganization = async (orgId: string, updates: Partial<Organization>) => {
    const updated = await TenantService.updateOrganization(orgId, updates, {
      id: 'usr_current',
      name: 'System User',
    });
    refreshTenantData();
    return updated;
  };

  const createOrganization = async (
    newOrgData: any,
    creatorUser?: { id: string; name: string; email: string }
  ) => {
    const user = creatorUser || {
      id: 'usr_owner_' + Date.now().toString().slice(-4),
      name: 'Organization Creator',
      email: newOrgData.email || 'owner@company.com',
    };
    const created = await TenantService.createOrganization(newOrgData, user);
    setCurrentOrgId(created.id);
    refreshTenantData();
    return created;
  };

  const archiveOrganization = async (orgId: string) => {
    const archived = await TenantService.setOrganizationStatus(orgId, 'ARCHIVED', {
      id: 'usr_current',
      name: 'System User',
    });
    refreshTenantData();
    return archived;
  };

  const inviteEmployee = async (data: { name: string; email: string; roleId: string }) => {
    // 1. Subscription Guard check
    const guard = SaasService.checkSubscriptionGuard(currentOrganization.id);
    if (guard.isReadOnly) {
      throw new Error(guard.messageEn || 'Organization is in safe read-only mode. Please renew subscription.');
    }

    // 2. Entitlement user limit check
    const userLimit = SaasService.canCreateUser(currentOrganization.id);
    if (!userLimit.allowed) {
      throw new Error(userLimit.reason || 'You have reached the maximum number of users included in your plan.');
    }

    const inv = await TenantService.inviteEmployee(currentOrganization.id, data, {
      id: 'usr_current',
      name: 'Organization Admin',
    });
    refreshTenantData();
    return inv;
  };

  const acceptInvitation = async (token: string, user: { id: string; name: string; email: string }) => {
    await TenantService.acceptInvitation(token, user);
    refreshTenantData();
  };

  const cancelInvitation = async (invitationId: string) => {
    await TenantService.cancelInvitation(currentOrganization.id, invitationId, {
      id: 'usr_current',
      name: 'Organization Admin',
    });
    refreshTenantData();
  };

  const setMemberStatus = async (memberId: string, status: 'ACTIVE' | 'SUSPENDED') => {
    const mem = await TenantService.setMemberStatus(currentOrganization.id, memberId, status, {
      id: 'usr_current',
      name: 'Organization Admin',
    });
    refreshTenantData();
    return mem;
  };

  const updateMemberRole = async (memberId: string, roleId: string) => {
    const mem = await TenantService.updateMemberRole(currentOrganization.id, memberId, roleId, {
      id: 'usr_current',
      name: 'Organization Admin',
    });
    refreshTenantData();
    return mem;
  };

  const removeMember = async (memberId: string) => {
    await TenantService.removeMember(currentOrganization.id, memberId, {
      id: 'usr_current',
      name: 'Organization Admin',
    });
    refreshTenantData();
  };

  const createCustomRole = async (data: {
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    permissions: TenantPermission[];
  }) => {
    const role = await TenantService.createCustomRole(currentOrganization.id, data, {
      id: 'usr_current',
      name: 'Organization Admin',
    });
    refreshTenantData();
    return role;
  };

  const checkPermission = (permission: TenantPermission): boolean => {
    const res = TenantService.checkUserAccess(currentOrganization.id, 'usr_admin', permission);
    return res.allowed;
  };

  const isModuleEnabled = (moduleKey: keyof OrganizationModulesConfig): boolean => {
    if (!currentOrganization.enabledModules) return true;
    return currentOrganization.enabledModules[moduleKey] !== false;
  };

  const getTenantStorageCode = (): string => {
    return currentOrganization.codeConfig?.storageCode || '167';
  };

  const getTenantProductionCode = (): string => {
    return currentOrganization.codeConfig?.productionCode || '546';
  };

  const subscriptionGuard = useMemo(
    () => SaasService.checkSubscriptionGuard(currentOrganization.id),
    [currentOrganization.id]
  );

  const isReadOnlyMode = subscriptionGuard.isReadOnly;

  const canCreateUser = useCallback(
    () => SaasService.canCreateUser(currentOrganization.id),
    [currentOrganization.id]
  );

  const canCreateWarehouse = useCallback(
    () => SaasService.canCreateWarehouse(currentOrganization.id),
    [currentOrganization.id]
  );

  const value = {
    currentOrganization,
    organizations,
    members,
    invitations,
    roles,
    auditLogs,
    isMultiTenant: true,
    isOnboardingOpen,
    setIsOnboardingOpen,
    subscriptionGuard,
    isReadOnlyMode,
    canCreateUser,
    canCreateWarehouse,
    switchOrganization,
    updateOrganization,
    createOrganization,
    archiveOrganization,
    inviteEmployee,
    acceptInvitation,
    cancelInvitation,
    setMemberStatus,
    updateMemberRole,
    removeMember,
    createCustomRole,
    checkPermission,
    isModuleEnabled,
    getTenantStorageCode,
    getTenantProductionCode,
    refreshTenantData,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
