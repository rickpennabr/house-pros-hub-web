import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import { listPlants } from '@/lib/crm/maintenance-plants-db';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import {
  MaintenanceReportPdfDocument,
  type MaintenanceReportPdfProps,
} from '@/components/maintenance/MaintenanceReportPdfDocument';

/**
 * GET /api/crm/maintenance/visits/[id]/pdf
 * Downloadable maintenance visit PDF report.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;

    const { data: visit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('*')
      .eq('id', id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const [{ data: customer }, { data: services }, { data: media }, { data: business }, { data: responsibleCrew }, { data: responsibleContact }] =
      await Promise.all([
        scope.supabase
          .from('pro_crm_customers')
          .select('first_name, last_name, display_name, company_name, street_address, city, state, zip_code')
          .eq('id', visit.customer_id)
          .maybeSingle(),
        scope.supabase
          .from('pro_crm_maintenance_visit_services')
          .select('name, description, sort_order')
          .eq('visit_id', id)
          .order('sort_order', { ascending: true }),
        scope.supabase
          .from('pro_crm_maintenance_visit_media')
          .select('phase, kind')
          .eq('visit_id', id),
        visit.business_id
          ? scope.supabase
              .from('businesses')
              .select('business_name, email, phone, business_address_id')
              .eq('id', visit.business_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        visit.responsible_crew_id
          ? scope.supabase
              .from('business_crew_members')
              .select('display_name')
              .eq('id', visit.responsible_crew_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        visit.responsible_contact_id
          ? scope.supabase
              .from('pro_crm_customers')
              .select('first_name, last_name, display_name, company_name')
              .eq('id', visit.responsible_contact_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    let businessAddress: string | null = null;
    if (business?.business_address_id) {
      const { data: addr } = await scope.supabase
        .from('addresses')
        .select('street_address, apartment, city, state, zip_code')
        .eq('id', business.business_address_id)
        .maybeSingle();
      if (addr) {
        businessAddress = [
          addr.street_address,
          addr.apartment,
          [addr.city, addr.state, addr.zip_code].filter(Boolean).join(', '),
        ]
          .filter(Boolean)
          .join('\n');
      }
    }

    const customerAddress = customer
      ? [customer.street_address, [customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')]
          .filter(Boolean)
          .join('\n')
      : null;

    const mediaCounts = {
      beforePhotos: (media ?? []).filter((row) => row.phase === 'before' && row.kind === 'photo').length,
      beforeVideos: (media ?? []).filter((row) => row.phase === 'before' && row.kind === 'video').length,
      afterPhotos: (media ?? []).filter((row) => row.phase === 'after' && row.kind === 'photo').length,
      afterVideos: (media ?? []).filter((row) => row.phase === 'after' && row.kind === 'video').length,
    };

    const props: MaintenanceReportPdfProps = {
      businessName: business?.business_name ?? 'House Pros Hub',
      businessAddress,
      businessPhone: business?.phone ?? null,
      businessEmail: business?.email ?? null,
      customerName: customer ? contactDisplayName(customer) : 'Customer',
      customerAddress,
      startedAt: visit.started_at,
      endedAt: visit.ended_at,
      durationSeconds: visit.duration_seconds,
      services: (services ?? []).map((service) => ({
        name: service.name,
        description: service.description,
      })),
      generatedDescription: visit.generated_description,
      notes: visit.notes,
      responsibleName:
        responsibleCrew?.display_name ??
        (responsibleContact ? contactDisplayName(responsibleContact) : null),
      mediaCounts,
      plants: (
        await listPlants(scope.supabase, scope.ownerId, visit.customer_id, { withImageUrls: false }).catch(() => [])
      ).map((plant) => ({
        name: plant.name,
        quantity: plant.quantity,
        area: plant.area,
        notes: plant.notes,
        photoCount: plant.images.length,
      })),
    };

    const buffer = await renderToBuffer(
      React.createElement(MaintenanceReportPdfDocument, props) as React.ReactElement<DocumentProps>
    );

    const filename = `maintenance-report-${id.slice(0, 8)}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/visits/[id]/pdf', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
