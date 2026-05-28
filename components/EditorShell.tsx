"use client";

import Sidebar from "./Sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar";
import "./editor-shell.css";

/**
 * Coquille plein écran du route group `(editor)` : rail SOCLE (variante
 * éditeur) + zone main qui réserve la largeur du rail (margin-left via
 * --rail-w dans editor-shell.css).
 *
 * Bouton circulaire vert centré verticalement à cheval sur le bord droit
 * du rail : SEUL endroit où un cercle plein vert SOCLE est autorisé comme
 * élément d'interface (marqueur d'identité assumé, rappel du point du
 * logo). Remplace l'ancien hamburger discret de la sidebar (caché en
 * variante éditeur par editor-shell.css).
 */
export default function EditorShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return (
    <div className={`editor-shell${collapsed ? " is-collapsed" : ""}`}>
      <Sidebar variant="editor" />
      <button
        type="button"
        className="editor-rail-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Déployer le menu" : "Réduire le menu"}
        aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
      >
        <i
          className={`ti ti-chevron-${collapsed ? "right" : "left"}`}
          aria-hidden="true"
        />
      </button>
      <div className="editor-shell-main">{children}</div>
    </div>
  );
}
