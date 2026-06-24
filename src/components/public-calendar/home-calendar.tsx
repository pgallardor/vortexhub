"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/public-calendar/empty-state";
import { EventAgendaRow } from "@/components/public-calendar/event-agenda-row";
import type { EventSummary } from "@/lib/frontend/domain";

const emptyFilters = { game: "", city: "" };

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

function dateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return {
    weekday: new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      timeZone: "UTC",
    }).format(date),
    weekdayShort: new Intl.DateTimeFormat("es-CL", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date).replace(".", ""),
    day: new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      timeZone: "UTC",
    }).format(date),
    month: new Intl.DateTimeFormat("es-CL", {
      month: "long",
      timeZone: "UTC",
    }).format(date),
    monthShort: new Intl.DateTimeFormat("es-CL", {
      month: "short",
      timeZone: "UTC",
    }).format(date).replace(".", ""),
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRangeLabel(startDateKey: string, endDateKey: string) {
  const start = dateParts(startDateKey);
  const end = dateParts(endDateKey);

  if (start.monthShort === end.monthShort) {
    return `${Number(start.day)}-${Number(end.day)} ${end.monthShort}`;
  }

  return `${Number(start.day)} ${start.monthShort} - ${Number(end.day)} ${end.monthShort}`;
}

function DateRangeText({
  startDateKey,
  endDateKey,
}: {
  startDateKey: string;
  endDateKey: string;
}) {
  const start = dateParts(startDateKey);
  const end = dateParts(endDateKey);

  return (
    <p className="home-date-range" aria-label={`${capitalize(start.weekday)} ${Number(start.day)} de ${start.month} al ${end.weekday} ${Number(end.day)} de ${end.month}.`}>
      <span className="date-word">{start.weekday}</span>
      <strong>{Number(start.day)}</strong>
      <span>{start.month}</span>
      <span className="date-separator">al</span>
      <span className="date-word">{end.weekday}</span>
      <strong>{Number(end.day)}</strong>
      <span>{end.month}</span>
    </p>
  );
}

function DayHeading({
  dateKey,
  eventCount,
  headingId,
}: {
  dateKey: string;
  eventCount: number;
  headingId?: string;
}) {
  const parts = dateParts(dateKey);

  return (
    <div className="agenda-day-heading">
      <div className="agenda-date-heading">
        <h2 id={headingId}>
          <span>{parts.weekday}</span>
          <strong>{Number(parts.day)}</strong>
          <span>{parts.month}</span>
        </h2>
      </div>
      <span>{eventCountLabel(eventCount)}</span>
    </div>
  );
}

function eventCountLabel(count: number) {
  return `${count} ${count === 1 ? "evento" : "eventos"}`;
}

export function HomeCalendar({
  events,
  discoveryTimeZone,
  discoveryTimeZoneLabel,
  referenceDate,
}: {
  events: EventSummary[];
  discoveryTimeZone: string;
  discoveryTimeZoneLabel: string;
  referenceDate: string;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const games = Array.from(new Map(events.map((event) => [event.game.slug, event.game])).values());
  const cities = Array.from(new Set(events.map((event) => event.city ?? "Online"))).sort();
  const todayKey = dateKeyInTimeZone(referenceDate, discoveryTimeZone);
  const rangeEndKey = shiftDateKey(todayKey, 6);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.game && event.game.slug !== filters.game) return false;
      if (filters.city && (event.city ?? "Online") !== filters.city) return false;
      return true;
    });
  }, [events, filters]);

  const eventGroups = Array.from(
    filteredEvents.reduce((groups, event) => {
      const dateKey = dateKeyInTimeZone(event.startsAt, discoveryTimeZone);
      const group = groups.get(dateKey) ?? [];
      group.push(event);
      groups.set(dateKey, group);
      return groups;
    }, new Map<string, EventSummary[]>()),
  );
  const clearFilters = () => setFilters(emptyFilters);

  return (
    <>
      <div className="home-agenda-heading">
        <div>
          <p className="eyebrow">Calendario publico TCG</p>
          <h1>Eventos de los proximos 7 dias</h1>
          <DateRangeText startDateKey={todayKey} endDateKey={rangeEndKey} />
        </div>
        <div className="home-agenda-summary">
          <span className="date-range-pill">{formatRangeLabel(todayKey, rangeEndKey)}</span>
          <span className="result-count">{eventCountLabel(filteredEvents.length)}</span>
        </div>
      </div>

      <div className="filter-bar home-filter-bar" aria-label="Filtros del calendario">
        <label className="filter-field">
          <span>Juego</span>
          <select value={filters.game} onChange={(event) => setFilters({ ...filters, game: event.target.value })}>
            <option value="">Todos los juegos</option>
            {games.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Ciudad</span>
          <select value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })}>
            <option value="">Todas las ciudades</option>
            {cities.map((city) => <option key={city}>{city}</option>)}
          </select>
        </label>
        <div className="home-timezone" aria-label={`Zona horaria: ${discoveryTimeZoneLabel}`}>
          <span>Horario mostrado</span>
          <strong>{discoveryTimeZoneLabel}</strong>
        </div>
        <button className="button button-secondary" type="button" onClick={clearFilters}>Limpiar</button>
      </div>

      {filteredEvents.length ? (
        <div className="home-agenda">
          <section className="agenda-section" aria-labelledby="home-events-heading">
            <div className="agenda-days">
              {eventGroups.map(([dateKey, dayEvents]) => (
                <section className="agenda-day" key={dateKey}>
                  <DayHeading
                    dateKey={dateKey}
                    eventCount={dayEvents.length}
                    headingId={dateKey === eventGroups[0]?.[0] ? "home-events-heading" : undefined}
                  />
                  <div className="agenda-list">
                    {dayEvents.map((event) => (
                      <EventAgendaRow event={event} key={event.id} timeZone={discoveryTimeZone} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="calendar-results-heading">
          <EmptyState
            onClear={clearFilters}
            title="No hay eventos en los proximos 7 dias"
            description="Prueba otro juego o ciudad para descubrir eventos publicados."
          />
        </div>
      )}
    </>
  );
}
