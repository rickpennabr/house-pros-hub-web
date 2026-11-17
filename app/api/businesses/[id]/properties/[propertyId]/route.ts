import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import { resolveBusiness } from '@/lib/booking/catalogAccess';
import { sanitizeText } from '@/lib/utils/sanitize';

const propertyPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  street_address: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  state: z.string().trim().max(40).optional().nullable(),
  zip_code: z.string().trim().max(20).optional().nullable(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  beds: z.number().nonnegative().nullable().optional(),
  baths: z.number().nonnegative().nullable().optional(),
  sqft: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(['for_sale', 'pending', 'sold', 'off_market']).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  image_url: z.string().trim().url().optional().nullable().or(z.literal('')),
  show_on_profile: z.boolean().optional(),
});

/**
 * PATCH /api/businesses/[id]/properties/[propertyId]
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; propertyId: string }> }
) {
  const wrapped = requireAuth(async (authRequest: AuthenticatedRequest) => {
    try {
      const userId = authRequest.userId;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const { id, propertyId } = await context.params;
      const business = await resolveBusiness(id);
      if (!business || business.owner_id !== userId) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }

      const raw = (authRequest._body ?? {}) as Record<string, unknown>;
      const parsed = propertyPatchSchema.safeParse({
        ...raw,
        title: typeof raw.title === 'string' ? sanitizeText(raw.title) : raw.title,
        description: typeof raw.description === 'string' ? sanitizeText(raw.description) : raw.description,
      });
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid property' }, { status: 400 });
      }

      const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
      if ('image_url' in updates) {
        updates.image_url = typeof updates.image_url === 'string' && updates.image_url.trim()
          ? updates.image_url.trim()
          : null;
      }

      const supabase = await createClient();
      const { data, error } = await supabase
        .from('realtor_properties')
        .update(updates)
        .eq('id', propertyId)
        .eq('owner_id', userId)
        .select('*')
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      if (!data) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      return NextResponse.json({ property: data });
    } catch (error) {
      console.error('PATCH /api/businesses/[id]/properties/[propertyId]', error);
      return NextResponse.json({ error: 'Could not update the property' }, { status: 500 });
    }
  });

  return wrapped(request);
}

/**
 * DELETE /api/businesses/[id]/properties/[propertyId]
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; propertyId: string }> }
) {
  const wrapped = requireAuth(async (authRequest: AuthenticatedRequest) => {
    try {
      const userId = authRequest.userId;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const { id, propertyId } = await context.params;
      const business = await resolveBusiness(id);
      if (!business || business.owner_id !== userId) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }

      const supabase = await createClient();
      const { error } = await supabase
        .from('realtor_properties')
        .delete()
        .eq('id', propertyId)
        .eq('owner_id', userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/businesses/[id]/properties/[propertyId]', error);
      return NextResponse.json({ error: 'Could not delete the property' }, { status: 500 });
    }
  });

  return wrapped(request);
}
