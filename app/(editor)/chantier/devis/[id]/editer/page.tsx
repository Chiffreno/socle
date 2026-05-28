import DevisEditorEngine from "@/components/devis/DevisEditorEngine";

export default async function EditerDevisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DevisEditorEngine devisId={id} />;
}
