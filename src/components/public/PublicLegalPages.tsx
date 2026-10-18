import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { PlatformService } from '../../services/platformService';

interface PublicLegalPagesProps {
  initialTab?: 'terms' | 'privacy';
}

export const PublicLegalPages: React.FC<PublicLegalPagesProps> = ({ initialTab = 'terms' }) => {
  const { isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const platformSettings = PlatformService.getPlatformSettings();
  const brandName = isRTL ? platformSettings.platformNameAr : platformSettings.platformName;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Header & Tab Buttons */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
          <FileText className="w-3.5 h-3.5" />
          <span>{isRTL ? 'الشفافية والالتزام القانوني' : 'LEGAL & TRUST FRAMEWORK'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          {activeTab === 'terms'
            ? isRTL
              ? 'شروط الخدمة واتفاقية الاستخدام (SaaS)'
              : 'Terms of Service & SaaS Agreement'
            : isRTL
            ? 'سياسة الخصوصية وحماية بيانات المستودعات'
            : 'Enterprise Privacy Policy & Data Protection'}
        </h1>
        <p className="text-xs text-slate-400">
          {isRTL ? 'آخر تحديث: مارس 2026 • سارية لكافة المنشآت والشركات المشتركة' : 'Last updated: March 2026 • Applies to all tenant organizations'}
        </p>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 rounded-xl bg-[#0e1422] border border-white/10 mt-4">
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isRTL ? 'شروط الخدمة (Terms)' : 'Terms of Service'}
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isRTL ? 'سياسة الخصوصية (Privacy)' : 'Privacy Policy'}
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="p-8 sm:p-12 rounded-3xl bg-[#0c101c] border border-white/10 text-xs text-slate-300 leading-relaxed space-y-6 shadow-2xl">
        {activeTab === 'terms' ? (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">1. Provision of SaaS Subscription Services</h2>
              <p>
                {brandName} provides cloud-based multi-tenant warehouse management, weighbridge automation, inventory ledger accounting, and manufacturing work order tracking services. Subscribers are granted a non-exclusive, multi-user license for the duration of active subscription periods or approved 14-day evaluation trials.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">2. Free Trial & Grace Periods</h2>
              <p>
                All new tenant registrations include a 14-day unrestricted evaluation trial with zero credit card required. Following trial expiration, accounts enter a 7-day safe grace period in read-only mode to prevent unexpected operational interruption while subscriptions are activated.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">3. Customer Data Sovereignty & Portability</h2>
              <p>
                The subscribing organization maintains 100% legal ownership of all uploaded material records, weighbridge tickets, transactional ledger journals, employee identities, and business intelligence reports. Subscribers may download full encrypted JSON/Excel backups at any time.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">4. 99.99% Uptime SLA Commitment</h2>
              <p>
                The platform guarantees 99.99% monthly system availability across primary cloud database and scale ingestion endpoints, excluding scheduled maintenance windows announced at least 48 hours in advance.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">5. Fair Usage & Security Safeguards</h2>
              <p>
                Subscribers agree not to reverse-engineer, deliberately attempt cross-tenant privilege escalation, or inject malicious payloads into edge synchronization buffers. Any security violations trigger immediate cryptographic credential revocation.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">1. Information Collection & Purpose</h2>
              <p>
                We collect operational metadata necessary to process warehouse transactions, vehicle weighbridge gross/tare values, batch expiration records, and operator authentication timestamps. We never monetize, sell, or disclose customer trade secrets to third parties.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">2. Multi-Tenant Cryptographic Isolation</h2>
              <p>
                Customer datasets are isolated via tenant-scoped database security rules. No tenant can view, query, or enumerate records belonging to another company. All inter-service communications are encrypted in transit via TLS 1.3 and at rest with AES-256.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">3. Local Edge Persistence (IndexedDB)</h2>
              <p>
                To maintain warehouse operations during internet disruptions, sensitive weighbridge tickets and material transactions are temporarily persisted within the operator browser’s encrypted IndexedDB sandbox. These transactions synchronize automatically upon connectivity restoration and are scrubbed from transient memory.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-white">4. Data Deletion & Audit Trail Retention</h2>
              <p>
                Upon organization subscription cancellation, customers may request a complete database purge. Audit trails required for regulatory compliance will be exported to the customer in an encrypted archive prior to irrevocable deletion.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
