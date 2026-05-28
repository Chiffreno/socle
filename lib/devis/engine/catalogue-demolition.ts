// ============================================================
// SOCLE — Moteur Devis — Catalogue Démolition (par postes)
//
// 13 postes groupés en 3 catégories (déposes m² · déposes unité · évacuation).
//
// Différences avec catalogue-elec.ts :
//   - 100% pose, AUCUNE fourniture (afficheFourniture = false partout).
//   - Le lot démolition n'a PAS d'infrastructure à déboursé : c'est 100%
//     postes à prix ferme. Donc pas de bloc "déboursé + marge" — uniquement
//     des postes prixEstFinal=true + coutRevientPoints pour la marge interne.
//   - Unités mixtes : m² (déposes surface), u (déposes pièce), forfait (benne).
//
// Les lignes générées par le moteur auront :
//   - prixEstFinal = true (aucune marge ni MO ajoutée par le moteur)
//   - afficheFourniture = false (forcé par le moteur via prixEstFinal=true)
// ============================================================

import type { PointsCatalogue } from "./points";

export const CATALOGUE_DEMOLITION: PointsCatalogue = {
  lotId: "demolition",
  categories: [
    { id: "deposes_m2", label: "Déposes au m²", defaultOpen: true },
    { id: "deposes_unite", label: "Déposes à l'unité" },
    { id: "evacuation", label: "Évacuation" },
  ],
  prestations: [
    // ─── DÉPOSES AU M² (7) ───
    {
      id: "depose_cloison_placo",
      categorieId: "deposes_m2",
      libelle: "Dépose de cloison placo",
      description:
        "Dépose de cloison en plaques de plâtre sur ossature, y compris évacuation in situ.",
      unite: "m2",
      prixVente: 22,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_papier_peint",
      categorieId: "deposes_m2",
      libelle: "Dépose de papier peint",
      description:
        "Décollage du papier peint et préparation sommaire du support.",
      unite: "m2",
      prixVente: 12,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_carrelage_sol",
      categorieId: "deposes_m2",
      libelle: "Dépose de carrelage sol",
      description:
        "Dépose du carrelage existant au sol, y compris colle et ragréage superficiel.",
      unite: "m2",
      prixVente: 28,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_carrelage_mural",
      categorieId: "deposes_m2",
      libelle: "Dépose de carrelage mural / faïence",
      description:
        "Dépose de la faïence ou du carrelage mural existant.",
      unite: "m2",
      prixVente: 25,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_parquet",
      categorieId: "deposes_m2",
      libelle: "Dépose de parquet",
      description:
        "Dépose du parquet existant (collé, cloué ou flottant).",
      unite: "m2",
      prixVente: 18,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_moquette",
      categorieId: "deposes_m2",
      libelle: "Dépose de moquette ou sol souple",
      description:
        "Dépose de moquette, lino ou sol PVC, y compris ragréage superficiel.",
      unite: "m2",
      prixVente: 9,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_faux_plafond",
      categorieId: "deposes_m2",
      libelle: "Dépose de faux-plafond",
      description:
        "Dépose du faux-plafond existant et de son ossature.",
      unite: "m2",
      prixVente: 16,
      tva: 10,
      afficheFourniture: false,
    },

    // ─── DÉPOSES À L'UNITÉ (5) ───
    {
      id: "depose_wc",
      categorieId: "deposes_unite",
      libelle: "Dépose de bloc WC",
      description:
        "Dépose de la cuvette et du réservoir, obturation provisoire des attentes.",
      unite: "u",
      prixVente: 65,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_lavabo",
      categorieId: "deposes_unite",
      libelle: "Dépose de lavabo ou vasque",
      description:
        "Dépose du lavabo/vasque et de la robinetterie, obturation des attentes.",
      unite: "u",
      prixVente: 45,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_receveur_baignoire",
      categorieId: "deposes_unite",
      libelle: "Dépose de receveur ou baignoire",
      description:
        "Dépose du receveur de douche ou de la baignoire, y compris habillage.",
      unite: "u",
      prixVente: 120,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_porte_int",
      categorieId: "deposes_unite",
      libelle: "Dépose de porte intérieure",
      description: "Dépose du vantail et de l'huisserie.",
      unite: "u",
      prixVente: 45,
      tva: 10,
      afficheFourniture: false,
    },
    {
      id: "depose_fenetre",
      categorieId: "deposes_unite",
      libelle: "Dépose de fenêtre ou porte-fenêtre",
      description:
        "Dépose de la menuiserie extérieure existante (hors évacuation spécifique).",
      unite: "u",
      prixVente: 75,
      tva: 10,
      afficheFourniture: false,
    },

    // ─── ÉVACUATION (1) ───
    {
      id: "evacuation_benne",
      categorieId: "evacuation",
      libelle: "Évacuation des gravats (benne)",
      description:
        "Location et rotation d'une benne, évacuation et traitement des déchets de chantier.",
      unite: "forfait",
      prixVente: 320,
      tva: 10,
      afficheFourniture: false,
    },
  ],
};
