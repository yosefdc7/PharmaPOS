---
name: tech-stack
description: Update the Technical Stack documentation (docs/TECH_STACK.md) based on dependency changes, architecture modifications, new API routes, database changes, or technical implementation decisions. Use when adding dependencies, changing technology choices, adding API endpoints, or modifying system architecture.
---

# Tech Stack - Technical Documentation

## Purpose
Maintain the technical stack document that describes HOW PharmaSpot is built, including dependencies, architecture, API routes, database structure, and implementation details.

## File Location
`docs/TECH_STACK.md`

## When to Update

Update TECH_STACK.md when:
- Adding/removing dependencies in `package.json`
- Changing architecture or technology choices
- Adding new API routes or modifying existing ones
- Changing database structure or storage locations
- Updating security implementations
- Modifying build/packaging configuration
- Adding new tooling or dev dependencies
- Changing deployment strategies

## Key Sections

### Application Layer
Desktop shell, packaging, build tools, UI framework

### Local Server (Embedded in Electron)
- HTTP server (Express)
- Default port and configuration
- API prefix and middleware
- Registered routers

### HTTP API Surface
All Express routers registered from `server.js`:
```
- `/api/inventory` → `api/inventory.js`
- `/api/customers` → `api/customers.js`
- `/api/categories` → `api/categories.js`
- `/api/settings` → `api/settings.js`
- `/api/users` → `api/users.js`
- `/api` (transactions) → `api/transactions.js`
```

### Persistence
Database library, storage paths, file locations

### Security & Auth
Password hashing, input validation, file uploads, CSP

### Runtime Dependencies
Notable libraries for updates, printing, PDF, barcode, etc.

### Tooling
Test frameworks, dev tools, build utilities

### Version
Current app version from `package.json`

## Update Workflow

### Step 0: Read Context Documents (MANDATORY)
Before making any updates, read these files for accurate context:

**1. Repo Wiki Technical Sections:**
```
Read: .qoder/repowiki/en/content/Architecture Overview/Architecture Overview.md
Read: .qoder/repowiki/en/content/Architecture Overview/Database Architecture.md
Read: .qoder/repowiki/en/content/Architecture Overview/Embedded HTTP Server.md
```

**2. Relevant Wiki Sections:**
Based on what changed, read applicable sections:
- API changes → `API Reference/` directory (all relevant endpoints)
- Database changes → `Database Design/` directory (models, operations, indexing)
- Security changes → `Security Implementation/` directory
- Deployment changes → `Packaging and Deployment/` directory
- Frontend changes → `Frontend Interface/` directory

**3. Changelog:**
```
Read: shared-memory/changelog.md
Read: CHANGELOG.md
```

**4. Current Tech Stack:**
```
Read: docs/TECH_STACK.md
```

**Why this matters:**
- Wiki provides detailed implementation architecture and design patterns
- API Reference wiki shows actual endpoint behavior and data models
- Database Design wiki shows schema, indexing, and operations
- Changelog shows what changed recently and why
- Prevents documenting outdated or incorrect technical details
- Ensures accuracy against actual implementation

### Step 1: Cross-Reference with Wiki

After reading context documents:
- Verify API routes match API Reference wiki documentation
- Check Database Design wiki for actual schema and operations
- Review Architecture wiki for system design patterns
- Note any discrepancies between wiki and current TECH_STACK.md
- Use wiki to understand HOW features are implemented technically

### Step 2: Read Source Files

Verify wiki information against actual source code:
- **Dependencies**: Check `package.json` (root and `web-prototype/`)
- **API routes**: Check `server.js` and relevant `api/*.js` files
- **Database**: Check `server.js` for initialization and paths
- **Architecture**: Check `start.js`, `server.js`, entry points

### Step 3: Read Current Tech Stack
```
Read: docs/TECH_STACK.md
```

### Step 4: Identify Technical Changes
Ask:
- Were new dependencies added? (verify in package.json and wiki)
- Are there new API routes? (check API Reference wiki and server.js)
- Did database structure change? (check Database Design wiki)
- Were security implementations modified? (check Security wiki)
- Did architecture change? (check Architecture wiki)

### Step 5: Update Relevant Sections

**Adding new API route:**
```markdown
## HTTP API surface (Express routers)

Routers are registered from `server.js`:

- `/api/inventory` → `api/inventory.js`
- `/api/suppliers` → `api/suppliers.js`
```

