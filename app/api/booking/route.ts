import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendProEstimateBookingEmails } from '@/lib/services/emailService';
import type { ProEstimateBookingEmailData, ProEstimateBookingEmailTranslations } from '@/lib/utils/emailTemplates';
import { COMPANY_INFO } from '@/lib/constants/company';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { loadBusinessBookingWindow } from '@/lib/booking/loadBookingWindow';
import { slotIsOpen } from '@/lib/booking/openSlots';

/**
 * POST /api/booking
 * Create a ProEstimate booking. Caller may be authenticated (customer) or guest (must send guest info).
 * Body: { businessId, slotStartAt, slotEndAt [, guestEmail, guestFirstName, guestLastName, guestPhone ] }
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'booking');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json().catch(() => ({}));
    const businessId = body.businessId;
    const slotStartAt = body.slotStartAt;
    const slotEndAt = body.slotEndAt;
    const guestEmail = typeof body.guestEmail === 'string' ? body.guestEmail.trim().toLowerCase() : '';
    const guestFirstName = typeof body.guestFirstName === 'string' ? body.guestFirstName.trim() : '';
    const guestLastName = typeof body.guestLastName === 'string' ? body.guestLastName.trim() : '';
    const guestPhone = typeof body.guestPhone === 'string' ? body.guestPhone.trim() : '';
    const requestedServiceId = typeof body.serviceId === 'string' ? body.serviceId.trim() : '';

    if (!businessId || !slotStartAt || !slotEndAt) {
      return NextResponse.json({ error: 'businessId, slotStartAt, and slotEndAt are required' }, { status: 400 });
    }

    const start = new Date(slotStartAt);
    const end = new Date(slotEndAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Invalid appointment time' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let customerUserId: string | null = null;
    let customerEmail: string;
    let customerName: string;

    if (user?.id) {
      customerUserId = user.id;
      customerEmail = (user.email ?? '').trim().toLowerCase();
      const meta = user.user_metadata ?? {};
      const first = (meta.first_name ?? meta.firstName ?? '').trim();
      const last = (meta.last_name ?? meta.lastName ?? '').trim();
      customerName = [first, last].filter(Boolean).join(' ').trim() || 'Customer';
      if (!customerEmail) {
        return NextResponse.json({ error: 'Signed-in user must have an email' }, { status: 400 });
      }
    } else {
      if (!guestEmail || !guestFirstName || !guestLastName) {
        return NextResponse.json({ error: 'Guest booking requires guestEmail, guestFirstName, and guestLastName' }, { status: 400 });
      }
      customerEmail = guestEmail;
      customerName = [guestFirstName, guestLastName].filter(Boolean).join(' ').trim() || 'Guest';
    }

    const service = createServiceRoleClient();
    const business = await loadBusinessBookingWindow(service, businessId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    if (!business.bookingEnabled) {
      return NextResponse.json({ error: 'This pro is not accepting appointments' }, { status: 403 });
    }

    const proEmail = business.email?.trim() || null;
    if (!proEmail) {
      return NextResponse.json({ error: 'Business has no contact email for notifications' }, { status: 400 });
    }

    const open = await slotIsOpen(service, businessId, start, end);
    if (open === 'invalid') {
      return NextResponse.json({ error: 'That time is outside this pro’s hours' }, { status: 400 });
    }
    if (open !== 'ok') {
      return NextResponse.json({ error: 'This time was just booked. Please choose another.' }, { status: 409 });
    }

    let serviceId: string | null = null;
    let serviceName: string | null = null;
    if (requestedServiceId) {
      const { data: catalogService, error: serviceError } = await service
        .from('pro_booking_services')
        .select('id, name, is_active, business_id')
        .eq('id', requestedServiceId)
        .maybeSingle();
      if (serviceError || !catalogService || catalogService.business_id !== businessId || !catalogService.is_active) {
        return NextResponse.json({ error: 'That service is not available' }, { status: 400 });
      }
      serviceId = catalogService.id;
      serviceName = catalogService.name;
    }

    const { data: booking, error: insertError } = await service
      .from('pro_estimate_bookings')
      .insert({
        business_id: businessId,
        customer_user_id: customerUserId,
        guest_email: user ? null : guestEmail,
        guest_first_name: user ? null : guestFirstName,
        guest_last_name: user ? null : guestLastName,
        guest_phone: guestPhone || null,
        service_id: serviceId,
        service_name: serviceName,
        slot_start_at: start.toISOString(),
        slot_end_at: end.toISOString(),
        status: 'confirmed',
      })
      .select('id, slot_start_at, slot_end_at, status, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Failed to create booking' }, { status: 500 });
    }

    const slotDisplay = start.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: business.timezone,
    });

    const emailData: ProEstimateBookingEmailData = {
      businessName: business.businessName || 'Pro',
      customerName,
      customerEmail,
      customerPhone: guestPhone || null,
      slotDisplay,
      slotStartAt: start.toISOString(),
      slotEndAt: end.toISOString(),
      serviceName,
    };

    const translations: ProEstimateBookingEmailTranslations = {
      subjectCustomer: 'Your ProEstimate appointment is confirmed',
      subjectPro: 'New ProEstimate booking',
      greetingCustomer: 'Your estimate appointment is confirmed.',
      greetingPro: 'You have a new ProEstimate booking.',
      bodyCustomer: `You're scheduled with ${business.businessName || 'your pro'}. We'll send a reminder before the appointment.`,
      bodyPro: 'A customer has booked an estimate slot. Details below.',
      detailsLabel: 'Appointment details',
      dateTimeLabel: 'Date & time',
      withLabel: 'With',
      serviceLabel: 'Service',
      footer: {
        companyName: COMPANY_INFO.name,
        contactInfo: COMPANY_INFO.email?.contact ?? '',
      },
    };

    const emailResult = await sendProEstimateBookingEmails(emailData, proEmail, translations);
    if (emailResult.errors.length > 0) {
      console.warn('ProEstimate booking emails had errors:', emailResult.errors);
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (err) {
    console.error('POST /api/booking', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
