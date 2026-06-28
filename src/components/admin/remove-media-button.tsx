"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { queueUserFeedback } from "@/components/user-feedback";

export function RemoveMediaButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeAsset() {
    setErrorMessage(null);
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/v1/media/${assetId}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error?.message ?? "No pudimos remover la imagen.");
      }

      queueUserFeedback({
        tone: "success",
        title: "Imagen removida",
        description: "El recurso dejó de estar disponible para nuevas selecciones.",
      }, { deliverNow: true });
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos remover la imagen.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <>
      <button className="button button-danger" disabled={isRemoving} onClick={removeAsset} type="button">
        {isRemoving ? "Removiendo..." : "Remover"}
      </button>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
    </>
  );
}
