// ============================================================
// SOCLE — Tests — lib/devis/engine/normalize.ts
//
// Couvre la ré-hydratation d'un EngineState sérialisé : round-trip sans
// perte, migrations legacy (slots cloisons, zones, gammes plombs, champ q)
// et préservation stricte des champs sensibles (coutRevientPoints, tva).
// ============================================================

import { describe, expect, it } from "vitest";
import { normalizeEngine } from "../lib/devis/engine/normalize";
import type { EngineHeader } from "../lib/devis/engine/normalize";
import type { CloisonSegment } from "../lib/devis/engine/types";
import { makeState } from "./helpers";

const HEADER: EngineHeader = {
  globalSurf: 60,
  tvaParDefaut: 10,
  remiseMode: "aucune",
  remiseValeur: 0,
};

describe("normalizeEngine — entrées dégénérées", () => {
  it("null / undefined / objet sans lots → état initial avec les valeurs du header", () => {
    for (const raw of [null, undefined, {}, "junk", 42]) {
      const s = normalizeEngine(raw, HEADER);
      expect(s.globalSurf).toBe(60);
      expect(s.tvaParDefaut).toBe(10);
      expect(Object.keys(s.lots)).toHaveLength(14);
      expect(s.lotsLibres).toEqual([]);
    }
  });

  it("tvaParDefaut invalide dans le JSON → valeur du header", () => {
    const s = normalizeEngine(
      { lots: {}, tvaParDefaut: 7 }, // 7 % n'existe pas
      HEADER
    );
    expect(s.tvaParDefaut).toBe(10);
  });

  it("remiseMode inconnu → valeur du header", () => {
    const s = normalizeEngine({ lots: {}, remiseMode: "cadeau" }, HEADER);
    expect(s.remiseMode).toBe("aucune");
  });
});

describe("normalizeEngine — round-trip sans perte", () => {
  it("un état moderne survit à JSON.stringify/parse à l'identique (champs sensibles)", () => {
    const state = makeState({ globalSurf: 43, tvaParDefaut: 20 });
    state.lots.demolition.on = true;
    state.lots.demolition.coutRevientPoints = 800;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 2 } });
    state.lots.iti.on = true;
    state.lots.iti.tva = 5.5;
    state.lots.cloisons.cp.ba13_std = 4.2;
    state.lots.cloisons.custom.push({
      id: "c1",
      lbl: "Custom",
      unit: "u",
      qty: 1,
      p: 10,
    });

    const back = normalizeEngine(JSON.parse(JSON.stringify(state)), HEADER);

    expect(back.globalSurf).toBe(43);
    expect(back.tvaParDefaut).toBe(20);
    expect(back.lots.demolition.coutRevientPoints).toBe(800);
    expect(back.lots.demolition.o.points).toEqual({ depose_wc: 2 });
    expect(back.lots.iti.tva).toBe(5.5);
    expect(back.lots.cloisons.cp.ba13_std).toBe(4.2);
    expect(back.lots.cloisons.custom).toHaveLength(1);
  });

  it("coutRevientPoints absent reste STRICTEMENT undefined (≠ 0, ≠ null)", () => {
    // 0 signifierait « coût de revient saisi à 0 € » → marge 100 % affichée.
    // undefined signifie « non renseigné » → alerte UI. La nuance est critique.
    const state = makeState();
    const back = normalizeEngine(JSON.parse(JSON.stringify(state)), HEADER);
    expect(back.lots.demolition.coutRevientPoints).toBeUndefined();
    expect("tva" in back.lots.iti && back.lots.iti.tva).toBeFalsy();
  });

  it("un lot absent du JSON reçoit un LotState neutre (on: false)", () => {
    const s = normalizeEngine({ lots: { cloisons: { on: true } } }, HEADER);
    expect(s.lots.cloisons.on).toBe(true);
    expect(s.lots.cuisine.on).toBe(false);
    expect(s.lots.cuisine.custom).toEqual([]);
  });
});

