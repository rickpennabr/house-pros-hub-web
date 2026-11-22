/**
 * Identify a plant from a photo with a vision model: free Gemini models first, then OpenAI.
 * Server only.
 *
 * Models: PROBOT_AI_VISION_MODEL (Gemini, default gemini-3.5-flash), then
 * PROBOT_AI_VISION_FALLBACK_MODELS (free Gemini, default gemini-3.5-flash-lite,gemini-3.1-flash-lite),
 * then PROBOT_AI_OPENAI_VISION_MODEL (paid, default gpt-4o-mini).
 */

import {
  activePlantCorrections,
  correctionNote,
  samePlantName,
  type PlantCorrection,
} from '@/lib/ai/plant-corrections';

export type PlantConfidence = 'high' | 'medium' | 'low';

export interface PlantIdentification {
  /** False when the photo shows no plant (a wall, a pet, a blurry frame). */
  isPlant: boolean;
  commonName: string;
  scientificName: string;
  otherNames: string[];
  confidence: PlantConfidence;
  /** One or two sentences: what it is and how to recognize it. */
  summary: string;
  care: { sun: string; water: string; pruning: string; notes: string };
  /** Close look-alikes when the model is not sure, each with how to tell it apart. */
  alternatives: { commonName: string; scientificName: string; howToTell?: string }[];
  /** What to look at to confirm (when confidence is not high), e.g. "Are the leaves opposite?". */
  checks?: string[];
  /** Which model answered, for support. */
  model: string;
}

interface VisionEndpoint {
  name: 'gemini' | 'openai';
  baseUrl: string;
  apiKey: string;
  model: string;
}

const env = (key: string) => process.env[key]?.trim() || '';

/**
 * Free-tier Gemini models tried after the main one. Each model has its own free quota, so when one
 * is rate-limited or down the next still answers. Override with PROBOT_AI_VISION_FALLBACK_MODELS
 * (comma-separated). All three named the same shrub as the main model in testing (Nov 2026).
 */
const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

function visionEndpoints(): VisionEndpoint[] {
  const list: VisionEndpoint[] = [];
  const geminiKey = env('GEMINI_API_KEY') || env('GOOGLE_GENERATIVE_AI_API_KEY');
  if (geminiKey) {
    const main = env('PROBOT_AI_VISION_MODEL') || 'gemini-3.5-flash';
    const fallbacks = env('PROBOT_AI_VISION_FALLBACK_MODELS')
      ? env('PROBOT_AI_VISION_FALLBACK_MODELS').split(',').map((model) => model.trim()).filter(Boolean)
      : GEMINI_FALLBACK_MODELS;
    for (const model of [main, ...fallbacks.filter((model) => model !== main)]) {
      list.push({
        name: 'gemini',
        apiKey: geminiKey,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model,
      });
    }
  }
  // Paid, last: used only when every free model failed (and only while the account has credits).
  const openaiKey = env('OPENAI_API_KEY');
  if (openaiKey) {
    list.push({
      name: 'openai',
      apiKey: openaiKey,
      baseUrl: 'https://api.openai.com/v1',
      model: env('PROBOT_AI_OPENAI_VISION_MODEL') || 'gpt-4o-mini',
    });
  }
  return list;
}

export function plantIdConfigured(): boolean {
  return visionEndpoints().length > 0;
}

const LANGUAGE: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Brazilian Portuguese' };

