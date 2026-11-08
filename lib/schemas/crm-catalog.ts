import { z } from 'zod';
import { CATALOG_TERM_KINDS, PRODUCT_IMAGE_LIMIT, SERVICE_IMAGE_LIMIT } from '@/lib/crm/catalog-options';

const priceModeSchema = z.enum(['flat', 'unit', 'range']);

const catalogImageSchema = z.object({
  image_url: z.string().trim().min(1).max(1000),
  storage_path: z.string().trim().max(500).nullable().optional(),
  is_thumbnail: z.boolean().optional(),
});

const cents = z.number().int().min(0).max(100_000_000);

export const serviceWriteSchema = z
  .object({
    name: z.string().trim().min(1, 'Service name is required').max(160),
    category: z.string().trim().max(80).optional().default(''),
    description: z.string().trim().max(4000).optional().default(''),
    unit: z.string().trim().min(1).max(40).optional().default('each'),
    price_type: z.string().trim().min(1, 'Choose a price type').max(80),
    price_mode: priceModeSchema,
    price_cents: cents.optional().default(0),
    price_min_cents: cents.nullable().optional(),
    price_max_cents: cents.nullable().optional(),
    images: z.array(catalogImageSchema).max(SERVICE_IMAGE_LIMIT).optional().default([]),
  })
  .superRefine((value, ctx) => {
    if (value.price_mode !== 'range') return;
    if (value.price_min_cents == null || value.price_max_cents == null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a from price and a to price.', path: ['price_min_cents'] });
      return;
    }
    if (value.price_min_cents > value.price_max_cents) {
      ctx.addIssue({ code: 'custom', message: 'The from price cannot be higher than the to price.', path: ['price_min_cents'] });
    }
  });

const specSchema = z.object({
  name: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
});

export const productWriteSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(160),
  brand: z.string().trim().max(120).optional().default(''),
  sku: z.string().trim().max(80).optional().default(''),
  upc: z.string().trim().max(80).optional().default(''),
  category: z.string().trim().max(80).optional().default(''),
  description: z.string().trim().max(4000).optional().default(''),
  unit: z.string().trim().min(1).max(40).optional().default('each'),
  price_cents: cents.optional().default(0),
  images: z.array(catalogImageSchema).max(PRODUCT_IMAGE_LIMIT).optional().default([]),
  specs: z.array(specSchema).max(40).optional().default([]),
});

export const catalogTermWriteSchema = z
  .object({
    kind: z.enum(CATALOG_TERM_KINDS),
    label: z.string().trim().min(1, 'Name is required').max(80),
    price_mode: priceModeSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'price_type' && !value.price_mode) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose whether this price type uses one price, a unit price, or a from/to range.',
        path: ['price_mode'],
      });
    }
  });

export type ServiceWriteInput = z.infer<typeof serviceWriteSchema>;
export type ProductWriteInput = z.infer<typeof productWriteSchema>;
export type CatalogImageInput = z.infer<typeof catalogImageSchema>;
