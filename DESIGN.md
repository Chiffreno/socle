# SOCLE — Design System

> Source de vérité visuelle de l'application. Toute nouvelle page/composant doit
> s'y conformer. Les tokens vivent dans `app/globals.css` (`:root`) ; ce document
> en fixe l'usage. En cas de doute, `app/globals.css` fait foi pour les valeurs.
>
> **Direction (mai 2026)** — le « langage visuel » né dans l'éditeur de devis
> (`.dee-shell`) est désormais **le canon de tout SOCLE** : radius mesuré,
> ombres douces, gris enrichis, chiffres en Space Grotesk, vert employé plus
> généreusement comme accent. Il remplace l'ancienne charte « zéro radius /
> zéro shadow / DM Mono ».

## Stack & structure (rappel)

- **Next.js 15** App Router · **React 19** · **TypeScript strict** · **npm**.
- **CSS simple** : variables globales (`app/globals.css`) + un fichier `*.css`
  **scopé** par page/outil. **Pas de Tailwind. Pas de `src/`.**
- Routes applicatives sous `app/(app)/…` (chrome topbar + sidebar) ; le groupe
  `(app)` n'apparaît pas dans l'URL. Outils plein écran sous `app/(fullscreen)/…`
  et éditeurs sous `app/(editor)/…`.
- Composants partagés dans `components/`, logique/données dans `lib/`.
- Polices via `next/font` : **Figtree** (400/500/600), **Space Grotesk**
  (chiffres) et **DM Mono** (eyebrows/labels mono).
- Icônes : **Tabler** (`@tabler/icons-webfont`), via `<i className="ti ti-…">`.

## Canon de tokens (source unique — `app/globals.css :root`)

### Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `--black` | `#0a0a0a` | Texte principal, fond topbar, boutons primaires |
| `--white` | `#ffffff` | Fond des cards/inputs |
| `--gray-bg` | `#fafafa` | Fond de page |
| `--gray2` | `#e8e8e8` | Bordures legacy (rampe historique) |
| `--gray3` | `#a3a3a3` | Texte tertiaire legacy, eyebrows |
| `--gray4` | `#525252` | Texte secondaire legacy |
| `--gray-line` | `#e0e0e0` | **Bordures (défaut langage mai 2026)**, plus contrastées que `--gray2` |
| `--gray-line-2` | `#d2d2d2` | Bordures marquées |
| `--ink-2` | `#4a4a4a` | Texte secondaire dense |
| `--ink-3` | `#8a8a8a` | Texte tertiaire lisible |
| `--fill` | `#f5f6f7` | Fond léger de zones / cards de stats |
| `--fill-2` | `#fafbfc` | Fond léger alternatif |
| `--green` | `#1a7a3c` | Valeurs chiffrées clés, accents, états actifs/sélection |
| `--green-dark` | `#156430` | Hover boutons verts |
| `--green-light` | `#e8f5ee` | Fond d'état sélectionné/actif (léger) |
| `--green-b` | `#b8ddc8` | Bordure d'état vert |
| `--tint-green` | `#eef8f2` | Zone teintée verte (ex. configurateur) |
| `--orange(/-bg/-b)` | `#c45a0a` … | État « attention » (en attente, brouillon) |
| `--red(/-bg/-b)` | `#dc2626` … | État « erreur/négatif » (refusé, perte) |

### Radius & ombres

| Token | Valeur | Usage |
|---|---|---|
| `--radius` | `8px` | Cards, blocs surélevés |
| `--radius-sm` | `6px` | Inputs, pills, boutons (défaut du reset global) |
| `--shadow-sm` | `0 1px 2px rgba(16,24,40,.05), 0 1px 1px rgba(16,24,40,.04)` | Élévation légère (inputs, pills) |
| `--shadow-card` | `0 1px 3px rgba(16,24,40,.06), 0 6px 16px rgba(16,24,40,.06)` | Cards, panneaux |

### Polices

| Token | Police | Usage |
|---|---|---|
| `--ff` | Figtree | Tout le texte |
| `--num` | Space Grotesk (`tnum`) | **Tous les chiffres** : montants, totaux, quantités, %, N°, dates |
| `--mono` | DM Mono | Eyebrows et labels mono uniquement (en voie de retrait sur les chiffres) |

## Règles (langage visuel mai 2026)

1. **Radius mesuré** : `--radius` (8px) pour les cards/blocs, `--radius-sm` (6px)
   pour inputs/pills/boutons. Le reset global applique `--radius-sm` par défaut.
   Une surface qui doit rester **carrée** pose explicitement `border-radius: 0`.
   `border-radius: 50%` reste réservé au sémantique (points, avatars, pastilles).
2. **Ombres douces** : profondeur via `--shadow-sm` / `--shadow-card`. Pas
   d'ombres dures ni de grandes diffusions arbitraires (sauf overlays/modales).
3. **Zéro `gradient`.** Aplats uniquement.
4. **Chiffres en `--num`** (Space Grotesk tabulaire). `--ff` (Figtree) pour le
   texte. `--mono` (DM Mono) réservé aux eyebrows / labels mono.
5. **Vert `--green`** : valeurs chiffrées clés, accents, états actifs/sélection,
   et zones teintées via `--tint-green`. Reste **mesuré** — pas de vert sur le
   texte courant ni en décoration gratuite. Sur un écran de résultat, garder un
   **accent vert dominant** clair plutôt que de tout saturer.
