import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { listProducts } from '@/lib/crm/catalog-db';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { resolveBusiness } from '@/lib/booking/catalogAccess';

/**
 * GET /api/businesses/[id]/products
 * CRM products the owner turned on for their public details page.
 * pro_crm_products RLS is owner-only, so public reads use the service role
 * and only return rows with show_on_profile = true. Owners also get `products`
 * (the full list) so the tab can explain what is still hidden.
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
    if (!isOwner && !business.is_active) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (!business.owner_id) return NextResponse.json({ products: [], profileProducts: [] });
    const all = await listProducts(createServiceRoleClient(), business.owner_id);
    const profileProducts = all.filter((product) => product.show_on_profile);

    return NextResponse.json({
      products: isOwner ? all : profileProducts,
      profileProducts,
    });
  } catch (error) {
    return catalogErrorResponse(error, 'GET /api/businesses/[id]/products');
  }
}
