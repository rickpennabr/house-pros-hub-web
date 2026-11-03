import assert from 'node:assert/strict';
import test from 'node:test';
import { accountDeleteUsesPassword } from './account-has-password';

function token(amr: Array<{ method: string }>): string {
  const payload = Buffer.from(JSON.stringify({ amr }), 'utf8').toString('base64url');
  return `h.${payload}.s`;
}

test('a password account asks for the password', () => {
  assert.equal(
    accountDeleteUsesPassword({ identities: [{ provider: 'email' }], app_metadata: { provider: 'email', providers: ['email'] } }),
    true
  );
});

test('a Google-only account asks for the account email', () => {
  assert.equal(
    accountDeleteUsesPassword({ identities: [{ provider: 'google' }], app_metadata: { provider: 'google', providers: ['google'] } }),
    false
  );
});

test('a linked account signed in with Google asks for the account email', () => {
  assert.equal(
    accountDeleteUsesPassword(
      { identities: [{ provider: 'google' }, { provider: 'email' }], app_metadata: { provider: 'email', providers: ['email', 'google'] } },
      token([{ method: 'oauth' }])
    ),
    false
  );
});

test('a linked account whose latest sign-in is Google asks for the account email', () => {
  assert.equal(
    accountDeleteUsesPassword({
      identities: [
        { provider: 'google', last_sign_in_at: '2026-11-03T15:59:51.370139Z' },
        { provider: 'email', last_sign_in_at: '2026-02-28T00:39:26.096722Z' },
      ],
      app_metadata: { provider: 'email', providers: ['email', 'google'] },
    }),
    false
  );
});

test('a linked account whose latest sign-in is the password asks for the password', () => {
  assert.equal(
    accountDeleteUsesPassword({
      identities: [
        { provider: 'google', last_sign_in_at: '2026-02-01T00:00:00.000Z' },
        { provider: 'email', last_sign_in_at: '2026-11-03T15:59:51.370139Z' },
      ],
      app_metadata: { provider: 'email', providers: ['email', 'google'] },
    }),
    true
  );
});

test('a linked account signed in with a password asks for the password', () => {
  assert.equal(
    accountDeleteUsesPassword(
      { identities: [{ provider: 'google' }, { provider: 'email' }], app_metadata: { provider: 'email', providers: ['email', 'google'] } },
      token([{ method: 'password' }])
    ),
    true
  );
});
