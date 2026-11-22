import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discountCents, discountedTotalCents, readDiscount, shownDiscount } from './document-discount';

test('percent and dollar discounts come off the subtotal', () => {
  assert.equal(discountCents(70500, { kind: 'percent', value: 10 }), 7050);
  assert.equal(discountCents(70500, { kind: 'amount', value: 50 }), 5000);
  assert.equal(discountedTotalCents(70500, { kind: 'amount', value: 50 }), 65500);
});

test('a discount never goes past the subtotal', () => {
  assert.equal(discountCents(1000, { kind: 'amount', value: 50 }), 1000);
  assert.equal(discountedTotalCents(1000, { kind: 'percent', value: 100 }), 0);
});

test('readDiscount checks the form value', () => {
  assert.deepEqual(readDiscount(null), { ok: true, discount: null });
  assert.deepEqual(readDiscount({ kind: 'percent', value: 0 }), { ok: true, discount: null });
  assert.equal(readDiscount({ kind: 'percent', value: 120 }).ok, false);
  assert.equal(readDiscount({ kind: 'other', value: 5 }).ok, false);
});

test('shownDiscount reads full-price lines against the total', () => {
  const lines = [{ amount_cents: 50000 }, { amount_cents: 20500 }];
  assert.deepEqual(shownDiscount(lines, 63450), { subtotalCents: 70500, discountCents: 7050 });
  assert.equal(shownDiscount(lines, 70500), null);
  assert.equal(shownDiscount([], 1000), null);
});
