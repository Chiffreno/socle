// ============================================================
// SOCLE — Moteur Devis — Types
// Types internes au moteur (isolés de lib/devis/types.ts qui reste sur le
// modèle C1 jusqu'à P2). Le moteur s'intègre dans le Devis global à P2/P3.
// ============================================================

import type { TauxTVA, Unite } from "../types";

/** Les 15 lots du moteur (porté de ChiffReno v8). */
export type LotId =
  | "demolition"
  | "iti"
  | "fauxplafond"
  | "cloisons"
  | "elec"
  | "plombs"
  | "peinture"
  | "ragreage"
  | "etancheite"
  | "parquet"
  | "carrelage"
  | "faience"
  | "menus"
  | "menuext"
  | "cuisine";

export type Qualite = "std" | "mid" | "prm";

export type RemiseMode = "aucune" | "pourcent" | "euros";

/** Une ligne custom ajoutée à la main par l'artisan (déboursé matériau). */
export interface CustomLigne {
  id: string;
  lbl: string;
  unit: string;
  qty: number;
  p: number;
}

/** État persistant d'un lot. Les lignes sont calculées, pas stockées. */
export interface LotState {
  on: boolean;
  /** Surface spécifique au lot, null = utilise globalSurf. */
  surf: number | null;
  /** Préset qualité (impacte certains lots via QP). */
  q: Qualite;
  /** Marge % du lot — appliquée à (matériaux déboursé + MO) × (1 + m/100). */
  m: number;
  /** Temps MO total saisi par l'artisan (heures), pour le calcul de marge. */
  tempsMoHeures: number;
  /** Coût de revient saisi pour les lignes prixEstFinal=true du lot.
   *  Optionnel : si undefined, la marge points n'est pas trackée. */
  coutRevientPoints?: number;
  /** Options techniques du lot — forme spécifique par lot. */
  o: Record<string, unknown>;
  /** Overrides prix matériaux : { BPKey: prixCustom }. */
  cp: Record<string, number>;
  /** Lignes ajoutées manuellement (hors moteur). */
  custom: CustomLigne[];
  /** Override TVA pour toutes les lignes du lot (ex: ITI éligible 5,5%
   *  rénovation énergétique). Si undefined → tvaParDefaut du devis. */
  tva?: TauxTVA;
}

/** Une ligne produite par le moteur de calcul (transient, recalculée à chaque appel). */
export interface EngineLigne {
  /** BP key | prestationId (points élec) | "_c_<id>" (custom). */
  key: string;
  lotId: LotId;
  qty: number;
  lbl: string;
  unit: Unite | string;
  note: string;
  /** Identifiant du groupe de prestation au sein du lot (ex. zone cloisons
   *  "std"/"hydro"/"hd"/"feu"). Posé par calc-items, consommé par l'agrégation
   *  (rattachement consommables → prestation) à la place du parsing de libellé.
   *  Optionnel : les lots sans agrégation ne le posent pas. */
  groupId?: string;
  /** Prix unitaire SOURCE : matériau déboursé OU prix client final selon prixEstFinal. */
  p: number;
  /** qty × p (avant marge/MO/remise). */
  total: number;
  /** ChiffReno : item "highlighted" (produit fini visible) — drapeau interne. */
  hl: boolean;
  /** true → p est déjà le prix client final, AUCUNE marge/MO ajoutée par le moteur. */
  prixEstFinal: boolean;
  /** Dérivé : sous-ligne "dont fourniture" affichée sur le devis client si true. */
  afficheFourniture: boolean;
  /** Pour points : id de la prestation source dans le catalogue. */
  prestationId?: string;
  /** true si ligne custom (artisan). */
  custom?: boolean;
  customId?: string;
  /** Ragréage : épaisseur réelle, utilisée par la liste d'achat. */
  epa?: number;
  /** TVA applicable sur la ligne — par défaut tvaParDefaut du devis. */
  tva?: TauxTVA;
}

/** État global piloté par l'éditeur, lu par le moteur. */
export interface EngineState {
  globalSurf: number;
  tvaParDefaut: TauxTVA;
  remiseMode: RemiseMode;
  remiseValeur: number;
  /** Ajustement global % sur tous les prix BP (ChiffReno). */
  globalCoeff: number;
  lots: Record<LotId, LotState>;
}
