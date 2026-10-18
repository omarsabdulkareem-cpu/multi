import React from 'react';
import {
  LayoutDashboard,
  Truck,
  Scale,
  PackageCheck,
  Flame,
  Boxes,
  Factory,
  Layers,
  AlertOctagon,
  ScrollText,
  CreditCard,
  Barcode,
  Users,
  Warehouse as WarehouseIcon,
  BarChart3,
  FileSpreadsheet,
  Database,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Wrench,
  Activity,
  UserCheck,
  Sparkles,
  Sliders,
  ShieldCheck,
  Scan,
  Bell,
  Zap,
  Radio,
  Settings,
  ClipboardList,
  Building2,
  Server,
  Briefcase,
  ShoppingCart,
  Webhook,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { NavigationPage } from '../types';
import { getStoredMachines } from '../services/maintenanceService';
import { MaintenancePredictionsSidebarWidget } from './MaintenancePredictionsSidebarWidget';
import { canUserAccessPage } from '../services/permissionsService';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen?: (open: boolean) => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, onClose }) => {
  const { t, isRTL } = useLanguage();
  const {
    currentPage,
    setCurrentPage,
    pendingActions,
    receivingTransactions,
    shreddingTransactions,
    shiftHandovers,
    currentUser,
    activeStorageCode,
    activeProductionCode,
    activeShreddingReceiptCode,
    activeShreddingMoveCode,
  } = useFactory();

  const handleToggle = () => {
    if (setIsOpen) setIsOpen(!isOpen);
    else if (onClose && isOpen) onClose();
  };

  const handleClose = () => {
    if (onClose) onClose();
    if (setIsOpen) setIsOpen(false);
  };

  // Calculate live badge counts
  const pendingScaleIns = receivingTransactions.filter((r) => r.status === 'Draft').length;
  const pendingScaleOuts = receivingTransactions.filter(
    (r) => r.status === 'Scale In Completed' || r.status === 'Unloading Completed'
  ).length;
  const pendingUnloadings = receivingTransactions.filter((r) => r.status === 'Scale In Completed').length;
  const activeShreddings = shreddingTransactions.filter(
    (s) => s.status === 'In Shredding' || s.status === 'Shredding Completed'
  ).length;
  const pendingHandovers = (shiftHandovers || []).filter((h) => h.status === 'SUBMITTED').length;
  const totalPending = pendingActions.length;
  const storedMachines = getStoredMachines();
  const overdueMachinesCount = storedMachines.filter(
    (m) => m.currentOperatingHours >= m.maintenanceThresholdHours
  ).length;

  interface NavItem {
    id: NavigationPage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
    section?: 'main' | 'operations' | 'ledger' | 'master' | 'tools';
    hotkey?: string;
  }

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: t('dashboard'),
      icon: LayoutDashboard,
      section: 'main',
    },
    {
      id: 'daily_operations',
      label: isRTL ? 'متابعة العمليات اليومية' : 'Daily Operations (3 Sec)',
      icon: Activity,
      section: 'main',
    },
    {
      id: 'shift_handover',
      label: isRTL ? 'تسليم واستلام الوردية' : 'Shift Handover',
      icon: UserCheck,
      badge: pendingHandovers > 0 ? pendingHandovers : undefined,
      badgeColor: 'bg-indigo-500 text-white font-bold',
      section: 'main',
    },
    // Main Command Center Actions
    {
      id: 'operations',
      label: isRTL ? 'إدارة العمليات المستودعية' : 'Warehouse Operations',
      icon: ClipboardList,
      badgeColor: 'bg-emerald-500',
      section: 'operations',
    },
    {
      id: 'receiving',
      label: t('receive'),
      icon: Truck,
      badge: pendingScaleIns > 0 ? pendingScaleIns : undefined,
      badgeColor: 'bg-cyan-500',
      section: 'operations',
    },
    {
      id: 'unloading',
      label: t('unloading'),
      icon: PackageCheck,
      badge: pendingUnloadings > 0 ? pendingUnloadings : undefined,
      badgeColor: 'bg-blue-500',
      section: 'operations',
    },
    {
      id: 'scale_out',
      label: t('scaleOut'),
      icon: Scale,
      badge: pendingScaleOuts > 0 ? pendingScaleOuts : undefined,
      badgeColor: 'bg-amber-500',
      section: 'operations',
    },
    {
      id: 'shredding',
      label: t('shredIt'),
      icon: Flame,
      badge: activeShreddings > 0 ? activeShreddings : undefined,
      badgeColor: 'bg-emerald-500',
      section: 'operations',
    },
    {
      id: 'energy_monitor',
      label: isRTL ? 'كفاءة الطاقة والكهرباء' : 'Energy Efficiency Monitor',
      icon: Zap,
      badgeColor: 'bg-emerald-500 text-white font-bold',
      section: 'operations',
    },
    {
      id: 'storage',
      label: t('storage'),
      icon: Boxes,
      section: 'operations',
    },
    {
      id: 'production',
      label: t('sendToProduction'),
      icon: Factory,
      section: 'operations',
    },
    {
      id: 'inventory',
      label: t('inventory'),
      icon: Layers,
      section: 'operations',
    },
    {
      id: 'bulk_bags',
      label: isRTL ? 'إدارة الشلايف والباركود' : 'Bulk Bags & Labels',
      icon: Barcode,
      section: 'operations',
    },
    {
      id: 'rfid_tracking',
      label: isRTL ? 'تتبع RFID والحركات الجماعية' : 'Bulk RFID & Portals',
      icon: Radio,
      badgeColor: 'bg-amber-500 text-white font-bold',
      section: 'operations',
    },
    {
      id: 'virtual_stock_verifier',
      label: isRTL ? 'فاحص ومحقق المخزون (QR)' : 'Virtual Stock Verifier',
      icon: Scan,
      badgeColor: 'bg-cyan-500 text-white font-bold',
      section: 'operations',
    },
    {
      id: 'pending_actions',
      label: t('pendingActions'),
      icon: AlertOctagon,
      badge: totalPending > 0 ? totalPending : undefined,
      badgeColor: 'bg-rose-500 text-white font-bold animate-pulse',
      section: 'operations',
    },
    {
      id: 'maintenance',
      label: isRTL ? 'صيانة الماكينات والإنذارات' : 'Machinery Maintenance',
      icon: Wrench,
      badge: overdueMachinesCount > 0 ? overdueMachinesCount : undefined,
      badgeColor: 'bg-amber-500 text-slate-950 font-bold animate-pulse',
      section: 'operations',
    },
    {
      id: 'maintenance_alerts',
      label: isRTL ? 'تنبيهات الصيانة والاستهلاك' : 'Maintenance Alerts',
      icon: Bell,
      badge: overdueMachinesCount > 0 ? overdueMachinesCount : undefined,
      badgeColor: 'bg-rose-500 text-white font-bold animate-pulse',
      section: 'operations',
    },
    {
      id: 'forecasting',
      label: isRTL ? 'التنبؤ بالمخزون وطلب المواد' : 'Inventory Forecasting',
      icon: Sparkles,
      section: 'operations',
    },
    {
      id: 'shift_optimizer',
      label: isRTL ? 'مُحسِّن الورديات والراحة' : 'Shift & Break Optimizer',
      icon: Sliders,
      section: 'operations',
    },
    {
      id: 'quality_control',
      label: isRTL ? 'مراقب الجودة والعيوب (Heatmap)' : 'Quality Control & Heatmap',
      icon: ShieldCheck,
      section: 'operations',
    },
    {
      id: 'advanced_warehouse',
      label: isRTL ? 'المستودعات والوحدات المتقدمة' : 'Advanced Warehouse Hub',
      icon: Layers,
      badgeColor: 'bg-indigo-500',
      section: 'operations',
    },
    {
      id: 'smart_intelligence',
      label: isRTL ? 'الذكاء والأتمتة التشغيلية' : 'Smart Intelligence & Hub',
      icon: Sparkles,
      badgeColor: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold',
      section: 'operations',
    },
    {
      id: 'movement_ledger',
      label: t('movementLedger'),
      icon: ScrollText,
      section: 'ledger',
    },
    {
      id: 'material_card',
      label: t('materialCard'),
      icon: CreditCard,
      section: 'ledger',
    },
    // Master Registers & Business
    {
      id: 'business_management',
      label: isRTL ? 'إدارة الأعمال والمشتريات' : 'Purchasing & Business Hub',
      icon: Briefcase,
      section: 'master',
    },
    {
      id: 'materials_master',
      label: t('materialsMaster'),
      icon: Barcode,
      section: 'master',
    },
    {
      id: 'suppliers',
      label: t('suppliers'),
      icon: Users,
      section: 'master',
    },
    {
      id: 'customers',
      label: isRTL ? 'سجل العملاء والتوزيع' : 'Customers Master',
      icon: Building2,
      section: 'master',
    },
    {
      id: 'warehouses',
      label: t('warehouses'),
      icon: WarehouseIcon,
      section: 'master',
    },
    // Intelligence & Tools
    {
      id: 'reports',
      label: t('reports'),
      icon: BarChart3,
      section: 'tools',
    },
    {
      id: 'inventory_reconciler',
      label: isRTL ? 'مطابقة وموازنة المخزون' : 'Inventory Reconciler',
      icon: Scale,
      section: 'tools',
    },
    {
      id: 'excel_import',
      label: t('excelImport'),
      icon: FileSpreadsheet,
      section: 'tools',
    },
    {
      id: 'historical_migration',
      label: isRTL ? 'ترحيل البيانات التاريخية' : 'Historical Migration',
      icon: Database,
      section: 'tools',
    },
    {
      id: 'audit_log',
      label: t('auditLog'),
      icon: ShieldAlert,
      section: 'tools',
    },
    {
      id: 'organization_settings',
      label: isRTL ? 'إعدادات المنشأة (Tenant Settings)' : 'Organization Settings',
      icon: Building2,
      section: 'tools',
    },
    {
      id: 'webhooks',
      label: isRTL ? 'الويب هوك وبث الأحداث (Webhooks)' : 'Webhooks & Event Stream',
      icon: Webhook,
      badgeColor: 'bg-cyan-500',
      section: 'tools',
    },
    {
      id: 'billing',
      label: isRTL ? 'الاشتراك والفوترة (Billing)' : 'Subscription & Billing',
      icon: CreditCard,
      badgeColor: 'bg-indigo-500',
      section: 'tools',
    },
    {
      id: 'platform_admin',
      label: isRTL ? 'إدارة المنصة (SaaS Admin)' : 'Platform Master Admin',
      icon: Server,
      badgeColor: 'bg-purple-500',
      section: 'tools',
    },
    {
      id: 'system_admin',
      label: isRTL ? 'إدارة النظام والأكواد' : 'System Administration',
      icon: Settings,
      section: 'tools',
    },
  ];

  // Filter navigation links based on user's authorized AL-KARWAN role
  const authorizedNavItems = navItems.filter((item) =>
    canUserAccessPage(currentUser?.role || 'Admin', item.id)
  );

  return (
    <aside
      className={`fixed lg:static inset-y-0 ${isRTL ? 'right-0' : 'left-0'} z-30 flex flex-col bg-[#0f1115] border-x border-white/10 transition-all duration-300 ${
        isOpen ? 'w-64 sm:w-72' : 'w-0 lg:w-20 -translate-x-full lg:translate-x-0'
      } shadow-2xl lg:shadow-none overflow-hidden`}
    >
      {/* Sidebar Header toggle button */}
      <div className="flex items-center justify-between p-3.5 border-b border-white/10">
        <div className={`flex items-center gap-2.5 ${!isOpen && 'lg:hidden'}`}>
          <div className="w-2.5 h-2.5 rounded bg-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
            {isRTL ? 'مركز التحكم' : 'COMMAND MATRIX'}
          </span>
        </div>
        <button
          onClick={handleToggle}
          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          {isRTL ? (
            isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          ) : (
            isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links Scrollable */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {authorizedNavItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          const isPendingItem = item.id === 'pending_actions';

          return (
            <React.Fragment key={item.id}>
              {/* Section dividers */}
              {index === 1 && (
                <div className={`pt-3 pb-1 px-3 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold ${!isOpen && 'lg:hidden'}`}>
                  {isRTL ? 'العمليات وسير المواد' : 'CORE WORKFLOWS'}
                </div>
              )}
              {index === 9 && (
                <div className={`pt-3 pb-1 px-3 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold ${!isOpen && 'lg:hidden'}`}>
                  {isRTL ? 'السجلات والدفاتر' : 'LEDGERS & HISTORY'}
                </div>
              )}
              {index === 11 && (
                <div className={`pt-3 pb-1 px-3 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold ${!isOpen && 'lg:hidden'}`}>
                  {isRTL ? 'البيانات الأساسية' : 'MASTER DATA'}
                </div>
              )}
              {index === 14 && (
                <div className={`pt-3 pb-1 px-3 text-[9px] font-mono uppercase tracking-widest text-slate-500 font-bold ${!isOpen && 'lg:hidden'}`}>
                  {isRTL ? 'التحليلات والأدوات' : 'ANALYTICS & TOOLS'}
                </div>
              )}

              <button
                onClick={() => {
                  setCurrentPage(item.id);
                  if (window.innerWidth < 1024) handleClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all relative group ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                    : isPendingItem && totalPending > 0
                    ? 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title={item.label}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className={`absolute ${isRTL ? 'right-0' : 'left-0'} top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-full`} />
                )}

                <div
                  className={`p-1.5 rounded shrink-0 transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : isPendingItem && totalPending > 0
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-white/5 text-slate-400 group-hover:text-white group-hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <span className={`truncate text-start flex-1 ${!isOpen && 'lg:hidden'}`}>
                  {item.label}
                </span>

                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                      item.badgeColor || 'bg-white/10 text-slate-300'
                    } ${!isOpen && 'lg:hidden'}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Maintenance Predictions 24-Hour Failure Risk Heatmap Widget */}
      <MaintenancePredictionsSidebarWidget isSidebarOpen={isOpen} />

      {/* Footer Legacy Reference Guide */}
      <div className={`p-3 border-t border-white/10 bg-[#0f1115] ${!isOpen && 'lg:hidden'}`}>
        <div className="rounded-lg bg-[#111218] border border-white/5 p-2.5 space-y-1 text-[11px]">
          <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            {isRTL ? 'دليل المستندات الدفترية' : 'Legacy Document Index'}
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-cyan-400 font-mono font-bold">{activeProductionCode}</span>
            <span className="truncate">{isRTL ? 'استلام مواد خامات' : 'Raw Material Receipt'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-emerald-400 font-mono font-bold">{activeShreddingReceiptCode}</span>
            <span className="truncate">{isRTL ? 'استلام مخزن الثرم' : 'Shred Store Receipt'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-amber-400 font-mono font-bold">{activeShreddingMoveCode}</span>
            <span className="truncate">{isRTL ? 'نقل وحركة مخزن الثرم' : 'Shred Storage Move'}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-purple-400 font-mono font-bold">{activeStorageCode}</span>
            <span className="truncate">{isRTL ? 'صادر مواد خامات' : 'Raw Material Issue'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
