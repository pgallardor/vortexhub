"use client";

import { useMemo, useState } from "react";
import { StoreCard } from "@/components/frontend";
import type { StoreSummary } from "@/lib/frontend/domain";

export function StoreDirectory({ stores }: { stores: StoreSummary[] }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const cities = Array.from(new Set(stores.map((store) => store.cityLabel))).sort();

  const filteredStores = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    return stores.filter((store) => {
      if (city && store.cityLabel !== city) return false;
      if (
        normalizedQuery
        && !`${store.name} ${store.description} ${store.cityLabel}`
          .toLocaleLowerCase("es")
          .includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [city, query, stores]);

  const clearFilters = () => {
    setQuery("");
    setCity("");
  };

  return (
    <>
      <div className="directory-filters">
        <label className="filter-field">
          <span>Buscar tienda</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, ciudad o comunidad"
            type="search"
            value={query}
          />
        </label>
        <label className="filter-field">
          <span>Ciudad</span>
          <select onChange={(event) => setCity(event.target.value)} value={city}>
            <option value="">Todas las ciudades</option>
            {cities.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="button button-secondary" onClick={clearFilters} type="button">
          Limpiar
        </button>
      </div>
      <div className="directory-results-heading">
        <p><strong>{filteredStores.length}</strong> tiendas encontradas</p>
        <span>Abre el calendario público actualizado por cada tienda.</span>
      </div>
      {filteredStores.length ? (
        <div className="card-grid store-directory-grid">
          {filteredStores.map((store) => <StoreCard key={store.id} store={store} />)}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-mark" aria-hidden="true">+</div>
          <p className="eyebrow">Sin coincidencias</p>
          <h2>No encontramos tiendas con esos filtros</h2>
          <p>Prueba otro nombre o amplía la búsqueda a todas las ciudades.</p>
          <button className="button button-secondary" onClick={clearFilters} type="button">
            Limpiar filtros
          </button>
        </div>
      )}
    </>
  );
}
