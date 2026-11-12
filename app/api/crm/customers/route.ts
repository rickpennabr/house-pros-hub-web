import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/supabase';
import { hasRole } from '@/lib/utils/roles';
import {
  assignDefaultCustomerRole,
  billableContactIds,
  contactIdsForRole,
  parseRoleIds,
  replaceContactRoles,
  rolesByContactId,
} from '@/lib/crm/contact-role';
import { DISPLAY_NAME_TAKEN, displayNameTaken, resolveContactDisplayName } from '@/lib/crm/display-name';
import { openBalanceByCustomer } from '@/lib/crm/contact-books';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

const VALID_SORT = ['created_at', 'updated_at', 'display_id', 'last_name', 'first_name', 'company_name', 'display_name', 'city', 'state', 'phone', 'email'] as const;

/**
 * GET /api/crm/customers
 * List contacts for the authenticated contractor. Paginated, sortable, searchable.
 * `billable=1` keeps contacts that can receive an estimate or invoice.
 * `role` keeps contacts that have that role slug.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const sortBy = (searchParams.get('sortBy') || 'created_at') as (typeof VALID_SORT)[number];
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc';
    const search = (searchParams.get('search') || '').trim();
    const roleSlug = (searchParams.get('role') || '').trim().toLowerCase();
    const billableOnly = searchParams.get('billable') === '1';

    const supabase = await createClient();
    const orderColumn = VALID_SORT.includes(sortBy) ? sortBy : 'created_at';

    let query = supabase
      .from('pro_crm_customers')
      .select('*', { count: 'exact' })
      .eq('owner_id', user.id)
      .order(orderColumn, { ascending: sortDir === 'asc' });

    if (billableOnly || roleSlug) {
      const billableIds = billableOnly ? await billableContactIds(supabase) : null;
      const roleIds = roleSlug ? await contactIdsForRole(supabase, roleSlug) : null;
      const filtered = (billableIds ?? roleIds ?? []).filter((id) => {
        if (billableIds && !billableIds.includes(id)) return false;
        if (roleIds && !roleIds.includes(id)) return false;
        return true;
      });
      if (filtered.length === 0) {
        return NextResponse.json({ customers: [], total: 0, page, pageSize });
      }
      query = query.in('id', filtered);
    }

    if (search) {
      const safe = search.replace(/[%,"\\]/g, '').trim();
      if (safe) {
        const term = `%${safe}%`;
        query = query.or(
          `display_id.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},company_name.ilike.${term},display_name.ilike.${term},email.ilike.${term},city.ilike.${term},state.ilike.${term},phone.ilike.${term},mobile_number.ilike.${term}`
        );
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: customers, error: fetchError, count } = await query.range(from, to);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message || 'Failed to fetch customers' }, { status: 500 });
    }

    const rows = customers ?? [];
    const ids = rows.map((row) => row.id);
    const roles = await rolesByContactId(supabase, ids);
    const { data: openInvoices } = ids.length
      ? await supabase
          .from('pro_crm_invoices')
          .select('customer_id, amount_cents, payment_applied_cents, status')
          .eq('owner_id', user.id)
          .in('customer_id', ids)
          .in('status', ['sent', 'partial', 'overdue'])
      : { data: [] };
    const balances = openBalanceByCustomer(
      (openInvoices ?? []).map((row) => ({
        customerId: row.customer_id,
        status: row.status,
        amountCents: row.amount_cents,
        paidCents: row.payment_applied_cents,
      }))
    );
    return NextResponse.json({
      customers: rows.map((row) => ({
        ...row,
        roles: roles.get(row.id) ?? [],
        open_balance_cents: balances.get(row.id) ?? 0,
      })),
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    console.error('GET /api/crm/customers', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/customers
 * Create a CRM customer. Contractor only; owner_id set to current user.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const str = (key: string) => trim(body[key]) || null;
    const firstName = trim(body.first_name ?? body.firstName);
    const lastName = trim(body.last_name ?? body.lastName);
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 });
    }
    const displayName = resolveContactDisplayName({
      displayName: trim(body.display_name ?? body.displayName),
      firstName,
      lastName,
      companyName: trim(body.company_name ?? body.companyName),
    });
    if (!displayName) {
      return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
    }

    const supabase = await createClient();
    if (await displayNameTaken(supabase, user.id, displayName)) {
      return NextResponse.json({ error: DISPLAY_NAME_TAKEN }, { status: 409 });
    }
    type CustomerInsert = Database['public']['Tables']['pro_crm_customers']['Insert'];
    const insertPayload: CustomerInsert = {
      owner_id: user.id,
      first_name: firstName,
      last_name: lastName,
      company_name: str('company_name'),
      display_name: displayName,
      email: str('email'),
      phone: str('phone'),
      cc: str('cc'),
      bcc: str('bcc'),
      mobile_number: str('mobile_number'),
      fax: str('fax'),
      other: str('other'),
      website: str('website'),
      street_address: str('street_address'),
      apartment: str('apartment'),
      city: str('city'),
      state: str('state'),
      zip_code: str('zip_code'),
      billing_address_street_1: str('billing_address_street_1'),
      billing_address_street_2: str('billing_address_street_2'),
      billing_address_city: str('billing_address_city'),
      billing_address_state: str('billing_address_state'),
      billing_address_zip_code: str('billing_address_zip_code'),
      billing_address_country: str('billing_address_country'),
      shipping_same_as_billing: body.shipping_same_as_billing !== false,
      shipping_address_street_1: str('shipping_address_street_1'),
      shipping_address_street_2: str('shipping_address_street_2'),
      shipping_address_city: str('shipping_address_city'),
      shipping_address_state: str('shipping_address_state'),
      shipping_address_zip_code: str('shipping_address_zip_code'),
      shipping_address_country: str('shipping_address_country'),
      notes: str('notes'),
      primary_payment_method: str('primary_payment_method'),
      payment_terms: str('payment_terms'),
      invoice_language: body.invoice_language === 'es' ? 'es' : 'en',
      opening_balance: typeof body.opening_balance === 'number' ? body.opening_balance : 0,
    };
    const { data: row, error } = await supabase
      .from('pro_crm_customers')
      .insert(insertPayload)
      .select('id, display_id, created_at')
      .single();

    if (error || !row) {
      const taken = error?.code === '23505';
      return NextResponse.json(
        { error: taken ? DISPLAY_NAME_TAKEN : error?.message || 'Failed to create customer' },
        { status: taken ? 409 : 500 }
      );
    }

    const roleIds = parseRoleIds(body);
    const roleResult = roleIds
      ? await replaceContactRoles(supabase, user.id, row.id, roleIds)
      : await assignDefaultCustomerRole(supabase, row.id);
    if (roleResult) {
      await supabase.from('pro_crm_customers').delete().eq('id', row.id).eq('owner_id', user.id);
      return NextResponse.json({ error: roleResult.error }, { status: roleResult.status });
    }

    return NextResponse.json({ id: row.id, display_id: row.display_id, created_at: row.created_at }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/customers', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
