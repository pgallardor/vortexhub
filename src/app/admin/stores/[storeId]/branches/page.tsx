import { notFound } from "next/navigation";
import { AdminBranchList } from "@/components/admin/branch-list";
import { PageHeader } from "@/components/frontend";
import { getAdminStore } from "@/lib/frontend/admin-data";

export default async function AdminBranchesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const workspace = await getAdminStore(storeId);
  if (!workspace) notFound();
  const { store } = workspace.overview;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Sucursales"
        description="Cada sucursal representa una sede física estable de la tienda."
        action={
          // TODO(auth): show this action only to owners and admins with valid store scope.
          <button className="button button-primary" type="button">Crear sucursal</button>
        }
      />
      <AdminBranchList branches={workspace.branches} />
    </>
  );
}
