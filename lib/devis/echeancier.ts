// ============================================================
// SOCLE — Échéancier de paiement (multi-acomptes)
//
// SEULE source des montants d'échéances. Partagé entre la page de
// finalisation (récap live) et, plus tard, le PDF (étape 3). Aucun rendu ici :
// pure résolution Echeance[] → EcheanceResolue[].
//
// Règle d'or : la ligne "solde" ABSORBE les arrondis. La somme des montants
// résolus est STRICTEMENT égale au totalTTC (calcul en centiers, le solde
// prend le reliquat). Sans ligne solde, on ne réinvente rien — l'écart
// éventuel est signalé visuellement par l'UI (garde-fou 100 % non bloquant).
// ============================================================

import type { Echeance, EcheanceMode, EcheanceMoment } from "./types";

export interface EcheanceResolue {
  id: string;
  libelle: string;
  moment: EcheanceMoment;
  /** Mode d'origine — permet à la vue de n'afficher le % que pour
   *  "pourcent"/"solde" (jamais pour un montant fixe). */
  mode: EcheanceMode;
  montantTTC: number;
  pourcentEffectif: number;
}

/** Arrondi au centime (cents entiers → euros), robuste au bruit flottant. */
function eurosFromCents(cents: number): number {
  return cents / 100;
}

/**
 * Résout un échéancier en montants TTC.
 *
 * - mode "pourcent" → montantTTC = totalTTC × valeur / 100
 * - mode "montant"  → montantTTC = valeur (fixe)
 * - mode "solde"    → montantTTC = totalTTC − somme des autres lignes
 *
 * pourcentEffectif = montantTTC / totalTTC × 100 (0 si totalTTC = 0).
 * Ordre de sortie = ordre d'entrée. Une seule ligne solde absorbe le reliquat
 * (les éventuelles lignes solde surnuméraires reçoivent 0 — l'UI les empêche).
 */
export function resoudreEcheancier(
  echeancier: Echeance[],
  totalTTC: number
): EcheanceResolue[] {
  const totalCents = Math.round(totalTTC * 100);

  // 1re passe : lignes non-solde, en centiers (arrondi au centime).
  const centsParLigne: (number | null)[] = echeancier.map((e) => {
    if (e.mode === "solde") return null; // résolu en 2e passe
    if (e.mode === "pourcent") return Math.round((totalCents * e.valeur) / 100);
    // mode "montant" (fixe)
    return Math.round(e.valeur * 100);
  });

  const autresCents = centsParLigne.reduce<number>(
    (acc, c) => acc + (c ?? 0),
    0
  );

  // La 1re ligne solde absorbe le reliquat ; les suivantes (cas anormal) → 0.
  const premierSolde = echeancier.findIndex((e) => e.mode === "solde");

  return echeancier.map((e, i) => {
    let cents = centsParLigne[i];
    if (cents === null) {
      cents = i === premierSolde ? totalCents - autresCents : 0;
    }
    const montantTTC = eurosFromCents(cents);
    const pourcentEffectif = totalCents !== 0 ? (cents / totalCents) * 100 : 0;
    return {
      id: e.id,
      libelle: e.libelle,
      moment: e.moment,
      mode: e.mode,
      montantTTC,
      pourcentEffectif,
    };
  });
}
