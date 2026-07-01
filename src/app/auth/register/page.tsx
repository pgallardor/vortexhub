import Link from "next/link";
import { Brand } from "@/components/frontend";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <section className="form-card auth-card">
        <Brand />
        <p className="eyebrow">Publica tu calendario</p>
        <h1>Registra tu tienda</h1>
        <p>
          Por ahora, el registro de tiendas no es autoservicio. Para sumar tu tienda al piloto o
          preparar el acceso antes del lanzamiento oficial, ponte en contacto con Vortex.
        </p>
        <div className="form-grid">
          <a className="button button-primary" href="mailto:pedro@pgrsoftware.net">Contactar a Vortex</a>
          <p>
            Escríbenos a <a className="text-link" href="mailto:pedro@pgrsoftware.net">pedro@pgrsoftware.net</a>
            {" "}y te ayudamos a activar tu tienda.
          </p>
          <Link className="button button-secondary" href="/auth/login">Ya tengo invitación</Link>
        </div>
        <div className="auth-footer">
          <p>¿Ya tienes cuenta? <Link className="text-link" href="/auth/login">Iniciar sesión</Link></p>
          <Link className="text-link" href="/">← Volver al calendario</Link>
        </div>
      </section>
    </main>
  );
}
