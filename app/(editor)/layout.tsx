import EditorShell from "@/components/EditorShell";

export default function EditorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <EditorShell>{children}</EditorShell>;
}
