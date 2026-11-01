/**
 * ProEstimate / contractor calendar: standard 1.5-hour slots.
 * 7:00 AM first slot; last slot ends at 7:00 PM (5:30 PM–7:00 PM).
 */
export const SLOT_START_MINUTES = 7 * 60; // 7:00 AM
export const SLOT_END_MINUTES = 19 * 60; // 7:00 PM (last slot must end by this time)
export const SLOT_DURATION_MS = 90 * 60 * 1000; // 1.5 hours
export const SLOT_STEP_MINUTES = 90;

/** Build all standard slot { start, end } for a given day (local date). */
export function getStandardSlotsForDay(dayStart: Date): { start: Date; end: Date }[] {
  const dayEndCutoff = new Date(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate(),
    19,
    0,
    0
  );
  const slots: { start: Date; end: Date }[] = [];
  for (let minutes = SLOT_START_MINUTES; minutes < SLOT_END_MINUTES; minutes += SLOT_STEP_MINUTES) {
    const start = new Date(dayStart.getTime() + minutes * 60 * 1000);
    const end = new Date(start.getTime() + SLOT_DURATION_MS);
    if (end > dayEndCutoff) continue;
    slots.push({ start, end });
  }
  return slots;
}
