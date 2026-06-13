// ============================================================
// SOCLE — Tests — lib/devis/engine/agregation.ts
//
// Couvre l'agrégation des lignes moteur en lignes client :
//   - invariant « Σ LigneClient.prixClient = caLot » (au centime),
//   - overrides de PU / libellé (segments + infra élec),
//   - décomposition fourniture/pose (élec),
//   - lots libres et lignes libres,
//   - totaux client (calcClientTotaux, fast-path vs recomposition).
// ============================================================

import { describe, expect, it } from "vitest";
import {
  agregerLignesClient,
  calcClientTotaux,
  hasAggregateur,
  lignesLibresClient,
  lignesLotLibre,
} from "../lib/devis/engine/agregation";
import {
  calcEngineTotaux,
  calcLotTotaux,
  round2,
} from "../lib/devis/engine/totals";
import type {
  CloisonSegment,
  EngineState,
} from "../lib/devis/engine/types";
import { makeState } from "./helpers";

/** État cloisons à 2 segments + marge + MO : force des arrondis non triviaux. */
function cloisonsState(): EngineState {
  const state = makeState({ tvaParDefaut: 10 });
  state.lots.cloisons.on = true;
  state.lots.cloisons.m = 27; // marge « moche » pour générer des centimes
  state.lots.cloisons.tempsMoHeures = 7.5;
  Object.assign(state.lots.cloisons.o, {
    chute: 5,
    lignes: [
      {
        id: "s1",
        type: "std",
        oss: "m48",
        isolant: "lv",
        peaux: "2",
        dbl: false,
        m2: 17.3,
      },
      {
        id: "s2",
        type: "hydro",
        oss: "m70",
        isolant: "non",
        peaux: "2",
        dbl: true,
        m2: 8.7,
      },
    ] satisfies CloisonSegment[],
  });
  return state;
}

describe("hasAggregateur", () => {
  it("vrai pour les lots à stratégie, faux pour les lots legacy", () => {
    expect(hasAggregateur("cloisons")).toBe(true);
    expect(hasAggregateur("elec")).toBe(true);
    expect(hasAggregateur("peinture")).toBe(true);
    expect(hasAggregateur("menus")).toBe(false);
    expect(hasAggregateur("plombs")).toBe(false);
  });

  it("agregerLignesClient renvoie null pour un lot sans stratégie (rendu legacy)", () => {
    const state = makeState();
    state.lots.menus.on = true;
    const lt = calcLotTotaux(state, "menus", 0);
    expect(agregerLignesClient(state, lt)).toBeNull();
  });
});

describe("agrégation segments (cloisons) — invariant Σ lignes = HT lot", () => {
  it("une LigneClient par segment, somme strictement égale à caLot", () => {
    const state = cloisonsState();
    const lt = calcLotTotaux(state, "cloisons", 47);
    const lignes = agregerLignesClient(state, lt)!;

    expect(lignes).toHaveLength(2);
    const somme = round2(lignes.reduce((a, l) => a + l.prixClient, 0));
    // L'invariant fondamental : le client voit exactement le HT du lot,
    // au centime près, malgré les arrondis par segment (reliquat absorbé).
    expect(somme).toBe(round2(lt.caLot));
  });

  it("chaque ligne porte la qty du segment, le PU dérivé et le détail interne", () => {
    const state = cloisonsState();
    const lt = calcLotTotaux(state, "cloisons", 47);
    const [l1] = agregerLignesClient(state, lt)!;
    expect(l1.segmentId).toBe("s1");
    expect(l1.qty).toBe(17.3);
    expect(l1.unit).toBe("m²");
    expect(l1.prixUnitaireClient).toBe(round2(l1.prixClient / 17.3));
    expect(l1.tva).toBe(10);
    // Niveau 3 : les EngineLigne brutes du groupe (8 lignes : 7 + isolant).
    expect(l1.detailInterne.length).toBe(8);
    expect(l1.libelleCommercial).toContain("Fourniture et pose");
  });

  it("puOverride : remplace le prix ventilé de CE segment sans toucher les autres", () => {
    const state = cloisonsState();
    const ltAvant = calcLotTotaux(state, "cloisons", 47);
    const avant = agregerLignesClient(state, ltAvant)!;

    // Override sur le 2e segment : 100 €/m² × 8,7 m² = 870 €.
    (state.lots.cloisons.o.lignes as CloisonSegment[])[1].puOverride = 100;
    const ltApres = calcLotTotaux(state, "cloisons", 47);
    const apres = agregerLignesClient(state, ltApres)!;

    expect(apres[1].prixClient).toBe(870);
    // Le segment NON overridé ne bouge pas d'un centime.
    expect(apres[0].prixClient).toBe(avant[0].prixClient);
  });

  it("libelleOverride : renommage commercial prioritaire sur le libellé généré", () => {
    const state = cloisonsState();
    (state.lots.cloisons.o.lignes as CloisonSegment[])[0].libelleOverride =
      "Cloison séparative chambre";
    const lt = calcLotTotaux(state, "cloisons", 47);
    const lignes = agregerLignesClient(state, lt)!;
    expect(lignes[0].libelleCommercial).toBe("Cloison séparative chambre");
  });

  it("segment libre : prix ferme du moteur, catégorie « Ligne libre »", () => {
    const state = makeState({ tvaParDefaut: 10 });
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
          m2: 2,
          puOverride: 250,
          lbl: "Verrière intérieure",
          unit: "u",
        },
      ] satisfies CloisonSegment[],
    });
    const lt = calcLotTotaux(state, "cloisons", 0);
    const [l] = agregerLignesClient(state, lt)!;
    expect(l.prixClient).toBe(500);
    expect(l.categorie).toBe("Ligne libre");
    expect(l.description).toBe("");
  });
});

