"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function cleanCurrentUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  return url.toString();
}

export function InviteSessionBridge() {
  const [message, setMessage] = useState("Validando tu invitación...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    async function acceptInviteFromUrl() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashError = hashParams.get("error_description") ?? hashParams.get("error");
      const queryError = new URLSearchParams(window.location.search).get("error_description");

      if (hashError || queryError) {
        setMessage(hashError ?? queryError ?? "El enlace no pudo validarse.");
        setFailed(true);
        return;
      }

      if (!accessToken || !refreshToken) {
        setMessage("Abre esta pantalla desde el enlace de invitación que recibiste por correo.");
        setFailed(true);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setMessage("El enlace expiró o ya fue usado. Pide una nueva invitación.");
        setFailed(true);
        return;
      }

      window.location.replace(cleanCurrentUrl());
    }

    void acceptInviteFromUrl();
  }, []);

  return (
    <div className="form-grid">
      <p>{message}</p>
      {failed ? (
        <div className="button-row">
          <Link className="button button-secondary" href="/auth/login">Ir a login</Link>
        </div>
      ) : (
        <div className="loading-state">
          <span className="loading-spinner" aria-hidden="true" />
          Preparando tu cuenta
        </div>
      )}
    </div>
  );
}
