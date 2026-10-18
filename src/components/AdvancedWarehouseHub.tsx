import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Barcode,
  QrCode,
  Scale,
  Factory,
  ShieldCheck,
  Recycle,
  Box,
  ClipboardList,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  RefreshCw,
  PlayCircle,
  Sparkles,
  Smartphone,
  Eye,
  Sliders,
  Check,
  X,
  FileText,
  Activity,
  Archive,
  ArrowRightLeft,
  Truck,
  Hash,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { useTenant } from '../context/TenantContext';
import { AdvancedWarehouseService } from '../services/advancedWarehouseService';
import { WarehouseEngineService } from '../services/warehouseEngineService';
import {
  BatchMaster,
  BatchStatus,
  SerialNumberMaster,
  SerialStatus,
  StockReservation,
  ScaleMaster,
  WeightRecord,
  BillOfMaterials,
  ProductionOrder,
  QualityInspection,
  ProcessingOrder,
  ContainerMaster,
  StockCountDocument,
} from '../types/advancedWarehouse';
import { OrganizationModulesConfig } from '../types/tenant';

export type AdvancedTab =
  | 'MODULES'
  | 'BATCHES'
  | 'SERIALS'
  | 'EXPIRY'
  | 'RESERVATIONS'
  | 'WEIGHING'
  | 'PRODUCTION'
  | 'QUALITY'
  | 'PROCESSING'
  | 'CONTAINERS'
  | 'STOCK_COUNTS'
  | 'HANDHELD'
  | 'TESTS';

