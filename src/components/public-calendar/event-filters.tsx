"use client";

import type { BranchSummary, GameSummary } from "@/lib/frontend/domain";

export interface EventFilterValues {
  gameSlug: string;
  branchId: string;
  date: string;
}

export function EventFilters({
  branches,
  games,
  value,
  onChange,
  onClear,
}: {
  branches: BranchSummary[];
  games: GameSummary[];
  value: EventFilterValues;
  onChange: (value: EventFilterValues) => void;
  onClear: () => void;
}) {
  return (
    <div className="store-event-filters" aria-label="Filtros de eventos">
      <label className="filter-field">
        <span>Juego</span>
        <select
          value={value.gameSlug}
          onChange={(event) => onChange({ ...value, gameSlug: event.target.value })}
        >
          <option value="">Todos los juegos</option>
          {games.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>Sucursal</span>
        <select
          value={value.branchId}
          onChange={(event) => onChange({ ...value, branchId: event.target.value })}
        >
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>Fecha</span>
        <input
          type="date"
          value={value.date}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
        />
      </label>
      <button className="button button-secondary" type="button" onClick={onClear}>
        Limpiar
      </button>
    </div>
  );
}
