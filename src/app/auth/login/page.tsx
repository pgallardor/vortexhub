import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Brand } from "@/components/frontend";

function safeRedirectTo(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirectTo?: string }>;
}) {
  const { message, redirectTo: redirectToParam } = await searchParams;
  const redirectTo = safeRedirectTo(redirectToParam);

  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <p className="eyebrow">Acceso para tiendas</p>
        <h1>Vuelve a tu panel</h1>
        <p>Administra calendarios, eventos y sucursales desde un solo lugar.</p>
        {message ? <p className="form-error" role="alert">{message}</p> : null}
        <LoginForm redirectTo={redirectTo} />
        <div className="auth-footer">
          <p>¿No tienes cuenta? <Link className="text-link" href="/auth/register">Registrar una tienda</Link></p>
          <Link className="text-link" href="/">← Volver al calendario</Link>
        </div>
      </section>
    </main>
  );
}
