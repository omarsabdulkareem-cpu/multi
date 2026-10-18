/**
 * SMART OPERATIONS SETTINGS SERVICE (PHASE 13)
 * Manages organization-scoped intelligence, threshold, automation, and alerting preferences.
 */

import { SmartOperationsSettings } from '../../types/smartOperations';
import { TenantService } from '../tenantService';

const STORAGE_KEY_SMART_SETTINGS = 'alkarwan_saas_smart_settings_v1';

export const DEFAULT_SMART_SETTINGS: Omit<SmartOperationsSettings, 'organizationId'> = {
  lowStockThresholdPercent: 20,
  criticalStockThresholdPercent: 10,
  safetyStockMultiplier: 1.5,
  enableAutoDraftReorder: false,
  slowMovingDaysPeriod: 60,
  excessStockDaysThreshold: 90,
  expiryWarningDays: 30,
  criticalExpiryDays: 7,
  enforceFefoPicking: true,
  anomalyMaxAdjustmentsPerWeek: 3,
  anomalyLargeIssueMultiplier: 3.0,
  anomalyVarianceThresholdKG: 50,
  enabledAutomationTriggers: [
    'STOCK_BELOW_ROP',
    'RECEIPT_AWAITING_APPROVAL',
    'EXPIRED_BATCH_DETECTED',
    'UNUSUAL_ADJUSTMENT_POSTED',
  ],
  notificationRecipientEmails: ['warehouse.lead@alkarwan-factory.com'],
  enableInAppNotifications: true,
  enableEmailNotifications: false, // Email provider requires explicit configuration
  forecastHorizonDays: 30,
  minimumObservationsForForecast: 5,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default',
};

class SmartOperationsSettingsServiceImpl {
  private memoryCache: Record<string, SmartOperationsSettings> = {};

  private getAllSettings(): Record<string, SmartOperationsSettings> {
    if (typeof window === 'undefined') {
      return this.memoryCache;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SMART_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[SmartSettings] Read error:', e);
    }
    return {};
  }

  private saveAllSettings(data: Record<string, SmartOperationsSettings>): void {
    if (typeof window === 'undefined') {
      this.memoryCache = data;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY_SMART_SETTINGS, JSON.stringify(data));
    } catch (e) {
      console.warn('[SmartSettings] Write error:', e);
    }
  }

  getSettings(orgId: string): SmartOperationsSettings {
    const all = this.getAllSettings();
    if (all[orgId]) {
      return all[orgId];
    }

    // Default configuration specifically scoped to this organization
    const defaults: SmartOperationsSettings = {
      ...DEFAULT_SMART_SETTINGS,
      organizationId: orgId,
      updatedAt: new Date().toISOString(),
      updatedBy: 'System Init',
    };
    return defaults;
  }

  saveSettings(
    orgId: string,
    updates: Partial<SmartOperationsSettings>,
    performer: { id: string; name: string }
  ): SmartOperationsSettings {
    const current = this.getSettings(orgId);
    const updated: SmartOperationsSettings = {
      ...current,
      ...updates,
      organizationId: orgId,
      updatedAt: new Date().toISOString(),
      updatedBy: performer.name,
    };

    const all = this.getAllSettings();
    all[orgId] = updated;
    this.saveAllSettings(all);

    // Audit configuration changes
    TenantService.logAuditEvent(
      orgId,
      'SETTINGS_CHANGED',
      performer,
      `Updated Smart Warehouse Operations Settings: ${Object.keys(updates).join(', ')}`
    );

    return updated;
  }
}

export const SmartOperationsSettingsService = new SmartOperationsSettingsServiceImpl();
