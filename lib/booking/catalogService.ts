import { z } from 'zod';

export const SERVICE_PRICE_TYPES = ['fixed', 'starting_at', 'range'] as const;
export const SERVICE_UNITS = ['job', 'hour', 'sqft', 'each'] as const;

export type ServicePriceType = (typeof SERVICE_PRICE_TYPES)[number];
export type ServiceUnit = (typeof SERVICE_UNITS)[number];

export interface CatalogService {
  id: string;
  businessId: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  priceMaxCents: number | null;
  priceType: ServicePriceType;
  unit: ServiceUnit;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export const bookingServiceInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(200).optional().default(''),
    category: z.string().trim().max(80).optional().default(''),
    price: z.coerce.number().min(0).max(99999.99),
    priceMax: z.preprocess(
      (value) => (value === '' || value == null ? null : Number(value)),
      z.number().min(0).max(99999.99).nullable()
    ),
    priceType: z.enum(SERVICE_PRICE_TYPES),
    unit: z.enum(SERVICE_UNITS),
    imageUrl: z.string().trim().max(2000).optional().nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.priceType !== 'range') return;
    if (data.priceMax == null || !Number.isFinite(data.priceMax)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter the high price',
        path: ['priceMax'],
      });
      return;
    }
    if (data.priceMax < data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The high price must be at least the low price',
        path: ['priceMax'],
      });
    }
  });

export type BookingServiceInput = z.infer<typeof bookingServiceInputSchema>;

export function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

export function formatCatalogPrice(
  service: Pick<CatalogService, 'priceCents' | 'priceMaxCents' | 'priceType' | 'unit'>,
  locale: string,
  labels: { requestPrice: string; from: string; units: Record<ServiceUnit, string> }
): string {
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(cents / 100);
  const unit = labels.units[service.unit];
  const hasRange = service.priceType === 'range' && service.priceMaxCents != null && service.priceMaxCents > 0;
  if (!hasRange && service.priceCents <= 0) return labels.requestPrice;
  if (hasRange) {
    return `${money(service.priceCents)}–${money(service.priceMaxCents ?? 0)} / ${unit}`;
  }
  if (service.priceType === 'starting_at') {
    return `${labels.from} ${money(service.priceCents)} / ${unit}`;
  }
  return `${money(service.priceCents)} / ${unit}`;
}
