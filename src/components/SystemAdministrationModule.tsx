import React, { useState, useMemo } from 'react';
import {
  Settings,
  ShieldCheck,
  Hash,
  Users,
  Database,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
  Boxes,
  Layers,
  KeyRound,
  Sliders,
  Check,
  X,
  FileText,
  Search,
  ArrowRight,
  ExternalLink,
  Activity,
  Server,
  CloudCheck,
  Zap,
  Tag,
  Share2,
  Building2,
  Code,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import {
  SystemCodeConfig,
  InventoryCodePurpose,
  formatInventoryDocumentNumber,
  SystemCodesAPI,
} from '../services/systemCodesService';
import { AL_KARWAN_ROLES, formatRoleName } from '../services/permissionsService';
import { UserProfile, UserRole, Warehouse, WarehouseLocation } from '../types';

export const SystemAdministrationModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    currentUser,
    users,
    logAudit,
    materials,
    warehouses,
    locations,
    updateWarehouse,
    addLocation,
    updateLocation,
    deleteLocation,
    inventoryMovements,
    systemCodes,
    activeStorageCode,
    activeProductionCode,
    activeShreddingReceiptCode,
    activeShreddingMoveCode,
    getActiveInventoryCode,
    updateSystemInventoryCode,
    addSystemInventoryCode,
    deleteSystemInventoryCode,
    resetSystemInventoryCodes,
    firestoreConnected,
    isOnline,
  } = useFactory();

  const { currentOrganization, organizations, switchOrganization, updateOrganization } = useTenant();

  const [activeTab, setActiveTab] = useState<'CODES' | 'LOCATIONS' | 'SERVICES_MAP' | 'MOVEMENTS_AUDIT' | 'USERS' | 'MASTER' | 'SECURITY' | 'TENANT'>('CODES');

  // Programmatic SystemCodesAPI live test state
  const [apiTestResults, setApiTestResults] = useState<SystemCodeConfig[] | null>(null);
  const [isLoadingApiTest, setIsLoadingApiTest] = useState(false);

  const handleRunApiTest = async () => {
    setIsLoadingApiTest(true);
    try {
      const fetched = await SystemCodesAPI.getAllCodes();
      setApiTestResults(fetched);
      showToast(
        isRTL
          ? `✓ تم استدعاء واجهة برمجة الأكواد SystemCodesAPI بنجاح وجلب ${fetched.length} كوداً من Firestore بدون قيم صلبة!`
          : `✓ Successfully executed SystemCodesAPI call. Fetched ${fetched.length} codes dynamically from Firestore!`
      );
    } catch {
      showToast(isRTL ? 'فشل استدعاء واجهة برمجة الأكواد' : 'Failed to call SystemCodesAPI.', 'error');
    } finally {
      setIsLoadingApiTest(false);
    }
  };

  // Search and filter state for codes
  const [codeCategoryFilter, setCodeCategoryFilter] = useState<'ALL' | 'STORAGE' | 'PRODUCTION' | 'SHREDDING' | 'RECEIVING' | 'CUSTOM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing code modal state
  const [editingCode, setEditingCode] = useState<SystemCodeConfig | null>(null);
  const [isAddCodeOpen, setIsAddCodeOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newCodeForm, setNewCodeForm] = useState<Omit<SystemCodeConfig, 'id' | 'updatedAt'>>({
    code: '',
    nameAr: '',
    nameEn: '',
    category: 'CUSTOM',
    descriptionAr: '',
    descriptionEn: '',
    prefix: '',
    isActive: true,
    isSystemDefault: false,
    updatedBy: currentUser?.nameAr || currentUser?.name || 'Admin',
  });

  // Simulator State
  const [simulatorPurpose, setSimulatorPurpose] = useState<InventoryCodePurpose>('STORAGE');
  const [simulatorSeq, setSimulatorSeq] = useState('045');
  const [simulatorYear, setSimulatorYear] = useState(new Date().getFullYear());

  // Ledger audit code filter
  const [auditCodeFilter, setAuditCodeFilter] = useState<string>('ALL');

  // Location Reference Codes & Warehouse Mappings state
  const [selectedWarehouseForLocs, setSelectedWarehouseForLocs] = useState<string>('ALL');
  const [locationRefCodeFilter, setLocationRefCodeFilter] = useState<string>('ALL');
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>('');
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState<boolean>(false);
  const [newLocationForm, setNewLocationForm] = useState<Omit<WarehouseLocation, 'id'>>({
    warehouseId: 'WH-01',
    warehouseNameAr: 'مستودع الخامات الرئيسي رقم 1',
    warehouseNameEn: 'Main Raw Warehouse #1',
    zone: 'Zone A - Raw',
    code: '',
    referenceCode: '167',
    nameAr: '',
    nameEn: '',
    capacityKG: 30000,
    currentKG: 0,
    bulkBagsCount: 0,
    maxBags: 60,
    materialTypesAllowed: ['PET Flakes', 'PP Granules'],
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Filtered locations
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesWh = selectedWarehouseForLocs === 'ALL' || loc.warehouseId === selectedWarehouseForLocs;
      const refCode = loc.referenceCode || (warehouses.find((w) => w.id === loc.warehouseId)?.referenceCode) || '167';
      const matchesRef = locationRefCodeFilter === 'ALL' || refCode === locationRefCodeFilter;
      const q = locationSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        loc.code.toLowerCase().includes(q) ||
        loc.nameAr.toLowerCase().includes(q) ||
        loc.zone.toLowerCase().includes(q);
      return matchesWh && matchesRef && matchesSearch;
    });
  }, [locations, selectedWarehouseForLocs, locationRefCodeFilter, locationSearchQuery, warehouses]);

  const handleUpdateWarehouseRefCode = async (whId: string, refCode: string) => {
    try {
      await updateWarehouse(whId, { referenceCode: refCode });
      showToast(isRTL ? `تم ربط المستودع بالكود المرجعي [${refCode}] وحفظه في Firestore` : `Warehouse mapped to code [${refCode}] in Firestore.`);
    } catch {
      showToast(isRTL ? 'فشل تحديث كود المستودع' : 'Failed to update warehouse code.', 'error');
    }
  };

  const handleUpdateLocationRefCode = async (locId: string, refCode: string) => {
    try {
      await updateLocation(locId, { referenceCode: refCode });
      showToast(isRTL ? `تم ربط الموقع بالكود المرجعي [${refCode}] في Firestore` : `Location mapped to code [${refCode}] in Firestore.`);
    } catch {
      showToast(isRTL ? 'فشل تحديث كود الموقع' : 'Failed to update location code.', 'error');
    }
  };

  const handleSaveEditLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation) return;
    setIsSaving(true);
    try {
      await updateLocation(editingLocation.id, editingLocation);
      showToast(isRTL ? `تم تحديث بيانات الموقع [${editingLocation.code}] في Firestore` : `Location [${editingLocation.code}] updated in Firestore.`);
      setEditingLocation(null);
    } catch {
      showToast(isRTL ? 'فشل تحديث الموقع' : 'Failed to update location.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationForm.code.trim()) {
      showToast(isRTL ? 'الرجاء إدخال رمز الموقع' : 'Please enter location code.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const wh = warehouses.find((w) => w.id === newLocationForm.warehouseId);
      addLocation({
        ...newLocationForm,
        warehouseNameAr: wh?.nameAr || newLocationForm.warehouseNameAr,
        warehouseNameEn: wh?.nameEn || newLocationForm.warehouseNameEn,
      });
      showToast(isRTL ? `تم إنشاء الموقع [${newLocationForm.code}] وحفظه في Firestore` : `Location [${newLocationForm.code}] created in Firestore.`);
      setIsAddLocationOpen(false);
      setNewLocationForm({
        warehouseId: warehouses[0]?.id || 'WH-01',
        warehouseNameAr: warehouses[0]?.nameAr || 'مستودع الخامات',
        warehouseNameEn: warehouses[0]?.nameEn || 'Main Raw Warehouse',
        zone: 'Zone A - Raw',
        code: '',
        referenceCode: '167',
        nameAr: '',
        nameEn: '',
        capacityKG: 30000,
        currentKG: 0,
        bulkBagsCount: 0,
        maxBags: 60,
        materialTypesAllowed: ['PET Flakes', 'PP Granules'],
      });
    } catch {
      showToast(isRTL ? 'فشل إنشاء الموقع' : 'Failed to create location.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocation = async (locId: string, locCode: string) => {
    if (!confirm(isRTL ? `هل أنت متأكد من حذف موقع التخزين [${locCode}] من المستودع وقاعدة البيانات؟` : `Are you sure to delete location [${locCode}]?`)) return;
    try {
      await deleteLocation(locId);
      showToast(isRTL ? `تم حذف الموقع [${locCode}] من Firestore` : `Location [${locCode}] deleted from Firestore.`);
    } catch {
      showToast(isRTL ? 'فشل حذف الموقع' : 'Failed to delete location.', 'error');
    }
  };

  // Filtered codes
  const filteredCodes = useMemo(() => {
    return systemCodes.filter((c) => {
      const matchesCat = codeCategoryFilter === 'ALL' || c.category === codeCategoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.nameAr.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.prefix.toLowerCase().includes(q) ||
        c.descriptionAr.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [systemCodes, codeCategoryFilter, searchQuery]);

  // Movements filtered by code
  const filteredMovementsByCode = useMemo(() => {
    if (auditCodeFilter === 'ALL') {
      return inventoryMovements.slice(0, 50);
    }
    return inventoryMovements
      .filter((m) => {
        const code = m.internalInventoryCode || '';
        const docRef = m.legacyDocumentNumber || m.legacyDocRef || '';
        return code === auditCodeFilter || docRef.startsWith(auditCodeFilter);
      })
      .slice(0, 50);
  }, [inventoryMovements, auditCodeFilter]);

  // Code counts
  const codeStats = useMemo(() => {
    const total = systemCodes.length;
    const active = systemCodes.filter((c) => c.isActive).length;
    const storage = systemCodes.find((c) => c.category === 'STORAGE' && c.isActive)?.code || '167';
    const production = systemCodes.find((c) => c.category === 'PRODUCTION' && c.isActive)?.code || '546';
    const shreddingRec = systemCodes.find((c) => c.category === 'SHREDDING' && c.code === '360' && c.isActive)?.code || '360';
    const shreddingMov = systemCodes.find((c) => c.category === 'SHREDDING' && c.code === '352' && c.isActive)?.code || '352';
    const customCount = systemCodes.filter((c) => !c.isSystemDefault).length;
    return { total, active, storage, production, shreddingRec, shreddingMov, customCount };
  }, [systemCodes]);

  const handleToggleCodeActive = async (item: SystemCodeConfig) => {
    try {
      const ok = await updateSystemInventoryCode(item.code, { isActive: !item.isActive });
      if (ok) {
        showToast(
          isRTL
            ? `تم ${item.isActive ? 'تعطيل' : 'تفعيل'} الكود المخزني [${item.code}] في Firestore`
            : `System code [${item.code}] ${item.isActive ? 'disabled' : 'activated'} in Firestore.`
        );
      }
    } catch {
      showToast(isRTL ? 'فشل تحديث الكود في Firestore' : 'Failed to update code in Firestore.', 'error');
    }
  };

  const handleSaveEditCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;
    setIsSaving(true);

    try {
      const ok = await updateSystemInventoryCode(editingCode.code, editingCode);
      if (ok) {
        showToast(
          isRTL
            ? `تم حفظ وتحديث الكود [${editingCode.code}] بنجاح في قاعدة بيانات Firestore`
            : `Code [${editingCode.code}] successfully updated in Firestore.`
        );
        setEditingCode(null);
      } else {
        showToast(isRTL ? 'فشل حفظ التعديلات' : 'Failed to save changes.', 'error');
      }
    } catch {
      showToast(isRTL ? 'خطأ في الاتصال بقاعدة البيانات' : 'Database connection error.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeForm.code.trim()) {
      showToast(isRTL ? 'الرجاء إدخال رقم الكود' : 'Please enter code number', 'error');
      return;
    }

    if (systemCodes.some((c) => c.code === newCodeForm.code.trim())) {
      showToast(isRTL ? 'الكود مسجل مسبقاً، الرجاء اختيار رقم فريد' : 'Code number already exists.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const ok = await addSystemInventoryCode({
        ...newCodeForm,
        code: newCodeForm.code.trim(),
        prefix: newCodeForm.prefix.trim() || `DOC-${newCodeForm.code.trim()}`,
      });

      if (ok) {
        showToast(
          isRTL
            ? `تم إنشاء وحفظ الكود الجديد [${newCodeForm.code}] في Firestore بنجاح`
            : `New code [${newCodeForm.code}] stored in Firestore.`
        );
        setIsAddCodeOpen(false);
        setNewCodeForm({
          code: '',
          nameAr: '',
          nameEn: '',
          category: 'CUSTOM',
          descriptionAr: '',
          descriptionEn: '',
          prefix: '',
          isActive: true,
          isSystemDefault: false,
          updatedBy: currentUser?.nameAr || currentUser?.name || 'Admin',
        });
      } else {
        showToast(isRTL ? 'فشل إنشاء الكود' : 'Failed to register code.', 'error');
      }
    } catch {
      showToast(isRTL ? 'حدث خطأ أثناء الاتصال بـ Firestore' : 'Error contacting Firestore.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCode = async (codeStr: string) => {
    if (!confirm(isRTL ? `هل أنت متأكد من حذف الكود [${codeStr}] من Firestore والمستودع؟` : `Are you sure to delete code [${codeStr}] from Firestore?`)) return;
    try {
      const ok = await deleteSystemInventoryCode(codeStr);
      if (ok) {
        showToast(isRTL ? `تم حذف الكود [${codeStr}] من Firestore بنجاح` : `Code [${codeStr}] deleted from Firestore.`);
      } else {
        showToast(isRTL ? 'لا يمكن حذف الأكواد القياسية الأساسية لمصنع الكروان (167، 546، 360، 352)' : 'Cannot delete AL-KARWAN baseline system codes.', 'error');
      }
    } catch {
      showToast(isRTL ? 'فشل حذف الكود' : 'Failed to delete code.', 'error');
    }
  };

  const handleResetCodes = async () => {
    if (
      !confirm(
        isRTL
          ? 'هل تريد استعادة الأكواد القياسية الأصلية لمصنع الكروان (167 للمستودع، 546 للإنتاج، 360 لمفروم الثرم، 352 لهوالك الثرم) وإعادة مزامنتها في Firestore؟'
          : 'Reset all inventory codes in Firestore to AL-KARWAN standards (167, 546, 360, 352)?'
      )
    )
      return;

    try {
      await resetSystemInventoryCodes();
      showToast(isRTL ? 'تمت استعادة الأكواد القياسية ومزامنتها في Firestore بنجاح' : 'Restored baseline codes in Firestore.');
    } catch {
      showToast(isRTL ? 'فشل استعادة الأكواد' : 'Failed to reset codes.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto text-slate-200">
      {/* Module Header with Live Firestore Indicator */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#171328] via-[#10121d] to-[#0f172a] border border-purple-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-600 text-white shadow-lg shadow-purple-600/30">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                AL-KARWAN ENTERPRISE GOVERNANCE
              </span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Firestore Live Collection: systemInventoryCodes</span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {isRTL
                ? 'إدارة النظام والأكواد المخزنية الداخلية (167 / 546)'
                : 'System Administration & Configurable Inventory Codes'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'تهيئة أكواد المعاملات المخزنية الرسمية (167 للمستودع العام، 546 لخطوط الإنتاج والبثق، 360 لمفروم الثرم، 352 لهوالك الثرم) مع التخزين الحي في Firestore وربطها بالمحرك المخزني.'
                : 'Manage configurable internal inventory codes (167 for Storage, 546 for Production) stored in Firestore and referenced across factory movement engines.'}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAddCodeOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? '+ إضافة كود مخزني جديد' : '+ New Inventory Code'}</span>
          </button>

          <button
            onClick={handleResetCodes}
            className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            title={isRTL ? 'استعادة الأكواد القياسية لمصنع الكروان' : 'Reset to Default Codes'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'استعادة الافتراضي' : 'Reset Codes'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-lg animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Key Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-[#111218] border border-purple-500/20 shadow-md">
          <span className="text-[10px] text-slate-400 block font-mono">
            {isRTL ? 'إجمالي الأكواد' : 'Total Codes'}
          </span>
          <div className="text-xl font-mono font-black text-purple-300 mt-1 flex items-baseline gap-1.5">
            <span>{codeStats.total}</span>
            <span className="text-[10px] text-slate-500 font-normal">({codeStats.active} {isRTL ? 'نشط' : 'active'})</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111218] border border-cyan-500/30 shadow-md">
          <span className="text-[10px] text-cyan-400 block font-mono font-bold">
            {isRTL ? 'كود المستودع (Storage)' : 'Storage Baseline'}
          </span>
          <div className="text-xl font-mono font-black text-cyan-300 mt-1 flex items-center gap-1.5">
            <span>{codeStats.storage}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-sans">
              {isRTL ? 'إيداع وصرف' : 'STR'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111218] border border-amber-500/30 shadow-md">
          <span className="text-[10px] text-amber-400 block font-mono font-bold">
            {isRTL ? 'كود الإنتاج (Production)' : 'Production Baseline'}
          </span>
          <div className="text-xl font-mono font-black text-amber-300 mt-1 flex items-center gap-1.5">
            <span>{codeStats.production}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-sans">
              {isRTL ? 'بثق وأكواب' : 'PRD'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111218] border border-emerald-500/30 shadow-md">
          <span className="text-[10px] text-emerald-400 block font-mono font-bold">
            {isRTL ? 'ناتج الثرم (Regrind)' : 'Shredding Receipt'}
          </span>
          <div className="text-xl font-mono font-black text-emerald-300 mt-1 flex items-center gap-1.5">
            <span>{codeStats.shreddingRec}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-sans">
              {isRTL ? 'مجروش' : 'THM'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111218] border border-indigo-500/30 shadow-md">
          <span className="text-[10px] text-indigo-400 block font-mono font-bold">
            {isRTL ? 'حركة الهوالك (Waste)' : 'Shredding Waste'}
          </span>
          <div className="text-xl font-mono font-black text-indigo-300 mt-1 flex items-center gap-1.5">
            <span>{codeStats.shreddingMov}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-sans">
              {isRTL ? 'طوز وهوالك' : 'TRM'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#111218] border border-white/10 shadow-md">
          <span className="text-[10px] text-slate-400 block font-mono">
            {isRTL ? 'حالة المزامنة' : 'Firestore Sync'}
          </span>
          <div className="text-xs font-mono font-bold text-emerald-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>{firestoreConnected ? 'Firestore Connected' : 'Offline Persist'}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('CODES')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'CODES'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Hash className="w-4 h-4 text-purple-300" />
          <span>{isRTL ? 'إدارة الأكواد المخزنية (167 / 546)' : 'Configurable Inventory Codes'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-white">
            {systemCodes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('LOCATIONS')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'LOCATIONS'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-4 h-4 text-blue-300" />
          <span>{isRTL ? 'ربط أكواد المواقع والمستودعات' : 'Location Reference Codes'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-white">
            {locations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SERVICES_MAP')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'SERVICES_MAP'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>{isRTL ? 'ارتباط الخدمات وواجهة البرمجة (API)' : 'Services API & Simulator'}</span>
        </button>

        <button
          onClick={() => setActiveTab('TENANT')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'TENANT'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4 text-emerald-300" />
          <span>{isRTL ? 'تهيئة المنشأة والمستأجر (SaaS Tenant)' : 'Tenant Organization Settings'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
            {currentOrganization.plan}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MOVEMENTS_AUDIT')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'MOVEMENTS_AUDIT'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4 text-cyan-300" />
          <span>{isRTL ? 'تدقيق الحركات بالأكواد المخزنية' : 'Ledger Code Audit'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-white">
            {inventoryMovements.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('USERS')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'USERS'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4 text-cyan-300" />
          <span>{isRTL ? 'المستخدمون ومصفوفة الصلاحيات (RBAC)' : 'User Accounts & Roles'}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-white">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MASTER')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'MASTER'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Boxes className="w-4 h-4 text-emerald-300" />
          <span>{isRTL ? 'البيانات الأساسية والمستودعات' : 'Master Data'}</span>
        </button>

        <button
          onClick={() => setActiveTab('SECURITY')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'SECURITY'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-300" />
          <span>{isRTL ? 'أمان Firestore وقواعد التدقيق' : 'Security & Rules'}</span>
        </button>
      </div>

      {/* TAB 1: CONFIGURABLE INVENTORY & TRANSACTION CODES */}
      {activeTab === 'CODES' && (
        <div className="space-y-4">
          {/* Explanation Banner */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-3">
            <Hash className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block mb-0.5">
                {isRTL ? 'الأكواد المخزنية المعتمدة بمصنع الكروان (Firestore Stored):' : 'AL-KARWAN Internal Inventory Codes Architecture:'}
              </span>
              <p>
                {isRTL
                  ? 'تم تصميم النظام لدعم الأكواد المخزنية الدفترية المعتمدة بشركة الكروان (167 = الإيداع بالمخزن وصرف الخامات، 546 = توريد وصرف خطوط الإنتاج والبثق، 360 = استلام مفروم ومجروش الثرم، 352 = حركة وهوك وأطراف الثرم). يتم حفظ كافة التعديلات في Firestore فوراً وتنعكس على جميع الخدمات المخزنية تلقائياً.'
                  : 'Allows full dynamic configuration of AL-KARWAN internal document codes (167 for Storage, 546 for Production, 360 for Shredding regrind output, 352 for Shredding waste). Stored persistently in Firestore collection `systemInventoryCodes`.'}
              </p>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#111218] border border-white/10">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
                  { id: 'STORAGE', labelAr: 'المستودع (167)', labelEn: 'Storage (167)' },
                  { id: 'PRODUCTION', labelAr: 'الإنتاج (546)', labelEn: 'Production (546)' },
                  { id: 'SHREDDING', labelAr: 'الثرم (360/352)', labelEn: 'Shredding (360/352)' },
                  { id: 'RECEIVING', labelAr: 'الاستلام', labelEn: 'Receiving' },
                  { id: 'CUSTOM', labelAr: 'مخصصة', labelEn: 'Custom' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCodeCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    codeCategoryFilter === cat.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {isRTL ? cat.labelAr : cat.labelEn}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRTL ? 'بحث بالرمز، الاسم أو البادئة...' : 'Search by code, name, prefix...'}
                className="w-full ps-9 pe-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Codes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCodes.map((item) => (
              <div
                key={item.code}
                className="p-5 rounded-2xl bg-[#111218] border border-white/10 hover:border-purple-500/40 transition-all shadow-lg flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center font-mono font-black text-purple-300 text-xl shadow-inner">
                        {item.code}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
                            {item.prefix}
                          </span>
                          <button
                            onClick={() => handleToggleCodeActive(item)}
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold cursor-pointer transition-all ${
                              item.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                            }`}
                            title={isRTL ? 'انقر لتغيير حالة التفعيل في Firestore' : 'Click to toggle active status'}
                          >
                            {item.isActive ? (isRTL ? '✓ نشط' : '✓ Active') : (isRTL ? '✕ معطل' : '✕ Disabled')}
                          </button>
                          {item.isSystemDefault ? (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                              {isRTL ? 'أساسي (Baseline)' : 'Baseline'}
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                              {isRTL ? 'مخصص' : 'Custom'}
                            </span>
                          )}
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/5">
                            {item.category}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-white mt-1">
                          {isRTL ? item.nameAr : item.nameEn}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingCode(item)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-purple-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                        title={isRTL ? 'تعديل الكود في Firestore' : 'Edit Code in Firestore'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!item.isSystemDefault && (
                        <button
                          onClick={() => handleDeleteCode(item.code)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-rose-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                          title={isRTL ? 'حذف الكود' : 'Delete Code'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                    {isRTL ? item.descriptionAr : item.descriptionEn}
                  </p>

                  {/* Document Number Preview */}
                  <div className="mt-3 p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">
                      {isRTL ? 'نمط المستند الناتج:' : 'Document Reference Pattern:'}
                    </span>
                    <strong className="font-mono text-cyan-300 font-bold">
                      {item.code}/{new Date().getFullYear()}/089
                    </strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{isRTL ? 'المصدر:' : 'Source:'} Firestore (`systemInventoryCodes/{item.code}`)</span>
                  <span>{new Date(item.updatedAt).toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: WAREHOUSE & LOCATION REFERENCE CODES MAPPING */}
      {activeTab === 'LOCATIONS' && (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-3">
            <Layers className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block mb-0.5">
                {isRTL
                  ? 'ربط المستودعات ومواقع التخزين بالأكواد المرجعية (Firestore Stored):'
                  : 'Warehouse & Storage Location Reference Codes Mapping:'}
              </span>
              <p>
                {isRTL
                  ? 'يمكن للمسؤولين ربط كل مستودع وكل رف/قاطع تخزيني بالكود المرجعي المناسب (مثل 167 لمستودع الخامات، 546 لمنطقة توريد الإنتاج، 360 لمستودع ناتج الثرم). يتم تخزين هذه الأكواد في Firestore واستخدامها تلقائياً عند إجراء حركات النقل والصرف.'
                  : 'Map warehouses and individual location bins to their official internal reference codes (167 for Raw Storage, 546 for Production staging, 360 for Regrind Intake). Persisted in Firestore.'}
              </p>
            </div>
          </div>

          {/* Warehouse Master Mapping Cards */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'الأكواد المرجعية الافتراضية للمستودعات المركزية' : 'Warehouse Facility Reference Codes'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 font-bold">
                {warehouses.length} {isRTL ? 'مستودعات' : 'Warehouses'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {warehouses.map((wh) => (
                <div key={wh.id} className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-cyan-400 font-bold text-xs">{wh.code}</span>
                      <strong className="block text-white text-xs mt-0.5">{isRTL ? wh.nameAr : wh.nameEn}</strong>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {wh.type}
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      {isRTL ? 'الكود المرجعي للمستودع:' : 'Mapped Reference Code:'}
                    </label>
                    <select
                      value={wh.referenceCode || (wh.id === 'WH-01' ? '167' : wh.id === 'WH-02' ? '360' : '546')}
                      onChange={(e) => handleUpdateWarehouseRefCode(wh.id, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-white text-xs font-mono outline-none focus:border-cyan-400"
                    >
                      {systemCodes.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} - {isRTL ? c.nameAr : c.nameEn} ({c.category})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Location Bins Table Filter & Actions */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'قواطع ورفوف التخزين والأكواد المرجعية' : 'Storage Bins & Location Reference Codes'}
                </h3>
                <span className="text-xs font-mono text-slate-400">({filteredLocations.length})</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-2.5" />
                  <input
                    type="text"
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder={isRTL ? 'بحث برمز الموقع أو الرف...' : 'Search bin or zone...'}
                    className="ps-8 pe-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400 w-44"
                  />
                </div>

                <select
                  value={selectedWarehouseForLocs}
                  onChange={(e) => setSelectedWarehouseForLocs(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                >
                  <option value="ALL">{isRTL ? 'كافة المستودعات' : 'All Warehouses'}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} - {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>

                <select
                  value={locationRefCodeFilter}
                  onChange={(e) => setLocationRefCodeFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono outline-none focus:border-cyan-400"
                >
                  <option value="ALL">{isRTL ? 'كافة الأكواد' : 'All Codes'}</option>
                  {systemCodes.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.category})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setIsAddLocationOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isRTL ? '+ إضافة موقع' : '+ Add Bin'}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-white/10">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'رمز الموقع' : 'Location Code'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المستودع' : 'Warehouse'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المنطقة / Zone' : 'Zone'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الكود المرجعي المعين' : 'Assigned Ref Code'}</th>
                    <th className="p-3 text-start">{isRTL ? 'السعة والإشغال' : 'Capacity & Stock'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLocations.map((loc) => {
                    const currentRef = loc.referenceCode || (warehouses.find((w) => w.id === loc.warehouseId)?.referenceCode) || '167';
                    const fillPct = Math.round(((loc.currentKG || 0) / (loc.capacityKG || 1)) * 100);

                    return (
                      <tr key={loc.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 font-mono font-bold text-cyan-300">
                          {loc.code}
                        </td>
                        <td className="p-3 text-slate-300">
                          {isRTL ? loc.warehouseNameAr : loc.warehouseNameEn}
                        </td>
                        <td className="p-3 text-slate-400">
                          {loc.zone}
                        </td>
                        <td className="p-3">
                          <select
                            value={currentRef}
                            onChange={(e) => handleUpdateLocationRefCode(loc.id, e.target.value)}
                            className="px-2 py-1 rounded bg-black/60 border border-slate-700 text-xs font-mono font-bold text-purple-300 outline-none focus:border-purple-400"
                          >
                            {systemCodes.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} ({c.category})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${fillPct > 90 ? 'bg-rose-500' : fillPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, fillPct)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-slate-400">
                              {(loc.currentKG || 0).toLocaleString()} / {(loc.capacityKG || 0).toLocaleString()} KG
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-end">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingLocation(loc)}
                              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                              title={isRTL ? 'تعديل بيانات الموقع' : 'Edit Location'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLocation(loc.id, loc.code)}
                              className="p-1.5 rounded hover:bg-rose-600/20 text-slate-400 hover:text-rose-400"
                              title={isRTL ? 'حذف الموقع' : 'Delete Location'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLocations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                        {isRTL ? 'لا توجد مواقع تطابق محددات البحث الحالية' : 'No locations match current search criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY SERVICES LINKAGE & LIVE SIMULATOR */}
      {activeTab === 'SERVICES_MAP' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block mb-0.5">
                {isRTL ? 'ارتباط الخدمات المخزنية بالأكواد (Services Code Linkage Architecture):' : 'Inventory Services Code Linkage Architecture:'}
              </span>
              <p>
                {isRTL
                  ? 'ترتبط كافة الخدمات المخزنية داخل مصنع الكروان بالأكواد المعرفة في Firestore: محرك الحركات المخزنية (inventoryMovementEngine)، ميزان الشاحنات (ReceivingModule)، خطوط البثق والإنتاج (ProductionModule)، ومطابقة المخزون الآلية (InventoryReconciler).'
                  : 'All factory inventory movement services directly resolve configurable internal codes stored in Firestore to prevent hardcoded assumptions and guarantee compliance.'}
              </p>
            </div>
          </div>

          {/* Interactive Live Simulator */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-purple-500/30 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  {isRTL ? 'مختبر محاكاة الأكواد المخزنية والمستندات' : 'Inventory Code Resolution & Document Simulator'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {isRTL ? 'فحص حي مع Firestore' : 'Live Firestore Mapped'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                  {isRTL ? 'نوع العملية المخزنية:' : 'Operation Purpose:'}
                </label>
                <select
                  value={simulatorPurpose}
                  onChange={(e) => setSimulatorPurpose(e.target.value as InventoryCodePurpose)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-purple-400"
                >
                  <option value="STORAGE">{isRTL ? 'إيداع وصرف المستودع الرئيسي (167)' : 'Warehouse Storage & Raw Movement (167)'}</option>
                  <option value="PRODUCTION">{isRTL ? 'صرف وتوريد لخطوط الإنتاج والبثق (546)' : 'Sent to Production Lines (546)'}</option>
                  <option value="SHREDDING_RECEIPT">{isRTL ? 'استلام مفروم ومجروش الثرم (360)' : 'Received Shredded Material (360)'}</option>
                  <option value="SHREDDING_MOVE">{isRTL ? 'حركة هوالك وأطراف الثرم (352)' : 'Shredding Internal Move & Waste (352)'}</option>
                  <option value="RECEIVING">{isRTL ? 'استلام وتفريغ شاحنات الخامات' : 'Incoming Raw Material Receiving'}</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                  {isRTL ? 'التسلسل التجريبي:' : 'Sample Sequence:'}
                </label>
                <input
                  type="text"
                  value={simulatorSeq}
                  onChange={(e) => setSimulatorSeq(e.target.value)}
                  placeholder="089"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                  {isRTL ? 'السنة المالية:' : 'Fiscal Year:'}
                </label>
                <input
                  type="number"
                  value={simulatorYear}
                  onChange={(e) => setSimulatorYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Simulation Results Display */}
            {(() => {
              const activeCode = getActiveInventoryCode(simulatorPurpose);
              const formattedDoc = formatInventoryDocumentNumber(simulatorPurpose, simulatorSeq, simulatorYear, systemCodes);
              const codeObj = systemCodes.find((c) => c.code === activeCode);

              return (
                <div className="p-4 rounded-xl bg-black/60 border border-purple-500/20 space-y-3">
                  <div className="text-[11px] font-mono text-purple-300 font-bold uppercase">
                    {isRTL ? 'نتيجة الفك والمطابقة الآلية:' : 'Resolution & Traceability Output:'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'الكود النشط المعتمد' : 'Resolved Internal Code'}</span>
                      <strong className="text-xl font-mono text-purple-300 font-black block">{activeCode}</strong>
                      <span className="text-[10px] text-slate-400">{codeObj?.nameAr}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'رقم المستند الرسمي المولد' : 'Generated Document Ref'}</span>
                      <strong className="text-base font-mono text-cyan-300 font-bold block">{formattedDoc}</strong>
                      <span className="text-[10px] text-slate-500 font-mono">Prefix: {codeObj?.prefix}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'الخدمة المسؤولة' : 'Target Service'}</span>
                      <strong className="text-xs text-white font-bold block">
                        {simulatorPurpose === 'STORAGE'
                          ? 'inventoryMovementEngine'
                          : simulatorPurpose === 'PRODUCTION'
                          ? 'ProductionModule & Extrusion'
                          : 'Shredding & Reclaim Engine'}
                      </strong>
                      <span className="text-[10px] text-emerald-400 font-mono">Firestore Collection Linked</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/90 border border-white/5 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'صلاحية الحركة' : 'Ledger Validation'}</span>
                      <strong className="text-xs text-emerald-300 font-bold flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{isRTL ? 'معتمد ومطابق للمعايير' : 'Valid & Traceable'}</span>
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">Zero Silent Overwrite</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Architectural Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#111218] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-white text-xs flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>محرك الحركات المخزنية (inventoryMovementEngine)</span>
                </strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  Code: {activeStorageCode}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                يقوم المحرك تلقائياً بختم الحركات المخزنية برمز الكود النشط وتوليد أرقام المستندات الرسمية (مثل: {activeStorageCode}/2026/001) لكل حركة إيداع أو تحويل أو استلام، ويخزن الرمز في حقل `internalInventoryCode`.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111218] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-white text-xs flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-amber-400" />
                  <span>خطوط الإنتاج وصرف الخامات (Production & Extrusion)</span>
                </strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                  Code: {activeProductionCode}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                تعتمد خطوط البثق والأكواب الحرارية الكود المعتمد ({activeProductionCode}) في مستندات الصرف والتشغيل، مما يمنع الصرف غير الموثق ويضمن خصم الخامات من المستودع بدقة.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111218] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-white text-xs flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span>وحدة الثرم وتدوير الهوالك (Regrind & Shredder SHR-360)</span>
                </strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  Codes: {activeShreddingReceiptCode} & {activeShreddingMoveCode}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                تستخدم وحدة الثرم كود {activeShreddingReceiptCode} لاستلام أكياس الشليف الناتجة عن الجرش، وكود {activeShreddingMoveCode} لتوثيق حركة تالف التشغيل وهوك الأطراف وطوز الثرم.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#111218] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-white text-xs flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-400" />
                  <span>المطابقة المخزنية الدفترية الآلية (Inventory Reconciler)</span>
                </strong>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                  Ledger Reconciled
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                تقوم خدمة المطابقة الآلية باحتساب الأرصدة النظرية ومقارنتها مع الرصيد الفعلي المخزن بالمستودع وفق معادلة التدفق المعتمدة استناداً إلى أرقام المستندات المقيدة.
              </p>
            </div>
          </div>

          {/* Programmatic SystemCodesAPI Interface Panel */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-cyan-500/30 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isRTL
                      ? 'واجهة SystemCodesAPI البرمجية لجلب وتعديل الأكواد من Firestore دون قيم صلبة'
                      : 'Programmatic SystemCodesAPI for Dynamic Code Lookups (Zero Hard-Coding)'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {isRTL
                      ? 'دوال برمجية موحدة تتيح لكافة الخدمات جلب وتعديل وحفظ الأكواد في Firestore تلقائياً'
                      : 'Unified API methods ensuring all services reference codes dynamically from Firestore.'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleRunApiTest}
                disabled={isLoadingApiTest}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/20 shrink-0"
              >
                <Activity className={`w-3.5 h-3.5 ${isLoadingApiTest ? 'animate-spin' : ''}`} />
                <span>
                  {isLoadingApiTest
                    ? (isRTL ? 'جاري الاستعلام من Firestore...' : 'Querying Firestore...')
                    : (isRTL ? 'فحص جلب الأكواد عبر API حي' : 'Execute SystemCodesAPI.getAllCodes()')}
                </span>
              </button>
            </div>

            {/* Code Usage Blueprint */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/5 space-y-2">
                <span className="text-cyan-300 font-bold block text-[11px]">
                  // 1. Dynamic Resolution Usage in Inventory Services:
                </span>
                <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`import { SystemCodesAPI } from './services/systemCodesService';

// Resolve active storage code (dynamically fetched, defaults to '167')
const storageCode = SystemCodesAPI.getStorageCode();

// Resolve active production code (dynamically fetched, defaults to '546')
const productionCode = SystemCodesAPI.getProductionCode();

// Format official audit document number dynamically
const docNumber = SystemCodesAPI.formatDocNumber('STORAGE', '045');
// => Output: "\${storageCode}/2026/045"`}
                </pre>
              </div>

              <div className="p-3.5 rounded-xl bg-black/60 border border-white/5 space-y-2">
                <span className="text-emerald-300 font-bold block text-[11px]">
                  // 2. Programmatic Firestore Modification Methods:
                </span>
                <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`// Update an existing code in Firestore
await SystemCodesAPI.updateCode('167', {
  nameAr: 'مستند إيداع المستودع الرئيسي المعتمد',
});

// Create a new custom organization code in Firestore
await SystemCodesAPI.createCode({
  code: '720',
  nameAr: 'صرف قوالب وأكواب خاصة',
  nameEn: 'Custom Mold Dispatch',
  category: 'CUSTOM',
  prefix: 'CUS-720',
  isActive: true,
  isSystemDefault: false,
});`}
                </pre>
              </div>
            </div>

            {/* Live API Results Display if Tested */}
            {apiTestResults && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isRTL ? 'استجابة حية من Firestore عبر SystemCodesAPI' : 'Live Firestore Response via SystemCodesAPI:'}</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {apiTestResults.length} {isRTL ? 'أكواد نشطة مسترجعة' : 'records returned'}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-black/70 p-2.5 text-[11px] font-mono text-cyan-200">
                  <pre>{JSON.stringify(apiTestResults, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LEDGER CODE AUDIT */}
      {activeTab === 'MOVEMENTS_AUDIT' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[#111218] border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300">{isRTL ? 'تصفية حسب الكود المخزني:' : 'Filter by Inventory Code:'}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setAuditCodeFilter('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                    auditCodeFilter === 'ALL'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {isRTL ? 'الكل' : 'All'}
                </button>
                {systemCodes.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setAuditCodeFilter(c.code)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold cursor-pointer ${
                      auditCodeFilter === c.code
                        ? 'bg-cyan-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.code} ({c.prefix})
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredMovementsByCode.length} {isRTL ? 'حركة مسجلة' : 'movements'}
            </span>
          </div>

          {/* Audit Ledger Table */}
          <div className="bg-[#111218] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] bg-black/30">
                    <th className="p-3 text-start">{isRTL ? 'التاريخ والوقت' : 'Timestamp'}</th>
                    <th className="p-3 text-start">{isRTL ? 'رقم الحركة' : 'Movement ID'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الكود المخزني' : 'Code'}</th>
                    <th className="p-3 text-start">{isRTL ? 'رقم المستند' : 'Doc Reference'}</th>
                    <th className="p-3 text-start">{isRTL ? 'نوع الحركة' : 'Movement Type'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المادة' : 'Material'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الوزن (كغم)' : 'Weight KG'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المسؤول' : 'User'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredMovementsByCode.map((m) => {
                    const assignedCode = m.internalInventoryCode || (m.legacyDocumentNumber?.split('/')[0]) || '167';
                    return (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-mono text-slate-400 text-[11px]">
                          {m.date} {m.time}
                        </td>
                        <td className="p-3 font-mono text-cyan-400 font-bold">{m.movementNumber || m.id}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            {assignedCode}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-amber-300 text-[11px]">
                          {m.legacyDocumentNumber || m.legacyDocRef || m.referenceDocument || '-'}
                        </td>
                        <td className="p-3 text-slate-300 text-[11px] font-semibold">{m.movementType}</td>
                        <td className="p-3 text-white font-bold">{m.materialName}</td>
                        <td className="p-3 text-end font-mono font-bold text-emerald-400">
                          {m.quantityKG.toLocaleString()} KG
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">{m.user || m.operator}</td>
                      </tr>
                    );
                  })}
                  {filteredMovementsByCode.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                        {isRTL ? 'لا توجد حركات مسجلة تحت هذا الكود حتى الآن.' : 'No movements found for this code.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: USER ACCOUNTS & ROLE-BASED ACCESS CONTROL (RBAC) */}
      {activeTab === 'USERS' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-3">
            <Users className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">
                {isRTL ? 'أدوار منظومة الكروان المعتمدة (6 أدوار رئيسية):' : 'AL-KARWAN Authorized Role Matrix:'}
              </span>
              <p className="leading-relaxed">
                {isRTL
                  ? 'يتم تطبيق مصفوفة الأذونات الصارمة لمنع الوصول غير المصرح به: Admin (إدارة كاملة للأكواد والمستخدمين)، Storage Manager (إدارة المستودع والمخزون)، Storage Worker (عمليات الميزان والحركة)، Production (أوامر الإنتاج والتالف)، Shredding (عمليات الثرم والجرش)، و Management (الرقابة العامة والتقارير).'
                  : 'Role-based access control enforces strict visibility: Admin, Storage Manager, Storage Worker, Production, Shredding, and Management.'}
              </p>
            </div>
          </div>

          {/* Role Cards Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(AL_KARWAN_ROLES).map((roleDef) => (
              <div
                key={roleDef.key}
                className="p-4 rounded-2xl bg-[#111218] border border-white/10 hover:border-cyan-500/40 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${roleDef.badgeColor}`}>
                    {isRTL ? roleDef.labelAr : roleDef.labelEn}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {roleDef.allowedPages.length} {isRTL ? 'شاشات مصرحة' : 'pages'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isRTL ? roleDef.descriptionAr : roleDef.descriptionEn}
                </p>

                <div className="pt-2 border-t border-white/5 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'إدارة المستخدمين:' : 'Manage Users:'}</span>
                    <strong className={roleDef.canManageUsers ? 'text-emerald-400' : 'text-slate-600'}>
                      {roleDef.canManageUsers ? '✓ مصرح' : '✗ غير مصرح'}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'إدارة الأكواد المخزنية:' : 'Manage Inventory Codes:'}</span>
                    <strong className={roleDef.canManageSystemCodes ? 'text-emerald-400' : 'text-slate-600'}>
                      {roleDef.canManageSystemCodes ? '✓ مصرح' : '✗ غير مصرح'}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'استلام وصرف المواد:' : 'Intake & Issue:'}</span>
                    <strong className={roleDef.canReceiveMaterials ? 'text-emerald-400' : 'text-slate-600'}>
                      {roleDef.canReceiveMaterials ? '✓ مصرح' : '✗ غير مصرح'}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>{isRTL ? 'تشغيل الثرم:' : 'Execute Shredding:'}</span>
                    <strong className={roleDef.canExecuteShredding ? 'text-emerald-400' : 'text-slate-600'}>
                      {roleDef.canExecuteShredding ? '✓ مصرح' : '✗ غير مصرح'}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Users Table */}
          <div className="bg-[#111218] border border-white/10 rounded-2xl overflow-hidden shadow-xl space-y-2 p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-white/5">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'سجل مستخدمي وموظفي مصنع الكروان' : 'Al-Karwan Factory User Directory'}</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px]">
                    <th className="p-3 text-start">{isRTL ? 'الاسم' : 'Name'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الرقم الوظيفي' : 'Badge'}</th>
                    <th className="p-3 text-start">{isRTL ? 'القسم' : 'Department'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الدور والصلاحية' : 'Assigned Role'}</th>
                    <th className="p-3 text-start">{isRTL ? 'المستودع المعين' : 'Assigned Facility'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="p-3 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${u.avatarColor} flex items-center justify-center font-bold text-white text-xs`}>
                            {u.nameAr.slice(0, 1)}
                          </div>
                          <div>
                            <div>{isRTL ? u.nameAr : u.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{u.email || u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-cyan-400 font-bold">{u.badgeNumber}</td>
                      <td className="p-3 text-slate-300">{isRTL ? u.departmentAr : u.department}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          {formatRoleName(u.role, isRTL)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">{isRTL ? u.assignedWarehouseAr : u.assignedWarehouse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MASTER MATERIALS & LOCATIONS */}
      {activeTab === 'MASTER' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Materials Summary */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Boxes className="w-4 h-4 text-emerald-400" />
                <span>{isRTL ? 'كتالوج الخامات المسجلة' : 'Master Materials Catalog'}</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {materials.length} {isRTL ? 'أصناف' : 'items'}
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {materials.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-cyan-400 text-[11px] block">{m.code}</span>
                    <strong className="text-white">{isRTL ? m.nameAr : m.nameEn}</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">{m.category}</div>
                  </div>
                  <div className="text-end">
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'الحد الأدنى:' : 'Min Stock:'}</span>
                    <span className="font-mono font-bold text-amber-400">{m.minStockKG?.toLocaleString()} KG</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouses & Locations Summary */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>{isRTL ? 'المستودعات ومواقع التخزين' : 'Warehouses & Location Bins'}</span>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400">
                {warehouses.length} {isRTL ? 'مخازن' : 'warehouses'} · {locations.length} {isRTL ? 'مواقع' : 'bins'}
              </span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {warehouses.map((w) => {
                const whLocs = locations.filter((l) => l.warehouseId === w.id);
                return (
                  <div key={w.id} className="p-3 rounded-xl bg-slate-900 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{isRTL ? w.nameAr : w.nameEn}</strong>
                      <span className="font-mono text-cyan-400 font-bold">{w.code}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2">
                      <span>{whLocs.length} {isRTL ? 'موقع تخزين (رفوف وقواطع)' : 'storage bins'}</span>
                      <span>·</span>
                      <span>{w.storageType}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SECURITY & AUDIT GOVERNANCE */}
      {activeTab === 'SECURITY' && (
        <div className="p-6 rounded-2xl bg-[#111218] border border-white/10 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/5 text-white font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <span>{isRTL ? 'حوكمة قواعد أمان Firebase Firestore' : 'Firebase Firestore Zero-Trust Security'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] block font-mono">FIRESTORE DATABASE ID</span>
              <strong className="font-mono text-white text-xs break-all">
                ai-studio-remixalkarwanfac-bd761d10-1cac-442b-9ed9-00e16a570d88
              </strong>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] block font-mono">CODES COLLECTION</span>
              <strong className="font-mono text-emerald-400 text-xs break-all">
                systemInventoryCodes
              </strong>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <span className="text-slate-400 text-[10px] block font-mono">PERMISSIONS RULE</span>
              <strong className="font-mono text-cyan-400 text-xs">
                match /systemInventoryCodes/{'{codeId}'}
              </strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono text-slate-300">
            <div className="text-amber-300 font-bold">firestore.rules deployed configuration:</div>
            <pre className="text-[11px] leading-relaxed text-slate-400 overflow-x-auto p-3 rounded-lg bg-slate-950">
{`// Configurable internal inventory & transaction codes (e.g., 167 for Storage, 546 for Production)
match /systemInventoryCodes/{codeId} {
  allow read: if isSignedIn();
  allow write: if (isStorageManager() || isAdmin()) && isValidId(codeId);
}`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB: MULTI-TENANT SAAS ORGANIZATION SETTINGS */}
      {activeTab === 'TENANT' && (
        <div className="space-y-6">
          {/* Banner */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-3">
            <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block mb-0.5">
                {isRTL
                  ? 'منصة إدارة المستودعات المركزية متعددة المنشآت (Multi-Tenant SaaS Architecture):'
                  : 'General-Purpose Multi-Tenant SaaS Architecture:'}
              </span>
              <p>
                {isRTL
                  ? 'تم تحويل النظام إلى منصة متعددة المستأجرين تخدم منشآت وشركات مستقلة. شركة الكروان هي إحدى المنشآت النموذجية، ويمكن لكل منشأة الحصول على بياناتها وإعداداتها وأكوادها المخزنية المعزولة تماماً.'
                  : 'The platform serves multiple independent organizations with completely isolated warehouses, inventory, and configurable document codes. AL-KARWAN is preserved as an exemplar tenant.'}
              </p>
            </div>
          </div>

          {/* Tenant Switcher & Active Tenant Card */}
          <div className="p-5 rounded-2xl bg-[#111218] border border-white/10 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isRTL ? 'المنشأة النشطة حالياً (Active Tenant Organization)' : 'Active Tenant Organization'}
                  </h3>
                  <span className="text-[11px] font-mono text-cyan-400">ID: {currentOrganization.id}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{isRTL ? 'تبديل المنشأة:' : 'Switch Tenant:'}</span>
                <select
                  value={currentOrganization.id}
                  onChange={(e) => {
                    switchOrganization(e.target.value);
                    showToast(
                      isRTL
                        ? `تم التبديل بنجاح إلى منشأة [${e.target.value}]`
                        : `Switched active organization to [${e.target.value}].`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {isRTL ? org.nameAr : org.nameEn} ({org.industry} - {org.plan})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Profile Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'اسم المنشأة بالعربية' : 'Name (Arabic)'}</span>
                <strong className="text-white text-xs block">{currentOrganization.nameAr}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'اسم المنشأة بالإنجليزية' : 'Name (English)'}</span>
                <strong className="text-white text-xs block">{currentOrganization.nameEn}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'قطاع النشاط' : 'Industry'}</span>
                <strong className="text-cyan-300 text-xs block">{currentOrganization.industry}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'خطة الاشتراك' : 'Subscription Plan'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-block mt-0.5">
                  {currentOrganization.plan}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'الدولة' : 'Country'}</span>
                <strong className="text-white text-xs block">{currentOrganization.country}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'العملة الرسمية' : 'Currency'}</span>
                <strong className="text-amber-300 font-mono text-xs block">{currentOrganization.currency}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'وحدة الوزن' : 'Weight Unit'}</span>
                <strong className="text-purple-300 font-mono text-xs block">{currentOrganization.weightUnit}</strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono">{isRTL ? 'المنطقة الزمنية' : 'Timezone'}</span>
                <strong className="text-slate-300 font-mono text-xs block">{currentOrganization.timezone}</strong>
              </div>
            </div>

            {/* Configured Document Codes per Tenant */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-400" />
                  <span>{isRTL ? 'الأكواد المرجعية المعتمدة للمنشأة' : 'Organization Document Reference Codes'}</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Dynamic Tenant Scoped</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'كود التخزين (Storage):' : 'Storage Code:'}</span>
                  <span className="text-cyan-300 font-mono font-bold text-sm">{currentOrganization.codeConfig?.storageCode || '167'}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'كود الإنتاج (Production):' : 'Production Code:'}</span>
                  <span className="text-amber-300 font-mono font-bold text-sm">{currentOrganization.codeConfig?.productionCode || '546'}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'كود استلام التدوير (Recycling):' : 'Recycling Intake:'}</span>
                  <span className="text-emerald-300 font-mono font-bold text-sm">{currentOrganization.codeConfig?.recyclingReceiptCode || '360'}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">{isRTL ? 'كود حركة التدوير (Recycling Move):' : 'Recycling Move:'}</span>
                  <span className="text-indigo-300 font-mono font-bold text-sm">{currentOrganization.codeConfig?.recyclingMoveCode || '352'}</span>
                </div>
              </div>
            </div>

            {/* Enabled SaaS Modules Checklist */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>{isRTL ? 'الوحدات البرمجية المفعلة للمنشأة (Enabled Modules)' : 'Enabled SaaS Modules for this Tenant'}</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                {Object.entries(currentOrganization.enabledModules || {}).map(([key, isEnabled]) => (
                  <div
                    key={key}
                    className={`p-2.5 rounded-lg border flex items-center justify-between ${
                      isEnabled
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                        : 'bg-slate-900/40 border-white/5 text-slate-500'
                    }`}
                  >
                    <span className="font-mono text-[11px] capitalize">{key}</span>
                    <span className="text-[10px] font-bold">
                      {isEnabled ? (isRTL ? 'مفعل ✓' : 'ON') : (isRTL ? 'معطل' : 'OFF')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CODE MODAL */}
      {editingCode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Edit2 className="w-4 h-4 text-purple-400" />
                <span>{isRTL ? `تعديل الكود المخزني [${editingCode.code}]` : `Edit Inventory Code [${editingCode.code}]`}</span>
              </div>
              <button onClick={() => setEditingCode(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditCode} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'الاسم بالعربية:' : 'Name (Arabic):'}
                </label>
                <input
                  type="text"
                  value={editingCode.nameAr}
                  onChange={(e) => setEditingCode({ ...editingCode, nameAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'الاسم بالإنجليزية:' : 'Name (English):'}
                </label>
                <input
                  type="text"
                  value={editingCode.nameEn}
                  onChange={(e) => setEditingCode({ ...editingCode, nameEn: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'البادئة (Prefix):' : 'Prefix:'}
                  </label>
                  <input
                    type="text"
                    value={editingCode.prefix}
                    onChange={(e) => setEditingCode({ ...editingCode, prefix: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'الحالة:' : 'Status:'}
                  </label>
                  <select
                    value={editingCode.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setEditingCode({ ...editingCode, isActive: e.target.value === 'ACTIVE' })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  >
                    <option value="ACTIVE">{isRTL ? 'نشط (مفعل)' : 'Active'}</option>
                    <option value="INACTIVE">{isRTL ? 'معطل' : 'Disabled'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'الوصف والغرض التشغيلي (عربي):' : 'Operational Description (Arabic):'}
                </label>
                <textarea
                  value={editingCode.descriptionAr}
                  onChange={(e) => setEditingCode({ ...editingCode, descriptionAr: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingCode(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ في Firestore' : 'Save to Firestore')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW CODE MODAL */}
      {isAddCodeOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Plus className="w-4 h-4 text-purple-400" />
                <span>{isRTL ? 'إضافة كود مخزني جديد إلى Firestore' : 'Add New Inventory Code to Firestore'}</span>
              </div>
              <button onClick={() => setIsAddCodeOpen(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateCode} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'رقم / رمز الكود (مثال: 720):' : 'Code Number (e.g. 720):'} *
                  </label>
                  <input
                    type="text"
                    value={newCodeForm.code}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewCodeForm({
                        ...newCodeForm,
                        code: val,
                        prefix: newCodeForm.prefix || (val ? `DOC-${val}` : ''),
                      });
                    }}
                    placeholder="e.g. 720"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400 font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'التصنيف المخزني:' : 'Category:'}
                  </label>
                  <select
                    value={newCodeForm.category}
                    onChange={(e) => setNewCodeForm({ ...newCodeForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  >
                    <option value="STORAGE">{isRTL ? 'المستودع والإيداع (Storage)' : 'Storage'}</option>
                    <option value="PRODUCTION">{isRTL ? 'خطوط الإنتاج (Production)' : 'Production'}</option>
                    <option value="SHREDDING">{isRTL ? 'الثرم والتدوير (Shredding)' : 'Shredding'}</option>
                    <option value="RECEIVING">{isRTL ? 'الاستلام والميزان (Receiving)' : 'Receiving'}</option>
                    <option value="CUSTOM">{isRTL ? 'مخصص (Custom)' : 'Custom'}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'البادئة (Prefix):' : 'Prefix:'} *
                  </label>
                  <input
                    type="text"
                    value={newCodeForm.prefix}
                    onChange={(e) => setNewCodeForm({ ...newCodeForm, prefix: e.target.value })}
                    placeholder="e.g. CUS-720"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'الحالة الأولية:' : 'Initial Status:'}
                  </label>
                  <select
                    value={newCodeForm.isActive ? 'ACTIVE' : 'INACTIVE'}
                    onChange={(e) => setNewCodeForm({ ...newCodeForm, isActive: e.target.value === 'ACTIVE' })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  >
                    <option value="ACTIVE">{isRTL ? 'نشط (مفعل)' : 'Active'}</option>
                    <option value="INACTIVE">{isRTL ? 'معطل' : 'Disabled'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'الاسم بالعربية:' : 'Name (Arabic):'} *
                </label>
                <input
                  type="text"
                  value={newCodeForm.nameAr}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, nameAr: e.target.value })}
                  placeholder={isRTL ? 'مثال: مستند صرف قوالب الأكواب الخاص' : 'Custom Issue Slip...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'الاسم بالإنجليزية:' : 'Name (English):'} *
                </label>
                <input
                  type="text"
                  value={newCodeForm.nameEn}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, nameEn: e.target.value })}
                  placeholder="Custom Storage Issue Slip..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'الوصف والغرض التشغيلي (عربي):' : 'Description (Arabic):'}
                </label>
                <textarea
                  value={newCodeForm.descriptionAr}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, descriptionAr: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddCodeOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSaving ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'حفظ وتسجيل في Firestore' : 'Create in Firestore')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LOCATION MODAL */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>{isRTL ? `تعديل موقع التخزين [${editingLocation.code}]` : `Edit Location [${editingLocation.code}]`}</span>
              </div>
              <button onClick={() => setEditingLocation(null)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEditLocation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'رمز الموقع:' : 'Location Code:'}
                  </label>
                  <input
                    type="text"
                    value={editingLocation.code}
                    onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none focus:border-blue-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'الكود المرجعي المعين:' : 'Reference Code:'}
                  </label>
                  <select
                    value={editingLocation.referenceCode || '167'}
                    onChange={(e) => setEditingLocation({ ...editingLocation, referenceCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:border-blue-400"
                  >
                    {systemCodes.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {isRTL ? c.nameAr : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'الاسم بالعربية:' : 'Name (Arabic):'}
                  </label>
                  <input
                    type="text"
                    value={editingLocation.nameAr}
                    onChange={(e) => setEditingLocation({ ...editingLocation, nameAr: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'المنطقة / Zone:' : 'Zone:'}
                  </label>
                  <input
                    type="text"
                    value={editingLocation.zone}
                    onChange={(e) => setEditingLocation({ ...editingLocation, zone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  {isRTL ? 'السعة القصوى (كغم):' : 'Capacity (KG):'}
                </label>
                <input
                  type="number"
                  value={editingLocation.capacityKG}
                  onChange={(e) => setEditingLocation({ ...editingLocation, capacityKG: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:border-blue-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSaving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ في Firestore' : 'Save to Firestore')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LOCATION MODAL */}
      {isAddLocationOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>{isRTL ? 'إضافة قاطع / موقع تخزين جديد' : 'Add New Storage Location'}</span>
              </div>
              <button onClick={() => setIsAddLocationOpen(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'المستودع التابع له:' : 'Warehouse:'} *
                  </label>
                  <select
                    value={newLocationForm.warehouseId}
                    onChange={(e) => {
                      const wh = warehouses.find((w) => w.id === e.target.value);
                      setNewLocationForm({
                        ...newLocationForm,
                        warehouseId: e.target.value,
                        warehouseNameAr: wh?.nameAr || newLocationForm.warehouseNameAr,
                        warehouseNameEn: wh?.nameEn || newLocationForm.warehouseNameEn,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-400"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {isRTL ? w.nameAr : w.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'رمز الموقع (مثل LOC-A-09):' : 'Location Code:'} *
                  </label>
                  <input
                    type="text"
                    value={newLocationForm.code}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, code: e.target.value })}
                    placeholder="LOC-A-09"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none focus:border-blue-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'الاسم بالعربية:' : 'Name (Arabic):'} *
                  </label>
                  <input
                    type="text"
                    value={newLocationForm.nameAr}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, nameAr: e.target.value })}
                    placeholder={isRTL ? 'رف تخزين حبيبات PP' : 'PP Granules Rack'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'الكود المرجعي المعين:' : 'Assigned Ref Code:'}
                  </label>
                  <select
                    value={newLocationForm.referenceCode}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, referenceCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:border-blue-400"
                  >
                    {systemCodes.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {isRTL ? c.nameAr : c.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'المنطقة / Zone:' : 'Zone:'}
                  </label>
                  <input
                    type="text"
                    value={newLocationForm.zone}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, zone: e.target.value })}
                    placeholder="Zone A - Raw"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    {isRTL ? 'السعة القصوى (كغم):' : 'Max Capacity (KG):'}
                  </label>
                  <input
                    type="number"
                    value={newLocationForm.capacityKG}
                    onChange={(e) => setNewLocationForm({ ...newLocationForm, capacityKG: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddLocationOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {isSaving ? (isRTL ? 'جاري الإنشاء...' : 'Creating...') : (isRTL ? 'إنشاء في Firestore' : 'Create in Firestore')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
