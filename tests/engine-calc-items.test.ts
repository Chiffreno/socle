// ============================================================
// SOCLE — Tests — lib/devis/engine/calc-items.ts
//
// Couvre les helpers de prix (px, pxRag, lsurf, chuted) et la génération
// des lignes par lot (segments cloisons/ITI/faux-plafond/peinture/parquet/
// carrelage/faïence, points démolition/élec, zones ragréage, lots à
// quantités simples). Les prix attendus sont calculés à partir de BP
// importé : on teste les FORMULES, pas les valeurs de barème.
// ============================================================

import { describe, expect, it } from "vitest";
import { BP } from "../lib/devis/engine/bp";
import {
  calcItems,
  chuted,
  isMod,
  lsurf,
  px,
  pxRag,
} from "../lib/devis/engine/calc-items";
import type {
  CarrelageSegment,
  CloisonSegment,
  EngineLigne,
  FaienceSegment,
  FauxPlafondSegment,
  ItiSegment,
  ParquetSegment,
  PeintureSegment,
} from "../lib/devis/engine/types";
import { makeState } from "./helpers";

/** Raccourci : retrouve une ligne par clé BP/prestation (échoue si absente). */
function ligne(items: EngineLigne[], key: string): EngineLigne {
  const it = items.find((i) => i.key === key);
  expect(it, `ligne "${key}" attendue`).toBeDefined();
  return it!;
}

describe("px — prix unitaire matériau", () => {
  it("renvoie le prix BP de base", () => {
    const state = makeState();
    expect(px(state, "cloisons", "ba13_std")).toBe(BP.ba13_std);
  });

  it("applique le coefficient global (%) sur les prix BP", () => {
    const state = makeState({ globalCoeff: 10 });
    expect(px(state, "cloisons", "ba13_std")).toBeCloseTo(BP.ba13_std * 1.1, 10);
  });

  it("l'override artisan (cp) prime sur BP ET sur le coefficient global", () => {
    const state = makeState({ globalCoeff: 50 });
    state.lots.cloisons.cp.ba13_std = 3.33;
    expect(px(state, "cloisons", "ba13_std")).toBe(3.33);
    expect(isMod(state, "cloisons", "ba13_std")).toBe(true);
    expect(isMod(state, "cloisons", "rail_r48")).toBe(false);
  });

  it("clé inconnue → 0 (pas de NaN)", () => {
    const state = makeState();
    expect(px(state, "cloisons", "cle_inexistante")).toBe(0);
  });

  it("un override est local à SON lot", () => {
    const state = makeState();
    state.lots.cloisons.cp.ba13_std = 99;
    expect(px(state, "fauxplafond", "ba13_std")).toBe(BP.ba13_std);
  });
});

describe("pxRag — prix ragréage scalé par l'épaisseur", () => {
  it("scale proportionnellement à l'épaisseur de référence (simple : 5 mm)", () => {
    const state = makeState();
    expect(pxRag(state, "ragreage", "ragreage_simple", 5)).toBe(
      BP.ragreage_simple
    );
    expect(pxRag(state, "ragreage", "ragreage_simple", 10)).toBeCloseTo(
      BP.ragreage_simple * 2,
      10
    );
  });

  it("référence fibré : 8 mm", () => {
    const state = makeState();
    expect(pxRag(state, "ragreage", "ragreage_fibre", 8)).toBeCloseTo(
      BP.ragreage_fibre,
      10
    );
  });

  it("l'override artisan court-circuite le scaling", () => {
    const state = makeState();
    state.lots.ragreage.cp.ragreage_simple = 7;
    expect(pxRag(state, "ragreage", "ragreage_simple", 10)).toBe(7);
  });
});

describe("lsurf / chuted", () => {
  it("lsurf : surface du lot si saisie, sinon surface globale", () => {
    const state = makeState({ globalSurf: 80 });
    expect(lsurf(state, "plombs")).toBe(80);
    state.lots.plombs.surf = 25;
    expect(lsurf(state, "plombs")).toBe(25);
  });

  it("chuted : applique la chute % avec arrondi à 1 décimale", () => {
    expect(chuted(100, 5)).toBe(105);
    expect(chuted(50, 5)).toBe(52.5);
    expect(chuted(100, "7.5")).toBe(107.5); // les % en string sont acceptés
    expect(chuted(100, 0)).toBe(100);
    expect(chuted(100, undefined)).toBe(100);
    expect(chuted(10.33, 0)).toBe(10.3); // arrondi à 0,1 près
  });
});

