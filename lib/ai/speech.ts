/**
 * ProBot's voice: turns a reply into a natural spoken voice note with Gemini text-to-speech
 * (free tier), saved as a WAV in the chat-attachments bucket. Server only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatAttachment } from '@/lib/types/chat';
import { probotVoice, type ProbotVoice } from '@/lib/ai/voices';

const env = (key: string) => process.env[key]?.trim() || '';

/** Gemini returns raw 16-bit mono PCM at 24 kHz. */
const SAMPLE_RATE = 24000;

/**
 * Robot voice effect on 16-bit mono PCM: ring modulation (the classic metallic buzz) plus a short
 * comb echo (the "tin can" ring). Keeps state between chunks so streamed audio has no clicks.
 */
export function createRobotizer(): (pcm: Buffer) => Buffer {
  const RING_HZ = 52;
  const DELAY = Math.round(SAMPLE_RATE * 0.0045);
  const history = new Float32Array(DELAY);
  let at = 0;
  let n = 0;
  return (pcm) => {
    const out = Buffer.alloc(pcm.length);
    for (let i = 0; i + 1 < pcm.length; i += 2) {
      const dry = pcm.readInt16LE(i) / 32768;
      const ring = dry * Math.sin((2 * Math.PI * RING_HZ * n) / SAMPLE_RATE);
      const wet = 0.45 * dry + 0.75 * ring;
      const comb = wet + 0.45 * history[at];
      history[at] = comb;
      at = (at + 1) % DELAY;
      n += 1;
      const sample = Math.max(-1, Math.min(1, comb * 0.9));
      out.writeInt16LE(Math.round(sample * 32767), i);
    }
    return out;
  };
}

/** The voice for this request: the person's pick, else PROBOT_TTS_VOICE (a Gemini name), else Max. */
function resolveVoice(voiceId?: string | null): ProbotVoice {
  if (voiceId) return probotVoice(voiceId);
  const forced = env('PROBOT_TTS_VOICE');
  const base = probotVoice(null);
  return forced ? { ...base, gemini: forced } : base;
}

/** Plain words to say: no markdown marks, links or emoji. Cut on a sentence so speech stays short. */
export function speakableText(raw: string, max = 420): string {
  const clean = raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>~]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'), cut.lastIndexOf('!'));
  return (stop > 40 ? cut.slice(0, stop + 1) : cut).trim();
}

function wav(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const STYLE: Record<string, string> = {
  en: 'Say this like a friendly, upbeat office manager on the phone, natural pace',
  es: 'Dilo como una asistente de oficina amable y alegre al teléfono, ritmo natural',
  pt: 'Diga isso como uma assistente de escritório simpática e animada ao telefone, ritmo natural',
};

interface SpeechPart {
  inlineData?: { data?: string };
  inline_data?: { data?: string };
}

function pcmFromResponse(data: { candidates?: { content?: { parts?: SpeechPart[] } }[] }): Buffer | null {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const chunks = parts
    .map((part) => part.inlineData?.data || part.inline_data?.data || '')
    .filter(Boolean);
  if (chunks.length === 0) return null;
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk, 'base64')));
}

