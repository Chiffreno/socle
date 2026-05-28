"use client";

import Sidebar from "./Sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar";

/**
 * Coquille plein écran de l'éditeur de devis : rail SOCLE (Sidebar variante
 * éditeur, sans topbar globale) + zone principale dont la marge gauche s'adapte
 * à l'état replié/déployé. La topbar fine est rendue par l'éditeur lui-même.
 */
export default function EditorShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed] = useSidebarCollapsed();
  return (
    <div className={`editor-shell${collapsed ? " is-collapsed" : ""}`}>
      <Sidebar variant="editor" />
      <div className="editor-shell-main">{children}</div>
    </div>
  );
}
