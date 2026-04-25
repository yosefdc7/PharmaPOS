---
name: prd
description: Update the Product Requirements Document (docs/PRD.md) based on feature changes, new capabilities, scope modifications, or product decisions. Use when adding features, changing product behavior, updating roadmap items, or modifying what the application does from a user perspective.
---

# PRD - Product Requirements Document

## Purpose
Maintain the product requirements document that describes what PharmaSpot does, its goals, capabilities, and scope from a product perspective.

## File Location
`docs/PRD.md`

## When to Update

Update PRD.md when:
- Adding new user-facing features
- Changing product scope or goals
- Modifying user workflows or behavior
- Implementing roadmap items
- Adding/changing API endpoints that affect product functionality
- Changing product identity (name, version, description)

## Key Sections

### Product Identity
| Field | Description |
|-------|-------------|
| Name | PharmaSpot |
| One-liner | Product marketing description |
| Version | From root `package.json` `version` |

### Goals
Product objectives (numbered list):
1. Single-store + LAN architecture
2. Operational speed (barcode/search-led selling)
3. Inventory safety (stock levels, expiry tracking)
4. Accountability (users, permissions, history)
5. Data ownership (local NeDB databases)

### In-Scope Capabilities
What the app actually does:
- Point of sale (sales, payments, receipts)
- Catalog (products, categories, barcodes)
- Inventory (CRUD, stock behavior)
- Customers (records, management)
- Transactions (history, on-hold, orders)
- Users & settings (accounts, branding)
- Desktop updates (auto-update via electron-updater)

### API Contract
Summary of REST API under `/api/…`

### Non-Goals / Roadmap
Features not yet implemented (verify before claiming)

### Default Demo Credentials
First-run credentials (e.g., admin/admin)

## Update Workflow

### Step 0: Read Context Documents (MANDATORY)
Before making any updates, read these files for accurate context:

**1. Repo Wiki Overview:**
```
Read: .qoder/repowiki/en/content/Project Overview.md
Read: .qoder/repowiki/en/content/Architecture Overview/Architecture Overview.md
```

**2. Relevant Wiki Sections:**
Based on what changed, read applicable sections:
- New features → `Frontend Interface/` or specific feature docs
- API changes → `API Reference/` directory
- Database changes → `Database Design/` directory
- Architecture changes → `Architecture Overview/` directory

**3. Changelog:**
```
Read: shared-memory/changelog.md
Read: CHANGELOG.md
```

**4. Current PRD:**
```
Read: docs/PRD.md
```

**Why this matters:**
- Wiki provides comprehensive understanding of how features are actually implemented
- Changelog shows history of changes and what other agents have done
- Prevents documenting features that don't exist or contradict implementation
- Ensures consistency across all documentation

### Step 1: Cross-Reference with Wiki

After reading context documents:
- Verify features mentioned in wiki match what you're documenting
- Check API Reference wiki for actual endpoint implementations
- Review Database Design wiki for storage/persistence details
- Note any discrepancies between wiki and current PRD

### Step 2: Read Current PRD
```
Read: docs/PRD.md
```

### Step 3: Identify Product Changes
Ask:
- What new feature was added? (verify in wiki and codebase)
- What user-facing behavior changed? (check changelog)
- Did we implement something from the roadmap? (cross-reference wiki)
- Are there new API endpoints users should know about? (check API Reference wiki)

### Step 4: Update Relevant Sections

**Adding a new feature:**
```markdown
## In-scope capabilities (as reflected in app + API)

- **Feature name:** Brief description of what it does and where it's implemented
```

**Moving from roadmap to implemented:**
1. Add to "In-scope capabilities"
2. Remove from "Non-goals / roadmap"

**Changing goals:**
```markdown
## Goals

6. **New goal name:** Description of the objective
```

**Updating version:**
Check `package.json`:
```json
{
  "version": "x.x.x"
}
```

### Step 5: Add Savepoint Entry

Add timestamped entry at the bottom:

```markdown
## YYYY-MM-DDTHH:MM:SSZ - <agent-tag> savepoint

- Brief description of product changes
- What features were added/modified
- Impact on product scope
```

**Agent tags:** `codex`, `qoder`, `antigravity`, `cursor`

## Examples

### Example 1: Adding Supplier Management Feature

```markdown
## In-scope capabilities (as reflected in app + API)

- **Supplier management:** Supplier records, purchase orders, and vendor tracking via `/api/suppliers` and supplier management UI
```

### Example 2: Implementing Backup Feature

Move from roadmap to implemented:

**Before:**
```markdown
## Non-goals / roadmap

`README` lists: **backup, restore, export to Excel**
```

**After:**
```markdown
## In-scope capabilities

- **Data backup/restore:** Automated backup and restore functionality via settings UI
```

## Important Rules

1. **ALWAYS read wiki first** - Never update PRD without reading relevant wiki sections
2. **ALWAYS check changelog** - Understand what changed and when before documenting
3. **Product focus only** - Describe WHAT the app does, not HOW it's built
4. **Verify implementation** - Only document features that actually exist (cross-reference wiki)
5. **User perspective** - Write from user's point of view, not developer's
6. **Keep roadmap separate** - Planned features go in roadmap, not in-scope
7. **Always add savepoint** - Timestamp and tag every update
8. **Cross-reference TECH_STACK.md** - If product change involves tech changes, notify to update TECH_STACK.md too
9. **Resolve discrepancies** - If wiki and codebase differ, note it and document what actually exists

## Validation Checklist

After updating:
- [ ] Read relevant wiki sections before making changes
- [ ] Checked changelog for recent changes
- [ ] Changes describe product behavior, not implementation details
- [ ] Features documented match wiki description of implementation
- [ ] Version matches `package.json`
- [ ] Features documented actually exist in codebase
- [ ] Savepoint entry added with timestamp and agent tag
- [ ] Roadmap updated if features were implemented
- [ ] No implementation details leaked (those belong in TECH_STACK.md)
- [ ] No contradictions with wiki documentation
