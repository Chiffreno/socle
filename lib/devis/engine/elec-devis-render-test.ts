// ============================================================
// SOCLE — Garde-test : chaîne UI → liste devis pour un lot À POINTS (élec)
//
// Couvre LE maillon qu'aucun seed ne couvrait (bug C2) : la liste devis affiche
// `entry.lignes = agregerLignesClient(synced, lt)`. Gate de rendu :
// `hasAggregateur(lotId) && !isSegmentLot` → lecture seule.
//
// Format C-split (post-refonte) : UNE ligne par appareillage (plus 1/catégorie),
// groupées par catégorie (eyebrow), chaque ligne avec décompo client
// Fourniture/Pose. Mode forfait supprimé. Le test prouve, pour un état élec :
//   1. hasAggregateur("elec") === true ;
//   2. entry.lignes non vide, 1 ligne par prestation (qty>0) ;
//   3. eyebrow catégorie correct ; F/P par ligne (fourniture+pose==total) ;
//   4. infra tableau/GTL décomposés, réseau NON (ligne simple) ;
//   5. Σ entry.lignes == HT lot au centime.
//
// Lancer : npx tsx lib/devis/engine/elec-devis-render-test.ts
// ============================================================

import { createInitialEngineState } from "./lots";
import { calcEngineTotaux, round2 } from "./totals";
import {
  agregerLignesClient,
  calcClientTotaux,
  hasAggregateur,
} from "./agregation";
import type { EngineState } from "./types";

let failures = 0;
function assert(cond: boolean, label: string, detail?: string) {
  console.log(`    ${cond ? "✓" : "❌"} ${label}${detail ? `   ${detail}` : ""}`);
  if (!cond) failures++;
}

console.log("\n══════════════════════════════════════════════════════════════════");
console.log("  SOCLE — GARDE-TEST : chaîne UI → liste devis (élec, C-split)");
console.log("══════════════════════════════════════════════════════════════════\n");

const base = createInitialEngineState({
  globalSurf: 50,
  tvaParDefaut: 10,
  remiseMode: "aucune",
  remiseValeur: 0,
});
base.lots.elec = {
  ...base.lots.elec,
  on: true,
  m: 30,
  tempsMoHeures: 0,
  o: {
    tableau_rangees: 2,
    gtl: true,
    reseau_mode: "m2", // 50 m² × 20 €/m² (défaut) = 1000 déboursé
    points: {
      prise_simple_16a: 12, // prises
      prise_rj45: 3, // prises
      va_et_vient: 2, // commandes
      spot_led: 6, // éclairage
    },
  },
};

const totaux = calcEngineTotaux(base, 45);
const synced: EngineState = { ...base };
const lt = totaux.parLot.find((l) => l.lotId === "elec")!;
const L = agregerLignesClient(synced, lt);

console.log("  [1] Gate lecture seule satisfait");
assert(hasAggregateur("elec") === true, 'hasAggregateur("elec") === true');

console.log("\n  [2] entry.lignes : UNE ligne par appareillage (plus 1/catégorie)");
assert(L !== null && L.length > 0, "entry.lignes non vide", `${L?.length} ligne(s)`);
const pc = L?.find((l) => l.libelleCommercial.includes("PC simple 16 A"));
const rj45 = L?.find((l) => l.libelleCommercial.includes("RJ45"));
const vav = L?.find((l) => l.libelleCommercial.includes("va-et-vient"));
const spot = L?.find((l) => l.libelleCommercial.includes("spot LED"));
assert(pc?.qty === 12, "ligne PC simple 16 A, qty 12", `qty=${pc?.qty}`);
assert(rj45?.qty === 3, "ligne RJ45 SÉPARÉE, qty 3", `qty=${rj45?.qty}`);
assert(vav?.qty === 2, "ligne va-et-vient, qty 2", `qty=${vav?.qty}`);
assert(spot?.qty === 6, "ligne spot LED, qty 6", `qty=${spot?.qty}`);

console.log("\n  [3] Eyebrow catégorie par ligne");
assert(
  pc?.categorie === "Prises et sorties de câble",
  "PC simple → « Prises et sorties de câble »",
  pc?.categorie
);
assert(vav?.categorie === "Commandes", "va-et-vient → « Commandes »", vav?.categorie);
assert(
  spot?.categorie === "Points lumineux et éclairage",
  "spot LED → « Points lumineux et éclairage »",
  spot?.categorie
);

console.log("\n  [4] Décomposition Fourniture / Pose par ligne (info client)");
const fpOk = (lc: typeof pc, pct: number) =>
  lc?.fournitureClient !== undefined &&
  lc?.poseClient !== undefined &&
  Math.round((lc.fournitureClient + lc.poseClient) * 100) ===
    Math.round(lc.prixClient * 100) &&
  Math.round(lc.fournitureClient * 100) ===
    Math.round(round2((lc.prixClient * pct) / 100) * 100);
assert(fpOk(pc, 35), "PC simple : F=35 % du total, F+P=total", `F=${pc?.fournitureClient} P=${pc?.poseClient} T=${pc?.prixClient}`);
assert(fpOk(spot, 45), "spot LED : F=45 % du total, F+P=total", `F=${spot?.fournitureClient} P=${spot?.poseClient} T=${spot?.prixClient}`);

