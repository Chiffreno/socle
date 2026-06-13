# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**SOCLE** is a French web tool suite for construction (BTP) entrepreneurs who are starting out. It covers the artisan lifecycle: business launch → price building → quotes/invoicing → end of site (acceptance, DTU). Former name: **ChiffReno** (some legacy files still use it).

The product is now a **Next.js 15 / React 19 / TypeScript** application — that migration is **done and is the core of the product today**. Its most developed module is the **Devis** (quotes): a full quoting tool built on a pricing engine ported from the historical estimateur (14 trade sections / lots — the étanchéité lot was removed in June 2026 and folded into the carrelage/faïence lots). The other tools (hourly-rate simulator, first-year forecast, site profitability, decennial-insurance simulator, PV de réception, CGV, checklist, DTU library) now exist as Next.js pages — some rewritten natively, some still embedding their original HTML prototype via `LegacyTool` (see below).

The original **Estimateur BTP** (materials cost estimator, ~15 lots) survives as a standalone HTML file at the repo root and is embedded in the app at `/chantier/materiaux` via `LegacyTool`. It is the ancestor of the Next.js pricing engine.

See `ARCHITECTURE.md` for the full architecture of the Next.js app (modules, data flow, sensitive zones) and `ANALYSE_OUTILS_SOCLE.md` for a tool-by-tool breakdown.

## File location & repo state

This repo (`SOCLE/SOCLE`) mixes three layers:

- **The Next.js app (primary, most mature)**: `app/` (App Router pages), `components/` (React UI), `lib/` (all business logic — the pricing engine lives in `lib/devis/engine/`). This is where active development happens. Config: `package.json`, `tsconfig.json`, `next.config.ts`. Tests: `tests/` (Vitest). See `ARCHITECTURE.md`.
- **Legacy HTML tools**: `estimateur_btp_v8_65_1.html` (latest) and `estimateur_btp_v8_64.html` at the root — standalone HTML, still embedded in the app for the materials estimator. The `_legacy/` folder holds the source HTML prototypes (landing, dashboard, hourly rate, forecast, profitability, decennial, acceptance PV, CGV, checklist, plus an older estimateur copy `chiffrage matériaux.html`); five Next.js pages currently embed these via `LegacyTool` (dashboard, prévisionnel, décennale, PV réception, prix matériaux).
- **Migration artifacts**: `lib/devis/schema.sql` (target Postgres schema) and the async repository interface anticipate a later move from localStorage to Supabase — not started.

The current reference version of the standalone estimateur is **`estimateur_btp_v8_65_1.html`**.

## Running the app

**The Next.js app** (the product):

```
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest suite (tests/)
npx tsc --noEmit   # type-check (preferred over `next build` in offline envs:
                   # the build fetches Google Fonts over the network)
```

App state is persisted to the browser's `localStorage` (keys `socle_*`) and IndexedDB (PV photos). No server, no database, no account — 100% local for now.

**The standalone legacy estimateur** (`estimateur_btp_v8_65_1.html`): no build step, open the file directly in a browser:

```
open /Users/benjamingomes/Documents/SOCLE/SOCLE/estimateur_btp_v8_65_1.html
```

Reload the page after edits. Its state is persisted to `localStorage` under key `btp_v8d`.

## Architecture of the Next.js app

**For the current product (the Next.js app), see `ARCHITECTURE.md`** — it covers the module map, the saisie → calcul → agrégation → affichage → PDF data flow, the architecture choices, and the sensitive zones. That is the entry point for understanding the live codebase.

The rest of this section documents the **legacy standalone estimateur HTML** (`estimateur_btp_v8_65_1.html`) — the ancestor of the Next.js pricing engine, still embedded at `/chantier/materiaux`. Useful when touching that file or tracing where the engine's pricing logic came from.

## Architecture of the legacy estimateur HTML

This tool is a **single self-contained HTML file** (~1300 lines) with embedded CSS and JavaScript. No framework, no npm, no modules.

