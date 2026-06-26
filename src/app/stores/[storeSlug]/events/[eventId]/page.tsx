import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { StatusBadge } from "@/components/frontend";
import { PublicShell } from "@/components/public-shell";
import {
  mapPublicEventDetail,
  type PublicEventDetail,
} from "@/lib/frontend/public-calendar-data";
import type { EventSummary } from "@/lib/frontend/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http/errors";
import { PublicCalendarService } from "@/services/public-calendar-service";

export const dynamic = "force-dynamic";

function formatEventDate(startsAt: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(startsAt));
}

function formatEntryFee(event: { entryFee: { amount: number; currency: string } | null }) {
  if (!event.entryFee) return "Sin costo informado";

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: event.entryFee.currency,
    maximumFractionDigits: 0,
  }).format(event.entryFee.amount);
}

function mapQueryForEvent(event: EventSummary) {
  if (event.locationMode !== "branch") return null;
  if (event.latitude != null && event.longitude != null) {
    return `${event.latitude},${event.longitude}`;
  }

  return event.address && event.address !== "Dirección por confirmar" ? event.address : null;
}

function EventLocationWidget({ event }: { event: EventSummary }) {
  const mapQuery = mapQueryForEvent(event);
  if (!mapQuery) return null;

  const encodedQuery = encodeURIComponent(mapQuery);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  const embedUrl = `https://www.google.com/maps?q=${encodedQuery}&z=16&output=embed`;

  return (
    <section className="panel-card location-widget" aria-labelledby="event-location-heading">
      <div className="location-widget-copy">
        <p className="eyebrow">Ubicación</p>
        <h2 id="event-location-heading">{event.branchName}</h2>
        <p>{event.address}</p>
        <a className="button button-secondary" href={mapsUrl} rel="noreferrer" target="_blank">
          Abrir en Google Maps ↗
        </a>
      </div>
      <div className="location-map-frame">
        <iframe
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title={`Mapa de ${event.branchName}`}
        />
      </div>
    </section>
  );
}

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeSlug: string; eventId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { storeSlug, eventId } = await params;
  const { from } = await searchParams;
  const service = new PublicCalendarService(await createSupabaseServerClient());
  let eventDetail: PublicEventDetail;

  try {
    eventDetail = await service.getEvent(storeSlug, eventId) as PublicEventDetail;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const event = mapPublicEventDetail(eventDetail);
  const backLink = from === "home"
    ? { href: "/#events", label: "← Volver a home" }
    : { href: `/stores/${event.storeSlug}`, label: `← Volver al calendario de ${event.storeName}` };
  const bannerStyle = event.bannerUrl
    ? {
        "--detail-banner-image": `url("${event.bannerUrl}")`,
        "--detail-banner-position": event.bannerPosition ?? "center",
      } as CSSProperties
    : undefined;

  return (
    <PublicShell>
      <main className="page-container section">
        <Link className="back-link" href={backLink.href}>{backLink.label}</Link>
        <div
          className={`detail-banner tone-${event.bannerTone}${event.bannerUrl ? " has-image" : ""}`}
          style={bannerStyle}
        >
          <div>
            <div className="detail-badges">
              <StatusBadge status={event.game.name} />
              <StatusBadge status={event.registrationMode === "external" ? "Registro externo" : "Informativo"} />
            </div>
            <h1>{event.title}</h1>
            <p>{event.formatName ?? "Sin formato específico"} · Organiza {event.storeName}</p>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-main">
            <article className="panel-card">
              <p className="eyebrow">Sobre el evento</p>
              <h2>{event.title}</h2>
              <p className="detail-description">{event.description}</p>
              <div className="detail-facts">
                <div><span>Juego</span><strong>{event.game.name}</strong></div>
                <div><span>Formato</span><strong>{event.formatName ?? "Sin formato específico"}</strong></div>
                <div><span>Lugar</span><strong>{event.locationLabel}</strong></div>
                <div><span>Dirección</span><strong>{event.address}</strong></div>
                <div><span>Valor</span><strong>{formatEntryFee(event)}</strong></div>
              </div>
            </article>
            <EventLocationWidget event={event} />
          </div>
          <aside className="detail-sidebar">
            <div className="panel-card">
              <p className="eyebrow">Cuándo</p>
              <h2>{formatEventDate(event.startsAt, event.timezone)}</h2>
              <p>{event.timezone}</p>
            </div>
            <div className="panel-card">
              <p className="eyebrow">Registro</p>
              {event.registrationMode === "external" ? (
                <>
                  <p>El registro se gestiona externamente. El enlace abrirá otro sitio.</p>
                  <a className="button button-primary" href={event.externalRegistrationUrl ?? "#"} rel="noreferrer" target="_blank">
                    Ir al registro externo ↗
                  </a>
                </>
              ) : (
                <p>Evento informativo. Consulta los detalles publicados por la tienda antes de asistir.</p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </PublicShell>
  );
}
