import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { deleteProfilePicture } from '@/lib/utils/storage';
import { invalidateBusinessDirectoryCache } from '@/lib/data/businessDirectory';

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
