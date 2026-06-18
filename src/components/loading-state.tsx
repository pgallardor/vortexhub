export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr-only">Cargando</span>}
    </div>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="event-card skeleton-card" key={index}>
          <div className="skeleton skeleton-banner" />
          <div className="event-card-body">
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
