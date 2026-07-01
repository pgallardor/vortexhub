import { PublicShell } from "@/components/public-shell";
import { HomeCalendar } from "@/components/public-calendar/home-calendar";
import {
  mapPublicCalendarItem,
  type PublicCalendarResult,
} from "@/lib/frontend/public-calendar-data";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
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

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export default async function HomePage() {
  const referenceDate = new Date().toISOString();
  const todayKey = dateKeyInTimeZone(referenceDate, discoveryTimeZone);
  const service = new PublicCalendarService(createSupabasePublicServerClient());
  const calendar = await service.listCalendar({
    from: todayKey,
    to: shiftDateKey(todayKey, 6),
    limit: 100,
  }) as PublicCalendarResult;
  const publishedEvents = calendar.items
    .map((event) => mapPublicCalendarItem(event, discoveryTimeZone))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

  return (
    <PublicShell>
      <main>
        <section className="section page-container home-calendar-section" id="events">
          <HomeCalendar
            discoveryTimeZone={discoveryTimeZone}
            discoveryTimeZoneLabel={discoveryTimeZoneLabel}
            events={publishedEvents}
            referenceDate={referenceDate}
          />
        </section>
      </main>
    </PublicShell>
  );
}
