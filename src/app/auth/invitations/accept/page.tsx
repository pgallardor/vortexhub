import Link from "next/link";
import { redirect } from "next/navigation";
import { StoreInvitationAuthForm } from "@/components/auth/store-invitation-auth-form";
import { StoreInvitationAcceptForm } from "@/components/auth/store-invitation-accept-form";
import { Brand } from "@/components/frontend";
import { hasCurrentMinimumAgeAcceptance } from "@/lib/auth/account-requirements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AccountRow = {
  status: string;
};

type InvitationPreview = {
  email: string;
  role: "owner" | "admin" | "staff";
  scope: "store" | "branches";
  storeName: string;
  expiresAt: string;
  branchNames: string[];
};

function safeToken(value: string | undefined) {
  const token = value?.trim();
  return token && token.length >= 32 && token.length <= 512 ? token : null;
}

function acceptPath(token: string, params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams({ token, ...params });
  return `/auth/invitations/accept?${searchParams.toString()}`;
}

function roleLabel(role: InvitationPreview["role"]) {
  return role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Staff";
}

function scopeLabel(preview: InvitationPreview) {
  if (preview.scope === "store") return "Toda la tienda";
  return preview.branchNames.length ? preview.branchNames.join(", ") : "Sucursales específicas";
}

async function loadInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_store_invitation_preview", { token });

  if (error || !data) return null;
  return data as InvitationPreview;
}

export default async function AcceptStoreInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ signup?: string; token?: string }>;
}) {
  const { signup, token: tokenParam } = await searchParams;
  const token = safeToken(tokenParam);

  if (!token) {
    return (
      <main className="auth-page">
        <section className="form-card auth-card">
          <Brand />
          <p className="eyebrow">Invitación de tienda</p>
          <h1>Enlace inválido</h1>
          <p>Abre esta pantalla desde el enlace de invitación que recibiste.</p>
          <div className="auth-footer">
            <Link className="text-link" href="/auth/login">Ir a login</Link>
          </div>
        </section>
      </main>
    );
  }

  const preview = await loadInvitationPreview(token);

  if (!preview) {
    return (
      <main className="auth-page">
        <section className="form-card auth-card">
          <Brand />
          <p className="eyebrow">Invitación de tienda</p>
          <h1>Invitación expirada</h1>
          <p>Este enlace ya fue usado, revocado o expiró. Pide una nueva invitación al owner de la tienda.</p>
          <div className="auth-footer">
            <Link className="text-link" href="/auth/login">Ir a login</Link>
          </div>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const redirectTo = acceptPath(token);
  const signupRedirectTo = acceptPath(token, { signup: "1" });

  if (!user) {
    return (
      <main className="auth-page">
        <section className="form-card auth-card">
          <Brand />
          <p className="eyebrow">Invitación de tienda</p>
          <h1>Crea tu acceso</h1>
          <p>Te invitaron a administrar <strong>{preview.storeName}</strong> como {roleLabel(preview.role)}.</p>
          <div className="invitation-summary">
            <span>Correo invitado</span>
            <strong>{preview.email}</strong>
            <span>Alcance</span>
            <strong>{scopeLabel(preview)}</strong>
          </div>
          <StoreInvitationAuthForm
            acceptRedirectTo={redirectTo}
            invitedEmail={preview.email}
            signupRedirectTo={signupRedirectTo}
          />
          <div className="auth-footer">
            <Link className="text-link" href="/">← Volver al calendario</Link>
          </div>
        </section>
      </main>
    );
  }

  if (user.email && user.email.toLowerCase() !== preview.email.toLowerCase()) {
    return (
      <main className="auth-page">
        <section className="form-card auth-card">
          <Brand />
          <p className="eyebrow">Invitación de tienda</p>
          <h1>Cuenta distinta</h1>
          <p>
            Esta invitación es para <strong>{preview.email}</strong>, pero la sesión actual usa{" "}
            <strong>{user.email}</strong>.
          </p>
          <form action="/auth/logout" method="post" className="form-grid">
            <button className="button button-primary" type="submit">Cerrar sesión</button>
          </form>
          <div className="auth-footer">
            <Link className="text-link" href="/">← Volver al calendario</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: account } = await supabase
    .from("user_accounts")
    .select("status")
    .eq("id", user.id)
    .maybeSingle<AccountRow>();
  const hasCurrentLegalAcceptance = await hasCurrentMinimumAgeAcceptance(supabase, user.id);

  if (account?.status !== "active" || !hasCurrentLegalAcceptance) {
    const passwordMode = signup === "1" ? "&passwordMode=skip" : "";
    redirect(`/auth/onboarding?redirectTo=${encodeURIComponent(redirectTo)}${passwordMode}`);
  }

  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <p className="eyebrow">Invitación de tienda</p>
        <h1>Confirmar acceso</h1>
        <p>Tu cuenta está lista. Acepta la invitación para entrar al panel de la tienda.</p>
        <StoreInvitationAcceptForm token={token} />
        <div className="auth-footer">
          <Link className="text-link" href="/admin">Volver al panel</Link>
        </div>
      </section>
    </main>
  );
}
