import React, { useState } from 'react';
import {
  Boxes,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Scale,
  QrCode,
  Layers,
  Activity,
  Cpu,
  BarChart3,
  Factory,
  RefreshCw,
  Building2,
  CheckCircle2,
  Clock,
  TrendingUp,
  Zap,
  Users,
  Warehouse,
  ChevronDown,
  HelpCircle,
  Truck,
  FileCheck,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PlatformService } from '../../services/platformService';
import { PublicNavRoute } from './PublicNavbar';
import { PublicFunnelService, SUPPORTED_CURRENCIES } from '../../services/publicFunnelService';

interface PublicHomePageProps {
  onNavigate: (route: PublicNavRoute) => void;
  selectedCurrency: string;
}

export const PublicHomePage: React.FC<PublicHomePageProps> = ({
  onNavigate,
  selectedCurrency,
}) => {
  const { isRTL } = useLanguage();
  const platformSettings = PlatformService.getPlatformSettings();
  const brandName = isRTL ? platformSettings.platformNameAr : platformSettings.platformName;

  // Interactive ROI Calculator State
  const [roiWarehouses, setRoiWarehouses] = useState(3);
  const [roiShipments, setRoiShipments] = useState(1200);
  const [roiStaff, setRoiStaff] = useState(25);

  // Active FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Calculations for ROI
  const hoursSavedPerMonth = Math.round(roiStaff * 12 + roiShipments * 0.15);
  const accuracyRate = 99.94;
  const estimatedSavingsUSD = Math.round(roiStaff * 720 + roiWarehouses * 4500);
  const formattedSavings = PublicFunnelService.formatPrice(
    estimatedSavingsUSD,
    selectedCurrency,
    isRTL
  );

  const features = [
    {
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      titleEn: 'Double-Entry Movement Ledger',
      titleAr: 'سجل حركات المخزن المزدوج',
      descEn: 'Every item transfer, issue, or receipt creates immutable debit/credit entries with complete hash-chain auditability.',
      descAr: 'تسجيل غير قابل للتلاعب لكافة عمليات الصرف والاستلام والتحويل بنظام القيد المزدوج وسلسلة التجزئة المشفرة.',
    },
    {
      icon: <Scale className="w-6 h-6 text-amber-400" />,
      titleEn: 'Weighbridge Dual-Scale Engine',
      titleAr: 'أتمتة الميزان الجسري للشاحنات',
      descEn: 'Automated gross/tare weighing, truck license recognition, tare tolerance checks, and zero-loss draft persistence.',
      descAr: 'أوزان شاحنات آلية بالكامل مع كشف الانحرافات وحساب الصافي والربط مع الكاميرات والمسودات المعزولة.',
    },
    {
      icon: <QrCode className="w-6 h-6 text-emerald-400" />,
      titleEn: 'Batch, Lot & Expiry Traceability',
      titleAr: 'تتبع الدفعات وتواريخ الصلاحية والباركود',
      descEn: 'FEFO/FIFO inventory movement, GS1-128 compliance, mobile camera scanning, and instant QR label generation.',
      descAr: 'تتبع شامل من المورد إلى خط الإنتاج، دعم FEFO وسحب فوري لبيانات الدفعات عبر قارئ الباركود الذكي.',
    },
    {
      icon: <Factory className="w-6 h-6 text-blue-400" />,
      titleEn: 'Manufacturing BOM & Scrap Recycling',
      titleAr: 'أوامر الإنتاج وتدوير المواد والثرم',
      descEn: 'Full Bill of Materials management, work orders, granulator yield tracking, and regrind scrap reclamation.',
      descAr: 'إدارة قوائم المواد (BOM)، صرف أوامر التشغيل، ونظام متخصص لطواحين وثرم البلاستيك والمواد المسترجعة.',
    },
    {
      icon: <Building2 className="w-6 h-6 text-purple-400" />,
      titleEn: 'Multi-Tenant Zero-Leak Isolation',
      titleAr: 'عزل تام للشركات والمستودعات المتعددة',
      descEn: 'Separate multiple subsidiaries, clients, or branches under distinct workspaces with tenant-level RBAC.',
      descAr: 'إدارة فروع متعددة ومؤسسات مستقلة بحماية مطلقة لقواعد البيانات ودون أي تسريب بين العملاء.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-rose-400" />,
      titleEn: 'Real-Time Telemetry & Predictive AI',
      titleAr: 'مؤشرات أداء فورية وتنبؤ بالمخزون',
      descEn: 'Sankey material flows, ABC velocity analysis, machine wear metering, and automated low-stock safety alerts.',
      descAr: 'مخططات تدفق الخامات، تصنيف المخزون، ساعات تشغيل الماكينات، وتنبيهات ذكية لنقاط إعادة الطلب.',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      titleEn: 'Inbound Gate & Scale-In',
      titleAr: 'بوابة الدخول ووزن القبان 1',
      descEn: 'Weighing gross truck weight, supplier bill matching, driver validation.',
      descAr: 'تسجيل وزن الشاحنة الإجمالي ومطابقة أمر الشراء والتحقق من هوية السائق.',
    },
    {
      step: '02',
      titleEn: 'Quality Inspection & Staging',
      titleAr: 'الفحص المخبري ومراقبة الجودة',
      descEn: 'Material quarantine, density/purity testing, QR batch tagging.',
      descAr: 'عزل العينات وفحص المطابقة الفنية وطباعة ملصقات الباركود الذكية.',
    },
    {
      step: '03',
      titleEn: 'Dynamic Rack & Bin Putaway',
      titleAr: 'التخزين الموجه على الأرفف',
      descEn: 'Aisle/Rack/Bin placement, capacity zoning, temperature monitoring.',
      descAr: 'توجيه العمال للممرات والرفوف المناسبة وفق سعة التخزين والنوع.',
    },
    {
      step: '04',
      titleEn: 'Production Issue / Order Pick',
      titleAr: 'الصرف للإنتاج أو التجهيز',
      descEn: 'BOM allocation, barcode pick verification, FIFO enforcement.',
      descAr: 'صرف خامات التصنيع أو تجهيز طلبيات التوزيع بالمسح الضوئي.',
    },
    {
      step: '05',
      titleEn: 'Outbound Scale & Gate Pass',
      titleAr: 'الوزن الصافي وتصريح الخروج',
      descEn: 'Scale-out tare deduction, official delivery note generation, stock ledger debit.',
      descAr: 'خصم وزن الفارغ، إصدار بوليصة التسليم الرسمية وخصم المخزون فورياً.',
    },
  ];

  const faqs = [
    {
      qEn: 'How fast can we onboard our warehouse operations?',
      qAr: 'ما هي المدة اللازمة لإطلاق وتشغيل المستودع على المنصة؟',
      aEn: 'With our automated self-service provisioning, your tenant organization, primary warehouse, and default storage locations are ready within 60 seconds. You can import existing items and balance sheets immediately via Excel.',
      aAr: 'من خلال معالج الإطلاق الآلي، يتم تهيئة منشأتك ومستودعك الرئيسي ومواقع التخزين خلال 60 ثانية فقط، ويمكنك استيراد أرصدتك عبر ملفات Excel مباشرة.',
    },
    {
      qEn: 'Does the system require specialized weighbridge hardware?',
      qAr: 'هل يتطلب نظام الميزان الجسري أجهزة إلكترونية محددة؟',
      aEn: 'No proprietary hardware lock-in. Our scale engine works with standard digital indicator protocols (RS232/IP), industrial cameras, and voice dictation, alongside resilient local persistence for offline operations.',
      aAr: 'لا، المنصة متوافقة مع جميع مؤشرات الموازين القياسية (RS232/IP)، وتدعم الإدخال الصوتي ومسودات العمل في حال انقطاع الإنترنت.',
    },
    {
      qEn: 'How is tenant data isolation guaranteed for commercial privacy?',
      qAr: 'كيف تضمن المنصة خصوصية وعزل بيانات الشركات؟',
      aEn: 'Our multi-tenant architecture uses zero-trust security rules enforced at both the application and database tiers. No organization can query, view, or modify another organization’s inventory or financial ledgers.',
      aAr: 'تعتمد بنيتنا على قواعد أمان Zero-Trust على مستوى قاعدة البيانات والسحابة، مما يضمن استحالة وصول أي شركة لبيانات أو تقارير شركة أخرى.',
    },
    {
      qEn: 'Can we customize roles and workflow permissions for floor staff?',
      qAr: 'هل يمكن تخصيص صلاحيات محددة لعمال المستودع والمشرفين؟',
      aEn: 'Yes. The system includes granular role-based access control (RBAC). Floor workers, scale operators, shift supervisors, purchasing agents, and finance auditors each receive dedicated, restricted interfaces.',
      aAr: 'نعم بالكامل. يحتوي النظام على مصفوفة أذونات تفصيلية لعمال المخازن، مشغلي الموازين، مسؤولي الورديات، ومسؤولي المشتريات والتدقيق.',
    },
  ];

  return (
    <div className="space-y-24 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 lg:pt-24 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-cyan-600/15 via-blue-600/15 to-indigo-600/10 blur-[150px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Top Launch Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>
              {isRTL
                ? 'الجيل الجديد من منصات إدارة المستودعات وسلاسل الإمداد السحابية 2026'
                : 'Enterprise Multi-Tenant Warehouse Operating System 2026'}
            </span>
          </div>

          {/* Main Hero Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
            {isRTL ? (
              <>
                تحكم ذكي بالمستودعات، سجل حركات فوري، و{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
                  أتمتة موازين متكاملة
                </span>
              </>
            ) : (
              <>
                Unified Warehouse Intelligence, Real-Time Ledger &{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
                  Scale Automation
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-sm sm:text-base lg:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            {isRTL
              ? 'صممت للشركات الصناعية، مراكز التوزيع اللوجستية، وتدوير البوليمرات. تحكم في مستودعاتك المتعددة، تتبع كل دفعة وخامة بالباركود، وامنع الفروقات المخزنية عبر بنية سحابية معزولة وآمنة بالكامل.'
              : 'Engineered for industrial manufacturers, wholesale distribution hubs, and raw material recyclers. Eliminate stock discrepancies, automate weighbridge intake, and orchestrate work orders with zero-leak tenant isolation.'}
          </p>

          {/* Primary Call to Action */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('signup')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-900/40 hover:shadow-cyan-900/60 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRTL ? 'ابدأ تجربة مجانية 14 يوماً' : 'Start 14-Day Free Trial'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('features')}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isRTL ? 'استكشف المزايا التفاعلية' : 'Explore All Features'}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {isRTL ? 'بدون بطاقة ائتمانية' : 'No credit card required'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {isRTL ? 'إطلاق فوري في دقيقة واحدة' : 'Instant 60-second setup'}
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {isRTL ? 'دعم فني وتدريب مجاني' : '24/7 Enterprise support'}
            </span>
          </div>

          {/* Metric Highlights Banner */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-[#0c101c]/80 border border-white/10 shadow-2xl backdrop-blur-md">
            <div className="p-3 text-center border-r border-white/5 last:border-none">
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">99.99%</div>
              <div className="text-xs text-slate-400 mt-1">
                {isRTL ? 'نسبة جاهزية السحابة' : 'Cloud Uptime SLA'}
              </div>
            </div>
            <div className="p-3 text-center border-r border-white/5 last:border-none">
              <div className="text-2xl sm:text-3xl font-black text-blue-400 font-mono">500+</div>
              <div className="text-xs text-slate-400 mt-1">
                {isRTL ? 'منشأة ومستودع صناعي' : 'Active Industrial Hubs'}
              </div>
            </div>
            <div className="p-3 text-center border-r border-white/5 last:border-none">
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">100M+</div>
              <div className="text-xs text-slate-400 mt-1">
                {isRTL ? 'حركة مخزنية موثقة' : 'Audited Stock Movements'}
              </div>
            </div>
            <div className="p-3 text-center">
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">0.0%</div>
              <div className="text-xs text-slate-400 mt-1">
                {isRTL ? 'تسريب في عزل الشركات' : 'Cross-Tenant Data Leakage'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">
            {isRTL ? 'قدرات المنصة الأساسية' : 'ARCHITECTURAL CAPABILITIES'}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {isRTL
              ? 'حل شامل يغطي دورة حياة المواد من البوابة إلى الشحن'
              : 'End-to-End Control from Gate Inbound to Customer Dispatch'}
          </h2>
          <p className="mt-4 text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isRTL
              ? 'تجمع المنصة بين دقة المحاسبة المزدوجة وسرعة عمليات ساحة المستودع مع أدوات استشعار الموازين وتتبع التصنيع.'
              : 'Combining double-entry precision with factory floor agility, automated weigh scales, and resilient edge persistence.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-[#0d111c] border border-white/10 hover:border-cyan-500/40 transition-all hover:-translate-y-1 shadow-lg group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                {isRTL ? item.titleAr : item.titleEn}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isRTL ? item.descAr : item.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5-Step Operational Flow Breakdown */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-[#0c0f18]/60 rounded-3xl border border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
            {isRTL ? 'مسار العمليات التشغيلية' : 'OPERATIONAL LIFECYCLE'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {isRTL
              ? 'كيف تتدفق الخامات بدقة عبر محطات النظام؟'
              : 'How Material Flows Seamlessly Through Your Hub'}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {workflowSteps.map((ws, i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-[#111624] border border-white/10 relative flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl font-black font-mono text-cyan-400/40 mb-3 block">
                  {ws.step}
                </span>
                <h4 className="text-sm font-bold text-white mb-2">
                  {isRTL ? ws.titleAr : ws.titleEn}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isRTL ? ws.descAr : ws.descEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive ROI & Cost-Savings Calculator */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#0c1220] to-[#0a101a] border border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
            {/* Controls */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  {isRTL ? 'حاسبة العائد الاستثماري التفاعلية' : 'INTERACTIVE ROI CALCULATOR'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {isRTL
                    ? 'احسب وفورات شركتك السنوية مع التحول الرقمي'
                    : 'Calculate Your Annual Savings & Productivity Uplift'}
                </h2>
                <p className="text-xs text-slate-400 mt-2">
                  {isRTL
                    ? 'حرك المؤشرات وفق حجم عملياتك لمشاهدة الساعات الموفرة وتخفيض الفروقات المخزنية.'
                    : 'Adjust the sliders to match your operational volume and see projected annual labor and shrinkage savings.'}
                </p>
              </div>

              {/* Slider 1: Warehouses */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    {isRTL ? 'عدد المستودعات والمرافق:' : 'Warehouse Facilities:'}
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{roiWarehouses}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={roiWarehouses}
                  onChange={(e) => setRoiWarehouses(parseInt(e.target.value) || 1)}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 2: Monthly Shipments */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    {isRTL ? 'الشحنات وأوامر الاستلام شهرياً:' : 'Monthly In/Out Shipments:'}
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{roiShipments.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="10000"
                  step="100"
                  value={roiShipments}
                  onChange={(e) => setRoiShipments(parseInt(e.target.value) || 200)}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider 3: Floor Staff */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">
                    {isRTL ? 'عدد موظفي الساحة والتشغيل:' : 'Warehouse & Scale Staff:'}
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{roiStaff}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={roiStaff}
                  onChange={(e) => setRoiStaff(parseInt(e.target.value) || 5)}
                  className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Projected Outputs Card */}
            <div className="lg:col-span-5 p-6 sm:p-8 rounded-2xl bg-[#111728] border border-white/10 shadow-xl space-y-6 text-center">
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold">
                  {isRTL ? 'إجمالي الوفورات التقديرية سنوياً' : 'Projected Annual Cost Savings'}
                </div>
                <div className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 font-mono mt-2">
                  {formattedSavings}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  {isRTL ? `محسوبة بعملة ${selectedCurrency}` : `Converted in ${selectedCurrency}`}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-left">
                <div className="p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-slate-400">
                    {isRTL ? 'ساعات عمل موفرة / شهر' : 'Monthly Hours Saved'}
                  </div>
                  <div className="text-xl font-bold text-white font-mono mt-1">
                    {hoursSavedPerMonth} hrs
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5">
                  <div className="text-xs text-slate-400">
                    {isRTL ? 'دقة الجرد المتوقعة' : 'Target Inventory Accuracy'}
                  </div>
                  <div className="text-xl font-bold text-cyan-300 font-mono mt-1">
                    {accuracyRate}%
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigate('signup')}
                className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg transition-colors cursor-pointer"
              >
                {isRTL ? 'ابدأ بتوفير التكاليف الآن مجاناً' : 'Claim Your Efficiency Gains Now'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
            {isRTL ? 'خطط أسعار مرنة وشفافة' : 'TRANSPARENT PRICING TIERS'}
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
            {isRTL ? 'اختر الباقة المناسبة لمرحلة نموك' : 'Pick the Right Plan for Your Scale'}
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-slate-400">
            {isRTL
              ? 'جميع الباقات تبدأ بتجربة كاملة 14 يوماً مع كامل الخصائص وبدون أي التزام.'
              : 'All plans include 14-day free trials with unrestricted access to essential modules.'}
          </p>
        </div>

        {/* Fast Pricing Cards Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Starter */}
          <div className="p-6 rounded-2xl bg-[#0c101c] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="text-sm font-bold text-slate-300">STARTER</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {PublicFunnelService.formatPrice(79, selectedCurrency, isRTL)}
                </span>
                <span className="text-xs text-slate-400">/{isRTL ? 'شهر' : 'mo'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {isRTL ? 'للمستودعات الفردية والمخازن المتوسطة' : 'For single-facility hubs starting digital inventory.'}
              </p>
              <ul className="mt-6 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'حتى 2 مستودع' : 'Up to 2 Warehouses'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? '5 مستخدمين بصلاحيات RBAC' : '5 User Accounts'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'سجل حركات المخزن المزدوج' : 'Double-Entry Movement Ledger'}
                </li>
              </ul>
            </div>
            <button
              onClick={() => onNavigate('signup')}
              className="mt-8 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition cursor-pointer"
            >
              {isRTL ? 'ابدأ تجربة مجانية' : 'Start Free Trial'}
            </button>
          </div>

          {/* Professional (Featured) */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-[#131b2e] to-[#0d1220] border-2 border-cyan-500 shadow-2xl relative flex flex-col justify-between transform md:-translate-y-2">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] tracking-wider uppercase">
              {isRTL ? 'الأكثر طلباً' : 'MOST POPULAR'}
            </div>
            <div>
              <div className="text-sm font-bold text-cyan-300">PROFESSIONAL</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {PublicFunnelService.formatPrice(199, selectedCurrency, isRTL)}
                </span>
                <span className="text-xs text-slate-400">/{isRTL ? 'شهر' : 'mo'}</span>
              </div>
              <p className="text-xs text-slate-300 mt-3">
                {isRTL
                  ? 'لمصانع ومراكز التوزيع المتنامية مع الموازين والباركود'
                  : 'For growing plants requiring weighbridge scales & lot tracking.'}
              </p>
              <ul className="mt-6 space-y-2 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'حتى 5 مستودعات' : 'Up to 5 Warehouses'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? '25 مستخدماً' : '25 User Accounts'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'أتمتة الميزان الجسري للشاحنات' : 'Weighbridge Dual-Scale Engine'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'تتبع الدفعات وتواريخ الصلاحية' : 'Lot & Batch Traceability'}
                </li>
              </ul>
            </div>
            <button
              onClick={() => onNavigate('signup')}
              className="mt-8 w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg transition cursor-pointer"
            >
              {isRTL ? 'ابدأ تجربة مجانية 14 يوماً' : 'Start 14-Day Free Trial'}
            </button>
          </div>

          {/* Enterprise */}
          <div className="p-6 rounded-2xl bg-[#0c101c] border border-white/10 flex flex-col justify-between">
            <div>
              <div className="text-sm font-bold text-slate-300">ENTERPRISE</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {PublicFunnelService.formatPrice(799, selectedCurrency, isRTL)}
                </span>
                <span className="text-xs text-slate-400">/{isRTL ? 'شهر' : 'mo'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {isRTL ? 'للمجمعات الصناعية وشبكات 3PL اللوجستية الضخمة' : 'For global multi-site enterprises & 3PL logistics networks.'}
              </p>
              <ul className="mt-6 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'مستودعات ومستخدمين غير محدودين' : 'Unlimited Warehouses & Users'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'تكامل خطوط الثرم والتدوير الكامل' : 'Full Recycling & BOM Operations'}
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  {isRTL ? 'مدير حساب مخصص واتفاقية SLA 99.99%' : 'Dedicated CSM & 99.99% SLA'}
                </li>
              </ul>
            </div>
            <button
              onClick={() => onNavigate('contact')}
              className="mt-8 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition cursor-pointer"
            >
              {isRTL ? 'تواصل مع المبيعات' : 'Contact Enterprise Sales'}
            </button>
          </div>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => onNavigate('pricing')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{isRTL ? 'شاهد جدول المقارنة الشامل لكافة الخصائص' : 'View full feature matrix comparison'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
            {isRTL ? 'الأسئلة الشائعة' : 'FREQUENTLY ASKED QUESTIONS'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {isRTL ? 'إجابات على أكثر الأسئلة طرحاً' : 'Everything You Need to Know'}
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#0c101c] border border-white/10 overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-cyan-300 transition cursor-pointer"
                >
                  <span>{isRTL ? faq.qAr : faq.qEn}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-white/5 pt-3">
                    {isRTL ? faq.aAr : faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom Final CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-cyan-900/60 via-blue-900/60 to-indigo-900/60 border border-cyan-500/40 text-center relative overflow-hidden shadow-2xl">
          <div className="max-w-3xl mx-auto space-y-6 relative z-10">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {isRTL
                ? 'جاهز لأتمتة مستودعاتك وزيادة دقة مخزونك؟'
                : 'Ready to Transform Your Warehouse & Supply Operations?'}
            </h2>
            <p className="text-xs sm:text-sm text-cyan-100/90 leading-relaxed">
              {isRTL
                ? 'انضم إلى مئات الشركات والمصانع التي تعتمد على المنصة لإدارة الملايين من حركات المخزون والموازين سنوياً. ابدأ تجربتك المجانية دون الحاجة لبطاقة ائتمان.'
                : 'Join modern industrial plants and distribution networks managing millions of inventory movements with automated weighbridges and zero discrepancies.'}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigate('signup')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-xl transition cursor-pointer"
              >
                {isRTL ? 'ابدأ تجربة مجانية 14 يوماً الآن' : 'Start Your 14-Day Free Trial Now'}
              </button>
              <button
                onClick={() => onNavigate('contact')}
                className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition cursor-pointer"
              >
                {isRTL ? 'حجز جلسة عرض حي مع خبير' : 'Book Live Architecture Consultation'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
