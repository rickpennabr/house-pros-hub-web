import { z } from 'zod';

export const TOOL_KINDS = ['tool', 'equipment'] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const TOOL_STATUSES = ['available', 'in_use', 'repair', 'retired', 'lost'] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  available: 'Available',
  in_use: 'In use',
  repair: 'In repair',
  retired: 'Retired',
  lost: 'Lost / stolen',
};

/** Starting categories; pros can type their own. */
export const TOOL_CATEGORIES = [
  'Power tools',
  'Hand tools',
  'Lawn & garden',
  'Ladders & scaffolding',
  'Safety gear',
  'Measuring & layout',
  'Heavy equipment',
  'Trailers',
  'Generators & compressors',
  'Plumbing',
  'Electrical',
  'Painting',
  'Cleaning',
] as const;

/** Typical years an item lasts, used to suggest a useful life. */
export const DEFAULT_LIFE_YEARS: Record<ToolKind, number> = { tool: 3, equipment: 7 };

/** Every column, so daily_rate_cents (migration 167) comes back once it exists. */
export const TOOL_SELECT = '*';

export type ToolRow = {
  id: string;
  owner_id: string;
  kind: ToolKind;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  quantity: number;
  purchase_date: string | null;
  purchase_cents: number;
  useful_life_years: number | string;
  salvage_cents: number;
  /** Cost charged to a job for each day the item works there (migration 167). */
  daily_rate_cents?: number | null;
  status: ToolStatus;
  assigned_crew_id: string | null;
  project_id: string | null;
  maintenance_plan_id: string | null;
  location: string | null;
  next_service_date: string | null;
  photo_drive_file_id: string | null;
  note: string | null;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
};

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max).nullable().optional();

export const toolInputSchema = z.object({
  kind: z.enum(TOOL_KINDS),
  name: z.string().trim().min(1, 'Name the item.').max(120),
  category: text(60),
  brand: text(80),
  model: text(80),
  serialNumber: text(80),
  quantity: z.number().int().min(1).max(10000).default(1),
  purchaseDate: dateKey.nullable().optional(),
  /** Total paid for all units. */
  purchaseCents: z.number().int().min(0).max(100_000_000).default(0),
  usefulLifeYears: z.number().positive().max(50).default(5),
  salvageCents: z.number().int().min(0).max(100_000_000).default(0),
  /** Left out keeps the current rate (and works before migration 167). */
  dailyRateCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  status: z.enum(TOOL_STATUSES).default('available'),
  assignedCrewId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  maintenancePlanId: z.string().uuid().nullable().optional(),
  location: text(120),
  nextServiceDate: dateKey.nullable().optional(),
  photoDriveFileId: z.string().uuid().nullable().optional(),
  note: text(2000),
});
export type ToolInput = z.infer<typeof toolInputSchema>;

export function toolColumns(input: ToolInput) {
  return {
    kind: input.kind,
    name: input.name,
    category: input.category || null,
    brand: input.brand || null,
    model: input.model || null,
    serial_number: input.serialNumber || null,
    quantity: input.quantity,
    purchase_date: input.purchaseDate || null,
    purchase_cents: input.purchaseCents,
    useful_life_years: input.usefulLifeYears,
    salvage_cents: Math.min(input.salvageCents, input.purchaseCents),
    status: input.status,
    assigned_crew_id: input.assignedCrewId || null,
    project_id: input.projectId || null,
    maintenance_plan_id: input.maintenancePlanId || null,
    location: input.location || null,
    next_service_date: input.nextServiceDate || null,
    photo_drive_file_id: input.photoDriveFileId || null,
    note: input.note || null,
    ...(input.dailyRateCents !== undefined ? { daily_rate_cents: input.dailyRateCents } : {}),
    retired_at: input.status === 'retired' || input.status === 'lost' ? new Date().toISOString().slice(0, 10) : null,
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Straight-line book value on a date: cost drops evenly to salvage over the useful life.
 * Retired or lost items are worth nothing on the books.
 */
export function toolBookValueCents(
  tool: Pick<ToolRow, 'purchase_cents' | 'salvage_cents' | 'useful_life_years' | 'purchase_date' | 'status'>,
  asOf: string
): number {
  if (tool.status === 'retired' || tool.status === 'lost') return 0;
  const cost = tool.purchase_cents;
  const salvage = Math.min(tool.salvage_cents, cost);
  if (!tool.purchase_date || cost <= 0) return cost;
  const lifeDays = Number(tool.useful_life_years) * 365.25;
  const age = Math.max(0, daysBetween(tool.purchase_date, asOf));
  if (lifeDays <= 0 || age >= lifeDays) return salvage;
  return Math.round(cost - ((cost - salvage) * age) / lifeDays);
}

/** Depreciation for one year of use, for the valuation report. */
export function toolYearlyDepreciationCents(
  tool: Pick<ToolRow, 'purchase_cents' | 'salvage_cents' | 'useful_life_years'>
): number {
  const life = Number(tool.useful_life_years);
  if (life <= 0) return 0;
  return Math.round((tool.purchase_cents - Math.min(tool.salvage_cents, tool.purchase_cents)) / life);
}

export function serviceDue(nextServiceDate: string | null, today: string, withinDays = 14): 'overdue' | 'soon' | null {
  if (!nextServiceDate) return null;
  const days = daysBetween(today, nextServiceDate);
  if (days < 0) return 'overdue';
  if (days <= withinDays) return 'soon';
  return null;
}
