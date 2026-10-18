/**
 * AL-KARWAN Role-Based Access Control (RBAC) & Permissions Service
 * شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
 *
 * Implements strict role-based page and action authorization for:
 * - Admin
 * - Storage Manager
 * - Storage Worker
 * - Production
 * - Shredding / الثرم
 * - Management
 */

import { NavigationPage, UserRole } from '../types';

export interface RoleDefinition {
  key: UserRole;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  badgeColor: string;
  allowedPages: NavigationPage[];
  canManageUsers: boolean;
  canManageSystemCodes: boolean;
  canManageMaterials: boolean;
  canManageLocations: boolean;
  canReceiveMaterials: boolean;
  canIssueMaterials: boolean;
  canTransferMaterials: boolean;
  canExecuteShredding: boolean;
  canExecuteProduction: boolean;
  canViewReports: boolean;
  canViewAuditLogs: boolean;
  canViewSmartInsights?: boolean;
  canManageAlertRules?: boolean;
  canManageAutomations?: boolean;
  canViewAnomalyAlerts?: boolean;
  canAccessForecasts?: boolean;
  canUseWarehouseAssistant?: boolean;
  canApproveAutomationActions?: boolean;
  canManageIntegrations?: boolean;
}

export const AL_KARWAN_ROLES: Record<string, RoleDefinition> = {
  Admin: {
    key: 'Admin',
    labelAr: 'مدير النظام (Admin)',
    labelEn: 'System Administrator (Admin)',
    descriptionAr: 'كامل الصلاحيات لإدارة المستخدمين، الأذونات، الأكواد، الخامات، والمواقع',
    descriptionEn: 'Full clearance: users, permissions, system codes, master data, and configuration',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    allowedPages: [
      'dashboard',
      'daily_operations',
      'shift_handover',
      'operations',
      'warehouse_operations',
      'receiving',
      'unloading',
      'scale_out',
      'shredding',
      'storage',
      'production',
      'inventory',
      'bulk_bags',
      'rfid_tracking',
      'movement_ledger',
      'pending_actions',
      'approvals',
      'material_card',
      'materials_master',
      'suppliers',
      'warehouses',
      'reports',
      'excel_import',
      'historical_migration',
      'inventory_reconciler',
      'audit_log',
      'maintenance',
      'maintenance_alerts',
      'forecasting',
      'shift_optimizer',
      'quality_control',
      'virtual_stock_verifier',
      'energy_monitor',
      'system_admin',
      'organization_settings',
      'platform_admin',
      'company_onboarding',
      'business_management',
      'purchasing',
      'customers',
      'internal_requests',
      'billing',
      'advanced_warehouse',
      'smart_intelligence',
      'integrations',
      'webhooks',
    ],
    canManageUsers: true,
    canManageSystemCodes: true,
    canManageMaterials: true,
    canManageLocations: true,
    canReceiveMaterials: true,
    canIssueMaterials: true,
    canTransferMaterials: true,
    canExecuteShredding: true,
    canExecuteProduction: true,
    canViewReports: true,
    canViewAuditLogs: true,
    canViewSmartInsights: true,
    canManageAlertRules: true,
    canManageAutomations: true,
    canViewAnomalyAlerts: true,
    canAccessForecasts: true,
    canUseWarehouseAssistant: true,
    canApproveAutomationActions: true,
    canManageIntegrations: true,
  },
  'Storage Manager': {
    key: 'Storage Manager',
    labelAr: 'مدير المستودعات (Storage Manager)',
    labelEn: 'Storage & Warehouse Manager',
    descriptionAr: 'إدارة حركة الخامات، الاستلام، الصرف، التحويل، الأرصدة، والتقارير المخزنية',
    descriptionEn: 'Material intake, issues, transfers, batch tracking, inventory, and reports',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    allowedPages: [
      'dashboard',
      'daily_operations',
      'operations',
      'warehouse_operations',
      'receiving',
      'unloading',
      'scale_out',
      'storage',
      'inventory',
      'bulk_bags',
      'rfid_tracking',
      'movement_ledger',
      'pending_actions',
      'approvals',
      'material_card',
      'materials_master',
      'suppliers',
      'warehouses',
      'reports',
      'excel_import',
      'inventory_reconciler',
      'virtual_stock_verifier',
      'forecasting',
      'business_management',
      'purchasing',
      'customers',
      'internal_requests',
      'advanced_warehouse',
      'smart_intelligence',
    ],
    canManageUsers: false,
    canManageSystemCodes: false,
    canManageMaterials: true,
    canManageLocations: true,
    canReceiveMaterials: true,
    canIssueMaterials: true,
    canTransferMaterials: true,
    canExecuteShredding: false,
    canExecuteProduction: false,
    canViewReports: true,
    canViewAuditLogs: false,
    canViewSmartInsights: true,
    canManageAlertRules: true,
    canManageAutomations: false,
    canViewAnomalyAlerts: true,
    canAccessForecasts: true,
    canUseWarehouseAssistant: true,
    canApproveAutomationActions: true,
  },
  'Storage Worker': {
    key: 'Storage Worker',
    labelAr: 'عامل مستودع وميزان (Storage Worker)',
    labelEn: 'Storage & Scale Worker',
    descriptionAr: 'تنفيذ أوزان القبان، تفريغ الشاحنات، حركة الشلايف، والتحويلات الميدانية',
    descriptionEn: 'Weighbridge operations, truck unloading, bulk bag moves, and warehouse transfers',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    allowedPages: [
      'dashboard',
      'receiving',
      'unloading',
      'scale_out',
      'storage',
      'bulk_bags',
      'rfid_tracking',
      'movement_ledger',
      'virtual_stock_verifier',
    ],
    canManageUsers: false,
    canManageSystemCodes: false,
    canManageMaterials: false,
    canManageLocations: false,
    canReceiveMaterials: true,
    canIssueMaterials: false,
    canTransferMaterials: true,
    canExecuteShredding: false,
    canExecuteProduction: false,
    canViewReports: false,
    canViewAuditLogs: false,
  },
  Production: {
    key: 'Production',
    labelAr: 'الإنتاج والتشغيل (Production)',
    labelEn: 'Production & Extrusion Dept',
    descriptionAr: 'إدارة خطوط البثق، أوامر التشغيل، استلام الخامات، وتسجيل تالف الإنتاج',
    descriptionEn: 'Extrusion & forming lines, production orders, material intake, and production scrap',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    allowedPages: [
      'dashboard',
      'production',
      'shift_handover',
      'shift_optimizer',
      'quality_control',
      'movement_ledger',
      'bulk_bags',
      'reports',
    ],
    canManageUsers: false,
    canManageSystemCodes: false,
    canManageMaterials: false,
    canManageLocations: false,
    canReceiveMaterials: false,
    canIssueMaterials: false,
    canTransferMaterials: true,
    canExecuteShredding: false,
    canExecuteProduction: true,
    canViewReports: true,
    canViewAuditLogs: false,
  },
  Shredding: {
    key: 'Shredding',
    labelAr: 'مسؤول الثرم والجرش (Shredding)',
    labelEn: 'Shredding & Regrind Dept',
    descriptionAr: 'استلام وإرسال المواد للثرم، تتبع بيت الرولات، الناتج، وتوثيق طوز الثرم',
    descriptionEn: 'Therm shredder intake, roll storage, regrind output, and dust tracking',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    allowedPages: [
      'dashboard',
      'shredding',
      'storage',
      'bulk_bags',
      'energy_monitor',
      'movement_ledger',
      'reports',
    ],
    canManageUsers: false,
    canManageSystemCodes: false,
    canManageMaterials: false,
    canManageLocations: false,
    canReceiveMaterials: false,
    canIssueMaterials: false,
    canTransferMaterials: true,
    canExecuteShredding: true,
    canExecuteProduction: false,
    canViewReports: true,
    canViewAuditLogs: false,
  },
  Management: {
    key: 'Management',
    labelAr: 'الإدارة العامة والمتابعة (Management)',
    labelEn: 'General Management & Oversight',
    descriptionAr: 'الرقابة الشاملة، التقارير التنفيذية، سجلات التدقيق، والاعتمادات المالية والمخزنية',
    descriptionEn: 'Executive control, compliance audit trails, approvals, and financial reports',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    allowedPages: [
      'dashboard',
      'daily_operations',
      'operations',
      'warehouse_operations',
      'reports',
      'audit_log',
      'approvals',
      'material_card',
      'materials_master',
      'suppliers',
      'warehouses',
      'movement_ledger',
      'inventory',
      'forecasting',
      'business_management',
      'purchasing',
      'customers',
      'internal_requests',
      'billing',
      'advanced_warehouse',
      'smart_intelligence',
    ],
    canManageUsers: false,
    canManageSystemCodes: false,
    canManageMaterials: false,
    canManageLocations: false,
    canReceiveMaterials: false,
    canIssueMaterials: false,
    canTransferMaterials: false,
    canExecuteShredding: false,
    canExecuteProduction: false,
    canViewReports: true,
    canViewAuditLogs: true,
    canViewSmartInsights: true,
    canManageAlertRules: false,
    canManageAutomations: false,
    canViewAnomalyAlerts: true,
    canAccessForecasts: true,
    canUseWarehouseAssistant: true,
    canApproveAutomationActions: true,
  },
};

