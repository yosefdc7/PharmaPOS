# Shared-Memory Changelog

## 2026-04-24 - [codex]
Added: web-prototype observability instrumentation (structured logs/traces/metrics), SLO alert definitions, and incident runbooks.
Why: on-call needs to detect and triage sync, payment, outage, and rollback failures in under 15 minutes.

## 2026-04-24 - [codex]
Added: Next.js offline-first POS prototype in web-prototype/.
Why: Establishes the web/PWA migration endstate with IndexedDB, seeded demo data, full app shell, external-terminal payment recording, and simulated sync while preserving Electron as fallback/reference.

## 2026-04-24 - [codex]
Changed: Completed the modern minimal responsive UI refresh implementation.
Why: Adds compact left navigation, responsive right checkout/cart, modern product/cart styling, and whole-app polish without changing backend APIs or storage.

## 2026-04-24 - [user]
Added: shared-memory protocol files and rewritten AGENTS.md / GEMINI.md.
Why: migrate agent coordination off root CHANGELOG.md and docs/ into a dedicated shared-memory contract.
