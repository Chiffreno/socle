// ============================================================
// SOCLE — Moteur Devis — Totaux par lot et globaux
//
// Formule MARGE+MO option A (validée utilisateur) :
//   ca_deboursé_lot = (matériaux_lot + MO_lot) × (1 + margePct%)
//   margeDeboursé_lot = ca_deboursé_lot − (matériaux_lot + MO_lot)
// avec MO_lot = lot.tempsMoHeures × tauxHoraire (€/h entreprise).
//
// Lignes prixEstFinal=true (points démolition, points élec) :
//   - NI marge NI MO ajoutée par le moteur.
//   - CA = item.total (prix catalogue × qty), brut.
//   - Marge interne trackée séparément via lot.coutRevientPoints :
//       margePoints_lot = CA_points_lot − coutRevientPoints
//     (null si coutRevientPoints non saisi → "non renseignée", ≠ 100%).
//
// Lot HYBRIDE (élec) : caLot = caDeboursé + caPoints.
//
// Remise globale (state.remiseMode + state.remiseValeur) :
//   - 'pourcent' : remise = subTotalHT × valeur%
//   - 'euros'    : remise = max(0, valeur)
//   - 'aucune'   : remise = 0
//   Toujours capée à subTotalHT (le total ne peut pas devenir négatif).
//   Appliquée APRÈS sub-total HT, AVANT TVA.
//
// Ventilation TVA : chaque ligne porte son taux (lot.tva override ou
//   tvaParDefaut pour les lignes BP, prestation.tva pour les points).
//   Chaque CA de ligne est :
//     - prixEstFinal=true → item.total (brut catalogue)
//     - prixEstFinal=false → item.total × coefDeboursé_lot
//   où coefDeboursé_lot = caDeboursé_lot / déboursé_lot (distribue
//   matériaux+MO+marge proportionnellement). Si déboursé_lot = 0 mais
//   MO > 0 (lot 100% points avec MO saisi), le surplus orphan
//   (MO × (1+m%)) est attribué à tvaParDefaut.
//   Puis ratio remise = totalHT / subTotalHT appliqué à chaque CA.
//   TVA par taux = somme(CA_ligne_après_remise × taux/100).
// ============================================================

import { calcItems } from "./calc-items";
import { LM } from "./lots";
import type { EngineLigne, EngineState, LotId, RemiseMode } from "./types";
import type { RegimeTVA } from "../types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ─── Types de sortie ─────────────────────────────────────────────────

export interface LotTotaux {
  lotId: LotId;
  active: boolean;
  items: EngineLigne[];
  // Décomposition déboursé
  deboursé: number; // somme item.total où prixEstFinal=false
  /** Sous-ensemble du déboursé qui PORTE la MO (lignes non-`sansMO`). La MO du
   *  lot se répartit uniquement dessus ; les lignes `sansMO` (ex. Consuel)
   *  reçoivent la marge mais aucune MO. Égal à `deboursé` si aucune ligne
   *  `sansMO` → comportement et chiffres inchangés pour tous les autres lots. */
  debourséAvecMO: number;
  MO: number; // tempsMoHeures × tauxHoraire
  margePct: number; // lot.m
  caDeboursé: number; // (deboursé + MO) × (1 + m%)
  margeDeboursé: number; // caDeboursé − (deboursé + MO)
  // Points prix ferme
  caPoints: number; // somme item.total où prixEstFinal=true
  hasPoints: boolean;
  coutRevientPoints: number | null; // null = non saisi
  margePoints: number | null; // null si coutRevientPoints non saisi
  // Total lot
  caLot: number; // caDeboursé + caPoints
}

export interface DevisTotaux {
  parLot: LotTotaux[];
  // Sous-totaux globaux
  subTotalHT: number;
  remiseHT: number;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  // Ventilation TVA après remise — clé = taux (5.5, 10, 20), valeur = € TVA
  ventilationTVA: Record<number, number>;
  // Récap interne (artisan)
  totalDeboursé: number;
  totalMO: number;
  totalMargeDeboursé: number;
  totalCAPoints: number;
  totalCoutRevientPointsSaisi: number;
  totalMargePointsTracked: number; // somme des margePoints connus
  pointsLotsNonRenseignes: LotId[]; // lots avec points mais sans coutRevientPoints
  margeGlobaleTracked: number; // margeDeboursé + margePointsTracked (parts connues)
  /** true ssi tauxHoraire ≤ 0 ET au moins un lot actif a tempsMoHeures > 0.
   *  Signale à l'UI que la MO n'est pas valorisée dans la marge (cf. P3/P4
   *  affichage des bandeaux d'alerte). */
  tauxHoraireManquant: boolean;
}

// ─── Helpers internes ────────────────────────────────────────────────

