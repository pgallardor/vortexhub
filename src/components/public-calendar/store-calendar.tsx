"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/public-calendar/empty-state";
import { EventCard } from "@/components/public-calendar/event-card";
import {
  EventFilters,
  type EventFilterValues,
} from "@/components/public-calendar/event-filters";
import type { BranchSummary, EventSummary, GameSummary } from "@/lib/frontend/domain";

const emptyFilters: EventFilterValues = { gameSlug: "", branchId: "", date: "" };

export function StoreCalendar({
  branches,
  events,
  games,
}: {
  branches: BranchSummary[];
  events: EventSummary[];
  games: GameSummary[];
}) {
  const [filters, setFilters] = useState<EventFilterValues>(emptyFilters);
  const clearFilters = () => setFilters(emptyFilters);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (filters.gameSlug && event.game.slug !== filters.gameSlug) return false;
        if (filters.branchId && event.branchId !== filters.branchId) return false;
        if (filters.date && event.startsAt.slice(0, 10) !== filters.date) return false;
        return true;
      }),
    [events, filters],
  );

  return (
    <section className="store-calendar">
      <EventFilters
        branches={branches}
        games={games}
        value={filters}
        onChange={setFilters}
        onClear={clearFilters}
      />
      <div className="store-calendar-heading">
        <div>
          <p className="eyebrow">Eventos futuros</p>
          <h2>Próximos eventos</h2>
          <p>Filtra la agenda por juego, sede o día.</p>
        </div>
        <span className="result-count">{filteredEvents.length} resultados</span>
      </div>
      {filteredEvents.length ? (
        <div className="card-grid">
          {filteredEvents.map((event) => <EventCard event={event} key={event.id} />)}
        </div>
      ) : (
        <EmptyState onClear={clearFilters} />
      )}
    </section>
  );
}
