"use client";

// ============================================================
// SOCLE — Box de configuration CLOISONS (Brique 2 / vue globale)
//
// La box d'AJOUT seule (pills Type/Ossature/Isolant/Peaux + doublés + surface
// + « Ajouter au devis » avec cumul + chute lot). Collapsable, en-tête VERT
// (chevron blanc). La LISTE des segments vit dans la vue devis (bas-centre),
// plus ici. Patron destiné aux autres lots.
// ============================================================

import { useState } from "react";
import type {
  CloisonIso,
  CloisonOss,
  CloisonType,
} from "@/lib/devis/engine/types";

interface DraftCfg {
  type: Exclude<CloisonType, "libre">;
  oss: CloisonOss;
  isolant: CloisonIso;
  peaux: "2" | "4";
  dbl: boolean;
  m2: number;
}

interface Props {
  chute: number;
  onAdd: (cfg: DraftCfg) => void;
  onChute: (n: number) => void;
  /** Ouverte par défaut (ex. lot vide) ou repliée. */
  defaultOpen?: boolean;
}

const TYPES: ReadonlyArray<{ v: DraftCfg["type"]; l: string }> = [
  { v: "std", l: "Standard" },
  { v: "hydro", l: "Hydrofuge" },
  { v: "hd", l: "Haute dureté" },
  { v: "feu", l: "Coupe-feu" },
];
const OSS: ReadonlyArray<{ v: CloisonOss; l: string }> = [
  { v: "m48", l: "M48" },
  { v: "m70", l: "M70" },
  { v: "m90", l: "M90" },
];
const ISO: ReadonlyArray<{ v: CloisonIso; l: string }> = [
  { v: "non", l: "Aucun" },
  { v: "lv", l: "Laine verre" },
  { v: "lr", l: "Laine roche" },
];
const PEAUX: ReadonlyArray<{ v: "2" | "4"; l: string }> = [
  { v: "2", l: "Simple" },
  { v: "4", l: "Double" },
];
const OSS_EPA: Record<CloisonOss, string> = { m48: "45", m70: "70", m90: "90" };

function Pills<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ v: T; l: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="dee-cfg-field">
      <span className="dee-cfg-flabel">
        {label}
        {hint && <em className="dee-cfg-hint">{hint}</em>}
      </span>
      <div className="dee-cfg-pills">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={`dee-cfg-pill${value === o.v ? " is-active" : ""}`}
            onClick={() => onChange(o.v)}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CloisonsConfigBox({
  chute,
  onAdd,
  onChute,
  defaultOpen = true,
}: Props) {
  const [draft, setDraft] = useState<DraftCfg>({
    type: "std",
    oss: "m48",
    isolant: "non",
    peaux: "2",
    dbl: false,
    m2: 0,
  });
  const [open, setOpen] = useState(defaultOpen);

  function add() {
    if (draft.m2 <= 0) return;
    onAdd({ ...draft });
    setDraft((d) => ({ ...d, m2: 0 }));
  }

  return (
    <div className={`dee-cfg-box${open ? "" : " is-collapsed"}`}>
      <button
        type="button"
        className="dee-cfg-box-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <i className="ti ti-tools dee-cfg-box-head-ic" aria-hidden="true" />
        <span className="dee-cfg-box-title">Configurer une cloison</span>
        <i
          className={`ti ti-chevron-${open ? "up" : "down"} dee-cfg-box-caret`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="dee-cfg-box-body">
          <div className="dee-cfg-box-grid">
            <Pills label="Type" options={TYPES} value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v }))} />
            <Pills label="Ossature" options={OSS} value={draft.oss} onChange={(v) => setDraft((d) => ({ ...d, oss: v }))} />
            <Pills
              label="Isolant"
              hint={`épaisseur ${OSS_EPA[draft.oss]}mm`}
              options={ISO}
              value={draft.isolant}
              onChange={(v) => setDraft((d) => ({ ...d, isolant: v }))}
            />
            <Pills label="Peaux" options={PEAUX} value={draft.peaux} onChange={(v) => setDraft((d) => ({ ...d, peaux: v }))} />
          </div>
          <div className="dee-cfg-box-action">
            <label className="dee-cfg-check">
              <input
                type="checkbox"
                checked={draft.dbl}
                onChange={(e) => setDraft((d) => ({ ...d, dbl: e.target.checked }))}
              />
              <span className="dee-cfg-check-box" aria-hidden="true" />
              Montants doublés
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
                placeholder="5"
                onChange={(e) => onChute(Number(e.target.value) || 0)}
              />
              <span className="dee-cfg-unit">%</span>
            </span>
            <button type="button" className="dee-cfg-add" onClick={add} disabled={draft.m2 <= 0}>
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
