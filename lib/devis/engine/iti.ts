// ============================================================
// SOCLE — Moteur Devis — ITI : familles d'isolant, λ et résistance R
//
// Centralisé ici pour que le moteur (calc-items, libellé hl) et l'agrégation
// (description client) calculent le MÊME R, sans divergence.
//
// ⚠️ R CALCULÉ INDICATIF : R = épaisseur(m) / λ, avec des λ THÉORIQUES par
//    famille (ci-dessous). À REMPLACER par le R certifié ACERMI des fiches
//    produits, via la future bibliothèque de prix. Arrondi à 0,5 près, affiché
//    avec « ≈ » (jamais de fausse précision type "R = 5,71").
// ============================================================

import type { ItiIso, ItiEpa } from "./types";

/** λ (conductivité thermique, W/m.K) THÉORIQUE par famille — sert UNIQUEMENT
 *  au calcul du R indicatif affiché. Validés métier : LV 0,035 · LR 0,038 ·
 *  FB 0,038 · PSE 0,032 (graphité). */
export const ITI_LAMBDA: Record<ItiIso, number> = {
  lv: 0.035,
  lr: 0.038,
  fb: 0.038,
  pse: 0.032,
};

/** Libellé commercial de la famille d'isolant. */
export const ITI_FAMILLE_LABEL: Record<ItiIso, string> = {
  lv: "Laine de verre",
  lr: "Laine de roche",
  fb: "Fibre de bois",
  pse: "Polystyrène graphité",
};

/** Clé BP du prix isolant pour (famille, épaisseur). */
export function itiIsoKey(iso: ItiIso, epa: ItiEpa): string {
  return `iti_iso_${iso}_${epa}`;
}

/** R indicatif (m².K/W), arrondi à 0,5 près. */
export function itiR(iso: ItiIso, epa: ItiEpa): number {
  const r = Number(epa) / 1000 / ITI_LAMBDA[iso];
  return Math.round(r * 2) / 2;
}

/** R formaté FR sans fausse précision : "5,5" / "4" (entier sans décimale). */
export function itiRText(iso: ItiIso, epa: ItiEpa): string {
  const v = itiR(iso, epa);
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
}
