/**
 * dsh-contradictions-indicator — host half.
 *
 * Parallel analysis of the live conversation for contradictions. Auto-analysis
 * is OFF by default per session. Global defaults (interval, steer, both prompt
 * texts) persist to disk and apply to new sessions.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

const MIN_MESSAGES = 4
const DEFAULT_INTERVAL = 25
const MAX_TOKENS = 20000
const PLUGIN_TAG = 'contradictions-indicator'
const MAX_SESSIONS = 50
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

function defaults() {
  return {
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
    interval: clampInterval(raw.interval ?? d.interval),
    steerEnabled: raw.steerEnabled !== false,
    prompt1: typeof raw.prompt1 === 'string' && raw.prompt1.trim() ? raw.prompt1 : d.prompt1,
    prompt2: typeof raw.prompt2 === 'string' && raw.prompt2.trim() ? raw.prompt2 : d.prompt2,
  }
}

/** Per-session analysis state, keyed by sessionId. */
const sessions = new Map()
let lastActiveKey = null
let globals = defaults()
let settingsScope = null

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
      autoEnabled: false,
      steerEnabled: globals.steerEnabled,
      interval: globals.interval,
      prompt1: globals.prompt1,
      prompt2: globals.prompt2,
      pendingSteer: null,
      generation: 0,
      lastAnalyzedCount: 0,
      lastSeenCount: 0,
      lastOptions: null,
    }
    sessions.set(key, entry)
    if (sessions.size > MAX_SESSIONS) {
      const oldest = sessions.keys().next()
      if (!oldest.done && oldest.value !== key) sessions.delete(oldest.value)
    }
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
    globals,
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
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

function sessionIdFrom(request) {
  try {
    return new URL(request.url ?? '/', 'http://localhost').searchParams.get('sessionId') || null
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
      try { resolve(raw.length > 0 ? JSON.parse(raw) : {}) }
      catch { resolve({}) }
    })
    request.on('error', () => resolve({}))
  })
}

function isOurAnalysisCall(lastMsg) {
  return lastMsg?.source?.kind === 'plugin' && lastMsg.source.plugin === PLUGIN_TAG
}

function isOurSteerCall(lastMsg) {
  return lastMsg?.source?.kind === 'plugin' && lastMsg.source.plugin === PLUGIN_TAG + '-steer'
}

function renderSteer(template, score, commentary) {
  return String(template || DEFAULT_PROMPT2)
    .replaceAll('{{score}}', String(score))
    .replaceAll('{{commentary}}', commentary == null ? '' : String(commentary))
}

async function persistGlobals(next) {
  globals = normalizeGlobals(next)
  if (settingsScope) {
    try {
      await settingsScope.update({
        interval: globals.interval,
        steerEnabled: globals.steerEnabled,
        prompt1: globals.prompt1,
        prompt2: globals.prompt2,
      })
      return
    } catch (error) {
      console.error('[dsh-contradictions-indicator] settings.update failed', error)
    }
  }
  try {
    await mkdir(join(homedir(), '.dsh'), { recursive: true })
    await writeFile(FALLBACK_PATH, JSON.stringify(globals, null, 2), 'utf8')
  } catch (error) {
    console.error('[dsh-contradictions-indicator] fallback persist failed', error)
  }
}

export const name = 'dsh-contradictions-indicator'

