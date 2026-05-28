// ============================================================
// SOCLE — Module Devis — Types
// Calqués sur lib/devis/schema.sql (camelCase côté TS).
// ============================================================

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

// ─── Contenu du devis (jsonb) ───
export interface Ligne {
  id: string;
  /** Nature : "normal" (compté) | "option" (présenté hors total). */
  nature: LigneNature;
  /** Référence catalogue si la ligne a été ajoutée depuis la bibliothèque. */
  prestationId?: string;
  libelle: string;
  description: string;
  quantite: number;
  unite: Unite;
  /** €/unité — fournitures (ce qui est facturé au client pour les matériaux). */
  prixMateriauxUnitaire: number;
  /** €/unité — main d'œuvre (pose). */
  prixPoseUnitaire: number;
  tva: TauxTVA;
  // Coûts internes PAR UNITÉ (jamais affichés au client) — base de la marge.
  /** Ce que l'artisan paye fournisseur (€/unité). */
  coutMateriauxAchat?: number;
  /** Taux horaire interne × heures réelles, rapporté à l'unité (€/unité). */
  coutMoInterne?: number;
}

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
  lots: Lot[];
  acomptePct: number;
  lettreIntro: string;
  notesInternes: string;
  /** Affiche le détail Matériaux/Pose dans l'aperçu/PDF client. */
  detailMatPose: boolean;
  /** Remise commerciale appliquée au sous-total HT (avant TVA). */
  remiseMode: RemiseMode;
  remiseValeur: number;
  // Totaux dénormalisés, recalculés à chaque écriture (cf. calc.ts).
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
>;
