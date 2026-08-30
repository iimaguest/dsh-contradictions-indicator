# Contradictions Indicator — DSH Cordis Plugin Implementation Plan

## 1. What We Are Building

A dynamic Cordis plugin that silently observes every model call in the current session, fires a **parallel model call** using the **identical conversation prefix** (to get KV cache hits from the provider), appends a single user message asking the model to analyze contradictions, and displays the result — a **coherence score (0–100%)** and a **commentary** — in a small persistent UI widget in the DSH Web GUI.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        HOST (Node.js)                       │
│                                                             │
│  ┌──────────────────────┐    ┌────────────────────────────┐ │
│  │  llm/stream waterfall │    │  In-memory state store     │ │
│  │  (observe the exact   │───▶│  { score, commentary,      │ │
│  │   GenerateOptions)    │    │    status, messageCount }   │ │
│  └──────────────────────┘    └─────────────┬──────────────┘ │
│                                            │                │
│  ┌──────────────────────┐                  │                │
│  │  Parallel llm.stream()│◀── fires async ─┘                │
│  │  same prefix + analysis                                  │
│  │  user message appended│                                  │
│  └──────────────────────┘                                   │
│                                                             │
│  ┌──────────────────────┐                                   │
│  │  harness.handle() RPC │◀── Client calls host.call()      │
│  │  'get-analysis'       │                                  │
│  └──────────────────────┘                                   │
├─────────────────────────────────────────────────────────────┤
│                     CLIENT (Browser)                        │
│                                                             │
│  ┌──────────────────────┐    ┌────────────────────────────┐ │
│  │  Header utility badge │    │  Overlay panel             │ │
│  │  (score + color pill) │───▶│  (commentary + score +     │ │
│  │  conversation.session │    │   re-analyze button)       │ │
│  │  .header.utilities    │    │  shell.overlay             │ │
│  └──────────────────────┘    └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The KV Cache Strategy — WHY This Design

This is the core insight driving every design decision.

LLM providers (Anthropic, OpenAI, DeepSeek) cache the key-value attention pairs from processing a conversation. If a subsequent request sends the **byte-identical prefix**, the provider skips re-computing attention for all cached tokens and only computes the new tokens at the end. This makes the parallel analysis call **cheap** — most of the conversation is already cached from the main agent call that just completed.

**Rules to preserve KV cache hits:**

1. **Same `provider` and `model`** — cache is per-model
2. **Same `system` prompt** — byte-identical, including whitespace
3. **Same `messages` array** — identical objects in identical order
4. **Same `tools` array** — identical tool schemas
5. **Only append** — add our analysis instruction as the final user message; never insert, reorder, or modify anything before it
6. **Same `sessionId`** — some providers key cache on session

The `dsh-compaction-basic` module in the harness follows this exact pattern. Its agent note says: *"reuse the conversation's own system prompt, tools, and messages so the provider's KV cache is not invalidated."* We follow the same approach.

---

## 4. Implementation Steps — In Order

### Phase 1: Host Side

#### Step 1.1: Observe the `llm/stream` waterfall

**What:** Register a listener on the `llm/stream` waterfall event. This fires for **every** model call in the process (main agent, compaction, session title, etc.).

**Why this hook and not others:**
- `agent/pre-step` gives us the agent before the call, but not the frozen `GenerateOptions`.
- `agent/request` gives us the `LlmCallConfig` (provider/model only), not the full messages/tools.
- `agent/turn-stopping` fires after the turn, but we'd have to reconstruct the request.
- `llm/stream` is the only hook that gives us the **exact frozen `GenerateOptions`** — the identical object the provider just processed.

**How:**

```js
ctx.on('llm/stream', async (options, next) => {
  // 1. Let the main call proceed FIRST — never block it
  const stream = await next()
  
  // 2. Fire analysis asynchronously AFTER returning the stream
  //    (see Step 1.3 for the async analysis logic)
  scheduleAnalysis(options)
  
  // 3. Return the original stream unchanged
  return stream
})
```

**Critical:** This is a waterfall. You MUST call `next()` and return its result. Never swallow it. Never delay it. The main agent call must proceed unimpeded.

