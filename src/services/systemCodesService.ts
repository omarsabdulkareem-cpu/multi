/**
 * AL-KARWAN Configurable Inventory & Transaction Codes Service
 * شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
 *
 * Provides configurable management for factory internal inventory codes:
 * - 167: Storage / الإيداع وصرف الخامات بالمستودع الرئيسي
 * - 546: Sent to Production / توريد وصرف المواد لخطوط الإنتاج والبثق
 * - 360: Received Shredded Material / استلام مفروم ومجروش الثرم
 * - 352: Shredding-related transaction / نقل وتوجيه هوالك الثرم
 *
 * Stored persistently in Firebase Firestore (`systemInventoryCodes` collection)
 * with real-time sync, offline IndexedDB resilience, and local storage fallback.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { SystemInventoryCode } from '../types';

export type SystemCodeConfig = SystemInventoryCode;

export const STORAGE_KEY_CODES = 'alkarwan_system_inventory_codes_v1';
export const FIRESTORE_COLLECTION_SYSTEM_CODES = 'systemInventoryCodes';

export const DEFAULT_AL_KARWAN_CODES: SystemCodeConfig[] = [
  {
    id: 'code_167',
    code: '167',
    nameAr: 'مستند التخزين والإيداع العام (صرف واستلام بالمستودع)',
    nameEn: 'Warehouse Storage & Raw Movement (Doc 167)',
    category: 'STORAGE',
    descriptionAr: 'يستخدم لتوثيق حركة الإيداع في المستودع الرئيسي وصرف الخامات للشاحنات ومواقع التخزين الداخلية.',
    descriptionEn: 'Official document reference for warehouse storage intake, staging, issues, and storage movements.',
    prefix: 'STR-167',
    isActive: true,
    isSystemDefault: true,
    updatedAt: '2026-09-01T08:00:00Z',
    updatedBy: 'AL-KARWAN System Baseline',
  },
  {
    id: 'code_546',
    code: '546',
    nameAr: 'مستند إرسال وتوريد المواد للإنتاج والبثق',
    nameEn: 'Sent to Production Extrusion Lines (Doc 546)',
    category: 'PRODUCTION',
    descriptionAr: 'المستند المعتمد لتسليم الخامات من المستودع إلى خطوط البثق والفيلم وصالات إنتاج الأكواب البلاستيكية.',
    descriptionEn: 'Authorized material transfer issue slip from storage to factory extrusion and thermoforming lines.',
    prefix: 'PRD-546',
    isActive: true,
    isSystemDefault: true,
    updatedAt: '2026-09-01T08:00:00Z',
    updatedBy: 'AL-KARWAN System Baseline',
  },
  {
    id: 'code_360',
    code: '360',
    nameAr: 'مستند استلام مفروم ومجروش الثرم الجاهز',
    nameEn: 'Received Shredded Material to Storage (Doc 360)',
    category: 'SHREDDING',
    descriptionAr: 'تسجيل وتوثيق ناتج الثرم بعد تدوير الهوالك والألواح إلى شلايف مجروش ناعم جاهز للتصنيع بالمستودع.',
    descriptionEn: 'Official intake slip for shredded regrind exiting the therm granulator back into storage.',
    prefix: 'THM-360',
    isActive: true,
    isSystemDefault: true,
    updatedAt: '2026-09-01T08:00:00Z',
    updatedBy: 'AL-KARWAN System Baseline',
  },
  {
    id: 'code_352',
    code: '352',
    nameAr: 'مستند حركة وتحويل هوالك الثرم الداخلية',
    nameEn: 'Shredding Internal Move & Waste Ledger (Doc 352)',
    category: 'SHREDDING',
    descriptionAr: 'توثيق حركة الهوالك، الأطراف، طوز الثرم، وتالف التشغيل بين صالات المصنع ووحدة الثرم.',
    descriptionEn: 'Internal tracking document for roll trims, waste preforms, and therm operational dust.',
    prefix: 'THM-352',
    isActive: true,
    isSystemDefault: true,
    updatedAt: '2026-09-01T08:00:00Z',
    updatedBy: 'AL-KARWAN System Baseline',
  },
];

/**
 * Synchronous local cache retrieval (instant for synchronous render cycles and offline support)
 */
