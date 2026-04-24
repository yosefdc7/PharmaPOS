# Agent Instructions

This workspace uses a file-based shared-memory protocol so Codex, Antigravity/Gemini, Claude, Cursor, Qoder, and any other agent can coordinate without losing context between sessions or tools.

## Read order (every session, before acting)

1. `shared-memory/state.md` — current truth.
2. `shared-memory/open-items.md` — unresolved items, blockers, handoffs, in-progress locks.
3. `shared-memory/README.md` — full protocol, if unfamiliar.
4. Task-specific files.

## Before starting a task

- Claim the item in `shared-memory/open-items.md` by changing its checkbox to `[~] in progress by [your-agent-tag]`. Commit that change before you touch anything else.
- If an item is already `[~] in progress by [other-agent]`, pick a different item or coordinate via a new open-items entry. Do not edit files in that item's scope.

## Write rules (on every meaningful action)

1. Append one line to `shared-memory/activity-log.ndjson`. Schema is in `shared-memory/README.md`.
2. If the action changes shared understanding (decision, preference, state, blocker, next action), update `shared-memory/state.md` and add a dated entry to `shared-memory/changelog.md`.
3. If you open, claim, hand off, or close an item, update `shared-memory/open-items.md`.
4. Identify yourself in commit messages: `feat(scope): description [codex]`, `fix: description [antigravity]`, etc.

## Rules of the road

- If something looks wrong, read `shared-memory/changelog.md` before "fixing" it. Another agent may have done it intentionally.
- Do not assume state from prior turns. Re-read the files.
- Do not treat root `CHANGELOG.md`, `docs/DECISIONS.md`, `docs/TODO.md`, or other project docs as shared memory. They are human-facing project artifacts. Shared memory lives exclusively under `shared-memory/`.
- Do not invent new memory files. Use only the files under `shared-memory/`.
- If global agent rules (Antigravity, Cursor, Qoder, etc.) conflict with this file, the workspace wins.

## Agent tags

Use a stable tag in logs and commits: `codex`, `antigravity`, `claude`, `cursor`, `qoder`, `aider`, etc.

Full protocol, schemas, and recovery: `shared-memory/README.md`.
