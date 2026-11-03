/** Customers and pros can cancel or reschedule until this long before the visit. */
export const CHANGE_LEAD_MS = 2 * 60 * 60 * 1000;

export const CHANGE_LOCKED_ERROR = 'Appointments can be changed until 2 hours before the start.';

const MANAGE_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isManageToken(value: string): boolean {
  return MANAGE_TOKEN_RE.test(value);
}

export function bookingLocale(value: unknown): 'en' | 'es' | 'pt' {
  return value === 'es' || value === 'pt' ? value : 'en';
}

export function canChangeAppointment(slotStartAt: Date, now: Date, status: string): boolean {
  if (status !== 'confirmed') return false;
  if (Number.isNaN(slotStartAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return slotStartAt.getTime() - now.getTime() >= CHANGE_LEAD_MS;
}

export function slotIsFarEnough(slotStartAt: Date, now: Date): boolean {
  if (Number.isNaN(slotStartAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return slotStartAt.getTime() - now.getTime() >= CHANGE_LEAD_MS;
}

export function appointmentManageUrl(origin: string, locale: string | null | undefined, token: string | null | undefined): string | null {
  const base = origin.trim().replace(/\/$/, '');
  if (!base || !token || !isManageToken(token)) return null;
  return `${base}/${bookingLocale(locale)}/appointments/${token}`;
}
