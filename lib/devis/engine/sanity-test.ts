// ============================================================
// SOCLE — Moteur Devis — Sanity Test global (turn 2)
//
// Valide bout-en-bout les 6 invariants du moteur :
//   1. MARGE OPTION A — formule (mat + MO) × (1 + m%) appliquée correctement
//   2. POINTS PRIX FERME — aucune marge ni MO ajoutée aux points
//   3. LOT HYBRIDE ÉLEC — caLot = caDeboursé + caPoints
//   4. coutRevientPoints — null si non saisi ("non renseignée"), pas 100%
//   5. VENTILATION TVA — par taux, après remise, proportionnelle
//   6. REMISE GLOBALE — % et €, cap au sous-total HT
//
// Scénario : appartement 43m², 5 lots actifs, taux horaire 45€/h, remise 5%.
//
// Lancer : npx tsx lib/devis/engine/sanity-test.ts
// ============================================================

import {
  calcEngineTotaux,
  calcLotTotaux,
  round2,
  type DevisTotaux,
  type LotTotaux,
} from "./totals";
import { createInitialEngineState } from "./lots";
import type { EngineState, LotId } from "./types";

// ─── Helpers d'affichage ────────────────────────────────────────────

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const pct = (n: number) => n.toFixed(2) + " %";

let failures = 0;
function expect(label: string, expected: number, actual: number, tol: number = 0.05) {
  const ok = Math.abs(expected - actual) <= tol;
  const flag = ok ? "✓" : "❌";
  console.log(`    ${flag} ${label}   attendu ${eur(expected)} · calculé ${eur(actual)}`);
  if (!ok) failures++;
}
function expectExact(label: string, expected: unknown, actual: unknown) {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  const flag = ok ? "✓" : "❌";
  console.log(`    ${flag} ${label}   attendu ${JSON.stringify(expected)} · calculé ${JSON.stringify(actual)}`);
  if (!ok) failures++;
}

// ─── Construction du scénario ───────────────────────────────────────

const TAUX_HORAIRE = 45; // €/h
const state: EngineState = createInitialEngineState({
  globalSurf: 43,
  tvaParDefaut: 10,
  remiseMode: "pourcent",
  remiseValeur: 5,
});

// LOT 1 — DÉMOLITION (100% points, prix ferme)
state.lots.demolition.on = true;
state.lots.demolition.coutRevientPoints = 800;
Object.assign(state.lots.demolition.o, {
  points: {
    depose_cloison_placo: 20, // 20 × 22 = 440
    depose_carrelage_sol: 8, // 8 × 28 = 224
    depose_wc: 1, // 65
    depose_lavabo: 1, // 45
    evacuation_benne: 1, // 320
  },
});

// LOT 2 — CLOISONS (consommable, déboursé)
state.lots.cloisons.on = true;
state.lots.cloisons.m = 30;
state.lots.cloisons.tempsMoHeures = 12;
Object.assign(state.lots.cloisons.o, {
  std_on: true,
  std_m2: 25,
  std_oss: "m48",
  std_peaux: "2",
  std_acou: "non",
  chute: 5,
});

// LOT 3 — ITI (consommable, déboursé, TVA 5,5% rénovation énergétique)
state.lots.iti.on = true;
state.lots.iti.m = 25;
state.lots.iti.tempsMoHeures = 8;
state.lots.iti.tva = 5.5; // OVERRIDE TVA réduite
Object.assign(state.lots.iti.o, {
  m2: 30,
  epa: "100",
  iso: "gr32",
  membrane: false,
  parement: "ba13_std",
});

// LOT 4 — CARRELAGE (produit-fini, déboursé)
state.lots.carrelage.on = true;
state.lots.carrelage.m = 35;
state.lots.carrelage.tempsMoHeures = 6;
Object.assign(state.lots.carrelage.o, {
  z1_on: true,
  z1_m2: 8,
  z1_type: "gres_cerame",
  z1_peigne: "b10",
  z1_chute: 12,
});

// LOT 5 — ÉLEC HYBRIDE (infrastructure déboursé + points prix ferme)
state.lots.elec.on = true;
state.lots.elec.m = 30;
state.lots.elec.tempsMoHeures = 10;
state.lots.elec.coutRevientPoints = 1800;
Object.assign(state.lots.elec.o, {
  tableau_rangees: 3,
  gtl: true,
  consuel: true,
  terre: true,
  vmc: "sf",
  points: {
    prise_simple_16a: 8, // 8 × 126.70 = 1013.60
    interrupteur_simple: 6, // 6 × 127.35 = 764.10
    spot_led: 4, // 4 × 73.89 = 295.56
  },
});

