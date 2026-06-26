import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteSessionBridge } from "@/components/auth/invite-session-bridge";
import { LegalAcceptanceForm } from "@/components/auth/legal-acceptance-form";
import { StoreOwnerOnboardingForm } from "@/components/auth/store-owner-onboarding-form";
import { Brand } from "@/components/frontend";
import { hasCurrentMinimumAgeAcceptance } from "@/lib/auth/account-requirements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LegalDocumentRow = {
  id: string;
  version: string;
  content: string;
};

type AccountRow = {
  status: string;
};

function safeRedirectTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin/stores/new";
  return value;
}

export default async function StoreOwnerOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo: redirectToParam } = await searchParams;
  const redirectTo = safeRedirectTo(redirectToParam);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <main className="auth-page">
        <section className="form-card auth-card">
          <Brand />
          <p className="eyebrow">Invitación de tienda</p>
          <h1>Un momento</h1>
          <InviteSessionBridge />
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

  const { data: legalDocument, error: legalError } = await supabase
    .from("legal_document_versions")
    .select("id, version, content")
    .eq("document_key", "minimum_age_declaration")
    .eq("is_current", true)
    .lte("published_at", new Date().toISOString())
    .single<LegalDocumentRow>();

  if (legalError || !legalDocument) {
    throw new Error("No hay una declaración legal vigente configurada.");
  }

  const hasCurrentLegalAcceptance = await hasCurrentMinimumAgeAcceptance(supabase, user.id);
  if (account?.status === "active" && hasCurrentLegalAcceptance) redirect(redirectTo);

  if (account?.status === "active") {
    return (
      <main className="auth-page">
        <section className="form-card auth-card">
          <Brand />
          <p className="eyebrow">Declaración vigente</p>
          <h1>Actualiza tu acceso</h1>
          <p>Acepta la declaración de mayoría de edad vigente para volver al panel de administración.</p>
          <LegalAcceptanceForm legalDocument={legalDocument} redirectTo={redirectTo} />
          <div className="auth-footer">
            <Link className="text-link" href="/">← Volver al calendario</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <p className="eyebrow">Bienvenida a tiendas</p>
        <h1>Crea tu acceso</h1>
        <p>Define una contraseña segura y acepta la declaración de mayoría de edad para entrar al panel.</p>
        <StoreOwnerOnboardingForm email={user.email} legalDocument={legalDocument} />
        <div className="auth-footer">
          <Link className="text-link" href="/">← Volver al calendario</Link>
        </div>
      </section>
    </main>
  );
}
