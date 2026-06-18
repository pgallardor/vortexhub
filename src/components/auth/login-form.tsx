"use client";

import { FormEvent, useState } from "react";
import { Field } from "@/components/frontend";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Correo o contraseña inválidos.");
        return;
      }

      window.location.assign(redirectTo);
    } catch {
      setErrorMessage("No pudimos iniciar sesión. Revisa que Supabase local esté activo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <Field label="Correo">
        <input
          autoComplete="email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@tienda.com"
          required
          type="email"
          value={email}
        />
      </Field>
      <Field label="Contraseña">
        <input
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
          type="password"
          value={password}
        />
      </Field>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <button className="button button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Entrando..." : "Entrar al panel"}
      </button>
    </form>
  );
}
