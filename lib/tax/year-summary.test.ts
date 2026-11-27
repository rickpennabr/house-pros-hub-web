import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareMileage, scheduleCKeyFor, selfEmploymentTaxCents, irsMileageCents } from './schedule-c';
import { buildTaxYearSummary } from './year-summary';

test('expense categories map to Schedule C lines', () => {
  assert.equal(scheduleCKeyFor('Materials'), 'cogs');
  assert.equal(scheduleCKeyFor('Subcontractor'), 'contractLabor');
  assert.equal(scheduleCKeyFor('Meals'), 'meals');
  assert.equal(scheduleCKeyFor('Fuel'), 'car');
  assert.equal(scheduleCKeyFor('Something new'), 'other');
  assert.equal(scheduleCKeyFor(null), 'other');
});

test('mileage picks the larger deduction', () => {
  const standard = compareMileage(1000, 30_000, 2025);
  assert.equal(standard.standardCents, 70_000);
  assert.equal(standard.best, 'standard');
  const actual = compareMileage(100, 90_000, 2025);
  assert.equal(actual.best, 'actual');
  assert.equal(actual.bestCents, 90_000);
  assert.equal(irsMileageCents(2030), irsMileageCents(2026));
});

test('self-employment tax: 15.3% of 92.35%, none under $400', () => {
  assert.equal(selfEmploymentTaxCents(30_000, 2025), 0);
  assert.equal(selfEmploymentTaxCents(-5_000, 2025), 0);
  // $10,000 profit → $9,235 base → $1,145.14 SS + $267.82 Medicare
  assert.equal(selfEmploymentTaxCents(1_000_000, 2025), 114_514 + 26_782);
});

test('year summary: receipts, meals at 50%, vehicle choice, 1099s, missing receipts', () => {
  const summary = buildTaxYearSummary({
    year: 2026,
    payments: [
      { amount_cents: 500_000, payment_date: '2026-03-01', method: 'check' },
      { amount_cents: 100_000, payment_date: '2026-04-01', method: 'card', voided_at: '2026-04-02' },
      { amount_cents: 999_999, payment_date: '2025-12-31', method: 'cash' },
    ],
    expenses: [
      { id: 'm', amount_cents: 100_000, category: 'Materials', expense_date: '2026-02-01', receipt_url: 'r' },
      { id: 'meal', amount_cents: 10_000, category: 'Meals', expense_date: '2026-02-02' },
      { id: 'fuel', amount_cents: 20_000, category: 'Fuel', expense_date: '2026-02-03', receipt_url: 'r' },
      { id: 'sub', amount_cents: 70_000, category: 'Subcontractor', expense_date: '2026-05-01', supplier_id: 'c1', payment_method: 'check', receipt_url: 'r' },
      { id: 'sub-card', amount_cents: 90_000, category: 'Subcontractor', expense_date: '2026-05-02', supplier_id: 'c2', payment_method: 'card', receipt_url: 'r' },
    ],
    trips: [{ miles: '1000', trip_date: '2026-06-01' }],
    contacts: [
      { id: 'c1', display_name: 'Joe Tile LLC', w9_received_at: null },
      { id: 'c2', display_name: 'Card Paid Inc', w9_received_at: '2026-01-01' },
    ],
    subcontractorIds: new Set(['c1', 'c2']),
  });
  assert.equal(summary.grossReceiptsCents, 500_000);
  assert.equal(summary.paymentCount, 1);
  const meals = summary.lines.find((line) => line.key === 'meals');
  assert.equal(meals?.deductibleCents, 5_000);
  assert.equal(summary.expensesCents, 100_000 + 5_000 + 70_000 + 90_000);
  assert.equal(summary.mileage.best, 'standard');
  assert.equal(summary.mileage.standardCents, 72_500);
  assert.equal(summary.netProfitCents, 500_000 - summary.expensesCents - 72_500);
  assert.deepEqual(summary.form1099.map((row) => [row.name, row.hasW9]), [['Joe Tile LLC', false]]);
  assert.deepEqual(summary.missingReceipts.map((row) => row.id), ['meal']);
  assert.equal(summary.quarterlySeTaxCents, Math.round(summary.selfEmploymentTaxCents / 4));
});
