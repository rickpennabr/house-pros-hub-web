import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import {
  dateKeyInZone,
  dayKeyForDateKey,
  pruneSlots,
  slotsForDateKey,
  zonedDayRange,
  type BusyRange,
} from '@/lib/booking/businessHours';
import { loadBusinessBookingWindow, type BusinessBookingWindow } from '@/lib/booking/loadBookingWindow';

type ServiceClient = SupabaseClient<Database>;

export interface OpenSlot {
  start: string;
  end: string;
}

async function loadBusy(
  service: ServiceClient,
  window: BusinessBookingWindow,
  range: { start: Date; end: Date },
  ignoreBookingId?: string
): Promise<{ unavailable: BusyRange[]; available: BusyRange[]; bookings: BusyRange[] }> {
  const [blocks, bookings] = await Promise.all([
    service
      .from('pro_crm_availability')
      .select('start_at, end_at, type')
      .eq('owner_id', window.ownerId)
      .lt('start_at', range.end.toISOString())
      .gt('end_at', range.start.toISOString()),
    service
      .from('pro_estimate_bookings')
      .select('id, slot_start_at, slot_end_at')
      .eq('business_id', window.id)
      .eq('status', 'confirmed')
      .lt('slot_start_at', range.end.toISOString())
      .gt('slot_end_at', range.start.toISOString()),
  ]);

  const unavailable: BusyRange[] = [];
  const available: BusyRange[] = [];
  for (const row of blocks.data ?? []) {
    const rangeRow = { start: row.start_at, end: row.end_at };
    if (row.type === 'unavailable') unavailable.push(rangeRow);
    if (row.type === 'available') available.push(rangeRow);
  }
  return {
    unavailable,
    available,
    bookings: (bookings.data ?? [])
      .filter((row) => row.id !== ignoreBookingId)
      .map((row) => ({ start: row.slot_start_at, end: row.slot_end_at })),
  };
}

export async function openSlotsForDay(
  service: ServiceClient,
  businessId: string,
  dateKey: string,
  now = new Date(),
  ignoreBookingId?: string
): Promise<{ slots: OpenSlot[]; bookingEnabled: boolean; closed: boolean; timezone: string } | null> {
  const window = await loadBusinessBookingWindow(service, businessId);
  if (!window) return null;
  if (!window.bookingEnabled) {
    return { slots: [], bookingEnabled: false, closed: false, timezone: window.timezone };
  }
  const closed = !window.schedule[dayKeyForDateKey(dateKey, window.timezone)]?.open;
  const range = zonedDayRange(dateKey, window.timezone);
  const busy = await loadBusy(service, window, range, ignoreBookingId);
  const generated = slotsForDateKey({
    dateKey,
    schedule: window.schedule,
    timeZone: window.timezone,
    slotMinutes: window.slotMinutes,
    now,
  });
  const slots = pruneSlots(generated, busy).map((slot) => ({
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
  }));
  return { slots, bookingEnabled: true, closed, timezone: window.timezone };
}

/** True when this exact interval is still inside hours and not taken. */
export async function slotIsOpen(
  service: ServiceClient,
  businessId: string,
  start: Date,
  end: Date,
  ignoreBookingId?: string
): Promise<'missing' | 'disabled' | 'invalid' | 'taken' | 'ok'> {
  const window = await loadBusinessBookingWindow(service, businessId);
  if (!window) return 'missing';
  if (!window.bookingEnabled) return 'disabled';
  const dateKey = dateKeyInZone(start, window.timezone);
  const generated = slotsForDateKey({
    dateKey,
    schedule: window.schedule,
    timeZone: window.timezone,
    slotMinutes: window.slotMinutes,
  });
  const matches = generated.some(
    (slot) => slot.start.getTime() === start.getTime() && slot.end.getTime() === end.getTime()
  );
  if (!matches || end.getTime() - start.getTime() !== window.slotMinutes * 60 * 1000) return 'invalid';
  if (start.getTime() < Date.now() - 60 * 1000) return 'taken';

  const range = zonedDayRange(dateKey, window.timezone);
  const busy = await loadBusy(service, window, range, ignoreBookingId);
  const open = pruneSlots(generated, busy);
  const still = open.some((slot) => slot.start.getTime() === start.getTime() && slot.end.getTime() === end.getTime());
  return still ? 'ok' : 'taken';
}
