import Link from "next/link";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/event-form";
import { PageHeader, StatusBadge } from "@/components/frontend";
import { getAdminEvent, getAdminEventFormOptions, getAdminStore } from "@/lib/frontend/admin-data";

export default async function EditEventPage({ params }: { params: Promise<{ storeId: string; eventId: string }> }) {
  const { storeId, eventId } = await params;
  const [workspace, event, options] = await Promise.all([
    getAdminStore(storeId),
    getAdminEvent(storeId, eventId),
    getAdminEventFormOptions(storeId),
  ]);
  if (!workspace || !event) notFound();
  const { store } = workspace.overview;
  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title={`Editar · ${event.title}`}
        description="Actualiza los datos públicos y operativos de este evento."
        action={<StatusBadge status={event.status} />}
      />
      {event.seriesId ? (
        <div className="series-origin-notice">
          <div>
            <p className="eyebrow">Ocurrencia generada por serie</p>
            <h2>{event.seriesName}</h2>
            <p>Editar este evento afecta solo esta ocurrencia. Para cambiar futuras generaciones, edita la serie.</p>
          </div>
          <Link
            className="button button-secondary"
            href={`/admin/stores/${store.id}/series/${event.seriesId}/edit`}
          >
            Editar serie
          </Link>
        </div>
      ) : null}
      <EventForm
        branches={workspace.branches}
        customBanners={options.customBanners}
        event={event}
        games={options.games}
        platformBanners={options.platformBanners}
        store={store}
      />
    </>
  );
}