#### Step 1.2: Filter — only analyze the main agent's conversation calls

**What:** The `llm/stream` waterfall fires for ALL model calls: compaction summaries, session titles, our own analysis calls, etc. We must only trigger on the main conversation call.

**How to filter:**

```js
// FILTER 1: Skip calls with a purpose (compaction, session-title)
if (options.purpose !== undefined) return next()

// FILTER 2: Skip calls without tools (title/compaction don't have tools usually)
// Actually, compaction DOES pass tools through. Better filter:

// FILTER 3: Skip if the messages array is too short (less than 2 messages = nothing to analyze)
if (!options.messages || options.messages.length < 4) return next()

// FILTER 4: Debounce — skip if we already analyzed this message count
// Use the message count as a cheap change-detection proxy
if (options.messages.length === lastAnalyzedMessageCount) return next()
```

**The `purpose` field** is the primary filter. The harness marks compaction calls with `purpose: 'compaction'` and title calls with `purpose: 'session-title'`. Main agent conversation calls leave `purpose` unset. Our own analysis call will also leave `purpose` unset, so we need a secondary filter (see Step 1.3).

#### Step 1.3: Fire the parallel analysis call

**What:** After the waterfall returns, asynchronously fire a separate `ctx.llm.stream()` call with the same conversation prefix plus our analysis prompt.

**IMPORTANT — Do NOT await this inside the waterfall.** The waterfall must return immediately. Fire-and-forget the analysis call.

**How:**

```js
// State held in the Host plugin's closure
let analysisState = { score: null, commentary: null, status: 'idle', messageCount: 0 }
let lastAnalyzedMessageCount = 0
let analysisInProgress = false
let analysisAbortController = null

function scheduleAnalysis(options) {
  // Prevent re-entry
  if (analysisInProgress) return
  
  // Debounce: skip if same message count
  if (options.messages.length === lastAnalyzedMessageCount) return
  
  analysisInProgress = true
  lastAnalyzedMessageCount = options.messages.length
  analysisState = { ...analysisState, status: 'analyzing' }
  
  // Cancel any previous in-flight analysis
  if (analysisAbortController) analysisAbortController.abort()
  analysisAbortController = new AbortController()
  
  // Fire async — do NOT await
  runAnalysis(options, analysisAbortController.signal)
    .then(result => {
      analysisState = { 
        score: result.score, 
        commentary: result.commentary, 
        status: 'ready',
        messageCount: options.messages.length 
      }
    })
    .catch(err => {
      console.error('Contradiction analysis failed:', err)
      analysisState = { ...analysisState, status: 'error' }
    })
    .finally(() => {
      analysisInProgress = false
    })
}
```

#### Step 1.4: Construct the analysis request

**What:** Build a `GenerateOptions` object with the identical prefix and an appended user message.

**CRITICAL — Message construction without imports:**

In the dynamic plugin environment, you cannot `import { createUserMessage } from '@deepseek-ai/dsh-llm'`. You must construct message objects by hand. A message is a plain frozen object:

```js
{
  id: 'msg-' + Math.random().toString(36).slice(2),  // unique string
  role: 'user',
  content: [{ type: 'text', text: '...' }],
  source: { kind: 'plugin', plugin: 'contradictions-indicator' }
}
```

**The analysis request construction:**

