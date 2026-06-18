import Link from "next/link";
import type { CSSProperties } from "react";
import { StatusBadge } from "@/components/frontend";
import type { EventSummary } from "@/lib/frontend/domain";

function formatEventDate(event: EventSummary) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: event.timezone,
  }).format(new Date(event.startsAt));
}

function formatEntryFee(event: EventSummary) {
  if (!event.entryFee) return "Entrada gratuita";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: event.entryFee.currency,
  }).format(event.entryFee.amount);
}

function formatDateChip(event: EventSummary) {
  const date = new Date(event.startsAt);
  return {
    day: new Intl.DateTimeFormat("es-ES", { day: "2-digit", timeZone: event.timezone }).format(date),
    month: new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: event.timezone }).format(date),
  };
}

export function EventCard({ event }: { event: EventSummary }) {
  const dateChip = formatDateChip(event);
  const bannerStyle = event.bannerUrl
    ? {
        "--event-banner-image": `url("${event.bannerUrl}")`,
        "--event-banner-position": event.bannerPosition ?? "center",
      } as CSSProperties
    : undefined;

  return (
    <Link
      className="event-card"
      href={`/stores/${event.storeSlug}/events/${event.slug}`}
      aria-label={`Ver ${event.title} de ${event.storeName}`}
    >
      <div
        className={`event-banner tone-${event.bannerTone}${event.bannerUrl ? " has-image" : ""}`}
        style={bannerStyle}
      >
        <span className="event-date-chip"><strong>{dateChip.day}</strong>{dateChip.month}</span>
        <span className="event-game">{event.game.name}</span>
        {event.seriesName ? <span className="event-series">Serie semanal</span> : null}
      </div>
      <div className="event-card-body">
        <p className="event-date">{formatEventDate(event)}</p>
        <h2>{event.title}</h2>
        <p className="event-store-name">{event.storeName}</p>
        <p className="event-description">{event.description}</p>
        <dl className="event-facts">
          <div><dt>Lugar</dt><dd>{event.branchName}</dd></div>
          <div><dt>Ciudad</dt><dd>{event.city ?? "Online"}</dd></div>
          <div><dt>Entrada</dt><dd>{formatEntryFee(event)}</dd></div>
        </dl>
        <div className="event-card-footer">
          <StatusBadge
            status={event.registrationMode === "external" ? "Registro externo" : "Informativo"}
          />
          <span className="card-link">Ver detalles <span aria-hidden="true">→</span></span>
        </div>
      </div>
    </Link>
  );
}
