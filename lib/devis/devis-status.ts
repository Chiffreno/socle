// ============================================================
// SOCLE — Module Devis — Statuts
// Le statut "expiré" est DÉRIVÉ à l'affichage (un devis envoyé dont la
// date de validité est dépassée). Le statut stocké n'est pas modifié ici ;
// la bascule réelle interviendra à l'étape 8.
// ============================================================

import type { Devis, DevisStatut } from "./types";

export const STATUT_LABEL: Record<DevisStatut, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
  expire: "Expiré",
};

/** Ordre d'affichage des statuts (filtres, etc.). */
export const STATUTS: readonly DevisStatut[] = [
  "brouillon",
  "envoye",
  "signe",
  "refuse",
  "expire",
];

/**
 * Statut effectif (dérivé) : un devis "envoyé" dont la date de validité est
 * passée est considéré "expiré". Les autres statuts sont inchangés.
 */
export function effectiveStatut(
  d: Pick<Devis, "statut" | "dateValidite">
): DevisStatut {
  if (d.statut === "envoye" && d.dateValidite) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dv = new Date(d.dateValidite);
    if (!Number.isNaN(dv.getTime()) && dv < today) return "expire";
  }
  return d.statut;
}
