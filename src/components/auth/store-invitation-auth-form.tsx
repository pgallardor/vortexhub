"use client";

import { type FormEvent, useState } from "react";
import { Field } from "@/components/frontend";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "signup" | "login";

function callbackUrl(redirectTo: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", redirectTo);
  return callback.toString();
}

export function StoreInvitationAuthForm({
  acceptRedirectTo,
  invitedEmail,
  signupRedirectTo,
}: {
  acceptRedirectTo: string;
  invitedEmail: string;
  signupRedirectTo: string;
}) {
  const [mode, setMode] = useState<Mode>("signup");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: invitedEmail,
          password,
          options: {
            emailRedirectTo: callbackUrl(signupRedirectTo),
          },
        });

        if (error) {
          setErrorMessage(error.message || "No pudimos crear la cuenta.");
          return;
        }

        if (data.session) {
          window.location.assign(
            `/auth/onboarding?redirectTo=${encodeURIComponent(acceptRedirectTo)}&passwordMode=skip`,
          );
          return;
        }

        setMessage("Revisa tu correo para confirmar la cuenta. Después volverás a esta invitación para completar tu nombre visible.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: invitedEmail,
        password,
      });

      if (error) {
        setErrorMessage("Correo o contraseña inválidos.");
        return;
      }

      window.location.assign(acceptRedirectTo);
    } catch {
      setErrorMessage("No pudimos continuar. Revisa que Supabase esté disponible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-grid">
      <div className="auth-mode-switch" role="tablist" aria-label="Tipo de acceso">
        <button
          aria-selected={mode === "signup"}
          className={mode === "signup" ? "selected" : undefined}
          onClick={() => {
            setMode("signup");
            setErrorMessage(null);
            setMessage(null);
          }}
          role="tab"
          type="button"
        >
          Crear cuenta
        </button>
        <button
          aria-selected={mode === "login"}
          className={mode === "login" ? "selected" : undefined}
          onClick={() => {
            setMode("login");
            setErrorMessage(null);
            setMessage(null);
          }}
          role="tab"
          type="button"
        >
          Ya tengo cuenta
        </button>
      </div>
      <form className="form-grid" onSubmit={onSubmit}>
        <Field label="Correo invitado" hint="La invitación solo puede aceptarse con este correo verificado.">
          <input
            autoComplete="email"
            inputMode="email"
            readOnly
            required
            type="email"
            value={invitedEmail}
          />
        </Field>
        <Field label="Contraseña">
          <input
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={mode === "signup" ? 10 : undefined}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••"
            required
            type="password"
            value={password}
          />
        </Field>
        {message ? <p className="form-helper" role="status">{message}</p> : null}
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        <button className="button button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Continuando..."
            : mode === "signup" ? "Crear cuenta" : "Entrar y aceptar"}
        </button>
      </form>
    </div>
  );
}
