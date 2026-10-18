import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicNavRoute } from './PublicNavbar';
import { PublicFunnelService } from '../../services/publicFunnelService';
import { PlanTier } from '../../types/saas';

interface PublicPricingPageProps {
  onNavigate: (route: PublicNavRoute, planTier?: PlanTier) => void;
  selectedCurrency: string;
}

export const PublicPricingPage: React.FC<PublicPricingPageProps> = ({
  onNavigate,
  selectedCurrency,
}) => {
  const { isRTL } = useLanguage();
  const [isAnnual, setIsAnnual] = useState(true);

  // Discount: 20% off on annual
  const discountMultiplier = isAnnual ? 0.8 : 1.0;

  const tiers: {
    tier: PlanTier;
    nameEn: string;
    nameAr: string;
    basePriceMonthlyUSD: number;
    popular?: boolean;
    descEn: string;
    descAr: string;
    featuresEn: string[];
    featuresAr: string[];
  }[] = [
    {
      tier: 'STARTER',
      nameEn: 'Starter',
      nameAr: 'البداية (Starter)',
      basePriceMonthlyUSD: 79,
      descEn: 'Perfect for single-facility warehouses transitioning from spreadsheets to cloud ledgers.',
      descAr: 'مثالية للمستودعات الفردية والشركات التي تبدأ التحول من إكسل إلى سجل سحابي متكامل.',
      featuresEn: [
        'Up to 2 Warehouses',
        'Up to 5 Users with RBAC',
        'Up to 1,000 Active SKUs',
        'Double-Entry Movement Ledger',
        'Basic Barcode QR Scanning',
        'Excel Import & Export',
        'Standard Email Support',
      ],
      featuresAr: [
        'حتى 2 مستودع أو فرع',
        'حتى 5 مستخدمين بصلاحيات محددة',
        'حتى 1,000 صنف مفعل',
        'سجل حركات المخزن المزدوج',
        'مسح وطباعة باركود و QR',
        'استيراد وتصدير ملفات إكسل',
        'دعم فني عبر البريد الإلكتروني',
      ],
    },
    {
      tier: 'PROFESSIONAL',
      nameEn: 'Professional',
      nameAr: 'الاحترافية (Professional)',
      basePriceMonthlyUSD: 199,
      popular: true,
      descEn: 'Our most popular plan for fast-growing manufacturing plants and distribution hubs.',
      descAr: 'الخيار الأكثر طلباً للمصانع ومراكز التوزيع التي تحتاج إلى أتمتة الموازين وتتبع الدفعات.',
      featuresEn: [
        'Up to 5 Warehouses',
        'Up to 25 Users',
        'Up to 10,000 Active SKUs',
        'Weighbridge Dual-Scale Engine',
        'Lot, Batch & Expiry Traceability',
        'Internal Warehouse Transfers',
        'Purchasing & PO 3-Way Matching',
        'Offline IndexedDB Resilience',
        'Priority Technical Support',
      ],
      featuresAr: [
        'حتى 5 مستودعات ومرافق',
        'حتى 25 مستخدماً',
        'حتى 10,000 صنف مفعل',
        'أتمتة الميزان الجسري وقبان الشاحنات',
        'تتبع الدفعات وتواريخ الصلاحية (FEFO)',
        'أوامر التحويل بين المستودعات',
        'المشتريات ومطابقة أوامر التوريد',
        'دعم العمل بدون إنترنت (IndexedDB)',
        'دعم فني ذو أولوية عالية',
      ],
    },
    {
      tier: 'BUSINESS',
      nameEn: 'Business',
      nameAr: 'الأعمال (Business)',
      basePriceMonthlyUSD: 399,
      descEn: 'Complete operational power for industrial manufacturing, recycling, and high-volume distribution.',
      descAr: 'قدرات تشغيلية متقدمة لخطوط التصنيع والإنتاج، طواحين الثرم والتدوير، وشبكات الفروع الكبيرة.',
      featuresEn: [
        'Up to 15 Warehouses',
        'Up to 100 Users',
        'Up to 50,000 Active SKUs',
        'Manufacturing Work Orders & BOM',
        'Shredding Granulator Lines Tracking',
        'Bulk Bag (Jumbo Bag) Management',
        'D3 Sankey Flow Telemetry',
        'Quality Control & Quarantine Gate',
        'Multi-Currency & Regional Units',
      ],
      featuresAr: [
        'حتى 15 مستودعاً ومركزاً',
        'حتى 100 مستخدم',
        'حتى 50,000 صنف مفعل',
        'أوامر التصنيع وقوائم المواد (BOM)',
        'إدارة خطوط الثرم والتدوير الصناعي',
        'تتبع الأكياس الكبيرة (Jumbo Bags)',
        'مخططات Sankey لتدفق المواد',
        'بوابة مراقبة الجودة والحجر المخبري',
        'دعم تعدد العملات والوحدات الإقليمية',
      ],
    },
    {
      tier: 'ENTERPRISE',
      nameEn: 'Enterprise',
      nameAr: 'المؤسسات (Enterprise)',
      basePriceMonthlyUSD: 799,
      descEn: 'Unrestricted scalability, custom hardware integration, 99.99% SLA, and dedicated engineering.',
      descAr: 'توسع غير محدود، تكامل مخصص لأجهزة المصنع، اتفاقية SLA بنسبة 99.99% ومدير حساب مخصص.',
      featuresEn: [
        'Unlimited Warehouses & Facilities',
        'Unlimited Users & Custom Roles',
        'Unlimited SKUs & Transactions',
        'Dedicated 99.99% Uptime SLA',
        'Custom Scale Indicator Protocol APIs',
        '3PL Multi-Tenant Client Portals',
        'Automated Point-in-Time DR Backups',
        'Dedicated Technical Account Manager',
      ],
      featuresAr: [
        'مستودعات ومرافق غير محدودة',
        'مستخدمين وصلاحيات غير محدودة',
        'أصناف وحركات مخزنية غير محدودة',
        'اتفاقية تشغيل رسمية بنسبة 99.99%',
        'بروتوكولات ربط مخصصة لموازين المصنع',
        'بوابات خاصة لعملاء شركات 3PL',
        'نسخ احتياطي واستعادة في أي لحظة زمنية',
        'مدير حساب فني مخصص على مدار الساعة',
      ],
    },
  ];

  const comparisonRows = [
    { nameEn: 'Double-Entry Ledger', nameAr: 'سجل القيد المزدوج', s: true, p: true, b: true, e: true },
    { nameEn: 'Offline IndexedDB Engine', nameAr: 'العمل بدون إنترنت', s: true, p: true, b: true, e: true },
    { nameEn: 'Excel Import / Export', nameAr: 'استيراد وتصدير إكسل', s: true, p: true, b: true, e: true },
    { nameEn: 'Weighbridge Dual Scale', nameAr: 'الميزان الجسري للشاحنات', s: false, p: true, b: true, e: true },
    { nameEn: 'Lot, Batch & Expiry Trace', nameAr: 'تتبع الدفعات وتواريخ الصلاحية', s: false, p: true, b: true, e: true },
    { nameEn: 'PO 3-Way Matching', nameAr: 'المطابقة المستندية الثلاثية', s: false, p: true, b: true, e: true },
    { nameEn: 'Manufacturing BOM', nameAr: 'قوائم المواد وأوامر التصنيع', s: false, p: false, b: true, e: true },
    { nameEn: 'Shredding & Regrind Yield', nameAr: 'خطوط الثرم واسترجاع المواد', s: false, p: false, b: true, e: true },
    { nameEn: 'Quality Control Quarantine', nameAr: 'الحجر وفحص الجودة', s: false, p: false, b: true, e: true },
    { nameEn: 'D3 Sankey Telemetry Flows', nameAr: 'مخططات التدفق الانسيابية', s: false, p: false, b: true, e: true },
    { nameEn: '3PL Multi-Tenant Client Portals', nameAr: 'بوابات عملاء 3PL المستقلة', s: false, p: false, b: false, e: true },
    { nameEn: 'Dedicated SLA & 24/7 CSM', nameAr: 'اتفاقية 99.99% ومدير حساب', s: false, p: false, b: false, e: true },
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* Header */}
      <section className="text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isRTL ? 'خطط مرنة وبدون رسوم خفية' : 'TRANSPARENT SUBSCRIPTION TIERS'}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {isRTL ? 'استثمر في دقة مستودعاتك ووفوراتك التشغيلية' : 'Predictable Pricing for High-Efficiency Warehouses'}
        </h1>
        <p className="mt-4 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {isRTL
            ? 'ابدأ مجاناً لمدة 14 يوماً مع كامل الخصائص. يمكنك الترقية أو تغيير الخطة أو الإلغاء في أي وقت دون أي تعقيد.'
            : 'All plans include unrestricted 14-day free trials. Upgrade, downgrade, or cancel anytime with zero lock-in.'}
        </p>

        {/* Annual / Monthly Toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className={`text-xs font-semibold ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>
            {isRTL ? 'الدفع الشهري' : 'Billed Monthly'}
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-14 h-7 rounded-full bg-slate-800 p-1 relative border border-white/10 transition-colors cursor-pointer"
          >
            <div
              className={`w-5 h-5 rounded-full bg-cyan-400 transition-transform ${
                isAnnual ? (isRTL ? '-translate-x-7' : 'translate-x-7') : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-xs font-semibold flex items-center gap-1.5 ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
            <span>{isRTL ? 'الدفع السنوي' : 'Billed Annually'}</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              {isRTL ? 'وفر 20%' : 'Save 20%'}
            </span>
          </span>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((t) => {
            const finalMonthly = Math.round(t.basePriceMonthlyUSD * discountMultiplier);
            const formatted = PublicFunnelService.formatPrice(
              finalMonthly,
              selectedCurrency,
              isRTL
            );

            return (
              <div
                key={t.tier}
                className={`p-6 rounded-3xl flex flex-col justify-between transition-all relative ${
                  t.popular
                    ? 'bg-gradient-to-b from-[#121a2d] to-[#0d1220] border-2 border-cyan-500 shadow-2xl transform lg:-translate-y-2'
                    : 'bg-[#0c101c] border border-white/10 shadow-lg'
                }`}
              >
                {t.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-md">
                    {isRTL ? 'الخيار الأكثر طلباً' : 'MOST POPULAR'}
                  </div>
                )}

                <div>
                  <div className="text-sm font-bold text-white mb-2">
                    {isRTL ? t.nameAr : t.nameEn}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-white font-mono">{formatted}</span>
                    <span className="text-xs text-slate-400">/{isRTL ? 'شهر' : 'mo'}</span>
                  </div>
                  {isAnnual && (
                    <div className="text-[10px] text-emerald-400 font-mono mt-1">
                      {isRTL ? 'يتم الدفع سنوياً (خصم 20%)' : 'Billed annually with 20% discount'}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    {isRTL ? t.descAr : t.descEn}
                  </p>

                  <div className="mt-6 pt-6 border-t border-white/10 space-y-2.5">
                    {(isRTL ? t.featuresAr : t.featuresEn).map((f, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                  <button
                    onClick={() => onNavigate('signup', t.tier)}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      t.popular
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                    }`}
                  >
                    <span>{isRTL ? 'ابدأ تجربة مجانية 14 يوماً' : 'Start 14-Day Free Trial'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature Comparison Matrix */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 shadow-2xl">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-6">
            {isRTL ? 'مصفوفة المقارنة التفصيلية بين الباقات' : 'Full Capability Comparison Matrix'}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4">{isRTL ? 'الخاصية / الإمكانية' : 'Module / Feature'}</th>
                  <th className="py-3 px-4 text-center">Starter</th>
                  <th className="py-3 px-4 text-center text-cyan-300 font-bold">Professional</th>
                  <th className="py-3 px-4 text-center">Business</th>
                  <th className="py-3 px-4 text-center">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {isRTL ? row.nameAr : row.nameEn}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {row.s ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center bg-cyan-500/5">
                      {row.p ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {row.b ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {row.e ? (
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise Consultation Callout */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left space-y-1">
            <h3 className="text-lg font-bold text-white">
              {isRTL ? 'هل لديك متطلبات خاصة أو أحجام ضخمة؟' : 'Need Custom Deployment or Dedicated Cloud Hosting?'}
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'نوفر خططاً مخصصة للمجمعات الصناعية مع استضافة سحابية خاصة ودعم محلي.'
                : 'We offer private cloud deployment, customized ERP integrations, and tailored SLA terms.'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('contact')}
            className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs whitespace-nowrap cursor-pointer transition shadow-lg"
          >
            {isRTL ? 'طلب عرض سعر مخصص' : 'Contact Enterprise Sales'}
          </button>
        </div>
      </section>
    </div>
  );
};
