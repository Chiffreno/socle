// ============================================================
// SOCLE — Moteur Devis — Métadonnées et état initial des lots
// Porté de ChiffReno v8 (LM, CORPS, QP, state.lots).
// Élec : nouvelle forme de `o` (infrastructure + points) ; les 14 autres
// lots conservent la forme ChiffReno.
// ============================================================

import type { LotId, LotState, RemiseMode, EngineState } from "./types";
import type { TauxTVA } from "../types";

/** Métadonnée d'un lot pour la sidebar. */
export interface LotMeta {
  id: LotId;
  label: string;
  sub: string;
  /** Nom d'icône Tabler (sans le préfixe `ti-`), rendu via `<i className="ti ti-…">`. */
  icon: string;
}

/** 14 lots, ordre d'affichage sidebar. (Étanchéité supprimé en tant que lot —
 *  devient une option des lots carrelage/faïence.) */
export const LM: readonly LotMeta[] = [
  { id: "demolition", label: "Démolition & Protection", sub: "Bennes + protections chantier", icon: "hammer" },
  { id: "iti", label: "Isolation ITI", sub: "Système Optima Isover", icon: "temperature-snow" },
  { id: "fauxplafond", label: "Faux plafond", sub: "Suspentes + Isolant", icon: "layout-board" },
  { id: "cloisons", label: "Cloisons BA13", sub: "Ossature métallique", icon: "wall" },
  { id: "elec", label: "Électricité", sub: "Infrastructure + points", icon: "plug" },
  { id: "plombs", label: "Plomberie", sub: "Réseau multicouche", icon: "droplet" },
  { id: "peinture", label: "Enduit & Peinture", sub: "Finition murs / plafonds", icon: "brush" },
  { id: "ragreage", label: "Ragréage", sub: "Préparation support sol", icon: "trowel" },
  { id: "parquet", label: "Parquet", sub: "Pose flottante / collée", icon: "wood" },
  { id: "carrelage", label: "Carrelage", sub: "Sol grès / céramique", icon: "grid-4x4" },
  { id: "faience", label: "Faïence", sub: "Revêtement mural", icon: "grid-pattern" },
  { id: "menus", label: "Menuiseries int.", sub: "Portes + Plinthes", icon: "door" },
  { id: "menuext", label: "Menuiseries ext.", sub: "Fenêtres + Volets", icon: "window" },
  { id: "cuisine", label: "Cuisine", sub: "Meubles + Électroménager", icon: "tools-kitchen-2" },
];

/** Regroupement par corps d'état (vue récap interne). */
export const CORPS: readonly { label: string; ids: readonly LotId[] }[] = [
  { label: "Isolation & Structure", ids: ["iti", "fauxplafond", "cloisons"] },
  { label: "Second œuvre", ids: ["elec", "plombs"] },
  { label: "Revêtements", ids: ["ragreage", "parquet", "carrelage", "faience", "peinture"] },
  { label: "Menuiseries", ids: ["menus", "menuext"] },
  { label: "Équipements", ids: ["cuisine"] },
];

/**
 * Lots PRODUIT-FINI (au sens commercial : le client reconnaît / choisit
 * un modèle, gamme, marque). Sur ces lots, afficheFourniture = ligne.hl
 * (le produit affiche sa fourniture, les consommables d'accompagnement non).
 * Sur les LOTS CONSOMMABLES (tous les autres), afficheFourniture = false
 * sur toutes les lignes, sans exception.
 */
export const LOTS_PRODUIT_FINI: ReadonlySet<LotId> = new Set<LotId>([
  "elec",
  "plombs",
  "parquet",
  "carrelage",
  "faience",
  "menus",
  "menuext",
  "cuisine",
]);

// Plus de GAMMES (Éco/Standard/Premium) — décision produit juin 2026.
// QP (presets qualité) et LOTS_AVEC_GAMME supprimés ; barèmes mono-prix
// (valeurs = ancienne gamme std, cf. bp.ts). Le champ legacy `q` des devis
// sérialisés est purgé par normalize.ts.

/** Lots qui n'utilisent PAS de surface explicite (lue depuis options / globale). */
export const LOTS_NO_SURF: ReadonlySet<LotId> = new Set<LotId>([
  "demolition",
  "iti",
  "cloisons",
  "fauxplafond",
  "peinture",
  "parquet",
  "carrelage",
  "faience",
  "ragreage",
  "menus",
  "menuext",
  "cuisine",
]);

/** État initial vide d'un lot (forme spécifique à chaque lot pour `o`). */
function lotEmpty(o: Record<string, unknown>): LotState {
  return { on: false, surf: null, m: 0, tempsMoHeures: 0, o, cp: {}, custom: [], lignesLibres: [] };
}

