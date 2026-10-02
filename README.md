# Contradictions Indicator

A DeepSeek Harness plugin that scores the live conversation for internal contradictions and shows a 0–100 coherence badge in the session header.

0 means the conversation is riddled with contradictions. 100 means it is consistent. Click the badge for commentary, a manual Analyze Now button, and per-session controls.

## Install, update, and remove

Use the web profile:

```sh
dsh plugin --profile web add https://github.com/iimaguest/dsh-contradictions-indicator
```

```sh
dsh plugin --profile web update dsh-contradictions-indicator
```

```sh
dsh plugin --profile web remove dsh-contradictions-indicator
```

`dsh plugin --profile web` forwards to pnpm in that profile directory (`add` / `update` / `remove`). After add or update, restart `dsh web` so the host and client halves load. The badge appears in the conversation header utilities. Global defaults live under **Settings → Plugins → Contradictions**.

Requires DSH web with the settings and conversation UI packages that this plugin injects. Tested against dsh 0.1.1-rc.2, 0.1.2-rc.1, and 0.2.0-rc.2.

## What it does

- Watches main conversation `llm/stream` calls (skips compaction, session-title, and its own analysis calls).
- On demand, or on a turn interval, fires a parallel model call that reuses the conversation's provider, model, system prompt, tools, session id, and messages, then appends one analysis user message so the provider KV cache stays warm. Every other request field the session declared — reasoning effort, temperature, stop sequences, and the output budget — is forwarded verbatim too, so the request body is the main call plus exactly one message and no adapter default is substituted anywhere. The only field deliberately replaced is the abort signal. Nothing is ever removed from the request to steer the model's answer: dropping the tool list would invalidate the whole context cache.
- Parses `SCORE: <n>` and `ANALYSIS: <text>` from that response.
- Shows a colored header badge (green ≥80, yellow ≥50, red &lt;50) and an overlay with the commentary.
- Auto-analysis is **on by default** for new conversations (default interval 25 turns, editable 1–500). Turn it off globally in Settings → Plugins → Contradictions, or per conversation in the panel.
- Optional system-reminder steer using `{{score}}` and `{{commentary}}`. While a turn is running it is pushed into the conversation as a user message **the moment the analysis finishes** (`agent.steer()` on the live agent, landing at the next step boundary). An idle conversation is never woken just to carry a notice — the text stays pending and is handed over at that conversation's next step. If no live agent can be resolved (registry absent, session closed, inbox rejection), the same `agent/pre-step` fallback applies. Off entirely if you uncheck it.
- A response that ignores the required `SCORE:`/`ANALYSIS:` format, or that arrives as a bare tool call with no text at all, is retried once before the run is reported as failed. The retry re-sends the identical cached prefix, so it costs almost nothing — and the tool list is never dropped from the request, because removing it would invalidate the provider's context cache.
- The badge, panel, and settings tab are localized (English / 简体中文) through the shell's locale service, so **Settings → Language** applies to this plugin too, and every surface color/radius/shadow comes from the shell's `--dsw-*` theme tokens, so **Settings → Appearance** themes it like host UI.

### Settings: two planes, strictly separated

Global defaults (`autoEnabled`, interval, steer, both prompt texts) live in the plugin's **Settings** section and persist through DSH's settings service into the profile patch (see "Settings in dsh 0.2 (native)" below). Each conversation snapshots those defaults **once, at creation**; after that the conversation's panel owns its own copy. Editing settings therefore affects **only conversations started afterwards** — it never reaches into a live one — and adjusting one conversation never writes back to the defaults (the old `persist` flag on `/contradictions/auto` is ignored and gone).

## HTTP endpoints (local DSH web server)

The host half registers four exact paths on the DSH web server. They are meant for this plugin's client UI on the same origin:

| Method | Path | Purpose |
|---|---|---|
| GET | `/contradictions/state?sessionId=` | Current score, commentary, and session flags |
| POST | `/contradictions/auto?sessionId=` | Update auto-analysis, interval, steer, prompts |
| GET/POST | `/contradictions/defaults` | Read or write global defaults |
| POST | `/contradictions/trigger?sessionId=` | Run analysis now |

These routes are not covered by DSH's `/api` browser-trust fence, so the plugin
applies its own same-origin check (`Sec-Fetch-Site` / `Origin` vs `Host`) and
rejects cross-site requests before touching session state. All four also
reject bodies over 1&nbsp;MB and cap persisted prompt text length.

## Peer packages after a local clone

If you `link:` this directory into a profile, Node resolves imports from the real path and will not see the profile's `@deepseek-ai` packages. Re-run after a fresh clone (`node_modules/` is gitignored):

```sh
./link-peer-deps.sh
```

`dsh-settings`, `schemastery`, and `cordis` are linked — the first two are
bare `import`s the host half has always executed in Node, and since 2.0.0
`cordis` is one too (the `Service` base class). `react` is resolved through
the DSH browser module table, not Node's `node_modules`, so it needs no
linking here.

`@deepseek-ai/dsh-settings` and `react` are marked `optional` in
`package.json` — the correct *install* contract for a DSH host plugin (pnpm
must not duplicate host-provided packages) — while `cordis` and `schemastery`
are required peers since 2.0.0 because the `Service` import is load-bearing.
Optional never means "runs without them": `lib/index.js` hard-imports the
peers it needs and will fail to load if the profile does not provide them.

### Message sources and the v4 session format

Every durable message this plugin emits — the steer notice delivered to a
running turn and the pre-step fallback insert — carries the producer-owned
source kind `plugin:contradictions-indicator`. dsh's v4 session format
refuses the retired v3 wrapper `kind: 'plugin'` at admission, and the refusal
takes the whole running turn down with it, so the plugin must never emit it
(a regression test locks this against the admission rule). The in-flight
analysis request message uses the same kind; it is never persisted.

### Settings in dsh 0.2 (native)

From 2.0.0 the host half is a Cordis `Service` with a `static Config` schema
covering the five global defaults (`autoEnabled`, `interval`, `steerEnabled`,
`prompt1`, `prompt2`). dsh's settings service auto-generates a Settings tab
form for the plugin's composed entry from that schema, edits persist into the
profile patch through `settings.update`, and every field is `volatile` — an
edit hot-applies via `loader/volatile-update` without remounting the plugin.
Per-session entries snapshot these defaults once, at creation (Settings edits
reach conversations started afterwards, never mid-flight ones). The plugin
panel's global plane (`POST /contradictions/defaults`) writes through the same
service, so the panel and the native form cannot drift apart. On a host with
no settings service or no composed entry, global writes stay in memory with a
console note; dsh 0.1 hosts are not supported at all (peers narrowed to
`@deepseek-ai/dsh-settings ^0.2.0-rc.1`).

Run the host-side regression tests with:

```sh
npm test
```

The `./client` export (`lib/client.js`) is a DSH `window.__ModuleLoader__`
lazy-load factory, not a standard ESM/CJS module. It only runs inside the DSH
browser runtime; `import … from 'dsh-contradictions-indicator/client'` will
not work outside of it.

## Layout

- `lib/index.js` — host plugin (Cordis `apply`)
- `lib/client.js` — web client (badge, overlay, settings tab)
- `cordis.patch.yml` — bundle insert for `dsh plugin add`
- `test/` — host-side delivery-timing regression tests (`npm test`)
- `plugin/` — working copy of the same host/client sources

## License

Apache License 2.0. See `LICENSE`.
