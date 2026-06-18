import type { ReactNode } from "react";

export function AdminStatCard({
  label,
  value,
  description,
  action,
}: {
  label: string;
  value: number;
  description: string;
  action?: ReactNode;
}) {
  return (
    <article className="panel-card stat-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{description}</p>
      {action ? <div className="stat-card-action">{action}</div> : null}
    </article>
  );
}
