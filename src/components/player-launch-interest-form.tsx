"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Field } from "@/components/frontend";

type ApiResponse<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

async function readApiResponse<T>(response: Response): Promise<T | null> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos guardar tu correo.");
  }

  return body.data ?? null;
}

export function PlayerLaunchInterestForm() {
  const [email, setEmail] = useState("");
  const [consentLaunchEmail, setConsentLaunchEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await readApiResponse(await fetch("/api/v1/player-launch-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "player_tab",
          consentLaunchEmail,
        }),
      }));
      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos guardar tu correo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="player-interest-success" role="status">
        <span className="status-badge status-success">
          <span className="status-dot" aria-hidden="true" />
          Listo
        </span>
        <h2>Te avisaremos cuando el perfil de jugador esté disponible.</h2>
        <p>
          Guardamos tu correo solo para el aviso de lanzamiento de esta experiencia. Mientras tanto,
          puedes seguir explorando eventos y tiendas.
        </p>
      </div>
    );
  }

  return (
    <form className="player-interest-form" onSubmit={handleSubmit}>
      <Field label="Correo">
        <input
          autoComplete="email"
          inputMode="email"
          maxLength={320}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@correo.com"
          required
          type="email"
          value={email}
        />
      </Field>
      <label className="checkbox-row">
        <input
          checked={consentLaunchEmail}
          onChange={(event) => setConsentLaunchEmail(event.target.checked)}
          required
          type="checkbox"
        />
        <span>Quiero recibir un aviso cuando se abra el registro de jugadores.</span>
      </label>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <button className="button button-primary" disabled={isSubmitting || !consentLaunchEmail} type="submit">
        {isSubmitting ? "Guardando..." : "Avísenme del lanzamiento"}
      </button>
    </form>
  );
}
