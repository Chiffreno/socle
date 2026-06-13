import DevisFinalisation from "@/components/devis/DevisFinalisation";

export default async function FinaliserDevisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DevisFinalisation devisId={id} />;
}
