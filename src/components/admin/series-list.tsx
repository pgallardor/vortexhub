import Link from "next/link";
import { StatusBadge } from "@/components/frontend";
import type { EventSeriesSummary } from "@/lib/frontend/domain";

const weekdayLabels: Record<number, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

export function formatSeriesSchedule(series: EventSeriesSummary) {
  const days = series.weekdays.map((day) => weekdayLabels[day]).join(", ");
  return `${days} · ${series.localStartTime}`;
}

export function AdminSeriesList({
  series,
  storeId,
  limit,
}: {
  series: EventSeriesSummary[];
  storeId: string;
  limit?: number;
}) {
  const visibleSeries = typeof limit === "number" ? series.slice(0, limit) : series;

  if (!visibleSeries.length) {
    return <div className="admin-empty">Todavía no hay series semanales configuradas.</div>;
  }

  return (
    <div className="card-grid store-grid">
      {visibleSeries.map((item) => (
        <article className="panel-card admin-series-card" key={item.id}>
          <div className="admin-card-heading">
            <div>
              <span className="eyebrow">{item.game.name}</span>
              <h2>{item.title}</h2>
            </div>
            <StatusBadge status={item.status} />
          </div>
          <p>{item.description}</p>
          <dl className="series-facts">
            <div><dt>Frecuencia</dt><dd>{formatSeriesSchedule(item)}</dd></div>
            <div><dt>Ubicación</dt><dd>{item.locationLabel}</dd></div>
            <div><dt>Vigencia</dt><dd>{item.endsOn ? `${item.startsOn} a ${item.endsOn}` : `Desde ${item.startsOn}`}</dd></div>
          </dl>
          <div className="admin-card-actions">
            <Link
              className="button button-secondary"
              href={`/admin/stores/${storeId}/series/${item.id}/edit`}
            >
              Editar serie
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
