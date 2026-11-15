import { UNIT_OPTIONS } from '@/lib/constants/unitOptions';
import { SERVICE_CATEGORIES } from '@/lib/constants/categories';

/** How the price fields render for a service price type. */
export type PriceMode = 'flat' | 'unit' | 'range';

export interface PriceTypeOption {
  label: string;
  mode: PriceMode;
}

/** Built-in price types. Custom types are saved per contractor and keep one of these layouts. */
export const BUILTIN_PRICE_TYPES: PriceTypeOption[] = [
  { label: 'Unit price', mode: 'unit' },
  { label: 'Start at', mode: 'flat' },
  { label: 'Range price', mode: 'range' },
];

const PRICE_TYPE_ALIASES: Record<string, PriceMode> = {
  'unit price': 'unit',
  'start at': 'flat',
  'starting at': 'flat',
  default: 'flat',
  'range price': 'range',
  'price range': 'range',
};

export const SERVICE_IMAGE_LIMIT = 5;
export const PRODUCT_IMAGE_LIMIT = 8;

/** Starting points for a hardscape and landscape catalog. Contractors can save any other category. */
export const SUGGESTED_SERVICE_CATEGORIES = [
  'Installation',
  'Repair',
  'Design',
  'Maintenance',
  'Cleanup',
  'Consultation',
];

/** Same trades as an estimate, plus Hardscape. A contractor can type any other trade. */
export const SUGGESTED_SERVICE_TRADES = [
  'Hardscape',
  ...SERVICE_CATEGORIES.map((category) => category.label),
];

export const SUGGESTED_PRODUCT_CATEGORIES = [
  'Pavers',
  'Wall block',
  'Edging',
  'Gravel',
  'Mulch',
  'Soil',
  'Plants',
  'Lighting',
  'Drainage',
  'Tools',
];

export const SUGGESTED_SPEC_NAMES = ['Color', 'Size', 'Material', 'Thickness', 'Coverage', 'Weight'];

export const CATALOG_TERM_KINDS = [
  'service_category',
  'service_trade',
  'product_category',
  'unit',
  'price_type',
  'spec_name',
] as const;

export type CatalogTermKind = (typeof CATALOG_TERM_KINDS)[number];

const BUILTIN_UNIT_LABELS = new Set(UNIT_OPTIONS.map((option) => option.value.toLowerCase()));

export function isBuiltinUnit(value: string): boolean {
  return BUILTIN_UNIT_LABELS.has(value.trim().toLowerCase());
}

export function isBuiltinPriceType(value: string): boolean {
  return builtinPriceMode(value) != null;
}

export function builtinPriceMode(value: string): PriceMode | null {
  return PRICE_TYPE_ALIASES[value.trim().toLowerCase()] ?? null;
}

/** Current label for a built-in type, including older names such as Default and Price range. */
export function priceTypeLabel(value: string): string {
  const mode = builtinPriceMode(value);
  if (!mode) return value;
  return BUILTIN_PRICE_TYPES.find((option) => option.mode === mode)?.label ?? value;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

export function formatServicePrice(service: {
  price_mode: PriceMode;
  price_cents: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  unit: string;
}): string {
  if (service.price_mode === 'range') {
    return `${formatCents(service.price_min_cents ?? 0)} – ${formatCents(service.price_max_cents ?? 0)}`;
  }
  if (service.price_mode === 'unit') {
    return `${formatCents(service.price_cents)} / ${service.unit || 'each'}`;
  }
  return formatCents(service.price_cents);
}
