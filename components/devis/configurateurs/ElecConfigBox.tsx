"use client";

// ============================================================
// SOCLE — Box de configuration ÉLECTRICITÉ (lot "à points", PAS segments)
//
// Alimente UNIQUEMENT lot.o (sauvegarde auto via onPatchO). Ne recalcule rien :
// le moteur + agregerElec restent la source des montants. Trois zones, charte
// artisan (en-tête vert, ConfigPills, Tabler outline) :
//   1. Points — nav horizontale par catégorie (1 visible à la fois) + grille
//      compacte ; quantité saisissable au clavier + boutons −/+ ; badge total
//      par catégorie.
//   2. Infrastructure — tableau, réseau (aucun/m²/forfait), GTL & terre en pills
//      vertes (toggle), VMC. (Consuel retiré de l'UI — branche moteur inerte.)
//   3. Présentation client — détail / forfait (o.presentation).
// Override prix/libellé PAR POINT = hors périmètre (B2).
// ============================================================

import { useState } from "react";
import { CATALOGUE_ELEC } from "@/lib/devis/engine/catalogue-elec";
import { groupByCategorie } from "@/lib/devis/engine/points";
import { BP } from "@/lib/devis/engine/bp";
import { formatEuro } from "@/lib/devis/format";
import ConfigPills from "./ConfigPills";

interface Props {
  o: Record<string, unknown>;
  onPatchO: (patch: Record<string, unknown>) => void;
  globalSurf: number;
}

// Prix réseau au m² — INDICATIF (cf. bp.ts). Lu pour l'affichage du montant
// engagé ; le calcul reste côté moteur.
const RESEAU_PRIX_M2 = BP.elec_reseau_m2 ?? 20;

const SECTIONS = groupByCategorie(CATALOGUE_ELEC);

const TABLEAU_OPTS = [
  { v: "0", l: "Aucun" },
  { v: "1", l: "1" },
  { v: "2", l: "2" },
  { v: "3", l: "3" },
  { v: "4", l: "4" },
  { v: "5", l: "5" },
  { v: "6", l: "6" },
] as const;
const RESEAU_OPTS = [
  { v: "aucun", l: "Aucun" },
  { v: "m2", l: "Au m²" },
  { v: "forfait", l: "Forfait" },
] as const;
const VMC_OPTS = [
  { v: "none", l: "Aucune" },
  { v: "sf", l: "Simple flux" },
  { v: "df", l: "Double flux" },
] as const;

