import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { PlayerLaunchInterestForm } from "@/components/player-launch-interest-form";

export default function PlayerProfilePage() {
  return (
    <PublicShell>
      <main className="page-container player-interest-page">
        <section className="player-interest-hero">
          <div className="player-interest-copy">
            <span className="eyebrow">Próximamente para jugadores</span>
            <h1>Tu identidad de jugador en VortexHub está por abrirse</h1>
            <p className="lead">
              El calendario público ya ayuda a encontrar eventos. La siguiente experiencia será un
              perfil de jugador con registro en eventos y QR personal, sin crear perfiles públicos.
            </p>
            <div className="player-interest-proof" aria-label="Alcance del lanzamiento de jugadores">
              <span>Perfil global</span>
              <span>QR privado</span>
              <span>Registro interno</span>
            </div>
          </div>
          <div className="player-interest-panel">
            <div>
              <span className="eyebrow">Aviso de lanzamiento</span>
              <h2>Recibe un recordatorio cuando se active el registro</h2>
              <p>
                No enviaremos correos durante la demo. Tu correo queda guardado para un aviso único
                de lanzamiento, enviado por tandas si hace falta.
              </p>
            </div>
            <PlayerLaunchInterestForm />
          </div>
        </section>

        <section className="player-interest-info" aria-label="Vista previa de experiencia de jugador">
          <div>
            <h2>Un perfil para todas las tiendas</h2>
            <p>
              La cuenta y el perfil de jugador estarán separados. Una tienda no podrá crear perfiles
              por ti ni publicar una ficha pública de jugador.
            </p>
          </div>
          <div>
            <h2>QR como identificador, no como contraseña</h2>
            <p>
              El QR será opaco y solo tendrá sentido dentro de una acción autorizada por una tienda,
              como registro o validación futura.
            </p>
          </div>
          <div>
            <h2>Eventos primero, datos mínimos</h2>
            <p>
              El lanzamiento mantendrá la información de jugador al mínimo: nickname, avatar opcional
              y controles para participar en eventos.
            </p>
          </div>
        </section>

        <section className="player-interest-calendar-link">
          <div>
            <span className="eyebrow">Mientras tanto</span>
            <h2>Explora los eventos que ya están publicados</h2>
          </div>
          <div className="button-row">
            <Link className="button button-secondary" href="/#events">Ver eventos</Link>
            <Link className="button button-secondary" href="/stores">Ver tiendas</Link>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
