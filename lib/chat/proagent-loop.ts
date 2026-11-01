import { randomUUID } from 'crypto'
import { AGENT_RULE, PROAGENT_MAX_STEPS, PROAGENT_POLICY, siteOrigin } from '@/lib/agent/constants'
import { prosFromToolData, proAgentOpenAiTools, runDirectoryTool } from '@/lib/agent/tools'
import { estimateSchema } from '@/lib/schemas/estimate'
import {
  directoryToolInput,
  estimateSummary,
  normalizeEstimateArgs,
  publicProCard,
  toolNeedsHomeownerConfirm,
} from '@/lib/chat/proagent-policy'
import { replyInventsPrice } from '@/lib/chat/probot-eval'
import { probotAutoReply } from '@/lib/chat/probot-reply'
import { redactForModel } from '@/lib/chat/probot-redact'
import {
  completeChat,
  configuredChatEndpoints,
  createProbotReply,
  jobPlaybookFor,
  parseModelReply,
  type ChatCompletionMessage,
  type ProbotTurn,
} from '@/lib/chat/probot-ai'
import type { ProAgentPayload, ProAgentProCard } from '@/lib/types/chat'

export interface AgentStepDraft {
  id: string
  toolName: string
  status: 'ok' | 'needs_confirm' | 'failed' | 'fallback'
  latencyMs: number
  input: unknown
  output: unknown
}

export interface ProAgentTurnResult {
  body: string
  payload: ProAgentPayload | null
  steps: AgentStepDraft[]
  outcome: 'model' | 'fallback'
  provider: string
  model: string
  playbookAttached: boolean
  latencyMs: number
}

const CONFIRM_COPY: Record<string, string> = {
  en: 'Here is the estimate request. Tap Confirm to send it. Nothing is filed until you do.',
  es: 'Esta es la solicitud de estimado. Pulsa Confirmar para enviarla. No se envía nada hasta que lo hagas.',
  pt: 'Este é o pedido de orçamento. Toque em Confirmar para enviar. Nada é enviado até você confirmar.',
}

function localeOf(locale: string | undefined): 'en' | 'es' | 'pt' {
  if (locale === 'es' || locale === 'pt') return locale
  return 'en'
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
  } catch {
    return {}
  }
  return {}
}

function issueFields(issues: { path: PropertyKey[] }[]): string[] {
  return issues.map((issue) => issue.path.map(String).filter(Boolean).join('.')).filter(Boolean).slice(0, 12)
}

function agentPrompt(locale: string | undefined, playbook: string, portalBrief: string): string {
  const language = locale === 'pt' ? 'Portuguese' : locale === 'es' ? 'Spanish' : 'English'
  const notes = playbook
    ? `\n\nThe visitor is asking about a job. Use the playbook for hardscape and landscape in Las Vegas. Follow its rules. Do not invent anything it does not say.\n\n${playbook}`
    : ''
  const places = portalBrief
    ? `\n\nThis person is signed in. Their places are below. For a question about their project, maintenance, contract, or invoice, answer only from this record. You may repeat a date, a balance, or a document title written here. If a date or file is missing, say it is not on the place yet. Tell them to open My Places for the files.\n\n${portalBrief}`
    : ''
  const moneyRule = portalBrief
    ? '- Never state a dollar amount, a rebate amount, or a start date unless that figure is written in their place record.'
    : '- Never state a dollar amount, a rebate amount, or a date the work will start.'
  return `You are ProAgent, the assistant on House Pros Hub (houseproshub.com).
${AGENT_RULE}
${PROAGENT_POLICY}

How to work:
- Greetings and general questions: answer in a few sentences. Do not call tools.
- A homeowner who wants a pro or a local job: call search_pros or list_categories. Use get_pro when they ask about one pro. Put the city in city, not in search.
- create_estimate only when every required field came from the homeowner in this chat. If a field is missing, ask for it. Do not invent contact details, an address, a budget, or a timeline.
${moneyRule}
- Reply in ${language} unless the user clearly wrote in another language.
- 2 to 5 sentences. No markdown headings.${notes}${places}`
}

