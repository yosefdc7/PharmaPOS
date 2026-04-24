# Shared-Memory Changelog

## 2026-04-24 - [codex]
Changed: reverted the Google-Sheets-style products table experiment and restored the prior compact products admin table.
Why: the spreadsheet-style version was visually rejected, so the prototype should remain on the previous denser table layout until a different direction is chosen.

## 2026-04-24 - [codex]
Changed: upgraded the `web-prototype/` products admin grid to a Google-Sheets-style table with sticky sortable headers, inline column filters, and horizontal scrolling on narrow screens instead of collapsing into stacked rows.
Why: the user wanted the products screen to behave more like a spreadsheet while preserving existing store APIs and CRUD behavior.

## 2026-04-24 - [codex]
Changed: rebuilt the `web-prototype/` products admin screen into a compact searchable inventory table with property/value filters, pagination, featured/edit/delete actions, and a shared add/edit drawer, then added component coverage for the new flow.
Why: the user requested a denser product-management layout without changing the existing store APIs or IndexedDB-backed prototype behavior.

## 2026-04-24 - [codex]
Changed: refreshed `web-prototype/` to a Stripe-aligned color system and fixed the observability test file's missing Vitest imports so `npm test` and `npm run typecheck` both pass again.
Why: the prototype needed the requested visual direction without losing a clean verification baseline.

## 2026-04-24 - [codex]
Changed: merged ready remote work into `main` and fixed test-runner config so root Jest and `web-prototype` Vitest both pass.
Why: `origin/main` had drift plus one unmerged observability branch, and the repo needed a green verification baseline before pushing.

## 2026-04-24 - [codex]
Added: web-prototype observability instrumentation (structured logs/traces/metrics), SLO alert definitions, and incident runbooks.
Why: on-call needs to detect and triage sync, payment, outage, and rollback failures quickly.

## 2026-04-24 - [codex]
Added: environment promotion pipeline, migration/rollback strategy, mandatory CI gates, and risky-surface feature flags for the web prototype.
Why: enforce no direct-to-prod path and validate rollback safety in staging before production promotion.

## 2026-04-24 - [codex]
Added: Next.js offline-first POS prototype in web-prototype/.
Why: Establishes the web/PWA migration endstate with IndexedDB, seeded demo data, full app shell, external-terminal payment recording, and simulated sync while preserving Electron as fallback/reference.

## 2026-04-24 - [codex]
Changed: Completed the modern minimal responsive UI refresh implementation.
Why: Adds compact left navigation, responsive right checkout/cart, modern product/cart styling, and whole-app polish without changing backend APIs or storage.

## 2026-04-24 - [user]
Added: shared-memory protocol files and rewritten AGENTS.md / GEMINI.md.
Why: migrate agent coordination off root CHANGELOG.md and docs/ into a dedicated shared-memory contract.
