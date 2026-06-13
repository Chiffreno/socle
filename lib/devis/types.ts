// ============================================================
// SOCLE — Module Devis — Types
// Calqués sur lib/devis/schema.sql (camelCase côté TS).
//
// P2 — Le contenu chiffrage est porté par `Devis.engine: EngineState`
// (moteur "14 lots ChiffReno"). Les anciens `Lot`/`Ligne` (modèle C1
// ligne-par-ligne) sont @deprecated et seront retirés en P3 quand
// DevisEditor sera réécrit autour du configurateur de lots.
// ============================================================

import type { EngineState, LotId } from "./engine/types";

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

/** Échéancier de paiement (multi-acomptes). Étape 2 : remplace l'acompte
 *  unique `acomptePct` côté UI. Résolu en montants par `resoudreEcheancier`
 *  (lib/devis/echeancier.ts) — SEULE source des montants, partagée UI/PDF. */
export type EcheanceMoment = "commande" | "encours" | "reception";
export type EcheanceMode = "pourcent" | "montant" | "solde";

export interface Echeance {
  id: string;
  libelle: string;
  moment: EcheanceMoment;
  /** "solde" = 100 % − somme des autres lignes ; une seule ligne solde. */
  mode: EcheanceMode;
  /** Ignoré si mode === "solde". */
  valeur: number;
}

export type TauxTVA = 5.5 | 10 | 20;

/** Régime de TVA applicable à un devis. Trois cas mutuellement exclusifs :
 *  - `franchise`     : franchise en base (art. 293 B CGI) — pas de TVA facturée.
 *  - `tva`           : TVA normale, multi-taux (comportement actuel du moteur).
 *  - `autoliquidation` : autoliquidation sous-traitance BTP (art. 283-2 nonies).
 *  Le régime est porté par le Devis, surplombe le calcul, et conditionne les
 *  mentions légales (posées à une étape ultérieure). */
export type RegimeTVA = "franchise" | "tva" | "autoliquidation";

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
/** Régimes de TVA, pour alimenter les futurs selects. */
export const REGIMES_TVA: readonly RegimeTVA[] = [
  "franchise",
  "tva",
  "autoliquidation",
];
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
  /** Assujettissement à la TVA de l'entreprise.
   *  - `true`  : assujetti → accès aux régimes `tva` / `autoliquidation`.
   *  - `false` : non assujetti → franchise en base (régime `franchise`).
   *  Détermine les régimes autorisés sur les devis (cf. `regimesAutorises`). */
  assujettiTVA: boolean;
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
  /** Logo de l'entreprise — data URL base64 (redimensionné/compressé côté
   *  client, plafonné). Vide = pas de logo (l'en-tête retombe sur le nom). */
  logo: string;
  /** Couleur d'accent du document client (hex). Pilote tous les accents du
   *  PDF via la variable CSS --ap-accent. Défaut = vert SOCLE #1a7a3c. */
  couleurAccent: string;
  /** Taux de pénalités de retard (% par mois). null = non renseigné →
   *  placeholder « [taux à préciser] » sur le devis (jamais inventé). */
  penalitesRetardTaux: number | null;
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

// ─── Chantier ───
// Contenant métier : un chantier regroupe un ou plusieurs devis (et, à terme,
// des factures). L'adresse de chantier vit ici (et non plus sur le Devis).
export type ChantierStatut = "actif" | "clos";

