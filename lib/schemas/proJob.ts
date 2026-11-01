import { z } from 'zod';
import { SERVICE_CATEGORIES } from '@/lib/constants/categories';

const categoryLabels = new Set(SERVICE_CATEGORIES.map((category) => category.label));

export const proJobWriteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(4000),
  category: z.string().trim().refine((value) => categoryLabels.has(value), 'Choose a trade'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'hourly']),
  workplaceType: z.enum(['on_site', 'hybrid']),
  workplaceLanguage: z.enum(['en', 'es', 'bilingual']),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use a 2-letter state code'),
  pay: z.string().trim().max(40).optional(),
});

export type ProJobWrite = z.infer<typeof proJobWriteSchema>;
