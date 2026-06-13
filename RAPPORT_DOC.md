# Rapport — Session de documentation (nuit du 13/06/2026)

## TL;DR

- **`ARCHITECTURE.md` créé à la racine** : structure du projet, rôle de chaque
  module, flux saisie → calcul → agrégation → affichage → PDF, choix
  d'architecture, zones sensibles, glossaire. Écrit pour le dev auditeur ET
  pour toi.
- **3 fichiers de `lib/` ont reçu un en-tête français** (les seuls qui n'en
  avaient pas — voir § 1, c'est une bonne nouvelle).
- **Aucune ligne de code exécutable modifiée. Aucun commit.**
- Vérifications finales : `npx tsc --noEmit` **vert**, `npm test`
  **161/161 tests passent** (note : `RAPPORT_TESTS.md` annonce encore
  160/161 — le bug de la remise négative a été corrigé depuis, le rapport
  de tests est en retard d'une guerre, cf. § 3.4).
- Une liste d'observations (incohérences, code mort, questions) en § 3 —
  **rien n'a été corrigé**, conformément au brief.

---

## 1. Fichiers documentés

### Créés

| Fichier | Contenu |
|---|---|
| `ARCHITECTURE.md` | Le document principal (10 sections + glossaire). |
| `RAPPORT_DOC.md` | Ce rapport. |

### En-têtes ajoutés (commentaires uniquement)

| Fichier | En-tête ajouté |
|---|---|
| `lib/nav.ts` | Rôle (source unique de la navigation sidebar), comment ajouter/retirer une page, convention d'icônes Tabler. |
| `lib/use-sidebar.ts` | Rôle (état replié partagé), mécanisme de synchro (localStorage + events), invariant SSR (1er rendu toujours déployé). |
| `lib/legacy/extract.ts` | Rôle (embarquer les prototypes `_legacy/` dans Next), garanties (CSS scopé `@scope`, design system appliqué mécaniquement), exécution serveur uniquement. |

### Pourquoi seulement 3 fichiers ?

C'est le constat le plus rassurant de la session : **les ~25 autres fichiers
de `lib/` ont déjà des en-têtes français détaillés et de très bonne
qualité** (formules documentées, invariants, pièges signalés). Le moteur
(`calc-items.ts`, `totals.ts`, `agregation.ts`, `normalize.ts`), le
repository, l'échéancier, le taux horaire… tout y est. J'ai donc concentré
l'effort sur `ARCHITECTURE.md`, qui manquait réellement : la vue
d'ensemble qui relie ces fichiers entre eux. Réécrire des en-têtes déjà
bons aurait créé du bruit dans le diff avant audit.

---

## 2. Vérifications (rien n'est cassé)

```
npx tsc --noEmit   → exit 0 (aucune erreur TypeScript)
npm test           → 7 fichiers, 161/161 tests passent (574 ms)
```

Logique : seuls des commentaires et des fichiers `.md` ont été ajoutés.

---

## 3. Ce que j'ai découvert en documentant

Rien de ce qui suit n'a été modifié. Classé par importance pour l'audit de
mardi.

### 3.1 `CLAUDE.md` est trompeur — à corriger AVANT l'audit

Le `CLAUDE.md` à la racine décrit le projet comme si la migration Next.js
n'avait **pas commencé** (« Migration target : Not started — no app/, no
pages yet ») et consacre toute sa seconde moitié à l'architecture du fichier
HTML de l'estimateur. Or l'app Next.js est aujourd'hui la partie la plus
développée du dépôt (~40 pages/composants, 7 500 lignes dans `lib/`, une
suite de tests). Un auditeur qui commence par ce fichier — c'est fait pour
ça — partira dans la mauvaise direction. Il existe aussi un `CLAUDE_1.md`
(variante française du même fichier) dont le rôle n'est pas clair :
doublon à trancher.

### 3.2 « 15 lots » vs 14 lots — commentaires périmés

Le lot étanchéité a été supprimé en juin 2026 (devenu une option de
carrelage/faïence) : `LotId` compte **14** lots. Mais au moins 5
commentaires parlent encore de « 15 lots » :
`lib/devis/types.ts:6` et `:318`, `lib/devis/engine/types.ts:369`,
`components/devis/DevisEditorEngine.tsx:8` (et `:217`, `:980`),
`components/devis/PvReceptionEditor.tsx:13`. Purement cosmétique, mais un
auditeur qui compte les lots va buter dessus.

### 3.3 Code mort ou en sursis

- **`lib/devis/catalogue-prestations.ts`** (~38 prestations, modèle C1) :
  **importé nulle part** dans `app/`, `components/` ou `lib/`. Son en-tête
  dit « au clic [+] dans la bibliothèque » — cette bibliothèque n'existe
  plus dans l'UI actuelle. Candidat à la suppression, ou à garder si la
  bibliothèque revient ; à trancher.
- **`Lot` / `Ligne` `@deprecated`** dans `lib/devis/types.ts` + le champ
  `Devis.lots` forcé à `[]` par la migration : prévu pour disparaître
  « en P3 » — P3 est fait (l'éditeur tourne sur l'engine), la suppression
  n'a juste jamais été faite.
- **`Devis.acomptePct` `@deprecated`** : encore nécessaire (migration vers
  l'échéancier), mais son retrait n'a pas de date.
- **`computeTaux` / type `Statut` `@deprecated`** dans `lib/taux-horaire.ts` :
  conservés pour le mini-simulateur de la landing, « à retirer une fois la
  landing migrée ».
- Les trois scripts `*-test.ts` de `lib/devis/engine/` (sanity, round-trip,
  elec-render) sont des validations manuelles pré-Vitest. Une partie de
  leur couverture est probablement redondante avec `tests/` maintenant —
  à confirmer avant d'en supprimer.

### 3.4 Documents racine en retard sur le code

- **`RAPPORT_TESTS.md`** : annonce « 160/161, 1 échec volontaire (remise %
  négative) ». Le moteur clampe désormais la remise négative à 0
  (`totals.ts` et `agregation.ts`) et les **161 tests passent**. Le rapport
  décrit donc un bug déjà corrigé comme ouvert.
- **`lib/devis/engine/bp.ts`** dit « porté de estimateur_btp_v8_64.html »
  alors que `CLAUDE.md` désigne v8_65_1 comme référence. Probablement
  exact historiquement (le portage date de la v8_64), mais ça mérite une
  ligne d'explication quelque part.

### 3.5 Comportement à connaître (pas un bug, mais à décider)

**Un devis signé n'est pas figé.** Le produit ne stocke jamais les lignes,
il les recalcule depuis la configuration + le barème `BP` à chaque
affichage (c'est un choix d'architecture par ailleurs très sain). Conséquence :
si un prix de `BP` change dans une future version, le montant affiché d'un
devis **déjà signé** changera aussi. Les totaux dénormalisés stockés
(`totalHT/TTC`) ne sont recalculés qu'à l'écriture, donc la liste des devis
peut même temporairement afficher un montant différent de l'aperçu. Le
snapshot à la signature (geler les lignes au moment où le client signe)
semble être le chaînon manquant — probablement prévu avec la facturation,
mais je n'en trouve aucune trace écrite.

### 3.6 Zones obscures / questions que je me pose

- **`lotsLibres` dans `EngineState` vs `lignesLibres` dans chaque
  `LotState`** : deux mécanismes proches (lignes à prix ferme hors moteur).
  La distinction est documentée (lot entier titré vs lignes additives dans
  un lot existant) mais un auditeur demandera pourquoi deux chemins.
- **Le lot `plombs`** : l'identifiant suggère « plomberie » mais je n'ai pas
  trouvé de catalogue plomberie (points.ts dit « réutilisables pour le
  futur catalogue Plomberie »). Le `case "plombs"` de calc-items existe ;
  c'est le seul lot dont je n'ai pas compris le périmètre exact depuis le
  code seul. Les ids `menus` / `menuext` (menuiseries int/ext ?) gagneraient
  aussi un mot dans `lots.ts`.
- **Le dossier `SOCLE/` à la racine du repo** (qui s'appelle déjà
  SOCLE/SOCLE) contient du contenu blog/SEO sans lien avec le code. Trois
  niveaux de « SOCLE » imbriqués : déroutant pour un nouveau venu, et ce
  contenu n'a probablement rien à faire dans le repo du produit.
- **Beaucoup de prix sont marqués « INDICATIFS / à valider »** (`bp.ts`,
  segments parquet/carrelage/faïence, `partFourniturePct` élec,
  `catalogue-prestations.ts`, `tarifs-marche.ts`). C'est tracé proprement
  dans les commentaires, mais il n'existe pas de liste consolidée de « ce
  qui attend une passe prix » — elle serait utile le jour où tu t'y mets.
- **`.pv-screens/` à la racine** : 3 captures d'écran du PV — artefact de
  session de dev à ranger ou ignorer (`.gitignore` ?).

### 3.7 Points forts à mettre en avant pendant l'audit

Pour équilibrer : le code est inhabituellement bien auto-documenté (en
français, avec les invariants et les pièges), la logique de calcul est pure
et testée (161 tests), la formule de ventilation est centralisée en un seul
endroit (`lineClientCA`), les migrations de données sont défensives, et la
séparation moteur/agrégation/UI est nette. Un auditeur externe devrait s'y
retrouver vite — surtout avec `ARCHITECTURE.md` comme porte d'entrée.

---

*Aucun commit effectué — tout est en working tree pour ta revue au réveil.*
