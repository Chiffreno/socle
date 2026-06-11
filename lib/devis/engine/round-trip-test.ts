// ============================================================
// SOCLE — Module Devis — Round-trip test P2
//
// Valide la couche données du devis :
//   1. EngineState survit à JSON.stringify / JSON.parse sans perte.
//   2. normalizeDevis (migration silencieuse) re-hydrate proprement un
//      devis sérialisé en passant par localStorage / JSONB Supabase.
//   3. Les 4 CHAMPS SENSIBLES sont strictement préservés :
//        a) lot.tva (override par lot, ex: ITI 5,5%)
//        b) lot.coutRevientPoints (undefined vs valeur — bug silencieux
//           le plus dangereux : confondre "non saisi" avec 0 € → marge 100%)
//        c) lot.o.points (Record imbriqué : id_prestation → quantité)
//        d) lot.custom[] (array de lignes manuelles)
//   4. calcEngineTotaux donne strictement les mêmes totaux avant/après
//      round-trip — tous les champs de DevisTotaux comparés.
//
// Lancer : npx tsx lib/devis/engine/round-trip-test.ts
// ============================================================

import { calcEngineTotaux, round2, type DevisTotaux } from "./totals";
import { agregerLignesClient, calcClientTotaux } from "./agregation";
import { createInitialEngineState } from "./lots";
import type { EngineState } from "./types";

const TAUX_HORAIRE = 45; // €/h
let failures = 0;

function assert(cond: boolean, label: string, detail?: string) {
  const flag = cond ? "✓" : "❌";
  console.log(`    ${flag} ${label}${detail ? `   ${detail}` : ""}`);
  if (!cond) failures++;
}
function assertEqJSON(label: string, a: unknown, b: unknown) {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  const ok = ja === jb;
  assert(ok, label, ok ? "" : `\n         avant : ${ja}\n         après : ${jb}`);
}

// ─── Construction d'un EngineState riche (4 champs sensibles activés) ──

const engine: EngineState = createInitialEngineState({
  globalSurf: 43,
  tvaParDefaut: 10,
  remiseMode: "pourcent",
  remiseValeur: 5,
});

// ── Lot ITI : TVA override 5,5% (sensible a) + déboursé + MO + marge ──
engine.lots.iti.on = true;
engine.lots.iti.m = 25;
engine.lots.iti.tempsMoHeures = 8;
engine.lots.iti.tva = 5.5; // ★ champ sensible (a) — override TVA par lot
Object.assign(engine.lots.iti.o, {
  m2: 30,
  epa: "100",
  iso: "gr32",
  membrane: false,
  parement: "ba13_std",
});

// ── Lot Cloisons : déboursé + 1 ligne CUSTOM (sensible d) ──
engine.lots.cloisons.on = true;
engine.lots.cloisons.m = 30;
engine.lots.cloisons.tempsMoHeures = 12;
Object.assign(engine.lots.cloisons.o, {
  lignes: [
    { id: "seg_std", type: "std", oss: "m48", isolant: "non", peaux: "2", dbl: false, m2: 25 },
  ],
  chute: 5,
});
engine.lots.cloisons.custom.push({
  id: "custom-1",
  lbl: "Renfort métallique sur-mesure",
  unit: "u",
  qty: 3,
  p: 45,
}); // ★ champ sensible (d) — array de lignes manuelles

// ── Lot Démolition : points (sensible c) + coutRevientPoints saisi (b) ──
engine.lots.demolition.on = true;
engine.lots.demolition.coutRevientPoints = 800; // ★ champ sensible (b, saisi)
Object.assign(engine.lots.demolition.o, {
  points: {
    depose_cloison_placo: 20, // ★ champ sensible (c) — Record imbriqué
    depose_carrelage_sol: 8,
    depose_wc: 1,
    depose_lavabo: 1,
    evacuation_benne: 1,
  },
});

