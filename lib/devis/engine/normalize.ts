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

// ─── Migration faux-plafond : ancienne config unique → modèle segments ──
// Les devis antérieurs au modèle "segments" portaient une config unique
// (plaque/peaux/isolant/avec_isolant/joints/entraxe/chute) SANS surface dans
// `o` (le faux-plafond lisait la surface globale). On ne peut donc pas
// reconstruire un segment dimensionné : on repart sur des lignes vides, en
// PRÉSERVANT les réglages niveau lot (entraxe, bandes, chute). Idempotent.
function migrateFauxPlafondO(
  o: Record<string, unknown>
): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o; // déjà au modèle segments
  return {
    lignes: [],
    entraxe: typeof o.entraxe === "string" ? o.entraxe : "0.60",
    bandes: !!(o.bandes ?? o.joints),
    chute: Number(o.chute) || 0,
  };
}

// ─── Migration ITI : ancienne config unique → modèle segments ───────
// Idem faux-plafond : l'ancien ITI (epa/iso/membrane/parement/m2) lisait une
// surface unique. On repart sur lignes vides en préservant la chute (s'il y en
// avait). Idempotent.
function migrateItiO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o;
  return { lignes: [], chute: Number(o.chute) || 0 };
}

// ─── Migration peinture : ancien modèle zones (z1..z4) → o.lignes ────
// L'ancien peinture lisait des zones nommées (z1_on/z1_m2/z1_passes/…). Pas de
// reconstruction dimensionnée fidèle : on repart sur des lignes vides (idem
// faux-plafond/ITI). Idempotent (skip si o.lignes déjà un tableau).
function migratePeintureO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o;
  return { lignes: [] };
}

// ─── Migration parquet : ancien modèle zones (z1..z3) → o.lignes ─────
// Idem peinture : pas de reconstruction dimensionnée fidèle (chute par zone →
// chute lot, axes redéfinis), on repart sur des lignes vides. Les lignes
// LIBRES du lot (LotState.lignesLibres) sont préservées par le chemin commun.
// Idempotent (skip si o.lignes déjà un tableau).
function migrateParquetO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o;
  return { lignes: [], chute: 0 };
}

// ─── Migration carrelage : ancien modèle zones (z1..z3) → o.lignes ───
// Idem parquet : lignes vides, lignes libres préservées. Idempotent.
function migrateCarrelageO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o;
  return { lignes: [], chute: 0 };
}

// ─── Migration faïence : ancien modèle zones (z1..z3) → o.lignes ─────
// Idem parquet/carrelage : lignes vides, lignes libres préservées. Idempotent.
function migrateFaienceO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o;
  return { lignes: [], chute: 0 };
}

// ─── Migration ragréage : ancien modèle zones (z1..z3) → o.lignes ────
// Idem carrelage : lignes vides, lignes libres préservées. L'ancien modèle
// facturait €/m² scalé par épaisseur ; le nouveau dose le produit au kg → pas
// de reconstruction fidèle, on repart sur lignes vides. Idempotent.
function migrateRagreageO(o: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(o.lignes)) return o;
  return { lignes: [], chute: 0 };
}

// ─── Migration gammes (suppression du concept, juin 2026) ───────────
// 1. Le champ legacy `q` ("std"|"mid"|"prm") est purgé de chaque lot (il
//    n'existe plus dans LotState ; les barèmes sont mono-prix).
// 2. Les overrides cp plombs sur clés gammées sont remappés : `X_std` → `X`
//    (les valeurs std sont devenues le prix unique) ; `X_mid`/`X_prm`
//    tombent (clés disparues → prix unique du barème).
const PLOMBS_EX_GAMME = [
  "wc_complet",
  "wc_suspendu_cuvette",
  "plaque_declenchement",
  "receveur_90",
  "mitigeur_douche",
  "mitigeur_cuisine",
  "mitigeur_lavabo",
  "baignoire",
  "mitigeur_bain",
] as const;
function migrateCpPlombs(cp: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(cp)) {
    const m = k.match(/^(.*)_(std|mid|prm)$/);
    if (m && (PLOMBS_EX_GAMME as readonly string[]).includes(m[1])) {
      if (m[2] === "std") out[m[1]] = v; // std → prix unique
      continue; // mid/prm : override orphelin, tombe
    }
    out[k] = v;
  }
  return out;
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
        // Additif : devis antérieurs sans lignesLibres → [] (aucun impact calcul).
        lignesLibres: Array.isArray(s.lignesLibres)
          ? [...s.lignesLibres]
          : baseLots[lid].lignesLibres,
      };
      // Migration cloisons : anciens slots fixes → o.lignes (idempotent).
      if (lid === "cloisons") {
        lots[lid].o = migrateCloisonsO(lots[lid].o);
      }
      // Migration faux-plafond : ancienne config unique → modèle segments.
      if (lid === "fauxplafond") {
        lots[lid].o = migrateFauxPlafondO(lots[lid].o);
      }
      // Migration ITI : ancienne config unique → modèle segments.
      if (lid === "iti") {
        lots[lid].o = migrateItiO(lots[lid].o);
      }
      // Migration peinture : ancien modèle zones → modèle segments.
      if (lid === "peinture") {
        lots[lid].o = migratePeintureO(lots[lid].o);
      }
      // Migration parquet : ancien modèle zones → modèle segments.
      if (lid === "parquet") {
        lots[lid].o = migrateParquetO(lots[lid].o);
      }
      // Migration carrelage : ancien modèle zones → modèle segments.
      if (lid === "carrelage") {
        lots[lid].o = migrateCarrelageO(lots[lid].o);
      }
      // Migration faïence : ancien modèle zones → modèle segments.
      if (lid === "faience") {
        lots[lid].o = migrateFaienceO(lots[lid].o);
      }
      // Migration ragréage : ancien modèle zones → modèle segments.
      if (lid === "ragreage") {
        lots[lid].o = migrateRagreageO(lots[lid].o);
      }
      // Migration plombs : remap des overrides cp gammés (X_std → X).
      if (lid === "plombs") {
        lots[lid].cp = migrateCpPlombs(lots[lid].cp);
      }
      // Purge du champ legacy `q` (gammes supprimées) — le spread `...s`
      // l'aurait recopié en propriété fantôme.
      delete (lots[lid] as unknown as Raw).q;
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
