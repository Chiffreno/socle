# Rapport — Suite de tests automatisés (session nocturne du 11/06/2026)

## TL;DR

- **161 tests, 161 passent** ✅. La suite a d'abord révélé un vrai bug de calcul
  (remise en % négative qui **augmentait** le total du devis), laissé en échec
  volontaire dans la session nocturne du 11/06. **Ce bug a été corrigé depuis**
  (clamp à 0, cf. § 3 bug n°1) : le test correspondant assert désormais le bon
  comportement et passe.
- **Vitest 4.1.8 a été installé** (aucun framework de test n'existait dans le
  projet). Lancement : `npm test`.
- `npx tsc --noEmit` : **vert** (aucune erreur TypeScript introduite).
- 2 comportements suspects supplémentaires restent documentés et **non corrigés**
  (chute cloisons forcée à 5 %, prix réseau élec à 0 impossible) + 3 notes
  mineures — leurs tests assertent toujours le comportement actuel.

---

## 1. Framework installé (à signaler)

Le projet n'avait **aucun** framework de test (les fichiers `sanity-test.ts`,
`round-trip-test.ts`, `elec-devis-render-test.ts` sont des scripts manuels
lancés via `npx tsx`, ils n'ont pas été touchés et ne sont pas ramassés par la
nouvelle suite).

Installé / ajouté :

| Fichier | Rôle |
|---|---|
| `package.json` | `vitest ^4.1.8` en devDependency + scripts `test` / `test:watch` |
| `vitest.config.ts` | environnement node, pattern `tests/**/*.test.ts` |
| `tests/helpers.ts` | fixtures (état moteur initial réel + lignes custom contrôlées) |

**Lancer les tests** :

```bash
npm test                                  # toute la suite
npx vitest run tests/engine-totals.test.ts  # un seul fichier
npm run test:watch                        # mode watch
```

## 2. Modules couverts

| Fichier de test | Module(s) testé(s) | Tests | Résultat |
|---|---|---|---|
| `tests/engine-totals.test.ts` | `lib/devis/engine/totals.ts` (round2, marge+MO, points, sansMO, remise, ventilation TVA, régimes, alertes) | 33 | 33 ✓ |
| `tests/engine-calc-items.test.ts` | `lib/devis/engine/calc-items.ts` (px/pxRag/lsurf/chuted + les 14 lots : segments, points, zones, hybride élec, overrides, customs) | 51 | 51 ✓ |
| `tests/engine-agregation.test.ts` | `lib/devis/engine/agregation.ts` (lignes client, invariant Σ = HT lot, overrides PU/libellé, split fourniture/pose élec, lots libres, calcClientTotaux) | 18 | 18 ✓ |
| `tests/engine-normalize.test.ts` | `lib/devis/engine/normalize.ts` (round-trip, migrations cloisons/zones/gammes, champs sensibles) | 12 | 12 ✓ |
| `tests/taux-horaire.test.ts` | `lib/taux-horaire.ts` (4 régimes, ACRE, jours facturables, majorations, cas limites) | 15 | 15 ✓ |
| `tests/regime-echeancier.test.ts` | `lib/devis/regime.ts` + `lib/devis/echeancier.ts` | 15 | 15 ✓ |
| `tests/annexes.test.ts` | `engine/iti.ts`, `engine/points.ts` (+ intégrité du catalogue élec), `numerotation.ts`, `format.ts`, `devis-status.ts` | 17 | 17 ✓ |
| **Total** | | **161** | **161 ✓** |

Chaque test porte un commentaire expliquant ce qu'il vérifie et pourquoi.

Invariants clés couverts :
- `caDeboursé = (matériaux + MO) × (1 + marge %)` et lignes `prixEstFinal`
  jamais margées (formule « option A »).
- `Σ lineClientCA = caDeboursé` par lot (source unique totals/agrégation).
- `Σ LigneClient.prixClient = caLot` au centime (absorption du reliquat).
- `Σ ventilationTVA = totalTVA` ; TVA nulle en franchise/autoliquidation, HT
  intact.
- `Σ échéances = totalTTC` strictement (le solde absorbe les arrondis).
- Overrides élec (infra et points) : aucune redistribution de MO, totaux moteur
  inchangés pour l'infra.
- `coutRevientPoints` absent reste `undefined` après round-trip (≠ 0).

## 3. ⚠️ Bugs et comportements suspects révélés

### Bug n°1 — Remise en % négative : le total du devis AUGMENTAIT ✅ CORRIGÉ

- **Statut** : **corrigé**. Le test passe désormais et la suite est à 161/161.
- **Où** : `lib/devis/engine/totals.ts`, fonction `remiseAmount`.
- **Constat initial** : en mode `pourcent`, la valeur n'était pas clampée à 0,
  alors que le mode `euros` l'était (`Math.max(0, valeur)`).
