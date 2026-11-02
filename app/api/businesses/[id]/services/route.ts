import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import { bookingServiceInputSchema } from '@/lib/booking/catalogService';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize';
import {
  createCatalogService,
  isMissingServicesTable,
  listCatalogServices,
  ownerCanManageServices,
  resolveBusiness,
} from '@/lib/booking/catalogAccess';

/**
 * GET /api/businesses/[id]/services
 * Public catalog. Owners also receive hidden services. [id] is a business id or slug.
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
    const includeInactive = !!auth.user && auth.user.id === business.owner_id;
    const result = await listCatalogServices(business.id, includeInactive);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/businesses/[id]/services', error);
    return NextResponse.json({ error: 'Could not load services' }, { status: 500 });
  }
}

/**
 * POST /api/businesses/[id]/services
 * Contractor owner adds a bookable service.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const wrapped = requireAuth(async (authRequest: AuthenticatedRequest) => {
    try {
      const userId = authRequest.userId;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const { id } = await context.params;
      const business = await resolveBusiness(id);
      if (!business || business.owner_id !== userId) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
      if (!(await ownerCanManageServices(userId))) {
        return NextResponse.json({ error: 'Contractor or realtor role required' }, { status: 403 });
      }

      const raw = (authRequest._body ?? {}) as Record<string, unknown>;
      const imageUrl = typeof raw.imageUrl === 'string' ? sanitizeUrl(raw.imageUrl) || null : raw.imageUrl;
      const parsed = bookingServiceInputSchema.safeParse({
        ...raw,
        name: typeof raw.name === 'string' ? sanitizeText(raw.name) : raw.name,
        description: typeof raw.description === 'string' ? sanitizeText(raw.description) : raw.description,
        category: typeof raw.category === 'string' ? sanitizeText(raw.category) : raw.category,
        imageUrl,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid service' },
          { status: 400 }
        );
      }

      const service = await createCatalogService(business.id, parsed.data);
      return NextResponse.json({ service }, { status: 201 });
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      if (isMissingServicesTable(dbError)) {
        return NextResponse.json(
          { error: 'Services are not ready yet. Apply migration 092_contractor_booking_services.sql.' },
          { status: 503 }
        );
      }
      console.error('POST /api/businesses/[id]/services', error);
      return NextResponse.json({ error: 'Could not save service' }, { status: 500 });
    }
  });
  return wrapped(request);
}
