// ============================================================
// SOCLE — Module Devis — Régime de TVA (logique pure)
//
// Résolution des régimes de TVA autorisés selon l'assujettissement de
// l'entreprise. Aucune valeur juridique (mentions, seuils) ici : elles
// viendront en constantes validées à une étape ultérieure.
// ============================================================

import type { RegimeTVA } from "./types";

/** Régimes de TVA accessibles selon l'assujettissement de l'entreprise.
 *  Non assujetti → uniquement la franchise en base. Assujetti → TVA normale
 *  ou autoliquidation sous-traitance. Logique pure (alimente les selects). */
export function regimesAutorises(assujettiTVA: boolean): RegimeTVA[] {
  return assujettiTVA ? ["tva", "autoliquidation"] : ["franchise"];
}

/** Régime appliqué par défaut à un nouveau devis selon l'assujettissement de
 *  l'entreprise. Non assujetti → `franchise`, assujetti → `tva`. */
export function regimeParDefaut(assujettiTVA: boolean): RegimeTVA {
  return assujettiTVA ? "tva" : "franchise";
}