```js
async function runAnalysis(originalOptions, signal) {
  const llm = ctx.get('llm')
  if (!llm) throw new Error('llm service unavailable')
  
  // Clone the messages array and append our instruction
  // DO NOT modify the original — it's deep-frozen
  const analysisMessage = {
    id: 'contra-' + Math.random().toString(36).slice(2) + Date.now(),
    role: 'user',
    content: [{ type: 'text', text: ANALYSIS_PROMPT }],
    source: { kind: 'plugin', plugin: 'contradictions-indicator' }
  }
  
  const messages = []
  for (let i = 0; i < originalOptions.messages.length; i++) {
    messages.push(originalOptions.messages[i])
  }
  messages.push(analysisMessage)
  
  // Build the request — identical prefix, different suffix
  const analysisOptions = {
    provider: originalOptions.provider,
    model: originalOptions.model,
    messages: messages,
    // Include system prompt if present — BYTE IDENTICAL for KV cache
    ...(originalOptions.system !== undefined ? { system: originalOptions.system } : {}),
    // Include tools if present — BYTE IDENTICAL for KV cache  
    ...(originalOptions.tools !== undefined ? { tools: originalOptions.tools } : {}),
    // DO NOT set purpose — it's not 'compaction' or 'session-title'
    // Omitting purpose is correct for auxiliary calls
    maxTokens: 2048,
    signal: signal
  }
  
  // Stream and collect the response
  let fullText = ''
  let finished = false
  
  for await (const chunk of llm.stream(analysisOptions)) {
    if (signal.aborted) break
    
    if (chunk.type === 'text-delta') {
      fullText += chunk.text
    }
    if (chunk.type === 'finish') {
      finished = true
      if (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted') {
        throw new Error('Analysis call failed: ' + chunk.reason.kind)
      }
    }
  }
  
  // Parse score and commentary from the response
  return parseAnalysisResponse(fullText)
}
```

#### Step 1.5: The analysis prompt

**What:** The user message we append to the conversation prefix. It must instruct the model to:
1. NOT use any tools
2. Analyze contradictions in the conversation
3. Return a structured response with both commentary and score

```js
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
  '<your analysis here>',
  '',
  'Where 0 means the conversation is riddled with contradictions,',
  'and 100 means the conversation is perfectly smooth and consistent.',
  'If you find no contradictions, say so and give a high score.',
].join('\n')
```

#### Step 1.6: Parse the response

```js
function parseAnalysisResponse(text) {
  let score = null
  let commentary = text
  
  // Extract score
  var scoreMatch = text.match(/SCORE:\s*(\d+)/)
  if (scoreMatch) {
    score = Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10)))
  }
  
  // Extract analysis section
  var analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*)/)
  if (analysisMatch) {
    commentary = analysisMatch[1].trim()
  }
  
  // Fallback: if parsing fails, use the whole text as commentary
  if (score === null) {
    // Try to find any number that could be a score
    var numMatch = text.match(/\b(\d{1,3})\b/)
    if (numMatch) {
      var n = parseInt(numMatch[1], 10)
      if (n >= 0 && n <= 100) score = n
    }
  }
  
  return { score: score !== null ? score : 50, commentary: commentary || text }
}
```

#### Step 1.7: Register the RPC handler

**What:** The Client needs to fetch the analysis state from the Host. Use `harness.handle()` for Package-private JSON RPC.

```js
harness.handle('get-analysis', function(args) {
  return {
    score: analysisState.score,
    commentary: analysisState.commentary,
    status: analysisState.status,
    messageCount: analysisState.messageCount
  }
})
```

**One handler is sufficient.** The Client polls `get-analysis` on an interval. No need for a `trigger-analysis` handler because analysis auto-triggers from the `llm/stream` waterfall.

#### Step 1.8: Prevent infinite recursion

**CRITICAL BUG PREVENTION:** Our analysis call goes through `llm.stream()`, which fires the `llm/stream` waterfall again. Our own listener will see it and try to analyze it. This creates an infinite loop.

**Solution:** Use a re-entry guard flag.

```js
let isOurCall = false

ctx.on('llm/stream', async (options, next) => {
  const stream = await next()
  
  // Skip our own calls
  if (isOurCall) return stream
  
  // Skip calls with a purpose
  if (options.purpose !== undefined) return stream
  
  // Skip short conversations
  if (!options.messages || options.messages.length < 4) return stream
  
  scheduleAnalysis(options)
  return stream
})

async function runAnalysis(originalOptions, signal) {
  isOurCall = true
  try {
    // ... the llm.stream() call ...
  } finally {
    isOurCall = false
  }
}
```

**Alternative approach (more robust):** Check if the last message in `options.messages` is our own analysis prompt. If the last message has `source.plugin === 'contradictions-indicator'`, skip it. But the re-entry flag is simpler and more reliable since our analysis call runs asynchronously and the flag is checked synchronously.

