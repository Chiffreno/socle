/**
 * Sanity check du moteur taux horaire (étape 1).
 * Cas type : net 2500 €, charges fixes 800 €, 5 sem. congés, 5 j/mois NF, sans ACRE.
 * Vérifie l'ordre de grandeur (micro < ei_reel ≈ eurl < sasu) à 5 j/sem ET 6 j/sem
 * (plus de jours facturés ⇒ prix jour plus bas).
 *
 * Lancer : npx tsx scripts/taux-horaire.sanity.ts
 */
import { computeComparaison, REGIME_LABELS, type Regime } from "../lib/taux-horaire";

const order: Regime[] = ["micro", "ei_reel", "eurl", "sasu"];

function run(joursSemaine: number) {
  const res = computeComparaison({
    salaire: 2500,
    chargesFixes: 800,
    conges: 5,
    nfDays: 5,
    joursSemaine,
    acre: false,
  });

  console.log(
    `\n── ${joursSemaine} jours/semaine ` +
      `(jours facturables/an = ${(52 - 5) * joursSemaine - 5 * 12}) ──`
  );
  for (const r of order) {
    const x = res[r];
    console.log(
      `${REGIME_LABELS[r].padEnd(18)} prixJourReco=${x.prixJourReco.toFixed(2)} €/j` +
        `  (min=${x.prixJourMin.toFixed(2)}  tech=${x.prixJourTech.toFixed(2)})`
    );
  }

  const ok =
    res.micro.prixJourReco < res.ei_reel.prixJourReco &&
    Math.abs(res.ei_reel.prixJourReco - res.eurl.prixJourReco) < 0.01 &&
    res.eurl.prixJourReco < res.sasu.prixJourReco;
  return { res, ok };
}

console.log("Cas type : net 2500 € · charges 800 € · 5 sem · 5 NF · sans ACRE");

const c5 = run(5);
const c6 = run(6);

// L'ordre des régimes tient dans les deux cas, et 6 j/sem doit faire BAISSER le prix.
const baisse = c6.res.micro.prixJourReco < c5.res.micro.prixJourReco;
console.log(
  `\nOrdre régimes (5j & 6j) : ${c5.ok && c6.ok ? "OK ✓" : "ÉCHEC ✗"}` +
    `   |   6j < 5j (prix baisse) : ${baisse ? "OK ✓" : "ÉCHEC ✗"}`
);
if (!(c5.ok && c6.ok && baisse)) process.exit(1);
