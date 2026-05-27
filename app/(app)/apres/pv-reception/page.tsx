import LegacyTool from "@/components/LegacyTool";
import { loadLegacy } from "@/lib/legacy/extract";

const GLOBALS = [
  "generatePV",
  "goTo",
  "handlePhoto",
  "openChantier",
  "setState",
  "startPV",
  "toggleLot",
  "state",
];

// Re-skin du thème sombre d'origine vers la palette claire SOCLE.
const OVERRIDES = [
  "--bg:#fafafa",
  "--surface:#ffffff",
  "--surface2:#f4f4f5",
  "--border:#e8e8e8",
  "--border2:#d4d4d4",
  "--text:#0a0a0a",
  "--text2:#525252",
  "--text3:#a3a3a3",
  "--green:#1a7a3c",
  "--green-bg:#e8f5ee",
  "--green-border:#b8ddc8",
  "--orange:#c45a0a",
  "--orange-bg:#fef3eb",
  "--orange-border:#f0c8a0",
  "--red:#dc2626",
  "--red-bg:#fef2f2",
  "--red-border:#fecaca",
  "--display:var(--ff)",
  "--body:var(--ff)",
].join(";");

// Corrections de layout : la colonne mobile centrée, les barres ne doivent pas
// entrer en conflit avec la topbar fixe de l'app.
const EXTRA_CSS = `
  :scope { max-width: 480px; margin: 0 auto; background: var(--bg); }
  .topbar, .progress-bar-wrap { position: static; }
  .screen { min-height: auto; }
`;

export default function PvReceptionPage() {
  const { html, css, script } = loadLegacy(
    "pv_reception_chantier.html",
    "legacy-pv-reception",
    {
      overrides: OVERRIDES,
      extraCss: EXTRA_CSS,
      replace: [["Chiff<span>Reno</span>", "SOCLE<span></span>"]],
    }
  );
  return (
    <LegacyTool
      id="legacy-pv-reception"
      html={html}
      css={css}
      script={script}
      globals={GLOBALS}
    />
  );
}
