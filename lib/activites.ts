// ============================================================
// SOCLE — Concept d'activité (métier) & palier d'abonnement
// ------------------------------------------------------------
// Vit HORS de lib/devis/engine/ : l'activité gouverne l'AFFICHAGE
// (quels lots sont proposés à la création), jamais le calcul. Le moteur
// (engine/) n'importe rien d'ici et n'est pas modifié par ce concept.
// Importe uniquement le TYPE LotId — aucune dépendance de valeur au moteur.
// ============================================================

import type { LotId } from "./devis/engine/types";

/** Métier mis en avant pour l'artisan. Extensible (d'autres viendront). */
export type Activite =
  | "placo"
  | "isolation"
  | "peinture"
  | "carrelage"
  | "electricite"
  | "plomberie"
  | "menuiserie"
  | "sols"
  | "cuisine"
  | "demolition";

/** Palier d'abonnement. `mono` = une activité active à la fois ; `illimite` = toutes. */
export type Palier = "mono" | "illimite";

/** Métadonnée d'une activité pour l'UI (sélecteur Paramètres). */
export interface ActiviteMeta {
  id: Activite;
  label: string;
  /** Nom d'icône Tabler (sans le préfixe `ti-`), rendu via `<i className="ti ti-…">`. */
  icon: string;
}

/** Activités, ordre d'affichage. Labels en sentence case, icônes Tabler outline. */
export const ACTIVITES: readonly ActiviteMeta[] = [
  { id: "placo", label: "Plaquiste", icon: "wall" },
  { id: "isolation", label: "Isolation", icon: "temperature-snow" },
  { id: "peinture", label: "Peinture", icon: "brush" },
  { id: "carrelage", label: "Carrelage", icon: "grid-4x4" },
  { id: "electricite", label: "Électricité", icon: "plug" },
  { id: "plomberie", label: "Plomberie", icon: "droplet" },
  { id: "menuiserie", label: "Menuiserie", icon: "door" },
  { id: "sols", label: "Sols & parquet", icon: "wood" },
  { id: "cuisine", label: "Cuisine", icon: "tools-kitchen-2" },
  { id: "demolition", label: "Démolition", icon: "hammer" },
];

/**
 * Rattachement lot → activité(s). Un lot peut relever de plusieurs métiers.
 * Métadonnée d'AFFICHAGE uniquement : ne change ni les segments ni les prix.
 * Couvre les 14 lots existants ; à compléter quand de nouveaux lots arrivent.
 * (Étanchéité : plus un lot — option des lots carrelage/faïence.)
 */
export const ACTIVITE_LOTS: Record<Activite, readonly LotId[]> = {
  placo: ["cloisons", "fauxplafond"],
  isolation: ["iti", "fauxplafond"],
  peinture: ["peinture"],
  carrelage: ["carrelage", "faience", "ragreage"],
  electricite: ["elec"],
  plomberie: ["plombs"],
  menuiserie: ["menus", "menuext"],
  sols: ["parquet", "ragreage"],
  cuisine: ["cuisine"],
  demolition: ["demolition"],
};

/** Tous les lots rattachés à au moins une activité (= univers complet visible en illimité). */
const TOUS_LES_LOTS: ReadonlySet<LotId> = new Set<LotId>(
  Object.values(ACTIVITE_LOTS).flat(),
);

/** Garde de type — utile à la migration (valeur inconnue venant du storage). */
export function isActivite(x: unknown): x is Activite {
  return (
    typeof x === "string" &&
    ACTIVITES.some((a) => a.id === (x as Activite))
  );
}

/**
 * Lots à PROPOSER au picker selon le palier et l'activité active.
 * - `illimite` → tous les lots.
 * - `mono` → lots de l'activité active, UNION des lots déjà actifs du devis
 *   (`lotsActifs`) afin qu'un lot coché sous une autre activité reste visible
 *   et décochable (historique non cassé).
 */
export function lotsVisibles(opts: {
  palier: Palier;
  activiteActive: Activite;
  lotsActifs?: readonly LotId[];
}): Set<LotId> {
  if (opts.palier === "illimite") return new Set(TOUS_LES_LOTS);
  const visibles = new Set<LotId>(ACTIVITE_LOTS[opts.activiteActive]);
  for (const id of opts.lotsActifs ?? []) visibles.add(id);
  return visibles;
}
