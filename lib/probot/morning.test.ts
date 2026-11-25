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
  return { id: `row-${documentId}-${status}`, kind: 'invoice_unpaid', documentId, status, snoozedUntil: null, actedOn: null, ...extra };
}
function project(id: string, kind: 'project_finishing' | 'project_starting', date: string): FollowupCandidate {
  return { kind, documentId: id, documentNumber: `#${id}`, customerId: 'c', amountCents: 0, sentOn: TODAY, projectName: 'Pavers', date };
}
function accepted(id: string, amountCents = 100_000): FollowupCandidate {
  return { kind: 'estimate_accepted', documentId: id, documentNumber: `#${id}`, customerId: 'c', amountCents, sentOn: '2026-11-24' };
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
  it('is 6 AM Las Vegas time by default', () => {
    assert.equal(isMorningNow('America/Los_Angeles', undefined, new Date('2026-11-25T14:30:00Z')), true);
    assert.equal(isMorningNow('America/Los_Angeles', undefined, new Date('2026-11-25T15:30:00Z')), false);
  });

  it('follows the pro hour and time zone', () => {
    // 12:30 UTC = 7:30 AM in New York (EST).
    assert.equal(isMorningNow('America/New_York', 7, new Date('2026-11-25T12:30:00Z')), true);
    assert.equal(isMorningNow('America/New_York', 6, new Date('2026-11-25T12:30:00Z')), false);
  });
});

describe('week 2 cards', () => {
  it('uses the pro wait days', () => {
    const candidates = [invoice('a', '2026-11-20'), estimate('e', '2026-11-20')];
    assert.equal(pickFollowups(candidates, [], TODAY, { invoiceDays: 7, estimateDays: 3 }).map((d) => d.candidate.documentId).join(), 'e');
    assert.equal(pickFollowups(candidates, [], TODAY, { invoiceDays: 5, estimateDays: 5 }).length, 2);
  });

  it('brings up project and accepted cards once, keyed by kind', () => {
    const candidates = [project('p', 'project_finishing', '2026-11-27'), accepted('e')];
    assert.equal(pickFollowups(candidates, [], TODAY).length, 2);
    const handled = [
      row('p', 'done', { kind: 'project_finishing', actedOn: '2026-11-20' }),
      // A waiting-estimate card for the same estimate does not block the accepted card.
      row('e', 'sent', { kind: 'estimate_waiting', actedOn: '2026-11-20' }),
    ];
    assert.deepEqual(pickFollowups(candidates, handled, TODAY).map((d) => d.candidate.documentId), ['e']);
  });

  it('orders late invoices, accepted, finishing, invoices, starting, estimates', () => {
    const picked = pickFollowups(
      [
        estimate('est', '2026-11-01'),
        project('start', 'project_starting', '2026-11-26'),
        invoice('inv', '2026-11-01'),
        project('finish', 'project_finishing', '2026-11-27'),
        accepted('acc'),
        invoice('late', '2026-11-01', 10_000, '2026-11-20'),
      ],
      [],
      TODAY,
    );
    assert.deepEqual(picked.map((d) => d.candidate.documentId), ['late', 'acc', 'finish', 'inv', 'start', 'est']);
  });

  it('writes the brief in Spanish and Portuguese', () => {
    const facts = { ...quiet, cards: 1, finishing: [{ name: 'Patio', customer: 'Daniel', finish: '2026-11-26' }] };
    const es = buildBriefText({ ...facts, locale: 'es' })!;
    assert.match(es, /¡Buenos días, Rick!/);
    assert.match(es, /termina mañana/);
    assert.match(es, /1 cosa necesita tu OK/);
    const pt = buildBriefText({ ...facts, locale: 'pt' })!;
    assert.match(pt, /Bom dia, Rick!/);
    assert.match(pt, /termina amanhã/);
  });
});
