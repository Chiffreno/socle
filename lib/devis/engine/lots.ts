// ============================================================
// SOCLE — Moteur Devis — Métadonnées et état initial des lots
// Porté de ChiffReno v8 (LM, CORPS, QP, state.lots).
// Élec : nouvelle forme de `o` (infrastructure + points) ; les 14 autres
// lots conservent la forme ChiffReno.
// ============================================================

import type { LotId, LotState, Qualite, RemiseMode, EngineState } from "./types";
import type { TauxTVA } from "../types";

/** Métadonnée d'un lot pour la sidebar. */
export interface LotMeta {
  id: LotId;
  label: string;
  sub: string;
}

/** 15 lots, ordre d'affichage sidebar. */
export const LM: readonly LotMeta[] = [
  { id: "demolition", label: "Démolition & Protection", sub: "Bennes + protections chantier" },
  { id: "iti", label: "Isolation ITI", sub: "Système Optima Isover" },
  { id: "fauxplafond", label: "Faux plafond", sub: "Suspentes + Isolant" },
  { id: "cloisons", label: "Cloisons BA13", sub: "Ossature métallique" },
  { id: "elec", label: "Électricité", sub: "Infrastructure + points" },
  { id: "plombs", label: "Plomberie", sub: "Réseau multicouche" },
  { id: "peinture", label: "Enduit & Peinture", sub: "Finition murs / plafonds" },
  { id: "ragreage", label: "Ragréage", sub: "Préparation support sol" },
  { id: "etancheite", label: "Étanchéité", sub: "Sol & mur — liquide / natte" },
  { id: "parquet", label: "Parquet", sub: "Pose flottante / collée" },
  { id: "carrelage", label: "Carrelage", sub: "Sol grès / céramique" },
  { id: "faience", label: "Faïence", sub: "Revêtement mural" },
  { id: "menus", label: "Menuiseries int.", sub: "Portes + Plinthes" },
  { id: "menuext", label: "Menuiseries ext.", sub: "Fenêtres + Volets" },
  { id: "cuisine", label: "Cuisine", sub: "Meubles + Électroménager" },
];

