import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { loadScopedProject, UUID_RE } from '@/lib/crm/project-access';

type Params = { params: Promise<{ id: string }> };

const RENTAL_CATEGORY = 'Equipment rental';
const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const clean = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

/**
 * Rented equipment on a project (a mini Bobcat, a plate compactor…). Each rental is an expense in
 * "Equipment rental" linked to the project, so it counts in project cost and company expenses once.
 * GET — the project's rentals. POST { name, vendor, startDate, endDate, amount } (owner only). DELETE ?rentalId=.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;
    const { data, error: listError } = await scope.supabase
      .from('pro_crm_expenses')
      .select('id, amount_cents, expense_date, description, note, quantity, unit')
      .eq('owner_id', scope.ownerId)
      .eq('project_id', project.id)
      .eq('category', RENTAL_CATEGORY)
      .order('expense_date', { ascending: false });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
    return NextResponse.json({
      rentals: (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.description ?? 'Rental',
        vendor: row.note ?? null,
        startDate: row.expense_date,
        days: row.quantity != null ? Number(row.quantity) : null,
        // Crew see what is on site, not what it cost.
        amountCents: scope.isCrew ? null : Number(row.amount_cents ?? 0),
      })),
    });
  } catch (err) {
    console.error('GET project rentals', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can add rentals.' }, { status: 403 });
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;

    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const name = clean(body.name, 160);
    if (!name) return NextResponse.json({ error: 'Enter what was rented' }, { status: 400 });
    const amount = Number(String(body.amount ?? '').replace(/[$,]/g, ''));
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return NextResponse.json({ error: 'Enter the rental cost' }, { status: 400 });
    const startDate = isDay(body.startDate) ? body.startDate : new Date().toISOString().slice(0, 10);
    const endDate = isDay(body.endDate) ? body.endDate : startDate;
    if (endDate < startDate) return NextResponse.json({ error: 'The return date is before the pickup date' }, { status: 400 });
    const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;

    const { data, error: insertError } = await scope.supabase
      .from('pro_crm_expenses')
      .insert({
        owner_id: scope.ownerId,
        project_id: project.id,
        category: RENTAL_CATEGORY,
        amount_cents: Math.round(amount * 100),
        expense_date: startDate,
        description: name,
        note: clean(body.vendor, 160),
        quantity: days,
        unit: days === 1 ? 'day' : 'days',
      })
      .select('id')
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 });
  } catch (err) {
    console.error('POST project rental', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can remove rentals.' }, { status: 403 });
    const project = await loadScopedProject(scope, (await params).id);
    if (project instanceof NextResponse) return project;
    const rentalId = request.nextUrl.searchParams.get('rentalId') ?? '';
    if (!UUID_RE.test(rentalId)) return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    const { error: deleteError } = await scope.supabase
      .from('pro_crm_expenses')
      .delete()
      .eq('id', rentalId)
      .eq('project_id', project.id)
      .eq('owner_id', scope.ownerId)
      .eq('category', RENTAL_CATEGORY);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE project rental', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
