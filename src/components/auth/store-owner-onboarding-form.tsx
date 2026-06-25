"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Field } from "@/components/frontend";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

type Strength = {
  score: number;
  label: string;
  hint: string;
};

function passwordStrength(password: string): Strength {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password) {
    return { score: 0, label: "Pendiente", hint: "Usa al menos 10 caracteres." };
  }
  if (score <= 1) {
    return { score, label: "Débil", hint: "Combina mayúsculas, minúsculas, números y símbolos." };
  }
  if (score <= 3) {
    return { score, label: "Buena", hint: "Puedes mejorarla agregando longitud o un símbolo." };
  }
  return { score, label: "Fuerte", hint: "Lista para proteger el acceso de la tienda." };
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "No pudimos completar la operación.");
  }
  if (!body.data) throw new Error("La respuesta del servidor no incluyó datos.");
  return body.data;
}

export function StoreOwnerOnboardingForm({
  email,
  legalDocument,
}: {
  email: string;
  legalDocument: LegalDocument;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acceptedAgeDeclaration, setAcceptedAgeDeclaration] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = password.length > 0 && password === passwordConfirmation;
  const canSubmit = strength.score >= 3 && passwordsMatch && acceptedAgeDeclaration && displayName.trim().length >= 2;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        throw new Error(passwordError.message || "No pudimos guardar la contraseña.");
      }

      await readApiResponse(await fetch("/api/v1/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      }));
      await readApiResponse(await fetch("/api/v1/account/legal-acceptances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: legalDocument.id }),
      }));
      await readApiResponse(await fetch("/api/v1/account/activate", {
        method: "POST",
      }));

      router.replace("/admin/stores/new");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos crear la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <Field label="Correo">
        <input readOnly value={email} />
      </Field>
      <Field label="Nombre visible">
        <input
          autoComplete="name"
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Alex"
          required
          value={displayName}
        />
      </Field>
      <Field label="Contraseña" hint={strength.hint}>
        <input
          autoComplete="new-password"
          minLength={10}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••••"
          required
          type="password"
          value={password}
        />
      </Field>
      <div className={`password-strength strength-${strength.score}`}>
        <span>Fuerza: {strength.label}</span>
        <div aria-hidden="true">
          {[0, 1, 2, 3].map((step) => (
            <i className={step < strength.score ? "active" : undefined} key={step} />
          ))}
        </div>
      </div>
      <Field label="Confirmar contraseña">
        <input
          autoComplete="new-password"
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          placeholder="••••••••••"
          required
          type="password"
          value={passwordConfirmation}
        />
      </Field>
      {passwordConfirmation && !passwordsMatch ? (
        <p className="form-error" role="alert">Las contraseñas no coinciden.</p>
      ) : null}
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
      <button className="button button-primary" disabled={!canSubmit || isSubmitting} type="submit">
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta y entrar al panel"}
      </button>
    </form>
  );
}
