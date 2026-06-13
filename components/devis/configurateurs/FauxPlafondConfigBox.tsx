"use client";

// ============================================================
// SOCLE — Box de configuration FAUX-PLAFOND (patron segments)
//
// Calque du configurateur cloisons. Pills Plaque / Isolant / Peaux + réglages
// niveau lot (entraxe, bandes à joint, chute) + surface + « Ajouter au devis »
// (cumul géré côté éditeur). Pas de paramètre suspente (toujours à ressort).
// Implémente le contrat uniforme SegmentConfigBoxProps.
// ============================================================

import { useState } from "react";
import type {
  FauxPlafondIso,
  FauxPlafondType,
} from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
import type { SegmentConfigBoxProps } from "./segment-config";

interface DraftCfg {
  type: Exclude<FauxPlafondType, "libre">;
  isolant: FauxPlafondIso;
  peaux: "1" | "2";
  m2: number;
}

const TYPES: ReadonlyArray<{ v: DraftCfg["type"]; l: string }> = [
  { v: "std", l: "Standard" },
  { v: "hydro", l: "Hydrofuge" },
  { v: "feu", l: "Coupe-feu" },
  { v: "phon", l: "Phonique" },
];
const ISO: ReadonlyArray<{ v: FauxPlafondIso; l: string }> = [
  { v: "non", l: "Aucun" },
  { v: "lv45", l: "LV 45" },
  { v: "lr45", l: "LR 45" },
  { v: "lv100", l: "LV 100" },
  { v: "lr100", l: "LR 100" },
  { v: "ouate", l: "Ouate" },
];
const PEAUX: ReadonlyArray<{ v: "1" | "2"; l: string }> = [
  { v: "1", l: "Simple" },
  { v: "2", l: "Double" },
];
const ENTRAXE: ReadonlyArray<{ v: "0.50" | "0.60"; l: string }> = [
  { v: "0.60", l: "0,60 m" },
  { v: "0.50", l: "0,50 m" },
];

export default function FauxPlafondConfigBox({
  o,
  onAdd,
  onPatchO,
}: SegmentConfigBoxProps) {
  const chute = Number(o.chute) || 0;
  const entraxe = (String(o.entraxe || "0.60") === "0.50" ? "0.50" : "0.60") as
    | "0.50"
    | "0.60";
  const bandes = !!o.bandes;
  const [draft, setDraft] = useState<DraftCfg>({
    type: "std",
    isolant: "non",
    peaux: "1",
    m2: 0,
  });

  function add() {
    if (draft.m2 <= 0) return;
    onAdd({ ...draft });
    setDraft((d) => ({ ...d, m2: 0 }));
  }

  return (
    <div className="dee-cfg-body">
          <div className="dee-cfg-box-grid">
            <ConfigPills label="Plaque" options={TYPES} value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
            <ConfigPills label="Isolant" options={ISO} value={draft.isolant} onChange={(v) => setDraft((d) => ({ ...d, isolant: v }))} />
            <ConfigPills label="Peaux" options={PEAUX} value={draft.peaux} onChange={(v) => setDraft((d) => ({ ...d, peaux: v }))} />
            <ConfigPills label="Entraxe fourrures" options={ENTRAXE} value={entraxe} onChange={(v) => onPatchO({ entraxe: v })} />
          </div>
          <div className="dee-cfg-box-action">
            <label className="dee-cfg-check">
              <input
                type="checkbox"
                checked={bandes}
                onChange={(e) => onPatchO({ bandes: e.target.checked })}
              />
              <span className="dee-cfg-check-box" aria-hidden="true" />
              Bandes à joint
            </label>
            <span className="dee-cfg-surf">
              <input
                type="number"
                min={0}
                step={0.5}
                value={draft.m2 || ""}
                placeholder="Surface"
                onChange={(e) => setDraft((d) => ({ ...d, m2: Number(e.target.value) || 0 }))}
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
            <button type="button" className="dee-cfg-add" onClick={add} disabled={draft.m2 <= 0}>
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
            </button>
          </div>
    </div>
  );
}
