import React, { useState, useMemo } from 'react';
import {
  Layers,
  MapPin,
  Boxes,
  Zap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
  Maximize2,
  RotateCcw,
  ShieldCheck,
  Activity,
  ChevronRight,
  ExternalLink,
  Flame,
  Truck,
  Filter,
  Eye,
  Sliders,
  Scale,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { getStoredMachines, FactoryMachine } from '../services/maintenanceService';
import { INITIAL_LOCATIONS } from '../services/initialData';

// Physical machine mapping definition
export interface FloorPlanMachineNode {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  type: 'SHREDDER_PRIMARY' | 'SHREDDER_SECONDARY' | 'EXTRUDER' | 'THERMOFORMING';
  x: number;
  y: number;
  width: number;
  height: number;
  inputLocationCode: string;
  outputLocationCode: string;
  assignedTechnician: string;
  feedRatePerHourKG: number;
  sectionAr: string;
  sectionEn: string;
}

export const WarehouseFloorPlanMap: React.FC<{
  onSelectLocation?: (locationId: string) => void;
  className?: string;
}> = ({ onSelectLocation, className = '' }) => {
  const { isRTL } = useLanguage();
  const {
    warehouses,
    locations,
    inventoryBalances,
    materials,
    currentUser,
    setCurrentPage,
  } = useFactory();

  // Load real machine telemetry
  const storedMachines = useMemo(() => getStoredMachines(), []);
  const shredder360Machine = storedMachines.find((m) => m.code === 'SHR-360');

  // Interactive selection state
  const [selectedZoneId, setSelectedZoneId] = useState<string>('LOC-THM01'); // Default to Shredding Input Bay
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'OCCUPANCY' | 'MATERIALS' | 'SHREDDER_FLOW'>('OCCUPANCY');
  const [facilityFilter, setFacilityFilter] = useState<'ALL' | 'WH-01' | 'WH-02' | 'WH-03' | 'WH-04'>('ALL');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showFlowAnimation, setShowFlowAnimation] = useState<boolean>(true);

  // Physical machines positioned on the factory floor plan
  const machines: FloorPlanMachineNode[] = useMemo(
    () => [
      {
        id: 'MCH-SHR-01',
        code: 'SHR-360',
        nameAr: 'مفرمة ومجرشة الحبيبات والبلاستيك 360 (الرئيسية)',
        nameEn: 'Heavy Granulator & Shredder 360 (Primary)',
        type: 'SHREDDER_PRIMARY',
        x: 485,
        y: 250,
        width: 140,
        height: 90,
        inputLocationCode: 'LOC-THM-IN',
        outputLocationCode: 'LOC-THM-OUT',
        assignedTechnician: shredder360Machine?.assignedTechnician || 'Karrar Mansoor',
        feedRatePerHourKG: 850,
        sectionAr: 'وحدة الثرم والجرش رقم 1 (المستودع 02)',
        sectionEn: 'Shredding & Regrind Bay 1 (WH-02)',
      },
      {
        id: 'MCH-SHR-02',
        code: 'SHR-180',
        nameAr: 'مجرشة الهوالك الثانوية وسكراب الحواف 180',
        nameEn: 'Auxiliary Edge-Trim Granulator 180',
        type: 'SHREDDER_SECONDARY',
        x: 485,
        y: 360,
        width: 140,
        height: 75,
        inputLocationCode: 'LOC-THM-IN',
        outputLocationCode: 'LOC-THM-OUT',
        assignedTechnician: 'Mustafa Jabbar',
        feedRatePerHourKG: 420,
        sectionAr: 'خط استرجاع هوالك الثرم السريع',
        sectionEn: 'Rapid Scrap Regrind Line',
      },
      {
        id: 'MCH-EXT-01',
        code: 'EXT-01',
        nameAr: 'خط بثق الألواح البلاستيكية 01',
        nameEn: 'Sheet Extrusion Line 01',
        type: 'EXTRUDER',
        x: 770,
        y: 190,
        width: 150,
        height: 80,
        inputLocationCode: 'LOC-FEED-01',
        outputLocationCode: 'LOC-ROLL-R1',
        assignedTechnician: 'Hassan Al-Tamimi',
        feedRatePerHourKG: 1100,
        sectionAr: 'صالة البثق الرئيسية A',
        sectionEn: 'Extrusion Hall A',
      },
    ],
    [shredder360Machine]
  );

  // Map zone geometric coordinates to real `WarehouseLocation` items
  const floorZones = useMemo(() => {
    return locations.map((loc) => {
      // Find actual materials in this location
      const locBalances = inventoryBalances.filter((b) => b.locationId === loc.id && b.currentKG > 0);
      const totalKG = locBalances.reduce((sum, b) => sum + b.currentKG, 0) || loc.currentKG;
      const totalBags = locBalances.reduce((sum, b) => sum + (b.bulkBagsCount || 0), 0) || loc.bulkBagsCount;
      const occupancyPct = Math.min(100, Math.round((totalKG / loc.capacityKG) * 100));

      // Define SVG Coordinates (Canvas 1050 x 580)
      let coords = { x: 50, y: 100, width: 140, height: 95 };

      switch (loc.code) {
        // Warehouse 01: Raw Warehouse (Left Side)
        case 'LOC-A-01':
          coords = { x: 40, y: 140, width: 150, height: 90 };
          break;
        case 'LOC-A-02':
          coords = { x: 210, y: 140, width: 150, height: 90 };
          break;
        case 'LOC-B-01':
          coords = { x: 40, y: 250, width: 150, height: 85 };
          break;
        case 'LOC-B-02':
          coords = { x: 210, y: 250, width: 150, height: 85 };
          break;
        case 'LOC-HIMMA':
          coords = { x: 40, y: 355, width: 320, height: 90 };
          break;

        // Warehouse 02: Shredding & Regrind Bay (Center)
        case 'LOC-THM-IN':
          coords = { x: 460, y: 120, width: 190, height: 100 };
          break;
        case 'LOC-THM-OUT':
          coords = { x: 460, y: 460, width: 190, height: 95 };
          break;

        // Warehouse 03: Production Buffer (Right Center)
        case 'LOC-FEED-01':
          coords = { x: 740, y: 290, width: 190, height: 100 };
          break;

        // Warehouse 04: Roll Store & Finished Goods (Right Bottom)
        case 'LOC-ROLL-R1':
          coords = { x: 740, y: 415, width: 190, height: 100 };
          break;

        default:
          coords = { x: 740, y: 120, width: 190, height: 85 };
      }

      // Check relation to shredder machines
      const isShredderFeed = loc.code === 'LOC-THM-IN';
      const isShredderOutput = loc.code === 'LOC-THM-OUT';
      const isShredderRelated = isShredderFeed || isShredderOutput || loc.warehouseId === 'WH-02';

      return {
        ...loc,
        totalKG,
        totalBags,
        occupancyPct,
        coords,
        locBalances,
        isShredderFeed,
        isShredderOutput,
        isShredderRelated,
      };
    });
  }, [locations, inventoryBalances]);

  // Selected Zone Details
  const activeZone = useMemo(() => {
    const found = floorZones.find((z) => z.id === selectedZoneId) || floorZones[0];
    if (found) return found;
    if (INITIAL_LOCATIONS[0]) {
      return {
        ...INITIAL_LOCATIONS[0],
        totalKG: 0,
        totalBags: 0,
        occupancyPct: 0,
        coords: { x: 50, y: 100, width: 140, height: 95 },
        locBalances: [],
        isShredderFeed: false,
        isShredderOutput: false,
        isShredderRelated: false,
      };
    }
    return null;
  }, [floorZones, selectedZoneId]);

  // Selected Machine Details (if machine clicked)
  const activeMachine = useMemo(() => {
    if (!selectedMachineId) return null;
    return machines.find((m) => m.id === selectedMachineId) || null;
  }, [machines, selectedMachineId]);

  // Total Factory Occupancy Stats
  const factoryMetrics = useMemo(() => {
    const totalCapacity = floorZones.reduce((sum, z) => sum + z.capacityKG, 0);
    const totalOccupied = floorZones.reduce((sum, z) => sum + z.totalKG, 0);
    const totalBags = floorZones.reduce((sum, z) => sum + z.totalBags, 0);
    const avgOccupancy = Math.round((totalOccupied / totalCapacity) * 100);

    const highOccupancyZones = floorZones.filter((z) => z.occupancyPct >= 80).length;
    const shreddingBufferKG = floorZones
      .filter((z) => z.warehouseId === 'WH-02')
      .reduce((sum, z) => sum + z.totalKG, 0);

    return {
      totalCapacity,
      totalOccupied,
      totalBags,
      avgOccupancy,
      highOccupancyZones,
      shreddingBufferKG,
    };
  }, [floorZones]);

  // Color helper based on occupancy
  const getOccupancyColor = (pct: number) => {
    if (pct >= 85) return { fill: 'rgba(244, 63, 94, 0.25)', stroke: '#f43f5e', text: '#fda4af' }; // Rose
    if (pct >= 65) return { fill: 'rgba(245, 158, 11, 0.22)', stroke: '#f59e0b', text: '#fcd34d' }; // Amber
    if (pct >= 30) return { fill: 'rgba(6, 182, 212, 0.20)', stroke: '#06b6d4', text: '#67e8f9' }; // Cyan
    return { fill: 'rgba(16, 185, 129, 0.18)', stroke: '#10b981', text: '#6ee7b7' }; // Emerald
  };

  const handleZoneClick = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setSelectedMachineId(null);
    if (onSelectLocation) onSelectLocation(zoneId);
  };

  const handleMachineClick = (machineId: string) => {
    setSelectedMachineId(machineId);
  };

  return (
    <div
      id="factory-floor-plan-map-section"
      className={`rounded-2xl bg-gradient-to-b from-[#13151f] via-[#10121a] to-[#0c0d14] border border-cyan-500/25 p-5 sm:p-6 shadow-2xl relative overflow-hidden transition-all duration-300 scroll-mt-6 ${className}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background HUD Ambience */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP HEADER & HUD BAR */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              FACILITY VISUAL FLOOR PLAN
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
              PHYSICAL MACHINERY MAPPING
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {isRTL ? 'خريطة المستودعات ومحطات الثرم' : 'Interactive Zones & Shredder Units'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>
              {isRTL
                ? 'مخطط أرضية المصنع: ربط مواقع التخزين بماكينات الثرم والجرش'
                : 'Interactive Factory Floor Plan & Shredder Machinery Mapping'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isRTL
              ? 'معاينة مكانية فورية لمواقع التخزين، سعة الشلايف، ونسب الإشغال المتصلة بماكينة الثرم 360 وخطوط الإنتاج'
              : 'Click any storage zone or shredder station to inspect real-time occupancy, material composition, and mechanical transit flows'}
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Facility Filter */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-white/10 text-xs font-semibold">
            {(['ALL', 'WH-01', 'WH-02', 'WH-03', 'WH-04'] as const).map((fid) => (
              <button
                key={fid}
                onClick={() => setFacilityFilter(fid)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  facilityFilter === fid
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fid === 'ALL'
                  ? isRTL
                    ? 'الكل'
                    : 'All'
                  : fid === 'WH-01'
                  ? isRTL
                    ? 'الخامات (01)'
                    : 'Raw (01)'
                  : fid === 'WH-02'
                  ? isRTL
                    ? 'الثرم (02)'
                    : 'Shred (02)'
                  : fid === 'WH-03'
                  ? isRTL
                    ? 'الإنتاج (03)'
                    : 'Feed (03)'
                  : isRTL
                  ? 'الرولات (04)'
                  : 'Rolls (04)'}
              </button>
            ))}
          </div>

          {/* View Mode */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => setViewMode('OCCUPANCY')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'OCCUPANCY'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'نسب الإشغال' : 'Occupancy'}
            </button>
            <button
              onClick={() => setViewMode('SHREDDER_FLOW')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'SHREDDER_FLOW'
                  ? 'bg-amber-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'مسارات الثرم' : 'Shred Flow'}
            </button>
          </div>

          {/* Toggle Flow Animation */}
          <button
            onClick={() => setShowFlowAnimation((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              showFlowAnimation
                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-500 border-white/10 hover:text-slate-300'
            }`}
            title={isRTL ? 'تشغيل أو إيقاف وميض تدفق المواد' : 'Toggle Flow Animation'}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'حركة التدفق' : 'Flow Pulse'}</span>
          </button>

          {/* Reset Zoom */}
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isRTL ? 'إعادة ضبط العرض' : 'Reset View'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. STATS STRIP BANNER */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 my-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'متوسط إشغال المصنع:' : 'Overall Occupancy:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-xl font-bold font-mono ${
                factoryMetrics.avgOccupancy > 80
                  ? 'text-rose-400'
                  : factoryMetrics.avgOccupancy > 60
                  ? 'text-amber-400'
                  : 'text-cyan-400'
              }`}
            >
              {factoryMetrics.avgOccupancy}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            {(factoryMetrics.totalOccupied / 1000).toFixed(1)} / {(factoryMetrics.totalCapacity / 1000).toFixed(1)} Tons
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'إجمالي الشلايف المخزنة:' : 'Bulk Bags On Floor:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-amber-300">
              {factoryMetrics.totalBags}
            </span>
            <span className="text-xs text-amber-400/80 font-mono">{isRTL ? 'شليف' : 'Bags'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            {isRTL ? 'موزعة على 8 عنابر تخزين' : 'Across 8 storage bays'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'رصيد مخزن الثرم (02):' : 'Shredding Bay Buffer:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-cyan-300">
              {(factoryMetrics.shreddingBufferKG / 1000).toFixed(1)}
            </span>
            <span className="text-xs text-cyan-400 font-mono">Tons</span>
          </div>
          <span className="text-[10px] text-cyan-400/80 font-mono block">
            {isRTL ? 'جاهز للتغذية والجرش' : 'Ready for granulator'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'حالة ماكينة الثرم (360):' : 'Shredder 360 Status:'}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                shredder360Machine?.status === 'MAINTENANCE_DUE'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400'
              }`}
            />
            <span
              className={`text-xs font-mono font-bold ${
                shredder360Machine?.status === 'MAINTENANCE_DUE'
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}
            >
              {shredder360Machine?.status === 'MAINTENANCE_DUE'
                ? isRTL
                  ? 'موعد صيانة مستحق'
                  : 'MNT DUE'
                : isRTL
                ? 'تعمل بكفاءة'
                : 'RUNNING'}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            {shredder360Machine?.currentOperatingHours || 1515} / {shredder360Machine?.maintenanceThresholdHours || 1500} hrs
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'عنابر عالية الكثافة (>80%):' : 'High Occupancy Bays:'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-rose-300">
              {factoryMetrics.highOccupancyZones}
            </span>
            <span className="text-xs text-rose-400 font-mono">{isRTL ? 'عنبر' : 'Bays'}</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono block">
            {isRTL ? 'تتطلب نقل أو سحب سريع' : 'Action recommended'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-mono block">
            {isRTL ? 'المشرف المسؤول:' : 'Floor Supervisor:'}
          </span>
          <div className="text-xs font-bold text-white mt-1 truncate">
            {isRTL ? 'عمر عبدالكريم' : 'Omar Abdulkarim'}
          </div>
          <span className="text-[10px] text-emerald-400 font-mono block">
            {isRTL ? 'التحكم العام نشط' : 'Control Active'}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 3. VISUAL INTERACTIVE FLOOR PLAN MAP (SVG CANVAS) */}
      {/* --------------------------------------------------------------------- */}
      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-5 mt-2">
        {/* SVG Floor Plan Canvas Container (8 cols on XL) */}
        <div className="xl:col-span-8 bg-[#090b10] border border-white/10 rounded-2xl p-3 sm:p-4 overflow-hidden relative shadow-inner flex flex-col justify-between">
          {/* Subtle Top Blueprint Grid Info */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>AL-KARWAN RECYCLING & PACKAGING COMPLEX - FACILITY BLUEPRINT</span>
            </div>
            <div className="flex items-center gap-3">
              <span>SCALE: 1:150</span>
              <span className="text-cyan-400 font-bold">GRID: ACTIVE</span>
            </div>
          </div>

          {/* Interactive SVG Canvas */}
          <div className="w-full overflow-x-auto py-2">
            <svg
              viewBox="0 0 1020 580"
              className="w-full min-w-[760px] h-auto select-none"
              style={{ maxHeight: '560px' }}
            >
              {/* Background Grid Pattern */}
              <defs>
                <pattern id="floor-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                </pattern>

                <linearGradient id="shredderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.4" />
                </linearGradient>

                <linearGradient id="conveyorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.7" />
                  <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.7" />
                </linearGradient>

                {/* Marker Arrows */}
                <marker id="flowArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                </marker>
                <marker id="shredArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                </marker>
              </defs>

              <rect width="1020" height="580" fill="url(#floor-grid)" />

              {/* ------------------------------------------------------------- */}
              {/* FACILITY BOUNDARY REGIONS */}
              {/* ------------------------------------------------------------- */}
              {/* WH-01 Raw Materials Region */}
              <rect
                x="20"
                y="90"
                width="360"
                height="470"
                rx="14"
                fill="rgba(15, 23, 42, 0.6)"
                stroke={facilityFilter === 'WH-01' ? '#06b6d4' : 'rgba(255,255,255,0.1)'}
                strokeWidth={facilityFilter === 'WH-01' ? '2.5' : '1.5'}
                strokeDasharray={facilityFilter === 'WH-01' ? 'none' : '4 4'}
              />
              <text x="35" y="118" fill="#94a3b8" fontSize="12" fontWeight="bold" fontFamily="monospace">
                WH-01: RAW MATERIALS INGRESS & STORAGE (مستودع الخامات رقم 1)
              </text>

              {/* WH-02 Shredding & Regrind Bay (Center) */}
              <rect
                x="420"
                y="70"
                width="270"
                height="490"
                rx="14"
                fill="rgba(30, 27, 46, 0.6)"
                stroke={facilityFilter === 'WH-02' ? '#f59e0b' : 'rgba(245, 158, 11, 0.4)'}
                strokeWidth={facilityFilter === 'WH-02' ? '3' : '2'}
              />
              <text x="435" y="98" fill="#fcd34d" fontSize="12" fontWeight="bold" fontFamily="monospace">
                WH-02: SHREDDING & REGRIND DEPT (وحدة ومخزن الثرم 2)
              </text>

              {/* WH-03 Production & Buffer (Right) */}
              <rect
                x="715"
                y="70"
                width="285"
                height="290"
                rx="14"
                fill="rgba(15, 30, 35, 0.6)"
                stroke={facilityFilter === 'WH-03' ? '#10b981' : 'rgba(16, 185, 129, 0.3)'}
                strokeWidth={facilityFilter === 'WH-03' ? '2.5' : '1.5'}
              />
              <text x="730" y="98" fill="#6ee7b7" fontSize="12" fontWeight="bold" fontFamily="monospace">
                WH-03: PRODUCTION FEED & EXTRUSION (الإنتاج والبثق 3)
              </text>

              {/* WH-04 Roll Store (Right Bottom) */}
              <rect
                x="715"
                y="380"
                width="285"
                height="180"
                rx="14"
                fill="rgba(24, 24, 35, 0.6)"
                stroke={facilityFilter === 'WH-04' ? '#a855f7' : 'rgba(168, 85, 247, 0.3)'}
                strokeWidth={facilityFilter === 'WH-04' ? '2.5' : '1.5'}
              />
              <text x="730" y="408" fill="#d8b4fe" fontSize="12" fontWeight="bold" fontFamily="monospace">
                WH-04: ROLL STORE & FINISHED COILS (بيت الرولات 4)
              </text>

              {/* Main Weighbridge Gate Scale 546 (Top Left Ingress) */}
              <g transform="translate(30, 20)">
                <rect x="0" y="0" width="220" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
                <Truck x="10" y="15" width="20" height="20" color="#38bdf8" />
                <text x="38" y="24" fill="#ffffff" fontSize="11" fontWeight="bold">
                  MAIN INGRESS WEIGHBRIDGE (ميزان 546)
                </text>
                <text x="38" y="40" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                  Electronic Scale 80T - Doc 546 Direct Inflow
                </text>
              </g>

              {/* ------------------------------------------------------------- */}
              {/* MATERIAL FLOW PATHWAYS (CONVEYORS & FORKLIFT ROUTES) */}
              {/* ------------------------------------------------------------- */}
              {/* Pathway 1: Raw WH-01 to Shredding Input Bay LOC-THM-IN */}
              <path
                d="M 360 185 L 460 170"
                fill="none"
                stroke="#06b6d4"
                strokeWidth="3"
                strokeDasharray={showFlowAnimation ? '6 4' : 'none'}
                markerEnd="url(#flowArrow)"
                className={showFlowAnimation ? 'animate-pulse' : ''}
              />
              <text x="375" y="165" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">
                SCRAP FORKLIFT
              </text>

              {/* Pathway 2: LOC-THM-IN directly into Shredder Machine 360 */}
              <path
                d="M 555 220 L 555 250"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="4"
                strokeDasharray={showFlowAnimation ? '4 2' : 'none'}
                markerEnd="url(#shredArrow)"
              />

              {/* Pathway 3: Shredder Machine 360 output to Clean Regrind Bay LOC-THM-OUT */}
              <path
                d="M 555 340 L 555 460"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray={showFlowAnimation ? '4 2' : 'none'}
                markerEnd="url(#flowArrow)"
              />
              <text x="562" y="405" fill="#34d399" fontSize="9" fontWeight="bold" fontFamily="monospace">
                CLEAN REGRIND (مفروم جاهز)
              </text>

              {/* Pathway 4: Pneumatic Transfer from LOC-THM-OUT to WH-03 LOC-FEED-01 */}
              <path
                d="M 650 500 L 700 500 L 700 340 L 740 340"
                fill="none"
                stroke="#a855f7"
                strokeWidth="3"
                strokeDasharray={showFlowAnimation ? '8 4' : 'none'}
                markerEnd="url(#flowArrow)"
              />
              <text x="685" y="440" fill="#c084fc" fontSize="9" fontWeight="bold" fontFamily="monospace" transform="rotate(-90 685 440)">
                PNEUMATIC LINE (خط سحب هوائي)
              </text>

              {/* Pathway 5: Extruder to Roll Store */}
              <path
                d="M 845 270 L 845 290"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeDasharray="4 2"
              />

              {/* ------------------------------------------------------------- */}
              {/* STORAGE ZONES (CLICKABLE FLOOR PLAN RECTANGLES) */}
              {/* ------------------------------------------------------------- */}
              {floorZones.map((zone) => {
                const isSelected = selectedZoneId === zone.id;
                const colors = getOccupancyColor(zone.occupancyPct);
                const isDimmed = facilityFilter !== 'ALL' && zone.warehouseId !== facilityFilter;

                return (
                  <g
                    key={zone.id}
                    onClick={() => handleZoneClick(zone.id)}
                    className="cursor-pointer transition-all duration-200 group"
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    {/* Outer Zone Box */}
                    <rect
                      x={zone.coords.x}
                      y={zone.coords.y}
                      width={zone.coords.width}
                      height={zone.coords.height}
                      rx="10"
                      fill={colors.fill}
                      stroke={isSelected ? '#ffffff' : colors.stroke}
                      strokeWidth={isSelected ? '3' : '1.5'}
                      className="group-hover:stroke-white transition-all shadow-lg"
                    />

                    {/* Active Selected Reticle Glow */}
                    {isSelected && (
                      <rect
                        x={zone.coords.x - 3}
                        y={zone.coords.y - 3}
                        width={zone.coords.width + 6}
                        height={zone.coords.height + 6}
                        rx="13"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        className="animate-spin"
                        style={{ transformOrigin: `${zone.coords.x + zone.coords.width / 2}px ${zone.coords.y + zone.coords.height / 2}px` }}
                      />
                    )}

                    {/* Zone Code & Badge */}
                    <text
                      x={zone.coords.x + 10}
                      y={zone.coords.y + 20}
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {zone.code}
                    </text>

                    {/* Shredder Connection Badge if applicable */}
                    {zone.isShredderFeed && (
                      <g transform={`translate(${zone.coords.x + zone.coords.width - 70}, ${zone.coords.y + 6})`}>
                        <rect width="64" height="16" rx="4" fill="#f59e0b" />
                        <text x="32" y="11" fill="#000" fontSize="8" fontWeight="bold" textAnchor="middle">
                          SHRED FEED
                        </text>
                      </g>
                    )}
                    {zone.isShredderOutput && (
                      <g transform={`translate(${zone.coords.x + zone.coords.width - 70}, ${zone.coords.y + 6})`}>
                        <rect width="64" height="16" rx="4" fill="#10b981" />
                        <text x="32" y="11" fill="#000" fontSize="8" fontWeight="bold" textAnchor="middle">
                          CLEAN REG
                        </text>
                      </g>
                    )}

                    {/* Zone Name */}
                    <text
                      x={zone.coords.x + 10}
                      y={zone.coords.y + 36}
                      fill="#cbd5e1"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {isRTL ? (zone.nameAr?.slice(0, 22) || zone.nameEn || zone.code) : (zone.nameEn?.slice(0, 22) || zone.code)}
                    </text>

                    {/* Occupancy Progress Bar */}
                    <rect
                      x={zone.coords.x + 10}
                      y={zone.coords.y + 44}
                      width={zone.coords.width - 20}
                      height="6"
                      rx="3"
                      fill="rgba(255,255,255,0.1)"
                    />
                    <rect
                      x={zone.coords.x + 10}
                      y={zone.coords.y + 44}
                      width={Math.max(4, ((zone.coords.width - 20) * zone.occupancyPct) / 100)}
                      height="6"
                      rx="3"
                      fill={colors.stroke}
                    />

                    {/* Weight & Bags Metrics */}
                    <text
                      x={zone.coords.x + 10}
                      y={zone.coords.y + 64}
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {(zone.totalKG ?? 0).toLocaleString()} <tspan fill="#94a3b8" fontSize="9">KG</tspan>
                    </text>

                    <text
                      x={zone.coords.x + zone.coords.width - 10}
                      y={zone.coords.y + 64}
                      fill={colors.text}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {zone.occupancyPct}%
                    </text>

                    {/* Bags Count */}
                    <text
                      x={zone.coords.x + 10}
                      y={zone.coords.y + 78}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {zone.totalBags} / {zone.maxBags} {isRTL ? 'شليف' : 'Bags'}
                    </text>
                  </g>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* PHYSICAL SHREDDING & PROCESSING MACHINERY STATIONS */}
              {/* ------------------------------------------------------------- */}
              {machines.map((machine) => {
                const isSelected = selectedMachineId === machine.id;
                const isShredder = machine.type.includes('SHREDDER');
                const machineTelemetry = storedMachines.find((m) => m.code === machine.code);
                const isDue = machineTelemetry?.status === 'MAINTENANCE_DUE';

                return (
                  <g
                    key={machine.id}
                    onClick={() => handleMachineClick(machine.id)}
                    className="cursor-pointer transition-all duration-200 group"
                  >
                    {/* Machine Base Station Body */}
                    <rect
                      x={machine.x}
                      y={machine.y}
                      width={machine.width}
                      height={machine.height}
                      rx="12"
                      fill={isShredder ? 'rgba(245, 158, 11, 0.25)' : 'rgba(6, 182, 212, 0.25)'}
                      stroke={
                        isSelected
                          ? '#ffffff'
                          : isDue
                          ? '#f59e0b'
                          : isShredder
                          ? '#d97706'
                          : '#0891b2'
                      }
                      strokeWidth={isSelected ? '3' : '2'}
                      className="group-hover:stroke-white transition-all shadow-xl"
                    />

                    {/* Rotary Machine Mechanical Icon Badge */}
                    <circle
                      cx={machine.x + 24}
                      cy={machine.y + 24}
                      r="14"
                      fill={isShredder ? '#f59e0b' : '#06b6d4'}
                    />
                    <Zap
                      x={machine.x + 16}
                      y={machine.y + 16}
                      width="16"
                      height="16"
                      color="#000"
                    />

                    {/* Machine Code */}
                    <text
                      x={machine.x + 44}
                      y={machine.y + 22}
                      fill="#ffffff"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {machine.code}
                    </text>

                    {/* Status Pill */}
                    <rect
                      x={machine.x + machine.width - 48}
                      y={machine.y + 12}
                      width="40"
                      height="16"
                      rx="4"
                      fill={isDue ? '#ef4444' : '#10b981'}
                    />
                    <text
                      x={machine.x + machine.width - 28}
                      y={machine.y + 23}
                      fill="#ffffff"
                      fontSize="8"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {isDue ? 'MNT' : 'RUN'}
                    </text>

                    {/* Name */}
                    <text
                      x={machine.x + 10}
                      y={machine.y + 48}
                      fill="#fcd34d"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {isRTL ? (machine.nameAr?.slice(0, 18) || machine.code) : (machine.nameEn?.slice(0, 18) || machine.code)}
                    </text>

                    {/* Telemetry / Throughput */}
                    <text
                      x={machine.x + 10}
                      y={machine.y + 64}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {isRTL ? 'القدرة:' : 'Rate:'} <tspan fill="#ffffff" fontWeight="bold">{machine.feedRatePerHourKG} KG/h</tspan>
                    </text>

                    {/* Mechanical Link Pointer */}
                    <text
                      x={machine.x + 10}
                      y={machine.y + 78}
                      fill="#38bdf8"
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      FEED ➔ REG
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Interactive Legend */}
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                {isRTL ? 'مفتاح الخريطة:' : 'Floor Legend:'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500" />
                <span>{isRTL ? 'إشغال طبيعي (<65%)' : 'Normal (<65%)'}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                <span className="w-2.5 h-2.5 rounded bg-amber-500/30 border border-amber-500" />
                <span>{isRTL ? 'متوسط (65-85%)' : 'Moderate (65-85%)'}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-500" />
                <span>{isRTL ? 'ممتلئ (>85%)' : 'Critical (>85%)'}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
                <span>{isRTL ? 'محطة ثرم ميكانيكية' : 'Shredding Machinery'}</span>
              </span>
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              {isRTL ? '💡 انقر فوق أي عنبر أو ماكينة ثرم لعرض بيانات الإشغال والتدفق' : '💡 Click any bay or shredder to inspect telemetry & material flow'}
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* 4. SELECTED ZONE OR MACHINE TELEMETRY INSPECTION DRAWER (4 cols on XL) */}
        {/* ------------------------------------------------------------------- */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Machine Telemetry Card (If a machine is clicked) */}
          {activeMachine ? (
            <div className="bg-gradient-to-b from-amber-950/40 via-slate-900 to-[#10121a] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <Zap className="w-5 h-5 fill-amber-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                        {activeMachine.code}
                      </span>
                      <span className="text-xs text-amber-400 font-semibold font-mono">
                        PHYSICAL STATION
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {activeMachine ? (isRTL ? (activeMachine.nameAr || activeMachine.nameEn) : (activeMachine.nameEn || activeMachine.nameAr)) : ''}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Machinery Links to Storage Bays */}
              <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  {isRTL ? 'الربط الميكانيكي مع عنابر التخزين:' : 'Storage Bay Mechanical Mapping:'}
                </span>

                <div className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-white/5">
                  <span className="text-slate-400">{isRTL ? 'عنبر التغذية (مدخلات):' : 'Feed Inflow Bay:'}</span>
                  <button
                    onClick={() => {
                      const z = floorZones.find((f) => f.code === activeMachine.inputLocationCode);
                      if (z) handleZoneClick(z.id);
                    }}
                    className="text-cyan-300 hover:text-white underline font-bold"
                  >
                    {activeMachine.inputLocationCode}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-mono p-2 rounded-lg bg-white/5">
                  <span className="text-slate-400">{isRTL ? 'عنبر الاستلام (مخرجات مجروشة):' : 'Regrind Discharge Bay:'}</span>
                  <button
                    onClick={() => {
                      const z = floorZones.find((f) => f.code === activeMachine.outputLocationCode);
                      if (z) handleZoneClick(z.id);
                    }}
                    className="text-emerald-300 hover:text-white underline font-bold"
                  >
                    {activeMachine.outputLocationCode}
                  </button>
                </div>
              </div>

              {/* Telemetry Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-sans">{isRTL ? 'معدل الثرم الساعي:' : 'Feed Rate:'}</span>
                  <div className="text-white font-bold text-sm">{activeMachine.feedRatePerHourKG} KG/hr</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-sans">{isRTL ? 'الفني المعين:' : 'Assigned Tech:'}</span>
                  <div className="text-amber-300 font-semibold text-xs truncate">{activeMachine.assignedTechnician}</div>
                </div>
              </div>

              {/* Maintenance Status if SHR-360 */}
              {shredder360Machine && (
                <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      {isRTL ? 'حالة العداد والتشغيل:' : 'Meter & Maintenance:'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                      {shredder360Machine.currentOperatingHours} / {shredder360Machine.maintenanceThresholdHours} hrs
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {isRTL
                      ? 'ماكينة الثرم 360 تعمل ضمن صالة الجرش المستودع 2، تم تسجيل تجاوز طفيف يتطلب فحص الشفرات وتشحيم المحامل.'
                      : 'Shredder 360 is actively linked to WH-02 bays with scheduled inspection required.'}
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage('maintenance')}
                  className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'فتح سجلات الصيانة للماكينة' : 'Open Maintenance Module'}</span>
                </button>
              </div>
            </div>
          ) : null}

          {/* Storage Zone Occupancy Card */}
          <div className="bg-[#11131a] border border-cyan-500/30 rounded-2xl p-5 shadow-2xl space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                        {activeZone?.code || '---'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {activeZone?.warehouseId || '---'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {activeZone ? (isRTL ? (activeZone.nameAr || activeZone.nameEn) : (activeZone.nameEn || activeZone.nameAr)) : ''}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {activeZone ? (isRTL ? activeZone.warehouseNameAr : activeZone.warehouseNameEn) : ''} ({activeZone?.zone || ''})
                    </p>
                  </div>
                </div>

                {/* Status Indicator */}
                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border ${
                    activeZone.occupancyPct >= 85
                      ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                      : activeZone.occupancyPct >= 65
                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {activeZone.occupancyPct}% {isRTL ? 'إشغال' : 'Full'}
                </span>
              </div>

              {/* Primary Occupancy Gauges */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">{isRTL ? 'الوزن الحالي المخزن:' : 'Current Stored Weight:'}</span>
                  <div className="flex items-baseline gap-1 font-mono">
                    <span className="text-xl font-bold text-white">
                      {(activeZone.totalKG ?? 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">/ {(activeZone.capacityKG ?? 0).toLocaleString()} KG</span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      activeZone.occupancyPct >= 85
                        ? 'bg-rose-500'
                        : activeZone.occupancyPct >= 65
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${activeZone.occupancyPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'الشلايف:' : 'Bags:'}</span>
                    <span className="text-amber-400 font-bold">{activeZone.totalBags} / {activeZone.maxBags}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isRTL ? 'المتبقي:' : 'Available:'}</span>
                    <span className="text-emerald-400 font-bold">
                      {Math.max(0, activeZone.capacityKG - activeZone.totalKG).toLocaleString()} KG
                    </span>
                  </div>
                </div>
              </div>

              {/* Physical Relation to Shredder 360 */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/20 space-y-1.5">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block font-mono">
                  {isRTL ? 'الارتباط الميكانيكي مع ماكينة الثرم 360:' : 'Physical Link to Shredder 360:'}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeZone.code === 'LOC-THM-IN'
                    ? isRTL
                      ? 'عنبر التغذية المباشر لمفرمة الثرم 360 عبر رافعة شوكية وحزام السير الناقل (مسافة 12 متر).'
                      : 'Direct feed staging for Shredder 360 via mechanical conveyor and forklift (12m distance).'
                    : activeZone.code === 'LOC-THM-OUT'
                    ? isRTL
                      ? 'محطة استلام وتفريغ المجروش النظيف الناتج عن ماكينة الثرم 360، متصلة بنظام السحب الهوائي.'
                      : 'Regrind collection bay receiving granulated output from Shredder 360, piped to pneumatic suction line.'
                    : activeZone.warehouseId === 'WH-01'
                    ? isRTL
                      ? 'مستودع الخامات الرئيسي: يتم نقل السكراب والهوالك منه عبر المسار الميكانيكي إلى عنبر مدخلات الثرم.'
                      : 'Raw ingress store: Supplies baled scrap & sheet trims to Shredder 360 input bay via transit corridor.'
                    : isRTL
                    ? 'محطة استهلاك لاحقة تستقبل حبيبات ومفروم الثرم لخلطها مع الخامات البكر في خطوط الإنتاج.'
                    : 'Downstream production station receiving regrind blend for sheet extrusion line.'}
                </p>
              </div>

              {/* Material Inventory in this Zone */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">
                    {isRTL ? 'المواد المخزنة في هذا العنبر:' : 'Materials in this Bay:'}
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {activeZone.locBalances.length} {isRTL ? 'أصناف' : 'Types'}
                  </span>
                </div>

                {activeZone.locBalances.length > 0 ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {activeZone.locBalances.map((bal, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white text-[11px]">
                            {isRTL ? bal.materialNameAr : bal.materialNameEn}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{bal.materialCode}</div>
                        </div>
                        <div className="text-end font-mono">
                          <span className="text-cyan-300 font-bold">{(bal.currentKG ?? 0).toLocaleString()} KG</span>
                          <div className="text-[10px] text-amber-400">{bal.bulkBagsCount} {isRTL ? 'شليف' : 'Bags'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-center text-xs text-slate-500 font-mono">
                    {isRTL ? 'لا توجد شلايف حالياً في هذا العنبر (فارغ)' : 'Bay is currently empty'}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => setCurrentPage('storage')}
                className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? 'إدارة المستودع' : 'Manage Storage'}</span>
              </button>

              <button
                onClick={() => setCurrentPage('shredding')}
                className="flex-1 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isRTL ? 'صرف للثرم (360)' : 'Feed Shredder'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