**Adding new dependency:**
```markdown
## Other notable runtime dependencies

- **Email notifications:** `nodemailer` for sending transactional emails
```

**Changing architecture:**
```markdown
## Application

| Layer | Technology | Notes |
|-------|-----------|-------|
| Desktop shell | Electron `^41.2.2` | Main process entry: `start.js` |
| Web app | Next.js 14 (App Router) | Offline-first PWA in `web-prototype/` |
```

**Updating persistence:**
```markdown
## Persistence

| Store | Library | Location |
|-------|---------|----------|
| Embedded document DB | `@seald-io/nedb` | `%APPDATA%/<APPNAME>/server/databases/` |
| Local cache | IndexedDB | Browser storage in `web-prototype/` |
```

### Step 6: Add Savepoint Entry

Add timestamped entry at the bottom:

```markdown
## YYYY-MM-DDTHH:MM:SSZ - <agent-tag> savepoint

- Brief description of technical changes
- Dependencies added/removed
- Architecture or API modifications
```

**Agent tags:** `codex`, `qoder`, `antigravity`, `cursor`

## Examples

### Example 1: Adding New API Endpoint

```markdown
## HTTP API surface (Express routers)

Routers are registered from `server.js`:

- `/api/inventory` → `api/inventory.js`
- `/api/customers` → `api/customers.js`
- `/api/suppliers` → `api/suppliers.js`
```

### Example 2: Adding Dependencies

```markdown
## Security & auth-related libs

- Password hashing: `bcrypt` (alias to `bcryptjs` in `package.json`)
- Input: `validator`, `dompurify`, `sanitize` / `sanitize-filename`
- File uploads: `multer` with size and MIME constraints
- Rate limiting: `express-rate-limit` (100 req / 15 min per key)
```

### Example 3: Web Prototype Addition

```markdown
## Application

| Layer | Technology | Notes |
|--------|------------|--------|
| Desktop shell | Electron `^41.2.2` | Main process entry: `start.js` |
| Web prototype | Next.js 14 (App Router) | Offline-first PWA in `web-prototype/` |

## Persistence

| Store | Library | Location |
|-------|---------|----------|
| Embedded document DB | `@seald-io/nedb` | `%APPDATA%/<APPNAME>/server/databases/` |
| Local cache | IndexedDB | Browser storage in web prototype |
```

## Important Rules

1. **ALWAYS read wiki first** - Never update TECH_STACK without reading relevant wiki sections
2. **ALWAYS check changelog** - Understand what changed and when before documenting
3. **Technical details only** - Describe HOW it's built, not WHAT it does (that's PRD)
4. **Verify against wiki AND code** - Cross-reference wiki documentation with actual source
5. **Include versions** - Always specify dependency versions
6. **Include file paths** - Reference actual files and locations
7. **Be specific** - Include ports, paths, configuration details
8. **Always add savepoint** - Timestamp and tag every update
9. **Cross-reference PRD.md** - If tech change affects product features, notify to update PRD too
10. **Resolve discrepancies** - If wiki and codebase differ, document what actually exists in code

## Cross-Reference with PRD.md

| PRD.md (WHAT) | TECH_STACK.md (HOW) |
|---------------|---------------------|
| "Point of sale feature" | Express routes, NeDB storage, jQuery UI |
| "Customer management" | `/api/customers` endpoint, customer.db file |
| "Inventory tracking" | `/api/inventory` endpoint, inventory.db file |
| "Auto-updates" | `electron-updater` library implementation |

## Validation Checklist

After updating:
- [ ] Read relevant wiki sections before making changes
- [ ] Checked changelog for recent changes
- [ ] Cross-referenced wiki with actual source code
- [ ] Changes describe technical implementation, not product behavior
- [ ] Dependency versions are correct (check `package.json`)
- [ ] File paths are accurate and exist
- [ ] API routes match actual implementation in `server.js` and wiki
- [ ] Storage paths are correct
- [ ] Savepoint entry added with timestamp and agent tag
- [ ] No product features described (those belong in PRD.md)
- [ ] All sections are consistent with each other
- [ ] No contradictions with wiki documentation

## Source of Truth Hierarchy

When information conflicts, use this priority:
1. **Actual source code** (highest priority - what's implemented)
2. **Repo wiki** (comprehensive documentation of architecture)
3. **Current TECH_STACK.md** (may be outdated)
4. **Changelog** (historical context)

Always verify wiki against source code before documenting.
