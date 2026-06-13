# ARCHITECTURE — SOCLE

> Document écrit pour deux publics : un développeur qui découvre le projet,
> et le fondateur (non-développeur) qui veut comprendre la logique de son
> produit. Les termes techniques sont expliqués au fil du texte ; un
> glossaire métier/technique se trouve à la fin.

---

## 1. Qu'est-ce que SOCLE ?

SOCLE est une suite d'outils web en français pour les artisans du bâtiment
(BTP) qui se lancent. Elle couvre le cycle de vie de l'artisan :

1. **Lancement** — checklist de création, CGV, prévisionnel année 1,
   simulateur d'assurance décennale ;
2. **Construire son prix** — taux horaire viable, prix des matériaux ;
3. **Vendre** — devis (le cœur du produit aujourd'hui) ;
4. **Fin de chantier** — PV de réception, bibliothèque DTU.

Le produit est une application **Next.js 15 / React 19 / TypeScript**,
**100 % locale** : toutes les données vivent dans le navigateur de
l'utilisateur (localStorage + IndexedDB), il n'y a **aucun serveur, aucune
base de données, aucun compte**. C'est un choix assumé de MVP — voir
§ 7 « Choix d'architecture ».

---

## 2. Carte du dépôt

Le dépôt mélange trois générations de code, c'est voulu et documenté :

```
SOCLE/
├── estimateur_btp_v8_65_1.html   ← outil historique "ChiffReno" (HTML autonome, production)
├── _legacy/                      ← prototypes HTML des autres outils (avant migration)
│
├── app/                          ← pages Next.js (App Router)
│   ├── (app)/                    ← pages avec topbar + sidebar (dashboard, chantiers,
│   │                               construction/*, après/*, paramètres…)
│   └── (editor)/                 ← pages PLEIN ÉCRAN (éditeur de devis, finalisation,
│                                   prix matériaux, PV de réception)
│
├── components/                   ← composants React
│   ├── devis/                    ← tout l'UI du module devis (éditeur, aperçu, PV…)
│   │   └── configurateurs/       ← une "box" de configuration par lot (cloisons, élec…)
│   ├── AppShell / Topbar / Sidebar / EditorShell  ← squelette de l'interface
│   └── LegacyTool.tsx            ← embarque un outil HTML legacy dans une page Next
│
├── lib/                          ← TOUTE la logique métier (aucun rendu ici)
│   ├── devis/                    ← module devis : modèle de données, persistance,
│   │   │                           régime TVA, échéancier, numérotation, PV…
│   │   └── engine/               ← LE MOTEUR DE CHIFFRAGE (voir § 4)
│   ├── taux-horaire.ts           ← moteur du simulateur de taux horaire
│   ├── tarifs-marche.ts          ← tarifs de référence du marché par métier/zone
│   ├── activites.ts              ← concept "activité" (quels lots proposer par métier)
│   ├── nav.ts / use-sidebar.ts   ← navigation et état de la sidebar
│   └── legacy/extract.ts         ← extraction/scoping des outils HTML legacy
│
├── tests/                        ← suite Vitest (modules de calcul purs)
└── CLAUDE.md / DESIGN.md / ANALYSE_OUTILS_SOCLE.md  ← docs internes
```

**Règle de dépendance fondamentale** : `lib/` ne dépend jamais de
`components/` ni de `app/`. La logique de calcul est **pure** (de simples
fonctions : des données entrent, des données sortent), ce qui la rend
testable sans navigateur. L'UI consomme `lib/`, jamais l'inverse.

Les *route groups* Next.js `(app)` et `(editor)` ne changent pas les URLs :
ils choisissent seulement le squelette visuel (avec ou sans sidebar).

---

## 3. Vue d'ensemble du module Devis (le cœur)

Le module devis est organisé en **trois couches**, de bas en haut :

```
┌────────────────────────────────────────────────────────────────┐
│  UI (components/devis + app/(editor))                          │
│  éditeur 3 colonnes · configurateurs par lot · finalisation ·  │
│  aperçu A4 / impression PDF                                    │
├────────────────────────────────────────────────────────────────┤
│  Logique métier (lib/devis + lib/devis/engine)                 │
│  moteur de chiffrage · totaux · agrégation client · régime TVA │
│  · échéancier · numérotation · statuts                         │
├────────────────────────────────────────────────────────────────┤
│  Persistance (lib/devis/repository.ts)                         │
│  localStorage (clés socle_*) · migrations silencieuses ·       │
│  photos PV en IndexedDB (pvPhotos.ts)                          │
└────────────────────────────────────────────────────────────────┘
```

### Le flux complet, de la saisie au PDF

C'est LE schéma à avoir en tête pour comprendre le produit :

```
 1. SAISIE        L'artisan configure des "segments" dans l'éditeur
                  (ex. « 25 m² de cloison hydro M70 isolée »)
                        │  écrit dans EngineState (l'état du devis)
                        ▼
 2. CALCUL        calcItems() — lib/devis/engine/calc-items.ts
                  transforme la config en LIGNES DÉTAILLÉES de matériaux
                  (plaques, rails, montants, visserie, enduit…) chiffrées
                  aux prix du barème BP
                        │  EngineLigne[] (la "liste de courses" interne)
                        ▼
 3. TOTAUX        calcEngineTotaux() — lib/devis/engine/totals.ts
                  applique la formule de marge : (matériaux + MO) × (1+marge%),
                  la remise globale, la ventilation TVA par taux
                        │  DevisTotaux (HT, TVA, TTC, marge…)
                        ▼
 4. AGRÉGATION    agregerLignesClient() — lib/devis/engine/agregation.ts
                  regroupe les lignes détaillées en LIGNES CLIENT lisibles
                  (une par prestation : « Cloison hydrofuge — 25 m² — 1 850 € »)
                  sans JAMAIS montrer le détail interne ni la marge
                        │  LigneClient[]
                        ▼
 5. AFFICHAGE     · DevisEditorEngine (éditeur) : récap temps réel
                  · DevisFinalisation : habillage (intro, dates, échéancier)
                  · ApercuDocument : la feuille A4 du document client
                        ▼
 6. PDF           ApercuDevis (page /apercu) → window.print()
                  (le "PDF" est l'impression navigateur de la feuille A4)
```

Point essentiel : **les lignes ne sont jamais stockées**. On stocke la
*configuration* (l'`EngineState`), et tout le reste — lignes, totaux, lignes
client — est **recalculé à chaque affichage**. Un prix de barème corrigé se
répercute partout, et il n'y a jamais de désynchronisation entre ce que
montre l'éditeur, la finalisation et le PDF.

---

## 4. Le moteur de chiffrage (`lib/devis/engine/`)

C'est le portage TypeScript du moteur de l'estimateur historique ChiffReno
(`estimateur_btp_v8_65_1.html`), enrichi depuis. Fichier par fichier :

| Fichier | Rôle |
|---|---|
| `types.ts` | Tous les types du moteur : les 14 lots (`LotId`), l'état d'un lot (`LotState`), l'état global (`EngineState`), une ligne calculée (`EngineLigne`), et les modèles de **segments** par lot (cloisons, faux-plafond, ITI, peinture, parquet, carrelage, faïence). |
| `bp.ts` | **BP = Base Prices**, le barème : un dictionnaire plat `clé → prix unitaire HT en €`. Source unique des prix matériaux. ⚠️ Prix indicatifs à calibrer. |
| `lots.ts` | Métadonnées des lots (`LM` : ordre, libellés, icônes) et état initial d'un devis vide. |
| `calc-items.ts` | **Le cœur du moteur.** `calcItems(state, lotId)` = un grand `switch` par lot qui transforme la configuration en lignes de matériaux chiffrées. Contient aussi les helpers prix (`px` avec override, `pxRag` ragréage à l'épaisseur, chute, surface). |
| `totals.ts` | Totaux par lot et globaux : formule de marge, remise, **ventilation TVA**, récap interne artisan (déboursé, MO, marge), flag `tauxHoraireManquant`. Contient `lineClientCA`/`lotCAContext`, la **formule unique** de ventilation du CA par ligne (voir § 8). |
| `agregation.ts` | Couche **au-dessus** du moteur : regroupe les lignes détaillées en lignes client par prestation, génère les libellés commerciaux et descriptions, gère les overrides de prix/libellé posés par l'artisan, et recalcule des totaux "client" quand un override existe (`calcClientTotaux`). |
| `normalize.ts` | Ré-hydrate un `EngineState` relu depuis le stockage : garantit que toutes les clés de lots existent (un lot ajouté plus tard ne casse pas les anciens devis), purge les champs disparus, préserve les champs sensibles (`coutRevientPoints` reste `undefined` si absent — jamais converti en 0). |
| `points.ts` | Types génériques des catalogues "à points" : prestations fourniture+pose à **prix ferme** (l'artisan saisit une quantité, chaque point devient une ligne `prixEstFinal=true`). |
| `catalogue-elec.ts` | Catalogue électricité : 17 prestations à points (prises, commandes, éclairage) avec part fourniture/pose indicative pour l'affichage client. |
| `catalogue-demolition.ts` | Catalogue démolition : 13 postes à prix ferme (100 % pose, aucune fourniture). |
| `iti.ts` | Familles d'isolants ITI, conductivités λ et calcul de la résistance R — centralisé pour que moteur et agrégation affichent le **même** R. |
| `sanity-test.ts`, `round-trip-test.ts`, `elec-devis-render-test.ts` | Scripts de validation manuels (lancés via `npx tsx`), antérieurs à la suite Vitest. Ils ne sont pas ramassés par `npm test`. |

### Les deux familles de lignes (concept central)

Tout le moteur repose sur la distinction entre deux régimes de prix :

1. **Lignes "déboursé"** (`prixEstFinal = false`) — la liste de courses :
   le moteur calcule le coût des matériaux, puis le prix client est obtenu
   par la formule de marge :
   `CA du lot = (matériaux + main-d'œuvre) × (1 + marge %)`,
   avec `main-d'œuvre = heures saisies × taux horaire de l'entreprise`.
   C'est le régime des cloisons, peinture, carrelage, ITI…

2. **Lignes "à prix ferme"** (`prixEstFinal = true`) — les catalogues à
   points (électricité, démolition) et les lignes/segments libres : le prix
   affiché EST le prix client, le moteur n'ajoute **ni marge ni MO**. La
   marge réelle de l'artisan est suivie à part via `coutRevientPoints`
   (coût de revient saisi à la main ; s'il ne l'est pas, la marge est
   « non renseignée », jamais supposée à 100 %).

Le lot électricité est **hybride** : une infrastructure au déboursé
(tableau, gaines… → marge + MO) + des points à prix ferme.
`CA du lot = CA déboursé + CA points`.

### Le modèle "segments"

Depuis juin 2026, la plupart des lots se configurent en **segments** : une
carte = une prestation homogène (ex. un segment « cloison hydro M70,
isolée, 25 m² »). Le tableau `o.lignes` du lot contient ces segments ;
chaque segment porte un `id` stable qui sert à la fois de clé React, de
`groupId` pour rattacher les lignes moteur à leur prestation, et de cible
pour le cumul (deux segments identiques fusionnent leurs m²). Les lots
migrés : cloisons (pilote), faux-plafond, ITI, peinture, parquet,
carrelage, faïence. Chaque segment peut recevoir un **override** de prix
(`puOverride`) et de libellé (`libelleOverride`) posé par l'artisan.

---

## 5. Le reste du module Devis (`lib/devis/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | Le modèle de données global : `Entreprise` (profil, taux horaire, logo…), `Client`, `Chantier`, `Devis` (qui porte l'`EngineState` dans son champ `engine`), `Facture` (modèle seul, pas d'UI), `PV` de réception, échéancier, régime TVA. |
| `repository.ts` | **Toute la persistance** (voir § 6). |
| `regime.ts` | Régimes de TVA : franchise en base / TVA normale / autoliquidation. Résout le régime autorisé selon l'assujettissement de l'entreprise. |
| `echeancier.ts` | Résout l'échéancier de paiement (acompte / situations / solde) en montants TTC. Règle d'or : la ligne « solde » absorbe les arrondis pour que la somme = total TTC au centime. |
| `numerotation.ts` | Numéros de devis `DEV-{année}-{seq}` ; le compteur ne redescend jamais (un brouillon supprimé laisse un « trou » — pratique standard BTP). |
| `devis-status.ts` | Statuts du devis (brouillon, envoyé, signé, refusé) ; « expiré » est **dérivé** à l'affichage, jamais stocké. |
| `pv-status.ts` | Statut global du PV de réception, **dérivé** des verdicts par lot (refus > réserve > sans réserve). |
| `pvPhotos.ts` | Photos des réserves du PV, stockées en **IndexedDB** (localStorage plafonne à ~5 Mo) ; le modèle PV ne référence que des clés, jamais le binaire. |
| `catalogue-prestations.ts` | Catalogue statique de ~38 prestations (héritage C1, utilisé par la bibliothèque). |
| `format.ts` | Formatage fr-FR (euros, dates). |

---

## 6. Persistance : localStorage et migrations

`lib/devis/repository.ts` est la **seule** porte d'entrée vers le stockage.
Tout y est **asynchrone (Promise)** alors que localStorage est synchrone :
c'est volontaire, pour que la future bascule vers Supabase (base de données
en ligne) ne change pas une ligne dans les composants.

Clés localStorage : `socle_entreprise`, `socle_clients`, `socle_devis`,
`socle_devis_seq`, `socle_chantiers`, `socle_factures`, `socle_pv`,
`socle_schema_version` (+ `btp_v8d` pour l'estimateur matériaux legacy,
et IndexedDB pour les photos de PV).

Deux mécanismes de migration coexistent :

1. **Migration silencieuse à la lecture** (`normalizeDevis` +
   `normalizeEngine`) : chaque devis relu est ré-hydraté champ par champ
   avec des défauts sûrs. Un devis enregistré il y a trois mois reste
   lisible même si le modèle a évolué entre-temps. C'est la voie normale.
2. **Reset versionné one-shot** (`socle_schema_version`) : pour les
   ruptures assumées (v1 → v2 : passage au modèle Chantier), le storage des
   devis de test est purgé une seule fois.

À chaque **écriture** d'un devis, `withTotaux()` :
- pousse les 4 champs d'en-tête (surface, TVA par défaut, remise) du Devis
  vers l'`EngineState` (l'en-tête est la source de vérité, jamais l'inverse) ;
- recalcule les totaux dénormalisés (`totalHT/TVA/TTC`, `margeHT`) stockés
  sur le devis pour l'affichage des listes sans recalcul complet.

---

## 7. Choix d'architecture notables (et pourquoi)

**État de configuration vs lignes calculées.** On ne stocke jamais le
résultat, seulement la saisie. Avantages : pas de désynchronisation
possible, corrections de barème rétroactives, stockage minuscule.
Contrepartie : un devis *signé* n'est pas figé — si un prix du barème BP
change, son montant recalculé change aussi (zone sensible connue, le
snapshot à la signature viendra avec la facturation).

**Moteur pur, sans navigateur.** `lib/devis/engine/` n'importe rien du
DOM. C'est ce qui permet la suite de tests (161 tests) et garantirait un
recalcul identique côté serveur le jour venu.

**Séparation moteur / agrégation.** Le moteur calcule (liste de courses,
totaux) ; l'agrégation présente (lignes client). L'agrégation ne refait
**aucun** calcul : elle regroupe des montants déjà ventilés par la formule
unique de `totals.ts`. Les overrides de prix posés par l'artisan vivent à
l'agrégation, jamais dans le moteur — les chiffres internes (déboursé,
marge) restent vrais.

**Trois niveaux de lecture d'un devis.** 1) le configurateur (la saisie),
2) la ligne client (ce que voit le client), 3) le détail interne
(`LigneClient.detailInterne` = la liste de courses, jamais montrée au
client). Le document client n'expose **jamais** marge, MO, déboursé ni
notes internes.

