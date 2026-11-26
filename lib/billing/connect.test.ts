import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickConnectAccount, platformFeeCents, type ConnectRow } from './connect';

const row = (business_id: string | null, id: string): ConnectRow => ({
  id, owner_id: 'o', business_id, stripe_account_id: `acct_${id}`, charges_enabled: true, payouts_enabled: true,
  details_submitted: true, created_at: '', updated_at: '',
});

test('platformFeeCents is 0 by default and caps at the amount', () => {
  assert.equal(platformFeeCents(10000, 0), 0);
  assert.equal(platformFeeCents(10000, 100), 100);
  assert.equal(platformFeeCents(999, 150), 14);
  assert.equal(platformFeeCents(500, 20000), 500);
  assert.equal(platformFeeCents(500, Number.NaN), 0);
});

test('pickConnectAccount uses the business account, then the default', () => {
  const rows = [row(null, 'default'), row('b1', 'one')];
  assert.equal(pickConnectAccount(rows, 'b1')?.id, 'one');
  assert.equal(pickConnectAccount(rows, 'b2')?.id, 'default');
  assert.equal(pickConnectAccount(rows, null)?.id, 'default');
  assert.equal(pickConnectAccount([row('b1', 'one')], 'b2'), null);
});
