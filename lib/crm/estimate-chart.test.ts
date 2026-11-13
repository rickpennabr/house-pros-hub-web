import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEstimateChart, monthKeyInZone } from './estimate-chart';

const NOW = new Date('2026-11-13T18:00:00.000Z');

describe('monthKeyInZone', () => {
  it('uses the business calendar, not the UTC date', () => {
    const eveningBeforeDecemberUtc = '2026-12-01T07:00:00.000Z';
    assert.equal(monthKeyInZone(eveningBeforeDecemberUtc, 'UTC'), '2026-12');
    assert.equal(monthKeyInZone(eveningBeforeDecemberUtc, 'America/Los_Angeles'), '2026-11');
  });
});

describe('buildEstimateChart', () => {
  it('counts open quotes out of the win rate and stacks the last 12 months', () => {
    const chart = buildEstimateChart(
      [
        { status: 'draft', amountCents: 68000, createdAt: '2026-11-01T18:00:00.000Z' },
        { status: 'sent', amountCents: 10000, createdAt: '2026-10-15T18:00:00.000Z' },
        { status: 'accepted', amountCents: 12000, createdAt: '2026-11-02T18:00:00.000Z' },
        { status: 'accepted', amountCents: 8000, createdAt: '2025-01-15T18:00:00.000Z' },
        { status: 'declined', amountCents: 20000, createdAt: '2026-09-01T18:00:00.000Z' },
        { status: 'other', amountCents: 999, createdAt: '2026-11-01T18:00:00.000Z' },
      ],
      { now: NOW, timeZone: 'UTC' }
    );

    assert.deepEqual(chart.open, { count: 2, cents: 78000 });
    assert.equal(chart.closedCount, 3);
    assert.equal(chart.closedCents, 40000);
    assert.equal(chart.winRateCount, 2 / 3);
    assert.equal(chart.winRateCents, 20000 / 40000);
    assert.equal(chart.months.length, 12);
    assert.equal(chart.months[0].key, '2025-12');
    assert.equal(chart.months[11].key, '2026-11');
    assert.equal(chart.months[11].openCents, 68000);
    assert.equal(chart.months[11].wonCents, 12000);
    assert.equal(chart.months[10].openCents, 10000);
    assert.equal(chart.months[9].lostCents, 20000);
    const january = chart.months.find((month) => month.key === '2025-01');
    assert.equal(january, undefined);
  });

  it('leaves the win rate empty when every quote is still open', () => {
    const chart = buildEstimateChart(
      [{ status: 'draft', amountCents: 500, createdAt: '2026-11-01T18:00:00.000Z' }],
      { now: NOW, timeZone: 'UTC' }
    );
    assert.equal(chart.winRateCents, null);
    assert.equal(chart.winRateCount, null);
    assert.equal(chart.closedCount, 0);
  });
});
