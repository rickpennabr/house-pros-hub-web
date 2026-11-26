/**
 * ProTrades: trade add-ons for the general CRM. A pro turns a trade on in /crm/protrades and its
 * tools appear in the CRM menu. Each trade comes with a hub-managed reference database
 * (trade_catalog_items) that pros browse and copy into their own products.
 */

export const TRADE_SLUGS = ['landscape', 'hardscape'] as const;
export type TradeSlug = (typeof TRADE_SLUGS)[number];

export interface TradeKind {
  slug: string;
  /** Default unit when a pro copies an item into their products. */
  unit: string;
}

export interface TradeTool {
  /** Path under /[locale]/crm */
  path: string;
  /** Key in the `protrades` messages namespace. */
  labelKey: string;
}

/** Tailwind classes for a trade's color (written out so Tailwind keeps them). */
export interface TradeColor {
  /** Icons and text, e.g. the menu icon. */
  text: string;
  /** Card and chip borders. */
  border: string;
  /** Light background. */
  soft: string;
  /** Solid background (active chips, the on switch). */
  solid: string;
  /** The same color as a CSS value, for SVG icons (ProTradesIcon tiles). */
  hex: string;
}

export interface TradeDefinition {
  slug: TradeSlug;
  /** False while a trade is being prepared: pros see "Coming soon"; the admin can still fill its database. */
  available: boolean;
  color: TradeColor;
  /** Lucide icon name used by the UI. */
  icon: 'Leaf' | 'BrickWall';
  kinds: TradeKind[];
  tools: TradeTool[];
}

export const TRADES: Record<TradeSlug, TradeDefinition> = {
  landscape: {
    slug: 'landscape',
    available: true,
    color: { text: 'text-green-700', border: 'border-green-700', soft: 'bg-green-50', solid: 'bg-green-700', hex: '#15803d' },
    icon: 'Leaf',
    // Rock yard items live in Hardscape and are shared here (trade_catalog_items.also_trades).
    kinds: [
      { slug: 'plant', unit: 'each' },
      { slug: 'rock', unit: 'ton' },
      { slug: 'boulder', unit: 'lb' },
      { slug: 'soil', unit: 'ton' },
      { slug: 'flagstone', unit: 'lb' },
    ],
    tools: [
      { path: '/protrades/landscape', labelKey: 'tool_plants' },
      { path: '/maintenance', labelKey: 'tool_maintenance' },
    ],
  },
  hardscape: {
    slug: 'hardscape',
    available: true,
    color: { text: 'text-orange-700', border: 'border-orange-700', soft: 'bg-orange-50', solid: 'bg-orange-700', hex: '#c2410c' },
    icon: 'BrickWall',
    kinds: [
      { slug: 'rock', unit: 'ton' },
      { slug: 'boulder', unit: 'lb' },
      { slug: 'soil', unit: 'ton' },
      { slug: 'flagstone', unit: 'lb' },
      { slug: 'paver', unit: 'sq ft' },
      { slug: 'wall_block', unit: 'each' },
      { slug: 'base', unit: 'ton' },
      { slug: 'sand', unit: 'bag' },
      { slug: 'edging', unit: 'linear ft' },
      { slug: 'fabric', unit: 'roll' },
      { slug: 'sealer', unit: 'gallon' },
      { slug: 'other', unit: 'each' },
    ],
    tools: [
      { path: '/protrades/hardscape', labelKey: 'tool_hardscapeProducts' },
      { path: '/protrades/hardscape/quote', labelKey: 'tool_hardscapeQuote' },
    ],
  },
};

/**
 * Plant categories, named the way Las Vegas nurseries group plants (Star Nursery: Trees, Palms, Shrubs,
 * Desert Accents, Cactus, Succulent, Vines), plus Perennial, Groundcover, Grass and Turf for landscape work.
 */
export const PLANT_CATEGORIES = ['Tree', 'Palm', 'Shrub', 'Perennial', 'Groundcover', 'Desert Accent', 'Succulent', 'Cactus', 'Grass', 'Vine', 'Turf'] as const;

/** Best guess of a hardscape item's type from its name, brand and category (used when importing products). */
/** Hardscape sources kept apart: the manufacturer paver catalog and the Star Nursery rock yard. */
export const HARDSCAPE_COLLECTIONS = [
  { slug: 'pavers', label: 'Pavers & wall (manufacturers)' },
  { slug: 'rock-yard', label: 'Rock yard (Star Nursery)' },
] as const;

export function guessHardscapeKind(text: string): string {
  const t = text.toLowerCase();
  if (/polymeric|joint sand|bedding sand|sand/.test(t)) return 'sand';
  if (/seal/.test(t)) return 'sealer';
  if (/fabric|geotextile|geogrid|weed barrier/.test(t)) return 'fabric';
  if (/edg|restraint|spike/.test(t)) return 'edging';
  if (/wall|block|cap|coping|column|pillar/.test(t)) return 'wall_block';
  if (/base|type ii|type 2|road ?base|aggregate|abc/.test(t)) return 'base';
  if (/rock|gravel|granite|dg|decomposed|boulder|rip ?rap|cobble|pebble/.test(t)) return 'rock';
  if (/paver|slab|plank|stone|travertine|flagstone|turf|tile/.test(t)) return 'paver';
  return 'other';
}

export function isTradeSlug(value: unknown): value is TradeSlug {
  return typeof value === 'string' && (TRADE_SLUGS as readonly string[]).includes(value);
}

export function defaultUnitFor(trade: TradeSlug, kind: string): string {
  return TRADES[trade].kinds.find((row) => row.slug === kind)?.unit ?? 'each';
}

/** CRM paths that belong to a trade (hidden from the menu while that trade is off). */
export function tradeForPath(path: string): TradeSlug | null {
  for (const trade of TRADE_SLUGS) {
    if (TRADES[trade].tools.some((tool) => path === tool.path || path.startsWith(`${tool.path}/`))) return trade;
  }
  return null;
}
