"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { queueUserFeedback } from "@/components/user-feedback";
import type { StoreSummary } from "@/lib/frontend/domain";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

async function readApiResponse<T>(response: Response): Promise<T | null> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operacion.");
  }

  return body.data ?? null;
}

export function StoreActivationActions({ store }: { store: StoreSummary }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canActivate = store.status === "pending";

  async function activateStore() {
    if (!canActivate || isSubmitting) return;

    const message = `Activar "${store.name}" y permitir que sus eventos publicados aparezcan en calendarios publicos?`;
    if (!window.confirm(message)) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/stores/${store.id}/activate`, { method: "POST" });
      await readApiResponse(response);
      queueUserFeedback({
        tone: "success",
        title: "Tienda activada",
        description: `${store.name} puede publicar eventos visibles según su configuración de visibilidad.`,
        action: {
          label: "Crear evento",
          href: `/admin/stores/${store.id}/events/new`,
        },
      }, { deliverNow: true });
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos activar la tienda.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="store-lifecycle-actions">
      <button
        className="button button-primary"
        disabled={!canActivate || isSubmitting}
        onClick={activateStore}
        type="button"
      >
        {isSubmitting ? "Activando..." : "Activar tienda"}
      </button>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
    </div>
  );
}
