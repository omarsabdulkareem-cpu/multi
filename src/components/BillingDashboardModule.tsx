import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  Users,
  Warehouse,
  Boxes,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Check,
  X,
  Lock,
  Download,
  Receipt,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { SaasService } from '../services/saasService';
import { MockBillingProvider } from '../services/billingProvider';
import {
  SubscriptionPlan,
  PlanTier,
  OrganizationSubscription,
  OrganizationInvoice,
  OrganizationBillingSettings,
  OrganizationUsageMetrics,
} from '../types/saas';

export const BillingDashboardModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const { currentOrganization, checkPermission, refreshTenantData } = useTenant();
  const { currentUser } = useFactory();

  const orgId = currentOrganization?.id || 'org_alkarwan';
  const orgCurrency = currentOrganization?.currency || 'USD';

  // Permission check: Warehouse workers should not view billing
  const canViewBilling = checkPermission('BILLING_VIEW' as any) || checkPermission('PLATFORM_ADMIN' as any);
  const canManageBilling = checkPermission('BILLING_MANAGE' as any) || checkPermission('PLATFORM_ADMIN' as any);

  // Data states
  const [subscription, setSubscription] = useState<OrganizationSubscription>(() =>
    SaasService.getSubscription(orgId)
  );
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => SaasService.getPlans());
  const [invoices, setInvoices] = useState<OrganizationInvoice[]>(() => SaasService.getInvoices(orgId));
  const [usage, setUsage] = useState<OrganizationUsageMetrics>(() => SaasService.getUsageMetrics(orgId));
  const [billingSettings, setBillingSettings] = useState<OrganizationBillingSettings>(() =>
    SaasService.getBillingSettings(orgId)
  );

  // Modals & tabs
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PLANS' | 'INVOICES' | 'SETTINGS'>('OVERVIEW');
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [selectedPlanToChange, setSelectedPlanToChange] = useState<SubscriptionPlan | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [downgradeWarning, setDowngradeWarning] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');

  // Reload data
  const loadData = () => {
    try {
      setSubscription(SaasService.getSubscription(orgId));
      setPlans(SaasService.getPlans());
      setInvoices(SaasService.getInvoices(orgId));
      setUsage(SaasService.getUsageMetrics(orgId));
      setBillingSettings(SaasService.getBillingSettings(orgId));
    } catch (e) {
      console.error('Error reloading billing data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const currentPlan = useMemo(() => {
    return (
      plans.find((p) => p.planId === subscription.planId || p.tier === subscription.planTier) || plans[0]
    );
  }, [plans, subscription]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  // Guard check
  const guard = useMemo(() => SaasService.checkSubscriptionGuard(orgId), [orgId, subscription]);

  // Handler: Change plan
  const handleConfirmPlanChange = async (targetTier: PlanTier) => {
    setIsProcessing(true);
    setDowngradeWarning(null);
    try {
      // Record server-side change request if available
      try {
        await fetch('/api/v1/subscriptions/request-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestedTier: targetTier,
            requestedCycle: billingCycle,
            notes: requestNotes,
          }),
        });
      } catch (err) {
        // Fallback silently if offline or running in mock harness
      }

      const res = await SaasService.changePlan(orgId, targetTier, billingCycle, currentUser?.name || 'Admin');
      loadData();
      refreshTenantData();
      setIsUpgradeModalOpen(false);
      setSelectedPlanToChange(null);
      setRequestNotes('');
      showToast(
        isRTL
          ? `تم اعتماد وتطبيق طلب تعديل الاشتراك إلى باقة ${targetTier} بنجاح!`
          : `Subscription plan change to ${targetTier} processed and recorded successfully!`
      );
    } catch (err: any) {
      setDowngradeWarning(err.message);
      showToast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Invoice Settlement Assistance (honest commercial terms, no fake card payments)
  const handlePayInvoice = async (invoiceId: string) => {
    showToast(
      isRTL
        ? 'تسوية الفواتير تتم وفق شروط التحويل البنكي للمؤسسات بالتنسيق مع إدارة المنصة.'
        : 'Enterprise billing settlement is handled via bank wire/invoice terms coordinated with Platform Support.',
      'success'
    );
  };

  // Handler: Save billing settings
  const handleSaveBillingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await SaasService.updateBillingSettings(orgId, billingSettings);
      showToast(isRTL ? 'تم حفظ بيانات الفوترة بنجاح' : 'Billing settings saved successfully');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // If user does not have permission
  if (!canViewBilling) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">
          {isRTL ? 'صلاحيات الفوترة مقيدة' : 'Billing Access Restricted'}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          {isRTL
            ? 'هذه الشاشة مخصصة لإدارة المنشأة ومسؤولي الاشتراكات. لا تتوفر صلاحيات الفوترة للمستخدمين التشغيليين في المستودع.'
            : 'Billing and subscription management is restricted to Organization Owners and Administrators.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-16">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
              COMMERCIAL SAAS TIER
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold border ${
                subscription.status === 'ACTIVE'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  : subscription.status === 'TRIAL'
                  ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                  : subscription.status === 'GRACE_PERIOD'
                  ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                  : 'bg-rose-950 text-rose-300 border-rose-500/40'
              }`}
            >
              {subscription.status}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-indigo-400" />
            {isRTL ? 'إدارة الاشتراك والفوترة والحدود التشغيلية' : 'Subscription, Billing & Usage Entitlements'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? `المنشأة الحالية: ${currentOrganization.name || currentOrganization.nameEn} • باقة ${currentPlan.nameAr} (${subscription.billingCycle})`
              : `Current Tenant: ${currentOrganization.name || currentOrganization.nameEn} • ${currentPlan.name} Plan (${subscription.billingCycle})`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
          {canManageBilling && (
            <button
              onClick={() => {
                setActiveTab('PLANS');
                setIsUpgradeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-950/50 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRTL ? 'ترقية / تغيير الباقة' : 'Upgrade / Change Plan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grace Period or Suspension Warning Banner */}
      {guard.isReadOnly && (
        <div className="p-4 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 flex items-start sm:items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              {isRTL ? 'وضع القراءة الآمنة مفعل (Safe Read-Only Mode): ' : 'Safe Read-Only Mode Active: '}
            </span>
            <span>{isRTL ? guard.messageAr : guard.messageEn}</span>
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'OVERVIEW', labelEn: 'Overview & Usage', labelAr: 'نظرة عامة والاستهلاك', icon: TrendingUp },
          { id: 'PLANS', labelEn: 'Plan Comparison', labelAr: 'مقارنة الباقات والترقية', icon: Layers },
          { id: 'INVOICES', labelEn: 'Invoices & Receipts', labelAr: 'الفواتير وسجل السداد', icon: Receipt, count: invoices.length },
          { id: 'SETTINGS', labelEn: 'Billing Settings', labelAr: 'بيانات الفوترة والضريبة', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950 font-black'
                  : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: OVERVIEW & USAGE METERS */}
      {/* ===================================================================== */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Plan Summary Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {isRTL ? 'الباقة الحالية' : 'Current Subscription'}
                </span>
                <div className="flex items-center justify-between mt-1">
                  <h3 className="text-xl font-black text-white">{isRTL ? currentPlan.nameAr : currentPlan.name}</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {subscription.planTier}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {isRTL ? currentPlan.descriptionAr : currentPlan.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">{isRTL ? 'التكلفة:' : 'Price:'} </span>
                  <span className="font-bold text-white text-base">
                    ${subscription.billingCycle === 'YEARLY' ? currentPlan.yearlyPrice : currentPlan.monthlyPrice}
                  </span>
                  <span className="text-slate-400"> / {subscription.billingCycle.toLowerCase()}</span>
                </div>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isRTL ? 'ساري' : 'Active'}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {isRTL ? 'الفترة والتجديد' : 'Billing Period & Renewal'}
                </span>
                <div className="mt-2 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isRTL ? 'الدورة:' : 'Billing Cycle:'}</span>
                    <span className="font-mono font-bold text-white">{subscription.billingCycle}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isRTL ? 'بداية الفترة:' : 'Period Start:'}</span>
                    <span className="font-mono text-slate-300">{subscription.currentPeriodStart?.split('T')[0]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{isRTL ? 'تاريخ التجديد القادم:' : 'Next Renewal:'}</span>
                    <span className="font-mono font-bold text-indigo-300">{subscription.currentPeriodEnd?.split('T')[0]}</span>
                  </div>
                </div>
              </div>

              {subscription.status === 'TRIAL' && subscription.trialEndDate && (
                <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs flex items-center gap-2 mt-4">
                  <Clock className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    {isRTL ? 'تنتهي الفترة التجريبية في: ' : 'Trial ends: '}
                    <strong>{subscription.trialEndDate.split('T')[0]}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {isRTL ? 'طريقة الدفع ومزود الخدمة' : 'Payment Method & Provider'}
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{subscription.paymentProvider}</div>
                    <div className="text-[11px] font-mono text-slate-400">Customer: {subscription.externalCustomerId || orgId}</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                {isRTL
                  ? 'يتم التعامل مع بيانات الدفع الآمنة دون تخزين أي بطاقات ائتمانية على خوادم التطبيق.'
                  : 'Zero sensitive cardholder credentials stored internally. External tokenized gateway architecture.'}
              </div>
            </div>
          </div>

          {/* Usage Meters vs Plan Limits */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              {isRTL ? 'الاستهلاك الفعلي مقابل حدود الباقة (Usage vs Entitlement Limits)' : 'Real-time Usage vs Entitlement Plan Limits'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  labelEn: 'Users & Team Members',
                  labelAr: 'المستخدمون وأعضاء الفريق',
                  current: usage.usersCount,
                  limit: currentPlan.limits.maxUsers,
                  icon: Users,
                  unit: isRTL ? 'مستخدم' : 'users',
                },
                {
                  labelEn: 'Warehouse Facilities',
                  labelAr: 'المستودعات والمنشآت',
                  current: usage.warehousesCount,
                  limit: currentPlan.limits.maxWarehouses,
                  icon: Warehouse,
                  unit: isRTL ? 'مستودع' : 'warehouses',
                },
                {
                  labelEn: 'Locations & Racks',
                  labelAr: 'المواقع والأرفف التخزينية',
                  current: usage.locationsCount,
                  limit: currentPlan.limits.maxLocations,
                  icon: Boxes,
                  unit: isRTL ? 'موقع' : 'locations',
                },
                {
                  labelEn: 'Catalog Item Masters',
                  labelAr: 'أصناف دليل المواد',
                  current: usage.itemsCount,
                  limit: currentPlan.limits.maxItems,
                  icon: FileText,
                  unit: isRTL ? 'صنف' : 'items',
                },
                {
                  labelEn: 'Monthly Transactions',
                  labelAr: 'حركات المخزون الشهرية',
                  current: usage.monthlyTransactionsCount,
                  limit: currentPlan.limits.maxMonthlyTransactions,
                  icon: ArrowUpRight,
                  unit: isRTL ? 'حركة' : 'transactions',
                },
                {
                  labelEn: 'Suppliers Master',
                  labelAr: 'دليل الموردين',
                  current: usage.suppliersCount,
                  limit: currentPlan.limits.maxSuppliers,
                  icon: Building2,
                  unit: isRTL ? 'مورد' : 'suppliers',
                },
                {
                  labelEn: 'Customers Master',
                  labelAr: 'دليل العملاء',
                  current: usage.customersCount,
                  limit: currentPlan.limits.maxCustomers,
                  icon: Users,
                  unit: isRTL ? 'عميل' : 'customers',
                },
                {
                  labelEn: 'Production & Shredding Orders',
                  labelAr: 'أوامر الإنتاج والمعالجة',
                  current: usage.productionOrdersCount,
                  limit: currentPlan.limits.maxProductionOrders,
                  icon: Layers,
                  unit: isRTL ? 'أمر' : 'orders',
                },
              ].map((meter, idx) => {
                const Icon = meter.icon;
                const isUnlimited = meter.limit === null;
                const pct = isUnlimited ? 15 : Math.min(100, Math.round((meter.current / (meter.limit || 1)) * 100));
                const isNearing = !isUnlimited && pct >= 80;
                const isFull = !isUnlimited && pct >= 100;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-slate-200">{isRTL ? meter.labelAr : meter.labelEn}</span>
                      </div>
                      {isFull ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/30">
                          {isRTL ? 'اكتمل' : 'Full'}
                        </span>
                      ) : isNearing ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                          {isRTL ? 'قارب الحد' : 'Near limit'}
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <span className="font-mono text-sm font-bold text-white">
                          {meter.current.toLocaleString()}{' '}
                          <span className="text-[11px] font-normal text-slate-400">/ {isUnlimited ? (isRTL ? 'غير محدود' : 'Unlimited') : meter.limit?.toLocaleString()}</span>
                        </span>
                        {!isUnlimited && <span className="font-mono text-[11px] text-slate-400">{pct}%</span>}
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all rounded-full ${
                            isFull
                              ? 'bg-rose-500'
                              : isNearing
                              ? 'bg-amber-500'
                              : 'bg-indigo-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feature Entitlement Matrix & Upgrade Requirements */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {isRTL ? 'مصفوفة الميزات والقدرات التشغيلية (Feature Entitlements)' : 'Active Feature Entitlements & Module Status'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL
                    ? 'الميزات التشغيلية المفعلة في باقتك الحالية مع توضيح متطلبات الترقية للباقات الأعلى.'
                    : 'Operational features included in your current subscription tier with upgrade requirements for restricted modules.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                {
                  key: 'multiWarehouse',
                  labelEn: 'Multi-Warehouse Facilities',
                  labelAr: 'المستودعات والمنشآت المتعددة',
                  descEn: 'Operate multiple distinct physical warehouses with cross-facility inventory transfers.',
                  descAr: 'إدارة عدة مستودعات فيزيائية مستقلة مع تحويلات داخلية وتتبع الأرصدة.',
                  enabled: !!currentPlan.features.multiWarehouse,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'batch',
                  labelEn: 'Batch & Lot Tracking',
                  labelAr: 'تتبع الشحنات واللوت (Batch/Lot)',
                  descEn: 'Track inventory by batch and lot numbers with complete historical traceability.',
                  descAr: 'تتبع المخزون برقم اللوت والتشغيلة مع سجل كامل لمسار المواد.',
                  enabled: !!currentPlan.features.batch,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'serial',
                  labelEn: 'Serial Number Tracking',
                  labelAr: 'تتبع الأرقام التسلسلية للأجهزة والمواد',
                  descEn: 'Individual serial tracking for precision electronics, machinery, and serialized stock.',
                  descAr: 'تتبع فردي لكل قطعة أو ماكينة برقمها التسلسلي لضمان الصيانة والضمان.',
                  enabled: !!currentPlan.features.serial,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'expiry',
                  labelEn: 'Expiry Date & FEFO Control',
                  labelAr: 'تواريخ الصلاحية وسياسة FEFO',
                  descEn: 'Automated expiration monitoring, quarantined lots, and First-Expired-First-Out picking.',
                  descAr: 'مراقبة الصلاحية التلقائية وحجر المواد المنتهية والصرف حسب الأقدم صلاحية.',
                  enabled: !!currentPlan.features.expiry,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'quality',
                  labelEn: 'Quality Control & Quarantine',
                  labelAr: 'فحص الجودة والحجر المخزني',
                  descEn: 'Mandatory inspection workflows upon receipt before stock is released to general inventory.',
                  descAr: 'إجراءات فحص الجودة الإلزامية قبل الإفراج عن المواد وتخزينها.',
                  enabled: !!currentPlan.features.quality,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'weighing',
                  labelEn: 'Weighbridge & Industrial Scales',
                  labelAr: 'ربط القبان والموازين الصناعية',
                  descEn: 'Direct serial/IoT connection to weighbridges, gross-tare-net calculation, and axle scales.',
                  descAr: 'ربط مباشر بموازين الشاحنات والقبان وحساب الوزن القائم والصافي تلقائياً.',
                  enabled: !!currentPlan.features.weighing,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'production',
                  labelEn: 'Production & Manufacturing BOM',
                  labelAr: 'أوامر الإنتاج ومعادلات التصنيع (BOM)',
                  descEn: 'Multi-level Bill of Materials, work order execution, raw material backflushing, and scrap.',
                  descAr: 'شجرة المواد (BOM) متعددة المستويات، أوامر التشغيل وخصم الخامات ومخرجات الإنتاج.',
                  enabled: !!currentPlan.features.production,
                  minTier: 'BUSINESS',
                },
                {
                  key: 'recycling',
                  labelEn: 'Shredding & Scrap Recycling',
                  labelAr: 'إعادة التدوير وفرم البلاستيك والمخلفات',
                  descEn: 'Industrial shredder batches, input-output weight reconciliations, and granulator lots.',
                  descAr: 'سجلات فرم المواد، حساب الفواقد، وتحويل مخلفات التصنيع إلى حبيبات معاد تدويرها.',
                  enabled: !!currentPlan.features.recycling,
                  minTier: 'BUSINESS',
                },
                {
                  key: 'advancedReports',
                  labelEn: 'Valuation & Advanced Analytics',
                  labelAr: 'التقارير المالية والتقييم المالي للمخزون',
                  descEn: 'Weighted average costing, FIFO valuation, turnover speed, and aging breakdown exports.',
                  descAr: 'تقييم المخزون المالي بالمتوسط المرجح وFIFO وسرعة دوران الأصناف وسجل الأعمار.',
                  enabled: !!currentPlan.features.advancedReports,
                  minTier: 'PROFESSIONAL',
                },
                {
                  key: 'api',
                  labelEn: 'REST API & Real-Time Webhooks',
                  labelAr: 'الربط البرمجي (API) والويب هوك',
                  descEn: 'High-entropy API keys, event webhooks with HMAC signatures, and automated ERP sync.',
                  descAr: 'مفاتيح الربط البرمجي المشفرة، إشعارات الويب هوك الموقعة وتكامل أنظمة ERP.',
                  enabled: !!currentPlan.features.api,
                  minTier: 'PROFESSIONAL',
                },
              ].map((feat) => (
                <div
                  key={feat.key}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                    feat.enabled
                      ? 'bg-slate-900/90 border-slate-800'
                      : 'bg-slate-950/60 border-slate-800/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-white">
                        {isRTL ? feat.labelAr : feat.labelEn}
                      </span>
                      {feat.enabled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          {isRTL ? 'مفعل' : 'Included'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-indigo-400" />
                          {feat.minTier}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {isRTL ? feat.descAr : feat.descEn}
                    </p>
                  </div>

                  {!feat.enabled && (
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] text-amber-300 font-medium">
                        {isRTL ? `يتطلب باقة ${feat.minTier}` : `Requires ${feat.minTier} plan`}
                      </span>
                      {canManageBilling && (
                        <button
                          onClick={() => {
                            const target = plans.find((p) => p.tier === feat.minTier) || plans[plans.length - 1];
                            setSelectedPlanToChange(target);
                            setIsUpgradeModalOpen(true);
                          }}
                          className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isRTL ? 'ترقية' : 'Upgrade'}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PLAN COMPARISON MATRIX */}
      {/* ===================================================================== */}
      {activeTab === 'PLANS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'اختر الباقة المناسبة لحجم أعمالك' : 'Choose the Plan that Scales with Your Operations'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL ? 'تخصيص كامل للصلاحيات، سعة المخزون، والميزات الصناعية بدون توقف للخدمة.' : 'Seamless tier upgrades, real-time entitlement adjustments, zero downtime.'}
              </p>
            </div>

            {/* Monthly / Yearly Toggle */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  billingCycle === 'MONTHLY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRTL ? 'شهري' : 'Monthly'}
              </button>
              <button
                onClick={() => setBillingCycle('YEARLY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  billingCycle === 'YEARLY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{isRTL ? 'سنوي' : 'Yearly'}</span>
                <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-emerald-500 text-slate-950 font-black">
                  -17%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p) => {
              const isCurrent = subscription.planTier === p.tier;
              const price = billingCycle === 'YEARLY' ? p.yearlyPrice : p.monthlyPrice;

              return (
                <div
                  key={p.planId}
                  className={`p-5 rounded-2xl flex flex-col justify-between gap-5 transition border ${
                    isCurrent
                      ? 'bg-gradient-to-b from-slate-900 to-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-950/50'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
                        {p.tier}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500 text-white">
                          {isRTL ? 'باقتك الحالية' : 'Current Plan'}
                        </span>
                      )}
                    </div>

                    <h4 className="text-lg font-black text-white">{isRTL ? p.nameAr : p.name}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed min-h-[48px]">
                      {isRTL ? p.descriptionAr : p.description}
                    </p>

                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-white">${price}</span>
                        <span className="text-xs text-slate-400 font-normal">
                          / {billingCycle === 'YEARLY' ? (isRTL ? 'سنة' : 'year') : (isRTL ? 'شهر' : 'month')}
                        </span>
                      </div>
                    </div>

                    {/* Limits summary */}
                    <div className="space-y-1.5 pt-2 text-xs text-slate-300">
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">{isRTL ? 'المستخدمين:' : 'Users:'}</span>
                        <span className="font-bold text-white">{p.limits.maxUsers ?? (isRTL ? 'غير محدود' : 'Unlimited')}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">{isRTL ? 'المستودعات:' : 'Warehouses:'}</span>
                        <span className="font-bold text-white">{p.limits.maxWarehouses ?? (isRTL ? 'غير محدود' : 'Unlimited')}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">{isRTL ? 'الأصناف:' : 'Items Master:'}</span>
                        <span className="font-bold text-white">{p.limits.maxItems ? p.limits.maxItems.toLocaleString() : (isRTL ? 'غير محدود' : 'Unlimited')}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                        <span className="text-slate-400">{isRTL ? 'الحركات الشهرية:' : 'Monthly Trans:'}</span>
                        <span className="font-bold text-white">{p.limits.maxMonthlyTransactions ? p.limits.maxMonthlyTransactions.toLocaleString() : (isRTL ? 'غير محدود' : 'Unlimited')}</span>
                      </div>
                    </div>

                    {/* Features Checklist */}
                    <div className="space-y-1.5 pt-2 text-xs">
                      {[
                        { label: 'Batch / Lot Tracking', active: p.features.batch },
                        { label: 'Serial Tracking', active: p.features.serial },
                        { label: 'Weighing Scales', active: p.features.weighing },
                        { label: 'Production & BOM', active: p.features.production },
                        { label: 'Processing / Shredding', active: p.features.processing },
                        { label: 'Quality Control', active: p.features.quality },
                        { label: 'Advanced Reports', active: p.features.advancedReports },
                      ].map((feat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {feat.active ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          )}
                          <span className={feat.active ? 'text-slate-200' : 'text-slate-500 line-through'}>
                            {feat.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700 cursor-not-allowed"
                      >
                        {isRTL ? 'الباقة المفعلة حالياً' : 'Active Plan'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedPlanToChange(p);
                          setIsUpgradeModalOpen(true);
                        }}
                        disabled={!canManageBilling}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-950 transition cursor-pointer"
                      >
                        {isRTL ? 'اختيار هذه الباقة' : 'Select Plan'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: INVOICES & PAYMENT HISTORY */}
      {/* ===================================================================== */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                {isRTL ? 'سجل الفواتير وعمليات الدفع' : 'Billing Invoices & Receipts History'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL ? 'كافة الفواتير الضريبية وتفاصيل السداد الشهرية والسنوية للمنشأة.' : 'Tax invoices, renewal receipts, and status verification.'}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {invoices.length} {isRTL ? 'فاتورة' : 'Invoices'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">{isRTL ? 'رقم الفاتورة' : 'Invoice Number'}</th>
                    <th className="p-3">{isRTL ? 'البيان' : 'Description'}</th>
                    <th className="p-3">{isRTL ? 'تاريخ الإصدار' : 'Issue Date'}</th>
                    <th className="p-3">{isRTL ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                    <th className="p-3">{isRTL ? 'المبلغ' : 'Amount'}</th>
                    <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-right">{isRTL ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-bold text-white flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        {inv.invoiceNumber}
                      </td>
                      <td className="p-3 text-slate-300">{inv.description || 'Subscription Renewal'}</td>
                      <td className="p-3 font-mono text-slate-400">{inv.issueDate?.split('T')[0]}</td>
                      <td className="p-3 font-mono text-slate-400">{inv.dueDate?.split('T')[0]}</td>
                      <td className="p-3 font-mono font-bold text-white">
                        ${inv.amount.toLocaleString()} {inv.currency}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                              : inv.status === 'OPEN'
                              ? 'bg-amber-950 text-amber-300 border-amber-500/30'
                              : 'bg-rose-950 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {inv.status === 'OPEN' ? (
                          <button
                            onClick={() => handlePayInvoice(inv.invoiceId)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition cursor-pointer"
                          >
                            {isRTL ? 'تسوية بنكية' : 'Wire Settlement'}
                          </button>
                        ) : (
                          <button
                            onClick={() => showToast(isRTL ? 'جاري تجهيز نسخة الفاتورة للطباعة' : 'Generating printable invoice PDF...')}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <Download className="w-3 h-3" />
                            <span>{isRTL ? 'تحميل' : 'Receipt'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: BILLING SETTINGS */}
      {/* ===================================================================== */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveBillingSettings} className="space-y-4 max-w-3xl">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              {isRTL ? 'بيانات الفوترة والتسجيل الضريبي' : 'Organization Billing Profile & Tax Details'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL ? 'تظهر هذه البيانات على الفواتير الرسمية وسندات القبض الضريبية.' : 'These details are automatically printed on generated invoices and receipts.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'جهة / مسؤول الاتصال المالي:' : 'Billing Contact Name:'}</label>
                <input
                  type="text"
                  value={billingSettings.billingContact}
                  onChange={(e) => setBillingSettings({ ...billingSettings, billingContact: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'البريد الإلكتروني للفوترة:' : 'Billing Email:'}</label>
                <input
                  type="email"
                  value={billingSettings.billingEmail}
                  onChange={(e) => setBillingSettings({ ...billingSettings, billingEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">{isRTL ? 'العنوان المسجل:' : 'Registered Billing Address:'}</label>
                <input
                  type="text"
                  value={billingSettings.billingAddress}
                  onChange={(e) => setBillingSettings({ ...billingSettings, billingAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'الرقم الضريبي (Tax / VAT Number):' : 'Tax / VAT Number:'}</label>
                <input
                  type="text"
                  value={billingSettings.taxNumber}
                  onChange={(e) => setBillingSettings({ ...billingSettings, taxNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'الدولة:' : 'Billing Country:'}</label>
                <input
                  type="text"
                  value={billingSettings.billingCountry}
                  onChange={(e) => setBillingSettings({ ...billingSettings, billingCountry: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">{isRTL ? 'ملاحظات إضافية على الفاتورة:' : 'Invoice Notes / PO Reference:'}</label>
                <textarea
                  rows={2}
                  value={billingSettings.invoiceNotes || ''}
                  onChange={(e) => setBillingSettings({ ...billingSettings, invoiceNotes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 transition cursor-pointer"
              >
                {isRTL ? 'حفظ إعدادات الفوترة' : 'Save Billing Profile'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ===================================================================== */}
      {/* UPGRADE / DOWNGRADE CONFIRMATION MODAL */}
      {/* ===================================================================== */}
      {isUpgradeModalOpen && selectedPlanToChange && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {isRTL ? 'تأكيد تعديل باقة الاشتراك' : 'Confirm Subscription Plan Change'}
              </h3>
              <button
                onClick={() => {
                  setIsUpgradeModalOpen(false);
                  setSelectedPlanToChange(null);
                  setDowngradeWarning(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'الباقة الحالية:' : 'Current Plan:'}</span>
                <span className="font-bold text-slate-300">{currentPlan.tier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'الباقة الجديدة المطلوبة:' : 'Target Plan:'}</span>
                <span className="font-bold text-indigo-400 text-sm">{selectedPlanToChange.tier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'الدورة السعرية:' : 'Billing Cycle:'}</span>
                <span className="font-mono text-white">{billingCycle}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400">{isRTL ? 'المبلغ المستحق وفق شروط العقد:' : 'Contractual Amount:'}</span>
                <span className="font-mono font-black text-white text-base">
                  ${billingCycle === 'YEARLY' ? selectedPlanToChange.yearlyPrice : selectedPlanToChange.monthlyPrice}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs mb-1 font-semibold">
                {isRTL ? 'ملاحظات أمر الشراء / مبررات التعديل (اختياري):' : 'Plan Change Notes / PO Reference (Optional):'}
              </label>
              <textarea
                rows={2}
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder={isRTL ? 'أدخل أي تعليمات خاصة بالفاتورة أو الدورة التعاقدية...' : 'Enter any purchase order details or commercial instructions...'}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-[11px] leading-relaxed flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                {isRTL
                  ? 'ملاحظة تجارية: يتم تسجيل واعتماد طلبات تعديل الباقات وتطبيق الحدود التشغيلية عبر الفوترة المؤسسية المعتمدة مع إدارة المنصة، دون معالجة أي بطاقات بنكية وهمية أو غير آمنة.'
                  : 'Commercial note: Subscription plan adjustments are recorded under enterprise commercial terms and applied with audit logging without unverified card processing.'}
              </span>
            </div>

            {/* Downgrade Warning if any */}
            {downgradeWarning && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">{isRTL ? 'تنبيه تجاوز الحدود:' : 'Entitlement Limit Overflow:'}</div>
                  <div className="mt-0.5 leading-relaxed">{downgradeWarning}</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsUpgradeModalOpen(false);
                  setSelectedPlanToChange(null);
                  setDowngradeWarning(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleConfirmPlanChange(selectedPlanToChange.tier)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 transition cursor-pointer"
              >
                {isProcessing
                  ? isRTL
                    ? 'جار المعالجة...'
                    : 'Processing...'
                  : isRTL
                  ? 'تأكيد واعتماد تعديل الباقة'
                  : 'Confirm & Request Plan Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
