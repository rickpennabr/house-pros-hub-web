import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import {
  DEFAULT_SLOT_MINUTES,
  DEFAULT_TIMEZONE,
  isSlotMinutes,
  parseWeekSchedule,
  type SlotMinutes,
  type WeekSchedule,
} from '@/lib/booking/businessHours';

export interface BusinessBookingWindow {
  id: string;
  ownerId: string;
  businessName: string;
  email: string | null;
  slug: string;
  timezone: string;
  bookingEnabled: boolean;
  slotMinutes: SlotMinutes;
  schedule: WeekSchedule;
  hoursConfigured: boolean;
}

type ServiceClient = SupabaseClient<Database>;

const FULL_COLUMNS =
  'id, owner_id, business_name, email, slug, operating_hours, timezone, show_calendar_on_procard, appointment_slot_minutes';
const BASE_COLUMNS =
  'id, owner_id, business_name, email, slug, operating_hours, timezone, show_calendar_on_procard';

function missingSlotColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('appointment_slot_minutes');
}

function toWindow(row: Record<string, unknown>): BusinessBookingWindow | null {
  if (!row.id || !row.owner_id) return null;
  const parsed = parseWeekSchedule(row.operating_hours);
  const slot = Number(row.appointment_slot_minutes);
  const slug = typeof row.slug === 'string' && row.slug.trim() ? row.slug.trim() : String(row.id);
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    businessName: String(row.business_name ?? ''),
    email: row.email ? String(row.email) : null,
    slug,
    timezone: typeof row.timezone === 'string' && row.timezone ? row.timezone : DEFAULT_TIMEZONE,
    bookingEnabled: row.show_calendar_on_procard === true,
    slotMinutes: isSlotMinutes(slot) ? slot : DEFAULT_SLOT_MINUTES,
    schedule: parsed.schedule,
    hoursConfigured: parsed.configured,
  };
}

export async function loadBusinessBookingWindow(
  service: ServiceClient,
  businessId: string
): Promise<BusinessBookingWindow | null> {
  let result = await service
    .from('businesses')
    .select(FULL_COLUMNS)
    .eq('id', businessId)
    .eq('is_active', true)
    .maybeSingle();
  if (missingSlotColumn(result.error)) {
    result = await service
      .from('businesses')
      .select(BASE_COLUMNS)
      .eq('id', businessId)
      .eq('is_active', true)
      .maybeSingle();
  }
  if (result.error || !result.data) return null;
  return toWindow(result.data as Record<string, unknown>);
}
