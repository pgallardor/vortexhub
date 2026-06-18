"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/frontend";
import type { BranchSummary, EventSummary } from "@/lib/frontend/domain";

const allFilters = {
  branch: "",
  game: "",
  status: "",
};

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

function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatWeekRange(startKey: string, endKey: string) {
  const [startYear, startMonth, startDay] = startKey.split("-").map(Number);
  const [endYear, endMonth, endDay] = endKey.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(Date.UTC(startYear, startMonth - 1, startDay, 12)))} - ${formatter.format(
    new Date(Date.UTC(endYear, endMonth - 1, endDay, 12)),
  )}`;
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

function eventEndForPlanning(event: EventSummary) {
  if (event.endsAt) return new Date(event.endsAt).getTime();
  return new Date(event.startsAt).getTime() + 2 * 60 * 60 * 1000;
}

function eventsOverlap(left: EventSummary, right: EventSummary) {
  const leftStart = new Date(left.startsAt).getTime();
  const rightStart = new Date(right.startsAt).getTime();
  return leftStart < eventEndForPlanning(right) && rightStart < eventEndForPlanning(left);
}

function branchFilterValue(event: EventSummary) {
  return event.branchId ?? "__external__";
}

function eventCountLabel(count: number) {
  return `${count} ${count === 1 ? "evento" : "eventos"}`;
}

export function AdminEventCalendar({
  branches,
  events,
  referenceDate,
  storeId,
  timezone,
}: {
  branches: BranchSummary[];
  events: EventSummary[];
  referenceDate: string;
  storeId: string;
  timezone: string;
}) {
  const [filters, setFilters] = useState(allFilters);
  const [weekOffset, setWeekOffset] = useState(0);
  const games = Array.from(new Map(events.map((event) => [event.game.slug, event.game])).values());
  const statuses = Array.from(new Set(events.map((event) => event.status)));
  const externalLocations = events.some((event) => !event.branchId);
  const referenceKey = dateKeyInTimeZone(referenceDate, timezone);
  const weekStartKey = shiftDateKey(referenceKey, 1 - isoWeekday(referenceKey) + weekOffset * 7);
  const weekEndKey = shiftDateKey(weekStartKey, 6);
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStartKey, index));

  const visibleEvents = useMemo(() => {
    return events
      .filter((event) => {
        const eventDateKey = dateKeyInTimeZone(event.startsAt, timezone);
        if (eventDateKey < weekStartKey || eventDateKey > weekEndKey) return false;
        if (filters.branch && branchFilterValue(event) !== filters.branch) return false;
        if (filters.game && event.game.slug !== filters.game) return false;
        if (filters.status && event.status !== filters.status) return false;
        return true;
      })
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }, [events, filters, timezone, weekEndKey, weekStartKey]);

  const eventsByDay = weekDays.map((dayKey) => {
    const dayEvents = visibleEvents.filter(
      (event) => dateKeyInTimeZone(event.startsAt, timezone) === dayKey,
    );
    const overlappingIds = new Set<string>();

    dayEvents.forEach((event, index) => {
      dayEvents.slice(index + 1).forEach((otherEvent) => {
        if (eventsOverlap(event, otherEvent)) {
          overlappingIds.add(event.id);
          overlappingIds.add(otherEvent.id);
        }
      });
    });

    return { dayEvents, dayKey, overlappingIds };
  });
  const overlappingEventCount = eventsByDay.reduce((total, day) => total + day.overlappingIds.size, 0);
  const resetFilters = () => setFilters(allFilters);

  return (
    <section className="admin-calendar-panel">
      <div className="admin-calendar-toolbar">
        <div>
          <p className="eyebrow">Calendario operativo</p>
          <h2>Semana del {formatWeekRange(weekStartKey, weekEndKey)}</h2>
          <p>Visualiza publicaciones, borradores y eventos en paralelo antes de editar.</p>
        </div>
        <div className="admin-calendar-actions">
          <button className="button button-secondary" type="button" onClick={() => setWeekOffset(weekOffset - 1)}>
            Semana anterior
          </button>
          <button className="button button-secondary" type="button" onClick={() => setWeekOffset(0)}>
            Hoy
          </button>
          <button className="button button-secondary" type="button" onClick={() => setWeekOffset(weekOffset + 1)}>
            Semana siguiente
          </button>
        </div>
      </div>

      <div className="admin-calendar-filters">
        <label className="filter-field">
          <span>Juego</span>
          <select value={filters.game} onChange={(event) => setFilters({ ...filters, game: event.target.value })}>
            <option value="">Todos los juegos</option>
            {games.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Sucursal</span>
          <select value={filters.branch} onChange={(event) => setFilters({ ...filters, branch: event.target.value })}>
            <option value="">Todas las ubicaciones</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            {externalLocations ? <option value="__external__">Online o personalizada</option> : null}
          </select>
        </label>
        <label className="filter-field">
          <span>Estado</span>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Todos los estados</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <button className="button button-secondary" type="button" onClick={resetFilters}>
          Limpiar
        </button>
      </div>

      <div className="admin-calendar-summary">
        <span><strong>{eventCountLabel(visibleEvents.length)}</strong> en la semana visible</span>
        <span><strong>{overlappingEventCount}</strong> marcados como paralelos</span>
        <span>{timezone}</span>
      </div>

      <div className="admin-week-calendar" aria-label="Calendario semanal de eventos">
        {eventsByDay.map(({ dayEvents, dayKey, overlappingIds }) => (
          <section className="admin-calendar-day" key={dayKey}>
            <header className="admin-calendar-day-header">
              <strong>{formatDayLabel(dayKey)}</strong>
              <span>{eventCountLabel(dayEvents.length)}</span>
            </header>
            <div className="admin-calendar-day-events">
              {dayEvents.length ? (
                dayEvents.map((event) => (
                  <article
                    className={`admin-calendar-event tone-${event.bannerTone}${overlappingIds.has(event.id) ? " is-overlapping" : ""}`}
                    key={event.id}
                  >
                    <div className="admin-calendar-event-topline">
                      <time dateTime={event.startsAt}>{formatTime(event.startsAt, timezone)}</time>
                      {overlappingIds.has(event.id) ? <span className="admin-overlap-chip">Paralelo</span> : null}
                    </div>
                    <h3>{event.title}</h3>
                    <p>{event.game.name} · {event.branchName}</p>
                    {event.seriesId ? (
                      <span className="admin-series-origin-chip">
                        Serie · {event.seriesName}
                      </span>
                    ) : null}
                    <div className="admin-calendar-event-footer">
                      <StatusBadge status={event.status} />
                      <Link
                        className="card-link"
                        href={`/admin/stores/${storeId}/events/${event.id}/edit`}
                      >
                        Editar
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <div className="admin-calendar-empty">Sin eventos</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
