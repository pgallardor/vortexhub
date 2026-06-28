"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field, StatusBadge } from "@/components/frontend";
import type {
  BranchSummary,
  StoreMembershipRole,
  StoreMembershipScope,
  StorePendingInvitation,
  StoreSummary,
  StoreTeamMember,
} from "@/lib/frontend/domain";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

type InviteResponse = {
  invitationId: string;
  token: string;
  expiresAt: string;
};

type MembershipResponse = {
  id: string;
};

type ViewerMembership = NonNullable<StoreSummary["viewerMembership"]>;

const ROLE_LABELS: Record<StoreMembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

const SCOPE_LABELS: Record<StoreMembershipScope, string> = {
  store: "Toda la tienda",
  branches: "Sucursales",
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }
  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

function invitationAcceptUrl(token: string) {
  return `${window.location.origin}/auth/invitations/accept?token=${encodeURIComponent(token)}`;
}

function formatDateTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    numberingSystem: "latn",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour24 = Number(getPart("hour"));
  const hour12 = hour24 % 12 || 12;
  const dayPeriod = hour24 < 12 ? "a. m." : "p. m.";

  return `${getPart("day")}-${getPart("month")}-${getPart("year")}, ${hour12}:${getPart("minute")} ${dayPeriod}`;
}

function scopeLabel(scope: StoreMembershipScope, branchNames: string[]) {
  if (scope === "store") return SCOPE_LABELS.store;
  if (!branchNames.length) return "Sin sucursales activas";
  return branchNames.join(", ");
}

function checkedBranchIds(formData: FormData) {
  return formData.getAll("branchIds").map(String).filter(Boolean);
}

function StoreBranchCheckboxes({
  branches,
  selectedIds,
}: {
  branches: BranchSummary[];
  selectedIds: string[];
}) {
  const selected = new Set(selectedIds);
  const activeBranches = branches.filter((branch) => branch.status === "active");

  if (!activeBranches.length) {
    return <p className="form-helper">Activa una sucursal antes de usar alcance por sucursales.</p>;
  }

  return (
    <div className="team-branch-grid">
      {activeBranches.map((branch) => (
        <label className="checkbox-row" key={branch.id}>
          <input defaultChecked={selected.has(branch.id)} name="branchIds" type="checkbox" value={branch.id} />
          <span>{branch.name}</span>
        </label>
      ))}
    </div>
  );
}