describe("normalizeEngine — migrations legacy", () => {
  it("cloisons : slots fixes (std_on/std_m2/…) convertis en segments o.lignes", () => {
    const raw = {
      lots: {
        cloisons: {
          on: true,
          o: {
            std_on: true,
            std_m2: 20,
            std_oss: "m70",
            std_acou: "lv45",
            std_peaux: "4",
            std_dbl_mont: true,
            hydro_on: false,
            hydro_m2: 15, // off → pas migré
            chute: 5,
          },
        },
      },
    };
    const s = normalizeEngine(raw, HEADER);
    const lignes = s.lots.cloisons.o.lignes as CloisonSegment[];
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({
      id: "seg_std",
      type: "std",
      oss: "m70",
      isolant: "lv", // lv45 → lv (épaisseur re-dérivée de l'ossature)
      peaux: "4",
      dbl: true,
      m2: 20,
    });
    expect(s.lots.cloisons.o.chute).toBe(5);
  });

  it("cloisons : migration idempotente (déjà au modèle segments → intact)", () => {
    const seg: CloisonSegment = {
      id: "s1",
      type: "hydro",
      oss: "m48",
      isolant: "non",
      peaux: "2",
      dbl: false,
      m2: 12,
    };
    const raw = { lots: { cloisons: { on: true, o: { lignes: [seg], chute: 3 } } } };
    const s = normalizeEngine(raw, HEADER);
    expect(s.lots.cloisons.o.lignes).toEqual([seg]);
    expect(s.lots.cloisons.o.chute).toBe(3);
  });

  it("faux-plafond : ancienne config unique → lignes vides, réglages lot préservés", () => {
    const raw = {
      lots: {
        fauxplafond: {
          on: true,
          o: { plaque: "hydro", joints: true, entraxe: "0.50", chute: 10 },
        },
      },
    };
    const s = normalizeEngine(raw, HEADER);
    expect(s.lots.fauxplafond.o.lignes).toEqual([]);
    expect(s.lots.fauxplafond.o.bandes).toBe(true); // joints → bandes
    expect(s.lots.fauxplafond.o.entraxe).toBe("0.50");
    expect(s.lots.fauxplafond.o.chute).toBe(10);
  });

  it("peinture/parquet/carrelage/faïence/ragréage : anciens modèles zones → lignes vides", () => {
    const raw = {
      lots: {
        peinture: { on: true, o: { z1_on: true, z1_m2: 30 } },
        parquet: { on: true, o: { z1_on: true, z1_m2: 18 } },
        carrelage: { on: true, o: { z1_on: true, z1_m2: 9 } },
        faience: { on: true, o: { z1_on: true, z1_m2: 6 } },
        ragreage: {
          on: true,
          o: { z1_on: true, z1_m2: 14, z1_type: "ragreage_simple", z1_epa_mm: 8 },
        },
      },
    };
    const s = normalizeEngine(raw, HEADER);
    for (const lid of [
      "peinture",
      "parquet",
      "carrelage",
      "faience",
      "ragreage",
    ] as const) {
      expect(s.lots[lid].o.lignes).toEqual([]);
    }
  });

  it("plombs : overrides cp gammés remappés (X_std → X, X_mid/X_prm supprimés)", () => {
    const raw = {
      lots: {
        plombs: {
          on: true,
          cp: {
            wc_complet_std: 99,
            mitigeur_douche_prm: 150, // orphelin → tombe
            reseau_mc: 14, // non gammé → conservé
          },
        },
      },
    };
    const s = normalizeEngine(raw, HEADER);
    expect(s.lots.plombs.cp).toEqual({ wc_complet: 99, reseau_mc: 14 });
  });

  it("champ legacy q (gammes) : purgé, jamais recopié en propriété fantôme", () => {
    const raw = { lots: { cloisons: { on: true, q: "prm", o: { lignes: [] } } } };
    const s = normalizeEngine(raw, HEADER);
    expect("q" in s.lots.cloisons).toBe(false);
  });
});
