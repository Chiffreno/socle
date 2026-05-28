# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

**Estimateur BTP** is a French construction materials cost estimator (BTP = Bâtiment et Travaux Publics). It estimates supply costs (fournitures HT) for renovation projects across 15 trade sections (lots). The current production version is `estimateur_btp_v8_39.html`.

## File location

Versions are stored in `/Users/benjamingomes/Documents/CHIFFRENO/VERSIONS/`.

## Running the app

No build step, no server, no dependencies. Open the HTML file directly in a browser:

```
open /Users/benjamingomes/Documents/CHIFFRENO/VERSIONS/estimateur_btp_v8_39.html
```

Reload the page after edits. State is persisted automatically to `localStorage` under key `btp_v8d`.

## Architecture

The entire app is a **single self-contained HTML file** (~1300 lines) with embedded CSS and JavaScript. No framework, no npm, no modules.

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
