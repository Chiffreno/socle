/**
 * Moteur de calcul du taux horaire viable — SOURCE UNIQUE.
 *
 * La page `/construction/taux-horaire` et le mini-simulateur de la landing
 * consomment ce module : aucune formule ne doit être dupliquée ailleurs.
 *
 * ── MODÈLE (raisonnement HORS MATIÈRE) ────────────────────────────────────
 * Le taux horaire couvre la MAIN-D'ŒUVRE seule : rémunération nette visée +
 * cotisations sociales + charges fixes de structure. La MATIÈRE (fournitures)
 * est refacturée séparément au client et n'entre PAS dans ce taux. Ce principe
 * doit être rappelé dans l'UI.
 *
 * ── RÉSERVES (à afficher dans l'UI) ───────────────────────────────────────
 * - Les taux de cotisations TNS (~45 %) sont un ORDRE DE GRANDEUR : ils ne sont
 *   pas linéaires et varient selon le niveau de revenu et les paliers en vigueur.
 * - Le calcul SASU est SIMPLIFIÉ : rémunération 100 % salaire, hors IS et hors
 *   optimisation par dividendes.
 * - Il s'agit d'une SIMULATION INDICATIVE d'aide à la décision, pas d'un calcul
 *   comptable opposable.
 */

export type Regime = "micro" | "ei_reel" | "eurl" | "sasu";

/** Base d'assiette des cotisations, selon le régime. */
export type Assiette = "ca" | "benefice" | "salaire";

/** Ordre d'affichage des régimes. */
export const REGIMES: Regime[] = ["micro", "ei_reel", "eurl", "sasu"];

export const REGIME_LABELS: Record<Regime, string> = {
  micro: "Micro-entreprise",
  ei_reel: "EI au réel",
  eurl: "EURL (IR)",
  sasu: "SASU",
};

/* ── Taux de cotisations ──────────────────────────────────────────────────
 * micro : cotisations assises sur le CHIFFRE D'AFFAIRES.
 *   21,2 % (BIC prestation de services artisanale) + 0,3 % (CFP) = 21,5 %.
 * ei_reel / eurl : TNS, ~45 % du BÉNÉFICE — ordre de grandeur non linéaire.
 * sasu : président assimilé-salarié, ~77 % de charges sur le SALAIRE net. */
export const MICRO_TAUX_COTIS = 0.215;
export const TNS_TAUX_COTIS = 0.45;
export const SASU_TAUX_CHARGES = 0.77;

/* ── ACRE (exonération partielle, année 1 — 4 trimestres seulement) ────────
 * Réduit les cotisations en début d'activité. Décret du 06/02/2026 :
 *   - création AVANT le 01/07/2026 : 50 % d'exonération ;
 *   - création À COMPTER du 01/07/2026 : 25 % d'exonération.
 * On expose les deux valeurs ; ACRE_TAUX_EXO pointe sur la valeur applicable
 * par défaut aujourd'hui (création avant la bascule du 01/07/2026). */
export const ACRE_TAUX_EXO_AVANT_07_2026 = 0.5;
export const ACRE_TAUX_EXO_APRES_07_2026 = 0.25;
export const ACRE_TAUX_EXO = ACRE_TAUX_EXO_AVANT_07_2026;

export type RegimeInfo = {
  label: string;
  assiette: Assiette;
  /** Explication pédagogique courte (1 phrase). */
  description: string;
  /** Avertissement spécifique à afficher dans l'UI, le cas échéant. */
  avertissement?: string;
};

export const REGIME_INFO: Record<Regime, RegimeInfo> = {
  micro: {
    label: REGIME_LABELS.micro,
    assiette: "ca",
    description:
      "Cotisations calculées sur le chiffre d'affaires (21,5 %) ; les charges fixes ne sont pas déductibles.",
  },
  ei_reel: {
    label: REGIME_LABELS.ei_reel,
    assiette: "benefice",
    description:
      "Cotisations TNS (~45 %) sur le bénéfice ; les charges fixes sont déductibles.",
  },
  eurl: {
    label: REGIME_LABELS.eurl,
    assiette: "benefice",
    description:
      "Gérant majoritaire TNS à l'IR (~45 % sur le bénéfice), logique proche de l'EI au réel.",
  },
  sasu: {
    label: REGIME_LABELS.sasu,
    assiette: "salaire",
    description:
      "Président assimilé-salarié : environ 77 % de charges sociales sur le salaire net.",
    avertissement:
      "Calcul en rémunération 100 % salaire — hors optimisation par dividendes et impôt sur les sociétés.",
  },
};

