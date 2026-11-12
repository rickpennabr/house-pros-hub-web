import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildContactActivity, openBalanceByCustomer, summarizeBooks } from './contact-books';

describe('summarizeBooks', () => {
  it('splits open estimates, overdue, unpaid invoices, and payments from the last 30 days', () => {
    const summary = summarizeBooks(
      [
        { status: 'sent', amountCents: 10000, paidCents: 0 },
        { status: 'partial', amountCents: 8000, paidCents: 3000 },
        { status: 'overdue', amountCents: 4000, paidCents: 1000 },
        { status: 'paid', amountCents: 2000, paidCents: 2000 },
        { status: 'draft', amountCents: 9000, paidCents: 0 },
        { status: 'cancelled', amountCents: 7000, paidCents: 0 },
      ],
      [
        { status: 'draft', amountCents: 15000 },
        { status: 'sent', amountCents: 5000 },
        { status: 'accepted', amountCents: 20000 },
        { status: 'declined', amountCents: 1000 },
      ],
      [
        { amountCents: 3000, paymentDate: '2026-11-01', voided: false },
        { amountCents: 500, paymentDate: '2026-09-01', voided: false },
        { amountCents: 800, paymentDate: '2026-11-05', voided: true },
      ],
      '2026-11-10'
    );

    assert.deepEqual(summary.estimates, { count: 2, cents: 20000 });
    assert.deepEqual(summary.overdue, { count: 1, cents: 3000 });
    assert.deepEqual(summary.openInvoices, { count: 2, cents: 15000 });
    assert.deepEqual(summary.recentlyPaid, { count: 1, cents: 3000 });
  });
});

describe('openBalanceByCustomer', () => {
  it('sums unpaid sent, partial, and overdue invoices per contact', () => {
    const totals = openBalanceByCustomer([
      { customerId: 'a', status: 'sent', amountCents: 1000, paidCents: 0 },
      { customerId: 'a', status: 'overdue', amountCents: 500, paidCents: 200 },
      { customerId: 'a', status: 'draft', amountCents: 9000, paidCents: 0 },
      { customerId: 'b', status: 'paid', amountCents: 400, paidCents: 400 },
    ]);
    assert.equal(totals.get('a'), 1300);
    assert.equal(totals.has('b'), false);
  });
});

describe('buildContactActivity', () => {
  it('reports the open and overdue balances and lists the newest records first', () => {
    const activity = buildContactActivity({
      invoices: [
        { id: 'inv-1', customerId: 'a', number: '1001', status: 'overdue', amountCents: 4000, paidCents: 1000, date: '2026-10-01' },
      ],
      estimates: [
        { id: 'est-1', number: 'EST-1', status: 'sent', amountCents: 9000, date: '2026-11-02' },
      ],
      payments: [
        { id: 'pay-1', invoiceId: 'inv-1', invoiceNumber: '1001', amountCents: 1000, date: '2026-10-15', method: 'check' },
      ],
    });

    assert.equal(activity.openBalanceCents, 3000);
    assert.equal(activity.overdueCents, 3000);
    assert.deepEqual(
      activity.transactions.map((row) => row.kind),
      ['estimate', 'payment', 'invoice']
    );
    assert.equal(activity.transactions[1]?.recordId, 'inv-1');
  });
});
