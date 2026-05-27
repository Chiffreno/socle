import LegacyTool from "@/components/LegacyTool";
import { loadLegacy } from "@/lib/legacy/extract";

const GLOBALS = [
  "addCustomLine",
  "cancelEdit",
  "commitEdit",
  "exportCSV",
  "exportPDF",
  "exportShoppingList",
  "liveCustomTotal",
  "removeCustomLine",
  "resetProject",
  "rstAllPrice",
  "rstAllPrices",
  "rstPrice",
  "setCustomLine",
  "setLot",
  "setMarge",
  "setOpt",
  "setOptN",
  "setPx",
  "setQuality",
  "setSurf",
  "setGS",
  "setTVA",
  "startEdit",
  "toggleLot",
  "toggleTarif",
  "toggleTarifs",
  "toggleCorps",
  "render",
  "state",
];

// 'Inter' n'est pas chargée (next/font = Figtree) → bascule sur la police SOCLE.
const OVERRIDES = "--sans:var(--ff)";

// L'outil occupe toute la hauteur sous la topbar (52px) ; il gère sa propre
// mise en page 3 colonnes (#app) avec scroll interne.
const EXTRA_CSS = `
  :scope { display: block; height: 100%; }
  #app { height: 100%; }
`;

export default function MateriauxPage() {
  const { html, css, script } = loadLegacy(
    "chiffrage matériaux.html",
    "legacy-chiffrage",
    {
      overrides: OVERRIDES,
      extraCss: EXTRA_CSS,
      replace: [["CHIFFRENO", "SOCLE"]],
    }
  );
  return (
    <LegacyTool
      id="legacy-chiffrage"
      html={html}
      css={css}
      script={script}
      globals={GLOBALS}
    />
  );
}
