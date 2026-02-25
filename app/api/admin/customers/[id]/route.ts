import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { deleteProfilePicture } from '@/lib/utils/storage';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

/**
 * GET /api/admin/customers/[id]
 * Get one customer with profile and address for edit form. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { data: address } = await service
      .from('addresses')
      .select('street_address, apartment, city, state, zip_code')
      .eq('user_id', userId)
      .eq('address_type', 'personal')
      .maybeSingle();

    let email: string | null = null;
    try {
      const { data } = await service.auth.admin.getUserById(userId);
      if (data?.user?.email) email = data.user.email;
    } catch {
      // ignore
    }

    return NextResponse.json({
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email,
      phone: profile.phone,
      referral: profile.referral,
      userPicture: profile.user_picture ?? '',
      streetAddress: address?.street_address ?? profile.street_address ?? '',
      apartment: address?.apartment ?? profile.apartment ?? '',
      city: address?.city ?? profile.city ?? '',
      state: address?.state ?? profile.state ?? '',
      zipCode: address?.zip_code ?? profile.zip_code ?? '',
    });
  } catch (error) {
    console.error('GET /api/admin/customers/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/customers/[id]
 * Update a customer's profile and address. Admin only.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    const body = await request.json();
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    const firstName = trim(body.firstName);
    const lastName = trim(body.lastName);
    const phone = trim(body.phone);
    const referral = trim(body.referral);
    const userPicture = trim(body.userPicture);
    const streetAddress = trim(body.streetAddress);
    const apartment = trim(body.apartment);
    const city = trim(body.city);
    const state = trim(body.state);
    const zipCode = trim(body.zipCode);

    const service = createServiceRoleClient();

    const profileUpdate: Record<string, unknown> = {};
    if (firstName !== undefined) profileUpdate.first_name = firstName || null;
    if (lastName !== undefined) profileUpdate.last_name = lastName || null;
    if (phone !== undefined) profileUpdate.phone = phone || null;
    if (referral !== undefined) profileUpdate.referral = referral || null;
    if (body.userPicture !== undefined) profileUpdate.user_picture = userPicture || null;

    const { error: profileError } = await service
      .from('profiles')
      .update(profileUpdate)
      .eq('id', userId);

    if (profileError) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const hasAddress = !!(streetAddress || city || state || zipCode);
    const { data: existing } = await service
      .from('addresses')
      .select('id')
      .eq('user_id', userId)
      .eq('address_type', 'personal')
      .maybeSingle();

    if (existing) {
      await service
        .from('addresses')
        .update({
          street_address: streetAddress || null,
          apartment: apartment || null,
          city: city || null,
          state: state || null,
          zip_code: zipCode || null,
        })
        .eq('id', existing.id);
    } else if (hasAddress) {
      await service.from('addresses').insert({
        user_id: userId,
        address_type: 'personal',
        street_address: streetAddress || null,
        apartment: apartment || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        is_public: false,
        is_verified: false,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/customers/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/customers/[id]
 * Delete a customer (deactivate roles, then delete auth user). Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    }

    const service = createServiceRoleClient();

    // Fetch profile for storage cleanup and for deletion notification (before user is deleted)
    const { data: profile } = await service
      .from('profiles')
      .select('user_picture, first_name, last_name')
      .eq('id', userId)
      .single();
    if (profile?.user_picture?.trim()) {
      await deleteProfilePicture(profile.user_picture.trim());
    }
    const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Customer';

    const { error: rolesError } = await service
      .from('user_roles')
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (rolesError) {
      return NextResponse.json({ error: 'Failed to deactivate roles' }, { status: 500 });
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(userId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || 'Failed to delete user' }, { status: 400 });
    }

    // Log deletion event for admin notifications (so deletion appears in notification list)
    await service
      .from('admin_notification_events')
      .insert({
        event_type: 'deletion',
        entity_type: 'customer',
        entity_id: userId,
        display_name: displayName,
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/customers/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
