/**
 * Delivery-timing regression tests for the host half.
 *
 * The bug these lock down: a finished report was only ever handed to the
 * conversation by the `agent/pre-step` waterfall, so a conversation that was
 * mid-turn while the analysis finished stranded the system reminder until the
 * next manual user message. It is now pushed through the live agent's inbox as
 * soon as the analysis completes, provided a turn is actually running — an
 * idle conversation is never woken just to carry a notice.
 *
 * Run with: node --test test/
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import ContradictionsIndicator from '../lib/index.js'

const SESSION = 'session-test-1'

function analysisText() {
  return 'SCORE: 91\n\nANALYSIS:\nOne contradiction about the retry budget.'
}

/**
 * Minimal Cordis-shaped context. Only the surface this plugin touches is
 * implemented: on(), get(), effect(), inject(['webServer']), the fiber entry
 * (the settings namespace), reflect.provide (the Service base registers the
 * instance), a `settings` service capturing update() calls, and reactive
 * config refs backed by mutable `configValues` (undefined defers to the
 * shipped schema defaults, exactly like normalizeGlobals).
 */
function createHarness(script = null) {
  const handlers = new Map()
  const routes = new Map()
  const agents = new Map()
  const analysisRequests = []
  const settingsUpdates = []
  const configValues = { autoEnabled: true, interval: 25, steerEnabled: true, prompt1: undefined, prompt2: undefined }
  const config = {
    autoEnabled: { get: () => configValues.autoEnabled },
    interval: { get: () => configValues.interval },
    steerEnabled: { get: () => configValues.steerEnabled },
    prompt1: { get: () => configValues.prompt1 },
    prompt2: { get: () => configValues.prompt2 },
  }
  const settings = {
    updates: settingsUpdates,
    async update(ns, values) { settingsUpdates.push({ ns, values }) },
  }
  const exposed = { settings }

  const llm = {
    stream(request) {
      analysisRequests.push(request)
      const chunks = script === null ? null : script[Math.min(analysisRequests.length - 1, script.length - 1)]
      return (async function* () {
        if (chunks === null) {
          yield { type: 'text-delta', text: analysisText() }
          yield { type: 'finish', reason: { kind: 'stop' } }
          return
        }
        for (const chunk of chunks) yield chunk
      })()
    },
  }

  const ctx = {
    fiber: { entry: { options: { id: 'contradictions-indicator-test' } } },
    reflect: { provide() {} },
    on(name, handler) {
      handlers.set(name, handler)
      return () => handlers.delete(name)
    },
    get(name) {
      if (name === 'llm') return llm
      if (name === 'agents') return { get: (id) => agents.get(id) }
      if (name === 'settings') return exposed.settings
      return undefined
    },
    effect(fn) {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    inject(services, callback) {
      if (services.includes('webServer')) {
        callback({
          webServer: {
            register(route) {
              routes.set(route.path, route.handler)
              return () => routes.delete(route.path)
            },
          },
        })
      }
      return () => {}
    },
  }

  return { ctx, handlers, routes, agents, analysisRequests, settingsUpdates, configValues, config, exposed }
}

function fakeAgent(status = 'idle') {
  const agent = {
    id: SESSION,
    session: { id: SESSION },
    status,
    steers: [],
    injects: [],
    followups: [],
    steer(message) { agent.steers.push(message) },
    inject(message) { agent.injects.push(message) },
    followup(message) { agent.followups.push(message) },
  }
  return agent
}

/** Drive one main-conversation request through the llm/stream waterfall. */
function fireStream(harness, messageCount, extra = {}) {
  const messages = []
  for (let i = 0; i < messageCount; i += 1) {
    messages.push({
      id: 'm' + i,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: [{ type: 'text', text: 'message ' + i }],
      source: { kind: i % 2 === 0 ? 'user' : 'model' },
    })
  }
  const options = { sessionId: SESSION, provider: 'p', model: 'm', messages, ...extra }
  harness.lastMainOptions = options
  return harness.handlers.get('llm/stream')(options, () => (async function* () {})())
}

/** Fire enough main requests to reach the default 25-step interval. */
function reachInterval(harness, turns = 25, extra = {}) {
  for (let i = 0; i < turns; i += 1) fireStream(harness, 4 + i, extra)
}

async function waitFor(predicate, label, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.fail('timed out waiting for ' + label)
}

function readState(harness, session = SESSION) {
  const handler = harness.routes.get('/contradictions/state')
  assert.ok(handler, 'state route registered')
  let body = null
  handler(
    { method: 'GET', url: '/contradictions/state?sessionId=' + session, headers: {} },
    {
      headersSent: false,
      writableEnded: false,
      writeHead() { this.headersSent = true },
      end(json) { body = JSON.parse(json) },
    },
  )
  return body
}

test('pushes the report through a running turn as soon as it is ready', async () => {
  const harness = createHarness()
  const agent = fakeAgent('running')
  harness.agents.set(SESSION, agent)
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => agent.steers.length > 0, 'an immediate steer delivery')

  assert.equal(agent.steers.length, 1)
  assert.equal(agent.followups.length, 0)
  assert.equal(agent.injects.length, 0)

  const message = agent.steers[0]
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'plugin:contradictions-indicator')
  assert.equal(message.source.plugin, undefined)
  assert.equal(message.source.form, 'notice')
  assert.match(message.content[0].text, /91\/100/)
  assert.match(message.content[0].text, /retry budget/)
  assert.ok(Object.isFrozen(message), 'delivered message is immutable')

  // The report is delivered once, not re-delivered by the next step.
  const decision = await harness.handlers.get('agent/pre-step')(
    { agent, signal: undefined },
    async () => ({ kind: 'enter', messages: [{ id: 'u1', role: 'user', content: [] }] }),
  )
  assert.equal(decision.messages.length, 1)
})

