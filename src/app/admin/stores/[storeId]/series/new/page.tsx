import { notFound } from "next/navigation";
import { PageHeader } from "@/components/frontend";
import { SeriesForm } from "@/components/series-form";
import { getAdminStore } from "@/lib/frontend/admin-data";

export default async function NewSeriesPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const workspace = await getAdminStore(storeId);
  if (!workspace) notFound();
  const { store } = workspace.overview;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Crear serie semanal"
        description="Define una plantilla recurrente para generar y publicar eventos futuros."
      />
      <SeriesForm branches={workspace.branches} store={store} />
    </>
  );
}