function speechBody(words: string, locale: string | undefined, voice: ProbotVoice) {
  // The voice's own style in English; Spanish and Portuguese keep their style line unless it is the robot.
  const style = !locale || locale === 'en' || voice.robot ? voice.style : STYLE[locale] ?? voice.style;
  return {
    contents: [{ role: 'user', parts: [{ text: `${style}:\n${words}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.gemini } } },
    },
  };
}

function ttsModels(): string[] {
  return [...new Set([env('PROBOT_TTS_MODEL') || 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'])];
}

/**
 * Stream 16-bit PCM as Gemini produces it. Returns the full clip, or null when streaming is unavailable.
 * `onChunk` receives even-length pieces so playback can start before the clip is finished.
 */
async function streamSpeechPcm(text: string, locale: string | undefined, rawOnChunk: (pcm: Buffer) => void, voice: ProbotVoice): Promise<Buffer | null> {
  const key = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  const words = speakableText(text);
  if (!key || !words) return null;
  for (const model of ttsModels()) {
    // Fresh effect state per try, so a failed model leaves no echo behind.
    const fx = voice.robot ? createRobotizer() : null;
    const onChunk = rawOnChunk;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(speechBody(words, locale, voice)),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!response.ok || !response.body) {
        console.error('streamSpeech', model, response.status, (await response.text()).slice(0, 200));
        continue;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        const data = (await response.json()) as { candidates?: { content?: { parts?: SpeechPart[] } }[] } | { candidates?: { content?: { parts?: SpeechPart[] } }[] }[];
        const list = Array.isArray(data) ? data : [data];
        const parts: Buffer[] = [];
        let pending = Buffer.alloc(0);
        for (const item of list) {
          const pcm = pcmFromResponse(item);
          if (!pcm?.length) continue;
          const joined = pending.length ? Buffer.concat([pending, pcm]) : pcm;
          const even = joined.length - (joined.length % 2);
          pending = Buffer.from(joined.subarray(even));
          if (even < 2) continue;
          const chunk = fx ? fx(Buffer.from(joined.subarray(0, even))) : Buffer.from(joined.subarray(0, even));
          parts.push(chunk);
          onChunk(chunk);
        }
        if (parts.length > 0) return Buffer.concat(parts);
        continue;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const parts: Buffer[] = [];
      let pending = Buffer.alloc(0);
      const take = (raw: Buffer) => {
        if (raw.length === 0) return;
        const joined = pending.length ? Buffer.concat([pending, raw]) : raw;
        const even = joined.length - (joined.length % 2);
        pending = Buffer.from(joined.subarray(even));
        if (even < 2) return;
        const chunk = fx ? fx(Buffer.from(joined.subarray(0, even))) : Buffer.from(joined.subarray(0, even));
        parts.push(chunk);
        onChunk(chunk);
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const pcm = pcmFromResponse(JSON.parse(payload) as { candidates?: { content?: { parts?: SpeechPart[] } }[] });
            if (pcm) take(pcm);
          } catch {
            // A split SSE line is finished on the next read.
          }
        }
      }
      if (parts.length > 0) return Buffer.concat(parts);
    } catch (error) {
      console.error('streamSpeech', model, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

/** The reply as WAV audio, or null when TTS is not set up or fails. */
export async function synthesizeSpeech(text: string, locale?: string, voiceId?: string | null): Promise<Buffer | null> {
  const voice = resolveVoice(voiceId);
  const key = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  const words = speakableText(text);
  if (!key || !words) return null;
  for (const model of ttsModels()) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(speechBody(words, locale, voice)),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (!response.ok) {
        console.error('synthesizeSpeech', model, response.status, (await response.text()).slice(0, 200));
        continue;
      }
      const pcm = pcmFromResponse((await response.json()) as { candidates?: { content?: { parts?: SpeechPart[] } }[] });
      if (pcm?.length) return wav(voice.robot ? createRobotizer()(pcm) : pcm);
    } catch (error) {
      console.error('synthesizeSpeech', model, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

/**
 * Speak the reply and save it as a voice note on ProBot's message.
 * When `onPcm` is set, 16-bit 24 kHz chunks are handed over as they arrive so playback
 * can start before the WAV is stored. Returns the saved attachment, or null.
 */
export async function attachSpokenReply(
  supabase: SupabaseClient,
  message: { id: string; conversationId: string; body: string },
  locale?: string,
  onPcm?: (base64: string) => void,
  voiceId?: string | null
): Promise<ChatAttachment | null> {
  const voice = resolveVoice(voiceId);
  const started = Date.now();
  let audio: Buffer | null = null;
  let loggedFirst = false;
  const pcm = await streamSpeechPcm(message.body, locale, (chunk) => {
    if (!loggedFirst) {
      loggedFirst = true;
      console.info(`[probot-voice] first-audio ${Date.now() - started}ms`);
    }
    onPcm?.(chunk.toString('base64'));
  }, voice);
  if (pcm?.length) audio = wav(pcm);
  if (!audio) {
    audio = await synthesizeSpeech(message.body, locale, voiceId);
    if (audio && onPcm && audio.length > 44) onPcm(audio.subarray(44).toString('base64'));
  }
  if (!audio) return null;
  console.info(`[probot-voice] tts ${Date.now() - started}ms`);
  const path = `${message.conversationId}/voice-note-probot-${Date.now()}.wav`;
  const upload = await supabase.storage.from('chat-attachments').upload(path, audio, { contentType: 'audio/wav' });
  if (upload.error) {
    console.error('attachSpokenReply upload', upload.error.message);
    return null;
  }
  const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(upload.data.path);
  const attachment: ChatAttachment = { url: publicUrl, name: 'voice-note-probot.wav', contentType: 'audio/wav' };
  const saved = await supabase.from('probot_messages').update({ attachments: [attachment] }).eq('id', message.id);
  if (saved.error) {
    console.error('attachSpokenReply save', saved.error.message);
    return null;
  }
  return attachment;
}
