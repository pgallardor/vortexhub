import { notFound } from "next/navigation";
import { StoreTeamManager } from "@/components/admin/store-team-manager";
import { PageHeader } from "@/components/frontend";
import { getAdminStoreTeam } from "@/lib/frontend/admin-data";

export default async function AdminStoreTeamPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const team = await getAdminStoreTeam(storeId);
  if (!team) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Equipo"
        title={`Administradores de ${team.store.name}`}
        description="Invita personas, ajusta roles y limita accesos por sucursal cuando corresponda."
      />
      <StoreTeamManager
        branches={team.branches}
        invitations={team.invitations}
        members={team.members}
        store={team.store}
      />
    </>
  );
}