describe("calcItems — cloisons (modèle segments)", () => {
  function segState(seg: Partial<CloisonSegment>, chute = 5) {
    const state = makeState();
    state.lots.cloisons.on = true;
    Object.assign(state.lots.cloisons.o, {
      chute,
      lignes: [
        {
          id: "seg1",
          type: "std",
          oss: "m48",
          isolant: "non",
          peaux: "2",
          dbl: false,
          m2: 25,
          ...seg,
        } satisfies CloisonSegment,
      ],
    });
    return state;
  }

  it("segment standard M48 25 m² : 7 lignes aux quantités métier attendues", () => {
    const items = calcItems(segState({}), "cloisons");
    expect(items).toHaveLength(7);

    // Rails : 0,8 ml/m² → 20 ml.
    const rails = ligne(items, "rail_r48");
    expect(rails.qty).toBe(20);
    expect(rails.total).toBeCloseTo(20 * BP.rail_r48, 10);

    // Montants : 1,7 ml/m² → 43 ml (arrondi).
    expect(ligne(items, "mont_m48").qty).toBe(43);

    // Plaques : 2 peaux × 25 m² = 50 m² net, +5 % chute = 52,5 m² brut.
    const plaques = ligne(items, "ba13_std");
    expect(plaques.qty).toBe(52.5);
    expect(plaques.hl).toBe(true); // produit principal de la prestation
    expect(plaques.total).toBeCloseTo(52.5 * BP.ba13_std, 10);

    // Bande à joint : 3 ml/m² → 75 ml ; enduit sur le net (50 m²).
    expect(ligne(items, "bande_joint").qty).toBe(75);
    expect(ligne(items, "enduit_bande").qty).toBe(50);

    // Toutes les lignes sont rattachées au segment (groupId) et en déboursé.
    for (const it of items) {
      expect(it.groupId).toBe("seg1");
      expect(it.prixEstFinal).toBe(false);
    }
  });

  it("montants doublés (dbl) : quantité montants × 2", () => {
    const items = calcItems(segState({ dbl: true }), "cloisons");
    expect(ligne(items, "mont_m48").qty).toBe(86); // 43 × 2
  });

  it("isolant dérivé de l'ossature : lv + M70 → clé lv70", () => {
    const items = calcItems(segState({ isolant: "lv", oss: "m70" }), "cloisons");
    const iso = ligne(items, "lv70");
    expect(iso.qty).toBe(25);
    // Le rail suit aussi l'ossature (M70 → R70, le quirk M70→R48 est corrigé).
    expect(items.some((i) => i.key === "rail_r70")).toBe(true);
    expect(items.some((i) => i.key === "rail_r48")).toBe(false);
  });

  it("4 peaux : plaques sur 4 faces (100 m² net pour 25 m² de cloison)", () => {
    const items = calcItems(segState({ peaux: "4" }, 0), "cloisons");
    // ⚠️ chute=0 est retombé à 5 % par le moteur (voir test dédié ci-dessous).
    expect(ligne(items, "ba13_std").qty).toBe(105); // 100 × 1,05
  });

  it("COMPORTEMENT SUSPECT documenté : chute 0 impossible (retombe à 5 %)", () => {
    // calc-items utilise `Number(o.chute) || 5` : une chute explicitement
    // saisie à 0 % retombe silencieusement à 5 %. Incohérent avec l'état
    // initial (chute: 0 dans lots.ts) et avec les autres lots segments
    // (parquet/carrelage/faïence utilisent `|| 0`). Signalé dans le rapport.
    const items = calcItems(segState({}, 0), "cloisons");
    expect(ligne(items, "ba13_std").qty).toBe(52.5); // 50 × 1,05 — pas 50
  });

  it("segment libre : prix de vente ferme qty × pu, aucune marge moteur", () => {
    const state = makeState();
    state.lots.cloisons.on = true;
    Object.assign(state.lots.cloisons.o, {
      lignes: [
        {
          id: "L1",
          type: "libre",
          oss: "m48",
          isolant: "non",
          peaux: "2",
          dbl: false,
          m2: 3,
          puOverride: 150,
          lbl: "Trappe technique",
          unit: "u",
        } satisfies CloisonSegment,
      ],
    });
    const items = calcItems(state, "cloisons");
    expect(items).toHaveLength(1);
    expect(items[0].prixEstFinal).toBe(true);
    expect(items[0].total).toBe(450);
    expect(items[0].lbl).toBe("Trappe technique");
  });

  it("segments à 0 m² ou négatifs : ignorés", () => {
    const state = segState({ m2: 0 });
    expect(calcItems(state, "cloisons")).toHaveLength(0);
    const state2 = segState({ m2: -10 });
    expect(calcItems(state2, "cloisons")).toHaveLength(0);
  });

  it("o.lignes absent ou non-tableau : aucune ligne, pas de crash", () => {
    const state = makeState();
    state.lots.cloisons.on = true;
    Object.assign(state.lots.cloisons.o, { lignes: undefined });
    expect(calcItems(state, "cloisons")).toHaveLength(0);
  });
});

