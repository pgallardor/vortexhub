import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminSeriesList } from "@/components/admin/series-list";
import { PageHeader } from "@/components/frontend";
import { getAdminStore } from "@/lib/frontend/admin-data";

export default async function AdminSeriesPage({
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
        title="Series semanales"
        description="Configura plantillas recurrentes que generan eventos concretos semana a semana."
        action={<Link className="button button-primary" href={`/admin/stores/${store.id}/series/new`}>Crear serie</Link>}
      />
      <div className="series-guidance">
        <strong>Cómo funciona:</strong>
        <span>Al activar una serie se publican las fechas elegibles de la semana actual. Cada domingo se genera la semana siguiente.</span>
      </div>
      <AdminSeriesList series={workspace.series} storeId={store.id} />
    </>
  );
}
