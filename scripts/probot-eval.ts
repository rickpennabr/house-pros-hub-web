import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PROBOT_EVAL_CASES, gradeProbotReply } from '../lib/chat/probot-eval'
import { createProbotReply } from '../lib/chat/probot-ai'

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

  if (failed > 0) {
    console.error(`${failed} of ${PROBOT_EVAL_CASES.length} live checks failed.`)
    process.exitCode = 1
    return
  }
  console.log(`All ${PROBOT_EVAL_CASES.length} live checks passed.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