describe("calcItems — ITI (modèle segments)", () => {
  function itiState(seg: Partial<ItiSegment>) {
    const state = makeState();
    state.lots.iti.on = true;
    Object.assign(state.lots.iti.o, {
      lignes: [
        {
          id: "i1",
          type: "lv",
          epa: "100",
          membrane: false,
          parement: "aucun",
          m2: 30,
          ...seg,
        } satisfies ItiSegment,
      ],
    });
    return state;
  }

  it("segment LV 100 mm 30 m² : ossature + appuis + isolant (ligne hl avec R)", () => {
    const items = calcItems(itiState({}), "iti");
    expect(items).toHaveLength(3);
    expect(ligne(items, "iti_oss").total).toBeCloseTo(30 * BP.iti_oss, 10);
    expect(ligne(items, "iti_appuis").qty).toBe(30);
    const iso = ligne(items, "iti_iso_lv_100");
    expect(iso.hl).toBe(true);
    expect(iso.lbl).toContain("R ≈ 3"); // 0,100 / 0,035 = 2,86 → arrondi 0,5 → 3
    expect(iso.total).toBeCloseTo(30 * BP.iti_iso_lv_100, 10);
  });

  it("membrane : ajoute Vario + scotch (0,7 ml/m²) + pastilles", () => {
    const items = calcItems(itiState({ membrane: true }), "iti");
    expect(items).toHaveLength(6);
    expect(ligne(items, "iti_scotch").qty).toBe(21); // round(30 × 0,7)
    expect(ligne(items, "iti_vario").qty).toBe(30);
  });

  it("parement BA13 hydrofuge : clé iti_ba13_hydro", () => {
    const items = calcItems(itiState({ parement: "ba13_hydro" }), "iti");
    expect(ligne(items, "iti_ba13_hydro").qty).toBe(30);
  });
});

describe("calcItems — faux-plafond (modèle segments)", () => {
  it("segment std 20 m², entraxe 0,6 : ratios suspentes/fourrures/lisses", () => {
    const state = makeState();
    state.lots.fauxplafond.on = true;
    Object.assign(state.lots.fauxplafond.o, {
      entraxe: "0.60",
      bandes: false,
      chute: 0,
      lignes: [
        {
          id: "f1",
          type: "std",
          isolant: "non",
          peaux: "1",
          m2: 20,
        } satisfies FauxPlafondSegment,
      ],
    });
    const items = calcItems(state, "fauxplafond");
    // four_ratio = round((1/0,6 + 0,4) × 10)/10 = 2,1 → 42 ml de fourrures.
    expect(ligne(items, "fp_fourrure").qty).toBe(42);
    expect(ligne(items, "fp_suspente_res").qty).toBe(30); // round(42 / 1,4)
    expect(ligne(items, "fp_lisse_peri").qty).toBe(18); // round(4 × √20)
    const plaque = ligne(items, "fp_ba13_std");
    expect(plaque.qty).toBe(20);
    expect(plaque.hl).toBe(true);
    expect(items.some((i) => i.key === "fp_bande_joint")).toBe(false);
  });

  it("bandes + isolant + double peau : lignes additionnelles", () => {
    const state = makeState();
    state.lots.fauxplafond.on = true;
    Object.assign(state.lots.fauxplafond.o, {
      entraxe: "0.60",
      bandes: true,
      chute: 10,
      lignes: [
        {
          id: "f2",
          type: "hydro",
          isolant: "lv100",
          peaux: "2",
          m2: 10,
        } satisfies FauxPlafondSegment,
      ],
    });
    const items = calcItems(state, "fauxplafond");
    expect(ligne(items, "fp_lv_100").qty).toBe(10);
    // 2 peaux × 10 m² = 20 m² net, +10 % = 22 m² brut.
    expect(ligne(items, "fp_ba13_hydro").qty).toBe(22);
    // Bandes calculées sur le net (faces visibles).
    expect(ligne(items, "fp_bande_joint").qty).toBe(20);
  });
});

