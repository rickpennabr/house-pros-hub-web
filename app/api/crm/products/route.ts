import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { createProduct, listProducts } from '@/lib/crm/catalog-db';
import { productWriteSchema } from '@/lib/schemas/crm-catalog';

/**
 * GET /api/crm/products
 * List the contractor's products, including photos and specifications.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const products = await listProducts(supabase, user.id);
    return NextResponse.json({ products });
  } catch (error) {
    return catalogErrorResponse(error, 'GET /api/crm/products');
  }
}

/**
 * POST /api/crm/products
 * Create a product. Specifications are name/value rows so new product types do not need new columns.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const parsed = productWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid product' }, { status: 400 });
    }
    const product = await createProduct(supabase, user.id, parsed.data);
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return catalogErrorResponse(error, 'POST /api/crm/products');
  }
}
