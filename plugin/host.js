// Contradictions Indicator — Host half (Cordis dynamic Plugin)
//
// Listens on the `llm/stream` waterfall for every model call in the process.
// When a real conversation turn completes, may fire a parallel `llm.stream()`
// call that reuses the identical conversation prefix (provider, model,
// system, tools, sessionId, messages) and appends one user message asking
// the model to analyze the conversation for contradictions and produce a
// 0-100 coherence score. Never blocks the main call.
//
// Auto-analysis is OFF by default. The client can enable it per-session via
// the 'set-auto' RPC, which sets autoEnabled = true. When enabled, analysis
// fires every ANALYSIS_INTERVAL turns. turnsSinceLastAnalysis counts real
// conversation turns and is returned to the client so it can display progress.
//
// A manual trigger is always available via the 'trigger-analysis' RPC,
// regardless of whether auto is enabled.

let analysisState = {
  score: null,
  commentary: null,
  status: 'idle',
  messageCount: 0,
  turnsSinceLastAnalysis: 0,
  autoEnabled: false
}
let analysisGeneration = 0
let lastAnalyzedCount = 0
let turnsSinceLastAnalysis = 0
let autoEnabled = false
let lastOptions = null  // snapshot of the most recent valid llm/stream options

const MIN_MESSAGES = 4
const ANALYSIS_INTERVAL = 25
const MAX_TOKENS = 20000
const PLUGIN_TAG = 'contradictions-indicator'

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
  'If you find no contradictions, say so and give a high score.'
].join('\n')

function parseAnalysisResponse(text) {
  let score = null
  let commentary = text

  const scoreMatch = text.match(/SCORE:\s*(\d+)/i)
  if (scoreMatch) {
    score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))
  }

  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*)/i)
  if (analysisMatch) {
    commentary = analysisMatch[1].trim()
  }

  if (score === null) {
    const numMatch = text.match(/\b(\d{1,3})\b/)
    if (numMatch) {
      const n = parseInt(numMatch[1], 10)
      if (n >= 0 && n <= 100) score = n
    }
  }

  if (!commentary || commentary.length === 0) commentary = text

  return { score: score === null ? 50 : score, commentary: commentary }
}

function buildSnapshot() {
  return {
    score: analysisState.score,
    commentary: analysisState.commentary,
    status: analysisState.status,
    messageCount: analysisState.messageCount,
    turnsSinceLastAnalysis: turnsSinceLastAnalysis,
    turnsUntilNext: autoEnabled ? Math.max(0, ANALYSIS_INTERVAL - turnsSinceLastAnalysis) : null,
    autoEnabled: autoEnabled,
    analysisInterval: ANALYSIS_INTERVAL
  }
}

return {
  apply(ctx) {
    harness.handle('get-analysis', function () {
      return buildSnapshot()
    })

    harness.handle('set-auto', function (args) {
      autoEnabled = (args && args.enabled === true)
      analysisState = Object.assign({}, analysisState, { autoEnabled: autoEnabled })
      return buildSnapshot()
    })

    harness.handle('trigger-analysis', function () {
      if (!lastOptions) {
        return { triggered: false, reason: 'No conversation data available yet — send at least ' + MIN_MESSAGES + ' messages first.' }
      }
      const llm = ctx.get('llm')
      if (!llm) {
        return { triggered: false, reason: 'LLM service not available.' }
      }
      scheduleAnalysis(llm, lastOptions)
      return { triggered: true }
    })

    async function runAnalysis(llm, originalOptions) {
      const analysisMessage = {
        id: 'contra-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        role: 'user',
        content: [{ type: 'text', text: ANALYSIS_PROMPT }],
        source: { kind: 'plugin', plugin: PLUGIN_TAG }
      }

      const messages = []
      for (let i = 0; i < originalOptions.messages.length; i++) {
        messages.push(originalOptions.messages[i])
      }
      messages.push(analysisMessage)

      const analysisOptions = {
        provider: originalOptions.provider,
        model: originalOptions.model,
        messages: messages,
        maxTokens: MAX_TOKENS
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

      if (sawError !== null) {
        throw new Error('analysis model call ended with ' + sawError.kind)
      }
      if (fullText.trim().length === 0) {
        throw new Error('analysis model call produced no text')
      }

      return parseAnalysisResponse(fullText)
    }

    function scheduleAnalysis(llm, options) {
      lastAnalyzedCount = options.messages.length
      turnsSinceLastAnalysis = 0
      analysisGeneration += 1
      const myGeneration = analysisGeneration

      analysisState = {
        score: analysisState.score,
        commentary: analysisState.commentary,
        status: 'analyzing',
        messageCount: analysisState.messageCount,
        autoEnabled: autoEnabled
      }

      runAnalysis(llm, options).then(function (result) {
        if (myGeneration !== analysisGeneration) return
        analysisState = {
          score: result.score,
          commentary: result.commentary,
          status: 'ready',
          messageCount: options.messages.length,
          autoEnabled: autoEnabled
        }
      }).catch(function (err) {
        console.error('contradictions-indicator: analysis failed', err)
        if (myGeneration !== analysisGeneration) return
        analysisState = {
          score: analysisState.score,
          commentary: analysisState.commentary,
          status: 'error',
          messageCount: analysisState.messageCount,
          autoEnabled: autoEnabled
        }
      })
    }

    ctx.on('llm/stream', function (options, next) {
      const stream = next()

      try {
        if (options.purpose !== undefined) return stream
        if (!options.messages || options.messages.length < MIN_MESSAGES) return stream

        const lastMsg = options.messages[options.messages.length - 1]
        if (lastMsg && lastMsg.source && lastMsg.source.kind === 'plugin' && lastMsg.source.plugin === PLUGIN_TAG) {
          return stream
        }

        if (options.messages.length === lastAnalyzedCount) return stream

        // Always snapshot the latest valid options for manual trigger
        lastOptions = options

        // Count this as a real turn
        turnsSinceLastAnalysis += 1

        // Only auto-fire if enabled and interval reached
        if (!autoEnabled) return stream
        if (turnsSinceLastAnalysis < ANALYSIS_INTERVAL) return stream

        const llm = ctx.get('llm')
        if (llm === undefined) return stream

        scheduleAnalysis(llm, options)
      } catch (err) {
        console.error('contradictions-indicator: waterfall filter error', err)
      }

      return stream
    })
  }
}