- **Reproduction (avant fix)** : sous-total HT 260 €, `remiseMode: "pourcent"`,
  `remiseValeur: -10` → `remiseHT = -26 €`, `totalHT = 286 €` (la TVA était
  gonflée d'autant).
- **Correction** : le mode `pourcent` clampe désormais la valeur à 0
  (`Math.max(0, valeur)`), par symétrie avec le mode euros — une saisie négative
  ne peut plus gonfler le devis. La logique **dupliquée** dans `agregation.ts`
  (`remiseAmountClient`) a été corrigée **à l'identique**.
- **Test** : `engine-totals.test.ts` → « remise en % négative : ne doit JAMAIS
  augmenter le total » assert maintenant le bon comportement (remise = 0).
- **Reste à faire côté UI** : l'éditeur devrait refuser/signaler la saisie d'une
  remise négative (le moteur la neutralise, mais l'utilisateur n'en est pas
  averti). Hors périmètre du moteur.

### Suspect n°2 — Cloisons : chute à 0 % impossible (retombe à 5 %)

- **Où** : `calc-items.ts`, case `cloisons` : `const chute = Number(o.chute) || 5`.
- **Constat** : une chute explicitement saisie à 0 % retombe silencieusement à
  5 %. Incohérent avec (a) l'état initial du lot (`chute: 0` dans `lots.ts`) et
  (b) les autres lots segments (parquet/carrelage/faïence/faux-plafond font
  `|| 0`). Concrètement : 25 m² × 2 peaux = 50 m² nets → 52,5 m² facturés en
  plaques même à « 0 % » de chute.
- **Test** : « COMPORTEMENT SUSPECT documenté : chute 0 impossible » (passe en
  assertant le comportement actuel ; à inverser si tu corriges).

### Suspect n°3 — Élec : prix réseau au m² saisi à 0 € impossible

- **Où** : `calc-items.ts`, case `elec` :
  `Number(o.reseau_prix_m2) || BP.elec_reseau_m2 || 20`.
- **Constat** : un prix réseau saisi à 0 €/m² (réseau offert) retombe sur le
  prix BP (20 €/m²). À comparer avec l'override des points où `pu: 0` est
  accepté (`ov.pu >= 0`).
- **Test** : « COMPORTEMENT SUSPECT documenté : prix réseau saisi à 0 → retombe
  au prix BP » (passe en assertant le comportement actuel).

### Notes mineures (assumées par le code, à connaître)

1. **Plomberie** : le lot ajoute TOUJOURS un chauffe-eau (défaut
   `ce_elec_150`, 295 €) dès qu'il est actif, même configuration vide — il n'y
   a pas d'option « pas de chauffe-eau ».
2. **Menuiseries int.** : le lot génère ses 3 lignes (porte/plinthe/seuil) même
   à quantité 0 (total 0 €) — lignes vides potentiellement visibles dans les
   rendus legacy ligne-à-ligne.
3. **Échéancier** : sans ligne « solde », la somme peut différer du TTC ; des
   acomptes > 100 % rendent le solde négatif. Les deux sont assumés par le
   module (garde-fou visuel côté UI, cf. en-tête de `echeancier.ts`) et testés
   comme tels.
4. **Régime TVA** : `resoudreRegimeTVA` conserve une valeur valide même
   incohérente avec l'assujettissement (ex. `franchise` pour un assujetti) —
   assumé (la cohérence vient des selects UI), testé et documenté.

## 4. Ce qui n'a pas été couvert, et pourquoi

| Module | Raison |
|---|---|
| `app/(app)/chantier/rentabilite/page.tsx` (rentabilité chantier : déboursé sec, frais généraux, marge, verdict) | Les formules sont **inline dans le composant client** (`useState`). Intestable sans extraire la logique dans `lib/` — ce serait une refactorisation, interdite par le brief. Suggestion pour plus tard : extraire vers `lib/rentabilite.ts` puis tester (les formules sont pures et simples). Le calculateur taux horaire / prix jour (`lib/taux-horaire.ts`), lui, est couvert. |
| `lib/devis/repository.ts` | Couche de persistance (localStorage), pas un module de calcul. Sa logique de calcul (résolution du régime) est déléguée à `regime.ts`, qui est couvert. |
| `lib/devis/pvPhotos.ts` | IndexedDB + compression d'images : nécessite un environnement navigateur/mocks lourds, pas du calcul. |
| `estimateur_btp_v8_65_1.html` | JS embarqué dans le HTML standalone, non importable par un test sans extraction. |
| `lib/tarifs-marche.ts`, `lib/activites.ts`, `pv-status.ts`, `catalogue-prestations.ts` | Données statiques / metadata UI, pas de logique de calcul (le catalogue élec, lui, a un test d'intégrité référentielle). |
| Fonctions `description*` d'`agregation.ts` | Couvertes indirectement (présence/absence de description par type de segment) ; pas de test exhaustif du wording — c'est de l'affichage, leur texte va encore bouger. |

## 5. Vérifications finales

```
npm test         → Test Files 7 passed (7) — Tests 161 passed (161)
npx tsc --noEmit → exit 0, aucune erreur
```

Fichiers de la suite : `vitest.config.ts`, `tests/` (8 fichiers),
`RAPPORT_TESTS.md` ; `package.json`/`package-lock.json` (vitest + scripts).

> **Mise à jour du 13/06/2026** : le bug n°1 (remise % négative) a été corrigé
> dans `totals.ts` + `agregation.ts` ; le test associé assert désormais le bon
> comportement. La suite est passée de 160/161 à **161/161**. Les comportements
> suspects n°2 et n°3 et les notes mineures n'ont pas été modifiés.
