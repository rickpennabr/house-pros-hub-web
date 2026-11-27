import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canForwardMessage, isSameThread, parseForwardContact } from './forward-target';
import { sortContactsByActivity } from './contact-activity';

const USER = '23ef3403-760f-4bf0-b8bb-b2bead5f257f';
const BIZ = '11111111-1111-4111-8111-111111111111';

test('parseForwardContact reads customer, visitor and business ids', () => {
  assert.deepEqual(parseForwardContact(`customer-${USER}`), { kind: 'customer', userId: USER });
  assert.deepEqual(parseForwardContact('visitor-abc'), { kind: 'visitor', visitorId: 'abc' });
  assert.deepEqual(parseForwardContact(BIZ), { kind: 'business', businessId: BIZ });
  assert.equal(parseForwardContact('probot'), null);
  assert.equal(parseForwardContact('customer-nope'), null);
});

test('canForwardMessage needs text or a file', () => {
  assert.equal(canForwardMessage('  hi ', 0), true);
  assert.equal(canForwardMessage(' ', 1), true);
  assert.equal(canForwardMessage('  ', 0), false);
});

test('isSameThread matches conversation and business together', () => {
  assert.equal(
    isSameThread({ conversationId: 'a', businessId: BIZ }, { conversationId: 'a', businessId: BIZ }),
    true
  );
  assert.equal(
    isSameThread({ conversationId: 'a', businessId: BIZ }, { conversationId: 'b', businessId: BIZ }),
    false
  );
});

test('the personal account stays second, under ProBot, ahead of newer chats', () => {
  const ordered = sortContactsByActivity([
    { id: 'probot', isProBot: true },
    { id: 'customer-other', lastActivityAt: '2026-11-27T20:00:00.000Z' },
    { id: `customer-${USER}`, pinned: true, lastActivityAt: '2026-11-01T00:00:00.000Z' },
    { id: BIZ, businessId: BIZ },
  ]);
  assert.deepEqual(
    ordered.map((contact) => contact.id),
    ['probot', `customer-${USER}`, 'customer-other', BIZ]
  );
});
