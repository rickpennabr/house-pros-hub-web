import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVisitIcs } from './visitIcs';
import { formatVisitAddress, readVisitAddress } from './visitAddress';

describe('visit address and calendar file', () => {
  it('requires a full visit address and keeps an optional note', () => {
    assert.equal(readVisitAddress({ visitStreet: '1', visitCity: 'Las Vegas', visitState: 'NV', visitZip: '89101' }).ok, false);
    const parsed = readVisitAddress({
      visitStreet: '6323 Silverfield Dr',
      visitCity: 'Las Vegas',
      visitState: 'NV',
      visitZip: '89103',
      visitNote: 'Gate code 1234',
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.visit.note, 'Gate code 1234');
    assert.equal(formatVisitAddress(parsed.visit), '6323 Silverfield Dr, Las Vegas, NV 89103');
  });

  it('builds an invite that can later be cancelled', () => {
    const ics = buildVisitIcs({
      bookingId: '11111111-1111-4111-8111-111111111111',
      summary: 'Ace Pavers: Estimate',
      description: 'Gate code 1234',
      location: '1 Main St, Las Vegas, NV 89101',
      startAt: '2026-04-10T18:00:00.000Z',
      endAt: '2026-04-10T19:30:00.000Z',
      method: 'CANCEL',
      sequence: 2,
    });
    assert.match(ics, /METHOD:CANCEL/);
    assert.match(ics, /DTSTART:20260410T180000Z/);
    assert.match(ics, /LOCATION:1 Main St\\, Las Vegas\\, NV 89101/);
    assert.match(ics, /STATUS:CANCELLED/);
    assert.match(ics, /SEQUENCE:2/);
  });
});
