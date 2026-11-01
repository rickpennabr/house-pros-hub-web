import { z } from 'zod';

export const BLOG_LOCALES = ['en', 'es', 'pt'] as const;
export const BLOG_CATEGORIES = ['hardscape', 'landscape'] as const;

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Cover image must be an https URL');

export const blogPostWriteSchema = z.object({
  locale: z.enum(BLOG_LOCALES),
  title: z.string().trim().min(1, 'Title is required').max(180),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens'),
  excerpt: z.string().trim().max(400, 'Excerpt must be 400 characters or fewer'),
  body: z.string().trim().min(1, 'Article text is required').max(40000),
  category: z.enum(BLOG_CATEGORIES),
  region: z.string().trim().min(1, 'Region is required').max(80),
  cover_image_url: z.union([z.literal(''), httpsUrl]).optional(),
  published: z.boolean(),
});

export type BlogPostWrite = z.infer<typeof blogPostWriteSchema>;
