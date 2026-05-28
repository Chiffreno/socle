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

/** Une prestation "par point" — fourniture+pose à prix unitaire fixe. */
export interface PointPrestation {
  id: string;
  /** Référence à une PointCategorie du même catalogue (pour le regroupement UI). */
  categorieId: string;
  libelle: string;
  description: string;
  unite: Unite;
  /** Prix de vente FINAL au client, tout compris (fourniture + pose + câblage). */
  prixVente: number;
  tva: TauxTVA;
  /**
   * Sémantiquement true pour un produit fini reconnaissable par le client.
   * À l'affichage : ignoré si la ligne générée a prixEstFinal=true (pas de
   * split fourniture/pose disponible sur un tarif monolithique).
   */
  afficheFourniture: boolean;
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
