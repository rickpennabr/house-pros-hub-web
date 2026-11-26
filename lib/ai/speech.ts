/**
 * ProBot's voice: turns a reply into a natural spoken voice note with Gemini text-to-speech
 * (free tier), saved as a WAV in the chat-attachments bucket. Server only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatAttachment } from '@/lib/types/chat';

const env = (key: string) => process.env[key]?.trim() || '';

/** Gemini returns raw 16-bit mono PCM at 24 kHz. */
const SAMPLE_RATE = 24000;

/** Warm, clear voice. Change with PROBOT_TTS_VOICE (e.g. Kore, Aoede, Puck, Charon, Sulafat). */
const DEFAULT_VOICE = 'Sulafat';

/** Plain words to say: no markdown marks, links or emoji. */
export function speakableText(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>~]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, 1500);
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

/** The reply as WAV audio, or null when TTS is not set up or fails. */
export async function synthesizeSpeech(text: string, locale?: string): Promise<Buffer | null> {
  const key = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  const words = speakableText(text);
  if (!key || !words) return null;
  const style = STYLE[locale ?? 'en'] ?? STYLE.en;
  const models = [env('PROBOT_TTS_MODEL') || 'gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'];
  for (const model of [...new Set(models)]) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${style}:\n${words}` }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: env('PROBOT_TTS_VOICE') || DEFAULT_VOICE } } },
            },
          }),
          signal: AbortSignal.timeout(30000),
        }
      );
      if (!response.ok) {
        console.error('synthesizeSpeech', model, response.status, (await response.text()).slice(0, 200));
        continue;
      }
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      };
      const b64 = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
      if (b64) return wav(Buffer.from(b64, 'base64'));
    } catch (error) {
      console.error('synthesizeSpeech', model, error instanceof Error ? error.message : error);
    }
  }
  return null;
}

/** Speak the reply and save it as a voice note on ProBot's message. Returns the attachment, or null. */
export async function attachSpokenReply(
  supabase: SupabaseClient,
  message: { id: string; conversationId: string; body: string },
  locale?: string
): Promise<ChatAttachment | null> {
  const audio = await synthesizeSpeech(message.body, locale);
  if (!audio) return null;
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
