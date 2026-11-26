import { randomUUID } from 'crypto'
import { AGENT_RULE, PROAGENT_MAX_STEPS, PROAGENT_POLICY, siteOrigin } from '@/lib/agent/constants'
import { prosFromToolData, proAgentOpenAiTools, runDirectoryTool } from '@/lib/agent/tools'
import { isPlaceTool, placeOpenAiTools, runPlaceTool } from '@/lib/agent/place-tools'
import { DEFAULT_PRO_TIME_ZONE, isProTool, proOpenAiTools, runProTool, todayIn } from '@/lib/agent/pro-tools'
import { userOwnsCrm } from '@/lib/crm/require-contractor'
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
import { isSmallTalk } from '@/lib/chat/small-talk'
import { isMemoryTool, loadMemories, memoryOpenAiTools, memoryPrompt, runMemoryTool } from '@/lib/chat/probot-memory'
import { nextSteps } from '@/lib/chat/probot-suggestions'
import { isProActionTool, prepareProAction, proActionOpenAiTools } from '@/lib/agent/pro-actions'
import { LIMIT_COPY, type ProbotLimit } from '@/lib/chat/probot-usage'
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
import type { ChatCrmEstimateShare, ProAgentPayload, ProAgentProCard } from '@/lib/types/chat'

export interface AgentStepDraft {
  id: string
  toolName: string
  status: 'ok' | 'needs_confirm' | 'failed' | 'fallback'
  latencyMs: number
  input: unknown
  output: unknown
}

export type ProAgentProgress =
  | { type: 'status'; label: string }
  | { type: 'token'; text: string }