### State model

A single `state` object is the source of truth:

```js
state = {
  cur,          // currently viewed lot ID
  globalSurf,   // global habitable area in m²
  tva,          // VAT rate: 0 | 10 | 20
  corpView,     // bool: summary grouped by trade category
  projectName,
  editCell,     // active inline price editor { lid, key } | null
  lots: {
    [id]: {
      on,    // bool: lot active/inactive
      surf,  // lot-specific m² (null → falls back to globalSurf)
      q,     // quality preset: 'std' | 'mid' | 'prm'
      m,     // margin % added on top of material cost
      o,     // lot-specific options object (varies per lot)
      cp,    // custom price overrides: { [BP_key]: €/unit }
    }
  }
}
```

### Key data structures

- **`BP`** — flat dictionary of all base material prices (`key → €/unit`). This is the single source of unit prices.
- **`LM`** — ordered array of lot metadata `{ id, label, sub }`, defines sidebar order.
- **`QP`** — quality preset overrides: `QP[lotId][quality]` gives partial `o` to apply via `setQuality()`.
- **`TIPS`** — French explanatory tooltips for material keys, rendered inline via `tipHtml(key)`.
- **`CORPS`** — groups lots into 5 trade categories for the summary "Corps" view.

### Core functions

| Function | Role |
|---|---|
| `calcItems(lid)` | Returns line items `[{key, qty, lbl, unit, p, total, hl}]` for a lot. Giant `switch` on `lid`. This is the pricing engine. |
| `px(lid, key)` | Returns price: custom override (`cp[key]`) if set, else `BP[key]`. |
| `pxRag(lid, key, epa)` | Ragréage price scaled by thickness vs. reference thickness in `REF_EPA`. |
| `renderOpts(lid)` | Returns HTML string for the lot configuration panel. Also a `switch` on `lid`. |
| `render()` | Full UI re-render from state. Called after every state mutation. Calls `save()`. |
| `renderSummary()` | Re-renders the right-hand summary panel and bar chart. |
| `save()` / `load()` | Serialize/deserialize `state` to `localStorage['btp_v8d']`. |

### UI layout

Three-column flex layout:
- **Left `#sidebar`** — project name, global surface input, TVA selector, lot navigation list
- **Center `#main`** — current lot: quality cards (Éco/Standard/Premium), lot-specific options (via `renderOpts`), materials table (via `renderTable`), footer with margin input and subtotal
- **Right `#summary`** — grand total, TVA, €/m², per-lot bar chart, CSV/PDF export buttons

### Making changes

- **Add a new material**: Add a key/price to `BP`, optionally add a tooltip to `TIPS`.
- **Add a new lot**: Add an entry to `LM`, add initial state to `state.lots`, add quality presets to `QP`, add a `case` in `calcItems()` and `renderOpts()`. Lots with per-lot surfaces need their ID removed from the `noSurf` array in `render()`.
- **Change a price**: Update `BP[key]`. Per-session overrides are stored in `cp` and can be reset via the ↺ button.
- **Quality presets**: Changing `q` calls `setQuality()`, which applies `QP[lid][q]` as a shallow merge onto `state.lots[lid].o`. Lots not in `QP` still support quality selection but ignore it.

### Price editing flow

Clicking a price in the table calls `startEdit(lid, key)`, which sets `state.editCell`. The next `render()` replaces that cell with an `<input>`. On confirm, `commitEdit()` writes to `state.lots[lid].cp[key]`. `rstPrice()` deletes the override. Modified cells show an `opt-badge` "modifié" indicator.

### Export

- **CSV**: Copies a summary table (lot totals only) to clipboard.
- **PDF**: Builds a complete HTML document (all active lots, all line items) and opens it in a new window for `window.print()`.

### Versioning convention

New versions are saved as new files: `estimateur_btp_v8_18.html` → `estimateur_btp_v8_19.html`. There is no git history; version progression is in the filename.