function remiseAmount(
  subTotalHT: number,
  mode: RemiseMode,
  valeur: number
): number {
  if (subTotalHT <= 0) return 0;
  if (mode === "pourcent") {
    // Négatif clampé à 0 (symétrie mode euros) : une remise saisie négative
    // ne doit jamais augmenter le total.
    return Math.min(subTotalHT, subTotalHT * (Math.max(0, valeur || 0) / 100));
  }
  if (mode === "euros") {
    return Math.min(subTotalHT, Math.max(0, valeur || 0));
  }
  return 0;
}

// ─── Calcul par lot ──────────────────────────────────────────────────

export function calcLotTotaux(
  state: EngineState,
  lotId: LotId,
  tauxHoraire: number
): LotTotaux {
  const lot = state.lots[lotId];
  const items = lot.on ? calcItems(state, lotId) : [];

  const deboursé = round2(
    items.filter((i) => !i.prixEstFinal).reduce((a, i) => a + i.total, 0)
  );
  // Pool qui porte la MO : déboursé hors lignes `sansMO`. Sans ligne sansMO,
  // debourséAvecMO === deboursé (cas de tous les lots actuels).
  const debourséAvecMO = round2(
    items
      .filter((i) => !i.prixEstFinal && !i.sansMO)
      .reduce((a, i) => a + i.total, 0)
  );
  const caPoints = round2(
    items.filter((i) => i.prixEstFinal).reduce((a, i) => a + i.total, 0)
  );
  const MO = round2((lot.tempsMoHeures || 0) * (tauxHoraire || 0));
  const margePct = lot.m || 0;
  const caDeboursé = round2((deboursé + MO) * (1 + margePct / 100));
  const margeDeboursé = round2(caDeboursé - deboursé - MO);

  const hasPoints = items.some((i) => i.prixEstFinal);
  const coutRevientPoints =
    lot.coutRevientPoints !== undefined && lot.coutRevientPoints !== null
      ? round2(lot.coutRevientPoints)
      : null;
  const margePoints =
    coutRevientPoints !== null ? round2(caPoints - coutRevientPoints) : null;

  return {
    lotId,
    active: lot.on,
    items,
    deboursé,
    debourséAvecMO,
    MO,
    margePct,
    caDeboursé,
    margeDeboursé,
    caPoints,
    hasPoints,
    coutRevientPoints,
    margePoints,
    caLot: round2(caDeboursé + caPoints),
  };
}

// ─── Ventilation du CA déboursé par ligne (SOURCE UNIQUE) ────────────
// CETTE formule est partagée à l'identique par totals.ts (ventilation TVA) ET
// agregation.ts (lignes client). Toute divergence casserait l'invariant
// « Σ lignes client = HT lot ». Ne dupliquer NULLE PART.
//
// La MO du lot se répartit sur le pool `debourséAvecMO` (lignes non-`sansMO`) ;
// les lignes `sansMO` reçoivent la marge seule. Sans aucune ligne `sansMO`,
// `debourséAvecMO === deboursé` → `coefAvecMO === caDeboursé / deboursé` (le
// coefficient historique) : chiffres byte-identiques pour tous les lots actuels.

export interface LotCAContext {
  margePct: number;
  /** Coefficient appliqué au `total` des lignes déboursé NON-`sansMO`. */
  coefAvecMO: number;
  /** Surplus de CA non porté par une ligne (MO+marge orpheline) → tvaParDefaut. */
  orphanCA: number;
}

export function lotCAContext(lt: LotTotaux): LotCAContext {
  const marge = 1 + (lt.margePct || 0) / 100;
  const debourséSansMO = round2(lt.deboursé - lt.debourséAvecMO);
  const caSansMO = round2(debourséSansMO * marge);
  const caAvecMO = round2(lt.caDeboursé - caSansMO);
  const coefAvecMO = lt.debourséAvecMO > 0 ? caAvecMO / lt.debourséAvecMO : 0;
  // Aucune ligne avecMO pour porter caAvecMO (MO pur, ou tout le déboursé en
  // sansMO) → ce CA devient orphelin (rattaché à tvaParDefaut côté ventilation).
  const orphanCA = lt.debourséAvecMO === 0 ? caAvecMO : 0;
  return { margePct: lt.margePct || 0, coefAvecMO, orphanCA };
}

/** CA client d'UNE ligne moteur. Prix ferme → tel quel ; déboursé `sansMO` →
 *  marge seule ; déboursé normal → coefAvecMO (déboursé + sa part de MO + marge). */
export function lineClientCA(item: EngineLigne, ctx: LotCAContext): number {
  if (item.prixEstFinal) return item.total;
  if (item.sansMO) return item.total * (1 + ctx.margePct / 100);
  return item.total * ctx.coefAvecMO;
}

