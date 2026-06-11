// ============================================================
// SOCLE — Moteur Devis — Types
// Types internes au moteur (isolés de lib/devis/types.ts qui reste sur le
// modèle C1 jusqu'à P2). Le moteur s'intègre dans le Devis global à P2/P3.
// ============================================================

import type { TauxTVA, Unite } from "../types";

/** Les 14 lots du moteur (porté de ChiffReno v8 ; lot étanchéité supprimé
 *  juin 2026 — l'étanchéité devient une OPTION des lots carrelage/faïence). */
export type LotId =
  | "demolition"
  | "iti"
  | "fauxplafond"
  | "cloisons"
  | "elec"
  | "plombs"
  | "peinture"
  | "ragreage"
  | "parquet"
  | "carrelage"
  | "faience"
  | "menus"
  | "menuext"
  | "cuisine";

// Qualite ("std"|"mid"|"prm") supprimé — plus de gammes (décision produit
// juin 2026). Barèmes mono-prix dans bp.ts ; le champ legacy `q` des devis
// sérialisés est purgé silencieusement par normalize.ts.

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
  /** Lignes LIBRES du lot (prix de vente ferme, qty × pu). Additif : s'ajoute
   *  aux prestations du configurateur sans toucher au calcul du moteur.
   *  Point d'entrée pour garnir un lot dont le configurateur n'est pas encore
   *  câblé. Défaut []. */
  lignesLibres: LigneLibre[];
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
  /** Ligne déboursé EXCLUE de la MO du lot (marge appliquée, mais pas de MO).
   *  Ex. Consuel élec = attestation (déboursé + marge, aucune main d'œuvre).
   *  La MO du lot se répartit alors uniquement sur les lignes non-`sansMO`.
   *  Sans effet si prixEstFinal=true. Défaut undefined = porte la MO. */
  sansMO?: boolean;
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

// ─── Cloisons : modèle "segments" (o.lignes) ─────────────────────────
export type CloisonType = "std" | "hydro" | "hd" | "feu" | "libre";
export type CloisonOss = "m48" | "m70" | "m90";
/** Isolant : type seul ; l'épaisseur est dérivée de l'ossature (M48→45, M70→70, M90→90). */
export type CloisonIso = "non" | "lv" | "lr";

/**
 * Une ligne de cloison configurée par l'artisan. `cloisons.o.lignes` est un
 * tableau de segments (remplace les 4 slots fixes std/hydro/hd/feu).
 * Cumul : deux segments de config identique (type+oss+isolant+peaux+dbl)
 * sont fusionnés (m² additionnés) côté UI.
 */
export interface CloisonSegment {
  /** Id stable (clé React, groupId moteur, cible du cumul). */
  id: string;
  type: CloisonType;
  oss: CloisonOss;
  isolant: CloisonIso;
  peaux: "2" | "4";
  dbl: boolean;
  m2: number;
  /** Surcharge du PU client au m² (override-aware). Pour `libre` : prix unitaire. */
  puOverride?: number;
  /** Renommage commercial : prend le pas sur le libellé généré si défini. */
  libelleOverride?: string;
  /** `libre` uniquement : libellé manuel. */
  lbl?: string;
  /** `libre` uniquement : unité (défaut "u"). */
  unit?: string;
}

// ─── Faux-plafond : modèle "segments" (o.lignes), patron cloisons ────
export type FauxPlafondType = "std" | "hydro" | "feu" | "phon" | "libre";
/** Isolant faux-plafond : type+épaisseur (clé directe vers BP `fp_*`). */
export type FauxPlafondIso =
  | "non"
  | "lv45"
  | "lr45"
  | "lv100"
  | "lr100"
  | "ouate";
/**
 * Un segment de faux-plafond. Même esprit que CloisonSegment : une prestation
 * homogène. Pas de paramètre "suspente" (toujours à ressort). Réglages au
 * niveau lot : entraxe, bandes, chute (dans `o`, hors segment).
 */
export interface FauxPlafondSegment {
  id: string;
  type: FauxPlafondType;
  isolant: FauxPlafondIso;
  /** Nombre de peaux de plaque : 1 (simple) ou 2 (double). */
  peaux: "1" | "2";
  m2: number;
  puOverride?: number;
  libelleOverride?: string;
  /** `libre` uniquement. */
  lbl?: string;
  unit?: string;
}

// ─── ITI : modèle "segments" (o.lignes), patron cloisons ─────────────
/** Famille d'isolant ITI : laine de verre / roche, fibre de bois, polystyrène. */
export type ItiIso = "lv" | "lr" | "fb" | "pse";
/** Épaisseur d'isolant (mm) — liste commune aux 4 familles. */
export type ItiEpa = "80" | "100" | "120" | "145" | "160" | "180" | "200";
export type ItiParement = "ba13_std" | "ba13_hydro" | "aucun";
/**
 * Un segment d'ITI. `type` = famille d'isolant (axe principal / eyebrow / cumul)
 * ou "libre". L'isolant est la ligne hl de la prestation (avec R affiché).
 * Réglage niveau lot : chute (dans `o`, hors segment).
 */
