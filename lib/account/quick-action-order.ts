const EMPTY_ORDER: string[] = [];
const orderListeners = new Set<() => void>();
let cachedKey: string | null = null;
let cachedRaw: string | null = null;
let cachedOrder: string[] = EMPTY_ORDER;

export function subscribeQuickActionOrder(listener: () => void): () => void {
  orderListeners.add(listener);
  return () => orderListeners.delete(listener);
}

/** Cached so useSyncExternalStore can compare the same array until the order changes. */
export function getQuickActionOrder(key: string | null): string[] {
  if (!key || typeof window === 'undefined') return EMPTY_ORDER;
  const raw = localStorage.getItem(key);
  if (cachedKey === key && cachedRaw === raw) return cachedOrder;
  cachedKey = key;
  cachedRaw = raw;
  cachedOrder = readQuickActionOrder(raw);
  return cachedOrder;
}

export function writeQuickActionOrder(key: string, ids: string[]): void {
  const raw = JSON.stringify(ids);
  localStorage.setItem(key, raw);
  cachedKey = key;
  cachedRaw = raw;
  cachedOrder = ids;
  orderListeners.forEach((listener) => listener());
}

export function readQuickActionOrder(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids: string[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && item && !ids.includes(item)) ids.push(item);
    }
    return ids;
  } catch {
    return [];
  }
}

export function sortBySavedOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ai = rank.get(a.id);
    const bi = rank.get(b.id);
    return (ai ?? order.length) - (bi ?? order.length);
  });
}

/** Move a visible card and keep cards that are hidden right now in their saved slots. */
export function applyQuickActionMove(
  saved: string[],
  visibleIds: string[],
  fromId: string,
  toId: string,
): string[] {
  const visibleRanked = sortBySavedOrder(
    visibleIds.map((id) => ({ id })),
    saved,
  ).map((item) => item.id);
  const from = visibleRanked.indexOf(fromId);
  const to = visibleRanked.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return saved;

  const nextVisible = [...visibleRanked];
  const [moved] = nextVisible.splice(from, 1);
  if (!moved) return saved;
  nextVisible.splice(to, 0, moved);

  const visibleSet = new Set(visibleIds);
  const full = [...saved];
  for (const id of visibleIds) {
    if (!full.includes(id)) full.push(id);
  }

  let index = 0;
  return full.map((id) => {
    if (!visibleSet.has(id)) return id;
    const next = nextVisible[index];
    index += 1;
    return next ?? id;
  });
}
