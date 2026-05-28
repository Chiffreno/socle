import DevisEditor from "@/components/devis/DevisEditor";

export default async function EditerDevisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DevisEditor devisId={id} />;
}
