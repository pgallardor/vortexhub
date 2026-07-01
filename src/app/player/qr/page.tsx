import Link from "next/link";
import { FeedbackState } from "@/components/feedback-state";
import { PlayerQrPanel } from "@/components/player/player-qr-panel";
import { PublicShell } from "@/components/public-shell";
import { getOptionalUser } from "@/lib/auth/optional-user";
import { buildPlayerQrCredentialMaterial } from "@/lib/player/qr";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlayerQrApiPayload, PlayerQrPayload } from "@/schemas/player";
import { DomainCommandService } from "@/services/domain-command-service";

export default async function PlayerQrPage() {
  const supabase = await createSupabaseServerClient();
  const user = await getOptionalUser(supabase);

  if (!user) {
    return (
      <PublicShell>
        <main className="page-container">
          <FeedbackState
            action={<Link className="button button-primary" href="/auth/login?mode=player&redirectTo=/player/qr">Ingresar como jugador</Link>}
            description="Necesitas una cuenta activa y un perfil de jugador antes de mostrar un QR."
            eyebrow="QR personal"
            title="Entra para ver tu QR"
          />
        </main>
      </PublicShell>
    );
  }

  const service = new DomainCommandService(supabase);
  let qr: PlayerQrPayload | null;

  try {
    qr = await service.execute<PlayerQrPayload | null>("get_my_player_qr");
  } catch {
    return (
      <PublicShell>
        <main className="page-container">
          <FeedbackState
            action={<Link className="button button-primary" href="/auth/onboarding">Completar cuenta</Link>}
            description="Tu cuenta debe estar activa y con la declaracion de mayoria de edad vigente antes de usar el QR."
            eyebrow="Cuenta pendiente"
            title="Falta completar tu acceso"
          />
        </main>
      </PublicShell>
    );
  }

  if (!qr) {
    return (
      <PublicShell>
        <main className="page-container">
          <FeedbackState
            action={<Link className="button button-primary" href="/player/me">Crear perfil</Link>}
            description="El QR se emite junto con tu perfil de jugador para mantener una sola identidad global."
            eyebrow="QR personal"
            title="Primero crea tu perfil"
          />
        </main>
      </PublicShell>
    );
  }

  let qrWithPayload: PlayerQrApiPayload;
  try {
    qrWithPayload = {
      ...qr,
      qrPayload: buildPlayerQrCredentialMaterial(qr.credential.displayNonce).qrPayload,
    };
  } catch {
    return (
      <PublicShell>
        <main className="page-container">
          <FeedbackState
            description="Define VORTEXHUB_QR_PEPPER con al menos 32 caracteres en el ambiente Stage 2 para renderizar QR persistentes sin guardar secretos en claro."
            eyebrow="Configuracion Stage 2"
            title="Falta configurar el pepper del QR"
          />
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <main className="page-container player-qr-page">
        <PlayerQrPanel initialQr={qrWithPayload} />
      </main>
    </PublicShell>
  );
}
