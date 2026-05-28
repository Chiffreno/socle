import ApercuDevis from "@/components/devis/ApercuDevis";

export default async function ApercuDevisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApercuDevis devisId={id} />;
}
