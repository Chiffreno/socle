"use client";

import { useMemo, useState } from "react";
import {
  getFourchetteJour,
  METIERS,
  METIER_LABELS,
  ZONES,
  ZONE_LABELS,
  type Metier,
  type Zone,
} from "@/lib/tarifs-marche";

const fmt = (v: number) => Math.round(v).toLocaleString("fr-FR");

type Positionnement = {
  label: string;
  /** Position 0→1 du marqueur sur la barre (clampé aux extrémités). */
  ratio: number;
};

function getPositionnement(
  tauxJour: number,
  basse: number,
  moyenne: number,
  haute: number
): Positionnement {
  let label: string;
  if (tauxJour < basse) label = "En dessous du marché";
  else if (tauxJour < (basse + moyenne) / 2) label = "Dans la fourchette basse";
  else if (tauxJour <= (moyenne + haute) / 2) label = "Dans la moyenne";
  else if (tauxJour <= haute) label = "Dans la fourchette haute";
  else label = "Au-dessus du marché";

  const span = haute - basse;
  const raw = span > 0 ? (tauxJour - basse) / span : 0.5;
  const ratio = Math.min(1, Math.max(0, raw));
  return { label, ratio };
}

type Props = {
  /** Taux horaire (€/h) déjà calculé par la page — non recalculé ici. */
  tauxHoraire: number;
};

export default function ComparaisonMarche({ tauxHoraire }: Props) {
  const [metier, setMetier] = useState<Metier>("macon");
  const [zone, setZone] = useState<Zone>("province");
  const [heures, setHeures] = useState<number>(7);

  const fourchette = useMemo(
    () => getFourchetteJour(metier, zone, heures),
    [metier, zone, heures]
  );

  const tauxJour = tauxHoraire * heures;

  const pos = useMemo(
    () =>
      getPositionnement(
        tauxJour,
        fourchette.basseJour,
        fourchette.moyenneJour,
        fourchette.hauteJour
      ),
    [tauxJour, fourchette]
  );

  return (
    <div className="cm-card">
      <div className="result-eyebrow">Comparaison marché</div>

      {/* Sélecteurs */}
      <div className="cm-selects">
        <label className="cm-field">
          <span className="cm-field-label">Métier</span>
          <select
            className="cm-select"
            value={metier}
            onChange={(e) => setMetier(e.currentTarget.value as Metier)}
          >
            {METIERS.map((m) => (
              <option key={m} value={m}>
                {METIER_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-field">
          <span className="cm-field-label">Zone</span>
          <select
            className="cm-select"
            value={zone}
            onChange={(e) => setZone(e.currentTarget.value as Zone)}
          >
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABELS[z]}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-field cm-field-heures">
          <span className="cm-field-label">Heures facturées / jour</span>
          <input
            type="number"
            className="cm-heures-input"
            value={heures}
            min={1}
            max={12}
            step={0.5}
            onChange={(e) =>
              setHeures(Math.max(1, parseFloat(e.currentTarget.value) || 1))
            }
          />
        </label>
      </div>

      {/* Prix jour marché */}
      <div className="cm-market">
        <div className="cm-market-item">
          <span className="cm-market-label">Basse</span>
          <span className="cm-market-val">{fmt(fourchette.basseJour)} €</span>
        </div>
        <div className="cm-market-item">
          <span className="cm-market-label">Moyenne</span>
          <span className="cm-market-val">{fmt(fourchette.moyenneJour)} €</span>
        </div>
        <div className="cm-market-item">
          <span className="cm-market-label">Haute</span>
          <span className="cm-market-val">{fmt(fourchette.hauteJour)} €</span>
        </div>
      </div>

      {/* Taux jour de l'artisan — seul élément vert */}
      <div className="cm-artisan">
        <span className="cm-artisan-label">Ton prix jour</span>
        <span className="cm-artisan-val">{fmt(tauxJour)} €</span>
      </div>

      {/* Échelle visuelle */}
      <div className="cm-scale">
        <div className="cm-scale-bar">
          <span
            className="cm-scale-marker"
            style={{ left: `${pos.ratio * 100}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="cm-scale-labels">
          <span className="cm-scale-end">{fmt(fourchette.basseJour)} €</span>
          <span className="cm-scale-end">{fmt(fourchette.hauteJour)} €</span>
        </div>
      </div>

      {/* Message de positionnement */}
      <div className="cm-message">{pos.label}</div>

      {/* Mention de prudence */}
      <p className="cm-disclaimer">
        Estimations indicatives basées sur les tarifs moyens constatés du marché
        (2025-2026). Les écarts régionaux sont approximatifs. Les tarifs réels
        varient selon l&apos;expérience, la spécialisation et la demande locale.
      </p>
    </div>
  );
}
