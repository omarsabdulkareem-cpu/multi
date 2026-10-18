import React, { useState } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { TenantProvider } from './context/TenantContext';
import { FactoryProvider, useFactory } from './context/FactoryContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { CommandCenterDashboard } from './components/CommandCenterDashboard';
import { ReceivingModule } from './components/ReceivingModule';
import { ShreddingModule } from './components/ShreddingModule';
import { StorageModule } from './components/StorageModule';
import { ProductionModule } from './components/ProductionModule';
import { MaterialCardModule } from './components/MaterialCardModule';
import { MaterialMasterModule } from './components/MaterialMasterModule';
import { SuppliersModule } from './components/SuppliersModule';
import { WarehousesModule } from './components/WarehousesModule';
import { MovementLedger } from './components/MovementLedger';
import { PendingActionsModule } from './components/PendingActionsModule';
import { ReportsModule } from './components/ReportsModule';
import { ExcelImportModule } from './components/ExcelImportModule';
import { AuditLogModule } from './components/AuditLogModule';
import { HistoricalMigrationCenter } from './components/HistoricalMigrationCenter';
import { InventoryReconciler } from './components/InventoryReconciler';
import { MaintenanceModule } from './components/MaintenanceModule';
import { MaintenanceAlerts } from './components/MaintenanceAlerts';
import { PredictiveInventoryForecastingModule } from './components/PredictiveInventoryForecastingModule';
import { ShiftOptimizer } from './components/ShiftOptimizer';
import { QualityControlMonitor } from './components/QualityControlMonitor';
import { VirtualStockVerifier } from './components/VirtualStockVerifier';
import { DailyOperationsTracker } from './components/DailyOperationsTracker';
import { ShiftHandoverModule } from './components/ShiftHandoverModule';
import { BulkBagManagementModule } from './components/BulkBagManagementModule';
import { ApprovalsCenterModule } from './components/ApprovalsCenterModule';
import { EnergyEfficiencyMonitor } from './components/EnergyEfficiencyMonitor';
import { RfidBulkTrackingModule } from './components/RfidBulkTrackingModule';
import { SecureAuthScreen } from './components/SecureAuthScreen';
import { SystemAdministrationModule } from './components/SystemAdministrationModule';
import { WarehouseOperationsModule } from './components/WarehouseOperationsModule';
import { OrganizationSettingsModule } from './components/OrganizationSettingsModule';
import { PlatformAdminModule } from './components/PlatformAdminModule';
import { BusinessManagementModule } from './components/BusinessManagementModule';
import { AdvancedWarehouseHub } from './components/AdvancedWarehouseHub';
import { BillingDashboardModule } from './components/BillingDashboardModule';
import { SmartWarehouseHub } from './components/SmartWarehouseHub';
import { IntegrationsManagementTab } from './components/IntegrationsManagementTab';
import { OnboardingWizardModal } from './components/OnboardingWizardModal';
import { PublicPortalHub } from './components/public/PublicPortalHub';
import { useTenant } from './context/TenantContext';
import { CloudSchedulerService } from './services/cloudScheduler';
import { PlatformService } from './services/platformService';
import { RefreshCw } from 'lucide-react';

