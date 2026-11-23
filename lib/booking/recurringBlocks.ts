import { DAY_KEYS, addDaysToDateKey, dayKeyForDateKey, zonedLocalToUtc, type BusyRange } from '@/lib/booking/businessHours';

/** One repeating busy time. weekdays: 0 = Monday ... 6 = Sunday. Times are "HH:MM" in the business timezone. */
export interface RecurringBlock {
  id: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
  every_weeks: number;
  starts_on: string;
  ends_on: string | null;
  note: string | null;
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from a to b ("YYYY-MM-DD"), calendar-only (no timezone). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Monday of the week holding this date key (calendar-only). */
function mondayOf(dateKey: string): string {
  const weekday = (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  return addDaysToDateKey(dateKey, -weekday);
}

/** Whether the block applies on this calendar day. */
export function blockOnDate(block: RecurringBlock, dateKey: string, timeZone: string): boolean {
  if (dateKey < block.starts_on) return false;
  if (block.ends_on && dateKey > block.ends_on) return false;
  const day = DAY_KEYS.indexOf(dayKeyForDateKey(dateKey, timeZone));
  if (!block.weekdays.includes(day)) return false;
  const every = Math.max(1, block.every_weeks || 1);
  if (every === 1) return true;
  const weeks = Math.floor(daysBetween(mondayOf(block.starts_on), mondayOf(dateKey)) / 7);
  return weeks % every === 0;
}

/** Busy ranges these blocks make on one day. */
export function recurringBusyForDate(blocks: RecurringBlock[], dateKey: string, timeZone: string): BusyRange[] {
  return blocks
    .filter((block) => HM.test(block.start_time) && HM.test(block.end_time) && blockOnDate(block, dateKey, timeZone))
    .map((block) => ({
      start: zonedLocalToUtc(dateKey, block.start_time, timeZone).toISOString(),
      end: zonedLocalToUtc(dateKey, block.end_time, timeZone).toISOString(),
    }));
}

/** Every occurrence between two date keys (inclusive), for showing on the calendar. */
export function recurringOccurrences(
  blocks: RecurringBlock[],
  fromKey: string,
  toKey: string,
  timeZone: string
): Array<{ block: RecurringBlock; start: string; end: string }> {
  const out: Array<{ block: RecurringBlock; start: string; end: string }> = [];
  for (let key = fromKey, guard = 0; key <= toKey && guard < 400; key = addDaysToDateKey(key, 1), guard++) {
    for (const block of blocks) {
      if (!HM.test(block.start_time) || !HM.test(block.end_time) || !blockOnDate(block, key, timeZone)) continue;
      out.push({
        block,
        start: zonedLocalToUtc(key, block.start_time, timeZone).toISOString(),
        end: zonedLocalToUtc(key, block.end_time, timeZone).toISOString(),
      });
    }
  }
  return out;
}

/** Validate a create request body. Returns the row to insert or an error message. */
export function parseRecurringBlockInput(
  body: Record<string, unknown>
): { ok: true; row: Omit<RecurringBlock, 'id'> } | { ok: false; error: string } {
  const weekdays = Array.isArray(body.weekdays)
    ? [...new Set(body.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : [];
  if (weekdays.length === 0) return { ok: false, error: 'Pick at least one day' };
  const start = String(body.startTime ?? body.start_time ?? '');
  const end = String(body.endTime ?? body.end_time ?? '');
  if (!HM.test(start) || !HM.test(end) || end <= start) return { ok: false, error: 'End time must be after start time' };
  const every = Number(body.everyWeeks ?? body.every_weeks ?? 1);
  if (!Number.isInteger(every) || every < 1 || every > 8) return { ok: false, error: 'Repeat must be every 1 to 8 weeks' };
  const isDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const startsOn = isDate(body.startsOn) ? (body.startsOn as string) : new Date().toISOString().slice(0, 10);
  const endsOn = isDate(body.endsOn) ? (body.endsOn as string) : null;
  if (endsOn && endsOn < startsOn) return { ok: false, error: 'End date must be after the start date' };
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null;
  return {
    ok: true,
    row: { weekdays, start_time: start, end_time: end, every_weeks: every, starts_on: startsOn, ends_on: endsOn, note },
  };
}
