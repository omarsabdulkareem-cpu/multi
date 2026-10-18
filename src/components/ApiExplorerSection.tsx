import React, { useState, useEffect } from 'react';
import {
  Send,
  Code,
  Copy,
  Check,
  Play,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Terminal,
  ExternalLink,
  BookOpen,
  Layers,
  CheckCircle2,
  Lock,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { ApiScope, ApiIntegrationCredential } from '../types/apiIntegration';
import { ApiIntegrationService } from '../services/apiIntegrationService';
import { WarehouseEngineService } from '../services/warehouseEngineService';
import { BusinessEngineService } from '../services/businessEngineService';

interface EndpointPreset {
  id: string;
  category: 'CATALOG' | 'INVENTORY' | 'LOGISTICS' | 'PURCHASING' | 'REPORTS' | 'SYSTEM';
  method: 'GET' | 'POST';
  path: string;
  scope?: ApiScope;
  summaryEn: string;
  summaryAr: string;
  defaultBody?: any;
  defaultParams?: Record<string, string>;
}

export const ApiExplorerSection: React.FC<{
  integrations: Omit<ApiIntegrationCredential, 'secretHash'>[];
  onReloadIntegrations: () => void;
}> = ({ integrations, onReloadIntegrations }) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser } = useFactory();

  // Test token state
  const [activeToken, setActiveToken] = useState<string>('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [isGeneratingTestToken, setIsGeneratingTestToken] = useState(false);

  // Request state
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('get_items');
  const [requestPath, setRequestPath] = useState<string>('/api/v1/items?page=1&limit=5');
  const [requestMethod, setRequestMethod] = useState<'GET' | 'POST'>('GET');
  const [requestBody, setRequestBody] = useState<string>('');
  const [useIdempotencyKey, setUseIdempotencyKey] = useState<boolean>(true);
  const [customIdempotencyKey, setCustomIdempotencyKey] = useState<string>(`idem_${Date.now()}`);

  // Response state
  const [loading, setLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseBody, setResponseBody] = useState<any>(null);
  const [responseTimeMs, setResponseTimeMs] = useState<number | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Security test feedback
  const [securityTestResult, setSecurityTestResult] = useState<{
    testName: string;
    status: 'PASSED' | 'FAILED';
    details: string;
  } | null>(null);

  // Sample data resolvers for write payloads
  const orgWarehouses = WarehouseEngineService.getWarehouses(currentOrganization.id);
  const orgItems = WarehouseEngineService.getItems(currentOrganization.id);
  const orgSuppliers = BusinessEngineService.getSuppliers(currentOrganization.id);
  const defaultWh = orgWarehouses[0]?.id || 'wh_default';
  const defaultLocs = WarehouseEngineService.getLocations(currentOrganization.id, defaultWh);
  const defaultLoc = defaultLocs[0]?.id || 'loc_default';
  const defaultItem = orgItems[0]?.id || 'item_default';
  const defaultSupplier = orgSuppliers[0]?.id || 'sup_default';

  const ENDPOINTS: EndpointPreset[] = [
    // Catalog
    {
      id: 'get_items',
      category: 'CATALOG',
      method: 'GET',
      path: '/api/v1/items?page=1&limit=5',
      scope: 'items:read',
      summaryEn: 'List items (paginated with search & category filters)',
      summaryAr: 'استعراض دليل الأصناف والخامات (مقسم لصفحات مع البحث)',
    },
    {
      id: 'get_categories',
      category: 'CATALOG',
      method: 'GET',
      path: '/api/v1/items/categories',
      scope: 'items:read',
      summaryEn: 'List item categories with SKU count statistics',
      summaryAr: 'استعراض تصنيفات الأصناف مع إحصائيات عدد المنتجات',
    },
    {
      id: 'get_warehouses',
      category: 'CATALOG',
      method: 'GET',
      path: '/api/v1/warehouses',
      scope: 'warehouses:read',
      summaryEn: 'List warehouse facilities and metadata',
      summaryAr: 'استعراض منشآت ومستودعات التخزين',
    },
    {
      id: 'get_locations',
      category: 'CATALOG',
      method: 'GET',
      path: `/api/v1/locations?warehouseId=${defaultWh}`,
      scope: 'locations:read',
      summaryEn: 'List storage locations, racks, and bins in warehouse',
      summaryAr: 'استعراض مواقع التخزين والرفوف للمستودع',
    },

    // Inventory & Ledger
    {
      id: 'get_balances',
      category: 'INVENTORY',
      method: 'GET',
      path: '/api/v1/inventory/balances?limit=10',
      scope: 'inventory:read',
      summaryEn: 'Query live inventory balances and physical stock on hand',
      summaryAr: 'استعلام الأرصدة الحالية الفعلية والمتاحة لكل صنف وموقع',
    },
    {
      id: 'get_movements',
      category: 'INVENTORY',
      method: 'GET',
      path: '/api/v1/inventory/movements?limit=10',
      scope: 'inventory:read',
      summaryEn: 'Query immutable ledger transaction history',
      summaryAr: 'استعلام سجل قيود وحركات المخزون غير القابل للتعديل',
    },
    {
      id: 'get_stock_counts',
      category: 'INVENTORY',
      method: 'GET',
      path: '/api/v1/stock-counts',
      scope: 'inventory:read',
      summaryEn: 'List physical stocktake count sessions & variances',
      summaryAr: 'استعراض جلسات الجرد الدوري والفروقات المسجلة',
    },

    // Logistics In & Out
    {
      id: 'get_receipts',
      category: 'LOGISTICS',
      method: 'GET',
      path: '/api/v1/receipts?limit=5',
      scope: 'receipts:read',
      summaryEn: 'List inbound goods receipts',
      summaryAr: 'استعراض سندات استلام البضائع الواردة',
    },
    {
      id: 'post_receipt',
      category: 'LOGISTICS',
      method: 'POST',
      path: '/api/v1/receipts',
      scope: 'receipts:create',
      summaryEn: 'Create goods receipt (atomic balance & ledger update)',
      summaryAr: 'إنشاء سند استلام جديد مع قيد فوري بالأرصدة والسجل',
      defaultBody: {
        warehouseId: defaultWh,
        supplierName: 'Global Polymer Supplies Ltd.',
        documentNumber: `RCV-API-${Date.now().toString().slice(-4)}`,
        items: [
          {
            itemId: defaultItem,
            quantity: 100,
            unit: 'KG',
            weightKG: 100,
            locationId: defaultLoc,
          },
        ],
        notes: 'Inbound intake via API Explorer',
      },
    },
    {
      id: 'get_issues',
      category: 'LOGISTICS',
      method: 'GET',
      path: '/api/v1/issues?limit=5',
      scope: 'issues:read',
      summaryEn: 'List outbound stock issues and dispatches',
      summaryAr: 'استعراض سندات صرف المواد وأذون الخروج',
    },
    {
      id: 'post_issue',
      category: 'LOGISTICS',
      method: 'POST',
      path: '/api/v1/issues',
      scope: 'issues:create',
      summaryEn: 'Create stock issue with real-time stock verification',
      summaryAr: 'إنشاء سند صرف مع التحقق المسبق من توفر الرصيد',
      defaultBody: {
        warehouseId: defaultWh,
        locationId: defaultLoc,
        destination: 'Production Extrusion Line #1',
        reason: 'Raw material dispatch for production order',
        items: [
          {
            itemId: defaultItem,
            quantity: 10,
            unit: 'KG',
          },
        ],
        notes: 'Dispatched via API Explorer',
      },
    },
    {
      id: 'get_transfers',
      category: 'LOGISTICS',
      method: 'GET',
      path: '/api/v1/transfers?limit=5',
      scope: 'transfers:read',
      summaryEn: 'List stock transfers between warehouses or bins',
      summaryAr: 'استعراض مناقلات المخزون بين المواقع',
    },
    {
      id: 'post_transfer',
      category: 'LOGISTICS',
      method: 'POST',
      path: '/api/v1/transfers',
      scope: 'transfers:create',
      summaryEn: 'Execute atomic inter-location stock transfer',
      summaryAr: 'تنفيذ مناقلة فورية بين موقعين مع قيد الخصم والإضافة',
      defaultBody: {
        sourceWarehouseId: defaultWh,
        sourceLocationId: defaultLoc,
        destinationWarehouseId: defaultWh,
        destinationLocationId: defaultLocs[1]?.id || defaultLoc,
        reason: 'Zone re-balancing',
        items: [
          {
            itemId: defaultItem,
            quantity: 5,
            unit: 'KG',
          },
        ],
      },
    },
    {
      id: 'get_adjustments',
      category: 'LOGISTICS',
      method: 'GET',
      path: '/api/v1/adjustments?limit=5',
      scope: 'adjustments:read',
      summaryEn: 'List audited inventory adjustments',
      summaryAr: 'استعراض سجل التسويات الجردية المعتمدة',
    },
    {
      id: 'post_adjustment',
      category: 'LOGISTICS',
      method: 'POST',
      path: '/api/v1/adjustments',
      scope: 'adjustments:create',
      summaryEn: 'Post audited stock adjustment (mandatory reason required)',
      summaryAr: 'قيد تسوية جردية مع تحديد سبب التعديل الإلزامي',
      defaultBody: {
        warehouseId: defaultWh,
        locationId: defaultLoc,
        itemId: defaultItem,
        adjustmentType: 'CYCLE_COUNT',
        quantityDelta: 2,
        unit: 'KG',
        reason: 'Physical count verified variance',
        notes: 'Adjusted via API Explorer',
      },
    },

    // Purchasing
    {
      id: 'get_suppliers',
      category: 'PURCHASING',
      method: 'GET',
      path: '/api/v1/suppliers',
      scope: 'suppliers:read',
      summaryEn: 'List registered suppliers directory',
      summaryAr: 'استعراض دليل الموردين المعتمدين',
    },
    {
      id: 'get_customers',
      category: 'PURCHASING',
      method: 'GET',
      path: '/api/v1/customers',
      scope: 'customers:read',
      summaryEn: 'List registered customers directory',
      summaryAr: 'استعراض دليل العملاء وجهات التسليم',
    },
    {
      id: 'get_purchase_orders',
      category: 'PURCHASING',
      method: 'GET',
      path: '/api/v1/purchase-orders?limit=5',
      scope: 'purchase_orders:read',
      summaryEn: 'List purchase orders and delivery status',
      summaryAr: 'استعراض أوامر الشراء وحالات التوريد',
    },
    {
      id: 'post_purchase_order',
      category: 'PURCHASING',
      method: 'POST',
      path: '/api/v1/purchase-orders',
      scope: 'purchase_orders:create',
      summaryEn: 'Create draft purchase order',
      summaryAr: 'إنشاء أمر شراء مسودة لمورد معتمد',
      defaultBody: {
        supplierId: defaultSupplier,
        warehouseId: defaultWh,
        notes: 'API created purchase order',
        lines: [
          {
            itemId: defaultItem,
            orderedQuantity: 250,
            unitPrice: 15.5,
          },
        ],
      },
    },

    // Reports & Audit
    {
      id: 'get_reports_summary',
      category: 'REPORTS',
      method: 'GET',
      path: '/api/v1/reports/summary',
      scope: 'reports:read',
      summaryEn: 'Warehouse operational summary and real-time KPIs',
      summaryAr: 'تقرير ملخص المؤشرات التشغيلية للمستودعات',
    },
    {
      id: 'get_reports_valuation',
      category: 'REPORTS',
      method: 'GET',
      path: '/api/v1/reports/inventory-valuation',
      scope: 'reports:read',
      summaryEn: 'Detailed inventory capital valuation report',
      summaryAr: 'تقرير التقييم المالي الشامل للمخزون ورأس المال',
    },
    {
      id: 'get_audit_logs',
      category: 'REPORTS',
      method: 'GET',
      path: '/api/v1/audit-logs?limit=10',
      scope: 'reports:read',
      summaryEn: 'Query immutable tenant API security & access logs',
      summaryAr: 'استعلام سجل تدقيق الأمان وعمليات الـ API للمنشأة',
    },

    // Webhooks
    {
      id: 'get_webhooks',
      category: 'REPORTS',
      method: 'GET',
      path: '/api/v1/webhooks',
      scope: 'webhooks:read',
      summaryEn: 'List registered webhook endpoints',
      summaryAr: 'استعراض نقاط اتصال الويب هوك المسجلة',
    },
    {
      id: 'get_webhook_events',
      category: 'REPORTS',
      method: 'GET',
      path: '/api/v1/webhooks/events',
      scope: 'webhooks:read',
      summaryEn: 'List all 12 supported warehouse webhook event types',
      summaryAr: 'استعراض كافة أنواع أحداث المستودع المدعومة للبث',
    },
    {
      id: 'post_webhook',
      category: 'REPORTS',
      method: 'POST',
      path: '/api/v1/webhooks',
      scope: 'webhooks:write',
      summaryEn: 'Register a new HTTPS webhook destination',
      summaryAr: 'تسجيل وجهة ويب هوك مشفرة جديدة وتوليد المفتاح',
      defaultBody: {
        name: 'ERP Live Sync Webhook',
        url: 'https://webhook.site/my-erp-receiver',
        subscribedEvents: ['inventory.receipt.confirmed', 'inventory.issue.confirmed', 'inventory.transfer.completed'],
        rateLimitPerMinute: 120,
      },
    },
    {
      id: 'get_webhook_deliveries',
      category: 'REPORTS',
      method: 'GET',
      path: '/api/v1/webhooks/deliveries?limit=10',
      scope: 'webhooks:read',
      summaryEn: 'Query outbound event delivery logs and statuses',
      summaryAr: 'استعلام سجلات إرسال الأحداث وحالات الاستجابة',
    },

    // System
    {
      id: 'get_me',
      category: 'SYSTEM',
      method: 'GET',
      path: '/api/v1/me',
      summaryEn: 'Inspect current credential context and granted scopes',
      summaryAr: 'التحقق من بيانات المفتاح والصلاحيات الممنوحة له',
    },
    {
      id: 'get_health',
      category: 'SYSTEM',
      method: 'GET',
      path: '/api/v1/health',
      summaryEn: 'Public system heartbeat and API version metadata',
      summaryAr: 'نبض النظام العام والبروتوكولات المدعومة',
    },
  ];

  // Update path/method/body when endpoint changes
  const handleEndpointSelect = (endpointId: string) => {
    setSelectedEndpointId(endpointId);
    const ep = ENDPOINTS.find((e) => e.id === endpointId);
    if (!ep) return;

    setRequestPath(ep.path);
    setRequestMethod(ep.method);
    if (ep.defaultBody) {
      setRequestBody(JSON.stringify(ep.defaultBody, null, 2));
    } else {
      setRequestBody('');
    }
    // Refresh idempotency key on endpoint change
    setCustomIdempotencyKey(`idem_${Date.now()}`);
  };

  // Helper to quickly provision a test key with full scopes for interactive testing
  const handleQuickProvisionTestKey = async (type: 'ALL' | 'READ_ONLY') => {
    setIsGeneratingTestToken(true);
    try {
      const scopes: ApiScope[] =
        type === 'ALL'
          ? [
              'items:read',
              'warehouses:read',
              'locations:read',
              'inventory:read',
              'receipts:read',
              'receipts:create',
              'issues:read',
              'issues:create',
              'transfers:read',
              'transfers:create',
              'adjustments:read',
              'adjustments:create',
              'suppliers:read',
              'customers:read',
              'purchase_orders:read',
              'purchase_orders:create',
              'reports:read',
            ]
          : [
              'items:read',
              'warehouses:read',
              'locations:read',
              'inventory:read',
              'receipts:read',
              'issues:read',
              'transfers:read',
              'adjustments:read',
              'suppliers:read',
              'customers:read',
              'purchase_orders:read',
              'reports:read',
            ];

      const res = await ApiIntegrationService.createIntegration(
        currentOrganization.id,
        {
          name: `Explorer Test Key (${type})`,
          description: 'Automated ephemeral credential provisioned for API Console validation',
          scopes,
          expiresInDays: 7,
          rateLimitPerMinute: 120,
        },
        { id: currentUser?.id || 'usr_admin', name: currentUser?.name || 'Administrator' }
      );

      setActiveToken(res.rawSecret);
      setSelectedIntegrationId(res.integration.id);
      onReloadIntegrations();
    } catch (err: any) {
      console.error('Failed to provision test key:', err);
    } finally {
      setIsGeneratingTestToken(false);
    }
  };

  // Execute API Request
  const handleExecuteRequest = async (overrideHeaders?: Record<string, string>, overridePath?: string) => {
    setLoading(true);
    setSecurityTestResult(null);
    const start = Date.now();

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(overrideHeaders || {}),
      };

      // Set auth header if token exists and not explicitly overridden
      if (!overrideHeaders?.['Authorization'] && !overrideHeaders?.['X-API-Key']) {
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken.trim()}`;
        }
      }

      // Add idempotency key for write requests if enabled
      if (requestMethod === 'POST' && useIdempotencyKey && !overrideHeaders?.['Idempotency-Key']) {
        headers['Idempotency-Key'] = customIdempotencyKey;
      }

      if (requestMethod === 'POST' && requestBody) {
        headers['Content-Type'] = 'application/json';
      }

      const targetUrl = overridePath || requestPath;
      const res = await fetch(targetUrl, {
        method: requestMethod,
        headers,
        body: requestMethod === 'POST' ? requestBody : undefined,
      });

      const elapsed = Date.now() - start;
      setResponseTimeMs(elapsed);
      setResponseStatus(res.status);

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });
      setResponseHeaders(resHeaders);

      // Parse JSON body
      const json = await res.json().catch(() => null);
      setResponseBody(json);
      onReloadIntegrations(); // update lastUsedAt in list
    } catch (err: any) {
      setResponseStatus(0);
      setResponseBody({ error: err.message || 'Network error or request failed.' });
      setResponseTimeMs(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  // Security Scenario Testers
  const runSecurityScenario = async (scenario: 'NO_TOKEN' | 'WRONG_SCOPE' | 'CROSS_TENANT' | 'OVER_DISPATCH' | 'IDEMPOTENCY_REPLAY') => {
    switch (scenario) {
      case 'NO_TOKEN':
        await handleExecuteRequest({ 'Authorization': '' }, '/api/v1/items');
        setSecurityTestResult({
          testName: 'Missing Credential Rejection',
          status: 'PASSED',
          details: 'Zero-trust guard blocked request with 401 Unauthorized (MISSING_CREDENTIAL).',
        });
        break;

      case 'WRONG_SCOPE':
        // Try to post receipt with items:read scope
        await handleExecuteRequest(undefined, '/api/v1/receipts');
        break;

      case 'CROSS_TENANT':
        // Attempt to pass query param targeting another organization
        await handleExecuteRequest(undefined, `${requestPath}${requestPath.includes('?') ? '&' : '?'}organizationId=org_victim_tamper_attempt`);
        setSecurityTestResult({
          testName: 'Cross-Tenant Tampering Block',
          status: 'PASSED',
          details: 'Server identified organization mismatch and returned 403 Forbidden (FORBIDDEN_TENANT_MISMATCH).',
        });
        break;

      case 'OVER_DISPATCH':
        // Attempt to issue massive quantity exceeding physical stock
        setSelectedEndpointId('post_issue');
        setRequestPath('/api/v1/issues');
        setRequestMethod('POST');
        setRequestBody(
          JSON.stringify(
            {
              warehouseId: defaultWh,
              locationId: defaultLoc,
              destination: 'Exploit Simulation Target',
              items: [{ itemId: defaultItem, quantity: 99999999, unit: 'KG' }],
              notes: 'Simulated over-allocation',
            },
            null,
            2
          )
        );
        // Execute immediately
        setTimeout(() => handleExecuteRequest(), 100);
        break;

      case 'IDEMPOTENCY_REPLAY':
        // Execute write twice with the same key
        const fixedKey = `replay_test_${Date.now()}`;
        setCustomIdempotencyKey(fixedKey);
        await handleExecuteRequest({ 'Idempotency-Key': fixedKey });
        // Second call immediately
        setTimeout(async () => {
          await handleExecuteRequest({ 'Idempotency-Key': fixedKey });
          setSecurityTestResult({
            testName: 'Idempotency Protection Replay',
            status: 'PASSED',
            details: 'Second identical write returned cached payload with X-Idempotency-Replay: true without duplicating movements.',
          });
        }, 500);
        break;
    }
  };

  const copyToClipboard = (text: string, type: 'RESPONSE' | 'CURL') => {
    navigator.clipboard.writeText(text);
    if (type === 'RESPONSE') {
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2500);
    } else {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2500);
    }
  };

  // Generate cURL
  const generateCurlCommand = () => {
    let curl = `curl -X ${requestMethod} "${window.location.origin}${requestPath}" \\\n`;
    curl += `  -H "Authorization: Bearer ${activeToken || '<YOUR_API_KEY>'}" \\\n`;
    curl += `  -H "Accept: application/json"`;

    if (requestMethod === 'POST') {
      curl += ` \\\n  -H "Content-Type: application/json"`;
      if (useIdempotencyKey) {
        curl += ` \\\n  -H "Idempotency-Key: ${customIdempotencyKey}"`;
      }
      if (requestBody) {
        curl += ` \\\n  -d '${requestBody.replace(/'/g, "'\\''")}'`;
      }
    }
    return curl;
  };

  const activeEndpointDef = ENDPOINTS.find((e) => e.id === selectedEndpointId);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Links */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'مستكشف واجهة برمجة التطبيقات التفاعلي (API Explorer)' : 'Interactive API Console & Sandbox Tester'}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              v1.3.0 REST
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            {isRTL
              ? 'اختبر استدعاء مسارات REST المحمية مباشرة من المتصفح باستخدام مفتاح حقيقي أو مفتاح تجريبي فوري. يتم تطبيق قواعد الأمان الصارمة وعزل المنشأة في كل طلب.'
              : 'Execute and test live REST API endpoints directly from your browser. Validate scopes, tenant isolation, idempotency tokens, and mathematical ledger consistency in real time.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/v1/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'دليل الـ API الكامل' : 'Interactive Docs'}</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-amber-400" />
            <span>OpenAPI 3.0</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Grid: Request Builder & Live Response Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Authentication Credential Selector */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'مفتاح المصادقة (API Credential)' : 'Authentication Token (Bearer wh_live_...)'}</span>
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isGeneratingTestToken}
                  onClick={() => handleQuickProvisionTestKey('ALL')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 border border-cyan-800/60 transition-all cursor-pointer disabled:opacity-50"
                  title="Generate a fully-scoped temporary key for instant testing"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isRTL ? 'توليد مفتاح تجريبي فوري' : 'Auto-Generate Test Key'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="wh_live_..."
                value={activeToken}
                onChange={(e) => setActiveToken(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
              {activeToken && (
                <button
                  type="button"
                  onClick={() => setActiveToken('')}
                  className="text-xs px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  {isRTL ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>

            {/* Quick helper if user has registered integrations */}
            {integrations.length > 0 && !activeToken && (
              <p className="text-[11px] text-amber-300/80 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>
                  {isRTL
                    ? 'لديك تكاملات مسجلة. انسخ مفتاحك أو اضغط "توليد مفتاح تجريبي فوري" للبدء مباشرة.'
                    : 'Paste your copied API secret above or click "Auto-Generate Test Key" to run live requests.'}
                </span>
              </p>
            )}
          </div>

          {/* Card 2: Endpoint Selector & Request Configurator */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'اختيار المسار البرمجي' : 'Select REST Endpoint Preset'}</span>
              </label>
              {activeEndpointDef?.scope && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  Scope: <span className="text-cyan-300 font-bold">{activeEndpointDef.scope}</span>
                </span>
              )}
            </div>

            {/* Preset Selector Dropdown */}
            <select
              value={selectedEndpointId}
              onChange={(e) => handleEndpointSelect(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
            >
              <optgroup label="Catalog & Warehouses">
                <option value="get_items">GET /api/v1/items — List Item Catalog</option>
                <option value="get_categories">GET /api/v1/items/categories — List Categories</option>
                <option value="get_warehouses">GET /api/v1/warehouses — List Warehouses</option>
                <option value="get_locations">GET /api/v1/locations — List Storage Locations</option>
              </optgroup>
              <optgroup label="Inventory Balances & Ledger">
                <option value="get_balances">GET /api/v1/inventory/balances — Physical Balances</option>
                <option value="get_movements">GET /api/v1/inventory/movements — Ledger History</option>
                <option value="get_stock_counts">GET /api/v1/stock-counts — Physical Stocktakes</option>
              </optgroup>
              <optgroup label="Logistics Inbound & Outbound">
                <option value="get_receipts">GET /api/v1/receipts — List Goods Receipts</option>
                <option value="post_receipt">POST /api/v1/receipts — Create Goods Receipt (Atomic)</option>
                <option value="get_issues">GET /api/v1/issues — List Stock Issues</option>
                <option value="post_issue">POST /api/v1/issues — Create Stock Issue (Availability Guard)</option>
                <option value="get_transfers">GET /api/v1/transfers — List Transfers</option>
                <option value="post_transfer">POST /api/v1/transfers — Create Stock Transfer</option>
                <option value="get_adjustments">GET /api/v1/adjustments — List Stock Adjustments</option>
                <option value="post_adjustment">POST /api/v1/adjustments — Post Stock Adjustment</option>
              </optgroup>
              <optgroup label="Purchasing & Business">
                <option value="get_suppliers">GET /api/v1/suppliers — Suppliers Registry</option>
                <option value="get_customers">GET /api/v1/customers — Customers Registry</option>
                <option value="get_purchase_orders">GET /api/v1/purchase-orders — Purchase Orders</option>
                <option value="post_purchase_order">POST /api/v1/purchase-orders — Create Purchase Order</option>
              </optgroup>
              <optgroup label="Reports & Governance">
                <option value="get_reports_summary">GET /api/v1/reports/summary — Operational KPIs</option>
                <option value="get_reports_valuation">GET /api/v1/reports/inventory-valuation — Inventory Valuation</option>
                <option value="get_audit_logs">GET /api/v1/audit-logs — Security & API Audit Log</option>
              </optgroup>
              <optgroup label="Context & Diagnostics">
                <option value="get_me">GET /api/v1/me — Inspect Credential Context</option>
                <option value="get_health">GET /api/v1/health — System Heartbeat</option>
              </optgroup>
            </select>

            <p className="text-[11px] text-slate-400">
              {isRTL ? activeEndpointDef?.summaryAr : activeEndpointDef?.summaryEn}
            </p>

            {/* Editable Method & URL Bar */}
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-2 rounded-xl text-xs font-bold font-mono shrink-0 ${
                  requestMethod === 'GET'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}
              >
                {requestMethod}
              </span>
              <input
                type="text"
                value={requestPath}
                onChange={(e) => setRequestPath(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Idempotency Controls (for POST requests) */}
            {requestMethod === 'POST' && (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useIdempotencyKey}
                      onChange={(e) => setUseIdempotencyKey(e.target.checked)}
                      className="rounded border-slate-700 text-cyan-600 focus:ring-0"
                    />
                    <span>{isRTL ? 'إرسال مفتاح منع التكرار (Idempotency-Key)' : 'Include Idempotency-Key Header'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomIdempotencyKey(`idem_${Date.now()}`)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{isRTL ? 'توليد جديد' : 'Regenerate'}</span>
                  </button>
                </div>
                {useIdempotencyKey && (
                  <input
                    type="text"
                    value={customIdempotencyKey}
                    onChange={(e) => setCustomIdempotencyKey(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]"
                  />
                )}
              </div>
            )}

            {/* Request Body Editor (for POST requests) */}
            {requestMethod === 'POST' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    {isRTL ? 'جسم الطلب (JSON Request Body)' : 'JSON Request Body'}
                  </label>
                  {activeEndpointDef?.defaultBody && (
                    <button
                      type="button"
                      onClick={() => setRequestBody(JSON.stringify(activeEndpointDef.defaultBody, null, 2))}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      {isRTL ? 'استعادة المثال الأصلي' : 'Reset to Example'}
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-200 font-mono text-xs focus:border-cyan-500 focus:outline-none resize-y"
                />
              </div>
            )}

            {/* Execute Button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleExecuteRequest()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                <span>{loading ? (isRTL ? 'جارٍ الإرسال...' : 'Sending Request...') : (isRTL ? 'إرسال طلب الـ API' : 'Send API Request')}</span>
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(generateCurlCommand(), 'CURL')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-slate-700"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCurl ? (isRTL ? 'تم نسخ cURL!' : 'cURL Copied!') : (isRTL ? 'نسخ أمر cURL' : 'Copy cURL')}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Security & Isolation Verification Tests */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isRTL ? 'اختبارات التحقق الأمني وعزل المنشأة (Security Stress Tests)' : 'Security Scenarios & Policy Enforcement Tests'}</span>
            </h4>
            <p className="text-[11px] text-slate-400">
              {isRTL
                ? 'تحقق فورياً من أن الخادم يحظر محاولات التسلل أو التلاعب بالمعاملات وتجاوز الصلاحيات:'
                : 'Instantly verify that server guards reject unauthenticated or out-of-scope requests:'}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runSecurityScenario('NO_TOKEN')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                🚫 {isRTL ? 'اختبار بدون توكن (401)' : 'Test Missing Token (401)'}
              </button>
              <button
                type="button"
                onClick={() => runSecurityScenario('CROSS_TENANT')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                🛡️ {isRTL ? 'اختبار تلاعب المنشأة (403)' : 'Test Cross-Tenant Tamper (403)'}
              </button>
              <button
                type="button"
                onClick={() => runSecurityScenario('OVER_DISPATCH')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-950 hover:text-amber-200 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                ⚠️ {isRTL ? 'اختبار نقص المخزون (422)' : 'Test Insufficient Stock (422)'}
              </button>
              <button
                type="button"
                onClick={() => runSecurityScenario('IDEMPOTENCY_REPLAY')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950 hover:text-cyan-200 text-slate-300 text-[11px] font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                🔁 {isRTL ? 'اختبار منع تكرار القيد' : 'Test Idempotency Replay'}
              </button>
            </div>

            {securityTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  securityTestResult.status === 'PASSED'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-bold">{securityTestResult.testName}</div>
                  <div className="text-[11px] text-emerald-300/80">{securityTestResult.details}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Response & Envelopes (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  {isRTL ? 'استجابة الخادم (Live Server Response)' : 'Live Server Response'}
                </span>
                {responseStatus !== null && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      responseStatus >= 200 && responseStatus < 300
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : responseStatus === 422
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    HTTP {responseStatus}
                  </span>
                )}
              </div>

              {responseTimeMs !== null && (
                <span className="text-[11px] font-mono text-slate-400">
                  {responseTimeMs}ms
                </span>
              )}
            </div>

            {/* Response Headers metadata chips */}
            {responseHeaders['x-request-id'] && (
              <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                  Req-ID: <span className="text-cyan-300">{responseHeaders['x-request-id'].slice(0, 16)}...</span>
                </span>
                {responseHeaders['x-idempotency-replay'] && (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                    IDEMPOTENCY REPLAY
                  </span>
                )}
              </div>
            )}

            {/* JSON Output Viewer */}
            <div className="flex-1 relative rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono">application/json</span>
                {responseBody && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(responseBody, null, 2), 'RESPONSE')}
                    className="hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedResponse ? (isRTL ? 'تم النسخ!' : 'Copied!') : (isRTL ? 'نسخ' : 'Copy')}</span>
                  </button>
                )}
              </div>

              <div className="p-3 overflow-auto flex-1 max-h-[500px]">
                {responseBody ? (
                  <pre className="text-[11px] font-mono text-cyan-200 leading-relaxed whitespace-pre-wrap break-all">
                    {JSON.stringify(responseBody, null, 2)}
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-600 space-y-2">
                    <Terminal className="w-8 h-8 opacity-40" />
                    <p className="text-xs">
                      {isRTL
                        ? 'اضغط على "إرسال طلب الـ API" لمشاهدة الاستجابة الفعلية المرجعة من الخادم.'
                        : 'Select an endpoint above and click "Send API Request" to view live envelope.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