// ── Lot Élec : hybride + coutRevientPoints saisi ──
engine.lots.elec.on = true;
engine.lots.elec.m = 30;
engine.lots.elec.tempsMoHeures = 10;
engine.lots.elec.coutRevientPoints = 1800; // ★ (b, saisi)
Object.assign(engine.lots.elec.o, {
  tableau_rangees: 3,
  gtl: true,
  consuel: true,
  terre: true,
  vmc: "sf",
  points: {
    prise_simple_16a: 8,
    interrupteur_simple: 6,
    spot_led: 4,
  },
});

// ── Lot Plombs : ACTIF avec points MAIS coutRevientPoints UNDEFINED (b) ──
// C'est le cas le plus piégeux : on doit récupérer `undefined` après
// round-trip, PAS `null` (qui serait interprété comme "saisi à 0").
engine.lots.plombs.on = true;
// Champ legacy `q` (gammes supprimées juin 2026) injecté volontairement :
// normalize doit le PURGER silencieusement. Idem cp gammé : X_std → X
// (remappé), X_mid/X_prm tombent (orphelins).
(engine.lots.plombs as unknown as Record<string, unknown>).q = "mid";
engine.lots.plombs.cp = {
  wc_complet_std: 119, // → doit devenir cp.wc_complet = 119
  mitigeur_douche_prm: 999, // → doit tomber
  reseau_mc: 11, // clé non gammée → préservée telle quelle
};
// coutRevientPoints volontairement NON défini → ★ champ sensible (b, undefined)
Object.assign(engine.lots.plombs.o, {
  pts: { douche: 1, cuisine: 1, lavabo: 1, bain: 0 },
  wc_sol: 0,
  wc_susp: 1,
  reseau_type: "mc",
  douche_type: "receveur",
  ce: "ce_elec_150",
});

// ─── Construction du Devis complet (avec en-tête) ─────────────────────
// Mime exactement le shape stocké en localStorage / Postgres.
//
// On n'importe PAS repository.ts (qui suppose window.localStorage) ; on
// teste directement normalizeEngine — la fonction critique de migration
// silencieuse — et on compare le reste header par header.

import { normalizeEngine } from "./normalize";
import type { TauxTVA } from "../types";

const devisBefore = {
  id: "test-devis-1",
  numero: "DEV-2026-001",
  clientId: "client-1",
  clientSnapshot: {
    type: "particulier" as const,
    nom: "Dupont",
    prenom: "Jean",
    contact: "",
    email: "jean@example.com",
    telephone: "06 00 00 00 00",
    adresse: "1 rue de Test",
    codePostal: "75001",
    ville: "Paris",
    siren: "",
  },
  titre: "Rénovation appartement Paris 75001",
  statut: "brouillon" as const,
  dateCreation: "2026-05-28",
  dateValidite: "2026-06-27",
  globalSurf: 43,
  tvaParDefaut: 10,
  engine,
  lots: [],
  acomptePct: 30,
  lettreIntro: "Madame, Monsieur,",
  notesInternes: "Brouillon test round-trip P2",
  detailMatPose: false,
  remiseMode: "pourcent" as const,
  remiseValeur: 5,
  totalHT: 0,
  totalTVA: 0,
  totalTTC: 0,
  margeHT: 0,
  createdAt: "2026-05-28T10:00:00.000Z",
  updatedAt: "2026-05-28T10:00:00.000Z",
};

// ─── Round-trip : sérialise → désérialise → re-normalise ─────────────

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  SOCLE — ROUND-TRIP TEST P2");
console.log("  Couche données : EngineState ↔ JSON ↔ normalizeDevis");
console.log("══════════════════════════════════════════════════════════════════\n");

const serialized = JSON.stringify(devisBefore);
const parsed = JSON.parse(serialized) as typeof devisBefore;

// Reproduit fidèlement le passage par le repository : normalizeEngine ré-hydrate
// les lots avec les défauts du moteur (clés manquantes / nouveaux lots), tout
// le reste du Devis (header) est copié tel quel.
const devisAfter = {
  ...parsed,
  engine: normalizeEngine(parsed.engine, {
    globalSurf: parsed.globalSurf,
    tvaParDefaut: parsed.tvaParDefaut as TauxTVA,
    remiseMode: parsed.remiseMode,
    remiseValeur: parsed.remiseValeur,
  }),
};

