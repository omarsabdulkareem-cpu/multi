import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Boxes,
  Factory,
  RefreshCw,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useFactory } from '../../context/FactoryContext';
import { useTenant } from '../../context/TenantContext';
import { PlatformService } from '../../services/platformService';
import { PublicNavRoute } from './PublicNavbar';

interface PublicLoginPageProps {
  onNavigate: (route: PublicNavRoute) => void;
  onLoginSuccess: () => void;
}

export const PublicLoginPage: React.FC<PublicLoginPageProps> = ({
  onNavigate,
  onLoginSuccess,
}) => {
  const { isRTL } = useLanguage();
  const { loginWithGoogle, emergencyBypassAuth, authLoading, authError } = useFactory();
  const { organizations, switchOrganization, currentOrganization } = useTenant();
  const platformSettings = PlatformService.getPlatformSettings();
  const brandName = isRTL ? platformSettings.platformNameAr : platformSettings.platformName;

  const [email, setEmail] = useState('demo.manager@universal-warehouse.io');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedOrgId, setSelectedOrgId] = useState(currentOrganization.id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      onLoginSuccess();
    } catch (e) {
      console.warn('Google login note:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setIsSubmitting(true);
    try {
      if (selectedOrgId) {
        switchOrganization(selectedOrgId);
      }
      await emergencyBypassAuth();
      onLoginSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 space-y-6">
      {/* Top Header */}
      <div className="text-center space-y-2">
        <div
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 cursor-pointer group mb-2"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-0.5 shadow-md">
            <div className="w-full h-full bg-[#0d121f] rounded-[10px] flex items-center justify-center">
              <Boxes className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <span className="text-base font-black text-white">{brandName}</span>
        </div>

        <h1 className="text-2xl font-black text-white">
          {isRTL ? 'تسجيل الدخول إلى مساحة العمل' : 'Sign in to Your Workspace'}
        </h1>
        <p className="text-xs text-slate-400">
          {isRTL
            ? 'أدخل بيانات اعتماد حسابك للوصول إلى المستودعات والتقارير'
            : 'Enter your credentials to access your warehouse facilities'}
        </p>
      </div>

      {/* Main Login Card */}
      <div className="p-8 rounded-3xl bg-[#0c101c] border border-white/10 shadow-2xl relative space-y-5">
        {authError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {authError}
          </div>
        )}

        {/* Tenant Organization Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {isRTL ? 'المنشأة المستهدفة (Tenant)' : 'Target Organization (Tenant)'}
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {isRTL ? org.nameAr : org.nameEn} ({org.plan})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-semibold text-slate-300">
              {isRTL ? 'كلمة المرور' : 'Password'}
            </label>
            <span className="text-[11px] text-cyan-400 cursor-pointer hover:underline">
              {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </span>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#111624] border border-white/10 text-white text-xs outline-none focus:border-cyan-400"
          />
        </div>

        {/* Instant Access Button */}
        <button
          onClick={handleDemoSignIn}
          disabled={isSubmitting || authLoading}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer transition flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          <span>{isRTL ? 'تسجيل الدخول المباشر' : 'Sign In to Workspace'}</span>
        </button>

        <div className="relative flex items-center justify-center py-1">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-[#0c101c] px-3 text-[10px] text-slate-500 uppercase font-mono tracking-wider absolute">
            {isRTL ? 'أو' : 'OR'}
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || authLoading}
          className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs cursor-pointer transition flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isRTL ? 'الدخول بحساب Google' : 'Continue with Google'}</span>
        </button>

        {/* AL-KARWAN Demo Notice */}
        <div className="pt-2 text-center border-t border-white/5">
          <p className="text-[11px] text-slate-500">
            {isRTL
              ? 'هل ترغب في تجربة مصنع الكروان للبلاستيك التجريبي؟ اختر "شركة الكروان" من القائمة أعلاه.'
              : 'Looking for the Al-Karwan factory demo? Select Al-Karwan from the tenant dropdown above.'}
          </p>
        </div>
      </div>

      {/* Bottom Switcher */}
      <div className="text-center text-xs text-slate-400">
        <span>{isRTL ? 'ليس لديك منشأة مسجلة بعد؟' : "Don't have an organization yet?"} </span>
        <button
          onClick={() => onNavigate('signup')}
          className="text-cyan-400 font-bold hover:underline cursor-pointer"
        >
          {isRTL ? 'ابدأ تجربة مجانية 14 يوماً' : 'Start 14-Day Free Trial'}
        </button>
      </div>
    </div>
  );
};
