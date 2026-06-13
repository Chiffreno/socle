// ============================================================
// SOCLE — Tests — modules annexes de calcul / logique pure
//   - lib/devis/engine/iti.ts        (résistance thermique R indicative)
//   - lib/devis/engine/points.ts     (helpers catalogue de prestations)
//   - lib/devis/numerotation.ts      (numéros DEV-AAAA-XXX)
//   - lib/devis/format.ts            (formatage fr-FR)
//   - lib/devis/devis-status.ts      (statut effectif dérivé)
// ============================================================

import { describe, expect, it } from "vitest";
import { itiIsoKey, itiR, itiRText } from "../lib/devis/engine/iti";
import {
  findPrestation,
  groupByCategorie,
  type PointsCatalogue,
} from "../lib/devis/engine/points";
import { CATALOGUE_ELEC } from "../lib/devis/engine/catalogue-elec";
import {
  allocateNumero,
  formatNumero,
  parseNumero,
  peekNextNumero,
  type SequenceStore,
} from "../lib/devis/numerotation";
import { formatDateFR, formatEuro, formatPct } from "../lib/devis/format";
import { effectiveStatut } from "../lib/devis/devis-status";

describe("iti.ts — résistance thermique indicative", () => {
  it("R = épaisseur(m) / λ, arrondi à 0,5 près", () => {
    // LV 100 mm : 0,100 / 0,035 = 2,857 → 3 (arrondi au 0,5 le plus proche).
    expect(itiR("lv", "100")).toBe(3);
    // LR 100 mm : 0,100 / 0,038 = 2,63 → 2,5.
    expect(itiR("lr", "100")).toBe(2.5);
    // PSE 200 mm : 0,200 / 0,032 = 6,25 → 6,5 (Math.round(12.5)=13).
    expect(itiR("pse", "200")).toBe(6.5);
  });

  it("itiRText : format FR sans fausse précision (entier sans décimale)", () => {
    expect(itiRText("lv", "100")).toBe("3");
    expect(itiRText("lr", "100")).toBe("2,5");
  });

  it("itiIsoKey : clé BP famille + épaisseur", () => {
    expect(itiIsoKey("fb", "145")).toBe("iti_iso_fb_145");
  });
});

