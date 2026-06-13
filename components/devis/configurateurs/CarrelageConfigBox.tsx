"use client";

// ============================================================
// SOCLE — Box de configuration CARRELAGE (patron segments / vue globale)
//
// FAMILLE en ONGLETS (ConfigTabs), nettement séparée des sous-choix :
//   • Carrelage (m²) : type / dimension (TEXTE LIBRE descriptif). Colle
//     FORFAITAIRE au calcul (plus de choix C2/C2S1, plus de pilotage par la
//     dimension). PAS de sous-couche.
//   • Plinthes (ml) : segment dédié (carte normale, badge/reset acquis).
//   • Étanchéité (m²) : OPTION ex-lot étanchéité — mode liquide (SEL) / natte,
//     segment dédié → UNE ligne au lot, carte normale. Prix au m² INDICATIFS
//     distincts (bp.etanche_liquide / bp.natte_etanche).
//
// LISTES D'OPTIONS PLAUSIBLES MÉTIER — à valider Benjamin (placeholders).
// Dé-chrome-isée : rend <div className="dee-cfg-body"> uniquement — le repli
// est porté par la box lot. Implémente SegmentConfigBoxProps. AUCUNE gamme.
// ============================================================

import { useState } from "react";
import type { CarrelageType, EtancheiteMode } from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
import ConfigTabs from "./ConfigTabs";
import type { SegmentConfigBoxProps } from "./segment-config";

const FAMILLES: ReadonlyArray<{
  v: "carrelage" | "plinthes" | "etancheite";
  l: string;
}> = [
  { v: "carrelage", l: "Carrelage" },
  { v: "plinthes", l: "Plinthes" },
  { v: "etancheite", l: "Étanchéité" },
];
// Listes plausibles métier — à valider Benjamin.
const TYPES: ReadonlyArray<{ v: CarrelageType; l: string }> = [
  { v: "ceram", l: "Céramique std" },
  { v: "gres", l: "Grès cérame" },
  { v: "gf", l: "Grand format" },
];
const MODES: ReadonlyArray<{ v: EtancheiteMode; l: string }> = [
  { v: "liquide", l: "Liquide (SEL)" },
  { v: "natte", l: "Natte" },
];

interface CarrelageDraft {
  type: CarrelageType;
  /** Dimension — texte libre descriptif (n'entre pas dans le calcul). */
  dim: string;
  m2: number;
}

export default function CarrelageConfigBox({
  o,
  onAdd,
  onPatchO,
}: SegmentConfigBoxProps) {
  const chute = Number(o.chute) || 0;
  const [famille, setFamille] = useState<
    "carrelage" | "plinthes" | "etancheite"
  >("carrelage");
  const [d, setD] = useState<CarrelageDraft>({
    type: "gres",
    dim: "",
    m2: 0,
  });
  const [ml, setMl] = useState(0);
  const [et, setEt] = useState<{ mode: EtancheiteMode; m2: number }>({
    mode: "liquide",
    m2: 0,
  });

  function addCarrelage() {
    if (d.m2 <= 0) return;
    onAdd({ type: d.type, dim: d.dim.trim(), m2: d.m2 });
    setD((p) => ({ ...p, m2: 0 }));
  }
  function addPlinthes() {
    if (ml <= 0) return;
    onAdd({ type: "plinthes", unit: "ml", m2: ml });
    setMl(0);
  }
  function addEtancheite() {
    if (et.m2 <= 0) return;
    onAdd({ type: "etancheite", mode: et.mode, m2: et.m2 });
    setEt((p) => ({ ...p, m2: 0 }));
  }

  return (
    <div className="dee-cfg-body">
      <ConfigTabs
        ariaLabel="Famille"
        options={FAMILLES}
        value={famille}
        onChange={setFamille}
      />

      {famille === "carrelage" ? (
        <>
          <div className="dee-cfg-box-grid">
            <ConfigPills
              label="Type"
              options={TYPES}
              value={d.type}
              onChange={(v) => setD((p) => ({ ...p, type: v }))}
            />
            <div className="dee-cfg-field">
              <span className="dee-cfg-flabel">Dimension</span>
              <input
                className="dee-cfg-text"
                type="text"
                value={d.dim}
                placeholder="60 × 60 cm"
                onChange={(e) => setD((p) => ({ ...p, dim: e.target.value }))}
              />
            </div>
          </div>
          <div className="dee-cfg-box-action">
            <span className="dee-cfg-surf">
              <input
                type="number"
                min={0}
                step={0.5}
                value={d.m2 || ""}
                placeholder="Surface"
                onChange={(e) =>
                  setD((p) => ({ ...p, m2: Number(e.target.value) || 0 }))
                }
              />
              <span className="dee-cfg-unit">m²</span>
            </span>
            <span className="dee-cfg-surf">
              <span className="dee-cfg-flabel" style={{ marginRight: 6 }}>
                Chute
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={chute || ""}
                placeholder="0"
                onChange={(e) =>
                  onPatchO({ chute: Number(e.target.value) || 0 })
                }
              />
              <span className="dee-cfg-unit">%</span>
            </span>
            <button
              type="button"
              className="dee-cfg-add"
              onClick={addCarrelage}
              disabled={d.m2 <= 0}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
            </button>
          </div>
        </>
      ) : famille === "plinthes" ? (
        <div className="dee-cfg-box-action">
          <span className="dee-cfg-surf">
            <input
              type="number"
              min={0}
              step={0.5}
              value={ml || ""}
              placeholder="Longueur"
              onChange={(e) => setMl(Number(e.target.value) || 0)}
            />
            <span className="dee-cfg-unit">ml</span>
          </span>
          <button
            type="button"
            className="dee-cfg-add"
            onClick={addPlinthes}
            disabled={ml <= 0}
          >
            <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
          </button>
        </div>
      ) : (
        <>
          <div className="dee-cfg-box-grid">
            <ConfigPills
              label="Mode"
              options={MODES}
              value={et.mode}
              onChange={(v) => setEt((p) => ({ ...p, mode: v }))}
            />
          </div>
          <div className="dee-cfg-box-action">
            <span className="dee-cfg-surf">
              <input
                type="number"
                min={0}
                step={0.5}
                value={et.m2 || ""}
                placeholder="Surface"
                onChange={(e) =>
                  setEt((p) => ({ ...p, m2: Number(e.target.value) || 0 }))
                }
              />
              <span className="dee-cfg-unit">m²</span>
            </span>
            <button
              type="button"
              className="dee-cfg-add"
              onClick={addEtancheite}
              disabled={et.m2 <= 0}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
            </button>
          </div>
        </>
      )}
    </div>
  );
}
