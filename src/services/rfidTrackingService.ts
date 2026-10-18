import {
  RfidPortal,
  RfidPalletLoad,
  RfidTagRecord,
  RfidBulkMovementEvent,
  BulkBag,
  WarehouseLocation,
  MaterialItem,
  UserProfile,
} from '../types';
import { SystemCodesAPI } from './systemCodesService';

export const INITIAL_RFID_PORTALS: RfidPortal[] = [
  {
    id: 'PORTAL-GATE-01',
    code: 'GATE-01-MAIN',
    nameAr: 'بوابة العبور الرئيسية (مستودع الخامات WH-01 ⟵ الممر المركزي)',
    nameEn: 'Main Transit Portal (WH-01 Raw Store ⟵ Corridor)',
    zoneFrom: 'Zone A - Heavy Stacks',
    zoneTo: 'Zone B - Active Racks',
    warehouseFromId: 'WH-01',
    warehouseToId: 'WH-01',
    locationFromCode: 'LOC-A-01',
    locationToCode: 'LOC-B-01',
    antennaCount: 4,
    frequencyBand: 'UHF 865-868 MHz (EU/Middle East)',
    readRangeMeters: 8,
    status: 'ONLINE',
    installedGateLocation: 'Main Overhead Archway Bay 1',
    installedGateLocationAr: 'قوس البوابة العلوية الرئيسية - ممر الشاحنات والمناولة 01',
    lastPassageTimestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    totalAssetsPassed: 428,
  },
  {
    id: 'PORTAL-GATE-02',
    code: 'GATE-02-SHRED',
    nameAr: 'بوابة تغذية الثرم والجرش (الممر المركزي ⟵ حوض التغذية WH-02)',
    nameEn: 'Shredder Feed Portal (Transit Corridor ⟵ Shredder Feed WH-02)',
    zoneFrom: 'Zone B - Active Racks',
    zoneTo: 'Shredder Feed Bay',
    warehouseFromId: 'WH-01',
    warehouseToId: 'WH-02',
    locationFromCode: 'LOC-B-01',
    locationToCode: 'LOC-THM-IN',
    antennaCount: 4,
    frequencyBand: 'UHF 865-868 MHz (EU/Middle East)',
    readRangeMeters: 9,
    status: 'ONLINE',
    installedGateLocation: 'Heavy Shredder Intake Arch Gate 02',
    installedGateLocationAr: 'بوابة مدخل حوض التغذية لماكينة الثرم الثقيلة 02',
    lastPassageTimestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    totalAssetsPassed: 312,
  },
  {
    id: 'PORTAL-GATE-03',
    code: 'GATE-03-REGRIND',
    nameAr: 'بوابة تفريغ المجروش (مستودع الثرم WH-02 ⟵ صوامع البثق WH-03)',
    nameEn: 'Regrind Transfer Portal (WH-02 ⟵ Extrusion Buffer WH-03)',
    zoneFrom: 'Regrind Output Bay',
    zoneTo: 'Extruder Feed Silos',
    warehouseFromId: 'WH-02',
    warehouseToId: 'WH-03',
    locationFromCode: 'LOC-THM-OUT',
    locationToCode: 'LOC-FEED-01',
    antennaCount: 2,
    frequencyBand: 'UHF 865-868 MHz (EU/Middle East)',
    readRangeMeters: 6,
    status: 'ONLINE',
    installedGateLocation: 'Conveyor & Forklift Transit Corridor 03',
    installedGateLocationAr: 'ممر السير الناقل والرافعات الشوكية 03',
    lastPassageTimestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    totalAssetsPassed: 195,
  },
  {
    id: 'PORTAL-GATE-04',
    code: 'GATE-04-EXTRUDE',
    nameAr: 'بوابة تغذية خطوط إنتاج وتشكيل الأكواب (WH-01 ⟵ خطوط التشكيل)',
    nameEn: 'Production Feed Portal (WH-01 ⟵ Thermoforming Line)',
    zoneFrom: 'Zone A - Virgin Stacks',
    zoneTo: 'Production Intake',
    warehouseFromId: 'WH-01',
    warehouseToId: 'WH-03',
    locationFromCode: 'LOC-A-02',
    locationToCode: 'LOC-FEED-01',
    antennaCount: 4,
    frequencyBand: 'UHF 865-868 MHz (EU/Middle East)',
    readRangeMeters: 8,
    status: 'ONLINE',
    installedGateLocation: 'Extrusion Line 01 High-Speed Rollway',
    installedGateLocationAr: 'ممر خط البثق 01 السريع للألواح واللفائف',
    lastPassageTimestamp: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
    totalAssetsPassed: 154,
  },
  {
    id: 'PORTAL-GATE-05',
    code: 'GATE-05-ROLLS',
    nameAr: 'بوابة مستودع المنتجات الجاهزة واللفائف (WH-03 ⟵ مستودع الرولات WH-04)',
    nameEn: 'Finished Rolls Portal (Production WH-03 ⟵ Roll Store WH-04)',
    zoneFrom: 'Extrusion Line Output',
    zoneTo: 'Finished Rolls Racks',
    warehouseFromId: 'WH-03',
    warehouseToId: 'WH-04',
    locationFromCode: 'LOC-FEED-01',
    locationToCode: 'LOC-ROLL-R1',
    antennaCount: 2,
    frequencyBand: 'UHF 865-868 MHz (EU/Middle East)',
    readRangeMeters: 7,
    status: 'ONLINE',
    installedGateLocation: 'Finished Product Air-Lock Roll Gate',
    installedGateLocationAr: 'بوابة العزل الهوائي لمستودع الرولات والمنتج التام',
    lastPassageTimestamp: new Date(Date.now() - 1000 * 60 * 340).toISOString(),
    totalAssetsPassed: 89,
  },
];

