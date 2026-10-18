import React, { useState } from 'react';
import {
  Boxes,
  Globe,
  Coins,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  LayoutDashboard,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useFactory } from '../../context/FactoryContext';
import { PlatformService } from '../../services/platformService';
import { SUPPORTED_CURRENCIES } from '../../services/publicFunnelService';

export type PublicNavRoute =
  | 'home'
  | 'features'
  | 'solutions'
  | 'pricing'
  | 'security'
  | 'about'
  | 'contact'
  | 'terms'
  | 'privacy'
  | 'login'
  | 'signup';

interface PublicNavbarProps {
  currentRoute: PublicNavRoute;
  onNavigate: (route: PublicNavRoute) => void;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  onEnterWorkspace?: () => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
  currentRoute,
  onNavigate,
  selectedCurrency,
  onCurrencyChange,
  onEnterWorkspace,
}) => {
  const { language, setLanguage, isRTL } = useLanguage();
  const { isAuthenticated } = useFactory();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  const platformSettings = PlatformService.getPlatformSettings();
  const brandName = isRTL ? platformSettings.platformNameAr : platformSettings.platformName;

  const navLinks: { route: PublicNavRoute; labelEn: string; labelAr: string }[] = [
    { route: 'home', labelEn: 'Home', labelAr: 'الرئيسية' },
    { route: 'features', labelEn: 'Features', labelAr: 'المزايا والخصائص' },
    { route: 'solutions', labelEn: 'Solutions', labelAr: 'حلول القطاعات' },
    { route: 'pricing', labelEn: 'Pricing', labelAr: 'الأسعار والخطط' },
    { route: 'security', labelEn: 'Security', labelAr: 'الأمان والامتثال' },
    { route: 'about', labelEn: 'About', labelAr: 'عن المنصة' },
    { route: 'contact', labelEn: 'Contact', labelAr: 'تواصل معنا' },
  ];

  const handleNavClick = (route: PublicNavRoute) => {
    onNavigate(route);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 bg-[#090b10]/95 backdrop-blur-xl border-b border-white/10 text-slate-100 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo & SaaS Name */}
          <div
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-shadow">
              <div className="w-full h-full bg-[#0d121f] rounded-[10px] flex items-center justify-center">
                <Boxes className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <div className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>{brandName}</span>
                <span className="hidden md:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold uppercase">
                  SaaS 2026
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                {isRTL
                  ? 'منصة سحابية متكاملة للمستودعات وسلاسل الإمداد'
                  : 'Cloud-Native Industrial & Multi-Tenant Warehouse OS'}
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navLinks.map((item) => {
              const active = currentRoute === item.route;
              return (
                <button
                  key={item.route}
                  onClick={() => handleNavClick(item.route)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isRTL ? item.labelAr : item.labelEn}
                </button>
              );
            })}
          </nav>

          {/* Actions: Currency, Language, Auth CTA */}
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Currency Selector */}
            <div className="relative">
              <button
                onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                title={isRTL ? 'تغيير العملة' : 'Select Currency'}
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono">
                  {selectedCurrency} (
                  {isRTL
                    ? SUPPORTED_CURRENCIES[selectedCurrency]?.symbolAr
                    : SUPPORTED_CURRENCIES[selectedCurrency]?.symbol}
                  )
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {currencyDropdownOpen && (
                <div
                  className="absolute top-full mt-2 w-44 rounded-xl bg-[#111624] border border-white/10 shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95"
                  style={{ [isRTL ? 'left' : 'right']: 0 }}
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <button
                      key={c.code}
                      onClick={() => {
                        onCurrencyChange(c.code);
                        setCurrencyDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        selectedCurrency === c.code
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{isRTL ? c.nameAr : c.nameEn}</span>
                      <span className="font-mono text-cyan-400">
                        {isRTL ? c.symbolAr : c.symbol}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              title={isRTL ? 'تبديل إلى الإنجليزية' : 'Switch to Arabic'}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            {/* Authenticated Workspace Shortcut or Login/Signup */}
            {isAuthenticated ? (
              <button
                onClick={onEnterWorkspace}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 cursor-pointer transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>{isRTL ? 'الدخول لمساحة العمل' : 'Enter Workspace'}</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('login')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/5 cursor-pointer transition"
                >
                  {isRTL ? 'تسجيل الدخول' : 'Sign In'}
                </button>

                <button
                  onClick={() => handleNavClick('signup')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/40 cursor-pointer transition-all transform hover:-translate-y-0.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'ابدأ تجربة مجانية 14 يوم' : 'Start 14-Day Free Trial'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex sm:hidden items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0a0d14] border-b border-white/10 px-4 pt-3 pb-6 space-y-3">
          <div className="grid grid-cols-2 gap-2 pb-3 border-b border-white/10">
            {navLinks.map((item) => (
              <button
                key={item.route}
                onClick={() => handleNavClick(item.route)}
                className={`text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                  currentRoute === item.route
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                {isRTL ? item.labelAr : item.labelEn}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-400">{isRTL ? 'العملة:' : 'Currency:'}</div>
            <select
              value={selectedCurrency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="px-2 py-1 bg-slate-900 border border-white/10 text-xs rounded text-slate-200"
            >
              {Object.keys(SUPPORTED_CURRENCIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {isAuthenticated ? (
              <button
                onClick={onEnterWorkspace}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs text-center"
              >
                {isRTL ? 'العودة لمساحة العمل' : 'Enter Workspace'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleNavClick('signup')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs text-center shadow-lg"
                >
                  {isRTL ? 'ابدأ تجربة مجانية 14 يوم' : 'Start 14-Day Free Trial'}
                </button>
                <button
                  onClick={() => handleNavClick('login')}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-semibold text-xs text-center"
                >
                  {isRTL ? 'تسجيل الدخول' : 'Sign In'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
