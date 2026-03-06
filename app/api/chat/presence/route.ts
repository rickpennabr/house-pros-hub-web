import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import {
  presenceHeartbeatSchema,
  commaSeparatedUuidsSchema,
  presenceVisitorIdParamSchema,
} from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * POST /api/chat/presence
 * Heartbeat: update last_seen for visitor, admin, business, or any signed-in user.
 * Body: { type: 'visitor', visitorId } | { type: 'admin' } | { type: 'business', businessId } | { type: 'user' } | { type: 'offline' }.
 * type 'user': any authenticated user (shows online when on platform). type 'admin' requires ADMIN_EMAIL.
 * type 'offline': clear presence for current user and their businesses (call on logout so they show offline immediately).
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'presence');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = presenceHeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.type?.[0]
        ?? parsed.error.flatten().fieldErrors?.visitorId?.[0]
        ?? 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { type, visitorId, businessId } = parsed.data;
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    if (type === 'offline') {
      const supabaseAuth = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser();
      if (userError || !user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const keysToDelete: string[] = [`u:${user.id}`];
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();
      const profileBusinessId = (profile as { business_id?: string } | null)?.business_id;
      if (profileBusinessId) keysToDelete.push(`b:${profileBusinessId}`);
      const { data: bizRows } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .eq('is_active', true);
      (bizRows ?? []).forEach((r) => {
        const id = (r as { id: string }).id;
        if (id && !keysToDelete.includes(`b:${id}`)) keysToDelete.push(`b:${id}`);
      });
      if (keysToDelete.length > 0) {
        await supabase.from('chat_presence').delete().in('key', keysToDelete);
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (type === 'visitor') {
      if (!visitorId) {
        return NextResponse.json({ error: 'visitorId required for visitor' }, { status: 400 });
      }
      const key = `v:${visitorId}`;
      const { error } = await supabase
        .from('chat_presence')
        .upsert(
          { key, visitor_id: visitorId, user_id: null, business_id: null, last_seen_at: now, updated_at: now },
          { onConflict: 'key', ignoreDuplicates: false }
        );
      if (error) {
        return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (type === 'user') {
      const supabaseAuth = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser();
      if (userError || !user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const key = `u:${user.id}`;
      const { error } = await supabase
        .from('chat_presence')
        .upsert(
          { key, visitor_id: null, user_id: user.id, business_id: null, last_seen_at: now, updated_at: now },
          { onConflict: 'key', ignoreDuplicates: false }
        );
      if (error) {
        return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (type === 'business') {
      if (!businessId) {
        return NextResponse.json({ error: 'businessId required for business' }, { status: 400 });
      }
      const supabaseAuth = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser();
      if (userError || !user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const { data: business } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single();
      if (!business || (business as { owner_id: string }).owner_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const key = `b:${businessId}`;
      const { error } = await supabase
        .from('chat_presence')
        .upsert(
          { key, visitor_id: null, user_id: null, business_id: businessId, last_seen_at: now, updated_at: now },
          { onConflict: 'key', ignoreDuplicates: false }
        );
      if (error) {
        return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // type === 'admin'
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();
    if (userError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const key = `u:${user.id}`;
    const { error } = await supabase
      .from('chat_presence')
      .upsert(
        { key, visitor_id: null, user_id: user.id, business_id: null, last_seen_at: now, updated_at: now },
        { onConflict: 'key', ignoreDuplicates: false }
      );
    if (error) {
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('POST /api/chat/presence error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/chat/presence?for=hub | ?visitorId=... | ?businessIds=... | ?userIds=uuid1,uuid2
 * - for=hub: returns { online: boolean }. No auth.
 * - visitorId=...: returns { online: boolean } for that visitor. Admin only.
 * - businessIds=...: returns { onlineByBusiness: Record<string, boolean> } for contractors. No auth.
 * - userIds=...: returns { onlineByUser: Record<string, boolean> } for signed-in users. Auth required (admin and contractors use for customer contacts).
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'presence');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { searchParams } = new URL(request.url);
    const forHub = searchParams.get('for') === 'hub';
    const visitorId = searchParams.get('visitorId') ?? undefined;
    const businessIdsParam = searchParams.get('businessIds') ?? undefined;
    const userIdsParam = searchParams.get('userIds') ?? undefined;

    const supabase = createServiceRoleClient();
    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS).toISOString();

    if (userIdsParam !== undefined && userIdsParam !== null) {
      const parsed = commaSeparatedUuidsSchema.safeParse(userIdsParam);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid userIds' }, { status: 400 });
      }
      const ids = parsed.data;
      const supabaseAuth = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser();
      if (userError || !user?.id) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      if (ids.length === 0) {
        return NextResponse.json({ onlineByUser: {} }, { status: 200 });
      }
      const { data: rows } = await supabase
        .from('chat_presence')
        .select('user_id, last_seen_at')
        .not('user_id', 'is', null)
        .in('user_id', ids)
        .gte('last_seen_at', threshold);
      const onlineSet = new Set<string>();
      (rows ?? []).forEach((r) => {
        const uid = (r as { user_id: string }).user_id;
        if (uid) onlineSet.add(uid);
      });
      const onlineByUser: Record<string, boolean> = {};
      ids.forEach((id) => { onlineByUser[id] = onlineSet.has(id); });
      return NextResponse.json({ onlineByUser }, { status: 200 });
    }

    if (businessIdsParam !== undefined && businessIdsParam !== null) {
      const parsed = commaSeparatedUuidsSchema.safeParse(businessIdsParam);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid businessIds' }, { status: 400 });
      }
      const ids = parsed.data;
      if (ids.length === 0) {
        return NextResponse.json({ onlineByBusiness: {} }, { status: 200 });
      }
      const { data: rows } = await supabase
        .from('chat_presence')
        .select('business_id, last_seen_at')
        .not('business_id', 'is', null)
        .in('business_id', ids)
        .gte('last_seen_at', threshold);
      const onlineSet = new Set<string>();
      (rows ?? []).forEach((r) => {
        const bid = (r as { business_id: string }).business_id;
        if (bid) onlineSet.add(bid);
      });
      const onlineByBusiness: Record<string, boolean> = {};
      ids.forEach((id) => { onlineByBusiness[id] = onlineSet.has(id); });
      return NextResponse.json({ onlineByBusiness }, { status: 200 });
    }

    if (forHub) {
      const { data: adminRows } = await supabase
        .from('admin_users')
        .select('user_id');
      const adminUserIds = (adminRows ?? []).map((r) => (r as { user_id: string }).user_id);
      if (adminUserIds.length === 0) {
        return NextResponse.json({ online: false }, { status: 200 });
      }
      const { data: presenceRows } = await supabase
        .from('chat_presence')
        .select('user_id, last_seen_at')
        .in('user_id', adminUserIds)
        .gte('last_seen_at', threshold);
      const online = (presenceRows ?? []).length > 0;
      return NextResponse.json({ online }, { status: 200 });
    }

    if (visitorId !== undefined && visitorId !== null) {
      const visitorIdParsed = presenceVisitorIdParamSchema.safeParse(visitorId);
      if (!visitorIdParsed.success) {
        return NextResponse.json({ error: 'Invalid visitorId' }, { status: 400 });
      }
      const visitorIdValid = visitorIdParsed.data;
      const supabaseAuth = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser();
      if (userError || !user?.email) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      const isAdmin =
        user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { data: row } = await supabase
        .from('chat_presence')
        .select('last_seen_at')
        .eq('visitor_id', visitorIdValid)
        .single();
      const lastSeen = row ? (row as { last_seen_at: string }).last_seen_at : null;
      const online = lastSeen ? new Date(lastSeen).getTime() > Date.now() - ONLINE_THRESHOLD_MS : false;
      return NextResponse.json({ online }, { status: 200 });
    }

    return NextResponse.json({ error: 'Missing for=hub, visitorId, businessIds, or userIds' }, { status: 400 });
  } catch (e) {
    console.error('GET /api/chat/presence error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
