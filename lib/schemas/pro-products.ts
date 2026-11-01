import { z } from 'zod';

const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Photo must be an https URL');

const catalogImage = z.union([z.literal(''), httpsUrl, z.string().trim().max(1000).startsWith('/')]);

const palletCount = z.number().int().min(0).max(100000);

export const proProductWriteSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  brand: z.string().trim().max(120),
  product_type: z.string().trim().max(80),
  description: z.string().trim().max(4000),
  image_url: catalogImage.optional(),
});

export const productVariantWriteSchema = z
  .object({
    color: z.string().trim().max(80),
    size: z.string().trim().max(40),
    thickness_mm: z.string().trim().max(20),
    thickness_in: z.string().trim().max(20),
    sqft_pallet: palletCount,
    sqft_layer: palletCount,
    lnft_pallet: palletCount,
    layer_pallet: palletCount,
    pcs_pallet: palletCount,
  })
  .refine(
    (value) => Boolean(value.color || value.size || value.thickness_mm || value.thickness_in),
    'Add a color, size, or thickness'
  );

export type ProProductWrite = z.infer<typeof proProductWriteSchema>;
export type ProductVariantWrite = z.infer<typeof productVariantWriteSchema>;
