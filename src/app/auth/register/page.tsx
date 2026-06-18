import Link from "next/link";
import { Brand, Field } from "@/components/frontend";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <p className="eyebrow">Publica tu calendario</p>
        <h1>Registra tu tienda</h1>
        <p>Crea una cuenta de operador para administrar tiendas, sucursales y eventos.</p>
        <form className="form-grid">
          <Field label="Nombre visible"><input placeholder="Alex" /></Field>
          <Field label="Correo"><input autoComplete="email" placeholder="tu@tienda.com" type="email" /></Field>
          <Field label="Contraseña"><input autoComplete="new-password" placeholder="••••••••" type="password" /></Field>
          <label className="checkbox-row">
            <input type="checkbox" />
            <span>Declaro que tengo al menos 18 años. La aceptación real será versionada e inmutable.</span>
          </label>
          <Link className="button button-primary" href="/admin">Ver demo como tienda</Link>
        </form>
        <div className="auth-footer">
          <p>¿Ya tienes cuenta? <Link className="text-link" href="/auth/login">Iniciar sesión</Link></p>
          <Link className="text-link" href="/">← Volver al calendario</Link>
        </div>
      </section>
    </main>
  );
}
