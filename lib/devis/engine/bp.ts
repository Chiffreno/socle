// ============================================================
// SOCLE — Moteur Devis — Base Prices (BP)
// Porté de ChiffReno v8 (estimateur_btp_v8_64.html).
// Élec : SUPPRIMÉ tableau_elec / gaines_cables / appareillage_* / app_* / vmc_*
//        (remplacés par catalogue-elec.ts pour les points et entrées
//        elec_* ci-dessous pour l'infrastructure SOCLE).
// Prix unitaires HT en €/unité — à calibrer (les nouveaux elec_* sont des
// ordres de grandeur 2026 à valider par l'utilisateur).
// ============================================================

export const BP: Record<string, number> = {
  // ─── ITI ───
  iti_oss: 8.5, iti_appuis: 1.8,
  iti_vario: 5.0, iti_scotch: 0.55, iti_pastilles: 0.5,
  iti_ba13_std: 4.5, iti_ba13_hydro: 7.0,
  // Isolant ITI — 4 familles (lv/lr/fb/pse) × 7 épaisseurs (80→200 mm).
  // ⚠️ PRIX INDICATIFS (€/m² fourniture, marché 2026) — À REMPLACER par des
  //    relevés terrain via la future bibliothèque de prix.
  iti_iso_lv_80: 5.0, iti_iso_lv_100: 6.5, iti_iso_lv_120: 8.0, iti_iso_lv_145: 10.0, iti_iso_lv_160: 11.5, iti_iso_lv_180: 13.5, iti_iso_lv_200: 15.0,
  iti_iso_lr_80: 7.0, iti_iso_lr_100: 9.0, iti_iso_lr_120: 11.0, iti_iso_lr_145: 13.5, iti_iso_lr_160: 15.0, iti_iso_lr_180: 17.5, iti_iso_lr_200: 19.5,
  iti_iso_fb_80: 15.0, iti_iso_fb_100: 18.0, iti_iso_fb_120: 22.0, iti_iso_fb_145: 27.0, iti_iso_fb_160: 30.0, iti_iso_fb_180: 34.0, iti_iso_fb_200: 38.0,
  iti_iso_pse_80: 8.0, iti_iso_pse_100: 10.0, iti_iso_pse_120: 12.0, iti_iso_pse_145: 14.5, iti_iso_pse_160: 16.0, iti_iso_pse_180: 18.0, iti_iso_pse_200: 20.0,

  // ─── Cloisons ───
  rail_r48: 1.2, rail_r70: 1.5, rail_r90: 1.8,
  mont_m48: 1.5, mont_m70: 1.9, mont_m90: 2.5,
  bande_acou: 0.50,
  ba13_std: 4.5, ba13_hydro: 7.0, ba13_hd: 9.5, ba13_feu: 9.5,
  // Isolant acoustique cloisons : épaisseur dérivée de l'ossature (M48→45,
  // M70→70, M90→90). lv = laine de verre, lr = laine de roche.
  lv45: 3.5, lv70: 5.5, lv90: 7.0,
  lr45: 5.0, lr70: 7.0, lr90: 8.5,
  // bande_joint en €/ml (3 ml/m² de placo) ; enduit_bande en €/m².
  visserie_cloison: 0.4, bande_joint: 0.23, enduit_bande: 1.20,

  // ─── ÉLECTRICITÉ — infrastructure (nouveau modèle SOCLE, à calibrer) ───
  elec_tableau_1r: 280, elec_tableau_2r: 380, elec_tableau_3r: 480,
  elec_tableau_4r: 580, elec_tableau_5r: 660, elec_tableau_6r: 760,
  elec_gtl: 150,
  elec_consuel: 195,
  elec_terre: 320,
  elec_vmc_sf: 450, elec_vmc_df: 1500,
  elec_reseau_m2: 20, // PRIX INDICATIF — à valider temps 2 (réseau élec €/m²)
  // Les 31 points élec (prise, va-et-vient, spot, etc.) sont dans catalogue-elec.ts,
  // pas dans BP, car ce sont des prix de vente finaux (prixEstFinal=true).

  // ─── Peinture (legacy zone-based — conservé, plus utilisé par le moteur) ───
  enduit_pate: 1.2, impression: 0.8,
  peinture_mat: 0.9, peinture_velours: 1.4, peinture_satin: 2.0,
  toile_treillis: 2.80,

  // ─── Peinture — modèle segments (briques déboursé €/m²) ───
  // PRIX INDICATIF — à remplacer par relevés terrain (passe prix temps 2).
  // Base support = préparation + mise en peinture (finition mat de référence).
  peint_base_mur_ancien: 9.0, // PRIX INDICATIF — passe prix temps 2
  peint_base_mur_ba13: 7.0, // PRIX INDICATIF — passe prix temps 2
  peint_base_plafond_ancien: 11.0, // PRIX INDICATIF — passe prix temps 2
  peint_base_plafond_ba13: 9.0, // PRIX INDICATIF — passe prix temps 2
  peint_passe_enduit: 4.0, // PRIX INDICATIF — coût d'UNE passe d'enduit/m²
  peint_toile: 5.5, // PRIX INDICATIF — surcoût toile à enduire/m²
  // deltaFinition : mat = 0 (référence, pas de ligne), velours/satine = surcoût.
  peint_fin_velours: 2.5, // PRIX INDICATIF — surcoût finition velours/m²
  peint_fin_satine: 4.0, // PRIX INDICATIF — surcoût finition satinée/m²

  // ─── Plomberie ───
  reseau_mc: 12, reseau_cu: 24, evac_pvc: 6,
  // équipements MONO-PRIX (plus de gammes — valeurs = ancienne gamme std)
  wc_complet: 130, bati_support: 185, wc_suspendu_cuvette: 145, plaque_declenchement: 48,
  receveur_90: 110, receveur_carreler: 95, bonde_design: 58, kit_etanche_douche: 8.5,
  mitigeur_douche: 55, mitigeur_cuisine: 42, mitigeur_lavabo: 38,
  baignoire: 180, mitigeur_bain: 62,
  ce_elec_100: 220, ce_elec_150: 295, ce_thermo: 1100,

  // ─── Revêtements sol ───
  parquet_strat: 15, parquet_contre: 48, parquet_massif: 70,
  sous_couche: 2.5, sous_couche_liege: 4.90, colle_parquet: 9.60,
  parquet_plinthes: 4.5, // INDICATIF — à valider : plinthe assortie + fixation, €/ml
  carrelage_std: 18, gres_cerame: 28, grand_format: 52, colle_carrelage: 1.20,

  // ─── Ragréage ───
  primaire_ragreage: 0.8, bande_resiliente: 1.2,
  ragreage_simple: 4.5, ragreage_fibre: 9.6,

  // ─── Étanchéité ───
  primaire_etanche: 1.5, etanche_liquide: 8.0, bande_etanche: 2.5,
  natte_etanche: 9.50, natte_desoli: 14.50, bande_natte: 3.0, colle_c2s: 1.20,

  // ─── Faïence ───
  faience_std: 18, gres_mural: 30, gf_mural: 55, colle_faience: 1.00, profiles_alu: 4,

  // ─── Menuiseries int ───
  porte_std: 200, porte_mid: 320, porte_prm: 550,
  plinthe_mdf: 3, plinthe_bois: 7, barre_seuil: 8,

  // ─── Menuiseries ext ───
  fenetre_pvc: 280, fenetre_alu: 450, fenetre_bois: 650,
  pf_pvc: 600, pf_alu: 950, pf_bois: 1350,
  volet_bat_pvc: 120, volet_bat_alu: 210, volet_roul: 380,
  porte_entree_std: 800, porte_entree_prm: 1600, seuil_ext: 30,

  // ─── Cuisine ───
  meuble_bas: 420, meuble_haut: 260, plan_travail: 85, plan_travail_qtz: 220, credence: 25,
  evier_cuisine: 160, four: 350, plaques: 300, hotte: 260, lave_vaisselle: 420,

  // ─── Faux plafond ───
  fp_fourrure: 1.5, fp_suspente_res: 1.8, fp_suspente_cav: 0.90, fp_lisse_peri: 3.20,
  fp_ba13_std: 4.5, fp_ba13_hydro: 7.0, fp_ba13_feu: 9.5, fp_ba13_phon: 11.0,
  fp_lv_45: 3.5, fp_lr_45: 5.0, fp_lv_100: 7.5, fp_lr_100: 9.5, fp_ouate: 12.0,
  fp_visserie: 0.4, fp_bande_joint: 1.8,

  // ─── Démolition ───
  benne_10m3: 350, polyane_200: 0.25, film_adh: 1.0, papier_kraft: 0.40,
};
