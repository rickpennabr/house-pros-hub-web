/**
 * Materials each hardscape service normally needs, with quantities worked out from the area size.
 * ProQuote adds them when the service is picked; the pro taps to swap a choice, untick, or edit a number.
 * Coverage numbers are common rules of thumb (Las Vegas yards sell base and sand by the ton).
 */

export interface DefaultMaterialOption {
  name: string;
  unit: string;
  /** Quantity per unit of area (sq ft, or LF for walls). */
  perUnit: number;
  /** Round up to whole units (bags, boxes, pallets). */
  whole?: boolean;
}

export interface DefaultMaterial {
  key: string;
  /** What it is for, shown above the choice: "Base", "Top sand". */
  role: string;
  /** First option is the default; more than one shows as buttons. */
  options: DefaultMaterialOption[];
  /** Pre-ticked (true) or offered but off. */
  on: boolean;
}

// Tons per sq ft for a depth in inches: cubic yards x tons per cubic yard.
const tons = (inches: number, tonsPerYard: number) => (inches / 12 / 27) * tonsPerYard;

export const SERVICE_DEFAULTS: { match: RegExp; materials: DefaultMaterial[] }[] = [
  {
    match: /paver.*install|install.*paver/i,
    materials: [
      { key: 'base', role: 'Base', on: true, options: [
        { name: 'Type 2 base', unit: 'ton', perUnit: tons(4, 1.4) },
        { name: 'Crushed rock base 3/4', unit: 'ton', perUnit: tons(4, 1.35) },
      ] },
      { key: 'bedding', role: 'Bedding sand', on: true, options: [
        { name: 'Washed concrete sand', unit: 'ton', perUnit: tons(1, 1.35) },
      ] },
      { key: 'pavers', role: 'Pavers', on: true, options: [
        { name: 'Pavers', unit: 'sq ft', perUnit: 1.05 },
      ] },
      { key: 'joint', role: 'Top sand', on: true, options: [
        { name: 'Polymeric sand', unit: 'bag', perUnit: 1 / 50, whole: true },
        { name: 'Regular base sand', unit: 'bag', perUnit: 1 / 75, whole: true },
        { name: 'Silica sand', unit: 'bag', perUnit: 1 / 75, whole: true },
      ] },
      { key: 'edge', role: 'Edge restraint', on: false, options: [
        { name: 'Edge restraint', unit: 'LF', perUnit: 0.4 },
      ] },
    ],
  },
  {
    match: /turf/i,
    materials: [
      { key: 'turf', role: 'Turf', on: true, options: [
        { name: 'Artificial turf', unit: 'sq ft', perUnit: 1.1 },
      ] },
      { key: 'base', role: 'Base', on: true, options: [
        { name: 'White chat', unit: 'ton', perUnit: tons(3, 1.35) },
        { name: 'Decomposed granite', unit: 'ton', perUnit: tons(3, 1.35) },
        { name: 'Type 2 base', unit: 'ton', perUnit: tons(3, 1.4) },
      ] },
      { key: 'barrier', role: 'Weed barrier', on: true, options: [
        { name: 'Weed barrier fabric', unit: 'sq ft', perUnit: 1.05 },
      ] },
      { key: 'nails', role: 'Nails', on: true, options: [
        { name: 'Turf nails 5"', unit: 'box', perUnit: 1 / 150, whole: true },
      ] },
      { key: 'infill', role: 'Top sand (infill)', on: true, options: [
        { name: 'Silica sand infill', unit: 'bag', perUnit: 1 / 35, whole: true },
        { name: 'Zeolite infill', unit: 'bag', perUnit: 1 / 50, whole: true },
        { name: 'Envirofill infill', unit: 'bag', perUnit: 1 / 50, whole: true },
      ] },
      { key: 'seam', role: 'Seam tape', on: false, options: [
        { name: 'Seam tape and glue', unit: 'roll', perUnit: 1 / 300, whole: true },
      ] },
    ],
  },
  {
    match: /retaining.*wall|wall.*install/i,
    materials: [
      { key: 'block', role: 'Wall block', on: true, options: [
        { name: 'Wall block', unit: 'each', perUnit: 3, whole: true },
      ] },
      { key: 'cap', role: 'Cap', on: true, options: [
        { name: 'Wall cap', unit: 'LF', perUnit: 1 },
      ] },
      { key: 'base', role: 'Footing base', on: true, options: [
        { name: 'Type 2 base', unit: 'ton', perUnit: 0.05 },
      ] },
      { key: 'drain', role: 'Drain rock', on: true, options: [
        { name: 'Drain rock 3/4', unit: 'ton', perUnit: 0.06 },
      ] },
      { key: 'pipe', role: 'Drain pipe', on: false, options: [
        { name: 'Perforated drain pipe 4"', unit: 'LF', perUnit: 1 },
      ] },
      { key: 'glue', role: 'Adhesive', on: true, options: [
        { name: 'Block adhesive', unit: 'tube', perUnit: 1 / 15, whole: true },
      ] },
    ],
  },
  {
    match: /base material/i,
    materials: [
      { key: 'base', role: 'Base', on: true, options: [
        { name: 'Type 2 base', unit: 'ton', perUnit: tons(4, 1.4) },
        { name: 'Crushed rock base 3/4', unit: 'ton', perUnit: tons(4, 1.35) },
      ] },
    ],
  },
  {
    match: /seal/i,
    materials: [
      { key: 'sealer', role: 'Sealer', on: true, options: [
        { name: 'Paver sealer', unit: 'gal', perUnit: 1 / 100, whole: true },
      ] },
    ],
  },
];

/** Default material rows for the picked services (no duplicates: the first service wins a role). */
export function defaultMaterialsFor(serviceNames: string[]): DefaultMaterial[] {
  const out: DefaultMaterial[] = [];
  const seen = new Set<string>();
  for (const name of serviceNames) {
    const entry = SERVICE_DEFAULTS.find((row) => row.match.test(name));
    for (const material of entry?.materials ?? []) {
      const id = material.options[0].name;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(material);
    }
  }
  return out;
}

/** Quantity for an area size, rounded to what a yard sells (2 decimals, or whole units). */
export function defaultQty(option: DefaultMaterialOption, size: number): number {
  if (!(size > 0)) return 0;
  const raw = option.perUnit * size;
  return option.whole ? Math.max(1, Math.ceil(raw)) : Math.max(0.01, Math.ceil(raw * 100) / 100);
}
