import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { serviceDue, toolBookValueCents, toolYearlyDepreciationCents } from './pro-tools';

const MOWER = {
  purchase_cents: 120_000,
  salvage_cents: 20_000,
  useful_life_years: 5,
  purchase_date: '2024-01-01',
  status: 'available' as const,
};

describe('toolBookValueCents', () => {
  it('is the full cost on the purchase day', () => {
    assert.equal(toolBookValueCents(MOWER, '2024-01-01'), 120_000);
  });

  it('drops in a straight line toward salvage', () => {
    // About half of the 5-year life: cost minus half of (cost - salvage).
    const value = toolBookValueCents(MOWER, '2026-07-02');
    assert.ok(Math.abs(value - 70_000) < 200, `got ${value}`);
  });

  it('stops at salvage after its useful life', () => {
    assert.equal(toolBookValueCents(MOWER, '2031-06-01'), 20_000);
  });

  it('is zero once retired or lost', () => {
    assert.equal(toolBookValueCents({ ...MOWER, status: 'retired' }, '2025-01-01'), 0);
    assert.equal(toolBookValueCents({ ...MOWER, status: 'lost' }, '2025-01-01'), 0);
  });

  it('keeps the cost when there is no purchase date', () => {
    assert.equal(toolBookValueCents({ ...MOWER, purchase_date: null }, '2030-01-01'), 120_000);
  });

  it('never goes above cost when salvage is set too high', () => {
    assert.equal(toolBookValueCents({ ...MOWER, salvage_cents: 500_000 }, '2040-01-01'), 120_000);
  });
});

describe('toolYearlyDepreciationCents', () => {
  it('spreads cost minus salvage over the life', () => {
    assert.equal(toolYearlyDepreciationCents(MOWER), 20_000);
  });
});

describe('serviceDue', () => {
  it('flags overdue and soon', () => {
    assert.equal(serviceDue('2026-11-01', '2026-11-19'), 'overdue');
    assert.equal(serviceDue('2026-11-25', '2026-11-19'), 'soon');
    assert.equal(serviceDue('2027-03-01', '2026-11-19'), null);
    assert.equal(serviceDue(null, '2026-11-19'), null);
  });
});
