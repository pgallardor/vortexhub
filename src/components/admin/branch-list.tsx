import { StatusBadge } from "@/components/frontend";
import type { BranchSummary } from "@/lib/frontend/domain";

export function AdminBranchList({ branches }: { branches: BranchSummary[] }) {
  if (branches.length === 0) {
    return <div className="admin-empty">Esta tienda todavía no tiene sucursales.</div>;
  }

  return (
    <div className="card-grid store-grid">
      {branches.map((branch) => (
        <article className="panel-card admin-branch-card" key={branch.id}>
          <div className="admin-card-heading">
            <div>
              <span className="eyebrow">{branch.city}</span>
              <h2>{branch.name}</h2>
            </div>
            <StatusBadge status={branch.status} />
          </div>
          <p>{branch.address}</p>
          <div className="admin-card-actions">
            {/* TODO(auth): show this action only to owners and admins within branch scope. */}
            <button className="button button-secondary" type="button">
              Editar sucursal
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