test('does not wake an idle conversation, holding the notice for its next step', async () => {
  const harness = createHarness()
  const agent = fakeAgent('idle')
  harness.agents.set(SESSION, agent)
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => readState(harness)?.status === 'ready', 'the analysis to finish')

  // A reminder has no job while no turn is running, so steering would only
  // open a brand-new turn whose sole content is the notice.
  assert.equal(agent.steers.length, 0)
  assert.equal(agent.followups.length, 0)
  assert.equal(agent.injects.length, 0)

  // It is not dropped: the next step of that conversation receives it.
  const decision = await harness.handlers.get('agent/pre-step')(
    { agent, signal: undefined },
    async () => ({ kind: 'enter', messages: [{ id: 'u1', role: 'user', content: [] }] }),
  )
  assert.equal(decision.messages.length, 2)
  assert.equal(decision.messages[1].source.kind, 'plugin:contradictions-indicator')
  assert.match(decision.messages[1].content[0].text, /91\/100/)
})

test('falls back to the step boundary when no live agent is registered', async () => {
  const harness = createHarness()
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => readState(harness)?.status === 'ready', 'the analysis to finish')

  const agent = fakeAgent('idle')
  const decision = await harness.handlers.get('agent/pre-step')(
    { agent, signal: undefined },
    async () => ({ kind: 'enter', messages: [{ id: 'u1', role: 'user', content: [] }] }),
  )

  assert.equal(decision.messages.length, 2)
  assert.equal(decision.messages[1].source.kind, 'plugin:contradictions-indicator')
  assert.match(decision.messages[1].content[0].text, /91\/100/)
})

test('delivers nothing while the steer toggle is off', async () => {
  const harness = createHarness()
  const agent = fakeAgent('idle')
  harness.agents.set(SESSION, agent)
  new ContradictionsIndicator(harness.ctx, harness.config)

  const auto = harness.routes.get('/contradictions/auto')
  await auto(
    {
      method: 'POST',
      url: '/contradictions/auto?sessionId=' + SESSION,
      headers: {},
      on(event, handler) {
        if (event === 'data') handler(Buffer.from(JSON.stringify({ steer: false })))
        if (event === 'end') handler()
      },
    },
    { headersSent: false, writableEnded: false, writeHead() { this.headersSent = true }, end() {} },
  )

  reachInterval(harness)
  await waitFor(() => readState(harness)?.status === 'ready', 'the analysis to finish')

  assert.equal(agent.steers.length, 0)
  assert.equal(agent.followups.length, 0)
  assert.equal(agent.injects.length, 0)
})