function instructions(locale: string, hint: string, corrections: PlantCorrection[]): string {
  const language = LANGUAGE[locale] ?? 'English';
  return [
    'You identify plants for landscaping and maintenance crews, mostly in the US Southwest desert (Las Vegas, Phoenix).',
    'Look at the photo and name the plant as precisely as the photo allows (species, or genus when the species is unclear).',
    'Prefer plants used in desert landscaping when the photo fits several. Look closely at leaf shape, arrangement, hairs, color and stems before you decide.',
    corrections.length > 0
      ? `Our team corrected earlier identifications. They are right; apply them whenever the photo fits:\n${corrections.map(correctionNote).join('\n')}`
      : '',
    hint ? `The crew adds: "${hint.slice(0, 300)}"` : '',
    `Write every text field in ${language}. Keep scientific names in Latin.`,
    'Answer with JSON only, no markdown, in exactly this shape:',
    '{"isPlant":true,"commonName":"","scientificName":"","otherNames":[],"confidence":"high|medium|low",',
    '"summary":"","care":{"sun":"","water":"","pruning":"","notes":""},',
    '"alternatives":[{"commonName":"","scientificName":"","howToTell":""}],"checks":[]}',
    'Rules: summary is one or two short sentences. Care fields are one short sentence each, practical for a crew',
    '(e.g. "Full sun; tolerates reflected heat."). Unless confidence is "high", list up to 3 look-alike alternatives,',
    'each with howToTell (one short sentence on how it differs), and up to 3 checks: short questions about what to look',
    'at to confirm (e.g. "Are the leaves alternate or opposite?"). With high confidence, alternatives and checks may be empty.',
    'If there is no plant in the photo, set isPlant false and leave the other fields empty.',
  ]
    .filter(Boolean)
    .join('\n');
}

const str = (value: unknown, max = 300) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** Read the model's JSON, tolerating code fences or text around it. */
export function parsePlantReply(raw: string, model: string): PlantIdentification | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const care = (data.care ?? {}) as Record<string, unknown>;
  const confidence = data.confidence === 'high' || data.confidence === 'medium' ? data.confidence : 'low';
  const isPlant = data.isPlant !== false && Boolean(str(data.commonName) || str(data.scientificName));
  return {
    isPlant,
    commonName: str(data.commonName, 120),
    scientificName: str(data.scientificName, 120),
    otherNames: Array.isArray(data.otherNames) ? data.otherNames.map((name) => str(name, 80)).filter(Boolean).slice(0, 5) : [],
    confidence,
    summary: str(data.summary, 400),
    care: { sun: str(care.sun), water: str(care.water), pruning: str(care.pruning), notes: str(care.notes) },
    alternatives: Array.isArray(data.alternatives)
      ? data.alternatives
          .map((row) => {
            const item = (row ?? {}) as Record<string, unknown>;
            return {
              commonName: str(item.commonName, 120),
              scientificName: str(item.scientificName, 120),
              howToTell: str(item.howToTell, 240),
            };
          })
          .filter((row) => row.commonName || row.scientificName)
          .slice(0, 3)
      : [],
    checks: Array.isArray(data.checks) ? data.checks.map((check) => str(check, 200)).filter(Boolean).slice(0, 3) : [],
    model,
  };
}

type Content = Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

/** Ask the endpoints in order until one returns usable JSON. */
async function ask(endpoints: VisionEndpoint[], system: string, content: Content, errors: string[]) {
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${endpoint.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: endpoint.model,
          temperature: 0.2,
          // Thinking models spend tokens before answering: leave room and keep the thinking short.
          max_tokens: 4000,
          ...(endpoint.name === 'gemini' ? { reasoning_effort: 'low' } : {}),
          messages: [
            { role: 'system', content: system },
            { role: 'user', content },
          ],
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) {
        errors.push(`${endpoint.name}:${endpoint.model} ${response.status} ${(await response.text().catch(() => '')).slice(0, 160)}`);
        continue;
      }
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const reply = json.choices?.[0]?.message?.content;
      const parsed = parsePlantReply(typeof reply === 'string' ? reply : '', `${endpoint.name}:${endpoint.model}`);
      if (parsed) return parsed;
      errors.push(`${endpoint.name}:${endpoint.model} returned no JSON`);
    } catch (error) {
      errors.push(`${endpoint.name}:${endpoint.model} ${error instanceof Error ? error.message : 'failed'}`);
    }
  }
  return null;
}

/** Corrections that concern this answer: it named a corrected plant, or one of its look-alikes. */
function relevantCorrections(result: PlantIdentification, corrections: PlantCorrection[]): PlantCorrection[] {
  const names = [
    result.commonName,
    result.scientificName,
    ...result.otherNames,
    ...result.alternatives.flatMap((alt) => [alt.commonName, alt.scientificName]),
  ];
  return corrections.filter((correction) =>
    [correction.wrongCommonName, correction.wrongScientificName, correction.correctCommonName, correction.correctScientificName].some(
      (name) => names.some((other) => samePlantName(name, other))
    )
  );
}

