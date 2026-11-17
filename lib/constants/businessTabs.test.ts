import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeBusinessTabOrder, reorderVisibleTabs } from './businessTabs';

describe('business tab order', () => {
  it('fills missing tabs and drops unknown ids', () => {
    assert.deepEqual(normalizeBusinessTabOrder(['images', 'about', 'nope', 'images']), [
      'images',
      'about',
      'contact',
      'hours',
      'services',
      'products',
      'properties',
      'trades',
      'links',
    ]);
  });

  it('keeps hidden tabs in place while visible tabs move', () => {
    const full = normalizeBusinessTabOrder(['contact', 'hours', 'services', 'links', 'images', 'about']);
    const hidden = new Set(['services', 'products', 'properties', 'trades']);
    const visible = full.filter((tab) => !hidden.has(tab));
    const images = visible.indexOf('images');
    const links = visible.indexOf('links');
    assert.deepEqual(reorderVisibleTabs(full, visible, images, links), [
      'contact',
      'hours',
      'services',
      'images',
      'links',
      'about',
      'products',
      'properties',
      'trades',
    ]);
  });
});