test('analysis request mirrors the main request field for field', async () => {
  const harness = createHarness()
  new ContradictionsIndicator(harness.ctx, harness.config)

  const tools = [{ name: 't', description: 'd', parameters: { type: 'object' } }]
  const extra = {
    reasoningEffort: 'max',
    temperature: 0.2,
    stop: ['</done>'],
    maxTokens: 32000,
    system: 'you are a test',
    tools,
  }
  reachInterval(harness, 25, extra)
  await waitFor(() => harness.analysisRequests.length > 0, 'the analysis request')

  const main = harness.lastMainOptions
  const analysis = harness.analysisRequests[0]

  // Every request field the session declared is forwarded verbatim, so the
  // provider sees the same call parameters rather than adapter defaults.
  assert.equal(analysis.provider, main.provider)
  assert.equal(analysis.model, main.model)
  assert.equal(analysis.reasoningEffort, main.reasoningEffort)
  assert.equal(analysis.temperature, main.temperature)
  assert.deepEqual(analysis.stop, main.stop)
  assert.equal(analysis.maxTokens, main.maxTokens)
  assert.equal(analysis.system, main.system)
  assert.equal(analysis.sessionId, main.sessionId)
  // Same tool array reference, not a copy: the cache key includes tools.
  assert.equal(analysis.tools, tools)

  // The prompt is the identical prefix plus exactly one appended message.
  assert.equal(analysis.messages.length, main.messages.length + 1)
  assert.deepEqual(analysis.messages.slice(0, main.messages.length), main.messages)
  const appended = analysis.messages[analysis.messages.length - 1]
  assert.equal(appended.source.kind, 'plugin:contradictions-indicator')
  assert.equal(appended.source.form, undefined)
})

test('analysis sends no output budget when the main call declares none', async () => {
  const harness = createHarness()
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => harness.analysisRequests.length > 0, 'the analysis request')

  // Parity: an absent maxTokens stays absent, so the adapter default applies
  // to both calls instead of only to one of them.
  assert.equal(harness.analysisRequests[0].maxTokens, undefined)
})

test('retries once when the model answers with a tool call and no text', async () => {
  const harness = createHarness([
    [{ type: 'finish', reason: { kind: 'tool-calls' } }],
    [
      { type: 'text-delta', text: analysisText() },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  ])
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => readState(harness)?.status === 'ready', 'the retried analysis')

  assert.equal(harness.analysisRequests.length, 2)
  assert.equal(readState(harness).score, 91)
})