console.log("\n  [5] Infra : tableau/GTL décomposés, réseau NON (ligne simple)");
const tableau = L?.find((l) => l.libelleCommercial.includes("Tableau électrique"));
const reseau = L?.find((l) => l.libelleCommercial.includes("réseau électrique"));
assert(
  tableau?.categorie === "Tableau et infrastructure",
  "tableau eyebrow « Tableau et infrastructure »",
  tableau?.categorie
);
assert(fpOk(tableau, 60), "tableau décomposé F=60 %", `F=${tableau?.fournitureClient}`);
assert(
  reseau !== undefined && reseau.fournitureClient === undefined,
  "réseau = ligne SIMPLE (pas de décompo F/P)"
);
const gtl = L?.find((l) => l.libelleCommercial.includes("GTL"));
assert(
  gtl?.overrideKey === "elec_gtl",
  "infra GTL ÉDITABLE (overrideKey = elec_gtl)",
  gtl?.overrideKey
);
assert(
  tableau?.overrideKey === "elec_tableau_2r",
  "infra tableau ÉDITABLE (overrideKey = elec_tableau_2r)",
  tableau?.overrideKey
);
assert(gtl?.overridden === false, "GTL non overridé par défaut");

console.log("\n  [6] Σ entry.lignes == HT lot (totals.ts), au centime");
const somme = round2((L ?? []).reduce((a, l) => a + l.prixClient, 0));
assert(
  Math.round(somme * 100) === Math.round(lt.caLot * 100),
  "Σ lignes client = caLot",
  `${somme.toFixed(2)} € == ${lt.caLot.toFixed(2)} €`
);

console.log("\n  [7] Contrat : démolition (lot à points) SANS agrégateur (gap connu)");
assert(hasAggregateur("demolition") === false, 'hasAggregateur("demolition") === false');

console.log(
  "\n  [8] Override INFRA (prix + libellé) : seule la ligne ciblée bouge, Σ == HT client"
);
const gtlNatural = round2(gtl!.prixClient);
const tableauNatural = round2(tableau!.prixClient);
const reseauNatural = round2(reseau!.prixClient);
// Override prix GTL → 250 € + libellé VMC (lot sans VMC ici → on cible le tableau).
const ov: EngineState = {
  ...base,
  lots: {
    ...base.lots,
    elec: {
      ...base.lots.elec,
      o: {
        ...base.lots.elec.o,
        pointsOverride: {
          elec_gtl: { pu: 250 },
          elec_tableau_2r: { lbl: "Tableau électrique sur mesure" },
        },
      },
    },
  },
};
const totauxOv = calcEngineTotaux(ov, 45);
const ltOv = totauxOv.parLot.find((l) => l.lotId === "elec")!;
const Lov = agregerLignesClient(ov, ltOv)!;
const gtlOv = Lov.find((l) => l.overrideKey === "elec_gtl");
const tableauOv = Lov.find((l) => l.overrideKey === "elec_tableau_2r");
const reseauOv = Lov.find((l) => l.libelleCommercial.includes("réseau électrique"));

assert(gtlOv?.prixClient === 250, "GTL forcé à 250 €", `${gtlOv?.prixClient}`);
assert(gtlOv?.overridden === true, "GTL marqué overridé");
assert(
  tableauOv?.libelleCommercial === "Tableau électrique sur mesure",
  "libellé tableau modifié",
  tableauOv?.libelleCommercial
);
assert(
  tableauOv?.prixClient === tableauNatural,
  "tableau (libellé seul) : prix INCHANGÉ",
  `${tableauOv?.prixClient} == ${tableauNatural}`
);
assert(
  reseauOv?.prixClient === reseauNatural,
  "réseau NON ciblé : prix INCHANGÉ (zéro redistribution MO)",
  `${reseauOv?.prixClient} == ${reseauNatural}`
);

console.log(
  "\n  [9] Override actif : Σ lignes == HT CLIENT (calcClientTotaux, PAS lt.caLot)"
);
const clientOv = calcClientTotaux(ov, totauxOv);
const sommeOv = round2(Lov.reduce((a, l) => a + l.prixClient, 0));
assert(clientOv.hasOverride === true, "calcClientTotaux : hasOverride === true");
assert(
  Math.round(sommeOv * 100) === Math.round(clientOv.parLotClientHT.elec * 100),
  "Σ lignes client = HT client lot",
  `${sommeOv.toFixed(2)} € == ${clientOv.parLotClientHT.elec.toFixed(2)} €`
);
assert(
  Math.round((sommeOv - somme) * 100) === Math.round((250 - gtlNatural) * 100),
  "Δ HT = (250 − GTL naturel), aucune autre ligne ne bouge",
  `Δ=${round2(sommeOv - somme)} attendu=${round2(250 - gtlNatural)}`
);

console.log("\n  [10] Reset : devis SANS override infra → totaux moteur inchangés");
const clientBase = calcClientTotaux(base, totaux);
assert(
  clientBase.hasOverride === false,
  "sans override infra : hasOverride === false (fast-path)"
);
assert(
  Math.round(clientBase.parLotClientHT.elec * 100) ===
    Math.round(lt.caLot * 100),
  "HT client élec == caLot moteur (reset)",
  `${clientBase.parLotClientHT.elec.toFixed(2)} == ${lt.caLot.toFixed(2)}`
);

console.log("\n══════════════════════════════════════════════════════════════════");
if (failures === 0) {
  console.log("  ✅  CHAÎNE UI → LISTE DEVIS OK — appareillages + F/P se matérialisent");
} else {
  console.log(`  ❌  ${failures} assertion(s) en échec`);
}
console.log("══════════════════════════════════════════════════════════════════\n");

process.exit(failures === 0 ? 0 : 1);
