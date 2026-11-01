/** Keep in sync with the share-target writer in public/sw.js. */
const DB_NAME = 'hph-quick-repair';
const STORE = 'draft';
const KEY = 'current';

export interface QuickRepairDraftPhoto {
  name: string;
  type: string;
  blob: Blob | null;
  driveId: string | null;
}

export interface QuickRepairDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  trade: string;
  description: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  photos: QuickRepairDraftPhoto[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the repair draft'));
  });
}

/** Keep the photo and the form on this device until the account exists. */
export async function saveQuickRepairDraft(draft: QuickRepairDraft): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(draft, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not save the repair draft'));
  });
  db.close();
}

export async function loadQuickRepairDraft(): Promise<QuickRepairDraft | null> {
  const db = await openDb();
  const draft = await new Promise<QuickRepairDraft | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve((request.result as QuickRepairDraft | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read the repair draft'));
  });
  db.close();
  if (!draft || !Array.isArray(draft.photos)) return null;
  return draft;
}

export async function clearQuickRepairDraft(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Could not clear the repair draft'));
  });
  db.close();
}
