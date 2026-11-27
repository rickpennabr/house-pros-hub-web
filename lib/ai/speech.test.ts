import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { speakableText } from './speech';

describe('speakableText', () => {
  it('drops markdown and keeps a short answer whole', () => {
    assert.equal(speakableText('**Two** invoices are open. Denise is the oldest.'), 'Two invoices are open. Denise is the oldest.');
  });

  it('cuts a long reply on a sentence', () => {
    const long = `${'Waiting on payment. '.repeat(40)}And then a tail that should not be spoken.`;
    const spoken = speakableText(long, 80);
    assert.ok(spoken.endsWith('.'));
    assert.ok(spoken.length <= 80);
  });
});
