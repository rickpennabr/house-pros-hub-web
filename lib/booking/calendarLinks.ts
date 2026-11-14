import { isManageToken } from '@/lib/booking/appointmentPolicy';

export interface CalendarEventLinkInput {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
}

export interface CalendarEmailLabels {
  addToCalendar: string;
  googleCalendar: string;
  outlookCalendar: string;
  otherCalendar: string;
}

function calendarStamp(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function eventTimes(input: CalendarEventLinkInput): { start: Date; end: Date } | null {
  const start = new Date(input.startAt);
  const end = new Date(input.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

/** Opens Google Calendar with the visit filled in. The user confirms the add. */
export function googleCalendarUrl(input: CalendarEventLinkInput): string | null {
  const times = eventTimes(input);
  const start = times ? calendarStamp(times.start.toISOString()) : null;
  const end = times ? calendarStamp(times.end.toISOString()) : null;
  if (!start || !end) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${start}/${end}`,
    details: input.description,
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Opens Outlook on the web with the visit filled in. */
export function outlookCalendarUrl(input: CalendarEventLinkInput): string | null {
  const times = eventTimes(input);
  if (!times) return null;
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: input.title,
    startdt: times.start.toISOString(),
    enddt: times.end.toISOString(),
    body: input.description,
    location: input.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function visitCalendarTitle(businessName: string, serviceName?: string | null): string {
  const business = businessName.trim() || 'Visit';
  const service = serviceName?.trim();
  return service ? `${business}: ${service}` : `${business} visit`;
}

export function visitCalendarDescription(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter(Boolean).join('\n');
}

/** Same file the confirmation email attaches, so Apple Calendar and others can import it. */
export function icsUrlFromManageUrl(manageUrl: string | null | undefined): string | null {
  if (!manageUrl) return null;
  try {
    const url = new URL(manageUrl);
    const token = url.pathname.split('/').filter(Boolean).pop() ?? '';
    if (!isManageToken(token)) return null;
    return `${url.origin}/api/appointments/${token}/ics`;
  } catch {
    return null;
  }
}

export function icsPathFromManagePath(managePath: string | null | undefined): string | null {
  if (!managePath) return null;
  const token = managePath.split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
  if (!isManageToken(token)) return null;
  return `/api/appointments/${token}/ics`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailCalendarLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display: inline-block; margin: 0 8px 8px 0; padding: 10px 14px; border: 2px solid #000000; color: #000000; background-color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px;">${escapeHtml(label)}</a>`;
}

/** Buttons for the confirmation email. A cancelled visit keeps the .ics attachment and skips these links. */
export function calendarEmailButtons(input: CalendarEventLinkInput & {
  icsUrl: string | null;
  cancelled: boolean;
  labels: CalendarEmailLabels;
}): string {
  if (input.cancelled) return '';
  const event = {
    title: input.title,
    description: input.description,
    location: input.location,
    startAt: input.startAt,
    endAt: input.endAt,
  };
  const google = googleCalendarUrl(event);
  const outlook = outlookCalendarUrl(event);
  const links = [
    google ? emailCalendarLink(google, input.labels.googleCalendar) : '',
    outlook ? emailCalendarLink(outlook, input.labels.outlookCalendar) : '',
    input.icsUrl ? emailCalendarLink(input.icsUrl, input.labels.otherCalendar) : '',
  ].filter(Boolean);
  if (links.length === 0) return '';
  return `<p style="margin: 20px 0 0 0; font-size: 14px; color: #333;">${escapeHtml(input.labels.addToCalendar)}</p><p style="margin: 8px 0 0 0;">${links.join('')}</p>`;
}
