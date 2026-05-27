/**
 * Logique de calcul du taux horaire viable, extraite du module complet
 * (`app/(app)/construction/taux-horaire/page.tsx`) pour être réutilisée par le
 * mini-simulateur de la landing. Formules identiques au module : seules les
 * entrées « congés » et « jours non facturables » sont figées sur les défauts
 * (5 semaines de congés, 5 j/mois non facturables = Devis 3 + SAV 1 + Admin 1).
 */

export type Statut = "micro" | "eurl" | "sasu";

/** Coefficient de charges sociales par statut juridique. */
export const CHARGES_SOCIALES: Record<Statut, number> = {
  micro: 0.22,
  eurl: 0.45,
  sasu: 0.82,
};

export type TauxInput = {
  statut: Statut;
  /** Salaire net mensuel visé (€). */
  salaire: number;
  /** Charges fixes mensuelles (véhicule, assurances, outils…) (€). */
  chargesFixes: number;
  /** Semaines de congés annuels. Défaut : 5. */
  conges?: number;
  /** Jours non facturables par mois. Défaut : 5. */
  nfDays?: number;
};

export type TauxResult = {
  /** Taux minimum viable (€/h) — couvre tout juste les coûts. */
  tauxMin: number;
  /** Taux recommandé (€/h) — minimum +20 %, couvre les imprévus. */
  tauxReco: number;
  /** Taux technique / urgence (€/h) — minimum +40 %. */
  tauxTech: number;
};

export function computeTaux(input: TauxInput): TauxResult {
  const conges = input.conges ?? 5;
  const nfDays = input.nfDays ?? 5;
  const taux = CHARGES_SOCIALES[input.statut];
  const salaireBrut =
    input.statut === "micro"
      ? input.salaire / (1 - taux)
      : input.salaire * (1 + taux);
  const coutAnnuel = (salaireBrut + input.chargesFixes) * 12;
  const joursFact = Math.max((52 - conges) * 5 - nfDays * 12, 1);
  const heuresFact = joursFact * 7;
  const tauxMin = coutAnnuel / heuresFact;
  return {
    tauxMin,
    tauxReco: tauxMin * 1.2,
    tauxTech: tauxMin * 1.4,
  };
}
