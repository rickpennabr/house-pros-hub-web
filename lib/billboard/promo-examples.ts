/**
 * Example promotions for ProBillboard's "Show me an example" button: one per trade, picked from what
 * the business says about itself (trade, licenses, services, name). Painting when nothing matches.
 */

export interface PromoExample {
  /** Trade this example is for (shown on the button: "Example: Pavers"). */
  trade: string;
  headline: string;
  body: string;
  badge: string;
  ctaLabel: string;
  /** Days the offer runs, from today. */
  days: number;
}

interface ExampleRule {
  /** Words that point to this trade (lowercase, matched as word starts). */
  keywords: string[];
  example: PromoExample;
}

const PAINTING: PromoExample = {
  trade: 'Painting',
  headline: 'Fresh Paint, 20% Off Labor',
  body: 'Book an interior or exterior paint job this month and save 20% on labor. Clean lines, covered floors, and we clean up every day.',
  badge: '20% off',
  ctaLabel: 'Get a free estimate',
  days: 30,
};

/** Order matters: the first rule with a match wins, so specific trades come before general ones. */
const RULES: ExampleRule[] = [
  {
    keywords: ['paver', 'hardscape', 'travertine', 'porcelain', 'coping', 'flagstone', 'retaining wall', 'masonry'],
    example: {
      trade: 'Pavers',
      headline: 'Free Paver Sealing With Any New Patio',
      body: 'Install a new paver patio, walkway or pool deck this month and we seal it for free. Protects the color and keeps weeds out.',
      badge: 'FREE sealing',
      ctaLabel: 'Get a free estimate',
      days: 30,
    },
  },
  {
    keywords: ['turf', 'landscap', 'lawn', 'irrigation', 'sprinkler', 'tree', 'garden', 'yard'],
    example: {
      trade: 'Landscaping',
      headline: 'Artificial Turf: $500 Off Your Yard',
      body: 'Say goodbye to watering and mowing. Save $500 on any turf installation over 500 sq ft, booked this month.',
      badge: '$500 off',
      ctaLabel: 'Book a free visit',
      days: 30,
    },
  },
  {
    keywords: ['pool', 'spa'],
    example: {
      trade: 'Pool',
      headline: 'First Month of Pool Service, Half Price',
      body: 'Weekly cleaning, chemicals balanced and equipment checked. New customers pay half for the first month.',
      badge: '50% off',
      ctaLabel: 'Start service',
      days: 45,
    },
  },
  {
    keywords: ['plumb', 'drain', 'water heater', 'leak', 'pipe', 'sewer'],
    example: {
      trade: 'Plumbing',
      headline: 'Water Heater Flush for $79',
      body: 'Sediment shortens your water heater’s life. We flush it, check the valve and look for leaks, all for one flat price.',
      badge: '$79',
      ctaLabel: 'Book now',
      days: 30,
    },
  },
  {
    keywords: ['electric', 'lighting', 'panel', 'ev charger', 'outlet', 'wiring'],
    example: {
      trade: 'Electrical',
      headline: 'Free Safety Check With Any Electrical Job',
      body: 'Book any electrical service and we inspect your panel, outlets and smoke detectors at no extra cost.',
      badge: 'FREE check',
      ctaLabel: 'Schedule a visit',
      days: 30,
    },
  },
  {
    keywords: ['hvac', 'air condition', 'a/c', 'heating', 'furnace', 'cooling', 'duct'],
    example: {
      trade: 'HVAC',
      headline: 'A/C Tune-Up for $89',
      body: 'Beat the heat before it hits. Full tune-up, filter change and refrigerant check so your system runs cool and efficient.',
      badge: '$89 tune-up',
      ctaLabel: 'Book a tune-up',
      days: 30,
    },
  },
  {
    keywords: ['roof', 'gutter', 'shingle'],
    example: {
      trade: 'Roofing',
      headline: 'Free Roof Inspection',
      body: 'Small leaks become big repairs. We check tiles, flashing and underlayment and send you photos of everything we find.',
      badge: 'FREE',
      ctaLabel: 'Book an inspection',
      days: 30,
    },
  },
  {
    keywords: ['floor', 'tile', 'carpet', 'hardwood', 'vinyl', 'laminate'],
    example: {
      trade: 'Flooring',
      headline: '15% Off New Floors',
      body: 'Tile, vinyl plank or hardwood: save 15% on installation for any room booked this month. Free measuring.',
      badge: '15% off',
      ctaLabel: 'Get a free quote',
      days: 30,
    },
  },
  {
    keywords: ['clean', 'maid', 'janitor', 'window wash', 'pressure wash', 'power wash'],
    example: {
      trade: 'Cleaning',
      headline: 'First Deep Clean $50 Off',
      body: 'Top to bottom, inside the oven and behind the fridge. New customers save $50 on their first deep clean.',
      badge: '$50 off',
      ctaLabel: 'Book a cleaning',
      days: 30,
    },
  },
  {
    keywords: ['pest', 'termite', 'exterminat', 'rodent', 'scorpion'],
    example: {
      trade: 'Pest control',
      headline: 'First Pest Treatment $49',
      body: 'Inside and out, safe for kids and pets. Start quarterly service with a $49 first treatment.',
      badge: '$49',
      ctaLabel: 'Book now',
      days: 30,
    },
  },
  {
    keywords: ['concrete', 'driveway', 'stucco'],
    example: {
      trade: 'Concrete',
      headline: 'Driveway Repair: 10% Off',
      body: 'Cracks, stains or sunken slabs: we repair and reseal driveways and walkways. Save 10% when you book this month.',
      badge: '10% off',
      ctaLabel: 'Get a free estimate',
      days: 30,
    },
  },
  {
    keywords: ['remodel', 'kitchen', 'bathroom', 'cabinet', 'countertop', 'general contractor', 'construction'],
    example: {
      trade: 'Remodeling',
      headline: 'Free 3D Design With Your Remodel',
      body: 'See your new kitchen or bathroom before we build it. Book a remodel this month and the 3D design is on us.',
      badge: 'FREE design',
      ctaLabel: 'Book a consultation',
      days: 45,
    },
  },
  {
    keywords: ['paint', 'drywall', 'stain'],
    example: PAINTING,
  },
  {
    keywords: ['handyman', 'repair', 'install', 'assembly', 'mount'],
    example: {
      trade: 'Handyman',
      headline: 'Your To-Do List, Done in One Visit',
      body: 'Leaky faucet, loose door, TV to mount? Book a 2-hour visit and get the second hour 50% off.',
      badge: '2nd hour 50% off',
      ctaLabel: 'Book a visit',
      days: 30,
    },
  },
];

/**
 * Long words match as stems ("landscap" in "landscaping"); short ones only as whole words, plural
 * allowed ("spa" is not in "space", "tile" is in "tiles").
 */
function keywordPattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}${word.length <= 4 ? 's?([^a-z]|$)' : ''}`);
}

/** The example for this business. `hints` are its trade, other trades, licenses, services and name. */
export function promoExampleFor(hints: Array<string | null | undefined>): PromoExample {
  const text = ` ${hints.filter(Boolean).join(' | ').toLowerCase().replace(/[_-]/g, ' ')} `;
  if (!text.trim()) return PAINTING;
  for (const rule of RULES) {
    if (rule.keywords.some((word) => keywordPattern(word).test(text))) return rule.example;
  }
  return PAINTING;
}

/** yyyy-mm-dd for a date input, `days` from `from`. */
export function dateInputValue(from: Date, days = 0): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
