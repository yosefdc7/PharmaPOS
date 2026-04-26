# PharmaPOS PH Web Prototype

Interactive offline-first POS prototype for the Next.js migration.

## Commands

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run test:contract
npm.cmd run security:scan
npm.cmd run build
```

The prototype stores demo data in browser IndexedDB and simulates cloud sync locally. It does not require a backend yet.

See `docs/rollout-strategy.md` for preview/staging/prod promotion flow, backward-compatible migration strategy, and rollback verification procedure.
