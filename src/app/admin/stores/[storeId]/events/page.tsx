import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEventList } from "@/components/admin/event-list";
import { PageHeader } from "@/components/frontend";
import { getAdminStoreEventList } from "@/lib/frontend/admin-data";

export default async function AdminEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ completed?: string }>;
}) {
  const { storeId } = await params;
  const { completed } = await searchParams;
  const showCompleted = completed === "1";
  const eventList = await getAdminStoreEventList(storeId, { includeCompleted: showCompleted });
  if (!eventList) notFound();
  const { store, events } = eventList;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Eventos"
        description={showCompleted
          ? "Lista operativa completa de eventos concretos, incluyendo completados."
          : "Lista operativa de eventos concretos. Los completados quedan ocultos hasta que los necesites."}
        action={<Link className="button button-primary" href={`/admin/stores/${store.id}/events/new`}>Crear evento</Link>}
      />
      <div className="table-filter-bar">
        <Link
          aria-checked={showCompleted}
          className={`table-checkbox-filter${showCompleted ? " checked" : ""}`}
          href={showCompleted ? `/admin/stores/${store.id}/events` : `/admin/stores/${store.id}/events?completed=1`}
          role="checkbox"
        >
          <span aria-hidden="true" />
          Ver completados
        </Link>
      </div>
      <AdminEventList
        emptyMessage={showCompleted
          ? "Todavía no hay eventos para mostrar."
          : "No hay eventos activos, borradores o cancelados para mostrar. Activa \"Ver completados\" para revisar el historial."}
        events={events}
        storeId={store.id}
      />
    </>
  );
}
