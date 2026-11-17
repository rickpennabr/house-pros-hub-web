import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import { resolveBusiness } from '@/lib/booking/catalogAccess';
import { sanitizeText } from '@/lib/utils/sanitize';

const propertyWriteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  street_address: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  zip_code: z.string().trim().max(20).optional().nullable(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  beds: z.number().nonnegative().nullable().optional(),
  baths: z.number().nonnegative().nullable().optional(),
  sqft: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(['for_sale', 'pending', 'sold', 'off_market']).optional().default('for_sale'),
  description: z.string().trim().max(4000).optional().nullable(),
  image_url: z.string().trim().url().optional().nullable().or(z.literal('')),
  show_on_profile: z.boolean().optional().default(true),
});

type PropertyRow = {
  id: string;
  owner_id: string;
  business_id: string | null;
  title: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price_cents: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string;
  description: string | null;
  image_url: string | null;
  show_on_profile: boolean;
  display_order: number;
  created_at: string;
};

/**
 * GET /api/businesses/[id]/properties
 * Realtor listings for the Properties details tab.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const business = await resolveBusiness(id);
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const isOwner = !!auth.user && auth.user.id === business.owner_id;

    let query = supabase
      .from('realtor_properties')
      .select('*')
      .eq('owner_id', business.owner_id ?? '')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!isOwner) {
      query = query.eq('show_on_profile', true);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ properties: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ properties: (data ?? []) as PropertyRow[] });
  } catch (error) {
    console.error('GET /api/businesses/[id]/properties', error);
    return NextResponse.json({ error: 'Could not load properties' }, { status: 500 });
  }
}

/**
 * POST /api/businesses/[id]/properties
 * Realtor owner adds a listing for the Properties tab.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const wrapped = requireAuth(async (authRequest: AuthenticatedRequest) => {
    try {
      const userId = authRequest.userId;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const { id } = await context.params;
      const business = await resolveBusiness(id);
      if (!business || business.owner_id !== userId) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }

      const raw = (authRequest._body ?? {}) as Record<string, unknown>;
      const parsed = propertyWriteSchema.safeParse({
        ...raw,
        title: typeof raw.title === 'string' ? sanitizeText(raw.title) : raw.title,
        description: typeof raw.description === 'string' ? sanitizeText(raw.description) : raw.description,
        street_address: typeof raw.street_address === 'string' ? sanitizeText(raw.street_address) : raw.street_address,
        city: typeof raw.city === 'string' ? sanitizeText(raw.city) : raw.city,
        state: typeof raw.state === 'string' ? sanitizeText(raw.state) : raw.state,
        zip_code: typeof raw.zip_code === 'string' ? sanitizeText(raw.zip_code) : raw.zip_code,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid property' }, { status: 400 });
      }

      const supabase = await createClient();
      const imageUrl = parsed.data.image_url?.trim() || null;
      const { data, error } = await supabase
        .from('realtor_properties')
        .insert({
          owner_id: userId,
          business_id: business.id,
          title: parsed.data.title,
          street_address: parsed.data.street_address || null,
          city: parsed.data.city || null,
          state: parsed.data.state || null,
          zip_code: parsed.data.zip_code || null,
          price_cents: parsed.data.price_cents ?? null,
          beds: parsed.data.beds ?? null,
          baths: parsed.data.baths ?? null,
          sqft: parsed.data.sqft ?? null,
          status: parsed.data.status,
          description: parsed.data.description || null,
          image_url: imageUrl,
          show_on_profile: parsed.data.show_on_profile !== false,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return NextResponse.json({ error: 'Properties are not ready yet. Apply migration 139.' }, { status: 503 });
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ property: data as PropertyRow }, { status: 201 });
    } catch (error) {
      console.error('POST /api/businesses/[id]/properties', error);
      return NextResponse.json({ error: 'Could not save the property' }, { status: 500 });
    }
  });

  return wrapped(request);
}
