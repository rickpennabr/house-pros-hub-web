/**
 * ProBot daily limit per chat account, so one heavy user (or a script) cannot burn the free AI tier.
 * Counted from the hub messages already saved today (UTC): no extra table. Server only.
 *
 * PROBOT_DAILY_TURNS (default 60): ProBot answers per day.
 * PROBOT_DAILY_VOICE (default 20): voice notes ProBot listens to and answers by voice per day.
 */
import type { createServiceRoleClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceRoleClient>;

export type ProbotLimit = 'turns' | 'voice';

function envNumber(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function probotDailyLimits() {
  return { turns: envNumber('PROBOT_DAILY_TURNS', 60), voice: envNumber('PROBOT_DAILY_VOICE', 20) };
}

/** Which limit today's messages (including the one just sent) went over, if any. */
/** `limits` comes from the person's plan (lib/billing/probot-tiers.ts); without it, the env defaults. */
export async function probotLimitReached(
  supabase: Service,
  conversationId: string,
  voiceTurn: boolean,
  planLimits?: { turns: number; voice: number }
): Promise<ProbotLimit | undefined> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('probot_messages')
    .select('attachments')
    .eq('conversation_id', conversationId)
    .eq('sender', 'visitor')
    .is('business_id', null)
    .gte('created_at', start.toISOString())
    .limit(1000);
  if (error) return undefined;
  const rows = (data ?? []) as { attachments?: unknown }[];
  const limits = planLimits ?? probotDailyLimits();
  if (rows.length > limits.turns) return 'turns';
  if (voiceTurn) {
    const voices = rows.filter(
      (row) => Array.isArray(row.attachments) && row.attachments.some((att) => (att as { name?: string })?.name?.startsWith('voice-note'))
    ).length;
    if (voices > limits.voice) return 'voice';
  }
  return undefined;
}

/** Added after the limit message on the Free plan. */
export const UPGRADE_COPY: Record<'en' | 'es' | 'pt', string> = {
  en: 'Want more? Pro gives ProBot 300 answers and 60 voice replies a day, plus ProBot Smart. See plans on the Subscription page.',
  es: '¿Quieres más? Pro le da a ProBot 300 respuestas y 60 respuestas de voz al día, más ProBot Smart. Mira los planes en Suscripción.',
  pt: 'Quer mais? O Pro dá ao ProBot 300 respostas e 60 respostas por voz por dia, além do ProBot Smart. Veja os planos em Assinatura.',
};

export const LIMIT_COPY: Record<'en' | 'es' | 'pt', Record<ProbotLimit, string>> = {
  en: {
    turns: "You've reached today's ProBot limit. I'll be ready again tomorrow. You can still message any pro from your contacts.",
    voice: "You've used today's voice replies. Please type your question and I'll answer in text.",
  },
  es: {
    turns: 'Llegaste al límite de ProBot por hoy. Mañana estaré listo otra vez. Puedes escribirle a cualquier pro de tus contactos.',
    voice: 'Ya usaste las respuestas de voz de hoy. Escribe tu pregunta y te respondo por texto.',
  },
  pt: {
    turns: 'Você chegou ao limite do ProBot por hoje. Amanhã estarei pronto de novo. Você ainda pode falar com qualquer profissional dos seus contatos.',
    voice: 'Você já usou as respostas por voz de hoje. Digite sua pergunta e eu respondo por texto.',
  },
};
