"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type LegalDocument = {
  id: string;
  version: string;
  content: string;
};

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }
  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

export function LegalAcceptanceForm({
  legalDocument,
  redirectTo,
}: {
  legalDocument: LegalDocument;
  redirectTo: string;
}) {
  const router = useRouter();
  const [acceptedAgeDeclaration, setAcceptedAgeDeclaration] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acceptedAgeDeclaration || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await readApiResponse(await fetch("/api/v1/account/legal-acceptances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: legalDocument.id }),
      }));

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos guardar la aceptación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label className="checkbox-row">
        <input
          checked={acceptedAgeDeclaration}
          onChange={(event) => setAcceptedAgeDeclaration(event.target.checked)}
          required
          type="checkbox"
        />
        <span>{legalDocument.content}</span>
      </label>
      <p className="form-helper">Versión legal: {legalDocument.version}</p>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <button className="button button-primary" disabled={!acceptedAgeDeclaration || isSubmitting} type="submit">
        {isSubmitting ? "Guardando..." : "Aceptar y continuar"}
      </button>
    </form>
  );
}
