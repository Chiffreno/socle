import Topbar from "@/components/Topbar";
import AppShell from "@/components/AppShell";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Topbar />
      <AppShell>{children}</AppShell>
    </>
  );
}
