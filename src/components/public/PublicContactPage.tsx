import React, { useState } from 'react';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle2,
  Sparkles,
  Building2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PlatformService } from '../../services/platformService';
import { PublicFunnelService, PublicContactLead } from '../../services/publicFunnelService';
import { PublicNavRoute } from './PublicNavbar';

interface PublicContactPageProps {
  onNavigate: (route: PublicNavRoute) => void;
}

export const PublicContactPage: React.FC<PublicContactPageProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();
  const platformSettings = PlatformService.getPlatformSettings();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Manufacturing');
  const [warehouseCount, setWarehouseCount] = useState(2);
  const [inquiryType, setInquiryType] = useState<PublicContactLead['inquiryType']>('DEMO_REQUEST');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !companyName) {
      setErrorMessage(
        isRTL
          ? 'يرجى إكمال الحقول الإلزامية: الاسم، البريد الإلكتروني، واسم الشركة.'
          : 'Please fill in required fields: Full Name, Email, and Company Name.'
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await PublicFunnelService.submitLead({
        fullName,
        email,
        phone,
        companyName,
        industry,
        warehouseCount,
        inquiryType,
        message,
      });

      setSubmittedLeadId(created.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Header */}
      <section className="text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold mb-4">
          <Mail className="w-3.5 h-3.5" />
          <span>{isRTL ? 'تواصل مع خبراء المنصة' : 'CONNECT WITH OUR SOLUTION SPECIALISTS'}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          {isRTL ? 'نحن هنا لمساعدتك في إطلاق عملياتك بنجاح' : 'Let’s Discuss Your Warehouse Architecture'}
        </h1>
        <p className="mt-4 text-xs sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          {isRTL
            ? 'سواء كنت بحاجة إلى استشارة لربط موازين الشاحنات، أو ترغب في عرض حي مخصص لقطاعك، فريقنا جاهز للتواصل معك خلال ساعات.'
            : 'Get a tailored platform demonstration, customized enterprise pricing, or scale indicator hardware consultation.'}
        </p>
      </section>

      {/* Main Grid: Form + Info */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Information Sidebar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 shadow-xl space-y-6">
              <h3 className="text-lg font-bold text-white">
                {isRTL ? 'قنوات الاتصال المباشر' : 'Direct Inquiry Channels'}
              </h3>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {isRTL ? 'البريد الإلكتروني المباشر:' : 'Enterprise Sales & Inquiries:'}
                    </div>
                    <div className="font-mono text-cyan-400 mt-0.5">{platformSettings.supportEmail}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {isRTL ? 'أوقات استجابة الفريق:' : 'Fast SLA Response Time:'}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {isRTL
                        ? 'أقل من ساعتين خلال أيام العمل (الأحد - الخميس)'
                        : 'Under 2 hours during business operations (Sun - Thu)'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {isRTL ? 'المراكز الإقليمية:' : 'Regional Deployment Gateways:'}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {isRTL
                        ? 'الرياض • دبي • بغداد • فرانكفورت (سحابة موزعة عالية الأمان)'
                        : 'Riyadh • Dubai • Baghdad • Frankfurt (Tier-4 Datacenters)'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 text-xs text-cyan-200">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-cyan-300">
                    <Sparkles className="w-4 h-4" />
                    <span>{isRTL ? 'هل تفضل التجربة المباشرة؟' : 'Prefer Immediate Access?'}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {isRTL
                      ? 'يمكنك إنشاء منشأتك والبدء فوراً دون انتظار الموافقة.'
                      : 'You can provision your tenant organization right away without waiting.'}
                  </p>
                  <button
                    onClick={() => onNavigate('signup')}
                    className="mt-3 text-cyan-400 font-bold hover:underline cursor-pointer"
                  >
                    {isRTL ? 'الانتقال للتسجيل الفوري 14 يوماً ←' : 'Launch 14-Day Free Trial →'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contact / Lead Submission Form */}
          <div className="lg:col-span-7">
            <div className="p-8 sm:p-10 rounded-3xl bg-[#0c101c] border border-white/10 shadow-2xl relative">
              {submittedLeadId ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {isRTL ? 'تم استلام طلبك بنجاح!' : 'Inquiry Received Successfully!'}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    {isRTL
                      ? `شكراً لتواصلك معنا. تم تسجيل طلبك بالرقم المرجعي (${submittedLeadId}). سيتواصل معك أحد مهندسي الحلول خلال أقل من ساعتين.`
                      : `Thank you for reaching out. Your request reference number is (${submittedLeadId}). Our solutions engineer will contact you promptly.`}
                  </p>
                  <div className="pt-4 flex justify-center gap-4">
                    <button
                      onClick={() => {
                        setSubmittedLeadId(null);
                        setMessage('');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition cursor-pointer"
                    >
                      {isRTL ? 'إرسال استفسار إضافي' : 'Send Another Inquiry'}
                    </button>
                    <button
                      onClick={() => onNavigate('signup')}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                    >
                      {isRTL ? 'بدء التجربة المجانية الآن' : 'Start 14-Day Free Trial'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {isRTL ? 'نموذج طلب استشارة وعرض أسعار' : 'Request a Custom Solution Demo'}
                  </h3>

                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'الاسم الكامل *' : 'Full Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe / د. أحمد العمري"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'البريد الإلكتروني للعمل *' : 'Work Email *'}
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'اسم الشركة أو المصنع *' : 'Company Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Acme Logistics Ltd"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'رقم الهاتف / الواتساب' : 'Phone / WhatsApp'}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+966 50 000 0000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'القطاع الصناعي' : 'Industry'}
                      </label>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      >
                        <option value="Plastics & Recycling">Plastics & Recycling / تدوير البلاستيك</option>
                        <option value="Manufacturing">Manufacturing / تصنيع وإنتاج</option>
                        <option value="FMCG & Food">FMCG & Food / أغذية وسلع استهلاكية</option>
                        <option value="Wholesale">Wholesale / تجارة وتوزيع جملة</option>
                        <option value="3PL Logistics">3PL Logistics / خدمات لوجستية للغير</option>
                        <option value="Other">Other / قطاع آخر</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'عدد المستودعات' : 'Warehouses'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={warehouseCount}
                        onChange={(e) => setWarehouseCount(parseInt(e.target.value) || 1)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isRTL ? 'نوع الطلب' : 'Inquiry Type'}
                      </label>
                      <select
                        value={inquiryType}
                        onChange={(e) => setInquiryType(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
                      >
                        <option value="DEMO_REQUEST">Demo Request / طلب عرض حي</option>
                        <option value="ENTERPRISE_QUOTE">Enterprise Quote / عرض سعر مخصص</option>
                        <option value="PRICING_INQUIRY">Pricing / استفسار أسعار</option>
                        <option value="PARTNERSHIP">Partnership / شراكة وتكامل</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isRTL ? 'تفاصيل إضافية أو متطلبات خاصة' : 'Message or Operational Notes'}
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        isRTL
                          ? 'أخبرنا عن الموازين، أحجام الشحنات، أو الأنظمة التي ترغب بالربط معها...'
                          : 'Tell us about your weighbridges, scale indicators, or existing ERP...'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSubmitting
                        ? isRTL
                          ? 'جاري إرسال الطلب...'
                          : 'Submitting...'
                        : isRTL
                        ? 'إرسال طلب الاستشارة والعرض الحي'
                        : 'Submit Enterprise Inquiry'}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
