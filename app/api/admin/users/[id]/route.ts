import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { deleteProfilePicture } from '@/lib/utils/storage';
import { invalidateBusinessDirectoryCache } from '@/lib/data/businessDirectory';
import { sanitizeText } from '@/lib/utils/sanitize';

const EDITABLE_ROLES = ['customer', 'contractor', 'realtor', 'installer', 'handyman'] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];

function isEditableRole(value: string): value is EditableRole {
  return (EDITABLE_ROLES as readonly string[]).includes(value);
}

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
 * GET /api/admin/users/[id]
 * Load one account for the admin edit form.
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
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('id, first_name, last_name, phone, business_id, user_picture, referral, referral_other')
      .eq('id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: roleRows } = await service
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', userId);

    let email: string | null = null;
    try {
      const { data } = await service.auth.admin.getUserById(userId);
      email = data?.user?.email ?? null;
    } catch {
      // Profile still loads without email.
    }

    const isAdmin =
      !!email && email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    if (isAdmin) {
      return NextResponse.json({ error: 'The admin account cannot be edited here' }, { status: 400 });
    }

    let businessName: string | null = null;
    if (profile.business_id) {
      const { data: business } = await service
        .from('businesses')
        .select('business_name')
        .eq('id', profile.business_id)
        .maybeSingle();
      businessName = business?.business_name ?? null;
    }

    const activeRoles = (roleRows || [])
      .filter((row) => row.is_active)
      .map((row) => row.role);
    const primaryRole =
      activeRoles.find((role) => role !== 'customer') ||
      activeRoles[0] ||
      (roleRows || [])[0]?.role ||
      'customer';

    return NextResponse.json({
      id: profile.id,
      firstName: profile.first_name ?? '',
      lastName: profile.last_name ?? '',
      email: email ?? '',
      phone: profile.phone ?? '',
      businessId: profile.business_id,
      businessName: businessName ?? '',
      role: primaryRole,
      roles: activeRoles,
      isActive: activeRoles.length > 0,
      userPicture: profile.user_picture ?? '',
      referral: profile.referral ?? '',
      referralOther: profile.referral_other ?? '',
    });
  } catch (error) {
    console.error('GET /api/admin/users/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update a non-admin account: name, email, phone, role, active, and business name.
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
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

    const firstName = sanitizeText(trim(body.firstName)) || null;
    const lastName = sanitizeText(trim(body.lastName)) || null;
    const phone = sanitizeText(trim(body.phone)) || null;
    const email = trim(body.email).toLowerCase();
    const businessNameRaw = trim(body.businessName);
    const businessName = businessNameRaw ? sanitizeText(businessNameRaw) || businessNameRaw : '';
    const roleRaw = trim(body.role);
    const isActive = body.isActive !== false;

    if (!isEditableRole(roleRaw)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const { data: authUser, error: authLookupError } = await service.auth.admin.getUserById(userId);
    if (authLookupError || !authUser?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentEmail = authUser.user.email?.toLowerCase().trim() ?? '';
    if (currentEmail && currentEmail === ADMIN_EMAIL.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Cannot edit the admin account' }, { status: 400 });
    }

    const { data: profile, error: profileLookupError } = await service
      .from('profiles')
      .select('id, business_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileLookupError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (email && email !== currentEmail) {
      const { error: emailError } = await service.auth.admin.updateUserById(userId, {
        email,
        user_metadata: {
          ...(authUser.user.user_metadata || {}),
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email,
        },
      });
      if (emailError) {
        return NextResponse.json(
          { error: emailError.message || 'Failed to update email' },
          { status: 400 }
        );
      }
    } else {
      await service.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...(authUser.user.user_metadata || {}),
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
      });
    }

    const { error: profileError } = await service
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
      })
      .eq('id', userId);
    if (profileError) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    if (profile.business_id && businessName) {
      const { error: businessError } = await service
        .from('businesses')
        .update({ business_name: businessName })
        .eq('id', profile.business_id);
      if (businessError) {
        return NextResponse.json(
          { error: businessError.message || 'Failed to update business name' },
          { status: 400 }
        );
      }
      invalidateBusinessDirectoryCache();
    }

    const { data: existingRoles, error: rolesLookupError } = await service
      .from('user_roles')
      .select('id, role, is_active')
      .eq('user_id', userId);
    if (rolesLookupError) {
      return NextResponse.json({ error: 'Failed to load roles' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const rows = existingRoles || [];
    const selected = rows.find((row) => row.role === roleRaw);

    if (selected) {
      const { error: activateError } = await service
        .from('user_roles')
        .update({
          is_active: isActive,
          activated_at: isActive ? now : undefined,
          deactivated_at: isActive ? null : now,
        })
        .eq('id', selected.id);
      if (activateError) {
        console.error('PUT /api/admin/users/[id] update role', activateError);
        return NextResponse.json(
          { error: activateError.message || 'Failed to update role' },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await service.from('user_roles').insert({
        user_id: userId,
        role: roleRaw,
        is_active: isActive,
        activated_at: isActive ? now : null,
        deactivated_at: isActive ? null : now,
      });
      if (insertError) {
        console.error('PUT /api/admin/users/[id] set role', insertError);
        return NextResponse.json(
          { error: insertError.message || 'Failed to set role' },
          { status: 500 }
        );
      }
    }

    const otherIds = rows.filter((row) => row.role !== roleRaw).map((row) => row.id);
    if (otherIds.length > 0) {
      const { error: deactivateError } = await service
        .from('user_roles')
        .update({ is_active: false, deactivated_at: now })
        .in('id', otherIds);
      if (deactivateError) {
        console.error('PUT /api/admin/users/[id] clear other roles', deactivateError);
        return NextResponse.json(
          { error: deactivateError.message || 'Failed to clear other roles' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/admin/users/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Permanently remove an account and the businesses it owns. The admin login cannot be deleted.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireAdmin();
    if (authError) return authError;

    const { id: userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }
    if (userId === user?.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const { data: authUser, error: authLookupError } = await service.auth.admin.getUserById(userId);
    if (authLookupError || !authUser?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const email = authUser.user.email?.toLowerCase().trim() ?? '';
    if (email && email === ADMIN_EMAIL.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Cannot delete the admin account' }, { status: 400 });
    }

    const { data: profile } = await service
      .from('profiles')
      .select('user_picture, first_name, last_name')
      .eq('id', userId)
      .maybeSingle();

    const { data: roleRows } = await service
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const { error: unlinkError } = await service
      .from('profiles')
      .update({ business_id: null })
      .eq('id', userId);
    if (unlinkError) {
      return NextResponse.json({ error: 'Failed to unlink business' }, { status: 500 });
    }

    const { data: ownedBusinesses, error: ownedError } = await service
      .from('businesses')
      .select('id')
      .eq('owner_id', userId);
    if (ownedError) {
      return NextResponse.json({ error: 'Failed to look up businesses' }, { status: 500 });
    }
    if (ownedBusinesses && ownedBusinesses.length > 0) {
      const { error: businessDeleteError } = await service
        .from('businesses')
        .delete()
        .eq('owner_id', userId);
      if (businessDeleteError) {
        return NextResponse.json(
          { error: businessDeleteError.message || 'Failed to delete the user business' },
          { status: 400 }
        );
      }
      invalidateBusinessDirectoryCache();
    }

    if (profile?.user_picture?.trim()) {
      await deleteProfilePicture(profile.user_picture.trim());
    }

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

    const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || email || 'User';
    const entityType = (roleRows || []).some((row) => row.role === 'contractor') ? 'contractor' : 'customer';
    await service.from('admin_notification_events').insert({
      event_type: 'deletion',
      entity_type: entityType,
      entity_id: userId,
      display_name: displayName,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/users/[id]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
