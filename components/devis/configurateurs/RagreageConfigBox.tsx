"use client";

// ============================================================
// SOCLE — Box de configuration RAGRÉAGE (patron segments / vue globale)
//
// UNE seule famille → PAS de barre d'onglets (un onglet unique ferait vide).
// Le configurateur rend directement ses sous-choix dans dee-cfg-body, cohérent
// avec les autres box (aucun chrome propre — le repli est porté par la box lot) :
//   • Type : standard / fibré (clés BP ragreage_simple / ragreage_fibre, €/kg).
//   • Épaisseur (mm) : champ NUMÉRIQUE libre qui PILOTE la dose produit
//     (1,6 kg/m²/mm × épaisseur × surface). Pas de pills figées.
//   • Primaire d'accrochage : option oui/non (consommable au m²).
//   • Surface (m²) + chute (%).
// Bouton « Ajouter » désactivé tant que surface OU épaisseur ≤ 0 → aucun segment
// à épaisseur nulle. Implémente SegmentConfigBoxProps. AUCUNE gamme.
// ============================================================

import { useState } from "react";
import type { RagreageType } from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
import type { SegmentConfigBoxProps } from "./segment-config";

// Listes plausibles métier — à valider Benjamin.
const TYPES: ReadonlyArray<{ v: RagreageType; l: string }> = [
  { v: "standard", l: "Standard" },
  { v: "fibre", l: "Fibré" },
];
const PRIMAIRE: ReadonlyArray<{ v: "non" | "oui"; l: string }> = [
  { v: "non", l: "Aucun" },
  { v: "oui", l: "Primaire d'accrochage" },
];

interface RagreageDraft {
  type: RagreageType;
  /** Épaisseur mm — pilote la dose produit (kg). */
  epa: number;
  prim: "non" | "oui";
  m2: number;
}

export default function RagreageConfigBox({
  o,
  onAdd,
  onPatchO,
}: SegmentConfigBoxProps) {
  const chute = Number(o.chute) || 0;
  const [d, setD] = useState<RagreageDraft>({
    type: "standard",
    epa: 0,
    prim: "non",
    m2: 0,
  });

  function addRagreage() {
    if (d.m2 <= 0 || d.epa <= 0) return;
    onAdd({
      type: d.type,
      epa: d.epa,
      primaire: d.prim === "oui",
      m2: d.m2,
    });
    setD((p) => ({ ...p, m2: 0 }));
  }

  return (
    <div className="dee-cfg-body">
      <div className="dee-cfg-box-grid">
        <ConfigPills
          label="Type"
          options={TYPES}
          value={d.type}
          onChange={(v) => setD((p) => ({ ...p, type: v }))}
        />
        <div className="dee-cfg-field">
          <span className="dee-cfg-flabel">Épaisseur</span>
          <span className="dee-cfg-surf">
            <input
              type="number"
              min={0}
              step={1}
              value={d.epa || ""}
              placeholder="0"
              onChange={(e) =>
                setD((p) => ({ ...p, epa: Number(e.target.value) || 0 }))
              }
            />
            <span className="dee-cfg-unit">mm</span>
          </span>
        </div>
        <ConfigPills
          label="Primaire d'accrochage"
          options={PRIMAIRE}
          value={d.prim}
          onChange={(v) => setD((p) => ({ ...p, prim: v }))}
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
            onChange={(e) => onPatchO({ chute: Number(e.target.value) || 0 })}
          />
          <span className="dee-cfg-unit">%</span>
        </span>
        <button
          type="button"
          className="dee-cfg-add"
          onClick={addRagreage}
          disabled={d.m2 <= 0 || d.epa <= 0}
        >
          <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
        </button>
      </div>
    </div>
  );
}
