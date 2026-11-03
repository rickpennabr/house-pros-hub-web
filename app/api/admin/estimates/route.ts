import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

export interface AdminEstimateRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  project_type: string;
  source: string;
  created_at: string;
}

/**
 * GET /api/admin/estimates
 * Site-wide estimate requests. This is the admin inbox, not a pro CRM list.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const service = createServiceRoleClient();
    const { data, error } = await service
      .from('estimates')
      .select('id, first_name, last_name, email, phone, street_address, apartment, city, state, zip_code, latitude, longitude, project_type, source, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch estimates' }, { status: 500 });
    }

    const estimates: AdminEstimateRow[] = (data || []).map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      email: row.email,
      phone: row.phone,
      location: [row.city, row.state].filter(Boolean).join(', '),
      address: [row.street_address, row.apartment, row.city, row.state, row.zip_code].filter(Boolean).join(', '),
      latitude: row.latitude,
      longitude: row.longitude,
      project_type: row.project_type.replaceAll('_', ' '),
      source: row.source,
      created_at: row.created_at,
    }));

    return NextResponse.json({ estimates });
  } catch (error) {
    console.error('GET /api/admin/estimates', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
