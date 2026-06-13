"use client";

// ============================================================
// SOCLE — PV de réception — Éditeur terrain
//
// Outil plein écran mobile-first (route group (editor)) rempli au téléphone
// sur le chantier. Structure et pré-chargement des données :
//   - 1 PV par chantier : reprise si pvRepo.listByChantier renvoie un PV,
//     sinon création d'un brouillon.
//   - Lots pré-chargés depuis le devis SIGNÉ (statut === "signe") du chantier :
//     ses lots actifs (engine.lots[on === true]), mappés via LM. lotId = LotId
//     moteur, jamais le libellé.
//   - Pas de devis signé → l'utilisateur choisit les lots parmi les 14 LotId
//     fixes (sélecteur de cases basé sur LM). Aucun libellé libre.
//
// IMPLÉMENTÉ : verdict par lot, réserves (texte + photos via IndexedDB,
// cf. pvPhotos.ts), statut de réception dérivé (cf. pv-status.ts).
// À VENIR : les signatures (le composant <SignaturePad> existe mais n'est pas
// encore branché ici) et la levée des réserves (Temps 2).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import { LM } from "@/lib/devis/engine/lots";
import type { LotId, LotState } from "@/lib/devis/engine/types";
import { formatDateFR } from "@/lib/devis/format";
import {
  deletePhoto,
  getPhotoUrl,
  putPhoto,
  revokeAllPhotoUrls,
  revokePhotoUrl,
} from "@/lib/devis/pvPhotos";
import type {
  Chantier,
  Devis,
  PV,
  PVLigne,
  PVReserve,
  PVVerdict,
} from "@/lib/devis/types";
import "./pv-reception.css";

const LM_BY_ID = new Map(LM.map((m) => [m.id, m]));
const LM_ORDER = LM.map((m) => m.id);

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Id de réserve — même convention que le reste du projet (crypto.randomUUID). */
function uid(): string {
  return crypto.randomUUID();
}

/** Trie une liste de LotId selon l'ordre canonique de LM. */
function orderByLM(ids: LotId[]): LotId[] {
  const set = new Set(ids);
  return LM_ORDER.filter((id) => set.has(id));
}

/** Lots actifs (on === true) d'un devis, ordonnés selon LM. */
function activeLotsOf(devis: Devis): LotId[] {
  const entries = Object.entries(devis.engine.lots) as [LotId, LotState][];
  return orderByLM(entries.filter(([, l]) => l?.on).map(([id]) => id));
}

