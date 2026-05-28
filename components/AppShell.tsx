"use client";

import Sidebar from "./Sidebar";
import { useSidebarCollapsed } from "@/lib/use-sidebar";

/**
 * Coquille des pages applicatives : sidebar (repliable) + zone principale dont
 * la marge gauche s'adapte à l'état replié/déployé. La topbar globale est rendue
 * par le layout (app) au-dessus.
 */
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed] = useSidebarCollapsed();
  return (
    <div className={`layout${collapsed ? " is-collapsed" : ""}`}>
      <Sidebar />
      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
