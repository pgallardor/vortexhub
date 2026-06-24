import Link from "next/link";
import { StoreVisibilityActions } from "@/components/admin/store-visibility-actions";
import { StatusBadge } from "@/components/frontend";
import type { AdminStoreOverview } from "@/lib/frontend/domain";

export function AdminStoreOverviewCard({ overview }: { overview: AdminStoreOverview }) {
  const { store } = overview;

  return (
    <article className="panel-card admin-store-card">
      <div className="admin-card-heading">
        <div>
          <span className="eyebrow">{store.cityLabel}</span>
          <h2>{store.name}</h2>
        </div>
        <div className="status-stack">
          <StatusBadge status={store.status} />
          <StatusBadge status={store.isPubliclyVisible ? "Publica" : "Oculta"} />
        </div>
      </div>
      <p>{store.description}</p>
      <div className="admin-card-metrics">
        <span><strong>{overview.upcomingEventCount}</strong> próximos</span>
        <span><strong>{overview.branchCount}</strong> sucursales</span>
        <span><strong>{overview.draftEventCount}</strong> borradores</span>
      </div>
      <div className="admin-card-actions">
        {store.isPubliclyVisible ? (
          <Link className="button button-secondary" href={`/stores/${store.slug}`}>
            Ver calendario
          </Link>
        ) : null}
        <StoreVisibilityActions store={store} />
        <Link className="button button-primary" href={`/admin/stores/${store.id}`}>
          Administrar
        </Link>
      </div>
    </article>
  );
}
