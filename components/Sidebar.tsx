"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS, NAV_BOTTOM } from "@/lib/nav";

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sidebar">
      {NAV_GROUPS.map((group, gi) => (
        <div className="sidebar-section" key={gi}>
          {group.label && <div className="sidebar-label">{group.label}</div>}
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive(item.href) ? " active" : ""}`}
            >
              <i className={`ti ti-${item.icon}`} aria-hidden="true" />
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
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
            style={item.icon === "logout" ? { color: "var(--gray3)" } : undefined}
          >
            <i
              className={`ti ti-${item.icon}`}
              aria-hidden="true"
              style={item.icon === "logout" ? { color: "var(--gray3)" } : undefined}
            />
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
