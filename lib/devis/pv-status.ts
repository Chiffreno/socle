// ============================================================
// SOCLE — Module Devis — PV de réception : statut dérivé
// Le statut de réception global est DÉRIVÉ des lignes du PV (règle reprise du
// legacy ChiffReno) : un refus prime sur une réserve, qui prime sur le sans
// réserve. Le statut n'est pas stocké — il se calcule à l'affichage.
// ============================================================

import type { PV, StatutReception } from "./types";

export const STATUT_RECEPTION_LABEL: Record<StatutReception, string> = {
  incomplete: "Réception incomplète",
  sans_reserve: "Réception sans réserve",
  avec_reserves: "Réception avec réserves",
  refuse: "Réception refusée",
};

/**
 * Verdict global d'un PV, dérivé de ses lignes :
 *  - ≥1 ligne "non_statue" → "incomplete" (PV non finalisable)
 *  - sinon ≥1 ligne "refus"   → "refuse"
 *  - sinon ≥1 ligne "reserve" → "avec_reserves"
 *  - sinon                    → "sans_reserve"
 *
 * Le `non_statue` prime : tant qu'un lot n'est pas tranché, la réception ne
 * peut pas être qualifiée (ni finalisée en D4).
 */
export function verdictPV(pv: PV): StatutReception {
  let reserve = false;
  let refus = false;
  for (const ligne of pv.lignes) {
    if (ligne.verdict === "non_statue") return "incomplete";
    if (ligne.verdict === "refus") refus = true;
    else if (ligne.verdict === "reserve") reserve = true;
  }
  if (refus) return "refuse";
  return reserve ? "avec_reserves" : "sans_reserve";
}