test('retries once when the answer misses the required format', async () => {
  const harness = createHarness([
    [
      { type: 'text-delta', text: 'I will look into that.' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
    [
      { type: 'text-delta', text: analysisText() },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  ])
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => readState(harness)?.status === 'ready', 'the retried analysis')

  assert.equal(harness.analysisRequests.length, 2)
  assert.equal(readState(harness).score, 91)
})

test('reports a failure when both attempts come back with no text', async () => {
  const harness = createHarness([[{ type: 'finish', reason: { kind: 'tool-calls' } }]])
  new ContradictionsIndicator(harness.ctx, harness.config)

  reachInterval(harness)
  await waitFor(() => readState(harness)?.status === 'error', 'the reported failure')

  assert.equal(harness.analysisRequests.length, 2)
})

test('every emitted source passes the v4 producer-owned admission rule', async () => {
  // The dsh v4 session format refuses retired plugin wrappers at admission,
  // and the refusal takes the whole running turn down with it: "format v4
  // message requires a producer-owned source kind". Any message this plugin
  // hands to a durable log or a running turn must already carry the
  // producer-owned kind (issue #3).
  const assertV4Admissible = (message) => {
    const source = message?.source
    assert.ok(source !== null && typeof source === 'object', 'source is an object')
    assert.equal(typeof source.kind, 'string', 'source.kind is a string')
    assert.ok(source.kind.length > 0, 'source.kind is nonempty')
    assert.notEqual(source.kind, 'plugin', 'the retired wrapper kind must never be emitted')
    assert.equal(source.plugin, undefined, 'the legacy plugin field is dropped')
    assert.equal(source.kind, 'plugin:contradictions-indicator')
  }

  // Immediate steer path: the notice enters a running turn's durable inbox.
  const live = createHarness()
  const agent = fakeAgent('running')
  live.agents.set(SESSION, agent)
  new ContradictionsIndicator(live.ctx, live.config)
  reachInterval(live)
  await waitFor(() => agent.steers.length > 0, 'the immediate steer delivery')
  assertV4Admissible(agent.steers[0])

  // In-flight analysis message: never persisted, but it feeds the same
  // self-detection and must stay on the producer-owned kind.
  const analysis = live.analysisRequests[0]
  assertV4Admissible(analysis.messages[analysis.messages.length - 1])

  // Pre-step fallback path: the same constructor appends at the next step
  // of an idle conversation.
  const idle = createHarness()
  new ContradictionsIndicator(idle.ctx, idle.config)
  reachInterval(idle)
  await waitFor(() => readState(idle)?.status === 'ready', 'the analysis to finish')
  const decision = await idle.handlers.get('agent/pre-step')(
    { agent: fakeAgent('idle'), signal: undefined },
    async () => ({ kind: 'enter', messages: [{ id: 'u1', role: 'user', content: [] }] }),
  )
  assert.equal(decision.messages.length, 2)
  assertV4Admissible(decision.messages[1])
})

test('seeds sessions from the composition config; volatile edits reach new sessions only', async () => {
  const harness = createHarness()
  new ContradictionsIndicator(harness.ctx, harness.config)

  // First conversation snapshots the composition values at entry creation.
  fireStream(harness, 4)
  assert.equal(readState(harness).analysisInterval, 25)
  assert.equal(readState(harness).autoEnabled, true)

  // A volatile edit from the Settings form hot-applies to the composition —
  // existing sessions keep their read-once snapshot; only sessions created
  // afterwards pick the new values up (the documented two-planes semantics).
  harness.configValues.interval = 10
  harness.handlers.get('loader/volatile-update')()
  assert.equal(readState(harness).analysisInterval, 25)

  fireStream(harness, 5, { sessionId: 'session-test-2' })
  assert.equal(readState(harness, 'session-test-2').analysisInterval, 10)
})

test('defaults POST writes through the settings service into the profile entry', async () => {
  const harness = createHarness()
  new ContradictionsIndicator(harness.ctx, harness.config)

  const defaults = harness.routes.get('/contradictions/defaults')
  assert.ok(defaults, 'defaults route registered')
  await defaults(
    {
      method: 'POST',
      url: '/contradictions/defaults',
      headers: {},
      on(event, handler) {
        if (event === 'data') handler(Buffer.from(JSON.stringify({ interval: 40 })))
        if (event === 'end') handler()
      },
    },
    { headersSent: false, writableEnded: false, writeHead() { this.headersSent = true }, end() {} },
  )

  // One write-through, namespaced to this plugin's composed entry, carrying
  // the full resolved globals — the same document the Settings form renders.
  assert.equal(harness.settingsUpdates.length, 1)
  assert.equal(harness.settingsUpdates[0].ns, 'contradictions-indicator-test')
  assert.equal(harness.settingsUpdates[0].values.interval, 40)
  assert.equal(harness.settingsUpdates[0].values.steerEnabled, true)
  assert.equal(readState(harness).globals.interval, 40)
})

test('keeps globals in memory only when the host has no settings service', async () => {
  const harness = createHarness()
  harness.exposed.settings = undefined
  new ContradictionsIndicator(harness.ctx, harness.config)

  const defaults = harness.routes.get('/contradictions/defaults')
  await defaults(
    {
      method: 'POST',
      url: '/contradictions/defaults',
      headers: {},
      on(event, handler) {
        if (event === 'data') handler(Buffer.from(JSON.stringify({ interval: 40 })))
        if (event === 'end') handler()
      },
    },
    { headersSent: false, writableEnded: false, writeHead() { this.headersSent = true }, end() {} },
  )

  assert.equal(harness.settingsUpdates.length, 0)
  assert.equal(readState(harness).globals.interval, 40)
})
