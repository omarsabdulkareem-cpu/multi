import React, { useState, useMemo, useEffect } from 'react';
import {
  Radio,
  Wifi,
  Layers,
  ArrowRight,
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Plus,
  Play,
  Cpu,
  ShieldCheck,
  Zap,
  BarChart3,
  Clock,
  Tag,
  Warehouse as WarehouseIcon,
  Volume2,
  VolumeX,
  Sparkles,
  ChevronRight,
  MoveRight,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  RfidTrackingService,
  INITIAL_RFID_PORTALS,
} from '../services/rfidTrackingService';
import {
  RfidPortal,
  RfidPalletLoad,
  RfidBulkMovementEvent,
  BulkBag,
} from '../types';

export const RfidBulkTrackingModule: React.FC = () => {
  const { isRTL, t } = useLanguage();
  const {
    bulkBags,
    materials,
    warehouses,
    locations,
    inventoryMovements,
    currentUser,
    executeRfidBulkMovement,
  } = useFactory();

  // Mode Selection: Portal Transit vs Handheld vs Pallet Management
  const [activeTab, setActiveTab] = useState<'PORTAL_GATES' | 'HANDHELD_SWEEP' | 'PALLET_MANAGER' | 'EVENT_LOG'>('PORTAL_GATES');

  // Portals and Pallets State
  const [portals] = useState<RfidPortal[]>(INITIAL_RFID_PORTALS);
  const [selectedPortalId, setSelectedPortalId] = useState<string>(portals[0].id);
  const [pallets, setPallets] = useState<RfidPalletLoad[]>(() => {
    return RfidTrackingService.getPalletLoads(bulkBags, materials);
  });
  const [recentEvents, setRecentEvents] = useState<RfidBulkMovementEvent[]>(() => {
    return RfidTrackingService.getMovementEvents();
  });

  // Transit Simulation State
  const [selectedPalletId, setSelectedPalletId] = useState<string>('');
  const [isSimulatingTransit, setIsSimulatingTransit] = useState(false);
  const [transitScanResult, setTransitScanResult] = useState<{
    detectedTags: { epc: string; assetId: string; assetNameAr: string; weightKG: number; rssi: number }[];
    totalDetectedWeightKG: number;
    readDurationMs: number;
    readRatePct: number;
  } | null>(null);
  const [transitSuccessMsg, setTransitSuccessMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Handheld Scanner State
  const [handheldLocation, setHandheldLocation] = useState<string>('LOC-A-01');
  const [isHandheldScanning, setIsHandheldScanning] = useState(false);
  const [handheldResults, setHandheldResults] = useState<{
    matchedPallets: RfidPalletLoad[];
    detectedBags: BulkBag[];
    averageRSSI: number;
    sweepTimestamp: string;
  } | null>(null);

  // Pallet Creation Modal State
  const [showCreatePalletModal, setShowCreatePalletModal] = useState(false);
  const [newPalletMaterialId, setNewPalletMaterialId] = useState<string>(materials[0]?.id || 'MAT-01');
  const [selectedBagNumbersForNewPallet, setSelectedBagNumbersForNewPallet] = useState<string[]>([]);
  const [newPalletLocation, setNewPalletLocation] = useState<string>('LOC-A-01');

  // Currently selected portal
  const activePortal = useMemo(() => {
    return portals.find((p) => p.id === selectedPortalId) || portals[0];
  }, [portals, selectedPortalId]);

  // Available pallets that match the source location or can transit through the active portal
  const eligiblePallets = useMemo(() => {
    return pallets.filter((p) => p.status !== 'DELIVERED_TO_ZONE');
  }, [pallets]);

  // Audio chirp feedback for zero-line-of-sight RFID read
  const playRfidBeep = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime); // High pitch RF burst tone
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      // Audio fallback
    }
  };

  // Trigger automated Forklift / Pallet passage through RFID Portal Gate
  const handleTriggerPortalPassage = async () => {
    const pallet = pallets.find((p) => p.palletId === selectedPalletId) || eligiblePallets[0];
    if (!pallet) return;

    setIsSimulatingTransit(true);
    setTransitScanResult(null);
    setTransitSuccessMsg(null);

    // Audio burst simulation
    playRfidBeep();
    setTimeout(() => playRfidBeep(), 70);
    setTimeout(() => playRfidBeep(), 140);

    setTimeout(async () => {
      const scanResult = RfidTrackingService.simulatePortalPassage(activePortal, pallet, bulkBags);
      setTransitScanResult(scanResult);

      // Execute bulk inventory movement in FactoryContext
      const moveRes = await executeRfidBulkMovement({
        portalId: activePortal.id,
        portalNameAr: activePortal.nameAr,
        portalNameEn: activePortal.nameEn,
        palletId: pallet.palletId,
        palletRfidTag: pallet.palletRfidTag,
        bagIds: pallet.bagIds,
        toWarehouseId: activePortal.warehouseToId,
        toLocationCode: activePortal.locationToCode,
        notes: `التقاط لاسلكي مؤتمت عبر ${activePortal.code} بمعدل إشارة ${scanResult.detectedTags[0]?.rssi || -48} dBm`,
        trackingMethod: 'RFID_PORTAL',
      });

      // Update pallet's location and status
      const updatedPallets = pallets.map((p) => {
        if (p.palletId === pallet.palletId) {
          return {
            ...p,
            currentWarehouseId: activePortal.warehouseToId,
            currentLocationCode: activePortal.locationToCode,
            status: 'DELIVERED_TO_ZONE' as const,
            lastMovementAt: new Date().toISOString(),
          };
        }
        return p;
      });
      setPallets(updatedPallets);
      RfidTrackingService.savePalletLoads(updatedPallets);

      // Record event in log
      const newEvent: RfidBulkMovementEvent = {
        id: `EVT-${Date.now()}`,
        movementNumber: moveRes.movementId,
        timestamp: new Date().toISOString(),
        portalId: activePortal.id,
        portalNameAr: activePortal.nameAr,
        portalNameEn: activePortal.nameEn,
        palletId: pallet.palletId,
        palletRfidTag: pallet.palletRfidTag,
        detectedTagsCount: scanResult.detectedTags.length,
        tagsList: scanResult.detectedTags,
        materialId: pallet.materialId,
        materialCode: pallet.materialCode,
        materialNameAr: pallet.materialNameAr,
        totalKG: pallet.totalWeightKG,
        totalBags: pallet.bulkBagsCount,
        fromWarehouseId: activePortal.warehouseFromId,
        fromLocationCode: activePortal.locationFromCode,
        toWarehouseId: activePortal.warehouseToId,
        toLocationCode: activePortal.locationToCode,
        direction: 'INTERNAL_TRANSFER',
        operator: currentUser?.nameAr || currentUser?.name || 'مستشعر بوابة RFID',
        status: 'CONFIRMED',
      };

      const updatedEvents = [newEvent, ...recentEvents];
      setRecentEvents(updatedEvents);
      RfidTrackingService.saveMovementEvents(updatedEvents);

      setIsSimulatingTransit(false);
      setTransitSuccessMsg(moveRes.messageAr);
    }, 450);
  };

  // Handheld 360-degree sweep
  const handleRunHandheldSweep = () => {
    setIsHandheldScanning(true);
    playRfidBeep();
    setTimeout(() => {
      const result = RfidTrackingService.simulateHandheldSweep(handheldLocation, bulkBags, pallets);
      setHandheldResults(result);
      setIsHandheldScanning(false);
    }, 600);
  };

  // Create new tagged pallet
  const handleCreatePalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBagNumbersForNewPallet.length === 0) return;

    const chosenBags = bulkBags.filter((b) => selectedBagNumbersForNewPallet.includes(b.bagNumber || b.id));
    const mat = materials.find((m) => m.id === newPalletMaterialId) || materials[0];
    const totalKG = chosenBags.reduce((s, b) => s + (b.weightKG || 1000), 0);
    const newPalletId = `PLT-${Math.floor(8410 + Math.random() * 900)}`;

    const newPallet: RfidPalletLoad = {
      palletId: newPalletId,
      palletRfidTag: RfidTrackingService.generateEpcTag('PLT', newPalletId),
      descriptionAr: `طبلية أكياس شليف [${mat?.nameAr || 'خام'}]`,
      descriptionEn: `Bulk Bag Pallet [${mat?.code || 'RAW'}]`,
      materialId: mat?.id || 'MAT-01',
      materialCode: mat?.code || 'PP-01',
      materialNameAr: mat?.nameAr || 'خام بلاستيكي',
      bagIds: selectedBagNumbersForNewPallet,
      totalWeightKG: totalKG,
      bulkBagsCount: selectedBagNumbersForNewPallet.length,
      currentWarehouseId: 'WH-01',
      currentLocationCode: newPalletLocation,
      status: 'READY_IN_RACK',
      createdAt: new Date().toISOString(),
    };

    const nextPallets = [newPallet, ...pallets];
    setPallets(nextPallets);
    RfidTrackingService.savePalletLoads(nextPallets);

    setShowCreatePalletModal(false);
    setSelectedBagNumbersForNewPallet([]);
    setSelectedPalletId(newPalletId);
  };

  return (
    <div className="space-y-6 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Banner / System HUD */}
      <div className="bg-gradient-to-r from-[#0c121e] via-[#111927] to-[#0a101b] border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-cyan-500/5 blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Radio className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  EPC GEN2 UHF RFID
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
                  {isRTL ? 'تتبع آلي دون خط رؤية مباشر' : 'Non-Line-Of-Sight Active'}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  865-868 MHz • 4 Fixed Arch Gates
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight flex items-center gap-2">
                <span>{isRTL ? 'نظام تتبع وحركات المخزون الجماعية عبر RFID' : 'Bulk RFID Inventory & Portal Gate Tracking'}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
                {isRTL
                  ? 'منظومة التقاط كهرومغناطيسي فورية لمئات الأصول والأكياس المحملة على الطبالي عند مرور الرافعات الشوكية عبر بوابات المصنع دون حاجة لمسح بصري فردي.'
                  : 'Automated ultra-high frequency electromagnetic tracking capturing entire pallet loads and bulk bags in real-time as forklifts traverse factory portals.'}
              </p>
            </div>
          </div>

          {/* Action Tools & Audio Switcher */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
              title={soundEnabled ? 'صوت مستشعر RFID مفعّل' : 'صوت المستشعر مكتوم'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="text-[11px] hidden sm:inline">{soundEnabled ? (isRTL ? 'صوت الرنين نشط' : 'Audio Chirp On') : (isRTL ? 'صامت' : 'Muted')}</span>
            </button>

            <button
              onClick={() => setShowCreatePalletModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg hover:shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isRTL ? 'تكوين وترميز طبلية RFID جديدة' : 'Assemble Tagged Pallet'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('PORTAL_GATES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'PORTAL_GATES'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isRTL ? 'بوابات العبور الآلية (Portal Gates)' : 'Fixed Portal Gates'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-[10px] font-mono text-cyan-200">
              {portals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('HANDHELD_SWEEP')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'HANDHELD_SWEEP'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isRTL ? 'مسدس RFID اليدوي (Handheld Gun)' : 'Handheld 360° Sweep'}</span>
          </button>

          <button
            onClick={() => setActiveTab('PALLET_MANAGER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'PALLET_MANAGER'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isRTL ? 'إدارة الطبالي المرقمة (Pallet Loads)' : 'Active Pallets'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-[10px] font-mono text-cyan-200">
              {pallets.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('EVENT_LOG')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'EVENT_LOG'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isRTL ? 'سجل العبور اللاسلكي (Transit Log)' : 'Passage Ledger'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-[10px] font-mono text-cyan-200">
              {recentEvents.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FIXED PORTAL GATES TRANSIT ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'PORTAL_GATES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Portal Selection & Real-Time Antenna Gates (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'بوابات العبور الثابتة بين عنابر المصنع' : 'Active Overhead Antenna Portals'}</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {portals.filter((p) => p.status === 'ONLINE').length} ONLINE
              </span>
            </div>

            <div className="space-y-3">
              {portals.map((portal) => {
                const isSelected = portal.id === selectedPortalId;
                return (
                  <div
                    key={portal.id}
                    onClick={() => {
                      setSelectedPortalId(portal.id);
                      setTransitScanResult(null);
                      setTransitSuccessMsg(null);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400/80 shadow-lg shadow-cyan-950/50'
                        : 'bg-[#0f121a] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {portal.code}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          ONLINE
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {portal.antennaCount} Antennas • {portal.readRangeMeters}m
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white mt-2 leading-snug">
                      {isRTL ? portal.nameAr : portal.nameEn}
                    </h4>

                    {/* Transit Flow Path */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-white/5 font-mono text-slate-300">
                        {portal.locationFromCode} ({portal.zoneFrom})
                      </span>
                      <MoveRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold">
                        {portal.locationToCode} ({portal.zoneTo})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                      <span>{isRTL ? portal.installedGateLocationAr : portal.installedGateLocation}</span>
                      <span className="font-mono">{portal.totalAssetsPassed} Assets Passed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Live Transit Simulator & Forklift Passage Execution (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="bg-[#0e121b] border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {isRTL ? 'محاكاة عبور الرافعة الشوكية عبر البوابة' : 'Forklift Portal Passage Simulation'}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Target: {activePortal.code} ({isRTL ? activePortal.nameAr.split('(')[0] : activePortal.nameEn.split('(')[0]})
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-white/5 text-slate-300 border border-white/10">
                  Antenna Array: 4x Circular Polarized
                </span>
              </div>

              {/* Transit Selection Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {isRTL ? 'اختر الطبلية المحملة للعبور (Pallet Load):' : 'Select Loaded Pallet for Passage:'}
                  </label>
                  <select
                    value={selectedPalletId || (eligiblePallets[0]?.palletId || '')}
                    onChange={(e) => {
                      setSelectedPalletId(e.target.value);
                      setTransitScanResult(null);
                      setTransitSuccessMsg(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/15 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-cyan-400 transition-colors"
                  >
                    {eligiblePallets.map((plt) => (
                      <option key={plt.palletId} value={plt.palletId}>
                        [{plt.palletId}] {plt.palletRfidTag} - {plt.materialNameAr} ({plt.bulkBagsCount} أكياس / {plt.totalWeightKG.toLocaleString()} كغم) - موقع: {plt.currentLocationCode}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Pallet Live Breakdown */}
                {(() => {
                  const targetPallet = pallets.find((p) => p.palletId === (selectedPalletId || eligiblePallets[0]?.palletId));
                  if (!targetPallet) return null;
                  return (
                    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-cyan-400" />
                          <span className="font-mono text-cyan-300 font-bold">{targetPallet.palletRfidTag}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {targetPallet.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-start">
                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="text-[10px] text-slate-400">{isRTL ? 'المادة:' : 'Material:'}</div>
                          <div className="text-xs font-bold text-white truncate">{targetPallet.materialNameAr}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{targetPallet.materialCode}</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="text-[10px] text-slate-400">{isRTL ? 'إجمالي الوزن:' : 'Total Weight:'}</div>
                          <div className="text-xs font-bold text-emerald-400 font-mono">{targetPallet.totalWeightKG.toLocaleString()} KG</div>
                          <div className="text-[10px] text-slate-500">{targetPallet.bulkBagsCount} أكياس شليف</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="text-[10px] text-slate-400">{isRTL ? 'الموقع الحالي:' : 'Current Location:'}</div>
                          <div className="text-xs font-bold text-white font-mono">{targetPallet.currentLocationCode}</div>
                          <div className="text-[10px] text-slate-500">{targetPallet.currentWarehouseId}</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                          <div className="text-[10px] text-slate-400">{isRTL ? 'الوجهة المستهدفة:' : 'Target Gate:'}</div>
                          <div className="text-xs font-bold text-cyan-300 font-mono">{activePortal.locationToCode}</div>
                          <div className="text-[10px] text-slate-500">{activePortal.warehouseToId}</div>
                        </div>
                      </div>

                      {/* Associated Bags on Pallet */}
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-[10px] text-slate-400 mb-1.5 flex items-center justify-between">
                          <span>{isRTL ? 'أكياس الشليف المربوطة بالطبلية (بدون خط رؤية):' : 'Linked Bulk Bags (Non-line-of-sight UHF tags):'}</span>
                          <span className="font-mono text-cyan-400">{targetPallet.bagIds.length} Bags</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {targetPallet.bagIds.map((bid) => (
                            <span
                              key={bid}
                              className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300"
                            >
                              🏷️ {bid}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Simulated Forklift Action Button */}
                <button
                  type="button"
                  onClick={handleTriggerPortalPassage}
                  disabled={isSimulatingTransit || eligiblePallets.length === 0}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm sm:text-base shadow-xl shadow-cyan-950/60 transition-all flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSimulatingTransit ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-white" />
                      <span>{isRTL ? 'جاري التقاط الإشارات اللاسلكية وتوثيق الحركة...' : 'Scanning RFID Array & Executing Bulk Move...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 text-amber-300 animate-bounce" />
                      <span>{isRTL ? 'بدء عبور الطبلية عبر البوابة (مسح آلي فوري)' : 'Execute Forklift Portal Transit (Simulate Pass)'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback Success Notification */}
              {transitSuccessMsg && (
                <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{transitSuccessMsg}</span>
                </div>
              )}

              {/* Telemetry Scan Results Drawer */}
              {transitScanResult && (
                <div className="mt-5 p-4 rounded-xl bg-[#090b10] border border-cyan-500/40 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <span>{isRTL ? 'نتائج الالتقاط الكهرومغناطيسي للبوابة (Portal Telemetry)' : 'Antenna Burst Telemetry'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-emerald-400 font-bold">100% Read Rate</span>
                      <span className="text-slate-400">Duration: {transitScanResult.readDurationMs} ms</span>
                    </div>
                  </div>

                  {/* Detected Tags List */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {transitScanResult.detectedTags.map((tag, i) => (
                      <div
                        key={tag.epc + i}
                        className="p-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <span className="font-mono text-slate-300 text-[11px]">{tag.epc}</span>
                          <span className="text-slate-400 text-[10px]">({tag.assetNameAr})</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span className="text-slate-300">{tag.weightKG.toLocaleString()} KG</span>
                          <span className="text-cyan-400 font-bold">{tag.rssi} dBm</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Total Assets Detected: {transitScanResult.detectedTags.length} tags</span>
                    <span className="text-white font-bold">Total Net Weight: {transitScanResult.totalDetectedWeightKG.toLocaleString()} KG</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HANDHELD UHF RFID 360-DEGREE SWEEP */}
      {/* ========================================================================= */}
      {activeTab === 'HANDHELD_SWEEP' && (
        <div className="bg-[#0e121b] border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <span>{isRTL ? 'المسح اليدوي الدائري بمستشعر RFID طويل المدى' : 'Handheld Long-Range UHF Gun Reader'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'قم بتوجيه مسدس RFID نحو أرفف المستودع لقراءة كافة شلايف البلاستيك داخل نطاق 8 أمتار دفعة واحدة.'
                  : 'Sweep the handheld reader across high-bay racks to capture all tagged bags within 8m radius simultaneously.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={handheldLocation}
                onChange={(e) => setHandheldLocation(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white text-xs font-mono outline-none"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.code}>
                    {l.code} - {isRTL ? l.nameAr : l.nameEn} ({l.warehouseNameAr})
                  </option>
                ))}
              </select>

              <button
                onClick={handleRunHandheldSweep}
                disabled={isHandheldScanning}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-600/20"
              >
                {isHandheldScanning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Radio className="w-4 h-4" />
                )}
                <span>{isRTL ? 'إطلاق المسح اللاسلكي' : 'Trigger 360° Sweep'}</span>
              </button>
            </div>
          </div>

          {/* Results Display */}
          {handheldResults ? (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs text-slate-400">{isRTL ? 'موقع المسح:' : 'Scanned Location:'}</div>
                  <div className="text-base font-bold text-white font-mono mt-1">{handheldLocation}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs text-slate-400">{isRTL ? 'الطبالي الملتقطة:' : 'Detected Pallets:'}</div>
                  <div className="text-base font-bold text-cyan-400 font-mono mt-1">{handheldResults.matchedPallets.length}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs text-slate-400">{isRTL ? 'أكياس الشليف المستشعرة:' : 'Bulk Bags in Range:'}</div>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-1">{handheldResults.detectedBags.length}</div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="text-xs text-slate-400">{isRTL ? 'متوسط قوة الإشارة (RSSI):' : 'Average Signal:'}</div>
                  <div className="text-base font-bold text-amber-400 font-mono mt-1">{handheldResults.averageRSSI} dBm</div>
                </div>
              </div>

              {/* Tag Breakdown */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="text-xs font-bold text-slate-300">
                  {isRTL ? 'قائمة الأكياس المستجيبة للإشارة الكهرومغناطيسية بالموقع:' : 'Inventory Tags Responding in Bay:'}
                </div>
                {handheldResults.detectedBags.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {handheldResults.detectedBags.map((bag) => (
                      <div key={bag.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono text-cyan-300 font-bold">{bag.bagNumber || bag.id}</div>
                          <div className="text-[10px] text-slate-400">{bag.materialName}</div>
                        </div>
                        <div className="text-end font-mono">
                          <div className="text-emerald-400 font-bold">{bag.weightKG} KG</div>
                          <div className="text-[9px] text-slate-500">-56 dBm</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-3 text-center">
                    {isRTL ? 'لم يتم التقاط أكياس غير مسجلة في هذا الموقع' : 'No stray tags detected in this location bay.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Radio className="w-10 h-10 mx-auto text-slate-600 animate-pulse" />
              <div className="text-sm font-semibold">{isRTL ? 'حدد موقع المستودع واضغط "إطلاق المسح اللاسلكي"' : 'Select bay location and trigger handheld sweep.'}</div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PALLET MANAGER (Group multiple bulk bags into tagged pallets) */}
      {/* ========================================================================= */}
      {activeTab === 'PALLET_MANAGER' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'الطبالي المسجلة والمرقمة برموز RFID' : 'Active Registered RFID Pallet Loads'}</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{pallets.length} Pallets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pallets.map((plt) => (
              <div key={plt.palletId} className="p-4 rounded-xl bg-[#0f121a] border border-white/10 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {plt.palletId}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                    {plt.status}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white leading-snug">{plt.descriptionAr}</h4>
                  <div className="text-[11px] font-mono text-cyan-400 mt-0.5">{plt.palletRfidTag}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'الوزن الإجمالي:' : 'Weight:'}</span>
                    <span className="font-mono text-emerald-400 font-bold">{plt.totalWeightKG.toLocaleString()} KG</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isRTL ? 'الموقع الحالي:' : 'Location:'}</span>
                    <span className="font-mono text-white font-bold">{plt.currentLocationCode}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1">
                  <span>{isRTL ? 'الأكياس المربوطة:' : 'Bags:'} </span>
                  <span className="font-mono text-slate-300">{plt.bagIds.join(', ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: HISTORICAL RFID TRANSIT EVENTS LOG */}
      {/* ========================================================================= */}
      {activeTab === 'EVENT_LOG' && (
        <div className="bg-[#0e121b] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'سجل حركات البوابات الآلية الموثقة (Audit Trail)' : 'RFID Gate Passage Audit Trail'}</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">{recentEvents.length} Recorded Movements</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-mono">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'رقم الحركة' : 'Movement #'}</th>
                  <th className="p-3 text-start">{isRTL ? 'بوابة RFID' : 'Portal Gate'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الطبلية' : 'Pallet / Asset'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المادة' : 'Material'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المسار (من ⟵ إلى)' : 'Path (From ⟵ To)'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الوزن والكمية' : 'Weight & Bags'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الوقت والمشغل' : 'Time & Operator'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-mono font-bold text-cyan-400">{evt.movementNumber}</td>
                    <td className="p-3">
                      <div className="font-bold text-white">{evt.portalId}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{evt.portalNameAr}</div>
                    </td>
                    <td className="p-3 font-mono text-amber-300 font-bold">{evt.palletId || '---'}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-200">{evt.materialNameAr}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{evt.materialCode}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <span className="text-slate-400">{evt.fromLocationCode}</span>
                      <span className="mx-1 text-cyan-400">⟵</span>
                      <span className="text-emerald-400 font-bold">{evt.toLocationCode}</span>
                    </td>
                    <td className="p-3 font-mono">
                      <div className="font-bold text-white">{evt.totalKG.toLocaleString()} KG</div>
                      <div className="text-[10px] text-slate-400">{evt.totalBags} Bags ({evt.detectedTagsCount} tags)</div>
                    </td>
                    <td className="p-3 text-[11px] text-slate-400">
                      <div>{new Date(evt.timestamp).toLocaleTimeString()}</div>
                      <div className="text-[10px] text-slate-500">{evt.operator}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {evt.status}
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
      {/* MODAL: CREATE & ENCODE NEW PALLET */}
      {/* ========================================================================= */}
      {showCreatePalletModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11141f] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <Tag className="w-4 h-4" />
                <span>{isRTL ? 'تكوين وترميز طبلية RFID جديدة' : 'Assemble Tagged Pallet'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePalletModal(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePalletSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'نوع المادة الخام:' : 'Material:'}
                </label>
                <select
                  value={newPalletMaterialId}
                  onChange={(e) => setNewPalletMaterialId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white outline-none"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} - {isRTL ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'موقع الرص والتجميع الأولي:' : 'Initial Storage Location:'}
                </label>
                <select
                  value={newPalletLocation}
                  onChange={(e) => setNewPalletLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-white/15 rounded-xl text-white font-mono outline-none"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.code}>
                      {l.code} ({isRTL ? l.nameAr : l.nameEn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  {isRTL ? 'حدد أكياس الشليف لربطها بالطبلية (1 - 6 أكياس):' : 'Select Bulk Bags to Group on Pallet:'}
                </label>
                <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                  {bulkBags.slice(0, 15).map((bag) => {
                    const bagId = bag.bagNumber || bag.id;
                    const isChecked = selectedBagNumbersForNewPallet.includes(bagId);
                    return (
                      <label
                        key={bag.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBagNumbersForNewPallet([...selectedBagNumbersForNewPallet, bagId]);
                              } else {
                                setSelectedBagNumbersForNewPallet(selectedBagNumbersForNewPallet.filter((id) => id !== bagId));
                              }
                            }}
                            className="rounded accent-cyan-500"
                          />
                          <span className="font-mono text-cyan-300 font-bold">{bagId}</span>
                        </div>
                        <span className="font-mono text-slate-400">{bag.weightKG} KG</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreatePalletModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 font-bold cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={selectedBagNumbersForNewPallet.length === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isRTL ? 'ترميز واعتماد الطبلية' : 'Encode & Save Pallet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
