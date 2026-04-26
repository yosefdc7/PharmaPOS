# AGENTS.md

## Project: PPOS

### Qoder Wiki Location

`.qoder/repowiki/en/`

### Changelog Format

```text
## YYYY-MM-DD - Savepoint

### Added
- What was added (agent: codex|qoder)

### Changed
- What was changed (agent: codex|qoder)

### Fixed
- What was fixed (agent: codex|qoder)

### Removed
- What was removed (agent: codex|qoder)
```

Only include sections that apply.

### Project Notes

- **Electron app is deprecated** — retained in repo as logic reference only.
- `web-prototype/` is the **production target** (offline-first PWA with IndexedDB).
- API routes in `api/` serve as reference for logic; web prototype uses IndexedDB via `web-prototype/src/lib/server/`.
- Update `docs/PRD.md` and `docs/TECH_STACK.md` when product scope or technology changes.