/**
 * Maps any legacy role alias to the standard canonical role definition
 */
export function normalizeUserRole(role?: UserRole | string): string {
  if (!role) return 'Storage Worker';
  const clean = String(role).trim();

  if (clean === 'Admin' || clean === 'SUPER_ADMIN' || clean === 'Administrator') {
    return 'Admin';
  }
  if (clean === 'Storage Manager' || clean === 'Warehouse Manager' || clean === 'Supervisor' || clean === 'General Supervisor') {
    return 'Storage Manager';
  }
  if (clean === 'Storage Worker' || clean === 'Storekeeper' || clean === 'Warehouse Operator' || clean === 'Scale Operator') {
    return 'Storage Worker';
  }
  if (clean === 'Production' || clean === 'Production Operator') {
    return 'Production';
  }
  if (clean === 'Shredding' || clean === 'Shredding Operator') {
    return 'Shredding';
  }
  if (clean === 'Management' || clean === 'Viewer') {
    return 'Management';
  }

  return 'Storage Worker';
}

/**
 * Checks whether a given role can access a specific application page
 */
export function canUserAccessPage(role: UserRole | string, page: NavigationPage): boolean {
  const normalized = normalizeUserRole(role);
  const def = AL_KARWAN_ROLES[normalized] || AL_KARWAN_ROLES['Admin'];
  return def.allowedPages.includes(page);
}

/**
 * Returns the full permission descriptor for a user's role
 */
export function getUserPermissions(role: UserRole | string): RoleDefinition {
  const normalized = normalizeUserRole(role);
  return AL_KARWAN_ROLES[normalized] || AL_KARWAN_ROLES['Admin'];
}

/**
 * Formatted role label with language support
 */
export function formatRoleName(role: UserRole | string, isRTL: boolean): string {
  const normalized = normalizeUserRole(role);
  const def = AL_KARWAN_ROLES[normalized];
  if (!def) return role;
  return isRTL ? def.labelAr : def.labelEn;
}

export function canUserViewSmartInsights(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canViewSmartInsights);
}

export function canUserManageAutomations(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canManageAutomations);
}

export function canUserManageAlertRules(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canManageAlertRules);
}

export function canUserViewAnomalyAlerts(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canViewAnomalyAlerts);
}

export function canUserAccessForecasts(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canAccessForecasts);
}

export function canUserUseWarehouseAssistant(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canUseWarehouseAssistant);
}

export function canUserApproveAutomationActions(role: UserRole | string): boolean {
  const perm = getUserPermissions(role);
  return Boolean(perm.canApproveAutomationActions);
}

