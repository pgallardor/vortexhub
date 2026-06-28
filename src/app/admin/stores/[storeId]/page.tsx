import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBranchList } from "@/components/admin/branch-list";
import { AdminEventList } from "@/components/admin/event-list";
import { AdminStatCard } from "@/components/admin/stat-card";
import { AdminSeriesList } from "@/components/admin/series-list";
import { StoreActivationActions } from "@/components/admin/store-activation-actions";
import { StoreMediaUploader } from "@/components/admin/store-media-uploader";
import { StoreVisibilityActions } from "@/components/admin/store-visibility-actions";
import { PageHeader, StatusBadge } from "@/components/frontend";
import { getAdminStore } from "@/lib/frontend/admin-data";

export default async function AdminStoreDetailPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const workspace = await getAdminStore(storeId);
  if (!workspace) notFound();
  const { overview, branches, events, series } = workspace;
  const { store } = overview;
  const headerEyebrow = store.status === "pending"
    ? "Tienda pendiente"
    : store.isPubliclyVisible ? "Tienda activa" : "Tienda oculta";
  const canManagePublicVisibility = store.status === "active";
  const publicStatus = canManagePublicVisibility
    ? store.isPubliclyVisible ? "Publica" : "Oculta"
    : "Sin publicar";
  const canOpenTeam = ["owner", "admin"].includes(store.viewerMembership?.role ?? "");

  return (
    <>
      <PageHeader
        eyebrow={headerEyebrow}
        title={store.name}
        description={store.description}
        action={(
          <div className="status-stack">
            <StatusBadge status={store.status} />
            <StatusBadge status={publicStatus} />
          </div>
        )}
      />
      <div className="stats-grid stats-grid-three">
        <AdminStatCard
          label="Próximos eventos"
          value={overview.upcomingEventCount}
          description="Programados desde hoy"
          action={<Link className="text-link" href={`/admin/stores/${store.id}/calendar`}>Abrir calendario</Link>}
        />
        <AdminStatCard
          label="Sucursales"
          value={overview.branchCount}
          description="Sedes registradas"
          action={<Link className="text-link" href={`/admin/stores/${store.id}/branches`}>Gestionar sucursales</Link>}
        />
        <AdminStatCard label="Borradores" value={overview.draftEventCount} description="Eventos por publicar" />
      </div>
      {store.status === "pending" ? (
        <section className="admin-section">
          <div className="pending-store-callout">
            <div>
              <p className="eyebrow">Activacion requerida</p>
              <h2>Publica la tienda antes de compartir sus eventos</h2>
              <p>
                Puedes preparar eventos, series, logo y sucursales mientras la tienda esta pendiente. Al activarla,
                sus eventos publicados aparecen en el calendario publico cuando la visibilidad esta habilitada.
              </p>
            </div>
            <StoreActivationActions store={store} />
          </div>
        </section>
      ) : null}
      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Visibilidad publica</p>
            <h2>
              {store.status === "pending"
                ? "Disponible despues de activar"
                : store.isPubliclyVisible ? "Aparece en calendarios publicos" : "Oculta del publico"}
            </h2>
          </div>
          {canManagePublicVisibility ? <StoreVisibilityActions store={store} /> : null}
        </div>
        <div className="panel-card">
          <p>
            {store.status === "pending"
              ? "La tienda aun no aparece en el directorio, en su calendario publico ni en el calendario global. Activa la tienda para habilitar esas superficies."
              : store.isPubliclyVisible
              ? "La tienda aparece en el directorio, su calendario publico y el calendario global."
              : "La tienda sigue operable en administracion, pero no aparece en el directorio ni en calendarios publicos."}
          </p>
        </div>
      </section>
      <section className="admin-section">
        <div className="section-heading">
          <div><p className="eyebrow">Identidad visual</p><h2>Logo de la tienda</h2></div>
          <StoreMediaUploader assetType="store_logo" storeId={store.id} />
        </div>
        <div className="panel-card store-identity-panel">
          <div className="store-logo-frame store-logo-frame-large">
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`Logo de ${store.name}`} className="store-logo" src={store.logoUrl} />
            ) : (
              <span>{store.name.slice(0, 1)}</span>
            )}
          </div>
          <div>
            <p className="eyebrow">Vista pública</p>
            <h2>{store.name}</h2>
            <p>El logo se usa en directorios, páginas públicas y superficies administrativas de la tienda.</p>
          </div>
        </div>
      </section>
      {canOpenTeam ? (
        <section className="admin-section">
          <div className="section-heading">
            <div><p className="eyebrow">Equipo</p><h2>Administradores y staff</h2></div>
            <Link className="button button-secondary" href={`/admin/stores/${store.id}/team`}>Gestionar equipo</Link>
          </div>
          <div className="panel-card">
            <p>Owners administran membresías. Admins pueden revisar el equipo e invitar operadores sin tocar owners.</p>
          </div>
        </section>
      ) : null}
      <section className="admin-section">
        <div className="section-heading">
          <div><p className="eyebrow">Automatización semanal</p><h2>Series recurrentes</h2></div>
          <Link className="button button-secondary" href={`/admin/stores/${store.id}/series/new`}>Crear serie</Link>
        </div>
        <AdminSeriesList series={series} storeId={store.id} limit={2} />
      </section>
      <section className="admin-section">
        <div className="section-heading">
          <div><p className="eyebrow">Agenda</p><h2>Eventos de la tienda</h2></div>
          <div className="button-row">
            <Link className="button button-secondary" href={`/admin/stores/${store.id}/calendar`}>Ver calendario</Link>
            <Link className="button button-primary" href={`/admin/stores/${store.id}/events/new`}>Crear evento</Link>
          </div>
        </div>
        <AdminEventList events={events} storeId={store.id} limit={4} />
      </section>
      <section className="admin-section">
        <div className="section-heading">
          <div><p className="eyebrow">Ubicaciones</p><h2>Sucursales</h2></div>
          <Link className="text-link" href={`/admin/stores/${store.id}/branches`}>Ver todas</Link>
        </div>
        <AdminBranchList branches={branches} />
      </section>
    </>
  );
}