describe("calcItems — peinture (modèle segments, deux familles)", () => {
  function peintState(seg: Partial<PeintureSegment>) {
    const state = makeState();
    state.lots.peinture.on = true;
    Object.assign(state.lots.peinture.o, {
      lignes: [
        {
          id: "p1",
          type: "surface",
          support: "mur",
          nature: "ancien",
          passes: 2,
          toile: false,
          finition: "mat",
          m2: 20,
          ...seg,
        } satisfies PeintureSegment,
      ],
    });
    return state;
  }

  it("surface mur ancien, 2 passes, finition mat : base + enduit, pas de surcoût", () => {
    const items = calcItems(peintState({}), "peinture");
    expect(items).toHaveLength(2);
    const base = ligne(items, "peint_base_mur_ancien");
    expect(base.hl).toBe(true);
    expect(base.total).toBeCloseTo(20 * BP.peint_base_mur_ancien, 10);
    expect(ligne(items, "peint_passe_enduit").qty).toBe(40); // 20 m² × 2 passes
  });

  it("toile à enduire : force 3 passes et ajoute la ligne toile", () => {
    const items = calcItems(peintState({ toile: true, passes: 1 }), "peinture");
    expect(ligne(items, "peint_passe_enduit").qty).toBe(60); // forcé à 3
    expect(ligne(items, "peint_toile").qty).toBe(20);
  });

  it("toile ignorée sur support BA13 (réservée au support ancien)", () => {
    const items = calcItems(
      peintState({ nature: "ba13", toile: true, passes: 1 }),
      "peinture"
    );
    expect(items.some((i) => i.key === "peint_toile")).toBe(false);
    expect(ligne(items, "peint_passe_enduit").qty).toBe(20); // passes non forcées
  });

  it("finition satinée : ligne de surcoût dédiée", () => {
    const items = calcItems(peintState({ finition: "satine" }), "peinture");
    expect(ligne(items, "peint_fin_satine").total).toBeCloseTo(
      20 * BP.peint_fin_satine,
      10
    );
  });

  it("passes hors bornes : clampées à [0..3]", () => {
    const items5 = calcItems(
      peintState({ passes: 5 as never }),
      "peinture"
    );
    expect(ligne(items5, "peint_passe_enduit").qty).toBe(60); // clampé à 3
    const itemsNeg = calcItems(
      peintState({ passes: -2 as never }),
      "peinture"
    );
    expect(itemsNeg.some((i) => i.key === "peint_passe_enduit")).toBe(false);
  });

  it("menuiserie (segment libre) : prix ferme à l'unité", () => {
    const items = calcItems(
      peintState({
        type: "libre",
        menuiserie: "porte",
        lbl: "Peinture de porte",
        unit: "u",
        m2: 3,
        puOverride: 45,
      }),
      "peinture"
    );
    expect(items).toHaveLength(1);
    expect(items[0].prixEstFinal).toBe(true);
    expect(items[0].total).toBe(135);
  });
});

