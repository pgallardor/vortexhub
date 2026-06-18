import Link from "next/link";
import type { CSSProperties } from "react";
import { StatusBadge } from "@/components/frontend";
import type { EventSummary } from "@/lib/frontend/domain";

function formatEventTime(event: EventSummary, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(event.startsAt));
}

export function EventAgendaRow({
  event,
  timeZone,
}: {
  event: EventSummary;
  timeZone: string;
}) {
  const bannerStyle = event.bannerUrl
    ? {
        "--agenda-banner-image": `url("${event.bannerUrl}")`,
        "--agenda-banner-position": event.bannerPosition ?? "center",
      } as CSSProperties
    : undefined;

  return (
    <Link
      className="agenda-event"
      href={`/stores/${event.storeSlug}/events/${event.slug}?from=home`}
      aria-label={`Ver ${event.title} de ${event.storeName}`}
    >
      <span
        className={`agenda-event-banner tone-${event.bannerTone}${event.bannerUrl ? " has-image" : ""}`}
        style={bannerStyle}
        aria-hidden="true"
      />
      <time className="agenda-event-time" dateTime={event.startsAt}>
        {formatEventTime(event, timeZone)}
      </time>
      <div className="agenda-event-main">
        <div className="agenda-event-heading">
          <h3>{event.title}</h3>
          {event.seriesName ? <span className="agenda-series">Serie semanal</span> : null}
        </div>
        <p>{event.storeName} · {event.branchName}</p>
      </div>
      <div className="agenda-event-meta">
        <span className="agenda-game">{event.game.name}</span>
        <span>{event.city ?? "Online"}</span>
      </div>
      <div className="agenda-event-action">
        <StatusBadge status={event.registrationMode === "external" ? "Registro externo" : "Informativo"} />
        <span aria-hidden="true">→</span>
      </div>
    </Link>
  );
}
