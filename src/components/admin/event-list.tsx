import Link from "next/link";
import { StatusBadge } from "@/components/frontend";
import type { EventSummary } from "@/lib/frontend/domain";

function formatEventDate(event: EventSummary) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}

export function AdminEventList({
  emptyMessage = "Todavía no hay eventos para mostrar.",
  events,
  storeId,
  limit,
}: {
  emptyMessage?: string;
  events: EventSummary[];
  storeId?: string;
  limit?: number;
}) {
  const visibleEvents = typeof limit === "number" ? events.slice(0, limit) : events;

  if (visibleEvents.length === 0) {
    return <div className="admin-empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Juego</th>
            <th>Fecha</th>
            <th>Sucursal</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {visibleEvents.map((event) => (
            <tr key={event.id}>
              <td>
                <strong>{event.title}</strong>
                <br />
                <span className="table-secondary">
                  {event.seriesId ? `Generado por serie · ${event.seriesName}` : "Evento único"}
                </span>
              </td>
              <td>{event.game.name}</td>
              <td>{formatEventDate(event)}</td>
              <td>{event.branchName}</td>
              <td><StatusBadge status={event.status} /></td>
              <td>
                <Link
                  className="button button-secondary button-compact"
                  href={`/admin/stores/${storeId ?? event.storeId}/events/${event.id}/edit`}
                >
                  Editar evento
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
