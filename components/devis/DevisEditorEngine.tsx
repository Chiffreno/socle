"use client";

// ============================================================
// SOCLE — DevisEditorEngine (P3)
//
// Shell 3 colonnes autour du moteur engine (P1+P2). Aucun configurateur
// détaillé par lot (ça vient en P4) : ici on rend :
//   - Colonne gauche : 15 lots cliquables (clic = active+sélectionne).
//   - Colonne centre : réglages communs du lot courant (surface/marge/MO/
//     coutRevientPoints/TVA/gamme) + placeholder P4 + <details> debug
//     listant les lignes auto-générées par calcItems.
//   - Colonne droite : récap temps réel via calcEngineTotaux (client +
//     interne artisan). 1ʳᵉ alerte tauxHoraireManquant câblée ici.
// Bandeau entête repliable au-dessus, topbar fine sticky.
// Sauvegarde auto + création différée comme C1 (hérité du workflow).
// ============================================================

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import { calcEngineTotaux } from "@/lib/devis/engine/totals";
import { calcItems } from "@/lib/devis/engine/calc-items";
import {
  LM,
  LOTS_AVEC_GAMME,
  LOTS_NO_SURF,
  createInitialEngineState,
} from "@/lib/devis/engine/lots";
import type {
  EngineState,
  LotId,
  LotState,
  Qualite,
} from "@/lib/devis/engine/types";
import { formatEuro } from "@/lib/devis/format";
import { STATUT_LABEL } from "@/lib/devis/devis-status";
import { TAUX_TVA } from "@/lib/devis/types";
import type {
  Client,
  ClientInput,
  ClientSnapshot,
  ClientType,
  Devis,
  DevisInput,
  DevisStatut,
  Entreprise,
  RemiseMode,
  TauxTVA,
} from "@/lib/devis/types";
import "./devis-editor-engine.css";

// Lots à points (où coutRevientPoints fait sens — démolition 100% prix
// ferme + élec hybride avec catalogue de 31 prestations).
const LOTS_AVEC_POINTS = new Set<LotId>(["demolition", "elec"]);

type SaveStatus = "idle" | "saving" | "saved" | "dirty";

