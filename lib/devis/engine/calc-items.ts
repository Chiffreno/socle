// ============================================================
// SOCLE — Moteur Devis — Génération des lignes (calcItems)
// Porté de ChiffReno v8 (_calcItemsCore : grand switch par lot).
//
// Paquet 1 : helpers (px, lsurf, chuted, pxRag, row, hrow, calcItems shell).
// Le switch _calcItemsCore est complété par paquets 2 → 5 (5 lots à la fois).
// ============================================================

import { BP } from "./bp";
import { CATALOGUE_DEMOLITION } from "./catalogue-demolition";
import { LOTS_PRODUIT_FINI } from "./lots";
import { findPrestation, type PointPrestation } from "./points";
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
      const zoneSpecs = [
        { key: "std", on: o.std_on, m2: o.std_m2, oss: o.std_oss || "m48", peaux: Number(o.std_peaux || 2), acou: o.std_acou || "non", dbl: !!o.std_dbl_mont, lbl: "BA13 standard" },
        { key: "hydro", on: o.hydro_on, m2: o.hydro_m2, oss: o.hydro_oss || "m48", peaux: Number(o.hydro_peaux || 2), acou: o.hydro_acou || "non", dbl: !!o.hydro_dbl_mont, lbl: "BA13 hydrofuge" },
        { key: "hd", on: o.hd_on, m2: o.hd_m2, oss: o.hd_oss || "m48", peaux: Number(o.hd_peaux || 2), acou: o.hd_acou || "non", dbl: !!o.hd_dbl_mont, lbl: "BA13 haute dureté" },
        { key: "feu", on: o.feu_on, m2: o.feu_m2, oss: o.feu_oss || "m48", peaux: Number(o.feu_peaux || 2), acou: o.feu_acou || "non", dbl: !!o.feu_dbl_mont, lbl: "BA13 coupe-feu" },
      ];
      const zones = zoneSpecs.filter((z) => z.on && Number(z.m2) > 0);
      if (zones.length === 0) return [];
      const chute = Number(o.chute) || 5;
      const items: EngineLigne[] = [];
      for (const z of zones) {
        const m2 = Number(z.m2) || 0;
        const oss = String(z.oss);
        const rk = oss === "m90" ? "rail_r70" : "rail_r48";
        const mk = `mont_${oss}`;
        const nr = Math.round(m2 * 0.8);
        const nm = Math.round(m2 * 1.7) * (z.dbl ? 2 : 1);
        const net = m2 * z.peaux;
        const brut = chuted(net, chute);
        items.push(_row(rk, nr, `Rails ${oss === "m90" ? "R70" : "R48"} — ${z.lbl} — ${nr} ml`, "ml"));
        items.push(_row(mk, nm, `Montants ${oss.toUpperCase()}${z.dbl ? " (doublés)" : ""} — ${z.lbl} — ${nm} ml`, "ml"));
        items.push(_row("bande_acou", nr, `Bande acoustique sous rails — ${z.lbl} — ${nr} ml`, "ml"));
        items.push(_hrow(`ba13_${z.key}`, brut, `${z.lbl} — ${z.peaux === 4 ? "double peau (4 faces)" : "simple peau (2 faces)"} × ${m2} m²`, "m²", `Brut : ${brut} m² (+${chute}% chute)`));
        items.push(_row("visserie_cloison", m2, `Visserie — ${z.lbl}`, "m²"));
        items.push(_row("bande_joint", net, `Bandes à joint — ${z.lbl}`, "m²"));
        items.push(_row("enduit_bande", net, `Enduit de bande — ${z.lbl}`, "m²"));
        if (z.acou !== "non") {
          const acouKey = String(z.acou);
          items.push(_row(acouKey, m2, acouKey === "lv45" ? `LV acoustique 45mm — ${z.lbl}` : `LR acoustique 45mm — ${z.lbl}`, "m²"));
        }
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
          tva: state.tvaParDefaut,
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

    // ── autres cases ajoutés par les paquets 4 → 5 ──
    default:
      return [];
  }
}
