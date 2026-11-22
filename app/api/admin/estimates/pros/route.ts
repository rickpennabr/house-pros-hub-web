import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/blog/admin';
import { createServiceRoleClient } from '@/lib/supabase/server';

export interface AdminLeadPro {
  businessId: string;
  name: string;
  logo: string | null;
  trades: string[];
  phone: string | null;
  email: string | null;
  verified: boolean;
}

/**
 * GET /api/admin/estimates/pros?q=
 * Active businesses the admin can send a job request to. Searchable by business name.
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80).replace(/[%_,()\\]/g, ' ');
  const admin = createServiceRoleClient();
  let query = admin
    .from('businesses')
    .select('id, business_name, business_logo, trades, primary_trade, phone, mobile_phone, email, is_verified')
    .eq('is_active', true)
    .order('business_name', { ascending: true })
    .limit(100);
  if (q) query = query.ilike('business_name', `%${q}%`);
  const { data, error: listError } = await query;
  if (listError) return NextResponse.json({ error: 'Could not load pros' }, { status: 500 });

  const pros: AdminLeadPro[] = (data ?? []).map((row) => ({
    businessId: row.id,
    name: row.business_name,
    logo: row.business_logo,
    trades: Array.from(new Set([row.primary_trade, ...(row.trades ?? [])].filter((t): t is string => Boolean(t)))),
    phone: row.mobile_phone || row.phone,
    email: row.email,
    verified: row.is_verified,
  }));
  return NextResponse.json({ pros });
}
