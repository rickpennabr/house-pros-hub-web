import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isProTool, planVisitDates, proOpenAiTools, PRO_TOOL_NAMES, resolveDay, todayIn } from './pro-tools';

const TODAY = '2026-11-25'; // a Wednesday

describe('resolveDay', () => {
  it('reads today, tomorrow and yesterday in three languages', () => {
    assert.equal(resolveDay('today', TODAY), '2026-11-25');
    assert.equal(resolveDay('Tomorrow', TODAY), '2026-11-26');
    assert.equal(resolveDay('mañana', TODAY), '2026-11-26');
    assert.equal(resolveDay('amanhã', TODAY), '2026-11-26');
    assert.equal(resolveDay('yesterday', TODAY), '2026-11-24');
  });

  it('puts a bare day of the month in this month, or next month once it has passed', () => {
    assert.equal(resolveDay('the 26th', TODAY), '2026-11-26');
    assert.equal(resolveDay('26', TODAY), '2026-11-26');
    assert.equal(resolveDay('25th', TODAY), '2026-11-25');
    assert.equal(resolveDay('the 3rd', TODAY), '2026-12-03');
    assert.equal(resolveDay('el 3', '2026-12-20'), '2027-01-03');
  });

  it('reads month names, slashes and ISO dates', () => {
    assert.equal(resolveDay('Nov 26', TODAY), '2026-11-26');
    assert.equal(resolveDay('December 1st', TODAY), '2026-12-01');
    assert.equal(resolveDay('12/5', TODAY), '2026-12-05');
    assert.equal(resolveDay('2027-01-15', TODAY), '2027-01-15');
  });

  it('takes the next weekday, never today', () => {
    assert.equal(resolveDay('friday', TODAY), '2026-11-27');
    assert.equal(resolveDay('next monday', TODAY), '2026-11-30');
    assert.equal(resolveDay('wednesday', TODAY), '2026-12-02');
    assert.equal(resolveDay('viernes', TODAY), '2026-11-27');
  });

  it('gives up on nonsense and impossible dates', () => {
    assert.equal(resolveDay('someday', TODAY), null);
    assert.equal(resolveDay('the 31st', '2026-11-25'), '2026-12-31');
    assert.equal(resolveDay('2026-02-30', TODAY), null);
  });
});

describe('planVisitDates', () => {
  it('steps weekly and biweekly from the next visit', () => {
    assert.deepEqual(planVisitDates('2026-11-12', 'weekly', '2026-11-26', null), ['2026-11-12', '2026-11-19', '2026-11-26']);
    assert.deepEqual(planVisitDates('2026-11-12', 'biweekly', '2026-11-26', null), ['2026-11-12', '2026-11-26']);
  });

  it('keeps the day of the month for monthly plans, clamped to short months', () => {
    assert.deepEqual(planVisitDates('2026-10-31', 'monthly', '2027-01-31', null), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
  });

  it('stops at the plan end date', () => {
    assert.deepEqual(planVisitDates('2026-11-12', 'weekly', '2026-12-31', '2026-11-20'), ['2026-11-12', '2026-11-19']);
  });
});

describe('pro tools', () => {
  it('offers every pro tool and only reads', () => {
    const names = proOpenAiTools().map((tool) => tool.function.name);
    assert.deepEqual(names, [...PRO_TOOL_NAMES]);
    assert.ok(names.every((name) => isProTool(name)));
    assert.ok(names.every((name) => /^get_/.test(name)));
    assert.equal(isProTool('approve_estimate'), false);
  });

  it('works out today in the pro time zone', () => {
    // 2026-11-26 05:00 UTC is still the 25th in Las Vegas.
    assert.equal(todayIn('America/Los_Angeles', new Date('2026-11-26T05:00:00Z')), '2026-11-25');
  });
});
