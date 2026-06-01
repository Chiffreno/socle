"use client";

// ============================================================
// SOCLE — Lignes cloisons dans la vue devis (Brique 2 / vue globale)
//
// Rendu des segments d'un lot cloisons en LIGNES DE DEVIS éditables : titre
// (libellé commercial) + description client générée + qté + PU/m² éditable
// (puOverride) + total + suppression. PLUS de détail interne affiché (il reste
// calculé, juste plus montré). + « Ajouter une ligne libre ».
// ============================================================

import { formatEuro } from "@/lib/devis/format";
import type { CloisonSegment } from "@/lib/devis/engine/types";
import type { LigneClient } from "@/lib/devis/engine/agregation";

interface Props {
  segments: CloisonSegment[];
  lignesClient: LigneClient[];
  onUpdate: (id: string, patch: Partial<CloisonSegment>) => void;
  onRemove: (id: string) => void;
  onAddLibre: () => void;
}

export default function CloisonsLignes({
  segments,
  lignesClient,
  onUpdate,
  onRemove,
  onAddLibre,
}: Props) {
  const segById = new Map(segments.map((s) => [s.id, s]));

  return (
    <div className="dee-lines">
      {lignesClient.map((lc) => {
        const seg = lc.segmentId ? segById.get(lc.segmentId) : undefined;
        const isLibre = seg?.type === "libre";
        return (
          <div className="dee-line" key={lc.segmentId}>
            <div className="dee-line-main">
              {isLibre ? (
                <input
                  className="dee-line-title-input"
                  value={seg?.lbl ?? ""}
                  placeholder="Libellé de la prestation"
                  onChange={(e) =>
                    seg && onUpdate(seg.id, { lbl: e.target.value })
                  }
                />
              ) : (
                <>
                  <span className="dee-line-title">{lc.libelleCommercial}</span>
                  {lc.description && (
                    <span className="dee-line-desc">{lc.description}</span>
                  )}
                </>
              )}
            </div>
            <span className="dee-line-qty">
              <input
                type="number"
                min={0}
                step={isLibre ? 1 : 0.5}
                value={seg?.m2 || ""}
                onChange={(e) =>
                  seg && onUpdate(seg.id, { m2: Number(e.target.value) || 0 })
                }
              />
              <i className="dee-line-u">{lc.unit}</i>
            </span>
            <span className="dee-line-pu">
              <input
                type="number"
                min={0}
                step={0.5}
                value={seg?.puOverride ?? ""}
                placeholder={lc.prixUnitaireClient ? String(lc.prixUnitaireClient) : "—"}
                title="PU client (vide = calculé)"
                onChange={(e) =>
                  seg &&
                  onUpdate(seg.id, {
                    puOverride:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
              <i className="dee-line-u">{isLibre ? "€" : "€/m²"}</i>
            </span>
            <span className="dee-line-total">{formatEuro(lc.prixClient)}</span>
            <button
              type="button"
              className="dee-line-del"
              onClick={() => seg && onRemove(seg.id)}
              title="Supprimer"
            >
              <i className="ti ti-trash" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button type="button" className="dee-line-addlibre" onClick={onAddLibre}>
        <i className="ti ti-plus" aria-hidden="true" /> Ajouter une ligne libre
      </button>
    </div>
  );
}
