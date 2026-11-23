import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHubMemberRow } from './members';

const HUB = '11111111-1111-1111-1111-111111111111';
const PRO = '22222222-2222-2222-2222-222222222222';

test('pro posts about a CRM contact without a Hub account stay out', () => {
  for (const kind of ['estimate_sent', 'project_scheduled', 'project_photos']) {
    assert.equal(isHubMemberRow({ kind, actor_user_id: PRO, target_user_id: null }), false, kind);
    assert.equal(isHubMemberRow({ kind, actor_user_id: PRO, target_user_id: HUB }), true, kind);
  }
});

test('customer actions need the customer to have a Hub account', () => {
  for (const kind of ['estimate_approved', 'estimate_requested', 'fix_requested', 'feedback_left', 'member_joined']) {
    assert.equal(isHubMemberRow({ kind, actor_user_id: null, target_user_id: PRO }), false, kind);
    assert.equal(isHubMemberRow({ kind, actor_user_id: HUB, target_user_id: PRO }), true, kind);
  }
});

test('new pros show when the owner has an account', () => {
  assert.equal(isHubMemberRow({ kind: 'pro_joined', actor_user_id: PRO, target_user_id: null }), true);
});
