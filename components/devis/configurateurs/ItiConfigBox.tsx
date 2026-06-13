"use client";

// ============================================================
// SOCLE — Box de configuration ITI (patron segments)
//
// Calque du configurateur cloisons / faux-plafond. Pills Isolant (famille) /
// Épaisseur / Parement + membrane (checkbox) + surface + chute + « Ajouter au
// devis » (cumul géré côté éditeur). L'isolant est la ligne hl de la prestation
// (R indicatif affiché). Implémente le contrat uniforme SegmentConfigBoxProps.
// ============================================================

import { useState } from "react";
import type {
  ItiEpa,
  ItiIso,
  ItiParement,
} from "@/lib/devis/engine/types";
import { itiRText } from "@/lib/devis/engine/iti";
import ConfigPills from "./ConfigPills";
import type { SegmentConfigBoxProps } from "./segment-config";

interface DraftCfg {
  type: ItiIso;
  epa: ItiEpa;
  membrane: boolean;
  parement: ItiParement;
  m2: number;
}

const ISO: ReadonlyArray<{ v: ItiIso; l: string }> = [
  { v: "lr", l: "Laine roche" },
  { v: "lv", l: "Laine verre" },
  { v: "fb", l: "Fibre bois" },
  { v: "pse", l: "Polystyrène" },
];
const EPA: ReadonlyArray<{ v: ItiEpa; l: string }> = [
  { v: "80", l: "80" },
  { v: "100", l: "100" },
  { v: "120", l: "120" },
  { v: "145", l: "145" },
  { v: "160", l: "160" },
  { v: "180", l: "180" },
  { v: "200", l: "200" },
];
const PAR: ReadonlyArray<{ v: ItiParement; l: string }> = [
  { v: "ba13_std", l: "BA13 std" },
  { v: "ba13_hydro", l: "BA13 hydro" },
  { v: "aucun", l: "Aucun" },
];

export default function ItiConfigBox({
  o,
  onAdd,
  onPatchO,
}: SegmentConfigBoxProps) {
  const chute = Number(o.chute) || 0;
  const [draft, setDraft] = useState<DraftCfg>({
    type: "lr",
    epa: "120",
    membrane: false,
    parement: "ba13_std",
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
            <ConfigPills label="Isolant" options={ISO} value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
            <ConfigPills
              label="Épaisseur"
              hint={`R ≈ ${itiRText(draft.type, draft.epa)} m².K/W`}
              options={EPA}
              value={draft.epa}
              onChange={(v) => setDraft((d) => ({ ...d, epa: v }))}
            />
            <ConfigPills label="Parement" options={PAR} value={draft.parement} onChange={(v) => setDraft((d) => ({ ...d, parement: v }))} />
          </div>
          <div className="dee-cfg-box-action">
            <label className="dee-cfg-check">
              <input
                type="checkbox"
                checked={draft.membrane}
                onChange={(e) => setDraft((d) => ({ ...d, membrane: e.target.checked }))}
              />
              <span className="dee-cfg-check-box" aria-hidden="true" />
              Membrane frein-vapeur
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
