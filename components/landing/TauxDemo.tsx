"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { computeTaux, type Statut } from "@/lib/taux-horaire";

const STATUTS: { value: Statut; label: string }[] = [
  { value: "micro", label: "Micro" },
  { value: "eurl", label: "EURL" },
  { value: "sasu", label: "SASU" },
];

const fmt = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function TauxDemo() {
  const [statut, setStatut] = useState<Statut>("sasu");
  const [salaire, setSalaire] = useState<number>(2500);
  const [chargesFixes, setChargesFixes] = useState<number>(1130);

  const {
    prixJourMin: tauxMin,
    prixJourReco: tauxReco,
    prixJourTech: tauxTech,
  } = useMemo(
    () => computeTaux({ statut, salaire, chargesFixes }),
    [statut, salaire, chargesFixes]
  );

  return (
    <div className="demo">
      <div className="demo-inputs">
        <div className="demo-field">
          <label className="demo-label" htmlFor="demo-salaire">
            Salaire net mensuel souhaité
          </label>
          <div className="demo-slider-row">
            <input
              id="demo-salaire"
              type="range"
              min={1000}
              max={6000}
              step={100}
              value={salaire}
              onChange={(e) => setSalaire(Number(e.target.value))}
              className="demo-range"
            />
            <span className="demo-slider-value">{fmt(salaire)} €</span>
          </div>
        </div>

        <div className="demo-field">
          <span className="demo-label">Statut juridique</span>
          <div className="demo-statut-group" role="group" aria-label="Statut juridique">
            {STATUTS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`demo-statut-btn${statut === s.value ? " active" : ""}`}
                aria-pressed={statut === s.value}
                onClick={() => setStatut(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="demo-field">
          <label className="demo-label" htmlFor="demo-charges">
            Charges fixes mensuelles
          </label>
          <div className="demo-input-wrap">
            <input
              id="demo-charges"
              type="number"
              min={0}
              step={50}
              value={chargesFixes}
              onChange={(e) => setChargesFixes(Math.max(0, Number(e.target.value)))}
              className="demo-input"
            />
            <span className="demo-input-suffix">€ / mois</span>
          </div>
          <p className="demo-hint">Véhicule, assurances, outillage, comptable…</p>
        </div>
      </div>

      <div className="demo-results">
        <div className="demo-results-eyebrow">Ton prix jour</div>
        <div className="demo-results-grid">
          <div className="demo-result">
            <div className="demo-result-num">{fmt(tauxMin)} €/j</div>
            <div className="demo-result-label">Minimum viable</div>
            <div className="demo-result-desc">En dessous, tu travailles à perte.</div>
          </div>
          <div className="demo-result featured">
            <div className="demo-result-num">{fmt(tauxReco)} €/j</div>
            <div className="demo-result-label">Recommandé</div>
            <div className="demo-result-desc">Couvre les imprévus et le SAV.</div>
          </div>
          <div className="demo-result">
            <div className="demo-result-num">{fmt(tauxTech)} €/j</div>
            <div className="demo-result-label">Technique / urgence</div>
            <div className="demo-result-desc">Chantiers complexes ou pressés.</div>
          </div>
        </div>
        <Link href="/construction/taux-horaire" className="demo-cta">
          Voir le calcul détaillé dans SOCLE <span className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
