import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDueSoon } from './invoice-books';
import { expenseIdsOnLines, markedUpCents } from './job-costs';
import { buildProgressInvoice, contractBilledCents, scaleContractLines } from './progress-billing';

describe('progress billing', () => {
  it('ignores cancelled invoices when it adds up what is already billed', () => {
    assert.equal(
      contractBilledCents([
        { status: 'paid', amount_cents: 4000 },
        { status: 'cancelled', amount_cents: 9000 },
        { status: 'draft', amount_cents: 1000 },
      ]),
      5000
    );
  });

  it('bills the remainder when no amount is requested', () => {
    const draft = buildProgressInvoice({
      contractCents: 10000,
      billedCents: 4000,
      lineItems: [
        { description: 'Labor', amount_cents: 6000 },
        { description: 'Materials', amount_cents: 4000 },
      ],
      note: null,
    });
    assert.ok(!('error' in draft));
    if ('error' in draft) return;
    assert.equal(draft.amountCents, 6000);
    assert.equal(draft.remainingAfterCents, 0);
    assert.equal(draft.lineItems?.reduce((sum, line) => sum + (line.amount_cents ?? 0), 0), 6000);
  });

  it('keeps the original lines when the first invoice is the whole estimate', () => {
    const lines = [{ description: 'Roof', qty: 2, rate_cents: 5000, amount_cents: 10000 }];
    const draft = buildProgressInvoice({
      contractCents: 10000,
      billedCents: 0,
      requestedCents: 10000,
      lineItems: lines,
      note: 'Thanks',
    });
    assert.ok(!('error' in draft));
    if ('error' in draft) return;
    assert.equal(draft.note, 'Thanks');
    assert.equal(draft.lineItems?.[0].qty, 2);
  });

  it('rejects an amount past the open balance', () => {
    const draft = buildProgressInvoice({
      contractCents: 10000,
      billedCents: 8000,
      requestedCents: 3000,
      lineItems: [],
      note: null,
    });
    assert.deepEqual(draft, { error: 'That amount is more than the remaining balance' });
  });

  it('puts rounding on the last line', () => {
    const lines = scaleContractLines(
      [
        { description: 'A', amount_cents: 33 },
        { description: 'B', amount_cents: 33 },
        { description: 'C', amount_cents: 34 },
      ],
      50
    );
    assert.equal(lines.reduce((sum, line) => sum + (line.amount_cents ?? 0), 0), 50);
  });
});

describe('job costs and due soon', () => {
  it('marks a cost up and reads expense ids off invoice lines', () => {
    assert.equal(markedUpCents(10000, 10), 11000);
    assert.deepEqual(
      expenseIdsOnLines([{ description: 'Labor' }, { expense_id: '11111111-1111-4111-8111-111111111111' }]),
      ['11111111-1111-4111-8111-111111111111']
    );
  });

  it('treats today through three days out as due soon', () => {
    assert.equal(isDueSoon('2026-11-10', '2026-11-10'), true);
    assert.equal(isDueSoon('2026-11-13', '2026-11-10'), true);
    assert.equal(isDueSoon('2026-11-14', '2026-11-10'), false);
    assert.equal(isDueSoon('2026-11-09', '2026-11-10'), false);
  });
});
