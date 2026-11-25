import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeliveryWrite, parseMaterialWrite, parseQuantity, summarizeMaterial } from './project-materials';

test('quantities accept decimals with a dot or comma', () => {
  assert.equal(parseQuantity('1.5'), 1.5);
  assert.equal(parseQuantity('2,5'), 2.5);
  assert.equal(parseQuantity(3), 3);
  assert.equal(parseQuantity('3?'), null);
  assert.equal(parseQuantity('abc'), null);
});

test('a material needs a name and a numeric plan', () => {
  assert.deepEqual(parseMaterialWrite({ name: '  Demi,  Sierra Blend ', unit: 'Pallet', plannedQty: '7' }), {
    ok: true,
    value: { name: 'Demi, Sierra Blend', unit: 'Pallet', plannedQty: 7, note: null },
  });
  assert.equal(parseMaterialWrite({ name: '', plannedQty: 1 }).ok, false);
  assert.equal(parseMaterialWrite({ name: 'Cement', plannedQty: 'lots' }).ok, false);
});

test('a partial update only touches what was sent', () => {
  assert.deepEqual(parseMaterialWrite({ plannedQty: 9 }, true), { ok: true, value: { plannedQty: 9 } });
});

test('a delivery needs a positive quantity and defaults to today', () => {
  const result = parseDeliveryWrite({ quantity: '2' }, '2026-11-24');
  assert.deepEqual(result, { ok: true, value: { quantity: 2, deliveredOn: '2026-11-24', source: null, note: null } });
  assert.equal(parseDeliveryWrite({ quantity: 0 }, '2026-11-24').ok, false);
});

test('summary: not sent, partial, sent and over', () => {
  assert.equal(summarizeMaterial(14, []).status, 'not_sent');
  const partial = summarizeMaterial(14, [{ quantity: 12 }]);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.remainingQty, 2);
  assert.equal(summarizeMaterial(4, [{ quantity: 2 }, { quantity: '2' }]).status, 'sent');
  const over = summarizeMaterial(3, [{ quantity: 3.5 }]);
  assert.equal(over.status, 'over');
  assert.equal(over.extraQty, 0.5);
  assert.equal(over.remainingQty, 0);
});
