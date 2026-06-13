"use client";

// ============================================================
// SOCLE — SegmentCards : lignes d'un lot à SEGMENTS en cartes-prestation
//
// Généralisation de l'ancien CloisonsLignes → composant lot-agnostique pour
// tout lot à segments (cloisons, faux-plafond, ITI…). Chaque prestation = carte
// blanche : eyebrow (catégorie, portée par la LigneClient), numérotation, titre
// (libelleOverride / lbl libre), description client générée (auto, non éditable),
// pied (TVA, qté, PU, total). Crayon = éditer (titre/qté/PU inline), corbeille =
// supprimer. + ligne libre. Ne touche QUE les champs communs du segment.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { formatEuro } from "@/lib/devis/format";
import type { SegmentBase } from "@/lib/devis/engine/types";
import type { LigneClient } from "@/lib/devis/engine/agregation";

interface Props {
  lotIndex: number;
  segments: SegmentBase[];
  lignesClient: LigneClient[];
  onUpdate: (id: string, patch: Partial<SegmentBase>) => void;
  onRemove: (id: string) => void;
  onAddLibre: () => void;
}

export default function SegmentCards({
  lotIndex,
  segments,
  lignesClient,
  onUpdate,
  onRemove,
  onAddLibre,
}: Props) {
  const segById = new Map(segments.map((s) => [s.id, s]));
  const [editId, setEditId] = useState<string | null>(null);
  // Confirmation INLINE de suppression (anti-accident, pas de modale). 1 seule
  // ligne en attente à la fois ; auto-réarmement après ~3 s sans 2e clic.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    []
  );
  function clearConfirm() {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmId(null);
  }
  function handleDelete(id: string) {
    if (confirmId === id) {
      clearConfirm();
      onRemove(id); // appel existant inchangé
    } else {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmId(id);
      confirmTimer.current = setTimeout(() => setConfirmId(null), 3000);
    }
  }

  return (
    <div className="dee-pcs">
      {lignesClient.map((lc, j) => {
        const seg = lc.segmentId ? segById.get(lc.segmentId) : undefined;
        if (!seg) return null;
        const isLibre = seg.type === "libre";
        const editing = editId === seg.id;
        // Override actif (segments NON-libre uniquement) : prix surchargé ou
        // libellé renommé. Pour un segment `libre`, le prix/libellé SONT le
        // contenu (pas un override d'une baseline) → ni badge ni reset.
        const overridden =
          !isLibre &&
          (typeof seg.puOverride === "number" ||
            !!seg.libelleOverride?.trim());
        const eyebrow = lc.categorie || (isLibre ? "Ligne libre" : "Prestation");
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
                    value={isLibre ? seg.lbl ?? "" : seg.libelleOverride ?? ""}
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
                  <span className="dee-pc-title">
                    {lc.libelleCommercial}
                    {overridden && (
                      <span className="dee-pc-modif">modifié</span>
                    )}
                  </span>
                )}
                <span className="dee-pc-actions">
                  <button
                    type="button"
                    className={`dee-pc-act${editing ? " is-on" : ""}`}
                    onClick={() => {
                      clearConfirm();
                      setEditId(editing ? null : seg.id);
                    }}
                    title={editing ? "Terminer" : "Éditer"}
                  >
                    <i
                      className={`ti ti-${editing ? "check" : "pencil"}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className={`dee-pc-act is-del${
                      confirmId === seg.id ? " is-confirm" : ""
                    }`}
                    onClick={() => handleDelete(seg.id)}
                    title={
                      confirmId === seg.id
                        ? "Confirmer la suppression"
                        : "Supprimer"
                    }
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                    {confirmId === seg.id && (
                      <span className="dee-pc-act-confirm">Supprimer&nbsp;?</span>
                    )}
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
                      {isLibre ? "€" : `€/${lc.unit}`}
                    </span>
                  </label>
                  {overridden && (
                    <button
                      type="button"
                      className="dee-pc-reset"
                      onClick={() =>
                        onUpdate(seg.id, {
                          puOverride: undefined,
                          libelleOverride: undefined,
                        })
                      }
                      title="Revenir au prix et au libellé générés"
                    >
                      <i className="ti ti-rotate-2" aria-hidden="true" />{" "}
                      Réinitialiser
                    </button>
                  )}
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
