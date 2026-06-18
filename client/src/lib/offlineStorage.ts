// IndexedDB-based offline storage for user-specific quest data.
// Each record is keyed by userId + date, so no cross-user leakage on shared devices.

const DB_NAME = "dinoinvest-offline";
const DB_VERSION = 1;
const QUEST_STORE = "quests";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEST_STORE)) {
        const store = db.createObjectStore(QUEST_STORE, { keyPath: "cacheKey" });
        store.createIndex("savedAt", "savedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface OfflineQuestRecord {
  cacheKey: string;
  userId: string;
  date: string;
  quests: unknown[];
  savedAt: number;
}

function makeCacheKey(userId: string, date: string) {
  return `${userId}::${date}`;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export async function saveQuestsOffline(userId: string, quests: unknown[]): Promise<void> {
  try {
    const db = await openDB();
    const date = getTodayStr();
    const record: OfflineQuestRecord = {
      cacheKey: makeCacheKey(userId, date),
      userId,
      date,
      quests,
      savedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEST_STORE, "readwrite");
      tx.objectStore(QUEST_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OfflineStorage] Failed to save quests:", err);
  }
}

export async function loadQuestsOffline(userId: string): Promise<unknown[] | null> {
  try {
    const db = await openDB();
    const date = getTodayStr();
    const record = await new Promise<OfflineQuestRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(QUEST_STORE, "readonly");
      const req = tx.objectStore(QUEST_STORE).get(makeCacheKey(userId, date));
      req.onsuccess = () => resolve(req.result as OfflineQuestRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    if (record && record.quests.length > 0) {
      return record.quests;
    }
    return null;
  } catch (err) {
    console.warn("[OfflineStorage] Failed to load quests:", err);
    return null;
  }
}

export async function pruneOldQuestRecords(keepDays = 7): Promise<void> {
  try {
    const db = await openDB();
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEST_STORE, "readwrite");
      const index = tx.objectStore(QUEST_STORE).index("savedAt");
      const range = IDBKeyRange.upperBound(cutoff);
      const req = index.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[OfflineStorage] Prune error:", err);
  }
}
