"use client";

import { useEffect, useRef } from "react";

export type LegacyToolProps = {
  /** Identifiant unique du wrapper (sert au scoping CSS : #legacy-xxx). */
  id: string;
  /** Markup interne d'origine (contenu du <body>, sans le <script>). */
  html: string;
  /** Contenu du <style> d'origine, déjà scopé sous #legacy-xxx. */
  css: string;
  /** Contenu du <script> classique d'origine. */
  script: string;
  /**
   * Noms des fonctions/variables déclarées dans le script et référencées par
   * les handlers inline (onclick="foo()"). Exposés sur window après exécution.
   */
  globals?: string[];
};

/**
 * Monte une page-outil legacy (HTML + CSS + JS vanilla) à l'intérieur de Next.js.
 *
 * - Le markup est injecté impérativement dans un ref (React n'en est jamais
 *   propriétaire → aucun mismatch d'hydratation ; le serveur ne rend qu'un div vide).
 * - Le script est exécuté APRÈS le montage, enveloppé dans une IIFE pour que les
 *   `const`/`let` top-level restent à portée de fonction (réexécution sans erreur
 *   « already declared » au remount), et `Object.assign(window, …)` réexpose les
 *   fonctions nécessaires aux handlers inline.
 * - Le cleanup vide le conteneur (supprime DOM + listeners) et nettoie les globals.
 */
export default function LegacyTool({
  id,
  html,
  css,
  script,
  globals = [],
}: LegacyToolProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    // 1) Markup
    container.innerHTML = html;

    // 2) CSS scopé
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-legacy", id);
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // 3) Script classique enveloppé.
    // Chaque global est exposé individuellement (try/catch par nom) : sur-lister
    // est inoffensif, et un binding manquant ne casse pas l'exposition des autres.
    const expose = globals
      .map((g) => `try{window[${JSON.stringify(g)}]=${g};}catch(e){}`)
      .join("\n");
    const scriptEl = document.createElement("script");
    scriptEl.setAttribute("data-legacy", id);
    scriptEl.textContent = `(function(){\n${script}\n${expose}\n})();`;
    document.body.appendChild(scriptEl);

    return () => {
      scriptEl.remove();
      styleEl.remove();
      container.innerHTML = "";
      const w = window as unknown as Record<string, unknown>;
      for (const g of globals) {
        try {
          delete w[g];
        } catch {
          w[g] = undefined;
        }
      }
    };
  }, [id, html, css, script, globals]);

  return <div ref={ref} id={id} className="legacy-tool" />;
}
