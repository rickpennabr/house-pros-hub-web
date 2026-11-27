import { NextRequest, NextResponse } from 'next/server';
import { resolveBusiness } from '@/lib/booking/catalogAccess';
import { BillboardError, createBillboardSlide, listBillboardSlides, reorderBillboardSlides } from '@/lib/billboard/db';
import { parseBillboardInput } from '@/lib/billboard/parse';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import { billboardReorderSchema } from '@/lib/schemas/proBillboard';
import { createClient } from '@/lib/supabase/server';

function billboardErrorResponse(error: unknown) {
  if (error instanceof BillboardError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  console.error('Pro Billboard API', error);
  return NextResponse.json({ error: 'generic' }, { status: 500 });
}

/**
 * GET /api/businesses/[id]/billboard
 * Live slides for the public page. Owners pass ?manage=1 to load every slide, including hidden and scheduled ones.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const business = await resolveBusiness(id);
    if (!business) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const manage = request.nextUrl.searchParams.get('manage') === '1';
    // The owner's screen also shows the current still photo (what plays when nothing is scheduled).
    let stillPhoto: { url: string | null; position: string | null } | undefined;
    if (manage) {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || auth.user.id !== business.owner_id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      const { data: row } = await supabase
        .from('businesses')
        .select('business_background, business_background_position')
        .eq('id', business.id)
        .maybeSingle();
      stillPhoto = { url: row?.business_background ?? null, position: row?.business_background_position ?? null };
    }

    const slides = await listBillboardSlides(business.id, manage ? 'all' : 'live');
    return NextResponse.json(manage ? { slides, stillPhoto } : { slides });
  } catch (error) {
    return billboardErrorResponse(error);
  }
}

/**
 * POST /api/businesses/[id]/billboard
 * Owner adds an image, video, or promotion slide.
 * Body: { kind, mediaUrl?, headline?, body?, badge?, ctaLabel?, ctaUrl?, isActive?, durationSeconds?, startsOn?, endsOn? }
 */
async function handlePost(request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = request.userId;
    if (!userId) return NextResponse.json({ error: 'forbidden' }, { status: 401 });
    const { id } = await context.params;
    const business = await resolveBusiness(id);
    if (!business || business.owner_id !== userId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const input = parseBillboardInput(request._body);
    const slide = await createBillboardSlide(business.id, input);
    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    return billboardErrorResponse(error);
  }
}

/**
 * PATCH /api/businesses/[id]/billboard
 * Owner reorders the board. Body: { orderedIds: string[] }
 */
async function handlePatch(request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = request.userId;
    if (!userId) return NextResponse.json({ error: 'forbidden' }, { status: 401 });
    const { id } = await context.params;
    const business = await resolveBusiness(id);
    if (!business || business.owner_id !== userId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const body = (request._body ?? {}) as Record<string, unknown>;
    const parsed = billboardReorderSchema.safeParse({ orderedIds: body.orderedIds });
    if (!parsed.success) return NextResponse.json({ error: 'reorder_invalid' }, { status: 400 });
    const slides = await reorderBillboardSlides(business.id, parsed.data.orderedIds);
    return NextResponse.json({ slides });
  } catch (error) {
    return billboardErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth((authRequest) => handlePost(authRequest, context))(request);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAuth((authRequest) => handlePatch(authRequest, context))(request);
}
