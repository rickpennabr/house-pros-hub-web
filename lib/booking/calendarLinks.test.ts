import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calendarEmailButtons,
  googleCalendarUrl,
  icsPathFromManagePath,
  icsUrlFromManageUrl,
  outlookCalendarUrl,
  visitCalendarTitle,
} from './calendarLinks';

const event = {
  title: 'Ace Pavers: Estimate',
  description: 'Gate code 1234',
  location: '1 Main St, Las Vegas, NV 89101',
  startAt: '2026-04-10T18:00:00.000Z',
  endAt: '2026-04-10T19:30:00.000Z',
};

const labels = {
  addToCalendar: 'Add it to your calendar',
  googleCalendar: 'Google Calendar',
  outlookCalendar: 'Outlook',
  otherCalendar: 'Apple and other calendars',
};

describe('calendar links', () => {
  it('opens Google Calendar and Outlook with the visit filled in', () => {
    const google = googleCalendarUrl(event);
    const outlook = outlookCalendarUrl(event);
    assert.ok(google);
    assert.ok(outlook);
    assert.match(google, /^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    assert.match(google, /dates=20260410T180000Z%2F20260410T193000Z/);
    assert.match(google, /text=Ace\+Pavers%3A\+Estimate/);
    assert.match(outlook, /^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose\?/);
    assert.match(outlook, /startdt=2026-04-10T18%3A00%3A00\.000Z/);
    assert.equal(googleCalendarUrl({ ...event, startAt: 'not-a-date' }), null);
  });

  it('turns the manage link into the calendar file download', () => {
    const token = '11111111-1111-4111-8111-111111111111';
    assert.equal(
      icsUrlFromManageUrl(`https://houseproshub.com/en/appointments/${token}`),
      `https://houseproshub.com/api/appointments/${token}/ics`
    );
    assert.equal(icsPathFromManagePath(`/es/appointments/${token}`), `/api/appointments/${token}/ics`);
    assert.equal(icsUrlFromManageUrl('https://houseproshub.com/en/appointments/not-a-token'), null);
    assert.equal(visitCalendarTitle('Ace Pavers', 'Estimate'), 'Ace Pavers: Estimate');
    assert.equal(visitCalendarTitle('Ace Pavers', '  '), 'Ace Pavers visit');
  });

  it('puts add buttons in the email and skips them when the visit is cancelled', () => {
    const html = calendarEmailButtons({
      ...event,
      icsUrl: 'https://houseproshub.com/api/appointments/11111111-1111-4111-8111-111111111111/ics',
      cancelled: false,
      labels,
    });
    assert.match(html, /calendar\.google\.com/);
    assert.match(html, /outlook\.live\.com/);
    assert.match(html, /visit\.ics|\/ics/);
    assert.match(html, /Apple and other calendars/);
    assert.equal(calendarEmailButtons({ ...event, icsUrl: null, cancelled: true, labels }), '');
  });
});