// ─── (1) Préservation des 4 champs sensibles ─────────────────────────
console.log("  [1] Préservation des 4 CHAMPS SENSIBLES après round-trip");

// (a) lot.tva (override par lot)
console.log("\n    (a) lot.tva override par lot");
assertEqJSON(
  "iti.tva (override 5.5)",
  devisBefore.engine.lots.iti.tva,
  devisAfter.engine.lots.iti.tva
);
assert(
  devisAfter.engine.lots.iti.tva === 5.5,
  "iti.tva strictement === 5.5 (number, pas string)",
  `type: ${typeof devisAfter.engine.lots.iti.tva}`
);
assertEqJSON(
  "cloisons.tva (undefined, sans override)",
  devisBefore.engine.lots.cloisons.tva,
  devisAfter.engine.lots.cloisons.tva
);

// (b) lot.coutRevientPoints (undefined vs valeur)
console.log("\n    (b) lot.coutRevientPoints (undefined vs valeur — bug silencieux le plus dangereux)");
assertEqJSON(
  "demolition.coutRevientPoints (saisi à 800)",
  devisBefore.engine.lots.demolition.coutRevientPoints,
  devisAfter.engine.lots.demolition.coutRevientPoints
);
assertEqJSON(
  "elec.coutRevientPoints (saisi à 1800)",
  devisBefore.engine.lots.elec.coutRevientPoints,
  devisAfter.engine.lots.elec.coutRevientPoints
);
assert(
  devisAfter.engine.lots.plombs.coutRevientPoints === undefined,
  "plombs.coutRevientPoints reste === undefined (pas 0 ni null) après round-trip"
);
// Migration gammes : `q` purgé, cp gammé remappé (std → unique, mid/prm tombent).
assert(
  !("q" in (devisAfter.engine.lots.plombs as unknown as Record<string, unknown>)),
  "legacy q purgé par normalize (gammes supprimées)"
);
assertEqJSON(
  "cp plombs migré (wc_complet_std→wc_complet, prm tombe, reseau_mc préservé)",
  { wc_complet: 119, reseau_mc: 11 },
  devisAfter.engine.lots.plombs.cp
);
// Note : plombs n'est pas un lot à points (utilise BP+qualité, pas catalogue),
// donc n'apparaît jamais dans pointsLotsNonRenseignes. Le mini-scénario plus
// bas valide cette chaîne pour un VRAI lot à points (démolition).
const totsBefore = calcEngineTotaux(devisBefore.engine, TAUX_HORAIRE);
const totsAfter = calcEngineTotaux(devisAfter.engine, TAUX_HORAIRE);

// (c) lot.o.points (Record imbriqué)
console.log("\n    (c) lot.o.points : Record<prestationId, qty> imbriqué");
assertEqJSON(
  "demolition.o.points (5 postes)",
  devisBefore.engine.lots.demolition.o.points,
  devisAfter.engine.lots.demolition.o.points
);
assertEqJSON(
  "elec.o.points (3 postes)",
  devisBefore.engine.lots.elec.o.points,
  devisAfter.engine.lots.elec.o.points
);

// (d) lot.custom[] (array)
console.log("\n    (d) lot.custom[] : array de lignes manuelles");
assertEqJSON(
  "cloisons.custom (1 ligne renfort métallique)",
  devisBefore.engine.lots.cloisons.custom,
  devisAfter.engine.lots.cloisons.custom
);
assert(
  Array.isArray(devisAfter.engine.lots.cloisons.custom),
  "cloisons.custom reste Array.isArray(true) (pas un objet)"
);
assert(
  devisAfter.engine.lots.cloisons.custom.length === 1,
  "cloisons.custom contient bien 1 ligne"
);

