import LegacyTool from "@/components/LegacyTool";
import { loadLegacy } from "@/lib/legacy/extract";

const GLOBALS = ["calcul", "setStatut", "setTVA", "sync", "toggleDetail"];

export default function PrevisionnelPage() {
  const { html, css, script } = loadLegacy(
    "socle_previsionnel_1.html",
    "legacy-previsionnel",
    { mainSelector: "main.main" }
  );
  return (
    <LegacyTool
      id="legacy-previsionnel"
      html={html}
      css={css}
      script={script}
      globals={GLOBALS}
    />
  );
}
