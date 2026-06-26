"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/frontend";

function navClassName(pathname: string, href: string) {
  return pathname === href ? "active" : undefined;
}

export function AdminShell({
  children,
  defaultStoreId,
}: {
  children: ReactNode;
  defaultStoreId?: string;
}) {
  const pathname = usePathname();
  const storeId = pathname.match(/^\/admin\/stores\/([^/]+)/)?.[1] ?? defaultStoreId;
  const isCalendarRoute = pathname.startsWith(`/admin/stores/${storeId}/calendar`);
  const hasStore = Boolean(storeId);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        <p className="eyebrow">Administración</p>
        <nav className="admin-nav" aria-label="Navegación administrativa">
          <Link className={navClassName(pathname, "/admin")} href="/admin">Resumen</Link>
          <Link className={navClassName(pathname, "/admin/stores")} href="/admin/stores">Mis tiendas</Link>
          {hasStore ? (
            <>
              <Link className={navClassName(pathname, `/admin/stores/${storeId}`)} href={`/admin/stores/${storeId}`}>Tienda activa</Link>
              <Link className={navClassName(pathname, `/admin/stores/${storeId}/branches`)} href={`/admin/stores/${storeId}/branches`}>Sucursales</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/calendar`) ? "active" : undefined} href={`/admin/stores/${storeId}/calendar`}>Calendario</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/events`) ? "active" : undefined} href={`/admin/stores/${storeId}/events`}>Eventos</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/banners`) ? "active" : undefined} href={`/admin/stores/${storeId}/banners`}>Banners</Link>
              <Link className={pathname.startsWith(`/admin/stores/${storeId}/series`) ? "active" : undefined} href={`/admin/stores/${storeId}/series`}>Series</Link>
            </>
          ) : null}
        </nav>
        <form action="/auth/logout" method="post" className="admin-logout-form">
          <button className="admin-logout-button" type="submit">Cerrar sesión</button>
        </form>
      </aside>
      <div className="admin-main">
        <header className="admin-mobile-header">
          <div className="admin-mobile-topbar">
            <Brand />
            <form action="/auth/logout" method="post">
              <button className="admin-logout-button" type="submit">Cerrar sesión</button>
            </form>
          </div>
          <nav className="admin-mobile-nav" aria-label="Navegación administrativa móvil">
            <Link className={navClassName(pathname, "/admin")} href="/admin">Resumen</Link>
            {hasStore ? (
              <>
                <Link className={navClassName(pathname, `/admin/stores/${storeId}`)} href={`/admin/stores/${storeId}`}>Tienda</Link>
                <Link className={navClassName(pathname, `/admin/stores/${storeId}/branches`)} href={`/admin/stores/${storeId}/branches`}>Sucursales</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/calendar`) ? "active" : undefined} href={`/admin/stores/${storeId}/calendar`}>Calendario</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/events`) ? "active" : undefined} href={`/admin/stores/${storeId}/events`}>Eventos</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/banners`) ? "active" : undefined} href={`/admin/stores/${storeId}/banners`}>Banners</Link>
                <Link className={pathname.startsWith(`/admin/stores/${storeId}/series`) ? "active" : undefined} href={`/admin/stores/${storeId}/series`}>Series</Link>
              </>
            ) : null}
          </nav>
        </header>
        <main className={`admin-content${isCalendarRoute ? " admin-content-wide" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
