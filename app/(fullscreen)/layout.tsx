import Topbar from "@/components/Topbar";

export default function FullscreenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Topbar />
      <div className="fullscreen-shell">{children}</div>
    </>
  );
}
