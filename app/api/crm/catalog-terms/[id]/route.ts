import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { deleteCatalogTerm } from '@/lib/crm/catalog-db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/crm/catalog-terms/[id]
 * Remove a saved category, unit, price type, or specification name from the list.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await context.params;
    const removed = await deleteCatalogTerm(supabase, user.id, id);
    if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return catalogErrorResponse(error, 'DELETE /api/crm/catalog-terms/[id]');
  }
}
