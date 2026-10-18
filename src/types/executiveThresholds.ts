export interface ExecutiveThresholds {
  // Inventory limits
  inventoryMaxCapacityPct: number; // e.g. 75 (%)
  inventoryMinTons: number; // e.g. 50 (Tons)
  enableInventoryMaxAlert: boolean;
  enableInventoryMinAlert: boolean;

  // Shredding throughput limits
  shreddingMinRateKGh: number; // e.g. 1100 (KG/h)
  shreddingMaxRateKGh: number; // e.g. 1550 (KG/h)
  enableShreddingMinAlert: boolean;
  enableShreddingMaxAlert: boolean;
}

export const DEFAULT_EXECUTIVE_THRESHOLDS: ExecutiveThresholds = {
  inventoryMaxCapacityPct: 75,
  inventoryMinTons: 50,
  enableInventoryMaxAlert: true,
  enableInventoryMinAlert: true,
  shreddingMinRateKGh: 1100,
  shreddingMaxRateKGh: 1550,
  enableShreddingMinAlert: true,
  enableShreddingMaxAlert: true,
};

const STORAGE_KEY = 'alkarwan_executive_thresholds_v2';

export function loadExecutiveThresholds(): ExecutiveThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_EXECUTIVE_THRESHOLDS,
        ...parsed,
      };
    }
  } catch (e) {
    console.warn('Failed to load executive thresholds from localStorage', e);
  }
  return DEFAULT_EXECUTIVE_THRESHOLDS;
}

export function saveExecutiveThresholds(thresholds: ExecutiveThresholds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  } catch (e) {
    console.warn('Failed to save executive thresholds to localStorage', e);
  }
}
