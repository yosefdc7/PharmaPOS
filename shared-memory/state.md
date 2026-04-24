# Shared State

## Context
Workspace is set up for multi-agent coordination (Codex + Antigravity/Claude + Qoder, plus any tool that honors AGENTS.md). No active task yet.

## User Preferences
- File-based shared memory; no automation scripts.
- Agents use the `shared-memory/` contract; root `CHANGELOG.md`, `docs/DECISIONS.md`, `docs/TODO.md` are human-facing docs and off-limits for coordination.
- Keep the system simple and human-inspectable.

## Active Decisions
- `AGENTS.md` is the cross-agent entry point. `shared-memory/README.md` is the canonical protocol spec. Workspace rules win over global agent rules.

## Blockers
None.

## Next Action
Awaiting first task.
