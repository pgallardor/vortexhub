"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicNavigation() {
  const pathname = usePathname();

  return (
    <nav className="public-nav" aria-label="Navegación pública">
      <Link className={pathname === "/" ? "active" : undefined} href="/#events">Eventos</Link>
      <Link className={pathname.startsWith("/stores") ? "active" : undefined} href="/stores">Tiendas</Link>
      <Link className={pathname.startsWith("/player") ? "active" : undefined} href="/player/me">Jugadores</Link>
    </nav>
  );
}
