import assert from 'node:assert/strict';
import test from 'node:test';
import { isSlideLive, liveSlides } from './live';
import type { BillboardSlide } from './types';

function slide(overrides: Partial<BillboardSlide>): BillboardSlide {
  return {
    id: '1',
    businessId: 'biz',
    kind: 'promotion',
    mediaUrl: null,
    headline: 'Spring offer',
    body: null,
    badge: null,
    ctaLabel: null,
    ctaUrl: null,
    sortOrder: 0,
    isActive: true,
    durationSeconds: 8,
    startsOn: null,
    endsOn: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('a hidden slide stays off the public board', () => {
  assert.equal(isSlideLive(slide({ isActive: false }), '2026-11-27'), false);
});

test('dates are inclusive calendar days', () => {
  const dated = slide({ startsOn: '2026-11-01', endsOn: '2026-11-27' });
  assert.equal(isSlideLive(dated, '2026-11-01'), true);
  assert.equal(isSlideLive(dated, '2026-11-27'), true);
  assert.equal(isSlideLive(dated, '2026-11-28'), false);
  assert.equal(isSlideLive(dated, '2026-10-31'), false);
});

test('liveSlides keeps only slides playing today', () => {
  const slides = liveSlides(
    [slide({ id: 'now' }), slide({ id: 'later', startsOn: '2026-12-01' }), slide({ id: 'off', isActive: false })],
    '2026-11-27',
  );
  assert.deepEqual(slides.map((item) => item.id), ['now']);
});