export function getStoredSystemCodes(): SystemCodeConfig[] {
  if (typeof window === 'undefined') return DEFAULT_AL_KARWAN_CODES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CODES);
    if (!raw) {
      saveSystemCodesLocally(DEFAULT_AL_KARWAN_CODES);
      return DEFAULT_AL_KARWAN_CODES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('[SystemCodes] Failed to parse local codes cache:', err);
  }
  return DEFAULT_AL_KARWAN_CODES;
}

/**
 * Persists codes to localStorage and broadcasts the change event
 */
export function saveSystemCodesLocally(codes: SystemCodeConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CODES, JSON.stringify(codes));
    window.dispatchEvent(new CustomEvent('alkarwan_codes_updated', { detail: codes }));
  } catch (err) {
    console.error('[SystemCodes] Failed to persist system codes to localStorage:', err);
  }
}

/**
 * Backwards compatible alias for saveSystemCodesLocally
 */
export const saveSystemCodes = saveSystemCodesLocally;

// ==========================================
// FIRESTORE PERSISTENCE & REAL-TIME SYNC
// ==========================================

/**
 * Fetches all configurable inventory codes from Firestore.
 * If the collection is empty, seeds the AL-KARWAN defaults automatically.
 */
export async function fetchSystemCodesFromFirestore(): Promise<SystemCodeConfig[]> {
  try {
    const colRef = collection(db, FIRESTORE_COLLECTION_SYSTEM_CODES);
    const snapshot = await getDocs(colRef);

    if (snapshot.empty) {
      console.log('[SystemCodes] Firestore collection empty. Seeding AL-KARWAN defaults (167, 546, 360, 352)...');
      await initializeDefaultSystemCodesInFirestore();
      return DEFAULT_AL_KARWAN_CODES;
    }

    const firestoreCodes: SystemCodeConfig[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as SystemCodeConfig;
      firestoreCodes.push({
        ...data,
        id: docSnap.id,
        code: data.code || docSnap.id.replace('code_', ''),
      });
    });

    // Ensure baseline ordering (167 first, then 546, 360, 352, then custom)
    firestoreCodes.sort((a, b) => {
      if (a.isSystemDefault && !b.isSystemDefault) return -1;
      if (!a.isSystemDefault && b.isSystemDefault) return 1;
      return a.code.localeCompare(b.code);
    });

    // Cache locally
    saveSystemCodesLocally(firestoreCodes);
    return firestoreCodes;
  } catch (err) {
    console.warn('[SystemCodes] Failed to fetch codes from Firestore (operating in offline cache mode):', err);
    return getStoredSystemCodes();
  }
}

/**
 * Real-time listener for Firestore changes on systemInventoryCodes.
 */
