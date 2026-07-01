import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Brand } from "@/components/frontend";
import { getOptionalUser } from "@/lib/auth/optional-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginMode = "player" | "store";

function safeRedirectTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  return value;
}

function safeMode(value: string | undefined): LoginMode {
  return value === "player" ? "player" : "store";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; mode?: string; redirectTo?: string }>;
}) {
  const { message, mode: modeParam, redirectTo: redirectToParam } = await searchParams;
  const mode = safeMode(modeParam);
  const fallbackRedirect = mode === "player" ? "/player/me" : "/admin";
  const redirectTo = redirectToParam ? safeRedirectTo(redirectToParam) : fallbackRedirect;
  const playerHref = `/auth/login?mode=player&redirectTo=${encodeURIComponent("/player/me")}`;
  const storeHref = `/auth/login?mode=store&redirectTo=${encodeURIComponent("/admin")}`;
  const supabase = await createSupabaseServerClient();
  const user = await getOptionalUser(supabase);

  if (user) redirect(redirectTo);

  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <div className="auth-intent-switch" aria-label="Tipo de acceso">
          <Link className={mode === "player" ? "selected" : undefined} href={playerHref}>
            Jugador
          </Link>
          <Link className={mode === "store" ? "selected" : undefined} href={storeHref}>
            Tienda
          </Link>
        </div>
        <p className="eyebrow">{mode === "player" ? "Acceso jugador" : "Acceso tienda"}</p>
        <h1>{mode === "player" ? "Entra a tu perfil" : "Vuelve a tu panel"}</h1>
        <p>
          {mode === "player"
            ? "Usa tu cuenta para crear o abrir tu perfil de jugador, mostrar tu QR y participar en las pruebas Stage 2."
            : "Administra calendarios, eventos, sucursales y equipo desde el espacio de tienda."}
        </p>
        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <LoginForm
          redirectTo={redirectTo}
          submitLabel={mode === "player" ? "Entrar como jugador" : "Entrar como tienda"}
        />
        <div className="auth-footer">
          {mode === "player" ? (
            <p>
              ¿Solo quieres mirar eventos? <Link className="text-link" href="/#events">Volver al calendario</Link>
            </p>
          ) : (
            <p>¿No tienes cuenta? <Link className="text-link" href="/auth/register">Registrar una tienda</Link></p>
          )}
          <Link className="text-link" href="/">← Volver al calendario</Link>
        </div>
      </section>
    </main>
  );
}
