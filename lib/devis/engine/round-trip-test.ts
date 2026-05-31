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

import { calcEngineTotaux, type DevisTotaux } from "./totals";
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
engine.lots.plombs.q = "mid";
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

// ─── Verdict ────────────────────────────────────────────────────────
console.log("\n══════════════════════════════════════════════════════════════════");
if (failures === 0) {
  console.log("  ✅  ROUND-TRIP P2 OK — couche données fiable bout-en-bout");
} else {
  console.log(`  ❌  ${failures} assertion(s) en échec`);
}
console.log("══════════════════════════════════════════════════════════════════\n");

process.exit(failures === 0 ? 0 : 1);
