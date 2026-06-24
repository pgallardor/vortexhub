"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }

  return body.data ?? null;
}

export function StoreVisibilityActions({ store }: { store: StoreSummary }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextVisibility = !store.isPubliclyVisible;

  async function updateVisibility() {
    const message = nextVisibility
      ? `Publicar "${store.name}" en el directorio y calendarios publicos?`
      : `Ocultar "${store.name}" del directorio y calendarios publicos?`;

    if (!window.confirm(message)) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/stores/${store.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPubliclyVisible: nextVisibility }),
      });
      await readApiResponse(response);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos actualizar la visibilidad publica.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="store-visibility-actions">
      <button
        className={store.isPubliclyVisible ? "button button-secondary" : "button button-primary"}
        disabled={isSubmitting || store.status !== "active"}
        onClick={updateVisibility}
        type="button"
      >
        {isSubmitting
          ? "Actualizando..."
          : store.isPubliclyVisible ? "Ocultar calendario publico" : "Publicar calendario"}
      </button>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
    </div>
  );
}
