# Changelog

## 2026-04-25 - Savepoint

### Added
- Root `vercel.json` for Vercel deploys from repository root: installs and builds `web-prototype`, outputs static `web-prototype/out` (Next.js `output: "export"`). For dashboard “Root Directory = web-prototype”, use the `web-prototype/vercel.json` preset instead (agent: codex)
- RX/DD UI workspace: classification, dispensing gates, prescription drawer, patient profile, DD log, red flags, inspection dashboard; Settings Prescriptions tab; product drug-class badges and product master fields (agent: qoder)
- BIR compliance UI: settings configuration, compliance status indicator, OR preview (normal/void/reprint), X-Reading, Z-Reading with history, eJournal export, eSales report (agent: qoder)
- Thermal printer management UI: multi-printer profiles, receipt layout config, printer status indicator, reprint queue, print failure modal with digital receipt fallback (agent: qoder)
- Audit trail UI: BIR report event log, printer activity log, Z-Reading missed alert (agent: qoder)
- 13 new React components in web-prototype/src/components/ (agent: qoder)
- TypeScript types for BIR, Printer, and Audit data models (agent: qoder)

## 2026-04-24T05:12:18Z - antigravity savepoint

- Configured Antigravity skill system: added custom skill path, created antigravity.yaml agent config for new-project-copy-rules skill, and established dev session tracking User Rule with savepoint workflow

## 2026-04-24T12:44:51Z - codex savepoint

- Captured current project state after the Next.js POS prototype, staged deployment pipeline, and observability rollout.

## 2026-04-24T16:31:56Z - antigravity savepoint

- Renamed 'Sync' to 'Sync Online' across UI and observability; renamed 'Add Customer' to 'Add' in the customer management view.
