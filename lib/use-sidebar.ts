"use client";

// ============================================================
// SOCLE — État replié/déployé de la sidebar (hook partagé)
//
// Persisté en localStorage (`socle_sidebar_collapsed`) et synchronisé entre
// toutes les instances montées (Sidebar, AppShell, EditorShell) via un event
// custom + l'event `storage` (synchro inter-onglets). Entrées/sorties :
// `useSidebarCollapsed()` → [état, setter] ; `initSidebarCollapsedOnce()`
// replie la sidebar à la PREMIÈRE entrée dans l'éditeur seulement, puis
// respecte le choix utilisateur.
//
// Invariant SSR : premier rendu toujours `false` (déployé) pour que serveur
// et client rendent la même chose ; la vraie valeur est lue après montage.
// ============================================================

import { useEffect, useState } from "react";

const KEY = "socle_sidebar_collapsed";
const EVENT = "socle:sidebar-collapsed";

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "true";
}

/**
 * État replié/déployé de la sidebar, partagé entre instances (Sidebar + AppShell)
 * via localStorage `socle_sidebar_collapsed` et un event custom de synchro.
 * Valeur initiale = déployé (false) au 1er rendu pour rester déterministe côté
 * serveur ; la vraie valeur est lue en effet après montage.
 */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    setCollapsedState(read());
    const onChange = () => setCollapsedState(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setCollapsed = (v: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, String(v));
      window.dispatchEvent(new Event(EVENT));
    }
    setCollapsedState(v);
  };

  return [collapsed, setCollapsed];
}

/**
 * Replie la sidebar UNIQUEMENT à la première entrée sur l'éditeur : si la clé
 * n'a jamais été définie, on la met à "true". Ensuite on respecte le choix
 * utilisateur (aucun re-repli automatique).
 */
export function initSidebarCollapsedOnce(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(KEY) === null) {
    window.localStorage.setItem(KEY, "true");
    window.dispatchEvent(new Event(EVENT));
  }
}
