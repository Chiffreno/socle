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
import type { Devis, DevisStatut } from "@/lib/devis/types";
import "./devis-liste.css";

type Filter = "tous" | DevisStatut;
type SortKey = "numero" | "dateCreation" | "client" | "totalHT";
type SortDir = "asc" | "desc";

function clientName(d: Devis): string {
  const s = d.clientSnapshot;
  if (!s) return "—";
  const full = [s.prenom, s.nom].filter(Boolean).join(" ").trim();
  return full || "—";
}

/**
 * Vue transverse LECTURE SEULE : consulter/chercher tous les devis, tous
 * chantiers confondus. Plus dans la sidebar ; la création de devis se fait
 * depuis un chantier (/chantiers/[id]). Chaque ligne renvoie vers l'aperçu
 * ou le dossier chantier du devis.
 */
export default function DevisListePage() {
  const [devis, setDevis] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("tous");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dateCreation",
    dir: "desc",
  });

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

  return (
    <div className="devis-liste-tool">
      <header className="page-head">
        <div>
          <div className="page-eyebrow">Chantier · Devis</div>
          <h1 className="page-title">Devis</h1>
          <p className="page-sub">
            Tous chantiers confondus — consultation. Les devis se créent depuis
            un chantier.
          </p>
        </div>
        <Link href="/chantiers" className="btn-primary">
          <i className="ti ti-building" aria-hidden="true" />
          Mes chantiers
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
          <div className="empty-title">Aucun devis pour le moment</div>
          <div className="empty-sub">
            Les devis se créent depuis un chantier : ouvre un chantier puis
            « Nouveau devis ».
          </div>
          <Link href="/chantiers" className="btn-primary">
            <i className="ti ti-building" aria-hidden="true" />
            Aller à mes chantiers
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
                      <a
                        className="action-btn"
                        href={`/chantier/devis/${d.id}/apercu`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Aperçu client"
                      >
                        <i className="ti ti-eye" aria-hidden="true" />
                      </a>
                      {d.chantierId ? (
                        <Link
                          className="action-btn"
                          href={`/chantiers/${d.chantierId}`}
                          title="Voir le chantier"
                        >
                          <i className="ti ti-building" aria-hidden="true" />
                        </Link>
                      ) : (
                        <span
                          className="action-btn is-disabled"
                          title="Devis non rattaché à un chantier"
                          aria-disabled="true"
                        >
                          <i className="ti ti-building-off" aria-hidden="true" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