/** While there are this few corrections, all their photos go with every identification (one pass). */
const ALWAYS_SEND_REFERENCES = 6;
/** With more corrections, at most this many photos go, chosen by name in a second pass. */
const MAX_REFERENCE_PHOTOS = 3;

/** Reference photos rarely change: keep them in memory (by URL) instead of downloading each time. */
const photoCache = new Map<string, string>();
const PHOTO_CACHE_LIMIT = 40;

async function photoDataUrl(url: string): Promise<string | null> {
  const cached = photoCache.get(url);
  if (cached) return cached;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const type = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) return null;
    const dataUrl = `data:${type};base64,${bytes.toString('base64')}`;
    if (photoCache.size >= PHOTO_CACHE_LIMIT) photoCache.delete(photoCache.keys().next().value as string);
    photoCache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/** The question with labeled reference photos first, then the photo to identify. */
async function contentWithReferences(dataUrl: string, corrections: PlantCorrection[]): Promise<Content | null> {
  const references = (
    await Promise.all(corrections.map(async (correction) => ({ correction, url: await photoDataUrl(correction.photoUrl) })))
  ).filter((row): row is { correction: PlantCorrection; url: string } => Boolean(row.url));
  if (references.length === 0) return null;
  const content: Content = [
    { type: 'text', text: 'Reference photos our team identified correctly. Compare the last photo with them.' },
  ];
  references.forEach(({ correction, url }, index) => {
    content.push({ type: 'image_url', image_url: { url } });
    content.push({ type: 'text', text: `Reference ${index + 1} ${correctionNote(correction).slice(2)}` });
  });
  content.push({
    type: 'text',
    text: 'Now: what plant is in this last photo? If it is the same plant as a reference, use that reference name. Otherwise identify it on its own.',
  });
  content.push({ type: 'image_url', image_url: { url: dataUrl } });
  return content;
}

/**
 * Identify the plant in an image (JPEG, PNG or WebP bytes). Throws when no model could answer.
 * Admin corrections (ai_plant_corrections) go in the instructions. While there are a few, their
 * photos go along as labeled references in the same request; with many, they go in a second
 * look only when the first answer names a corrected plant.
 */
export async function identifyPlant(input: {
  image: Buffer;
  mimeType: string;
  locale?: string;
  /** Optional words from the user, e.g. "front yard, about 6 ft tall". */
  hint?: string;
}): Promise<PlantIdentification> {
  return identifyPlantWith(input, await activePlantCorrections());
}

/** identifyPlant with the corrections given (tests and scripts can pass their own). */
export async function identifyPlantWith(
  input: { image: Buffer; mimeType: string; locale?: string; hint?: string },
  corrections: PlantCorrection[]
): Promise<PlantIdentification> {
  const endpoints = visionEndpoints();
  if (endpoints.length === 0) throw new Error('Plant ID is not set up (no AI key).');
  const dataUrl = `data:${input.mimeType};base64,${input.image.toString('base64')}`;
  const locale = input.locale === 'es' || input.locale === 'pt' ? input.locale : 'en';
  const system = instructions(locale, input.hint ?? '', corrections);
  const errors: string[] = [];
  const plain: Content = [
    { type: 'text', text: 'What plant is this?' },
    { type: 'image_url', image_url: { url: dataUrl } },
  ];

  const sendAll = corrections.length > 0 && corrections.length <= ALWAYS_SEND_REFERENCES;
  const firstContent = (sendAll && (await contentWithReferences(dataUrl, corrections))) || plain;
  const first = await ask(endpoints, system, firstContent, errors);
  if (!first) {
    console.error('identifyPlant', errors.join(' | '));
    throw new Error('Could not identify the plant right now. Try again in a moment.');
  }
  if (!first.isPlant || sendAll) return first;

  const relevant = relevantCorrections(first, corrections).slice(0, MAX_REFERENCE_PHOTOS);
  const content = relevant.length > 0 ? await contentWithReferences(dataUrl, relevant) : null;
  if (!content) return first;
  const second = await ask(endpoints, system, content, errors);
  if (!second) console.error('identifyPlant reference pass', errors.join(' | '));
  return second?.isPlant ? second : first;
}
