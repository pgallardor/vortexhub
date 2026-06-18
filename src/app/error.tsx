"use client";

import { FeedbackState } from "@/components/feedback-state";
import { PublicShell } from "@/components/frontend";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <PublicShell>
      <main className="page-container route-state-page">
        <FeedbackState
          eyebrow="No pudimos cargar esta vista"
          title="Algo salió mal"
          description="La demo sigue disponible. Puedes intentar cargar esta sección nuevamente."
          action={<button className="button button-primary" type="button" onClick={reset}>Intentar de nuevo</button>}
        />
      </main>
    </PublicShell>
  );
}
