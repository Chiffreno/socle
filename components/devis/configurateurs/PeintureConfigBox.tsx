"use client";

// ============================================================
// SOCLE — Box de configuration PEINTURE (patron segments / vue globale)
//
// Deux familles dans un seul lot :
//   • Surfaces (m²) : support / nature / passes d'enduit / toile / finition.
//     Briques déboursé → MO + marge (comme cloisons). Règle toile→3 passes :
//     toile cochée force passes=3 ET verrouille le sélecteur ; décochée → restaure
//     la valeur d'avant verrouillage (défaut 1). L'option toile n'existe QUE sur
//     nature "ancien" (masquée sur BA13 ; bascule BA13 → toile décochée).
//   • Menuiseries (à l'unité) : porte / fenêtre à prix ferme (segment `libre`).
//
// Implémente le contrat SegmentConfigBoxProps (branché par l'éditeur via le
// registre SEGMENT_LOTS). En-tête vert, collapsable, même disposition que la box
// cloisons. PRIX MENUISERIES = PLACEHOLDERS marqués (passe prix temps 2).
// ============================================================

import { useState } from "react";
import type {
  PeintureFinition,
  PeintureMenuiserie,
  PeintureNature,
  PeintureSupport,
} from "@/lib/devis/engine/types";
import ConfigPills from "./ConfigPills";
import type { SegmentConfigBoxProps } from "./segment-config";

// PRIX INDICATIF — à remplacer par relevés terrain (passe prix temps 2).
const PRIX_PORTE = 45; // PRIX INDICATIF — peinture d'une porte (2 faces)
const PRIX_FENETRE = 35; // PRIX INDICATIF — peinture d'une fenêtre

const FAMILLES: ReadonlyArray<{ v: "surface" | "menuiserie"; l: string }> = [
  { v: "surface", l: "Surfaces" },
  { v: "menuiserie", l: "Menuiseries" },
];
const SUPPORTS: ReadonlyArray<{ v: PeintureSupport; l: string }> = [
  { v: "mur", l: "Mur" },
  { v: "plafond", l: "Plafond" },
];
const NATURES: ReadonlyArray<{ v: PeintureNature; l: string }> = [
  { v: "ancien", l: "Ancien" },
  { v: "ba13", l: "BA13" },
];
const PASSES: ReadonlyArray<{ v: string; l: string }> = [
  { v: "0", l: "0" },
  { v: "1", l: "1" },
  { v: "2", l: "2" },
  { v: "3", l: "3" },
];
const FINITIONS: ReadonlyArray<{ v: PeintureFinition; l: string }> = [
  { v: "mat", l: "Mat" },
  { v: "velours", l: "Velours" },
  { v: "satine", l: "Satinée" },
];
const MENUISERIES: ReadonlyArray<{ v: PeintureMenuiserie; l: string }> = [
  { v: "porte", l: "Porte" },
  { v: "fenetre", l: "Fenêtre" },
];

interface SurfaceDraft {
  support: PeintureSupport;
  nature: PeintureNature;
  passes: number;
  toile: boolean;
  finition: PeintureFinition;
  m2: number;
}