// ─── Calcul ──────────────────────────────────────────────────────────

const T = calcEngineTotaux(state, TAUX_HORAIRE);
const byId: Record<LotId, LotTotaux> = Object.fromEntries(
  T.parLot.map((l) => [l.lotId, l])
) as Record<LotId, LotTotaux>;

// ─── Affichage détaillé ──────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  SOCLE — SANITY TEST MOTEUR DEVIS");
console.log("  Scénario : appartement 43m² · taux horaire 45€/h · remise 5%");
console.log("══════════════════════════════════════════════════════════════════\n");

function dumpLot(l: LotTotaux, opts: { hideMarge?: boolean } = {}) {
  if (!l.active) return;
  console.log(`  ── ${l.lotId.toUpperCase().padEnd(12)} ─────────────────────────────────────`);
  console.log(`     items                : ${l.items.length}`);
  if (l.deboursé > 0 || l.MO > 0) {
    console.log(`     matériaux déboursé   : ${eur(l.deboursé)}`);
    console.log(`     MO (${(l.MO / TAUX_HORAIRE).toFixed(1)}h × ${TAUX_HORAIRE}€/h)   : ${eur(l.MO)}`);
    if (!opts.hideMarge) {
      console.log(`     marge ${pct(l.margePct).padEnd(8)}        : ${eur(l.margeDeboursé)}  ← (mat+MO) × (1+m%) − (mat+MO)`);
    }
    console.log(`     → ca déboursé        : ${eur(l.caDeboursé)}`);
  }
  if (l.hasPoints) {
    console.log(`     ca points prix ferme : ${eur(l.caPoints)}  ← prixEstFinal=true, NI marge NI MO`);
    if (l.coutRevientPoints !== null) {
      console.log(`     coût revient points  : ${eur(l.coutRevientPoints)}  (saisi)`);
      console.log(`     marge points         : ${eur(l.margePoints || 0)}  (interne, hors moteur)`);
    } else {
      console.log(`     coût revient points  : NON SAISI`);
      console.log(`     marge points         : non renseignée`);
    }
  }
  console.log(`     ────`);
  console.log(`     TOTAL LOT (caLot)    : ${eur(l.caLot)}\n`);
}

for (const lid of ["demolition", "cloisons", "iti", "carrelage", "elec"] as const) {
  dumpLot(byId[lid]);
}

console.log("══════════════════════════════════════════════════════════════════");
console.log("  TOTAUX GLOBAUX");
console.log("══════════════════════════════════════════════════════════════════");
console.log(`     Sous-total HT        : ${eur(T.subTotalHT)}`);
console.log(`     Remise (${state.remiseMode === "pourcent" ? state.remiseValeur + " %" : eur(state.remiseValeur)}) : −${eur(T.remiseHT)}`);
console.log(`     TOTAL HT             : ${eur(T.totalHT)}`);
console.log(`     Ventilation TVA après remise :`);
for (const [taux, montant] of Object.entries(T.ventilationTVA).sort()) {
  console.log(`        TVA ${taux} %         : ${eur(montant)}`);
}
console.log(`     Total TVA            : ${eur(T.totalTVA)}`);
console.log(`     TOTAL TTC            : ${eur(T.totalTTC)}\n`);