describe("agrégation élec — infra + points, split fourniture/pose", () => {
  function elecState(): EngineState {
    const state = makeState({ globalSurf: 50, tvaParDefaut: 10 });
    state.lots.elec.on = true;
    state.lots.elec.m = 20;
    state.lots.elec.tempsMoHeures = 10;
    Object.assign(state.lots.elec.o, {
      tableau_rangees: 2,
      gtl: true,
      consuel: true,
      reseau_mode: "m2", // 50 m² × 20 € (BP) = 1 000 €
      points: { prise_simple_16a: 2 },
    });
    return state;
  }

  it("Σ lignes client = caLot au centime (infra ventilée + points bruts)", () => {
    const state = elecState();
    const lt = calcLotTotaux(state, "elec", 45);
    const lignes = agregerLignesClient(state, lt)!;
    expect(lignes).toHaveLength(5); // tableau, réseau, GTL, Consuel + 1 point
    const somme = round2(lignes.reduce((a, l) => a + l.prixClient, 0));
    expect(somme).toBe(round2(lt.caLot));
  });

  it("le point garde son prix catalogue brut et son split fourniture/pose", () => {
    const state = elecState();
    const lt = calcLotTotaux(state, "elec", 45);
    const lignes = agregerLignesClient(state, lt)!;
    const prise = lignes.find((l) => l.prestationKey === "prise_simple_16a")!;
    expect(prise.prixClient).toBe(253.4); // 2 × 126,70 — AUCUNE marge/MO ajoutée
    // partFourniturePct = 35 % ; la pose absorbe l'arrondi.
    expect(prise.fournitureClient).toBe(round2(253.4 * 0.35));
    expect(prise.fournitureClient! + prise.poseClient!).toBeCloseTo(
      prise.prixClient,
      10
    );
  });

  it("split infra : tableau 60 % fourniture ; réseau et Consuel sans décomposition", () => {
    const state = elecState();
    const lt = calcLotTotaux(state, "elec", 45);
    const lignes = agregerLignesClient(state, lt)!;
    const tableau = lignes.find((l) => l.prestationKey === "elec_tableau_2r")!;
    expect(tableau.fournitureClient).toBeDefined();
    expect(tableau.fournitureClient! + tableau.poseClient!).toBeCloseTo(
      tableau.prixClient,
      10
    );
    const reseau = lignes.find((l) => l.prestationKey === "elec_reseau_m2")!;
    expect(reseau.fournitureClient).toBeUndefined();
  });

  it("override d'une ligne d'infra : prix forcé, AUCUNE redistribution sur les autres", () => {
    const state = elecState();
    const lt = calcLotTotaux(state, "elec", 45);
    const avant = agregerLignesClient(state, lt)!;

    Object.assign(state.lots.elec.o, {
      pointsOverride: { elec_gtl: { pu: 500 } },
    });
    // Les totaux MOTEUR ne bougent pas (l'override infra vit à l'agrégation).
    const ltApres = calcLotTotaux(state, "elec", 45);
    expect(ltApres.caLot).toBe(lt.caLot);

    const apres = agregerLignesClient(state, ltApres)!;
    const gtlApres = apres.find((l) => l.prestationKey === "elec_gtl")!;
    expect(gtlApres.prixClient).toBe(500);
    expect(gtlApres.overridden).toBe(true);
    // Les autres lignes d'infra gardent leur quote-part au centime près.
    for (const key of ["elec_tableau_2r", "elec_reseau_m2", "elec_consuel"]) {
      const a = avant.find((l) => l.prestationKey === key)!;
      const b = apres.find((l) => l.prestationKey === key)!;
      expect(b.prixClient).toBe(a.prixClient);
    }
  });
});

