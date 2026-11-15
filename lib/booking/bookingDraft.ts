/** Keeps an in-progress book appointment across signup / Google OAuth. */

export interface BookingDraftVisit {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  note: string;
}

export interface BookingDraft {
  businessId: string;
  selectedServiceIds: string[];
  generalEstimate: boolean;
  /** YYYY-MM-DD in local calendar terms */
  selectedDate: string | null;
  selectedSlot: { start: string; end: string } | null;
  visit: BookingDraftVisit;
  step: 'confirm';
}

const KEY = 'hph-booking-draft';

export function bookingDraftKey(businessId: string): string {
  return `${KEY}:${businessId}`;
}

export function saveBookingDraft(draft: BookingDraft): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(bookingDraftKey(draft.businessId), JSON.stringify(draft));
  } catch {
    // Private mode can block storage; signup still works, resume may miss selections.
  }
}

export function readBookingDraft(businessId: string): BookingDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(bookingDraftKey(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingDraft>;
    if (parsed.businessId !== businessId || parsed.step !== 'confirm') return null;
    return {
      businessId,
      selectedServiceIds: Array.isArray(parsed.selectedServiceIds)
        ? parsed.selectedServiceIds.filter((id): id is string => typeof id === 'string')
        : [],
      generalEstimate: parsed.generalEstimate === true,
      selectedDate: typeof parsed.selectedDate === 'string' ? parsed.selectedDate : null,
      selectedSlot:
        parsed.selectedSlot &&
        typeof parsed.selectedSlot.start === 'string' &&
        typeof parsed.selectedSlot.end === 'string'
          ? { start: parsed.selectedSlot.start, end: parsed.selectedSlot.end }
          : null,
      visit: {
        streetAddress: typeof parsed.visit?.streetAddress === 'string' ? parsed.visit.streetAddress : '',
        city: typeof parsed.visit?.city === 'string' ? parsed.visit.city : '',
        state: typeof parsed.visit?.state === 'string' ? parsed.visit.state : '',
        zipCode: typeof parsed.visit?.zipCode === 'string' ? parsed.visit.zipCode : '',
        note: typeof parsed.visit?.note === 'string' ? parsed.visit.note : '',
      },
      step: 'confirm',
    };
  } catch {
    return null;
  }
}

export function clearBookingDraft(businessId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(bookingDraftKey(businessId));
  } catch {
    // ignore
  }
}

export function dateFromDraftDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function draftDayFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
