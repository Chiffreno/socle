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
import type {
  CloisonOss,
  CloisonSegment,
  EngineState,
  LotId,
  LotLibre,
  LotState,
  RemiseMode,
} from "./types";
import type { TauxTVA } from "../types";

type Raw = Record<string, unknown>;

// ─── Migration cloisons : anciens slots fixes (std/hydro/hd/feu) → o.lignes ──
// Les devis sérialisés avant le modèle "segments" portent std_on/_m2/_oss/…
// On les convertit en un segment par slot actif. Idempotent (skip si lignes
// existe déjà), déterministe (ids seg_<type>, pas de Math.random). L'isolant
// passe de l'ancien acou (lv45/lr45, toujours 45mm) au nouveau type lv/lr —
// l'épaisseur sera re-dérivée de l'ossature par calc-items (M48→45 inchangé).
const CLOISON_SLOT_TYPES = ["std", "hydro", "hd", "feu"] as const;
function migrateCloisonsO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o; // déjà au modèle segments
  const lignes: CloisonSegment[] = [];
  for (const t of CLOISON_SLOT_TYPES) {
    if (o[`${t}_on`] && Number(o[`${t}_m2`]) > 0) {
      const acou = String(o[`${t}_acou`] ?? "non");
      const isolant = acou === "lv45" ? "lv" : acou === "lr45" ? "lr" : "non";
      lignes.push({
        id: `seg_${t}`,
        type: t,
        oss: String(o[`${t}_oss`] ?? "m48") as CloisonOss,
        isolant,
        peaux: (String(o[`${t}_peaux`] ?? "2") === "4" ? "4" : "2") as
          | "2"
          | "4",
        dbl: !!o[`${t}_dbl_mont`],
        m2: Number(o[`${t}_m2`]) || 0,
      });
    }
  }
  return { ...o, lignes, chute: Number(o.chute) || 0 };
}

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
      // Migration cloisons : anciens slots fixes → o.lignes (idempotent).
      if (lid === "cloisons") {
        lots[lid].o = migrateCloisonsO(lots[lid].o);
      }
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
    // Additif : devis antérieurs sans lotsLibres → [] (aucun impact calcul).
    lotsLibres: Array.isArray(r.lotsLibres) ? (r.lotsLibres as LotLibre[]) : [],
  };
}
