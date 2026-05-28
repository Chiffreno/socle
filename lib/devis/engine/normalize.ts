// ============================================================
// SOCLE — Moteur Devis — Normalisation d'un EngineState sérialisé
//
// Pur (pas de dépendance navigateur). Importé par :
//   - lib/devis/repository.ts (migration silencieuse à la lecture)
//   - lib/devis/engine/round-trip-test.ts (validation P2)
//
// Garantit que :
//   - Toutes les clés de lots ChiffReno existent (un lot ajouté plus tard
//     ne casse pas les devis sérialisés sans ce lot ; il reçoit un
//     LotState neutre `on:false`).
//   - Les champs `o`, `cp`, `custom` survivent en bloc (Records / arrays
//     pure data, pas de deep-merge nécessaire).
//   - `coutRevientPoints` reste strictement `undefined` quand absent dans
//     le JSON (vs `0` ou `null` qui seraient interprétés comme "saisi à 0").
//   - `tva` (override par lot) reste strictement `undefined` quand absent.
// ============================================================

import { createInitialEngineState, createInitialLotStates } from "./lots";
import type { EngineState, LotId, LotState, RemiseMode } from "./types";
import type { TauxTVA } from "../types";

type Raw = Record<string, unknown>;

export interface EngineHeader {
  globalSurf: number;
  tvaParDefaut: TauxTVA;
  remiseMode: RemiseMode;
  remiseValeur: number;
}

export function normalizeEngine(
  raw: unknown,
  header: EngineHeader
): EngineState {
  const r = (raw ?? {}) as Raw;
  if (!r || typeof r !== "object" || !r.lots) {
    return createInitialEngineState(header);
  }
  const baseLots = createInitialLotStates();
  const storedLots = (r.lots ?? {}) as Record<string, unknown>;
  const lots = { ...baseLots } as Record<LotId, LotState>;
  for (const lid of Object.keys(baseLots) as LotId[]) {
    const stored = storedLots[lid];
    if (stored && typeof stored === "object") {
      const s = stored as Partial<LotState>;
      lots[lid] = {
        ...baseLots[lid],
        ...s,
        o:
          typeof s.o === "object" && s.o !== null
            ? { ...s.o }
            : baseLots[lid].o,
        cp:
          typeof s.cp === "object" && s.cp !== null
            ? { ...s.cp }
            : baseLots[lid].cp,
        custom: Array.isArray(s.custom)
          ? [...s.custom]
          : baseLots[lid].custom,
      };
    }
  }
  return {
    globalSurf:
      typeof r.globalSurf === "number" ? r.globalSurf : header.globalSurf,
    tvaParDefaut:
      r.tvaParDefaut === 5.5 || r.tvaParDefaut === 10 || r.tvaParDefaut === 20
        ? (r.tvaParDefaut as TauxTVA)
        : header.tvaParDefaut,
    remiseMode:
      r.remiseMode === "pourcent" || r.remiseMode === "euros"
        ? (r.remiseMode as RemiseMode)
        : header.remiseMode,
    remiseValeur:
      typeof r.remiseValeur === "number" ? r.remiseValeur : header.remiseValeur,
    globalCoeff: typeof r.globalCoeff === "number" ? r.globalCoeff : 0,
    lots,
  };
}