**localStorage d'abord, Supabase plus tard.** Le MVP est 100 % local :
zéro coût d'infra, zéro RGPD serveur, fonctionne hors connexion.
L'interface async du repository et le schéma `lib/devis/schema.sql` sont
les deux préparatifs de la bascule.

**Numérotation sans trou réutilisé.** Un numéro attribué ne l'est qu'une
fois, même si le devis est supprimé (anti-litige).

**Outils legacy embarqués tels quels.** Les prototypes HTML de `_legacy/`
sont injectés dans les pages Next par `lib/legacy/extract.ts` +
`LegacyTool` (CSS scopé via `@scope`, scripts rejoués). Ça permet de livrer
la suite complète sans tout réécrire d'un coup ; l'estimateur matériaux
(`/chantier/materiaux`) fonctionne ainsi.

**Passerelle Prix Matériaux → Devis.** L'estimateur legacy exporte son
état localStorage ; le module devis l'importe sans dupliquer le moteur de
calcul.

---

## 8. Zones sensibles — où une erreur se propage

Par ordre de criticité décroissante :

1. **`totals.ts` — `lineClientCA` / `lotCAContext`.** LA formule de
   ventilation du chiffre d'affaires par ligne. Elle est partagée par la
   ventilation TVA (totals) ET par les lignes client (agregation). Toute
   divergence casse l'invariant « somme des lignes client = HT du lot » :
   le client verrait des lignes dont la somme ne fait pas le total. Ne
   jamais dupliquer cette formule ailleurs.

