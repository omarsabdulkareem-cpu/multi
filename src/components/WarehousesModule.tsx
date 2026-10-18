import React, { useState } from 'react';
import {
  Warehouse as WarehouseIcon,
  Boxes,
  MapPin,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  User,
  Scan,
  Clock,
  Radio,
  Building2,
  LayoutGrid,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { WarehouseFloorPlanMap } from './WarehouseFloorPlanMap';
import { QrBatchScannerModal } from './QrBatchScannerModal';
import { BatchLifecycleModal } from './BatchLifecycleModal';
import { UniversalWarehouseEngineModule } from './UniversalWarehouseEngineModule';

export const WarehousesModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { warehouses, locations, inventoryBalances, users, setCurrentPage } = useFactory();

  // Mode: Universal Multi-Tenant Engine vs Visual Floor Plan
  const [viewMode, setViewMode] = useState<'ENGINE' | 'FLOOR_PLAN'>('ENGINE');

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(warehouses[0]?.id || 'WH-01');

  // QR Scanning and Batch Lifecycle States
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [lifecycleBatchPayload, setLifecycleBatchPayload] = useState<any>(null);
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);

  const activeWarehouse = warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];
  const activeLocations = locations.filter((l) => l.warehouseId === activeWarehouse?.id);

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Top View Mode Switcher Header */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <WarehouseIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {isRTL ? 'إدارة المستودعات المركزية (Universal WMS)' : 'Universal Warehouse Management'}
            </h2>
            <p className="text-xs text-slate-400">
              {isRTL
                ? 'التبديل بين محرك إدارة المستودعات متعدد المنشآت والخريطة التفاعلية للأرضيات'
                : 'Switch between multi-tenant warehouse engine and interactive floor map'}
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setViewMode('ENGINE')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
              viewMode === 'ENGINE'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{isRTL ? 'محرك المستودعات الشامل' : 'Universal WMS Engine'}</span>
          </button>
          <button
            onClick={() => setViewMode('FLOOR_PLAN')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
              viewMode === 'FLOOR_PLAN'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>{isRTL ? 'خريطة المستودع والرفوف (Floor Plan)' : 'Visual Floor Plan & Racks'}</span>
          </button>
        </div>
      </div>

      {viewMode === 'ENGINE' ? (
        <UniversalWarehouseEngineModule />
      ) : (
        <>
          {/* Header */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
                  WAREHOUSES & STORAGE ZONES
                </span>
                <span className="text-xs text-slate-400">
                  {isRTL ? 'إدارة المستودعات والرفوف وسعة الشلايف' : 'Storage Facilities & Rack Grid'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isRTL ? 'مستودعات المصنع ومواقع التخزين والرفوف' : 'Factory Warehouses & Rack Inventory Map'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                {isRTL
                  ? 'توزيع المستودعات، نسب الإشغال، مواقع الشلايف، وفريق إدارة وأمناء المخازن.'
                  : 'Warehouse capacity tracking, bulk bag placement, and assigned storekeepers.'}
              </p>
            </div>

            {/* Action Button & Staff Assignment Summary */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <button
                onClick={() => setIsQrScannerOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/60 cursor-pointer transition-all border border-cyan-400/40"
                title={isRTL ? 'مسح رمز QR للشلايف والمستودع بالكاميرا' : 'Scan bulk bag or warehouse QR with camera'}
              >
                <Scan className="w-4 h-4 text-cyan-200 animate-pulse" />
                <span>{isRTL ? 'مسح QR للمخازن والوجبات (كاميرا)' : 'Scan Warehouse QR (Camera)'}</span>
              </button>

              <button
                onClick={() => setCurrentPage('rfid_tracking')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-950/60 cursor-pointer transition-all border border-amber-400/40"
                title={isRTL ? 'تتبع آلي لحركات الطبالي والشلايف عبر بوابات RFID دون خط رؤية' : 'Automated bulk asset tracking via RFID portals without line-of-sight'}
              >
                <Radio className="w-4 h-4 text-amber-200 animate-pulse" />
                <span>{isRTL ? 'بوابات وتتبع RFID للطبالي' : 'Bulk RFID Pallet Tracking'}</span>
              </button>

              <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'المشرف العام للتحكم' : 'General Control Supervisor'}</div>
                  <div className="font-bold text-cyan-300 text-xs">{isRTL ? 'عمر عبدالكريم' : 'Omar Abdulkarim'}</div>
                </div>
              </div>

              <div className="px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-500/30 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">{isRTL ? 'مدير المخزن العام' : 'Warehouse Manager'}</div>
                  <div className="font-bold text-white text-xs">{isRTL ? 'أحمد خليل' : 'Ahmed Khalil'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Visual Floor Plan Component */}
          <WarehouseFloorPlanMap
            onSelectLocation={(locId) => {
              const loc = locations.find((l) => l.id === locId);
              if (loc) setSelectedWarehouseId(loc.warehouseId);
            }}
          />

      {/* Warehouse Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.map((wh) => {
          const whLocations = locations.filter((l) => l.warehouseId === wh.id);
          const currentKG = whLocations.reduce((sum, l) => sum + l.currentKG, 0);
          const totalBags = whLocations.reduce((sum, l) => sum + l.bulkBagsCount, 0);
          const pct = Math.min(100, Math.round((currentKG / wh.totalCapacityKG) * 100));
          const isSelected = selectedWarehouseId === wh.id;

          return (
            <button
              key={wh.id}
              onClick={() => setSelectedWarehouseId(wh.id)}
              className={`p-4 rounded-2xl border text-start transition-all cursor-pointer shadow-xl relative overflow-hidden ${
                isSelected
                  ? 'bg-blue-950/80 border-cyan-400 hud-glow-cyan'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {wh.code}
                </span>
                <span className="text-xs font-mono font-bold text-white">{pct}%</span>
              </div>

              <h4 className="font-bold text-white text-sm">{isRTL ? wh.nameAr : wh.nameEn}</h4>
              
              {/* Storekeeper and Manager Badges */}
              <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    {isRTL ? 'أمين المخزن:' : 'Storekeeper:'}
                  </span>
                  <span className="font-semibold text-amber-300">
                    {isRTL ? (wh.storekeeperAr || wh.storekeeper || 'غير محدد') : (wh.storekeeper || wh.storekeeperAr || 'Unassigned')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>{isRTL ? 'مدير المخزن:' : 'Manager:'}</span>
                  <span className="font-medium text-slate-300">
                    {isRTL ? (wh.managerAr || wh.manager) : wh.manager}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      pct > 85 ? 'bg-rose-500' : pct > 65 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                  <span>{(currentKG ?? 0).toLocaleString()} KG</span>
                  <span className="text-amber-400 font-bold">{totalBags} {isRTL ? 'شليف' : 'Bags'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Racks & Locations Grid inside Selected Warehouse */}
      {activeWarehouse && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-cyan-400" />
                <span>
                  {isRTL
                    ? `مواقع التخزين والرفوف: ${activeWarehouse.nameAr}`
                    : `Storage Racks & Locations: ${activeWarehouse.nameEn}`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">{activeLocations.length} {isRTL ? 'موقع تخزين مسجل' : 'Registered Locations'}</p>
            </div>

            <div className="flex items-center gap-3 text-xs bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <div className="text-slate-400">
                {isRTL ? 'أمين المخزن المسؤول:' : 'Assigned Storekeeper:'}
              </div>
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>{isRTL ? (activeWarehouse.storekeeperAr || activeWarehouse.storekeeper) : activeWarehouse.storekeeper}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLocations.map((loc) => {
              const locPct = Math.min(100, Math.round((loc.currentKG / loc.capacityKG) * 100));
              return (
                <div
                  key={loc.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      {loc.code}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">{locPct}%</span>
                  </div>

                  <div>
                    <h5 className="font-bold text-white text-xs">{isRTL ? loc.nameAr : loc.nameEn}</h5>
                    <p className="text-[11px] text-slate-400">{isRTL ? 'المواد المسموحة:' : 'Allowed:'} {loc.materialTypesAllowed.join(', ')}</p>
                  </div>

                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        locPct > 85 ? 'bg-rose-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${locPct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-300 font-mono">
                    <span>{(loc.currentKG ?? 0).toLocaleString()} / {(loc.capacityKG ?? 0).toLocaleString()} KG</span>
                    <span className="text-amber-400 font-bold">{loc.bulkBagsCount} {isRTL ? 'شليف' : 'Bags'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Code Camera Scanner Modal */}
      <QrBatchScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        moduleContext="WAREHOUSE"
        onOpenBatchLifecycle={(payload) => {
          setLifecycleBatchPayload(payload);
          setIsLifecycleModalOpen(true);
        }}
      />

      {/* Batch Lifecycle Modal */}
      {isLifecycleModalOpen && (
        <BatchLifecycleModal
          isOpen={isLifecycleModalOpen}
          onClose={() => {
            setIsLifecycleModalOpen(false);
            setLifecycleBatchPayload(null);
          }}
          batchId={lifecycleBatchPayload?.batchId}
          bagId={lifecycleBatchPayload?.bagId}
          transactionNumber={lifecycleBatchPayload?.transactionNumber}
          materialId={lifecycleBatchPayload?.materialId}
          initialData={lifecycleBatchPayload}
        />
      )}
        </>
      )}
    </div>
  );
};
