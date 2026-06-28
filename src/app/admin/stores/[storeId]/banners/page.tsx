import { notFound } from "next/navigation";
import { RemoveMediaButton } from "@/components/admin/remove-media-button";
import { RenameMediaButton } from "@/components/admin/rename-media-button";
import { StoreMediaUploader } from "@/components/admin/store-media-uploader";
import { PageHeader, StatusBadge } from "@/components/frontend";
import { getAdminStore, getAdminStoreMedia } from "@/lib/frontend/admin-data";

export default async function AdminStoreBannersPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [workspace, mediaAssets] = await Promise.all([
    getAdminStore(storeId),
    getAdminStoreMedia(storeId),
  ]);
  if (!workspace || !mediaAssets) notFound();

  const { store } = workspace.overview;
  const banners = mediaAssets.filter((asset) => asset.assetType === "event_banner" && asset.status === "active");
  const maxCustomBanners = 5;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Banners custom"
        description={`Biblioteca reutilizable de hasta ${maxCustomBanners} banners para eventos de la tienda durante el piloto.`}
        action={(
          <StoreMediaUploader
            activeCount={banners.length}
            assetType="event_banner"
            maxActiveCount={maxCustomBanners}
            storeId={store.id}
          />
        )}
      />
      {banners.length ? (
        <div className="media-grid">
          {banners.map((banner) => (
            <article className="media-card" key={banner.id}>
              {banner.publicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="Banner custom de evento" src={banner.publicUrl} />
              ) : (
                <div className="media-card-placeholder">Sin preview</div>
              )}
              <div className="media-card-body">
                <div>
                  <p className="eyebrow">Banner reusable</p>
                  <h2>{banner.displayName ?? "Banner custom"}</h2>
                  <p>{banner.width} x {banner.height}</p>
                  <p>Subido el {new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(banner.createdAt))}</p>
                </div>
                <div className="media-card-actions">
                  <StatusBadge status={banner.status} />
                  <RenameMediaButton assetId={banner.id} currentDisplayName={banner.displayName ?? "Banner custom"} />
                  <RemoveMediaButton assetId={banner.id} />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <div className="empty-state-mark">B</div>
          <h2>No hay banners custom todavía</h2>
          <p>Sube el primer banner de la tienda para reutilizarlo al crear o editar eventos.</p>
        </section>
      )}
    </>
  );
}