function rememberPros(found: ProAgentProCard[], data: unknown, locale: string): ProAgentProCard[] {
  const next = [...found]
  for (const pro of prosFromToolData(data)) {
    const card = publicProCard(pro, locale)
    if (!next.some((item) => item.id === card.id)) next.push(card)
  }
  return next.slice(0, 3)
}

function priceIsOnPlaceRecord(body: string, brief: string): boolean {
  if (!brief || /\bper\s+square\s+foot\b/i.test(body)) return false
  const amounts = body.match(/\$\s?\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:dollars|usd)\b/gi) ?? []
  if (amounts.length === 0) return false
  return amounts.every((amount) => brief.includes(amount.replace(/[^\d.]/g, '')))
}

function finish(input: {
  body: string
  pros: ProAgentProCard[]
  steps: AgentStepDraft[]
  confirm: ProAgentPayload['confirm']
  endpoint: { name: string; model: string }
  playbookAttached: boolean
  started: number
  outcome: 'model' | 'fallback'
  locale: string
  fallback: string
  portalBrief?: string
}): ProAgentTurnResult {
  let body = input.body.trim()
  if (!body) body = input.confirm ? CONFIRM_COPY[input.locale] ?? CONFIRM_COPY.en : input.fallback
  if (replyInventsPrice(body) && !priceIsOnPlaceRecord(body, input.portalBrief ?? '')) body = input.fallback
  const payload: ProAgentPayload = {}
  if (input.pros.length) payload.pros = input.pros
  if (input.confirm) payload.confirm = input.confirm
  return {
    body,
    payload: payload.pros || payload.confirm ? payload : null,
    steps: input.steps,
    outcome: input.outcome,
    provider: input.endpoint.name,
    model: input.endpoint.model,
    playbookAttached: input.playbookAttached,
    latencyMs: Date.now() - input.started,
  }
}

/**
 * One homeowner turn. Read tools run here. create_estimate stops the loop and waits for Confirm.
 * If every provider rejects tools, the single-shot reply is the fallback.
 */