Actually, since analysis is async, the flag approach has a race condition. **Better approach:** Check the messages themselves:

```js
ctx.on('llm/stream', async (options, next) => {
  const stream = await next()
  
  if (options.purpose !== undefined) return stream
  if (!options.messages || options.messages.length < 4) return stream
  
  // Check if the last message is our own analysis prompt
  var lastMsg = options.messages[options.messages.length - 1]
  if (lastMsg && lastMsg.source && lastMsg.source.kind === 'plugin' 
      && lastMsg.source.plugin === 'contradictions-indicator') {
    return stream
  }
  
  scheduleAnalysis(options)
  return stream
})
```

This is race-free because it checks the frozen request content, not mutable state.

---

### Phase 2: Client Side

#### Step 2.1: Register the header utility badge

**What:** A small pill/badge in `conversation.session.header.utilities` showing the coherence score with a color indicator.

**Slot registration pattern (from Inspect query):**

- Slot name: `conversation.session.header.utilities`
- Kind: `list`
- Scope: `session`
- Registration: `{ id: string (required), order?: number, label?: string }`
- Standard props available: `useSession`, `sessionId`, `useProjection`, etc.
- Owner props: none (self-sufficient)

```js
const slots = ctx.get('slots')
if (!slots) return

slots.inject('conversation.session.header.utilities', function() {
  return slots.register(
    { id: 'contradictions-indicator', order: 10 },
    function(props) {
      return React.createElement(ContradictionsBadge, props)
    }
  )
})
```

#### Step 2.2: Build the badge component

**What:** A React component (using `React.createElement`, never JSX) that:
1. Polls `host.call('get-analysis')` on an interval
2. Shows a colored circle + score percentage
3. Toggles an overlay on click

```js
function ContradictionsBadge(props) {
  var stateRef = React.useState({ score: null, commentary: null, status: 'idle' })
  var state = stateRef[0]
  var setState = stateRef[1]
  
  var overlayRef = React.useState(false)
  var showOverlay = overlayRef[0]
  var setShowOverlay = overlayRef[1]
  
  // Poll the host for analysis state
  React.useEffect(function() {
    var cancelled = false
    
    function poll() {
      if (cancelled) return
      host.call('get-analysis').then(function(result) {
        if (!cancelled) setState(result)
      }).catch(function() {})
    }
    
    poll()
    var interval = setInterval(poll, 3000) // Poll every 3 seconds
    
    return function() {
      cancelled = true
      clearInterval(interval)
    }
  }, [])
  
  // Don't render until we have data
  if (state.status === 'idle' || state.score === null) {
    if (state.status === 'analyzing') {
      return React.createElement('div', {
        style: badgeStyle('gray'),
        title: 'Analyzing contradictions...'
      }, '⟳')
    }
    return null
  }
  
  var color = state.score >= 80 ? '#22c55e' : state.score >= 50 ? '#eab308' : '#ef4444'
  
  return React.createElement('button', {
    onClick: function() { setShowOverlay(!showOverlay) },
    style: {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '12px',
      border: '1px solid ' + color, background: 'transparent',
      color: color, fontSize: '12px', fontWeight: '600',
      cursor: 'pointer', lineHeight: '1.4',
      fontFamily: 'inherit'
    },
    title: 'Coherence score — click to see analysis'
  },
    React.createElement('span', {
      style: { 
        width: '8px', height: '8px', borderRadius: '50%',
        backgroundColor: color, display: 'inline-block', flexShrink: '0'
      }
    }),
    state.score + '%'
  )
}
```

#### Step 2.3: Register the overlay panel

**What:** A floating panel in `shell.overlay` that shows the full analysis.

**Slot registration pattern (from Inspect query):**

- Slot name: `shell.overlay`
- Kind: `list`
- Scope: `root`
- Registration: `{ id: string (required), order?: number }`
- Note: The overlay layer is click-through by default. Entries must opt into pointer events.

```js
slots.inject('shell.overlay', function() {
  return slots.register(
    { id: 'contradictions-overlay', order: 50 },
    function() {
      return React.createElement(ContradictionsOverlay, null)
    }
  )
})
```

