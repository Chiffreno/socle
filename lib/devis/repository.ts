// ============================================================
// SOCLE — Module Devis — Repository
// Interface async (Promise) pour que la bascule vers Supabase soit
// transparente. Implémentation actuelle : localStorage (navigateur).
//
// Clés : socle_entreprise (objet|null) · socle_clients (Client[]) ·
//        socle_devis (Devis[]) · socle_devis_seq (cf. numerotation.ts)
//
// Migration silencieuse : les devis pré-correction (lignes avec
// `prixUnitaireHT`/`statut`/coûts absolus, sans `remiseMode`/`detailMatPose`)
// sont normalisés à la lecture. Le ré-enregistrement persiste le nouveau shape.
// ============================================================

import { calcDevisTotaux } from "./calc";
import { allocateNumero } from "./numerotation";
import type {
  Client,
  ClientInput,
  Devis,
  DevisInput,
  DevisStatut,
  Entreprise,
  EntrepriseInput,
  Ligne,
  LigneNature,
  Lot,
  RemiseMode,
  TauxTVA,
  Unite,
} from "./types";

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
}

export interface Repository {
  entreprise: EntrepriseRepository;
  clients: CrudRepository<Client, ClientInput>;
  devis: DevisRepository;
}

// ─── Clés de stockage ───
const KEY_ENTREPRISE = "socle_entreprise";
const KEY_CLIENTS = "socle_clients";
const KEY_DEVIS = "socle_devis";

// ─── Helpers localStorage ───
function ensureBrowser(): Storage {
  if (typeof window === "undefined") {
    throw new Error(
      "[devis] repository accédé côté serveur : appeler depuis un composant client."
    );
  }
  return window.localStorage;
}

function readJSON<T>(key: string, fallback: T): T {
  const store = ensureBrowser();
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
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

function normLigne(raw: unknown): Ligne {
  const r = (raw ?? {}) as Raw;
  const isNew =
    typeof r.prixPoseUnitaire === "number" ||
    typeof r.prixMateriauxUnitaire === "number" ||
    typeof r.nature === "string";

  if (isNew) {
    const natureRaw = r.nature;
    const nature: LigneNature = natureRaw === "option" ? "option" : "normal";
    return {
      id: asString(r.id, uid()) || uid(),
      nature,
      prestationId:
        typeof r.prestationId === "string" ? r.prestationId : undefined,
      libelle: asString(r.libelle),
      description: asString(r.description),
      quantite: asNumber(r.quantite),
      unite: (r.unite as Unite) || "u",
      prixMateriauxUnitaire: asNumber(r.prixMateriauxUnitaire),
      prixPoseUnitaire: asNumber(r.prixPoseUnitaire),
      tva: (r.tva as TauxTVA) ?? 10,
      coutMateriauxAchat:
        r.coutMateriauxAchat == null ? undefined : asNumber(r.coutMateriauxAchat),
      coutMoInterne:
        r.coutMoInterne == null ? undefined : asNumber(r.coutMoInterne),
    };
  }

  // Ancien shape : on convertit.
  const oldStatut = r.statut;
  const isOffert = oldStatut === "offert"; // → forcé à 0/0 (instruction utilisateur)
  const nature: LigneNature = oldStatut === "option" ? "option" : "normal";
  const oldPrix = asNumber(r.prixUnitaireHT);
  return {
    id: asString(r.id, uid()) || uid(),
    nature,
    libelle: asString(r.libelle),
    description: asString(r.description),
    quantite: asNumber(r.quantite),
    unite: (r.unite as Unite) || "u",
    prixMateriauxUnitaire: 0,
    prixPoseUnitaire: isOffert ? 0 : oldPrix,
    tva: (r.tva as TauxTVA) ?? 10,
  };
}

function normLot(raw: unknown): Lot {
  const r = (raw ?? {}) as Raw;
  return {
    id: asString(r.id, uid()) || uid(),
    titre: asString(r.titre),
    lignes: Array.isArray(r.lignes) ? r.lignes.map(normLigne) : [],
  };
}

function normalizeDevis(raw: unknown): Devis {
  const r = (raw ?? {}) as Raw;
  const lots = Array.isArray(r.lots) ? r.lots.map(normLot) : [];
  const remiseModeRaw = r.remiseMode;
  const remiseMode: RemiseMode =
    remiseModeRaw === "pourcent" || remiseModeRaw === "euros"
      ? remiseModeRaw
      : "aucune";
  const remiseValeur = asNumber(r.remiseValeur);
  const detailMatPose = Boolean(r.detailMatPose);

  // Recalcul des totaux à la lecture (les anciens totaux peuvent être obsolètes
  // après migration des prix). Le prochain `update` persistera ces nouveaux totaux.
  const t = calcDevisTotaux(lots, remiseMode, remiseValeur);

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
    chantierAdresse: asString(r.chantierAdresse),
    chantierCodePostal: asString(r.chantierCodePostal),
    chantierVille: asString(r.chantierVille),
    lots,
    acomptePct: asNumber(r.acomptePct, 30),
    lettreIntro: asString(r.lettreIntro),
    notesInternes: asString(r.notesInternes),
    detailMatPose,
    remiseMode,
    remiseValeur,
    totalHT: t.totalHT,
    totalTVA: t.totalTVA,
    totalTTC: t.totalTTC,
    margeHT: t.margeHT,
    createdAt: asString(r.createdAt, nowISO()) || nowISO(),
    updatedAt: asString(r.updatedAt, nowISO()) || nowISO(),
  };
}

/** Recalcule et applique les totaux dénormalisés sur un devis (avec remise). */
function withTotaux<
  T extends Pick<Devis, "lots" | "remiseMode" | "remiseValeur">,
>(
  devis: T
): T & {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  margeHT: number;
} {
  const t = calcDevisTotaux(devis.lots, devis.remiseMode, devis.remiseValeur);
  return {
    ...devis,
    totalHT: t.totalHT,
    totalTVA: t.totalTVA,
    totalTTC: t.totalTTC,
    margeHT: t.margeHT,
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
  async create(data) {
    const list = readDevisRaw().map(normalizeDevis);
    const base: Devis = withTotaux({
      ...data,
      id: uid(),
      numero: allocateNumero(),
      totalHT: 0,
      totalTVA: 0,
      totalTTC: 0,
      margeHT: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
    writeJSON(KEY_DEVIS, [...list, base]);
    return base;
  },
  async update(id, data) {
    const list = readDevisRaw();
    const idx = list.findIndex((d) => (d as Raw)?.id === id);
    if (idx === -1) throw new Error(`[devis] devis introuvable: ${id}`);
    const existing = normalizeDevis(list[idx]);
    const merged: Devis = { ...existing, ...data, id, updatedAt: nowISO() };
    const record = withTotaux(merged);
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

export const repository: Repository = {
  entreprise: entrepriseRepo,
  clients: clientsRepo,
  devis: devisRepo,
};
