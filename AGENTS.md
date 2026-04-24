# Agent Instructions

This workspace uses a file-based shared-memory protocol so Codex, Antigravity/Gemini, Claude, Cursor, Qoder, and any other agent can coordinate without losing context between sessions or tools.

## Read order (every session, before acting)

1. `shared-memory/state.md` — current truth.
2. `shared-memory/README.md` — full protocol, if unfamiliar.
3. `shared-memory/changelog.md` — recent shared-understanding changes, especially before correcting anything that looks off.
4. Task-specific files.

## Before starting a task

- Re-read `shared-memory/state.md` and `shared-memory/changelog.md` before acting.
- If another agent appears to be actively working in the same scope, coordinate through `shared-memory/activity-log.ndjson` and `shared-memory/state.md` instead of creating or claiming lock files.
- Do not assume state from prior turns or other tools. Reconstruct context from the shared-memory files each session.

## Write rules (on every meaningful action)

1. Append one line to `shared-memory/activity-log.ndjson`. Schema is in `shared-memory/README.md`.
2. If the action changes shared understanding (decision, preference, state, blocker, next action), update `shared-memory/state.md` and add a dated entry to `shared-memory/changelog.md`.
3. Identify yourself in commit messages: `feat(scope): description [codex]`, `fix: description [antigravity]`, etc.

## Rules of the road

- If something looks wrong, read `shared-memory/changelog.md` before "fixing" it. Another agent may have done it intentionally.
- Do not assume state from prior turns. Re-read the files.
- Do not treat root `CHANGELOG.md`, `docs/DECISIONS.md`, `docs/TODO.md`, or other project docs as shared memory. They are human-facing project artifacts. Shared memory lives exclusively under `shared-memory/`.
- Do not invent new memory files. Use only the files under `shared-memory/`.
- If global agent rules (Antigravity, Cursor, Qoder, etc.) conflict with this file, the workspace wins.

## Agent tags

Use a stable tag in logs and commits: `codex`, `antigravity`, `claude`, `cursor`, `qoder`, `aider`, etc.

Full protocol, schemas, and recovery: `shared-memory/README.md`.
