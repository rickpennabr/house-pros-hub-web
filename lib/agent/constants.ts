export type AgentLocale = 'en' | 'es' | 'pt';

/** Instruction for the agent. Not copy to read aloud unless the agent is explaining the limit. */
export const AGENT_RULE =
  'House Pros Hub lists pros and accepts estimate requests. It does not set a price, a start date, or promise that a named pro will take the job. Electrical, gas, structural, and roof work must be done by a licensed pro. Show messageForUser to the homeowner unchanged.';

/** Reserved agent_apps.name for estimates filed from the in-site chat. */
export const PROAGENT_APP_NAME = 'ProAgent';

/** Model calls per homeowner message. A write stops the loop earlier. */
export const PROAGENT_MAX_STEPS = 4;

/**
 * In-chat ProAgent policy.
 * Read tools run on the server. create_estimate waits for the homeowner's Confirm tap.
 * A Hub Agent reply sets agent_paused_at and the loop stays off until an admin hands the chat back.
 */
export const PROAGENT_POLICY =
  'ProAgent may list categories, search pros, and read a public profile immediately. Filing an estimate requires the homeowner to tap Confirm. The loop stops after 4 steps. A Hub Agent reply pauses ProAgent until an admin hands the chat back.';

export const ESTIMATE_MESSAGE: Record<AgentLocale, string> = {
  en: 'Request sent to House Pros Hub. A pro will contact the homeowner. This is not a price or a promise that a named pro will take the job.',
  es: 'Solicitud enviada a House Pros Hub. Un profesional contactará al propietario. Esto no es un precio ni una promesa de que un profesional en particular acepte el trabajo.',
  pt: 'Pedido enviado à House Pros Hub. Um profissional vai entrar em contato com o proprietário. Isto não é um preço nem a promessa de que um profissional específico aceite o trabalho.',
};

export function siteOrigin(request?: { nextUrl: { origin: string } }): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (request?.nextUrl?.origin) return request.nextUrl.origin;
  return 'https://houseproshub.com';
}

export function requestLocale(request: { headers: Headers }): AgentLocale {
  const header = (request.headers.get('x-locale') || '').toLowerCase();
  if (header === 'es' || header === 'pt' || header === 'en') return header;
  const accept = (request.headers.get('accept-language') || '').toLowerCase();
  if (accept.startsWith('es')) return 'es';
  if (accept.startsWith('pt')) return 'pt';
  return 'en';
}

export function readIdempotencyKey(request: { headers: Headers }): string | null {
  const raw = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!raw) return null;
  return raw;
}

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function validIdempotencyKey(value: string | null): { key: string | null; error?: string } {
  if (!value) return { key: null };
  if (!IDEMPOTENCY_PATTERN.test(value)) {
    return {
      key: null,
      error: 'Idempotency-Key must be 1-128 characters and use only letters, numbers, and . _ : -',
    };
  }
  return { key: value };
}
