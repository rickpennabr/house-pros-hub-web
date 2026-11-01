import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  agingBucket,
  nextRecurringDate,
  statusFromPayments,
} from './invoice-books';

describe('statusFromPayments', () => {
  it('marks a sent invoice paid when the balance is covered', () => {
    assert.equal(
      statusFromPayments({
        storedStatus: 'sent',
        dueDate: '2026-12-01',
        totalCents: 10000,
        paidCents: 10000,
        today: '2026-10-31',
      }),
      'paid'
    );
  });

  it('keeps a partial balance as partial until the due date', () => {
    assert.equal(
      statusFromPayments({
        storedStatus: 'sent',
        dueDate: '2026-12-01',
        totalCents: 10000,
        paidCents: 4000,
        today: '2026-10-31',
      }),
      'partial'
    );
  });

  it('treats an open past-due balance as overdue, including a partial payment', () => {
    assert.equal(
      statusFromPayments({
        storedStatus: 'partial',
        dueDate: '2026-10-01',
        totalCents: 10000,
        paidCents: 4000,
        today: '2026-10-31',
      }),
      'overdue'
    );
  });

  it('returns a voided payment to sent when nothing is due yet', () => {
    assert.equal(
      statusFromPayments({
        storedStatus: 'paid',
        dueDate: '2026-12-01',
        totalCents: 10000,
        paidCents: 0,
        today: '2026-10-31',
      }),
      'sent'
    );
  });

  it('does not reopen a cancelled invoice', () => {
    assert.equal(
      statusFromPayments({
        storedStatus: 'cancelled',
        dueDate: '2026-10-01',
        totalCents: 10000,
        paidCents: 0,
        today: '2026-10-31',
      }),
      'cancelled'
    );
  });
});

describe('aging and recurrence', () => {
  it('buckets open balances the way a books aging report does', () => {
    assert.equal(agingBucket(null, '2026-10-31'), 'current');
    assert.equal(agingBucket('2026-10-31', '2026-10-31'), 'current');
    assert.equal(agingBucket('2026-10-20', '2026-10-31'), 'days1to30');
    assert.equal(agingBucket('2026-09-15', '2026-10-31'), 'days31to60');
    assert.equal(agingBucket('2026-08-15', '2026-10-31'), 'days61to90');
    assert.equal(agingBucket('2026-01-01', '2026-10-31'), 'days90plus');
  });

  it('steps a monthly schedule into the next month', () => {
    assert.equal(nextRecurringDate('2026-01-31', 'monthly'), '2026-03-03');
    assert.equal(nextRecurringDate('2026-10-31', 'weekly'), '2026-11-07');
  });
});