// ─── (2) Préservation header complet ────────────────────────────────
console.log("\n  [2] En-tête du devis intégralement préservé");
for (const key of [
  "id", "numero", "titre", "statut", "dateCreation", "dateValidite",
  "globalSurf", "tvaParDefaut", "acomptePct", "lettreIntro", "notesInternes",
  "detailMatPose", "remiseMode", "remiseValeur",
] as const) {
  assertEqJSON(`header.${key}`, devisBefore[key], devisAfter[key]);
}
assertEqJSON("clientSnapshot", devisBefore.clientSnapshot, devisAfter.clientSnapshot);

// ─── (3) Tous les totaux DevisTotaux strictement égaux ──────────────
console.log("\n  [3] DevisTotaux strictement identiques avant/après round-trip");
const compareNum = (label: string, k: keyof DevisTotaux) =>
  assert(
    totsBefore[k] === totsAfter[k],
    `${label}.${String(k)}`,
    totsBefore[k] === totsAfter[k] ? "" : `avant ${totsBefore[k]} · après ${totsAfter[k]}`
  );

for (const k of [
  "subTotalHT", "remiseHT", "totalHT", "totalTVA", "totalTTC",
  "totalDeboursé", "totalMO", "totalMargeDeboursé",
  "totalCAPoints", "totalCoutRevientPointsSaisi", "totalMargePointsTracked",
  "margeGlobaleTracked",
] as const) {
  compareNum("totaux", k);
}
assertEqJSON("ventilationTVA{}", totsBefore.ventilationTVA, totsAfter.ventilationTVA);
assertEqJSON(
  "pointsLotsNonRenseignes[]",
  totsBefore.pointsLotsNonRenseignes,
  totsAfter.pointsLotsNonRenseignes
);
assert(
  totsBefore.tauxHoraireManquant === totsAfter.tauxHoraireManquant,
  "tauxHoraireManquant identique"
);

// ─── (4) Détail parLot[] strictement identique ──────────────────────
console.log("\n  [4] Détail par lot strictement identique");
assert(
  totsBefore.parLot.length === totsAfter.parLot.length,
  `parLot.length (${totsBefore.parLot.length} avant · ${totsAfter.parLot.length} après)`
);
for (let i = 0; i < totsBefore.parLot.length; i++) {
  const lb = totsBefore.parLot[i];
  const la = totsAfter.parLot[i];
  if (!lb.active && !la.active) continue;
  for (const k of [
    "deboursé", "MO", "margePct", "caDeboursé", "margeDeboursé",
    "caPoints", "caLot",
  ] as const) {
    assert(lb[k] === la[k], `parLot[${lb.lotId}].${String(k)}`,
      lb[k] === la[k] ? "" : `avant ${lb[k]} · après ${la[k]}`);
  }
  assertEqJSON(
    `parLot[${lb.lotId}].coutRevientPoints (vs null)`,
    lb.coutRevientPoints,
    la.coutRevientPoints
  );
  assertEqJSON(
    `parLot[${lb.lotId}].margePoints (vs null)`,
    lb.margePoints,
    la.margePoints
  );
}