export function apply(ctx) {
  const ContraSettings = z.object({
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

  async function runAnalysis(llm, originalOptions, prompt1) {
    const analysisMessage = {
      id: 'contra-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
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
    }
    if (originalOptions.system !== undefined) analysisOptions.system = originalOptions.system
    if (originalOptions.tools !== undefined) analysisOptions.tools = originalOptions.tools
    if (originalOptions.sessionId !== undefined) analysisOptions.sessionId = originalOptions.sessionId

    let fullText = ''
    let sawError = null
    for await (const chunk of llm.stream(analysisOptions)) {
      if (chunk.type === 'text-delta') fullText += chunk.text
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
    entry.lastAnalyzedCount = options.messages.length
    entry.turnsSinceLastAnalysis = 0
    entry.generation += 1
    const myGeneration = entry.generation
    entry.status = 'analyzing'
    runAnalysis(llm, options, entry.prompt1).then((result) => {
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
      console.error('[dsh-contradictions-indicator] analysis failed', error)
      if (myGeneration !== entry.generation) return
      entry.status = 'error'
    })
  }

  ctx.on('llm/stream', (options, next) => {
    try {
      if (options.purpose === undefined && Array.isArray(options.messages)) {
        const pending = stateFor(options.sessionId)
        if (pending.pendingSteer && pending.steerEnabled) {
          const last = options.messages[options.messages.length - 1]
          if (!isOurAnalysisCall(last) && !isOurSteerCall(last)) {
            options.messages.push({
              id: 'contra-steer-' + Date.now().toString(36),
              role: 'user',
              content: [{ type: 'text', text: pending.pendingSteer }],
              source: { kind: 'plugin', plugin: PLUGIN_TAG + '-steer' },
            })
            pending.pendingSteer = null
          }
        }
      }
    } catch (error) {
      console.error('[dsh-contradictions-indicator] steer injection failed', error)
    }

    const stream = next()
    try {
      if (options.purpose !== undefined) return stream
      if (!options.messages || options.messages.length < MIN_MESSAGES) return stream
      const lastMsg = options.messages[options.messages.length - 1]
      if (isOurAnalysisCall(lastMsg)) return stream

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
    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/state',
      handler: (request, response) => {
        if (request.method !== 'GET') { response.writeHead(405, { allow: 'GET' }); response.end(); return }
        sendJson(response, 200, snapshot(stateFor(sessionIdFrom(request))))
      },
    })

    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/auto',
      handler: async (request, response) => {
        if (request.method !== 'POST') { response.writeHead(405, { allow: 'POST' }); response.end(); return }
        const body = await readBody(request)
        const entry = stateFor(sessionIdFrom(request))
        const persist = body?.persist === true
        const nextGlobals = { ...globals }

        if (typeof body?.enabled === 'boolean') entry.autoEnabled = body.enabled
        if (typeof body?.steer === 'boolean') {
          entry.steerEnabled = body.steer
          if (!entry.steerEnabled) entry.pendingSteer = null
          if (persist) nextGlobals.steerEnabled = body.steer
        }
        if (body?.interval !== undefined && body?.interval !== null && body?.interval !== '') {
          entry.interval = clampInterval(body.interval)
          if (persist) nextGlobals.interval = entry.interval
        }
        if (typeof body?.prompt1 === 'string') {
          entry.prompt1 = body.prompt1.trim() ? body.prompt1 : DEFAULT_PROMPT1
          if (persist) nextGlobals.prompt1 = entry.prompt1
        }
        if (typeof body?.prompt2 === 'string') {
          entry.prompt2 = body.prompt2.trim() ? body.prompt2 : DEFAULT_PROMPT2
          if (persist) nextGlobals.prompt2 = entry.prompt2
        }
        if (persist) await persistGlobals(nextGlobals)
        sendJson(response, 200, snapshot(entry))
      },
    })

    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/defaults',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          sendJson(response, 200, { ...globals, defaults: defaults() })
          return
        }
        if (request.method !== 'POST') { response.writeHead(405, { allow: 'GET, POST' }); response.end(); return }
        const body = await readBody(request)
        await persistGlobals({ ...globals, ...body })
        sendJson(response, 200, { ...globals, defaults: defaults() })
      },
    })

    host.webServer.register({
      kind: 'exact',
      path: '/contradictions/trigger',
      handler: async (request, response) => {
        if (request.method !== 'POST') { response.writeHead(405, { allow: 'POST' }); response.end(); return }
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
