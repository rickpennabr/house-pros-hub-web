import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildContactChart, buildExpenseChart, buildInvoiceChart, buildProjectChart } from './list-charts';

const NOW = new Date('2026-11-13T18:00:00.000Z');
const OPTIONS = { now: NOW, timeZone: 'UTC' };

describe('buildInvoiceChart', () => {
  it('keeps drafts out of what is owed and ages the open balance', () => {
    const chart = buildInvoiceChart(
      [
        { status: 'draft', amountCents: 5000, paymentAppliedCents: 0, dueDate: '2026-12-01', invoiceDate: '2026-11-01' },
        { status: 'sent', amountCents: 10000, paymentAppliedCents: 0, dueDate: '2026-11-20', invoiceDate: '2026-11-02' },
        { status: 'overdue', amountCents: 8000, paymentAppliedCents: 3000, dueDate: '2026-08-01', invoiceDate: '2026-07-01' },
        { status: 'cancelled', amountCents: 4000, paymentAppliedCents: 0, dueDate: '2026-01-01', invoiceDate: '2026-01-01' },
      ],
      [{ amountCents: 3000, paymentDate: '2026-11-05', voided: false }, { amountCents: 900, paymentDate: '2026-11-06', voided: true }],
      OPTIONS
    );

    assert.equal(chart.outstandingCents, 15000);
    assert.equal(chart.draftCents, 5000);
    assert.equal(chart.collectedCents, 3000);
    assert.equal(chart.aging.current, 10000);
    assert.equal(chart.aging.days90plus, 5000);
    assert.equal(chart.months[11].values[0], 10000);
    assert.equal(chart.months[11].values[1], 3000);
    assert.equal(chart.months.find((month) => month.key === '2026-07')?.values[0], 8000);
  });
});

describe('buildExpenseChart', () => {
  it('totals the last 12 months and ranks categories', () => {
    const chart = buildExpenseChart(
      [
        { amountCents: 2000, expenseDate: '2026-11-01', category: 'Fuel' },
        { amountCents: 500, expenseDate: '2026-10-01', category: 'Fuel' },
        { amountCents: 9000, expenseDate: '2024-01-01', category: 'Old' },
      ],
      [{ amountCents: 4000, paymentDate: '2026-11-03', voided: false }],
      OPTIONS
    );
    assert.equal(chart.spentCents, 2500);
    assert.equal(chart.thisMonthCents, 2000);
    assert.equal(chart.collectedCents, 4000);
    assert.equal(chart.categories[0].label, 'Fuel');
    assert.equal(chart.categories[0].cents, 2500);
    assert.equal(chart.months[11].values[0], 2000);
  });
});

describe('buildProjectChart', () => {
  it('leaves cancelled jobs out of profit and stacks the contract by outcome', () => {
    const chart = buildProjectChart(
      [
        { status: 'in_progress', contractCents: 10000, costCents: 4000, startedOn: '2026-11-01' },
        { status: 'completed', contractCents: 5000, costCents: 1000, startedOn: '2026-10-01' },
        { status: 'cancelled', contractCents: 8000, costCents: 500, startedOn: '2026-09-01' },
        { status: 'planned', contractCents: null, costCents: 200, startedOn: '2026-11-02' },
      ],
      OPTIONS
    );
    assert.equal(chart.contractCents, 15000);
    assert.equal(chart.costCents, 5200);
    assert.equal(chart.profitCents, 9800);
    assert.equal(chart.months[11].values[0], 10000);
    assert.equal(chart.months[10].values[1], 5000);
    assert.equal(chart.months[9].values[2], 8000);
  });
});

describe('buildContactChart', () => {
  it('counts a contact in each role and in the month they were added', () => {
    const chart = buildContactChart(
      [
        { createdAt: '2026-11-02T18:00:00.000Z', roles: [{ key: 'customer', label: 'Customer' }, { key: 'employee', label: 'Employee' }] },
        { createdAt: '2026-10-02T18:00:00.000Z', roles: [] },
      ],
      OPTIONS
    );
    assert.equal(chart.total, 2);
    assert.equal(chart.thisMonth, 1);
    assert.equal(chart.slices.find((slice) => slice.label === 'Customer')?.count, 1);
    assert.equal(chart.slices.find((slice) => slice.key === '')?.count, 1);
    assert.equal(chart.months[11].values[0], 1);
  });
});
