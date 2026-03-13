import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/chat/contacts
 * Returns ProBot contacts for the current user by role:
 * - Admin: ProBot + all businesses (contractors) + one contact per signed-up customer (deduped by user_id)
 * - Contractor (user has businessId): ProBot + customers/visitors who chatted with them, then all hub contractors (other businesses), in that order
 * - Customer / visitor: ProBot + all businesses
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdmin =
      !!user.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    // Get user's business (contractor)
    let userBusinessId: string | null = null;
    if (!isAdmin) {
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();
      userBusinessId = (profile as { business_id?: string } | null)?.business_id ?? null;
    }

    const supabase = createServiceRoleClient();

    // ProBot contact (always first)
    const contacts: Array<{
      id: string;
      name: string;
      isProBot: boolean;
      businessId?: string;
      slug?: string;
      logo?: string;
      online?: boolean;
      conversationId?: string;
      visitorId?: string;
      profile_user_picture?: string | null;
    }> = [
      {
        id: 'probot',
        name: 'ProBot',
        isProBot: true,
      },
    ];

    if (isAdmin) {
      // Ensure current admin is in admin_users so they're excluded from contacts (only ProBot represents admins)
      await supabase.from('admin_users').upsert({ user_id: user.id }, { onConflict: 'user_id' });
      // Admin: all businesses + all unique customers from conversations (exclude all admins so they show only as ProBot in History)
      const { data: adminUsers } = await supabase.from('admin_users').select('user_id');
      const adminUserIdsSet = new Set<string>(((adminUsers ?? []) as { user_id: string }[]).map((r) => r.user_id));

      const [businessesRes, convRes] = await Promise.all([
        supabase
          .from('businesses')
          .select('id, business_name, slug, business_logo')
          .eq('is_active', true)
          .order('business_name')
          .limit(500),
        supabase
          .from('probot_conversations')
          .select('id, visitor_id, visitor_display_name, user_id, updated_at')
          .order('updated_at', { ascending: false })
          .limit(500),
      ]);

      const businesses = (businessesRes.data ?? []) as Array<{
        id: string;
        business_name: string | null;
        slug: string | null;
        business_logo: string | null;
      }>;
      for (const b of businesses) {
        contacts.push({
          id: b.id,
          name: b.business_name ?? b.id,
          isProBot: false,
          businessId: b.id,
          slug: b.slug ?? undefined,
          logo: b.business_logo ?? undefined,
          online: false,
        });
      }

      const convList = (convRes.data ?? []) as Array<{
        id: string;
        visitor_id: string;
        visitor_display_name?: string | null;
        user_id?: string | null;
        updated_at: string;
      }>;
      const userIds = [...new Set(convList.map((c) => c.user_id).filter(Boolean))] as string[];
      let profileByUserId: Record<string, { first_name?: string | null; last_name?: string | null; user_picture?: string | null; business_id?: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, user_picture, business_id')
          .in('id', userIds);
        for (const p of profiles ?? []) {
          const row = p as { id: string; first_name?: string | null; last_name?: string | null; user_picture?: string | null; business_id?: string | null };
          profileByUserId[row.id] = row;
        }
      }
      // One contact per user (dedupe by user_id); convList is ordered by updated_at desc so first = most recent.
      // Exclude current user (admin) and contractor profiles: show only customers and businesses; never show contractor personal.
      const seenUserIds = new Set<string>();
      for (const c of convList) {
        if (!c.user_id) continue; // Only signed-up customers (have an account), not anonymous visitors
        if (c.user_id === user.id) continue; // Don't show current admin as a separate contact
        if (adminUserIdsSet.has(c.user_id)) continue; // Don't show other admins as contacts; they appear as ProBot in History only
        const profile = profileByUserId[c.user_id];
        if (profile?.business_id) continue; // Contractor: already represented by their business in the list; never show personal
        if (seenUserIds.has(c.user_id)) continue;
        seenUserIds.add(c.user_id);
        const profileName =
          profile?.first_name || profile?.last_name
            ? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
            : undefined;
        const name =
          profileName ||
          (c.visitor_display_name?.trim() || undefined) ||
          `Customer ${c.visitor_id.slice(0, 8)}`;
        contacts.push({
          id: `customer-${c.user_id}`,
          name,
          isProBot: false,
          conversationId: c.id,
          visitorId: c.visitor_id,
          profile_user_picture: profile?.user_picture ?? null,
        });
      }
    } else if (userBusinessId) {
      // Contractor: only customers who have messaged this business (conversations with messages where business_id = userBusinessId).
      // Exclude admin users so they do not appear as separate contacts—only ProBot represents them.
      const { data: adminUsers } = await supabase.from('admin_users').select('user_id');
      const adminUserIdsSet = new Set<string>(((adminUsers ?? []) as { user_id: string }[]).map((r) => r.user_id));

      const { data: msgRows } = await supabase
        .from('probot_messages')
        .select('conversation_id')
        .eq('business_id', userBusinessId)
        .limit(500);
      const convIds = [...new Set((msgRows ?? []).map((m) => (m as { conversation_id: string }).conversation_id))];
      if (convIds.length > 0) {
        const { data: convList } = await supabase
          .from('probot_conversations')
          .select('id, visitor_id, visitor_display_name, user_id')
          .in('id', convIds);
        const list = (convList ?? []) as Array<{
          id: string;
          visitor_id: string;
          visitor_display_name?: string | null;
          user_id?: string | null;
        }>;
        const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))] as string[];
        let profileByUserId: Record<string, { first_name?: string | null; last_name?: string | null; user_picture?: string | null; business_id?: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, user_picture, business_id')
            .in('id', userIds);
          for (const p of profiles ?? []) {
            const row = p as { id: string; first_name?: string | null; last_name?: string | null; user_picture?: string | null; business_id?: string | null };
            profileByUserId[row.id] = row;
          }
        }
        // One contact per user (dedupe by user_id) for signed-up customers; exclude contractors and admins (only ProBot represents admins).
        const seenUserIds = new Set<string>();
        for (const c of list) {
          if (c.user_id) {
            if (adminUserIdsSet.has(c.user_id)) continue; // Admin/hub agent: show only as ProBot, not as separate contact
            const profile = profileByUserId[c.user_id];
            if (profile?.business_id) continue; // Contractor: do not show as personal contact
            if (seenUserIds.has(c.user_id)) continue;
            seenUserIds.add(c.user_id);
            const profileName =
              profile?.first_name || profile?.last_name
                ? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
                : undefined;
            const name =
              profileName ||
              (c.visitor_display_name?.trim() || undefined) ||
              `Customer ${c.visitor_id.slice(0, 8)}`;
            contacts.push({
              id: `customer-${c.user_id}`,
              name,
              isProBot: false,
              conversationId: c.id,
              visitorId: c.visitor_id,
              profile_user_picture: profile?.user_picture ?? null,
            });
          } else {
            // Anonymous visitors who messaged this business: show so contractor can receive and reply
            contacts.push({
              id: `visitor-${c.visitor_id}`,
              name: (c.visitor_display_name?.trim() || undefined) || `Visitor ${c.visitor_id.slice(0, 8)}`,
              isProBot: false,
              conversationId: c.id,
              visitorId: c.visitor_id,
              profile_user_picture: null,
            });
          }
        }
      }
      // Contractor: append all hub contractors (other businesses) after customers/visitors
      const { data: hubBusinesses } = await supabase
        .from('businesses')
        .select('id, business_name, slug, business_logo')
        .eq('is_active', true)
        .neq('id', userBusinessId)
        .order('business_name')
        .limit(500);
      for (const b of hubBusinesses ?? []) {
        const row = b as { id: string; business_name: string | null; slug: string | null; business_logo: string | null };
        contacts.push({
          id: row.id,
          name: row.business_name ?? row.id,
          isProBot: false,
          businessId: row.id,
          slug: row.slug ?? undefined,
          logo: row.business_logo ?? undefined,
          online: false,
        });
      }
    } else {
      // Customer / visitor: ProBot + all businesses (current behavior)
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id, business_name, slug, business_logo')
        .eq('is_active', true)
        .order('business_name')
        .limit(500);
      for (const b of businesses ?? []) {
        const row = b as { id: string; business_name: string | null; slug: string | null; business_logo: string | null };
        contacts.push({
          id: row.id,
          name: row.business_name ?? row.id,
          isProBot: false,
          businessId: row.id,
          slug: row.slug ?? undefined,
          logo: row.business_logo ?? undefined,
          online: false,
        });
      }
    }

    return NextResponse.json({ contacts }, { status: 200 });
  } catch (e) {
    console.error('ProBot contacts GET error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
