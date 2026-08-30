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

Requires DSH web with the settings and conversation UI packages that this plugin injects.

## What it does

- Watches main conversation `llm/stream` calls (skips compaction, session-title, and its own analysis calls).
- On demand, or on an opt-in interval, fires a parallel model call that reuses the conversation's provider, model, system prompt, tools, session id, and messages, then appends one analysis user message so the provider KV cache stays warm.
- Parses `SCORE: <n>` and `ANALYSIS: <text>` from that response.
- Shows a colored header badge (green ≥80, yellow ≥50, red &lt;50) and an overlay with the commentary.
- Auto-analysis is off per session until you enable it. Default interval is 25 turns (editable, 1–500).
- Optional next-turn system-reminder steer using `{{score}}` and `{{commentary}}`. Injected on `agent/pre-step` (not by mutating frozen `llm/stream` options). Off for the analysis itself if you uncheck it.
- Global interval, steer default, and both prompt texts persist via DSH settings (with a file fallback at `~/.dsh/contradictions-indicator.json`).

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

Only `dsh-settings` and `schemastery` are linked — those are the only bare
`import`s this plugin's host half actually executes in Node. `cordis` is a
type-only import (used solely by `lib/types/index.d.ts`) and `react` is
resolved through the DSH browser module table, not Node's `node_modules`, so
neither needs linking here.

All four `peerDependencies` are marked `optional` in `package.json`. That is
the correct *install* contract for a DSH host plugin — it tells pnpm these
packages are provided by the profile, not duplicated by this package — but it
does **not** mean the plugin runs without them. `lib/index.js` hard-imports
`@deepseek-ai/dsh-settings` and `@deepseek-ai/schemastery` and will fail to
load if the profile does not provide them.

The `./client` export (`lib/client.js`) is a DSH `window.__ModuleLoader__`
lazy-load factory, not a standard ESM/CJS module. It only runs inside the DSH
browser runtime; `import … from 'dsh-contradictions-indicator/client'` will
not work outside of it.

## Layout

- `lib/index.js` — host plugin (Cordis `apply`)
- `lib/client.js` — web client (badge, overlay, settings tab)
- `cordis.patch.yml` — bundle insert for `dsh plugin add`
- `plugin/` — working copy of the same host/client sources

## License

Apache License 2.0. See `LICENSE`.
