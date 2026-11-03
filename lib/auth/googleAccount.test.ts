import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXISTING_ACCOUNT_AGE_MS,
  classifyGoogleAccount,
  isGoogleAccountConflict,
} from './googleAccount';

const now = Date.parse('2026-11-03T16:00:00.000Z');

test('a form account with a saved name stays the same account', () => {
  assert.equal(
    classifyGoogleAccount({
      userCreatedAt: '2026-01-01T00:00:00.000Z',
      providers: ['email', 'google'],
      hasRoles: true,
      hasSavedProfile: true,
      now,
    }),
    'existing'
  );
});

test('a confirmed password identity is an existing account even before roles load', () => {
  assert.equal(
    classifyGoogleAccount({
      userCreatedAt: new Date(now - 5_000).toISOString(),
      providers: ['email', 'google'],
      hasRoles: false,
      hasSavedProfile: false,
      now,
    }),
    'existing'
  );
});

test('an older account is existing when Google replaced the unconfirmed password identity', () => {
  assert.equal(
    classifyGoogleAccount({
      userCreatedAt: new Date(now - EXISTING_ACCOUNT_AGE_MS - 1).toISOString(),
      providers: ['google'],
      hasRoles: false,
      hasSavedProfile: false,
      now,
    }),
    'existing'
  );
});

test('a first Google sign-in creates a customer', () => {
  assert.equal(
    classifyGoogleAccount({
      userCreatedAt: new Date(now - 1_000).toISOString(),
      providers: ['google'],
      hasRoles: false,
      hasSavedProfile: false,
      now,
    }),
    'new'
  );
});

test('an email that cannot be linked is a conflict, not a new account', () => {
  assert.equal(isGoogleAccountConflict('email_exists', null), true);
  assert.equal(isGoogleAccountConflict(null, 'User already registered'), true);
  assert.equal(isGoogleAccountConflict('bad_oauth_callback', 'access_denied'), false);
});
