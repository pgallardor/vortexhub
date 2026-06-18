import { notFound } from "next/navigation";
import { BranchForm } from "@/components/admin/branch-form";
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
          <a className="button button-primary" href="#new-branch">Crear sucursal</a>
        }
      />
      <BranchForm store={store} />
      <AdminBranchList branches={workspace.branches} />
    </>
  );
}
