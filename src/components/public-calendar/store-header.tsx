import { StatusBadge } from "@/components/frontend";
import { StoreCalendarShareLink } from "@/components/store-calendar-share-link";
import type { BranchSummary, StoreSummary } from "@/lib/frontend/domain";

export function StoreHeader({
  store,
  branches,
  eventCount,
}: {
  store: StoreSummary;
  branches: BranchSummary[];
  eventCount: number;
}) {
  return (
    <header className="store-header">
      <div>
        <p className="eyebrow">Calendario de tienda</p>
        <h1>{store.name}</h1>
        <p className="lead">{store.description}</p>
        <p className="store-header-prompt">Consulta fechas, ubicaciones y opciones de registro antes de asistir.</p>
      </div>
      <div className="store-header-facts">
        <StatusBadge status="Tienda activa" />
        <span>{branches.length} sucursales</span>
        <span>{eventCount} eventos futuros</span>
        <span>{store.cityLabel} · {store.timezone}</span>
        <StoreCalendarShareLink storeName={store.name} storeSlug={store.slug} />
      </div>
    </header>
  );
}
