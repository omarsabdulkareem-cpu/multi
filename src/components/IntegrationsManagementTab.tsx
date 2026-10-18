import React, { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Ban,
  Clock,
  Eye,
  Activity,
  Layers,
  Lock,
  Terminal,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Webhook,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import {
  ApiScope,
  ALL_API_SCOPES,
  ApiIntegrationCredential,
  CreateIntegrationRequest,
  ApiAuditLog,
} from '../types/apiIntegration';
import { ApiIntegrationService } from '../services/apiIntegrationService';
import { ApiExplorerSection } from './ApiExplorerSection';
import { WebhooksManagementSection } from './WebhooksManagementSection';

export interface IntegrationsManagementTabProps {
  initialSubTab?: 'CREDENTIALS' | 'EXPLORER' | 'WEBHOOKS';
}

export const IntegrationsManagementTab: React.FC<IntegrationsManagementTabProps> = ({
  initialSubTab = 'CREDENTIALS',
}) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser } = useFactory();

  const [activeSubTab, setActiveSubTab] = useState<'CREDENTIALS' | 'EXPLORER' | 'WEBHOOKS'>(initialSubTab);
  const [integrations, setIntegrations] = useState<Omit<ApiIntegrationCredential, 'secretHash'>[]>([]);
  const [auditLogs, setAuditLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // Selected item for action
  const [selectedIntegration, setSelectedIntegration] = useState<Omit<ApiIntegrationCredential, 'secretHash'> | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // New integration form state
  const [createForm, setCreateForm] = useState<CreateIntegrationRequest>({
    name: '',
    description: '',
    scopes: ['items:read', 'inventory:read'],
    expiresInDays: 90,
    rateLimitPerMinute: 60,
  });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Permission check: Only Owner / Admin can manage credentials
  const canManage =
    currentUser?.role === 'Admin' ||
    currentUser?.name?.toLowerCase().includes('admin') ||
    currentUser?.name?.toLowerCase().includes('karwan');

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadData = () => {
    try {
      const creds = ApiIntegrationService.getIntegrations(currentOrganization.id);
      const logs = ApiIntegrationService.getAuditLogs(currentOrganization.id);
      setIntegrations(creds);
      setAuditLogs(logs);
    } catch (e: any) {
      console.warn('Error loading integrations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrganization.id]);

  // Handle Create Integration
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      showToast('error', isRTL ? 'يرجى إدخال اسم التكامل' : 'Integration name is required');
      return;
    }
    if (createForm.scopes.length === 0) {
      showToast('error', isRTL ? 'يرجى اختيار صلاحية واحدة على الأقل' : 'Please select at least one permission scope');
      return;
    }

    try {
      const res = await ApiIntegrationService.createIntegration(
        currentOrganization.id,
        createForm,
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );

      setShowCreateModal(false);
      setGeneratedSecret(res.rawSecret);
      setShowSecretModal(true);
      setCreateForm({
        name: '',
        description: '',
        scopes: ['items:read', 'inventory:read'],
        expiresInDays: 90,
        rateLimitPerMinute: 60,
      });
      loadData();
      showToast('success', isRTL ? 'تم إنشاء التكامل بنجاح' : 'API Integration generated successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create integration');
    }
  };

  // Handle Rotate Secret
  const handleConfirmRotate = async () => {
    if (!selectedIntegration) return;
    try {
      const res = await ApiIntegrationService.rotateIntegration(
        currentOrganization.id,
        selectedIntegration.id,
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );
      setShowRotateModal(false);
      setGeneratedSecret(res.rawSecret);
      setShowSecretModal(true);
      loadData();
      showToast('success', isRTL ? 'تم تدوير المفتاح السري بنجاح' : 'API secret rotated successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to rotate secret');
    }
  };

  // Handle Revoke Key
  const handleConfirmRevoke = async () => {
    if (!selectedIntegration) return;
    try {
      await ApiIntegrationService.revokeIntegration(
        currentOrganization.id,
        selectedIntegration.id,
        revokeReason || 'Revoked via Organization Settings',
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );
      setShowRevokeModal(false);
      setRevokeReason('');
      setSelectedIntegration(null);
      loadData();
      showToast('success', isRTL ? 'تم إبطال المفتاح فورياً' : 'API key revoked immediately');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to revoke key');
    }
  };

  const toggleScope = (scope: ApiScope) => {
    setCreateForm((prev) => {
      const exists = prev.scopes.includes(scope);
      return {
        ...prev,
        scopes: exists ? prev.scopes.filter((s) => s !== scope) : [...prev.scopes, scope],
      };
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 3000);
  };

  if (!canManage) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">
          {isRTL ? 'الوصول مقيد: إدارة مفاتيح الربط البرمجي (API)' : 'Access Restricted: API Credentials Management'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {isRTL
            ? 'فقط ملاك المنشأة ومديرو النظام المصرح لهم يمتلكون صلاحية توليد مفاتيح الربط البرمجي وإدارتها لحماية سرية البيانات وعزل المستودعات.'
            : 'Only Organization Owners and authorized Administrators possess permissions to provision, rotate, or revoke external API credentials.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Header & Description */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white text-base font-bold">
            <Key className="w-5 h-5 text-cyan-400" />
            <span>{isRTL ? 'إدارة مفاتيح وتكاملات الربط البرمجي (REST API)' : 'Secure API Integrations & Webhook Credentials'}</span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            {isRTL
              ? 'تتيح مفاتيح API للأنظمة الخارجية وتطبيقات ERP والناقلين الوصول لبيانات المستودع بصلاحيات دقيقة (Least Privilege). يتم تشفير الأسرار على الخادم وحظر أي وصول خارج نطاق المنشأة.'
              : 'Allows external ERP, logistics, and carrier systems to access warehouse records with granular least-privilege scopes. Secrets are hashed on the server with zero cross-tenant leakage.'}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer transition-all self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isRTL ? 'تسجيل تكامل جديد' : 'Register New Integration'}</span>
        </button>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('CREDENTIALS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === 'CREDENTIALS'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          <span>{isRTL ? 'المفاتيح والتكاملات المسجلة' : 'Registered Credentials & Audit'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950 text-slate-300 font-mono">
            {integrations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('EXPLORER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === 'EXPLORER'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>{isRTL ? 'مستكشف الـ API وتجربة الطلبات' : 'API Explorer & Sandbox Tester'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            LIVE
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('WEBHOOKS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === 'WEBHOOKS'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Webhook className="w-3.5 h-3.5" />
          <span>{isRTL ? 'الويب هوك وبث الأحداث' : 'Webhooks & Event Delivery'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-violet-950 text-violet-300 border border-violet-800 font-mono">
            STREAM
          </span>
        </button>
      </div>

      {activeSubTab === 'WEBHOOKS' && (
        <WebhooksManagementSection />
      )}

      {activeSubTab === 'EXPLORER' && (
        <ApiExplorerSection
          integrations={integrations}
          onReloadIntegrations={loadData}
        />
      )}

      {activeSubTab === 'CREDENTIALS' && (
        <>
          {/* Active Integrations List */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'المفاتيح والتكاملات المسجلة' : 'Registered Integrations'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {integrations.length}
            </span>
          </h4>
          <button
            onClick={loadData}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
        </div>

        {integrations.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl space-y-2">
            <Key className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
            <p>{isRTL ? 'لا توجد مفاتيح تكامل مسجلة لهذه المنشأة حالياً.' : 'No external API integrations provisioned yet.'}</p>
            <p className="text-[11px] text-slate-600">
              {isRTL ? 'اضغط على "تسجيل تكامل جديد" لتوليد مفتاح آمن.' : 'Click "Register New Integration" to generate a secure credential.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                  <th className="py-3 px-3">{isRTL ? 'اسم التكامل' : 'Integration Name'}</th>
                  <th className="py-3 px-3">{isRTL ? 'بادئة المفتاح' : 'Key Identifier'}</th>
                  <th className="py-3 px-3">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="py-3 px-3">{isRTL ? 'الصلاحيات الممنوحة' : 'Scopes'}</th>
                  <th className="py-3 px-3">{isRTL ? 'معدل الطلبات' : 'Rate Limit'}</th>
                  <th className="py-3 px-3">{isRTL ? 'تاريخ الانتهاء' : 'Expires At'}</th>
                  <th className="py-3 px-3">{isRTL ? 'آخر استخدام' : 'Last Used'}</th>
                  <th className="py-3 px-3 text-right">{isRTL ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {integrations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-1">{item.description}</div>
                      )}
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {isRTL ? 'أنشأه:' : 'By:'} {item.createdByName}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-cyan-300">
                      <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                        {item.keyPrefix}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : item.status === 'EXPIRED'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {item.scopes.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                              s.endsWith(':create')
                                ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {s}
                          </span>
                        ))}
                        {item.scopes.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                            +{item.scopes.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                      {item.rateLimitPerMinute} req/min
                    </td>

                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      {item.expiresAt ? (
                        <span>{new Date(item.expiresAt).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-slate-500">{isRTL ? 'دائم' : 'Never'}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-[11px] text-slate-400">
                      {item.lastUsedAt ? (
                        <span>{new Date(item.lastUsedAt).toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-600">{isRTL ? 'لم يستخدم' : 'Never'}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {item.status === 'ACTIVE' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedIntegration(item);
                              setShowRotateModal(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer transition-all border border-slate-700"
                            title={isRTL ? 'تدوير المفتاح' : 'Rotate Secret'}
                          >
                            <RefreshCw className="w-3 h-3 text-cyan-400" />
                            <span>{isRTL ? 'تدوير' : 'Rotate'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIntegration(item);
                              setShowRevokeModal(true);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-[11px] flex items-center gap-1 cursor-pointer transition-all border border-rose-800/40"
                            title={isRTL ? 'إبطال المفتاح' : 'Revoke Key'}
                          >
                            <Ban className="w-3 h-3 text-rose-400" />
                            <span>{isRTL ? 'إبطال' : 'Revoke'}</span>
                          </button>
                        </div>
                      )}
                      {item.status === 'REVOKED' && (
                        <span className="text-[11px] text-rose-400 italic">
                          {isRTL ? 'تم الإبطال' : 'Revoked'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Log Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>{isRTL ? 'سجل تدقيق الأمان وعمليات الـ API' : 'API Security & Audit Trail'}</span>
        </h4>
        <p className="text-xs text-slate-400">
          {isRTL
            ? 'سجل غير قابل للتعديل يوثق توليد وتدوير وإبطال المفاتيح، ومحاولات المصادقة المرفوضة وتجاوزات معدل الطلبات.'
            : 'Immutable record of key lifecycle events, rejected authentication attempts, authorization failures, and rate limit spikes.'}
        </p>

        {auditLogs.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs border border-slate-800 rounded-xl">
            {isRTL ? 'لا توجد سجلات تدقيق حتى الآن.' : 'No API audit records logged yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                  <th className="py-2.5 px-3">{isRTL ? 'الوقت' : 'Timestamp'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'الحدث' : 'Event Action'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'المسار' : 'Endpoint'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'التفاصيل' : 'Details'}</th>
                  <th className="py-2.5 px-3">{isRTL ? 'الحالة' : 'Result'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                {auditLogs.slice(0, 15).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/20">
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action.includes('FAILURE') || log.action.includes('BLOCKED')
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : log.action.includes('RATE_LIMIT')
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      <span className="text-slate-500">{log.method}</span> {log.endpoint}
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-sans">{log.details}</td>
                    <td className="py-2 px-3">
                      {log.success ? (
                        <span className="text-emerald-400 font-bold">SUCCESS</span>
                      ) : (
                        <span className="text-rose-400 font-bold">BLOCKED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* MODAL 1: REGISTER NEW INTEGRATION */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'تسجيل مفتاح ربط برمجي جديد' : 'Register New API Integration'}</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">
                  {isRTL ? 'اسم التكامل / التطبيق *' : 'Integration Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isRTL ? 'مثال: نظام ERP أوراكل، بوابة الشحن اللوجستي' : 'e.g. ERP Dynamics Connector, Logistics Dispatch Bot'}
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">
                  {isRTL ? 'الوصف والغرض التشغيلي' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isRTL ? 'الهدف من هذا المفتاح والجهة الخارجية المخولة باستخدامه...' : 'Operational purpose of this integration...'}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">
                    {isRTL ? 'صلاحيات الوصول الدقيقة (Least-Privilege Scopes) *' : 'Allowed Permission Scopes (Least Privilege) *'}
                  </label>
                  <span className="text-[11px] text-cyan-400">
                    {createForm.scopes.length} {isRTL ? 'محددة' : 'selected'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {isRTL
                    ? 'يمنح المفتاح حق الوصول فقط للمسارات المحددة. مفاتيح القراءة لا يمكنها إنشاء أو تعديل أي قيد مخزني.'
                    : 'The integration can only access checked endpoints. Read-only scopes strictly prohibit mutation.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {ALL_API_SCOPES.map((def) => {
                    const isChecked = createForm.scopes.includes(def.scope);
                    return (
                      <label
                        key={def.scope}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleScope(def.scope)}
                          className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-0"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-[11px]">
                            <span className="font-mono text-cyan-300">{def.scope}</span>
                            {def.isWriteAction && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                WRITE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1">
                            {isRTL ? def.descriptionAr : def.descriptionEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Expiration & Rate Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">
                    {isRTL ? 'فترة الصلاحية' : 'Credential Expiration'}
                  </label>
                  <select
                    value={createForm.expiresInDays === null ? 'never' : String(createForm.expiresInDays)}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        expiresInDays: e.target.value === 'never' ? null : Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="30">{isRTL ? '30 يوماً (موصى به)' : '30 Days (Recommended)'}</option>
                    <option value="60">{isRTL ? '60 يوماً' : '60 Days'}</option>
                    <option value="90">{isRTL ? '90 يوماً (ربع سنوي)' : '90 Days (Quarterly)'}</option>
                    <option value="365">{isRTL ? 'سنة واحدة' : '1 Year'}</option>
                    <option value="never">{isRTL ? 'دائم (بدون انتهاء)' : 'Never Expires'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">
                    {isRTL ? 'سقف معدل الطلبات' : 'Rate Limit (Requests / Min)'}
                  </label>
                  <select
                    value={createForm.rateLimitPerMinute}
                    onChange={(e) => setCreateForm({ ...createForm, rateLimitPerMinute: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="30">30 req/min (Strict / IoT)</option>
                    <option value="60">60 req/min (Standard)</option>
                    <option value="120">120 req/min (High Velocity)</option>
                    <option value="300">300 req/min (Batch Sync)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  {isRTL
                    ? 'سيتم عرض المفتاح السري لمرة واحدة فقط بعد التوليد. تأكد من نسخه وحفظه في بيئة آمنة.'
                    : 'The API secret will be displayed once after creation. Make sure to copy it immediately.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
                >
                  {isRTL ? 'توليد المفتاح الآن' : 'Generate Secret'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DISPLAY GENERATED SECRET (DISPLAYED ONCE) */}
      {showSecretModal && generatedSecret && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-6 h-6" />
              <span>{isRTL ? 'تم توليد مفتاح الربط البرمجي بنجاح' : 'API Secret Generated Successfully'}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {isRTL ? 'تحذير هام: انسخ المفتاح الآن!' : 'Important: Copy your API secret now!'}
                </p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  {isRTL
                    ? 'لحماية الأمان، لا يتم حفظ المفتاح بنص صريح على الخادم، ولن تتمكن من رؤيته مرة أخرى أبداً بعد إغلاق هذه النافذة.'
                    : 'For security reasons, this secret is hashed with SHA-256 and will NEVER be shown again after closing this dialog.'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">
                {isRTL ? 'المفتاح السري (API Key Secret)' : 'Raw API Secret'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedSecret}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedSecret)}
                  className={`px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0 transition-all ${
                    copiedSecret
                      ? 'bg-emerald-600 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }`}
                >
                  {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSecret ? (isRTL ? 'تم النسخ!' : 'Copied!') : (isRTL ? 'نسخ' : 'Copy')}</span>
                </button>
              </div>
            </div>

            {/* Quick Curl Sample */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span>{isRTL ? 'مثال على استدعاء cURL' : 'cURL Request Example'}</span>
              </label>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px] overflow-x-auto">
{`curl -X GET "https://your-domain/api/v1/items" \\
  -H "Authorization: Bearer ${generatedSecret}"`}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSecretModal(false);
                  setGeneratedSecret(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'لقد نسخت المفتاح بأمان، إغلاق' : 'I have copied the secret safely, close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM ROTATION */}
      {showRotateModal && selectedIntegration && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-400" />
              <span>{isRTL ? 'تأكيد تدوير المفتاح السري' : 'Confirm Secret Rotation'}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isRTL
                ? `هل أنت متأكد من تدوير المفتاح للتكامل "${selectedIntegration.name}"؟ سيتوقف المفتاح القديم عن العمل فوراً وسيتم توليد مفتاح جديد.`
                : `Are you sure you want to rotate credentials for "${selectedIntegration.name}"? The previous secret will immediately stop functioning.`}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRotateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRotate}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
              >
                {isRTL ? 'تدوير الآن' : 'Rotate Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRM REVOCATION */}
      {showRevokeModal && selectedIntegration && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-400" />
              <span>{isRTL ? 'تأكيد إبطال المفتاح نهائياً' : 'Confirm Permanent Key Revocation'}</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isRTL
                ? `سيتم إبطال المفتاح "${selectedIntegration.name}" فوراً وحظر جميع الطلبات القادمة باستخدامه. هذا الإجراء دائم ولا يمكن التراجع عنه.`
                : `Revoking "${selectedIntegration.name}" will permanently block all incoming API calls signed with this key. This action is irreversible.`}
            </p>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold">
                {isRTL ? 'سبب الإبطال (اختياري)' : 'Reason for Revocation (Optional)'}
              </label>
              <input
                type="text"
                placeholder={isRTL ? 'مثال: انتهاء التعاقد، اشتباه تسريب، تغيير النظام' : 'e.g. Contract terminated, vendor decommissioned'}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRevokeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRevoke}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
              >
                {isRTL ? 'إبطال المفتاح فوراً' : 'Revoke Key Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
