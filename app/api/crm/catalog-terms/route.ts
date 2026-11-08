import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { createCatalogTerm, listCatalogTerms } from '@/lib/crm/catalog-db';
import { catalogTermWriteSchema } from '@/lib/schemas/crm-catalog';

/**
 * GET /api/crm/catalog-terms
 * Saved categories, units, price types, and specification names for this contractor.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const terms = await listCatalogTerms(supabase, user.id);
    return NextResponse.json({ terms });
  } catch (error) {
    return catalogErrorResponse(error, 'GET /api/crm/catalog-terms');
  }
}

/**
 * POST /api/crm/catalog-terms
 * Remember a category, unit, price type, or specification name for later.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const parsed = catalogTermWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid name' }, { status: 400 });
    }
    const term = await createCatalogTerm(
      supabase,
      user.id,
      parsed.data.kind,
      parsed.data.label,
      parsed.data.price_mode ?? null
    );
    return NextResponse.json({ term }, { status: 201 });
  } catch (error) {
    return catalogErrorResponse(error, 'POST /api/crm/catalog-terms');
  }
}
