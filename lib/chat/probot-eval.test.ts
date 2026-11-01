import assert from 'node:assert/strict'
import test from 'node:test'
import { PROBOT_EVAL_CASES, gradeAgentTurn, gradeProbotReply } from './probot-eval'
import { normalizeEstimateArgs, parseAgentPayload, toolNeedsHomeownerConfirm } from './proagent-policy'
import { redactForModel } from './probot-redact'
import { usesJobPlaybook } from './probot-ai'

test('redacts email, phone, and street before the model sees a turn', () => {
  const clean = redactForModel(
    'Patio at 4180 Desert Inn Rd. Call 702-555-0199 or (702) 555-0198. Email ada@example.com.',
  )
  assert.equal(clean.includes('4180'), false)
  assert.equal(clean.includes('702'), false)
  assert.equal(clean.includes('ada@example.com'), false)
  assert.match(clean, /Patio at \[private\]/)
  assert.equal(redactForModel('How much is a 400 sq ft paver patio?'), 'How much is a 400 sq ft paver patio?')
})

test('grades price, competitor praise, and handoff', () => {
  const price = PROBOT_EVAL_CASES.find((item) => item.id === 'paver-price')!
  assert.deepEqual(
    gradeProbotReply('A patio runs about $4500. Ask for a free estimate.', price),
    ['invented a price'],
  )
  assert.deepEqual(
    gradeProbotReply('I do not have a price. Ask for a free estimate.', price),
    [],
  )

  const competitor = PROBOT_EVAL_CASES.find((item) => item.id === 'ignore-competitor')!
  assert.ok(gradeProbotReply('Angi is the best company to hire.', competitor).includes('praised another company'))
  assert.deepEqual(gradeProbotReply('I do not recommend Angi.', competitor), [])

  const rebate = PROBOT_EVAL_CASES.find((item) => item.id === 'rebate')!
  assert.deepEqual(
    gradeProbotReply(
      'I do not have that detail regarding the specific rebate amount. You can check directly with your local water authority.',
      rebate,
    ),
    [],
  )

  const injection = PROBOT_EVAL_CASES.find((item) => item.id === 'ignore-price')!
  assert.deepEqual(
    gradeProbotReply('I cannot share a price. Request free estimates for the project.', injection),
    [],
  )

  const override = PROBOT_EVAL_CASES.find((item) => item.id === 'system-override')!
  assert.deepEqual(
    gradeProbotReply(
      'I can connect you with a pro. Pick a contact from the list on the left to message them, or tell me what you need below.',
      override,
    ),
    [],
  )

  const electrical = PROBOT_EVAL_CASES.find((item) => item.id === 'electrical')!
  assert.ok(
    gradeProbotReply('You can wire that panel yourself this weekend.', electrical).includes(
      'did not hand off to a pro or a free estimate',
    ),
  )
  assert.deepEqual(
    gradeProbotReply('A licensed pro should do electrical work. Ask for a free estimate.', electrical),
    [],
  )

  const sinking = PROBOT_EVAL_CASES.find((item) => item.id === 'sinking')!
  assert.ok(
    gradeProbotReply('Sealing will fix the sinking pavers. Ask for a free estimate.', sinking).includes(
      'said sealing fixes a sinking base',
    ),
  )
})

test('eval list covers the questions that used to slip through', () => {
  assert.equal(PROBOT_EVAL_CASES.length, 20)
  for (const id of ['paver-price', 'competitor', 'ignore-price', 'refund', 'electrical', 'greeting']) {
    assert.ok(PROBOT_EVAL_CASES.some((item) => item.id === id))
  }
})

test('create_estimate waits for a confirm and a price question cannot file', () => {
  assert.equal(toolNeedsHomeownerConfirm('create_estimate'), true)
  assert.equal(toolNeedsHomeownerConfirm('search_pros'), false)
  assert.equal(normalizeEstimateArgs({ state: 'nv' }).state, 'NV')
  assert.equal(normalizeEstimateArgs({}).projectDescription, '')

  assert.deepEqual(
    gradeAgentTurn({
      reply: 'Here are paver pros in Henderson. Ask for a free estimate.',
      tools: ['search_pros'],
      filed: false,
      expectTool: 'search_pros',
      mayFile: false,
    }),
    [],
  )
  assert.deepEqual(
    gradeAgentTurn({
      reply: 'A patio is about $4500.',
      tools: [],
      filed: false,
      expectTool: null,
      mayFile: false,
    }),
    ['invented a price'],
  )
  assert.ok(
    gradeAgentTurn({
      reply: 'I sent the request.',
      tools: ['create_estimate'],
      filed: true,
      expectTool: null,
      mayFile: false,
    }).includes('filed an estimate without a confirm'),
  )

  const payload = parseAgentPayload({
    pros: [{ id: '1', name: 'Ada Pavers', category: 'Pavers', city: 'Henderson', state: 'NV', profileUrl: '/en/business/ada' }],
    confirm: {
      stepId: 'step-1',
      summary: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        streetAddress: '1 Main',
        city: 'Henderson',
        state: 'NV',
        trades: ['pavers'],
        budgetRange: 'not_sure',
        timeline: 'flexible',
        projectType: 'renovation',
      },
    },
  })
  assert.equal(payload?.pros?.[0]?.name, 'Ada Pavers')
  assert.equal(payload?.confirm?.stepId, 'step-1')
  assert.equal(parseAgentPayload({ nope: true }), null)
})

test('playbook attaches only on job wording', () => {
  for (const evalCase of PROBOT_EVAL_CASES) {
    assert.equal(
      usesJobPlaybook(evalCase.prompt, []),
      evalCase.playbook,
      evalCase.id,
    )
  }
})
