# Gemini / Antigravity Workspace Rules

Follow `AGENTS.md`. The shared-memory protocol it describes is the single source of truth for this workspace.

- Agent tag when writing logs, commits, or updates: `antigravity`.
- If global Antigravity rules conflict with `AGENTS.md` or `shared-memory/state.md`, the workspace files win.
- Do not read root `CHANGELOG.md`, `docs/DECISIONS.md`, or `docs/TODO.md` as memory. Active memory lives under `shared-memory/`.
