// ============================================================
// SOCLE — PV de réception — Couche photos (IndexedDB, 100 % local)
//
// Les photos jointes aux réserves d'un PV sont stockées en local sur
// l'appareil. Le modèle PV (Phase A) ne référence QUE des clés
// (`PVReserve.photoIds: string[]`) — jamais le binaire inline. Ce module est
// la seule couche qui sait stocker/résoudre une image à partir de sa clé.
//
// Pourquoi IndexedDB et pas localStorage : localStorage plafonne à ~5 Mo et
// encode mal le binaire ; un PV terrain peut porter 10-15 photos. IndexedDB
// encaisse le volume (Blob natif) sans saturer.
//
// API STABLE & INDÉPENDANTE DU BACKEND : le jour de la bascule Supabase, seul
// l'intérieur de ce module change (put → upload bucket, getUrl →
// createSignedUrl). Ni la signature des fonctions, ni le modèle PV ne bougent.
//
// Compression : on stocke un Blob JPEG recompressé (côté max 1600 px,
// qualité 0,8), jamais l'original brut. La logique du logo
// (app/(app)/construction/parametres) n'est PAS réutilisable telle quelle
// (elle produit un data-URL plafonné à 240 px, PNG-first, et pilote l'état
// React de l'upload logo) → fonction de compression dédiée ci-dessous, sans
// toucher au comportement du logo.
// ============================================================

const DB_NAME = "socle-pv-photos";
const DB_VERSION = 1;
const STORE = "photos";
const KEY_PREFIX = "pvph_";

/** Compression par défaut : côté max 1600 px, JPEG qualité 0,8. */
const MAX_SIDE = 1600;
const QUALITY = 0.8;

/** Erreur typée du module — `message` exploitable directement côté UI. */
export class PvPhotoError extends Error {
  override cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PvPhotoError";
    this.cause = cause;
  }
}

/** Garde SSR / environnement sans IndexedDB. Lève une erreur explicite. */
function assertBrowser(): void {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new PvPhotoError(
      "Stockage photos indisponible : IndexedDB requiert un navigateur (window/indexedDB absents)."
    );
  }
}

function genKey(): string {
  // crypto.randomUUID n'existe qu'en contexte sécurisé (https/localhost) ;
  // fallback sûr sinon (l'unicité suffit, pas de besoin cryptographique).
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${KEY_PREFIX}${rnd}`;
}

// ─── Ouverture DB (mémoïsée) ───
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  assertBrowser();
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      dbPromise = null;
      reject(new PvPhotoError("Impossible d'ouvrir la base IndexedDB.", e));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(new PvPhotoError("Ouverture IndexedDB refusée par le navigateur.", req.error));
    };
    req.onblocked = () =>
      reject(new PvPhotoError("IndexedDB bloqué (un autre onglet bloque la mise à niveau)."));
  });
  return dbPromise;
}

/** Traduit une erreur d'écriture en message exploitable (quota notamment). */
function mapWriteError(err: unknown): PvPhotoError {
  const name = (err as DOMException | null | undefined)?.name;
  if (name === "QuotaExceededError") {
    return new PvPhotoError(
      "Quota de stockage local dépassé : supprime des photos ou des PV pour libérer de l'espace.",
      err
    );
  }
  return new PvPhotoError("Échec d'écriture de la photo dans IndexedDB.", err);
}

// ─── Compression image (canvas → Blob JPEG) ───
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new PvPhotoError("Image illisible (format non supporté ou fichier corrompu)."));
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality)
  );
}

/**
 * Redimensionne (côté max `maxSide`) et recompresse en JPEG `quality`.
 * Retourne le plus léger entre l'image recompressée et l'original (garde-fou
 * pour ne jamais "gonfler" une petite image déjà optimisée). Exportée pour
 * être testable seule.
 */
export async function compressImage(
  input: Blob,
  opts: { maxSide?: number; quality?: number } = {}
): Promise<Blob> {
  assertBrowser();
  const maxSide = opts.maxSide ?? MAX_SIDE;
  const quality = opts.quality ?? QUALITY;
  const url = URL.createObjectURL(input);
  try {
    const img = await loadImage(url);
    const longest = Math.max(img.width, img.height) || maxSide;
    const scale = Math.min(1, maxSide / longest);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PvPhotoError("Canvas 2D indisponible : compression impossible.");
    // Aplat blanc : le JPEG n'a pas d'alpha (un PNG transparent virerait au
    // noir), et un PV imprimé l'est sur fond blanc.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new PvPhotoError("Échec de la compression (toBlob a renvoyé null).");
    return blob.size < input.size ? blob : input;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── Suivi des objectURL pour révocation (anti-fuite mémoire) ───
const liveObjectUrls = new Set<string>();

/**
 * Compresse puis stocke l'image. Retourne la clé générée — c'est cet id qui va
 * dans `PVReserve.photoIds`.
 */
export async function putPhoto(input: Blob): Promise<string> {
  assertBrowser();
  if (!input || input.size === 0) {
    throw new PvPhotoError("Fichier image vide ou absent.");
  }
  const compressed = await compressImage(input);
  const key = genKey();
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(mapWriteError(tx.error));
    tx.onerror = () => reject(mapWriteError(tx.error));
    try {
      tx.objectStore(STORE).put(compressed, key);
    } catch (e) {
      reject(mapWriteError(e));
    }
  });
  return key;
}

/**
 * Résout une clé en URL utilisable dans un `<img>` (objectURL).
 * RESPONSABILITÉ APPELANT : révoquer l'URL via `revokePhotoUrl` quand l'image
 * n'est plus affichée (ou `revokeAllPhotoUrls` au démontage de la page) pour
 * éviter les fuites mémoire sur une page terrain ouverte longtemps.
 */
export async function getPhotoUrl(key: string): Promise<string> {
  assertBrowser();
  const db = await openDB();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(new PvPhotoError("Échec de lecture de la photo.", req.error));
  });
  if (!blob) {
    throw new PvPhotoError(`Photo introuvable pour la clé « ${key} ».`);
  }
  const objectUrl = URL.createObjectURL(blob);
  liveObjectUrls.add(objectUrl);
  return objectUrl;
}

/** Révoque un objectURL précédemment renvoyé par `getPhotoUrl`. */
export function revokePhotoUrl(url: string): void {
  if (typeof URL === "undefined") return;
  URL.revokeObjectURL(url);
  liveObjectUrls.delete(url);
}

/** Révoque tous les objectURL encore vivants (à appeler au démontage de page). */
export function revokeAllPhotoUrls(): void {
  if (typeof URL === "undefined") return;
  for (const url of liveObjectUrls) URL.revokeObjectURL(url);
  liveObjectUrls.clear();
}

/** Supprime une photo (ex. suppression d'une photo de réserve). */
export async function deletePhoto(key: string): Promise<void> {
  assertBrowser();
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new PvPhotoError("Suppression annulée.", tx.error));
    tx.onerror = () => reject(new PvPhotoError("Échec de suppression de la photo.", tx.error));
    tx.objectStore(STORE).delete(key);
  });
}

/** Liste toutes les clés stockées (nettoyage / debug). */
export async function listKeys(): Promise<string[]> {
  assertBrowser();
  const db = await openDB();
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror = () => reject(new PvPhotoError("Échec de lecture des clés.", req.error));
  });
}
