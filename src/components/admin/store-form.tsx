"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field } from "@/components/frontend";

type StoreResponse = {
  id: string;
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

function trimOrNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function StoreForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const payload = {
        name: String(formData.get("name") ?? "").trim(),
        slug: trimOrNull(formData.get("slug")) ?? undefined,
        description: trimOrNull(formData.get("description")),
        timezone: String(formData.get("timezone") ?? "").trim(),
      };

      const store = await readApiResponse<StoreResponse>(await fetch("/api/v1/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));

      router.refresh();
      router.replace(store.id ? `/admin/stores/${store.id}` : "/admin/stores");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos crear la tienda.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-card form-grid" onSubmit={onSubmit}>
      <Field label="Nombre de la tienda">
        <input name="name" placeholder="La Mazmorra TCG" required />
      </Field>
      <Field label="Slug público" hint="Opcional. Si lo dejas vacío, VortexHub genera uno desde el nombre.">
        <input name="slug" placeholder="la-mazmorra-tcg" />
      </Field>
      <Field label="Descripción">
        <textarea name="description" placeholder="Describe tu comunidad, foco de juegos o tipo de eventos." />
      </Field>
      <Field label="Zona horaria">
        <input defaultValue="America/Santiago" name="timezone" placeholder="America/Santiago" required />
      </Field>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <div className="button-row">
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creando..." : "Crear tienda"}
        </button>
      </div>
    </form>
  );
}
