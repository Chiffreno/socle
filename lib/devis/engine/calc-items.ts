// ============================================================
// SOCLE — Moteur Devis — Génération des lignes (calcItems)
// Porté de ChiffReno v8 (_calcItemsCore : grand switch par lot).
//
// Paquet 1 : helpers (px, lsurf, chuted, pxRag, row, hrow, calcItems shell).
// Le switch _calcItemsCore est complété par paquets 2 → 5 (5 lots à la fois).
// ============================================================

import { BP } from "./bp";
import { LOTS_PRODUIT_FINI } from "./lots";
import type {
  CustomLigne,
  EngineLigne,
  EngineState,
  LotId,
} from "./types";

// ─── Prix ─────────────────────────────────────────────────────────────

/** Prix unitaire matériau : override custom > BP × (1 + globalCoeff%). */
export function px(state: EngineState, lotId: LotId, key: string): number {
  const lot = state.lots[lotId];
  const custom = lot.cp[key];
  if (custom !== undefined) return custom;
  const base = BP[key];
  if (base === undefined) return 0;
  return base * (1 + (state.globalCoeff || 0) / 100);
}

/** true si la clé a un prix overridé par l'artisan pour ce lot. */
export function isMod(state: EngineState, lotId: LotId, key: string): boolean {
  return state.lots[lotId].cp[key] !== undefined;
}

/** Référence d'épaisseur pour le scaling prix ragréage. */
const REF_EPA: Record<string, number> = {
  ragreage_simple: 5,
  ragreage_fibre: 8,
};

/** Prix ragréage scalé proportionnellement à l'épaisseur réelle (n'applique pas globalCoeff). */
export function pxRag(
  state: EngineState,
  lotId: LotId,
  key: string,
  epa: number
): number {
  const custom = state.lots[lotId].cp[key];
  if (custom !== undefined) return custom;
  const base = BP[key];
  if (base === undefined) return 0;
  return base * (epa / (REF_EPA[key] || 5));
}

// ─── Surface & chute ─────────────────────────────────────────────────

/** Surface effective du lot : `surf` spécifique ou `globalSurf`. */
export function lsurf(state: EngineState, lotId: LotId): number {
  const s = state.lots[lotId].surf;
  return s !== null ? s : state.globalSurf;
}

/** Applique la chute % à une quantité nette (arrondi à 1 décimale). */
export function chuted(net: number, pct: number | string | undefined): number {
  const p = typeof pct === "string" ? parseFloat(pct) : pct;
  return Math.round(net * (1 + (p || 0) / 100) * 10) / 10;
}

// ─── Affichage "dont fourniture" ─────────────────────────────────────

/**
 * Sous-ligne "dont fourniture" sur le devis client si true.
 * Règle : false si prixEstFinal=true (prix monolithique, pas de split).
 * Sinon : true ssi le LOT est produit-fini ET la ligne est hl=true
 * (le produit affiche sa fourniture ; les consommables d'accompagnement non).
 */
function deriveAfficheFourniture(
  lotId: LotId,
  hl: boolean,
  prixEstFinal: boolean
): boolean {
  if (prixEstFinal) return false;
  return LOTS_PRODUIT_FINI.has(lotId) && hl;
}

// ─── Builders de lignes ──────────────────────────────────────────────

/** Construit une ligne "row" : consommable (hl=false), prix matériau déboursé. */
export function row(
  state: EngineState,
  lotId: LotId,
  key: string,
  qty: number,
  lbl: string,
  unit: string,
  note: string = ""
): EngineLigne {
  const p = px(state, lotId, key);
  return {
    key,
    lotId,
    qty,
    lbl,
    unit,
    note,
    p,
    total: qty * p,
    hl: false,
    prixEstFinal: false,
    afficheFourniture: deriveAfficheFourniture(lotId, false, false),
    tva: state.tvaParDefaut,
  };
}

/** Construit une ligne "hrow" : highlighted ChiffReno (hl=true), prix matériau déboursé. */
export function hrow(
  state: EngineState,
  lotId: LotId,
  key: string,
  qty: number,
  lbl: string,
  unit: string,
  note: string = ""
): EngineLigne {
  const p = px(state, lotId, key);
  return {
    key,
    lotId,
    qty,
    lbl,
    unit,
    note,
    p,
    total: qty * p,
    hl: true,
    prixEstFinal: false,
    afficheFourniture: deriveAfficheFourniture(lotId, true, false),
    tva: state.tvaParDefaut,
  };
}

/** Construit une ligne custom (manuelle) à partir d'une CustomLigne stockée. */
function customRow(
  state: EngineState,
  lotId: LotId,
  c: CustomLigne
): EngineLigne {
  const qty = c.qty || 0;
  const p = c.p || 0;
  return {
    key: "_c_" + c.id,
    lotId,
    qty,
    lbl: c.lbl || "",
    unit: c.unit || "",
    note: "",
    p,
    total: qty * p,
    hl: false,
    prixEstFinal: false,
    afficheFourniture: false,
    custom: true,
    customId: c.id,
    tva: state.tvaParDefaut,
  };
}

// ─── Point d'entrée principal ────────────────────────────────────────

/**
 * Génère les lignes d'un lot : items calculés par `_calcItemsCore` (selon
 * `lot.o`) + lignes custom ajoutées manuellement par l'artisan.
 */
export function calcItems(state: EngineState, lotId: LotId): EngineLigne[] {
  const items = _calcItemsCore(state, lotId);
  for (const c of state.lots[lotId].custom || []) {
    items.push(customRow(state, lotId, c));
  }
  return items;
}

// ─── _calcItemsCore : switch par lot (vide pour le paquet 1) ─────────

/**
 * Construit les lignes calculées d'un lot à partir de sa config (`lot.o`).
 * Les 15 cases sont ajoutées par les paquets 2 → 5. Pour l'instant, tous
 * les lots retournent une liste vide (compilable, sanity test indispo).
 */
function _calcItemsCore(state: EngineState, lotId: LotId): EngineLigne[] {
  const lot = state.lots[lotId];
  const o = lot.o;
  const S = lsurf(state, lotId);
  // Closures pré-bindées pour la concision des cases (paquets 2 → 5)
  const _row = (k: string, q: number, l: string, u: string, n: string = "") =>
    row(state, lotId, k, q, l, u, n);
  const _hrow = (k: string, q: number, l: string, u: string, n: string = "") =>
    hrow(state, lotId, k, q, l, u, n);
  // Variables utilisées par les cases à venir — `void` pour éviter les warnings
  // d'unused dans le file initial (ce sera retiré quand les cases arriveront).
  void lot;
  void o;
  void S;
  void _row;
  void _hrow;

  switch (lotId) {
    // ── cases ajoutés par les paquets 2 → 5 ──
    default:
      return [];
  }
}
