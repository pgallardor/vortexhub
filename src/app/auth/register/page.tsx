import Link from "next/link";
import { Brand, Field } from "@/components/frontend";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <p className="eyebrow">Publica tu calendario</p>
        <h1>Registra tu tienda</h1>
        <p>
          Durante el piloto, VortexHub crea cuentas de tiendas mediante invitación para mantener el
          onboarding controlado y seguro.
        </p>
        <div className="form-grid">
          <Field label="Correo del dueño">
            <input autoComplete="email" placeholder="tu@tienda.com" readOnly type="email" />
          </Field>
          <Link className="button button-primary" href="/auth/login">Ya tengo invitación</Link>
        </div>
        <div className="auth-footer">
          <p>¿Ya tienes cuenta? <Link className="text-link" href="/auth/login">Iniciar sesión</Link></p>
          <Link className="text-link" href="/">← Volver al calendario</Link>
        </div>
      </section>
    </main>
  );
}