describe("points.ts — helpers de catalogue", () => {
  const MINI: PointsCatalogue = {
    lotId: "test",
    categories: [
      { id: "cat_b", label: "B" },
      { id: "cat_a", label: "A" },
    ],
    prestations: [
      { id: "p1", categorieId: "cat_a", libelle: "P1", description: "", unite: "u", prixVente: 10, tva: 10, afficheFourniture: false },
      { id: "p2", categorieId: "cat_b", libelle: "P2", description: "", unite: "u", prixVente: 20, tva: 10, afficheFourniture: false },
      { id: "p3", categorieId: "cat_b", libelle: "P3", description: "", unite: "u", prixVente: 30, tva: 10, afficheFourniture: false },
    ],
  };

  it("groupByCategorie : respecte l'ordre des catégories et regroupe les prestations", () => {
    const groups = groupByCategorie(MINI);
    expect(groups.map((g) => g.categorie.id)).toEqual(["cat_b", "cat_a"]);
    expect(groups[0].prestations.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(groups[1].prestations.map((p) => p.id)).toEqual(["p1"]);
  });

  it("findPrestation : trouve par id, null si absente", () => {
    expect(findPrestation(MINI, "p2")?.prixVente).toBe(20);
    expect(findPrestation(MINI, "inconnu")).toBeNull();
  });

  it("catalogue élec réel : toutes les prestations référencent une catégorie existante", () => {
    // Garde-fou data : une prestation orpheline disparaîtrait du configurateur.
    const catIds = new Set(CATALOGUE_ELEC.categories.map((c) => c.id));
    for (const p of CATALOGUE_ELEC.prestations) {
      expect(catIds.has(p.categorieId), `catégorie de ${p.id}`).toBe(true);
      expect(p.prixVente).toBeGreaterThan(0);
    }
  });
});

describe("numerotation.ts", () => {
  it("formatNumero : DEV-AAAA-XXX avec padding à 3 chiffres", () => {
    expect(formatNumero(2026, 1)).toBe("DEV-2026-001");
    expect(formatNumero(2026, 42)).toBe("DEV-2026-042");
    expect(formatNumero(2026, 1234)).toBe("DEV-2026-1234"); // au-delà de 999 : pas tronqué
  });

  it("parseNumero : round-trip et rejets", () => {
    expect(parseNumero("DEV-2026-007")).toEqual({ year: 2026, seq: 7 });
    expect(parseNumero(formatNumero(2031, 88))).toEqual({ year: 2031, seq: 88 });
    expect(parseNumero("FAC-2026-001")).toBeNull();
    expect(parseNumero("DEV-26-001")).toBeNull();
    expect(parseNumero("")).toBeNull();
  });

  it("allocateNumero consomme le compteur, peekNextNumero non (store mémoire)", () => {
    // Store de test en mémoire — la même interface que le futur store serveur.
    const map: Record<string, number> = {};
    const store: SequenceStore = {
      next(year) {
        const seq = (map[year] ?? 0) + 1;
        map[year] = seq;
        return seq;
      },
      peek(year) {
        return (map[year] ?? 0) + 1;
      },
    };
    expect(peekNextNumero(store, 2026)).toBe("DEV-2026-001");
    expect(allocateNumero(store, 2026)).toBe("DEV-2026-001");
    expect(allocateNumero(store, 2026)).toBe("DEV-2026-002");
    expect(peekNextNumero(store, 2026)).toBe("DEV-2026-003");
    // Compteurs indépendants par année.
    expect(allocateNumero(store, 2027)).toBe("DEV-2027-001");
  });
});

describe("format.ts — formatage fr-FR", () => {
  // Intl peut produire des espaces insécables (U+00A0 / U+202F) : on
  // normalise pour ne pas rendre le test fragile selon la version ICU.
  const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

  it("formatEuro : 2 décimales, virgule, séparateur de milliers, suffixe €", () => {
    expect(norm(formatEuro(1234.5))).toBe("1 234,50 €");
    expect(norm(formatEuro(0))).toBe("0,00 €");
    expect(norm(formatEuro(-12.345))).toBe("-12,35 €");
  });

  it("formatEuro : NaN/undefined neutralisés en 0,00 €", () => {
    expect(norm(formatEuro(NaN))).toBe("0,00 €");
    expect(norm(formatEuro(undefined as unknown as number))).toBe("0,00 €");
  });

  it("formatDateFR : ISO → JJ/MM/AAAA, '—' si vide ou invalide", () => {
    expect(formatDateFR("2026-06-11")).toBe("11/06/2026");
    expect(formatDateFR(null)).toBe("—");
    expect(formatDateFR("")).toBe("—");
    expect(formatDateFR("pas-une-date")).toBe("—");
  });

  it("formatPct : max 2 décimales, suffixe %", () => {
    expect(norm(formatPct(30))).toBe("30 %");
    expect(norm(formatPct(51.256))).toBe("51,26 %");
  });
});

describe("devis-status.ts — statut effectif dérivé", () => {
  it("un devis envoyé dont la validité est passée est affiché « expiré »", () => {
    expect(
      effectiveStatut({ statut: "envoye", dateValidite: "2000-01-01" })
    ).toBe("expire");
  });

  it("un devis envoyé encore valide reste « envoyé »", () => {
    const demain = new Date(Date.now() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(effectiveStatut({ statut: "envoye", dateValidite: demain })).toBe(
      "envoye"
    );
  });

  it("les autres statuts ne sont jamais dérivés, même date passée", () => {
    expect(
      effectiveStatut({ statut: "signe", dateValidite: "2000-01-01" })
    ).toBe("signe");
    expect(
      effectiveStatut({ statut: "brouillon", dateValidite: null })
    ).toBe("brouillon");
  });

  it("date invalide : pas de bascule, pas de crash", () => {
    expect(
      effectiveStatut({ statut: "envoye", dateValidite: "n/a" })
    ).toBe("envoye");
  });
});
