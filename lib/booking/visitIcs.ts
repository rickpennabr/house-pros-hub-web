export interface VisitIcsInput {
  bookingId: string;
  summary: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  method: 'PUBLISH' | 'CANCEL';
  sequence: number;
}

function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Calendar file so the visit can be added, updated, or removed. */
export function buildVisitIcs(input: VisitIcsInput): string {
  const status = input.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//House Pros Hub//Appointments//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${input.method}`,
    'BEGIN:VEVENT',
    `UID:${input.bookingId}@houseproshub.com`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(input.startAt)}`,
    `DTEND:${toIcsUtc(input.endAt)}`,
    `SUMMARY:${escapeIcs(input.summary)}`,
    `DESCRIPTION:${escapeIcs(input.description)}`,
    `LOCATION:${escapeIcs(input.location)}`,
    `STATUS:${status}`,
    `SEQUENCE:${Math.max(0, input.sequence)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
