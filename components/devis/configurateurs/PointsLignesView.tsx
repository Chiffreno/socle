"use client";

// ============================================================
// SOCLE — PointsLignesView : lignes client d'un lot À AGRÉGATEUR (élec…)
//
// Affiche les lignes agrégées (entry.lignes). Les lignes de POINT (catalogue,
// `overrideKey` défini) sont ÉDITABLES inline — crayon, comme les lignes libres :
// override PONCTUEL du prix unitaire ET du libellé sur CE devis (jamais le
// catalogue global). Infra / lignes sans `overrideKey` restent en lecture seule.
//
// Format C-split : sous-titre catégorie → ligne (libellé + qté + total) →
// description → « Fourniture : X · Pose : Y ». ZÉRO donnée interne.
// ============================================================

import { useState } from "react";
import { formatEuro } from "@/lib/devis/format";
import type { LigneClient } from "@/lib/devis/engine/agregation";

interface Props {
  lotIndex: number;
  lignesClient: LigneClient[];
  /** Override ponctuel d'un point (prix/libellé). Absent → lignes non éditables. */
  onOverride?: (overrideKey: string, patch: { pu?: number; lbl?: string }) => void;
  /** Réinitialise l'override d'un point (retour catalogue). */
  onResetOverride?: (overrideKey: string) => void;
}

export default function PointsLignesView({
  lotIndex,
  lignesClient,
  onOverride,
  onResetOverride,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  let prevCat: string | undefined;
  return (
    <div className="dee-pl">
      {lignesClient.map((lc, j) => {
        const showCat = lc.categorie && lc.categorie !== prevCat;
        prevCat = lc.categorie;
        const hasFP =
          lc.fournitureClient !== undefined && lc.poseClient !== undefined;
        const editable = !!lc.overrideKey && !!onOverride;
        const editing = editable && editId === lc.overrideKey;
        return (
          <div key={lc.segmentId ?? `${lc.prestationKey}-${j}`}>
            {showCat && <div className="dee-pl-cat">{lc.categorie}</div>}
            <div className={`dee-pl-row${editing ? " is-editing" : ""}`}>
              <span className="dee-pl-num">
                {lotIndex}.{j + 1}
              </span>
              <span className="dee-pl-body">
                <span className="dee-pl-head">
                  {editing ? (
                    <input
                      className="dee-pl-lbl-input"
                      value={lc.libelleCommercial}
                      placeholder="Libellé de la prestation"
                      autoFocus
                      onChange={(e) =>
                        onOverride!(lc.overrideKey!, { lbl: e.target.value })
                      }
                    />
                  ) : (
                    <span className="dee-pl-lbl">
                      {lc.libelleCommercial}
                      {lc.overridden && (
                        <span className="dee-pl-modif">modifié</span>
                      )}
                    </span>
                  )}
                  <span className="dee-pl-qty">
                    {lc.qty} {lc.unit}
                  </span>
                  <span className="dee-pl-total">
                    {formatEuro(lc.prixClient)}
                  </span>
                  {editable && (
                    <button
                      type="button"
                      className={`dee-pl-act${editing ? " is-on" : ""}`}
                      onClick={() =>
                        setEditId(editing ? null : lc.overrideKey!)
                      }
                      title={editing ? "Terminer" : "Modifier le prix / le libellé"}
                    >
                      <i
                        className={`ti ti-${editing ? "check" : "pencil"}`}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </span>
                {editing && (
                  <span className="dee-pl-edit">
                    <label className="dee-pl-edit-f">
                      Prix unitaire
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={lc.prixUnitaireClient || ""}
                        onChange={(e) =>
                          onOverride!(lc.overrideKey!, {
                            pu: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <span className="dee-pl-edit-u">€</span>
                    </label>
                    {lc.overridden && onResetOverride && (
                      <button
                        type="button"
                        className="dee-pl-reset"
                        onClick={() => onResetOverride(lc.overrideKey!)}
                        title="Revenir au prix et au libellé du catalogue"
                      >
                        <i className="ti ti-rotate-2" aria-hidden="true" />{" "}
                        Réinitialiser
                      </button>
                    )}
                  </span>
                )}
                {lc.description && (
                  <span className="dee-pl-desc">{lc.description}</span>
                )}
                {hasFP && (
                  <span className="dee-pl-fp">
                    Fourniture&nbsp;: {formatEuro(lc.fournitureClient!)} ·
                    Pose&nbsp;: {formatEuro(lc.poseClient!)}
                  </span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
