import React from 'react';
import {
  ShieldCheck,
  Lock,
  Server,
  Key,
  Database,
  FileCheck,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicNavRoute } from './PublicNavbar';

interface PublicSecurityPageProps {
  onNavigate: (route: PublicNavRoute) => void;
}

export const PublicSecurityPage: React.FC<PublicSecurityPageProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();

  const securityPillars = [
    {
      icon: <Lock className="w-6 h-6 text-cyan-400" />,
      titleEn: 'Zero-Trust Tenant Data Isolation',
      titleAr: 'عزل برمجي صارم للبيانات (Zero-Trust)',
      descEn: 'Every database query and storage operation is cryptographically validated at the database engine level. Tenant organizations are strictly partitioned with zero chance of cross-tenant exposure.',
      descAr: 'يتم التحقق من كافة الاستعلامات وقواعد البيانات على مستوى محرك التخزين المشفر. بيانات الشركات معزولة تماماً ولا يمكن لأي مستأجر الوصول لبيانات آخر.',
    },
    {
      icon: <Database className="w-6 h-6 text-emerald-400" />,
      titleEn: 'Cryptographic Hash-Chain Ledger',
      titleAr: 'سلسلة تجزئة مشفرة لحركات المخزن',
      descEn: 'Stock ledger movements utilize sequential hash verification. Modifying or tampering with historical transactions immediately breaks the cryptographic verification seal.',
      descAr: 'تسجيل حركات المخزون بختم تجزئة تسلسلي مشفر، مما يجعل التلاعب بسجلات الصرف أو الاستلام السابقة مستحيلاً ويكشف أي تعديل غير مصرح به.',
    },
    {
      icon: <Key className="w-6 h-6 text-amber-400" />,
      titleEn: 'End-to-End Encryption (At Rest & In Transit)',
      titleAr: 'تشفير كامل للبيانات أثناء التخزين والنقل',
      descEn: 'All data is secured using AES-256 encryption at rest and enforced TLS 1.3 encryption in transit across multi-region edge gateways.',
      descAr: 'تشفير كامل لكافة البيانات والأوزان والملفات المخزنة بخوارزمية AES-256، واستخدام بروتوكول TLS 1.3 فائق الأمان لكافة الاتصالات.',
    },
    {
      icon: <HardDrive className="w-6 h-6 text-blue-400" />,
      titleEn: 'Disaster Recovery: RPO < 15m, RTO < 5m',
      titleAr: 'التعافي من الكوارث والنسخ الاحتياطي اللحظي',
      descEn: 'Continuous automated platform snapshots, air-gapped point-in-time recovery, and multi-zone failover protect operations against unexpected failures.',
      descAr: 'لقطات آلية مستمرة لقواعد البيانات مع إمكانية استعادة سريعة للأنظمة واختبارات دورية لخطة استمرارية الأعمال للحد من زمن التوقف.',
    },
  ];

  const complianceBadges = [
    { name: 'SOC 2 Type II', desc: 'Security, Availability & Confidentiality audited' },
    { name: 'ISO/IEC 27001', desc: 'Information Security Management System standards' },
    { name: 'GDPR & Privacy', desc: '100% Customer Data Ownership and residency controls' },
    { name: '99.99% Cloud SLA', desc: 'Contractual uptime guarantee with financial backing' },
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* Header */}
      <section className="text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{isRTL ? 'الأمان المؤسسي والامتثال' : 'ENTERPRISE SECURITY & COMPLIANCE'}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {isRTL ? 'أمان دفاعي متقدم لحماية أصولك وسلاسل إمدادك' : 'Military-Grade Security for Critical Supply Chain Data'}
        </h1>
        <p className="mt-4 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {isRTL
            ? 'صممت المنصة لتعمل كدرع رقمي محصن لبيانات مستودعاتك، مع حماية صارمة للخصوصية، وسجلات تدقيق غير قابلة للتعديل، وجاهزية سحابية موثوقة.'
            : 'Designed from day one to protect high-value industrial inventory and commercial transactions with zero-trust multi-tenancy and audit transparency.'}
        </p>
      </section>

      {/* Security Pillars Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {securityPillars.map((p, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 hover:border-cyan-500/40 transition-all shadow-xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                {p.icon}
              </div>
              <h2 className="text-lg font-bold text-white mb-2">
                {isRTL ? p.titleAr : p.titleEn}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isRTL ? p.descAr : p.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance & Standards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0e1424] border border-white/10 shadow-2xl">
          <h2 className="text-xl sm:text-2xl font-extrabold text-white text-center mb-8">
            {isRTL ? 'الشهادات والمعايير الدولية المعتمدة' : 'Industry Standards & Compliance Rigor'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {complianceBadges.map((b, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#111728] border border-white/10 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-3" />
                <div className="text-sm font-bold text-white mb-1">{b.name}</div>
                <div className="text-[11px] text-slate-400">{b.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 text-center">
            <button
              onClick={() => onNavigate('contact')}
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition shadow-lg"
            >
              {isRTL ? 'طلب المستند الأبيض الأمني والتفاصيل التقنية' : 'Request Enterprise Security Whitepaper'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
