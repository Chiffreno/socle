// ============================================================
// SOCLE — Module Devis — Numérotation
// Format : DEV-{année}-{seq:3}  (ex. DEV-2026-001)
//
// Le numéro est attribué dès la CRÉATION (brouillon compris). Le compteur
// par année n'est JAMAIS décrémenté : supprimer un brouillon laisse un "trou",
// aucun numéro n'est réutilisé (pratique standard BTP, évite les litiges).
//
// La persistance est isolée derrière SequenceStore pour migrer côté serveur
// plus tard (séquence Postgres / RPC) sans toucher aux appelants.
// ============================================================

export const NUMERO_PREFIX = "DEV";
const SEQ_KEY = "socle_devis_seq";

/** Formate un numéro à partir de l'année et du rang. */
export function formatNumero(year: number, seq: number): string {
  return `${NUMERO_PREFIX}-${year}-${String(seq).padStart(3, "0")}`;
}

/** Parse un numéro ; renvoie null si le format ne correspond pas. */
export function parseNumero(
  numero: string
): { year: number; seq: number } | null {
  const m = new RegExp(`^${NUMERO_PREFIX}-(\\d{4})-(\\d+)$`).exec(numero);
  if (!m) return null;
  return { year: Number(m[1]), seq: Number(m[2]) };
}

/** Compteur persistant par année. */
export interface SequenceStore {
  /** Incrémente et renvoie le prochain rang pour l'année. */
  next(year: number): number;
  /** Prochain rang sans incrémenter (aperçu). */
  peek(year: number): number;
}

type SeqMap = Record<string, number>;

function readSeqMap(): SeqMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SEQ_KEY);
    return raw ? (JSON.parse(raw) as SeqMap) : {};
  } catch {
    return {};
  }
}

function writeSeqMap(map: SeqMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEQ_KEY, JSON.stringify(map));
}

/** Implémentation locale (localStorage) du compteur. */
export const localSequenceStore: SequenceStore = {
  next(year) {
    const map = readSeqMap();
    const seq = (map[String(year)] ?? 0) + 1;
    map[String(year)] = seq;
    writeSeqMap(map);
    return seq;
  },
  peek(year) {
    const map = readSeqMap();
    return (map[String(year)] ?? 0) + 1;
  },
};

/** Alloue (et consomme) le prochain numéro pour l'année donnée. */
export function allocateNumero(
  store: SequenceStore = localSequenceStore,
  year: number = new Date().getFullYear()
): string {
  return formatNumero(year, store.next(year));
}

/** Aperçu du prochain numéro sans le consommer. */
export function peekNextNumero(
  store: SequenceStore = localSequenceStore,
  year: number = new Date().getFullYear()
): string {
  return formatNumero(year, store.peek(year));
}
