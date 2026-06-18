"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BranchSummary } from "@/lib/frontend/domain";

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

export function BranchActions({ branch }: { branch: BranchSummary }) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function discardDraftBranch() {
    if (!window.confirm(`Descartar el borrador "${branch.name}"?`)) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/branches/${branch.id}`, { method: "DELETE" });
      await readApiResponse(response);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos descartar la sucursal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function closeBranch() {
    const publicMessage = window.prompt(
      `Mensaje público para cerrar "${branch.name}"`,
      "Esta sucursal ya no recibirá eventos publicados.",
    );
    if (!publicMessage) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/branches/${branch.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicMessage, internalReason: null }),
      });
      await readApiResponse(response);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos cerrar la sucursal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {branch.status === "draft" ? (
        <button className="button button-danger" disabled={isSubmitting} onClick={discardDraftBranch} type="button">
          {isSubmitting ? "Descartando..." : "Descartar borrador"}
        </button>
      ) : null}
      {branch.status === "active" ? (
        <button className="button button-danger" disabled={isSubmitting} onClick={closeBranch} type="button">
          {isSubmitting ? "Cerrando..." : "Cerrar sucursal"}
        </button>
      ) : null}
      {errorMessage ? <p className="form-error branch-action-error" role="alert">{errorMessage}</p> : null}
    </>
  );
}
