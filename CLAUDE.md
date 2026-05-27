# SOCLE — Application Next.js

Boîte à outils pour entrepreneurs du BTP : chiffrage matériaux, rentabilité,
prévisionnel, taux horaire, décennale, CGV, checklist de lancement, PV de
réception. Cette app Next.js unifie 10 pages HTML autrefois autonomes derrière
une chrome partagée (topbar + sidebar) et un design system unique.

## Stack & conventions

- **Next.js 15** (App Router) · **React 19** · **TypeScript strict** · **npm**
- Polices via **`next/font/google`** : `Figtree` (400/500/600) + `DM_Mono` (400/500),
  exposées en variables `--font-figtree` / `--font-dm-mono` (mappées sur `--ff` / `--mono`).
- Icônes : **`@tabler/icons-webfont`** (importé une fois dans `app/layout.tsx`),
  utilisées via `<i className="ti ti-...">`.
- Alias d'import : `@/*` → racine du projet.
- Build par défaut = **webpack** (`next build` / `next dev`). Ne pas passer à
  Turbopack sans vérifier (aucune config webpack custom n'est requise ici).
- `npm run build` doit rester vert (TypeScript strict, pas de warning bloquant).

## Design system (à respecter)

- Polices : Figtree (texte) + DM Mono (chiffres, eyebrows, labels techniques).
- Palette canonique (source unique : `app/globals.css` `:root`) :
  `--black #0a0a0a` · `--white #ffffff` · `--gray-bg #fafafa` · `--gray2 #e8e8e8`
  · `--gray3 #a3a3a3` · `--gray4 #525252` · `--green #1a7a3c` · `--green-dark #156430`.
  Tokens secondaires : `--green-light`, `--green-b`, `--orange(/-bg/-b)`, `--red(/-bg/-b)`.
- **Zéro `border-radius`** (sauf `50%` sémantique : point logo, avatar, dots).
- **Zéro `box-shadow`. Zéro `gradient`.**
- Cards, inputs, boutons : coins droits.
- Focus inputs : `border-color: var(--black)` uniquement (pas de glow).
- **Le vert est réservé aux résultats chiffrés** (et aux états actifs/sélection,
  comme l'item de sidebar actif).
- Eyebrows / labels mono : `letter-spacing: 0.12em`, `text-transform: uppercase`.

## Structure des routes

| Route | Source `_legacy/` | Type |
|---|---|---|
| `/` | `socle_landing_1.html` | Landing publique (sans chrome) |
| `/dashboard` | `socle_dashboard_v2.html` | Wrapper legacy |
| `/construction/checklist` | `checklist.html` | React idiomatique |
| `/construction/cgv` | `socle_cgv_2.html` | React idiomatique |
| `/construction/previsionnel` | `socle_previsionnel_1.html` | Wrapper legacy |
| `/construction/taux-horaire` | `socle_taux_horaire_v5_1.html` | React idiomatique |
| `/construction/decennale` | `socle_decennale.html` | Wrapper legacy |
| `/chantier/materiaux` | `chiffrage matériaux.html` | Wrapper legacy (plein écran) |
| `/chantier/rentabilite` | `rentabilité chantier.html` | React idiomatique (re-skin) |
| `/chantier/devis` | — | Placeholder « Bientôt disponible » |
| `/chantier/facture` | — | Placeholder |
| `/apres/pv-reception` | `pv_reception_chantier.html` | Wrapper legacy (re-skin sombre→clair) |
| `/apres/dtu` | — | Placeholder |

> `/chantier/rentabilite` n'est pas dans la sidebar (accessible depuis la landing).
> L'auth (Supabase) n'est **pas** câblée : toutes les routes sont publiques.
> « Paramètres » / « Déconnexion » de la sidebar sont des liens placeholder.

## Layouts (route groups)

- `app/layout.tsx` — **root**, sans chrome : `<html>`, polices, `globals.css`, Tabler CSS.
- `app/page.tsx` — landing `/` (hérite du root → pas de topbar/sidebar).
- `app/(app)/layout.tsx` — `<Topbar/>` + `<Sidebar/>` + `<main class="main"><div class="main-inner">…`.
  Toutes les pages applicatives vivent ici.
- `app/(fullscreen)/layout.tsx` — topbar seule (pas de sidebar), pour les outils
  pleine hauteur (`chiffrage`). `.fullscreen-shell` = `height:100vh; padding-top:52px`.
- `components/Sidebar.tsx` — data-driven depuis `lib/nav.ts`, item actif via `usePathname()`.

## Deux patterns de migration

### 1. Wrapper legacy (`components/LegacyTool.tsx` + `lib/legacy/extract.ts`)

Pour les outils complexes dont on **préserve le JS vanilla** tel quel (chiffrage,
prévisionnel, décennale, pv-réception, dashboard).

- La page (Server Component) appelle `loadLegacy(file, scopeId, options)` qui lit
  `_legacy/<file>` au build, extrait `<style>` / markup principal / `<script>`, et
  **scope le CSS** via la règle native `@scope (#scopeId) { … }`.
- `extract.ts` applique aussi les règles design au CSS legacy : suppression des
  `box-shadow`, des `border-radius` non-`50%`, et remap des polices littérales
  (`'Figtree'`→`var(--ff)`, `'DM Mono'`→`var(--mono)`).
- `LegacyTool` (Client Component) **injecte le markup impérativement** dans un ref
  (React n'en est pas propriétaire → pas de mismatch d'hydratation, cleanup complet),
  puis exécute le script enveloppé dans une **IIFE** (les `const`/`let` top-level
  restent à portée de fonction → réexécution sûre au remount) avec exposition
  individuelle des `globals` sur `window` (pour les handlers inline `onclick="fn()"`).
- `options` : `mainSelector` (n'extraire que ce conteneur), `remove` (sélecteurs à
  retirer), `overrides` (déclarations CSS sur `:scope`, ex. re-skin de tokens),
  `extraCss` (règles scopées supplémentaires, ex. corrections de layout).
- `globals` doit lister les fonctions/objets référencés par les handlers inline
  (`state` inclus si du markup fait `onclick="state.x=…"`). Sur-lister est inoffensif.
- Limite connue : en **dev** (React Strict Mode), un script à base de
  `addEventListener` peut s'attacher deux fois ; sans impact en production (effets
  exécutés une seule fois) et inoffensif pour des calculs idempotents.

### 2. Réécriture React idiomatique

Pour les outils plus simples (checklist, cgv, taux-horaire, rentabilité), réécrits
en Client Components avec `useState`/dérivations, **formules et textes préservés
verbatim**. CSS dans un fichier `*.css` colocalisé, **tous les sélecteurs préfixés**
par une classe wrapper (ex. `.taux-tool`) — même convention que `app/landing.css` —
référençant les tokens `var(--…)`. Pas de `:root`/`body`/reset (déjà globaux).

- `checklist` : persiste dans `localStorage['socle_lancement']` ({ status, done }) ;
  lecture uniquement en `useEffect` (jamais au premier render → pas de mismatch).

## Sources legacy

Les 10 fichiers HTML d'origine sont conservés en lecture seule dans `_legacy/`
(exclus du build, lus par `loadLegacy` au moment du build). Ne pas les modifier ;
ils servent de référence et de source aux pages wrapper.

## Commandes

```bash
npm run dev     # serveur de dev (webpack)
npm run build   # build de production — doit passer sans erreur
npm run start   # sert le build
```
