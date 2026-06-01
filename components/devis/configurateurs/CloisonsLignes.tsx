"use client";

// ============================================================
// SOCLE — Lignes cloisons en CARTES-PRESTATION (vue globale, style Héméa)
//
// Chaque prestation = carte blanche (ombre douce, radius) : eyebrow catégorie
// (fond orange pâle) + numérotation "1.1" + titre + description client + pied
// (badge TVA, qté, prix unitaire, total). Crayon = éditer (titre/qté/PU inline),
// corbeille = supprimer. Aucun détail interne affiché. + ligne libre.
// ============================================================

import { useState } from "react";
import { formatEuro } from "@/lib/devis/format";
import type { CloisonSegment } from "@/lib/devis/engine/types";
import type { LigneClient } from "@/lib/devis/engine/agregation";

interface Props {
  lotIndex: number;
  segments: CloisonSegment[];
  lignesClient: LigneClient[];
  onUpdate: (id: string, patch: Partial<CloisonSegment>) => void;
  onRemove: (id: string) => void;
  onAddLibre: () => void;
}

const EYEBROW: Record<string, string> = {
  std: "BA13 standard",
  hydro: "BA13 hydrofuge",
  hd: "BA13 haute dureté",
  feu: "BA13 coupe-feu",
};

export default function CloisonsLignes({
  lotIndex,
  segments,
  lignesClient,
  onUpdate,
  onRemove,
  onAddLibre,
}: Props) {
  const segById = new Map(segments.map((s) => [s.id, s]));
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div className="dee-pcs">
      {lignesClient.map((lc, j) => {
        const seg = lc.segmentId ? segById.get(lc.segmentId) : undefined;
        if (!seg) return null;
        const isLibre = seg.type === "libre";
        const editing = editId === seg.id;
        const eyebrow = isLibre ? "Ligne libre" : EYEBROW[seg.type] ?? "Cloison";
        return (
          <div className={`dee-pc${editing ? " is-editing" : ""}`} key={seg.id}>
            <div className="dee-pc-eyebrow">{eyebrow}</div>
            <div className="dee-pc-body">
              <div className="dee-pc-head">
                <span className="dee-pc-num">
                  {lotIndex}.{j + 1}
                </span>
                {editing ? (
                  <input
                    className="dee-pc-title-input"
                    value={
                      isLibre ? seg.lbl ?? "" : seg.libelleOverride ?? ""
                    }
                    placeholder={
                      isLibre ? "Libellé de la prestation" : lc.libelleTechnique
                    }
                    onChange={(e) =>
                      onUpdate(
                        seg.id,
                        isLibre
                          ? { lbl: e.target.value }
                          : { libelleOverride: e.target.value }
                      )
                    }
                  />
                ) : (
                  <span className="dee-pc-title">{lc.libelleCommercial}</span>
                )}
                <span className="dee-pc-actions">
                  <button
                    type="button"
                    className={`dee-pc-act${editing ? " is-on" : ""}`}
                    onClick={() => setEditId(editing ? null : seg.id)}
                    title={editing ? "Terminer" : "Éditer"}
                  >
                    <i
                      className={`ti ti-${editing ? "check" : "pencil"}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className="dee-pc-act is-del"
                    onClick={() => onRemove(seg.id)}
                    title="Supprimer"
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                  </button>
                </span>
              </div>

              {lc.description && (
                <div className="dee-pc-desc">{lc.description}</div>
              )}

              {editing && (
                <div className="dee-pc-edit">
                  <label className="dee-pc-edit-f">
                    Quantité
                    <input
                      type="number"
                      min={0}
                      step={isLibre ? 1 : 0.5}
                      value={seg.m2 || ""}
                      onChange={(e) =>
                        onUpdate(seg.id, { m2: Number(e.target.value) || 0 })
                      }
                    />
                    <span className="dee-pc-edit-u">{lc.unit}</span>
                  </label>
                  <label className="dee-pc-edit-f">
                    Prix unitaire
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={seg.puOverride ?? ""}
                      placeholder={
                        lc.prixUnitaireClient
                          ? String(lc.prixUnitaireClient)
                          : "—"
                      }
                      onChange={(e) =>
                        onUpdate(seg.id, {
                          puOverride:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                    <span className="dee-pc-edit-u">
                      {isLibre ? "€" : "€/m²"}
                    </span>
                  </label>
                </div>
              )}

              <div className="dee-pc-foot">
                <span className="dee-pc-meta">
                  <span className="dee-pc-tva">TVA {lc.tva}</span>
                  <span className="dee-pc-q">
                    {lc.qty} {lc.unit}
                  </span>
                  <span className="dee-pc-pu">
                    Prix unitaire {formatEuro(lc.prixUnitaireClient)}
                  </span>
                </span>
                <span className="dee-pc-total">{formatEuro(lc.prixClient)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" className="dee-line-addlibre" onClick={onAddLibre}>
        <i className="ti ti-plus" aria-hidden="true" /> Ajouter une ligne libre
      </button>
    </div>
  );
}