console.log("══════════════════════════════════════════════════════════════════");
console.log("  RÉCAP INTERNE ARTISAN (marge à déboursé vs marge points)");
console.log("══════════════════════════════════════════════════════════════════");
console.log(`     Total déboursé matériau   : ${eur(T.totalDeboursé)}`);
console.log(`     Total MO                  : ${eur(T.totalMO)}`);
console.log(`     Marge sur déboursé        : ${eur(T.totalMargeDeboursé)}`);
console.log(`     CA points prix ferme      : ${eur(T.totalCAPoints)} ← sans marge moteur`);
console.log(`     Coût revient points saisi : ${eur(T.totalCoutRevientPointsSaisi)}`);
console.log(`     Marge points trackée      : ${eur(T.totalMargePointsTracked)}`);
console.log(`     MARGE GLOBALE TRACKÉE     : ${eur(T.margeGlobaleTracked)}`);
if (T.pointsLotsNonRenseignes.length > 0) {
  console.log(`     ⚠  Lots à points sans coutRevientPoints : ${T.pointsLotsNonRenseignes.join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════════
//   VALIDATIONS — 6 INVARIANTS
// ═══════════════════════════════════════════════════════════════════

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  VALIDATIONS");
console.log("══════════════════════════════════════════════════════════════════");

// ─── 1. MARGE OPTION A — exemple chiffré sur cloisons ──────────────
console.log("\n  [1] MARGE OPTION A — exemple chiffré sur lot Cloisons");
{
  const c = byId.cloisons;
  // Détail calcul attendu :
  //   matériaux déboursé = 422.25 € (porté de ChiffReno)
  //   MO = 12h × 45 = 540 €
  //   (mat + MO) = 962.25 €
  //   × (1 + 30%) = 1 251.93 €  (round2)
  //   margeDeboursé = 1 251.93 − 962.25 = 289.68 €
  const expectedDeboursé = 422.25;
  const expectedMO = 540;
  const expectedCA = round2((expectedDeboursé + expectedMO) * 1.3);
  const expectedMarge = round2(expectedCA - expectedDeboursé - expectedMO);
  console.log(`      Formule : (matériaux ${eur(expectedDeboursé)} + MO ${eur(expectedMO)}) × (1 + 30%)`);
  console.log(`              = ${eur(expectedDeboursé + expectedMO)} × 1.30 = ${eur(expectedCA)}`);
  console.log(`      Marge attendue : ${eur(expectedCA)} − ${eur(expectedDeboursé + expectedMO)} = ${eur(expectedMarge)}`);
  expect("déboursé matériaux", expectedDeboursé, c.deboursé, 0.01);
  expect("MO calculée       ", expectedMO, c.MO, 0.01);
  expect("ca déboursé       ", expectedCA, c.caDeboursé, 0.01);
  expect("margeDeboursé     ", expectedMarge, c.margeDeboursé, 0.02);
}

// ─── 2. POINTS PRIX FERME — pas de marge ni MO ─────────────────────
console.log("\n  [2] POINTS PRIX FERME — élec : CA points = somme brute catalogue × qty");
{
  const e = byId.elec;
  // Attendu : 8×126.70 + 6×127.35 + 4×73.89
  const expectedPoints = 8 * 126.7 + 6 * 127.35 + 4 * 73.89;
  console.log(`      8 prises × 126,70 + 6 interrupteurs × 127,35 + 4 spots × 73,89 = ${eur(expectedPoints)}`);
  console.log(`      Aucune marge ni MO ajoutée → CA points doit être strictement = somme brute.`);
  expect("CA points élec    ", expectedPoints, e.caPoints, 0.01);
  // Vérif annexe : chaque ligne points a prixEstFinal=true et pas de transformation
  const pointsLines = e.items.filter((i) => i.prixEstFinal);
  const allMonolitic = pointsLines.every((i) => i.total === i.qty * i.p);
  console.log(`      ${allMonolitic ? "✓" : "❌"} Toutes les lignes points sont prixEstFinal=true et item.total = qty × p (pas de transformation)`);
  if (!allMonolitic) failures++;
}

// ─── 3. LOT HYBRIDE ÉLEC — caLot = caDeboursé + caPoints ───────────
console.log("\n  [3] LOT HYBRIDE ÉLEC — décomposition correcte infra (avec marge) + points (brut)");
{
  const e = byId.elec;
  // Infra déboursé : tableau_3r 480 + gtl 150 + consuel 195 + terre 320 + vmc_sf 450 = 1595
  // MO : 10 × 45 = 450
  // ca infra : (1595 + 450) × 1.30 = 2658.50
  // Points : 2073.26
  const expectedInfraDeboursé = 1595;
  const expectedMO = 450;
  const expectedCAInfra = round2((expectedInfraDeboursé + expectedMO) * 1.3);
  const expectedCAPoints = round2(8 * 126.7 + 6 * 127.35 + 4 * 73.89);
  const expectedCALot = round2(expectedCAInfra + expectedCAPoints);
  console.log(`      Infra déboursé ${eur(expectedInfraDeboursé)} + MO ${eur(expectedMO)} → caDeboursé = ${eur(expectedCAInfra)}`);
  console.log(`      Points prix ferme (brut)                    → caPoints   = ${eur(expectedCAPoints)}`);
  console.log(`      caLot = caDeboursé + caPoints                = ${eur(expectedCALot)}`);
  expect("infra déboursé    ", expectedInfraDeboursé, e.deboursé, 0.01);
  expect("MO infra          ", expectedMO, e.MO, 0.01);
  expect("caDeboursé infra  ", expectedCAInfra, e.caDeboursé, 0.01);
  expect("caPoints          ", expectedCAPoints, e.caPoints, 0.01);
  expect("caLot total       ", expectedCALot, e.caLot, 0.02);
}

// ─── 4. coutRevientPoints — null vs valeur ──────────────────────────
console.log("\n  [4] coutRevientPoints — null si non saisi, marge calculée si saisi");
{
  const d = byId.demolition;
  const e = byId.elec;
  // Démolition : coutRevientPoints saisi = 800. CA points = 1094. Marge attendue = 294
  const expectedMargeDemo = round2(d.caPoints - 800);
  console.log(`      Démolition  : coutRevientPoints saisi = 800 €, CA points = ${eur(d.caPoints)}`);
  console.log(`                    → margePoints = ${eur(d.caPoints)} − 800 = ${eur(expectedMargeDemo)}`);
  expectExact("coutRevientPoints démo", 800, d.coutRevientPoints);
  expect("margePoints démo  ", expectedMargeDemo, d.margePoints || 0, 0.01);
  // Élec : saisi = 1800. CA points = 2073.26. Marge attendue = 273.26
  const expectedMargeElec = round2(e.caPoints - 1800);
  console.log(`      Élec        : coutRevientPoints saisi = 1800 €, CA points = ${eur(e.caPoints)}`);
  console.log(`                    → margePoints = ${eur(e.caPoints)} − 1800 = ${eur(expectedMargeElec)}`);
  expect("margePoints élec  ", expectedMargeElec, e.margePoints || 0, 0.01);

  // Cas non saisi : on construit un mini-state avec démolition sans coutRevientPoints
  const stateNoCRP = createInitialEngineState({ globalSurf: 43, tvaParDefaut: 10 });
  stateNoCRP.lots.demolition.on = true;
  Object.assign(stateNoCRP.lots.demolition.o, {
    points: { depose_cloison_placo: 20, evacuation_benne: 1 },
  });
  // coutRevientPoints non défini (laissé undefined)
  const lotNoCRP = calcLotTotaux(stateNoCRP, "demolition", TAUX_HORAIRE);
  console.log(`      Cas non saisi : coutRevientPoints undefined → margePoints doit être null (≠ 100%)`);
  expectExact("coutRevientPoints brut", null, lotNoCRP.coutRevientPoints);
  expectExact("margePoints non rens. ", null, lotNoCRP.margePoints);
  const totalsNoCRP = calcEngineTotaux(stateNoCRP, TAUX_HORAIRE);
  console.log(`      → pointsLotsNonRenseignes du devis : ${JSON.stringify(totalsNoCRP.pointsLotsNonRenseignes)}`);
  expectExact("pointsLotsNonRenseignes", ["demolition"], totalsNoCRP.pointsLotsNonRenseignes);
}

// ─── 5. VENTILATION TVA — taux mixte, après remise ──────────────────
console.log("\n  [5] VENTILATION TVA — mixte (ITI 5,5% rénovation énergétique, reste 10%)");
{
  // Calcul attendu :
  //   subTotalHT = somme caLot des 5 lots
  //   remiseHT = subTotalHT × 5%
  //   totalHT = subTotalHT - remiseHT
  //   ratio = totalHT / subTotalHT (≈ 0.95)
  //   TVA 5.5 = caLot(ITI) × ratio × 5.5%
  //   TVA 10  = (subTotalHT − caLot(ITI)) × ratio × 10%
  const caITI = byId.iti.caLot;
  const caRest = T.subTotalHT - caITI;
  const ratio = T.totalHT / T.subTotalHT;
  const expectedTVA55 = round2(caITI * ratio * 0.055);
  const expectedTVA10 = round2(caRest * ratio * 0.1);
  console.log(`      Sous-total HT : ${eur(T.subTotalHT)}`);
  console.log(`      Remise 5%     : ${eur(T.remiseHT)}`);
  console.log(`      ratio remise  : ${ratio.toFixed(6)}  (= ${eur(T.totalHT)} / ${eur(T.subTotalHT)})`);
  console.log(`      Base 5,5% (ITI seul)    : ${eur(caITI)}`);
  console.log(`      Base 10% (autres lots)  : ${eur(caRest)}`);
  console.log(`      TVA 5,5% = ${eur(caITI)} × ${ratio.toFixed(4)} × 0.055 = ${eur(expectedTVA55)}`);
  console.log(`      TVA 10%  = ${eur(caRest)} × ${ratio.toFixed(4)} × 0.10  = ${eur(expectedTVA10)}`);
  expect("TVA 5,5%          ", expectedTVA55, T.ventilationTVA[5.5] || 0, 0.10);
  expect("TVA 10%           ", expectedTVA10, T.ventilationTVA[10] || 0, 0.10);
  expect("Total TVA         ", expectedTVA55 + expectedTVA10, T.totalTVA, 0.10);
  // TVA appliquée APRÈS remise (sinon serait ITI × 0.055 + autres × 0.10 sans ratio)
  const tvaSansRemise = round2(caITI * 0.055) + round2(caRest * 0.1);
  console.log(`      (Si remise ignorée : TVA serait ${eur(tvaSansRemise)} — moteur trouve ${eur(T.totalTVA)} → remise bien prise en compte ✓)`);
}

// ─── 6. REMISE GLOBALE — 2 modes + cap ──────────────────────────────
console.log("\n  [6] REMISE GLOBALE — modes pourcent / euros / cap");
{
  // Test mode 'pourcent' : déjà validé ci-dessus (5% sur subTotal)
  console.log(`      Mode 'pourcent' 5%  → remise ${eur(T.remiseHT)} (validé ci-dessus)`);

  // Test mode 'euros'
  const stateE = createInitialEngineState({
    globalSurf: 43,
    tvaParDefaut: 10,
    remiseMode: "euros",
    remiseValeur: 500,
  });
  stateE.lots.cloisons.on = true;
  stateE.lots.cloisons.m = 30;
  stateE.lots.cloisons.tempsMoHeures = 12;
  Object.assign(stateE.lots.cloisons.o, {
    std_on: true,
    std_m2: 25,
    std_oss: "m48",
    std_peaux: "2",
    std_acou: "non",
    chute: 5,
  });
  const TE = calcEngineTotaux(stateE, TAUX_HORAIRE);
  console.log(`      Mode 'euros' 500 € sur subTotal ${eur(TE.subTotalHT)} → remise ${eur(TE.remiseHT)}, totalHT ${eur(TE.totalHT)}`);
  expect("remise euros      ", 500, TE.remiseHT, 0.01);
  expect("totalHT après €   ", TE.subTotalHT - 500, TE.totalHT, 0.01);

  // Test cap : remise euros > subTotal doit être capée
  const stateCap = createInitialEngineState({
    globalSurf: 43,
    tvaParDefaut: 10,
    remiseMode: "euros",
    remiseValeur: 99999,
  });
  stateCap.lots.cloisons.on = true;
  Object.assign(stateCap.lots.cloisons.o, {
    std_on: true,
    std_m2: 25,
    std_oss: "m48",
    std_peaux: "2",
    std_acou: "non",
    chute: 5,
  });
  const TCap = calcEngineTotaux(stateCap, 0);
  console.log(`      Cap (remise 99 999 € sur subTotal ${eur(TCap.subTotalHT)})`);
  console.log(`      → remise capée à ${eur(TCap.remiseHT)} = ${eur(TCap.subTotalHT)}, totalHT = ${eur(TCap.totalHT)} (≥ 0)`);
  expect("remise capée      ", TCap.subTotalHT, TCap.remiseHT, 0.01);
  expect("totalHT ≥ 0       ", 0, TCap.totalHT, 0.01);

  // Test cap mode pourcent > 100%
  const stateCap2 = createInitialEngineState({
    globalSurf: 43,
    tvaParDefaut: 10,
    remiseMode: "pourcent",
    remiseValeur: 150,
  });
  stateCap2.lots.cloisons.on = true;
  Object.assign(stateCap2.lots.cloisons.o, {
    std_on: true,
    std_m2: 25,
    std_oss: "m48",
    std_peaux: "2",
    std_acou: "non",
    chute: 5,
  });
  const TCap2 = calcEngineTotaux(stateCap2, 0);
  console.log(`      Cap pourcent 150% → remise ${eur(TCap2.remiseHT)} (= subTotal), totalHT ${eur(TCap2.totalHT)}`);
  expect("cap pourcent      ", TCap2.subTotalHT, TCap2.remiseHT, 0.01);
}

// ═══════════════════════════════════════════════════════════════════
//   VERDICT
// ═══════════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════════════════════════════");
if (failures === 0) {
  console.log("  ✅  TOUTES LES VALIDATIONS PASSENT — moteur cohérent bout-en-bout");
} else {
  console.log(`  ❌  ${failures} validation(s) en échec`);
}
console.log("══════════════════════════════════════════════════════════════════\n");

process.exit(failures === 0 ? 0 : 1);
