// ============================================================
// SOCLE — Tests — lib/devis/regime.ts + lib/devis/echeancier.ts
//
// Régime TVA : résolution unique du régime d'un devis (création + lecture).
// Échéancier : résolution des montants TTC multi-acomptes — la ligne solde
// absorbe les arrondis, Σ montants = totalTTC strictement.
// ============================================================

import { describe, expect, it } from "vitest";
import {
  regimeParDefaut,
  regimesAutorises,
  resoudreRegimeTVA,
} from "../lib/devis/regime";
import { resoudreEcheancier } from "../lib/devis/echeancier";
import type { Echeance } from "../lib/devis/types";

describe("regime.ts — régimes autorisés et défaut", () => {
  it("assujetti : TVA normale ou autoliquidation ; non assujetti : franchise seule", () => {
    expect(regimesAutorises(true)).toEqual(["tva", "autoliquidation"]);
    expect(regimesAutorises(false)).toEqual(["franchise"]);
  });

  it("défaut : tva si assujetti, franchise sinon", () => {
    expect(regimeParDefaut(true)).toBe("tva");
    expect(regimeParDefaut(false)).toBe("franchise");
  });
});

describe("regime.ts — resoudreRegimeTVA (résolution unique)", () => {
  it("valeur valide → conservée telle quelle", () => {
    expect(resoudreRegimeTVA("autoliquidation", { assujettiTVA: true })).toBe(
      "autoliquidation"
    );
    expect(resoudreRegimeTVA("franchise", null)).toBe("franchise");
  });

  it("valeur invalide + entreprise connue → défaut selon l'assujettissement", () => {
    expect(resoudreRegimeTVA(undefined, { assujettiTVA: true })).toBe("tva");
    expect(resoudreRegimeTVA("n_importe_quoi", { assujettiTVA: false })).toBe(
      "franchise"
    );
    expect(resoudreRegimeTVA(null, { assujettiTVA: false })).toBe("franchise");
  });

  it("valeur invalide + entreprise inconnue → 'tva' (décision étape A-bis)", () => {
    expect(resoudreRegimeTVA(undefined, null)).toBe("tva");
    expect(resoudreRegimeTVA(42, null)).toBe("tva");
  });

  it("note de comportement : une valeur valide est conservée même si elle est " +
    "incohérente avec l'assujettissement (ex. franchise pour un assujetti)", () => {
    // Comportement assumé par le module (la cohérence est gérée par les
    // selects de l'UI via regimesAutorises) — documenté ici pour mémoire.
    expect(resoudreRegimeTVA("franchise", { assujettiTVA: true })).toBe(
      "franchise"
    );
  });
});

// ─── Échéancier ──────────────────────────────────────────────────────

function ech(
  id: string,
  mode: Echeance["mode"],
  valeur: number,
  moment: Echeance["moment"] = "commande"
): Echeance {
  return { id, libelle: `Échéance ${id}`, moment, mode, valeur };
}

describe("echeancier.ts — resoudreEcheancier", () => {
  it("cas nominal : acompte 30 % + solde → 300 / 700 sur 1 000 € TTC", () => {
    const out = resoudreEcheancier(
      [ech("a", "pourcent", 30), ech("s", "solde", 0, "reception")],
      1000
    );
    expect(out[0].montantTTC).toBe(300);
    expect(out[0].pourcentEffectif).toBeCloseTo(30, 10);
    expect(out[1].montantTTC).toBe(700);
    expect(out[1].pourcentEffectif).toBeCloseTo(70, 10);
  });

  it("montant fixe + pourcent + solde : le solde prend le reliquat exact", () => {
    const out = resoudreEcheancier(
      [
        ech("fixe", "montant", 250),
        ech("pct", "pourcent", 40, "encours"),
        ech("s", "solde", 0, "reception"),
      ],
      2000
    );
    expect(out[0].montantTTC).toBe(250);
    expect(out[1].montantTTC).toBe(800);
    expect(out[2].montantTTC).toBe(950);
    const somme = out.reduce((a, e) => a + e.montantTTC, 0);
    expect(somme).toBeCloseTo(2000, 10);
  });

  it("invariant d'arrondi : Σ montants = totalTTC au centime, le solde absorbe", () => {
    // 3 × 33,33 % sur 100,01 € → 33,34 (arrondi par ligne en centimes) ;
    // le solde récupère le reliquat exact, jamais de centime perdu.
    const out = resoudreEcheancier(
      [
        ech("a", "pourcent", 33.33),
        ech("b", "pourcent", 33.33),
        ech("c", "pourcent", 33.33),
        ech("s", "solde", 0),
      ],
      100.01
    );
    const somme = out.reduce((a, e) => a + e.montantTTC, 0);
    expect(somme).toBeCloseTo(100.01, 10);
    // Chaque ligne non-solde est arrondie au centime.
    for (const e of out.slice(0, 3)) {
      expect(Math.round(e.montantTTC * 100)).toBeCloseTo(e.montantTTC * 100, 8);
    }
  });

  it("deux lignes solde (cas anormal) : la première absorbe, la seconde reçoit 0", () => {
    const out = resoudreEcheancier(
      [ech("a", "pourcent", 60), ech("s1", "solde", 0), ech("s2", "solde", 0)],
      1000
    );
    expect(out[1].montantTTC).toBe(400);
    expect(out[2].montantTTC).toBe(0);
  });

  it("sans ligne solde : les montants restent tels que saisis (l'écart est un garde-fou UI)", () => {
    const out = resoudreEcheancier(
      [ech("a", "pourcent", 30), ech("b", "pourcent", 30)],
      1000
    );
    expect(out[0].montantTTC + out[1].montantTTC).toBe(600); // ≠ 1 000, assumé
  });

  it("totalTTC = 0 : pourcentEffectif à 0 (pas de division par zéro)", () => {
    const out = resoudreEcheancier(
      [ech("a", "pourcent", 30), ech("s", "solde", 0)],
      0
    );
    expect(out[0].montantTTC).toBe(0);
    expect(out[0].pourcentEffectif).toBe(0);
    expect(out[1].pourcentEffectif).toBe(0);
    expect(out.every((e) => !Number.isNaN(e.pourcentEffectif))).toBe(true);
  });

  it("échéancier vide : renvoie []", () => {
    expect(resoudreEcheancier([], 1000)).toEqual([]);
  });

  it("acomptes > 100 % : le solde devient négatif (signalé par l'UI, pas bloqué ici)", () => {
    // Comportement assumé : la résolution est purement arithmétique ; le
    // garde-fou « 100 % » est visuel côté UI (cf. en-tête du module).
    const out = resoudreEcheancier(
      [ech("a", "pourcent", 80), ech("b", "pourcent", 40), ech("s", "solde", 0)],
      1000
    );
    expect(out[2].montantTTC).toBe(-200);
    const somme = out.reduce((a, e) => a + e.montantTTC, 0);
    expect(somme).toBeCloseTo(1000, 10);
  });

  it("préserve l'ordre, les ids, libellés, moments et le mode d'origine", () => {
    const lignes = [
      ech("x", "montant", 100, "commande"),
      ech("y", "solde", 0, "reception"),
    ];
    const out = resoudreEcheancier(lignes, 500);
    expect(out.map((e) => e.id)).toEqual(["x", "y"]);
    expect(out[0].mode).toBe("montant");
    expect(out[1].moment).toBe("reception");
    expect(out[0].libelle).toBe("Échéance x");
  });
});
