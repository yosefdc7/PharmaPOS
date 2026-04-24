# Shared State

## Context
Workspace bootstrapped and Antigravity skill system fully configured. Multi-agent coordination active (Codex + Antigravity + Qoder). `main` now includes the modern Electron UI refresh, the Next.js offline-first web POS prototype in `web-prototype/`, staged rollout controls, and observability instrumentation.

## User Preferences
- File-based shared memory; no automation scripts.
- Agents use the `shared-memory/` contract; root `CHANGELOG.md`, `docs/DECISIONS.md`, `docs/TODO.md` are human-facing docs and off-limits for coordination.
- Keep the system simple and human-inspectable.
- Savepoint workflow (`savepoint_project_docs.py`) runs only on explicit user request. Normal dev updates shared-memory files directly.

## Active Decisions
- `AGENTS.md` is the cross-agent entry point. `shared-memory/README.md` is the canonical protocol spec. Workspace rules win over global agent rules.
- Antigravity skills loaded from `C:\Users\josef\.codex\skills` via Customizations -> Skill Custom Paths (shared with Codex - single source of truth).
- `new-project-copy-rules` skill handles both new project bootstrapping and savepoint workflow.
- UI refresh uses a layered approach: `index.html` shell hooks, `assets/css/modern-ui.css`, and focused `assets/js/pos.js` renderer updates while preserving existing APIs and Bootstrap/jQuery behavior.
- Next.js is the intended long-term POS endstate. Electron remains temporarily as fallback/reference.
- `web-prototype/` is a Vercel-ready Next.js interactive prototype with IndexedDB local persistence, seeded demo data, full POS/admin/reports/settings screens, external-terminal payment recording, and simulated sync.
- Web delivery pipeline now enforces quality gates (typecheck/unit/integration/contract/security), deploys preview+staging+production in sequence, and blocks production on staging rollback verification.
- Web prototype observability now includes structured logs/traces/metrics, SLO alert definitions, and runbooks for sync backlog, terminal mismatch, register outage, and rollback incidents.

## Blockers
None.

## Next Action
Wire real preview/staging/production deployment credentials and telemetry export backends, then run the first staged promotion with a rollback drill.
