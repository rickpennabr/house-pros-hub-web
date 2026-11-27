import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasSessionCookie, parseSnapshot, toSnapshotUser } from './session-snapshot';

const NOW = 1_800_000_000_000;
const COOKIE = 'theme=x; sb-abcd1234-auth-token=base64-eyJhY2Nlc3M; other=1';
const snapshot = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, savedAt: NOW - 1000, user: { id: 'u1', firstName: 'Rick', lastName: 'P' }, isAdmin: false, roles: ['contractor'], ...overrides });

describe('hasSessionCookie', () => {
  it('finds the Supabase session cookie, whole or split', () => {
    assert.equal(hasSessionCookie(COOKIE), true);
    assert.equal(hasSessionCookie('sb-abcd-auth-token.0=part'), true);
  });
  it('is false when signed out', () => {
    assert.equal(hasSessionCookie('theme=x; other=1'), false);
    assert.equal(hasSessionCookie(''), false);
    assert.equal(hasSessionCookie('sb-abcd-auth-token='), false);
  });
});

describe('parseSnapshot', () => {
  it('uses a fresh snapshot when the session cookie is there', () => {
    const parsed = parseSnapshot(snapshot(), COOKIE, NOW);
    assert.equal(parsed?.user.id, 'u1');
    assert.deepEqual(parsed?.roles, ['contractor']);
  });
  it('ignores it with no session cookie (signed out, maybe in another tab)', () => {
    assert.equal(parseSnapshot(snapshot(), 'other=1', NOW), null);
  });
  it('ignores old, broken or other-version snapshots', () => {
    assert.equal(parseSnapshot(snapshot({ savedAt: NOW - 31 * 24 * 60 * 60 * 1000 }), COOKIE, NOW), null);
    assert.equal(parseSnapshot('{not json', COOKIE, NOW), null);
    assert.equal(parseSnapshot(snapshot({ v: 2 }), COOKIE, NOW), null);
    assert.equal(parseSnapshot(snapshot({ user: { firstName: 'No id' } }), COOKIE, NOW), null);
    assert.equal(parseSnapshot(null, COOKIE, NOW), null);
  });
  it('only trusts a real true for admin', () => {
    assert.equal(parseSnapshot(snapshot({ isAdmin: 'yes' }), COOKIE, NOW)?.isAdmin, false);
  });
});

describe('toSnapshotUser', () => {
  it('keeps only what is drawn on screen, never contact details', () => {
    const kept = toSnapshotUser({
      id: 'u1',
      firstName: 'Rick',
      lastName: 'P',
      userPicture: 'https://x/p.jpg',
      email: 'private@example.com',
      phone: '555',
      streetAddress: '1 Main',
    });
    assert.deepEqual(Object.keys(kept).sort(), ['firstName', 'id', 'lastName', 'userPicture']);
  });
});
