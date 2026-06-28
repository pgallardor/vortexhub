"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function RenameMediaButton({
  assetId,
  currentDisplayName,
}: {
  assetId: string;
  currentDisplayName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedDisplayName = displayName.trim();
    if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 120) {
      setErrorMessage("El nombre debe tener entre 2 y 120 caracteres.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/v1/media/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: normalizedDisplayName }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error?.message ?? "No pudimos renombrar el banner.");
      }

      setIsEditing(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos renombrar el banner.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <button className="button button-secondary" onClick={() => setIsEditing(true)} type="button">
        Renombrar
      </button>
    );
  }

  return (
    <form className="media-rename-form" onSubmit={saveName}>
      <label className="sr-only" htmlFor={`media-name-${assetId}`}>Nombre del banner</label>
      <input
        id={`media-name-${assetId}`}
        maxLength={120}
        onChange={(event) => setDisplayName(event.target.value)}
        type="text"
        value={displayName}
      />
      <button className="button button-primary" disabled={isSaving} type="submit">
        {isSaving ? "Guardando..." : "Guardar"}
      </button>
      <button
        className="button button-secondary"
        disabled={isSaving}
        onClick={() => {
          setDisplayName(currentDisplayName);
          setErrorMessage(null);
          setIsEditing(false);
        }}
        type="button"
      >
        Cancelar
      </button>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
    </form>
  );
}
