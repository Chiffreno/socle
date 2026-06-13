// ============================================================
// SOCLE — Tests — lib/taux-horaire.ts (rentabilité : prix jour viable)
//
// Couvre les 4 régimes (micro / EI réel / EURL / SASU), l'ACRE, le calcul
// des jours facturables et les majorations (+20 % / +40 %).
//
// Rappels du modèle (commentaires du module) :
//   micro  : cotisations sur le CA, charges fixes NON déductibles
//            → CA = (N + F) / (1 − 21,5 %)
//   TNS    : cotisations 45 % du bénéfice (= rému nette visée)
//            → coût = N × 1,45 + F
//   SASU   : charges ~77 % du salaire net → coût = N × 1,77 + F
//   jours facturables = (52 − congés) × jours/semaine − joursNF × 12, min 1
// ============================================================

import { describe, expect, it } from "vitest";
import {
  ACRE_TAUX_EXO,
  MICRO_TAUX_COTIS,
  REGIMES,
  computeComparaison,
  computeTaux,
  computeTauxRegime,
} from "../lib/taux-horaire";

// Entrées de référence : 2 500 € nets visés, 500 € de charges fixes,
// défauts (5 semaines de congés, 5 j NF/mois, 5 j/semaine)
// → jours facturables = 47 × 5 − 60 = 175 j/an.
const INPUT = { salaire: 2500, chargesFixes: 500 };
const JOURS_FACT = 175;

describe("computeTauxRegime — micro-entreprise", () => {
  it("CA requis = (net + charges) / (1 − 21,5 %), cotisations sur le CA", () => {
    const r = computeTauxRegime("micro", INPUT);
    const caAttendu = 3000 / (1 - MICRO_TAUX_COTIS); // 3 821,66 €
    expect(r.coutMensuel).toBeCloseTo(caAttendu, 6);
    expect(r.cotisationsMensuelles).toBeCloseTo(caAttendu * MICRO_TAUX_COTIS, 6);
    expect(r.assiette).toBe("ca");
    // Cohérence interne : CA − cotisations = net + charges fixes.
    expect(r.coutMensuel - r.cotisationsMensuelles).toBeCloseTo(3000, 6);
  });

  it("prix jour minimum = coût annuel / jours facturables", () => {
    const r = computeTauxRegime("micro", INPUT);
    expect(r.prixJourMin).toBeCloseTo((r.coutMensuel * 12) / JOURS_FACT, 6);
  });
});

describe("computeTauxRegime — EI réel / EURL (TNS)", () => {
  it("cotisations = 45 % du bénéfice, charges fixes déductibles (hors assiette)", () => {
    const r = computeTauxRegime("ei_reel", INPUT);
    expect(r.cotisationsMensuelles).toBeCloseTo(2500 * 0.45, 6); // 1 125 €
    expect(r.coutMensuel).toBeCloseTo(2500 + 1125 + 500, 6); // 4 125 €
    expect(r.assiette).toBe("benefice");
  });

  it("EURL : même formule que l'EI au réel", () => {
    const ei = computeTauxRegime("ei_reel", INPUT);
    const eurl = computeTauxRegime("eurl", INPUT);
    expect(eurl.coutMensuel).toBe(ei.coutMensuel);
    expect(eurl.prixJourMin).toBe(ei.prixJourMin);
  });
});

describe("computeTauxRegime — SASU", () => {
  it("charges ~77 % du salaire net : coût = N × 1,77 + F", () => {
    const r = computeTauxRegime("sasu", INPUT);
    expect(r.cotisationsMensuelles).toBeCloseTo(2500 * 0.77, 6); // 1 925 €
    expect(r.coutMensuel).toBeCloseTo(2500 * 1.77 + 500, 6); // 4 925 €
    expect(r.assiette).toBe("salaire");
  });
});

