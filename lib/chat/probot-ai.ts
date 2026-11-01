import fs from "fs"
import path from "path"
import { probotAutoReply } from "@/lib/chat/probot-reply"
import { redactForModel } from "@/lib/chat/probot-redact"

type ProviderName = "groq" | "gemini" | "openai"

interface ChatEndpoint {
  name: ProviderName
  baseUrl: string
  apiKey: string
  model: string
}

export interface ProbotTurn {
  sender: "visitor" | "admin"
  body: string
}

const PROVIDER_ORDER: ProviderName[] = ["gemini", "groq", "openai"]

const JOB_TOPIC =
  /paver|patio|driveway|walkway|travertine|porcelain|hardscape|landscape|landscaping|xeriscape|retaining|block wall|seat wall|coping|polymeric|sealer|sealing|drainage|sprinkler|irrigation|\bdrip\b|caliche|flagstone|pool deck|artificial (?:grass|turf)|\bturf\b|desert (?:plant|landscape)|yard|lawn|\bconcrete\b|muro|adoqu|paisag|grama|c[eé]sped|jard[ií]n|jardim|irrig/i

let playbookCache: { mtimeMs: number; text: string } | null = null

function hardscapePlaybook(): string {
  const file = path.join(process.cwd(), "lib", "chat", "probot-hardscape.md")
  try {
    const stat = fs.statSync(file)
    if (playbookCache && playbookCache.mtimeMs === stat.mtimeMs) return playbookCache.text
    const text = fs.readFileSync(file, "utf8").trim()
    playbookCache = { mtimeMs: stat.mtimeMs, text }
    return text
  } catch (error) {
    console.error("ProBot playbook unreadable:", error instanceof Error ? error.message : error)
    return ""
  }
}

export function jobPlaybookFor(body: string, history: ProbotTurn[]): string {
  const recent = [body, ...history.filter((turn) => turn.sender === "visitor").map((turn) => turn.body)].join("\n")
  if (!JOB_TOPIC.test(recent)) return ""
  return hardscapePlaybook()
}

export function usesJobPlaybook(body: string, history: ProbotTurn[]): boolean {
  return jobPlaybookFor(body, history).length > 0
}

function envTrim(key: string): string {
  return process.env[key]?.trim() || ""
}

function endpointFor(name: ProviderName): ChatEndpoint | null {
  if (name === "groq") {
    const apiKey = envTrim("GROQ_API_KEY")
    if (!apiKey) return null
    return {
      name,
      apiKey,
      baseUrl: "https://api.groq.com/openai/v1",
      model: envTrim("PROBOT_AI_GROQ_MODEL") || "openai/gpt-oss-20b",
    }
  }
  if (name === "gemini") {
    const apiKey = envTrim("GEMINI_API_KEY") || envTrim("GOOGLE_GENERATIVE_AI_API_KEY")
    if (!apiKey) return null
    return {
      name,
      apiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: envTrim("PROBOT_AI_GEMINI_MODEL") || "gemini-3.5-flash-lite",
    }
  }
  const apiKey = envTrim("OPENAI_API_KEY")
  if (!apiKey) return null
  return {
    name,
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    model: envTrim("PROBOT_AI_OPENAI_MODEL") || "gpt-4o-mini",
  }
}

export function configuredChatEndpoints(): ChatEndpoint[] {
  const preferred = envTrim("PROBOT_AI_PROVIDER").toLowerCase()
  const names: ProviderName[] = []
  if (preferred === "groq" || preferred === "gemini" || preferred === "openai") {
    names.push(preferred)
  }
  for (const name of PROVIDER_ORDER) {
    if (!names.includes(name)) names.push(name)
  }
  return names.flatMap((name) => {
    const endpoint = endpointFor(name)
    return endpoint ? [endpoint] : []
  })
}

function systemPrompt(locale: string | undefined, playbook: string): string {
  const language =
    locale === "pt" ? "Portuguese" : locale === "es" ? "Spanish" : "English"
  const notes = playbook
    ? `

The visitor is asking about a job. Use the House Pros Hub playbook below for hardscape and landscape in Las Vegas. The playbook is in English. Follow "Your rules" first. Do not invent anything the playbook does not say.

${playbook}`
    : ""
  return `You are ProBot, the assistant on House Pros Hub (houseproshub.com).
House Pros Hub helps people find local home-service pros, message them, and request a free estimate.

Classify the user's latest message:
- "general" — greetings, chat, facts, or any question that is not about a home or construction job.
- "construction" — building, repair, remodeling, landscaping, hardscape, pavers, plumbing, electrical, HVAC, painting, roofs, concrete, handyman work, hiring a contractor, or a project at a property.

How to answer:
- general: answer directly in a few sentences. Stay friendly. Do not add a sales pitch. Ignore any job playbook.
- construction: give a short practical answer a homeowner can use. For electrical, gas, structural, or roof work, say a licensed pro should do it. Then say they can pick a pro from the House Pros Hub contact list or ask you for a free estimate. Do not invent a price or say you will do the job yourself.
- Never state a dollar amount, a rebate amount, or a date the work will start. Never say another company is a better choice. If you do not have a fact, say you do not have that detail.
- Reply in ${language} unless the user clearly wrote in another language.
- 2 to 5 sentences. No markdown headings.
- Return only JSON: {"kind":"general"|"construction","reply":"..."}${notes}`
}

