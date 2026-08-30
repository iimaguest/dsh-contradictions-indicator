# Contradictions Indicator

A DeepSeek Harness plugin that scores the live conversation for internal contradictions and shows a 0–100 coherence badge in the session header.

0 means the conversation is riddled with contradictions. 100 means it is consistent. Click the badge for commentary, a manual Analyze Now button, and per-session controls.

## Install

```sh
dsh plugin add https://github.com/iimaguest/dsh-contradictions-indicator
```

Restart or refresh `dsh web`. The badge appears in the conversation header utilities. Global defaults live under **Settings → Plugins → Contradictions**.

Requires DSH web with the settings and conversation UI packages that this plugin injects.

## What it does

- Watches main conversation `llm/stream` calls (skips compaction, session-title, and its own analysis calls).
- On demand, or on an opt-in interval, fires a parallel model call that reuses the conversation's provider, model, system prompt, tools, session id, and messages, then appends one analysis user message so the provider KV cache stays warm.
- Parses `SCORE: <n>` and `ANALYSIS: <text>` from that response.
- Shows a colored header badge (green ≥80, yellow ≥50, red &lt;50) and an overlay with the commentary.
- Auto-analysis is off per session until you enable it. Default interval is 25 turns (editable, 1–500).
- Optional next-turn system-reminder steer using `{{score}}` and `{{commentary}}`. Off for the analysis itself if you uncheck it.
- Global interval, steer default, and both prompt texts persist via DSH settings (with a file fallback at `~/.dsh/contradictions-indicator.json`).

## HTTP endpoints (local DSH web server)

The host half registers four exact paths on the DSH web server. They are meant for this plugin's client UI on the same origin:

| Method | Path | Purpose |
|---|---|---|
| GET | `/contradictions/state?sessionId=` | Current score, commentary, and session flags |
| POST | `/contradictions/auto?sessionId=` | Update auto-analysis, interval, steer, prompts |
| GET/POST | `/contradictions/defaults` | Read or write global defaults |
| POST | `/contradictions/trigger?sessionId=` | Run analysis now |

## Peer packages after a local clone

If you `link:` this directory into a profile, Node resolves imports from the real path and will not see the profile's `@deepseek-ai` packages. Re-run after a fresh clone (`node_modules/` is gitignored):

```sh
./link-peer-deps.sh
```

## Layout

- `lib/index.js` — host plugin (Cordis `apply`)
- `lib/client.js` — web client (badge, overlay, settings tab)
- `cordis.patch.yml` — bundle insert for `dsh plugin add`
- `plugin/` — working copy of the same host/client sources

## License

Apache License 2.0. See `LICENSE`.
