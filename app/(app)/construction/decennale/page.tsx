import LegacyTool from "@/components/LegacyTool";
import { loadLegacy } from "@/lib/legacy/extract";

export default function DecennalePage() {
  const { html, css, script } = loadLegacy(
    "socle_decennale.html",
    "legacy-decennale",
    { remove: ["header.header"] }
  );
  return (
    <LegacyTool id="legacy-decennale" html={html} css={css} script={script} />
  );
}