6. **Pas d'emoji** dans l'interface.
7. **Pas d'icône décorative.** Tabler uniquement quand l'icône est fonctionnelle
   (action, statut, navigation).
8. **Focus inputs** : `border-color: var(--black)` (ou `--green` + halo
   `0 0 0 3px var(--green-light)` dans les contextes denses type éditeur).
9. **Eyebrows / labels mono** : `font-family: var(--mono)`, `10–11px`,
   `letter-spacing: .12em`, `text-transform: uppercase`, `color: var(--gray3)`.

## GARDE-FOU NON NÉGOCIABLE — le document client reste sobre

L'**aperçu / PDF du devis** (`components/devis/apercu.css`, classes `.ap-*`) est
un **livrable client**, pas de l'interface. Il reste en **noir / gris**, lisible
et neutre. La libération de couleur du langage mai 2026 s'arrête à **l'interface
artisan** ; **l'output client ne change pas**.

- Le document n'hérite **pas** des accents verts de l'interface.
- Seul un accent **piloté par l'entreprise** (`--ap-accent`, repli vert SOCLE)
  souligne discrètement filets/blocs ; le texte reste noir/gris.
- Toute évolution du langage visuel doit **explicitement exclure** `.ap-*`.

## Dette — alias temporaires à résorber

Le canon est promu sous des **noms neutres**. Les anciens noms scopés pointent
dessus via des **alias** (rendu identique, zéro régression) :

- Devis `.dee-shell` : `--dee-r → var(--radius)`, `--dee-r-sm → var(--radius-sm)`,
  `--dee-shadow-sm/-card → var(--shadow-sm/-card)`, `--dee-line(-2) →
  var(--gray-line(-2))`, `--dee-ink-2/-3 → var(--ink-2/-3)`, `--dee-fill(-2) →
  var(--fill(-2))`, `--dee-cfg-bg → var(--tint-green)`.
- Chantiers `.chantiers-tool` : `--r → var(--radius)`, `--r-sm → var(--radius-sm)`,
  `--line(-2) → var(--gray-line(-2))` ; `--shadow-*`, `--ink-*`, `--fill-*`
  héritent directement du canon (mêmes noms).
- **À faire** : l'éditeur matériaux (`app/(editor)/chantier/materiaux/`) définit
  encore ses tokens en local (`--r`, `--shadow-*`) — à aligner à sa prochaine
  retouche.

> **Les alias `--dee-*` / `--r` sont temporaires.** Migration progressive vers
> les noms neutres à chaque retouche d'un fichier devis/chantier/matériaux.
> **Objectif : suppression des alias.**

## Typographie

- Titre de page : `var(--ff)`, `700`, `clamp(1.8rem, 3vw, 2.4rem)`,
  `letter-spacing: -0.02em`.
- Titre de card : `var(--ff)`, `600`, ~`17px`, `letter-spacing: -0.01em`.
- Texte courant : `13–15px`, `var(--ink-2)` / `var(--gray4)` pour le secondaire,
  `line-height: 1.5–1.6`.
- Chiffres affichés : `var(--num)`, `font-weight: 500–600` ; vert si valeur clé.

## Conventions de composants

### Card
```css
.outil .card {
  background: var(--white);
  border: 1px solid var(--gray-line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  padding: 24px;
}
```

### Boutons
- **Primaire** : fond `--black`, texte `--white`, hover `--green-dark`,
  `border-radius: var(--radius-sm)`, padding ~`12px 20px`, `font-weight: 600`.
- **Secondaire** : fond transparent, bordure `1px solid var(--gray-line)`, texte
  `--black`, hover bordure `--black`.
- **Danger** (rare) : texte/bordure `--red`.

### Badges de statut
Pastille `border-radius: var(--radius-sm)`, `var(--mono)`, `10px`, `.06–.12em`,
uppercase, fond clair + bordure assortie : Brouillon → `--gray3`/`--gray-bg` ;
Envoyé → `--orange`/`--orange-bg`/`--orange-b` ; Signé →
`--green`/`--green-light`/`--green-b` ; Refusé/Expiré → `--red`/`--red-bg`/`--red-b`.

### Inputs & selects
Fond `--white`, bordure `1px solid var(--gray-line)`, `border-radius:
var(--radius-sm)`, padding ~`12–14px`, focus `border-color: var(--black)`.
Champs numériques (prix, quantités) en `var(--num)`.

### Tables (listes)
En-têtes en eyebrow mono `--gray3`, lignes séparées par `1px solid
var(--gray-line)`, hover ligne `background: var(--gray-bg)`. Montants alignés à
droite en `var(--num)`, vert si total clé.

## Anti-patterns (à ne jamais faire)

- Réintroduire des tokens visuels en local plutôt que d'utiliser le canon
  (`--radius`, `--shadow-*`, `--gray-line`, `--ink-*`, `--fill`, `--num`).
- Laisser fuir la couleur d'interface dans le **document client** (`.ap-*`).
- Vert sur du texte courant ou en décoration gratuite (l'accent reste mesuré).
- Dégradés, glassmorphism, ombres dures.
- Emoji ou icônes illustratives.
- Couleurs hex en dur dans les composants → toujours `var(--token)`.
