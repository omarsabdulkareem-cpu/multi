import React, { useState } from 'react';
import {
  Factory,
  Layers,
  Truck,
  Apple,
  ShoppingBag,
  Building2,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Scale,
  QrCode,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicNavRoute } from './PublicNavbar';

interface PublicSolutionsPageProps {
  onNavigate: (route: PublicNavRoute) => void;
}

export const PublicSolutionsPage: React.FC<PublicSolutionsPageProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();
  const [activeIndustry, setActiveIndustry] = useState<string>('plastics');

  const industries = [
    {
      id: 'plastics',
      icon: <Factory className="w-5 h-5" />,
      nameEn: 'Plastics & Polymer Recycling',
      nameAr: 'صناعة البلاستيك والتدوير',
      taglineEn: 'From scrap truck weighbridge to granulated regrind pellets and jumbo bags',
      taglineAr: 'من قبان الشاحنات لخام السكراب إلى حبيبات الثرم والأكياس الكبيرة (Jumbo Bags)',
      problemEn:
        'Managing scrap yield loss, granulator knife clearance, weighing gross/tare trucks, and tracking reclaimed regrind yield percentages across shifts.',
      problemAr:
        'مواجهة صعوبات احتساب نسب الهدر في السكراب، متابعة استهلاك سكاكين طواحين الثرم، وتسجيل أوزان الشاحنات وتتبع الأكياس الكبيرة بين الورديات.',
      solutionEn:
        'Dedicated granulator tracking, knife wear predictive analytics, bulk bag QR tagging, and automated weighbridge scale deductions.',
      solutionAr:
        'موديول متخصص لطواحين الثرم، حساب فوري لنسب استخلاص الحبيبات، ترميز الأكياس الكبيرة بملصقات QR، وخصم آلي لفارغ الشاحنات بالميزان الجسري.',
      highlightsEn: [
        'Granulation yield ratio calculation per shift',
        'Bulk bag (Jumbo Bag) tracking with unique tare deductions',
        'Scrap density and contamination QA logging',
        'Automatic knife replacement maintenance alarms',
      ],
      highlightsAr: [
        'حساب دقيق لنسبة الاستخلاص ومعدل الهدر لكل وردية',
        'تتبع الأكياس الكبيرة (Jumbo Bags) مع خصم أوزان الأكياس الفارغة',
        'فحص نقاوة السكراب وعزل الدفعات غير المطابقة للمواصفات',
        'تنبيهات استباقية لاستبدال وشحذ سكاكين طواحين الثرم',
      ],
    },
    {
      id: 'manufacturing',
      icon: <Layers className="w-5 h-5" />,
      nameEn: 'Manufacturing & Assembly',
      nameAr: 'التصنيع والإنتاج والتجميع',
      taglineEn: 'Multi-level BOM deduction, WIP staging, and finished goods reconciliation',
      taglineAr: 'صرف قوائم المواد المتعددة (BOM)، تتبع الإنتاج تحت التشغيل واستلام التام',
      problemEn:
        'Production delays caused by phantom stockouts, manual raw material issuance, and lack of traceability between raw batches and finished serials.',
      problemAr:
        'تعطل خطوط الإنتاج بسبب فروقات المخزون الوهمية، الصرف اليدوي العشوائي، وغياب الربط بين دفعات الخامات والمنتج النهائي التام.',
      solutionEn:
        'Double-entry work order issuance, real-time BOM explosion, barcode-verified picking, and automated shift handover sign-offs.',
      solutionAr:
        'نظام قيد مزدوج لأوامر التشغيل، خصم آلي لقوائم المواد فور بدء الإنتاج، مسح بالباركود لمنع خلط الخامات، وتوثيق تسليم الورديات.',
      highlightsEn: [
        'Work order material reservations prevent double-allocation',
        'Automated scrap and damage deduction records',
        'Machine operating hours and preventive maintenance triggers',
        'Digital shift supervisor handover sign-offs',
      ],
      highlightsAr: [
        'حجز الخامات للأوامر التشغيلية لمنع الصرف المزدوج',
        'توثيق دقيق للتالف والهدر أثناء مراحل التشغيل',
        'متابعة ساعات عمل الماكينات وجدولة الصيانة الوقائية',
        'اعتماد إلكتروني فوري لمحاضر تسليم مشرفي الورديات',
      ],
    },
    {
      id: 'fmcg',
      icon: <Apple className="w-5 h-5" />,
      nameEn: 'FMCG & Food Storage',
      nameAr: 'الأغذية والسلع الاستهلاكية FMCG',
      taglineEn: 'Strict FEFO expiration enforcement, batch quarantines, and cold chain zones',
      taglineAr: 'إدارة الصلاحيات الصارمة (FEFO)، عزل الدفعات، ومناطق التبريد المخصصة',
      problemEn:
        'Spoilage losses from expired goods sitting behind newer shipments, regulatory compliance fines, and slow batch recall procedures.',
      problemAr:
        'خسائر تلف البضائع منتهية الصلاحية بسبب سوء الترتيب، مخالفات الاشتراطات الصحية، وبطء إجراءات سحب الدفعات المعيبة.',
      solutionEn:
        'Enforced First-Expired First-Out (FEFO) picking algorithms, automated expiration warning countdowns, and instant multi-location batch quarantine.',
      solutionAr:
        'توجيه الصرف وفق الأقرب انتهاءً (FEFO)، عداد تنازلي للتنبيه بالدفعات المشرفة على الانتهاء، وعزل فوري للدفعات بضغطة زر.',
      highlightsEn: [
        'Automated expiry alerts at 90, 60, and 30 days prior',
        'Temperature and humidity zone rack mapping',
        'Instant supplier-level recall tracing in under 5 seconds',
        'Nutritional & regulatory certificate attachments',
      ],
      highlightsAr: [
        'تنبيهات استباقية بالصلاحية قبل 90 و 60 و 30 يوماً',
        'تحديد مواقع التخزين وفق مناطق درجات الحرارة والرطوبة',
        'سحب تقرير التتبع العكسي لأي دفعة خلال أقل من 5 ثوانٍ',
        'إرفاق الشهادات الصحية والمخبرية مع سجلات الاستلام',
      ],
    },
    {
      id: 'distribution',
      icon: <Truck className="w-5 h-5" />,
      nameEn: 'Wholesale & Logistics Hubs',
      nameAr: 'مراكز التوزيع وتجارة الجملة',
      taglineEn: 'High-velocity receiving, cross-docking, and multi-warehouse stock balancing',
      taglineAr: 'استلام سريع للشاحنات، عبور مباشر (Cross-Docking)، وموازنة المخزون بين الفروع',
      problemEn:
        'Bottlenecks at receiving bays, stock imbalances between central and regional warehouses, and shipping delays.',
      problemAr:
        'اختناق ساحات الاستلام، تباين أرصدة الفروع بين المستودع المركزي والإقليمي، وتأخر تجهيز الشحنات الكبيرة.',
      solutionEn:
        'Cross-dock routing, internal transfer inter-warehouse requisitions with transit tracking, and high-speed bulk camera barcode scanners.',
      solutionAr:
        'توجيه مباشر للشحن دون تخزين للأصناف المطلوبة، تتبع دقيق للمواد المنقولة بين المستودعات بالطريق، ومسح جماعي سريع بالباركود.',
      highlightsEn: [
        'In-transit inventory visibility across regional branches',
        'Vendor purchase order 3-way delivery matching',
        'Bin capacity optimization to minimize forklift travel',
        'Automatic purchase order generation when below reorder point',
      ],
      highlightsAr: [
        'رؤية كاملة للمخزون المنقول بين الفروع وهو على الطريق',
        'مطابقة ثلاثية لأوامر الشراء وبوالص التسليم وفواتير الموردين',
        'تحسين مسارات الرافعات الشوكية داخل ممرات المستودع',
        'توليد آلي لأوامر الشراء فور وصول الصنف للحد الأدنى',
      ],
    },
    {
      id: '3pl',
      icon: <Building2 className="w-5 h-5" />,
      nameEn: 'Third-Party Logistics (3PL)',
      nameAr: 'الخدمات اللوجستية للغير (3PL)',
      taglineEn: 'Multi-client isolated workspaces, client inventory portals, and pallet billing',
      taglineAr: 'مساحات عمل معزولة لكل عميل، بوابات جرد مخصصة، واحتساب رسوم التخزين',
      problemEn:
        'Accidental mixing of client stock, complex manual monthly storage fee billing, and lack of real-time visibility for clients.',
      problemAr:
        'مخاطر اختلاط بضائع العملاء، صعوبة الفوترة اليدوية لرسوم التخزين الشهرية، وعدم قدرة العميل على متابعة مخزونه فورياً.',
      solutionEn:
        'Zero-leak multi-tenant organization partitions, automated pallet-day storage fee calculation, and client-restricted viewer roles.',
      solutionAr:
        'عزل برمجي تام لبضائع كل عميل، احتساب آلي لرسوم التخزين بالباليت/اليوم، وصلاحيات تصفح مستقلة لعملاء الشركة اللوجستية.',
      highlightsEn: [
        'Independent client branding and dedicated reporting',
        'Pallet/cubic meter storage billing calculation',
        'Client portal login to inspect real-time stock levels',
        'Complete transactional proof of delivery (POD)',
      ],
      highlightsAr: [
        'تقارير مستقلة وهوية خاصة بكل عميل متعاقد',
        'احتساب تلقائي لرسوم التخزين بالمتر المكعب أو الباليت',
        'بوابة دخول خاصة لعميلك للاطلاع على رصيد بضاعته فقط',
        'إثبات إلكتروني للتسليم وتصاريح خروج الشاحنات (POD)',
      ],
    },
  ];

  const current = industries.find((i) => i.id === activeIndustry) || industries[0];

  return (
    <div className="space-y-16 pb-20">
      {/* Header */}
      <section className="text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isRTL ? 'حلول مصممة لطبيعة أعمالك' : 'PURPOSE-BUILT INDUSTRY VERTICALS'}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {isRTL
            ? 'حلول متخصصة لكل قطاع صناعي وتجاري'
            : 'Tailored Workflows Designed for Your Specific Industry'}
        </h1>
        <p className="mt-4 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {isRTL
            ? 'سواء كنت تدير مصنع بلاستيك وتدوير يحتاج لربط القبان والمطاحن، أو مركز توزيع أغذية سريع الدوران، المنصة تتكيف مع متطلباتك التشغيلية بدقة.'
            : 'Whether managing polymer recycling granulators, discrete manufacturing assembly, or fast-turnaround wholesale distribution, our workflows configure to your floor.'}
        </p>

        {/* Industry Switcher Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {industries.map((ind) => (
            <button
              key={ind.id}
              onClick={() => setActiveIndustry(ind.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeIndustry === ind.id
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#0f1422] text-slate-300 hover:bg-[#161d30] border border-white/5'
              }`}
            >
              {ind.icon}
              <span>{isRTL ? ind.nameAr : ind.nameEn}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Industry Deep Dive Card */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0c101c] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">
              {isRTL ? current.nameAr : current.nameEn}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
              {isRTL ? current.taglineAr : current.taglineEn}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 pt-8 border-t border-white/10">
            {/* The Operational Challenge */}
            <div className="p-6 rounded-2xl bg-[#111624] border border-red-500/20 space-y-3">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider">
                {isRTL ? 'التحدي التشغيلي الشائع:' : 'The Traditional Operational Pain:'}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isRTL ? current.problemAr : current.problemEn}
              </p>
            </div>

            {/* The Software Solution */}
            <div className="p-6 rounded-2xl bg-[#111624] border border-emerald-500/20 space-y-3">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {isRTL ? 'كيف تحل المنصة هذا التحدي؟' : 'How Universal Warehouse Solves It:'}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isRTL ? current.solutionAr : current.solutionEn}
              </p>
            </div>
          </div>

          {/* Key Advantages List */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              {isRTL ? 'أهم الخصائص المضمنة في هذا الحل:' : 'Key Engineered Capabilities:'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(isRTL ? current.highlightsAr : current.highlightsEn).map((h, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              {isRTL
                ? 'جاهز للاستخدام الفوري مع قوالب جاهزة ومسودات أوزان مسبقة التهيئة.'
                : 'Ready for production deployment with pre-configured templates and scale logic.'}
            </div>
            <button
              onClick={() => onNavigate('signup')}
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-lg"
            >
              <span>{isRTL ? 'ابدأ تجربة مجانية لهذا القطاع' : 'Deploy This Solution Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