describe("majorations de prix jour", () => {
  it("recommandé = min + 20 %, technique = min + 40 % (tous régimes)", () => {
    for (const regime of REGIMES) {
      const r = computeTauxRegime(regime, INPUT);
      expect(r.prixJourReco).toBeCloseTo(r.prixJourMin * 1.2, 8);
      expect(r.prixJourTech).toBeCloseTo(r.prixJourMin * 1.4, 8);
    }
  });
});

describe("ACRE (année 1)", () => {
  it("réduit le taux de cotisations de 50 % (valeur avant le 01/07/2026)", () => {
    const sans = computeTauxRegime("micro", INPUT);
    const avec = computeTauxRegime("micro", { ...INPUT, acre: true });
    const tauxReduit = MICRO_TAUX_COTIS * (1 - ACRE_TAUX_EXO);
    expect(avec.coutMensuel).toBeCloseTo(3000 / (1 - tauxReduit), 6);
    expect(avec.coutMensuel).toBeLessThan(sans.coutMensuel);
  });

  it("TNS avec ACRE : cotisations à 22,5 % au lieu de 45 %", () => {
    const r = computeTauxRegime("ei_reel", { ...INPUT, acre: true });
    expect(r.cotisationsMensuelles).toBeCloseTo(2500 * 0.45 * 0.5, 6);
  });
});

describe("jours facturables", () => {
  it("paramètres congés / jours non facturables / jours par semaine", () => {
    // 4 semaines de congés, 3 j NF/mois, 4 j/semaine → 48×4 − 36 = 156 j.
    const r = computeTauxRegime("ei_reel", {
      ...INPUT,
      conges: 4,
      nfDays: 3,
      joursSemaine: 4,
    });
    expect(r.prixJourMin).toBeCloseTo((r.coutMensuel * 12) / 156, 6);
  });

  it("plancher à 1 jour : jamais de division par zéro ou prix négatif", () => {
    // Configuration absurde (52 semaines de congés) → joursFact ≤ 0 → clampé à 1.
    const r = computeTauxRegime("micro", { ...INPUT, conges: 52, nfDays: 5 });
    expect(Number.isFinite(r.prixJourMin)).toBe(true);
    expect(r.prixJourMin).toBeCloseTo(r.coutMensuel * 12, 6);
  });
});

describe("cas limites des entrées", () => {
  it("salaire 0 et charges 0 : tout à 0, pas de NaN", () => {
    const r = computeTauxRegime("micro", { salaire: 0, chargesFixes: 0 });
    expect(r.coutMensuel).toBe(0);
    expect(r.prixJourMin).toBe(0);
    expect(Number.isNaN(r.prixJourReco)).toBe(false);
  });

  it("charges fixes seules (salaire 0) : couvertes par le prix jour", () => {
    const r = computeTauxRegime("ei_reel", { salaire: 0, chargesFixes: 800 });
    expect(r.coutMensuel).toBe(800);
    expect(r.cotisationsMensuelles).toBe(0);
  });

  it("très grandes valeurs : pas de débordement pratique", () => {
    const r = computeTauxRegime("sasu", {
      salaire: 1_000_000,
      chargesFixes: 100_000,
    });
    expect(Number.isFinite(r.prixJourMin)).toBe(true);
    expect(r.coutMensuel).toBeCloseTo(1_870_000, 0);
  });
});

describe("computeComparaison / compat ascendante", () => {
  it("renvoie les 4 régimes, identiques aux appels individuels", () => {
    const all = computeComparaison(INPUT);
    expect(Object.keys(all).sort()).toEqual(
      ["ei_reel", "eurl", "micro", "sasu"].sort()
    );
    expect(all.micro.prixJourMin).toBe(
      computeTauxRegime("micro", INPUT).prixJourMin
    );
  });

  it("computeTaux (deprecated, landing) délègue au moteur unique", () => {
    const legacy = computeTaux({ statut: "micro", ...INPUT });
    const moderne = computeTauxRegime("micro", INPUT);
    expect(legacy.prixJourMin).toBe(moderne.prixJourMin);
  });
});
