import { LoadingState } from "@/components/loading-state";
import { PublicShell } from "@/components/public-shell";

export default function Loading() {
  return (
    <PublicShell>
      <main className="page-container section route-state-page">
        <LoadingState />
      </main>
    </PublicShell>
  );
}