const TOOL_STATUS: Record<string, string> = {
  list_categories: 'listing_categories',
  search_pros: 'searching_pros',
  get_pro: 'reading_pro',
  create_estimate: 'drafting_estimate',
  get_my_places: 'reading_places',
  get_place_details: 'reading_places',
  get_place_timeline: 'reading_places',
  search_my_places: 'searching_places',
  approve_estimate: 'opening_estimate',
  get_open_invoices: 'reading_books',
  get_estimates_waiting: 'reading_books',
  get_projects: 'reading_books',
  get_maintenance_on: 'reading_schedule',
  get_day_schedule: 'reading_schedule',
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

function validTimeZone(value: string | undefined): string | null {
  if (!value) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return value
  } catch {
    return null
  }
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

function proPrompt(today: string, timeZone: string): string {
  const dayName = new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return `

This person is a pro and owns a CRM on House Pros Hub. Today is ${dayName} (${today}, ${timeZone}).
- For their business (open invoices, who owes money, estimates waiting, projects and when they finish, maintenance, their day): call get_open_invoices, get_estimates_waiting, get_projects, get_maintenance_on, or get_day_schedule. Answer only from what these tools return.
- For a day, pass the words the pro used ("the 26th", "tomorrow", "monday") as day. Do not work out the date yourself. Say the day back from the tool result, e.g. "tomorrow, Thursday the 26th".
- You may repeat amounts, dates and names from tool results. Never add amounts up yourself; use totalOwed. If a tool says several customers match, ask which one.
- These tools only read. If they ask you to send, mark paid or change something, tell them where to do it in the CRM.
- Talk like a helpful office manager: short, warm, the most important fact first. For a voice-style question, write the way you would say it out loud.`
}

export interface ProAgentPersona {
  mode: 'personal' | 'business'
  firstName?: string
  businessName?: string
}

/** Plain name only (it goes into the instructions). */
function cleanName(value: string | undefined, max: number): string {
  return (value ?? '').replace(/[^\p{L}\p{N} .,&'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Greets them by first name and keeps the talk on the profile they picked. */
function personaPrompt(persona: ProAgentPersona | undefined, signedIn: boolean): string {
  if (!persona || !signedIn) return ''
  const name = cleanName(persona.firstName, 40)
  const greet = name
    ? `\n- Their first name is ${name}. Start your reply with "Hi ${name}!" (in their language) when they greet you or it is the first message of the chat, then answer. Use their name now and then, not in every sentence.`
    : ''
  if (persona.mode === 'business') {
    const business = cleanName(persona.businessName, 80)
    return `\n\nThey are on their business profile${business ? ` (${business})` : ''}. Talk to them as the owner running that business: their jobs, customers, estimates, invoices, schedule and crew. Offer business help, not homeowner help.${greet}`
  }
  return `\n\nThey are on their personal profile, as a homeowner. Talk about their home, their places, and finding or hiring a pro. Do not bring up their business, CRM, invoices to customers or crew.${greet}`
}

function agentPrompt(locale: string | undefined, playbook: string, portalBrief: string, signedIn: boolean, pro: string = ''): string {
  const language = locale === 'pt' ? 'Portuguese' : locale === 'es' ? 'Spanish' : 'English'
  const notes = playbook
    ? `\n\nThe visitor is asking about a job. Use the playbook for hardscape and landscape in Las Vegas. Follow its rules. Do not invent anything it does not say.\n\n${playbook}`
    : ''
  const places = portalBrief
    ? `\n\nThis person is signed in. Their places are below. For a question about their project, maintenance, contract, or invoice, answer only from this record. You may repeat a date, a balance, or a document title written here. If a date or file is missing, say it is not on the place yet. Tell them to open My Places for the files.\n\n${portalBrief}`
    : ''
  const placeTools = signedIn
    ? `
- Their own places: use get_my_places, get_place_details, get_place_timeline, or search_my_places for anything not in the summary. Answer only from what these tools return.
- approve_estimate only shows an approval card. It never approves. Use it only when they ask to approve or accept a specific sent estimate. Then tell them to review the card, type their name, and tap Approve.`
    : ''
  const moneyRule = portalBrief || signedIn
    ? '- Never state a dollar amount, a rebate amount, or a start date unless that figure is written in their place record.'
    : '- Never state a dollar amount, a rebate amount, or a date the work will start.'
  // Fixed rules first, the same text on every turn, so the provider can cache that part of the
  // prompt (cheaper input). Everything about this person and this turn comes after it.
  return `You are ProAgent, the assistant on House Pros Hub (houseproshub.com).
${AGENT_RULE}
${PROAGENT_POLICY}

How to work:
- Greetings and general questions: answer in a few sentences. Do not call tools.
- A homeowner who wants a pro or a local job: call search_pros or list_categories. Use get_pro when they ask about one pro. Put the city in city, not in search.
- create_estimate only when every required field came from the homeowner in this chat. If a field is missing, ask for it. Do not invent contact details, an address, a budget, or a timeline.
- Keep it short. A simple answer is 2 to 5 sentences. When the answer has several facts, steps, or options (a plant, its care, how to do something, things to check), write one lead sentence, then short "- " bullets that start with a **bold** label, e.g. "- **Water:** Deep, infrequent watering." Use **bold** for key names and *italic* for scientific names. No markdown headings, no tables.${notes}

For this person:
${moneyRule}
- Reply in ${language} unless the user clearly wrote in another language.${placeTools}${pro}${places}`
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
  crmEstimate?: ChatCrmEstimateShare
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
  if (input.crmEstimate) payload.crmEstimate = input.crmEstimate
  return {
    body,
    payload: payload.pros || payload.confirm || payload.crmEstimate ? payload : null,
    steps: input.steps,
    outcome: input.outcome,
    provider: input.endpoint.name,
    model: input.endpoint.model,
    playbookAttached: input.playbookAttached,
    latencyMs: Date.now() - input.started,
  }
}

/**
 * One homeowner turn, plus next-step buttons picked from the tools that ran (no AI call).
 */
export async function runProAgentTurn(input: Parameters<typeof runProAgentTurnInner>[0]): Promise<ProAgentTurnResult> {
  const raw = await runProAgentTurnInner(input)
  const links = turnLinks.get(input)
  const result = links?.length ? { ...raw, payload: { ...(raw.payload ?? {}), links: links.slice(-3) } } : raw
  if (result.outcome !== 'model' || result.payload?.confirm || result.payload?.proAction) return result
  const ran = result.steps.filter((step) => step.status === 'ok').map((step) => step.toolName)
  const suggestions = nextSteps(ran, input.locale)
  if (suggestions.length === 0) return result
  return { ...result, payload: { ...(result.payload ?? {}), suggestions } }
}

/**
 * One homeowner turn. Read tools run here. create_estimate stops the loop and waits for Confirm.
 * If every provider rejects tools, the single-shot reply is the fallback.
 */
/** Open links from the CRM tools of the current turn (set while the loop runs). */
const turnLinks = new WeakMap<object, { label: string; href: string }[]>()

async function runProAgentTurnInner(input: {
  body: string
  locale?: string
  history: ProbotTurn[]
  portalBrief?: string
  /** Session user id. Turns on the My Places tools. Never take this from the request body. */
  userId?: string
  /** The pro's IANA time zone, for "today" and "the 26th". Defaults to Las Vegas. */
  timeZone?: string
  onProgress?: (event: ProAgentProgress) => void
  /** The account picked at the top, so ProBot greets them by name and talks about the right side. */
  persona?: ProAgentPersona
  /** Over today's limit: a fixed answer, no AI call. */
  overLimit?: ProbotLimit
}): Promise<ProAgentTurnResult> {
  const scripted = probotAutoReply(input.body, input.locale)
  const fallback = probotAutoReply(' ', input.locale)
  const trimmed = input.body.trim()
  const started = Date.now()
  const progress = input.onProgress
  if (trimmed && scripted !== fallback) {
    progress?.({ type: 'token', text: scripted })
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

  if (input.overLimit) {
    const body = LIMIT_COPY[localeOf(input.locale)][input.overLimit]
    progress?.({ type: 'token', text: body })
    return {
      body,
      payload: null,
      steps: [],
      outcome: 'fallback',
      provider: 'limit',
      model: 'limit',
      playbookAttached: false,
      latencyMs: 0,
    }
  }

  const configured = configuredChatEndpoints()
  if (configured.length === 0 || !trimmed) {
    progress?.({ type: 'token', text: fallback })
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
  // Small talk ("hi", "thanks"): no tools, no playbook, no place record, short history. A fraction of the tokens.
  const smallTalk = isSmallTalk(trimmed, input.persona?.firstName)
  const playbook = smallTalk ? '' : jobPlaybookFor(safeBody, safeHistory)
  const signedIn = Boolean(input.userId)
  // CRM tools only for the CRM owner. Crew members do not see the books.
  // On the personal profile a pro is a homeowner here: no business tools.
  const isPro =
    !smallTalk && input.userId && input.persona?.mode !== 'personal' ? await userOwnsCrm(input.userId).catch(() => false) : false
  const timeZone = validTimeZone(input.timeZone) ?? DEFAULT_PRO_TIME_ZONE
  const tools = smallTalk
    ? []
    : [
        ...proAgentOpenAiTools(),
        ...(signedIn ? placeOpenAiTools() : []),
        ...(isPro ? proOpenAiTools() : []),
        ...(isPro ? proActionOpenAiTools() : []),
      ]
  const brief = smallTalk ? '' : input.portalBrief?.trim() ?? ''
  // Memory: what they told ProBot before, per side (personal or business). Signed-in only.
  const memoryMode = input.persona?.mode === 'business' ? 'business' : 'personal'
  const memories = input.userId ? await loadMemories(input.userId, memoryMode).catch(() => []) : []
  if (input.userId && !smallTalk) tools.push(...memoryOpenAiTools())
  const origin = siteOrigin()
  const messages: ChatCompletionMessage[] = [
    {
      role: 'system',
      content: agentPrompt(input.locale, playbook, brief, signedIn, (isPro ? proPrompt(todayIn(timeZone), timeZone) : '') + personaPrompt(input.persona, signedIn) + memoryPrompt(memories)),
    },
    ...safeHistory
      .map((turn) => ({
        role: turn.sender === 'admin' ? 'assistant' : 'user',
        content: turn.body.trim(),
      }))
      .filter((turn) => turn.content.length > 0)
      .slice(smallTalk ? -4 : -8),
    { role: 'user', content: safeBody },
  ]

  const steps: AgentStepDraft[] = []
  let pros: ProAgentProCard[] = []
  let crmEstimate: ChatCrmEstimateShare | undefined
  // Figures the model may repeat: the place summary plus what place tools returned.
  let grounding = input.portalBrief ?? ''
  let lastEndpoint = configured[0]
  progress?.({ type: 'status', label: 'thinking' })

  try {
    for (let step = 0; step < PROAGENT_MAX_STEPS; step += 1) {
      let completion: Awaited<ReturnType<typeof completeChat>> | null = null
      let streamedText = ''
      for (const endpoint of configured) {
        try {
          streamedText = ''
          completion = await completeChat(endpoint, messages, tools, {
            onToken: progress
              ? (token) => {
                  streamedText += token
                  progress({ type: 'token', text: token })
                }
              : undefined,
          })
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
        // If the model wrapped JSON and we streamed raw tokens, replace with the clean reply.
        if (progress && streamedText && streamedText.trim() !== reply) {
          progress({ type: 'status', label: 'writing' })
          progress({ type: 'token', text: reply })
        }
        return finish({
          body: reply,
          pros,
          steps,
          confirm: undefined,
          crmEstimate,
          endpoint: lastEndpoint,
          playbookAttached: playbook.length > 0,
          portalBrief: grounding,
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
        progress?.({ type: 'status', label: TOOL_STATUS[call.name] ?? call.name })
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
          const body = spoken || CONFIRM_COPY[locale]
          progress?.({ type: 'token', text: body })
          return finish({
            body,
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

        if (isMemoryTool(call.name)) {
          const result = input.userId
            ? await runMemoryTool(call.name, args, { userId: input.userId, mode: memoryMode })
            : { data: { error: 'Sign in to save facts.' }, isError: true }
          steps.push({
            id: randomUUID(),
            toolName: call.name,
            status: result.isError ? 'failed' : 'ok',
            latencyMs: Date.now() - stepStarted,
            // The fact itself is private; the step log keeps only the outcome.
            input: {},
            output: { ok: !result.isError },
          })
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result.data) })
          continue
        }

        if (isProActionTool(call.name)) {
          const prepared = isPro && input.userId
            ? await prepareProAction(call.name, args, { userId: input.userId, timeZone })
            : { error: 'Only the CRM owner can do this.' }
          if ('error' in prepared) {
            steps.push({ id: randomUUID(), toolName: call.name, status: 'failed', latencyMs: Date.now() - stepStarted, input: args, output: { error: prepared.error } })
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: prepared.error }) })
            continue
          }
          steps.push({ id: randomUUID(), toolName: call.name, status: 'needs_confirm', latencyMs: Date.now() - stepStarted, input: args, output: null })
          const said = completion.content ? parseModelReply(completion.content) : null
          const actionBody = said || ({ es: 'Revisa y toca Confirmar.', pt: 'Confira e toque em Confirmar.' } as Record<string, string>)[locale] || 'Check it and tap Confirm.'
          progress?.({ type: 'token', text: actionBody })
          const done = finish({
            body: actionBody,
            pros,
            steps,
            confirm: undefined,
            endpoint: lastEndpoint,
            playbookAttached: playbook.length > 0,
            started,
            outcome: 'model',
            locale,
            fallback,
          })
          return { ...done, payload: { ...(done.payload ?? {}), proAction: prepared.action } }
        }

        if (isProTool(call.name)) {
          const result = isPro && input.userId
            ? await runProTool(call.name, args, { userId: input.userId, timeZone })
            : { data: { error: 'Only the CRM owner can read this.' }, isError: true }
          if ('links' in result && result.links?.length) turnLinks.set(input, result.links)
          const output = JSON.stringify(result.data).slice(0, 6000)
          // Amounts in the result are allowed in the reply (price guard).
          if (!result.isError) grounding += `
${output}`
          steps.push({
            id: randomUUID(),
            toolName: call.name,
            status: result.isError ? 'failed' : 'ok',
            latencyMs: Date.now() - stepStarted,
            // Business data is private; the step log keeps only arguments and outcome.
            input: args,
            output: { ok: !result.isError },
          })
          messages.push({ role: 'tool', tool_call_id: call.id, content: output })
          continue
        }

        if (isPlaceTool(call.name)) {
          const place = input.userId
            ? await runPlaceTool(call.name, args, { userId: input.userId, locale })
            : { data: { error: 'Sign in to read places.' }, isError: true }
          const output = JSON.stringify(place?.data ?? { error: 'Unknown tool' }).slice(0, 6000)
          if (place?.crmEstimate) crmEstimate = place.crmEstimate
          if (place && !place.isError) grounding += `
${output}`
          steps.push({
            id: randomUUID(),
            toolName: call.name,
            status: place?.isError ? 'failed' : 'ok',
            latencyMs: Date.now() - stepStarted,
            // Place data is private; the step log keeps only arguments and outcome.
            input: args,
            output: place?.crmEstimate ? { estimateId: place.crmEstimate.estimateId, card: true } : { ok: !place?.isError },
          })
          messages.push({ role: 'tool', tool_call_id: call.id, content: output })
          continue
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
      progress?.({ type: 'status', label: 'thinking' })
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
    payload:
      pros.length || crmEstimate
        ? { ...(pros.length ? { pros } : {}), ...(crmEstimate ? { crmEstimate } : {}) }
        : null,
    steps,
    outcome: 'fallback',
    provider: lastEndpoint.name,
    model: lastEndpoint.model,
    playbookAttached: playbook.length > 0,
    latencyMs: Date.now() - started,
  }
}