// ─── (5) Mini-round-trip — démolition à points + coutRevientPoints undefined ──
// Le bug silencieux le plus dangereux serait que JSON.stringify omette
// la clé (correct), puis que normalizeEngine la remette à 0 — ce qui
// rendrait margePoints = caPoints (interprété comme 100% de marge). On
// vérifie que la chaîne complète préserve `undefined` et que le moteur
// signale bien le lot dans `pointsLotsNonRenseignes`.
console.log("\n  [5] Mini-round-trip : lot À POINTS avec coutRevientPoints undefined");
{
  const stateMini = createInitialEngineState({ globalSurf: 0, tvaParDefaut: 10 });
  stateMini.lots.demolition.on = true;
  // coutRevientPoints volontairement non set
  Object.assign(stateMini.lots.demolition.o, {
    points: { depose_wc: 2, evacuation_benne: 1 },
  });

  const ser = JSON.stringify(stateMini);
  // Vérification au passage : la clé coutRevientPoints n'est PAS dans le JSON.
  assert(
    !ser.includes("coutRevientPoints"),
    "JSON.stringify omet bien la clé coutRevientPoints (absente du blob)"
  );
  const parsedMini = JSON.parse(ser);
  const engineMini = normalizeEngine(parsedMini, {
    globalSurf: 0,
    tvaParDefaut: 10,
    remiseMode: "aucune",
    remiseValeur: 0,
  });
  assert(
    engineMini.lots.demolition.coutRevientPoints === undefined,
    "après round-trip : demolition.coutRevientPoints reste === undefined"
  );
  const totsMini = calcEngineTotaux(engineMini, 0);
  assert(
    totsMini.pointsLotsNonRenseignes.includes("demolition"),
    "demolition (avec points + coutRevientPoints undef) → pointsLotsNonRenseignes inclut 'demolition'"
  );
  const lotMini = totsMini.parLot.find((l) => l.lotId === "demolition");
  assert(
    lotMini?.margePoints === null,
    "demolition.margePoints === null (≠ caPoints, ≠ 0 — pas confondu avec marge 100%)"
  );
  const caPoints = lotMini?.caPoints || 0;
  assert(
    caPoints > 0,
    `démolition.caPoints > 0 (${caPoints.toFixed(2)} € — points bien sérialisés)`
  );
}

// ─── (6) Test additionnel — flag tauxHoraireManquant ────────────────
console.log("\n  [6] Flag tauxHoraireManquant (devis avec MO + entreprise sans taux)");
const totsZeroTaux = calcEngineTotaux(devisBefore.engine, 0);
assert(
  totsZeroTaux.tauxHoraireManquant === true,
  "tauxHoraire=0 + MO saisie sur 3 lots → tauxHoraireManquant === true"
);
assert(
  totsBefore.tauxHoraireManquant === false,
  "tauxHoraire=45 → tauxHoraireManquant === false"
);
const stateNoMo: EngineState = createInitialEngineState({
  globalSurf: 0,
  tvaParDefaut: 10,
});
stateNoMo.lots.demolition.on = true;
Object.assign(stateNoMo.lots.demolition.o, { points: { evacuation_benne: 1 } });
const totsNoMo = calcEngineTotaux(stateNoMo, 0);
assert(
  totsNoMo.tauxHoraireManquant === false,
  "tauxHoraire=0 mais 0 MO sur tous les lots → tauxHoraireManquant === false"
);

