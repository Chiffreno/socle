import Link from "next/link";

export default function Topbar() {
  return (
    <header className="topbar">
      <Link href="/dashboard" className="logo">
        SOCLE<span className="logo-dot" />
      </Link>
      <div className="topbar-right">
        <div className="topbar-notif">
          <i className="ti ti-bell" aria-hidden="true" />
          <div className="notif-badge" />
        </div>
        <div className="topbar-user">
          <div className="user-avatar">BG</div>
          <div className="user-info">
            <div className="user-name">Benjamin G.</div>
            <div className="user-plan">Plan Pro · Bêta</div>
          </div>
        </div>
      </div>
    </header>
  );
}
