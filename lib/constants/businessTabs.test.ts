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
      'links',
    ]);
  });

  it('keeps a hidden services tab in place while visible tabs move', () => {
    const full = normalizeBusinessTabOrder(['contact', 'hours', 'services', 'links', 'images', 'about']);
    const visible = full.filter((tab) => tab !== 'services');
    const images = visible.indexOf('images');
    const links = visible.indexOf('links');
    assert.deepEqual(reorderVisibleTabs(full, visible, images, links), [
      'contact',
      'hours',
      'services',
      'images',
      'links',
      'about',
    ]);
  });
});
