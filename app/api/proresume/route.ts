import { NextRequest, NextResponse } from 'next/server';
import { requireInstaller } from '@/lib/resume/access';
import { emptyProResume, parseProResume, type ProResume } from '@/lib/resume/pro-resume';

interface ResumeRow {
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  summary: string;
  skills: unknown;
  experience: unknown;
  education: unknown;
}

function fromRow(row: ResumeRow): ProResume {
  return parseProResume({
    fullName: row.full_name,
    headline: row.headline,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    summary: row.summary,
    skills: row.skills,
    experience: row.experience,
    education: row.education,
  });
}

function toRow(resume: ProResume) {
  return {
    full_name: resume.fullName,
    headline: resume.headline,
    email: resume.email,
    phone: resume.phone,
    city: resume.city,
    state: resume.state,
    summary: resume.summary,
    skills: resume.skills,
    experience: resume.experience,
    education: resume.education,
    updated_at: new Date().toISOString(),
  };
}

/**
 * GET /api/proresume
 * The signed-in installer's one ProResume.
 */
export async function GET() {
  const gate = await requireInstaller();
  if (gate.error || !gate.user || !gate.supabase) return gate.error;
  const { data, error } = await gate.supabase
    .from('pro_resumes')
    .select('full_name, headline, email, phone, city, state, summary, skills, experience, education')
    .eq('user_id', gate.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load résumé' }, { status: 500 });
  const resume = data ? fromRow(data as ResumeRow) : emptyProResume();
  if (!resume.email && gate.user.email) resume.email = gate.user.email;
  return NextResponse.json({ resume });
}

/**
 * PUT /api/proresume
 * Create or replace the installer's one ProResume.
 */
export async function PUT(request: NextRequest) {
  const gate = await requireInstaller();
  if (gate.error || !gate.user || !gate.supabase) return gate.error;
  const body = await request.json().catch(() => null);
  const resume = parseProResume(body?.resume ?? body);
  const row = toRow(resume);
  const { data: existing, error: readError } = await gate.supabase
    .from('pro_resumes')
    .select('id')
    .eq('user_id', gate.user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not save résumé' }, { status: 500 });
  const write = existing
    ? gate.supabase.from('pro_resumes').update(row).eq('user_id', gate.user.id)
    : gate.supabase.from('pro_resumes').insert({ ...row, user_id: gate.user.id });
  const { error } = await write;
  if (error) return NextResponse.json({ error: 'Could not save résumé' }, { status: 500 });
  return NextResponse.json({ resume });
}
