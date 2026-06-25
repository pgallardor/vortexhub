import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteSessionBridge } from "@/components/auth/invite-session-bridge";
import { StoreOwnerOnboardingForm } from "@/components/auth/store-owner-onboarding-form";
import { Brand } from "@/components/frontend";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LegalDocumentRow = {
  id: string;
  version: string;
  content: string;
};

type AccountRow = {
  status: string;
};

export default async function StoreOwnerOnboardingPage() {
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

  if (account?.status === "active") redirect("/admin/stores/new");

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
