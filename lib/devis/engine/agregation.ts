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

import type {
  CloisonSegment,
  EngineLigne,
  EngineState,
  LotId,
} from "./types";
import { round2, type LotTotaux } from "./totals";

/** Ligne synthétique présentée au client (niveau 2). */
export interface LigneClient {
  /** Id du segment source (cloisons) — pour cibler l'édition côté UI. */
  segmentId?: string;
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
// STRATÉGIE CLOISONS — modèle "segments"
// ════════════════════════════════════════════════════════════
//
// Une LigneClient par segment de `o.lignes`, dans l'ordre. Rattachement
// consommables ↔ prestation par `groupId === seg.id` (stable, posé par
// calc-items). Surface posée = seg.m2 (donnée config). Libellé commercial
// dérivé du type. `puOverride` (si défini) remplace le PU client calculé
// (override-aware) ; pour `libre`, le prix ferme du moteur fait foi.
const CLOISON_TYPE_LABELS: Record<string, string> = {
  std: "standard",
  hydro: "hydrofuge",
  hd: "haute dureté",
  feu: "coupe-feu",
};

function agregerCloisons(state: EngineState, lt: LotTotaux): LigneClient[] {
  const { items, deboursé, caDeboursé } = lt;
  const coefDeboursé = deboursé > 0 ? caDeboursé / deboursé : 0;
  const o = state.lots[lt.lotId].o;
  const segments = Array.isArray(o.lignes)
    ? (o.lignes as CloisonSegment[])
    : [];
  const out: LigneClient[] = [];

  for (const seg of segments) {
    const groupe = items.filter((l) => l.groupId === seg.id);
    if (groupe.length === 0) continue;

    const hl = groupe.find((l) => l.hl) ?? groupe[0];
    const qty = Number(seg.m2) || hl.qty;
    // Prix ventilé (sans override) = Σ lineCA → garantit Σ lignes = caLot
    // tant qu'aucun puOverride n'est posé.
    const ventile = round2(
      groupe.reduce((acc, l) => acc + lineCA(l, coefDeboursé), 0)
    );
    // Override-aware : un PU surchargé remplace le prix ventilé (sauf `libre`,
    // dont le prix ferme est déjà porté par la ligne moteur).
    const override =
      seg.type !== "libre" &&
      typeof seg.puOverride === "number" &&
      seg.puOverride >= 0;
    const prixClient = override ? round2(seg.puOverride! * qty) : ventile;

    const libelle =
      seg.type === "libre"
        ? seg.lbl || "Ligne libre"
        : `Fourniture et pose de cloison BA13 ${
            CLOISON_TYPE_LABELS[seg.type] ?? ""
          }`.trim();

    out.push({
      segmentId: seg.id,
      prestationKey: hl.key,
      libelleCommercial: libelle,
      libelleTechnique: hl.lbl,
      qty,
      unit: seg.type === "libre" ? seg.unit || "u" : "m²",
      prixClient,
      prixUnitaireClient: qty > 0 ? round2(prixClient / qty) : 0,
      tva: hl.tva ?? state.tvaParDefaut,
      afficheFourniture: false, // cloisons ∉ LOTS_PRODUIT_FINI
      detailInterne: groupe,
    });
  }
  return out;
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
