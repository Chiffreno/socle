"use client";

// ============================================================
// SOCLE — Page de FINALISATION du devis (étape « habiller »)
//
// Écran à part entière entre l'éditeur (chiffrer) et le PDF (aperçu). Absorbe
// toute l'ancienne en-tête du devis : numéro, objet, dates, délai, remise,
// acompte, message d'intro, notes internes. Source UNIQUE de ces champs (ils
// ont quitté l'éditeur). Surface / TVA / client restent côté config/éditeur.
//
// 100 % local : sauvegarde auto via repository (localStorage). Aller-retour
// éditeur ↔ finalisation sans perte (chaque page recharge depuis le storage).
// Charte INTERFACE artisan (vert = actif, Figtree + Space Grotesk tnum).
//
// Étape 1 : l'acompte reste un % unique (déplacé). L'échéancier multi-acomptes
// arrive à l'étape 2.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import { calcEngineTotaux } from "@/lib/devis/engine/totals";
import { calcClientTotaux } from "@/lib/devis/engine/agregation";
import { formatEuro } from "@/lib/devis/format";
import { STATUT_LABEL } from "@/lib/devis/devis-status";
import { resoudreEcheancier } from "@/lib/devis/echeancier";
import ApercuDocument from "./ApercuDocument";
import type {
  Chantier,
  Devis,
  DevisInput,
  DevisStatut,
  Echeance,
  EcheanceMode,
  EcheanceMoment,
  Entreprise,
  RemiseMode,
} from "@/lib/devis/types";
import "./devis-finalisation.css";

const MOMENT_LABEL: Record<EcheanceMoment, string> = {
  commande: "à la commande",
  encours: "en cours de chantier",
  reception: "à la réception",
};

function uid(): string {
  return `ech-${Math.random().toString(36).slice(2, 9)}`;
}

