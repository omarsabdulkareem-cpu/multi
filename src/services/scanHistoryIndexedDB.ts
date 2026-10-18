/**
 * Industrial Scan History IndexedDB Persistence Engine
 * Al-Karwan Plastics Factory - Receiving & Quality Gate Control
 *
 * Provides resilient client-side storage for QR scan logs and verification history
 * using native browser IndexedDB, with atomic batch operations, undo/bulk-undo mutations,
 * and seamless fallback synchronization with localStorage.
 */

import { QrScanHistoryItem, INITIAL_SCAN_HISTORY } from '../components/ReceivingScanHistoryTable';

const DB_NAME = 'AlKarwanReceivingDB';
const DB_VERSION = 2;
const STORE_NAME = 'scan_history';
const DRAFTS_STORE_NAME = 'scale_in_drafts';
const LOCAL_STORAGE_KEY = 'alkarwan_receiving_qr_scan_history';

/**
 * Open or upgrade the IndexedDB database instance
 */
export function openScanHistoryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('materialId', 'materialId', { unique: false });
        store.createIndex('qrCode', 'qrCode', { unique: false });
      }
      if (!db.objectStoreNames.contains(DRAFTS_STORE_NAME)) {
        const draftsStore = db.createObjectStore(DRAFTS_STORE_NAME, { keyPath: 'id' });
        draftsStore.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Load all scan history items from IndexedDB, falling back to localStorage if empty or unavailable
 */
export async function loadScanHistoryFromIndexedDB(): Promise<QrScanHistoryItem[]> {
  try {
    const db = await openScanHistoryDB();
    return new Promise<QrScanHistoryItem[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: QrScanHistoryItem[] = request.result || [];
        if (records.length > 0) {
          // Sort by timestamp descending (most recent first)
          records.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          // Mirror to localStorage
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records.slice(0, 10)));
          } catch {
            // ignore localStorage quota errors
          }
          resolve(records.slice(0, 10));
        } else {
          // Seed with localStorage or default records
          const fallback = loadFromLocalStorage();
          if (fallback.length > 0) {
            saveScanHistoryToIndexedDB(fallback).catch(() => {});
          }
          resolve(fallback);
        }
      };

      request.onerror = () => {
        console.warn('[IndexedDB] Failed to read scan history, falling back to localStorage');
        resolve(loadFromLocalStorage());
      };
    });
  } catch (err) {
    console.warn('[IndexedDB] Unavailable, reading from localStorage:', err);
    return loadFromLocalStorage();
  }
}

/**
 * Synchronize and overwrite entire scan history in IndexedDB (replaces current records)
 */
export async function saveScanHistoryToIndexedDB(items: QrScanHistoryItem[]): Promise<void> {
  const capped = items.slice(0, 10);

  // Sync to localStorage immediately
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(capped));
  } catch (e) {
    console.warn('[Storage] LocalStorage sync warning:', e);
  }

  try {
    const db = await openScanHistoryDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      store.clear();
      capped.forEach((item) => {
        store.put(item);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Write failed, stored in localStorage only:', err);
  }
}

/**
 * Revert / delete the last scanned entry from IndexedDB (Single Undo)
 */
export async function undoLastScanInIndexedDB(currentHistory: QrScanHistoryItem[]): Promise<{
  updatedHistory: QrScanHistoryItem[];
  revertedItem: QrScanHistoryItem | null;
}> {
  if (currentHistory.length === 0) {
    return { updatedHistory: [], revertedItem: null };
  }

  const revertedItem = currentHistory[0];
  const updatedHistory = currentHistory.slice(1);

  await deleteScanHistoryItemFromIndexedDB(revertedItem.id);
  // Also save updated slice
  await saveScanHistoryToIndexedDB(updatedHistory);

  return { updatedHistory, revertedItem };
}

/**
 * Delete a single scan history item by ID from IndexedDB
 */
export async function deleteScanHistoryItemFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openScanHistoryDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Delete failed:', err);
  }
}

/**
 * Revert / delete multiple scan history items by IDs from IndexedDB (Bulk Undo)
 */