// ─── Calcul global du devis ──────────────────────────────────────────

export function calcEngineTotaux(
  state: EngineState,
  tauxHoraire: number = 0,
  regimeTVA: RegimeTVA = "tva"
): DevisTotaux {
  const parLot = LM.map((meta) => calcLotTotaux(state, meta.id, tauxHoraire));
  const activeLots = parLot.filter((l) => l.active);

  const subTotalHT = round2(activeLots.reduce((a, l) => a + l.caLot, 0));
  const remiseHT = round2(
    remiseAmount(subTotalHT, state.remiseMode, state.remiseValeur)
  );
  const totalHT = round2(subTotalHT - remiseHT);
  const ratio = subTotalHT > 0 ? totalHT / subTotalHT : 1;

  // La TVA n'est calculée qu'en régime 'tva'. En franchise (293 B) et en
  // autoliquidation (283-2 nonies), aucune TVA n'est facturée : la boucle de
  // ventilation est court-circuitée, ventilationTVA reste vide (sémantique
  // « aucune ventilation à afficher », ≠ TVA à 0%) et totalTVA = 0. Le HT
  // (subTotalHT, remiseHT, totalHT, ratio) est intact dans tous les cas.
  const tvaApplicable = regimeTVA === "tva";

  const ventilationTVA: Record<number, number> = {};
  let totalTVA = 0;

  if (tvaApplicable) {
    // Ventilation TVA par taux, après distribution marge+MO puis remise.
    const ventilationAcc: Record<number, number> = {};

    for (const lt of activeLots) {
      const ctx = lotCAContext(lt);

      for (const item of lt.items) {
        const tva = item.tva ?? state.tvaParDefaut;
        const lineCAAfterRemise = lineClientCA(item, ctx) * ratio;
        const lineTVA = lineCAAfterRemise * (tva / 100);
        ventilationAcc[tva] = (ventilationAcc[tva] || 0) + lineTVA;
      }

      if (ctx.orphanCA > 0) {
        const tva = state.tvaParDefaut;
        const lineTVA = ctx.orphanCA * ratio * (tva / 100);
        ventilationAcc[tva] = (ventilationAcc[tva] || 0) + lineTVA;
      }
    }

    for (const [taux, montant] of Object.entries(ventilationAcc)) {
      const r = round2(montant);
      ventilationTVA[Number(taux)] = r;
      totalTVA += r;
    }
    totalTVA = round2(totalTVA);
  }

  // Récap interne
  const totalDeboursé = round2(activeLots.reduce((a, l) => a + l.deboursé, 0));
  const totalMO = round2(activeLots.reduce((a, l) => a + l.MO, 0));
  const totalMargeDeboursé = round2(
    activeLots.reduce((a, l) => a + l.margeDeboursé, 0)
  );
  const totalCAPoints = round2(
    activeLots.reduce((a, l) => a + l.caPoints, 0)
  );

  const lotsAvecPoints = activeLots.filter((l) => l.hasPoints);
  const pointsLotsNonRenseignes = lotsAvecPoints
    .filter((l) => l.coutRevientPoints === null)
    .map((l) => l.lotId);
  const totalCoutRevientPointsSaisi = round2(
    lotsAvecPoints
      .filter((l) => l.coutRevientPoints !== null)
      .reduce((a, l) => a + (l.coutRevientPoints || 0), 0)
  );
  const totalMargePointsTracked = round2(
    lotsAvecPoints
      .filter((l) => l.margePoints !== null)
      .reduce((a, l) => a + (l.margePoints || 0), 0)
  );
  const margeGlobaleTracked = round2(
    totalMargeDeboursé + totalMargePointsTracked
  );

  // Détection : entreprise.tauxHoraire à 0 alors qu'au moins un lot actif a
  // saisi du temps MO → la marge sur déboursé est sous-évaluée silencieusement.
  // À l'UI (P3/P4) de signaler via un bandeau et de proposer Paramètres.
  const tauxHoraireManquant =
    (tauxHoraire || 0) <= 0 &&
    activeLots.some((l) => {
      const lotState = state.lots[l.lotId];
      return (lotState.tempsMoHeures || 0) > 0;
    });

  return {
    parLot,
    subTotalHT,
    remiseHT,
    totalHT,
    totalTVA,
    totalTTC: round2(totalHT + totalTVA),
    ventilationTVA,
    totalDeboursé,
    totalMO,
    totalMargeDeboursé,
    totalCAPoints,
    totalCoutRevientPointsSaisi,
    totalMargePointsTracked,
    pointsLotsNonRenseignes,
    margeGlobaleTracked,
    tauxHoraireManquant,
  };
}
