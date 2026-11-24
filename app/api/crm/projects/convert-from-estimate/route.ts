import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient } from '@/lib/supabase/server';
import { estimateReadyForWork } from '@/lib/schemas/crmEstimate';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { recordCustomerPlaceEvent } from '@/lib/places/timeline';

const STATUSES = ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * POST /api/crm/projects/convert-from-estimate
 * Creates a project from an approved estimate, keeping the estimate as its source document.
 * Body: { estimateId, name?, status?, startDate?, endDate?, note?, projectManagerId? }.
 * The project lands on the estimate's property, and the project manager joins its team.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json().catch(() => ({}));
    const estimateId = body.estimateId ?? body.estimate_id;
    if (!estimateId || typeof estimateId !== 'string') {
      return NextResponse.json({ error: 'estimateId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: estimate, error: estimateError } = await supabase
      .from('pro_crm_estimates')
      .select('*')
      .eq('id', estimateId)
      .eq('owner_id', user.id)
      .single();
    if (estimateError || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }
    if (!estimateReadyForWork(estimate.status)) {
      return NextResponse.json({ error: 'Accept the estimate before creating a project' }, { status: 400 });
    }

    const { data: existingProject } = await supabase
      .from('pro_crm_projects')
      .select('id')
      .eq('owner_id', user.id)
      .eq('estimate_id', estimateId)
      .limit(1)
      .maybeSingle();
    if (existingProject) {
      return NextResponse.json({ error: 'A project already exists for this estimate', id: existingProject.id }, { status: 409 });
    }

    const row = estimate as typeof estimate & { job_area?: string | null; place_id?: string | null };
    let name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
    if (!name) {
      const { data: customer } = row.customer_id
        ? await supabase
            .from('pro_crm_customers')
            .select('first_name, last_name, display_name, company_name')
            .eq('id', row.customer_id)
            .maybeSingle()
        : { data: null };
      name = [customer ? contactDisplayName(customer) : null, row.job_area].filter(Boolean).join(' - ') || 'New project';
    }
    const startDate = isDay(body.startDate) ? body.startDate : null;
    const endDate = isDay(body.endDate) ? body.endDate : null;
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: 'The end date is before the start date' }, { status: 400 });
    }
    const status = STATUSES.includes(body.status) ? body.status : 'planned';
    const note = typeof body.note === 'string' ? body.note.trim() || null : row.note ?? null;

    const { data: created, error: insertError } = await supabase
      .from('pro_crm_projects')
      .insert({
        owner_id: user.id,
        customer_id: row.customer_id,
        estimate_id: row.id,
        name,
        status,
        start_date: startDate,
        end_date: endDate,
        note,
        // Same property as the estimate.
        ...(row.place_id ? { place_id: row.place_id } : {}),
      })
      .select('id, display_id, created_at')
      .single();
    if (insertError || !created) {
      return NextResponse.json({ error: insertError?.message || 'Failed to create project' }, { status: 500 });
    }

    // Project manager joins the project team with that role.
    const managerId = typeof body.projectManagerId === 'string' ? body.projectManagerId : '';
    if (managerId) {
      const [{ data: contact }, { data: role }] = await Promise.all([
        supabase.from('pro_crm_customers').select('id').eq('id', managerId).eq('owner_id', user.id).maybeSingle(),
        supabase.from('pro_crm_roles').select('id').eq('slug', 'project_manager').limit(1).maybeSingle(),
      ]);
      if (contact && role) {
        const { error: memberError } = await supabase
          .from('pro_crm_project_members')
          .insert({ project_id: created.id, contact_id: contact.id, role_id: role.id });
        if (memberError) console.error('convert-from-estimate project manager', memberError.message);
      }
    }

    if (row.customer_id) {
      await recordCustomerPlaceEvent(row.customer_id, {
        placeId: row.place_id || undefined,
        kind: 'project_shared',
        title: `Project added · ${name}`,
        detail: startDate ? `Starts ${startDate}` : null,
        projectId: created.id,
        ownerId: user.id,
      }).catch(() => null);
    }

    return NextResponse.json({ id: created.id, display_id: created.display_id, created_at: created.created_at }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/projects/convert-from-estimate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
