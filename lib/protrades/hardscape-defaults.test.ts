import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMaterialsFor, defaultQty } from './hardscape-defaults';

test('pavers installation brings base, bedding sand, pavers and top sand choices', () => {
  const rows = defaultMaterialsFor(['Pavers installation']);
  assert.deepEqual(rows.map((r) => r.options[0].name).slice(0, 4), ['Type 2 base', 'Washed concrete sand', 'Pavers', 'Polymeric sand']);
  assert.ok(rows.find((r) => r.key === 'joint')!.options.some((o) => o.name === 'Regular base sand'));
});

test('turf brings white chat, nails and infill choices', () => {
  const names = defaultMaterialsFor(['Artificial turf installation']).map((r) => r.options[0].name);
  assert.ok(names.includes('White chat'));
  assert.ok(names.includes('Turf nails 5"'));
  assert.ok(names.includes('Silica sand infill'));
});

test('the same material is not listed twice across services', () => {
  const rows = defaultMaterialsFor(['Pavers installation', 'Base material']);
  assert.equal(rows.filter((r) => r.options[0].name === 'Type 2 base').length, 1);
});

test('quantities follow the size and round like a yard sells', () => {
  const [base] = defaultMaterialsFor(['Pavers installation']);
  assert.equal(defaultQty(base.options[0], 500), 8.65); // 500 sq ft at 4" = 6.17 cu yd x 1.4
  const joint = defaultMaterialsFor(['Pavers installation']).find((r) => r.key === 'joint')!;
  assert.equal(defaultQty(joint.options[0], 120), 3); // 2.4 bags -> 3
  assert.equal(defaultQty(joint.options[0], 0), 0);
});

test('services without defaults add nothing', () => {
  assert.deepEqual(defaultMaterialsFor(['Concrete removal']), []);
});
