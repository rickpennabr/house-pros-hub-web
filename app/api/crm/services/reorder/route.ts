import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { reorderServices } from '@/lib/crm/catalog-db';
import { serviceReorderSchema } from '@/lib/schemas/crm-catalog';

/**
 * POST /api/crm/services/reorder
 * Save the contractor's service order. `ids` is every service, first to last.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const parsed = serviceReorderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid order' }, { status: 400 });
    }
    await reorderServices(supabase, user.id, parsed.data.ids);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return catalogErrorResponse(error, 'POST /api/crm/services/reorder');
  }
}
