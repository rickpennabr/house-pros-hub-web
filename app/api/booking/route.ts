import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendProEstimateBookingEmails } from '@/lib/services/emailService';
import type { ProEstimateBookingEmailData, ProEstimateBookingEmailTranslations } from '@/lib/utils/emailTemplates';
import { COMPANY_INFO } from '@/lib/constants/company';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

const SLOT_DURATION_MS = 90 * 60 * 1000; // 1.5 hours

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
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() - start.getTime() !== SLOT_DURATION_MS) {
      return NextResponse.json({ error: 'Invalid slot; must be a 1.5-hour period' }, { status: 400 });
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
    const { data: business, error: bizError } = await service
      .from('businesses')
      .select('id, owner_id, business_name, email')
      .eq('id', businessId)
      .eq('is_active', true)
      .single();

    if (bizError || !business?.owner_id) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const proEmail = (business.email && String(business.email).trim()) || null;
    if (!proEmail) {
      return NextResponse.json({ error: 'Business has no contact email for notifications' }, { status: 400 });
    }

    // Match CRM: "all available by default; mark OFF when not free." If pro has no "available" blocks, allow unless slot is in "unavailable" or booked.
    const { data: availabilityBlocks } = await service
      .from('pro_crm_availability')
      .select('id, start_at, end_at')
      .eq('owner_id', business.owner_id)
      .eq('type', 'available')
      .lte('start_at', end.toISOString())
      .gte('end_at', start.toISOString());

    const hasExplicitAvailable = (availabilityBlocks?.length ?? 0) > 0;
    if (hasExplicitAvailable) {
      const slotFitsInBlock = availabilityBlocks!.some(
        (b) => new Date(b.start_at).getTime() <= start.getTime() && new Date(b.end_at).getTime() >= end.getTime()
      );
      if (!slotFitsInBlock) {
        return NextResponse.json({ error: 'Selected time is not available' }, { status: 400 });
      }
    } else {
      const { data: unavailableBlocks } = await service
        .from('pro_crm_availability')
        .select('start_at, end_at')
        .eq('owner_id', business.owner_id)
        .eq('type', 'unavailable')
        .lt('start_at', end.toISOString())
        .gt('end_at', start.toISOString());
      const overlapsUnavailable = unavailableBlocks?.some(
        (b) => new Date(b.start_at).getTime() < end.getTime() && new Date(b.end_at).getTime() > start.getTime()
      );
      if (overlapsUnavailable) {
        return NextResponse.json({ error: 'Selected time is not available' }, { status: 400 });
      }
    }

    const { data: existing } = await service
      .from('pro_estimate_bookings')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'confirmed')
      .lt('slot_start_at', end.toISOString())
      .gt('slot_end_at', start.toISOString());

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'This slot was just booked. Please choose another time.' }, { status: 409 });
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

    const slotDisplay = start.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const emailData: ProEstimateBookingEmailData = {
      businessName: business.business_name ?? 'Pro',
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
      bodyCustomer: `You're scheduled with ${business.business_name ?? 'your pro'}. We'll send a reminder before the appointment.`,
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
