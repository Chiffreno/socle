// ============================================================
// SOCLE — Moteur Devis — Catalogue Électricité (par points)
//
// 17 prestations groupées en 3 catégories (prises / commandes / éclairage).
// Libellés courts (convention « Fourniture et pose de … »), descriptions
// techniques conservées. Retour terrain Benjamin (C1) : catégories multimédia
// et divers retirées, RJ45 rattaché aux prises, prix INCHANGÉS.
//
// C-split : `partFourniturePct` = part matériel INDICATIVE du prixVente, pour
// l'affichage client « Fourniture : X · Pose : Y ». N'altère AUCUN total
// (fourniture + pose = total). Valeurs validées : prises/commandes 35 %,
// points lumineux 30 %, spot LED 45 % — à valider en passe prix.
//
// IMPORTANT : ces prix sont des PRIX DE VENTE FINAUX CLIENT, tout
// compris (fourniture + pose + câblage). Sur le devis :
//   - prixEstFinal = true → aucune marge de lot ni MO ajoutée par le moteur.
//   - afficheFourniture = true (sémantique produit fini) MAIS ignoré à
//     l'affichage tant qu'on n'a pas de split fourniture/pose (MVP).
//
// L'INFRASTRUCTURE élec (tableau, GTL, Consuel, mise à la terre, VMC, réseau)
// n'est PAS dans ce catalogue : elle reste calculée par le moteur ChiffReno
// (matériaux + marge + MO), avec prixEstFinal = false et afficheFourniture
// = false (consommable/réseau).
// ============================================================

import type { PointsCatalogue } from "./points";

export const CATALOGUE_ELEC: PointsCatalogue = {
  lotId: "elec",
  categories: [
    { id: "prises", label: "Prises", defaultOpen: true },
    { id: "commandes", label: "Commandes" },
    { id: "eclairage", label: "Éclairage" },
  ],
  prestations: [
    // ─── PRISES (7, dont RJ45 rattaché) — part fourniture 35 % ───
    {
      id: "prise_simple_16a",
      categorieId: "prises",
      libelle: "Fourniture et pose de PC simple 16 A",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 126.7,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_em_20a",
      categorieId: "prises",
      libelle: "Fourniture et pose de PC 20 A électroménager",
      description: "Compris : câblage 2,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 134.81,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_plaque_32a",
      categorieId: "prises",
      libelle: "Fourniture et pose de PC 32 A plaque de cuisson",
      description: "Compris : câblage 6 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 174.23,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_double",
      categorieId: "prises",
      libelle: "Fourniture et pose de PC double",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 140.79,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_triple",
      categorieId: "prises",
      libelle: "Fourniture et pose de PC triple",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 148.92,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "sortie_cable_radiateur",
      categorieId: "prises",
      libelle: "Fourniture et pose de sortie de câble (radiateur / chauffe-eau)",
      description: "Compris : câblage 2,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 135.85,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_rj45",
      categorieId: "prises",
      libelle: "Fourniture et pose de prise RJ45",
      description:
        "Câble de catégorie 6 blindée. Raccordement au tableau de communication.",
      unite: "u",
      prixVente: 162.45,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },

    // ─── COMMANDES (7) — part fourniture 35 % ───
    {
      id: "interrupteur_simple",
      categorieId: "commandes",
      libelle: "Fourniture et pose d'interrupteur simple",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 127.35,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "bp_simple",
      categorieId: "commandes",
      libelle: "Fourniture et pose de bouton poussoir simple",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 137.1,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "va_et_vient",
      categorieId: "commandes",
      libelle: "Fourniture et pose de va-et-vient",
      description:
        "Compris : 2 appareillages, câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 190.35,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "interrupteur_double",
      categorieId: "commandes",
      libelle: "Fourniture et pose d'interrupteur double",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 159.69,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "bp_double",
      categorieId: "commandes",
      libelle: "Fourniture et pose de bouton poussoir double",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 166.45,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "va_et_vient_double",
      categorieId: "commandes",
      libelle: "Fourniture et pose de double va-et-vient",
      description:
        "Compris : 2 appareillages, câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 240.73,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "variateur_2_fils",
      categorieId: "commandes",
      libelle: "Fourniture et pose de variateur 2 fils",
      description:
        "Le variateur permet de moduler l'intensité d'un éclairage. Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 173.5,
      partFourniturePct: 35,
      tva: 10,
      afficheFourniture: true,
    },

    // ─── ÉCLAIRAGE (3) — points lumineux 30 %, spot LED 45 % ───
    {
      id: "point_mural",
      categorieId: "eclairage",
      libelle: "Fourniture et pose de point lumineux mural (applique)",
      description:
        "Passage des câbles dans les faux-plafonds, saignées, et/ou fourreaux existants. Compris : câblage 1,5 mm² du point au tableau, boitier DCL.",
      unite: "u",
      prixVente: 126.09,
      partFourniturePct: 30,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "point_plafond",
      categorieId: "eclairage",
      libelle: "Fourniture et pose de point lumineux au plafond",
      description:
        "Passage des câbles dans les faux-plafonds, saignées, et/ou fourreaux existants. Compris : câblage 1,5 mm² du point au tableau boitier DCL.",
      unite: "u",
      prixVente: 126.09,
      partFourniturePct: 30,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "spot_led",
      categorieId: "eclairage",
      libelle: "Fourniture et pose de spot LED encastré",
      description:
        "Épaisseur minimum des faux-plafonds : 5 cm. Compris : câblage 1,5 mm² du spot au tableau.",
      unite: "u",
      prixVente: 73.89,
      partFourniturePct: 45,
      tva: 10,
      afficheFourniture: true,
    },
  ],
};
