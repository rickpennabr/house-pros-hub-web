import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  crmEstimateCreateSchema,
  crmEstimateUpdateSchema,
  customerCanAcceptEstimate,
  depositWithinEstimate,
  estimateReadyForWork,
  isValidEstimateStatusTransition,
  normalizeEstimateAmountCents,
} from '@/lib/schemas/crmEstimate';

describe('crmEstimate schema', () => {
  it('parses a valid create payload', () => {
    const parsed = crmEstimateCreateSchema.safeParse({
      customerId: '11111111-1111-4111-8111-111111111111',
      status: 'draft',
      dueDate: '2026-03-26',
      note: 'test',
      lineItems: [
        {
          product_or_service: 'Paint',
          qty: 2,
          rate_cents: 15000,
          amount_cents: 30000,
        },
      ],
    });

    assert.equal(parsed.success, true);
  });

  it('rejects invalid status for update payload', () => {
    const parsed = crmEstimateUpdateSchema.safeParse({
      status: 'paid',
    });

    assert.equal(parsed.success, false);
  });
});

describe('crmEstimate transitions and totals', () => {
  it('allows forward status transitions only', () => {
    assert.equal(isValidEstimateStatusTransition('draft', 'sent'), true);
    assert.equal(isValidEstimateStatusTransition('sent', 'accepted'), true);
    assert.equal(isValidEstimateStatusTransition('accepted', 'draft'), false);
    assert.equal(customerCanAcceptEstimate('sent'), true);
    assert.equal(customerCanAcceptEstimate('draft'), false);
    assert.equal(estimateReadyForWork('accepted'), true);
    assert.equal(estimateReadyForWork('sent'), false);
    assert.equal(depositWithinEstimate(5000, 10000), null);
    assert.equal(depositWithinEstimate(15000, 10000), 'Deposit cannot be more than the estimate');
  });

  it('normalizes total amount cents from line items', () => {
    const total = normalizeEstimateAmountCents([
      { qty: 2, rate_cents: 1000, amount_cents: 2000 },
      { qty: 1, rate_cents: 500, amount_cents: 500 },
    ]);
    assert.equal(total, 2500);
  });
});