export default function PvReceptionEditor({ chantierId }: { chantierId: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [signedDevis, setSignedDevis] = useState<Devis | null>(null);
  const [pv, setPv] = useState<PV | null>(null);
  // Navigation maître-détail : un SEUL état logique (le CSS décide mobile vs
  // desktop). null = sommaire (mobile) / aucun lot ouvert.
  const [selectedLotId, setSelectedLotId] = useState<LotId | null>(null);

  // Cas B (pas de devis signé) : sélection manuelle des lots.
  const [selected, setSelected] = useState<Set<LotId>>(new Set());
  const [starting, setStarting] = useState(false);

  const initRef = useRef(false);
  // Référence toujours-à-jour du PV : permet à `mutate` de partir de l'état le
  // plus récent (évite la course de la saisie texte rapide où un setPv(saved)
  // tardif écraserait des frappes ultérieures).
  const pvRef = useRef<PV | null>(null);
  useEffect(() => {
    pvRef.current = pv;
  }, [pv]);

  // Filet anti-fuite : au démontage de la page, on révoque tous les objectURL
  // encore vivants (les <PhotoThumb> révoquent déjà les leurs au démontage).
  useEffect(() => () => revokeAllPhotoUrls(), []);

  // Desktop (≥900px) : auto-sélection du premier lot (pas d'écran détail vide).
  // Mobile : on laisse selectedLotId à null → le sommaire s'affiche d'abord.
  useEffect(() => {
    const lignes = pv?.lignes;
    if (!lignes || lignes.length === 0) return;
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => {
      if (mq.matches) setSelectedLotId((prev) => prev ?? lignes[0].lotId);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [pv]);

  /** Mute les lignes du PV depuis l'état courant et persiste (fil de l'eau). */
  const mutate = useCallback((fn: (lignes: PVLigne[]) => PVLigne[]) => {
    const cur = pvRef.current;
    if (!cur) return;
    const lignes = fn(cur.lignes);
    const next: PV = { ...cur, lignes };
    pvRef.current = next; // sync immédiat → mutations rapides chaînées
    setPv(next);
    void repository.pv.update(cur.id, { lignes });
  }, []);

  const init = useCallback(async () => {
    const ch = await repository.chantiers.get(chantierId);
    if (!ch) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setChantier(ch);

    const devisList = await repository.devis.listByChantier(chantierId);
    // Devis signé : statut === "signe". Si plusieurs, on prend le plus récent.
    const signed =
      devisList
        .filter((d) => d.statut === "signe")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    setSignedDevis(signed);

    // Reprise d'un PV existant (1 PV / chantier), sinon création (cas A).
    const existing = (await repository.pv.listByChantier(chantierId))[0] ?? null;
    if (existing) {
      setPv(existing);
      setLoading(false);
      return;
    }

    if (signed) {
      // Cas A : pré-chargement immédiat depuis les lots actifs du devis signé.
      const lotIds = activeLotsOf(signed);
      const lignes: PVLigne[] = lotIds.map((lotId) => ({
        lotId,
        verdict: "non_statue",
        reserves: [],
      }));
      const created = await repository.pv.create({
        chantierId,
        devisId: signed.id,
        date: todayISO(),
        lignes,
      });
      setPv(created);
    }
    // Cas B : pas de PV, pas de devis signé → on laisse l'UI afficher le
    // sélecteur de lots ; le PV sera créé à « Démarrer la réception ».
    setLoading(false);
  }, [chantierId]);

  useEffect(() => {
    if (initRef.current) return; // garde StrictMode (pas de double-création)
    initRef.current = true;
    void init();
  }, [init]);

  const toggleLot = useCallback((id: LotId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startReception = useCallback(async () => {
    if (selected.size === 0 || starting) return;
    setStarting(true);
    const lotIds = orderByLM([...selected]);
    const lignes: PVLigne[] = lotIds.map((lotId) => ({
      lotId,
      verdict: "non_statue",
      reserves: [],
    }));
    const created = await repository.pv.create({
      chantierId,
      devisId: "", // aucun devis signé en cas B
      date: todayISO(),
      lignes,
    });
    setPv(created);
    setStarting(false);
  }, [selected, starting, chantierId]);

  // Change le verdict d'un lot et persiste immédiatement. Passer à
  // valide/non_statue purge les réserves (invariant Phase A) ET nettoie les
  // photos orphelines correspondantes dans IndexedDB (sinon accumulation).
  const setVerdict = useCallback(
    async (lotId: LotId, verdict: PVVerdict) => {
      const cur = pvRef.current;
      if (!cur) return;
      const garde = verdict === "reserve" || verdict === "refus";
      const ligne = cur.lignes.find((l) => l.lotId === lotId);
      const orphanIds =
        !garde && ligne ? ligne.reserves.flatMap((r) => r.photoIds) : [];
      mutate((lignes) =>
        lignes.map((l) =>
          l.lotId === lotId
            ? { ...l, verdict, reserves: garde ? l.reserves : [] }
            : l
        )
      );
      // Les <PhotoThumb> démontés révoquent leurs objectURL ; on supprime ici
      // les blobs devenus orphelins.
      for (const k of orphanIds) {
        try {
          await deletePhoto(k);
        } catch {
          /* best-effort : un échec de nettoyage ne bloque pas la saisie */
        }
      }
    },
    [mutate]
  );

  // ─── Réserves (au fil de l'eau) ───
  const addReserve = useCallback(
    (lotId: LotId) => {
      const reserve: PVReserve = { id: uid(), texte: "", photoIds: [] };
      mutate((lignes) =>
        lignes.map((l) =>
          l.lotId === lotId ? { ...l, reserves: [...l.reserves, reserve] } : l
        )
      );
    },
    [mutate]
  );

  const setReserveTexte = useCallback(
    (lotId: LotId, reserveId: string, texte: string) => {
      mutate((lignes) =>
        lignes.map((l) =>
          l.lotId === lotId
            ? {
                ...l,
                reserves: l.reserves.map((r) =>
                  r.id === reserveId ? { ...r, texte } : r
                ),
              }
            : l
        )
      );
    },
    [mutate]
  );

  const removeReserve = useCallback(
    async (lotId: LotId, reserveId: string) => {
      const cur = pvRef.current;
      const res = cur?.lignes
        .find((l) => l.lotId === lotId)
        ?.reserves.find((r) => r.id === reserveId);
      const photoIds = res?.photoIds ?? [];
      mutate((lignes) =>
        lignes.map((l) =>
          l.lotId === lotId
            ? { ...l, reserves: l.reserves.filter((r) => r.id !== reserveId) }
            : l
        )
      );
      for (const k of photoIds) {
        try {
          await deletePhoto(k);
        } catch {
          /* best-effort */
        }
      }
    },
    [mutate]
  );

  // ─── Photos d'une réserve (via la couche pvPhotos) ───
  const addPhoto = useCallback(
    async (lotId: LotId, reserveId: string, file: File) => {
      const key = await putPhoto(file); // compression gérée par pvPhotos
      mutate((lignes) =>
        lignes.map((l) =>
          l.lotId === lotId
            ? {
                ...l,
                reserves: l.reserves.map((r) =>
                  r.id === reserveId
                    ? { ...r, photoIds: [...r.photoIds, key] }
                    : r
                ),
              }
            : l
        )
      );
    },
    [mutate]
  );

  const removePhoto = useCallback(
    async (lotId: LotId, reserveId: string, key: string) => {
      // Retrait optimiste → le <PhotoThumb> se démonte et révoque son URL.
      mutate((lignes) =>
        lignes.map((l) =>
          l.lotId === lotId
            ? {
                ...l,
                reserves: l.reserves.map((r) =>
                  r.id === reserveId
                    ? { ...r, photoIds: r.photoIds.filter((p) => p !== key) }
                    : r
                ),
              }
            : l
        )
      );
      try {
        await deletePhoto(key);
      } catch {
        /* best-effort */
      }
    },
    [mutate]
  );

  // ─── États ───
  if (loading) {
    return (
      <div className="pv-tool">
        <div className="pv-loading">Chargement…</div>
      </div>
    );
  }

  if (notFound || !chantier) {
    return (
      <div className="pv-tool">
        <Link href="/chantiers" className="pv-back">
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Tous les chantiers
        </Link>
        <div className="pv-empty">
          <i className="ti ti-building-off pv-empty-ic" aria-hidden="true" />
          <div className="pv-empty-title">Chantier introuvable</div>
          <div className="pv-empty-sub">
            Ce chantier n&apos;existe pas ou a été supprimé.
          </div>
        </div>
      </div>
    );
  }

  const adresse = [
    chantier.adresse,
    [chantier.codePostal, chantier.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const dateReception = pv?.date ?? todayISO();

  return (
    <div className="pv-tool">
      <Link href={`/chantiers/${chantierId}`} className="pv-back">
        <i className="ti ti-arrow-left" aria-hidden="true" />
        Retour au chantier
      </Link>

      <header className="pv-head">
        <div className="pv-eyebrow">PV de réception</div>
        <h1 className="pv-title">{chantier.nom}</h1>
        <div className="pv-meta">
          {adresse ? (
            <span className="pv-meta-row">
              <i className="ti ti-map-pin" aria-hidden="true" />
              {adresse}
            </span>
          ) : null}
          <span className="pv-meta-row">
            <i className="ti ti-calendar-event" aria-hidden="true" />
            Réception du {formatDateFR(dateReception)}
          </span>
        </div>
      </header>

      {pv ? (
        <PvBoard
          lignes={pv.lignes}
          fromDevis={!!signedDevis}
          selectedLotId={selectedLotId}
          onSelect={setSelectedLotId}
          onBack={() => setSelectedLotId(null)}
          onVerdict={setVerdict}
          onAddReserve={addReserve}
          onReserveTexte={setReserveTexte}
          onRemoveReserve={removeReserve}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
        />
      ) : (
        <LotSelector
          selected={selected}
          onToggle={toggleLot}
          onStart={startReception}
          starting={starting}
        />
      )}
    </div>
  );
}

// État → libellé de pastille (sommaire).
const VERDICT_PILL: Record<PVVerdict, string> = {
  non_statue: "À statuer",
  valide: "Validé",
  reserve: "Réserves",
  refus: "Refusé",
};

// Boutons de verdict — une seule source de vérité : la clé EST le PVVerdict,
// utilisée à la fois pour la logique, la classe CSS et l'état actif (évite le
// bug du legacy où classes JS et sélecteurs CSS divergeaient).
const VERDICT_BTNS: { key: PVVerdict; label: string; icon: string }[] = [
  { key: "valide", label: "Validé", icon: "check" },
  { key: "reserve", label: "Avec réserves", icon: "alert-triangle" },
  { key: "refus", label: "Refusé", icon: "x" },
];

// ─── Board responsive : sommaire (toujours rendu) + détail (lot sélectionné).
// Un seul état (`selectedLotId`). Le CSS décide : mobile = le détail REMPLACE
// le sommaire (.has-selection) ; desktop = les deux côte à côte. ───
function PvBoard({
  lignes,
  fromDevis,
  selectedLotId,
  onSelect,
  onBack,
  onVerdict,
  onAddReserve,
  onReserveTexte,
  onRemoveReserve,
  onAddPhoto,
  onRemovePhoto,
}: {
  lignes: PVLigne[];
  fromDevis: boolean;
  selectedLotId: LotId | null;
  onSelect: (lotId: LotId) => void;
  onBack: () => void;
  onVerdict: (lotId: LotId, verdict: PVVerdict) => void;
  onAddReserve: (lotId: LotId) => void;
  onReserveTexte: (lotId: LotId, reserveId: string, texte: string) => void;
  onRemoveReserve: (lotId: LotId, reserveId: string) => void;
  onAddPhoto: (lotId: LotId, reserveId: string, file: File) => Promise<void>;
  onRemovePhoto: (lotId: LotId, reserveId: string, key: string) => void;
}) {
  if (lignes.length === 0) {
    return (
      <div className="pv-notice">
        Aucun lot à réceptionner. {fromDevis ? "Le devis signé n'a aucun lot actif." : ""}
      </div>
    );
  }
  const total = lignes.length;
  const statues = lignes.filter((l) => l.verdict !== "non_statue").length;
  const pct = Math.round((statues / total) * 100);
  const index = selectedLotId
    ? lignes.findIndex((l) => l.lotId === selectedLotId)
    : -1;
  const selected = index >= 0 ? lignes[index] : null;
  const goPrev = () => {
    if (index > 0) onSelect(lignes[index - 1].lotId);
  };
  const goNext = () => {
    if (index >= 0 && index < total - 1) onSelect(lignes[index + 1].lotId);
  };

  return (
    <div className={`pv-board${selectedLotId ? " has-selection" : ""}`}>
      <aside className="pv-summary">
        <div className="pv-sum-head">
          <h2 className="pv-section-title">Lots</h2>
          <span className="pv-count">{total}</span>
        </div>
        <div className="pv-progress" role="status">
          <div className="pv-progress-bar" aria-hidden="true">
            <div className="pv-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="pv-progress-txt">
            {statues} sur {total} lots statués
          </span>
        </div>
        <div className="pv-sumlist">
          {lignes.map((ligne) => (
            <SummaryRow
              key={ligne.lotId}
              ligne={ligne}
              active={ligne.lotId === selectedLotId}
              onClick={() => onSelect(ligne.lotId)}
            />
          ))}
        </div>
      </aside>

      <section className="pv-detail-col">
        {selected ? (
          <LotDetail
            ligne={selected}
            index={index}
            total={total}
            onBack={onBack}
            onPrev={goPrev}
            onNext={goNext}
            onVerdict={onVerdict}
            onAddReserve={onAddReserve}
            onReserveTexte={onReserveTexte}
            onRemoveReserve={onRemoveReserve}
            onAddPhoto={onAddPhoto}
            onRemovePhoto={onRemovePhoto}
          />
        ) : (
          <div className="pv-detail-empty">Sélectionnez un lot.</div>
        )}
      </section>
    </div>
  );
}

// ─── Ligne du sommaire : label + icône + pastille d'état + nb de réserves ───
function SummaryRow({
  ligne,
  active,
  onClick,
}: {
  ligne: PVLigne;
  active: boolean;
  onClick: () => void;
}) {
  const meta = LM_BY_ID.get(ligne.lotId);
  const nbReserves =
    ligne.verdict === "reserve" || ligne.verdict === "refus"
      ? ligne.reserves.length
      : 0;
  return (
    <button
      type="button"
      className={`pv-row${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-current={active}
    >
      <span className="pv-row-ic" aria-hidden="true">
        <i className={`ti ti-${meta?.icon ?? "point"}`} />
      </span>
      <span className="pv-row-body">
        <span className="pv-row-label">{meta?.label ?? ligne.lotId}</span>
        {nbReserves > 0 ? (
          <span className="pv-row-sub">
            {nbReserves} réserve{nbReserves > 1 ? "s" : ""}
          </span>
        ) : null}
      </span>
      <span className={`pv-pill v-${ligne.verdict}`}>
        {VERDICT_PILL[ligne.verdict]}
      </span>
    </button>
  );
}

// ─── Détail d'un lot : en-tête (position, retour, préc/suiv + swipe) + bloc
// verdict (D2) + réserves (D3). Le bloc lot est repris à l'identique. ───
function LotDetail({
  ligne,
  index,
  total,
  onBack,
  onPrev,
  onNext,
  onVerdict,
  onAddReserve,
  onReserveTexte,
  onRemoveReserve,
  onAddPhoto,
  onRemovePhoto,
}: {
  ligne: PVLigne;
  index: number;
  total: number;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onVerdict: (lotId: LotId, verdict: PVVerdict) => void;
  onAddReserve: (lotId: LotId) => void;
  onReserveTexte: (lotId: LotId, reserveId: string, texte: string) => void;
  onRemoveReserve: (lotId: LotId, reserveId: string) => void;
  onAddPhoto: (lotId: LotId, reserveId: string, file: File) => Promise<void>;
  onRemovePhoto: (lotId: LotId, reserveId: string, key: string) => void;
}) {
  const meta = LM_BY_ID.get(ligne.lotId);
  const showReserves = ligne.verdict === "reserve" || ligne.verdict === "refus";

  // Swipe (mobile) : touch events, sans dépendance. On IGNORE le geste s'il
  // démarre sur une zone de saisie/scroll (textarea, input, bande photos), et
  // on ne navigue que si l'horizontal domine nettement le vertical.
  const swipe = useRef<{ x: number; y: number; skip: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const skip = !!t.closest?.("textarea, input, .pv-photos");
    const p = e.touches[0];
    swipe.current = { x: p.clientX, y: p.clientY, skip };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.skip) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onNext();
      else onPrev();
    }
  };

  return (
    <div className="pv-detail" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="pv-detail-head">
        <button type="button" className="pv-detail-back" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Tous les lots
        </button>
        <span className="pv-detail-pos">
          Lot {index + 1} sur {total}
        </span>
        <div className="pv-detail-nav">
          <button
            type="button"
            onClick={onPrev}
            disabled={index === 0}
            aria-label="Lot précédent"
          >
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={index === total - 1}
            aria-label="Lot suivant"
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={`pv-lot-card v-${ligne.verdict}`}>
        <div className="pv-lot-head">
          <span className="pv-lot-ic" aria-hidden="true">
            <i className={`ti ti-${meta?.icon ?? "point"}`} />
          </span>
          <span className="pv-lot-body">
            <span className="pv-lot-label">{meta?.label ?? ligne.lotId}</span>
            {meta?.sub ? <span className="pv-lot-sub">{meta.sub}</span> : null}
          </span>
          {ligne.verdict === "non_statue" ? (
            <span className="pv-lot-todo">À statuer</span>
          ) : null}
        </div>

        <div className="pv-verdicts" role="group" aria-label="Verdict du lot">
          {VERDICT_BTNS.map((v) => {
            const active = ligne.verdict === v.key;
            return (
              <button
                key={v.key}
                type="button"
                className={`pv-vbtn pv-vbtn-${v.key}${active ? " is-active" : ""}`}
                aria-pressed={active}
                onClick={() => onVerdict(ligne.lotId, v.key)}
              >
                <i className={`ti ti-${v.icon}`} aria-hidden="true" />
                {v.label}
              </button>
            );
          })}
        </div>

        {showReserves ? (
          <ReserveSection
            ligne={ligne}
            onAddReserve={onAddReserve}
            onReserveTexte={onReserveTexte}
            onRemoveReserve={onRemoveReserve}
            onAddPhoto={onAddPhoto}
            onRemovePhoto={onRemovePhoto}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── Bloc réserves d'un lot (verdict reserve/refus) ───
function ReserveSection({
  ligne,
  onAddReserve,
  onReserveTexte,
  onRemoveReserve,
  onAddPhoto,
  onRemovePhoto,
}: {
  ligne: PVLigne;
  onAddReserve: (lotId: LotId) => void;
  onReserveTexte: (lotId: LotId, reserveId: string, texte: string) => void;
  onRemoveReserve: (lotId: LotId, reserveId: string) => void;
  onAddPhoto: (lotId: LotId, reserveId: string, file: File) => Promise<void>;
  onRemovePhoto: (lotId: LotId, reserveId: string, key: string) => void;
}) {
  return (
    <div className="pv-reserves">
      {ligne.reserves.map((reserve, i) => (
        <ReserveItem
          key={reserve.id}
          index={i}
          lotId={ligne.lotId}
          reserve={reserve}
          onReserveTexte={onReserveTexte}
          onRemoveReserve={onRemoveReserve}
          onAddPhoto={onAddPhoto}
          onRemovePhoto={onRemovePhoto}
        />
      ))}
      <button
        type="button"
        className="pv-add-reserve"
        onClick={() => onAddReserve(ligne.lotId)}
      >
        <i className="ti ti-plus" aria-hidden="true" />
        Ajouter une réserve
      </button>
    </div>
  );
}

// ─── Une réserve : texte + photos + suppression ───
function ReserveItem({
  index,
  lotId,
  reserve,
  onReserveTexte,
  onRemoveReserve,
  onAddPhoto,
  onRemovePhoto,
}: {
  index: number;
  lotId: LotId;
  reserve: PVReserve;
  onReserveTexte: (lotId: LotId, reserveId: string, texte: string) => void;
  onRemoveReserve: (lotId: LotId, reserveId: string) => void;
  onAddPhoto: (lotId: LotId, reserveId: string, file: File) => Promise<void>;
  onRemovePhoto: (lotId: LotId, reserveId: string, key: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // réautorise la re-sélection du même fichier
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of files) await onAddPhoto(lotId, reserve.id, f);
    } catch {
      setError("Photo non ajoutée — réessaie.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pv-reserve">
      <div className="pv-reserve-head">
        <span className="pv-reserve-num">Réserve {index + 1}</span>
        <button
          type="button"
          className="pv-reserve-del"
          onClick={() => onRemoveReserve(lotId, reserve.id)}
          aria-label="Supprimer la réserve"
        >
          <i className="ti ti-trash" aria-hidden="true" />
        </button>
      </div>

      <textarea
        className="pv-reserve-text"
        placeholder="Décrire la réserve"
        value={reserve.texte}
        rows={2}
        onChange={(e) => onReserveTexte(lotId, reserve.id, e.target.value)}
      />

      <div className="pv-photos">
        {reserve.photoIds.map((key) => (
          <PhotoThumb
            key={key}
            photoId={key}
            onRemove={() => onRemovePhoto(lotId, reserve.id, key)}
          />
        ))}
        <button
          type="button"
          className="pv-add-photo"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <i className="ti ti-loader-2 pv-spin" aria-hidden="true" />
          ) : (
            <i className="ti ti-camera-plus" aria-hidden="true" />
          )}
          <span>{uploading ? "Ajout…" : "Ajouter une photo"}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="pv-file-input"
          onChange={onFiles}
        />
      </div>
      {error ? <div className="pv-photo-err">{error}</div> : null}
    </div>
  );
}

// ─── Miniature photo : possède son objectURL et le révoque au démontage ───
function PhotoThumb({
  photoId,
  onRemove,
}: {
  photoId: string;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    getPhotoUrl(photoId)
      .then((u) => {
        if (alive) {
          created = u;
          setUrl(u);
        } else {
          revokePhotoUrl(u); // démonté avant résolution → pas de fuite
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (created) revokePhotoUrl(created);
    };
  }, [photoId]);

  return (
    <div className="pv-thumb">
      {url ? (
        <img src={url} alt="" className="pv-thumb-img" />
      ) : failed ? (
        <span className="pv-thumb-broken" aria-label="Photo indisponible">
          <i className="ti ti-photo-off" aria-hidden="true" />
        </span>
      ) : (
        <span className="pv-thumb-loading" aria-hidden="true">
          <i className="ti ti-loader-2 pv-spin" />
        </span>
      )}
      <button
        type="button"
        className="pv-thumb-del"
        onClick={onRemove}
        aria-label="Supprimer la photo"
      >
        <i className="ti ti-x" aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Sélecteur de lots (cas B : pas de devis signé) ───
function LotSelector({
  selected,
  onToggle,
  onStart,
  starting,
}: {
  selected: Set<LotId>;
  onToggle: (id: LotId) => void;
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <section className="pv-section">
      <div className="pv-selector-intro">
        Aucun devis signé pour ce chantier. Sélectionne les lots à réceptionner.
      </div>
      <div className="pv-pick-list">
        {LM.map((meta) => {
          const on = selected.has(meta.id);
          return (
            <button
              key={meta.id}
              type="button"
              className={`pv-pick-card${on ? " is-selected" : ""}`}
              onClick={() => onToggle(meta.id)}
              aria-pressed={on}
            >
              <span className="pv-lot-ic" aria-hidden="true">
                <i className={`ti ti-${meta.icon}`} />
              </span>
              <span className="pv-lot-body">
                <span className="pv-lot-label">{meta.label}</span>
                <span className="pv-lot-sub">{meta.sub}</span>
              </span>
              <span className="pv-pick-check" aria-hidden="true">
                {on ? <i className="ti ti-check" /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="pv-start-btn"
        onClick={onStart}
        disabled={selected.size === 0 || starting}
      >
        {starting
          ? "Création…"
          : `Démarrer la réception${selected.size > 0 ? ` (${selected.size})` : ""}`}
      </button>
    </section>
  );
}
