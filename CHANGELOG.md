# Changelog

## 1.0.1

- Inject next-turn steer on `agent/pre-step` instead of mutating frozen `llm/stream` options, so the reminder actually reaches the model.

## 1.0.0

- Host plugin watches conversation `llm/stream` calls and runs parallel contradiction analysis.
- Client badge in the session header, overlay commentary, Analyze Now, and Settings → Plugins → Contradictions.
- Opt-in auto-analysis (default interval 25 turns), optional next-turn system-reminder steer, and persisted global defaults.
- Apache License 2.0.
