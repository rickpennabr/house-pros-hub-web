import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyQuickActionMove, readQuickActionOrder, sortBySavedOrder } from './quick-action-order';

describe('quick action order', () => {
  it('ignores invalid saved values', () => {
    assert.deepEqual(readQuickActionOrder(null), []);
    assert.deepEqual(readQuickActionOrder('nope'), []);
    assert.deepEqual(readQuickActionOrder('["2","1","2",1]'), ['2', '1']);
  });

  it('puts saved cards first and leaves new cards at the end', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.deepEqual(
      sortBySavedOrder(items, ['c', 'a']).map((item) => item.id),
      ['c', 'a', 'b'],
    );
  });

  it('moves a visible card and keeps a hidden card in its slot', () => {
    assert.deepEqual(
      applyQuickActionMove(['crm', 'edit', 'resume', 'drive'], ['edit', 'crm', 'drive'], 'drive', 'crm'),
      ['drive', 'crm', 'resume', 'edit'],
    );
  });

  it('leaves the saved list alone when the card is dropped on itself', () => {
    const saved = ['edit', 'add'];
    assert.equal(applyQuickActionMove(saved, ['edit', 'add'], 'edit', 'edit'), saved);
  });
});
