// ============================================================
// SOCLE — Tests — lib/devis/engine/totals.ts
//
// Couvre la formule MARGE+MO option A, les lignes prixEstFinal (points),
// les lignes sansMO (Consuel), la remise globale, la ventilation TVA par
// taux et les régimes franchise / autoliquidation.
// ============================================================

import { describe, expect, it } from "vitest";
import {
  calcEngineTotaux,
  calcLotTotaux,
  lineClientCA,
  lotCAContext,
  round2,
} from "../lib/devis/engine/totals";
import { addCustomLine, makeState } from "./helpers";

describe("round2", () => {
  it("arrondit au centime (cas simples)", () => {
    // Vérifie l'arrondi standard à 2 décimales utilisé partout dans le moteur.
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(10)).toBe(10);
    expect(round2(0)).toBe(0);
  });

  it("est robuste au bruit flottant (1.005 → 1.01, pas 1.00)", () => {
    // 1.005 * 100 = 100.4999… en flottant ; Number.EPSILON corrige cette
    // dérive — c'est la raison d'être de la formule de round2.
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  it("gère les négatifs", () => {
    expect(round2(-1.234)).toBe(-1.23);
  });
});

describe("calcLotTotaux — formule MARGE + MO (option A)", () => {
  it("caDeboursé = (matériaux + MO) × (1 + marge%)", () => {
    // Lot avec déboursé contrôlé de 100 € (ligne custom 10 × 10 €),
    // marge 30 %, MO = 2 h × 50 €/h = 100 €.
    // Attendu : caDeboursé = (100 + 100) × 1,30 = 260 ; marge = 60.
    const state = makeState();
    addCustomLine(state, "cloisons", 10, 10);
    state.lots.cloisons.m = 30;
    state.lots.cloisons.tempsMoHeures = 2;

    const lt = calcLotTotaux(state, "cloisons", 50);
    expect(lt.deboursé).toBe(100);
    expect(lt.MO).toBe(100);
    expect(lt.caDeboursé).toBe(260);
    expect(lt.margeDeboursé).toBe(60);
    expect(lt.caLot).toBe(260);
    expect(lt.caPoints).toBe(0);
    expect(lt.hasPoints).toBe(false);
  });

  it("un lot inactif ne produit aucune ligne ni aucun total", () => {
    const state = makeState();
    addCustomLine(state, "cloisons", 10, 10);
    state.lots.cloisons.on = false; // désactivé après ajout

    const lt = calcLotTotaux(state, "cloisons", 50);
    expect(lt.items).toHaveLength(0);
    expect(lt.caLot).toBe(0);
    expect(lt.active).toBe(false);
  });

  it("marge 0 et MO 0 → caDeboursé = déboursé brut", () => {
    const state = makeState();
    addCustomLine(state, "cloisons", 4, 25);
    const lt = calcLotTotaux(state, "cloisons", 0);
    expect(lt.caDeboursé).toBe(100);
    expect(lt.margeDeboursé).toBe(0);
  });

  it("points (prixEstFinal) : ni marge ni MO, CA = prix catalogue brut", () => {
    // Démolition = lot 100 % points : depose_wc (65 €) × 2 = 130 €.
    // La marge du lot (50 %) et la MO ne doivent PAS s'appliquer aux points.
    const state = makeState();
    state.lots.demolition.on = true;
    state.lots.demolition.m = 50; // ne doit avoir AUCUN effet sur les points
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 2 } });

    const lt = calcLotTotaux(state, "demolition", 45);
    expect(lt.caPoints).toBe(130);
    expect(lt.deboursé).toBe(0);
    expect(lt.caDeboursé).toBe(0);
    expect(lt.caLot).toBe(130);
    expect(lt.hasPoints).toBe(true);
  });

  it("margePoints = caPoints − coutRevientPoints quand le coût est saisi", () => {
    const state = makeState();
    state.lots.demolition.on = true;
    state.lots.demolition.coutRevientPoints = 100;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 2 } });

    const lt = calcLotTotaux(state, "demolition", 0);
    expect(lt.coutRevientPoints).toBe(100);
    expect(lt.margePoints).toBe(30); // 130 − 100
  });

  it("margePoints = null (non renseignée, ≠ 0) quand coutRevientPoints absent", () => {
    // Distinction critique : "non saisi" ne doit pas être confondu avec
    // "coût de revient = 0 €" (qui donnerait une marge de 100 %).
    const state = makeState();
    state.lots.demolition.on = true;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 2 } });

    const lt = calcLotTotaux(state, "demolition", 0);
    expect(lt.coutRevientPoints).toBeNull();
    expect(lt.margePoints).toBeNull();
  });

  it("lot hybride (élec) : caLot = caDeboursé + caPoints", () => {
    // Infra au forfait (1 000 € déboursé) + 2 prises (126,70 € pièce, prix ferme).
    const state = makeState({ globalSurf: 50 });
    state.lots.elec.on = true;
    state.lots.elec.m = 20;
    state.lots.elec.tempsMoHeures = 10;
    Object.assign(state.lots.elec.o, {
      reseau_mode: "forfait",
      reseau_forfait: 1000,
      points: { prise_simple_16a: 2 },
    });

    const lt = calcLotTotaux(state, "elec", 45);
    expect(lt.deboursé).toBe(1000);
    expect(lt.MO).toBe(450);
    expect(lt.caDeboursé).toBe(round2((1000 + 450) * 1.2)); // 1740
    expect(lt.caPoints).toBe(253.4); // 2 × 126,70
    expect(lt.caLot).toBe(round2(1740 + 253.4));
  });
});

