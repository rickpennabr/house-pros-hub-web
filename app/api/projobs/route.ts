import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { hasRole } from '@/lib/utils/roles';
import { proJobWriteSchema } from '@/lib/schemas/proJob';
import type { ProJob } from '@/lib/data/proJobs';

interface BusinessContact {
  business_name: string;
  phone: string | null;
  mobile_phone: string | null;
  is_active: boolean;
}

interface JobRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  employment_type: ProJob['employmentType'];
  workplace_type: ProJob['workplaceType'];
  workplace_language: ProJob['workplaceLanguage'];
  city: string;
  state: string;
  pay: string | null;
  businesses: BusinessContact | BusinessContact[] | null;
}

function businessOf(row: JobRow): BusinessContact | null {
  if (!row.businesses) return null;
  return Array.isArray(row.businesses) ? row.businesses[0] ?? null : row.businesses;
}

function toProJob(row: JobRow, viewerId: string | null): ProJob | null {
  const business = businessOf(row);
  if (!business || !business.is_active) return null;
  const phone = (business.phone || business.mobile_phone || '').trim();
  return {
    id: row.id,
    company: business.business_name,
    title: row.title,
    description: row.description,
    category: row.category,
    employmentType: row.employment_type,
    workplaceType: row.workplace_type,
    workplaceLanguage: row.workplace_language,
    city: row.city,
    state: row.state,
    pay: row.pay,
    phone,
    mine: viewerId != null && viewerId === row.owner_id,
  };
}

const JOB_SELECT = `
  id,
  owner_id,
  title,
  description,
  category,
  employment_type,
  workplace_type,
  workplace_language,
  city,
  state,
  pay,
  businesses!inner (
    business_name,
    phone,
    mobile_phone,
    is_active
  )
`;

function isAdminEmail(email: string | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

async function contractorBusiness(userId: string, isAdmin: boolean) {
  const supabase = await createClient();
  const isContractor = await hasRole(userId, 'contractor');
  if (!isContractor && !isAdmin) {
    return { error: 'contractor_required' as const, business: null, phone: '', useServiceRole: false };
  }

  const [{ data: profile }, { data: businesses, error }] = await Promise.all([
    supabase.from('profiles').select('business_id').eq('id', userId).maybeSingle(),
    supabase
      .from('businesses')
      .select('id, business_name, phone, mobile_phone, is_active')
      .eq('owner_id', userId)
      .eq('is_active', true),
  ]);

  if (error) {
    return { error: 'business_required' as const, business: null, phone: '', useServiceRole: false };
  }

  const owned = businesses ?? [];
  const linkedId = profile?.business_id;
  const business = linkedId
    ? owned.find((row) => row.id === linkedId) ?? null
    : owned.length === 1
      ? owned[0]
      : null;

  if (!business) {
    return { error: 'business_required' as const, business: null, phone: '', useServiceRole: false };
  }

  const phone = (business.phone || business.mobile_phone || '').trim();
  if (!phone) {
    return { error: 'phone_required' as const, business: null, phone: '', useServiceRole: false };
  }

  return { error: null, business, phone, useServiceRole: isAdmin && !isContractor };
}

/**
 * GET /api/projobs
 * Public list of jobs posted by contractors with an active business.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('pro_jobs')
      .select(JOB_SELECT)
      .eq('businesses.is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Could not load jobs' }, { status: 500 });
    }

    const jobs = ((data ?? []) as unknown as JobRow[])
      .map((row) => toProJob(row, user?.id ?? null))
      .filter((job): job is ProJob => job != null);

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('GET /api/projobs', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/projobs
 * Create a job. Admin or contractor only, plus an active business the user owns and a business phone.
 * Company name and phone come from that business, not from the request body.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'contractor_required' }, { status: 401 });
    }

    const admin = isAdminEmail(user.email);
    const gate = await contractorBusiness(user.id, admin);
    if (gate.error || !gate.business) {
      const status = gate.error === 'contractor_required' ? 403 : 400;
      return NextResponse.json({ error: gate.error }, { status });
    }

    const body = await request.json().catch(() => null);
    const parsed = proJobWriteSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid job';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const input = parsed.data;
    const pay = input.pay?.trim() ? input.pay.trim() : null;
    const writer = gate.useServiceRole ? createServiceRoleClient() : supabase;

    const { data, error } = await writer
      .from('pro_jobs')
      .insert({
        owner_id: user.id,
        business_id: gate.business.id,
        title: input.title,
        description: input.description,
        category: input.category,
        employment_type: input.employmentType,
        workplace_type: input.workplaceType,
        workplace_language: input.workplaceLanguage,
        city: input.city,
        state: input.state,
        pay,
      })
      .select(JOB_SELECT)
      .single();

    if (error || !data) {
      console.error('POST /api/projobs insert', error);
      return NextResponse.json({ error: 'Could not post job' }, { status: 403 });
    }

    const job = toProJob(data as unknown as JobRow, user.id);
    if (!job) {
      return NextResponse.json({ error: 'Could not post job' }, { status: 500 });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    console.error('POST /api/projobs', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
