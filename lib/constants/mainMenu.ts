export const MAIN_MENU_KEYS = [
  'proJobs',
  'proSuppliers',
  'proProducts',
  'prosBlog',
  'housePros',
  'feed',
  'quickRepair',
] as const;

export type MainMenuKey = (typeof MAIN_MENU_KEYS)[number];

export const MAIN_MENU_LABELS: Record<MainMenuKey, string> = {
  proJobs: 'ProJobs',
  proSuppliers: 'ProSuppliers',
  proProducts: 'ProProducts',
  prosBlog: 'ProsBlog',
  housePros: 'HousePros',
  feed: 'HubFeed',
  quickRepair: 'Quick Repair',
};

const ALLOWED = new Set<string>(MAIN_MENU_KEYS);

export function normalizeMainMenuOrder(value: unknown): MainMenuKey[] {
  const picked: MainMenuKey[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string' || !ALLOWED.has(item) || picked.includes(item as MainMenuKey)) continue;
      picked.push(item as MainMenuKey);
    }
  }
  // A key missing from a saved order (a newly added menu item) goes right after the key that
  // comes before it by default, so Feed lands beside Pros instead of at the end.
  MAIN_MENU_KEYS.forEach((key, index) => {
    if (picked.includes(key)) return;
    const before = index > 0 ? picked.indexOf(MAIN_MENU_KEYS[index - 1]) : -1;
    picked.splice(before + 1, 0, key);
  });
  return picked;
}
