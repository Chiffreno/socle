"use client";

// ============================================================
// SOCLE — Configurateur lot CLOISONS (Brique 2)
//
// 4 blocs de zone activables (façon Héméa) : on déplie/active la zone qu'on
// utilise (std + hydro couvrent l'essentiel ; hd/feu rares, repliées). Par
// zone active : surface m² + ossature + peaux + isolant acoustique + doublage
// montants. + chute % au niveau lot. Gamme = preset de démarrage (pré-remplit
// `o`, garde-fou anti-écrasement géré par le parent).
//
// Écrit dans `state.lots.cloisons.o` via `onChange` (merge) → les prestations
// agrégées et le récap se recalculent en temps réel. Périmètre : cloisons.
// ============================================================

import type { Qualite } from "@/lib/devis/engine/types";

type O = Record<string, unknown>;

interface Props {
  o: O;
  q: Qualite;
  /** Surface du lot (m²) — défaut proposé à l'activation d'une zone vide. */
  defaultSurf: number;
  /** Merge un patch dans `o` (→ patchLot(cur, { o: { ...o, ...patch } })). */
  onChange: (patch: O) => void;
  /** Applique le preset de gamme (garde-fou anti-écrasement côté parent). */
  onApplyGamme: (q: Qualite) => void;
}

const ZONES: ReadonlyArray<{ k: string; label: string }> = [
  { k: "std", label: "BA13 standard" },
  { k: "hydro", label: "BA13 hydrofuge" },
  { k: "hd", label: "BA13 haute dureté" },
  { k: "feu", label: "BA13 coupe-feu" },
];
const OSS = [
  { v: "m48", l: "M48" },
  { v: "m70", l: "M70" },
  { v: "m90", l: "M90" },
] as const;
const PEAUX = [
  { v: "2", l: "Simple peau" },
  { v: "4", l: "Double peau" },
] as const;
const ACOU = [
  { v: "non", l: "Aucun" },
  { v: "lv45", l: "LV 45" },
  { v: "lr45", l: "LR 45" },
] as const;
const GAMMES: ReadonlyArray<{ q: Qualite; l: string }> = [
  { q: "std", l: "Éco" },
  { q: "mid", l: "Standard" },
  { q: "prm", l: "Premium" },
];

const s = (v: unknown, d = "") => (v == null ? d : String(v));
const n = (v: unknown) => Number(v) || 0;

export default function CloisonsConfig({
  o,
  q,
  defaultSurf,
  onChange,
  onApplyGamme,
}: Props) {
  function toggleZone(k: string) {
    const on = !!o[`${k}_on`];
    if (on) {
      onChange({ [`${k}_on`]: false }); // garde m²/options pour réactivation
    } else {
      const m2 = n(o[`${k}_m2`]);
      onChange({ [`${k}_on`]: true, [`${k}_m2`]: m2 > 0 ? m2 : defaultSurf });
    }
  }

  return (
    <div className="dee-cfg">
      {/* Gamme = preset de démarrage */}
      <div className="dee-cfg-gamme">
        <span className="dee-cfg-gamme-label">Gamme (préremplit)</span>
        {GAMMES.map((g) => (
          <button
            key={g.q}
            type="button"
            className={`dee-cfg-pill${q === g.q ? " is-active" : ""}`}
            onClick={() => onApplyGamme(g.q)}
          >
            {g.l}
          </button>
        ))}
      </div>

      {/* Zones activables */}
      <div className="dee-cfg-zones">
        {ZONES.map((z) => {
          const on = !!o[`${z.k}_on`];
          return (
            <div className={`dee-cfg-zone${on ? " is-on" : ""}`} key={z.k}>
              <button
                type="button"
                className="dee-cfg-zone-head"
                onClick={() => toggleZone(z.k)}
                aria-expanded={on}
              >
                <span
                  className={`dee-cfg-switch${on ? " is-on" : ""}`}
                  aria-hidden="true"
                >
                  <span className="dee-cfg-switch-knob" />
                </span>
                <span className="dee-cfg-zone-name">{z.label}</span>
                {on && (
                  <span className="dee-cfg-zone-sum">
                    {n(o[`${z.k}_m2`])} m²
                  </span>
                )}
              </button>

              {on && (
                <div className="dee-cfg-zone-body">
                  <div className="dee-cfg-field">
                    <label className="dee-cfg-flabel">Surface</label>
                    <div className="dee-cfg-surf">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={n(o[`${z.k}_m2`]) || ""}
                        onChange={(e) =>
                          onChange({ [`${z.k}_m2`]: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="dee-cfg-unit">m²</span>
                    </div>
                  </div>

                  <div className="dee-cfg-field">
                    <label className="dee-cfg-flabel">Ossature</label>
                    <div className="dee-cfg-pills">
                      {OSS.map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          className={`dee-cfg-pill${
                            s(o[`${z.k}_oss`], "m48") === opt.v ? " is-active" : ""
                          }`}
                          onClick={() => onChange({ [`${z.k}_oss`]: opt.v })}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dee-cfg-field">
                    <label className="dee-cfg-flabel">Peaux</label>
                    <div className="dee-cfg-pills">
                      {PEAUX.map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          className={`dee-cfg-pill${
                            s(o[`${z.k}_peaux`], "2") === opt.v ? " is-active" : ""
                          }`}
                          onClick={() => onChange({ [`${z.k}_peaux`]: opt.v })}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="dee-cfg-field">
                    <label className="dee-cfg-flabel">Isolant acoustique</label>
                    <div className="dee-cfg-pills">
                      {ACOU.map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          className={`dee-cfg-pill${
                            s(o[`${z.k}_acou`], "non") === opt.v ? " is-active" : ""
                          }`}
                          onClick={() => onChange({ [`${z.k}_acou`]: opt.v })}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="dee-cfg-check">
                    <input
                      type="checkbox"
                      checked={!!o[`${z.k}_dbl_mont`]}
                      onChange={(e) =>
                        onChange({ [`${z.k}_dbl_mont`]: e.target.checked })
                      }
                    />
                    <span className="dee-cfg-check-box" aria-hidden="true" />
                    Montants doublés
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Réglage au niveau lot */}
      <div className="dee-cfg-lot">
        <label className="dee-cfg-flabel">Chute</label>
        <div className="dee-cfg-surf">
          <input
            type="number"
            min={0}
            step={1}
            value={n(o.chute) || ""}
            placeholder="5"
            onChange={(e) => onChange({ chute: Number(e.target.value) || 0 })}
          />
          <span className="dee-cfg-unit">%</span>
        </div>
      </div>
    </div>
  );
}
