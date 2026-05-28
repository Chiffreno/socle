// ============================================================
// SOCLE — Module Devis — Calculs
//
// Modèle ligne : chaque ligne porte 2 prix unitaires (matériaux + pose) et
// 2 coûts internes optionnels (achat matériaux + MO interne), tous PAR UNITÉ.
//
// Nature des lignes :
//   - normal : comptée dans le sous-total, la TVA et la marge
//   - option : EXCLUE des totaux du devis (présentée à part)
//
// Remise commerciale globale : appliquée AU SOUS-TOTAL HT, AVANT TVA.
// La TVA est recalculée proportionnellement sur chaque ligne (préserve les
// taux différenciés 5,5 / 10 / 20). La marge est calculée sur le HT après
// remise (la remise réduit la marge, à coûts inchangés).
// ============================================================

import type { Devis, Ligne, Lot, RemiseMode } from "./types";

/** Arrondi monétaire à 2 décimales (évite les flottants type 0.1+0.2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Montant brut HT d'une ligne (mat + pose) × qté. */
export function ligneBrutHT(l: Ligne): number {
  return round2(
    ((l.prixMateriauxUnitaire || 0) + (l.prixPoseUnitaire || 0)) *
      (l.quantite || 0)
  );
}
/** Part matériaux d'une ligne (€/u × qté). */
export function ligneMateriauxHT(l: Ligne): number {
  return round2((l.prixMateriauxUnitaire || 0) * (l.quantite || 0));
}
/** Part pose d'une ligne (€/u × qté). */
export function lignePoseHT(l: Ligne): number {
  return round2((l.prixPoseUnitaire || 0) * (l.quantite || 0));
}
/** Coût interne total d'une ligne ((achat mat + MO interne) × qté). */
export function ligneCoutInterne(l: Ligne): number {
  return round2(
    ((l.coutMateriauxAchat || 0) + (l.coutMoInterne || 0)) * (l.quantite || 0)
  );
}

export interface DevisTotaux {
  /** Sous-total HT avant remise. */
  subTotalHT: number;
  /** Décomposition matériaux du sous-total (artisan only, hors aperçu client). */
  totalMateriauxHT: number;
  /** Décomposition pose du sous-total (artisan only). */
  totalPoseHT: number;
  /** Montant absolu de la remise appliquée (>= 0). */
  remiseHT: number;
  /** Total HT après remise. */
  totalHT: number;
  /** Total TVA (proportionnel après remise). */
  totalTVA: number;
  /** Total TTC = totalHT + totalTVA. */
  totalTTC: number;
  /** Marge HT = totalHT − somme(coûts internes des lignes normales). */
  margeHT: number;
  /** Total HT des lignes "option" (hors total devis). */
  totalOptionsHT: number;
}

function remiseAmount(
  subTotalHT: number,
  mode: RemiseMode,
  valeur: number
): number {
  if (subTotalHT <= 0) return 0;
  if (mode === "pourcent")
    return Math.min(subTotalHT, subTotalHT * ((valeur || 0) / 100));
  if (mode === "euros") return Math.min(subTotalHT, Math.max(0, valeur || 0));
  return 0;
}

/** Calcule les totaux d'un devis à partir de ses lots/lignes et de la remise. */
export function calcDevisTotaux(
  lots: Lot[],
  remiseMode: RemiseMode = "aucune",
  remiseValeur: number = 0
): DevisTotaux {
  let subTotalHT = 0;
  let totalMateriauxHT = 0;
  let totalPoseHT = 0;
  let subCoutTotal = 0;
  let totalOptionsHT = 0;

  for (const lot of lots) {
    for (const ligne of lot.lignes) {
      const brut = ligneBrutHT(ligne);
      if (ligne.nature === "option") {
        totalOptionsHT += brut;
        continue;
      }
      // nature === "normal"
      subTotalHT += brut;
      totalMateriauxHT += ligneMateriauxHT(ligne);
      totalPoseHT += lignePoseHT(ligne);
      subCoutTotal += ligneCoutInterne(ligne);
    }
  }

  subTotalHT = round2(subTotalHT);
  totalMateriauxHT = round2(totalMateriauxHT);
  totalPoseHT = round2(totalPoseHT);
  totalOptionsHT = round2(totalOptionsHT);

  const remiseHT = round2(remiseAmount(subTotalHT, remiseMode, remiseValeur));
  const totalHT = round2(subTotalHT - remiseHT);
  const ratio = subTotalHT > 0 ? totalHT / subTotalHT : 1;

  let totalTVA = 0;
  for (const lot of lots) {
    for (const ligne of lot.lignes) {
      if (ligne.nature === "option") continue;
      const brut = ligneBrutHT(ligne);
      totalTVA += brut * ratio * (ligne.tva / 100);
    }
  }
  totalTVA = round2(totalTVA);

  return {
    subTotalHT,
    totalMateriauxHT,
    totalPoseHT,
    remiseHT,
    totalHT,
    totalTVA,
    totalTTC: round2(totalHT + totalTVA),
    margeHT: round2(totalHT - subCoutTotal),
    totalOptionsHT,
  };
}

/** Ventilation de la TVA par taux (après application de la remise). */
export function ventilationTVA(
  lots: Lot[],
  remiseMode: RemiseMode = "aucune",
  remiseValeur: number = 0
): Record<number, number> {
  let subTotalHT = 0;
  for (const lot of lots) {
    for (const l of lot.lignes) {
      if (l.nature === "option") continue;
      subTotalHT += ligneBrutHT(l);
    }
  }
  const remiseHT = remiseAmount(subTotalHT, remiseMode, remiseValeur);
  const totalHT = subTotalHT - remiseHT;
  const ratio = subTotalHT > 0 ? totalHT / subTotalHT : 1;
  const parTaux: Record<number, number> = {};
  for (const lot of lots) {
    for (const ligne of lot.lignes) {
      if (ligne.nature === "option") continue;
      const brut = ligneBrutHT(ligne);
      const t = ligne.tva;
      parTaux[t] = round2((parTaux[t] || 0) + brut * ratio * (t / 100));
    }
  }
  return parTaux;
}

/** Montant de l'acompte d'un devis (sur le TTC après remise). */
export function montantAcompte(
  devis: Pick<Devis, "totalTTC" | "acomptePct">
): number {
  return round2(devis.totalTTC * (devis.acomptePct / 100));
}

/** Taux de marge en % du HT (0 si total nul). */
export function tauxMargePct(
  totaux: Pick<DevisTotaux, "totalHT" | "margeHT">
): number {
  if (totaux.totalHT <= 0) return 0;
  return round2((totaux.margeHT / totaux.totalHT) * 100);
}
