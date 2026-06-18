import Link from "next/link";
import { AdminEventList } from "@/components/admin/event-list";
import { AdminStatCard } from "@/components/admin/stat-card";
import { AdminStoreOverviewCard } from "@/components/admin/store-overview-card";
import { PageHeader } from "@/components/frontend";
import { getAdminDashboard } from "@/lib/frontend/admin-data";

export default async function AdminHomePage() {
  const dashboard = await getAdminDashboard();
  const primaryStore = dashboard.stores[0]?.store;

  return (
    <>
      <PageHeader
        eyebrow="Panel de tienda"
        title="Resumen operativo"
        description="Una vista rápida de las tiendas, sucursales y eventos bajo tu administración."
        action={
          primaryStore ? (
            <div className="button-row">
              <Link className="button button-secondary" href={`/admin/stores/${primaryStore.id}/calendar`}>Abrir calendario</Link>
              <Link className="button button-secondary" href={`/admin/stores/${primaryStore.id}/series/new`}>Crear serie</Link>
              <Link className="button button-primary" href={`/admin/stores/${primaryStore.id}/events/new`}>Crear evento</Link>
            </div>
          ) : null
        }
      />
      <div className="stats-grid">
        <AdminStatCard label="Tiendas" value={dashboard.totals.storeCount} description="Con acceso administrativo" />
        <AdminStatCard label="Sucursales" value={dashboard.totals.branchCount} description="En todas tus tiendas" />
        <AdminStatCard label="Próximos eventos" value={dashboard.totals.upcomingEventCount} description="Actividad futura programada" />
        <AdminStatCard label="Borradores" value={dashboard.totals.draftEventCount} description="Pendientes de publicación" />
      </div>
      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Tiendas</p>
            <h2>Espacios administrados</h2>
          </div>
          <Link className="text-link" href="/admin/stores">Ver todas</Link>
        </div>
        <div className="card-grid store-grid">
          {dashboard.stores.map((overview) => (
            <AdminStoreOverviewCard key={overview.store.id} overview={overview} />
          ))}
        </div>
      </section>
      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agenda</p>
            <h2>Próximos eventos</h2>
          </div>
        </div>
        <AdminEventList events={dashboard.upcomingEvents} limit={5} />
      </section>
    </>
  );
}
