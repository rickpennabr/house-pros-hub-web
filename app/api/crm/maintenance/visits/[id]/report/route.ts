import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { loadVisitReport } from '@/lib/crm/maintenance-visit-report';

/**
 * GET /api/crm/maintenance/visits/[id]/report
 * The full visit report: house, agreement, who worked, times, services, and before/after media.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    const report = await loadVisitReport(scope, id);
    if (!report) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    return NextResponse.json({ report });
  } catch (error) {
    console.error('GET /api/crm/maintenance/visits/[id]/report', error);
    return NextResponse.json({ error: 'Failed to load the visit report' }, { status: 500 });
  }
}
