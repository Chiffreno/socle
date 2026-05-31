// ============================================================
// SOCLE — Moteur Devis — Agrégation lignes client (BRIQUE 1)
//
// Couche AU-DESSUS du moteur : transforme les EngineLigne détaillées
// (plaques, rails, montants, visserie, bandes, enduit…) en LIGNES CLIENT
// synthétiques — une par PRESTATION (approche A2). Ne touche PAS au moteur
// de calcul (calc-items / totals) : on se contente de REGROUPER des
// `lineCA` déjà ventilés (même math que l'aperçu), pas de nouveau calcul.
//
// Trois niveaux du modèle cible :
//   1. Configurateur          → Brique 2 (plus tard)
//   2. Ligne client agrégée   → CE fichier (LigneClient)
//   3. Détail interne         → LigneClient.detailInterne = EngineLigne brutes
//                               (liste de courses / ChiffReno ; jamais montré client)
//
// Périmètre Brique 1 : lot pilote `cloisons` uniquement. Les autres lots
// renvoient `null` → le rendu legacy (ligne à ligne) est conservé.
// ============================================================

import type { EngineLigne, EngineState, LotId } from "./types";
import { round2, type LotTotaux } from "./totals";

/** Ligne synthétique présentée au client (niveau 2). */
export interface LigneClient {
  /** Clé de la ligne hl source (ex. "ba13_std") — identité de la prestation. */
  prestationKey: string;
  /** Libellé commercial ("Fourniture et pose de …"), distinct du technique. */
  libelleCommercial: string;
  /** Libellé technique du moteur (ligne hl) — traçabilité interne. */
  libelleTechnique: string;
  /** Quantité commerciale (surface posée) + unité. */
  qty: number;
  unit: string;
  /** Prix de vente client de la prestation = Σ lineCA du groupe (caLot ventilé). */
  prixClient: number;
  /** prixClient / qty — €/u lisible. */
  prixUnitaireClient: number;
  /** Taux TVA de la prestation (repris de la ligne hl — homogène dans la zone). */
  tva: number;
  /** Sous-ligne "dont fourniture" pertinente ? (false pour cloisons — lot non produit-fini.) */
  afficheFourniture: boolean;
  dontFourniture?: number;
  /** Niveau 3 — EngineLigne brutes regroupées sous cette prestation. */
  detailInterne: EngineLigne[];
}

/**
 * CA client d'une ligne — identique à la ventilation de l'aperçu :
 * prix ferme → tel quel ; déboursé → distribué via coefDeboursé.
 */
function lineCA(l: EngineLigne, coefDeboursé: number): number {
  return l.prixEstFinal ? l.total : l.total * coefDeboursé;
}

// ════════════════════════════════════════════════════════════
// STRATÉGIE CLOISONS
// ════════════════════════════════════════════════════════════
//
// Regroupement par `groupId` (Brique 2) : calc-items tague chaque ligne d'une
// zone avec son `groupId` (= z.key : "std"/"hydro"/"hd"/"feu"). On rattache
// donc consommables ↔ prestation sur cet identifiant STABLE — plus aucun
// parsing de libellé (dette Brique 1 soldée). La table ci-dessous ne déclare
// plus que le mapping zone → libellé commercial + clé de surface posée.
//
// La surface posée (quantité client) vient d'une donnée stable :
// `state.lots.cloisons.o[<zone>_m2]` (config).
const CLOISONS_ZONES: ReadonlyArray<{
  groupId: string;
  m2Key: string;
  commercial: string;
}> = [
  { groupId: "std", m2Key: "std_m2", commercial: "Fourniture et pose de cloison BA13 / placostil — standard" },
  { groupId: "hydro", m2Key: "hydro_m2", commercial: "Fourniture et pose de cloison BA13 hydrofuge / placostil" },
  { groupId: "hd", m2Key: "hd_m2", commercial: "Fourniture et pose de cloison BA13 haute dureté / placostil" },
  { groupId: "feu", m2Key: "feu_m2", commercial: "Fourniture et pose de cloison BA13 coupe-feu / placostil" },
];

function agregerCloisons(state: EngineState, lt: LotTotaux): LigneClient[] {
  const { items, deboursé, caDeboursé } = lt;
  const coefDeboursé = deboursé > 0 ? caDeboursé / deboursé : 0;
  const o = state.lots[lt.lotId].o;
  const lignes: LigneClient[] = [];

  for (const zone of CLOISONS_ZONES) {
    // Rattachement par groupId stable (posé par calc-items) — plus de parsing.
    const groupe = items.filter((l) => l.groupId === zone.groupId);
    if (groupe.length === 0) continue;

    const hl = groupe.find((l) => l.hl) ?? groupe[0];
    const prixClient = round2(
      groupe.reduce((acc, l) => acc + lineCA(l, coefDeboursé), 0)
    );
    // Quantité client = surface posée (donnée stable, pas le brut plaques).
    const surfacePosee = Number(o[zone.m2Key]) || 0;
    const qty = surfacePosee > 0 ? surfacePosee : hl.qty;

    lignes.push({
      prestationKey: hl.key,
      libelleCommercial: zone.commercial,
      libelleTechnique: hl.lbl,
      qty,
      unit: "m²",
      prixClient,
      prixUnitaireClient: qty > 0 ? round2(prixClient / qty) : 0,
      tva: hl.tva ?? state.tvaParDefaut,
      afficheFourniture: false, // cloisons ∉ LOTS_PRODUIT_FINI
      detailInterne: groupe,
    });
  }
  return lignes;
}

// ════════════════════════════════════════════════════════════
// Registre par lot — Brique 1 : cloisons uniquement.
// ════════════════════════════════════════════════════════════
const STRATEGIES: Partial<
  Record<LotId, (state: EngineState, lt: LotTotaux) => LigneClient[]>
> = {
  cloisons: agregerCloisons,
};

/**
 * Agrège les lignes d'un lot en lignes client.
 * @returns LigneClient[] si le lot a une stratégie (cloisons), sinon `null`
 *          → l'appelant conserve le rendu legacy ligne-à-ligne.
 */
export function agregerLignesClient(
  state: EngineState,
  lt: LotTotaux
): LigneClient[] | null {
  const strat = STRATEGIES[lt.lotId];
  return strat ? strat(state, lt) : null;
}
