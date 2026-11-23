import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactActionsFor, crewRoleOf } from './contact-actions';

const role = (slug: string, can_invoice = false) => ({ slug, can_invoice });

test('customers get the portal and billing', () => {
  assert.deepEqual(contactActionsFor([role('customer', true)]), ['portal', 'estimate', 'invoice', 'project', 'task']);
});

test('contacts with no roles are treated as customers', () => {
  assert.deepEqual(contactActionsFor([]), ['portal', 'estimate', 'invoice', 'project', 'task']);
  assert.deepEqual(contactActionsFor(undefined), ['portal', 'estimate', 'invoice', 'project', 'task']);
});

test('employees and crew are never invoiced', () => {
  for (const slug of ['employee', 'subcontractor', 'project_manager']) {
    const actions = contactActionsFor([role(slug)]);
    assert.deepEqual(actions, ['addToJob', 'task'], slug);
    assert.ok(!actions.includes('invoice'));
  }
});

test('suppliers get expenses, not invoices', () => {
  assert.deepEqual(contactActionsFor([role('supplier')]), ['expense', 'task']);
});

test('a custom billable role can be invoiced but has no portal', () => {
  assert.deepEqual(contactActionsFor([role('property-manager', true)]), ['estimate', 'invoice', 'task']);
});

test('several roles give the union in menu order', () => {
  assert.deepEqual(contactActionsFor([role('supplier'), role('customer', true)]), [
    'portal',
    'estimate',
    'invoice',
    'project',
    'expense',
    'task',
  ]);
});

test('crewRoleOf picks the first crew role', () => {
  assert.deepEqual(crewRoleOf([role('customer', true), role('employee')]), role('employee'));
  assert.equal(crewRoleOf([role('customer', true)]), null);
});
