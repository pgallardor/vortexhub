import Link from "next/link";
import { PublicShell, StoreCard } from "@/components/frontend";
import { HomeCalendar } from "@/components/public-calendar/home-calendar";
import {
  deriveStoresFromEvents,
  mapPublicCalendarItem,
  type PublicCalendarResult,
} from "@/lib/frontend/public-calendar-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PublicCalendarService } from "@/services/public-calendar-service";

export const dynamic = "force-dynamic";

const discoveryTimeZone = "America/Santiago";
const discoveryTimeZoneLabel = "Horario de Chile";

function dateKeyInTimeZone(value: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function endOfMonthDateKey(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export default async function HomePage() {
  const referenceDate = new Date().toISOString();
  const todayKey = dateKeyInTimeZone(referenceDate, discoveryTimeZone);
  const service = new PublicCalendarService(await createSupabaseServerClient());
  const calendar = await service.listCalendar({
    from: todayKey,
    to: endOfMonthDateKey(todayKey),
    limit: 100,
  }) as PublicCalendarResult;
  const publishedEvents = calendar.items
    .map((event) => mapPublicCalendarItem(event, discoveryTimeZone))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const activeStores = await service.listStores();
  const stores = deriveStoresFromEvents(publishedEvents, activeStores);

  return (
    <PublicShell>
      <main>
        <section className="hero">
          <div className="page-container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Calendario público TCG</p>
              <h1>Tu próxima partida empieza aquí.</h1>
              <p className="lead">Descubre eventos confirmados por tiendas, compara fechas y encuentra dónde jugar.</p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/#events">Explorar eventos</Link>
                <Link className="button button-secondary" href="/stores">Ver tiendas</Link>
              </div>
              <div className="hero-proof">
                <span><strong>{publishedEvents.length}</strong> próximos eventos</span>
                <span><strong>{stores.length}</strong> tiendas activas</span>
                <span><strong>1</strong> calendario compartible</span>
              </div>
            </div>
            <aside className="panel-card hero-store-cta">
              <p className="eyebrow">Para tiendas</p>
              <h2>Haz fácil encontrar tus eventos</h2>
              <p>Publica un calendario compartible y administra sucursales desde un solo panel.</p>
              <div className="cta-stack">
                <Link className="button button-primary" href="/auth/register">Registrar mi tienda</Link>
                <Link className="text-link" href="/auth/login">Ya administro una tienda →</Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="section page-container home-calendar-section" id="events">
          <HomeCalendar
            discoveryTimeZone={discoveryTimeZone}
            discoveryTimeZoneLabel={discoveryTimeZoneLabel}
            events={publishedEvents}
            referenceDate={referenceDate}
          />
        </section>

        <section className="section page-container" id="stores">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Comunidad</p>
              <h2>Tiendas destacadas</h2>
              <p>Conoce algunos calendarios activos de la comunidad.</p>
            </div>
            <Link className="button button-secondary" href="/stores">Explorar directorio</Link>
          </div>
          <div className="card-grid store-grid">
            {stores.slice(0, 2).map((store) => <StoreCard key={store.id} store={store} />)}
          </div>
        </section>

        <section className="section page-container">
          <div className="player-cta">
            <div>
              <p className="eyebrow">Para jugadores</p>
              <h2>Un solo lugar para descubrir dónde jugar</h2>
              <p>Explora calendarios públicos ahora. La identidad de jugador y el QR llegarán en una siguiente etapa.</p>
            </div>
            <Link className="button button-secondary" href="/player/me">Conocer experiencia jugador</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
