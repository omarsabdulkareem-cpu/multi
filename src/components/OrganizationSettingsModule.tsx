import React, { useState } from 'react';
import {
  Building2,
  Sliders,
  Globe,
  Boxes,
  FileText,
  Users,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Archive,
  Ban,
  Activity,
  Layers,
  CreditCard,
  Key,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { TenantPermission, TenantRole } from '../types/tenant';
import { BillingDashboardModule } from './BillingDashboardModule';
import { IntegrationsManagementTab } from './IntegrationsManagementTab';

type SettingsTab =
  | 'GENERAL'
  | 'BRANDING'
  | 'LOCALIZATION'
  | 'INVENTORY'
  | 'DOCUMENTS'
  | 'USERS'
  | 'INVITATIONS'
  | 'ROLES'
  | 'MODULES'
  | 'BILLING'
  | 'SECURITY'
  | 'INTEGRATIONS'
  | 'AUDIT';

export const OrganizationSettingsModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    currentOrganization,
    updateOrganization,
    archiveOrganization,
    members,
    invitations,
    roles,
    auditLogs,
    inviteEmployee,
    cancelInvitation,
    setMemberStatus,
    updateMemberRole,
    removeMember,
    createCustomRole,
    refreshTenantData,
  } = useTenant();
  const { currentUser } = useFactory();

  const [activeTab, setActiveTab] = useState<SettingsTab>('GENERAL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  // General & Branding & Localization State
  const [formState, setFormState] = useState({
    name: currentOrganization.name || currentOrganization.nameEn,
    nameAr: currentOrganization.nameAr,
    nameEn: currentOrganization.nameEn,
    legalName: currentOrganization.legalName || '',
    country: currentOrganization.country || '',
    city: currentOrganization.city || '',
    address: currentOrganization.address || '',
    phone: currentOrganization.phone || currentOrganization.contactPhone || '',
    email: currentOrganization.email || currentOrganization.contactEmail || '',
    website: currentOrganization.website || '',
    logo: currentOrganization.logo || '',
    currency: currentOrganization.currency || 'USD',
    timezone: currentOrganization.timezone || 'UTC',
    defaultLanguage: currentOrganization.defaultLanguage || 'ar',
    dateFormat: currentOrganization.dateFormat || 'YYYY-MM-DD',
    weightUnit: currentOrganization.weightUnit || 'KG',

    // Inventory
    defaultQuantityUnit: currentOrganization.inventoryPreferences?.defaultQuantityUnit || 'Units',
    allowNegativeStock: currentOrganization.inventoryPreferences?.allowNegativeStock || false,
    defaultBatchTracking: currentOrganization.inventoryPreferences?.defaultBatchTracking ?? true,
    defaultSerialTracking: currentOrganization.inventoryPreferences?.defaultSerialTracking ?? false,
    defaultExpiryTracking: currentOrganization.inventoryPreferences?.defaultExpiryTracking ?? false,

    // Documents
    receiptPrefix: currentOrganization.documentPrefixes?.receiptPrefix || 'RCV',
    issuePrefix: currentOrganization.documentPrefixes?.issuePrefix || 'ISS',
    transferPrefix: currentOrganization.documentPrefixes?.transferPrefix || 'TRF',
    adjustmentPrefix: currentOrganization.documentPrefixes?.adjustmentPrefix || 'ADJ',
    returnPrefix: currentOrganization.documentPrefixes?.returnPrefix || 'RTN',
  });

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    roleId: roles[0]?.id || 'role_worker',
  });

  // Custom role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [customRoleForm, setCustomRoleForm] = useState<{
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    permissions: TenantPermission[];
  }>({
    nameAr: '',
    nameEn: '',
    descriptionAr: '',
    descriptionEn: '',
    permissions: ['VIEW_INVENTORY', 'RECEIVE', 'ISSUE'],
  });

  // Copied token state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Save changes handler
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateOrganization(currentOrganization.id, {
        name: formState.name,
        nameAr: formState.nameAr,
        nameEn: formState.nameEn,
        legalName: formState.legalName,
        country: formState.country,
        city: formState.city,
        address: formState.address,
        phone: formState.phone,
        email: formState.email,
        website: formState.website,
        logo: formState.logo,
        currency: formState.currency,
        timezone: formState.timezone,
        defaultLanguage: formState.defaultLanguage as any,
        dateFormat: formState.dateFormat,
        weightUnit: formState.weightUnit as any,
        inventoryPreferences: {
          defaultCurrency: formState.currency,
          defaultWeightUnit: formState.weightUnit as any,
          defaultQuantityUnit: formState.defaultQuantityUnit,
          allowNegativeStock: formState.allowNegativeStock,
          defaultBatchTracking: formState.defaultBatchTracking,
          defaultSerialTracking: formState.defaultSerialTracking,
          defaultExpiryTracking: formState.defaultExpiryTracking,
        },
        documentPrefixes: {
          receiptPrefix: formState.receiptPrefix,
          issuePrefix: formState.issuePrefix,
          transferPrefix: formState.transferPrefix,
          adjustmentPrefix: formState.adjustmentPrefix,
          returnPrefix: formState.returnPrefix,
          countPrefix: 'CNT',
        },
      });
      showToast('success', isRTL ? 'تم حفظ التعديلات بنجاح' : 'Settings saved successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Error saving settings');
    }
  };

  // Invite handler
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inviteEmployee(inviteForm);
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', roleId: roles[0]?.id || 'role_worker' });
      showToast('success', isRTL ? 'تم إرسال الدعوة بنجاح' : 'Employee invitation sent');
    } catch (err: any) {
      showToast('error', err.message || 'Error sending invite');
    }
  };

  // Custom role handler
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCustomRole(customRoleForm);
      setShowRoleModal(false);
      setCustomRoleForm({
        nameAr: '',
        nameEn: '',
        descriptionAr: '',
        descriptionEn: '',
        permissions: ['VIEW_INVENTORY', 'RECEIVE', 'ISSUE'],
      });
      showToast('success', isRTL ? 'تم إنشاء الدور المخصص بنجاح' : 'Custom role created');
    } catch (err: any) {
      showToast('error', err.message || 'Error creating custom role');
    }
  };

  // Archive organization handler
  const handleArchive = async () => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من أرشفة هذه المنشأة؟ ستبقى البيانات محفوظة لكن سيتم قفل العمليات.' : 'Are you sure you want to archive this organization? Historical data will be preserved.')) {
      return;
    }
    try {
      await archiveOrganization(currentOrganization.id);
      showToast('success', isRTL ? 'تمت أرشفة المنشأة بنجاح' : 'Organization archived');
    } catch (err: any) {
      showToast('error', err.message || 'Error archiving organization');
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40 border border-cyan-500/30 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              TENANT: {currentOrganization.slug?.toUpperCase() || currentOrganization.id}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                currentOrganization.status === 'ACTIVE'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : currentOrganization.status === 'ARCHIVED'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}
            >
              STATUS: {currentOrganization.status}
            </span>
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-cyan-400" />
            <span>{isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {isRTL
              ? 'إدارة إعدادات المنشأة، دعوة الموظفين، تحديد الأدوار والصلاحيات، وتخصيص هوية المستودع.'
              : 'Configure tenant profile, employee invitations, role-based access control, and preferences.'}
          </p>
        </div>

        <button
          onClick={refreshTenantData}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isRTL ? 'تحديث البيانات' : 'Refresh'}</span>
        </button>
      </div>

      {/* Toast Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2 text-xs font-bold">
        {[
          { id: 'GENERAL', labelAr: 'البيانات العامة', labelEn: 'General', icon: Building2 },
          { id: 'BRANDING', labelAr: 'الهوية والشعار', labelEn: 'Branding', icon: Sliders },
          { id: 'LOCALIZATION', labelAr: 'اللغة والعملة', labelEn: 'Localization', icon: Globe },
          { id: 'INVENTORY', labelAr: 'تفضيلات المخزون', labelEn: 'Inventory', icon: Boxes },
          { id: 'DOCUMENTS', labelAr: 'أكواد المستندات', labelEn: 'Documents', icon: FileText },
          { id: 'USERS', labelAr: 'الموظفون والأعضاء', labelEn: 'Members', icon: Users },
          { id: 'INVITATIONS', labelAr: 'الدعوات المعلقة', labelEn: 'Invitations', icon: Mail },
          { id: 'ROLES', labelAr: 'الأدوار والصلاحيات', labelEn: 'Roles & RBAC', icon: ShieldCheck },
          { id: 'MODULES', labelAr: 'الوحدات الاختيارية', labelEn: 'Modules', icon: Layers },
          { id: 'BILLING', labelAr: 'الاشتراك والفوترة', labelEn: 'Billing & Plan', icon: CreditCard },
          { id: 'SECURITY', labelAr: 'الأمان ودورة الحياة', labelEn: 'Security & Lifecycle', icon: Lock },
          { id: 'INTEGRATIONS', labelAr: 'الربط البرمجي (API)', labelEn: 'Integrations & API', icon: Key },
          { id: 'AUDIT', labelAr: 'سجل التدقيق', labelEn: 'Audit Trail', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'GENERAL' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'معلومات الشركة الأساسية' : 'Company Profile & Contacts'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'اسم الشركة (العربية)' : 'Company Name (Arabic)'}</label>
              <input
                type="text"
                value={formState.nameAr}
                onChange={(e) => setFormState({ ...formState, nameAr: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'اسم الشركة (الإنجليزية)' : 'Company Name (English)'}</label>
              <input
                type="text"
                value={formState.nameEn}
                onChange={(e) => setFormState({ ...formState, nameEn: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم التجاري / القانوني المسجل' : 'Legal Business Entity Name'}</label>
              <input
                type="text"
                value={formState.legalName}
                onChange={(e) => setFormState({ ...formState, legalName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الدولة' : 'Country'}</label>
              <input
                type="text"
                value={formState.country}
                onChange={(e) => setFormState({ ...formState, country: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المدينة' : 'City'}</label>
              <input
                type="text"
                value={formState.city}
                onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-slate-400 font-semibold">{isRTL ? 'العنوان الفعلي' : 'Physical Address'}</label>
              <input
                type="text"
                value={formState.address}
                onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الهاتف' : 'Phone'}</label>
              <input
                type="text"
                value={formState.phone}
                onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الموقع الإلكتروني' : 'Website'}</label>
              <input
                type="text"
                value={formState.website}
                onChange={(e) => setFormState({ ...formState, website: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 cursor-pointer"
            >
              {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: BRANDING */}
      {activeTab === 'BRANDING' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'الهوية البصرية وشعار المنشأة' : 'Branding & Corporate Identity'}</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'رابط الشعار (Logo URL)' : 'Logo Image URL'}</label>
              <input
                type="text"
                placeholder="https://example.com/logo.png"
                value={formState.logo}
                onChange={(e) => setFormState({ ...formState, logo: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>

            {formState.logo && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 inline-block">
                <span className="text-[10px] text-slate-500 block mb-2">{isRTL ? 'معاينة الشعار' : 'Logo Preview'}</span>
                <img
                  src={formState.logo}
                  alt="Logo preview"
                  className="h-12 w-auto max-w-xs object-contain"
                  onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
            >
              {isRTL ? 'حفظ الهوية' : 'Save Branding'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: LOCALIZATION */}
      {activeTab === 'LOCALIZATION' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'التوطين واللغة والعملات' : 'Localization, Currency & Formats'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'اللغة الافتراضية' : 'Default Language'}</label>
              <select
                value={formState.defaultLanguage}
                onChange={(e) => setFormState({ ...formState, defaultLanguage: e.target.value as any })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="ar">العربية (Arabic)</option>
                <option value="en">English (الإنجليزية)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'العملة الأساسية' : 'Base Currency'}</label>
              <select
                value={formState.currency}
                onChange={(e) => setFormState({ ...formState, currency: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="USD">USD ($)</option>
                <option value="SAR">SAR (ر.س)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="IQD">IQD (د.ع)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المنطقة الزمنية' : 'Timezone'}</label>
              <input
                type="text"
                value={formState.timezone}
                onChange={(e) => setFormState({ ...formState, timezone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'صيغة التاريخ' : 'Date Format'}</label>
              <select
                value={formState.dateFormat}
                onChange={(e) => setFormState({ ...formState, dateFormat: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
            >
              {isRTL ? 'حفظ إعدادات التوطين' : 'Save Localization'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: INVENTORY */}
      {activeTab === 'INVENTORY' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Boxes className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'سياسات وقواعد المخزون' : 'Inventory Policies & Guardrails'}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'وحدة قياس الوزن' : 'Default Weight Unit'}</label>
              <select
                value={formState.weightUnit}
                onChange={(e) => setFormState({ ...formState, weightUnit: e.target.value as any })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="KG">Kilogram (KG)</option>
                <option value="MT">Metric Ton (MT)</option>
                <option value="LBS">Pounds (LBS)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'السماح بالمخزون السالب' : 'Allow Negative Stock'}</label>
              <select
                value={formState.allowNegativeStock ? 'YES' : 'NO'}
                onChange={(e) => setFormState({ ...formState, allowNegativeStock: e.target.value === 'YES' })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="NO">{isRTL ? 'ممنوع (حماية صارمة للرصيد الفعلي)' : 'Strict No (Strict ledger guard)'}</option>
                <option value="YES">{isRTL ? 'مسموح' : 'Allowed'}</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 sm:col-span-2">
              <h4 className="font-bold text-white text-xs">{isRTL ? 'خيارات التتبع الافتراضية للأصناف الجديدة' : 'Default Item Tracking Options'}</h4>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.defaultBatchTracking}
                    onChange={(e) => setFormState({ ...formState, defaultBatchTracking: e.target.checked })}
                    className="rounded text-cyan-500"
                  />
                  <span>{isRTL ? 'تتبع الوجبات (Batch)' : 'Batch Tracking'}</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.defaultSerialTracking}
                    onChange={(e) => setFormState({ ...formState, defaultSerialTracking: e.target.checked })}
                    className="rounded text-cyan-500"
                  />
                  <span>{isRTL ? 'الأرقام التسلسلية (Serial)' : 'Serial Tracking'}</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.defaultExpiryTracking}
                    onChange={(e) => setFormState({ ...formState, defaultExpiryTracking: e.target.checked })}
                    className="rounded text-cyan-500"
                  />
                  <span>{isRTL ? 'تاريخ الصلاحية (Expiry)' : 'Expiry Tracking'}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
            >
              {isRTL ? 'حفظ إعدادات المخزون' : 'Save Inventory Policies'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: DOCUMENTS */}
      {activeTab === 'DOCUMENTS' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'بادئات ترقيم المستندات (Prefixes)' : 'Document Number Prefixes'}</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الاستلام' : 'Receipt'}</label>
              <input
                type="text"
                value={formState.receiptPrefix}
                onChange={(e) => setFormState({ ...formState, receiptPrefix: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الصرف' : 'Issue'}</label>
              <input
                type="text"
                value={formState.issuePrefix}
                onChange={(e) => setFormState({ ...formState, issuePrefix: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المناقلة' : 'Transfer'}</label>
              <input
                type="text"
                value={formState.transferPrefix}
                onChange={(e) => setFormState({ ...formState, transferPrefix: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'التسوية' : 'Adjustment'}</label>
              <input
                type="text"
                value={formState.adjustmentPrefix}
                onChange={(e) => setFormState({ ...formState, adjustmentPrefix: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المردود' : 'Return'}</label>
              <input
                type="text"
                value={formState.returnPrefix}
                onChange={(e) => setFormState({ ...formState, returnPrefix: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer"
            >
              {isRTL ? 'حفظ البادئات' : 'Save Prefixes'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 6: USERS & MEMBERS */}
      {activeTab === 'USERS' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'أعضاء المنشأة ومستخدمو النظام' : 'Organization Members & Users'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'المستخدمون الذين لديهم وصول معتمد لهذه المنشأة' : 'Users authorized to operate under this tenant'}
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ دعوة موظف' : '+ Invite Member'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'المستخدم' : 'Member'}</th>
                  <th className="p-3 text-start">{isRTL ? 'البريد' : 'Email'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الدور الوظيفي' : 'Role'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-end">{isRTL ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-bold text-white">{m.name}</td>
                    <td className="p-3 text-slate-400 font-mono">{m.email}</td>
                    <td className="p-3">
                      <select
                        value={m.roleId}
                        onChange={(e) => updateMemberRole(m.id, e.target.value)}
                        className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-cyan-300 font-semibold"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nameEn}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : m.status === 'SUSPENDED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="p-3 text-end space-x-2 space-x-reverse">
                      <button
                        onClick={() =>
                          setMemberStatus(m.id, m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')
                        }
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                      >
                        {m.status === 'ACTIVE' ? (isRTL ? 'تعليق' : 'Suspend') : (isRTL ? 'تنشيط' : 'Activate')}
                      </button>
                      {m.roleKey !== 'OWNER' && (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: INVITATIONS */}
      {activeTab === 'INVITATIONS' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'الدعوات الصادرة' : 'Pending & Issued Invitations'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'الدعوات التي لم تقبل بعد من قبل الموظفين' : 'Sent invitations awaiting employee acceptance'}
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ دعوة جديدة' : '+ New Invitation'}</span>
            </button>
          </div>

          {invitations.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              {isRTL ? 'لا توجد دعوات معلقة حالياً' : 'No pending invitations.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'الاسم' : 'Name'}</th>
                    <th className="p-3 text-start">{isRTL ? 'البريد' : 'Email'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الدور' : 'Role'}</th>
                    <th className="p-3 text-start">{isRTL ? 'رمز الدعوة (Token)' : 'Token'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-end">{isRTL ? 'إلغاء' : 'Cancel'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{inv.name}</td>
                      <td className="p-3 text-slate-400 font-mono">{inv.email}</td>
                      <td className="p-3 text-cyan-300">{inv.roleName}</td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inv.token);
                            setCopiedToken(inv.id);
                            setTimeout(() => setCopiedToken(null), 2000);
                          }}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedToken === inv.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{inv.token.slice(0, 14)}...</span>
                        </button>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            inv.status === 'PENDING'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                              : inv.status === 'ACCEPTED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-3 text-end">
                        {inv.status === 'PENDING' && (
                          <button
                            onClick={() => cancelInvitation(inv.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-semibold cursor-pointer underline"
                          >
                            {isRTL ? 'إلغاء الدعوة' : 'Cancel'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: ROLES */}
      {activeTab === 'ROLES' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'إدارة الأدوار ومصفوفة الصلاحيات (RBAC)' : 'Roles & Permissions Matrix'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'الأدوار النظامية والأدوار المخصصة للمنشأة' : 'Standard and custom organization roles'}
              </p>
            </div>
            <button
              onClick={() => setShowRoleModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ دور مخصص' : '+ Custom Role'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => (
              <div key={r.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">{r.nameEn}</h4>
                  {r.isCustom && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-500/30">
                      CUSTOM
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{r.descriptionEn || r.descriptionAr}</p>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block mb-1.5 uppercase font-mono">{isRTL ? 'الصلاحيات الممنوحة:' : 'Granted Permissions:'}</span>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded text-[9px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-500/20"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: MODULES */}
      {activeTab === 'MODULES' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'تفعيل وإلغاء الوحدات البرمجية' : 'Enable / Disable Business Modules'}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {isRTL ? 'تخصيص الواجهات والعمليات المتاحة للمنشأة' : 'Toggle application areas specific to this company'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { key: 'weighbridge', labelAr: 'ميزان القبان الإلكتروني (Weighbridge)', labelEn: 'Weighbridge & Scale In' },
              { key: 'receiving', labelAr: 'استلام وتفريغ الشاحنات (Receiving)', labelEn: 'Inbound Receiving' },
              { key: 'storage', labelAr: 'إدارة المستودعات والرفوف (Storage)', labelEn: 'Warehouse Storage & Racks' },
              { key: 'production', labelAr: 'الإنتاج والتشغيل (Production)', labelEn: 'Production & Extrusion' },
              { key: 'recycling', labelAr: 'إعادة التدوير والثرم (Recycling)', labelEn: 'Recycling & Shredding' },
              { key: 'reconciler', labelAr: 'مطابقة الأرصدة التلقائية (Reconciler)', labelEn: 'Stock Ledger Reconciler' },
              { key: 'rfid', labelAr: 'تتبع الشلايف وRFID (Bulk Bags)', labelEn: 'Bulk Bags & RFID Tracking' },
              { key: 'predictive', labelAr: 'التنبؤ الذكي بالمخزون (Forecasting)', labelEn: 'Predictive Stock Forecasting' },
              { key: 'qualityControl', labelAr: 'مراقبة الجودة (Quality Control)', labelEn: 'Quality Inspection' },
              { key: 'maintenance', labelAr: 'الصيانة الوقائية (Maintenance)', labelEn: 'Equipment Maintenance' },
            ].map((m) => {
              const enabled = currentOrganization.enabledModules[m.key as keyof typeof currentOrganization.enabledModules] !== false;
              return (
                <div
                  key={m.key}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <span className="font-semibold text-white">{isRTL ? m.labelAr : m.labelEn}</span>
                  <button
                    onClick={() => {
                      updateOrganization(currentOrganization.id, {
                        enabledModules: {
                          ...currentOrganization.enabledModules,
                          [m.key]: !enabled,
                        },
                      });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      enabled
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {enabled ? (isRTL ? 'مفعل' : 'Enabled') : (isRTL ? 'معطل' : 'Disabled')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 10: SECURITY & LIFECYCLE */}
      {activeTab === 'SECURITY' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'أمان المنشأة وحالة دورة الحياة' : 'Tenant Security & Lifecycle'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'الحفاظ على سرية وعزل بيانات الشركة وأرشفة السجلات التاريخية.'
                : 'Enforce tenant isolation, session policies, and long-term compliance archiving.'}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-sm">{isRTL ? 'حالة المنشأة الحالية:' : 'Current Tenant Status:'}</h4>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                {currentOrganization.status}
              </span>
              <span className="text-xs text-slate-400">
                {isRTL ? 'جميع العمليات المستودعية نشطة' : 'Operations active & ledger operational'}
              </span>
            </div>
          </div>

          {/* Danger Zone: Archive */}
          <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3">
            <h4 className="font-bold text-rose-300 text-sm flex items-center gap-2">
              <Archive className="w-4 h-4" />
              <span>{isRTL ? 'أرشفة المنشأة (Archive Organization)' : 'Archive Organization'}</span>
            </h4>
            <p className="text-xs text-slate-300 max-w-xl">
              {isRTL
                ? 'أرشفة المنشأة لا تحذف البيانات نهائياً. يتم الاحتفاظ بكافة القيود والحركات التاريخية لأغراض التدقيق، لكن يتم منع الحركات الجديدة.'
                : 'Archiving preserves all historical inventory records for audit compliance, but prevents any further write operations.'}
            </p>
            <button
              onClick={handleArchive}
              className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-950/50 cursor-pointer"
            >
              {isRTL ? 'أرشفة المنشأة الآن' : 'Archive Organization'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 11: AUDIT TRAIL */}
      {activeTab === 'AUDIT' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'سجل تدقيق إجراءات المنشأة' : 'Organization Audit Trail'}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {isRTL
              ? 'سجل غير قابل للتعديل يوثق إنشاء المنشأة، الدعوات، تغيير الأدوار، وتعديل الإعدادات.'
              : 'Immutable record of organization creation, member updates, role modifications, and policy changes.'}
          </p>

          <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                {isRTL ? 'لا توجد سجلات تدقيق حتى الآن' : 'No audit records logged yet.'}
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3.5 hover:bg-slate-900/60 transition-colors flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-white font-medium">{log.details}</p>
                  </div>
                  <div className="text-end text-[11px] text-slate-400">
                    <span>{log.performerName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: INTEGRATIONS & API */}
      {activeTab === 'INTEGRATIONS' && (
        <div className="pt-2">
          <IntegrationsManagementTab />
        </div>
      )}

      {/* TAB: BILLING */}
      {activeTab === 'BILLING' && (
        <div className="pt-2">
          <BillingDashboardModule />
        </div>
      )}

      {/* MODAL: INVITE EMPLOYEE */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSendInvite}
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'دعوة موظف جديد' : 'Invite New Employee'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'اسم الموظف' : 'Full Name'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mansoor"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'البريد الإلكتروني' : 'Email Address'}</label>
                <input
                  type="email"
                  required
                  placeholder="tariq@example.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الدور الوظيفي' : 'Assigned Role'}</label>
                <select
                  value={inviteForm.roleId}
                  onChange={(e) => setInviteForm({ ...inviteForm, roleId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {isRTL ? 'إرسال الدعوة' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: CREATE CUSTOM ROLE */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateRole}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'إنشاء دور مخصص للمنشأة' : 'Create Custom Role'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">{isRTL ? 'اسم الدور (English)' : 'Role Name (En)'}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Night Shift Warehouse"
                    value={customRoleForm.nameEn}
                    onChange={(e) => setCustomRoleForm({ ...customRoleForm, nameEn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-semibold">{isRTL ? 'اسم الدور (العربية)' : 'Role Name (Ar)'}</label>
                  <input
                    type="text"
                    required
                    placeholder="وردية المستودع الليلية"
                    value={customRoleForm.nameAr}
                    onChange={(e) => setCustomRoleForm({ ...customRoleForm, nameAr: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الوصف' : 'Description'}</label>
                <input
                  type="text"
                  placeholder="Permissions for night operations"
                  value={customRoleForm.descriptionEn}
                  onChange={(e) => setCustomRoleForm({ ...customRoleForm, descriptionEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-slate-300 font-bold block">{isRTL ? 'تحديد الصلاحيات الممنوحة:' : 'Select Permissions:'}</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-xl border border-slate-800">
                  {[
                    'VIEW_INVENTORY',
                    'RECEIVE',
                    'ISSUE',
                    'TRANSFER',
                    'ADJUST',
                    'STOCK_COUNT',
                    'MANAGE_ITEMS',
                    'MANAGE_WAREHOUSES',
                    'MANAGE_LOCATIONS',
                    'MANAGE_SUPPLIERS',
                    'VIEW_REPORTS',
                    'MANAGE_USERS',
                    'MANAGE_SETTINGS',
                  ].map((perm) => {
                    const checked = customRoleForm.permissions.includes(perm as any);
                    return (
                      <label key={perm} className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCustomRoleForm({
                                ...customRoleForm,
                                permissions: [...customRoleForm.permissions, perm as any],
                              });
                            } else {
                              setCustomRoleForm({
                                ...customRoleForm,
                                permissions: customRoleForm.permissions.filter((p) => p !== perm),
                              });
                            }
                          }}
                          className="rounded text-cyan-500"
                        />
                        <span className="font-mono text-[11px] text-slate-300">{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {isRTL ? 'حفظ الدور' : 'Save Role'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
