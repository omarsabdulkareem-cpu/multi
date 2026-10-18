import React, { useState } from 'react';
import {
  Sparkles,
  Building2,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Boxes,
  ShieldCheck,
  Scale,
  Globe,
  Coins,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTenant } from '../../context/TenantContext';
import { useFactory } from '../../context/FactoryContext';
import { PlatformService } from '../../services/platformService';
import { PublicFunnelService, SUPPORTED_CURRENCIES } from '../../services/publicFunnelService';
import { PlanTier } from '../../types/saas';
import { PublicNavRoute } from './PublicNavbar';

interface PublicSignupPageProps {
  initialPlanTier?: PlanTier;
  onNavigate: (route: PublicNavRoute) => void;
  onSignupSuccess: () => void;
  selectedCurrency: string;
}

export const PublicSignupPage: React.FC<PublicSignupPageProps> = ({
  initialPlanTier = 'PROFESSIONAL',
  onNavigate,
  onSignupSuccess,
  selectedCurrency,
}) => {
  const { isRTL } = useLanguage();
  const { switchOrganization, refreshTenantData } = useTenant();
  const { emergencyBypassAuth } = useFactory();
  const platformSettings = PlatformService.getPlatformSettings();

  // Wizard Steps: 1: Account -> 2: Company -> 3: Plan -> 4: Provisioning & Done
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [companyNameAr, setCompanyNameAr] = useState('');
  const [country, setCountry] = useState('Saudi Arabia');
  const [currency, setCurrency] = useState(selectedCurrency || 'SAR');
  const [primaryWarehouseName, setPrimaryWarehouseName] = useState('Central Warehouse 01');
  const [industry, setIndustry] = useState('Plastics & Recycling');
  const [weightUnit, setWeightUnit] = useState<'KG' | 'LBS' | 'MT'>('KG');

  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(initialPlanTier);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');

  // Loading & Provisioning State
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState(0);
  const [provisionStepText, setProvisionStepText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-fill Arabic company name if empty when moving to step 2
  const handleProceedToStep2 = () => {
    if (!adminName.trim() || !adminEmail.trim()) {
      setErrorMsg(
        isRTL
          ? 'يرجى إدخال اسم المسؤول والبريد الإلكتروني.'
          : 'Please enter admin full name and work email.'
      );
      return;
    }
    setErrorMsg(null);
    if (!companyName) {
      setCompanyName(`${adminName.split(' ')[0]}'s Logistics`);
    }
    setCurrentStep(2);
  };

  const handleProceedToStep3 = () => {
    if (!companyName.trim()) {
      setErrorMsg(
        isRTL
          ? 'يرجى إدخال اسم الشركة أو المنشأة.'
          : 'Please enter company or facility name.'
      );
      return;
    }
    setErrorMsg(null);
    setCurrentStep(3);
  };

  const handleExecuteProvisioning = async () => {
    setIsProvisioning(true);
    setCurrentStep(4);
    setErrorMsg(null);
    setProvisionProgress(15);
    setProvisionStepText(
      isRTL ? 'تهيئة المنشأة السحابية وتعيين صلاحيات المسؤول...' : 'Creating tenant organization & owner RBAC...'
    );

    try {
      await new Promise((r) => setTimeout(r, 600));
      setProvisionProgress(40);
      setProvisionStepText(
        isRTL ? 'إنشاء المستودع الرئيسي ومواقع التخزين والأرفف...' : 'Provisioning primary warehouse & storage zones...'
      );

      await new Promise((r) => setTimeout(r, 600));
      setProvisionProgress(70);
      setProvisionStepText(
        isRTL ? 'تفعيل اشتراك التجربة المجانية 14 يوماً...' : 'Initializing 14-day free trial subscription...'
      );

      const result = await PublicFunnelService.processCustomerSelfServiceSignup({
        adminName,
        adminEmail,
        adminPassword,
        companyName,
        companyNameAr: companyNameAr || companyName,
        country,
        currency,
        primaryWarehouseName,
        industry,
        weightUnit,
        planTier: selectedPlan,
        billingCycle,
      });

      await new Promise((r) => setTimeout(r, 600));
      setProvisionProgress(95);
      setProvisionStepText(
        isRTL ? 'تسجيل الدخول التلقائي وتهيئة واجهة العمل...' : 'Auto-authenticating and loading command center...'
      );

      // Auto sign in and activate new tenant
      await emergencyBypassAuth();
      switchOrganization(result.organization.id);
      refreshTenantData();

      await new Promise((r) => setTimeout(r, 400));
      setProvisionProgress(100);

      // Successfully provisioned -> Enter Workspace!
      onSignupSuccess();
    } catch (err: any) {
      setIsProvisioning(false);
      setCurrentStep(3);
      setErrorMsg(err.message || 'Provisioning failed. Please retry.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isRTL ? 'إطلاق فوري في دقيقة واحدة' : 'INSTANT 60-SECOND ONBOARDING'}</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-white">
          {isRTL ? 'ابدأ تجربة مجانية كاملة 14 يوماً' : 'Start Your 14-Day Free Trial'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          {isRTL
            ? 'بدون بطاقة ائتمان. يمكنك تهيئة مستودعك والبدء في تسجيل الأوزان وحركات المخزون فوراً.'
            : 'No credit card required. Full unrestricted access to real-time inventory ledger and scale modules.'}
        </p>

        {/* Wizard Steps Bar */}
        <div className="flex items-center justify-center gap-3 pt-4">
          {[
            { step: 1, labelEn: '1. Admin Account', labelAr: '1. حساب المسؤول' },
            { step: 2, labelEn: '2. Organization', labelAr: '2. بيانات المنشأة' },
            { step: 3, labelEn: '3. Plan Tier', labelAr: '3. اختيار الخطة' },
          ].map((s) => (
            <div
              key={s.step}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                currentStep === s.step
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : currentStep > s.step
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-white/5 text-slate-500 border-white/5'
              }`}
            >
              {currentStep > s.step ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : null}
              <span>{isRTL ? s.labelAr : s.labelEn}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Form Container */}
      <div className="p-8 sm:p-10 rounded-3xl bg-[#0c101c] border border-white/10 shadow-2xl relative">
        {errorMsg && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Admin Account */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'الخطوة 1: بيانات مسؤول النظام' : 'Step 1: Admin Account Credentials'}</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isRTL ? 'الاسم الكامل للمسؤول *' : 'Administrator Full Name *'}
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Omar Abdulkarim / عمر عبدالكريم"
                className="w-full px-4 py-3 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isRTL ? 'البريد الإلكتروني للعمل *' : 'Work Email Address *'}
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="w-full px-4 py-3 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isRTL ? 'كلمة المرور' : 'Password (Optional for Demo)'}
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {isRTL
                  ? 'يمكنك تسجيل الدخول بكلمة المرور أو عبر حساب Google لاحقاً.'
                  : 'You can sign in with password or Google Workspace anytime.'}
              </p>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => onNavigate('login')}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                {isRTL ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'Already have an account? Sign In'}
              </button>

              <button
                onClick={handleProceedToStep2}
                className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-lg shadow-cyan-500/20"
              >
                <span>{isRTL ? 'متابعة لبيانات المنشأة' : 'Continue to Organization'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Company Setup */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'الخطوة 2: إعدادات المنشأة والمستودع الأول' : 'Step 2: Company & Primary Facility'}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'اسم الشركة (English) *' : 'Company Name (English) *'}
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Apex Global Logistics"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'اسم الشركة (العربية)' : 'Company Name (Arabic)'}
                </label>
                <input
                  type="text"
                  value={companyNameAr}
                  onChange={(e) => setCompanyNameAr(e.target.value)}
                  placeholder="شركة أبيكس للخدمات اللوجستية"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'اسم المستودع أو المرفق الأول *' : 'Primary Warehouse Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={primaryWarehouseName}
                  onChange={(e) => setPrimaryWarehouseName(e.target.value)}
                  placeholder="Central Logistics Hub 01"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'القطاع والنشاط التشغيلي' : 'Industry Vertical'}
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                >
                  <option value="Plastics & Recycling">Plastics & Recycling / تدوير البلاستيك</option>
                  <option value="Manufacturing">Manufacturing & Assembly / تصنيع وإنتاج</option>
                  <option value="FMCG & Food">FMCG & Food Storage / أغذية ومواد استهلاكية</option>
                  <option value="Wholesale">Wholesale & Distribution / تجارة وتوزيع جملة</option>
                  <option value="3PL Logistics">3PL Logistics Hub / خدمات لوجستية للغير</option>
                  <option value="General Storage">General Warehouse / مستودع عام</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'الدولة' : 'Country'}
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                >
                  <option value="Saudi Arabia">Saudi Arabia / السعودية</option>
                  <option value="United Arab Emirates">UAE / الإمارات</option>
                  <option value="Iraq">Iraq / العراق</option>
                  <option value="Kuwait">Kuwait / الكويت</option>
                  <option value="Qatar">Qatar / قطر</option>
                  <option value="Jordan">Jordan / الأردن</option>
                  <option value="Egypt">Egypt / مصر</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'عملة الحساب الأساسية' : 'Operating Currency'}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {isRTL ? c.nameAr : c.nameEn} ({isRTL ? c.symbolAr : c.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {isRTL ? 'وحدة الوزن الافتراضية' : 'Weight Unit'}
                </label>
                <select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                >
                  <option value="KG">KG (Kilograms) / كغ</option>
                  <option value="MT">MT (Metric Tons) / طن متري</option>
                  <option value="LBS">LBS (Pounds) / رطل</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isRTL ? 'السابق' : 'Back'}</span>
              </button>

              <button
                onClick={handleProceedToStep3}
                className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-lg shadow-cyan-500/20"
              >
                <span>{isRTL ? 'متابعة لاختيار الخطة' : 'Continue to Plan Selection'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Plan Selection */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'الخطوة 3: اختر باقة التجربة المجانية 14 يوماً' : 'Step 3: Select Your 14-Day Free Trial Tier'}</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  tier: 'STARTER' as PlanTier,
                  titleEn: 'Starter',
                  titleAr: 'البداية',
                  usd: 79,
                  descEn: 'Up to 2 warehouses, 5 users, core ledger.',
                  descAr: 'حتى 2 مستودع، 5 مستخدمين، وسجل المخزن.',
                },
                {
                  tier: 'PROFESSIONAL' as PlanTier,
                  titleEn: 'Professional',
                  titleAr: 'الاحترافية (شائع)',
                  usd: 199,
                  popular: true,
                  descEn: 'Up to 5 warehouses, weighbridge & batch tracking.',
                  descAr: 'حتى 5 مستودعات، أتمتة الميزان وتتبع الدفعات.',
                },
                {
                  tier: 'BUSINESS' as PlanTier,
                  titleEn: 'Business',
                  titleAr: 'الأعمال',
                  usd: 399,
                  descEn: 'Up to 15 warehouses, BOM, recycling & jumbo bags.',
                  descAr: 'حتى 15 مستودعاً، التصنيع والتدوير والأكياس الكبيرة.',
                },
              ].map((p) => {
                const isSelected = selectedPlan === p.tier;
                return (
                  <div
                    key={p.tier}
                    onClick={() => setSelectedPlan(p.tier)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-400 shadow-xl shadow-cyan-500/10'
                        : 'bg-[#111624] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      {p.popular && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 uppercase mb-2 inline-block">
                          {isRTL ? 'الأكثر طلباً' : 'RECOMMENDED'}
                        </span>
                      )}
                      <div className="text-sm font-bold text-white">
                        {isRTL ? p.titleAr : p.titleEn}
                      </div>
                      <div className="mt-2 text-xl font-black font-mono text-cyan-300">
                        {PublicFunnelService.formatPrice(p.usd, currency, isRTL)}
                        <span className="text-[10px] text-slate-400 font-sans font-normal">
                          /{isRTL ? 'شهر' : 'mo'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                        {isRTL ? p.descAr : p.descEn}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 text-xs font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isRTL ? '14 يوماً مجاناً' : '14-Day Free Trial'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trial Guarantee Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="font-bold">
                  {isRTL ? 'ضمان التجربة المجانية الكاملة:' : 'Zero-Risk Evaluation Guarantee:'}
                </span>{' '}
                {isRTL
                  ? 'لن يتم مطالبتك ببطاقة ائتمانية. تنتهي التجربة تلقائياً بعد 14 يوماً وتدخل في فترة سماح 7 أيام لحماية بياناتك.'
                  : 'No payment info required upfront. Following 14 days, you enter a safe 7-day read-only grace period with zero data loss.'}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isRTL ? 'السابق' : 'Back'}</span>
              </button>

              <button
                onClick={handleExecuteProvisioning}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-xl shadow-cyan-900/40 cursor-pointer transition transform hover:-translate-y-0.5 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isRTL ? 'تأكيد وإنشاء المنشأة السحابية الآن' : 'Launch My Warehouse SaaS Now'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Automated Provisioning Progress */}
        {currentStep === 4 && (
          <div className="py-12 text-center space-y-6 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-xl shadow-cyan-500/15">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">
                {isRTL ? 'جاري تهيئة منشأتك السحابية...' : 'Provisioning Your Cloud Facility...'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">{provisionStepText}</p>
            </div>

            {/* Progress Bar */}
            <div className="max-w-md mx-auto space-y-1.5">
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${provisionProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1">
                <span>{isRTL ? 'التهيئة التلقائية' : 'Auto-Provisioning'}</span>
                <span>{provisionProgress}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
