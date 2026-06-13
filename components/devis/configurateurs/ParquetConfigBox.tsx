"use client";

// ============================================================
// SOCLE — Box de configuration PARQUET (patron segments / vue globale)
//
// FAMILLE en ONGLETS (ConfigTabs), nettement séparée des sous-choix :
//   • Parquet (m²) : matériau / dimension de lame (TEXTE LIBRE descriptif) /
//     pose (flottant ou collé — VRAI choix métier, INCHANGÉ) / sous-couche.
//     Briques déboursé → MO + marge (comme peinture). Chute = réglage lot.
//   • Plinthes (ml) : segment DÉDIÉ (carte normale, badge/reset acquis),
//     prix au ml INDICATIF (bp.parquet_plinthes — à valider Benjamin).
//
// LISTES D'OPTIONS PLAUSIBLES MÉTIER — à valider Benjamin (placeholders) :
// dimension descriptive (aucun impact prix), colle MS = pose collée, sans colle
// = pose flottante.
// Dé-chrome-isée : rend <div className="dee-cfg-body"> uniquement — le repli
// est porté par la box lot. Implémente SegmentConfigBoxProps (registre
// SEGMENT_LOTS). AUCUNE notion de gamme.
// ============================================================

import { useState } from "react";
import type {
  ParquetColle,
  ParquetMateriau,
  ParquetSousCouche,
} from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
import ConfigTabs from "./ConfigTabs";
import type { SegmentConfigBoxProps } from "./segment-config";

const FAMILLES: ReadonlyArray<{ v: "parquet" | "plinthes"; l: string }> = [
  { v: "parquet", l: "Parquet" },
  { v: "plinthes", l: "Plinthes" },
];
// Listes plausibles métier — à valider Benjamin.
const MATERIAUX: ReadonlyArray<{ v: ParquetMateriau; l: string }> = [
  { v: "strat", l: "Stratifié" },
  { v: "contre", l: "Contrecollé" },
  { v: "massif", l: "Massif" },
];
const COLLES: ReadonlyArray<{ v: ParquetColle; l: string }> = [
  { v: "non", l: "Flottant (sans colle)" },
  { v: "ms", l: "Collé (MS polymère)" },
];
const SOUS_COUCHES: ReadonlyArray<{ v: ParquetSousCouche; l: string }> = [
  { v: "non", l: "Aucune" },
  { v: "mousse", l: "Mousse" },
  { v: "liege", l: "Liège" },
];

interface ParquetDraft {
  type: ParquetMateriau;
  /** Dimension de lame — texte libre descriptif (n'entre pas dans le calcul). */
  dim: string;
  colle: ParquetColle;
  sc: ParquetSousCouche;
  m2: number;
}

export default function ParquetConfigBox({
  o,
  onAdd,
  onPatchO,
}: SegmentConfigBoxProps) {
  const chute = Number(o.chute) || 0;
  const [famille, setFamille] = useState<"parquet" | "plinthes">("parquet");
  const [d, setD] = useState<ParquetDraft>({
    type: "strat",
    dim: "",
    colle: "non",
    sc: "mousse",
    m2: 0,
  });
  const [ml, setMl] = useState(0);

  function addParquet() {
    if (d.m2 <= 0) return;
    onAdd({ type: d.type, dim: d.dim.trim(), colle: d.colle, sc: d.sc, m2: d.m2 });
    setD((p) => ({ ...p, m2: 0 }));
  }
  function addPlinthes() {
    if (ml <= 0) return;
    onAdd({ type: "plinthes", unit: "ml", m2: ml });
    setMl(0);
  }

  return (
    <div className="dee-cfg-body">
      <ConfigTabs
        ariaLabel="Famille"
        options={FAMILLES}
        value={famille}
        onChange={setFamille}
      />

      {famille === "parquet" ? (
        <>
          <div className="dee-cfg-box-grid">
            <ConfigPills
              label="Matériau"
              options={MATERIAUX}
              value={d.type}
              onChange={(v) => setD((p) => ({ ...p, type: v }))}
            />
            <div className="dee-cfg-field">
              <span className="dee-cfg-flabel">Dimension de lame</span>
              <input
                className="dee-cfg-text"
                type="text"
                value={d.dim}
                placeholder="Lame large 190 mm"
                onChange={(e) => setD((p) => ({ ...p, dim: e.target.value }))}
              />
            </div>
            <ConfigPills
              label="Pose"
              options={COLLES}
              value={d.colle}
              onChange={(v) => setD((p) => ({ ...p, colle: v }))}
            />
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
              onClick={addParquet}
              disabled={d.m2 <= 0}
            >
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
            </button>
          </div>
        </>
      ) : (
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
      )}
    </div>
  );
}
