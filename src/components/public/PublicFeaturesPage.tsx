import React, { useState } from 'react';
import {
  Layers,
  Scale,
  QrCode,
  Factory,
  Building2,
  BarChart3,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Zap,
  ArrowRight,
  Database,
  Truck,
  Sparkles,
  Search,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicNavRoute } from './PublicNavbar';

interface PublicFeaturesPageProps {
  onNavigate: (route: PublicNavRoute) => void;
}

export const PublicFeaturesPage: React.FC<PublicFeaturesPageProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<
    'ALL' | 'INVENTORY' | 'WEIGHBRIDGE' | 'INDUSTRIAL' | 'ENTERPRISE'
  >('ALL');

  const featureModules = [
    {
      id: 'double-entry',
      category: 'INVENTORY',
      icon: <Layers className="w-6 h-6 text-cyan-400" />,
      badgeEn: 'CORE LEDGER',
      badgeAr: 'المحاسبة المزدوجة',
      titleEn: 'Double-Entry Inventory Movement Ledger',
      titleAr: 'سجل حركات المخزن المحاسبي المزدوج',
      descEn: 'Every stock transaction (Receive, Transfer, Issue, Scrap, Reconcile) records precise source and destination credits/debits. Negative balances are physically barred by database constraints, ensuring zero inventory phantom stock.',
      descAr: 'كل حركة استلام أو صرف أو تحويل تسجل طرفي قيد دقيقين. يمنع النظام برمجياً الوصول لأرصدة سالبة، مما يقضي تماماً على المخزون الوهمي والفروقات الحسابية.',
      specsEn: [
        'Immutable cryptographic hash-chain per organization',
        'Automatic FIFO and FEFO lot allocation',
        'Sub-second balance updates across 50,000+ SKUs',
        'Direct Excel reconciliation with historical rollback',
      ],
      specsAr: [
        'سلسلة تجزئة مشفرة لكل منشأة لمنع التلاعب',
        'تخصيص آلي للدفعات وفق معايير FIFO و FEFO',
        'تحديث فوري للأرصدة عبر أكثر من 50,000 صنف',
        'تسوية دورية مع ملفات إكسل مع خاصية التراجع الآمن',
      ],
    },
    {
      id: 'weighbridge',
      category: 'WEIGHBRIDGE',
      icon: <Scale className="w-6 h-6 text-amber-400" />,
      badgeEn: 'SCALE AUTOMATION',
      badgeAr: 'أتمتة الموازين',
      titleEn: 'Dual-Scale Weighbridge & Truck Scale Engine',
      titleAr: 'محرك الميزان الجسري وقبان الشاحنات المزدوج',
      descEn: 'Automate heavy vehicle intake with gross scale-in, tare scale-out, supplier bill of lading matching, and live tolerance anomaly detection. Operates continuously even if the internet connection is severed.',
      descAr: 'أتمتة وزن الشاحنات والمقطورات بالوزن الإجمالي وفارغ الشاحنة ومطابقة بوالص الموردين مع كشف ذكي لأي تلاعب في الأوزان ومواصلة العمل دون إنترنت.',
      specsEn: [
        'Digital indicator integration (RS-232, Modbus, TCP/IP)',
        'Resilient IndexedDB local offline weight persistence',
        'Voice dictation assistant for hands-free scale operators',
        'Predictive scale sensor drift & maintenance alerts',
      ],
      specsAr: [
        'ربط مباشر مع مؤشرات الموازين الرقمية عبر الشبكة والـ Serial',
        'حفظ محلي فوري للأوزان على المتصفح عند انقطاع الشبكة',
        'مساعد إدخال صوتي للمشغلين دون الحاجة للمس لوحة المفاتيح',
        'تنبيهات استباقية لمعايرة خلايا الوزن وحساسات القبان',
      ],
    },
    {
      id: 'batch-qr',
      category: 'INVENTORY',
      icon: <QrCode className="w-6 h-6 text-emerald-400" />,
      badgeEn: 'TRACEABILITY',
      badgeAr: 'تتبع الدفعات',
      titleEn: 'Industrial Barcode & QR Code Scanning',
      titleAr: 'تتبع الباركود الذكي وملصقات QR الصناعية',
      descEn: 'Generate and scan industrial labels for bulk bags, pallets, boxes, and raw material lots. Supported on rugged handheld Android scanners, tablets, and smartphone cameras.',
      descAr: 'توليد وطباعة ملصقات الباركود والـ QR للأكياس الكبيرة (Jumbo Bags) والطرود والدفعات، مع دعم كامل لقارئات الليزر المحمولة وكاميرات الهواتف.',
      specsEn: [
        'Native jsQR browser camera decoding with 60 FPS scan rate',
        'Batch label generation with expiration and supplier codes',
        'Instant quarantine lock for defective or suspect batches',
        'Full material lifecycle provenance from raw to finished product',
      ],
      specsAr: [
        'مسح فوري بالكاميرا بدون تأخير بسرعة 60 إطار بالثانية',
        'طباعة ملصقات دفعات تشمل كود المورد وتاريخ الصلاحية',
        'حجر فوري للمواد المشبوهة أو غير المطابقة للمواصفات',
        'تتبع كامل لدورة حياة الخامة من التوريد إلى المنتج النهائي',
      ],
    },
    {
      id: 'manufacturing-bom',
      category: 'INDUSTRIAL',
      icon: <Factory className="w-6 h-6 text-blue-400" />,
      badgeEn: 'MANUFACTURING',
      badgeAr: 'التصنيع والتشغيل',
      titleEn: 'Production Work Orders, BOM & Recycling Lines',
      titleAr: 'أوامر التصنيع، قوائم المواد (BOM) وخطوط الثرم',
      descEn: 'Transform raw plastic pellets or components into finished goods with precise Bill of Materials deduction, shift yield calculation, and granulated regrind reclamation tracking.',
      descAr: 'إدارة عمليات التصنيع وتحويل الخامات إلى منتجات تامة، مع احتساب دقيق لنسب الهدر واسترجاع التالف عبر خطوط الثرم والطحن وإعادة التدوير.',
      specsEn: [
        'Multi-level Bills of Materials (BOM) with scrap allowances',
        'Shredder granulator knife clearance & wear predictive monitors',
        'Regrind yield ratio monitoring and bulk big-bag tracking',
        'Shift handover logbooks with operator digital sign-offs',
      ],
      specsAr: [
        'قوائم مواد متعددة المستويات مع تحديد نسب الهدر المسموحة',
        'مراقبة استهلاك سكاكين طواحين الثرم وجدولة صيانتها الوقائية',
        'حساب نسبة استخلاص الخامات المطحونة وأرصدة الأكياس الكبيرة',
        'سجلات تسليم الورديات بين المشرفين مع توقيع إلكتروني',
      ],
    },
    {
      id: 'multi-tenant',
      category: 'ENTERPRISE',
      icon: <Building2 className="w-6 h-6 text-purple-400" />,
      badgeEn: 'SECURITY ARCHITECTURE',
      badgeAr: 'العزل المؤسسي',
      titleEn: 'Multi-Tenant Zero-Leak Data Partitioning',
      titleAr: 'بنية سحابية معزولة متعددة الشركات والمنشآت',
      descEn: 'Host independent operating companies, regional branches, or 3PL clients within a unified instance without any possibility of cross-tenant data contamination.',
      descAr: 'تشغيل عدة شركات وفروع ومراكز لوجستية مختلفة على نفس المنصة بحماية مطلقة وعزل برمجي تام لقواعد البيانات وسجلات الوصول.',
      specsEn: [
        'Granular Role-Based Access Control (RBAC) with 15+ permission nodes',
        'Organization-level currency, timezones, and numbering sequences',
        'Platform operator sovereign support impersonation with audit trails',
        'Strict tenant-scoped Firestore security rules validation',
      ],
      specsAr: [
        'مصفوفة صلاحيات تفصيلية تشمل أكثر من 15 مستوى إذن',
        'إعدادات عملة وتوقيت وترقيم مستندات مستقل لكل شركة',
        'وضع دعم فني سيادي مدقق بالكامل لمشرفي المنصة',
        'قواعد أمان سحابية صارمة تمنع الاستعلام عبر الشركات',
      ],
    },
    {
      id: 'predictive-ai',
      category: 'ENTERPRISE',
      icon: <BarChart3 className="w-6 h-6 text-rose-400" />,
      badgeEn: 'INTELLIGENCE',
      badgeAr: 'الذكاء التحليلي',
      titleEn: 'Telemetry, Sankey Flows & Predictive Analytics',
      titleAr: 'مخططات تدفق الخامات والتحليلات التنبؤية',
      descEn: 'Gain instant operational clarity with D3-powered material flow diagrams, inventory heatmaps, ABC item velocity classification, and automated safety stock notifications.',
      descAr: 'رؤية تشغيلية شاملة عبر مخططات Sankey التفاعلية لتدفق المواد، خرائط المخزون الحرارية، وتحليل ABC وسرعة دوران الأصناف لتفادي نفاد المخزون.',
      specsEn: [
        'Real-time warehouse heatmap showing occupied vs free rack bins',
        'D3 Sankey flow visualizer for raw-to-scrap conversion',
        'Automated reorder point calculation based on historical burn rate',
        'High-resolution PDF report generation for executive audits',
      ],
      specsAr: [
        'خريطة حرارية تفاعلية للأرفف المشغولة والمتاحة بالمستودع',
        'مخطط انسيابي لحركة المواد من الاستلام إلى التصنيع والثرم',
        'احتساب آلي لنقاط إعادة الطلب بناءً على معدل الاستهلاك الفعلي',
        'تصدير فوري لتقارير الجرد الشاملة بصيغة PDF عالية الدقة',
      ],
    },
  ];

  const filtered = featureModules.filter(
    (m) => selectedCategory === 'ALL' || m.category === selectedCategory
  );

  return (
    <div className="space-y-16 pb-20">
      {/* Header */}
      <section className="text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
          <Cpu className="w-3.5 h-3.5" />
          <span>{isRTL ? 'الكتالوج التقني للقدرات' : 'FULL ARCHITECTURAL CAPABILITIES'}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {isRTL
            ? 'منظومة شاملة للتحكم في المستودعات والعمليات'
            : 'Enterprise Capabilities Built for Maximum Industrial Rigor'}
        </h1>
        <p className="mt-4 text-xs sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
          {isRTL
            ? 'استكشف الموديولات والأنظمة الفرعية التي تضمن دقة المخزون بنسبة 99.9%، وتمنع الأخطاء البشرية في الموازين، وتدير مسارات التصنيع والتدوير.'
            : 'Discover the purpose-built modules delivering 99.9% inventory precision, automated weighbridge integration, and end-to-end material lifecycle tracking.'}
        </p>

        {/* Filter Tabs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {[
            { id: 'ALL', labelEn: 'All Capabilities', labelAr: 'كافة الخصائص' },
            { id: 'INVENTORY', labelEn: 'Inventory & Barcode', labelAr: 'المخزون والباركود' },
            { id: 'WEIGHBRIDGE', labelEn: 'Weighbridge & Scales', labelAr: 'الموازين والشاحنات' },
            { id: 'INDUSTRIAL', labelEn: 'Manufacturing & BOM', labelAr: 'التصنيع والتدوير' },
            { id: 'ENTERPRISE', labelEn: 'Security & Analytics', labelAr: 'الأمان والتحليلات' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                  : 'bg-[#0f1422] text-slate-300 hover:bg-[#161d30] border border-white/5'
              }`}
            >
              {isRTL ? cat.labelAr : cat.labelEn}
            </button>
          ))}
        </div>
      </section>

      {/* Feature Modules Deep Dive */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                    {isRTL ? item.badgeAr : item.badgeEn}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-3">
                  {isRTL ? item.titleAr : item.titleEn}
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  {isRTL ? item.descAr : item.descEn}
                </p>

                {/* Key specs */}
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {isRTL ? 'المواصفات الفنية المتقدمة:' : 'Technical Specifications:'}
                  </div>
                  {(isRTL ? item.specsAr : item.specsEn).map((spec, sIdx) => (
                    <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                <button
                  onClick={() => onNavigate('signup')}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{isRTL ? 'تجربة هذه الخاصية الآن' : 'Test This Feature Live'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Box */}
      <section className="max-w-5xl mx-auto px-4 text-center">
        <div className="p-8 rounded-3xl bg-[#0e1424] border border-cyan-500/30 shadow-2xl space-y-4">
          <h3 className="text-xl sm:text-2xl font-extrabold text-white">
            {isRTL
              ? 'هل تحتاج إلى تخصيص موديول محدد لمصنعك أو شبكتك؟'
              : 'Need a Custom Integration or Hardware Protocol Connector?'}
          </h3>
          <p className="text-xs text-slate-400 max-w-xl mx-auto">
            {isRTL
              ? 'فريق المهندسين لدينا جاهز لتقديم المشورة التقنية وربط موازينك الجسرية وأجهزتك بالمنصة السحابية.'
              : 'Our engineering specialists provide white-glove onboarding and industrial hardware integration for enterprise deployments.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => onNavigate('contact')}
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition"
            >
              {isRTL ? 'تواصل مع فريق الهندسة' : 'Speak to an Integration Specialist'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
