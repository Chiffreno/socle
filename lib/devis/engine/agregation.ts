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
  LotLibre,
  RemiseMode,
} from "./types";
import { round2, type DevisTotaux, type LotTotaux } from "./totals";

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

    // libelleOverride (renommage commercial) prend le pas sur le généré.
    const genere =
      seg.type === "libre"
        ? seg.lbl || "Ligne libre"
        : `Fourniture et pose de cloison BA13 ${
            CLOISON_TYPE_LABELS[seg.type] ?? ""
          }`.trim();
    const libelle = seg.libelleOverride?.trim() || genere;

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

/** Ce lot a-t-il une stratégie d'agrégation (lignes client) ? */
export function hasAggregateur(lotId: LotId): boolean {
  return lotId in STRATEGIES;
}

/** Lignes client d'un lot libre (prix de vente ferme, qty × pu). */
export function lignesLotLibre(
  lot: LotLibre,
  tvaParDefaut: number
): LigneClient[] {
  return lot.lignes.map((l) => {
    const qty = Number(l.qty) || 0;
    const pu = Number(l.pu) || 0;
    const genere = l.lbl || "Ligne libre";
    return {
      segmentId: l.id,
      prestationKey: "_libre",
      libelleCommercial: l.libelleOverride?.trim() || genere,
      libelleTechnique: genere,
      qty,
      unit: l.unit || "u",
      prixClient: round2(qty * pu),
      prixUnitaireClient: pu,
      tva: tvaParDefaut,
      afficheFourniture: false,
      detailInterne: [],
    };
  });
}

// ════════════════════════════════════════════════════════════
// TOTAUX CLIENT (override-aware)
// ════════════════════════════════════════════════════════════
//
// Le HT d'un lot à agrégateur = somme des lignes client (donc override-aware).
// Tant qu'aucun puOverride n'existe nulle part, on renvoie tels quels les
// totaux globaux du moteur (Σ lignes = caLot) → zéro drift d'arrondi.

export interface ClientTotaux {
  /** HT client par lot — clé = LotId OU id de lot libre. */
  parLotClientHT: Record<string, number>;
  subTotalHT: number;
  remiseHT: number;
  totalHT: number;
  ventilationTVA: Record<number, number>;
  totalTVA: number;
  totalTTC: number;
  hasOverride: boolean;
}

// Réplique de la remise du moteur (privée dans totals.ts).
function remiseAmountClient(
  subTotalHT: number,
  mode: RemiseMode,
  valeur: number
): number {
  if (subTotalHT <= 0) return 0;
  if (mode === "pourcent")
    return Math.min(subTotalHT, subTotalHT * ((valeur || 0) / 100));
  if (mode === "euros") return Math.min(subTotalHT, Math.max(0, valeur || 0));
  return 0;
}

/** "Unités client" d'un lot : (montant HT, taux TVA). */
function lotClientUnits(
  state: EngineState,
  lt: LotTotaux
): Array<{ amountHT: number; tva: number }> {
  const lignes = agregerLignesClient(state, lt);
  if (lignes) return lignes.map((lc) => ({ amountHT: lc.prixClient, tva: lc.tva }));
  // Lot sans agrégateur : reproduit la ventilation par ligne du moteur.
  const coef = lt.deboursé > 0 ? lt.caDeboursé / lt.deboursé : 0;
  const units = lt.items.map((it) => ({
    amountHT: it.prixEstFinal ? it.total : it.total * coef,
    tva: (it.tva ?? state.tvaParDefaut) as number,
  }));
  if (lt.deboursé === 0 && lt.caDeboursé > 0) {
    units.push({ amountHT: lt.caDeboursé, tva: state.tvaParDefaut });
  }
  return units;
}

function anyOverride(state: EngineState): boolean {
  for (const lid of Object.keys(state.lots) as LotId[]) {
    if (!hasAggregateur(lid)) continue;
    const o = state.lots[lid].o;
    const segs = Array.isArray(o.lignes) ? (o.lignes as CloisonSegment[]) : [];
    if (
      segs.some(
        (s) =>
          s.type !== "libre" &&
          typeof s.puOverride === "number" &&
          s.puOverride >= 0
      )
    )
      return true;
  }
  return false;
}

export function calcClientTotaux(
  state: EngineState,
  engineTotaux: DevisTotaux
): ClientTotaux {
  const active = engineTotaux.parLot.filter((l) => l.active);
  const parLotClientHT: Record<string, number> = {};
  for (const lt of active) {
    const units = lotClientUnits(state, lt);
    parLotClientHT[lt.lotId] = round2(
      units.reduce((a, u) => a + u.amountHT, 0)
    );
  }
  // Lots libres (prix ferme) : HT par lot libre.
  const lotsLibres = state.lotsLibres ?? [];
  for (const lot of lotsLibres) {
    const lignes = lignesLotLibre(lot, state.tvaParDefaut);
    parLotClientHT[lot.id] = round2(
      lignes.reduce((a, l) => a + l.prixClient, 0)
    );
  }
  const hasLibre = lotsLibres.some((l) => l.lignes.length > 0);

  // Sans override NI lot libre : totaux globaux du moteur = vérité (pas de
  // recalcul) → garantit 0 drift (les chiffres validés ne bougent pas).
  if (!anyOverride(state) && !hasLibre) {
    return {
      parLotClientHT,
      subTotalHT: engineTotaux.subTotalHT,
      remiseHT: engineTotaux.remiseHT,
      totalHT: engineTotaux.totalHT,
      ventilationTVA: engineTotaux.ventilationTVA,
      totalTVA: engineTotaux.totalTVA,
      totalTTC: engineTotaux.totalTTC,
      hasOverride: false,
    };
  }

  // Avec override et/ou lot libre : on recompose depuis les unités client.
  const allUnits = [
    ...active.flatMap((lt) => lotClientUnits(state, lt)),
    ...lotsLibres.flatMap((lot) =>
      lignesLotLibre(lot, state.tvaParDefaut).map((l) => ({
        amountHT: l.prixClient,
        tva: l.tva,
      }))
    ),
  ];
  const subTotalHT = round2(allUnits.reduce((a, u) => a + u.amountHT, 0));
  const remiseHT = round2(
    remiseAmountClient(subTotalHT, state.remiseMode, state.remiseValeur)
  );
  const totalHT = round2(subTotalHT - remiseHT);
  const ratio = subTotalHT > 0 ? totalHT / subTotalHT : 1;
  const acc: Record<number, number> = {};
  for (const u of allUnits) {
    acc[u.tva] = (acc[u.tva] || 0) + u.amountHT * ratio * (u.tva / 100);
  }
  const ventilationTVA: Record<number, number> = {};
  let totalTVA = 0;
  for (const [taux, m] of Object.entries(acc)) {
    const r = round2(m);
    ventilationTVA[Number(taux)] = r;
    totalTVA += r;
  }
  totalTVA = round2(totalTVA);
  return {
    parLotClientHT,
    subTotalHT,
    remiseHT,
    totalHT,
    ventilationTVA,
    totalTVA,
    totalTTC: round2(totalHT + totalTVA),
    hasOverride: true,
  };
}
