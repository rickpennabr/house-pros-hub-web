import { dateKeyInZone, DEFAULT_TIMEZONE, minutesSinceMidnight } from '@/lib/booking/businessHours';

/** 7:00 in the pro's timezone, for a visit at 8:00 or later. */
const MORNING_MINUTES = 7 * 60;
/** Don't send before 5:00, even for a very early visit. */
const EARLIEST_MINUTES = 5 * 60;
/** Visits that start at least an hour after 7:00 use the 7:00 send. */
const STANDARD_VISIT_MINUTES = MORNING_MINUTES + 60;
/** Skip a second email when the customer just booked and already got the confirmation. */
export const REMINDER_MIN_AGE_MS = 2 * 60 * 60 * 1000;

export function safeTimeZone(timeZone: string | null | undefined): string {
  const zone = timeZone?.trim() || DEFAULT_TIMEZONE;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
    return zone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Earliest local minute-of-day to send the reminder for a visit that starts at `slotStartMinutes`. */
export function reminderSendAtMinutes(slotStartMinutes: number): number {
  if (slotStartMinutes >= STANDARD_VISIT_MINUTES) return MORNING_MINUTES;
  return Math.max(EARLIEST_MINUTES, slotStartMinutes - 60);
}

export interface DayOfReminderInput {
  now: Date;
  slotStartAt: Date;
  createdAt: Date;
  timeZone: string | null | undefined;
  status: string;
  alreadySent: boolean;
}

/**
 * Send once, on the morning of the visit, in the pro's timezone.
 * Visits at 8:00 or later are reminded at 7:00. Earlier visits are reminded
 * one hour before, and never before 5:00. A booking made in the last two hours
 * keeps the confirmation only.
 */
export function shouldSendDayOfReminder(input: DayOfReminderInput): boolean {
  if (input.alreadySent) return false;
  if (input.status !== 'confirmed') return false;
  if (Number.isNaN(input.slotStartAt.getTime()) || Number.isNaN(input.createdAt.getTime())) return false;
  if (input.now.getTime() >= input.slotStartAt.getTime()) return false;
  if (input.now.getTime() - input.createdAt.getTime() < REMINDER_MIN_AGE_MS) return false;

  const zone = safeTimeZone(input.timeZone);
  if (dateKeyInZone(input.slotStartAt, zone) !== dateKeyInZone(input.now, zone)) return false;

  const nowMinutes = minutesSinceMidnight(input.now, zone);
  const startMinutes = minutesSinceMidnight(input.slotStartAt, zone);
  return nowMinutes >= reminderSendAtMinutes(startMinutes);
}
