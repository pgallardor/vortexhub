"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

type MembershipResponse = {
  id: string;
  store_id: string;
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }
  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

export function StoreInvitationAcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function acceptInvitation() {
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const membership = await readApiResponse<MembershipResponse>(await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }));

      router.refresh();
      router.replace(`/admin/stores/${membership.store_id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos aceptar la invitación.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-grid">
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <button className="button button-primary" disabled={isSubmitting} onClick={acceptInvitation} type="button">
        {isSubmitting ? "Aceptando..." : "Aceptar invitación"}
      </button>
    </div>
  );
}
