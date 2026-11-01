import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  return { error: null, user };
}

/**
 * POST /api/crm/projects/convert-from-estimate
 * Creates a new project from an estimate while keeping the estimate as source document.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const estimateId = body.estimateId ?? body.estimate_id;
    if (!estimateId || typeof estimateId !== 'string') {
      return NextResponse.json({ error: 'estimateId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: estimate, error: estimateError } = await supabase
      .from('pro_crm_estimates')
      .select('id, customer_id, status, due_date, note')
      .eq('id', estimateId)
      .eq('owner_id', user.id)
      .single();
    if (estimateError || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    const { data: existingProject } = await supabase
      .from('pro_crm_projects')
      .select('id')
      .eq('owner_id', user.id)
      .eq('estimate_id', estimateId)
      .limit(1)
      .maybeSingle();
    if (existingProject) {
      return NextResponse.json({ error: 'A project already exists for this estimate' }, { status: 409 });
    }

    const dueDatePart = estimate.due_date ? ` - due ${estimate.due_date}` : '';
    const { data: row, error: insertError } = await supabase
      .from('pro_crm_projects')
      .insert({
        owner_id: user.id,
        customer_id: estimate.customer_id,
        estimate_id: estimate.id,
        name: `Project from estimate${dueDatePart}`,
        status: 'planned',
        start_date: null,
        end_date: null,
        note: estimate.note ?? null,
      })
      .select('id, display_id, created_at')
      .single();
    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ id: row.id, display_id: row.display_id, created_at: row.created_at }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/projects/convert-from-estimate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
