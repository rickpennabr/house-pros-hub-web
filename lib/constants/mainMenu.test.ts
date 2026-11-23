import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAIN_MENU_KEYS, normalizeMainMenuOrder } from './mainMenu';

test('default order puts Feed between Pros and Quick Repair', () => {
  const order = normalizeMainMenuOrder(null);
  assert.deepEqual(order, [...MAIN_MENU_KEYS]);
  assert.equal(order.indexOf('feed'), order.indexOf('housePros') + 1);
  assert.equal(order.indexOf('quickRepair'), order.indexOf('feed') + 1);
});

test('a saved order from before Feed existed gets Feed right after Pros', () => {
  const saved = ['housePros', 'proJobs', 'proSuppliers', 'proProducts', 'prosBlog', 'quickRepair'];
  assert.deepEqual(normalizeMainMenuOrder(saved), [
    'housePros',
    'feed',
    'proJobs',
    'proSuppliers',
    'proProducts',
    'prosBlog',
    'quickRepair',
  ]);
});

test('a saved order that already places Feed keeps it there', () => {
  const saved = ['feed', 'proJobs', 'proSuppliers', 'proProducts', 'prosBlog', 'housePros', 'quickRepair'];
  assert.deepEqual(normalizeMainMenuOrder(saved), saved);
});

test('unknown and duplicate keys are dropped', () => {
  const order = normalizeMainMenuOrder(['bogus', 'housePros', 'housePros']);
  assert.equal(new Set(order).size, MAIN_MENU_KEYS.length);
  assert.equal(order.indexOf('feed'), order.indexOf('housePros') + 1);
});
