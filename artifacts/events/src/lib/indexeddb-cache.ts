const DB_NAME = "vision2020_cache_db";
const STORE_NAME = "api_cache";
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function setCache(key: string, data: any, ttlMs: number): Promise<void> {
  try {
    const db = await getDB();
    const expiry = Date.now() + ttlMs;
    const value = { data, expiry };

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("IndexedDB setCache error:", err);
    // Fallback to localStorage if IndexedDB is blocked
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({ data, expiry: Date.now() + ttlMs }));
    } catch (_) {}
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();

    const value: any = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    if (value && value.expiry > Date.now()) {
      return value.data as T;
    }
    
    // Expired or not found
    return null;
  } catch (err) {
    console.error("IndexedDB getCache error:", err);
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(`cache_${key}`);
      if (raw) {
        const value = JSON.parse(raw);
        if (value.expiry > Date.now()) {
          return value.data as T;
        }
      }
    } catch (_) {}
    return null;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (err) {
    console.error("IndexedDB clearCache error:", err);
    // Fallback
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("cache_")) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  }
}
