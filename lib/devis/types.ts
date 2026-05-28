// ============================================================
// SOCLE — Module Devis — Types
// Calqués sur lib/devis/schema.sql (camelCase côté TS).
//
// P2 — Le contenu chiffrage est porté par `Devis.engine: EngineState`
// (moteur "15 lots ChiffReno"). Les anciens `Lot`/`Ligne` (modèle C1
// ligne-par-ligne) sont @deprecated et seront retirés en P3 quand
// DevisEditor sera réécrit autour du configurateur de lots.
// ============================================================

import type { EngineState } from "./engine/types";

export type ClientType = "particulier" | "professionnel";

export type DevisStatut =
  | "brouillon"
  | "envoye"
  | "signe"
  | "refuse"
  | "expire";

/** Nature d'une ligne de devis. Remplace l'ancien couple `type`/`statut`. */
export type LigneNature = "normal" | "option";

/** Mode de remise commerciale appliquée au sous-total HT. */
export type RemiseMode = "aucune" | "pourcent" | "euros";

export type TauxTVA = 5.5 | 10 | 20;

export type Unite =
  | "u"
  | "m"
  | "m2"
  | "m3"
  | "ml"
  | "h"
  | "jour"
  | "kg"
  | "forfait";

/** Valeurs autorisées, pour alimenter les selects de l'UI. */
export const TAUX_TVA: readonly TauxTVA[] = [5.5, 10, 20];
export const UNITES: readonly Unite[] = [
  "u",
  "m",
  "m2",
  "m3",
  "ml",
  "h",
  "jour",
  "kg",
  "forfait",
];
export const UNITE_LABEL: Record<Unite, string> = {
  u: "u",
  m: "m",
  m2: "m²",
  m3: "m³",
  ml: "ml",
  h: "h",
  jour: "jour",
  kg: "kg",
  forfait: "forfait",
};

// ─── Entreprise (singleton par user) ───
export interface Entreprise {
  id: string;
  raisonSociale: string;
  formeJuridique: string;
  siren: string;
  siret: string;
  tvaIntracom: string;
  capital: number | null;
  adresse: string;
  codePostal: string;
  ville: string;
  email: string;
  telephone: string;
  siteWeb: string;
  assuranceCompagnie: string;
  assurancePolice: string;
  assuranceZone: string;
  validiteJours: number;
  acomptePct: number;
  margePct: number;
  tauxHoraire: number;
  iban: string;
  cgv: string;
  createdAt: string;
  updatedAt: string;
}
export type EntrepriseInput = Omit<
  Entreprise,
  "id" | "createdAt" | "updatedAt"
>;

// ─── Client ───
export interface Client {
  id: string;
  type: ClientType;
  nom: string;
  prenom: string;
  contact: string;
  email: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  siren: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export type ClientInput = Omit<Client, "id" | "createdAt" | "updatedAt">;

/** Copie figée des coordonnées client au moment de l'émission du devis. */
export interface ClientSnapshot {
  type: ClientType;
  nom: string;
  prenom: string;
  contact: string;
  email: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  siren: string;
}

// ─── @deprecated — modèle C1 ligne-par-ligne ───
// Conservé en P2 pour ne pas casser DevisEditor/ApercuDevis. Sera supprimé
// en P3 quand l'UI bascule sur le configurateur de lots ChiffReno. Les
// devis migrés ont `Devis.lots = []` (vide), tout le chiffrage est dans
// `Devis.engine`.

/** @deprecated P2 — modèle C1, remplacé par EngineLigne dans le moteur. */
export interface Ligne {
  id: string;
  nature: LigneNature;
  prestationId?: string;
  libelle: string;
  description: string;
  quantite: number;
  unite: Unite;
  prixMateriauxUnitaire: number;
  prixPoseUnitaire: number;
  tva: TauxTVA;
  coutMateriauxAchat?: number;
  coutMoInterne?: number;
}

/** @deprecated P2 — modèle C1, remplacé par les 15 lots ChiffReno
 *  (cf. `lib/devis/engine/lots.ts`). */
export interface Lot {
  id: string;
  titre: string;
  lignes: Ligne[];
}

// ─── Devis ───
export interface Devis {
  id: string;
  numero: string;
  clientId: string | null;
  clientSnapshot: ClientSnapshot | null;
  titre: string;
  statut: DevisStatut;
  dateCreation: string; // ISO date (YYYY-MM-DD)
  dateValidite: string | null;
  chantierAdresse: string;
  chantierCodePostal: string;
  chantierVille: string;
  /** Surface chantier (m²). Sync'd vers `engine.globalSurf` à chaque
   *  écriture par le repository. */
  globalSurf: number;
  /** TVA appliquée par défaut aux lignes du moteur. Sync'd vers
   *  `engine.tvaParDefaut`. */
  tvaParDefaut: TauxTVA;
  /** P2 — Source de vérité du chiffrage : lots ChiffReno, leur config,
   *  custom, MO, marge, coutRevientPoints, override TVA par lot. */
  engine: EngineState;
  /** @deprecated P2 — modèle C1, vidé à [] par la migration. Sera retiré
   *  en P3 quand DevisEditor sera réécrit autour de `engine`. */
  lots: Lot[];
  acomptePct: number;
  lettreIntro: string;
  notesInternes: string;
  /** Affiche le détail Matériaux/Pose dans l'aperçu/PDF client. */
  detailMatPose: boolean;
  /** Remise commerciale appliquée au sous-total HT (avant TVA). Sync'd
   *  vers `engine.remiseMode` / `engine.remiseValeur`. */
  remiseMode: RemiseMode;
  remiseValeur: number;
  // Totaux dénormalisés, recalculés à chaque écriture depuis `engine`
  // (cf. repository.withTotaux → calcEngineTotaux).
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  margeHT: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Données fournies pour créer/modifier un devis. Le `numero` et les totaux
 * sont attribués/calculés par le repository ; ils ne sont pas fournis ici.
 *
 * P2 — `globalSurf`, `tvaParDefaut`, `engine` sont optionnels à l'entrée :
 * le repository les remplit avec des défauts neutres (0 / 10 /
 * `createInitialEngineState`) si absents. Permet à l'ancien DevisEditor
 * (C1) de continuer à créer des devis sans connaître l'engine. P3 les
 * rendra obligatoires une fois l'UI réécrite.
 */
export type DevisInput = Omit<
  Devis,
  | "id"
  | "numero"
  | "totalHT"
  | "totalTVA"
  | "totalTTC"
  | "margeHT"
  | "createdAt"
  | "updatedAt"
  | "globalSurf"
  | "tvaParDefaut"
  | "engine"
> &
  Partial<Pick<Devis, "globalSurf" | "tvaParDefaut" | "engine">>;
