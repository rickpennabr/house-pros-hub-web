import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { deny, requirePortalUser } from '@/lib/places/session';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';
import { sendMaintenanceStoppedEmail } from '@/lib/services/emailService';
import { sendBusinessPushNotification } from '@/lib/services/pushNotificationService';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * POST /api/places/[id]/maintenance/[planId]/stop
 * The customer ends a repeating service. The pro is notified, and the admin
 * gets an email and a bell item. Documents and the plan history stay.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  try {
    const { error, user } = await requirePortalUser();
    if (error || !user) return deny(error);
    const { id, planId } = await params;
    const admin = createServiceRoleClient();

    const { data: place } = await admin
      .from('customer_places')
      .select('id, name, street, city, state, zip_code')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

    const { data: plan } = await admin
      .from('pro_crm_maintenance_plans')
      .select('id, name, customer_id, is_active')
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle();
    if (!plan) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    const { data: customer } = await admin
      .from('pro_crm_customers')
      .select('id, owner_id, first_name, last_name, portal_user_id, place_id')
      .eq('id', plan.customer_id)
      .maybeSingle();
    if (!customer || customer.portal_user_id !== user.id || customer.place_id !== place.id) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await admin
      .from('pro_crm_maintenance_plans')
      .update({ is_active: false, end_date: today })
      .eq('id', plan.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    const customerName = `${customer.first_name} ${customer.last_name}`.trim() || 'A customer';
    const where = [place.name, place.street, place.city, place.state, place.zip_code].filter(Boolean).join(', ');
    const { data: businesses } = await admin
      .from('businesses')
      .select('id, business_name, email, owner_id')
      .eq('owner_id', customer.owner_id)
      .eq('is_active', true)
      .limit(1);
    const business = businesses?.[0];
    const proName = business?.business_name || 'Your pro';
    const { data: ownerUser } = await admin.auth.admin.getUserById(customer.owner_id);
    const recipients = [...new Set([business?.email, ownerUser?.user?.email].filter((value): value is string => Boolean(value)))];
    const proSubject = `${customerName} stopped ${plan.name}`;
    const proBody = [
      `${customerName} stopped the repeating service "${plan.name}".`,
      `Property: ${where}.`,
      'The service is no longer active. Past visits and files stay in your records.',
    ];
    await Promise.all(recipients.map((to) => sendMaintenanceStoppedEmail(to, proSubject, proBody)));
    if (business?.id) {
      await sendBusinessPushNotification(
        business.id,
        'Maintenance stopped',
        `${customerName} stopped ${plan.name} at ${place.name}.`,
        '/en/crm/portal'
      );
    }

    const adminSubject = `Maintenance stopped: ${plan.name}`;
    const adminBody = [
      `${customerName} stopped "${plan.name}" with ${proName}.`,
      `Property: ${where}.`,
    ];
    if (ADMIN_EMAIL && ADMIN_EMAIL !== '__CLIENT_SIDE_PLACEHOLDER__') {
      await sendMaintenanceStoppedEmail(ADMIN_EMAIL, adminSubject, adminBody);
    }
    await recordAdminBellEvent({
      eventType: 'maintenance',
      entityType: 'business',
      entityId: business?.id ?? plan.id,
      displayName: customerName,
      detail: `${plan.name} · ${proName} · ${place.name}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/places/[id]/maintenance/[planId]/stop', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
