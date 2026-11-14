import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { canChangeAppointment, isManageToken } from '@/lib/booking/appointmentPolicy';
import { safeTimeZone } from '@/lib/booking/dayOfReminder';
import { formatVisitAddress } from '@/lib/booking/visitAddress';

type ServiceClient = SupabaseClient<Database>;

export interface AppointmentCard {
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  serviceName: string | null;
  visitAddress: string | null;
  visitNote: string | null;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  timezone: string;
  canChange: boolean;
}

export interface ManagedAppointment extends AppointmentCard {
  id: string;
  businessId: string;
  /** Locale used on the customer's manage link. */
  customerLocale: string;
  /** Matches the confirmation email so a new download replaces the same event. */
  icsSequence: number;
}

export async function loadManageBooking(service: ServiceClient, token: string): Promise<ManagedAppointment | null> {
  if (!isManageToken(token)) return null;
  const { data: booking, error } = await service
    .from('pro_estimate_bookings')
    .select(
      'id, business_id, service_name, slot_start_at, slot_end_at, status, visit_street, visit_city, visit_state, visit_zip, visit_note, customer_locale, ics_sequence'
    )
    .eq('manage_token', token)
    .maybeSingle();
  if (error || !booking) return null;

  const { data: business } = await service
    .from('businesses')
    .select('business_name, email, phone, timezone')
    .eq('id', booking.business_id)
    .maybeSingle();

  const timezone = safeTimeZone(business?.timezone);
  return {
    id: booking.id,
    businessId: booking.business_id,
    customerLocale: booking.customer_locale,
    icsSequence: booking.ics_sequence ?? 0,
    businessName: business?.business_name?.trim() || 'Pro',
    businessEmail: business?.email?.trim() || null,
    businessPhone: business?.phone?.trim() || null,
    serviceName: booking.service_name,
    visitAddress: formatVisitAddress({
      street: booking.visit_street,
      city: booking.visit_city,
      state: booking.visit_state,
      zip: booking.visit_zip,
    }) || null,
    visitNote: booking.visit_note,
    startAt: booking.slot_start_at,
    endAt: booking.slot_end_at,
    status: booking.status,
    timezone,
    canChange: canChangeAppointment(new Date(booking.slot_start_at), new Date(), booking.status),
  };
}

export function appointmentCard(booking: ManagedAppointment): AppointmentCard {
  return {
    businessName: booking.businessName,
    businessEmail: booking.businessEmail,
    businessPhone: booking.businessPhone,
    serviceName: booking.serviceName,
    visitAddress: booking.visitAddress,
    visitNote: booking.visitNote,
    startAt: booking.startAt,
    endAt: booking.endAt,
    status: booking.status,
    timezone: booking.timezone,
    canChange: booking.canChange,
  };
}