// ─── (7) Jalon 3 — lignes libres (lot prédéfini) + lots libres ──────
// Vérifie que le contenu libre (additif, prix ferme) : (a) survit au
// round-trip JSON → normalize, (b) s'ajoute au total CLIENT sans déplacer
// les chiffres du moteur des lots existants.
console.log("\n  [7] Lignes libres (lot prédéfini) + lots libres — additif & round-trip");
{
  const base = createInitialEngineState({ globalSurf: 30, tvaParDefaut: 10 });
  base.lots.cloisons.on = true;
  Object.assign(base.lots.cloisons.o, {
    lignes: [
      { id: "seg_std", type: "std", oss: "m48", isolant: "non", peaux: "2", dbl: false, m2: 20 },
    ],
    chute: 5,
  });

  // Référence AVANT contenu libre.
  const totsRef = calcEngineTotaux(base, TAUX_HORAIRE);
  const cliRef = calcClientTotaux(base, totsRef);
  const caCloisonsRef = totsRef.parLot.find((l) => l.lotId === "cloisons")!.caLot;

  // Ajout : 1 ligne libre sur cloisons (2 × 100 = 200 HT) + 1 lot libre (1 × 500 = 500 HT).
  base.lots.cloisons.lignesLibres = [
    { id: "lib_1", lbl: "Trappe de visite sur-mesure", qty: 2, unit: "u", pu: 100 },
  ];
  base.lotsLibres = [
    {
      id: "ll_1",
      titre: "Prestations diverses",
      lignes: [
        { id: "lib_2", lbl: "Nettoyage fin de chantier", qty: 1, unit: "forfait", pu: 500 },
      ],
    },
  ];

  const totsLibre = calcEngineTotaux(base, TAUX_HORAIRE);
  const cliLibre = calcClientTotaux(base, totsLibre);

  // (a) Moteur INCHANGÉ : les lignes libres ne touchent pas calcEngineTotaux.
  const caCloisonsLibre = totsLibre.parLot.find((l) => l.lotId === "cloisons")!.caLot;
  assert(
    caCloisonsLibre === caCloisonsRef,
    "cloisons.caLot (moteur) inchangé malgré lignes libres",
    caCloisonsLibre === caCloisonsRef ? "" : `avant ${caCloisonsRef} · après ${caCloisonsLibre}`
  );
  assert(
    totsLibre.subTotalHT === totsRef.subTotalHT,
    "moteur.subTotalHT inchangé (le contenu libre n'entre pas dans le moteur)"
  );

  // (b) CLIENT additif : +200 (ligne libre) +500 (lot libre) = +700 HT.
  const deltaHT = round2(cliLibre.subTotalHT - cliRef.subTotalHT);
  assert(
    deltaHT === 700,
    "clientTotaux.subTotalHT augmente de +700 € (200 ligne libre + 500 lot libre)",
    deltaHT === 700 ? "" : `delta ${deltaHT}`
  );
  assert(
    cliLibre.parLotClientHT.cloisons === round2(cliRef.parLotClientHT.cloisons + 200),
    "parLotClientHT.cloisons inclut la ligne libre (+200)",
    `${cliLibre.parLotClientHT.cloisons} vs ${round2(cliRef.parLotClientHT.cloisons + 200)}`
  );
  assert(
    cliLibre.parLotClientHT.ll_1 === 500,
    "parLotClientHT[lot libre] === 500"
  );

  // (c) Round-trip : lignesLibres + lotsLibres préservés tel quel.
  const ser = JSON.stringify(base);
  const parsedLibre = JSON.parse(ser);
  const after = normalizeEngine(parsedLibre, {
    globalSurf: 30,
    tvaParDefaut: 10,
    remiseMode: "aucune",
    remiseValeur: 0,
  });
  assertEqJSON(
    "cloisons.lignesLibres préservées après round-trip",
    base.lots.cloisons.lignesLibres,
    after.lots.cloisons.lignesLibres
  );
  assertEqJSON(
    "lotsLibres préservés après round-trip",
    base.lotsLibres,
    after.lotsLibres
  );

  // (d) Migration : un devis ANTÉRIEUR (sans lignesLibres ni lotsLibres) se
  // charge sans rien casser → champs défaut [], totaux identiques.
  const legacy = createInitialEngineState({ globalSurf: 30, tvaParDefaut: 10 });
  legacy.lots.cloisons.on = true;
  Object.assign(legacy.lots.cloisons.o, {
    lignes: [{ id: "seg_std", type: "std", oss: "m48", isolant: "non", peaux: "2", dbl: false, m2: 20 }],
    chute: 5,
  });
  const legacyRaw = JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>;
  // Simule un blob legacy : on retire les clés ajoutées au jalon 3.
  delete (legacyRaw as { lotsLibres?: unknown }).lotsLibres;
  for (const l of Object.values((legacyRaw as { lots: Record<string, Record<string, unknown>> }).lots)) {
    delete l.lignesLibres;
  }
  const migrated = normalizeEngine(legacyRaw, {
    globalSurf: 30, tvaParDefaut: 10, remiseMode: "aucune", remiseValeur: 0,
  });
  assert(
    Array.isArray(migrated.lotsLibres) && migrated.lotsLibres.length === 0,
    "devis legacy : lotsLibres absent → [] (défaut)"
  );
  assert(
    Array.isArray(migrated.lots.cloisons.lignesLibres) &&
      migrated.lots.cloisons.lignesLibres.length === 0,
    "devis legacy : lot.lignesLibres absent → [] (défaut)"
  );
  const totsMig = calcEngineTotaux(migrated, TAUX_HORAIRE);
  assert(
    totsMig.subTotalHT === totsRef.subTotalHT,
    "devis legacy migré : totaux moteur identiques (rien cassé)"
  );
}

