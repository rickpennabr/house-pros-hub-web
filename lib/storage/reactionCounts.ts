/**
 * Reaction counts are not stored on the business row.
 * They stay on this device until a server write exists.
 */

const STORAGE_KEY = 'hph-reaction-counts';

export interface ReactionCounts {
  love?: number;
  feedback?: number;
  link?: number;
  save?: number;
}

function readAll(): Record<string, ReactionCounts> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ReactionCounts>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readReactionCounts(businessId: string): ReactionCounts | null {
  if (!businessId) return null;
  return readAll()[businessId] ?? null;
}

export function writeReactionCounts(businessId: string, counts: ReactionCounts): void {
  if (!businessId || typeof window === 'undefined') return;
  try {
    const all = readAll();
    all[businessId] = counts;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    console.error('Error saving reaction counts:', error);
  }
}
