import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  PLACE_EVAL_CASES,
  PROAGENT_EVAL_CASES,
  gradePlaceTurn,
  PROBOT_EVAL_CASES,
  gradeAgentTurn,
  gradeProbotReply,
} from '../lib/chat/probot-eval'
import { createProbotReply } from '../lib/chat/probot-ai'
import { runProAgentTurn } from '../lib/chat/proagent-loop'

function loadEnvLocal(): void {
  const file = path.join(process.cwd(), '.env.local')
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return
  }
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const hasKey = ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY'].some(
    (key) => Boolean(process.env[key]?.trim()),
  )
  if (!hasKey) {
    console.log('Skipped live ProBot eval: no model key is set.')
    return
  }

  let failed = 0
  const singleShotTotal = PROBOT_EVAL_CASES.length
  const toolLoopTotal = PROAGENT_EVAL_CASES.length

  console.log('--- createProbotReply (single-shot) ---')
  for (const evalCase of PROBOT_EVAL_CASES) {
    const reply = await createProbotReply({ body: evalCase.prompt, history: [] })
    const failures = gradeProbotReply(reply, evalCase)
    if (failures.length === 0) {
      console.log(`ok  ${evalCase.id}`)
      continue
    }
    failed += 1
    console.log(`FAIL ${evalCase.id}: ${failures.join('; ')}`)
    console.log(`     ${reply.replace(/\s+/g, ' ').slice(0, 240)}`)
  }

  console.log('--- runProAgentTurn (tool loop) ---')
  for (const evalCase of PROAGENT_EVAL_CASES) {
    const turn = await runProAgentTurn({ body: evalCase.prompt, history: [], locale: 'en' })
    const tools = turn.steps.map((step) => step.toolName)
    const filed = turn.steps.some((step) => step.toolName === 'create_estimate' && step.status === 'ok')
    const failures = [
      ...gradeProbotReply(turn.body, {
        id: evalCase.id,
        prompt: evalCase.prompt,
        playbook: false,
        handoff: evalCase.handoff,
      }),
      ...gradeAgentTurn({
        reply: turn.body,
        tools,
        filed,
        expectTool: evalCase.expectTool,
        mayFile: evalCase.mayFile,
      }),
    ]
    const unique = [...new Set(failures)]
    if (unique.length === 0) {
      console.log(`ok  ${evalCase.id} tools=[${tools.join(',') || '-'}]`)
      continue
    }
    failed += 1
    console.log(`FAIL ${evalCase.id}: ${unique.join('; ')}`)
    console.log(`     tools=[${tools.join(',') || '-'}] ${turn.body.replace(/\s+/g, ' ').slice(0, 240)}`)
  }

  // Signed-in My Places cases need a real portal user with at least one place.
  const evalUserId = process.env.PROBOT_EVAL_USER_ID?.trim()
  let placeTotal = 0
  if (!evalUserId) {
    console.log('--- My Places tools: skipped (set PROBOT_EVAL_USER_ID to a portal user id) ---')
  } else {
    console.log('--- runProAgentTurn (My Places tools, signed in) ---')
    const { portalBriefForUser } = await import('../lib/places/portal')
    const portalBrief = await portalBriefForUser(evalUserId).catch(() => '')
    for (const evalCase of PLACE_EVAL_CASES) {
      placeTotal += 1
      const turn = await runProAgentTurn({
        body: evalCase.prompt,
        history: [],
        locale: 'en',
        portalBrief,
        userId: evalUserId,
      })
      const tools = turn.steps.map((step) => step.toolName)
      const failures = gradePlaceTurn({ reply: turn.body, tools, expectAnyTool: evalCase.expectAnyTool })
      if (failures.length === 0) {
        console.log(`ok  ${evalCase.id} tools=[${tools.join(',') || '-'}]${turn.payload?.crmEstimate ? ' card' : ''}`)
        continue
      }
      failed += 1
      console.log(`FAIL ${evalCase.id}: ${failures.join('; ')}`)
      console.log(`     tools=[${tools.join(',') || '-'}] ${turn.body.replace(/s+/g, ' ').slice(0, 240)}`)
    }
  }

  const total = singleShotTotal + toolLoopTotal + placeTotal
  if (failed > 0) {
    console.error(`${failed} of ${total} live checks failed.`)
    process.exitCode = 1
    return
  }
  console.log(`All ${total} live checks passed (${singleShotTotal} single-shot + ${toolLoopTotal} tool-loop + ${placeTotal} places).`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