export default function ElecConfigBox({ o, onPatchO, globalSurf }: Props) {
  const [activeCat, setActiveCat] = useState<string>("prises");

  const points = (o.points as Record<string, number> | undefined) || {};
  const catTotal = (catId: string): number =>
    SECTIONS.find((s) => s.categorie.id === catId)!.prestations.reduce(
      (a, p) => a + (Number(points[p.id]) || 0),
      0
    );

  function setQty(id: string, qty: number) {
    const next = { ...points };
    const n = Math.max(0, Math.floor(qty) || 0);
    if (n > 0) next[id] = n;
    else delete next[id]; // qty 0 → clé nettoyée (pas de 0 stocké)
    onPatchO({ points: next });
  }

  const tableau = Number(o.tableau_rangees) || 0;
  const reseauMode =
    o.reseau_mode === "m2" || o.reseau_mode === "forfait"
      ? (o.reseau_mode as string)
      : "aucun";
  const reseauForfait = Number(o.reseau_forfait) || 0;
  const reseauPrixM2 =
    o.reseau_prix_m2 != null ? Number(o.reseau_prix_m2) : RESEAU_PRIX_M2;
  const vmc = o.vmc === "sf" || o.vmc === "df" ? (o.vmc as string) : "none";

  const activePrestations =
    SECTIONS.find((s) => s.categorie.id === activeCat)?.prestations ?? [];

  return (
    <div className="dee-cfg-body">
          {/* ── ZONE 1 — POINTS ─────────────────────────────────── */}
          <div className="dee-elec-zone">
            <span className="dee-elec-zone-t">Points</span>

            <div className="dee-elec-catnav" role="tablist">
              {SECTIONS.map(({ categorie }) => {
                const total = catTotal(categorie.id);
                const active = activeCat === categorie.id;
                return (
                  <button
                    key={categorie.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`dee-elec-tab${active ? " is-active" : ""}`}
                    onClick={() => setActiveCat(categorie.id)}
                  >
                    {categorie.label}
                    <span
                      className={`dee-elec-tab-badge${total > 0 ? " is-on" : ""}`}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="dee-elec-grid">
              {activePrestations.map((p) => {
                const qty = Number(points[p.id]) || 0;
                return (
                  <div
                    className={`dee-elec-cell${qty > 0 ? " is-on" : ""}`}
                    key={p.id}
                  >
                    <span className="dee-elec-cell-lbl">{p.libelle}</span>
                    <span className="dee-elec-qty">
                      <button
                        type="button"
                        className="dee-elec-cbtn"
                        onClick={() => setQty(p.id, qty - 1)}
                        disabled={qty <= 0}
                        aria-label="Retirer un"
                      >
                        <i className="ti ti-minus" aria-hidden="true" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="dee-elec-qty-input"
                        value={qty || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setQty(p.id, Number(e.target.value) || 0)
                        }
                      />
                      <button
                        type="button"
                        className="dee-elec-cbtn"
                        onClick={() => setQty(p.id, qty + 1)}
                        aria-label="Ajouter un"
                      >
                        <i className="ti ti-plus" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── ZONE 2 — INFRASTRUCTURE ─────────────────────────── */}
          <div className="dee-elec-zone">
            <span className="dee-elec-zone-t">Infrastructure</span>
            <div className="dee-cfg-box-grid">
              <ConfigPills
                label="Tableau (rangées)"
                options={TABLEAU_OPTS}
                value={String(tableau)}
                onChange={(v) => onPatchO({ tableau_rangees: Number(v) })}
              />
              <ConfigPills
                label="Installation réseau"
                options={RESEAU_OPTS}
                value={reseauMode}
                onChange={(v) =>
                  onPatchO({ reseau_mode: v === "aucun" ? undefined : v })
                }
              />
            </div>

            {reseauMode === "m2" && (
              <div className="dee-elec-reseau-hint">
                <span className="num">{globalSurf || 0}</span> m² ×
                <span className="dee-cfg-surf dee-elec-reseau-prix">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={reseauPrixM2}
                    onChange={(e) =>
                      onPatchO({ reseau_prix_m2: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="dee-cfg-unit">€/m²</span>
                </span>
                <sup>*</sup> ={" "}
                <strong className="num">
                  {formatEuro((globalSurf || 0) * reseauPrixM2)}
                </strong>
                <em className="dee-elec-indic"> * prix indicatif, à valider</em>
              </div>
            )}
            {reseauMode === "forfait" && (
              <div className="dee-elec-row">
                <span className="dee-cfg-flabel">Montant réseau</span>
                <span className="dee-cfg-surf">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={reseauForfait || ""}
                    placeholder="0"
                    onChange={(e) =>
                      onPatchO({ reseau_forfait: Number(e.target.value) || 0 })
                    }
                  />
                  <span className="dee-cfg-unit">€</span>
                </span>
              </div>
            )}

            <div className="dee-cfg-box-grid">
              <div className="dee-cfg-field">
                <span className="dee-cfg-flabel">Options</span>
                <div className="dee-cfg-pills">
                  <button
                    type="button"
                    className={`dee-cfg-pill${o.gtl ? " is-active" : ""}`}
                    aria-pressed={!!o.gtl}
                    onClick={() => onPatchO({ gtl: !o.gtl })}
                  >
                    GTL
                  </button>
                  <button
                    type="button"
                    className={`dee-cfg-pill${o.terre ? " is-active" : ""}`}
                    aria-pressed={!!o.terre}
                    onClick={() => onPatchO({ terre: !o.terre })}
                  >
                    Mise à la terre
                  </button>
                </div>
              </div>
              <ConfigPills
                label="VMC"
                options={VMC_OPTS}
                value={vmc}
                onChange={(v) =>
                  onPatchO({ vmc: v === "none" ? undefined : v })
                }
              />
            </div>
          </div>
    </div>
  );
}
