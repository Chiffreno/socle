"use client";

// ============================================================
// SOCLE — Configurateur lot CLOISONS (Brique 2 — modèle segments)
//
// UNE box de config en haut (pills Type/Ossature/Isolant/Peaux + doublés +
// surface + « Ajouter au devis » avec cumul) ; dessous, la liste des segments
// ajoutés — compacts, collapsables (détail interne déplié = liste de courses,
// jamais montrée au client). + « Ajouter une ligne libre ». Chute au niveau lot.
// Plus de gamme. Patron destiné à être dupliqué sur les autres lots.
// ============================================================

import { useState } from "react";
import { formatEuro } from "@/lib/devis/format";
import type {
  CloisonIso,
  CloisonOss,
  CloisonSegment,
  CloisonType,
} from "@/lib/devis/engine/types";
import type { LigneClient } from "@/lib/devis/engine/agregation";

interface DraftCfg {
  type: Exclude<CloisonType, "libre">;
  oss: CloisonOss;
  isolant: CloisonIso;
  peaux: "2" | "4";
  dbl: boolean;
  m2: number;
}

interface Props {
  segments: CloisonSegment[];
  /** Lignes client agrégées (pour prix/total/détail), matchées par segmentId. */
  lignesClient: LigneClient[];
  chute: number;
  onAdd: (cfg: Omit<DraftCfg, "m2"> & { m2: number }) => void;
  onAddLibre: () => void;
  onUpdate: (id: string, patch: Partial<CloisonSegment>) => void;
  onRemove: (id: string) => void;
  onChute: (n: number) => void;
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
const TYPE_LBL: Record<string, string> = {
  std: "BA13 standard",
  hydro: "BA13 hydrofuge",
  hd: "BA13 haute dureté",
  feu: "BA13 coupe-feu",
};

function configSubtitle(seg: CloisonSegment): string {
  const peaux = seg.peaux === "4" ? "double peau" : "simple peau";
  const iso =
    seg.isolant === "non"
      ? "sans isolant"
      : `${seg.isolant === "lv" ? "LV" : "LR"} ${OSS_EPA[seg.oss]}mm`;
  const dbl = seg.dbl ? " · montants doublés" : "";
  return `${seg.oss.toUpperCase()} · ${peaux} · ${iso}${dbl}`;
}

const stop = (e: React.MouseEvent) => e.stopPropagation();

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

export default function CloisonsConfig({
  segments,
  lignesClient,
  chute,
  onAdd,
  onAddLibre,
  onUpdate,
  onRemove,
  onChute,
}: Props) {
  const [draft, setDraft] = useState<DraftCfg>({
    type: "std",
    oss: "m48",
    isolant: "non",
    peaux: "2",
    dbl: false,
    m2: 0,
  });
  const lcById = new Map(lignesClient.map((lc) => [lc.segmentId, lc]));

  function add() {
    if (draft.m2 <= 0) return;
    onAdd({ ...draft });
    setDraft((d) => ({ ...d, m2: 0 }));
  }

  return (
    <div className="dee-cfg">
      {/* ── Box de configuration ────────────────────────────── */}
      <div className="dee-cfg-box">
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
          <button type="button" className="dee-cfg-add" onClick={add} disabled={draft.m2 <= 0}>
            <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
          </button>
        </div>
      </div>

      {/* ── Liste des segments ───────────────────────────────── */}
      {segments.length === 0 ? (
        <div className="dee-cfg-empty">
          Aucune ligne — configurez une cloison ci-dessus puis « Ajouter au devis ».
        </div>
      ) : (
        <div className="dee-cfg-seglist">
          {segments.map((seg) => {
            const lc = lcById.get(seg.id);
            const total = lc ? lc.prixClient : 0;
            const puCalc = lc ? lc.prixUnitaireClient : 0;

            if (seg.type === "libre") {
              return (
                <div className="dee-seg is-libre" key={seg.id}>
                  <div className="dee-seg-row">
                    <i className="ti ti-pencil dee-seg-libre-ic" aria-hidden="true" />
                    <input
                      className="dee-seg-libre-lbl"
                      value={seg.lbl ?? ""}
                      placeholder="Libellé de la prestation"
                      onChange={(e) => onUpdate(seg.id, { lbl: e.target.value })}
                    />
                    <span className="dee-seg-qty">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={seg.m2 || ""}
                        onChange={(e) => onUpdate(seg.id, { m2: Number(e.target.value) || 0 })}
                      />
                      <i className="dee-seg-u">{seg.unit || "u"}</i>
                    </span>
                    <span className="dee-seg-pu">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={seg.puOverride ?? ""}
                        placeholder="0"
                        onChange={(e) =>
                          onUpdate(seg.id, {
                            puOverride: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      <i className="dee-seg-u">€</i>
                    </span>
                    <span className="dee-seg-total">{formatEuro(total)}</span>
                    <button type="button" className="dee-seg-del" onClick={() => onRemove(seg.id)} title="Supprimer">
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <details className="dee-seg" key={seg.id}>
                <summary className="dee-seg-row">
                  <span className="dee-seg-caret" aria-hidden="true">
                    <i className="ti ti-chevron-right" />
                  </span>
                  <span className="dee-seg-main">
                    <span className="dee-seg-lbl">
                      Fourniture et pose de cloison {TYPE_LBL[seg.type]}
                    </span>
                    <span className="dee-seg-sub">{configSubtitle(seg)}</span>
                  </span>
                  <span className="dee-seg-qty" onClick={stop}>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={seg.m2 || ""}
                      onChange={(e) => onUpdate(seg.id, { m2: Number(e.target.value) || 0 })}
                    />
                    <i className="dee-seg-u">m²</i>
                  </span>
                  <span className="dee-seg-pu" onClick={stop}>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={seg.puOverride ?? ""}
                      placeholder={puCalc ? String(puCalc) : "—"}
                      title="PU client au m² (laisser vide = calculé)"
                      onChange={(e) =>
                        onUpdate(seg.id, {
                          puOverride: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                    <i className="dee-seg-u">€/m²</i>
                  </span>
                  <span className="dee-seg-total">{formatEuro(total)}</span>
                  <button
                    type="button"
                    className="dee-seg-del"
                    onClick={(e) => {
                      stop(e);
                      onRemove(seg.id);
                    }}
                    title="Supprimer"
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </summary>
                <div className="dee-seg-detail">
                  <div className="dee-seg-detail-head">
                    <i className="ti ti-list-details" aria-hidden="true" />
                    Détail interne — {lc?.detailInterne.length ?? 0} lignes (liste
                    de courses, non visible client)
                  </div>
                  <table className="dee-cli-detail-table">
                    <tbody>
                      {(lc?.detailInterne ?? []).map((it, j) => (
                        <tr key={j}>
                          <td className="lbl">
                            {it.lbl}
                            {it.note && <small>{it.note}</small>}
                          </td>
                          <td className="num">
                            {it.qty} {it.unit}
                          </td>
                          <td className="num">{formatEuro(it.p)}</td>
                          <td className="num">{formatEuro(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* ── Pied : ligne libre + chute lot ───────────────────── */}
      <div className="dee-cfg-foot">
        <button type="button" className="dee-cfg-libre-btn" onClick={onAddLibre}>
          <i className="ti ti-plus" aria-hidden="true" /> Ajouter une ligne libre
        </button>
        <span className="dee-cfg-chute">
          <span className="dee-cfg-flabel">Chute</span>
          <span className="dee-cfg-surf">
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
        </span>
      </div>
    </div>
  );
}
