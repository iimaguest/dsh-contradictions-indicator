# Contradictions Indicator — DSH Cordis Plugin

A dynamic Cordis plugin for DSH Web that watches the running conversation,
fires a parallel, KV-cache-friendly model call after each turn to analyze
the conversation for internal contradictions, and shows the result as a
small coherence-score badge (0% = very contradictory, 100% = smooth) plus
a detailed commentary overlay.

## Status

Implemented and verified running in the DSH Web GUI as dynamic Cordis
Plugin `contra-1`, current Package `pkg-3` (Host + Client combined).

Package history on `contra-1`:

| Package | Host half | Client half | Outcome |
|---|---|---|---|
| `pkg-1` | ✅ | ✅ | Failed to activate: `slots.register` call was missing the required `name` field identifying the target slot. |
| `pkg-2` | ❌ (omitted by mistake) | ✅ (fixed `name` field) | Activated successfully, but shipped **without** the analysis engine — the badge/overlay rendered with no data source. |
| `pkg-3` | ✅ | ✅ | **Current.** Combines the working Host analysis engine with the fixed Client registration in one Package. Verified running: Host reports handler `get-analysis`; Client reports `running`. |

The files in `plugin/host.js` and `plugin/client.js` in this repository are
the exact source of `pkg-3`, kept here as the durable, version-controlled
copy (dynamic Cordis Package definitions live only in the running DSH
process and do not survive a process restart).

## Architecture

```
Host (Node.js)
  ctx.on('llm/stream', (options, next) => { ... })
    - calls next() first, never blocks the main model call
    - filters: skips options.purpose calls (compaction/session-title),
      skips conversations under 4 messages, skips its own recursive
      analysis calls (detected via the appended message's
      source.plugin === 'contradictions-indicator'), debounces on
      message count
    - fires ctx.llm.stream() asynchronously with the IDENTICAL prefix
      (provider, model, system, tools, sessionId, messages) plus one
      appended user message instructing "do not use tools, analyze
      contradictions" — preserving the provider's KV/prefix cache
    - manually collects text-delta chunks (no BlockAssembler import
      available in the dynamic-plugin sandbox)
    - parses "SCORE: <n>" / "ANALYSIS: <text>" from the response
    - exposes the latest result via harness.handle('get-analysis', ...)

Client (Browser)
  - polls host.call('get-analysis') every 3s (ctx.interval, inject: ['timer'])
  - renders a colored score badge in
    conversation.session.header.utilities (green ≥80%, yellow ≥50%,
    red <50%, plus "Analyzing…" / "Analysis error" states)
  - renders a click-to-expand overlay panel in shell.overlay with the
    full score and commentary text
  - styled with real DSH theme tokens (--dsw-alias-*) so it follows
    light/dark mode
```

See `IMPLEMENTATION_PLAN.md` for the full design rationale, the KV-cache
strategy explanation, and the detailed DO/DON'T list used while building
this.

## Files

- `plugin/host.js` — Host half source (Cordis dynamic Plugin function body)
- `plugin/client.js` — Client half source (Cordis dynamic Plugin function body)
- `IMPLEMENTATION_PLAN.md` — original detailed implementation plan handed to the developer

## Known limitations (v1, by design)

- Analysis state is process-global, not per-session. With multiple
  sessions open, the badge reflects whichever session's `llm/stream`
  fired most recently.
- Requires at least 4 messages in the conversation before the first
  analysis triggers.
- If the model provider is unavailable or the analysis call fails, the
  badge shows an "Analysis error" state and does not retry automatically
  until the next real conversation turn.

## Reactivating after a process restart

Dynamic Cordis Plugin definitions do not survive a DSH process restart.
To reactivate, use `cordis_define` (with `plugin.kind: 'existing'` and
`pluginId: 'contra-1'` if the plugin row still exists in this session, or
`plugin.kind: 'new'` for a fresh plugin id) using the source in
`plugin/host.js` and `plugin/client.js`, then `cordis_run`.
