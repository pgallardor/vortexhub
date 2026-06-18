import { AdminStoreOverviewCard } from "@/components/admin/store-overview-card";
import { PageHeader } from "@/components/frontend";
import { getAdminStores } from "@/lib/frontend/admin-data";

export default async function AdminStoresPage() {
  const stores = await getAdminStores();

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Mis tiendas"
        description="Tiendas accesibles por la cuenta autenticada."
        action={<button className="button button-primary" type="button">Registrar tienda</button>}
      />
      <div className="card-grid store-grid">
        {stores.map((overview) => (
          <AdminStoreOverviewCard key={overview.store.id} overview={overview} />
        ))}
      </div>
    </>
  );
}
