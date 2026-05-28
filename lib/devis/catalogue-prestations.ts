// ============================================================
// SOCLE — Module Devis — Catalogue de prestations (statique, MVP)
// ~38 prestations courantes, 8 corps d'état. Au clic [+] dans la
// bibliothèque, la prestation est ajoutée au devis avec ses valeurs par défaut.
//
// ⚠️ Les prixUnitaireIndicatif sont des ordres de grandeur à valider/ajuster.
// Pas de wizards Héméa (couches 2/3) en MVP : [+] = ajout direct.
// ============================================================

import type { TauxTVA, Unite } from "./types";

export interface Prestation {
  id: string;
  corpsEtat: string;
  categorie: string;
  libelle: string;
  uniteParDefaut: Unite;
  prixUnitaireIndicatif: number;
  tvaParDefaut: TauxTVA;
}

/** Ordre d'affichage des corps d'état dans la bibliothèque. */
export const CORPS_ETAT_ORDER: readonly string[] = [
  "Installation",
  "Démolition",
  "Plâtrerie & ITI",
  "Plomberie",
  "Électricité",
  "Revêtement sol",
  "Revêtement mur",
  "Menuiseries",
];

export const CATALOGUE_PRESTATIONS: Prestation[] = [
  // ── Installation (4) ──
  { id: "inst-protection-sols", corpsEtat: "Installation", categorie: "Préparation", libelle: "Protection des sols (film + carton fort)", uniteParDefaut: "m2", prixUnitaireIndicatif: 4, tvaParDefaut: 10 },
  { id: "inst-repli", corpsEtat: "Installation", categorie: "Préparation", libelle: "Installation et repli de chantier", uniteParDefaut: "forfait", prixUnitaireIndicatif: 350, tvaParDefaut: 10 },
  { id: "inst-benne", corpsEtat: "Installation", categorie: "Déchets", libelle: "Location benne à gravats 10 m³", uniteParDefaut: "u", prixUnitaireIndicatif: 320, tvaParDefaut: 10 },
  { id: "inst-protection-pc", corpsEtat: "Installation", categorie: "Préparation", libelle: "Protection ascenseur / parties communes", uniteParDefaut: "forfait", prixUnitaireIndicatif: 180, tvaParDefaut: 10 },

  // ── Démolition (5) ──
  { id: "demo-carrelage-sol", corpsEtat: "Démolition", categorie: "Dépose", libelle: "Dépose de carrelage au sol", uniteParDefaut: "m2", prixUnitaireIndicatif: 22, tvaParDefaut: 10 },
  { id: "demo-cloison-maconnee", corpsEtat: "Démolition", categorie: "Démolition", libelle: "Démolition de cloison maçonnée", uniteParDefaut: "m2", prixUnitaireIndicatif: 38, tvaParDefaut: 10 },
  { id: "demo-cloison-placo", corpsEtat: "Démolition", categorie: "Dépose", libelle: "Dépose de cloison placo", uniteParDefaut: "m2", prixUnitaireIndicatif: 12, tvaParDefaut: 10 },
  { id: "demo-evac-gravats", corpsEtat: "Démolition", categorie: "Déchets", libelle: "Évacuation des gravats (par benne)", uniteParDefaut: "u", prixUnitaireIndicatif: 280, tvaParDefaut: 10 },
  { id: "demo-depose-sanitaires", corpsEtat: "Démolition", categorie: "Dépose", libelle: "Dépose de sanitaires (WC / lavabo)", uniteParDefaut: "u", prixUnitaireIndicatif: 45, tvaParDefaut: 10 },

  // ── Plâtrerie & ITI (6) ──
  { id: "platr-cloison-ba13", corpsEtat: "Plâtrerie & ITI", categorie: "Cloisonnement", libelle: "Cloison placo BA13 + isolant laine minérale 45 mm", uniteParDefaut: "m2", prixUnitaireIndicatif: 65, tvaParDefaut: 10 },
  { id: "platr-doublage-pse", corpsEtat: "Plâtrerie & ITI", categorie: "Isolation", libelle: "Doublage collé placo + polystyrène 80 mm (ITI)", uniteParDefaut: "m2", prixUnitaireIndicatif: 58, tvaParDefaut: 5.5 },
  { id: "platr-faux-plafond", corpsEtat: "Plâtrerie & ITI", categorie: "Plafond", libelle: "Faux plafond placo BA13 sur ossature", uniteParDefaut: "m2", prixUnitaireIndicatif: 48, tvaParDefaut: 10 },
  { id: "platr-doublage-ossature", corpsEtat: "Plâtrerie & ITI", categorie: "Isolation", libelle: "Doublage sur ossature + laine minérale 100 mm (ITI)", uniteParDefaut: "m2", prixUnitaireIndicatif: 72, tvaParDefaut: 5.5 },
  { id: "platr-coffrage", corpsEtat: "Plâtrerie & ITI", categorie: "Habillage", libelle: "Habillage / coffrage placo", uniteParDefaut: "ml", prixUnitaireIndicatif: 35, tvaParDefaut: 10 },
  { id: "platr-bande-enduit", corpsEtat: "Plâtrerie & ITI", categorie: "Finition", libelle: "Bande et enduit de finition", uniteParDefaut: "m2", prixUnitaireIndicatif: 12, tvaParDefaut: 10 },

  // ── Plomberie (5) ──
  { id: "plomb-alim-eau", corpsEtat: "Plomberie", categorie: "Réseau", libelle: "Alimentation eau (par point)", uniteParDefaut: "u", prixUnitaireIndicatif: 180, tvaParDefaut: 10 },
  { id: "plomb-evacuation", corpsEtat: "Plomberie", categorie: "Réseau", libelle: "Évacuation PVC (par point)", uniteParDefaut: "u", prixUnitaireIndicatif: 150, tvaParDefaut: 10 },
  { id: "plomb-douche", corpsEtat: "Plomberie", categorie: "Sanitaire", libelle: "Douche complète (receveur + paroi + mitigeur)", uniteParDefaut: "forfait", prixUnitaireIndicatif: 1450, tvaParDefaut: 10 },
  { id: "plomb-wc-suspendu", corpsEtat: "Plomberie", categorie: "Sanitaire", libelle: "Pose WC suspendu (bâti-support inclus)", uniteParDefaut: "u", prixUnitaireIndicatif: 520, tvaParDefaut: 10 },
  { id: "plomb-lavabo", corpsEtat: "Plomberie", categorie: "Sanitaire", libelle: "Pose lavabo / vasque + robinetterie", uniteParDefaut: "u", prixUnitaireIndicatif: 280, tvaParDefaut: 10 },

  // ── Électricité (5) ──
  { id: "elec-tableau", corpsEtat: "Électricité", categorie: "Tableau", libelle: "Tableau électrique (remplacement)", uniteParDefaut: "forfait", prixUnitaireIndicatif: 850, tvaParDefaut: 10 },
  { id: "elec-point-lumineux", corpsEtat: "Électricité", categorie: "Appareillage", libelle: "Point lumineux (pose + raccordement)", uniteParDefaut: "u", prixUnitaireIndicatif: 85, tvaParDefaut: 10 },
  { id: "elec-prise", corpsEtat: "Électricité", categorie: "Appareillage", libelle: "Prise de courant 16 A", uniteParDefaut: "u", prixUnitaireIndicatif: 65, tvaParDefaut: 10 },
  { id: "elec-interrupteur", corpsEtat: "Électricité", categorie: "Appareillage", libelle: "Interrupteur / va-et-vient", uniteParDefaut: "u", prixUnitaireIndicatif: 55, tvaParDefaut: 10 },
  { id: "elec-mise-aux-normes", corpsEtat: "Électricité", categorie: "Tableau", libelle: "Mise aux normes tableau + différentiel", uniteParDefaut: "forfait", prixUnitaireIndicatif: 480, tvaParDefaut: 10 },

  // ── Revêtement sol (5) ──
  { id: "sol-carrelage", corpsEtat: "Revêtement sol", categorie: "Carrelage", libelle: "Carrelage sol grès cérame (fourniture + pose)", uniteParDefaut: "m2", prixUnitaireIndicatif: 55, tvaParDefaut: 10 },
  { id: "sol-parquet", corpsEtat: "Revêtement sol", categorie: "Parquet", libelle: "Parquet contrecollé (pose flottante)", uniteParDefaut: "m2", prixUnitaireIndicatif: 48, tvaParDefaut: 10 },
  { id: "sol-plinthes", corpsEtat: "Revêtement sol", categorie: "Finition", libelle: "Plinthes (pose)", uniteParDefaut: "ml", prixUnitaireIndicatif: 14, tvaParDefaut: 10 },
  { id: "sol-ragreage", corpsEtat: "Revêtement sol", categorie: "Préparation", libelle: "Ragréage sol autolissant", uniteParDefaut: "m2", prixUnitaireIndicatif: 18, tvaParDefaut: 10 },
  { id: "sol-pvc", corpsEtat: "Revêtement sol", categorie: "Souple", libelle: "Sol PVC / lino en lés", uniteParDefaut: "m2", prixUnitaireIndicatif: 32, tvaParDefaut: 10 },

  // ── Revêtement mur (5) ──
  { id: "mur-peinture", corpsEtat: "Revêtement mur", categorie: "Peinture", libelle: "Peinture murs et plafonds (2 couches)", uniteParDefaut: "m2", prixUnitaireIndicatif: 28, tvaParDefaut: 10 },
  { id: "mur-faience", corpsEtat: "Revêtement mur", categorie: "Faïence", libelle: "Faïence murale (fourniture + pose)", uniteParDefaut: "m2", prixUnitaireIndicatif: 62, tvaParDefaut: 10 },
  { id: "mur-enduit", corpsEtat: "Revêtement mur", categorie: "Préparation", libelle: "Enduit de lissage sur murs", uniteParDefaut: "m2", prixUnitaireIndicatif: 16, tvaParDefaut: 10 },
  { id: "mur-toile-verre", corpsEtat: "Revêtement mur", categorie: "Peinture", libelle: "Toile de verre + peinture", uniteParDefaut: "m2", prixUnitaireIndicatif: 26, tvaParDefaut: 10 },
  { id: "mur-rebouchage", corpsEtat: "Revêtement mur", categorie: "Préparation", libelle: "Préparation / rebouchage avant peinture", uniteParDefaut: "m2", prixUnitaireIndicatif: 10, tvaParDefaut: 10 },

  // ── Menuiseries (3) ──
  { id: "menu-porte-int", corpsEtat: "Menuiseries", categorie: "Intérieure", libelle: "Porte intérieure (bloc-porte + pose)", uniteParDefaut: "u", prixUnitaireIndicatif: 320, tvaParDefaut: 10 },
  { id: "menu-fenetre-pvc", corpsEtat: "Menuiseries", categorie: "Extérieure", libelle: "Fenêtre PVC double vitrage (dépose + pose)", uniteParDefaut: "u", prixUnitaireIndicatif: 680, tvaParDefaut: 5.5 },
  { id: "menu-volet-roulant", corpsEtat: "Menuiseries", categorie: "Extérieure", libelle: "Volet roulant (pose)", uniteParDefaut: "u", prixUnitaireIndicatif: 420, tvaParDefaut: 10 },
];

