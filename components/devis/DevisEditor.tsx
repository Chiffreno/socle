"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import {
  calcDevisTotaux,
  ligneBrutHT,
  ligneMateriauxHT,
  lignePoseHT,
  montantAcompte,
  tauxMargePct,
  ventilationTVA,
} from "@/lib/devis/calc";
import { formatDateFR, formatEuro, formatPct } from "@/lib/devis/format";
import { STATUT_LABEL } from "@/lib/devis/devis-status";
import { initSidebarCollapsedOnce } from "@/lib/use-sidebar";
import {
  TAUX_TVA,
  UNITES,
  UNITE_LABEL,
  type Client,
  type ClientInput,
  type ClientSnapshot,
  type Devis,
  type DevisInput,
  type DevisStatut,
  type Entreprise,
  type Ligne,
  type LigneNature,
  type Lot,
  type RemiseMode,
  type TauxTVA,
  type Unite,
} from "@/lib/devis/types";
import "./devis-editor.css";

const LIGNE_NATURES: { value: LigneNature; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "option", label: "Option" },
];

const uid = () => crypto.randomUUID();
const todayISO = () => new Date().toISOString().slice(0, 10);
function isoPlusDays(baseISO: string, days: number): string {
  const d = new Date(baseISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDefaultDraft(): DevisInput {
  return {
    clientId: null,
    clientSnapshot: null,
    titre: "",
    statut: "brouillon",
    dateCreation: todayISO(),
    dateValidite: null,
    chantierAdresse: "",
    chantierCodePostal: "",
    chantierVille: "",
    lots: [],
    acomptePct: 30,
    lettreIntro: "",
    notesInternes: "",
    detailMatPose: false,
    remiseMode: "aucune",
    remiseValeur: 0,
  };
}

const emptyClientForm = (): ClientInput => ({
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
});

function newLot(titre = ""): Lot {
  return { id: uid(), titre, lignes: [] };
}
function newLigne(): Ligne {
  return {
    id: uid(),
    nature: "normal",
    libelle: "",
    description: "",
    quantite: 1,
    unite: "u",
    prixMateriauxUnitaire: 0,
    prixPoseUnitaire: 0,
    tva: 10,
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
    lots: d.lots,
    acomptePct: d.acomptePct,
    lettreIntro: d.lettreIntro,
    notesInternes: d.notesInternes,
    detailMatPose: d.detailMatPose,
    remiseMode: d.remiseMode,
    remiseValeur: d.remiseValeur,
  };
}

function clientLabel(c: Client): string {
  return [c.prenom, c.nom].filter(Boolean).join(" ").trim() || c.nom || "(client)";
}
function snapshotName(s: ClientSnapshot): string {
  return [s.prenom, s.nom].filter(Boolean).join(" ").trim() || s.nom || "(client)";
}

function hasRealContent(d: DevisInput): boolean {
  return d.titre.trim() !== "" || d.clientId !== null || d.lots.length > 0;
}

type SaveStatus = "idle" | "saving" | "saved";

export default function DevisEditor({ devisId }: { devisId?: string }) {
  const [draft, setDraft] = useState<DevisInput>(getDefaultDraft);
  const [clients, setClients] = useState<Client[]>([]);
  const [numero, setNumero] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [enteteOpen, setEnteteOpen] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [clientForm, setClientForm] = useState<ClientInput>(emptyClientForm);
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null);
  const [priceModal, setPriceModal] = useState(false);
  const [priceForm, setPriceForm] = useState<{
    sens: "aug" | "dim";
    mode: "pct" | "eur";
    valeur: number;
  }>({ sens: "aug", mode: "pct", valeur: 0 });
  const [notice, setNotice] = useState<string | null>(null);

  const draftRef = useRef<DevisInput>(draft);
  const idRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  const creatingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // ── Chargement initial ──
  useEffect(() => {
    initSidebarCollapsedOnce(); // auto-repli à la 1re entrée éditeur
    let active = true;
    (async () => {
      const [list, ent] = await Promise.all([
        repository.clients.list(),
        repository.entreprise.get(),
      ]);
      if (!active) return;
      setClients(list);
      setEntreprise(ent);

      if (devisId) {
        const d = await repository.devis.get(devisId);
        if (!active) return;
        if (d) {
          idRef.current = d.id;
          setId(d.id);
          setNumero(d.numero);
          const input = toInput(d);
          draftRef.current = input;
          setDraft(input);
        }
      } else {
        const base = getDefaultDraft();
        if (ent) {
          base.acomptePct = ent.acomptePct;
          base.dateValidite = isoPlusDays(base.dateCreation, ent.validiteJours);
        }
        draftRef.current = base;
        setDraft(base);
      }
      loadedRef.current = true;
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [devisId]);

  // Rafraîchit le libellé « Modifié il y a Xs » dans la topbar.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(i);
  }, []);

  // ── Sauvegarde (auto, création différée) ──
  async function saveNow() {
    if (!loadedRef.current) return;
    const d = draftRef.current;
    if (idRef.current === null) {
      if (creatingRef.current || !hasRealContent(d)) return;
      creatingRef.current = true;
      setStatus("saving");
      try {
        const created = await repository.devis.create(d);
        idRef.current = created.id;
        setId(created.id);
        setNumero(created.numero);
        if (typeof window !== "undefined") {
          window.history.replaceState(
            null,
            "",
            `/chantier/devis/${created.id}/editer`
          );
        }
        setSavedAt(Date.now());
        setStatus("saved");
      } finally {
        creatingRef.current = false;
      }
    } else {
      setStatus("saving");
      await repository.devis.update(idRef.current, d);
      setSavedAt(Date.now());
      setStatus("saved");
    }
  }

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void saveNow(), 600);
  }

  function patchDraft(patch: Partial<DevisInput>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    scheduleSave();
  }

  // ── Lots & lignes ──
  const lots = draft.lots;
  const setLots = (next: Lot[]) => patchDraft({ lots: next });
  const addLot = () => setLots([...lots, newLot()]);
  const updateLot = (lotId: string, patch: Partial<Lot>) =>
    setLots(lots.map((l) => (l.id === lotId ? { ...l, ...patch } : l)));
  const removeLot = (lotId: string) =>
    setLots(lots.filter((l) => l.id !== lotId));
  const moveLot = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= lots.length) return;
    const cp = [...lots];
    [cp[idx], cp[j]] = [cp[j], cp[idx]];
    setLots(cp);
  };
  const addLigne = (lotId: string) =>
    setLots(
      lots.map((l) =>
        l.id === lotId ? { ...l, lignes: [...l.lignes, newLigne()] } : l
      )
    );
  const updateLigne = (lotId: string, ligneId: string, patch: Partial<Ligne>) =>
    setLots(
      lots.map((l) =>
        l.id !== lotId
          ? l
          : {
              ...l,
              lignes: l.lignes.map((g) =>
                g.id === ligneId ? { ...g, ...patch } : g
              ),
            }
      )
    );
  const removeLigne = (lotId: string, ligneId: string) =>
    setLots(
      lots.map((l) =>
        l.id !== lotId
          ? l
          : { ...l, lignes: l.lignes.filter((g) => g.id !== ligneId) }
      )
    );
  const duplicateLigne = (lotId: string, ligneId: string) =>
    setLots(
      lots.map((l) => {
        if (l.id !== lotId) return l;
        const idx = l.lignes.findIndex((g) => g.id === ligneId);
        if (idx === -1) return l;
        const cp = [...l.lignes];
        cp.splice(idx + 1, 0, { ...l.lignes[idx], id: uid() });
        return { ...l, lignes: cp };
      })
    );
  const cycleNature = (lotId: string, g: Ligne) => {
    const next: LigneNature = g.nature === "normal" ? "option" : "normal";
    updateLigne(lotId, g.id, { nature: next });
  };
  const moveLigne = (lotId: string, idx: number, dir: -1 | 1) =>
    setLots(
      lots.map((l) => {
        if (l.id !== lotId) return l;
        const j = idx + dir;
        if (j < 0 || j >= l.lignes.length) return l;
        const cp = [...l.lignes];
        [cp[idx], cp[j]] = [cp[j], cp[idx]];
        return { ...l, lignes: cp };
      })
    );

  const toggleSet = (
    setFn: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string
  ) =>
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ── Client ──
  function selectClient(clientId: string) {
    if (!clientId) {
      patchDraft({ clientId: null, clientSnapshot: null });
      return;
    }
    const c = clients.find((x) => x.id === clientId);
    if (c) patchDraft({ clientId: c.id, clientSnapshot: snapshotFromClient(c) });
  }
  async function saveNewClient() {
    const created = await repository.clients.create(clientForm);
    const list = await repository.clients.list();
    setClients(list);
    patchDraft({
      clientId: created.id,
      clientSnapshot: snapshotFromClient(created),
    });
    setClientForm(emptyClientForm());
    setClientModal(false);
  }

  // ── Outils globaux ──
  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  }

  /**
   * Modif prix globale :
   *   - pourcent : multiplie BOTH prixMat et prixPose par (1 ± val/100)
   *   - euros    : ajoute (±val) uniquement à prixPose (mat = coût fournisseur,
   *                préservé). Jamais sous 0.
   */
  function applyGlobalPrice() {
    const { sens, mode, valeur } = priceForm;
    const sign = sens === "aug" ? 1 : -1;
    const next = lots.map((l) => ({
      ...l,
      lignes: l.lignes.map((g) => {
        let mat = g.prixMateriauxUnitaire;
        let pose = g.prixPoseUnitaire;
        if (mode === "pct") {
          const f = 1 + (sign * valeur) / 100;
          mat = mat * f;
          pose = pose * f;
        } else {
          pose = pose + sign * valeur;
        }
        mat = Math.max(0, Math.round((mat + Number.EPSILON) * 100) / 100);
        pose = Math.max(0, Math.round((pose + Number.EPSILON) * 100) / 100);
        return { ...g, prixMateriauxUnitaire: mat, prixPoseUnitaire: pose };
      }),
    }));
    setLots(next);
    setPriceModal(false);
    setPriceForm({ sens: "aug", mode: "pct", valeur: 0 });
    flash("Prix unitaires mis à jour sur toutes les lignes.");
  }

  /**
   * Importe le taux horaire entreprise → applique à prixPoseUnitaire des lignes
   * dont l'unité est 'h' et dont le prix pose est encore à 0.
   */
  function importTauxHoraire() {
    const taux = entreprise?.tauxHoraire ?? 0;
    if (taux <= 0) {
      flash("Renseigne ton taux horaire dans Paramètres pour l'utiliser ici.");
      return;
    }
    let count = 0;
    const next = lots.map((l) => ({
      ...l,
      lignes: l.lignes.map((g) => {
        if (g.unite === "h" && g.prixPoseUnitaire === 0) {
          count++;
          return { ...g, prixPoseUnitaire: taux };
        }
        return g;
      }),
    }));
    if (count === 0) {
      flash(
        `Aucune ligne en heures (unité « h ») à 0 € à compléter (taux : ${taux} €/h).`
      );
      return;
    }
    setLots(next);
    flash(`${count} ligne(s) en heures complétée(s) à ${taux} €/h.`);
  }

  // ── Totaux (avec remise) ──
  const totaux = useMemo(
    () => calcDevisTotaux(draft.lots, draft.remiseMode, draft.remiseValeur),
    [draft.lots, draft.remiseMode, draft.remiseValeur]
  );
  const ventil = useMemo(
    () => ventilationTVA(draft.lots, draft.remiseMode, draft.remiseValeur),
    [draft.lots, draft.remiseMode, draft.remiseValeur]
  );
  const acompte = montantAcompte({
    totalTTC: totaux.totalTTC,
    acomptePct: draft.acomptePct,
  });
  const tMarge = tauxMargePct(totaux);
  const remiseActive = draft.remiseMode !== "aucune" && totaux.remiseHT > 0;
  const clientName = draft.clientSnapshot
    ? snapshotName(draft.clientSnapshot)
    : "Aucun client";

  if (!loaded) {
    return (
      <div className="devis-editor-tool">
        <div className="loading">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="devis-editor-tool">
      {/* TOPBAR FINE (pleine largeur) */}
      <div className="editor-topbar">
        <Link href="/chantier/devis" className="et-back">
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Retour
        </Link>
        <div className="et-center">
          <div className="et-title">
            {numero && <span className="num">{numero} · </span>}
            {draft.titre.trim() || "Nouveau devis"}
          </div>
          <div className="et-sub">
            {draft.clientSnapshot ? `pour ${clientName} · ` : ""}
            {STATUT_LABEL[draft.statut]}
            {savedAt ? ` · Modifié ${relTime(savedAt)}` : ""}
          </div>
        </div>
        <div className="et-actions">
          {id ? (
            <a
              className="et-btn"
              href={`/chantier/devis/${id}/apercu`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="ti ti-eye" aria-hidden="true" />
              Aperçu
            </a>
          ) : (
            <button
              className="et-btn"
              disabled
              title="Enregistre le devis pour activer l'aperçu"
            >
              <i className="ti ti-eye" aria-hidden="true" />
              Aperçu
            </button>
          )}
          <button className="et-btn" disabled title="Disponible prochainement">
            <i className="ti ti-file-type-pdf" aria-hidden="true" />
            PDF
          </button>
          <select
            className="et-statut"
            value={draft.statut}
            onChange={(e) =>
              patchDraft({ statut: e.target.value as DevisStatut })
            }
            title="Statut du devis"
          >
            {(["brouillon", "envoye", "signe", "refuse"] as DevisStatut[]).map(
              (s) => (
                <option key={s} value={s}>
                  {STATUT_LABEL[s]}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="editor-body">
        <div className="editor-grid">
          <div className="editor-col">
            {/* EN-TÊTE (bandeau repliable) */}
            <div className="entete-band">
              <button
                type="button"
                className="entete-head"
                onClick={() => setEnteteOpen((o) => !o)}
              >
                <i
                  className={`ti ti-${enteteOpen ? "chevron-down" : "chevron-right"}`}
                  aria-hidden="true"
                />
                {enteteOpen ? (
                  <span className="entete-head-title">En-tête du devis</span>
                ) : (
                  <span className="entete-summary">
                    <b>Client :</b> {clientName} &nbsp;·&nbsp; <b>Validité :</b>{" "}
                    {formatDateFR(draft.dateValidite)} &nbsp;·&nbsp;{" "}
                    <b>Acompte :</b> {draft.acomptePct} %
                    {remiseActive && (
                      <>
                        {" "}
                        &nbsp;·&nbsp; <b>Remise :</b>{" "}
                        {draft.remiseMode === "pourcent"
                          ? `${draft.remiseValeur} %`
                          : formatEuro(draft.remiseValeur)}
                      </>
                    )}
                  </span>
                )}
              </button>

              {enteteOpen && (
                <div className="entete-fields">
                  <div className="field">
                    <label className="lbl">Client</label>
                    <div className="client-row">
                      <div className="field">
                        <select
                          value={draft.clientId ?? ""}
                          onChange={(e) => selectClient(e.target.value)}
                        >
                          <option value="">— Aucun client —</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {clientLabel(c)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="btn-sec"
                        onClick={() => setClientModal(true)}
                      >
                        <i className="ti ti-plus" aria-hidden="true" />
                        Nouveau client
                      </button>
                    </div>
                  </div>
                  <div className="field">
                    <label className="lbl">Titre du devis</label>
                    <input
                      value={draft.titre}
                      onChange={(e) => patchDraft({ titre: e.target.value })}
                      placeholder="Ex. Rénovation salle de bain"
                    />
                  </div>
                  <div className="row c2">
                    <div className="field">
                      <label className="lbl">Date de création</label>
                      <input
                        type="date"
                        className="mono"
                        value={draft.dateCreation}
                        onChange={(e) =>
                          patchDraft({ dateCreation: e.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label className="lbl">Valable jusqu&apos;au</label>
                      <input
                        type="date"
                        className="mono"
                        value={draft.dateValidite ?? ""}
                        onChange={(e) =>
                          patchDraft({ dateValidite: e.target.value || null })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="lbl">Adresse du chantier</label>
                    <input
                      value={draft.chantierAdresse}
                      onChange={(e) =>
                        patchDraft({ chantierAdresse: e.target.value })
                      }
                      placeholder="Adresse des travaux"
                    />
                  </div>
                  <div className="row c2">
                    <div className="field">
                      <label className="lbl">Code postal</label>
                      <input
                        className="mono"
                        value={draft.chantierCodePostal}
                        onChange={(e) =>
                          patchDraft({ chantierCodePostal: e.target.value })
                        }
                      />
                    </div>
                    <div className="field">
                      <label className="lbl">Ville</label>
                      <input
                        value={draft.chantierVille}
                        onChange={(e) =>
                          patchDraft({ chantierVille: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="row c2">
                    <div className="field">
                      <label className="lbl">Acompte demandé (%)</label>
                      <input
                        className="mono"
                        type="number"
                        min={0}
                        max={100}
                        value={draft.acomptePct}
                        onChange={(e) =>
                          patchDraft({ acomptePct: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>

                  {/* Remise commerciale */}
                  <div className="field">
                    <label className="lbl">Remise commerciale</label>
                    <div className="remise-row">
                      {(
                        [
                          { v: "aucune" as RemiseMode, l: "Aucune" },
                          { v: "pourcent" as RemiseMode, l: "En % HT" },
                          { v: "euros" as RemiseMode, l: "En € HT" },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          className={`remise-pill${draft.remiseMode === opt.v ? " active" : ""}`}
                          onClick={() => patchDraft({ remiseMode: opt.v })}
                        >
                          {opt.l}
                        </button>
                      ))}
                      {draft.remiseMode !== "aucune" && (
                        <input
                          className="mono remise-val"
                          type="number"
                          min={0}
                          step="any"
                          value={draft.remiseValeur}
                          onChange={(e) =>
                            patchDraft({
                              remiseValeur: Number(e.target.value) || 0,
                            })
                          }
                          placeholder={
                            draft.remiseMode === "pourcent" ? "%" : "€"
                          }
                        />
                      )}
                    </div>
                  </div>

                  {/* Toggle détail mat/pose côté client */}
                  <div className="field">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={draft.detailMatPose}
                        onChange={(e) =>
                          patchDraft({ detailMatPose: e.target.checked })
                        }
                      />
                      <span>
                        Afficher le détail Matériaux / Pose dans l&apos;aperçu
                        client
                      </span>
                    </label>
                  </div>

                  <div className="field">
                    <label className="lbl">
                      Lettre d&apos;introduction (aperçu client)
                    </label>
                    <textarea
                      rows={3}
                      value={draft.lettreIntro}
                      onChange={(e) =>
                        patchDraft({ lettreIntro: e.target.value })
                      }
                      placeholder="Quelques lignes d'introduction au devis…"
                    />
                  </div>
                  <div className="field">
                    <label className="lbl">
                      Notes internes (privé — jamais affiché au client)
                    </label>
                    <textarea
                      rows={3}
                      value={draft.notesInternes}
                      onChange={(e) =>
                        patchDraft({ notesInternes: e.target.value })
                      }
                      placeholder="Annotations privées…"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* LOTS */}
            {lots.map((lot, li) => {
              const isCollapsed = collapsed.has(lot.id);
              const lotHT = calcDevisTotaux([lot]).subTotalHT;
              return (
                <div className="lot" key={lot.id}>
                  <div className={`lot-head${isCollapsed ? " collapsed" : ""}`}>
                    <span className="lot-num">{li + 1}.0</span>
                    <input
                      className="lot-title-input"
                      value={lot.titre}
                      placeholder="Intitulé du lot"
                      onChange={(e) =>
                        updateLot(lot.id, { titre: e.target.value })
                      }
                    />
                    <span className="lot-total">{formatEuro(lotHT)}</span>
                    <div className="lot-actions">
                      <button
                        className="icon-btn"
                        title="Monter le lot"
                        disabled={li === 0}
                        onClick={() => moveLot(li, -1)}
                      >
                        <i className="ti ti-chevron-up" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-btn"
                        title="Descendre le lot"
                        disabled={li === lots.length - 1}
                        onClick={() => moveLot(li, 1)}
                      >
                        <i className="ti ti-chevron-down" aria-hidden="true" />
                      </button>
                      <button
                        className="icon-btn"
                        title={isCollapsed ? "Déplier" : "Replier"}
                        onClick={() => toggleSet(setCollapsed, lot.id)}
                      >
                        <i
                          className={`ti ti-${isCollapsed ? "chevron-right" : "minus"}`}
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Supprimer le lot"
                        onClick={() => removeLot(lot.id)}
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="lot-body">
                      {lot.lignes.map((g, gi) => {
                        const brut = ligneBrutHT(g);
                        const isEditing = editing.has(g.id);
                        const combinedPU =
                          g.prixMateriauxUnitaire + g.prixPoseUnitaire;
                        return (
                          <div
                            className={`ligne-card${isEditing ? " editing" : ""}`}
                            key={g.id}
                          >
                            <div
                              className="ligne-read"
                              onClick={() => toggleSet(setEditing, g.id)}
                            >
                              <span className="ligne-num">
                                {li + 1}.{gi + 1}
                              </span>
                              <div className="ligne-main">
                                <div className="ligne-lib">
                                  {g.libelle || (
                                    <span className="muted">Sans libellé</span>
                                  )}
                                  {g.nature === "option" && (
                                    <span className="ligne-tag">Option</span>
                                  )}
                                </div>
                                <div className="ligne-tech">
                                  {g.quantite} {UNITE_LABEL[g.unite]} ×{" "}
                                  {formatEuro(combinedPU)} · TVA {g.tva} %
                                  {g.description ? ` · ${g.description}` : ""}
                                </div>
                                <div className="ligne-mp">
                                  MAT {formatEuro(g.prixMateriauxUnitaire)} ·
                                  POSE {formatEuro(g.prixPoseUnitaire)} /
                                  {UNITE_LABEL[g.unite]}
                                </div>
                              </div>
                              <div
                                className={`ligne-amt${g.nature === "option" ? " option" : ""}`}
                              >
                                {formatEuro(brut)}
                              </div>
                              <div
                                className="ligne-hover-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="icon-btn"
                                  title="Éditer"
                                  onClick={() => toggleSet(setEditing, g.id)}
                                >
                                  <i className="ti ti-pencil" aria-hidden="true" />
                                </button>
                                <button
                                  className="icon-btn"
                                  title="Dupliquer"
                                  onClick={() => duplicateLigne(lot.id, g.id)}
                                >
                                  <i className="ti ti-copy" aria-hidden="true" />
                                </button>
                                <button
                                  className="icon-btn"
                                  title="Basculer normal / option"
                                  onClick={() => cycleNature(lot.id, g)}
                                >
                                  <i
                                    className="ti ti-arrows-shuffle"
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  className="icon-btn danger"
                                  title="Supprimer"
                                  onClick={() => removeLigne(lot.id, g.id)}
                                >
                                  <i className="ti ti-trash" aria-hidden="true" />
                                </button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="ligne-edit">
                                <label className="le-field">
                                  <span className="lbl">Libellé</span>
                                  <input
                                    value={g.libelle}
                                    onChange={(e) =>
                                      updateLigne(lot.id, g.id, {
                                        libelle: e.target.value,
                                      })
                                    }
                                    placeholder="Libellé de la prestation"
                                  />
                                </label>
                                <label className="le-field">
                                  <span className="lbl">Description</span>
                                  <input
                                    value={g.description}
                                    onChange={(e) =>
                                      updateLigne(lot.id, g.id, {
                                        description: e.target.value,
                                      })
                                    }
                                    placeholder="Détail technique (optionnel)"
                                  />
                                </label>
                                <div className="le-grid">
                                  <label className="le-field">
                                    <span className="lbl">Qté</span>
                                    <input
                                      className="mono"
                                      type="number"
                                      step="any"
                                      value={g.quantite}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          quantite: Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="le-field">
                                    <span className="lbl">Unité</span>
                                    <select
                                      value={g.unite}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          unite: e.target.value as Unite,
                                        })
                                      }
                                    >
                                      {UNITES.map((u) => (
                                        <option key={u} value={u}>
                                          {UNITE_LABEL[u]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="le-field">
                                    <span className="lbl">Prix matériaux</span>
                                    <input
                                      className="mono"
                                      type="number"
                                      step="any"
                                      value={g.prixMateriauxUnitaire}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          prixMateriauxUnitaire:
                                            Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="le-field">
                                    <span className="lbl">Prix pose</span>
                                    <input
                                      className="mono"
                                      type="number"
                                      step="any"
                                      value={g.prixPoseUnitaire}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          prixPoseUnitaire:
                                            Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="le-field">
                                    <span className="lbl">TVA</span>
                                    <select
                                      value={g.tva}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          tva: Number(e.target.value) as TauxTVA,
                                        })
                                      }
                                    >
                                      {TAUX_TVA.map((t) => (
                                        <option key={t} value={t}>
                                          {t} %
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="le-field">
                                    <span className="lbl">Nature</span>
                                    <select
                                      value={g.nature}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          nature: e.target.value as LigneNature,
                                        })
                                      }
                                    >
                                      {LIGNE_NATURES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                          {s.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <div className="le-costs">
                                  <label className="le-field">
                                    <span className="lbl">
                                      Coût matériaux d&apos;achat (€/u)
                                    </span>
                                    <input
                                      className="mono"
                                      type="number"
                                      step="any"
                                      value={g.coutMateriauxAchat ?? 0}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          coutMateriauxAchat:
                                            Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="le-field">
                                    <span className="lbl">
                                      Coût MO interne (€/u)
                                    </span>
                                    <input
                                      className="mono"
                                      type="number"
                                      step="any"
                                      value={g.coutMoInterne ?? 0}
                                      onChange={(e) =>
                                        updateLigne(lot.id, g.id, {
                                          coutMoInterne:
                                            Number(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                                <div className="le-foot">
                                  <div className="le-reorder">
                                    <button
                                      className="icon-btn"
                                      title="Monter la ligne"
                                      disabled={gi === 0}
                                      onClick={() => moveLigne(lot.id, gi, -1)}
                                    >
                                      <i
                                        className="ti ti-chevron-up"
                                        aria-hidden="true"
                                      />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      title="Descendre la ligne"
                                      disabled={gi === lot.lignes.length - 1}
                                      onClick={() => moveLigne(lot.id, gi, 1)}
                                    >
                                      <i
                                        className="ti ti-chevron-down"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </div>
                                  <span className="le-hint">
                                    Coûts internes par unité — jamais affichés
                                    au client
                                  </span>
                                  <button
                                    className="le-close"
                                    onClick={() => toggleSet(setEditing, g.id)}
                                  >
                                    Fermer
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        className="btn-add ligne"
                        onClick={() => addLigne(lot.id)}
                      >
                        <i className="ti ti-plus" aria-hidden="true" />
                        Ajouter une ligne
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <button className="btn-add lot" onClick={addLot}>
              <i className="ti ti-plus" aria-hidden="true" />
              Ajouter un lot
            </button>

            {/* OUTILS GLOBAUX (déplacés dans le résumé en R6) */}
            <div className="tools-bar">
              <button
                type="button"
                className="btn-sec"
                disabled
                title="Disponible prochainement — connecte ton chiffrage à ce devis"
              >
                <i className="ti ti-package" aria-hidden="true" />
                Importer depuis Prix Matériaux
              </button>
              <button type="button" className="btn-sec" onClick={importTauxHoraire}>
                <i className="ti ti-clock-hour-4" aria-hidden="true" />
                Importer depuis Taux Horaire
              </button>
              <button
                type="button"
                className="btn-sec"
                onClick={() => setPriceModal(true)}
              >
                <i className="ti ti-adjustments" aria-hidden="true" />
                Modifier les prix globalement
              </button>
              <button
                type="button"
                className="btn-sec"
                disabled
                title="Bientôt — enregistrer ce devis comme modèle réutilisable"
              >
                <i className="ti ti-template" aria-hidden="true" />
                Enregistrer comme modèle
              </button>
            </div>
            {notice && (
              <div className="notice">
                <i className="ti ti-info-circle" aria-hidden="true" />
                {notice}
              </div>
            )}
          </div>

          {/* RÉSUMÉ */}
          <div>
            <div className="summary">
              <div className="summary-title">Récapitulatif</div>

              {/* Par lot */}
              {lots.length > 0 && (
                <>
                  {lots.map((lot, li) => (
                    <div className="sum-row sub" key={lot.id}>
                      <span className="l">
                        {li + 1}.0 {lot.titre || `Lot ${li + 1}`}
                      </span>
                      <span className="v">
                        {formatEuro(calcDevisTotaux([lot]).subTotalHT)}
                      </span>
                    </div>
                  ))}
                  <div className="sum-sep" />
                </>
              )}

              {/* Sous-total / Total HT */}
              {remiseActive ? (
                <>
                  <div className="sum-row">
                    <span className="l">Sous-total HT</span>
                    <span className="v">{formatEuro(totaux.subTotalHT)}</span>
                  </div>
                  <div className="sum-row sub">
                    <span className="l">dont Matériaux</span>
                    <span className="v">
                      {formatEuro(totaux.totalMateriauxHT)}
                    </span>
                  </div>
                  <div className="sum-row sub">
                    <span className="l">dont Pose</span>
                    <span className="v">{formatEuro(totaux.totalPoseHT)}</span>
                  </div>
                  <div className="sum-row remise">
                    <span className="l">
                      Remise{" "}
                      {draft.remiseMode === "pourcent"
                        ? `−${draft.remiseValeur} %`
                        : ""}
                    </span>
                    <span className="v">− {formatEuro(totaux.remiseHT)}</span>
                  </div>
                  <div className="sum-row total">
                    <span className="l">Total HT</span>
                    <span className="v">{formatEuro(totaux.totalHT)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="sum-row total">
                    <span className="l">Total HT</span>
                    <span className="v">{formatEuro(totaux.totalHT)}</span>
                  </div>
                  <div className="sum-row sub">
                    <span className="l">dont Matériaux</span>
                    <span className="v">
                      {formatEuro(totaux.totalMateriauxHT)}
                    </span>
                  </div>
                  <div className="sum-row sub">
                    <span className="l">dont Pose</span>
                    <span className="v">{formatEuro(totaux.totalPoseHT)}</span>
                  </div>
                </>
              )}

              {/* TVA */}
              {Object.keys(ventil)
                .map(Number)
                .sort((a, b) => a - b)
                .map((t) => (
                  <div className="sum-row sub" key={t}>
                    <span className="l">dont TVA {t} %</span>
                    <span className="v">{formatEuro(ventil[t])}</span>
                  </div>
                ))}
              <div className="sum-row">
                <span className="l">Total TVA</span>
                <span className="v">{formatEuro(totaux.totalTVA)}</span>
              </div>
              <div className="sum-sep" />
              <div className="sum-row total">
                <span className="l">Total TTC</span>
                <span className="v">{formatEuro(totaux.totalTTC)}</span>
              </div>
              <div className="sum-row">
                <span className="l">Acompte {draft.acomptePct} %</span>
                <span className="v">{formatEuro(acompte)}</span>
              </div>
              <div className="sum-sep" />
              <div className="sum-row marge">
                <span className="l">Marge HT</span>
                <span className={`v${totaux.margeHT < 0 ? " neg" : ""}`}>
                  {formatEuro(totaux.margeHT)}
                </span>
              </div>
              <div className="sum-row sub">
                <span className="l">Taux de marge</span>
                <span className="v">{formatPct(tMarge)}</span>
              </div>
              {totaux.totalOptionsHT > 0 && (
                <div className="sum-options">
                  <span>Options (hors total)</span>
                  <span>{formatEuro(totaux.totalOptionsHT)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL NOUVEAU CLIENT */}
      {clientModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClientModal(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Nouveau client</h3>
            <div className="field">
              <label className="lbl">Type</label>
              <select
                value={clientForm.type}
                onChange={(e) =>
                  setClientForm({
                    ...clientForm,
                    type: e.target.value as Client["type"],
                  })
                }
              >
                <option value="particulier">Particulier</option>
                <option value="professionnel">Professionnel</option>
              </select>
            </div>
            <div className="row c2">
              <div className="field">
                <label className="lbl">
                  {clientForm.type === "professionnel" ? "Raison sociale" : "Nom"}
                </label>
                <input
                  value={clientForm.nom}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, nom: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label className="lbl">
                  {clientForm.type === "professionnel"
                    ? "Interlocuteur"
                    : "Prénom"}
                </label>
                <input
                  value={
                    clientForm.type === "professionnel"
                      ? clientForm.contact
                      : clientForm.prenom
                  }
                  onChange={(e) =>
                    setClientForm({
                      ...clientForm,
                      ...(clientForm.type === "professionnel"
                        ? { contact: e.target.value }
                        : { prenom: e.target.value }),
                    })
                  }
                />
              </div>
            </div>
            <div className="row c2">
              <div className="field">
                <label className="lbl">E-mail</label>
                <input
                  value={clientForm.email}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, email: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label className="lbl">Téléphone</label>
                <input
                  className="mono"
                  value={clientForm.telephone}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, telephone: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label className="lbl">Adresse</label>
              <input
                value={clientForm.adresse}
                onChange={(e) =>
                  setClientForm({ ...clientForm, adresse: e.target.value })
                }
              />
            </div>
            <div className="row c2">
              <div className="field">
                <label className="lbl">Code postal</label>
                <input
                  className="mono"
                  value={clientForm.codePostal}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, codePostal: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label className="lbl">Ville</label>
                <input
                  value={clientForm.ville}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, ville: e.target.value })
                  }
                />
              </div>
            </div>
            {clientForm.type === "professionnel" && (
              <div className="field">
                <label className="lbl">SIREN</label>
                <input
                  className="mono"
                  value={clientForm.siren}
                  onChange={(e) =>
                    setClientForm({ ...clientForm, siren: e.target.value })
                  }
                />
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn-ghost"
                onClick={() => {
                  setClientForm(emptyClientForm());
                  setClientModal(false);
                }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={saveNewClient}
                disabled={!clientForm.nom.trim()}
              >
                Créer le client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER PRIX GLOBALEMENT */}
      {priceModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPriceModal(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Modifier les prix globalement</h3>
            <p className="modal-sub">
              <b>Pourcentage</b> : multiplie matériaux ET pose par le même
              facteur (préserve le ratio). <b>Montant €</b> : ajouté uniquement à
              la <b>pose</b> (les matériaux restent au coût fournisseur). Jamais
              sous 0 €.
            </p>
            <div className="price-fields">
              <div className="field">
                <label className="lbl">Sens</label>
                <select
                  value={priceForm.sens}
                  onChange={(e) =>
                    setPriceForm({
                      ...priceForm,
                      sens: e.target.value as "aug" | "dim",
                    })
                  }
                >
                  <option value="aug">Augmenter</option>
                  <option value="dim">Diminuer</option>
                </select>
              </div>
              <div className="field">
                <label className="lbl">Type</label>
                <select
                  value={priceForm.mode}
                  onChange={(e) =>
                    setPriceForm({
                      ...priceForm,
                      mode: e.target.value as "pct" | "eur",
                    })
                  }
                >
                  <option value="pct">Pourcentage (%)</option>
                  <option value="eur">Montant (€)</option>
                </select>
              </div>
              <div className="field">
                <label className="lbl">Valeur</label>
                <input
                  className="mono"
                  type="number"
                  min={0}
                  step="any"
                  value={priceForm.valeur}
                  onChange={(e) =>
                    setPriceForm({
                      ...priceForm,
                      valeur: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setPriceModal(false)}>
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={applyGlobalPrice}
                disabled={priceForm.valeur <= 0}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  return `il y a ${Math.floor(m / 60)} h`;
}
