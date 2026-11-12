import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateStatusTotal, summarizeEstimateStatuses } from './estimate-books';

describe('summarizeEstimateStatuses', () => {
  it('totals count and amount for each estimate status', () => {
    const summary = summarizeEstimateStatuses([
      { status: 'draft', amountCents: 15000 },
      { status: 'draft', amountCents: 5000 },
      { status: 'sent', amountCents: 68000 },
      { status: 'accepted', amountCents: 20000 },
      { status: 'declined', amountCents: 1000 },
      { status: 'other', amountCents: 9000 },
    ]);

    assert.deepEqual(summary.draft, { count: 2, cents: 20000 });
    assert.deepEqual(summary.sent, { count: 1, cents: 68000 });
    assert.deepEqual(summary.accepted, { count: 1, cents: 20000 });
    assert.deepEqual(summary.declined, { count: 1, cents: 1000 });
    assert.deepEqual(estimateStatusTotal(summary), { count: 5, cents: 109000 });
  });
});
