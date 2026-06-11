"use client";

// ============================================================
// SOCLE — DevisEditorEngine (P3)
//
// Shell 3 colonnes autour du moteur engine (P1+P2). Aucun configurateur
// détaillé par lot (ça vient en P4) : ici on rend :
//   - Colonne gauche : 15 lots cliquables (clic = active+sélectionne).
//   - Colonne centre : réglages communs du lot courant (surface/marge/MO/
//     coutRevientPoints/TVA) + placeholder P4 + <details> debug
//     listant les lignes auto-générées par calcItems.
//   - Colonne droite : récap temps réel via calcEngineTotaux (client +
//     interne artisan). 1ʳᵉ alerte tauxHoraireManquant câblée ici.
// Bandeau entête repliable au-dessus, topbar fine sticky.
// Sauvegarde auto + création différée comme C1 (hérité du workflow).
// ============================================================

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import Link from "next/link";
import { repository } from "@/lib/devis/repository";
import { calcEngineTotaux } from "@/lib/devis/engine/totals";
import {
  agregerLignesClient,
  calcClientTotaux,
  hasAggregateur,
} from "@/lib/devis/engine/agregation";
import {
  LM,
  LOTS_NO_SURF,
  createInitialEngineState,
} from "@/lib/devis/engine/lots";
import CarrelageConfigBox from "./configurateurs/CarrelageConfigBox";
import CloisonsConfigBox from "./configurateurs/CloisonsConfigBox";
import FaienceConfigBox from "./configurateurs/FaienceConfigBox";
import FauxPlafondConfigBox from "./configurateurs/FauxPlafondConfigBox";
import ItiConfigBox from "./configurateurs/ItiConfigBox";
import ParquetConfigBox from "./configurateurs/ParquetConfigBox";
import PeintureConfigBox from "./configurateurs/PeintureConfigBox";
import ElecConfigBox from "./configurateurs/ElecConfigBox";
import SegmentCards from "./configurateurs/SegmentCards";
import PointsLignesView from "./configurateurs/PointsLignesView";
import LignesLibres from "./configurateurs/LignesLibres";
import LotReglages from "./configurateurs/LotReglages";
import type { SegmentConfigBoxProps } from "./configurateurs/segment-config";
import type {
  EngineState,
  LigneLibre,
  LotId,
  LotLibre,
  LotState,
  SegmentBase,
} from "@/lib/devis/engine/types";
import { formatEuro } from "@/lib/devis/format";
import { STATUT_LABEL } from "@/lib/devis/devis-status";
import { TAUX_TVA } from "@/lib/devis/types";
import type {
  Chantier,
  Client,
  ClientInput,
  ClientSnapshot,
  ClientType,
  Devis,
  DevisInput,
  DevisStatut,
  Entreprise,
  TauxTVA,
} from "@/lib/devis/types";
import "./devis-editor-engine.css";

// Lots à points (où coutRevientPoints fait sens — démolition 100% prix
// ferme + élec hybride avec catalogue de 31 prestations).
const LOTS_AVEC_POINTS = new Set<LotId>(["demolition", "elec"]);

// Lots à modèle "segments" (patron cloisons) : registre lot → box de config.
// L'éditeur les branche génériquement (config zone + section devis), sans code
// en dur par lot. Ajouter un lot = une entrée ici.
const SEGMENT_LOTS: Partial<
  Record<LotId, { ConfigBox: ComponentType<SegmentConfigBoxProps> }>
> = {
  cloisons: { ConfigBox: CloisonsConfigBox },
  fauxplafond: { ConfigBox: FauxPlafondConfigBox },
  iti: { ConfigBox: ItiConfigBox },
  peinture: { ConfigBox: PeintureConfigBox },
  parquet: { ConfigBox: ParquetConfigBox },
  carrelage: { ConfigBox: CarrelageConfigBox },
  faience: { ConfigBox: FaienceConfigBox },
};

type SaveStatus = "idle" | "saving" | "saved" | "dirty";

