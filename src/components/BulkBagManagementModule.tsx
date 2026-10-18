import React, { useState, useMemo } from 'react';
import {
  Tag,
  Search,
  Filter,
  Printer,
  QrCode,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Barcode,
  Boxes,
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  FileDown,
  CheckSquare,
  Scan,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { BulkBagQrGenerator } from './BulkBagQrGenerator';
import { BatchBulkBagLabelModal } from './BatchBulkBagLabelModal';
import { BulkBag } from '../types';

export const BulkBagManagementModule: React.FC = () => {
  const { isRTL, t } = useLanguage();
  const {
    bulkBags,
    registerBulkBag,
    updateBulkBag,
    materials,
    warehouses,
    locations,
    currentUser,
    setCurrentPage,
  } = useFactory();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [selectedBagForQr, setSelectedBagForQr] = useState<BulkBag | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBagIds, setSelectedBagIds] = useState<string[]>([]);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);

  // New Bag form state
  const [newBagForm, setNewBagForm] = useState({
    materialId: materials[0]?.id || '',
    weightKG: 1000,
    warehouseId: warehouses[0]?.id || 'WH-01',
    locationId: locations[0]?.id || 'LOC-A01',
    transactionNumber: 'TX-MANUAL-' + Date.now().toString().slice(-4),
    batchNumber: 'LOT-' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    notes: '',
  });

  // Filtered Bags
  const filteredBags = useMemo(() => {
    return bulkBags.filter((bag) => {
      const matchesSearch =
        bag.bagId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bag.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bag.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bag.locationCode && bag.locationCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (bag.transactionNumber && bag.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || bag.status === statusFilter;
      const matchesMaterial = materialFilter === 'ALL' || bag.materialId === materialFilter;

      return matchesSearch && matchesStatus && matchesMaterial;
    });
  }, [bulkBags, searchTerm, statusFilter, materialFilter]);

  // Aggregate stats
  const totalBags = bulkBags.length;
  const inStorageBags = bulkBags.filter((b) => b.status === 'IN_STORAGE').length;
  const totalWeightInStorageKG = bulkBags
    .filter((b) => b.status === 'IN_STORAGE')
    .reduce((sum, b) => sum + (b.weightKG || 0), 0);

  // Batch Selection helpers
  const toggleSelectBag = (id: string) => {
    setSelectedBagIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllFilteredSelected =
    filteredBags.length > 0 && filteredBags.every((b) => selectedBagIds.includes(b.id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredBags.map((b) => b.id));
      setSelectedBagIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const combined = new Set([...selectedBagIds, ...filteredBags.map((b) => b.id)]);
      setSelectedBagIds(Array.from(combined));
    }
  };

  const clearSelection = () => {
    setSelectedBagIds([]);
  };

  const selectedBagsForPrint = useMemo(() => {
    return bulkBags.filter((b) => selectedBagIds.includes(b.id));
  }, [bulkBags, selectedBagIds]);

  const handleCreateBag = (e: React.FormEvent) => {
    e.preventDefault();
    const mat = materials.find((m) => m.id === newBagForm.materialId);
    const loc = locations.find((l) => l.id === newBagForm.locationId);
    const wh = warehouses.find((w) => w.id === newBagForm.warehouseId);

    const res = registerBulkBag({
      materialId: newBagForm.materialId,
      materialCode: mat?.code || 'MAT-RAW',
      materialName: mat?.nameAr || 'خام بلاستيك',
      weightKG: Number(newBagForm.weightKG),
      tareKG: 2.5,
      warehouseId: newBagForm.warehouseId,
      locationId: newBagForm.locationId,
      locationCode: loc?.code || 'LOC-01',
      transactionNumber: newBagForm.transactionNumber,
      batchNumber: newBagForm.batchNumber,
      status: 'IN_STORAGE',
      createdBy: currentUser?.nameAr || currentUser?.name || 'المشرف',
      notes: newBagForm.notes,
    });

    if (res.success) {
      setShowAddModal(false);
      // Automatically open QR label modal for newly created bag
      if (res.id) {
        const created = bulkBags.find((b) => b.id === res.id) || {
          id: res.id,
          bagId: `BAG-${Date.now().toString().slice(-4)}`,
          materialId: newBagForm.materialId,
          materialCode: mat?.code || '',
          materialName: mat?.nameAr || '',
          weightKG: Number(newBagForm.weightKG),
          tareKG: 2.5,
          warehouseId: newBagForm.warehouseId,
          locationId: newBagForm.locationId,
          locationCode: loc?.code || '',
          transactionNumber: newBagForm.transactionNumber,
          batchNumber: newBagForm.batchNumber,
          status: 'IN_STORAGE' as const,
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.nameAr || currentUser?.name || 'المشرف',
        };
        setSelectedBagForQr(created);
      }
    }
  };

  const getStatusBadge = (status: BulkBag['status']) => {
    switch (status) {
      case 'IN_STORAGE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            {isRTL ? 'في المخزن' : 'In Storage'}
          </span>
        );
      case 'IN_SHREDDING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 animate-pulse">
            {isRTL ? 'قيد الثرم' : 'In Shredding'}
          </span>
        );
      case 'CONSUMED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            {isRTL ? 'مستهلك في الإنتاج' : 'Consumed'}
          </span>
        );
      case 'QUARANTINED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-500/40">
            {isRTL ? 'في الحجر / معزول' : 'Quarantined'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-cyan-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              BULK BAG (شليف) IDENTIFICATION & QR SYSTEM
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'تتبع الشلايف بالرمز الشريطي والباركود المعياري' : 'Industrial Bag Tracking'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Tag className="w-6 h-6 text-cyan-400" />
            <span>{isRTL ? 'إدارة الشلايف الفردية وطباعة بطاقات QR' : 'Bulk Bag Floor Labels & QR Center'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'توليد وطباعة ملصقات الشلايف الفردية لطابعات الباركود الحرارية، وربط كل شليف برقم المعاملة والوزن والموقع بدقة متناهية.'
              : 'Generate and print thermal floor labels with dynamic QR codes linked directly to weighing transactions and storage racks.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setCurrentPage('virtual_stock_verifier')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-400/60 text-cyan-300 hover:text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all cursor-pointer"
            title={isRTL ? 'فتح كاميرا الفحص الميداني للشلايف ومطابقة الموقع الرقمي' : 'Open Virtual Stock Verifier Camera'}
          >
            <Scan className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'فاحص ومحقق المخزون (كاميرا QR)' : 'Virtual Stock Verifier'}</span>
          </button>

          <button
            onClick={() => {
              if (selectedBagIds.length === 0) {
                // Pre-populate with all filtered bags if none are selected yet
                setSelectedBagIds(filteredBags.map((b) => b.id));
              }
              setShowBatchPrintModal(true);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              selectedBagIds.length > 0
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/50 shadow-lg shadow-emerald-950/60'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isRTL ? 'طباعة دفعة ملصقات الشلايف بصيغة PDF متعددة الصفحات' : 'Batch Print Labels as Multi-Page PDF'}
          >
            <Printer className="w-4 h-4 text-cyan-300" />
            <span>{isRTL ? 'طباعة دفعة ملصقات (Batch PDF)' : 'Batch Print Labels (PDF)'}</span>
            {selectedBagIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/20 text-white">
                {selectedBagIds.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isRTL ? 'تسجيل شليف جديد' : 'Register New Bag'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400">{isRTL ? 'إجمالي الشلايف المسجلة' : 'Total Bulk Bags'}</div>
          <div className="text-2xl font-black text-white font-mono mt-1">{totalBags}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30">
          <div className="text-xs text-emerald-400">{isRTL ? 'الشلايف بالمستودع حالياً' : 'Active In Storage'}</div>
          <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
            {inStorageBags}{' '}
            <span className="text-xs text-slate-400 font-normal">
              ({(totalWeightInStorageKG ?? 0).toLocaleString()} كغم)
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30">
          <div className="text-xs text-cyan-400">{isRTL ? 'نظام الطباعة الحرارية' : 'Thermal Print Standard'}</div>
          <div className="text-sm font-bold text-cyan-200 mt-1 flex items-center gap-1.5">
            <Printer className="w-4 h-4" />
            <span>100mm × 150mm Industrial Zebra</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isRTL
                ? 'بحث برقم الشليف (BAG-...)، اسم المادة، رقم المعاملة، أو موقع التخزين...'
                : 'Search by Bag ID, Material, Transaction #, or Location...'
            }
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
          >
            <option value="ALL">{isRTL ? 'كل الحالات' : 'All Statuses'}</option>
            <option value="IN_STORAGE">{isRTL ? 'في المخزن' : 'In Storage'}</option>
            <option value="IN_SHREDDING">{isRTL ? 'قيد الثرم' : 'In Shredding'}</option>
            <option value="CONSUMED">{isRTL ? 'مستهلك' : 'Consumed'}</option>
            <option value="QUARANTINED">{isRTL ? 'محجور' : 'Quarantined'}</option>
          </select>

          {/* Material Filter */}
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400 max-w-[200px]"
          >
            <option value="ALL">{isRTL ? 'كل المواد' : 'All Materials'}</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} - {m?.nameAr || m?.nameEn || m?.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Batch Selection Action Floating Bar */}
      {selectedBagIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950 via-slate-900 to-slate-900 border border-cyan-500/50 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm font-mono border border-cyan-500/40">
              {selectedBagIds.length}
            </span>
            <div>
              <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                <span>{isRTL ? 'تم تحديد شلايف للطباعة الجماعية' : 'Bulk Bags Selected for Batch Printing'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {isRTL ? 'جاهز للتوليد' : 'Queued'}
                </span>
              </div>
              <div className="text-xs text-cyan-300 font-mono mt-0.5">
                {isRTL ? 'إجمالي الوزن الصافي:' : 'Total Net Weight:'}{' '}
                <strong className="text-white">
                  {selectedBagsForPrint.reduce((sum, b) => sum + (b.weightKG || 0), 0).toLocaleString()}
                </strong>{' '}
                كغم (KG)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowBatchPrintModal(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-950 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isRTL ? 'توليد وطباعة ملصقات PDF' : 'Generate & Print PDF Labels'}</span>
            </button>
            <button
              onClick={clearSelection}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
            >
              {isRTL ? 'إلغاء التحديد' : 'Clear Selection'}
            </button>
          </div>
        </div>
      )}

      {/* Bulk Bags Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-bold">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                    title={isRTL ? 'تحديد كل الشلايف المعروضة / إلغاء التحديد' : 'Select / Deselect all filtered'}
                  />
                </th>
                <th className="p-3.5">{isRTL ? 'معرف الشليف (Bag ID)' : 'Bag ID'}</th>
                <th className="p-3.5">{isRTL ? 'المادة / الصنف' : 'Material'}</th>
                <th className="p-3.5">{isRTL ? 'الوزن الصافي (كغم)' : 'Net Weight (KG)'}</th>
                <th className="p-3.5">{isRTL ? 'الموقع / الرف' : 'Location Rack'}</th>
                <th className="p-3.5">{isRTL ? 'رقم المعاملة' : 'Transaction #'}</th>
                <th className="p-3.5">{isRTL ? 'الحالة' : 'Status'}</th>
                <th className="p-3.5">{isRTL ? 'تاريخ التعبئة' : 'Filled Date'}</th>
                <th className="p-3.5 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredBags.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-sm">
                    {isRTL ? 'لا توجد شلايف مطابقة للبحث' : 'No bulk bags found matching query'}
                  </td>
                </tr>
              ) : (
                filteredBags.map((bag) => {
                  const isSelected = selectedBagIds.includes(bag.id);
                  return (
                    <tr
                      key={bag.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-cyan-950/30 border-r-2 border-cyan-400'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectBag(bag.id)}
                          className="rounded border-slate-700 text-cyan-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-cyan-400">{bag.bagId}</span>
                          {bag.batchNumber && (
                            <span className="text-[10px] text-slate-500 font-mono">({bag.batchNumber})</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-white">{bag.materialName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{bag.materialCode}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {(bag.weightKG ?? 0).toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-[10px] mr-1">كغم</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-950 border border-slate-700 text-slate-300">
                          {bag.locationCode || 'LOC-01'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-slate-400">{bag.transactionNumber || 'TX-N/A'}</span>
                      </td>
                      <td className="p-3.5">{getStatusBadge(bag.status)}</td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {bag.createdAt && typeof bag.createdAt === 'string'
                          ? (bag.createdAt.includes('T') ? bag.createdAt.split('T')[0] : bag.createdAt.split(' ')[0])
                          : '2026-09-01'}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => setSelectedBagForQr(bag)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                          title="View & Print Label"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{isRTL ? 'بطاقة الملصق (QR)' : 'QR Label'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Label Modal */}
      {selectedBagForQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl">
            <BulkBagQrGenerator
              bag_id={selectedBagForQr.bagId}
              material_name={selectedBagForQr.materialName}
              material_code={selectedBagForQr.materialCode}
              weight_kg={selectedBagForQr.weightKG}
              transaction_number={selectedBagForQr.transactionNumber}
              location_code={selectedBagForQr.locationCode}
              date={
                selectedBagForQr.createdAt && typeof selectedBagForQr.createdAt === 'string'
                  ? (selectedBagForQr.createdAt.includes('T') ? selectedBagForQr.createdAt.split('T')[0] : selectedBagForQr.createdAt.split(' ')[0])
                  : undefined
              }
              tare_kg={selectedBagForQr.tareKG || 2.5}
              onClose={() => setSelectedBagForQr(null)}
            />
          </div>
        </div>
      )}

      {/* Manual Registration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'تسجيل شليف صناعي جديد' : 'Register New Bulk Bag'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBag} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'المادة / الخامة:' : 'Material:'}
                </label>
                <select
                  value={newBagForm.materialId}
                  onChange={(e) => setNewBagForm({ ...newBagForm, materialId: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-cyan-400"
                  required
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {m?.nameAr || m?.nameEn || m?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'الوزن الصافي (كغم):' : 'Net Weight (KG):'}
                  </label>
                  <input
                    type="number"
                    value={newBagForm.weightKG}
                    onChange={(e) => setNewBagForm({ ...newBagForm, weightKG: Number(e.target.value) })}
                    min="1"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'موقع الرف / العزل:' : 'Storage Location:'}
                  </label>
                  <select
                    value={newBagForm.locationId}
                    onChange={(e) => setNewBagForm({ ...newBagForm, locationId: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-cyan-400"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} ({l?.nameAr || l?.warehouseNameAr || ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'رقم المعاملة / الدفتر:' : 'Transaction #:'}
                  </label>
                  <input
                    type="text"
                    value={newBagForm.transactionNumber}
                    onChange={(e) => setNewBagForm({ ...newBagForm, transactionNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    {isRTL ? 'رقم الوجبة / التشغيلة:' : 'Batch / Lot #:'}
                  </label>
                  <input
                    type="text"
                    value={newBagForm.batchNumber}
                    onChange={(e) => setNewBagForm({ ...newBagForm, batchNumber: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'ملاحظات المشرف:' : 'Supervisor Notes:'}
                </label>
                <input
                  type="text"
                  value={newBagForm.notes}
                  onChange={(e) => setNewBagForm({ ...newBagForm, notes: e.target.value })}
                  placeholder={isRTL ? 'حالة الشليف، نظافة الخام، التالف...' : 'Condition, purity, notes...'}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-950 cursor-pointer"
                >
                  {isRTL ? 'حفظ وتوليد الرمز الشريطي' : 'Save & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Print Labels Modal */}
      <BatchBulkBagLabelModal
        bags={selectedBagsForPrint}
        isOpen={showBatchPrintModal}
        onClose={() => setShowBatchPrintModal(false)}
      />
    </div>
  );
};
