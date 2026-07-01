"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Field } from "@/components/frontend";
import { queueUserFeedback } from "@/components/user-feedback";
import type { PlayerProfile } from "@/schemas/player";

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

export function PlayerProfileOnboardingForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = nickname.trim().length >= 2 && nickname.trim().length <= 40;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await readApiResponse<PlayerProfile>(await fetch("/api/v1/player/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      }));

      queueUserFeedback({
        tone: "success",
        title: "Perfil creado",
        description: "Tu identidad de jugador ya está lista para la prueba Stage 2.",
        action: { label: "Ver QR", href: "/player/qr" },
      });
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos crear el perfil.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid player-profile-form" onSubmit={onSubmit}>
      <Field
        label="Nickname"
        hint="Entre 2 y 40 caracteres. No tiene que ser único ni representa identidad legal."
      >
        <input
          autoComplete="nickname"
          maxLength={40}
          minLength={2}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="Kaiba"
          required
          value={nickname}
        />
      </Field>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <button className="button button-primary" disabled={!canSubmit || isSubmitting} type="submit">
        {isSubmitting ? "Creando perfil..." : "Crear perfil de jugador"}
      </button>
    </form>
  );
}
