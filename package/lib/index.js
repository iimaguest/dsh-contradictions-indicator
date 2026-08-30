/**
 * dsh-contradictions-indicator — host half.
 *
 * Listens on the `llm/stream` waterfall for every model call in the process.
 * For a real conversation turn it may fire a PARALLEL `llm.stream()` call that
 * reuses the identical conversation prefix (provider, model, system, tools,
 * sessionId, messages) and appends exactly one user message asking the model to
 * analyze the conversation for contradictions and return a 0-100 coherence
 * score. Because only a suffix is appended, the provider's KV/prefix cache
 * stays warm for the analysis call.
 *
 * The main call is never blocked: `next()` is invoked and its stream returned
 * immediately; the analysis runs fire-and-forget afterwards.
 *
 * Auto-analysis is OFF by default and is opted into per session from the UI.
 * A manual trigger is always available.
 *
 * State is keyed by sessionId, and the client polls it over three HTTP
 * endpoints registered on the host web server.
 */

const MIN_MESSAGES = 4
const ANALYSIS_INTERVAL = 25
const MAX_TOKENS = 20000
const PLUGIN_TAG = 'contradictions-indicator'
const MAX_SESSIONS = 50

const ANALYSIS_PROMPT = [
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

/** Per-session analysis state, keyed by sessionId. */
const sessions = new Map()

function stateFor(sessionId) {
  const key = sessionId || '__global__'
  let entry = sessions.get(key)
  if (entry === undefined) {
    entry = {
      score: null,
      commentary: null,
      status: 'idle',
      messageCount: 0,
      turnsSinceLastAnalysis: 0,
      autoEnabled: false,
      generation: 0,
      lastAnalyzedCount: 0,
      lastOptions: null,
    }
    sessions.set(key, entry)
    // Bound memory: drop the oldest entry once the map grows past the cap.
    if (sessions.size > MAX_SESSIONS) {
      const oldest = sessions.keys().next()
      if (!oldest.done) sessions.delete(oldest.value)
    }
  }
  return entry
}

function snapshot(entry) {
  return {
    score: entry.score,
    commentary: entry.commentary,
    status: entry.status,
    messageCount: entry.messageCount,
    turnsSinceLastAnalysis: entry.turnsSinceLastAnalysis,
    turnsUntilNext: entry.autoEnabled
      ? Math.max(0, ANALYSIS_INTERVAL - entry.turnsSinceLastAnalysis)
      : null,
    autoEnabled: entry.autoEnabled,
    analysisInterval: ANALYSIS_INTERVAL,
  }
}

function parseAnalysisResponse(text) {
  let score = null
  let commentary = text

  const scoreMatch = text.match(/SCORE:\s*(\d+)/i)
  if (scoreMatch) score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))

  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*)/i)
  if (analysisMatch) commentary = analysisMatch[1].trim()

  if (score === null) {
    const numMatch = text.match(/\b(\d{1,3})\b/)
    if (numMatch) {
      const n = parseInt(numMatch[1], 10)
      if (n >= 0 && n <= 100) score = n
    }
  }

  if (!commentary || commentary.length === 0) commentary = text
  return { score: score === null ? 50 : score, commentary }
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(payload)
}

function sessionIdFrom(request) {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    return url.searchParams.get('sessionId') || null
  } catch {
    return null
  }
}

function readBody(request) {
  return new Promise((resolve) => {
    let raw = ''
    request.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) raw = raw.slice(0, 1_000_000)
    })
    request.on('end', () => {
      try {
        resolve(raw.length > 0 ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    request.on('error', () => resolve({}))
  })
}

export const name = 'dsh-contradictions-indicator'

export function apply(ctx) {
  /**
   * Run the analysis call. Only a suffix is appended to the caller's exact
   * message list, so the provider's prefix cache is reused rather than
   * invalidated.
   */
  async function runAnalysis(llm, originalOptions) {
    const analysisMessage = {
      id: 'contra-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      role: 'user',
      content: [{ type: 'text', text: ANALYSIS_PROMPT }],
      source: { kind: 'plugin', plugin: PLUGIN_TAG },
    }

    const messages = originalOptions.messages.slice()
    messages.push(analysisMessage)

    const analysisOptions = {
      provider: originalOptions.provider,
      model: originalOptions.model,
      messages,
      maxTokens: MAX_TOKENS,
    }
    if (originalOptions.system !== undefined) analysisOptions.system = originalOptions.system
    if (originalOptions.tools !== undefined) analysisOptions.tools = originalOptions.tools
    if (originalOptions.sessionId !== undefined) analysisOptions.sessionId = originalOptions.sessionId

    let fullText = ''
    let sawError = null

    for await (const chunk of llm.stream(analysisOptions)) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.text
      } else if (chunk.type === 'finish') {
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
    entry.lastAnalyzedCount = options.messages.length
    entry.turnsSinceLastAnalysis = 0
    entry.generation += 1
    const myGeneration = entry.generation
    entry.status = 'analyzing'

    runAnalysis(llm, options).then((result) => {
      if (myGeneration !== entry.generation) return
      entry.score = result.score
      entry.commentary = result.commentary
      entry.status = 'ready'
      entry.messageCount = options.messages.length
    }).catch((error) => {
      console.error('[dsh-contradictions-indicator] analysis failed', error)
      if (myGeneration !== entry.generation) return
      entry.status = 'error'
    })
  }

  // ── the waterfall listener ────────────────────────────────────────────────
  ctx.on('llm/stream', (options, next) => {
    // Never block the real call: start it first and return its stream.
    const stream = next()

    try {
      // Skip non-conversation calls (compaction, session titling, …).
      if (options.purpose !== undefined) return stream
      if (!options.messages || options.messages.length < MIN_MESSAGES) return stream

      // Recursion guard: never analyze our own analysis call.
      const lastMsg = options.messages[options.messages.length - 1]
      if (lastMsg?.source?.kind === 'plugin' && lastMsg.source.plugin === PLUGIN_TAG) {
        return stream
      }

      const entry = stateFor(options.sessionId)

      // Debounce: the same message count is the same turn seen twice.
      if (options.messages.length === entry.lastAnalyzedCount) return stream

      // Always keep the newest options so the manual trigger has data.
      entry.lastOptions = options
      entry.turnsSinceLastAnalysis += 1

      // Auto-analysis is opt-in and interval-gated.
      if (!entry.autoEnabled) return stream
      if (entry.turnsSinceLastAnalysis < ANALYSIS_INTERVAL) return stream

      const llm = ctx.get('llm')
      if (llm === undefined) return stream

      scheduleAnalysis(entry, llm, options)
    } catch (error) {
      console.error('[dsh-contradictions-indicator] waterfall filter error', error)
    }

    return stream
  })

  // ── HTTP endpoints the client bundle polls ────────────────────────────────
  ctx.inject(['webServer'], (host) => {
    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/state',
      handler: (request, response) => {
        if (request.method !== 'GET') {
          response.writeHead(405, { allow: 'GET' })
          response.end()
          return
        }
        sendJson(response, 200, snapshot(stateFor(sessionIdFrom(request))))
      },
    })

    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/auto',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        const body = await readBody(request)
        const entry = stateFor(sessionIdFrom(request))
        entry.autoEnabled = body?.enabled === true
        sendJson(response, 200, snapshot(entry))
      },
    })

    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/trigger',
      handler: async (request, response) => {
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'POST' })
          response.end()
          return
        }
        const entry = stateFor(sessionIdFrom(request))
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
    })

    console.log('[dsh-contradictions-indicator] host loaded')
  })
}
