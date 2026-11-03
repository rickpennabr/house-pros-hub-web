import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldSendDayOfReminder } from './dayOfReminder';

const ZONE = 'America/Los_Angeles';

function at(iso: string): Date {
  return new Date(iso);
}

describe('day-of booking reminder', () => {
  const createdYesterday = at('2026-01-05T20:00:00.000Z');

  it('sends at 7:00 Pacific for an afternoon visit booked the day before', () => {
    assert.equal(
      shouldSendDayOfReminder({
        now: at('2026-01-06T15:00:00.000Z'),
        slotStartAt: at('2026-01-06T22:00:00.000Z'),
        createdAt: createdYesterday,
        timeZone: ZONE,
        status: 'confirmed',
        alreadySent: false,
      }),
      true
    );
  });

  it('waits until 7:00 Pacific', () => {
    assert.equal(
      shouldSendDayOfReminder({
        now: at('2026-01-06T14:59:00.000Z'),
        slotStartAt: at('2026-01-06T22:00:00.000Z'),
        createdAt: createdYesterday,
        timeZone: ZONE,
        status: 'confirmed',
        alreadySent: false,
      }),
      false
    );
  });

  it('sends at 7:00 Pacific during daylight saving', () => {
    assert.equal(
      shouldSendDayOfReminder({
        now: at('2026-07-06T14:00:00.000Z'),
        slotStartAt: at('2026-07-06T21:00:00.000Z'),
        createdAt: at('2026-07-05T18:00:00.000Z'),
        timeZone: ZONE,
        status: 'confirmed',
        alreadySent: false,
      }),
      true
    );
  });

  it('reminds a 7:30 visit from 6:30 and stops once the visit starts', () => {
    const visit = at('2026-01-06T15:30:00.000Z');
    const input = {
      slotStartAt: visit,
      createdAt: createdYesterday,
      timeZone: ZONE,
      status: 'confirmed' as const,
      alreadySent: false,
    };
    assert.equal(shouldSendDayOfReminder({ ...input, now: at('2026-01-06T14:00:00.000Z') }), false);
    assert.equal(shouldSendDayOfReminder({ ...input, now: at('2026-01-06T14:30:00.000Z') }), true);
    assert.equal(shouldSendDayOfReminder({ ...input, now: at('2026-01-06T15:00:00.000Z') }), true);
    assert.equal(shouldSendDayOfReminder({ ...input, now: at('2026-01-06T15:30:00.000Z') }), false);
  });

  it('does not send the day before, after the visit starts, or twice', () => {
    const base = {
      slotStartAt: at('2026-01-06T22:00:00.000Z'),
      createdAt: createdYesterday,
      timeZone: ZONE,
      status: 'confirmed' as const,
      alreadySent: false,
    };
    assert.equal(shouldSendDayOfReminder({ ...base, now: at('2026-01-05T15:00:00.000Z') }), false);
    assert.equal(shouldSendDayOfReminder({ ...base, now: at('2026-01-06T22:00:00.000Z') }), false);
    assert.equal(
      shouldSendDayOfReminder({ ...base, now: at('2026-01-06T15:00:00.000Z'), alreadySent: true }),
      false
    );
    assert.equal(
      shouldSendDayOfReminder({
        ...base,
        now: at('2026-01-06T15:00:00.000Z'),
        status: 'cancelled',
      }),
      false
    );
  });

  it('skips a reminder when the customer booked in the last two hours', () => {
    assert.equal(
      shouldSendDayOfReminder({
        now: at('2026-01-06T17:00:00.000Z'),
        slotStartAt: at('2026-01-06T22:00:00.000Z'),
        createdAt: at('2026-01-06T16:00:00.000Z'),
        timeZone: ZONE,
        status: 'confirmed',
        alreadySent: false,
      }),
      false
    );
  });

  it('still reminds a same-day booking once the confirmation has had time to land', () => {
    assert.equal(
      shouldSendDayOfReminder({
        now: at('2026-01-06T18:30:00.000Z'),
        slotStartAt: at('2026-01-06T23:00:00.000Z'),
        createdAt: at('2026-01-06T16:00:00.000Z'),
        timeZone: ZONE,
        status: 'confirmed',
        alreadySent: false,
      }),
      true
    );
  });
});
