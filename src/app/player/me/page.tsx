import Link from "next/link";
import { FeedbackState } from "@/components/feedback-state";
import { PageHeader } from "@/components/frontend";
import { PlayerProfileOnboardingForm } from "@/components/player/player-profile-onboarding-form";
import { PublicShell } from "@/components/public-shell";
import { getOptionalUser } from "@/lib/auth/optional-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerProfile } from "@/schemas/player";
import { DomainCommandService } from "@/services/domain-command-service";

export default async function PlayerProfilePage() {
  const supabase = await createSupabaseServerClient();
  const user = await getOptionalUser(supabase);

  if (!user) {
    return (
      <PublicShell>
        <main className="page-container">
          <FeedbackState
            action={<Link className="button button-primary" href="/auth/login?mode=player&redirectTo=/player/me">Ingresar como jugador</Link>}
            description="Necesitas una cuenta activa para crear tu identidad de jugador."
            eyebrow="Jugadores"
            title="Entra para crear tu perfil"
          />
        </main>
      </PublicShell>
    );
  }

  const service = new DomainCommandService(supabase);
  let profile: PlayerProfile | null;

  try {
    profile = await service.execute<PlayerProfile | null>("get_my_player_profile");
  } catch {
    return (
      <PublicShell>
        <main className="page-container">
          <FeedbackState
            action={<Link className="button button-primary" href="/auth/onboarding">Completar cuenta</Link>}
            description="Tu cuenta debe estar activa y con la declaracion de mayoria de edad vigente antes de crear un perfil de jugador."
            eyebrow="Cuenta pendiente"
            title="Falta completar tu acceso"
          />
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <main className="page-container player-profile-page">
        {profile ? (
          <>
            <PageHeader
              action={<Link className="button button-primary" href="/player/qr">Ver QR</Link>}
              description="Tu perfil es global para VortexHub. Las tiendas no pueden crear perfiles por ti ni usarlo como ficha publica."
              eyebrow="Perfil de jugador"
              title="Tu identidad de jugador"
            />
            <section className="player-profile-summary">
              <div className="player-avatar-placeholder" aria-hidden="true">
                {profile.nickname.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <span className="eyebrow">Nickname</span>
                <h2>{profile.nickname} <span>· {profile.playerTag}</span></h2>
                <p>
                  El tag es inmutable y sirve para desambiguar nicknames repetidos en contextos
                  autorizados. No habilita busqueda publica ni reemplaza el QR.
                </p>
              </div>
            </section>
          </>
        ) : (
          <section className="player-onboarding-layout">
            <div>
              <span className="eyebrow">Stage 2 piloto</span>
              <h1>Crea tu perfil de jugador</h1>
              <p className="lead">
                VortexHub guardara solo un nickname y un tag aleatorio. El QR se crea al mismo
                tiempo para probar la identidad de jugador sin perfiles publicos.
              </p>
              <div className="player-interest-proof" aria-label="Alcance del perfil de jugador">
                <span>Un perfil global</span>
                <span>Tag inmutable</span>
                <span>QR revocable</span>
              </div>
            </div>
            <div className="player-onboarding-panel">
              <PlayerProfileOnboardingForm />
            </div>
          </section>
        )}
      </main>
    </PublicShell>
  );
}
