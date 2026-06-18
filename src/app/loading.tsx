import { CardGridSkeleton, LoadingState } from "@/components/loading-state";
import { PublicShell } from "@/components/frontend";

export default function Loading() {
  return (
    <PublicShell>
      <main className="page-container section route-state-page">
        <LoadingState label="Preparando el calendario" />
        <CardGridSkeleton />
      </main>
    </PublicShell>
  );
}
