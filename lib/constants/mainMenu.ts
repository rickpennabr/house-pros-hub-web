export const MAIN_MENU_KEYS = [
  'proJobs',
  'proSuppliers',
  'proProducts',
  'prosBlog',
  'housePros',
  'quickRepair',
] as const;

export type MainMenuKey = (typeof MAIN_MENU_KEYS)[number];

export const MAIN_MENU_LABELS: Record<MainMenuKey, string> = {
  proJobs: 'ProJobs',
  proSuppliers: 'ProSuppliers',
  proProducts: 'ProProducts',
  prosBlog: 'ProsBlog',
  housePros: 'HousePros',
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
  for (const key of MAIN_MENU_KEYS) {
    if (!picked.includes(key)) picked.push(key);
  }
  return picked;
}
