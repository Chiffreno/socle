import PvReceptionEditor from "@/components/devis/PvReceptionEditor";

export default async function PvReceptionPage({
  params,
}: {
  params: Promise<{ chantierId: string }>;
}) {
  const { chantierId } = await params;
  return <PvReceptionEditor chantierId={chantierId} />;
}
