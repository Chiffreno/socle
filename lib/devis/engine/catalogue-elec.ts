// ============================================================
// SOCLE — Moteur Devis — Catalogue Électricité (par points)
//
// 31 prestations groupées en 5 catégories. Libellés et descriptions
// repris du CSV de référence (Héméa-like).
//
// IMPORTANT : ces prix sont des PRIX DE VENTE FINAUX CLIENT, tout
// compris (fourniture + pose + câblage). Sur le devis :
//   - prixEstFinal = true → aucune marge de lot ni MO ajoutée par le moteur.
//   - afficheFourniture = true (sémantique produit fini) MAIS ignoré à
//     l'affichage tant qu'on n'a pas de split fourniture/pose (MVP).
//
// L'INFRASTRUCTURE élec (tableau, GTL, Consuel, mise à la terre, VMC)
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
    { id: "multimedia", label: "Multimédia / Courants faibles" },
    { id: "divers", label: "Divers" },
  ],
  prestations: [
    // ─── PRISES (6) ───
    {
      id: "prise_simple_16a",
      categorieId: "prises",
      libelle: "Fourniture et pose de prise de courant simple 16 A",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 126.7,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_em_20a",
      categorieId: "prises",
      libelle:
        "Fourniture et pose de prise de courant 20 A pour électroménager (four, lave-linge, lave-vaisselle, réfrigérateur, micro-ondes)",
      description: "Compris : câblage 2,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 134.81,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_plaque_32a",
      categorieId: "prises",
      libelle: "Fourniture et pose de prise de courant 32 A pour plaque de cuisson",
      description: "Compris : câblage 6 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 174.23,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_double",
      categorieId: "prises",
      libelle: "Fourniture et pose de prise de courant double",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 140.79,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_triple",
      categorieId: "prises",
      libelle: "Fourniture et pose de prise de courant triple",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 148.92,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "sortie_cable_radiateur",
      categorieId: "prises",
      libelle:
        "Fourniture et pose de sortie de câble pour radiateur électrique ou chauffe-eau",
      description: "Compris : câblage 2,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 135.85,
      tva: 10,
      afficheFourniture: true,
    },

    // ─── COMMANDES (9) ───
    {
      id: "interrupteur_simple",
      categorieId: "commandes",
      libelle: "Fourniture et pose d'interrupteur simple",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 127.35,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "bp_simple",
      categorieId: "commandes",
      libelle:
        "Fourniture et pose de bouton poussoir simple (plus de 2 interrupteurs pour 1 point lumineux)",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 137.1,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "va_et_vient",
      categorieId: "commandes",
      libelle: "Fourniture et pose de système d'interrupteur va-et-vient",
      description:
        "Compris : 2 appareillages, câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 190.35,
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
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "bp_double",
      categorieId: "commandes",
      libelle:
        "Fourniture et pose de bouton poussoir double (plus de 2 interrupteurs pour 1 point lumineux)",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 166.45,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "va_et_vient_double",
      categorieId: "commandes",
      libelle: "Fourniture et pose de système d'interrupteur double va-et-vient",
      description:
        "Compris : 2 appareillages, câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 240.73,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "sonnette",
      categorieId: "commandes",
      libelle: "Fourniture et pose de sonnette",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 144.2,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "variateur_2_fils",
      categorieId: "commandes",
      libelle: "Fourniture et pose de variateur 2 fils sans neutre",
      description:
        "Le variateur permet de moduler l'intensité d'un éclairage. Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 173.5,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "inter_a_cle",
      categorieId: "commandes",
      libelle: "Fourniture et pose d'un interrupteur à clé",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 267.1,
      tva: 10,
      afficheFourniture: true,
    },

    // ─── ÉCLAIRAGE (6) ───
    {
      id: "point_mural",
      categorieId: "eclairage",
      libelle:
        "Création de point lumineux au mur (applique murale) en réseau encastré",
      description:
        "Passage des câbles dans les faux-plafonds, saignées, et/ou fourreaux existants. Compris : câblage 1,5 mm² du point au tableau, boitier DCL.",
      unite: "u",
      prixVente: 126.09,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "point_plafond",
      categorieId: "eclairage",
      libelle:
        "Création de point lumineux au plafond (plafonnier) en réseau encastré",
      description:
        "Passage des câbles dans les faux-plafonds, saignées, et/ou fourreaux existants. Compris : câblage 1,5 mm² du point au tableau boitier DCL.",
      unite: "u",
      prixVente: 126.09,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "spot_led",
      categorieId: "eclairage",
      libelle: "Fourniture et pose de spot LED à encastrer dans les faux-plafonds",
      description:
        "Épaisseur minimum des faux-plafonds : 5 cm. Compris : câblage 1,5 mm² du spot au tableau.",
      unite: "u",
      prixVente: 73.89,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "spot_led_orientable",
      categorieId: "eclairage",
      libelle:
        "Fourniture et pose de spot LED orientable à encastrer dans les faux-plafonds",
      description:
        "Épaisseur minimum des faux-plafonds : 5 cm. Compris : câblage 1,5 mm² du spot au tableau.",
      unite: "u",
      prixVente: 75.19,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "spot_led_etanche",
      categorieId: "eclairage",
      libelle:
        "Fourniture et pose de spot LED étanche à encastrer dans les faux-plafonds",
      description:
        "Spot LED IP44 : protection pour les pièces humides. Épaisseur minimum des faux-plafonds : 5 cm. Compris : câblage 1,5 mm² du spot au tableau.",
      unite: "u",
      prixVente: 85.59,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "spot_led_etanche_orientable",
      categorieId: "eclairage",
      libelle:
        "Fourniture et pose de spot LED étanche orientable à encastrer dans les faux-plafonds",
      description:
        "Spot LED IP44 : protection pour les pièces humides. Épaisseur minimum des faux-plafonds : 5 cm. Compris : câblage 1,5 mm² du spot au tableau.",
      unite: "u",
      prixVente: 95.99,
      tva: 10,
      afficheFourniture: true,
    },

    // ─── MULTIMÉDIA / COURANTS FAIBLES (8) ───
    {
      id: "prise_tel",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de prise téléphone",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 144.9,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_tv",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de prise TV",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 137.1,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_hp_simple",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de prise haut-parleur simple",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 141.0,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_hp_double",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de prise haut-parleur double",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 147.5,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_hdmi",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de prise HDMI",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 202.1,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "chargeur_usb_a_double",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de double chargeur USB Type A",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 160.5,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "chargeur_usb_ac_double",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de double chargeur USB Type A et C",
      description: "Compris : câblage 1,5 mm² de la prise au tableau.",
      unite: "u",
      prixVente: 163.1,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "prise_rj45",
      categorieId: "multimedia",
      libelle: "Fourniture et pose de prise RJ45 (Ethernet)",
      description:
        "Câble de catégorie 6 blindée. Raccordement au tableau de communication.",
      unite: "u",
      prixVente: 162.45,
      tva: 10,
      afficheFourniture: true,
    },

    // ─── DIVERS (2) ───
    {
      id: "liaison_equipotentielle",
      categorieId: "divers",
      libelle: "Fourniture et pose de liaison équipotentielle par élément",
      description:
        "Protection des éléments métalliques (baignoire, chauffe-eau, menuiseries extérieures alu, huisseries métalliques de porte etc.) par mise à la terre.",
      unite: "u",
      prixVente: 39.39,
      tva: 10,
      afficheFourniture: true,
    },
    {
      id: "detecteur_presence",
      categorieId: "divers",
      libelle: "Fourniture et pose de détecteur de présence",
      description: "",
      unite: "u",
      prixVente: 208.44,
      tva: 10,
      afficheFourniture: true,
    },
  ],
};