/** Construit l'état initial des 14 lots. */
export function createInitialLotStates(): Record<LotId, LotState> {
  return {
    // DÉMOLITION — nouvelle forme SOCLE : 100% postes à prix ferme (catalogue-demolition.ts).
    // Pas d'infrastructure à déboursé (contrairement à élec). Marge interne via coutRevientPoints.
    demolition: lotEmpty({ points: {} as Record<string, number> }),
    // ITI — modèle "segments" (patron cloisons) : prestations dans o.lignes ;
    // chute = réglage niveau lot. Isolant = ligne hl (R indicatif affiché).
    iti: lotEmpty({ lignes: [], chute: 0 }),
    cloisons: lotEmpty({ lignes: [], chute: 0 }),
    // ÉLECTRICITÉ — nouvelle forme SOCLE : infrastructure + points
    elec: lotEmpty({ tableau_rangees: 0, gtl: false, consuel: false, terre: false, vmc: "non", points: {} as Record<string, number> }),
    peinture: lotEmpty({ z1_on: false, z1_m2: 0, z1_passes: "2", z1_fin: "velours", z1_imp: false, z1_treillis: false, z2_on: false, z2_m2: 0, z2_passes: "1", z2_fin: "mat", z2_imp: false, z2_treillis: false, z3_on: false, z3_m2: 0, z3_passes: "2", z3_fin: "satin", z3_imp: false, z3_treillis: false, z4_on: false, z4_m2: 0, z4_passes: "3", z4_fin: "satin", z4_imp: false, z4_treillis: false }),
    plombs: lotEmpty({ pts: { douche: 0, cuisine: 0, lavabo: 0, bain: 0 }, wc_sol: 0, wc_susp: 0, reseau_type: "mc", douche_type: "receveur", douche_carreler: false, ce: "ce_elec_150" }),
    // PARQUET — modèle "segments" (patron peinture) : prestations dans
    // o.lignes ; chute = réglage niveau lot. Plinthes = segment dédié (ml).
    parquet: lotEmpty({ lignes: [], chute: 0 }),
    // CARRELAGE — modèle "segments" : prestations dans o.lignes ; chute =
    // réglage lot. Plinthes (ml) et étanchéité (liquide/natte) = segments dédiés.
    carrelage: lotEmpty({ lignes: [], chute: 0 }),
    // FAÏENCE — modèle "segments" : prestations dans o.lignes ; chute =
    // réglage lot. Étanchéité = segment dédié (pas de plinthes).
    faience: lotEmpty({ lignes: [], chute: 0 }),
    ragreage: lotEmpty({ z1_on: false, z1_m2: 0, z1_type: "ragreage_simple", z1_epa_mm: 0, z2_on: false, z2_m2: 0, z2_type: "ragreage_fibre", z2_epa_mm: 0, z3_on: false, z3_m2: 0, z3_type: "ragreage_simple", z3_epa_mm: 0, primaire: false, bandes: false, ml_bandes: 0 }),
    menus: lotEmpty({ nb_portes: 0, type_porte: "porte_mid", m_plinthes: 0, type_plinthe: "plinthe_mdf", nb_seuils: 0 }),
    menuext: lotEmpty({ type_fen: "fenetre_pvc", nb_fen: 0, type_pf: "pf_pvc", nb_pf: 0, type_vol: "volet_bat_pvc", nb_vol: 0, porte_entree: "porte_entree_std", nb_porte_entree: 0, nb_seuils_ext: 0 }),
    cuisine: lotEmpty({ ml_bas: 0, ml_haut: 0, type_pt: "plan_travail", ml_pt: 0, m2_cred: 0, four: false, plaques: false, hotte: false, lave_vaisselle: false, evier: false }),
    // FAUX-PLAFOND — modèle "segments" (patron cloisons) : prestations dans
    // o.lignes ; entraxe/bandes/chute = réglages niveau lot.
    fauxplafond: lotEmpty({ lignes: [], entraxe: "0.60", bandes: false, chute: 0 }),
  };
}

/** État initial complet (devis vide). */
export function createInitialEngineState(opts?: {
  globalSurf?: number;
  tvaParDefaut?: TauxTVA;
  remiseMode?: RemiseMode;
  remiseValeur?: number;
  globalCoeff?: number;
}): EngineState {
  return {
    globalSurf: opts?.globalSurf ?? 0,
    tvaParDefaut: opts?.tvaParDefaut ?? 10,
    remiseMode: opts?.remiseMode ?? ("aucune" as RemiseMode),
    remiseValeur: opts?.remiseValeur ?? 0,
    globalCoeff: opts?.globalCoeff ?? 0,
    lots: createInitialLotStates(),
    lotsLibres: [],
  };
}
