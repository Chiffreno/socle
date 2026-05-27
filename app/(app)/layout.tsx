import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Topbar />
      <div className="layout">
        <Sidebar />
        <main className="main">
          <div className="main-inner">{children}</div>
        </main>
      </div>
    </>
  );
}
