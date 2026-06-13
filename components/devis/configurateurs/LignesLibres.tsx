"use client";

// ============================================================
// SOCLE — Lignes LIBRES en cartes-prestation (vue globale, style Héméa)
//
// Composant générique réutilisé pour :
//   - les lignes libres d'un lot prédéfini (LotState.lignesLibres) ;
//   - les lignes d'un lot libre (LotLibre.lignes).
// Une ligne libre = prix de vente FERME (qty × pu, aucune marge moteur).
// Le titre éditable EST la désignation (champ `lbl`) — il n'y a pas de
// description auto-générée pour une ligne libre (contrairement aux cartes
// du configurateur). Crayon = éditer (désignation/qté/unité/PU inline),
// corbeille = supprimer. + bouton d'ajout en pointillé.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { formatEuro } from "@/lib/devis/format";
import type { LigneLibre } from "@/lib/devis/engine/types";

interface Props {
  /** Numéro de la section (lot) — pour la numérotation continue "lot.ligne". */
  lotIndex: number;
  /** Décalage de numérotation : nombre de lignes déjà rendues avant celles-ci
   *  dans la même section (ex. prestations du configurateur cloisons). */
  startIndex?: number;
  lignes: LigneLibre[];
  /** TVA de la zone (override lot ou défaut) — affichage seul. */
  tva: number;
  onUpdate: (id: string, patch: Partial<LigneLibre>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  addLabel?: string;
}

export default function LignesLibres({
  lotIndex,
  startIndex = 0,
  lignes,
  tva,
  onUpdate,
  onRemove,
  onAdd,
  addLabel = "Ajouter une ligne libre",
}: Props) {
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
      {lignes.map((l, j) => {
        const editing = editId === l.id;
        const qty = Number(l.qty) || 0;
        const pu = Number(l.pu) || 0;
        const total = qty * pu;
        const titre = (l.libelleOverride?.trim() || l.lbl || "").trim();
        return (
          <div className={`dee-pc${editing ? " is-editing" : ""}`} key={l.id}>
            <div className="dee-pc-eyebrow">Ligne libre</div>
            <div className="dee-pc-body">
              <div className="dee-pc-head">
                <span className="dee-pc-num">
                  {lotIndex}.{startIndex + j + 1}
                </span>
                {editing ? (
                  <input
                    className="dee-pc-title-input"
                    value={l.lbl ?? ""}
                    placeholder="Désignation de la prestation"
                    autoFocus
                    onChange={(e) => onUpdate(l.id, { lbl: e.target.value })}
                  />
                ) : (
                  <span className="dee-pc-title">
                    {titre || (
                      <em className="dee-pc-title-empty">Sans désignation</em>
                    )}
                  </span>
                )}
                <span className="dee-pc-actions">
                  <button
                    type="button"
                    className={`dee-pc-act${editing ? " is-on" : ""}`}
                    onClick={() => {
                      clearConfirm();
                      setEditId(editing ? null : l.id);
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
                      confirmId === l.id ? " is-confirm" : ""
                    }`}
                    onClick={() => handleDelete(l.id)}
                    title={
                      confirmId === l.id
                        ? "Confirmer la suppression"
                        : "Supprimer"
                    }
                  >
                    <i className="ti ti-trash" aria-hidden="true" />
                    {confirmId === l.id && (
                      <span className="dee-pc-act-confirm">Supprimer&nbsp;?</span>
                    )}
                  </button>
                </span>
              </div>

              {editing && (
                <div className="dee-pc-edit">
                  <label className="dee-pc-edit-f">
                    Quantité
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={l.qty || ""}
                      onChange={(e) =>
                        onUpdate(l.id, { qty: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                  <label className="dee-pc-edit-f">
                    Unité
                    <input
                      type="text"
                      className="dee-pc-edit-unit"
                      value={l.unit ?? ""}
                      placeholder="u"
                      onChange={(e) => onUpdate(l.id, { unit: e.target.value })}
                    />
                  </label>
                  <label className="dee-pc-edit-f">
                    Prix unitaire
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={l.pu || ""}
                      onChange={(e) =>
                        onUpdate(l.id, { pu: Number(e.target.value) || 0 })
                      }
                    />
                    <span className="dee-pc-edit-u">€</span>
                  </label>
                </div>
              )}

              <div className="dee-pc-foot">
                <span className="dee-pc-meta">
                  <span className="dee-pc-tva">TVA {tva}</span>
                  <span className="dee-pc-q">
                    {qty} {l.unit || "u"}
                  </span>
                  <span className="dee-pc-pu">
                    Prix unitaire {formatEuro(pu)}
                  </span>
                </span>
                <span className="dee-pc-total">{formatEuro(total)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" className="dee-line-addlibre" onClick={onAdd}>
        <i className="ti ti-plus" aria-hidden="true" /> {addLabel}
      </button>
    </div>
  );
}
