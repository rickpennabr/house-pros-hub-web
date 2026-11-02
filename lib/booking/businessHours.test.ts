import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dateKeyInZone,
  dayKeyForDateKey,
  parseWeekSchedule,
  slotsForDateKey,
  zonedLocalToUtc,
} from './businessHours';

describe('business hours slots', () => {
  it('maps Pacific wall time to UTC, including daylight saving', () => {
    const winter = zonedLocalToUtc('2026-01-05', '08:00', 'America/Los_Angeles');
    assert.equal(winter.toISOString(), '2026-01-05T16:00:00.000Z');
    const summer = zonedLocalToUtc('2026-07-06', '08:00', 'America/Los_Angeles');
    assert.equal(summer.toISOString(), '2026-07-06T15:00:00.000Z');
  });

  it('builds 90-minute slots inside open hours and skips closed days', () => {
    const { schedule } = parseWeekSchedule({
      monday: { open: true, start: '08:00', end: '12:00' },
      sunday: { open: false, start: '09:00', end: '13:00' },
    });
    const monday = slotsForDateKey({
      dateKey: '2026-01-05',
      schedule,
      timeZone: 'America/Los_Angeles',
      slotMinutes: 90,
    });
    assert.deepEqual(
      monday.map((slot) => slot.start.toISOString()),
      ['2026-01-05T16:00:00.000Z', '2026-01-05T17:30:00.000Z']
    );
    const sunday = slotsForDateKey({
      dateKey: '2026-01-11',
      schedule,
      timeZone: 'America/Los_Angeles',
      slotMinutes: 90,
    });
    assert.equal(sunday.length, 0);
    assert.equal(dayKeyForDateKey('2026-01-05', 'America/Los_Angeles'), 'monday');
  });

  it('reads the civil date in the business timezone', () => {
    const instant = new Date('2026-01-05T07:30:00.000Z');
    assert.equal(dateKeyInZone(instant, 'America/Los_Angeles'), '2026-01-04');
    assert.equal(dateKeyInZone(instant, 'America/New_York'), '2026-01-05');
  });
});
