import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireInstaller } from '@/lib/resume/access';
import { parseProResume, proResumeReady, type ProResume } from '@/lib/resume/pro-resume';
import type { Json } from '@/lib/types/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function savedResume(userId: string): Promise<ProResume | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('pro_resumes')
    .select('full_name, headline, email, phone, city, state, summary, skills, experience, education')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return parseProResume({
    fullName: data.full_name,
    headline: data.headline,
    email: data.email,
    phone: data.phone,
    city: data.city,
    state: data.state,
    summary: data.summary,
    skills: data.skills,
    experience: data.experience,
    education: data.education,
  });
}

/**
 * GET /api/projobs/[id]/apply
 * Whether this installer already applied, and whether their saved ProResume is ready.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const gate = await requireInstaller();
  if (gate.error || !gate.user || !gate.supabase) return gate.error;
  const resume = await savedResume(gate.user.id);
  const { data: existing } = await gate.supabase
    .from('pro_job_applications')
    .select('id')
    .eq('job_id', id)
    .eq('installer_id', gate.user.id)
    .maybeSingle();
  return NextResponse.json({
    applied: Boolean(existing),
    ready: resume != null && proResumeReady(resume),
  });
}

/**
 * POST /api/projobs/[id]/apply
 * Easy Apply stores a snapshot of the installer's saved ProResume on the job.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const gate = await requireInstaller();
  if (gate.error || !gate.user || !gate.supabase) return gate.error;

  const { data: job } = await gate.supabase.from('pro_jobs').select('id').eq('id', id).maybeSingle();
  if (!job) return NextResponse.json({ error: 'job_missing' }, { status: 404 });

  const resume = await savedResume(gate.user.id);
  if (!resume || !proResumeReady(resume)) {
    return NextResponse.json({ error: 'resume_incomplete' }, { status: 400 });
  }

  const { data: existing } = await gate.supabase
    .from('pro_job_applications')
    .select('id')
    .eq('job_id', id)
    .eq('installer_id', gate.user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'already_applied', applicationId: existing.id }, { status: 409 });

  const { data, error } = await gate.supabase
    .from('pro_job_applications')
    .insert({
      job_id: id,
      installer_id: gate.user.id,
      snapshot: resume as unknown as Json,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('POST apply', error);
    return NextResponse.json({ error: 'Could not apply' }, { status: 403 });
  }
  return NextResponse.json({ applicationId: data.id }, { status: 201 });
}
