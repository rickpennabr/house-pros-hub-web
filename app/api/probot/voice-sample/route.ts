import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { synthesizeSpeech } from '@/lib/ai/speech';
import { isProbotVoiceId, probotVoice, PROBOT_VOICE_SAMPLE } from '@/lib/ai/voices';

/**
 * GET /api/probot/voice-sample?voice=max&locale=en
 * A short "Hi, I'm Max…" clip for the voice picker. Made once per voice and language, then kept in
 * storage, so the picker does not spend the free TTS quota on every tap.
 */
export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, 'chat');
  if (limited) return limited;

  const voiceParam = request.nextUrl.searchParams.get('voice');
  if (!isProbotVoiceId(voiceParam)) return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
  const localeParam = request.nextUrl.searchParams.get('locale') ?? 'en';
  const locale = localeParam === 'es' || localeParam === 'pt' ? localeParam : 'en';
  const voice = probotVoice(voiceParam);

  const supabase = createServiceRoleClient();
  const path = `voice-samples/v1-${voice.id}-${locale}.wav`;
  const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);

  const cached = await fetch(publicUrl, { method: 'HEAD' }).catch(() => null);
  if (cached?.ok) return NextResponse.redirect(publicUrl, { status: 302 });

  const audio = await synthesizeSpeech(PROBOT_VOICE_SAMPLE[locale].replace('{name}', voice.name), locale, voice.id);
  if (!audio) return NextResponse.json({ error: 'Voice samples are busy. Try again in a minute.' }, { status: 503 });
  await supabase.storage.from('chat-attachments').upload(path, audio, { contentType: 'audio/wav', upsert: true }).catch(() => null);
  return new NextResponse(new Uint8Array(audio), {
    status: 200,
    headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=86400' },
  });
}
