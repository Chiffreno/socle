// ============================================================
// SOCLE — Extraction des outils HTML legacy (_legacy/) vers Next.js
//
// Permet d'embarquer un prototype HTML autonome dans une page Next sans le
// réécrire : `loadLegacy(fichier, scopeId, options)` lit le fichier dans
// _legacy/, en extrait le markup principal, le CSS et le script inline.
// Consommé par les pages via <LegacyTool> (qui injecte markup + CSS et
// rejoue le script côté client).
//
// Sorties / garanties :
//   - CSS scopé sous `#scopeId` via la règle native @scope : les styles du
//     prototype ne fuient jamais sur le reste de l'app (et inversement).
//   - Design system appliqué mécaniquement : box-shadow supprimés,
//     border-radius neutralisés (sauf 50 % sémantique), polices littérales
//     remplacées par les variables next/font (--ff / --mono).
//   - `:root` legacy → `:scope` (les custom properties restent locales).
//
// Côté serveur uniquement (import "server-only") : lit le disque au build.
// ============================================================

import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

export type LegacyParts = {
  html: string;
  css: string;
  script: string;
};

export type LoadLegacyOptions = {
  /** Si défini, n'extrait que le innerHTML de ce sélecteur (ex: "main.main"). */
  mainSelector?: string;
  /** Sélecteurs à retirer du markup avant extraction (ex: [".topbar", ".sidebar"]). */
  remove?: string[];
  /** Déclarations CSS à injecter sur :scope (override de tokens, ex: re-skin). */
  overrides?: string;
  /** Règles CSS supplémentaires (déjà scopées via @scope), ex: corrections de layout. */
  extraCss?: string;
  /** Remplacements littéraux appliqués au markup extrait (ex: re-branding). */
  replace?: Array<[string, string]>;
};

/**
 * Scope le CSS d'origine sous `#scopeId` via la règle native @scope, et applique
 * les règles du design system (zéro box-shadow, polices next/font).
 */
function scopeCss(
  css: string,
  scopeId: string,
  overrides = "",
  extraCss = ""
): string {
  const cleaned = css
    // Design system : zéro box-shadow.
    .replace(/box-shadow\s*:[^;}]+;?/gi, "")
    // Design system : zéro border-radius (sauf 50% sémantique).
    .replace(/border-radius\s*:\s*([^;}]+);?/gi, (_m, val: string) =>
      val.trim() === "50%" ? "border-radius:50%;" : ""
    )
    // Les polices littérales ne résolvent pas avec next/font → variables CSS.
    .replace(/'Figtree'\s*,\s*sans-serif/gi, "var(--ff)")
    .replace(/'DM Mono'\s*,\s*monospace/gi, "var(--mono)")
    .replace(/'Figtree'/gi, "var(--ff)")
    .replace(/'DM Mono'/gi, "var(--mono)")
    // Custom properties scopées au wrapper plutôt qu'au document.
    .replace(/:root\b/g, ":scope");

  // Toujours rétablir les variables de police sur :scope (les :root legacy ont
  // pu devenir circulaires après remplacement, ou pointer vers d'autres polices).
  const fontVars =
    '--ff:var(--font-figtree),"Figtree",sans-serif;' +
    '--mono:var(--font-dm-mono),"DM Mono",monospace;';

  let out = `@scope (#${scopeId}) {\n${cleaned}\n}`;
  out += `\n@scope (#${scopeId}) {\n  :scope { ${fontVars}${overrides} }\n}`;
  if (extraCss.trim()) {
    out += `\n@scope (#${scopeId}) {\n${extraCss}\n}`;
  }
  return out;
}

/**
 * Lit une page HTML legacy depuis _legacy/ et en extrait le markup principal,
 * le CSS (scopé) et le script (verbatim). Exécuté côté serveur au build.
 */
export function loadLegacy(
  file: string,
  scopeId: string,
  options: LoadLegacyOptions = {}
): LegacyParts {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "_legacy", file),
    "utf8"
  );
  const root = parse(raw, { comment: false });

  const css = root
    .querySelectorAll("style")
    .map((s) => s.innerHTML)
    .join("\n");

  const script = root
    .querySelectorAll("script")
    .filter((s) => !s.getAttribute("src"))
    .map((s) => s.innerHTML)
    .join("\n");

  const body = root.querySelector("body");
  if (!body) throw new Error(`No <body> in ${file}`);

  // Les scripts sont extraits séparément (injectés par LegacyTool) : on les
  // retire du markup pour ne pas laisser de nœuds <script> inertes.
  body.querySelectorAll("script").forEach((el) => el.remove());

  for (const sel of options.remove ?? []) {
    body.querySelectorAll(sel).forEach((el) => el.remove());
  }

  let html: string;
  if (options.mainSelector) {
    const main = body.querySelector(options.mainSelector);
    if (!main)
      throw new Error(`Selector "${options.mainSelector}" not found in ${file}`);
    html = main.innerHTML;
  } else {
    html = body.innerHTML;
  }

  html = html.trim();
  for (const [from, to] of options.replace ?? []) {
    html = html.split(from).join(to);
  }

  return {
    html,
    css: scopeCss(css, scopeId, options.overrides, options.extraCss),
    script: script.trim(),
  };
}
