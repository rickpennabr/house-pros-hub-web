import assert from 'node:assert/strict';
import test from 'node:test';
import { afterFinishDestination, finishSetupPath, safeFinishNext } from './finishSetup';

test('a new Google customer opens the finish screen and can return to an estimate', () => {
  assert.equal(
    finishSetupPath('en', { welcome: true, nextPath: '/en/estimate' }),
    '/en/signup/finish?welcome=1&next=%2Fen%2Festimate'
  );
});

test('a returning unfinished Google sign-in opens the same screen without the thanks flag', () => {
  assert.equal(
    finishSetupPath('es', { welcome: false, nextPath: '/es' }),
    '/es/signup/finish'
  );
});

test('the first finished visit goes to the thanks screen unless they came from an estimate', () => {
  assert.equal(afterFinishDestination('en', null, true), '/en/signup/success?role=customer');
  assert.equal(afterFinishDestination('en', '/en/quick-repair?step=3', true), '/en/quick-repair?step=3');
  assert.equal(
    afterFinishDestination('en', '/en/book/the-paver-pro?step=confirm', true),
    '/en/signup/success?role=customer&returnUrl=%2Fen%2Fbook%2Fthe-paver-pro%3Fstep%3Dconfirm'
  );
  assert.equal(afterFinishDestination('pt', '/pt/businesslist', false), '/pt/businesslist');
});

test('an off-site return path is dropped', () => {
  assert.equal(safeFinishNext('https://evil.example', 'en'), null);
  assert.equal(safeFinishNext('//evil.example', 'en'), null);
});
