import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/frontend";
import { SeriesForm } from "@/components/series-form";
import { getAdminEventFormOptions, getAdminSeries, getAdminStore } from "@/lib/frontend/admin-data";

export default async function EditSeriesPage({
  params,
}: {
  params: Promise<{ storeId: string; seriesId: string }>;
}) {
  const { storeId, seriesId } = await params;
  const [workspace, series, options] = await Promise.all([
    getAdminStore(storeId),
    getAdminSeries(storeId, seriesId),
    getAdminEventFormOptions(storeId),
  ]);
  if (!workspace || !series) notFound();

  return (
    <>
      <PageHeader
        eyebrow={workspace.overview.store.name}
        title={`Editar · ${series.title}`}
        description="Los cambios de la plantilla se aplican únicamente a futuras ocurrencias elegibles."
        action={<StatusBadge status={series.status} />}
      />
      <SeriesForm
        branches={workspace.branches}
        customBanners={options.customBanners}
        games={options.games}
        platformBanners={options.platformBanners}
        series={series}
        store={workspace.overview.store}
      />
    </>
  );
}
