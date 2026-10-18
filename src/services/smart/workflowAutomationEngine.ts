/**
 * WORKFLOW AUTOMATION ENGINE (PHASE 13)
 * Safe, tenant-scoped rules engine with idempotency protection,
 * loop prevention, and audit traceability.
 * Strictly forbids arbitrary scripts or silent balance mutations.
 */

import {
  WorkflowAutomationRule,
  WorkflowExecutionLog,
  AutomationTrigger,
  AutomationAction,
} from '../../types/smartOperations';
import { WarehouseEngineService } from '../warehouseEngineService';
import { BusinessEngineService } from '../businessEngineService';
import { TenantService } from '../tenantService';
import { SmartAlertEngine } from './smartAlertEngine';
import { ReplenishmentRecommendationEngine } from './replenishmentRecommendationEngine';
import { BatchIntelligenceService } from './batchIntelligenceService';

const STORAGE_KEY_AUTOMATION_RULES = 'alkarwan_saas_automation_rules_v1';
const STORAGE_KEY_AUTOMATION_LOGS = 'alkarwan_saas_automation_logs_v1';

export class WorkflowAutomationEngine {
  private static isExecuting = false; // Recursion & loop prevention lock

  private static getStoredRules(): Record<string, WorkflowAutomationRule[]> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTOMATION_RULES);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  private static saveStoredRules(data: Record<string, WorkflowAutomationRule[]>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_AUTOMATION_RULES, JSON.stringify(data));
    } catch {}
  }

  private static getStoredLogs(): Record<string, WorkflowExecutionLog[]> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_AUTOMATION_LOGS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  private static saveStoredLogs(data: Record<string, WorkflowExecutionLog[]>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_AUTOMATION_LOGS, JSON.stringify(data));
    } catch {}
  }

  /**
   * Retrieves rules for an organization, seeding initial standard rules if none exist
   */
  static getRules(orgId: string): WorkflowAutomationRule[] {
    const all = this.getStoredRules();
    if (all[orgId] && all[orgId].length > 0) {
      return all[orgId];
    }

    // Seed safe default rules for this organization
    const defaults: WorkflowAutomationRule[] = [
      {
        id: `RULE-ROP-${orgId.slice(-4)}`,
        organizationId: orgId,
        nameEn: 'Notify Warehouse Manager when stock falls below Reorder Point',
        nameAr: 'تنبيه مدير المستودع عند انخفاض الرصيد عن نقطة إعادة الطلب',
        descriptionEn: 'Automatically posts an in-app operational alert whenever physical stock breaches configured ROP.',
        descriptionAr: 'إنشاء تنبيه تشغيلي داخلي تلقائياً عند هبوط الرصيد الفعلي دون الحد المحدد.',
        trigger: 'STOCK_BELOW_ROP',
        conditions: { severityMinimum: 'WARNING' },
        action: 'CREATE_ALERT',
        enabled: true,
        cooldownMinutes: 60,
        createdBy: 'System Engine',
        createdAt: new Date().toISOString(),
        executionCount: 0,
        auditInformation: 'Default policy rule created during system bootstrap.',
      },
      {
        id: `RULE-EXP-${orgId.slice(-4)}`,
        organizationId: orgId,
        nameEn: 'Escalate Critical Expiring Batches (< 7 days) to QA',
        nameAr: 'تصعيد الشحنات قريبة الانتهاء (أقل من 7 أيام) لمسؤول الجودة',
        descriptionEn: 'Alerts storage and QC team immediately when any tracked lot is within 7 days of expiry.',
        descriptionAr: 'إشعار فوري لفريق المستودعات والجودة عند اقتراب انتهاء صلاحية أي شحنة خلال أسبوع.',
        trigger: 'EXPIRED_BATCH_DETECTED',
        conditions: { severityMinimum: 'CRITICAL' },
        action: 'CREATE_NOTIFICATION',
        enabled: true,
        cooldownMinutes: 120,
        createdBy: 'System Engine',
        createdAt: new Date().toISOString(),
        executionCount: 0,
        auditInformation: 'Default quality control alert rule.',
      },
      {
        id: `RULE-RECV-${orgId.slice(-4)}`,
        organizationId: orgId,
        nameEn: 'Notify Supervisors of Pending Inbound Receipts',
        nameAr: 'إشعار المشرفين بمسودات الاستلام المعلقة للاعتماد',
        descriptionEn: 'Alerts warehouse supervisors when goods receipt notes require sign-off.',
        descriptionAr: 'تنبيه المشرفين بوجود أذون استلام بحاجة إلى اعتماد وتأكيد الأوزان.',
        trigger: 'RECEIPT_AWAITING_APPROVAL',
        conditions: {},
        action: 'ASSIGN_REVIEW_TASK',
        enabled: true,
        cooldownMinutes: 30,
        createdBy: 'System Engine',
        createdAt: new Date().toISOString(),
        executionCount: 0,
        auditInformation: 'Default document workflow verification rule.',
      },
    ];

    all[orgId] = defaults;
    this.saveStoredRules(all);
    return defaults;
  }

  /**
   * Retrieves execution logs for an organization
   */
  static getExecutionLogs(orgId: string): WorkflowExecutionLog[] {
    const all = this.getStoredLogs();
    return (all[orgId] || []).sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
  }

  /**
   * Adds or updates an automation rule with strict validation
   */
  static saveRule(
    orgId: string,
    rule: Omit<WorkflowAutomationRule, 'id' | 'organizationId' | 'createdAt' | 'executionCount'>,
    performer: { id: string; name: string }
  ): WorkflowAutomationRule {
    const all = this.getStoredRules();
    const orgRules = all[orgId] || [];

    const newId = `RULE-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const saved: WorkflowAutomationRule = {
      ...rule,
      id: newId,
      organizationId: orgId,
      createdAt: new Date().toISOString(),
      executionCount: 0,
      createdBy: performer.name,
      auditInformation: `Created by ${performer.name} at ${new Date().toISOString()}`,
    };

    orgRules.push(saved);
    all[orgId] = orgRules;
    this.saveStoredRules(all);

    TenantService.logAuditEvent(
      orgId,
      'SETTINGS_CHANGED',
      performer,
      `Created automation rule: "${saved.nameEn}"`
    );

    return saved;
  }

  /**
   * Toggles enabled state of an automation rule
   */
  static toggleRule(
    orgId: string,
    ruleId: string,
    enabled: boolean,
    performer: { id: string; name: string }
  ): boolean {
    const all = this.getStoredRules();
    const orgRules = all[orgId] || [];
    const rule = orgRules.find((r) => r.id === ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    rule.auditInformation += ` | ${enabled ? 'Enabled' : 'Disabled'} by ${performer.name} at ${new Date().toISOString()}`;
    all[orgId] = orgRules;
    this.saveStoredRules(all);

    TenantService.logAuditEvent(
      orgId,
      'SETTINGS_CHANGED',
      performer,
      `${enabled ? 'Enabled' : 'Disabled'} automation rule "${rule.nameEn}"`
    );

    return true;
  }

  /**
   * Safe execution evaluator: runs active rules against real tenant state.
   * Employs execution locks to prevent recursion and cooldown timers to prevent duplicate alerts.
   */
  static async evaluateRules(orgId: string): Promise<{ evaluated: number; executed: number; skipped: number }> {
    if (this.isExecuting) {
      return { evaluated: 0, executed: 0, skipped: 0 };
    }

    this.isExecuting = true;
    let executedCount = 0;
    let skippedCount = 0;

    try {
      const rules = this.getRules(orgId).filter((r) => r.enabled);
      const allLogs = this.getStoredLogs();
      const orgLogs = allLogs[orgId] || [];

      for (const rule of rules) {
        // Cooldown check (prevent duplicate execution within configured cooldown window)
        if (rule.lastExecutionAt) {
          const elapsedMinutes = (Date.now() - new Date(rule.lastExecutionAt).getTime()) / 60000;
          if (elapsedMinutes < (rule.cooldownMinutes || 60)) {
            skippedCount++;
            continue;
          }
        }

        let triggerMatched = false;
        let affectedEntityId: string | undefined;
        let matchDetails = '';

        switch (rule.trigger) {
          case 'STOCK_BELOW_ROP': {
            const recommendations = ReplenishmentRecommendationEngine.generateRecommendations(orgId);
            const urgent = recommendations.find((r) => r.suggestedPriority === 'URGENT' || r.suggestedPriority === 'HIGH');
            if (urgent) {
              triggerMatched = true;
              affectedEntityId = urgent.itemId;
              matchDetails = `Item ${urgent.itemCode} is at ${urgent.currentAvailableStock} ${urgent.unit} (Below ROP ${urgent.reorderPoint})`;
            }
            break;
          }

          case 'EXPIRED_BATCH_DETECTED': {
            const { records } = BatchIntelligenceService.getBatchIntelligence(orgId);
            const urgentBatch = records.find((b) => b.status === 'EXPIRED' || b.daysUntilExpiry <= 7);
            if (urgentBatch) {
              triggerMatched = true;
              affectedEntityId = urgentBatch.batchId;
              matchDetails = `Batch ${urgentBatch.batchNumber} has status ${urgentBatch.status} (Expiry: ${urgentBatch.expiryDate})`;
            }
            break;
          }

          case 'RECEIPT_AWAITING_APPROVAL': {
            const receipts = WarehouseEngineService.getReceipts(orgId);
            const draft = receipts.find((r) => r.status === 'DRAFT');
            if (draft) {
              triggerMatched = true;
              affectedEntityId = draft.id;
              matchDetails = `Receipt ${draft.documentNumber} is in draft awaiting sign-off`;
            }
            break;
          }

          default:
            break;
        }

        if (triggerMatched) {
          // Execute Safe Action
          await this.executeSafeAction(orgId, rule, matchDetails, affectedEntityId);

          rule.lastExecutionAt = new Date().toISOString();
          rule.lastExecutionStatus = 'SUCCESS';
          rule.executionCount++;
          executedCount++;

          orgLogs.unshift({
            id: `LOG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
            ruleId: rule.id,
            ruleName: rule.nameEn,
            organizationId: orgId,
            triggeredAt: new Date().toISOString(),
            status: 'SUCCESS',
            reason: matchDetails,
            affectedEntityId,
          });
        }
      }

      // Save updated logs and rule stats
      allLogs[orgId] = orgLogs.slice(0, 100); // Retain latest 100 execution logs
      this.saveStoredLogs(allLogs);

      const allRules = this.getStoredRules();
      allRules[orgId] = rules;
      this.saveStoredRules(allRules);

      return { evaluated: rules.length, executed: executedCount, skipped: skippedCount };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Executes only verified safe actions without bypassing permissions or mutating balances
   */
  private static async executeSafeAction(
    orgId: string,
    rule: WorkflowAutomationRule,
    reason: string,
    affectedEntityId?: string
  ): Promise<void> {
    switch (rule.action) {
      case 'CREATE_NOTIFICATION':
      case 'CREATE_ALERT': {
        SmartAlertEngine.createInAppNotification(orgId, {
          titleEn: `[Auto-Action] ${rule.nameEn}`,
          titleAr: `[إجراء آلي] ${rule.nameAr}`,
          bodyEn: `Automation rule triggered: ${reason}`,
          bodyAr: `تم تفعيل قاعدة الأتمتة: ${reason}`,
          category: 'SYSTEM',
          severity: 'WARNING',
        });
        break;
      }

      case 'ASSIGN_REVIEW_TASK': {
        SmartAlertEngine.createInAppNotification(orgId, {
          titleEn: `[Review Required] ${rule.nameEn}`,
          titleAr: `[مراجعة مطلوبة] ${rule.nameAr}`,
          bodyEn: `Action assigned for supervisor review: ${reason}`,
          bodyAr: `تم إسناد مهمة للمراجعة الإشرافية: ${reason}`,
          category: 'APPROVAL',
          severity: 'INFO',
        });
        break;
      }

      case 'CREATE_DRAFT_PR': {
        // Safe action: draft purchase request creation requires explicit user confirmation via recommendation card
        SmartAlertEngine.createInAppNotification(orgId, {
          titleEn: `[Draft Request Recommended] ${rule.nameEn}`,
          titleAr: `[توصية بمسودة شراء] ${rule.nameAr}`,
          bodyEn: `Recommended draft purchase request ready for confirmation: ${reason}`,
          bodyAr: `توصية بمسودة طلب شراء جاهزة للمراجعة والاعتماد: ${reason}`,
          category: 'STOCK',
          severity: 'WARNING',
        });
        break;
      }

      default:
        break;
    }
  }
}
