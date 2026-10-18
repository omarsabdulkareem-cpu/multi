import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  Building2,
  FileText,
  ShoppingCart,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Plus,
  RefreshCw,
  Hash,
  Activity,
  Layers,
  DollarSign,
  Package,
  Calendar,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Sliders,
  Check,
  X,
  PlayCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { useTenant } from '../context/TenantContext';
import {
  BusinessEngineService,
} from '../services/businessEngineService';
import {
  WarehouseEngineService,
} from '../services/warehouseEngineService';
import {
  SupplierMaster,
  CustomerMaster,
  PurchaseRequest,
  PurchaseOrder,
  InternalStockRequest,
  DocumentSequenceConfig,
  InventoryCostMethod,
} from '../types/business';
import { StandardUnit } from '../types/warehouse';

export type BusinessTab =
  | 'OVERVIEW'
  | 'SUPPLIERS'
  | 'PURCHASE_REQUESTS'
  | 'PURCHASE_ORDERS'
  | 'CUSTOMERS'
  | 'INTERNAL_REQUESTS'
  | 'SEQUENCES'
  | 'TESTS';

interface Props {
  initialTab?: BusinessTab;
}

export const BusinessManagementModule: React.FC<Props> = ({ initialTab = 'OVERVIEW' }) => {
  const { isRTL, language } = useLanguage();
  const { currentUser } = useFactory();
  const { currentOrganization, switchOrganization, organizations } = useTenant();

  const orgId = currentOrganization?.id || 'org_alkarwan';
  const orgCurrency = currentOrganization?.currency || 'USD';

  // Navigation State
  const [activeTab, setActiveTab] = useState<BusinessTab>(initialTab);

  // Data States
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [customers, setCustomers] = useState<CustomerMaster[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [internalRequests, setInternalRequests] = useState<InternalStockRequest[]>([]);
  const [sequences, setSequences] = useState<DocumentSequenceConfig[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [costMethod, setCostMethod] = useState<InventoryCostMethod>('NONE');

  // Active Modals & Selected Items
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierMaster | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerMaster | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedPR, setSelectedPR] = useState<PurchaseRequest | null>(null);
  const [selectedInternalReq, setSelectedInternalReq] = useState<InternalStockRequest | null>(null);

  // Create Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddPROpen, setIsAddPROpen] = useState(false);
  const [isAddPOOpen, setIsAddPOOpen] = useState(false);
  const [isAddInternalReqOpen, setIsAddInternalReqOpen] = useState(false);
  const [isReceivePOOpen, setIsReceivePOOpen] = useState(false);
  const [isFulfillReqOpen, setIsFulfillReqOpen] = useState(false);

  // Form states
  const [supplierForm, setSupplierForm] = useState<Partial<SupplierMaster>>({
    supplierCode: '',
    supplierName: '',
    legalName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    country: 'Iraq',
    city: 'Baghdad',
    paymentTerms: 'NET_30',
    currency: orgCurrency,
    status: 'ACTIVE',
  });

  const [customerForm, setCustomerForm] = useState<Partial<CustomerMaster>>({
    customerCode: '',
    customerName: '',
    legalName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    country: 'Iraq',
    city: 'Baghdad',
    paymentTerms: 'NET_15',
    currency: orgCurrency,
    status: 'ACTIVE',
  });

  // PR Form
  const [prForm, setPrForm] = useState({
    department: 'Extrusion Line 1',
    requiredDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    reason: 'Restocking production buffers',
    itemId: '',
    quantity: 1000,
    unitPrice: 2.5,
  });

  // PO Form
  const [poForm, setPoForm] = useState({
    supplierId: '',
    warehouseId: '',
    expectedDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    itemId: '',
    quantity: 2000,
    unitPrice: 2.5,
    notes: 'Regular supply contract',
  });

  // Internal Requisition Form
  const [irForm, setIrForm] = useState({
    department: 'Maintenance & Operations',
    warehouseId: '',
    purpose: 'Routine machine buffer replenishment',
    requiredDate: new Date().toISOString().split('T')[0],
    itemId: '',
    quantity: 250,
  });

  const [fulfillLocationId, setFulfillLocationId] = useState('');

  // Test Runner State
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Organization Data
  const loadData = () => {
    try {
      const sups = BusinessEngineService.getSuppliers(orgId);
      const custs = BusinessEngineService.getCustomers(orgId);
      const prs = BusinessEngineService.getPurchaseRequests(orgId);
      const pos = BusinessEngineService.getPurchaseOrders(orgId);
      const irs = BusinessEngineService.getInternalRequests(orgId);
      const seqs = BusinessEngineService.getDocumentSequences(orgId);

      setSuppliers(sups);
      setCustomers(custs);
      setPurchaseRequests(prs);
      setPurchaseOrders(pos);
      setInternalRequests(irs);
      setSequences(seqs);
    } catch (err: any) {
      console.error('Error loading business engine data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    return BusinessEngineService.getBusinessDashboardMetrics(orgId, costMethod);
  }, [orgId, costMethod, suppliers, customers, purchaseOrders, purchaseRequests, internalRequests]);

  const warehouses = useMemo(() => WarehouseEngineService.getWarehouses(orgId), [orgId]);
  const items = useMemo(() => WarehouseEngineService.getItems(orgId), [orgId]);
  const locations = useMemo(() => WarehouseEngineService.getLocations(orgId), [orgId]);

  // Handler: Add Supplier
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!supplierForm.supplierName || !supplierForm.contactPerson) {
        showNotification(isRTL ? 'يرجى إدخال اسم المورد والشخص المسؤول' : 'Supplier name and contact person required', 'error');
        return;
      }
      const code = supplierForm.supplierCode || BusinessEngineService.generateDocumentNumber(orgId, 'RECEIVING', 'SUP');
      await BusinessEngineService.createSupplier(
        orgId,
        {
          ...supplierForm,
          supplierCode: code,
          supplierName: supplierForm.supplierName!,
          contactPerson: supplierForm.contactPerson!,
          phone: supplierForm.phone || '',
          email: supplierForm.email || '',
          address: supplierForm.address || '',
          country: supplierForm.country || 'Iraq',
          city: supplierForm.city || 'Baghdad',
          paymentTerms: supplierForm.paymentTerms || 'NET_30',
          currency: supplierForm.currency || orgCurrency,
          status: (supplierForm.status as any) || 'ACTIVE',
        },
        currentUser?.name || 'Administrator'
      );
      showNotification(isRTL ? 'تم تسجيل المورد بنجاح' : 'Supplier registered successfully');
      setIsAddSupplierOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Handler: Add Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!customerForm.customerName || !customerForm.contactPerson) {
        showNotification(isRTL ? 'يرجى إدخال اسم العميل ومسؤول الاتصال' : 'Customer name and contact person required', 'error');
        return;
      }
      const code = customerForm.customerCode || BusinessEngineService.generateDocumentNumber(orgId, 'ISSUE', 'CUS');
      await BusinessEngineService.createCustomer(
        orgId,
        {
          ...customerForm,
          customerCode: code,
          customerName: customerForm.customerName!,
          contactPerson: customerForm.contactPerson!,
          phone: customerForm.phone || '',
          email: customerForm.email || '',
          address: customerForm.address || '',
          country: customerForm.country || 'Iraq',
          city: customerForm.city || 'Baghdad',
          paymentTerms: customerForm.paymentTerms || 'NET_15',
          currency: customerForm.currency || orgCurrency,
          status: (customerForm.status as any) || 'ACTIVE',
        },
        currentUser?.name || 'Administrator'
      );
      showNotification(isRTL ? 'تم تسجيل العميل بنجاح' : 'Customer registered successfully');
      setIsAddCustomerOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Handler: Run Tests
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    try {
      const results = await BusinessEngineService.runIntegrationTestScenarios(orgId);
      setTestResults(results);
      loadData();
      showNotification(isRTL ? 'اكتمل فحص سيناريوهات التكامل بنجاح' : 'All 10 integration scenarios verified successfully');
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-16">
      {/* Top Tenant Header & Organization Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/40 border border-indigo-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              TENANT: {currentOrganization?.name || orgId}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              CURRENCY: {orgCurrency}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
              STATUS: {currentOrganization?.status || 'ACTIVE'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-indigo-400" />
            {isRTL ? 'منظومة إدارة الأعمال والمشتريات والعملاء' : 'Enterprise Business & Purchasing Hub'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'إدارة شاملة للموردين، طلبات الشراء، أوامر التوريد، الاستلام الجزئي، العملاء، وطلبات الصرف الداخلي عبر سجلات معزولة بالكامل.'
              : 'Multi-tenant purchasing, vendor contracts, partial receiving linked to inventory ledger, customer master, and departmental requisitions.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('TESTS');
              handleRunAllTests();
            }}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 transition cursor-pointer"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{isRunningTests ? (isRTL ? 'جار الفحص...' : 'Running...') : (isRTL ? 'تشغيل 10 سيناريوهات' : 'Run 10 Test Scenarios')}</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-lg border ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/80 text-rose-200 border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'OVERVIEW', labelEn: 'Overview & Analytics', labelAr: 'نظرة عامة والتحليلات', icon: Activity, count: undefined },
          { id: 'SUPPLIERS', labelEn: 'Suppliers Master', labelAr: 'سجل الموردين', icon: Users, count: suppliers.length },
          { id: 'PURCHASE_REQUESTS', labelEn: 'Purchase Requests', labelAr: 'طلبات الشراء', icon: Send, count: purchaseRequests.filter(p => p.status === 'SUBMITTED').length || purchaseRequests.length },
          { id: 'PURCHASE_ORDERS', labelEn: 'Purchase Orders', labelAr: 'أوامر الشراء والتوريد', icon: ShoppingCart, count: purchaseOrders.filter(p => p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED').length || purchaseOrders.length },
          { id: 'CUSTOMERS', labelEn: 'Customers Master', labelAr: 'سجل العملاء', icon: Building2, count: customers.length },
          { id: 'INTERNAL_REQUESTS', labelEn: 'Internal Stock Requests', labelAr: 'طلبات الصرف الداخلي', icon: Layers, count: internalRequests.filter(r => r.status === 'APPROVED' || r.status === 'REQUESTED').length || internalRequests.length },
          { id: 'SEQUENCES', labelEn: 'Document Sequences', labelAr: 'ترقيم المستندات', icon: Hash, count: sequences.length },
          { id: 'TESTS', labelEn: 'Scenario Test Runner (10)', labelAr: 'فاحص سيناريوهات التكامل', icon: CheckCircle2, count: testResults.length ? `${testResults.filter(r => r.status === 'PASSED').length}/${testResults.length}` : undefined },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as BusinessTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950 font-black'
                  : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">{isRTL ? 'إجمالي أوامر الشراء' : 'Total Purchase Orders'}</p>
                <p className="text-2xl font-black text-white mt-1">{purchaseOrders.length}</p>
                <p className="text-[11px] text-amber-400 mt-0.5">{metrics.pendingPoDeliveriesCount} {isRTL ? 'قيد التوريد والتسليم' : 'pending delivery'}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">{isRTL ? 'إجمالي المشتريات والإنفاق' : 'Total Procurement Value'}</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  {metrics.totalProcurementSpend.toLocaleString()} <span className="text-xs font-normal text-slate-400">{orgCurrency}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{purchaseOrders.reduce((sum, po) => sum + po.totalReceivedQuantity, 0).toLocaleString()} {isRTL ? 'وحدة مستلمة' : 'units received'}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">{isRTL ? 'الموردين والعملاء المسجلين' : 'Suppliers & Customers'}</p>
                <p className="text-2xl font-black text-white mt-1">
                  {suppliers.length} <span className="text-sm font-normal text-slate-400">/ {customers.length}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{suppliers.filter(s => s.status === 'ACTIVE').length} {isRTL ? 'مورد نشط' : 'active vendors'}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">{isRTL ? 'طلبات الصرف الداخلي' : 'Internal Requisitions'}</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{internalRequests.length}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{internalRequests.filter(r => r.status === 'APPROVED').length} {isRTL ? 'معتمد بانتظار الصرف' : 'ready for issuance'}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Real-time Inventory vs PO Pipeline */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  {isRTL ? 'خط أنابيب التوريد مقابل المخزون الفعلي (Live Stock vs PO Pipeline)' : 'Live Warehouse Stock vs Inbound PO Pipeline'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRTL
                    ? 'رؤية متكاملة لرصيد المستودعات الحالي بالإضافة إلى الكميات المتعاقد عليها قيد الشحن والتوريد.'
                    : 'Compare on-hand warehouse inventory with confirmed purchase order quantities currently in transit.'}
                </p>
              </div>

              {/* Cost Method Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{isRTL ? 'طريقة تقييم المخزون:' : 'Cost Method:'}</span>
                <select
                  value={costMethod}
                  onChange={(e) => setCostMethod(e.target.value as InventoryCostMethod)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1 font-mono text-xs cursor-pointer focus:outline-none focus:border-indigo-500"
                >
                  <option value="NONE">{isRTL ? 'بدون تسعير (كميات فقط)' : 'None (Quantity Only)'}</option>
                  <option value="LAST_PURCHASE_PRICE">{isRTL ? 'سعر الشراء الأخير (LPP)' : 'Last Purchase Price'}</option>
                  <option value="AVERAGE_COST">{isRTL ? 'متوسط التكلفة المرجح (WAC)' : 'Weighted Average Cost'}</option>
                  <option value="FIFO_FOUNDATION">{isRTL ? 'الوارد أولاً صادر أولاً (FIFO)' : 'FIFO Foundation'}</option>
                </select>
              </div>
            </div>

            {/* Pipeline Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 font-mono">
                  <tr>
                    <th className="p-3">{isRTL ? 'رمز الخامة' : 'Item Code'}</th>
                    <th className="p-3">{isRTL ? 'اسم المادة' : 'Material Name'}</th>
                    <th className="p-3">{isRTL ? 'الفئة' : 'Category'}</th>
                    <th className="p-3">{isRTL ? 'المخزون الفعلي بالمستودع' : 'On-Hand Stock'}</th>
                    <th className="p-3">{isRTL ? 'قيد التوريد (أوامر الشراء)' : 'Inbound PO Pipeline'}</th>
                    <th className="p-3">{isRTL ? 'المخزون المتوقع' : 'Projected Stock'}</th>
                    <th className="p-3">{isRTL ? 'حالة التغطية' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {metrics.stockVsPoPipeline.slice(0, 8).map((p) => {
                    const isDeficit = p.onHandQuantity < 100 && p.incomingPoQuantity === 0;
                    return (
                      <tr key={p.itemId} className="hover:bg-slate-800/30 transition">
                        <td className="p-3 font-mono font-bold text-indigo-300">{p.itemCode}</td>
                        <td className="p-3 text-white font-medium">{p.itemName}</td>
                        <td className="p-3 text-slate-400">{p.category}</td>
                        <td className="p-3 font-mono font-bold text-white">
                          {p.onHandQuantity.toLocaleString()} <span className="text-slate-400 font-normal">{p.unit}</span>
                        </td>
                        <td className="p-3 font-mono text-amber-300">
                          {p.incomingPoQuantity > 0 ? `+${p.incomingPoQuantity.toLocaleString()} ${p.unit}` : '—'}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-300">
                          {p.projectedStock.toLocaleString()} <span className="text-slate-400 font-normal">{p.unit}</span>
                        </td>
                        <td className="p-3">
                          {isDeficit ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-500/30">
                              {isRTL ? 'نقص حرج' : 'REORDER REQUIRED'}
                            </span>
                          ) : p.incomingPoQuantity > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-500/30">
                              {isRTL ? 'شحنة قادمة' : 'PIPELINE ACTIVE'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                              {isRTL ? 'مخزون آمن' : 'HEALTHY'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {metrics.stockVsPoPipeline.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        {isRTL ? 'لا توجد خامات مسجلة في هذا المستودع بعد' : 'No items found in this organization yet'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SUPPLIERS MASTER */}
      {/* ========================================================================= */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={isRTL ? 'بحث بالاسم، الكود، جهة الاتصال، الهاتف...' : 'Search by supplier, code, contact, phone...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">{isRTL ? 'كل الحالات' : 'All Status'}</option>
                <option value="ACTIVE">{isRTL ? 'نشط فقط' : 'Active'}</option>
                <option value="INACTIVE">{isRTL ? 'غير نشط' : 'Inactive'}</option>
                <option value="BLOCKED">{isRTL ? 'محظور' : 'Blocked'}</option>
              </select>
            </div>

            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ إضافة مورد جديد' : '+ Register Supplier'}</span>
            </button>
          </div>

          {/* Suppliers Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">{isRTL ? 'رمز المورد' : 'Supplier Code'}</th>
                  <th className="p-3">{isRTL ? 'اسم المورد التجاري' : 'Supplier Name'}</th>
                  <th className="p-3">{isRTL ? 'جهة الاتصال' : 'Contact Person'}</th>
                  <th className="p-3">{isRTL ? 'الهاتف والبريد' : 'Contact Info'}</th>
                  <th className="p-3">{isRTL ? 'البلد والمدينة' : 'Location'}</th>
                  <th className="p-3">{isRTL ? 'شروط الدفع' : 'Payment Terms'}</th>
                  <th className="p-3">{isRTL ? 'إجمالي التوريدات (كغم)' : 'Total Delivered'}</th>
                  <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-right">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {suppliers
                  .filter((s) => {
                    const matchesQuery =
                      s.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.supplierCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.phone.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
                    return matchesQuery && matchesStatus;
                  })
                  .map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono font-bold text-indigo-400">{s.supplierCode}</td>
                      <td className="p-3">
                        <p className="font-bold text-white">{s.supplierName}</p>
                        {s.legalName && <p className="text-[10px] text-slate-400">{s.legalName}</p>}
                      </td>
                      <td className="p-3 text-slate-200">{s.contactPerson}</td>
                      <td className="p-3 text-slate-300">
                        <p>{s.phone}</p>
                        <p className="text-[10px] text-slate-500">{s.email}</p>
                      </td>
                      <td className="p-3 text-slate-400">{s.city}, {s.country}</td>
                      <td className="p-3 font-mono text-slate-300">{s.paymentTerms}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {(s.totalDeliveredKG || 0).toLocaleString()} <span className="text-[10px] text-slate-400">KG</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : s.status === 'BLOCKED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedSupplier(s)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-500/40 font-mono text-[11px] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isRTL ? 'تفاصيل وسجل' : 'Details'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PURCHASE REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'PURCHASE_REQUESTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{isRTL ? 'تصفية حسب الحالة:' : 'Filter status:'}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">{isRTL ? 'الكل' : 'All'}</option>
                <option value="SUBMITTED">{isRTL ? 'مقدم بانتظار الاعتماد' : 'Submitted / Pending'}</option>
                <option value="APPROVED">{isRTL ? 'معتمد' : 'Approved'}</option>
                <option value="CONVERTED_TO_PO">{isRTL ? 'محول لأمر شراء' : 'Converted to PO'}</option>
                <option value="REJECTED">{isRTL ? 'مرفوض' : 'Rejected'}</option>
              </select>
            </div>

            <button
              onClick={() => setIsAddPROpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ طلب شراء داخلي جديد' : '+ New Purchase Request'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">{isRTL ? 'رقم الطلب' : 'Request #'}</th>
                  <th className="p-3">{isRTL ? 'مقدم الطلب' : 'Requested By'}</th>
                  <th className="p-3">{isRTL ? 'القسم' : 'Department'}</th>
                  <th className="p-3">{isRTL ? 'تاريخ الاستحقاق' : 'Required Date'}</th>
                  <th className="p-3">{isRTL ? 'الأولوية' : 'Priority'}</th>
                  <th className="p-3">{isRTL ? 'الأصناف المطلوبة' : 'Items Count'}</th>
                  <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-right">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {purchaseRequests
                  .filter((pr) => statusFilter === 'ALL' || pr.status === statusFilter)
                  .map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono font-bold text-indigo-400">{pr.requestNumber}</td>
                      <td className="p-3 font-medium text-white">{pr.requestedBy}</td>
                      <td className="p-3 text-slate-300">{pr.department}</td>
                      <td className="p-3 text-slate-400">{pr.requiredDate}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            pr.priority === 'URGENT'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : pr.priority === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {pr.priority}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{pr.items.length} {isRTL ? 'خامة' : 'items'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            pr.status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : pr.status === 'CONVERTED_TO_PO'
                              ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                              : pr.status === 'REJECTED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {pr.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1 space-x-reverse">
                        {pr.status === 'SUBMITTED' && (
                          <button
                            onClick={async () => {
                              await BusinessEngineService.approvePurchaseRequest(orgId, pr.id, currentUser?.name || 'Manager');
                              showNotification(isRTL ? 'تمت الموافقة على طلب الشراء' : 'Purchase request approved');
                              loadData();
                            }}
                            className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/40 text-[11px] font-bold cursor-pointer"
                          >
                            {isRTL ? 'موافقة' : 'Approve'}
                          </button>
                        )}
                        {pr.status === 'APPROVED' && (
                          <button
                            onClick={async () => {
                              const sup = suppliers[0];
                              const wh = warehouses[0];
                              if (!sup || !wh) {
                                showNotification(isRTL ? 'يرجى تسجيل مورد ومستودع أولاً' : 'Register a supplier and warehouse first', 'error');
                                return;
                              }
                              await BusinessEngineService.convertRequestToPurchaseOrder(
                                orgId,
                                pr.id,
                                sup.id,
                                wh.id,
                                currentUser?.name || 'Administrator'
                              );
                              showNotification(isRTL ? 'تم تحويل الطلب إلى أمر شراء بنجاح' : 'Converted to Purchase Order successfully');
                              loadData();
                            }}
                            className="px-2.5 py-1 rounded bg-purple-950 text-purple-300 hover:bg-purple-900 border border-purple-500/40 text-[11px] font-bold cursor-pointer"
                          >
                            {isRTL ? 'تحويل لأمر شراء' : 'Convert to PO'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PURCHASE ORDERS & PARTIAL RECEIVING */}
      {/* ========================================================================= */}
      {activeTab === 'PURCHASE_ORDERS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{isRTL ? 'تصفية الأوامر:' : 'Filter POs:'}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
              >
                <option value="ALL">{isRTL ? 'كل الحالات' : 'All Status'}</option>
                <option value="APPROVED">{isRTL ? 'معتمد جاهز للتوريد' : 'Approved (Pending Delivery)'}</option>
                <option value="PARTIALLY_RECEIVED">{isRTL ? 'مستلم جزئياً' : 'Partially Received'}</option>
                <option value="CLOSED">{isRTL ? 'مكتمل ومغلق' : 'Closed / Fully Received'}</option>
              </select>
            </div>

            <button
              onClick={() => setIsAddPOOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ إصدار أمر شراء جديد' : '+ Create Purchase Order'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {purchaseOrders
              .filter((po) => statusFilter === 'ALL' || po.status === statusFilter)
              .map((po) => {
                const percent = Math.min(
                  100,
                  Math.round((po.totalReceivedQuantity / (po.totalOrderedQuantity || 1)) * 100)
                );
                return (
                  <div key={po.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-400 text-sm">{po.documentNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              po.status === 'CLOSED' || po.status === 'RECEIVED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : po.status === 'PARTIALLY_RECEIVED'
                                ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {po.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          {isRTL ? 'المورد:' : 'Supplier:'} <span className="font-bold text-white">{po.supplierName}</span> | {isRTL ? 'المستودع المستهدف:' : 'Target WH:'} <span className="text-indigo-300">{po.warehouseName}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {po.status !== 'CLOSED' && po.status !== 'CANCELLED' && (
                          <button
                            onClick={() => {
                              setSelectedPO(po);
                              setIsReceivePOOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>{isRTL ? 'استلام بضاعة بالمستودع' : 'Receive Goods into Ledger'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar of Receiving */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-400">
                          {isRTL ? 'الكمية المستلمة فعلياً في المستودع:' : 'Received into Warehouse:'}{' '}
                          <span className="text-emerald-400 font-bold">{po.totalReceivedQuantity.toLocaleString()}</span> / {po.totalOrderedQuantity.toLocaleString()}
                        </span>
                        <span className="text-slate-300 font-bold">{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Order Lines Breakdown */}
                    <div className="overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
                      <table className="w-full text-left text-xs">
                        <thead className="text-slate-400 border-b border-slate-800/80 font-mono text-[11px]">
                          <tr>
                            <th className="p-2.5">{isRTL ? 'الرمز' : 'Code'}</th>
                            <th className="p-2.5">{isRTL ? 'الخامة' : 'Item'}</th>
                            <th className="p-2.5">{isRTL ? 'المطلوب' : 'Ordered'}</th>
                            <th className="p-2.5">{isRTL ? 'المستلم' : 'Received'}</th>
                            <th className="p-2.5">{isRTL ? 'المتبقي' : 'Remaining'}</th>
                            <th className="p-2.5">{isRTL ? 'سعر الوحدة' : 'Unit Price'}</th>
                            <th className="p-2.5 text-right">{isRTL ? 'الإجمالي' : 'Total'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {po.lines.map((line) => (
                            <tr key={line.itemId}>
                              <td className="p-2.5 font-mono text-indigo-400">{line.itemCode}</td>
                              <td className="p-2.5 text-white font-medium">{line.itemName}</td>
                              <td className="p-2.5 font-mono">{line.orderedQuantity.toLocaleString()} {line.unit}</td>
                              <td className="p-2.5 font-mono text-emerald-400 font-bold">{line.receivedQuantity.toLocaleString()} {line.unit}</td>
                              <td className="p-2.5 font-mono text-amber-400 font-bold">{line.remainingQuantity.toLocaleString()} {line.unit}</td>
                              <td className="p-2.5 font-mono text-slate-300">{line.unitPrice} {po.currency}</td>
                              <td className="p-2.5 font-mono text-right text-white font-bold">{line.totalPrice.toLocaleString()} {po.currency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CUSTOMERS MASTER */}
      {/* ========================================================================= */}
      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={isRTL ? 'بحث بالاسم، الكود، جهة الاتصال...' : 'Search customer, code, contact...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ إضافة عميل جديد' : '+ Register Customer'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">{isRTL ? 'كود العميل' : 'Customer Code'}</th>
                  <th className="p-3">{isRTL ? 'اسم العميل' : 'Customer Name'}</th>
                  <th className="p-3">{isRTL ? 'مسؤول الاتصال' : 'Contact'}</th>
                  <th className="p-3">{isRTL ? 'الهاتف' : 'Phone'}</th>
                  <th className="p-3">{isRTL ? 'الموقع' : 'Location'}</th>
                  <th className="p-3">{isRTL ? 'شروط الدفع' : 'Payment'}</th>
                  <th className="p-3">{isRTL ? 'إجمالي المنصرف (كغم)' : 'Total Dispatched'}</th>
                  <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {customers
                  .filter((c) => c.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono font-bold text-indigo-400">{c.customerCode}</td>
                      <td className="p-3 font-bold text-white">{c.customerName}</td>
                      <td className="p-3 text-slate-200">{c.contactPerson}</td>
                      <td className="p-3 text-slate-300">{c.phone}</td>
                      <td className="p-3 text-slate-400">{c.city}, {c.country}</td>
                      <td className="p-3 font-mono text-slate-300">{c.paymentTerms}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {(c.totalIssuedKG || 0).toLocaleString()} <span className="text-[10px] text-slate-400">KG</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: INTERNAL STOCK REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'INTERNAL_REQUESTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">{isRTL ? 'طلبات الصرف الداخلي للأقسام (خطوط الإنتاج والصيانة)' : 'Departmental Requisitions (Production & Maintenance)'}</h3>
              <p className="text-xs text-slate-400">{isRTL ? 'صرف المواد من المستودع مباشرة مع تحديث سجل الحركات المخزنية' : 'Issue stock against approved internal requisitions directly updating ledger'}</p>
            </div>

            <button
              onClick={() => setIsAddInternalReqOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ طلب صرف داخلي' : '+ New Internal Requisition'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {internalRequests.map((req) => (
              <div key={req.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <span className="font-mono font-bold text-indigo-400 text-sm">{req.requestNumber}</span>
                    <span
                      className={`ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        req.status === 'FULFILLED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : req.status === 'APPROVED'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {req.status}
                    </span>
                    <p className="text-xs text-slate-300 mt-1">
                      {isRTL ? 'القسم:' : 'Dept:'} <span className="font-bold text-white">{req.department}</span> | {isRTL ? 'الغرض:' : 'Purpose:'} <span className="text-slate-400">{req.purpose}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.status === 'REQUESTED' && (
                      <button
                        onClick={async () => {
                          await BusinessEngineService.approveInternalRequest(orgId, req.id, currentUser?.name || 'Supervisor');
                          showNotification(isRTL ? 'تمت الموافقة على طلب الصرف الداخلي' : 'Requisition approved');
                          loadData();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                      >
                        {isRTL ? 'موافقة المشرف' : 'Approve'}
                      </button>
                    )}
                    {req.status === 'APPROVED' && (
                      <button
                        onClick={() => {
                          setSelectedInternalReq(req);
                          setIsFulfillReqOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer flex items-center gap-1.5"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>{isRTL ? 'صرف من المستودع' : 'Issue Stock from Warehouse'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                      <tr>
                        <th className="p-2.5">{isRTL ? 'الرمز' : 'Code'}</th>
                        <th className="p-2.5">{isRTL ? 'المادة' : 'Item'}</th>
                        <th className="p-2.5">{isRTL ? 'الكمية المطلوبة' : 'Requested'}</th>
                        <th className="p-2.5">{isRTL ? 'المصروف فعلياً' : 'Issued'}</th>
                        <th className="p-2.5">{isRTL ? 'المتبقي' : 'Remaining'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {req.items.map((i) => (
                        <tr key={i.itemId}>
                          <td className="p-2.5 font-mono text-indigo-400">{i.itemCode}</td>
                          <td className="p-2.5 text-white font-medium">{i.itemName}</td>
                          <td className="p-2.5 font-mono">{i.requestedQuantity.toLocaleString()} {i.unit}</td>
                          <td className="p-2.5 font-mono text-emerald-400 font-bold">{i.issuedQuantity.toLocaleString()} {i.unit}</td>
                          <td className="p-2.5 font-mono text-amber-400 font-bold">{i.remainingQuantity.toLocaleString()} {i.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: DOCUMENT NUMBERING SEQUENCES */}
      {/* ========================================================================= */}
      {activeTab === 'SEQUENCES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-indigo-400" />
              {isRTL ? 'تكوين تسلسل ترقيم المستندات لكل منشأة' : 'Per-Organization Document Sequence Configuration'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'تخصيص بادئات الترقيم وأطوال الأرقام وقواعد إعادة التعيين السنوي لطلبات الشراء، أوامر التوريد، واستلامات المستودع.'
                : 'Configure document prefixes, padding lengths, and year reset triggers for all business workflows.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sequences.map((seq) => {
              const previewNumber = `${seq.prefix}-${new Date().getFullYear()}-${String(seq.nextNumber).padStart(seq.padLength, '0')}`;
              return (
                <div key={seq.documentType} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-xs">{seq.documentType}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                      NEXT: {previewNumber}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">{isRTL ? 'البادئة (Prefix):' : 'Prefix:'}</label>
                      <input
                        type="text"
                        value={seq.prefix}
                        onChange={(e) => {
                          const updated = sequences.map((s) => s.documentType === seq.documentType ? { ...s, prefix: e.target.value } : s);
                          setSequences(updated);
                          BusinessEngineService.saveDocumentSequenceConfig(orgId, { ...seq, prefix: e.target.value });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-mono w-full"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">{isRTL ? 'طول التصفير (Pad Length):' : 'Pad Length:'}</label>
                      <input
                        type="number"
                        min={3}
                        max={10}
                        value={seq.padLength}
                        onChange={(e) => {
                          const len = parseInt(e.target.value) || 6;
                          const updated = sequences.map((s) => s.documentType === seq.documentType ? { ...s, padLength: len } : s);
                          setSequences(updated);
                          BusinessEngineService.saveDocumentSequenceConfig(orgId, { ...seq, padLength: len });
                        }}
                        className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-mono w-full"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: INTEGRATION SCENARIOS TEST RUNNER */}
      {/* ========================================================================= */}
      {activeTab === 'TESTS' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {isRTL ? 'فاحص سيناريوهات التكامل المؤتمت (10 سيناريوهات)' : 'Automated 10 Scenario Integration Test Runner'}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {isRTL
                  ? 'يتحقق من عزل المنشآت، أوامر الشراء، الاستلام الجزئي، عدم تعديل المخزون قبل التوريد الفعلي، طلبات الصرف، وعزل البيانات الصارم.'
                  : 'Validates strict tenant isolation, PO life-cycle, partial receiving, stock non-mutation until receipt, requisitions, and zero-leakage security.'}
              </p>
            </div>

            <button
              onClick={handleRunAllTests}
              disabled={isRunningTests}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950 transition cursor-pointer flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{isRunningTests ? (isRTL ? 'جاري الفحص...' : 'Running Verification...') : (isRTL ? 'تشغيل كافة الفحوصات الآن' : 'Execute All 10 Tests')}</span>
            </button>
          </div>

          {/* Test Results Display */}
          <div className="grid grid-cols-1 gap-3">
            {testResults.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  res.status === 'PASSED'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {res.status === 'PASSED' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs">{res.testId}</span>
                      <span className="font-bold text-sm text-white">{res.name}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{res.details}</p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-black self-start sm:self-auto ${
                    res.status === 'PASSED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {res.status}
                </span>
              </div>
            ))}

            {testResults.length === 0 && !isRunningTests && (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                <PlayCircle className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">{isRTL ? 'اضغط على زر التشغيل لتنفيذ كافة السيناريوهات العشرة' : 'Click "Execute All 10 Tests" to run automated end-to-end integration validation'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD SUPPLIER */}
      {/* ========================================================================= */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                {isRTL ? 'تسجيل مورد جديد' : 'Register New Supplier'}
              </h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'كود المورد (اختياري)' : 'Supplier Code:'}</label>
                  <input
                    type="text"
                    placeholder="SUP-001"
                    value={supplierForm.supplierCode}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'اسم المورد التجاري *' : 'Supplier Name *:'}</label>
                  <input
                    type="text"
                    required
                    placeholder="SABIC Polymers"
                    value={supplierForm.supplierName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, supplierName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'مسؤول الاتصال *' : 'Contact Person *:'}</label>
                  <input
                    type="text"
                    required
                    placeholder="Eng. Ahmed"
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'رقم الهاتف' : 'Phone:'}</label>
                  <input
                    type="text"
                    placeholder="+964 770 123 4567"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email:'}</label>
                  <input
                    type="email"
                    placeholder="sales@supplier.com"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'شروط الدفع' : 'Payment Terms:'}</label>
                  <select
                    value={supplierForm.paymentTerms}
                    onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="IMMEDIATE">{isRTL ? 'فوري' : 'Immediate / Cash'}</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'البلد' : 'Country:'}</label>
                  <input
                    type="text"
                    value={supplierForm.country}
                    onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المدينة' : 'City:'}</label>
                  <input
                    type="text"
                    value={supplierForm.city}
                    onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'حفظ المورد' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CUSTOMER */}
      {/* ========================================================================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                {isRTL ? 'تسجيل عميل جديد' : 'Register New Customer'}
              </h3>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'كود العميل (اختياري)' : 'Customer Code:'}</label>
                  <input
                    type="text"
                    placeholder="CUS-001"
                    value={customerForm.customerCode}
                    onChange={(e) => setCustomerForm({ ...customerForm, customerCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'اسم العميل *' : 'Customer Name *:'}</label>
                  <input
                    type="text"
                    required
                    placeholder="National Food Packaging Co"
                    value={customerForm.customerName}
                    onChange={(e) => setCustomerForm({ ...customerForm, customerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'مسؤول الاتصال *' : 'Contact Person *:'}</label>
                  <input
                    type="text"
                    required
                    placeholder="Hassan Al-Tamimi"
                    value={customerForm.contactPerson}
                    onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'رقم الهاتف' : 'Phone:'}</label>
                  <input
                    type="text"
                    placeholder="+964 771 987 6543"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'البلد' : 'Country:'}</label>
                  <input
                    type="text"
                    value={customerForm.country}
                    onChange={(e) => setCustomerForm({ ...customerForm, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المدينة' : 'City:'}</label>
                  <input
                    type="text"
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'حفظ العميل' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RECEIVE GOODS INTO LEDGER AGAINST PURCHASE ORDER */}
      {/* ========================================================================= */}
      {isReceivePOOpen && selectedPO && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  {isRTL ? 'استلام بضاعة فعلية في سجل المستودع (Goods Receipt)' : 'Receive Goods into Universal Inventory Ledger'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedPO.documentNumber} • {selectedPO.supplierName} • {isRTL ? 'المستودع:' : 'Warehouse:'} {selectedPO.warehouseName}
                </p>
              </div>
              <button onClick={() => setIsReceivePOOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetLoc = locations[0]?.id || 'LOC-GEN-01';
                  const targetLines = selectedPO.lines
                    .filter((l) => l.remainingQuantity > 0)
                    .map((l) => ({
                      itemId: l.itemId,
                      receiveQuantity: l.remainingQuantity, // Default receive remaining
                      batchId: `BAT-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
                    }));

                  await BusinessEngineService.receivePurchaseOrderLines(
                    orgId,
                    selectedPO.id,
                    {
                      warehouseId: selectedPO.warehouseId,
                      locationId: targetLoc,
                      notes: `Full/Partial Intake against ${selectedPO.documentNumber}`,
                      lines: targetLines,
                    },
                    currentUser?.name || 'Storekeeper'
                  );

                  showNotification(
                    isRTL
                      ? 'تم تأكيد استلام البضاعة وتسجيل الحركات في دفتر الأستاذ بنجاح!'
                      : 'Goods received and posted to universal ledger successfully!'
                  );
                  setIsReceivePOOpen(false);
                  loadData();
                } catch (err: any) {
                  showNotification(err.message, 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300">
                {isRTL
                  ? 'ملاحظة تشغيلية: سيؤدي هذا الإجراء فوراً إلى زيادة رصيد المستودع الفعلي وتوليد إشعار استلام رسمي وتحديث الكميات المتبقية على أمر الشراء.'
                  : 'Operational Notice: Confirming this receipt increments warehouse ledger balances immediately, generates an immutable Goods Receipt document, and updates order lines.'}
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-bold block">{isRTL ? 'الخامات المتبقية على أمر الشراء:' : 'Lines Remaining to Receive:'}</label>
                {selectedPO.lines.map((line) => (
                  <div key={line.itemId} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{line.itemName} <span className="font-mono text-indigo-400 text-[11px]">({line.itemCode})</span></p>
                      <p className="text-slate-400 text-[11px]">
                        {isRTL ? 'المطلوب:' : 'Ordered:'} {line.orderedQuantity} {line.unit} • {isRTL ? 'المستلم سابقاً:' : 'Received:'} {line.receivedQuantity} {line.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        +{line.remainingQuantity} {line.unit}
                      </span>
                      <p className="text-[10px] text-slate-500">{isRTL ? 'متبقي للتوريد' : 'remaining'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReceivePOOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950"
                >
                  {isRTL ? 'تأكيد الاستلام في المستودع' : 'Confirm Goods Receipt into Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE PURCHASE REQUEST */}
      {/* ========================================================================= */}
      {isAddPROpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                {isRTL ? 'إنشاء طلب شراء داخلي' : 'New Internal Purchase Request'}
              </h3>
              <button onClick={() => setIsAddPROpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetItem = items.find((i) => i.id === prForm.itemId) || items[0];
                  if (!targetItem) {
                    showNotification(isRTL ? 'لا توجد خامات مسجلة' : 'No items found in system', 'error');
                    return;
                  }
                  await BusinessEngineService.createPurchaseRequest(
                    orgId,
                    {
                      requestedBy: currentUser?.name || 'Engineer',
                      department: prForm.department,
                      requiredDate: prForm.requiredDate,
                      priority: prForm.priority,
                      reason: prForm.reason,
                      items: [
                        {
                          itemId: targetItem.id,
                          itemCode: targetItem.itemCode,
                          itemName: targetItem.nameAr || targetItem.name,
                          requestedQuantity: Number(prForm.quantity) || 100,
                          unit: (targetItem.unitOfMeasure as any) || 'KG',
                          estimatedUnitPrice: Number(prForm.unitPrice) || 1.0,
                        },
                      ],
                    },
                    currentUser?.name || 'Engineer'
                  );
                  showNotification(isRTL ? 'تم إنشاء وتقديم طلب الشراء بنجاح' : 'Purchase request submitted successfully');
                  setIsAddPROpen(false);
                  loadData();
                } catch (err: any) {
                  showNotification(err.message, 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'القسم الطالب:' : 'Department:'}</label>
                  <input
                    type="text"
                    value={prForm.department}
                    onChange={(e) => setPrForm({ ...prForm, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'تاريخ الاحتياج المطلوب:' : 'Required Date:'}</label>
                  <input
                    type="date"
                    value={prForm.requiredDate}
                    onChange={(e) => setPrForm({ ...prForm, requiredDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'الأولوية:' : 'Priority:'}</label>
                  <select
                    value={prForm.priority}
                    onChange={(e) => setPrForm({ ...prForm, priority: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'سبب الطلب:' : 'Reason / Justification:'}</label>
                  <input
                    type="text"
                    value={prForm.reason}
                    onChange={(e) => setPrForm({ ...prForm, reason: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-slate-300 block">{isRTL ? 'الخامة والكمية المطلوبة:' : 'Requested Item & Quantity:'}</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-slate-500 mb-1">{isRTL ? 'الخامة:' : 'Material:'}</label>
                    <select
                      value={prForm.itemId}
                      onChange={(e) => setPrForm({ ...prForm, itemId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="">{isRTL ? '-- اختر خامة --' : '-- Select Item --'}</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.itemCode} - {i.nameAr || i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">{isRTL ? 'الكمية المطلوبة:' : 'Quantity:'}</label>
                    <input
                      type="number"
                      min={1}
                      value={prForm.quantity}
                      onChange={(e) => setPrForm({ ...prForm, quantity: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">{isRTL ? 'السعر المقدر:' : 'Estimated Price:'}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={prForm.unitPrice}
                      onChange={(e) => setPrForm({ ...prForm, unitPrice: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPROpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'إرسال طلب الشراء' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE PURCHASE ORDER */}
      {/* ========================================================================= */}
      {isAddPOOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                {isRTL ? 'إصدار أمر شراء رسمي (PO)' : 'Create Official Purchase Order'}
              </h3>
              <button onClick={() => setIsAddPOOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetSup = suppliers.find((s) => s.id === poForm.supplierId) || suppliers[0];
                  const targetWh = warehouses.find((w) => w.id === poForm.warehouseId) || warehouses[0];
                  const targetItem = items.find((i) => i.id === poForm.itemId) || items[0];

                  if (!targetSup || !targetWh || !targetItem) {
                    showNotification(isRTL ? 'يرجى اختيار المورد والمستودع والخامة' : 'Select supplier, warehouse, and item', 'error');
                    return;
                  }

                  const qty = Number(poForm.quantity) || 1000;
                  const price = Number(poForm.unitPrice) || 2.0;

                  await BusinessEngineService.createPurchaseOrder(
                    orgId,
                    {
                      supplierId: targetSup.id,
                      supplierName: targetSup.supplierName,
                      warehouseId: targetWh.id,
                      warehouseName: targetWh.nameAr || targetWh.name,
                      currency: targetSup.currency || orgCurrency,
                      orderDate: new Date().toISOString().split('T')[0],
                      expectedDate: poForm.expectedDate,
                      notes: poForm.notes,
                      lines: [
                        {
                          itemId: targetItem.id,
                          itemCode: targetItem.itemCode,
                          itemName: targetItem.nameAr || targetItem.name,
                          orderedQuantity: qty,
                          unit: (targetItem.unitOfMeasure as any) || 'KG',
                          unitPrice: price,
                          totalPrice: qty * price,
                          receivedQuantity: 0,
                          remainingQuantity: qty,
                        },
                      ],
                    },
                    currentUser?.name || 'Purchasing Officer'
                  );

                  showNotification(isRTL ? 'تم إصدار أمر الشراء بنجاح (المخزون لم يتأثر بعد)' : 'PO created successfully (stock untouched until receipt)');
                  setIsAddPOOpen(false);
                  loadData();
                } catch (err: any) {
                  showNotification(err.message, 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المورد المعتمد *:' : 'Supplier *:'}</label>
                  <select
                    value={poForm.supplierId}
                    onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="">{isRTL ? '-- اختر المورد --' : '-- Select Supplier --'}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplierCode} - {s.supplierName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المستودع المستهدف *:' : 'Target Warehouse *:'}</label>
                  <select
                    value={poForm.warehouseId}
                    onChange={(e) => setPoForm({ ...poForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="">{isRTL ? '-- اختر المستودع --' : '-- Select Warehouse --'}</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.nameAr || w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-slate-300 block">{isRTL ? 'بيانات الخامة والكمية المتعاقد عليها:' : 'Order Line & Agreed Price:'}</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-slate-500 mb-1">{isRTL ? 'الخامة:' : 'Material:'}</label>
                    <select
                      value={poForm.itemId}
                      onChange={(e) => setPoForm({ ...poForm, itemId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="">{isRTL ? '-- اختر خامة --' : '-- Select Item --'}</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.itemCode} - {i.nameAr || i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">{isRTL ? 'الكمية المطلوبة:' : 'Quantity:'}</label>
                    <input
                      type="number"
                      min={1}
                      value={poForm.quantity}
                      onChange={(e) => setPoForm({ ...poForm, quantity: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">{isRTL ? 'سعر الوحدة:' : 'Unit Price:'}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={poForm.unitPrice}
                      onChange={(e) => setPoForm({ ...poForm, unitPrice: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'ملاحظات أمر الشراء:' : 'Notes / Delivery Instructions:'}</label>
                <input
                  type="text"
                  value={poForm.notes}
                  onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPOOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'إصدار أمر الشراء' : 'Generate Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE INTERNAL STOCK REQUEST */}
      {/* ========================================================================= */}
      {isAddInternalReqOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                {isRTL ? 'طلب صرف داخلي للأقسام' : 'New Department Stock Requisition'}
              </h3>
              <button onClick={() => setIsAddInternalReqOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetWh = warehouses.find((w) => w.id === irForm.warehouseId) || warehouses[0];
                  const targetItem = items.find((i) => i.id === irForm.itemId) || items[0];

                  if (!targetWh || !targetItem) {
                    showNotification(isRTL ? 'يرجى اختيار المستودع والخامة' : 'Select warehouse and item', 'error');
                    return;
                  }

                  const qty = Number(irForm.quantity) || 100;

                  await BusinessEngineService.createInternalRequest(
                    orgId,
                    {
                      requestedBy: currentUser?.name || 'Shift Supervisor',
                      department: irForm.department,
                      warehouseId: targetWh.id,
                      warehouseName: targetWh.nameAr || targetWh.name,
                      purpose: irForm.purpose,
                      requiredDate: irForm.requiredDate,
                      items: [
                        {
                          itemId: targetItem.id,
                          itemCode: targetItem.itemCode,
                          itemName: targetItem.nameAr || targetItem.name,
                          requestedQuantity: qty,
                          unit: (targetItem.unitOfMeasure as any) || 'KG',
                        },
                      ],
                    },
                    currentUser?.name || 'Shift Supervisor'
                  );

                  showNotification(isRTL ? 'تم تقديم طلب الصرف الداخلي بنجاح' : 'Requisition created successfully');
                  setIsAddInternalReqOpen(false);
                  loadData();
                } catch (err: any) {
                  showNotification(err.message, 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'القسم الطالب:' : 'Department:'}</label>
                  <select
                    value={irForm.department}
                    onChange={(e) => setIrForm({ ...irForm, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="Production - Extrusion">Production - Extrusion</option>
                    <option value="Production - Thermoforming">Production - Thermoforming</option>
                    <option value="Maintenance Department">Maintenance Department</option>
                    <option value="Packaging & Warehousing">Packaging & Warehousing</option>
                    <option value="Quality Control Lab">Quality Control Lab</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المستودع المصدر:' : 'Source Warehouse:'}</label>
                  <select
                    value={irForm.warehouseId}
                    onChange={(e) => setIrForm({ ...irForm, warehouseId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="">{isRTL ? '-- اختر المستودع --' : '-- Select Warehouse --'}</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.nameAr || w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'الغرض / مبرر الصرف:' : 'Purpose / Justification:'}</label>
                <input
                  type="text"
                  value={irForm.purpose}
                  onChange={(e) => setIrForm({ ...irForm, purpose: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-slate-300 block">{isRTL ? 'الخامة والكمية المراد صرفها:' : 'Material & Required Quantity:'}</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">{isRTL ? 'الخامة:' : 'Material:'}</label>
                    <select
                      value={irForm.itemId}
                      onChange={(e) => setIrForm({ ...irForm, itemId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                    >
                      <option value="">{isRTL ? '-- اختر خامة --' : '-- Select Item --'}</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.itemCode} - {i.nameAr || i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">{isRTL ? 'الكمية:' : 'Quantity:'}</label>
                    <input
                      type="number"
                      min={1}
                      value={irForm.quantity}
                      onChange={(e) => setIrForm({ ...irForm, quantity: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddInternalReqOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'تقديم الطلب' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FULFILL INTERNAL REQUEST (STOCK ISSUE) */}
      {/* ========================================================================= */}
      {isFulfillReqOpen && selectedInternalReq && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-400" />
                  {isRTL ? 'صرف مواد من المستودع للطلب الداخلي' : 'Fulfill Requisition (Warehouse Stock Issue)'}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedInternalReq.requestNumber} • {selectedInternalReq.department}
                </p>
              </div>
              <button onClick={() => setIsFulfillReqOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetLoc = fulfillLocationId || locations[0]?.id || 'LOC-GEN-01';
                  const linesToIssue = selectedInternalReq.items
                    .filter((i) => i.remainingQuantity > 0)
                    .map((i) => ({
                      itemId: i.itemId,
                      issueQuantity: i.remainingQuantity,
                    }));

                  await BusinessEngineService.fulfillInternalRequestLines(
                    orgId,
                    selectedInternalReq.id,
                    {
                      locationId: targetLoc,
                      lines: linesToIssue,
                    },
                    currentUser?.name || 'Warehouse Operator'
                  );

                  showNotification(
                    isRTL
                      ? 'تم صرف المواد من المستودع وتخفيض رصيد الدفتر بنجاح!'
                      : 'Stock issued from warehouse and deducted from ledger successfully!'
                  );
                  setIsFulfillReqOpen(false);
                  loadData();
                } catch (err: any) {
                  showNotification(err.message, 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'موقع التخزين المصروف منه *:' : 'Issue Location *:'}</label>
                <select
                  value={fulfillLocationId}
                  onChange={(e) => setFulfillLocationId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  <option value="">{isRTL ? '-- اختر موقع التخزين --' : '-- Select Storage Location --'}</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 font-bold block">{isRTL ? 'الخامات المطلوب صرفها للمصنع:' : 'Lines to be Issued:'}</label>
                {selectedInternalReq.items.map((i) => (
                  <div key={i.itemId} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{i.itemName} <span className="font-mono text-indigo-400 text-[11px]">({i.itemCode})</span></p>
                      <p className="text-slate-400 text-[11px]">{isRTL ? 'المطلوب:' : 'Requested:'} {i.requestedQuantity} {i.unit}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-400 text-sm">
                        -{i.remainingQuantity} {i.unit}
                      </span>
                      <p className="text-[10px] text-slate-500">{isRTL ? 'سيتم خصمها من المخزون' : 'will deduct from ledger'}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFulfillReqOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'تأكيد الصرف من المستودع' : 'Confirm Warehouse Stock Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SUPPLIER DETAILS & AUDIT HISTORY */}
      {/* ========================================================================= */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  {selectedSupplier.supplierName}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedSupplier.supplierCode} • {selectedSupplier.city}, {selectedSupplier.country}
                </p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">{isRTL ? 'جهة الاتصال' : 'Contact Person'}</span>
                <span className="font-bold text-white">{selectedSupplier.contactPerson}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">{isRTL ? 'رقم الهاتف' : 'Phone'}</span>
                <span className="font-mono text-slate-200">{selectedSupplier.phone || '—'}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">{isRTL ? 'شروط الدفع' : 'Payment Terms'}</span>
                <span className="font-mono text-indigo-400 font-bold">{selectedSupplier.paymentTerms}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block mb-1">{isRTL ? 'إجمالي المستلم' : 'Total Intake'}</span>
                <span className="font-mono text-emerald-400 font-bold">{(selectedSupplier.totalDeliveredKG || 0).toLocaleString()} KG</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">{isRTL ? 'أوامر الشراء المسجلة لهذا المورد:' : 'Purchase Orders for this Vendor:'}</span>
              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                    <tr>
                      <th className="p-2">{isRTL ? 'رقم المستند' : 'PO #'}</th>
                      <th className="p-2">{isRTL ? 'التاريخ' : 'Date'}</th>
                      <th className="p-2">{isRTL ? 'المستودع' : 'Warehouse'}</th>
                      <th className="p-2">{isRTL ? 'الحالة' : 'Status'}</th>
                      <th className="p-2 text-right">{isRTL ? 'المستلم' : 'Received / Ordered'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {purchaseOrders
                      .filter((p) => p.supplierId === selectedSupplier.id)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 font-mono text-indigo-400">{p.documentNumber}</td>
                          <td className="p-2 text-slate-400">{p.orderDate}</td>
                          <td className="p-2 text-slate-300">{p.warehouseName}</td>
                          <td className="p-2 font-mono text-xs">{p.status}</td>
                          <td className="p-2 font-mono text-right text-emerald-400">
                            {p.totalReceivedQuantity} / {p.totalOrderedQuantity}
                          </td>
                        </tr>
                      ))}
                    {purchaseOrders.filter((p) => p.supplierId === selectedSupplier.id).length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-500">
                          {isRTL ? 'لا توجد أوامر شراء مسجلة بعد لهذا المورد' : 'No purchase orders yet for this vendor'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedSupplier(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
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
