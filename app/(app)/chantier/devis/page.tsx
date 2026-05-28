"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import {
  STATUTS,
  STATUT_LABEL,
  effectiveStatut,
} from "@/lib/devis/devis-status";
import { formatDateFR, formatEuro } from "@/lib/devis/format";
import type { Devis, DevisInput, DevisStatut } from "@/lib/devis/types";
import "./devis-liste.css";

type Filter = "tous" | DevisStatut;
type SortKey = "numero" | "dateCreation" | "client" | "totalHT";
type SortDir = "asc" | "desc";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function clientName(d: Devis): string {
  const s = d.clientSnapshot;
  if (!s) return "—";
  const full = [s.prenom, s.nom].filter(Boolean).join(" ").trim();
  return full || "—";
}

export default function DevisListePage() {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("tous");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dateCreation",
    dir: "desc",
  });
  const [toDelete, setToDelete] = useState<Devis | null>(null);

  const reload = useCallback(async () => {
    const list = await repository.devis.list();
    setDevis(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Compteurs par statut effectif (pour les pills).
  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: devis.length };
    for (const s of STATUTS) c[s] = 0;
    for (const d of devis) c[effectiveStatut(d)]++;
    return c;
  }, [devis]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = devis.filter((d) => {
      const eff = effectiveStatut(d);
      if (filter !== "tous" && eff !== filter) return false;
      if (!q) return true;
      return (
        d.numero.toLowerCase().includes(q) ||
        clientName(d).toLowerCase().includes(q) ||
        d.titre.toLowerCase().includes(q)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    r = [...r].sort((a, b) => {
      switch (sort.key) {
        case "numero":
          return a.numero.localeCompare(b.numero) * dir;
        case "client":
          return clientName(a).localeCompare(clientName(b)) * dir;
        case "totalHT":
          return (a.totalHT - b.totalHT) * dir;
        case "dateCreation":
        default:
          return a.dateCreation.localeCompare(b.dateCreation) * dir;
      }
    });
    return r;
  }, [devis, filter, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const caret = (key: SortKey) =>
    sort.key === key ? (
      <span className="caret">{sort.dir === "asc" ? "▲" : "▼"}</span>
    ) : null;

  const duplicate = useCallback(
    async (d: Devis) => {
      const input: DevisInput = {
        clientId: d.clientId,
        clientSnapshot: d.clientSnapshot,
        titre: d.titre ? `${d.titre} (copie)` : "(copie)",
        statut: "brouillon",
        dateCreation: todayISO(),
        dateValidite: null,
        chantierAdresse: d.chantierAdresse,
        chantierCodePostal: d.chantierCodePostal,
        chantierVille: d.chantierVille,
        lots: d.lots,
        acomptePct: d.acomptePct,
        lettreIntro: d.lettreIntro,
        detailMatPose: d.detailMatPose,
        remiseMode: d.remiseMode,
        remiseValeur: d.remiseValeur,
        notesInternes: d.notesInternes,
      };
      await repository.devis.create(input);
      await reload();
    },
    [reload]
  );

  const confirmDelete = useCallback(async () => {
    if (!toDelete) return;
    await repository.devis.delete(toDelete.id);
    setToDelete(null);
    await reload();
  }, [toDelete, reload]);

  return (
    <div className="devis-liste-tool">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Chantier · Devis</div>
          <h1 className="page-title">Devis</h1>
        </div>
        <Link href="/chantier/devis/nouveau" className="btn-primary">
          <i className="ti ti-plus" aria-hidden="true" />
          Nouveau devis
        </Link>
      </header>

      {!loading && devis.length > 0 && (
        <div className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Rechercher (n°, client, titre)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filters">
            <button
              className={`pill${filter === "tous" ? " active" : ""}`}
              onClick={() => setFilter("tous")}
            >
              Tous <span className="count">({counts.tous})</span>
            </button>
            {STATUTS.map((s) => (
              <button
                key={s}
                className={`pill${filter === s ? " active" : ""}`}
                onClick={() => setFilter(s)}
              >
                {STATUT_LABEL[s]} <span className="count">({counts[s]})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Chargement…</div>
      ) : devis.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Vous n&apos;avez pas encore créé de devis</div>
          <div className="empty-sub">
            Crée ton premier devis : en-tête, lots, lignes, puis aperçu et PDF.
          </div>
          <Link href="/chantier/devis/nouveau" className="btn-primary">
            <i className="ti ti-plus" aria-hidden="true" />
            Créer mon premier devis
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Aucun devis ne correspond</div>
          <div className="empty-sub">
            Aucun devis ne correspond à ce filtre ou à cette recherche.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort("numero")}>
                  N° {caret("numero")}
                </th>
                <th
                  className="sortable"
                  onClick={() => toggleSort("dateCreation")}
                >
                  Date {caret("dateCreation")}
                </th>
                <th className="sortable" onClick={() => toggleSort("client")}>
                  Client {caret("client")}
                </th>
                <th>Titre</th>
                <th
                  className="sortable num"
                  onClick={() => toggleSort("totalHT")}
                >
                  Montant HT {caret("totalHT")}
                </th>
                <th>Statut</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const eff = effectiveStatut(d);
                return (
                  <tr key={d.id}>
                    <td className="numero">{d.numero}</td>
                    <td className="date">{formatDateFR(d.dateCreation)}</td>
                    <td className="client">{clientName(d)}</td>
                    <td className="titre">{d.titre || "—"}</td>
                    <td className="num montant">{formatEuro(d.totalHT)}</td>
                    <td>
                      <span className={`badge ${eff}`}>{STATUT_LABEL[eff]}</span>
                    </td>
                    <td className="actions">
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
                        className="action-btn"
                        onClick={() => duplicate(d)}
                        title="Dupliquer"
                      >
                        <i className="ti ti-copy" aria-hidden="true" />
                      </button>
                      <button
                        className="action-btn danger"
                        onClick={() => setToDelete(d)}
                        title="Supprimer"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toDelete && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setToDelete(null);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Supprimer ce devis ?</h3>
            <p>
              Le devis <span className="num">{toDelete.numero}</span>
              {clientName(toDelete) !== "—" ? ` (${clientName(toDelete)})` : ""}{" "}
              sera définitivement supprimé. Cette action est irréversible et le
              numéro ne sera pas réutilisé.
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