function InviteMemberForm({
  branches,
  store,
  viewerMembership,
}: {
  branches: BranchSummary[];
  store: StoreSummary;
  viewerMembership: ViewerMembership;
}) {
  const router = useRouter();
  const canInviteOwners = viewerMembership.role === "owner";
  const canInvite = viewerMembership.role === "owner" || (
    viewerMembership.role === "admin" && viewerMembership.scope === "store"
  );
  const [role, setRole] = useState<StoreMembershipRole>(canInviteOwners ? "admin" : "staff");
  const [scope, setScope] = useState<StoreMembershipScope>("store");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextRole = String(formData.get("role")) as StoreMembershipRole;
    const nextScope = nextRole === "owner" ? "store" : String(formData.get("scope")) as StoreMembershipScope;
    const branchIds = nextScope === "branches" ? checkedBranchIds(formData) : [];

    setErrorMessage(null);
    setInviteLink(null);
    setIsSubmitting(true);

    try {
      const invitation = await readApiResponse<InviteResponse>(await fetch(`/api/v1/stores/${store.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? "").trim(),
          role: nextRole,
          scope: nextScope,
          branchIds,
        }),
      }));

      setInviteLink(invitationAcceptUrl(invitation.token));
      form.reset();
      setRole(canInviteOwners ? "admin" : "staff");
      setScope("store");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos crear la invitación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canInvite) {
    return (
      <div className="panel-card">
        <p>Este admin puede revisar el equipo, pero las invitaciones nuevas requieren un owner o un admin con alcance de toda la tienda.</p>
      </div>
    );
  }

  return (
    <form className="form-card form-grid team-invite-form" onSubmit={onSubmit}>
      <div className="form-grid two">
        <Field label="Email">
          <input name="email" placeholder="persona@tienda.cl" required type="email" />
        </Field>
        <Field label="Rol">
          <select
            name="role"
            onChange={(event) => {
              const nextRole = event.target.value as StoreMembershipRole;
              setRole(nextRole);
              if (nextRole === "owner") setScope("store");
            }}
            value={role}
          >
            {canInviteOwners ? <option value="owner">Owner</option> : null}
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </Field>
      </div>
      <Field label="Alcance">
        <select
          disabled={role === "owner"}
          name="scope"
          onChange={(event) => setScope(event.target.value as StoreMembershipScope)}
          value={role === "owner" ? "store" : scope}
        >
          <option value="store">Toda la tienda</option>
          <option value="branches">Sucursales específicas</option>
        </select>
      </Field>
      {role !== "owner" && scope === "branches" ? (
        <StoreBranchCheckboxes branches={branches} selectedIds={[]} />
      ) : null}
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      {inviteLink ? (
        <div className="team-invite-link" role="status">
          <span>Link de invitación</span>
          <code>{inviteLink}</code>
          <button
            className="button button-secondary button-compact"
            onClick={() => navigator.clipboard.writeText(inviteLink)}
            type="button"
          >
            Copiar
          </button>
        </div>
      ) : null}
      <div className="button-row">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creando..." : "Crear invitación"}
        </button>
      </div>
    </form>
  );
}

function MemberRow({
  branches,
  member,
  timeZone,
  viewerMembership,
}: {
  branches: BranchSummary[];
  member: StoreTeamMember;
  timeZone: string;
  viewerMembership: ViewerMembership;
}) {
  const router = useRouter();
  const [role, setRole] = useState<StoreMembershipRole>(member.role);
  const [scope, setScope] = useState<StoreMembershipScope>(member.scope);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageMembership = viewerMembership.role === "owner";

  async function changeMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const formData = new FormData(event.currentTarget);
    const nextRole = String(formData.get("role")) as StoreMembershipRole;
    const nextScope = nextRole === "owner" ? "store" : String(formData.get("scope")) as StoreMembershipScope;
    const branchIds = nextScope === "branches" ? checkedBranchIds(formData) : [];

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await readApiResponse<MembershipResponse>(await fetch(`/api/v1/memberships/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: nextRole,
          scope: nextScope,
          branchIds,
        }),
      }));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos actualizar el acceso.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function disableMembership() {
    if (!window.confirm(`Quitar el acceso de ${member.displayName}?`)) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await readApiResponse<MembershipResponse>(await fetch(`/api/v1/memberships/${member.id}/disable`, {
        method: "POST",
      }));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos quitar el acceso.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className={`panel-card team-member-card${member.status === "disabled" ? " is-disabled" : ""}`}>
      <div className="team-member-heading">
        <div>
          <h2>{member.displayName}</h2>
          <p>{scopeLabel(member.scope, member.branchNames)}</p>
        </div>
        <div className="status-stack">
          <StatusBadge status={ROLE_LABELS[member.role]} />
          <StatusBadge status={member.status === "active" ? "Activo" : "Deshabilitado"} />
        </div>
      </div>
      <form className="form-grid" onSubmit={changeMembership}>
        <div className="form-grid two">
          <Field label="Rol">
            <select
              disabled={!canManageMembership || member.status !== "active"}
              name="role"
              onChange={(event) => {
                const nextRole = event.target.value as StoreMembershipRole;
                setRole(nextRole);
                if (nextRole === "owner") setScope("store");
              }}
              value={role}
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </Field>
          <Field label="Alcance">
            <select
              disabled={!canManageMembership || member.status !== "active" || role === "owner"}
              name="scope"
              onChange={(event) => setScope(event.target.value as StoreMembershipScope)}
              value={role === "owner" ? "store" : scope}
            >
              <option value="store">Toda la tienda</option>
              <option value="branches">Sucursales específicas</option>
            </select>
          </Field>
        </div>
        {canManageMembership && member.status === "active" && role !== "owner" && scope === "branches" ? (
          <StoreBranchCheckboxes branches={branches} selectedIds={member.branchIds} />
        ) : null}
        <p className="table-secondary">Aceptado: {formatDateTime(member.acceptedAt, timeZone)}</p>
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        {canManageMembership ? (
          <div className="button-row">
            <button className="button button-secondary button-compact" disabled={isSubmitting || member.status !== "active"} type="submit">
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              className="button button-danger button-compact"
              disabled={isSubmitting || member.status !== "active"}
              onClick={disableMembership}
              type="button"
            >
              Quitar acceso
            </button>
          </div>
        ) : (
          <p className="table-secondary">Solo owners pueden cambiar roles, alcance o quitar accesos.</p>
        )}
      </form>
    </article>
  );
}

