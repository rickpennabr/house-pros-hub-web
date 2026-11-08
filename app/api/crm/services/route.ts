import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { catalogErrorResponse } from '@/lib/crm/catalog-http';
import { createService, listServices } from '@/lib/crm/catalog-db';
import { serviceWriteSchema } from '@/lib/schemas/crm-catalog';

/**
 * GET /api/crm/services
 * List the contractor's services, including ordered photos.
 */
export async function GET() {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const services = await listServices(supabase, user.id);
    return NextResponse.json({ services });
  } catch (error) {
    return catalogErrorResponse(error, 'GET /api/crm/services');
  }
}

/**
 * POST /api/crm/services
 * Create a service. Photos are uploaded first and sent as image URLs.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const parsed = serviceWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid service' }, { status: 400 });
    }
    const service = await createService(supabase, user.id, parsed.data);
    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return catalogErrorResponse(error, 'POST /api/crm/services');
  }
}
