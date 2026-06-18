import { BranchActions } from "@/components/admin/branch-actions";
import { StatusBadge } from "@/components/frontend";
import type { BranchSummary } from "@/lib/frontend/domain";

function mapsUrl(branch: BranchSummary) {
  const query = branch.latitude != null && branch.longitude != null
    ? `${branch.latitude},${branch.longitude}`
    : branch.address;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

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
          <div className="admin-card-metrics">
            <span><strong>{branch.countryCode ?? "CL"}</strong> País</span>
            <span><strong>{branch.latitude != null && branch.longitude != null ? "Lista" : "Por dirección"}</strong> Mapa</span>
          </div>
          <div className="admin-card-actions">
            {/* TODO(auth): show this action only to owners and admins within branch scope. */}
            <a className="button button-secondary" href={mapsUrl(branch)} rel="noreferrer" target="_blank">
              Ver mapa
            </a>
            <BranchActions branch={branch} />
          </div>
        </article>
      ))}
    </div>
  );
}
