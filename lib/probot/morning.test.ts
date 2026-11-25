import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBriefText, isMorningNow, pickFollowups, type BriefFacts, type FollowupCandidate, type FollowupHistory } from './morning';

const TODAY = '2026-11-25';

function invoice(id: string, sentOn: string, amountCents = 100_000, dueDate: string | null = null): FollowupCandidate {
  return { kind: 'invoice_unpaid', documentId: id, documentNumber: `#${id}`, customerId: 'c', amountCents, sentOn, dueDate };
}
function estimate(id: string, sentOn: string, amountCents = 100_000): FollowupCandidate {
  return { kind: 'estimate_waiting', documentId: id, documentNumber: `#${id}`, customerId: 'c', amountCents, sentOn };
}
function row(documentId: string, status: FollowupHistory['status'], extra: Partial<FollowupHistory> = {}): FollowupHistory {
  return { id: `row-${documentId}-${status}`, documentId, status, snoozedUntil: null, actedOn: null, ...extra };
}

describe('pickFollowups', () => {
  it('waits 3 days after sending', () => {
    const picked = pickFollowups([invoice('a', '2026-11-22'), invoice('b', '2026-11-23'), estimate('e', '2026-11-20')], [], TODAY);
    assert.deepEqual(picked.map((d) => d.candidate.documentId), ['a', 'e']);
    assert.equal(picked[0].waitingDays, 3);
  });

  it('never repeats a card that is still open or snoozed', () => {
    const picked = pickFollowups(
      [invoice('a', '2026-11-01'), invoice('b', '2026-11-01')],
      [row('a', 'open'), row('b', 'snoozed', { snoozedUntil: '2026-11-27' })],
      TODAY,
    );
    assert.equal(picked.length, 0);
  });

  it('wakes a snoozed card on its day', () => {
    const picked = pickFollowups([invoice('a', '2026-11-01')], [row('a', 'snoozed', { snoozedUntil: TODAY })], TODAY);
    assert.equal(picked.length, 1);
    assert.equal(picked[0].action, 'wake');
  });

  it('waits 7 days after the pro sent a reminder', () => {
    const history = [row('a', 'sent', { actedOn: '2026-11-20' })];
    assert.equal(pickFollowups([invoice('a', '2026-11-01')], history, TODAY).length, 0);
    const later = pickFollowups([invoice('a', '2026-11-01')], history, '2026-11-27');
    assert.equal(later.length, 1);
    assert.equal(later[0].followedUpBefore, true);
  });

  it('starts over at 3 days when the pro re-sends the document itself', () => {
    const history = [row('a', 'sent', { actedOn: '2026-11-10' })];
    assert.equal(pickFollowups([invoice('a', '2026-11-23')], history, TODAY).length, 0);
    assert.equal(pickFollowups([invoice('a', '2026-11-22')], history, TODAY).length, 1);
  });

  it('puts late invoices first, then invoices, then estimates, bigger first', () => {
    const picked = pickFollowups(
      [
        estimate('big-estimate', '2026-11-01', 900_000),
        invoice('small', '2026-11-01', 10_000),
        invoice('big', '2026-11-01', 500_000),
        invoice('late-2', '2026-11-01', 10_000, '2026-11-23'),
        invoice('late-9', '2026-11-01', 10_000, '2026-11-16'),
      ],
      [],
      TODAY,
    );
    assert.deepEqual(picked.map((d) => d.candidate.documentId), ['late-9', 'late-2', 'big', 'small', 'big-estimate']);
  });
});

const quiet: BriefFacts = {
  firstName: 'Rick',
  today: TODAY,
  dayName: 'Wednesday, November 25',
  appointments: [],
  maintenance: [],
  finishing: [],
  starting: [],
  openCount: 2,
  openCents: 500_000,
  lateCents: 0,
  cards: 0,
};

describe('buildBriefText', () => {
  it('skips a quiet day, even with money open', () => {
    assert.equal(buildBriefText(quiet), null);
  });

  it('lists today, the week, money and the cards', () => {
    const text = buildBriefText({
      ...quiet,
      appointments: [{ time: '8:00 AM', what: 'Estimate appointment', with: 'Ana Torres' }],
      maintenance: [{ customer: 'Johnson', plan: 'Weekly lawn' }],
      finishing: [{ name: 'Backyard pavers', customer: 'Daniel Smith', finish: '2026-11-26' }],
      lateCents: 320_000,
      cards: 2,
    })!;
    assert.match(text, /Good morning, Rick!/);
    assert.match(text, /8:00 AM\*\* Estimate appointment, Ana Torres/);
    assert.match(text, /Maintenance:\*\* 1 house \(Johnson\)/);
    assert.match(text, /Daniel Smith\*\*, Backyard pavers, ends tomorrow/);
    assert.match(text, /\$5,000\.00 open on 2 invoices, \$3,200\.00 of it late/);
    assert.match(text, /2 things need your OK/);
  });
});

describe('isMorningNow', () => {
  it('is 6 AM Las Vegas time', () => {
    assert.equal(isMorningNow('America/Los_Angeles', new Date('2026-11-25T14:30:00Z')), true);
    assert.equal(isMorningNow('America/Los_Angeles', new Date('2026-11-25T15:30:00Z')), false);
  });
});
