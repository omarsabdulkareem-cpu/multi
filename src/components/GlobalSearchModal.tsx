import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Truck,
  Flame,
  Factory,
  Boxes,
  Users,
  ScrollText,
  Barcode,
  ArrowUpRight,
  Filter,
  Warehouse,
  ClipboardList,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { NavigationPage } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { t, isRTL } = useLanguage();
  const {
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    productionOrders,
    materials,
    suppliers,
    warehouses,
    locations,
    inventoryMovements,
    setCurrentPage,
    setSelectedTransactionId,
  } = useFactory();

  const [query, setQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'RECEIVING' | 'SHREDDING' | 'PRODUCTION' | 'MATERIALS' | 'SUPPLIERS' | 'STORAGE'>('ALL');

  interface SearchResultItem {
    id: string;
    type: 'RECEIVING' | 'SHREDDING' | 'PRODUCTION' | 'MATERIAL' | 'SUPPLIER' | 'LOCATION';
    title: string;
    subtitle: string;
    code: string;
    badge: string;
    badgeColor: string;
    targetPage: NavigationPage;
    targetId: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const list: SearchResultItem[] = [];

    // Search Receiving
    if (selectedFilter === 'ALL' || selectedFilter === 'RECEIVING') {
      receivingTransactions.forEach((r) => {
        if (
          r.transactionNumber.toLowerCase().includes(q) ||
          r.legacyDocumentNumber.toLowerCase().includes(q) ||
          r.materialName.toLowerCase().includes(q) ||
          r.materialCode.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.vehiclePlate.toLowerCase().includes(q) ||
          r.driverName.toLowerCase().includes(q)
        ) {
          list.push({
            id: r.id,
            type: 'RECEIVING',
            title: `${r.transactionNumber} - ${r.materialName}`,
            subtitle: `${r.supplierName} | ${r.vehiclePlate} | ${r.netReceivedWeightKG || r.scaleInWeightKG} كغم (${r.bulkBagsCount} شليف)`,
            code: r.legacyDocumentNumber ? `مستند 546: ${r.legacyDocumentNumber}` : r.transactionNumber,
            badge: r.status,
            badgeColor: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
            targetPage: 'receiving',
            targetId: r.id,
            icon: Truck,
          });
        }
      });
    }

    // Search Shredding
    if (selectedFilter === 'ALL' || selectedFilter === 'SHREDDING') {
      shreddingTransactions.forEach((s) => {
        if (
          s.shreddingNumber.toLowerCase().includes(q) ||
          s.legacyDocumentNumber.toLowerCase().includes(q) ||
          s.materialName.toLowerCase().includes(q) ||
          s.materialCode.toLowerCase().includes(q) ||
          s.machineId.toLowerCase().includes(q) ||
          s.operator.toLowerCase().includes(q)
        ) {
          list.push({
            id: s.id,
            type: 'SHREDDING',
            title: `${s.shreddingNumber} (الثرم) - ${s.materialName}`,
            subtitle: `مدخلات: ${s.inputKG} كغم | مخرجات: ${s.outputKG} كغم | تالف إنتاج: ${s.productionDamageKG} كغم`,
            code: `مستند 360/352: ${s.legacyDocumentNumber}`,
            badge: s.status,
            badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
            targetPage: 'shredding',
            targetId: s.id,
            icon: Flame,
          });
        }
      });
    }

    // Search Production Issues
    if (selectedFilter === 'ALL' || selectedFilter === 'PRODUCTION') {
      productionIssues.forEach((p) => {
        if (
          p.issueNumber.toLowerCase().includes(q) ||
          p.legacyDocumentNumber.toLowerCase().includes(q) ||
          p.productionOrderNumber.toLowerCase().includes(q) ||
          p.materialName.toLowerCase().includes(q) ||
          p.machineLine.toLowerCase().includes(q)
        ) {
          list.push({
            id: p.id,
            type: 'PRODUCTION',
            title: `${p.issueNumber} - صادر مواد للإنتاج`,
            subtitle: `${p.machineLine} | أمر: ${p.productionOrderNumber} | الكمية: ${p.quantityKG} كغم (${p.bulkBagsCount} شليف)`,
            code: `مستند 167: ${p.legacyDocumentNumber}`,
            badge: p.status,
            badgeColor: 'bg-purple-950 text-purple-300 border-purple-500/40',
            targetPage: 'production',
            targetId: p.id,
            icon: Factory,
          });
        }
      });
    }

    // Search Production Orders
    if (selectedFilter === 'ALL' || selectedFilter === 'PRODUCTION') {
      productionOrders.forEach((po) => {
        if (
          po.orderNumber.toLowerCase().includes(q) ||
          po.productName.toLowerCase().includes(q) ||
          (po.requiredMaterialName && po.requiredMaterialName.toLowerCase().includes(q)) ||
          po.machineLine.toLowerCase().includes(q) ||
          po.supervisor.toLowerCase().includes(q)
        ) {
          list.push({
            id: po.id,
            type: 'PRODUCTION',
            title: `${po.orderNumber} - أمر إنتاج ${po.productName}`,
            subtitle: `خط: ${po.machineLine} | المخطط: ${po.plannedQuantityKG.toLocaleString()} كغم | المنجز: ${po.actualProducedKG.toLocaleString()} كغم | الهالك: ${po.actualDamageKG.toLocaleString()} كغم`,
            code: po.orderNumber,
            badge: po.status,
            badgeColor: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
            targetPage: 'production',
            targetId: po.id,
            icon: ClipboardList,
          });
        }
      });
    }

    // Search Materials
    if (selectedFilter === 'ALL' || selectedFilter === 'MATERIALS') {
      materials.forEach((m) => {
        if (
          (m.code && m.code.toLowerCase().includes(q)) ||
          (m.nameAr && m.nameAr.toLowerCase().includes(q)) ||
          (m.nameEn && m.nameEn.toLowerCase().includes(q)) ||
          (m.category && m.category.toLowerCase().includes(q))
        ) {
          list.push({
            id: m.id,
            type: 'MATERIAL',
            title: m.nameAr,
            subtitle: `${m.category || ''} | الوحدة: ${m.unit || 'KG'} | يتطلب ثرم: ${m.requiresShredding ? 'نعم' : 'لا'}`,
            code: m.code,
            badge: m.category ? m.category.split('/')[0].trim() : 'خامة',
            badgeColor: 'bg-blue-950 text-blue-300 border-blue-500/40',
            targetPage: 'material_card',
            targetId: m.id,
            icon: Barcode,
          });
        }
      });
    }

    // Search Warehouses and Storage Locations
    if (selectedFilter === 'ALL' || selectedFilter === 'STORAGE') {
      warehouses.forEach((w) => {
        if (
          w.code.toLowerCase().includes(q) ||
          w.nameAr.toLowerCase().includes(q) ||
          w.nameEn.toLowerCase().includes(q)
        ) {
          list.push({
            id: w.id,
            type: 'LOCATION',
            title: `مستودع: ${w.nameAr}`,
            subtitle: `الرمز: ${w.code} | النوع: ${w.type} | السعة: ${w.capacityKG.toLocaleString()} كغم`,
            code: w.code,
            badge: w.type,
            badgeColor: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
            targetPage: 'storage',
            targetId: w.id,
            icon: Warehouse,
          });
        }
      });

      locations.forEach((loc) => {
        if (
          loc.code.toLowerCase().includes(q) ||
          loc.nameAr.toLowerCase().includes(q) ||
          loc.warehouseNameAr.toLowerCase().includes(q)
        ) {
          list.push({
            id: loc.id,
            type: 'LOCATION',
            title: `موقع تخزين: ${loc.nameAr} (${loc.code})`,
            subtitle: `المستودع: ${loc.warehouseNameAr} | السعة: ${loc.capacityKG.toLocaleString()} كغم (${loc.capacityBags} شليف)`,
            code: loc.code,
            badge: loc.zone || 'موقع',
            badgeColor: 'bg-teal-950 text-teal-300 border-teal-500/40',
            targetPage: 'storage',
            targetId: loc.id,
            icon: Boxes,
          });
        }
      });
    }

    // Search Suppliers
    if (selectedFilter === 'ALL' || selectedFilter === 'SUPPLIERS') {
      suppliers.forEach((s) => {
        if (
          s.code.toLowerCase().includes(q) ||
          s.nameAr.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q)
        ) {
          list.push({
            id: s.id,
            type: 'SUPPLIER',
            title: s.nameAr,
            subtitle: `مسؤول الاتصال: ${s.contactPerson || ''} | هاتف: ${s.phone || ''} | إجمالي التوريدات: ${(s.totalKGDelivered ?? 0).toLocaleString()} كغم`,
            code: s.code,
            badge: s.status,
            badgeColor: 'bg-amber-950 text-amber-300 border-amber-500/40',
            targetPage: 'suppliers',
            targetId: s.id,
            icon: Users,
          });
        }
      });
    }

    return list;
  }, [
    query,
    selectedFilter,
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    productionOrders,
    materials,
    suppliers,
    warehouses,
    locations,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-4 sm:p-6 md:p-12 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-950/60">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isRTL
                ? 'ابحث بالرقم، أو مستند (546, 167, 360, 352)، أو المادة، المورد، الشاحنة، الشلايف...'
                : 'Search by Ref, Legacy Doc (546, 167, 360, 352), Material, Supplier, Plate...'
            }
            autoFocus
            className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm sm:text-base outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            ESC
          </button>
        </div>

        {/* Filter Badges */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {[
            { id: 'ALL', labelAr: 'الكل', labelEn: 'All' },
            { id: 'RECEIVING', labelAr: 'استلام وميزان (546)', labelEn: 'Receiving (546)' },
            { id: 'SHREDDING', labelAr: 'الثرم (360/352)', labelEn: 'Shredding (360/352)' },
            { id: 'PRODUCTION', labelAr: 'الإنتاج (أوامر وصرف 167)', labelEn: 'Production (167)' },
            { id: 'MATERIALS', labelAr: 'دليل المواد', labelEn: 'Materials' },
            { id: 'STORAGE', labelAr: 'المستودعات والمواقع', labelEn: 'Storage & Locations' },
            { id: 'SUPPLIERS', labelAr: 'الموردين', labelEn: 'Suppliers' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id as any)}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedFilter === f.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? f.labelAr : f.labelEn}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm">
                {isRTL
                  ? 'اكتب أي كلمة للبحث في كافة سجلات ومعاملات مصنع الكروان'
                  : 'Type any keyword to search across all factory records'}
              </p>
              <div className="flex justify-center gap-2 text-xs font-mono text-cyan-400">
                <span>RCV-2026</span> • <span>546</span> • <span>167</span> • <span>360</span> • <span>PET Flakes</span>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <p className="text-sm text-slate-300">
                {isRTL ? 'لم يتم العثور على نتائج مطابقة' : 'No matching records found'}
              </p>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تأكد من كتابة الرقم أو اسم المادة بشكل صحيح' : 'Check spelling or try a different keyword'}
              </p>
            </div>
          ) : (
            results.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    setSelectedTransactionId(item.targetId);
                    setCurrentPage(item.targetPage);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/40 text-start transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0 group-hover:border-cyan-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{item.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">
                          {item.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{results.length} {isRTL ? 'نتيجة مطابقة' : 'results found'}</span>
          <div className="flex items-center gap-3">
            <span>{isRTL ? 'اضغط Enter للانتقال' : 'Press Enter to view'}</span>
            <span>•</span>
            <span>ESC {isRTL ? 'للإغلاق' : 'to close'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