describe("lotCAContext / lineClientCA — ventilation du CA par ligne (source unique)", () => {
  it("sans ligne sansMO : coefAvecMO = caDeboursé / deboursé (coefficient historique)", () => {
    const state = makeState();
    addCustomLine(state, "cloisons", 10, 10); // déboursé 100
    state.lots.cloisons.m = 30;
    state.lots.cloisons.tempsMoHeures = 2;

    const lt = calcLotTotaux(state, "cloisons", 50);
    const ctx = lotCAContext(lt);
    expect(ctx.coefAvecMO).toBeCloseTo(2.6, 10); // 260 / 100
    expect(ctx.orphanCA).toBe(0);
    // La ligne unique porte tout le CA du lot.
    expect(lineClientCA(lt.items[0], ctx)).toBeCloseTo(260, 10);
  });

  it("ligne sansMO (Consuel) : marge seule, la MO se répartit sur les autres lignes", () => {
    // Élec : Consuel 195 € (sansMO) + réseau forfait 1 000 €.
    // marge 10 %, MO = 10 h × 40 € = 400 €.
    // Attendu : Consuel → 195 × 1,10 = 214,50 (marge, pas de MO)
    //           Réseau  → porte TOUT le reste : (1000 + 400) × 1,10 = 1 540
    //           Somme   = caDeboursé = (1195 + 400) × 1,10 = 1 754,50
    const state = makeState({ globalSurf: 50 });
    state.lots.elec.on = true;
    state.lots.elec.m = 10;
    state.lots.elec.tempsMoHeures = 10;
    Object.assign(state.lots.elec.o, {
      consuel: true,
      reseau_mode: "forfait",
      reseau_forfait: 1000,
    });

    const lt = calcLotTotaux(state, "elec", 40);
    expect(lt.deboursé).toBe(1195);
    expect(lt.debourséAvecMO).toBe(1000);
    expect(lt.caDeboursé).toBe(1754.5);

    const ctx = lotCAContext(lt);
    const consuel = lt.items.find((i) => i.key === "elec_consuel")!;
    const reseau = lt.items.find((i) => i.key === "elec_reseau_forfait")!;
    expect(consuel.sansMO).toBe(true);
    expect(lineClientCA(consuel, ctx)).toBeCloseTo(214.5, 10);
    expect(lineClientCA(reseau, ctx)).toBeCloseTo(1540, 10);
    // Invariant : Σ lineClientCA = caDeboursé du lot.
    const somme = lt.items.reduce((a, i) => a + lineClientCA(i, ctx), 0);
    expect(somme).toBeCloseTo(lt.caDeboursé, 8);
  });

  it("lot 100 % points avec MO saisie : le CA MO+marge devient orphelin (orphanCA)", () => {
    // Démolition (aucun déboursé) + 2 h de MO à 50 €/h, marge 0.
    // caDeboursé = 100 € mais aucune ligne déboursé pour le porter.
    const state = makeState();
    state.lots.demolition.on = true;
    state.lots.demolition.tempsMoHeures = 2;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 1 } });

    const lt = calcLotTotaux(state, "demolition", 50);
    expect(lt.caDeboursé).toBe(100);
    const ctx = lotCAContext(lt);
    expect(ctx.orphanCA).toBe(100);
    expect(ctx.coefAvecMO).toBe(0);
  });

  it("ligne prixEstFinal : CA = total brut, quel que soit le contexte", () => {
    const state = makeState();
    state.lots.demolition.on = true;
    state.lots.demolition.m = 80;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 2 } });
    const lt = calcLotTotaux(state, "demolition", 100);
    const ctx = lotCAContext(lt);
    expect(lineClientCA(lt.items[0], ctx)).toBe(130);
  });
});

