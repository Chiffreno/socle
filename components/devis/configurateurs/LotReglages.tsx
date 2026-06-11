"use client";

// ============================================================
// SOCLE — LotReglages : barre de réglages partagée d'un lot (surface · marge ·
// MO · revient pts). Bloc EXTRAIT une fois, rendu DANS la box repliable
// du lot (plus de barre fixe au-dessus). Champs conditionnels pilotés par
// l'éditeur (showSurface / showRevient) → on n'affiche jamais un champ
// inutile. Pur layout : `onPatch` = patchLot(lotId, …), inchangé.
// (Le sélecteur de gamme Éco/Standard/Premium a été supprimé — plus de
// gammes, décision produit juin 2026.)
// ============================================================

import type { LotState } from "@/lib/devis/engine/types";

interface Props {
  lot: LotState;
  globalSurf: number;
  showSurface: boolean;
  showRevient: boolean;
  onPatch: (patch: Partial<LotState>) => void;
}

export default function LotReglages({
  lot,
  globalSurf,
  showSurface,
  showRevient,
  onPatch,
}: Props) {
  return (
    <div className="dee-reglages">
      <div className="dee-config-controls">
        {showSurface && (
          <span className="dee-inline-field">
            surface
            <input
              type="number"
              min={0}
              step={0.5}
              value={lot.surf ?? ""}
              placeholder={String(globalSurf || 0)}
              onChange={(e) =>
                onPatch({
                  surf: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
            <span className="dee-inline-unit">m²</span>
          </span>
        )}
        <span className="dee-inline-field">
          marge
          <input
            type="number"
            min={0}
            step={1}
            value={lot.m}
            onChange={(e) => onPatch({ m: Number(e.target.value) || 0 })}
          />
          <span className="dee-inline-unit">%</span>
        </span>
        <span className="dee-inline-field">
          MO
          <input
            type="number"
            min={0}
            step={0.5}
            value={lot.tempsMoHeures || ""}
            onChange={(e) =>
              onPatch({ tempsMoHeures: Number(e.target.value) || 0 })
            }
          />
          <span className="dee-inline-unit">h</span>
        </span>
        {showRevient && (
          <span className="dee-inline-field">
            revient pts
            <input
              type="number"
              min={0}
              step={1}
              value={lot.coutRevientPoints ?? ""}
              placeholder="—"
              onChange={(e) =>
                onPatch({
                  coutRevientPoints:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
            <span className="dee-inline-unit">€</span>
          </span>
        )}
      </div>
    </div>
  );
}
