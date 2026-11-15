import { savedBusinessStorage } from '@/lib/storage/savedBusinessStorage';

export interface SaveState {
  saved: boolean;
  count: number;
}

const syncedUsers = new Set<string>();

/** Copy this browser's older saves into the database once, then drop the local copies. */
export async function syncLocalSavedBusinesses(userId: string): Promise<void> {
  if (syncedUsers.has(userId)) return;
  syncedUsers.add(userId);
  const ids = savedBusinessStorage.getSavedBusinessIds(userId);
  if (ids.length === 0) return;
  const results = await Promise.all(ids.map((businessId) => saveBusinessOnServer(businessId)));
  if (results.some((result) => result === null)) return;
  ids.forEach((businessId) => savedBusinessStorage.removeSavedBusiness(userId, businessId));
}

export async function fetchSaveState(businessId: string): Promise<SaveState | null> {
  try {
    const response = await fetch(`/api/saved-businesses?businessId=${encodeURIComponent(businessId)}`, {
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.count !== 'number' || typeof data.saved !== 'boolean') return null;
    return { saved: data.saved, count: data.count };
  } catch {
    return null;
  }
}

export async function fetchSavedBusinessIds(): Promise<string[] | null> {
  try {
    const response = await fetch('/api/saved-businesses', { credentials: 'include' });
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data.ids) ? data.ids.filter((id: unknown) => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

export async function saveBusinessOnServer(businessId: string): Promise<SaveState | null> {
  try {
    const response = await fetch('/api/saved-businesses', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.count !== 'number') return null;
    return { saved: true, count: data.count };
  } catch {
    return null;
  }
}

export async function unsaveBusinessOnServer(businessId: string): Promise<SaveState | null> {
  try {
    const response = await fetch(`/api/saved-businesses?businessId=${encodeURIComponent(businessId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (typeof data.count !== 'number') return null;
    return { saved: false, count: data.count };
  } catch {
    return null;
  }
}