describe("calcItems — parquet / carrelage / faïence (modèle segments)", () => {
  it("parquet stratifié 20 m², chute 10 %, sous-couche mousse, collé", () => {
    const state = makeState();
    state.lots.parquet.on = true;
    Object.assign(state.lots.parquet.o, {
      chute: 10,
      lignes: [
        {
          id: "pq1",
          type: "strat",
          colle: "ms",
          sc: "mousse",
          m2: 20,
        } satisfies ParquetSegment,
      ],
    });
    const items = calcItems(state, "parquet");
    const lame = ligne(items, "parquet_strat");
    expect(lame.qty).toBe(22); // brut +10 %
    expect(lame.hl).toBe(true);
    expect(ligne(items, "sous_couche").qty).toBe(20); // consommables sur le net
    expect(ligne(items, "colle_parquet").qty).toBe(20);
  });

  it("plinthes parquet : segment dédié au ml", () => {
    const state = makeState();
    state.lots.parquet.on = true;
    Object.assign(state.lots.parquet.o, {
      lignes: [
        { id: "pl1", type: "plinthes", m2: 12 } satisfies ParquetSegment,
      ],
    });
    const items = calcItems(state, "parquet");
    expect(items).toHaveLength(1);
    expect(items[0].key).toBe("parquet_plinthes");
    expect(items[0].unit).toBe("ml");
    expect(items[0].total).toBeCloseTo(12 * BP.parquet_plinthes, 10);
  });

  it("carrelage : colle forfaitaire (5 kg/m²), indépendante du texte dimension", () => {
    const state = makeState();
    state.lots.carrelage.on = true;
    Object.assign(state.lots.carrelage.o, {
      chute: 0,
      lignes: [
        {
          id: "c1",
          type: "gres",
          dim: "60 × 120 cm", // texte libre descriptif — n'entre pas dans le calcul
          m2: 15,
        } satisfies CarrelageSegment,
      ],
    });
    const items = calcItems(state, "carrelage");
    expect(ligne(items, "gres_cerame").qty).toBe(15);
    // Forfait 5 kg/m² → ceil(15 × 5) = 75 kg, colle C2 standard (colle_carrelage).
    const colle = ligne(items, "colle_carrelage");
    expect(colle.qty).toBe(75);
    expect(colle.unit).toBe("kg");
  });

  it("option étanchéité carrelage : une ligne SEL (liquide) ou natte", () => {
    const state = makeState();
    state.lots.carrelage.on = true;
    Object.assign(state.lots.carrelage.o, {
      lignes: [
        {
          id: "e1",
          type: "etancheite",
          mode: "liquide",
          m2: 5,
        } satisfies CarrelageSegment,
        {
          id: "e2",
          type: "etancheite",
          mode: "natte",
          m2: 4,
        } satisfies CarrelageSegment,
      ],
    });
    const items = calcItems(state, "carrelage");
    expect(ligne(items, "etanche_liquide").total).toBeCloseTo(
      5 * BP.etanche_liquide,
      10
    );
    expect(ligne(items, "natte_etanche").total).toBeCloseTo(
      4 * BP.natte_etanche,
      10
    );
  });

  it("faïence : colle forfaitaire (4 kg/m²) + primaire d'accrochage en option", () => {
    const state = makeState();
    state.lots.faience.on = true;
    Object.assign(state.lots.faience.o, {
      chute: 0,
      lignes: [
        {
          id: "fa1",
          type: "fai",
          dim: "20 × 30 cm", // texte libre — n'entre pas dans le calcul
          sc: "primaire",
          m2: 10,
        } satisfies FaienceSegment,
      ],
    });
    const items = calcItems(state, "faience");
    expect(ligne(items, "faience_std").qty).toBe(10);
    expect(ligne(items, "colle_faience").qty).toBe(40); // forfait 4 kg/m²
    expect(ligne(items, "primaire_accrochage").qty).toBe(10);
  });
});

describe("calcItems — ragréage (zones)", () => {
  it("zone simple 12 m² / 10 mm : prix scalé, epa porté par la ligne", () => {
    const state = makeState();
    state.lots.ragreage.on = true;
    Object.assign(state.lots.ragreage.o, {
      z1_on: true,
      z1_m2: 12,
      z1_type: "ragreage_simple",
      z1_epa_mm: 10,
      primaire: true,
      bandes: true,
      ml_bandes: 8,
    });
    const items = calcItems(state, "ragreage");
    const rag = ligne(items, "ragreage_simple");
    expect(rag.qty).toBe(12);
    expect(rag.p).toBeCloseTo(BP.ragreage_simple * 2, 10); // 10 mm vs réf 5 mm
    expect(rag.epa).toBe(10);
    expect(ligne(items, "primaire_ragreage").qty).toBe(12);
    expect(ligne(items, "bande_resiliente").qty).toBe(8);
  });

  it("aucune zone active → aucune ligne (même si primaire coché)", () => {
    const state = makeState();
    state.lots.ragreage.on = true;
    Object.assign(state.lots.ragreage.o, { primaire: true });
    expect(calcItems(state, "ragreage")).toHaveLength(0);
  });
});