describe("calcEngineTotaux — remise globale", () => {
  function baseState() {
    // Un seul lot, déboursé 100, marge 30 %, MO 100 → subTotalHT = 260.
    const state = makeState();
    addCustomLine(state, "cloisons", 10, 10);
    state.lots.cloisons.m = 30;
    state.lots.cloisons.tempsMoHeures = 2;
    return state;
  }

  it("aucune remise : totalHT = subTotalHT", () => {
    const t = calcEngineTotaux(baseState(), 50);
    expect(t.subTotalHT).toBe(260);
    expect(t.remiseHT).toBe(0);
    expect(t.totalHT).toBe(260);
  });

  it("remise en % : appliquée sur le sous-total HT", () => {
    const state = baseState();
    state.remiseMode = "pourcent";
    state.remiseValeur = 10;
    const t = calcEngineTotaux(state, 50);
    expect(t.remiseHT).toBe(26);
    expect(t.totalHT).toBe(234);
  });

  it("remise en % > 100 : capée au sous-total (total jamais négatif)", () => {
    const state = baseState();
    state.remiseMode = "pourcent";
    state.remiseValeur = 150;
    const t = calcEngineTotaux(state, 50);
    expect(t.remiseHT).toBe(260);
    expect(t.totalHT).toBe(0);
  });

  it("remise en € : montant fixe, capé au sous-total", () => {
    const state = baseState();
    state.remiseMode = "euros";
    state.remiseValeur = 60;
    expect(calcEngineTotaux(state, 50).totalHT).toBe(200);

    state.remiseValeur = 9999;
    expect(calcEngineTotaux(state, 50).totalHT).toBe(0);
  });

  it("remise en € négative : ignorée (clampée à 0)", () => {
    const state = baseState();
    state.remiseMode = "euros";
    state.remiseValeur = -50;
    const t = calcEngineTotaux(state, 50);
    expect(t.remiseHT).toBe(0);
    expect(t.totalHT).toBe(260);
  });

  it("remise en % négative : ne doit JAMAIS augmenter le total", () => {
    // Symétrie attendue avec le mode euros (qui clampe à 0). Une valeur
    // négative saisie par erreur ne doit pas gonfler le devis.
    const state = baseState();
    state.remiseMode = "pourcent";
    state.remiseValeur = -10;
    const t = calcEngineTotaux(state, 50);
    expect(t.remiseHT).toBeGreaterThanOrEqual(0);
    expect(t.totalHT).toBeLessThanOrEqual(t.subTotalHT);
  });

  it("devis vide : aucun NaN, tous les totaux à 0", () => {
    const t = calcEngineTotaux(makeState(), 0);
    expect(t.subTotalHT).toBe(0);
    expect(t.totalHT).toBe(0);
    expect(t.totalTVA).toBe(0);
    expect(t.totalTTC).toBe(0);
    expect(Number.isNaN(t.totalTTC)).toBe(false);
  });
});

describe("calcEngineTotaux — ventilation TVA", () => {
  it("mono-taux : TVA = totalHT × taux (lot au taux par défaut 10 %)", () => {
    const state = makeState({ tvaParDefaut: 10 });
    addCustomLine(state, "cloisons", 10, 10); // 100 €, marge 0, MO 0
    const t = calcEngineTotaux(state, 0);
    expect(t.totalHT).toBe(100);
    expect(t.ventilationTVA).toEqual({ 10: 10 });
    expect(t.totalTVA).toBe(10);
    expect(t.totalTTC).toBe(110);
  });

  it("multi-taux : chaque lot ventile à son taux (override lot.tva)", () => {
    // Cloisons à 10 % (défaut) + ITI à 5,5 % (rénovation énergétique).
    const state = makeState({ tvaParDefaut: 10 });
    addCustomLine(state, "cloisons", 10, 10); // 100 € @ 10 %
    addCustomLine(state, "iti", 10, 5); // 50 € @ 5,5 %
    state.lots.iti.tva = 5.5;

    const t = calcEngineTotaux(state, 0);
    expect(t.ventilationTVA[10]).toBe(10);
    expect(t.ventilationTVA[5.5]).toBe(2.75);
    expect(t.totalTVA).toBe(12.75);
  });

  it("les points portent la TVA de leur prestation catalogue, pas celle du devis", () => {
    // Démolition : prestations cataloguées à 10 % même si le devis est à 20 %.
    const state = makeState({ tvaParDefaut: 20 });
    state.lots.demolition.on = true;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 2 } });
    const t = calcEngineTotaux(state, 0);
    expect(t.ventilationTVA).toEqual({ 10: 13 }); // 130 × 10 %
  });

  it("la remise réduit la TVA au prorata (ratio totalHT / subTotalHT)", () => {
    const state = makeState({ tvaParDefaut: 10 });
    addCustomLine(state, "cloisons", 10, 10);
    state.remiseMode = "pourcent";
    state.remiseValeur = 10;
    const t = calcEngineTotaux(state, 0);
    expect(t.totalHT).toBe(90);
    expect(t.totalTVA).toBe(9);
    expect(t.totalTTC).toBe(99);
  });

  it("le CA orphelin (MO sans ligne déboursé) est ventilé au taux par défaut", () => {
    const state = makeState({ tvaParDefaut: 20 });
    state.lots.demolition.on = true;
    state.lots.demolition.tempsMoHeures = 2; // MO 100 € sans déboursé
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 1 } });
    const t = calcEngineTotaux(state, 50);
    // 65 € de points @ 10 % (catalogue) + 100 € orphelins @ 20 % (défaut devis)
    expect(t.ventilationTVA[10]).toBe(6.5);
    expect(t.ventilationTVA[20]).toBe(20);
  });

  it("Σ ventilationTVA = totalTVA (invariant)", () => {
    const state = makeState({ tvaParDefaut: 10 });
    addCustomLine(state, "cloisons", 7, 13.37);
    addCustomLine(state, "iti", 3, 9.99);
    state.lots.iti.tva = 5.5;
    state.lots.cloisons.m = 27;
    state.lots.cloisons.tempsMoHeures = 3.5;
    state.remiseMode = "pourcent";
    state.remiseValeur = 7;
    const t = calcEngineTotaux(state, 42);
    const somme = round2(
      Object.values(t.ventilationTVA).reduce((a, v) => a + v, 0)
    );
    expect(somme).toBe(t.totalTVA);
  });
});

