import React, { useState } from 'react';
import {
  Bell,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Building2,
  Trash2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { CommercialReadinessService, SystemNotification } from '../services/commercialReadinessService';
import { NavigationPage } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { setCurrentPage } = useFactory();

  const [notifications, setNotifications] = useState<SystemNotification[]>(() =>
    CommercialReadinessService.getOrganizationNotifications(currentOrganization.id)
  );

  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');

  if (!isOpen) return null;

  const filtered = notifications.filter(
    (n) => filterSeverity === 'ALL' || n.severity === filterSeverity
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleActionClick = (pageUrl?: string) => {
    if (pageUrl) {
      setCurrentPage(pageUrl as NavigationPage);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-[#0f121a] border border-white/15 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-white font-sans">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 to-cyan-950/40 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">
                  {isRTL ? 'مركز الإشعارات والتنبيهات' : 'Organization Notification Center'}
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                    {unreadCount} {isRTL ? 'جديد' : 'new'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? `منشأة ${currentOrganization.nameAr} • تنبيهات فورية مشفرة`
                  : `Tenant ${currentOrganization.nameEn} • Org-Scoped Live Alerts`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer"
              >
                {isRTL ? 'تحديد الكل كمقروء' : 'Mark all read'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex p-2 bg-[#0c0e14] border-b border-white/10 gap-1 text-xs">
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                filterSeverity === sev
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {sev === 'ALL'
                ? isRTL
                  ? 'الكل'
                  : 'All'
                : sev === 'CRITICAL'
                ? isRTL
                  ? 'حرجة'
                  : 'Critical'
                : sev === 'WARNING'
                ? isRTL
                  ? 'تحذير'
                  : 'Warning'
                : isRTL
                ? 'معلومات'
                : 'Info'}
            </button>
          ))}
        </div>

        {/* Notification Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500/50" />
              <p className="text-sm font-semibold">{isRTL ? 'لا توجد تنبيهات حالية' : 'All clear. No notifications.'}</p>
            </div>
          ) : (
            filtered.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition-all text-xs ${
                  notif.severity === 'CRITICAL'
                    ? 'bg-rose-500/5 border-rose-500/30'
                    : notif.severity === 'WARNING'
                    ? 'bg-amber-500/5 border-amber-500/30'
                    : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {notif.severity === 'CRITICAL' ? (
                      <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    ) : notif.severity === 'WARNING' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-bold text-white text-sm">
                        {isRTL ? notif.titleAr : notif.titleEn}
                      </h4>
                      <p className="text-slate-300 mt-1 leading-relaxed">
                        {isRTL ? notif.messageAr : notif.messageEn}
                      </p>
                    </div>
                  </div>

                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1" />
                  )}
                </div>

                {notif.actionUrl && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                    <button
                      onClick={() => handleActionClick(notif.actionUrl)}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>{isRTL ? notif.actionLabelAr || 'عرض التفاصيل' : notif.actionLabelEn || 'View Action'}</span>
                      <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
