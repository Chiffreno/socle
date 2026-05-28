# SOCLE — Design System

> Source de vérité visuelle de l'application. Toute nouvelle page/composant doit
> s'y conformer. Les tokens vivent dans `app/globals.css` (`:root`) ; ce document
> en fixe l'usage. En cas de doute, `app/globals.css` fait foi pour les valeurs.

## Stack & structure (rappel)

- **Next.js 15** App Router · **React 19** · **TypeScript strict** · **npm**.
- **CSS simple** : variables globales (`app/globals.css`) + un fichier `*.css`
  **scopé** par page/outil. **Pas de Tailwind. Pas de `src/`.**
- Routes applicatives sous `app/(app)/…` (chrome topbar + sidebar) ; le groupe
  `(app)` n'apparaît pas dans l'URL. Outils plein écran sous `app/(fullscreen)/…`.
- Composants partagés dans `components/`, logique/données dans `lib/`.
- Polices via `next/font` : **Figtree** (400/500/600) + **DM Mono** (400/500).
- Icônes : **Tabler** (`@tabler/icons-webfont`), via `<i className="ti ti-…">`.

## Tokens (couleurs)

| Token | Valeur | Usage |
|---|---|---|
| `--black` | `#0a0a0a` | Texte principal, fond topbar, boutons primaires |
| `--white` | `#ffffff` | Fond des cards/inputs |
| `--gray-bg` | `#fafafa` | Fond de page |
| `--gray2` | `#e8e8e8` | Bordures |
| `--gray3` | `#a3a3a3` | Texte tertiaire, labels désactivés, eyebrows |
| `--gray4` | `#525252` | Texte secondaire |
| `--green` | `#1a7a3c` | **Valeurs chiffrées importantes uniquement** + état actif/sélection |
| `--green-dark` | `#156430` | Hover boutons verts |
| `--green-light` | `#e8f5ee` | Fond d'état sélectionné/actif (léger) |
| `--green-b` | `#b8ddc8` | Bordure d'état vert |
| `--orange(/-bg/-b)` | `#c45a0a` … | État « attention » (ex: en attente, brouillon) |
| `--red(/-bg/-b)` | `#dc2626` … | État « erreur/négatif » (ex: refusé, perte) |
| `--ff` | Figtree | Variable police texte |
| `--mono` | DM Mono | Variable police chiffres |

## Règles strictes (non négociables)

1. **Zéro `border-radius`** — sauf `50%` sémantique (points, avatars, pastilles rondes).
2. **Zéro `box-shadow`.** Profondeur = bordure `1px solid var(--gray2)`, jamais d'ombre.
3. **Zéro `gradient`.** Aplats uniquement.
4. **Figtree** pour tout le texte. **DM Mono** réservé aux chiffres (prix, totaux,
   quantités, N°, dates techniques), aux eyebrows et aux labels mono.
5. **Vert `--green` réservé aux valeurs chiffrées importantes** (montants, marges,
   totaux) et aux états actifs/sélection. **Jamais** pour les titres, le texte
   courant, ni des bordures décoratives.
6. **Pas d'emoji** dans l'interface.
7. **Pas d'icône décorative.** Tabler uniquement quand l'icône est fonctionnelle
   (action, statut, navigation).
8. **Focus inputs** : `border-color: var(--black)` uniquement (jamais de glow/shadow).
9. **Eyebrows / labels mono** : `font-family: var(--mono)`, `font-size: 10–11px`,
   `letter-spacing: .12em`, `text-transform: uppercase`, `color: var(--gray3)`.

## Typographie

- Titre de page : `var(--ff)`, `font-weight: 700`, `clamp(1.8rem, 3vw, 2.4rem)`,
  `letter-spacing: -0.02em`.
- Titre de card : `var(--ff)`, `600`, ~`17px`, `letter-spacing: -0.01em`.
- Texte courant : `14–15px`, `var(--gray4)` pour le secondaire, `line-height: 1.5–1.6`.
- Chiffres affichés : `var(--mono)`, `font-weight: 500` ; vert si valeur clé.

## Conventions de composants

### Structure de page
```tsx
"use client"; // seulement si la page a de l'état/des interactions
import "./mon-module.css";

export default function Page() {
  return (
    <div className="devis-tool">
      <header className="page-header">
        <div className="page-eyebrow">Chantier · Devis</div>
        <h1 className="page-title">…</h1>
        <p className="page-sub">…</p>
      </header>
      {/* … */}
    </div>
  );
}
```
- CSS **scopé** : tous les sélecteurs préfixés par la classe wrapper
  (`.devis-tool …`). On **ne redéclare pas** `:root`/`body`/reset (déjà globaux).
- `page-eyebrow` affiche un trait de 20px (`::before`) + texte mono.

### Card
```css
.devis-tool .card {
  background: var(--white);
  border: 1px solid var(--gray2);
  border-radius: 0;
  padding: 24px;
}
```

### Layout éditeur + résumé
`display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start;`
La colonne droite (résumé/totaux) est `position: sticky; top: …`.

### Boutons
- **Primaire** : fond `--black`, texte `--white`, hover `--green-dark` (ou `--green`),
  radius 0, padding ~`12px 20px`, `font-weight: 600`.
- **Secondaire** : fond transparent, bordure `1px solid var(--gray2)`, texte
  `--black`, hover bordure `--black`.
- **Danger** (rare, ex: supprimer) : texte/bordure `--red`.

### Badges de statut
Pastille rectangulaire (radius 0), `var(--mono)`, `10px`, `.06–.12em`, uppercase,
fond clair + bordure assortie selon l'état :
- Brouillon → `--gray3` sur `--gray-bg`
- Envoyé → `--orange` sur `--orange-bg` / bordure `--orange-b`
- Signé → `--green` sur `--green-light` / bordure `--green-b`
- Refusé / Expiré → `--red` sur `--red-bg` / bordure `--red-b`

### Inputs & selects
Fond `--white`, bordure `1px solid var(--gray2)`, radius 0, padding ~`12–14px`,
focus `border-color: var(--black)`. Champs numériques (prix, quantités) en `--mono`.

### Tables (listes)
En-têtes en eyebrow mono `--gray3`, lignes séparées par `1px solid var(--gray2)`,
hover ligne `background: var(--gray-bg)`. Montants alignés à droite en `--mono`,
vert si total clé.

## Anti-patterns (à ne jamais faire)

- Arrondis « doux », ombres portées, dégradés, glassmorphism.
- Vert sur des titres ou des bordures décoratives.
- Emoji ou icônes illustratives.
- Couleurs hex en dur dans les composants → toujours `var(--token)`.
