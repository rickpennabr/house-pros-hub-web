import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';
import type { Json } from '@/lib/types/supabase';
import {
  BUSINESS_TIMEZONES,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_TIMEZONE,
  isSlotMinutes,
  parseWeekSchedule,
  scheduleIsValid,
  type WeekSchedule,
} from '@/lib/booking/businessHours';

function missingSlotColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('appointment_slot_minutes');
}

function readSchedule(raw: unknown): WeekSchedule | null {
  const parsed = parseWeekSchedule(raw);
  if (!parsed.configured || !scheduleIsValid(parsed.schedule)) return null;
  return parsed.schedule;
}

/**
 * GET /api/crm/hours
 * Weekly hours, timezone, slot length, and the public booking switch for the pro's businesses.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requirePro();
    if (authError || !user) return authError!;

    const baseColumns = 'id, slug, business_name, operating_hours, timezone, show_calendar_on_procard';
    const fullColumns = `${baseColumns}, appointment_slot_minutes`;
    const first = await supabase
      .from('businesses')
      .select(fullColumns)
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    const result = missingSlotColumn(first.error)
      ? await supabase
          .from('businesses')
          .select(baseColumns)
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
      : first;
    if (result.error) {
      return NextResponse.json({ error: result.error.message || 'Failed to load hours' }, { status: 500 });
    }

    const businesses = (result.data ?? []).map((row) => {
      const parsed = parseWeekSchedule(row.operating_hours);
      const slot = Number((row as { appointment_slot_minutes?: number }).appointment_slot_minutes);
      return {
        id: row.id,
        slug: row.slug || row.id,
        businessName: row.business_name,
        timezone: row.timezone || DEFAULT_TIMEZONE,
        slotMinutes: isSlotMinutes(slot) ? slot : DEFAULT_SLOT_MINUTES,
        bookingEnabled: row.show_calendar_on_procard === true,
        schedule: parsed.schedule,
        hoursConfigured: parsed.configured,
      };
    });
    return NextResponse.json({ businesses });
  } catch (err) {
    console.error('GET /api/crm/hours', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/crm/hours
 * Save weekly hours and whether customers can book an appointment.
 */
export async function PUT(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requirePro();
    if (authError || !user) return authError!;

    const body = await request.json().catch(() => ({}));
    const businessId = typeof body.businessId === 'string' ? body.businessId : '';
    const timezone = typeof body.timezone === 'string' ? body.timezone : '';
    const slotMinutes = Number(body.slotMinutes);
    const bookingEnabled = body.bookingEnabled === true;
    const schedule = readSchedule(body.schedule);

    if (!businessId || !schedule) {
      return NextResponse.json({ error: 'A valid weekly schedule is required' }, { status: 400 });
    }
    if (!(BUSINESS_TIMEZONES as readonly string[]).includes(timezone)) {
      return NextResponse.json({ error: 'Choose a timezone' }, { status: 400 });
    }
    if (!isSlotMinutes(slotMinutes)) {
      return NextResponse.json({ error: 'Choose an appointment length' }, { status: 400 });
    }

    const { data: owned } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!owned) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const service = createServiceRoleClient();
    const update = {
      operating_hours: schedule as unknown as Json,
      timezone,
      show_calendar_on_procard: bookingEnabled,
      appointment_slot_minutes: slotMinutes,
    };
    let { error } = await service.from('businesses').update(update).eq('id', businessId);
    let slotColumnMissing = false;
    if (missingSlotColumn(error)) {
      slotColumnMissing = true;
      const fallback = await service
        .from('businesses')
        .update({
          operating_hours: schedule as unknown as Json,
          timezone,
          show_calendar_on_procard: bookingEnabled,
        })
        .eq('id', businessId);
      error = fallback.error;
    }
    if (error) return NextResponse.json({ error: error.message || 'Failed to save hours' }, { status: 500 });
    return NextResponse.json({
      ok: true,
      warning: slotColumnMissing
        ? 'Hours saved. Apply migration 093_business_hours_booking.sql to store appointment length.'
        : undefined,
    });
  } catch (err) {
    console.error('PUT /api/crm/hours', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
