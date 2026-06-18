import { notFound } from "next/navigation";
import { EventForm } from "@/components/event-form";
import { PageHeader } from "@/components/frontend";
import { getAdminEventFormOptions, getAdminStore } from "@/lib/frontend/admin-data";

export default async function NewEventPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [workspace, options] = await Promise.all([
    getAdminStore(storeId),
    getAdminEventFormOptions(storeId),
  ]);
  if (!workspace) notFound();
  const { store } = workspace.overview;

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="Nuevo evento"
        description="Crea un evento único como borrador o publícalo directamente en el calendario."
      />
      <EventForm
        branches={workspace.branches}
        customBanners={options.customBanners}
        games={options.games}
        platformBanners={options.platformBanners}
        store={store}
      />
    </>
  );
}
