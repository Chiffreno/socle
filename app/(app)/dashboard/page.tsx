import LegacyTool from "@/components/LegacyTool";
import { loadLegacy } from "@/lib/legacy/extract";

const GLOBALS = ["setActive", "retractBloc"];

export default function DashboardPage() {
  const { html, css, script } = loadLegacy(
    "socle_dashboard_v2.html",
    "legacy-dashboard",
    { mainSelector: "main.main" }
  );
  return (
    <LegacyTool
      id="legacy-dashboard"
      html={html}
      css={css}
      script={script}
      globals={GLOBALS}
    />
  );
}