#### Step 2.4: Build the overlay component

The overlay reads the same analysis state and provides the detailed view. It should render `null` when hidden (the overlay slot is click-through, so invisible entries don't block the app).

**Design:** A floating card in the bottom-right corner with:
- Score prominently displayed (large number, colored)
- Commentary text below
- Close button
- "Analyzing..." spinner state

#### Step 2.5: State coordination between badge and overlay

**Problem:** The badge and overlay are in different slots (different React trees). They need shared state.

**Solution:** Both components poll `host.call('get-analysis')` independently. The overlay's visibility is controlled by a module-level variable toggled by the badge. Use a simple pub/sub pattern in the Client plugin's closure:

```js
// Module-level shared state in the Client plugin closure
var overlayVisible = false
var overlayListeners = []

function toggleOverlay() {
  overlayVisible = !overlayVisible
  overlayListeners.forEach(function(fn) { fn(overlayVisible) })
}

function subscribeOverlay(fn) {
  overlayListeners.push(fn)
  return function() {
    overlayListeners = overlayListeners.filter(function(f) { return f !== fn })
  }
}
```

The badge calls `toggleOverlay()` on click. The overlay subscribes via `subscribeOverlay()` in a `useEffect` and renders `null` when not visible.

#### Step 2.6: Insert CSS

**What:** Use `styles.insert(css)` for the overlay panel styles. The returned disposer is automatically cleaned up with the plugin.

```js
styles.insert([
  '.contra-overlay {',
  '  position: fixed; bottom: 16px; right: 16px;',
  '  width: 380px; max-height: 60vh;',
  '  border-radius: 12px; overflow: hidden;',
  '  box-shadow: 0 8px 32px rgba(0,0,0,0.2);',
  '  z-index: 1000; pointer-events: auto;',
  '  background: var(--dsh-color-bg-surface, #1a1a2e);',
  '  border: 1px solid var(--dsh-color-border-default, #333);',
  '  color: var(--dsh-color-text-primary, #e0e0e0);',
  '  font-family: inherit;',
  '}',
  '.contra-overlay-header {',
  '  padding: 16px; display: flex; align-items: center;',
  '  justify-content: space-between;',
  '  border-bottom: 1px solid var(--dsh-color-border-default, #333);',
  '}',
  '.contra-overlay-body {',
  '  padding: 16px; overflow-y: auto; max-height: calc(60vh - 80px);',
  '  font-size: 13px; line-height: 1.6;',
  '  white-space: pre-wrap; word-break: break-word;',
  '}',
  '.contra-score-big {',
  '  font-size: 36px; font-weight: 700; margin: 0;',
  '}',
].join('\n'))
```

Use CSS custom properties (theme tokens) where possible. Query `Theme.listTokens` before hardcoding colors. The fallback values in the CSS above are safe defaults, but the actual token names should come from the Inspect query.

---

### Phase 3: Integration and Testing

#### Step 3.1: Define the plugin

Call `cordis_define` with:
- `plugin.kind: 'new'`
- `plugin.idPrefix: 'contra'` (3–6 lowercase letters)
- Both `code.host` and `code.client`

#### Step 3.2: Run the plugin

Call `cordis_run` with `mode: 'run'` and the returned `pluginId` + `packageId`.

#### Step 3.3: Test

1. Send a few messages in a conversation
2. Wait for the badge to appear in the header
3. Click the badge to open the overlay
4. Verify the score and commentary make sense
5. Send contradictory messages and verify the score drops

---

## 5. DO's and DON'Ts

### DO's

| # | Do | Why |
|---|---|---|
| 1 | **DO** call `next()` immediately in the `llm/stream` waterfall and return its result | Blocking the waterfall blocks the main agent's model call |
| 2 | **DO** fire analysis asynchronously (fire-and-forget from the waterfall) | The waterfall must return promptly |
| 3 | **DO** copy the messages array with a `for` loop before appending | The original is deep-frozen; `push()` on it throws |
| 4 | **DO** use `ctx.get('llm')` with an undefined check, not `ctx.llm` | `ctx.llm` requires `inject: ['llm']` declaration |
| 5 | **DO** use `ctx.get('slots')` in Client code | Same reason — optional access pattern |
| 6 | **DO** check `options.purpose !== undefined` to skip non-conversation calls | Prevents analyzing compaction/title calls |
| 7 | **DO** check the last message's `source.plugin` to prevent infinite recursion | Our analysis call goes through `llm/stream` too |
| 8 | **DO** use `React.createElement()`, never JSX | Client code has no JSX transformer |
| 9 | **DO** use `host.call()` for Client→Host RPC | The Package-private channel |
| 10 | **DO** use `styles.insert()` for CSS | Automatically cleaned up on plugin stop |
| 11 | **DO** provide abort signal handling | Cancel in-flight analysis when a new one starts |
| 12 | **DO** use theme CSS variables for colors in styles | Respects light/dark mode |
| 13 | **DO** use `slots.inject()` before `slots.register()` | `inject` waits for the slot to be declared |
| 14 | **DO** construct message IDs as unique strings | `'contra-' + Math.random().toString(36).slice(2) + Date.now()` |

### DON'Ts

| # | Don't | Why |
|---|---|---|
| 1 | **DON'T** use `import` or `require` | Dynamic plugin code is plain JS, not bundled |
| 2 | **DON'T** use TypeScript types, `as`, decorators, or JSX | No transformation pipeline |
| 3 | **DON'T** use `setTimeout` or `setInterval` directly | They're not available. Use `ctx.get('timer')` with `inject: ['timer']`, or in Client use `setInterval` only inside React's `useEffect` (it IS available in the browser) |
| 4 | **DON'T** mutate the original `options.messages` | Deep-frozen by the agent loop; mutation throws |
| 5 | **DON'T** set `purpose` on our analysis call | Only `'compaction'` and `'session-title'` are valid values |
| 6 | **DON'T** use `JSON.stringify` on Services, Events, or Cordis objects | They're live internal data, not serializable |
| 7 | **DON'T** use `structuredClone` on the `GenerateOptions` | Deep-frozen objects with circular refs will fail; just reference the existing messages |
| 8 | **DON'T** cache the `GenerateOptions` object long-term | It references large frozen data; hold only what you need (score, text) |
| 9 | **DON'T** block the waterfall waiting for analysis to complete | This would freeze the main conversation |
| 10 | **DON'T** use `window`, `document`, `fetch`, `process`, or `Buffer` | Not confirmed as builtins |
| 11 | **DON'T** create a second plugin for the same task | One plugin with both Host and Client halves |
| 12 | **DON'T** register global side effects outside `apply()` | Everything must be lifecycle-managed |
| 13 | **DON'T** modify the `tools` array | Pass it through unchanged for KV cache |
| 14 | **DON'T** modify or reorder existing messages | Only APPEND your user message at the end |
| 15 | **DON'T** use arrow functions in the Client React code if targeting older patterns | Regular `function` declarations are safer in the evaluator |

---

## 6. Detailed File-by-File Code Structure

### 6.1 Host Code (`code.host`)

The Host code is a plain JavaScript function body that returns a Cordis Plugin object.

```
return {
  apply(ctx) {
    // ── State ──────────────────────────────────────────────
    // In-memory analysis state (survives across calls, dies with plugin)
    let analysisState = { score: null, commentary: null, status: 'idle', messageCount: 0 }
    let analysisInProgress = false
    let currentAbort = null
    
    // ── Constants ──────────────────────────────────────────
    const ANALYSIS_PROMPT = '...'  // (the full prompt from Step 1.5)
    const MIN_MESSAGES = 4         // Don't analyze tiny conversations
    
    // ── RPC Handler ────────────────────────────────────────
    harness.handle('get-analysis', function() {
      return { ...analysisState }  // Return a plain copy
    })
    
    // ── Waterfall Listener ─────────────────────────────────
    ctx.on('llm/stream', function(options, next) {
      // ALWAYS call and return next() first
      var stream = next()
      
      // Filter: skip non-conversation calls
      if (options.purpose !== undefined) return stream
      if (!options.messages || options.messages.length < MIN_MESSAGES) return stream
      
      // Filter: skip our own analysis calls (check last message source)
      var lastMsg = options.messages[options.messages.length - 1]
      if (lastMsg && lastMsg.source && lastMsg.source.kind === 'plugin'
          && lastMsg.source.plugin === 'contradictions-indicator') {
        return stream
      }
      
      // Debounce: skip if same message count already analyzed
      if (options.messages.length === analysisState.messageCount
          && analysisState.status === 'ready') {
        return stream
      }
      
      // Schedule analysis (fire-and-forget)
      scheduleAnalysis(options)
      
      return stream
    })
    
    // ── Analysis Engine ────────────────────────────────────
    function scheduleAnalysis(options) { ... }
    async function runAnalysis(options, signal) { ... }
    function parseResponse(text) { ... }
  }
}
```

### 6.2 Client Code (`code.client`)

The Client code is a plain JavaScript function body that returns a Cordis Plugin object.

```
return {
  apply(ctx) {
    var slots = ctx.get('slots')
    if (!slots) return
    
    // ── Shared overlay state ───────────────────────────────
    var overlayVisible = false
    var overlayListeners = []
    function toggleOverlay() { ... }
    function subscribeOverlay(fn) { ... }
    
    // ── CSS ────────────────────────────────────────────────
    styles.insert('...')
    
    // ── Badge Component ────────────────────────────────────
    function ContradictionsBadge(props) { ... }
    
    // ── Overlay Component ──────────────────────────────────
    function ContradictionsOverlay() { ... }
    
    // ── Slot Registrations ─────────────────────────────────
    slots.inject('conversation.session.header.utilities', function() {
      return slots.register(
        { id: 'contradictions-indicator', order: 10 },
        function(props) { return React.createElement(ContradictionsBadge, props) }
      )
    })
    
    slots.inject('shell.overlay', function() {
      return slots.register(
        { id: 'contradictions-overlay', order: 50 },
        function() { return React.createElement(ContradictionsOverlay, null) }
      )
    })
  }
}
```

---

## 7. Edge Cases and Error Handling

| Scenario | Handling |
|---|---|
| Model call fails (rate limit, network) | Catch in `runAnalysis`, set `status: 'error'`, badge shows gray. Don't crash. Don't retry. |
| User sends rapid messages (4 turns in 10 seconds) | Each new `llm/stream` cancels any in-flight analysis via AbortController, starts a fresh one |
| Very long conversation (100+ messages) | Works fine — the KV cache makes the prefix cheap. The analysis prompt is only ~200 tokens. But `maxTokens: 2048` limits the response. |
| Conversation has only tool calls, no text | Analysis still works — the model can see the tool calls and tool results. The filter checks `messages.length >= 4`, not text content. |
| Plugin is stopped mid-analysis | Cordis fiber disposal handles cleanup. The AbortController should be linked to the fiber if possible, or the dangling promise just resolves with no effect (the state variables are in a disposed closure). |
| Multiple sessions open | The `llm/stream` waterfall fires for ALL sessions in the process. The state is shared. This is acceptable for v1 — the last-analyzed session's result shows. For v2, key the state by `options.sessionId`. |
| Compaction happens (messages are summarized) | The next `llm/stream` call will have different messages (the compacted ones). This is fine — we analyze whatever the current state is. |
| No model provider configured | `ctx.get('llm')` returns undefined → `runAnalysis` throws → state becomes `'error'` → badge shows gray |

---

## 8. Future Enhancements (Out of Scope for v1)

1. **Per-session state**: Key the analysis state by `options.sessionId` to support multiple open sessions
2. **History chart**: Track scores over time and show a sparkline in the badge
3. **Selective analysis**: Let the user pick which turns to analyze
4. **Different model**: Option to use a cheaper/faster model for analysis instead of the main model
5. **Streaming display**: Show the analysis text streaming in real-time in the overlay
6. **Persistent cache**: Store analysis results in the session log (probably not worth the complexity for a dynamic plugin)
7. **Notification**: Flash the badge or show a toast when the score drops significantly

---

## 9. Complete Build Order Checklist

```
[ ] 1. Write the Host code
    [ ] 1a. State variables and constants
    [ ] 1b. ANALYSIS_PROMPT text
    [ ] 1c. harness.handle('get-analysis')
    [ ] 1d. ctx.on('llm/stream') with filters
    [ ] 1e. scheduleAnalysis() with abort handling
    [ ] 1f. runAnalysis() with manual chunk collection
    [ ] 1g. parseResponse() with fallback parsing
    
[ ] 2. Write the Client code
    [ ] 2a. Overlay state pub/sub in closure
    [ ] 2b. styles.insert() for overlay CSS
    [ ] 2c. ContradictionsBadge component with polling
    [ ] 2d. ContradictionsOverlay component
    [ ] 2e. slots.inject + register for header.utilities
    [ ] 2f. slots.inject + register for shell.overlay

[ ] 3. Define the plugin
    [ ] 3a. cordis_define with both code.host and code.client
    [ ] 3b. Verify pluginId and packageId in response

[ ] 4. Run the plugin  
    [ ] 4a. cordis_run with mode 'run'
    [ ] 4b. Handle approval if needed (approval is currently "never" so auto-approved)
    [ ] 4c. Wait for 'starting' → check for success/failure

[ ] 5. Test
    [ ] 5a. Send 3+ messages to trigger first analysis
    [ ] 5b. Verify badge appears in header
    [ ] 5c. Click badge, verify overlay opens
    [ ] 5d. Send contradictory messages, verify score changes
    [ ] 5e. Check console for errors

[ ] 6. If errors occur
    [ ] 6a. cordis_inspect_self(pluginId, packageId) to read diagnostics
    [ ] 6b. Fix in a NEW package (cordis_define with plugin.kind: 'existing')
    [ ] 6c. cordis_run with mode 'update'
```

---

## 10. Reference: Exact API Signatures Used

### Host Builtins
- `ctx.get(name: string): unknown | undefined`
- `ctx.on(name: string, listener: Function): () => void`
- `harness.handle(method: string, handler: (args) => JsonValue | Promise<JsonValue>): () => void`
- `console.log(...values): void`
- `console.error(...values): void`

### Host Services (accessed via `ctx.get()`)
- `llm.stream(options: GenerateOptions): AsyncIterable<StreamChunk>`

### Client Builtins
- `ctx.get(name: string): unknown | undefined`
- `React.createElement(type, props, ...children): ReactElement`
- `React.useState(initial)`
- `React.useEffect(effect, deps)`
- `host.call(method: string, args?: JsonValue): Promise<JsonValue>`
- `styles.insert(css: string): () => void`
- `console.log(...values): void`

### Client Services (accessed via `ctx.get()`)
- `slots.inject(key, callback): () => void`
- `slots.register(options, render): disposer`

### Events
- `'llm/stream'` — waterfall, signature: `(options: GenerateOptions, next: () => AsyncIterable<StreamChunk>) => AsyncIterable<StreamChunk>`

### Slots
- `conversation.session.header.utilities` — list, session-scoped, `{ id: string, order?: number }`
- `shell.overlay` — list, root-scoped, `{ id: string, order?: number }`

### Key Types (not importable — construct by hand)

**Message:**
```js
{ id: string, role: 'user'|'assistant'|'system', content: ContentBlock[], source: MessageSource }
```

**ContentBlock (text):**
```js
{ type: 'text', text: string }
```

**MessageSource (plugin):**
```js
{ kind: 'plugin', plugin: string }
```

**StreamChunk (relevant types):**
```js
{ type: 'text-delta', index: number, text: string }
{ type: 'finish', reason: FinishReason, replayState?: ReplayEnvelope }
{ type: 'block-end', index: number, block: ContentBlock }
```

**GenerateOptions:**
```js
{
  provider: string,
  model: string,
  messages: Message[],
  system?: string,
  tools?: ToolSchema[],
  maxTokens?: number,
  signal?: AbortSignal,
  sessionId?: string,
  purpose?: 'compaction' | 'session-title'  // DO NOT SET for our call
}
```
