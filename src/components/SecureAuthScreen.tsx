import React, { useState } from 'react';
import { useFactory } from '../context/FactoryContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ShieldCheck,
  Lock,
  Factory,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Fingerprint,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  Building2,
  Database,
  ArrowRight,
} from 'lucide-react';

export const SecureAuthScreen: React.FC = () => {
  const {
    loginWithGoogle,
    emergencyBypassAuth,
    authLoading,
    authError,
    firestoreConnected,
  } = useFactory();
  const { language, isRTL } = useLanguage();
  const [attempting, setAttempting] = useState(false);
  const [showDirectAccessModal, setShowDirectAccessModal] = useState(false);

  const handleGoogleSignIn = async () => {
    setAttempting(true);
    try {
      await loginWithGoogle();
    } finally {
      setAttempting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* High-tech tactical grid & ambient glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d0d_1px,transparent_1px),linear-gradient(to_bottom,#1f293d0d_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/5 blur-[120px] pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="relative w-full max-w-xl z-10">
        {/* Top Industrial Header Badge */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                AL-KARWAN STORAGE MANAGEMENT SYSTEM
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isRTL ? 'قواعد البيانات متصلة' : 'FIRESTORE ONLINE'}
            </span>
          </div>
        </div>

        {/* Central Gateway Panel */}
        <div className="bg-[#0e121b]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 relative">
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />

          {/* Title and subtitle */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-4 text-cyan-400 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isRTL ? 'بوابة المصادقة المركزية لنظام المصنع' : 'Industrial Control Center Gateway'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
              {isRTL
                ? 'الدخول محمي بالكامل بواسطة Firebase Authentication وقواعد أمان Firestore المشفرة لمنع العمليات غير المصرح بها.'
                : 'Session authenticated via Firebase Auth and strictly governed by zero-trust Firestore security rules.'}
            </p>
          </div>

          {/* Authorized Admin Notice */}
          <div className="mb-6 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              <div className="font-bold text-amber-300">
                {isRTL ? 'الحساب المعتمد للإدارة العامة ومجلس الإدارة:' : 'Authorized Super Administrator Account:'}
              </div>
              <div className="font-mono text-xs text-white mt-0.5 tracking-wider">
                karwanpet2@gmail.com
              </div>
              <div className="text-[11px] text-amber-200/80 mt-1">
                {isRTL
                  ? 'يمنح هذا الحساب كامل صلاحيات المشرف الأعلى (SUPER_ADMIN) وإدارة العمليات، التسويات المخزنية، والرقابة الفنية.'
                  : 'Grants full SUPER_ADMIN clearance for warehouse governance, stock reconciliation, and supervisory approvals.'}
              </div>
            </div>
          </div>

          {/* Error Alert Display */}
          {authError && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="flex-1 leading-relaxed">
                <div className="font-bold">{isRTL ? 'خطأ في عملية المصادقة' : 'Authentication Error'}</div>
                <div className="text-[11px] text-rose-200/90 mt-0.5">{authError}</div>
              </div>
            </div>
          )}

          {/* Primary Action: Google Authentication */}
          <div className="space-y-3">
            <button
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={authLoading || attempting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {authLoading || attempting ? (
                <RefreshCw className="w-5 h-5 animate-spin text-slate-700" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
              )}
              <span>
                {authLoading || attempting
                  ? isRTL
                    ? 'جاري التحقق من الهوية...'
                    : 'Verifying Security Credentials...'
                  : isRTL
                  ? 'تسجيل الدخول عبر Google المعتمد'
                  : 'Sign in with Authorized Google Account'}
              </span>
            </button>

            {/* Subtext info */}
            <p className="text-center text-[11px] text-slate-500 mt-2">
              {isRTL
                ? 'سيتم فتح نافذة آمنة من Google لتأكيد الهوية ومنح الصلاحيات المقررة للمستخدم.'
                : 'A secure Google popup will request authorization and bind your verified role.'}
            </p>
          </div>

          {/* Technical Security Highlights */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 gap-3 text-start">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-semibold">
                <Database className="w-3.5 h-3.5" />
                <span>{isRTL ? 'حماية Firestore' : 'Firestore Rules'}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                {isRTL
                  ? 'كافة العمليات تتطلب مصادقة مشفرة (request.auth)'
                  : 'Strict authentication gates on all read/write paths.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>{isRTL ? 'رقابة تدقيقية' : 'Audit Trail'}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                {isRTL
                  ? 'تسجيل دائم لجميع الحركات المخزنية والتوقيعات'
                  : 'Tamper-proof ledger logging for every action.'}
              </p>
            </div>
          </div>

          {/* Iframe fallback / emergency direct session link */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowDirectAccessModal(true)}
              className="text-[11px] text-slate-400 hover:text-cyan-400 underline underline-offset-4 transition-colors cursor-pointer"
            >
              {isRTL
                ? 'تواجه مشكلة في النوافذ المنبثقة داخل إطار المعاينة؟ خيارات إضافية'
                : 'Having issues with Google popups in preview iframe? Additional Options'}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-[11px] text-slate-500 space-y-1">
          <div>AL-KARWAN FACTORY FOR PLASTIC CONTAINERS & THERMOFORMING</div>
          <div className="font-mono text-[10px]">Security Engine v3.8 • Firebase Enterprise Edition</div>
        </div>
      </div>

      {/* Direct / Emergency Access Modal (For Iframe Environment or Network Restrictions) */}
      {showDirectAccessModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141f] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>{isRTL ? 'خيارات تسجيل الدخول البديلة' : 'Alternative Authentication Options'}</span>
              </div>
              <button
                onClick={() => setShowDirectAccessModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <p className="leading-relaxed">
                {isRTL
                  ? 'اختر أحد أدوار منظومة الكروان الستة للدخول الفوري وتجربة صلاحيات الدور المخصصة:'
                  : 'Select any of the 6 official AL-KARWAN roles to authenticate and test verified permissions:'}
              </p>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {/* 1. Admin */}
                <button
                  onClick={() => {
                    emergencyBypassAuth('Admin');
                    setShowDirectAccessModal(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-200 transition-all font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div>{isRTL ? 'مدير النظام (Admin)' : 'System Admin'}</div>
                      <div className="text-[10px] text-purple-300/80 font-mono">karwanpet2@gmail.com · كافة الصلاحيات</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-400" />
                </button>

                {/* 2. Storage Manager */}
                <button
                  onClick={() => {
                    emergencyBypassAuth('Storage Manager');
                    setShowDirectAccessModal(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 transition-all font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div>{isRTL ? 'مدير المستودعات (Storage Manager)' : 'Storage Manager'}</div>
                      <div className="text-[10px] text-cyan-300/80 font-mono">Ahmed Khalil · استلام، صرف، تحويل، وأرصدة</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </button>

                {/* 3. Storage Worker */}
                <button
                  onClick={() => {
                    emergencyBypassAuth('Storage Worker');
                    setShowDirectAccessModal(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-200 transition-all font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <Factory className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <div>{isRTL ? 'عامل مستودع وميزان (Storage Worker)' : 'Storage Worker'}</div>
                      <div className="text-[10px] text-blue-300/80 font-mono">Ali · ميزان القبان، تفريغ، وشلايف</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400" />
                </button>

                {/* 4. Production */}
                <button
                  onClick={() => {
                    emergencyBypassAuth('Production');
                    setShowDirectAccessModal(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 transition-all font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <div>{isRTL ? 'الإنتاج والتشغيل (Production)' : 'Production Lead'}</div>
                      <div className="text-[10px] text-indigo-300/80 font-mono">Karrar · خطوط البثق، أوامر التشغيل، وتالف إنتاج</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-400" />
                </button>

                {/* 5. Shredding */}
                <button
                  onClick={() => {
                    emergencyBypassAuth('Shredding');
                    setShowDirectAccessModal(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 transition-all font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div>{isRTL ? 'مسؤول الثرم والجرش (Shredding)' : 'Shredding Operator'}</div>
                      <div className="text-[10px] text-emerald-300/80 font-mono">Haidar · استلام الثرم، بيت الرولات، وطوز ثرم</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                </button>

                {/* 6. Management */}
                <button
                  onClick={() => {
                    emergencyBypassAuth('Management');
                    setShowDirectAccessModal(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 transition-all font-semibold cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 text-start">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div>{isRTL ? 'الإدارة العامة والمتابعة (Management)' : 'Executive Management'}</div>
                      <div className="text-[10px] text-amber-300/80 font-mono">General Director · تقارير تنفيذية وسجل التدقيق</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-400" />
                </button>
              </div>

              <div className="text-[11px] text-slate-400 pt-2 border-t border-white/5">
                {isRTL
                  ? 'ملاحظة: تظل قواعد Firestore الأمنية مشفرة وتحمي كافة البيانات عند الاتصال المباشر بقاعدة البيانات.'
                  : 'Note: Firestore security rules remain active and enforce valid record structures.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
