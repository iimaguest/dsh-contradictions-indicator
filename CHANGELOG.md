# Changelog

## 2.0.0

Native dsh 0.2 settings (issue #5). **Breaking: dsh 0.1 hosts are no longer
supported.**

- The host half is now a Cordis `Service` with a `static Config` schema
  (`autoEnabled`, `interval`, `steerEnabled`, `prompt1`, `prompt2`). The
  Settings tab auto-generates a form for the plugin's composed entry from that
  schema — no custom UI needed — and edits persist into the profile patch
  through the settings service.
- All five fields are `volatile`: an edit from the Settings form hot-applies
  through `loader/volatile-update` without remounting the plugin. Per-session
  entries keep their documented read-once semantics — a snapshot is taken when
  the session's entry is first created, and later default edits reach only
  conversations started afterwards.
- `/contradictions/defaults` (the plugin panel's global plane) writes through
  `settings.update(entryId, …)`, so the panel and the native Settings form
  always agree. Without a settings service or composed entry, writes stay
  in memory with a console note.
- Removed: the 0.1 `installSettingsSection`/`installSection` compat chain, the
  `~/.dsh/contradictions-indicator.json` file fallback, and the
  "settings service unavailable" fallback warning. Peers narrowed to
  `@deepseek-ai/dsh-settings ^0.2.0-rc.1`; `@deepseek-ai/cordis` and
  `@deepseek-ai/schemastery` are now required peers (the Service import is
  load-bearing).

## 1.4.2

Fix the irrecoverable "format v4 message requires a producer-owned source
kind" turn failure (issue #3).

- The host half built every durable message source with the retired v3
  wrapper shape `{ kind: 'plugin', plugin: 'contradictions-indicator' }`.
  dsh's v4 session format refuses that shape at admission, and because the
  steer notice is injected into a running turn, the admission throw failed
  the whole turn — the tool call in flight was never persisted and the
  conversation showed "This turn failed". This fired reliably on any
  conversation where an auto-analysis completed mid-turn with steer enabled,
  which is exactly what the 1.4.1 mount fix made reachable on 0.2 hosts.
- Sources now carry the producer-owned kind `plugin:contradictions-indicator`
  with the legacy `plugin` field dropped — the same shape the dsh v3→v4
  migrator lifts old logs to. Verified against the real dsh v4 admission
  code: the new shape is admitted, the old shape reproduces the failure.
- `isOurAnalysisCall`/`isOurSteerCall` recognize both the current kind and
  the retired in-flight wrapper, so self-detection (skipping our own analysis
  and steer messages) keeps working across the transition.

## 1.4.1

Compatibility with dsh 0.2.0-rc.2. No behaviour change on 0.1.x hosts.

- The `@deepseek-ai/dsh-settings` peer range now also accepts the 0.2 line
  (`|| ^0.2.0-rc.1`). This was the only peer the dsh startup compatibility
  gate checks, so 1.4.0 was denied at profile startup on 0.2 — the badge
  never mounted.
- `@deepseek-ai/dsh-client-runtime` is dropped from `dsh.client.inject`. The
  package no longer exists in 0.2 (split into the client store/connection
  modules), and this plugin's client bundle is self-contained: it only asks
  the module loader for `react`.
- On a 0.2 host the settings section is not registered — 0.2 removed the
  `installSettingsSection`/`settingsNamespace` helpers this plugin calls, and
  the service no longer exposes `register` (namespaces now derive from a
  plugin's Config schema). The existing compat chain falls back to
  `~/.dsh/contradictions-indicator.json` with a one-line warn, and the
  in-app settings tab keeps working through this plugin's own endpoints.
  Migrating to the Config-schema model is future work, not a gate.

## 1.4.0

A rewritten default analysis prompt: three axes, a do-not-count list, and a
short-output contract.

- `DEFAULT_PROMPT1` no longer compares only sentences against sentences. The
  checklist now works three axes: the task contract (original request plus
  every amendment; the latest correction supersedes), the visible record (tool
  output as ground truth — claimed passes over error exit codes, files
  declared missing that were read, "verified" with no corresponding action),
  and reasoning and position (plan/actions drift, circular progress,
  evidence-free flips after pushback).
- A do-not-count list keeps healthy evolution from tanking the score:
  acknowledged changes of mind, meaning-preserving rewording, and conclusions
  that changed with new evidence are explicitly not contradictions. The test
  is silence, not change. This matters because the steer reminder fires every
  interval: if healthy evolving conversations scored 60, the running agent
  would learn to ignore it.
- Scoring is anchored to consequence and silence — off-task drift or claims
  the record contradicts belong well below 50 even with no formal
  sentence-level contradiction; acknowledged evolution belongs in the 90s.
- The analysis output is now capped: at most two paragraphs, lead with the
  most consequential conflict, anchor it in the transcript, name the check
  that would settle it; one plain sentence when nothing substantial is found.
  Shorter output also reduces truncation-before-`SCORE:` risk. The
  `SCORE:`/`ANALYSIS:` format contract is unchanged, so parsing and the
  single retry are untouched.
- The prompt opens with the jarring "Stop - WAIT." line to seize attention,
  since the request arrives as a suffix user message on the cached prefix
  mid-run, not as a fresh context.
- Note for existing installs: a prompt saved in settings overrides this
  default. This install's saved value was migrated through
  `/contradictions/defaults` (which updates the live process and persists
  through the settings service); other installs must clear the field or paste
  the new text — restarting alone does not replace a saved value.

## 1.3.4

A clearer, partner-framed analysis prompt.

- `DEFAULT_PROMPT1` no longer opens with a bare "Do NOT use tools" order. It
  now starts with a short explanation of what the call is — a parallel,
  detached review of the transcript above, whose only output is the written
  assessment — and then explains why a tool call cannot help: it is not
  executed, returns nothing, and leaves the check without its answer. The
  text-only requirement is framed as asking a colleague for their read on the
  discussion, followed by the same task list and `SCORE:`/`ANALYSIS:` format.
- Note for existing installs: a prompt saved in settings (Settings →
  Contradictions, or the per-conversation panel) still overrides this default.
  Clear the field, or paste the new text, to pick it up; restarting alone does
  not replace a saved value.

## 1.3.3

Full request parity for the analysis call.

- The analysis request no longer forces a 20k output budget. `maxTokens` is
  forwarded verbatim like every other declared field, so an absent budget stays
  absent and the adapter default applies to both calls instead of only one.
  That was the last field in which the analysis body could differ from the main
  call; with it gone, the body is the main call plus exactly one appended
  message, and only `signal` is deliberately replaced. A session configured
  below 20k output tokens now gets that budget for its analysis too — a
  truncated answer has no `SCORE:` field and is caught by the retry below.
- Kept deliberately: the prompt-length clamp, the HTTP body-size guard, and the
  50-session LRU cap. None of them can reach a model request — they bound a
  setting string, a local route's body, and an in-memory table respectively —
  so they cannot affect the cached prefix.
- Tests updated: the analysis request is asserted to omit `maxTokens` when the
  main call does, alongside the existing field-for-field parity case.

## 1.3.2

Robust analysis responses, and no waking an idle conversation.

- `analysis failed: analysis model call produced no text` is fixed. The request
  carries the session's real tool list on purpose (it is part of the cached
  prefix), so the model can ignore the prompt's "respond with text only"
  instruction and answer with a bare tool call — zero text blocks, no `SCORE:`.
  A response with no text, or without a `SCORE:` field, is now retried exactly
  once before the run is reported as failed. The retry re-sends the identical
  cached prefix, so it is nearly free; the tool list is never dropped to force
  compliance, because removing it would invalidate the whole context cache.
- A reminder is no longer pushed into an idle conversation. `agent.steer()`
  wakes an idle agent, which opened a brand-new turn whose only content was the
  notice. Delivery now happens only while a turn is running, at its next step
  boundary; otherwise the text stays pending and the `agent/pre-step` fallback
  hands it over when that conversation takes its next step. Nothing is dropped.
- Failure messages are precise: `produced no text` vs `returned no SCORE field`,
  after both attempts.
- Tests: 9 cases, covering the running-turn push, the held idle notice, the
  no-text retry, the off-format retry, and the terminal failure after one retry.

## 1.3.1

Cache parity for the parallel analysis call.

- The analysis request now mirrors the main call field for field. It already
  reused the conversation's `provider`, `model`, `system`, `tools`, and
  `messages` prefix, but it silently dropped `reasoningEffort`, `temperature`,
  and `stop`, so the provider resolved adapter defaults instead of the
  session's own settings. Those fields are forwarded verbatim now, and the
  output budget follows the main call's `maxTokens` instead of always being
  20k — never below 20k, since a truncated response wastes the whole call.
  The request body is therefore identical to the call the session just made
  apart from the single appended analysis message.
- Measured on a live conversation: the analysis call was served 138,752
  tokens from the provider's context cache against 16,152 fresh tokens
  (~90% cached), while the main call of the same step read 154,496 cached
  against 216 fresh.
- Regression tests assert the field-for-field parity, the identical message
  prefix plus exactly one appended message, and the 20k output floor.

## 1.3.0

Timely delivery of the coherence report, plus a load-breaking import fix.

- **The system reminder is now pushed as soon as the report is ready.**
  Previously the rendered notice was only handed to the conversation by the
  `agent/pre-step` waterfall, which runs at the start of a step. A
  conversation that went idle while the parallel analysis was still streaming
  therefore stranded the reminder until the next manual user message — it
  looked like the plugin only reacted when you typed something. The notice is
  now submitted to the live agent's inbox with `agent.steer()` the moment the
  analysis completes: an idle conversation opens a turn immediately, a running
  one consumes it at its next step boundary. The pre-step path remains as a
  fallback for when no live agent can be resolved (registry absent, session
  closed, inbox rejection).
- **Fixed a load failure on dsh-settings ≥ 0.1.1.** The host half imported
  `installSettingsSection`/`settingsNamespace` by name; the newer line removed
  those named exports in favour of `settings.installSection(owner, ns, …)`.
  A missing named export fails at module-link time, so on such a host the
  entire host half failed to load — no badge, no analysis, no steer. It now
  uses a namespace import plus a shim that picks whichever API exists, and
  degrades to the JSON settings file when neither is available.
- The `agent/pre-step` fallback no longer creates per-session state for
  unrelated agents (it only reads an existing entry), so stepping agents that
  this plugin never analysed can no longer evict tracked sessions from the
  state map.
- Added host-side regression tests (`npm test`) covering immediate delivery to
  an idle agent, the pre-step fallback, and the steer toggle being off.

## 1.2.1

Compatibility release for dsh 0.1.2-rc.1.

- Widen the optional `@deepseek-ai/dsh-settings` peer range to also cover the
  `^0.1.2-rc.1` line that current dsh builds ship, so peer checks stay clean
  on new hosts. No code changes: verified on 0.1.2-rc.1 that the host
  `llm/stream` and `agent/pre-step` waterfalls and all four client injects
  this plugin uses are unchanged, and the badge, panel, and locale keep
  working.

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
