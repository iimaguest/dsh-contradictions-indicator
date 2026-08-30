/**
 * dsh-contradictions-indicator — host half.
 *
 * Parallel analysis of the live conversation for contradictions.
 *
 * SETTINGS MODEL (two strictly separated planes):
 *
 *  1. Global defaults — `autoEnabled`, `interval`, `steerEnabled`, and both
 *     prompt texts. Persisted to disk, editable ONLY through the Settings tab
 *     (`/contradictions/defaults`). They are read exactly once per session:
 *     when that session's entry is first created. Editing them therefore
 *     affects conversations started afterwards and never reaches into one that
 *     already exists.
 *
 *  2. Per-session state — the same fields, seeded from the defaults at session
 *     creation and thereafter owned solely by that session's panel
 *     (`/contradictions/auto`). A per-session edit CANNOT write back to the
 *     global defaults; the old `persist` flag that allowed it is gone, because
 *     it meant tuning one conversation silently reconfigured every future one.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

const MIN_MESSAGES = 4
const DEFAULT_INTERVAL = 25
// Kept generously high on purpose: a truncated finish_reason ('length')
// before the model reaches 'ANALYSIS:' wastes the entire parallel call and
// forces a retry, which costs far more than the token budget itself.
const MAX_TOKENS = 20000
const ANALYSIS_TIMEOUT_MS = 120_000
const PLUGIN_TAG = 'contradictions-indicator'
const MAX_SESSIONS = 50
const MAX_PROMPT_LENGTH = 20_000
const MAX_BODY_BYTES = 1_000_000
const SETTINGS_NS = 'contradictions-indicator'

const DEFAULT_PROMPT1 = [
  'IMPORTANT: Do NOT use any tools. Do NOT call any functions. Respond with text only.',
  '',
  'Analyze the conversation above for internal contradictions, inconsistencies,',
  'and logical conflicts between statements made by both the user and the assistant.',
  'Look for:',
  '- Direct contradictions (saying X then later saying not-X)',
  '- Inconsistent assumptions or requirements',
  '- Changed positions without acknowledgment',
  '- Conflicting instructions or goals',
  '- Logical inconsistencies in reasoning',
  '',
  'Respond in EXACTLY this format:',
  '',
  'SCORE: <number from 0 to 100>',
  '',
  'ANALYSIS:',
  '<your analysis here, a few sentences>',
  '',
  'Where 0 means the conversation is riddled with contradictions,',
  'and 100 means the conversation is perfectly smooth and consistent.',
  'If you find no contradictions, say so and give a high score.',
].join('\n')

const DEFAULT_PROMPT2 = [
  '<system-reminder>',
  'Contradiction check (automatic, not from the user).',
  'Coherence score: {{score}}/100 (0 = riddled with contradictions, 100 = fully consistent).',
  '',
  '{{commentary}}',
  '',
  'If contradictions are named above, resolve or surface them before continuing.',
  'Do not mention this reminder verbatim.',
  '</system-reminder>',
].join('\n')

const FALLBACK_PATH = join(homedir(), '.dsh', 'contradictions-indicator.json')

function clampInterval(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return DEFAULT_INTERVAL
  return Math.min(500, Math.max(1, v))
}

function clampPrompt(s, fallback) {
  if (typeof s !== 'string') return fallback
  const trimmed = s.trim()
  if (!trimmed) return fallback
  return s.length > MAX_PROMPT_LENGTH ? s.slice(0, MAX_PROMPT_LENGTH) : s
}

function defaults() {
  return {
    // Auto-analysis ships ON for every new conversation (requested default).
    // Turn it off globally in Settings → Contradictions, or per conversation
    // in the panel; both writes stay on their own plane.
    autoEnabled: true,
    interval: DEFAULT_INTERVAL,
    steerEnabled: true,
    prompt1: DEFAULT_PROMPT1,
    prompt2: DEFAULT_PROMPT2,
  }
}

function normalizeGlobals(raw) {
  const d = defaults()
  if (!raw || typeof raw !== 'object') return d
  return {
    // Missing field means "never written" → the shipped default (on). An
    // explicit false from Settings is respected.
    autoEnabled: raw.autoEnabled !== false,
    interval: clampInterval(raw.interval ?? d.interval),
    steerEnabled: raw.steerEnabled !== false,
    prompt1: clampPrompt(raw.prompt1, d.prompt1),
    prompt2: clampPrompt(raw.prompt2, d.prompt2),
  }
}

function parseAnalysisResponse(text) {
  let score = null
  let commentary = text
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i)
  if (scoreMatch) score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))
  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*)/i)
  if (analysisMatch) commentary = analysisMatch[1].trim()
  // No loose numeric fallback: an unparsable response defaults to a neutral
  // score (50) rather than guessing from any stray digit in the prose.
  if (!commentary || commentary.length === 0) commentary = text
  return { score: score === null ? 50 : score, commentary }
}

function sendJson(response, status, body) {
  if (response.headersSent || response.writableEnded) return
  const json = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(json),
  })
  response.end(json)
}

function sendMethodNotAllowed(response, allow) {
  if (response.headersSent || response.writableEnded) return
  response.writeHead(405, { allow, 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify({ error: 'method not allowed' }))
}

// --- Same-origin / trust check for the local DSH web server -------------
// webServer routes are not covered by the /api trust fence, so this plugin
// enforces its own: reject any request whose Origin/Sec-Fetch-Site indicate
// a cross-site browser navigation (CSRF form posts, DNS-rebinding fetches).
// A request with no Origin header at all (same-origin navigations, curl,
// server-to-server) is allowed, matching same-origin browser fetch behavior
// where the Origin header IS sent for state-changing requests.
function isTrustedLocalRequest(request) {
  const secFetchSite = request.headers['sec-fetch-site']
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') return false
  const origin = request.headers['origin']
  if (!origin) return true
  try {
    const originHost = new URL(origin).host
    const hostHeader = request.headers['host']
    if (!hostHeader || originHost !== hostHeader) return false
  } catch {
    return false
  }
  return true
}

function sessionIdFrom(request) {
  try {
    const raw = new URL(request.url ?? '/', 'http://localhost').searchParams.get('sessionId')
    return raw && raw.trim() ? raw : null
  } catch {
    return null
  }
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = ''
    let tooLarge = false
    request.on('data', (chunk) => {
      if (tooLarge) return
      raw += chunk.toString('utf8')
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        tooLarge = true
        raw = ''
        request.destroy()
      }
    })
    request.on('end', () => {
      if (tooLarge) { resolve({ __tooLarge: true }); return }
      try { resolve(raw.length > 0 ? JSON.parse(raw) : {}) }
      catch { resolve({}) }
    })
    request.on('error', () => resolve({}))
    request.on('aborted', () => resolve({}))
  })
}

function isOurAnalysisCall(lastMsg) {
  return lastMsg?.source?.kind === 'plugin'
    && lastMsg.source.plugin === PLUGIN_TAG
    && lastMsg.source.form !== 'notice'
}

function isOurSteerCall(lastMsg) {
  return lastMsg?.source?.kind === 'plugin'
    && lastMsg.source.plugin === PLUGIN_TAG
    && lastMsg.source.form === 'notice'
}

function newMessageId(prefix) {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return prefix + crypto.randomUUID()
    }
  } catch {}
  return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

function steerSummary(score) {
  if (score == null) return 'Contradiction check'
  return 'Coherence score ' + String(score) + '/100'
}

function makeSteerMessage(text, score) {
  return {
    id: newMessageId('contra-steer-'),
    role: 'user',
    content: [{ type: 'text', text }],
    source: {
      kind: 'plugin',
      plugin: PLUGIN_TAG,
      form: 'notice',
      summary: steerSummary(score),
    },
  }
}

function renderSteer(template, score, commentary) {
  return String(template || DEFAULT_PROMPT2)
    .replaceAll('{{score}}', String(score))
    .replaceAll('{{commentary}}', commentary == null ? '' : String(commentary))
}

export const name = 'dsh-contradictions-indicator'

export function apply(ctx) {
  // All mutable plugin state lives inside apply() so that stop/restart in
  // the same process starts from a clean slate instead of inheriting stale
  // sessions, listeners, or a settingsScope closure over a disposed ctx.
  const sessions = new Map()
  let lastActiveKey = null
  let globals = defaults()
  let settingsScope = null

  function touchSession(key, entry) {
    // Re-insertion moves the key to the end of Map iteration order, turning
    // the eviction policy below into a true LRU instead of insertion-order
    // FIFO that could evict an actively-used session.
    sessions.delete(key)
    sessions.set(key, entry)
  }

  function stateFor(sessionId) {
    const key = sessionId || lastActiveKey || '__global__'
    let entry = sessions.get(key)
    if (entry === undefined) {
      entry = {
        key,
        score: null,
        commentary: null,
        status: 'idle',
        messageCount: 0,
        turnsSinceLastAnalysis: 0,
        // Seeded from the global defaults ONCE, at creation. From here on
        // this entry is the sole owner of these five fields: later edits to
        // the defaults deliberately do not propagate into a live session.
        autoEnabled: globals.autoEnabled === true,
        steerEnabled: globals.steerEnabled,
        interval: globals.interval,
        prompt1: globals.prompt1,
        prompt2: globals.prompt2,
        pendingSteer: null,
        generation: 0,
        lastAnalyzedCount: 0,
        lastSeenCount: 0,
        lastOptions: null,
        abortController: null,
      }
      sessions.set(key, entry)
      if (sessions.size > MAX_SESSIONS) {
        const oldest = sessions.keys().next()
        if (!oldest.done && oldest.value !== key) sessions.delete(oldest.value)
      }
    } else {
      touchSession(key, entry)
    }
    return entry
  }

  function snapshot(entry) {
    const until = entry.autoEnabled
      ? Math.max(0, entry.interval - entry.turnsSinceLastAnalysis)
      : null
    return {
      score: entry.score,
      commentary: entry.commentary,
      status: entry.status,
      messageCount: entry.messageCount,
      turnsSinceLastAnalysis: entry.turnsSinceLastAnalysis,
      turnsUntilNext: until,
      autoEnabled: entry.autoEnabled,
      steerEnabled: entry.steerEnabled,
      analysisInterval: entry.interval,
      prompt1: entry.prompt1,
      prompt2: entry.prompt2,
      sessionKey: entry.key,
      globals: { ...globals },
    }
  }

  async function persistGlobals(next) {
    const resolved = normalizeGlobals(next)
    globals = resolved
    if (settingsScope) {
      try {
        await settingsScope.update({
          autoEnabled: resolved.autoEnabled,
          interval: resolved.interval,
          steerEnabled: resolved.steerEnabled,
          prompt1: resolved.prompt1,
          prompt2: resolved.prompt2,
        })
        return
      } catch (error) {
        console.error('[dsh-contradictions-indicator] settings.update failed', error)
      }
    }
    try {
      await mkdir(join(homedir(), '.dsh'), { recursive: true })
      await writeFile(FALLBACK_PATH, JSON.stringify(resolved, null, 2), 'utf8')
    } catch (error) {
      console.error('[dsh-contradictions-indicator] fallback persist failed', error)
    }
  }

  const ContraSettings = z.object({
    autoEnabled: z.boolean().default(true),
    interval: z.number().default(DEFAULT_INTERVAL),
    steerEnabled: z.boolean().default(true),
    prompt1: z.string().default(DEFAULT_PROMPT1),
    prompt2: z.string().default(DEFAULT_PROMPT2),
  })
  const entry = defaults()
  let source = () => entry
  try {
    installSettingsSection(ctx, settingsNamespace(SETTINGS_NS), ContraSettings, entry, {
      setSource: (current) => { source = current },
      onChange: () => { globals = normalizeGlobals(source()) },
    })
    settingsScope = {
      get: () => source(),
      update: async (patch) => {
        const settings = ctx.get('settings')
        if (!settings) throw new Error('settings unavailable')
        await settings.update(settingsNamespace(SETTINGS_NS), patch)
      },
    }
    globals = normalizeGlobals(source())
  } catch (error) {
    console.error('[dsh-contradictions-indicator] settings register failed', error)
    settingsScope = null
  }

  readFile(FALLBACK_PATH, 'utf8').then((text) => {
    if (settingsScope) return
    try { globals = normalizeGlobals(JSON.parse(text)) } catch {}
  }).catch(() => {})

  async function runAnalysis(llm, originalOptions, prompt1, signal) {
    const analysisMessage = {
      id: newMessageId('contra-'),
      role: 'user',
      content: [{ type: 'text', text: prompt1 || DEFAULT_PROMPT1 }],
      source: { kind: 'plugin', plugin: PLUGIN_TAG },
    }
    const messages = originalOptions.messages.slice()
    messages.push(analysisMessage)
    const analysisOptions = {
      provider: originalOptions.provider,
      model: originalOptions.model,
      messages,
      maxTokens: MAX_TOKENS,
      signal,
    }
    if (originalOptions.system !== undefined) analysisOptions.system = originalOptions.system
    if (originalOptions.tools !== undefined) analysisOptions.tools = originalOptions.tools
    if (originalOptions.sessionId !== undefined) analysisOptions.sessionId = originalOptions.sessionId
    // `tools` is deliberately kept byte-identical to the original request:
    // this call must be a pure suffix-append onto the exact same prefix
    // (provider, model, system, tools, messages…) so the provider's KV
    // cache is reused instead of invalidated — that's the whole point of
    // firing this as a "parallel" analysis call instead of a fresh one.
    // This is safe because runAnalysis() only ever reads `text-delta` and
    // `finish` chunks from the raw llm.stream() below; it never dispatches
    // to ctx.tools.execute(), so a tool-call chunk the model might emit
    // here is simply ignored, never actually invoked.

    let fullText = ''
    let sawError = null
    for await (const chunk of llm.stream(analysisOptions)) {
      if (signal?.aborted) throw new Error('analysis aborted')
      if (chunk.type === 'text-delta') fullText += (chunk.text ?? '')
      else if (chunk.type === 'finish') {
        if (chunk.reason && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
          sawError = chunk.reason
        }
      }
    }
    if (sawError !== null) throw new Error('analysis model call ended with ' + sawError.kind)
    if (fullText.trim().length === 0) throw new Error('analysis model call produced no text')
    return parseAnalysisResponse(fullText)
  }

  function scheduleAnalysis(entry, llm, options) {
    // Single-flight: abort any previous in-flight analysis for this session
    // before starting a new one, instead of letting it run to completion
    // wastefully in the background.
    if (entry.abortController) {
      try { entry.abortController.abort() } catch {}
    }
    const abortController = new AbortController()
    entry.abortController = abortController
    entry.lastAnalyzedCount = options.messages.length
    entry.turnsSinceLastAnalysis = 0
    entry.generation += 1
    const myGeneration = entry.generation
    entry.status = 'analyzing'

    const timeout = setTimeout(() => {
      try { abortController.abort() } catch {}
    }, ANALYSIS_TIMEOUT_MS)

    runAnalysis(llm, options, entry.prompt1, abortController.signal).then((result) => {
      clearTimeout(timeout)
      if (myGeneration !== entry.generation) return
      entry.score = result.score
      entry.commentary = result.commentary
      entry.status = 'ready'
      entry.messageCount = options.messages.length
      if (entry.steerEnabled) {
        entry.pendingSteer = renderSteer(entry.prompt2, result.score, result.commentary)
      } else {
        entry.pendingSteer = null
      }
    }).catch((error) => {
      clearTimeout(timeout)
      console.error('[dsh-contradictions-indicator] analysis failed', error)
      if (myGeneration !== entry.generation) return
      entry.status = 'error'
    })
  }

  // Next-turn steer must happen here. llm/stream options are already
  // deep-frozen by the agent loop, so mutating options.messages is a no-op
  // (TypeError on frozen arrays, swallowed by the old try/catch).
  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    try {
      if (decision.kind === 'reject') return decision
      if (payload.signal?.aborted) return decision
      if (!decision.messages || !decision.messages.length) return decision
      const agent = payload.agent
      const sessionId = agent?.session?.id ?? agent?.id
      const entry = stateFor(sessionId)
      if (!entry.pendingSteer || !entry.steerEnabled) return decision
      const last = decision.messages[decision.messages.length - 1]
      if (isOurAnalysisCall(last) || isOurSteerCall(last)) return decision
      const text = entry.pendingSteer
      entry.pendingSteer = null
      return {
        ...decision,
        kind: 'enter',
        messages: [...decision.messages, makeSteerMessage(text, entry.score)],
      }
    } catch (error) {
      console.error('[dsh-contradictions-indicator] steer injection failed', error)
      return decision
    }
  })

  ctx.on('llm/stream', (options, next) => {
    const stream = next()
    try {
      if (options.purpose !== undefined) return stream
      if (!options.messages || options.messages.length < MIN_MESSAGES) return stream
      const lastMsg = options.messages[options.messages.length - 1]
      // Skip both our own analysis calls AND our own steer notices — a
      // steer message is not a real conversational turn and must not
      // advance the auto-analysis interval or get captured as lastOptions.
      if (isOurAnalysisCall(lastMsg) || isOurSteerCall(lastMsg)) return stream

      // Use options.sessionId as the single canonical session key
      // everywhere (llm/stream, agent/pre-step, and HTTP all agree on this
      // one source now instead of three different fallbacks).
      const entry = stateFor(options.sessionId)
      lastActiveKey = options.sessionId || entry.key
      if (entry.lastSeenCount === options.messages.length) return stream
      entry.lastSeenCount = options.messages.length
      entry.lastOptions = options
      entry.turnsSinceLastAnalysis += 1

      if (!entry.autoEnabled) return stream
      if (entry.turnsSinceLastAnalysis < entry.interval) return stream
      const llm = ctx.get('llm')
      if (llm === undefined) return stream
      scheduleAnalysis(entry, llm, options)
    } catch (error) {
      console.error('[dsh-contradictions-indicator] waterfall filter error', error)
    }
    return stream
  })

  ctx.inject(['webServer'], (host) => {
    const disposers = []

    disposers.push(host.webServer.register({
      kind: 'exact',
      path: '/contradictions/state',
      handler: (request, response) => {
        if (request.method !== 'GET') { sendMethodNotAllowed(response, 'GET'); return }
        if (!isTrustedLocalRequest(request)) { response.writeHead(403); response.end(); return }
        sendJson(response, 200, snapshot(stateFor(sessionIdFrom(request))))
      },
    }))

    disposers.push(host.webServer.register({
      kind: 'exact',
      path: '/contradictions/auto',
      handler: async (request, response) => {
        if (request.method !== 'POST') { sendMethodNotAllowed(response, 'POST'); return }
        if (!isTrustedLocalRequest(request)) { response.writeHead(403); response.end(); return }
        try {
          const body = await readBody(request)
          if (body?.__tooLarge) { sendJson(response, 413, { error: 'body too large' }); return }
          const entry = stateFor(sessionIdFrom(request))

          // This route writes THIS session's fields and nothing else. Any
          // `persist` field in the body is ignored on purpose: promoting a
          // per-conversation tweak into a global default is the Settings
          // tab's job alone (`/contradictions/defaults`).
          if (typeof body?.enabled === 'boolean') entry.autoEnabled = body.enabled
          if (typeof body?.steer === 'boolean') {
            entry.steerEnabled = body.steer
            if (!entry.steerEnabled) entry.pendingSteer = null
          }
          if (body?.interval !== undefined && body?.interval !== null && body?.interval !== '') {
            entry.interval = clampInterval(body.interval)
          }
          if (typeof body?.prompt1 === 'string') {
            entry.prompt1 = clampPrompt(body.prompt1, DEFAULT_PROMPT1)
          }
          if (typeof body?.prompt2 === 'string') {
            entry.prompt2 = clampPrompt(body.prompt2, DEFAULT_PROMPT2)
          }
          sendJson(response, 200, snapshot(entry))
        } catch (error) {
          console.error('[dsh-contradictions-indicator] /auto handler failed', error)
          sendJson(response, 500, { error: 'internal error' })
        }
      },
    }))

    disposers.push(host.webServer.register({
      kind: 'exact',
      path: '/contradictions/defaults',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          if (!isTrustedLocalRequest(request)) { response.writeHead(403); response.end(); return }
          sendJson(response, 200, { ...globals, defaults: defaults() })
          return
        }
        if (request.method !== 'POST') { sendMethodNotAllowed(response, 'GET, POST'); return }
        if (!isTrustedLocalRequest(request)) { response.writeHead(403); response.end(); return }
        try {
          const body = await readBody(request)
          if (body?.__tooLarge) { sendJson(response, 413, { error: 'body too large' }); return }
          // Whitelist known fields only; never spread an arbitrary body
          // into persisted global state.
          const { autoEnabled, interval, steerEnabled, prompt1, prompt2 } = body || {}
          await persistGlobals({
            autoEnabled: autoEnabled !== undefined ? autoEnabled === true : globals.autoEnabled,
            interval: interval !== undefined ? interval : globals.interval,
            steerEnabled: steerEnabled !== undefined ? steerEnabled : globals.steerEnabled,
            prompt1: prompt1 !== undefined ? prompt1 : globals.prompt1,
            prompt2: prompt2 !== undefined ? prompt2 : globals.prompt2,
          })
          sendJson(response, 200, { ...globals, defaults: defaults() })
        } catch (error) {
          console.error('[dsh-contradictions-indicator] /defaults handler failed', error)
          sendJson(response, 500, { error: 'internal error' })
        }
      },
    }))

    disposers.push(host.webServer.register({
      kind: 'exact',
      path: '/contradictions/trigger',
      handler: async (request, response) => {
        if (request.method !== 'POST') { sendMethodNotAllowed(response, 'POST'); return }
        if (!isTrustedLocalRequest(request)) { response.writeHead(403); response.end(); return }
        const entry = stateFor(sessionIdFrom(request))
        if (entry.status === 'analyzing') {
          sendJson(response, 200, { triggered: false, reason: 'Analysis already in progress.' })
          return
        }
        if (!entry.lastOptions) {
          sendJson(response, 200, {
            triggered: false,
            reason: 'No conversation data yet — send at least ' + MIN_MESSAGES + ' messages first.',
          })
          return
        }
        const llm = ctx.get('llm')
        if (llm === undefined) {
          sendJson(response, 200, { triggered: false, reason: 'LLM service unavailable.' })
          return
        }
        scheduleAnalysis(entry, llm, entry.lastOptions)
        sendJson(response, 200, { triggered: true, state: snapshot(entry) })
      },
    }))

    // Ensure all registered routes are unregistered, all in-flight analysis
    // calls aborted, and shared state cleared when this fiber tears down
    // (plugin stop/undefine/hot-reload).
    ctx.effect(() => () => {
      for (const dispose of disposers) {
        try { if (typeof dispose === 'function') dispose() } catch {}
      }
      for (const entry of sessions.values()) {
        if (entry.abortController) {
          try { entry.abortController.abort() } catch {}
        }
      }
      sessions.clear()
    }, 'contradictions: webServer routes + session cleanup')

    console.log('[dsh-contradictions-indicator] host loaded')
  })
}
