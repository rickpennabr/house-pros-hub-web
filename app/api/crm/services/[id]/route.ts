import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { deleteService, releaseStoragePaths, updateService } from '@/lib/crm/catalog-db';
import { serviceWriteSchema } from '@/lib/schemas/crm-catalog';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/crm/services/[id]
 * Update a service, including photo order and which photo is the thumbnail.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const parsed = serviceWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid service' }, { status: 400 });
    }
    const { service, removedPaths } = await updateService(supabase, user.id, id, parsed.data, { replaceImages: true });
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    await releaseStoragePaths(createServiceRoleClient(), removedPaths);
    return NextResponse.json({ service });
  } catch (error) {
    return catalogErrorResponse(error, 'PATCH /api/crm/services/[id]');
  }
}

/**
 * DELETE /api/crm/services/[id]
 * Delete a service and its photos.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const removedPaths = await deleteService(supabase, user.id, id);
    await releaseStoragePaths(createServiceRoleClient(), removedPaths);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return catalogErrorResponse(error, 'DELETE /api/crm/services/[id]');
  }
}
