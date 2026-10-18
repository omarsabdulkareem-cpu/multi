import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useFactory } from '../../context/FactoryContext';
import { PublicNavbar, PublicNavRoute } from './PublicNavbar';
import { PublicFooter } from './PublicFooter';
import { PublicHomePage } from './PublicHomePage';
import { PublicFeaturesPage } from './PublicFeaturesPage';
import { PublicSolutionsPage } from './PublicSolutionsPage';
import { PublicPricingPage } from './PublicPricingPage';
import { PublicSecurityPage } from './PublicSecurityPage';
import { PublicAboutPage } from './PublicAboutPage';
import { PublicContactPage } from './PublicContactPage';
import { PublicLegalPages } from './PublicLegalPages';
import { PublicSignupPage } from './PublicSignupPage';
import { PublicLoginPage } from './PublicLoginPage';
import { PublicFunnelService } from '../../services/publicFunnelService';
import { PlanTier } from '../../types/saas';

interface PublicPortalHubProps {
  initialRoute?: PublicNavRoute;
  onEnterWorkspace: () => void;
}

export const PublicPortalHub: React.FC<PublicPortalHubProps> = ({
  initialRoute = 'home',
  onEnterWorkspace,
}) => {
  const { isRTL } = useLanguage();
  const { isAuthenticated } = useFactory();

  const [currentRoute, setCurrentRoute] = useState<PublicNavRoute>(() => {
    // Check window.location.pathname on load if available
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      if (['features', 'solutions', 'pricing', 'security', 'about', 'contact', 'terms', 'privacy', 'login', 'signup'].includes(path)) {
        return path as PublicNavRoute;
      }
    }
    return initialRoute;
  });

  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [preselectedPlanTier, setPreselectedPlanTier] = useState<PlanTier>('PROFESSIONAL');

  // Track page impression telemetry
  useEffect(() => {
    PublicFunnelService.recordFunnelEvent('PAGE_VIEW');
  }, [currentRoute]);

  const handleNavigate = (route: PublicNavRoute, planTier?: PlanTier) => {
    if (planTier) {
      setPreselectedPlanTier(planTier);
    }
    setCurrentRoute(route);
    // Sync browser URL history safely
    if (typeof window !== 'undefined') {
      const newPath = route === 'home' ? '/' : `/${route}`;
      window.history.pushState({}, '', newPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignupSuccess = () => {
    onEnterWorkspace();
  };

  const handleLoginSuccess = () => {
    onEnterWorkspace();
  };

  const renderActivePage = () => {
    switch (currentRoute) {
      case 'home':
        return (
          <PublicHomePage
            onNavigate={handleNavigate}
            selectedCurrency={selectedCurrency}
          />
        );
      case 'features':
        return <PublicFeaturesPage onNavigate={handleNavigate} />;
      case 'solutions':
        return <PublicSolutionsPage onNavigate={handleNavigate} />;
      case 'pricing':
        return (
          <PublicPricingPage
            onNavigate={handleNavigate}
            selectedCurrency={selectedCurrency}
          />
        );
      case 'security':
        return <PublicSecurityPage onNavigate={handleNavigate} />;
      case 'about':
        return <PublicAboutPage onNavigate={handleNavigate} />;
      case 'contact':
        return <PublicContactPage onNavigate={handleNavigate} />;
      case 'terms':
        return <PublicLegalPages initialTab="terms" />;
      case 'privacy':
        return <PublicLegalPages initialTab="privacy" />;
      case 'signup':
        return (
          <PublicSignupPage
            initialPlanTier={preselectedPlanTier}
            onNavigate={handleNavigate}
            onSignupSuccess={handleSignupSuccess}
            selectedCurrency={selectedCurrency}
          />
        );
      case 'login':
        return (
          <PublicLoginPage
            onNavigate={handleNavigate}
            onLoginSuccess={handleLoginSuccess}
          />
        );
      default:
        return (
          <PublicHomePage
            onNavigate={handleNavigate}
            selectedCurrency={selectedCurrency}
          />
        );
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200 ${
        isRTL ? 'rtl' : 'ltr'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Top Navbar */}
      <PublicNavbar
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        selectedCurrency={selectedCurrency}
        onCurrencyChange={setSelectedCurrency}
        onEnterWorkspace={onEnterWorkspace}
      />

      {/* Main Content Area */}
      <main className="flex-1">{renderActivePage()}</main>

      {/* Bottom Enterprise Footer */}
      <PublicFooter onNavigate={handleNavigate} />
    </div>
  );
};
