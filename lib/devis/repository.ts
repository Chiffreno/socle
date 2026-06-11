// ============================================================
// SOCLE — Module Devis — Repository
// Interface async (Promise) pour que la bascule vers Supabase soit
// transparente. Implémentation actuelle : localStorage (navigateur).
//
// Clés : socle_entreprise (objet|null) · socle_clients (Client[]) ·
//        socle_devis (Devis[]) · socle_devis_seq (cf. numerotation.ts)
//
// MIGRATIONS SILENCIEUSES (à la lecture) :
//   - C0 → C1 : anciennes lignes (prixUnitaireHT/statut/coûts absolus)
//     converties vers le shape C1 (mat+pose par unité, nature).
//   - C1 → P2 : devis sans `engine` → init avec EngineState vide, lots
//     vidés à []. L'en-tête (client, titre, dates, remise…) est préservé.
// ============================================================

import { calcEngineTotaux } from "./engine/totals";
import { createInitialEngineState } from "./engine/lots";
import { normalizeEngine } from "./engine/normalize";
import { regimeParDefaut } from "./regime";
import type { EngineState } from "./engine/types";
import { allocateNumero } from "./numerotation";
import type {
  Chantier,
  ChantierInput,
  Client,
  ClientInput,
  Devis,
  DevisInput,
  DevisStatut,
  Entreprise,
  EntrepriseInput,
  Facture,
  FactureInput,
  Lot,
  RegimeTVA,
  RemiseMode,
  TauxTVA,
} from "./types";
import { REGIMES_TVA } from "./types";

