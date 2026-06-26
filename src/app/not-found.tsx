import { BackToCalendarAction, FeedbackState } from "@/components/feedback-state";
import { PublicShell } from "@/components/public-shell";

export default function NotFoundPage() {
  return (
    <PublicShell>
      <main className="page-container route-state-page">
        <FeedbackState
          eyebrow="Página no encontrada"
          title="Este enlace ya no está disponible"
          description="Revisa la dirección o vuelve al calendario para seguir explorando eventos y tiendas."
          action={<BackToCalendarAction />}
        />
      </main>
    </PublicShell>
  );
}
