"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, NAV_BOTTOM } from "@/lib/nav";
import { useSidebarCollapsed } from "@/lib/use-sidebar";

export default function Sidebar({
  variant = "app",
}: {
  variant?: "app" | "editor";
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={`sidebar${collapsed ? " is-collapsed" : ""}${
        variant === "editor" ? " is-editor" : ""
      }`}
    >
      {variant === "editor" && (
        <Link href="/dashboard" className="sidebar-logo" title="SOCLE">
          {collapsed ? "S" : "SOCLE"}
          <span className="logo-dot" />
        </Link>
      )}

      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Déployer le menu" : "Réduire le menu"}
        aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
      >
        <i
          className={`ti ti-${
            collapsed
              ? "layout-sidebar-left-expand"
              : "layout-sidebar-left-collapse"
          }`}
          aria-hidden="true"
        />
        {!collapsed && <span>Réduire</span>}
      </button>

      {NAV_GROUPS.map((group, gi) => (
        <div className="sidebar-section" key={gi}>
          {group.label && !collapsed && (
            <div className="sidebar-label">{group.label}</div>
          )}
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive(item.href) ? " active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <i className={`ti ti-${item.icon}`} aria-hidden="true" />
              {!collapsed && item.label}
              {!collapsed && item.badge && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </Link>
          ))}
        </div>
      ))}

      <div className="sidebar-bottom">
        {NAV_BOTTOM.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="nav-item"
            title={collapsed ? item.label : undefined}
            style={item.icon === "logout" ? { color: "var(--gray3)" } : undefined}
          >
            <i
              className={`ti ti-${item.icon}`}
              aria-hidden="true"
              style={item.icon === "logout" ? { color: "var(--gray3)" } : undefined}
            />
            {!collapsed && item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
