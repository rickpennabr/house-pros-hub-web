import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  committedCents,
  formatPoNumber,
  parsePoLine,
  planReceipt,
  poTotals,
  statusAfterReceiving,
  type PoLine,
} from './purchase-orders';

const line = (id: string, quantity: number, unitPriceCents: number, receivedQty = 0): PoLine => ({
  id,
  description: id,
  quantity,
  unit: 'Pallet',
  unitPriceCents,
  materialId: null,
  receivedQty,
});

test('PO numbers are padded and fall back to PO', () => {
  assert.equal(formatPoNumber('PO', 7), 'PO-0007');
  assert.equal(formatPoNumber('', 12), 'PO-0012');
  assert.equal(formatPoNumber('ACME', 12345), 'ACME-12345');
});

test('totals add lines, tax and shipping', () => {
  const totals = poTotals([{ quantity: 2.5, unitPriceCents: 1000 }, { quantity: 3, unitPriceCents: 333 }], 200, 1500);
  assert.equal(totals.subtotalCents, 2500 + 999);
  assert.equal(totals.totalCents, 3499 + 200 + 1500);
});

test('a line needs an item and a positive quantity; comma decimals work', () => {
  assert.equal(parsePoLine({ description: '', quantity: 1 }).ok, false);
  assert.equal(parsePoLine({ description: 'Pavers', quantity: 0 }).ok, false);
  const ok = parsePoLine({ description: ' Pavers ', quantity: '1,5', unitPriceCents: 4200 });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.description, 'Pavers');
    assert.equal(ok.value.quantity, 1.5);
    assert.equal(ok.value.unit, 'Each');
  }
});

test('status moves to partial, then received when every line is in', () => {
  assert.equal(statusAfterReceiving([line('a', 2, 0, 1), line('b', 1, 0)]), 'partial');
  assert.equal(statusAfterReceiving([line('a', 2, 0, 2), line('b', 1, 0, 1.5)]), 'received');
  assert.equal(statusAfterReceiving([line('a', 2, 0)]), 'confirmed');
});

test('a receipt costs each line at its price and skips zeros', () => {
  const plan = planReceipt([line('a', 10, 500), line('b', 4, 1000)], [
    { lineId: 'a', quantity: 3 },
    { lineId: 'b', quantity: 0 },
  ]);
  assert.ok(plan.ok);
  if (plan.ok) assert.deepEqual(plan.value.map((p) => [p.lineId, p.quantity, p.costCents]), [['a', 3, 1500]]);
  assert.equal(planReceipt([line('a', 1, 1)], [{ lineId: 'x', quantity: 1 }]).ok, false);
  assert.equal(planReceipt([line('a', 1, 1)], [{ lineId: 'a', quantity: 0 }]).ok, false);
});

test('committed cost is what is still to arrive on open POs only', () => {
  const lines = [line('a', 10, 500, 4), line('b', 2, 1000, 3)];
  assert.equal(committedCents('partial', lines), 3000);
  assert.equal(committedCents('draft', lines), 0);
  assert.equal(committedCents('received', lines), 0);
});