interface MainLayoutProps {
  onOpenPublicPortal?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ onOpenPublicPortal }) => {
  const { isRTL } = useLanguage();
  const { currentPage, setCurrentPage, isSearchOpen, setIsSearchOpen, isOnline } = useFactory();
  const { isOnboardingOpen, setIsOnboardingOpen } = useTenant();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [supportSession, setSupportSession] = useState(() =>
    PlatformService.getSupportImpersonationSession()
  );

  // Poll support session status
  React.useEffect(() => {
    const checkSession = () => {
      setSupportSession(PlatformService.getSupportImpersonationSession());
    };
    checkSession();
    const interval = setInterval(checkSession, 1500);
    return () => clearInterval(interval);
  }, []);

  // Initialize Cloud Scheduler Service Daemon
  React.useEffect(() => {
    CloudSchedulerService.start();
  }, []);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, setIsSearchOpen]);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <CommandCenterDashboard />;
      case 'daily_operations':
        return <DailyOperationsTracker />;
      case 'shift_handover':
        return <ShiftHandoverModule />;
      case 'receiving':
        return <ReceivingModule initialTab="SCALE_IN" />;
      case 'operations':
      case 'warehouse_operations':
        return <WarehouseOperationsModule />;
      case 'scale_out':
        return <ReceivingModule initialTab="SCALE_OUT" />;
      case 'unloading':
        return <ReceivingModule initialTab="UNLOADING" />;
      case 'shredding':
        return <ShreddingModule />;
      case 'bulk_bags':
        return <BulkBagManagementModule />;
      case 'rfid_tracking':
        return <RfidBulkTrackingModule />;
      case 'approvals':
        return <ApprovalsCenterModule />;
      case 'storage':
      case 'inventory':
        return <StorageModule />;
      case 'production':
        return <ProductionModule />;
      case 'material_card':
        return <MaterialCardModule />;
      case 'materials':
      case 'materials_master':
        return <MaterialMasterModule />;
      case 'suppliers':
        return <SuppliersModule />;
      case 'warehouses':
        return <WarehousesModule />;
      case 'movements':
      case 'movement_ledger':
        return <MovementLedger />;
      case 'pending_actions':
        return <PendingActionsModule />;
      case 'reports':
        return <ReportsModule />;
      case 'excel_import':
        return <ExcelImportModule />;
      case 'historical_migration':
        return <HistoricalMigrationCenter />;
      case 'inventory_reconciler':
        return <InventoryReconciler />;
      case 'audit_log':
        return <AuditLogModule />;
      case 'maintenance':
        return <MaintenanceModule />;
      case 'maintenance_alerts':
        return <MaintenanceAlerts />;
      case 'forecasting':
        return <PredictiveInventoryForecastingModule />;
      case 'shift_optimizer':
        return <ShiftOptimizer />;
      case 'quality_control':
        return <QualityControlMonitor />;
      case 'virtual_stock_verifier':
        return <VirtualStockVerifier />;
      case 'energy_monitor':
        return <EnergyEfficiencyMonitor />;
      case 'system_admin':
      case 'inventory_codes_admin':
        return <SystemAdministrationModule />;
      case 'organization_settings':
        return <OrganizationSettingsModule />;
      case 'platform_admin':
        return <PlatformAdminModule />;
      case 'business_management':
        return <BusinessManagementModule initialTab="OVERVIEW" />;
      case 'purchasing':
        return <BusinessManagementModule initialTab="PURCHASE_ORDERS" />;
      case 'customers':
        return <BusinessManagementModule initialTab="CUSTOMERS" />;
      case 'internal_requests':
        return <BusinessManagementModule initialTab="INTERNAL_REQUESTS" />;
      case 'advanced_warehouse':
        return <AdvancedWarehouseHub />;
      case 'billing':
        return <BillingDashboardModule />;
      case 'smart_intelligence':
        return <SmartWarehouseHub />;
      case 'integrations':
        return <IntegrationsManagementTab initialSubTab="CREDENTIALS" />;
      case 'webhooks':
        return <IntegrationsManagementTab initialSubTab="WEBHOOKS" />;
      default:
        return <CommandCenterDashboard />;
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#09090b] text-slate-100 flex flex-col font-sans ${
        isRTL ? 'rtl' : 'ltr'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top Industrial HUD Header */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenPublicPortal={onOpenPublicPortal}
      />

      {/* Platform Owner Support Impersonation Banner */}
      {supportSession && (
        <div className="bg-purple-950/95 border-b border-purple-500/50 px-4 py-2.5 text-xs flex items-center justify-between text-purple-200 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping shrink-0" />
            <span className="font-bold">
              {isRTL
                ? `🛠️ وضع الدعم الفني السيادي للمنصة: أنت تتصفح منشأة '${supportSession.targetOrgName}' (${supportSession.targetOrgId}) كمسؤول دعم فني. جميع الإجراءات مدققة ومسجلة في سجل تدقيق المنصة.`
                : `🛠️ Platform Support Mode: Viewing tenant '${supportSession.targetOrgName}' (${supportSession.targetOrgId}) as Platform Operator. All actions are logged to Platform Audit.`}
            </span>
          </div>
          <button
            onClick={() => {
              PlatformService.endSupportImpersonation();
              setSupportSession(null);
              setCurrentPage('platform_admin');
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-purple-950/50 transition whitespace-nowrap"
          >
            {isRTL ? 'إنهاء وضع الدعم والعودة للمنصة' : 'Exit Support Mode'}
          </button>
        </div>
      )}

      {/* Warehouse Network Offline Resilience Notification */}
      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs flex items-center justify-between text-amber-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-semibold">
              {isRTL
                ? 'انقطاع شبكة المستودع مؤقتاً • تم تفعيل الحفظ المحلي (IndexedDB): تسجل كافة الأوزان وعمليات الصرف والثرم محلياً وستزامن تلقائياً فور استعادة الاتصال.'
                : 'Warehouse Network Offline • Local Persistence (IndexedDB) Active: All scale weighings, shredding logs, and issues are stored locally and will auto-sync upon reconnection.'}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 shrink-0 font-bold">
            IndexedDB Offline
          </span>
        </div>
      )}

      {/* Main Center Space */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#09090b]">
          {renderCurrentPage()}
        </main>
      </div>

      {/* Universal Search Modal (Ctrl + K / Command Center search) */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Multi-Tenant Onboarding Wizard Modal */}
      <OnboardingWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, authLoading } = useFactory();
  const { isRTL } = useLanguage();
  const [showPublicPortal, setShowPublicPortal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      if (['features', 'solutions', 'pricing', 'security', 'about', 'contact', 'terms', 'privacy', 'signup', 'login'].includes(path)) {
        return true;
      }
    }
    return !isAuthenticated;
  });

  if (authLoading) {
    return (
      <div
        className={`min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-center p-6 ${
          isRTL ? 'rtl' : 'ltr'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div className="text-sm font-bold text-white tracking-wide">
            {isRTL
              ? 'جاري التحقق من أذونات الأمان والمصادقة المركزية...'
              : 'Verifying Security Clearance & Firebase Authentication...'}
          </div>
          <div className="text-xs text-slate-400">
            {isRTL
              ? 'منصة إدارة المستودعات المركزية (SaaS) • التحقق المشفر من الجلسة'
              : 'Universal Warehouse Management SaaS • Zero-Trust Security Gate'}
          </div>
        </div>
      </div>
    );
  }

  // If visitor is unauthenticated or user chose to view the Public SaaS Portal
  if (!isAuthenticated || showPublicPortal) {
    return (
      <PublicPortalHub
        onEnterWorkspace={() => setShowPublicPortal(false)}
      />
    );
  }

  return <MainLayout onOpenPublicPortal={() => setShowPublicPortal(true)} />;
};

export default function App() {
  return (
    <LanguageProvider>
      <TenantProvider>
        <FactoryProvider>
          <AppContent />
        </FactoryProvider>
      </TenantProvider>
    </LanguageProvider>
  );
}
