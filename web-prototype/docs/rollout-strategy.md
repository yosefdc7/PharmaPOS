# Deployment and Migration Rollout Strategy

## Environments

1. **Preview** (per pull request): ephemeral validation.
2. **Staging** (from `main` only): pre-production verification.
3. **Production**: only after staging deployment + staging rollback verification pass.

There is **no direct-to-production path** in CI. Production depends on the successful staging job.

## Backward-compatible DB migration approach

- Use additive migrations first (expand phase), never destructive changes first.
- Store runtime kill-switches in `meta.featureFlags` (`sync`, `payments`, `refunds`) defaulted to `false`.
- Enable one flag at a time in staging, verify, then promote.
- Keep rollback strategy as kill-switch disable + redeploy previous app build (contract remains compatible).

## Verified rollback procedure (staging gate)

`npm run verify:rollback` validates that risky surfaces can be turned off cleanly via feature flags.

Staging promotion is blocked unless this rollback verification passes.