describe("lots libres et lignes libres", () => {
  it("lignesLotLibre : prix ferme qty × pu, TVA par défaut du devis", () => {
    const lignes = lignesLotLibre(
      {
        id: "ll1",
        titre: "Divers",
        lignes: [
          { id: "a", lbl: "Nettoyage fin de chantier", qty: 1, unit: "forfait", pu: 350 },
          { id: "b", lbl: "Heures régie", qty: 4, unit: "h", pu: 55 },
        ],
      },
      10
    );
    expect(lignes[0].prixClient).toBe(350);
    expect(lignes[1].prixClient).toBe(220);
    expect(lignes[1].tva).toBe(10);
  });

  it("lignesLibresClient : reprend l'override TVA du lot s'il existe", () => {
    const lignes = lignesLibresClient(
      {
        lignesLibres: [{ id: "x", lbl: "Option", qty: 2, unit: "u", pu: 10 }],
        tva: 5.5,
      },
      10
    );
    expect(lignes[0].tva).toBe(5.5);
    expect(lignes[0].prixClient).toBe(20);
  });

  it("liste vide / absente : aucun crash", () => {
    expect(lignesLibresClient({}, 10)).toEqual([]);
  });
});

describe("calcClientTotaux — totaux client override-aware", () => {
  it("fast-path : sans override ni contenu libre, renvoie les totaux moteur tels quels", () => {
    const state = cloisonsState();
    const engine = calcEngineTotaux(state, 47);
    const client = calcClientTotaux(state, engine);
    expect(client.hasOverride).toBe(false);
    expect(client.subTotalHT).toBe(engine.subTotalHT);
    expect(client.totalTVA).toBe(engine.totalTVA);
    expect(client.totalTTC).toBe(engine.totalTTC);
    // Le HT par lot correspond au caLot moteur.
    expect(client.parLotClientHT.cloisons).toBe(round2(engine.parLot.find((l) => l.lotId === "cloisons")!.caLot));
  });

  it("avec puOverride : recomposition depuis les unités client", () => {
    const state = cloisonsState();
    const engineAvant = calcEngineTotaux(state, 47);

    (state.lots.cloisons.o.lignes as CloisonSegment[])[1].puOverride = 100;
    const engine = calcEngineTotaux(state, 47); // totaux moteur inchangés
    const client = calcClientTotaux(state, engine);

    expect(client.hasOverride).toBe(true);
    // Le sous-total client = somme des lignes client (dont les 870 € forcés),
    // distinct du sous-total moteur.
    const lt = engine.parLot.find((l) => l.lotId === "cloisons")!;
    const lignes = agregerLignesClient(state, lt)!;
    const attendu = round2(lignes.reduce((a, l) => a + l.prixClient, 0));
    expect(client.subTotalHT).toBe(attendu);
    expect(engine.subTotalHT).toBe(engineAvant.subTotalHT);
    // TTC recomposé cohérent : HT + TVA.
    expect(client.totalTTC).toBe(round2(client.totalHT + client.totalTVA));
  });

  it("lot libre : inclus dans les totaux client (HT par lot + TVA)", () => {
    const state = makeState({ tvaParDefaut: 20 });
    state.lotsLibres.push({
      id: "libre1",
      titre: "Prestations diverses",
      lignes: [{ id: "a", lbl: "Forfait", qty: 1, unit: "forfait", pu: 100 }],
    });
    const engine = calcEngineTotaux(state, 0);
    expect(engine.subTotalHT).toBe(0); // le moteur ignore les lots libres
    const client = calcClientTotaux(state, engine);
    expect(client.parLotClientHT.libre1).toBe(100);
    expect(client.subTotalHT).toBe(100);
    expect(client.ventilationTVA[20]).toBe(20);
    expect(client.totalTTC).toBe(120);
  });

  it("remise appliquée aussi sur le chemin recomposé (au prorata)", () => {
    const state = makeState({ tvaParDefaut: 10 });
    state.remiseMode = "pourcent";
    state.remiseValeur = 10;
    state.lotsLibres.push({
      id: "libre1",
      titre: "Divers",
      lignes: [{ id: "a", lbl: "Forfait", qty: 1, unit: "forfait", pu: 200 }],
    });
    const client = calcClientTotaux(state, calcEngineTotaux(state, 0));
    expect(client.subTotalHT).toBe(200);
    expect(client.remiseHT).toBe(20);
    expect(client.totalHT).toBe(180);
    expect(client.totalTVA).toBe(18);
  });
});
