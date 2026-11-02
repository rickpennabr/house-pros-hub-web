import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type AuthenticatedRequest } from '@/lib/middleware/auth';
import { bookingServiceInputSchema } from '@/lib/booking/catalogService';
import { sanitizeText, sanitizeUrl } from '@/lib/utils/sanitize';
import {
  deleteCatalogService,
  isMissingServicesTable,
  ownerCanManageServices,
  resolveBusiness,
  updateCatalogService,
} from '@/lib/booking/catalogAccess';

async function authorize(userId: string, businessKey: string) {
  const business = await resolveBusiness(businessKey);
  if (!business || business.owner_id !== userId) return { error: NextResponse.json({ error: 'Business not found' }, { status: 404 }) };
  if (!(await ownerCanManageServices(userId))) {
    return { error: NextResponse.json({ error: 'Contractor or realtor role required' }, { status: 403 }) };
  }
  return { business };
}

/**
 * PATCH /api/businesses/[id]/services/[serviceId]
 * Contractor owner updates a bookable service.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; serviceId: string }> }
) {
  const wrapped = requireAuth(async (authRequest: AuthenticatedRequest) => {
    try {
      const userId = authRequest.userId;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const { id, serviceId } = await context.params;
      const auth = await authorize(userId, id);
      if (auth.error) return auth.error;

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

      const service = await updateCatalogService(auth.business.id, serviceId, parsed.data);
      if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      return NextResponse.json({ service });
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      if (isMissingServicesTable(dbError)) {
        return NextResponse.json(
          { error: 'Services are not ready yet. Apply migration 092_contractor_booking_services.sql.' },
          { status: 503 }
        );
      }
      console.error('PATCH /api/businesses/[id]/services/[serviceId]', error);
      return NextResponse.json({ error: 'Could not update service' }, { status: 500 });
    }
  });
  return wrapped(request);
}

/**
 * DELETE /api/businesses/[id]/services/[serviceId]
 * Contractor owner removes a bookable service.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; serviceId: string }> }
) {
  const wrapped = requireAuth(async (authRequest: AuthenticatedRequest) => {
    try {
      const userId = authRequest.userId;
      if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const { id, serviceId } = await context.params;
      const auth = await authorize(userId, id);
      if (auth.error) return auth.error;
      const removed = await deleteCatalogService(auth.business.id, serviceId);
      if (!removed) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const dbError = error as { code?: string; message?: string };
      if (isMissingServicesTable(dbError)) {
        return NextResponse.json(
          { error: 'Services are not ready yet. Apply migration 092_contractor_booking_services.sql.' },
          { status: 503 }
        );
      }
      console.error('DELETE /api/businesses/[id]/services/[serviceId]', error);
      return NextResponse.json({ error: 'Could not remove service' }, { status: 500 });
    }
  });
  return wrapped(request);
}