describe("calcItems — démolition (100 % points)", () => {
  it("une ligne prixEstFinal par poste avec quantité > 0", () => {
    const state = makeState();
    state.lots.demolition.on = true;
    Object.assign(state.lots.demolition.o, {
      points: {
        depose_cloison_placo: 20, // 20 × 22 €
        depose_wc: 1, // 65 €
        poste_inconnu: 5, // ignoré silencieusement
        depose_lavabo: 0, // qty 0 → ignoré
      },
    });
    const items = calcItems(state, "demolition");
    expect(items).toHaveLength(2);
    expect(ligne(items, "depose_cloison_placo").total).toBe(440);
    expect(ligne(items, "depose_wc").total).toBe(65);
    for (const it of items) {
      expect(it.prixEstFinal).toBe(true);
      expect(it.afficheFourniture).toBe(false);
    }
  });
});

describe("calcItems — élec (lot hybride infra + points)", () => {
  it("tableau N rangées : ligne forfait, bornée à 6 rangées", () => {
    const state = makeState();
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, { tableau_rangees: 3 });
    const items = calcItems(state, "elec");
    expect(ligne(items, "elec_tableau_3r").total).toBe(BP.elec_tableau_3r);

    Object.assign(state.lots.elec.o, { tableau_rangees: 7 });
    expect(calcItems(state, "elec")).toHaveLength(0); // > 6 → pas de ligne
  });

  it("réseau au m² : surface globale × prix éditable (déboursé)", () => {
    const state = makeState({ globalSurf: 50 });
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, {
      reseau_mode: "m2",
      reseau_prix_m2: 18,
    });
    const items = calcItems(state, "elec");
    const reseau = ligne(items, "elec_reseau_m2");
    expect(reseau.qty).toBe(50);
    expect(reseau.total).toBe(900);
    expect(reseau.prixEstFinal).toBe(false);
  });

  it("COMPORTEMENT SUSPECT documenté : prix réseau saisi à 0 → retombe au prix BP", () => {
    // `Number(o.reseau_prix_m2) || BP.elec_reseau_m2` : impossible de saisir
    // un prix réseau de 0 €/m² (offert) — il retombe sur le BP (20 €/m²).
    // Signalé dans le rapport.
    const state = makeState({ globalSurf: 50 });
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, { reseau_mode: "m2", reseau_prix_m2: 0 });
    const items = calcItems(state, "elec");
    expect(ligne(items, "elec_reseau_m2").p).toBe(BP.elec_reseau_m2);
  });

  it("réseau au forfait : montant saisi, ignoré si ≤ 0", () => {
    const state = makeState();
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, {
      reseau_mode: "forfait",
      reseau_forfait: 800,
    });
    expect(ligne(calcItems(state, "elec"), "elec_reseau_forfait").total).toBe(
      800
    );

    Object.assign(state.lots.elec.o, { reseau_forfait: 0 });
    expect(calcItems(state, "elec")).toHaveLength(0);
  });

  it("Consuel : ligne déboursé marquée sansMO (marge mais pas de MO)", () => {
    const state = makeState();
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, { consuel: true });
    const consuel = ligne(calcItems(state, "elec"), "elec_consuel");
    expect(consuel.sansMO).toBe(true);
    expect(consuel.prixEstFinal).toBe(false);
  });

  it("points élec : prix de vente catalogue, TVA de la prestation", () => {
    const state = makeState({ tvaParDefaut: 20 });
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, { points: { prise_simple_16a: 3 } });
    const items = calcItems(state, "elec");
    expect(items).toHaveLength(1);
    expect(items[0].total).toBeCloseTo(3 * 126.7, 10);
    expect(items[0].prixEstFinal).toBe(true);
    expect(items[0].tva).toBe(10); // TVA catalogue, pas celle du devis (20)
    expect(items[0].prestationId).toBe("prise_simple_16a");
  });

  it("override ponctuel d'un point : prix et libellé remplacés sur CE devis", () => {
    const state = makeState();
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, {
      points: { prise_simple_16a: 2 },
      pointsOverride: {
        prise_simple_16a: { pu: 100, lbl: "Prise renforcée" },
      },
    });
    const items = calcItems(state, "elec");
    expect(items[0].p).toBe(100);
    expect(items[0].total).toBe(200);
    expect(items[0].lbl).toBe("Prise renforcée");
  });

  it("override invalide (pu négatif, lbl vide) : ignoré, catalogue conservé", () => {
    const state = makeState();
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, {
      points: { prise_simple_16a: 1 },
      pointsOverride: { prise_simple_16a: { pu: -5, lbl: "   " } },
    });
    const items = calcItems(state, "elec");
    expect(items[0].p).toBe(126.7);
    expect(items[0].lbl).not.toBe("   ");
  });

  it("override pu = 0 : accepté (point offert)", () => {
    const state = makeState();
    state.lots.elec.on = true;
    Object.assign(state.lots.elec.o, {
      points: { prise_simple_16a: 2 },
      pointsOverride: { prise_simple_16a: { pu: 0 } },
    });
    const items = calcItems(state, "elec");
    expect(items[0].total).toBe(0);
  });
});