// ─── (8) Faux-plafond — modèle segments : lignes réelles, round-trip, migration ──
// Vérifie que faux-plafond (passé au patron cloisons) : (a) produit de VRAIES
// lignes client (montant adossé à une prestation visible → fin du « montant
// sans corps »), (b) survit au round-trip, (c) migre proprement depuis l'ancien
// modèle (config unique → lignes vides + réglages lot préservés).
console.log("\n  [8] Faux-plafond (modèle segments) — lignes réelles & migration");
{
  const fp = createInitialEngineState({ globalSurf: 0, tvaParDefaut: 10 });
  fp.lots.fauxplafond.on = true;
  fp.lots.fauxplafond.m = 20;
  fp.lots.fauxplafond.tempsMoHeures = 4;
  fp.lots.fauxplafond.o = {
    lignes: [
      { id: "fpseg1", type: "std", isolant: "lv45", peaux: "1", m2: 20 },
    ],
    entraxe: "0.60",
    bandes: true,
    chute: 10,
  };

  const tots = calcEngineTotaux(fp, TAUX_HORAIRE);
  const ltFp = tots.parLot.find((l) => l.lotId === "fauxplafond")!;
  assert(ltFp.caLot > 0, "fauxplafond.caLot > 0 (segment produit un montant)", `caLot ${ltFp.caLot}`);
  assert(
    ltFp.items.length > 0 && ltFp.items.every((i) => i.groupId === "fpseg1"),
    "toutes les lignes moteur portent groupId = id du segment"
  );

  const cli = calcClientTotaux(fp, tots);
  // Le montant du lot est adossé à des LIGNES CLIENT visibles (pas un corps vide).
  assert(
    round2(cli.parLotClientHT.fauxplafond) === round2(ltFp.caLot),
    "HT client faux-plafond = caLot (1 prestation adossée au montant)",
    `${cli.parLotClientHT.fauxplafond} vs ${ltFp.caLot}`
  );

  // Round-trip : segments préservés, total identique.
  const after = normalizeEngine(JSON.parse(JSON.stringify(fp)), {
    globalSurf: 0, tvaParDefaut: 10, remiseMode: "aucune", remiseValeur: 0,
  });
  assertEqJSON(
    "fauxplafond.o.lignes préservées au round-trip",
    fp.lots.fauxplafond.o.lignes,
    after.lots.fauxplafond.o.lignes
  );
  const totsAfter = calcEngineTotaux(after, TAUX_HORAIRE);
  assert(
    totsAfter.parLot.find((l) => l.lotId === "fauxplafond")!.caLot === ltFp.caLot,
    "faux-plafond caLot identique après round-trip"
  );

  // Migration : ANCIEN modèle (config unique, sans surface dans o) → segments.
  const legacyFp = normalizeEngine(
    {
      lots: {
        fauxplafond: {
          on: true,
          o: {
            suspente: "res", plaque: "fp_ba13_std", peaux: "1",
            isolant: "fp_lv_45", avec_isolant: true, joints: true,
            entraxe: "0.50", chute: 8,
          },
        },
      },
    },
    { globalSurf: 0, tvaParDefaut: 10, remiseMode: "aucune", remiseValeur: 0 }
  );
  assert(
    Array.isArray(legacyFp.lots.fauxplafond.o.lignes) &&
      (legacyFp.lots.fauxplafond.o.lignes as unknown[]).length === 0,
    "ancien faux-plafond migré → o.lignes = [] (pas de montant orphelin)"
  );
  assert(
    legacyFp.lots.fauxplafond.o.entraxe === "0.50" &&
      legacyFp.lots.fauxplafond.o.bandes === true &&
      legacyFp.lots.fauxplafond.o.chute === 8,
    "migration faux-plafond : réglages lot (entraxe/bandes/chute) préservés"
  );
}

