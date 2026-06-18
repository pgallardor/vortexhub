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

function isoWeekday(dateKey: string) {
  const weekday = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function formatDayHeading(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
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
  const weekEndKey = shiftDateKey(todayKey, 7 - isoWeekday(todayKey));

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.game && event.game.slug !== filters.game) return false;
      if (filters.city && (event.city ?? "Online") !== filters.city) return false;
      return true;
    });
  }, [events, filters]);

  const todayEvents = filteredEvents.filter(
    (event) => dateKeyInTimeZone(event.startsAt, discoveryTimeZone) === todayKey,
  );
  const weekEvents = filteredEvents.filter((event) => {
    const dateKey = dateKeyInTimeZone(event.startsAt, discoveryTimeZone);
    return dateKey > todayKey && dateKey <= weekEndKey;
  });
  const laterEvents = filteredEvents.filter((event) => {
    const dateKey = dateKeyInTimeZone(event.startsAt, discoveryTimeZone);
    return dateKey > weekEndKey;
  });
  const weekGroups = Array.from(
    weekEvents.reduce((groups, event) => {
      const dateKey = dateKeyInTimeZone(event.startsAt, discoveryTimeZone);
      const group = groups.get(dateKey) ?? [];
      group.push(event);
      groups.set(dateKey, group);
      return groups;
    }, new Map<string, EventSummary[]>()),
  );
  const laterGroups = Array.from(
    laterEvents.reduce((groups, event) => {
      const dateKey = dateKeyInTimeZone(event.startsAt, discoveryTimeZone);
      const group = groups.get(dateKey) ?? [];
      group.push(event);
      groups.set(dateKey, group);
      return groups;
    }, new Map<string, EventSummary[]>()),
  );
  const visibleEventCount = todayEvents.length + weekEvents.length + laterEvents.length;
  const clearFilters = () => setFilters(emptyFilters);

  return (
    <>
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

      {visibleEventCount ? (
        <div className="home-agenda">
          <section className="agenda-section" aria-labelledby="today-events-heading">
            <div className="agenda-section-heading">
              <div>
                <p className="eyebrow">Tu agenda inmediata</p>
                <h2 id="today-events-heading">Eventos de hoy</h2>
                <p>Todos los eventos publicados para hoy, incluidos los que ocurren en paralelo.</p>
              </div>
              <span className="result-count">{eventCountLabel(todayEvents.length)}</span>
            </div>
            {todayEvents.length ? (
              <div className="agenda-list">
                {todayEvents.map((event) => (
                  <EventAgendaRow event={event} key={event.id} timeZone={discoveryTimeZone} />
                ))}
              </div>
            ) : (
              <div className="agenda-empty">No hay eventos hoy con los filtros seleccionados.</div>
            )}
          </section>

          <section className="agenda-section" aria-labelledby="week-events-heading">
            <div className="agenda-section-heading">
              <div>
                <p className="eyebrow">Planifica tus próximos días</p>
                <h2 id="week-events-heading">El resto de esta semana</h2>
                <p>Eventos desde mañana hasta el domingo, agrupados por día.</p>
              </div>
              <span className="result-count">{eventCountLabel(weekEvents.length)}</span>
            </div>
            {weekGroups.length ? (
              <div className="agenda-days">
                {weekGroups.map(([dateKey, dayEvents]) => (
                  <section className="agenda-day" key={dateKey}>
                    <div className="agenda-day-heading">
                      <h3>{formatDayHeading(dateKey)}</h3>
                      <span>{eventCountLabel(dayEvents.length)}</span>
                    </div>
                    <div className="agenda-list">
                      {dayEvents.map((event) => (
                        <EventAgendaRow event={event} key={event.id} timeZone={discoveryTimeZone} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="agenda-empty">No hay más eventos esta semana con los filtros seleccionados.</div>
            )}
          </section>

          {laterGroups.length ? (
            <section className="agenda-section" aria-labelledby="later-events-heading">
              <div className="agenda-section-heading">
                <div>
                  <p className="eyebrow">Más adelante</p>
                  <h2 id="later-events-heading">Próximos eventos publicados</h2>
                  <p>Eventos fuera de esta semana incluidos en el rango público cargado.</p>
                </div>
                <span className="result-count">{eventCountLabel(laterEvents.length)}</span>
              </div>
              <div className="agenda-days">
                {laterGroups.map(([dateKey, dayEvents]) => (
                  <section className="agenda-day" key={dateKey}>
                    <div className="agenda-day-heading">
                      <h3>{formatDayHeading(dateKey)}</h3>
                      <span>{eventCountLabel(dayEvents.length)}</span>
                    </div>
                    <div className="agenda-list">
                      {dayEvents.map((event) => (
                        <EventAgendaRow event={event} key={event.id} timeZone={discoveryTimeZone} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="calendar-results-heading">
          <EmptyState
            onClear={clearFilters}
            title="No hay eventos hoy ni durante el resto de esta semana"
            description="Prueba otro juego o ciudad para descubrir eventos publicados."
          />
        </div>
      )}
    </>
  );
}
