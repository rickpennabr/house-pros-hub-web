import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bucketForCategory, buildJobFinancials, isOverheadCategory, toolDaysByJob } from './job-financials';

test('categories land in the right cost bucket', () => {
  assert.equal(bucketForCategory('Materials'), 'materials');
  assert.equal(bucketForCategory(' labor '), 'labor');
  assert.equal(bucketForCategory('Subcontractor'), 'subcontractors');
  assert.equal(bucketForCategory('Equipment'), 'equipment');
  assert.equal(bucketForCategory('Fuel'), 'delivery');
  assert.equal(bucketForCategory('Something new'), 'other');
  assert.equal(isOverheadCategory('Insurance'), true);
  assert.equal(isOverheadCategory('Materials'), false);
});

test('a full job: revenue, buckets, overhead, profit', () => {
  const result = buildJobFinancials({
    contractCents: 1_000_000,
    invoices: [
      { id: 'i1', amount_cents: 600_000, payment_applied_cents: 600_000, status: 'paid' },
      { id: 'i2', amount_cents: 400_000, payment_applied_cents: 100_000, status: 'partial' },
      { id: 'i3', amount_cents: 999_999, status: 'draft' },
      { id: 'i4', amount_cents: 999_999, status: 'cancelled' },
    ],
    expenses: [
      { id: 'e1', amount_cents: 200_000, category: 'Materials', expense_date: '2026-11-01' },
      { id: 'e2', amount_cents: 50_000, category: 'Subcontractor', expense_date: '2026-11-02' },
    ],
    timeEntries: [{ id: 't1', work_date: '2026-11-03', hours: '8', rate_cents_per_hour: 3000, person_name: 'Ana' }],
    mileage: [
      { id: 'm1', trip_date: '2026-11-03', amount_cents: 1_500, miles: 20 },
      { id: 'm2', trip_date: '2026-11-04', amount_cents: 9_999, miles: 99, expense_id: 'e9' },
    ],
    toolDays: [{ toolId: 'x', name: 'Skid steer', days: 2, dailyRateCents: 5_000 }],
    overheadPercent: 15,
  });
  assert.equal(result.revenue.invoicedCents, 1_000_000);
  assert.equal(result.revenue.collectedCents, 700_000);
  assert.equal(result.revenue.outstandingCents, 300_000);
  assert.equal(result.costs.materials, 200_000);
  assert.equal(result.costs.subcontractors, 50_000);
  assert.equal(result.costs.labor, 24_000);
  assert.equal(result.costs.mileage, 1_500, 'a trip that became an expense is not counted twice');
  assert.equal(result.costs.equipment, 10_000);
  assert.equal(result.directCostCents, 285_500);
  assert.equal(result.overheadCents, 42_825);
  assert.equal(result.netProfitCents, 1_000_000 - 285_500 - 42_825);
  assert.equal(result.revenueBasis, 'invoiced');
  assert.equal(result.laborHours, 8);
});

test('nothing invoiced yet: margins use the contract', () => {
  const result = buildJobFinancials({
    contractCents: 100_000,
    invoices: [],
    expenses: [{ id: 'e', amount_cents: 40_000, category: 'Materials', expense_date: '2026-11-01' }],
    overheadPercent: 0,
  });
  assert.equal(result.revenueBasis, 'contract');
  assert.equal(result.grossMarginPercent, 60);
});

test('no revenue at all: margins are empty, not divide-by-zero', () => {
  const result = buildJobFinancials({ contractCents: null, invoices: [], expenses: [], overheadPercent: 10 });
  assert.equal(result.revenueBasis, 'none');
  assert.equal(result.grossMarginPercent, null);
  assert.equal(result.netProfitCents, 0);
});

test('visit crew time is priced per hour', () => {
  const result = buildJobFinancials({
    contractCents: null,
    invoices: [],
    expenses: [],
    visitLabor: [{ id: 'v', date: '2026-11-01', laborSeconds: 2 * 3600 + 1800, rateCentsPerHour: 2000 }],
    overheadPercent: 0,
  });
  assert.equal(result.costs.labor, 5_000);
  assert.equal(result.laborHours, 2.5);
});

test('tool days follow the tool history, counting each calendar day once', () => {
  const tools = [
    { id: 't', name: 'Mixer', daily_rate_cents: 1_000 },
    { id: 'free', name: 'No rate', daily_rate_cents: null },
  ];
  const events = [
    { tool_id: 't', created_at: '2026-11-01T08:00:00Z', project_id: 'A' },
    { tool_id: 't', created_at: '2026-11-04T09:00:00Z', project_id: 'B' },
    { tool_id: 't', created_at: '2026-11-05T09:00:00Z', status: 'available' },
    { tool_id: 'free', created_at: '2026-11-01T08:00:00Z', project_id: 'A' },
  ];
  const days = toolDaysByJob(events, tools, '2026-11-10');
  assert.deepEqual(days.get('project:A'), [{ toolId: 't', name: 'Mixer', days: 3, dailyRateCents: 1_000 }]);
  assert.equal(days.get('project:B')?.[0].days, 1);
  assert.equal(days.size, 2);
});

test('tool still on the job counts through today, clipped to a range', () => {
  const days = toolDaysByJob(
    [{ tool_id: 't', created_at: '2026-11-01T08:00:00Z', maintenance_plan_id: 'P' }],
    [{ id: 't', name: 'Mower', daily_rate_cents: 500 }],
    '2026-11-10',
    { from: '2026-11-06', to: '2026-11-30' }
  );
  assert.equal(days.get('plan:P')?.[0].days, 5);
});
