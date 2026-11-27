import { NextRequest, NextResponse } from 'next/server';
import { resolveBusiness } from '@/lib/booking/catalogAccess';
import { BillboardError, deleteBillboardSlide, updateBillboardSlide } from '@/lib/billboard/db';
import { parseBillboardInput } from '@/lib/billboard/parse';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';

function billboardErrorResponse(error: unknown) {
  if (error instanceof BillboardError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  console.error('Pro Billboard slide API', error);
  return NextResponse.json({ error: 'generic' }, { status: 500 });
}

/**
 * PATCH /api/businesses/[id]/billboard/[slideId]
 * Owner replaces a slide. Same body as create.
 */
async function handlePatch(request: AuthenticatedRequest, context: { params: Promise<{ id: string; slideId: string }> }) {
  try {
    const userId = request.userId;
    if (!userId) return NextResponse.json({ error: 'forbidden' }, { status: 401 });
    const { id, slideId } = await context.params;
    const business = await resolveBusiness(id);
    if (!business || business.owner_id !== userId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const input = parseBillboardInput(request._body);
    const slide = await updateBillboardSlide(business.id, slideId, input);
    return NextResponse.json({ slide });
  } catch (error) {
    return billboardErrorResponse(error);
  }
}

/**
 * DELETE /api/businesses/[id]/billboard/[slideId]
 * Owner removes a slide and its file.
 */
async function handleDelete(request: AuthenticatedRequest, context: { params: Promise<{ id: string; slideId: string }> }) {
  try {
    const userId = request.userId;
    if (!userId) return NextResponse.json({ error: 'forbidden' }, { status: 401 });
    const { id, slideId } = await context.params;
    const business = await resolveBusiness(id);
    if (!business || business.owner_id !== userId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    await deleteBillboardSlide(business.id, slideId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return billboardErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; slideId: string }> }) {
  return requireAuth((authRequest) => handlePatch(authRequest, context))(request);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; slideId: string }> }) {
  return requireAuth((authRequest) => handleDelete(authRequest, context))(request);
}
