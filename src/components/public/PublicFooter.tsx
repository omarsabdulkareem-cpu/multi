import React from 'react';
import {
  Boxes,
  ShieldCheck,
  Lock,
  Server,
  Heart,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PlatformService } from '../../services/platformService';
import { PublicNavRoute } from './PublicNavbar';

interface PublicFooterProps {
  onNavigate: (route: PublicNavRoute) => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();
  const platformSettings = PlatformService.getPlatformSettings();
  const brandName = isRTL ? platformSettings.platformNameAr : platformSettings.platformName;

  return (
    <footer className="bg-[#05070c] border-t border-white/10 text-slate-400 text-xs font-sans">
      {/* Upper Footer: Trust & Certifications Bar */}
      <div className="border-b border-white/5 bg-[#090b12]/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-300">
              {isRTL
                ? 'جاهزية السحابة 99.99% • البنية التحتية العالمية مؤمنة ومشفرة بالكامل'
                : 'Operational Status: 99.99% Cloud SLA • Enterprise Infrastructure Healthy'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> SOC 2 Type II Certified
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              <Lock className="w-3.5 h-3.5 text-blue-400" /> ISO 27001 Aligned
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              <Server className="w-3.5 h-3.5 text-emerald-400" /> AES-256 / TLS 1.3
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> GDPR & Regional Compliant
            </span>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="col-span-2 space-y-4">
            <div
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 cursor-pointer group w-fit"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 p-0.5 shadow-md">
                <div className="w-full h-full bg-[#0d121f] rounded-[10px] flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
              <span className="text-base font-black text-white tracking-tight">
                {brandName}
              </span>
            </div>

            <p className="text-slate-400 leading-relaxed max-w-sm text-xs">
              {isRTL
                ? 'المنصة السحابية القياسية لإدارة المستودعات، الجرد الفوري، أتمتة الموازين، تتبع الدفعات وتكامل خطوط الإنتاج عبر بنية متقدمة متعددة الشركات.'
                : 'Next-generation cloud warehouse management SaaS delivering real-time stock ledgers, dual weighbridge scales, batch/serial lifecycle tracing, and multi-tenant isolation.'}
            </p>

            <div className="pt-2 flex flex-col gap-1.5 text-slate-400 text-xs">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>{platformSettings.supportEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {isRTL
                    ? 'الرياض • دبي • بغداد • لندن • فرانكفورت (سحابة موزعة)'
                    : 'Global Cloud Regions: Riyadh • Dubai • Baghdad • Frankfurt'}
                </span>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              {isRTL ? 'المنتج والمزايا' : 'Product'}
            </div>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('features')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'كتالوج الخصائص الشامل' : 'Core Features'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('features')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'سجل حركات المخزن المزدوج' : 'Double-Entry Ledger'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('features')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'أتمتة الميزان الجسري' : 'Weighbridge Automation'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('features')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'تتبع الدفعات وتواريخ الصلاحية' : 'Lot & Batch Traceability'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('pricing')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'الخطط وباقات الأسعار' : 'Subscription Plans'}
                </button>
              </li>
            </ul>
          </div>

          {/* Industry Solutions */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              {isRTL ? 'حلول القطاعات' : 'Solutions'}
            </div>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('solutions')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'الصناعات البلاستيكية والتدوير' : 'Plastics & Recycling'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('solutions')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'المصانع وخطوط الإنتاج' : 'Industrial Manufacturing'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('solutions')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'الأغذية والسلع الاستهلاكية FMCG' : 'Food & Perishables'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('solutions')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'تجارة الجملة والتوزيع' : 'Wholesale Distribution'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('solutions')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'شركات الخدمات اللوجستية 3PL' : '3PL Logistics Hubs'}
                </button>
              </li>
            </ul>
          </div>

          {/* Trust, Legal & Company */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              {isRTL ? 'الأمان والشروط' : 'Trust & Legal'}
            </div>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onNavigate('security')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'مركز الأمان والموثوقية' : 'Security Architecture'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('terms')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'شروط الخدمة واتفاقية SaaS' : 'Terms of Service'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('privacy')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'سياسة الخصوصية وحماية البيانات' : 'Privacy Policy'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'نبذة عن المنصة وفريق العمل' : 'About the Platform'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-cyan-400 transition-colors"
                >
                  {isRTL ? 'طلب عرض أسعار واستشارة' : 'Sales Inquiry'}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} {brandName}. {isRTL ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('privacy')}
              className="hover:text-slate-300 transition-colors"
            >
              {isRTL ? 'الخصوصية' : 'Privacy'}
            </button>
            <button
              onClick={() => onNavigate('terms')}
              className="hover:text-slate-300 transition-colors"
            >
              {isRTL ? 'الشروط' : 'Terms'}
            </button>
            <button
              onClick={() => onNavigate('security')}
              className="hover:text-slate-300 transition-colors"
            >
              {isRTL ? 'الأمان' : 'Security'}
            </button>
            <button
              onClick={() => onNavigate('contact')}
              className="hover:text-slate-300 transition-colors"
            >
              {isRTL ? 'الدعم الفني' : 'Support'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