export interface ItiSegment {
  id: string;
  type: ItiIso | "libre";
  epa: ItiEpa;
  /** Membrane frein-vapeur (Vario + scotch + pastilles). */
  membrane: boolean;
  parement: ItiParement;
  m2: number;
  puOverride?: number;
  libelleOverride?: string;
  /** `libre` uniquement. */
  lbl?: string;
  unit?: string;
}

// ─── Peinture : modèle "segments" (o.lignes), patron cloisons ────────
// DEUX familles dans un seul lot :
//   • Surfaces (m²) : briques déboursé (base support + passes d'enduit +
//     surcoût finition + toile) → MO + marge s'appliquent (comme cloisons).
//   • Menuiseries (à l'unité) : porte / fenêtre à prix ferme → segment `libre`
//     (PU porté par puOverride, unité "u"), aucune marge moteur.
export type PeintureSupport = "mur" | "plafond";
export type PeintureNature = "ancien" | "ba13";
export type PeinturePasses = 0 | 1 | 2 | 3;
export type PeintureFinition = "mat" | "velours" | "satine";
export type PeintureMenuiserie = "porte" | "fenetre";
/**
 * Un segment de peinture. `type` discrimine la famille :
 *   • "surface" → champs support/nature/passes/toile/finition, quantité = m².
 *   • "libre"   → menuiserie (porte/fenêtre) à prix ferme ; lbl/unit/puOverride
 *                 portés comme tout segment libre. `menuiserie` = métadonnée.
 * Règle toile→passes (forçage à 3, verrouillage) gérée DANS le configurateur.
 */
export interface PeintureSegment {
  id: string;
  type: "surface" | "libre";
  // ── Famille Surfaces (type === "surface") ──
  support?: PeintureSupport;
  nature?: PeintureNature;
  passes?: PeinturePasses;
  /** Toile à enduire — uniquement si nature === "ancien". Force passes à 3. */
  toile?: boolean;
  finition?: PeintureFinition;
  // ── Famille Menuiseries (type === "libre") ──
  menuiserie?: PeintureMenuiserie;
  /** Quantité : m² (surfaces) ou nombre de pièces (menuiseries). */
  m2: number;
  puOverride?: number;
  libelleOverride?: string;
  lbl?: string;
  unit?: string;
}

// ─── Parquet : modèle "segments" (o.lignes), patron peinture ─────────
// Axes (listes PLAUSIBLES métier — à valider Benjamin) :
//   • matériau : stratifié / contrecollé / massif (clés BP existantes) ;
//   • dimension (largeur de lame) : descriptif UNIQUEMENT, aucun impact prix
//     (à valider — un delta prix par largeur viendra en passe prix) ;
//   • colle : non (pose flottante) / MS polymère (pose collée) ;
//   • sous-couche : aucune / mousse / liège.
// PLINTHES : famille séparée du ConfigBox → segment DÉDIÉ type "plinthes"
// (carte normale, éditable/supprimable, badge/reset acquis), quantité en ml.
// Choix "ligne dédiée" (vs attribut du segment pose) : symétrique de la
// famille Menuiseries du pilote peinture et de l'option Étanchéité
// carrelage/faïence — une prestation visible = une carte.
export type ParquetMateriau = "strat" | "contre" | "massif";
/** Largeur de lame — descriptif (à valider Benjamin). */
export type ParquetDim = "etroite" | "std" | "large";
export type ParquetColle = "non" | "ms";
export type ParquetSousCouche = "non" | "mousse" | "liege";
export interface ParquetSegment {
  id: string;
  /** Matériau, ou "plinthes" (ml), ou "libre". */
  type: ParquetMateriau | "plinthes" | "libre";
  dim?: ParquetDim;
  colle?: ParquetColle;
  sc?: ParquetSousCouche;
  /** Quantité : m² (pose) ou ml (plinthes). */
  m2: number;
  puOverride?: number;
  libelleOverride?: string;
  lbl?: string;
  unit?: string;
}

// ─── Base commune à tout segment (cloison, faux-plafond, …) ──────────
/** Champs partagés par tous les segments — socle du composant de cartes
 *  générique (SegmentCards) et de l'agrégation segments (agregerSegments).
 *  Chaque lot a son interface précise (CloisonSegment, FauxPlafondSegment)
 *  qui l'étend de fait. */
export interface SegmentBase {
  id: string;
  type: string;
  m2: number;
  puOverride?: number;
  libelleOverride?: string;
  lbl?: string;
  unit?: string;
}

// ─── Lot libre : lot titré par l'artisan, sans configurateur ─────────
/** Une ligne d'un lot libre : prix de vente ferme (qty × pu, aucune marge). */
export interface LigneLibre {
  id: string;
  lbl: string;
  qty: number;
  unit: string;
  pu: number;
  /** Renommage commercial (cohérence avec les autres lignes). */
  libelleOverride?: string;
}
/** Lot ajouté manuellement (titre libre + lignes libres). Pas de moteur. */
export interface LotLibre {
  id: string;
  titre: string;
  lignes: LigneLibre[];
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
  /** Lots libres (titre + lignes manuelles, prix ferme). Additif : n'impacte
   *  pas le calcul des 15 lots moteur. Défaut []. */
  lotsLibres: LotLibre[];
}
