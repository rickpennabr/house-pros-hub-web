import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { deny } from '@/lib/places/session';
import {
  PHASE_STATUSES,
  PLACE_KINDS,
  PLAN_FREQUENCIES,
  type PhaseStatus,
  type PlaceKind,
  type PlanFrequency,
} from '@/lib/places/portal';
import { cleanDate, cleanText } from '@/lib/places/session';

/**
 * GET /api/crm/portal
 * Customers, shared projects, phases, maintenance, and documents the contractor can publish.
 */
export async function GET() {
  try {
    const { error, user, supabase } = await requireContractor();
    if (error || !user || !supabase) return deny(error);

    const { data: customers, error: customerError } = await supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name, company_name, email, street_address, city, state, zip_code, portal_kind, portal_user_id, place_id')
      .eq('owner_id', user.id)
      .order('last_name', { ascending: true });
    if (customerError) return NextResponse.json({ error: customerError.message }, { status: 500 });

    const ids = (customers ?? []).map((row) => row.id);
    if (ids.length === 0) {
      return NextResponse.json({ customers: [], projects: [], phases: [], plans: [], documents: [] });
    }

    const [{ data: projects }, { data: plans }, { data: documents }] = await Promise.all([
      supabase
        .from('pro_crm_projects')
        .select('id, customer_id, name, status, start_date, end_date, shared')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('pro_crm_maintenance_plans')
        .select('id, customer_id, name, summary, frequency, next_visit_date, last_visit_date, end_date, is_active, amount_cents')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('pro_crm_customer_documents')
        .select('id, customer_id, project_id, kind, title, file_name, visible_to_customer')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const projectIds = (projects ?? []).map((row) => row.id);
    const { data: phases } = projectIds.length
      ? await supabase
          .from('pro_crm_project_phases')
          .select('id, project_id, name, status, start_date, end_date, customer_note, sort_order')
          .eq('owner_id', user.id)
          .order('sort_order', { ascending: true })
      : { data: [] };

    return NextResponse.json({
      customers: customers ?? [],
      projects: projects ?? [],
      phases: phases ?? [],
      plans: plans ?? [],
      documents: documents ?? [],
    });
  } catch (err) {
    console.error('GET /api/crm/portal', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/portal
 * Publish a phase, a maintenance plan, a place type, or a project's visibility.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user, supabase } = await requireContractor();
    if (error || !user || !supabase) return deny(error);
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'kind') {
      const customerId = cleanText(body.customerId, 40);
      const kind = PLACE_KINDS.includes(body.kind) ? (body.kind as PlaceKind) : null;
      if (!customerId || !kind) return NextResponse.json({ error: 'Customer and place type are required.' }, { status: 400 });
      const { data: owned } = await supabase
        .from('pro_crm_customers')
        .select('place_id')
        .eq('id', customerId)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!owned) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      const { error: updateError } = await supabase
        .from('pro_crm_customers')
        .update({ portal_kind: kind })
        .eq('id', customerId)
        .eq('owner_id', user.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      if (owned.place_id) {
        const admin = createServiceRoleClient();
        await admin.from('customer_places').update({ kind }).eq('id', owned.place_id);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'share') {
      const projectId = cleanText(body.projectId, 40);
      if (!projectId || typeof body.shared !== 'boolean') {
        return NextResponse.json({ error: 'Project and visibility are required.' }, { status: 400 });
      }
      const { error: updateError } = await supabase
        .from('pro_crm_projects')
        .update({ shared: body.shared })
        .eq('id', projectId)
        .eq('owner_id', user.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'phase') {
      const projectId = cleanText(body.projectId, 40);
      const name = cleanText(body.name, 120);
      const status: PhaseStatus = PHASE_STATUSES.includes(body.status) ? body.status : 'planned';
      if (!projectId || !name) return NextResponse.json({ error: 'Project and phase name are required.' }, { status: 400 });
      const { data: project } = await supabase
        .from('pro_crm_projects')
        .select('id')
        .eq('id', projectId)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const { error: insertError } = await supabase.from('pro_crm_project_phases').insert({
        project_id: projectId,
        owner_id: user.id,
        name,
        status,
        start_date: cleanDate(body.startDate),
        end_date: cleanDate(body.endDate),
        customer_note: cleanText(body.note, 500) || null,
        sort_order: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0,
      });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === 'deletePhase') {
      const id = cleanText(body.id, 40);
      if (!id) return NextResponse.json({ error: 'Phase is required.' }, { status: 400 });
      const { error: deleteError } = await supabase.from('pro_crm_project_phases').delete().eq('id', id).eq('owner_id', user.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'plan') {
      const customerId = cleanText(body.customerId, 40);
      const name = cleanText(body.name, 120);
      const frequency: PlanFrequency | null = PLAN_FREQUENCIES.includes(body.frequency) ? body.frequency : null;
      if (!customerId || !name || !frequency) {
        return NextResponse.json({ error: 'Customer, name, and how often are required.' }, { status: 400 });
      }
      const { data: customer } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('id', customerId)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      const dollars = typeof body.amount === 'string' ? Number(body.amount) : Number(body.amount);
      const amountCents = Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null;
      const { error: insertError } = await supabase.from('pro_crm_maintenance_plans').insert({
        owner_id: user.id,
        customer_id: customerId,
        name,
        summary: cleanText(body.summary, 1000) || null,
        frequency,
        next_visit_date: cleanDate(body.nextVisit),
        last_visit_date: cleanDate(body.lastVisit),
        end_date: cleanDate(body.endDate),
        amount_cents: amountCents,
        is_active: body.isActive !== false,
      });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (action === 'deletePlan') {
      const id = cleanText(body.id, 40);
      if (!id) return NextResponse.json({ error: 'Plan is required.' }, { status: 400 });
      const { error: deleteError } = await supabase
        .from('pro_crm_maintenance_plans')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'deleteDocument') {
      const id = cleanText(body.id, 40);
      if (!id) return NextResponse.json({ error: 'Document is required.' }, { status: 400 });
      const { data: doc } = await supabase
        .from('pro_crm_customer_documents')
        .select('file_path')
        .eq('id', id)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      await supabase.storage.from('customer-documents').remove([doc.file_path]);
      const { error: deleteError } = await supabase
        .from('pro_crm_customer_documents')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/crm/portal', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
