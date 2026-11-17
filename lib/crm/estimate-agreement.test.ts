import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  datePlusDays,
  nextVisitOffsetDays,
  normalizeAgreementKind,
  normalizeMaintenanceFrequency,
  toRecurringInvoiceFrequency,
} from '@/lib/crm/estimate-agreement';

describe('estimate-agreement', () => {
  it('keeps maintenance cadence only on maintenance agreements', () => {
    assert.equal(normalizeAgreementKind('repair'), 'repair');
    assert.equal(normalizeMaintenanceFrequency('repair', 'weekly'), null);
    assert.equal(normalizeMaintenanceFrequency('maintenance', 'biweekly'), 'biweekly');
    assert.equal(normalizeMaintenanceFrequency('maintenance', 'every_15_days'), null);
  });

  it('maps visit offsets and recurring invoice schedules', () => {
    assert.equal(nextVisitOffsetDays('biweekly'), 14);
    assert.equal(nextVisitOffsetDays('weekly'), 7);
    assert.equal(toRecurringInvoiceFrequency('biweekly'), 'biweekly');
    assert.equal(toRecurringInvoiceFrequency('quarterly'), null);
    assert.equal(datePlusDays('2026-11-17', 14), '2026-12-01');
  });
});
