import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descriptionsToRemember, lineKey } from './line-descriptions';

test('keys ignore case and extra spaces', () => {
  assert.equal(lineKey('  Paver   Installation '), 'paver installation');
});

test('only lines with a service and a description are remembered, once each', () => {
  const found = descriptionsToRemember([
    { product_or_service: 'Paver installation', description: 'Paver installation in the driveway' },
    { product_or_service: 'paver installation', description: 'PAVER INSTALLATION IN THE DRIVEWAY' },
    { product_or_service: 'Paver installation', description: '' },
    { product_or_service: '', description: 'No service' },
    { product_or_service: 'Materials', description: 'Sand', expense_id: 'abc' },
  ]);
  assert.deepEqual(found, [{ item: 'Paver installation', description: 'Paver installation in the driveway' }]);
});

test('anything that is not a list gives nothing', () => {
  assert.deepEqual(descriptionsToRemember(null), []);
  assert.deepEqual(descriptionsToRemember({}), []);
});
