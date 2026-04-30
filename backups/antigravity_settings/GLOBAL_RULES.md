# Antigravity Global Rules

Follow the same global coordination protocol as Codex:

- Do not read `CHANGELOG.md`, wiki, or shared-memory files on every task.
- On `planning`, read `.qoder/repowiki/en/` if it exists and read `CHANGELOG.md` if it exists.
- On `savepoint`, inspect local and remote git history, then append to `CHANGELOG.md` using the project `AGENTS.md` format.
- Never edit or delete previous changelog entries.
- Tag commits with `[antigravity]`.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`.
- Do not "fix" or "clean up" code made by another agent without being asked.
- If something looks intentionally different, check the changelog before changing it.
- Project `AGENTS.md` files provide project-specific settings such as Qoder wiki path and changelog format.
