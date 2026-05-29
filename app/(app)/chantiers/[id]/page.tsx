"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { repository } from "@/lib/devis/repository";
import {
  STATUT_LABEL as DEVIS_STATUT_LABEL,
  effectiveStatut,
} from "@/lib/devis/devis-status";
import { formatDateFR, formatEuro } from "@/lib/devis/format";
import type {
  Chantier,
  Client,
  ClientSnapshot,
  Devis,
  DevisInput,
} from "@/lib/devis/types";
import ChantierFormModal from "../ChantierFormModal";
import "../chantiers.css";

const CHANTIER_STATUT_LABEL: Record<Chantier["statut"], string> = {
  actif: "Actif",
  clos: "Clos",
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function clientName(c: Client | null): string {
  if (!c) return "";
  const full = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
  return full || c.contact || "";
}

/** Snapshot figé du client au moment de la création du devis (aperçu/PDF). */
function buildSnapshot(c: Client | null): ClientSnapshot | null {
  if (!c) return null;
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

// Zones temps 2 (placeholders). Factures a sa propre section titrée ; les
// autres restent en soon-cards discrètes.
const SOON_ZONES = [
  { icon: "folder", name: "Documents" },
  { icon: "progress", name: "Avancement" },
];

export default function ChantierDossierPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Devis | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const [ch, cl, dv] = await Promise.all([
      repository.chantiers.get(id),
      repository.clients.list(),
      repository.devis.listByChantier(id),
    ]);
    setChantier(ch);
    setClients(cl);
    setClient(ch?.clientId ? cl.find((c) => c.id === ch.clientId) ?? null : null);
    setDevis(dv);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const adresseComplete = useMemo(() => {
    if (!chantier) return "";
    const cp = [chantier.codePostal, chantier.ville].filter(Boolean).join(" ");
    return [chantier.adresse, cp].filter(Boolean).join(", ");
  }, [chantier]);

  const nouveauDevis = useCallback(async () => {
    if (!chantier) return;
    setCreating(true);
    // Create-then-edit : on crée le devis rattaché (chantierId), puis on ouvre
    // l'éditeur par id. Les champs adresse @deprecated restent vides : l'adresse
    // est portée par le Chantier (l'éditeur la lit via chantiers.ofDevis).
    const input: DevisInput = {
      clientId: chantier.clientId,
      clientSnapshot: buildSnapshot(client),
      titre: "",
      statut: "brouillon",
      dateCreation: todayISO(),
      dateValidite: null,
      chantierAdresse: "",
      chantierCodePostal: "",
      chantierVille: "",
      chantierId: chantier.id,
      lots: [],
      acomptePct: 30,
      lettreIntro: "",
      notesInternes: "",
      detailMatPose: false,
      remiseMode: "aucune",
      remiseValeur: 0,
    };
    const created = await repository.devis.create(input);
    router.push(`/chantier/devis/${created.id}/editer`);
  }, [chantier, client, router]);

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    await repository.devis.delete(toDelete.id);
    setToDelete(null);
    await reload();
  }, [toDelete, reload]);

  if (loading) {
    return (
      <div className="chantiers-tool">
        <div className="loading">Chargement…</div>
      </div>
    );
  }

  if (!chantier) {
    return (
      <div className="chantiers-tool">
        <Link href="/chantiers" className="page-back">
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Tous les chantiers
        </Link>
        <div className="empty">
          <i className="ti ti-building-off empty-icon" aria-hidden="true" />
          <div className="empty-title">Chantier introuvable</div>
          <div className="empty-sub">
            Ce chantier n&apos;existe pas ou a été supprimé.
          </div>
          <Link href="/chantiers" className="btn-primary">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="chantiers-tool">
      <Link href="/chantiers" className="page-back">
        <i className="ti ti-arrow-left" aria-hidden="true" />
        Tous les chantiers
      </Link>

      <header className="page-head">
        <div>
          <div className="page-eyebrow">Dossier chantier</div>
          <h1 className="page-title">{chantier.nom}</h1>
        </div>
        <div className="head-actions">
          <Link href="/chantier/materiaux" className="btn-secondary">
            <i className="ti ti-package" aria-hidden="true" />
            Prix matériaux
          </Link>
          <span className={`statut-badge ${chantier.statut}`}>
            {CHANTIER_STATUT_LABEL[chantier.statut]}
          </span>
        </div>
      </header>

      {/* ── Infos chantier ── */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Informations</div>
          <button className="btn-secondary" onClick={() => setShowEdit(true)}>
            <i className="ti ti-pencil" aria-hidden="true" />
            Éditer
          </button>
        </div>
        <div className="info-grid">
          <div className="info-item">
            <div className="label">Client</div>
            <div className={`value${client ? "" : " muted"}`}>
              {clientName(client) || "Non renseigné"}
            </div>
          </div>
          <div className="info-item">
            <div className="label">Statut</div>
            <div className="value">{CHANTIER_STATUT_LABEL[chantier.statut]}</div>
          </div>
          <div className="info-item full">
            <div className="label">Adresse</div>
            <div className={`value${adresseComplete ? "" : " muted"}`}>
              {adresseComplete || "Non renseignée"}
            </div>
          </div>
          <div className="info-item">
            <div className="label">Début prévu</div>
            <div className="value">{formatDateFR(chantier.dateDebut)}</div>
          </div>
          <div className="info-item">
            <div className="label">Fin prévue</div>
            <div className="value">{formatDateFR(chantier.dateFin)}</div>
          </div>
          {chantier.notes ? (
            <div className="info-item full">
              <div className="label">Notes</div>
              <div className="value">{chantier.notes}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Section Devis ── */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            Devis {devis.length > 0 ? `(${devis.length})` : ""}
          </div>
          <button
            className="btn-primary"
            onClick={nouveauDevis}
            disabled={creating}
          >
            <i className="ti ti-plus" aria-hidden="true" />
            {creating ? "Création…" : "Nouveau devis"}
          </button>
        </div>

        {devis.length === 0 ? (
          <div className="devis-empty">
            Aucun devis pour ce chantier. Crée le premier avec « Nouveau devis ».
          </div>
        ) : (
          <div>
            {devis.map((d) => {
              const eff = effectiveStatut(d);
              return (
                <div key={d.id} className="devis-line">
                  <div className="dl-main">
                    <span className="dl-numero">{d.numero}</span>{" "}
                    <span className="dl-titre">{d.titre || "Sans titre"}</span>
                  </div>
                  <span className={`devis-badge ${eff}`}>
                    {DEVIS_STATUT_LABEL[eff]}
                  </span>
                  <span className="dl-montant">{formatEuro(d.totalTTC)}</span>
                  <div className="dl-actions">
                    <Link
                      className="action-btn"
                      href={`/chantier/devis/${d.id}/editer`}
                      title="Éditer"
                    >
                      <i className="ti ti-pencil" aria-hidden="true" />
                    </Link>
                    <a
                      className="action-btn"
                      href={`/chantier/devis/${d.id}/apercu`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Aperçu client"
                    >
                      <i className="ti ti-eye" aria-hidden="true" />
                    </a>
                    <button
                      className="action-btn danger"
                      onClick={() => setToDelete(d)}
                      title="Supprimer"
                    >
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section Factures (temps 2) ── */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Factures</div>
          <span className="soon-tag">À venir</span>
        </div>
        <div className="devis-empty">
          La facturation (acompte, situations, solde) arrivera ici, rattachée aux
          devis signés de ce chantier.
        </div>
      </div>

      {/* ── Zones temps 2 (placeholders sobres) ── */}
      <div className="soon-grid">
        {SOON_ZONES.map((z) => (
          <div key={z.name} className="soon-card">
            <i className={`ti ti-${z.icon}`} aria-hidden="true" />
            <div className="soon-name">{z.name}</div>
            <span className="soon-tag">À venir</span>
          </div>
        ))}
      </div>

      {showEdit && (
        <ChantierFormModal
          mode="edit"
          chantier={chantier}
          clients={clients}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            reload();
          }}
        />
      )}

      {toDelete && (
        <div
          className="chantiers-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setToDelete(null);
          }}
        >
          <div className="chantiers-modal" role="dialog" aria-modal="true">
            <h3>Supprimer ce devis ?</h3>
            <p className="modal-text">
              Le devis <span className="num">{toDelete.numero}</span>
              {toDelete.titre ? ` (${toDelete.titre})` : ""} sera définitivement
              supprimé. Cette action est irréversible et le numéro ne sera pas
              réutilisé.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setToDelete(null)}>
                Annuler
              </button>
              <button className="btn-danger" onClick={confirmDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
