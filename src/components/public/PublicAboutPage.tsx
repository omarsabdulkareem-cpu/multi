import React from 'react';
import {
  Boxes,
  Globe,
  Award,
  Users,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Heart,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PublicNavRoute } from './PublicNavbar';

interface PublicAboutPageProps {
  onNavigate: (route: PublicNavRoute) => void;
}

export const PublicAboutPage: React.FC<PublicAboutPageProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();

  return (
    <div className="space-y-16 pb-20">
      {/* Header */}
      <section className="text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
          <Globe className="w-3.5 h-3.5" />
          <span>{isRTL ? 'رؤيتنا ورسالتنا' : 'OUR MISSION & ARCHITECTURE'}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {isRTL ? 'بناء البنية التحتية البرمجية للمستودعات الحديثة' : 'Re-Architecting Supply Chains with Modern Cloud Rigor'}
        </h1>
        <p className="mt-4 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {isRTL
            ? 'تأسست المنصة بهدف القضاء التام على الفروقات المخزنية، وأتمتة الموازين، وربط ساحات المستودعات والمصانع بأنظمة سحابية سريعة وسهلة الاستخدام.'
            : 'We engineer cloud-native warehouse and inventory infrastructure designed to replace error-prone spreadsheets with real-time double-entry precision.'}
        </p>
      </section>

      {/* Core Engineering Principles */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {isRTL ? 'الدقة المحاسبية المطلقة' : 'Zero-Discrepancy Precision'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRTL
                ? 'لا نعتمد على الحسابات التقديرية. كل حركة مخزنية هي قيد مزدوج مدقق بتسلسل زمني مشفر لمنع أي رصيد وهمي أو اختلال في الجرد.'
                : 'Every stock movement uses strict double-entry debits and credits. Negative stocks are banned at the engine level.'}
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {isRTL ? 'المرونة التشغيلية بلا انقطاع' : 'Offline Edge Resilience'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRTL
                ? 'ندرك أن شبكات المصانع والموازين قد تنقطع. لذلك صممنا المنصة لتعمل محلياً وتحفظ أوزان الشاحنات وتزامنها آلياً فور عودة الاتصال.'
                : 'Built with local IndexedDB persistence, scale operators continue logging gross/tare weights even through network outages.'}
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {isRTL ? 'ملكية وسيادة العميل لبياناته' : '100% Data Sovereignty'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isRTL
                ? 'العميل يملك كامل بياناته وسجلاته. لا نشارك البيانات، ولا نستخدمها لأي أغراض أخرى، ونوفر تصديراً فورياً ونسخاً احتياطية مشفرة في أي وقت.'
                : 'Our customers own their inventory data unconditionally. Full encrypted point-in-time exports are available anytime.'}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-10 rounded-3xl bg-[#0e1424] border border-white/10 shadow-2xl space-y-4">
          <h2 className="text-2xl font-black text-white">
            {isRTL ? 'انضم إلى شبكة المستودعات الذكية اليوم' : 'Join Next-Generation Warehouses Worldwide'}
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            {isRTL
              ? 'فريقنا مستعد لمساعدتك في إطلاق أول منشأة لك، واستيراد بياناتك التاريخية خلال أقل من يوم عمل واحد.'
              : 'Our engineers are ready to help onboard your warehouse facilities and migrate your historical balances.'}
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('signup')}
              className="px-8 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer transition shadow-lg"
            >
              {isRTL ? 'ابدأ تجربة مجانية 14 يوماً' : 'Get Started with Free 14-Day Trial'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
