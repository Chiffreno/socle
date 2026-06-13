// ============================================================
// SOCLE — Moteur Devis — Catalogues "par points"
//
// Une prestation "par point" = fourniture+pose à prix unitaire fixe,
// publié comme tarif catalogue. L'artisan saisit une quantité ; chaque
// point > 0 génère une ligne sur le devis avec prixEstFinal=true
// (aucune marge ni MO ajoutée par le moteur).
//
// Types génériques : utilisés pour le catalogue Élec (31 prestations)
// et réutilisables tels quels pour le futur catalogue Plomberie.
// ============================================================

import type { TauxTVA, Unite } from "../types";

/**
 * Une prestation à prix unitaire ferme — fourniture+pose (élec), pose seule
 * (démolition), forfait, etc. Le prix est monolithique : prixEstFinal=true
 * sur la ligne générée, aucune marge ni MO ajoutée par le moteur.
 */
export interface PointPrestation {
  id: string;
  /** Référence à une PointCategorie du même catalogue (pour le regroupement UI). */
  categorieId: string;
  libelle: string;
  description: string;
  /** Unité de la prestation : "u" (point), "m2", "ml", "forfait", etc. */
  unite: Unite;
  /** Prix de vente FINAL au client, tout compris pour la prestation. */
  prixVente: number;
  /** Part fourniture (matériel) en % du prixVente — INDICATIVE, à valider en
   *  passe prix. Sert à l'affichage client « Fourniture : X · Pose : Y » :
   *  fourniture = total × pct/100, pose = total − fourniture (Σ inchangée).
   *  Absente → pas de décomposition affichée pour cette prestation. */
  partFourniturePct?: number;
  tva: TauxTVA;
  /**
   * Sémantiquement true pour un produit fini reconnaissable par le client
   * (élec). À l'affichage : ignoré si la ligne générée a prixEstFinal=true
   * (prix monolithique, pas de split fourniture/pose disponible).
   * Pour la démolition (100% pose) : false partout.
   */
  afficheFourniture: boolean;
}

/** Override PONCTUEL d'un point sur UN devis (lot.o.pointsOverride[prestationId]).
 *  N'altère JAMAIS le catalogue global. `pu` absent → prixVente catalogue ;
 *  `lbl` absent → libellé catalogue. Override prix/libellé CLIENT (pas interne). */
export interface PointOverride {
  pu?: number;
  lbl?: string;
}

/** Catégorie d'un catalogue de points (regroupement UI, sections repliables). */
export interface PointCategorie {
  id: string;
  label: string;
  /** true → section déployée par défaut dans le configurateur. */
  defaultOpen?: boolean;
}

/** Catalogue de prestations "par point" attaché à un lot. */
export interface PointsCatalogue {
  /** ID du lot consommateur (ex. 'elec', 'plombs'). */
  lotId: string;
  categories: PointCategorie[];
  prestations: PointPrestation[];
}

// ─── Helpers ───

/** Regroupe les prestations par catégorie, dans l'ordre des catégories. */
export function groupByCategorie(
  cat: PointsCatalogue
): Array<{ categorie: PointCategorie; prestations: PointPrestation[] }> {
  return cat.categories.map((c) => ({
    categorie: c,
    prestations: cat.prestations.filter((p) => p.categorieId === c.id),
  }));
}

/** Recherche d'une prestation par id (utilisé par le moteur de calcul). */
export function findPrestation(
  cat: PointsCatalogue,
  id: string
): PointPrestation | null {
  return cat.prestations.find((p) => p.id === id) ?? null;
}
