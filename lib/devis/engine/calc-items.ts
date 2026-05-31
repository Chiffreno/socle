// ============================================================
// SOCLE — Moteur Devis — Génération des lignes (calcItems)
// Porté de ChiffReno v8 (_calcItemsCore : grand switch par lot).
//
// Paquet 1 : helpers (px, lsurf, chuted, pxRag, row, hrow, calcItems shell).
// Le switch _calcItemsCore est complété par paquets 2 → 5 (5 lots à la fois).
// ============================================================

import { BP } from "./bp";
import { CATALOGUE_DEMOLITION } from "./catalogue-demolition";
import { CATALOGUE_ELEC } from "./catalogue-elec";
import { LOTS_PRODUIT_FINI } from "./lots";
import { findPrestation, type PointPrestation } from "./points";
import type {
  CloisonOss,
  CloisonSegment,
  CustomLigne,
  EngineLigne,
  EngineState,
  LotId,
} from "./types";

// ─── Cloisons : dérivations centralisées (isolant + rail depuis l'ossature) ──
// Épaisseur d'isolant DÉRIVÉE de l'ossature : M48→45, M70→70, M90→90.
const OSS_EPA: Record<CloisonOss, "45" | "70" | "90"> = {
  m48: "45",
  m70: "70",
  m90: "90",
};
// Rail par ossature (corrigé : M70→R70, plus le quirk M70→R48 d'avant).
const RAIL: Record<CloisonOss, string> = {
  m48: "rail_r48",
  m70: "rail_r70",
  m90: "rail_r90",
};
const CLOISON_LBL: Record<string, string> = {
  std: "BA13 standard",
  hydro: "BA13 hydrofuge",
  hd: "BA13 haute dureté",
  feu: "BA13 coupe-feu",
};
/** Clé BP de l'isolant : type (lv/lr) + épaisseur dérivée de l'oss. null si aucun. */
function cloisonIsolantKey(
  isolant: string,
  oss: CloisonOss
): { key: string; epa: string } | null {
  if (isolant !== "lv" && isolant !== "lr") return null;
  const epa = OSS_EPA[oss];
  return { key: `${isolant}${epa}`, epa };
}

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
    tva: state.lots[lotId].tva ?? state.tvaParDefaut,
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
    tva: state.lots[lotId].tva ?? state.tvaParDefaut,
  };
}

/**
 * Construit une ligne depuis un catalogue "par points" (élec, démolition…).
 * prixEstFinal=true → aucune marge ni MO ajoutée par le moteur.
 * afficheFourniture=false → forcé (prix monolithique, pas de split fourniture).
 * TVA portée par la prestation du catalogue, pas par tvaParDefaut du devis.
 */
