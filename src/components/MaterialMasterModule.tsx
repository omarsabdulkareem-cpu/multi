import React, { useState } from 'react';
import {
  Barcode,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Boxes,
  ShieldCheck,
  QrCode,
  Printer,
  Tag,
  Upload,
  Eye,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { MaterialItem } from '../types';
import { MaterialQrLabelModal } from './MaterialQrLabelModal';
import { BulkMaterialImportModal } from './BulkMaterialImportModal';
import { ItemDetailsViewModal } from './ItemDetailsViewModal';

export const MaterialMasterModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { materials, addMaterial, warehouses, locations } = useFactory();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedMaterialForQr, setSelectedMaterialForQr] = useState<MaterialItem | null>(null);
  const [selectedItemIdForDetails, setSelectedItemIdForDetails] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Form State
  const [form, setForm] = useState({
    code: '',
    nameAr: '',
    nameEn: '',
    category: 'PET / بولي إيثيلين تيريفثالات',
    unit: 'كغم (KG)',
    minStockLevelKG: 5000,
    maxStockLevelKG: 80000,
    requiresShredding: false,
    defaultWarehouseId: 'WH-01',
    defaultLocationId: 'LOC-A01',
    descriptionAr: '',
    descriptionEn: '',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = addMaterial({
      ...form,
      minStockLevelKG: Number(form.minStockLevelKG),
      maxStockLevelKG: Number(form.maxStockLevelKG),
    });

    if (res.success) {
      setSuccessMessage(
        isRTL ? 'تمت إضافة المادة الجديدة بنجاح إلى دليل المواد' : 'New material added to catalog.'
      );
      setShowAddModal(false);
      setForm({
        code: '',
        nameAr: '',
        nameEn: '',
        category: 'PET / بولي إيثيلين تيريفثالات',
        unit: 'كغم (KG)',
        minStockLevelKG: 5000,
        maxStockLevelKG: 80000,
        requiresShredding: false,
        defaultWarehouseId: 'WH-01',
        defaultLocationId: 'LOC-A01',
        descriptionAr: '',
        descriptionEn: '',
      });
    } else {
      setErrorMessage(res.error || 'فشلت إضافة المادة');
    }
  };

  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'SCRAP') {
      return (
        m.requiresShredding ||
        m.category.toLowerCase().includes('scrap') ||
        m.nameAr.includes('سكراب') ||
        m.code.includes('SCRAP')
      );
    }
    return (
      m.category.toUpperCase().includes(categoryFilter) ||
      m.code.toUpperCase().includes(categoryFilter)
    );
  });

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
              MATERIAL MASTER CATALOG
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'دليل وتعريف المواد والأصناف' : 'Material Master Registry'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'دليل الأصناف والمواد الصناعية' : 'Material Master Registry & Specifications'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'تعريف الخامات الأولية، السكراب، الحبيبات المثرومة، ومستويات الأمان التخزينية مع ملصقات QR لتتبع الأرضية.'
              : 'Define virgin resins, scrap, shredded regrind, safety inventory thresholds, and printable floor tracking QR labels.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-bold text-xs shadow-lg transition-all cursor-pointer"
            title={isRTL ? 'استيراد مواد بالجملة وتحديث الدليل عبر ملفات JSON أو CSV' : 'Bulk Material Import from JSON/CSV'}
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'استيراد مواد بالجملة' : 'Import Bulk Materials'}</span>
          </button>

          <button
            onClick={() => {
              setSelectedMaterialForQr(materials[0] || null);
              setShowQrModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs shadow-lg transition-all cursor-pointer"
            title={isRTL ? 'توليد وطباعة ملصقات QR للأرضية مع رقم الوجبة' : 'Generate Floor QR Labels with Batch ID'}
          >
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'طباعة ملصقات QR للأرضية' : 'Print Floor QR Labels'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? '+ تعريف صنف جديد' : '+ Add New Material'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 flex items-center justify-between gap-3 text-xs sm:text-sm shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-400 absolute top-3.5 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRTL ? 'بحث بكود الصنف، الاسم، التصنيف...' : 'Search Code, Name, Category...'}
            className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-cyan-400`}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {['ALL', 'PET', 'PP', 'PS', 'SCRAP'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat === 'ALL'
                ? isRTL ? 'كافة الأصناف' : 'All Materials'
                : cat === 'SCRAP'
                ? isRTL ? 'سكراب ومفروم' : 'Scrap & Regrind'
                : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.map((mat) => (
          <div
            key={mat.id}
            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-all shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                  {mat.code}
                </span>
                <h4 className="text-base font-black text-white mt-1.5">{isRTL ? mat.nameAr : mat.nameEn}</h4>
                <div className="text-xs text-slate-400">{isRTL ? mat.nameEn : mat.nameAr}</div>
              </div>

              {mat.requiresShredding ? (
                <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30" title="يتطلب ثرم">
                  <Flame className="w-4 h-4" />
                </span>
              ) : (
                <span className="p-1.5 rounded-lg bg-blue-950 text-blue-400 border border-blue-500/30" title="خزن مباشر">
                  <Boxes className="w-4 h-4" />
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
              {isRTL ? mat.descriptionAr : mat.descriptionEn}
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block">{isRTL ? 'الحد الأدنى:' : 'Min Stock:'}</span>
                <span className="text-slate-200 font-bold">{(mat.minStockLevelKG ?? 0).toLocaleString()} KG</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isRTL ? 'الحد الأقصى:' : 'Max Stock:'}</span>
                <span className="text-slate-200 font-bold">{(mat.maxStockLevelKG ?? 0).toLocaleString()} KG</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-300">{mat.category ? (mat.category.split('/')[0]?.trim() || mat.category) : 'General'}</span>
                <span className="text-cyan-400 font-mono font-bold">({mat.unit})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedItemIdForDetails(mat.code || mat.id);
                    setShowDetailsModal(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-bold text-xs shadow transition-all cursor-pointer"
                  title={isRTL ? 'تفاصيل الصنف وحركاته ووجباته' : 'Item Details & Stock Ledger'}
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isRTL ? 'التفاصيل' : 'Details'}</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedMaterialForQr(mat);
                    setShowQrModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  title={isRTL ? 'طباعة ملصق تتبع QR مع معرف الوجبة' : 'Print QR Tracking Label with Batch ID'}
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isRTL ? 'ملصق QR' : 'QR Label'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full rounded-2xl bg-slate-900 border border-cyan-500/50 shadow-2xl p-6 space-y-5 text-start">
            <div className="flex items-center gap-3 text-cyan-400">
              <Barcode className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-black text-white">
                  {isRTL ? 'تعريف مادة صناعية جديدة في الدليل' : 'Register New Material in Master'}
                </h3>
                <p className="text-xs text-slate-400">شركة الكروان لإنتاج الألواح والأكواب البلاستيكية</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'كود الصنف (Material Code)' : 'Material Code'} *
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="PP-HOMO-01"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'التصنيف البوليمري' : 'Category'} *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
                    required
                  >
                    <option value="PET / بولي إيثيلين تيريفثالات">PET / بولي إيثيلين تيريفثالات</option>
                    <option value="PP / بولي بروبيلين">PP / بولي بروبيلين</option>
                    <option value="PS / بولي ستايرين">PS / بولي ستايرين</option>
                    <option value="HDPE / بولي إيثيلين عالي الكثافة">HDPE / بولي إيثيلين عالي الكثافة</option>
                    <option value="LDPE / بولي إيثيلين منخفض الكثافة">LDPE / بولي إيثيلين منخفض الكثافة</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الاسم بالعربية' : 'Arabic Name'} *
                  </label>
                  <input
                    type="text"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    placeholder="حبيبات بولي بروبيلين هوموبوليمر"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الاسم بالإنجليزية' : 'English Name'} *
                  </label>
                  <input
                    type="text"
                    value={form.nameEn}
                    onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                    placeholder="PP Homopolymer Prime Granules"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'حد الأمان الأدنى (كغم)' : 'Min Safety Stock KG'} *
                  </label>
                  <input
                    type="number"
                    value={form.minStockLevelKG}
                    onChange={(e) => setForm({ ...form, minStockLevelKG: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {isRTL ? 'الحد الأقصى الاستيعابي (كغم)' : 'Max Storage KG'} *
                  </label>
                  <input
                    type="number"
                    value={form.maxStockLevelKG}
                    onChange={(e) => setForm({ ...form, maxStockLevelKG: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xs outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-400" />
                  {isRTL ? 'هل هذه المادة سكراب وتتطلب ثرم وجرش؟' : 'Requires Shredding (Therm)?'}
                </span>
                <input
                  type="checkbox"
                  checked={form.requiresShredding}
                  onChange={(e) => setForm({ ...form, requiresShredding: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 cursor-pointer"
                >
                  {isRTL ? 'حفظ الصنف بالدليل' : 'Save Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable QR Code Tracking Label Generator Modal */}
      <MaterialQrLabelModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        initialMaterial={selectedMaterialForQr}
      />

      {/* Bulk Material JSON/CSV Import & Sync Modal */}
      <BulkMaterialImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
      />

      {/* Item Details View Modal (Section 5) */}
      {selectedItemIdForDetails && (
        <ItemDetailsViewModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedItemIdForDetails(null);
          }}
          itemId={selectedItemIdForDetails}
        />
      )}
    </div>
  );
};
