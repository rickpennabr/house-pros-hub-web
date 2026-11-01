import { z } from 'zod';

const skillSchema = z.string().trim().min(1).max(40);

export const proResumeExperienceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().max(120).default(''),
  company: z.string().trim().max(120).default(''),
  city: z.string().trim().max(80).default(''),
  startDate: z.string().trim().max(20).default(''),
  endDate: z.string().trim().max(20).default(''),
  current: z.boolean().default(false),
  description: z.string().trim().max(2000).default(''),
});

export const proResumeEducationSchema = z.object({
  id: z.string().trim().min(1).max(80),
  school: z.string().trim().max(160).default(''),
  credential: z.string().trim().max(160).default(''),
  endDate: z.string().trim().max(20).default(''),
});

export const proResumeSchema = z.object({
  fullName: z.string().trim().max(120).default(''),
  headline: z.string().trim().max(160).default(''),
  email: z.string().trim().max(160).default(''),
  phone: z.string().trim().max(40).default(''),
  city: z.string().trim().max(80).default(''),
  state: z.string().trim().max(2).default(''),
  summary: z.string().trim().max(2000).default(''),
  skills: z.array(skillSchema).max(30).default([]),
  experience: z.array(proResumeExperienceSchema).max(15).default([]),
  education: z.array(proResumeEducationSchema).max(10).default([]),
});

export type ProResume = z.infer<typeof proResumeSchema>;
export type ProResumeExperience = z.infer<typeof proResumeExperienceSchema>;
export type ProResumeEducation = z.infer<typeof proResumeEducationSchema>;

export function emptyProResume(): ProResume {
  return {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    summary: '',
    skills: [],
    experience: [],
    education: [],
  };
}

export function newEntryId(): string {
  return crypto.randomUUID();
}

/** Easy Apply needs a name, a way to reach the installer, and some work history or skills. */
export function proResumeReady(resume: ProResume): boolean {
  const contact = resume.email.trim().length > 0 || resume.phone.trim().length > 0;
  const worked = resume.experience.some((job) => job.title.trim().length > 0 && job.company.trim().length > 0);
  const story = worked || resume.skills.length > 0 || resume.summary.trim().length >= 40;
  return resume.fullName.trim().length > 0 && contact && story;
}

function keepValid<T>(items: unknown, schema: z.ZodType<T>, limit: number): T[] {
  if (!Array.isArray(items)) return [];
  const kept: T[] = [];
  for (const item of items) {
    const row = item && typeof item === 'object' ? { ...(item as Record<string, unknown>) } : null;
    if (!row) continue;
    if (typeof row.id !== 'string' || row.id.trim().length === 0) row.id = crypto.randomUUID();
    const parsed = schema.safeParse(row);
    if (parsed.success) kept.push(parsed.data);
    if (kept.length >= limit) break;
  }
  return kept;
}

export function parseProResume(value: unknown): ProResume {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const skills = Array.isArray(raw.skills)
    ? raw.skills
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0 && item.length <= 40)
        .slice(0, 30)
    : [];
  const parsed = proResumeSchema.safeParse({
    ...raw,
    state: typeof raw.state === 'string' ? raw.state.trim().toUpperCase().slice(0, 2) : '',
    skills,
    experience: keepValid(raw.experience, proResumeExperienceSchema, 15),
    education: keepValid(raw.education, proResumeEducationSchema, 10),
  });
  if (!parsed.success) return emptyProResume();
  const state = parsed.data.state.toUpperCase();
  return { ...parsed.data, state: /^[A-Z]{2}$/.test(state) ? state : '' };
}