interface Props {
  devisId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────
// Garde-fou NaN : toute valeur non finie (lot vide, division par 0…) → 0.
const safe = (n?: number): number =>
  typeof n === "number" && Number.isFinite(n) ? n : 0;
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
    dateDebutPrevue: null,
    dateFinPrevue: null,
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
    dateDebutPrevue: d.dateDebutPrevue,
    dateFinPrevue: d.dateFinPrevue,
    chantierId: d.chantierId,
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
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);
  // `cur` = sélection courante. String (pas LotId strict) : peut porter l'id
  // d'un lot LIBRE en plus des 15 lots moteur (sélection bidirectionnelle).
  const [cur, setCur] = useState<string>("demolition");
  const [enteteModal, setEnteteModal] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [clientModal, setClientModal] = useState(false);
  const [clientForm, setClientForm] = useState<ClientInput>(emptyClientForm());

  // Vue globale : refs des sections de lot (scroll-vers-ancre) + sections
  // repliées (collapse par lot).
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const devisScrollRef = useRef<HTMLDivElement | null>(null);
  // Garde-fou anti-boucle : true = le prochain changement de `cur` doit scroller
  // le devis vers la section (sélection DEPUIS la colonne gauche). false =
  // sélection DEPUIS le devis (clic sur une section) → ne pas re-scroller la
  // section qu'on vient de cliquer. L'effet consomme et remet à false.
  const scrollOnCurChange = useRef(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set()
  );
  // Repli de la box de configuration du lot (réglages + configurateur). Un seul
  // booléen : le centre n'affiche qu'un lot à la fois. Réouvert au changement de
  // lot sélectionné (cf. effet sur `cur`).
  const [cfgOpen, setCfgOpen] = useState(true);

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
          // Adresse de chantier en lecture seule : on résout le Chantier
          // parent via la jointure inverse (null si aucun chantierId).
          const ch = await repository.chantiers.ofDevis(devisId);
          if (alive) setChantier(ch);
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

  // Scroll vers la section du lot courant quand `cur` change (ancres gauche).
  // On scrolle UNIQUEMENT le conteneur interne `.dee-devis` (pas scrollIntoView
  // qui remonterait jusqu'à la fenêtre et ferait sortir la zone config du haut).
  useEffect(() => {
    if (!loaded) return;
    // N'auto-scroller QUE si la sélection vient de la colonne gauche. Un clic
    // dans le devis (selectFromDevis) pose le flag à false : la section est
    // déjà sous le curseur, pas de saut brutal.
    if (!scrollOnCurChange.current) return;
    scrollOnCurChange.current = false;
    const container = devisScrollRef.current;
    const el = sectionRefs.current[cur];
    if (!container || !el) return;
    const top =
      el.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  }, [cur, loaded]);

  // Box de config réouverte à chaque changement de lot sélectionné (saisie
  // immédiate). L'artisan replie manuellement via le chevron de l'en-tête.
  useEffect(() => {
    setCfgOpen(true);
  }, [cur]);

  function toggleSection(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  // Activation dissociée :
  // - Clic sur la ligne du lot → sélectionne ET active (jamais de toggle :
  //   recliquer un lot déjà actif ne le désactive pas). On ne patche `on`
  //   que s'il n'était pas déjà actif (évite une sauvegarde inutile).
  // - La case à cocher → sert UNIQUEMENT à retirer le lot (décocher = on:false).
  //   La config (surf/marge/MO/options/points/custom) est préservée : seul
  //   `lot.on` change, recliquer/recocher récupère tout.
  function onLotClick(lid: LotId) {
    scrollOnCurChange.current = true; // sélection gauche → on scrolle le devis
    setCur(lid);
    if (!draft.engine?.lots?.[lid]?.on) patchLot(lid, { on: true });
  }
  function onLotCheck(lid: LotId, checked: boolean) {
    patchLot(lid, { on: checked });
    if (checked) {
      scrollOnCurChange.current = true;
      setCur(lid);
    }
  }
  // Sélection DEPUIS le devis (clic sur une section). Pas de re-scroll : la
  // section est déjà visible (garde-fou anti-boucle).
  function selectFromDevis(id: string) {
    scrollOnCurChange.current = false;
    setCur(id);
  }

  // ── Configurateur générique "segments" (patron cloisons → faux-plafond…) ──
  // Manipule lot.o.lignes pour n'importe quel lot du registre SEGMENT_LOTS.
  function segO(lid: LotId): Record<string, unknown> {
    return draft.engine?.lots?.[lid]?.o ?? {};
  }
  function segLignes(lid: LotId): SegmentBase[] {
    const l = segO(lid).lignes;
    return Array.isArray(l) ? (l as SegmentBase[]) : [];
  }
  function setSegLignes(lid: LotId, lignes: SegmentBase[]) {
    patchLot(lid, { o: { ...segO(lid), lignes } });
  }
  function patchLotO(lid: LotId, patch: Record<string, unknown>) {
    patchLot(lid, { o: { ...segO(lid), ...patch } });
  }
  // ── Override ponctuel d'un point (lot à points : prix/libellé sur CE devis).
  function pointsOverrideOf(
    lid: LotId
  ): Record<string, { pu?: number; lbl?: string }> {
    const ov = segO(lid).pointsOverride;
    return ov && typeof ov === "object"
      ? (ov as Record<string, { pu?: number; lbl?: string }>)
      : {};
  }
  function updatePointOverride(
    lid: LotId,
    pid: string,
    patch: { pu?: number; lbl?: string }
  ) {
    const cur = pointsOverrideOf(lid);
    patchLotO(lid, {
      pointsOverride: { ...cur, [pid]: { ...cur[pid], ...patch } },
    });
  }
  function resetPointOverride(lid: LotId, pid: string) {
    const next = { ...pointsOverrideOf(lid) };
    delete next[pid];
    patchLotO(lid, { pointsOverride: next });
  }
  function makeSegId(): string {
    return "seg_" + Math.random().toString(36).slice(2, 10);
  }
  // Ajout AVEC cumul : un segment configuré de signature identique (toutes les
  // dims de config sauf m2) voit ses m² additionnés. Générique (la signature
  // = les clés du cfg remonté par la box, hors m2).
  function addSegment(lid: LotId, cfg: Record<string, unknown>) {
    const lignes = segLignes(lid);
    const keys = Object.keys(cfg).filter((k) => k !== "m2");
    const idx = lignes.findIndex(
      (s) =>
        s.type !== "libre" &&
        keys.every(
          (k) => (s as unknown as Record<string, unknown>)[k] === cfg[k]
        )
    );
    if (idx >= 0) {
      const next = lignes.slice();
      next[idx] = {
        ...next[idx],
        m2: (Number(next[idx].m2) || 0) + (Number(cfg.m2) || 0),
      };
      setSegLignes(lid, next);
    } else {
      setSegLignes(lid, [
        ...lignes,
        { ...(cfg as object), id: makeSegId() } as SegmentBase,
      ]);
    }
  }
  function addSegmentLibre(lid: LotId) {
    setSegLignes(lid, [
      ...segLignes(lid),
      { id: makeSegId(), type: "libre", m2: 1, lbl: "", unit: "u", puOverride: 0 },
    ]);
  }
  function updateSegment(lid: LotId, id: string, patch: Partial<SegmentBase>) {
    setSegLignes(
      lid,
      segLignes(lid).map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }
  function removeSegment(lid: LotId, id: string) {
    setSegLignes(
      lid,
      segLignes(lid).filter((s) => s.id !== id)
    );
  }

  // ── Lignes libres (jalon 3) — id stable, additif, prix ferme ─────────
  function makeLibreId(): string {
    return "lib_" + Math.random().toString(36).slice(2, 10);
  }
  function emptyLigneLibre(): LigneLibre {
    return { id: makeLibreId(), lbl: "", qty: 1, unit: "u", pu: 0 };
  }

  // (a) Lignes libres d'un lot PRÉDÉFINI (LotState.lignesLibres).
  function lotLignesLibres(lid: LotId): LigneLibre[] {
    return draft.engine?.lots?.[lid]?.lignesLibres ?? [];
  }
  function addLotLigneLibre(lid: LotId) {
    patchLot(lid, { lignesLibres: [...lotLignesLibres(lid), emptyLigneLibre()] });
  }
  function updateLotLigneLibre(
    lid: LotId,
    ligneId: string,
    patch: Partial<LigneLibre>
  ) {
    patchLot(lid, {
      lignesLibres: lotLignesLibres(lid).map((l) =>
        l.id === ligneId ? { ...l, ...patch } : l
      ),
    });
  }
  function removeLotLigneLibre(lid: LotId, ligneId: string) {
    patchLot(lid, {
      lignesLibres: lotLignesLibres(lid).filter((l) => l.id !== ligneId),
    });
  }

  // (b) Lots LIBRES (EngineState.lotsLibres) — titre + lignes manuelles.
  function setLotsLibres(updater: (prev: LotLibre[]) => LotLibre[]) {
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
        engine: { ...base, lotsLibres: updater(base.lotsLibres ?? []) },
      };
    });
    scheduleSave();
  }
  function addLotLibre() {
    setLotsLibres((prev) => [
      ...prev,
      {
        id: "ll_" + Math.random().toString(36).slice(2, 10),
        titre: "",
        lignes: [emptyLigneLibre()],
      },
    ]);
  }
  function updateLotLibreTitre(lotId: string, titre: string) {
    setLotsLibres((prev) =>
      prev.map((l) => (l.id === lotId ? { ...l, titre } : l))
    );
  }
  function removeLotLibre(lotId: string) {
    setLotsLibres((prev) => prev.filter((l) => l.id !== lotId));
    // Si on retire le lot libre actuellement sélectionné, rebascule la
    // sélection sur un lot prédéfini actif (ou démolition par défaut).
    if (cur === lotId) {
      const firstActive = (Object.keys(draft.engine?.lots ?? {}) as LotId[]).find(
        (k) => draft.engine?.lots?.[k]?.on
      );
      scrollOnCurChange.current = false;
      setCur(firstActive ?? "demolition");
    }
  }
  function addLotLibreLigne(lotId: string) {
    setLotsLibres((prev) =>
      prev.map((l) =>
        l.id === lotId
          ? { ...l, lignes: [...l.lignes, emptyLigneLibre()] }
          : l
      )
    );
  }
  function updateLotLibreLigne(
    lotId: string,
    ligneId: string,
    patch: Partial<LigneLibre>
  ) {
    setLotsLibres((prev) =>
      prev.map((l) =>
        l.id === lotId
          ? {
              ...l,
              lignes: l.lignes.map((x) =>
                x.id === ligneId ? { ...x, ...patch } : x
              ),
            }
          : l
      )
    );
  }
  function removeLotLibreLigne(lotId: string, ligneId: string) {
    setLotsLibres((prev) =>
      prev.map((l) =>
        l.id === lotId
          ? { ...l, lignes: l.lignes.filter((x) => x.id !== ligneId) }
          : l
      )
    );
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
      entreprise?.tauxHoraire ?? 0,
      draft.regimeTVA ?? "tva"
    );
  }, [
    draft.engine,
    draft.globalSurf,
    draft.tvaParDefaut,
    draft.remiseMode,
    draft.remiseValeur,
    draft.regimeTVA,
    entreprise,
  ]);

  // Totaux CLIENT (override-aware) : HT d'un lot à agrégateur = somme des
  // lignes client. Sans puOverride → identique aux totaux moteur.
  const clientTotaux = useMemo(() => {
    if (!draft.engine || !totaux) return null;
    return calcClientTotaux(
      {
        ...draft.engine,
        globalSurf: draft.globalSurf ?? 0,
        tvaParDefaut: draft.tvaParDefaut ?? 10,
        remiseMode: draft.remiseMode,
        remiseValeur: draft.remiseValeur,
      },
      totaux
    );
  }, [
    draft.engine,
    draft.globalSurf,
    draft.tvaParDefaut,
    draft.remiseMode,
    draft.remiseValeur,
    totaux,
  ]);

  // Sections de la vue devis = [lots LM actifs, ...lots libres]. Un seul
  // tableau combiné → numérotation CONTINUE X.0 (l'index du map = numéro).
  // Les lots libres s'ajoutent EN FIN de séquence, sans rompre la suite des
  // numéros des lots prédéfinis. (Jalon 3.)
  const sections = useMemo<
    Array<
      | {
          kind: "lot";
          id: LotId;
          meta: (typeof LM)[number];
          lignes: ReturnType<typeof agregerLignesClient>;
          lignesLibres: LigneLibre[];
          tva: number;
        }
      | { kind: "libre"; id: string; lot: LotLibre; tva: number }
    >
  >(() => {
    if (!draft.engine || !totaux) return [];
    const synced: EngineState = {
      ...draft.engine,
      globalSurf: draft.globalSurf ?? 0,
      tvaParDefaut: draft.tvaParDefaut ?? 10,
      remiseMode: draft.remiseMode,
      remiseValeur: draft.remiseValeur,
    };
    const predef = LM.filter((m) => synced.lots[m.id].on).map((meta) => {
      const lt = totaux.parLot.find((l) => l.lotId === meta.id)!;
      return {
        kind: "lot" as const,
        id: meta.id,
        meta,
        lignes: agregerLignesClient(synced, lt),
        lignesLibres: synced.lots[meta.id].lignesLibres ?? [],
        tva: synced.lots[meta.id].tva ?? synced.tvaParDefaut,
      };
    });
    const libres = (synced.lotsLibres ?? []).map((lot) => ({
      kind: "libre" as const,
      id: lot.id,
      lot,
      tva: synced.tvaParDefaut,
    }));
    return [...predef, ...libres];
  }, [
    draft.engine,
    draft.globalSurf,
    draft.tvaParDefaut,
    draft.remiseMode,
    draft.remiseValeur,
    totaux,
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

  // `cur` peut être un lot prédéfini (LM) ou un lot libre. lotMeta n'existe
  // que pour les lots prédéfinis ; curLibre pour un lot libre sélectionné.
  const lotMeta = LM.find((l) => l.id === cur);
  const curLot = lotMeta ? draft.engine?.lots?.[lotMeta.id] : undefined;
  const curLibre = !lotMeta
    ? (draft.engine?.lotsLibres ?? []).find((l) => l.id === cur)
    : undefined;

  // Résumé affiché dans la barre d'en-tête (repliée) pour donner le contexte
  // d'un coup d'œil sans déplier.
  const clientNom = draft.clientSnapshot
    ? [draft.clientSnapshot.prenom, draft.clientSnapshot.nom]
        .filter(Boolean)
        .join(" ")
        .trim() || draft.clientSnapshot.nom
    : null;

  // Navigation centrée chantier : le retour ramène au dossier chantier
  // d'origine (devis.chantierId), pas à la liste globale des devis. Fallback
  // sur la liste des chantiers si le devis n'a pas de chantier rattaché
  // (cas résiduel — la création hors chantier est supprimée).
  const retourHref = draft.chantierId
    ? `/chantiers/${draft.chantierId}`
    : "/chantiers";

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
        <Link href={retourHref} className="dee-topbar-back">
          <i className="ti ti-chevron-left" /> Retour au chantier
        </Link>
        <span className="dee-topbar-num">{numero ?? "—"}</span>
        <button
          type="button"
          className="dee-entete-btn"
          onClick={() => setEnteteModal(true)}
          title="Ouvrir l'en-tête du devis"
        >
          <i className="ti ti-clipboard-text dee-entete-btn-icon" aria-hidden="true" />
          {clientNom ? (
            <span className="dee-entete-btn-summary">
              <span>
                <em>Client</em> {clientNom}
              </span>
            </span>
          ) : (
            <span className="dee-entete-btn-label">Client &amp; réglages</span>
          )}
          <i className="ti ti-pencil dee-entete-btn-edit" aria-hidden="true" />
        </button>
        {/* Titre en lecture seule : il se définit à la finalisation (source unique). */}
        <span className="dee-topbar-titre-ro" title={draft.titre || undefined}>
          {draft.titre || (
            <em className="dee-topbar-titre-ph">Titre — à définir à la finalisation</em>
          )}
        </span>
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
              href={`/chantier/devis/${id}/finaliser`}
              className="dee-btn dee-btn-primary"
              title="Habiller le devis et l'exporter"
            >
              Finaliser <i className="ti ti-arrow-right" aria-hidden="true" />
            </Link>
          ) : (
            <button
              className="dee-btn dee-btn-primary"
              disabled
              title="Sauvegarde en cours…"
            >
              Finaliser
            </button>
          )}
        </div>
      </header>

      {enteteModal && (
        <div className="dee-modal-bg" onClick={() => setEnteteModal(false)}>
          <div
            className="dee-modal dee-modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              <i className="ti ti-clipboard-text" aria-hidden="true" /> Client
              &amp; réglages de calcul
            </h3>
            <div className="dee-config-grid">
              <div className="dee-field col-full">
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
          {/* Adresse de chantier : lecture seule (portée par le Chantier parent). */}
          <div className="dee-field col-full">
            <label className="dee-field-label">Chantier</label>
            {chantier ? (
              <div className="dee-readonly">
                <span className="dee-readonly-strong">{chantier.nom}</span>
                {chantier.adresse && <span>{chantier.adresse}</span>}
                {(chantier.codePostal || chantier.ville) && (
                  <span>
                    {chantier.codePostal} {chantier.ville}
                  </span>
                )}
                <span className="dee-readonly-hint">
                  Adresse gérée depuis le chantier — non modifiable ici.
                </span>
              </div>
            ) : (
              <div className="dee-readonly is-empty">
                Aucun chantier rattaché. L&apos;adresse proviendra du chantier
                depuis lequel le devis est ouvert.
              </div>
            )}
          </div>
          <div className="dee-field col-full">
            <div className="dee-readonly-hint" style={{ marginTop: 0 }}>
              Objet, dates, remise, acomptes, message d&apos;introduction et
              notes se règlent à la <strong>finalisation</strong>.
            </div>
          </div>
            </div>
            <div className="dee-modal-actions">
              <button
                type="button"
                className="dee-btn dee-btn-primary"
                onClick={() => setEnteteModal(false)}
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="dee-cols">
        {/* ── COLONNE GAUCHE : 15 lots (Option B : check + nom) ──── */}
        <aside className="dee-cols-left">
          <div className="dee-col-head">
            <i className="ti ti-layout-list" aria-hidden="true" />
            <span>Lots du devis</span>
          </div>
          <ul className="dee-lot-list">
            {LM.map((meta) => {
              const lt = totaux?.parLot.find((l) => l.lotId === meta.id);
              const isOn = lt?.active ?? false;
              const isCurrent = cur === meta.id;
              // HT client du lot (override-aware) ; vert affiché si > 0.
              const lotHT =
                clientTotaux?.parLotClientHT[meta.id] ?? lt?.caLot ?? 0;
              const hasMontant = isOn && lotHT > 0;
              return (
                <li key={meta.id}>
                  <div
                    className={`dee-lot-row${isOn ? " is-on" : ""}${
                      isCurrent ? " is-current" : ""
                    }`}
                    onClick={() => onLotClick(meta.id)}
                  >
                    <label
                      className="dee-lot-check"
                      aria-label={
                        isOn
                          ? `Retirer ${meta.label} du devis`
                          : `Inclure ${meta.label} dans le devis`
                      }
                      // La case ne sert qu'à retirer le lot : on stoppe la
                      // propagation pour que le clic ne ré-active pas via la ligne.
                      onClick={(e) => e.stopPropagation()}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onLotClick(meta.id);
                      }}
                    >
                      <span className="dee-lot-icon" aria-hidden="true">
                        <i className={`ti ti-${meta.icon}`} />
                      </span>
                      <span className="dee-lot-text">
                        <span className="dee-lot-label">{meta.label}</span>
                        {meta.sub && (
                          <span className="dee-lot-sub">{meta.sub}</span>
                        )}
                      </span>
                    </button>
                    {hasMontant && (
                      <span className="dee-lot-total">
                        {formatEuro(lotHT)}
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
              {formatEuro(clientTotaux?.totalTTC ?? 0)}
            </div>
          </div>
        </aside>

        {/* ── COLONNE CENTRE : header inline compact + lignes du devis ── */}
        <section className="dee-cols-center">
          {/* ── ZONE CONFIGURATEUR (atelier) — panneau teinté, distinct ── */}
          <div className="dee-cfgzone">
          {lotMeta ? (
            curLot?.on ? (
              // UNE box repliable par lot : en-tête (titre + chevron, cliquable)
              // → corps = réglages partagés (LotReglages) + configurateur du lot.
              // Replier masque TOUT (réglages compris) → hauteur récupérée.
              <div className="dee-cfg-box">
                <button
                  type="button"
                  className="dee-cfg-box-head"
                  onClick={() => setCfgOpen((v) => !v)}
                  aria-expanded={cfgOpen}
                >
                  <i className="ti ti-tools dee-cfg-box-head-ic" aria-hidden="true" />
                  <span className="dee-cfg-box-title">
                    Configurer — {lotMeta.label}
                  </span>
                  <i
                    className={`ti ti-chevron-${cfgOpen ? "up" : "down"} dee-cfg-box-caret`}
                    aria-hidden="true"
                  />
                </button>
                {cfgOpen && (
                  <div className="dee-cfg-box-body">
                    <LotReglages
                      lot={curLot}
                      globalSurf={draft.globalSurf ?? 0}
                      showSurface={!LOTS_NO_SURF.has(lotMeta.id)}
                      showRevient={LOTS_AVEC_POINTS.has(lotMeta.id)}
                      onPatch={(p) => patchLot(lotMeta.id, p)}
                    />
                    {SEGMENT_LOTS[lotMeta.id] ? (
                      (() => {
                        const Cfg = SEGMENT_LOTS[lotMeta.id]!.ConfigBox;
                        return (
                          <Cfg
                            o={curLot.o}
                            onAdd={(cfg) => addSegment(lotMeta.id, cfg)}
                            onPatchO={(patch) => patchLotO(lotMeta.id, patch)}
                          />
                        );
                      })()
                    ) : lotMeta.id === "elec" ? (
                      <ElecConfigBox
                        o={curLot.o}
                        globalSurf={draft.globalSurf ?? 0}
                        onPatchO={(patch) => patchLotO("elec", patch)}
                      />
                    ) : (
                      <div className="dee-cfgzone-soon">
                        Configurateur « {lotMeta.label} » à venir — ajoutez des
                        lignes libres dans sa section ci-dessous.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="dee-cfgzone-off">
                <strong>{lotMeta.label}</strong> n&apos;est pas inclus. Cochez-le
                dans la colonne gauche pour l&apos;ajouter au devis.
              </div>
            )
          ) : curLibre ? (
            <>
              <div className="dee-config-head-inline">
                <h2 className="dee-config-name">
                  <i className="ti ti-tools dee-config-name-ic" aria-hidden="true" />
                  <span className="dee-config-name-pre">Configurer</span>
                  <span className="dee-config-name-lot">
                    {curLibre.titre || "Lot libre"}
                  </span>
                </h2>
              </div>
              <div className="dee-cfgzone-soon">
                Lot libre — son intitulé et ses lignes se composent directement
                dans le devis, dans sa section ci-dessous.
              </div>
            </>
          ) : (
            <div className="dee-cfgzone-soon">
              Sélectionnez un lot à gauche, ou une section dans le devis, pour
              le configurer ici.
            </div>
          )}
          </div>

          {/* ── ZONE DEVIS (résultat) — sobre/neutre, ce que verra le client ── */}
          <div className="dee-devis" ref={devisScrollRef}>
            <div className="dee-devis-eyebrow">Le devis</div>
            {sections.length === 0 && (
              <div className="dee-empty">
                <strong>Devis vide.</strong>
                <br />
                Cochez un lot dans la colonne gauche — ou ajoutez un lot libre
                ci-dessous — pour commencer.
              </div>
            )}
            {sections.map((entry, idx) => {
              const num = idx + 1;
              const collapsed = collapsedSections.has(entry.id);

              // ── Lot LIBRE (titre + lignes manuelles, prix ferme) ──────
              if (entry.kind === "libre") {
                const lot = entry.lot;
                const lotHT = safe(clientTotaux?.parLotClientHT[lot.id]);
                return (
                  <section
                    key={lot.id}
                    ref={(el) => {
                      sectionRefs.current[lot.id] = el;
                    }}
                    className={`dee-sec${
                      cur === lot.id ? " is-current" : ""
                    }${collapsed ? " is-collapsed" : ""}`}
                  >
                    <div className="dee-sec-eyebrow-libre">Lot libre</div>
                    {/* Clic sur l'en-tête (hors chevron/titre/corbeille) =
                        sélectionne le lot libre (sync ⇄ section). */}
                    <div
                      className="dee-sec-head dee-sec-head-libre"
                      onClick={() => selectFromDevis(lot.id)}
                    >
                      <button
                        type="button"
                        className="dee-sec-caret-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(lot.id);
                        }}
                        title={collapsed ? "Déplier" : "Replier"}
                      >
                        <i className="ti ti-chevron-right" aria-hidden="true" />
                      </button>
                      <span className="dee-sec-num">{num}.0</span>
                      <span className="dee-sec-icon">
                        <i className="ti ti-tag" aria-hidden="true" />
                      </span>
                      <input
                        className="dee-sec-titre-input"
                        value={lot.titre}
                        placeholder="Intitulé du lot"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          updateLotLibreTitre(lot.id, e.target.value)
                        }
                      />
                      <span className="dee-sec-fig">
                        <span className="dee-sec-fig-row">
                          <span className="dee-sec-fig-lbl">
                            Total de la prestation
                          </span>
                          <span className="dee-sec-fig-val">
                            {formatEuro(lotHT)}
                          </span>
                        </span>
                      </span>
                      <button
                        type="button"
                        className="dee-sec-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeLotLibre(lot.id);
                        }}
                        title="Retirer ce lot"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                    {!collapsed && (
                      <LignesLibres
                        lotIndex={num}
                        lignes={lot.lignes}
                        tva={entry.tva}
                        onAdd={() => addLotLibreLigne(lot.id)}
                        onUpdate={(id, patch) =>
                          updateLotLibreLigne(lot.id, id, patch)
                        }
                        onRemove={(id) => removeLotLibreLigne(lot.id, id)}
                        addLabel="Ajouter une ligne"
                      />
                    )}
                  </section>
                );
              }

              // ── Lot PRÉDÉFINI (moteur) ────────────────────────────────
              const { meta, lignes } = entry;
              const isCurrent = cur === meta.id;
              const lt = totaux?.parLot.find((l) => l.lotId === meta.id);
              const lotHT = safe(clientTotaux?.parLotClientHT[meta.id]);
              const marge = safe(lt?.margeDeboursé);
              const isSegmentLot = meta.id in SEGMENT_LOTS;
              return (
                <section
                  key={meta.id}
                  ref={(el) => {
                    sectionRefs.current[meta.id] = el;
                  }}
                  className={`dee-sec${isCurrent ? " is-current" : ""}${
                    collapsed ? " is-collapsed" : ""
                  }`}
                >
                  <div className="dee-sec-head">
                    {/* Chevron = SEUL toggle repli/dépli. */}
                    <button
                      type="button"
                      className="dee-sec-caret-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSection(meta.id);
                      }}
                      title={collapsed ? "Déplier" : "Replier"}
                    >
                      <i
                        className="ti ti-chevron-right dee-sec-caret"
                        aria-hidden="true"
                      />
                    </button>
                    {/* Reste de l'en-tête = SÉLECTIONNE le lot (sync ⇄ gauche). */}
                    <button
                      type="button"
                      className="dee-sec-head-sel"
                      onClick={() => selectFromDevis(meta.id)}
                    >
                      <span className="dee-sec-num">{num}.0</span>
                      <span className="dee-sec-icon">
                        <i className={`ti ti-${meta.icon}`} aria-hidden="true" />
                      </span>
                      <span className="dee-sec-name">{meta.label}</span>
                      <span className="dee-sec-fig">
                        <span className="dee-sec-fig-row">
                          <span className="dee-sec-fig-lbl">
                            Total de la prestation
                          </span>
                          <span className="dee-sec-fig-val">
                            {formatEuro(lotHT)}
                          </span>
                        </span>
                        <span className="dee-sec-fig-row is-marge">
                          <span className="dee-sec-fig-lbl">Marge</span>
                          <span className="dee-sec-fig-val">
                            {formatEuro(marge)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                  {/* Gate de rendu à 3 branches :
                      1. lot SEGMENTS → cartes éditables inline (SegmentCards).
                      2. lot À AGRÉGATEUR non-segments (élec…) → lignes client
                         agrégées en LECTURE SEULE (l'édition vit dans le
                         ConfigBox). Critère générique hasAggregateur(), pas de
                         "si élec" en dur : tout futur lot à points en profite.
                      3. sinon → lignes libres manuelles. */}
                  {!collapsed &&
                    (isSegmentLot ? (
                      lignes && lignes.length > 0 ? (
                        <SegmentCards
                          lotIndex={num}
                          segments={segLignes(meta.id)}
                          lignesClient={lignes}
                          onUpdate={(id, patch) =>
                            updateSegment(meta.id, id, patch)
                          }
                          onRemove={(id) => removeSegment(meta.id, id)}
                          onAddLibre={() => addSegmentLibre(meta.id)}
                        />
                      ) : (
                        <div className="dee-sec-empty">
                          Configurez ce lot pour ajouter des prestations.
                        </div>
                      )
                    ) : hasAggregateur(meta.id) ? (
                      // Lot à agrégateur (élec) : prestations agrégées en
                      // lecture seule + ajout de lignes libres en complément.
                      <>
                        {lignes && lignes.length > 0 ? (
                          <PointsLignesView
                            lotIndex={num}
                            lignesClient={lignes}
                            onOverride={(pid, patch) =>
                              updatePointOverride(meta.id, pid, patch)
                            }
                            onResetOverride={(pid) =>
                              resetPointOverride(meta.id, pid)
                            }
                          />
                        ) : (
                          <div className="dee-sec-empty">
                            Configurez ce lot dans le panneau ci-dessus pour
                            ajouter des prestations.
                          </div>
                        )}
                        <LignesLibres
                          lotIndex={num}
                          lignes={entry.lignesLibres}
                          tva={entry.tva}
                          onAdd={() => addLotLigneLibre(meta.id)}
                          onUpdate={(id, patch) =>
                            updateLotLigneLibre(meta.id, id, patch)
                          }
                          onRemove={(id) => removeLotLigneLibre(meta.id, id)}
                        />
                      </>
                    ) : (
                      // Autres lots : configurateur détaillé à venir → on
                      // garnit la section via des lignes libres (additif,
                      // prix ferme). Numérotation continue dans la section.
                      <LignesLibres
                        lotIndex={num}
                        lignes={entry.lignesLibres}
                        tva={entry.tva}
                        onAdd={() => addLotLigneLibre(meta.id)}
                        onUpdate={(id, patch) =>
                          updateLotLigneLibre(meta.id, id, patch)
                        }
                        onRemove={(id) => removeLotLigneLibre(meta.id, id)}
                      />
                    ))}
                </section>
              );
            })}
            <button
              type="button"
              className="dee-addlot"
              onClick={addLotLibre}
              title="Ajouter un lot libre au devis"
            >
              <i className="ti ti-plus" aria-hidden="true" /> Ajouter un lot
            </button>
          </div>
        </section>

        {/* ── COLONNE DROITE : récap temps réel ──────────────── */}
        <aside className="dee-cols-right">
          <div className="dee-col-head">
            <i className="ti ti-report-money" aria-hidden="true" />
            <span>Récapitulatif</span>
          </div>
          {totaux && clientTotaux && (
            <>
              <div className="dee-stat-cards">
                <div className="dee-stat-card">
                  <div className="dee-stat-label">Total HT</div>
                  <div className="dee-stat-value">
                    {formatEuro(clientTotaux.totalHT)}
                  </div>
                </div>
                <div className="dee-stat-card is-primary">
                  <div className="dee-stat-label">Total TTC</div>
                  <div className="dee-stat-value">
                    {formatEuro(clientTotaux.totalTTC)}
                  </div>
                </div>
              </div>

              <dl className="dee-recap-list">
                <dt>Sous-total HT</dt>
                <dd>{formatEuro(clientTotaux.subTotalHT)}</dd>
                {clientTotaux.remiseHT > 0 && (
                  <>
                    <dt>Remise</dt>
                    <dd>−{formatEuro(clientTotaux.remiseHT)}</dd>
                  </>
                )}
                {Object.entries(clientTotaux.ventilationTVA)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([taux, m]) => (
                    <Fragment key={taux}>
                      <dt>TVA {taux} %</dt>
                      <dd>{formatEuro(m)}</dd>
                    </Fragment>
                  ))}
              </dl>

              <hr className="dee-recap-divider" />
              <h3 className="dee-recap-subtitle">
                <i className="ti ti-tools" aria-hidden="true" />
                Récap interne (artisan)
              </h3>

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
