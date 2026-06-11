// ============================================================
// SOCLE — Module Devis — Régime de TVA (logique pure)
//
// Résolution des régimes de TVA autorisés selon l'assujettissement de
// l'entreprise. Aucune valeur juridique (mentions, seuils) ici : elles
// viendront en constantes validées à une étape ultérieure.
// ============================================================

import type { RegimeTVA } from "./types";
import { REGIMES_TVA } from "./types";

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

/** Résolution UNIQUE du régime TVA d'un devis — partagée par la lecture
 *  (normalizeDevis) ET la création (devisRepo.create). Ne dupliquer nulle
 *  part : c'est elle qui garantit qu'aucun devis ne circule sans régime.
 *  - `valeur` présente et valide (∈ REGIMES_TVA) → conservée ;
 *  - sinon, entreprise connue → `regimeParDefaut(assujettiTVA)` ;
 *  - sinon → 'tva' (entreprise non configurée, cf. décision étape A-bis). */
export function resoudreRegimeTVA(
  valeur: unknown,
  entreprise: { assujettiTVA: boolean } | null
): RegimeTVA {
  if (REGIMES_TVA.includes(valeur as RegimeTVA)) return valeur as RegimeTVA;
  return entreprise ? regimeParDefaut(entreprise.assujettiTVA) : "tva";
}
