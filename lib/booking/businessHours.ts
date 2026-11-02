/**
 * Weekly business hours and appointment slots.
 * Times are HH:mm on a civil date in the business IANA timezone.
 */

export const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
}

export type WeekSchedule = Record<DayKey, DayHours>;

export const SLOT_MINUTE_OPTIONS = [30, 45, 60, 90, 120] as const;
export type SlotMinutes = (typeof SLOT_MINUTE_OPTIONS)[number];

export const DEFAULT_SLOT_MINUTES: SlotMinutes = 90;
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export const BUSINESS_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Phoenix',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Sao_Paulo',
] as const;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_SCHEDULE: WeekSchedule = {
  monday: { open: true, start: '08:00', end: '17:00' },
  tuesday: { open: true, start: '08:00', end: '17:00' },
  wednesday: { open: true, start: '08:00', end: '17:00' },
  thursday: { open: true, start: '08:00', end: '17:00' },
  friday: { open: true, start: '08:00', end: '17:00' },
  saturday: { open: false, start: '09:00', end: '13:00' },
  sunday: { open: false, start: '09:00', end: '13:00' },
};

export function isSlotMinutes(value: number): value is SlotMinutes {
  return (SLOT_MINUTE_OPTIONS as readonly number[]).includes(value);
}

export function minutesOf(timeHm: string): number | null {
  const match = TIME_RE.exec(timeHm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function cloneSchedule(schedule: WeekSchedule): WeekSchedule {
  return DAY_KEYS.reduce((acc, day) => {
    acc[day] = { ...schedule[day] };
    return acc;
  }, {} as WeekSchedule);
}

/** Accept a saved JSON schedule. Unknown or empty input falls back to weekday 8–5. */
export function parseWeekSchedule(raw: unknown): { schedule: WeekSchedule; configured: boolean } {
  const schedule = cloneSchedule(DEFAULT_SCHEDULE);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { schedule, configured: false };
  }
  const source = raw as Record<string, unknown>;
  let recognized = false;
  for (const day of DAY_KEYS) {
    const value = source[day];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const start = typeof row.start === 'string' && minutesOf(row.start) != null ? row.start : schedule[day].start;
    const end = typeof row.end === 'string' && minutesOf(row.end) != null ? row.end : schedule[day].end;
    const startMin = minutesOf(start);
    const endMin = minutesOf(end);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    const open = typeof row.open === 'boolean' ? row.open : false;
    schedule[day] = { open, start, end };
    recognized = true;
  }
  return { schedule, configured: recognized };
}

export function scheduleIsValid(schedule: WeekSchedule): boolean {
  return DAY_KEYS.every((day) => {
    const row = schedule[day];
    if (!row) return false;
    const start = minutesOf(row.start);
    const end = minutesOf(row.end);
    return typeof row.open === 'boolean' && start != null && end != null && end > start;
  });
}

function partMap(instant: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}

/** Milliseconds to add to a UTC reading of the wall clock to reach the real instant. */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const map = partMap(instant, timeZone);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - instant.getTime();
}

/** Wall-clock date + HH:mm in `timeZone` → UTC instant. */
export function zonedLocalToUtc(dateKey: string, timeHm: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeHm.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const corrected = utcGuess - timeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - timeZoneOffsetMs(new Date(corrected), timeZone));
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function zonedDayRange(dateKey: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedLocalToUtc(dateKey, '00:00', timeZone),
    end: zonedLocalToUtc(addDaysToDateKey(dateKey, 1), '00:00', timeZone),
  };
}

export function dateKeyInZone(instant: Date, timeZone: string): string {
  const map = partMap(instant, timeZone);
  return `${map.year}-${map.month}-${map.day}`;
}

export function dayKeyForDateKey(dateKey: string, timeZone: string): DayKey {
  const noon = zonedLocalToUtc(dateKey, '12:00', timeZone);
  const name = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(noon).toLowerCase();
  return (DAY_KEYS as readonly string[]).includes(name) ? (name as DayKey) : 'monday';
}

export function weekdayLabel(day: DayKey, locale: string): string {
  const anchors: Record<DayKey, string> = {
    monday: '2026-01-05',
    tuesday: '2026-01-06',
    wednesday: '2026-01-07',
    thursday: '2026-01-08',
    friday: '2026-01-09',
    saturday: '2026-01-10',
    sunday: '2026-01-11',
  };
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${anchors[day]}T12:00:00Z`)
  );
}

export function formatHm(timeHm: string, locale: string): string {
  const [hour, minute] = timeHm.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2026, 0, 5, hour, minute)));
}

export function minutesSinceMidnight(instant: Date, timeZone: string): number {
  const map = partMap(instant, timeZone);
  return (Number(map.hour) % 24) * 60 + Number(map.minute);
}

export interface SlotInterval {
  start: Date;
  end: Date;
}

export function slotsForDateKey(input: {
  dateKey: string;
  schedule: WeekSchedule;
  timeZone: string;
  slotMinutes: number;
  now?: Date;
}): SlotInterval[] {
  const day = input.schedule[dayKeyForDateKey(input.dateKey, input.timeZone)];
  if (!day?.open) return [];
  const open = zonedLocalToUtc(input.dateKey, day.start, input.timeZone);
  const close = zonedLocalToUtc(input.dateKey, day.end, input.timeZone);
  const duration = input.slotMinutes * 60 * 1000;
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const nowMs = input.now?.getTime();
  const slots: SlotInterval[] = [];
  for (let cursor = open.getTime(); cursor + duration <= close.getTime(); cursor += duration) {
    if (nowMs != null && cursor < nowMs) continue;
    slots.push({ start: new Date(cursor), end: new Date(cursor + duration) });
  }
  return slots;
}

export interface BusyRange {
  start: string;
  end: string;
}

/** Drop slots that hit time off, an existing booking, or sit outside an explicit available window. */
export function pruneSlots(
  slots: SlotInterval[],
  args: { unavailable: BusyRange[]; available: BusyRange[]; bookings: BusyRange[] }
): SlotInterval[] {
  const hasAvailable = args.available.length > 0;
  return slots.filter((slot) => {
    const start = slot.start.getTime();
    const end = slot.end.getTime();
    if (hasAvailable) {
      const fits = args.available.some(
        (window) => new Date(window.start).getTime() <= start && new Date(window.end).getTime() >= end
      );
      if (!fits) return false;
    }
    const overlaps = (ranges: BusyRange[]) =>
      ranges.some((range) => new Date(range.start).getTime() < end && new Date(range.end).getTime() > start);
    return !overlaps(args.unavailable) && !overlaps(args.bookings);
  });
}
