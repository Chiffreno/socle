"use client";

// ============================================================
// SOCLE — Box de configuration FAÏENCE (patron segments / vue globale)
//
// FAMILLE en ONGLETS (ConfigTabs), nettement séparée des sous-choix :
//   • Faïence (m²) : type / dimension (TEXTE LIBRE descriptif) / sous-couche
//     (primaire d'accrochage — CONSERVÉE). Colle FORFAITAIRE au calcul (plus de
//     choix C2/C2S1, plus de pilotage par la dimension).
//   • Étanchéité (m²) : OPTION ex-lot étanchéité — mode liquide (SEL) / natte,
//     segment dédié → UNE ligne, carte normale (badge/reset acquis).
// PAS de plinthes (décision produit).
//
// LISTES D'OPTIONS PLAUSIBLES MÉTIER — à valider Benjamin (placeholders).
// Dé-chrome-isée : rend <div className="dee-cfg-body"> uniquement — le repli
// est porté par la box lot. Implémente SegmentConfigBoxProps. AUCUNE gamme.
// ============================================================

import { useState } from "react";
import type {
  EtancheiteMode,
  FaienceSousCouche,
  FaienceType,
} from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
import ConfigTabs from "./ConfigTabs";
import type { SegmentConfigBoxProps } from "./segment-config";

const FAMILLES: ReadonlyArray<{ v: "faience" | "etancheite"; l: string }> = [
  { v: "faience", l: "Faïence" },
  { v: "etancheite", l: "Étanchéité" },
];
// Listes plausibles métier — à valider Benjamin.
const TYPES: ReadonlyArray<{ v: FaienceType; l: string }> = [
  { v: "fai", l: "Faïence std" },
  { v: "gres", l: "Grès mural" },
  { v: "gf", l: "Grand format" },
];
const SOUS_COUCHES: ReadonlyArray<{ v: FaienceSousCouche; l: string }> = [
  { v: "non", l: "Aucune" },
  { v: "primaire", l: "Primaire d'accrochage" },
];
const MODES: ReadonlyArray<{ v: EtancheiteMode; l: string }> = [
  { v: "liquide", l: "Liquide (SEL)" },
  { v: "natte", l: "Natte" },
];

interface FaienceDraft {
  type: FaienceType;
  /** Dimension — texte libre descriptif (n'entre pas dans le calcul). */
  dim: string;
  sc: FaienceSousCouche;
  m2: number;
}

export default function FaienceConfigBox({
  o,
  onAdd,
  onPatchO,
}: SegmentConfigBoxProps) {
  const chute = Number(o.chute) || 0;
  const [famille, setFamille] = useState<"faience" | "etancheite">("faience");
  const [d, setD] = useState<FaienceDraft>({
    type: "fai",
    dim: "",
    sc: "non",
    m2: 0,
  });
  const [et, setEt] = useState<{ mode: EtancheiteMode; m2: number }>({
    mode: "liquide",
    m2: 0,
  });

  function addFaience() {
    if (d.m2 <= 0) return;
    onAdd({ type: d.type, dim: d.dim.trim(), sc: d.sc, m2: d.m2 });
    setD((p) => ({ ...p, m2: 0 }));
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

      {famille === "faience" ? (
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
                placeholder="30 × 60 cm"
                onChange={(e) => setD((p) => ({ ...p, dim: e.target.value }))}
              />
            </div>
            <ConfigPills
              label="Sous-couche"
              options={SOUS_COUCHES}
              value={d.sc}
              onChange={(v) => setD((p) => ({ ...p, sc: v }))}
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
              onClick={addFaience}
              disabled={d.m2 <= 0}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
            </button>
          </div>
        </>
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
