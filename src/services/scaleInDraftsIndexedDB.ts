/**
 * Scale-In Form Drafts Persistence Engine (IndexedDB)
 * Al-Karwan Plastics Factory - Receiving & Weighbridge Management
 *
 * Saves partially filled scale-in forms to IndexedDB so users can effortlessly
 * resume entry after accidental page refreshes, tab closures, or network interruptions.
 */

import { openScanHistoryDB } from './scanHistoryIndexedDB';
import { MaterialCondition } from '../types';

export const SCALE_IN_DRAFT_KEY = 'scale_in_active_draft';
export const SCALE_IN_DRAFT_LS_KEY = 'alkarwan_scale_in_draft_backup';
const DRAFTS_STORE = 'scale_in_drafts';

export interface ScaleInFormData {
  supplierId: string;
  materialId: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  scaleInWeightKG: number;
  bulkBagsCount: number;
  legacyDocumentNumber: string;
  unloadingBay: string;
  materialCondition: MaterialCondition;
  requiresShredding: boolean;
  notes: string;
  targetWarehouseId?: string;
  targetLocationId?: string;
}

export interface ScaleInDraftSummary {
  supplierName?: string;
  materialName?: string;
  vehiclePlate?: string;
  driverName?: string;
  weightKG: number;
  bagsCount: number;
  hasUnsavedChanges: boolean;
}

export interface ScaleInDraft {
  id: string; // 'scale_in_active_draft'
  savedAt: string; // ISO string
  displaySavedAt: string; // formatted time e.g. "12:05:30"
  dateStamp: string; // e.g. "2026-10-03"
  formData: ScaleInFormData;
  summary: ScaleInDraftSummary;
}

/**
 * Checks whether the form data contains meaningful user entries that warrant saving as a draft
 */
export function hasMeaningfulDraftContent(formData: Partial<ScaleInFormData>): boolean {
  if (!formData) return false;
  const hasPlate = Boolean(formData.vehiclePlate && formData.vehiclePlate.trim().length > 0);
  const hasDriver = Boolean(formData.driverName && formData.driverName.trim().length > 0);
  const hasPhone = Boolean(formData.driverPhone && formData.driverPhone.trim().length > 0);
  const hasDoc = Boolean(formData.legacyDocumentNumber && formData.legacyDocumentNumber.trim().length > 0);
  const hasNotes = Boolean(formData.notes && formData.notes.trim().length > 0);

  return hasPlate || hasDriver || hasPhone || hasDoc || hasNotes;
}

/**
 * Save a scale-in form draft to IndexedDB with localStorage synchronization
 */
export async function saveScaleInDraftToIndexedDB(
  formData: ScaleInFormData,
  extraSummary?: Partial<ScaleInDraftSummary>
): Promise<ScaleInDraft> {
  const now = new Date();
  const draft: ScaleInDraft = {
    id: SCALE_IN_DRAFT_KEY,
    savedAt: now.toISOString(),
    displaySavedAt: now.toLocaleTimeString('en-GB', { hour12: false }),
    dateStamp: now.toISOString().slice(0, 10),
    formData: { ...formData },
    summary: {
      vehiclePlate: formData.vehiclePlate,
      driverName: formData.driverName,
      weightKG: formData.scaleInWeightKG,
      bagsCount: formData.bulkBagsCount,
      hasUnsavedChanges: true,
      ...extraSummary,
    },
  };

  // Immediate mirror to localStorage for fail-safe retrieval
  try {
    localStorage.setItem(SCALE_IN_DRAFT_LS_KEY, JSON.stringify(draft));
  } catch (e) {
    console.warn('[Drafts] LocalStorage sync warning:', e);
  }

  // Persist to IndexedDB
  try {
    const db = await openScanHistoryDB();
    if (db.objectStoreNames.contains(DRAFTS_STORE)) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DRAFTS_STORE, 'readwrite');
        const store = tx.objectStore(DRAFTS_STORE);
        const req = store.put(draft);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.warn('[Drafts] IndexedDB write failed, backed up in localStorage only:', err);
  }

  return draft;
}

/**
 * Load the active scale-in draft from IndexedDB, falling back to localStorage if needed
 */
export async function loadScaleInDraftFromIndexedDB(): Promise<ScaleInDraft | null> {
  let draftFromDB: ScaleInDraft | null = null;

  try {
    const db = await openScanHistoryDB();
    if (db.objectStoreNames.contains(DRAFTS_STORE)) {
      draftFromDB = await new Promise<ScaleInDraft | null>((resolve) => {
        const tx = db.transaction(DRAFTS_STORE, 'readonly');
        const store = tx.objectStore(DRAFTS_STORE);
        const req = store.get(SCALE_IN_DRAFT_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }
  } catch (err) {
    console.warn('[Drafts] IndexedDB load failed, trying localStorage:', err);
  }

  if (draftFromDB && draftFromDB.formData) {
    return draftFromDB;
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(SCALE_IN_DRAFT_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.formData) {
        return parsed as ScaleInDraft;
      }
    }
  } catch (e) {
    console.warn('[Drafts] Error reading localStorage draft backup:', e);
  }

  return null;
}

/**
 * Delete / clear the active scale-in draft from IndexedDB and localStorage (e.g. after submit or discard)
 */
export async function deleteScaleInDraftFromIndexedDB(): Promise<void> {
  try {
    localStorage.removeItem(SCALE_IN_DRAFT_LS_KEY);
  } catch {}

  try {
    const db = await openScanHistoryDB();
    if (db.objectStoreNames.contains(DRAFTS_STORE)) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DRAFTS_STORE, 'readwrite');
        const store = tx.objectStore(DRAFTS_STORE);
        const req = store.delete(SCALE_IN_DRAFT_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  } catch (err) {
    console.warn('[Drafts] IndexedDB draft deletion failed:', err);
  }
}