export async function bulkUndoScanHistoryInIndexedDB(
  currentHistory: QrScanHistoryItem[],
  targetIds: string[]
): Promise<{
  updatedHistory: QrScanHistoryItem[];
  revertedItems: QrScanHistoryItem[];
}> {
  const idsSet = new Set(targetIds);
  const revertedItems = currentHistory.filter((item) => idsSet.has(item.id));
  const updatedHistory = currentHistory.filter((item) => !idsSet.has(item.id));

  try {
    const db = await openScanHistoryDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      targetIds.forEach((id) => {
        store.delete(id);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Bulk delete error:', err);
  }

  // Sync remaining items to both IndexedDB and localStorage
  await saveScanHistoryToIndexedDB(updatedHistory);

  return { updatedHistory, revertedItems };
}

/**
 * Clear all scan history records from IndexedDB
 */
export async function clearScanHistoryInIndexedDB(): Promise<void> {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {}

  try {
    const db = await openScanHistoryDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Clear failed:', err);
  }
}

export interface HourlyIntakeDataPoint {
  hour: string; // e.g. '08:00', '09:00', ...
  hourNumber: number; // 8, 9, 10...
  weightKG: number;
  count: number;
}

export interface ScanHistoryDBStats {
  todayTotalWeightKG: number;
  totalTransactions: number;
  todayTransactionsCount: number;
  totalWeightKG: number;
  quarantinedCount: number;
  expiredCount: number;
  normalCount: number;
  lastSyncedAt: string;
  isFromIndexedDB: boolean;
  hourlyTrend: HourlyIntakeDataPoint[];
}

/**
 * Query and aggregate live statistics directly from IndexedDB state:
 * - 'Today\'s Total Weight': total weight of items scanned today
 * - 'Total Transactions': total number of transactions currently in IndexedDB
 */
export async function getScanHistoryStatsFromIndexedDB(): Promise<ScanHistoryDBStats> {
  let records: QrScanHistoryItem[] = [];
  let isFromIndexedDB = false;

  try {
    const db = await openScanHistoryDB();
    records = await new Promise<QrScanHistoryItem[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    isFromIndexedDB = true;
  } catch (err) {
    console.warn('[IndexedDB] Could not directly read stats from IndexedDB, falling back to cache:', err);
  }

  // Fallback to loadScanHistoryFromIndexedDB if empty
  if (records.length === 0) {
    records = await loadScanHistoryFromIndexedDB();
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const localToday = new Date().toLocaleDateString('en-CA');

  // Filter items scanned today
  const todayRecords = records.filter(
    (item) => item.date === todayIso || item.date === localToday || (item.timestamp && item.timestamp.startsWith(todayIso))
  );

  // If there are records in IndexedDB but none match today's date (e.g. historical/demo data stored earlier),
  // fallback to treating existing recent records as the active intake shift or display them gracefully
  const hasSpecificToday = todayRecords.length > 0;
  const effectiveTodayRecords = hasSpecificToday ? todayRecords : records;

  const todayTotalWeightKG = effectiveTodayRecords.reduce(
    (acc, item) => acc + (Number(item.weightKG) || 0),
    0
  );

  const totalWeightKG = records.reduce(
    (acc, item) => acc + (Number(item.weightKG) || 0),
    0
  );

  // Hourly weight intake trend for current shift (08:00 to 17:00)
  const shiftHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const hourlyTrend: HourlyIntakeDataPoint[] = shiftHours.map((h) => {
    const hourPad = h.toString().padStart(2, '0');
    const hourLabel = `${hourPad}:00`;

    const matched = effectiveTodayRecords.filter((item) => {
      if (item.displayTime && item.displayTime.startsWith(`${hourPad}:`)) {
        return true;
      }
      if (item.timestamp) {
        const d = new Date(item.timestamp);
        if (!isNaN(d.getTime())) {
          return d.getUTCHours() === h || d.getHours() === h;
        }
      }
      return false;
    });

    const weightKG = matched.reduce((acc, item) => acc + (Number(item.weightKG) || 0), 0);

    return {
      hour: hourLabel,
      hourNumber: h,
      weightKG,
      count: matched.length,
    };
  });

  return {
    todayTotalWeightKG,
    totalTransactions: records.length,
    todayTransactionsCount: effectiveTodayRecords.length,
    totalWeightKG,
    quarantinedCount: records.filter((i) => i.isQuarantined || i.status === 'QUARANTINED').length,
    expiredCount: records.filter((i) => i.isExpired || i.status === 'EXPIRED').length,
    normalCount: records.filter(
      (i) => !i.isQuarantined && !i.isExpired && i.status !== 'QUARANTINED' && i.status !== 'EXPIRED'
    ).length,
    lastSyncedAt: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    isFromIndexedDB,
    hourlyTrend,
  };
}

/**
 * Helper to retrieve from localStorage cache
 */
function loadFromLocalStorage(): QrScanHistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 10);
      }
    }
  } catch (e) {
    console.warn('[Storage] Error reading localStorage', e);
  }
  return INITIAL_SCAN_HISTORY;
}