2. **`calc-items.ts` — le grand switch.** ~1 000 lignes, un `case` par
   lot. Une erreur de quantité ou de clé BP fausse silencieusement les
   devis du lot concerné. C'est le fichier le plus testé
   (`tests/engine-calc-items.test.ts`).

3. **`normalize.ts` — la migration silencieuse.** Chaque devis stocké
   passe par là à chaque lecture. Le piège documenté dans le fichier :
   `coutRevientPoints` doit rester `undefined` quand absent — le convertir
   en `0` ferait croire à un coût de revient nul, donc à une marge de
   100 % (bug silencieux le plus dangereux du module).

4. **`bp.ts` — le barème.** Un prix faux = tous les devis utilisant cette
   clé sont faux, y compris ceux déjà créés (recalcul permanent, cf. § 7).
   Plusieurs prix sont marqués INDICATIFS, à calibrer.

5. **`repository.ts` — `withTotaux` et la synchro en-tête → engine.**
   C'est ici que surface/TVA/remise du Devis écrasent celles de l'engine à
   chaque écriture. Inverser le sens de synchro créerait des devis
   incohérents.

6. **Les reliquats d'arrondi.** Trois endroits absorbent consciemment les
   centimes pour que les sommes tombent juste : le premier segment ventilé
   d'un lot (agregation), la ligne « solde » de l'échéancier, et le
   fast-path « zéro override » de `calcClientTotaux` (qui renvoie les
   totaux moteur tels quels tant qu'aucun override n'existe). Toucher à
   ces mécanismes fait apparaître des écarts d'un centime sur le document.

