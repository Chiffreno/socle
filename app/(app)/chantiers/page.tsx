"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { repository } from "@/lib/devis/repository";
import type { Chantier, Client, Devis } from "@/lib/devis/types";
import ChantierFormModal from "./ChantierFormModal";
import "./chantiers.css";

const STATUT_LABEL: Record<Chantier["statut"], string> = {
  actif: "Actif",
  clos: "Clos",
};

function clientName(c: Client | undefined): string {
  if (!c) return "";
  const full = [c.prenom, c.nom].filter(Boolean).join(" ").trim();
  return full || c.contact || "";
}

export default function ChantiersListePage() {
  const router = useRouter();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const reload = useCallback(async () => {
    const [ch, cl, dv] = await Promise.all([
      repository.chantiers.list(),
      repository.clients.list(),
      repository.devis.list(),
    ]);
    setChantiers(ch);
    setClients(cl);
    setDevis(dv);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const clientsById = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const devisCountByChantier = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of devis) {
      if (!d.chantierId) continue;
      m.set(d.chantierId, (m.get(d.chantierId) ?? 0) + 1);
    }
    return m;
  }, [devis]);

  const rows = useMemo(
    () =>
      [...chantiers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [chantiers]
  );

  return (
    <div className="chantiers-tool">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Pilotage</div>
          <h1 className="page-title">Chantiers</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <i className="ti ti-plus" aria-hidden="true" />
          Nouveau chantier
        </button>
      </header>

      {loading ? (
        <div className="loading">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <i className="ti ti-building empty-icon" aria-hidden="true" />
          <div className="empty-title">Aucun chantier pour le moment</div>
          <div className="empty-sub">
            Crée ton premier chantier : il regroupera tes devis (et bientôt tes
            factures et documents) au même endroit.
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <i className="ti ti-plus" aria-hidden="true" />
            Créer mon premier chantier
          </button>
        </div>
      ) : (
        <div className="chantier-list">
          {rows.map((c) => {
            const cl = c.clientId ? clientsById.get(c.clientId) : undefined;
            const name = clientName(cl);
            const count = devisCountByChantier.get(c.id) ?? 0;
            return (
              <Link
                key={c.id}
                href={`/chantiers/${c.id}`}
                className="chantier-row"
              >
                <div className="chantier-main">
                  <div className="chantier-name">{c.nom}</div>
                  <div className="chantier-meta">
                    {name ? <span>{name}</span> : <span className="muted">Client non renseigné</span>}
                    <span className="sep">·</span>
                    {c.ville ? <span>{c.ville}</span> : <span className="muted">Ville non renseignée</span>}
                  </div>
                </div>
                <div className="chantier-aside">
                  <div className="devis-count">
                    <span className="num">{count}</span>
                    {count > 1 ? "devis" : "devis"}
                  </div>
                  <span className={`statut-badge ${c.statut}`}>
                    {STATUT_LABEL[c.statut]}
                  </span>
                  <i className="ti ti-chevron-right" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showForm && (
        <ChantierFormModal
          mode="create"
          clients={clients}
          onClose={() => setShowForm(false)}
          onSaved={(c) => {
            setShowForm(false);
            router.push(`/chantiers/${c.id}`);
          }}
        />
      )}
    </div>
  );
}
