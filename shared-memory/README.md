# Shared Memory Protocol

File-based coordination layer so multiple agents (Codex, Antigravity/Gemini, Claude, Cursor, Qoder, etc.) can pick up each other's work without losing context.

## Files

| File | Role | Read when | Write when |
|---|---|---|---|
| `state.md` | Current truth: context, decisions, preferences, blockers, next action. | Before every task. | When shared understanding changes. |
| `open-items.md` | Unresolved items, in-progress locks, handoffs. | Before every task. | When claiming, finishing, opening, or closing an item. |
| `changelog.md` | History of meaningful changes to shared understanding. | When you need recent history or before "fixing" something odd. | After any change to `state.md`. |
| `activity-log.ndjson` | Append-only operational log of actions. | For audit or reconciliation. | After every meaningful action. |
| `README.md` | This file. | When learning the protocol. | Rarely — only when the protocol itself changes. |

## Workflow

### Starting work
1. Read `state.md` and `open-items.md`.
2. Claim an item in `open-items.md`: change `[ ]` to `[~] in progress by [your-agent-tag]`. Commit that single change.
3. Do the work.

### Finishing work
1. Append a line to `activity-log.ndjson`.
2. If the change affected shared understanding, update `state.md` and add a dated entry to `changelog.md`.
3. Update `open-items.md`: mark `[x]` for done, add a new handoff item if you're passing something on, or revert the claim if you backed out.
4. Commit with an agent-tagged message.

## Formats

### `state.md`

Markdown, overwritten in place. Always includes these sections:

- **Context** — what we are doing right now.
- **User Preferences** — user choices that apply going forward.
- **Active Decisions** — what is settled.
- **Blockers** — what is stuck and why.
- **Next Action** — what the next agent should pick up.

Keep it short. When a section grows, distill it back down.

### `changelog.md`

Newest on top. One entry per shared-understanding change:

```
## YYYY-MM-DD — [agent-tag]
Added / Changed / Fixed / Removed: <one line>
Why: <one or two lines>
```

### `activity-log.ndjson`

One JSON object per line. Append only — never rewrite. UTC ISO-8601 timestamps.

```
{"ts":"2026-04-24T15:04:05Z","agent":"codex","action":"edited","target":"src/foo.ts","summary":"added input validation to bar()","refs":["open-items:auth-refactor"]}
```

Required fields: `ts`, `agent`, `action`, `summary`. Optional: `target`, `refs`.

When this file grows unwieldy (roughly 500+ lines), rotate it manually: rename to `activity-log.YYYY-MM.ndjson` and start a fresh empty `activity-log.ndjson`. No automation — just hygiene.

### `open-items.md`

Checkbox list. Status markers:

```
- [ ] Description — owner: any, priority: high|med|low
- [~] Description — in progress by [antigravity], claimed 2026-04-24
- [x] Description — done by [codex], 2026-04-24
```

Do not delete closed items; keep them for a while for audit.

## Conflict avoidance

- If an item is `[~] in progress`, do not edit files in its scope. Start a different item or open a new one.
- Use feature branches for non-trivial work; commit the claim and the work so history shows who did what.
- If two agents somehow both claim the same item, the earlier commit wins; the later one reverts its claim and picks another item.

## Recovery

If `state.md` looks stale or contradicts reality, reconcile from the last ~20 entries of `activity-log.ndjson` and recent `changelog.md`, rewrite `state.md`, and add a `changelog.md` entry noting the reconciliation.