const RFID_PALLETS_STORAGE_KEY = 'alkarwan_rfid_pallets_v1';
const RFID_EVENTS_STORAGE_KEY = 'alkarwan_rfid_events_v1';

export class RfidTrackingService {
  /**
   * Generates standard EPC Gen2 UHF hex tag identifier
   */
  static generateEpcTag(prefix: 'PLT' | 'BAG' | 'CNT', idNumber: string | number): string {
    const cleanId = String(idNumber).replace(/[^a-zA-Z0-9]/g, '').slice(-6).padStart(6, '0').toUpperCase();
    const hexPrefix = prefix === 'PLT' ? 'E280-PLT0' : prefix === 'BAG' ? 'E280-BAG0' : 'E280-CNT0';
    const randSegment = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    return `${hexPrefix}-${randSegment}-${cleanId}`;
  }

  /**
   * Gets list of registered portals
   */
  static getPortals(): RfidPortal[] {
    return INITIAL_RFID_PORTALS;
  }

  /**
   * Loads registered pallet loads or builds defaults from existing bulk bags
   */
  static getPalletLoads(existingBags: BulkBag[], materials: MaterialItem[]): RfidPalletLoad[] {
    try {
      const stored = localStorage.getItem(RFID_PALLETS_STORAGE_KEY);
      if (stored) {
        const parsed: RfidPalletLoad[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored RFID pallets:', e);
    }

    // Generate initial realistic pallet loads from bulk bags
    const generatedPallets = this.generateBaselinePallets(existingBags, materials);
    this.savePalletLoads(generatedPallets);
    return generatedPallets;
  }

  static savePalletLoads(pallets: RfidPalletLoad[]): void {
    try {
      localStorage.setItem(RFID_PALLETS_STORAGE_KEY, JSON.stringify(pallets));
    } catch (e) {
      console.warn('Failed to save RFID pallets:', e);
    }
  }

  /**
   * Load history of RFID bulk movement events
   */
  static getMovementEvents(): RfidBulkMovementEvent[] {
    try {
      const stored = localStorage.getItem(RFID_EVENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse RFID movement events:', e);
    }
    return [];
  }

  static saveMovementEvents(events: RfidBulkMovementEvent[]): void {
    try {
      localStorage.setItem(RFID_EVENTS_STORAGE_KEY, JSON.stringify(events.slice(0, 100)));
    } catch (e) {
      console.warn('Failed to save RFID movement events:', e);
    }
  }

  /**
   * Creates baseline pallets grouping bags by material and location
   */
  private static generateBaselinePallets(bags: BulkBag[], materials: MaterialItem[]): RfidPalletLoad[] {
    const validBags = (bags || []).filter((b) => b.status === 'IN_STORAGE' || b.status === 'AVAILABLE');
    if (validBags.length === 0) {
      return [
        {
          palletId: 'PLT-8401',
          palletRfidTag: 'E280-PLT0-A19F-008401',
          descriptionAr: 'طبلية مواد خام حبيبات بولي بروبلين (PP-HOMO-01)',
          descriptionEn: 'PP Homopolymer Virgin Pellets Pallet #8401',
          materialId: 'MAT-01',
          materialCode: 'PP-HOMO-01',
          materialNameAr: 'حبيبات بولي بروبلين للحقن الصناعي',
          bagIds: ['SHL-000001', 'SHL-000002', 'SHL-000003', 'SHL-000004'],
          totalWeightKG: 4000,
          bulkBagsCount: 4,
          currentWarehouseId: 'WH-01',
          currentLocationCode: 'LOC-A-01',
          status: 'READY_IN_RACK',
          createdAt: new Date().toISOString(),
        },
        {
          palletId: 'PLT-8402',
          palletRfidTag: 'E280-PLT0-B47C-008402',
          descriptionAr: `طبلية بالات وهوامش سكراب أكواب حرارية للثرم (Doc ${SystemCodesAPI.getStorageCode()})`,
          descriptionEn: 'Scrap Plastic Cups Bales Pallet #8402',
          materialId: 'MAT-04',
          materialCode: 'SCRAP-CUP-01',
          materialNameAr: 'سكراب وهوامش أكواب حرارية مطبوعة',
          bagIds: ['SHL-000005', 'SHL-000006', 'SHL-000007'],
          totalWeightKG: 3120,
          bulkBagsCount: 3,
          currentWarehouseId: 'WH-01',
          currentLocationCode: 'LOC-B-01',
          status: 'READY_IN_RACK',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    // Group bags by material and location (up to 4 bags per pallet)
    const grouped: Record<string, BulkBag[]> = {};
    for (const bag of validBags) {
      const key = `${bag.materialId}_${bag.locationCode || 'LOC-A-01'}`;
      if (!grouped[key]) grouped[key] = [];
      if (grouped[key].length < 4) {
        grouped[key].push(bag);
      }
    }

    const pallets: RfidPalletLoad[] = [];
    let idx = 8410;
    for (const key of Object.keys(grouped)) {
      const groupBags = grouped[key];
      if (groupBags.length === 0) continue;
      const first = groupBags[0];
      const mat = materials.find((m) => m.id === first.materialId);
      const totalWeight = groupBags.reduce((s, b) => s + (b.weightKG || 1000), 0);
      const palletId = `PLT-${idx++}`;
      pallets.push({
        palletId,
        palletRfidTag: this.generateEpcTag('PLT', palletId),
        descriptionAr: `طبلية أكياس شليف [${mat?.nameAr || first.materialName || 'خام'}]`,
        descriptionEn: `Bulk Bag Pallet [${mat?.nameEn || first.materialCode}]`,
        materialId: first.materialId,
        materialCode: first.materialCode || mat?.code || 'RAW-01',
        materialNameAr: mat?.nameAr || first.materialName || 'خام بلاستيكي',
        bagIds: groupBags.map((b) => b.bagNumber || b.id),
        totalWeightKG: totalWeight,
        bulkBagsCount: groupBags.length,
        currentWarehouseId: first.warehouseId || 'WH-01',
        currentLocationCode: first.locationCode || 'LOC-A-01',
        status: 'READY_IN_RACK',
        createdAt: new Date().toISOString(),
      });
    }

    return pallets;
  }

  /**
   * Simulates zero-line-of-sight UHF RFID tag reader burst
   * Reads all pallet tags and all attached bulk bag tags within 150-350ms
   */
  static simulatePortalPassage(
    portal: RfidPortal,
    pallet: RfidPalletLoad,
    allBags: BulkBag[]
  ): {
    detectedTags: { epc: string; assetId: string; assetNameAr: string; weightKG: number; rssi: number }[];
    totalDetectedWeightKG: number;
    readDurationMs: number;
    readRatePct: number;
  } {
    const detectedTags: { epc: string; assetId: string; assetNameAr: string; weightKG: number; rssi: number }[] = [];

    // 1. Detect Pallet Master RFID Tag (High signal strength since it's on outer pallet corner)
    const palletRSSI = Math.floor(-42 - Math.random() * 8); // e.g. -46 dBm (very strong)
    detectedTags.push({
      epc: pallet.palletRfidTag,
      assetId: pallet.palletId,
      assetNameAr: pallet.descriptionAr || `طبلية ${pallet.palletId}`,
      weightKG: pallet.totalWeightKG,
      rssi: palletRSSI,
    });

    // 2. Detect all constituent bulk bag tags on the pallet (zero line of sight through stacked plastic/fabric)
    for (const bagId of pallet.bagIds) {
      const bag = allBags.find((b) => b.bagNumber === bagId || b.id === bagId);
      const bagWeight = bag?.weightKG || Math.round(pallet.totalWeightKG / pallet.bulkBagsCount);
      const bagEpc = bag?.rfidTag || this.generateEpcTag('BAG', bagId);
      const bagRSSI = Math.floor(-48 - Math.random() * 18); // e.g. -54 to -65 dBm (strong UHF penetration)

      detectedTags.push({
        epc: bagEpc,
        assetId: bagId,
        assetNameAr: bag ? `شليف: ${bag.bagNumber || bag.id}` : `شليف ${bagId}`,
        weightKG: bagWeight,
        rssi: bagRSSI,
      });
    }

    const readDurationMs = Math.floor(180 + Math.random() * 120); // 180ms - 300ms ultra-fast bulk read
    const readRatePct = 100; // Gen2 UHF 100% read reliability

    return {
      detectedTags,
      totalDetectedWeightKG: pallet.totalWeightKG,
      readDurationMs,
      readRatePct,
    };
  }

  /**
   * Simulates handheld 360-degree UHF RFID sweep across a zone
   */
  static simulateHandheldSweep(
    locationCode: string,
    allBags: BulkBag[],
    pallets: RfidPalletLoad[]
  ): {
    matchedPallets: RfidPalletLoad[];
    detectedBags: BulkBag[];
    averageRSSI: number;
    sweepTimestamp: string;
  } {
    const locPallets = pallets.filter((p) => p.currentLocationCode === locationCode);
    const locBags = allBags.filter((b) => b.locationCode === locationCode);

    return {
      matchedPallets: locPallets,
      detectedBags: locBags,
      averageRSSI: Math.floor(-50 - Math.random() * 12),
      sweepTimestamp: new Date().toISOString(),
    };
  }
}
