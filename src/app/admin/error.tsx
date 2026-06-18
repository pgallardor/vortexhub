"use client";

import { FeedbackState } from "@/components/feedback-state";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="route-state-page">
      <FeedbackState
        eyebrow="Panel no disponible"
        title="No pudimos cargar esta sección"
        description="Tus datos mock siguen intactos. Intenta abrir nuevamente esta vista del panel."
        action={<button className="button button-primary" type="button" onClick={reset}>Intentar de nuevo</button>}
      />
    </div>
  );
}