export default function PeintureConfigBox({
  onAdd,
}: SegmentConfigBoxProps) {
  const [famille, setFamille] = useState<"surface" | "menuiserie">("surface");

  const [s, setS] = useState<SurfaceDraft>({
    support: "mur",
    nature: "ancien",
    passes: 1,
    toile: false,
    finition: "mat",
    m2: 0,
  });
  // Mémoire des passes d'avant verrouillage toile (restaurées au décochage).
  const [passesMemo, setPassesMemo] = useState(1);

  const [men, setMen] = useState<{ menuiserie: PeintureMenuiserie; qty: number }>(
    { menuiserie: "porte", qty: 1 }
  );

  function setNature(v: PeintureNature) {
    // Bascule vers BA13 alors que toile cochée → toile retirée, passes déverrouillées.
    if (v === "ba13" && s.toile) {
      setS((d) => ({ ...d, nature: v, toile: false, passes: passesMemo }));
    } else {
      setS((d) => ({ ...d, nature: v }));
    }
  }
  function toggleToile(checked: boolean) {
    if (checked) {
      setPassesMemo(s.passes);
      setS((d) => ({ ...d, toile: true, passes: 3 }));
    } else {
      setS((d) => ({ ...d, toile: false, passes: passesMemo }));
    }
  }
  function setPasses(v: number) {
    if (s.toile) return; // verrouillé tant que la toile est cochée
    setS((d) => ({ ...d, passes: v }));
  }

  function addSurface() {
    if (s.m2 <= 0) return;
    onAdd({
      type: "surface",
      support: s.support,
      nature: s.nature,
      passes: s.passes,
      toile: s.nature === "ancien" && s.toile,
      finition: s.finition,
      m2: s.m2,
    });
    setS((d) => ({ ...d, m2: 0 }));
  }
  function addMenuiserie() {
    if (men.qty <= 0) return;
    const isPorte = men.menuiserie === "porte";
    onAdd({
      type: "libre",
      menuiserie: men.menuiserie,
      lbl: isPorte ? "Peinture de porte" : "Peinture de fenêtre",
      unit: "u",
      puOverride: isPorte ? PRIX_PORTE : PRIX_FENETRE,
      m2: men.qty,
    });
    setMen((d) => ({ ...d, qty: 1 }));
  }

  return (
    <div className="dee-cfg-body">
          <div className="dee-cfg-box-grid">
            <ConfigPills
              label="Famille"
              options={FAMILLES}
              value={famille}
              onChange={setFamille}
            />
          </div>

          {famille === "surface" ? (
            <>
              <div className="dee-cfg-box-grid">
                <ConfigPills
                  label="Support"
                  options={SUPPORTS}
                  value={s.support}
                  onChange={(v) => setS((d) => ({ ...d, support: v }))}
                />
                <ConfigPills
                  label="Nature"
                  options={NATURES}
                  value={s.nature}
                  onChange={setNature}
                />
                {s.toile ? (
                  <div className="dee-cfg-field">
                    <span className="dee-cfg-flabel">
                      Passes d&apos;enduit
                      <em className="dee-cfg-hint">verrouillé par la toile</em>
                    </span>
                    <div className="dee-cfg-pills">
                      <button
                        type="button"
                        className="dee-cfg-pill is-active"
                        disabled
                      >
                        3
                      </button>
                    </div>
                  </div>
                ) : (
                  <ConfigPills
                    label="Passes d'enduit"
                    options={PASSES}
                    value={String(s.passes)}
                    onChange={(v) => setPasses(Number(v))}
                  />
                )}
                <ConfigPills
                  label="Finition"
                  options={FINITIONS}
                  value={s.finition}
                  onChange={(v) => setS((d) => ({ ...d, finition: v }))}
                />
              </div>
              <div className="dee-cfg-box-action">
                {s.nature === "ancien" && (
                  <label className="dee-cfg-check">
                    <input
                      type="checkbox"
                      checked={s.toile}
                      onChange={(e) => toggleToile(e.target.checked)}
                    />
                    <span className="dee-cfg-check-box" aria-hidden="true" />
                    Toile à enduire
                  </label>
                )}
                <span className="dee-cfg-surf">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={s.m2 || ""}
                    placeholder="Surface"
                    onChange={(e) =>
                      setS((d) => ({ ...d, m2: Number(e.target.value) || 0 }))
                    }
                  />
                  <span className="dee-cfg-unit">m²</span>
                </span>
                <button
                  type="button"
                  className="dee-cfg-add"
                  onClick={addSurface}
                  disabled={s.m2 <= 0}
                >
                  <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="dee-cfg-box-grid">
                <ConfigPills
                  label="Menuiserie"
                  options={MENUISERIES}
                  value={men.menuiserie}
                  onChange={(v) => setMen((d) => ({ ...d, menuiserie: v }))}
                />
              </div>
              <div className="dee-cfg-box-action">
                <span className="dee-cfg-surf">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={men.qty || ""}
                    placeholder="Nombre"
                    onChange={(e) =>
                      setMen((d) => ({ ...d, qty: Number(e.target.value) || 0 }))
                    }
                  />
                  <span className="dee-cfg-unit">pièces</span>
                </span>
                <button
                  type="button"
                  className="dee-cfg-add"
                  onClick={addMenuiserie}
                  disabled={men.qty <= 0}
                >
                  <i className="ti ti-plus" aria-hidden="true" /> Ajouter au devis
                </button>
              </div>
            </>
          )}
    </div>
  );
}
