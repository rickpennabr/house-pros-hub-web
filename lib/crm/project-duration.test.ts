import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectDurationText } from './project-duration';

test('counts both the start and end day', () => {
  assert.equal(projectDurationText('2026-11-23', '2026-11-26'), '4 days');
  assert.equal(projectDurationText('2026-11-23', '2026-11-23'), '1 day');
});

test('long projects show weeks', () => {
  assert.equal(projectDurationText('2026-10-21', '2026-11-22'), '4.7 weeks (33 days)');
});

test('missing or backwards dates show nothing', () => {
  assert.equal(projectDurationText('2026-11-23', null), '');
  assert.equal(projectDurationText(null, '2026-11-23'), '');
  assert.equal(projectDurationText('2026-11-26', '2026-11-23'), '');
});