// ─── Contrats ───
export interface CrudRepository<T, TInput> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(data: TInput): Promise<T>;
  update(id: string, data: Partial<TInput>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface EntrepriseRepository {
  get(): Promise<Entreprise | null>;
  save(data: EntrepriseInput): Promise<Entreprise>;
}

export interface DevisRepository extends CrudRepository<Devis, DevisInput> {
  getByStatut(statut: DevisStatut): Promise<Devis[]>;
  updateStatut(id: string, statut: DevisStatut): Promise<Devis>;
  /** Jointure : tous les devis rattachés à un chantier. */
  listByChantier(chantierId: string): Promise<Devis[]>;
}

export interface ChantierRepository extends CrudRepository<Chantier, ChantierInput> {
  /** Jointure inverse : le chantier portant ce devis (ou null). */
  ofDevis(devisId: string): Promise<Chantier | null>;
}

/** Modèle seul : création/lecture suffisent à poser le storage (pas d'UI). */
export interface FactureRepository {
  list(): Promise<Facture[]>;
  get(id: string): Promise<Facture | null>;
  create(data: FactureInput): Promise<Facture>;
}

export interface Repository {
  entreprise: EntrepriseRepository;
  clients: CrudRepository<Client, ClientInput>;
  devis: DevisRepository;
  chantiers: ChantierRepository;
  factures: FactureRepository;
}

// ─── Clés de stockage ───
const KEY_ENTREPRISE = "socle_entreprise";
const KEY_CLIENTS = "socle_clients";
const KEY_DEVIS = "socle_devis";
const KEY_DEVIS_SEQ = "socle_devis_seq";
const KEY_CHANTIERS = "socle_chantiers";
const KEY_FACTURES = "socle_factures";

// ─── Versionnage de schéma (reset one-shot) ───
const KEY_SCHEMA_VERSION = "socle_schema_version";
// v2 = passage au modèle Chantier (devis.chantierId, adresse portée par le
// Chantier). Les devis v1 étaient des données de test sans chantier : on
// repart d'un storage devis propre (purge active, une seule fois).
const SCHEMA_VERSION = "2";

// ─── Helpers localStorage ───
function ensureBrowser(): Storage {
  if (typeof window === "undefined") {
    throw new Error(
      "[devis] repository accédé côté serveur : appeler depuis un composant client."
    );
  }
  return window.localStorage;
}

/**
 * Migration de schéma one-shot, gardée par un flag de version. S'exécute une
 * seule fois (puis court-circuit) et purge ACTIVEMENT le localStorage — pas un
 * simple « on ne lit plus » — pour ne pas laisser d'anciens devis coincés.
 *
 * v1 → v2 : les devis de test (sans `chantierId`) sont supprimés ; le compteur
 * de numérotation est remis à zéro. Accès direct au store (pas via readJSON/
 * writeJSON) pour éviter toute récursion.
 */
function ensureSchemaMigration(): void {
  const store = ensureBrowser();
  if (store.getItem(KEY_SCHEMA_VERSION) === SCHEMA_VERSION) return;
  store.removeItem(KEY_DEVIS);
  store.removeItem(KEY_DEVIS_SEQ);
  store.setItem(KEY_SCHEMA_VERSION, SCHEMA_VERSION);
}

function readJSON<T>(key: string, fallback: T): T {
  ensureSchemaMigration();
  const store = ensureBrowser();
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  ensureSchemaMigration();
  ensureBrowser().setItem(key, JSON.stringify(value));
}

function uid(): string {
  return crypto.randomUUID();
}
function nowISO(): string {
  return new Date().toISOString();
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Migration silencieuse (lecture) ───
type Raw = Record<string, unknown> & { [k: string]: unknown };

function asString(v: unknown, def = ""): string {
  return typeof v === "string" ? v : def;
}
function asNumber(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function normalizeDevis(raw: unknown): Devis {
  const r = (raw ?? {}) as Raw;

  // ─── Header ───
  const remiseModeRaw = r.remiseMode;
  const remiseMode: RemiseMode =
    remiseModeRaw === "pourcent" || remiseModeRaw === "euros"
      ? remiseModeRaw
      : "aucune";
  const remiseValeur = asNumber(r.remiseValeur);
  const detailMatPose = Boolean(r.detailMatPose);
  const globalSurf = asNumber(r.globalSurf, 0);
  const tvaParDefaut: TauxTVA =
    r.tvaParDefaut === 5.5 || r.tvaParDefaut === 10 || r.tvaParDefaut === 20
      ? (r.tvaParDefaut as TauxTVA)
      : 10;

  // ─── Régime de TVA ───
  // Chemin retenu : entreprise ACCESSIBLE. `readJSON` est synchrone et
  // normalizeDevis tourne côté client, donc on lit le singleton entreprise
  // pour défauter via `regimeParDefaut(assujettiTVA)`. Valeur stockée valide →
  // conservée ; sinon défaut selon l'assujettissement ; entreprise non
  // configurée → fallback 'tva' (cf. décision étape A-bis).
  const entreprise = readJSON<Entreprise | null>(KEY_ENTREPRISE, null);
  const regimeTVA: RegimeTVA = REGIMES_TVA.includes(r.regimeTVA as RegimeTVA)
    ? (r.regimeTVA as RegimeTVA)
    : entreprise
      ? regimeParDefaut(entreprise.assujettiTVA)
      : "tva";

  // ─── Engine (source de vérité chiffrage P2) ───
  // Migration C1 → P2 : `lots` ligne-par-ligne est vidé, l'engine est init.
  // Si déjà migré (engine présent), on le re-normalise pour garantir toutes
  // les clés de lots ChiffReno (ajouts futurs sans casser les devis stockés).
  const engine = normalizeEngine(r.engine, {
    globalSurf,
    tvaParDefaut,
    remiseMode,
    remiseValeur,
  });

  // ─── @deprecated `lots` ───
  // Forcé à [] : la migration vide les anciens devis C1. Les nouveaux devis
  // ne s'en servent jamais. DevisEditor compile mais affiche un éditeur vide
  // jusqu'à la réécriture P3.
  const lots: Lot[] = [];

  // Les totaux dénormalisés sont recalculés au prochain `update` (qui passe
  // par `withTotaux` async, lit l'entreprise.tauxHoraire et appelle
  // calcEngineTotaux). À la simple lecture, on garde ce qui était en base —
  // si rien, on met 0 ; le prochain `update` corrigera.
  return {
    id: asString(r.id, uid()) || uid(),
    numero: asString(r.numero),
    clientId: typeof r.clientId === "string" ? r.clientId : null,
    clientSnapshot:
      r.clientSnapshot && typeof r.clientSnapshot === "object"
        ? (r.clientSnapshot as Devis["clientSnapshot"])
        : null,
    titre: asString(r.titre),
    statut: ((r.statut as DevisStatut) || "brouillon") as DevisStatut,
    dateCreation: asString(r.dateCreation, todayISO()) || todayISO(),
    dateValidite: typeof r.dateValidite === "string" ? r.dateValidite : null,
    chantierId: asString(r.chantierId),
    globalSurf,
    tvaParDefaut,
    regimeTVA,
    engine,
    lots,
    acomptePct: asNumber(r.acomptePct, 30),
    lettreIntro: asString(r.lettreIntro),
    notesInternes: asString(r.notesInternes),
    detailMatPose,
    remiseMode,
    remiseValeur,
    totalHT: asNumber(r.totalHT, 0),
    totalTVA: asNumber(r.totalTVA, 0),
    totalTTC: asNumber(r.totalTTC, 0),
    margeHT: asNumber(r.margeHT, 0),
    createdAt: asString(r.createdAt, nowISO()) || nowISO(),
    updatedAt: asString(r.updatedAt, nowISO()) || nowISO(),
  };
}

/** Sync header → engine puis recalcule les totaux dénormalisés via le moteur.
 *  Lit `entreprise.tauxHoraire` (0 si entreprise non configurée → le flag
 *  `tauxHoraireManquant` du moteur signalera la sous-évaluation MO à l'UI). */
async function withTotaux<
  T extends Pick<
    Devis,
    | "engine"
    | "globalSurf"
    | "tvaParDefaut"
    | "remiseMode"
    | "remiseValeur"
    | "regimeTVA"
  >,
>(
  devis: T
): Promise<
  T & {
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    margeHT: number;
  }
> {
  const ent = await entrepriseRepo.get();
  const tauxHoraire = ent?.tauxHoraire ?? 0;

  // Le header est la source de vérité pour ces 4 champs ; on les pousse
  // dans l'engine avant chaque calcul pour éviter toute désynchronisation.
  const engineSynced: EngineState = {
    ...devis.engine,
    globalSurf: devis.globalSurf,
    tvaParDefaut: devis.tvaParDefaut,
    remiseMode: devis.remiseMode,
    remiseValeur: devis.remiseValeur,
  };
  const t = calcEngineTotaux(engineSynced, tauxHoraire, devis.regimeTVA);
  return {
    ...devis,
    engine: engineSynced,
    totalHT: t.totalHT,
    totalTVA: t.totalTVA,
    totalTTC: t.totalTTC,
    margeHT: t.margeGlobaleTracked, // marge sur déboursé + marge points trackés
  };
}

// ─── Entreprise (singleton) ───
const entrepriseRepo: EntrepriseRepository = {
  async get() {
    return readJSON<Entreprise | null>(KEY_ENTREPRISE, null);
  },
  async save(data) {
    const existing = readJSON<Entreprise | null>(KEY_ENTREPRISE, null);
    const record: Entreprise = {
      ...data,
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? nowISO(),
      updatedAt: nowISO(),
    };
    writeJSON(KEY_ENTREPRISE, record);
    return record;
  },
};

// ─── Clients ───
const clientsRepo: CrudRepository<Client, ClientInput> = {
  async list() {
    return readJSON<Client[]>(KEY_CLIENTS, []);
  },
  async get(id) {
    return readJSON<Client[]>(KEY_CLIENTS, []).find((c) => c.id === id) ?? null;
  },
  async create(data) {
    const clients = readJSON<Client[]>(KEY_CLIENTS, []);
    const record: Client = {
      ...data,
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    writeJSON(KEY_CLIENTS, [...clients, record]);
    return record;
  },
  async update(id, data) {
    const clients = readJSON<Client[]>(KEY_CLIENTS, []);
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`[devis] client introuvable: ${id}`);
    const record: Client = { ...clients[idx], ...data, id, updatedAt: nowISO() };
    clients[idx] = record;
    writeJSON(KEY_CLIENTS, clients);
    return record;
  },
  async delete(id) {
    const clients = readJSON<Client[]>(KEY_CLIENTS, []);
    writeJSON(
      KEY_CLIENTS,
      clients.filter((c) => c.id !== id)
    );
  },
};

// ─── Devis ───
function readDevisRaw(): unknown[] {
  const raw = readJSON<unknown[]>(KEY_DEVIS, []);
  return Array.isArray(raw) ? raw : [];
}

const devisRepo: DevisRepository = {
  async list() {
    return readDevisRaw().map(normalizeDevis);
  },
  async get(id) {
    const found = readDevisRaw().find((d) => (d as Raw)?.id === id);
    return found ? normalizeDevis(found) : null;
  },
  async getByStatut(statut) {
    return readDevisRaw()
      .map(normalizeDevis)
      .filter((d) => d.statut === statut);
  },
  async listByChantier(chantierId) {
    return readDevisRaw()
      .map(normalizeDevis)
      .filter((d) => d.chantierId === chantierId);
  },
  async create(data) {
    const list = readDevisRaw().map(normalizeDevis);
    // Défauts neutres pour les 3 champs P2 si l'appelant (ancien
    // DevisEditor C1) ne les fournit pas.
    const globalSurf = data.globalSurf ?? 0;
    const tvaParDefaut = data.tvaParDefaut ?? 10;
    const remiseMode = data.remiseMode ?? "aucune";
    const remiseValeur = data.remiseValeur ?? 0;
    const engine =
      data.engine ??
      createInitialEngineState({
        globalSurf,
        tvaParDefaut,
        remiseMode,
        remiseValeur,
      });
    const base: Devis = await withTotaux({
      ...data,
      chantierId: data.chantierId ?? "",
      globalSurf,
      tvaParDefaut,
      engine,
      id: uid(),
      numero: allocateNumero(),
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0,
      margeHT: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    } as Devis);
    writeJSON(KEY_DEVIS, [...list, base]);
    return base;
  },
  async update(id, data) {
    const list = readDevisRaw();
    const idx = list.findIndex((d) => (d as Raw)?.id === id);
    if (idx === -1) throw new Error(`[devis] devis introuvable: ${id}`);
    const existing = normalizeDevis(list[idx]);
    const merged: Devis = { ...existing, ...data, id, updatedAt: nowISO() };
    const record = await withTotaux(merged);
    list[idx] = record;
    writeJSON(KEY_DEVIS, list);
    return record;
  },
  async updateStatut(id, statut) {
    const list = readDevisRaw();
    const idx = list.findIndex((d) => (d as Raw)?.id === id);
    if (idx === -1) throw new Error(`[devis] devis introuvable: ${id}`);
    const existing = normalizeDevis(list[idx]);
    const record: Devis = { ...existing, statut, updatedAt: nowISO() };
    list[idx] = record;
    writeJSON(KEY_DEVIS, list);
    return record;
  },
  async delete(id) {
    // Pas de re-séquençage : le numéro libéré reste un "trou".
    const list = readDevisRaw();
    writeJSON(
      KEY_DEVIS,
      list.filter((d) => (d as Raw)?.id !== id)
    );
  },
};

// ─── Chantiers ───
const chantiersRepo: ChantierRepository = {
  async list() {
    return readJSON<Chantier[]>(KEY_CHANTIERS, []);
  },
  async get(id) {
    return (
      readJSON<Chantier[]>(KEY_CHANTIERS, []).find((c) => c.id === id) ?? null
    );
  },
  async create(data) {
    const chantiers = readJSON<Chantier[]>(KEY_CHANTIERS, []);
    const record: Chantier = {
      ...data,
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    writeJSON(KEY_CHANTIERS, [...chantiers, record]);
    return record;
  },
  async update(id, data) {
    const chantiers = readJSON<Chantier[]>(KEY_CHANTIERS, []);
    const idx = chantiers.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`[devis] chantier introuvable: ${id}`);
    const record: Chantier = {
      ...chantiers[idx],
      ...data,
      id,
      updatedAt: nowISO(),
    };
    chantiers[idx] = record;
    writeJSON(KEY_CHANTIERS, chantiers);
    return record;
  },
  async delete(id) {
    const chantiers = readJSON<Chantier[]>(KEY_CHANTIERS, []);
    writeJSON(
      KEY_CHANTIERS,
      chantiers.filter((c) => c.id !== id)
    );
  },
  async ofDevis(devisId) {
    const devis = await devisRepo.get(devisId);
    if (!devis || !devis.chantierId) return null;
    return chantiersRepo.get(devis.chantierId);
  },
};

// ─── Factures (modèle seul — create/list/get, aucune UI ni calcul) ───
const facturesRepo: FactureRepository = {
  async list() {
    return readJSON<Facture[]>(KEY_FACTURES, []);
  },
  async get(id) {
    return (
      readJSON<Facture[]>(KEY_FACTURES, []).find((f) => f.id === id) ?? null
    );
  },
  async create(data) {
    const factures = readJSON<Facture[]>(KEY_FACTURES, []);
    const record: Facture = {
      ...data,
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    writeJSON(KEY_FACTURES, [...factures, record]);
    return record;
  },
};

export const repository: Repository = {
  entreprise: entrepriseRepo,
  clients: clientsRepo,
  devis: devisRepo,
  chantiers: chantiersRepo,
  factures: facturesRepo,
};
