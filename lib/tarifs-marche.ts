/**
 * Tarifs de référence du marché BTP (PRIX JOUR HT) par métier et zone
 * géographique, pour la brique « Comparaison marché » du module taux horaire.
 *
 * Sources : tarifs moyens constatés du marché 2025-2026. Les valeurs sont
 * stockées en PRIX JOUR (taux horaire de référence × 7 h, base journée figée à
 * la source). Les fourchettes (basse / moyenne / haute) reflètent l'écart
 * expérience/spécialisation/demande ; les coefficients de zone modulent le prix
 * selon la région.
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

/** Prix JOUR HT de référence par métier (€/j), base 7 h figée à la source. */
type TarifMetier = { basse: number; moyenne: number; haute: number };

export const TARIFS_METIERS: Record<Metier, TarifMetier> = {
  macon: { basse: 245, moyenne: 385, haute: 490 },
  plombier: { basse: 280, moyenne: 385, haute: 490 },
  electricien: { basse: 245, moyenne: 350, haute: 455 },
  menuisier: { basse: 280, moyenne: 350, haute: 420 },
  peintre: { basse: 210, moyenne: 280, haute: 350 },
  carreleur: { basse: 245, moyenne: 315, haute: 385 },
  plaquiste: { basse: 245, moyenne: 294, haute: 350 },
  couvreur: { basse: 280, moyenne: 385, haute: 455 },
  facadier: { basse: 245, moyenne: 315, haute: 350 },
  charpentier: { basse: 280, moyenne: 350, haute: 420 },
  chauffagiste: { basse: 315, moyenne: 399, haute: 490 },
  multiservices: { basse: 210, moyenne: 280, haute: 350 },
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
 * Formule : prix jour métier × coefficient de zone, arrondi à l'euro.
 */
export function getFourchetteJour(metier: Metier, zone: Zone): FourchetteJour {
  const tarif = TARIFS_METIERS[metier];
  const coef = COEFS_ZONES[zone];
  const toJour = (j: number) => Math.round(j * coef);
  return {
    basseJour: toJour(tarif.basse),
    moyenneJour: toJour(tarif.moyenne),
    hauteJour: toJour(tarif.haute),
  };
}