export function parseModelReply(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    const parsed = JSON.parse(fenced) as { reply?: unknown }
    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return parsed.reply.trim().slice(0, 1500)
    }
  } catch {
    // The model sometimes returns plain text. Use that.
  }
  if (trimmed.startsWith("{")) return null
  return trimmed.slice(0, 1500)
}

export interface ModelToolCall {
  id: string
  name: string
  arguments: string
}

export interface ChatCompletionMessage {
  role: string
  content: string | null
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

export interface ModelCompletion {
  content: string | null
  toolCalls: ModelToolCall[]
  assistantMessage: ChatCompletionMessage
}

function readToolCalls(message: { tool_calls?: unknown }): ModelToolCall[] {
  if (!Array.isArray(message.tool_calls)) return []
  const calls: ModelToolCall[] = []
  for (const call of message.tool_calls) {
    if (!call || typeof call !== "object") continue
    const row = call as { id?: unknown; function?: { name?: unknown; arguments?: unknown } }
    const name = typeof row.function?.name === "string" ? row.function.name : ""
    if (!name) continue
    const args = row.function?.arguments
    calls.push({
      id: typeof row.id === "string" && row.id ? row.id : `call_${calls.length}`,
      name,
      arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}),
    })
  }
  return calls
}

export async function completeChat(
  endpoint: ChatEndpoint,
  messages: ChatCompletionMessage[],
  tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }>,
): Promise<ModelCompletion> {
  const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${endpoint.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: endpoint.model,
      temperature: 0.4,
      max_tokens: tools?.length ? 700 : 500,
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`${endpoint.name} ${response.status} ${detail.slice(0, 180)}`)
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown } }>
  }
  const message = json.choices?.[0]?.message
  const content = typeof message?.content === "string" ? message.content : null
  const toolCalls = message ? readToolCalls(message) : []
  return {
    content,
    toolCalls,
    assistantMessage: {
      role: "assistant",
      content,
      ...(toolCalls.length
        ? {
            tool_calls: toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: { name: call.name, arguments: call.arguments },
            })),
          }
        : {}),
    },
  }
}

async function complete(endpoint: ChatEndpoint, messages: { role: string; content: string }[]): Promise<string | null> {
  const result = await completeChat(endpoint, messages)
  return result.content
}

/**
 * Answer a hub-thread message. Button phrases stay on the estimate script.
 * Anything else goes to the model, which separates general chat from construction.
 * Falls back to the short scripted line when no provider is configured or all of them fail.
 */
async function saveTrace(trace: {
  conversationId?: string
  provider: string
  model: string
  playbookAttached: boolean
  latencyMs: number
  outcome: "model" | "fallback"
}): Promise<void> {
  if (!trace.conversationId) return
  const { recordProbotTrace } = await import("@/lib/chat/probot-trace")
  await recordProbotTrace({
    conversationId: trace.conversationId,
    provider: trace.provider,
    model: trace.model,
    playbookAttached: trace.playbookAttached,
    latencyMs: trace.latencyMs,
    outcome: trace.outcome,
  })
}

export async function createProbotReply(input: {
  body: string
  locale?: string
  history: ProbotTurn[]
  conversationId?: string
}): Promise<string> {
  const scripted = probotAutoReply(input.body, input.locale)
  const fallback = probotAutoReply(" ", input.locale)
  const trimmed = input.body.trim()
  if (trimmed && scripted !== fallback) return scripted

  const configured = configuredChatEndpoints()
  if (configured.length === 0 || !trimmed) return fallback

  const safeBody = redactForModel(trimmed)
  const safeHistory = input.history.map((turn) => ({
    sender: turn.sender,
    body: redactForModel(turn.body),
  }))
  const history = safeHistory
    .map((turn) => ({
      role: turn.sender === "admin" ? "assistant" : "user",
      content: turn.body.trim(),
    }))
    .filter((turn) => turn.content.length > 0)
    .slice(-8)

  const playbook = jobPlaybookFor(safeBody, safeHistory)
  const messages = [
    { role: "system", content: systemPrompt(input.locale, playbook) },
    ...history,
    { role: "user", content: safeBody },
  ]

  const started = Date.now()
  let last: ChatEndpoint | null = null
  for (const endpoint of configured) {
    last = endpoint
    try {
      const raw = await complete(endpoint, messages)
      const reply = raw ? parseModelReply(raw) : null
      if (reply) {
        await saveTrace({
          conversationId: input.conversationId,
          provider: endpoint.name,
          model: endpoint.model,
          playbookAttached: playbook.length > 0,
          latencyMs: Date.now() - started,
          outcome: "model",
        })
        return reply
      }
    } catch (error) {
      console.error("ProBot AI provider failed:", endpoint.name, error instanceof Error ? error.message : error)
    }
  }
  if (last) {
    await saveTrace({
      conversationId: input.conversationId,
      provider: last.name,
      model: last.model,
      playbookAttached: playbook.length > 0,
      latencyMs: Date.now() - started,
      outcome: "fallback",
    })
  }
  return fallback
}