/** Regroupement par corps d'état (vue récap interne). */
export const CORPS: readonly { label: string; ids: readonly LotId[] }[] = [
  { label: "Isolation & Structure", ids: ["iti", "fauxplafond", "cloisons"] },
  { label: "Second œuvre", ids: ["elec", "plombs"] },
  { label: "Revêtements", ids: ["ragreage", "etancheite", "parquet", "carrelage", "faience", "peinture"] },
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

/** Quality presets — patch partiel sur `lot.o` à appliquer via setQuality. */
export const QP: Partial<Record<LotId, Record<Qualite, Record<string, unknown>>>> = {
  demolition: {
    std: { nb_bennes: 1 },
    mid: { nb_bennes: 3 },
    prm: { nb_bennes: 6 },
  },
  iti: {
    std: { epa: "100", iso: "gr32", membrane: false, parement: "ba13_std" },
    mid: { epa: "120", iso: "gr32", membrane: true, parement: "ba13_std" },
    prm: { epa: "120", iso: "steico", membrane: true, parement: "ba13_hydro" },
  },
  cloisons: {
    std: { std_on: true, std_m2: 30, std_oss: "m48", std_peaux: "2", std_acou: "non", hydro_on: false, hydro_m2: 0, hydro_oss: "m48", hydro_peaux: "2", hydro_acou: "non", hd_on: false, hd_m2: 0, hd_oss: "m48", hd_peaux: "2", hd_acou: "non", feu_on: false, feu_m2: 0, feu_oss: "m48", feu_peaux: "2", feu_acou: "non", chute: 5 },
    mid: { std_on: true, std_m2: 40, std_oss: "m48", std_peaux: "2", std_acou: "non", hydro_on: true, hydro_m2: 15, hydro_oss: "m48", hydro_peaux: "2", hydro_acou: "lv45", hd_on: false, hd_m2: 0, hd_oss: "m48", hd_peaux: "2", hd_acou: "non", feu_on: false, feu_m2: 0, feu_oss: "m48", feu_peaux: "2", feu_acou: "non", chute: 7 },
    prm: { std_on: false, std_m2: 0, std_oss: "m70", std_peaux: "2", std_acou: "lr45", hydro_on: true, hydro_m2: 20, hydro_oss: "m70", hydro_peaux: "2", hydro_acou: "lr45", hd_on: true, hd_m2: 20, hd_oss: "m70", hd_peaux: "2", hd_acou: "lr45", feu_on: false, feu_m2: 0, feu_oss: "m48", feu_peaux: "2", feu_acou: "non", chute: 10 },
  },
  peinture: {
    std: { z1_on: true, z1_m2: 80, z1_passes: "1", z1_fin: "mat", z1_imp: false, z2_on: false, z2_m2: 20, z2_passes: "1", z2_fin: "mat", z2_imp: false, z3_on: false, z3_m2: 0, z3_passes: "1", z3_fin: "mat", z3_imp: false, z4_on: false, z4_m2: 0, z4_passes: "1", z4_fin: "mat", z4_imp: false },
    mid: { z1_on: true, z1_m2: 100, z1_passes: "2", z1_fin: "velours", z1_imp: true, z2_on: false, z2_m2: 30, z2_passes: "1", z2_fin: "mat", z2_imp: false, z3_on: false, z3_m2: 0, z3_passes: "1", z3_fin: "mat", z3_imp: false, z4_on: false, z4_m2: 0, z4_passes: "1", z4_fin: "mat", z4_imp: false },
    prm: { z1_on: true, z1_m2: 100, z1_passes: "3", z1_fin: "satin", z1_imp: true, z2_on: true, z2_m2: 30, z2_passes: "2", z2_fin: "velours", z2_imp: true, z3_on: false, z3_m2: 0, z3_passes: "1", z3_fin: "mat", z3_imp: false, z4_on: false, z4_m2: 0, z4_passes: "1", z4_fin: "mat", z4_imp: false },
  },
  plombs: {
    std: { ce: "ce_elec_100" },
    mid: { ce: "ce_elec_150" },
    prm: { ce: "ce_thermo" },
  },
  parquet: {
    std: { z1_on: true, z1_m2: 30, z1_type: "parquet_strat", z1_pose: "flottant", z1_chute: 5, z2_on: false, z2_m2: 0, z2_type: "parquet_strat", z2_pose: "flottant", z2_chute: 5, z3_on: false, z3_m2: 0, z3_type: "parquet_strat", z3_pose: "flottant", z3_chute: 5 },
    mid: { z1_on: true, z1_m2: 30, z1_type: "parquet_contre", z1_pose: "colle", z1_chute: 7, z2_on: false, z2_m2: 0, z2_type: "parquet_contre", z2_pose: "colle", z2_chute: 7, z3_on: false, z3_m2: 0, z3_type: "parquet_contre", z3_pose: "colle", z3_chute: 7 },
    prm: { z1_on: true, z1_m2: 30, z1_type: "parquet_massif", z1_pose: "colle", z1_chute: 10, z2_on: false, z2_m2: 0, z2_type: "parquet_massif", z2_pose: "colle", z2_chute: 10, z3_on: false, z3_m2: 0, z3_type: "parquet_massif", z3_pose: "colle", z3_chute: 10 },
  },
  carrelage: {
    std: { z1_on: true, z1_m2: 15, z1_type: "carrelage_std", z1_chute: 10, z2_on: false, z2_m2: 0, z2_type: "carrelage_std", z2_chute: 10, z3_on: false, z3_m2: 0, z3_type: "carrelage_std", z3_chute: 10 },
    mid: { z1_on: true, z1_m2: 15, z1_type: "gres_cerame", z1_chute: 12, z2_on: false, z2_m2: 0, z2_type: "gres_cerame", z2_chute: 12, z3_on: false, z3_m2: 0, z3_type: "gres_cerame", z3_chute: 12 },
    prm: { z1_on: true, z1_m2: 15, z1_type: "grand_format", z1_chute: 18, z2_on: false, z2_m2: 0, z2_type: "grand_format", z2_chute: 18, z3_on: false, z3_m2: 0, z3_type: "grand_format", z3_chute: 18 },
  },
  faience: {
    std: { z1_on: true, z1_m2: 15, z1_type: "faience_std", z1_profiles_ml: 15, z1_chute: 10, z2_on: false, z2_m2: 0, z2_type: "faience_std", z2_profiles_ml: 0, z2_chute: 10, z3_on: false, z3_m2: 0, z3_type: "faience_std", z3_profiles_ml: 0, z3_chute: 10 },
    mid: { z1_on: true, z1_m2: 15, z1_type: "gres_mural", z1_profiles_ml: 20, z1_chute: 10, z2_on: false, z2_m2: 0, z2_type: "gres_mural", z2_profiles_ml: 0, z2_chute: 10, z3_on: false, z3_m2: 0, z3_type: "gres_mural", z3_profiles_ml: 0, z3_chute: 10 },
    prm: { z1_on: true, z1_m2: 15, z1_type: "gf_mural", z1_profiles_ml: 20, z1_chute: 15, z2_on: false, z2_m2: 0, z2_type: "gf_mural", z2_profiles_ml: 0, z2_chute: 15, z3_on: false, z3_m2: 0, z3_type: "gf_mural", z3_profiles_ml: 0, z3_chute: 15 },
  },
  ragreage: {
    std: { z1_on: true, z1_m2: 40, z1_type: "ragreage_simple", z1_epa_mm: 4, z2_on: false, z2_m2: 0, z2_type: "ragreage_simple", z2_epa_mm: 4, z3_on: false, z3_m2: 0, z3_type: "ragreage_simple", z3_epa_mm: 4, primaire: false, bandes: true, ml_bandes: 25 },
    mid: { z1_on: true, z1_m2: 40, z1_type: "ragreage_simple", z1_epa_mm: 5, z2_on: false, z2_m2: 0, z2_type: "ragreage_simple", z2_epa_mm: 5, z3_on: false, z3_m2: 0, z3_type: "ragreage_simple", z3_epa_mm: 5, primaire: true, bandes: true, ml_bandes: 28 },
    prm: { z1_on: true, z1_m2: 40, z1_type: "ragreage_fibre", z1_epa_mm: 10, z2_on: false, z2_m2: 0, z2_type: "ragreage_fibre", z2_epa_mm: 10, z3_on: false, z3_m2: 0, z3_type: "ragreage_fibre", z3_epa_mm: 10, primaire: true, bandes: true, ml_bandes: 28 },
  },
  etancheite: {
    std: { mode: "liquide", primaire: false, ml_bandes: 20 },
    mid: { mode: "liquide", primaire: true, ml_bandes: 20 },
    prm: { mode: "natte_d", primaire: true, ml_bandes: 20 },
  },
  menus: {
    std: { type_porte: "porte_std", type_plinthe: "plinthe_mdf" },
    mid: { type_porte: "porte_mid", type_plinthe: "plinthe_mdf" },
    prm: { type_porte: "porte_prm", type_plinthe: "plinthe_bois" },
  },
  menuext: {
    std: { type_fen: "fenetre_pvc", type_pf: "pf_pvc", type_vol: "volet_bat_pvc", porte_entree: "porte_entree_std" },
    mid: { type_fen: "fenetre_alu", type_pf: "pf_alu", type_vol: "volet_bat_alu", porte_entree: "porte_entree_std" },
    prm: { type_fen: "fenetre_bois", type_pf: "pf_bois", type_vol: "volet_roul", porte_entree: "porte_entree_prm" },
  },
  cuisine: {
    std: { type_pt: "plan_travail", lave_vaisselle: false },
    mid: { type_pt: "plan_travail", lave_vaisselle: true },
    prm: { type_pt: "plan_travail_qtz", lave_vaisselle: true },
  },
  fauxplafond: {
    std: { suspente: "cav", plaque: "fp_ba13_std", peaux: "1", isolant: "fp_lv_45", avec_isolant: false },
    mid: { suspente: "res", plaque: "fp_ba13_std", peaux: "1", isolant: "fp_lv_45", avec_isolant: true },
    prm: { suspente: "res", plaque: "fp_ba13_phon", peaux: "2", isolant: "fp_lr_100", avec_isolant: true },
  },
  // elec : nouveau modèle SOCLE — pas de QP (infrastructure ferme + points par compteur).
};

/** Lots dotés d'un sélecteur Éco/Standard/Premium dans le header (cf. render()). */
export const LOTS_AVEC_GAMME: ReadonlySet<LotId> = new Set<LotId>([
  "elec",
  "cuisine",
  "menus",
  "menuext",
  "plombs",
]);

/** Lots qui n'utilisent PAS de surface explicite (lue depuis options / globale). */
export const LOTS_NO_SURF: ReadonlySet<LotId> = new Set<LotId>([
  "demolition",
  "iti",
  "cloisons",
  "peinture",
  "etancheite",
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
  return { on: false, surf: null, q: "std", m: 0, tempsMoHeures: 0, o, cp: {}, custom: [] };
}

/** Construit l'état initial des 15 lots. */
export function createInitialLotStates(): Record<LotId, LotState> {
  return {
    // DÉMOLITION — nouvelle forme SOCLE : 100% postes à prix ferme (catalogue-demolition.ts).
    // Pas d'infrastructure à déboursé (contrairement à élec). Marge interne via coutRevientPoints.
    demolition: lotEmpty({ points: {} as Record<string, number> }),
    iti: lotEmpty({ m2: 0, epa: "120", iso: "gr32", membrane: false, parement: "ba13_std" }),
    cloisons: lotEmpty({ std_on: false, std_m2: 0, std_oss: "m48", std_peaux: "2", std_acou: "non", std_dbl_mont: false, hydro_on: false, hydro_m2: 0, hydro_oss: "m48", hydro_peaux: "2", hydro_acou: "non", hydro_dbl_mont: false, hd_on: false, hd_m2: 0, hd_oss: "m48", hd_peaux: "2", hd_acou: "non", hd_dbl_mont: false, feu_on: false, feu_m2: 0, feu_oss: "m48", feu_peaux: "2", feu_acou: "non", feu_dbl_mont: false, chute: 0 }),
    // ÉLECTRICITÉ — nouvelle forme SOCLE : infrastructure + points
    elec: lotEmpty({ tableau_rangees: 0, gtl: false, consuel: false, terre: false, vmc: "non", points: {} as Record<string, number> }),
    peinture: lotEmpty({ z1_on: false, z1_m2: 0, z1_passes: "2", z1_fin: "velours", z1_imp: false, z1_treillis: false, z2_on: false, z2_m2: 0, z2_passes: "1", z2_fin: "mat", z2_imp: false, z2_treillis: false, z3_on: false, z3_m2: 0, z3_passes: "2", z3_fin: "satin", z3_imp: false, z3_treillis: false, z4_on: false, z4_m2: 0, z4_passes: "3", z4_fin: "satin", z4_imp: false, z4_treillis: false }),
    plombs: lotEmpty({ pts: { douche: 0, cuisine: 0, lavabo: 0, bain: 0 }, wc_sol: 0, wc_susp: 0, reseau_type: "mc", douche_type: "receveur", douche_carreler: false, ce: "ce_elec_150" }),
    parquet: lotEmpty({ z1_on: false, z1_m2: 0, z1_type: "parquet_contre", z1_pose: "colle", z1_sc: "std", z1_chute: 0, z2_on: false, z2_m2: 0, z2_type: "parquet_massif", z2_pose: "colle", z2_sc: "std", z2_chute: 0, z3_on: false, z3_m2: 0, z3_type: "parquet_strat", z3_pose: "flottant", z3_sc: "std", z3_chute: 0 }),
    carrelage: lotEmpty({ z1_on: false, z1_m2: 0, z1_type: "gres_cerame", z1_peigne: "b10", z1_chute: 0, z2_on: false, z2_m2: 0, z2_type: "grand_format", z2_peigne: "b10", z2_chute: 0, z3_on: false, z3_m2: 0, z3_type: "carrelage_std", z3_peigne: "b10", z3_chute: 0 }),
    faience: lotEmpty({ z1_on: false, z1_m2: 0, z1_type: "gres_mural", z1_peigne: "v4", z1_profiles_ml: 0, z1_chute: 0, z2_on: false, z2_m2: 0, z2_type: "faience_std", z2_peigne: "v4", z2_profiles_ml: 0, z2_chute: 0, z3_on: false, z3_m2: 0, z3_type: "gf_mural", z3_peigne: "v4", z3_profiles_ml: 0, z3_chute: 0 }),
    ragreage: lotEmpty({ z1_on: false, z1_m2: 0, z1_type: "ragreage_simple", z1_epa_mm: 0, z2_on: false, z2_m2: 0, z2_type: "ragreage_fibre", z2_epa_mm: 0, z3_on: false, z3_m2: 0, z3_type: "ragreage_simple", z3_epa_mm: 0, primaire: false, bandes: false, ml_bandes: 0 }),
    etancheite: lotEmpty({ m2: 0, mode: "liquide", primaire: false, ml_bandes: 0 }),
    menus: lotEmpty({ nb_portes: 0, type_porte: "porte_mid", m_plinthes: 0, type_plinthe: "plinthe_mdf", nb_seuils: 0 }),
    menuext: lotEmpty({ type_fen: "fenetre_pvc", nb_fen: 0, type_pf: "pf_pvc", nb_pf: 0, type_vol: "volet_bat_pvc", nb_vol: 0, porte_entree: "porte_entree_std", nb_porte_entree: 0, nb_seuils_ext: 0 }),
    cuisine: lotEmpty({ ml_bas: 0, ml_haut: 0, type_pt: "plan_travail", ml_pt: 0, m2_cred: 0, four: false, plaques: false, hotte: false, lave_vaisselle: false, evier: false }),
    fauxplafond: lotEmpty({ suspente: "res", plaque: "fp_ba13_std", peaux: "1", isolant: "fp_lv_45", avec_isolant: false, joints: false, chute: 0, entraxe: "0.60" }),
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
  };
}
