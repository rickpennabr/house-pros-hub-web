import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { appointmentManageUrl } from '@/lib/booking/appointmentPolicy';
import { changeEmailCopy } from '@/lib/booking/bookingEmailCopy';
import { formatVisitAddress } from '@/lib/booking/visitAddress';
import { safeTimeZone } from '@/lib/booking/dayOfReminder';
import { sendProEstimateBookingCustomerEmail, sendProEstimateBookingProEmail } from '@/lib/services/emailService';
import type { ProEstimateBookingEmailData } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';

type ServiceClient = SupabaseClient<Database>;

export function formatSlot(instant: Date, timeZone: string): string {
  return instant.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: safeTimeZone(timeZone),
  });
}

/**
 * Email the customer and the pro after a cancel or reschedule.
 * A failed email does not undo the appointment change.
 */
export async function notifyBookingChange(
  service: ServiceClient,
  input: {
    bookingId: string;
    kind: 'cancelled' | 'rescheduled';
    actor: 'customer' | 'pro';
    origin: string;
    previousStart?: Date;
  }
): Promise<void> {
  const { data: booking, error } = await service
    .from('pro_estimate_bookings')
    .select(
      'id, business_id, customer_user_id, guest_email, guest_first_name, guest_last_name, guest_phone, service_name, slot_start_at, slot_end_at, manage_token, customer_locale, visit_street, visit_city, visit_state, visit_zip, visit_note, ics_sequence'
    )
    .eq('id', input.bookingId)
    .maybeSingle();
  if (error || !booking) {
    logger.warn('Appointment notice skipped, booking missing', { bookingId: input.bookingId });
    return;
  }

  const { data: business } = await service
    .from('businesses')
    .select('business_name, email, timezone')
    .eq('id', booking.business_id)
    .maybeSingle();

  const timeZone = safeTimeZone(business?.timezone);
  const businessName = business?.business_name?.trim() || 'your pro';
  const customer = await customerContact(service, booking);
  const slotStart = new Date(booking.slot_start_at);
  const slotDisplay = formatSlot(slotStart, timeZone);
  const previousDisplay = input.previousStart ? formatSlot(input.previousStart, timeZone) : null;
  const manageUrl = appointmentManageUrl(input.origin, booking.customer_locale, booking.manage_token);
  const nextSequence = (booking.ics_sequence ?? 0) + 1;
  await service.from('pro_estimate_bookings').update({ ics_sequence: nextSequence }).eq('id', booking.id);
  const copy = changeEmailCopy({
    locale: booking.customer_locale,
    kind: input.kind,
    actor: input.actor,
    businessName,
    customerName: customer.name,
    previousDisplay,
  });

  const emailData: ProEstimateBookingEmailData = {
    businessName,
    customerName: customer.name,
    customerEmail: customer.email || 'customer',
    customerPhone: booking.guest_phone,
    slotDisplay,
    slotStartAt: booking.slot_start_at,
    slotEndAt: booking.slot_end_at,
    serviceName: booking.service_name,
    manageUrl,
    locationAddress: formatVisitAddress({
      street: booking.visit_street,
      city: booking.visit_city,
      state: booking.visit_state,
      zip: booking.visit_zip,
    }),
    visitNote: booking.visit_note,
    bookingId: booking.id,
    calendarMethod: input.kind === 'cancelled' ? 'CANCEL' : 'PUBLISH',
    calendarSequence: nextSequence,
  };

  if (customer.email) {
    const customerResult = await sendProEstimateBookingCustomerEmail(emailData, copy);
    if (!customerResult.success) {
      logger.warn('Appointment notice customer email failed', { bookingId: booking.id, error: customerResult.error });
    }
  }

  const proEmail = business?.email?.trim() || '';
  if (proEmail && proEmail.toLowerCase() !== customer.email) {
    const proResult = await sendProEstimateBookingProEmail(emailData, proEmail, copy);
    if (!proResult.success) {
      logger.warn('Appointment notice pro email failed', { bookingId: booking.id, error: proResult.error });
    }
  }
}

async function customerContact(
  service: ServiceClient,
  booking: {
    customer_user_id: string | null;
    guest_email: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
  }
): Promise<{ email: string; name: string }> {
  const guestEmail = booking.guest_email?.trim().toLowerCase() ?? '';
  if (guestEmail) {
    return { email: guestEmail, name: joinName(booking.guest_first_name, booking.guest_last_name) };
  }
  if (!booking.customer_user_id) return { email: '', name: 'Customer' };

  const [{ data: profile }, auth] = await Promise.all([
    service.from('profiles').select('first_name, last_name').eq('id', booking.customer_user_id).maybeSingle(),
    service.auth.admin.getUserById(booking.customer_user_id),
  ]);
  return {
    email: auth.data?.user?.email?.trim().toLowerCase() ?? '',
    name: joinName(profile?.first_name, profile?.last_name),
  };
}

function joinName(first: string | null | undefined, last: string | null | undefined): string {
  const name = [first, last].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
  return name || 'Customer';
}

export function originFromRequest(request: { nextUrl: { origin: string } }): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin).replace(/\/$/, '');
}
