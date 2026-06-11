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
import {
  findPrestation,
  type PointOverride,
  type PointPrestation,
} from "./points";
import type {
  CloisonOss,
  CloisonSegment,
  CustomLigne,
  EngineLigne,
  EngineState,
  FauxPlafondSegment,
  ItiEpa,
  ItiSegment,
  CarrelageSegment,
  LotId,
  ParquetSegment,
  PeintureFinition,
  PeintureNature,
  PeintureSegment,
  PeintureSupport,
  SegmentBase,
} from "./types";
import type { TauxTVA } from "../types";
import {
  ITI_FAMILLE_LABEL,
  ITI_LAMBDA,
  itiIsoKey,
  itiRText,
} from "./iti";

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

// ─── Segments : ligne LIBRE (prix ferme) partagée par tous les lots à segments ──
/** Item d'un segment `libre` (prix de vente ferme, qty × pu, aucune marge).
 *  Mutualisé entre cloisons, faux-plafond, … (même comportement). */
function segmentLibreItem(
  lotId: LotId,
  seg: SegmentBase,
  tvaLot: TauxTVA
): EngineLigne {
  const m2 = Number(seg.m2) || 0;
  const pu = Number(seg.puOverride) || 0;
  return {
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
      // Modèle "segments" (patron cloisons) : une prestation par segment de
      // o.lignes. L'isolant est la ligne hl (avec R indicatif affiché). Réglage
      // niveau lot : chute. groupId = seg.id.
      const lignes = Array.isArray(o.lignes)
        ? (o.lignes as ItiSegment[])
        : [];
      if (lignes.length === 0) return [];
      const tvaLot = state.lots[lotId].tva ?? state.tvaParDefaut;
      const items: EngineLigne[] = [];

      for (const seg of lignes) {
        const m2 = Number(seg.m2) || 0;
        if (m2 <= 0) continue;

        // ── Ligne libre : prix ferme.
        if (seg.type === "libre") {
          items.push(segmentLibreItem(lotId, seg, tvaLot));
          continue;
        }

        const iso = seg.type; // famille validée
        const epa = (seg.epa || "120") as ItiEpa;
        const isoKey = itiIsoKey(iso, epa);
        const isoLbl = `${ITI_FAMILLE_LABEL[iso]} ${epa}mm — R ≈ ${itiRText(iso, epa)} m².K/W`;

        const zoneItems: EngineLigne[] = [
          _row("iti_oss", m2, "Ossature Optima — lisses Clip'Optima + fourrures 240", "m²"),
          _row("iti_appuis", m2, "Appuis intermédiaires Optima2", "m²", "1,5 pce/m²"),
          // Isolant = ligne hl (produit principal de la prestation ITI).
          _hrow(isoKey, m2, isoLbl, "m²", `${ITI_FAMILLE_LABEL[iso]} — λ ${ITI_LAMBDA[iso]} (R indicatif)`),
        ];
        if (seg.membrane) {
          zoneItems.push(_row("iti_vario", m2, "Membrane hygro-régulante Vario Xtra", "m²", "Frein-vapeur intelligent"));
          const sml = Math.round(m2 * 0.7);
          zoneItems.push(_row("iti_scotch", sml, "Scotch Vario Multitape — jointoiement des lés", "ml", `~${sml} ml (0,7 ml/m²)`));
          zoneItems.push(_row("iti_pastilles", m2, "Pastilles Optima2 — maintien membrane", "m²"));
        }
        if (seg.parement !== "aucun") {
          const pk = `iti_${seg.parement}`;
          zoneItems.push(_row(pk, m2, seg.parement === "ba13_std" ? "Parement BA13 standard" : "Parement BA13 hydrofuge", "m²"));
        }

        for (const it of zoneItems) it.groupId = seg.id;
        items.push(...zoneItems);
      }
      return items;
    }

    case "fauxplafond": {
      // Modèle "segments" (patron cloisons) : une prestation par segment de
      // o.lignes. Suspentes TOUJOURS à ressort (pas de paramètre). Réglages au
      // niveau lot : entraxe, bandes, chute. groupId = seg.id.
      const lignes = Array.isArray(o.lignes)
        ? (o.lignes as FauxPlafondSegment[])
        : [];
      if (lignes.length === 0) return [];
      const ex = Number(o.entraxe) || 0.6;
      const bandes = !!o.bandes;
      const chute = Number(o.chute) || 0;
      const tvaLot = state.lots[lotId].tva ?? state.tvaParDefaut;
      const four_ratio = Math.round((1 / ex + 0.4) * 10) / 10;
      const pqLbls: Record<string, string> = {
        std: "Plafond BA13 standard",
        hydro: "Plafond BA13 hydrofuge",
        feu: "Plafond BA13 coupe-feu",
        phon: "Plafond BA13 phonique",
      };
      // Isolant : clé segment → clé BP + libellé.
      const isoKeys: Record<string, string> = {
        lv45: "fp_lv_45",
        lr45: "fp_lr_45",
        lv100: "fp_lv_100",
        lr100: "fp_lr_100",
        ouate: "fp_ouate",
      };
      const isoLbls: Record<string, string> = {
        lv45: "Laine de verre 45mm",
        lr45: "Laine de roche 45mm",
        lv100: "Laine de verre 100mm",
        lr100: "Laine de roche 100mm",
        ouate: "Ouate de cellulose 100mm",
      };
      const items: EngineLigne[] = [];

      for (const seg of lignes) {
        const m2 = Number(seg.m2) || 0;
        if (m2 <= 0) continue;

        // ── Ligne libre : prix ferme.
        if (seg.type === "libre") {
          items.push(segmentLibreItem(lotId, seg, tvaLot));
          continue;
        }

        const peaux = Number(seg.peaux) || 1;
        const nb_four = Math.round(m2 * four_ratio);
        const nb_susp = Math.round(nb_four / 1.4);
        const lisse_ml = Math.round(4 * Math.sqrt(m2));
        const plq_net = m2 * peaux;
        const plq = chuted(plq_net, chute);
        const plaqKey = `fp_ba13_${seg.type}`;
        const plaqLbl = pqLbls[seg.type] || "Plafond BA13";

        const zoneItems: EngineLigne[] = [
          _row("fp_suspente_res", nb_susp, `Suspentes à ressort — ${nb_susp} pce`, "pce", `~${(nb_susp / m2).toFixed(1)}/m²`),
          _row("fp_fourrure", nb_four, `Fourrures 47×17 — ${nb_four} ml`, "ml", `Entraxe ${ex} m`),
          _row("fp_lisse_peri", lisse_ml, `Lisses périphériques — ${lisse_ml} ml`, "ml", `4 × √${Math.round(m2)} m²`),
        ];
        if (seg.isolant && seg.isolant !== "non") {
          const isoKey = isoKeys[seg.isolant];
          if (isoKey)
            zoneItems.push(_row(isoKey, m2, isoLbls[seg.isolant] || isoKey, "m²", "Entre fourrures / plafond"));
        }
        zoneItems.push(
          _hrow(plaqKey, plq, `${plaqLbl} — ${peaux} peau${peaux > 1 ? "x" : ""} × ${m2} m²`, "m²", `Brut : ${plq} m² (+${chute}% chute, net ${plq_net} m²)`),
          _row("fp_visserie", m2, "Visserie TF plafond", "m²")
        );
        if (bandes) zoneItems.push(_row("fp_bande_joint", plq_net, `Bandes + enduit joints — ${plq_net} m²`, "m²", "Faces visibles"));

        for (const it of zoneItems) it.groupId = seg.id;
        items.push(...zoneItems);
      }
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
          items.push(segmentLibreItem(lotId, seg, tvaLot));
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
      // Modèle "segments" (patron cloisons) : une prestation par segment de
      // o.lignes. Deux familles : surfaces (briques déboursé €/m² → MO+marge)
      // et menuiseries (segment `libre`, prix ferme à l'unité). groupId = seg.id.
      const lignes = Array.isArray(o.lignes)
        ? (o.lignes as PeintureSegment[])
        : [];
      if (lignes.length === 0) return [];
      const tvaLot = state.lots[lotId].tva ?? state.tvaParDefaut;
      const items: EngineLigne[] = [];

      for (const seg of lignes) {
        const q = Number(seg.m2) || 0;
        if (q <= 0) continue;

        // ── Menuiserie (porte/fenêtre) : prix ferme à l'unité.
        if (seg.type === "libre") {
          items.push(segmentLibreItem(lotId, seg, tvaLot));
          continue;
        }

        // ── Surface : somme de briques déboursé (MO + marge appliqués par le
        //    moteur via tempsMoHeures + marge lot, comme cloisons).
        const support = (seg.support || "mur") as PeintureSupport;
        const nature = (seg.nature || "ancien") as PeintureNature;
        // Toile (nature ancien only) force 3 passes ; sinon passes saisies 0..3.
        const toile = nature === "ancien" && !!seg.toile;
        const passes = toile
          ? 3
          : Math.min(3, Math.max(0, Number(seg.passes) || 0));
        const finition = (seg.finition || "mat") as PeintureFinition;

        const supLbl = support === "mur" ? "Murs" : "Plafond";
        const natLbl = nature === "ancien" ? "support ancien" : "support BA13";
        // Base support = ligne hl (préparation + mise en peinture, finition mat
        // de référence). Les surcoûts (passes, toile, finition) s'y ajoutent.
        const zoneItems: EngineLigne[] = [
          _hrow(
            `peint_base_${support}_${nature}`,
            q,
            `${supLbl} — ${natLbl} : préparation + mise en peinture`,
            "m²"
          ),
        ];
        if (passes > 0) {
          zoneItems.push(
            _row(
              "peint_passe_enduit",
              q * passes,
              `Enduit de lissage — ${passes} passe${passes > 1 ? "s" : ""}`,
              "m²",
              `${q * passes} m²`
            )
          );
        }
        if (toile) {
          zoneItems.push(
            _row("peint_toile", q, "Toile à enduire (intissé de rénovation)", "m²")
          );
        }
        if (finition !== "mat") {
          zoneItems.push(
            _row(
              `peint_fin_${finition}`,
              q,
              `Surcoût finition ${finition === "velours" ? "velours" : "satinée"}`,
              "m²"
            )
          );
        }
        for (const it of zoneItems) it.groupId = seg.id;
        items.push(...zoneItems);
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

    // (Lot "etancheite" supprimé juin 2026 — l'étanchéité devient une OPTION
    //  des lots carrelage/faïence : modes liquide (SEL) / natte, mêmes clés BP
    //  etanche_liquide / natte_etanche / bande_etanche / colle_c2s.)

    case "parquet": {
      // Modèle "segments" (patron peinture) : une prestation par segment de
      // o.lignes. Matériau = ligne hl (brut +chute%) ; sous-couche / colle =
      // consommables du groupe. "plinthes" = segment dédié (ml). groupId = seg.id.
      const lignes = Array.isArray(o.lignes)
        ? (o.lignes as ParquetSegment[])
        : [];
      if (lignes.length === 0) return [];
      const tvaLot = state.lots[lotId].tva ?? state.tvaParDefaut;
      const chute = Number(o.chute) || 0;
      const MAT_LBL: Record<string, string> = {
        strat: "Parquet stratifié 8 mm",
        contre: "Parquet contrecollé 14 mm",
        massif: "Parquet massif 20 mm",
      };
      const MAT_KEY: Record<string, string> = {
        strat: "parquet_strat",
        contre: "parquet_contre",
        massif: "parquet_massif",
      };
      const items: EngineLigne[] = [];
      for (const seg of lignes) {
        const q = Number(seg.m2) || 0;
        if (q <= 0) continue;
        if (seg.type === "libre") {
          items.push(segmentLibreItem(lotId, seg, tvaLot));
          continue;
        }
        if (seg.type === "plinthes") {
          const pl = _hrow("parquet_plinthes", q, `Plinthes assorties — ${q} ml`, "ml", "Coupes + fixation");
          pl.groupId = seg.id;
          items.push(pl);
          continue;
        }
        const brut = chuted(q, chute);
        const zoneItems: EngineLigne[] = [
          _hrow(MAT_KEY[seg.type] || "parquet_strat", brut, `${MAT_LBL[seg.type] || "Parquet"} × ${q} m²`, "m²", `Brut : ${brut} m² (+${chute}% chute, net ${q} m²)`),
        ];
        if (seg.sc === "mousse") zoneItems.push(_row("sous_couche", q, "Sous-couche mousse", "m²"));
        else if (seg.sc === "liege") zoneItems.push(_row("sous_couche_liege", q, "Sous-couche liège 2 mm", "m²"));
        if (seg.colle === "ms") zoneItems.push(_row("colle_parquet", q, "Colle MS polymère", "m²", "1,2 kg/m² × 8 €/kg"));
        for (const it of zoneItems) it.groupId = seg.id;
        items.push(...zoneItems);
      }
      return items;
    }

    case "carrelage": {
      // Modèle "segments" (patron peinture/parquet) : une prestation par
      // segment de o.lignes. Carreau = ligne hl (brut +chute%), colle dérivée
      // de la DIMENSION (peigne — kg/m² à valider). "plinthes" (ml) et
      // "etancheite" (mode liquide/natte, UNE ligne) = segments dédiés.
      const lignes = Array.isArray(o.lignes)
        ? (o.lignes as CarrelageSegment[])
        : [];
      if (lignes.length === 0) return [];
      const tvaLot = state.lots[lotId].tva ?? state.tvaParDefaut;
      const chute = Number(o.chute) || 0;
      const TYPE_KEY: Record<string, string> = {
        ceram: "carrelage_std",
        gres: "gres_cerame",
        gf: "grand_format",
      };
      const TYPE_LBL: Record<string, string> = {
        ceram: "Carrelage céramique standard",
        gres: "Grès cérame rectifié",
        gf: "Grand format",
      };
      // kg de colle / m² selon dimension (peigne) — INDICATIF, à valider.
      const DIM_KG: Record<string, number> = { "30x30": 3, "60x60": 5, "60x120": 7 };
      const items: EngineLigne[] = [];
      for (const seg of lignes) {
        const q = Number(seg.m2) || 0;
        if (q <= 0) continue;
        if (seg.type === "libre") {
          items.push(segmentLibreItem(lotId, seg, tvaLot));
          continue;
        }
        if (seg.type === "plinthes") {
          const pl = _hrow("carrelage_plinthes", q, `Plinthes carrelées assorties — ${q} ml`, "ml", "Coupes + collage + joints");
          pl.groupId = seg.id;
          items.push(pl);
          continue;
        }
        if (seg.type === "etancheite") {
          const liquide = (seg.mode || "liquide") === "liquide";
          const et = _hrow(
            liquide ? "etanche_liquide" : "natte_etanche",
            q,
            liquide
              ? "Étanchéité liquide (SEL) sous carrelage"
              : "Natte d'étanchéité sous carrelage",
            "m²",
            liquide ? "2 couches croisées" : "Type KERDI / Wedi, joints traités"
          );
          et.groupId = seg.id;
          items.push(et);
          continue;
        }
        const brut = chuted(q, chute);
        const dim = seg.dim || "60x60";
        const kg = Math.ceil(q * (DIM_KG[dim] || 5));
        const zoneItems: EngineLigne[] = [
          _hrow(TYPE_KEY[seg.type] || "carrelage_std", brut, `${TYPE_LBL[seg.type] || "Carrelage"} ${dim.replace("x", "×")} × ${q} m²`, "m²", `Brut : ${brut} m² (+${chute}% chute, net ${q} m²)`),
          _row(
            seg.colle === "c2s" ? "colle_c2s" : "colle_carrelage",
            kg,
            `Colle ${seg.colle === "c2s" ? "C2S1 flex" : "C2 standard"} (${DIM_KG[dim] || 5} kg/m²)`,
            "kg"
          ),
        ];
        for (const it of zoneItems) it.groupId = seg.id;
        items.push(...zoneItems);
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
      // Plus de gammes (décision produit) : barème MONO-PRIX, clés non
      // suffixées (valeurs = ancienne gamme std, cf. bp.ts).
      if (wc_sol > 0) items.push(_hrow("wc_complet", wc_sol, `WC au sol — cuvette + réservoir + abattant${wc_sol > 1 ? " × " + wc_sol : ""}`, "pce"));
      if (wc_susp > 0) {
        items.push(_hrow("bati_support", wc_susp, `Bâti-support WC suspendu${wc_susp > 1 ? " × " + wc_susp : ""}`, "pce", "Geberit / Grohe / Viega"));
        items.push(_hrow("wc_suspendu_cuvette", wc_susp, `Cuvette WC suspendue${wc_susp > 1 ? " × " + wc_susp : ""}`, "pce", "Rimless"));
        items.push(_hrow("plaque_declenchement", wc_susp, `Plaque de déclenchement${wc_susp > 1 ? " × " + wc_susp : ""}`, "pce"));
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
          items.push(_hrow("receveur_90", nbDouche, `Receveur douche 90×90 + bonde${nbDouche > 1 ? " × " + nbDouche : ""}`, "pce"));
        }
        items.push(_hrow("mitigeur_douche", nbDouche, `Mitigeur douche + flexible + douchette${nbDouche > 1 ? " × " + nbDouche : ""}`, "pce"));
      }
      if (nbCuisine > 0) items.push(_hrow("mitigeur_cuisine", nbCuisine, `Mitigeur évier cuisine${nbCuisine > 1 ? " × " + nbCuisine : ""}`, "pce"));
      if (nbLavabo > 0) items.push(_hrow("mitigeur_lavabo", nbLavabo, `Mitigeur lavabo + siphon${nbLavabo > 1 ? " × " + nbLavabo : ""}`, "pce"));
      if (nbBain > 0) {
        items.push(_hrow("baignoire", nbBain, `Baignoire standard 170×75${nbBain > 1 ? " × " + nbBain : ""}`, "pce"));
        items.push(_hrow("mitigeur_bain", nbBain, `Mitigeur bain/douche${nbBain > 1 ? " × " + nbBain : ""}`, "pce"));
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
      // Installation réseau (tirage gaines + distribution) — au choix du devis :
      //   o.reseau_mode "m2"      → surface globale × prix/m² ÉDITABLE
      //                             (o.reseau_prix_m2 ?? BP.elec_reseau_m2).
      //   o.reseau_mode "forfait" → montant déboursé saisi (o.reseau_forfait).
      // Déboursé (prixEstFinal=false) → marge + MO du lot via totals.ts.
      const RESEAU_LBL =
        "Installation réseau électrique — tirage des gaines et distribution";
      if (o.reseau_mode === "m2") {
        const surf = Number(state.globalSurf) || 0;
        const prixM2 = Number(o.reseau_prix_m2) || BP.elec_reseau_m2 || 20;
        if (surf > 0) {
          items.push({
            key: "elec_reseau_m2",
            lotId,
            qty: surf,
            lbl: RESEAU_LBL,
            unit: "m²",
            note: "",
            p: prixM2,
            total: surf * prixM2,
            hl: false,
            prixEstFinal: false,
            afficheFourniture: false,
            tva: state.lots[lotId].tva ?? state.tvaParDefaut,
          });
        }
      } else if (o.reseau_mode === "forfait") {
        const f = Number(o.reseau_forfait) || 0;
        if (f > 0) {
          items.push({
            key: "elec_reseau_forfait",
            lotId,
            qty: 1,
            lbl: RESEAU_LBL,
            unit: "forfait",
            note: "",
            p: f,
            total: f,
            hl: false,
            prixEstFinal: false,
            afficheFourniture: false,
            tva: state.lots[lotId].tva ?? state.tvaParDefaut,
          });
        }
      }

      if (o.gtl) items.push(_row("elec_gtl", 1, "Gaine Technique Logement (GTL)", "forfait"));
      // Consuel = attestation : déboursé + marge MAIS AUCUNE main d'œuvre.
      if (o.consuel) {
        const ce = _row("elec_consuel", 1, "Attestation Consuel", "forfait", "Visa de conformité");
        ce.sansMO = true;
        items.push(ce);
      }
      if (o.terre) items.push(_row("elec_terre", 1, "Mise à la terre + distribution principale", "forfait", "Conducteur de terre + barrette + distribution réseau"));
      if (o.vmc === "sf") items.push(_row("elec_vmc_sf", 1, "VMC simple flux hygro-réglable", "forfait"));
      else if (o.vmc === "df") items.push(_row("elec_vmc_df", 1, "VMC double flux à échangeur", "forfait", "Rendement ≥ 85%"));

      // Points (catalogue-elec.ts) — postes inconnus ignorés silencieusement.
      // Override PONCTUEL par devis (o.pointsOverride) : pu et/ou libellé.
      // pu absent → prixVente catalogue ; lbl absent → libellé catalogue.
      const points = (o.points as Record<string, number> | undefined) || {};
      const overrides =
        (o.pointsOverride as Record<string, PointOverride> | undefined) || {};
      for (const [pid, qty] of Object.entries(points)) {
        if (!qty || qty <= 0) continue;
        const prestation = findPrestation(CATALOGUE_ELEC, pid);
        if (!prestation) continue;
        const line = pointRow(state, lotId, prestation, qty);
        const ov = overrides[pid];
        if (ov) {
          if (typeof ov.pu === "number" && ov.pu >= 0) {
            line.p = ov.pu;
            line.total = qty * ov.pu;
          }
          if (typeof ov.lbl === "string" && ov.lbl.trim()) {
            line.lbl = ov.lbl.trim();
          }
        }
        items.push(line);
      }
      return items;
    }

    default:
      return [];
  }
}
