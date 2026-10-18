import React, { useState } from 'react';
import {
  Factory,
  Search,
  Globe,
  Bell,
  UserCheck,
  Shield,
  ShieldCheck,
  Activity,
  Clock,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Menu,
  LogOut,
  CheckCircle2,
  Key,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { UserRole } from '../types';
import { WarehouseWorkerModeModal } from './WarehouseWorkerModeModal';
import { NotificationCenterModal } from './NotificationCenterModal';
import { CommercialReadinessService } from '../services/commercialReadinessService';
import { HardHat } from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onToggleSidebar?: () => void;
  onOpenPublicPortal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onToggleSidebar,
  onOpenPublicPortal,
}) => {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { currentOrganization, organizations, switchOrganization, setIsOnboardingOpen } = useTenant();
  const {
    currentUser,
    setCurrentUser,
    users,
    pendingActions,
    setCurrentPage,
    resetFactoryData,
    logout,
    firebaseUser,
    isAuthenticated,
    firestoreConnected,
    isOnline,
    isOfflinePersistenceActive,
    syncStatus,
    activeStorageCode,
    activeProductionCode,
    activeShreddingReceiptCode,
    activeShreddingMoveCode,
  } = useFactory();

  const [showUserModal, setShowUserModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showWorkerMode, setShowWorkerMode] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Retrieve unread notifications count for badge
  const unreadNotifCount = React.useMemo(() => {
    return CommercialReadinessService.getOrganizationNotifications(currentOrganization.id).filter(
      (n) => !n.read
    ).length;
  }, [currentOrganization.id]);

  // Live time simulation
  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  });

  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(language === 'ar' ? 'ar-IQ' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [language]);

  const criticalPendingCount = pendingActions.filter((a) => a.priority === 'CRITICAL' || a.priority === 'HIGH').length;

  return (
    <header className="sticky top-0 z-40 bg-[#0f1115] border-b border-white/10 shadow-xl">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand & Factory Identity */}
        <div className="flex items-center gap-3.5">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="القائمة / Menu"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5 text-cyan-400" />
            </button>
          )}

          {currentOrganization.logo ? (
            <img
              src={currentOrganization.logo}
              alt="Logo"
              className="w-10 h-10 rounded-xl object-contain bg-white/5 border border-white/10 shrink-0"
              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
            />
          ) : (
            <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-500/50 rounded-xl flex items-center justify-center shrink-0">
              <div className="w-6 h-6 border-2 border-cyan-400 rotate-45 flex items-center justify-center">
                <div className="w-2 h-2 bg-cyan-400" />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>{isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}</span>
              </h1>
              {organizations.length > 1 && (
                <div className="relative inline-block">
                  <select
                    value={currentOrganization.id}
                    onChange={(e) => switchOrganization(e.target.value)}
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 outline-none hover:bg-cyan-500/20 cursor-pointer"
                    title={isRTL ? 'تبديل المنشأة / المؤسسة' : 'Switch Organization Tenant'}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id} className="bg-slate-900 text-white">
                        {isRTL ? org.nameAr : org.nameEn} ({org.plan})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer transition-colors shadow-sm"
                title={isRTL ? 'إنشاء منشأة جديدة' : 'Create New Organization'}
              >
                + {isRTL ? 'شركة جديدة' : 'New Org'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider -mt-0.5">
              {isRTL
                ? `${currentOrganization.industry} • منصة إدارة المستودعات المركزية (SaaS)`
                : `${currentOrganization.industry} • Multi-Tenant Warehouse Management Platform`}
            </p>
          </div>
        </div>

        {/* Center Live Telemetry & Shift Banner (Desktop) */}
        <div className="hidden lg:flex items-center gap-5 px-4 py-1.5 rounded-lg bg-[#111218] border border-white/5">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-cyan-400 font-semibold">{currentTime}</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-xs">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400">{isRTL ? 'المشرف العام للتحكم:' : 'General Supervisor:'}</span>
            <span className="text-cyan-300 font-bold">{isRTL ? 'عمر عبدالكريم' : 'Omar Abdulkarim'}</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-xs">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-slate-400">{isRTL ? 'الوردية:' : 'Shift:'}</span>
            <span className="text-amber-300 font-semibold">{isRTL ? 'صباحية (06:00 - 14:00)' : 'Morning (06:00 - 14:00)'}</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2 text-xs">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">{isRTL ? 'الدفاتر:' : 'Docs:'}</span>
            <span className="font-mono text-emerald-300 font-bold">
              {activeProductionCode} / {activeStorageCode} / {activeShreddingReceiptCode} / {activeShreddingMoveCode}
            </span>
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center gap-3">
          {/* Station & Clock Mobile/Desktop Info */}
          <div className="hidden sm:flex flex-col items-end text-end">
            <span className="text-xs font-mono text-cyan-400">{currentTime}</span>
            <span className="text-[10px] uppercase text-slate-500 tracking-wider">Station: WH-MAIN-01</span>
          </div>

          {/* Offline Persistence (IndexedDB) & Network State Badge */}
          <div className="flex items-center">
            {!isOnline ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-semibold animate-pulse shadow-sm shadow-amber-500/10"
                title={
                  isRTL
                    ? 'انقطاع الشبكة: نظام التخزين المحلي (IndexedDB) نشط، تسجل العمليات محلياً وستزامن تلقائياً'
                    : 'Network Offline: IndexedDB persistence active. Operations recorded locally and will auto-sync upon reconnection'
                }
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">
                  {isRTL ? 'حفظ محلي (IndexedDB)' : 'Offline Mode (IndexedDB)'}
                </span>
              </div>
            ) : syncStatus === 'SYNCING' ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-medium"
                title={isRTL ? 'جاري مزامنة التغييرات مع Firestore...' : 'Syncing changes with Firestore...'}
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                <span className="hidden sm:inline">
                  {isRTL ? 'مزامنة...' : 'Syncing...'}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium"
                title={
                  isRTL
                    ? 'اتصال سحابي متزامن + التخزين المحلي IndexedDB نشط ومؤمّن ضد انقطاع الشبكة'
                    : 'Cloud connected + IndexedDB offline resilience active'
                }
              >
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden xl:inline">
                  {isRTL ? 'متصل • IndexedDB نشط' : 'Synced • IndexedDB'}
                </span>
              </div>
            )}
          </div>

          <div className="hidden sm:block h-6 w-[1px] bg-white/10" />

          {/* Warehouse Floor Worker Operating Mode (Section 30) */}
          <button
            onClick={() => setShowWorkerMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-bold transition-all shadow-sm shadow-amber-950/40 cursor-pointer"
            title={isRTL ? 'تفعيل وضع عامل المستودع السريع (أزرار كبيرة وعمليات فورية)' : 'Warehouse Worker High-Speed Floor Mode (Touch & Barcode)'}
          >
            <HardHat className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isRTL ? 'وضع العامل' : 'Worker Mode'}</span>
          </button>

          {/* Public SaaS Portal / Marketing Website Link */}
          {onOpenPublicPortal && (
            <button
              onClick={onOpenPublicPortal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-xs text-cyan-300 font-semibold transition-colors cursor-pointer"
              title={isRTL ? 'عرض الموقع التسويقي العام وبوابة المشتركين' : 'View Public SaaS Marketing & Pricing Portal'}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">{isRTL ? 'بوابة المنصة العامة' : 'Public Portal'}</span>
            </button>
          )}

          {/* Global Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title={t('search')}
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xl:inline text-slate-400">{t('search')}</span>
            <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-white/5 rounded border border-white/10 text-slate-400">
              Ctrl+K
            </kbd>
          </button>

          {/* Notification Center Trigger (Section 19) */}
          <button
            onClick={() => setShowNotifications(true)}
            className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
              unreadNotifCount > 0 || criticalPendingCount > 0
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title={isRTL ? 'مركز الإشعارات والتنبيهات' : 'Notifications & Alerts'}
          >
            <Bell className="w-4 h-4" />
            {(unreadNotifCount > 0 || pendingActions.length > 0) && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold font-mono text-white bg-rose-500 rounded-full border border-black animate-pulse">
                {unreadNotifCount + pendingActions.length}
              </span>
            )}
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[11px] font-bold text-slate-200 hover:bg-white/10 transition-colors flex items-center gap-1.5"
            title={language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{language === 'ar' ? 'العربية / EN' : 'EN / العربية'}</span>
          </button>

          {/* Authenticated User Session Profile & Security Clearance */}
          <div className="relative">
            <button
              onClick={() => setShowUserModal(!showUserModal)}
              className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-start cursor-pointer"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none text-white">
                  {language === 'ar' ? (currentUser?.nameAr || currentUser?.name || 'المشرف') : (currentUser?.name || currentUser?.nameAr || 'Supervisor')}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                      currentUser?.role === 'SUPER_ADMIN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {currentUser?.role || 'User'}
                  </span>
                </div>
              </div>
              <div
                className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${
                  currentUser?.role === 'SUPER_ADMIN'
                    ? 'from-amber-500 to-amber-700'
                    : 'from-cyan-600 to-blue-700'
                } border border-white/20 flex items-center justify-center text-white font-bold text-xs shadow-md`}
              >
                {currentUser?.nameAr ? currentUser?.nameAr.slice(0, 1) : (currentUser?.name ? currentUser?.name.slice(0, 1) : 'U')}
              </div>
            </button>

            {/* Authenticated Session & Security Modal */}
            {showUserModal && (
              <div
                className={`absolute ${
                  isRTL ? 'left-0' : 'right-0'
                } mt-2 w-80 rounded-2xl bg-[#0f121a] border border-white/15 shadow-2xl p-4 z-50`}
              >
                {/* User Info Header */}
                <div className="flex items-start gap-3 pb-3 mb-3 border-b border-white/10">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${
                      currentUser?.role === 'SUPER_ADMIN'
                        ? 'from-amber-500 to-amber-700'
                        : 'from-cyan-600 to-blue-700'
                    } flex items-center justify-center text-white font-bold text-base shadow-inner shrink-0`}
                  >
                    {currentUser?.nameAr ? currentUser?.nameAr.slice(0, 1) : (currentUser?.name ? currentUser?.name.slice(0, 1) : 'U')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {language === 'ar' ? (currentUser?.nameAr || currentUser?.name || 'المشرف') : (currentUser?.name || currentUser?.nameAr || 'Supervisor')}
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate">
                      {currentUser?.email || firebaseUser?.email || 'authenticated-session'}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">
                        {currentUser?.badgeNumber || 'KRN-00'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono font-semibold">
                        {currentUser?.role || 'Staff'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Security Verification Badges */}
                <div className="space-y-2 mb-4">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {isRTL ? 'حالة المصادقة' : 'Auth Status'}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {isRTL ? 'جلسة موثقة' : 'Verified'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      {isRTL ? 'الحفظ غير المتصل (IndexedDB)' : 'Offline Persistence'}
                    </span>
                    <span
                      className={`font-mono text-[11px] font-bold flex items-center gap-1 ${
                        isOfflinePersistenceActive ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {isOfflinePersistenceActive
                        ? isRTL
                          ? 'مفعّل (IndexedDB)'
                          : 'IndexedDB Active'
                        : isRTL
                          ? 'مستعد'
                          : 'Ready'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-cyan-400" />
                      {isRTL ? 'حوكمة Firestore' : 'Firestore Rules'}
                    </span>
                    <span className="text-cyan-400 font-mono text-[11px]">
                      {isRTL ? 'مشفرة ونشطة' : 'Enforced'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{isRTL ? 'القسم / الوحدة' : 'Department'}</span>
                    <span className="text-slate-200 text-[11px] truncate max-w-[150px]">
                      {language === 'ar' ? (currentUser?.departmentAr || 'العمليات والمستودعات') : (currentUser?.department || 'Operations')}
                    </span>
                  </div>
                </div>

                {/* Actions: Sign Out & Advanced */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <button
                    onClick={async () => {
                      setShowUserModal(false);
                      await logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تسجيل الخروج الآمن' : 'Secure Sign Out'}</span>
                  </button>

                  {currentUser?.role === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => {
                        setShowUserModal(false);
                        setShowResetConfirm(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{isRTL ? 'إعادة تعيين البيانات الأولية' : 'Reset Factory Baseline'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-rose-500/40 shadow-2xl p-6 text-start">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">
                {isRTL ? 'تأكيد إعادة تعيين قاعدة بيانات المصنع' : 'Confirm Factory Database Reset'}
              </h3>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {isRTL
                ? `سيتم إعادة تعيين جميع سجلات الاستلام وصرف الإنتاج والمخازن إلى البيانات التشغيلية الأولية لمنشأة ${currentOrganization.nameAr}. هل ترغب بالاستمرار؟`
                : `This will reset all receiving, production issues, and inventory back to initial baseline for ${currentOrganization.nameEn}. Continue?`}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => {
                  resetFactoryData();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-900/40"
              >
                {isRTL ? 'نعم، إعادة الضبط' : 'Yes, Reset Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Worker Operating Mode Modal (Section 30) */}
      <WarehouseWorkerModeModal
        isOpen={showWorkerMode}
        onClose={() => setShowWorkerMode(false)}
      />

      {/* Organization Notification Center Modal (Section 19) */}
      <NotificationCenterModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </header>
  );
};
