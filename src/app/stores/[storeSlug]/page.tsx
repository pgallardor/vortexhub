import { notFound } from "next/navigation";
import { PublicShell } from "@/components/frontend";
import { StoreCalendar } from "@/components/public-calendar/store-calendar";
import { StoreHeader } from "@/components/public-calendar/store-header";
import { getPublicStoreCalendar } from "@/lib/frontend/public-store-calendar";

export const dynamic = "force-dynamic";

export default async function PublicStorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const calendar = await getPublicStoreCalendar(storeSlug);
  if (!calendar) notFound();

  return (
    <PublicShell>
      <main className="page-container store-page">
        <StoreHeader
          store={calendar.store}
          branches={calendar.branches}
          eventCount={calendar.events.length}
        />
        <StoreCalendar
          branches={calendar.branches}
          events={calendar.events}
          games={calendar.games}
        />
      </main>
    </PublicShell>
  );
}