export function pointRow(
  _state: EngineState,
  lotId: LotId,
  prestation: PointPrestation,
  qty: number
): EngineLigne {
  return {
    key: prestation.id,
    lotId,
    qty,
    lbl: prestation.libelle,
    unit: prestation.unite,
    note: prestation.description,
    p: prestation.prixVente,
    total: qty * prestation.prixVente,
    hl: false,
    prixEstFinal: true,
    afficheFourniture: false,
    prestationId: prestation.id,
    tva: prestation.tva,
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
    tva: state.lots[lotId].tva ?? state.tvaParDefaut,
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
  void S;
  void _row;
  void _hrow;

  switch (lotId) {
    case "demolition": {
      // Lot 100% postes à prix ferme (catalogue-demolition.ts).
      // Pas d'infrastructure à déboursé : on itère uniquement sur o.points.
      const items: EngineLigne[] = [];
      const points = (o.points as Record<string, number> | undefined) || {};
      for (const [pid, qty] of Object.entries(points)) {
        if (!qty || qty <= 0) continue;
        const prestation = findPrestation(CATALOGUE_DEMOLITION, pid);
        if (!prestation) continue;
        items.push(pointRow(state, lotId, prestation, qty));
      }
      return items;
    }

    case "iti": {
      const epa = String(o.epa);
      const isGR = o.iso === "gr32";
      const isoKey = isGR ? `iti_gr32_${epa}` : `iti_steico_${epa}`;
      const R_gr: Record<string, string> = { "80": "2,50", "100": "3,15", "120": "3,75", "140": "4,40", "160": "5,00" };
      const R_st: Record<string, string> = { "60": "1,65", "80": "2,20", "100": "2,80", "120": "3,35", "140": "3,90" };
      const isoLbl = isGR
        ? `GR32 Kraft ${epa}mm — R=${R_gr[epa] || "?"} m².K/W`
        : `Steicoflex 036 ${epa}mm — R=${R_st[epa] || "?"} m².K/W`;
      const m2 = Number(o.m2) || 0;
      const items: EngineLigne[] = [
        _row("iti_oss", m2, "Ossature Optima — lisses Clip'Optima + fourrures 240", "m²"),
        _row("iti_appuis", m2, "Appuis intermédiaires Optima2", "m²", "1,5 pce/m²"),
        _row(isoKey, m2, isoLbl, "m²", isGR ? "Isover GR32 Kraft" : "Steicoflex 036 — fibre de bois souple"),
      ];
      if (o.membrane) {
        items.push(_row("iti_vario", m2, "Membrane hygro-régulante Vario Xtra", "m²", "Frein-vapeur intelligent"));
        const sml = Math.round(m2 * 0.7);
        items.push(_row("iti_scotch", sml, "Scotch Vario Multitape — jointoiement des lés", "ml", `~${sml} ml (0,7 ml/m²)`));
        items.push(_row("iti_pastilles", m2, "Pastilles Optima2 — maintien membrane", "m²"));
      }
      if (o.parement !== "aucun") {
        const pk = `iti_${o.parement}`;
        items.push(_row(pk, m2, o.parement === "ba13_std" ? "Parement BA13 standard" : "Parement BA13 hydrofuge", "m²"));
      }
      return items;
    }

    case "fauxplafond": {
      const ex = Number(o.entraxe) || 0.6;
      const four_ratio = Math.round((1 / ex + 0.4) * 10) / 10;
      const nb_four = Math.round(S * four_ratio);
      const peaux = Number(o.peaux) || 1;
      const plq_net = S * peaux;
      const plq = chuted(plq_net, o.chute as number | undefined);
      const pqLbls: Record<string, string> = {
        fp_ba13_std: "BA13 standard",
        fp_ba13_hydro: "BA13 hydrofuge",
        fp_ba13_feu: "BA13 coupe-feu",
        fp_ba13_phon: "BA13 phonique",
      };
      const isoLbls: Record<string, string> = {
        fp_lv_45: "Laine de verre 45mm",
        fp_lr_45: "Laine de roche 45mm",
        fp_lv_100: "Laine de verre 100mm",
        fp_lr_100: "Laine de roche 100mm",
        fp_ouate: "Ouate de cellulose 100mm",
      };
      const items: EngineLigne[] = [];
      const nb_susp = Math.round(nb_four / 1.4);
      if (o.suspente === "res")
        items.push(_row("fp_suspente_res", nb_susp, `Suspentes à ressort — ${nb_susp} pce`, "pce", `~${(nb_susp / S).toFixed(1)}/m²`));
      else
        items.push(_row("fp_suspente_cav", nb_susp, `Cavaliers pivot — ${nb_susp} pce`, "pce", `~${(nb_susp / S).toFixed(1)}/m²`));
      items.push(_row("fp_fourrure", nb_four, `Fourrures 47×17 — ${nb_four} ml`, "ml", `Entraxe ${o.entraxe} m`));
      const lisse_ml = Math.round(4 * Math.sqrt(S));
      items.push(_row("fp_lisse_peri", lisse_ml, `Lisses périphériques — ${lisse_ml} ml`, "ml", `4 × √${Math.round(S)} m²`));
      if (o.avec_isolant) {
        const isoKey = String(o.isolant);
        items.push(_row(isoKey, S, isoLbls[isoKey] || isoKey, "m²", "Entre fourrures / plafond"));
      }
      const plaqKey = String(o.plaque);
      items.push(_hrow(plaqKey, plq, `${pqLbls[plaqKey] || plaqKey} — ${peaux} peau${peaux > 1 ? "x" : ""} × ${S} m²`, "m²", `Brut : ${plq} m² (+${o.chute}% chute, net ${plq_net} m²)`));
      items.push(_row("fp_visserie", S, "Visserie TF plafond", "m²"));
      if (o.joints) items.push(_row("fp_bande_joint", plq_net, `Bandes + enduit joints — ${plq_net} m²`, "m²", "Faces visibles"));
      return items;
    }

    case "cloisons": {
      // Modèle "segments" : on itère o.lignes (tableau de CloisonSegment),
      // une prestation par segment. groupId = seg.id (identifiant stable).
      const lignes = Array.isArray(o.lignes)
        ? (o.lignes as CloisonSegment[])
        : [];
      if (lignes.length === 0) return [];
      const chute = Number(o.chute) || 5;
      const tvaLot = state.lots[lotId].tva ?? state.tvaParDefaut;
      const items: EngineLigne[] = [];

      for (const seg of lignes) {
        const m2 = Number(seg.m2) || 0;
        if (m2 <= 0) continue;

        // ── Ligne libre : prix ferme (puOverride = PU manuel), pas de marge.
        if (seg.type === "libre") {
          const pu = Number(seg.puOverride) || 0;
          items.push({
            key: `_seg_${seg.id}`,
            lotId,
            qty: m2,
            lbl: seg.lbl || "Ligne libre",
            unit: seg.unit || "u",
            note: "",
            groupId: seg.id,
            p: pu,
            total: m2 * pu,
            hl: true,
            prixEstFinal: true,
            afficheFourniture: false,
            tva: tvaLot,
          });
          continue;
        }

        // ── Segment cloison configuré.
        const oss = (seg.oss || "m48") as CloisonOss;
        const peaux = Number(seg.peaux || 2);
        const dbl = !!seg.dbl;
        const lbl = CLOISON_LBL[seg.type] || "BA13";
        const rk = RAIL[oss];
        const mk = `mont_${oss}`;
        const railLbl = rk.replace("rail_r", "R");
        const nr = Math.round(m2 * 0.8);
        const nm = Math.round(m2 * 1.7) * (dbl ? 2 : 1);
        const net = m2 * peaux;
        const brut = chuted(net, chute);
        // Bande à joint : 3 ml par m² de placo posé (ratio métier), unité ml.
        const mlBande = Math.round(m2 * 3 * 10) / 10;

        const zoneItems: EngineLigne[] = [
          _row(rk, nr, `Rails ${railLbl} — ${lbl} — ${nr} ml`, "ml"),
          _row(mk, nm, `Montants ${oss.toUpperCase()}${dbl ? " (doublés)" : ""} — ${lbl} — ${nm} ml`, "ml"),
          _row("bande_acou", nr, `Bande acoustique sous rails — ${lbl} — ${nr} ml`, "ml"),
          _hrow(`ba13_${seg.type}`, brut, `${lbl} — ${peaux === 4 ? "double peau (4 faces)" : "simple peau (2 faces)"} × ${m2} m²`, "m²", `Brut : ${brut} m² (+${chute}% chute)`),
          _row("visserie_cloison", m2, `Visserie — ${lbl}`, "m²"),
          _row("bande_joint", mlBande, `Bandes à joint — ${lbl} — ${mlBande} ml`, "ml"),
          _row("enduit_bande", net, `Enduit de bande — ${lbl}`, "m²"),
        ];
        // Isolant : type lv/lr, épaisseur DÉRIVÉE de l'ossature.
        const iso = cloisonIsolantKey(String(seg.isolant || "non"), oss);
        if (iso) {
          const label = seg.isolant === "lv" ? "LV" : "LR";
          zoneItems.push(
            _row(iso.key, m2, `${label} acoustique ${iso.epa}mm — ${lbl}`, "m²")
          );
        }
        for (const it of zoneItems) it.groupId = seg.id;
        items.push(...zoneItems);
      }
      return items;
    }

    case "peinture": {
      const finLbl: Record<string, string> = {
        mat: "Peinture mate — gamme GSB",
        velours: "Peinture velours Unikalo Aqualine Evo",
        satin: "Peinture satin premium",
      };
      const zones = [1, 2, 3, 4]
        .filter((n) => o[`z${n}_on`] && Number(o[`z${n}_m2`]) > 0)
        .map((n) => ({
          n,
          m2: Number(o[`z${n}_m2`]) || 0,
          passes: parseInt(String(o[`z${n}_passes`])) || 0,
          fin: String(o[`z${n}_fin`] || "mat"),
          imp: !!o[`z${n}_imp`],
          treillis: !!o[`z${n}_treillis`],
        }));
      if (zones.length === 0) return [];
      const items: EngineLigne[] = [];
      for (const z of zones) {
        const zlbl = `Zone ${z.n} — ${z.m2} m²`;
        if (z.passes > 0) items.push(_row("enduit_pate", z.m2 * z.passes, `${zlbl} · Enduit pâte ${z.passes} passe${z.passes > 1 ? "s" : ""}`, "m²", `${z.m2 * z.passes} m²`));
        if (z.passes === 3 && z.treillis) items.push(_row("toile_treillis", z.m2, `${zlbl} · Toile treillis de verre`, "m²"));
        if (z.imp) items.push(_row("impression", z.m2, `${zlbl} · Impression fixante`, "m²", "Unikalo Aqualine Impress Evo"));
        const fk = `peinture_${z.fin}`;
        items.push(_hrow(fk, z.m2 * 2, `${zlbl} · ${finLbl[z.fin] || z.fin} — 2 couches`, "m²", `${z.m2 * 2} m²`));
      }
      return items;
    }

    case "ragreage": {
      const zones = [1, 2, 3]
        .filter((n) => o[`z${n}_on`] && Number(o[`z${n}_m2`]) > 0)
        .map((n) => ({
          n,
          m2: Number(o[`z${n}_m2`]) || 0,
          type: String(o[`z${n}_type`] || "ragreage_simple"),
          epa: Number(o[`z${n}_epa_mm`]) || 5,
        }));
      if (zones.length === 0) return [];
      const items: EngineLigne[] = [];
      const S_total = zones.reduce((a, z) => a + z.m2, 0);
      if (o.primaire) items.push(_row("primaire_ragreage", S_total, "Primaire d'accrochage", "m²", "Favorise adhérence ragréage"));
      const ml_b = Number(o.ml_bandes) || 0;
      if (o.bandes && ml_b > 0) items.push(_row("bande_resiliente", ml_b, `Bandes résilientes périphériques — ${ml_b} ml`, "ml", "Désolidarisation phonique"));
      for (const z of zones) {
        const p = pxRag(state, lotId, z.type, z.epa);
        const lbl = z.type === "ragreage_fibre" ? "Ragréage fibré autonivelant" : "Ragréage autonivelant classique";
        // Item construit manuellement pour porter `epa` (utilisé par la liste d'achat).
        items.push({
          key: z.type,
          lotId,
          qty: z.m2,
          lbl: `${lbl} — Zone ${z.n}`,
          unit: "m²",
          note: `${z.epa} mm — ${z.m2} m²`,
          p,
          total: z.m2 * p,
          hl: true,
          prixEstFinal: false,
          afficheFourniture: false, // ragreage = consommable
          epa: z.epa,
          tva: state.lots[lotId].tva ?? state.tvaParDefaut,
        });
      }
      return items;
    }

    case "etancheite": {
      const mode = String(o.mode || "liquide");
      const ml_b = Number(o.ml_bandes) || 0;
      const m2 = Number(o.m2) || 0;
      const items: EngineLigne[] = [];
      if (o.primaire) items.push(_row("primaire_etanche", m2, "Primaire d'accrochage étanchéité", "m²", "Pénétration / consolidation support"));
      if (mode === "natte_e") {
        items.push(_hrow("natte_etanche", m2, "Natte d'étanchéité — KERDI / Wedi", "m²", "Zones humides"));
        items.push(_row("colle_c2s", Math.round(m2 * 3), "Colle C2S — spatule 3×3 mm", "kg", "~3 kg/m²"));
        if (ml_b > 0) items.push(_row("bande_natte", ml_b, `Bandes de rives — ${ml_b} ml`, "ml", "Raccord natte / mur"));
      } else if (mode === "natte_d" || mode === "natte") {
        items.push(_hrow("natte_desoli", m2, "Natte de désolidarisation — DITRA", "m²", "Découplage + drainage"));
        items.push(_row("colle_c2s", Math.round(m2 * 5), "Colle C2S — spatule 10×10 mm", "kg", "~5 kg/m²"));
        if (ml_b > 0) items.push(_row("bande_natte", ml_b, `Bandes de rives — ${ml_b} ml`, "ml", "Raccord natte / mur"));
      } else {
        items.push(_hrow("etanche_liquide", m2, "Membrane étanchéité liquide — Sika Level-01 / Knauf", "m²", "2 couches croisées"));
        if (ml_b > 0) items.push(_row("bande_etanche", ml_b, `Bandes armature tissu — ${ml_b} ml`, "ml", "Angles et périmètre"));
      }
      return items;
    }

    case "parquet": {
      const typeLbl: Record<string, string> = {
        parquet_strat: "Parquet stratifié 8mm",
        parquet_contre: "Parquet contrecollé 14mm",
        parquet_massif: "Parquet massif 20mm",
      };
      const zones = [1, 2, 3]
        .filter((n) => o[`z${n}_on`] && Number(o[`z${n}_m2`]) > 0)
        .map((n) => ({
          n,
          m2: Number(o[`z${n}_m2`]) || 0,
          type: String(o[`z${n}_type`] || "parquet_strat"),
          pose: String(o[`z${n}_pose`] || "flottant"),
          sc: String(o[`z${n}_sc`] || "std"),
          chute: Number(o[`z${n}_chute`]) || 0,
        }));
      if (zones.length === 0) return [];
      const items: EngineLigne[] = [];
      for (const z of zones) {
        const brut = chuted(z.m2, z.chute);
        items.push(_hrow(z.type, brut, `${typeLbl[z.type] || z.type} — Zone ${z.n}`, "m²", `Brut : ${brut} m² (+${z.chute}% chute, net ${z.m2} m²)`));
        if (z.pose === "flottant") {
          const scKey = z.sc === "liege" ? "sous_couche_liege" : "sous_couche";
          const scLbl = z.sc === "liege" ? "Sous-couche liège 2 mm" : "Sous-couche mousse";
          items.push(_row(scKey, z.m2, `${scLbl} — Zone ${z.n}`, "m²"));
        } else {
          if (z.sc === "liege") items.push(_row("sous_couche_liege", z.m2, `Sous-couche liège 2 mm — Zone ${z.n}`, "m²"));
          items.push(_row("colle_parquet", z.m2, `Colle MS polymère — Zone ${z.n}`, "m²", "1,2 kg/m² × 8 €/kg"));
        }
      }
      return items;
    }

    case "carrelage": {
      const typeLbl: Record<string, string> = {
        carrelage_std: "Carrelage céramique standard",
        gres_cerame: "Grès cérame rectifié",
        grand_format: "Grand format 60×120",
      };
      const PEIGNE_KG: Record<string, number> = { v3: 2, v4: 3, b10: 5, b12: 7 };
      const PEIGNE_LBL: Record<string, string> = { v3: "V3 3mm", v4: "V4 4mm", b10: "B10 10mm", b12: "B12 12mm" };
      const zones = [1, 2, 3]
        .filter((n) => o[`z${n}_on`] && Number(o[`z${n}_m2`]) > 0)
        .map((n) => ({
          n,
          m2: Number(o[`z${n}_m2`]) || 0,
          type: String(o[`z${n}_type`] || "carrelage_std"),
          peigne: String(o[`z${n}_peigne`] || "b10"),
          chute: Number(o[`z${n}_chute`]) || 0,
        }));
      if (zones.length === 0) return [];
      const items: EngineLigne[] = [];
      for (const z of zones) {
        const brut = chuted(z.m2, z.chute);
        const kg_m2 = PEIGNE_KG[z.peigne] || 5;
        const kg = Math.ceil(z.m2 * kg_m2);
        items.push(_hrow(z.type, brut, `${typeLbl[z.type] || z.type} — Zone ${z.n}`, "m²", `Brut : ${brut} m² (+${z.chute}% chute, net ${z.m2} m²)`));
        items.push(_row("colle_carrelage", kg, `Colle C2 peigne ${PEIGNE_LBL[z.peigne] || z.peigne} (${kg_m2} kg/m²) — Zone ${z.n}`, "kg"));
      }
      return items;
    }

    case "faience": {
      const typeLbl: Record<string, string> = {
        faience_std: "Faïence standard 20×30",
        gres_mural: "Grès cérame mural rectifié",
        gf_mural: "Grand format mural 60×120",
      };
      const PEIGNE_KG: Record<string, number> = { v3: 2, v4: 3, b10: 5, b12: 7 };
      const PEIGNE_LBL: Record<string, string> = { v3: "V3 3mm", v4: "V4 4mm", b10: "B10 10mm", b12: "B12 12mm" };
      const zones = [1, 2, 3]
        .filter((n) => o[`z${n}_on`] && Number(o[`z${n}_m2`]) > 0)
        .map((n) => ({
          n,
          m2: Number(o[`z${n}_m2`]) || 0,
          type: String(o[`z${n}_type`] || "faience_std"),
          peigne: String(o[`z${n}_peigne`] || "v4"),
          profiles_ml: Number(o[`z${n}_profiles_ml`]) || 0,
          chute: Number(o[`z${n}_chute`]) || 0,
        }));
      if (zones.length === 0) return [];
      const items: EngineLigne[] = [];
      for (const z of zones) {
        const brut = chuted(z.m2, z.chute);
        const kg_m2 = PEIGNE_KG[z.peigne] || 3;
        const kg = Math.ceil(z.m2 * kg_m2);
        items.push(_hrow(z.type, brut, `${typeLbl[z.type] || z.type} — Zone ${z.n}`, "m²", `Brut : ${brut} m² (+${z.chute}% chute, net ${z.m2} m²)`));
        items.push(_row("colle_faience", kg, `Colle C2S1 peigne ${PEIGNE_LBL[z.peigne] || z.peigne} (${kg_m2} kg/m²) — Zone ${z.n}`, "kg"));
        if (z.profiles_ml > 0) items.push(_row("profiles_alu", z.profiles_ml, `Profilés alu — Zone ${z.n} — ${z.profiles_ml} ml`, "ml", "Nez de carreau / jonction"));
      }
      return items;
    }

    case "menus": {
      const np = Number(o.nb_portes) || 0;
      const mpl = Number(o.m_plinthes) || 0;
      const ns = Number(o.nb_seuils) || 0;
      const type_porte = String(o.type_porte || "porte_mid");
      const type_plinthe = String(o.type_plinthe || "plinthe_mdf");
      const plbl: Record<string, string> = {
        porte_std: "Bloc-porte prépeint standard + huisserie",
        porte_mid: "Bloc-porte intermédiaire + huisserie",
        porte_prm: "Bloc-porte premium + huisserie chêne",
      };
      const tllbl: Record<string, string> = {
        plinthe_mdf: "Plinthe MDF prépeinte 70mm",
        plinthe_bois: "Plinthe bois massif 80mm",
      };
      return [
        _hrow(type_porte, np, `${plbl[type_porte] || type_porte} — ${np} unité${np > 1 ? "s" : ""}`, "pce", "Ouvrant + dormant"),
        _row(type_plinthe, mpl, `${tllbl[type_plinthe] || type_plinthe} — ${mpl} ml`, "ml"),
        _row("barre_seuil", ns, `Barre de seuil — ${ns} pce`, "pce", "Jonction sol"),
      ];
    }

    case "menuext": {
      const nf = Number(o.nb_fen) || 0;
      const npf = Number(o.nb_pf) || 0;
      const nv = Number(o.nb_vol) || 0;
      const nse = Number(o.nb_seuils_ext) || 0;
      const nbpe = Number(o.nb_porte_entree) || 0;
      const type_fen = String(o.type_fen || "fenetre_pvc");
      const type_pf = String(o.type_pf || "pf_pvc");
      const type_vol = String(o.type_vol || "volet_bat_pvc");
      const porte_entree = String(o.porte_entree || "porte_entree_std");
      const flbl: Record<string, string> = {
        fenetre_pvc: "Fenêtre PVC double vitrage Ug≤1,1",
        fenetre_alu: "Fenêtre alu thermolaqué triple vitrage",
        fenetre_bois: "Fenêtre bois double vitrage certifié",
      };
      const pflbl: Record<string, string> = {
        pf_pvc: "Porte-fenêtre PVC 2 vantaux",
        pf_alu: "Porte-fenêtre alu 2 vantaux",
        pf_bois: "Porte-fenêtre bois 2 vantaux",
      };
      const vlbl: Record<string, string> = {
        volet_bat_pvc: "Volet battant PVC",
        volet_bat_alu: "Volet battant alu thermolaqué",
        volet_roul: "Volet roulant électrique + caisson",
      };
      const pelbl: Record<string, string> = {
        porte_entree_std: "Porte d'entrée standard isolée",
        porte_entree_prm: "Porte d'entrée premium acier/alu",
      };
      const items: EngineLigne[] = [];
      if (nf > 0) items.push(_hrow(type_fen, nf, `${flbl[type_fen] || type_fen} — ${nf} unité${nf > 1 ? "s" : ""}`, "pce", "Pose en feuillure"));
      if (npf > 0) items.push(_hrow(type_pf, npf, `${pflbl[type_pf] || type_pf} — ${npf} unité${npf > 1 ? "s" : ""}`, "pce"));
      if (nv > 0) items.push(_hrow(type_vol, nv, `${vlbl[type_vol] || type_vol} — ${nv} unité${nv > 1 ? "s" : ""}`, "pce"));
      if (nbpe > 0) items.push(_hrow(porte_entree, nbpe, `${pelbl[porte_entree] || porte_entree}${nbpe > 1 ? " × " + nbpe : ""}`, "pce"));
      if (nse > 0) items.push(_row("seuil_ext", nse, `Seuil pierre / granit — ${nse} pce`, "pce"));
      return items;
    }

    case "cuisine": {
      const ml_b = Number(o.ml_bas) || 0;
      const ml_h = Number(o.ml_haut) || 0;
      const ml_pt = Number(o.ml_pt) || 0;
      const m2_cr = Number(o.m2_cred) || 0;
      const type_pt = String(o.type_pt || "plan_travail");
      const ptlbl: Record<string, string> = {
        plan_travail: "Plan de travail stratifié",
        plan_travail_qtz: "Plan de travail quartz",
      };
      const items: EngineLigne[] = [];
      if (ml_b > 0) items.push(_hrow("meuble_bas", ml_b, `Meubles bas — ${ml_b} ml`, "ml"));
      if (ml_h > 0) items.push(_hrow("meuble_haut", ml_h, `Meubles hauts — ${ml_h} ml`, "ml"));
      if (ml_pt > 0) items.push(_hrow(type_pt, ml_pt, `${ptlbl[type_pt] || type_pt} — ${ml_pt} ml`, "ml"));
      if (m2_cr > 0) items.push(_row("credence", m2_cr, `Crédence carrelage — ${m2_cr} m²`, "m²"));
      if (o.evier) items.push(_hrow("evier_cuisine", 1, "Évier inox simple bac + bonde", "pce"));
      if (o.four) items.push(_hrow("four", 1, "Four encastrable", "pce"));
      if (o.plaques) items.push(_hrow("plaques", 1, "Plaques de cuisson 4 feux", "pce"));
      if (o.hotte) items.push(_hrow("hotte", 1, "Hotte aspirante", "pce"));
      if (o.lave_vaisselle) items.push(_hrow("lave_vaisselle", 1, "Lave-vaisselle", "pce"));
      return items;
    }

    case "plombs": {
      const pts = (o.pts as { douche?: number; cuisine?: number; lavabo?: number; bain?: number }) || {};
      const reseau_type = String(o.reseau_type || "mc");
      const rk = reseau_type === "cu" ? "reseau_cu" : "reseau_mc";
      const rLbl = reseau_type === "cu"
        ? "Réseau distribution cuivre — tubes + raccords à sertir"
        : "Réseau distribution multicouche — tubes gainés + raccords + nourrices";
      const rNote = reseau_type === "cu" ? "EF + EC tube cuivre Ø12/14/16" : "EF + EC Ø16/20/25";
      const items: EngineLigne[] = [
        _row(rk, S, rLbl, "m²", rNote),
        _row("evac_pvc", S, "Réseau évacuation PVC — eaux usées Ø40 + eaux vannes Ø100", "m²", "Siphons + raccords"),
      ];
      const wc_sol = Number(o.wc_sol) || 0;
      const wc_susp = Number(o.wc_susp) || 0;
      const q = (lot.q || "mid") as string;
      if (wc_sol > 0) items.push(_hrow(`wc_complet_${q}`, wc_sol, `WC au sol — cuvette + réservoir + abattant${wc_sol > 1 ? " × " + wc_sol : ""}`, "pce"));
      if (wc_susp > 0) {
        items.push(_hrow("bati_support", wc_susp, `Bâti-support WC suspendu${wc_susp > 1 ? " × " + wc_susp : ""}`, "pce", "Geberit / Grohe / Viega"));
        items.push(_hrow(`wc_suspendu_cuvette_${q}`, wc_susp, `Cuvette WC suspendue${wc_susp > 1 ? " × " + wc_susp : ""}`, "pce", "Rimless"));
        items.push(_hrow(`plaque_declenchement_${q}`, wc_susp, `Plaque de déclenchement${wc_susp > 1 ? " × " + wc_susp : ""}`, "pce"));
      }
      const nbDouche = Number(pts.douche) || 0;
      const nbCuisine = Number(pts.cuisine) || 0;
      const nbLavabo = Number(pts.lavabo) || 0;
      const nbBain = Number(pts.bain) || 0;
      if (nbDouche > 0) {
        const carr = (o.douche_type || "receveur") === "carreler";
        if (carr) {
          items.push(_hrow("receveur_carreler", nbDouche, `Receveur à carreler${nbDouche > 1 ? " × " + nbDouche : ""}`, "pce", "Wedi / Schlüter Kerdi-Shower"));
          items.push(_hrow("bonde_design", nbDouche, `Bonde design / linéaire${nbDouche > 1 ? " × " + nbDouche : ""}`, "pce"));
          items.push(_row("kit_etanche_douche", nbDouche * 3.5, `Kit étanchéité douche${nbDouche > 1 ? " × " + nbDouche : ""}`, "m²", "Membrane liquide + bandes"));
        } else {
          items.push(_hrow(`receveur_90_${q}`, nbDouche, `Receveur douche 90×90 + bonde${nbDouche > 1 ? " × " + nbDouche : ""}`, "pce"));
        }
        items.push(_hrow(`mitigeur_douche_${q}`, nbDouche, `Mitigeur douche + flexible + douchette${nbDouche > 1 ? " × " + nbDouche : ""}`, "pce"));
      }
      if (nbCuisine > 0) items.push(_hrow(`mitigeur_cuisine_${q}`, nbCuisine, `Mitigeur évier cuisine${nbCuisine > 1 ? " × " + nbCuisine : ""}`, "pce"));
      if (nbLavabo > 0) items.push(_hrow(`mitigeur_lavabo_${q}`, nbLavabo, `Mitigeur lavabo + siphon${nbLavabo > 1 ? " × " + nbLavabo : ""}`, "pce"));
      if (nbBain > 0) {
        items.push(_hrow(`baignoire_${q}`, nbBain, `Baignoire standard 170×75${nbBain > 1 ? " × " + nbBain : ""}`, "pce"));
        items.push(_hrow(`mitigeur_bain_${q}`, nbBain, `Mitigeur bain/douche${nbBain > 1 ? " × " + nbBain : ""}`, "pce"));
      }
      const ceKey = String(o.ce || "ce_elec_150");
      const ceLbl: Record<string, string> = {
        ce_elec_100: "Chauffe-eau électrique 100L",
        ce_elec_150: "Chauffe-eau électrique 150L",
        ce_thermo: "Chauffe-eau thermodynamique — COP ≥ 3",
      };
      items.push(_hrow(ceKey, 1, ceLbl[ceKey] || ceKey, "pce"));
      return items;
    }

    case "elec": {
      // Lot HYBRIDE :
      //   - infrastructure (tableau, GTL, Consuel, terre, VMC) → prixEstFinal=false
      //     (déboursé matériau + marge + MO via totals.ts au paquet 6)
      //   - points (31 prestations catalogue-elec) → prixEstFinal=true
      //     (prix vente final, marge trackée via lot.coutRevientPoints)
      const items: EngineLigne[] = [];

      // Infrastructure
      const tr = Number(o.tableau_rangees) || 0;
      if (tr > 0 && tr <= 6) {
        items.push(
          _row(
            `elec_tableau_${tr}r`,
            1,
            `Tableau électrique ${tr} rangée${tr > 1 ? "s" : ""}`,
            "forfait",
            "GTL + différentiels + disjoncteurs + parafoudre"
          )
        );
      }
      if (o.gtl) items.push(_row("elec_gtl", 1, "Gaine Technique Logement (GTL)", "forfait"));
      if (o.consuel) items.push(_row("elec_consuel", 1, "Attestation Consuel", "forfait", "Visa de conformité"));
      if (o.terre) items.push(_row("elec_terre", 1, "Mise à la terre + distribution principale", "forfait", "Conducteur de terre + barrette + distribution réseau"));
      if (o.vmc === "sf") items.push(_row("elec_vmc_sf", 1, "VMC simple flux hygro-réglable", "forfait"));
      else if (o.vmc === "df") items.push(_row("elec_vmc_df", 1, "VMC double flux à échangeur", "forfait", "Rendement ≥ 85%"));

      // Points (catalogue-elec.ts) — postes inconnus ignorés silencieusement
      const points = (o.points as Record<string, number> | undefined) || {};
      for (const [pid, qty] of Object.entries(points)) {
        if (!qty || qty <= 0) continue;
        const prestation = findPrestation(CATALOGUE_ELEC, pid);
        if (!prestation) continue;
        items.push(pointRow(state, lotId, prestation, qty));
      }
      return items;
    }

    default:
      return [];
  }
}
