import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSmallTalk } from './small-talk';

test('greetings and thanks are small talk', () => {
  for (const text of ['hi', 'Hello ProBot!', 'thanks 🙏', 'ok cool', 'Hola, ¿cómo estás?', 'Oi, tudo bem?', 'good morning Rick', 'Obrigado!']) {
    assert.equal(isSmallTalk(text, 'Rick'), true, text);
  }
});

test('real questions are not small talk', () => {
  for (const text of ['hi, who owes me money?', 'how much are pavers', 'find a plumber', 'Hola, necesito un estimado', 'ok send the invoice to John', '']) {
    assert.equal(isSmallTalk(text, 'Rick'), false, text);
  }
});
