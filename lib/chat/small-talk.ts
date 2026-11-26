/**
 * Small talk ("hi", "thanks", "ok", "how are you"): ProBot answers it without tools, the job
 * playbook or the place summary, so the turn costs a fraction of a full one.
 */
const PHRASES = [
  // English
  'hi', 'hello', 'hey', 'yo', 'thanks', 'thank you', 'thank you so much', 'thx', 'ty', 'ok', 'okay', 'k', 'cool',
  'great', 'nice', 'awesome', 'perfect', 'got it', 'sounds good', 'bye', 'goodbye', 'see you', 'good morning',
  'good afternoon', 'good evening', 'good night', 'how are you', 'how are you doing', 'whats up', 'sup', 'yes', 'no',
  'sure', 'lol', 'haha',
  // Spanish
  'hola', 'gracias', 'muchas gracias', 'vale', 'listo', 'perfecto', 'adios', 'buenos dias', 'buenas tardes',
  'buenas noches', 'como estas', 'que tal', 'si', 'claro', 'genial',
  // Portuguese
  'oi', 'ola', 'obrigado', 'obrigada', 'muito obrigado', 'muito obrigada', 'valeu', 'beleza', 'tchau', 'bom dia',
  'boa tarde', 'boa noite', 'tudo bem', 'tudo bom', 'como vai', 'sim', 'nao', 'show', 'otimo',
];

const SET = new Set(PHRASES);

function plain(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True for a short greeting, thanks or acknowledgement, optionally with "ProBot" or a first name. */
export function isSmallTalk(body: string, firstName?: string): boolean {
  const text = plain(body);
  if (!text) return false;
  if (text.length > 40) return false;
  const name = plain(firstName ?? '');
  // Drop "probot" and the person's own name, then the rest must be one or two known phrases.
  const words = text.split(' ').filter((word) => word !== 'probot' && word !== 'bot' && (!name || word !== name));
  const rest = words.join(' ');
  if (!rest) return true;
  if (SET.has(rest)) return true;
  for (let i = 1; i < words.length; i += 1) {
    if (SET.has(words.slice(0, i).join(' ')) && SET.has(words.slice(i).join(' '))) return true;
  }
  return false;
}