export async function runProAgentTurn(input: {
  body: string
  locale?: string
  history: ProbotTurn[]
  portalBrief?: string
}): Promise<ProAgentTurnResult> {
  const scripted = probotAutoReply(input.body, input.locale)
  const fallback = probotAutoReply(' ', input.locale)
  const trimmed = input.body.trim()
  const started = Date.now()
  if (trimmed && scripted !== fallback) {
    return {
      body: scripted,
      payload: null,
      steps: [],
      outcome: 'model',
      provider: 'script',
      model: 'script',
      playbookAttached: false,
      latencyMs: 0,
    }
  }

  const configured = configuredChatEndpoints()
  if (configured.length === 0 || !trimmed) {
    return {
      body: fallback,
      payload: null,
      steps: [],
      outcome: 'fallback',
      provider: 'none',
      model: 'none',
      playbookAttached: false,
      latencyMs: 0,
    }
  }

  const locale = localeOf(input.locale)
  const safeBody = redactForModel(trimmed)
  const safeHistory = input.history.map((turn) => ({
    sender: turn.sender,
    body: redactForModel(turn.body),
  }))
  const playbook = jobPlaybookFor(safeBody, safeHistory)
  const tools = proAgentOpenAiTools()
  const origin = siteOrigin()
  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: agentPrompt(input.locale, playbook, input.portalBrief?.trim() ?? '') },
    ...safeHistory
      .map((turn) => ({
        role: turn.sender === 'admin' ? 'assistant' : 'user',
        content: turn.body.trim(),
      }))
      .filter((turn) => turn.content.length > 0)
      .slice(-8),
    { role: 'user', content: safeBody },
  ]

  const steps: AgentStepDraft[] = []
  let pros: ProAgentProCard[] = []
  let lastEndpoint = configured[0]

  try {
    for (let step = 0; step < PROAGENT_MAX_STEPS; step += 1) {
      let completion: Awaited<ReturnType<typeof completeChat>> | null = null
      for (const endpoint of configured) {
        try {
          completion = await completeChat(endpoint, messages, tools)
          lastEndpoint = endpoint
          break
        } catch (error) {
          console.error('ProAgent provider failed:', endpoint.name, error instanceof Error ? error.message : error)
        }
      }
      if (!completion) break

      if (completion.toolCalls.length === 0) {
        const reply = completion.content ? parseModelReply(completion.content) : null
        if (!reply) break
        return finish({
          body: reply,
          pros,
          steps,
          confirm: undefined,
          endpoint: lastEndpoint,
          playbookAttached: playbook.length > 0,
          portalBrief: input.portalBrief,
          started,
          outcome: 'model',
          locale,
          fallback,
        })
      }

      messages.push(completion.assistantMessage)
      for (const call of completion.toolCalls) {
        if (steps.length >= PROAGENT_MAX_STEPS) break
        const args = parseArgs(call.arguments)
        const stepStarted = Date.now()
        if (toolNeedsHomeownerConfirm(call.name)) {
          const parsed = estimateSchema.safeParse(normalizeEstimateArgs(args))
          if (!parsed.success) {
            const fields = issueFields(parsed.error.issues)
            steps.push({
              id: randomUUID(),
              toolName: call.name,
              status: 'failed',
              latencyMs: Date.now() - stepStarted,
              input: { fields },
              output: { error: 'missing fields' },
            })
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({
                error: 'Ask the homeowner for the missing fields. Do not invent them. Nothing was filed.',
                fields,
              }),
            })
            continue
          }
          const stepId = randomUUID()
          steps.push({
            id: stepId,
            toolName: call.name,
            status: 'needs_confirm',
            latencyMs: Date.now() - stepStarted,
            input: parsed.data,
            output: null,
          })
          const spoken = completion.content ? parseModelReply(completion.content) : null
          return finish({
            body: spoken || CONFIRM_COPY[locale],
            pros,
            steps,
            confirm: { stepId, summary: estimateSummary(parsed.data as unknown as Record<string, unknown>) },
            endpoint: lastEndpoint,
            playbookAttached: playbook.length > 0,
            started,
            outcome: 'model',
            locale,
            fallback,
          })
        }

        const directory = await runDirectoryTool(call.name, args, origin)
        if (!directory) {
          steps.push({
            id: randomUUID(),
            toolName: call.name,
            status: 'failed',
            latencyMs: Date.now() - stepStarted,
            input: directoryToolInput(call.name, args),
            output: { error: 'unknown tool' },
          })
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: 'Unknown tool' }),
          })
          continue
        }
        pros = rememberPros(pros, directory.data, locale)
        const cards = prosFromToolData(directory.data).slice(0, 3).map((pro) => publicProCard(pro, locale))
        steps.push({
          id: randomUUID(),
          toolName: call.name,
          status: directory.isError ? 'failed' : 'ok',
          latencyMs: Date.now() - stepStarted,
          input: directoryToolInput(call.name, args),
          output: cards.length ? { pros: cards } : { ok: !directory.isError },
        })
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(directory.data).slice(0, 6000),
        })
      }
    }
  } catch (error) {
    console.error('ProAgent loop failed:', error instanceof Error ? error.message : error)
  }

  const body = await createProbotReply({
    body: input.body,
    locale: input.locale,
    history: input.history,
  })
  return {
    body: replyInventsPrice(body) ? fallback : body,
    payload: pros.length ? { pros } : null,
    steps,
    outcome: 'fallback',
    provider: lastEndpoint.name,
    model: lastEndpoint.model,
    playbookAttached: playbook.length > 0,
    latencyMs: Date.now() - started,
  }
}
