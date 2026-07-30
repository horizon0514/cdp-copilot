const DB_NAME = 'cdp-copilot';
const DB_VERSION = 1;
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDBRequest failed'));
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const value = await reqToPromise(tx.objectStore(STORE).get(key));
    return value as T | undefined;
  } finally {
    db.close();
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await reqToPromise(tx.objectStore(STORE).put(value, key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

export async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    await reqToPromise(tx.objectStore(STORE).delete(key));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

/** Test helper — wipe the whole DB. */
export async function idbClearAll(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => resolve();
  });
}
