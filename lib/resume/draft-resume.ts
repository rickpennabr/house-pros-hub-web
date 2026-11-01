import { emptyProResume, parseProResume, type ProResume } from '@/lib/resume/pro-resume';

type ProviderName = 'groq' | 'gemini' | 'openai';

interface ChatEndpoint {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
}

function envTrim(key: string): string {
  return process.env[key]?.trim() || '';
}

function endpointFor(name: ProviderName): ChatEndpoint | null {
  if (name === 'groq') {
    const apiKey = envTrim('GROQ_API_KEY');
    if (!apiKey) return null;
    return {
      name,
      apiKey,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: envTrim('PROBOT_AI_GROQ_MODEL') || 'openai/gpt-oss-20b',
    };
  }
  if (name === 'gemini') {
    const apiKey = envTrim('GEMINI_API_KEY') || envTrim('GOOGLE_GENERATIVE_AI_API_KEY');
    if (!apiKey) return null;
    return {
      name,
      apiKey,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: envTrim('PROBOT_AI_GEMINI_MODEL') || 'gemini-3.5-flash-lite',
    };
  }
  const apiKey = envTrim('OPENAI_API_KEY');
  if (!apiKey) return null;
  return {
    name,
    apiKey,
    baseUrl: 'https://api.openai.com/v1',
    model: envTrim('PROBOT_AI_OPENAI_MODEL') || 'gpt-4o-mini',
  };
}

function endpoints(): ChatEndpoint[] {
  const preferred = envTrim('PROBOT_AI_PROVIDER').toLowerCase();
  const names: ProviderName[] = [];
  if (preferred === 'groq' || preferred === 'gemini' || preferred === 'openai') names.push(preferred);
  for (const name of ['gemini', 'groq', 'openai'] as const) {
    if (!names.includes(name)) names.push(name);
  }
  return names.flatMap((name) => {
    const endpoint = endpointFor(name);
    return endpoint ? [endpoint] : [];
  });
}

const SYSTEM = `You help an installer build one ProResume for House Pros Hub.
Return only JSON: {"reply":"short note to the installer","resume":{...}}
The resume object uses these fields:
fullName, headline, email, phone, city, state (2 letters or empty), summary,
skills (string array),
experience (array of {id, title, company, city, startDate, endDate, current, description}),
education (array of {id, school, credential, endDate}).
Rules:
- Keep facts the installer already saved unless they asked to change or remove them.
- Add a job, school, or skill only when the installer stated it in this message or it is already in the résumé.
- Do not invent employers, dates, licenses, or contact details.
- You may rewrite the headline and summary from facts already present.
- Keep the installer's language.
- Dates may be YYYY-MM or a year. Use an empty string when unknown.
- Keep existing ids. New entries need a new id string.
- Strip social security numbers and any national ID.`;

function stripIds(text: string): string {
  return text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '');
}

function parseModelJson(raw: string): { reply: string; resume: ProResume } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(trimmed) as { reply?: unknown; resume?: unknown };
    const resume = parseProResume(parsed.resume);
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 600) : '';
    if (!reply && !resume.fullName && resume.experience.length === 0 && resume.skills.length === 0) return null;
    return { reply: reply || 'Review the résumé and save when it looks right.', resume };
  } catch {
    return null;
  }
}

async function complete(endpoint: ChatEndpoint, user: string): Promise<string | null> {
  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${endpoint.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: endpoint.model,
      temperature: 0.2,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user.slice(0, 50000) },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = json.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : null;
}

export function heuristicResume(text: string, base: ProResume): ProResume {
  const source = stripIds(text);
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? base.email;
  const phone = source.match(/(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/)?.[0] ?? base.phone;
  const place = source.match(/\b([A-Za-z .'-]{2,40}),\s*([A-Z]{2})\b/);
  const nameLine = lines.find((line) => line.length < 80 && !line.includes('@') && !/\d{3}/.test(line));
  const skillLine = lines.find((line) => /skills?/i.test(line));
  const skills = skillLine
    ? skillLine.replace(/^.*?skills?:?\s*/i, '').split(/[,|•]/).map((item) => item.trim()).filter((item) => item.length > 1 && item.length <= 40).slice(0, 30)
    : base.skills;
  return parseProResume({
    ...base,
    fullName: base.fullName || nameLine || '',
    email,
    phone,
    city: base.city || place?.[1]?.trim() || '',
    state: base.state || place?.[2] || '',
    summary: base.summary || lines.slice(1, 4).join(' ').slice(0, 2000),
    skills: skills.length > 0 ? skills : base.skills,
  });
}

export async function draftResumeWithModel(instruction: string, current: ProResume): Promise<{ reply: string; resume: ProResume; usedModel: boolean }> {
  const payload = `Current ProResume JSON:\n${JSON.stringify(current)}\n\nInstaller message:\n${stripIds(instruction)}`;
  for (const endpoint of endpoints()) {
    try {
      const raw = await complete(endpoint, payload);
      const parsed = raw ? parseModelJson(raw) : null;
      if (parsed) return { ...parsed, usedModel: true };
    } catch (error) {
      console.error('ProResume model failed:', endpoint.name, error instanceof Error ? error.message : error);
    }
  }
  const resume = heuristicResume(instruction, current.fullName ? current : emptyProResume());
  return {
    reply: 'I filled in the contact details I could read. Add jobs and skills, then save.',
    resume,
    usedModel: false,
  };
}