function PendingInvitationRow({
  invitation,
  timeZone,
  viewerMembership,
}: {
  invitation: StorePendingInvitation;
  timeZone: string;
  viewerMembership: ViewerMembership;
}) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canRevokeInvitation = viewerMembership.role === "owner" || (
    viewerMembership.role === "admin"
    && viewerMembership.scope === "store"
    && invitation.role !== "owner"
  );

  async function revokeInvitation() {
    if (!window.confirm(`Revocar la invitación enviada a ${invitation.email}?`)) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await readApiResponse<StorePendingInvitation>(await fetch(`/api/v1/invitations/${invitation.id}/revoke`, {
        method: "POST",
      }));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos revocar la invitación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <tr>
      <td>
        <strong>{invitation.email}</strong>
        <div className="table-secondary">Expira: {formatDateTime(invitation.expiresAt, timeZone)}</div>
      </td>
      <td>{ROLE_LABELS[invitation.role]}</td>
      <td>{scopeLabel(invitation.scope, invitation.branchNames)}</td>
      <td><StatusBadge status="Pendiente" /></td>
      <td>
        {canRevokeInvitation ? (
          <button className="button button-danger button-compact" disabled={isSubmitting} onClick={revokeInvitation} type="button">
            {isSubmitting ? "Revocando..." : "Revocar"}
          </button>
        ) : (
          <span className="table-secondary">Sin acciones</span>
        )}
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      </td>
    </tr>
  );
}

export function StoreTeamManager({
  branches,
  invitations,
  members,
  store,
}: {
  branches: BranchSummary[];
  invitations: StorePendingInvitation[];
  members: StoreTeamMember[];
  store: StoreSummary;
}) {
  const viewerMembership = store.viewerMembership;

  if (!viewerMembership || !["owner", "admin"].includes(viewerMembership.role)) {
    return <div className="admin-empty">No tienes acceso a la administración del equipo.</div>;
  }

  return (
    <div className="team-layout">
      <section className="admin-section team-section-first">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Nuevo acceso</p>
            <h2>Invitar a una persona</h2>
          </div>
        </div>
        <InviteMemberForm branches={branches} store={store} viewerMembership={viewerMembership} />
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Miembros</p>
            <h2>Accesos activos y deshabilitados</h2>
          </div>
        </div>
        {members.length ? (
          <div className="team-member-grid">
            {members.map((member) => (
              <MemberRow
                branches={branches}
                key={member.id}
                member={member}
                timeZone={store.timezone}
                viewerMembership={viewerMembership}
              />
            ))}
          </div>
        ) : (
          <div className="admin-empty">Todavía no hay miembros visibles para esta tienda.</div>
        )}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Invitaciones</p>
            <h2>Pendientes</h2>
          </div>
        </div>
        {invitations.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Alcance</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => (
                  <PendingInvitationRow
                    invitation={invitation}
                    key={invitation.id}
                    timeZone={store.timezone}
                    viewerMembership={viewerMembership}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">No hay invitaciones pendientes.</div>
        )}
      </section>
    </div>
  );
}