describe("calcEngineTotaux — régimes de TVA", () => {
  function stateAvecTVA() {
    const state = makeState({ tvaParDefaut: 10 });
    addCustomLine(state, "cloisons", 10, 10);
    return state;
  }

  it("franchise en base : aucune TVA, ventilation vide, TTC = HT", () => {
    const t = calcEngineTotaux(stateAvecTVA(), 0, "franchise");
    expect(t.totalTVA).toBe(0);
    expect(t.ventilationTVA).toEqual({});
    expect(t.totalTTC).toBe(t.totalHT);
    expect(t.totalHT).toBe(100); // le HT n'est pas affecté par le régime
  });

  it("autoliquidation : aucune TVA facturée, HT intact", () => {
    const t = calcEngineTotaux(stateAvecTVA(), 0, "autoliquidation");
    expect(t.totalTVA).toBe(0);
    expect(t.ventilationTVA).toEqual({});
    expect(t.totalTTC).toBe(100);
  });

  it("régime 'tva' (défaut) : la TVA est bien calculée", () => {
    const t = calcEngineTotaux(stateAvecTVA(), 0, "tva");
    expect(t.totalTVA).toBe(10);
  });
});

describe("calcEngineTotaux — récap interne et alertes", () => {
  it("tauxHoraireManquant = true ssi taux ≤ 0 ET du temps MO saisi sur un lot actif", () => {
    const state = makeState();
    addCustomLine(state, "cloisons", 10, 10);
    state.lots.cloisons.tempsMoHeures = 4;

    expect(calcEngineTotaux(state, 0).tauxHoraireManquant).toBe(true);
    expect(calcEngineTotaux(state, 45).tauxHoraireManquant).toBe(false);

    state.lots.cloisons.tempsMoHeures = 0;
    expect(calcEngineTotaux(state, 0).tauxHoraireManquant).toBe(false);
  });

  it("pointsLotsNonRenseignes liste les lots à points sans coût de revient saisi", () => {
    const state = makeState();
    state.lots.demolition.on = true;
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 1 } });
    const t1 = calcEngineTotaux(state, 0);
    expect(t1.pointsLotsNonRenseignes).toEqual(["demolition"]);

    state.lots.demolition.coutRevientPoints = 40;
    const t2 = calcEngineTotaux(state, 0);
    expect(t2.pointsLotsNonRenseignes).toEqual([]);
    expect(t2.totalMargePointsTracked).toBe(25); // 65 − 40
  });

  it("margeGlobaleTracked = margeDeboursé + margePoints connues", () => {
    const state = makeState();
    addCustomLine(state, "cloisons", 10, 10);
    state.lots.cloisons.m = 30; // marge déboursé : 30 €
    state.lots.demolition.on = true;
    state.lots.demolition.coutRevientPoints = 40; // marge points : 65 − 40 = 25
    Object.assign(state.lots.demolition.o, { points: { depose_wc: 1 } });

    const t = calcEngineTotaux(state, 0);
    expect(t.totalMargeDeboursé).toBe(30);
    expect(t.totalMargePointsTracked).toBe(25);
    expect(t.margeGlobaleTracked).toBe(55);
  });
});