export interface Chantier {
  id: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  /** FK Client : un seul client (maître d'ouvrage) par chantier. */
  clientId: string | null;
  dateCreation: string; // ISO date (YYYY-MM-DD)
  dateDebut: string | null;
  dateFin: string | null;
  statut: ChantierStatut;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export type ChantierInput = Omit<Chantier, "id" | "createdAt" | "updatedAt">;

// ─── Facture (MODÈLE SEUL — aucune UI, aucun calcul ici) ───
// Posé maintenant pour ne pas re-migrer le storage plus tard. La logique de
// facturation (acompte / situations / solde) viendra au temps 2.
export type FactureType = "acompte" | "situation" | "solde";
export type FactureStatut = "emise" | "payee";

export interface Facture {
  id: string;
  numero: string;
  /** FK Chantier parent. */
  chantierId: string;
  /** FK Devis source de la facture. */
  devisId: string;
  type: FactureType;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  dateEmission: string; // ISO date (YYYY-MM-DD)
  statut: FactureStatut;
  createdAt: string;
  updatedAt: string;
}
export type FactureInput = Omit<Facture, "id" | "createdAt" | "updatedAt">;

// ─── PV de réception (MODÈLE SEUL — aucune UI, aucun composant ici) ───
// Posé selon le patron Facture : modèle + repository + helper de statut, avant
// toute UI. Le PV pré-charge les lots du devis signé d'un chantier ; pour
// chaque lot réceptionné, l'utilisateur pose un verdict et — en cas de
// réserve/refus — une liste de réserves (texte + photos).
//
// Décisions actées (Temps 1) :
//  - Stockage 100 % local : le modèle vit en localStorage (cf. repository).
//  - Photos : référencées par id (clés IndexedDB résolues en phase B), JAMAIS
//    inline dans le modèle.
//  - Signatures : data-URL PNG du canvas.
//  - Levée des réserves : NON codée en Temps 1 ; l'emplacement est prévu
//    (`PVReserve.leveeLe`) mais reste undefined partout — ne pas l'utiliser.

/** Verdict posé sur un lot réceptionné. `non_statue` = état initial (le lot
 *  n'a pas encore été tranché ; un verdict explicite est requis pour finaliser). */
export type PVVerdict = "non_statue" | "valide" | "reserve" | "refus";

/** Statut de réception global, DÉRIVÉ des lignes (cf. `verdictPV`). Non stocké.
 *  `incomplete` = au moins un lot reste `non_statue` → PV non finalisable. */
export type StatutReception =
  | "incomplete"
  | "sans_reserve"
  | "avec_reserves"
  | "refuse";

/** Signature manuscrite capturée au canvas (client ou entreprise). */
export interface PVSignature {
  /** PNG du canvas (data URL base64). */
  dataUrl: string;
  /** Nom du signataire. */
  nom: string;
  /** Date de signature (ISO). */
  date: string;
}

/** Une réserve émise sur un lot (verdict `reserve` ou `refus`). */
export interface PVReserve {
  id: string;
  texte: string;
  /** Clés vers les photos (IndexedDB, résolues en phase B). JAMAIS d'image
   *  inline dans le modèle. */
  photoIds: string[];
  /** Date de levée de la réserve (ISO). PRÉVU pour le Temps 2 — reste
   *  undefined partout en Temps 1, ne pas l'utiliser ni l'exposer. */
  leveeLe?: string;
}

/** Une ligne de PV = un lot réceptionné. */
export interface PVLigne {
  /** Identifiant stable du moteur (JAMAIS le libellé : label/icône résolus au
   *  rendu via `LM`, cf. lib/devis/engine/lots.ts). */
  lotId: LotId;
  verdict: PVVerdict;
  /** Réserves émises ; vide si verdict === "valide". */
  reserves: PVReserve[];
}

export interface PV {
  id: string;
  /** FK Chantier parent. */
  chantierId: string;
  /** FK Devis source : fige les lots réceptionnés à la création. */
  devisId: string;
  /** Date de réception (ISO date — YYYY-MM-DD). */
  date: string;
  lignes: PVLigne[];
  signatureClient?: PVSignature;
  signatureEntreprise?: PVSignature;
  createdAt: string;
  updatedAt: string;
}
export type PVInput = Omit<PV, "id" | "createdAt" | "updatedAt">;

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

/** @deprecated P2 — modèle C1, remplacé par les 14 lots ChiffReno
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
  /** Délai PRÉVISIONNEL des travaux proposé sur ce devis (≠ planning réel du
   *  Chantier). null = non renseigné. Affiché en section dédiée du document. */
  dateDebutPrevue: string | null; // ISO date
  dateFinPrevue: string | null; // ISO date
  /** FK vers le Chantier parent. L'adresse de chantier est portée par le
   *  Chantier (le Devis ne stocke plus d'adresse). */
  chantierId: string;
  /** Surface chantier (m²). Sync'd vers `engine.globalSurf` à chaque
   *  écriture par le repository. */
  globalSurf: number;
  /** TVA appliquée par défaut aux lignes du moteur. Sync'd vers
   *  `engine.tvaParDefaut`. */
  tvaParDefaut: TauxTVA;
  /** Régime de TVA du devis. Porté par le devis, surplombe le calcul : il
   *  conditionne la façon dont les taux sont appliqués (franchise = aucun,
   *  autoliquidation = TVA due par le preneur). Il ne vit PAS dans
   *  `EngineState` — l'engine le reçoit en paramètre d'entrée. */
  regimeTVA: RegimeTVA;
  /** P2 — Source de vérité du chiffrage : lots ChiffReno, leur config,
   *  custom, MO, marge, coutRevientPoints, override TVA par lot. */
  engine: EngineState;
  /** @deprecated P2 — modèle C1, vidé à [] par la migration. Sera retiré
   *  en P3 quand DevisEditor sera réécrit autour de `engine`. */
  lots: Lot[];
  /** @deprecated Étape 2 — remplacé par `echeancier`. Conservé pour la
   *  migration (acompte unique → 2 lignes) ; l'UI ne l'édite plus. */
  acomptePct: number;
  /** Échéancier multi-acomptes. Défauté par le repository (jamais par le
   *  moteur). Migration non cassante depuis `acomptePct`. */
  echeancier: Echeance[];
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
  | "chantierId"
  | "echeancier"
  | "regimeTVA"
> &
  Partial<
    Pick<
      Devis,
      | "globalSurf"
      | "tvaParDefaut"
      | "engine"
      | "chantierId"
      | "echeancier"
      | "regimeTVA"
    >
  >;