export type TauxInput = {
  /** Rémunération nette mensuelle visée (€). */
  salaire: number;
  /** Charges fixes mensuelles de structure (véhicule, assurances, outils…) (€). */
  chargesFixes: number;
  /** Semaines de congés annuels. Défaut : 5. */
  conges?: number;
  /** Jours non facturables par mois. Défaut : 5. */
  nfDays?: number;
  /** Jours travaillés par semaine. Défaut : 5 (plage raisonnable 4–6). */
  joursSemaine?: number;
  /** Bénéfice de l'ACRE (année 1, 4 trimestres). Défaut : false. */
  acre?: boolean;
};

export type RegimeResult = {
  /** Prix jour minimum viable (€/j) — couvre tout juste les coûts. */
  prixJourMin: number;
  /** Prix jour recommandé (€/j) — minimum +20 %. */
  prixJourReco: number;
  /** Prix jour technique / urgence (€/j) — minimum +40 %. */
  prixJourTech: number;
  /** Coût mensuel total à couvrir par la main-d'œuvre facturée (€). */
  coutMensuel: number;
  /** Cotisations sociales mensuelles (€). */
  cotisationsMensuelles: number;
  /** Base d'assiette des cotisations pour ce régime. */
  assiette: Assiette;
};

/**
 * Calcule les prix JOUR pour UN régime donné.
 * Partie commune à tous les régimes : jours facturables/an et majorations.
 */
export function computeTauxRegime(
  regime: Regime,
  input: TauxInput
): RegimeResult {
  const conges = input.conges ?? 5;
  const nfDays = input.nfDays ?? 5;
  const joursSemaine = input.joursSemaine ?? 5;
  const N = input.salaire;
  const F = input.chargesFixes;
  // ACRE : on réduit le taux de cotisations applicable.
  const exo = input.acre ? ACRE_TAUX_EXO : 0;

  let coutMensuel: number;
  let cotisationsMensuelles: number;
  let assiette: Assiette;

  switch (regime) {
    case "micro": {
      // Assiette = CA. Charges fixes NON déductibles, payées sur le CA.
      // CA = N + F + cotisations, avec cotisations = taux × CA
      //   ⇒ CA = (N + F) / (1 - taux).
      const taux = MICRO_TAUX_COTIS * (1 - exo);
      const ca = (N + F) / (1 - taux);
      cotisationsMensuelles = ca * taux;
      coutMensuel = ca;
      assiette = "ca";
      break;
    }
    case "ei_reel":
    case "eurl": {
      // TNS : charges fixes déductibles. Bénéfice = rému nette visée.
      // cotisations = 45 % du bénéfice ; coût = N + cotisations + F.
      const taux = TNS_TAUX_COTIS * (1 - exo);
      cotisationsMensuelles = N * taux;
      coutMensuel = N + cotisationsMensuelles + F;
      assiette = "benefice";
      break;
    }
    case "sasu": {
      // Assimilé-salarié, 100 % salaire : charges ~77 % du net.
      // coût = N × 1,77 + F.
      const taux = SASU_TAUX_CHARGES * (1 - exo);
      cotisationsMensuelles = N * taux;
      coutMensuel = N + cotisationsMensuelles + F;
      assiette = "salaire";
      break;
    }
  }

  const joursFact = Math.max((52 - conges) * joursSemaine - nfDays * 12, 1);
  const prixJourMin = (coutMensuel * 12) / joursFact;

  return {
    prixJourMin,
    prixJourReco: prixJourMin * 1.2,
    prixJourTech: prixJourMin * 1.4,
    coutMensuel,
    cotisationsMensuelles,
    assiette,
  };
}

/** Calcule les 4 régimes d'un coup pour un même jeu d'entrées. */
export function computeComparaison(
  input: TauxInput
): Record<Regime, RegimeResult> {
  return {
    micro: computeTauxRegime("micro", input),
    ei_reel: computeTauxRegime("ei_reel", input),
    eurl: computeTauxRegime("eurl", input),
    sasu: computeTauxRegime("sasu", input),
  };
}

/* ── Compat ascendante (landing TauxDemo) ──────────────────────────────────
 * Ancien modèle mono-statut. Conservé en délégant au moteur unique pour ne
 * pas casser le mini-simulateur de la landing. À retirer une fois la landing
 * migrée vers computeComparaison / computeTauxRegime. */

/** @deprecated utiliser {@link Regime}. */
export type Statut = "micro" | "eurl" | "sasu";

/** @deprecated utiliser {@link computeTauxRegime} / {@link computeComparaison}. */
export function computeTaux(input: {
  statut: Statut;
  salaire: number;
  chargesFixes: number;
  conges?: number;
  nfDays?: number;
}): RegimeResult {
  return computeTauxRegime(input.statut, input);
}
