import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { PublicShell, StatusBadge } from "@/components/frontend";
import {
  mapPublicEventDetail,
  type PublicEventDetail,
} from "@/lib/frontend/public-calendar-data";
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
