import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateInputValue, promoExampleFor } from './promo-examples';

describe('promoExampleFor', () => {
  it('reads the trade from services when no trade is saved (The Paver Pro)', () => {
    assert.equal(promoExampleFor(['The Paver Pro', 'Pavers Installation', 'Turf Installation', 'HANDYMAN']).trade, 'Pavers');
  });
  it('uses the saved trade slug', () => {
    assert.equal(promoExampleFor(['plumber']).trade, 'Plumbing');
    assert.equal(promoExampleFor(['house_cleaner']).trade, 'Cleaning');
    assert.equal(promoExampleFor(['hvac_technician']).trade, 'HVAC');
  });
  it('falls back to painting when nothing matches or nothing is known', () => {
    assert.equal(promoExampleFor([]).trade, 'Painting');
    assert.equal(promoExampleFor([null, undefined, '']).trade, 'Painting');
    assert.equal(promoExampleFor(['Acme LLC']).trade, 'Painting');
  });
  it('matches word starts, not letters inside other words', () => {
    // "spa" must not match "space"; "tree" must not match "street".
    assert.equal(promoExampleFor(['Space Street Co']).trade, 'Painting');
  });
});

describe('dateInputValue', () => {
  it('formats a local date for a date input, days ahead', () => {
    assert.equal(dateInputValue(new Date(2026, 10, 27)), '2026-11-27');
    assert.equal(dateInputValue(new Date(2026, 10, 27), 35), '2027-01-01');
  });
});
