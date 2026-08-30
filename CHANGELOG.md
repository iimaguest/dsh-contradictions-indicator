# Changelog

## 1.1.0

Security and correctness fixes from a full code review. No user-facing
behavior changes except where noted.

- **HTTP routes are now trust-checked.** `/contradictions/*` sits outside
  DSH's `/api` browser-trust fence, so the plugin applies its own
  `Sec-Fetch-Site`/`Origin` check and rejects cross-site requests. This
  closes a CSRF/DNS-rebinding path that could read prompts or fire an
  unauthenticated analysis call.
- **Single canonical session id.** `llm/stream`, `agent/pre-step` steer
  injection, and every HTTP endpoint all key state by the same
  `options.sessionId`, instead of three different (sometimes disagreeing)
  fallbacks. Fixes steer silently never firing for some sessions.
- **In-flight analysis is now aborted and time-boxed.** A new trigger aborts
  any previous analysis for that session instead of letting it run to
  completion in the background; a 2-minute timeout prevents a hung stream
  from leaving `status: 'analyzing'` (and the Analyze Now button disabled)
  forever. `maxTokens` is intentionally left high (20000): a truncated
  `length` finish before the model reaches `ANALYSIS:` wastes the entire
  parallel call and forces a retry, which costs more than the token
  headroom itself.
- **LRU session eviction** instead of insertion-order FIFO, so an active
  conversation can no longer be evicted (and silently reset) while idle
  older sessions remain.
- **`agent/pre-step` steer preserves the full decision object** (`{
  ...decision, messages }`) instead of dropping every field but `messages`.
  Steer/notice messages are also now excluded from the auto-analysis turn
  counter, removing a possible analysis↔steer amplification loop.
- **All plugin state now lives inside `apply()`** and is torn down (routes
  unregistered, in-flight analyses aborted) when the plugin stops, instead
  of surviving at module scope across restarts.
- **Hardened HTTP body handling**: request bodies over 1&nbsp;MB are now
  rejected (413) and the socket is closed, instead of being silently
  truncated and misparsed as `{}`. `/contradictions/defaults` now
  whitelists known fields instead of spreading an arbitrary body into
  persisted settings. Persisted prompt text is capped at 20,000 characters.
- **Removed the overly broad fallback score regex** that could pick up any
  stray 0–100 number in the model's prose when `SCORE:` was missing;
  unparsable responses now consistently fall back to a neutral 50.
- **`tools` is still passed through unchanged** on the analysis call — this
  was considered for removal during the review but reverted: the analysis
  path only ever reads `text-delta`/`finish` chunks and never dispatches
  tool calls, so passing `tools` carries no execution risk, and dropping it
  would have broken the byte-identical-prefix requirement this plugin
  relies on for provider KV cache reuse.
- **Client:** the injected `<style>` tag is now added and removed via a
  Cordis effect disposer instead of leaking on every plugin stop/reload.
  Fetch responses are now guarded by a per-session generation counter, so a
  slow response for a previous session can no longer overwrite the UI after
  switching sessions. The "analyzing, no score yet" badge is now clickable.
  The Settings tab no longer gets stuck on "Loading…" forever on a failed
  fetch (adds a retry button), and its "Saved" timeout is properly cleared
  on unmount. `PromptFields` array elements now have `key`s, and the
  auto/steer checkbox `id`s are unique per instance instead of hardcoded
  globals. Poll interval reduced from 1.5s to 6s. Overlay gained
  `role="dialog"`, Escape-to-close, and `:focus-visible` styling.

## 1.0.1

- Inject next-turn steer on `agent/pre-step` instead of mutating frozen `llm/stream` options, so the reminder actually reaches the model.

## 1.0.0

- Host plugin watches conversation `llm/stream` calls and runs parallel contradiction analysis.
- Client badge in the session header, overlay commentary, Analyze Now, and Settings → Plugins → Contradictions.
- Opt-in auto-analysis (default interval 25 turns), optional next-turn system-reminder steer, and persisted global defaults.
- Apache License 2.0.
