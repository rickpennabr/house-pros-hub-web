export const DEFAULT_BUSINESS_TAB_ORDER = [
  'contact',
  'hours',
  'services',
  'products',
  'properties',
  'trades',
  'links',
  'images',
  'about',
] as const;

export type BusinessDetailsTab = (typeof DEFAULT_BUSINESS_TAB_ORDER)[number];

const TAB_SET = new Set<string>(DEFAULT_BUSINESS_TAB_ORDER);

export function normalizeBusinessTabOrder(value: unknown): BusinessDetailsTab[] {
  const order: BusinessDetailsTab[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string' || !TAB_SET.has(item)) continue;
      const tab = item as BusinessDetailsTab;
      if (!order.includes(tab)) order.push(tab);
    }
  }
  for (const tab of DEFAULT_BUSINESS_TAB_ORDER) {
    if (!order.includes(tab)) order.push(tab);
  }
  return order;
}

/** Reorder the tabs on screen and keep hidden tabs in their saved slots. */
export function reorderVisibleTabs(
  fullOrder: BusinessDetailsTab[],
  visible: BusinessDetailsTab[],
  from: number,
  to: number
): BusinessDetailsTab[] {
  if (from === to || from < 0 || to < 0 || from >= visible.length || to >= visible.length) {
    return fullOrder;
  }
  const nextVisible = [...visible];
  const [moved] = nextVisible.splice(from, 1);
  if (!moved) return fullOrder;
  nextVisible.splice(to, 0, moved);
  const visibleSet = new Set(visible);
  let index = 0;
  return fullOrder.map((tab) => (visibleSet.has(tab) ? nextVisible[index++] : tab));
}
