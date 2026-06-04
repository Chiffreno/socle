/**
 * Tarifs de référence du marché BTP (taux horaires HT) par métier et zone
 * géographique, pour la brique « Comparaison marché » du module taux horaire.
 *
 * Sources : tarifs moyens constatés du marché 2025-2026. Les fourchettes
 * (basse / moyenne / haute) reflètent l'écart expérience/spécialisation/demande ;
 * les coefficients de zone modulent le prix selon la région.
 *
 * Ces données sont indicatives — voir la mention de prudence affichée sous la
 * comparaison dans l'interface.
 */

export type Metier =
  | "macon"
  | "plombier"
  | "electricien"
  | "menuisier"
  | "peintre"
  | "carreleur"
  | "plaquiste"
  | "couvreur"
  | "facadier"
  | "charpentier"
  | "chauffagiste"
  | "multiservices";

export type Zone =
  | "paris_idf"
  | "cote_azur"
  | "metropoles"
  | "bretagne"
  | "province"
  | "rurale";

/** Taux horaires HT de référence par métier (€/h). */
type TauxMetier = { basse: number; moyenne: number; haute: number };

export const TARIFS_METIERS: Record<Metier, TauxMetier> = {
  macon: { basse: 35, moyenne: 55, haute: 70 },
  plombier: { basse: 40, moyenne: 55, haute: 70 },
  electricien: { basse: 35, moyenne: 50, haute: 65 },
  menuisier: { basse: 40, moyenne: 50, haute: 60 },
  peintre: { basse: 30, moyenne: 40, haute: 50 },
  carreleur: { basse: 35, moyenne: 45, haute: 55 },
  plaquiste: { basse: 35, moyenne: 42, haute: 50 },
  couvreur: { basse: 40, moyenne: 55, haute: 65 },
  facadier: { basse: 35, moyenne: 45, haute: 50 },
  charpentier: { basse: 40, moyenne: 50, haute: 60 },
  chauffagiste: { basse: 45, moyenne: 57, haute: 70 },
  multiservices: { basse: 30, moyenne: 40, haute: 50 },
};

/** Coefficient multiplicateur du prix selon la zone géographique. */
export const COEFS_ZONES: Record<Zone, number> = {
  paris_idf: 1.2,
  cote_azur: 1.15,
  metropoles: 1.07,
  bretagne: 1.0,
  province: 0.93,
  rurale: 0.85,
};

/** Libellés français lisibles, dans l'ordre d'affichage. */
export const METIER_LABELS: Record<Metier, string> = {
  macon: "Maçon",
  plombier: "Plombier",
  electricien: "Électricien",
  menuisier: "Menuisier",
  peintre: "Peintre",
  carreleur: "Carreleur",
  plaquiste: "Plaquiste",
  couvreur: "Couvreur",
  facadier: "Façadier",
  charpentier: "Charpentier",
  chauffagiste: "Chauffagiste",
  multiservices: "Multiservices / homme toutes mains",
};

export const ZONE_LABELS: Record<Zone, string> = {
  paris_idf: "Paris / Île-de-France",
  cote_azur: "Côte d'Azur",
  metropoles: "Grandes métropoles",
  bretagne: "Bretagne",
  province: "Province",
  rurale: "Zone rurale",
};

/** Ordre d'affichage des sélecteurs. */
export const METIERS: Metier[] = Object.keys(METIER_LABELS) as Metier[];
export const ZONES: Zone[] = Object.keys(ZONE_LABELS) as Zone[];

export type FourchetteJour = {
  basseJour: number;
  moyenneJour: number;
  hauteJour: number;
};

/**
 * Prix jour de référence du marché pour un métier + zone donnés.
 * Formule : taux horaire × coefficient de zone × heures facturables,
 * arrondi à l'euro.
 */
export function getFourchetteJour(
  metier: Metier,
  zone: Zone,
  heuresFacturables = 7
): FourchetteJour {
  const taux = TARIFS_METIERS[metier];
  const coef = COEFS_ZONES[zone];
  const toJour = (h: number) => Math.round(h * coef * heuresFacturables);
  return {
    basseJour: toJour(taux.basse),
    moyenneJour: toJour(taux.moyenne),
    hauteJour: toJour(taux.haute),
  };
}
