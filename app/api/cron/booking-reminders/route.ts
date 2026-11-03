import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { safeTimeZone, shouldSendDayOfReminder } from '@/lib/booking/dayOfReminder';
import { appointmentManageUrl } from '@/lib/booking/appointmentPolicy';
import { reminderEmailCopy } from '@/lib/booking/bookingEmailCopy';
import { formatVisitAddress } from '@/lib/booking/visitAddress';
import { sendProEstimateBookingCustomerEmail, sendProEstimateBookingProEmail } from '@/lib/services/emailService';
import type { ProEstimateBookingEmailData } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';

const LOOKAHEAD_MS = 36 * 60 * 60 * 1000;

/**
 * GET /api/cron/booking-reminders
 * Emails the customer and the pro on the morning of a confirmed visit.
 * Schedule hourly. Authorize with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();
  const { data: bookings, error } = await supabase
    .from('pro_estimate_bookings')
    .select(
      'id, business_id, customer_user_id, guest_email, guest_first_name, guest_last_name, guest_phone, service_name, slot_start_at, slot_end_at, status, created_at, day_of_reminder_sent_at, manage_token, customer_locale, visit_street, visit_city, visit_state, visit_zip, visit_note, ics_sequence'
    )
    .eq('status', 'confirmed')
    .is('day_of_reminder_sent_at', null)
    .gt('slot_start_at', now.toISOString())
    .lt('slot_start_at', new Date(now.getTime() + LOOKAHEAD_MS).toISOString())
    .limit(200);

  if (error) {
    logger.error('Booking reminder query failed', { endpoint: 'cron-booking-reminders' }, new Error(error.message));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = bookings ?? [];
  if (rows.length === 0) return NextResponse.json({ reminded: 0, skipped: 0 });

  const businessIds = [...new Set(rows.map((row) => row.business_id))];
  const { data: businesses, error: businessError } = await supabase
    .from('businesses')
    .select('id, business_name, email, timezone')
    .in('id', businessIds);
  if (businessError) {
    logger.error(
      'Booking reminder business query failed',
      { endpoint: 'cron-booking-reminders' },
      new Error(businessError.message)
    );
    return NextResponse.json({ error: businessError.message }, { status: 500 });
  }
  const businessById = new Map((businesses ?? []).map((business) => [business.id, business]));

  const userIds = [...new Set(rows.map((row) => row.customer_user_id).filter((id): id is string => Boolean(id)))];
  const profileById = new Map<string, { first_name: string | null; last_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds);
    for (const profile of profiles ?? []) profileById.set(profile.id, profile);
  }

  let reminded = 0;
  let skipped = 0;

  for (const booking of rows) {
    const business = businessById.get(booking.business_id);
    const timeZone = safeTimeZone(business?.timezone);
    const due = shouldSendDayOfReminder({
      now,
      slotStartAt: new Date(booking.slot_start_at),
      createdAt: new Date(booking.created_at),
      timeZone,
      status: booking.status,
      alreadySent: Boolean(booking.day_of_reminder_sent_at),
    });
    if (!due) {
      skipped += 1;
      continue;
    }

    const claimedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabase
      .from('pro_estimate_bookings')
      .update({ day_of_reminder_sent_at: claimedAt })
      .eq('id', booking.id)
      .is('day_of_reminder_sent_at', null)
      .select('id');
    if (claimError || !claimed?.length) {
      skipped += 1;
      continue;
    }

    const customer = await customerContact(supabase, booking, profileById);
    if (!customer.email) {
      logger.warn('Booking reminder skipped, no customer email', { bookingId: booking.id });
      skipped += 1;
      continue;
    }

    const slotStart = new Date(booking.slot_start_at);
    const slotDisplay = slotStart.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone,
    });
    const businessName = business?.business_name?.trim() || 'your pro';
    const emailData: ProEstimateBookingEmailData = {
      businessName,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: booking.guest_phone,
      slotDisplay,
      slotStartAt: booking.slot_start_at,
      slotEndAt: booking.slot_end_at,
      serviceName: booking.service_name,
      manageUrl: appointmentManageUrl(process.env.NEXT_PUBLIC_APP_URL ?? '', booking.customer_locale, booking.manage_token),
      locationAddress: formatVisitAddress({
        street: booking.visit_street,
        city: booking.visit_city,
        state: booking.visit_state,
        zip: booking.visit_zip,
      }),
      visitNote: booking.visit_note,
      bookingId: booking.id,
      calendarMethod: 'PUBLISH',
      calendarSequence: booking.ics_sequence ?? 0,
    };
    const translations = reminderEmailCopy(booking.customer_locale, businessName, customer.name);
    const customerResult = await sendProEstimateBookingCustomerEmail(emailData, translations);
    if (!customerResult.success) {
      await supabase.from('pro_estimate_bookings').update({ day_of_reminder_sent_at: null }).eq('id', booking.id);
      logger.warn('Booking reminder email failed', {
        bookingId: booking.id,
        customerError: customerResult.error,
      });
      skipped += 1;
      continue;
    }

    const proEmail = business?.email?.trim() || '';
    if (proEmail && proEmail.toLowerCase() !== customer.email) {
      const proResult = await sendProEstimateBookingProEmail(emailData, proEmail, translations);
      if (!proResult.success) {
        logger.warn('Booking reminder pro email failed', { bookingId: booking.id, proError: proResult.error });
      }
    }

    reminded += 1;
  }

  return NextResponse.json({ reminded, skipped });
}

async function customerContact(
  supabase: ReturnType<typeof createServiceRoleClient>,
  booking: {
    customer_user_id: string | null;
    guest_email: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
  },
  profileById: Map<string, { first_name: string | null; last_name: string | null }>
): Promise<{ email: string; name: string }> {
  const guestEmail = booking.guest_email?.trim().toLowerCase() ?? '';
  if (guestEmail) {
    return { email: guestEmail, name: joinName(booking.guest_first_name, booking.guest_last_name, 'there') };
  }
  if (!booking.customer_user_id) return { email: '', name: 'there' };

  const profile = profileById.get(booking.customer_user_id);
  const { data, error } = await supabase.auth.admin.getUserById(booking.customer_user_id);
  if (error) {
    logger.warn('Booking reminder could not load customer account', { userId: booking.customer_user_id }, error);
  }
  const email = data?.user?.email?.trim().toLowerCase() ?? '';
  return {
    email,
    name: joinName(profile?.first_name, profile?.last_name, 'there'),
  };
}

function joinName(first: string | null | undefined, last: string | null | undefined, fallback: string): string {
  const name = [first, last].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
  return name || fallback;
}
