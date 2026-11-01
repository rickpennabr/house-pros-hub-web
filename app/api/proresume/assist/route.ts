import { NextRequest, NextResponse } from 'next/server';
import { requireInstaller } from '@/lib/resume/access';
import { draftResumeWithModel } from '@/lib/resume/draft-resume';
import { parseProResume } from '@/lib/resume/pro-resume';

/**
 * POST /api/proresume/assist
 * The installer and the assistant edit one ProResume together.
 * The result stays a draft until the installer saves.
 */
export async function POST(request: NextRequest) {
  const gate = await requireInstaller();
  if (gate.error) return gate.error;
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (message.length < 2) {
    return NextResponse.json({ error: 'Tell the assistant what to add or change.' }, { status: 400 });
  }
  const current = parseProResume(body?.resume);
  const draft = await draftResumeWithModel(message, current);
  return NextResponse.json({ resume: draft.resume, reply: draft.reply });
}