interface Props {
  devisId: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "dirty";

function toInput(d: Devis): DevisInput {
  return {
    clientId: d.clientId,
    clientSnapshot: d.clientSnapshot,
    titre: d.titre,
    statut: d.statut,
    dateCreation: d.dateCreation,
    dateValidite: d.dateValidite,
    dateDebutPrevue: d.dateDebutPrevue,
    dateFinPrevue: d.dateFinPrevue,
    chantierId: d.chantierId,
    globalSurf: d.globalSurf,
    tvaParDefaut: d.tvaParDefaut,
    engine: d.engine,
    lots: d.lots,
    acomptePct: d.acomptePct,
    echeancier: d.echeancier,
    lettreIntro: d.lettreIntro,
    notesInternes: d.notesInternes,
    detailMatPose: d.detailMatPose,
    remiseMode: d.remiseMode,
    remiseValeur: d.remiseValeur,
  };
}

export default function DevisFinalisation({ devisId }: Props) {
  const [draft, setDraft] = useState<DevisInput | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [statut, setStatut] = useState<DevisStatut>("brouillon");
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const draftRef = useRef<DevisInput | null>(null);
  draftRef.current = draft;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chargement (recharge depuis le storage → toujours la dernière version
  // sauvegardée par l'éditeur : aller-retour sans perte).
  useEffect(() => {
    let alive = true;
    (async () => {
      const [d, ent, ch] = await Promise.all([
        repository.devis.get(devisId),
        repository.entreprise.get(),
        repository.chantiers.ofDevis(devisId),
      ]);
      if (!alive) return;
      if (d) {
        setDraft(toInput(d));
        setNumero(d.numero);
        setStatut(d.statut);
      }
      setEntreprise(ent);
      setChantier(ch);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [devisId]);

  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  function scheduleSave() {
    setStatus("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const d = draftRef.current;
      if (!d) return;
      setStatus("saving");
      try {
        const updated = await repository.devis.update(devisId, d);
        setNumero(updated.numero);
        setStatut(updated.statut);
        setStatus("saved");
        setSavedAt(Date.now());
      } catch (e) {
        console.error("[finalisation] save failed", e);
        setStatus("dirty");
      }
    }, 700);
  }

  function patch(p: Partial<DevisInput>) {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
    scheduleSave();
  }

  // ── Échéancier : mutations locales (sauvegarde auto via patch) ──────────
  function patchEcheancier(next: Echeance[]) {
    patch({ echeancier: next });
  }
  function addEcheance() {
    const cur = draft?.echeancier ?? [];
    const ligne: Echeance = {
      id: uid(),
      libelle: "Acompte intermédiaire",
      moment: "encours",
      mode: "pourcent",
      valeur: 0,
    };
    // Insère avant la ligne solde si elle existe (le solde reste en dernier).
    const idxSolde = cur.findIndex((e) => e.mode === "solde");
    const next =
      idxSolde === -1
        ? [...cur, ligne]
        : [...cur.slice(0, idxSolde), ligne, ...cur.slice(idxSolde)];
    patchEcheancier(next);
  }
  function updateEcheance(id: string, p: Partial<Echeance>) {
    const cur = draft?.echeancier ?? [];
    patchEcheancier(cur.map((e) => (e.id === id ? { ...e, ...p } : e)));
  }
  function removeEcheance(id: string) {
    const cur = draft?.echeancier ?? [];
    patchEcheancier(cur.filter((e) => e.id !== id));
  }
  function setEcheanceMode(id: string, mode: EcheanceMode) {
    const cur = draft?.echeancier ?? [];
    // Garde-fou : une seule ligne solde. (Le bouton est déjà désactivé, mais
    // on protège la mutation au cas où.)
    if (mode === "solde" && cur.some((e) => e.mode === "solde" && e.id !== id)) {
      return;
    }
    updateEcheance(id, { mode });
  }

  // Totaux client (TTC) pour l'aperçu acompte/solde — l'échéancier RÉPARTIT le
  // TTC, il ne le recalcule pas. Recalcul si la remise change.
  const totaux = useMemo(() => {
    if (!draft?.engine) return null;
    const t = calcEngineTotaux(
      {
        ...draft.engine,
        globalSurf: draft.globalSurf ?? 0,
        tvaParDefaut: draft.tvaParDefaut ?? 10,
        remiseMode: draft.remiseMode,
        remiseValeur: draft.remiseValeur,
      },
      entreprise?.tauxHoraire ?? 0,
      draft.regimeTVA ?? "tva"
    );
    return calcClientTotaux(
      {
        ...draft.engine,
        globalSurf: draft.globalSurf ?? 0,
        tvaParDefaut: draft.tvaParDefaut ?? 10,
        remiseMode: draft.remiseMode,
        remiseValeur: draft.remiseValeur,
      },
      t
    );
  }, [
    draft?.engine,
    draft?.globalSurf,
    draft?.tvaParDefaut,
    draft?.remiseMode,
    draft?.remiseValeur,
    draft?.regimeTVA,
    entreprise,
  ]);

  // Devis synthétique pour l'APERÇU LIVE : reconstruit à chaque frappe depuis
  // le draft courant (+ numéro/statut connus). ApercuDocument recalcule ses
  // propres totaux client depuis `engine` → l'aperçu reflète l'état courant
  // sans attendre la sauvegarde. MÊME composant que la page /apercu.
  const previewDevis = useMemo<Devis | null>(() => {
    if (!draft || !draft.engine) return null;
    return {
      id: devisId,
      numero: numero ?? "",
      clientId: draft.clientId,
      clientSnapshot: draft.clientSnapshot,
      titre: draft.titre,
      statut,
      dateCreation: draft.dateCreation,
      dateValidite: draft.dateValidite,
      dateDebutPrevue: draft.dateDebutPrevue,
      dateFinPrevue: draft.dateFinPrevue,
      chantierId: draft.chantierId ?? "",
      globalSurf: draft.globalSurf ?? 0,
      tvaParDefaut: draft.tvaParDefaut ?? 10,
      // regimeTVA optionnel sur DevisInput → défaut 'tva' pour l'aperçu live
      // (raccord compilation ; le régime réel est défauté par le repository).
      regimeTVA: draft.regimeTVA ?? "tva",
      engine: draft.engine,
      lots: draft.lots,
      acomptePct: draft.acomptePct,
      echeancier: draft.echeancier ?? [],
      lettreIntro: draft.lettreIntro,
      notesInternes: draft.notesInternes,
      detailMatPose: draft.detailMatPose,
      remiseMode: draft.remiseMode,
      remiseValeur: draft.remiseValeur,
      totalHT: totaux?.totalHT ?? 0,
      totalTVA: totaux ? totaux.totalTTC - totaux.totalHT : 0,
      totalTTC: totaux?.totalTTC ?? 0,
      margeHT: 0,
      createdAt: "",
      updatedAt: "",
    };
  }, [draft, numero, statut, devisId, totaux]);

  function saveStatusText(): string {
    if (status === "saving") return "Enregistrement…";
    if (status === "dirty") return "Modifications en attente";
    if (status === "saved" && savedAt) {
      const sec = Math.floor((Date.now() - savedAt) / 1000);
      if (sec < 5) return "✓ Enregistré";
      if (sec < 60) return `✓ Modifié il y a ${sec}s`;
      return `✓ Modifié il y a ${Math.floor(sec / 60)} min`;
    }
    return "";
  }

  if (!loaded) {
    return (
      <div className="fina-shell" style={{ padding: 24 }}>
        Chargement…
      </div>
    );
  }
  if (!draft) {
    return (
      <div className="fina-shell" style={{ padding: 24 }}>
        <p>Devis introuvable.</p>
        <Link href="/chantiers">← Retour aux chantiers</Link>
      </div>
    );
  }

  const totalTTC = totaux?.totalTTC ?? 0;

  // Échéancier résolu (live) — resoudreEcheancier est la SEULE source des
  // montants. Garde-fou 100 % NON bloquant : on signale l'écart, on n'empêche
  // pas la sauvegarde.
  const echeancier = draft.echeancier ?? [];
  const resolu = resoudreEcheancier(echeancier, totalTTC);
  const aSolde = echeancier.some((e) => e.mode === "solde");
  const sommePct = resolu.reduce((a, r) => a + r.pourcentEffectif, 0);
  const sommeMontant = resolu.reduce((a, r) => a + r.montantTTC, 0);
  const echeanceNegative = resolu.some((r) => r.montantTTC < -0.005);
  const ecart100 = Math.abs(sommePct - 100) > 0.5;
  const echeancierAlerte = ecart100 || echeanceNegative;

  return (
    <div className="fina-shell">
      <header className="fina-topbar">
        <Link
          href={`/chantier/devis/${devisId}/editer`}
          className="fina-back"
        >
          <i className="ti ti-chevron-left" aria-hidden="true" /> Modifier le
          devis
        </Link>
        <span className="fina-title">
          Finalisation
          <span className="fina-num">{numero ?? "—"}</span>
        </span>
        <span className="fina-statut">{STATUT_LABEL[statut] || statut}</span>
        <span
          className={`fina-save${status === "dirty" ? " is-dirty" : ""}${
            status === "saved" ? " is-saved" : ""
          }`}
        >
          {saveStatusText()}
        </span>
        <div className="fina-actions">
          <Link
            href={`/chantier/devis/${devisId}/apercu`}
            className="fina-btn fina-btn-primary"
            target="_blank"
          >
            <i className="ti ti-file-type-pdf" aria-hidden="true" /> Exporter en
            PDF
          </Link>
          <button
            type="button"
            className="fina-btn"
            disabled
            title="Bientôt disponible — envoi natif avec le backend"
          >
            <i className="ti ti-mail" aria-hidden="true" /> Envoyer par email
          </button>
        </div>
      </header>

      <main className="fina-main">
        <div className="fina-cols">
          {/* ── COLONNE PRINCIPALE : réglages ─────────────────────── */}
          <div className="fina-col">
            <section className="fina-card">
              <h2 className="fina-card-t">Le devis</h2>
              <div className="fina-grid">
                <div className="fina-field">
                  <label className="fina-label">Numéro</label>
                  <div className="fina-readonly num">{numero ?? "—"}</div>
                </div>
                <div className="fina-field col-full">
                  <label className="fina-label">Objet du devis</label>
                  <input
                    className="fina-input"
                    value={draft.titre}
                    onChange={(e) => patch({ titre: e.target.value })}
                    placeholder="Ex. Rénovation appartement — 45 m²"
                  />
                </div>
                <div className="fina-field">
                  <label className="fina-label">Date de création</label>
                  <input
                    className="fina-input num"
                    type="date"
                    value={draft.dateCreation}
                    onChange={(e) => patch({ dateCreation: e.target.value })}
                  />
                </div>
                <div className="fina-field">
                  <label className="fina-label">Date de validité</label>
                  <input
                    className="fina-input num"
                    type="date"
                    value={draft.dateValidite ?? ""}
                    onChange={(e) =>
                      patch({ dateValidite: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="fina-card">
              <h2 className="fina-card-t">Délai prévisionnel des travaux</h2>
              <div className="fina-grid">
                <div className="fina-field">
                  <label className="fina-label">Début</label>
                  <input
                    className="fina-input num"
                    type="date"
                    value={draft.dateDebutPrevue ?? ""}
                    onChange={(e) =>
                      patch({ dateDebutPrevue: e.target.value || null })
                    }
                  />
                </div>
                <div className="fina-field">
                  <label className="fina-label">Fin</label>
                  <input
                    className="fina-input num"
                    type="date"
                    value={draft.dateFinPrevue ?? ""}
                    onChange={(e) =>
                      patch({ dateFinPrevue: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="fina-card">
              <h2 className="fina-card-t">Message d&apos;introduction</h2>
              <p className="fina-hint">
                Affiché en haut du devis client, avant le détail des prestations.
              </p>
              <textarea
                className="fina-textarea"
                value={draft.lettreIntro}
                onChange={(e) => patch({ lettreIntro: e.target.value })}
                placeholder="Madame, Monsieur,&#10;Suite à notre rencontre…"
              />
            </section>

            <section className="fina-card">
              <h2 className="fina-card-t">Remise commerciale</h2>
              <div className="fina-grid">
                <div className="fina-field">
                  <label className="fina-label">Remise sur le total HT</label>
                  <div className="fina-row">
                    <select
                      className="fina-select"
                      style={{ flex: "0 0 96px" }}
                      value={draft.remiseMode}
                      onChange={(e) =>
                        patch({ remiseMode: e.target.value as RemiseMode })
                      }
                    >
                      <option value="aucune">Aucune</option>
                      <option value="pourcent">%</option>
                      <option value="euros">€</option>
                    </select>
                    {draft.remiseMode !== "aucune" && (
                      <input
                        className="fina-input num"
                        type="number"
                        min={0}
                        step={0.5}
                        value={draft.remiseValeur || ""}
                        onChange={(e) =>
                          patch({ remiseValeur: Number(e.target.value) || 0 })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="fina-card">
              <h2 className="fina-card-t">Échéancier de paiement</h2>
              <p className="fina-hint">
                Répartit le total TTC en plusieurs échéances. La ligne «&nbsp;solde&nbsp;»
                s&apos;ajuste automatiquement au reste.
              </p>

              <div className="fina-ech">
                {echeancier.map((e) => {
                  const r = resolu.find((x) => x.id === e.id);
                  const soldeIndispo = aSolde && e.mode !== "solde";
                  return (
                    <div className="fina-ech-row" key={e.id}>
                      <input
                        className="fina-input fina-ech-lib"
                        value={e.libelle}
                        onChange={(ev) =>
                          updateEcheance(e.id, { libelle: ev.target.value })
                        }
                        placeholder="Libellé de l'échéance"
                      />
                      <select
                        className="fina-select"
                        value={e.moment}
                        onChange={(ev) =>
                          updateEcheance(e.id, {
                            moment: ev.target.value as EcheanceMoment,
                          })
                        }
                      >
                        <option value="commande">{MOMENT_LABEL.commande}</option>
                        <option value="encours">{MOMENT_LABEL.encours}</option>
                        <option value="reception">
                          {MOMENT_LABEL.reception}
                        </option>
                      </select>
                      <select
                        className="fina-select"
                        value={e.mode}
                        onChange={(ev) =>
                          setEcheanceMode(e.id, ev.target.value as EcheanceMode)
                        }
                      >
                        <option value="pourcent">%</option>
                        <option value="montant">€ fixe</option>
                        <option value="solde" disabled={soldeIndispo}>
                          Solde
                        </option>
                      </select>
                      {e.mode === "solde" ? (
                        <span className="fina-ech-auto">au reste</span>
                      ) : (
                        <div className="fina-suffix fina-ech-val">
                          <input
                            className="fina-input num"
                            type="number"
                            min={0}
                            step={e.mode === "pourcent" ? 1 : 10}
                            value={e.valeur || ""}
                            onChange={(ev) =>
                              updateEcheance(e.id, {
                                valeur: Number(ev.target.value) || 0,
                              })
                            }
                          />
                          <span className="fina-suffix-u">
                            {e.mode === "pourcent" ? "%" : "€"}
                          </span>
                        </div>
                      )}
                      <span className="fina-ech-montant num">
                        {formatEuro(r?.montantTTC ?? 0)}
                      </span>
                      <button
                        type="button"
                        className="fina-ech-del"
                        onClick={() => removeEcheance(e.id)}
                        title="Retirer cette échéance"
                        aria-label="Retirer cette échéance"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}

                {echeancier.length === 0 && (
                  <p className="fina-muted fina-ech-empty">
                    Aucune échéance — ajoutez-en une.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="fina-btn fina-ech-add"
                onClick={addEcheance}
              >
                <i className="ti ti-plus" aria-hidden="true" /> Ajouter une
                échéance
              </button>

              <div
                className={`fina-ech-recap${
                  echeancierAlerte ? " is-warn" : ""
                }`}
              >
                <div className="fina-ech-recap-line">
                  <span>Total des échéances</span>
                  <strong className="num">
                    {formatEuro(sommeMontant)} TTC
                    <span className="fina-ech-recap-pct">
                      {" "}
                      ({sommePct.toFixed(0)} %)
                    </span>
                  </strong>
                </div>
                <div className="fina-ech-recap-line fina-ech-recap-sub">
                  <span>Total du devis</span>
                  <span className="num">{formatEuro(totalTTC)} TTC</span>
                </div>
                {echeancierAlerte && (
                  <p className="fina-ech-warn">
                    <i className="ti ti-alert-triangle" aria-hidden="true" />
                    {echeanceNegative
                      ? "Une échéance est négative — les autres dépassent le total."
                      : `Les échéances couvrent ${sommePct.toFixed(
                          0
                        )} % du total (≠ 100 %).`}{" "}
                    Vous pouvez tout de même enregistrer.
                  </p>
                )}
              </div>
            </section>

            <section className="fina-card">
              <h2 className="fina-card-t">
                Notes internes
                <span className="fina-private">
                  <i className="ti ti-lock" aria-hidden="true" /> note interne —
                  n&apos;apparaît pas sur le devis
                </span>
              </h2>
              <textarea
                className="fina-textarea"
                value={draft.notesInternes}
                onChange={(e) => patch({ notesInternes: e.target.value })}
                placeholder="Pour vous : relancer sous 8 jours, négocier la cuisine…"
              />
            </section>
          </div>

          {/* ── COLONNE APERÇU : le MÊME document A4 que /apercu, en live ── */}
          <aside className="fina-apercu-col">
            <div className="fina-apercu-bar">
              <span className="fina-apercu-bar-t">Aperçu du devis</span>
              <span className="fina-apercu-bar-note">
                Mise à jour en direct · document client
              </span>
            </div>
            <div className="fina-apercu-scroll">
              {previewDevis ? (
                <div className="fina-apercu-zoom">
                  <ApercuDocument
                    devis={previewDevis}
                    entreprise={entreprise}
                    chantier={chantier}
                  />
                </div>
              ) : (
                <div className="fina-apercu-empty">
                  Aperçu indisponible — chiffrage vide.
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
