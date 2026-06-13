// ============================================================
// SOCLE — Tests — Helpers de fixtures
//
// Construit des EngineState de test à partir de l'état initial réel
// (createInitialEngineState) pour que les tests restent alignés sur la
// forme exacte de l'état produit par l'application.
// ============================================================

import { createInitialEngineState } from "../lib/devis/engine/lots";
import type {
  CustomLigne,
  EngineState,
  LotId,
  RemiseMode,
} from "../lib/devis/engine/types";
import type { TauxTVA } from "../lib/devis/types";

/** État moteur initial, surchargé par options (mêmes défauts que l'app). */
export function makeState(opts?: {
  globalSurf?: number;
  tvaParDefaut?: TauxTVA;
  remiseMode?: RemiseMode;
  remiseValeur?: number;
  globalCoeff?: number;
}): EngineState {
  return createInitialEngineState(opts);
}

/**
 * Active un lot et lui ajoute une ligne custom (déboursé contrôlé qty × p).
 * Pratique pour tester totals.ts avec un déboursé exact, sans dépendre des
 * prix BP d'un configurateur.
 */
export function addCustomLine(
  state: EngineState,
  lotId: LotId,
  qty: number,
  p: number,
  id: string = `c_${lotId}_${qty}x${p}`
): void {
  const c: CustomLigne = { id, lbl: `Ligne test ${id}`, unit: "u", qty, p };
  state.lots[lotId].on = true;
  state.lots[lotId].custom.push(c);
}
