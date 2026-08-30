# Changelog

## 1.2.0

UI/UX and settings-semantics fixes from user feedback on the web client.

- **Auto-analysis is now ON by default** for every new conversation (was:
  opt-in per session). Turn it off globally in Settings → Contradictions or
  per conversation in the panel. This knowingly changes the shipped default;
  existing stored settings without an explicit `autoEnabled` resolve to on.
- **Settings no longer leak across planes.** Previously the panel's per-session
  edits carried a `persist` flag that wrote the *global* defaults — tuning one
  conversation silently reconfigured every future one. The flag is now ignored
  and removed from the client: `/contradictions/auto` writes only that
  session's state, `/contradictions/defaults` (Settings tab) writes only the
  defaults, and editing defaults never mutates a conversation that already
  exists (each session snapshots the defaults once, at creation).
- **The panel closes on outside click** (and Escape). A capture-phase
  `pointerdown` listener dismisses it when the press lands outside both the
  panel and the header badge, so the badge still toggles normally.
- **Popup palette now matches the app.** The panel uses the shell's real
  `--dsw-*` surface recipe (bg-layer-2 + border-inverted + shadow-lv3), and
  every color/radius/font comes from published theme tokens, so it tracks
  Settings → Appearance like host-owned UI.
- **Settings → Language is respected.** The client registers en/zh
  dictionaries with the shell locale service (`dsh.client.inject` now lists
  `@deepseek-ai/dsh-client-locale`) and re-renders on language switches;
  badge, panel, and settings tab are fully localized.
- **The header badge matches the Session log button** exactly — same
  32px height, 111px min-width, 18px radius capsule — and it now presents as
  a disclosure control (text label, `aria-haspopup="dialog"`, `aria-expanded`,
  rotating caret) instead of looking like a one-click "run analysis" action.
  The actual run lives inside the panel as its primary button.

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