export const AdvancedWarehouseHub: React.FC = () => {
  const { isRTL, language } = useLanguage();
  const { currentUser } = useFactory();
  const { currentOrganization, updateOrganization, isModuleEnabled } = useTenant();

  const orgId = currentOrganization?.id || 'org_alkarwan';
  const orgCurrency = currentOrganization?.currency || 'USD';

  // Navigation State
  const [activeTab, setActiveTab] = useState<AdvancedTab>('MODULES');

  // Data States
  const [batches, setBatches] = useState<BatchMaster[]>([]);
  const [serials, setSerials] = useState<SerialNumberMaster[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [scales, setScales] = useState<ScaleMaster[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [boms, setBOMs] = useState<BillOfMaterials[]>([]);
  const [prodOrders, setProdOrders] = useState<ProductionOrder[]>([]);
  const [qcInspections, setQCInspections] = useState<QualityInspection[]>([]);
  const [processingOrders, setProcessingOrders] = useState<ProcessingOrder[]>([]);
  const [containers, setContainers] = useState<ContainerMaster[]>([]);
  const [stockCounts, setStockCounts] = useState<StockCountDocument[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [serialQuery, setSerialQuery] = useState('');
  const [searchedSerial, setSearchedSerial] = useState<SerialNumberMaster | null>(null);

  // Modals
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [isAddSerialOpen, setIsAddSerialOpen] = useState(false);
  const [isAddReservationOpen, setIsAddReservationOpen] = useState(false);
  const [isRecordWeightOpen, setIsRecordWeightOpen] = useState(false);
  const [isAddBOMOpen, setIsAddBOMOpen] = useState(false);
  const [isAddProdOrderOpen, setIsAddProdOrderOpen] = useState(false);
  const [isExecuteProdOpen, setIsExecuteProdOpen] = useState(false);
  const [selectedProdOrder, setSelectedProdOrder] = useState<ProductionOrder | null>(null);
  const [isAddQCOpen, setIsAddQCOpen] = useState(false);
  const [isAddProcessingOpen, setIsAddProcessingOpen] = useState(false);
  const [isAddContainerOpen, setIsAddContainerOpen] = useState(false);
  const [isAddCountOpen, setIsAddCountOpen] = useState(false);

  // Forms
  const [weightForm, setWeightForm] = useState({ gross: 12500, tare: 2500, notes: '', scaleCode: 'SCL-WB-01' });
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    itemId: '',
    warehouseId: '',
    locationId: '',
    quantity: 1000,
    expiryDate: '2028-12-31',
    supplierName: '',
  });

  // Test Runner State
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = () => {
    try {
      setBatches(AdvancedWarehouseService.getBatches(orgId));
      setSerials(AdvancedWarehouseService.getSerialNumbers(orgId));
      setReservations(AdvancedWarehouseService.getReservations(orgId));
      setScales(AdvancedWarehouseService.getScales(orgId));
      setWeights(AdvancedWarehouseService.getWeightRecords(orgId));
      setBOMs(AdvancedWarehouseService.getBOMs(orgId));
      setProdOrders(AdvancedWarehouseService.getProductionOrders(orgId));
      setQCInspections(AdvancedWarehouseService.getQualityInspections(orgId));
      setProcessingOrders(AdvancedWarehouseService.getProcessingOrders(orgId));
      setContainers(AdvancedWarehouseService.getContainers(orgId));
      setStockCounts(AdvancedWarehouseService.getStockCounts(orgId));
    } catch (e) {
      console.error('Error loading advanced warehouse data:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  const warehouses = useMemo(() => WarehouseEngineService.getWarehouses(orgId), [orgId]);
  const locations = useMemo(() => WarehouseEngineService.getLocations(orgId), [orgId]);
  const items = useMemo(() => WarehouseEngineService.getItems(orgId), [orgId]);
  const balances = useMemo(() => WarehouseEngineService.computeInventoryBalances(orgId), [orgId]);

  // Near Expiry & Expired Stock calculations
  const nearExpiryBatches = useMemo(() => AdvancedWarehouseService.getNearExpiryStock(orgId, 60), [orgId, batches]);
  const expiredBatches = useMemo(() => AdvancedWarehouseService.getExpiredStock(orgId), [orgId, batches]);

  // Handler: Module Toggle Switchboard
  const handleToggleModule = async (moduleKey: keyof OrganizationModulesConfig) => {
    try {
      const currentConfig = currentOrganization.enabledModules || {};
      const updated = {
        ...currentConfig,
        [moduleKey]: !currentConfig[moduleKey],
      };
      await updateOrganization(orgId, { enabledModules: updated });
      showNotification(
        isRTL
          ? `تم تحديث حالة الوحدة (${String(moduleKey)}) بنجاح`
          : `Module "${String(moduleKey)}" toggled successfully`
      );
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Handler: Run Phase 6 Scenario 38 Tests
  const handleRunScenarioTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    try {
      const res = await AdvancedWarehouseService.runPhase6Scenario38Tests();
      setTestResults(res);
      loadData();
      showNotification(
        isRTL ? 'اكتمل تنفيذ سيناريو الاختبار المتقدم (سيناريو 38) بنجاح!' : 'Phase 6 Scenario 38 Tests completed successfully!'
      );
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-16">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
              COMMERCIAL SAAS EXTENSIONS
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
              PHASE 6 ADVANCED MODULES
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-indigo-400" />
            {isRTL ? 'مركز المستودعات المتقدم والوحدات الصناعية' : 'Advanced Warehouse & Industry Hub'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'إدارة اختيارية للشحنات (Batches)، الأرقام التسلسلية، تواريخ الصلاحية، الموازين، أوامر الإنتاج، الرقابة على الجودة، والجرد الفعلي الدائري.'
              : 'Configurable commercial modules: Batch/lot tracking, serial numbers, expiry policies, scale management, BOM & production execution, QC, and cycle counting.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحديث' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('TESTS');
              handleRunScenarioTests();
            }}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-950/50 transition cursor-pointer"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{isRunningTests ? (isRTL ? 'جار الفحص...' : 'Running...') : (isRTL ? 'تشغيل سيناريو 38' : 'Run Scenario 38 Tests')}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-lg border ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/80 text-rose-200 border-rose-500/40'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'MODULES', labelEn: 'Module Config (Switchboard)', labelAr: 'مفاتيح تفعيل الوحدات', icon: Sliders },
          { id: 'BATCHES', labelEn: 'Batch / Lot Tracking', labelAr: 'تتبع الشحنات واللوت', icon: Layers, count: batches.length },
          { id: 'SERIALS', labelEn: 'Serial Numbers', labelAr: 'الأرقام التسلسلية', icon: Hash, count: serials.length },
          { id: 'EXPIRY', labelEn: 'Expiry & Shelf Life', labelAr: 'إدارة الصلاحية والتنبيهات', icon: Calendar, count: nearExpiryBatches.length || undefined },
          { id: 'RESERVATIONS', labelEn: 'Stock Reservations', labelAr: 'حجز المخزون', icon: Archive, count: reservations.filter(r => r.status === 'ACTIVE').length || undefined },
          { id: 'WEIGHING', labelEn: 'Scales & Weighing', labelAr: 'الموازين وأوزان القبان', icon: Scale, count: scales.length },
          { id: 'PRODUCTION', labelEn: 'Production & BOM', labelAr: 'أوامر الإنتاج ومعادلات المواد', icon: Factory, count: prodOrders.length },
          { id: 'QUALITY', labelEn: 'Quality Control', labelAr: 'فحص ومراقبة الجودة', icon: ShieldCheck, count: qcInspections.length },
          { id: 'PROCESSING', labelEn: 'Processing / Shredding', labelAr: 'المعالجة وإعادة التدوير', icon: Recycle, count: processingOrders.length },
          { id: 'CONTAINERS', labelEn: 'Containers / Bulk Bags', labelAr: 'الشلايف والحاويات', icon: Box, count: containers.length },
          { id: 'STOCK_COUNTS', labelEn: 'Cycle Counting & Stocktake', labelAr: 'الجرد الدوري والتسوية', icon: ClipboardList, count: stockCounts.length },
          { id: 'HANDHELD', labelEn: 'Handheld Mobile Mode', labelAr: 'واجهة الماسح اليدوي', icon: Smartphone },
          { id: 'TESTS', labelEn: 'Scenario 38 Runner', labelAr: 'فاحص السيناريو المتكامل', icon: PlayCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdvancedTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950 font-black'
                  : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MODULE CONFIGURATION SWITCHBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'MODULES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              {isRTL ? 'إدارة الوحدات الاختيارية للمنشأة (Modular Architecture)' : 'Per-Organization Optional Module Architecture'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'يمكن لكل شركة أو منشأة تفعيل أو تعطيل أي وحدة صناعية أو متقدمة. الوحدات المعطلة لن تظهر في القوائم ولن تعيق العمليات المستودعية العادية.'
                : 'A commercial trading company can disable manufacturing, shredding, or batch tracking. Enabled modules seamlessly appear in menus.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[
              { key: 'inventory', label: 'Core Inventory & Ledger', desc: 'Immutable multi-location ledger balances', req: true },
              { key: 'purchasing', label: 'Purchasing & POs', desc: 'Vendor orders & partial receiving into ledger' },
              { key: 'suppliers', label: 'Suppliers Master', desc: 'Vendor directory & delivery tonnage' },
              { key: 'customers', label: 'Customers Master', desc: 'Client accounts & dispatch history' },
              { key: 'barcode', label: 'Barcode Scanner (1D)', desc: 'CODE128, EAN-13, EAN-8, UPC' },
              { key: 'qr', label: 'QR Code Engine (2D)', desc: 'Safe internal reference payload generation' },
              { key: 'batch', label: 'Batch / Lot Tracking', desc: 'Full batch traceability from vendor to customer' },
              { key: 'serial', label: 'Serial Number Tracking', desc: 'Per-unit tracking and lookup history' },
              { key: 'expiry', label: 'Expiry & Shelf Life', desc: 'Threshold alerts & quarantine policies' },
              { key: 'quality', label: 'Quality Control (QC)', desc: 'Inspection parameters, release & quarantine' },
              { key: 'weighing', label: 'Scales & Weighbridge', desc: 'Gross, tare, and net formula verification' },
              { key: 'production', label: 'Production & BOM', desc: 'Bill of materials & consumption against ledger' },
              { key: 'shredding', label: 'Processing / Shredding', desc: 'Generic scrap recycling and grinding' },
              { key: 'maintenance', label: 'Machinery Maintenance', desc: 'Operating hours, alarms, and calibrations' },
              { key: 'reservations', label: 'Stock Reservations', desc: 'Available-to-issue vs physical on-hand' },
              { key: 'cycleCount', label: 'Cycle Counting & Stocktake', desc: 'Blind counts and automated variance adjustments' },
              { key: 'containers', label: 'Packaging & Bulk Bags (شليف)', desc: 'Tare/net container weights and pallets' },
              { key: 'advancedReporting', label: 'Advanced Analytics Reports', desc: '13 specialized industry intelligence reports' },
            ].map((mod) => {
              const enabled = isModuleEnabled(mod.key as any);
              return (
                <div
                  key={mod.key}
                  className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                    enabled ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg' : 'bg-slate-950/40 border-slate-800/80 opacity-70'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{mod.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          enabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{mod.desc}</p>
                  </div>

                  <button
                    disabled={mod.req}
                    onClick={() => handleToggleModule(mod.key as any)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      enabled
                        ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950'
                    } ${mod.req ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {enabled ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    <span>{mod.req ? 'CORE REQUIRED' : enabled ? (isRTL ? 'تعطيل الوحدة' : 'Disable Module') : (isRTL ? 'تفعيل الوحدة' : 'Enable Module')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BATCH / LOT TRACKING */}
      {/* ========================================================================= */}
      {activeTab === 'BATCHES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={isRTL ? 'بحث برقم الشحنة، كود المادة...' : 'Search batch number, item code...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => setIsAddBatchOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? '+ تسجيل دفعة / تشغيلة جديدة' : '+ Register New Batch'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">{isRTL ? 'رقم الدفعة (Batch #)' : 'Batch Number'}</th>
                  <th className="p-3">{isRTL ? 'المادة' : 'Material'}</th>
                  <th className="p-3">{isRTL ? 'المستودع والموقع' : 'Warehouse / Location'}</th>
                  <th className="p-3">{isRTL ? 'الكمية المتبقية' : 'Remaining Qty'}</th>
                  <th className="p-3">{isRTL ? 'تاريخ الصلاحية' : 'Expiry Date'}</th>
                  <th className="p-3">{isRTL ? 'المورد' : 'Supplier'}</th>
                  <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-right">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {batches
                  .filter((b) => b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) || b.itemCode.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono font-bold text-indigo-400">{b.batchNumber}</td>
                      <td className="p-3">
                        <p className="font-bold text-white">{b.itemName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{b.itemCode}</p>
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-[11px]">{b.warehouseName} / {b.locationCode}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {b.remainingQuantity.toLocaleString()} <span className="text-slate-400 font-normal">{b.unit}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{b.expiryDate || '—'}</td>
                      <td className="p-3 text-slate-300">{b.supplierName || '—'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            b.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : b.status === 'QUARANTINED'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1 space-x-reverse">
                        {b.status === 'ACTIVE' ? (
                          <button
                            onClick={async () => {
                              await AdvancedWarehouseService.updateBatchStatus(orgId, b.id, 'QUARANTINED', currentUser?.name || 'Inspector');
                              showNotification(isRTL ? 'تم نقل الشحنة إلى الحجر الصحي' : 'Batch moved to quarantine');
                              loadData();
                            }}
                            className="px-2 py-1 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-bold cursor-pointer"
                          >
                            {isRTL ? 'حجر صحي' : 'Quarantine'}
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              await AdvancedWarehouseService.updateBatchStatus(orgId, b.id, 'ACTIVE', currentUser?.name || 'Inspector');
                              showNotification(isRTL ? 'تم الإفراج عن الشحنة بنجاح' : 'Batch released to active');
                              loadData();
                            }}
                            className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer"
                          >
                            {isRTL ? 'إفراج' : 'Release'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      {isRTL ? 'لا توجد دفعات مسجلة بعد' : 'No batches registered yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SERIAL NUMBER TRACKING & LOOKUP */}
      {/* ========================================================================= */}
      {activeTab === 'SERIALS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <span className="font-bold text-white text-xs block">{isRTL ? 'فاحص ومحقق الأرقام التسلسلية (Serial Lookup):' : 'Serial Number Lookup & History Trace:'}</span>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder={isRTL ? 'أدخل الرقم التسلسلي e.g. SN-100045' : 'Enter Serial Number e.g. SN-100045'}
                value={serialQuery}
                onChange={(e) => setSerialQuery(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => {
                  const s = AdvancedWarehouseService.getSerialNumber(orgId, serialQuery.trim());
                  if (s) {
                    setSearchedSerial(s);
                  } else {
                    showNotification(isRTL ? 'الرقم التسلسلي غير موجود' : 'Serial number not found', 'error');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
              >
                {isRTL ? 'بحث وتتبع' : 'Lookup'}
              </button>
            </div>

            {searchedSerial && (
              <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-indigo-400 text-sm">{searchedSerial.serialNumber}</span>
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                    STATUS: {searchedSerial.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">{isRTL ? 'المادة:' : 'Item:'}</span>
                    <span className="text-white font-bold">{searchedSerial.itemName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{isRTL ? 'المستودع والموقع:' : 'Current Location:'}</span>
                    <span className="text-indigo-300 font-mono">{searchedSerial.warehouseName} / {searchedSerial.locationCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{isRTL ? 'مستند الاستلام:' : 'Receiving Doc:'}</span>
                    <span className="text-slate-300 font-mono">{searchedSerial.receivingDocNumber || '—'}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block">{isRTL ? 'سجل الحركات التاريخي:' : 'Movement History:'}</span>
                  {searchedSerial.history.map((h, i) => (
                    <div key={i} className="text-[11px] text-slate-300 flex items-center justify-between bg-slate-900/60 p-2 rounded">
                      <span className="font-mono text-amber-400">{h.action}</span>
                      <span>{h.notes || 'Movement logged'}</span>
                      <span className="text-slate-500 font-mono">{h.timestamp.split('T')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EXPIRY MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'EXPIRY' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>{isRTL ? 'شحنات تقترب من انتهاء الصلاحية (خلال 60 يوماً)' : 'Near-Expiry Batches (Within 60 Days)'}</span>
              </div>
              <p className="text-2xl font-black text-amber-300 font-mono">{nearExpiryBatches.length}</p>
              <div className="space-y-1.5">
                {nearExpiryBatches.map((b) => (
                  <div key={b.id} className="p-2 rounded bg-slate-950/60 text-xs flex justify-between">
                    <span className="font-mono text-amber-300">{b.batchNumber} ({b.itemCode})</span>
                    <span className="font-mono text-slate-400">{b.expiryDate}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <XCircle className="w-4 h-4" />
                <span>{isRTL ? 'شحنات منتهية الصلاحية (تتطلب حظر/حجر)' : 'Expired Batches (Block / Quarantine)'}</span>
              </div>
              <p className="text-2xl font-black text-rose-300 font-mono">{expiredBatches.length}</p>
              <div className="space-y-1.5">
                {expiredBatches.map((b) => (
                  <div key={b.id} className="p-2 rounded bg-slate-950/60 text-xs flex justify-between">
                    <span className="font-mono text-rose-300">{b.batchNumber}</span>
                    <span className="font-mono text-slate-400">{b.remainingQuantity} {b.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: STOCK RESERVATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'RESERVATIONS' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Archive className="w-4 h-4 text-indigo-400" />
              {isRTL ? 'إدارة حجز المخزون (Available vs Reserved Stock)' : 'Stock Reservations & Available-to-Issue'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'الحجز يحمي المواد لطلبات العملاء أو خطوط الإنتاج دون خصمها فيزيائياً من المستودع حتى تأكيد الصرف الفعلي.'
                : 'Reservations lock stock for pending orders without mutating physical ledger balances prematurely.'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">{isRTL ? 'المستند المرجعي' : 'Reference Doc'}</th>
                  <th className="p-3">{isRTL ? 'المادة المحجوزة' : 'Item'}</th>
                  <th className="p-3">{isRTL ? 'الكمية المحجوزة' : 'Reserved Qty'}</th>
                  <th className="p-3">{isRTL ? 'المستودع' : 'Warehouse'}</th>
                  <th className="p-3">{isRTL ? 'الحاجز' : 'Reserved By'}</th>
                  <th className="p-3">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-right">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-mono text-indigo-400 font-bold">{r.referenceDocument}</td>
                    <td className="p-3 text-white font-medium">{r.itemName} ({r.itemCode})</td>
                    <td className="p-3 font-mono font-bold text-amber-400">{r.quantity} {r.unit}</td>
                    <td className="p-3 text-slate-300">{r.warehouseName}</td>
                    <td className="p-3 text-slate-400">{r.reservedBy}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {r.status === 'ACTIVE' && (
                        <button
                          onClick={async () => {
                            await AdvancedWarehouseService.releaseReservation(orgId, r.id, currentUser?.name || 'Operator');
                            showNotification(isRTL ? 'تم إلغاء تحرير الحجز' : 'Reservation released');
                            loadData();
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          {isRTL ? 'تحرير الحجز' : 'Release'}
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
      {/* TAB 6: WEIGHING & SCALES MASTER */}
      {/* ========================================================================= */}
      {activeTab === 'WEIGHING' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live Weighing Simulator */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span className="font-bold text-white text-xs block">{isRTL ? 'محاكي تسجيل وزن القبان (Gross - Tare = Net):' : 'Weighing Record Entry (Gross - Tare = Net):'}</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">{isRTL ? 'الوزن الإجمالي (Gross KG):' : 'Gross Weight (KG):'}</label>
                  <input
                    type="number"
                    value={weightForm.gross}
                    onChange={(e) => setWeightForm({ ...weightForm, gross: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">{isRTL ? 'الوزن الفارغ (Tare KG):' : 'Tare Weight (KG):'}</label>
                  <input
                    type="number"
                    value={weightForm.tare}
                    onChange={(e) => setWeightForm({ ...weightForm, tare: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center font-mono">
                <span className="text-slate-400 text-xs">{isRTL ? 'الوزن الصافي المحسوب:' : 'Calculated Net Weight:'}</span>
                <span className="text-lg font-black text-emerald-400">
                  {Math.max(0, weightForm.gross - weightForm.tare).toLocaleString()} KG
                </span>
              </div>

              <button
                onClick={async () => {
                  await AdvancedWarehouseService.recordWeight(orgId, {
                    scaleCode: weightForm.scaleCode,
                    grossWeight: weightForm.gross,
                    tareWeight: weightForm.tare,
                    operator: currentUser?.name || 'Scale Operator',
                    referenceDocument: 'TRUCK-IQ-4902',
                    notes: weightForm.notes,
                  });
                  showNotification(isRTL ? 'تم تسجيل الوزن بنجاح' : 'Weight recorded successfully');
                  loadData();
                }}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-indigo-950"
              >
                {isRTL ? 'حفظ وإصدار تذكرة الوزن' : 'Record & Issue Weight Ticket'}
              </button>
            </div>

            {/* Scale Master List */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <span className="font-bold text-white text-xs block">{isRTL ? 'سجل الموازين المعتمدة (Scales Master):' : 'Registered Scales Master:'}</span>
              <div className="space-y-2">
                {scales.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">{s.name} <span className="font-mono text-indigo-400 text-[11px]">({s.scaleCode})</span></p>
                      <p className="text-slate-400 text-[11px]">{s.location} • {s.connectionType}</p>
                    </div>
                    <span className="font-mono text-emerald-400 font-bold">{s.maxCapacityKG.toLocaleString()} KG max</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: PRODUCTION & BILL OF MATERIALS (BOM) */}
      {/* ========================================================================= */}
      {activeTab === 'PRODUCTION' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Factory className="w-4 h-4 text-indigo-400" />
              {isRTL ? 'أوامر الإنتاج ومعادلات التصنيع (Production & BOM Ledger Engine)' : 'Production Execution & Bill of Materials'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'تنفيذ أوامر الإنتاج يخصم المواد الأولية المستهلكة من رصيد المستودع، ويزيد رصيد المنتج التام، ويسجل الفاقد والهدر بدفتر الأستاذ.'
                : 'Execution consumes raw materials atomically from inventory ledger and increases finished product stock.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {prodOrders.map((po) => (
              <div key={po.id} className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-400 text-sm">{po.orderNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-500/40">
                      {po.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-mono">
                    {po.producedQuantity} / {po.plannedQuantity} {po.unit}
                  </span>
                </div>
                <p className="text-xs text-white font-medium">{po.productName} ({po.productCode})</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 12: HANDHELD / MOBILE QUICK ACTION WORKFLOW */}
      {/* ========================================================================= */}
      {activeTab === 'HANDHELD' && (
        <div className="max-w-md mx-auto p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 text-center">
          <Smartphone className="w-10 h-10 text-indigo-400 mx-auto" />
          <h3 className="text-base font-bold text-white">{isRTL ? 'الماسح اليدوي السريع لعمال المستودع' : 'Warehouse Mobile Handheld HUD'}</h3>
          <p className="text-xs text-slate-400">{isRTL ? 'واجهة لمسية مبسطة وسريعة: امسح -> اختر الإجراء -> أكد' : 'Touch-optimized streamlined workflow: Scan -> Select Action -> Confirm'}</p>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            {[
              { labelEn: 'Receive Inbound', labelAr: 'استلام توريد', color: 'bg-emerald-600' },
              { labelEn: 'Put Away', labelAr: 'تسكين بموقع', color: 'bg-indigo-600' },
              { labelEn: 'Pick for Order', labelAr: 'التقاط للطلب', color: 'bg-amber-600' },
              { labelEn: 'Issue Dispatch', labelAr: 'صرف وتسليم', color: 'bg-purple-600' },
              { labelEn: 'Location Move', labelAr: 'نقل بين المواقع', color: 'bg-cyan-600' },
              { labelEn: 'Cycle Count', labelAr: 'جرد سريع بالباركود', color: 'bg-rose-600' },
            ].map((btn, idx) => (
              <button
                key={idx}
                onClick={() => showNotification(isRTL ? `تم تفعيل إجراء: ${btn.labelAr}` : `Action triggered: ${btn.labelEn}`)}
                className={`p-4 rounded-xl text-white font-bold text-xs shadow-lg cursor-pointer ${btn.color} hover:opacity-90 active:scale-95 transition`}
              >
                {isRTL ? btn.labelAr : btn.labelEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 13: AUTOMATED SCENARIO 38 TEST RUNNER */}
      {/* ========================================================================= */}
      {activeTab === 'TESTS' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border border-purple-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {isRTL ? 'فاحص سيناريو 38 الشامل (Phase 6 Master Verification)' : 'Phase 6 Scenario 38 Master Verification'}
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {isRTL
                  ? 'يختبر: استقبال دفعة BATCH-001 بموقع هرمي، تنفيذ أمر إنتاج، خصم المواد الخام وإضافة المنتج التام والهدر، مطابقة الجرد، وتأكيد صيغة الموازين.'
                  : 'Automated end-to-end verification of batch receipt, production ledger execution, waste logging, cycle count variance adjustments, and multi-tenant security.'}
              </p>
            </div>

            <button
              onClick={handleRunScenarioTests}
              disabled={isRunningTests}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-950 transition cursor-pointer flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{isRunningTests ? (isRTL ? 'جاري الفحص...' : 'Executing Scenario 38...') : (isRTL ? 'تشغيل فحص السيناريو الآن' : 'Execute Scenario 38 Tests')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {testResults.map((res, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  res.status === 'PASSED' ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {res.status === 'PASSED' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
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
                    res.status === 'PASSED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                  }`}
                >
                  {res.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD BATCH */}
      {/* ========================================================================= */}
      {isAddBatchOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                {isRTL ? 'تسجيل دفعة / شحنة جديدة' : 'Register New Batch'}
              </h3>
              <button onClick={() => setIsAddBatchOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const targetItem = items.find((i) => i.id === batchForm.itemId) || items[0];
                  const targetWh = warehouses.find((w) => w.id === batchForm.warehouseId) || warehouses[0];
                  const targetLoc = locations.find((l) => l.id === batchForm.locationId) || locations[0];

                  if (!targetItem || !targetWh || !targetLoc) {
                    showNotification(isRTL ? 'يرجى اختيار المادة والمستودع والموقع' : 'Select item, warehouse, and location', 'error');
                    return;
                  }

                  const batchNum = batchForm.batchNumber || `BAT-${Date.now().toString().slice(-6)}`;
                  await AdvancedWarehouseService.createBatch(
                    orgId,
                    {
                      batchNumber: batchNum,
                      itemId: targetItem.id,
                      itemCode: targetItem.itemCode,
                      itemName: (targetItem as any).nameAr || targetItem.name,
                      warehouseId: targetWh.id,
                      warehouseName: (targetWh as any).nameAr || targetWh.name,
                      locationId: targetLoc.id,
                      locationCode: targetLoc.code,
                      quantity: Number(batchForm.quantity) || 1000,
                      remainingQuantity: Number(batchForm.quantity) || 1000,
                      unit: (targetItem as any).unitOfMeasure || 'KG',
                      receivedDate: new Date().toISOString().split('T')[0],
                      expiryDate: batchForm.expiryDate,
                      supplierName: batchForm.supplierName || 'Primary Petro Vendor',
                      status: 'ACTIVE',
                    },
                    currentUser?.name || 'Storekeeper'
                  );

                  showNotification(isRTL ? 'تم تسجيل الدفعة بنجاح' : 'Batch registered successfully');
                  setIsAddBatchOpen(false);
                  loadData();
                } catch (err: any) {
                  showNotification(err.message, 'error');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 mb-1">{isRTL ? 'رقم الدفعة / التشغيلة (Batch Number):' : 'Batch Number:'}</label>
                <input
                  type="text"
                  placeholder="BATCH-2026-001"
                  value={batchForm.batchNumber}
                  onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المادة / الخامة:' : 'Item / Material:'}</label>
                  <select
                    value={batchForm.itemId}
                    onChange={(e) => setBatchForm({ ...batchForm, itemId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="">{isRTL ? '-- اختر المادة --' : '-- Select Material --'}</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>{i.itemCode} - {(i as any).nameAr || i.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'المستودع والموقع:' : 'Warehouse & Location:'}</label>
                  <select
                    value={batchForm.locationId}
                    onChange={(e) => setBatchForm({ ...batchForm, locationId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white"
                  >
                    <option value="">{isRTL ? '-- اختر موقع التخزين --' : '-- Select Location --'}</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'الكمية الإجمالية:' : 'Batch Quantity:'}</label>
                  <input
                    type="number"
                    min={1}
                    value={batchForm.quantity}
                    onChange={(e) => setBatchForm({ ...batchForm, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isRTL ? 'تاريخ انتهاء الصلاحية:' : 'Expiry Date:'}</label>
                  <input
                    type="date"
                    value={batchForm.expiryDate}
                    onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddBatchOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  {isRTL ? 'تسجيل الدفعة' : 'Register Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
