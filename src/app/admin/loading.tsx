import { CardGridSkeleton, LoadingState } from "@/components/loading-state";

export default function AdminLoading() {
  return (
    <div className="route-state-page">
      <LoadingState label="Preparando el panel de tienda" />
      <CardGridSkeleton count={2} />
    </div>
  );
}
