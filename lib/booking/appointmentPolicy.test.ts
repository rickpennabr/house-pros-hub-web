import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appointmentManageUrl, canChangeAppointment, CHANGE_LEAD_MS, slotIsFarEnough } from './appointmentPolicy';

const start = new Date('2026-04-10T18:00:00.000Z');

describe('appointment change window', () => {
  it('allows a change exactly 2 hours before a confirmed visit', () => {
    const now = new Date(start.getTime() - CHANGE_LEAD_MS);
    assert.equal(canChangeAppointment(start, now, 'confirmed'), true);
    assert.equal(slotIsFarEnough(start, now), true);
  });

  it('blocks a change inside the 2-hour window and after the status changes', () => {
    const now = new Date(start.getTime() - CHANGE_LEAD_MS + 1);
    assert.equal(canChangeAppointment(start, now, 'confirmed'), false);
    assert.equal(canChangeAppointment(start, new Date(start.getTime() - CHANGE_LEAD_MS), 'cancelled'), false);
    assert.equal(canChangeAppointment(start, new Date(start.getTime() - CHANGE_LEAD_MS), 'completed'), false);
  });

  it('builds a locale manage link only for a real token', () => {
    const token = '11111111-1111-4111-8111-111111111111';
    assert.equal(
      appointmentManageUrl('https://houseproshub.com/', 'pt', token),
      `https://houseproshub.com/pt/appointments/${token}`
    );
    assert.equal(appointmentManageUrl('https://houseproshub.com', 'fr', token), `https://houseproshub.com/en/appointments/${token}`);
    assert.equal(appointmentManageUrl('https://houseproshub.com', 'en', 'not-a-token'), null);
  });
});