// ── Helpers ──
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export interface CorpsEtatGroupe {
  corpsEtat: string;
  prestations: Prestation[];
}

/** Regroupe par corps d'état dans l'ordre CORPS_ETAT_ORDER (groupes non vides). */
export function groupByCorpsEtat(
  liste: Prestation[] = CATALOGUE_PRESTATIONS
): CorpsEtatGroupe[] {
  const groupes: CorpsEtatGroupe[] = [];
  for (const corpsEtat of CORPS_ETAT_ORDER) {
    const prestations = liste.filter((p) => p.corpsEtat === corpsEtat);
    if (prestations.length > 0) groupes.push({ corpsEtat, prestations });
  }
  // Corps d'état hors ordre connu (sécurité) :
  for (const p of liste) {
    if (
      !CORPS_ETAT_ORDER.includes(p.corpsEtat) &&
      !groupes.some((g) => g.corpsEtat === p.corpsEtat)
    ) {
      groupes.push({
        corpsEtat: p.corpsEtat,
        prestations: liste.filter((x) => x.corpsEtat === p.corpsEtat),
      });
    }
  }
  return groupes;
}

/** Recherche full-text (insensible casse/accents) sur libellé, catégorie, corps d'état. */
export function searchPrestations(query: string): Prestation[] {
  const q = normalize(query.trim());
  if (!q) return CATALOGUE_PRESTATIONS;
  return CATALOGUE_PRESTATIONS.filter((p) =>
    normalize(`${p.libelle} ${p.categorie} ${p.corpsEtat}`).includes(q)
  );
}
