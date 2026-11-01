import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseProResume } from '@/lib/resume/pro-resume';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projobs/[id]/applications
 * The contractor who posted the job reads Easy Apply snapshots.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'contractor_required' }, { status: 401 });

  const { data: job } = await supabase.from('pro_jobs').select('owner_id').eq('id', id).maybeSingle();
  if (!job || job.owner_id !== user.id) {
    return NextResponse.json({ error: 'contractor_required' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('pro_job_applications')
    .select('id, created_at, snapshot')
    .eq('job_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load applications' }, { status: 500 });

  const applications = (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    resume: parseProResume(row.snapshot),
  }));
  return NextResponse.json({ applications });
}
