/**
 * Hardscape ProQuote: house areas, the starter price list, and how a picked
 * sub-area + services + materials turns into one estimate line.
 */

export type HardscapeKind = 'service' | 'material';

export interface HardscapeCatalogItem {
  /** Saved row id, or a stable starter key before the pro saves the list. */
  id: string;
  kind: HardscapeKind;
  name: string;
  unit: string;
  rateCents: number;
}

export interface HardscapeArea {
  key: string;
  label: string;
  /** Empty means the area itself is the spot (house sides). */
  subareas: string[];
}

export const HARDSCAPE_AREAS: HardscapeArea[] = [
  { key: 'front', label: 'House Front', subareas: ['Driveway', 'Courtyard', 'Walkway', 'Front yard area'] },
  { key: 'left', label: 'House Left Side', subareas: [] },
  { key: 'right', label: 'House Right Side', subareas: [] },
  { key: 'back', label: 'Backyard', subareas: ['Pool deck', 'Back patio', 'Backyard area'] },
];

const service = (name: string, dollars: number, unit = 'sq ft'): Omit<HardscapeCatalogItem, 'id'> => ({
  kind: 'service', name, unit, rateCents: Math.round(dollars * 100),
});
const material = (name: string, dollars: number, unit = 'sq ft'): Omit<HardscapeCatalogItem, 'id'> => ({
  kind: 'material', name, unit, rateCents: Math.round(dollars * 100),
});

/** Starter list. Prices are placeholders the pro edits in "Prices". */
export const HARDSCAPE_STARTER: HardscapeCatalogItem[] = [
  service('Concrete removal', 3),
  service('Pavers removal', 2),
  service('Excavation and grading', 1.5),
  service('Base material', 2),
  service('Pavers installation', 8),
  service('Retaining wall installation', 35, 'LF'),
  service('Artificial turf installation', 6),
  service('Pavers sealing', 1.5),
  material('Pavers', 4),
  material('Wall block', 20, 'LF'),
  material('Artificial turf', 3),
  material('Silica sand', 0.25),
  material('Polymeric sand', 0.5),
  material('Edge restraint', 2, 'LF'),
  material('Sealer', 0.4),
].map((item, index) => ({ ...item, id: `starter-${index}` }));

/** Services that name the line ("Pavers installation on Driveway"). */
function isMain(name: string) {
  return /install/i.test(name);
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export interface QuoteSpot {
  area: string;
  subarea: string;
  services: HardscapeCatalogItem[];
  materials: HardscapeCatalogItem[];
  qty: number;
  unit: string;
}

/** "Pavers installation on Driveway, including concrete removal, base material and polymeric sand." */
export function spotTitle(spot: QuoteSpot): string {
  const main = spot.services.find((item) => isMain(item.name)) ?? spot.services[0];
  return main ? main.name : 'Hardscape work';
}

export function spotDescription(spot: QuoteSpot): string {
  const main = spot.services.find((item) => isMain(item.name)) ?? spot.services[0];
  const where = spot.subarea === spot.area ? spot.area : `${spot.subarea} (${spot.area})`;
  const rest = [
    ...spot.services.filter((item) => item !== main),
    ...spot.materials,
  ].map((item) => item.name.toLowerCase());
  const head = `${main ? main.name : 'Hardscape work'} on ${where}`;
  return rest.length ? `${head}, including ${joinList(rest)}.` : `${head}.`;
}

/** Price per unit: every picked service and material in the spot's unit. */
export function spotRateCents(spot: QuoteSpot): number {
  return [...spot.services, ...spot.materials]
    .filter((item) => item.unit === spot.unit)
    .reduce((sum, item) => sum + item.rateCents, 0);
}

/** Estimate line the regular estimate API accepts. */
export function spotLineItem(spot: QuoteSpot, rateCents: number) {
  const qty = Math.max(0, spot.qty);
  return {
    product_or_service: spotTitle(spot),
    description: spotDescription(spot),
    unit: spot.unit,
    qty,
    rate_cents: rateCents,
    amount_cents: Math.round(qty * rateCents),
  };
}
