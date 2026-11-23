import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_SITE_URL, resolvePublicSiteUrl } from './publicSiteUrl';

const prod = (extra: Record<string, string> = {}) => ({ VERCEL_ENV: 'production', ...extra });

test('production never emails a localhost link', () => {
  assert.equal(
    resolvePublicSiteUrl('http://localhost:3000', prod({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })),
    PRODUCTION_SITE_URL
  );
});

test('production skips the raw Vercel address', () => {
  assert.equal(resolvePublicSiteUrl('https://house-pros-hub-abc123.vercel.app', prod()), PRODUCTION_SITE_URL);
});

test('production uses the configured public domain', () => {
  assert.equal(
    resolvePublicSiteUrl('https://x.vercel.app', prod({ NEXT_PUBLIC_APP_URL: 'https://www.houseproshub.com/' })),
    'https://www.houseproshub.com'
  );
});

test('production with nothing configured (cron) falls back to the live site', () => {
  assert.equal(resolvePublicSiteUrl(null, prod()), PRODUCTION_SITE_URL);
});

test('local dev keeps localhost links so you can click them', () => {
  const env = { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' };
  assert.equal(resolvePublicSiteUrl('http://localhost:3000', env), 'http://localhost:3000');
  assert.equal(resolvePublicSiteUrl('http://0.0.0.0:3000', {}), 'http://localhost:3000');
});
