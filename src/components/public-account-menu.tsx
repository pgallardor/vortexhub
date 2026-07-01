"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PublicSessionSummary } from "@/lib/auth/public-session";

type PublicAccountMenuProps = {
  session: PublicSessionSummary;
};

export function PublicAccountMenu({ session }: PublicAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const playerLabel = session.hasPlayerProfile ? "Mi perfil" : "Crear perfil";
  const storeLabel = session.hasStoreMembership ? "Panel tienda" : "Sumar tienda";
  const storeHref = session.hasStoreMembership ? "/admin" : "/auth/register";

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="public-account-menu" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="public-account-trigger"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span>Cuenta</span>
        <strong>{session.displayName}</strong>
      </button>
      {isOpen ? (
        <div className="public-account-dropdown" role="menu">
          <div className="public-account-identity">
            <span>Sesión activa</span>
            <strong>{session.displayName}</strong>
            {session.email ? <small>{session.email}</small> : null}
          </div>
          <Link href="/player/me" onClick={() => setIsOpen(false)} role="menuitem">
            {playerLabel}
          </Link>
          <Link href={storeHref} onClick={() => setIsOpen(false)} role="menuitem">
            {storeLabel}
          </Link>
          <form action="/auth/logout" method="post" role="none">
            <button className="public-account-logout" role="menuitem" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