describe("calcItems — lots à quantités simples", () => {
  it("plombs : réseau sur la surface, équipements selon points d'eau", () => {
    const state = makeState({ globalSurf: 40 });
    state.lots.plombs.on = true;
    Object.assign(state.lots.plombs.o, {
      pts: { douche: 1, cuisine: 1, lavabo: 0, bain: 0 },
      wc_susp: 1,
      reseau_type: "mc",
      douche_type: "receveur",
      ce: "ce_thermo",
    });
    const items = calcItems(state, "plombs");
    expect(ligne(items, "reseau_mc").total).toBeCloseTo(40 * BP.reseau_mc, 10);
    expect(ligne(items, "bati_support").qty).toBe(1);
    expect(ligne(items, "receveur_90").qty).toBe(1);
    expect(ligne(items, "mitigeur_cuisine").qty).toBe(1);
    expect(ligne(items, "ce_thermo").total).toBe(BP.ce_thermo);
    // Produit fini : la ligne hl affiche sa part fourniture sur le devis.
    expect(ligne(items, "bati_support").afficheFourniture).toBe(true);
  });

  it("douche à carreler : receveur + bonde + kit étanchéité (3,5 m²/douche)", () => {
    const state = makeState({ globalSurf: 40 });
    state.lots.plombs.on = true;
    Object.assign(state.lots.plombs.o, {
      pts: { douche: 2, cuisine: 0, lavabo: 0, bain: 0 },
      douche_type: "carreler",
    });
    const items = calcItems(state, "plombs");
    expect(ligne(items, "receveur_carreler").qty).toBe(2);
    expect(ligne(items, "kit_etanche_douche").qty).toBe(7); // 2 × 3,5
  });

  it("menuiseries ext. : seuls les postes à quantité > 0 produisent une ligne", () => {
    const state = makeState();
    state.lots.menuext.on = true;
    Object.assign(state.lots.menuext.o, { nb_fen: 2, type_fen: "fenetre_alu" });
    const items = calcItems(state, "menuext");
    expect(items).toHaveLength(1);
    expect(items[0].total).toBeCloseTo(2 * BP.fenetre_alu, 10);
  });

  it("cuisine : meubles au ml + électroménager booléen", () => {
    const state = makeState();
    state.lots.cuisine.on = true;
    Object.assign(state.lots.cuisine.o, {
      ml_bas: 3,
      type_pt: "plan_travail_qtz",
      ml_pt: 3,
      four: true,
    });
    const items = calcItems(state, "cuisine");
    expect(ligne(items, "meuble_bas").total).toBeCloseTo(3 * BP.meuble_bas, 10);
    expect(ligne(items, "plan_travail_qtz").qty).toBe(3);
    expect(ligne(items, "four").qty).toBe(1);
    expect(items.some((i) => i.key === "hotte")).toBe(false);
  });

  it("lignes custom : ajoutées après les lignes moteur, clé préfixée _c_", () => {
    const state = makeState();
    state.lots.menus.on = true;
    state.lots.menus.custom.push({
      id: "abc",
      lbl: "Habillage escalier",
      unit: "forfait",
      qty: 1,
      p: 600,
    });
    const items = calcItems(state, "menus");
    const custom = items[items.length - 1];
    expect(custom.key).toBe("_c_abc");
    expect(custom.custom).toBe(true);
    expect(custom.total).toBe(600);
    expect(custom.prixEstFinal).toBe(false); // déboursé : marge+MO s'appliquent
  });
});