// ─── (9) ITI — modèle segments : lignes réelles, R affiché, migration ──
console.log("\n  [9] ITI (modèle segments) — lignes réelles, R indicatif, migration");
{
  const iti = createInitialEngineState({ globalSurf: 0, tvaParDefaut: 10 });
  iti.lots.iti.on = true;
  iti.lots.iti.m = 25;
  iti.lots.iti.tva = 5.5;
  iti.lots.iti.o = {
    lignes: [
      { id: "iseg1", type: "lr", epa: "200", membrane: true, parement: "ba13_std", m2: 25 },
    ],
    chute: 0,
  };

  const tots = calcEngineTotaux(iti, TAUX_HORAIRE);
  const ltIti = tots.parLot.find((l) => l.lotId === "iti")!;
  assert(ltIti.caLot > 0, "iti.caLot > 0 (segment produit un montant)", `caLot ${ltIti.caLot}`);
  assert(
    ltIti.items.length > 0 && ltIti.items.every((i) => i.groupId === "iseg1"),
    "toutes les lignes moteur portent groupId = id du segment"
  );
  // L'isolant est la ligne hl, et sa clé est iti_iso_lr_200.
  const hl = ltIti.items.find((i) => i.hl)!;
  assert(hl?.key === "iti_iso_lr_200", "ligne hl = isolant iti_iso_lr_200", `key ${hl?.key}`);

  const cli = calcClientTotaux(iti, tots);
  assert(
    round2(cli.parLotClientHT.iti) === round2(ltIti.caLot),
    "HT client ITI = caLot (1 prestation adossée au montant)",
    `${cli.parLotClientHT.iti} vs ${ltIti.caLot}`
  );

  // R affiché : LR 200 mm → 0,200 / 0,038 = 5,26 → arrondi 0,5 → "5,5", avec ≈.
  const lignesCli = agregerLignesClient(iti, ltIti)!;
  assert(
    lignesCli.length === 1 && /R ≈ 5,5 m².K\/W/.test(lignesCli[0].description),
    "description client porte le R indicatif « R ≈ 5,5 m².K/W »",
    lignesCli[0]?.description
  );
  assert(
    /Laine de roche/.test(lignesCli[0].libelleCommercial),
    "libellé commercial = famille (Laine de roche)"
  );

  // Round-trip : segments préservés, total identique.
  const after = normalizeEngine(JSON.parse(JSON.stringify(iti)), {
    globalSurf: 0, tvaParDefaut: 10, remiseMode: "aucune", remiseValeur: 0,
  });
  assertEqJSON(
    "iti.o.lignes préservées au round-trip",
    iti.lots.iti.o.lignes,
    after.lots.iti.o.lignes
  );
  assert(
    after.lots.iti.tva === 5.5,
    "iti.tva (override 5,5%) préservé"
  );

  // Migration : ANCIEN modèle ITI (config unique) → segments vides + chute.
  const legacyIti = normalizeEngine(
    {
      lots: {
        iti: {
          on: true,
          tva: 5.5,
          o: { m2: 30, epa: "100", iso: "gr32", membrane: false, parement: "ba13_std", chute: 4 },
        },
      },
    },
    { globalSurf: 0, tvaParDefaut: 10, remiseMode: "aucune", remiseValeur: 0 }
  );
  assert(
    Array.isArray(legacyIti.lots.iti.o.lignes) &&
      (legacyIti.lots.iti.o.lignes as unknown[]).length === 0,
    "ancien ITI migré → o.lignes = [] (pas de montant orphelin)"
  );
  assert(
    legacyIti.lots.iti.o.chute === 4 && legacyIti.lots.iti.tva === 5.5,
    "migration ITI : chute + override TVA préservés"
  );
}

// ─── Verdict ────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════");
if (failures === 0) {
  console.log("  ✅  ROUND-TRIP P2 OK — couche données fiable bout-en-bout");
} else {
  console.log(`  ❌  ${failures} assertion(s) en échec`);
}
console.log("══════════════════════════════════════════════════════════════════\n");

process.exit(failures === 0 ? 0 : 1);
