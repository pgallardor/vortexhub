import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/frontend";
import { PublicShell } from "@/components/public-shell";
import { StoreDirectory } from "@/components/store-directory";
import type { StoreSummary } from "@/lib/frontend/domain";
import { createSupabasePublicServerClient } from "@/lib/supabase/server";
import { PublicCalendarService } from "@/services/public-calendar-service";

export const metadata: Metadata = {
  title: "Directorio de tiendas",
  description: "Explora tiendas TCG y abre sus calendarios públicos de eventos.",
};

export const dynamic = "force-dynamic";

export default async function StoresDirectoryPage() {
  const service = new PublicCalendarService(createSupabasePublicServerClient());
  const activeStores = await service.listStores() as StoreSummary[];

  return (
    <PublicShell>
      <main className="page-container directory-page">
        <PageHeader
          eyebrow="Comunidad VortexHub"
          title="Directorio de tiendas"
          description="Encuentra tiendas TCG, descubre sus comunidades y abre sus próximos calendarios."
          action={<Link className="button button-primary" href="/auth/register">Registrar mi tienda</Link>}
        />
        <div className="directory-proof">
          <span><strong>{activeStores.length}</strong> tiendas activas</span>
          <span><strong>{new Set(activeStores.map((store) => store.cityLabel)).size}</strong> ciudades</span>
          <span>Calendarios públicos actualizados por cada tienda</span>
        </div>
        <StoreDirectory stores={activeStores} />
      </main>
    </PublicShell>
  );
}
