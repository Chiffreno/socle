// Config Vitest — suite de tests des modules de calcul (tests/).
// Environnement node : tous les modules testés sont purs (aucune dépendance
// navigateur). Les anciens fichiers *-test.ts (sanity, round-trip, elec-render)
// restent lancés via tsx et ne sont PAS ramassés par ce pattern.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
