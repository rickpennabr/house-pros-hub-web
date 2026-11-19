import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultTabsForRole, normalizeTabsForRole, resolveProDetailsRole } from './proDetailsTabs';

describe('pro details tabs by role', () => {
  it('picks the primary role in a fixed priority', () => {
    assert.equal(resolveProDetailsRole(['realtor', 'contractor']), 'contractor');
    assert.equal(resolveProDetailsRole(['handyman', 'realtor']), 'realtor');
    assert.equal(resolveProDetailsRole(['installer']), 'installer');
    assert.equal(resolveProDetailsRole([]), 'contractor');
  });

  it('gives each role its own middle tabs', () => {
    assert.ok(defaultTabsForRole('contractor').includes('services'));
    assert.ok(defaultTabsForRole('contractor').includes('products'));
    assert.ok(defaultTabsForRole('realtor').includes('properties'));
    assert.ok(!defaultTabsForRole('realtor').includes('products'));
    assert.ok(defaultTabsForRole('installer').includes('services'));
    assert.ok(!defaultTabsForRole('installer').includes('trades'));
    assert.ok(defaultTabsForRole('handyman').includes('services'));
    assert.ok(defaultTabsForRole('handyman').includes('trades'));
  });

  it('keeps the saved order but drops tabs the role cannot show', () => {
    const order = normalizeTabsForRole('realtor', ['about', 'services', 'properties', 'contact']);
    assert.deepEqual(order.slice(0, 3), ['about', 'properties', 'contact']);
    assert.ok(!order.includes('services'));
    assert.deepEqual([...order].sort(), [...defaultTabsForRole('realtor')].sort());
  });
});
