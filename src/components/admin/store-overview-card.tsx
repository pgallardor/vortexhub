import Link from "next/link";
import { StoreActivationActions } from "@/components/admin/store-activation-actions";
import { StoreVisibilityActions } from "@/components/admin/store-visibility-actions";
import { StatusBadge } from "@/components/frontend";
import type { AdminStoreOverview } from "@/lib/frontend/domain";

export function AdminStoreOverviewCard({ overview }: { overview: AdminStoreOverview }) {
  const { store } = overview;
  const publicStatus = store.status === "active"
    ? store.isPubliclyVisible ? "Publica" : "Oculta"
    : "Sin publicar";

  return (
    <article className="panel-card admin-store-card">
      <div className="admin-card-heading">
        <div>
          <span className="eyebrow">{store.cityLabel}</span>
          <h2>{store.name}</h2>
        </div>
        <div className="status-stack">
          <StatusBadge status={store.status} />
          <StatusBadge status={publicStatus} />
        </div>
      </div>
      <p>{store.description}</p>
      {store.status === "pending" ? (
        <p className="admin-card-note">
          Activa la tienda para que sus eventos publicados aparezcan en el calendario publico.
        </p>
      ) : null}
      <div className="admin-card-metrics">
        <span><strong>{overview.upcomingEventCount}</strong> próximos</span>
        <span><strong>{overview.branchCount}</strong> sucursales</span>
        <span><strong>{overview.draftEventCount}</strong> borradores</span>
      </div>
      <div className="admin-card-actions">
        {store.status === "active" && store.isPubliclyVisible ? (
          <Link className="button button-secondary" href={`/stores/${store.slug}`}>
            Ver calendario
          </Link>
        ) : null}
        {store.status === "pending" ? <StoreActivationActions store={store} /> : <StoreVisibilityActions store={store} />}
        <Link className="button button-primary" href={`/admin/stores/${store.id}`}>
          Administrar
        </Link>
      </div>
    </article>
  );
}
