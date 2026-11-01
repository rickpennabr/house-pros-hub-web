import { NextRequest, NextResponse } from 'next/server';
import { requireInstaller } from '@/lib/resume/access';
import { draftResumeWithModel } from '@/lib/resume/draft-resume';
import { ResumeFileError, textFromResumeFile } from '@/lib/resume/extract-resume-text';
import { emptyProResume, parseProResume } from '@/lib/resume/pro-resume';

/**
 * POST /api/proresume/import
 * Read an uploaded PDF or text résumé and turn it into a ProResume draft.
 * The installer reviews it before saving.
 */
export async function POST(request: NextRequest) {
  const gate = await requireInstaller();
  if (gate.error) return gate.error;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a résumé file.' }, { status: 400 });
    }
    const text = await textFromResumeFile(file);
    const current = parseProResume(form.get('resume') ? JSON.parse(String(form.get('resume'))) : emptyProResume());
    const draft = await draftResumeWithModel(
      `Extract a ProResume from this résumé text. Do not invent anything that is not in the text.\n\n${text}`,
      current.fullName ? current : emptyProResume()
    );
    return NextResponse.json({ resume: draft.resume, reply: draft.reply });
  } catch (error) {
    if (error instanceof ResumeFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/proresume/import', error);
    return NextResponse.json({ error: 'Could not read that résumé.' }, { status: 500 });
  }
}
