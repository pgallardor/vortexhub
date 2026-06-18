import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEventCalendar } from "@/components/admin/event-calendar";
import { PageHeader } from "@/components/frontend";
import { getAdminStore } from "@/lib/frontend/admin-data";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const workspace = await getAdminStore(storeId);
  if (!workspace) notFound();
  const { store } = workspace.overview;
  const referenceDate = new Date().toISOString();

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Calendario"
        description="Planifica la semana, revisa eventos paralelos y distingue eventos únicos de ocurrencias generadas por series."
        action={
          <div className="button-row">
            <Link className="button button-secondary" href={`/admin/stores/${store.id}/series/new`}>
              Crear serie
            </Link>
            <Link className="button button-primary" href={`/admin/stores/${store.id}/events/new`}>
              Crear evento
            </Link>
          </div>
        }
      />
      <AdminEventCalendar
        branches={workspace.branches}
        events={workspace.events}
        referenceDate={referenceDate}
        storeId={store.id}
        timezone={store.timezone}
      />
    </>
  );
}
