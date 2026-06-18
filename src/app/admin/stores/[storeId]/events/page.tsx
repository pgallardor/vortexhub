import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEventList } from "@/components/admin/event-list";
import { PageHeader } from "@/components/frontend";
import { getAdminStore } from "@/lib/frontend/admin-data";

export default async function AdminEventsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const workspace = await getAdminStore(storeId);
  if (!workspace) notFound();
  const { store } = workspace.overview;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Eventos"
        description="Lista operativa de eventos concretos, incluidos borradores y ocurrencias generadas por series."
        action={<Link className="button button-primary" href={`/admin/stores/${store.id}/events/new`}>Crear evento</Link>}
      />
      <AdminEventList events={workspace.events} storeId={store.id} />
    </>
  );
}
