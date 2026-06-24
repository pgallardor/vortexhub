import { notFound } from "next/navigation";
import { PageHeader } from "@/components/frontend";
import { SeriesForm } from "@/components/series-form";
import { getAdminEventFormOptions, getAdminStore } from "@/lib/frontend/admin-data";

export default async function NewSeriesPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const [workspace, options] = await Promise.all([
    getAdminStore(storeId),
    getAdminEventFormOptions(storeId),
  ]);
  if (!workspace) notFound();
  const { store } = workspace.overview;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Crear serie semanal"
        description="Define una plantilla recurrente para generar y publicar eventos futuros."
      />
      <SeriesForm
        branches={workspace.branches}
        customBanners={options.customBanners}
        games={options.games}
        platformBanners={options.platformBanners}
        store={store}
      />
    </>
  );
}
