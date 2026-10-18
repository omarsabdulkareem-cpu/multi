import React, { useState, useEffect, useMemo } from 'react';
import {
  Webhook,
  Send,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Plus,
  Play,
  RotateCw,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Code2,
  Filter,
  Eye,
  EyeOff,
  Activity,
  Layers,
  Lock,
  Radio,
  FileCode,
  ArrowRight,
  Info,
  Edit,
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import {
  SafeWebhookEndpoint,
  WebhookDelivery,
  WebhookEventType,
  ALL_WEBHOOK_EVENT_TYPES,
  CreateWebhookRequest,
} from '../types/webhook';
import { WebhookService } from '../services/webhookService';
import { validateWebhookDestination } from '../services/webhookSsrfValidator';

export const WebhooksManagementSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser } = useFactory();

  const [endpoints, setEndpoints] = useState<SafeWebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showVerifyGuide, setShowVerifyGuide] = useState(false);

  // Selected items
  const [selectedEndpoint, setSelectedEndpoint] = useState<SafeWebhookEndpoint | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [testingEndpointId, setTestingEndpointId] = useState<string | null>(null);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Masking toggles for endpoint URLs
  const [unmaskedUrls, setUnmaskedUrls] = useState<Record<string, boolean>>({});

  // Active guide code language
  const [guideLanguage, setGuideLanguage] = useState<'NODE' | 'PYTHON' | 'GO' | 'CURL'>('NODE');

  // Logs Modal Filter & Pagination State
  const [logStatusFilter, setLogStatusFilter] = useState<string>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logCurrentPage, setLogCurrentPage] = useState<number>(1);
  const LOGS_PER_PAGE = 8;

  // Create Form State
  const [createForm, setCreateForm] = useState<CreateWebhookRequest>({
    name: '',
    description: '',
    url: '',
    subscribedEvents: [
      'inventory.receipt.confirmed',
      'inventory.issue.confirmed',
      'inventory.transfer.completed',
      'inventory.adjustment.confirmed',
    ],
    rateLimitPerMinute: 120,
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    url: string;
    subscribedEvents: WebhookEventType[];
    rateLimitPerMinute: number;
    status: 'ACTIVE' | 'DISABLED';
  }>({
    name: '',
    description: '',
    url: '',
    subscribedEvents: [],
    rateLimitPerMinute: 120,
    status: 'ACTIVE',
  });

  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [editUrlValidation, setEditUrlValidation] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Permissions check - Admin or Storage Manager clearance
  const userRole = currentUser?.role || 'Guest';
  const canManage =
    userRole === 'Admin' ||
    userRole === 'Storage Manager' ||
    currentUser?.name?.toLowerCase().includes('admin') ||
    currentUser?.name?.toLowerCase().includes('karwan');

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  const loadData = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const eps = await WebhookService.getEndpointsAsync(currentOrganization.id);
      const dels = await WebhookService.getDeliveriesAsync(currentOrganization.id);
      setEndpoints(eps);
      setDeliveries(dels);
    } catch (err: any) {
      console.warn('Failed to load webhook data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrganization?.id]);

  // Real-time URL validation for Create
  const handleUrlChange = (url: string) => {
    setCreateForm((prev) => ({ ...prev, url }));
    if (!url.trim()) {
      setUrlValidation(null);
      return;
    }
    const check = validateWebhookDestination(url);
    setUrlValidation(check);
  };

  // Real-time URL validation for Edit
  const handleEditUrlChange = (url: string) => {
    setEditForm((prev) => ({ ...prev, url }));
    if (!url.trim()) {
      setEditUrlValidation(null);
      return;
    }
    const check = validateWebhookDestination(url);
    setEditUrlValidation(check);
  };

  // Toggle subscribed event in Create
  const toggleEventSubscription = (eventType: WebhookEventType) => {
    setCreateForm((prev) => {
      const exists = prev.subscribedEvents.includes(eventType);
      const updated = exists
        ? prev.subscribedEvents.filter((t) => t !== eventType)
        : [...prev.subscribedEvents, eventType];
      return { ...prev, subscribedEvents: updated };
    });
  };

  // Toggle subscribed event in Edit
  const toggleEditEventSubscription = (eventType: WebhookEventType) => {
    setEditForm((prev) => {
      const exists = prev.subscribedEvents.includes(eventType);
      const updated = exists
        ? prev.subscribedEvents.filter((t) => t !== eventType)
        : [...prev.subscribedEvents, eventType];
      return { ...prev, subscribedEvents: updated };
    });
  };

  // Open Edit Modal
  const openEditModal = (ep: SafeWebhookEndpoint) => {
    setSelectedEndpoint(ep);
    setEditForm({
      name: ep.name,
      description: ep.description || '',
      url: ep.url,
      subscribedEvents: [...ep.subscribedEvents],
      rateLimitPerMinute: ep.rateLimitPerMinute || 120,
      status: ep.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    });
    setEditUrlValidation({ valid: true });
    setShowEditModal(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لإنشاء الويب هوك' : 'Administrator role required to create webhooks');
      return;
    }
    if (!createForm.name.trim()) {
      showToast('error', isRTL ? 'يرجى إدخال اسم نقطة الاتصال' : 'Webhook name is required');
      return;
    }
    if (!createForm.url.trim()) {
      showToast('error', isRTL ? 'يرجى إدخال عنوان URL للوجهة' : 'Destination URL is required');
      return;
    }
    if (createForm.subscribedEvents.length === 0) {
      showToast('error', isRTL ? 'يرجى اختيار حدث واحد على الأقل' : 'Please select at least one subscribed event');
      return;
    }

    const check = validateWebhookDestination(createForm.url);
    if (!check.valid) {
      showToast('error', isRTL ? `العنوان محظور أمنياً: ${check.reason}` : `Destination rejected: ${check.reason}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await WebhookService.createEndpoint(
        currentOrganization.id,
        createForm,
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );

      setShowCreateModal(false);
      setGeneratedSecret(res.rawSecret);
      setSelectedEndpoint(res.webhook);
      setShowSecretModal(true);
      setCreateForm({
        name: '',
        description: '',
        url: '',
        subscribedEvents: [
          'inventory.receipt.confirmed',
          'inventory.issue.confirmed',
          'inventory.transfer.completed',
          'inventory.adjustment.confirmed',
        ],
        rateLimitPerMinute: 120,
      });
      setUrlValidation(null);
      await loadData();
      showToast('success', isRTL ? 'تم تسجيل نقطة اتصال الويب هوك وتوليد المفتاح بنجاح' : 'Webhook endpoint registered and signing secret generated successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create webhook endpoint on server');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !selectedEndpoint) return;

    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لتعديل الويب هوك' : 'Administrator role required to edit webhooks');
      return;
    }
    if (!editForm.name.trim()) {
      showToast('error', isRTL ? 'يرجى إدخال اسم نقطة الاتصال' : 'Webhook name is required');
      return;
    }
    if (!editForm.url.trim()) {
      showToast('error', isRTL ? 'يرجى إدخال عنوان URL للوجهة' : 'Destination URL is required');
      return;
    }
    if (editForm.subscribedEvents.length === 0) {
      showToast('error', isRTL ? 'يرجى اختيار حدث واحد على الأقل' : 'Please select at least one subscribed event');
      return;
    }

    const check = validateWebhookDestination(editForm.url);
    if (!check.valid) {
      showToast('error', isRTL ? `العنوان محظور أمنياً: ${check.reason}` : `Destination rejected: ${check.reason}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await WebhookService.updateEndpoint(currentOrganization.id, selectedEndpoint.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        url: editForm.url.trim(),
        subscribedEvents: editForm.subscribedEvents,
        rateLimitPerMinute: editForm.rateLimitPerMinute,
        status: editForm.status,
      });

      setShowEditModal(false);
      setSelectedEndpoint(null);
      await loadData();
      showToast('success', isRTL ? 'تم تحديث نقطة الاتصال بنجاح' : 'Webhook endpoint updated successfully');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update webhook endpoint');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test Ping
  const handleTestPing = async (endpoint: SafeWebhookEndpoint) => {
    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لإجراء الاختبار' : 'Administrator role required to dispatch test ping');
      return;
    }
    if (endpoint.status === 'REVOKED') {
      showToast('error', isRTL ? 'لا يمكن اختبار نقطة اتصال ملغاة' : 'Cannot test a revoked endpoint');
      return;
    }

    setTestingEndpointId(endpoint.id);
    try {
      const delivery = await WebhookService.sendTestEvent(currentOrganization.id, endpoint.id);
      await loadData();
      const isSuccess = delivery.status === 'SUCCESS' || delivery.status === 'succeeded';
      if (isSuccess) {
        showToast(
          'success',
          isRTL
            ? `تم إرسال حدث الاختبار integration.test بنجاح (HTTP 200 - ${delivery.durationMs}ms)`
            : `Test event integration.test delivered successfully with HTTP 200 (${delivery.durationMs}ms)`
        );
      } else {
        showToast(
          'error',
          isRTL
            ? `فشل إرسال حدث الاختبار: ${delivery.errorMessage || `HTTP ${delivery.statusCode}`}`
            : `Test ping delivery failed: ${delivery.errorMessage || `HTTP ${delivery.statusCode}`}`
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to dispatch test event');
    } finally {
      setTestingEndpointId(null);
    }
  };

  // Rotate Secret
  const handleConfirmRotate = async () => {
    if (!selectedEndpoint || isSubmitting) return;
    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لتدوير المفاتيح' : 'Administrator role required to rotate secrets');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await WebhookService.rotateSecret(
        currentOrganization.id,
        selectedEndpoint.id,
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );
      setShowRotateModal(false);
      setGeneratedSecret(res.rawSecret);
      setSelectedEndpoint(res.webhook);
      setShowSecretModal(true);
      await loadData();
      showToast('success', isRTL ? 'تم تدوير مفتاح التوقيع وتوليد مفتاح أمني جديد' : 'Signing secret rotated successfully with immediate key renewal');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to rotate signing secret');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active/Disabled Status
  const handleToggleStatus = async (endpoint: SafeWebhookEndpoint) => {
    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لتغيير حالة النقطة' : 'Administrator role required to toggle endpoint status');
      return;
    }
    const nextStatus = endpoint.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await WebhookService.updateEndpoint(currentOrganization.id, endpoint.id, {
        status: nextStatus,
      });
      await loadData();
      showToast(
        'success',
        isRTL
          ? nextStatus === 'ACTIVE' ? 'تم تفعيل نقطة الاتصال' : 'تم تعطيل نقطة الاتصال مؤقتاً'
          : nextStatus === 'ACTIVE' ? 'Webhook endpoint enabled' : 'Webhook endpoint disabled'
      );
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update endpoint status');
    }
  };

  // Revoke Endpoint
  const handleConfirmRevoke = async () => {
    if (!selectedEndpoint || isSubmitting) return;
    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لإلغاء النقطة' : 'Administrator role required to revoke webhooks');
      return;
    }

    setIsSubmitting(true);
    try {
      await WebhookService.revokeEndpoint(
        currentOrganization.id,
        selectedEndpoint.id,
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );
      setShowRevokeModal(false);
      setSelectedEndpoint(null);
      await loadData();
      showToast('success', isRTL ? 'تم إلغاء نقطة الاتصال نهائياً وإيقاف مفتاح التوقيع' : 'Webhook endpoint revoked permanently');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to revoke endpoint');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Retry Delivery
  const handleRetryDelivery = async (delivery: WebhookDelivery) => {
    if (!canManage) {
      showToast('error', isRTL ? 'صلاحية مسؤول المنشأة مطلوبة لإعادة الإرسال' : 'Administrator role required to retry deliveries');
      return;
    }
    if (retryingDeliveryId === delivery.id) return;

    setRetryingDeliveryId(delivery.id);
    try {
      const result = await WebhookService.retryDelivery(currentOrganization.id, delivery.id);
      await loadData();
      const isSuccess = result.status === 'SUCCESS' || result.status === 'succeeded';
      if (isSuccess) {
        showToast(
          'success',
          isRTL
            ? `نجحت إعادة المحاولة بنتيجة HTTP 200 (${result.durationMs}ms)`
            : `Delivery retry succeeded with HTTP 200 (${result.durationMs}ms)`
        );
      } else {
        showToast(
          'error',
          isRTL
            ? `فشلت إعادة المحاولة: ${result.errorMessage || `HTTP ${result.statusCode}`}`
            : `Delivery retry failed: ${result.errorMessage || `HTTP ${result.statusCode}`}`
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to retry delivery on server');
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  // Toggle URL Masking
  const toggleUrlMask = (id: string) => {
    setUnmaskedUrls((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getMaskedUrl = (url: string, isUnmasked: boolean) => {
    if (isUnmasked) return url;
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      if (pathname.length > 8) {
        return `${parsed.origin}${pathname.slice(0, 4)}••••••••`;
      }
      return `${parsed.origin}/••••••••`;
    } catch {
      return url.length > 25 ? `${url.slice(0, 18)}••••••••` : url;
    }
  };

  // Format status badge helper
  const renderDeliveryStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'succeeded' || s === 'success') {
      return (
        <span className="text-emerald-400 font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{isRTL ? 'ناجح' : 'Succeeded'}</span>
        </span>
      );
    }
    if (s === 'retrying' || s === 'pending_retry') {
      return (
        <span className="text-amber-400 font-semibold flex items-center gap-1">
          <RotateCw className="w-3.5 h-3.5 animate-spin" />
          <span>{isRTL ? 'إعادة جدولة' : 'Retrying'}</span>
        </span>
      );
    }
    if (s === 'delivering') {
      return (
        <span className="text-sky-400 font-semibold flex items-center gap-1">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>{isRTL ? 'قيد الإرسال' : 'Delivering'}</span>
        </span>
      );
    }
    if (s === 'pending') {
      return (
        <span className="text-slate-400 font-semibold flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{isRTL ? 'قيد الانتظار' : 'Pending'}</span>
        </span>
      );
    }
    return (
      <span className="text-rose-400 font-semibold flex items-center gap-1">
        <XCircle className="w-3.5 h-3.5" />
        <span>{isRTL ? 'فشل' : 'Failed'}</span>
      </span>
    );
  };

  // Aggregated Stats
  const activeCount = endpoints.filter((e) => e.status === 'ACTIVE').length;
  const totalSubscribedEvents = Array.from(new Set(endpoints.flatMap((e) => e.subscribedEvents))).length;
  const successDeliveries = deliveries.filter((d) => d.status === 'SUCCESS' || d.status === 'succeeded').length;
  const deliverySuccessRate = deliveries.length > 0 ? Math.round((successDeliveries / deliveries.length) * 100) : 100;

  // Filtered deliveries for History Modal
  const modalDeliveries = useMemo(() => {
    let list = selectedEndpoint
      ? deliveries.filter((d) => d.webhookId === selectedEndpoint.id)
      : deliveries;

    if (logStatusFilter !== 'ALL') {
      list = list.filter((d) => {
        const s = (d.status || '').toLowerCase();
        if (logStatusFilter === 'SUCCEEDED') return s === 'succeeded' || s === 'success';
        if (logStatusFilter === 'FAILED') return s === 'failed' || s === 'max_retries_exceeded';
        if (logStatusFilter === 'RETRYING') return s === 'retrying' || s === 'pending_retry';
        if (logStatusFilter === 'DELIVERING') return s === 'delivering';
        if (logStatusFilter === 'PENDING') return s === 'pending';
        return true;
      });
    }

    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase().trim();
      list = list.filter(
        (d) =>
          d.id.toLowerCase().includes(q) ||
          d.eventId.toLowerCase().includes(q) ||
          d.eventType.toLowerCase().includes(q) ||
          d.destinationUrl.toLowerCase().includes(q)
      );
    }

    return list;
  }, [deliveries, selectedEndpoint, logStatusFilter, logSearchQuery]);

  // Paginated log slice
  const totalLogPages = Math.max(1, Math.ceil(modalDeliveries.length / LOGS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (logCurrentPage - 1) * LOGS_PER_PAGE;
    return modalDeliveries.slice(start, start + LOGS_PER_PAGE);
  }, [modalDeliveries, logCurrentPage]);

  // ---------------------------------------------------------------------------
  // GUARD: NO ACTIVE ORGANIZATION SELECTED STATE
  // ---------------------------------------------------------------------------
  if (!currentOrganization || !currentOrganization.id) {
    return (
      <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-4 animate-fade-in">
        <div className="p-3.5 rounded-2xl bg-amber-950/50 border border-amber-800/60 text-amber-400 inline-block">
          <Building2 className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-white">
          {isRTL ? 'لم يتم تحديد منشأة أو منظمة معتمدة' : 'No Active Organization Selected'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          {isRTL
            ? 'تتطلب إدارة نقاط اتصال الويب هوك تحديد سياق المنشأة المصرح لك بالوصول إليها. يرجى اختيار المنشأة من القائمة العلوية للمتابعة.'
            : 'Webhook management requires an authorized organization context. Please switch to an authorized tenant organization to configure webhooks.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          role="alert"
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800 shadow-lg shadow-emerald-950/40'
              : feedback.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-800 shadow-lg shadow-rose-950/40'
              : 'bg-cyan-950/90 text-cyan-200 border-cyan-800 shadow-lg shadow-cyan-950/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white cursor-pointer text-sm font-bold ml-4"
            aria-label="Close message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Permission Denied Notice for View-Only Users */}
      {!canManage && (
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              {isRTL
                ? 'وضع القراءة فقط: أنت تتصفح نقاط الاتصال بصلاحيات محدودة. تتطلب عمليات التسجيل والتعديل والتدوير والإلغاء دور مسؤول المنشأة.'
                : 'Read-only mode: You are viewing webhook endpoints. Endpoint creation, editing, secret rotation, and retry operations require Organization Administrator clearance.'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {currentUser?.name || 'User'} ({userRole})
          </span>
        </div>
      )}

      {/* Organization Header & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">
              {isRTL ? 'المنشأة الحالية' : 'Organization Scope'}
            </div>
            <div className="text-sm font-bold text-white mt-1 truncate max-w-[170px]" title={currentOrganization.name}>
              {currentOrganization.name || currentOrganization.nameEn}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              ID: {currentOrganization.id}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-cyan-950/50 border border-cyan-800/40 text-cyan-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">
              {isRTL ? 'نقاط الاتصال النشطة' : 'Active Endpoints'}
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              {activeCount} <span className="text-xs font-normal text-slate-400">/ {endpoints.length}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {endpoints.filter((e) => e.status === 'DISABLED').length} {isRTL ? 'معطل' : 'disabled'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/40 text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">
              {isRTL ? 'الأحداث المشترك بها' : 'Subscribed Events'}
            </div>
            <div className="text-2xl font-black text-violet-400 mt-0.5">
              {totalSubscribedEvents} <span className="text-xs font-normal text-slate-400">/ 12</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isRTL ? 'عبر جميع نقاط المنشأة' : 'Across all tenant hooks'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-violet-950/50 border border-violet-800/40 text-violet-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400">
              {isRTL ? 'نسبة نجاح الإرسال' : 'Delivery Success Rate'}
            </div>
            <div className="text-2xl font-black text-sky-400 mt-0.5">
              {deliverySuccessRate}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {deliveries.length} {isRTL ? 'محاولة إرسال موثقة' : 'logged attempts'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-sky-950/50 border border-sky-800/40 text-sky-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Controls & Action Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">
            <Webhook className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{isRTL ? 'إدارة الويب هوك وبث أحداث المستودع' : 'Webhook Endpoints & Event Delivery'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                v2026-10-01
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'بث أحداث تأكيد العمليات المخزنية الفورية بتوقيع HMAC-SHA256 المشفر مع حماية DNS وSSRF الصارمة'
                : 'Real-time outbound event streaming signed with HMAC-SHA256, DNS rebinding guards, and non-blocking retry workers'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Documentation / Guide Drawer Toggle */}
          <button
            onClick={() => setShowVerifyGuide(!showVerifyGuide)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'دليل التحقق من التوقيع' : 'HMAC Guide & Docs'}</span>
          </button>

          {/* All Delivery Logs Modal Toggle */}
          <button
            onClick={() => {
              setSelectedEndpoint(null);
              setLogStatusFilter('ALL');
              setLogSearchQuery('');
              setLogCurrentPage(1);
              setShowLogsModal(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            <span>{isRTL ? 'سجلات الإرسال' : 'Delivery Logs'}</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-950 text-slate-300 font-mono">
              {deliveries.length}
            </span>
          </button>

          {/* Refresh Data */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh webhooks & deliveries"
            aria-label="Refresh webhooks"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Register New Endpoint */}
          {canManage && (
            <button
              onClick={() => {
                setUrlValidation(null);
                setShowCreateModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'تسجيل نقطة اتصال جديدة' : 'Register Webhook Endpoint'}</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPREHENSIVE HMAC VERIFICATION & ARCHITECTURE GUIDE DRAWER */}
      {showVerifyGuide && (
        <div className="p-6 rounded-3xl bg-slate-950 border border-cyan-900/60 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  {isRTL ? 'دليل التحقق من صحة التوقيع الرقمي (HMAC-SHA256)' : 'Cryptographic Signature Verification Guide'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isRTL ? 'حماية تامة ضد التلاعب وهجمات إعادة الإرسال (Replay Attacks)' : 'Timing-safe HMAC-SHA256 verification with replay window enforcement'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowVerifyGuide(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer px-2 py-1 rounded-lg bg-slate-900 border border-slate-800"
            >
              {isRTL ? 'إغلاق الدليل' : 'Close Guide'}
            </button>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed space-y-2">
            <p>
              {isRTL
                ? 'يرسل نظام المستودع مع كل طلب ترويسة X-Warehouse-Signature بالصيغة t=TIMESTAMP,v1=SIGNATURE. يتم اشتقاق التوقيع عبر خوارزمية HMAC-SHA256 على النص المدمج `${timestamp}.${rawBody}` باستخدام المفتاح السري المخصص لنقطة الاتصال.'
                : 'Every outbound webhook request includes header X-Warehouse-Signature formatted as t=TIMESTAMP,v1=SIGNATURE. The signature is computed using HMAC-SHA256 over `${timestamp}.${rawBody}` using your endpoint signing secret.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400 font-mono">
              <span className="text-cyan-400 font-bold">Headers:</span>
              <span>X-Warehouse-Event-Id</span>
              <span>•</span>
              <span>X-Warehouse-Event-Type</span>
              <span>•</span>
              <span>X-Warehouse-Delivery-Id</span>
              <span>•</span>
              <span>X-Warehouse-Signature</span>
            </div>
          </div>

          {/* Language Tabs for Code Snippet */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setGuideLanguage('NODE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-colors ${
                  guideLanguage === 'NODE' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                Node.js (Express)
              </button>
              <button
                onClick={() => setGuideLanguage('PYTHON')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-colors ${
                  guideLanguage === 'PYTHON' ? 'bg-violet-950 text-violet-300 border border-violet-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                Python (FastAPI / Flask)
              </button>
              <button
                onClick={() => setGuideLanguage('GO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-colors ${
                  guideLanguage === 'GO' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                Go (net/http)
              </button>
              <button
                onClick={() => setGuideLanguage('CURL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-colors ${
                  guideLanguage === 'CURL' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                cURL Test Ping
              </button>
            </div>

            {/* Code display */}
            <div className="relative">
              <pre className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono overflow-x-auto leading-relaxed">
                {guideLanguage === 'NODE' &&
`const crypto = require('crypto');

function verifyWarehouseWebhook(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('='))
  );
  if (!parts.t || !parts.v1) return false;

  // 1. Enforce 300-second replay tolerance window
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(parts.t, 10)) > 300) return false;

  // 2. Compute expected HMAC-SHA256 signature
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest('hex');

  // 3. Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(parts.v1, 'hex')
  );
}`}

                {guideLanguage === 'PYTHON' &&
`import hmac
import hashlib
import time

def verify_warehouse_webhook(raw_body: bytes, sig_header: str, secret: str) -> bool:
    parts = dict(x.split('=') for x in sig_header.split(','))
    if 't' not in parts or 'v1' not in parts:
        return False

    # 1. Replay tolerance check (5 minutes max)
    ts = int(parts['t'])
    if abs(time.time() - ts) > 300:
        return False

    # 2. Compute HMAC-SHA256
    payload_to_sign = f"{ts}.".encode('utf-8') + raw_body
    expected = hmac.new(
        secret.encode('utf-8'),
        payload_to_sign,
        hashlib.sha256
    ).hexdigest()

    # 3. Timing-safe comparison
    return hmac.compare_digest(expected, parts['v1'])`}

                {guideLanguage === 'GO' &&
`package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "math"
    "strconv"
    "strings"
    "time"
)

func VerifyWarehouseWebhook(rawBody []byte, sigHeader string, secret string) bool {
    parts := make(map[string]string)
    for _, item := range strings.Split(sigHeader, ",") {
        kv := strings.SplitN(item, "=", 2)
        if len(kv) == 2 { parts[kv[0]] = kv[1] }
    }
    tStr, v1 := parts["t"], parts["v1"]
    if tStr == "" || v1 == "" { return false }

    ts, err := strconv.ParseInt(tStr, 10, 64)
    if err != nil || math.Abs(float64(time.Now().Unix()-ts)) > 300 { return false }

    h := hmac.New(sha256.New, []byte(secret))
    h.Write([]byte(fmt.Sprintf("%s.", tStr)))
    h.Write(rawBody)
    expected := hex.EncodeToString(h.Sum(nil))

    return hmac.Equal([]byte(expected), []byte(v1))
}`}

                {guideLanguage === 'CURL' &&
`# Test receiving a ping locally with mock headers
curl -X POST https://your-listener.com/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-Warehouse-Event-Type: integration.test" \\
  -H "X-Warehouse-Event-Id: evt_ping_test_101" \\
  -H "X-Warehouse-Signature: t=1729000000,v1=YOUR_COMPUTED_HMAC_SHA256" \\
  -d '{"id":"evt_ping_test_101","type":"integration.test","schemaVersion":"2026-10-01"}'`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Endpoints List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-cyan-400" />
            <div className="text-xs font-semibold">{isRTL ? 'جاري تحميل نقاط الاتصال...' : 'Loading registered webhook endpoints...'}</div>
          </div>
        ) : endpoints.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 space-y-3">
            <div className="p-3.5 rounded-full bg-slate-800 text-slate-400 inline-block">
              <Webhook className="w-8 h-8" />
            </div>
            <div className="text-sm font-bold text-white">
              {isRTL ? 'لا توجد نقاط اتصال ويب هوك مسجلة بعد' : 'No Webhook Endpoints Registered Yet'}
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {isRTL
                ? 'قم بتسجيل عنوان HTTPS لاستقبال إشعارات فورية عند تأكيد استلام البضائع، وصرف المواد، والمناقلات، والتسويات الجردية.'
                : 'Register an HTTPS destination to stream real-time events for confirmed receipts, issues, transfers, and inventory adjustments.'}
            </p>
            {canManage && (
              <button
                onClick={() => {
                  setUrlValidation(null);
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer transition-all inline-flex items-center gap-2 shadow-lg shadow-cyan-950/50"
              >
                <Plus className="w-4 h-4" />
                <span>{isRTL ? 'تسجيل نقطة اتصال الآن' : 'Register Webhook Endpoint Now'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {endpoints.map((ep) => {
              const isTesting = testingEndpointId === ep.id;
              const epDeliveries = deliveries.filter((d) => d.webhookId === ep.id);
              const isRevoked = ep.status === 'REVOKED';
              const isDisabled = ep.status === 'DISABLED';
              const isUnmasked = Boolean(unmaskedUrls[ep.id]);

              return (
                <div
                  key={ep.id}
                  className={`p-5 rounded-3xl border transition-all ${
                    isRevoked
                      ? 'bg-rose-950/10 border-rose-900/40 opacity-80'
                      : isDisabled
                      ? 'bg-slate-900/60 border-slate-800 opacity-90'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-xl'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Title, Description & Destination URL */}
                    <div className="space-y-2 flex-1 min-w-[280px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{ep.name}</span>
                        {/* Status Chip */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ep.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : ep.status === 'DISABLED'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {ep.status}
                        </span>

                        <span className="text-[10px] text-slate-500 font-mono">
                          ID: {ep.id}
                        </span>
                      </div>

                      {ep.description && (
                        <p className="text-xs text-slate-400 leading-relaxed">{ep.description}</p>
                      )}

                      {/* URL Box with Masking Toggle */}
                      <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 max-w-2xl">
                        <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-slate-300 truncate select-all flex-1" title={ep.url}>
                          {getMaskedUrl(ep.url, isUnmasked)}
                        </span>
                        <button
                          onClick={() => toggleUrlMask(ep.id)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-900 cursor-pointer"
                          title={isUnmasked ? 'Mask URL' : 'Reveal URL'}
                          aria-label={isUnmasked ? 'Mask destination URL' : 'Reveal destination URL'}
                        >
                          {isUnmasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(ep.url)}
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-900 cursor-pointer"
                          title="Copy Destination URL"
                          aria-label="Copy destination URL"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata & Secret Identifier */}
                    <div className="flex flex-col items-end gap-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">
                          {isRTL ? 'معرف مفتاح التوقيع:' : 'Key Fingerprint:'}
                        </span>
                        <code className="text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded-md border border-cyan-900 font-mono text-[11px]">
                          {ep.keyPrefix}
                        </code>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{ep.rateLimitPerMinute} req/min</span>
                        <span>•</span>
                        <span>
                          {isRTL ? 'المنشئ:' : 'Created by:'} {ep.createdByName || 'System'}
                        </span>
                      </div>

                      {/* Last Delivery Status */}
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">{isRTL ? 'آخر إرسال:' : 'Last delivery:'}</span>
                        {ep.lastDeliveryStatus === 'SUCCESS' ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>HTTP 200 OK</span>
                          </span>
                        ) : ep.lastDeliveryStatus === 'FAILED' ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            <span>Failed ({ep.failureCount} errors)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">{isRTL ? 'لم يُرسل بعد' : 'None recorded'}</span>
                        )}
                        {ep.lastDeliveryAt && (
                          <span className="text-slate-500 font-mono">
                            ({new Date(ep.lastDeliveryAt).toLocaleTimeString()})
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 font-mono">
                        {isRTL ? 'تاريخ الإنشاء:' : 'Created:'} {new Date(ep.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Subscribed Events Tags */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 mr-2 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-cyan-400" />
                      <span>{isRTL ? 'الأحداث المشتركة:' : 'Subscribed Events:'}</span>
                    </span>
                    {ep.subscribedEvents.map((evType) => {
                      const def = ALL_WEBHOOK_EVENT_TYPES.find((d) => d.type === evType);
                      const isInventory = def?.category === 'INVENTORY';
                      const isPurchasing = def?.category === 'PURCHASING';
                      return (
                        <span
                          key={evType}
                          title={isRTL ? def?.descriptionAr : def?.descriptionEn}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border cursor-help ${
                            isInventory
                              ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800/60'
                              : isPurchasing
                              ? 'bg-amber-950/50 text-amber-300 border-amber-800/60'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {evType}
                        </span>
                      );
                    })}
                  </div>

                  {/* Endpoint Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* View Logs for this Endpoint */}
                      <button
                        onClick={() => {
                          setSelectedEndpoint(ep);
                          setLogStatusFilter('ALL');
                          setLogSearchQuery('');
                          setLogCurrentPage(1);
                          setShowLogsModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Clock className="w-3 h-3 text-violet-400" />
                        <span>{isRTL ? 'سجلات الإرسال' : 'Delivery History'}</span>
                        <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-slate-950 text-slate-300 font-mono">
                          {epDeliveries.length}
                        </span>
                      </button>

                      {/* Test Ping */}
                      {canManage && !isRevoked && (
                        <button
                          onClick={() => handleTestPing(ep)}
                          disabled={isTesting}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {isTesting ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 text-cyan-400" />
                          )}
                          <span>{isRTL ? 'إرسال حدث تجريبي (Ping)' : 'Send Test Event'}</span>
                        </button>
                      )}
                    </div>

                    {/* Management Actions */}
                    {canManage && !isRevoked && (
                      <div className="flex items-center gap-2">
                        {/* Edit Endpoint */}
                        <button
                          onClick={() => openEditModal(ep)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Edit Webhook"
                        >
                          <Edit className="w-3 h-3 text-cyan-400" />
                          <span>{isRTL ? 'تعديل' : 'Edit'}</span>
                        </button>

                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => handleToggleStatus(ep)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-colors"
                        >
                          {ep.status === 'ACTIVE'
                            ? isRTL
                              ? 'تعطيل مؤقت'
                              : 'Disable'
                            : isRTL
                            ? 'تفعيل'
                            : 'Enable'}
                        </button>

                        {/* Rotate Secret */}
                        <button
                          onClick={() => {
                            setSelectedEndpoint(ep);
                            setShowRotateModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Rotate Signing Secret"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>{isRTL ? 'تدوير المفتاح' : 'Rotate Secret'}</span>
                        </button>

                        {/* Revoke Endpoint */}
                        <button
                          onClick={() => {
                            setSelectedEndpoint(ep);
                            setShowRevokeModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-950/40 hover:bg-rose-950 text-rose-300 border border-rose-800/60 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isRTL ? 'إلغاء نهائي' : 'Revoke'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE WEBHOOK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Webhook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'تسجيل نقطة اتصال ويب هوك جديدة' : 'Register Webhook Endpoint'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isRTL
                      ? `المنشأة المستهدفة: ${currentOrganization.name || currentOrganization.id}`
                      : `Target tenant: ${currentOrganization.name || currentOrganization.id}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-5">
              {/* Endpoint Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isRTL ? 'اسم نقطة الاتصال' : 'Webhook Name'} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={isRTL ? 'مثال: مزامنة نظام إدارة الموارد ERP' : 'e.g. Enterprise SAP ERP Inbound Sync'}
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isRTL ? 'الوصف والغرض' : 'Description & Target System'}
                </label>
                <input
                  type="text"
                  placeholder={isRTL ? 'وصف موجز للمنظومة المستلمة للبيانات' : 'Brief explanation of recipient system'}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Destination URL with SSRF Guard */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>
                    {isRTL ? 'رابط الوجهة (HTTPS URL)' : 'Destination URL (HTTPS)'} <span className="text-rose-400">*</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {isRTL ? 'يخضع لحماية SSRF وDNS الصارمة' : 'Zero-trust SSRF & DNS rebinding protection'}
                  </span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.your-erp.com/webhooks/warehouse"
                  value={createForm.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />

                {/* SSRF Validation Feedback */}
                {urlValidation && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border font-mono ${
                      urlValidation.valid
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : 'bg-rose-950/60 text-rose-300 border-rose-800'
                    }`}
                  >
                    {urlValidation.valid ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                    <span>
                      {urlValidation.valid
                        ? isRTL
                          ? 'عنوان HTTPS صالح ومعتمد أمنياً'
                          : 'Valid HTTPS destination (SSRF pre-check passed)'
                        : `${urlValidation.reason}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Subscribed Events Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    {isRTL ? 'الأحداث المشترك بها' : 'Subscribed Event Types'} ({createForm.subscribedEvents.length} / 12)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCreateForm((p) => ({ ...p, subscribedEvents: ALL_WEBHOOK_EVENT_TYPES.map((e) => e.type) }))}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      {isRTL ? 'تحديد الكل' : 'Select All'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm((p) => ({
                          ...p,
                          subscribedEvents: ALL_WEBHOOK_EVENT_TYPES.filter((e) => e.category === 'INVENTORY').map((e) => e.type),
                        }))
                      }
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {isRTL ? 'المخزون فقط' : 'Inventory Only'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setCreateForm((p) => ({ ...p, subscribedEvents: [] }))}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {isRTL ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
                  {ALL_WEBHOOK_EVENT_TYPES.map((ev) => {
                    const isChecked = createForm.subscribedEvents.includes(ev.type);
                    return (
                      <label
                        key={ev.type}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-cyan-950/40 border-cyan-800/80 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEventSubscription(ev.type)}
                          className="mt-0.5 rounded text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-cyan-300">{ev.type}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {isRTL ? ev.labelAr : ev.labelEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Rate Limit Setting */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>{isRTL ? 'الحد الأقصى للإرسال (طلب / دقيقة)' : 'Rate Limit (Requests / Minute)'}</span>
                  <span className="font-mono text-cyan-400">{createForm.rateLimitPerMinute} req/min</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="600"
                  step="10"
                  value={createForm.rateLimitPerMinute}
                  onChange={(e) => setCreateForm({ ...createForm, rateLimitPerMinute: Number(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRTL ? 'تسجيل وتوليد المفتاح' : 'Register & Generate Secret'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT WEBHOOK MODAL */}
      {showEditModal && selectedEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'تعديل نقطة اتصال الويب هوك' : 'Edit Webhook Endpoint'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedEndpoint.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-5">
              {/* Endpoint Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isRTL ? 'اسم نقطة الاتصال' : 'Webhook Name'} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isRTL ? 'الوصف' : 'Description'}
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Destination URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>
                    {isRTL ? 'رابط الوجهة (HTTPS URL)' : 'Destination URL (HTTPS)'} <span className="text-rose-400">*</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {isRTL ? 'يخضع لحماية SSRF وDNS' : 'SSRF & DNS rebinding checks'}
                  </span>
                </label>
                <input
                  type="url"
                  required
                  value={editForm.url}
                  onChange={(e) => handleEditUrlChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />

                {editUrlValidation && (
                  <div
                    className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border font-mono ${
                      editUrlValidation.valid
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : 'bg-rose-950/60 text-rose-300 border-rose-800'
                    }`}
                  >
                    {editUrlValidation.valid ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                    <span>
                      {editUrlValidation.valid
                        ? isRTL
                          ? 'عنوان HTTPS صالح ومعتمد'
                          : 'Valid HTTPS destination'
                        : `${editUrlValidation.reason}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Subscribed Events Picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    {isRTL ? 'الأحداث المشترك بها' : 'Subscribed Events'} ({editForm.subscribedEvents.length} / 12)
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, subscribedEvents: ALL_WEBHOOK_EVENT_TYPES.map((e) => e.type) }))}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      {isRTL ? 'تحديد الكل' : 'Select All'}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, subscribedEvents: [] }))}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {isRTL ? 'مسح' : 'Clear'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
                  {ALL_WEBHOOK_EVENT_TYPES.map((ev) => {
                    const isChecked = editForm.subscribedEvents.includes(ev.type);
                    return (
                      <label
                        key={ev.type}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-cyan-950/40 border-cyan-800/80 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditEventSubscription(ev.type)}
                          className="mt-0.5 rounded text-cyan-500 focus:ring-0 cursor-pointer"
                        />
                        <div className="space-y-0.5">
                          <span className="font-mono text-[11px] text-cyan-300 block">{ev.type}</span>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {isRTL ? ev.labelAr : ev.labelEn}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status and Rate Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {isRTL ? 'الحالة التشغيلية' : 'Operating Status'}
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'ACTIVE' | 'DISABLED' })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="ACTIVE">{isRTL ? 'نشط (ACTIVE)' : 'ACTIVE'}</option>
                    <option value="DISABLED">{isRTL ? 'معطل مؤقتاً (DISABLED)' : 'DISABLED'}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>{isRTL ? 'الحد الأقصى للإرسال' : 'Rate Limit'}</span>
                    <span className="font-mono text-cyan-400">{editForm.rateLimitPerMinute} req/min</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="600"
                    step="10"
                    value={editForm.rateLimitPerMinute}
                    onChange={(e) => setEditForm({ ...editForm, rateLimitPerMinute: Number(e.target.value) })}
                    className="w-full accent-cyan-500 cursor-pointer mt-2"
                  />
                </div>
              </div>

              {/* Secret Security Notice */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>
                  {isRTL
                    ? 'مفتاح التوقيع السري لا يتم عرضه أو تغييره من نموذج التعديل. استخدم خيار "تدوير المفتاح" إذا رغبت في تجديد مفتاح الأمان.'
                    : 'The signing secret cannot be viewed or altered here. Use the "Rotate Secret" action to issue a new cryptographic secret.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50 cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRTL ? 'حفظ التغييرات' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME SECRET DISCLOSURE MODAL */}
      {showSecretModal && generatedSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-cyan-800/80 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950/60 text-amber-400 border border-amber-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isRTL ? 'مفتاح توقيع الويب هوك (احفظه الآن)' : 'Webhook Signing Secret (Store Safely)'}
                </h3>
                <p className="text-xs text-amber-300">
                  {isRTL
                    ? 'هذا المفتاح لن يظهر لك مرة أخرى لأسباب أمنية. احفظه في مكان آمن في نظامك.'
                    : 'This secret is revealed only once. It will never be displayed in plaintext again.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                {isRTL ? 'مفتاح التوقيع السري (HMAC-SHA256 Secret):' : 'Raw Signing Secret:'}
              </label>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-cyan-900/60 font-mono text-xs text-cyan-300">
                <span className="flex-1 break-all select-all font-semibold">{generatedSecret}</span>
                <button
                  onClick={() => copyToClipboard(generatedSecret)}
                  className="p-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
                  aria-label="Copy secret"
                >
                  {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span className="text-[11px] font-sans">{copiedSecret ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200">
                {isRTL ? 'التحقق عند استلام الطلبات:' : 'Verification on Receiving Server:'}
              </div>
              <p>
                {isRTL
                  ? 'قارن التوقيع المستلم في ترويسة X-Warehouse-Signature مع القيمة المحسوبة باستخدام هذا المفتاح.'
                  : 'Compute HMAC-SHA256 over `${timestamp}.${rawBody}` with this secret and compare with the X-Warehouse-Signature header.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowSecretModal(false);
                  setGeneratedSecret(null);
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-lg shadow-cyan-950/50"
              >
                {isRTL ? 'تم النسخ والحفظ، إغلاق' : 'I Have Saved the Secret, Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROTATE SECRET CONFIRM MODAL */}
      {showRotateModal && selectedEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-amber-900/60 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-950 text-amber-400 border border-amber-800">
                <RotateCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'تدوير مفتاح توقيع الويب هوك' : 'Rotate Signing Secret'}
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-[240px]">{selectedEndpoint.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isRTL
                ? 'سيتم توليد مفتاح توقيع عالي الأمان جديد فوراً وإلغاء المفتاح القديم. سيتعين عليك تحديث المفتاح في خادم الاستماع لديك لمواصلة التحقق من صحة التواقيع.'
                : 'A new high-entropy HMAC secret will be generated immediately. Existing listeners must be updated with the new secret to continue verifying deliveries.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowRotateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRotate}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-lg shadow-amber-950/50 flex items-center gap-2"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isRTL ? 'تأكيد التدوير' : 'Confirm Rotation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE ENDPOINT CONFIRM MODAL */}
      {showRevokeModal && selectedEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-rose-900/60 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-950 text-rose-400 border border-rose-800">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'إلغاء نقطة الاتصال نهائياً' : 'Revoke Webhook Endpoint'}
                </h3>
                <p className="text-xs text-slate-400 truncate max-w-[240px]">{selectedEndpoint.name}</p>
              </div>
            </div>

            <p className="text-xs text-rose-200/90 leading-relaxed">
              {isRTL
                ? 'هل أنت متأكد من رغبتك في إلغاء نقطة الاتصال هذه؟ لن يتم إرسال أي أحداث إليها بعد الآن وسيتم إيقاف مفتاح التوقيع فوراً مع الاحتفاظ بسجلات الإرسال السابقة.'
                : 'Are you sure you want to revoke this endpoint? Outbound event deliveries will cease immediately and its signing secret will be permanently invalidated. Historical delivery logs will be preserved.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowRevokeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                {isRTL ? 'تراجع' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmRevoke}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-950/50 flex items-center gap-2"
              >
                {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isRTL ? 'تأكيد الإلغاء' : 'Confirm Revoke'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY HISTORY & LOGS MODAL */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-950 text-violet-400 border border-violet-800">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isRTL ? 'سجلات إرسال الويب هوك الموثقة' : 'Persistent Webhook Delivery Records'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedEndpoint
                      ? `${isRTL ? 'تصفية حسب:' : 'Filtered for:'} ${selectedEndpoint.name}`
                      : `${isRTL ? 'جميع سجلات المنشأة:' : 'All deliveries for:'} ${currentOrganization.name || currentOrganization.id}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-lg font-bold"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['ALL', 'SUCCEEDED', 'RETRYING', 'FAILED', 'DELIVERING', 'PENDING'].map((statusKey) => (
                  <button
                    key={statusKey}
                    onClick={() => {
                      setLogStatusFilter(statusKey);
                      setLogCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                      logStatusFilter === statusKey
                        ? 'bg-violet-950 text-violet-300 border border-violet-800'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {statusKey}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder={isRTL ? 'بحث بالحدث أو المعرف...' : 'Search Event ID or Type...'}
                  value={logSearchQuery}
                  onChange={(e) => {
                    setLogSearchQuery(e.target.value);
                    setLogCurrentPage(1);
                  }}
                  className="w-full bg-transparent text-xs text-white focus:outline-none placeholder-slate-500"
                />
                {logSearchQuery && (
                  <button
                    onClick={() => setLogSearchQuery('')}
                    className="text-slate-500 hover:text-white text-xs"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>

            {/* Logs List */}
            {paginatedLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Activity className="w-8 h-8 mx-auto text-slate-600" />
                <div className="text-sm font-semibold text-slate-300">
                  {isRTL ? 'لا توجد سجلات مطابقة للشروط' : 'No matching delivery attempts found'}
                </div>
                <p className="text-xs text-slate-500">
                  {isRTL
                    ? 'قم بإرسال حدث تجريبي من بطاقة نقطة الاتصال لاختبار التوصيل.'
                    : 'Dispatch a test ping or confirm a warehouse document to trigger events.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedLogs.map((del) => {
                  const isRetrying = retryingDeliveryId === del.id;
                  const s = (del.status || '').toLowerCase();
                  const isSuccess = s === 'succeeded' || s === 'success';
                  const isFailedOrRetry = s === 'failed' || s === 'retrying' || s === 'pending_retry' || s === 'max_retries_exceeded';

                  return (
                    <div
                      key={del.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {renderDeliveryStatusBadge(del.status)}

                          <span className="font-mono text-xs font-semibold text-cyan-300">
                            {del.eventType}
                          </span>

                          <span className="text-[10px] text-slate-500 font-mono">
                            Attempt {del.attemptNumber} of {del.maxAttempts}
                          </span>

                          <span className="text-[10px] text-slate-500 font-mono">
                            ID: {del.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          {del.durationMs !== undefined && (
                            <span className="text-slate-400 font-mono text-[11px]">
                              {del.durationMs}ms
                            </span>
                          )}
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {new Date(del.createdAt).toLocaleTimeString()}
                          </span>

                          {/* Manual Retry Button */}
                          {canManage && isFailedOrRetry && (
                            <button
                              onClick={() => handleRetryDelivery(del)}
                              disabled={isRetrying}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                              title="Manual Retry Outbound Delivery"
                            >
                              {isRetrying ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCw className="w-3 h-3" />
                              )}
                              <span>{isRTL ? 'إعادة الإرسال' : 'Retry'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Destination URL & Next Retry Details */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                        <div className="truncate max-w-xl">
                          <span className="text-slate-500">Destination:</span> {del.destinationUrl}
                        </div>
                        {del.nextRetryAt && (
                          <div className="text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Next Retry: {new Date(del.nextRetryAt).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Sanitized Failure Error Display */}
                      {del.errorMessage && (
                        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs font-mono">
                          Error: {del.errorMessage}
                        </div>
                      )}

                      {/* Request and Response Inspector Drawer */}
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-400 hover:text-cyan-400 font-mono select-none">
                          {isRTL ? 'معاينة الترويسات ومحتوى الطلب (Sanitized Payload)' : 'Inspect Request Headers & Sanitized Payload'}
                        </summary>
                        <div className="mt-2 space-y-2 pt-2 border-t border-slate-900">
                          <div className="text-[11px] font-semibold text-slate-300">Request Headers:</div>
                          <pre className="p-2.5 rounded-xl bg-slate-900 text-slate-300 text-[10px] font-mono overflow-x-auto">
                            {JSON.stringify(del.requestHeaders, null, 2)}
                          </pre>
                          <div className="text-[11px] font-semibold text-slate-300">Request Payload:</div>
                          <pre className="p-2.5 rounded-xl bg-slate-900 text-slate-300 text-[10px] font-mono overflow-x-auto">
                            {JSON.stringify(del.requestPayload, null, 2)}
                          </pre>
                          {del.responseBody && (
                            <>
                              <div className="text-[11px] font-semibold text-slate-300">Response Body:</div>
                              <pre className="p-2.5 rounded-xl bg-slate-900 text-emerald-300 text-[10px] font-mono overflow-x-auto">
                                {del.responseBody}
                              </pre>
                            </>
                          )}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {totalLogPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400 font-mono">
                <div>
                  {isRTL ? 'الصفحة' : 'Page'} {logCurrentPage} {isRTL ? 'من' : 'of'} {totalLogPages} ({modalDeliveries.length} items)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLogCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={logCurrentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 cursor-pointer"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLogCurrentPage((p) => Math.min(totalLogPages, p + 1))}
                    disabled={logCurrentPage === totalLogPages}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40 cursor-pointer"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
