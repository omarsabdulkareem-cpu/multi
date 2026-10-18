import React, { useState, useMemo } from 'react';
import {
  Warehouse as WarehouseIcon,
  Boxes,
  MapPin,
  Layers,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  SlidersHorizontal,
  Package,
  Barcode,
  History,
  ClipboardList,
  Building2,
  Save,
  RotateCcw,
  Edit,
  Tag,
  ShieldCheck,
  Globe,
  DollarSign,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import {
  WarehouseEngineService,
} from '../services/warehouseEngineService';
import {
  WarehouseFacility,
  StorageLocation,
  ItemMaster,
  StorageLocationType,
  InventoryTransaction,
  InventoryBalanceRecord,
  DEFAULT_UNITS_OF_MEASURE,
  DEFAULT_ITEM_CATEGORIES,
} from '../types/warehouse';

import { WarehouseOperationsModule } from './WarehouseOperationsModule';

type EngineTab = 'OVERVIEW' | 'OPERATIONS' | 'WAREHOUSES' | 'LOCATIONS' | 'ITEMS' | 'BALANCES' | 'LEDGER' | 'ORG_SETTINGS';

export const UniversalWarehouseEngineModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { currentOrganization, updateOrganization } = useTenant();
  const { currentUser } = useFactory();

  const orgId = currentOrganization.id;

  // Active Tab
  const [activeTab, setActiveTab] = useState<EngineTab>('OVERVIEW');

  // Local state synced with WarehouseEngineService
  const [warehouses, setWarehouses] = useState<WarehouseFacility[]>(() =>
    WarehouseEngineService.getWarehouses(orgId)
  );
  const [locations, setLocations] = useState<StorageLocation[]>(() =>
    WarehouseEngineService.getLocations(orgId)
  );
  const [items, setItems] = useState<ItemMaster[]>(() =>
    WarehouseEngineService.getItems(orgId)
  );
  const [ledger, setLedger] = useState<InventoryTransaction[]>(() =>
    WarehouseEngineService.getLedger(orgId)
  );
  const [balances, setBalances] = useState<InventoryBalanceRecord[]>(() =>
    WarehouseEngineService.computeInventoryBalances(orgId)
  );

  // Refresh helper
  const refreshAll = () => {
    setWarehouses(WarehouseEngineService.getWarehouses(orgId));
    setLocations(WarehouseEngineService.getLocations(orgId));
    setItems(WarehouseEngineService.getItems(orgId));
    setLedger(WarehouseEngineService.getLedger(orgId));
    setBalances(WarehouseEngineService.computeInventoryBalances(orgId));
  };

  // Re-sync when currentOrganization changes
  React.useEffect(() => {
    refreshAll();
  }, [orgId]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Modals
  const [showAddWarehouseModal, setShowAddWarehouseModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  // Notifications
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // ---------------------------------------------------------------------------
  // Forms State
  // ---------------------------------------------------------------------------
  const [warehouseForm, setWarehouseForm] = useState({
    nameAr: '',
    nameEn: '',
    code: '',
    type: 'Raw' as const,
    totalCapacityKG: 100000,
    manager: '',
    storekeeper: '',
    address: '',
    description: '',
  });

  const [locationForm, setLocationForm] = useState({
    warehouseId: warehouses[0]?.id || '',
    code: '',
    nameAr: '',
    nameEn: '',
    type: 'RACK' as StorageLocationType,
    zone: '',
    capacityKG: 25000,
    referenceCode: '',
  });

  const [itemForm, setItemForm] = useState({
    itemCode: '',
    barcode: '',
    nameAr: '',
    nameEn: '',
    category: 'Raw Materials',
    unitOfMeasure: 'KG',
    weightUnit: 'KG',
    defaultWeight: 1,
    minimumStock: 1000,
    maximumStock: 50000,
    reorderPoint: 5000,
    trackBatch: true,
    trackSerial: false,
    trackExpiry: false,
    defaultWarehouseId: warehouses[0]?.id || '',
  });

  const [receiptForm, setReceiptForm] = useState({
    supplierName: '',
    documentNumber: '',
    warehouseId: warehouses[0]?.id || '',
    itemId: items[0]?.id || '',
    locationId: locations[0]?.id || '',
    quantity: 1000,
    unit: 'KG',
    weightKG: 1000,
    batchId: '',
    notes: '',
  });

  const [issueForm, setIssueForm] = useState({
    warehouseId: warehouses[0]?.id || '',
    locationId: locations[0]?.id || '',
    itemId: items[0]?.id || '',
    quantity: 100,
    destination: 'Production Line 1',
    reason: 'Operational Issue',
    notes: '',
  });

  const [transferForm, setTransferForm] = useState({
    sourceWarehouseId: warehouses[0]?.id || '',
    sourceLocationId: locations[0]?.id || '',
    destinationWarehouseId: warehouses[0]?.id || '',
    destinationLocationId: locations[1]?.id || '',
    itemId: items[0]?.id || '',
    quantity: 500,
    reason: 'Inter-rack Transfer',
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    warehouseId: warehouses[0]?.id || '',
    locationId: locations[0]?.id || '',
    itemId: items[0]?.id || '',
    adjustmentType: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    quantityDelta: 50,
    reason: 'Physical Count' as const,
    notes: '',
  });

  // Org Settings State
  const [orgForm, setOrgForm] = useState({
    nameAr: currentOrganization.nameAr || '',
    nameEn: currentOrganization.nameEn || '',
    legalName: currentOrganization.legalName || '',
    currency: currentOrganization.currency || 'USD',
    timezone: currentOrganization.timezone || 'UTC',
    country: currentOrganization.country || '',
    city: currentOrganization.city || '',
    address: currentOrganization.address || '',
    phone: currentOrganization.phone || currentOrganization.contactPhone || '',
    email: currentOrganization.email || currentOrganization.contactEmail || '',
    weightUnit: currentOrganization.weightUnit || 'KG',
    dateFormat: currentOrganization.dateFormat || 'YYYY-MM-DD',
  });

  // Sync orgForm when currentOrganization changes
  React.useEffect(() => {
    setOrgForm({
      nameAr: currentOrganization.nameAr || '',
      nameEn: currentOrganization.nameEn || '',
      legalName: currentOrganization.legalName || '',
      currency: currentOrganization.currency || 'USD',
      timezone: currentOrganization.timezone || 'UTC',
      country: currentOrganization.country || '',
      city: currentOrganization.city || '',
      address: currentOrganization.address || '',
      phone: currentOrganization.phone || currentOrganization.contactPhone || '',
      email: currentOrganization.email || currentOrganization.contactEmail || '',
      weightUnit: currentOrganization.weightUnit || 'KG',
      dateFormat: currentOrganization.dateFormat || 'YYYY-MM-DD',
    });
  }, [currentOrganization]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleSaveOrgSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization(orgId, {
      nameAr: orgForm.nameAr,
      nameEn: orgForm.nameEn,
      name: isRTL ? orgForm.nameAr : orgForm.nameEn,
      legalName: orgForm.legalName,
      currency: orgForm.currency,
      timezone: orgForm.timezone,
      country: orgForm.country,
      city: orgForm.city,
      address: orgForm.address,
      phone: orgForm.phone,
      contactPhone: orgForm.phone,
      email: orgForm.email,
      contactEmail: orgForm.email,
      weightUnit: orgForm.weightUnit as any,
      dateFormat: orgForm.dateFormat,
    });
    showNotification('success', isRTL ? 'تم حفظ إعدادات وبيانات المنشأة بنجاح' : 'Organization settings saved successfully');
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.createWarehouse(orgId, {
        name: isRTL ? warehouseForm.nameAr : warehouseForm.nameEn,
        nameAr: warehouseForm.nameAr,
        nameEn: warehouseForm.nameEn,
        code: warehouseForm.code.toUpperCase(),
        type: warehouseForm.type,
        status: 'ACTIVE',
        totalCapacityKG: Number(warehouseForm.totalCapacityKG),
        manager: warehouseForm.manager,
        storekeeper: warehouseForm.storekeeper,
        address: warehouseForm.address,
        description: warehouseForm.description,
      });
      setShowAddWarehouseModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تم إنشاء المستودع الجديد بنجاح' : 'New warehouse created successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error creating warehouse');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.createLocation(orgId, {
        warehouseId: locationForm.warehouseId,
        code: locationForm.code.toUpperCase(),
        name: isRTL ? locationForm.nameAr : locationForm.nameEn,
        nameAr: locationForm.nameAr,
        nameEn: locationForm.nameEn,
        type: locationForm.type,
        zone: locationForm.zone,
        status: 'ACTIVE',
        capacityKG: Number(locationForm.capacityKG),
        referenceCode: locationForm.referenceCode || '167',
      });
      setShowAddLocationModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تم إضافة موقع التخزين الجديد بنجاح' : 'New storage location added successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error creating location');
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.createItem(orgId, {
        itemCode: itemForm.itemCode.toUpperCase(),
        barcode: itemForm.barcode,
        name: isRTL ? itemForm.nameAr : itemForm.nameEn,
        nameAr: itemForm.nameAr,
        nameEn: itemForm.nameEn,
        category: itemForm.category,
        unitOfMeasure: itemForm.unitOfMeasure,
        weightUnit: itemForm.weightUnit,
        defaultWeight: Number(itemForm.defaultWeight),
        status: 'ACTIVE',
        trackBatch: itemForm.trackBatch,
        trackSerial: itemForm.trackSerial,
        trackExpiry: itemForm.trackExpiry,
        minimumStock: Number(itemForm.minimumStock),
        maximumStock: Number(itemForm.maximumStock),
        reorderPoint: Number(itemForm.reorderPoint),
        defaultWarehouseId: itemForm.defaultWarehouseId,
      });
      setShowAddItemModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تم تسجيل الصنف الجديد بنجاح' : 'New item added successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error creating item');
    }
  };

  const handleExecuteReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.executeReceipt(
        orgId,
        {
          supplierName: receiptForm.supplierName,
          documentNumber: receiptForm.documentNumber,
          date: new Date().toISOString().split('T')[0],
          warehouseId: receiptForm.warehouseId,
          notes: receiptForm.notes,
          items: [
            {
              itemId: receiptForm.itemId,
              locationId: receiptForm.locationId,
              quantity: Number(receiptForm.quantity),
              unit: receiptForm.unit,
              weightKG: Number(receiptForm.weightKG),
              batchId: receiptForm.batchId || undefined,
            },
          ],
        },
        currentUser?.name || 'Administrator'
      );
      setShowReceiptModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تم تسجيل سند استلام البضائع بنجاح في سجل الحركات' : 'Goods receipt recorded in ledger successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing receipt');
    }
  };

  const handleExecuteIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.executeIssue(
        orgId,
        {
          warehouseId: issueForm.warehouseId,
          locationId: issueForm.locationId,
          itemId: issueForm.itemId,
          quantity: Number(issueForm.quantity),
          destination: issueForm.destination,
          reason: issueForm.reason,
          notes: issueForm.notes,
        },
        currentUser?.name || 'Administrator'
      );
      setShowIssueModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تم تسجيل سند صرف البضائع واقتطاع المخزون بنجاح' : 'Goods issue recorded and stock decremented successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing issue');
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.executeTransfer(
        orgId,
        {
          sourceWarehouseId: transferForm.sourceWarehouseId,
          sourceLocationId: transferForm.sourceLocationId,
          destinationWarehouseId: transferForm.destinationWarehouseId,
          destinationLocationId: transferForm.destinationLocationId,
          itemId: transferForm.itemId,
          quantity: Number(transferForm.quantity),
          reason: transferForm.reason,
        },
        currentUser?.name || 'Administrator'
      );
      setShowTransferModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تمت مناقلة المخزون بين المواقع بنجاح' : 'Stock transferred successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing transfer');
    }
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await WarehouseEngineService.executeAdjustment(
        orgId,
        {
          warehouseId: adjustmentForm.warehouseId,
          locationId: adjustmentForm.locationId,
          itemId: adjustmentForm.itemId,
          adjustmentType: adjustmentForm.adjustmentType,
          quantityDelta: Number(adjustmentForm.quantityDelta),
          reason: adjustmentForm.reason,
          notes: adjustmentForm.notes,
        },
        currentUser?.name || 'Administrator'
      );
      setShowAdjustmentModal(false);
      refreshAll();
      showNotification('success', isRTL ? 'تم تسجيل تسوية الجرد وموازنة الرصيد بنجاح' : 'Inventory adjustment recorded successfully');
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing adjustment');
    }
  };

  // Filtered Balances
  const filteredBalances = useMemo(() => {
    return balances.filter((b) => {
      const matchSearch =
        b.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.warehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.locationCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchWh = selectedWarehouseFilter === 'ALL' || b.warehouseId === selectedWarehouseFilter;
      const matchCat = selectedCategoryFilter === 'ALL' || b.category === selectedCategoryFilter;
      return matchSearch && matchWh && matchCat;
    });
  }, [balances, searchQuery, selectedWarehouseFilter, selectedCategoryFilter]);

  // Overall Metrics
  const totalStockKG = balances.reduce((sum, b) => sum + (b.weightKG || 0), 0);
  const totalItemsCount = items.length;
  const totalWarehousesCount = warehouses.length;
  const totalLocationsCount = locations.length;
  const totalTransactionsCount = ledger.length;

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-12">
      {/* Top Banner & Multi-Tenant Organization Indicator */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-cyan-950/40 border border-cyan-500/30 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              TENANT: {currentOrganization.slug?.toUpperCase() || currentOrganization.id}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-950 text-blue-300 border border-blue-500/30">
              PLAN: {currentOrganization.plan}
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'محرك إدارة المستودعات متعدد المنشآت (Universal WMS)' : 'Universal Multi-Tenant Warehouse Engine'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-cyan-400" />
            <span>{isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
            {isRTL
              ? 'نظام عزل بيانات كامل: المستودعات، مواقع التخزين، دليل الأصناف الشامل، وسجل الحركات المحاسبي غير القابل للتعديل.'
              : 'Enterprise tenant isolation: multi-warehouse network, location builder, universal items catalog, and immutable inventory ledger.'}
          </p>
        </div>

        {/* Quick Operations Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setShowReceiptModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all border border-emerald-400/40 cursor-pointer"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>{isRTL ? 'استلام بضائع (توريد)' : 'Goods Receipt'}</span>
          </button>

          <button
            onClick={() => setShowIssueModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 transition-all border border-rose-400/40 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>{isRTL ? 'صرف بضائع (صرف)' : 'Goods Issue'}</span>
          </button>

          <button
            onClick={() => setShowTransferModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all border border-cyan-400/40 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{isRTL ? 'مناقلة بين المواقع' : 'Transfer Stock'}</span>
          </button>

          <button
            onClick={() => setShowAdjustmentModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all border border-amber-400/40 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{isRTL ? 'تسوية جرد' : 'Stock Adjustment'}</span>
          </button>
        </div>
      </div>

      {/* Notifications Alert */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 underline cursor-pointer"
          >
            {isRTL ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isRTL ? 'إجمالي المستودعات' : 'Warehouses'}</span>
            <WarehouseIcon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalWarehousesCount}</div>
          <p className="text-[10px] text-slate-500">{isRTL ? 'منشآت تخزين نشطة' : 'Active facilities'}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isRTL ? 'مواقع التخزين' : 'Locations'}</span>
            <MapPin className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalLocationsCount}</div>
          <p className="text-[10px] text-slate-500">{isRTL ? 'قواطع ورفوف ومستويات' : 'Racks, bins, shelves'}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isRTL ? 'دليل الأصناف' : 'Item Master'}</span>
            <Package className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalItemsCount}</div>
          <p className="text-[10px] text-slate-500">{isRTL ? 'أصناف معرّفة بالكتالوج' : 'Registered SKU codes'}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isRTL ? 'الوزن المخزن الكلي' : 'Total Stock (KG)'}</span>
            <Boxes className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {totalStockKG.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">{isRTL ? 'محسوب لحظياً من السجل' : 'Real-time ledger balance'}</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>{isRTL ? 'سجل الحركات' : 'Ledger Entries'}</span>
            <History className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300 font-mono">{totalTransactionsCount}</div>
          <p className="text-[10px] text-slate-500">{isRTL ? 'حركات غير قابلة للتعديل' : 'Immutable audit transactions'}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2 text-xs font-bold">
        {[
          { id: 'OVERVIEW', labelAr: 'نظرة عامة ومؤشرات', labelEn: 'Overview & KPIs', icon: Boxes },
          { id: 'OPERATIONS', labelAr: 'العمليات والمستندات', labelEn: 'Operations & Docs', icon: ClipboardList },
          { id: 'BALANCES', labelAr: 'أرصدة المخزون اللحظية', labelEn: 'Live Balances', icon: Layers },
          { id: 'WAREHOUSES', labelAr: 'إدارة المستودعات', labelEn: 'Warehouses', icon: WarehouseIcon },
          { id: 'LOCATIONS', labelAr: 'مواقع التخزين والرفوف', labelEn: 'Storage Locations', icon: MapPin },
          { id: 'ITEMS', labelAr: 'دليل الأصناف الشامل', labelEn: 'Item Master', icon: Package },
          { id: 'LEDGER', labelAr: 'دفتر الحركات المحاسبي', labelEn: 'Inventory Ledger', icon: History },
          { id: 'ORG_SETTINGS', labelAr: 'إعدادات المنشأة', labelEn: 'Organization Settings', icon: Building2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as EngineTab)}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Warehouses Capacity Cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'إشغال شبكة المستودعات' : 'Warehouse Network Utilization'}</span>
              </h3>
              <button
                onClick={() => setShowAddWarehouseModal(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إضافة مستودع' : 'Add Warehouse'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warehouses.map((wh) => {
                const whBal = balances.filter((b) => b.warehouseId === wh.id);
                const currentWeightKG = whBal.reduce((s, b) => s + (b.weightKG || 0), 0);
                const capacity = wh.totalCapacityKG || 100000;
                const pct = Math.min(100, Math.round((currentWeightKG / capacity) * 100));

                return (
                  <div
                    key={wh.id}
                    className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {wh.code}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          wh.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {wh.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-white text-base">{isRTL ? wh.nameAr : wh.nameEn}</h4>
                      <p className="text-xs text-slate-400">{wh.address || wh.description || (isRTL ? 'مرفق تخزين رئيسي' : 'Primary Storage Facility')}</p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs text-slate-300 font-mono">
                        <span>{isRTL ? 'نسبة الإشغال:' : 'Utilization:'}</span>
                        <span className="font-bold text-white">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-cyan-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                        <span>{currentWeightKG.toLocaleString()} KG</span>
                        <span>{capacity.toLocaleString()} KG</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                      <span>{isRTL ? 'أمين المخزن:' : 'Storekeeper:'}</span>
                      <span className="text-amber-300 font-medium">{wh.storekeeper || (isRTL ? 'غير محدد' : 'Unassigned')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Ledger Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>{isRTL ? 'أحدث حركات الدفتر' : 'Recent Ledger Activity'}</span>
              </h3>
              <button
                onClick={() => setActiveTab('LEDGER')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                {isRTL ? 'عرض الكل' : 'View All'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
              {ledger.slice(0, 7).map((tx) => (
                <div key={tx.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-cyan-300">{tx.transactionId}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.transactionType === 'RECEIPT'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : tx.transactionType === 'ISSUE'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                      }`}
                    >
                      {tx.transactionType}
                    </span>
                  </div>
                  <div className="text-xs text-white font-medium">{tx.itemName}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>
                      {tx.quantity} {tx.unit} ({tx.weightKG} KG)
                    </span>
                    <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: OPERATIONS & DOCUMENTS */}
      {activeTab === 'OPERATIONS' && (
        <div className="space-y-4">
          <WarehouseOperationsModule />
        </div>
      )}

      {/* TAB 2: LIVE BALANCES */}
      {activeTab === 'BALANCES' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'أرصدة المخزون اللحظية المشتقة من الدفتر' : 'Live Inventory Stock Balances'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'رصيد دقيق محسوب رياضياً لكل (منشأة + صنف + مستودع + موقع + وجبة) دون تعارض.'
                  : 'Real-time ledger derivation per organization + item + warehouse + location + batch.'}
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute top-2.5 start-3 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRTL ? 'بحث بالاسم، الكود، الرف...' : 'Search item, code, rack...'}
                  className="ps-9 pe-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={selectedWarehouseFilter}
                onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">{isRTL ? 'جميع المستودعات' : 'All Warehouses'}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {isRTL ? w.nameAr : w.nameEn}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">{isRTL ? 'جميع التصنيفات' : 'All Categories'}</option>
                {DEFAULT_ITEM_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.nameEn}>
                    {isRTL ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'كود الصنف' : 'Item Code'}</th>
                  <th className="p-3 text-start">{isRTL ? 'اسم الصنف' : 'Item Name'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستودع' : 'Warehouse'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الموقع / الرف' : 'Location'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الكمية الحالية' : 'Quantity'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الوزن (KG)' : 'Weight (KG)'}</th>
                  <th className="p-3 text-end">{isRTL ? 'المتاح للصرف' : 'Available'}</th>
                  <th className="p-3 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      {isRTL ? 'لا توجد أرصدة مطابقة للبحث' : 'No inventory balance records found'}
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((bal) => (
                    <tr key={bal.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-bold text-cyan-400">{bal.itemCode}</td>
                      <td className="p-3 text-white font-semibold">{bal.itemName}</td>
                      <td className="p-3 text-slate-300">{bal.warehouseName}</td>
                      <td className="p-3 font-mono text-amber-300">{bal.locationCode}</td>
                      <td className="p-3 text-end font-mono font-bold text-white">
                        {bal.quantity.toLocaleString()} {bal.unit}
                      </td>
                      <td className="p-3 text-end font-mono text-slate-300">
                        {bal.weightKG.toLocaleString()} KG
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-emerald-400">
                        {bal.availableQuantity.toLocaleString()} {bal.unit}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            bal.status === 'IN_STOCK'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : bal.status === 'LOW_STOCK'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {bal.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: WAREHOUSES MANAGEMENT */}
      {activeTab === 'WAREHOUSES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'إدارة منشآت ومستودعات المنشأة' : 'Warehouse Facilities Management'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تعريف مستودعات الخامات، البضائع الجاهزة، قطع الغيار، ومخازن التوزيع.' : 'Configure raw material stores, finished goods warehouses, and spare parts.'}
              </p>
            </div>
            <button
              onClick={() => setShowAddWarehouseModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'إنشاء مستودع جديد' : 'New Warehouse'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-cyan-400 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                    {wh.code}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{wh.type || 'General'}</span>
                </div>

                <div>
                  <h4 className="font-bold text-white text-base">{isRTL ? wh.nameAr : wh.nameEn}</h4>
                  <p className="text-xs text-slate-400">{wh.address || (isRTL ? 'لا يوجد عنوان مسجل' : 'No physical address specified')}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'السعة القصوى:' : 'Max Capacity:'}</span>
                    <span className="font-mono font-bold text-white">{(wh.totalCapacityKG || 0).toLocaleString()} KG</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'أمين المخزن:' : 'Storekeeper:'}</span>
                    <span className="font-medium text-amber-300">{wh.storekeeper || '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'مدير المرفق:' : 'Manager:'}</span>
                    <span className="font-medium text-slate-200">{wh.manager || '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LOCATIONS MANAGEMENT */}
      {activeTab === 'LOCATIONS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'هيكلية ومواقع التخزين (Zones, Aisles, Racks, Bins)' : 'Storage Locations & Hierarchy'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'بناء شبكة المواقع والرفوف الداخلية لكل مستودع.' : 'Configure rack, bin, shelf, and zone hierarchy for precise placement.'}
              </p>
            </div>
            <button
              onClick={() => setShowAddLocationModal(true)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'إضافة موقع تخزين' : 'New Storage Location'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {locations.map((loc) => {
              const parentWh = warehouses.find((w) => w.id === loc.warehouseId);
              return (
                <div
                  key={loc.id}
                  className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                      {loc.code}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300">
                      {loc.type}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-bold text-white text-xs">{isRTL ? loc.nameAr || loc.name : loc.nameEn || loc.name}</h5>
                    <p className="text-[11px] text-slate-400">{parentWh ? (isRTL ? parentWh.nameAr : parentWh.nameEn) : loc.warehouseId}</p>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>{isRTL ? 'السعة:' : 'Capacity:'}</span>
                    <span className="font-bold text-slate-200">{(loc.capacityKG || 0).toLocaleString()} KG</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: UNIVERSAL ITEM MASTER */}
      {activeTab === 'ITEMS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'دليل الأصناف الشامل (Universal Item Master)' : 'Universal Item Master'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'المواد الخام، المنتجات الجاهزة، قطع الغيار، ومواد التعبئة والتغليف مع وحدات القياس.' : 'Raw materials, finished goods, packaging, consumables, and spare parts catalog.'}
              </p>
            </div>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'تسجيل صنف جديد' : 'New Item Master'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'كود الصنف' : 'Item Code'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الباركود' : 'Barcode'}</th>
                  <th className="p-3 text-start">{isRTL ? 'اسم الصنف' : 'Name'}</th>
                  <th className="p-3 text-start">{isRTL ? 'التصنيف' : 'Category'}</th>
                  <th className="p-3 text-center">{isRTL ? 'الوحدة' : 'UOM'}</th>
                  <th className="p-3 text-center">{isRTL ? 'تتبع الوجبة' : 'Batch Track'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الحد الأدنى' : 'Min Stock'}</th>
                  <th className="p-3 text-end">{isRTL ? 'نقطة الطلب' : 'Reorder Pt'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-cyan-400">{item.itemCode}</td>
                    <td className="p-3 font-mono text-slate-400">{item.barcode || '—'}</td>
                    <td className="p-3 text-white font-semibold">{isRTL ? item.nameAr : item.nameEn}</td>
                    <td className="p-3 text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">{item.category}</span>
                    </td>
                    <td className="p-3 text-center font-mono text-amber-300">{item.unitOfMeasure}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.trackBatch ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {item.trackBatch ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="p-3 text-end font-mono text-slate-300">{(item.minimumStock || 0).toLocaleString()}</td>
                    <td className="p-3 text-end font-mono text-amber-400 font-bold">{(item.reorderPoint || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: IMMUTABLE INVENTORY LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>{isRTL ? 'دفتر حركات المخزون غير القابل للتعديل' : 'Immutable Inventory Transaction Ledger'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'المصدر الحقيقي الوحيد لأرصدة النظام (Source of Truth) — لا يمكن التعديل اليدوي المباشر للأرصدة.'
                  : 'Immutable Source of Truth — Every stock change is backed by an auditable transaction.'}
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              {ledger.length} {isRTL ? 'حركة مسجلة' : 'Recorded Transactions'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'رقم الحركة' : 'Tx ID'}</th>
                  <th className="p-3 text-start">{isRTL ? 'النوع' : 'Type'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستند' : 'Document'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الصنف' : 'Item'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستودع / الرف' : 'Warehouse / Loc'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الكمية' : 'Quantity'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الوزن' : 'Weight'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المسؤول' : 'User'}</th>
                  <th className="p-3 text-end">{isRTL ? 'التاريخ والوقت' : 'Timestamp'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {ledger.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono font-bold text-cyan-400">{tx.transactionId}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.transactionType === 'RECEIPT' || tx.transactionType === 'OPENING_BALANCE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : tx.transactionType === 'ISSUE'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{tx.documentId || '—'}</td>
                    <td className="p-3 text-white font-semibold">{tx.itemName}</td>
                    <td className="p-3 text-slate-300 font-mono">
                      {tx.warehouseName} / {tx.locationCode}
                    </td>
                    <td className="p-3 text-end font-mono font-bold text-white">
                      {tx.quantity} {tx.unit}
                    </td>
                    <td className="p-3 text-end font-mono text-slate-300">{tx.weightKG} KG</td>
                    <td className="p-3 text-slate-300">{tx.performedBy}</td>
                    <td className="p-3 text-end font-mono text-slate-500 text-[11px]">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: ORGANIZATION SETTINGS */}
      {activeTab === 'ORG_SETTINGS' && (
        <form onSubmit={handleSaveOrgSettings} className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <span>{isRTL ? 'إعدادات المنشأة الحالية (Tenant Configuration)' : 'Tenant Organization Settings'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'تخصيص الهوية القانونية، العملة الافتراضية، المنطقة الزمنية، وبيانات التواصل للمنشأة الحالية.'
                : 'Configure legal registration name, currency, timezone, and contact profile for this tenant.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'اسم المنشأة (بالعربية)' : 'Name (Arabic)'}</label>
              <input
                type="text"
                required
                value={orgForm.nameAr}
                onChange={(e) => setOrgForm({ ...orgForm, nameAr: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'اسم المنشأة (بالإنجليزية)' : 'Name (English)'}</label>
              <input
                type="text"
                required
                value={orgForm.nameEn}
                onChange={(e) => setOrgForm({ ...orgForm, nameEn: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم القانوني المسجل' : 'Legal Business Name'}</label>
              <input
                type="text"
                value={orgForm.legalName}
                onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الدولة' : 'Country'}</label>
              <input
                type="text"
                value={orgForm.country}
                onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المدينة' : 'City'}</label>
              <input
                type="text"
                value={orgForm.city}
                onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'العملة المعتمدة' : 'Currency'}</label>
              <select
                value={orgForm.currency}
                onChange={(e) => setOrgForm({ ...orgForm, currency: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="USD">USD ($)</option>
                <option value="IQD">IQD (د.ع)</option>
                <option value="SAR">SAR (ر.س)</option>
                <option value="AED">AED (د.إ)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المنطقة الزمنية' : 'Timezone'}</label>
              <select
                value={orgForm.timezone}
                onChange={(e) => setOrgForm({ ...orgForm, timezone: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Asia/Baghdad">Asia/Baghdad (UTC+3)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                <option value="UTC">UTC (GMT)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'وحدة الوزن الافتراضية' : 'Default Weight Unit'}</label>
              <select
                value={orgForm.weightUnit}
                onChange={(e) => setOrgForm({ ...orgForm, weightUnit: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="KG">KG (Kilograms)</option>
                <option value="MT">MT (Metric Tons)</option>
                <option value="LBS">LBS (Pounds)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'تنسيق التاريخ' : 'Date Format'}</label>
              <select
                value={orgForm.dateFormat}
                onChange={(e) => setOrgForm({ ...orgForm, dateFormat: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isRTL ? 'حفظ إعدادات المنشأة' : 'Save Organization Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: ADD WAREHOUSE */}
      {/* ---------------------------------------------------------------------- */}
      {showAddWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateWarehouse}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'إضافة مستودع جديد' : 'New Warehouse Facility'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'كود المستودع' : 'Warehouse Code'}</label>
                <input
                  type="text"
                  required
                  placeholder="WH-MAIN-01"
                  value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'نوع المستودع' : 'Facility Type'}</label>
                <select
                  value={warehouseForm.type}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Raw">Raw Materials</option>
                  <option value="FinishedGoods">Finished Goods</option>
                  <option value="SpareParts">Spare Parts</option>
                  <option value="Packaging">Packaging</option>
                  <option value="General">General Storage</option>
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم (بالعربية)' : 'Name (Arabic)'}</label>
                <input
                  type="text"
                  required
                  value={warehouseForm.nameAr}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, nameAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم (بالإنجليزية)' : 'Name (English)'}</label>
                <input
                  type="text"
                  required
                  value={warehouseForm.nameEn}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'السعة الكلية (KG)' : 'Capacity (KG)'}</label>
                <input
                  type="number"
                  required
                  value={warehouseForm.totalCapacityKG}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, totalCapacityKG: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'أمين المخزن' : 'Storekeeper'}</label>
                <input
                  type="text"
                  value={warehouseForm.storekeeper}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, storekeeper: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddWarehouseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {isRTL ? 'حفظ وإنشاء' : 'Save Warehouse'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: ADD LOCATION */}
      {/* ---------------------------------------------------------------------- */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateLocation}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'إضافة موقع تخزين / رف' : 'New Storage Location'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع الأب' : 'Parent Warehouse'}</label>
                <select
                  value={locationForm.warehouseId}
                  onChange={(e) => setLocationForm({ ...locationForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'كود الموقع' : 'Location Code'}</label>
                <input
                  type="text"
                  required
                  placeholder="RACK-01-A"
                  value={locationForm.code}
                  onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'نوع الموقع' : 'Type'}</label>
                <select
                  value={locationForm.type}
                  onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="ZONE">ZONE (منطقة)</option>
                  <option value="AISLE">AISLE (ممر)</option>
                  <option value="RACK">RACK (رف)</option>
                  <option value="SHELF">SHELF (طابق)</option>
                  <option value="BIN">BIN (صندوق / فتحة)</option>
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم (بالعربية)' : 'Name (Arabic)'}</label>
                <input
                  type="text"
                  required
                  value={locationForm.nameAr}
                  onChange={(e) => setLocationForm({ ...locationForm, nameAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم (بالإنجليزية)' : 'Name (English)'}</label>
                <input
                  type="text"
                  required
                  value={locationForm.nameEn}
                  onChange={(e) => setLocationForm({ ...locationForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'السعة (KG)' : 'Capacity (KG)'}</label>
                <input
                  type="number"
                  required
                  value={locationForm.capacityKG}
                  onChange={(e) => setLocationForm({ ...locationForm, capacityKG: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'كود الربط الدفتري' : 'Internal Ref Code'}</label>
                <input
                  type="text"
                  placeholder="167"
                  value={locationForm.referenceCode}
                  onChange={(e) => setLocationForm({ ...locationForm, referenceCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {isRTL ? 'حفظ وإنشاء' : 'Save Location'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: ADD ITEM */}
      {/* ---------------------------------------------------------------------- */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateItem}
            className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'تسجيل صنف جديد بدليل الأصناف' : 'New Item Master'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'كود الصنف' : 'Item Code'}</label>
                <input
                  type="text"
                  required
                  placeholder="RAW-MAT-01"
                  value={itemForm.itemCode}
                  onChange={(e) => setItemForm({ ...itemForm, itemCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الباركود' : 'Barcode'}</label>
                <input
                  type="text"
                  placeholder="628100100999"
                  value={itemForm.barcode}
                  onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم (بالعربية)' : 'Name (Arabic)'}</label>
                <input
                  type="text"
                  required
                  value={itemForm.nameAr}
                  onChange={(e) => setItemForm({ ...itemForm, nameAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الاسم (بالإنجليزية)' : 'Name (English)'}</label>
                <input
                  type="text"
                  required
                  value={itemForm.nameEn}
                  onChange={(e) => setItemForm({ ...itemForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'التصنيف' : 'Category'}</label>
                <select
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {DEFAULT_ITEM_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.nameEn}>
                      {isRTL ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'وحدة القياس' : 'Unit of Measure'}</label>
                <select
                  value={itemForm.unitOfMeasure}
                  onChange={(e) => setItemForm({ ...itemForm, unitOfMeasure: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {DEFAULT_UNITS_OF_MEASURE.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.code} ({isRTL ? u.nameAr : u.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الحد الأدنى' : 'Minimum Stock'}</label>
                <input
                  type="number"
                  value={itemForm.minimumStock}
                  onChange={(e) => setItemForm({ ...itemForm, minimumStock: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'نقطة إعادة الطلب' : 'Reorder Point'}</label>
                <input
                  type="number"
                  value={itemForm.reorderPoint}
                  onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              {/* Toggles */}
              <div className="col-span-2 pt-2 border-t border-slate-800 grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.trackBatch}
                    onChange={(e) => setItemForm({ ...itemForm, trackBatch: e.target.checked })}
                    className="rounded bg-slate-950 text-cyan-500"
                  />
                  <span>{isRTL ? 'تتبع الوجبة' : 'Batch Track'}</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.trackSerial}
                    onChange={(e) => setItemForm({ ...itemForm, trackSerial: e.target.checked })}
                    className="rounded bg-slate-950 text-cyan-500"
                  />
                  <span>{isRTL ? 'تتبع التسلسل' : 'Serial Track'}</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemForm.trackExpiry}
                    onChange={(e) => setItemForm({ ...itemForm, trackExpiry: e.target.checked })}
                    className="rounded bg-slate-950 text-cyan-500"
                  />
                  <span>{isRTL ? 'تتبع الصلاحية' : 'Expiry Track'}</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                {isRTL ? 'حفظ الصنف' : 'Save Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: GOODS RECEIPT */}
      {/* ---------------------------------------------------------------------- */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteReceipt}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'استلام بضائع وتوريد مخزني (Stock In)' : 'Goods Receipt (Stock In)'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'المورد / المصدر' : 'Supplier / Origin'}</label>
                <input
                  type="text"
                  required
                  placeholder="Global Trading LLC"
                  value={receiptForm.supplierName}
                  onChange={(e) => setReceiptForm({ ...receiptForm, supplierName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'رقم المستند / الفاتورة' : 'Doc / PO #'}</label>
                <input
                  type="text"
                  required
                  placeholder="INV-2026-99"
                  value={receiptForm.documentNumber}
                  onChange={(e) => setReceiptForm({ ...receiptForm, documentNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الصنف المستلم' : 'Item'}</label>
                <select
                  value={receiptForm.itemId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع المستهدف' : 'Target Warehouse'}</label>
                <select
                  value={receiptForm.warehouseId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'موقع / رف التخزين' : 'Target Rack / Loc'}</label>
                <select
                  value={receiptForm.locationId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, locationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({isRTL ? l.nameAr : l.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الكمية' : 'Quantity'}</label>
                <input
                  type="number"
                  required
                  value={receiptForm.quantity}
                  onChange={(e) =>
                    setReceiptForm({
                      ...receiptForm,
                      quantity: Number(e.target.value),
                      weightKG: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'رقم الوجبة / التشغيلة' : 'Batch / Lot #'}</label>
                <input
                  type="text"
                  placeholder="BATCH-2026-A"
                  value={receiptForm.batchId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, batchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                {isRTL ? 'تأكيد الاستلام' : 'Confirm Receipt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 5: GOODS ISSUE */}
      {/* ---------------------------------------------------------------------- */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteIssue}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-400" />
                <span>{isRTL ? 'صرف بضائع وتخفيض رصيد (Stock Out)' : 'Goods Issue (Stock Out)'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الصنف المراد صرفه' : 'Item to Issue'}</label>
                <select
                  value={issueForm.itemId}
                  onChange={(e) => setIssueForm({ ...issueForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'من مستودع' : 'Source Warehouse'}</label>
                <select
                  value={issueForm.warehouseId}
                  onChange={(e) => setIssueForm({ ...issueForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'من موقع / رف' : 'Source Location'}</label>
                <select
                  value={issueForm.locationId}
                  onChange={(e) => setIssueForm({ ...issueForm, locationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الكمية المطلوبة' : 'Quantity'}</label>
                <input
                  type="number"
                  required
                  value={issueForm.quantity}
                  onChange={(e) => setIssueForm({ ...issueForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الوجهة / القسم' : 'Destination'}</label>
                <input
                  type="text"
                  required
                  placeholder="Production Line / Customer"
                  value={issueForm.destination}
                  onChange={(e) => setIssueForm({ ...issueForm, destination: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                {isRTL ? 'تأكيد الصرف' : 'Confirm Issue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 6: STOCK TRANSFER */}
      {/* ---------------------------------------------------------------------- */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteTransfer}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'مناقلة مخزون بين المستودعات والرفوف' : 'Stock Transfer'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الصنف المراد نقله' : 'Item'}</label>
                <select
                  value={transferForm.itemId}
                  onChange={(e) => setTransferForm({ ...transferForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1 space-y-2">
                <div className="font-bold text-amber-400">{isRTL ? 'المصدر (من)' : 'Source'}</div>
                <select
                  value={transferForm.sourceWarehouseId}
                  onChange={(e) => setTransferForm({ ...transferForm, sourceWarehouseId: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px]"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
                <select
                  value={transferForm.sourceLocationId}
                  onChange={(e) => setTransferForm({ ...transferForm, sourceLocationId: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px]"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 col-span-2 sm:col-span-1 space-y-2">
                <div className="font-bold text-cyan-400">{isRTL ? 'الوجهة (إلى)' : 'Destination'}</div>
                <select
                  value={transferForm.destinationWarehouseId}
                  onChange={(e) => setTransferForm({ ...transferForm, destinationWarehouseId: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px]"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
                <select
                  value={transferForm.destinationLocationId}
                  onChange={(e) => setTransferForm({ ...transferForm, destinationLocationId: e.target.value })}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-[11px]"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الكمية المنقولة' : 'Transfer Quantity'}</label>
                <input
                  type="number"
                  required
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {isRTL ? 'تنفيذ المناقلة' : 'Transfer Now'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 7: STOCK ADJUSTMENT */}
      {/* ---------------------------------------------------------------------- */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleExecuteAdjustment}
            className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <span>{isRTL ? 'تسوية جردية وموازنة دفتيرية' : 'Inventory Stock Adjustment'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الصنف' : 'Item'}</label>
                <select
                  value={adjustmentForm.itemId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</label>
                <select
                  value={adjustmentForm.warehouseId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الموقع' : 'Location'}</label>
                <select
                  value={adjustmentForm.locationId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, locationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'نوع التسوية' : 'Adjustment Type'}</label>
                <select
                  value={adjustmentForm.adjustmentType}
                  onChange={(e) =>
                    setAdjustmentForm({ ...adjustmentForm, adjustmentType: e.target.value as any })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="ADJUSTMENT_IN">{isRTL ? 'زيادة مخزون (+ IN)' : '+ IN (Surplus)'}</option>
                  <option value="ADJUSTMENT_OUT">{isRTL ? 'عجز مخزون (- OUT)' : '- OUT (Deficit)'}</option>
                </select>
              </div>

              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الكمية المُعدلة' : 'Delta Quantity'}</label>
                <input
                  type="number"
                  required
                  value={adjustmentForm.quantityDelta}
                  onChange={(e) =>
                    setAdjustmentForm({ ...adjustmentForm, quantityDelta: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-slate-400 font-semibold">{isRTL ? 'سبب التسوية (إلزامي)' : 'Mandatory Reason'}</label>
                <select
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Physical Count">{isRTL ? 'جرد فعلي دوري' : 'Physical Inventory Count'}</option>
                  <option value="Damaged">{isRTL ? 'تالف / كسر' : 'Damaged Stock'}</option>
                  <option value="Lost">{isRTL ? 'مفقود' : 'Lost / Missing'}</option>
                  <option value="Found">{isRTL ? 'موجودات جرد فائضة' : 'Found Surplus'}</option>
                  <option value="Correction">{isRTL ? 'تصحيح قيد إدخال خاطئ' : 'Data Entry Correction'}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
              >
                {isRTL ? 'تسجيل التسوية بالدفتر' : 'Post Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