interface Props {
  devisId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const isoPlusDays = (baseISO: string, n: number) => {
  const d = new Date(baseISO);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function emptyClientForm(): ClientInput {
  return {
    type: "particulier",
    nom: "",
    prenom: "",
    contact: "",
    email: "",
    telephone: "",
    adresse: "",
    codePostal: "",
    ville: "",
    siren: "",
    notes: "",
  };
}
function snapshotFromClient(c: Client): ClientSnapshot {
  return {
    type: c.type,
    nom: c.nom,
    prenom: c.prenom,
    contact: c.contact,
    email: c.email,
    telephone: c.telephone,
    adresse: c.adresse,
    codePostal: c.codePostal,
    ville: c.ville,
    siren: c.siren,
  };
}
function clientLabel(c: Client): string {
  return (
    [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom || "(client)"
  );
}
function hasRealContent(d: DevisInput): boolean {
  if (d.titre.trim() !== "") return true;
  if (d.clientId !== null) return true;
  if (d.engine && Object.values(d.engine.lots).some((l) => l.on)) return true;
  return false;
}

function getDefaultDraft(): DevisInput {
  const today = todayISO();
  return {
    clientId: null,
    clientSnapshot: null,
    titre: "",
    statut: "brouillon",
    dateCreation: today,
    dateValidite: isoPlusDays(today, 30),
    chantierAdresse: "",
    chantierCodePostal: "",
    chantierVille: "",
    globalSurf: 0,
    tvaParDefaut: 10,
    engine: createInitialEngineState({
      globalSurf: 0,
      tvaParDefaut: 10,
      remiseMode: "aucune",
      remiseValeur: 0,
    }),
    lots: [],
    acomptePct: 30,
    lettreIntro: "",
    notesInternes: "",
    detailMatPose: false,
    remiseMode: "aucune",
    remiseValeur: 0,
  };
}

function toInput(d: Devis): DevisInput {
  return {
    clientId: d.clientId,
    clientSnapshot: d.clientSnapshot,
    titre: d.titre,
    statut: d.statut,
    dateCreation: d.dateCreation,
    dateValidite: d.dateValidite,
    chantierAdresse: d.chantierAdresse,
    chantierCodePostal: d.chantierCodePostal,
    chantierVille: d.chantierVille,
    globalSurf: d.globalSurf,
    tvaParDefaut: d.tvaParDefaut,
    engine: d.engine,
    lots: d.lots,
    acomptePct: d.acomptePct,
    lettreIntro: d.lettreIntro,
    notesInternes: d.notesInternes,
    detailMatPose: d.detailMatPose,
    remiseMode: d.remiseMode,
    remiseValeur: d.remiseValeur,
  };
}

// ─── Composant ────────────────────────────────────────────────────────
export default function DevisEditorEngine({ devisId }: Props) {
  const [draft, setDraft] = useState<DevisInput>(getDefaultDraft);
  const [id, setId] = useState<string | null>(devisId ?? null);
  const [numero, setNumero] = useState<string | null>(null);
  const [statut, setStatut] = useState<DevisStatut>("brouillon");
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cur, setCur] = useState<LotId>("demolition");
  const [enteteOpen, setEnteteOpen] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientModal, setClientModal] = useState(false);
  const [clientForm, setClientForm] = useState<ClientInput>(emptyClientForm());

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const idRef = useRef(id);
  idRef.current = id;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ent, cl] = await Promise.all([
          repository.entreprise.get(),
          repository.clients.list(),
        ]);
        if (!alive) return;
        setEntreprise(ent);
        setClients(cl);
        if (devisId) {
          const d = await repository.devis.get(devisId);
          if (alive && d) {
            setDraft(toInput(d));
            setId(d.id);
            setNumero(d.numero);
            setStatut(d.statut);
            const firstActive = (Object.keys(d.engine.lots) as LotId[]).find(
              (k) => d.engine.lots[k].on
            );
            if (firstActive) setCur(firstActive);
          }
        }
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [devisId]);

  // Refresh "Modifié il y a Xs" toutes les secondes.
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Auto-clear toast
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  // ── Sauvegarde auto + création différée ─────────────────────────
  function scheduleSave() {
    setStatus("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const d = draftRef.current;
      setStatus("saving");
      try {
        if (!idRef.current) {
          if (!hasRealContent(d)) {
            setStatus("idle");
            return;
          }
          const created = await repository.devis.create(d);
          setId(created.id);
          setNumero(created.numero);
          setStatut(created.statut);
          if (typeof window !== "undefined") {
            window.history.replaceState(
              null,
              "",
              `/chantier/devis/${created.id}/editer`
            );
          }
        } else {
          const updated = await repository.devis.update(idRef.current, d);
          setNumero(updated.numero);
          setStatut(updated.statut);
        }
        setStatus("saved");
        setSavedAt(Date.now());
      } catch (e) {
        console.error("[devis] save failed", e);
        setStatus("dirty");
      }
    }, 800);
  }

  function patchDraft(patch: Partial<DevisInput>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    scheduleSave();
  }

  function patchLot(lid: LotId, patch: Partial<LotState>) {
    setDraft((prev) => {
      const base: EngineState =
        prev.engine ??
        createInitialEngineState({
          globalSurf: prev.globalSurf,
          tvaParDefaut: prev.tvaParDefaut,
          remiseMode: prev.remiseMode,
          remiseValeur: prev.remiseValeur,
        });
      return {
        ...prev,
        engine: {
          ...base,
          lots: { ...base.lots, [lid]: { ...base.lots[lid], ...patch } },
        },
      };
    });
    scheduleSave();
  }

  // Option B : 2 zones de clic distinctes sur chaque lot.
  function onLotCheck(lid: LotId, checked: boolean) {
    patchLot(lid, { on: checked });
    // Cocher → sélectionne aussi. Décocher → reste sur le lot (vide).
    if (checked) setCur(lid);
  }

  // ── Totaux temps réel (engine + tauxHoraire) ────────────────────
  // `?? defaults` : ces 3 champs sont marqués optionnels sur DevisInput
  // pour compat C1 (P2 — supprimé en P3/Temps 2). Côté UI on les ramène
  // à des valeurs neutres en lecture pour ne jamais passer undefined au
  // moteur, qui les typo comme requis.
  const totaux = useMemo(() => {
    if (!draft.engine) return null;
    return calcEngineTotaux(
      {
        ...draft.engine,
        globalSurf: draft.globalSurf ?? 0,
        tvaParDefaut: draft.tvaParDefaut ?? 10,
        remiseMode: draft.remiseMode,
        remiseValeur: draft.remiseValeur,
      },
      entreprise?.tauxHoraire ?? 0
    );
  }, [
    draft.engine,
    draft.globalSurf,
    draft.tvaParDefaut,
    draft.remiseMode,
    draft.remiseValeur,
    entreprise,
  ]);

  // Items du lot courant (pour la table debug)
  const curItems = useMemo(() => {
    if (!draft.engine) return [];
    return calcItems(
      {
        ...draft.engine,
        globalSurf: draft.globalSurf ?? 0,
        tvaParDefaut: draft.tvaParDefaut ?? 10,
        remiseMode: draft.remiseMode,
        remiseValeur: draft.remiseValeur,
      },
      cur
    );
  }, [
    draft.engine,
    draft.globalSurf,
    draft.tvaParDefaut,
    draft.remiseMode,
    draft.remiseValeur,
    cur,
  ]);

  function saveStatusText(): string {
    if (status === "saving") return "Enregistrement…";
    if (status === "dirty") return "Modifications en attente";
    if (status === "saved" && savedAt) {
      const sec = Math.floor((Date.now() - savedAt) / 1000);
      if (sec < 5) return "✓ Enregistré";
      if (sec < 60) return `✓ Modifié il y a ${sec}s`;
      const m = Math.floor(sec / 60);
      return `✓ Modifié il y a ${m} min`;
    }
    return "";
  }

  // ── Client ─────────────────────────────────────────────────────
  async function saveNewClient() {
    if (!clientForm.nom.trim()) {
      setNotice("Le nom du client est requis");
      return;
    }
    const c = await repository.clients.create(clientForm);
    setClients((prev) => [...prev, c]);
    patchDraft({ clientId: c.id, clientSnapshot: snapshotFromClient(c) });
    setClientModal(false);
    setClientForm(emptyClientForm());
    setNotice("Client créé");
  }
  function selectClient(clientId: string) {
    if (!clientId) {
      patchDraft({ clientId: null, clientSnapshot: null });
      return;
    }
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    patchDraft({ clientId: c.id, clientSnapshot: snapshotFromClient(c) });
  }

  // ─────────────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="dee-shell" style={{ padding: 24 }}>
        Chargement…
      </div>
    );
  }

  const curLot = draft.engine?.lots?.[cur];
  const lotMeta = LM.find((l) => l.id === cur)!;

  return (
    <div className="dee-shell">
      {totaux?.tauxHoraireManquant && (
        <div className="dee-banner">
          <i className="ti ti-alert-triangle" />
          Taux horaire non configuré — la main d&apos;œuvre n&apos;est pas
          valorisée dans le calcul de marge.
          <Link href="/construction/parametres">Configurer →</Link>
        </div>
      )}

      <header className="dee-topbar">
        <Link href="/chantier/devis" className="dee-topbar-back">
          <i className="ti ti-chevron-left" /> Devis
        </Link>
        <span className="dee-topbar-num">{numero ?? "—"}</span>
        <input
          className="dee-topbar-titre"
          value={draft.titre}
          onChange={(e) => patchDraft({ titre: e.target.value })}
          placeholder="Titre du devis"
        />
        <span className="dee-topbar-statut">
          {STATUT_LABEL[statut] || statut}
        </span>
        <span
          className={`dee-topbar-save${
            status === "dirty" ? " is-dirty" : ""
          }${status === "saved" ? " is-saved" : ""}`}
        >
          {saveStatusText()}
        </span>
        <div className="dee-topbar-actions">
          {id ? (
            <Link
              href={`/chantier/devis/${id}/apercu`}
              className="dee-btn"
              target="_blank"
            >
              Voir l&apos;aperçu
            </Link>
          ) : (
            <button className="dee-btn" disabled title="Sauvegarde en cours…">
              Voir l&apos;aperçu
            </button>
          )}
          <button
            className="dee-btn dee-btn-primary"
            disabled
            title="PDF — disponible en P5"
          >
            PDF
          </button>
        </div>
      </header>

      <details
        className="dee-entete"
        open={enteteOpen}
        onToggle={(e) =>
          setEnteteOpen((e.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary>En-tête du devis</summary>
        <div className="dee-entete-body">
          <div className="dee-field col-2">
            <label className="dee-field-label">Client</label>
            <div className="dee-input-row">
              <select
                className="dee-select"
                value={draft.clientId ?? ""}
                onChange={(e) => selectClient(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="dee-btn"
                onClick={() => setClientModal(true)}
              >
                + Nouveau
              </button>
            </div>
          </div>
          <div className="dee-field">
            <label className="dee-field-label">Date création</label>
            <input
              className="dee-input"
              type="date"
              value={draft.dateCreation}
              onChange={(e) => patchDraft({ dateCreation: e.target.value })}
            />
          </div>
          <div className="dee-field">
            <label className="dee-field-label">Date validité</label>
            <input
              className="dee-input"
              type="date"
              value={draft.dateValidite ?? ""}
              onChange={(e) =>
                patchDraft({ dateValidite: e.target.value || null })
              }
            />
          </div>
          <div className="dee-field col-2">
            <label className="dee-field-label">Chantier — adresse</label>
            <input
              className="dee-input"
              value={draft.chantierAdresse}
              onChange={(e) =>
                patchDraft({ chantierAdresse: e.target.value })
              }
            />
          </div>
          <div className="dee-field">
            <label className="dee-field-label">Code postal</label>
            <input
              className="dee-input"
              value={draft.chantierCodePostal}
              onChange={(e) =>
                patchDraft({ chantierCodePostal: e.target.value })
              }
            />
          </div>
          <div className="dee-field">
            <label className="dee-field-label">Ville</label>
            <input
              className="dee-input"
              value={draft.chantierVille}
              onChange={(e) => patchDraft({ chantierVille: e.target.value })}
            />
          </div>

          <div className="dee-field">
            <label className="dee-field-label">Surface globale (m²)</label>
            <input
              className="dee-input"
              type="number"
              min={0}
              step={0.5}
              value={draft.globalSurf || ""}
              onChange={(e) =>
                patchDraft({ globalSurf: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="dee-field">
            <label className="dee-field-label">TVA par défaut</label>
            <select
              className="dee-select"
              value={draft.tvaParDefaut}
              onChange={(e) =>
                patchDraft({ tvaParDefaut: Number(e.target.value) as TauxTVA })
              }
            >
              {TAUX_TVA.map((t) => (
                <option key={t} value={t}>
                  {t} %
                </option>
              ))}
            </select>
          </div>
          <div className="dee-field">
            <label className="dee-field-label">Remise</label>
            <div className="dee-input-row">
              <select
                className="dee-select"
                style={{ flex: "0 0 110px" }}
                value={draft.remiseMode}
                onChange={(e) =>
                  patchDraft({ remiseMode: e.target.value as RemiseMode })
                }
              >
                <option value="aucune">Aucune</option>
                <option value="pourcent">%</option>
                <option value="euros">€</option>
              </select>
              {draft.remiseMode !== "aucune" && (
                <input
                  className="dee-input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={draft.remiseValeur || ""}
                  onChange={(e) =>
                    patchDraft({
                      remiseValeur: Number(e.target.value) || 0,
                    })
                  }
                />
              )}
            </div>
          </div>
          <div className="dee-field">
            <label className="dee-field-label">Acompte (%)</label>
            <input
              className="dee-input"
              type="number"
              min={0}
              max={100}
              step={1}
              value={draft.acomptePct}
              onChange={(e) =>
                patchDraft({ acomptePct: Number(e.target.value) || 0 })
              }
            />
          </div>

          <div className="dee-field col-full">
            <label className="dee-field-label">
              Lettre d&apos;introduction (affichée sur le devis client)
            </label>
            <textarea
              className="dee-textarea"
              value={draft.lettreIntro}
              onChange={(e) => patchDraft({ lettreIntro: e.target.value })}
              placeholder="Madame, Monsieur,&#10;Suite à notre rencontre…"
            />
          </div>
          <div className="dee-field col-full">
            <label className="dee-field-label">
              Notes internes (privé — jamais affichées au client)
            </label>
            <textarea
              className="dee-textarea"
              value={draft.notesInternes}
              onChange={(e) => patchDraft({ notesInternes: e.target.value })}
              placeholder="Notes pour vous : devis envoyé après visite, négocier la cuisine…"
            />
          </div>
        </div>
      </details>

      <main className="dee-cols">
        {/* ── COLONNE GAUCHE : 15 lots (Option B : check + nom) ──── */}
        <aside className="dee-cols-left">
          <div className="dee-cols-left-title">Lots du devis</div>
          <ul className="dee-lot-list">
            {LM.map((meta) => {
              const lt = totaux?.parLot.find((l) => l.lotId === meta.id);
              const isOn = lt?.active ?? false;
              const isCurrent = cur === meta.id;
              // Vert "récompense" : sous-total affiché UNIQUEMENT quand
              // caLot > 0. Un lot coché mais vide reste neutre.
              const hasMontant = isOn && !!lt && lt.caLot > 0;
              return (
                <li key={meta.id}>
                  <div
                    className={`dee-lot-row${isOn ? " is-on" : ""}${
                      isCurrent ? " is-current" : ""
                    }`}
                  >
                    <label
                      className="dee-lot-check"
                      aria-label={`Inclure ${meta.label} dans le devis`}
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={(e) => onLotCheck(meta.id, e.target.checked)}
                      />
                      <span className="dee-lot-check-box" aria-hidden="true" />
                    </label>
                    <button
                      type="button"
                      className="dee-lot-name"
                      onClick={() => setCur(meta.id)}
                    >
                      <span className="dee-lot-label">{meta.label}</span>
                      {meta.sub && (
                        <span className="dee-lot-sub">{meta.sub}</span>
                      )}
                    </button>
                    {hasMontant && lt && (
                      <span className="dee-lot-total">
                        {formatEuro(lt.caLot)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="dee-lot-foot">
            <div className="dee-lot-foot-label">Total devis TTC</div>
            <div className="dee-lot-foot-amount">
              {formatEuro(totaux?.totalTTC ?? 0)}
            </div>
          </div>
        </aside>

        {/* ── COLONNE CENTRE : header inline compact + lignes du devis ── */}
        <section className="dee-cols-center">
          <div className="dee-config-head-inline">
            <h2 className="dee-config-name">{lotMeta.label}</h2>

            {curLot?.on && (
              <>
                <div className="dee-config-controls">
                  {!LOTS_NO_SURF.has(cur) && (
                    <span className="dee-inline-field">
                      surface
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={curLot.surf ?? ""}
                        placeholder={String(draft.globalSurf || 0)}
                        onChange={(e) =>
                          patchLot(cur, {
                            surf:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
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
                      value={curLot.m}
                      onChange={(e) =>
                        patchLot(cur, { m: Number(e.target.value) || 0 })
                      }
                    />
                    <span className="dee-inline-unit">%</span>
                  </span>
                  <span className="dee-inline-field">
                    MO
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={curLot.tempsMoHeures || ""}
                      onChange={(e) =>
                        patchLot(cur, {
                          tempsMoHeures: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <span className="dee-inline-unit">h</span>
                  </span>
                  {LOTS_AVEC_POINTS.has(cur) && (
                    <span className="dee-inline-field">
                      revient pts
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={curLot.coutRevientPoints ?? ""}
                        placeholder="—"
                        onChange={(e) =>
                          patchLot(cur, {
                            coutRevientPoints:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                      <span className="dee-inline-unit">€</span>
                    </span>
                  )}
                </div>
                {LOTS_AVEC_GAMME.has(cur) && (
                  <div className="dee-quality-inline">
                    <span className="dee-quality-inline-label">Gamme</span>
                    {(["std", "mid", "prm"] as Qualite[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`dee-quality-pill${
                          curLot.q === q ? " is-active" : ""
                        }`}
                        onClick={() => patchLot(cur, { q })}
                      >
                        {q === "std"
                          ? "Éco"
                          : q === "mid"
                            ? "Standard"
                            : "Premium"}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {curLot?.on ? (
            <section className="dee-engine-items">
              <div className="dee-engine-items-head">
                <span>Lignes du devis pour ce lot</span>
                <span className="dee-engine-items-head-count">
                  {curItems.length} ligne{curItems.length > 1 ? "s" : ""}
                </span>
              </div>
              {curItems.length === 0 ? (
                <div className="dee-engine-items-empty">
                  Aucune ligne pour l&apos;instant — le configurateur détaillé
                  du lot arrive en P4.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "55%" }}>Libellé</th>
                      <th>Quantité</th>
                      <th>P.U.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curItems.map((it, i) => (
                      <tr key={i}>
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
              )}
            </section>
          ) : (
            <div className="dee-empty">
              <strong>Lot non inclus dans le devis.</strong>
              <br />
              Cochez la case dans la colonne gauche pour l&apos;inclure.
            </div>
          )}
        </section>

        {/* ── COLONNE DROITE : récap temps réel ──────────────── */}
        <aside className="dee-cols-right">
          <h3 className="dee-recap-title">Récap client</h3>
          {totaux && (
            <>
              <dl className="dee-recap-list">
                <dt>Sous-total HT</dt>
                <dd>{formatEuro(totaux.subTotalHT)}</dd>
                {totaux.remiseHT > 0 && (
                  <>
                    <dt>Remise</dt>
                    <dd>−{formatEuro(totaux.remiseHT)}</dd>
                  </>
                )}
                <dt className="strong">Total HT</dt>
                <dd className="strong">{formatEuro(totaux.totalHT)}</dd>
                {Object.entries(totaux.ventilationTVA)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([taux, m]) => (
                    <Fragment key={taux}>
                      <dt>TVA {taux} %</dt>
                      <dd>{formatEuro(m)}</dd>
                    </Fragment>
                  ))}
                <dt className="big strong">Total TTC</dt>
                <dd className="green-big">{formatEuro(totaux.totalTTC)}</dd>
              </dl>

              <hr className="dee-recap-divider" />
              <h3 className="dee-recap-title">Récap interne (artisan)</h3>

              {totaux.tauxHoraireManquant && (
                <div className="dee-alert">
                  <i className="ti ti-alert-triangle" />
                  Taux horaire non configuré — la main d&apos;œuvre n&apos;est
                  pas prise en compte dans le calcul de marge.
                  <Link href="/construction/parametres">
                    Configurer mon taux horaire →
                  </Link>
                </div>
              )}

              <dl className="dee-recap-list">
                <dt>Déboursé matériaux</dt>
                <dd>{formatEuro(totaux.totalDeboursé)}</dd>
                <dt>Main d&apos;œuvre</dt>
                <dd>{formatEuro(totaux.totalMO)}</dd>
                {!totaux.tauxHoraireManquant && (
                  <>
                    <dt>Marge sur déboursé</dt>
                    <dd className="green">
                      {formatEuro(totaux.totalMargeDeboursé)}
                    </dd>
                  </>
                )}
                {totaux.totalCAPoints > 0 && (
                  <>
                    <dt>CA points (prix ferme)</dt>
                    <dd>{formatEuro(totaux.totalCAPoints)}</dd>
                    {totaux.totalCoutRevientPointsSaisi > 0 && (
                      <>
                        <dt>Coût revient points</dt>
                        <dd>
                          {formatEuro(totaux.totalCoutRevientPointsSaisi)}
                        </dd>
                        <dt>Marge points trackée</dt>
                        <dd className="green">
                          {formatEuro(totaux.totalMargePointsTracked)}
                        </dd>
                      </>
                    )}
                  </>
                )}
                <dt className="strong">Marge globale trackée</dt>
                <dd className="green">
                  {formatEuro(totaux.margeGlobaleTracked)}
                </dd>
              </dl>

              {totaux.pointsLotsNonRenseignes.length > 0 && (
                <div className="dee-alert">
                  Coût revient non saisi sur :{" "}
                  <strong>
                    {totaux.pointsLotsNonRenseignes
                      .map((id) => LM.find((l) => l.id === id)?.label ?? id)
                      .join(", ")}
                  </strong>
                  .<br />
                  La marge interne sur ces points n&apos;est pas trackée.
                </div>
              )}
            </>
          )}
        </aside>
      </main>

      {/* ── Modale : nouveau client ───────────────────────────── */}
      {clientModal && (
        <div className="dee-modal-bg" onClick={() => setClientModal(false)}>
          <div className="dee-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Nouveau client</h3>
            <div className="dee-config-grid">
              <div className="dee-field col-full">
                <label className="dee-field-label">Type</label>
                <select
                  className="dee-select"
                  value={clientForm.type}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      type: e.target.value as ClientType,
                    })
                  }
                >
                  <option value="particulier">Particulier</option>
                  <option value="professionnel">Professionnel</option>
                </select>
              </div>
              <div className="dee-field">
                <label className="dee-field-label">
                  {clientForm.type === "professionnel"
                    ? "Raison sociale"
                    : "Nom"}
                </label>
                <input
                  className="dee-input"
                  value={clientForm.nom}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, nom: e.target.value })
                  }
                />
              </div>
              <div className="dee-field">
                <label className="dee-field-label">Prénom</label>
                <input
                  className="dee-input"
                  value={clientForm.prenom}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, prenom: e.target.value })
                  }
                />
              </div>
              <div className="dee-field col-full">
                <label className="dee-field-label">Email</label>
                <input
                  className="dee-input"
                  type="email"
                  value={clientForm.email}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, email: e.target.value })
                  }
                />
              </div>
              <div className="dee-field col-full">
                <label className="dee-field-label">Téléphone</label>
                <input
                  className="dee-input"
                  value={clientForm.telephone}
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      telephone: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="dee-modal-actions">
              <button
                type="button"
                className="dee-btn"
                onClick={() => setClientModal(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="dee-btn dee-btn-primary"
                onClick={saveNewClient}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="dee-toast" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
    </div>
  );
}