7. **`regime.ts` + le paramètre `regimeTVA` de `calcEngineTotaux`.** En
   franchise ou autoliquidation, AUCUNE TVA ne doit être calculée (ce
   n'est pas « TVA à 0 % », c'est « pas de ventilation du tout »). La
   résolution du régime est centralisée — `create()` du repository et
   `normalizeDevis` passent par la même fonction `resoudreRegimeTVA`.

---

## 9. Tests et validation

- **`npm test`** — suite Vitest (`tests/`, 161 tests) sur les modules purs :
  calc-items, totals, agregation, normalize, régime+échéancier,
  taux-horaire, annexes. Voir `RAPPORT_TESTS.md`.
- **`npx tsc --noEmit`** — vérification TypeScript (à préférer à
  `next build` dans les environnements sans réseau : le build télécharge
  des polices Google).
- Les trois scripts `*-test.ts` de `lib/devis/engine/` sont des
  validations manuelles historiques (`npx tsx <fichier>`), hors Vitest.

---

## 10. Glossaire

| Terme | Définition |
|---|---|
| **Lot** | Un corps de métier dans le devis (cloisons, élec, peinture…). 14 lots fixes + lots libres. |
| **Déboursé** | Ce que les matériaux coûtent à l'artisan (prix d'achat), avant marge et main-d'œuvre. |
| **MO** | Main-d'œuvre : heures saisies × taux horaire de l'entreprise. |
| **CA** | Chiffre d'affaires : le prix payé par le client (HT sauf mention contraire). |
| **Marge option A** | La formule du produit : `CA = (déboursé + MO) × (1 + marge %)` — la marge s'applique aussi à la main-d'œuvre. |
| **Point** | Prestation à prix ferme catalogue (ex. « pose d'une prise » = 75 €), sans marge ajoutée par le moteur. |
| **Segment** | Une prestation homogène configurée par l'artisan (une carte dans l'éditeur), stockée dans `o.lignes` du lot. |
| **Ligne hl** | Dans la liste de courses d'un groupe, la ligne « produit fini » mise en avant (highlight), qui donne son identité à la prestation. |
| **Ventilation TVA** | Répartition de la TVA par taux (5,5 / 10 / 20 %) quand un devis mélange plusieurs taux. |
| **Override** | Valeur saisie par l'artisan qui remplace une valeur calculée (prix ou libellé d'une ligne). |
| **Agrégation** | Le regroupement des lignes détaillées du moteur en lignes lisibles pour le client. |
| **Normalisation** | La ré-hydratation d'une donnée relue du stockage vers le modèle courant, avec défauts sûrs. |
| **Repository** | La couche unique d'accès au stockage (lecture/écriture localStorage, futur Supabase). |
| **EngineState** | L'état complet du chiffrage d'un devis : surface, TVA, remise, et la configuration des 14 lots. |
| **C1 / P2 / P3…** | Jalons internes du chantier de migration (C1 = ancien modèle ligne-à-ligne, P2 = bascule sur le moteur, etc.). |
| **ChiffReno** | Ancien nom du produit ; désigne aussi l'estimateur HTML historique dont le moteur a été porté. |
| **DTU** | Documents Techniques Unifiés — normes de mise en œuvre du BTP français. |

---

*Document généré lors de la session de documentation du 13/06/2026, en
préparation de l'audit externe. Voir `RAPPORT_DOC.md` pour les observations
relevées pendant la rédaction.*
