/**
 * ProBot's voices: friendly names over Gemini's prebuilt TTS voices, picked by each person
 * (like Gemini Live or Grok). Safe for client and server.
 */

export interface ProbotVoice {
  id: string;
  name: string;
  /** One short line shown under the name in the picker. */
  description: string;
  gender: 'male' | 'female' | 'robot';
  /** Gemini prebuilt voice name. */
  gemini: string;
  /** How to say it (the style line sent before the words). */
  style: string;
  /** Run the audio through the robot effect. */
  robot?: boolean;
}

export const PROBOT_VOICES: ProbotVoice[] = [
  {
    id: 'max',
    name: 'Max',
    description: 'Friendly and steady. The ProBot default.',
    gender: 'male',
    gemini: 'Achird',
    style: 'Say this like a friendly, confident office manager on the phone, natural pace',
  },
  {
    id: 'sofia',
    name: 'Sofia',
    description: 'Warm and upbeat.',
    gender: 'female',
    gemini: 'Sulafat',
    style: 'Say this like a friendly, upbeat office manager on the phone, natural pace',
  },
  {
    id: 'jack',
    name: 'Jack',
    description: 'Deep and relaxed, like a foreman.',
    gender: 'male',
    gemini: 'Algenib',
    style: 'Say this like a relaxed, experienced job-site foreman, easygoing pace',
  },
  {
    id: 'luna',
    name: 'Luna',
    description: 'Light and calm.',
    gender: 'female',
    gemini: 'Aoede',
    style: 'Say this in a light, calm and kind way, natural pace',
  },
  {
    id: 'leo',
    name: 'Leo',
    description: 'Energetic and quick.',
    gender: 'male',
    gemini: 'Puck',
    style: 'Say this with energy and a smile, a little quick',
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Clear and to the point.',
    gender: 'female',
    gemini: 'Kore',
    style: 'Say this clearly and confidently, straight to the point',
  },
  {
    id: 'bolt',
    name: 'Bolt',
    description: 'A real robot voice. Beep boop.',
    gender: 'robot',
    gemini: 'Fenrir',
    style: 'Say this like a cheerful robot: even pitch, precise and evenly spaced words, slightly slow',
    robot: true,
  },
];

export const DEFAULT_PROBOT_VOICE = 'max';

export function probotVoice(id: string | null | undefined): ProbotVoice {
  return PROBOT_VOICES.find((voice) => voice.id === id) ?? PROBOT_VOICES.find((voice) => voice.id === DEFAULT_PROBOT_VOICE)!;
}

export function isProbotVoiceId(id: unknown): id is string {
  return typeof id === 'string' && PROBOT_VOICES.some((voice) => voice.id === id);
}

export const PROBOT_VOICE_SAMPLE: Record<string, string> = {
  en: "Hi, I'm {name}. I'll keep an eye on your jobs, invoices and schedule. What can I help with?",
  es: 'Hola, soy {name}. Cuido tus trabajos, facturas y agenda. ¿En qué te ayudo?',
  pt: 'Oi, eu sou {name}. Cuido dos seus serviços, faturas e agenda. Como posso ajudar?',
};
