import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { savedBusinessIdSchema } from '@/lib/schemas/savedBusiness';

export const dynamic = 'force-dynamic';

async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function saveCount(businessId: string): Promise<number> {
  const admin = createServiceRoleClient();
  const { count, error } = await admin
    .from('saved_businesses')
    .select('user_id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * GET /api/saved-businesses
 * With businessId: public save count and whether the signed-in user saved it.
 * Without businessId: the signed-in user's saved business ids.
 */
export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get('businessId');
    const userId = await signedInUserId();
    const admin = createServiceRoleClient();

    if (!businessId) {
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { data, error } = await admin
        .from('saved_businesses')
        .select('business_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return NextResponse.json({ ids: (data ?? []).map((row) => row.business_id) });
    }

    const parsed = savedBusinessIdSchema.safeParse({ businessId });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });

    const count = await saveCount(parsed.data.businessId);
    if (!userId) return NextResponse.json({ saved: false, count });

    const { data, error } = await admin
      .from('saved_businesses')
      .select('business_id')
      .eq('user_id', userId)
      .eq('business_id', parsed.data.businessId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ saved: Boolean(data), count });
  } catch (error) {
    console.error('GET /api/saved-businesses', error);
    return NextResponse.json({ error: 'Saved businesses are not ready yet. Apply the saved_businesses migration.' }, { status: 500 });
  }
}

/**
 * POST /api/saved-businesses
 * Save a business on the signed-in user's personal account. Saving again is a no-op.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await signedInUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: unknown = await request.json().catch(() => null);
    const parsed = savedBusinessIdSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });

    const admin = createServiceRoleClient();
    const { data: business, error: businessError } = await admin
      .from('businesses')
      .select('id')
      .eq('id', parsed.data.businessId)
      .maybeSingle();
    if (businessError) throw businessError;
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const { error } = await admin
      .from('saved_businesses')
      .upsert(
        { user_id: userId, business_id: parsed.data.businessId },
        { onConflict: 'user_id,business_id', ignoreDuplicates: true },
      );
    if (error) throw error;

    return NextResponse.json({ saved: true, count: await saveCount(parsed.data.businessId) });
  } catch (error) {
    console.error('POST /api/saved-businesses', error);
    return NextResponse.json({ error: 'Could not save this business.' }, { status: 500 });
  }
}

/**
 * DELETE /api/saved-businesses?businessId=
 * Remove the signed-in user's save. A missing row is still a success.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await signedInUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = savedBusinessIdSchema.safeParse({
      businessId: request.nextUrl.searchParams.get('businessId'),
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 });

    const admin = createServiceRoleClient();
    const { error } = await admin
      .from('saved_businesses')
      .delete()
      .eq('user_id', userId)
      .eq('business_id', parsed.data.businessId);
    if (error) throw error;

    return NextResponse.json({ saved: false, count: await saveCount(parsed.data.businessId) });
  } catch (error) {
    console.error('DELETE /api/saved-businesses', error);
    return NextResponse.json({ error: 'Could not remove this saved business.' }, { status: 500 });
  }
}
