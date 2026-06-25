import { AdminStoreOverviewCard } from "@/components/admin/store-overview-card";
import { PageHeader } from "@/components/frontend";
import { getAdminStores } from "@/lib/frontend/admin-data";
import Link from "next/link";

export default async function AdminStoresPage() {
  const stores = await getAdminStores();

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Mis tiendas"
        description="Tiendas accesibles por la cuenta autenticada."
        action={<Link className="button button-primary" href="/admin/stores/new">Registrar tienda</Link>}
      />
      <div className="card-grid store-grid">
        {stores.map((overview) => (
          <AdminStoreOverviewCard key={overview.store.id} overview={overview} />
        ))}
      </div>
    </>
  );
}
