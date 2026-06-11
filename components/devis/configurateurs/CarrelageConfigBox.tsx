"use client";

// ============================================================
// SOCLE — Box de configuration CARRELAGE (patron segments / vue globale)
//
// Trois familles dans un seul lot :
//   • Carrelage (m²) : type / dimension / colle (PAS de sous-couche).
//     La dimension pilote la consommation de colle (peigne, kg/m²).
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
import type {
  CarrelageColle,
  CarrelageDim,
  CarrelageType,
  EtancheiteMode,
} from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
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
const DIMS: ReadonlyArray<{ v: CarrelageDim; l: string }> = [
  { v: "30x30", l: "30×30" },
  { v: "60x60", l: "60×60" },
  { v: "60x120", l: "60×120" },
];
const COLLES: ReadonlyArray<{ v: CarrelageColle; l: string }> = [
  { v: "c2", l: "C2 standard" },
  { v: "c2s", l: "C2S1 flex" },
];
const MODES: ReadonlyArray<{ v: EtancheiteMode; l: string }> = [
  { v: "liquide", l: "Liquide (SEL)" },
  { v: "natte", l: "Natte" },
];

interface CarrelageDraft {
  type: CarrelageType;
  dim: CarrelageDim;
  colle: CarrelageColle;
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
    dim: "60x60",
    colle: "c2",
    m2: 0,
  });
  const [ml, setMl] = useState(0);
  const [et, setEt] = useState<{ mode: EtancheiteMode; m2: number }>({
    mode: "liquide",
    m2: 0,
  });

  function addCarrelage() {
    if (d.m2 <= 0) return;
    onAdd({ type: d.type, dim: d.dim, colle: d.colle, m2: d.m2 });
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
      <div className="dee-cfg-box-grid">
        <ConfigPills
          label="Famille"
          options={FAMILLES}
          value={famille}
          onChange={setFamille}
        />
      </div>

      {famille === "carrelage" ? (
        <>
          <div className="dee-cfg-box-grid">
            <ConfigPills
              label="Type"
              options={TYPES}
              value={d.type}
              onChange={(v) => setD((p) => ({ ...p, type: v }))}
            />
            <ConfigPills
              label="Dimension"
              options={DIMS}
              value={d.dim}
              onChange={(v) => setD((p) => ({ ...p, dim: v }))}
            />
            <ConfigPills
              label="Colle"
              options={COLLES}
              value={d.colle}
              onChange={(v) => setD((p) => ({ ...p, colle: v }))}
            />
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
