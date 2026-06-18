"use client";

export function EmptyState({
  onClear,
  title = "No hay eventos con estos filtros",
  description = "Prueba otra fecha, juego o sucursal para seguir explorando el calendario.",
}: {
  onClear: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">+</div>
      <p className="eyebrow">Sin coincidencias</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button button-secondary" type="button" onClick={onClear}>
        Limpiar filtros
      </button>
    </div>
  );
}
