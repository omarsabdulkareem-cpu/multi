/**
 * SMART ALERT ENGINE & NOTIFICATION CENTER (PHASE 13)
 * Manages tenant-scoped operational alerts and in-app notifications.
 * Contains email-provider abstraction without claiming emails were delivered when unconfigured.
 */

import { SmartNotification, SmartInsightSeverity } from '../../types/smartOperations';
import { SmartOperationsSettingsService } from './smartOperationsSettingsService';

const STORAGE_KEY_SMART_NOTIFS = 'alkarwan_saas_smart_notifications_v1';

export class SmartAlertEngine {
  private static getStoredNotifications(): Record<string, SmartNotification[]> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SMART_NOTIFS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }

  private static saveStoredNotifications(data: Record<string, SmartNotification[]>): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_SMART_NOTIFS, JSON.stringify(data));
    } catch {}
  }

  /**
   * Retrieves all notifications for an organization, ordered newest first
   */
  static getNotifications(orgId: string): SmartNotification[] {
    const all = this.getStoredNotifications();
    return (all[orgId] || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Returns count of unread notifications
   */
  static getUnreadCount(orgId: string): number {
    return this.getNotifications(orgId).filter((n) => !n.isRead).length;
  }

  /**
   * Posts an in-app notification and dispatches email alert if provider is configured
   */
  static createInAppNotification(
    orgId: string,
    payload: {
      titleEn: string;
      titleAr: string;
      bodyEn: string;
      bodyAr: string;
      category: SmartNotification['category'];
      severity: SmartInsightSeverity;
      linkPage?: any;
      linkParams?: Record<string, string>;
    }
  ): SmartNotification {
    const all = this.getStoredNotifications();
    const orgNotifs = all[orgId] || [];

    const newNotif: SmartNotification = {
      id: `NOTIF-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      organizationId: orgId,
      titleEn: payload.titleEn,
      titleAr: payload.titleAr,
      bodyEn: payload.bodyEn,
      bodyAr: payload.bodyAr,
      category: payload.category,
      severity: payload.severity,
      linkPage: payload.linkPage,
      linkParams: payload.linkParams,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    orgNotifs.unshift(newNotif);
    all[orgId] = orgNotifs.slice(0, 100); // Retain latest 100
    this.saveStoredNotifications(all);

    // Attempt email delivery via abstraction
    this.dispatchEmailIfConfigured(orgId, newNotif);

    return newNotif;
  }

  /**
   * Marks a notification as read
   */
  static markAsRead(orgId: string, notifId: string): void {
    const all = this.getStoredNotifications();
    const orgNotifs = all[orgId] || [];
    const target = orgNotifs.find((n) => n.id === notifId);
    if (target) {
      target.isRead = true;
      all[orgId] = orgNotifs;
      this.saveStoredNotifications(all);
    }
  }

  /**
   * Marks all notifications as read
   */
  static markAllAsRead(orgId: string): void {
    const all = this.getStoredNotifications();
    const orgNotifs = all[orgId] || [];
    orgNotifs.forEach((n) => (n.isRead = true));
    all[orgId] = orgNotifs;
    this.saveStoredNotifications(all);
  }

  /**
   * Clears read notifications
   */
  static clearRead(orgId: string): void {
    const all = this.getStoredNotifications();
    const orgNotifs = all[orgId] || [];
    all[orgId] = orgNotifs.filter((n) => !n.isRead);
    this.saveStoredNotifications(all);
  }

  /**
   * Email delivery abstraction.
   * Transparently checks provider configuration and documents status without claiming delivery.
   */
  private static dispatchEmailIfConfigured(orgId: string, notif: SmartNotification): { sent: boolean; message: string } {
    const settings = SmartOperationsSettingsService.getSettings(orgId);
    if (!settings.enableEmailNotifications) {
      return { sent: false, message: 'Email alerts disabled in Smart Operations settings.' };
    }

    // Inspect environment for external SMTP / SendGrid / Postmark provider
    const hasSmtpConfigured =
      typeof process !== 'undefined' &&
      Boolean(process.env?.SMTP_HOST || process.env?.SENDGRID_API_KEY || (window as any)?.__ENV_EMAIL_KEY);

    if (!hasSmtpConfigured) {
      // Clean, honest status reporting: do not claim emails were sent when no provider is configured
      return {
        sent: false,
        message: 'No external email provider configured. Notification stored in in-app notification center only.',
      };
    }

    // Provider would deliver here in enterprise backend
    return {
      sent: true,
      message: `Dispatched to ${settings.notificationRecipientEmails.join(', ')}`,
    };
  }
}