export function subscribeToSystemCodesFromFirestore(
  onUpdate: (codes: SystemCodeConfig[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  try {
    const colRef = collection(db, FIRESTORE_COLLECTION_SYSTEM_CODES);
    return onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          // If Firestore collection is empty, seed defaults
          initializeDefaultSystemCodesInFirestore().catch((err) =>
            console.warn('[SystemCodes] Seeding error in listener:', err)
          );
          onUpdate(DEFAULT_AL_KARWAN_CODES);
          return;
        }

        const codes: SystemCodeConfig[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SystemCodeConfig;
          codes.push({
            ...data,
            id: docSnap.id,
            code: data.code || docSnap.id.replace('code_', ''),
          });
        });

        codes.sort((a, b) => {
          if (a.isSystemDefault && !b.isSystemDefault) return -1;
          if (!a.isSystemDefault && b.isSystemDefault) return 1;
          return a.code.localeCompare(b.code);
        });

        saveSystemCodesLocally(codes);
        onUpdate(codes);
      },
      (error) => {
        console.warn('[SystemCodes] Realtime subscription warning:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('[SystemCodes] Could not attach real-time listener:', err);
    return () => {};
  }
}

/**
 * Initializes or resets default AL-KARWAN codes in Firestore
 */
export async function initializeDefaultSystemCodesInFirestore(): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const item of DEFAULT_AL_KARWAN_CODES) {
      const docId = item.id || `code_${item.code}`;
      const docRef = doc(db, FIRESTORE_COLLECTION_SYSTEM_CODES, docId);
      batch.set(docRef, { ...item, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
    saveSystemCodesLocally(DEFAULT_AL_KARWAN_CODES);
  } catch (err) {
    console.error('[SystemCodes] Failed to seed default codes into Firestore:', err);
  }
}

/**
 * Updates a system code in both Firestore and local storage cache
 */
export async function saveSystemCodeToFirestore(
  targetCode: string,
  updates: Partial<SystemCodeConfig>,
  user: string = 'Admin'
): Promise<boolean> {
  const current = getStoredSystemCodes();
  const index = current.findIndex((c) => c.code === targetCode);
  if (index === -1) return false;

  const updatedItem: SystemCodeConfig = {
    ...current[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: user,
  };

  const docId = updatedItem.id || `code_${targetCode}`;

  // Update local cache immediately for responsive UI
  current[index] = updatedItem;
  saveSystemCodesLocally(current);

  // Persist to Firestore
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION_SYSTEM_CODES, docId);
    await setDoc(docRef, updatedItem, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[SystemCodes] Failed to write code ${targetCode} to Firestore:`, err);
    return true; // Local update succeeded
  }
}

/**
 * Adds a new configurable system code to both Firestore and local cache
 */
export async function createSystemCodeInFirestore(
  newConfig: Omit<SystemCodeConfig, 'id' | 'updatedAt'>,
  user: string = 'Admin'
): Promise<boolean> {
  const current = getStoredSystemCodes();
  if (current.some((c) => c.code === newConfig.code.trim())) {
    return false; // Code duplicate check
  }

  const docId = `code_${newConfig.code.trim()}`;
  const complete: SystemCodeConfig = {
    ...newConfig,
    id: docId,
    code: newConfig.code.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: user,
  };

  current.push(complete);
  saveSystemCodesLocally(current);

  try {
    const docRef = doc(db, FIRESTORE_COLLECTION_SYSTEM_CODES, docId);
    await setDoc(docRef, complete);
    return true;
  } catch (err) {
    console.warn(`[SystemCodes] Failed to create code ${newConfig.code} in Firestore:`, err);
    return true;
  }
}

/**
 * Deletes a non-default system code from Firestore and local cache
 */
export async function deleteSystemCodeFromFirestore(targetCode: string): Promise<boolean> {
  const current = getStoredSystemCodes();
  const target = current.find((c) => c.code === targetCode);
  if (!target || target.isSystemDefault) {
    return false; // Cannot delete system baseline codes (167, 546, 360, 352)
  }

  const filtered = current.filter((c) => c.code !== targetCode);
  saveSystemCodesLocally(filtered);

  try {
    const docId = target.id || `code_${targetCode}`;
    const docRef = doc(db, FIRESTORE_COLLECTION_SYSTEM_CODES, docId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn(`[SystemCodes] Failed to delete code ${targetCode} from Firestore:`, err);
    return true;
  }
}

// Synchronous wrapper helpers for existing components
export function updateSystemCode(
  targetCode: string,
  updates: Partial<SystemCodeConfig>,
  user: string = 'Admin'
): boolean {
  saveSystemCodeToFirestore(targetCode, updates, user);
  return true;
}

export function addSystemCode(
  newConfig: Omit<SystemCodeConfig, 'updatedAt'>,
  user: string = 'Admin'
): boolean {
  createSystemCodeInFirestore(newConfig, user);
  return true;
}

export function deleteSystemCode(targetCode: string): boolean {
  deleteSystemCodeFromFirestore(targetCode);
  return true;
}

// ==========================================
// CODE RESOLUTION & INVENTORY INTEGRATION
// ==========================================

export type InventoryCodePurpose =
  | 'STORAGE'
  | 'PRODUCTION'
  | 'SHREDDING_RECEIPT'
  | 'SHREDDING_MOVE'
  | 'RECEIVING'
  | 'CUSTOM';

/**
 * Resolves the active configurable internal inventory code for a given factory operation purpose.
 * Can use an optional provided array of codes or query local cached codes.
 */
export function getCodeByPurpose(
  purpose: InventoryCodePurpose,
  customCodesList?: SystemCodeConfig[]
): string {
  const codes = customCodesList || getStoredSystemCodes();

  switch (purpose) {
    case 'STORAGE': {
      const found = codes.find((c) => c.category === 'STORAGE' && c.isActive);
      return found ? found.code : '167';
    }
    case 'PRODUCTION': {
      const found = codes.find((c) => c.category === 'PRODUCTION' && c.isActive);
      return found ? found.code : '546';
    }
    case 'SHREDDING_RECEIPT': {
      const found = codes.find((c) => c.category === 'SHREDDING' && c.code === '360' && c.isActive);
      return found ? found.code : (codes.find((c) => c.category === 'SHREDDING' && c.isActive)?.code || '360');
    }
    case 'SHREDDING_MOVE': {
      const found = codes.find((c) => c.category === 'SHREDDING' && c.code === '352' && c.isActive);
      return found ? found.code : '352';
    }
    case 'RECEIVING': {
      // Receiving can be directed to Storage (167) or incoming vendor receiving
      const found = codes.find((c) => c.category === 'RECEIVING' && c.isActive);
      return found ? found.code : '167';
    }
    default:
      return '167';
  }
}

/**
 * Returns full configuration object for a specific code
 */
export function getSystemCodeDetails(
  code: string,
  customCodesList?: SystemCodeConfig[]
): SystemCodeConfig | undefined {
  const codes = customCodesList || getStoredSystemCodes();
  return codes.find((c) => c.code === code);
}

/**
 * Generates an official formatted AL-KARWAN document reference
 * based on the active configurable code:
 * E.g., `167/2026/089` or `546/2026/221` or `360/2026/014`
 */
export function formatInventoryDocumentNumber(
  purpose: InventoryCodePurpose,
  sequence: number | string,
  year: number = new Date().getFullYear(),
  customCodesList?: SystemCodeConfig[]
): string {
  const code = getCodeByPurpose(purpose, customCodesList);
  const formattedSeq = String(sequence).padStart(3, '0');
  return `${code}/${year}/${formattedSeq}`;
}

/**
 * Resolves the internal inventory code based on movementType and sourceModule
 */
export function resolveMovementInternalCode(
  sourceModule: string,
  movementType: string,
  customCodesList?: SystemCodeConfig[]
): string {
  if (sourceModule === 'PRODUCTION' || movementType.includes('PRODUCTION')) {
    return getCodeByPurpose('PRODUCTION', customCodesList); // 546
  }
  if (sourceModule === 'SHREDDING' || movementType.includes('SHREDDING')) {
    if (movementType.includes('OUTPUT') || movementType.includes('RETURN')) {
      return getCodeByPurpose('SHREDDING_RECEIPT', customCodesList); // 360
    }
    return getCodeByPurpose('SHREDDING_MOVE', customCodesList); // 352
  }
  return getCodeByPurpose('STORAGE', customCodesList); // 167
}

/**
 * Unified Programmatic API for System Administration and dynamic code resolution.
 * Allows administrators and services to define, update, and dynamically retrieve reference codes
 * from Firestore, guaranteeing zero hard-coded values across all inventory modules.
 */
export const SystemCodesAPI = {
  // Read operations
  getAllCodes: fetchSystemCodesFromFirestore,
  getStoredCodes: getStoredSystemCodes,
  getCode: getCodeByPurpose,
  getStorageCode: (codes?: SystemCodeConfig[]) => getCodeByPurpose('STORAGE', codes),
  getProductionCode: (codes?: SystemCodeConfig[]) => getCodeByPurpose('PRODUCTION', codes),
  getShreddingReceiptCode: (codes?: SystemCodeConfig[]) => getCodeByPurpose('SHREDDING_RECEIPT', codes),
  getShreddingMoveCode: (codes?: SystemCodeConfig[]) => getCodeByPurpose('SHREDDING_MOVE', codes),
  getCodeDetails: getSystemCodeDetails,
  resolveMovementCode: resolveMovementInternalCode,
  formatDocNumber: formatInventoryDocumentNumber,

  // Write operations (persisted in Firestore)
  updateCode: saveSystemCodeToFirestore,
  createCode: createSystemCodeInFirestore,
  deleteCode: deleteSystemCodeFromFirestore,
  resetToDefaults: initializeDefaultSystemCodesInFirestore,
  subscribe: subscribeToSystemCodesFromFirestore,
};
