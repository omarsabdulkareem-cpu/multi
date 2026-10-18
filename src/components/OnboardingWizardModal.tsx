import React, { useState } from 'react';
import {
  Building2,
  Warehouse,
  MapPin,
  Settings2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Layers,
  Boxes,
  ShieldCheck,
  Package,
  Globe,
  Sliders,
  Check,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { WarehouseEngineService } from '../services/warehouseEngineService';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (orgId: string) => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { isRTL } = useLanguage();
  const { createOrganization, switchOrganization } = useTenant();
  const { currentUser, setCurrentPage } = useFactory();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{
    orgId: string;
    orgName: string;
    warehouseName: string;
    locationCode: string;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 2: Company
    companyName: '',
    legalName: '',
    country: 'Saudi Arabia',
    city: 'Riyadh',
    address: '',
    phone: '',
    email: '',
    website: '',
    industry: 'Logistics',
    logo: '',

    // Step 3: Warehouse
    warehouseName: 'Main Central Warehouse',
    warehouseCode: 'WH-MAIN',
    warehouseAddress: '',
    warehouseCapacityKG: 150000,

    // Step 4: Storage Location
    firstLocationCode: 'MAIN-01',
    firstLocationName: 'Main Storage Bay 01',
    firstLocationType: 'RACK',

    // Step 5: Inventory Preferences
    currency: 'USD',
    weightUnit: 'KG' as 'KG' | 'LBS' | 'MT',
    quantityUnit: 'KG',
    defaultLanguage: 'ar' as 'ar' | 'en',
    allowNegativeStock: false,

    // Step 6: Optional Modules
    modules: {
      inventory: true,
      purchasing: true,
      suppliers: true,
      customers: true,
      production: false,
      manufacturing: false,
      barcode: true,
      batchTracking: true,
      serialTracking: false,
      expiryTracking: true,
      qualityControl: true,
    },
  });

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 7) setStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const toggleModule = (key: keyof typeof formData.modules) => {
    setFormData((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: !prev.modules[key],
      },
    }));
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const creator = {
        id: currentUser?.id || 'usr_owner_init',
        name: currentUser?.name || 'Organization Owner',
        email: formData.email || currentUser?.email || 'owner@company.com',
      };

      // 1. Create Organization
      const org = await createOrganization(
        {
          name: formData.companyName || 'My Warehouse Company',
          nameAr: formData.companyName,
          nameEn: formData.companyName,
          legalName: formData.legalName || formData.companyName,
          country: formData.country,
          city: formData.city,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          website: formData.website,
          currency: formData.currency,
          timezone: 'Asia/Riyadh',
          defaultLanguage: formData.defaultLanguage,
          weightUnit: formData.weightUnit,
          logo: formData.logo,
          optionalModules: formData.modules,
          inventoryPreferences: {
            defaultCurrency: formData.currency,
            defaultWeightUnit: formData.weightUnit,
            defaultQuantityUnit: formData.quantityUnit,
            allowNegativeStock: formData.allowNegativeStock,
            defaultBatchTracking: formData.modules.batchTracking,
            defaultSerialTracking: formData.modules.serialTracking,
            defaultExpiryTracking: formData.modules.expiryTracking,
          },
        },
        creator
      );

      // 2. Create Initial Warehouse under new Organization
      const wh = await WarehouseEngineService.createWarehouse(org.id, {
        code: formData.warehouseCode.toUpperCase(),
        name: formData.warehouseName,
        nameAr: formData.warehouseName,
        nameEn: formData.warehouseName,
        type: 'General',
        address: formData.warehouseAddress || formData.address,
        totalCapacityKG: Number(formData.warehouseCapacityKG) || 100000,
        status: 'ACTIVE',
      });

      // 3. Create Initial Storage Location under new Warehouse
      const loc = await WarehouseEngineService.createLocation(org.id, {
        warehouseId: wh.id,
        code: formData.firstLocationCode.toUpperCase(),
        name: formData.firstLocationName,
        nameAr: formData.firstLocationName,
        nameEn: formData.firstLocationName,
        type: (formData.firstLocationType as any) || 'RACK',
        capacityKG: 25000,
        status: 'ACTIVE',
      });

      // 4. Update Summary & Switch Active Tenant
      setCreatedSummary({
        orgId: org.id,
        orgName: org.name || org.nameEn,
        warehouseName: wh.name,
        locationCode: loc.code,
      });

      switchOrganization(org.id);
      setStep(7); // Jump to summary celebration step
    } catch (err: any) {
      alert(err.message || 'Error completing onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteAndLaunch = () => {
    onClose();
    if (onComplete && createdSummary) {
      onComplete(createdSummary.orgId);
    }
    setCurrentPage('dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 text-white my-8">
        {/* Header Progress Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isRTL ? 'معالج إعداد المنشأة والمستودع' : 'Warehouse Onboarding Wizard'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? `المرحلة ${step} من 7` : `Step ${step} of 7`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bullets */}
        <div className="flex items-center gap-1.5 justify-between">
          {[1, 2, 3, 4, 5, 6, 7].map((num) => (
            <div
              key={num}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                num < step
                  ? 'bg-emerald-500'
                  : num === step
                  ? 'bg-cyan-500'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* ================================================================== */}
        {/* STEP 1: WELCOME */}
        {/* ================================================================== */}
        {step === 1 && (
          <div className="text-center py-6 space-y-5">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-xl shadow-cyan-500/20">
              <Building2 className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {isRTL ? 'مرحباً بك! لنقم بتهيئة مستودعك الجديد' : "Let's set up your warehouse"}
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                {isRTL
                  ? 'قم بإدخال بيانات منشأتك، تعريف أول مستودع وموقع تخزين، وتفعيل الوحدات المناسبة لطبيعة عملك في دقائق معدودة.'
                  : 'In just a few simple steps, create your private isolated organization, initial warehouse, storage racks, and operational preferences.'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-start max-w-lg mx-auto pt-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <div className="font-bold text-white">{isRTL ? 'عزل كامل' : 'Total Isolation'}</div>
                <div className="text-[10px] text-slate-400">{isRTL ? 'بيانات خاصة 100%' : '100% private tenant'}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <div className="font-bold text-white">{isRTL ? 'دفتر قيود دقيق' : 'Real Ledger'}</div>
                <div className="text-[10px] text-slate-400">{isRTL ? 'حركات غير قابلة للتلاعب' : 'Audit-proven balance'}</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                <Globe className="w-4 h-4 text-blue-400" />
                <div className="font-bold text-white">{isRTL ? 'دعم العملات' : 'Multi-Currency'}</div>
                <div className="text-[10px] text-slate-400">{isRTL ? 'تخصيص كامل' : 'Fully localized'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 2: COMPANY INFORMATION */}
        {/* ================================================================== */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-lg text-white">
                {isRTL ? 'بيانات المنشأة / الشركة' : 'Company Information'}
              </h4>
              <p className="text-xs text-slate-400">
                {isRTL ? 'أدخل الاسم القانوني وبيانات الاتصال' : 'Enter registered company and contact information'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-300 font-semibold">{isRTL ? 'اسم الشركة *' : 'Company Name *'}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Basha International Trading"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'الاسم القانوني' : 'Legal Company Name'}</label>
                <input
                  type="text"
                  placeholder="e.g. Al-Basha Trading FZCO"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'الدولة' : 'Country'}</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'المدينة' : 'City'}</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'رقم الهاتف' : 'Phone Number'}</label>
                <input
                  type="tel"
                  placeholder="+966 50 123 4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'البريد الإلكتروني' : 'Official Email'}</label>
                <input
                  type="email"
                  placeholder="info@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'الموقع الإلكتروني' : 'Website'}</label>
                <input
                  type="url"
                  placeholder="https://company.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-300 font-semibold">{isRTL ? 'العنوان' : 'Address'}</label>
                <input
                  type="text"
                  placeholder="Industrial City, Street 14"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 3: WAREHOUSE SETUP */}
        {/* ================================================================== */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-lg text-white">
                {isRTL ? 'إعداد المستودع الرئيسي' : 'Primary Warehouse Setup'}
              </h4>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تعريف أول منشأة تخزينية تابعة للمنظمة' : 'Define your organization first storage warehouse facility'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-300 font-semibold">{isRTL ? 'اسم المستودع *' : 'Warehouse Name *'}</label>
                <input
                  type="text"
                  required
                  value={formData.warehouseName}
                  onChange={(e) => setFormData({ ...formData, warehouseName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'كود المستودع *' : 'Warehouse Code *'}</label>
                <input
                  type="text"
                  required
                  value={formData.warehouseCode}
                  onChange={(e) => setFormData({ ...formData, warehouseCode: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'الطاقة الاستيعابية (كغم)' : 'Total Capacity (KG)'}</label>
                <input
                  type="number"
                  value={formData.warehouseCapacityKG}
                  onChange={(e) => setFormData({ ...formData, warehouseCapacityKG: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-300 font-semibold">{isRTL ? 'عنوان المستودع' : 'Warehouse Address'}</label>
                <input
                  type="text"
                  placeholder="Gate 3, Logistics Park"
                  value={formData.warehouseAddress}
                  onChange={(e) => setFormData({ ...formData, warehouseAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 4: STORAGE LOCATION SETUP */}
        {/* ================================================================== */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-lg text-white">
                {isRTL ? 'إعداد أول موقع تخزين (Location)' : 'Initial Storage Location'}
              </h4>
              <p className="text-xs text-slate-400">
                {isRTL ? 'يمكنك البدء بموقع تخزين بسيط مثل MAIN-01' : 'A small company can start with a simple location like MAIN-01'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'كود الموقع *' : 'Location Code *'}</label>
                <input
                  type="text"
                  required
                  value={formData.firstLocationCode}
                  onChange={(e) => setFormData({ ...formData, firstLocationCode: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'نوع الموقع' : 'Location Type'}</label>
                <select
                  value={formData.firstLocationType}
                  onChange={(e) => setFormData({ ...formData, firstLocationType: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="RACK">Rack (رف / قاطع)</option>
                  <option value="BIN">Bin (صندوق / حاوية)</option>
                  <option value="ZONE">Zone (منطقة / ساحة)</option>
                  <option value="SHELF">Shelf (مستوى)</option>
                </select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-slate-300 font-semibold">{isRTL ? 'اسم أو وصف الموقع' : 'Location Name / Description'}</label>
                <input
                  type="text"
                  value={formData.firstLocationName}
                  onChange={(e) => setFormData({ ...formData, firstLocationName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 5: INVENTORY PREFERENCES */}
        {/* ================================================================== */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-lg text-white">
                {isRTL ? 'تفضيلات المخزون والعملة' : 'Inventory & Currency Preferences'}
              </h4>
              <p className="text-xs text-slate-400">
                {isRTL ? 'حدد العملة الافتراضية، وحدات الوزن، ولغة الواجهة' : 'Set your default currency, weight unit, and language'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'العملة الافتراضية' : 'Default Currency'}</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="SAR">SAR (ر.س)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="IQD">IQD (د.ع)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'وحدة الوزن الافتراضية' : 'Default Weight Unit'}</label>
                <select
                  value={formData.weightUnit}
                  onChange={(e) => setFormData({ ...formData, weightUnit: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="KG">Kilogram (KG)</option>
                  <option value="MT">Metric Ton (MT)</option>
                  <option value="LBS">Pounds (LBS)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'لغة الواجهة الافتراضية' : 'Default Language'}</label>
                <select
                  value={formData.defaultLanguage}
                  onChange={(e) => setFormData({ ...formData, defaultLanguage: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="ar">العربية (Arabic)</option>
                  <option value="en">English (الإنجليزية)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">{isRTL ? 'السماح بالمخزون السالب' : 'Allow Negative Inventory'}</label>
                <select
                  value={formData.allowNegativeStock ? 'YES' : 'NO'}
                  onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.value === 'YES' })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="NO">{isRTL ? 'ممنوع (حماية من الرصيد السالب)' : 'Strict No (Strict ledger guard)'}</option>
                  <option value="YES">{isRTL ? 'مسموح مؤقتاً' : 'Allowed'}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 6: OPTIONAL MODULES */}
        {/* ================================================================== */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-lg text-white">
                {isRTL ? 'تفعيل الوحدات البرمجية الاختيارية' : 'Optional Business Modules'}
              </h4>
              <p className="text-xs text-slate-400">
                {isRTL ? 'اختر الوحدات التي تحتاجها شركتك، ولا تفرض على نفسك ما لا يلزمك' : 'Enable only the modules your company uses'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pe-1">
              {[
                { key: 'inventory', labelAr: 'إدارة المخزون (Inventory)', labelEn: 'Inventory Management' },
                { key: 'purchasing', labelAr: 'المشتريات والتوريد (Purchasing)', labelEn: 'Purchasing Orders' },
                { key: 'suppliers', labelAr: 'دليل الموردين (Suppliers)', labelEn: 'Supplier Master' },
                { key: 'customers', labelAr: 'العملاء والشحن (Customers)', labelEn: 'Customer Shipping' },
                { key: 'production', labelAr: 'الإنتاج والتشغيل (Production)', labelEn: 'Production & Extrusion' },
                { key: 'manufacturing', labelAr: 'التصنيع والتجميع (Manufacturing)', labelEn: 'Manufacturing Runs' },
                { key: 'barcode', labelAr: 'الباركود وQR كود (Barcode & QR)', labelEn: 'Barcode & QR Scanning' },
                { key: 'batchTracking', labelAr: 'تتبع الوجبات (Batch Tracking)', labelEn: 'Batch / Lot Tracking' },
                { key: 'serialTracking', labelAr: 'الأرقام التسلسلية (Serial Numbers)', labelEn: 'Serial Number Tracking' },
                { key: 'expiryTracking', labelAr: 'تاريخ الصلاحية (Expiry Tracking)', labelEn: 'Expiry Date Management' },
                { key: 'qualityControl', labelAr: 'فحص الجودة (Quality Control)', labelEn: 'Quality Inspection' },
              ].map((item) => {
                const isChecked = formData.modules[item.key as keyof typeof formData.modules];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleModule(item.key as any)}
                    className={`p-3 rounded-xl border text-start flex items-center justify-between transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-semibold">
                      {isRTL ? item.labelAr : item.labelEn}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                        isChecked
                          ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                          : 'border-slate-700'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 7: FINISH & SUMMARY */}
        {/* ================================================================== */}
        {step === 7 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-white">
                {isRTL ? 'تهانينا! اكتمل إعداد المنشأة بنجاح' : 'Congratulations! Your Organization is Ready'}
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تم إنشاء السجلات الأساسية وتم تعيينك كمالك للمنظمة' : 'All assets initialized and you are assigned as Organization Owner'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-start max-w-md mx-auto space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">{isRTL ? 'المنشأة:' : 'Organization:'}</span>
                <span className="font-bold text-white">{createdSummary?.orgName || formData.companyName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">{isRTL ? 'معرف المنشأة (ID):' : 'Organization ID:'}</span>
                <span className="font-mono text-cyan-300 font-bold">{createdSummary?.orgId}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">{isRTL ? 'المستودع الرئيسي:' : 'Main Warehouse:'}</span>
                <span className="font-semibold text-slate-200">{createdSummary?.warehouseName || formData.warehouseName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isRTL ? 'موقع التخزين الأول:' : 'Initial Location:'}</span>
                <span className="font-mono text-emerald-400 font-bold">{createdSummary?.locationCode || formData.firstLocationCode}</span>
              </div>
            </div>

            <button
              onClick={handleCompleteAndLaunch}
              className="w-full max-w-md mx-auto py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isRTL ? 'الانتقال إلى لوحة تحكم المنشأة' : 'Launch Organization Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        {step < 7 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{isRTL ? 'السابق' : 'Back'}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={step === 2 && !formData.companyName.trim()}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-cyan-900/30"
              >
                <span>{isRTL ? 'التالي' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={isSubmitting || !formData.companyName.trim()}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-emerald-900/30"
              >
                <span>{isSubmitting ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنهاء وحفظ المنشأة' : 'Complete Setup')}</span>
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
